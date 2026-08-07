import type { Square } from "chess.js";
/**
 * Live match board — snapshot from match store + combat VFX from timeline.
 * Variants: eclipse | butter | vermeer.
 * Deploy drops: timeline cues + occupancy auto-deploy (apps/ui parity).
 */
import type { Component } from "solid-js";
import { createEffect, createMemo, createSignal, onMount } from "solid-js";
import {
  isMoverVisibleToSide,
  isPieceVisibleToSide,
  placementToMap,
  type RookMode,
  type StarChessColor,
} from "@chess-coach/starchess-core";

import { useMatchStore } from "~/app/MatchStoreContext";
import { canSubmit, displayedSnapshot } from "~/app/selectors";
import { AnimationStage } from "~/presentation/animations/AnimationStage";
import { kingDamageCuesFromBoard } from "~/presentation/animations/kingDamage";
import { deriveVisualFrame } from "~/presentation/animations/visualFrame";
import { useBoardInput } from "~/presentation/board/useBoardInput";
import { intentOverlaysFromQueue } from "~/presentation/combat/intentOverlays";
import { useAutoDeploy } from "~/presentation/hooks/useAutoDeploy";
import { useCombatOverlays } from "~/presentation/hooks/useCombatOverlays";
import { liveMatchPhase } from "~/presentation/hud/liveMatchPhase";
import {
  LIVE_CAPABILITIES,
  setCapabilities,
} from "~/store/capabilitiesStore";
import type { BoardVariant, VisionMode } from "~/types/board";
import type { KingDamageCue } from "~/types/cues";
import type { ReviewTurnPhase } from "~/types/review";

export type { BoardVariant };

