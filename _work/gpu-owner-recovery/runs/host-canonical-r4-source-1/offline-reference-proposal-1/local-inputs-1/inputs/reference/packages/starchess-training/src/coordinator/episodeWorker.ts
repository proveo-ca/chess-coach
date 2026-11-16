// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml, _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml
import type { CompactSampleJournalEntry, DecisionResultMessage, EpisodeMessage, OppPrivateJournal } from "./episodeContracts";
import type { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { createEpisodeChannel, type EpisodeChannel, type RawEpisodeFrame } from "./episodeProtocol";
import {
  acceptChildPlanPermit, acceptVerifiedDecision, authenticateAcceptedPermit, checkPlanningStartupBindings, createEpisodeReplica, EpisodeVerificationError,
  expectedBeginMessage, expectedCompleteMessage, expectedReadyMessage, expectedSettlementMessage, prepareChildPlanning, prepareNextNativeWindow,
  markChildDecisionSent, reconstructCandidateDecision, reconstructStrategicDecision, replicaRequest, replicaStage, requireTrustedExecutionContext, startChildReplica, verifyNativeMessage,
  type EpisodeReplica, type TrustedExecutionContext,
} from "./episodeVerification";

const now = process.hrtime.bigint.bind(process.hrtime);
const sameId = (left: { planningOrdinal: number; side: string }, right: { planningOrdinal: number; side: string }): boolean =>
  left.planningOrdinal === right.planningOrdinal && left.side === right.side;
const checkedAck = async (channel: EpisodeChannel, kind: "turn-open-accepted" | "decision-accepted"): Promise<Readonly<{
  frame: RawEpisodeFrame; message: Extract<EpisodeMessage, { kind: "turn-open-accepted" | "decision-accepted" }>;
}>> => {
  const frame = await channel.receive(), message = channel.decode(frame);
  if (message.kind !== kind) throw new EpisodeVerificationError("protocol");
  return { frame, message: message as Extract<EpisodeMessage, { kind: "turn-open-accepted" | "decision-accepted" }> };
};
export const runEpisodeWorker = async (context: TrustedExecutionContext, channel: EpisodeChannel): Promise<void> => {
  const replica: EpisodeReplica = createEpisodeReplica(context, "child"), request = replicaRequest(replica);
  let outgoing = 0;
  const common = <K extends EpisodeMessage["kind"]>(kind: K) => ({ version: "starchess-training-episode-v2" as const,
    attemptId: request.attemptId, messageOrdinal: outgoing++, kind });
  const ready = expectedReadyMessage(replica, outgoing++);
  await channel.write(ready);
  startChildReplica(replica, ready, now() + 300000000000n);
  while (true) {
    prepareNextNativeWindow(replica);
    if (replicaStage(replica) === "complete") { await channel.write(expectedCompleteMessage(replica, outgoing++)); return; }
    const begin = expectedBeginMessage(replica, outgoing++);
    await channel.write(begin); verifyNativeMessage(replica, begin);
    if (replicaStage(replica) === "planning") await prepareChildPlanning(replica);
    const opened = await checkedAck(channel, "turn-open-accepted");
    if (opened.message.kind !== "turn-open-accepted" || opened.message.planningOrdinal !== begin.planningOrdinal) throw new EpisodeVerificationError("permit");
    let acceptedPermit = acceptChildPlanPermit(replica, opened.frame);
    while (acceptedPermit !== null) {
      await checkPlanningStartupBindings(replica);
      let reconstructed: CompactSampleJournalEntry | OppPrivateJournal, delta: readonly number[] | null;
      let result: DecisionResultMessage;
      if (authenticateAcceptedPermit(acceptedPermit).permit.role === "candidate") {
        const decision = await reconstructCandidateDecision(replica); reconstructed = decision.journalEntry; delta = decision.scoreDelta;
        result = Object.freeze({ ...common("decision-result"), role: "candidate", journalEntry: decision.journalEntry });
      } else {
        reconstructed = reconstructStrategicDecision(replica); delta = null;
        result = Object.freeze({ ...common("decision-result"), role: "strategic", journalEntry: reconstructed });
      }
      markChildDecisionSent(replica, result); await channel.write(result);
      const ack = await checkedAck(channel, "decision-accepted");
      if (ack.message.kind !== "decision-accepted" || !sameId(ack.message.decisionId, result.journalEntry.decisionId)) throw new EpisodeVerificationError("permit");
      await checkPlanningStartupBindings(replica);
      acceptVerifiedDecision(replica, result, reconstructed, delta);
      acceptedPermit = acceptChildPlanPermit(replica, ack.frame);
    }
    if (replicaStage(replica) === "complete") { await channel.write(expectedCompleteMessage(replica, outgoing++)); return; }
    if (replicaStage(replica) !== "settlement") throw new EpisodeVerificationError("permit");
    const settlement = expectedSettlementMessage(replica, outgoing++);
    await channel.write(settlement); verifyNativeMessage(replica, settlement);
  }
};
export const startEpisodeWorker = async (): Promise<void> => {
  const startup = await import("./startupScope");
  const bound: ChildEpisodeStartup = await startup.loadChildEpisodeStartup(process.stdin);
  const request = requireTrustedExecutionContext(bound.context).request;
  const channel = createEpisodeChannel(bound.input, process.stdout, request.attemptId, "child");
  try { await runEpisodeWorker(bound.context, channel); }
  finally { channel.close(); }
};
export type ChildEpisodeStartup = Readonly<{ context: TrustedExecutionContext; input: Readable }>;
if (process.argv[1] === fileURLToPath(import.meta.url)) await startEpisodeWorker();
