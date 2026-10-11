// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { PassThrough } from "node:stream";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createEpisodeChannel, encodeEpisodeMessage } from "../coordinator/episodeProtocol";
import { launchEpisodeProcess, superviseEpisodeChannel } from "../coordinator/episodeSupervisor";
import {
  constructTrustedExecutionContext, createEpisodeReplica, expectedBeginMessage, expectedReadyMessage, physicalRef,
  startChildReplica, verifyNativeMessage,
} from "../coordinator/episodeVerification";
import {
  constructCorpusSchedule, constructDurableStartedEpisode, constructEpisodeRequest, constructLogicalExpectedEpisodeBindings,
  constructSerialMasterEpisodeStart,
} from "../coordinator/episodeRequest";
import { constructActiveStreamState, constructEpisodeStartStreams, constructUnusedEnvironmentState, deriveEpisodeRoot, reconstructStartedSelection } from "../coordinator/episodeRng";
import { encodeOwnedNumber } from "../economic/ownedScalars";
import { createRegisteredByteStore } from "../coordinator/registeredBytes";

const context = (source: unknown = null, models: unknown = null) => {
  const weights = Buffer.from(`[${Array(418).fill('{"hex":"0000000000000000"}').join(",")}]`), manifest = Buffer.from('"manifest fixture"'), pin = Buffer.from('"pin fixture"');
  const w = physicalRef(weights), m = physicalRef(manifest), p = physicalRef(pin);
  const selection = reconstructStartedSelection(101, 0), policyRoot = deriveEpisodeRoot(101, "policy-sampling"), opponentRoot = deriveEpisodeRoot(101, "opponent");
  const policy = constructActiveStreamState(policyRoot, policyRoot, 0), opponent = constructActiveStreamState(opponentRoot, opponentRoot, 0);
  const streams = constructEpisodeStartStreams(selection.selection, constructUnusedEnvironmentState(deriveEpisodeRoot(101, "environment-settlement")), policy, opponent);
  const schedule = constructCorpusSchedule(selection.permutation[0]!);
  const started = constructDurableStartedEpisode("attempt", 101, 0, schedule, streams);
  const serial = constructSerialMasterEpisodeStart(101, 1, 0, 0, w, m, policy, opponent);
  const expected = constructLogicalExpectedEpisodeBindings(started, serial, p, m, m, m);
  const request = constructEpisodeRequest("attempt", 101, 0, w, m, encodeOwnedNumber(0), schedule, streams);
  const owner = createRegisteredByteStore(); owner.register("episodeWeights", w, weights); owner.register("featureManifest", m, manifest);
  return constructTrustedExecutionContext(request, expected, owner.seal(), source, models);
};
const childFrames = (startup: ReturnType<typeof context>) => {
  const child = createEpisodeReplica(startup, "child"), ready = expectedReadyMessage(child, 0);
  startChildReplica(child, ready, process.hrtime.bigint() + 300000000000n);
  const begin = expectedBeginMessage(child, 1); verifyNativeMessage(child, begin);
  return { ready, begin, bytes: Buffer.concat([encodeEpisodeMessage(ready), Buffer.from("\n"), encodeEpisodeMessage(begin), Buffer.from("\n")]) };
};
describe("genuine native episode supervision", () => {
  it("checks real ready and complete begin payloads, then rejects missing startup authority before an ACK", async () => {
    const startup = context(), frames = childFrames(startup), parent = createEpisodeReplica(startup, "parent");
    const input = new PassThrough(), output = new PassThrough(), written: Buffer[] = [];
    output.on("data", bytes => written.push(bytes));
    const channel = createEpisodeChannel(input, output, "attempt", "parent"), reap = vi.fn(async () => undefined);
    const run = superviseEpisodeChannel(parent, channel, reap, process.hrtime.bigint()); input.write(frames.bytes);
    const result = await run;
    expect(result).toMatchObject({ classification: "infrastructure", reason: "source", reward: null, eligible: false, acceptedCandidateCount: 0 });
    expect(written).toHaveLength(0); expect(reap).toHaveBeenCalledOnce();
  });
  it("drains genuine coalesced ready/begin at EOF without renewing their original receipt", async () => {
    const startup = context(), frames = childFrames(startup), parent = createEpisodeReplica(startup, "parent");
    const input = new PassThrough(), output = new PassThrough(), written: Buffer[] = [];
    output.on("data", bytes => written.push(bytes));
    let receipt = 5n;
    const now = vi.fn(() => { const stamp = receipt; receipt += 300000000000n; return stamp; });
    const channel = createEpisodeChannel(input, output, "attempt", "parent", now), reap = vi.fn(async () => undefined);
    input.end(frames.bytes); await new Promise(resolve => setImmediate(resolve));
    const result = await superviseEpisodeChannel(parent, channel, reap, 0n, () => 5n);
    expect(result).toMatchObject({ classification: "infrastructure", reason: "source", reward: null, eligible: false, acceptedCandidateCount: 0 });
    expect(now).toHaveBeenCalledOnce(); expect(written).toHaveLength(0); expect(reap).toHaveBeenCalledOnce();
  });
  it("rejects an altered complete native begin even when its outcome labels remain unchanged", async () => {
    const startup = context(), frames = childFrames(startup), parent = createEpisodeReplica(startup, "parent");
    const input = new PassThrough(), output = new PassThrough(), channel = createEpisodeChannel(input, output, "attempt", "parent");
    const run = superviseEpisodeChannel(parent, channel, async () => undefined, process.hrtime.bigint());
    const begin = encodeEpisodeMessage(frames.begin).toString().replace('"changed":false', '"changed":true');
    input.write(encodeEpisodeMessage(frames.ready).toString() + "\n" + begin + "\n");
    expect(await run).toMatchObject({ classification: "infrastructure", reason: "protocol", reward: null });
  });
  it("rejects validity flags instead of treating them as source or model authority", async () => {
    const startup = context({ valid: true }, { valid: true }), frames = childFrames(startup), parent = createEpisodeReplica(startup, "parent");
    const input = new PassThrough(), output = new PassThrough(), channel = createEpisodeChannel(input, output, "attempt", "parent");
    const run = superviseEpisodeChannel(parent, channel, async () => undefined, process.hrtime.bigint()); input.write(frames.bytes);
    expect(await run).toMatchObject({ classification: "infrastructure", reason: "source", acceptedCandidateCount: 0 });
  });
  it("rejects raw ready receipt exactly at the startup deadline without relying on the timer queue", async () => {
    const startup = context(), frames = childFrames(startup), parent = createEpisodeReplica(startup, "parent");
    const input = new PassThrough(), output = new PassThrough(), launch = 500n, receipt = launch + 10000000000n;
    const channel = createEpisodeChannel(input, output, "attempt", "parent", () => receipt);
    input.write(encodeEpisodeMessage(frames.ready).toString() + "\n");
    const result = await superviseEpisodeChannel(parent, channel, async () => undefined, launch, () => receipt);
    expect(result).toMatchObject({ reason: "startup-timeout", classification: "infrastructure", reward: null });
  });
  it("includes ready verification time in the match deadline", async () => {
    const startup = context(), frames = childFrames(startup), parent = createEpisodeReplica(startup, "parent");
    const input = new PassThrough(), output = new PassThrough(), launch = 1n;
    const channel = createEpisodeChannel(input, output, "attempt", "parent", () => launch);
    input.write(encodeEpisodeMessage(frames.ready).toString() + "\n");
    const result = await superviseEpisodeChannel(parent, channel, async () => undefined, launch, () => launch + 300000000000n);
    expect(result).toMatchObject({ reason: "match-timeout", classification: "infrastructure", reward: null });
  });
  it("rejects a complete native frame at the raw-receipt match deadline", async () => {
    const startup = context(), frames = childFrames(startup), parent = createEpisodeReplica(startup, "parent");
    const input = new PassThrough(), output = new PassThrough(); let receipt = 5n;
    const channel = createEpisodeChannel(input, output, "attempt", "parent", () => receipt);
    input.write(encodeEpisodeMessage(frames.ready).toString() + "\n"); receipt += 300000000000n;
    input.write(encodeEpisodeMessage(frames.begin).toString() + "\n");
    const result = await superviseEpisodeChannel(parent, channel, async () => undefined, 0n, () => 5n);
    expect(result).toMatchObject({ reason: "match-timeout", classification: "infrastructure", reward: null });
  });
  it("waits for process reaping before returning partial diagnostics", async () => {
    const startup = context(), frames = childFrames(startup), parent = createEpisodeReplica(startup, "parent");
    const input = new PassThrough(), output = new PassThrough(), channel = createEpisodeChannel(input, output, "attempt", "parent");
    let release!: () => void, returned = false;
    const reaped = new Promise<void>(resolve => { release = resolve; });
    const run = superviseEpisodeChannel(parent, channel, () => reaped, process.hrtime.bigint()).then(result => { returned = true; return result; });
    input.write(frames.bytes); await new Promise(resolve => setImmediate(resolve));
    expect(returned).toBe(false); release(); expect((await run).reason).toBe("source");
  });
  it("uses a real child pipe and kills a hanging descendant process group", async () => {
    const startup = context(), frames = childFrames(startup), parent = createEpisodeReplica(startup, "parent");
    const cache = "/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode";
    const directory = mkdtempSync(join(cache, "episode-fixture-")), script = join(directory, "child.cjs"), pidFile = join(directory, "descendant.pid");
    writeFileSync(join(directory, "frames"), frames.bytes);
    writeFileSync(script, `const {spawn}=require('node:child_process');const fs=require('node:fs');const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'inherit'});fs.writeFileSync(${JSON.stringify(pidFile)},String(c.pid));process.stdout.write(fs.readFileSync(${JSON.stringify(join(directory, "frames"))}));setInterval(()=>{},1000);`);
    const child = launchEpisodeProcess({ executable: process.execPath, arguments: [script], directory, environment: {} });
    const channel = createEpisodeChannel(child.input, child.output, "attempt", "parent");
    const result = await superviseEpisodeChannel(parent, channel, child.terminateAndReap, process.hrtime.bigint());
    expect(result.reason).toBe("source");
    const descendant = Number(readFileSync(pidFile, "utf8"));
    let alive = false;
    try { process.kill(descendant, 0); alive = true; } catch { }
    if (alive) expect(readFileSync(`/proc/${descendant}/stat`, "utf8").split(" ")[2]).toBe("Z");
    await child.terminateAndReap();
  });
});