export const LiveStarChessBoard: Component<{
  fog?: boolean;
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

  // Live play locks viewer orientation — Flip stays off in Sidebar.
  onMount(() => setCapabilities(LIVE_CAPABILITIES));

  const phase = createMemo((): ReviewTurnPhase => {
    const s = store.state();
    if (s.phase === "gameOver") return store.reviewPhase();
    return liveMatchPhase({
      phase: s.phase,
      lastResolve: s.lastResolve,
      timelineActive: s.timeline.active,
      pendingPromotion: !!s.pendingPromotion,
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

  /** Player fog gates combat VFX; DualNav / no-fog shows everything. */
  const gateFx = () => fog() && visionMode() === "player";

  const rookModeFor = (sq: Square): RookMode => {
    const sieged = new Set(snap().siegedRooks ?? []);
    return sieged.has(sq) ? "siege" : "tank";
  };

  const pieceFxVisible = (at: Square, color: StarChessColor) => {
    if (!gateFx()) return true;
    return isPieceVisibleToSide(snap().placement, store.state().viewer, at, color, {
      rookModeFor,
    });
  };

  const moverFxVisible = (m: {
    from: Square;
    color: StarChessColor;
  }) => {
    if (!gateFx()) return true;
    return isMoverVisibleToSide(
      snap().placement,
      store.state().viewer,
      m,
      new Set(),
      { rookModeFor },
    );
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

  const { autoDeployCues } = useAutoDeploy({
    pieces: () => placementToMap(snap().placement),
    enabled: () => !reviewing() && !store.state().timeline.active,
  });

  const deployCues = createMemo(() => {
    const fromTimeline = combat.deployCues();
    const dying = new Set(combat.deathCues().map((c) => c.at));
    const seen = new Set(fromTimeline.map((c) => c.at));
    const extra = autoDeployCues().filter((c) => !seen.has(c.at) && !dying.has(c.at));
    return [...fromTimeline, ...extra]
      .filter((c) => !dying.has(c.at))
      .filter((c) => pieceFxVisible(c.at, c.color));
  });

  /** Attack hull owns the square — drop fire overlay so hatch/battery CSS can play. */
  const attackFrom = createMemo(
    () => new Set(combat.attackCues().map((c) => c.from)),
  );

  /** Lethal king crumple owns the square — suppress static destroyed rubble. */
  const dyingKingKeys = createMemo(() => {
    const ats = new Set<string>();
    const colors = new Set<string>();
    for (const c of combat.deathCues()) {
      ats.add(c.at);
      if (c.piece === "k") colors.add(c.color);
    }
    return { ats, colors };
  });

  const visibleKingDamage = createMemo(() => {
    const atk = attackFrom();
    const dying = dyingKingKeys();
    return kingDamage().filter(
      (c) => !atk.has(c.at) && !dying.ats.has(c.at) && !dying.colors.has(c.id),
    );
  });

  const armedBishops = createMemo((): Square[] => {
    const out = new Set<Square>();
    const t = store.state().targeting;
    if (t?.kind === "bishopSnipe") out.add(t.from);
    // Persist Charon launchers + green with U: / arm marks until turn-open checks.
    const map = placementToMap(snap().placement);
    for (const sq of snap().specialsUsed ?? []) {
      if (map.get(sq)?.type === "b") out.add(sq);
    }
    return [...out];
  });

  /** Shoulder-raise anim only while arming — persistent U: keeps pods up quietly. */
  const armAnimBishops = createMemo((): Square[] => {
    const t = store.state().targeting;
    return t?.kind === "bishopSnipe" ? [t.from] : [];
  });

  /** No canister / green absorb through fog for unseen enemy gas spends. */
  const gasDropCues = createMemo(() =>
    combat.gasDropCues().filter((c) => pieceFxVisible(c.at, c.color)),
  );

  /** Hide queued canister badges once this resolve will absorb them. */
  const intentCanisters = createMemo(() => {
    const dropping = new Set(gasDropCues().map((c) => c.at));
    if (dropping.size === 0) return overlays().canisters;
    return overlays().canisters.filter((c) => !dropping.has(c.at));
  });

  const gasAbsorbSquares = createMemo((): ReadonlySet<Square> => {
    const cues = gasDropCues();
    if (cues.length === 0) return new Set();
    return new Set(cues.map((c) => c.at));
  });

  const moveCues = createMemo(() =>
    combat.moveCues().filter((c) => moverFxVisible(c)),
  );
  const jumpCues = createMemo(() =>
    combat.jumpCues().filter((c) => moverFxVisible(c)),
  );

  /**
   * combat.hideSquares already derives from cues + attackDying via
   * deriveVisualFrame. Merge kingDamage + auto-deploy extras (timeline deploys
   * are already included; Set union is idempotent).
   */
  const hideSquares = createMemo((): ReadonlySet<Square> => {
    const frame = deriveVisualFrame({
      attackCues: combat.attackCues(),
      attackDying: combat.attackDying(),
      deathCues: combat.deathCues(),
      moveCues: moveCues(),
      jumpCues: jumpCues(),
      deployCues: deployCues(),
      kingDamage: visibleKingDamage(),
    });
    // Union with timeline-hidden so mid-window victim hides (deaths done,
    // board not yet committed) stay covered even without a live death cue.
    const next = new Set(frame.hideSquares);
    for (const sq of combat.hideSquares()) next.add(sq);
    return next;
  });

  const state = () => store.state();

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <AnimationStage
        snapshot={snap()}
        viewer={state().viewer}
        fog={fog()}
        visionMode={visionMode()}
        variant={props.variant ?? "eclipse"}
        phase={phase()}
        intentGhosts={overlays().destinations}
        intentCanisters={intentCanisters()}
        intentChecks={overlays().checks}
        selected={interactive() ? state().selected : null}
        legalDests={interactive() ? state().legalDests : []}
        onSquareClick={interactive() ? onSquareClick : undefined}
        attackCues={combat.attackCues()}
        attackDying={combat.attackDying()}
        deathCues={combat.deathCues()}
        moveCues={moveCues()}
        moveProgress={combat.moveProgress()}
        moveLeg={combat.moveLeg()}
        jumpCues={jumpCues()}
        jumpTrails={combat.jumpTrails()}
        mineMissiles={combat.mineMissiles()}
        mineMissileTrails={combat.mineMissileTrails()}
        spentMines={combat.spentMines()}
        deployCues={deployCues()}
        gasDropCues={gasDropCues()}
        gasAbsorbSquares={gasAbsorbSquares()}
        kingDamage={visibleKingDamage()}
        armedBishops={armedBishops()}
        armAnimBishops={armAnimBishops()}
        hideSquares={hideSquares()}
      />
    </div>
  );
};
