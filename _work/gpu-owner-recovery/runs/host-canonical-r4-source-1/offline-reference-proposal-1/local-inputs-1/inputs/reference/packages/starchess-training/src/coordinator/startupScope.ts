// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { createHash } from "node:crypto";
import { once } from "node:events";
import { Readable } from "node:stream";
import { types } from "node:util";
import { historyFromRecord, parseScFen, scOutcome, scsanOf, type ScActionInput, type EndScTurnResult } from "@chess-coach/starchess-core";
import type { EconomicArtifact, EconomicAuthority, EstimatorProvenance, FeatureManifestV3, PublicOpening, Ref, TrainingRecipeV2 } from "../economic/contracts";
import {
  createStartupArtifactContext, requireRef, snapshotFixedBytes, constructRef, OPENING_CANONICAL_BYTES_TEXT,
  requireEconomicAuthority, requireEstimatorProvenance, requireArtifact, requireManifest, constructFloat64Hex,
  snapshotLength, readSnapshotByte,
  type ByteProduction,
} from "../economic/ownedKernel";
import { decodeOwnedAuthority, decodeOwnedBinding, decodeOwnedEconomicArtifact, decodeOwnedEstimatorProvenance,
  decodeOwnedFeatureManifest, decodeOwnedPin, decodeOwnedTrainingRecipe } from "../economic/ownedR4Schema";
import { equalOwnedRefs } from "../economic/ownedScalars";
import type { OriginalEpisodeRequestV2 } from "./episodeContracts";
import { requireEpisodeRequest, validateEpisodeRequestStartup, constructEconomicEpisodeRequest, encodeEconomicEpisodeRequest,
  constructEpisodeRequestByteBinding, decodeRegisteredEconomicEpisodeRequest, EPISODE_REQUEST_BYTE_CAP,
  type TrustedExpectedEpisodeBindings } from "./episodeRequest";
import { requireVerifiedSourceSeal, verifySourceSealCurrent, type VerifiedSourceSeal, type SourceBootstrapContext, type SourceInput } from "./sourceBootstrap";
import { requireRegisteredBytes, createRegisteredByteStore, type RegisteredByteStore, type ByteRole } from "./registeredBytes";
import { sourceRecord, sourceArray, parseSourceJson, canonicalSourceJson } from "./sourceManifest";
import { constructTrustedExecutionContext, type TrustedExecutionContext, EpisodeVerificationError } from "./episodeVerification";
import type { EpisodeWorkerLaunch } from "./episodeSupervisor";

declare const modelsBrand: unique symbol;
export type BoundModels = Readonly<{ [modelsBrand]: "independently-bound-startup-models" }>;
export type HostedModelConfiguration = Readonly<{ artifact: EconomicArtifact; opening: PublicOpening; manifest: FeatureManifestV3 }>;
declare const expectedBrand: unique symbol;
export type StartupExpected = Readonly<{ [expectedBrand]: "independent-startup-expectations" }>;
export type StartupExpectedRefs = Readonly<{
  economicArtifact: Ref; featureManifest: Ref; economicPin: Ref; estimatorProvenance: Ref; amendment: Ref;
  economicBinding: Ref; policyArtifact: Ref; trainingRecipe: Ref; episodeWeights: Ref; corpusManifest: Ref; corpusSource: Ref;
  source: Ref; sourceInventory: Ref; sourcePolicy: Ref;
}>;
declare const authorityBytesBrand: unique symbol;
export type StartupAuthorityBytes = Readonly<{ [authorityBytesBrand]: "registered-economic-authority-bytes" }>;
export type StartupByteStores = Readonly<{ models: RegisteredByteStore; authority: StartupAuthorityBytes; constituents: RegisteredByteStore }>;
type Expected = Readonly<{ refs: StartupExpectedRefs; episode: TrustedExpectedEpisodeBindings; launch: EpisodeWorkerLaunch;
  authority: EconomicAuthority; estimator: EstimatorProvenance; source: Readonly<{ context: SourceBootstrapContext; input: SourceInput }> | null }>;
type Models = Readonly<{ seal: VerifiedSourceSeal; request: OriginalEpisodeRequestV2; expected: StartupExpected; stores: StartupByteStores;
  configuration: HostedModelConfiguration; corpus: readonly (readonly (readonly ScActionInput[])[])[] }>;
