// SPEC: _spec/apps/ui/components.puml
import { Show, createSignal } from "solid-js";
import type { Component, JSX } from "solid-js";

import { ResignConfirm } from "~/components/atoms/ResignConfirm";
import { openMobileDrawer } from "~/components/features/MobileDrawer";
import { MobileSidebar } from "~/components/features/MobileSidebar";
import { DualNavButton } from "~/components/primitives/DualNavButton";
import { IconButton } from "~/components/primitives/IconButton";
import { FlagIcon, HamburgerIcon, HintIcon, PlusCircleIcon } from "~/components/primitives/icons";
import { useFlip } from "~/hooks/useFlip";
import { useGameControls } from "~/hooks/useGameControls";
import { useHintSparkle } from "~/hooks/useHintSparkle";
import { capabilities } from "~/store/capabilitiesStore";
import { resetGame, reviewAnalysisMode } from "~/store/gameStore";
import { isTravelling, travelFenHistory, travelIndex } from "~/store/travelStore.ts";

/**
 * The MobileSidebar bar for the engine-backed board screens (Coach / Analysis /
 * Review): menu trigger (leftmost) + per-screen `center` slot + capability-gated
 * quick actions — hint, history nav, resign, new game. Flip stays in the
 * {@link MobileDrawer} menu and desktop {@link Sidebar}. Resign's confirm dialog
 * renders as a sibling of the bar (not an Item), so the bar's fan-out / max-4
 * rules don't touch it.
 *
 * Source order of left Items is chosen so Coach reads
 * `[menu][hint][resign] · avatar · [nav]` after CSS fan-out + drawer pin.
 * Analysis / Review title toolbars own the menu instead (`omitDrawer`) so the
 * tall-mobile fixed float does not cover the matchup title.
 */
export const BoardControls: Component<{
  center?: JSX.Element;
  centerOverflow?: boolean;
  /** Skip the hamburger — screen mounts it in a title toolbar instead. */
  omitDrawer?: boolean;
}> = (props) => {
  const { hintSparkleClass, dismissHintSparkle } = useHintSparkle();
  const {
    atStart,
    atLatest,
    isReplaying,
    isResigned,
    pendingHint,
    handleBack,
    handleForward,
    handleBackToLive,
    handleHint,
    handleResign: baseHandleResign,
  } = useGameControls();
  const [showResignConfirm, setShowResignConfirm] = createSignal(false);
  const inTimelineMode = () => isTravelling() || isReplaying() || reviewAnalysisMode();

  // Slide the nav between its in-bar dock and the top-right corner as the bar
  // collapses / re-expands on entering / leaving timeline mode.
  let navEl: HTMLDivElement | undefined;
  useFlip(() => navEl, inTimelineMode);

  return (
    <>
      <MobileSidebar timeline={inTimelineMode()} centerOverflow={props.centerOverflow}>
        <Show when={props.center}>
          <MobileSidebar.Main>{props.center}</MobileSidebar.Main>
        </Show>

        {/* Nearest-centre left control first → resign sits next to avatar */}
        <Show when={capabilities().aiOpponent}>
          <MobileSidebar.Item>
            <IconButton
              onClick={() => setShowResignConfirm(true)}
              disabled={isResigned() || isReplaying() || isTravelling()}
              aria-label="Resign"
            >
              <FlagIcon />
            </IconButton>
          </MobileSidebar.Item>
        </Show>

        <Show when={capabilities().historyNav}>
          <MobileSidebar.Item nav ref={(el) => (navEl = el)}>
            <DualNavButton
              onBack={handleBack}
              onForward={handleForward}
              backDisabled={atStart() && !isTravelling()}
              forwardDisabled={atLatest()}
              inverted={inTimelineMode()}
              showBackToLive={inTimelineMode()}
              onBackToLive={handleBackToLive}
              label={
                isTravelling()
                  ? `Timeline ${travelIndex()}/${travelFenHistory().length - 1}`
                  : inTimelineMode()
                    ? "History"
                    : undefined
              }
            />
          </MobileSidebar.Item>
        </Show>

        <Show when={capabilities().hint}>
          <MobileSidebar.Item>
            <IconButton
              class={hintSparkleClass()}
              onClick={() => {
                dismissHintSparkle();
                void handleHint();
              }}
              disabled={pendingHint() || isReplaying() || isTravelling()}
              aria-label="Get a hint"
            >
              <HintIcon />
            </IconButton>
          </MobileSidebar.Item>
        </Show>

        <Show when={!capabilities().aiOpponent && !capabilities().readOnly && capabilities().flipBoard}>
          <MobileSidebar.Item>
            <IconButton onClick={() => resetGame()} aria-label="New game">
              <PlusCircleIcon />
            </IconButton>
          </MobileSidebar.Item>
        </Show>

        {/* Last in source + drawer pin → leftmost on short; floats top-left on
            tall mobile / timeline (Coach). Analysis/Review pass omitDrawer and
            mount the menu in their title toolbar instead. */}
        <Show when={!props.omitDrawer}>
          <MobileSidebar.Item drawer>
            <IconButton onClick={openMobileDrawer} aria-label="Open menu">
              <HamburgerIcon />
            </IconButton>
          </MobileSidebar.Item>
        </Show>
      </MobileSidebar>

      <ResignConfirm
        open={showResignConfirm()}
        onClose={() => setShowResignConfirm(false)}
        onConfirm={() => {
          setShowResignConfirm(false);
          baseHandleResign();
        }}
      />
    </>
  );
};
