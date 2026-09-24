# PLAN — Sieged fire vs the CC/king body-block (DEFERRED)

Status: **planning only — deferred, not scheduled**. Adversarial review finding
`[HIGH][PRODUCT]` on commit `221cb69e`; Executor chose to defer the rule change
and decide between two designs. The `isCheckOnlyResolve` half of that review
batch is already fixed (victimless `shelling` / lone mine-clear no longer read
as check); this plan covers the remaining half.

---

## 1. The defect (repro)

A sieged tank may queue fire at **any enemy on its cross** — including one
standing behind the enemy CC/king. Resolve walks the ray, but:

- `midPathPrecedence` (`resolve/resolve-turn.ts:587`) returns `null` when the
  mid-path contact is a **king** (so `targetOnDestination` can adjudicate
  king-square intents), and
- `targetOnDestination` (`:620`) then captures at `plan.to` — **through the
  king**.

Outcome: the unit behind the CC/king dies, the king is untouched, the tank
stays sieged in place. Mined and empty dests behind a king correctly hold fire
(`minedEmptyDestination` falls through to `slideIntoFog` king handling;
`siegedEmptyShelling` drops on any contact) — **only the enemy-dest shape
leaks.**

Repro: sieged `S:d4`, black `Kd6` + black `pd7`; queue `C d4→d7`, End →
`pd7` dead, `Kd6` alive. Adjutant reaches the same shape (its move-gen also
offers the far enemy through blockers).

## 2. Why it is not a one-line patch

The `null` at `:587` is load-bearing: non-sieged fog shapes rely on the
fall-through to `targetOnDestination`/`enemyKingSquare` for approach and
king-shot adjudication. Dropping sieged plans there fixes this leak but leaves
the deeper question open — **what is the CC/king's body-block role in
StarChess at all?** Both candidate designs below change that contract, so the
point fix would be immediately rewritten.

## 3. Candidate designs

### A — Units behind a CC/king are untargetable

The CC/king absorbs fire: nothing behind it can be queued or hit (the king is
cover, not a window).

- Move-gen (`siegedTankMoves`): stop the cross at an enemy king — squares
  beyond it are not offered (mirrors the ally filter; the king square itself
  stays `dropsAtResolve`).
- Validation (`assertClassicalBaseline`): reject sieged dests beyond an enemy
  king (`SC_SPECIAL`), keeping raw-API and product paths aligned.
- Resolve: defense-in-depth — `midPathPrecedence` returns `{ kind: "drop" }`
  for sieged plans whose contact is a king.
- Adjutant/UI get it for free (both consume move-gen); `geometry.ts` /
  `tactical.ts` sim divergence shrinks (blocked rays no longer credit far
  victims).
- Cost: a new "hard cover" rule to teach in tutorials; siege pressure on a
  screened CC weakens (no chip damage through-screen — matches today's
  outcome, now by rule rather than by accident).

### B — Remove the "check" phase; CC/king attacks are no-capture attacks

Attacking the CC/king never captures and never opens a pending-check turn:
the king is damage-only (HP/ccLives), checks resolve inline as HP chip
`ccShot`s in the attack phase of the same turn.

- Deletes the turn-open check ply (`applyPendingCCShots` as a separate
  resolve), so `isCheckOnlyResolve` + DualNav check chaining + typewriter
  `hasCheck` + economy preview all simplify or disappear.
- `midPathPrecedence` king-contact becomes a plain hold-fire (nothing needs
  the `null` fall-through anymore) — this defect dissolves.
- Cost: large. Touches `submit-turn` (pending system), both clients'
  check-phase UI, tutorial narration, and every test that asserts check ply
  shapes (`typewriterBeats`, `MatchStoreContext`, king-hunt demos). This is
  the "fix the phase model" option, not a patch.

## 4. Decision needed (Executor)

| Question | A (untargetable) | B (no check phase) |
|---|---|---|
| Ship size | small (move-gen + validation + resolve drop) | large (phase model) |
| Player-facing rule change | new cover rule | removes a whole phase |
| Kills this defect | yes | yes (dissolves it) |
| Follow-on | MEDIUM "AI sim" findings partly resolve | supersedes them |

Recommendation: **A now**, B as a separate strategic plan if the check phase
is still felt as friction after A lands.

## 5. Verification when scheduled

- Core: `siegedRookShelling.test.ts` new case — enemy behind enemy king holds
  fire (no capture, no shelling, tank in place); enemy behind enemy *non-king*
  still intercepts at the blocker (unchanged).
- Move-gen: `siegedTankMoves.test.ts` — squares beyond an enemy king not
  listed; the king square itself still listed (`dropsAtResolve`).
- Validation: raw `addScAction` beyond-king dest throws `SC_SPECIAL`.
- Adjutant: `stacks.ts`-driven planner no longer queues through-king missions.
- e2e: extend `starchess-siege-shelling.spec.ts` with a behind-king SCFEN
  deep link.

Spec impact when scheduled (spec-keeper):

- Either design: `_spec/packages/starchess-core/resolve.puml` (sieged shelling
  branch — "ally/king contact holds fire" becomes rule, not accident) and
  `_spec/packages/starchess-core/resolve-turn-activity.puml` (rule 6's king
  pass-through and rule 7's sieged-dest claim) must be updated in the same
  batch; both cover `resolve/resolve-turn.ts`.
- Design B additionally rewrites the check-phase model (`resolve.puml`
  turn-open checks / Phase O seams) and orphans the `isCheckOnlyResolve`
  consumers — which today have **no owning diagram** (no `.puml` documents
  check-ply chaining; the predicate lives only in
  `apps/starchess/src/presentation/hud/isCheckOnlyResolve.ts` + its test).
  Create that diagram as part of B, not before — B may delete its subject.
