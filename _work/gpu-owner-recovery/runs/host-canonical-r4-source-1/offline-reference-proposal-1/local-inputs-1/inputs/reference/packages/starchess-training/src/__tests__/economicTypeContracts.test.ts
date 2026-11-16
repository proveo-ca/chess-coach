// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { describe, expect, it } from "vitest";
import type {
  AuthorizedHistory, AuthorizedSnapshotV2, ObservedCell, ReconciledBoundaryState,
  Side as ArenaSide, Sighting, Square as ArenaSquare,
} from "@chess-coach/starchess-arena/observations";
import type { EncodedCandidate } from "@chess-coach/starchess-arena/intent-codec-v1";
import * as contracts from "../economic/contracts";
import type {
  Bin, ByteRef, Candidate, Cells, CheckedBoundary, Component, Configuration418,
  Economic12, EconomicArtifact, EconomicAuthority, EconomicBeliefState, EconomicBinding,
  EconomicPin, EconomicReadout, EconomicRecipe, EstimatorProvenance, EvidenceRow, EvidenceTable,
  FeatureBlocksV3, FeatureManifestV3, Float64Hex, H, History, HostLimits, ManifestEntry,
  MeaningId, Memory, Meter, Position84, PrivateEconomicRequestV2, Promotion36, PromotionName,
  PublicOpening, Queue34, Ref, ScaleId, Scales, Side, Square, Table, TrainingRecipeV2,
  TransitionRow, TransitionTable, Versions418,
} from "../economic/contracts";

