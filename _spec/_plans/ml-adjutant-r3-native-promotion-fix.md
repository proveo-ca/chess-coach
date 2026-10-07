# ML Adjutant — R3 native gas-promotion correction

Status: **PROPOSAL / NOT APPROVED / NOT IMPLEMENTED.** Executor selected **“Native-fix proposal (Recommended)”** for the source-derived ownership conflict recorded in [R3 seam finding R3-SEAM-01](ml-adjutant-r3-seam-addendum.md#101-first-pass-findings-and-replacement-disposition). That selection authorizes drafting/review, not native changes or test execution. Exact-text acceptance and explicit build authorization remain pending.

## 1. Exact scope

Modify only `applyGasPromotion` in [native submit-turn](../../packages/starchess-core/src/resolve/submit-turn.ts). Add a current-occupant type/color guard immediately before the actual promotion write. Keep the helper signature, normal native API/result schemas, imports/exports, prices, gas/mineral expenditures, admission grammar, movement and mine processing unchanged.

```ts
const lastRank = a.color === "w" ? 8 : 1;
if (!survived || Number(at[1]) !== lastRank || !a.promotion) return;

const current = placementToMap(placement).get(at);
if (!current || current.type !== "p" || current.color !== a.color) return;

placement = placeUnit(placement, at, {
  type: a.promotion,
  color: a.color,
});
gasPromotions.push({
  color: a.color,
  from: a.from,
  at,
  unit: a.promotion,
});
```

Eligibility becomes exactly `survived ∧ lastRank ∧ promotionPresent ∧ current.type='p' ∧ current.color=a.color`. Read `current` after arrival/held-mine processing. A false predicate performs no promotion write and appends no promotion record. Issue no refund or suppression event.

This intentionally changes native result values when the current occupant is absent, non-Marine or an opponent. It can change subsequent boards, vision, promotions, `specialsUsed` and outcomes. It is not a native-result-equivalent refactor. Companion parity compares against the separately approved corrected native resolver, not the pre-correction resolver.

## 2. Identity and call-site boundary

Immediate B and held B fallback share this helper. F's inline sequence already checks the actual actor's own side and Marine type; C promotion already checks the landed Marine's side. Keep F/C code unchanged and verify them as controls.

Do not pin promotion to the held step's original entity ID. Current same-side replacement Marine promotion remains supported. Transform the actual live replacement lineage and preserve its paid basis. Never resurrect the crushed original lineage.

Identity pinning, broader B/F replacement-actor changes and movement repairs require another proposal. This guard establishes ownership-preserving Marine writes, not general ownership-transfer semantics.

## 3. Exact reproduction fixture

**[Inference] The expected transitions below derive from inspected source; no native reproduction or test has executed.**

Opening:

```text
SCFEN|5p2/4Pk2/8/8/8/8/8/K7|0|33|P|G:11:11|B:3:3|Q:w:;b:
White: CC a1, Marine e7
Black: CC f7, Marine f8
Mines: none; siege flags: none
```

Run Begin. Stage both queues against that same opened state using per-seat intents WITHOUT `seq`. For the array below, remove `seq` and group by color to obtain those staging inputs. Commit White's intents then Black's intents using normal native append. Call End with `skipTurnStartChecks:true`.

Expected merged committed queue AFTER successful native append:

```json
[
  {"kind":"stimStep","timing":"B","color":"w","from":"e7","to":"e8","promotion":"q","seq":0},
  {"kind":"classical","timing":"C","color":"w","from":"e7","to":"f8","promotion":"q","seq":1},
  {"kind":"deploy","timing":"B","color":"b","from":"f7","to":"e8","unit":"p","seq":2}
]
```

White's B step moves its endowed Marine to e8 and holds its promotion for C continuation. Black's B deploy crushes it and creates a paid Black Marine at e8. White's diagonal C does not receive the forward B rewrite. The held fallback sees the Black replacement. The proposed guard performs no White promotion. C finds no White actor on e7.

| Native field | Pre-correction expectation | Proposed expectation |
|---|---|---|
| Begin / `afterPending` placement | `5p2/4Pk2/8/8/8/8/8/K7` | Same |
| `afterB` / resolved attack, move, all / final placement | `4Qp2/5k2/8/8/8/8/8/K7` | `4pp2/5k2/8/8/8/8/8/K7` |
| `resolved.promotions` | White `{color:'w',from:'e7',at:'e8',unit:'q'}` | `[]` |
| Next turn / phase / lives | `1` / `P` / `{w:3,b:3}` | Same |
| Next gas / gasIncome / queue | `{w:0,b:0}` / `{w:1,b:1}` / `[]` | Same |
| `next.specialsUsed` | `['f7']` | `['e8','f7']` |

The `specialsUsed` difference follows the existing promotion-record cleanup. Do not compensate for it outside this scope.

The two B events remain the White stim and Black deploy with crushed White `p` victim. `bMoves` remains one White `p` move `e7→e8`. Classical moves, attacks, collision/path/mine arrays and F moves remain empty. Host commit bank is `{w:3,b:2}` and gas is `{w:0,b:0}`. Existing turn-1 settlement income gives host bank `{w:4,b:3}`. Native stored extras do not replace the separate host bank.

The Black receipt remains materialized with surviving basis `1`. White's endowed Marine remains retired with basis `0`. Do not invent a second birth, ownership transfer or destruction for the unperformed promotion.

## 4. Required meaningful verification

Proposed persisted fixture owner: `packages/starchess-core/src/__tests__/gasPromotionOwnership.test.ts`.

| Case | Independent assertion |
|---|---|
| Exact held-opponent fixture | Native admission succeeds; guard preserves Black replacement, suppresses only invalid promotion and preserves resources/prior events. |
| Same-side replacement | Turn 11, own CC f7/Marine e7, enemy CC a8/Marine f8; own B stim e7→e8 q, B deploy f7→e8 p, C e7→f8 q. Purchased own replacement still promotes and retains actual basis/identity. |
| Immediate B opponent replacement | White deploys over Black's authored Marine origin before Black's B step. Existing movement may move the replacement; Black promotion cannot recolor it. |
| Absent / non-Marine / opponent occupant | No promotion write/record; no extra refund or altered admission/mine processing. |
| Legitimate immediate/held B both colors | Valid own Marine promotion remains exact. A simple seat mirror is not an equivalent held-opponent fixture because B resolves White before Black. |
| Mine death | No promotion after actual removal. |
| Existing F/C promotion controls | Native results, queue grammar, expenditures and replacement behavior remain consistent with the scoped guard. |

After explicit build authorization, run the focused fixture, strict test-file typechecking, full core suite/typecheck and affected arena/training regressions. Run the public-closure/inventory checks required by the integrated R3 change. These are proposed checks, not measured results.

## 5. Specification and evidence boundary

Update existing native resolve/submit-turn diagrams only after the source change lands. Keep frozen approved bodies and historical corpus/evidence bytes unchanged. Corrected native rules/source identities differ from R2's captured source. New replay comparisons must disclose changed semantics rather than rewriting old expectations. Refreshed capture/publication requires a new authorized generation/namespace.

This correction supplies no R4 estimator/features, R5 readiness, calibrated model, collection/fitting/transfer permission, R6 training or registry activation.

## 6. Review / approval ledger

| Review | Task / status | Scope |
|---|---|---|
| Architect author consultation | `ses_eec78096cffeMkpMxeH0Yz2wt6` | Read-only guard/fixture/carrier guidance; no native execution. |
| Closing architecture/backend review | Pending | Exact guard, reachable fixture, scoped behavior and preserved replacement handling. |
| Earlier paired security/spec review | `ses_eec4b5c3dffeuiVNlh9BpgideH`, `ses_eec7808f6ffed4yCzKVOuYK5fZ` | Target-only pair cleared at design level before later mine/dependency revisions; no executed fixture. |
| Closing adversarial/security review of latest pair | Pending | Exact persisted proposal paired with final multiplicity/count/dependency seam. |
| Spec review | Pending | Explicit native amendment, immutable history and stage/approval boundaries. |
| Executor exact-text acceptance / build authorization | Pending | Direction selection is neither grant. |

Final closing clearance for the latest paired revision remains pending. No source change or executed fixture is claimed.
