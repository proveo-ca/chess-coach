/**
 * Snapshot board + combat VFX overlay stack (Attack / Death / Move / Deploy).
 * Store-free host for Storybook animation demos and timeline projection.
 * // SPEC: _spec/apps/ui/starchess/demos.puml
 */
import {
  Show,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  type Component,
} from "solid-js";
import type { Square } from "chess.js";

import {
  parseScFen,
  type ScFenSnapshot,
  type ScMine,
} from "@chess-coach/starchess-core";

import { AttackAnimation } from "~/presentation/animations/AttackAnimation";
import { DeathAnimation } from "~/presentation/animations/DeathAnimation";
import { DeployAnimation } from "~/presentation/animations/DeployAnimation";
import { MoveAnimation } from "~/presentation/animations/MoveAnimation";
import { KingDamageOverlay } from "~/presentation/animations/kingDamageOverlay";
import { findBoardGrid } from "~/presentation/animations/boardGeom";
import type {
  AttackCue,
  DeathCue,
  DeployCue,
  KingDamageCue,
  MoveCue,
} from "~/presentation/types";
import {
  ObserverStarChessBoard,
  type BoardVariant,
  type IntentCanister,
  type IntentCheck,
  type IntentGhost,
  type VisionMode,
} from "~/presentation/board/ObserverStarChessBoard";
import { siegedRooksList } from "~/presentation/animations/rookModeStore";
import type { ReviewTurnPhase } from "~/types/review";

/** Stable empties — spreading `props.* ?? []` remounts For rows every render. */
const NO_ATTACKS: AttackCue[] = [];
const NO_DEATHS: DeathCue[] = [];
const NO_MOVES: MoveCue[] = [];
const NO_DEPLOYS: DeployCue[] = [];
const NO_KING_DAMAGE: KingDamageCue[] = [];
const NO_MOVE_PROGRESS: Record<string, 0 | 1> = {};

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
  variant?: BoardVariant;
  fog?: boolean;
  viewer?: "w" | "b";
  /** DualNav review: full board + dual vision borders. Default `player`. */
  visionMode?: VisionMode;
  /** Live / review phase — drives board frame border (same tones as phase chip). */
  phase?: ReviewTurnPhase;
  mines?: readonly ScMine[];
  intentGhosts?: readonly IntentGhost[];
  intentCanisters?: readonly IntentCanister[];
  /** Pending check / attack-intent rings (red dashed). */
  intentChecks?: readonly IntentCheck[];
  selected?: Square | null;
  legalDests?: readonly Square[];
  onSquareClick?: (square: Square) => void;
  attackCues?: readonly AttackCue[];
  attackDying?: Record<string, boolean>;
  deathCues?: readonly DeathCue[];
  moveCues?: readonly MoveCue[];
  moveProgress?: Record<string, 0 | 1>;
  moveLeg?: Record<string, 0 | 1>;
  deployCues?: readonly DeployCue[];
  /** Damaged-king fire / destroyed overlay (stable seed across moves). */
  kingDamage?: readonly KingDamageCue[];
  /** Hide board pieces on these squares while VFX play. */
  hideSquares?: ReadonlySet<Square> | readonly Square[];
  /** Hide mine glyphs after boom / while missile owns the square. */
  spentMines?: readonly Square[];
  chasingMines?: readonly Square[];
};

type OverlayBox = { top: number; left: number; w: number; h: number };

