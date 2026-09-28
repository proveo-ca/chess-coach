import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { FULL_ARMY_SAMPLE } from "~/demos/samples";
import { GasRack } from "~/presentation/hud/components/GasRack";
import { HudDock } from "~/presentation/hud/components/HudDock";
import { TurnBar } from "~/presentation/hud/components/TurnBar";
import type { LiveLessonBoard } from "~/types/tutorial";
import { WithMatchStore, lessonStory } from "~/stories/project";

/** FULL_ARMY_SAMPLE with Blue's gas set to `gas` of 3 (the `G:` field). */
const withGas = (gas: number): LiveLessonBoard => ({
  ...FULL_ARMY_SAMPLE,
  scfen: FULL_ARMY_SAMPLE.scfen.replace(/\|G:\d\d:/, `|G:${gas}3:`),
});

/** FULL_ARMY_SAMPLE with Blue's classical move e2→e4 already queued. */
const QUEUED_SAMPLE: LiveLessonBoard = {
  ...FULL_ARMY_SAMPLE,
  scfen: FULL_ARMY_SAMPLE.scfen.replace("|Q:w:;", "|Q:w:C=e2e4;"),
};

const meta = {
  title: "Features/GasDeploy",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Footer vespene rack — drag a canister onto a friendly unit to arm its special.",
      },
    },
  },
} satisfies Meta;

export default meta;

export const RackOnly: StoryObj = {
  name: "Rack",
  render: () => (
    <WithMatchStore board={FULL_ARMY_SAMPLE}>
      <div style={{ padding: "2rem", width: "24rem" }}>
        <GasRack />
      </div>
    </WithMatchStore>
  ),
};

export const OnBoard = {
  ...lessonStory("specials", "cc"),
  name: "On board (Command Center)",
};

export const RackGasLevels: StoryObj = {
  name: "Rack · gas levels",
  parameters: {
    docs: {
      description: {
        story:
          "Fixed width at every level: reserves stack behind the ready canister instead of widening the tail.",
      },
    },
  },
  render: () => (
    <div style={{ display: "flex", "flex-direction": "column", gap: "1rem", padding: "2rem" }}>
      {[3, 2, 1, 0].map((gas) => (
        <WithMatchStore board={withGas(gas)}>
          <GasRack />
        </WithMatchStore>
      ))}
    </div>
  ),
};

export const MobileHudDock: StoryObj = {
  name: "Mobile HUD dock",
  parameters: {
    viewport: { defaultViewport: "mobile" },
    docs: {
      description: {
        story:
          "Tall phones: the footer tray under the board — queued chip · GasRack · [End Turn] [timer]. Replaces the sub-banner under the stripe.",
      },
    },
  },
  render: () => (
    <div style={{ display: "flex", "flex-direction": "column", gap: "1rem", width: "min(100vw - 4rem, 480px)" }}>
      {[QUEUED_SAMPLE, withGas(1)].map((board) => (
        <WithMatchStore board={board}>
          <HudDock
            queue={<TurnBar density="queueOnly" />}
            rack={<GasRack />}
            controls={
              <TurnBar compact hideQueue autoStart={false} resolveOnEnd={false} onEnd={() => undefined} />
            }
          />
        </WithMatchStore>
      ))}
    </div>
  ),
};
