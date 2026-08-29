# PLAN — StarChess Script Arena: scripts play each other, recorded & replayable

Status: **PLANNED** (no source changes yet — this file + the three `.puml` beside it are the
design that precedes implementation).

Author: opencode lead. Reviewers: architect/spec-keeper/adversarial-reviewer (read-only).

---

## Goal

Make the **adjutant scripts play each other** on the **pure SCFEN engine**, headlessly, with the
games **recorded and replayable in the web app**. The answer to "how can we know one script is
better than the other?" comes from a **scoreboard of arena matches**, and the recorded games give
humans real positions to look at — not just percentages.

The arena runs in **Node/Bun** (no browser). The strategic adjutant's planned Stockfish lookahead
therefore has to work **outside a browser** — that is the complicated part, and this plan solves it
by making the browser-grade `UciDriver` seam already present in `apps/server` reusable.

```
question: naive ≠ strategic? ──► arena (pure core) ──► records (SCFEN + resolves) ──► replay in app
                              └────────► scoreboard (win/loss, material margin, turns)
```

## Why the existing code already 90% fits

| Need | Existing seam |
|---|---|
| Pure headless loop | `parseScFen → addScAction → endScTurn().next` is literally `buildPlys` (`apps/starchess/src/demos/reviewSamples.ts:32-44`); golden corpus test at `packages/starchess-core/src/__tests__/corpus/goldenCorpus.test.ts:48` |
| Scripts are pure + deterministic | `adjutant()` (`packages/starchess-core/src/ai/adjutant.ts:50`) and `strategicAdjutant()` (`src/ai/strategic/orchestrator.ts:49`); no `Math.random`/`Date` in core |
| Node service consuming stockfish | `apps/server` already runs native stockfish over `Bun.spawn`: `UciDriver.ts`, `StockfishEngine.ts` (`getEvaluation(fen,depth) → {bestMove,cp,isMate,mateIn}`), `EngineBridge.ts` |
| Recording format | `StarChessGameRecord = { scfens: string[], resolves: EndScTurnResult[], … }` (`apps/starchess/src/types/review.ts:36-48`); already localStorage-persisted, JSON-serializable |
| Web replay host | `historyFromRecord` (`apps/starchess/src/store/matchHistoryStore.ts:89-100`) → `createMatchStateFromReviewHistory` (`src/app/reviewHistory.ts:114`) → `ReviewDemoScreen`; `/review/:id` already replays records |
| Single-position import | `?scfen=` deep link (`apps/starchess/src/adapters/browser/index.ts:22-32`, consumed `src/screens/SingleScreen.tsx:75`) |
| Win condition | `scOutcome(snap)` (`packages/starchess-core/src/outcome.ts:14`) — terminal snapshots are `phase:"O"` |

## The loop (arena turn driver)

For each turn, in order:

