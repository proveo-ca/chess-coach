# Published October 3 implementation archive

## Payload identity

- MAIN source commit: `46c5106864e985065451abb3d5cf8bcad521e57d`.
- Archive prefix: `_spec/_refactors/pr47-recovery/published-oct3/`.
- Count: **15 files**, comprising eight implementation modules, six test files, and one test fixture helper.
- Total payload: **61,351 bytes**.
- Each destination equals the archive prefix followed by the full original path in the tables below.
- Each payload matches its MAIN blob before and after the move.
- Sorted path-NUL-payload aggregate SHA-256: `3679c4544dc82ccad6cb12199087b017b12777e9986a0372ec186c82af3135db`.
- The fixture helper's tracked name is `candidateFixtures.ts`.
- These frozen files retain their original imports, comments, and test expectations.

## Move and responsibility map

| Full original path | Purpose | Current canonical counterpart |
| --- | --- | --- |
| `packages/starchess-arena/src/__tests__/intentCodecV1PublicWire.test.ts` | Public V1 metadata, action fields, keys, spend, pass, caps, detachment, unsafe DTO rejection, and zero-own-CC encoding | `packages/starchess-arena/src/__tests__/intentCodecV1Bridge.test.ts`; `packages/starchess-arena/src/__tests__/forkCompatibility.test.ts` |
| `packages/starchess-arena/src/__tests__/observationsV1Bridge.test.ts` | Public V1 roundtrips, zero-own-CC acceptance, sighting memory, descriptor guards, consistency, and resource endpoints | `packages/starchess-arena/src/__tests__/observationV1Bridge.test.ts`; `packages/starchess-arena/src/__tests__/forkCompatibility.test.ts`; `packages/starchess-arena/src/__tests__/challengeObservationCodec.test.ts` |
| `packages/starchess-arena/src/__tests__/publicV1PureClosure.test.ts` | Package resolution and transitive pure runtime imports | `packages/starchess-arena/src/__tests__/publicV1BridgeIsolation.test.ts`; `scripts/check-public-closure.mjs` |
| `packages/starchess-arena/src/authorized/v1/candidateWire.ts` | Legacy candidate action validation, canonical keys, requested spend, decoding, and ranking | `packages/starchess-arena/src/challengeContract/candidateWire.ts`; `packages/starchess-arena/src/intent-codec-v1.ts` |
| `packages/starchess-arena/src/authorized/v1/guard.ts` | Descriptor-first public DTO shape validation | `packages/starchess-arena/src/challengeContract/validation.ts` (`inspectDto`); public wrappers in `observations.ts` and `intent-codec-v1.ts` |
| `packages/starchess-training/src/__tests__/candidateFixtures.ts` | Authorized observations, action helpers, and test-only full native snapshots | `packages/starchess-training/src/__tests__/fixtures.ts`; native probes in `packages/starchess-training/src/__tests__/candidates.test.ts` |
| `packages/starchess-training/src/__tests__/candidateIdentity.test.ts` | SHA vectors, unsigned UTF-8 ordering, forced collisions, and caller-byte mutation | `packages/starchess-training/src/__tests__/candidateIdentityOwnership.test.ts`; identity vectors in `packages/starchess-training/src/__tests__/candidates.test.ts` |
| `packages/starchess-training/src/__tests__/candidateOwnPrefix.test.ts` | Prune priority, funding edges, append-time reservations, native occupancy exceptions, and prefix branch ownership | `packages/starchess-training/src/__tests__/domain.test.ts`; `packages/starchess-training/src/__tests__/candidates.test.ts`; `packages/starchess-training/src/__tests__/candidatesHistoryV2.test.ts` |
| `packages/starchess-training/src/__tests__/candidatePrimitives.test.ts` | Seven-family primitive geometry, deterministic enumeration, deployments, Charon anchors, jump targets, and structural promotions | `packages/starchess-training/src/__tests__/domain.test.ts`; generator expectations use the accepted native-four promotion set |
| `packages/starchess-training/src/candidates/canonicalIdentity.ts` | Noble-backed hashing and canonical identity buckets | `packages/starchess-training/src/identity.ts` (`jssha/sha256`, owned typed-array copies); ownership tests |
| `packages/starchess-training/src/candidates/compose.ts` | Bounded candidate composition, funding pools, queue identity, and diagnostics | `packages/starchess-training/src/composition.ts`; public `packages/starchess-training/src/candidates.ts`; composition kernel and batch tests |
| `packages/starchess-training/src/candidates/input.ts` | Authorized input validation and current planning knowledge | `packages/starchess-training/src/domain.ts` (`planningKnowledge`); validation in `packages/starchess-training/src/composition.ts` |
| `packages/starchess-training/src/candidates/ownPrefix.ts` | Prefix guards, cost accumulation, and mine reservations | `packages/starchess-training/src/domain.ts` (`appendFailure`, `appendState`); domain and counted-history tests |
| `packages/starchess-training/src/candidates/primitives.ts` | Ordered primitive intent generation | `packages/starchess-training/src/domain.ts` (`primitiveDomain`); domain tests |
| `packages/starchess-training/src/candidates/types.ts` | Composition version, limits, kind/lane/pool types, batch and diagnostics contracts | `packages/starchess-training/src/contracts.ts`; compatible exports in `packages/starchess-training/src/candidates.ts`; typed import fixture in `packages/starchess-training/src/__tests__/closure.test.ts` |

## Assertion dispositions