const models = new WeakMap<object, Models>();
const lookup = WeakMap.prototype.get.bind(models);
const publish = WeakMap.prototype.set.bind(models);
const expectations = new WeakMap<object, Expected>();
const expectedLookup = WeakMap.prototype.get.bind(expectations), expectedPublish = WeakMap.prototype.set.bind(expectations);
const freeze = Object.freeze;
const configurations = new WeakMap<object, BoundModels>();
const configurationLookup = WeakMap.prototype.get.bind(configurations), configurationPublish = WeakMap.prototype.set.bind(configurations);
const token = <T>(): T => freeze(Object.create(null)) as T;
const reject = (): never => { throw new EpisodeVerificationError("source"); };
const REF_KEYS = freeze(["economicArtifact", "featureManifest", "economicPin", "estimatorProvenance", "amendment", "economicBinding", "policyArtifact", "trainingRecipe", "episodeWeights", "corpusManifest", "corpusSource", "source", "sourceInventory", "sourcePolicy"] as const);
const requireExpected = (value: unknown): Expected => {
  if (value === null || typeof value !== "object") return reject();
  return expectedLookup(value) ?? reject();
};
const requireModelsIdentity = (value: unknown): Models => {
  if (value === null || typeof value !== "object") return reject();
  const stored = lookup(value);
  if (!stored) return reject();
  requireVerifiedSourceSeal(stored.seal);
  const expected = requireExpected(stored.expected);
  if (expected.source === null) return reject();
  verifySourceSealCurrent(stored.seal, expected.source.context, expected.source.input);
  return stored;
};
const requireModels = (value: unknown, seal: VerifiedSourceSeal): Models => {
  const checkedSeal = requireVerifiedSourceSeal(seal), stored = requireModelsIdentity(value);
  if (stored.seal !== checkedSeal) return reject();
  return stored;
};
const physicalRef = (bytes: Uint8Array): Ref => constructRef(bytes.length, createHash("sha256").update(bytes).digest("hex"));
const authorityBytes = new WeakMap<object, Readonly<{ ref: Ref; authority: EconomicAuthority }>>();
const authorityLookup = WeakMap.prototype.get.bind(authorityBytes), authorityPublish = WeakMap.prototype.set.bind(authorityBytes);
export const constructStartupAuthorityBytes = (expectedAmendmentRef: Ref, carrier: unknown): StartupAuthorityBytes => {
  const ref = requireRef(expectedAmendmentRef), snapshot = snapshotFixedBytes(carrier, "authority"), size = snapshotLength(snapshot), bytes = new Uint8Array(size);
  for (let i = 0; i < size; i++) bytes[i] = readSnapshotByte(snapshot, i);
  if (!equalOwnedRefs(physicalRef(bytes), ref)) return reject();
  const authority = decodeOwnedAuthority(createStartupArtifactContext(), snapshot), result = token<StartupAuthorityBytes>();
  authorityPublish(result, freeze({ ref, authority })); return result;
};
const requireStartupAuthority = (value: unknown, expectedRef: Ref): EconomicAuthority => {
  if (value === null || typeof value !== "object") return reject();
  const registered = authorityLookup(value);
  if (!registered || !equalOwnedRefs(registered.ref, expectedRef)) return reject();
  return registered.authority;
};
const checkedBytes = (store: RegisteredByteStore, role: ByteRole, reference: Ref): Uint8Array => {
  const ref = requireRef(reference), reader = requireRegisteredBytes(store, role, ref);
  if (reader.length > 1048576) return reject();
  const bytes = new Uint8Array(reader.length);
  for (let i = 0; i < bytes.length; i++) bytes[i] = reader.readByte(i);
  if (!equalOwnedRefs(physicalRef(bytes), ref)) return reject();
  return bytes;
};
const textValue = (value: unknown, maximum = 4096): string => {
  if (typeof value !== "string" || value.length === 0 || value.length > maximum || value.includes("\0")) return reject();
  return value;
};
export const constructStartupExpected = (references: StartupExpectedRefs, episode: TrustedExpectedEpisodeBindings,
  workerLaunch: EpisodeWorkerLaunch, authorityValue: EconomicAuthority, estimatorValue: EstimatorProvenance,
  sourceSelection: Readonly<{ context: SourceBootstrapContext; input: SourceInput }> | null = null): StartupExpected => {
  const authority = requireEconomicAuthority(authorityValue), estimator = requireEstimatorProvenance(estimatorValue);
  const fields = sourceRecord(references, REF_KEYS, "PROVENANCE"), refs = Object.create(null) as Record<typeof REF_KEYS[number], Ref>;
  for (const key of REF_KEYS) refs[key] = requireRef(fields[key]);
  const raw = sourceRecord(workerLaunch, ["executable", "arguments", "directory", "environment"], "PROVENANCE");
  const arguments_ = sourceArray(raw.arguments, "PROVENANCE"); if (arguments_.length > 32) return reject();
  const environment = sourceRecord(raw.environment, ["PATH", "HOME", "TMPDIR"], "PROVENANCE");
  const launch = freeze({ executable: textValue(raw.executable), arguments: freeze(arguments_.map(v => textValue(v))), directory: textValue(raw.directory),
    environment: freeze({ PATH: textValue(environment.PATH), HOME: textValue(environment.HOME), TMPDIR: textValue(environment.TMPDIR) }) });
  if (!equalOwnedRefs(estimator.economicArtifactRef, refs.economicArtifact)) return reject();
  const source = sourceSelection === null ? null : sourceRecord(sourceSelection, ["context", "input"], "PROVENANCE");
  const result = token<StartupExpected>(); expectedPublish(result, freeze({ refs: freeze(refs), episode, launch, authority, estimator,
    source: source === null ? null : freeze({ context: source.context as SourceBootstrapContext, input: source.input as SourceInput }) })); return result;
};