const queueNames = [
  "pass", "actionCount", "requestedMinerals", "requestedGas", "timing.BCount", "timing.CCount", "timing.FCount",
  "mineralMargin", "gasMargin", "nominal.deployCrushOwnPaid", "nominal.deployCrushOwnReplacement", "nominal.newlyLit",
  "nominal.ccExposureKnown", "nominal.ccExposurePossible", "nominal.ccProtection", "pair.sameActor", "pair.BC", "pair.CF",
  "pair.mineRelocate", "pair.deployMove", "pair.timingInversions", "nominal.visionOverlap", "ix.spendOwnPaidLoss",
  "ix.tradeEnemyPaidBound", "ix.tradeEnemyReplacementBound", "ix.noveltyUnknown", "ix.ccExposureVulnerability",
  "ix.mineRelocateUnknown", "ix.spendTurn", "ix.passVulnerability", "ix.deployGasIncome", "ix.pressureLossUncertainty",
  "ix.spendOwnPaidWaste", "ix.deployOwnPaidWaste",
] as const;
const positionNames = [
  "present", "kind.classical", "kind.deploy", "kind.stimStep", "kind.spiderMine", "kind.charonMissiles", "kind.siegeMode", "kind.tacticalJump",
  "timing.B", "timing.C", "timing.F", "from.file", "from.rank", "to.present", "to.file", "to.rank",
  "deployUnit.none", "deployUnit.p", "deployUnit.n", "deployUnit.b", "deployUnit.r", "deployUnit.q",
  "promotion.none", "promotion.p", "promotion.n", "promotion.b", "promotion.r", "promotion.q",
  "actor.known", "actor.absent", "actor.nominal", "actor.paidKnown", "actor.type.p", "actor.type.n", "actor.type.b", "actor.type.r", "actor.type.q", "actor.type.k",
  "actor.tankMode.known", "actor.tankMode.sieged", "target.absent", "target.unknown", "target.knownEmpty", "target.own", "target.enemy",
  "target.type.p", "target.type.n", "target.type.b", "target.type.r", "target.type.q", "target.type.k", "target.memory.present", "target.memory.age",
  "cost.minerals", "cost.gas", "actor.paid", "actor.replacement", "ray.applicable", "ray.open", "ray.blocked", "ray.uncertain",
  "path.knownEmpty", "path.knownOccupied", "path.unknown", "nominal.newlyLit", "nominal.staleApproach", "exposure.known", "exposure.possible",
  "pressure.units", "pressure.cc", "protection.units", "protection.cc", "ix.spendLiquidity", "ix.gasAvailability", "ix.deployMargin",
  "ix.exposurePaidKnown", "ix.exposurePaidPossible", "ix.exposureReplacement", "ix.tradeEnemyLoss", "ix.ccPressureRisk", "ix.noveltyReveal",
  "ix.uncertainRayDistance", "ix.staleApproachAge", "ix.protectionPaidLoss",
] as const;
const economicNames = [
  "ix.spendBalance", "ix.spendUncertainty", "ix.deployBalance", "ix.deployUncertainty", "ix.tradeBalance", "ix.tradeUncertainty",
  "ix.protectionBalance", "ix.protectionUncertainty", "spend", "deploy", "trade", "protection",
] as const;
const kernels = ["exposure", "blockerAdded", "blockerRemoved", "attackCoverAdded", "attackCoverRemoved", "visionAdded"] as const;
const channels = ["witnessed", "unlocated"] as const;
const bandStarts = [0, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512] as const;
const configurationKeys = [
  "profiles", "horizon", "dimension", "uniqueCap", "workCap", "maxGeneratedActions",
  "familyCapacity", "compositionCapacity", "passCapacity", "maxStartedPerMaster", "masters", "checkpointCadence",
  "initialization", "arithmetic", "optimizer", "learningRate", "temperature", "l2", "clipping", "baseline",
  "emptyDecision", "abortPolicy", "primaryMaster", "openingRef", "hostLimits", "validation",
] as const;
const versionKeys = [
  "snapshot", "observationCodec", "history", "batch", "ledger", "provenance", "candidateCodec", "generator",
  "projection", "features", "featureManifest", "comparator", "rng", "episodeProtocol", "checkpoint", "artifact",
  "optimizer", "loss", "eligibility", "recipe", "hostConfig",
] as const;
const authorityKeys = [
  "version", "contractsRef", "r2GeneratorRef", "baseRef", "correctiveRef", "r3SeamRef", "r3NativeCorrectionRef", "ownedIngressRef",
] as const;

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
type ExpectedPromotionName = `${typeof kernels[number]}.${typeof channels[number]}.h${1 | 2 | 3}`;
type ExpectedScales = Readonly<{
  minerals: 12; gas: 3; turn: 45; ccLives: 3; maxSpawn: 9; paid: 3072; replacement: 2304;
  coords: 7; squares: 64; actions: 4; pairs: 6; relationPairs: 4096; visionOverlap: 256; files: 8;
}>;
type ExpectedScaleId = "unit" | keyof ExpectedScales | "minerals*minerals" | "gas*gas" | "squares*minerals" |
  "squares*replacement" | "ccComplement" | "coords*turn" | "squares*paid" | "meanCosts*paid" |
  "relationPairs*paid" | "relationPairs*replacement" | "squares*squares" | "squares*ccComplement" |
  "pairs*squares" | "meanCosts*turn" | "actions*gas" | "actions*paid" | "meanCosts*unit" | "minerals*unit" | "meanCosts";