- Live public V1 codecs accept zero or one own CC.
- Live legacy-private V1, V2, and native/R3 boundaries require exactly one own CC.
- Live public wire metadata includes `CANDIDATE_CODEC_VERSION`.
- Live training exports preserve the old composition constants and `Kind`, `Lane`, and `PoolRecord` names alongside V2 history composition.
- Live identity tests cover caller mutation, forced digest collisions, intrinsic typed-array copying, independent SHA vectors, and pinned complete-batch bytes.
- The comparison ports the million-byte SHA vector and explicit unsigned/prefix/Unicode byte-order assertions into the canonical identity ownership tests.
- The comparison ports stale unknown-cell sighting retention into the canonical observation bridge tests.
- The comparison ports all five structural wire unit/promotion field choices into the canonical wire tests.
- The comparison ports exact cumulative funding edges and independent branch reservation ownership into the canonical domain tests.
- Wire representability permits `p` promotion fields.
- Native candidate generation emits only `n`, `b`, `r`, and `q` promotions.
- The archived five-promotion generator expectations record superseded behavior.
- The archived closure test's `@chess-coach/starchess-core/rules` edge records a superseded module boundary.
- Current model runtime imports use the approved `planning-v1` leaf.

## Canonical source equality

Raw-byte comparison with `/tmp/opencode/chess-coach-r3-recovered` covers the three production `src/` trees after excluding test directories.
All **136 production files** match REC: core 82, arena 49, and training 5.
The comparison reports zero missing, extra, or changed production files.
The assertion ports modify live tests only.

## MAIN blob and raw-byte proof

The Git blob SHA identifies the original MAIN object.
The SHA-256 column hashes the original raw file bytes.
Post-move verification compares each archived file directly with `git show <MAIN>:<original-path>` and checks the same hashes.

| Full original path | MAIN Git blob SHA | Raw-byte SHA-256 |
| --- | --- | --- |
| `packages/starchess-arena/src/__tests__/intentCodecV1PublicWire.test.ts` | `f70645a35d7de8b2dd05ed870d661a5cad23a7a5` | `e19f779bd5e5528de23345b8c12cb027d8bca39e85cf980015c6ad64ed8adce8` |
| `packages/starchess-arena/src/__tests__/observationsV1Bridge.test.ts` | `5214a12a5654a79ec869c1755ec5744323e6a119` | `d49f7967de952e5e42fb0f2437d631882bea68c7232cdfac3634bb6b5bd74926` |
| `packages/starchess-arena/src/__tests__/publicV1PureClosure.test.ts` | `809c3d575e861608e742478957ebe8fcea55ed90` | `550205888e357ce4b944c459a1b2f781627acdf4745714f339731edb74bd76b3` |
| `packages/starchess-arena/src/authorized/v1/candidateWire.ts` | `1d69912fc1edee40a9b94b8336c755d3058d6809` | `16555b378f494a7bbd95678cfbcafb2993c58052d4d4fb67af36d48f85510a40` |
| `packages/starchess-arena/src/authorized/v1/guard.ts` | `750460962dddec64fdfcbc48c25f6d74e8f63bfc` | `bc561081adebad4728c4b14e495563a3f8e4dc9dafa8c2ef24332d3ab6ac2e7c` |
| `packages/starchess-training/src/__tests__/candidateFixtures.ts` | `c89b0977a3db6b17191b22536dcfc5f3651aab42` | `fbbc333feb216f7226d8d69e0824a3decaab0b3f435e43bf45e15b078abc1df3` |
| `packages/starchess-training/src/__tests__/candidateIdentity.test.ts` | `0e0dbae14ab0cad0a4124087a25c732a149c59cf` | `a299e6b6cb201a26724a7234fb5a229f493603c8cfde4684650a3262aa08ac20` |
| `packages/starchess-training/src/__tests__/candidateOwnPrefix.test.ts` | `5a015feb96e0b9638f9d39c7c41335af0d229242` | `493ed08e22d545febdbd61f1b16786e48ccef873e3549f8a50da52409c58ddce` |
| `packages/starchess-training/src/__tests__/candidatePrimitives.test.ts` | `ac798af12b97370b325f56b6c322cc4c7722375b` | `4a56f306f8d29de0ebd30728376ae9e9c0f436ba1c7ae0e5c3ff9f5dd777936b` |
| `packages/starchess-training/src/candidates/canonicalIdentity.ts` | `840e69ff8eae6a62a15665ec3c1feaa574323fdd` | `e0bdd46a22059ca535c8ca9edfef2f070cf9207ec76e4558a00f08b0bd4afe47` |
| `packages/starchess-training/src/candidates/compose.ts` | `fc1622099e123a3e2031cfb4091ab06b507a9757` | `9c4403ff7527f0c639712cb940064f3fed6bf197eb017013089f7678a74da6bb` |
| `packages/starchess-training/src/candidates/input.ts` | `63b30a354338615150f988c48af62b76eb5edb22` | `49ae33dc14cee97c300983a8e9ac7ab9a28cf76988b7181a052dec5d1fdd6df3` |
| `packages/starchess-training/src/candidates/ownPrefix.ts` | `8e8f9893e4e955de4cbcf934f0a74ca946d51dd0` | `59708fa9dbfbf2d43c348fc526be20380ab41eac68a7c810a6e5150f46f46ef8` |
| `packages/starchess-training/src/candidates/primitives.ts` | `1eec5ecd8f7da14583e5a70b99871560bf48aefd` | `a02242f25e5a6455f38c43cf5ace7a732a567627575d2180fadcca4d6e624609` |
| `packages/starchess-training/src/candidates/types.ts` | `707908d89362d4cedee388f1201de8604f0c2b28` | `81883ce2a904a7c2727e40918b3af826ee766f0c1086bb6710f03b01c1377518` |
