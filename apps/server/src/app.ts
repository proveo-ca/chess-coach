// SPEC: _spec/apps/server/components.puml
import { isValidFen, isValidMoveToken } from "@chess-coach/engine-core";

import {
  BadRequestError,
  corsHeaders,
  errorResponse,
  isAllowedOrigin,
  json,
  type Mutex,
  serveStatic,
  streamResponse,
  withTimeout,
} from "./http.ts";
import type { Orchestrator } from "./Orchestrator.ts";
import type { StateManager } from "./StateManager.ts";

/** Validate a request FEN at the boundary; 400 (not 500) on bad input. */
function checkFen(fen: string): void {
  if (!isValidFen(fen)) throw new BadRequestError("Invalid FEN");
}

/** Validate an engine-bound move token at the boundary; 400 on bad input. */
function checkMove(move: string): void {
  if (!isValidMoveToken(move)) throw new BadRequestError("Invalid move");
}

type MoveRequest = { humanMoveSan: string; fenAfterHuman: string; difficulty?: string };
type AdviceRequest = { humanMove: string; aiMove: string; fen: string };
type ExplainRequest = { fenBefore: string; fenAfter: string; isBlunder?: boolean; moveSan?: string };

export type AppDeps = {
  orchestrator: Orchestrator;
  stateManager: StateManager;
  mutex: Mutex;
};

/** Reject bodies that aren't declared application/json — forces a CORS preflight
 *  for cross-origin POSTs, closing the text/plain simple-request CSRF bypass. */
function requireJson(req: Request): void {
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().startsWith("application/json")) {
    throw new UnsupportedMediaTypeError("Content-Type must be application/json");
  }
}

class UnsupportedMediaTypeError extends Error {}

/**
 * Builds the Bun.serve fetch handler. Dependencies are injected so the routes
 * can be integration-tested with fake engines (no native stockfish/lc0).
 * Implements the CoachService contract (_spec/apps/server/behavior.md §2).
 */
export function createFetchHandler(deps: AppDeps): (req: Request) => Promise<Response> {
  const { orchestrator, stateManager, mutex } = deps;

  return async (req: Request): Promise<Response> => {
    const { pathname } = new URL(req.url);
    const cors = corsHeaders(req);

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    try {
      if (req.method === "GET" && pathname === "/") {
        return Response.redirect(new URL("/chess", req.url).toString(), 302);
      }

      if (req.method === "GET" && pathname === "/hello") {
        const phrases = await withTimeout(mutex.run(() => orchestrator.generateUiPhrases()));
        return json(
          {
            model: process.env.LLM_MODEL ?? "",
            greeting: "Hey! I'm Selena. Let's play chess.",
            thinking: phrases.thinking,
            bestMove: phrases.bestMove,
          },
          200,
          cors,
        );
      }

      if (req.method === "POST" && pathname === "/move") {
        requireJson(req);
        const body = (await req.json()) as MoveRequest;
        if (body.fenAfterHuman) checkFen(body.fenAfterHuman);
        if (body.humanMoveSan) checkMove(body.humanMoveSan);
        const result = await withTimeout(
          mutex.run(async () => {
            if (body.fenAfterHuman) stateManager.writeFen(body.fenAfterHuman);
            return orchestrator.executeTurn(body.humanMoveSan, body.difficulty ?? "intermediate");
          }),
        );
        return json({ fen: result.fen, move: result.move }, 200, cors);
      }

      if (req.method === "POST" && pathname === "/advice") {
        requireJson(req);
        const body = (await req.json()) as AdviceRequest;
        checkFen(body.fen);
        if (body.humanMove && body.humanMove.trim() !== "") checkMove(body.humanMove);
        return streamResponse(
          mutex,
          orchestrator.generateAdviceStream(body.humanMove, body.aiMove, body.fen),
          cors,
        );
      }

      if (req.method === "POST" && pathname === "/explain") {
        requireJson(req);
        const body = (await req.json()) as ExplainRequest;
        checkFen(body.fenBefore);
        checkFen(body.fenAfter);
        if (body.moveSan) checkMove(body.moveSan);
        return streamResponse(
          mutex,
          orchestrator.generateExplanationStream(
            body.fenBefore,
            body.fenAfter,
            body.isBlunder ?? true,
            body.moveSan ?? "",
          ),
          cors,
        );
      }

      if (req.method === "POST" && pathname === "/new") {
        // Bodyless (no Content-Type preflight), so guard cross-origin drive-by
        // by rejecting a present-but-disallowed Origin.
        const origin = req.headers.get("origin");
        if (origin !== null && !isAllowedOrigin(origin)) {
          return json({ error: "Forbidden" }, 403, cors);
        }
        stateManager.resetGame();
        return json({ fen: stateManager.readFen() }, 200, cors);
      }

      if (req.method === "GET") {
        const stat = await serveStatic(pathname, cors);
        if (stat) return stat;
      }

      return json({ error: "Not found" }, 404, cors);
    } catch (e) {
      if (e instanceof UnsupportedMediaTypeError) return json({ error: e.message }, 415, cors);
      return errorResponse(e, cors);
    }
  };
}
