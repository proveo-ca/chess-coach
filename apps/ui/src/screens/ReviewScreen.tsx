import { useNavigate, useParams } from "@solidjs/router";
import { Show, createEffect, createMemo, createSignal, on, onCleanup } from "solid-js";
import type { Component } from "solid-js";

import { OpponentCaptures, PlayerCaptures } from "~/components/atoms/CapturedPieces";
import { EngineDepth } from "~/components/atoms/EngineDepth";
import { GameHistoryList } from "~/components/atoms/GameHistoryList";
import { MatrixOverlay } from "~/components/atoms/MatrixOverlay";
import { BoardControls } from "~/components/features/BoardControls";
import { ChessBoard } from "~/components/features/ChessBoard";
import { MobileDrawer, openMobileDrawer } from "~/components/features/MobileDrawer";
import { MobileSidebar } from "~/components/features/MobileSidebar";
import { MoveList } from "~/components/features/MoveList";
import { Sidebar } from "~/components/features/Sidebar";
import { Button } from "~/components/primitives/Button";
import { GameHistoryFilters } from "~/components/atoms/GameHistoryFilters";
import { IconButton } from "~/components/primitives/IconButton";
import { BackArrowIcon, HamburgerIcon, ShareIcon } from "~/components/primitives/icons";
import { Label } from "~/components/primitives/Label";
import { Screen } from "~/components/primitives/Screen";
import { resolveAnnotations } from "~/engine/moveAnnotations";
import { useBlunderArrow } from "~/hooks/useBlunderArrow";
import { useGameAnalysis } from "~/hooks/useGameAnalysis";
import { useGameHistoryFilters } from "~/hooks/useGameHistoryFilters";
import { useShareGame } from "~/hooks/useShareGame";
import { useSharedGameImport } from "~/hooks/useSharedGameImport";
import { REVIEW_CAPABILITIES, setCapabilities } from "~/store/capabilitiesStore";
import { setShowNewGame } from "~/store/coachStore";
import { gameHistory, getGameById } from "~/store/gameHistoryStore";
import {
  fenHistory,
  loadGame,
  reviewAnalysisMode,
  setReviewAnalysisMode,
  setSavedReviewBranchIndex,
  setSavedReviewPgn,
  setSavedReviewStartingFen,
  setViewIndex,
} from "~/store/gameStore";
import {
  activePlayerColor,
  blunderThresholdCp,
  opponentIdentity,
  playerIdentity,
  setActivePlayerColor,
  setOpponentIdentity,
  setPlayerIdentity,
} from "~/store/settingsStore";
import { formatGameLabel, formatReviewMatchup } from "~/utils/gameTitle";
import { canGoBackInApp } from "~/utils/navHistory";

