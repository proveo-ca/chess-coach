// SPEC: _spec/recovery.md
import { constants } from "node:fs";
import type { BigIntStats } from "node:fs";
import { link, lstat, mkdir, open, realpath } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { environment, repository } from "./provision";
import { sha256 } from "./cuda-continuation";
import { archiveChildEnvironment, prepareArchiveNativeClosure, reviewedFiles as archiveFiles, predecessorPaths as archiveProofs,
  validateArchiveContinuation, validateArchivePlanSnapshot } from "./cuda-archive";
import type { ArchiveContinuationInputs, ArchiveNativeClosure, AuditedFile, NativeIdentity, XZProcess } from "./cuda-archive";
import { buildCompatibilityFixture, compatibilityFixturePath, compatibilityFixturePins, validateCompatibilityFixture } from "./cuda-bun-compatibility-fixture";

const base = "_work/gpu-owner-recovery/", historicalRoot = `${base}runs/cuda-archive-audit-2/`;
const readonlyRoot = `${base}runs/cuda-archive-v2-plan-1/`, runRoot = `${base}runs/cuda-bun-compatibility-1/`;
export const requestPath = `${base}cuda-bun-compatibility-request.json`, bindingPath = `${base}cuda-bun-compatibility-reviewed.json`;
export const bindingVersion = "chess-coach.cuda-bun-compatibility-source-review.v1";
export const compatibilityTaskConfiguration = `${base}cuda-bun-compatibility-mise.toml`;
export const approvedCompatibilityRequestSha256 = "3e2164b0fc9e1d092d519928a2e4a7b0e085cd5eccdb6ed49245d6d8a43f880a";
export const haltedRequestSha256 = "e0b54ee82895a3da613e92e764ccd7db2c10f2001e95241543b36f49b6f1cc63";
export const historicalPins = Object.freeze({ review: "dacf7e484328711b65f72d48ee6cba4808164fd6ce9ddb7bf3366868486f173c",
  approvedRequest: "a968cc2761869c8634a3cc929f2b1d21a7804f7128bd1fb6b045f76598fbd9f1",
  receipt: "12e6d4610b71353faf2ab1080ea3ec9315cd9fb200374970c38a0cbaf8ea121d",
  classification: "d88adf1297c649d326c149e2d1109ea3afd090e5dc53e6e95929b73efbabc66b",
  outputObservation: "5ffbd440f7f78b37228056aeafa5ec676382c791b336db1d7c9b2c0a9f4d3076",
  readonlyReceipt: "2668f0fa6369b4ed7b84cf0d5cbf28d77fbf4a83114a2dcfc8cc2d181d04a231" });
export const compatibilityPaths = Object.freeze({ evidenceRoot: resolve(repository, runRoot),
  inputDirectory: resolve(repository, `${base}scratch/cuda-bun-compatibility-1-inputs`),
  outputDirectory: resolve(repository, `${base}scratch/cuda-bun-compatibility-1-output`),
  preparedFixture: resolve(repository, `${base}scratch/cuda-bun-compatibility-1-inputs/synthetic.tar.xz`),
  haltedRequest: `${base}cuda-llvm-request.json`, haltedSnapshot: `${runRoot}llvm-request-halted.json` });
export const reviewedFiles = Object.freeze([...new Set([...archiveFiles, `${base}cuda-bun-compatibility.ts`, `${base}cuda-bun-compatibility.test.ts`,
  compatibilityTaskConfiguration, `${base}cuda-bun-compatibility-fixture.ts`, `${base}cuda-bun-compatibility-fixture.test.ts`,
  `${base}fixtures/cuda-bun-compatibility.json`, `${base}cuda-bun-compatibility-invoke.ts`])]);
const savedSources = archiveFiles.map((_, index) => `${historicalRoot}source-snapshot/${String(index).padStart(2, "0")}.source`);
export const predecessorPaths = Object.freeze([...new Set([...archiveProofs, compatibilityPaths.haltedRequest, compatibilityPaths.haltedSnapshot,
  `${base}cuda-archive-reviewed-v2.json`, ...["source-review.json", "approved-request.json", "source-snapshot.json", ...savedSources.map(path => path.slice(historicalRoot.length)),
    "receipt.json", ".operation", "command.stdout", "command.stderr", "output-state-after-failure.json"].map(path => `${historicalRoot}${path}`),
  `${base}cuda-archive-audit-2-classification.json`, ...["receipt.json", "command.stdout", "command.stderr", "approved-request.json", "source-review.json"].map(path => `${readonlyRoot}${path}`)])]);
export const compatibilityLimits = Object.freeze({ proofBytes: 1048576, streamBytes: 65536, wholeInvocationMs: 30000, maximumCases: 3, tarBytes: 1536, xzBytes: 1592 });
const encode = (value: string) => new TextEncoder().encode(value);
const decode = (value: Uint8Array) => new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(value);
const parse = (value: Uint8Array): unknown => JSON.parse(decode(value));
function need(condition: unknown, code: string): asserts condition { if (!condition) throw Error(code); }
const object = (value: unknown): Record<string, unknown> => { need(!!value && typeof value === "object" && !Array.isArray(value), "OBJECT_REQUIRED"); return value as Record<string, unknown>; };
const canonical = (value: unknown): string => JSON.stringify(value, (_key, item: unknown) => item && typeof item === "object" && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);
const keys = (value: object, expected: readonly string[]) => same(Object.keys(value).sort(), [...expected].sort());
export function compatibilityFailureCode(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return /^[A-Z][A-Z0-9_]{0,127}$/.test(message) ? message : "COMPATIBILITY_DIAGNOSTIC_FAILED";
}
export type CompatibilityContinuationInputs = Readonly<{ requestBytes: Uint8Array; binding: unknown;
  evidence: Readonly<{ files: Readonly<Record<string, Uint8Array>>; predecessorProofs: Readonly<Record<string, Uint8Array>> }> }>;
