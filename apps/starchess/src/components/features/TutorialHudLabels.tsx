// SPEC: _spec/apps/starchess/screens.puml
/**
 * Tutorial-only naming layer for HUD chrome the lessons talk about but never
 * spells out: the unit tiles in the deploy / promotion pickers, and the three
 * ResourceBar strips.
 *
 * Nothing it labels knows it is being taught from. Anchors are found by test id
 * and measured into a portal, so `DeployModal` / `PromotionModal` /
 * `ResourceBar` stay untouched and the labels vanish outside the tutorial.
 */
import type { PieceSymbol } from "chess.js";
import { For, createSignal, onCleanup, onMount, type Component } from "solid-js";
import { Portal } from "solid-js/web";

import { ChatBubble } from "@chess-coach/ui-web/primitives/ChatBubble";
import styles from "~/components/features/TutorialHudLabels.module.css";
import { specialCopyFor } from "~/presentation/specials/copy";

/** Unit pickers — one attribute each, both keyed by piece symbol. */
const PICKERS = [
  { host: '[data-testid="deploy-modal"]', attr: "data-spawn-piece" },
  { host: '[data-testid="promotion-modal"]', attr: "data-promo-piece" },
] as const;

/** ResourceBar strips, in render order (minerals · vespene · supply). */
const STRIP_LABELS = [
  "Available Materials",
  "Available Gas",
  "Total Deployed Material",
] as const;

type Placed = {
  key: string;
  text: string;
  /** Anchor centre x and the edge the bubble hangs off, in viewport px. */
  x: number;
  y: number;
  /** Widest the bubble may get before wrapping. */
  maxWidth: number;
  place: "above" | "below";
};

/** Gap between an anchor edge and its label. */
const OFFSET = 6;
/** Clear air between two neighbouring labels. */
const GUTTER = 6;
/** No label needs to be wider than this, however much room a row has. */
const MAX_WIDTH = 160;

/**
 * Widest each label in a row may get without touching its neighbours. Labels
 * are centred on their anchor, so two adjacent ones clear each other exactly
 * when each is narrower than the distance between their centres.
 */
const widthFor = (centres: number[]): number => {
  let closest = Infinity;
  for (let i = 1; i < centres.length; i++) {
    closest = Math.min(closest, Math.abs(centres[i]! - centres[i - 1]!));
  }
  return Math.min(MAX_WIDTH, closest - GUTTER);
};

const measure = (): Placed[] => {
  const out: Placed[] = [];

  const row = (
    anchors: { el: HTMLElement; key: string; text: string }[],
    place: "above" | "below",
  ) => {
    const rects = anchors.map((a) => a.el.getBoundingClientRect());
    const width = widthFor(rects.map((r) => r.left + r.width / 2));
    anchors.forEach((a, i) => {
      const r = rects[i]!;
      if (r.width === 0) return;
      out.push({
        key: a.key,
        text: a.text,
        x: r.left + r.width / 2,
        y: place === "below" ? r.bottom + OFFSET : r.top - OFFSET,
        maxWidth: width,
        place,
      });
    });
  };

  for (const { host, attr } of PICKERS) {
    for (const picker of document.querySelectorAll(host)) {
      row(
        [...picker.querySelectorAll<HTMLElement>(`[${attr}]`)].flatMap((el) => {
          const piece = el.getAttribute(attr);
          const copy = piece ? specialCopyFor(piece as PieceSymbol) : undefined;
          return copy
            ? [{ el, key: `${attr}:${piece}:${Math.round(el.getBoundingClientRect().left)}`, text: copy.unit }]
            : [];
        }),
        "below",
      );
    }
  }

  for (const bar of document.querySelectorAll('[data-testid="resource-bar"]')) {
    // The strips are the bar's element children minus the optional name span;
    // `ResourceBar` gives them no ids of their own, so order is the only handle.
    const strips = [...bar.children].filter(
      (el): el is HTMLElement => el instanceof HTMLElement && el.tagName === "DIV",
    );
    row(
      strips.slice(0, STRIP_LABELS.length).map((el, i) => ({
        el,
        key: `strip:${i}:${Math.round(el.getBoundingClientRect().left)}`,
        text: STRIP_LABELS[i]!,
      })),
      "above",
    );
  }

  return out;
};

const sameLayout = (a: Placed[], b: Placed[]) =>
  a.length === b.length &&
  a.every((p, i) => {
    const q = b[i]!;
    return (
      p.text === q.text &&
      Math.round(p.x) === Math.round(q.x) &&
      Math.round(p.y) === Math.round(q.y) &&
      Math.round(p.maxWidth) === Math.round(q.maxWidth)
    );
  });

export type TutorialHudLabelsProps = {
  /** Off by default — tutorial hosts pass `tutorial`, stories opt in directly. */
  enabled?: boolean;
};

export const TutorialHudLabels: Component<TutorialHudLabelsProps> = (props) => {
  const [placed, setPlaced] = createSignal<Placed[]>([]);

  onMount(() => {
    let frame: number | undefined;
    let settleUntil = 0;

    const sync = () => {
      frame = undefined;
      if (!props.enabled) {
        if (placed().length) setPlaced([]);
      } else {
        const next = measure();
        setPlaced((prev) => (sameLayout(prev, next) ? prev : next));
      }
      // Pickers animate in, so one post-mutation read lands mid-transform —
      // keep re-reading briefly until the rects stop moving.
      if (performance.now() < settleUntil) schedule(0);
    };

    const schedule = (settleMs = 400) => {
      settleUntil = Math.max(settleUntil, performance.now() + settleMs);
      if (frame == null) frame = requestAnimationFrame(sync);
    };

    const observer = new MutationObserver(() => schedule());
    observer.observe(document.body, { childList: true, subtree: true });
    const onViewport = () => schedule(0);
    window.addEventListener("resize", onViewport);
    window.addEventListener("scroll", onViewport, true);
    schedule();

    onCleanup(() => {
      observer.disconnect();
      window.removeEventListener("resize", onViewport);
      window.removeEventListener("scroll", onViewport, true);
      if (frame != null) cancelAnimationFrame(frame);
    });
  });

  return (
    <Portal>
      <div class={styles.layer} data-testid="tutorial-hud-labels" aria-hidden="true">
        <For each={placed()}>
          {(p) => (
            <div
              class={styles.slot}
              classList={{ [styles.above!]: p.place === "above" }}
              style={{
                left: `${p.x}px`,
                top: `${p.y}px`,
                "--label-max": `${p.maxWidth}px`,
              }}
            >
              <ChatBubble class={styles.label}>{p.text}</ChatBubble>
            </div>
          )}
        </For>
      </div>
    </Portal>
  );
};