export const ReviewScreen: Component = () => {
  const params = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const filters = useGameHistoryFilters();
  const { importError, importing } = useSharedGameImport();
  const { share, shareMsg } = useShareGame();

  let prevPlayerIdentity = playerIdentity();
  let prevOpponentIdentity = opponentIdentity();
  let prevActivePlayerColor = activePlayerColor();

  const [originalFenHistory, setOriginalFenHistory] = createSignal<string[]>([]);
  const [originalPlayerColor, setOriginalPlayerColor] = createSignal<"w" | "b">("w");
  const [analysisBranchPly, setAnalysisBranchPly] = createSignal<number | null>(null);

  // Branched analysis moves are scratch work, so the MoveList stays pinned
  // to the original move that produced the branch-off position.
  const branchIndexFrom = (current: string[], original: string[]) => {
    const firstMismatch = current.findIndex((fen, i) => fen !== original[i]);
    return Math.max(
      0,
      firstMismatch >= 0 ? firstMismatch - 1 : Math.min(current.length, original.length) - 1,
    );
  };

  const activeGame = createMemo(() => {
    const id = params.id;
    if (!id) return null;
    void gameHistory();
    return getGameById(id);
  });

  const gameAnalysis = useGameAnalysis(activeGame);
  const annotations = createMemo(() => {
    const g = activeGame();
    if (!g) return [];
    const a = gameAnalysis();
    return resolveAnnotations(
      g.moves,
      a.cpDeltas,
      a.wasBestMoves,
      a.bestMoveUcis,
      blunderThresholdCp(),
    );
  });

  useBlunderArrow(annotations, () => gameAnalysis().bestMoveUcis);

  createEffect(() => {
    setCapabilities(
      activeGame()
        ? {
            ...REVIEW_CAPABILITIES,
            historyNav: true,
            freeColorControl: true,
            bestMoveArrow: reviewAnalysisMode() ? "both" : "player-only",
          }
        : REVIEW_CAPABILITIES,
    );
  });

  createEffect(
    on(
      () => params.id,
      (id) => {
        if (!id) return;
        const g = getGameById(id);
        if (!g) return;

        prevPlayerIdentity = playerIdentity();
        prevOpponentIdentity = opponentIdentity();
        prevActivePlayerColor = activePlayerColor();

        if (g.playerRace) setPlayerIdentity(g.playerRace);
        if (g.opponentRace) setOpponentIdentity(g.opponentRace);
        setActivePlayerColor(g.playerColor);

        setOriginalPlayerColor(g.playerColor);
        setReviewAnalysisMode(false);
        setAnalysisBranchPly(null);
        setSavedReviewBranchIndex(0);

        try {
          loadGame({ pgn: g.pgn, startingFen: g.startingFen });
          setOriginalFenHistory([...fenHistory()]);
        } catch (err) {
          console.error("Failed to load saved game", err);
          setOriginalFenHistory([]);
        }
      },
      { defer: false },
    ),
  );

  createEffect(() => {
    const orig = originalFenHistory();
    if (activeGame() && orig.length > 0) {
      const current = fenHistory();
      const diverged = current.length !== orig.length || current.some((fen, i) => fen !== orig[i]);
      if (diverged) {
        if (analysisBranchPly() == null) {
          const branchIndex = branchIndexFrom(current, orig);
          setAnalysisBranchPly(branchIndex - 1);
          setSavedReviewBranchIndex(branchIndex);
        }
        setReviewAnalysisMode(true);
        const g = activeGame()!;
        setSavedReviewPgn(g.pgn);
        setSavedReviewStartingFen(g.startingFen);
        setActivePlayerColor(originalPlayerColor());
        return;
      }
    }
    setAnalysisBranchPly(null);
    setSavedReviewBranchIndex(0);
    setReviewAnalysisMode(false);
  });

  onCleanup(() => {
    setReviewAnalysisMode(false);
    setAnalysisBranchPly(null);
    setSavedReviewBranchIndex(0);
    setPlayerIdentity(prevPlayerIdentity);
    setOpponentIdentity(prevOpponentIdentity);
    setActivePlayerColor(prevActivePlayerColor);
  });

  return (
    <Screen highlight={reviewAnalysisMode()}>
      <Show
        when={activeGame()}
        fallback={
          <>
            <Screen.SidebarInset>
              <GameHistoryFilters
                colorFilter={filters.colorFilter()}
                setColorFilter={filters.setColorFilter}
                firstMoveFilter={filters.firstMoveFilter()}
                setFirstMoveFilter={filters.setFirstMoveFilter}
                availableFirstMoves={filters.availableFirstMoves()}
                totalPages={filters.totalPages()}
                activePage={filters.activePage()}
                currentDateLabel={filters.currentDateLabel()}
                goToPrev={filters.goToPrev}
                goToNext={filters.goToNext}
              />
            </Screen.SidebarInset>
            <Screen.BoardArea>
              <GameHistoryList games={filters.visibleGames()} activeId={params.id} />
              <Sidebar />
            </Screen.BoardArea>
            <Screen.Footer>
              <div
                style={{
                  color: "rgba(255,255,255,0.6)",
                  padding: "2rem",
                  "text-align": "center",
                  display: "flex",
                  "flex-direction": "column",
                  "align-items": "center",
                  gap: "1rem",
                }}
              >
                <span>
                  {importing()
                    ? "Loading shared game…"
                    : importError()
                      ? importError()
                      : params.id
                        ? "Game not found. Pick one above."
                        : "Pick a game above to review."}
                </span>
                <Button primary href="/">
                  Back to Main Menu
                </Button>
              </div>
            </Screen.Footer>
          </>
        }
      >
        {(g) => {
          const resultLabel =
            g().result === "ongoing"
              ? "In Progress"
              : g().result.charAt(0).toUpperCase() + g().result.slice(1);
          const colorLabel = g().playerColor === "w" ? "White" : "Black";
          const resultColor = g().result === "ongoing" ? undefined : g().result;

          return (
            <>
              <Screen.SidebarInset class="desktop-only">
                <Label variant="title" color={resultColor}>
                  {resultLabel} ({colorLabel})
                </Label>
                <Label variant="title">{formatGameLabel(g())}</Label>
                <div
                  style={{
                    display: "flex",
                    "justify-content": "center",
                    gap: "0.75rem",
                    padding: "0.6rem 0",
                  }}
                >
                  <Button onClick={() => void share(g())}>Share</Button>
                  <Show
                    when={canGoBackInApp()}
                    fallback={
                      <Button primary href="/">
                        Back to Main Menu
                      </Button>
                    }
                  >
                    <Button primary onClick={() => navigate(-1)}>
                      Back
                    </Button>
                  </Show>
                </div>
                <div style={{ "min-height": "1.25rem", "margin-top": "0.5rem" }}>
                  <Show when={shareMsg()}>
                    <Label variant="caption">{shareMsg()}</Label>
                  </Show>
                </div>
              </Screen.SidebarInset>

              <Screen.BoardArea>
                <Screen.BoardColumn>
                  <MobileSidebar toolbar>
                    <MobileSidebar.Item drawer>
                      <IconButton onClick={openMobileDrawer} aria-label="Open menu">
                        <HamburgerIcon />
                      </IconButton>
                    </MobileSidebar.Item>
                    <MobileSidebar.Main>
                      <MobileSidebar.MatchupLabel data-testid="review-matchup">
                        <Label variant="title" color={resultColor}>
                          {formatReviewMatchup(g())}
                        </Label>
                      </MobileSidebar.MatchupLabel>
                    </MobileSidebar.Main>
                    <MobileSidebar.Item nav>
                      <MobileSidebar.NavActions>
                        <IconButton onClick={() => void share(g())} aria-label="Share">
                          <ShareIcon />
                        </IconButton>
                        <Show
                          when={canGoBackInApp()}
                          fallback={
                            <IconButton onClick={() => navigate("/")} aria-label="Back to Main Menu">
                              <BackArrowIcon />
                            </IconButton>
                          }
                        >
                          <IconButton onClick={() => navigate(-1)} aria-label="Back">
                            <BackArrowIcon />
                          </IconButton>
                        </Show>
                      </MobileSidebar.NavActions>
                    </MobileSidebar.Item>
                  </MobileSidebar>
                  <Show when={shareMsg()}>
                    <div class="mobile-only">
                      <Label variant="caption">{shareMsg()}</Label>
                    </div>
                  </Show>
                  <BoardControls center={<EngineDepth />} omitDrawer />
                  <OpponentCaptures />
                  <ChessBoard
                    gameOverActions={
                      <>
                        <Button
                          primary
                          onClick={() => {
                            setShowNewGame(true);
                            navigate("/selena");
                          }}
                        >
                          Another Game
                        </Button>
                        <Button onClick={() => setViewIndex(0)}>Replay Review</Button>
                      </>
                    }
                  />
                  <PlayerCaptures />
                </Screen.BoardColumn>
                <Sidebar />
              </Screen.BoardArea>

              <Screen.Footer>
                <MoveList
                  game={g()}
                  activePly={analysisBranchPly()}
                  analysis={gameAnalysis()}
                  floatingCapable
                />
              </Screen.Footer>
            </>
          );
        }}
      </Show>

      <Show when={reviewAnalysisMode()}>
        <MatrixOverlay density={60} speed={10} />
      </Show>

      <MobileDrawer />
    </Screen>
  );
};
