import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { createSignal } from "solid-js";

import {
  CoachAvatar,
} from "~/components/atoms/CoachAvatar";
import type { CoachIdentity, KerriganEmotion } from "~/types/coach";

/**
 * Selena — Ghost sniper helm on the classic coach cat.
 * Dark gray helmet only (no mouth muzzle); large left + twin right green scopes.
 */
const meta = {
  title: "Atoms/CoachAvatar",
  component: CoachAvatar,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Selena (classic coach cat) or Selena (Ghost helm). Toggle identity to drop/lift the helm (500ms). Emotion `scanning` slides the visor over her eyes.",
      },
    },
  },
  argTypes: {
    emotion: {
      control: "select",
      options: [
        "idle",
        "watching",
        "watching--left",
        "watching--right",
        "watching--up",
        "thinking",
        "scanning",
        "happy",
        "shocked",
        "sleepy",
        "sleeping",
      ] satisfies KerriganEmotion[],
    },
    identity: {
      control: "inline-radio",
      options: ["selena", "kerrigan"] satisfies CoachIdentity[],
    },
  },
} satisfies Meta<typeof CoachAvatar>;

export default meta;
type Story = StoryObj<typeof meta>;

const toggleBtnStyle = (active: boolean): Record<string, string> => ({
  "font-family": "ui-sans-serif, system-ui, sans-serif",
  "font-size": "0.875rem",
  "font-weight": "600",
  padding: "0.5rem 1rem",
  "border-radius": "0.375rem",
  border: "1px solid color-mix(in srgb, #111 22%, transparent)",
  background: active
    ? "color-mix(in srgb, #7dff6a 28%, #1a1c1f)"
    : "color-mix(in srgb, #3a3d42 55%, #f5f5f5)",
  color: active ? "#e8ffb8" : "#1a1c1f",
  cursor: "pointer",
  "caret-color": "transparent",
});

export const Idle: Story = {
  name: "Selena · Identity",
  parameters: {
    docs: {
      description: {
        story:
          "Starts as Selena (UI cat, no Ghost gear). Toggle to Selena to drop the helm (happy bounce); toggle back to lift it away while she watches upward.",
      },
    },
  },
  render: () => {
    const [identity, setIdentity] = createSignal<CoachIdentity>("selena");
    const [busy, setBusy] = createSignal(false);
    const toggle = () => {
      if (busy()) return;
      setBusy(true);
      setIdentity((id) => (id === "selena" ? "kerrigan" : "selena"));
      setTimeout(() => setBusy(false), 500);
    };
    return (
      <div
        data-helm-ferry-stage
        data-testid="helm-ferry-stage"
        style={{
          position: "relative",
          display: "flex",
          "flex-direction": "column",
          "align-items": "center",
          "justify-content": "flex-end",
          gap: "1.25rem",
          width: "16rem",
          height: "28rem",
          "box-sizing": "border-box",
          padding: "0.75rem",
          overflow: "visible",
          border: "1px dashed color-mix(in srgb, #111 28%, transparent)",
          "background-color": "color-mix(in srgb, #f5f5f5 55%, transparent)",
        }}
      >
        <CoachAvatar identity={identity()} emotion="idle" />
        <button
          type="button"
          data-testid="identity-toggle"
          aria-pressed={identity() === "kerrigan"}
          disabled={busy()}
          onClick={toggle}
          style={{
            ...toggleBtnStyle(identity() === "kerrigan"),
            opacity: busy() ? "0.65" : "1",
          }}
        >
          {identity() === "kerrigan" ? "Selena" : "Selena"}
        </button>
      </div>
    );
  },
};

export const Watching: Story = {
  name: "Selena · Watching",
  args: { emotion: "watching", identity: "kerrigan" },
};

export const Thinking: Story = {
  name: "Selena · Thinking",
  args: { emotion: "thinking", identity: "kerrigan" },
};

export const Scanning: Story = {
  name: "Selena · Scanning",
  parameters: {
    docs: {
      description: {
        story:
          "Scoped = visor down over the eyes; unscoped = forehead park (same wide crest). Toggle to compare.",
      },
    },
  },
  render: () => {
    const [scoped, setScoped] = createSignal(true);
    return (
      <div
        style={{
          display: "flex",
          "flex-direction": "column",
          "align-items": "center",
          gap: "1.25rem",
        }}
      >
        <CoachAvatar
          identity="kerrigan"
          emotion={scoped() ? "scanning" : "idle"}
        />
        <button
          type="button"
          data-testid="scope-toggle"
          aria-pressed={scoped()}
          onClick={() => setScoped((v) => !v)}
          style={toggleBtnStyle(scoped())}
        >
          {scoped() ? "Scoped" : "Unscoped"}
        </button>
      </div>
    );
  },
};

export const Happy: Story = {
  name: "Selena · Happy",
  args: { emotion: "happy", identity: "kerrigan" },
};

export const Shocked: Story = {
  name: "Selena · Shocked",
  args: { emotion: "shocked", identity: "kerrigan" },
};

export const Sleepy: Story = {
  name: "Selena · Sleepy",
  args: { emotion: "sleepy", identity: "kerrigan" },
};

export const Sleeping: Story = {
  name: "Selena · Sleeping",
  args: { sleeping: true, identity: "kerrigan" },
};

export const Compact: Story = {
  name: "Selena · Compact",
  args: { emotion: "idle", compact: true, identity: "kerrigan" },
};
