// SPEC: _spec/apps/starchess/architecture/board-entities.puml, _spec/apps/starchess/architecture/screen-entities.puml, _spec/apps/starchess/architecture/reactivity/presentation.md, _spec/apps/starchess/board-rendering.puml
/**
 * Live match board — snapshot from match store + combat VFX from timeline.
 * Variants: eclipse | butter | vermeer.
 * Deploy drops: timeline cues + occupancy auto-deploy (apps/chess parity).
 * Intent / fog ownership: {@link useIntentOverlays} / {@link useBoardVision}.
 */
import {
  placementToMap,
  rayBetween,
  type StarChessColor,
} from "@chess-coach/starchess-core";
import type { Square } from "chess.js";
import type { Component } from "solid-js";
import { createMemo } from "solid-js";

import { useMatchStore } from "~/ports/matchStore";
import { useAchievementBubbles } from "~/presentation/board/achievementBubbles";
import { AnimationStage } from "~/presentation/animations/components/AnimationStage";
import type { CombatCueFrame } from "~/presentation/animations/combatCueFrame";
import {
  ccDamageCuesFromBoard,
  visibleCCDamageCues,
  withCCFire,
} from "~/presentation/animations/ccDamage";
import { deriveVisualFrame } from "~/presentation/animations/visualFrame";
import {
  pieceVisibleToViewer,
  targetVisibleGate,
} from "~/presentation/board/fogVisibility";
import { useBoardInput } from "~/presentation/board/hooks/useBoardInput";
import { useAutoDeploy } from "~/presentation/board/hooks/useAutoDeploy";
import { useCombatOverlays } from "~/presentation/combat/hooks/useCombatOverlays";
import { useBoardVision, useIntentOverlays } from "~/presentation/combat/hooks/useIntentOverlays";
import { liveMatchPhase } from "~/presentation/hud/liveMatchPhase";
import {
  charonTrailSquares,
  queuedCharonSquares,
  restingCharonSquares,
} from "~/presentation/board/charonArmed";
import type { BoardSkin, PieceSet, VisionMode } from "~/types/board";
import type { TutorialBoardArrow } from "~/types/tutorial";
import type { CCDamageCue } from "~/types/cues";
import type { ReviewTurnPhase } from "~/types/review";
import { sameFlat, sameList, sameSet } from "~/presentation/board/memoEquals";

const NO_SQUARES: readonly Square[] = [];
const NO_SQUARE_SET: ReadonlySet<Square> = new Set();
const NO_IDS: ReadonlySet<string> = new Set();

