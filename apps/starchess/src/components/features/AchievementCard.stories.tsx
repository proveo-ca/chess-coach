import { For } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { ACHIEVEMENT_SHORT_IDS, achievementsFor } from "~/achievements/catalog";
import { ACHIEVEMENT_MATERIALS } from "~/achievements/types";
import { AchievementCard } from "~/components/features/AchievementCard";
import { NewAchievementsModal } from "~/components/features/NewAchievementsModal";
import type { AchievementBubble } from "~/types/achievements";

const LEVELS = [1, 2, 3, 4, 5] as const;

/** The gallery sheet's colours, so cards read as they do in the modal. */
const sheet = {
  background: "#041208",
  color: "#7cff4a",
  padding: "1rem",
  "min-height": "100vh",
  "box-sizing": "border-box",
  "font-family": "inherit",
} as const;

const meta = {
  title: "Features/Achievements",
  component: AchievementCard,
  args: { shortId: "stonks", level: 3 },
  argTypes: {
    shortId: { control: "select", options: [...ACHIEVEMENT_SHORT_IDS] },
    level: { control: { type: "range", min: 0, max: 5, step: 1 } },
  },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AchievementCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One card — pick the family and level from the controls. */
export const Card: Story = {
  render: (args) => (
    <div style={sheet}>
      <div style={{ width: "13rem" }}>
        <AchievementCard {...args} />
      </div>
    </div>
  ),
};

/** Every family (rows) in every state (columns): Missing, then levels 1–5. */
export const AllLevels: Story = {
  render: () => (
    <div style={sheet}>
      <div
        style={{
          display: "grid",
          "grid-template-columns": "8rem repeat(6, minmax(9rem, 1fr))",
          gap: "0.5rem",
          "align-items": "stretch",
        }}
      >
        <span />
        <strong>Missing</strong>
        <For each={LEVELS}>
          {(level) => (
            <strong style={{ color: ACHIEVEMENT_MATERIALS[level].fill }}>
              {level} · {ACHIEVEMENT_MATERIALS[level].label}
            </strong>
          )}
        </For>
        <For each={ACHIEVEMENT_SHORT_IDS}>
          {(shortId) => (
            <>
              <strong style={{ "align-self": "center" }}>{shortId}</strong>
              <AchievementCard shortId={shortId} level={0} />
              <For each={LEVELS}>
                {(level) => <AchievementCard shortId={shortId} level={level} />}
              </For>
            </>
          )}
        </For>
      </div>
    </div>
  ),
};

/** The end-of-game modal, listing all twelve at one level. */
export const NewAchievements: StoryObj<{ level: AchievementBubble["level"] }> = {
  args: { level: 1 },
  argTypes: { level: { control: { type: "range", min: 1, max: 5, step: 1 } } },
  render: (args) => (
    <NewAchievementsModal
      open
      onContinue={() => undefined}
      earned={ACHIEVEMENT_SHORT_IDS.map((shortId) => ({
        id: `${shortId}-${args.level}`,
        shortId,
        level: args.level,
        origin: "e4",
        side: "w" as const,
        icon: achievementsFor(shortId)[0]!.icon,
      }))}
    />
  ),
};
