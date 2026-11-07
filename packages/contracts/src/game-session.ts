// SPEC: _spec/recipient-production.puml
import type {} from "bun";
import { createHash } from "node:crypto";
import { z } from "zod";
import { AddScActionError, addScAction, applyStoredIncome, createCanonicalGame, scOutcome, UNIT_COST } from "@chess-coach/game-core";
import type { ScActionInput, ScFenSnapshot, StarChessColor } from "@chess-coach/game-core";
import { beginWithJournal, endWithJournal, seedCausalState } from "@chess-coach/game-core/causal-producer";
import type { CausalState } from "@chess-coach/game-core/causal-producer";
import type { Journaled } from "../../game-core/src/causal-producer";
import type { BeginScTurnResult, EndScTurnResult } from "@chess-coach/game-core";
import { decodeNativeIntents, nativeIntentsShape } from "./native-intents";
import { decodeCausalState } from "./causal-journal";
import { produceRecipient, seedRecipient } from "./recipient";
import type { RecipientBatch, RecipientState } from "./recipient";
import { recipientBatchShape } from "./recipient-codec";

type Bank = Record<StarChessColor, number>;
export type GamePlans = Record<StarChessColor, readonly ScActionInput[]>;
export class GameAdmissionError extends Error {
  constructor(readonly side: StarChessColor, readonly actionOrdinal: number, readonly code: "MINERALS" | AddScActionError["code"]) {
    super(`Game admission: ${code}`);
    this.name = "GameAdmissionError";
  }
}
export type GameRecord = { version: "chess-coach.game-record.v1"; ordinal: number;
  operation: { kind: "open" } | { kind: "settle"; plans: GamePlans };
  batches: Record<StarChessColor, RecipientBatch>; bank: Bank; snapshot: ScFenSnapshot };
export type GameSession = { version: "chess-coach.game-session.v1"; phase: "unopened" | "opened" | "terminal";
  snapshot: ScFenSnapshot; bank: Bank; native: CausalState; recipients: Record<StarChessColor, RecipientState>;
  batches: Record<StarChessColor, RecipientBatch>; history: string[] };
export type GameTransition = { session: GameSession; record: GameRecord;
  native: { kind: "opened"; value: Journaled<BeginScTurnResult> } | { kind: "settled"; value: Journaled<EndScTurnResult> } };
const clone = <T>(value: T): T => structuredClone(value);
function fail(code: string): never { throw new Error(`Game session: ${code}`); }
const digest = (json: string): string => createHash("sha256").update(json).digest("hex");
const MAX_GAME_RECORD_BYTES = 40 * 1024 * 1024;
const side = z.enum(["w", "b"]), piece = z.enum(["p", "n", "b", "r", "q", "k"]);
const square = z.templateLiteral([z.enum(["a", "b", "c", "d", "e", "f", "g", "h"]), z.enum(["1", "2", "3", "4", "5", "6", "7", "8"])]);
const pair = (maximum: number) => z.strictObject({ w: z.int().min(0).max(maximum), b: z.int().min(0).max(maximum) });
const snapshotShape = z.strictObject({ placement: z.string().min(15).max(71).regex(/^[prnbqkPRNBQK1-8/]+$/), turn: z.int().min(0).max(45),
  ccLives: pair(3), phase: z.enum(["P", "O"]), gas: pair(3), gasIncome: pair(3), stored: pair(12), queue: z.strictObject({ actions: z.array(z.never()).length(0) }),
  specialsUsed: z.array(square).max(64).optional(), mines: z.array(z.strictObject({ color: side, at: square })).max(6).optional(),
  siegedTanks: z.array(square).max(64).optional(), pendingCCShots: z.array(z.strictObject({ color: side, piece, from: square, to: square })).max(64).optional() });
export const gameRecordShape = z.strictObject({ version: z.literal("chess-coach.game-record.v1"), ordinal: z.int().min(1).max(91),
  operation: z.discriminatedUnion("kind", [z.strictObject({ kind: z.literal("open") }),
    z.strictObject({ kind: z.literal("settle"), plans: z.strictObject({ w: nativeIntentsShape, b: nativeIntentsShape }) })]),
  batches: z.strictObject({ w: recipientBatchShape, b: recipientBatchShape }), bank: pair(12), snapshot: snapshotShape });
export const gameRecordJsonSchema = z.toJSONSchema(gameRecordShape, { target: "draft-2020-12", reused: "ref" });

function assertBank(bank: Bank): void {
  if (!bank || Object.keys(bank).sort().join() !== "b,w" || [bank.w, bank.b].some(amount => !Number.isSafeInteger(amount) || amount < 0 || amount > 12)) fail("BANK");
}
function assertParent(parent: GameSession): void {
  assertBank(parent.bank);
  if (parent.version !== "chess-coach.game-session.v1" || parent.native.turn !== parent.snapshot.turn || parent.native.callOrdinal !== parent.history.length ||
    JSON.stringify(parent.snapshot.stored) !== JSON.stringify(parent.bank)) fail("PARENT_STATE");
  for (const side of ["w", "b"] as const) {
    const recipient = parent.recipients[side];
    if (recipient.observation.side !== side || recipient.observation.own.minerals !== parent.bank[side] || recipient.callOrdinal !== parent.native.callOrdinal ||
      recipient.observation.turn !== parent.snapshot.turn || JSON.stringify(parent.batches[side].observation) !== JSON.stringify(recipient.observation)) fail("PARENT_RECIPIENT");
  }
}

