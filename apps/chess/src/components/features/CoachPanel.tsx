// SPEC: _spec/apps/chess/components.puml, _spec/apps/chess/responsiveness/rules.md
import { Chess } from "chess.js";
import { For, Show, createEffect, createSignal, on, onCleanup, onMount } from "solid-js";
import type { Component } from "solid-js";

import styles from "~/components/features/CoachPanel.module.css";
import { lastHumanMoveInfo } from "~/hooks/useMoveExecutor";
import { useTravelMode } from "~/hooks/useTravelMode";
import {
  advice,
  coachEmotion,
  hoverBlunder,
  hoverBlunderFen,
  hoverBlunderSan,
  panelMessage,
  pendingTravel,
  setAdviceArrow,
  setAdviceHoveredSquares,
} from "~/store/coachStore";
import { currentFen } from "~/store/gameStore";
import { isTravelling } from "~/store/travelStore";
import { footerFloat } from "~/store/viewportLayoutStore";
import { MOBILE_MQ } from "~/utils/breakpoints";
import {
  measureAvatarHeightBudget,
  measureShellChrome,
  observeFooterFloatLayout,
  syncFooterFloatAttr,
} from "~/utils/footerFloatMeasure";

// Regex to match standard algebraic notation (SAN) and raw squares
// Matches: e4, Nf3, Bxc6+, O-O, O-O-O, e8=Q
const CHESS_NOTATION_REGEX =
  /(\b[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?\b|\bO-O(?:-O)?\b)/g;

/** Touch / phone: prefer Tap affordance over keyboard Space. */
function useTouchPreferTap() {
  const [preferTap, setPreferTap] = createSignal(false);
  onMount(() => {
    const mq = window.matchMedia(`${MOBILE_MQ}, (hover: none) and (pointer: coarse)`);
    const sync = () => setPreferTap(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    onCleanup(() => mq.removeEventListener("change", sync));
  });
  return preferTap;
}

export const CoachPanel: Component = () => {
  const { activateTravel, loading } = useTravelMode();
  const preferTap = useTouchPreferTap();

  const handleWhyTap = () => {
    if (loading()) return;
    const pending = pendingTravel();
    const fen = hoverBlunderFen() ?? pending?.blunderFen;
    const san = hoverBlunderSan() ?? pending?.blunderSan;
    const fenBefore = pending?.fenBefore;
    if (fen && san) activateTravel(fen, san, fenBefore);
  };

  let activeTapSan = "";

  const highlightSan = (text: string) => {
    const squares = text.match(/[a-h][1-8]/g) || [];
    setAdviceHoveredSquares(squares);

    try {
      const game = new Chess(currentFen());
      const match = game.moves({ verbose: true }).find((m) => m.san === text);
      if (match) {
        setAdviceArrow({ from: match.from, to: match.to });
      } else {
        setAdviceArrow(null);
      }
    } catch {
      setAdviceArrow(null);
    }
  };

  const clearHighlight = () => {
    setAdviceHoveredSquares([]);
    setAdviceArrow(null);
    activeTapSan = "";
  };

  const handleMouseEnter = (text: string) => highlightSan(text);
  const handleMouseLeave = () => clearHighlight();

  const handleTap = (text: string) => {
    if (activeTapSan === text) {
      clearHighlight();
    } else {
      activeTapSan = text;
      highlightSan(text);
    }
  };

  // Animation state for the whole panel (slide + bounce)
  const [isVisible, setIsVisible] = createSignal(false);
  const [animClass, setAnimClass] = createSignal<"enter" | "exit" | "">("");
  const [prevMessage, setPrevMessage] = createSignal("");

  // §4 floating mode
  const [floatVisible, setFloatVisible] = createSignal(false);
  const [dismissedSig, setDismissedSig] = createSignal<string | null>(null);
  const [floatMaxHeight, setFloatMaxHeight] = createSignal("4rem");

  /** Message + why-hint — blunder UI must re-open the float even if advice text is unchanged. */
  const contentSig = () => {
    const why = (hoverBlunder() || pendingTravel()) && !isTravelling();
    return `${panelMessage().trim()}::why:${why ? "1" : "0"}`;
  };

  const hasFloatContent = () => {
    const sig = contentSig();
    if (sig === dismissedSig()) return false;
    // Empty message with no why-hint is not showable.
    if (!panelMessage().trim() && !(hoverBlunder() || pendingTravel())) return false;
    return true;
  };

  const measureFloatMode = () => {
    const shell = document.querySelector<HTMLElement>('[data-testid="screen-root"]');
    if (!shell) {
      syncFooterFloatAttr(false);
      return;
    }
    const { topH, midContentH } = measureShellChrome(shell);
    // Fit check uses the *in-flow* CoachPanel budget (--avatar-height), not the
    // compact avatar, so enabling float does not immediately flip back off.
    const inFlowBudget = measureAvatarHeightBudget();
    // Cap against the in-flow panel budget (--avatar-height), not the compact
    // bar avatar — half of the peeking avatar is too small for advice + Why.
    setFloatMaxHeight(`${Math.max(24, inFlowBudget * 0.5)}px`);
    syncFooterFloatAttr(topH + midContentH + inFlowBudget > window.innerHeight + 1);
  };

  onMount(() => {
    const disconnect = observeFooterFloatLayout(measureFloatMode);
    onCleanup(() => {
      disconnect();
      syncFooterFloatAttr(false);
    });
  });

  // Inline panel show/hide (normal viewport).
  createEffect(() => {
    if (footerFloat()) return;
    const current = panelMessage().trim();
    const wasVisible = isVisible();
    const messageChanged = current !== prevMessage();

    if (current && (!wasVisible || messageChanged)) {
      setIsVisible(true);
      setAnimClass("enter");
      setPrevMessage(current);
    } else if (!current && wasVisible) {
      setAnimClass("exit");
      const timeout = setTimeout(() => {
        setIsVisible(false);
        setAnimClass("");
        setPrevMessage("");
      }, 300);
      onCleanup(() => clearTimeout(timeout));
    }
  });

  // §4: float the CoachPanel instantly whenever there is undismissed content.
  createEffect(() => {
    if (!footerFloat()) {
      setFloatVisible(false);
      return;
    }

    void coachEmotion();
    void contentSig();
    setIsVisible(false);

    if (!hasFloatContent()) {
      setFloatVisible(false);
      return;
    }

    setAnimClass("enter");
    setFloatVisible(true);
    setPrevMessage(panelMessage().trim());
  });

  // Leaving a blunder hover episode clears dismiss so re-hovering can warn again.
  let wasWhy = false;
  createEffect(() => {
    const why = (hoverBlunder() || pendingTravel()) && !isTravelling();
    if (why && !wasWhy) setDismissedSig(null);
    wasWhy = !!why;
  });

  // Auto-hide on human move — do NOT stamp dismissedSig: coach behavior may
  // already have written the next thinking/advice line on this same tick, and
  // marking that as "dismissed" permanently suppresses post-move messages.
  createEffect(
    on(
      lastHumanMoveInfo,
      () => {
        if (!footerFloat()) return;
        setFloatVisible(false);
        setDismissedSig(null);
      },
      { defer: true },
    ),
  );

  const dismissFloat = () => {
    setFloatVisible(false);
    setDismissedSig(contentSig());
  };

  const parsedAdvice = () => advice().split(CHESS_NOTATION_REGEX);

  const adviceBody = () => (
    <Show when={advice().trim().length > 0}>
      <p>
        <strong>Coach Selena:</strong>{" "}
        <For each={parsedAdvice()}>
          {(part) => {
            if (part.match(CHESS_NOTATION_REGEX)) {
              return (
                <span
                  class={styles["move-highlight"]}
                  onMouseEnter={() => handleMouseEnter(part)}
                  onMouseLeave={handleMouseLeave}
                  onClick={() => handleTap(part)}
                >
                  {part}
                </span>
              );
            }
            return <span>{part}</span>;
          }}
        </For>
      </p>
    </Show>
  );

  const whyHint = () => (
    <Show when={(hoverBlunder() || pendingTravel()) && !isTravelling()}>
      <span class={styles["why-hint"]} onClick={handleWhyTap}>
        <Show
          when={preferTap()}
          fallback={
            <>
              Press <kbd>Space</kbd> — To learn why
            </>
          }
        >
          Tap here — To learn why
        </Show>
      </span>
    </Show>
  );

  const panelVisible = () => (footerFloat() ? floatVisible() : isVisible());

  return (
    <Show when={panelVisible()}>
      <div
        data-testid={footerFloat() ? "floating-advice" : undefined}
        class={`${styles["coach-panel"]} ${styles[animClass()]} ${footerFloat() ? styles.floating : ""}`}
        style={footerFloat() ? { "max-height": floatMaxHeight() } : undefined}
        role={footerFloat() ? "status" : undefined}
      >
        <div class={styles["panel-body"]}>
          {adviceBody()}
          {whyHint()}
        </div>
        <Show when={footerFloat()}>
          <button
            type="button"
            class={styles["floating-dismiss"]}
            aria-label="Dismiss advice"
            onClick={dismissFloat}
          >
            ×
          </button>
        </Show>
      </div>
    </Show>
  );
};
