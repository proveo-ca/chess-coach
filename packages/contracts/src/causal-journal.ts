// SPEC: _spec/causal-journal.puml
import { z } from "zod";
import type { CausalJournalData, CausalState } from "../../game-core/src/causal-types";

export const MAX_CAUSAL_JSON_BYTES = 16 * 1024 * 1024;
const side = z.enum(["w", "b"]), type = z.enum(["p", "n", "b", "r", "q", "k"]), mode = z.enum(["tank", "siege"]);
const square = z.templateLiteral([z.enum(["a", "b", "c", "d", "e", "f", "g", "h"]), z.enum(["1", "2", "3", "4", "5", "6", "7", "8"])]);
const engineUnit = z.templateLiteral(["engine:unit:", z.int()]).refine(id => /^engine:unit:[1-9][0-9]*$/.test(id) && Number(id.split(":")[2]) <= 192);
const engineMine = z.templateLiteral(["engine:mine:", z.int()]).refine(id => /^engine:mine:[1-9][0-9]*$/.test(id) && Number(id.split(":")[2]) <= 512);
const unit = z.strictObject({ kind: z.literal("unit"), id: engineUnit, side, type, square, tankMode: mode.nullable() });
const mine = z.strictObject({ kind: z.literal("mine"), id: engineMine, side, square });
const piece = z.strictObject({ type, color: side });
const cell = z.discriminatedUnion("visibility", [
  z.strictObject({ square, visibility: z.literal("unknown") }),
  z.strictObject({ square, visibility: z.literal("lit"), piece: piece.nullable() }),
  z.strictObject({ square, visibility: z.literal("revealed"), piece }),
]);
const cells = z.strictObject({ w: z.array(cell).length(64), b: z.array(cell).length(64) });
const seq = z.int().min(0).max(7), group = z.int().min(0).max(1151), discoveryOrdinal = z.int().min(0).max(3);
const target = z.strictObject({ discoveryOrdinal, recipient: side, square, piece,
  evaluationActorId: engineUnit, evaluationTargetId: engineUnit, appliedActorId: engineUnit, appliedTargetId: engineUnit });
const metadata = { ordinal: z.int().min(0).max(4095), group,
  phase: z.enum(["turn-open", "B", "C-attack", "C-move", "C-path", "C-promotion", "F"]) };
const event = z.discriminatedUnion("kind", [
  z.strictObject({ ...metadata, kind: z.literal("unit-created"), entity: unit, actionSeq: seq }),
  z.strictObject({ ...metadata, kind: z.literal("unit-destroyed"), entity: unit, actionSeq: seq.nullable(), visibleTo: z.array(side).max(2), targets: z.array(target).max(4) }),
  z.strictObject({ ...metadata, kind: z.literal("unit-moved"), entityId: engineUnit, from: square, to: square, actionSeq: seq.nullable() }),
  z.strictObject({ ...metadata, kind: z.literal("unit-transformed"), entityId: engineUnit, fromType: type, toType: type, actionSeq: seq.nullable() }),
  z.strictObject({ ...metadata, kind: z.literal("tank-mode-changed"), entityId: engineUnit, before: mode, after: mode, actionSeq: seq.nullable() }),
  z.strictObject({ ...metadata, kind: z.literal("mine-created"), entity: mine, actionSeq: seq }),
  z.strictObject({ ...metadata, kind: z.literal("mine-removed"), entity: mine, actionSeq: seq.nullable() }),
  z.strictObject({ ...metadata, kind: z.literal("cc-damaged"), side, before: z.int().min(0).max(3), after: z.int().min(0).max(3), actionSeq: seq.nullable(), targets: z.array(target).max(4) }),
  z.strictObject({ ...metadata, kind: z.literal("deployment-resolved"), side, unitId: engineUnit.nullable(), actionSeq: seq }),
  z.strictObject({ ...metadata, kind: z.literal("visibility"), recipient: side, turn: z.int().min(0).max(45), changes: z.array(cell).min(1).max(64) }),
]);
const discovery = z.strictObject({ ordinal: discoveryOrdinal, actionSeq: seq, side, site: z.enum(["scan-ray", "reveal-to"]),
  from: square, to: square, target: square, evaluationActorId: engineUnit, evaluationTargetId: engineUnit,
  modeSource: z.enum(["default-tank", "native-sieged-set"]), siegedSquares: z.array(square).max(64), mineInputProvided: z.boolean(),
  mines: z.array(z.strictObject({ color: side, at: square })).max(6),
  steps: z.array(z.strictObject({ square, visible: z.boolean() })).max(6), returnedStep: z.int().min(1).max(6).nullable(), deferred: z.boolean(),
  applied: z.strictObject({ group, operation: z.enum(["capture", "cc-shot"]), actorId: engineUnit, targetId: engineUnit }).nullable(),
});

