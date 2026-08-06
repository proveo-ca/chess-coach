import { setStorybookCapabilities } from "~/screens/storybookCapabilities";
import { COACH_CAPABILITIES } from "~/store/capabilitiesStore";
import { resetCoachState } from "~/store/coachStore";
import { setBaseEvalDepth, setBaseEvalScore } from "~/store/evalStore";
import { importGameRecord, resetGameHistory } from "~/store/gameHistoryStore";
import {
  loadFen,
  setReviewAnalysisMode,
  setSavedReviewBranchIndex,
  setSavedReviewPgn,
  setSavedReviewStartingFen,
} from "~/store/gameStore";
import {
  applySnapshot,
  reset as resetRoom,
  setConnectionStatus,
  setMyPeerId,
  setRole,
  setSeat,
} from "~/store/roomStore";
import { setActivePlayerColor, setColorPref, setDifficulty, setImLost, setOpponentIdentity, setPlayerIdentity, setPlayerName, setNerdPieceSet } from "~/store/settingsStore";
import { setNerdModeUnlocked } from "~/features/nerd/identity";
import { exitTravel, startTravel } from "~/store/travelStore";
import { setFooterFloat } from "~/store/viewportLayoutStore";
import { resetStorybookRandom } from "~/storybook/browserMocks";
import { START_FEN } from "~/storybook/fixtures";
import type { CoachEmotion } from "~/types/coach";
import type { GameRecord, MoveSquares } from "~/types/game";
import type { ConnStatus, Role, RoomSnapshot, Seat } from "~/types/multiplayer";
import type { Difficulty, NerdPieceSet, PlayerColorPref, PlayerIdentity } from "~/types/settings";

export type StoryState = {
  capabilities?: Parameters<typeof setStorybookCapabilities>[0];
  fen?: string;
  gameHistory?: GameRecord[];
  settings?: {
    colorPref?: PlayerColorPref;
    activePlayerColor?: "w" | "b";
    difficulty?: Difficulty;
    playerIdentity?: PlayerIdentity;
    opponentIdentity?: PlayerIdentity;
    playerName?: string;
    imLost?: boolean;
    nerdIdentityUnlocked?: boolean;
    nerdPieceSet?: NerdPieceSet;
  };
  coach?: {
    advice?: string;
    emotion?: CoachEmotion;
    ready?: boolean;
    llmProgress?: number;
    llmLoadingText?: string;
  };
  room?: {
    snapshot: RoomSnapshot;
    role?: Role;
    seat?: Seat;
    peerId?: string;
    connectionStatus?: ConnStatus;
  };
  travel?: {
    fens: string[];
    moves: (MoveSquares | null)[];
  };
  evaluation?: {
    score: { kind: "cp" | "mate"; value: number } | null;
    depth?: number;
  };
  footerFloat?: boolean;
};

export function resetStoryState(state: StoryState = {}): void {
  resetStorybookRandom();
  localStorage.clear();

  setStorybookCapabilities(state.capabilities ?? COACH_CAPABILITIES);
  loadFen(state.fen ?? START_FEN);
  setReviewAnalysisMode(false);
  setSavedReviewPgn("");
  setSavedReviewStartingFen("");
  setSavedReviewBranchIndex(0);

  exitTravel();
  if (state.travel) startTravel(state.travel.fens, state.travel.moves);

  resetGameHistory();
  for (const game of state.gameHistory ?? []) importGameRecord(game);

  const settings = state.settings ?? {};
  setColorPref(settings.colorPref ?? "w");
  setActivePlayerColor(settings.activePlayerColor ?? "w");
  setDifficulty(settings.difficulty ?? "intermediate");
  setPlayerIdentity(settings.playerIdentity ?? "Human");
  setOpponentIdentity(settings.opponentIdentity ?? "Cat");
  setPlayerName(settings.playerName ?? "Story Player");
  setImLost(settings.imLost ?? false);
  setNerdModeUnlocked(settings.nerdIdentityUnlocked ?? false);
  setNerdPieceSet(settings.nerdPieceSet ?? "nerd");

  const coach = state.coach ?? {};
  resetCoachState({
    baseAdvice: coach.advice ?? "Take your time and look for forcing moves.",
    baseCoachEmotion: coach.emotion ?? "idle",
    isAppReady: coach.ready ?? true,
    llmProgress: coach.llmProgress ?? 0,
    llmLoadingText: coach.llmLoadingText ?? "Preparing the board…",
  });

  resetRoom();
  if (state.room) {
    applySnapshot(state.room.snapshot);
    setRole(state.room.role ?? "host");
    setSeat(state.room.seat ?? "player");
    setMyPeerId(state.room.peerId ?? state.room.snapshot.players[0]?.peerId ?? null);
    setConnectionStatus(state.room.connectionStatus ?? "connected");
  }

  setBaseEvalScore(state.evaluation?.score ?? null);
  setBaseEvalDepth(state.evaluation?.depth ?? 0);
  setFooterFloat(state.footerFloat ?? false);
}
