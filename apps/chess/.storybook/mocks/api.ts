import { Chess } from "chess.js";

import { START_FEN } from "~/storybook/fixtures";
import type { Difficulty } from "~/types/settings";

export type MoveRequest = {
  humanMoveSan: string;
  fenAfterHuman: string;
  difficulty?: Difficulty;
};
export type MoveResponse = { fen: string; move: string; advice?: string };
export type AdviceRequest = { humanMove: string; aiMove: string; fen: string };
export type ExplainRequest = {
  fenBefore: string;
  fenAfter: string;
  isBlunder: boolean;
  moveSan: string;
};
export type HelloResponse = {
  model: string;
  greeting: string;
  thinking: string[];
  bestMove: string[];
};
export type NewGameResponse = { fen: string };

export const postNewGame = async (): Promise<NewGameResponse> => ({ fen: START_FEN });

export const fetchHello = async (): Promise<HelloResponse> => ({
  model: "storybook-coach",
  greeting: "Welcome to the Storybook board.",
  thinking: ["Considering the fixture…"],
  bestMove: ["That is the fixture's best move."],
});

export const postMove = async (request: MoveRequest): Promise<MoveResponse> => {
  const game = new Chess(request.fenAfterHuman);
  const move = game.moves()[0] ?? "e5";
  if (!game.isGameOver() && game.moves().length > 0) game.move(move);
  return {
    fen: game.fen(),
    move,
    advice: "A deterministic Storybook reply.",
  };
};

const streamText = (
  text: string,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<void> => {
  if (!signal?.aborted) onChunk(text);
  return Promise.resolve();
};

export const postAdviceStream = (
  _request: AdviceRequest,
  onChunk: (chunk: string) => void,
  options?: { signal?: AbortSignal },
) => streamText("Develop your pieces and protect the king.", onChunk, options?.signal);

export const postExplainStream = (
  _request: ExplainRequest,
  onChunk: (chunk: string) => void,
  options?: { signal?: AbortSignal },
) => streamText("This fixture loses control of the center.", onChunk, options?.signal);
