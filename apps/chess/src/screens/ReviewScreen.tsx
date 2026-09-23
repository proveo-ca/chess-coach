import { useNavigate, useParams } from "@solidjs/router";
import { Show, createEffect, createMemo, createSignal, on, onCleanup } from "solid-js";
import type { Component } from "solid-js";

import { OpponentCaptures, PlayerCaptures } from "~/components/atoms/CapturedPieces";
import { EngineDepth } from "~/components/atoms/EngineDepth";
import { GameHistoryFilters } from "~/components/atoms/GameHistoryFilters";
import { GameHistoryList } from "~/components/atoms/GameHistoryList";
import { MatrixOverlay } from "~/components/atoms/MatrixOverlay";
import { MobileBanner } from "~/components/atoms/MobileBanner";
import { BoardControls } from "~/components/features/BoardControls";
import { ChessBoard } from "~/components/features/ChessBoard";
import { MobileDrawer, openMobileDrawer } from "~/components/features/MobileDrawer";
import { MobileSidebar } from "~/components/features/MobileSidebar";
import { MoveList } from "~/components/features/MoveList";
import { Sidebar } from "~/components/features/Sidebar";
import { Button } from "~/components/primitives/Button";
import { ChevronNav } from "~/components/primitives/ChevronNav";
import { IconButton } from "~/components/primitives/IconButton";
import { ShareIcon } from "~/components/primitives/icons";
import { Label } from "~/components/primitives/Label";
import { Screen } from "~/components/primitives/Screen";
import { ScreenBackNav } from "~/components/primitives/ScreenBackNav";
import { resolveAnnotations } from "~/engine/moveAnnotations";
import { useBlunderArrow } from "~/hooks/useBlunderArrow";
import { useGameAnalysis } from "~/hooks/useGameAnalysis";
import { useGameControls } from "~/hooks/useGameControls";
import { useGameHistoryFilters } from "~/hooks/useGameHistoryFilters";
import { useShareGame } from "~/hooks/useShareGame";
import { useSharedGameImport } from "~/hooks/useSharedGameImport";
import { DualNavButton } from "~/components/primitives/DualNavButton";
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

import styles from "~/screens/ReviewScreen.module.css";

export const ReviewScreen: Component = () => {
  const params = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const filters = useGameHistoryFilters();
  const { importError, importing } = useSharedGameImport();
  const { share, shareMsg } = useShareGame();
  const {
    atStart,
    atLatest,
    isReplaying,
    handleBack,
    handleForward,
    handleBackToLive,
  } = useGameControls();

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

  const historyFilters = () => (
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
  );

  return (
    <Screen highlight={reviewAnalysisMode()}>
      <Show
        when={activeGame()}
        fallback={
          <>
            <Screen.SidebarInset>
              <div class="desktop-only">
                <ScreenBackNav data-testid="review-back">{historyFilters()}</ScreenBackNav>
              </div>
              <MobileBanner title="Review Games" onMenu={openMobileDrawer} />
              <div class="mobile-only">{historyFilters()}</div>
            </Screen.SidebarInset>
            <Screen.BoardArea>
              <GameHistoryList games={filters.visibleGames()} activeId={params.id} />
              <Sidebar />
            </Screen.BoardArea>
            <Screen.Footer>
              <div class={styles.listHint}>
                <span>
                  {importing()
                    ? "Loading shared game…"
                    : importError()
                      ? importError()
                      : params.id
                        ? "Game not found. Pick one above."
                        : "Pick a game above to review."}
                </span>
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

          const shareNav = (
            <ChevronNav
              direction="forward"
              onClick={() => void share(g())}
              aria-label="Share"
              data-testid="review-share"
            >
              Share
            </ChevronNav>
          );

          const shareItem = (
            <MobileSidebar.Item>
              <IconButton
                onClick={() => void share(g())}
                aria-label="Share"
                data-testid="review-share"
              >
                <ShareIcon />
              </IconButton>
            </MobileSidebar.Item>
          );

          return (
            <>
              <Screen.SidebarInset>
                <div class="desktop-only">
                  <ScreenBackNav data-testid="review-back" trailing={shareNav}>
                    <Label variant="title" color={resultColor}>
                      {resultLabel} ({colorLabel})
                    </Label>
                    <Label variant="title">{formatGameLabel(g())}</Label>
                    <div class={styles.shareMsg}>
                      <Show when={shareMsg()}>
                        <Label variant="caption">{shareMsg()}</Label>
                      </Show>
                    </div>
                  </ScreenBackNav>
                </div>
                {/* Dynamic: fuse Back · Share · title · nav · menu (no EngineDepth). */}
                <div data-fuse-root data-testid="mobile-fuse">
                  <MobileBanner
                    title={
                      <Label
                        variant="title"
                        color={resultColor}
                        class={styles.bannerMatchup}
                        data-testid="review-matchup"
                      >
                        {formatReviewMatchup(g())}
                      </Label>
                    }
                    onMenu={openMobileDrawer}
                  />
                  <MobileSidebar dynamicOnly>
                    {shareItem}
                    <MobileSidebar.Item nav>
                      <DualNavButton
                        onBack={handleBack}
                        onForward={handleForward}
                        backDisabled={atStart()}
                        forwardDisabled={atLatest()}
                        inverted={isReplaying()}
                        showBackToLive={isReplaying()}
                        onBackToLive={handleBackToLive}
                        label={isReplaying() ? "History" : undefined}
                      />
                    </MobileSidebar.Item>
                  </MobileSidebar>
                </div>
                <Show when={shareMsg()}>
                  <div class="mobile-only">
                    <Label variant="caption">{shareMsg()}</Label>
                  </div>
                </Show>
                <div class={`${styles.moveListSlot} ${styles.tallOnly}`}>
                  <MoveList
                    game={g()}
                    activePly={analysisBranchPly()}
                    analysis={gameAnalysis()}
                    floatingCapable
                  />
                </div>
                <OpponentCaptures />
              </Screen.SidebarInset>

              <Screen.BoardArea>
                <Screen.BoardColumn>
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
                </Screen.BoardColumn>
                <Sidebar />
              </Screen.BoardArea>

              <Screen.Footer>
                <PlayerCaptures />
                <div class={styles.tallOnly}>
                  <BoardControls center={<EngineDepth />} omitDrawer leading={shareItem} />
                </div>
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
