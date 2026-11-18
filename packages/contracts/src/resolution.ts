// SPEC: _spec/runtime-protocol.puml
import { z } from "zod";

const side = z.enum(["w", "b"]), type = z.enum(["p", "n", "b", "r", "q", "k"]), spawn = z.enum(["p", "n", "b", "r", "q"]);
const square = z.templateLiteral([z.enum(["a", "b", "c", "d", "e", "f", "g", "h"]), z.enum(["1", "2", "3", "4", "5", "6", "7", "8"])]);
const placement = z.string().min(15).max(71).regex(/^[prnbqkPRNBQK1-8/]+$/);
const pair = (max: number) => z.strictObject({ w: z.int().min(0).max(max), b: z.int().min(0).max(max) });
const mines = z.array(z.strictObject({ color: side, at: square })).max(6);
const piece = z.strictObject({ type, color: side });
const victim = z.strictObject({ piece: type, color: side });
const action = z.union([
  z.strictObject({ kind: z.literal("classical"), timing: z.literal("C"), color: side, from: square, to: square, promotion: spawn.optional(), seq: z.int().min(0).max(7) }),
  z.strictObject({ kind: z.enum(["deploy", "stimStep", "spiderMine", "charonMissiles", "siegeMode", "tacticalJump"]), timing: z.enum(["B", "F"]),
    color: side, from: square, to: square.optional(), unit: spawn.optional(), promotion: spawn.optional(), seq: z.int().min(0).max(7) }),
]);
const shot = z.strictObject({ color: side, piece: type, from: square, to: square });
export const nativeSnapshotShape = z.strictObject({ placement, turn: z.int().min(0).max(45), ccLives: pair(3), phase: z.enum(["P", "B", "A", "M", "F", "O"]),
  gas: pair(3), gasIncome: pair(3), stored: pair(12).optional(), queue: z.strictObject({ actions: z.array(action).max(8) }).optional(),
  specialsUsed: z.array(square).max(64).optional(), mines: mines.optional(), siegedTanks: z.array(square).max(64).optional(), pendingCCShots: z.array(shot).max(128).optional() });
const board = z.strictObject({ placement, ccLives: pair(3), mines });
const move = z.strictObject({ piece: type, color: side, from: square, to: square });
const promotion = z.strictObject({ color: side, from: square, at: square, unit: spawn });
const origin = { piece: type, color: side, from: square, to: square };
const path = { pathRevealFrom: square.optional(), pathRevealSteps: z.int().min(1).max(6).optional() };
const attack = z.discriminatedUnion("kind", [
  z.strictObject({ ...origin, ...path, kind: z.literal("capture"), victim, mineColor: side.optional(), dies: z.boolean().optional(),
    occupies: z.boolean().optional(), collision: z.boolean().optional(), moveCollision: z.boolean().optional() }),
  z.strictObject({ ...origin, ...path, kind: z.literal("ccShot"), target: side, livesAfter: z.int().min(0).max(3), moveCollision: z.boolean().optional(), stopAt: square.optional() }),
  z.strictObject({ ...origin, kind: z.literal("mineBlast"), mineColor: side, victim: victim.optional(), chaseFrom: square.optional() }),
  z.strictObject({ ...origin, kind: z.literal("shelling") }),
]);
const attacks = z.array(attack).max(4096);
const resolved = z.strictObject({ attacks, afterAttack: board, moves: z.array(move).max(4096), afterMove: board, pathRevealAttacks: attacks,
  afterAll: board, mineTriggers: attacks, pathRevealMineTriggers: attacks, moveCollisions: attacks, promotions: z.array(promotion).max(64), pendingCCShotsArmed: z.array(shot).max(128) });
const timeline = z.strictObject({ id: z.string().min(1).max(64), phase: z.enum(["specialBefore", "attack", "move", "specialAfter"]), color: side,
  from: square.optional(), to: square.optional(), kind: z.enum(["classical", "deploy", "stimStep", "spiderMine", "charonMissiles", "siegeMode", "tacticalJump"]).optional(),
  victim: piece.optional(), collider: piece.optional(), mineColor: side.optional(), chaseFrom: square.optional(), unit: type.optional() });
export const endResolutionShape = z.strictObject({ resolved, next: nativeSnapshotShape, ignoreAttacksOn: z.array(square).max(64), events: z.array(timeline).max(4096),
  siegedThisTurn: z.array(square).max(64), afterB: z.strictObject({ placement, mines, siegedTanks: z.array(square).max(64) }), afterPending: board,
  bMoves: z.array(move).max(8), fMoves: z.array(move).max(8), queue: z.array(action).max(8) });
export const beginResolutionShape = z.strictObject({ changed: z.boolean(), attacks, afterPending: board, next: nativeSnapshotShape, asResolve: endResolutionShape.nullable() });
export const nativeKernelShape = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("initial") }),
  z.strictObject({ kind: z.literal("opened"), result: beginResolutionShape }),
  z.strictObject({ kind: z.literal("settled"), result: endResolutionShape }),
]);
