import type { PieceSymbol, Square } from "chess.js";
import { For, Show, createSignal, onCleanup, type Component } from "solid-js";
import { Portal } from "solid-js/web";

import { energyRemaining, hasUsedSpecialThisTurn } from "~/starchess/starChessStore";
import { SPECIAL_ENERGY_COST } from "~/starchess/constants";
import styles from "~/starchess/features/GasDeploy.module.css";
import { VespeneIcon } from "~/starchess/primitives/icons";
import { SpecialPreview } from "~/starchess/primitives/SpecialPreview";
import { specialCopyFor } from "~/starchess/primitives/specialCopy";
import { canClassicalPawnDouble } from "~/starchess/specials/pawnDouble";
import { currentFen, game } from "~/store/gameStore";
import { activePlayerColor } from "~/store/settingsStore";

export type GasDeployTarget = {
  square: Square;
  piece: PieceSymbol;
};

type GasDeployProps = {
  /**
   * Fired when a canister is dropped on a deployable unit.
   * Does **not** spend gas — piece specials spend when the action commits
   * (e.g. Command Center after unit placement; Vulture when the mine is armed).
   */
  onDeploy?: (target: GasDeployTarget) => void;
  /** Fired when a drag cancels (miss / TBD unit / pointer cancel). */
  onCancel?: () => void;
};

type DragState = {
  pointerId: number;
  x: number;
  y: number;
  returning: boolean;
};

type HoverState = {
  square: Square;
  piece: PieceSymbol;
  x: number;
  y: number;
};

const CANISTER = 60;
/** Max reserves in the oval (capacity 3 − ready slot). Stable DOM for slide anim. */
const MAX_RESERVES = 2;
/** Per-unit vespene cost (Goliath Charon Booster Missiles = 2; default = 1). */
const gasCostFor = (piece: PieceSymbol): number =>
  specialCopyFor(piece).gasCost ?? SPECIAL_ENERGY_COST;
const RESERVE_SLOTS = Array.from({ length: MAX_RESERVES }, (_, i) => i);

/**
 * Footer gas rack — drag a vespene canister onto a friendly unit to arm its special.
 * Reads remaining gas from `starChessStore`. Dropping only requires gas available;
 * piece hooks spend when the special actually commits.
 */