export const causalJournalShape = z.strictObject({ version: z.literal("chess-coach.causal-journal.v1"), turn: z.int().min(0).max(45),
  callOrdinal: z.int().min(1).max(91), initialCells: cells, finalCells: cells, events: z.array(event).max(4096), discoveries: z.array(discovery).max(4) });
export const causalStateShape = z.strictObject({ version: z.literal("chess-coach.causal-state.v1"), turn: z.int().min(0).max(45),
  callOrdinal: z.int().min(0).max(91), unitCounter: z.int().min(2).max(192), mineCounter: z.int().min(0).max(512),
  ccLives: z.strictObject({ w: z.int().min(0).max(3), b: z.int().min(0).max(3) }),
  entities: z.array(z.discriminatedUnion("kind", [unit, mine])).min(2).max(70), mineOrder: z.array(engineMine).max(6), nativeSiegedSquares: z.array(square).max(64) });

function journalIssues(journal: CausalJournalData): string[] {
  const issues: string[] = [];
  const ordered = (values: readonly { square: string }[]): boolean => values.every((value, index) => index === 0 || values[index - 1]!.square < value.square);
  const usedQueries = new Set<number>();
  for (const boundary of [journal.initialCells, journal.finalCells]) for (const side of ["w", "b"] as const) {
    if (!ordered(boundary[side])) issues.push("CELL_ORDER");
  }
  let lastGroup = -1, visibilityStarted = false, effects = 0, groupEffects = 0;
  let phase: CausalJournalData["events"][number]["phase"] | null = null;
  const visibleRecipients = new Set<string>();
  for (const [ordinal, event] of journal.events.entries()) {
    if (event.ordinal !== ordinal || event.group < lastGroup || event.group > lastGroup + 1) issues.push("EVENT_ORDER");
    if (event.group !== lastGroup) { lastGroup = event.group; visibilityStarted = false; visibleRecipients.clear(); groupEffects = 0; phase = event.phase; }
    if (event.phase !== phase) issues.push("GROUP_PHASE");
    if (event.kind === "visibility") {
      if (!groupEffects || !ordered(event.changes) || event.turn !== journal.turn || visibleRecipients.has(event.recipient)) issues.push("VISIBILITY_ORDER");
      visibilityStarted = true;
      visibleRecipients.add(event.recipient);
      continue;
    }
    if (visibilityStarted) issues.push("EFFECT_AFTER_VISIBILITY");
    effects++;
    groupEffects++;
    if (event.kind === "unit-destroyed" && new Set(event.visibleTo).size !== event.visibleTo.length) issues.push("VISIBLE_RECIPIENTS");
    if (event.kind === "unit-created" || event.kind === "unit-destroyed") {
      if ((event.entity.type === "r") !== (event.entity.tankMode !== null) || event.kind === "unit-destroyed" && event.entity.type === "k") issues.push("UNIT_STATE");
    }
    if (event.kind === "unit-moved" && event.from === event.to) issues.push("NOOP_MOVE");
    if (event.kind === "unit-transformed" && (event.fromType === event.toType || event.fromType === "k" || event.toType === "k")) issues.push("TRANSFORM");
    if (event.kind === "tank-mode-changed" && event.before === event.after) issues.push("NOOP_MODE");
    if (event.kind === "cc-damaged" && (event.before < 1 || event.after !== event.before - 1)) issues.push("CC_DAMAGE");
    if (event.kind !== "unit-destroyed" && event.kind !== "cc-damaged") continue;
    for (const target of event.targets) {
      const query = journal.discoveries[target.discoveryOrdinal];
      const applied = query?.applied;
      if (usedQueries.has(target.discoveryOrdinal) || !query || !applied || event.phase !== "C-path" || event.actionSeq !== query.actionSeq ||
        !query.deferred || !query.returnedStep || applied.group !== event.group || query.side !== target.recipient || target.piece.color === target.recipient ||
        query.target !== target.square || query.evaluationActorId !== target.evaluationActorId || query.evaluationTargetId !== target.evaluationTargetId ||
        applied.actorId !== target.appliedActorId || applied.targetId !== target.appliedTargetId) issues.push("TARGET_BINDING");
      if (event.kind === "unit-destroyed" ? applied?.operation !== "capture" || event.entity.id !== target.appliedTargetId ||
        event.entity.square !== target.square || event.entity.type !== target.piece.type || event.entity.side !== target.piece.color
        : applied?.operation !== "cc-shot" || event.side !== target.piece.color || target.piece.type !== "k") issues.push("TARGET_EFFECT");
      usedQueries.add(target.discoveryOrdinal);
    }
  }
  if (effects > 1152) issues.push("EFFECT_BOUND");
  for (const [ordinal, query] of journal.discoveries.entries()) {
    const visible = query.steps.findIndex(step => step.visible);
    if (query.ordinal !== ordinal || query.from === query.to || new Set(query.steps.map(step => step.square)).size !== query.steps.length ||
      (query.returnedStep === null ? visible !== -1 : visible !== query.returnedStep - 1 || query.steps.length !== query.returnedStep) ||
      query.deferred && query.returnedStep === null || query.applied !== null && !usedQueries.has(ordinal) ||
      !query.mineInputProvided && query.mines.length !== 0 || new Set(query.siegedSquares).size !== query.siegedSquares.length ||
      query.modeSource === "default-tank" && query.siegedSquares.length !== 0) issues.push("DISCOVERY_TRACE");
    if (query.applied && !journal.events.some(event => event.group === query.applied!.group && event.kind === "unit-moved" &&
      event.entityId === query.applied!.actorId && event.from === query.from && (query.applied!.operation !== "capture" || event.to === query.target))) issues.push("APPLIED_ACTOR");
  }
  return issues;
}

