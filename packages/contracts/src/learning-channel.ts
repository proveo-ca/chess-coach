// SPEC: _spec/learning-runtime.puml
import { z } from "zod";
import { MAX_INFERENCE_BYTES, scoreRequestShape, scoreResponseShape } from "./inference";
import layout from "../../../schemas/feature-layout.json";

const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const modelConfigShape = z.strictObject({ version: z.literal("chess-coach.model-config.v1"), architecture: z.literal("mlp-relu-32"),
  featureVersion: z.literal(layout.version), inputFeatures: z.literal(layout.dimension), hiddenUnits: z.literal(32), recordSha256: digest });
const header = { version: z.literal("chess-coach.learning-channel.v1"), sessionId: z.string().regex(/^[A-Za-z0-9._:-]{1,64}$/),
  ordinal: z.int().min(0).max(255), modelId: digest };
const command = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("begin"), baseline: z.number().min(-1).max(1) }),
  z.strictObject({ kind: z.literal("score"), request: scoreRequestShape }),
  z.strictObject({ kind: z.literal("acknowledge"), request: scoreRequestShape, selected: z.int().min(0).max(511), journalDigest: digest }),
  z.strictObject({ kind: z.literal("finish"), returnValue: z.union([z.literal(-1), z.literal(0), z.literal(1)]) }),
  z.strictObject({ kind: z.literal("close") }),
]);
const result = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("begun") }),
  z.strictObject({ kind: z.literal("scored"), response: scoreResponseShape }),
  z.strictObject({ kind: z.literal("acknowledged"), journalDigest: digest, sampledDecisions: z.int().min(1).max(64) }),
  z.strictObject({ kind: z.literal("diagnostic") }),
  z.strictObject({ kind: z.literal("proposed"), record: z.array(z.int().min(0).max(255)).min(1).max(1024 * 1024), config: modelConfigShape,
    sampledDecisions: z.int().min(1).max(64), objective: z.number(), nonzeroPolicyGradient: z.boolean(), parameterSha256: digest }),
  z.strictObject({ kind: z.literal("closed") }),
]);
export const learningRequestShape = z.strictObject({ ...header, command });
export const learningReplyShape = z.strictObject({ ...header, result });
export type LearningRequest = z.infer<typeof learningRequestShape>;
export type LearningReply = z.infer<typeof learningReplyShape>;
export function decodeLearningReply(json: string): LearningReply {
  if (json.length > MAX_INFERENCE_BYTES || new TextEncoder().encode(json).byteLength > MAX_INFERENCE_BYTES) throw new RangeError("Learning reply exceeds byte limit");
  return learningReplyShape.parse(JSON.parse(json));
}
