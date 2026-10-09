import type { AuthorizedEvent, ObservedCell, Sighting, UnitType } from "@chess-coach/starchess-arena/observations";
import type { Cells, Memory, Meter, Side, Square } from "./contracts";
import { charge, fail } from "./work";

export const replacement = (type: UnitType): number =>
  type === "k" ? 0 : type === "p" ? 1 : type === "n" || type === "b" ? 3 : type === "r" ? 5 : 9;

export type Innovation = Readonly<{
  values: readonly [number, number, number]; code: readonly [number, number, number];
  loss: number; grant: boolean; anchors: readonly Square[]; geometry: readonly Square[];
  cells: Cells; memory: Memory;
}>;
export type InnovationInput = Readonly<{
  side: Side; previousTurn: number; turn: number; seqBefore: number; seqThrough: number;
  cells: Cells; memory: Memory; events: readonly AuthorizedEvent[]; finalCells: Cells;
  priorOwn: readonly Square[]; currentOwn: readonly Square[];
}>;

export const foldInnovations = (input: InnovationInput, meter: Meter): Innovation => {
  charge(meter, 30 + 32 * (input.cells.length + input.memory.length + input.priorOwn.length + input.currentOwn.length), "$.innovation.seed");
  const cells = new Map<Square, ObservedCell>();
  const memory = new Map<Square, Sighting>();
  const assertions = new Set<string>();
  const losses = new Set<string>();
  const clears = new Set<Square>();
  const anchors = new Set<Square>();
  const geometry = new Set<Square>();
  for (const cell of input.cells) cells.set(cell.square, cell);
  for (const sighting of input.memory) {
    memory.set(sighting.square, sighting);
    assertions.add(`${sighting.square}:${sighting.piece.type}:${sighting.observedTurn}`);
  }
  for (const square of input.priorOwn) geometry.add(square);
  for (const square of input.currentOwn) geometry.add(square);
  let y1 = 0, y2 = 0, grant = false, lastTurn = input.previousTurn;
  const observe = (changes: Cells, turn: number): void => {
    charge(meter, 8 + 100 * changes.length, "$.innovation.observe");
    for (const cell of changes) {
      const old = cells.get(cell.square);
      if (cell.visibility !== "unknown" && cell.piece?.color === input.side && cell.piece.type !== "k") geometry.add(cell.square);
      if (cell.visibility === "lit" && cell.piece === null && memory.has(cell.square)) clears.add(cell.square);
      if (cell.visibility !== "unknown" && cell.piece?.color !== input.side && cell.piece !== null) {
        const key = `${cell.square}:${cell.piece.type}:${turn}`;
        const same = old?.visibility !== "unknown" && old !== undefined && old.piece !== null &&
          old.piece.type === cell.piece.type && old.piece.color === cell.piece.color;
        if (!same && !assertions.has(key)) {
          assertions.add(key);
          y1 += replacement(cell.piece.type);
          if (cell.piece.type === "p") anchors.add(cell.square);
        }
        memory.set(cell.square, { square: cell.square, piece: cell.piece, observedTurn: turn });
      } else if (cell.visibility === "lit") memory.delete(cell.square);
      cells.set(cell.square, cell);
    }
  };
  charge(meter, 10 + 48 * input.events.length, "$.innovation.events");
  if (input.seqThrough !== input.seqBefore + input.events.length) fail("$.innovation.seqThrough", "SEQUENCE");
  for (let i = 0; i < input.events.length; i++) {
    const event = input.events[i]!;
    if (event.seq !== input.seqBefore + i + 1) fail("$.innovation.events.seq", "SEQUENCE");
    if (event.kind === "vision-witness") {
      if (event.turn < lastTurn || event.turn > input.turn) fail("$.innovation.events.turn", "SEQUENCE");
      lastTurn = event.turn;
      observe(event.changes, event.turn);
    } else if (event.kind === "enemy-unit-destruction-witnessed") {
      if (losses.has(event.witnessId)) fail("$.innovation.witnessId", "DUPLICATE");
      losses.add(event.witnessId);
      if (event.replacementLowerBound !== replacement(event.type)) fail("$.innovation.loss", "DERIVED");
      y2 += event.replacementLowerBound;
      if (memory.get(event.square)?.piece.type === event.type) memory.delete(event.square);
    } else if (event.kind === "own-income") {
      if (grant || i !== input.events.length - 1) fail("$.innovation.grant", "DUPLICATE");
      grant = true;
    } else if (event.kind === "own-unit-moved") {
      geometry.add(event.from); geometry.add(event.to);
    } else if (event.kind === "own-unit-created" || event.kind === "own-unit-endowed" || event.kind === "own-unit-destroyed") {
      if ((event.kind === "own-unit-destroyed" ? event.typeAtLoss : event.type) !== "k") geometry.add(event.square);
    } else if (event.kind === "own-mine-created" || event.kind === "own-mine-endowed") geometry.add(event.square);
  }
  observe(input.finalCells, input.turn);
  charge(meter, 64 * 40 + 100, "$.innovation.output");
  const orderedCells: ObservedCell[] = [], orderedMemory: Sighting[] = [];
  const orderedAnchors: Square[] = [], orderedGeometry: Square[] = [];
  for (let file = 0; file < 8; file++) for (let rank = 1; rank <= 8; rank++) {
    const square = `${String.fromCharCode(97 + file)}${rank}` as Square;
    const cell = cells.get(square), sighting = memory.get(square);
    if (!cell) fail("$.innovation.cells", "CARDINALITY");
    orderedCells.push(cell);
    if (sighting) orderedMemory.push(sighting);
    if (anchors.has(square)) orderedAnchors.push(square);
    if (geometry.has(square)) orderedGeometry.push(square);
  }
  const bin = (value: number): number => value === 0 ? 0 : value <= 3 ? 1 : value <= 8 ? 2 : 3;
  return { values: [y1, y2, clears.size], code: [bin(y1), bin(y2), clears.size === 0 ? 0 : clears.size === 1 ? 1 : 2],
    loss: y2, grant, anchors: orderedAnchors, geometry: orderedGeometry, cells: orderedCells, memory: orderedMemory };
};
