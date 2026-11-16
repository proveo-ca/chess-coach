// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { constructRef, requireRef } from "../economic/ownedKernel";
import type { Ref } from "../economic/contracts";
import { types } from "node:util";
import { requireRegisteredBytes, type ByteRole, type RegisteredByteStore } from "./registeredBytes";
import {
  canonicalSourceJson, capturedSourceMember, capturedSourcePhysicalRoot, parseSourceJson, readCapturedSourceFile,
  rejectSourceAuthority, requireCapturedSourceSnapshot, requireSourcePath, sourceArray, sourceRecord, sourceSha256,
  verifyCapturedSourceManifest, type CapturedSourceSnapshot,
} from "./sourceManifest";
import {
  checkBootstrapSourcePolicy, checkClaimedSourceInventoryBytes, copyBootstrapSourcePolicyExpectations,
  type BootstrapSourcePolicyExpectations, type BootstrapSourcePolicyV1,
} from "./sourcePolicy";
import { capturedRuntimeManifest, verifyCapturedRuntimeManifest, type CapturedRuntimeSnapshot } from "./sourceRuntimeSnapshot";

type LoadingContext = Readonly<{ identity: object; epoch: number; snapshot: CapturedSourceSnapshot;
  runtimeSnapshot: CapturedRuntimeSnapshot; requireCurrent(): void; inventory(policy: BootstrapSourcePolicyV1): unknown;
  publicClosure(policy: BootstrapSourcePolicyV1): unknown; loadingMembers(): readonly CapturedCodeLoaderMember[];
  loadingEdges(): readonly Readonly<{ importer: string; specifier: string; target: string }>[] }>;
declare const __sourceLoadingContext: LoadingContext | undefined;
const currentLoading = typeof __sourceLoadingContext === "undefined" ? undefined : __sourceLoadingContext;

export type SourceProvenanceRefs = Readonly<{ source: Ref; sourceInventory: Ref; sourcePolicy: Ref }>;
export type SourceRuntimeRefs = Readonly<{
  dependencyLock: Ref; installedTree: Ref; frozenStore: Ref; toolTree: Ref; image: Ref; runtimeConfiguration: Ref;
}>;
export type SourceHostConfiguration = Readonly<{
  provenance: SourceProvenanceRefs; snapshot: CapturedSourceSnapshot;
  policy: BootstrapSourcePolicyExpectations; runtime: SourceRuntimeRefs;
}>;
declare const contextBrand: unique symbol;
declare const sourceInputBrand: unique symbol;
declare const sealBrand: unique symbol;
declare const scopeKeyBrand: unique symbol;
declare const loadReceiptBrand: unique symbol;
export type SourceBootstrapContext = Readonly<{ [contextBrand]: "independent-parent-source-selection" }>;
export type SourceInput = Readonly<{ [sourceInputBrand]: "unverified-host-source-input" }>;
export type VerifiedSourceSeal = Readonly<{ [sealBrand]: "realm-local-verified-source-seal" }>;
export type SourceActiveScopeKey = Readonly<{ [scopeKeyBrand]: "source-active-scope-key" }>;
export type ImmutableCompiledLoadReceipt = Readonly<{ [loadReceiptBrand]: "host-verified-immutable-compiled-load" }>;
export type CapturedCodeLoaderMember = Readonly<{ path: string; byteLength: number; sha256: string }>;
export type SourceInputSelection = Readonly<
  { kind: "actualFilesystem"; snapshot: CapturedSourceSnapshot; capturedCodeLoaderMap: readonly CapturedCodeLoaderMember[] } |
  { kind: "immutableCompiledLoadReceipt"; snapshot: CapturedSourceSnapshot; receipt: ImmutableCompiledLoadReceipt } |
  { kind: "immutableMemory"; snapshot: CapturedSourceSnapshot }
>;

