// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Readable } from "node:stream";
import * as startup from "../coordinator/startupScope";
import { createStartupArtifactContext, makeEconomicAuthority, makeEstimatorProvenance, constructRef, encodeOwnedAuthority } from "../economic/ownedKernel";
import { createHash } from "node:crypto";
import type { VerifiedSourceSeal } from "../coordinator/sourceBootstrap";
import type { OriginalEpisodeRequestV2 } from "../coordinator/episodeContracts";
import { createRegisteredByteStore } from "../coordinator/registeredBytes";
import { constructDurableStartedEpisode, constructSerialMasterEpisodeStart, constructLogicalExpectedEpisodeBindings, constructEpisodeRequest, constructCorpusSchedule } from "../coordinator/episodeRequest";
import { constructActiveStreamState, constructUnusedEnvironmentState, constructEpisodeStartStreams, deriveEpisodeRoot, reconstructStartedSelection } from "../coordinator/episodeRng";
import { encodeOwnedNumber } from "../economic/ownedScalars";

const selected = () => {
  const context = createStartupArtifactContext(), ref = constructRef(23, "a".repeat(64)), weights = constructRef(11287, "b".repeat(64));
  const authority = makeEconomicAuthority(context, ref, ref, ref, ref, ref, ref, ref), estimator = makeEstimatorProvenance(context, ref, ref, ref, ref, ref, ref, ref, ref, ref, ref);
  const authorityPhysical = encodeOwnedAuthority(context, authority), amendment = constructRef(authorityPhysical.length, createHash("sha256").update(authorityPhysical).digest("hex")),
    authorityBytes = startup.constructStartupAuthorityBytes(amendment, authorityPhysical);
  const policyRoot = deriveEpisodeRoot(101, "policy-sampling"), opponentRoot = deriveEpisodeRoot(101, "opponent"), selection = reconstructStartedSelection(101, 0);
  const streams = constructEpisodeStartStreams(selection.selection, constructUnusedEnvironmentState(deriveEpisodeRoot(101, "environment-settlement")),
    constructActiveStreamState(policyRoot, policyRoot, 0), constructActiveStreamState(opponentRoot, opponentRoot, 0));
  const schedule = constructCorpusSchedule(selection.permutation[0]!);
  const started = constructDurableStartedEpisode("startup-fixture", 101, 0, schedule, streams), serial = constructSerialMasterEpisodeStart(101, 1, 0, 0, weights, ref, streams["policy-sampling"], streams.opponent);
  const episode = constructLogicalExpectedEpisodeBindings(started, serial, ref, ref, ref, ref);
  const request = constructEpisodeRequest(started.attemptId, 101, 0, weights, ref, encodeOwnedNumber(0), schedule, streams);
  const refs = { economicArtifact: ref, featureManifest: ref, economicPin: ref, estimatorProvenance: ref, amendment, economicBinding: ref, policyArtifact: ref,
    trainingRecipe: ref, episodeWeights: weights, corpusManifest: ref, corpusSource: ref, source: ref, sourceInventory: ref, sourcePolicy: ref };
  const launch = { executable: "/host/node", arguments: ["/host/verified/episodeWorker.js"], directory: "/host/verified", environment: { PATH: "/host/bin", HOME: "/host/home", TMPDIR: "/host/tmp" } };
  return { refs, episode, launch, authority, estimator, request, authorityBytes };
};
const missingSeal = Object.freeze({}) as VerifiedSourceSeal;

