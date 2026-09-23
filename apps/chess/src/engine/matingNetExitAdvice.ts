// SPEC: _spec/apps/ui/blunder-detection.puml

/** Semantic CP loss for exiting a forced mate (distinct from generic thresholds). */
export const MATING_NET_EXIT_CP = -9000;

export const MATING_NET_EXIT_ADVICE = [
  "That move would exit your mating net",
  "That move would let them escape your mating net",
  "Careful — that would break your mating net",
  "That move would throw away the mate",
  "Don't — that leaves the mating net",
] as const;

export type ScoreLike = { kind: "cp" | "mate"; value: number };

export function exitsMatingNet(baseScore: ScoreLike, hoverScore: ScoreLike): boolean {
  const hadNet = baseScore.kind === "mate" && baseScore.value > 0;
  if (!hadNet) return false;
  const stillInNet = hoverScore.kind === "mate" && hoverScore.value < 0;
  return !stillInNet;
}

export function pickMatingNetExitAdvice(): string {
  return MATING_NET_EXIT_ADVICE[Math.floor(Math.random() * MATING_NET_EXIT_ADVICE.length)];
}
