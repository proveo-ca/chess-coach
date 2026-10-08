// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import type {
  AuthorizedHistory as ArenaAuthorizedHistory, AuthorizedSnapshotV2, ObservedCell,
  ReconciledBoundaryState, Side, Sighting, Square,
} from "@chess-coach/starchess-arena/observations";
import type { EncodedCandidate } from "@chess-coach/starchess-arena/intent-codec-v1";

export type { Side, Square, AuthorizedSnapshotV2 };
export type History = ArenaAuthorizedHistory;
export type CheckedBoundary = ReconciledBoundaryState;
export type Candidate = EncodedCandidate;
export type Cells = readonly ObservedCell[];
export type Memory = readonly Sighting[];
export type Float64Hex = Readonly<{ hex: string }>;
export type H = Float64Hex;
export type ByteRef = Readonly<{ byteLength: number; sha256: string }>;
export type Meter = { readonly limit: 1048576; used: number };

export const BAND_STARTS = Object.freeze([0, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512] as const);
export const ECONOMIC_WORK_CAP = 1048576 as const;
export const ECONOMIC_BYTE_CAP = 1048576 as const;
export const JOINT_SIZE = 7501 as const;

export type PublicOpening = Readonly<{
  version: "starchess-economic-opening-v1"; turn: 0;
  bank: Readonly<{ w: 3; b: 3 }>;
  cc: Readonly<{ w: "e1"; b: "e8" }>;
  marines: Readonly<{ w: readonly ["c2", "d2", "e2", "f2"]; b: readonly ["c7", "d7", "e7", "f7"] }>;
}>;
export type EconomicRecipe = Readonly<{
  version: "starchess-economic-recipe-v1";
  supportVersion: "economic-accounting-relaxation-v1";
  graphVersion: "positive-headstock-suffix-v1";
  innovationVersion: "authorized-economic-innovation-v1";
  geometryVersion: "authorized-promotion-geometry-v1";
  calibrationVersion: "starchess-economic-calibration-v1";
  workCap: 1048576; materialCeiling: 576; bankCap: 12;
  bandStarts: typeof BAND_STARTS; alpha: H; minimumGroups: 32;
  diagnosticHorizons: readonly [1, 2, 3];
}>;
export type Component = Readonly<{ bank: number; band: number; mass: H; conditional: readonly H[] }>;
export type EconomicBeliefState = Readonly<{
  version: "challenge-enemy-economic-belief-v1"; side: Side; ordinal: number;
  seqThrough: number; planningOrdinal: number; turn: number; boundaryRef: ByteRef;
  cells: Cells; memory: Memory; witnessed: readonly Square[]; unlocated: readonly Square[];
  enemyCC: readonly Square[]; components: readonly Component[]; publicSupport: readonly boolean[];
}>;
export type TransitionRow = readonly [s: number, c: number, w: number, g: number, d: number, count: H];
export type EvidenceRow = readonly [y1: number, y2: number, y3: number, count: H];
type TableFields = Readonly<{ level: number; bank: number | null; band: number | null; tier: number | null; groups: number }>;
export type TransitionTable = TableFields & Readonly<{ kind: "transition"; rows: readonly TransitionRow[] }>;
export type EvidenceTable = TableFields & Readonly<{ kind: "evidence"; rows: readonly EvidenceRow[] }>;
export type Table = TransitionTable | EvidenceTable;
export type Bin = readonly [turnLow: number, turnHigh: number, litLow: number, litHigh: number];
export type EconomicArtifact = Readonly<{
  version: "starchess-economic-artifact-v1"; status: "FROZEN"; opening: PublicOpening;
  recipe: EconomicRecipe; tables: readonly Table[]; partition: readonly Bin[]; temperatures: readonly H[];
}>;
export type EconomicReadout = Readonly<{
  version: "starchess-economic-readout-v1"; boundaryRef: ByteRef;
  meanD: H; meanPotential: H; quantilesD: readonly [number, number, number, number];
  quantilesPotential: readonly [number, number, number, number]; balance: H; uncertainty: H;
}>;

