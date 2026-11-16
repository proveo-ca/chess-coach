// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { visitR3EconomicInputs, type R3EconomicInput } from "@chess-coach/starchess-arena";
import type { BoundModels } from "./startupScope";
import { requireVerifiedSourceSeal, type VerifiedSourceSeal } from "./sourceBootstrap";
import { composeCandidatesFromHistoryV2 } from "../candidates";
import type { CandidateBatchV3 } from "../contracts";
import type {
  Candidate, CheckedBoundary, EconomicArtifact, EconomicBeliefState, EconomicReadout, FeatureBlocksV3, FeatureManifestV3, History, Meter, PublicOpening,
} from "../economic/contracts";
import {
  createPlanningLedger, requireArtifact, requireBoundary, requireCandidate, requireFeatureBlocks, requireHistory, requireReadout, requireState,
  type LedgerOwner, type IngressTicket,
} from "../economic/ownedKernel";
import { checkedExtent } from "../economic/invoices";
import { authenticateAcceptedPermit, EpisodeVerificationError, replicaRequest, type LocalAcceptedPermit } from "./episodeVerification";

declare const scopeBrand: unique symbol;
const freeze = Object.freeze;
const FixedMap = WeakMap, FixedSet = WeakSet;
const getIdentity = Function.prototype.call.bind(WeakMap.prototype.get) as <T>(map: WeakMap<object, T>, key: object) => T | undefined;
const setIdentity = Function.prototype.call.bind(WeakMap.prototype.set) as <T>(map: WeakMap<object, T>, key: object, value: T) => void;
const hasIdentity = Function.prototype.call.bind(WeakSet.prototype.has) as (set: WeakSet<object>, key: object) => boolean;
const addIdentity = Function.prototype.call.bind(WeakSet.prototype.add) as (set: WeakSet<object>, key: object) => void;
const privateMap = <T>() => {
  const map = new FixedMap<object, T>();
  return freeze({ get: (key: object): T | undefined => getIdentity(map, key), set: (key: object, value: T): void => setIdentity(map, key, value) });
};
const privateSet = () => {
  const set = new FixedSet<object>();
  return freeze({ has: (key: object): boolean => hasIdentity(set, key), add: (key: object): void => addIdentity(set, key) });
};
export type PrivateHostedScope = Readonly<{ [scopeBrand]: "private-hosted-planning-scope" }>;
export type OwnedPlanningInput = Readonly<{ history: History; boundary: CheckedBoundary }>;
export type HostedModelConfiguration = Readonly<{ artifact: EconomicArtifact; opening: PublicOpening; manifest: FeatureManifestV3 }>;
type Control = {
  acceptedPermit: LocalAcceptedPermit; meter: Meter; owner: LedgerOwner; seal: VerifiedSourceSeal; models: BoundModels;
  startup: typeof import("./startupScope"); adapter: typeof import("./economicAdapter");
  artifact: EconomicArtifact; opening: PublicOpening; manifest: FeatureManifestV3; inputs: OwnedPlanningInput[]; current: number;
  state: EconomicBeliefState | null; batch: CandidateBatchV3 | null; features: ReturnType<typeof privateSet>; phase: "open" | "dispatch" | "closed" | "failed";
};
const scopes = privateMap<Control>();
const meterScopes = privateMap<PrivateHostedScope>();
const reject = (reason: "permit" | "source" | "identity" | "ledger" | "provenance" | "nonmember"): never => { throw new EpisodeVerificationError(reason); };
const identity = (value: unknown): Control => {
  if (value === null || typeof value !== "object") return reject("permit");
  const c = scopes.get(value);
  if (!c || c.phase !== "open") return reject("permit");
  return c;
};
const check = (scope: PrivateHostedScope, c: Control): void => {
  const permit = authenticateAcceptedPermit(c.acceptedPermit);
  if (meterScopes.get(c.meter) !== scope || permit.sourceSeal !== c.seal || permit.boundModels !== c.models) return reject("identity");
  if (requireVerifiedSourceSeal(c.seal) !== c.seal || c.startup.requireBoundModels(c.models, c.seal) !== c.models) return reject("source");
  c.startup.requireEpisodeConfiguration(c.models, c.seal, replicaRequest(permit.replica));
  const configuration: HostedModelConfiguration = c.startup.readBoundModelConfiguration(c.models, c.seal);
  if (configuration.artifact !== c.artifact || configuration.opening !== c.opening || configuration.manifest !== c.manifest) return reject("identity");
};
export const recheckPlanningScope = (scope: PrivateHostedScope): void => {
  const c = identity(scope);
  try { check(scope, c); }
  catch (error) { abortPlanningScope(scope); throw error; }
};