type ExpectedVersions = Readonly<{
  snapshot: "challenge-observation-v2"; observationCodec: "challenge-observation-codec-v2";
  history: "challenge-history-v2"; batch: "challenge-boundary-batch-v1"; ledger: "challenge-economic-ledger-v1";
  provenance: "engine-provenance-v1"; candidateCodec: "challenge-candidate-codec-v1"; generator: "challenge-composition-v3";
  projection: "authorized-own-projection-v1"; features: "challenge-features-v3"; featureManifest: "challenge-feature-manifest-v3";
  comparator: "score-desc-key-asc-v1"; rng: "starchess-training-rng-v1"; episodeProtocol: "starchess-training-episode-v2";
  checkpoint: "starchess-training-checkpoint-v2"; artifact: "starchess-training-artifact-v2";
  optimizer: "starchess-sgd-float64-v1"; loss: "starchess-reinforce-sum-v1"; eligibility: "starchess-training-eligibility-v1";
  recipe: "starchess-training-recipe-v2"; hostConfig: "starchess-training-host-v2";
}>;
type ExpectedHostLimits = Readonly<{
  startupMs: 10000; planMs: 10000; matchMs: 300000; maxWindows: 64; maxRecordedPlies: 128;
  maxProposals: 4096; maxIpcMessages: 2048; maxProgressBytes: 1048576; maxCompletionBytes: 16777216;
}>;
type ExpectedConfiguration = Readonly<{
  profiles: Readonly<{ api: "A"; provenance: "A"; quota: "B"; curriculum: "A"; validation: "A" }>;
  horizon: 1; dimension: 418; uniqueCap: 512; workCap: 2048; maxGeneratedActions: 4;
  familyCapacity: 48; compositionCapacity: 175; passCapacity: 1;
  maxStartedPerMaster: 1000; masters: readonly [101, 102, 103, 104, 105]; checkpointCadence: 100;
  initialization: "zeros"; arithmetic: "float64-cpu"; optimizer: "SGD";
  learningRate: H; temperature: H; l2: H; clipping: "none";
  baseline: "per-seed-all-history-eligible-mean"; emptyDecision: "diagnostic-only";
  abortPolicy: "stop-all"; primaryMaster: 101; openingRef: ByteRef; hostLimits: ExpectedHostLimits;
  validation: Readonly<{ profile: "A"; eps: readonly [H]; atol: H; rtol: H }>;
}>;
type OriginalRequestFixture = Readonly<{
  version: "starchess-training-episode-v2"; privateAttemptId: string;
}>;