const journal = causalJournalShape.superRefine((value, context) => {
  for (const message of journalIssues(value)) context.addIssue({ code: "custom", message });
});
const state = causalStateShape.superRefine((value, context) => {
  const issue = (message: string): void => { context.addIssue({ code: "custom", message }); };
  const units = value.entities.filter(entity => entity.kind === "unit"), mines = value.entities.filter(entity => entity.kind === "mine");
  const ids = new Set(value.entities.map(entity => entity.id));
  if (ids.size !== value.entities.length || units.length > 64 || mines.length > 6 || new Set(units.map(unit => unit.square)).size !== units.length) issue("STATE_CARDINALITY");
  if (value.mineOrder.length !== mines.length || new Set(value.mineOrder).size !== mines.length || value.mineOrder.some(id => !mines.some(mine => mine.id === id))) issue("STATE_MINES");
  if (new Set(value.nativeSiegedSquares).size !== value.nativeSiegedSquares.length) issue("STATE_NATIVE_MODES");
  for (const side of ["w", "b"] as const) if (units.filter(unit => unit.side === side && unit.type === "k").length !== 1 || mines.filter(mine => mine.side === side).length > 3) issue("STATE_SIDE");
  for (const entity of value.entities) {
    if (Number(entity.id.split(":")[2]) > (entity.kind === "unit" ? value.unitCounter : value.mineCounter)) issue("STATE_COUNTER");
    if (entity.kind === "unit" && (entity.type === "r" ? entity.tankMode !== (value.nativeSiegedSquares.includes(entity.square) ? "siege" : "tank") : entity.tankMode !== null)) issue("STATE_MODE");
  }
});

export function decodeCausalJournal(json: string): CausalJournalData {
  if (json.length > MAX_CAUSAL_JSON_BYTES || new TextEncoder().encode(json).byteLength > MAX_CAUSAL_JSON_BYTES) throw new RangeError("Causal journal exceeds byte limit");
  return journal.parse(JSON.parse(json));
}
export function encodeCausalJournal(value: CausalJournalData): string {
  const json = JSON.stringify(value);
  decodeCausalJournal(json);
  return json;
}
export function decodeCausalState(json: string): CausalState {
  if (json.length > MAX_CAUSAL_JSON_BYTES || new TextEncoder().encode(json).byteLength > MAX_CAUSAL_JSON_BYTES) throw new RangeError("Causal state exceeds byte limit");
  return state.parse(JSON.parse(json));
}
export const causalJournalJsonSchema = z.toJSONSchema(causalJournalShape, { target: "draft-2020-12", reused: "ref" });
export const causalStateJsonSchema = z.toJSONSchema(causalStateShape, { target: "draft-2020-12", reused: "ref" });
