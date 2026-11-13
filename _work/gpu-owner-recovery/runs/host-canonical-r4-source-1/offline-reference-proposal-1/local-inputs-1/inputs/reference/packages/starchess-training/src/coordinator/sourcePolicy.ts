// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import type { Ref } from "../economic/contracts";
import {
  canonicalSourceJson, capturedSourceManifest, capturedSourceMember, parseSourceJson, readCapturedSourceFile,
  rejectSourceAuthority, requireSourcePath, sourceArray, sourceRecord, sourceSha256, type CapturedSourceSnapshot,
} from "./sourceManifest";

export const BOOTSTRAP_SOURCE_POLICY_VERSION = "starchess-r4-bootstrap-source-policy-v1";
export const BOOTSTRAP_INVENTORY_VERSION = "challenge-source-inventory-v2";
export const BOOTSTRAP_INVENTORY_POLICY_VERSION = "challenge-source-policy-v2";
export const BOOTSTRAP_AUDITOR_PATHS = Object.freeze([
  "packages/starchess-arena/src/challenge/sourceInventory.ts",
  "packages/starchess-arena/hermetic/public-closure.mjs",
] as const);
export const BOOTSTRAP_CONSTRUCTOR_RULE = Object.freeze({
  module: "packages/starchess-training/src/economic/ownedKernel.ts",
  binding: "createPlanningLedger",
  importer: "packages/starchess-training/src/coordinator/planningScope.ts",
  types: Object.freeze(["LedgerPair", "LedgerOwner"] as const),
});
export const BOOTSTRAP_SOURCE_ROOTS = Object.freeze(["packages/starchess-core/src", "packages/starchess-arena/src", "packages/starchess-training/src",
  "scripts", "packages/starchess-arena/hermetic"].sort());
const PUBLIC_ENTRYPOINTS = [
  "packages/starchess-core/src/index.ts", "packages/starchess-core/src/planning-v1.ts",
  "packages/starchess-arena/src/index.ts", "packages/starchess-arena/src/observations.ts",
  "packages/starchess-arena/src/events.ts", "packages/starchess-arena/src/intent-codec-v1.ts",
  "packages/starchess-training/src/candidates.ts",
];
const PARTITIONS = ["core-rules", "arena-authorized", "arena-host", "training-model", "training-coordinator", "verification-tooling"] as const;
const order = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const equal = (a: unknown, b: unknown): boolean => canonicalSourceJson(a) === canonicalSourceJson(b);
const digest = (value: unknown): string => sourceSha256(canonicalSourceJson(value));
const hash = (value: unknown, code: "POLICY" | "INVENTORY"): string => {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) return rejectSourceAuthority(code);
  return value;
};

export type BootstrapSourcePolicyV1 = Readonly<{
  version: typeof BOOTSTRAP_SOURCE_POLICY_VERSION;
  inventoryVersion: typeof BOOTSTRAP_INVENTORY_VERSION;
  policyVersion: typeof BOOTSTRAP_INVENTORY_POLICY_VERSION;
  auditors: readonly [Readonly<{ path: typeof BOOTSTRAP_AUDITOR_PATHS[0]; ref: Ref }>,
    Readonly<{ path: typeof BOOTSTRAP_AUDITOR_PATHS[1]; ref: Ref }>];
  constructorRule: typeof BOOTSTRAP_CONSTRUCTOR_RULE;
  roots: readonly string[];
  entrypoints: readonly string[];
}>;
export type BootstrapSourcePolicyExpectations = Readonly<{
  roots: readonly string[]; entrypoints: readonly string[]; auditorRefs: readonly [Ref, Ref];
}>;