type Context = {
  readonly store: RegisteredByteStore;
  readonly provenance: SourceProvenanceRefs;
  readonly snapshot: CapturedSourceSnapshot;
  readonly policy: BootstrapSourcePolicyV1;
  readonly runtime: SourceRuntimeRefs;
  readonly scopeKey: SourceActiveScopeKey;
  readonly inventoryBytes: Uint8Array;
  active: boolean;
};
type Input = Readonly<{ context: Context; snapshot: CapturedSourceSnapshot; physicalRoot: string; loading?: LoadingContext;
  capturedCodeLoaderMap: readonly CapturedCodeLoaderMember[] }>;
type Seal = Readonly<{ context: Context; input: Input; snapshot: CapturedSourceSnapshot; runtime: SourceRuntimeRefs;
  loading: LoadingContext; identity: object; epoch: number; inventory: string; publicClosure: string }>;
const contexts = new WeakMap<object, Context>();
const inputs = new WeakMap<object, Input>();
const seals = new WeakMap<object, Seal>();
const lookupContext = WeakMap.prototype.get.bind(contexts);
const publishContext = WeakMap.prototype.set.bind(contexts);
const lookupInput = WeakMap.prototype.get.bind(inputs);
const publishInput = WeakMap.prototype.set.bind(inputs);
const lookupSeal = WeakMap.prototype.get.bind(seals);
const publishSeal = WeakMap.prototype.set.bind(seals);
const RUNTIME_ROLES = Object.freeze(["dependencyLock", "installedTree", "frozenStore", "toolTree", "image", "runtimeConfiguration"] as const);
const token = <T>(): T => Object.freeze(Object.create(null)) as T;

const contextFor = (value: unknown): Context => {
  if (value === null || typeof value !== "object") return rejectSourceAuthority("PROVENANCE");
  const context = lookupContext(value);
  if (!context) return rejectSourceAuthority("PROVENANCE");
  if (!context.active) return rejectSourceAuthority("REVOKED");
  return context;
};
const inputFor = (value: unknown): Input => {
  if (value === null || typeof value !== "object") return rejectSourceAuthority("SOURCE_INPUT");
  const input = lookupInput(value);
  if (!input) return rejectSourceAuthority("SOURCE_INPUT");
  return input;
};
const readRegisteredArtifact = (store: RegisteredByteStore, role: ByteRole, expected: Ref): Uint8Array => {
  const reader = requireRegisteredBytes(store, role, expected);
  if (reader.length > 1048576) return rejectSourceAuthority("LIMIT");
  const bytes = new Uint8Array(reader.length);
  for (let index = 0; index < bytes.length; index++) bytes[index] = reader.readByte(index);
  if (bytes.length !== expected.byteLength || sourceSha256(bytes) !== expected.sha256) return rejectSourceAuthority("PROVENANCE");
  return bytes;
};

export const constructSourceBootstrapContext = (
  trustedParentStore: RegisteredByteStore, trustedHostConfiguration: SourceHostConfiguration,
): SourceBootstrapContext => {
  const config = sourceRecord(trustedHostConfiguration, ["provenance", "snapshot", "policy", "runtime"], "PROVENANCE");
  const refs = sourceRecord(config.provenance, ["source", "sourceInventory", "sourcePolicy"], "PROVENANCE");
  const provenance = Object.freeze({ source: requireRef(refs.source), sourceInventory: requireRef(refs.sourceInventory),
    sourcePolicy: requireRef(refs.sourcePolicy) });
  const snapshot = requireCapturedSourceSnapshot(config.snapshot);
  const expected = copyBootstrapSourcePolicyExpectations(config.policy as BootstrapSourcePolicyExpectations);
  const runtimeFields = sourceRecord(config.runtime, RUNTIME_ROLES, "PROVENANCE");
  const runtime = Object.freeze(Object.fromEntries(RUNTIME_ROLES.map(role => [role, requireRef(runtimeFields[role])])) as SourceRuntimeRefs);
  const source = readRegisteredArtifact(trustedParentStore, "source", provenance.source);
  const inventory = readRegisteredArtifact(trustedParentStore, "sourceInventory", provenance.sourceInventory);
  const policyBytes = readRegisteredArtifact(trustedParentStore, "sourcePolicy", provenance.sourcePolicy);
  verifyCapturedSourceManifest(snapshot, source);
  const policy = checkBootstrapSourcePolicy(policyBytes, expected, snapshot);
  for (const [index, role] of (["sourceInventoryAuditorCode", "publicClosureAuditorCode"] as const).entries()) {
    const auditor = policy.auditors[index]!;
    const wanted = expected.auditorRefs[index]!;
    const bytes = readRegisteredArtifact(trustedParentStore, role, constructRef(wanted.byteLength, wanted.sha256));
    if (bytes.length !== auditor.ref.byteLength || sourceSha256(bytes) !== auditor.ref.sha256) return rejectSourceAuthority("AUDITOR_CODE");
  }
  checkClaimedSourceInventoryBytes(inventory, snapshot, policy);
  for (const role of RUNTIME_ROLES) readRegisteredArtifact(trustedParentStore, role, runtime[role]);
  const context: Context = { store: trustedParentStore, provenance, snapshot, policy, runtime,
    scopeKey: token<SourceActiveScopeKey>(), inventoryBytes: inventory, active: true };
  const result = token<SourceBootstrapContext>();
  publishContext(result, context);
  return result;
};

