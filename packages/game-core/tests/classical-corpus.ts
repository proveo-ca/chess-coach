// SPEC: _spec/classical-resolution.puml
import { getSideVision, isScMoveShape, mapToPlacement, sq } from "../src";
import type { ClassicalPlan, ResolveTurnInput, ScMine, ScPiece, Square, StarChessPiece } from "../src";

const PIECES: readonly StarChessPiece[] = ["p", "n", "b", "r", "q", "k"];
const SQUARES = Array.from({ length: 64 }, (_, index) => sq(Math.floor(index / 8), index % 8 + 1)!);
export const CLASSICAL_LAYOUTS: readonly (readonly [Square, Square])[] = [
  ["d3", "d5"], ["c3", "f6"], ["d4", "e4"], ["c7", "f2"], ["a7", "h2"], ["b2", "g7"],
];

export function* classicalCorpus(layout: number): Generator<ResolveTurnInput> {
  const [whiteFrom, blackFrom] = CLASSICAL_LAYOUTS[layout]!;
  for (const whiteType of PIECES) for (const blackType of PIECES) {
    const whiteTargets = SQUARES.filter(to => isScMoveShape(whiteType, whiteFrom, to, "w"));
    const blackTargets = SQUARES.filter(to => isScMoveShape(blackType, blackFrom, to, "b"));
    for (const whiteTo of [null, ...whiteTargets]) for (const blackTo of [null, ...blackTargets]) {
      for (let variant = 0; variant < 4; variant++) {
        const board = new Map<Square, ScPiece>();
        if (whiteType !== "k") board.set("a1", { type: "k", color: "w" });
        if (blackType !== "k") board.set("h8", { type: "k", color: "b" });
        board.set(whiteFrom, { type: whiteType, color: "w" });
        board.set(blackFrom, { type: blackType, color: "b" });
        if (variant === 2) {
          for (const [at, piece] of [["c4", { type: "r", color: "w" }], ["f4", { type: "q", color: "b" }]] as const) {
            if (!board.has(at)) board.set(at, piece);
          }
        }
        const placement = mapToPlacement(board);
        const mines: ScMine[] = variant === 1
          ? [{ color: "w", at: "d4" }, { color: "b", at: "d4" }, { color: "w", at: blackTo ?? blackFrom }, { color: "b", at: whiteTo ?? whiteFrom }]
          : variant === 3 ? [{ color: "b", at: "e3" }, { color: "w", at: "d6" }] : [];
        const siegedTanks = variant === 2 ? [whiteType === "r" ? whiteFrom : null, blackType === "r" ? blackFrom : null]
          .filter((at): at is Square => at !== null) : [];
        const options = { mines, tankModeFor: (at: Square) => siegedTanks.includes(at) ? "siege" as const : "tank" as const };
        const whiteVision = getSideVision(placement, "w", options), blackVision = getSideVision(placement, "b", options);
        const plan = (type: StarChessPiece, color: "w" | "b", from: Square, to: Square | null): ClassicalPlan | null => {
          if (!to) return null;
          const promotion = type === "p" && to[1] === (color === "w" ? "8" : "1")
            ? (["n", "b", "r", "q"] as const)[(to.charCodeAt(0) + layout) % 4] : undefined;
          return { color, from, to, ...(promotion ? { promotion } : {}),
            ...(variant === 2 && type === "p" ? { extraStepFrom: from } : {}),
            ...(variant === 3 && type === "p" ? { extraStepTo: to } : {}) };
        };
        yield { placement, ccLives: { w: 3, b: 2 }, white: plan(whiteType, "w", whiteFrom, whiteTo),
          black: plan(blackType, "b", blackFrom, blackTo), mines, siegedTanks, pathVisionOpts: options,
          ignoreAttacksOn: variant === 3 ? [whiteFrom, blackFrom] : [],
          isTargetVisible: variant < 2 ? () => true : variant === 3 ? () => false : (side, at) => {
            const vision = side === "w" ? whiteVision : blackVision;
            return vision.litSquares.has(at) || vision.revealedPieces.has(at);
          } };
      }
    }
  }
}
