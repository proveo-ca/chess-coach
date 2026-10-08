// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import {
  appendTimeSpecialAnchor, charonDiagonalSquaresFromSquare, classicalActorAt,
  classicalRewriteCoordinatesAfterB, isScMoveShape, marineSingleTarget,
  spawnCCAnchorFromMap, type ScActionInput, type SpawnPiece,
} from "@chess-coach/starchess-core";
import { SQUARES, type CandidateInput } from "./input";
import { FAMILY_ORDER } from "./types";

const ALTERNATIVES: readonly SpawnPiece[] = Object.freeze(["p", "n", "b", "r", "q"]);
const SPECIAL_ACTORS = { deploy: "k", stimStep: "p", spiderMine: "n", charonMissiles: "b", siegeMode: "r", tacticalJump: "q" } as const;

export function* primitiveIntents(input: CandidateInput, prefix: readonly ScActionInput[]): Generator<ScActionInput> {
  const { side, knownPieces } = input.knowledge;
  const lastRank = side === "w" ? "8" : "1";
  for (const kind of FAMILY_ORDER) {
    for (const from of SQUARES) {
      if (kind === "classical") {
        const actor = classicalActorAt(knownPieces, prefix, side, from);
        if (!actor) continue;
        for (const to of SQUARES) {
          if (!isScMoveShape(actor.type, from, to, side)) continue;
          const base: Extract<ScActionInput, { timing: "C" }> = { kind, timing: "C", color: side, from, to };
          const rewritten = classicalRewriteCoordinatesAfterB(prefix, base);
          if (actor.type === "p" && (to[1] === lastRank || rewritten?.to[1] === lastRank)) {
            for (const promotion of ALTERNATIVES) yield { ...base, promotion };
          } else yield base;
        }
        continue;
      }
      const actor = knownPieces.get(from);
      if (actor?.color !== side || actor.type !== SPECIAL_ACTORS[kind]) continue;
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
              for (const unit of ALTERNATIVES) yield { ...base, to, unit };
            }
            break;
          }
          case "stimStep": {
            const to = marineSingleTarget(from, side);
            if (!to) break;
            if (to[1] === lastRank) {
              for (const promotion of ALTERNATIVES) yield { ...base, to, promotion };
            } else yield { ...base, to };
            break;
          }
          case "charonMissiles": {
            const targets = new Set(charonDiagonalSquaresFromSquare(appendTimeSpecialAnchor(prefix, side, from, timing)));
            for (const to of SQUARES) if (targets.has(to)) yield { ...base, to };
            break;
          }
          case "tacticalJump":
            for (const to of SQUARES) if (to !== from && !knownPieces.has(to)) yield { ...base, to };
            break;
          case "spiderMine":
          case "siegeMode":
            yield base;
            break;
        }
      }
    }
  }
}
