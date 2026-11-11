// SPEC: _spec/candidate-generation.puml
import { decodeCandidate, decodeObservation } from "@chess-coach/contracts";
import type { Candidate, Observation } from "@chess-coach/contracts";
import { MAX_GAME_TURNS, MAX_MINES_PER_SIDE, UNIT_COST, appendTimeSpecialAnchor, charonDiagonalSquaresFromSquare,
  classicalActorAt, classicalRewriteCoordinatesAfterB, isScMoveShape, knownAppendFailure, marineSingleTarget,
  nativeClassicalChecks, spawnCCAnchorFromMap, specialGasCost, sq } from "@chess-coach/game-core";
import type { PlanningKnowledge, ScAction, Square } from "@chess-coach/game-core";

export const ENUMERATION_VERSION = "chess-coach.enumeration.v1";
export const MAX_CANDIDATES = 512;
export const MAX_CANDIDATE_ACTIONS = 4;
export const MAX_CANDIDATE_EXTENSIONS = 4096;
type Action = Candidate["actions"][number];
type Kind = Action["kind"];
const KINDS: readonly Kind[] = ["classical", "deploy", "stimStep", "spiderMine", "charonMissiles", "siegeMode", "tacticalJump"];
const SQUARES = Array.from({ length: 64 }, (_, index) => sq(Math.floor(index / 8), index % 8 + 1)!);
const BLACK_SQUARES = SQUARES.map(at => `${at[0]}${9 - Number(at[1])}` as Square);
const UNITS = ["p", "n", "b", "r", "q"] as const;
const PROMOTIONS = ["n", "b", "r", "q"] as const;
const ACTORS = { deploy: "k", stimStep: "p", spiderMine: "n", charonMissiles: "b", siegeMode: "r", tacticalJump: "q" } as const;

function* family(knowledge: PlanningKnowledge, prefix: readonly Action[], kind: Kind): Generator<Action> {
  const { side, knownPieces } = knowledge;
  const squares = side === "w" ? SQUARES : BLACK_SQUARES;
  const lastRank = side === "w" ? "8" : "1";
  if (kind === "classical" && prefix.some(action => action.kind === "classical")) return;
  for (const from of squares) {
    if (kind === "classical") {
      const actor = classicalActorAt(knownPieces, prefix, side, from);
      if (!actor) continue;
      for (const to of squares) {
        if (!isScMoveShape(actor.type, from, to, side)) continue;
        const action = { kind, timing: "C", color: side, from, to } as const;
        const rewrite = actor.type === "p" ? classicalRewriteCoordinatesAfterB(prefix, action) : null;
        if (actor.type === "p" && (to[1] === lastRank || rewrite?.to[1] === lastRank)) {
          for (const promotion of PROMOTIONS) yield { ...action, promotion };
        } else yield action;
      }
      continue;
    }
    const actor = knownPieces.get(from);
    if (actor?.color !== side || actor.type !== ACTORS[kind] || prefix.some(action => action.kind !== "classical" && action.from === from)) continue;
    for (const timing of ["B", "F"] as const) {
      const base = { timing, color: side, from };
      switch (kind) {
        case "deploy": {
          const { commandCenter, allyOccupied } = spawnCCAnchorFromMap(knownPieces, side, timing, prefix);
          if (!commandCenter) break;
          for (const to of squares) {
            if (to === commandCenter || allyOccupied.has(to) ||
              Math.abs(to.charCodeAt(0) - commandCenter.charCodeAt(0)) > 1 ||
              Math.abs(Number(to[1]) - Number(commandCenter[1])) > 1) continue;
            for (const unit of UNITS) yield { kind, ...base, to, unit };
          }
          break;
        }
        case "stimStep": {
          const to = marineSingleTarget(from, side);
          if (!to) break;
          if (to[1] === lastRank) {
            for (const promotion of PROMOTIONS) yield { kind, ...base, to, promotion };
          } else yield { kind, ...base, to };
          break;
        }
        case "spiderMine":
        case "siegeMode":
          yield { kind, ...base };
          break;
        case "charonMissiles": {
          const targets = new Set(charonDiagonalSquaresFromSquare(appendTimeSpecialAnchor(prefix, side, from, timing)));
          for (const to of squares) if (targets.has(to)) yield { kind, ...base, to };
          break;
        }
        case "tacticalJump":
          for (const to of squares) if (to !== from && !knownPieces.has(to)) yield { kind, ...base, to };
          break;
      }
    }
  }
}

function* extensions(knowledge: PlanningKnowledge, prefix: readonly Action[]): Generator<Action> {
  const cursors = KINDS.map(kind => family(knowledge, prefix, kind));
  try {
    while (cursors.length) {
      const cursor = cursors.shift()!;
      const next = cursor.next();
      if (next.done) continue;
      cursors.push(cursor);
      yield next.value;
    }
  } finally { for (const cursor of cursors) cursor.return(undefined); }
}

