// SPEC: _spec/runtime-protocol.puml
import { strict as assert } from "node:assert";
import { closeSync, constants, fstatSync, lstatSync, mkdirSync, openSync, readSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LIMITS, PIN, QUALIFICATION, ROOT, SLICE as SEALED, blobOid, gitArgv, gitEnvironment, safeRelative, sha256 } from "../local-inputs-1/prepare";
import type { GitOptions, GitRunner, Store } from "../local-inputs-1/prepare";

export { PIN, ROOT, sha256 };
export const PARENT = dirname(SEALED);
export const SLICE = PARENT + "/corpus-inputs-1";
export const BASE = resolve(ROOT, SLICE);
export const STATUS = "PARTIAL_PINNED_CORPUS_SIDECAR_MATERIALIZED_PACKAGES_MISSING";
export const REQUIRED = [
  { path: "_spec/corpora/ml-adjutant-corpus.manifest.json", mode: "100644", gitBlobOid: "44e043d45e83c363213f01d91bb79207d130c839", bytes: 7309 },
  { path: "starchess-match-history-20260929-203446.json", mode: "100644", gitBlobOid: "f24680e5b26ebb742de846ec6a73bbeab379e827", bytes: 664540 },
];
export const MISSING = [
  { name: "fflate", version: "0.8.3", selectedRuntimeFile: "esm/index.mjs", installedRoot: null },
  { name: "jssha", version: "3.3.2", selectedRuntimeFile: "dist/sha256.mjs", installedRoot: null },
];
export const FLAGS = { ...QUALIFICATION, oneAssembledRuntimeTreeEstablished: false, corpusRolloutsExecuted: false, corpusAuditExecuted: false,
  sealedApplicationFilesRehashedBySidecar: false, installedPackageFilesCopied: 0, installedPackageStatus: "MISSING_IN_BOUNDED_LOCAL_SEARCH", packageAbsenceEverywhereEstablished: false };
export const DOCUMENT_PATHS = {
  addendum: PARENT + "/corpus-scope-addendum-1.json", discovery: PARENT + "/corpus-discovery-1.json",
  sourceManifest: SEALED + "/input-manifest.json", materialization: SEALED + "/materialization.json", check: SEALED + "/check.json",
};
export const SEALED_DOCUMENT_SHA256 = {
  sourceManifest: "bb03f45257fae1d8ca11710b53547936c3042380188ab10117b704b692d39fb0",
  materialization: "2b13f0daad567013823ea2859a0107818ee9b09766347c2190ec3dfe47949506",
  check: "acca1e84beb0ebfacf3fb0a7967ffe5d16552861b0da98a4f7e6b4367cee9c63",
};
export type Documents = Record<keyof typeof DOCUMENT_PATHS, Buffer>;
type CorpusEntry = { path: string; mode: string; gitBlobOid: string; bytes: number };
export type Usage = { sealedFiles: number; sealedBytes: number; sidecarFiles: number; sidecarBytes: number; aggregateFiles: number; aggregateBytes: number };
export type Plan = { entries: CorpusEntry[]; usage: Usage; sealedApplicationSourceSha256: string; documents: { path: string; bytes: number; sha256: string }[] };
type Command = { argv: string[]; cwd: string; environment: Record<string, string>; timeoutMs: number; maxBuffer: number; exitCode: number; signal: string | null; stdoutBytes: number; stdoutSha256: string; stderrBytes: number; stderrSha256: string; stderr: string };
type Row = { path: string; gitBlobOid: string; sourceMode: string; bytes: number; sha256: string };
export type Context = { store: Store; getPlan: () => Plan; git: GitRunner; now: () => number; start: number; commands: Command[]; copiedFiles: number; copiedBytes: number };
export const encode = (value: unknown) => Buffer.from(JSON.stringify(value, null, 2) + "\n");

