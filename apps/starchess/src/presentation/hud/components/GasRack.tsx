// SPEC: _spec/apps/starchess/architecture/base-screen.puml, _spec/apps/starchess/screens.puml
/**
 * Footer gas rack — drag a vespene canister onto a friendly unit to arm its special.
 * Match HUD (lives with ResourceBar / TurnBar), not the app shell kit.
 */
import { placementToMap } from "@chess-coach/starchess-core";
import type { PieceSymbol, Square } from "chess.js";
import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  type Component,
} from "solid-js";
import { Portal } from "solid-js/web";

import {
  classicFenForViewer,
  energyRemaining,
  hasUsedSpecialThisTurn,
  viewerColor,
} from "~/app/matchEconomy";
import { useMatchStore } from "~/app/MatchStoreContext";
import { ChatBubble } from "~/components/primitives/ChatBubble";
import { VespeneIcon } from "~/components/primitives/icons";
import { SpecialPreview } from "~/components/primitives/SpecialPreview";
import { useIsDesktopClient } from "~/hooks/useIsDesktopClient";
import { SPECIAL_ENERGY_COST } from "~/presentation/constants";
import styles from "~/presentation/hud/components/GasRack.module.css";
import { specialCopyFor } from "~/presentation/specials/copy";
import type { GasDeployTarget } from "~/presentation/specials/types";

