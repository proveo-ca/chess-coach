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
import styles from "~/stories/Navigation.stories.module.css";

/**
 * Navigation chrome as it ships in tutorials, single player, and review —
 * one folder to audit the 40×40px mobile touch targets and the single-player
 * top-banner overflow in the same place. Switch the viewport toolbar between
 * Desktop 1280×900, Mobile 390×844, and Dynamic 560×420.
 * Layout shells live in `Navigation.stories.module.css` (each mirrors the
 * production class named above it). Boards come from `demos/samples.ts`
 * (projection only, no SCFEN literals).
 */
const meta = {
  title: "Navigation/Chrome",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Back / turn / section chrome across the three screens. Touch targets clear 40×40px on mobile (ChevronNav, review ‹ ›, pager, breadcrumb); the single-player ResourceBar wraps name-over-strips under 560px.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const phoneDocs =
  "Narrow-phone case: use the Mobile viewport (390×844). The player name sits on row 1 with the minerals / vespene / supply strips on row 2 — no X-overflow.";

// Static mirror of TutorialScreen SECTIONS (labels only — kept local so this
// module stays side-effect free for Storybook's static index extraction).
const TUTORIAL_SECTIONS = [
  { id: "fog", label: "Fog of War" },
  { id: "specials", label: "Special Moves" },
  { id: "resolve", label: "Turn Resolution" },
  { id: "king", label: "King Damage" },
];

/** Single-player top chrome (`BaseScreen.topChrome`): TurnBar over the named bar, one rectangle. */
export const SingleTopChrome: Story = {
  name: "Single player · top chrome",
  parameters: {
    route: "/single?map=eclipse&team=w",
    viewport: { defaultViewport: "mobile" },
    docs: { description: { story: phoneDocs } },
  },
  render: () => (
    <WithMatchStore board={FULL_ARMY_SAMPLE}>
      <div class={styles.pad}>
        <ScreenBackNav onBack={() => undefined} data-testid="live-back">
          <div class={styles.topChrome} data-testid="starchess-board-chrome">
            <div class={styles.turnFill}>
              <TurnBar autoStart={false} resolveOnEnd={false} onEnd={() => undefined} />
            </div>
            <div class={styles.liveDualResources} role="group" aria-label="Both sides resources">
              <ResourceBar color="w" name="Alexandra the Great!!" />
              <ResourceBar color="b" name="Adjutant" />
            </div>
          </div>
        </ScreenBackNav>
      </div>
    </WithMatchStore>
  ),
};

/** Single-player dynamic strip: Back · compact viewer resources · compact turn. */
export const SingleDynamicBanner: Story = {
  name: "Single player · dynamic banner",
  parameters: {
    route: "/single?map=eclipse&team=w",
    viewport: { defaultViewport: "dynamic" },
    docs: {
      description: {
        story:
          "Dynamic viewport (560×420). Fixed-width compact resources — viewer plus adjutant stacked; slack sits left of End Turn.",
      },
    },
  },
  render: () => (
    <WithMatchStore board={FULL_ARMY_SAMPLE}>
      <MobileBanner
        onBack={() => undefined}
        fixedResources
        resources={
          <div class={styles.liveDualCompact} role="group" aria-label="Both sides resources">
            <ResourceBar compact color="w" />
            <ResourceBar compact color="b" />
          </div>
        }
        turn={<TurnBar compact autoStart={false} resolveOnEnd={false} onEnd={() => undefined} />}
      />
    </WithMatchStore>
  ),
};

/** Review detail: turn arrows flanking the dual named ResourceBars. */
export const ReviewDualNav: Story = {
  name: "Review · dual turn nav",
  parameters: {
    // Desktop shows the production side-by-side pair; narrow phones stack
    // (approved — vertical space is free), dynamic docks the arrows.
    viewport: { defaultViewport: "desktop" },
    docs: {
      description: {
        story:
          "Green ‹ › stay 40×40px with the dual compact bars between them. Desktop + dynamic: side-by-side. Mobile: stacked. Dynamic: arrows dock bottom-right (see review detail).",
      },
    },
  },
  render: () => (
    <WithMatchStore board={FULL_ARMY_SAMPLE}>
      <div class={styles.pad}>
        <ReviewTurnNav onBack={() => undefined} onForward={() => undefined}>
          <div class={styles.dualResources} role="group" aria-label="Both sides resources">
            <ResourceBar compact color="w" snapshot={undefined} name="Alex" />
            <ResourceBar compact color="b" snapshot={undefined} name="Sam" />
          </div>
        </ReviewTurnNav>
      </div>
    </WithMatchStore>
  ),
};

/** Review list in-flow chrome (desktop / tall mobile): link Back + full filters. */
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
    // The pager appends "(page / total)" itself — keep the label date-only.
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

/** Review list dynamic strip: banner Back + compact filters (banner owns the band). */
export const ReviewListBanner: Story = {
  name: "Review · list banner",
  parameters: {
    // The MobileBanner strip only renders in the dynamic band (560×420).
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

/** Tutorial lesson header + section breadcrumb footer, over an Eclipse board. */
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

/** Isolated arrow audit: review ‹ › beside text chevron navs. */
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