export function aggregateUsage(sealedFiles: number, sealedBytes: number, entries: CorpusEntry[], limits = LIMITS): Usage {
  assert.ok(Number.isSafeInteger(sealedFiles) && sealedFiles >= 0 && Number.isSafeInteger(sealedBytes) && sealedBytes >= 0, "INVALID_SEALED_USAGE");
  assert.equal(entries.length, 2, "EXACT_TWO_CORPUS_INPUTS_REQUIRED");
  const seen = new Set<string>();
  let sidecarBytes = 0;
  for (const entry of entries) {
    safeRelative(entry.path); assert.ok(!seen.has(entry.path), "DUPLICATE_CORPUS_PATH"); seen.add(entry.path);
    assert.equal(entry.mode, "100644", "REGULAR_CORPUS_MODE_REQUIRED"); assert.match(entry.gitBlobOid, /^[0-9a-f]{40}$/);
    assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0 && entry.bytes <= limits.individualInputBytes, "INDIVIDUAL_CORPUS_BOUND");
    sidecarBytes += entry.bytes;
  }
  assert.deepEqual([...seen].sort(), REQUIRED.map(entry => entry.path).sort(), "EXACT_CORPUS_PATHS_REQUIRED");
  const aggregateFiles = sealedFiles + entries.length, aggregateBytes = sealedBytes + sidecarBytes;
  assert.ok(aggregateFiles <= limits.inputFiles, "AGGREGATE_FILE_BOUND"); assert.ok(aggregateBytes <= limits.inputBytes, "AGGREGATE_BYTE_BOUND");
  return { sealedFiles, sealedBytes, sidecarFiles: entries.length, sidecarBytes, aggregateFiles, aggregateBytes };
}

export function makePlan(documents: Documents): Plan {
  const parsed = {} as Record<keyof Documents, any>;
  const bindings = (Object.keys(DOCUMENT_PATHS) as (keyof Documents)[]).map(key => {
    const bytes = documents[key]; assert.ok(bytes.length <= LIMITS.discoveryMetadataBytes, "DOCUMENT_BOUND"); parsed[key] = JSON.parse(bytes.toString("utf8"));
    return { path: DOCUMENT_PATHS[key], bytes: bytes.length, sha256: sha256(bytes) };
  });
  const { addendum, discovery, sourceManifest, materialization, check } = parsed;
  assert.equal(addendum.status, "AUTHORIZED_TWO_FILE_CORPUS_EXTENSION_OF_EXISTING_LOCAL_INPUT_MATERIALIZATION");
  assert.equal(discovery.status, "REQUIRED_CORPUS_INPUTS_REPORTED_PRESENT_IN_PINNED_LOCAL_GIT_TREE_NOT_MATERIALIZED_BY_THIS_RECORD");
  for (const document of [addendum, discovery, sourceManifest, materialization, check]) assert.equal(document.reference, PIN, "FIXED_REFERENCE_REQUIRED");
  assert.equal(addendum.gitRoot, ROOT); assert.equal(discovery.gitRoot, ROOT);
  assert.equal(addendum.sealedSourceGenerationPreserved, DOCUMENT_PATHS.sourceManifest); assert.equal(addendum.freshSidecarRoot, SLICE + "/inputs/reference");
  assert.deepEqual(addendum.entries, REQUIRED, "EXACT_ADDENDUM_ENTRIES_REQUIRED"); assert.deepEqual(discovery.entries, REQUIRED, "EXACT_DISCOVERY_ENTRIES_REQUIRED");
  assert.deepEqual(addendum.aggregateLimitsUnchanged, { files: LIMITS.inputFiles, inputBytes: LIMITS.inputBytes, individualInputBytes: LIMITS.individualInputBytes });
  assert.equal(addendum.exactManifestRequiredBeforeCopying, true); assert.equal(addendum.sidecarDoesNotEstablishOneAssembledRuntimeTree, true);
  for (const key of ["referenceBundlingApproved", "dependencyAcquisitionOrInstallationApproved", "hostExecutionApproved", "actualCommitOrPushApproved", "experimentTrainingApproved", "trainingReady"]) assert.equal(addendum[key], false);
  assert.equal(discovery.payloadReadOrCopiedByThisQuery, false); assert.equal(discovery.fullC14GuardExecuted, false); assert.equal(discovery.fullTreeAncestryAuthenticated, false);
  assert.equal(materialization.status, "PARTIAL_PINNED_SOURCE_MATERIALIZED_PACKAGES_MISSING"); assert.equal(check.status, materialization.status);
  assert.equal(check.check, "PASS_EXACT_STAGED_MEMBERSHIP_BYTES_GIT_BLOB_SHA1_AND_SHA256");
  assert.equal(sourceManifest.inputFileCount, 427); assert.equal(sourceManifest.inputBytes, 3850400);
  for (const document of [materialization, check]) {
    assert.equal(document.materializedFileCount, sourceManifest.inputFileCount); assert.equal(document.materializedBytes, sourceManifest.inputBytes);
    assert.equal(document.inputManifestSha256, sha256(documents.sourceManifest), "SEALED_MANIFEST_BINDING_MISMATCH");
    assert.equal(document.installedPackageFilesCopied, 0); assert.equal(document.installedPackageStatus, "MISSING_IN_BOUNDED_LOCAL_SEARCH");
    assert.deepEqual(document.missingPackages, MISSING); assert.equal(document.packageAbsenceEverywhereEstablished, false);
    for (const [key, value] of Object.entries(QUALIFICATION)) assert.equal(document[key], value);
  }
  assert.equal(check.materializationSha256, sha256(documents.materialization), "SEALED_MATERIALIZATION_BINDING_MISMATCH");
  assert.equal(check.sourceSha256, materialization.sourceSha256); assert.match(check.sourceSha256, /^[0-9a-f]{64}$/);
  const usage = aggregateUsage(sourceManifest.inputFileCount, sourceManifest.inputBytes, REQUIRED);
  assert.equal(addendum.additionalFiles, usage.sidecarFiles); assert.equal(addendum.additionalBytes, usage.sidecarBytes);
  assert.equal(addendum.aggregateApplicationSourceAndCorpusFiles, usage.aggregateFiles); assert.equal(addendum.aggregateApplicationSourceAndCorpusBytes, usage.aggregateBytes);
  return { entries: REQUIRED.map(entry => ({ ...entry })), usage, sealedApplicationSourceSha256: check.sourceSha256, documents: bindings };
}