export const constructUnverifiedSourceInput = (
  expectedContext: SourceBootstrapContext, trustedHostSelection: SourceInputSelection,
): SourceInput => {
  const context = contextFor(expectedContext);
  if (trustedHostSelection === null || typeof trustedHostSelection !== "object" || types.isProxy(trustedHostSelection)) {
    return rejectSourceAuthority("SOURCE_INPUT");
  }
  const selectionKeys = Reflect.ownKeys(trustedHostSelection);
  const base = sourceRecord(trustedHostSelection, selectionKeys.includes("receipt") ?
    ["kind", "snapshot", "receipt"] : selectionKeys.includes("capturedCodeLoaderMap") ?
      ["kind", "snapshot", "capturedCodeLoaderMap"] : ["kind", "snapshot"], "SOURCE_INPUT");
  const snapshot = requireCapturedSourceSnapshot(base.snapshot);
  if (snapshot !== context.snapshot) return rejectSourceAuthority("SOURCE_INPUT");
  if (base.kind === "immutableCompiledLoadReceipt") return rejectSourceAuthority("IMMUTABLE_LOADING_UNSUPPORTED");
  if (base.kind === "immutableMemory") {
    if (!currentLoading || currentLoading.snapshot !== snapshot) return rejectSourceAuthority("IMMUTABLE_LOADING_UNSUPPORTED");
    currentLoading.requireCurrent();
    const result = token<SourceInput>();
    publishInput(result, Object.freeze({ context, snapshot, physicalRoot: capturedSourcePhysicalRoot(snapshot), loading: currentLoading,
      capturedCodeLoaderMap: Object.freeze([]) }));
    return result;
  }
  if (base.kind !== "actualFilesystem") return rejectSourceAuthority("SOURCE_INPUT");
  const members = sourceArray(base.capturedCodeLoaderMap, "SOURCE_INPUT").map(value => {
    const fields = sourceRecord(value, ["path", "byteLength", "sha256"], "SOURCE_INPUT");
    const path = requireSourcePath(fields.path), member = capturedSourceMember(snapshot, path);
    if (member?.type !== "file" || fields.byteLength !== member.bytes || fields.sha256 !== member.sha256) {
      return rejectSourceAuthority("SOURCE_INPUT");
    }
    return Object.freeze({ path, byteLength: member.bytes, sha256: member.sha256 });
  });
  const selected = members.map(member => member.path);
  const selectedPaths = new Set(selected);
  if (selected.some((path, index) => index > 0 && selected[index - 1]! >= path) ||
      context.policy.entrypoints.some(path => !selectedPaths.has(path))) return rejectSourceAuthority("SOURCE_INPUT");
  const result = token<SourceInput>();
  publishInput(result, Object.freeze({ context, snapshot, physicalRoot: capturedSourcePhysicalRoot(snapshot),
    capturedCodeLoaderMap: Object.freeze(members) }));
  return result;
};

