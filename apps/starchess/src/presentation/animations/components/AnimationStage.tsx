// SPEC: _spec/apps/starchess/demos.puml, _spec/apps/starchess/architecture/board-entities.puml, _spec/apps/starchess/architecture/composite-vfx-stack.puml
/**
 * Snapshot board + combat VFX overlay stack (Facade).
 * Store-free host for Storybook animation demos and timeline projection.
 * Combat VFX: single `combat` bag ({@link CombatCueFrame}).
 */
import {
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  type Component,
} from "solid-js";
import type { Square } from "chess.js";

import { parseScFen, type ScFenSnapshot } from "@chess-coach/starchess-core";

import { CombatOverlayRoot } from "~/presentation/animations/components/CombatOverlayRoot";
import {
  type CombatCueFrame,
  EMPTY_COMBAT_CUE_FRAME,
} from "~/presentation/animations/combatCueFrame";
import { findBoardGrid } from "~/presentation/animations/boardGeom";
import { siegedRooksList } from "~/presentation/animations/rookModeStore";
import { StarChessBoard } from "~/presentation/board/components/StarChessBoard";
import type {
  BoardSkin,
  IntentCanister,
  IntentCheck,
  IntentGhost,
  PieceSet,
  VisionMode,
} from "~/types/board";
import type { ReviewTurnPhase } from "~/types/review";
import type { TutorialBoardArrow } from "~/types/tutorial";

const NO_ARMED: Square[] = [];
const NO_GAS_ABSORB: ReadonlySet<Square> = new Set();
const NO_SPENT: Square[] = [];

const fenToSnapshot = (fen: string, sieged: readonly Square[] = []): ScFenSnapshot => {
  const placement = fen.split(/\s+/)[0] ?? "8/8/8/8/8/8/8/8";
  const scfen = `SCFEN|${placement}|0|33|P|G:11:11|Q:w:;b:${
    sieged.length ? `|S:${sieged.join("")}` : ""
  }`;
  try {
    return parseScFen(scfen);
  } catch {
    return {
      placement,
      turn: 0,
      kingLives: { w: 3, b: 3 },
      phase: "P",
      gas: { w: 1, b: 1 },
      gasIncome: { w: 1, b: 1 },
      siegedRooks: [...sieged],
    };
  }
};

export type AnimationStageProps = {
  /** Classical FEN or already-built SCFEN snapshot. */
  fen?: string;
  snapshot?: ScFenSnapshot;
  variant?: BoardSkin;
  pieceSet?: PieceSet;
  fog?: boolean;
  viewer?: "w" | "b";
  /** DualNav review: full board + dual vision borders. Default `player`. */
  visionMode?: VisionMode;
  /** Live / review phase — drives board frame border (same tones as phase chip). */
  phase?: ReviewTurnPhase;
  intentGhosts?: readonly IntentGhost[];
  intentCanisters?: readonly IntentCanister[];
  /** Pending check / attack-intent rings (red dashed). */
  intentChecks?: readonly IntentCheck[];
  selected?: Square | null;
  legalDests?: readonly Square[];
  /** Tutorial destination rings (independent of legal-move chrome). */
  hintSquares?: readonly Square[];
  /** Tutorial hint lines drawn square-to-square. */
  hintArrows?: readonly TutorialBoardArrow[];
  onSquareClick?: (square: Square) => void;
  /** Combat VFX cues — single bag for the Composite overlay root. */
  combat?: CombatCueFrame;
  /** Squares currently absorbing gas (piece green aura transition). */
  gasAbsorbSquares?: ReadonlySet<Square> | readonly Square[];
  /** Mecha squares with Charon launchers popped (arming pose). */
  armedBishops?: readonly Square[];
  /** Charon shoulder-raise anim — arming only. */
  armAnimBishops?: readonly Square[];
  /** Hide board pieces on these squares while VFX play. */
  hideSquares?: ReadonlySet<Square> | readonly Square[];
  /** Hide mine glyphs after boom / while missile owns the square. */
  spentMines?: readonly Square[];
};

type OverlayBox = { top: number; left: number; w: number; h: number };

