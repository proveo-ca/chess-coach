# Brood War FEN (BWFEN)

Status: **actionable spec** for BWFEN2 queue encoding. BWFEN is a **custom extension of FEN**, not a fork: **whatever is legal in FEN is legal in BWFEN**. BWFEN only adds Brood War awareness on top.

Canonical demos:

| Demo | Story | Illustrates |
|---|---|---|
| **Combat Chain** (turn-shape reference) | [screens-nerd-brood-war-demo--combat-chain](http://localhost:6006/?path=/story/screens-nerd-brood-war-demo--combat-chain) | `W & B` per turn; attack → death → occupy |
| King Hunt | [screens-nerd-brood-war-demo--king-hunt](http://localhost:6006/?path=/story/screens-nerd-brood-war-demo--king-hunt) | Same grammar + checks + walk-into-check (FEN-illegal, BWFEN-legal) |

Rules authority: [`BROODWAR_MODE.md`](BROODWAR_MODE.md). Position/queue encoding authority: this file.

---

## 0. Non-negotiables

1. **FEN baseline is included.** Any classically legal placement and any classically legal move is BWFEN-legal unless a locked Brood War rule explicitly changes the outcome.
2. **Classical FEN stays render/export only.** `chess.js` may validate the FEN baseline and render snapshots, but it is **not** the Brood War move oracle.
3. **BWFEN differences are only:**
   - **Special-move awareness** — including special attacks (Bishop/Goliath Charon Booster Missiles) and special moves that dodge attacks (Queen/Battlecruiser Tactical Jump).
   - **Split classical move** — a classical capture resolves as **attack**, then **move** if the attacker survives.
   - **Simultaneous turn resolving** — both sides queue actions; one shared resolve produces one next placement.
4. **Every planning turn has an action queue.** Shape per side:

```text
<special moves [any]> <classical move [0..1]> <special moves [any]>
```

5. **The queue is produced only by the BWFEN equivalent of `addMove`.** UI gestures call `addBwAction(...)`; `TurnBar` displays that queue before End; End resolves in that order.
6. **Validate & replay must reach FEN parity.** Given a start BWFEN and a history of BWFEN planning snapshots, `validateBwFenHistory` must accept exactly the histories that `replayBwFen` can deterministically reproduce.

---

## 1. Data model

### 1.1 Types (target: `src/types/broodwar.ts`)

```ts
export type BwActionTiming = "B" | "C" | "F"; // before / classical / after
export type BwAction =
  | { timing: "B" | "F"; kind: SpecialKind; color: PieceColor; from: Square; to?: Square; seq: number }
  | { timing: "C"; kind: "classical"; color: PieceColor; from: Square; to: Square; promotion?: SpawnPiece; seq: number };

export type BwTurnQueue = {
  /** Global insertion sequence. Resolve groups by timing, then seq. */
  actions: readonly BwAction[];
};

export type BwFenSnapshot = {
  placement: string;                    // classic FEN field 1
  turn: number;                         // planning turn index (0 = start)
  kingLives: Record<PieceColor, number>;
  phase: BwPhaseCode;                   // P B A M F O
  specialsUsed?: readonly Square[];     // |U:… extras
  queue?: BwTurnQueue;                  // BWFEN2 |Q:… planning queue
};
```

### 1.2 Queue invariants

- `C` actions: at most **one per side per turn**.
- `B` / `F` actions: any number, but each must pass its special’s own legality and cost check at `addBwAction` time.
- `seq` is global and monotonic for the planning turn. It is assigned by `addBwAction`, never by render code.
- A snapshot with `phase=P` and `turn=N` means: **placement at start of turn N** plus **queue that will resolve into turn N+1**.
- After End/timeout, the engine emits the next `phase=P` snapshot with `turn=N+1` and an empty queue.

---

## 2. BWFEN2 wire format

BWFEN2 extends BWFEN1 with one optional planning field, `Q:`. BWFEN1 strings remain valid and mean “snapshot-only; queue unknown”.

```text
BWFEN2|<placement>|<turn>|<wlives><blives>|<phase>|Q:<queue>[|U:<squares>]
BWFEN1|<placement>|<turn>|<wlives><blives>|<phase>[|U:<squares>]   // legacy, queue omitted
```

### 2.1 Queue field ABNF

```abnf
queueField   = "Q:" sideQueue ";" sideQueue
sideQueue    = side ":" [ action *( "," action ) ]
side         = "w" / "b"
action       = before / classical / after
before       = "B" special
classical    = "C" from to [ promotion ]
after        = "F" special
special      = kind ":" from [ ":" to ]
kind         = "spawn" / "pawnDouble" / "knightMine" / "bishopSnipe" / "rookSiege" / "queenWarp"
from         = square
to           = square
promotion    = "q" / "r" / "b" / "n"
square       = "a"–"h" "1"–"8"
```

Serialization notes:

- `seq` is **not** written per action; wire order inside `sideQueue` is the side’s local queue order. Global resolve order is reconstructed as: timing rank `B < C < F`, then wire order across `w` then `b` inside each timing rank. If a future rule needs cross-side interleaving inside `B`/`F`, add explicit `seq` as `B07=…` rather than reordering the string.
- Omit empty sides as `w:` / `b:` (do not drop the semicolon).
- `U:` remains only for “special already used this turn” markers. Do not stuff mines, economy, siege mode, castling, or EP into classic fields.

### 2.2 Examples

Combat Chain start (current story: white rook is an unpacked siege tank on c3):

```text
BWFEN2|4bk2/8/5n2/4p3/8/2R5/3P4/4K3|0|33|P|Q:w:;b:
```

Combat Chain turn 0 queued, before End:

```text
BWFEN2|4bk2/8/5n2/4p3/8/2R5/3P4/4K3|0|33|P|Q:w:C=d2d4;b:C=e8c6
```

After resolve (turn 1 planning snapshot; queue cleared):

```text
BWFEN2|5k2/8/2b2n2/4p3/3P4/2R5/8/4K3|1|33|P|Q:w:;b:
```

Charon Booster Missiles queued before a classical move:

```text
Q:w:B=bishopSnipe:d4:h8,C=d2d4;b:C=e8c6
```

Tactical Jump queued as a special move that dodges attacks on the queen origin during that resolve:

```text
Q:w:B=queenWarp:a1:c3;b:C=e7e5
```

---

## 3. BWFEN `addMove` equivalent API

Target module: `src/broodwar/bwActions.ts` (pure) plus store wiring in `src/store/gameStore.ts` / `src/broodwar/broodWarStore.ts`.

```ts
// Pure planning action append — the only way a queue is created.
addBwAction(input: {
  snapshot: BwFenSnapshot;          // must be phase P
  action: Omit<BwAction, "seq">;
}): { snapshot: BwFenSnapshot; action: BwAction }; // assigns seq, returns updated planning snapshot

// Convenience equivalents of FEN addMove / addMoveSan for the classical slot.
addBwMove(snapshot: BwFenSnapshot, move: { color: PieceColor; from: Square; to: Square; promotion?: SpawnPiece }): BwFenSnapshot;
addBwMoveSan(snapshot: BwFenSnapshot, san: string): BwFenSnapshot; // only for the FEN-legal subset; BW-legal specials still use addBwAction

// End / timeout path.
endBwTurn(snapshot: BwFenSnapshot): {
  resolved: ResolveTurnResult;
  next: BwFenSnapshot;              // turn+1, phase P, empty queue
  events: ResolveEvent[];           // ordered VFX / log events
};
```

Rules for `addBwAction`:

- Reject when `snapshot.phase !== "P"` or when the side already has a `C` action and another `C` is appended.
- FEN-legal classical moves validate through the FEN baseline probe. Brood War-only classical outcomes (walk into check, HP survival, mutual captures) are allowed by the locked catalog in `BROODWAR_MODE.md`.
- Special actions call the owning special’s validator (`spawn`, Marine extra step, knight mine, Charon, rook siege, Tactical Jump). Tactical Jump returns targets from visible-empty squares; Charon returns the single diagonal queen; both spend/mark only according to their hook contracts.
- `TurnBar` never builds actions. It reads the queue produced by `addBwAction`.

---

## 4. TurnBar contract (required UI change)

`src/broodwar/primitives/TurnBar.tsx` must display the current queue **before End** and resolve in that order.

Required behavior:

- Read the active side’s queue from the BWFEN store (`broodWarStore.currentQueue` or equivalent). Do not synthesize moves in `TurnBar`.
- Render three groups in order:
  - `B` specials: badges in `seq` order.
  - `C` classical slot: exactly one badge (`from→to`), or an empty/disabled slot if none is queued.
  - `F` specials: badges in `seq` order.
- Show a compact global order hint when both sides are visible in review/storybook: `B… → C(w)&C(b) → F…`.
- End/timeout calls `endBwTurn` on the current planning snapshot. Resolution order must be the queue order defined in §5.
- Storybook target: `Screens/Nerd/Brood War/Turn Chrome → ResourceBar + TurnBar` shows a live queue while actions are added.

Current state: `TurnBar` only renders End + countdown. Add queue rendering as ticket **BW2-TURN-1** in §7.

---

## 5. Deterministic resolve algorithm

Input: one `phase=P` BWFEN2 snapshot with a queue. Output: events + next `phase=P` snapshot.

1. **Special before (`B`)** — apply all `B` actions in timing rank order (`w` wire order, then `b`, unless a future explicit `seq` field says otherwise). A Tactical Jump marks its queen origin as attack-immune for this resolve.
2. **Classical attack (`C`, part 1)** — build dual classical plans from all `C` actions and run `resolveTurn` attack phase against the **start placement after `B`**:
   - captures/king-shots apply to the start board;
   - mutual captures both connect;
   - attacks on a Tactical-Jumping queen origin are ignored;
   - king HP is decremented but kings stay in placement until rubble VFX.
3. **Classical move (`C`, part 2)** — survivors relocate. Quiet classical moves slide. Dead attackers do not occupy.
4. **Special after (`F`)** — apply all `F` actions in timing rank order.
5. **Emit** — `turn+1`, `phase=P`, empty queue, updated placement/lives/specials-used.

Mid-resolve snapshots (`phase=B/A/M/F`) are optional for VFX/review. Planning snapshots used for validate/replay are `P` only.

---

## 6. Validate & replay (FEN parity)

### 6.1 API

Target module: extend `src/broodwar/bwfen.ts`.

```ts
parseBwFen(raw: string): BwFenSnapshot;                 // accepts BWFEN1 + BWFEN2
formatBwFen(snap: BwFenSnapshot): string;               // BWFEN2 when queue is present
validateBwFen(raw: string): { ok: true; snap: BwFenSnapshot } | { ok: false; error: BwFenError };
validateBwFenHistory(startRaw: string, historyRaws: string[]): BwFenValidation;
replayBwFen(start: BwFenSnapshot, steps: readonly BwAction[][]): BwFenSnapshot; // folds endBwTurn
replayBwFenHistory(startRaw: string, historyRaws: string[]): BwFenReplayResult;
```

### 6.2 Validation checks (hard failures)

| Code | Check |
|---|---|
| `BW_SCHEMA` | Prefix `BWFEN1`/`BWFEN2`, field count, 8 ranks, lives `00–33`, phase in `P B A M F O`. |
| `BW_PLACEMENT` | Placement parses; both kings present in every render/planning snapshot. |
| `BW_BASELINE_FEN` | Classic export is loadable. Classical `C` actions that claim to be FEN-legal must pass the baseline probe; BW-only moves must match a locked catalog exception. |
| `BW_QUEUE_SHAPE` | At most one `C` per side; specials have required `from`/`to`; kind is known; queue only on `phase=P`. |
| `BW_SPECIAL` | Special validator accepts the action at append time (cost/vision/target/occupancy rules). |
| `BW_REPLAY` | Each queued planning snapshot resolves deterministically to the next snapshot’s placement/lives/turn. |

### 6.3 Replay equivalence test (must hold)

For every accepted history `H = [s0, s1, …, sn]` where each `si` is `phase=P`:

```text
replay(s0, queue(s0)) == placement/lives/turn of s1
replay(s1, queue(s1)) == placement/lives/turn of s2
…
replay(s(n-1), queue(s(n-1))) == placement/lives/turn of sn
```

BWFEN1 snapshots are snapshot-only: `validateBwFen` accepts them, but `validateBwFenHistory` marks them `replay: "snapshot-only"` and cannot prove queue provenance.

---

## 7. Implementation loop (tickets)

| Ticket | Deliverable | Verify |
|---|---|---|
| **BW2-TYPES-1** | `BwAction`, `BwTurnQueue`, `BwFenSnapshot.queue`, phase/rank helpers. | `tests/broodwar/bwfenQueue.test.ts` type-level + queue shape tests. |
| **BW2-FEN-1** | `BWFEN2` parse/format for `Q:`; BWFEN1 passthrough. | Round-trip: Combat Chain start/queued/resolved examples in §2.2. |
| **BW2-ADD-1** | `addBwAction` / `addBwMove` / `addBwMoveSan` with seq assignment and per-side classical slot guard. | Unit: appending two `C` actions for same side rejects; FEN-legal subset matches `addMove` behavior. |
| **BW2-RESOLVE-1** | `endBwTurn` groups `B → C attack → C move → F`; Tactical Jump attack-immunity via `ignoreAttacksOn`. | `resolveTurn` + queue integration tests: simultaneous, mutual capture, Charon, Tactical Jump dodge. |
| **BW2-TURN-1** | `TurnBar` queue display from store only; End calls `endBwTurn`. | Storybook Turn Chrome: queue visible before End; order badges `B… C F…`; resolve follows display. |
| **BW2-VALIDATE-1** | `validateBwFen` / `validateBwFenHistory` / `replayBwFenHistory` with error codes in §6.2. | FEN-parity matrix in §8 passes. |
| **BW2-STORY-1** | Combat Chain / King Hunt / Special Moves snapshots emitted through `addBwAction` + `endBwTurn`, not hand-written turn arrays. | Stories still render; capture script IDs use `screens-nerd-brood-war-demo--*`. |
| **BW2-DOCS-1** | Sync `BROODWAR_MODE.md`, capture script, and this file after queue lands. | No stale `screens-nerd-demo--*` links; no “queue omitted v1” text remains. |

Loop rule: no ticket is done until its pure test passes **and** the corresponding Storybook story is run (`npm run storybook`) with the queue visible before End.

---

## 8. Verification matrix (acceptance)

| Case | Expected |
|---|---|
| FEN start position round-trip | `format(parse(x)) === x`; classic export loads in `chess.js`. |
| FEN-legal classical move | `addBwMove` accepts; replay equals classical `addMove` result for the same baseline. |
| Simultaneous W&B quiet moves | One `turn` bump; one next placement; both `C` actions resolve from the same start board. |
| Capture split | Attacks apply first; only survivors move; mid `A/M` snaps optional. |
| Mutual captures | Both victims removed; neither capturer relocates. |
| Walk into check / king HP | Accepted as BWFEN-legal; lives unchanged until a connecting shot; king glyph stays in placement until rubble VFX. |
| Bishop special attack | `B=bishopSnipe:from:to` ignores blockers; bishop does not relocate; target queen removed after impact/death. |
| Queen special move | `B=queenWarp:from:to` teleports only to visible empty square; blockers ignored; attacks on queen origin in same resolve are ignored. |
| Queue provenance | Every `P` snapshot after `addBwAction` has non-empty `Q` before End and empty `Q` after resolve. |
| Replay | §6.3 equivalence holds for Combat Chain, King Hunt, Charon, Tactical Jump histories. |

Commands:

```bash
npm run test:int -- tests/broodwar/bwfenQueue.test.ts tests/broodwar/bwfen.test.ts tests/broodwar/resolveTurn.test.ts
npm run storybook
node apps/ui/scripts/capture-broodwar-fen-gifs.cjs
```

---

## 9. Render constraints (still always)

| Constraint | BWFEN / classic export |
|---|---|
| Both kings in every render FEN | Even at `wlives=0`, keep `K`/`k` in `placement` so `chess.js` `loadFen` works. |
| Check chrome | Derived from occupancy; side-to-move in classic export is render-only. |
| Mines / overlays | Beside placement; never overload classic castling/EP. |
| Siege Tank mode | Store/UI (`siegedRooks`) until a later extras field is approved. Combat Chain seeds siege on the white rook starting c3. |
| Economy | Outside the string for v2 planning snaps; may be added later only as a versioned extras field. |

Anti-goals unchanged: do not extend classical FEN for HP/mines/queues inside Coach/Analysis; do not use `chess.js` as the Brood War rules board; do not drop classic placement export.

Full rules: [`BROODWAR_MODE.md`](BROODWAR_MODE.md).
