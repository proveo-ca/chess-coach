# PLAN — ML Adjutant: a third script, and the harness that can prove it is better

Status: **Preparatory catalog policy COMPLETED; phases 1–5 PLANNED and unimplemented.**
Executor approved the registry IDs, EMPTY placeholders, disabled selector entries, and explicit
unavailable admission state. Source landing and verification remain delegated to the lead:
the inspected tree still has the two-ID app union and no core `ai/definitions.ts`.
This records a completed definition contract, not a shipped learning player.
Phases 1–3 remain prerequisites for learning work; phase 4 proposes retiring Stockfish.

Scope: a proposed top-level **`ml/`** training workspace. `ml` is workspace/tooling shorthand,
**not an Adjutant registry ID or a URL alias**. The exact future player ID is **`machine-learning`**.
The arena's `ScriptPlayer` remains its execution contract; the app consumes the core-derived
`AdjutantKind` and `PlayableAdjutantKind` through `apps/starchess/src/types/newGame.ts`.

## Completed preparatory contract (no learning implementation)

- Core owns the metadata registry in `packages/starchess-core/src/ai/definitions.ts` and exports
  its derived types and guards. `naive` and `strategic` remain the only playable IDs.
- `machine-learning`, `rlhf`, and `rlcd` are **EMPTY metadata definitions**, not executable
  scripts, model loaders, training implementations, or strategic fallbacks.
- New Game lists all five canonical labels from the registry. The last three entries remain
  disabled and marked not implemented; only playable choices can start a match.
- A recognized EMPTY opponent, including a direct `/single?opponent=machine-learning` URL,
  displays an explicit unavailable state and cannot mount a live match. Unknown/missing values
  retain legacy resolution: saved session opponent, otherwise `naive`.
- Catalog metadata introduces **no runtime ML dependency** into core or the app.

Owning contract: [`adjutant-definitions.puml`](../packages/starchess-core/adjutant-definitions.puml).
App flow: [`menu-flow.puml`](../apps/starchess/menu-flow.puml).
Selector layout: [`wireframe.puml`](../apps/starchess/wireframe.puml).
Deepening learning architecture remains later work; this catalog does not complete any phase below.

---

## The four things this plan builds

| # | Thing | Why it is the bottleneck |
|---|---|---|
| 1 | **Elo ladder** | Nothing today can answer "is this version stronger?". Every weight in the ladder was chosen by argument, never measured (`packages/starchess-core/src/__tests__/tactics/weightOrdering.test.ts` asserts *orderings*, not strength). |
| 2 | **Action vectorisation** | `observation(SCFEN, side) → action queue → SCFEN`. Without a fog-filtered observation encoding there is no honest training input, and without a candidate/action encoding there is nothing to learn a policy over. |
| 3 | **Parallelisation + determinization** | Self-play needs thousands of games (parallel), and imperfect information needs many sampled worlds per decision (determinization). Same seeded-RNG discipline serves both. |
| 4 | **Native evaluator** | A `cp` score computed on **SCFEN itself** — fog, mines, gas, lives, siege, economy — replacing the lossy classical-FEN projection and the Stockfish dependency behind it. |

## Invariants (non-negotiable)

- **`packages/starchess-core` never depends on `ml/`.** Dependency flows `ml/ → arena → core`. The
  core stays pure, browser-safe and free of model runtimes.
- **Legality is never learned.** Every plan commits through `addScAction`, as the human UI does;
  a model may only *rank* candidates. This is exactly the existing engine-feed rule
  (`packages/starchess-arena/src/players/strategic.ts:115` — the feed rescues scores, never legality).
- **Train on observations, never on states.** The arena hands each side the full board; the
  observation encoder is the gate, in the same spirit as `ai/strategic/witness.ts`. A model trained
  on the unfogged placement cannot be shipped and will not transfer.
- **Determinism survives.** `seed + players + opening ⇒ identical records` is an arena invariant
  (`packages/starchess-arena/src/run/runMatch.ts:115`, plan order `[w, b]`). ML inference must have a
  frozen-weights, fixed-seed mode so the corpus tests keep meaning something.
- **A future implemented machine-learning player may degrade to `strategic`** when no
  model/runtime is available (no WebGPU, no weights), mirroring the feed fallback in
  `players/strategic.ts`. This planned behavior does not apply to today's EMPTY definition,
  which remains unavailable and must not silently start either existing script.

## Layout