export const AnimationStage: Component<AnimationStageProps> = (props) => {
  let host: HTMLDivElement | undefined;
  const [box, setBox] = createSignal<OverlayBox>({ top: 0, left: 0, w: 480, h: 480 });
  const [measured, setMeasured] = createSignal(false);

  const snap = (): ScFenSnapshot => {
    if (props.snapshot) return props.snapshot;
    const fen = props.fen ?? "4k3/8/8/8/8/8/8/4K3 w - - 0 1";
    return fenToSnapshot(fen, siegedRooksList());
  };

  const combatFrame = createMemo(
    (): CombatCueFrame => props.combat ?? EMPTY_COMBAT_CUE_FRAME,
  );

  const measure = () => {
    if (!host) return;
    const grid = findBoardGrid(host);
    if (!grid) return;

    const w = grid.clientWidth;
    const h = grid.clientHeight;
    if (w <= 0 || h <= 0) return;
    const hr = host.getBoundingClientRect();
    const gr = grid.getBoundingClientRect();
    const top = gr.top - hr.top + grid.clientTop;
    const left = gr.left - hr.left + grid.clientLeft;
    setBox((prev) =>
      prev.top === top && prev.left === left && prev.w === w && prev.h === h
        ? prev
        : { top, left, w, h },
    );
    setMeasured(true);
  };

  const hasFx = () => {
    const c = combatFrame();
    return (
      (c.attackCues?.length ?? 0) > 0 ||
      (c.deathCues?.length ?? 0) > 0 ||
      (c.moveCues?.length ?? 0) > 0 ||
      (c.jumpCues?.length ?? 0) > 0 ||
      (c.jumpTrails?.length ?? 0) > 0 ||
      (c.mineMissiles?.length ?? 0) > 0 ||
      (c.mineMissileTrails?.length ?? 0) > 0 ||
      (c.gasDropCues?.length ?? 0) > 0 ||
      (c.deployCues?.length ?? 0) > 0 ||
      (c.kingDamage?.length ?? 0) > 0
    );
  };

  onMount(() => {
    measure();
    const ro = new ResizeObserver(() => measure());
    if (host) ro.observe(host);
    const grid = host ? findBoardGrid(host) : null;
    if (grid) ro.observe(grid);
    window.addEventListener("resize", measure);
    const onVis = () => {
      if (document.hidden) return;
      measure();
    };
    document.addEventListener("visibilitychange", onVis);
    onCleanup(() => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      document.removeEventListener("visibilitychange", onVis);
    });
  });

  createEffect(() => {
    if (!hasFx() || measured()) return;
    measure();
    requestAnimationFrame(measure);
  });

  const overlayReady = () => measured() && box().w > 0 && box().h > 0;

  const hidden = () => {
    const h = props.hideSquares;
    if (!h) return new Set<Square>();
    return h instanceof Set ? h : new Set(h);
  };

  const gasAbsorb = () => {
    const g = props.gasAbsorbSquares;
    if (!g) return NO_GAS_ABSORB;
    return g instanceof Set ? g : new Set(g);
  };

  /** U: stamps + absorb squares — combat overlays keep the green aura. */
  const specialUsedSquares = (): ReadonlySet<Square> => {
    const next = new Set<Square>(gasAbsorb());
    for (const sq of snap().specialsUsed ?? []) next.add(sq);
    return next;
  };

  return (
    <div
      ref={(el) => {
        host = el;
        requestAnimationFrame(measure);
      }}
      style={{
        position: "relative",
        display: "block",
        width: "100%",
        height: "100%",
        "box-sizing": "border-box",
      }}
    >
      <StarChessBoard
        snapshot={snap()}
        viewer={props.viewer ?? "w"}
        fog={props.fog !== false}
        visionMode={props.visionMode ?? "player"}
        variant={props.variant ?? "eclipse"}
        pieceSet={props.pieceSet}
        phase={props.phase}
        siegedRooks={snap().siegedRooks ?? siegedRooksList()}
        intentGhosts={props.intentGhosts}
        intentCanisters={props.intentCanisters}
        intentChecks={props.intentChecks}
        selected={props.selected}
        legalDests={props.legalDests}
        hintSquares={props.hintSquares}
        hintArrows={props.hintArrows}
        onSquareClick={props.onSquareClick}
        hideSquares={hidden()}
        moveCues={combatFrame().moveCues}
        moveProgress={combatFrame().moveProgress}
        spentMines={props.spentMines ?? NO_SPENT}
        armedBishops={props.armedBishops ?? NO_ARMED}
        armAnimBishops={props.armAnimBishops ?? NO_ARMED}
        gasAbsorbSquares={gasAbsorb()}
      />
      <Show when={overlayReady()}>
        <CombatOverlayRoot
          box={box()}
          cues={combatFrame()}
          specialUsedSquares={specialUsedSquares()}
          pieceSet={props.pieceSet}
        />
      </Show>
    </div>
  );
};
