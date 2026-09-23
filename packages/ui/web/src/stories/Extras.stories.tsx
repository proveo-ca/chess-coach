// SPEC: _spec/_plans/chess-ui-primitives.puml
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { createSignal } from "solid-js";
import { UiProvider } from "../UiProvider";
import { Breadcrumb } from "../primitives/Breadcrumb";
import { Chip } from "../primitives/Chip";
import { CoachEmotionIcon } from "../primitives/CoachEmotionIcon";
import { Collapsible } from "../primitives/Collapsible";
import { ColorSelector } from "../primitives/ColorSelector";
import { CountdownRing } from "../primitives/CountdownRing";
import { EvalBar } from "../primitives/EvalBar";
import { HistoryOverlay } from "../primitives/HistoryOverlay";
import { MenuButton } from "../primitives/MenuButton";
import { MenuTitle } from "../primitives/MenuTitle";
import { PanelTitle } from "../primitives/PanelTitle";
import { ProgressBar } from "../primitives/ProgressBar";
import { QrCode } from "../primitives/QrCode";
import { SpecialPreview } from "../primitives/SpecialPreview";
import { SplashScreen } from "../primitives/SplashScreen";
import { SplitButton } from "../primitives/SplitButton";
import { TeamFrame } from "../primitives/TeamFrame";
import { ColorSwatch } from "../atoms/ColorSwatch";
import { GameHistoryFilters } from "../atoms/GameHistoryFilters";
import { LightSpeedOverlay } from "../atoms/LightSpeedOverlay";
import { MapSwatch } from "../atoms/MapSwatch";
import { MatchHistoryFilters } from "../atoms/MatchHistoryFilters";
import { MatrixOverlay } from "../atoms/MatrixOverlay";
import { MenuAnchor } from "../atoms/MenuAnchor";
import { NeonModal } from "../atoms/NeonModal";
import { NetworkSignal } from "../atoms/NetworkSignal";
import { ReviewTurnNav } from "../atoms/ReviewTurnNav";
import { SelectCard } from "../atoms/SelectCard";
import { TeamSwatch } from "../atoms/TeamSwatch";
import { VisionSwatch } from "../atoms/VisionSwatch";
import type { PlayerColorPref } from "../types/visual";