const POLICY_KEYS = freeze(["version", "status", "master", "dimension", "featureVersion", "featureNames", "manifest", "weights", "versions", "configuration", "trainingSummary", "provenanceRefs"]);
const PROVENANCE_KEYS = freeze(["source", "tests", "sourceInventory", "sourcePolicy", "dependencyLock", "installedTree", "frozenStore", "toolTree", "image", "runtimeConfiguration",
  "corpusManifest", "corpusSource", "coreRules", "strategicSource", "hostConfiguration", "recipe", "featureManifest", "fixtureManifest", "episodeJournal", "privateProvenanceCodec"] as const);
const policyJoins = (bytes: Uint8Array, expected: Expected, store: RegisteredByteStore, manifest: FeatureManifestV3, recipe: TrainingRecipeV2): void => {
  const policy = sourceRecord(parseSourceJson(bytes, "PROVENANCE"), POLICY_KEYS, "PROVENANCE");
  const canonical = new TextEncoder().encode(canonicalSourceJson(policy));
  if (bytes.length !== canonical.length) return reject();
  for (let i = 0; i < bytes.length; i++) if (bytes[i] !== canonical[i]) return reject();
  if (policy.version !== "starchess-training-artifact-v2" || policy.status !== "VALID" || policy.dimension !== 418 || policy.featureVersion !== "challenge-features-v3" ||
    ![101, 102, 103, 104, 105].includes(policy.master as number) || canonicalSourceJson(policy.configuration) !== canonicalSourceJson(recipe.configuration) ||
    canonicalSourceJson(policy.versions) !== canonicalSourceJson(recipe.versions) || canonicalSourceJson(policy.manifest) !== canonicalSourceJson(manifest)) return reject();
  const names = sourceArray(policy.featureNames, "PROVENANCE"), weights = sourceArray(policy.weights, "PROVENANCE");
  if (names.length !== 418 || weights.length !== 418) return reject();
  for (let i = 0; i < 418; i++) {
    if (names[i] !== manifest.names[i]) return reject();
    const value = sourceRecord(weights[i], ["hex"], "PROVENANCE"); constructFloat64Hex(value.hex as string);
  }
  const summary = sourceRecord(policy.trainingSummary, ["counters", "recipeRef", "recipeVersion", "curriculumProfile", "eligibilityVersion", "lastStartedOrdinal", "finalBoundaryOrdinal", "finalJournalRef", "aborted"], "PROVENANCE");
  const counters = sourceRecord(summary.counters, ["started", "verifiedCompleted", "eligibleCompleted", "updates", "nonzeroPGUpdates", "baselineCount", "baselineSum"], "PROVENANCE");
  const integer = (value: unknown, low: number, high: number): number => typeof value === "number" && Number.isSafeInteger(value) && !Object.is(value, -0) && value >= low && value <= high ? value : reject();
  const started = integer(counters.started, 1000, 1000), completed = integer(counters.verifiedCompleted, 1000, 1000), eligible = integer(counters.eligibleCompleted, 1, completed),
    updates = integer(counters.updates, eligible, eligible), baselineCount = integer(counters.baselineCount, updates, updates);
  integer(counters.nonzeroPGUpdates, 1, updates); integer(counters.baselineSum, -baselineCount, baselineCount);
  if (started !== completed || summary.aborted !== false || summary.recipeVersion !== "starchess-training-recipe-v2" || summary.curriculumProfile !== "A" ||
    summary.eligibilityVersion !== "starchess-training-eligibility-v1" || summary.lastStartedOrdinal !== 999) return reject();
  integer(summary.finalBoundaryOrdinal, 0, 256);
  const recipeRef = sourceRecord(summary.recipeRef, ["byteLength", "sha256"], "PROVENANCE");
  if (!equalOwnedRefs(constructRef(recipeRef.byteLength as number, recipeRef.sha256 as string), expected.refs.trainingRecipe)) return reject();
  const journal = sourceRecord(summary.finalJournalRef, ["byteLength", "sha256", "lastRecordOrdinal"], "PROVENANCE");
  integer(journal.lastRecordOrdinal, 0, Number.MAX_SAFE_INTEGER);
  const journalRef = constructRef(journal.byteLength as number, journal.sha256 as string); checkedBytes(store, "episodeJournal", journalRef);
  const refs = sourceRecord(policy.provenanceRefs, PROVENANCE_KEYS, "PROVENANCE");
  for (const key of PROVENANCE_KEYS) {
    if (key === "privateProvenanceCodec" && refs[key] === null) continue;
    const raw = sourceRecord(refs[key], ["byteLength", "sha256"], "PROVENANCE"), ref = constructRef(raw.byteLength as number, raw.sha256 as string);
    const selected = key === "featureManifest" ? expected.refs.featureManifest : key === "recipe" ? expected.refs.trainingRecipe :
      key === "corpusManifest" ? expected.refs.corpusManifest : key === "corpusSource" ? expected.refs.corpusSource : key === "coreRules" ? expected.estimator.coreRulesRef :
      key === "source" ? expected.refs.source : key === "sourceInventory" ? expected.refs.sourceInventory : key === "sourcePolicy" ? expected.refs.sourcePolicy : null;
    if (selected && !equalOwnedRefs(ref, selected)) return reject();
    if (key === "episodeJournal" && !equalOwnedRefs(ref, journalRef)) return reject();
    if (key === "privateProvenanceCodec") return reject();
    checkedBytes(store, key === "recipe" ? "trainingRecipe" : key, ref);
  }
};