1. `beginScTurn(snap)` → may return `asResolve` (a chip-only turn-open ply). If it does, record that ply **immediately** as `{ scfen: formatScFen(normalizeSnapGas(beginScTurn.next)), resolve: asResolve }` — the *post-chip* snapshot — then reassign `snap = beginScTurn.next`. If outcome reached (terminal king chip) → stop **after** recording that terminal ply. Mirrors the app's `BEGIN_CHECKS_DONE` push (`matchReducer.ts:548-549`).
2. For each side in **exactly `[w, b]`** that has a script and no queued action yet: `plan = await script(snap, sideCtx)`; then `snap = plan.snapshot` and debit `plan.spendMinerals` from the **arena-threaded mineral bank**. Order and debit timing are a **determinism invariant** (scripts read the bank while planning — `context/index.ts:54` — so w debiting before b plans changes b's choices; never reorder).
3. `endScTurn(snap, { skipTurnStartChecks: true })` (checks already applied in step 1, mirroring `matchReducer.ts:411-413`).
4. Grant stored income for `next.turn` (mirrors `applyTurnIncome`, `apps/starchess/src/app/matchEconomy.ts:29`).
5. Record the settled ply as `{ scfen: formatScFen(normalizeSnapGas(esr.next)), resolve: esr }` where `esr = endScTurn(...)` — **`resolve.next`, never the loop's pre-resolve `snap`** — preserving the app's replay invariant that `resolves[i]` produced `scfens[i+1]` (`recordFromMatchState`, `matchHistoryStore.ts:78-79`).

**Recording rule (parity with human saved games):** scfens are stored in the exact same shape the app saves (`normalizeSnapGas`, bank **not** stamped — `stored` stays hosted state, as in `recordFromMatchState`). Replay therefore rebuilds the stored-bank display with the app's standard `reconstructStoredBanks` — same approximation as human games, documented; the arena's own bank (used for authoring decisions) is additionally exported in `meta.finalBank` for the scoreboard.

Both scripts and the engine are deterministic; the **mineral bank and the strategic `kvs` accumulator are owned by the arena** (like the app host does today via `storedFor` / `StrategicAdjutantContext.kvs`). The arena threads `KnownVsSeen` per side and updates it after each ply from the resolved board (captured delta = enemy material removed).

**Termination:** `runMatch` caps at `maxTurns` (default 200) → **draw by stall**; rejects both-null players; an `endScTurn` throw (king-count ≠ 1, mine-cap, unpromoted last-rank) aborts the run and records it `meta.status: "aborted"` instead of crashing.

## Packages & files

### New package `packages/starchess-arena` (pure, vitest-tested, node/bun-runnable)

Depends only on `@chess-coach/starchess-core`. No DOM, no bun-specific APIs (the bun parts live in
`apps/server` behind an interface).

- `src/run/runMatch.ts` — the deterministic turn driver (loop above). Inputs: opening `ScFenSnapshot`
  (a "map seed" SCFEN), `players: { w: ScriptPlayer | null, b: ScriptPlayer | null }`, optional `feed`,
  optional `kvs` seeding. Output: `ArenaRun { startScfen, plies, outcome, players, bankTrail, meta }`.
- `src/players/naive.ts` — `ScriptPlayer` wrapping sync `adjutant(snap, { color, storedFor })`.
- `src/players/strategic.ts` — `ScriptPlayer` wrapping `strategicAdjutant(...)` **plus optional feed
  lookahead** (see engine sections below); falls back to the sync result on feed absence/timeout.
- `src/feed/types.ts` — `EngineFeed` contract (the seam that makes the "complex node stockfish" part
  replaceable and testable with fakes).
- `src/players/kvs.ts` — arena-owned `KnownVsSeen` accumulator per side (uses
  `intel.ts` helpers `knownForTurn/combineKnownVsSeen/estimateKnownVsSeen`).
- `src/record/record.ts` — arena record builder → shared schema (below).
- `src/compare/compare.ts` — `summarize(runs)` → scoreboard.
- `src/cli/main.ts` — CLI: `--pairing naive:naive|naive:strategic|strategic:strategic --seeds N
  [--engine] [--movetimeMs] [--out <dir>]` writes JSONL records.
- Tests: determinism mirror (naive-vs-naive same start → identical `scfens`+`resolves` payload; a
  fixture whose opening play triggers a turn-open chip to cover the `beginScTurn` extra-ply path), a
  strategic-vs-naive smoke, record→`historyFromRecord`→same outcome round-trip, kvs accumulation,
  compare math.

### Core additions `packages/starchess-core` (single-owner, app + arena share them)

- `src/replay/fen.ts` — `scfenToFen(snap): string`. **The SCFEN→FEN projector** that lets stockfish
  consume StarChess positions (the crux of "adjutant works outside a browser").
  - Placement maps 1:1 — SCFEN already uses standard letters `p/n/b/r/q/k` (uppercase white).
  - Drops SCFEN extras (`kingLives`, `gas`, `stored`, `mines`, `queue`, `siegedRooks`).
  - Side-to-move `w`, halfmove 0, fullmove = `Math.max(1, turn)` (opening seed is `turn 0`; `0` is
    invalid FEN — mirror the guard at `codec.ts:581`).
  - **Legality guard (required):** stockfish rejects some *legal-in-StarChess* positions — pawns on
    rank 1/8 come from the `spawn` special/`pawnDouble` promotions (`submit-turn.ts:327-346, 865-911`)
    and are invalid classical FEN. The projector must flag such snapshots `ineligible` so the feed
    **skips** them and the strategic script falls back to its deterministic ranking — never burning the
    engine budget on a position stockfish can't parse.
  - **Documented lossy mapping:** FEN models *classical* chess movement only — chips/HP, gas
    specials, M: mines, spawn placement are invisible to stockfish. Fine for a *positional hint*;
    the arena never lets stockfish decide legality (the pure core's `addScAction` gates stay
    authoritative). Unit tests assert exact FEN for known placements.
- `src/replay/record.ts` — shared `ArenaGameRecord` schema `{ id, startedAt, endedAt, players:{w,b},
  mapSeed, map?, variant?, outcome, turns, scfens: string[], resolves: EndScTurnResult[], meta }` +
  `recordFromRun` + `historyFromRecord(record)` (moved/adapted from
  `apps/starchess/src/store/matchHistoryStore.ts:89`). Apps re-import — no duplicated `repairGas`/parse
  logic. `meta` carries engine mode, `finalBank`, and `status` (finished/aborted/stall). `map`/`variant`
  pass through so the web replay picks a board skin (`ReviewScreen.tsx:153,183`).
  **Determinism comparison excludes `id`/`startedAt`/`endedAt`** (generated via the app's
  `makeMatchId` pattern, `matchHistoryStore.ts:41-42`) — rerun-equality asserts on the `scfens`+`resolves`
  payload only.
- `src/rules/economy.ts` — promote `applyStoredIncome(bank, turn)` + `MAX_STORED_MATERIAL` from
  `apps/starchess/src/app/matchEconomy.ts` (income tiers already in core via `incomeForTurn`). This
  removes the app-side income magic (index.puml single-owner note).

### Node service `apps/server` — the complicated part (stockfish outside a browser)

Everything here builds on the existing bun stockfish stack and **does not move**:

- `src/feed/StarChessFeed.ts` — implements the arena `EngineFeed` contract:
  - Input: `{ fen, from }[]` candidate positions (projected via core `scfenToFen`); candidates the
    projector flagged `ineligible` are skipped before any engine call.
  - For each: `position fen {fen}` + `go movetime {budget}`. **`movetime` is a new method** —
    today's `StockfishEngine.getEvaluation` hardcodes `go depth 15` (`StockfishEngine.ts:39`) — so the
    feed adds a parameterized `getEvaluation(fen, { depth? | movetimeMs? })`; read back `score cp`/`score mate`.
  - **Queue hygiene (required):** the splice-on-timeout only prevents double-resolve — a *late*
    `bestmove` still lands in `UciDriver`'s shared line queue (`UciDriver.ts:76-80, 94-95`) and would
    be misattributed to the next query. The feed must **drain the queue between queries** (new
    `UciDriver.clearLineQueue()`) or run one query per fresh driver; otherwise consecutive evals are
    silently paired with the wrong FENs.
  - **Per-run and per-query budgets.** A turn's total engine time is bounded (e.g. `movetimeMs` split
    across candidates, absolute wall clock per query via `readUntil` timeout). On overrun the feed
    returns the evals it has with `timedOut: true`.
