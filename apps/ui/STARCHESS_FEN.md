# StarChess FEN (SCFEN) — wire & tickets

**Rules authority** (classic FEN baseline, simultaneous resolve, fog, collisions):
[`_spec/apps/ui/starchess/scfen.md`](../_spec/apps/ui/starchess/scfen.md) · [`resolve.puml`](../_spec/apps/ui/starchess/resolve.puml).

This file keeps **wire format**, **shipped/ticket tables**, and **demo links** only.

Canonical demos:

| Demo | Story | Illustrates |
|---|---|---|
| **Combat Chain** | [combat-chain](http://localhost:6006/?path=/story/screens-nerd-star-chess-demo--combat-chain) | `W & B` per turn; attack → death → occupy |
| King Hunt | [king-hunt](http://localhost:6006/?path=/story/screens-nerd-star-chess-demo--king-hunt) | Delayed checks + HP; tank on g7 |
| King Hunt (live) | [king-hunt-live](http://localhost:6006/?path=/story/screens-nerd-starchess-demo--king-hunt-live) | Pre-armed `H:`; ResourceBar / TurnBar / End |
| Fog-edge Bishop / Rook tank | [fog-of-war-and-move-animations](http://localhost:6006/?path=/story/screens-nerd-starchess-fog-of-war-and-move-animations--bishop) | Move into fog → capture/occupy blocker |

Product / UX / economy: [`STARCHESS_MODE.md`](STARCHESS_MODE.md).

---

## Shipped vs pending

### Done (do not re-ticket)

| Area | Location |
|---|---|
| Types: `ScAction`, `ScTurnQueue`, gas, `ScFenSnapshot.queue` | `src/types/starchess.ts` |
| `SCFEN` parse/format (`G:`, `Q:`, `U:`, `M:`, `S:`, `H:`) | `src/starchess/scfen.ts` |
| `addScAction` / `addScMove` / `endScTurn` | `scActions.ts`, `endScTurn.ts` |
| Fog-aware classify + move collision | `resolveTurn.ts` + `vision.ts` via `endScTurn` |
| Intent `C=` vs progressive path resolve | `_spec/.../scfen.md` §3–§4; `pathRevealSteps` / `pathRevealFrom` in `resolveTurn` |
| King-shot ray collision | `resolveTurn` / `applyPendingKingShots` (pending `H:`) |
| Delayed check → next-turn HP | King-aimed `C=` arms `H:`; apply after next `B` |
| Spider Mines `M:` | `mines.ts`, `resolveTurn` |
| Fog-edge DualNav (Bishop / Rook tank) | `demos/fogEdge*.ts` + `FogEdgeDemo` |
| Sieged rook immobile (`S:`) | `scValidate` + `endScTurn` toggle |

### Pending

| Area | Notes |
|---|---|
| Optional history `C=a1a8>xa5` | Serializer for finished plies |
---

## Wire format

```text
SCFEN|<placement>|<turn>|<wlives><blives>|<phase>|G:<wGas><bGas>:<wInc><bInc>[|Q:<queue>][|U:<squares>][|S:<squares>][|H:<hits>][|M:<mines>]
```

| Field | Role |
|---|---|
| `G:` | Remaining vespene + income/cap (required) |
| `Q:` | Planning queue; omit = snapshot-only |
| `U:` | Specials-used squares this turn |
| `S:` | Sieged rook squares (`S:c3f7`). Unpacked tanks are **immobile** until `rookSiege` toggles tank mode |
| `H:` | Pending king-checks (`H:b:n:c5e4`). Armed by king-aimed `C=`; HP / collision on **next** End after `B`. Multiple hits `;`-separated |
| `M:` | Mines `M:w:c3d4;b:f5` (max 2 / side). Not FEN pieces |

### Queue ABNF

```abnf
queueField = "Q:" sideQueue ";" sideQueue
sideQueue  = side ":" [ special "," ] [ classical ] / side ":" [ classical "," ] [ special ] / side ":"
special    = ("B" / "F") "=" kind ":" from [ ":" to [ ":" unit ] ]
classical  = "C=" from to [ promotion ]
kind       = "spawn" / "pawnDouble" / "knightMine" / "bishopSnipe" / "rookSiege" / "queenWarp"
```

King-shot classical actions encode `to` = **intent** (often enemy king square). Resolve may retarget; optional history `C=from intentTo>resolvedTo`. See `_spec` §3.

Queue shape: ≤1 `C` + ≤1 special (`B` xor `F`) per side; resolve rank `B < C < F`, then **w then b**.

---

## Verify

```bash
cd apps/ui && npm run lint && npm run test:int -- tests/starchess
```
