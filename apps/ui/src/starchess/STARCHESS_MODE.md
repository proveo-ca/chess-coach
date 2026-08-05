# StarChess Mode — product / UX

**Exclusive to** [`NerdScreen.tsx`](src/screens/NerdScreen.tsx). Engine under [`src/starchess/`](src/starchess/).

**Rules authority** (FEN baseline, simultaneous queue/resolve, **intent vs resolved**, progressive fog, king/mine path exceptions):
[`_spec/apps/ui/starchess/scfen.md`](../_spec/apps/ui/starchess/scfen.md).

**Wire / tickets / demos:** [`STARCHESS_FEN.md`](STARCHESS_FEN.md).

---

## Goals

| Concern | Classical chess | StarChess |
|---|---|---|
| Turn structure | One side moves | Both queue; End / timeout submits |
| Actions per turn | One move | ≤1 special + ≤1 classical (stack order → `B`/`F`) |
| Conflicts | Impossible in one ply | Classical = **attack** then **move** |
| Economy | None | Minerals + vespene |
| Vision | Full board | Cumulative fog (always on in mode) |
| King | Mate; no walk into check | **3 lives**; may walk into fire |

---

## Specials (product)

Long-press / GasDeploy queues `B` or `F` (stack order). Costs from MODE economy (most **1** gas; Charon + Jump **2**).

| Unit | Special | Notes |
|---|---|---|
| Pawn | Double (`pawnDouble`) | Paid StarChess double |
| Knight | Spider Mine (`knightMine`) | `M:` overlay; cap 2 / side — see `_spec` + MODE mine rules historically in git |
| Bishop | Charon (`bishopSnipe`) | 2 gas; ignore blockers |
| Rook | Siege toggle (`rookSiege`) | Tank ↔ siege vision / mobility |
| Queen | Tactical Jump (`queenWarp`) | 2 gas; visible empty square |
| King | Spawn | Adjacent deploy; can collide with king-shots |

Spider Mine combat (path-chase / attack-mine; ignores allies + enemy kings): `_spec` §4 + `resolveTurn`.

---

## UX (v1)

- `ResourceBar` + `TurnBar` above the board; fog forced when `starChessMode`.
- Cumulative vision: `vision.ts` (union of friendly units; mines light own square).
- Attack-time reveal: shooter `from` shown for the shot cue.
- Fog-edge DualNav stories (Bishop / Rook tank): SCFEN only — `_spec` §5.

---

## Shipped slice

See [`STARCHESS_FEN.md`](STARCHESS_FEN.md) shipped table. Live `/starchess` planning + combat VFX on End.

```bash
cd apps/ui && npm run test:int -- tests/starchess
```