- `src/feed/StarChessEnginePool.ts` — N stockfish procs (default 1, env `STARCHESS_ARENA_ENGINES`);
    serializes queries per proc; exposes it back-to-back. Mirrors the app's `EnginePool` idea but on
    the server side. Arena runs that don't ask for the engine get the cheap path.
- Routes under the existing `app.ts`/`http.ts` router + cors/validation style:
  - `POST /starchess/arena/runs` → body `{ pairings[], seeds, engine?, movetimeMs? }` → runs serially
    (pool bounded) → returns `{ runIds }`.
  - `GET /starchess/arena/games` → list (id, players, outcome, turns, mapSeed).
  - `GET /starchess/arena/games/:id` → full `ArenaGameRecord` (for the web importer).
- Persistence: `STARCHESS_ARENA_DIR` JSONL files (or `bun:sqlite`); no new infra.
- **Binary provisioning:** `StockfishEngine` resolves `stockfish` on PATH (`StockfishEngine.ts:15`);
  the arena serving image/Dockerfile must include the binary (recorded as an ops note; CI uses the
  fake-feed path only).
- **CORP (required for `?game=` cross-origin):** `http.ts` applies
  `Cross-Origin-Embedder-Policy: require-corp` to every response, and the COEP-isolated web app must
  receive `Cross-Origin-Resource-Policy: cross-origin` on arena GETs or the browser blocks the read
  (ACAO alone is insufficient under COEP). Arena routes set CORP explicitly — or the app is served
  same-origin.
