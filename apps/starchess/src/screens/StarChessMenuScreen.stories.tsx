import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { createSignal, type Component } from "solid-js";

import { MenuAnchor } from "~/components/atoms/MenuAnchor";
import { NetworkSignal } from "~/components/atoms/NetworkSignal";
import { MenuBlackHole } from "~/screens/menuSky/MenuBlackHole";
import { MenuDebris } from "~/screens/menuSky/MenuDebris";
import { DebrisPawnPlayground } from "~/screens/menuSky/DebrisPawnPlayground";
import { MenuMoon } from "~/screens/menuSky/MenuMoon";
import { MenuPlanet, type MenuWorldId } from "~/screens/menuSky/MenuPlanet";
import { MenuSatellite } from "~/screens/menuSky/MenuSatellite";
import { MenuSkyStage } from "~/screens/menuSky/MenuSkyStage";
import { StarChessMenuScreen } from "~/screens/StarChessMenuScreen";

/**
 * StarChess main menu + sky prop showcases.
 * Menu anchors compose MenuTitle + visual (MenuAnchor atom).
 */
const meta = {
  title: "Screens/Menu",
  component: StarChessMenuScreen,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Static StarChess menu. Anchors: Single Player (debris playground — 2×2 crop + 2rem gutter; exits g5 / f5), Multiplayer (network signal), Review (moon), Exit (black hole). Tutorial is title-only; Credits opens the modal.",
      },
    },
  },
} satisfies Meta<typeof StarChessMenuScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

const toggleStyle = (active: boolean): Record<string, string> => ({
  fontFamily: "ui-sans-serif, system-ui, sans-serif",
  fontSize: "0.875rem",
  fontWeight: "600",
  letterSpacing: "0.04em",
  textTransform: "none",
  padding: "0.45rem 0.9rem",
  borderRadius: "0.375rem",
  border: "1px solid color-mix(in srgb, #7dff6a 35%, transparent)",
  background: active
    ? "color-mix(in srgb, #7dff6a 28%, #0a1a12)"
    : "color-mix(in srgb, #3a3d42 55%, #12171c)",
  color: active ? "#e8ffb8" : "#c8ccd0",
  cursor: "pointer",
  boxShadow: "0 2px 8px color-mix(in srgb, #000 45%, transparent)",
});

const MenuStoryHarness: Component = () => {
  const [mode, setMode] = createSignal("starchess");

  return (
    <div style={{ position: "relative", width: "100%", minHeight: "100vh" }}>
      <div
        style={{
          position: "fixed",
          top: "0.75rem",
          right: "0.75rem",
          zIndex: "20",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: "0.35rem",
        }}
      >
        <button
          type="button"
          data-testid="menu-mode-toggle"
          aria-pressed={mode() === "starchess"}
          title="View switch not wired yet"
          onClick={() =>
            setMode((m) => (m === "starchess" ? "chess" : "starchess"))
          }
          style={toggleStyle(mode() === "starchess")}
        >
          {mode() === "starchess" ? "StarChess" : "Chess"}
        </button>
        <span
          style={{
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
            fontSize: "0.7rem",
            color: "color-mix(in srgb, #e8eaed 55%, transparent)",
            textTransform: "none",
            letterSpacing: "0",
          }}
        >
          Toggle does nothing yet
        </span>
      </div>

      <StarChessMenuScreen />
    </div>
  );
};

export const StarChess: Story = {
  name: "StarChess (static)",
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
          flexDirection: "column",
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

export const Satellite: Story = {
  name: "Sky · Satellite (legacy)",
  render: () => (
    <MenuSkyStage label="Satellite — legacy sky prop">
      <MenuSatellite />
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
