// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { constructRef } from "../economic/ownedKernel";
import type { Ref } from "../economic/contracts";
import { createRegisteredByteStore, type ByteRole, type RegisteredByteStore } from "../coordinator/registeredBytes";
import {
  bootstrapSourceAuthority, constructSourceBootstrapContext, constructUnverifiedSourceInput, requireSourceActiveScopeKey,
  requireVerifiedSourceSeal, revokeSourceBootstrapContext, verifySourceSealCurrent,
  type SourceBootstrapContext, type SourceHostConfiguration, type SourceInput, type SourceInputSelection, type VerifiedSourceSeal,
} from "../coordinator/sourceBootstrap";
import {
  canonicalSourceJson, captureFilesystemSourceSnapshot, capturedSourceManifest, sourceSha256,
} from "../coordinator/sourceManifest";
import {
  BOOTSTRAP_AUDITOR_PATHS, BOOTSTRAP_CONSTRUCTOR_RULE, checkBootstrapSourcePolicy, checkClaimedSourceInventoryBytes,
  encodeBootstrapSourcePolicy, type BootstrapSourcePolicyExpectations,
} from "../coordinator/sourcePolicy";
import { createPrivateScratch, createScratchSourceRoot } from "./privateScratch";

const directories: string[] = [];
const training = "packages/starchess-training/src";
const roots = ["packages/starchess-core/src", "packages/starchess-arena/src", training,
  "scripts", "packages/starchess-arena/hermetic"].sort();
const entrypoints = [
  "packages/starchess-core/src/index.ts", "packages/starchess-core/src/planning-v1.ts",
  "packages/starchess-arena/src/index.ts", "packages/starchess-arena/src/observations.ts",
  "packages/starchess-arena/src/events.ts", "packages/starchess-arena/src/intent-codec-v1.ts", `${training}/candidates.ts`,
  ...["ownedKernel", "work", "ownedSchema", "ownedGuards", "ownedErrors"].map(name => `${training}/economic/${name}.ts`),
  ...["sourceBootstrap", "sourcePolicy", "sourceManifest", "planningScope", "worker", "supervisor", "startup", "economicAdapter", "verify"]
    .map(name => `${training}/coordinator/${name}.ts`), ...BOOTSTRAP_AUDITOR_PATHS,
].sort();
const partitionNames = ["core-rules", "arena-authorized", "arena-host", "training-model", "training-coordinator", "verification-tooling"];
const runtimeRoles = ["dependencyLock", "installedTree", "frozenStore", "toolTree", "image", "runtimeConfiguration"] as const;
const encode = (value: unknown) => new TextEncoder().encode(canonicalSourceJson(value));
const refFor = (bytes: Uint8Array): Ref => constructRef(bytes.length, sourceSha256(bytes));
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const recordHash = (value: unknown) => sourceSha256(canonicalSourceJson(value));

