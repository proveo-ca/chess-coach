# Bounded recipient candidate enumeration

## Approved replacement

The operator selected a newly versioned deterministic bounded enumerator instead of preserving the old eight-lane, fixed-family-quota selection policy. This intentionally changes which eligible alternatives reach scoring. Do not claim candidate coverage or checkpoint-selection equivalence with the reference generator.

`chess-coach.enumeration.v1` uses ordinary arrays, sets and lazy JavaScript generators. It retains pass first, at most four ordered actions, at most 512 unique candidates including pass, and at most 4,096 attempted primitive extensions. The attempted-extension cap is an algorithm bound, not the retired DIRECT meter or production OS-resource admission.

## Deterministic search

Enumerate file-major, own-side-forward squares: white ranks 1–8, black ranks 8–1. Within each action family, enumerate original actor squares, B before F, destination squares and fixed spawn/promotion orders. At each prefix, cycle classical/deploy/stim/mine/Charon/siege/jump generators one yielded primitive at a time. Remove exhausted generators. Do not assign fixed family retention quotas, maintain ownership lanes or redistribute capacity.

Cycle prefix depths 0–3. Within each depth, rotate live prefix generators through a FIFO queue, yielding at most one primitive before rotating that prefix. Accepted unique prefixes enter the next depth's queue. This interleaves short and composed alternatives without exhausting every one-action move before exploring longer queues. Traversal stops on candidate capacity, attempted-extension capacity or exhaustion. An own dead CC or the canonical turn cap returns terminal pass without searching. Return candidates in discovery order, with pass at index 0. Ordering belongs to this enumeration version, not JSON wire semantics.

Use `JSON.stringify` on the schema-normalized generated action arrays for an in-memory `Set` key. Do not add a custom canonical serializer, byte-hash index or semantic key to the wire contract. Close outstanding generators on completion. Live prefix state remains bounded by the retained candidate count; each prefix's primitive domain is finite on the 64-square board.

## Recipient eligibility

Decode the standard observation once. Use current lit/dark-revealed pieces, own pieces, own mines and own siege state. Memory does not become current occupancy. Do not read a simulator snapshot, hidden mines, opponent queues, replay labels, future outcomes or authoritative queue refusal results.

Primitive actions use canonical shape, spawn, promotion and special-anchor rules. Before retaining each extension, check known append constraints, cumulative requested minerals/gas, own mine capacity and distinct known mine anchors, and insertion/result native classical dependencies. Check own siege and promotion requirements using known facts only. Resource checks do not predict refunds, income, opponent losses or speculative deployment success.

These are eligible planning alternatives, not a promise that every action succeeds during simultaneous resolution. Unseen blockers, collisions, deaths and paid-but-unmaterialized deployments remain resolver/provenance concerns. Mineral debits and paid receipts still require a trusted producer; enumeration does not mutate either.

## Compatibility and authority

Keep `chess-coach.candidate.v1`, `chess-coach.features.v1`, and the existing Burn model architecture unchanged. The new enumeration version identifies selection behavior independently. The reference eight-lane generator and its 2,048-extension cap do not migrate. No game-data collection, training, further Docker execution, production host operations, deployment or publication follows from this source decision.

## Verification scope

Persisted tests verify deterministic output, pass, all seven action families and depths 1–4 in a rich fixture, per-prefix recipient/resource/dependency constraints, mine caps, mirrored-side discovery order, stale-memory noninterference, terminal pass and all three nonterminal stopping boundaries. The golden fixture pins this new contract's discovery order; it does not claim equivalence with the retired selection algorithm. The native process e2e consumes actual enumerated candidates before feature encoding and Burn scoring.

The rich synthetic fixture retains 512 candidates after 646 attempts. Its zero-resource variant stops at 4,096 attempts with 42 candidates. The blocked terminal-rank fixture exhausts after 69 attempts with pass only. Those are regression cases, not production performance measurements or universal family/depth coverage guarantees. Future training episodes and evaluator runs must record the enumeration version alongside their immutable model/feature identities.
