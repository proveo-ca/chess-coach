// SPEC: _spec/apps/server/components.puml, _spec/apps/server/starchess-arena-feed.puml
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
import type { ArenaService } from "./arena/ArenaService.ts";
import { isScriptId } from "./arena/ArenaService.ts";

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
type ArenaRunsRequest = {
  pairings?: Array<{ w?: string; b?: string }>;
  seeds?: string[];
  engine?: boolean;
  movetimeMs?: number;
};

export type AppDeps = {
  orchestrator: Orchestrator;
  stateManager: StateManager;
  mutex: Mutex;
  arenaService?: ArenaService;
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

      // --- Script Arena (Phase 2: node-side feed + records) ---
      // Runs are long (live engine lookahead) and fully independent of the
      // chess harness mutex, so they are deliberately NOT serialized by it.
      if (!deps.arenaService) {
        return json({ error: "Script arena is not enabled on this instance" }, 404, cors);
      }
      const arena = deps.arenaService;

      if (req.method === "POST" && pathname === "/starchess/arena/runs") {
        requireJson(req);
        const body = (await req.json()) as ArenaRunsRequest;
        if (!Array.isArray(body.pairings) || body.pairings.length === 0) {
          throw new BadRequestError("pairings must be a non-empty array");
        }
        const pairings = body.pairings.map((p) => {
          if (!p || !isScriptId(p.w) || !isScriptId(p.b)) {
            throw new BadRequestError(`Invalid pairing: ${JSON.stringify(p)}`);
          }
          return { w: p.w, b: p.b };
        });
        const seeded = (body.seeds ?? []).map((s) => String(s));
        const records = await withTimeout(
          arena.batches({
            pairings,
            seeds: seeded,
            engine: body.engine ?? false,
            movetimeMs: body.movetimeMs ?? 0,
          }),
        );
        return json(
          {
            runs: records.map((r) => ({
              id: r.id,
              players: r.players,
              mapSeed: r.mapSeed,
              outcome: r.outcome,
              turns: r.turns,
              engine: r.meta?.engine ?? null,
              status: r.meta?.status ?? "finished",
            })),
          },
          201,
          cors,
        );
      }

      // SPEC: _spec/apps/starchess/replay-import.puml — arena list/detail for web import
      const CORP: Record<string, string> = {
        "Cross-Origin-Resource-Policy": "cross-origin",
      };
      const arenaCors = { ...cors, ...CORP };

      const isArenaListPath =
        pathname === "/starchess/arena/runs" || pathname === "/starchess/arena/games";
      if (req.method === "GET" && isArenaListPath) {
        const list = arena.store.all().map((r) => ({
          id: r.id,
          players: r.players,
          mapSeed: r.mapSeed,
          outcome: r.outcome,
          turns: r.turns,
          engine: r.meta?.engine ?? null,
          status: r.meta?.status ?? "finished",
        }));
        // Support both legacy {runs} and spec {games} shape.
        return json({ runs: list, games: list }, 200, arenaCors);
      }

      const arenaRunMatch = pathname.match(/^\/starchess\/arena\/(?:runs|games)\/([^/]+)$/);
      if (req.method === "GET" && arenaRunMatch) {
        let id: string;
        try {
          id = decodeURIComponent(arenaRunMatch[1]!);
        } catch {
          return json({ error: "Run not found" }, 404, arenaCors);
        }
        const record = arena.store.get(id);
        if (!record) return json({ error: "Run not found" }, 404, arenaCors);
        return json(record, 200, arenaCors);
      }

      return json({ error: "Not found" }, 404, cors);
    } catch (e) {
      if (e instanceof UnsupportedMediaTypeError) return json({ error: e.message }, 415, cors);
      return errorResponse(e, cors);
    }
  };
}
