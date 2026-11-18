// SPEC: _spec/gpu-owner.md, _spec/gpu-owner.puml
import { createHash } from "node:crypto";
import { z } from "zod";
import { modelConfigShape } from "./learning-channel";
import { attemptDescriptorShape, bindingsShape, byteRefShape, trainingStateShape } from "./training-state";
import type { TrainingState } from "./training-state";

export const GPU_JOB_VERSION = "chess-coach.gpu-job.v1" as const;
export const MAX_GPU_JOB_FRAME_BYTES = 1048576;
export const MAX_GPU_JOB_OUTPUT_BYTES = 3 * (MAX_GPU_JOB_FRAME_BYTES + 1);
export const MAX_GPU_ATTEMPT_INPUT_BYTES = 65536;
const digest = z.string().regex(/^[a-f0-9]{64}$/), session = z.string().regex(/^[A-Za-z0-9._:-]{1,64}$/);
const attempt = z.string().regex(/^[A-Za-z0-9._:-]{1,32}$/);
const elapsed = z.string().regex(/^(0|[1-9][0-9]{0,18})$/).refine(value => BigInt(value) <= 9223372036854775807n);
const boundedString = (max: number) => z.string().max(max).refine(value => Buffer.byteLength(value) <= max);
export const gpuJobStartShape = z.strictObject({ version: z.literal(GPU_JOB_VERSION), sessionId: session, operation: z.literal("run-attempt"),
  attemptId: attempt, inputJson: boundedString(MAX_GPU_ATTEMPT_INPUT_BYTES), inputSha256: digest, ownerElapsedNs: elapsed });
export const gpuJobReplyShape = z.discriminatedUnion("kind", [
  z.strictObject({ version: z.literal(GPU_JOB_VERSION), sessionId: session, kind: z.literal("boot") }),
  z.strictObject({ version: z.literal(GPU_JOB_VERSION), sessionId: session, kind: z.literal("startup"), attemptId: attempt,
    inputSha256: digest, descriptorSha256: digest, initialModelId: digest }),
  z.strictObject({ version: z.literal(GPU_JOB_VERSION), sessionId: session, kind: z.literal("attempt-proposal"), attemptId: attempt,
    inputSha256: digest, descriptorSha256: digest, proposalJson: boundedString(MAX_GPU_JOB_FRAME_BYTES), proposalSha256: digest }),
]);
export const gpuAttemptInputShape = z.strictObject({ version: z.literal("chess-coach.gpu-attempt-input.v1"), bindings: bindingsShape,
  modelConfig: modelConfigShape, recordRef: byteRefShape.extend({ byteLength: z.int().min(1).max(1048576) }),
  initialStateSha256: digest, expectedDescriptorSha256: digest, initialModelId: digest }).refine(value =>
    value.modelConfig.recordSha256 === value.recordRef.sha256 && value.initialModelId === value.recordRef.sha256, { message: "GPU input model binding" });