export const QUEUE_NAMES = Object.freeze([
  "pass", "actionCount", "requestedMinerals", "requestedGas", "timing.BCount", "timing.CCount", "timing.FCount",
  "mineralMargin", "gasMargin", "nominal.deployCrushOwnPaid", "nominal.deployCrushOwnReplacement", "nominal.newlyLit",
  "nominal.ccExposureKnown", "nominal.ccExposurePossible", "nominal.ccProtection", "pair.sameActor", "pair.BC", "pair.CF",
  "pair.mineRelocate", "pair.deployMove", "pair.timingInversions", "nominal.visionOverlap", "ix.spendOwnPaidLoss",
  "ix.tradeEnemyPaidBound", "ix.tradeEnemyReplacementBound", "ix.noveltyUnknown", "ix.ccExposureVulnerability",
  "ix.mineRelocateUnknown", "ix.spendTurn", "ix.passVulnerability", "ix.deployGasIncome", "ix.pressureLossUncertainty",
  "ix.spendOwnPaidWaste", "ix.deployOwnPaidWaste",
] as const);
export const POSITION_NAMES = Object.freeze([
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
] as const);
export const ECONOMIC_NAMES = Object.freeze([
  "ix.spendBalance", "ix.spendUncertainty", "ix.deployBalance", "ix.deployUncertainty", "ix.tradeBalance", "ix.tradeUncertainty",
  "ix.protectionBalance", "ix.protectionUncertainty", "spend", "deploy", "trade", "protection",
] as const);
export const PROMOTION_KERNELS = Object.freeze(["exposure", "blockerAdded", "blockerRemoved", "attackCoverAdded", "attackCoverRemoved", "visionAdded"] as const);
export const PROMOTION_CHANNELS = Object.freeze(["witnessed", "unlocated"] as const);
export type PromotionName = `${typeof PROMOTION_KERNELS[number]}.${typeof PROMOTION_CHANNELS[number]}.h${1 | 2 | 3}`;
export type Queue34 = Readonly<Record<typeof QUEUE_NAMES[number], number>>;
export type Position84 = Readonly<Record<typeof POSITION_NAMES[number], number>>;
export type Economic12 = Readonly<Record<typeof ECONOMIC_NAMES[number], number>>;
export type Promotion36 = Readonly<Record<PromotionName, number>>;
export type FeatureBlocksV3 = Readonly<{
  version: "challenge-features-v3"; queue: Queue34;
  positions: readonly [Position84, Position84, Position84, Position84];
  economic: Economic12; promotion: Promotion36;
}>;
export type Scales = Readonly<{
  minerals: 12; gas: 3; turn: 45; ccLives: 3; maxSpawn: 9; paid: 3072; replacement: 2304;
  coords: 7; squares: 64; actions: 4; pairs: 6; relationPairs: 4096; visionOverlap: 256; files: 8;
}>;
export type ScaleId = "unit" | keyof Scales | "minerals*minerals" | "gas*gas" | "squares*minerals" |
  "squares*replacement" | "ccComplement" | "coords*turn" | "squares*paid" | "meanCosts*paid" |
  "relationPairs*paid" | "relationPairs*replacement" | "squares*squares" | "squares*ccComplement" |
  "pairs*squares" | "meanCosts*turn" | "actions*gas" | "actions*paid" | "meanCosts*unit" | "minerals*unit" | "meanCosts";
export type MeaningId = `q:${number}` | `p:${number}` | `e:${number}` | `promo:${number}:${number}:${1 | 2 | 3}`;
export type ManifestEntry = Readonly<{ name: string; meaningId: MeaningId; scaleId: ScaleId }>;
export type FeatureManifestV3 = Readonly<{
  version: "challenge-feature-manifest-v3"; dimension: 418; names: readonly string[];
  entries: readonly ManifestEntry[]; scales: Scales;
}>;

