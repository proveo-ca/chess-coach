# StarChess tutorial: hints, coach and lesson-beat rationale

Why the tutorial hints, coach behaviour and lesson beats are the way they
are. Like `navigation-chrome.md`, this is the home for reasoning stripped out
of source prose so code stays comment-light and `// SPEC:` pointers are the
only code-side edge.

Implementation lives primarily in:

- `apps/starchess/src/tutorial/tutorialScript.ts` (`resolveTutorialHint`,
  `enrichMark`, `enrichSay`, `completedLessonBeats`, `pressureMark`)
- `apps/starchess/src/tutorial/when.ts` (`wrongQueuedAction`, `matchWhen`)
- `apps/starchess/src/tutorial/lessonTactics.ts` (board helpers below)
- `apps/starchess/src/types/tutorial.ts` (`TutorialMark`, `TutorialBeat`,
  `TutorialWrongQueueWhen`, `TutorialMechaDeployReadyWhen`)
- `apps/starchess/src/screens/TutorialScreen.tsx` (+ `.module.css`: coach
  state, farewell, line hold, `liveHints`)
- `apps/starchess/src/demos/LiveLessonHost.tsx` (hint plumbing, queue hint)
- `apps/starchess/src/presentation/board/components/StarChessBoard.tsx` +
  `.module.css` (gas hint rendering)
- `apps/starchess/src/presentation/hud/queueHint.ts`,
  `presentation/hud/components/CancelHint.tsx` (+ `.module.css`)
- `apps/starchess/src/components/features/TutorialHudLabels.tsx`
- Lesson data: `apps/starchess/src/tutorial/steps/**`

Companion diagrams: `tutorial-line-resolution.puml` (beat precedence, mark
options), `tutorial/coach-line.puml`, `tutorial/lesson-gates.puml`.

---

## 0. Opening and failure lines

- **Live Play opens on a first beat, not `comment`.** Each Live Play lesson with
  an opening line carries it as `beats[0]`: `priority: 2`, `turn: <seed turn>`,
  `when: { kind: "scfen", re: /\|Q:w:;/ }` (nothing queued yet); its
  `comment` is `""`. The old intro lost to any matching reaction and was
  retired as "acted" by turn-open checks or the opponent's opening queue, so
  defense-5, defense-6 and attack-3 never showed it. The beat outranks turn-0
  guidance until the player queues; failure and threat beats (`priority: 3`)
  still win. Consequence: attack-3's turn-0 intent tip ("Deploy a Marine…",
  priority 0) is masked by the intro, then by "Review your queued orders"
  (priority 1) once anything is queued.
- **Every `restartWhen` has an urgent failure line.** A beat gated on the same
  condition, `priority: 3`, lesson-specific copy (what went wrong, then the
  fix), `emotion: "shocked"`, `action: retryLesson`. On `failed` the bubble
  shows the current line with a Retry CTA, so without this beat it showed stale
  guidance, nothing, or the placeholder "Bruh". Pinned by
  `__tests__/tutorial/lessonIntroAndFailure.test.tsx`.

## 1. Gas hints

A gas hint is a guide-green ring plus a canister with a down chevron bobbing
onto the square — "drop gas here". It is a variation of the square hint, not
a separate layer: `hintGasSquares` flows host → `BaseScreen` →
`LiveBoardBinding` → `LiveStarChessBoard` → `AnimationStage` →
`StarChessBoard` next to `hintAlertSquares`, and a gas square is also a hint
square (`data-hint` + `data-hint-gas`).

Rendering (`StarChessBoard.module.css`):

- The canister floats up into the square above. On fog boards every hinted
  square is lifted to `z-index: 7` (fog reads through), which puts the hint
  under the pieces (`10`) of the square above. Gas-hint squares lift to
  **exactly 10**: equal z, and the square above always comes earlier in the
  DOM, so the canister wins. That stays under `.chessboard--eclipse::after`
  (11) and the coordinates (20).