const MANIFEST_SHA256 = "31ac6f865340a95f8e85c2c1577aaea0aada87feb92a37637cda90aee288cc3f";
const CANONICAL_SCFEN = "SCFEN|4k3/2pppp2/8/8/8/8/2PPPP2/4K3|0|33|P|G:11:11|B:3:3|Q:w:;b:";
const corpusWhite = (manifestBytes: Uint8Array, sourceBytes: Uint8Array): Models["corpus"] => {
  if (physicalRef(manifestBytes).sha256 !== MANIFEST_SHA256) return reject();
  const manifest = parseSourceJson(manifestBytes, "MANIFEST") as {
    version: number; sourceBytes: number; sourceSha256: string; expectedGames: number; sourceVersion: number; exportedAt: string;
    openingScfen: string; extractionVersion: string; cases: Array<{ sourceIndex: number; gameId: string; traceSha256: string;
      settledPlies: number; chipPlies: number; planningWindows: number; whiteActions: number; terminalTurn: number; historicalResult: string }>;
  };
  const source = parseSourceJson(sourceBytes, "MANIFEST") as { version: number; exportedAt: string; games: Array<{
    id: string; playerColor: string; opponent: string; result: string; scfens: string[]; resolves: EndScTurnResult[]; scsan: string[];
  }> };
  if (manifest.version !== 1 || manifest.expectedGames !== 18 || manifest.openingScfen !== CANONICAL_SCFEN || manifest.extractionVersion !== "white-planning-queues-v1" ||
    sourceBytes.length !== manifest.sourceBytes || physicalRef(sourceBytes).sha256 !== manifest.sourceSha256 || source.version !== manifest.sourceVersion ||
    source.exportedAt !== manifest.exportedAt || source.games.length !== 18 || manifest.cases.length !== 18) return reject();
  const ids = new Set<string>(), traces = new Set<string>(), result: (readonly (readonly ScActionInput[])[])[] = [];
  for (let i = 0; i < 18; i++) {
    const game = source.games[i]!, entry = manifest.cases[i]!;
    if (entry.sourceIndex !== i || game.id !== entry.gameId || game.playerColor !== "w" || game.opponent !== "strategic" || game.scfens[0] !== CANONICAL_SCFEN || ids.has(game.id) ||
      game.resolves.length > 128 || game.scfens.length !== game.resolves.length + 1) return reject();
    ids.add(game.id);
    let chips = 0, count = 0; const windows: { sourceTurn: number; actions: ScActionInput[] }[] = [];
    for (let p = 0; p < game.resolves.length; p++) {
      const resolve = game.resolves[p]!;
      if (resolve.events.some(event => event.id.startsWith("ev-begin-"))) { chips++; continue; }
      if (windows.length >= 64 || resolve.queue.length > 130) return reject();
      const actions = resolve.queue.filter(action => action.color === "w").map(({ seq: _seq, ...action }) => action);
      if (actions.length > 65) return reject();
      count += actions.length; windows.push({ sourceTurn: parseScFen(game.scfens[p]!).turn, actions });
    }
    const hash = createHash("sha256").update(JSON.stringify({ openingScfen: CANONICAL_SCFEN, trace: windows })).digest("hex");
    if (hash !== entry.traceSha256 || traces.has(hash) || entry.settledPlies !== game.resolves.length || entry.chipPlies !== chips || entry.planningWindows !== windows.length || entry.whiteActions !== count) return reject();
    traces.add(hash);
    for (const scfen of game.scfens) parseScFen(scfen);
    const history = historyFromRecord(game), terminal = history.settledSnapshots.at(-1);
    if (!terminal || history.settledSnapshots.length !== game.scfens.length || history.settledResolves.length !== game.resolves.length ||
      canonicalSourceJson(scsanOf(history.settledResolves)) !== canonicalSourceJson(game.scsan) || terminal.turn !== entry.terminalTurn || game.result !== entry.historicalResult ||
      canonicalSourceJson(scOutcome(terminal)) !== canonicalSourceJson(game.result === "win" ? { winner: "w", draw: false } : game.result === "draw" ? { winner: null, draw: true } : reject())) return reject();
    result.push(freeze(windows.map(window => freeze(window.actions.map(action => freeze(action))))));
  }
  return freeze(result);
};