export function seedGame(snapshot: ScFenSnapshot, bank: Bank): GameSession {
  assertBank(bank);
  if (snapshot.phase !== "P" || (snapshot.queue?.actions.length ?? 0) !== 0) fail("INITIAL_PHASE");
  const native = seedCausalState(snapshot);
  decodeCausalState(JSON.stringify(native));
  const w = seedRecipient(snapshot, native, "w", bank.w), b = seedRecipient(snapshot, native, "b", bank.b);
  return { version: "chess-coach.game-session.v1", phase: scOutcome(snapshot) ? "terminal" : "unopened",
    snapshot: { ...clone(snapshot), stored: clone(bank) }, bank: clone(bank), native,
    recipients: { w: w.state, b: b.state }, batches: { w: w.batch, b: b.batch }, history: [] };
}

export function initializeGame(): GameSession {
  const { snapshot } = createCanonicalGame();
  return seedGame(snapshot, snapshot.stored!);
}

function complete(parent: GameSession, session: Omit<GameSession, "history">, operation: GameRecord["operation"], native: GameTransition["native"]): GameTransition {
  const record: GameRecord = { version: "chess-coach.game-record.v1", ordinal: parent.history.length + 1, operation: clone(operation),
    batches: clone(session.batches), bank: clone(session.bank), snapshot: clone(session.snapshot) };
  const json = JSON.stringify(record);
  if (json.length > MAX_GAME_RECORD_BYTES || new TextEncoder().encode(json).byteLength > MAX_GAME_RECORD_BYTES || record.ordinal > 91) fail("RECORD_BOUND");
  gameRecordShape.parse(record);
  return { session: { ...session, history: [...parent.history, digest(json)] }, record, native };
}

export function openGame(parent: GameSession): GameTransition {
  assertParent(parent);
  if (parent.phase !== "unopened" || scOutcome(parent.snapshot)) fail("OPEN_PHASE");
  const native = beginWithJournal(parent.snapshot, parent.native);
  const snapshot = { ...native.result.next, stored: clone(parent.bank) };
  const w = produceRecipient(parent.recipients.w, snapshot, native.state, native.journal, "opened", parent.bank.w);
  const b = produceRecipient(parent.recipients.b, snapshot, native.state, native.journal, "opened", parent.bank.b);
  return complete(parent, { version: parent.version, phase: scOutcome(snapshot) ? "terminal" : "opened", snapshot,
    bank: clone(parent.bank), native: native.state, recipients: { w: w.state, b: b.state }, batches: { w: w.batch, b: b.batch } }, { kind: "open" }, { kind: "opened", value: native });
}

export function settleGame(parent: GameSession, requested: GamePlans): GameTransition {
  assertParent(parent);
  if (parent.phase !== "opened" || scOutcome(parent.snapshot) || (parent.snapshot.queue?.actions.length ?? 0) !== 0) fail("SETTLE_PHASE");
  if (!requested || Object.keys(requested).sort().join() !== "b,w") fail("PLAN_SEATS");
  const plans: GamePlans = { w: [], b: [] }, spend = { w: 0, b: 0 }, gasAfter = { w: 0, b: 0 };
  for (const side of ["w", "b"] as const) {
    const actions = decodeNativeIntents(JSON.stringify(requested[side]), side);
    let staged = clone(parent.snapshot);
    for (const [ordinal, action] of actions.entries()) {
      if (action.kind === "deploy") spend[side] += UNIT_COST[action.unit];
      if (spend[side] > parent.bank[side]) throw new GameAdmissionError(side, ordinal, "MINERALS");
      try { staged = addScAction({ snapshot: staged, action }).snapshot; }
      catch (error) {
        if (error instanceof AddScActionError) throw new GameAdmissionError(side, ordinal, error.code);
        throw error;
      }
    }
    plans[side] = clone(actions);
    gasAfter[side] = staged.gas[side];
  }
  let queued = clone(parent.snapshot);
  for (const side of ["w", "b"] as const) for (const action of plans[side]) queued = addScAction({ snapshot: queued, action }).snapshot;
  if (queued.gas.w !== gasAfter.w || queued.gas.b !== gasAfter.b) fail("MERGE_GAS");
  const debited = { w: parent.bank.w - spend.w, b: parent.bank.b - spend.b };
  const native = endWithJournal(queued, parent.native, { skipTurnStartChecks: true });
  const bank = applyStoredIncome(debited, native.result.next.turn);
  const snapshot = { ...native.result.next, stored: clone(bank) };
  const w = produceRecipient(parent.recipients.w, snapshot, native.state, native.journal, "settled", bank.w, queued.queue!.actions);
  const b = produceRecipient(parent.recipients.b, snapshot, native.state, native.journal, "settled", bank.b, queued.queue!.actions);
  return complete(parent, { version: parent.version, phase: scOutcome(snapshot) ? "terminal" : "unopened", snapshot, bank,
    native: native.state, recipients: { w: w.state, b: b.state }, batches: { w: w.batch, b: b.batch } }, { kind: "settle", plans }, { kind: "settled", value: native });
}

export function replayGameRecord(parent: GameSession, json: string): GameSession {
  assertParent(parent);
  if (json.length > MAX_GAME_RECORD_BYTES || new TextEncoder().encode(json).byteLength > MAX_GAME_RECORD_BYTES) fail("RECORD_BOUND");
  const record: GameRecord = gameRecordShape.parse(JSON.parse(json));
  const previous = parent.history[record.ordinal - 1];
  if (previous !== undefined) {
    if (previous !== digest(json)) fail("REPLAY_CONFLICT");
    return clone(parent);
  }
  if (record.ordinal !== parent.history.length + 1) fail("REPLAY_GAP");
  const actual = record.operation?.kind === "open" ? openGame(parent)
    : record.operation?.kind === "settle" ? settleGame(parent, record.operation.plans) : fail("RECORD_OPERATION");
  if (JSON.stringify(actual.record) !== json) fail("REPLAY_MISMATCH");
  return actual.session;
}
