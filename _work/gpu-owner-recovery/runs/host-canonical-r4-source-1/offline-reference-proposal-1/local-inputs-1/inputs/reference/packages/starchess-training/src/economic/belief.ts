// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import type { CheckedBoundary, EconomicArtifact, EconomicBeliefState, Meter, PublicOpening, Square } from "./contracts";
import { JOINT_SIZE } from "./contracts";
import { charge, fail } from "./work";
import { foldInnovations } from "./innovation";
import { currentBoardBounds, evaluateEconomic, expandComponents, rebandEconomic } from "./evaluator";
import { reduceSpatial } from "./spatial";
import { appendComponents247, appendConditional, appendPublicSupport7501, beginComponents247, beginConditional, beginPublicSupport7501,
  finishComponents247, finishConditional, finishPublicSupport7501, makeComponent, makeEconomicState, publicSupportCanBirth, type OwnedReductionInput } from "./ownedKernel";
import { encodeFloat64 } from "./float64";
import { requireArtifact, requireOpening, requireState } from "./ownedGuards";

export type EconomicBoundaryInput = OwnedReductionInput;

export const initializeEconomicBelief = (opening: PublicOpening, boundary: EconomicBoundaryInput, artifact: EconomicArtifact, meter: Meter, checked: CheckedBoundary): EconomicBeliefState => {
  charge(meter, 64, "$.belief.initialize");
  requireOpening(opening); requireArtifact(artifact);
  if (boundary.phase !== "initial" || boundary.ordinal !== 0 || boundary.planningOrdinal !== 0 || boundary.seqBefore !== 0 || boundary.snapshot.turn !== 0) fail("$.belief.initial", "SEQUENCE");
  const side = boundary.snapshot.side, enemy = side === "w" ? "b" : "w";
  const bounds = currentBoardBounds(boundary.snapshot.cells, side, meter);
  if (bounds.lower > 4 || bounds.upper < 4) fail("$.belief.initialSupport", "CONSISTENCY");
  const spatial = reduceSpatial({ phase: "initial", side, gas: 1, canBirth: false, enemyCC: [opening.cc[enemy]], witnessed: [],
    unlocated: opening.marines[enemy], cells: boundary.snapshot.cells, anchors: [], geometry: [] }, meter);
  const conditional = beginConditional(meter, 2);
  appendConditional(meter, conditional, encodeFloat64(1, meter)); appendConditional(meter, conditional, encodeFloat64(0, meter));
  const componentCursor = beginComponents247(meter);
  appendComponents247(meter, componentCursor, makeComponent(meter, 3, 4, encodeFloat64(1, meter), finishConditional(meter, conditional)));
  const components = finishComponents247(meter, componentCursor), support = beginPublicSupport7501(meter);
  charge(meter, 12 + 8 * JOINT_SIZE, "$.belief.initialSupport");
  for (let i = 0; i < JOINT_SIZE; i++) appendPublicSupport7501(meter, support, i === 577 * 3 + 4);
  charge(meter, 32, "$.belief.initialOutput");
  return makeEconomicState(meter, checked, side, 0, boundary.seqThrough, 0, 0, boundary.boundaryRef,
    boundary.snapshot.cells, boundary.snapshot.memory, spatial.witnessed, spatial.unlocated, spatial.enemyCC, components, finishPublicSupport7501(meter, support));
};

export const reduceEconomicBelief = (state: EconomicBeliefState, boundary: EconomicBoundaryInput, artifact: EconomicArtifact, meter: Meter, checked: CheckedBoundary): EconomicBeliefState => {
  charge(meter, 70, "$.belief.sequence");
  requireState(state); requireArtifact(artifact);
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
  const unchanged = !settled && before.lower === bounds.lower && before.upper === bounds.upper && innovation.code.every(value => value === 0);
  const evaluated = unchanged ? undefined : evaluateEconomic({ joint: expandComponents(state.components, meter), publicSupport: state.publicSupport, tables: artifact.tables, inputTurn: state.turn,
    turn: boundary.snapshot.turn, gas: state.turn <= 10 ? 1 : state.turn <= 20 ? 2 : 3, boundsBefore: before, bounds,
    loss: innovation.loss, grant: innovation.grant, innovation: innovation.code, settled }, meter);
  const canBirth = settled && publicSupportCanBirth(meter, state.publicSupport);
  const spatial = reduceSpatial({ phase: boundary.phase, side: state.side, gas: state.turn <= 10 ? 1 : state.turn <= 20 ? 2 : 3, canBirth,
    enemyCC: state.enemyCC, witnessed: state.witnessed, unlocated: state.unlocated, cells: boundary.snapshot.cells,
    anchors: innovation.anchors, geometry: innovation.geometry }, meter);
  const components = evaluated ? rebandEconomic(evaluated.joint, meter) : state.components;
  charge(meter, 32, "$.belief.output");
  return makeEconomicState(meter, checked, state.side, boundary.ordinal, boundary.seqThrough, boundary.planningOrdinal,
    boundary.snapshot.turn, boundary.boundaryRef, boundary.snapshot.cells, boundary.snapshot.memory,
    spatial.witnessed, spatial.unlocated, spatial.enemyCC, components, evaluated?.publicSupport ?? state.publicSupport);
};