export function context(store: Store, getPlan: () => Plan, git: GitRunner, now = () => performance.now()): Context {
  return { store, getPlan, git, now, start: now(), commands: [], copiedFiles: 0, copiedBytes: 0 };
}
function deadline(ctx: Context) { assert.ok(ctx.now() - ctx.start < 180000, "CORPUS_TRIAL_DEADLINE_180S"); }
function manifestFor(plan: Plan) {
  assert.deepEqual(plan.usage, aggregateUsage(427, 3850400, plan.entries), "AGGREGATE_USAGE_MISMATCH");
  return { version: "pinned-corpus-sidecar-manifest.v1", reference: PIN, gitRoot: ROOT, sourceRoot: SLICE + "/inputs/reference",
    sourceClassification: "GIT_REPORTED_PINNED_TWO_FILE_CORPUS_SIDECAR_NOT_ASSEMBLED_RUNTIME_TREE", entries: plan.entries.map(entry => ({ ...entry, origin: "pinned-git", reference: PIN })),
    usage: plan.usage, limits: LIMITS, documents: plan.documents, sealedApplicationSourceSha256: plan.sealedApplicationSourceSha256, missingPackages: MISSING, ...FLAGS };
}
function readJson(store: Store, path: string) {
  assert.equal(store.kind(path), "file", "REGULAR_METADATA_REQUIRED:" + path);
  const bytes = store.read(path, LIMITS.discoveryMetadataBytes); assert.ok(bytes.length <= LIMITS.discoveryMetadataBytes, "METADATA_BOUND");
  return { bytes, value: JSON.parse(bytes.toString("utf8")) };
}
function verify(entry: CorpusEntry, bytes: Buffer): Row {
  assert.equal(bytes.length, entry.bytes, "CORPUS_BYTE_COUNT_MISMATCH:" + entry.path); assert.equal(blobOid(bytes), entry.gitBlobOid, "CORPUS_GIT_BLOB_MISMATCH:" + entry.path);
  return { path: entry.path, gitBlobOid: entry.gitBlobOid, sourceMode: entry.mode, bytes: bytes.length, sha256: sha256(bytes) };
}

export function prepare(ctx: Context) {
  deadline(ctx); const plan = ctx.getPlan(), manifest = manifestFor(plan), manifestBytes = encode(manifest);
  for (const path of ["input-manifest.json", "inputs", "materialization.json", "check.json"]) assert.equal(ctx.store.kind(path), null, "EXCLUSIVE_PREPARATION_REQUIRED:" + path);
  ctx.store.create("input-manifest.json", manifestBytes);
  ctx.store.mkdir("inputs"); ctx.store.mkdir("inputs/reference");
  const rows: Row[] = [];
  for (const entry of plan.entries) {
    deadline(ctx);
    const argv = gitArgv("blob", entry.gitBlobOid), options: GitOptions = { cwd: ROOT, environment: gitEnvironment(), timeoutMs: Math.max(1, Math.min(10000, Math.floor(180000 - (ctx.now() - ctx.start)))), maxBuffer: LIMITS.individualInputBytes };
    const result = ctx.git(argv, options);
    ctx.commands.push({ argv, ...options, exitCode: result.exitCode, signal: result.signal, stdoutBytes: result.stdout.length, stdoutSha256: sha256(result.stdout), stderrBytes: result.stderr.length, stderrSha256: sha256(result.stderr), stderr: result.stderr.subarray(0, 8192).toString("utf8") });
    deadline(ctx); assert.ok(result.stdout.length <= options.maxBuffer && result.stderr.length <= options.maxBuffer, "GIT_OUTPUT_BOUND");
    assert.ok(result.exitCode === 0 && result.signal === null, "LOCAL_GIT_BLOB_READ_FAILED");
    const row = verify(entry, result.stdout), destination = "inputs/reference/" + safeRelative(entry.path), parts = destination.split("/");
    for (let index = 1; index < parts.length; index++) {
      const path = parts.slice(0, index).join("/"), kind = ctx.store.kind(path);
      if (kind === null) ctx.store.mkdir(path); else assert.equal(kind, "directory", "REGULAR_DIRECTORY_REQUIRED:" + path);
    }
    ctx.store.create(destination, result.stdout); rows.push(row); ctx.copiedFiles++; ctx.copiedBytes += row.bytes;
  }
  deadline(ctx);
  const receipt = { version: "pinned-corpus-sidecar-materialization.v1", status: STATUS, reference: PIN, inputManifestSha256: sha256(manifestBytes), manifestPersistedBeforeFirstPayloadCopy: true,
    usage: plan.usage, sealedApplicationSourceSha256: plan.sealedApplicationSourceSha256, corpusSourceSha256: sha256(encode(rows)), files: rows, gitCommands: ctx.commands, missingPackages: MISSING, ...FLAGS };
  ctx.store.create("materialization.json", encode(receipt)); return receipt;
}

