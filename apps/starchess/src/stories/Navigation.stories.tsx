// SPEC: _spec/apps/starchess/navigation-chrome.md
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { createSignal } from "solid-js";

import { Breadcrumb } from "@chess-coach/ui-web/primitives/Breadcrumb";
import { ChevronNav } from "@chess-coach/ui-web/primitives/ChevronNav";
import { ScreenBackNav } from "~/components/primitives/ScreenBackNav";
import { CoachAvatar } from "~/components/atoms/CoachAvatar";
import { MatchHistoryFilters } from "@chess-coach/ui-web/atoms/MatchHistoryFilters";
import { StarChessMobileBanner as MobileBanner } from "@chess-coach/ui-web/atoms/StarChessMobileBanner";
import { StarChessMobileSubBanner as MobileSubBanner } from "@chess-coach/ui-web/atoms/StarChessMobileSubBanner";
import { ReviewTurnNav } from "@chess-coach/ui-web/atoms/ReviewTurnNav";
import { FULL_ARMY_SAMPLE, OPEN_BOARD_SAMPLE } from "~/demos/samples";
import { ResourceBar } from "~/presentation/hud/components/ResourceBar";
import { TurnBar } from "~/presentation/hud/components/TurnBar";
import { StaticScfenBoard } from "~/presentation/board/components/StaticScfenBoard";
import { WithMatchStore } from "~/stories/project";
import { useMediaQuery } from "~/hooks/useMediaQuery";
import { DYNAMIC_MOBILE_MQ } from "~/utils/breakpoints";
import styles from "~/stories/Navigation.stories.module.css";

const meta = {
  title: "Navigation/Chrome",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Back / turn / section chrome. Desktop: in-flow ‹ Back nav + bars. Mobile (< 720px): one black stripe `‹ Back · centre` on every screen, with the screen's own row under it (MobileSubBanner); the dynamic band (short landscape) folds everything into the stripe. Touch targets clear 40×40px on mobile.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const TUTORIAL_SECTIONS = [
  { id: "fog", label: "Fog of War" },
  { id: "specials", label: "Special Moves" },
  { id: "resolve", label: "Turn Resolution" },
  { id: "live-play", label: "Live Play" },
];

export const SingleDesktopChrome: Story = {
  name: "Single player · desktop top chrome",
  parameters: {
    route: "/single?map=eclipse&team=w",
    viewport: { defaultViewport: "desktop" },
    docs: {
      description: {
        story:
          "Desktop only: in-flow ‹ Back + match title, then the turn bar and the ResourceBar, content-sized. Phones use the mobile banner instead.",
      },
    },
  },
  render: () => (
    <WithMatchStore board={FULL_ARMY_SAMPLE}>
      <div class={styles.pad}>
        <ScreenBackNav onBack={() => undefined} data-testid="live-back">
          <span class={styles.titleHint}>Game vs Adjutant (Script)</span>
        </ScreenBackNav>
        <div class={styles.topChrome} data-testid="starchess-board-chrome">
          <div class={styles.turnFill}>
            <TurnBar autoStart={false} resolveOnEnd={false} onEnd={() => undefined} />
          </div>
          <ResourceBar class={styles.liveBar} color="w" />
        </div>
      </div>
    </WithMatchStore>
  ),
};

export const SingleMobileBanner: Story = {
  name: "Single player · mobile banner",
  parameters: {
    route: "/single?map=eclipse&team=w",
    viewport: { defaultViewport: "mobile" },
    docs: {
      description: {
        story:
          "Stripe: ‹ Back · ResourceBar (no title in Single Player). No sub-banner: the turn controls sit in the footer tray — see Features/GasDeploy · Mobile HUD dock.",
      },
    },
  },
  render: () => (
    <WithMatchStore board={FULL_ARMY_SAMPLE}>
      <MobileBanner onBack={() => undefined} center={<ResourceBar compact color="w" />} />
    </WithMatchStore>
  ),
};

export const SingleDynamicBanner: Story = {
  name: "Single player · dynamic banner",
  parameters: {
    route: "/single?map=eclipse&team=w",
    viewport: { defaultViewport: "dynamic" },
    docs: {
      description: {
        story:
          "Dynamic viewport (560×420): no sub-banner fits, so the stripe is the whole chrome — ‹ Back [ResourceBar] [TurnBar] — then the board.",
      },
    },
  },
  render: () => (
    <WithMatchStore board={FULL_ARMY_SAMPLE}>
      <MobileBanner
        onBack={() => undefined}
        fill
        center={
          <div class={styles.bannerInline}>
            <ResourceBar compact color="w" class={styles.bannerInlineResources} />
            <TurnBar
              compact
              class={styles.bannerInlineTurn}
              autoStart={false}
              resolveOnEnd={false}
              onEnd={() => undefined}
            />
          </div>
        }
      />
    </WithMatchStore>
  ),
};