export type GpuJobStart = z.infer<typeof gpuJobStartShape>;
export type GpuJobReply = z.infer<typeof gpuJobReplyShape>;
export type GpuAttemptInput = z.infer<typeof gpuAttemptInputShape>;
export const gpuJobSha256 = (bytes: string | Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

function closedDocument(json: string, maxBytes: number): { value: unknown; tokens: Map<string, string> } {
  if (json.length > maxBytes || Buffer.byteLength(json) > maxBytes || Buffer.from(json).toString("utf8") !== json) throw new Error("GPU JSON: BYTE_BOUND_OR_UTF8");
  let at = 0, nodes = 0;
  const tokens = new Map<string, string>();
  const fail = (): never => { throw new Error("GPU JSON: CLOSED_JSON"); };
  const space = () => { while (at < json.length && " \t\r\n".includes(json[at]!)) at++; };
  const string = (): string => {
    const start = at++;
    while (at < json.length) {
      const char = json[at++]!;
      if (char === '"') return JSON.parse(json.slice(start, at)) as string;
      if (char === "\\") at++;
    }
    return fail();
  };
  const value = (depth: number): void => {
    if (depth > 32 || ++nodes > 16384) fail();
    space();
    const char = json[at];
    if (char === "{") {
      at++; space();
      const keys = new Set<string>();
      if (json[at] === "}") { at++; return; }
      for (;;) {
        if (json[at] !== '"' || ++nodes > 16384) fail();
        const key = string();
        if (keys.has(key)) fail();
        keys.add(key); space();
        if (json[at++] !== ":") fail();
        space(); const start = at;
        value(depth + 1);
        if (depth === 0) tokens.set(key, json.slice(start, at));
        space(); const end = json[at++];
        if (end === "}") return;
        if (end !== ",") fail();
        space();
      }
    }
    if (char === "[") {
      at++; space();
      if (json[at] === "]") { at++; return; }
      for (;;) {
        value(depth + 1); space(); const end = json[at++];
        if (end === "]") return;
        if (end !== ",") fail();
      }
    }
    if (char === '"') { string(); return; }
    for (const literal of ["true", "false", "null"]) if (json.startsWith(literal, at)) { at += literal.length; return; }
    const start = at;
    while (at < json.length && "-+0123456789.eE".includes(json[at]!)) at++;
    if (at === start) fail();
    const number: unknown = JSON.parse(json.slice(start, at));
    if (typeof number !== "number" || !Number.isFinite(number) || Number.isInteger(number) && !Number.isSafeInteger(number)) fail();
  };
  value(0); space();
  if (at !== json.length) fail();
  return { value: JSON.parse(json) as unknown, tokens };
}
export function parseClosedJson(json: string, maxBytes = MAX_GPU_JOB_FRAME_BYTES): unknown { return closedDocument(json, maxBytes).value; }
export function decodeGpuJobStart(json: string): GpuJobStart { return gpuJobStartShape.parse(parseClosedJson(json)); }
export function decodeGpuJobReply(json: string): GpuJobReply { return gpuJobReplyShape.parse(parseClosedJson(json)); }
export function decodeGpuAttemptInput(json: string, expectedSha256?: string): GpuAttemptInput {
  const parsed = parseClosedJson(json, MAX_GPU_ATTEMPT_INPUT_BYTES);
  if (expectedSha256 !== undefined && gpuJobSha256(json) !== expectedSha256) throw new Error("GPU input: HASH");
  return gpuAttemptInputShape.parse(parsed);
}

export function checkGpuTrainingState(input: unknown): TrainingState {
  return trainingStateShape.parse(input);
}
export const gpuAttemptProposalShape = z.strictObject({ version: z.literal("chess-coach.gpu-attempt-proposal.v1"), descriptor: attemptDescriptorShape,
  initialModelId: digest, state: trainingStateShape }).superRefine((value, context) => {
    const { descriptor: d, state: s } = value;
    if (d.master !== 101 || d.startedOrdinal !== 0 || d.attemptId.length > 32 || d.modelId !== value.initialModelId ||
      s.master !== 101 || s.counters.started !== 1 || s.counters.verifiedCompleted !== 1) context.addIssue({ code: "custom", message: "GPU proposal binding" });
  });
export type GpuAttemptProposal = z.infer<typeof gpuAttemptProposalShape>;
export function decodeGpuAttemptProposal(json: string, expectedProposalSha256?: string, expectedDescriptorSha256?: string): GpuAttemptProposal {
  const parsed = closedDocument(json, MAX_GPU_JOB_FRAME_BYTES), token = parsed.tokens.get("descriptor");
  if (expectedProposalSha256 !== undefined && gpuJobSha256(json) !== expectedProposalSha256) throw new Error("GPU proposal: HASH");
  if (token === undefined || expectedDescriptorSha256 !== undefined && gpuJobSha256(token) !== expectedDescriptorSha256) throw new Error("GPU proposal: DESCRIPTOR_HASH");
  return gpuAttemptProposalShape.parse(parsed.value);
}
