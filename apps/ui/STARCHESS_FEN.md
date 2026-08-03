# StarChess FEN (SCFEN)

Status: **living spec**. Core SCFEN queue + gas + `endScTurn` + Combat Chain / King Hunt demos are **shipped**. This file is the position/queue encoding authority; rules authority is [`STARCHESS_MODE.md`](STARCHESS_MODE.md).

Canonical demos:

| Demo | Story | Illustrates |
|---|---|---|
| **Combat Chain** (turn-shape reference) | [screens-nerd-star-chess-demo--combat-chain](http://localhost:6006/?path=/story/screens-nerd-star-chess-demo--combat-chain) | `W & B` per turn; attack → death → occupy |
| King Hunt | [screens-nerd-star-chess-demo--king-hunt](http://localhost:6006/?path=/story/screens-nerd-star-chess-demo--king-hunt) | Same grammar + checks + walk-into-check (FEN-illegal, SCFEN-legal) |

---

## Shipped vs pending

### Done (do not re-ticket)

| Area | Location |
|---|---|
| Types: `ScAction`, `ScTurnQueue`, gas fields, `ScFenSnapshot.queue` | `src/types/starchess.ts` |
| `SCFEN` parse/format (`G:`, optional `Q:`, `U:`) | `src/starchess/scfen.ts` |
| Notation mutation tests (shape / gas) | `tests/starchess/scfenNotation.test.ts` |
| `addScAction` / `addScMove` / `addScMoveSan` | `src/starchess/scActions.ts` |
| `endScTurn` (`B → attack → move → F`, w-then-b) | `src/starchess/endScTurn.ts` |
| `validateScFen` / history / replay (placement, lives, turn, gas) | `src/starchess/scfen.ts` |
| Store planning snap + `currentQueue` / `endPlanningTurn` | `src/starchess/starChessStore.ts` |
| `TurnBar` queue badges from store | `src/starchess/primitives/TurnBar.tsx` |
| Combat Chain / King Hunt SCFEN+engine demos | `src/starchess/demos/*`, Storybook Demo stories |

### Pending (open tickets)

| Ticket | Deliverable | Notes |
|---|---|---|
| **SC-LIVE-1** | Live `/starchess` `NerdScreen` planning | Today: `resolveOnEnd={false}`, End is a status stub. Wire gestures → `queueScAction` / `setPlanningSnapshot`, End/timeout → `endPlanningTurn` + combat VFX. |
| **SC-BASELINE-1** | `SC_BASELINE_FEN` deep validator | Classical `C` that claims FEN-legal must pass baseline probe; StarChess-only catalog exceptions stay allowed. |
| **SC-SPECIAL-1** | `SC_SPECIAL` deep validator | Per-kind legality at `addScAction` (vision, adjacency, occupancy, Charon target, Jump target, spawn afford, mine caps). |
| **SC-COLLISION-1** | Collision retarget in attack phase | See §5.1 — king-shot commands stay `to=kingSq` on the wire; post-`B` blockers die instead of king HP. |
| **SC-MINE-1** | Spider Mine board model + SCFEN `M:` | See §9 + MODE Spider Mine rules. Encode mines beside placement. |
| **SC-MINE-ANIM-1** | Spider Mine Storybook loop | Fog / Attack (path collide) / Death (attacked mine) — shared explosion VFX. |

---

## 0. Non-negotiables

1. **FEN baseline is included.** Any classically legal placement and any classically legal move is SCFEN-legal unless a locked StarChess rule explicitly changes the outcome.
2. **Classical FEN stays render/export only.** `chess.js` may validate the FEN baseline and render snapshots, but it is **not** the StarChess move oracle.
3. **SCFEN differences are only:**
   - **Special-move awareness** (including Charon, Tactical Jump, spawn, mines).
   - **Split classical move** — capture = **attack**, then **move** if the attacker survives.
   - **Simultaneous turn resolving** — both sides queue; one shared resolve.
   - **Gas in notation** — `G:` remaining + income/cap.
   - **Collision** — queued classical `to` may retarget after `B` specials (§5.1).
4. **Every planning turn has an action queue.** Shape per side (MODE budget):

```text
≤1 special (B xor F) + ≤1 classical (C)
```

5. **The queue is produced only by `addScAction` / `addScMove`.** `TurnBar` displays that queue; End resolves in that order.
6. **Validate & replay must reach FEN parity** for placement / lives / turn / gas (and mines once `M:` ships).

---

## 1. Data model

```ts
// src/types/starchess.ts — shipped
export type ScActionTiming = "B" | "C" | "F";
export type ScFenSnapshot = {
  placement: string;
  turn: number;
  kingLives: Record<PieceColor, number>;
  phase: ScPhaseCode;
  gas: Record<PieceColor, number>;
  gasIncome: Record<PieceColor, number>;
  specialsUsed?: readonly Square[];
  queue?: ScTurnQueue;
  /** Pending: spider mines beside placement (`|M:…`). */
  mines?: readonly { color: PieceColor; at: Square }[];
};
```

Queue invariants: ≤1 `C` per side; ≤1 special (`B` xor `F`); `seq` assigned by `addScAction`; resolve rank `B < C < F`, then **w then b** inside each rank.

---

## 2. SCFEN wire format

```text
SCFEN|<placement>|<turn>|<wlives><blives>|<phase>|G:<wGas><bGas>:<wInc><bInc>[|Q:<queue>][|U:<squares>][|M:<mines>]
```

| Field | Status | Role |
|---|---|---|
| `G:` | **Shipped (required)** | Remaining vespene + income/cap |
| `Q:` | **Shipped (optional)** | Planning queue; omit = snapshot-only |
| `U:` | **Shipped (optional)** | Specials-used squares this turn |
| `M:` | **Pending** | Packed mines: `M:w<a1><c3>b<e5>` (color + square pairs). Max **2 per side**. Not FEN pieces. |

### 2.1 Queue ABNF (shipped)

```abnf
queueField = "Q:" sideQueue ";" sideQueue
sideQueue  = side ":" [ special "," ] [ classical ] / side ":" [ classical "," ] [ special ] / side ":"
special    = ("B" / "F") "=" kind ":" from [ ":" to [ ":" unit ] ]
classical  = "C=" from to [ promotion ]
kind       = "spawn" / "pawnDouble" / "knightMine" / "bishopSnipe" / "rookSiege" / "queenWarp"
```

King-shot classical actions still encode `to` = **enemy king square** even when a later collision will kill a blocker instead (§5.1).

---

## 3–4. APIs (shipped)

- `addScAction` / `addScMove` / `addScMoveSan` — `src/starchess/scActions.ts`
- `endScTurn` — `src/starchess/endScTurn.ts`
- `TurnBar` reads `currentQueue`; `endPlanningTurn` when a planning snap is armed
- **Gap:** `NerdScreen` still `resolveOnEnd={false}` (**SC-LIVE-1**)

---

## 5. Deterministic resolve algorithm

1. **Special before (`B`)** — `w` then `b` (spawn, Jump, Charon, mine drop, …).
2. **Classical attack (`C`, part 1)** — against the **post-`B` board**, with **collision retarget** (§5.1).
3. **Classical move (`C`, part 2)** — survivors relocate; king-shots never occupy the king square.
4. **Path / stand mine triggers** — during move (and stand), Spider Mines may explode (§ MODE).
5. **Special after (`F`)**.
6. **Emit** next `phase=P` (or `O`), empty `Q`, refilled `G:`, cleared `U:`.

### 5.1 Collision (pending **SC-COLLISION-1**) — last recorded anomaly

**Problem.** A player can queue a king-shot (`C=…kingSq`). The defender can queue `B=spawn` that places a unit onto the attacking ray (or otherwise intercepts). After `B`, the shot must not chip the king if a unit now collides with that command.

**Locked resolve rule:**

1. SCFEN **keeps** the classical command as a king-shot (`to` = king square). The wire does not rewrite `to` to the blocker.
2. At attack time, scan geometry from attacker `from` → planned `to` on the **post-`B`** board.
3. If the clear king-shot is **blocked** by a unit on the ray (or the first occupied square on the ray is not the king):
   - **Collision:** that unit is the impact target → normal capture/death of the colliding unit.
   - King HP is **not** decremented.
4. King-shot semantics still apply to the **command intent**: the attacker does **not** relocate onto the king square. If collision consumed the shot against a blocker, the attacker likewise does **not** occupy the blocker’s square unless the locked capture-occupy rules for that piece say otherwise — default for a planned king-shot: **no occupy** (same as a connecting king-shot).
5. If nothing blocks and the king is still the target → normal king-shot (HP−1, no occupy).

Motivating line: defender `B=spawn` into the ray; attacker’s queued check remains `C=…kingSq`; resolve kills the spawned unit instead of chipping the king.

Int tests to add with **SC-COLLISION-1**: spawn-before-king-shot; mutual same-ray cases; wire round-trip preserves `to=kingSq` while board outcome hits the blocker.

---

## 6. Validate & replay

| Code | Status |
|---|---|
| `SC_SCHEMA` / `SC_PLACEMENT` / `SC_GAS` / `SC_QUEUE_SHAPE` / `SC_PHASE` / `SC_REPLAY` | **Shipped** |
| `SC_BASELINE_FEN` | **Pending** — **SC-BASELINE-1** |
| `SC_SPECIAL` | **Pending** — **SC-SPECIAL-1** |

---

## 7. Ticket board

| Ticket | Status |
|---|---|
| SC-TYPES-1 … SC-STORY-1, SC-DOCS-1 (rename) | **Done** |
| SC-LIVE-1 | Pending |
| SC-BASELINE-1 | Pending |
| SC-SPECIAL-1 | Pending |
| SC-COLLISION-1 | Pending |
| SC-MINE-1 | Pending |
| SC-MINE-ANIM-1 | Pending |

---

## 8. Verification (shipped slice)

```bash
cd apps/ui && npm run lint && npm run test:int -- tests/starchess
```

Combat Chain / King Hunt: Storybook `screens-nerd-star-chess-demo--*`; capture via `scripts/capture-starchess-fen-gifs.cjs`.

---

## 9. Render / extras constraints

| Constraint | Notes |
|---|---|
| Both kings in every render FEN | Even at `wlives=0`. |
| Siege Tank mode | Store (`siegedRooks`) until an extras field is approved. |
| Minerals / idle bonus | Outside the string for now. |
| Spider Mines | **Not** FEN pieces — pending `|M:…` (**SC-MINE-1**). Immobile; vision = own square only. |

Anti-goals: do not extend classical FEN for HP/mines/queues inside Coach/Analysis; do not use `chess.js` as the StarChess rules board.

Full rules (incl. Spider Mine combat + collision): [`STARCHESS_MODE.md`](STARCHESS_MODE.md).