function streamReceipts(root: string, raw: Readonly<Record<string, Uint8Array>>) {
  return (["stdout", "stderr"] as const).map(stream => ({ stream, path: `${root}command.${stream}`, bytes: raw[`${root}command.${stream}`]!.byteLength,
    sha256: sha256(raw[`${root}command.${stream}`]!) }));
}
export function historicalArchiveInputs(raw: Readonly<Record<string, Uint8Array>>): ArchiveContinuationInputs {
  const review = object(parse(raw[`${historicalRoot}source-review.json`]!)), files = object(review.files);
  need(sha256(raw[`${historicalRoot}source-review.json`]!) === historicalPins.review &&
    sha256(raw[`${base}cuda-archive-reviewed-v2.json`]!) === historicalPins.review &&
    sha256(raw[`${historicalRoot}approved-request.json`]!) === historicalPins.approvedRequest, "PINNED_HISTORICAL_ARCHIVE_REQUIRED");
  const saved = Object.fromEntries(archiveFiles.map((path, index) => [path, raw[savedSources[index]!]!]));
  need(same(parse(raw[`${historicalRoot}source-snapshot.json`]!), { captureTiming: "BEFORE_ACTUAL_PASSIVE_AUDIT_INVOCATION",
    files: archiveFiles.map((path, index) => ({ path, snapshot: savedSources[index], bytes: saved[path]!.byteLength, sha256: sha256(saved[path]!) })) }) &&
    archiveFiles.every(path => files[path] === sha256(saved[path]!)), "EXACT_HISTORICAL_SAVED_SOURCE_REQUIRED");
  return { requestBytes: raw[`${historicalRoot}approved-request.json`]!, binding: review, evidence: { files: saved,
    predecessorProofs: Object.fromEntries(archiveProofs.map(path => [path, raw[path]!])) } };
}
function validateHistoricalFailure(raw: Readonly<Record<string, Uint8Array>>): void {
  const get = (path: string) => object(parse(raw[path]!)), receipt = get(`${historicalRoot}receipt.json`), review = get(`${historicalRoot}source-review.json`);
  for (const [path, pin] of [[`${historicalRoot}receipt.json`, historicalPins.receipt], [`${base}cuda-archive-audit-2-classification.json`, historicalPins.classification],
    [`${historicalRoot}output-state-after-failure.json`, historicalPins.outputObservation], [`${readonlyRoot}receipt.json`, historicalPins.readonlyReceipt]] as const)
    need(sha256(raw[path]!) === pin, "HISTORICAL_DIAGNOSTIC_DATA_CHANGED");
  need(receipt.status === "FAIL" && receipt.exitCode === 1 && receipt.failure === null && receipt.sourceChanged === false &&
    receipt.pinnedReviewSha256 === historicalPins.review && receipt.pinnedRequestSha256 === historicalPins.approvedRequest && receipt.oneOutsideDeadlineMs === 30000 &&
    receipt.stageConsumer === "runArchiveAuditMiseStages" && same(receipt.reviewedFiles, review.files) && same(receipt.predecessorProofs, review.predecessorProofs), "EXACT_FAILED_ARCHIVE_RECEIPT_REQUIRED");
  need(same(get(`${historicalRoot}.operation`), { version: "chess-coach.cuda-archive-audit-operation.v1", sequence: "cuda-archive-audit-2" }), "HISTORICAL_ARCHIVE_CLAIM_REQUIRED");
  const streams = streamReceipts(historicalRoot, raw);
  need(same(receipt.streams, streams) && receipt.stdoutBytes === streams[0]!.bytes && receipt.stderrBytes === streams[1]!.bytes, "HISTORICAL_ARCHIVE_STREAMS_REQUIRED");
  const frames = decode(raw[`${historicalRoot}command.stdout`]!).trimEnd().split("\n").map(line => JSON.parse(line));
  const stages = [
    { stage: "00-trust", argv: ["/usr/local/bin/mise", "trust", resolve(repository, `${base}cuda-archive-mise.toml`)] },
    { stage: "01-config", argv: ["/usr/local/bin/mise", "config", "ls", "--json"] },
    { stage: "02-audit", argv: ["/usr/local/bin/mise", "run", "--raw", "cuda:audit-llvm-archive"] },
  ];
  need(same(frames, [stages[0], { ...stages[0], exitCode: 0, signalCode: null, failure: null }, stages[1],
    { ...stages[1], exitCode: 0, signalCode: null, failure: null }, stages[2], { exitCode: 1, failedStage: "02-audit", completedStages: ["00-trust", "01-config"] }]), "HISTORICAL_FAILED_STAGE_REQUIRED");
  const stderr = decode(raw[`${historicalRoot}command.stderr`]!);
  need(stderr.includes("\nBun v1.4.0 (34cbb9a40) Linux x64\n") && stderr.includes("\npanic(main thread): abort() called\n") &&
    stderr.includes('Args: "/usr/local/bin/bun" "--no-env-file" "--no-install" "-e"') && stderr.includes("/audit/cuda-tar.ts") &&
    stderr.includes("ARCHIVE_QUARANTINE_FAILED"), "HISTORICAL_PRIVATE_BUN_ABORT_OBSERVATION_REQUIRED");
  const classification = get(`${base}cuda-archive-audit-2-classification.json`), observation = get(`${historicalRoot}output-state-after-failure.json`);
  need(classification.rootCause === "UNDETERMINED" && classification.xzLaunchStatus === "UNESTABLISHED" && classification.decompressionStatus === "UNESTABLISHED" &&
    classification.structuralArchiveAuditPassed === false && classification.structuralInventoryPublished === false && classification.trainingReady === false &&
    same(observation.scratchEntries, []) && observation.childInventoryPresent === false && observation.structuralInventoryPublished === false, "HISTORICAL_FAILURE_SCOPE_REQUIRED");
  const readonly = get(`${readonlyRoot}receipt.json`), readonlyStreams = streamReceipts(readonlyRoot, raw), output = get(`${readonlyRoot}command.stdout`);
  need(receipt.readOnlyRootPlan === `${readonlyRoot}receipt.json` && receipt.readOnlyRootPlanSha256 === historicalPins.readonlyReceipt && readonly.status === "PASS" &&
    readonly.exitCode === 0 && readonly.failure === null && readonly.sourceChanged === false && readonly.scope === "READ_ONLY_PLAN_QUALIFICATION_NOT_NATIVE_AUDIT_ATTEMPT" &&
    readonly.pinnedRequestSha256 === historicalPins.approvedRequest && readonly.pinnedReviewSha256 === historicalPins.review && same(readonly.streams, readonlyStreams) &&
    readonly.stdoutBytes === readonlyStreams[0]!.bytes && readonly.stderrBytes === 0 && readonlyStreams[1]!.bytes === 0 &&
    output.status === "PASS" && output.privateSnapshotMatchesCommittedIdentity === true && output.quarantineLaunched === false && output.privateSnapshotExecuted === false &&
    output.decompressionPerformed === false && readonly.quarantineLaunched === false && readonly.privateSnapshotExecuted === false && readonly.decompressionPerformed === false &&
    sha256(raw[`${readonlyRoot}approved-request.json`]!) === historicalPins.approvedRequest && sha256(raw[`${readonlyRoot}source-review.json`]!) === historicalPins.review,
  "READONLY_QUALIFICATION_NOT_COMPATIBILITY_REQUIRED");
}
export function validateCompatibilityContinuation(input: CompatibilityContinuationInputs): ReturnType<typeof validateArchiveContinuation> {
  need(input.requestBytes instanceof Uint8Array && input.requestBytes.byteLength > 0 && input.requestBytes.byteLength <= compatibilityLimits.proofBytes &&
    sha256(input.requestBytes) === approvedCompatibilityRequestSha256, "EXACT_SYNTHETIC_DIAGNOSTIC_REQUEST_REQUIRED");
  const request = object(parse(input.requestBytes));
  need(request.status === "APPROVED_SYNTHETIC_DIAGNOSTIC_SOURCE_GATES_PENDING" && request.phase === "SYNTHETIC_DIAGNOSTIC_SOURCE_GATES_PENDING" &&
    request.authorityGranted === true && object(request.authorization).grantStatus === "APPROVED_NOT_EXECUTED", "UNCONSUMED_SYNTHETIC_DIAGNOSTIC_AUTHORITY_REQUIRED");
  const review = object(input.binding), files = object(review.files), proofs = object(review.predecessorProofs);
  const accepted = ["staticUnitTestsPassed", "staticTypesPassed", "adversarialSourceAccepted", "securitySourceAccepted", "devopsSourceAccepted"];
  need(keys(review, ["version", ...accepted, "requestSha256", "files", "predecessorProofs"]) && review.version === bindingVersion && accepted.every(key => review[key] === true), "COMPATIBILITY_SOURCE_ACCEPTANCE_REQUIRED");
  need(review.requestSha256 === approvedCompatibilityRequestSha256 && keys(files, reviewedFiles) && keys(input.evidence.files, reviewedFiles) &&
    keys(proofs, predecessorPaths) && keys(input.evidence.predecessorProofs, predecessorPaths), "COMPATIBILITY_BINDING_MEMBERSHIP_REQUIRED");
  for (const [paths, hashes, bytes] of [[reviewedFiles, files, input.evidence.files], [predecessorPaths, proofs, input.evidence.predecessorProofs]] as const)
    for (const path of paths) need(bytes[path] instanceof Uint8Array && bytes[path]!.byteLength <= compatibilityLimits.proofBytes &&
      (bytes[path]!.byteLength > 0 || /\.(stdout|stderr)$/.test(path)) && hashes[path] === sha256(bytes[path]!), "COMPATIBILITY_BINDING_HASH_MISMATCH");
  const raw = input.evidence.predecessorProofs, halted = raw[compatibilityPaths.haltedRequest]!, savedHalted = raw[compatibilityPaths.haltedSnapshot]!;
  need(sha256(halted) === haltedRequestSha256 && sha256(savedHalted) === haltedRequestSha256 && Buffer.from(halted).equals(Buffer.from(savedHalted)) &&
    object(parse(halted)).authorityGranted === false && String(object(parse(halted)).status).startsWith("HALTED"), "UNCHANGED_HALTED_FULL_REQUEST_REQUIRED");
  const capture = validateArchiveContinuation(historicalArchiveInputs(raw)); validateHistoricalFailure(raw);
  validateCompatibilityTaskConfiguration(input.evidence.files[compatibilityTaskConfiguration]!);
  validateCompatibilityFixture(input.evidence.files[compatibilityFixturePath]!);
  return capture;
}

