// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml, _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml
import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import type { Readable, Writable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";
import type { EpisodeMessage, StopReason } from "./episodeContracts";
import { createEpisodeChannel, EPISODE_LIMITS, rawFrameReceipt, type EpisodeChannel, type RawEpisodeFrame } from "./episodeProtocol";
import {
  acceptVerifiedDecision, acknowledgeParentPermitWrite, beginParentDecisionVerification, checkPlanningStartupBindings,
  checkReplicaMatchDeadline, createEpisodeReplica, EpisodeVerificationError, expectedBeginMessage, expectedReadyMessage,
  expectedSettlementMessage, issueParentPlanPermit, prepareNextNativeWindow, reconstructCandidateDecision, reconstructStrategicDecision,
  replicaDeadlines, replicaRequest, replicaStage, requireTrustedExecutionContext, stopSupervisedReplica, verifyCompleteMessage,
  verifyNativeMessage, verifyReadyReceipt, type EpisodeReplica, type TrustedExecutionContext, type VerifiedEpisodeOutcome,
} from "./episodeVerification";

const now = process.hrtime.bigint.bind(process.hrtime);
export type EpisodeProcess = Readonly<{
  input: Readable; output: Writable; terminateAndReap(): Promise<void>;
}>;
export type EpisodeWorkerLaunch = Readonly<{ executable: string; arguments: readonly string[]; directory: string; environment: Readonly<NodeJS.ProcessEnv> }>;
export const launchEpisodeProcess = (launch: EpisodeWorkerLaunch): EpisodeProcess => {
  const options: SpawnOptions = { cwd: launch.directory, env: launch.environment, detached: true, stdio: ["pipe", "pipe", "pipe"] };
  const child: ChildProcess = spawn(launch.executable, [...launch.arguments], options);
  if (!child.stdin || !child.stdout || !child.stderr) throw new EpisodeVerificationError("protocol");
  const closed = new Promise<void>((resolve, reject) => {
    child.once("close", () => resolve()); child.once("error", reject);
  });
  void closed.catch(() => undefined);
  let stderrBytes = 0;
  const kill = (): void => {
    if (child.pid === undefined) return;
    try { process.kill(-child.pid, "SIGKILL"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
  };
  child.stderr.on("data", (bytes: Buffer) => {
    stderrBytes += bytes.length;
    if (stderrBytes > EPISODE_LIMITS.maxProgressBytes) kill();
  });
  let reaping: Promise<void> | null = null;
  return Object.freeze({ input: child.stdout, output: child.stdin,
    terminateAndReap(): Promise<void> {
      if (!reaping) reaping = (async () => { kill(); await closed; })();
      return reaping;
    },
  });
};
const receiveBefore = async (channel: EpisodeChannel, deadline: bigint, reason: StopReason,
  clock: () => bigint): Promise<RawEpisodeFrame> => {
  const receive = channel.receive();
  while (true) {
    const remaining = deadline - clock();
    const wake = new AbortController();
    try {
      const result = await Promise.race([
        receive.then(frame => ({ frame })),
        delay(Math.max(0, Number(remaining / 1000000n)), null, { signal: wake.signal }).then(() => ({ frame: null })),
      ]);
      if (result.frame) {
        if (rawFrameReceipt(result.frame) >= deadline) throw new EpisodeVerificationError(reason);
        return result.frame;
      }
      if (clock() >= deadline) throw new EpisodeVerificationError(reason);
    } catch (error) {
      if (clock() >= deadline) throw new EpisodeVerificationError(reason);
      throw error;
    } finally { wake.abort(); }
  }
};
const deadlineFor = (replica: EpisodeReplica): Readonly<{ deadline: bigint; reason: StopReason }> => {
  const deadlines = replicaDeadlines(replica);
  if (deadlines.match === null) throw new EpisodeVerificationError("protocol");
  if (deadlines.plan !== null && deadlines.plan < deadlines.match) return {
    deadline: deadlines.plan, reason: deadlines.role === "candidate" ? "candidate-deadline" : "opponent",
  };
  return { deadline: deadlines.match, reason: "match-timeout" };
};
const writeAcknowledgement = async (replica: EpisodeReplica, channel: EpisodeChannel, message: EpisodeMessage, clock: () => bigint): Promise<void> => {
  const deadline = deadlineFor(replica), writing = channel.write(message);
  const reason = deadline.reason === "match-timeout" ? "match-timeout" : "unattributed-timeout";
  while (true) {
    const wake = new AbortController();
    try {
      const result = await Promise.race([
        writing.then(() => true),
        delay(Math.max(0, Number((deadline.deadline - clock()) / 1000000n)), false, { signal: wake.signal }),
      ]);
      if (result) return;
      if (clock() >= deadline.deadline) throw new EpisodeVerificationError(reason);
    } finally { wake.abort(); }
  }
};
export const superviseEpisodeChannel = async (replica: EpisodeReplica, channel: EpisodeChannel,
  terminateAndReap: () => Promise<void>, launchedAt: bigint, clock: () => bigint = now): Promise<VerifiedEpisodeOutcome> => {
  let incoming = 0, outgoing = 0;
  let outcome: VerifiedEpisodeOutcome;
  const request = replicaRequest(replica);
  const common = <K extends EpisodeMessage["kind"]>(kind: K) => ({ version: "starchess-training-episode-v2" as const,
    attemptId: request.attemptId, messageOrdinal: outgoing++, kind });
  try {
    const rawReady = await receiveBefore(channel, launchedAt + 10000000000n, "startup-timeout", clock);
    const ready = channel.decode(rawReady, expectedReadyMessage(replica, incoming++));
    if (ready.kind !== "ready") throw new EpisodeVerificationError("protocol");
    verifyReadyReceipt(replica, ready, rawReady);
    checkReplicaMatchDeadline(replica, clock());
    while (true) {
      prepareNextNativeWindow(replica);
      const deadline = deadlineFor(replica);
      const raw = await receiveBefore(channel, deadline.deadline, deadline.reason, clock);
      let expected: EpisodeMessage | undefined;
      if (replicaStage(replica) === "begin") expected = expectedBeginMessage(replica, incoming);
      else if (replicaStage(replica) === "settlement") expected = expectedSettlementMessage(replica, incoming);
      const message = channel.decode(raw, expected); incoming++;
      checkReplicaMatchDeadline(replica, clock());
      if (message.kind === "turn-open-result") {
        verifyNativeMessage(replica, message);
        const nextPermit = await issueParentPlanPermit(replica, clock);
        checkReplicaMatchDeadline(replica, clock());
        const ack = Object.freeze({ ...common("turn-open-accepted"), planningOrdinal: message.planningOrdinal, nextPermit });
        await writeAcknowledgement(replica, channel, ack, clock); acknowledgeParentPermitWrite(replica, ack);
      } else if (message.kind === "decision-result") {
        beginParentDecisionVerification(replica, message, raw);
        if (message.role === "candidate") {
          const reconstructed = await reconstructCandidateDecision(replica);
          checkReplicaMatchDeadline(replica, clock());
          await checkPlanningStartupBindings(replica);
          acceptVerifiedDecision(replica, message, reconstructed.journalEntry, reconstructed.scoreDelta);
        } else {
          const reconstructed = reconstructStrategicDecision(replica);
          checkReplicaMatchDeadline(replica, clock());
          await checkPlanningStartupBindings(replica);
          acceptVerifiedDecision(replica, message, reconstructed, null);
        }
        const nextPermit = await issueParentPlanPermit(replica, clock);
        await checkPlanningStartupBindings(replica);
        const ack = Object.freeze({ ...common("decision-accepted"), decisionId: message.journalEntry.decisionId, nextPermit });
        await writeAcknowledgement(replica, channel, ack, clock); acknowledgeParentPermitWrite(replica, ack);
      } else if (message.kind === "settlement") {
        verifyNativeMessage(replica, message);
      } else if (message.kind === "complete") {
        outcome = verifyCompleteMessage(replica, message); break;
      } else throw new EpisodeVerificationError("protocol");
    }
  } catch (error) {
    const reason = error instanceof EpisodeVerificationError ? error.reason : "protocol";
    outcome = stopSupervisedReplica(replica, reason, clock());
  } finally {
    channel.close();
    await terminateAndReap();
  }
  return outcome!;
};

export const superviseEpisode = async (context: TrustedExecutionContext): Promise<VerifiedEpisodeOutcome> => {
  const execution = requireTrustedExecutionContext(context), replica = createEpisodeReplica(context, "parent");
  await checkPlanningStartupBindings(replica);
  const bootstrap = await import("./sourceBootstrap"), startup = await import("./startupScope");
  const seal = bootstrap.requireVerifiedSourceSeal(execution.sourceSeal);
  const models = startup.requireBoundModels(execution.boundModels, seal);
  const launch: EpisodeWorkerLaunch = startup.readBoundWorkerLaunch(models, seal);
  const startupBytes = startup.readBoundChildStartupBytes(models, seal, execution.request);
  bootstrap.requireVerifiedSourceSeal(seal);
  const launchedAt = now(), child = launchEpisodeProcess(launch);
  const channel = createEpisodeChannel(child.input, child.output, execution.request.attemptId, "parent");
  const running = superviseEpisodeChannel(replica, channel, child.terminateAndReap, launchedAt);
  const writing = new Promise<void>((resolve, reject) => child.output.write(startupBytes, error => error ? reject(error) : resolve()));
  void writing.catch(() => channel.close());
  try {
    const result = await running;
    await writing.catch(() => undefined);
    return result;
  } catch (error) { await child.terminateAndReap(); throw error; }
};
