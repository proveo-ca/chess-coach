// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import type { ScActionInput } from "@chess-coach/starchess-core/planning-v1";
import type { Cells, Meter, Side, Square } from "./contracts";
import { charge, fail } from "./work";
import { appendSquareSet64, beginSquareSet64, finishSquareSet64 } from "./ownedKernel";

export type MarineMacro = Readonly<{
  key: string; source: Square; destination: Square; promotion: "n" | "b" | "r" | "q" | null;
  path: readonly Square[]; actions: readonly ScActionInput[];
}>;
export type MacroOptions = Readonly<{ gas: number; classical?: boolean; specials?: boolean; before?: boolean }>;
const coordinate = (file: number, rank: number): Square | null =>
  file >= 0 && file < 8 && rank >= 1 && rank <= 8 ? `${String.fromCharCode(97 + file)}${rank}` as Square : null;
const ordered = (set: ReadonlySet<Square>, meter: Meter): readonly Square[] => {
  charge(meter, 64 * 18 + 10, "$.spatial.ordered");
  const result = beginSquareSet64(meter);
  for (let file = 0; file < 8; file++) for (let rank = 1; rank <= 8; rank++) {
    const square = coordinate(file, rank)!;
    if (set.has(square)) appendSquareSet64(meter, result, square);
  }
  return finishSquareSet64(meter, result);
};
export const adjacentSquares = (squares: readonly Square[], ring: boolean, meter: Meter): readonly Square[] => {
  charge(meter, 20 + squares.length * (20 + 9 * 30), "$.spatial.adjacent");
  const result = new Set<Square>();
  for (const square of squares) {
    const file = square.charCodeAt(0) - 97, rank = Number(square[1]);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      if (ring && dx === 0 && dy === 0) continue;
      const target = coordinate(file + dx, rank + dy);
      if (target) result.add(target);
    }
  }
  return ordered(result, meter);
};
export const pruneSpatial = (squares: readonly Square[], cells: Cells, side: Side, type: "p" | "k", meter: Meter): readonly Square[] => {
  charge(meter, 20 + 12 * cells.length + 22 * squares.length, "$.spatial.prune");
  const map = new Map(cells.map(cell => [cell.square, cell]));
  const result = new Set<Square>();
  for (const square of squares) {
    const cell = map.get(square);
    if (!cell) return fail("$.spatial.cells", "CARDINALITY");
    if (cell.visibility === "unknown" || (cell.piece?.color !== side && cell.piece?.type === type)) result.add(square);
  }
  return ordered(result, meter);
};

