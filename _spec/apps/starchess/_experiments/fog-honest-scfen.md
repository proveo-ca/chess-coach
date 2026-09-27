# EXPERIMENT — Fog-honest engine (viewer SCFEN)

**Status:** experiment, not planned. No code yet. Written 2026-09-26.

**Goal:** make a maphack *impossible*, not hidden. A client should only
ever receive the part of the game its player can see. Hiding fogged units
on screen doesn't stop a cheat that reads the data underneath.

## Why today's fog can be cheated

Fog is **presentation only**. The client holds the omniscient SCFEN and
works out vision itself (`getSideVision` in
`packages/starchess-core/src/board/vision.ts`):

| Surface | What it leaks |
|---|---|
| SCFEN in the match store (`liveSnapshot`, `settledSnapshots`) | every enemy unit, both banks and gas (`B:` `G:`), **the enemy's planning queue** (`Q:…;b:…`), every mine (`M:`), every special used (`U:`) |
| `settledResolves` / timeline cues | every enemy's true `from → to`, including paths entirely in fog |
| `localStorage` — session (`matchSessionStore`), history (`starchess_match_history`, packed resolves) | all of the above, on disk |
| DOM | enemy movers under the fog veil (drawn but covered, since the 2026-09-26 veil fix), `data-*` on fogged squares |

Covering the board, as the opaque veil does, only stops a *visual* leak.
Any of the surfaces above is a maphack for anyone with DevTools or an
extension.

## The idea: a per-viewer projection, from the engine outward

Only a **referee** holds the omniscient state. A player's client gets only
`project(state, viewer)`:

- **Viewer SCFEN (SCFEN-V):** the same grammar, but every field is limited
  to what the viewer can see.
  - **Placement:** the viewer's own units, plus enemy units on lit squares
    or in `revealedPieces`. Every other square is written `?` (unknown).
    It must never be written as empty, because "empty" is itself
    information.
  - **`Q:`:** only the viewer's own queue.
  - **`M:`:** only the viewer's own mines, plus enemy mines on lit squares.
  - **`U:`:** only visible squares.
  - **`G:` / `B:`:** only the viewer's own economy (see the open questions
    about the enemy's).
  - The codec gains `?`, and `scfen/codec.ts` stays the only owner of the
    wire format.
- **Viewer resolve:** the resolve events filtered by vision *per tick*, not
  per turn. A unit crossing lit squares arrives as path segments, each with
  entry and exit ticks and nothing in between. The timeline then draws only
  what it received. That also removes the need to slide a hidden unit under
  the veil: it appears on the first lit square and vanishes on the last.
- **Referee:** it runs `beginScTurn` / `endScTurn` / `resolveTurn` on the
  full state (resolution is simultaneous and needs both queues), validates
  each incoming action with `addScAction`, and sends back only projections.
  The player that plays first can't read the other's queue, because it
  never reaches their client.

## The property that makes it provable

**Noninterference:** for any two full states `s`, `s′` that differ only in
things the viewer can't see, `project(s, v) === project(s′, v)`.

This can be tested as a **property test** in `starchess-core`: generate a
snapshot, change only the fogged enemy state (units, their queue, the enemy
bank, mines on dark squares), and assert the projection is byte-identical.
Run the same test on every resolve event of a whole game. The test is the
anti-maphack guarantee: if it holds, no client can learn fogged state, no
matter what it runs.

## Things that break (and their existing owners)

- **Adjutant, naive script:** it reads `findCC(map, enemy)` and is
  omniscient by design (`_spec/apps/starchess/core/adjutant/cc-focus.puml`).
  Under a referee it would have to run next to the referee as a trusted
  bot, or be rewritten to use projections only. The strategic script is
  already fog-honest (`ResolveWitness` / `witness.ts`, the four tracking
  folds), so it could run on SCFEN-V almost as it is.
- **Board and VFX:** everything that reads `snap().placement` for enemies
  has to accept `?`. `pieceVisibleToViewer`, `veilMoveIds` and the
  under-veil layer go away, because the client never has a fogged enemy to
  hide.
- **Replays and review:** a player's history holds *their* projections. The
  omniscient record (`both` in the review vision filter) exists only on the
  referee, and is released once the game is over. It can be released
  because a finished game has nothing left to protect.
- **Tutorial and `/single`:** the referee can run in the same process, as a
  Worker or in memory. The rules are the same, only the trust boundary is
  missing, and that's acceptable offline.

## Where the referee lives (open)

| Option | Trust | Fit |
|---|---|---|
| Cloudflare Durable Object per match | server trusted; neither player can read hidden state | the app already deploys a Worker (`wrangler.toml`); a DO gives one ordered referee per match |
| Serverless host-hub (current Coach P2P shape) | the **host is a player**, so the host can maphack | only acceptable between friends; never for ranked play |
| Commit–reveal (hashed queues) + trusted resolve | stops the queue from being read *early*; placement still needs a referee | a cheap extra over a DO: each side commits `H(queue‖salt)` before the resolve |
| Zero-knowledge / mental poker | no trusted party | research-grade; out of scope |

## Open questions

- Is the enemy's economy public? StarCraft hides it. The CC-lives win
  condition may have to stay public.
- A shot at a Command Center reveals the shooter (`ccShot` is the one
  ungated channel today). Under SCFEN-V that becomes an explicit
  "revealed by hit" rule in `project`, not a leak.
- What a `?` square costs deploy reach and legal-move generation, which
  assume a fully known board. The client's legality has to be advisory
  only; the referee is the authority.

## First step, if we pick this up

Write `project(snapshot, viewer)` and the noninterference property test in
`starchess-core`, with no transport. That proves the projection can be made
leak-free before anything is built on top of it.
