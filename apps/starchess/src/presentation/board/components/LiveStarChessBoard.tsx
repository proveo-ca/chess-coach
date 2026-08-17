// SPEC: _spec/apps/starchess/architecture/board-entities.puml, _spec/apps/starchess/architecture/screen-entities.puml
/**
 * Live match board — snapshot from match store + combat VFX from timeline.
 * Variants: eclipse | butter | vermeer.
 * Deploy drops: timeline cues + occupancy auto-deploy (apps/ui parity).
 * Intent / fog ownership: {@link useIntentOverlays} / {@link useBoardVision}.
 */
import {
  placementToMap,
  type StarChessColor,
} from "@chess-coach/starchess-core";
import type { Square } from "chess.js";
import type { Component } from "solid-js";
import { createEffect, createMemo, createSignal, onMount } from "solid-js";

import { useMatchStore } from "~/app/MatchStoreContext";
import { canSubmit, readDisplayedSnapshot } from "~/app/selectors";
import { AnimationStage } from "~/presentation/animations/components/AnimationStage";
import type { CombatCueFrame } from "~/presentation/animations/combatCueFrame";
import {
  kingDamageCuesFromBoard,
  visibleKingDamageCues,
} from "~/presentation/animations/kingDamage";
import { deriveVisualFrame } from "~/presentation/animations/visualFrame";
import { pieceVisibleToViewer } from "~/presentation/board/fogVisibility";
import { useBoardInput } from "~/presentation/board/hooks/useBoardInput";
import { useAutoDeploy } from "~/presentation/board/hooks/useAutoDeploy";
import { useCombatOverlays } from "~/presentation/combat/hooks/useCombatOverlays";
import { useBoardVision, useIntentOverlays } from "~/presentation/combat/hooks/useIntentOverlays";
import { liveMatchPhase } from "~/presentation/hud/liveMatchPhase";
import { LIVE_CAPABILITIES, capabilities, setCapabilities } from "~/store/capabilitiesStore";
import type { BoardSkin, PieceSet, VisionMode } from "~/types/board";
import type { TutorialBoardArrow } from "~/types/tutorial";
import type { KingDamageCue } from "~/types/cues";
import type { ReviewTurnPhase } from "~/types/review";

export const LiveStarChessBoard: Component<{
  fog?: boolean;
  visionMode?: VisionMode;
  variant?: BoardSkin;
  pieceSet?: PieceSet;
  /** Tutorial / coach destination rings. */
  hintSquares?: readonly Square[];
  /** Tutorial hint lines drawn square-to-square. */
  hintArrows?: readonly TutorialBoardArrow[];
}> = (props) => {
  const store = useMatchStore();
  const visionOverrides = () => ({
    fog: props.fog,
    visionMode: props.visionMode,
  });
  const boardVision = useBoardVision(store, visionOverrides);
  const fog = () => boardVision().fog;
  const visionMode = () => boardVision().visionMode;
  // Same vision overrides as the veil — fog intent clicks are app-wide policy.
  const { onSquareClick } = useBoardInput(visionOverrides);
  const combat = useCombatOverlays(store);
  const overlays = useIntentOverlays(store);
  const snap = createMemo(() => readDisplayedSnapshot(store));
  const [kingDamage, setKingDamage] = createSignal<KingDamageCue[]>([]);
  const reviewing = () => store.shell().phase === "gameOver";
  const interactive = () => canSubmit(store.shell());

  // Live play locks viewer orientation — Flip stays off in SideRailTools.
  // Tutorial sets homeOnly; do not clobber that chrome.
  onMount(() => {
    if (capabilities().homeOnly) return;
    setCapabilities(LIVE_CAPABILITIES);
  });

  const phase = createMemo((): ReviewTurnPhase => {
    const s = store.shell();
    if (s.phase === "gameOver") return store.reviewPhase();
    return liveMatchPhase({
      phase: s.phase,
      lastResolve: s.lastResolve,
      timelineActive: store.timeline().active,
      pendingPromotion: !!s.pendingPromotion,
    });
  });

  /** Player fog gates combat VFX; DualNav / no-fog shows everything. */
  const gateFx = () => fog() && visionMode() === "player";

  const fogOpts = () => ({ siegedRooks: snap().siegedRooks ?? [] });

  const pieceFxVisible = (at: Square, color: StarChessColor) => {
    if (!gateFx()) return true;
    return pieceVisibleToViewer(
      snap().placement,
      store.shell().viewer,
      at,
      color,
      fogOpts(),
    );
  };

  const moverFxVisible = (m: { from: Square; color: StarChessColor }) => {
    if (!gateFx()) return true;
    return (
      m.color === store.shell().viewer ||
      pieceVisibleToViewer(
        snap().placement,
        store.shell().viewer,
        m.from,
        m.color,
        fogOpts(),
      )
    );
  };

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
    enabled: () => !reviewing() && !store.timeline().active,
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
  const attackFrom = createMemo(() => new Set(combat.attackCues().map((c) => c.from)));

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
    const dying = dyingKingKeys();
    return visibleKingDamageCues(kingDamage(), {
      attackFrom: attackFrom(),
      dyingAt: dying.ats,
      dyingColors: dying.colors,
      isVisible: pieceFxVisible,
    });
  });

  const armedBishops = createMemo((): Square[] => {
    const out = new Set<Square>();
    const t = store.shell().targeting;
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
    const t = store.shell().targeting;
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

  const moveCues = createMemo(() => combat.moveCues().filter((c) => moverFxVisible(c)));
  const jumpCues = createMemo(() => combat.jumpCues().filter((c) => moverFxVisible(c)));

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

  const state = () => store.shell();

  const combatFrame = createMemo((): CombatCueFrame => ({
    attackCues: combat.attackCues(),
    attackDying: combat.attackDying(),
    deathCues: combat.deathCues(),
    moveCues: moveCues(),
    moveProgress: combat.moveProgress(),
    moveLeg: combat.moveLeg(),
    jumpCues: jumpCues(),
    jumpTrails: combat.jumpTrails(),
    mineMissiles: combat.mineMissiles(),
    mineMissileTrails: combat.mineMissileTrails(),
    deployCues: deployCues(),
    gasDropCues: gasDropCues(),
    kingDamage: visibleKingDamage(),
  }));

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        "box-sizing": "border-box",
      }}
    >
      <AnimationStage
        snapshot={snap()}
        viewer={state().viewer}
        fog={fog()}
        visionMode={visionMode()}
        variant={props.variant ?? "eclipse"}
        pieceSet={props.pieceSet}
        phase={phase()}
        intentGhosts={overlays().destinations}
        intentCanisters={intentCanisters()}
        intentChecks={overlays().checks}
        selected={interactive() ? state().selected : null}
        legalDests={interactive() ? state().legalDests : []}
        hintSquares={props.hintSquares}
        hintArrows={props.hintArrows}
        onSquareClick={interactive() ? onSquareClick : undefined}
        combat={combatFrame()}
        spentMines={combat.spentMines()}
        gasAbsorbSquares={gasAbsorbSquares()}
        armedBishops={armedBishops()}
        armAnimBishops={armAnimBishops()}
        hideSquares={hideSquares()}
      />
    </div>
  );
};