export const AnimationStage: Component<AnimationStageProps> = (props) => {
  let host: HTMLDivElement | undefined;
  /** Content-box of `[data-board-grid]` relative to host — matches UI combat root. */
  const [box, setBox] = createSignal<OverlayBox>({ top: 0, left: 0, w: 480, h: 480 });

  const snap = (): ScFenSnapshot => {
    if (props.snapshot) {
      const mines = props.mines ?? props.snapshot.mines;
      return mines ? { ...props.snapshot, mines: [...mines] } : props.snapshot;
    }
    const fen = props.fen ?? "4k3/8/8/8/8/8/8/4K3 w - - 0 1";
    const base = fenToSnapshot(fen, siegedRooksList());
    return props.mines ? { ...base, mines: [...props.mines] } : base;
  };

  const measure = () => {
    if (!host) return;
    const grid = findBoardGrid(host);
    if (!grid) return;
    // clientWidth/Height = content box (inside 4px border). getBoundingClientRect
    // includes the border and would stretch every squareBoxStyle slot.
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
  };

  const hasFx = () =>
    (props.attackCues?.length ?? 0) > 0 ||
    (props.deathCues?.length ?? 0) > 0 ||
    (props.moveCues?.length ?? 0) > 0 ||
    (props.deployCues?.length ?? 0) > 0 ||
    (props.kingDamage?.length ?? 0) > 0;

  onMount(() => {
    measure();
    const ro = new ResizeObserver(() => measure());
    if (host) ro.observe(host);
    const grid = host ? findBoardGrid(host) : null;
    if (grid) ro.observe(grid);
    window.addEventListener("resize", measure);
    onCleanup(() => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    });
  });

  // Fullscreen / flex layouts often size the grid after first paint.
  // Remeasure whenever FX appear so the overlay aligns to the grid.
  createEffect(() => {
    if (!hasFx()) return;
    measure();
    requestAnimationFrame(measure);
  });

  const dying = () => props.attackDying;

  // Keep the overlay mounted once the board is measured — toggling Show on
  // hasFx remounts AttackAnimation between cues and drops CSS attack timelines
  // (review DualNav + live resolve both commit playingIds:[] between steps).
  const overlayReady = () => box().w > 0 && box().h > 0;

  const hidden = () => {
    const h = props.hideSquares;
    if (!h) return new Set<Square>();
    return h instanceof Set ? h : new Set(h);
  };

  return (
    <div
      ref={(el) => {
        host = el;
        // Remeasure after paint when host attaches (fullscreen / flex layouts).
        requestAnimationFrame(measure);
      }}
      style={{
        position: "relative",
        display: "inline-block",
        /* Shrink-wrap the board (DualNav demos). Live screen host is already full width. */
        width: "max-content",
        "max-width": "100%",
      }}
    >
      <ObserverStarChessBoard
        snapshot={snap()}
        viewer={props.viewer ?? "w"}
        fog={props.fog !== false}
        visionMode={props.visionMode ?? "player"}
        variant={props.variant ?? "eclipse"}
        phase={props.phase}
        siegedRooks={snap().siegedRooks ?? siegedRooksList()}
        intentGhosts={props.intentGhosts}
        intentCanisters={props.intentCanisters}
        intentChecks={props.intentChecks}
        selected={props.selected}
        legalDests={props.legalDests}
        onSquareClick={props.onSquareClick}
        hideSquares={hidden()}
        moveCues={props.moveCues}
        moveProgress={props.moveProgress}
        spentMines={props.spentMines}
        chasingMines={props.chasingMines}
      />
      <Show when={overlayReady()}>
        <div
          data-starchess-combat-root
          style={{
            position: "absolute",
            top: `${box().top}px`,
            left: `${box().left}px`,
            width: `${box().w}px`,
            height: `${box().h}px`,
            "pointer-events": "none",
            "z-index": "30",
            overflow: "visible",
          }}
          aria-hidden
        >
          {/* Stable layer stack — do not wrap each in Show (remounts restart CSS). */}
          <KingDamageOverlay
            cues={props.kingDamage ?? NO_KING_DAMAGE}
            boardWidth={box().w}
            boardHeight={box().h}
          />
          <AttackAnimation
            cues={props.attackCues ?? NO_ATTACKS}
            dyingIds={dying()}
            boardWidth={box().w}
            boardHeight={box().h}
          />
          <DeathAnimation
            cues={props.deathCues ?? NO_DEATHS}
            boardWidth={box().w}
            boardHeight={box().h}
          />
          <MoveAnimation
            cues={props.moveCues ?? NO_MOVES}
            progress={props.moveProgress ?? NO_MOVE_PROGRESS}
            leg={props.moveLeg}
            boardWidth={box().w}
            boardHeight={box().h}
          />
          <DeployAnimation
            cues={props.deployCues ?? NO_DEPLOYS}
            boardWidth={box().w}
            boardHeight={box().h}
          />
        </div>
      </Show>
    </div>
  );
};
