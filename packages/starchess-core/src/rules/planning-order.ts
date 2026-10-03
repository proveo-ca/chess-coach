// SPEC: _spec/packages/starchess-core/turn-queue-sequence.puml, _spec/packages/starchess-core/gas-phase-vacancy.puml, _spec/packages/starchess-training/candidate-generation.puml
import { parseSquare, sq } from "../board/placement";
import type { Square } from "../model/square";
import type { ScAction, ScActionInput } from "../model/types";
import { canMarineDoubleStep } from "./specials/stimStep";

export const orderBHeadsFirst = (actions: readonly ScAction[]): ScAction[] => {
  const ordered: ScAction[] = [];
  const pending = [...actions].sort((a, b) => a.seq - b.seq);
  while (pending.length) {
    const heads = new Set(
      pending
        .filter((a) => (a.kind === "stimStep" || a.kind === "tacticalJump") && !!a.to)
        .map((a) => a.from),
    );
    const idx = pending.findIndex((a) => {
      if ((a.kind !== "stimStep" && a.kind !== "tacticalJump") || !a.to) return true;
      const others = new Set(heads);
      others.delete(a.from);
      return ![...others].some((from) => from === a.to);
    });
    ordered.push(idx >= 0 ? pending.splice(idx, 1)[0]! : pending.shift()!);
  }
  return ordered;
};

/** Structural classical coordinates after the first matching B relocation. */
export const classicalRewriteCoordinatesAfterB = (
  prefix: readonly ScActionInput[],
  classical: Extract<ScActionInput, { timing: "C" }>,
): { from: Square; to: Square } | null => {
  const b = prefix.find(
    (a) =>
      a.timing === "B" &&
      a.color === classical.color &&
      a.from === classical.from &&
      a.to &&
      (a.kind === "stimStep" || a.kind === "tacticalJump"),
  );
  if (!b || !b.to) return null;
  const origin = parseSquare(b.from);
  const arrival = parseSquare(b.to);
  const target = parseSquare(classical.to);
  const to = sq(target.file + arrival.file - origin.file, target.rank + arrival.rank - origin.rank);
  if (!to) return null;
  if (b.kind === "stimStep") {
    const ranks = Math.abs(Number(classical.to[1]) - Number(classical.from[1]));
    const forward =
      (Number(classical.to[1]) - Number(classical.from[1])) * (b.color === "w" ? 1 : -1) > 0;
    if (
      classical.kind !== "classical" ||
      classical.from[0] !== classical.to[0] ||
      !forward ||
      (ranks !== 1 && (ranks !== 2 || !canMarineDoubleStep(classical.from, b.color)))
    ) return null;
  } else if (b.to !== classical.to) {
    return null;
  }
  return { from: b.to, to };
};
