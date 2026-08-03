# StarChess Mode

Design and implementation plan for the Nerd / StarChess ruleset.
**Exclusive to** [`apps/ui/src/screens/NerdScreen.tsx`](apps/ui/src/screens/NerdScreen.tsx).
**All engine logic lives under** [`apps/ui/src/starchess/`](apps/ui/src/starchess/) — not for reuse outside this mode.

**Position encoding (classical FEN vs SCFEN, simultaneous attack→move, demo GIFs):** see sibling [`STARCHESS_FEN.md`](STARCHESS_FEN.md).

---

## Goals

Replace classical alternating chess turns with a simultaneous-action economy game:

| Concern | Classical chess | StarChess |
|---|---|---|
| Turn structure | One side moves | Both players queue plans; turn ends when both submit (or timeout) |
| Actions per turn | One move | **Stack:** ≤1 special + ≤1 classical; order sets timing; completing the stack (or End / timeout) submits |

| Conflicts | Impossible in one ply | Classical action resolves in **2 parts** (attack → move) |
| Economy | None | Stored + deployed material caps |
| Vision | Full board | Fog of war (**cumulative** vision of all own units) |
| Spawning | Fixed army | King special: spawn adjacent for cost |
| King | One checkmate; cannot walk into check | **3 lives**; check/mate replaced; **may walk into fire** (fog punishment) |

Fog of war and StarChess rules are both gated by `starChessMode` on `NerdScreen`.

---

## Rules

These are locked for v1 so the engine can ship without further product decisions:

1. **Action budget (stack)** — each player may queue at most:
   - **1 special** action (spawn / ability), **and**
   - **1 classical** chess action (a single from→to).  
   Either slot may be empty. Actions **stack** in the order the player performs them:
   - **Special → classical** — special is timed `"before"`; after the classical action is queued, the plan **auto-submits**.
   - **Classical → special** — special is timed `"after"`; after the special is queued, the plan **auto-submits**.
   - **Special only / classical only / neither** — player presses **End** (or the timer expires) to submit.
2. **Special timing** — derived from stack order (above), not a separate toggle. Explicit `timing` on `QueuedSpecial` still stored for resolve. Default when only a special is End-submitted: `"before"`.
3. **Classical resolution (2 parts)** — every classical action is processed as:
   1. **Attack** — if the action is a capture/hit, apply damage / removals (mutual captures both connect; king hits decrement lives).
   2. **Move** — if the acting unit still lives and the destination is legal after attacks, relocate it.  
   Pure non-captures skip attack effects and only move. Motivating case: two pawns classical-capture each other → both die in attack → neither moves.
4. **Material income by turn number** (turn index starts at 1 after each resolved round):
   - turns `1–10` → **+1**
   - turns `11–20` → **+2**
   - turns `21+` → **+3**
5. **Vespene energy (special fuel)** — same tiers as material income (`1` / `2` / `3`). Refills to the tier cap at the start of each planning turn; **does not accumulate**. Each special costs **1** gas (exceptions: Bishop/Goliath Charon Booster Missiles and Queen/Battlecruiser Tactical Jump cost **2** — see Special moves). Shown on [`ResourceBar`](apps/ui/src/starchess/primitives/ResourceBar.tsx) as remaining / capacity.
6. **Idle bonus** — if a player queues **neither** special nor classical → income × **1.5** (rounded down).
7. **Caps** — max **12** stored material; max **50** deployed material (King counts as **1** deployed). UI deploy count on ResourceBar is **Σ unit costs** of pieces the player owns on the board.
8. **Unit purchase costs** (stored → deployed on spawn):

   | Unit | Cost |
   |---|---|
   | King | 1 (starting; not purchasable) |
   | Pawn | 1 |
   | Knight | 3 |
   | Bishop | 3 |
   | Rook | 5 |
   | Queen | 9 |

