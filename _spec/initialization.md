# Canonical initialization and initial recipient production

## Goal

Initialize the approved public opening from explicit canonical facts rather than infer its history from a final board or a synthetic observation DTO.
This implements the initialization prerequisite of [gate-closure.md](gate-closure.md), not the F9 positive proof.

## State

The opening placement is `4k3/2pppp2/8/8/8/8/2PPPP2/4K3`.
Turn is 0, phase is P, both Command Centers have 3 lives, both banks hold 3 minerals, and both gas/income values equal 1.
Queues, mines, siege modes and pending CC shots start empty.
Initialization grants no income and consumes no action.

Each opening unit receives a stable side/square-derived identity and paid basis 0.
Combat replacement excludes Command Centers and totals 4 per side.
No opening receipt, historical payment, destroyed unit or enemy-loss witness is fabricated.
Every call returns detached mutable game state for its owner.

## Initial recipient boundary

The host-only `@chess-coach/contracts/initialization` subpath constructs each initial observation from the actual canonical snapshot and current geometric vision.
The model-facing contracts root does not reexport this producer.
Subpath separation does not itself enforce model import policy or authorize a session.
The current-profile closure audit must enforce that model-facing consumers do not import producer entrypoints.
`packages/policy/tests/source-boundary.test.ts` uses the pinned TypeScript compiler's actual first-party dependency closure, including type-only and reexport paths, to reject producer reachability and dynamic/host imports.
This check does not inventory third-party JavaScript runtime loading, Cargo/native libraries, the container or its effective policy.
The producer takes only a recipient side.
It accepts no supplied board, history, labels, receipt, permit or verified flag.

Cells follow file-major order.
Current own units and paid-basis-zero lineage match the initialized game.
Enemy units enter memory only when current canonical vision actually observes them.
Public opening knowledge does not fabricate a sighting of a fogged enemy.
Only lit squares enter `everLit`; piece-only reveals do not light a square.
The normal bounded JSON/Zod observation decoder validates and detaches the produced result.

## Verification and limits

Persist exact canonical snapshot/geometry expectations from the read-only reference modules at `b4b241481fb12de4a7344e6dba8eda775af57675`.
Test both recipients, zero paid basis, CC exclusion, no initial grant, no hidden opening sightings, detached calls and downstream candidate/feature consumption.

This producer handles initialization only.
It issues no session, planning permission, runtime admission or training authority.
[turn-resolution.md](turn-resolution.md), [causal-journal.md](causal-journal.md) and [recipient-production.md](recipient-production.md) now record implemented source-level turn-open/settlement, actual-mutation journals, receipts and deterministic replay.
Independent supervised process comparison and genuine clean close/EOF/reap remain pending.
Source tests do not supply the cold source-bound F9 native proof.