const libraryRoots = ["/usr/lib/x86_64-linux-gnu", "/lib/x86_64-linux-gnu"] as const;
const nativeBinding = "C1_PATH_BIND_AFTER_FD_CLOSE_NOT_ATOMIC_MOUNT_CUSTODY" as const;
const privateBun = resolve(repository, `${base}cache/native-audit-bun-1/bun`);
const libraryName = (name: unknown): name is string => typeof name === "string" && /^[A-Za-z0-9][A-Za-z0-9_+.-]{0,254}$/.test(name) && name !== "." && name !== "..";
function validateFile(file: AuditedFile, maximum: number = compatibilityLimits.proofBytes): void {
  need(file && file.source.startsWith("/") && !file.source.includes("\0") && (file.identity.mode & 0o170000) === 0o100000 && (file.identity.mode & 0o7022) === 0 &&
    [0, process.getuid!()].includes(file.identity.uid) && Number.isSafeInteger(file.identity.bytes) && file.identity.bytes > 0 && file.identity.bytes <= maximum &&
    /^[a-f0-9]{64}$/.test(file.sha256), "COMPATIBILITY_FILE_IDENTITY_REQUIRED");
}
function validateNativeClosure(closure: ArchiveNativeClosure): void {
  need(closure.nativeBinding === nativeBinding && closure.custodyQualified === false && closure.launcher.source === "/usr/bin/bwrap" &&
    closure.files.length > 0 && closure.files.length <= 512, "FIXED_COMPATIBILITY_NATIVE_CLOSURE_REQUIRED");
  validateFile(closure.launcher, 536870912);
  const mounts = new Map(closure.files.map(mount => [mount.guest, mount.file])), required = new Set<string>(), visited = new Set<string>();
  need(mounts.size === closure.files.length, "UNIQUE_NATIVE_MOUNTS_REQUIRED");
  for (const [guest, file] of mounts) {
    validateFile(file, 536870912);
    const executable = guest === "/usr/local/bin/bun" ? privateBun : guest === "/usr/bin/xz" ? "/usr/bin/xz" : null;
    need(executable ? file.source === executable && (file.identity.mode & 0o111) !== 0 :
      (guest === "/lib64/ld-linux-x86-64.so.2" || libraryRoots.some(root => dirname(guest) === root && libraryName(guest.slice(root.length + 1)))) &&
      libraryRoots.some(root => dirname(file.source) === root), "FORBIDDEN_COMPATIBILITY_NATIVE_MOUNT");
    if (guest === "/usr/local/bin/bun") need(file.sha256 === "33d56b070be6a9e3da0ab013038b43d1645d0534ca811ecdba4472599117eb4b" &&
      file.identity.bytes === 80761952 && file.identity.mode === 0o100500 && file.identity.links === 2 && file.identity.uid === process.getuid!(), "PINNED_PRIVATE_COMPATIBILITY_BUN_REQUIRED");
  }
  const visit = (guest: string): void => {
    const file = mounts.get(guest); need(file, "COMPLETE_NATIVE_CLOSURE_REQUIRED"); required.add(guest);
    if (visited.has(file!.source)) return; visited.add(file!.source); need(visited.size <= 128, "NATIVE_CLOSURE_LIMIT");
    const elf = file!.elf;
    need(elf && keys(elf, ["interpreter", "needed", "soname"]) && (elf.soname === null || libraryName(elf.soname)) && Array.isArray(elf.needed) &&
      elf.needed.length <= 64 && new Set(elf.needed).size === elf.needed.length && elf.needed.every(libraryName), "BOUNDED_NATIVE_ELF_REQUIRED");
    if (elf!.interpreter !== null) {
      need(["/lib64/ld-linux-x86-64.so.2", ...libraryRoots.map(root => `${root}/ld-linux-x86-64.so.2`)].includes(elf!.interpreter), "FIXED_NATIVE_INTERPRETER_REQUIRED");
      visit(elf!.interpreter!);
    }
    for (const name of elf!.needed) {
      const aliases = libraryRoots.map(root => `${root}/${name}`);
      need(aliases.every(alias => mounts.has(alias)) && same(mounts.get(aliases[0]!), mounts.get(aliases[1]!)), "EXACT_NATIVE_LIBRARY_ALIASES_REQUIRED");
      for (const alias of aliases) visit(alias);
    }
  };
  visit("/usr/local/bin/bun"); visit("/usr/bin/xz");
  need(same([...required].sort(), [...mounts.keys()].sort()), "NO_UNUSED_NATIVE_MOUNTS_REQUIRED");
}
export type DirectoryIdentity = Readonly<{ device: string; inode: string; mode: number; uid: number }>;
export type CompatibilityDirectories = Readonly<{ input: DirectoryIdentity; output: DirectoryIdentity; evidence: DirectoryIdentity }>;
export type CompatibilityPlan = ArchiveNativeClosure & Readonly<{ version: "chess-coach.cuda-bun-compatibility-root-plan.v1";
  nativeClosure: ArchiveNativeClosure; inputDirectory: string; outputDirectory: string; evidenceRoot: string; directories: CompatibilityDirectories }>;