type GasDeployProps = {
  /**
   * Fired when a canister is dropped on a deployable unit.
   * Does **not** spend gas — piece specials spend when the action commits.
   */
  onDeploy?: (target: GasDeployTarget) => void;
  /** Fired when a drag cancels (miss / TBD unit / pointer cancel). */
  onCancel?: () => void;
  /** MobileBanner density — smaller rack. */
  compact?: boolean;
  class?: string;
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
/** Per-unit vespene cost (Mecha Charon Booster Missiles = 2; default = 1). */
const gasCostFor = (piece: PieceSymbol): number =>
  specialCopyFor(piece).gasCost ?? SPECIAL_ENERGY_COST;
const RESERVE_SLOTS = Array.from({ length: MAX_RESERVES }, (_, i) => i);

export const GasRack: Component<GasDeployProps> = (props) => {
  const store = useMatchStore();
  const gas = () => Math.max(0, energyRemaining(store));

  const [drag, setDrag] = createSignal<DragState | null>(null);
  const [hover, setHover] = createSignal<HoverState | null>(null);
  /**
   * In-flow rack → the hint is a footer-region overlay. The dynamic band's rack
   * is portaled to a viewport-fixed dock with no such ancestor, so that one
   * anchors to the dock instead (there is no footer band to sit in).
   */
  const [inFooterRegion, setInFooterRegion] = createSignal(true);
  /**
   * Only a client that plausibly *has* an Esc key is told about one; every other
   * device gets the drop-outside half, which is true everywhere.
   */
  const desktopClient = useIsDesktopClient();
  let circleEl: HTMLButtonElement | undefined;
  let dockEl: HTMLDivElement | undefined;
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

  /**
   * Which anchor applies. Read per lift rather than at mount: the band can flip
   * between the in-flow rack and the floating dock while the screen is open.
   */
  const measureHintAnchor = () => {
    setInFooterRegion(!!dockEl?.closest('[data-region="bottom"]'));
  };

  const cancelHint = () =>
    desktopClient()
      ? "Press Esc — or drop outside the board — to cancel"
      : "Drop your gas outside of the board to cancel";

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
    const state = store.shell();
    const color = viewerColor(store);
    let map: ReturnType<typeof placementToMap>;
    try {
      map = placementToMap(state.liveSnapshot.placement);
    } catch {
      // Timeline commits publish intermediate placements that `placementToMap`
      // rejects (same guard `LiveLessonHost` keeps on forced rook mode). A drop
      // that lands in that window must read as "no unit here" — throwing out of
      // the gesture is what used to strand the lift mid-air.
      setHover(null);
      return null;
    }
    const queue = state.liveSnapshot.queue?.actions ?? [];
    const myClassical = queue.filter(
      (a) => a.timing === "C" && a.kind === "classical" && a.color === color,
    );

    // Destination ghost — gas the unit that intends to land here (queue on origin).
    const ghostC = myClassical.find((a) => a.to === square);
    if (ghostC) {
      const actor = map.get(ghostC.from);
      if (actor && actor.color === color) {
        const next: HoverState = {
          square: ghostC.from,
          piece: actor.type,
          x: clientX,
          y: clientY,
        };
        setHover(next);
        return next;
      }
    }

    // Vacated origin — piece already queued away; drop on the ghost instead.
    if (myClassical.some((a) => a.from === square)) {
      setHover(null);
      return null;
    }

    const piece = map.get(square);
    if (!piece || piece.color !== color) {
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

  /**
   * One live lift = one set of `window` listeners.
   *
   * The release deliberately does **not** hang off the button. `setPointerCapture`
   * is a nice-to-have — it keeps squares from hovering under the travelling
   * canister — but it is not load-bearing: capture can be lost (element
   * re-render, browser quirk, a release the button never sees), and when it was
   * the only route the terminal event took, the lift stranded with
   * `returning: false`. Ghost frozen to the screen, hint still up, and
   * `onPointerDown` bailing on `drag()` for every retry until a reload.
   *
   * Keyed on the pointer id alone (`dragSession`) so travelling coordinates do
   * not re-subscribe on every move.
   */
  const dragSession = createMemo(() => {
    const d = drag();
    return d && !d.returning ? d.pointerId : null;
  });

  createEffect(() => {
    const pointerId = dragSession();
    if (pointerId == null) return;

    const releaseCapture = () => {
      try {
        circleEl?.releasePointerCapture(pointerId);
      } catch {
        /* never captured, or already released */
      }
    };
    /** Retire the lift wherever it currently is — the canister flies home. */
    const bail = () => {
      const d = drag();
      if (!d || d.returning) return;
      releaseCapture();
      beginReturn(d.x, d.y);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      const d = drag();
      if (!d || d.returning) return;
      // Mouse moving with no button held = the release happened somewhere we
      // never heard about (outside the window, over browser chrome). Recover.
      if (e.pointerType === "mouse" && e.buttons === 0) {
        bail();
        return;
      }
      setDrag({ ...d, x: e.clientX, y: e.clientY });
      resolveHover(e.clientX, e.clientY);
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      const d = drag();
      if (!d || d.returning) return;
      releaseCapture();
      commitOrCancel(e.clientX, e.clientY);
    };

    const onPointerCancelEvent = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      bail();
    };

    /** Esc is the desktop half of the cancel contract (touch drops outside). */
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      bail();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onPointerCancelEvent);
    window.addEventListener("keydown", onKeyDown);
    // Focus loss (alt-tab, devtools, OS switcher) never sends a release.
    window.addEventListener("blur", bail);
    onCleanup(() => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onPointerCancelEvent);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", bail);
    });
  });

  /**
   * Decide the drop. Every read here runs against a board that may be mid-commit,
   * so the whole decision is fail-safe: anything unexpected degrades to the miss
   * path (canister flies home) instead of escaping the pointer handler, which
   * would leave `drag()` set with `returning: false` — ghost stuck to the screen
   * and `onPointerDown` refusing every retry.
   */
  const commitOrCancel = (clientX: number, clientY: number) => {
    let target: GasDeployTarget | null = null;
    try {
      const over = resolveHover(clientX, clientY);
      const copy = over ? specialCopyFor(over.piece) : null;
      const cost = over ? gasCostFor(over.piece) : SPECIAL_ENERGY_COST;
      const canArm =
        over &&
        copy?.deployable &&
        !hasUsedSpecialThisTurn(store, over.square) &&
        energyRemaining(store) >= cost;
      if (canArm && over) target = { square: over.square, piece: over.piece };
    } catch {
      target = null;
    }
    if (target) {
      setDrag(null);
      setHover(null);
        // Outside the guard on purpose — arming owns its own failures, and by here
      // the lift is already retired, so a throw cannot strand anything.
      props.onDeploy?.(target);
      return;
    }
    beginReturn(clientX, clientY);
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    if (gas() <= 0 || drag()) return;
    e.preventDefault();
    // Best-effort only: the lift's terminal events come from `window`, so losing
    // this capture costs a little hover polish, never the drop.
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* capture refused — window listeners still carry the gesture */
    }
    clearReturnTimer();
    setDrag({
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      returning: false,
    });
    measureHintAnchor();
    resolveHover(e.clientX, e.clientY);
  };

  const hoverCopy = () => {
    const h = hover();
    if (!h) return null;
    const base = specialCopyFor(h.piece);
    if (hasUsedSpecialThisTurn(store, h.square)) {
      return {
        ...base,
        name: `${base.name} (used)`,
        description: "This unit already used its special this turn.",
        deployable: false,
      };
    }
    const cost = gasCostFor(h.piece);
    if (base.deployable && energyRemaining(store) < cost) {
      return {
        ...base,
        name: "Not enough gas",
        description: `${cost} required`,
        deployable: false,
      };
    }
    return cost === SPECIAL_ENERGY_COST ? base : { ...base, name: `${base.name} · ${cost} gas` };
  };

  // Touch fen helper so Solid tracks economy/placement for hover copy.
  void classicFenForViewer(store);

  return (
    <div
      ref={(el) => {
        dockEl = el;
      }}
      class={`${styles.dock}${props.compact ? ` ${styles.compact}` : ""}${props.class ? ` ${props.class}` : ""}`}
      data-testid="gas-deploy"
      role="group"
      aria-label="Vespene deploy"
    >
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
            gas() > 0 ? `Drag vespene to a unit (${gas()} remaining)` : "No vespene remaining"
          }
          disabled={gas() <= 0 && !drag()}
          onPointerDown={onPointerDown}
        >
          <Show when={dockCount() > 0}>
            <span class={`${styles.canister} ${styles.readyCanister}`} aria-hidden="true">
              <VespeneIcon size={CANISTER * 0.55} />
            </span>
          </Show>
        </button>
      </div>

      <Show when={!!drag() && !drag()!.returning}>
        <div
          class={styles.cancelHint}
          classList={{ [styles.cancelHintFloating]: !inFooterRegion() }}
          data-testid="gas-cancel-hint"
        >
          <ChatBubble testId="gas-cancel-hint-bubble" class={styles.cancelHintBubble}>
            {cancelHint()}
          </ChatBubble>
        </div>
      </Show>

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
              <Show when={dragCount() > 2}>
                <span
                  class={`${styles.ghostCanister} ${styles.ghostBuddy} ${styles.ghostBuddyFar}`}
                >
                  <VespeneIcon size={CANISTER * 0.45} />
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
                  <SpecialPreview
                    unit={copy().unit}
                    name={copy().name}
                    description={copy().description}
                  />
                </div>
              )}
            </Show>
          </Portal>
        )}
      </Show>
    </div>
  );
};