const requireLoadingCurrent = (seal: Seal): void => {
  try {
    if (!currentLoading || currentLoading !== seal.loading || seal.identity !== currentLoading.identity || seal.epoch !== currentLoading.epoch ||
        seal.snapshot !== currentLoading.snapshot) return rejectSourceAuthority("SOURCE_INPUT");
    currentLoading.requireCurrent();
  }
  catch (error) { seal.context.active = false; throw error; }
};
const checkLoadingMembers = (context: Context, loading: LoadingContext, inventory: unknown): void => {
  const members = loading.loadingMembers(), paths = new Set<string>();
  for (const member of members) {
    if (typeof member.path !== "string" || !member.path.startsWith("/app/")) return rejectSourceAuthority("SOURCE_INPUT");
    const path = requireSourcePath(member.path.slice(5));
    if (paths.has(path)) return rejectSourceAuthority("SOURCE_INPUT");
    paths.add(path);
    if (!path.split("/").includes("node_modules")) {
      const captured = capturedSourceMember(context.snapshot, path);
      if (captured?.type !== "file" || captured.bytes !== member.byteLength || captured.sha256 !== member.sha256) return rejectSourceAuthority("SOURCE_INPUT");
    } else {
      const runtime = capturedRuntimeManifest(loading.runtimeSnapshot);
      const captured = runtime.installed.flatMap(tree => tree.entries.map(entry => ({ ...entry, absolute: `${tree.root}/${entry.path}` })))
        .find(entry => entry.absolute === member.path);
      if (captured?.type !== "file" || captured.bytes !== member.byteLength || captured.sha256 !== member.sha256) return rejectSourceAuthority("RUNTIME");
    }
  }
  for (const auditor of context.policy.auditors) if (!paths.has(auditor.path)) return rejectSourceAuthority("AUDITOR_CODE");
  if (!paths.has(context.policy.constructorRule.module)) return rejectSourceAuthority("SOURCE_INPUT");
  const edges = ((inventory as { audit: { edges: readonly { importer: string; specifier: string; target: string; targetKind: string; typeOnly?: true }[] } }).audit.edges);
  for (const loaded of loading.loadingEdges()) {
    if (!loaded.importer.startsWith("/app/") || loaded.importer.split("/").includes("node_modules")) continue;
    const importer = loaded.importer.slice(5);
    const candidates = edges.filter(edge => edge.importer === importer && edge.specifier === loaded.specifier && edge.typeOnly !== true);
    if (!candidates.some(edge => edge.targetKind === "source" ? `/app/${edge.target}` === loaded.target : edge.targetKind === "builtin" ?
      `node:${edge.target.replace(/^node:/, "")}` === loaded.target : loaded.target.startsWith("/app/") && loaded.target.split("/").includes("node_modules"))) {
      return rejectSourceAuthority("INVENTORY");
    }
  }
};
const checkPublicClosureMembers = (context: Context, loading: LoadingContext, value: unknown): void => {
  const report = sourceRecord(value, ["version", "passed", "conditions", "entries", "verifiedPaths", "sourceFiles", "dependencyFiles",
    "runtimeFiles", "edges", "sourceSha256", "dependencySha256", "runtimeSha256", "tooling", "closureSha256"], "INVENTORY");
  if (report.version !== "public-closure-v2" || report.passed !== true) return rejectSourceAuthority("INVENTORY");
  const entries = sourceArray(report.entries, "INVENTORY").map(value => sourceRecord(value, ["package", "subpath", "path"], "INVENTORY"));
  const required = ["packages/starchess-core/src/planning-v1.ts", ...["observations", "intent-codec-v1", "events"].map(name => `packages/starchess-arena/src/${name}.ts`),
    ...["candidates", "features", "artifacts"].map(name => `packages/starchess-training/src/${name}.ts`).filter(path => capturedSourceMember(context.snapshot, path)?.type === "file")].sort();
  if (canonicalSourceJson(entries.map(entry => entry.path).sort()) !== canonicalSourceJson(required)) return rejectSourceAuthority("AUDITOR_ENFORCEMENT_UNSUPPORTED");
  const paths = new Set<string>();
  for (const value of sourceArray(report.sourceFiles, "INVENTORY")) {
    const file = sourceRecord(value, ["path", "sha256"], "INVENTORY"), path = requireSourcePath(file.path);
    const member = capturedSourceMember(context.snapshot, path);
    if (paths.has(path) || member?.type !== "file" || file.sha256 !== member.sha256) return rejectSourceAuthority("INVENTORY");
    paths.add(path);
  }
  const runtime = capturedRuntimeManifest(loading.runtimeSnapshot);
  for (const value of sourceArray(report.dependencyFiles, "INVENTORY")) {
    const file = sourceRecord(value, ["path", "resolvedPath", "sha256"], "INVENTORY"), selected = `/app/${requireSourcePath(file.resolvedPath)}`;
    const member = runtime.installed.flatMap(tree => tree.entries.map(entry => ({ ...entry, absolute: `${tree.root}/${entry.path}` }))).find(entry => entry.absolute === selected);
    if (member?.type !== "file" || member.sha256 !== file.sha256 || typeof file.path !== "string" || paths.has(file.path)) return rejectSourceAuthority("RUNTIME");
    paths.add(file.path);
  }
  if (canonicalSourceJson(sourceArray(report.verifiedPaths, "INVENTORY")) !== canonicalSourceJson([
    ...sourceArray(report.sourceFiles, "INVENTORY"), ...sourceArray(report.dependencyFiles, "INVENTORY"),
  ].map(value => (value as { path: string }).path))) return rejectSourceAuthority("INVENTORY");
  for (const value of sourceArray(report.edges, "INVENTORY")) {
    if (value === null || typeof value !== "object") return rejectSourceAuthority("INVENTORY");
    const edge = value as { importer?: unknown; target?: unknown; typeOnly?: unknown; targetKind?: unknown };
    if (typeof edge.importer !== "string" || !paths.has(edge.importer) ||
        (edge.targetKind !== "erased-external" || edge.typeOnly !== true) && (typeof edge.target !== "string" || !paths.has(edge.target))) return rejectSourceAuthority("INVENTORY");
  }
  for (const value of sourceArray(report.runtimeFiles, "INVENTORY")) {
    const file = sourceRecord(value, ["path", "sha256"], "INVENTORY"), member = capturedSourceMember(context.snapshot, requireSourcePath(file.path));
    if (member?.type !== "file" || member.sha256 !== file.sha256) return rejectSourceAuthority("INVENTORY");
  }
  for (const [field, digest] of [["sourceFiles", "sourceSha256"], ["dependencyFiles", "dependencySha256"], ["runtimeFiles", "runtimeSha256"]] as const) {
    if (sourceSha256(JSON.stringify(report[field])) !== report[digest]) return rejectSourceAuthority("INVENTORY");
  }
  const tooling = sourceRecord(report.tooling, ["package", "version", "declaredBy", "path", "sha256"], "INVENTORY");
  const toolPath = `/app/${requireSourcePath(tooling.path)}`;
  if (tooling.package !== "typescript" || tooling.version !== "5.9.3" || !loading.loadingMembers().some(member =>
    member.path === toolPath && member.sha256 === tooling.sha256 && member.path.endsWith("/typescript/lib/typescript.js"))) return rejectSourceAuthority("RUNTIME");
  const { closureSha256, ...descriptor } = report;
  if (sourceSha256(JSON.stringify(descriptor)) !== closureSha256) return rejectSourceAuthority("INVENTORY");
};
const checkRuntimeBindings = (context: Context, loading: LoadingContext): void => {
  const runtime = capturedRuntimeManifest(loading.runtimeSnapshot);
  verifyCapturedRuntimeManifest(loading.runtimeSnapshot, readRegisteredArtifact(context.store, "installedTree", context.runtime.installedTree));
  const lock = readCapturedSourceFile(context.snapshot, "pnpm-lock.yaml");
  if (lock.length !== context.runtime.dependencyLock.byteLength || sourceSha256(lock) !== context.runtime.dependencyLock.sha256) return rejectSourceAuthority("RUNTIME");
  for (const [role, tree] of [["frozenStore", runtime.frozenStore], ["toolTree", runtime.tools]] as const) {
    if (new TextDecoder("utf-8", { fatal: true }).decode(readRegisteredArtifact(context.store, role, context.runtime[role])) !== JSON.stringify(tree, null, 2) + "\n") {
      return rejectSourceAuthority("RUNTIME");
    }
  }
  return rejectSourceAuthority("RUNTIME_IMAGE_BINDING_UNSUPPORTED");
};