type SourcePath = `${typeof base}cuda-tar.ts` | typeof compatibilityFixturePath;
function makeCompatibilityPlan(closure: ArchiveNativeClosure, tar: AuditedFile, manifest: AuditedFile, fixture: AuditedFile,
  directories: CompatibilityDirectories, input: CompatibilityContinuationInputs): CompatibilityPlan {
  validateNativeClosure(closure);
  for (const [file, path] of [[tar, `${base}cuda-tar.ts`], [manifest, compatibilityFixturePath]] as const) {
    validateFile(file); need(file.source === resolve(repository, path) && file.sha256 === sha256(input.evidence.files[path]!) &&
      file.identity.bytes === input.evidence.files[path]!.byteLength, "EXACT_REVIEWED_COMPATIBILITY_INPUT_REQUIRED");
  }
  validateFile(fixture, compatibilityLimits.xzBytes);
  need(fixture.source === compatibilityPaths.preparedFixture && fixture.identity.bytes === compatibilityLimits.xzBytes && fixture.sha256 === compatibilityFixturePins.xzSha256 &&
    fixture.identity.uid === process.getuid!() && fixture.identity.mode === 0o100600, "EXACT_PREPARED_SYNTHETIC_FIXTURE_REQUIRED");
  return { ...closure, version: "chess-coach.cuda-bun-compatibility-root-plan.v1", nativeClosure: closure, directories,
    inputDirectory: compatibilityPaths.inputDirectory, outputDirectory: compatibilityPaths.outputDirectory, evidenceRoot: compatibilityPaths.evidenceRoot,
    files: [...closure.files, { guest: "/audit/cuda-tar.ts", file: tar }, { guest: "/inputs/fixture.json", file: manifest }, { guest: "/inputs/synthetic.tar.xz", file: fixture }]
      .sort((a, b) => a.guest.localeCompare(b.guest)) };
}
export const compatibilityCaseOrder = Object.freeze(["startup", "parser", "xz"] as const);
export type CompatibilityCase = typeof compatibilityCaseOrder[number];
export const compatibilityMarkers = Object.freeze({ startup: "CUDA_BUN_COMPAT_STARTUP_OK\n", parser: "CUDA_BUN_COMPAT_PARSER_OK\n", xz: "CUDA_BUN_COMPAT_XZ_OK\n" });
async function runSyntheticXZAudit(child: XZProcess, audit: (chunks: AsyncIterable<Uint8Array>) => Promise<unknown>, report: (bytes: Uint8Array) => void): Promise<unknown> {
  let failed = false, first: unknown, stdoutEOF = false, stderrEOF = false, stdoutLength = 0, stderrLength = 0;
  const retained: Uint8Array[] = [];
  const stop = (error: unknown) => { if (!failed) { failed = true; first = error; } try { child.kill(); } catch {} };
  const stderr = (async () => {
    try {
      for await (const chunk of child.stderr) {
        if (!(chunk instanceof Uint8Array)) throw Error("XZ_STDERR_INVALID");
        const keep = Math.min(chunk.byteLength, Math.max(0, 65536 - stderrLength)); if (keep) retained.push(chunk.slice(0, keep));
        stderrLength = Math.min(65537, stderrLength + chunk.byteLength); if (stderrLength > 65536) stop(Error("XZ_STDERR_LIMIT"));
      }
      stderrEOF = true;
    } catch (error) { stop(error); }
  })();
  const exit = child.exited.then(code => { if (code !== 0) stop(Error("XZ_EXIT_NONZERO")); }, () => { stop(Error("XZ_REAP_FAILED")); });
  let inventory: unknown;
  try {
    inventory = await audit((async function* () {
      for await (const bytes of child.stdout) {
        if (!(bytes instanceof Uint8Array)) throw Error("XZ_STDOUT_INVALID");
        stdoutLength += bytes.byteLength; if (stdoutLength > 1536) throw Error("SYNTHETIC_TAR_BYTE_LIMIT"); yield bytes;
      }
      stdoutEOF = true;
    })());
    if (!stdoutEOF || stdoutLength !== 1536) stop(Error("SYNTHETIC_TAR_EOF_REQUIRED"));
  } catch (error) { stop(error); }
  await Promise.all([stderr, exit]);
  if (!stderrEOF) stop(Error("XZ_STDERR_NOT_EOF"));
  if (stderrLength !== 0) stop(Error("XZ_STDERR_NOT_EMPTY"));
  if (failed) {
    const bytes = new Uint8Array(Math.min(stderrLength, 65536)); let offset = 0;
    for (const chunk of retained) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    try { report(bytes); } catch {} throw first;
  }
  return inventory;
}
const synthetic = buildCompatibilityFixture();
const inventoryCheck = `if(JSON.stringify(inventory)!==${JSON.stringify(JSON.stringify(synthetic.inventory))})throw Error('SYNTHETIC_INVENTORY_MISMATCH');`;
export const FIXED_STARTUP_PROGRAM = `process.stdout.write(${JSON.stringify(compatibilityMarkers.startup)});`;
export const FIXED_PARSER_PROGRAM = `
import { auditTar } from '/audit/cuda-tar.ts';
try {
  const inventory=await auditTar((async function*(){yield Buffer.from(${JSON.stringify(synthetic.tar.base64)},'base64');})());
  ${inventoryCheck}
  process.stdout.write(${JSON.stringify(compatibilityMarkers.parser)});
} catch { console.error('COMPATIBILITY_PARSER_FAILED'); process.exitCode=1; }
`;
export const FIXED_XZ_PROGRAM = `
import { auditTar } from '/audit/cuda-tar.ts';
try {
  const child=Bun.spawn(['/usr/bin/xz','--decompress','--stdout','--threads=1','--memlimit-decompress=256MiB','--','/inputs/synthetic.tar.xz'],
    {cwd:'/',env:${JSON.stringify(archiveChildEnvironment())},stdin:'ignore',stdout:'pipe',stderr:'pipe',detached:false});
  const inventory=await (${runSyntheticXZAudit.toString()})({stdout:child.stdout,stderr:child.stderr,exited:child.exited,kill:()=>child.kill('SIGKILL')},auditTar,bytes=>process.stderr.write(bytes));
  ${inventoryCheck}
  process.stdout.write(${JSON.stringify(compatibilityMarkers.xz)});
} catch { console.error('COMPATIBILITY_XZ_FAILED'); process.exitCode=1; }
`;
export const compatibilityCasePrograms = Object.freeze({ startup: FIXED_STARTUP_PROGRAM, parser: FIXED_PARSER_PROGRAM, xz: FIXED_XZ_PROGRAM });
export function compatibilityCasePlan() { return compatibilityCaseOrder.map((name, index) => ({ name, invocation: 1, dependsOn: index === 0 ? null : compatibilityCaseOrder[index - 1], program: compatibilityCasePrograms[name] })); }
export function compatibilityArgv(plan: CompatibilityPlan, name: CompatibilityCase): string[] {
  need(compatibilityCaseOrder.includes(name), "FIXED_COMPATIBILITY_CASE_REQUIRED");
  need(plan.version === "chess-coach.cuda-bun-compatibility-root-plan.v1" && plan.inputDirectory === compatibilityPaths.inputDirectory &&
    plan.outputDirectory === compatibilityPaths.outputDirectory && plan.evidenceRoot === compatibilityPaths.evidenceRoot && plan.nativeBinding === nativeBinding &&
    plan.custodyQualified === false && same(plan.launcher, plan.nativeClosure.launcher), "FIXED_COMPATIBILITY_PLAN_REQUIRED");
  validateNativeClosure(plan.nativeClosure);
  const extras = ["/audit/cuda-tar.ts", "/inputs/fixture.json", "/inputs/synthetic.tar.xz"];
  need(new Set(plan.files.map(mount => mount.guest)).size === plan.files.length && same(plan.files.filter(mount => !extras.includes(mount.guest)), plan.nativeClosure.files) &&
    extras.every(guest => plan.files.some(mount => mount.guest === guest)) && plan.files.length === plan.nativeClosure.files.length + 3, "EXACT_SHARED_COMPATIBILITY_MOUNTS_REQUIRED");
  const sources = [resolve(repository, `${base}cuda-tar.ts`), resolve(repository, compatibilityFixturePath), compatibilityPaths.preparedFixture];
  for (const [index, guest] of extras.entries()) {
    const file = plan.files.find(mount => mount.guest === guest)!.file; validateFile(file);
    need(file.source === sources[index], "FIXED_COMPATIBILITY_PAYLOAD_REALM_REQUIRED");
    if (index === 2) need(file.sha256 === compatibilityFixturePins.xzSha256 && file.identity.bytes === 1592 && file.identity.mode === 0o100600 && file.identity.uid === process.getuid!(), "EXACT_PREPARED_SYNTHETIC_FIXTURE_REQUIRED");
  }
  for (const directory of Object.values(plan.directories)) need(directory.mode === 0o40700 && directory.uid === process.getuid!() &&
    typeof directory.device === "string" && typeof directory.inode === "string", "PRIVATE_COMPATIBILITY_DIRECTORY_REQUIRED");
  const dirs = new Set(["/audit", "/inputs", "/output", "/proc", "/usr", "/usr/bin", "/usr/local", "/usr/local/bin", "/lib", "/lib64", "/usr/lib", ...libraryRoots]);
  return ["/usr/bin/bwrap", "--unshare-user", "--unshare-net", "--die-with-parent", "--clearenv", "--cap-drop", "ALL", "--chdir", "/",
    ...[...dirs].sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b)).flatMap(path => ["--dir", path]),
    "--dev", "/dev", "--remount-ro", "/dev", ...plan.files.flatMap(({ guest, file }) => ["--ro-bind", file.source, guest]),
    "--bind", plan.outputDirectory, "/output", ...Object.entries(archiveChildEnvironment()).flatMap(([key, value]) => ["--setenv", key, value]),
    "--remount-ro", "/", "--", "/usr/local/bin/bun", "--no-env-file", "--no-install", "-e", compatibilityCasePrograms[name]];
}

export type CompatibilityLaunchResult = Readonly<{ stdout: Uint8Array; stderr: Uint8Array; exitCode: number | null; signalCode: number | string | null;
  reaped: boolean; stdoutEOF: boolean; stderrEOF: boolean; failure: string | null; stdoutOverflow?: boolean; stderrOverflow?: boolean }>;
