// SPEC: _spec/apps/starchess/architecture/board-entities.puml
/**
 * Which Mecha shows its Charon launchers. Sole owner of that rule: launchers
 * are the Mecha's own gas spend (`charonMissiles`), so they follow that one unit
 * — never a square where some other unit used gas. The green "used a special"
 * aura is a different, square-based signal (`U:` + absorb) and is not this.
 */
import {
  placementToMap,
  type EndScTurnResult,
  type ScAction,
  type StarChessColor,
} from "@chess-coach/starchess-core";
import type { Square } from "chess.js";

type Snipe = { color: StarChessColor; from: Square };

const snipesIn = (actions: readonly ScAction[] | undefined): Snipe[] =>
  (actions ?? [])
    .filter((a) => a.kind === "charonMissiles")
    .map((a) => ({ color: a.color, from: a.from }));

/** Mechas holding a queued Charon strike (planning), optionally one side only. */
export const queuedCharonSquares = (
  actions: readonly ScAction[] | undefined,
  side?: StarChessColor,
): Square[] => snipesIn(actions).filter((s) => !side || s.color === side).map((s) => s.from);

/**
 * Every square each sniping Mecha stood on during `esr`, in order: where it
 * fired from, then wherever its own classical leg took it. Gas specials a
 * Mecha has are Charon only, so it never moves in B or F.
 */
export const charonTrails = (esr: EndScTurnResult | null | undefined): Square[][] =>
  snipesIn(esr?.queue).map((snipe) => {
    const trail = [snipe.from];
    const leg = esr!.resolved.moves.find(
      (m) => m.color === snipe.color && m.piece === "b" && m.from === snipe.from,
    );
    if (leg && leg.to !== leg.from) trail.push(leg.to);
    // A slide that ran into a fogged unit is in no move list: it ends on the
    // target when it moved in, else where it spotted it.
    const reveal = esr!.resolved.pathRevealAttacks.find(
      (atk) =>
        atk.color === snipe.color && "pathRevealFrom" in atk && atk.pathRevealFrom === snipe.from,
    );
    if (!leg && reveal) {
      const stop = reveal.kind === "capture" && reveal.occupies ? reveal.to : reveal.from;
      if (stop !== snipe.from) trail.push(stop);
    }
    return trail;
  });

/** All squares a sniping Mecha occupied in `esr` — what a mid-resolve hull checks. */
export const charonTrailSquares = (esr: EndScTurnResult | null | undefined): Set<Square> =>
  new Set(charonTrails(esr).flat());

/**
 * Where each sniping Mecha rests after `esr`, while its gas spend is still
 * stamped (`U:` clears at the next turn-open, and the launchers fold with it).
 * A Mecha that died firing leaves nothing behind.
 */
export const restingCharonSquares = (
  esr: EndScTurnResult | null | undefined,
  specialsUsed: readonly Square[] | undefined,
): Square[] => {
  if (!esr || !specialsUsed?.length) return [];
  const stamped = new Set(specialsUsed);
  const board = placementToMap(esr.next.placement);
  const out: Square[] = [];
  const trails = charonTrails(esr);
  snipesIn(esr.queue).forEach((snipe, i) => {
    const trail = trails[i]!;
    const at = trail[trail.length - 1]!;
    const unit = board.get(at);
    if (stamped.has(at) && unit?.type === "b" && unit.color === snipe.color) out.push(at);
  });
  return out;
};
