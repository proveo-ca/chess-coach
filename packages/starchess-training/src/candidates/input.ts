// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import { validateObservationV1, type AuthorizedObservationV1 } from "@chess-coach/starchess-arena/observations";
import type { PlanningKnowledge, Square } from "@chess-coach/starchess-core";

export const SQUARES: readonly Square[] = Object.freeze(
  Array.from({ length: 64 }, (_, index) => `${"abcdefgh"[Math.floor(index / 8)]}${index % 8 + 1}` as Square),
);

export type CandidateInput = {
  observation: AuthorizedObservationV1;
  knowledge: PlanningKnowledge;
};

export const candidateInput = (value: AuthorizedObservationV1): CandidateInput => {
  const observation = validateObservationV1(value);
  const knownPieces = new Map(observation.cells.flatMap((cell) =>
    cell.visibility !== "unknown" && cell.piece ? [[cell.square, cell.piece] as const] : []));
  return {
    observation,
    knowledge: {
      side: observation.side,
      knownPieces,
      unknownSquares: new Set(observation.cells.filter((cell) => cell.visibility === "unknown").map((cell) => cell.square)),
      ownMines: new Set(observation.own.mines),
      ownSiegedTanks: new Set(observation.own.siegedTanks),
    },
  };
};