export type CompatibilityOutcome = "COMPATIBLE" | "BUN_ABORT_DIAGNOSTIC_OBSERVED" | "SKIPPED_DEPENDENCY" | "UNEXPECTED_FAILURE";
function knownAbort(stderr: Uint8Array): boolean {
  let text: string; try { text = decode(stderr); } catch { return false; }
  const lines = text.split("\n"), expected = [
    /^============================================================$/, /^Bun v1\.4\.0 \(34cbb9a40\) Linux x64$/,
    /^Linux Kernel v[^\r\n]+ \| glibc v[^\r\n]+$/, /^CPU: [a-zA-Z0-9 ]+$/,
    /^Args: "\/usr\/local\/bin\/bun" "--no-env-file" "--no-install" "-e" [^\r\n]+$/, /^Features: jsc ?$/, /^$/,
    /^Elapsed: \d+ms \| User: \d+ms \| Sys: \d+ms$/, /^RSS: [^\r\n]+ \| Peak: [^\r\n]+ \| Commit: [^\r\n]+ \| Faults: \d+$/, /^$/,
    /^panic\(main thread\): abort\(\) called$/, /^oh no: Bun has crashed\. This indicates a bug in Bun, not your code\.$/, /^$/,
    /^To send a redacted crash report to Bun's team,$/, /^please file a GitHub issue using the link below:$/, /^$/,
    /^ https:\/\/bun\.report\/1\.4\.0\/[^\s]+$/, /^$/, /^$/,
  ];
  return lines.length === expected.length && expected.every((pattern, index) => pattern.test(lines[index]!)) &&
    !/(?:bwrap\s*:|error[^\n]*setup|setup[^\n]*(?:error|fail)|Operation not permitted|Permission denied|No such file or directory)/i.test(text);
}
function validSignal(value: unknown): boolean {
  return value === null || (Number.isInteger(value) && Number(value) > 0 && Number(value) <= 128) || (typeof value === "string" && /^SIG[A-Z0-9]{1,20}$/.test(value));
}
export function classifyCompatibilityCase(name: CompatibilityCase, result: CompatibilityLaunchResult): Exclude<CompatibilityOutcome, "SKIPPED_DEPENDENCY"> {
  if (!compatibilityCaseOrder.includes(name) || !(result.stdout instanceof Uint8Array) || !(result.stderr instanceof Uint8Array) ||
    result.stdout.byteLength > 65536 || result.stderr.byteLength > 65536 || result.stdoutOverflow === true || result.stderrOverflow === true ||
    result.failure !== null || result.reaped !== true || result.stdoutEOF !== true || result.stderrEOF !== true || !validSignal(result.signalCode) ||
    !(result.exitCode === null || (Number.isInteger(result.exitCode) && Number(result.exitCode) >= 0 && Number(result.exitCode) <= 255))) return "UNEXPECTED_FAILURE";
  if (result.exitCode === 0 && result.signalCode === null && result.stderr.byteLength === 0 && Buffer.from(result.stdout).equals(Buffer.from(encode(compatibilityMarkers[name])))) return "COMPATIBLE";
  const nonzero = Number.isInteger(result.exitCode) && Number(result.exitCode) > 0 && Number(result.exitCode) <= 255;
  const signaled = result.signalCode !== null && result.exitCode === null;
  return result.stdout.byteLength === 0 && (nonzero || signaled) && knownAbort(result.stderr) ? "BUN_ABORT_DIAGNOSTIC_OBSERVED" : "UNEXPECTED_FAILURE";
}
export type CompatibilityChild = Readonly<{ stdout: AsyncIterable<Uint8Array>; stderr: AsyncIterable<Uint8Array>; exited: Promise<number>;
  signalCode: number | string | null; kill: (signal: "SIGKILL") => unknown }>;
const failureText = (error: unknown): string => error === "" ? "" : compatibilityFailureCode(error);
async function collectCompatibilityProcess(child: CompatibilityChild): Promise<CompatibilityLaunchResult> {
  let failed = false, failure: string | null = null, reaped = false, exitCode: number | null = null;
  const stop = (error: unknown) => {
    if (!failed) { failed = true; failure = failureText(error); }
    try { child.kill("SIGKILL"); } catch (error) { if (!failed) { failed = true; failure = failureText(error); } }
  };
  const collect = async (stream: AsyncIterable<Uint8Array>, label: string) => {
    const retained: Uint8Array[] = []; let size = 0, eof = false, overflow = false;
    try {
      for await (const chunk of stream) {
        if (!(chunk instanceof Uint8Array)) throw Error(`${label}_INVALID`);
        const keep = Math.min(chunk.byteLength, Math.max(0, 65536 - size)); if (keep) retained.push(chunk.slice(0, keep));
        size = Math.min(65537, size + chunk.byteLength);
        if (size > 65536) { overflow = true; stop(Error(`${label}_BYTE_LIMIT`)); }
      }
      eof = true;
    } catch (error) { stop(error); }
    return { bytes: new Uint8Array(Buffer.concat(retained)), eof, overflow };
  };
  const exit = (async () => { try { const code = await child.exited; reaped = true;
    if (!Number.isInteger(code) || code < 0 || code > 255) stop(Error("INVALID_LAUNCHER_EXIT")); else exitCode = code;
  } catch (error) { stop(error); } })();
  const [stdout, stderr] = await Promise.all([collect(child.stdout, "STDOUT"), collect(child.stderr, "STDERR"), exit]);
  let signalCode: number | string | null = null;
  try { signalCode = child.signalCode; } catch (error) { stop(error); }
  return { stdout: stdout.bytes, stderr: stderr.bytes, exitCode, signalCode, reaped, stdoutEOF: stdout.eof, stderrEOF: stderr.eof,
    failure, stdoutOverflow: stdout.overflow, stderrOverflow: stderr.overflow };
}
const failedLaunch = (error: unknown): CompatibilityLaunchResult => ({ stdout: new Uint8Array(), stderr: new Uint8Array(), exitCode: null, signalCode: null,
  reaped: false, stdoutEOF: false, stderrEOF: false, failure: failureText(error) });
export async function launchCompatibilityCase(plan: CompatibilityPlan, name: CompatibilityCase): Promise<CompatibilityLaunchResult> {
  const argv = compatibilityArgv(plan, name);
  try {
    const child = Bun.spawn(argv, { cwd: "/", env: archiveChildEnvironment(), stdin: "ignore", stdout: "pipe", stderr: "pipe", detached: false });
    return await collectCompatibilityProcess(child);
  } catch (error) { return failedLaunch(error); }
}
export type CompatibilityCaseResult = Readonly<{ name: CompatibilityCase; outcome: CompatibilityOutcome; reason: string | null; invocations: 0 | 1;
  launcher: Omit<CompatibilityLaunchResult, "stdout" | "stderr"> | null; streams: readonly Readonly<{ stream: string; path: string; bytes: number; sha256: string }>[] | null }>;
function caseResult(name: CompatibilityCase, launch: CompatibilityLaunchResult): CompatibilityCaseResult {
  const launcher = { exitCode: launch.exitCode, signalCode: launch.signalCode, reaped: launch.reaped, stdoutEOF: launch.stdoutEOF, stderrEOF: launch.stderrEOF,
    failure: launch.failure, stdoutOverflow: launch.stdoutOverflow ?? false, stderrOverflow: launch.stderrOverflow ?? false };
  return { name, outcome: classifyCompatibilityCase(name, launch), reason: launch.failure, invocations: 1, launcher,
    streams: (["stdout", "stderr"] as const).map(stream => ({ stream, path: `${runRoot}${name}.${stream}`, bytes: launch[stream].byteLength, sha256: sha256(launch[stream]) })) };
}
export type TrustedCompatibilityIO = Readonly<{ readContinuation: () => Promise<CompatibilityContinuationInputs>; nativeClosure: () => Promise<ArchiveNativeClosure>;
  readSource: (path: SourcePath) => Promise<AuditedFile>; claim: () => Promise<CompatibilityDirectories>; prepareFixture: (bytes: Uint8Array) => Promise<AuditedFile>;
  revalidate: (plan: CompatibilityPlan, input: CompatibilityContinuationInputs) => Promise<void>;
  launch: (plan: CompatibilityPlan, name: CompatibilityCase) => Promise<CompatibilityLaunchResult>;
  retain: (name: CompatibilityCase, launch: CompatibilityLaunchResult, result: CompatibilityCaseResult) => Promise<void>; commit: (bytes: Uint8Array) => Promise<void> }>;
export type CompatibilityResult = Readonly<{ version: "chess-coach.cuda-bun-compatibility-diagnostic.v1"; status: "FAIL" | "DIAGNOSTIC_COMPLETE"; scope: "DIAGNOSTIC_ONLY";
  requestSha256: string; haltedFullRequestSha256: string; sourceReviewCanonicalSha256: string; rootPlan: CompatibilityPlan; cases: readonly CompatibilityCaseResult[];
  diagnosticComplete: boolean; compatibilityPassed: boolean; archiveAuditPassed: false; fullPipelineRenewalAuthorized: false; extractionPerformed: false; llvmCodeExecuted: false;
  buildIsolationQualified: false; custodyQualified: false; cudaCompilationEstablished: false; actualHostExecuted: false; cudaGpuCodeExecuted: false;
  outerBootstrapTrust: "EXISTING_C1_BUN_AND_MISE_BOOTSTRAP_ASSUMPTION_RETAINED_NOT_AUTHENTICATED_BY_GUEST_SNAPSHOT"; trainingAuthorized: false; trainingReady: false }>;
