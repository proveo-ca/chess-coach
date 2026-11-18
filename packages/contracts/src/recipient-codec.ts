// SPEC: _spec/recipient-production.puml
import { z } from "zod";
import { observationShape } from "./shape";
import { decodeObservation } from "./index";
import type { RecipientBatch } from "./recipient";

export const MAX_RECIPIENT_BATCH_BYTES = 16 * 1024 * 1024;
const observation = observationShape.unwrap();
const unit = observation.shape.ownUnitLineage.unwrap().element;
const mine = observation.shape.ownMineLineage.unwrap().element;
const receipt = observation.shape.economy.unwrap().shape.receipts.unwrap().element;
const cell = observation.shape.cells.unwrap().element;
const id = unit.unwrap().shape.id;
const square = unit.unwrap().shape.square;
const type = unit.unwrap().shape.type;
const sequence = z.int().min(1).max(372736);
const event = z.discriminatedUnion("kind", [
  z.strictObject({ sequence, kind: z.literal("vision"), turn: z.int().min(0).max(45), changes: z.array(cell).min(1).max(64) }),
  z.strictObject({ sequence, kind: z.literal("own-unit-created"), unit }),
  z.strictObject({ sequence, kind: z.literal("own-unit-moved"), id, from: square, to: square }),
  z.strictObject({ sequence, kind: z.literal("own-unit-transformed"), id, fromType: type, toType: type }),
  z.strictObject({ sequence, kind: z.literal("own-unit-destroyed"), id, square, type, paidBasis: z.int().min(0).max(9), replacementValue: z.int().min(1).max(9) }),
  z.strictObject({ sequence, kind: z.literal("own-tank-mode"), id, mode: z.enum(["tank", "siege"]) }),
  z.strictObject({ sequence, kind: z.literal("own-mine-created"), mine }),
  z.strictObject({ sequence, kind: z.literal("own-mine-removed"), mineId: mine.unwrap().shape.mineId, square }),
  z.strictObject({ sequence, kind: z.literal("enemy-unit-destruction-witnessed"), witnessId: z.templateLiteral([z.enum(["w", "b"]), ":witness:", z.int().min(1).max(128)]),
    square, type, replacementLowerBound: z.int().min(1).max(9), paidLowerBound: z.literal(0) }),
  z.strictObject({ sequence, kind: z.literal("paid-receipt"), receipt }),
]);
export const recipientBatchShape = z.strictObject({ version: z.literal("chess-coach.recipient-batch.v1"), side: z.enum(["w", "b"]),
  ordinal: z.int().min(0).max(91), phase: z.enum(["initial", "opened", "settled"]), planningOrdinal: z.int().min(0).max(64),
  events: z.array(event).max(4096), observation: observationShape });

export function decodeRecipientBatch(json: string): RecipientBatch {
  if (json.length > MAX_RECIPIENT_BATCH_BYTES || new TextEncoder().encode(json).byteLength > MAX_RECIPIENT_BATCH_BYTES) throw new RangeError("Recipient batch exceeds byte limit");
  const value = recipientBatchShape.parse(JSON.parse(json));
  decodeObservation(JSON.stringify(value.observation));
  if (value.side !== value.observation.side || value.phase === "initial" && (value.ordinal !== 0 || value.events.length !== 0 || value.planningOrdinal !== 0)) throw new Error("Recipient batch boundary mismatch");
  for (const [index, event] of value.events.entries()) {
    if (index && event.sequence !== value.events[index - 1]!.sequence + 1) throw new Error("Recipient event sequence mismatch");
    const local = event.kind === "own-unit-created" ? event.unit.id : event.kind === "own-mine-created" ? event.mine.mineId
      : event.kind === "own-mine-removed" ? event.mineId : event.kind === "enemy-unit-destruction-witnessed" ? event.witnessId
        : event.kind === "paid-receipt" ? event.receipt.receiptId : "id" in event ? event.id : null;
    if (local !== null && !local.startsWith(`${value.side}:`)) throw new Error("Recipient event side mismatch");
    if (event.kind === "vision" && (event.turn > value.observation.turn || event.changes.some((cell, index) => index > 0 && event.changes[index - 1]!.square >= cell.square))) throw new Error("Recipient vision ordering mismatch");
  }
  return value;
}
export function encodeRecipientBatch(value: RecipientBatch): string {
  const json = JSON.stringify(value);
  decodeRecipientBatch(json);
  return json;
}
export const recipientBatchJsonSchema = z.toJSONSchema(recipientBatchShape, { target: "draft-2020-12", reused: "ref" });