- Server tests use a **fake `EngineFeed`** (deterministic `cp`) — the server never needs a real
  stockfish binary in CI.

**Why this is the right shape:** the arena core (`runMatch`, scripts, record, compare) is pure and
portable; the *only* browser-incompatible thing — driving a native UCI process — stays in `apps/server`,
which already solved process driving for the Chess Coach feature set. The strategic dish's engine
lookahead plugs into the arena through `EngineFeed`, and the "adjutant outside a browser" guarantee is
simply: *core + arena package have zero DOM/worker/fetch dependencies*.

### Web app replay/import `apps/starchess`

- Swap `historyFromRecord` to the shared core `replay/record.ts` implementation.
- Extend deep-link import (today `?scfen=` single position on the **single route**,
  `adapters/browser/index.ts:22-32`):
  - `?game=<arenaId>` (primary) — fetch `GET /starchess/arena/games/:id` from the node service,
    `historyFromRecord` → `createMatchStateFromReviewHistory(...)` (`reviewHistory.ts:114`) → store →
    `ReviewDemoScreen`. **Review route consumes `?game=`; the single route keeps `?scfen=` (singular)** —
    the two spellings are similar, so the plan keeps them on separate routes and no route accepts both.
  - `?scfens=` (plural) — **scoped to short games only**: a full 50-turn game is ~5–10 KB URL-encoded
    (each SCFEN ~100–150 chars), which blows past common URL limits. Keep it for test fixtures/short
    skirmishes; production import is `?game=`.
  - **Import validation:** pasted record JSON / decoded lists must be schema-validated before
    `historyFromRecord` — `parseScFen` throws on malformed SCFEN (`codec.ts:458-557`), so a bad import
    must surface a UI error, not an unhandled throw.
- `ReviewScreen` (`/review`) gains an **Arena library** section: fetch `GET /starchess/arena/games`,
  list records, click → same replay host. This introduces **async/loading/error states** the current
  synchronous localStorage read (`ReviewScreen.tsx:199`) lacks — plan the list with a loading skeleton
  and a "service unreachable" fallback (hide the section, keep local history).
- e2e (Playwright): replay a recorded arena game via the deep link and assert the final board matches
  the recorded terminal SCFEN; list+opening in ReviewScreen.

## How we know one script is better

From `compare.ts` over recorded runs (pure, unit-tested):

- **Win/loss/draw** per (pairing, side), from `scOutcome`.
- **Turns to close** (terminal `run.turns`).
- **Material margin at terminal** — terminal placement value difference only. Captures are already
  reflected in the board (captured units are absent), so *don't* add `kvs.captured` again — that would
  double-count. (A "total material balance" variant is `(board + captured)` per side, not board + delta.)
