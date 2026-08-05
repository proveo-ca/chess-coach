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

import { findBoardGrid, squareBoxStyle } from "~/starchess/animations/boardGeom";
import { clearSiegedRooks, resetStarChessEconomy, startPlanningTimer } from "~/starchess/starChessStore";
import { GasDeploy as GasDeployRack } from "~/starchess/features/GasDeploy";
import { useBishopCharon } from "~/starchess/hooks/useBishopCharon";
import { useCommandCenterDeploy } from "~/starchess/hooks/useCommandCenterDeploy";
import { useMarineDoubleStep } from "~/starchess/hooks/useMarineDoubleStep";
import { usePieceSpecialArm } from "~/starchess/hooks/usePieceSpecialArm";
import { useQueenTacticalJump } from "~/starchess/hooks/useQueenTacticalJump";
import { useRookSiege } from "~/starchess/hooks/useRookSiege";
import { useVultureSpiderMine } from "~/starchess/hooks/useVultureSpiderMine";
import { ResourceBar } from "~/starchess/primitives/ResourceBar";
import { DeployModal } from "~/starchess/primitives/DeployModal";
import { TurnBar } from "~/starchess/primitives/TurnBar";
import { StarChessChessBoard } from "~/starchess/StarChessChessBoard";
import styles from "~/starchess/screens/NerdTurnChrome.stories.module.css";
import { Screen } from "~/components/primitives/Screen";
import { NERD_CAPABILITIES } from "~/starchess/capabilities";
import { setCapabilities } from "~/store/capabilitiesStore";
import { currentFen, loadFen } from "~/store/gameStore";
import { setActivePlayerColor, setPlayerIdentity } from "~/store/settingsStore";
import { setNerdModeUnlocked } from "~/starchess/identity";

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
  title: "Screens/Nerd/StarChess/Turn Chrome",
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
    resetStarChessEconomy({
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
        <TurnBar autoStart={false} resolveOnEnd={false} onEnd={() => undefined} />
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
          "Full army + GasDeploy: pawn (free classical / paid StarChess double), knight (spider mine), bishop (2-gas Charon Booster Missiles when a diagonal queen exists), rook (siege), queen (2-gas Tactical Jump to a visible empty square), king (spawn). Controls → gas (1–3).",
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
    const gas = () =>
      Math.min(3, Math.max(1, Number((args as { gas?: number }).gas) || 3));
    const [fen, setFen] = createSignal(FULL_ARMY_FEN);
    const [status, setStatus] = createSignal(
      "Drag gas onto pawn / knight / bishop / rook / queen / king",
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
    const charon = useBishopCharon({ startingFen: FULL_ARMY_FEN });
    const tactical = useQueenTacticalJump({ startingFen: FULL_ARMY_FEN });
    const { onGasDeploy } = usePieceSpecialArm({
      r: rookSiege.arm,
      p: marine.arm,
      k: command.arm,
      n: vulture.arm,
      b: charon.arm,
      q: tactical.arm,
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
      resetStarChessEconomy({
        turn: turnForGas(g),
        white: { stored: 12, deployed: 39 },
        black: { stored: 12, deployed: 39 },
        energy: g,
        startTimer: false,
      });
      clearSiegedRooks();
      charon.clear();
      tactical.clear();
      setStatus("Drag gas onto pawn / knight / bishop / rook / queen / king");
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
      if (charon.phase() !== "idle") {
        setStatus(charon.caption());
        return;
      }
      if (tactical.phase() !== "idle") {
        setStatus(tactical.caption());
        return;
      }
      if (command.phase() !== "idle") {
        setStatus(command.caption());
        return;
      }
      if (vulture.mineQueued() || vulture.planDone() || vulture.playing()) {
        setStatus(vulture.caption());
      }
    };

    createEffect(() => {
      void charon.phase();
      void charon.caption();
      void tactical.phase();
      void tactical.caption();
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
              <StarChessChessBoard
                variant="eclipse"
                fogOfWar
                spiderMines={vulture.mineAt() ? [vulture.mineAt()!] : []}
                attackCues={charon.combat.attackCues()}
                attackDying={charon.combat.attackDying()}
                deathCues={charon.combat.deathCues()}
                kingDamage={charon.combat.kingDamage()}
                specialTargets={[...charon.specialTargets(), ...tactical.specialTargets()]}
                armedBishops={charon.armedBishops()}
                onSquareClickIntercept={(square) =>
                  tactical.interceptSquareClick(square) || charon.interceptSquareClick(square)
                }
                jumpCues={tactical.jumpCues()}
                jumpTrails={tactical.jumpTrails()}
                moveCues={[...marine.moveCues(), ...charon.combat.moveCues()]}
                moveProgress={{ ...marine.moveProgress(), ...charon.combat.moveProgress() }}
                moveLeg={{ ...charon.combat.moveLeg() }}
              />
              <Show when={overlayBox()}>
                {(box) => (
                  <div
                    class={styles.boardOverlay}
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
                            class={`${styles.hit} ${styles.hitAdjacent}`}
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
                else if (t.piece === "b") setStatus(charon.caption());
                else if (t.piece === "q") setStatus(tactical.caption());
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