export function check(ctx: Context) {
  deadline(ctx); const plan = ctx.getPlan(), manifest = readJson(ctx.store, "input-manifest.json"), materialization = readJson(ctx.store, "materialization.json");
  assert.deepEqual(manifest.value, manifestFor(plan), "MANIFEST_BINDING_MISMATCH");
  assert.equal(materialization.value.version, "pinned-corpus-sidecar-materialization.v1"); assert.equal(materialization.value.status, STATUS);
  assert.equal(materialization.value.inputManifestSha256, sha256(manifest.bytes)); assert.deepEqual(materialization.value.usage, plan.usage);
  const paths = new Set(plan.entries.map(entry => entry.path)), directories = new Set([""]);
  for (const path of paths) { const parts = path.split("/"); for (let index = 1; index < parts.length; index++) directories.add(parts.slice(0, index).join("/")); }
  const found = new Set<string>();
  function walk(path: string) {
    deadline(ctx); const directory = "inputs/reference" + (path ? "/" + path : "");
    assert.equal(ctx.store.kind(directory), "directory", "REGULAR_DIRECTORY_REQUIRED:" + directory);
    for (const name of ctx.store.list(directory)) {
      safeRelative(name); assert.ok(!name.includes("/"), "INVALID_DIRECTORY_ENTRY");
      const child = path ? path + "/" + name : name, kind = ctx.store.kind(directory + "/" + name);
      if (kind === "directory") { assert.ok(directories.has(child), "EXTRA_STAGED_DIRECTORY:" + child); walk(child); }
      else { assert.equal(kind, "file", "NONREGULAR_STAGED_CORPUS:" + child); assert.ok(paths.has(child), "EXTRA_STAGED_FILE:" + child); found.add(child); }
    }
  }
  walk(""); assert.equal(found.size, paths.size, "MISSING_STAGED_CORPUS");
  const rows = plan.entries.map(entry => { deadline(ctx); assert.ok(found.has(entry.path), "MISSING_STAGED_CORPUS"); return verify(entry, ctx.store.read("inputs/reference/" + entry.path, LIMITS.individualInputBytes)); });
  assert.deepEqual(materialization.value.files, rows, "STAGED_SHA256_MISMATCH"); assert.equal(materialization.value.corpusSourceSha256, sha256(encode(rows)));
  assert.equal(materialization.value.sealedApplicationSourceSha256, plan.sealedApplicationSourceSha256);
  for (const [key, value] of Object.entries(FLAGS)) assert.equal(materialization.value[key], value);
  assert.deepEqual(materialization.value.missingPackages, MISSING);
  const receipt = { version: "pinned-corpus-sidecar-check.v1", status: STATUS, check: "PASS_EXACT_TWO_FILE_MEMBERSHIP_BYTES_GIT_BLOB_SHA1_AND_SHA256", reference: PIN,
    inputManifestSha256: sha256(manifest.bytes), materializationSha256: sha256(materialization.bytes), documents: plan.documents, usage: plan.usage,
    sealedApplicationSourceSha256: plan.sealedApplicationSourceSha256, corpusSourceSha256: sha256(encode(rows)), files: rows, missingPackages: MISSING, ...FLAGS };
  deadline(ctx);
  if (ctx.store.kind("check.json") === null) ctx.store.create("check.json", encode(receipt));
  else assert.deepEqual(readJson(ctx.store, "check.json").value, receipt, "PRESERVED_CHECK_RECEIPT_MISMATCH");
  return receipt;
}