- **Engine agreement (optional)** — terminal engine `cp` for the winner's side.

A pairing is seeded over a fixed set of opening `mapSeed` SCFENs. **Seed provenance:** start from the
app's canonical `STAR_STARTING_SCFEN` (`seeds.ts:10`) and extend with a curated corpus file in the arena
package (`src/seeds.ts`, a few hand-picked openings) — first slice ships with the canonical seed alone,
`--seeds N` expands from there. Mirror seeds give **payload-identical reruns when `engine:false`**
(equal `scfens`+`resolves`; `id`/timestamps intentionally differ). With the engine on, stockfish timing
makes individual games non-reproducible — the **recorded resolves are authoritative for replay**, so
replay never re-runs stockfish and stays faithful.

## Determinism & replay guarantees

- Scripts + pure engine: deterministic (verified, no RNG in `packages/starchess-core/src`).
- Mineral bank + `kvs`: arena-owned, deterministic, recorded.
- `engine:false` runs: identical `scfens`+`resolves` payloads on re-run with same seeds — so the arena
  doubles as a regression corpus for both adjutants (metadata excluded from equality).
- `engine:true` runs: replay faithful (resolves recorded); re-run approximate (stockfish timing).
- The **`addScAction` legality gate is never bypassed** by engine hints; stockfish only adjusts
  candidate *scores* (same rule as the browser plan). Clean room: engine → score, core → legality.

## Open decisions (need host sign-off before implementation)

1. **Arena home**: new `packages/starchess-arena` (recommended — pure, reusable by server + CLI +
   future in-app tournaments) vs embed in `apps/server`.
2. **Shared record schema in core `src/replay/record.ts`** (recommended, single-owner — index.puml
   note) vs keeping app `StarChessGameRecord` + a parallel arena type.
3. **Engine lookahead shape**: async advisory via `EngineFeed` with deterministic fallback
   (recommended, and matches the existing "async advisory + sync fallback" architecture note) —
   confirm we fold it into the strategic mapControl pass rather than a separate service.
4. **Web import channels**: HTTP fetch from the node service (`?game=`) **and** offline URL-embedded
   SCFENs (`?scfens=`) — both, or one?

## Suggested implementation phases

- **Phase 0 — core readiness**: `rules/economy.ts`, `replay/fen.ts`, `replay/record.ts` + tests; app +
  arena consume shared code.
- **Phase 1 — arena (no engine)**: package, runner, `naiveScript`/`strategicScript` (sync fallback),
  record, compare, CLI, mirror-determinism + round-trip tests. Strategic plays today (estimate kvs);
  this validates the loop/reporting end to end. **First reviewable slice.** Also register the new
  package: create `_spec/packages/starchess-arena/index.puml` (the spec map above) and attach its
  `// SPEC:` refs.
- **Phase 2 — node stockfish feed**: `StarChessFeed` + pool + routes + persistence in `apps/server`;
  strategic feed lookahead wired through `EngineFeed`; fake-feed tests. NOTE: `_spec/apps/server/`
  has no registry today (only legacy `components.puml`/`orchestration.puml` + `behavior.md`); the
  feed diagram is registered from this PLAN until a proper server registry exists.
- **Phase 3 — web replay/import**: core-shared record, deep-link `?scfens=`/`?game=`, ReviewScreen
  arena library, e2e replay. Register `replay-import.puml` in `_spec/apps/starchess/index.puml`
  (already entered in this plan).
- **Phase 4 — scoreboard surface** (optional): show `summarize` output in the app.

Spec diagrams: `_spec/packages/starchess-arena/arena.puml`,
`_spec/apps/server/starchess-arena-feed.puml`, `_spec/apps/starchess/replay-import.puml`.
These are plan-stage diagrams; their `// SPEC:` anchors attach to the source files listed above once
implemented (marked `status: PLANNED` until then, per spec-keeper convention). Cross-ref: this plan
implements `/app/PLAN.md` Phase B (Headless match harness).