type ContractChecks = [
  Assert<Equal<History, AuthorizedHistory>>,
  Assert<Equal<CheckedBoundary, ReconciledBoundaryState>>,
  Assert<Equal<keyof CheckedBoundary, "snapshot" | "economicState" | "ownMineAuditState" | "everLit" | "ordinal" | "phase" | "planningOrdinal" | "seqThrough" | "lastBatchBytes">>,
  Assert<Equal<Candidate, EncodedCandidate>>,
  Assert<Equal<Side, ArenaSide>>,
  Assert<Equal<Square, ArenaSquare>>,
  Assert<Equal<contracts.AuthorizedSnapshotV2, AuthorizedSnapshotV2>>,
  Assert<Equal<Cells, readonly ObservedCell[]>>,
  Assert<Equal<Memory, readonly Sighting[]>>,
  Assert<Equal<Float64Hex, Readonly<{ hex: string }>>>,
  Assert<Equal<H, Float64Hex>>,
  Assert<Equal<ByteRef, Readonly<{ byteLength: number; sha256: string }>>>,
  Assert<Equal<Ref, ByteRef>>,
  Assert<Equal<Meter, { readonly limit: 1048576; used: number }>>,
  Assert<Equal<typeof contracts.ECONOMIC_WORK_CAP, 1048576>>,
  Assert<Equal<typeof contracts.ECONOMIC_BYTE_CAP, 1048576>>,
  Assert<Equal<typeof contracts.JOINT_SIZE, 7501>>,
  Assert<Equal<typeof contracts.BAND_STARTS, typeof bandStarts>>,
  Assert<Equal<typeof contracts.QUEUE_NAMES, typeof queueNames>>,
  Assert<Equal<typeof contracts.POSITION_NAMES, typeof positionNames>>,
  Assert<Equal<typeof contracts.ECONOMIC_NAMES, typeof economicNames>>,
  Assert<Equal<typeof contracts.PROMOTION_KERNELS, typeof kernels>>,
  Assert<Equal<typeof contracts.PROMOTION_CHANNELS, typeof channels>>,
  Assert<Equal<Queue34, Readonly<Record<typeof queueNames[number], number>>>>,
  Assert<Equal<Position84, Readonly<Record<typeof positionNames[number], number>>>>,
  Assert<Equal<Economic12, Readonly<Record<typeof economicNames[number], number>>>>,
  Assert<Equal<PromotionName, ExpectedPromotionName>>,
  Assert<Equal<Promotion36, Readonly<Record<ExpectedPromotionName, number>>>>,
  Assert<Equal<PublicOpening, Readonly<{
    version: "starchess-economic-opening-v1"; turn: 0; bank: Readonly<{ w: 3; b: 3 }>;
    cc: Readonly<{ w: "e1"; b: "e8" }>;
    marines: Readonly<{ w: readonly ["c2", "d2", "e2", "f2"]; b: readonly ["c7", "d7", "e7", "f7"] }>;
  }>>>,
  Assert<Equal<EconomicRecipe, Readonly<{
    version: "starchess-economic-recipe-v1"; supportVersion: "economic-accounting-relaxation-v1";
    graphVersion: "positive-headstock-suffix-v1"; innovationVersion: "authorized-economic-innovation-v1";
    geometryVersion: "authorized-promotion-geometry-v1"; calibrationVersion: "starchess-economic-calibration-v1";
    workCap: 1048576; materialCeiling: 576; bankCap: 12; bandStarts: typeof bandStarts; alpha: H;
    minimumGroups: 32; diagnosticHorizons: readonly [1, 2, 3];
  }>>>,
  Assert<Equal<Component, Readonly<{ bank: number; band: number; mass: H; conditional: readonly H[] }>>>,
  Assert<Equal<EconomicBeliefState, Readonly<{
    version: "challenge-enemy-economic-belief-v1"; side: Side; ordinal: number; seqThrough: number;
    planningOrdinal: number; turn: number; boundaryRef: ByteRef; cells: Cells; memory: Memory;
    witnessed: readonly Square[]; unlocated: readonly Square[]; enemyCC: readonly Square[];
    components: readonly Component[]; publicSupport: readonly boolean[];
  }>>>,
  Assert<Equal<TransitionRow, readonly [number, number, number, number, number, H]>>,
  Assert<Equal<EvidenceRow, readonly [number, number, number, H]>>,
  Assert<Equal<keyof TransitionTable, "kind" | "level" | "bank" | "band" | "tier" | "groups" | "rows">>,
  Assert<Equal<keyof EvidenceTable, keyof TransitionTable>>,
  Assert<Equal<Pick<TransitionTable, "level" | "bank" | "band" | "tier" | "groups">, Readonly<{
    level: number; bank: number | null; band: number | null; tier: number | null; groups: number;
  }>>>,
  Assert<Equal<Pick<EvidenceTable, "level" | "bank" | "band" | "tier" | "groups">, Pick<TransitionTable, "level" | "bank" | "band" | "tier" | "groups">>>,
  Assert<Equal<TransitionTable["kind"], "transition">>,
  Assert<Equal<TransitionTable["rows"], readonly TransitionRow[]>>,
  Assert<Equal<EvidenceTable["kind"], "evidence">>,
  Assert<Equal<EvidenceTable["rows"], readonly EvidenceRow[]>>,
  Assert<Equal<Table, TransitionTable | EvidenceTable>>,
  Assert<Equal<Bin, readonly [number, number, number, number]>>,
  Assert<Equal<EconomicArtifact, Readonly<{
    version: "starchess-economic-artifact-v1"; status: "FROZEN"; opening: PublicOpening;
    recipe: EconomicRecipe; tables: readonly Table[]; partition: readonly Bin[]; temperatures: readonly H[];
  }>>>,
  Assert<Equal<EconomicReadout, Readonly<{
    version: "starchess-economic-readout-v1"; boundaryRef: ByteRef; meanD: H; meanPotential: H;
    quantilesD: readonly [number, number, number, number]; quantilesPotential: readonly [number, number, number, number];
    balance: H; uncertainty: H;
  }>>>,
  Assert<Equal<FeatureBlocksV3, Readonly<{
    version: "challenge-features-v3"; queue: Queue34; positions: readonly [Position84, Position84, Position84, Position84];
    economic: Economic12; promotion: Promotion36;
  }>>>,
  Assert<Equal<Scales, ExpectedScales>>,
  Assert<Equal<ScaleId, ExpectedScaleId>>,
  Assert<Equal<MeaningId, `q:${number}` | `p:${number}` | `e:${number}` | `promo:${number}:${number}:${1 | 2 | 3}`>>,
  Assert<Equal<ManifestEntry, Readonly<{ name: string; meaningId: MeaningId; scaleId: ScaleId }>>>,
  Assert<Equal<FeatureManifestV3, Readonly<{
    version: "challenge-feature-manifest-v3"; dimension: 418; names: readonly string[];
    entries: readonly ManifestEntry[]; scales: Scales;
  }>>>,
  Assert<Equal<EstimatorProvenance, Readonly<{
    version: "starchess-estimator-provenance-v1"; economicArtifactRef: ByteRef; coreRulesRef: ByteRef;
    fittingCodeRef: ByteRef; collectionRecipeRef: ByteRef; fittingRecipeRef: ByteRef; collectionRosterRef: ByteRef;
    splitRosterRef: ByteRef; labelBytesRef: ByteRef; fitJournalRef: ByteRef; calibrationJournalRef: ByteRef;
  }>>>,
  Assert<Equal<EconomicPin, Readonly<{
    version: "starchess-economic-pin-v1"; economicArtifactRef: ByteRef; estimatorProvenanceRef: ByteRef;
    featureManifestRef: ByteRef; amendmentRef: ByteRef;
  }>>>,
  Assert<Equal<EconomicBinding, Readonly<{
    version: "starchess-economic-binding-v1"; policyArtifactRef: ByteRef; economicArtifactRef: ByteRef;
    estimatorProvenanceRef: ByteRef; featureManifestRef: ByteRef; amendmentRef: ByteRef;
  }>>>,
  Assert<Equal<EconomicAuthority, Readonly<{
    version: "starchess-economic-authority-v1"; contractsRef: ByteRef; r2GeneratorRef: ByteRef; baseRef: ByteRef;
    correctiveRef: ByteRef; r3SeamRef: ByteRef; r3NativeCorrectionRef: ByteRef; ownedIngressRef: ByteRef;
  }>>>,
  Assert<Equal<keyof EconomicAuthority, typeof authorityKeys[number]>>,
  Assert<Equal<keyof Configuration418, typeof configurationKeys[number]>>,
  Assert<Equal<Configuration418, ExpectedConfiguration>>,
  Assert<Equal<keyof Versions418, typeof versionKeys[number]>>,
  Assert<Equal<Versions418, ExpectedVersions>>,
  Assert<Equal<HostLimits, ExpectedHostLimits>>,
  Assert<Equal<TrainingRecipeV2, Readonly<{
    version: "starchess-training-recipe-v2"; configuration: Configuration418; versions: Versions418; economicPinRef: ByteRef;
  }>>>,
  Assert<Equal<PrivateEconomicRequestV2<OriginalRequestFixture>, Readonly<{
    version: "starchess-training-economic-request-v2"; originalRequest: OriginalRequestFixture; economicPinRef: ByteRef;
  }>>>,
  Assert<Equal<PrivateEconomicRequestV2<OriginalRequestFixture>["originalRequest"], OriginalRequestFixture>>,
  Assert<Equal<string extends keyof Queue34 ? true : false, false>>,
  Assert<Equal<string extends keyof Position84 ? true : false, false>>,
  Assert<Equal<string extends keyof Economic12 ? true : false, false>>,
  Assert<Equal<string extends keyof Promotion36 ? true : false, false>>,
];