export function validateCompatibilityResult(bytes: Uint8Array): CompatibilityResult {
  need(bytes instanceof Uint8Array && bytes.byteLength > 0 && bytes.byteLength <= compatibilityLimits.proofBytes, "BOUNDED_COMPATIBILITY_RESULT_REQUIRED");
  const value = object(parse(bytes));
  const denials = ["archiveAuditPassed", "fullPipelineRenewalAuthorized", "extractionPerformed", "llvmCodeExecuted", "buildIsolationQualified", "custodyQualified",
    "cudaCompilationEstablished", "actualHostExecuted", "cudaGpuCodeExecuted", "trainingAuthorized", "trainingReady"];
  need(keys(value, ["version", "status", "scope", "requestSha256", "haltedFullRequestSha256", "sourceReviewCanonicalSha256", "rootPlan", "cases", "diagnosticComplete",
    "compatibilityPassed", "outerBootstrapTrust", ...denials]) && value.version === "chess-coach.cuda-bun-compatibility-diagnostic.v1" && value.scope === "DIAGNOSTIC_ONLY" &&
    value.requestSha256 === approvedCompatibilityRequestSha256 && value.haltedFullRequestSha256 === haltedRequestSha256 &&
    typeof value.sourceReviewCanonicalSha256 === "string" && /^[a-f0-9]{64}$/.test(value.sourceReviewCanonicalSha256) && denials.every(key => value[key] === false) &&
    value.outerBootstrapTrust === "EXISTING_C1_BUN_AND_MISE_BOOTSTRAP_ASSUMPTION_RETAINED_NOT_AUTHENTICATED_BY_GUEST_SNAPSHOT", "CLOSED_DIAGNOSTIC_RESULT_SCOPE_REQUIRED");
  const plan = object(value.rootPlan);
  need(keys(plan, ["version", "files", "launcher", "nativeBinding", "custodyQualified", "nativeClosure", "directories", "inputDirectory", "outputDirectory", "evidenceRoot"]) &&
    keys(object(plan.nativeClosure), ["files", "launcher", "nativeBinding", "custodyQualified"]) && keys(object(plan.directories), ["input", "output", "evidence"]), "CLOSED_DIAGNOSTIC_RESULT_PLAN_REQUIRED");
  for (const name of compatibilityCaseOrder) compatibilityArgv(plan as CompatibilityPlan, name);
  need(Array.isArray(value.cases) && value.cases.length === 3, "THREE_ORDERED_DIAGNOSTIC_RESULTS_REQUIRED");
  let stopped: "ABORT" | "UNEXPECTED" | null = null;
  const emptySha = sha256(new Uint8Array());
  for (const [index, raw] of (value.cases as unknown[]).entries()) {
    const item = object(raw), name = compatibilityCaseOrder[index]!;
    need(keys(item, ["name", "outcome", "reason", "invocations", "launcher", "streams"]) && item.name === name, "CLOSED_ORDERED_DIAGNOSTIC_CASE_REQUIRED");
    if (stopped !== null) {
      need(item.outcome === "SKIPPED_DEPENDENCY" && item.invocations === 0 && item.launcher === null && item.streams === null &&
        item.reason === (stopped === "ABORT" ? "DEPENDENCY_BUN_ABORT_DIAGNOSTIC" : "SEQUENCE_STOPPED_UNEXPECTED_FAILURE"), "DEPENDENT_DIAGNOSTIC_MUST_NOT_LAUNCH"); continue;
    }
    need(item.invocations === 1 && typeof item.outcome === "string" && ["COMPATIBLE", "BUN_ABORT_DIAGNOSTIC_OBSERVED", "UNEXPECTED_FAILURE"].includes(item.outcome), "ONCE_ONLY_DIAGNOSTIC_CASE_REQUIRED");
    const launcher = object(item.launcher);
    need(keys(launcher, ["exitCode", "signalCode", "reaped", "stdoutEOF", "stderrEOF", "failure", "stdoutOverflow", "stderrOverflow"]) &&
      (launcher.exitCode === null || (Number.isInteger(launcher.exitCode) && Number(launcher.exitCode) >= 0 && Number(launcher.exitCode) <= 255)) && validSignal(launcher.signalCode) &&
      ["reaped", "stdoutEOF", "stderrEOF", "stdoutOverflow", "stderrOverflow"].every(key => typeof launcher[key] === "boolean") &&
      (launcher.failure === null || typeof launcher.failure === "string") && item.reason === launcher.failure, "CLOSED_LAUNCHER_OBSERVATION_REQUIRED");
    need(Array.isArray(item.streams) && item.streams.length === 2, "TWO_RETAINED_DIAGNOSTIC_STREAMS_REQUIRED");
    const streams = item.streams.map(object);
    for (const [streamIndex, stream] of streams.entries()) need(keys(stream, ["stream", "path", "bytes", "sha256"]) &&
      stream.stream === ["stdout", "stderr"][streamIndex] && stream.path === `${runRoot}${name}.${stream.stream}` && Number.isSafeInteger(stream.bytes) &&
      Number(stream.bytes) >= 0 && Number(stream.bytes) <= 65536 && typeof stream.sha256 === "string" && /^[a-f0-9]{64}$/.test(stream.sha256) &&
      (stream.bytes !== 0 || stream.sha256 === emptySha), "FIXED_BOUNDED_DIAGNOSTIC_STREAM_RECEIPT_REQUIRED");
    if (item.outcome !== "UNEXPECTED_FAILURE") need(launcher.reaped === true && launcher.stdoutEOF === true && launcher.stderrEOF === true && launcher.failure === null &&
      launcher.stdoutOverflow === false && launcher.stderrOverflow === false, "COMPLETE_DIAGNOSTIC_LIFECYCLE_REQUIRED");
    if (item.outcome === "COMPATIBLE") need(launcher.exitCode === 0 && launcher.signalCode === null && streams[0]!.bytes === encode(compatibilityMarkers[name]).byteLength &&
      streams[0]!.sha256 === sha256(encode(compatibilityMarkers[name])) && streams[1]!.bytes === 0 && streams[1]!.sha256 === emptySha, "EXACT_COMPATIBILITY_MARKER_RECEIPT_REQUIRED");
    if (item.outcome === "BUN_ABORT_DIAGNOSTIC_OBSERVED") {
      need(((Number.isInteger(launcher.exitCode) && Number(launcher.exitCode) > 0) || (launcher.exitCode === null && launcher.signalCode !== null)) &&
        streams[0]!.bytes === 0 && streams[0]!.sha256 === emptySha && Number(streams[1]!.bytes) > 0, "NONPASS_ABORT_DIAGNOSTIC_RECEIPT_REQUIRED"); stopped = "ABORT";
    }
    if (item.outcome === "UNEXPECTED_FAILURE") stopped = "UNEXPECTED";
  }
  const passed = (value.cases as CompatibilityCaseResult[]).every(item => item.outcome === "COMPATIBLE"), complete = stopped !== "UNEXPECTED";
  need(value.compatibilityPassed === passed && value.diagnosticComplete === complete && value.status === (complete ? "DIAGNOSTIC_COMPLETE" : "FAIL"), "DIAGNOSTIC_COMPLETION_NOT_COMPATIBILITY_REQUIRED");
  return value as CompatibilityResult;
}
export async function compatibilityCLI(args: readonly string[], io: TrustedCompatibilityIO = productionIO) {
  need(args.length === 1 && args[0] === "diagnose", "CLOSED_COMPATIBILITY_CLI_REQUIRED");
  const input = await io.readContinuation(), capture = validateCompatibilityContinuation(input);
  const fixture = validateCompatibilityFixture(input.evidence.files[compatibilityFixturePath]!);
  const closure = await io.nativeClosure(); validateNativeClosure(closure); validateArchivePlanSnapshot(closure, capture);
  const tar = await io.readSource(`${base}cuda-tar.ts`), manifest = await io.readSource(compatibilityFixturePath);
  for (const [file, path] of [[tar, `${base}cuda-tar.ts`], [manifest, compatibilityFixturePath]] as const) {
    validateFile(file); need(file.source === resolve(repository, path) && file.sha256 === sha256(input.evidence.files[path]!) &&
      file.identity.bytes === input.evidence.files[path]!.byteLength, "EXACT_REVIEWED_COMPATIBILITY_INPUT_REQUIRED");
  }
  const directories = await io.claim(), prepared = await io.prepareFixture(fixture.xz);
  const plan = makeCompatibilityPlan(closure, tar, manifest, prepared, directories, input); validateArchivePlanSnapshot(plan, capture);
  for (const name of compatibilityCaseOrder) compatibilityArgv(plan, name);
  const cases: CompatibilityCaseResult[] = []; let stopped: "ABORT" | "UNEXPECTED" | null = null;
  for (const name of compatibilityCaseOrder) {
    if (stopped !== null) { cases.push({ name, outcome: "SKIPPED_DEPENDENCY", reason: stopped === "ABORT" ? "DEPENDENCY_BUN_ABORT_DIAGNOSTIC" : "SEQUENCE_STOPPED_UNEXPECTED_FAILURE", invocations: 0, launcher: null, streams: null }); continue; }
    await io.revalidate(plan, input);
    let launch: CompatibilityLaunchResult;
    try { launch = await io.launch(plan, name); } catch (error) { launch = failedLaunch(error); }
    const result = caseResult(name, launch); await io.retain(name, launch, result); cases.push(result);
    if (result.outcome === "BUN_ABORT_DIAGNOSTIC_OBSERVED") stopped = "ABORT";
    if (result.outcome === "UNEXPECTED_FAILURE") stopped = "UNEXPECTED";
  }
  const result: CompatibilityResult = { version: "chess-coach.cuda-bun-compatibility-diagnostic.v1", status: stopped === "UNEXPECTED" ? "FAIL" : "DIAGNOSTIC_COMPLETE", scope: "DIAGNOSTIC_ONLY",
    requestSha256: approvedCompatibilityRequestSha256, haltedFullRequestSha256: haltedRequestSha256,
    sourceReviewCanonicalSha256: sha256(encode(canonical(input.binding))), rootPlan: plan, cases,
    diagnosticComplete: stopped !== "UNEXPECTED", compatibilityPassed: cases.every(item => item.outcome === "COMPATIBLE"),
    archiveAuditPassed: false, fullPipelineRenewalAuthorized: false, extractionPerformed: false, llvmCodeExecuted: false,
    buildIsolationQualified: false, custodyQualified: false, cudaCompilationEstablished: false, actualHostExecuted: false, cudaGpuCodeExecuted: false,
    outerBootstrapTrust: "EXISTING_C1_BUN_AND_MISE_BOOTSTRAP_ASSUMPTION_RETAINED_NOT_AUTHENTICATED_BY_GUEST_SNAPSHOT", trainingAuthorized: false, trainingReady: false };
  if (stopped === "UNEXPECTED") throw Object.assign(Error("COMPATIBILITY_UNEXPECTED_FAILURE"), { result });
  const bytes = encode(JSON.stringify(result) + "\n"); validateCompatibilityResult(bytes);
  await io.revalidate(plan, input); await io.commit(bytes); return result;
}

