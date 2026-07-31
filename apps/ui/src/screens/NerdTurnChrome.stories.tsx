import type { Square } from "chess.js";
import {
  For,
  Show,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { findBoardGrid, squareBoxStyle } from "~/broodwar/animations/boardGeom";
import { clearSiegedRooks, resetBroodWarEconomy, startPlanningTimer } from "~/broodwar/broodWarStore";
import { GasDeploy as GasDeployRack } from "~/broodwar/features/GasDeploy";
import { useCommandCenterDeploy } from "~/broodwar/hooks/useCommandCenterDeploy";
import { useMarineDoubleStep } from "~/broodwar/hooks/useMarineDoubleStep";
import { usePieceSpecialArm } from "~/broodwar/hooks/usePieceSpecialArm";
import { useRookSiege } from "~/broodwar/hooks/useRookSiege";
import { useVultureSpiderMine } from "~/broodwar/hooks/useVultureSpiderMine";
import { ResourceBar } from "~/broodwar/primitives/ResourceBar";
import { DeployModal } from "~/broodwar/primitives/DeployModal";
import { TurnBar } from "~/broodwar/primitives/TurnBar";
import kingSpawnStyles from "~/broodwar/specials/KingSpawnDemo.module.css";
import { BroodWarChessBoard } from "~/broodwar/BroodWarChessBoard";
import { Screen } from "~/components/primitives/Screen";
import { NERD_CAPABILITIES, setCapabilities } from "~/store/capabilitiesStore";
import { currentFen, loadFen } from "~/store/gameStore";
import {
  setActivePlayerColor,
  setNerdModeUnlocked,
  setPlayerIdentity,
} from "~/store/settingsStore";

const FULL_ARMY_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1";
const KING_SQ: Square = "e1";

/** Map story gas count → turn tier so capacity clamps allow 1–3 canisters. */
const turnForGas = (gas: number) => {
  if (gas >= 3) return 21;
  if (gas >= 2) return 11;
  return 1;
};

type OverlayBox = { top: number; left: number; width: number; height: number };

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
          "Full army + GasDeploy: pawn (free classical / paid BW double), knight (spider mine), rook (siege), king (spawn). Controls → gas (1–3).",
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
    const [fen, setFen] = createSignal(FULL_ARMY_FEN);
    const [status, setStatus] = createSignal(
      "Drag gas onto pawn / knight / rook / king",
    );
    const [overlayBox, setOverlayBox] = createSignal<OverlayBox | null>(null);
    let hostRef = undefined as HTMLDivElement | undefined;

    const rookSiege = useRookSiege();
    const marine = useMarineDoubleStep();
    const command = useCommandCenterDeploy({
      fen,
      setFen,
      kingSquare: KING_SQ,
      startingFen: FULL_ARMY_FEN,
    });
    const vulture = useVultureSpiderMine({
      fen,
      setFen,
      startingFen: FULL_ARMY_FEN,
    });
    const { onGasDeploy } = usePieceSpecialArm({
      r: rookSiege.arm,
      p: marine.arm,
      k: command.arm,
      n: vulture.arm,
    });

    const syncOverlay = () => {
      const host = hostRef;
      if (!host) return;
      const el = findBoardGrid(host);
      if (!el) return;
      const hr = host.getBoundingClientRect();
      const br = el.getBoundingClientRect();
      setOverlayBox({
        top: br.top - hr.top + el.clientTop,
        left: br.left - hr.left + el.clientLeft,
        width: el.clientWidth,
        height: el.clientHeight,
      });
    };

    onMount(() => {
      setCapabilities(NERD_CAPABILITIES);
      setNerdModeUnlocked(true);
      setPlayerIdentity("Nerd");
      setActivePlayerColor("w");
      loadFen(FULL_ARMY_FEN);
      setFen(FULL_ARMY_FEN);
      clearSiegedRooks();
      const ro = new ResizeObserver(() => syncOverlay());
      const kick = () => {
        syncOverlay();
        if (hostRef) ro.observe(hostRef);
        const grid = hostRef ? findBoardGrid(hostRef) : null;
        if (grid) ro.observe(grid);
      };
      requestAnimationFrame(() => requestAnimationFrame(kick));
      window.addEventListener("resize", syncOverlay);
      onCleanup(() => {
        ro.disconnect();
        window.removeEventListener("resize", syncOverlay);
      });
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
      setStatus("Drag gas onto pawn / knight / rook / king");
    });

    createEffect(() => {
      void fen();
      loadFen(fen());
      requestAnimationFrame(() => requestAnimationFrame(syncOverlay));
    });

    createEffect(() => {
      vulture.syncFromBoard(currentFen());
    });

    const refreshStatus = () => {
      if (command.phase() !== "idle") {
        setStatus(command.caption());
        return;
      }
      if (vulture.mineQueued() || vulture.planDone() || vulture.playing()) {
        setStatus(vulture.caption());
      }
    };

    createEffect(() => {
      void command.phase();
      void command.caption();
      void vulture.caption();
      void vulture.mineQueued();
      void vulture.planDone();
      void vulture.playing();
      refreshStatus();
    });

    return (
      <Screen>
        <Screen.BoardArea>
          <Screen.BoardColumn>
            <div ref={hostRef} style={{ position: "relative" }}>
              <BroodWarChessBoard
                variant="eclipse"
                fogOfWar={false}
                deployCues={command.deployCue() ? [command.deployCue()!] : []}
                spiderMines={vulture.mineAt() ? [vulture.mineAt()!] : []}
                moveCues={marine.moveCues()}
                moveProgress={marine.moveProgress()}
              />
              <Show when={overlayBox()}>
                {(box) => (
                  <div
                    class={kingSpawnStyles.boardOverlay}
                    data-special="king-spawn"
                    style={{
                      top: `${box().top}px`,
                      left: `${box().left}px`,
                      width: `${box().width}px`,
                      height: `${box().height}px`,
                    }}
                  >
                    <Show when={command.phase() === "pickAdjacent"}>
                      <For each={command.adjacent()}>
                        {(sq) => (
                          <div
                            class={`${kingSpawnStyles.hit} ${kingSpawnStyles.hitAdjacent}`}
                            style={squareBoxStyle(sq, box().width, box().height)}
                            data-square={sq}
                            data-spawn-target
                            onClick={() => {
                              command.deployAt(sq);
                              setStatus(command.caption());
                              requestAnimationFrame(() =>
                                requestAnimationFrame(syncOverlay),
                              );
                            }}
                          />
                        )}
                      </For>
                    </Show>
                  </div>
                )}
              </Show>
              <DeployModal
                pending={command.modalPending()}
                onSelect={(piece) => {
                  command.onSelectUnit(piece);
                  setStatus(command.caption());
                }}
                onCancel={() => {
                  command.onCancelModal();
                  setStatus(command.caption());
                }}
              />
            </div>
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
                if (t.piece === "r") setStatus(rookSiege.caption());
                else if (t.piece === "p") setStatus(marine.caption());
                else if (t.piece === "k") setStatus(command.caption());
                else if (t.piece === "n") setStatus(vulture.caption());
                else setStatus(`Armed ${t.piece.toUpperCase()} @ ${t.square}`);
                setFen(currentFen());
              }}
              onCancel={() => setStatus("Cancelled — canister returned")}
            />
          </div>
        </Screen.Footer>
      </Screen>
    );
  },
};
