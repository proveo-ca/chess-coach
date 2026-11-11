// SPEC: _spec/match-runtime.puml
import { z } from "zod";
import { decisionJournalShape, planPermitShape, streamStateShape } from "./episode";
import { nativeBoundaryShape } from "./native-protocol";
import { nativeIntentsShape } from "./native-intents";
import { attemptDescriptorShape, rngStateShape } from "./training-state";

export const MAX_MATCH_PROGRESS_BYTES = 1024 * 1024;
export const MAX_MATCH_COMPLETION_BYTES = 16 * 1024 * 1024;
const digest = z.string().regex(/^[a-f0-9]{64}$/), side = z.enum(["w", "b"]);
const ordinal = z.int().min(0).max(63), cursor = z.int().min(0).max(91);
const header = { version: z.literal("chess-coach.match.v1"), attemptId: z.string().regex(/^[A-Za-z0-9._:-]{1,32}$/), ordinal: z.int().min(0).max(1023) };
export const matchBoundaryShape = z.strictObject({ boundary: nativeBoundaryShape, provenanceDigest: digest, journalDigest: digest.nullable() });
export const opponentJournalShape = z.strictObject({ version: z.literal("chess-coach.opponent.v1"), attemptId: header.attemptId,
  permitId: z.string().min(1).max(64), planningOrdinal: ordinal, side, snapshotDigest: digest, actions: nativeIntentsShape,
  reportedMinSpend: z.int().min(0).max(12), opponentBefore: streamStateShape, opponentAfter: streamStateShape });
export const matchStopShape = z.discriminatedUnion("reason", [
  z.strictObject({ reason: z.literal("core-terminal"), returnValue: z.union([z.literal(-1), z.literal(0), z.literal(1)]) }),
  z.strictObject({ reason: z.enum(["trace-exhaustion", "progress-cap"]), returnValue: z.literal(-1) }),
  z.strictObject({ reason: z.enum(["candidate-native-rejection", "recorded-white-rejection"]), returnValue: z.literal(-1), side,
    actionOrdinal: z.int().min(0).max(64), code: z.enum(["MINERALS", "SC_PHASE", "SC_QUEUE_SHAPE", "SC_GAS", "SC_BASELINE_FEN", "SC_SPECIAL"]) }),
]);
export const matchRequestShape = z.discriminatedUnion("operation", [
  z.strictObject({ ...header, operation: z.literal("start"), descriptor: attemptDescriptorShape, rng: rngStateShape }),
  z.strictObject({ ...header, operation: z.literal("accept"), replyDigest: digest, nextPermit: planPermitShape.nullable() }),
  z.strictObject({ ...header, operation: z.literal("close"), replyDigest: digest }),
]);
export const matchReplyShape = z.discriminatedUnion("kind", [
  z.strictObject({ ...header, kind: z.literal("ready"), state: matchBoundaryShape }),
  z.strictObject({ ...header, kind: z.literal("opened"), planningOrdinal: ordinal, state: matchBoundaryShape }),
  z.strictObject({ ...header, kind: z.literal("candidate"), journal: decisionJournalShape }),
  z.strictObject({ ...header, kind: z.literal("strategic"), journal: opponentJournalShape }),
  z.strictObject({ ...header, kind: z.literal("settled"), planningOrdinal: ordinal, state: matchBoundaryShape }),
  z.strictObject({ ...header, kind: z.literal("rejected"), stop: matchStopShape }),
  z.strictObject({ ...header, kind: z.literal("complete"), stop: matchStopShape, boundaryOrdinal: cursor, planningWindows: z.int().min(0).max(64),
    recordedPlies: z.int().min(0).max(128), candidateIds: z.array(z.string().min(1).max(64)).max(64), opponentIds: z.array(z.string().min(1).max(64)).max(64),
    recordedCount: z.int().min(0).max(64), recordedDigest: digest, rng: rngStateShape }),
  z.strictObject({ ...header, kind: z.literal("closed") }),
]);
export type MatchRequest = z.infer<typeof matchRequestShape>;
export type MatchReply = z.infer<typeof matchReplyShape>;
export type MatchBoundary = z.infer<typeof matchBoundaryShape>;
export type MatchStop = z.infer<typeof matchStopShape>;
export type OpponentJournal = z.infer<typeof opponentJournalShape>;
function parse(json: string, limit: number): unknown {
  if (json.length > limit || new TextEncoder().encode(json).byteLength > limit) throw new RangeError("Match frame exceeds byte limit");
  return JSON.parse(json);
}
export const decodeMatchRequest = (json: string): MatchRequest => matchRequestShape.parse(parse(json, MAX_MATCH_PROGRESS_BYTES));
export function decodeMatchReply(json: string): MatchReply {
  const value = matchReplyShape.parse(parse(json, MAX_MATCH_COMPLETION_BYTES));
  if (value.kind !== "complete" && Buffer.byteLength(json) > MAX_MATCH_PROGRESS_BYTES) throw new RangeError("Match progress exceeds byte limit");
  return value;
}
export const matchJsonSchema = z.toJSONSchema(matchReplyShape, { target: "draft-2020-12", reused: "ref" });