export const constructBoundModels = (expectedValue: StartupExpected, storesValue: StartupByteStores,
  sealValue: VerifiedSourceSeal, requestValue: OriginalEpisodeRequestV2): BoundModels => {
  const seal = requireVerifiedSourceSeal(sealValue), expected = requireExpected(expectedValue), request = requireEpisodeRequest(requestValue);
  if (expected.source === null) return reject();
  verifySourceSealCurrent(seal, expected.source.context, expected.source.input);
  const rawStores = sourceRecord(storesValue, ["models", "authority", "constituents"], "PROVENANCE");
  const stores = freeze({ models: rawStores.models as RegisteredByteStore, authority: rawStores.authority as StartupAuthorityBytes, constituents: rawStores.constituents as RegisteredByteStore });
  const refs = expected.refs, context = createStartupArtifactContext();
  const bytes = (role: ByteRole, ref: Ref, production: ByteProduction) => snapshotFixedBytes(checkedBytes(stores.models, role, ref), production);
  const artifact = decodeOwnedEconomicArtifact(context, bytes("economicArtifact", refs.economicArtifact, "economicArtifact"));
  const manifest = decodeOwnedFeatureManifest(context, bytes("featureManifest", refs.featureManifest, "featureManifest"));
  const pin = decodeOwnedPin(context, bytes("economicPin", refs.economicPin, "pin"));
  const provenance = decodeOwnedEstimatorProvenance(context, bytes("estimatorProvenance", refs.estimatorProvenance, "estimatorProvenance"));
  const binding = decodeOwnedBinding(context, bytes("economicBinding", refs.economicBinding, "binding"));
  const recipe = decodeOwnedTrainingRecipe(context, bytes("trainingRecipe", refs.trainingRecipe, "trainingRecipe"));
  const authority = requireStartupAuthority(stores.authority, refs.amendment);
  for (const join of [pin, binding]) {
    if (!equalOwnedRefs(join.economicArtifactRef, refs.economicArtifact) || !equalOwnedRefs(join.estimatorProvenanceRef, refs.estimatorProvenance) ||
      !equalOwnedRefs(join.featureManifestRef, refs.featureManifest) || !equalOwnedRefs(join.amendmentRef, refs.amendment)) return reject();
  }
  if (!equalOwnedRefs(provenance.economicArtifactRef, refs.economicArtifact) || !equalOwnedRefs(binding.policyArtifactRef, refs.policyArtifact) ||
    !equalOwnedRefs(recipe.economicPinRef, refs.economicPin) || !equalOwnedRefs(request.manifestRef, refs.featureManifest) || !equalOwnedRefs(request.weightsRef, refs.episodeWeights) ||
    !equalOwnedRefs(recipe.configuration.openingRef, physicalRef(new TextEncoder().encode(OPENING_CANONICAL_BYTES_TEXT))) || recipe.configuration.temperature.hex !== "3ff0000000000000") return reject();
  for (const [role, field] of [["contracts", "contractsRef"], ["r2Generator", "r2GeneratorRef"], ["base", "baseRef"], ["corrective", "correctiveRef"],
    ["r3Seam", "r3SeamRef"], ["r3NativeCorrection", "r3NativeCorrectionRef"], ["ownedIngress", "ownedIngressRef"]] as const) {
    if (!equalOwnedRefs(authority[field], expected.authority[field])) return reject(); checkedBytes(stores.constituents, role, expected.authority[field]);
  }
  for (const [role, field] of [["coreRules", "coreRulesRef"], ["fittingCode", "fittingCodeRef"], ["collectionRecipe", "collectionRecipeRef"],
    ["fittingRecipe", "fittingRecipeRef"], ["collectionRoster", "collectionRosterRef"], ["splitRoster", "splitRosterRef"], ["labelBytes", "labelBytesRef"],
    ["fitJournal", "fitJournalRef"], ["calibrationJournal", "calibrationJournalRef"]] as const) {
    if (!equalOwnedRefs(provenance[field], expected.estimator[field])) return reject(); checkedBytes(stores.models, role, expected.estimator[field]);
  }
  policyJoins(checkedBytes(stores.models, "policyArtifact", refs.policyArtifact), expected, stores.models, manifest, recipe);
  validateEpisodeRequestStartup(request, expected.episode, stores.models);
  const corpus = corpusWhite(checkedBytes(stores.models, "corpusManifest", refs.corpusManifest), checkedBytes(stores.models, "corpusSource", refs.corpusSource));
  requireVerifiedSourceSeal(seal);
  verifySourceSealCurrent(seal, expected.source.context, expected.source.input);
  const result = token<BoundModels>(); publish(result, freeze({ seal, request, expected: expectedValue, stores, configuration: freeze({ artifact, opening: artifact.opening, manifest }), corpus }));
  configurationPublish(artifact, result); return result;
};

