// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml, _spec/packages/starchess-arena/ml-adjutant-challenge-harness.puml
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  getSideVision, mapToPlacement, parseScFen, placementToMap,
  type ScActionInput, type ScFenSnapshot, type ScPiece, type Square,
} from "@chess-coach/starchess-core";
import { stageQueue, type StagedQueue } from "../challenge/admission";
import {
  encodeR3Provenance, initializeR3Session, stageR3Begin, stageR3Settlement, verifyAndCommitR3,
  type R3Session, type R3StagedTransition,
} from "../challenge/r3Session";
import { bytes } from "../authorized/v2/schema";
import type { AuthorizedEvent, ObservedCell, Sighting } from "../authorized/v2/types";

type Entry = readonly [Square, ScPiece["type"], "w" | "b"];
const board = (entries: readonly Entry[], turn = 21, extras = ""): ScFenSnapshot => {
  const map = new Map<Square, ScPiece>(entries.map(([square, type, color]) => [square, { type, color }]));
  const gas = turn <= 10 ? 1 : turn <= 20 ? 2 : 3;
  return parseScFen(`SCFEN|${mapToPlacement(map)}|${turn}|33|P|G:${gas}${gas}:${gas}${gas}|Q:w:;b:${extras}`);
};
const move = (color: "w" | "b", from: Square, to: Square): ScActionInput => ({ kind: "classical", timing: "C", color, from, to });
const run = (opening: ScFenSnapshot, white: readonly ScActionInput[], black: readonly ScActionInput[] = []) => {
  const binding = {};
  const initial = initializeR3Session(binding, opening, { w: 12, b: 12 });
  const open = verifyAndCommitR3(binding, initial, stageR3Begin(binding, initial));
  const stages = {} as Record<"w" | "b", StagedQueue>;
  for (const side of ["w", "b"] as const) {
    const staged = stageQueue(open.snapshot, open.bank, side, side === "w" ? white : black, 0);
    if (!staged.ok) throw new Error(JSON.stringify(staged));
    stages[side] = staged.staged;
  }
  const transition = stageR3Settlement(binding, open, stages);
  const session = verifyAndCommitR3(binding, open, transition);
  return { binding, initial, open, transition, session };
};
const events = (session: R3Session, side: "w" | "b" = "w") => session.recipients[side].batch.events;
const sightings = (events: readonly AuthorizedEvent[]) => events.flatMap(event => event.kind === "vision-witness" ? event.changes.filter(cell => cell.visibility !== "unknown" && cell.piece?.color === "b") : []);
const targetFact = (session: R3Session, target: Square, type: ScPiece["type"]) => events(session).filter(event => event.kind === "vision-witness" && event.changes.length === 1 &&
  event.changes[0].square === target && event.changes[0].visibility === "lit" && event.changes[0].piece?.type === type && event.changes[0].piece.color === "b");
const forged = (transition: R3StagedTransition, alter: (value: any) => void): R3StagedTransition => {
  const copy = { ...structuredClone(transition), binding: transition.binding };
  alter(copy);
  const { nativeResult: _native, ...record } = copy.companion;
  const provenanceBytes = encodeR3Provenance(record);
  return { ...copy, provenanceBytes, digest: { byteLength: provenanceBytes.length, sha256: createHash("sha256").update(provenanceBytes).digest("hex") } };
};
const foldPublicMemory = (prior: readonly Sighting[], eventList: readonly AuthorizedEvent[], final: readonly ObservedCell[], turn: number, side: "w" | "b") => {
  const memory = new Map(prior.map(sighting => [sighting.square, sighting]));
  const fold = (cells: readonly ObservedCell[], observedTurn: number) => {
    for (const cell of cells) {
      if (cell.visibility === "unknown") continue;
      if (cell.piece && cell.piece.color !== side) memory.set(cell.square, { square: cell.square, piece: cell.piece, observedTurn });
      else memory.delete(cell.square);
    }
  };
  for (const event of eventList) {
    if (event.kind === "vision-witness") fold(event.changes, event.turn);
    if (event.kind === "enemy-unit-destruction-witnessed" && memory.get(event.square)?.piece.type === event.type) memory.delete(event.square);
  }
  fold(final, turn);
  return [...memory.values()].sort((a, b) => a.square < b.square ? -1 : 1);
};

