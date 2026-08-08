import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { createSignal, type Component } from "solid-js";

import { MenuAnchor } from "~/components/atoms/MenuAnchor";
import { NetworkSignal } from "~/components/atoms/NetworkSignal";
import { MenuBlackHole } from "~/screens/menuSky/MenuBlackHole";
import { MenuDebris } from "~/screens/menuSky/MenuDebris";
import { DebrisPawnPlayground } from "~/screens/menuSky/DebrisPawnPlayground";
import { MenuArrival } from "~/screens/menuSky/MenuArrival";
import { MenuMoon } from "~/screens/menuSky/MenuMoon";
import { MenuPlanet, type MenuWorldId } from "~/screens/menuSky/MenuPlanet";
import { MenuSkyStage } from "~/screens/menuSky/MenuSkyStage";
import { StarChessMenuScreen } from "~/screens/StarChessMenuScreen";
import type { MenuSurface } from "~/types/menu";

/**
 * StarChess main menu + sky prop showcases.
 * Menu anchors compose MenuTitle + visual (MenuAnchor atom).
 * StarChess story: Chess ↔ StarChess toggle plays MenuArrival
 * (glass clear · Selena→Kerrigan · shatter · spatial chrome in).
 */
const meta = {
  title: "Screens/Menu",
  component: StarChessMenuScreen,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Static StarChess menu. Single Player opens the New Game setup modal (map / team / Adjutant). Anchors: Single Player (debris), Multiplayer (network), Review (moon), Exit (black hole). Tutorial is title-only; Credits opens the credits modal. The StarChess story toggle runs the Chess→StarChess arrival.",
      },
    },
  },
} satisfies Meta<typeof StarChessMenuScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

const toggleStyle = (active: boolean): Record<string, string> => ({
  "font-family": "ui-sans-serif, system-ui, sans-serif",
  "font-size": "0.875rem",
  "font-weight": "600",
  "letter-spacing": "0.04em",
  "text-transform": "none",
  padding: "0.45rem 0.9rem",
  "border-radius": "0.375rem",
  border: "1px solid color-mix(in srgb, #7dff6a 35%, transparent)",
  background: active
    ? "color-mix(in srgb, #7dff6a 28%, #0a1a12)"
    : "color-mix(in srgb, #3a3d42 55%, #12171c)",
  color: active ? "#e8ffb8" : "#c8ccd0",
  cursor: "pointer",
  "box-shadow": "0 2px 8px color-mix(in srgb, #000 45%, transparent)",
});

const MenuStoryHarness: Component = () => {
  const [mode, setMode] = createSignal<MenuSurface>("chess");
  const [busy, setBusy] = createSignal(false);

  const toggle = () => {
    if (busy()) return;
    const next: MenuSurface = mode() === "starchess" ? "chess" : "starchess";
    if (next === "starchess") setBusy(true);
    else setBusy(false);
    setMode(next);
  };

  return (
    <div style={{ position: "relative", width: "100%", "min-height": "100vh" }}>
      <div
        style={{
          position: "fixed",
          top: "0.75rem",
          right: "0.75rem",
          "z-index": "30",
          display: "flex",
          "flex-direction": "column",
          "align-items": "flex-end",
          gap: "0.35rem",
        }}
      >
        <button
          type="button"
          data-testid="menu-mode-toggle"
          aria-pressed={mode() === "starchess"}
          disabled={busy()}
          title="Chess → StarChess plays the arrival transition"
          onClick={toggle}
          style={{
            ...toggleStyle(mode() === "starchess"),
            opacity: busy() ? "0.65" : "1",
          }}
        >
          {mode() === "starchess" ? "StarChess" : "Chess"}
        </button>
        <span
          style={{
            "font-family": "ui-sans-serif, system-ui, sans-serif",
            "font-size": "0.7rem",
            color: "color-mix(in srgb, #e8eaed 55%, transparent)",
            "text-transform": "none",
            "letter-spacing": "0",
          }}
        >
          {busy() ? "Arriving…" : "Toggle Chess ↔ StarChess"}
        </span>
      </div>

      <MenuArrival
        surface={mode()}
        onArrived={() => setBusy(false)}
      />
    </div>
  );
};

export const StarChess: Story = {
  name: "StarChess",
  render: () => <MenuStoryHarness />,
};

export const Debris: Story = {
  name: "Sky · Debris",
  render: () => (
    <MenuSkyStage label="Debris — 2×2 crop + 2rem gutter; exits to g5 / f5 leave the frame">
      <MenuDebris />
      <DebrisPawnPlayground />
    </MenuSkyStage>
  ),
};

export const Network: Story = {
  name: "Sky · Network signal",
  render: () => (
    <MenuSkyStage label="Network signal — Multiplayer (wanders 1–5)">
      <div
        style={{
          position: "absolute",
          left: "16%",
          top: "42%",
          display: "flex",
          "flex-direction": "column",
          gap: "0.75rem",
        }}
      >
        <MenuAnchor label="Multiplayer" hint="Live signal">
          <NetworkSignal />
        </MenuAnchor>
        <MenuAnchor label="Multiplayer" hint="Coming Soon" disabled>
          <NetworkSignal disabled />
        </MenuAnchor>
      </div>
    </MenuSkyStage>
  ),
};

/** Green eclipsed body by Review (not the blue bottom-left planet). */
export const Moon: Story = {
  name: "Sky · Moon (Review)",
  render: () => (
    <MenuSkyStage label="Moon — Review (eclipsed planet)">
      <MenuMoon />
    </MenuSkyStage>
  ),
};

const PlanetOrbitHarness: Component = () => {
  const [planetWorld, setPlanetWorld] = createSignal<MenuWorldId>("eclipse");
  return (
    <MenuSkyStage
      label="Planet orbit — Eclipse → Butter → Vermeer"
      planetWorld={planetWorld()}
    >
      <MenuPlanet onWorldChange={setPlanetWorld} />
    </MenuSkyStage>
  );
};

export const Planet: Story = {
  name: "Sky · Planet",
  render: () => <PlanetOrbitHarness />,
};

export const BlackHole: Story = {
  name: "Sky · Black Hole",
  render: () => (
    <MenuSkyStage label="Black hole — Exit">
      <MenuBlackHole />
    </MenuSkyStage>
  ),
};