describe("economic model-safe type contracts", () => {
  it("exposes only frozen registry constants at runtime", () => {
    expect(Object.keys(contracts).sort()).toEqual([
      "BAND_STARTS", "ECONOMIC_BYTE_CAP", "ECONOMIC_NAMES", "ECONOMIC_WORK_CAP", "JOINT_SIZE",
      "POSITION_NAMES", "PROMOTION_CHANNELS", "PROMOTION_KERNELS", "QUEUE_NAMES",
    ]);
  });

  it("preserves the economic caps and all 19 material-band starts", () => {
    expect(contracts.ECONOMIC_WORK_CAP).toBe(1048576);
    expect(contracts.ECONOMIC_BYTE_CAP).toBe(1048576);
    expect(contracts.JOINT_SIZE).toBe(13 * 577);
    expect(contracts.BAND_STARTS).toEqual(bandStarts);
    expect(contracts.BAND_STARTS).toHaveLength(19);
    expect(Object.isFrozen(contracts.BAND_STARTS)).toBe(true);
  });

  it.each([
    [contracts.QUEUE_NAMES, queueNames, 34],
    [contracts.POSITION_NAMES, positionNames, 84],
    [contracts.ECONOMIC_NAMES, economicNames, 12],
    [contracts.PROMOTION_KERNELS, kernels, 6],
    [contracts.PROMOTION_CHANNELS, channels, 2],
  ] as const)("preserves exact ordered names for %j", (actual, expected, count) => {
    expect(actual).toEqual(expected);
    expect(actual).toHaveLength(count);
    expect(new Set(actual).size).toBe(count);
    expect(Object.isFrozen(actual)).toBe(true);
  });

  it("preserves every historical and appended feature index", () => {
    const names = [
      ...contracts.QUEUE_NAMES.map(name => `queue.${name}`),
      ...[0, 1, 2, 3].flatMap(slot => contracts.POSITION_NAMES.map(name => `position.${slot}.${name}`)),
      ...contracts.ECONOMIC_NAMES.map(name => `economic.${name}`),
      ...contracts.PROMOTION_KERNELS.flatMap(kernel => contracts.PROMOTION_CHANNELS.flatMap(channel =>
        [1, 2, 3].map(horizon => `promotion.${kernel}.${channel}.h${horizon}`))),
    ];
    expect(names).toHaveLength(418);
    expect(new Set(names).size).toBe(418);
    queueNames.forEach((name, index) => expect(names[index]).toBe(`queue.${name}`));
    for (let slot = 0; slot < 4; slot++) {
      positionNames.forEach((name, index) => expect(names[34 + 84 * slot + index]).toBe(`position.${slot}.${name}`));
    }
    economicNames.forEach((name, index) => expect(names[370 + index]).toBe(`economic.${name}`));
    let promotionCount = 0;
    kernels.forEach((kernel, kernelIndex) => channels.forEach((channel, channelIndex) => {
      for (const horizon of [1, 2, 3]) {
        const index = 382 + 6 * kernelIndex + 3 * channelIndex + horizon - 1;
        expect(names[index]).toBe(`promotion.${kernel}.${channel}.h${horizon}`);
        promotionCount++;
      }
    }));
    expect(promotionCount).toBe(36);
    expect(names[369]).toBe("position.3.ix.protectionPaidLoss");
    expect(names[370]).toBe("economic.ix.spendBalance");
    expect(names[381]).toBe("economic.protection");
    expect(names[382]).toBe("promotion.exposure.witnessed.h1");
    expect(names[417]).toBe("promotion.visionAdded.unlocated.h3");
  });

  it("retains 26 Configuration keys, 21 Versions keys and eight authority fields", () => {
    for (const [keys, count] of [[configurationKeys, 26], [versionKeys, 21], [authorityKeys, 8]] as const) {
      expect(keys).toHaveLength(count);
      expect(new Set(keys).size).toBe(count);
    }
  });

  it("keeps reference lengths independent of economic payload caps", () => {
    const ref: ByteRef = { byteLength: Number.MAX_SAFE_INTEGER, sha256: "a".repeat(64) };
    const alias: Ref = ref;
    expect(alias).toBe(ref);
    expect(alias.byteLength).toBe(Number.MAX_SAFE_INTEGER);
    expect(alias.byteLength).toBeGreaterThan(contracts.ECONOMIC_BYTE_CAP);
  });

  it("keeps Meter usage writable without adding fields", () => {
    const meter: Meter = { limit: 1048576, used: 0 };
    meter.used += 1;
    expect(meter).toEqual({ limit: 1048576, used: 1 });
  });
});
