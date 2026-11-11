// SPEC: _spec/apps/server/components.puml
import { createFetchHandler } from "./app.ts";
import { ArenaRecordStore } from "./arena/ArenaRecordStore.ts";
import { ArenaService } from "./arena/ArenaService.ts";
import { StarChessEnginePool } from "./arena/StarChessEnginePool.ts";
import { StarChessFeed } from "./arena/StarChessFeed.ts";
import { EngineBridge } from "./EngineBridge.ts";
import { Mutex } from "./http.ts";
import { OllamaLlmClient } from "./LlmClient.ts";
import { Orchestrator } from "./Orchestrator.ts";
import { StateManager } from "./StateManager.ts";

// Default to loopback so the server isn't reachable off-host without opting in.
// Docker sets HOST=0.0.0.0 explicitly so container port-publishing still works;
// native users who want LAN reachability set HOST themselves.
const HOST = process.env.HOST?.trim() || "127.0.0.1";
const PORT = Number(process.env.PORT) || 8080;

const stateManager = new StateManager();
const engineBridge = new EngineBridge();
const llmClient = new OllamaLlmClient();
const orchestrator = new Orchestrator(stateManager, engineBridge, llmClient);
const mutex = new Mutex();

// Script Arena (Phase 2): pool-backed feed + in-memory record store. The pool
// is opt-in only via STARCHESS_ARENA_ENGINES (engines are heavy subprocesses);
// a zero pool is not created here — the feed defaults off unless enabled.
const arenaService =
  Number(process.env.STARCHESS_ARENA_ENGINES ?? "0") > 0
    ? (() => {
        const pool = new StarChessEnginePool();
        const feed = new StarChessFeed(pool);
        return new ArenaService(new ArenaRecordStore(), feed);
      })()
    : undefined;

await engineBridge.start();

Bun.serve({
  hostname: HOST,
  port: PORT,
  idleTimeout: 255, // long-lived LLM streams
  fetch: createFetchHandler({ orchestrator, stateManager, mutex, arenaService }),
});

const publicHost =
  process.env.PUBLIC_HOST?.trim() ||
  (HOST === "0.0.0.0" || HOST === "127.0.0.1" ? "localhost" : HOST);
const publicPort = Number(process.env.PUBLIC_PORT) || PORT;
console.error(`Frontend available at http://${publicHost}:${publicPort}/chess`);