const meta = { title: "Primitives/Additional controls" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
const noop = () => {};

export const Selection: Story = {
  render: () => {
    const [color, setColor] = createSignal<PlayerColorPref>("random");
    const [mode, setMode] = createSignal("standard");
    return (
      <div style={{ display: "grid", gap: "1rem", "max-width": "30rem" }}>
        <ColorSelector value={color()} onChange={setColor} />
        <SplitButton
          value={mode()}
          onChange={setMode}
          selectLabel="Mode"
          options={[
            { value: "standard", label: "Standard" },
            { value: "quick", label: "Quick" },
          ]}
        >
          Start
        </SplitButton>
        <SelectCard label="Selected seat" selected onClick={noop}>
          <ColorSwatch color="w" size="md" /> White
        </SelectCard>
        <SelectCard label="Static seat">
          <ColorSwatch color="b" /> Black <MenuButton onClick={noop}>Join</MenuButton>
        </SelectCard>
      </div>
    );
  },
};
export const Disclosure: Story = {
  render: () => {
    const [open, setOpen] = createSignal(false);
    return (
      <div style={{ display: "grid", gap: "1rem" }}>
        <Collapsible
          title="Connection details"
          index={1}
          open={open()}
          onToggle={() => setOpen(!open())}
        >
          Ready to connect
        </Collapsible>
        <Collapsible title="Completed step" index={2} done open={false} onToggle={noop}>
          Complete
        </Collapsible>
        <Collapsible title="Unavailable step" index={3} disabled open={false} onToggle={noop}>
          Unavailable
        </Collapsible>
        <QrCode value="https://example.com/invite" size={160} alt="Example invite" />
      </div>
    );
  },
};
export const Indicators: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "1rem", "align-items": "center" }}>
      <div class="fixture-eval">
        <EvalBar score={{ kind: "cp", value: 175 }} />
      </div>
      <div style={{ width: "220px" }}>
        <ProgressBar progress={65} text="65% complete" />
        <HistoryOverlay active={false} />
      </div>
      <CountdownRing progress={0.3} data-seconds={3}>
        3
      </CountdownRing>
      <CountdownRing progress={0.8} data-seconds={8}>
        8
      </CountdownRing>
      {(["thinking", "happy", "shocked", "shrug"] as const).map((emotion) => (
        <CoachEmotionIcon emotion={emotion} size={24} />
      ))}
    </div>
  ),
};
export const StarChrome: Story = {
  render: () => (
    <UiProvider product="starchess">
      <div style={{ display: "grid", gap: "1rem", "max-width": "36rem" }}>
        <Breadcrumb
          items={[
            { id: "one", label: "Basics" },
            { id: "two", label: "Movement" },
            { id: "three", label: "Specials" },
          ]}
          current="two"
          onSelect={noop}
        />
        <MenuTitle hint="Choose an option">Menu title</MenuTitle>
        <PanelTitle>Panel title</PanelTitle>
        <div>
          {(
            ["before", "classical", "after", "muted", "turn", "check", "intent", "resolve"] as const
          ).map((tone) => (
            <Chip tone={tone} onRemove={noop}>
              {tone}
            </Chip>
          ))}
        </div>
        <TeamFrame teamColor="#3b7dd8">
          <SpecialPreview unit="Scout" name="Scan" description="Reveal a nearby area." />
        </TeamFrame>
        <MenuAnchor label="Connect" hint="Find a match" onActivate={noop}>
          <NetworkSignal level={4} />
        </MenuAnchor>
        <MenuAnchor label="Unavailable" disabled>
          <NetworkSignal level={2} disabled />
        </MenuAnchor>
        <ReviewTurnNav onBack={noop} onForward={noop} backDisabled>
          Turn 1
        </ReviewTurnNav>
      </div>
    </UiProvider>
  ),
};
export const Swatches: Story = {
  render: () => (
    <UiProvider product="starchess">
      <div style={{ display: "flex", gap: "1rem", "flex-wrap": "wrap" }}>
        <ColorSwatch color="w" />
        <ColorSwatch color="b" size="md" />
        <TeamSwatch color="w" label="Blue" selected />
        <TeamSwatch color="b" label="Red" />
        {(["eclipse", "butter", "vermeer"] as const).map((variant) => (
          <MapSwatch variant={variant} label={variant} selected={variant === "eclipse"} />
        ))}
        <VisionSwatch value="both" swatch="both" label="Both" selected />
        <VisionSwatch value="w" swatch="w" label="You" />
        <VisionSwatch value="b" swatch="b" label="Opponent" />
      </div>
    </UiProvider>
  ),
};
export const HistoryFilters: Story = {
  render: () => {
    const [color, setColor] = createSignal<"w" | "b">("w");
    const [move, setMove] = createSignal<string | null>(null);
    const paging = {
      totalPages: 3,
      activePage: 1,
      currentDateLabel: "May 12",
      goToPrev: noop,
      goToNext: noop,
    };
    return (
      <div style={{ display: "grid", gap: "2rem" }}>
        <GameHistoryFilters
          {...paging}
          colorFilter={color()}
          setColorFilter={setColor}
          firstMoveFilter={move()}
          setFirstMoveFilter={setMove}
          availableFirstMoves={["e4", "d4"]}
        />
        <UiProvider product="starchess">
          <MatchHistoryFilters {...paging} colorFilter={color()} setColorFilter={setColor} />
          <MatchHistoryFilters
            {...paging}
            colorFilter={color()}
            setColorFilter={setColor}
            compact
          />
        </UiProvider>
      </div>
    );
  },
};
export const Splash: Story = {
  render: () => (
    <SplashScreen title="Welcome" avatar={<CoachEmotionIcon emotion="happy" size={64} />}>
      <MenuButton primary>Play</MenuButton>
      <MenuButton>Review</MenuButton>
    </SplashScreen>
  ),
};
export const NeonDialog: Story = {
  render: () => {
    const [open, setOpen] = createSignal(false);
    return (
      <UiProvider product="starchess">
        <MenuButton onClick={() => setOpen(true)}>Open dialog</MenuButton>
        <NeonModal
          open={open()}
          onClose={() => setOpen(false)}
          title="Example dialog"
          dismissible
          showCloseButton
        >
          <p>Reusable dialog content.</p>
        </NeonModal>
      </UiProvider>
    );
  },
};
export const MatrixEffect: Story = {
  render: () => (
    <div style={{ height: "320px", position: "relative", overflow: "hidden" }}>
      <MatrixOverlay density={20} maxDrops={30} />
    </div>
  ),
};
export const LightSpeedEffect: Story = {
  render: () => (
    <div style={{ height: "320px", position: "relative", overflow: "hidden" }}>
      <LightSpeedOverlay active beamCount={12} />
    </div>
  ),
};
