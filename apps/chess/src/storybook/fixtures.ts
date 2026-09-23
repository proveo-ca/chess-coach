import type { GameRecord } from "~/types/game";
import type { RoomSnapshot } from "~/types/multiplayer";

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
export const MIDGAME_FEN = "r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 4 8";
export const CHECKMATE_FEN = "7k/6Q1/6K1/8/8/8/8/8 b - - 0 1";

export const SAMPLE_GAME: GameRecord = {
  id: "storybook-game",
  startedAt: "2026-01-01T12:00:00.000Z",
  endedAt: "2026-01-01T12:10:00.000Z",
  result: "win",
  pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6",
  startingFen: START_FEN,
  playerColor: "w",
  difficulty: "intermediate",
  playerRace: "Human",
  opponentRace: "Cat",
  playerName: "Story Player",
  opponentName: "Selena",
  moves: [
    { san: "e4", hasPressedHint: false, isAI: false },
    { san: "e5", hasPressedHint: false, isAI: true },
    { san: "Nf3", hasPressedHint: true, isAI: false },
    { san: "Nc6", hasPressedHint: false, isAI: true },
    { san: "Bb5", hasPressedHint: false, isAI: false },
    { san: "a6", hasPressedHint: false, isAI: true },
  ],
};

export const SAMPLE_ROOM: RoomSnapshot = {
  players: [
    {
      peerId: "storybook-white",
      identity: { name: "Story Player", pieceSet: "cburnett" },
      color: "w",
      ready: true,
    },
    {
      peerId: "storybook-black",
      identity: { name: "Selena", pieceSet: "selena" },
      color: "b",
      ready: true,
    },
  ],
  observers: [{ peerId: "storybook-observer", identity: { name: "Observer" } }],
  started: true,
  gameOver: null,
  draw: null,
  timeControl: 300,
  clocks: { w: 272_000, b: 284_000 },
  fen: MIDGAME_FEN,
};