type CompiledMarineMacro = MarineMacro & Readonly<{ diagonalTarget: Square | null }>;
const compileMarineOpportunity = (source: Square, side: Side, options: MacroOptions): readonly CompiledMarineMacro[] => {
  const result: CompiledMarineMacro[] = [];
  const file = source.charCodeAt(0) - 97, rank = Number(source[1]), direction = side === "w" ? 1 : -1, last = side === "w" ? 8 : 1;
  const step = coordinate(file, rank + direction);
  for (let b = 0; b <= 1; b++) for (let c = 0; c < 5; c++) for (let f = 0; f <= 1; f++) {
    if ((b && f) || b + f > options.gas || (b && options.before === false) || ((b || f) && options.specials === false) || (c && options.classical === false)) continue;
    const bindings = b && c ? 2 : 1, orders = f && c ? 2 : 1;
    for (let binding = 0; binding < bindings; binding++) for (let order = 0; order < orders; order++) {
      if ((b || f) && !step) continue;
      let position = b ? step! : source;
      const path: Square[] = [], actions: ScActionInput[] = [];
      if (b) path.push(position);
      const origin = b && binding === 1 ? step! : source;
      const originRank = Number(origin[1]);
      const double = side === "w" ? originRank <= 2 : originRank >= 7;
      if (c === 2 && !double) continue;
      const dx = c === 3 ? -1 : c === 4 ? 1 : 0;
      const distance = c === 2 ? 2 : 1;
      const authoredC = c ? coordinate(origin.charCodeAt(0) - 97 + dx, originRank + direction * distance) : null;
      if (c && !authoredC) continue;
      const rewritten = b && binding === 0 && c > 0 && c < 3;
      const actualC = c ? (rewritten ? coordinate(file, rank + direction * (distance + 1)) : authoredC) : null;
      if (c && !actualC) continue;
      const moverC = !(b && binding === 0 && c >= 3);
      const afterC = c && moverC ? actualC! : position;
      const actualF = f ? coordinate(afterC.charCodeAt(0) - 97, Number(afterC[1]) + direction) : null;
      if (f && !actualF) continue;
      if (f && c && order === 0 && Number(actualF![1]) === last) continue;
      const bPromotes = !!b && Number(step![1]) === last;
      const cPromotes = !!c && moverC && Number(actualC![1]) === last;
      const fPromotes = !!f && Number(actualF![1]) === last && Number(step![1]) === last;
      const promotionEvent = bPromotes || cPromotes || fPromotes;
      const alternatives: readonly ("n" | "b" | "r" | "q" | null)[] = promotionEvent ? ["n", "b", "r", "q"] : [null];
      if (c && moverC && !bPromotes) {
        if (distance === 2) path.push(coordinate(afterC.charCodeAt(0) - 97, Number(afterC[1]) - direction)!);
        path.push(actualC!); position = actualC!;
      }
      if (f && !bPromotes && !cPromotes) { path.push(actualF!); position = actualF!; }
      for (const promotion of alternatives) {
        const bAction: ScActionInput | null = b ? { kind: "stimStep", timing: "B", color: side, from: source, to: step!, ...(bPromotes ? { promotion: promotion! } : {}) } : null;
        const cAction: ScActionInput | null = c ? { kind: "classical", timing: "C", color: side, from: origin, to: authoredC!, ...(cPromotes ? { promotion: promotion! } : {}) } : null;
        const fAction: ScActionInput | null = f ? { kind: "stimStep", timing: "F", color: side, from: source, to: step!, ...(fPromotes ? { promotion: promotion! } : {}) } : null;
        actions.length = 0;
        if (bAction) actions.push(bAction);
        if (order === 1 && fAction) actions.push(fAction);
        if (cAction && !bPromotes) actions.push(cAction);
        if (order === 0 && fAction && !cPromotes) actions.push(fAction);
        result.push(Object.freeze({ key: `${b}:${c}:${f}:${binding}:${order}:${promotion ?? "p"}`, source, destination: position, promotion,
          path: Object.freeze([...path]), actions: Object.freeze(actions.map(action => Object.freeze(action))), diagonalTarget: c >= 3 ? authoredC : null }));
      }
    }
  }
  return Object.freeze(result);
};
const COMPILED_MARINES = new Map<string, readonly CompiledMarineMacro[]>();
for (const side of ["w", "b"] as const) for (let f = 0; f < 8; f++) for (let r = 1; r <= 8; r++) for (let gas = 0; gas <= 1; gas++) for (let flags = 0; flags < 8; flags++) {
  const source = coordinate(f, r)!;
  COMPILED_MARINES.set(`${side}:${source}:${gas}:${flags}`, compileMarineOpportunity(source, side, { gas, classical: !!(flags & 1), specials: !!(flags & 2), before: !!(flags & 4) }));
}
export const marineOpportunity = (source: Square, side: Side, diagonal: ReadonlySet<Square>, options: MacroOptions, meter: Meter): readonly MarineMacro[] => {
  charge(meter, 32, "$.spatial.macro.compiled");
  if (!Number.isInteger(options.gas) || options.gas < 0 || options.gas > 3) fail("$.spatial.gas", "NUMBER");
  const flags = Number(options.classical !== false) + 2 * Number(options.specials !== false) + 4 * Number(options.before !== false);
  const macros = COMPILED_MARINES.get(`${side}:${source}:${Number(options.gas > 0)}:${flags}`)!;
  charge(meter, 8 + 10 * macros.length, "$.spatial.macro.visits");
  const result: MarineMacro[] = [];
  for (const macro of macros) if (macro.diagonalTarget === null || diagonal.has(macro.diagonalTarget)) result.push(macro);
  return result;
};