export type EstimatorProvenance = Readonly<{
  version: "starchess-estimator-provenance-v1"; economicArtifactRef: ByteRef; coreRulesRef: ByteRef;
  fittingCodeRef: ByteRef; collectionRecipeRef: ByteRef; fittingRecipeRef: ByteRef;
  collectionRosterRef: ByteRef; splitRosterRef: ByteRef; labelBytesRef: ByteRef;
  fitJournalRef: ByteRef; calibrationJournalRef: ByteRef;
}>;
export type EconomicPin = Readonly<{
  version: "starchess-economic-pin-v1"; economicArtifactRef: ByteRef; estimatorProvenanceRef: ByteRef;
  featureManifestRef: ByteRef; amendmentRef: ByteRef;
}>;
export type EconomicBinding = Readonly<{
  version: "starchess-economic-binding-v1"; policyArtifactRef: ByteRef; economicArtifactRef: ByteRef;
  estimatorProvenanceRef: ByteRef; featureManifestRef: ByteRef; amendmentRef: ByteRef;
}>;
export type Versions418 = Readonly<{
  snapshot: "challenge-observation-v2"; observationCodec: "challenge-observation-codec-v2";
  history: "challenge-history-v2"; batch: "challenge-boundary-batch-v1"; ledger: "challenge-economic-ledger-v1";
  provenance: "engine-provenance-v1"; candidateCodec: "challenge-candidate-codec-v1"; generator: "challenge-composition-v3";
  projection: "authorized-own-projection-v1"; features: "challenge-features-v3"; featureManifest: "challenge-feature-manifest-v3";
  comparator: "score-desc-key-asc-v1"; rng: "starchess-training-rng-v1"; episodeProtocol: "starchess-training-episode-v2";
  checkpoint: "starchess-training-checkpoint-v2"; artifact: "starchess-training-artifact-v2";
  optimizer: "starchess-sgd-float64-v1"; loss: "starchess-reinforce-sum-v1"; eligibility: "starchess-training-eligibility-v1";
  recipe: "starchess-training-recipe-v2"; hostConfig: "starchess-training-host-v2";
}>;
export type HostLimits = Readonly<{
  startupMs: 10000; planMs: 10000; matchMs: 300000; maxWindows: 64; maxRecordedPlies: 128;
  maxProposals: 4096; maxIpcMessages: 2048; maxProgressBytes: 1048576; maxCompletionBytes: 16777216;
}>;
export type Configuration418 = Readonly<{
  profiles: Readonly<{ api: "A"; provenance: "A"; quota: "B"; curriculum: "A"; validation: "A" }>;
  horizon: 1; dimension: 418; uniqueCap: 512; workCap: 2048; maxGeneratedActions: 4;
  familyCapacity: 48; compositionCapacity: 175; passCapacity: 1;
  maxStartedPerMaster: 1000; masters: readonly [101, 102, 103, 104, 105]; checkpointCadence: 100;
  initialization: "zeros"; arithmetic: "float64-cpu"; optimizer: "SGD";
  learningRate: H; temperature: H; l2: H; clipping: "none";
  baseline: "per-seed-all-history-eligible-mean"; emptyDecision: "diagnostic-only";
  abortPolicy: "stop-all"; primaryMaster: 101; openingRef: ByteRef; hostLimits: HostLimits;
  validation: Readonly<{ profile: "A"; eps: readonly [H]; atol: H; rtol: H }>;
}>;
export type TrainingRecipeV2 = Readonly<{
  version: "starchess-training-recipe-v2"; configuration: Configuration418; versions: Versions418; economicPinRef: ByteRef;
}>;
export type PrivateEconomicRequestV2<OriginalEpisodeRequestV2 extends Readonly<{ version: "starchess-training-episode-v2" }>> = Readonly<{
  version: "starchess-training-economic-request-v2"; originalRequest: OriginalEpisodeRequestV2; economicPinRef: ByteRef;
}>;