```
ml/
  ladder/        Elo + match scheduling over the arena          (phase 1)
  codec/         observation + action vectorisation             (phase 2)
  harness/       worker pool, self-play, determinization        (phase 3)
  evaluator/     SCFEN → cp, and its training                   (phase 4)
  player/        the ScriptPlayer that uses them                (phase 5)
  models/        versioned frozen weights (git-lfs or fetched)
```

`pnpm-workspace.yaml` currently globs `apps/*` and `packages/*` only — add `ml/*`, or accept
`packages/starchess-ml/` instead and keep the workspace untouched. **Decision needed.**

## Why the existing code already fits

| Need | Existing seam |
|---|---|
| Headless deterministic games | `runMatch` (`packages/starchess-arena/src/run/runMatch.ts:115`), seeded by `mulberry32`, `src/seeds.ts` |
| Future scripts, one execution contract | `ScriptPlayer` / `SideContext` (`packages/starchess-arena/src/players/types.ts:19,56`); EMPTY catalog entries are not players |
| External evaluator seam | `EngineFeed.evaluate(candidates, {movetimeMs})` (`packages/starchess-arena/src/feed/types.ts:52`) |
| Candidate list without legality risk | `strategicCandidates` / `applyCandidate` (`packages/starchess-core/src/ai/strategic/orchestrator.ts:58,113`) |
| Scoreboard to build Elo on | `summarize` (`packages/starchess-arena/src/compare/compare.ts`), records in `src/record/record.ts` |
| Batch runner | CLI `--pairing naive:strategic --seeds N --out` (`packages/starchess-arena/src/cli/main.ts`) |
| Fog, per side | `getSideVision(placement, side, {mines, tankModeFor})` (`packages/starchess-core/src/board/vision.ts:178`) |
| A belief state, already fog-honest | `ai/strategic/{runners,attackers,witness,intel}.ts` + `ai/context/ccIntel.ts`, folded by `ai/strategic/tracking.ts` |
| Terminal reward | `scOutcome` (`packages/starchess-core/src/outcome.ts:15`), `MAX_GAME_TURNS` 45, `ccLives` |
| App-side catalog and admission | Approved core registry + derived guards; `NewGamePanel` lists definitions, while `SingleScreen` admits only playable opponents |

---

## Phase 1 — Elo ladder (`ml/ladder/`)

**Goal.** A number that says which script is stronger, with a confidence interval, cheap enough to
run in CI.

**Contract.**
- `schedule(scripts, {games, seeds})` → paired match list: every pairing played **both colours on
  the same seed**, so colour and opening luck cancel.
- `rate(records)` → Elo per script (logistic update or a small Bradley–Terry fit), plus win/draw/loss,
  turns-to-close and terminal material margin — the last two already computed by `summarize`.
- `gate(baseline, candidate)` → pass/fail at a stated confidence, for CI.

**Notes.** Draws are common (the 45-turn cap decides on CC lives), so the rating model must treat a
draw as half a point rather than discarding it. Report **Elo ± CI**, never a bare win rate: at 200
games the noise band is wide enough to swallow most weight tweaks.

**Done when** `pnpm ml:ladder --baseline strategic --candidate strategic@wip` prints a rating table
and exits non-zero on a regression, and one CI job runs a short ladder on the arena.

## Phase 2 — Vectorisation (`ml/codec/`)

**Goal.** `observe(snap, side) → Obs`, `encode(Obs) → tensor`, `candidates ↔ action vectors`,
`apply(actions) → SCFEN`. The round trip is the training pair.

**Observation.** A visibility-filtered SCFEN is **not a valid SCFEN** — the codec requires exactly
one king per side (`packages/starchess-core/src/scfen/codec.ts:36,483`) and a fogged board usually
hides the enemy CC. So either:
- **(a)** a distinct `SCOBS` string: SCFEN grammar plus an `unknown` glyph, validated by its own
  rules — human-readable, diffable, replayable, and it can be logged in records; or
- **(b)** a binary/plane encoding only, with no textual form.
**Recommend (a) plus a plane encoder on top of it** — the text form is what makes training data
inspectable and bug-reportable, which is worth more than the bytes it costs. **Decision needed.**

Observation planes must carry what the strategic script legitimately knows, or the model starts
blinder than the code it replaces: own units; lit squares; revealed pieces; **belief channels** —
runner ghost sets with confidence, CC posterior `dist`, wanted-attacker squares, `kvs` gap; and
scalars for gas, minerals, king lives, turn, siege/mine state.

**Actions.** A turn is a *queue*, not a move (rank B specials + rank C classical), so two options:
- **(a) rank an enumerated candidate list** — reuse `strategicCandidates`; the policy is a softmax
  over legal plans, and illegality is impossible by construction;