- A dark rim (two 1px black drop-shadows) sits under the green glow so the
  outline icon reads over a unit's white body.
- **Rank 8** has no square above, and `.chessboard` clips overflow on purpose
  (walk-off VFX). There the hint tucks inside its square, canister and chevron
  **side by side** along the top edge, bobbing toward the unit.

## 2. Mark options (`TutorialMark`)

Computed in `resolveTutorialHint` after the beat is picked:

| Option | Adds a gas hint on | Stops when |
|---|---|---|
| `gasSquares` | the listed squares | — |
| `gasOnMoveGhost` | the ghost of White's queued classical (`queuedMoveGhost`) — stack a special after the move | no move queued |
| `gasOnCC` | White's own Command Center, wherever it stands (`deployGasSquare`) — the deploy canister | a deploy is being aimed (`targetingKind === "deploy"`) or queued |
| `gasOnPush` | the Marine a push lesson walks (`gasMarineSquare`) | per `gasMarineSquare` |
| `pressureCC` | —: rings/lines for units already on the visible enemy CC, else the Mecha move onto one of its diagonals (`mechaPressureLine`) | — |
| `cancelQueued` | —: queue key of the TurnBar chip to point "cancel" at (set by `wrongQueue`) | — |

Computed `when` kinds were switched to gas hints where the answer is a
canister: `gasOnMarine`, `tankSiege` (squares → gas), `shipJuke` (gas on the
ship), `ccDeploy` (turns `gasOnCC` on), `promotionChoice` (gas on the h6/h7
Marine; with no canister left, a ring + arrow one step forward instead).

Hint beats also receive `targetingKind` (the live aiming state), so a
canister can leave once the special is being aimed (cc, ship, mecha,
live-play defense-6 / attack-2).

## 3. Marks after a lesson ends

`TutorialScreen.liveHints` passes the beats only while `outcome() ===
"active"`; afterwards only beats flagged `final` survive
(`completedLessonBeats`). Otherwise the next turn's board keeps whatever
fallback mark last matched, and per-lesson empty marks cannot cover every
ending. `final` is the lesson's closing picture (specials/hoverbike's
mine-guard rings + strike arrows).

## 4. Line hold (`holdMs`)

A beat's `holdMs` keeps its line on screen at least that long before a later
line may replace it (reading time — e.g. ship's "Lightspeed escape!" 600ms).
`TutorialScreen` defers the new line with a timer and re-resolves when it
fires (`holdTick`), so a line that stopped matching in the meantime never
flashes. A lesson change or retry never waits.

## 5. Coach hiding (`hideCoachWhen`)

When a story's `hideCoachWhen` matches while the lesson is live, the lesson
hands over to plain play:

- States: `shown` → `leaving` → `hidden` → `revealed`; reset per lesson /
  retry.
- `leaving`: the bubble says the story's `coachFarewell` (default **"Ok,
  I'll let you play!"**, happy) for `coachFarewellMs` (default
  `COACH_FAREWELL_MS`, 1000), then `hidden`. Once the farewell starts it plays
  out: the board can blink out of the hide rule mid-resolve (turn-open
  checks), and only a real reveal reason cancels it — a retry line (lost) or
  a non-active outcome.
- `hidden`: CSS hop (~0.5rem up) then down **under** the board (the board
  paints over it) and fades; the bubble goes, the ResourceBar joins the header
  (`hudResources`; on mobile the MobileBanner carries it), and
  `TutorialHudLabels` switch off. The labels component also re-syncs on the
  `enabled` flip itself, because turning off changes no DOM its mutation
  observer would see.
- `revealed`: the same animation in reverse (a loss shows "What happened
  here?" + Retry).
- live-play-attack-4 hides from turn 16: its scripted turns end at 15.

## 6. Queue hint + off-script orders (`wrongQueue`)

- `TutorialWrongQueueWhen.sequence` is the scripted order of a turn's queue,
  **strictly**: White's queued actions, in the order they were queued (SCFEN
  keeps insertion order), must match the sequence step by step. A step is a
  queue spec or a list of alternatives; `*=` on a special accepts B or F; a
  spec without `:to` accepts any destination. It holds on the first action out
  of place — wrong move, wrong order (gas before the move it follows), or
  extra.