const paths = (value: unknown, code: "POLICY" | "INVENTORY"): readonly string[] => {
  const result = sourceArray(value, code).map(requireSourcePath);
  if (!result.length || result.some((path, index) => index > 0 && order(result[index - 1]!, path) >= 0)) {
    return rejectSourceAuthority(code);
  }
  return Object.freeze(result);
};
const ref = (value: unknown): Ref => {
  const parsed = sourceRecord(value, ["byteLength", "sha256"], "POLICY");
  if (typeof parsed.byteLength !== "number" || !Number.isSafeInteger(parsed.byteLength) || Object.is(parsed.byteLength, -0) ||
      parsed.byteLength < 0 || parsed.byteLength > 1048576) return rejectSourceAuthority("POLICY");
  return Object.freeze({ byteLength: parsed.byteLength, sha256: hash(parsed.sha256, "POLICY") });
};
export const copyBootstrapSourcePolicyExpectations = (value: BootstrapSourcePolicyExpectations): BootstrapSourcePolicyExpectations => {
  const fields = sourceRecord(value, ["roots", "entrypoints", "auditorRefs"], "POLICY");
  const roots = paths(fields.roots, "POLICY"), entrypoints = paths(fields.entrypoints, "POLICY");
  const refs = sourceArray(fields.auditorRefs, "POLICY");
  if (refs.length !== 2 || !equal(roots, BOOTSTRAP_SOURCE_ROOTS) ||
      [...PUBLIC_ENTRYPOINTS, BOOTSTRAP_CONSTRUCTOR_RULE.importer, BOOTSTRAP_CONSTRUCTOR_RULE.module].some(path => !entrypoints.includes(path))) {
    return rejectSourceAuthority("POLICY");
  }
  return Object.freeze({ roots, entrypoints, auditorRefs: Object.freeze([ref(refs[0]), ref(refs[1])] as const) });
};
export const encodeBootstrapSourcePolicy = (hostExpected: BootstrapSourcePolicyExpectations): Uint8Array => {
  const expected = copyBootstrapSourcePolicyExpectations(hostExpected);
  const policy: BootstrapSourcePolicyV1 = {
    version: BOOTSTRAP_SOURCE_POLICY_VERSION, inventoryVersion: BOOTSTRAP_INVENTORY_VERSION,
    policyVersion: BOOTSTRAP_INVENTORY_POLICY_VERSION,
    auditors: [{ path: BOOTSTRAP_AUDITOR_PATHS[0], ref: expected.auditorRefs[0] },
      { path: BOOTSTRAP_AUDITOR_PATHS[1], ref: expected.auditorRefs[1] }],
    constructorRule: BOOTSTRAP_CONSTRUCTOR_RULE, roots: expected.roots, entrypoints: expected.entrypoints,
  };
  return new TextEncoder().encode(canonicalSourceJson(policy));
};

