import { createEffect, createSignal, onMount } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { clearSiegedRooks, resetBroodWarEconomy, startPlanningTimer } from "~/broodwar/broodWarStore";
import { GasDeploy as GasDeployRack } from "~/broodwar/features/GasDeploy";
import { usePieceSpecialArm } from "~/broodwar/hooks/usePieceSpecialArm";
import { useRookSiege } from "~/broodwar/hooks/useRookSiege";
import { ResourceBar } from "~/broodwar/primitives/ResourceBar";
import { TurnBar } from "~/broodwar/primitives/TurnBar";
import { BroodWarChessBoard } from "~/broodwar/BroodWarChessBoard";
import { Screen } from "~/components/primitives/Screen";
import { NERD_CAPABILITIES, setCapabilities } from "~/store/capabilitiesStore";
import { loadFen } from "~/store/gameStore";
import {
  setActivePlayerColor,
  setNerdModeUnlocked,
  setPlayerIdentity,
} from "~/store/settingsStore";

const FULL_ARMY_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1";

/** Map story gas count → turn tier so capacity clamps allow 1–3 canisters. */
const turnForGas = (gas: number) => {
  if (gas >= 3) return 21;
  if (gas >= 2) return 11;
  return 1;
};

const meta = {
  title: "Screens/Nerd/Brood War/Turn Chrome",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Side-by-side above the board (replaces captured pieces): ResourceBar (minerals, vespene, deploy) + TurnBar (End + 10s gauge). GasDeploy: drag vespene onto a unit for specials.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const ResourceAndTurn: Story = {
  name: "ResourceBar + TurnBar",
  render: () => {
    resetBroodWarEconomy({
      turn: 1,
      white: { stored: 12, deployed: 4 },
      startTimer: false,
    });
    startPlanningTimer();
    return (
      <div
        style={{
          width: "420px",
          display: "flex",
          "align-items": "center",
          gap: "10px",
        }}
      >
        <div style={{ flex: "1", "min-width": "0" }}>
          <ResourceBar />
        </div>
        <TurnBar autoStart={false} onEnd={() => undefined} />
      </div>
    );
  },
};

export const GasDeploy: Story = {
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        story:
          "Full army board + footer GasDeploy. Rooks use InlineRook (tank↔siege). Drag gas onto a rook to toggle siege mode; Knight / King specials TBD here. Use Controls → gas (1–3).",
      },
    },
  },
  args: {
    gas: 3,
  },
  argTypes: {
    gas: {
      control: { type: "inline-radio" },
      options: [1, 2, 3],
      description: "Remaining vespene canisters (turn tier follows capacity)",
    },
  },
  render: (args) => {
    const gas = () => Math.min(3, Math.max(1, Number(args.gas) || 3));
    const [status, setStatus] = createSignal(
      "Drag gas onto a rook to toggle tank ↔ siege",
    );
    const rookSiege = useRookSiege();
    const { onGasDeploy } = usePieceSpecialArm({
      r: rookSiege.arm,
    });

    onMount(() => {
      setCapabilities(NERD_CAPABILITIES);
      setNerdModeUnlocked(true);
      setPlayerIdentity("Nerd");
      setActivePlayerColor("w");
      loadFen(FULL_ARMY_FEN);
      clearSiegedRooks();
    });

    createEffect(() => {
      const g = gas();
      resetBroodWarEconomy({
        turn: turnForGas(g),
        white: { stored: 12, deployed: 39 },
        black: { stored: 12, deployed: 39 },
        energy: g,
        startTimer: false,
      });
      clearSiegedRooks();
      setStatus("Drag gas onto a rook to toggle tank ↔ siege");
    });

    return (
      <Screen>
        <Screen.BoardArea>
          <Screen.BoardColumn>
            <BroodWarChessBoard variant="eclipse" fogOfWar={false} />
            <p
              style={{
                margin: "0.35rem 0 0",
                "font-size": "0.85rem",
                opacity: "0.75",
                "text-align": "left",
              }}
              data-testid="gas-deploy-status"
            >
              {status()}
            </p>
          </Screen.BoardColumn>
        </Screen.BoardArea>
        <Screen.Footer>
          <div
            style={{
              display: "flex",
              "justify-content": "center",
              "align-items": "center",
              width: "100%",
              padding: "0.5rem 0.75rem",
              "box-sizing": "border-box",
            }}
          >
            <GasDeployRack
              onDeploy={(t) => {
                onGasDeploy(t);
                if (t.piece === "r") {
                  setStatus(rookSiege.caption());
                } else {
                  setStatus(`Special armed on ${t.piece.toUpperCase()} @ ${t.square}`);
                }
              }}
              onCancel={() => setStatus("Cancelled — canister returned")}
            />
          </div>
        </Screen.Footer>
      </Screen>
    );
  },
};