- The match clears the board marks and sets `cancelQueued`;
  `LiveLessonHost` writes it into `presentation/hud/queueHint.ts` (cleared on
  unmount). Queue chips compare `queueActionKey(a)` (`C=e2e3`,
  `B=siegeMode:e2`, `F=deploy:e1:e2`) and wrap in `CancelHint`. `/single`
  never writes the store, so it stays null there.
- The coach line is `transient`: once the action is cancelled, the turn's own
  line comes back instead of the "Hmmm…" line sticking.
- **Off-script, no corrections.** Each `wrongQueue` beat is
  `and(wrongQueue, not(ccThreat), not(stopRunner))`: once the game has left
  the script — our Command Center under fire, an enemy runner on our back
  ranks — the player may need several free actions (e.g. deploy + capture to
  defend), so "cancel the queued action" never fires; the threat beats take
  over. `enrichMark` reads the `wrongQueue` leaf inside the `and`.
- The beats are the scripted order, not derived from the turn beats: the turn
  beats imply it (each `when` adds one queued step), but a turn's last step
  has no beat of its own and would be flagged.

## 7. Board helpers (`lessonTactics.ts`)

- `queuedMoveGhost` — where White's queued classical lands (the ghost).
- `deployGasSquare` — White's CC while no deploy is queued; aiming is live UI
  state, checked by the resolver, not here.
- `gasMarineSquare` — for an h-file mover: **h2→h4 then gas on the ghost is
  the one triple step**, so that case returns the ghost; every other push is
  better gassed first, i.e. a drop on the Marine where it stands.
- `mechaDeployReady` — the g2 Marine's attack on f3 is queued, a Mecha is
  affordable and no deploy is queued: the Mecha lands on g2 once the Marine
  vacates it.
- `mechaPressureLine` — a Mecha move landing on a diagonal of the *visible*
  enemy CC; prefers a landing no enemy attacks, then the one farthest from the
  CC.
- `knightVia` / `unitArrow` — a Hoverbike's arrow bends at its L corner, long
  leg first as the scripted arrows draw it (d4→c2 via d2, c2→a1 via a2). Used
  by `ccPressure`, `ccThreat` and `ccDeploy` arrows.
- `ccThreatAnswer` — answer to a visible attack on our CC, in order:
  1. `deploy` onto an empty square that hits the attacker (reach from core
     `deployCoverers`, cheapest first), then `deployed`: attack with it;
  2. `capture` with a unit already on the board (cheapest first);
  3. `evade`: step the CC to a square no enemy attacks.
  `answered` once the queued Attack/Move lands on the attacker or moves the
  CC; null when the Move went elsewhere.

## 8. Lesson-beat notes

Beat selection is priority, then specificity (leaf gates), then declaration
order — several beats below are placed or gated only to win (or lose) a tie.

**Specials**
- `marine` — turn-1 move queued, gas not yet: canister on the ghost.
- `hoverbike` — opening: gas the Hoverbike before anything is queued; a move
  queued without the mine: canister on the ghost.
- `tank` — two routes, one Move slot: the mobile Tank moves d4→d8 then gasses
  to siege there; the sieged Tank gasses first to unsiege, then drives f4→h4.
- `ship` — "Lightspeed escape!" while the jump plays out (jump queued or
  landed, BattleShip on board); the section-closing CTA only once the ship
  survived the Charon (turn 22+) and the next turn's intents are open — no
  auto-advance.

**Turn Resolution**
- `combat-chain` — turn 1's intents also introduce the vision lines; turn 3's
  intents explain the Tank c3→c8 vs the Hoverbike e4xc3.