export const checkBootstrapSourcePolicy = (
  registeredBytes: Uint8Array, hostExpected: BootstrapSourcePolicyExpectations, snapshot: CapturedSourceSnapshot,
): BootstrapSourcePolicyV1 => {
  const expected = copyBootstrapSourcePolicyExpectations(hostExpected);
  const record = sourceRecord(parseSourceJson(registeredBytes, "POLICY"),
    ["version", "inventoryVersion", "policyVersion", "auditors", "constructorRule", "roots", "entrypoints"], "POLICY");
  if (record.version !== BOOTSTRAP_SOURCE_POLICY_VERSION || record.inventoryVersion !== BOOTSTRAP_INVENTORY_VERSION ||
      record.policyVersion !== BOOTSTRAP_INVENTORY_POLICY_VERSION) return rejectSourceAuthority("POLICY");
  const constructor = sourceRecord(record.constructorRule, ["module", "binding", "importer", "types"], "POLICY");
  if (!equal(constructor, BOOTSTRAP_CONSTRUCTOR_RULE)) return rejectSourceAuthority("POLICY");
  const roots = paths(record.roots, "POLICY"), entrypoints = paths(record.entrypoints, "POLICY");
  if (!equal(roots, expected.roots) || !equal(entrypoints, expected.entrypoints)) return rejectSourceAuthority("POLICY");
  for (const path of roots) if (capturedSourceMember(snapshot, path)?.type !== "directory") return rejectSourceAuthority("POLICY");
  for (const path of entrypoints) if (capturedSourceMember(snapshot, path)?.type !== "file") return rejectSourceAuthority("POLICY");
  const requiredPrivate = capturedSourceManifest(snapshot).entries.filter(entry => entry.type === "file" &&
    /^(?:packages\/starchess-training\/src\/(?:coordinator|cli)\/|packages\/starchess-arena\/src\/(?:challenge|cli)\/)/.test(entry.path) &&
    /\.(?:[cm]?[jt]s|[jt]sx)$/.test(entry.path) && !entry.path.split("/").includes("__tests__")).map(entry => entry.path);
  const requiredPublic = ["features", "artifacts"].map(name => `packages/starchess-training/src/${name}.ts`)
    .filter(path => capturedSourceMember(snapshot, path)?.type === "file");
  if ([...requiredPrivate, ...requiredPublic].some(path => !entrypoints.includes(path))) return rejectSourceAuthority("POLICY");
  const auditors = sourceArray(record.auditors, "POLICY");
  if (auditors.length !== 2) return rejectSourceAuthority("POLICY");
  for (let index = 0; index < 2; index++) {
    const auditor = sourceRecord(auditors[index], ["path", "ref"], "POLICY");
    const path = BOOTSTRAP_AUDITOR_PATHS[index]!;
    const claim = ref(auditor.ref), wanted = expected.auditorRefs[index]!;
    if (auditor.path !== path || !equal(claim, wanted)) return rejectSourceAuthority("AUDITOR_CODE");
    const member = capturedSourceMember(snapshot, path);
    if (member?.type !== "file" || member.bytes !== wanted.byteLength || member.sha256 !== wanted.sha256) {
      return rejectSourceAuthority("AUDITOR_CODE");
    }
    const consumed = readCapturedSourceFile(snapshot, path);
    if (consumed.length !== wanted.byteLength || sourceSha256(consumed) !== wanted.sha256) return rejectSourceAuthority("AUDITOR_CODE");
  }
  const policy: BootstrapSourcePolicyV1 = Object.freeze({ version: BOOTSTRAP_SOURCE_POLICY_VERSION,
    inventoryVersion: BOOTSTRAP_INVENTORY_VERSION, policyVersion: BOOTSTRAP_INVENTORY_POLICY_VERSION,
    auditors: Object.freeze([
      Object.freeze({ path: BOOTSTRAP_AUDITOR_PATHS[0], ref: expected.auditorRefs[0] }),
      Object.freeze({ path: BOOTSTRAP_AUDITOR_PATHS[1], ref: expected.auditorRefs[1] }),
    ] as const), constructorRule: BOOTSTRAP_CONSTRUCTOR_RULE, roots, entrypoints });
  if (new TextDecoder("utf-8", { fatal: true }).decode(registeredBytes) !== canonicalSourceJson(policy)) return rejectSourceAuthority("POLICY");
  return policy;
};

type File = Readonly<{ path: string; sha256: string; partition: typeof PARTITIONS[number] }>;
const checkedFile = (value: unknown, snapshot: CapturedSourceSnapshot): File => {
  const file = sourceRecord(value, ["path", "sha256", "partition"], "INVENTORY");
  const path = requireSourcePath(file.path), sha256 = hash(file.sha256, "INVENTORY");
  if (!PARTITIONS.includes(file.partition as typeof PARTITIONS[number])) return rejectSourceAuthority("INVENTORY");
  const member = capturedSourceMember(snapshot, path);
  if (member?.type !== "file" || member.sha256 !== sha256 || sourceSha256(readCapturedSourceFile(snapshot, path)) !== sha256) {
    return rejectSourceAuthority("INVENTORY");
  }
  return { path, sha256, partition: file.partition as typeof PARTITIONS[number] };
};
const excludedTest = (path: string): boolean => ["starchess-core", "starchess-arena", "starchess-training"].some(name =>
  path.startsWith(`packages/${name}/src/`) && path.split("/").includes("__tests__"));