export function runPhase(phase: "prepare" | "check", ctx: Context) {
  try {
    for (const name of ["prepare", "check"]) assert.equal(ctx.store.kind(name + "-failure.json"), null, "FAILED_SIDECAR_CANNOT_BE_REUSED");
    return ({ prepare, check })[phase](ctx);
  } catch (error) {
    const path = phase + "-failure.json";
    if (ctx.store.kind(path) === null) ctx.store.create(path, encode({ status: "FAIL_CORPUS_SIDECAR_PRESERVED", phase, error: error instanceof Error ? error.message : String(error), copiedFiles: ctx.copiedFiles, copiedBytes: ctx.copiedBytes, gitCommands: ctx.commands, ...FLAGS }));
    throw error;
  }
}

function regularAncestors(path: string) {
  let current = "/";
  for (const part of dirname(path).split("/").filter(Boolean)) { current = join(current, part); assert.ok(lstatSync(current).isDirectory(), "NO_SYMLINK_ANCESTORS:" + current); }
}
function readBounded(path: string, limit: number) {
  regularAncestors(path); const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = fstatSync(fd); assert.ok(stat.isFile() && stat.size <= limit, "REGULAR_BOUNDED_FILE_REQUIRED:" + path);
    const bytes = Buffer.alloc(stat.size + 1); let count = 0;
    while (count < bytes.length) { const size = readSync(fd, bytes, count, bytes.length - count, count); if (!size) break; count += size; }
    assert.ok(count === stat.size && fstatSync(fd).size === stat.size, "FILE_CHANGED_DURING_BOUNDED_READ"); return bytes.subarray(0, count);
  } finally { closeSync(fd); }
}
function nativeStore(): Store {
  function full(path: string) { safeRelative(path); const target = resolve(BASE, path); regularAncestors(target); return target; }
  return {
    kind(path) { try { const stat = lstatSync(full(path)); return stat.isSymbolicLink() ? "symlink" : stat.isFile() ? "file" : stat.isDirectory() ? "directory" : "other"; } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; } },
    read(path, limit) { return readBounded(full(path), limit); },
    create(path, bytes) { const fd = openSync(full(path), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600); try { writeFileSync(fd, bytes); } finally { closeSync(fd); } },
    mkdir(path) { mkdirSync(full(path), { mode: 0o700 }); }, list(path) { return readdirSync(full(path)); },
  };
}
function localPlan() {
  const documents = {} as Documents;
  for (const key of Object.keys(DOCUMENT_PATHS) as (keyof Documents)[]) documents[key] = readBounded(resolve(ROOT, DOCUMENT_PATHS[key]), LIMITS.discoveryMetadataBytes);
  for (const key of Object.keys(SEALED_DOCUMENT_SHA256) as (keyof typeof SEALED_DOCUMENT_SHA256)[]) assert.equal(sha256(documents[key]), SEALED_DOCUMENT_SHA256[key], "SEALED_DOCUMENT_CHANGED:" + key);
  return makePlan(documents);
}
function main() {
  assert.equal(dirname(fileURLToPath(import.meta.url)), BASE); assert.equal(process.cwd(), ROOT); assert.equal(process.execPath, "/usr/local/bin/bun"); assert.equal(Bun.version, "1.4.0");
  const args = Bun.argv.slice(2); assert.equal(args.length, 1); assert.ok(["--prepare", "--check"].includes(args[0]!));
  const home = relative(BASE, process.env.HOME ?? ""); assert.match(home, /^verification-[1-9][0-9]?\/home$/); assert.equal(relative(BASE, process.env.TMPDIR ?? ""), home.replace(/\/home$/, "/tmp"));
  assert.equal(process.env.BUN_RUNTIME_TRANSPILER_CACHE_PATH, "0");
  const git: GitRunner = (argv, options) => { const result = Bun.spawnSync(argv, { cwd: options.cwd, env: options.environment, stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: options.timeoutMs, maxBuffer: options.maxBuffer }); return { exitCode: result.exitCode, stdout: Buffer.from(result.stdout), stderr: Buffer.from(result.stderr), signal: result.signalCode ?? null }; };
  const result = runPhase(args[0]!.slice(2) as "prepare" | "check", context(nativeStore(), localPlan, git));
  console.log(JSON.stringify({ status: result.status, reference: PIN, usage: result.usage, corpusSourceSha256: result.corpusSourceSha256, ...FLAGS }));
}
if (import.meta.main) main();
