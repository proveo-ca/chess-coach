// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import type { AuthorizedObservationV1 } from "@chess-coach/starchess-arena/observations";
import { ACTION_KINDS, requestedSpend } from "@chess-coach/starchess-arena/intent-codec-v1";
import {
  appendTimeSpecialAnchor, charonDiagonalSquaresFromSquare, classicalActorAt,
  classicalRewriteCoordinatesAfterB, isScMoveShape, knownAppendFailure,
  marineSingleTarget, spawnCCAnchorFromMap,
  type PlanningKnowledge, type ScActionInput, type SpawnPiece, type Square,
} from "@chess-coach/starchess-core";
import type { CandidateKind, PruningReason } from "./contracts";

export const SQUARES: readonly Square[] = Object.freeze(
  Array.from({ length: 64 }, (_, i) => `${String.fromCharCode(97 + Math.floor(i / 8))}${i % 8 + 1}` as Square),
);
const UNITS: readonly SpawnPiece[] = ["p", "n", "b", "r", "q"];
const PROMOTIONS: readonly SpawnPiece[] = ["n", "b", "r", "q"];
const ACTORS = { deploy: "k", stimStep: "p", spiderMine: "n", charonMissiles: "b", siegeMode: "r", tacticalJump: "q" } as const;

export type PrefixState = {
  actions: readonly ScActionInput[];
  anchors: readonly Square[];
  mineAnchors: readonly Square[];
};
export const emptyPrefix = (): PrefixState => ({ actions: [], anchors: [], mineAnchors: [] });
export const planningKnowledge = (observation: AuthorizedObservationV1): PlanningKnowledge => ({
  side: observation.side,
  knownPieces: new Map(observation.cells.flatMap((cell) =>
    cell.visibility !== "unknown" && cell.piece ? [[cell.square, cell.piece] as const] : [])),
  unknownSquares: new Set(observation.cells.filter((cell) => cell.visibility === "unknown").map((cell) => cell.square)),
  ownMines: new Set(observation.own.mines),
  ownSiegedTanks: new Set(observation.own.siegedTanks),
});

export function* primitiveDomain(
  knowledge: PlanningKnowledge,
  state: PrefixState,
  onlyFamily?: CandidateKind,
): Generator<ScActionInput> {
  const { side, knownPieces } = knowledge;
  const prefix = state.actions;
  const lastRank = side === "w" ? "8" : "1";
  for (const kind of ACTION_KINDS) {
    if (onlyFamily && kind !== onlyFamily) continue;
    for (const from of SQUARES) {
      if (kind === "classical") {
        const actor = classicalActorAt(knownPieces, prefix, side, from);
        if (!actor) continue;
        for (const to of SQUARES) {
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
      if (actor?.color !== side || actor.type !== ACTORS[kind]) continue;
      for (const timing of ["B", "F"] as const) {
        const base = { kind, timing, color: side, from };
        switch (kind) {
          case "deploy": {
            const { commandCenter, allyOccupied } = spawnCCAnchorFromMap(knownPieces, side, timing, prefix);
            if (!commandCenter) break;
            for (const to of SQUARES) {
              if (to === commandCenter || allyOccupied.has(to) ||
                  Math.abs(to.charCodeAt(0) - commandCenter.charCodeAt(0)) > 1 ||
                  Math.abs(Number(to[1]) - Number(commandCenter[1])) > 1) continue;
              for (const unit of UNITS) yield { ...base, kind, to, unit };
            }
            break;
          }
          case "stimStep": {
            const to = marineSingleTarget(from, side);
            if (!to) break;
            if (to[1] === lastRank) {
              for (const promotion of PROMOTIONS) yield { ...base, kind, to, promotion };
            } else yield { ...base, kind, to };
            break;
          }
          case "spiderMine":
          case "siegeMode":
            yield { ...base, kind };
            break;
          case "charonMissiles": {
            const targets = new Set(charonDiagonalSquaresFromSquare(appendTimeSpecialAnchor(prefix, side, from, timing)));
            for (const to of SQUARES) if (targets.has(to)) yield { ...base, kind, to };
            break;
          }
          case "tacticalJump":
            for (const to of SQUARES) {
              if (to !== from && !knownPieces.has(to)) yield { ...base, kind, to };
            }
            break;
        }
      }
    }
  }
}

export const appendFailure = (
  observation: AuthorizedObservationV1,
  knowledge: PlanningKnowledge,
  state: PrefixState,
  action: ScActionInput,
): PruningReason | null => {
  const native = knownAppendFailure(knowledge, state.actions, action);
  if (native === "actor" || native === "shape" || native === "timing") return native;
  const spend = requestedSpend([...state.actions, action]);
  if (spend.minerals > observation.own.minerals || spend.gas > observation.own.gas) return "resources";
  if (action.kind === "spiderMine") {
    if (knowledge.ownMines.size + state.mineAnchors.length >= 3) return "mineCap";
    const anchor = appendTimeSpecialAnchor(state.actions, observation.side, action.from, action.timing);
    if (knowledge.ownMines.has(anchor) || state.mineAnchors.includes(anchor)) return "ownOccupancy";
  }
  return native;
};

export const appendState = (knowledge: PlanningKnowledge, state: PrefixState, action: ScActionInput): PrefixState => {
  const anchor = action.kind === "deploy"
    ? spawnCCAnchorFromMap(knowledge.knownPieces, knowledge.side, action.timing, state.actions).commandCenter!
    : action.timing === "C" ? action.from
    : appendTimeSpecialAnchor(state.actions, knowledge.side, action.from, action.timing);
  return {
    actions: [...state.actions, action],
    anchors: [...state.anchors, anchor],
    mineAnchors: action.kind === "spiderMine" ? [...state.mineAnchors, anchor] : state.mineAnchors,
  };
};