export const checkClaimedSourceInventoryBytes = (
  registeredBytes: Uint8Array, snapshot: CapturedSourceSnapshot, policy: BootstrapSourcePolicyV1,
): void => {
  const record = sourceRecord(parseSourceJson(registeredBytes, "INVENTORY"),
    ["version", "policyVersion", "roots", "entrypoints", "files", "groups", "partitionSha256", "runtime",
      "runtimeConfigurationSha256", "inventorySha256", "audit"], "INVENTORY");
  if (record.version !== BOOTSTRAP_INVENTORY_VERSION || record.policyVersion !== BOOTSTRAP_INVENTORY_POLICY_VERSION ||
      !equal(paths(record.roots, "INVENTORY"), policy.roots) || !equal(paths(record.entrypoints, "INVENTORY"), policy.entrypoints)) {
    return rejectSourceAuthority("INVENTORY");
  }
  const files = sourceArray(record.files, "INVENTORY").map(value => checkedFile(value, snapshot));
  const actual = capturedSourceManifest(snapshot).entries.filter(entry => entry.type === "file" && !excludedTest(entry.path) &&
    policy.roots.some(root => entry.path.startsWith(`${root}/`))).map(entry => entry.path).sort(order);
  const members = new Set(actual);
  if (!equal(files.map(file => file.path), actual) || policy.entrypoints.some(path => !members.has(path))) return rejectSourceAuthority("INVENTORY");
  if (capturedSourceManifest(snapshot).entries.some(entry => entry.type === "symlink" &&
      policy.roots.some(root => entry.path === root || entry.path.startsWith(`${root}/`)))) return rejectSourceAuthority("INVENTORY");
  const groups = sourceRecord(record.groups, PARTITIONS, "INVENTORY");
  const hashes = sourceRecord(record.partitionSha256, PARTITIONS, "INVENTORY");
  for (const partition of PARTITIONS) {
    const members = files.filter(file => file.partition === partition);
    if (!equal(groups[partition], members) || hash(hashes[partition], "INVENTORY") !== digest(members)) return rejectSourceAuthority("INVENTORY");
  }
  const runtime = sourceArray(record.runtime, "INVENTORY").map(value => {
    const file = sourceRecord(value, ["path", "present", "sha256"], "INVENTORY");
    const path = requireSourcePath(file.path), member = capturedSourceMember(snapshot, path);
    if (typeof file.present !== "boolean" || file.present !== (member !== undefined)) return rejectSourceAuthority("INVENTORY");
    if (file.present ? member?.type !== "file" || hash(file.sha256, "INVENTORY") !== member.sha256 : file.sha256 !== null) {
      return rejectSourceAuthority("INVENTORY");
    }
    return { path, present: file.present, sha256: file.sha256 };
  });
  if (runtime.some((file, index) => index > 0 && order(runtime[index - 1]!.path, file.path) >= 0) ||
      hash(record.runtimeConfigurationSha256, "INVENTORY") !== digest(runtime)) return rejectSourceAuthority("INVENTORY");
  const descriptor = { version: record.version, policyVersion: record.policyVersion, roots: record.roots,
    entrypoints: record.entrypoints, files: record.files, groups: record.groups };
  if (hash(record.inventorySha256, "INVENTORY") !== digest(descriptor)) return rejectSourceAuthority("INVENTORY");
  const audit = sourceRecord(record.audit, ["passed", "edges", "auditedFiles"], "INVENTORY");
  if (audit.passed !== true || !equal(sourceArray(audit.auditedFiles, "INVENTORY"),
    files.filter(file => /\.(?:[cm]?[jt]s|[jt]sx)$/.test(file.path)).map(file => file.path))) return rejectSourceAuthority("INVENTORY");
  const edges = sourceArray(audit.edges, "INVENTORY");
  const seen = new Set<string>();
  for (const value of edges) {
    if (value === null || typeof value !== "object") return rejectSourceAuthority("INVENTORY");
    const optional = Object.hasOwn(value, "typeOnly") ? ["typeOnly"] : [];
    const edge = sourceRecord(value, ["importer", "specifier", "kind", "target", "targetKind", ...optional], "INVENTORY");
    if (!members.has(requireSourcePath(edge.importer)) || typeof edge.specifier !== "string" || !edge.specifier ||
        typeof edge.target !== "string" || !edge.target || typeof edge.kind !== "string" ||
        !["import", "export", "dynamic", "require", "import-type", "resolve", "worker"].includes(edge.kind) ||
        typeof edge.targetKind !== "string" || !["source", "builtin", "external"].includes(edge.targetKind) || optional.length && edge.typeOnly !== true ||
        edge.targetKind === "source" && !members.has(requireSourcePath(edge.target))) return rejectSourceAuthority("INVENTORY");
    const key = canonicalSourceJson(edge);
    if (seen.has(key)) return rejectSourceAuthority("INVENTORY");
    seen.add(key);
  }
};