export const ReviewDualNav: Story = {
  name: "Review · dual turn nav",
  parameters: {
    viewport: { defaultViewport: "desktop" },
    docs: {
      description: {
        story:
          "Green ‹ › stay 40×40px on each side of the dual bars. Desktop: in-flow ‹ Back + result above, bars side by side. Mobile: the result moves to the stripe; bars stack. Dynamic: compact nameless bars, still flanked by ‹ ›.",
      },
    },
  },
  render: () => {
    const dynamic = useMediaQuery(DYNAMIC_MOBILE_MQ);
    return (
      <WithMatchStore board={FULL_ARMY_SAMPLE}>
        <MobileBanner onBack={() => undefined} title="Win (Blue)" titleColor="win" />
        <div class={styles.pad}>
          <div class={styles.desktopOnly}>
            <ScreenBackNav onBack={() => undefined} data-testid="review-detail-back">
              <span class={styles.titleHint}>Win (Blue)</span>
            </ScreenBackNav>
          </div>
          <ReviewTurnNav onBack={() => undefined} onForward={() => undefined}>
            <div class={styles.dualResources} role="group" aria-label="Both sides resources">
              <ResourceBar
                compact={dynamic()}
                color="w"
                snapshot={undefined}
                name={dynamic() ? undefined : "Alex"}
              />
              <ResourceBar
                compact={dynamic()}
                color="b"
                snapshot={undefined}
                name={dynamic() ? undefined : "Sam"}
              />
            </div>
          </ReviewTurnNav>
        </div>
      </WithMatchStore>
    );
  },
};

export const ReviewListBanner: Story = {
  name: "Review · list banner",
  parameters: {
    viewport: { defaultViewport: "mobile" },
    docs: {
      description: {
        story: "Stripe ‹ Back · Review, then the compact filters row: swatches left, pager right, each clearing 40×40px.",
      },
    },
  },
  render: () => {
    const [color, setColor] = createSignal<"w" | "b">("w");
    return (
      <WithMatchStore board={FULL_ARMY_SAMPLE}>
        <MobileBanner href="/" title="Review" />
        <MobileSubBanner>
          <div class={styles.bannerFilters}>
            <MatchHistoryFilters
              compact
              colorFilter={color()}
              setColorFilter={setColor}
              totalPages={3}
              activePage={0}
              currentDateLabel="Aug 11, 2026"
              goToPrev={() => undefined}
              goToNext={() => undefined}
            />
          </div>
        </MobileSubBanner>
      </WithMatchStore>
    );
  },
};

export const TutorialCoachHeader: Story = {
  name: "Tutorials · coach header + sections",
  parameters: {
    viewport: { defaultViewport: "mobile" },
    docs: {
      description: {
        story:
          "Mobile: stripe ‹ Back · lesson title, Kerrigan below it; section crumbs clear 40px tall (footer grows to fit). Desktop: ‹ Back sits beside Kerrigan in-flow.",
      },
    },
  },
  render: () => (
    <>
      <MobileBanner onBack={() => undefined} title="King" />
      <div class={styles.stack}>
        <ScreenBackNav onBack={() => undefined} data-testid="tutorial-fog-coach-nav">
          <CoachAvatar identity="kerrigan" emotion="idle" />
        </ScreenBackNav>
        <StaticScfenBoard
          scfen={OPEN_BOARD_SAMPLE.scfen}
          boardVariant="eclipse"
          fog={false}
          visionMode="observer"
          caption="Fog of War · Command Center — lesson board"
        />
        <Breadcrumb
          items={[...TUTORIAL_SECTIONS]}
          current="fog"
          onSelect={() => undefined}
          aria-label="Tutorial sections"
          data-testid="tutorial-breadcrumb"
        />
      </div>
    </>
  ),
};

export const TurnArrowsIsolated: Story = {
  name: "Arrows · isolated audit",
  parameters: {
    viewport: { defaultViewport: "mobile" },
    docs: {
      description: {
        story: "Every arrow clears 40×40px on mobile: review ‹ ›, ‹ Back, Share ›. No mirrors, no reflow on desktop.",
      },
    },
  },
  render: () => (
    <WithMatchStore board={FULL_ARMY_SAMPLE}>
      <div class={styles.auditRow}>
        <ReviewTurnNav onBack={() => undefined} onForward={() => undefined}>
          <span class={styles.hint}>turn</span>
        </ReviewTurnNav>
        <ChevronNav direction="back" onClick={() => undefined} aria-label="Back">
          Back
        </ChevronNav>
        <ChevronNav direction="forward" onClick={() => undefined} aria-label="Share">
          Share
        </ChevronNav>
      </div>
    </WithMatchStore>
  ),
};

