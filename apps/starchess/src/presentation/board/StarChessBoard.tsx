/**
 * Live match board — snapshot from match store + combat VFX from timeline.
 * Variants: eclipse | butter | vermeer.
 */
import type { Component } from "solid-js";
import { createEffect, createMemo, createSignal } from "solid-js";
import type { Square } from "chess.js";

import { useMatchStore } from "~/app/MatchStoreContext";
import { displayedSnapshot } from "~/app/selectors";
import { AnimationStage } from "~/presentation/animations/AnimationStage";
import { kingDamageCuesFromBoard } from "~/presentation/animations/kingDamage";
import type { BoardVariant } from "~/presentation/board/EclipseBoard";
import { useBoardInput } from "~/presentation/board/useBoardInput";
import { intentOverlaysFromQueue } from "~/presentation/combat/intentOverlays";
import { useCombatOverlays } from "~/presentation/hooks/useCombatOverlays";
import type { KingDamageCue } from "~/presentation/types";

export type { BoardVariant };

export const StarChessBoard: Component<{
  fog?: boolean;
  variant?: BoardVariant;
}> = (props) => {
  const store = useMatchStore();
  const { onSquareClick } = useBoardInput();
  const combat = useCombatOverlays(store);
  const snap = createMemo(() => displayedSnapshot(store.state()));
  const [kingDamage, setKingDamage] = createSignal<KingDamageCue[]>([]);

  /** Live player — only own intent ghosts (never opponent queue). */
  const ghosts = createMemo(() => {
    const s = snap();
    return intentOverlaysFromQueue(s.queue?.actions, {
      placement: s.placement,
      siegedRooks: s.siegedRooks,
      viewer: store.state().viewer,
    });
  });

  // Persist fire overlays for both kings from HP (turn-open checks + path reveal).
  createEffect(() => {
    const s = snap();
    // Touch lives fields so Solid tracks TIMELINE_COMMIT chips.
    void s.kingLives.w;
    void s.kingLives.b;
    void s.placement;
    setKingDamage((prev) =>
      kingDamageCuesFromBoard(s.placement, s.kingLives, prev),
    );
  });

  const hideSquares = createMemo((): ReadonlySet<Square> => {
    const next = new Set(combat.hideSquares());
    for (const c of kingDamage()) next.add(c.at);
    return next;
  });

  const state = () => store.state();

  return (
    <AnimationStage
      snapshot={snap()}
      viewer={state().viewer}
      fog={props.fog}
      variant={props.variant ?? "eclipse"}
      intentGhosts={ghosts()}
      selected={state().selected}
      legalDests={state().legalDests}
      onSquareClick={onSquareClick}
      attackCues={combat.attackCues()}
      deathCues={combat.deathCues()}
      moveCues={combat.moveCues()}
      moveProgress={combat.moveProgress()}
      deployCues={combat.deployCues()}
      kingDamage={kingDamage()}
      hideSquares={hideSquares()}
    />
  );
};