- **(b) factored heads** (unit × target × special) with a legality mask.
**Recommend (a) first.** It is strictly easier, needs no mask, and keeps the existing gate. Revisit
only if candidate enumeration becomes the bottleneck.

**Done when** a round-trip test proves `observe → encode → decode` loses nothing the side may know,
and a fog-honesty test proves an enemy unit on an unlit square never appears in any channel.

## Phase 3 — Parallel + determinized play (`ml/harness/`)

**Goal.** Thousands of games per minute, and K sampled worlds per decision.

**Parallelisation.** `runMatch` is pure and async-free when no feed is attached, so it shards across
`node:worker_threads` by seed with no shared state. The runner owns the RNG
(`rngs = {w: mulberry32(seed), b: mulberry32(~seed)}`), so a shard is reproducible from its seed
alone. Output: JSONL records, the format the CLI already writes.

**Determinization.** The honest formulation of a fogged, **simultaneous-move** game is a belief
state, not a position — and the belief already exists in code. Sample K worlds consistent with
`RunnerMemory.ghosts`, `CCIntel.dist` and the `kvs` gap; evaluate each candidate in each world;
average. This is worth building **before** any neural net: it deepens play using the posteriors the
strategic script already maintains.

**Simultaneity is the structural constraint.** Both sides queue and resolve together, so there is no
alternating tree and **minimax/MCTS do not apply as-is**. Plan for matrix-game or regret-based
handling at a decision point, or accept a single-ply determinized average as the shipped depth.

**Done when** a 1,000-game self-play run completes in a stated wall-clock budget, byte-identical
across two runs with the same seed set.

## Phase 4 — Native SCFEN evaluator (`ml/evaluator/`)

**Goal.** `evaluate(obs) → cp` on SCFEN's own terms, retiring the classical-FEN projection.

**Why Stockfish has to go.** `scfenToFen` refuses `no-exact-cc-pair` and `back-rank-marine`
(`packages/starchess-core/src/replay/fen.ts:27,41`) — and even when it succeeds it cannot express
fog, mines, gas, siege mode, CC lives or the mineral bank. The strategic player is already patching
around that: `cp` capped to ±200 and a perspective flip, both hand-tuned
(`packages/starchess-arena/src/players/strategic.ts:45,54`).

**Contract.** Keep the `EngineFeed` shape so the arena, the app and the server feed swap without
rewiring, with one deliberate difference: **`cp` is signed for a named side, not for "side to move"**
— a simultaneous-move game has no side to move, which is precisely the fiction `foldSuggestion`
currently corrects for.

**Training.** Bootstrap by distilling the strategic script (cheap teacher, decent play), then improve
on self-play outcomes with the phase-1 ladder as the arbiter. Reward: terminal `scOutcome`, shaped by
CC lives and material margin, with 45-turn episodes.

**Done when** the ML evaluator beats the Stockfish feed on the ladder at equal wall-clock, and
`nodeStockfishFeed` plus the server's UCI driver can be deleted from the arena path.

## Phase 5 — The player (`ml/player/`)

`mlScript(): ScriptPlayer` remains a proposed training-workspace function — rank candidates by the
evaluator, commit through `applyCandidate`, and fall back to `strategicAdjutant` when no model is
loaded. App side: implement the existing **`machine-learning`** definition before making it
playable; do not add an `"ml"` ID or a duplicate selector entry. `SingleScreen` would thread the
same cross-ply memories it already threads (the model's belief input). `rlhf` and `rlcd` remain
EMPTY; this phase does not authorize their implementation.

**Browser budget.** Inference must fit the live turn (10s cap at income tier 1, but sub-second for
feel) inside the PWA — model size, WebGPU availability and a worker path are the constraints, and
`apps/chess`'s `EnginePool` scheduler is the precedent for keeping heavy work off the main thread.

---

## Two warnings worth writing down

**A model cannot invent a feature the observation lacks.** The weakness that started this work — an
enemy marine three squares from promoting — was not a mis-weighted term, it was a *missing* one:
nothing anywhere read an enemy marine's rank. Feature engineering does not disappear under learning;
it just gets measured instead of argued.

**Strength trades against explanation.** The scoring ladder can say *why* it moved, and the coach
product is built on that. A learned evaluator cannot. Mitigation: keep the strategic script as the
explainer and the guardrail, and let the ladder price what the swap costs.

## Decisions needed before phase 1

1. `ml/*` as a workspace glob, or `packages/starchess-ml/`?
2. Observation as a textual `SCOBS` plus planes, or planes only?
3. Ladder gate in CI from day one, or a manual `pnpm ml:ladder` until it is trusted?
