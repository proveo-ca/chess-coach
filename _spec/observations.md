# Recipient-local observation contract

## Decision

The operator selected a new standard schema, not exact V2 wire compatibility. The new version is `chess-coach.observation.v1`. Preserve recipient-local visibility, own lineage, paid receipts and economic conservation. Do not migrate the old canonical serializer, reflective DTO walker, version adapters or authorization runtime.

Zod 4.6.7 owns shape validation, TypeScript inference, parsing copies, readonly output and JSON Schema 2020-12 conversion. `JSON.parse` / `JSON.stringify` own serialization. The untrusted entrypoint accepts bounded JSON text, not executable JavaScript objects or arbitrary host references. Whitespace and object-key order do not carry meaning. Legacy canonical bytes and duplicate-key rejection are not promised; standard JSON parsing retains the last duplicate key.

`observationJsonSchema` describes field shape only. Standard JSON Schema cannot express all cross-record relationships. `semantics.ts` checks domain invariants after structural validation. A Rust consumer must implement those invariants or consume only a trusted validated producer before claiming equivalent validation. No Rust contract consumer exists yet.

## Preserved invariants

- Exactly 64 file-major cells distinguish unknown, lit empty/occupied and dark-revealed enemy BattleShips.
- Own pieces match lit cells and include one Command Center. Hidden cells contain no occupancy field.
- Memory belongs to the recipient, excludes own pieces, records no future sighting and reconciles with current visible cells.
- Ever-lit history stays sorted and contains every currently lit cell without treating dark BattleShip pings as light.
- Own gas cannot exceed its current income. Mines light their cells; siege mode belongs to own Tanks.
- Side-local unit identities survive movement and transformation. Opening units have zero paid basis. Created identities follow paid deployment order and never reuse retired identities.
- One paid receipt per planning turn records the action reference and canonical mineral cost. Materialized receipts map to live or retired created identities; unmaterialized receipts remain wasted paid spend.
- `paidDebits = paidSurviving + paidDestroyed + paidWasted`, with totals derived from receipts and live/retired lineage.
- Replacement values use the current unit type, excluding CC value. Enemy loss remains witnessed-only with unknown upper bound and zero paid lower bound.
- Own mine lineage matches the own mine set with side-local identities.
- Arrays, counters, strings and JSON input have explicit bounds. The byte cap remains 1,048,576; it is an input-size bound, not a runtime economic meter.

## Authority boundary

A structurally and semantically valid observation does not prove that the simulator withheld hidden information or observed a genuine event. The trusted producer must derive cells, memory, lineage and receipts from the canonical resolver and recipient-specific provenance. Do not infer enemy facts from hidden occupancy. No production observation builder, event reconciler, learner/game transport or training authority ships in this slice.

## Verification

The two observation test files pass 54 tests, including the recipient JSON-to-planning e2e case. The full Bun workspace passes 238 tests after adding queue rules, collision prerequisites, candidate enumeration, inference, feature encoding and process e2e coverage. Strict TypeScript checks source and tests. The fixtures stay mutable for rejection tests; decoded production observations remain readonly and detached. Zod is the sole external TypeScript runtime dependency. Public npm resolution used the fresh anonymous development home with lifecycle scripts disabled.

## References

- https://zod.dev/api
- https://zod.dev/json-schema
- https://json-schema.org/draft/2020-12/schema
- Read-only semantic reference: `packages/starchess-arena/src/authorized/v2/observation.ts` and `types.ts` at `b4b241481fb12de4a7344e6dba8eda775af57675`.
