import type { Square } from "chess.js";
/**
 * Live match board — snapshot from match store + combat VFX from timeline.
 * Variants: eclipse | butter | vermeer.
 * Deploy drops: timeline cues + occupancy auto-deploy (apps/ui parity).
 */
import type { Component } from "solid-js";
import { createEffect, createMemo, createSignal } from "solid-js";
import { placementToMap } from "@chess-coach/starchess-core";

import { useMatchStore } from "~/app/MatchStoreContext";
import { canSubmit, displayedSnapshot } from "~/app/selectors";
import { AnimationStage } from "~/presentation/animations/AnimationStage";
import { kingDamageCuesFromBoard } from "~/presentation/animations/kingDamage";
import { useBoardInput } from "~/presentation/board/useBoardInput";
import { intentOverlaysFromQueue } from "~/presentation/combat/intentOverlays";
import { useAutoDeploy } from "~/presentation/hooks/useAutoDeploy";
import { useCombatOverlays } from "~/presentation/hooks/useCombatOverlays";
import { liveMatchPhase } from "~/presentation/hud/liveMatchPhase";
import type { BoardVariant, VisionMode } from "~/types/board";
import type { KingDamageCue } from "~/types/cues";
import type { ReviewTurnPhase } from "~/types/review";

export type { BoardVariant };

export const LiveStarChessBoard: Component<{
  fog?: boolean;
  /** Override fog/vision during DualNav review (default: observer, no fog). */
  visionMode?: VisionMode;
  variant?: BoardVariant;
}> = (props) => {
  const store = useMatchStore();
  const { onSquareClick } = useBoardInput();
  const combat = useCombatOverlays(store);
  const snap = createMemo(() => displayedSnapshot(store.state()));
  const [kingDamage, setKingDamage] = createSignal<KingDamageCue[]>([]);
  const reviewing = () => store.state().phase === "gameOver";
  const interactive = () => canSubmit(store.state());

  const phase = createMemo((): ReviewTurnPhase => {
    const s = store.state();
    if (s.phase === "gameOver") return store.reviewPhase();
    return liveMatchPhase({
      phase: s.phase,
      lastResolve: s.lastResolve,
      timelineActive: s.timeline.active,
    });
  });

  const fog = () => {
    if (props.fog !== undefined) return props.fog;
    return reviewing() ? false : true;
  };
  const visionMode = (): VisionMode => {
    if (props.visionMode) return props.visionMode;
    return reviewing() ? "observer" : "player";
  };

  /** Live: only our queue. Review DualNav: both sides (no viewer filter). */
  const overlays = createMemo(() => {
    const s = snap();
    const reviewIntent = reviewing() ? store.reviewIntentActions() : null;
    const viewer = store.state().viewer;
    const raw = reviewing() ? (reviewIntent ?? undefined) : s.queue?.actions;
    const actions = reviewing() || !raw ? raw : raw.filter((a) => a.color === viewer);
    return intentOverlaysFromQueue(actions, {
      placement: s.placement,
      siegedRooks: s.siegedRooks,
      mines: s.mines,
      viewer: reviewing() ? undefined : viewer,
    });
  });

  // Persist fire overlays for both kings from HP (turn-open checks + path reveal).
  createEffect(() => {
    const s = snap();
    void s.kingLives.w;
    void s.kingLives.b;
    void s.placement;
    setKingDamage((prev) => kingDamageCuesFromBoard(s.placement, s.kingLives, prev));
  });

  // Occupancy auto-deploy (Command Center / put) — same pattern as apps/ui.
  // Re-baseline without animating when DualNav seeks (idle terminal review).
  const { autoDeployCues } = useAutoDeploy({
    pieces: () => placementToMap(snap().placement),
    enabled: () => !(reviewing() && !store.state().timeline.active),
  });

  const deployCues = createMemo(() => {
    const fromTimeline = combat.deployCues();
    const seen = new Set(fromTimeline.map((c) => c.at));
    const extra = autoDeployCues().filter((c) => !seen.has(c.at));
    return [...fromTimeline, ...extra];
  });

  const hideSquares = createMemo((): ReadonlySet<Square> => {
    const next = new Set(combat.hideSquares());
    for (const c of kingDamage()) next.add(c.at);
    for (const c of deployCues()) next.add(c.at);
    return next;
  });

  const state = () => store.state();

  return (
    <AnimationStage
      snapshot={snap()}
      viewer={state().viewer}
      fog={fog()}
      visionMode={visionMode()}
      variant={props.variant ?? "eclipse"}
      phase={phase()}
      intentGhosts={overlays().destinations}
      intentCanisters={overlays().canisters}
      intentChecks={overlays().checks}
      selected={interactive() ? state().selected : null}
      legalDests={interactive() ? state().legalDests : []}
      onSquareClick={interactive() ? onSquareClick : undefined}
      attackCues={combat.attackCues()}
      deathCues={combat.deathCues()}
      moveCues={combat.moveCues()}
      moveProgress={combat.moveProgress()}
      deployCues={deployCues()}
      kingDamage={kingDamage()}
      hideSquares={hideSquares()}
    />
  );
};
