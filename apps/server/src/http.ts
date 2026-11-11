// SPEC: _spec/apps/server/components.puml
import { UciTimeoutError } from "./UciDriver.ts";

/** Thrown by request-boundary validation; maps to HTTP 400 (see errorResponse). */
export class BadRequestError extends Error {}

/**
 * Cross-origin isolation headers, required for the browser's SharedArrayBuffer
 * WASM Stockfish. Applied to every response regardless of Origin.
 */
const ISOLATION_HEADERS: Record<string, string> = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

/**
 * CORS Origin allowlist. The desktop UI is served same-origin under /chess, so
 * cross-origin access is only needed by the dev/e2e/preview servers. Anything
 * else (a random website driving the local server from the victim's browser) is
 * denied: no ACAO header → the browser blocks the cross-origin read, and the
 * Content-Type/Origin gates below block the write.
 */
const DEFAULT_ALLOWED_ORIGINS = [5173, 5174, 8787].flatMap((p) => [
  `http://localhost:${p}`,
  `http://127.0.0.1:${p}`,
]);

const ALLOWED_ORIGINS = new Set([
  ...DEFAULT_ALLOWED_ORIGINS,
  ...(process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o !== ""),
]);

export function isAllowedOrigin(origin: string | null): boolean {
  return origin !== null && ALLOWED_ORIGINS.has(origin);
}

/**
 * Headers for a response to `req`: isolation headers always, plus a reflected
 * `Access-Control-Allow-Origin` only when the request Origin is allowlisted.
 * A same-origin request has no Origin header (or its own origin) and needs no
 * ACAO. Pass the result to json()/streamResponse()/serveStatic().
 */
export function corsHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = { ...ISOLATION_HEADERS };
  const origin = req.headers.get("origin");
  if (isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin as string;
    headers["Vary"] = "Origin";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
    headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
  }
  return headers;
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

/**
 * StatusPages-equivalent error mapping (_spec/apps/server/behavior.md §2):
 * timeout → 504, bad input → 400, everything else → 500.
 */
export function errorResponse(e: unknown, headers: Record<string, string> = {}): Response {
  const msg = e instanceof Error ? e.message : "Unexpected error";
  if (e instanceof UciTimeoutError || (e instanceof Error && e.name === "TimeoutError")) {
    return json({ error: "Harness request timed out" }, 504, headers);
  }
  if (e instanceof BadRequestError || e instanceof SyntaxError) {
    return json({ error: msg || "Bad request" }, 400, headers);
  }
  return json({ error: msg || "Internal error" }, 500, headers);
}

/** Serializes all engine access — engines are single subprocesses (cf. Kotlin daemonMutex). */
export class Mutex {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.tail.then(fn);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

const REQUEST_TIMEOUT_MS = Number(process.env.HARNESS_REQUEST_TIMEOUT_MS ?? "60000") || 60_000;

/** Per-request timeout for unary ops → maps to 504 via errorResponse. */
export function withTimeout<T>(p: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const e = new Error("Harness request timed out");
      e.name = "TimeoutError";
      reject(e);
    }, REQUEST_TIMEOUT_MS);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * Stream an async generator as a chunked text/plain body, serialized through
 * the mutex. Drains the generator after a client abort instead of stopping it
 * (parity with the Ktor route's keep-collecting-after-disconnect behavior).
 */
export function streamResponse(
  mutex: Mutex,
  gen: AsyncGenerator<string, void, unknown>,
  headers: Record<string, string> = {},
): Response {
  let aborted = false;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await mutex.run(async () => {
          for await (const chunk of gen) {
            if (aborted) continue; // keep draining, stop writing
            controller.enqueue(encoder.encode(chunk));
          }
        });
      } catch (e) {
        if (!aborted) controller.error(e as Error);
        return;
      }
      if (!aborted) controller.close();
    },
    cancel() {
      aborted = true;
    },
  });
  return new Response(stream, {
    headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" },
  });
}

const STATIC_DIR = process.env.STATIC_DIR ?? "static";

/** Serve the desktop UI build under /chess/ with SPA fallback to index.html. */
export async function serveStatic(
  pathname: string,
  headers: Record<string, string> = {},
): Promise<Response | null> {
  if (pathname !== "/chess" && !pathname.startsWith("/chess/")) return null;

  const filePath = `${STATIC_DIR}${pathname}`;
  const file = Bun.file(filePath);
  if (pathname !== "/chess" && pathname !== "/chess/" && (await file.exists())) {
    return new Response(file, { headers });
  }

  const index = Bun.file(`${STATIC_DIR}/chess/index.html`);
  if (await index.exists()) {
    return new Response(index, { headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } });
  }
  return null;
}
