// SPEC: _spec/apps/starchess/navigation-chrome.md
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { createSignal } from "solid-js";

import { Breadcrumb } from "~/components/primitives/Breadcrumb";
import { ChevronNav } from "~/components/primitives/ChevronNav";
import { ScreenBackNav } from "~/components/primitives/ScreenBackNav";
import { CoachAvatar } from "~/components/atoms/CoachAvatar";
import { MatchHistoryFilters } from "~/components/atoms/MatchHistoryFilters";
import { MobileBanner } from "~/components/atoms/MobileBanner";
import { ReviewTurnNav } from "~/components/atoms/ReviewTurnNav";
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
          "Back / turn / section chrome across the three screens. Touch targets clear 40×40px on mobile (ChevronNav, review ‹ ›, pager, breadcrumb); live bars sit one row each — content-sized on desktop, full-width on phones; side-by-side only in the dynamic strip.",
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
  { id: "king", label: "King Damage" },
];

export const SingleTopChrome: Story = {
  name: "Single player · top chrome",
  parameters: {
    route: "/single?map=eclipse&team=w",
    viewport: { defaultViewport: "mobile" },
    docs: {
      description: {
        story:
          "Bar-mode top chrome (demos/tutorials — Single ships the sidebar rail, so its own top slot holds the bar alone). Narrow-phone case: nav row first, then one fixed-strip single-row bar — bars never overflow X.",
      },
    },
  },
  render: () => (
    <WithMatchStore board={FULL_ARMY_SAMPLE}>
      <div class={styles.pad}>
        <ScreenBackNav onBack={() => undefined} data-testid="live-back">
          <span class={styles.titleHint}>Game vs Adjutant (Script)</span>
        </ScreenBackNav>          <div class={styles.topChrome} data-testid="starchess-board-chrome">
            <div class={styles.turnFill}>
              <TurnBar autoStart={false} resolveOnEnd={false} onEnd={() => undefined} />
            </div>
            <ResourceBar class={styles.liveBar} color="w" />
          </div>
      </div>
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
          "Dynamic viewport (560×420). Fixed-width compact viewer resources; slack sits left of End Turn.",
      },
    },
  },
  render: () => (
    <WithMatchStore board={FULL_ARMY_SAMPLE}>
      <MobileBanner
        onBack={() => undefined}
        fixedResources
        resources={<ResourceBar compact color="w" />}
        turn={<TurnBar compact autoStart={false} resolveOnEnd={false} onEnd={() => undefined} />}
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
          "Green ‹ › stay 40×40px with the dual bars between them. Desktop: side-by-side named. Mobile: stacked named. Dynamic: compact nameless, arrows dock bottom-right (see review detail).",
      },
    },
  },
  render: () => {

    const dynamic = useMediaQuery(DYNAMIC_MOBILE_MQ);
    return (
      <WithMatchStore board={FULL_ARMY_SAMPLE}>
        <div class={styles.pad}>
          <ScreenBackNav onBack={() => undefined} data-testid="review-detail-back">
            <span class={styles.titleHint}>Win (Blue)</span>
          </ScreenBackNav>
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

export const ReviewListChrome: Story = {
  name: "Review · list chrome",
  parameters: {
    viewport: { defaultViewport: "mobile" },
    docs: {
      description: {
        story:
          "In-flow list chrome: link Back plus Playing-as / date pager at 40×40px. The dynamic band hides this in favor of the banner (next story).",
      },
    },
  },
  render: () => {
    const [color, setColor] = createSignal<"w" | "b">("w");

    return (
      <WithMatchStore board={FULL_ARMY_SAMPLE}>
        <div class={styles.stack}>
          <ScreenBackNav href="/" data-testid="review-back">
            <span class={styles.titleHint}>Win (White)</span>
          </ScreenBackNav>
          <MatchHistoryFilters
            colorFilter={color()}
            setColorFilter={setColor}
            totalPages={3}
            activePage={0}
            currentDateLabel="Aug 11, 2026"
            goToPrev={() => undefined}
            goToNext={() => undefined}
          />
        </div>
      </WithMatchStore>
    );
  },
};

export const ReviewListBanner: Story = {
  name: "Review · list banner",
  parameters: {

    viewport: { defaultViewport: "dynamic" },
    docs: {
      description: {
        story: "Dynamic band: Back plus swatches-left / pager-right, each clearing 40×40px.",
      },
    },
  },
  render: () => {
    const [color, setColor] = createSignal<"w" | "b">("w");
    return (
      <WithMatchStore board={FULL_ARMY_SAMPLE}>
        <MobileBanner
          href="/"
          resources={
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
          }
        />
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
          "‹ Back beside Kerrigan over the lesson board; section crumbs clear 40px tall on mobile (footer grows to fit).",
      },
    },
  },
  render: () => (
    <div class={styles.stack}>
      <ScreenBackNav onBack={() => undefined} data-testid="tutorial-fog-coach-nav">
        <CoachAvatar identity="kerrigan" emotion="idle" />
      </ScreenBackNav>
      <StaticScfenBoard
        scfen={OPEN_BOARD_SAMPLE.scfen}
        boardVariant="eclipse"
        fog={false}
        visionMode="observer"
        caption="Fog of War · King — lesson board"
      />
      <Breadcrumb
        items={[...TUTORIAL_SECTIONS]}
        current="fog"
        onSelect={() => undefined}
        aria-label="Tutorial sections"
        data-testid="tutorial-breadcrumb"
      />
    </div>
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