export type SpatialInput = Readonly<{
  phase: "initial" | "turn-open" | "settled"; side: Side; gas: number; canBirth: boolean;
  enemyCC: readonly Square[]; witnessed: readonly Square[]; unlocated: readonly Square[];
  cells: Cells; anchors: readonly Square[]; geometry: readonly Square[];
}>;
export type SpatialResult = Readonly<{ enemyCC: readonly Square[]; witnessed: readonly Square[]; unlocated: readonly Square[] }>;
export const reduceSpatial = (input: SpatialInput, meter: Meter): SpatialResult => {
  charge(meter, 40 + 10 * (input.geometry.length + input.witnessed.length + input.unlocated.length), "$.spatial.seed");
  const diagonal = new Set(input.geometry), p0 = new Set([...input.witnessed, ...input.unlocated]);
  const w = new Set<Square>(), u = new Set<Square>();
  const kraw = input.phase === "settled" ? adjacentSquares(input.enemyCC, false, meter) : input.enemyCC;
  const enemyCC = pruneSpatial(kraw, input.cells, input.side, "k", meter);
  charge(meter, 4, "$.spatial.cc");
  if (enemyCC.length === 0) fail("$.spatial.enemyCC", "CONSISTENCY");
  const enemy = input.side === "w" ? "b" : "w";
  const propagate = (sources: readonly Square[], target: Set<Square>, options: MacroOptions, retain: boolean): void => {
    charge(meter, 12 + 12 * sources.length, "$.spatial.propagate");
    for (const source of sources) {
      if (retain) target.add(source);
      const macros = marineOpportunity(source, enemy, diagonal, options, meter);
      charge(meter, 8 + 10 * macros.length, "$.spatial.macroUnion");
      for (const macro of macros) if (macro.promotion === null) target.add(macro.destination);
    }
  };
  if (input.phase === "settled") {
    propagate(input.witnessed, w, { gas: input.gas }, false);
    propagate(input.unlocated, u, { gas: input.gas }, false);
    propagate(input.anchors, w, { gas: input.gas }, true);
    if (input.canBirth && input.gas >= 1) {
      const b = adjacentSquares(input.enemyCC, true, meter), f = adjacentSquares(kraw, true, meter);
      charge(meter, 20 + 26 * (b.length + f.length), "$.spatial.births");
      for (const square of b) {
        if (Number(square[1]) === (enemy === "w" ? 8 : 1)) continue;
        propagate([square], u, { gas: input.gas - 1, specials: p0.has(square) }, true);
      }
      for (const square of f) {
        if (Number(square[1]) === (enemy === "w" ? 8 : 1)) continue;
        u.add(square);
        if (p0.has(square)) propagate([square], u, { gas: input.gas - 1, classical: false, before: false }, true);
      }
    }
  } else {
    charge(meter, 10 + 8 * (input.witnessed.length + input.unlocated.length + input.anchors.length), "$.spatial.stationary");
    for (const square of input.witnessed) w.add(square);
    for (const square of input.unlocated) u.add(square);
    for (const square of input.anchors) w.add(square);
  }
  charge(meter, 10 + 22 * input.cells.length, "$.spatial.observed");
  for (const cell of input.cells) if (cell.visibility !== "unknown" && cell.piece?.color === enemy && cell.piece.type === "p") {
    w.add(cell.square); u.delete(cell.square);
  }
  const witnessed = pruneSpatial(ordered(w, meter), input.cells, input.side, "p", meter);
  const unlocated = pruneSpatial(ordered(u, meter), input.cells, input.side, "p", meter);
  return { enemyCC, witnessed, unlocated };
};