export const LiveStarChessBoard: Component<{
  fog?: boolean;
  visionMode?: VisionMode;
  variant?: BoardSkin;
  pieceSet?: PieceSet;
  /** Tutorial / coach destination rings. */
  hintSquares?: readonly Square[];
  /** Tutorial rings drawn in alert red. */
  hintAlertSquares?: readonly Square[];
  hintGasSquares?: readonly Square[];
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
  const achievementBubbles = useAchievementBubbles();
  const snap = createMemo(() => store.view.displayedSnapshot(), undefined, { equals: sameFlat });
  const reviewing = () => store.shell().phase === "gameOver";
  const interactive = createMemo(() => store.view.canSubmit());

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

  const fogOpts = () => ({ siegedTanks: snap().siegedTanks ?? [] });

  /** Vision opts with mines — own mines light their tile, same as the veil. */
  const fogVisionOpts = () => ({
    ...fogOpts(),
    mines: [...(snap().mines ?? [])],
  });

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

  const veilMoveIds = createMemo((): ReadonlySet<string> => {
    if (!gateFx()) return NO_IDS;
    const viewer = store.shell().viewer;
    const gate = targetVisibleGate(snap().placement, fogVisionOpts());
    const out = new Set<string>();
    for (const m of combat.moveCues()) {
      if (m.color === viewer) continue;
      const path = [m.from, ...rayBetween(m.from, m.to), m.to];
      if (path.some((sq) => gate(viewer, sq))) out.add(m.id);
    }
    return out;
  }, undefined, { equals: sameSet });

  // Persist fire overlays for both Command Centers from HP (turn-open checks + path reveal).
  const ccDamage = createMemo<CCDamageCue[]>((prev) => {
    const s = snap();
    return ccDamageCuesFromBoard(s.placement, s.ccLives, prev);
  }, []);

  const { autoDeployCues } = useAutoDeploy({
    pieces: () => placementToMap(snap().placement),
    enabled: () => !reviewing() && !store.timeline().active,
  });

  const deployCues = createMemo(() => {
    const fromTimeline = combat.deployCues();
    const dying = new Set(combat.deathCues().map((c) => c.at));
    const seen = new Set(fromTimeline.map((c) => c.at));
    const extra = autoDeployCues().filter((c) => !seen.has(c.at) && !dying.has(c.at));
    // A timeline deploy on a dying square is a crush — the hull composes above
    // the victim's boom (V40). Only board-diff extras yield to a death.
    return [...fromTimeline, ...extra].filter((c) => pieceFxVisible(c.at, c.color));
  });

  /**
   * A shooting Command Center burns on its own hull: `attackFrom` below drops the
   * persistent slot so the hatch / battery CSS can play, which leaves this cue
   * as the only thing drawing that CC for the length of the shot.
   */
  const attackCues = createMemo(() => withCCFire(combat.attackCues(), ccDamage()));

  /** Attack hull owns the square — drop fire overlay so hatch/battery CSS can play. */
  const attackFrom = createMemo(() => new Set(attackCues().map((c) => c.from)));

  /** Lethal Command Center crumple owns the square — suppress static destroyed rubble. */
  const dyingCCKeys = createMemo(() => {
    const ats = new Set<string>();
    const colors = new Set<string>();
    for (const c of combat.deathCues()) {
      ats.add(c.at);
      if (c.piece === "k") colors.add(c.color);
    }
    return { ats, colors };
  });

  /**
   * A damaged Command Center travels as its own burning hull. `handleMoveWave` flips
   * `moveProgress` a frame before it commits the relocated placement, so the
   * fire cue's `at` still reads `from` for the whole slide — hand the mover the
   * HP state and let `visibleCCDamage` drop that side's slot instead.
   */
  const moveCues = createMemo(() =>
    withCCFire(
      combat
        .moveCues()
        .filter((c) => moverFxVisible(c) || veilMoveIds().has(c.id)),
      ccDamage(),
    ),
  );

  /** Sides whose Command Center is a live move hull — that hull paints the fire. */
  const movingCCColors = createMemo((): ReadonlySet<string> => {
    const out = new Set<string>();
    for (const c of moveCues()) if (c.piece === "k") out.add(c.color);
    return out;
  });

  const visibleCCDamage = createMemo(() => {
    const dying = dyingCCKeys();
    return visibleCCDamageCues(ccDamage(), {
      attackFrom: attackFrom(),
      dyingAt: dying.ats,
      dyingColors: dying.colors,
      movingColors: movingCCColors(),
      isVisible: pieceFxVisible,
    });
  });

  /**
   * Launchers are the Mecha's own Charon spend, never "gas was used on this
   * square": arming now, a queued strike (own side while planning; both in
   * review), and — until turn-open clears `U:` — the Mecha that fired.
   */
  const armedMechas = createMemo((): readonly Square[] => {
    const s = store.shell();
    const out = new Set<Square>();
    if (s.targeting?.kind === "charonMissiles") out.add(s.targeting.from);
    const reviewing = s.phase === "gameOver";
    const queued = reviewing ? store.reviewIntentActions() : snap().queue?.actions;
    for (const sq of queuedCharonSquares(queued ?? undefined, reviewing ? undefined : s.viewer)) {
      out.add(sq);
    }
    const shown = reviewing ? s.reviewIndex : s.settledSnapshots.length - 1;
    for (const sq of restingCharonSquares(s.settledResolves[shown - 1], snap().specialsUsed)) {
      out.add(sq);
    }
    return out.size > 0 ? [...out] : NO_SQUARES;
  }, undefined, { equals: sameList });

  /** Every square a firing Mecha held in the resolve on screen — mid-resolve hulls. */
  const charonSquares = createMemo(() => charonTrailSquares(store.shell().lastResolve));

  /** Shoulder-raise anim only while arming — persistent U: keeps pods up quietly. */
  const armAnimMechas = createMemo((): readonly Square[] => {
    const t = store.shell().targeting;
    return t?.kind === "charonMissiles" ? [t.from] : NO_SQUARES;
  }, undefined, { equals: sameList });

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
    if (cues.length === 0) return NO_SQUARE_SET;
    return new Set(cues.map((c) => c.at));
  }, undefined, { equals: sameSet });

  const jumpCues = createMemo(() => combat.jumpCues().filter((c) => moverFxVisible(c)));

  /**
   * combat.hideSquares already derives from cues + attackDying via
   * deriveVisualFrame. Merge ccDamage + auto-deploy extras (timeline deploys
   * are already included; Set union is idempotent).
   */
  const hideSquares = createMemo((): ReadonlySet<Square> => {
    const frame = deriveVisualFrame({
      attackCues: attackCues(),
      attackDying: combat.attackDying(),
      deathCues: combat.deathCues(),
      moveCues: moveCues(),
      jumpCues: jumpCues(),
      deployCues: deployCues(),
      ccDamage: visibleCCDamage(),
    });
    // Union with timeline-hidden so mid-window victim hides (deaths done,
    // board not yet committed) stay covered even without a live death cue.
    const next = new Set(frame.hideSquares);
    for (const sq of combat.hideSquares()) next.add(sq);
    return next;
  }, undefined, { equals: sameSet });

  const state = () => store.shell();
  const selectedProp = createMemo(() => (interactive() ? state().selected : null));
  const legalDestsProp = createMemo(() => (interactive() ? state().legalDests : NO_SQUARES));
  const squareClickProp = createMemo(() => (interactive() ? onSquareClick : undefined));

  const combatFrame = createMemo((): CombatCueFrame => ({
    attackCues: attackCues(),
    attackDying: combat.attackDying(),
    deathCues: combat.deathCues(),
    moveCues: moveCues(),
    moveProgress: combat.moveProgress(),
    moveLeg: combat.moveLeg(),
    veilMoveCueIds: veilMoveIds(),
    jumpCues: jumpCues(),
    jumpTrails: combat.jumpTrails(),
    mineMissiles: combat.mineMissiles(),
    mineMissileTrails: combat.mineMissileTrails(),
    deployCues: deployCues(),
    gasDropCues: gasDropCues(),
    ccDamage: visibleCCDamage(),
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
        selected={selectedProp()}
        legalDests={legalDestsProp()}
        hintSquares={props.hintSquares}
        hintAlertSquares={props.hintAlertSquares}
        hintGasSquares={props.hintGasSquares}
        hintArrows={props.hintArrows}
        onSquareClick={squareClickProp()}
        combat={combatFrame()}
        spentMines={combat.spentMines()}
        gasAbsorbSquares={gasAbsorbSquares()}
        armedMechas={armedMechas()}
        charonSquares={charonSquares()}
        armAnimMechas={armAnimMechas()}
        hideSquares={hideSquares()}
        achievementBubbles={achievementBubbles()}
      />
    </div>
  );
};