export const requireBoundPlanningConfiguration = (requestValue: OriginalEpisodeRequestV2, artifactValue: EconomicArtifact, manifestValue: FeatureManifestV3): Ref => {
  const request = requireEpisodeRequest(requestValue), artifact = requireArtifact(artifactValue), manifest = requireManifest(manifestValue);
  const bound = configurationLookup(artifact); if (!bound) return reject();
  const stored = requireModelsIdentity(bound);
  if (stored.request !== request || stored.configuration.manifest !== manifest) return reject();
  return requireExpected(stored.expected).refs.featureManifest;
};

export const requireBoundModels = (value: unknown, seal: VerifiedSourceSeal): BoundModels => {
  requireModels(value, seal); return value as BoundModels;
};
export const requireEpisodeConfiguration = (value: unknown, seal: VerifiedSourceSeal, request: OriginalEpisodeRequestV2): void => {
  if (requireModels(value, seal).request !== requireEpisodeRequest(request)) return reject();
};
export const readBoundModelConfiguration = (value: BoundModels, seal: VerifiedSourceSeal): HostedModelConfiguration => requireModels(value, seal).configuration;
export const readBoundCorpusWhite = (value: unknown, request: OriginalEpisodeRequestV2, planningOrdinal: number): readonly ScActionInput[] | null => {
  const stored = requireModelsIdentity(value), checked = requireEpisodeRequest(request);
  if (stored.request !== checked || checked.schedule.suite !== "corpus" || !Number.isSafeInteger(planningOrdinal) || planningOrdinal < 0 || planningOrdinal > 63 || Object.is(planningOrdinal, -0)) return reject();
  return stored.corpus[checked.schedule.caseIndex]![planningOrdinal] ?? null;
};
export const readBoundWorkerLaunch = (value: BoundModels, seal: VerifiedSourceSeal): EpisodeWorkerLaunch => requireExpected(requireModels(value, seal).expected).launch;
export const readBoundChildStartupBytes = (value: BoundModels, seal: VerifiedSourceSeal, request: OriginalEpisodeRequestV2): Uint8Array => {
  const stored = requireModels(value, seal); requireEpisodeConfiguration(value, seal, request);
  const payload = encodeEconomicEpisodeRequest(constructEconomicEpisodeRequest(request, requireExpected(stored.expected).refs.economicPin));
  const bytes = new Uint8Array(payload.length + 4), header = new DataView(bytes.buffer); header.setUint32(0, payload.length, false);
  for (let i = 0; i < payload.length; i++) bytes[i + 4] = payload[i]!;
  requireVerifiedSourceSeal(seal); return bytes;
};
type ChildAuthority = Readonly<{ expected: StartupExpected; stores: StartupByteStores; seal: VerifiedSourceSeal }>;
const childInputs = new WeakMap<object, ChildAuthority>();
const childLookup = WeakMap.prototype.get.bind(childInputs), childPublish = WeakMap.prototype.set.bind(childInputs), childDelete = WeakMap.prototype.delete.bind(childInputs);
export const bindChildStartupInput = (input: Readable, expected: StartupExpected, stores: StartupByteStores, seal: VerifiedSourceSeal): void => {
  requireVerifiedSourceSeal(seal); requireExpected(expected);
  if (types.isProxy(input) || !(input instanceof Readable) || childLookup(input)) return reject();
  const fields = sourceRecord(stores, ["models", "authority", "constituents"], "PROVENANCE");
  childPublish(input, freeze({ expected, stores: freeze({ models: fields.models as RegisteredByteStore, authority: fields.authority as StartupAuthorityBytes, constituents: fields.constituents as RegisteredByteStore }), seal }));
};
const readExactly = async (input: Readable, size: number): Promise<Uint8Array> => {
  const bytes = new Uint8Array(size); let offset = 0;
  while (offset < size) {
    const chunk: unknown = Readable.prototype.read.call(input, size - offset);
    if (chunk === null) { if (input.readableEnded || input.destroyed) return reject(); await once(input, "readable"); continue; }
    if (!types.isUint8Array(chunk) || chunk.byteLength > size - offset) return reject();
    for (let i = 0; i < chunk.byteLength; i++) bytes[offset++] = chunk[i]!;
  }
  return bytes;
};
export const loadChildEpisodeStartup = async (input: Readable): Promise<Readonly<{ context: TrustedExecutionContext; input: Readable }>> => {
  if (input === null || typeof input !== "object") return reject();
  const local = childLookup(input); if (!local) return reject(); childDelete(input);
  requireVerifiedSourceSeal(local.seal);
  const expected = requireExpected(local.expected), header = await readExactly(input, 4), size = new DataView(header.buffer).getUint32(0, false);
  if (size < 1 || size > EPISODE_REQUEST_BYTE_CAP) return reject();
  const payload = await readExactly(input, size), owner = createRegisteredByteStore(), requestRef = physicalRef(payload);
  owner.register("hostConfiguration", requestRef, payload);
  for (const [role, ref] of [["featureManifest", expected.refs.featureManifest], ["economicPin", expected.refs.economicPin]] as const) owner.register(role, ref, checkedBytes(local.stores.models, role, ref));
  const payloadReader = requireRegisteredBytes(local.stores.models, "episodeWeights", expected.refs.episodeWeights);
  const weights = new Uint8Array(payloadReader.length); for (let i = 0; i < weights.length; i++) weights[i] = payloadReader.readByte(i);
  owner.register("episodeWeights", physicalRef(weights), weights);
  const requestStore = owner.seal(), binding = constructEpisodeRequestByteBinding(requestStore, "hostConfiguration", requestRef);
  const wrapper = decodeRegisteredEconomicEpisodeRequest(binding, expected.episode), request = wrapper.originalRequest;
  const models = constructBoundModels(local.expected, local.stores, local.seal, request);
  const context = constructTrustedExecutionContext(request, expected.episode, local.stores.models, local.seal, models);
  requireVerifiedSourceSeal(local.seal); return freeze({ context, input });
};
