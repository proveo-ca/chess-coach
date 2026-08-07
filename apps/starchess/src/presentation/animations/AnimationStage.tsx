/**
 * Snapshot board + combat VFX overlay stack
 * (Attack / Death / Move / Deploy / GasDrop / Jump).
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
import { GasDropAnimation } from "~/presentation/animations/GasDropAnimation";
import { MoveAnimation } from "~/presentation/animations/MoveAnimation";
import { MineMissileAnimation } from "~/presentation/animations/MineMissileAnimation";
import { QueenJumpAnimation } from "~/presentation/animations/QueenJumpAnimation";
import { KingDamageOverlay } from "~/presentation/animations/kingDamageOverlay";
import { findBoardGrid } from "~/presentation/animations/boardGeom";
import type {
  AttackCue,
  DeathCue,
  DeployCue,
  GasDropCue,
  KingDamageCue,
  MineMissileCue,
  MoveCue,
  QueenJumpTrail,
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
const NO_JUMP_TRAILS: QueenJumpTrail[] = [];
const NO_GAS_DROPS: GasDropCue[] = [];
const NO_MINE_MISSILES: MineMissileCue[] = [];
const NO_MOVE_PROGRESS: Record<string, 0 | 1> = {};
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
  /** Tactical Jump hull cues (QueenJumpAnimation). */
  jumpCues?: readonly MoveCue[];
  jumpTrails?: readonly QueenJumpTrail[];
  /** Spider Mine chase missile + trails. */
  mineMissiles?: readonly MineMissileCue[];
  mineMissileTrails?: readonly QueenJumpTrail[];
  deployCues?: readonly DeployCue[];
  /** Gas special absorb — canister drop + aura ease-in. */
  gasDropCues?: readonly GasDropCue[];
  /** Squares currently absorbing gas (piece green aura transition). */
  gasAbsorbSquares?: ReadonlySet<Square> | readonly Square[];
  /** Damaged-king fire / destroyed overlay (stable seed across moves). */
  kingDamage?: readonly KingDamageCue[];
  /** Goliath squares with Charon launchers popped (arming pose). */
  armedBishops?: readonly Square[];
  /** Charon shoulder-raise anim — arming only (persistent U: keeps pods up quietly). */
  armAnimBishops?: readonly Square[];
  /** Hide board pieces on these squares while VFX play. */
  hideSquares?: ReadonlySet<Square> | readonly Square[];
  /** Hide mine glyphs after boom / while missile owns the square. */
  spentMines?: readonly Square[];
  chasingMines?: readonly Square[];
};

type OverlayBox = { top: number; left: number; w: number; h: number };

export const AnimationStage: Component<AnimationStageProps> = (props) => {
  let host: HTMLDivElement | undefined;
  const [box, setBox] = createSignal<OverlayBox>({ top: 0, left: 0, w: 480, h: 480 });
  const [measured, setMeasured] = createSignal(false);

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

  const hasFx = () =>
    (props.attackCues?.length ?? 0) > 0 ||
    (props.deathCues?.length ?? 0) > 0 ||
    (props.moveCues?.length ?? 0) > 0 ||
    (props.jumpCues?.length ?? 0) > 0 ||
    (props.jumpTrails?.length ?? 0) > 0 ||
    (props.mineMissiles?.length ?? 0) > 0 ||
    (props.mineMissileTrails?.length ?? 0) > 0 ||
    (props.gasDropCues?.length ?? 0) > 0 ||
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
        display: "inline-block",
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
        spentMines={props.spentMines ?? NO_SPENT}
        chasingMines={props.chasingMines}
        armedBishops={props.armedBishops ?? NO_ARMED}
        armAnimBishops={props.armAnimBishops ?? NO_ARMED}
        gasAbsorbSquares={gasAbsorb()}
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
          <GasDropAnimation
            cues={props.gasDropCues ?? NO_GAS_DROPS}
            boardWidth={box().w}
            boardHeight={box().h}
          />
          <AttackAnimation
            cues={props.attackCues ?? NO_ATTACKS}
            dyingIds={dying()}
            specialUsedSquares={specialUsedSquares()}
            boardWidth={box().w}
            boardHeight={box().h}
          />
          <DeathAnimation
            cues={props.deathCues ?? NO_DEATHS}
            specialUsedSquares={specialUsedSquares()}
            boardWidth={box().w}
            boardHeight={box().h}
          />
          <MoveAnimation
            cues={props.moveCues ?? NO_MOVES}
            progress={props.moveProgress ?? NO_MOVE_PROGRESS}
            leg={props.moveLeg}
            specialUsedSquares={specialUsedSquares()}
            boardWidth={box().w}
            boardHeight={box().h}
          />
          <QueenJumpAnimation
            cues={(props.jumpCues as MoveCue[] | undefined) ?? NO_MOVES}
            trails={(props.jumpTrails as QueenJumpTrail[] | undefined) ?? NO_JUMP_TRAILS}
            boardWidth={box().w}
            boardHeight={box().h}
          />
          <MineMissileAnimation
            cues={props.mineMissiles ?? NO_MINE_MISSILES}
            trails={props.mineMissileTrails ?? NO_JUMP_TRAILS}
            boardWidth={box().w}
            boardHeight={box().h}
          />
          <DeployAnimation
            cues={props.deployCues ?? NO_DEPLOYS}
            specialUsedSquares={specialUsedSquares()}
            boardWidth={box().w}
            boardHeight={box().h}
          />
        </div>
      </Show>
    </div>
  );
};