const fixture = () => {
  const directory = createPrivateScratch("b1-bootstrap-");
  directories.push(directory);
  const root = createScratchSourceRoot(directory, "source");
  for (const path of roots) mkdirSync(join(root, path), { recursive: true });
  for (const path of entrypoints) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    const auditor = BOOTSTRAP_AUDITOR_PATHS.includes(path as typeof BOOTSTRAP_AUDITOR_PATHS[number]);
    const source = auditor ? readFileSync(new URL(`../../../../${path}`, import.meta.url)) : Buffer.from("export const fixture = 1;\n");
    writeFileSync(join(root, path), source);
  }
  writeFileSync(join(root, "package.json"), '{"name":"captured-fixture"}\n');
  const snapshot = captureFilesystemSourceSnapshot(root), manifest = capturedSourceManifest(snapshot);
  const policyExpected: BootstrapSourcePolicyExpectations = { roots: [...roots], entrypoints: [...entrypoints], auditorRefs: [
    refFor(readFileSync(join(root, BOOTSTRAP_AUDITOR_PATHS[0]))), refFor(readFileSync(join(root, BOOTSTRAP_AUDITOR_PATHS[1]))),
  ] };
  const files = manifest.entries.filter(entry => entry.type === "file" && roots.some(path => entry.path.startsWith(`${path}/`)))
    .map(entry => ({ path: entry.path, sha256: entry.type === "file" ? entry.sha256 : "", partition:
      entry.path.startsWith("packages/starchess-core/") ? "core-rules" : entry.path.startsWith(`${training}/coordinator/`) ? "training-coordinator" :
        entry.path.startsWith(training) ? "training-model" : entry.path === BOOTSTRAP_AUDITOR_PATHS[0] || entry.path.includes("/hermetic/") ?
          "verification-tooling" : "arena-host" })).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const groups = Object.fromEntries(partitionNames.map(partition => [partition, files.filter(file => file.partition === partition)]));
  const runtime = [{ path: "optional.json", present: false, sha256: null },
    { path: "package.json", present: true, sha256: sourceSha256(readFileSync(join(root, "package.json"))) }];
  const descriptor = { version: "challenge-source-inventory-v2", policyVersion: "challenge-source-policy-v2", roots, entrypoints, files, groups };
  const inventory = { ...descriptor, partitionSha256: Object.fromEntries(partitionNames.map(partition => [partition, recordHash(groups[partition])])),
    runtime, runtimeConfigurationSha256: recordHash(runtime), inventorySha256: recordHash(descriptor),
    audit: { passed: true, edges: [], auditedFiles: files.map(file => file.path) } };
  const source = new TextEncoder().encode(JSON.stringify(manifest, null, 2) + "\n"), inventoryBytes = encode(inventory);
  const policyBytes = encodeBootstrapSourcePolicy(policyExpected);
  const runtimeBytes = Object.fromEntries(runtimeRoles.map(role => [role, new TextEncoder().encode(`independent-${role}`)])) as Record<typeof runtimeRoles[number], Uint8Array>;
  const config: SourceHostConfiguration = { provenance: { source: refFor(source), sourceInventory: refFor(inventoryBytes), sourcePolicy: refFor(policyBytes) },
    snapshot, policy: policyExpected, runtime: Object.fromEntries(runtimeRoles.map(role => [role, refFor(runtimeBytes[role])])) as SourceHostConfiguration["runtime"] };
  const artifacts: Array<{ role: ByteRole; ref: Ref; bytes: Uint8Array }> = [
    { role: "source", ref: config.provenance.source, bytes: source },
    { role: "sourceInventory", ref: config.provenance.sourceInventory, bytes: inventoryBytes },
    { role: "sourcePolicy", ref: config.provenance.sourcePolicy, bytes: policyBytes },
    ...(["sourceInventoryAuditorCode", "publicClosureAuditorCode"] as const).map((role, index) => ({ role,
      ref: policyExpected.auditorRefs[index]!, bytes: readFileSync(join(root, BOOTSTRAP_AUDITOR_PATHS[index]!)) })),
    ...runtimeRoles.map(role => ({ role, ref: config.runtime[role], bytes: runtimeBytes[role] })),
  ];
  const storeFor = (selected = artifacts): RegisteredByteStore => {
    const owner = createRegisteredByteStore();
    for (const artifact of selected) owner.register(artifact.role, artifact.ref, new Uint8Array(artifact.bytes));
    return owner.seal();
  };
  const loaderMap = manifest.entries.filter(entry => entry.type === "file" && entrypoints.includes(entry.path)).map(entry => ({
    path: entry.path, byteLength: entry.type === "file" ? entry.bytes : 0, sha256: entry.type === "file" ? entry.sha256 : "",
  }));
  const inputFor = (context: SourceBootstrapContext): SourceInput => constructUnverifiedSourceInput(context,
    { kind: "actualFilesystem", snapshot, capturedCodeLoaderMap: loaderMap });
  return { root, snapshot, manifest, policyExpected, policyBytes, inventory, inventoryBytes, config, artifacts, storeFor, loaderMap, inputFor };
};
afterEach(() => { for (const root of directories.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe("closed B1 source policy and actual captured members", () => {
  it("checks both complete physical auditor files and exact independent five-root selection", () => {
    const f = fixture(), policy = checkBootstrapSourcePolicy(f.policyBytes, f.policyExpected, f.snapshot);
    expect(policy.constructorRule).toEqual(BOOTSTRAP_CONSTRUCTOR_RULE);
    expect(policy.auditors.map(auditor => auditor.path)).toEqual(BOOTSTRAP_AUDITOR_PATHS);
    expect(policy.roots).toHaveLength(5);
    expect(() => checkClaimedSourceInventoryBytes(f.inventoryBytes, f.snapshot, policy)).not.toThrow();
    expect(Object.isFrozen(policy)).toBe(true);
  });

  it.each(["version", "inventoryVersion", "policyVersion", "extra"])("rejects changed closed policy %s", field => {
    const f = fixture(), policy = JSON.parse(new TextDecoder().decode(f.policyBytes));
    policy[field] = "substituted";
    expect(() => checkBootstrapSourcePolicy(encode(policy), f.policyExpected, f.snapshot)).toThrow("POLICY");
  });

  it.each(["module", "binding", "importer", "types", "extra"])("rejects constructor-rule %s substitutes", field => {
    const f = fixture(), policy = JSON.parse(new TextDecoder().decode(f.policyBytes));
    policy.constructorRule[field] = field === "types" ? ["LedgerOwner", "LedgerPair"] : "substituted";
    expect(() => checkBootstrapSourcePolicy(encode(policy), f.policyExpected, f.snapshot)).toThrow("POLICY");
  });

  it.each(["fabricated-seven-roots", "missing-entrypoint", "unsorted", "duplicate", "unsafe", "missing-member"])("rejects %s", change => {
    const f = fixture(), policy = JSON.parse(new TextDecoder().decode(f.policyBytes));
    if (change === "fabricated-seven-roots") policy.roots = [...roots, "runtime-tools", "verification"].sort();
    if (change === "missing-entrypoint") policy.entrypoints.pop();
    if (change === "unsorted") policy.entrypoints.reverse();
    if (change === "duplicate") policy.entrypoints.push(policy.entrypoints.at(-1));
    if (change === "unsafe") policy.roots[0] = "../outside";
    if (change === "missing-member") {
      const wanted = { ...f.policyExpected, entrypoints: [...entrypoints, "verification/missing.ts"].sort() };
      expect(() => checkBootstrapSourcePolicy(encodeBootstrapSourcePolicy(wanted), wanted, f.snapshot)).toThrow("POLICY");
      return;
    }
    expect(() => checkBootstrapSourcePolicy(encode(policy), f.policyExpected, f.snapshot)).toThrow();
  });

  it.each(["order", "cardinality", "path", "length", "hash"])("rejects auditor %s changes", change => {
    const f = fixture(), policy = JSON.parse(new TextDecoder().decode(f.policyBytes));
    if (change === "order") policy.auditors.reverse();
    if (change === "cardinality") policy.auditors.pop();
    if (change === "path") policy.auditors[0].path = "https://worker.example/auditor.ts";
    if (change === "length") policy.auditors[0].ref.byteLength++;
    if (change === "hash") policy.auditors[0].ref.sha256 = "0".repeat(64);
    expect(() => checkBootstrapSourcePolicy(encode(policy), f.policyExpected, f.snapshot)).toThrow();
  });

  it("rejects appended auditor code rather than matching a selected declaration", () => {
    const f = fixture(), path = join(f.root, BOOTSTRAP_AUDITOR_PATHS[0]);
    writeFileSync(path, readFileSync(path).toString() + "\nexport const unaudited = true;\n");
    const substituted = captureFilesystemSourceSnapshot(f.root);
    expect(() => checkBootstrapSourcePolicy(f.policyBytes, f.policyExpected, substituted)).toThrow("AUDITOR_CODE");
  });

  it("rejects noncanonical policy bytes and duplicate JSON keys", () => {
    const f = fixture(), text = new TextDecoder().decode(f.policyBytes);
    expect(() => checkBootstrapSourcePolicy(new TextEncoder().encode(text + "\n"), f.policyExpected, f.snapshot)).toThrow("POLICY");
    expect(() => checkBootstrapSourcePolicy(new TextEncoder().encode('{"version":"old",' + text.slice(1)), f.policyExpected, f.snapshot)).toThrow("POLICY");
  });

  it.each(["version", "policyVersion", "roots", "entrypoints", "files", "groups", "partitionSha256", "runtime",
    "runtimeConfigurationSha256", "inventorySha256", "audit"])("checks complete inventory field %s", field => {
    const f = fixture(), policy = checkBootstrapSourcePolicy(f.policyBytes, f.policyExpected, f.snapshot), inventory = clone(f.inventory);
    const record = inventory as unknown as Record<string, unknown>;
    if (field === "roots" || field === "entrypoints" || field === "files") (record[field] as unknown[]).pop();
    else if (field === "groups") inventory.groups["training-coordinator"] = [];
    else if (field === "partitionSha256") inventory.partitionSha256["training-coordinator"] = "0".repeat(64);
    else if (field === "runtime") inventory.runtime[1]!.sha256 = "0".repeat(64);
    else if (field === "audit") inventory.audit.auditedFiles.pop();
    else record[field] = "substituted";
    expect(() => checkClaimedSourceInventoryBytes(encode(inventory), f.snapshot, policy)).toThrow("INVENTORY");
  });

  it("checks source edge membership including type-only/dead edges without treating reports as independent audits", () => {
    const f = fixture(), policy = checkBootstrapSourcePolicy(f.policyBytes, f.policyExpected, f.snapshot);
    const inventory = { ...f.inventory, audit: { passed: true, auditedFiles: f.inventory.audit.auditedFiles,
      edges: [{ importer: `${training}/candidates.ts`, specifier: "./missing", kind: "import", targetKind: "source",
        target: `${training}/missing.ts`, typeOnly: true }] } };
    expect(() => checkClaimedSourceInventoryBytes(encode(inventory), f.snapshot, policy)).toThrow("INVENTORY");
  });
});

describe("realm-local source authority refuses unauthenticated loading", () => {
  it("does not issue a seal from physical fixtures, stable provenance or embedded passed:true", () => {
    const f = fixture(), context = constructSourceBootstrapContext(f.storeFor(), f.config), input = f.inputFor(context);
    expect(Object.isFrozen(context)).toBe(true);
    expect(Reflect.ownKeys(context)).toEqual([]);
    expect(Reflect.ownKeys(input)).toEqual([]);
    expect(() => bootstrapSourceAuthority(context, input)).toThrow("IMMUTABLE_LOADING_UNSUPPORTED");
    expect(() => f.inputFor(context)).toThrow("REVOKED");
    expect(() => bootstrapSourceAuthority(context, input)).toThrow("REVOKED");
  });

  it.each(["source", "sourceInventory", "sourcePolicy"] as const)("resolves %s only under its fixed registered role", role => {
    const f = fixture(), selected = f.artifacts.filter(artifact => artifact.role !== role);
    expect(() => constructSourceBootstrapContext(f.storeFor(selected), f.config)).toThrow("MISSING");
    const actual = f.artifacts.find(artifact => artifact.role === role)!;
    const different = new TextEncoder().encode("self-consistent-child-substitute");
    const swapped = [...selected, { role, ref: refFor(different), bytes: different }];
    expect(() => constructSourceBootstrapContext(f.storeFor(swapped), f.config)).toThrow("MISMATCH");
    const wrongRole = [...selected, { ...actual, role: "fittingCode" as const }];
    expect(() => constructSourceBootstrapContext(f.storeFor(wrongRole), f.config)).toThrow("MISSING");
  });

  it("requires existing independent runtime/dependency roles without adding economic or IPC fields", () => {
    const f = fixture();
    for (const role of runtimeRoles) {
      expect(() => constructSourceBootstrapContext(f.storeFor(f.artifacts.filter(artifact => artifact.role !== role)), f.config)).toThrow("MISSING");
    }
    const fitting = { ...f.config, provenance: { source: f.config.provenance.source, sourceInventory: f.config.provenance.sourceInventory,
      fittingCodeRef: f.config.provenance.sourcePolicy } };
    expect(() => constructSourceBootstrapContext(f.storeFor(), fitting as unknown as SourceHostConfiguration)).toThrow("PROVENANCE");
    expect(() => constructSourceBootstrapContext(f.storeFor(), { ...f.config, valid: true } as SourceHostConfiguration)).toThrow("PROVENANCE");
  });

  it.each(["sourceInventoryAuditorCode", "publicClosureAuditorCode"] as const)("requires complete auditors under independent %s", role => {
    const f = fixture();
    expect(() => constructSourceBootstrapContext(f.storeFor(f.artifacts.filter(artifact => artifact.role !== role)), f.config)).toThrow("MISSING");
    const substitute = new TextEncoder().encode("export const passed = true;\n");
    const selected = [...f.artifacts.filter(artifact => artifact.role !== role), { role, ref: refFor(substitute), bytes: substitute }];
    expect(() => constructSourceBootstrapContext(f.storeFor(selected), f.config)).toThrow("MISMATCH");
  });

  it.each(["hash", "length", "canonical-path", "missing-entry", "duplicate-kernel"])("rejects captured loader map %s", change => {
    const f = fixture(), context = constructSourceBootstrapContext(f.storeFor(), f.config), members = clone(f.loaderMap);
    if (change === "hash") members[0]!.sha256 = "0".repeat(64);
    if (change === "length") members[0]!.byteLength++;
    if (change === "canonical-path") members[0]!.path = "../kernel.ts";
    if (change === "missing-entry") members.pop();
    if (change === "duplicate-kernel") members.push(members.find(member => member.path === BOOTSTRAP_CONSTRUCTOR_RULE.module)!);
    expect(() => constructUnverifiedSourceInput(context, { kind: "actualFilesystem", snapshot: f.snapshot, capturedCodeLoaderMap: members })).toThrow();
  });

  it("refuses read-only booleans, arbitrary verifier callbacks and counterfeit compiled receipts", () => {
    const f = fixture(), context = constructSourceBootstrapContext(f.storeFor(), f.config), verify = vi.fn(() => ({ passed: true }));
    for (const selection of [
      { kind: "actualFilesystem", snapshot: f.snapshot, capturedCodeLoaderMap: f.loaderMap, readOnly: true },
      { kind: "actualFilesystem", snapshot: f.snapshot, capturedCodeLoaderMap: f.loaderMap, verify },
    ]) expect(() => constructUnverifiedSourceInput(context, selection as SourceInputSelection)).toThrow("SOURCE_INPUT");
    expect(() => constructUnverifiedSourceInput(context, { kind: "immutableCompiledLoadReceipt", snapshot: f.snapshot,
      receipt: Object.freeze({ valid: true }) } as unknown as SourceInputSelection)).toThrow("IMMUTABLE_LOADING_UNSUPPORTED");
    expect(verify).not.toHaveBeenCalled();
    expect(() => constructUnverifiedSourceInput(context, { kind: "immutableMemory", snapshot: f.snapshot })).toThrow("IMMUTABLE_LOADING_UNSUPPORTED");
  });

  it("rejects snapshot and local-context substitution even for byte-identical captures", () => {
    const f = fixture(), first = constructSourceBootstrapContext(f.storeFor(), f.config), input = f.inputFor(first);
    const second = constructSourceBootstrapContext(f.storeFor(), f.config), reloaded = captureFilesystemSourceSnapshot(f.root);
    expect(() => constructUnverifiedSourceInput(second, { kind: "actualFilesystem", snapshot: reloaded, capturedCodeLoaderMap: f.loaderMap })).toThrow("SOURCE_INPUT");
    expect(() => bootstrapSourceAuthority(second, input)).toThrow("SOURCE_INPUT");
    expect(() => f.inputFor(second)).toThrow("REVOKED");
    expect(() => bootstrapSourceAuthority(first, input)).toThrow("IMMUTABLE_LOADING_UNSUPPORTED");
  });

  it("rejects live filesystem changes as loading authority even when captured bytes remain stable", () => {
    const f = fixture(), context = constructSourceBootstrapContext(f.storeFor(), f.config), input = f.inputFor(context);
    writeFileSync(join(f.root, BOOTSTRAP_CONSTRUCTOR_RULE.module), "export const replaced = true;\n");
    expect(() => bootstrapSourceAuthority(context, input)).toThrow("IMMUTABLE_LOADING_UNSUPPORTED");
  });

  it("checks seals before inspecting a caller or admitting construction/dispatch/publication", () => {
    const f = fixture(), context = constructSourceBootstrapContext(f.storeFor(), f.config), input = f.inputFor(context);
    const trap = vi.fn(() => { throw new Error("caller trap"); });
    const hostile = new Proxy({}, { get: trap, ownKeys: trap, getPrototypeOf: trap, getOwnPropertyDescriptor: trap });
    for (const candidate of [null, undefined, {}, { valid: true }, context, input, structuredClone(context), hostile]) {
      expect(() => requireVerifiedSourceSeal(candidate)).toThrow("PROVENANCE");
      expect(() => verifySourceSealCurrent(candidate, context, input)).toThrow("PROVENANCE");
      expect(() => requireSourceActiveScopeKey(candidate as VerifiedSourceSeal, context, input)).toThrow("PROVENANCE");
    }
    expect(() => constructUnverifiedSourceInput(context, hostile as SourceInputSelection)).toThrow("SOURCE_INPUT");
    expect(trap).not.toHaveBeenCalled();
  });

  it("revokes contexts without exposing or transferring an active-scope key", () => {
    const f = fixture(), context = constructSourceBootstrapContext(f.storeFor(), f.config), input = f.inputFor(context);
    revokeSourceBootstrapContext(context);
    expect(() => bootstrapSourceAuthority(context, input)).toThrow("REVOKED");
    expect(() => revokeSourceBootstrapContext(context)).toThrow("REVOKED");
    expect(() => constructUnverifiedSourceInput(structuredClone(context), { kind: "actualFilesystem", snapshot: f.snapshot,
      capturedCodeLoaderMap: f.loaderMap })).toThrow("PROVENANCE");
  });

  it("exports no seal issuer, callback installer, auditor-success registrar or package deep import", async () => {
    const module = await import("../coordinator/sourceBootstrap");
    expect(Object.keys(module).sort()).toEqual(["bootstrapSourceAuthority", "constructSourceBootstrapContext", "constructUnverifiedSourceInput",
      "requireSourceActiveScopeKey", "requireVerifiedSourceSeal", "revokeSourceBootstrapContext", "verifySourceSealCurrent"].sort());
    for (const path of ["sourceBootstrap", "sourcePolicy", "sourceManifest"]) {
      const source = readFileSync(new URL(`../coordinator/${path}.ts`, import.meta.url), "utf8");
      expect(source).not.toMatch(/(?:from|import\()\s*["'][^"']*starchess-arena\/(?:src|hermetic)\//);
      expect(source).not.toMatch(/\.toString\(\).*function|Function\.prototype\.toString|new Function|\beval\(/);
    }
  });
});
