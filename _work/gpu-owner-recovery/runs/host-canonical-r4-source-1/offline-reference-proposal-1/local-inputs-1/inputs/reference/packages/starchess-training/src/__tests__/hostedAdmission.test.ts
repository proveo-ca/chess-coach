// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { readFileSync } from "node:fs";
import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { openPlanningScope, hostedFlattenFeaturesV3, recheckPlanningScope } from "../coordinator/planningScope";
import { authenticateAcceptedPermit, activeAcceptedPermit, acceptChildPlanPermit, constructTrustedExecutionContext, createEpisodeReplica,
  expectedBeginMessage, expectedReadyMessage, physicalRef, startChildReplica, verifyNativeMessage } from "../coordinator/episodeVerification";
import { createEpisodeChannel, encodeEpisodeMessage } from "../coordinator/episodeProtocol";
import { constructCorpusSchedule, constructDurableStartedEpisode, constructEpisodeRequest, constructLogicalExpectedEpisodeBindings,
  constructSerialMasterEpisodeStart } from "../coordinator/episodeRequest";
import { constructActiveStreamState, constructEpisodeStartStreams, constructUnusedEnvironmentState, deriveEpisodeRoot, reconstructStartedSelection } from "../coordinator/episodeRng";
import { encodeOwnedNumber } from "../economic/ownedScalars";
import { createRegisteredByteStore } from "../coordinator/registeredBytes";

const fixture = () => {
  const bytes = Buffer.from(`[${Array(418).fill('{"hex":"0000000000000000"}').join(",")}]`), manifest = Buffer.from('"manifest"');
  const weightsRef = physicalRef(bytes), manifestRef = physicalRef(manifest), pinRef = physicalRef(Buffer.from('"pin"'));
  const selection = reconstructStartedSelection(101, 0), p = deriveEpisodeRoot(101, "policy-sampling"), o = deriveEpisodeRoot(101, "opponent");
  const policy = constructActiveStreamState(p, p, 0), opponent = constructActiveStreamState(o, o, 0);
  const streams = constructEpisodeStartStreams(selection.selection, constructUnusedEnvironmentState(deriveEpisodeRoot(101, "environment-settlement")), policy, opponent);
  const schedule = constructCorpusSchedule(selection.permutation[0]!), started = constructDurableStartedEpisode("attempt", 101, 0, schedule, streams);
  const serial = constructSerialMasterEpisodeStart(101, 1, 0, 0, weightsRef, manifestRef, policy, opponent);
  const expected = constructLogicalExpectedEpisodeBindings(started, serial, pinRef, manifestRef, manifestRef, manifestRef);
  const request = constructEpisodeRequest("attempt", 101, 0, weightsRef, manifestRef, encodeOwnedNumber(0), schedule, streams);
  const store = createRegisteredByteStore(); store.register("episodeWeights", weightsRef, bytes); store.register("featureManifest", manifestRef, manifest);
  return constructTrustedExecutionContext(request, expected, store.seal(), null, null);
};
describe("private hosted admission", () => {
  it("rejects JSON permits, clones and hostile objects before loading bindings or inspecting arguments", async () => {
    const trap = vi.fn(() => { throw new Error("inspection"); });
    const proxy = new Proxy({}, { get: trap, ownKeys: trap, getPrototypeOf: trap, getOwnPropertyDescriptor: trap });
    for (const forged of [undefined, null, {}, proxy, { permitId: "attempt:plan:0:b", planningOrdinal: 0, turn: 0, side: "b", role: "candidate" }, { valid: true }]) {
      expect(() => authenticateAcceptedPermit(forged)).toThrow("permit");
      await expect(openPlanningScope(forged as never)).rejects.toThrow("permit");
      expect(() => hostedFlattenFeaturesV3(forged as never, proxy as never)).toThrow("permit");
      expect(() => recheckPlanningScope(forged as never)).toThrow("permit");
    }
    expect(trap).not.toHaveBeenCalled();
  });
  it("does not turn a real channel null ACK into a planning scope", async () => {
    const context = fixture(), child = createEpisodeReplica(context, "child"), ready = expectedReadyMessage(child, 0);
    startChildReplica(child, ready, process.hrtime.bigint() + 300000000000n);
    verifyNativeMessage(child, expectedBeginMessage(child, 1));
    const input = new PassThrough(), output = new PassThrough(), channel = createEpisodeChannel(input, output, "attempt", "child");
    input.write(encodeEpisodeMessage({ version: "starchess-training-episode-v2", attemptId: "attempt", messageOrdinal: 0,
      kind: "turn-open-accepted", planningOrdinal: 0, nextPermit: null }).toString() + "\n");
    const frame = await channel.receive(); channel.decode(frame);
    expect(() => acceptChildPlanPermit(child, frame)).toThrow("permit");
    expect(() => activeAcceptedPermit(child)).toThrow("permit");
    await expect(openPlanningScope(null as never)).rejects.toThrow("permit");
    expect(() => acceptChildPlanPermit(child, frame)).toThrow("permit"); channel.close();
  });
  it("keeps construction ownership and capability types confined to planningScope", () => {
    const root = new URL("../coordinator/", import.meta.url);
    const scope = readFileSync(new URL("planningScope.ts", root), "utf8");
    expect(scope).toContain("createPlanningLedger");
    expect(scope).toContain("requireVerifiedSourceSeal");
    expect(scope).not.toMatch(/export\s+(?:type\s+)?\{[^}]*LedgerOwner/);
    for (const name of ["episodeProtocol.ts", "episodeSupervisor.ts", "episodeWorker.ts", "episodeVerification.ts"]) {
      const source = readFileSync(new URL(name, root), "utf8");
      expect(source).not.toMatch(/createPlanningLedger|\bLedgerOwner\b|\bLedgerPair\b|JSON\.parse|JSON\.stringify|Math\.random/);
      expect(source).not.toMatch(/@chess-coach\/starchess-arena\//);
    }
  });
});
