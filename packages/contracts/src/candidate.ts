// SPEC: _spec/representation.puml
import { z } from "zod";

const square = z.templateLiteral([z.enum(["a", "b", "c", "d", "e", "f", "g", "h"]), z.enum(["1", "2", "3", "4", "5", "6", "7", "8"])]);
const color = z.enum(["w", "b"]);
const spawn = z.enum(["p", "n", "b", "r", "q"]);
const promotion = z.enum(["n", "b", "r", "q"]);
const timing = z.enum(["B", "F"]);
const action = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("classical"), timing: z.literal("C"), color, from: square, to: square, promotion: promotion.optional() }),
  z.strictObject({ kind: z.literal("deploy"), timing, color, from: square, to: square, unit: spawn }),
  z.strictObject({ kind: z.literal("stimStep"), timing, color, from: square, to: square, promotion: promotion.optional() }),
  z.strictObject({ kind: z.literal("spiderMine"), timing, color, from: square }),
  z.strictObject({ kind: z.literal("charonMissiles"), timing, color, from: square, to: square }),
  z.strictObject({ kind: z.literal("siegeMode"), timing, color, from: square }),
  z.strictObject({ kind: z.literal("tacticalJump"), timing, color, from: square, to: square }),
]).readonly();
export const candidateShape = z.strictObject({ version: z.literal("chess-coach.candidate.v1"), actions: z.array(action).max(4).readonly() }).readonly();

export type Candidate = z.infer<typeof candidateShape>;

export function decodeCandidate(json: string, side: "w" | "b"): Candidate {
  if (json.length > 4096 || new TextEncoder().encode(json).byteLength > 4096) throw new RangeError("Candidate exceeds byte limit");
  const result = candidateShape.parse(JSON.parse(json));
  if (result.actions.some(value => value.color !== side) ||
    result.actions.filter(value => value.kind === "classical").length > 1 ||
    result.actions.filter(value => value.kind === "deploy").length > 1) throw new Error("Candidate side or action cardinality mismatch");
  return result;
}