export const openPlanningScope = async (acceptedPermit: LocalAcceptedPermit): Promise<PrivateHostedScope> => {
  const initial = authenticateAcceptedPermit(acceptedPermit);
  if (initial.permit.role !== "candidate") return reject("permit");
  const seal = requireVerifiedSourceSeal(initial.sourceSeal);
  const [startup, adapter] = await Promise.all([import("./startupScope"), import("./economicAdapter")]);
  const models = startup.requireBoundModels(initial.boundModels, seal);
  const configuration: HostedModelConfiguration = startup.readBoundModelConfiguration(models, seal);
  startup.requireEpisodeConfiguration(models, seal, replicaRequest(initial.replica));
  const current = authenticateAcceptedPermit(acceptedPermit, true);
  if (current.sourceSeal !== seal || current.boundModels !== models) return reject("identity");
  requireVerifiedSourceSeal(seal);
  const pair = createPlanningLedger();
  const scope = Object.freeze({}) as PrivateHostedScope;
  const c: Control = { acceptedPermit, meter: pair.meter, owner: pair.owner, seal, models, startup, adapter,
    artifact: configuration.artifact, opening: configuration.opening, manifest: configuration.manifest, inputs: [], current: -1, state: null, batch: null,
    features: privateSet(), phase: "open" };
  scopes.set(scope, c); meterScopes.set(c.meter, scope);
  try {
    c.owner.admitOnce(); check(scope, c);
    let visit: IngressTicket | null = null, node: IngressTicket | null = null;
    const charge = (units: number): void => {
      if (units === 128 && !visit && !node) visit = c.owner.beginR3Visit();
      else if (units === 256 && visit && !node) node = c.owner.beginR3Node();
      else if (units === 64 && visit && node) {
        const bytes = c.owner.beginR3ByteReads(checkedExtent(1, 1048576));
        c.owner.finishIngress(bytes);
      } else return reject("ledger");
    };
    const reconstruct = (input: R3EconomicInput): void => {
      if (!visit || !node || c.inputs.length >= 91) return reject("ledger");
      let completed = false;
      try {
        const owned: OwnedPlanningInput = adapter.reconstructEconomicInput(input, c.meter);
        c.inputs.push(Object.freeze({ history: requireHistory(owned.history), boundary: requireBoundary(owned.boundary) }));
        if (input.boundary.ordinal === current.session.recipients[current.permit.side].batch.ordinal) {
          const generated = composeCandidatesFromHistoryV2(owned.history);
          if (generated.version !== "challenge-composition-v3" || generated.candidates.length < 1 || generated.candidates.length > 512) return reject("nonmember");
          const batch: CandidateBatchV3 = adapter.constructOwnedGeneratedBatch(owned.history, generated, c.meter);
          if (batch.version !== generated.version || batch.candidates.length !== generated.candidates.length) return reject("provenance");
          c.batch = batch;
        }
        completed = true;
      } finally {
        const pending = node; node = null;
        if (pending) {
          if (completed) c.owner.finishIngress(pending);
          else { try { c.owner.finishIngress(pending); } catch { } }
        }
      }
    };
    let visited = false;
    try { visitR3EconomicInputs(current.binding, current.session, current.permit.side, -1, charge, reconstruct); visited = true; }
    finally {
      if (visited) { if (node) c.owner.finishIngress(node); if (visit) c.owner.finishIngress(visit); }
      else {
        if (node) { try { c.owner.finishIngress(node); } catch { } }
        if (visit) { try { c.owner.finishIngress(visit); } catch { } }
      }
    }
    if (!c.inputs.length || c.inputs[c.inputs.length - 1]!.history.currentAuthorizedSnapshotV2.side !== current.permit.side ||
      c.inputs[c.inputs.length - 1]!.boundary.planningOrdinal !== current.permit.planningOrdinal) return reject("provenance");
    check(scope, c);
    return scope;
  } catch (error) { abortPlanningScope(scope); throw error; }
};
const arm = (c: Control, operation: "initialize" | "advance" | "readout" | "encode" | "flatten"): void => {
  if (operation === "initialize") c.owner.armInitialize();
  else if (operation === "advance") c.owner.armAdvance();
  else if (operation === "readout") c.owner.armReadout();
  else if (operation === "encode") c.owner.armEncode();
  else c.owner.armFlatten();
  c.phase = "dispatch";
};
const failDispatch = (scope: PrivateHostedScope, c: Control, error: unknown): never => {
  c.phase = "open"; abortPlanningScope(scope); throw error;
};
export const hostedInitializeEconomicState = (scope: PrivateHostedScope, opening: PublicOpening, boundary: CheckedBoundary,
  artifact: EconomicArtifact): EconomicBeliefState => {
  const c = identity(scope);
  try {
    check(scope, c);
    if (c.state !== null || c.current !== -1 || opening !== c.opening || artifact !== c.artifact || boundary !== c.inputs[0]!.boundary || boundary.phase !== "initial") return reject("identity");
    requireArtifact(artifact); requireBoundary(boundary);
    arm(c, "initialize");
    const state = requireState(c.adapter.initializeEconomicState(opening, boundary, artifact, c.meter));
    c.phase = "open"; check(scope, c); c.state = state; c.current = 0;
    return state;
  } catch (error) { return failDispatch(scope, c, error); }
};
export const hostedAdvanceEconomicState = (scope: PrivateHostedScope, state: EconomicBeliefState, boundary: CheckedBoundary,
  artifact: EconomicArtifact): EconomicBeliefState => {
  const c = identity(scope);
  try {
    check(scope, c);
    if (state !== c.state || artifact !== c.artifact || !c.inputs[c.current + 1] || boundary !== c.inputs[c.current + 1]!.boundary) return reject("identity");
    requireState(state); requireBoundary(boundary); requireArtifact(artifact);
    arm(c, "advance");
    const next = requireState(c.adapter.advanceEconomicState(state, boundary, artifact, c.meter));
    c.phase = "open"; check(scope, c); c.state = next; c.current++;
    return next;
  } catch (error) { return failDispatch(scope, c, error); }
};
const currentBindings = (c: Control, history: History, state: EconomicBeliefState, artifact: EconomicArtifact): void => {
  if (c.current !== c.inputs.length - 1 || history !== c.inputs[c.current]!.history || state !== c.state || artifact !== c.artifact ||
    state.side !== history.currentAuthorizedSnapshotV2.side || state.ordinal !== c.inputs[c.current]!.boundary.ordinal) return reject("identity");
  requireHistory(history); requireState(state); requireArtifact(artifact);
};
export const hostedReadoutEconomic = (scope: PrivateHostedScope, history: History, state: EconomicBeliefState,
  artifact: EconomicArtifact): EconomicReadout => {
  const c = identity(scope);
  try {
    check(scope, c); currentBindings(c, history, state, artifact);
    arm(c, "readout");
    const result = requireReadout(c.adapter.readoutEconomic(history, state, artifact, c.meter));
    c.phase = "open"; check(scope, c); return result;
  } catch (error) { return failDispatch(scope, c, error); }
};
export const generatePlanningCandidates = (scope: PrivateHostedScope): CandidateBatchV3 => {
  const c = identity(scope);
  try {
    check(scope, c);
    if (c.current !== c.inputs.length - 1 || c.state === null || c.batch === null) return reject("identity");
    check(scope, c); return c.batch;
  } catch (error) { return failDispatch(scope, c, error); }
};
export const hostedEncodeFeaturesV3 = (scope: PrivateHostedScope, history: History, state: EconomicBeliefState,
  batch: CandidateBatchV3, candidate: Candidate, artifact: EconomicArtifact): FeatureBlocksV3 => {
  const c = identity(scope);
  try {
    check(scope, c); currentBindings(c, history, state, artifact);
    if (batch !== c.batch || !batch.candidates.includes(candidate)) return reject("nonmember");
    requireCandidate(candidate);
    arm(c, "encode");
    const result = requireFeatureBlocks(c.adapter.encodeFeaturesV3(history, state, candidate, artifact, c.meter));
    c.phase = "open"; check(scope, c); c.features.add(result); return result;
  } catch (error) { return failDispatch(scope, c, error); }
};
export const hostedFlattenFeaturesV3 = (scope: PrivateHostedScope, blocks: FeatureBlocksV3): Float64Array => {
  const c = identity(scope);
  try {
    check(scope, c);
    if (blocks === null || typeof blocks !== "object" || !c.features.has(blocks)) return reject("identity");
    requireFeatureBlocks(blocks);
    arm(c, "flatten");
    const result = c.adapter.flattenFeaturesV3(blocks, c.meter);
    c.phase = "open"; check(scope, c);
    if (!(result instanceof Float64Array) || result.length !== 418) return reject("provenance");
    return result;
  } catch (error) { return failDispatch(scope, c, error); }
};
export const readPlanningBindings = (scope: PrivateHostedScope): Readonly<{
  history: History; boundaries: readonly CheckedBoundary[]; state: EconomicBeliefState | null; artifact: EconomicArtifact; opening: PublicOpening; manifest: FeatureManifestV3;
}> => {
  const c = identity(scope); recheckPlanningScope(scope);
  return Object.freeze({ history: c.inputs[c.inputs.length - 1]!.history, boundaries: Object.freeze(c.inputs.map(input => input.boundary)),
    state: c.state, artifact: c.artifact, opening: c.opening, manifest: c.manifest });
};
export const closePlanningScope = (scope: PrivateHostedScope): void => {
  const c = identity(scope); recheckPlanningScope(scope);
  try { c.owner.close(); c.phase = "closed"; }
  catch (error) { abortPlanningScope(scope); throw error; }
};
export const abortPlanningScope = (scope: PrivateHostedScope): void => {
  const c = scopes.get(scope);
  if (!c || c.phase === "failed" || c.phase === "closed") return;
  c.phase = "failed";
  try { c.owner.abort(); } catch { }
};
