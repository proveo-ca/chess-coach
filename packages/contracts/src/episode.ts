// SPEC: _spec/policy-runtime.puml, _spec/learning-runtime.puml
import { z } from "zod";
import { candidateShape } from "./candidate";
import layout from "../../../schemas/feature-layout.json";

const uint32 = z.int().min(0).max(4294967295), safeCount = z.int().min(0).max(Number.MAX_SAFE_INTEGER);
export const streamStateShape = z.strictObject({ status: z.enum(["active", "unused"]), root: uint32, state: uint32, drawCount: safeCount })
  .refine(value => value.state === Number((BigInt(value.root) + BigInt(value.drawCount) * 0x6d2b79f5n) & 0xffffffffn) &&
    (value.status === "active" || value.drawCount === 0), { message: "Stream prefix mismatch" });
export type StreamState = z.infer<typeof streamStateShape>;
const id = z.string().regex(/^[A-Za-z0-9._:-]{1,32}$/), digest = z.string().regex(/^[0-9a-f]{64}$/), ns = z.string().regex(/^(0|[1-9][0-9]{0,24})$/);
export const planPermitShape = z.strictObject({ version: z.literal("chess-coach.plan-permit.v1"), attemptId: id,
  permitId: z.string().min(1).max(64), planningOrdinal: z.int().min(0).max(63), turn: z.int().min(0).max(44), side: z.enum(["w", "b"]),
  role: z.enum(["candidate", "strategic"]), issuedNs: ns, deadlineNs: ns });
export type PlanPermit = z.infer<typeof planPermitShape>;
export const decisionJournalShape = z.strictObject({ version: z.literal("chess-coach.decision.v1"), attemptId: id, permitId: z.string().min(1).max(64),
  planningOrdinal: z.int().min(0).max(63), side: z.enum(["w", "b"]), modelId: digest, historyDigest: digest,
  featureVersion: z.literal(layout.version), enumerationVersion: z.literal("chess-coach.enumeration.v1"), orderedCandidateDigest: digest,
  mode: z.enum(["sample", "argmax"]), selectedIndex: z.int().min(0).max(511), selectedKey: z.string().min(2).max(4096),
  actions: candidateShape.unwrap().shape.actions, requestedSpend: z.strictObject({ minerals: z.int().min(0).max(12), gas: z.int().min(0).max(3) }),
  uniform: z.number().min(0).lt(1).nullable(), selectedLogProbability: z.number().max(0), samplingBefore: streamStateShape, samplingAfter: streamStateShape });
export type DecisionJournal = z.infer<typeof decisionJournalShape>;
export const MAX_DECISION_BYTES = 1024 * 1024;
export function decodeDecisionJournal(json: string): DecisionJournal {
  if (json.length > MAX_DECISION_BYTES || new TextEncoder().encode(json).byteLength > MAX_DECISION_BYTES) throw new RangeError("Decision journal exceeds byte limit");
  return decisionJournalShape.parse(JSON.parse(json));
}
export const decisionJournalJsonSchema = z.toJSONSchema(decisionJournalShape, { target: "draft-2020-12", reused: "ref" });