describe("R3 target-only recipient privacy against real native counterexamples", () => {
  it("keeps hidden-prefix Hoverbike occupancy twins byte-identical for the acting recipient", () => {
    const opening = board([["a1", "b", "w"], ["h1", "k", "w"], ["a8", "k", "b"], ["g7", "p", "b"], ["f5", "n", "b"]]);
    const left = run(opening, [move("w", "a1", "h8")], [move("b", "f5", "d4")]);
    const right = run(opening, [move("w", "a1", "h8")], [move("b", "f5", "d6")]);
    expect(left.transition.companion.provenance.lastCall.consumedFacts).toHaveLength(1);
    expect(right.transition.companion.provenance.lastCall.consumedFacts).toHaveLength(1);
    expect(left.transition.companion.provenance.lastCall.queries[0].evaluatedSteps.map(step => step.mid)).toContain("d4");
    expect(left.session.snapshot.placement).not.toBe(right.session.snapshot.placement);
    expect(left.transition.digest.sha256).not.toBe(right.transition.digest.sha256);
    expect(bytes(left.initial.recipients.w.batch)).toEqual(bytes(right.initial.recipients.w.batch));
    expect(bytes(left.session.recipients.w.batch)).toEqual(bytes(right.session.recipients.w.batch));
    expect(targetFact(left.session, "g7", "p")).toHaveLength(1);
    expect(sightings(events(left.session)).filter(cell => cell.square === "d4" || cell.square === "d6" || cell.square === "f5")).toEqual([]);
    expect(left.session.recipients.w.history.everLit).not.toContain("d4");
    expect(left.session.recipients.w.history.everLit).not.toContain("d6");
    expect(left.session.recipients.w.boundary.economicState.enemyLoss).toEqual({ confirmedUnitCount: 1, replacementLowerBound: 1, paidLowerBound: 0, upper: "unknown", completeness: "witnessed-only" });
    expect(left.session.recipients.w.batch.snapshot.memory).toEqual([]);
  });

  it("normalizes identical targets across actual retired-enemy-siege step-3/step-5 twins", () => {
    const entries: Entry[] = [["a1", "r", "w"], ["b3", "k", "w"], ["a4", "r", "b"], ["a8", "p", "b"], ["h8", "k", "b"]];
    const actions: ScActionInput[] = [
      { kind: "deploy", timing: "B", color: "w", from: "b3", to: "a4", unit: "p" }, move("w", "a1", "a8"),
    ];
    const tank = run(board(entries, 21, "|M:w:;b:a4"), actions);
    const siege = run(board(entries, 21, "|M:w:;b:a4|S:a4"), actions);
    const first = tank.transition.companion.provenance.lastCall.queries[0];
    const second = siege.transition.companion.provenance.lastCall.queries[0];
    expect(first.returnedStep).toBe(5);
    expect(second.returnedStep).toBe(3);
    expect(first.visionInputs.siegeMaskHex).not.toBe(second.visionInputs.siegeMaskHex);
    expect(tank.transition.companion.frames[0].effects.map(effect => effect.kind)).toEqual(["unit-destroy", "unit-create", "deployment-disposition"]);
    expect(siege.transition.companion.frames[1].before.entities.find(entity => entity.kind === "unit" && entity.square === "a4")).toMatchObject({ type: "p", side: "w" });
    expect(siege.transition.companion.frames[2].before.entities.some(entity => entity.square === "a4")).toBe(false);
    expect(bytes(tank.initial.recipients.w.batch)).toEqual(bytes(siege.initial.recipients.w.batch));
    expect(bytes(tank.session.recipients.w.batch)).toEqual(bytes(siege.session.recipients.w.batch));
    expect(targetFact(siege.session, "a8", "p")).toHaveLength(1);
    expect(siege.session.recipients.w.boundary.economicState.enemyLoss.confirmedUnitCount).toBe(2);
    expect(siege.session.recipients.w.history.everLit).toEqual(tank.session.recipients.w.history.everLit);
  });

  it("excludes an unrelated moved Battleship that a speculative Tank prefix could identify", () => {
    const opening = board([["a1", "r", "w"], ["e1", "k", "w"], ["a8", "p", "b"], ["h8", "k", "b"], ["h5", "q", "b"]]);
    const result = run(opening, [move("w", "a1", "a8")], [move("b", "h5", "b5")]);
    expect(result.session.snapshot.placement).toBe("R6k/8/8/1q6/8/8/8/4K3");
    const virtual = placementToMap(result.session.snapshot.placement);
    virtual.delete("a8"); virtual.set("a4", { type: "r", color: "w" });
    expect(getSideVision(virtual, "w").litSquares.has("b5")).toBe(true);
    expect(getSideVision(placementToMap(result.session.snapshot.placement), "w").litSquares.has("b5")).toBe(false);
    expect(result.transition.companion.provenance.lastCall.queries[0].returnedStep).toBe(5);
    expect(result.transition.companion.provenance.lastCall.consumedFacts[0].targetCell).toEqual({ square: "a8", visibility: "lit", piece: { type: "p", color: "b" } });
    expect(targetFact(result.session, "a8", "p")).toHaveLength(1);
    expect(sightings(events(result.session)).filter(cell => cell.visibility !== "unknown" && cell.piece?.type === "q")).toEqual([]);
    expect(result.session.recipients.w.batch.snapshot.cells.find(cell => cell.square === "b5")).toEqual({ square: "b5", visibility: "unknown" });
    expect(result.session.recipients.w.history.everLit).not.toContain("b5");
    expect(result.session.recipients.w.batch.snapshot.memory).toEqual([]);
  });

  it("keeps descriptor-preserving hidden paid replacement identity out of public targets and witnesses", () => {
    const opening = board([["a1", "b", "w"], ["h1", "k", "w"], ["g7", "p", "b"], ["h7", "k", "b"]]);
    const endowed = run(opening, [move("w", "a1", "h8")]);
    const replaced = run(opening, [move("w", "a1", "h8")], [{ kind: "deploy", timing: "B", color: "b", from: "h7", to: "g7", unit: "p" }]);
    const originalProof = endowed.transition.companion.provenance.lastCall.consumedFacts[0];
    const replacementProof = replaced.transition.companion.provenance.lastCall.consumedFacts[0];
    expect(originalProof.targetCell).toEqual(replacementProof.targetCell);
    expect(originalProof.appliedTargetId).not.toBe(replacementProof.appliedTargetId);
    expect(replaced.transition.companion.frames[0].effects.map(effect => effect.kind)).toEqual(["unit-destroy", "unit-create", "deployment-disposition"]);
    expect(bytes(endowed.session.recipients.w.batch)).toEqual(bytes(replaced.session.recipients.w.batch));
    expect(events(replaced.session).filter(event => event.kind === "enemy-unit-destruction-witnessed")).toEqual([
      expect.objectContaining({ witnessId: "w:witness:1", square: "g7", type: "p", replacementLowerBound: 1, paidLowerBound: 0 }),
    ]);
    expect(replaced.session.recipients.b.boundary.economicState.ownPaidDestroyed).toBe(1);
    expect(replaced.session.recipients.w.boundary.economicState.enemyLoss.paidLowerBound).toBe(0);
  });

  it.each(["p", "n"] as const)("closes consumed-capture memory before a subsequent mine death and hidden F %s birth", unit => {
    const opening = board([["a1", "r", "w"], ["e1", "k", "w"], ["a6", "p", "b"], ["b7", "k", "b"]], 21, "|M:w:;b:a5");
    const result = run(opening, [move("w", "a1", "a8")], [{ kind: "deploy", timing: "F", color: "b", from: "b7", to: "a6", unit }]);
    const emitted = events(result.session);
    expect(targetFact(result.session, "a6", "p")).toHaveLength(1);
    const targetIndex = emitted.findIndex(event => event.kind === "vision-witness" && event.changes.some(cell => cell.square === "a6" && cell.visibility === "lit" && cell.piece?.color === "b"));
    const lossIndex = emitted.findIndex(event => event.kind === "enemy-unit-destruction-witnessed");
    expect(lossIndex).toBeGreaterThan(targetIndex);
    expect(emitted.filter(event => event.kind === "enemy-unit-destruction-witnessed")).toHaveLength(1);
    expect(emitted.filter(event => event.kind === "own-unit-destroyed")).toHaveLength(1);
    expect(emitted.flatMap(event => event.kind === "vision-witness" ? event.changes : []).filter(cell => cell.square === "a6" && cell.visibility === "lit" && cell.piece === null)).toEqual([]);
    expect(sightings(emitted).filter(cell => cell.square === "a6")).toEqual([{ square: "a6", visibility: "lit", piece: { type: "p", color: "b" } }]);
    expect(placementToMap(result.session.snapshot.placement).get("a6")).toEqual({ type: unit, color: "b" });
    expect(result.session.recipients.w.batch.snapshot.cells.find(cell => cell.square === "a6")).toEqual({ square: "a6", visibility: "unknown" });
    const remembered = [{ square: "b7", piece: { type: "k", color: "b" }, observedTurn: 21 }];
    expect(result.session.recipients.w.batch.snapshot.memory).toEqual(remembered);
    expect(foldPublicMemory(result.open.recipients.w.batch.snapshot.memory, emitted, result.session.recipients.w.batch.snapshot.cells, result.session.snapshot.turn, "w")).toEqual(remembered);
    expect(result.session.recipients.w.history.everLit).toContain("a6");
    expect(result.session.recipients.b.boundary.economicState.ownPaidSurviving).toBe(unit === "p" ? 1 : 3);
  });

  it("closes consumed casualty memory when a later F replacement crushes the still-live actor", () => {
    const opening = board([["a1", "r", "w"], ["e1", "k", "w"], ["a6", "p", "b"], ["b7", "k", "b"]]);
    const result = run(opening, [move("w", "a1", "a8")], [{ kind: "deploy", timing: "F", color: "b", from: "b7", to: "a6", unit: "p" }]);
    expect(result.transition.companion.frames.at(-1)?.effects.map(effect => effect.kind)).toEqual(["unit-destroy", "unit-create", "deployment-disposition"]);
    expect(events(result.session).filter(event => event.kind === "own-unit-destroyed")).toHaveLength(1);
    expect(result.session.recipients.w.batch.snapshot.memory).toEqual([{ square: "b7", piece: { type: "k", color: "b" }, observedTurn: 21 }]);
    expect(result.session.recipients.w.batch.snapshot.cells.find(cell => cell.square === "a6")).toEqual({ square: "a6", visibility: "unknown" });
    expect(events(result.session).filter(event => event.kind === "enemy-unit-destruction-witnessed")).toHaveLength(1);
  });

  it("gives the nonacting recipient own lifecycle but no consumed target or incidental enemy loss", () => {
    const opening = board([["a1", "r", "w"], ["e1", "k", "w"], ["a8", "p", "b"], ["h8", "k", "b"]]);
    const result = run(opening, [move("w", "a1", "a8")]);
    expect(targetFact(result.session, "a8", "p")).toHaveLength(1);
    const blackEvents = events(result.session, "b");
    expect(blackEvents.filter(event => event.kind === "own-unit-destroyed")).toEqual([expect.objectContaining({ id: "b:unit:opening:a8", square: "a8", typeAtLoss: "p", retiredPaidBasis: 0 })]);
    expect(blackEvents.filter(event => event.kind === "enemy-unit-destruction-witnessed")).toEqual([]);
    expect(blackEvents.flatMap(event => event.kind === "vision-witness" ? event.changes : []).filter(cell => cell.square === "a8" && cell.visibility !== "unknown")).toEqual([]);
    expect(result.session.recipients.b.batch.snapshot.cells.find(cell => cell.square === "a8")).toEqual({ square: "a8", visibility: "unknown" });
    expect(result.session.recipients.b.boundary.economicState.enemyLoss.confirmedUnitCount).toBe(0);
  });

  it("keeps a positive stationary-siege probe private when its application never fires", () => {
    const result = run(board([["a1", "r", "w"], ["e1", "k", "w"], ["a8", "p", "b"], ["h8", "k", "b"]], 21, "|S:a1"), [move("w", "a1", "a8")]);
    expect(result.transition.companion.provenance.lastCall.queries.some(query => query.returnedStep !== null)).toBe(true);
    expect(result.transition.companion.provenance.lastCall.consumedFacts).toEqual([]);
    expect(targetFact(result.session, "a8", "p")).toEqual([]);
    expect(result.session.recipients.w.batch.snapshot.cells.find(cell => cell.square === "a8")).toEqual({ square: "a8", visibility: "unknown" });
    expect(result.session.recipients.w.history.everLit).not.toContain("a8");
    expect(result.session.recipients.w.boundary.economicState.enemyLoss.confirmedUnitCount).toBe(0);
  });

  it("keeps a positive failed victim-guard application private", () => {
    const result = run(board([["a1", "r", "w"], ["e1", "k", "w"], ["a6", "p", "b"], ["h8", "k", "b"]]), [move("w", "a1", "a8")], [move("b", "a6", "a5")]);
    expect(result.transition.companion.provenance.lastCall.queries[0]).toMatchObject({ returnedStep: 3, consumption: "deferred-skipped" });
    expect(result.transition.companion.provenance.lastCall.consumedFacts).toEqual([]);
    expect(targetFact(result.session, "a6", "p")).toEqual([]);
    expect(sightings(events(result.session)).filter(cell => cell.square === "a6")).toEqual([]);
  });

  it("does not resurrect a dead C-wave vision source for a later fire-and-forget casualty", () => {
    const opening = board([["a1", "k", "w"], ["b3", "b", "w"], ["c4", "p", "b"], ["d5", "q", "b"], ["g8", "k", "b"]]);
    const result = run(opening, [{ kind: "charonMissiles", timing: "F", color: "w", from: "b3", to: "d5" }], [move("b", "c4", "b3")]);
    expect(result.transition.companion.frames.flatMap(frame => frame.effects).filter(effect => effect.kind === "unit-destroy")).toHaveLength(2);
    expect(placementToMap(result.session.snapshot.placement).has("d5")).toBe(false);
    expect(events(result.session).filter(event => event.kind === "enemy-unit-destruction-witnessed")).toEqual([]);
    expect(result.session.recipients.w.batch.snapshot.cells.find(cell => cell.square === "d5")).toEqual({ square: "d5", visibility: "unknown" });
    expect(result.session.recipients.w.batch.snapshot.memory).toEqual([
      { square: "c4", piece: { type: "p", color: "b" }, observedTurn: 21 },
      { square: "d5", piece: { type: "q", color: "b" }, observedTurn: 21 },
    ]);
    expect(result.session.recipients.w.boundary.economicState.enemyLoss.confirmedUnitCount).toBe(0);
  });

  it("authorizes both sides' mutual C casualties from one live common preimage", () => {
    const result = run(board([["a1", "k", "w"], ["e2", "p", "w"], ["d3", "p", "b"], ["h8", "k", "b"]], 0),
      [move("w", "e2", "d3")], [move("b", "d3", "e2")]);
    expect(result.transition.companion.frames).toHaveLength(1);
    expect(result.transition.companion.frames[0].effects.map(effect => effect.kind)).toEqual(["unit-destroy", "unit-destroy"]);
    for (const side of ["w", "b"] as const) {
      expect(events(result.session, side).filter(event => event.kind === "own-unit-destroyed")).toHaveLength(1);
      expect(events(result.session, side).filter(event => event.kind === "enemy-unit-destruction-witnessed")).toHaveLength(1);
      expect(result.session.recipients[side].batch.snapshot.memory).toEqual([]);
      expect(result.session.recipients[side].boundary.economicState.enemyLoss.confirmedUnitCount).toBe(1);
    }
    expect(result.transition.companion.provenance.lastCall.consumedFacts).toEqual([]);
  });

  it("publishes no speculative image or stale afterMove board as a visibility boundary", () => {
    const result = run(board([["a1", "r", "w"], ["e1", "k", "w"], ["a6", "p", "b"], ["h8", "k", "b"]], 0), [move("w", "a1", "a8")]);
    const native = result.transition.companion.nativeResult;
    expect("resolved" in native && native.resolved.afterMove.placement).toBe(result.open.snapshot.placement);
    expect(result.transition.companion.visibilityImages).toHaveLength(2);
    expect(result.transition.companion.visibilityCheckpoints.map(checkpoint => checkpoint.point)).toEqual(["before-frame", "after-frame"]);
    expect(result.session.recipients.w.batch).toMatchObject({ ordinal: 2, phase: "settled", planningOrdinal: 1 });
    expect(targetFact(result.session, "a6", "p")).toHaveLength(1);
    const targetIndex = events(result.session).findIndex(event => event.kind === "vision-witness" && event.changes.length === 1 && event.changes[0].square === "a6");
    expect(events(result.session)[targetIndex + 1].kind).toBe("own-unit-moved");
    expect(events(result.session)[targetIndex + 2].kind).toBe("enemy-unit-destruction-witnessed");
    expect(events(result.session)[targetIndex + 3].kind).toBe("vision-witness");
  });
});

