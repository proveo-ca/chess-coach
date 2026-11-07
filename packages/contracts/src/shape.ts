// SPEC: _spec/observations.puml
import { z } from "zod";

const side = z.enum(["w", "b"]);
const unit = z.enum(["p", "n", "b", "r", "q", "k"]);
const spawn = z.enum(["p", "n", "b", "r", "q"]);
const square = z.templateLiteral([
  z.enum(["a", "b", "c", "d", "e", "f", "g", "h"]),
  z.enum(["1", "2", "3", "4", "5", "6", "7", "8"]),
]);
const unitId = z.string().max(64).regex(/^[wb]:unit:(opening:[a-h][1-8]|created:[1-9][0-9]*)$/);
const mineId = z.string().max(64).regex(/^[wb]:mine:(opening:[a-h][1-8]|created:[1-9][0-9]*)$/);
const piece = z.strictObject({ type: unit, color: side }).readonly();
const cell = z.discriminatedUnion("visibility", [
  z.strictObject({ square, visibility: z.literal("unknown") }),
  z.strictObject({ square, visibility: z.literal("lit"), piece: piece.nullable() }),
  z.strictObject({ square, visibility: z.literal("revealed"), piece }),
]).readonly();
const sighting = z.strictObject({ square, piece, observedTurn: z.int().min(0).max(45) }).readonly();
const lineage = z.strictObject({
  id: unitId, square, type: unit, paidBasis: z.int().min(0).max(9), replacementValue: z.int().min(0).max(9),
}).readonly();
const mineLineage = z.strictObject({ mineId, square }).readonly();
const receipt = z.strictObject({
  receiptId: z.string().max(64).regex(/^[wb]:receipt:(0|[1-9][0-9]*):(0|[1-9][0-9]*)$/),
  actionRef: z.strictObject({ planningOrdinal: z.int().min(0).max(63), acceptedActionOrdinal: z.int().min(0).max(3) }).readonly(),
  unit: spawn,
  requestedSquare: square,
  minerals: z.int().min(1).max(9),
  disposition: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("materialized"), lineageId: unitId }),
    z.strictObject({ kind: z.literal("unmaterialized") }),
  ]).readonly(),
}).readonly();

export const observationShape = z.strictObject({
  version: z.literal("chess-coach.observation.v1"),
  side,
  turn: z.int().min(0).max(45),
  own: z.strictObject({
    minerals: z.int().min(0).max(12),
    gas: z.int().min(0).max(3),
    gasIncome: z.int().min(0).max(3),
    ccLives: z.int().min(0).max(3),
    pieces: z.array(z.strictObject({ square, piece }).readonly()).min(1).max(64).readonly(),
    mines: z.array(square).max(3).readonly(),
    siegedTanks: z.array(square).max(64).readonly(),
  }).readonly(),
  cells: z.array(cell).length(64).readonly(),
  memory: z.array(sighting).max(64).readonly(),
  everLit: z.array(square).max(64).readonly(),
  ownUnitLineage: z.array(lineage).min(1).max(64).readonly(),
  ownMineLineage: z.array(mineLineage).max(3).readonly(),
  economy: z.strictObject({
    side,
    ownPaidDebits: z.int().min(0).max(576),
    ownPaidSurviving: z.int().min(0).max(576),
    ownPaidDestroyed: z.int().min(0).max(576),
    ownPaidWasted: z.int().min(0).max(576),
    ownReplacementDestroyed: z.int().min(0).max(1152),
    enemyLoss: z.strictObject({
      confirmedUnitCount: z.int().min(0).max(128),
      replacementLowerBound: z.int().min(0).max(1152),
      paidLowerBound: z.literal(0),
      upper: z.literal("unknown"),
      completeness: z.literal("witnessed-only"),
    }).readonly(),
    receipts: z.array(receipt).max(64).readonly(),
    retiredOwnIds: z.array(unitId).max(128).readonly(),
  }).readonly(),
}).readonly();

export type Observation = z.infer<typeof observationShape>;
export type ObservedCell = Observation["cells"][number];
export const observationJsonSchema = z.toJSONSchema(observationShape, { target: "draft-2020-12", reused: "ref" });