export const bootstrapSourceAuthority = (expectedContext: SourceBootstrapContext, sourceInput: SourceInput): VerifiedSourceSeal => {
  const context = contextFor(expectedContext);
  try {
    const input = inputFor(sourceInput);
    if (input.context !== context || input.snapshot !== context.snapshot || input.physicalRoot !== capturedSourcePhysicalRoot(context.snapshot)) {
      return rejectSourceAuthority("SOURCE_INPUT");
    }
    const loading = input.loading;
    if (!loading || !currentLoading || loading !== currentLoading || loading.snapshot !== context.snapshot) return rejectSourceAuthority("IMMUTABLE_LOADING_UNSUPPORTED");
    loading.requireCurrent();
    const inventory = loading.inventory(context.policy), publicClosure = loading.publicClosure(context.policy);
    loading.requireCurrent();
    const computed = canonicalSourceJson(inventory);
    if (computed !== canonicalSourceJson(parseSourceJson(context.inventoryBytes, "INVENTORY"))) return rejectSourceAuthority("INVENTORY");
    checkPublicClosureMembers(context, loading, publicClosure);
    checkLoadingMembers(context, loading, inventory);
    checkRuntimeBindings(context, loading);
    const result = token<VerifiedSourceSeal>();
    publishSeal(result, Object.freeze({ context, input, snapshot: context.snapshot, runtime: context.runtime, loading,
      identity: loading.identity, epoch: loading.epoch, inventory: computed, publicClosure: canonicalSourceJson(publicClosure) }));
    return result;
  } catch (error) {
    context.active = false;
    throw error;
  }
};