9. **Turn timeout** — **10s** constant (`TURN_TIMEOUT_MS`). Shown on [`TurnBar`](apps/ui/src/starchess/primitives/TurnBar.tsx) as a circular gauge with seconds in the center. Expiry auto-submits the current plan (same as End).
10. **Global phase order** — `[specialBefore | attack | move | specialAfter]`:
   - **specialBefore** — specials with `timing: "before"` (e.g. king spawn, mine drop)
   - **attack** — classical part 1 (both players), including **collision retarget** ([§16](#rules))
   - **move** — classical part 2 (both players); Spider Mine path/stand triggers fire here ([Spider Mines](#spider-mines-knight--vulture))
   - **specialAfter** — specials with `timing: "after"`
11. **King lives** — each king starts at **3 HP**. A successful **attack** that targets the enemy king decrements HP by 1 (king stays on board until HP = 0). Third hit → destroyed → that player loses. Visual states: [King damage states](#king-damage-states). Classical check / checkmate / stalemate / insufficient-material **draws are not StarChess outcomes** (HP replaces mate; no DRAW banner).
12. **King hits vs classical check (attack timing)** — locked Option A: arrival / discovered threats are **next turn**. Same phase clock as every other unit — **no** “king-target resolves after move” exception.
    1. A successful king hit = classical attack with `to === enemyKingSquare`, clear geometry from the attacker’s **pre-move** square, during the **attack** phase (after `B` specials).
    2. Relocating onto (or uncovering) a ray that attacks the king does **not** chip HP this resolve — that only enables a king-shot on a **later** turn’s attack phase.
    3. Non-king pieces never occupy the enemy king’s square; damage is HP only. Kings may still capture other units with attack → occupy (e.g. `Kxc5`).
    4. Classical `+` / checkmate annotations are not StarChess results. UI **may** show a post-`move` **threatened** telegraph (preview of next-turn shots) without applying damage.
    5. **Caveat — king may walk into fire.** Moving or staying on a square attacked by the enemy is **legal** in StarChess (classically illegal as moving into / remaining in check). This is the fog-of-war punishment: without vision you can step onto a hidden shooter. Option A still applies — the standing shooter chips HP only when they queue a king-shot on a later attack phase (or this phase if they already stood on a clear ray and targeted the king).
13. **Attack animations (v1)** — one attack VFX per unit type ([Attack animations](#attack-animations-v1)); verified in Storybook. Move/special VFX deferred (except Spider Mine explosion — [SC-MINE-ANIM-1](STARCHESS_FEN.md)).
14. **Special abilities** — long-press / GasDeploy a friendly unit to queue that unit’s special (uses the **1 special** slot; burns gas per kind). See [Special moves](#special-moves).
15. **Board chrome** — StarChess has **no captured-pieces rows**. **`ResourceBar` + `TurnBar` sit side-by-side above the board** (minerals / vespene / deploy | End + 10s gauge + queue badges). Specials are armed by **dragging a footer gas canister** onto a unit ([`GasDeploy`](apps/ui/src/starchess/features/GasDeploy.tsx)). **Live `/starchess` End still stubbed** (`resolveOnEnd={false}`) — see pending **SC-LIVE-1** in [`STARCHESS_FEN.md`](STARCHESS_FEN.md).
16. **Collision (locked; engine pending SC-COLLISION-1)** — last recorded anomaly on king protection:
    1. SCFEN stores a king-shot as `C=from→kingSq` even when a `B` special will intercept.
    2. After `specialBefore`, if a unit occupies the attacking ray so the shot no longer has clear geometry to the king, **collision**: that unit dies (capture/death) instead of the king losing HP.
    3. The attacker still obeys king-shot relocate rules (**no occupy** on the king square). Default for a planned king-shot that collides: **no occupy** on the blocker either.
    4. Motivating case: king `B=spawn` onto the ray; opponent’s queued check remains aimed at the king on the wire; resolve kills the spawned unit.
    5. Same collision primitive is reused by Spider Mines (path/stand/friendly-fire) — see below.

---

## Special moves

Triggered by **long-press** on a friendly piece during planning (not a tap/select). Queues into `PlayerTurnPlan.special`. Timing comes from [action stack order](#rules) (special-first → `"before"`; move-first → `"after"`). Still ≤1 special per player per turn.

| Unit | Special | Notes | FEN / `chess.js` |
|---|---|---|---|
| **Pawn (Marine)** | Extra step | Start-rank classical doubles remain free. Paid gas special moves only **1 extra square** forward (destination empty; no d2→d6 stacking). | Classical double FEN-legal; gas extra step is a StarChess board op — **shipped** |
| **Knight (Vulture)** | Drop Spider Mine (`knightMine`) | Gas **1**. Immobile overlay (not a FEN piece). Full rules: [Spider Mines](#spider-mines-knight--vulture). Cap **2 mines / player**. | Overlay — pending SCFEN `M:` (**SC-MINE-1**) |
| **Bishop (Goliath)** | Charon Booster Missiles (`bishopSnipe`) | Costs **2** vespene. Two-canister GasDeploy drag arms targeting only (energy < 2 → “Not enough gas (2 required)”); exactly one enemy queen on the diagonal rays (blockers ignored) is highlighted; wrong clicks are ignored while armed; clicking the queen fires twin homing missiles (`bishopCharon`, 250ms). Bishop does **not** relocate; queen is removed on impact + normal death/FEN commit. | **Illegal** (ignores blockers) — **shipped** |
| **Rook** | Siege mode / attack without moving | Pack↔unpack siege **shipped** in store/demos. Classical-style attack that leaves the rook on `from` still deferred. | Mix |
| **Queen (Battlecruiser)** | Tactical Jump (`queenWarp`) | Costs **2** vespene. Two-canister GasDeploy drag arms targeting; click a highlighted **visible empty** square (blockers ignored) to teleport. Attacks on the jumping queen are ignored. VFX: 200ms stretched-thin light travel facing the jump, 50ms appear burst, green back thrusters, twin trails fading over 1000ms. | **Illegal** (teleport / ignore path) — **shipped** |
| **King** | Spawn (purchase) | Opens DeployModal / spawn picker. Spends stored material; deploys adjacent. Timed `B` can **collide** with an enemy king-shot ([rule §16](#rules)). | FEN-legal once spawned — demo shipped; live queue wiring pending **SC-LIVE-1** |

### Spider Mines (Knight / Vulture)

**Design locked; engine + SCFEN `M:` + anim stories pending (SC-MINE-1 / SC-MINE-ANIM-1).** Placement UX demo exists (`KnightMineDemo` / `useVultureSpiderMine`); combat simulation does not.

| # | Rule |
|---|---|
| 1 | **Immobile unit** (like a sieged tank that never packs). Vision = **only its own square**. Encoded beside FEN placement (`M:` extras), never as a chess piece glyph. |
| 2 | Spider Mines **can be attacked** when a classical (or colliding) attack legally targets their square — mine dies via the shared explosion VFX. |
| 3 | **Trigger:** a Spider Mine attacks whenever a **hostile** piece **moves over** the square it lives on — either **passing through** on a slide path or **landing / standing** on it. Contact calculation: for sliding pieces, every intermediate square on the from→to ray (exclusive of `from`, inclusive of `to`) is a contact candidate; for leaps (knight), only the destination square. Explosion removes **mine + triggering enemy** (mutual death). |
| 4 | **Cap:** at most **2** Spider Mines per player on the board. `addScAction` / `SC_SPECIAL` reject a third. |
| 5 | **Allies** may walk onto / through a friendly mine **without** triggering (non-blocking; ally + mine can share the square). |
| 6 | **Friendly fire:** an attack that hits an **ally standing on** a Spider Mine **explodes both** (ally + mine). Attacker follows normal capture-occupy rules against the ally square after the explosion clears it, unless the attacker also dies. |

Collision note: mine triggers are the same “command aimed at X, board state after earlier phases decides who dies” idea as king-shot collision ([rule §16](#rules) / SCFEN §5.1).

#### Spider Mine animations (Storybook — attach **SC-MINE-ANIM-1**)

Title folder: `Screens/Nerd/StarChess/Spider Mines` (or under Special Moves / Attack / Death — one coherent set).

| Story | Setup | Asserts |
|---|---|---|
| **Fog** | Mine on a dark square; only own-square lit for the mine’s side | Mine glyph visible to owner when square lit; hidden under enemy fog when unlit |
| **Attack (path collide)** | Enemy rook (or queen) classical-moves along a file/rank that **passes through** a mine (e.g. a1→a8 with mine on a4). Challenge: contact = intermediate path squares, not only destination. | Shared **explosion** VFX on contact; mine + enemy removed; no surviving occupy on the mine square |
| **Attack (stand / land)** | Enemy steps onto the mine square | Same explosion; both die |
| **Death (attacked mine)** | Enemy queues a capture/attack onto the mine square (mine is the target) | **Reuse the same explosion** animation as Attack stories; mine removed |

Reuse one explosion component for Attack-collide and Death-attacked — do not fork VFX.

#### Remaining deferred specials / board-model gaps

| Special | Status |
|---|---|
| **Rook attack-without-moving** | Still deferred (siege toggle shipped) |
| **Knight Spider Mine combat** | Rules locked above; engine / `M:` / anim stories pending |
| **Collision retarget** | Rules locked ([§16](#rules)); engine pending **SC-COLLISION-1** |

#### Render / snapshot constraints (still FEN-loadable)

| Constraint | Why |
|---|---|
| **Both kings present in every render FEN** | `chess.js` rejects kingless FENs — even after HP = 0 / rubble VFX, keep a loadable snapshot (Storybook + live board). |
| **Mines / non-piece overlays** | Not encoded in FEN piece placement; track in SCFEN `M:` / store when **SC-MINE-1** ships. |

### Classical / FEN-illegal scenarios (catalog)

StarChess must **not** filter plans through `chess.js` check / mate legality. Most rows below are classically illegal; **king spawn** is FEN-legal after resolve.

#### Locked — allow in `resolveTurn` / `addScAction` (do not reject as “in check”)

| Scenario | Why classical / FEN rejects it | StarChess |
|---|---|---|
| **King walks into (or stays in) a line of fire** | Moving into check / leaving the king in check | **Allowed** — fog punishment ([rule §12.5](#rules)). |
| **King remains after hits (HP > 0)** | Capturing the king / checkmate ends the game | King stays until HP = 0 ([rule §11](#rules)). |
| **King-shot without occupying the king square** | Capture removes the king | HP only; no occupy ([rule §12.3](#rules)). |
| **King-shot collides with a post-`B` blocker** | N/A in classical | Wire keeps `to=kingSq`; blocker dies instead ([rule §16](#rules)). |
| **Damaged king keeps moving** | Game already over after mate / king capture | While HP > 0 the king may flee, capture, or walk into further fire. |
| **Simultaneous both-sides classical actions** | One side moves per ply | Both plans resolve in one turn. |
| **Mutual classical captures both connect** | Only one capture resolves per ply | Both die in `attack` → neither moves ([rule §3](#rules)). |
| **Attack → move split** | A capture is a single atomic move | Part 1 damage; part 2 survivors only. |
| **Hostile path / stand on Spider Mine** | N/A | Mine + enemy explode ([Spider Mines](#spider-mines-knight--vulture)). |

#### King spawn — FEN-legal special

Purchase + deploy an adjacent unit. Resulting board is ordinary FEN. Timed `B` spawn is the motivating collision case for [rule §16](#rules).

| Concern | Rule |
|---|---|
| Who | Friendly king → DeployModal |
| Where | Empty square **adjacent** to the king |
| Cost | Stored material + gas; respect caps |
| Phase | `B` or `F` per stack order |
| FEN | Legal after resolve |

### King spawn modal + ResourceBar

Long-press king → modal variant of `PromotionModal`:

1. **Top: `ResourceBar`** ([`starchess/primitives/ResourceBar`](apps/ui/src/starchess/primitives/ResourceBar.tsx))
   - **Minerals strip:** blocks icon + `{stored}` + `+{incomePerTurn}` (income is the *next* turn’s base income from [rules §4](#rules), not idle bonus).
   - **Vespene strip:** canister icon + `{remaining} / {capacity}` this turn ([rules §5](#rules)).
   - **Deployed strip:** blocks+people icon + `{boardDeployed} / 50` (Σ `UNIT_COST` of owned pieces; `MAX_DEPLOYED_MATERIAL`).
2. **Below: spawn choices** — **pawn first**, then the usual promotional set: `p`, `q`, `r`, `b`, `n` (order: pawn → queen → rook → bishop → knight). Disable / grey choices the player cannot afford (minerals, deploy cap, or **no vespene**).
3. On select: queue `QueuedSpecial { kind: "spawn", unit, from: kingSq, to: spawnSq, … }`. Exact adjacent-target UX (auto-pick vs second tap on empty adjacent square) — implement with spawn validation in `actions.ts`.

Classical pawn-promotion `PromotionModal` stays unchanged for Coach/Analysis; StarChess uses an explicit variant prop or a thin `DeployModal` wrapper that reuses modal chrome + choice grid.

---
## Architecture

```mermaid
flowchart TB
  subgraph screen [NerdScreen]
    starChessMode["starChessMode prop"]
    fogGate["fogOfWar = starChessMode"]
  end

  subgraph starchess [apps/ui/src/starchess]
    types[types.ts]
    economy[economy.ts]
    actions[actions.ts]
    resolve[resolveTurn.ts]
    store[starChessStore.ts]
    hooks[hooks/useStarChessTurn.ts]
    anim[hooks/useStarChessAnimations.ts]
    vision[vision.ts]
    kingHp[kingHp in state]
  end

  subgraph ui [Board UI]
    ChessBoard
    animLayer[Attack animation overlays]
    kingFx[King damage FX]
  end

  subgraph verify [Verification]
    unitTests[apps/ui/tests/starchess]
    sb[Storybook attack stories]
    e2e[apps/e2e starchess section]
  end

  starChessMode --> store
  starChessMode --> fogGate
  fogGate --> ChessBoard
  store --> hooks
  hooks --> resolve
  resolve --> anim
  anim --> animLayer
  kingHp --> kingFx
  resolve --> unitTests
  animLayer --> sb
  screen --> e2e
```

**Do not** put StarChess turn resolution into `gameStore` / `useMoveExecutor`. Classical chess remains FEN + `chess.js` for Coach/Analysis/LAN. StarChess owns its own board snapshot + turn plans.

**FEN-compatible boards:** every StarChess position that renders on `ChessBoard` must be a valid FEN (including both kings). `chess.js` rejects kingless FENs, so Storybook seeds, fog demos, and live StarChess snapshots stay FEN-loadable even when rules diverge from classical chess. Divergences (king into fire, HP, mutual captures, deferred specials, …) are cataloged under [Classical / FEN-illegal scenarios](#classical--fen-illegal-scenarios-catalog) — never reintroduce classical check filters in `actions` / `resolveTurn`. Full SCFEN dialect + demo GIFs: [`STARCHESS_FEN.md`](STARCHESS_FEN.md).

---

## Package layout

```
apps/ui/src/starchess/
  index.ts
  types.ts
  constants.ts             # caps, costs, timeout, income, KING_MAX_LIVES=3
  economy.ts               # (todo) income, afford, deploy cap
  actions.ts               # (todo) ≤1 special + ≤1 classical; special timing; spawn
  board.ts                 # (todo)
  resolveTurn.ts           # (todo) specialBefore → attack → move → specialAfter
  vision.ts                # done — cumulative getSideVision
  starChessStore.ts         # (todo)
  hooks/
    useStarChessGame.ts     # (todo)
    useStarChessTurn.ts     # (todo)
    useStarChessAnimations.ts  # done — attack/death bus + playCaptured
  specials/                # (todo) long-press handlers; deferred FEN-illegal stubs
  animations/              # done — AttackAnimation, DeathAnimation, cues, Storybook harnesses
    …

apps/ui/src/starchess/primitives/
  icons.tsx                # MineralsIcon | VespeneIcon | SupplyIcon
  ResourceBar.tsx          # minerals + income | vespene remaining/cap | board deploy/50
  TurnBar.tsx              # End + circular 10s gauge (beside ResourceBar above board)
  DeployModal.tsx          # king special — ResourceBar + pawn-first choices
  SpecialPreview.tsx       # hover chat card (unit / special / description)
  specialCopy.ts           # knight/king copy + TBD stubs

apps/ui/src/starchess/features/
  GasDeploy.tsx            # footer gas rack — drag canister onto unit (store-backed)

apps/ui/src/components/primitives/
  PromotionModal.tsx       # classical promote (unchanged)

apps/ui/src/screens/
  NerdAttackAnimations.stories.tsx   # Screens/Nerd/StarChess/Attack Animations
  NerdDeathAnimations.stories.tsx    # Screens/Nerd/StarChess/Death Animations

apps/ui/tests/starchess/
  economy.test.ts
  actions.test.ts
  resolveTurn.test.ts
  kingLives.test.ts
  vision.test.ts             # done (also via utils re-export)

apps/e2e/
  tests/starchess/
    turn-rules.spec.ts
    king-lives.spec.ts
    material-income.spec.ts
    fog-of-war.spec.ts
    spawn-king-special.spec.ts
```

---

## Core types

```ts
type StarChessColor = "w" | "b";
type TurnPhase = "specialBefore" | "attack" | "move" | "specialAfter";
type SpecialTiming = "before" | "after";

/** Per-unit special (long-press). `spawn` = king only for v1 implementable path. */
type SpecialKind =
  | "spawn"           // king — purchase adjacent unit
  | "pawnDouble"      // Marine steps — classical double free; gas extra step (+1) shipped
  | "knightMine"      // deferred — once per knight; mine board model TBD
  | "bishopSnipe"     // Charon Booster Missiles — shipped (2 gas; ignore blockers)
  | "rookSiege"       // deferred — attack without moving
  | "queenWarp";      // Tactical Jump — shipped (2 gas; teleport to visible empty square)

type KingDamageState = "pristine" | "smallFire" | "bigFire" | "destroyed";
// lives 3 → pristine, 2 → smallFire, 1 → bigFire, 0 → destroyed

/** At most one special per player per turn. */
type QueuedSpecial = {
  id: string;
  color: StarChessColor;
  kind: SpecialKind;
  timing: SpecialTiming;
  from?: Square;       // acting unit (king for spawn; piece for abilities)
  to: Square;          // spawn tile / ability target
  unit?: PieceSymbol;  // spawn type (pawn..queen)
};

/**
 * At most one classical chess action per player per turn.
 * Resolved in two parts: attack (if capturing) then move (if unit still alive).
 */
type QueuedClassical = {
  id: string;
  color: StarChessColor;
  from: Square;
  to: Square;
};

type PlayerTurnPlan = {
  special: QueuedSpecial | null;
  classical: QueuedClassical | null;
};

type PlayerEconomy = {
  stored: number;    // 0..12
  deployed: number;  // 0..50 (king = 1)
};

type StarChessState = {
  turn: number;
  board: StarChessBoard;
  economies: Record<StarChessColor, PlayerEconomy>;
  kingLives: Record<StarChessColor, number>; // 0..3
  plans: Record<StarChessColor, PlayerTurnPlan>;
  locked: Record<StarChessColor, boolean>;
  phase: TurnPhase | "planning" | "resolving" | "gameover";
  winner: StarChessColor | null;
  turnDeadline: number | null;
  lastResolveEvents: ResolveEvent[];
};

type AttackAnimKind =
  | "pawnRifle"
  | "knightFrag"
  | "bishopGatlings"
  | "rookBattery"
  | "queenLaser"
  | "kingDualCannon";
```

---

## King damage states

| Lives | State | Presentation |
|---|---|---|
| 3 | `pristine` | Default king art |
| 2 | `smallFire` | Small fire animations over the king |
| 1 | `bigFire` | Large fire animations over the king |
| 0 | `destroyed` | Destroyed art; game over for that side |

**Hit rule:** during the **attack** half of classical resolution, each successful hit on a living enemy king decrements lives by 1. At 0 → destroyed → opponent wins.

**King attack animation** (king as attacker): hat flips → dual cannon battery (`kingDualCannon`). Independent of victim damage FX.

---

## Attack animations (v1)

Only **attack** animations ship in v1 (classical part 1). Cues from `ResolveEvent` with `phase: "attack"`:

| Unit | Animation |
|---|---|
| Pawn | Rifle fires (barrel light + cast shadow on pawn body) |
| Knight | Throws a frag grenade |
| Bishop | Attacks with the two gatling guns |
| Rook | Fires from the main tank battery |
| Queen | Fires a thick laser shot |
| King | Hat flips; dual cannon battery revealed and fires |

DOM hooks: `data-attack-anim="pawnRifle"` (etc.) for Storybook / Playwright.

---

## Turn lifecycle

```mermaid
sequenceDiagram
  participant P1 as PlayerW
  participant P2 as PlayerB
  participant Store as starChessStore
  participant Res as resolveTurn
  participant Anim as animationBus

  Note over Store: phase = planning
  P1->>Store: set special? timing before/after + classical?
  P2->>Store: set special? timing before/after + classical?
  alt both locked OR timeout
    Store->>Store: phase = resolving
    Store->>Res: resolve(plans, board, kingLives)
    Note over Res: specialBefore → attack → move → specialAfter
    Res-->>Store: board + events + kingLives + winner?
    Store->>Anim: play attack cues
    Anim-->>Store: done
    alt winner
      Store->>Store: gameover
    else
      Store->>Store: income, turn++, clear plans, planning
    end
  end
```

### Planning

- Edit `PlayerTurnPlan` by stacking actions (special and/or classical) until auto-submit, **End**, or timeout.
- Validation (`actions.ts`): ≤1 special, ≤1 classical; spawn adjacent + afford + deploy cap; classical must be a legal unit move/capture from current board.
- Timing is implied by stack order (special→move = before; move→special = after).

### Board chrome (replaces captures)

On `NerdScreen` when `starChessMode`: **no** `OpponentCaptures` / `PlayerCaptures`. One row above the board:

| Side | StarChess |
|---|---|
| Left (flex) | [`ResourceBar`](apps/ui/src/starchess/primitives/ResourceBar.tsx) — minerals, vespene, board-derived deploy |
| Right | [`TurnBar`](apps/ui/src/starchess/primitives/TurnBar.tsx) — **End** + circular seconds gauge (`TURN_TIMEOUT_MS` = 10s) |

### Resolution order

Deterministic within each phase: white then black (then by `id` if needed).

1. **specialBefore** — specials with `timing: "before"` (king spawn, etc.).
2. **attack** — for each classical action that targets an occupied enemy square (or king hit): two-pass mark → apply. Mutual classical captures both succeed. King targets decrement `kingLives` only when `to === enemyKingSquare` with clear pre-move geometry ([rule §11](#rules)). Uncovering / arriving on a king ray does **not** chip HP here.
3. **move** — for each classical action whose `from` unit still lives: move to `to` if empty / allowed after attacks. Capturing units that already removed the target and survive step onto `to`. Non-king pieces never step onto the enemy king’s square (HP damage only).
4. **specialAfter** — specials with `timing: "after"`.

Example — mutual pawn captures, no specials:

| Phase | Result |
|---|---|
| specialBefore | — |
| attack | Both pawns marked dead / removed |
| move | Both classical moves skipped (units gone) |
| specialAfter | — |

Example — white special spawn before, black special after, both classical non-captures:

| Phase | Result |
|---|---|
| specialBefore | White spawn resolves |
| attack | no-op |
| move | Both pieces relocate |
| specialAfter | Black special resolves |

### Income (after resolution, if no winner)

```ts
base = turn <= 10 ? 1 : turn <= 20 ? 2 : 3
idle = plan.special == null && plan.classical == null
gain = idle ? floor(base * 1.5) : base
stored = min(12, stored + gain)
```

---

## Fog of war gate

**Non-negotiable:** StarChess / Nerd gameplay **always** has cumulative fog of war. There is no `fogOfWar={false}` escape hatch while `starChessMode` is on.

- `starChessMode?: boolean` on `NerdScreen` (default `true` on `/starchess`).
- `fogOfWar = starChessMode` — when mode is on, fog is forced on.
- Maps / terrain gallery (`Screens/Nerd/StarChess/Maps`) sets `starChessMode: false` so board skins can be previewed without fog (not gameplay).
- Vision lives in [`starchess/vision.ts`](apps/ui/src/starchess/vision.ts) (re-export from [`utils/nerdVision.ts`](apps/ui/src/utils/nerdVision.ts)).

### Cumulative vision (not selected-unit)

Fog is cleared by the **union of vision from every friendly unit still on the board** for the viewing side. Selecting a unit does **not** switch the fog mask.

- `getUnitVision(board, square)` — per-piece geometry (unchanged rules: king 3×3, pawn wedge, knight truncated 5×5, bishop 5×5 + queen ping, rook/queen 7×7).
- `getSideVision(board, color)` — unions `litSquares` / `revealedPieces` across all pieces of `color`.
- Board rendering always uses `getSideVision` for the local player (e.g. white on Nerd demos).
- Empty army ⇒ full fog (no lit tiles). Own pieces remain visible through fog as today; enemies stay hidden unless on a lit tile or in `revealedPieces` (bishop queen-ping still contributes when any friendly bishop sees them).
- **Attack-time reveal:** while an `attackCue` is active, `ChessBoard` adds that cue’s `from` to `revealedPieces` so a shooter under fog appears for the shot only (fog punishment until they fire).
- **Fog = player info only.** The engine always resolves both sides’ plans; quiet enemy relocates under fog still happen — they just get **no mover VFX** for the local player (`isPieceVisibleToSide`).

**Migration:** drop `visionSource` / `initialVisionSquare` as the fog driver. Storybook fog stories seed positions via FEN only; the mask updates whenever the board (or side) changes. Optional selection highlight may remain for UI, but it must not scope fog.

Per-piece vision rules themselves are unchanged; only the aggregation model changes.

---

## Screen wiring

```tsx
if (props.starChessMode ?? true) {
  useStarChessGame({ startingFen: props.startingFen ?? NERD_STARTING_FEN });
} else {
  loadFen(props.startingFen ?? NERD_STARTING_FEN);
}

<ChessBoard
  fogOfWar // always when starChessMode — not optional
  kingDamage={starChessMode ? kingDamageStates() : undefined}
  attackCue={starChessMode ? currentAttackCue() : undefined}
/>
```

UI chrome (v1): `ResourceBar` + `TurnBar` side-by-side above the board (no captured pieces); fog always on; long-press → special ([Special moves](#special-moves)).

---

## Verification loops

Every feature: **unit → Storybook (visual) → e2e**. Done only when the loop passes.

```mermaid
flowchart LR
  impl[Implement feature] --> unit[Vitest starchess/]
  unit --> sb[Storybook assert / review]
  sb --> e2e[apps/e2e/tests/starchess]
  e2e --> done[Feature done]
```

### 1. Unit / integration (`apps/ui/tests/starchess/`)

| Feature | Tests |
|---|---|
| Economy | Income tiers, idle 1.5× (no special + no classical), caps, costs |
| Vision | `getSideVision` unions all friendly units; not selection-based; per-unit geometry still covered |
| Actions | Reject 2nd special / 2nd classical; timing required; spawn rules |
| resolveTurn | specialBefore vs specialAfter ordering; mutual classical pawn captures both die; move skipped if dead; king HP |
| King lives | 3→2→1→0 + winner |

### 2. Storybook (animations + king damage)

**Title:** `Screens/Nerd/StarChess/Attack Animations`

| Story | Asserts |
|---|---|
| `PawnRifle` … `KingDualCannon` | Per-unit `data-attack-anim` hooks |
| `KingDamagePristine` … `Destroyed` | `data-king-damage` for all four states |

Play functions fire one cue and assert DOM. Visual review required for animation PRs.

### 3. E2E (`apps/e2e/tests/starchess/`)

| Spec | Verification loop |
|---|---|
| **`turn-rules.spec.ts`** | Canonical turn: one special (before) + classical captures that mutually destroy; assert phase order, both pawns dead, income, turn++, plans cleared; also cover special-after ordering |
| **`king-lives.spec.ts`** | Three king hits → damage states → winner |
| **`material-income.spec.ts`** | Idle bonus + tier boundaries + cap 12 |
| **`fog-of-war.spec.ts`** | Mode on/off; cumulative vision grows/shrinks with army (multi-unit FEN lit set = union, not single piece) |
| **`spawn-king-special.spec.ts`** | Spawn as the single special (before/after), cost/cap/adjacency |
| **`attack-anims.spec.ts`** (optional thin) | Smoke `data-attack-anim`; detail in Storybook |

### Definition of done (per feature)

1. Pure tests green under `apps/ui/tests/starchess/`.
2. Pixels (attack anim, king fire): Storybook story + play assertion green.
3. Turn/economy/HP rules: matching `apps/e2e/tests/starchess/*.spec.ts` green.
4. `starChessMode` gate covered.

---

## Implementation order

1. ~~Scaffold `starchess/`~~ **done**
2. ~~SCFEN parse/format + `addScAction` + `endScTurn` + demo stories~~ **done** ([STARCHESS_FEN.md](STARCHESS_FEN.md))
3. **SC-LIVE-1** — live NerdScreen queue ↔ End
4. **SC-BASELINE-1** / **SC-SPECIAL-1** — deep validators
5. **SC-COLLISION-1** — king-shot / ray collision after `B`
6. **SC-MINE-1** + **SC-MINE-ANIM-1** — Spider Mine model + Storybook Fog/Attack/Death
7. Economy / spawn e2e polish; rook attack-without-moving later

---

## What stays outside `starchess/`

- ChessBoard shell, terrain CSS, piece sets
- `NERD_CAPABILITIES`, unlock / identity
- Classical `gameStore` / `useMoveExecutor`
- Storybook/e2e runners

---

## Non-goals (v1)

- Networked multiplayer / LAN for StarChess
- Multiple specials or multiple classical actions per turn
- Persisting StarChess matches to `gameHistoryStore`
- Replacing Coach/Analysis chess engine
- Resolving rook **attack-without-moving** (siege toggle is separate and shipped in demos)

---

## Roadmap

### Done

**Cumulative fog of war** — shipped (`starchess/vision.ts`).

**`starchess/` animation package + ChessBoard cues** — Attack / Death / Deploy / Jump / Charon / Combat Chain / King Hunt.

**SCFEN engine slice (2026-08-03)** — see [`STARCHESS_FEN.md`](STARCHESS_FEN.md) shipped table:
- Parse/format `G:` + `Q:` + `U:`; `addScAction` / `endScTurn`; history/replay; TurnBar queue badges; Combat Chain & King Hunt engine-driven demos.
- Rename Brood War → StarChess complete under `apps/ui`.

**Turn chrome + action stack notes** — ResourceBar + TurnBar; stack order sets before/after.

### Next (pending — mirrors SCFEN ticket board)

1. **SC-LIVE-1** — Live `/starchess` `NerdScreen`: gestures → `queueScAction` / planning snap; End/timeout → `endPlanningTurn` + combat VFX (remove `resolveOnEnd={false}` stub).
2. **SC-BASELINE-1** / **SC-SPECIAL-1** — deep validators on classical baseline + per-kind special legality (incl. mine cap ≤2).
3. **SC-COLLISION-1** — attack-phase retarget for king-shots after `B` blockers ([rule §16](#rules)).
4. **SC-MINE-1** — Spider Mine board model + SCFEN `M:`; path/stand/friendly-fire triggers in `endScTurn`.
5. **SC-MINE-ANIM-1** — Storybook Fog / Attack (path collide) / Death (shared explosion).
6. Economy polish + e2e (`turn-rules`, `king-lives`, `spawn-king-special`, …).
7. Rook attack-without-moving (still deferred).
