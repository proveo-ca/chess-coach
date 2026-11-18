// SPEC: _spec/runtime-protocol.puml
import { z } from "zod";
import { nativeIntentsShape } from "./native-intents";
import { recipientBatchShape, decodeRecipientBatch } from "./recipient-codec";
import { nativeKernelShape, nativeSnapshotShape } from "./resolution";

export const MAX_NATIVE_MESSAGE_BYTES = 16 * 1024 * 1024;
const sessionId = z.string().min(1).max(64).regex(/^[A-Za-z0-9._:-]+$/);
const ordinal = z.int().min(0).max(2047), cursor = z.int().min(-1).max(91), digest = z.string().regex(/^[0-9a-f]{64}$/);
const header = { version: z.literal("chess-coach.native.v1"), sessionId, ordinal, cursor };
const actions = nativeIntentsShape;
export const nativeBoundaryShape = z.strictObject({ kind: z.enum(["initial", "opened", "settled"]), snapshot: nativeSnapshotShape,
  bank: z.strictObject({ w: z.int().min(0).max(12), b: z.int().min(0).max(12) }),
  batches: z.strictObject({ w: recipientBatchShape, b: recipientBatchShape }), kernel: nativeKernelShape });
export const nativeRequestShape = z.discriminatedUnion("operation", [
  z.strictObject({ ...header, operation: z.literal("init") }),
  z.strictObject({ ...header, operation: z.literal("open") }),
  z.strictObject({ ...header, operation: z.literal("settle"), plans: z.strictObject({ w: actions, b: actions }) }),
  z.strictObject({ ...header, operation: z.literal("commit"), stagedCursor: z.int().min(0).max(91), digest }),
  z.strictObject({ ...header, operation: z.literal("close") }),
]);
export const nativeReplyShape = z.discriminatedUnion("kind", [
  z.strictObject({ ...header, role: z.enum(["main", "reference"]), kind: z.literal("staged"), stagedCursor: z.int().min(0).max(91), boundary: nativeBoundaryShape }),
  z.strictObject({ ...header, role: z.enum(["main", "reference"]), kind: z.literal("committed"), digest }),
  z.strictObject({ ...header, role: z.enum(["main", "reference"]), kind: z.literal("closed") }),
]);
export type NativeRequest = z.infer<typeof nativeRequestShape>;
export type NativeReply = z.infer<typeof nativeReplyShape>;
export type NativeBoundary = z.infer<typeof nativeBoundaryShape>;
export type NativeRole = NativeReply["role"];
export type NativeMode = "native-proof" | "policy";

function parse(json: string): unknown {
  if (json.length > MAX_NATIVE_MESSAGE_BYTES || new TextEncoder().encode(json).byteLength > MAX_NATIVE_MESSAGE_BYTES) throw new RangeError("Native message exceeds byte limit");
  return JSON.parse(json);
}
export const decodeNativeRequest = (json: string): NativeRequest => nativeRequestShape.parse(parse(json));
export function checkNativeBoundary(boundary: NativeBoundary): void {
  const w = decodeRecipientBatch(JSON.stringify(boundary.batches.w)), b = decodeRecipientBatch(JSON.stringify(boundary.batches.b));
  if (w.side !== "w" || b.side !== "b" || w.ordinal !== b.ordinal || w.phase !== boundary.kind || b.phase !== boundary.kind ||
    w.planningOrdinal !== b.planningOrdinal || w.observation.turn !== boundary.snapshot.turn || b.observation.turn !== boundary.snapshot.turn ||
    w.observation.own.minerals !== boundary.bank.w || b.observation.own.minerals !== boundary.bank.b ||
    w.observation.own.ccLives !== boundary.snapshot.ccLives.w || b.observation.own.ccLives !== boundary.snapshot.ccLives.b ||
    boundary.kernel.kind !== boundary.kind) throw new Error("Native boundary pair mismatch");
}
export function decodeNativeReply(json: string): NativeReply {
  const reply = nativeReplyShape.parse(parse(json));
  if (reply.kind === "staged") checkNativeBoundary(reply.boundary);
  return reply;
}
export function encodeNativeRequest(value: NativeRequest): string { const json = JSON.stringify(value); decodeNativeRequest(json); return json; }
export function encodeNativeReply(value: NativeReply): string { const json = JSON.stringify(value); decodeNativeReply(json); return json; }
export const nativeProtocolJsonSchema = z.toJSONSchema(nativeReplyShape, { target: "draft-2020-12", reused: "ref" });
