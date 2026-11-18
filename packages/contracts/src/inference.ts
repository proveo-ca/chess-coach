// SPEC: _spec/policy-io.puml
import { z } from "zod";
import layout from "../../../schemas/feature-layout.json";

export const MAX_INFERENCE_BYTES = 8 * 1024 * 1024;
const version = z.literal("chess-coach.inference.v1");
const featureVersion = z.literal(layout.version);
const requestId = z.string().regex(/^[A-Za-z0-9._:-]{1,64}$/);
const modelId = z.string().regex(/^[a-f0-9]{64}$/);
const request = z.strictObject({
  version, featureVersion, requestId, modelId,
  rows: z.int().min(1).max(512),
  values: z.array(z.number().min(-1_000_000).max(1_000_000)).min(layout.dimension).max(512 * layout.dimension).readonly(),
}).readonly().refine(value => value.values.length === value.rows * layout.dimension, { message: "Feature dimension mismatch" });
const response = z.strictObject({ version, featureVersion, requestId, modelId, logits: z.array(z.number()).min(1).max(512).readonly() }).readonly();
export { request as scoreRequestShape, response as scoreResponseShape };

export type ScoreRequest = z.infer<typeof request>;
export type ScoreResponse = z.infer<typeof response>;

export function encodeScoreRequest(value: ScoreRequest): string {
  const checked = request.parse(value);
  const json = JSON.stringify(checked);
  if (new TextEncoder().encode(json).byteLength > MAX_INFERENCE_BYTES) throw new RangeError("Inference message exceeds byte limit");
  return json;
}

export function decodeScoreResponse(json: string, expected: ScoreRequest): ScoreResponse {
  if (json.length > MAX_INFERENCE_BYTES || new TextEncoder().encode(json).byteLength > MAX_INFERENCE_BYTES) throw new RangeError("Inference response exceeds byte limit");
  const checkedRequest = request.parse(expected);
  const result = response.parse(JSON.parse(json));
  if (result.requestId !== checkedRequest.requestId || result.modelId !== checkedRequest.modelId || result.logits.length !== checkedRequest.rows) {
    throw new Error("Inference response does not match request");
  }
  return result;
}