function permitted(observation: Observation, knowledge: PlanningKnowledge, prefix: readonly Action[], action: Action): boolean {
  if (knownAppendFailure(knowledge, prefix, action)) return false;
  const actions = [...prefix, action];
  let minerals = 0, gas = 0;
  for (const value of actions) {
    if (value.kind !== "classical") gas += specialGasCost(value.kind);
    if (value.kind === "deploy") minerals += UNIT_COST[value.unit];
  }
  if (minerals > observation.own.minerals || gas > observation.own.gas) return false;
  const mineAnchors = actions.filter(value => value.kind === "spiderMine").map(value =>
    appendTimeSpecialAnchor(actions, observation.side, value.from, value.timing));
  if (observation.own.mines.length + mineAnchors.length > MAX_MINES_PER_SIDE ||
    new Set(mineAnchors).size !== mineAnchors.length || mineAnchors.some(at => knowledge.ownMines.has(at))) return false;
  const sequenced: ScAction[] = actions.map((value, seq) => ({ ...value, seq }));
  const context = {
    ownUnits: new Map(observation.own.pieces.map(entry => [entry.square, entry.piece])),
    ownSieged: knowledge.ownSiegedTanks,
  };
  for (const value of sequenced) {
    if (value.timing !== "C") continue;
    const checks = nativeClassicalChecks(context, sequenced, value);
    for (const checked of [checks.insertion, checks.resulting]) {
      if (checked.diagnostic) return false;
      if (checked.actor?.type === "p" && value.to[1] === (observation.side === "w" ? "8" : "1") && !value.promotion) return false;
      if (checked.actor?.type === "r" && checked.sieged.has(checked.from)) {
        const destination = knowledge.knownPieces.get(value.to);
        if (destination?.color === observation.side || (!destination && knowledge.ownMines.has(value.to))) return false;
      }
    }
  }
  return true;
}

export type CandidateBatch = {
  readonly version: typeof ENUMERATION_VERSION;
  readonly candidates: readonly Candidate[];
  readonly attemptedExtensions: number;
  readonly rejectedExtensions: number;
  readonly duplicateExtensions: number;
  readonly stopReason: "capacity" | "attempts" | "exhausted" | "terminal";
};

export function enumerateCandidates(observationJson: string): CandidateBatch {
  const observation = decodeObservation(observationJson);
  const knowledge: PlanningKnowledge = {
    side: observation.side,
    knownPieces: new Map(observation.cells.flatMap(cell => cell.visibility !== "unknown" && cell.piece ? [[cell.square, cell.piece] as const] : [])),
    unknownSquares: new Set(observation.cells.filter(cell => cell.visibility === "unknown").map(cell => cell.square)),
    ownMines: new Set(observation.own.mines), ownSiegedTanks: new Set(observation.own.siegedTanks),
  };
  const pass = decodeCandidate(JSON.stringify({ version: "chess-coach.candidate.v1", actions: [] }), observation.side);
  if (observation.own.ccLives === 0 || observation.turn >= MAX_GAME_TURNS) return Object.freeze({
    version: ENUMERATION_VERSION, candidates: Object.freeze([pass]), attemptedExtensions: 0,
    rejectedExtensions: 0, duplicateExtensions: 0, stopReason: "terminal",
  });
  const candidates = [pass];
  const seen = new Set([JSON.stringify(pass.actions)]);
  type Node = { actions: readonly Action[]; cursor: Generator<Action> };
  const levels: Node[][] = Array.from({ length: MAX_CANDIDATE_ACTIONS }, () => []);
  levels[0]!.push({ actions: [], cursor: extensions(knowledge, []) });
  let attemptedExtensions = 0, rejectedExtensions = 0, duplicateExtensions = 0, depth = 0;
  try {
    while (attemptedExtensions < MAX_CANDIDATE_EXTENSIONS && candidates.length < MAX_CANDIDATES && levels.some(level => level.length)) {
      const level = levels[depth]!;
      depth = (depth + 1) % MAX_CANDIDATE_ACTIONS;
      const node = level.shift();
      if (!node) continue;
      const next = node.cursor.next();
      if (next.done) continue;
      level.push(node);
      attemptedExtensions++;
      if (!permitted(observation, knowledge, node.actions, next.value)) { rejectedExtensions++; continue; }
      const candidate = decodeCandidate(JSON.stringify({ version: "chess-coach.candidate.v1", actions: [...node.actions, next.value] }), observation.side);
      const key = JSON.stringify(candidate.actions);
      if (seen.has(key)) { duplicateExtensions++; continue; }
      seen.add(key);
      candidates.push(candidate);
      if (candidate.actions.length < MAX_CANDIDATE_ACTIONS) levels[candidate.actions.length]!.push({ actions: candidate.actions, cursor: extensions(knowledge, candidate.actions) });
    }
  } finally {
    for (const level of levels) for (const node of level) node.cursor.return(undefined);
  }
  return Object.freeze({
    version: ENUMERATION_VERSION, candidates: Object.freeze(candidates), attemptedExtensions, rejectedExtensions, duplicateExtensions,
    stopReason: candidates.length === MAX_CANDIDATES ? "capacity" : attemptedExtensions === MAX_CANDIDATE_EXTENSIONS ? "attempts" : "exhausted",
  });
}
