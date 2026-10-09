import type { AuthorizedEvent, AuthorizedSnapshotV2, OwnUnitLineage } from "@chess-coach/starchess-arena/observations";
import type { ByteRef, EconomicArtifact, EconomicBeliefState, Meter, PublicOpening, Square } from "./contracts";
import { JOINT_SIZE } from "./contracts";
import { charge, fail } from "./work";
import { foldInnovations } from "./innovation";
import { currentBoardBounds, evaluateEconomic, expandComponents, rebandEconomic } from "./evaluator";
import { reduceSpatial } from "./spatial";

export type EconomicBoundaryInput = Readonly<{
  phase: "initial" | "turn-open" | "settled"; ordinal: number; planningOrdinal: number;
  seqBefore: number; seqThrough: number; boundaryRef: ByteRef;
  snapshot: AuthorizedSnapshotV2; events: readonly AuthorizedEvent[];
  priorOwnSquares: readonly Square[];
  priorOwnUnits: readonly OwnUnitLineage[];
}>;

export const initializeEconomicBelief = (opening: PublicOpening, boundary: EconomicBoundaryInput, artifact: EconomicArtifact, meter: Meter): EconomicBeliefState => {
  charge(meter, 64 + 2 * JOINT_SIZE, "$.belief.initialize");
  if (boundary.phase !== "initial" || boundary.ordinal !== 0 || boundary.planningOrdinal !== 0 || boundary.seqBefore !== 0 || boundary.snapshot.turn !== 0) fail("$.belief.initial", "SEQUENCE");
  const side = boundary.snapshot.side, enemy = side === "w" ? "b" : "w";
  const joint = new Float64Array(JOINT_SIZE), publicSupport = new Array<boolean>(JOINT_SIZE).fill(false);
  joint[577 * 3 + 4] = 1; publicSupport[577 * 3 + 4] = true;
  const spatial = reduceSpatial({ phase: "initial", side, gas: 1, canBirth: false, enemyCC: [opening.cc[enemy]], witnessed: [],
    unlocated: opening.marines[enemy], cells: boundary.snapshot.cells, anchors: [], geometry: [] }, meter);
  const evaluated = evaluateEconomic({ joint, publicSupport, tables: artifact.tables, inputTurn: 0, turn: 0, gas: 1,
    boundsBefore: currentBoardBounds(boundary.snapshot.cells, side, meter), bounds: currentBoardBounds(boundary.snapshot.cells, side, meter),
    loss: 0, grant: false, innovation: [0, 0, 0], settled: false }, meter);
  const components = rebandEconomic(evaluated.joint, meter);
  charge(meter, 32, "$.belief.initialOutput");
  return { version: "challenge-enemy-economic-belief-v1", side, ordinal: 0, seqThrough: boundary.seqThrough, planningOrdinal: 0,
    turn: 0, boundaryRef: boundary.boundaryRef, cells: boundary.snapshot.cells, memory: boundary.snapshot.memory,
    ...spatial, components, publicSupport: evaluated.publicSupport };
};

export const reduceEconomicBelief = (state: EconomicBeliefState, boundary: EconomicBoundaryInput, artifact: EconomicArtifact, meter: Meter): EconomicBeliefState => {
  charge(meter, 70, "$.belief.sequence");
  if (boundary.snapshot.side !== state.side) fail("$.belief.side", "SIDE");
  if (boundary.ordinal === state.ordinal) {
    if (boundary.boundaryRef.byteLength !== state.boundaryRef.byteLength || boundary.boundaryRef.sha256 !== state.boundaryRef.sha256) fail("$.belief.replay", "DUPLICATE");
    return state;
  }
  const settled = boundary.phase === "settled";
  if (boundary.phase === "initial" || boundary.ordinal !== state.ordinal + 1 || boundary.seqBefore !== state.seqThrough ||
      boundary.planningOrdinal !== state.planningOrdinal + (settled ? 1 : 0) || boundary.snapshot.turn < state.turn) fail("$.belief.boundary", "SEQUENCE");
  charge(meter, 16 + boundary.snapshot.own.pieces.length * 16 + boundary.snapshot.own.mines.length * 4, "$.belief.ownGeometry");
  const currentOwn: Square[] = [];
  for (const item of boundary.snapshot.own.pieces) if (item.piece.type !== "k") currentOwn.push(item.square);
  for (const square of boundary.snapshot.own.mines) currentOwn.push(square);
  const innovation = foldInnovations({ side: state.side, previousTurn: state.turn, turn: boundary.snapshot.turn,
    seqBefore: boundary.seqBefore, seqThrough: boundary.seqThrough, cells: state.cells, memory: state.memory,
    events: boundary.events, finalCells: boundary.snapshot.cells, priorOwn: boundary.priorOwnSquares, currentOwn, priorUnits: boundary.priorOwnUnits }, meter);
  charge(meter, 20 + 26 * boundary.snapshot.memory.length, "$.belief.memory");
  if (innovation.grant !== settled || innovation.memory.length !== boundary.snapshot.memory.length) fail("$.belief.projection", "CONSISTENCY");
  for (let i = 0; i < innovation.memory.length; i++) {
    const actual = innovation.memory[i]!, expected = boundary.snapshot.memory[i]!;
    if (actual.square !== expected.square || actual.piece.type !== expected.piece.type || actual.piece.color !== expected.piece.color || actual.observedTurn !== expected.observedTurn) fail("$.belief.memory", "CONSISTENCY");
  }
  const before = currentBoardBounds(state.cells, state.side, meter), bounds = currentBoardBounds(boundary.snapshot.cells, state.side, meter);
  const joint = expandComponents(state.components, meter);
  const evaluated = evaluateEconomic({ joint, publicSupport: state.publicSupport, tables: artifact.tables, inputTurn: state.turn,
    turn: boundary.snapshot.turn, gas: state.turn <= 10 ? 1 : state.turn <= 20 ? 2 : 3, boundsBefore: before, bounds,
    loss: innovation.loss, grant: innovation.grant, innovation: innovation.code, settled }, meter);
  charge(meter, 10 + 10 * JOINT_SIZE, "$.belief.birthBank");
  let canBirth = false;
  for (let bank = 1; bank <= 12; bank++) for (let d = 0; d <= 576; d++) if (state.publicSupport[577 * bank + d]) canBirth = true;
  const spatial = reduceSpatial({ phase: boundary.phase, side: state.side, gas: state.turn <= 10 ? 1 : state.turn <= 20 ? 2 : 3, canBirth,
    enemyCC: state.enemyCC, witnessed: state.witnessed, unlocated: state.unlocated, cells: boundary.snapshot.cells,
    anchors: innovation.anchors, geometry: innovation.geometry }, meter);
  const components = rebandEconomic(evaluated.joint, meter);
  charge(meter, 32, "$.belief.output");
  return { version: state.version, side: state.side, ordinal: boundary.ordinal, seqThrough: boundary.seqThrough,
    planningOrdinal: boundary.planningOrdinal, turn: boundary.snapshot.turn, boundaryRef: boundary.boundaryRef,
    cells: boundary.snapshot.cells, memory: innovation.memory, ...spatial, components, publicSupport: evaluated.publicSupport };
};