- `king-hunt` — the CC falling closes the section on a CTA, no auto-advance.

**Live Play**
- `defense-1` — gas the CC (`gasOnCC`), land on f2.
- `attack-2` — the CC-loss beat carries its own retry CTA: losing the CC is
  not the lesson's retry gate, so nothing else would remount it. The
  catch-all line must exist and repeat `comment`: Qh7 already checks ke4, so
  the turn-open resolve runs on mount and retires the intro before it is read.
  After the scripted opener, the next jump is read from wherever the ship
  stands (lit, empty, unattacked, re-checking when it can). The turn-22 Tank
  tip is withheld while a jump is queued.
- `attack-3` — the Mecha-diagonal beat teaches one action at a time: stop the
  f3 runner (g2→f3), then, with the attack queued, deploy the Mecha that
  takes over g2 (g2–a8). h3/h4 pushes: gas first (the extra step), then the
  classical. h6 gassed: the extra step lands on h7, the classical takes it to
  h8. The `gasOnMarine` mark beat carries a beat-level phase so it outranks
  the bare rank-5 ring. The c2 fallbacks have one gate each so any other hint
  wins; the pressure fallback sits last, beside the "Apply pressure" line.
- `attack-4` — the farewell ("Ok I'll let you play. / Here are some hints",
  `coachFarewell`) stays up 3000ms (`coachFarewellMs`) so it reads before the
  coach and bubble go. Turns 16–18 (relative 5–7) then keep strategy hints up:
  rings on e4 and d6, arrows e2→a6 (Mecha diagonal), the Hoverbike path
  d2→e4→d6 then red d6→b7, f4→f8 and b3→b7; the enemy CC alert ring comes
  from the lesson's fog-honest `alertLatch: "cc"`: e8 (the default location,
  `emptyCCIntel("b").focus`) until the b7 Command Center is first seen, then
  its last seen square. **Decided (2026-09-27):** a lit, empty e8 keeps the
  ring on e8 — the ring marks the default location until a sighting, not a
  fog-honest posterior (pinned in `__tests__/tutorial/liveLessonCCSighting.test.tsx`).
  Turn 13's deploy line asks for a Mecha. Turn 13's "full vision" line needs the Tank dug in on e3
  (`S:` lists sieged Tanks) and an empty White queue, so it never ties with
  the queued replies (beat choice must not depend on array order —
  `livePlayAttack4Narration` reverses the beats to prove it).

## 9. Carried-over notes (previously in code)

- **Alert latch** (`nextAlertLatch`, `TutorialScreen`/`LiveLessonHost`): alert
  rings stay up through later beats. A `followKing` lesson
  (live-play-attack-3) moves the ring only when the Command Center is *seen*
  on a different square — a fogged king does not count, so a dark move cannot
  relocate the mark.
- **Turn-open on mount**: turn-open refills gas and applies standing check
  damage, so on a seed whose gas is mid-turn the SCFEN moves with no player
  input. live-play-attack-1 is that seed (Black's gas reads 0, spent on its
  queued mine; turn-open refills it net of that mine). Arming the planning
  timer used to retire the opening line unread, which is why the timer is
  disabled there.
- **specials/ship** seeds on turn 21 — tier-3 gas — or Tactical Jump (3
  vespene) is unaffordable; the seed must never offer the next section (queen
  on board, turn 21) nor restart.
- **Live Play boards**: every Live Play lesson is a live board since
  `king-hunt` moved to Turn Resolution, which owns both replays.
- **Test fixtures**: a hand-built SCFEN that queues a gas action must also
  spend it in `G:` (e.g. `G:21 → 11 → 01`), or `parseScFen` rejects the wire
  (gas remaining + spent exceeds income).
- **King Hunt graduation** (`useKingHuntGraduation`): the graduation offer
  fires whenever the enemy Command Center dies in this run — even on a replay
  after the player already cleared the tutorial. `cleared` only gates the
  menu, never the offer.