const identity = (stat: BigIntStats): NativeIdentity => ({ device: String(stat.dev), inode: String(stat.ino), bytes: Number(stat.size), mode: Number(stat.mode), uid: Number(stat.uid), links: Number(stat.nlink), mtime: String(stat.mtimeNs), ctime: String(stat.ctimeNs) });
async function trustedAncestors(path: string): Promise<void> {
  for (let current = dirname(path); ; current = dirname(current)) {
    const stat = await lstat(current);
    need(stat.isDirectory() && !stat.isSymbolicLink() && (stat.mode & 0o022) === 0 && [0, process.getuid!()].includes(stat.uid), "UNTRUSTED_COMPATIBILITY_ANCESTOR");
    if (current === "/") break;
  }
}
async function readAudited(path: string, maximum: number = compatibilityLimits.proofBytes): Promise<{ file: AuditedFile; bytes: Uint8Array }> {
  await trustedAncestors(path);
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = await handle.stat({ bigint: true }), id = identity(before);
    need(before.isFile() && before.size >= 0n && before.size <= BigInt(maximum) && (id.mode & 0o7022) === 0 && [0, process.getuid!()].includes(id.uid) &&
      same(id, identity(await lstat(path, { bigint: true }))), "BOUNDED_COMPATIBILITY_PROOF_REQUIRED");
    const chunks: Uint8Array[] = []; let offset = 0;
    while (true) {
      const buffer = Buffer.alloc(Math.min(65536, maximum - offset + 1)), result = await handle.read(buffer, 0, buffer.byteLength, offset);
      if (result.bytesRead === 0) break;
      need(result.bytesRead <= maximum - offset, "COMPATIBILITY_PROOF_BYTE_LIMIT"); chunks.push(buffer.subarray(0, result.bytesRead)); offset += result.bytesRead;
    }
    need(offset === id.bytes && same(id, identity(await handle.stat({ bigint: true }))) && same(id, identity(await lstat(path, { bigint: true }))), "COMPATIBILITY_PROOF_IDENTITY_CHANGED");
    const bytes = new Uint8Array(Buffer.concat(chunks)); return { file: { source: path, identity: id, sha256: sha256(bytes) }, bytes };
  } finally { await handle.close(); }
}
export async function readCompatibilityInputs(): Promise<CompatibilityContinuationInputs> {
  const fixed = async (path: string) => (await readAudited(resolve(repository, path))).bytes;
  const requestBytes = await fixed(requestPath);
  need(sha256(requestBytes) === approvedCompatibilityRequestSha256, "EXACT_SYNTHETIC_DIAGNOSTIC_REQUEST_REQUIRED");
  const binding = parse(await fixed(bindingPath));
  const files = Object.fromEntries(await Promise.all(reviewedFiles.map(async path => [path, await fixed(path)])));
  const predecessorProofs = Object.fromEntries(await Promise.all(predecessorPaths.map(async path => [path, await fixed(path)])));
  return { requestBytes, binding, evidence: { files, predecessorProofs } };
}
type ClosedFile = Readonly<{ write: (bytes: Uint8Array) => Promise<void>; sync: () => Promise<void>; close: () => Promise<void> }>;
async function writeSyncClose(bytes: Uint8Array, stage: ClosedFile): Promise<void> {
  let failed = false, first: unknown;
  try { await stage.write(bytes); await stage.sync(); } catch (error) { failed = true; first = error; }
  try { await stage.close(); } catch (error) { if (!failed) { failed = true; first = error; } }
  if (failed) throw first;
}
async function exclusiveFile(path: string): Promise<ClosedFile> {
  const handle = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  return { write: bytes => handle.writeFile(bytes), sync: () => handle.sync(), close: () => handle.close() };
}
async function commitResult(bytes: Uint8Array, io: Readonly<{ openStage: () => Promise<ClosedFile>; publish: () => Promise<void> }>): Promise<void> {
  need(bytes.byteLength > 0 && bytes.byteLength <= compatibilityLimits.proofBytes, "COMPATIBILITY_RESULT_BYTE_LIMIT");
  await writeSyncClose(bytes, await io.openStage()); await io.publish();
}
async function privateDirectory(path: string): Promise<DirectoryIdentity> {
  await trustedAncestors(path); const stat = await lstat(path, { bigint: true });
  need(stat.isDirectory() && !stat.isSymbolicLink() && stat.mode === 0o40700n && stat.uid === BigInt(process.getuid!()) && await realpath(path) === path, "PRIVATE_COMPATIBILITY_DIRECTORY_REQUIRED");
  return { device: String(stat.dev), inode: String(stat.ino), mode: Number(stat.mode), uid: Number(stat.uid) };
}
async function fixedParents(): Promise<void> {
  for (const path of [resolve(repository, base), resolve(repository, `${base}runs`), resolve(repository, `${base}scratch`)]) {
    await trustedAncestors(path); const stat = await lstat(path);
    need(stat.isDirectory() && !stat.isSymbolicLink() && stat.uid === process.getuid!() && (stat.mode & 0o022) === 0 && await realpath(path) === path, "FIXED_COMPATIBILITY_PARENT_REQUIRED");
  }
}
const operationBytes = encode('{"version":"chess-coach.cuda-bun-compatibility-operation.v1","sequence":"cuda-bun-compatibility-1","maximumCases":3,"maximumInvocationsPerCase":1}\n');
async function claimCompatibilityOperation(io: Readonly<{ validate: () => Promise<void>; marker: () => Promise<void>; directories: () => Promise<CompatibilityDirectories> }>): Promise<CompatibilityDirectories> {
  await io.validate(); await io.marker(); return io.directories();
}
async function retainCase(name: CompatibilityCase, launch: CompatibilityLaunchResult, result: CompatibilityCaseResult,
  write: (path: string, bytes: Uint8Array) => Promise<void>): Promise<void> {
  need(compatibilityCaseOrder.includes(name) && launch.stdout.byteLength <= 65536 && launch.stderr.byteLength <= 65536, "BOUNDED_COMPATIBILITY_STREAMS_REQUIRED");
  await write(`${runRoot}${name}.stdout`, launch.stdout); await write(`${runRoot}${name}.stderr`, launch.stderr);
  await write(`${runRoot}${name}.json`, encode(JSON.stringify(result) + "\n"));
}
const productionIO: TrustedCompatibilityIO = {
  readContinuation: readCompatibilityInputs, nativeClosure: prepareArchiveNativeClosure,
  async readSource(path) { need(path === `${base}cuda-tar.ts` || path === compatibilityFixturePath, "FIXED_COMPATIBILITY_SOURCE_REQUIRED"); return (await readAudited(resolve(repository, path))).file; },
  claim: () => claimCompatibilityOperation({
    async validate() { await fixedParents(); await privateDirectory(compatibilityPaths.evidenceRoot); },
    async marker() { await writeSyncClose(operationBytes, await exclusiveFile(resolve(compatibilityPaths.evidenceRoot, ".operation"))); },
    async directories() {
      await mkdir(compatibilityPaths.inputDirectory, { mode: 0o700 }); await mkdir(compatibilityPaths.outputDirectory, { mode: 0o700 });
      return { input: await privateDirectory(compatibilityPaths.inputDirectory), output: await privateDirectory(compatibilityPaths.outputDirectory), evidence: await privateDirectory(compatibilityPaths.evidenceRoot) };
    },
  }),
  async prepareFixture(bytes) {
    need(bytes.byteLength === 1592 && sha256(bytes) === compatibilityFixturePins.xzSha256, "EXACT_SYNTHETIC_XZ_BYTES_REQUIRED");
    await privateDirectory(compatibilityPaths.inputDirectory); await writeSyncClose(bytes, await exclusiveFile(compatibilityPaths.preparedFixture));
    const prepared = await readAudited(compatibilityPaths.preparedFixture, 1592);
    need(prepared.file.sha256 === compatibilityFixturePins.xzSha256 && Buffer.from(prepared.bytes).equals(Buffer.from(bytes)), "PREPARED_SYNTHETIC_XZ_READBACK_REQUIRED"); return prepared.file;
  },
  async revalidate(plan, input) {
    const current = await readCompatibilityInputs(), capture = validateCompatibilityContinuation(current), native = await prepareArchiveNativeClosure();
    validateArchivePlanSnapshot(native, capture); await fixedParents();
    const directories = { input: await privateDirectory(compatibilityPaths.inputDirectory), output: await privateDirectory(compatibilityPaths.outputDirectory), evidence: await privateDirectory(compatibilityPaths.evidenceRoot) };
    const marker = await readAudited(resolve(compatibilityPaths.evidenceRoot, ".operation"));
    need(Buffer.from(marker.bytes).equals(Buffer.from(operationBytes)), "COMPATIBILITY_OPERATION_MARKER_CHANGED");
    const tar = await readAudited(resolve(repository, `${base}cuda-tar.ts`)), manifest = await readAudited(resolve(repository, compatibilityFixturePath));
    const prepared = await readAudited(compatibilityPaths.preparedFixture, 1592), fresh = makeCompatibilityPlan(native, tar.file, manifest.file, prepared.file, directories, current);
    validateArchivePlanSnapshot(fresh, capture);
    need(sha256(current.requestBytes) === sha256(input.requestBytes) && same(current.binding, input.binding) && same(fresh, plan), "COMPATIBILITY_INPUT_OR_ROOT_CHANGED");
  },
  launch: launchCompatibilityCase,
  retain: (name, launch, result) => retainCase(name, launch, result, async (path, bytes) => { await writeSyncClose(bytes, await exclusiveFile(resolve(repository, path))); }),
  commit: bytes => commitResult(bytes, { openStage: () => exclusiveFile(resolve(compatibilityPaths.evidenceRoot, "result.pending.json")),
    publish: () => link(resolve(compatibilityPaths.evidenceRoot, "result.pending.json"), resolve(compatibilityPaths.evidenceRoot, "result.json")) }),
};
export function compatibilityEnvironment(): Record<string, string> { return { ...environment, MISE_OVERRIDE_CONFIG_FILENAMES: "cuda-bun-compatibility-mise.toml" }; }
export function validateCompatibilityTaskConfiguration(bytes: Uint8Array): void {
  need(bytes.byteLength > 0 && bytes.byteLength <= 4096 && same(Bun.TOML.parse(decode(bytes)), { tasks: { "cuda:diagnose-bun-root": {
    dir: "../..", run: "/usr/local/bin/bun --no-env-file --no-install _work/gpu-owner-recovery/cuda-bun-compatibility.ts diagnose" } } }), "EXACT_COMPATIBILITY_TASK_CONFIGURATION_REQUIRED");
}
export type CompatibilityMiseStage = Readonly<{ name: "00-trust" | "01-config" | "02-diagnose"; argv: string[] }>;
export function compatibilityStagePlan(): CompatibilityMiseStage[] { return [
  { name: "00-trust", argv: ["/usr/local/bin/mise", "trust", resolve(repository, compatibilityTaskConfiguration)] },
  { name: "01-config", argv: ["/usr/local/bin/mise", "config", "ls", "--json"] },
  { name: "02-diagnose", argv: ["/usr/local/bin/mise", "run", "--raw", "cuda:diagnose-bun-root"] },
]; }
export function validateCompatibilityMiseDiscovery(bytes: Uint8Array): void {
  need(bytes.byteLength > 0 && bytes.byteLength <= 65536, "SOLE_COMPATIBILITY_CONFIGURATION_REQUIRED"); const value = parse(bytes);
  need(Array.isArray(value) && value.length === 1 && object(value[0]).path === resolve(repository, compatibilityTaskConfiguration) &&
    (object(value[0]).tools === undefined || same(object(value[0]).tools, [])), "SOLE_COMPATIBILITY_CONFIGURATION_REQUIRED");
}
export async function runCompatibilityMiseStages(io: Readonly<{ verifyOutsideGate: () => Promise<void>; readTaskConfiguration: () => Promise<Uint8Array>;
  run: (stage: CompatibilityMiseStage) => Promise<{ exitCode: number; stdout: Uint8Array; failure?: string | null }> }>) {
  const completedStages: CompatibilityMiseStage["name"][] = [];
  for (const stage of compatibilityStagePlan()) {
    await io.verifyOutsideGate(); validateCompatibilityTaskConfiguration(await io.readTaskConfiguration());
    let result: Awaited<ReturnType<typeof io.run>> | undefined, failed = false, first: unknown;
    try { result = await io.run(stage); } catch (error) { failed = true; first = error; }
    try { await io.verifyOutsideGate(); } catch (error) { if (!failed) { failed = true; first = error; } }
    if (failed) throw first;
    need(result && Number.isInteger(result.exitCode) && result.exitCode >= 0 && result.exitCode <= 255, "INVALID_COMPATIBILITY_MISE_EXIT");
    if (result!.exitCode !== 0 || (result!.failure !== undefined && result!.failure !== null)) return { exitCode: result!.exitCode || 1, failedStage: stage.name, completedStages };
    if (stage.name === "01-config") validateCompatibilityMiseDiscovery(result!.stdout); completedStages.push(stage.name);
  }
  return { exitCode: 0, failedStage: null, completedStages };
}
export const compatibilityTestOnly = Object.freeze({ makeCompatibilityPlan, validateNativeClosure, runSyntheticXZAudit, collectCompatibilityProcess,
  writeSyncClose, commitResult, claimCompatibilityOperation, retainCase, productionIO, knownAbort });
if (import.meta.main) {
  try { await compatibilityCLI(Bun.argv.slice(2)); } catch (error) { console.error(compatibilityFailureCode(error)); process.exitCode = 1; }
}
