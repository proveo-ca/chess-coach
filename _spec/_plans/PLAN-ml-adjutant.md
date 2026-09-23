# PLAN — ML Adjutant: a third script, and the harness that can prove it is better

Status: **PLANNED** — nothing implemented. Phases 1–3 are prerequisites for *any* learning work
and are worth doing on their own merits; phase 4 pays for itself by retiring Stockfish.

Scope: a new top-level **`ml/`** workspace. `naive`, `strategic` and `ml` coexist as three scripts
behind one contract — the arena's `ScriptPlayer` (`packages/starchess-arena/src/players/types.ts:56`)
and the app's `AdjutantKind` (`apps/starchess/src/types/newGame.ts:6`).

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
- **The ML script degrades to `strategic`** when no model/runtime is available (no WebGPU, no
  weights), mirroring the feed fallback already in `players/strategic.ts`.

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
| Three scripts, one contract | `ScriptPlayer` / `SideContext` (`packages/starchess-arena/src/players/types.ts:19,56`) |
| External evaluator seam | `EngineFeed.evaluate(candidates, {movetimeMs})` (`packages/starchess-arena/src/feed/types.ts:52`) |
| Candidate list without legality risk | `strategicCandidates` / `applyCandidate` (`packages/starchess-core/src/ai/strategic/orchestrator.ts:58,113`) |
| Scoreboard to build Elo on | `summarize` (`packages/starchess-arena/src/compare/compare.ts`), records in `src/record/record.ts` |
| Batch runner | CLI `--pairing naive:strategic --seeds N --out` (`packages/starchess-arena/src/cli/main.ts`) |
| Fog, per side | `getSideVision(placement, side, {mines, rookModeFor})` (`packages/starchess-core/src/board/vision.ts:178`) |
| A belief state, already fog-honest | `ai/strategic/{runners,attackers,witness,intel}.ts` + `ai/context/ccIntel.ts`, folded by `ai/strategic/tracking.ts` |
| Terminal reward | `scOutcome` (`packages/starchess-core/src/outcome.ts:15`), `MAX_GAME_TURNS` 45, `kingLives` |
| App-side third opponent | `AdjutantKind` + `ADJUTANT_KINDS` (`apps/starchess/src/types/newGame.ts:6-8`), consumed at `apps/starchess/src/screens/SingleScreen.tsx` `autoQueueOpponent` |

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

**Why Stockfish has to go.** `scfenToFen` refuses `no-exact-king-pair` and `back-rank-pawn`
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

`mlScript(): ScriptPlayer` — rank candidates by the evaluator, commit through `applyCandidate`, fall
back to `strategicAdjutant` when no model is loaded. App side: `AdjutantKind` gains `"ml"`, the New
Game modal gains a third row, and `SingleScreen` threads the same cross-ply memories it already
threads (they are the model's belief input, not just the script's).

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