describe("R3 consumed proof integrity remains independent of structural validity", () => {
  it.each(["recipient", "operation", "frame", "causal", "evaluation", "applied", "descriptor", "query", "source"])("rejects rehashed forged %s authority from its own parent", variant => {
    const binding = {};
    const initial = initializeR3Session(binding, board([["a1", "r", "w"], ["e1", "k", "w"], ["a6", "p", "b"], ["c6", "p", "b"], ["h8", "k", "b"]]), { w: 12, b: 12 });
    const open = verifyAndCommitR3(binding, initial, stageR3Begin(binding, initial));
    const white = stageQueue(open.snapshot, open.bank, "w", [move("w", "a1", "a8")], 0);
    const black = stageQueue(open.snapshot, open.bank, "b", [], 0);
    if (!white.ok || !black.ok) throw new Error("fixture admission");
    const transition = stageR3Settlement(binding, open, { w: white.staged, b: black.staged });
    const bad = forged(transition, value => {
      const proof = value.companion.provenance.lastCall.consumedFacts[0];
      if (variant === "recipient") proof.side = "b";
      if (variant === "operation") proof.operation = "cc-shot";
      if (variant === "frame") proof.frameKey = "engine:call:2:frame:1";
      if (variant === "causal") proof.causalBeforeVisibilityKey = "engine:call:2:image:1";
      if (variant === "evaluation") proof.evaluationTargetId = value.companion.provenance.entities.find((entity: any) => entity.square === "c6").id;
      if (variant === "applied") proof.appliedTargetId = value.companion.provenance.entities.find((entity: any) => entity.square === "c6").id;
      if (variant === "descriptor") proof.targetCell.piece.type = "n";
      if (variant === "query") proof.queryOrdinal = 1;
      if (variant === "source") proof.sourceActionSeq = 1;
    });
    expect(() => verifyAndCommitR3(binding, open, bad)).toThrow("PROVENANCE");
    const completed = verifyAndCommitR3(binding, open, transition);
    expect(completed.recipients.w.boundary.economicState.enemyLoss.confirmedUnitCount).toBe(1);
    expect(events(completed).find(event => event.kind === "enemy-unit-destruction-witnessed")?.witnessId).toBe("w:witness:1");
  });
});