describe("independent startup bindings without fabricated source authority", () => {
  it("constructs only opaque independent selections from owned references", () => {
    const f = selected(), expected = startup.constructStartupExpected(f.refs, f.episode, f.launch, f.authority, f.estimator);
    expect(Object.isFrozen(expected)).toBe(true); expect(Object.keys(expected)).toEqual([]);
    const store = createRegisteredByteStore().seal();
    expect(() => startup.constructBoundModels(expected, { models: store, authority: f.authorityBytes, constituents: store }, missingSeal, f.request)).toThrow("PROVENANCE");
    expect(() => startup.requireBoundModels(expected, missingSeal)).toThrow("PROVENANCE");
  });
  it("binds actual canonical authority bytes without issuing model or source authority", () => {
    const f = selected(), context = createStartupArtifactContext(), physical = encodeOwnedAuthority(context, f.authority);
    const binding = startup.constructStartupAuthorityBytes(f.refs.amendment, physical); physical.fill(0);
    expect(Object.isFrozen(binding)).toBe(true); expect(Object.keys(binding)).toEqual([]);
    expect(() => startup.requireBoundModels(binding, missingSeal)).toThrow("PROVENANCE");
    expect(() => startup.constructStartupAuthorityBytes(f.refs.amendment, physical)).toThrow("source");
  });
  it("rejects malformed authority schemas despite an independently matching physical hash", () => {
    const physical = new TextEncoder().encode('{"version":"starchess-economic-authority-v1"}'), ref = constructRef(physical.length, createHash("sha256").update(physical).digest("hex"));
    expect(() => startup.constructStartupAuthorityBytes(ref, physical)).toThrow("SCHEMA");
  });
  it("requires bound request/artifact/manifest identities without traversing caller graphs", () => {
    const f = selected(); let traps = 0;
    const hostile = new Proxy({}, { get() { traps++; throw new Error("trap"); } });
    expect(() => startup.requireBoundPlanningConfiguration(f.request, hostile as never, hostile as never)).toThrow("PROVENANCE"); expect(traps).toBe(0);
  });
  it("does not adopt a raw model configuration or corpus array", () => {
    const f = selected(); let touches = 0;
    const raw = new Proxy({}, { get() { touches++; throw new Error("trap"); }, ownKeys() { touches++; throw new Error("trap"); } });
    expect(() => startup.constructBoundModels(raw as startup.StartupExpected, raw as startup.StartupByteStores, missingSeal, f.request)).toThrow("PROVENANCE"); expect(touches).toBe(0);
  });
  it.each(["raw-ref", "unknown-key", "raw-authority", "raw-provenance", "environment"])("rejects invalid independent %s", mode => {
    const f = selected();
    const refs = mode === "raw-ref" ? { ...f.refs, economicArtifact: { ...f.refs.economicArtifact } } : mode === "unknown-key" ? { ...f.refs, corpus: [] } : f.refs;
    const launch = mode === "environment" ? { ...f.launch, environment: { ...f.launch.environment, NODE_OPTIONS: "--import=unverified" } } : f.launch;
    expect(() => startup.constructStartupExpected(refs, f.episode, launch, mode === "raw-authority" ? { ...f.authority } : f.authority,
      mode === "raw-provenance" ? { ...f.estimator } : f.estimator)).toThrow();
  });
  it("rejects substituted estimator selection before storing expectations", () => {
    const f = selected(), other = constructRef(23, "c".repeat(64));
    expect(() => startup.constructStartupExpected({ ...f.refs, economicArtifact: other }, f.episode, f.launch, f.authority, f.estimator)).toThrow("source");
  });
  it("rejects missing model identities before invoking model/proxy hooks", () => {
    let traps = 0; const raw = new Proxy({}, { get() { traps++; throw new Error("trap"); }, ownKeys() { traps++; throw new Error("trap"); } });
    expect(() => startup.requireBoundModels(raw, missingSeal)).toThrow("PROVENANCE");
    expect(() => startup.requireEpisodeConfiguration(raw, missingSeal, raw as OriginalEpisodeRequestV2)).toThrow("PROVENANCE");
    expect(() => startup.readBoundModelConfiguration(raw as startup.BoundModels, missingSeal)).toThrow("PROVENANCE");
    expect(() => startup.readBoundCorpusWhite(raw, raw as OriginalEpisodeRequestV2, 0)).toThrow("source"); expect(traps).toBe(0);
  });
  it("does not issue worker launch or transfer startup bytes without a real seal", () => {
    const f = selected(), fake = Object.freeze({}) as startup.BoundModels;
    expect(() => startup.readBoundWorkerLaunch(fake, missingSeal)).toThrow("PROVENANCE");
    expect(() => startup.readBoundChildStartupBytes(fake, missingSeal, f.request)).toThrow("PROVENANCE");
  });
  it("requires independent realm-local child authority before reading transport bytes", async () => {
    let reads = 0;
    const input = new Readable({ read() { reads++; this.push(Buffer.from("claimed-seal")); this.push(null); } });
    await expect(startup.loadChildEpisodeStartup(input)).rejects.toMatchObject({ reason: "source" }); expect(reads).toBe(0); input.destroy();
  });
  it("does not install a child bootstrap context from a forged seal", async () => {
    const f = selected(), expected = startup.constructStartupExpected(f.refs, f.episode, f.launch, f.authority, f.estimator), store = createRegisteredByteStore().seal();
    const input = Readable.from([]);
    expect(() => startup.bindChildStartupInput(input, expected, { models: store, authority: f.authorityBytes, constituents: store }, missingSeal)).toThrow("PROVENANCE");
    await expect(startup.loadChildEpisodeStartup(input)).rejects.toMatchObject({ reason: "source" }); input.destroy();
  });
  it("contains real role joins, eighteen audited cases and no source-seal issuer", () => {
    const source = readFileSync(new URL("../coordinator/startupScope.ts", import.meta.url), "utf8");
    for (const name of ["decodeOwnedEconomicArtifact", "decodeOwnedFeatureManifest", "decodeOwnedPin", "decodeOwnedEstimatorProvenance", "decodeOwnedBinding", "decodeOwnedTrainingRecipe"]) expect(source).toContain(`${name}(context`);
    expect(source).toContain("decodeOwnedAuthority(createStartupArtifactContext(), snapshot)");
    expect(source).toContain("checked.schedule.caseIndex"); expect(source).toContain("historyFromRecord(game)"); expect(source).toContain("MANIFEST_SHA256");
    expect(source).not.toMatch(/arena\/src|sourceSealIssuer|createPlanningLedger|LedgerOwner|LedgerPair|pending|: never => reject\(\)/);
    expect(source).toContain("constructTrustedExecutionContext(request"); expect(source).toContain("decodeRegisteredEconomicEpisodeRequest(binding");
  });
});