export const requireVerifiedSourceSeal = (value: unknown): VerifiedSourceSeal => {
  if (value === null || typeof value !== "object") return rejectSourceAuthority("PROVENANCE");
  const seal = lookupSeal(value);
  if (!seal) return rejectSourceAuthority("PROVENANCE");
  if (!seal.context.active) return rejectSourceAuthority("REVOKED");
  requireLoadingCurrent(seal);
  return value as VerifiedSourceSeal;
};
export const verifySourceSealCurrent = (
  value: unknown, expectedContext: SourceBootstrapContext, sourceInput: SourceInput,
): void => {
  const seal = lookupSeal(requireVerifiedSourceSeal(value))!;
  const context = contextFor(expectedContext), input = inputFor(sourceInput);
  if (seal.context !== context || seal.input !== input || seal.snapshot !== context.snapshot || seal.runtime !== context.runtime) {
    seal.context.active = false;
    return rejectSourceAuthority("SOURCE_INPUT");
  }
  requireLoadingCurrent(seal);
};
export const requireSourceActiveScopeKey = (
  seal: VerifiedSourceSeal, expectedContext: SourceBootstrapContext, sourceInput: SourceInput,
): SourceActiveScopeKey => {
  verifySourceSealCurrent(seal, expectedContext, sourceInput);
  return contextFor(expectedContext).scopeKey;
};
export const revokeSourceBootstrapContext = (expectedContext: SourceBootstrapContext): void => {
  const context = contextFor(expectedContext);
  context.active = false;
};