export const GasDeploy: Component<GasDeployProps> = (props) => {
  const gas = () => Math.max(0, energyRemaining());

  const [drag, setDrag] = createSignal<DragState | null>(null);
  const [hover, setHover] = createSignal<HoverState | null>(null);
  let circleEl: HTMLButtonElement | undefined;
  let returnTimer: number | undefined;

  /** Canisters visually lifted with the drag (2 while hovering a 2-gas unit). */
  const dragCount = () => {
    if (!drag()) return 0;
    const h = hover();
    if (!h) return 1;
    return Math.max(1, Math.min(gasCostFor(h.piece), gas()));
  };

  const dockCount = () => {
    const g = gas();
    // While lifted (or returning), the dock advances the queue visually.
    return drag() ? Math.max(0, g - Math.max(1, dragCount())) : g;
  };

  const reserveCount = () => Math.max(0, dockCount() - 1);

  const clearReturnTimer = () => {
    if (returnTimer != null) {
      window.clearTimeout(returnTimer);
      returnTimer = undefined;
    }
  };

  onCleanup(clearReturnTimer);

  const squareUnder = (clientX: number, clientY: number): Square | null => {
    const el = document.elementFromPoint(clientX, clientY);
    const sq = el?.closest?.("[data-square]")?.getAttribute("data-square");
    return sq && /^[a-h][1-8]$/.test(sq) ? (sq as Square) : null;
  };

  const resolveHover = (clientX: number, clientY: number) => {
    const square = squareUnder(clientX, clientY);
    if (!square) {
      setHover(null);
      return null;
    }
    const piece = game().get(square);
    if (!piece || piece.color !== activePlayerColor()) {
      setHover(null);
      return null;
    }
    const next: HoverState = {
      square,
      piece: piece.type,
      x: clientX,
      y: clientY,
    };
    setHover(next);
    return next;
  };

  const finishCancel = () => {
    clearReturnTimer();
    setDrag(null);
    setHover(null);
    props.onCancel?.();
  };

  const beginReturn = (fromX: number, fromY: number) => {
    const rect = circleEl?.getBoundingClientRect();
    const tx = rect ? rect.left + rect.width / 2 : fromX;
    const ty = rect ? rect.top + rect.height / 2 : fromY;
    setHover(null);
    setDrag({
      pointerId: -1,
      x: fromX,
      y: fromY,
      returning: true,
    });
    // Next frame → target so CSS transition runs.
    requestAnimationFrame(() => {
      setDrag((prev) => (prev ? { ...prev, x: tx, y: ty, returning: true } : null));
    });
    clearReturnTimer();
    returnTimer = window.setTimeout(finishCancel, 240);
  };

  const commitOrCancel = (clientX: number, clientY: number) => {
    const over = resolveHover(clientX, clientY);
    const copy = over ? specialCopyFor(over.piece) : null;
    const freeClassical =
      !!over &&
      over.piece === "p" &&
      canClassicalPawnDouble(currentFen(), over.square);
    const cost = over ? gasCostFor(over.piece) : SPECIAL_ENERGY_COST;
    const canArm =
      over &&
      copy?.deployable &&
      (freeClassical ||
        (!hasUsedSpecialThisTurn(over.square) && energyRemaining() >= cost));
    if (canArm && over) {
      const target = { square: over.square, piece: over.piece };
      setDrag(null);
      setHover(null);
      props.onDeploy?.(target);
      return;
    }
    beginReturn(clientX, clientY);
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    if (gas() <= 0 || drag()) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    clearReturnTimer();
    setDrag({
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      returning: false,
    });
    resolveHover(e.clientX, e.clientY);
  };

  const onPointerMove = (e: PointerEvent) => {
    const d = drag();
    if (!d || d.returning || d.pointerId !== e.pointerId) return;
    setDrag({ ...d, x: e.clientX, y: e.clientY });
    resolveHover(e.clientX, e.clientY);
  };

  const onPointerUp = (e: PointerEvent) => {
    const d = drag();
    if (!d || d.returning || d.pointerId !== e.pointerId) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    commitOrCancel(e.clientX, e.clientY);
  };

  const onPointerCancel = (e: PointerEvent) => {
    const d = drag();
    if (!d || d.returning) return;
    beginReturn(d.x, d.y);
    void e;
  };

  const hoverCopy = () => {
    const h = hover();
    if (!h) return null;
    const base = specialCopyFor(h.piece);
    if (h.piece === "p" && canClassicalPawnDouble(currentFen(), h.square)) {
      return {
        ...base,
        name: "Double Step (free)",
        description: "Classical double — canister unused, no gas spent.",
        deployable: true,
      };
    }
    if (hasUsedSpecialThisTurn(h.square)) {
      return {
        ...base,
        name: `${base.name} (used)`,
        description: "This unit already used its special this turn.",
        deployable: false,
      };
    }
    const cost = gasCostFor(h.piece);
    if (base.deployable && energyRemaining() < cost) {
      return {
        ...base,
        name: "Not enough gas",
        description: `${cost} required`,
        deployable: false,
      };
    }
    return cost === SPECIAL_ENERGY_COST
      ? base
      : { ...base, name: `${base.name} · ${cost} gas` };
  };

  return (
    <div class={styles.dock} data-testid="gas-deploy" role="group" aria-label="Vespene deploy">
      <div class={styles.circleBase}>
        <button
          ref={(el) => {
            circleEl = el;
          }}
          type="button"
          class={styles.circle}
          classList={{
            [styles.circleEmpty]: dockCount() <= 0 && !drag(),
            [styles.circleDragging]: !!drag() && !drag()!.returning,
          }}
          aria-label={
            gas() > 0
              ? `Drag vespene to a unit (${gas()} remaining)`
              : "No vespene remaining"
          }
          disabled={gas() <= 0 && !drag()}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        >
          <Show when={dockCount() > 0}>
            <span class={`${styles.canister} ${styles.readyCanister}`} aria-hidden="true">
              <VespeneIcon size={CANISTER * 0.55} />
            </span>
          </Show>
        </button>
      </div>

      <div class={styles.oval} aria-hidden="true">
        <div class={styles.track}>
          <For each={RESERVE_SLOTS}>
            {(i) => (
              <span
                class={styles.reserve}
                classList={{ [styles.reserveHidden]: i >= reserveCount() }}
                data-reserve={i}
                data-active={i < reserveCount() ? "true" : "false"}
              >
                <span class={styles.canister}>
                  <VespeneIcon size={22} />
                </span>
              </span>
            )}
          </For>
        </div>
      </div>

      <Show when={drag()}>
        {(d) => (
          <Portal>
            <div
              class={styles.ghost}
              classList={{ [styles.ghostReturning]: d().returning }}
              style={{ left: `${d().x}px`, top: `${d().y}px` }}
              data-drag-count={dragCount()}
              aria-hidden="true"
            >
              <span class={styles.ghostCanister}>
                <VespeneIcon size={CANISTER * 0.55} />
              </span>
              <Show when={dragCount() > 1}>
                <span class={`${styles.ghostCanister} ${styles.ghostBuddy}`}>
                  <VespeneIcon size={CANISTER * 0.5} />
                </span>
              </Show>
            </div>
            <Show when={hoverCopy()}>
              {(copy) => (
                <div
                  class={styles.preview}
                  style={{
                    left: `${hover()!.x}px`,
                    top: `${hover()!.y}px`,
                  }}
                >
                  <SpecialPreview copy={copy()} />
                </div>
              )}
            </Show>
          </Portal>
        )}
      </Show>
    </div>
  );
};
