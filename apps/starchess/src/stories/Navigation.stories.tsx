import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { createSignal } from "solid-js";

import { Breadcrumb } from "~/components/primitives/Breadcrumb";
import { ChevronNav } from "~/components/primitives/ChevronNav";
import { ScreenBackNav } from "~/components/primitives/ScreenBackNav";
import { CoachAvatar } from "~/components/atoms/CoachAvatar";
import { MatchHistoryFilters } from "~/components/atoms/MatchHistoryFilters";
import { MobileBanner } from "~/components/atoms/MobileBanner";
import { ReviewTurnNav } from "~/components/atoms/ReviewTurnNav";
import { FULL_ARMY_SAMPLE } from "~/demos/samples";
import { ResourceBar } from "~/presentation/hud/components/ResourceBar";
import { TurnBar } from "~/presentation/hud/components/TurnBar";
import { WithMatchStore } from "~/stories/project";

/**
 * Navigation chrome as it ships in tutorials, single player, and review —
 * one folder to audit the 40×40px mobile touch targets and the single-player
 * top-banner overflow in the same place. Switch the viewport toolbar between
 * Desktop 1280×900, Mobile 390×844, and Dynamic 560×420.
 * Boards come from `demos/samples.ts` (projection only, no SCFEN literals).
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

/** Single-player top chrome (`BaseScreen.topChrome`): title + TurnBar + named ResourceBar. */
export const SingleTopChrome: Story = {
  name: "Single player · top chrome",
  parameters: {
    route: "/single?map=eclipse&team=w",
    viewport: { defaultViewport: "mobile" },
    docs: { description: { story: phoneDocs } },
  },
  render: () => (
    <WithMatchStore board={FULL_ARMY_SAMPLE}>
      <div style={{ padding: "0.75rem" }}>
        <ScreenBackNav onBack={() => undefined} data-testid="live-back">
          {/* Same stack as BaseScreen.topChrome (column, centered): TurnBar over the named bar. */}
          <div
            style={{
              display: "flex",
              "flex-direction": "column",
              "align-items": "center",
              gap: "0.5rem",
              width: "100%",
            }}
            data-testid="starchess-board-chrome"
          >
            <TurnBar autoStart={false} resolveOnEnd={false} onEnd={() => undefined} />
            <ResourceBar color="w" name="Alexandra the Great!!" />
          </div>
        </ScreenBackNav>
      </div>
    </WithMatchStore>
  ),
};

/** Single-player dynamic strip: Back · compact resources · compact turn. */
export const SingleDynamicBanner: Story = {
  name: "Single player · dynamic banner",
  parameters: {
    route: "/single?map=eclipse&team=w",
    viewport: { defaultViewport: "dynamic" },
    docs: {
      description: {
        story: "Dynamic viewport (560×420). Fixed-width compact resources; slack sits left of End Turn.",
      },
    },
  },
  render: () => (
    <WithMatchStore board={FULL_ARMY_SAMPLE}>
      <MobileBanner
        onBack={() => undefined}
        fixedResources
        resources={<ResourceBar compact />}
        turn={<TurnBar compact autoStart={false} resolveOnEnd={false} onEnd={() => undefined} />}
      />
    </WithMatchStore>
  ),
};

/** Review detail: turn arrows flanking dual named ResourceBars. */
export const ReviewDualNav: Story = {
  name: "Review · dual turn nav",
  parameters: {
    viewport: { defaultViewport: "mobile" },
    docs: {
      description: {
        story: "Green ‹ › stay 40×40px on mobile with dual bars wrapping between them.",
      },
    },
  },
  render: () => (
    <WithMatchStore board={FULL_ARMY_SAMPLE}>
      <div style={{ padding: "0.75rem" }}>
        <ReviewTurnNav onBack={() => undefined} onForward={() => undefined}>
          <ResourceBar color="w" snapshot={undefined} name="Alex" />
          <ResourceBar color="b" snapshot={undefined} name="Sam" />
        </ReviewTurnNav>
      </div>
    </WithMatchStore>
  ),
};

/** Review list: link Back + Playing-as / date pager + banner back variant. */
export const ReviewListChrome: Story = {
  name: "Review · list chrome",
  parameters: {
    // The MobileBanner strip only renders in the dynamic band (560×420).
    viewport: { defaultViewport: "dynamic" },
    docs: {
      description: { story: "Pager ‹ › and banner Back clear 40×40px (Dynamic 560×420 band)." },
    },
  },
  render: () => {
    const [color, setColor] = createSignal<"w" | "b">("w");
    // The pager appends "(page / total)" itself — keep the label date-only.
    const filters = (compact?: boolean) => (
      <MatchHistoryFilters
        compact={compact}
        colorFilter={color()}
        setColorFilter={setColor}
        totalPages={3}
        activePage={0}
        currentDateLabel="Aug 11, 2026"
        goToPrev={() => undefined}
        goToNext={() => undefined}
      />
    );
    return (
      <WithMatchStore board={FULL_ARMY_SAMPLE}>
        <div style={{ display: "flex", "flex-direction": "column", gap: "0.75rem", padding: "0.75rem" }}>
          <ScreenBackNav href="/" data-testid="review-back">
            <span style={{ opacity: 0.8, "font-size": "0.9rem" }}>Win (White)</span>
          </ScreenBackNav>
          {filters()}
          <MobileBanner href="/" resources={filters(true)} />
        </div>
      </WithMatchStore>
    );
  },
};

/** Tutorial lesson header + section breadcrumb footer. */
export const TutorialCoachHeader: Story = {
  name: "Tutorials · coach header + sections",
  parameters: {
    viewport: { defaultViewport: "mobile" },
    docs: {
      description: {
        story: "‹ Back beside Kerrigan; section crumbs clear 40px tall on mobile (footer grows to fit).",
      },
    },
  },
  render: () => (
    <div style={{ display: "flex", "flex-direction": "column", gap: "0.75rem", padding: "0.75rem" }}>
      <ScreenBackNav onBack={() => undefined} data-testid="tutorial-fog-coach-nav">
        <CoachAvatar identity="kerrigan" emotion="idle" />
      </ScreenBackNav>
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
      <div style={{ display: "flex", "align-items": "center", gap: "1rem", padding: "1rem" }}>
        <ReviewTurnNav onBack={() => undefined} onForward={() => undefined}>
          <span style={{ opacity: 0.8, "font-size": "0.8rem" }}>turn</span>
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
