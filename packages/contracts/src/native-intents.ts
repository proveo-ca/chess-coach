// SPEC: _spec/runtime-protocol.puml, _spec/recipient-production.puml
import { z } from "zod";

const square = z.templateLiteral([z.enum(["a", "b", "c", "d", "e", "f", "g", "h"]), z.enum(["1", "2", "3", "4", "5", "6", "7", "8"])]);
const color = z.enum(["w", "b"]), spawn = z.enum(["p", "n", "b", "r", "q"]), timing = z.enum(["B", "F"]);
export const nativeIntentShape = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("classical"), timing: z.literal("C"), color, from: square, to: square, promotion: spawn.optional() }),
  z.strictObject({ kind: z.literal("deploy"), timing, color, from: square, to: square, unit: spawn, promotion: spawn.optional() }),
  z.strictObject({ kind: z.enum(["stimStep", "spiderMine", "charonMissiles", "siegeMode", "tacticalJump"]), timing, color, from: square,
    to: square.optional(), unit: spawn.optional(), promotion: spawn.optional() }),
]);
export const nativeIntentsShape = z.array(nativeIntentShape).max(65);
export function decodeNativeIntents(json: string, side: "w" | "b"): z.infer<typeof nativeIntentsShape> {
  if (json.length > 1048576 || new TextEncoder().encode(json).byteLength > 1048576) throw new RangeError("Native intents exceed byte limit");
  const actions = nativeIntentsShape.parse(JSON.parse(json));
  if (actions.some(action => action.color !== side)) throw new Error("Native intents: SIDE");
  return actions;
}
