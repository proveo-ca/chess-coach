import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonical } from "../../challenge/config";
import { REPOSITORY_ROOT, sha256 } from "../../challenge/corpus";
import { classifyScheduledEvidence, executionPins, normalizeEvidence, summarize, type runBaselineSuite } from "../../challenge/evidence";
import { createMigration, migrationInventoryDiagnostics, ORIGINAL_BASELINE_SHA256, ORIGINAL_VERIFICATION_SHA256 } from "../../challenge/pinMigration";
import { loadTrustedExecutionContext } from "../../challenge/schedule";
import { measureCoverage } from "../../challengeContract/coverage";
import { measureR2Composition } from "../../../../../scripts/r2-composition-evidence";

const require = createRequire(import.meta.url);
const { tmpfsOptions } = require("../../../hermetic/policy.mjs") as { tmpfsOptions: string };
export const { evidenceLimits } = require("../../../hermetic/evidence-limits.mjs") as {
  evidenceLimits: { fileBytes: number; retainedBytes: number; archiveBytes: number; scanBytes: number; metadataBytes: number; entries: number; pathBytes: number };
};
const runtimePins = require("../../../hermetic/pins.json") as { node: string };
const { verificationCommands, VITEST_FLOORS, ASSERTION_FLOORS_VERSION } = require("../../../hermetic/verification-plan.mjs") as {
  verificationCommands: (root: string) => { executable: string; args: string[]; cwd: string }[];
  VITEST_FLOORS: Record<string, number>; ASSERTION_FLOORS_VERSION: string;
};
const { checkPublicClosure } = require("../../../hermetic/public-closure.mjs") as { checkPublicClosure: (root: string) => unknown };
const { infrastructureHost, INFRASTRUCTURE_VERSION, infraPath } = require("../../../../../scripts/challenge-infrastructure-evidence.mjs") as {
  infrastructureHost: (read: (path: string) => Buffer) => Record<string, unknown>; INFRASTRUCTURE_VERSION: string; infraPath: string;
};
const history = require("./challenge-history-pins.json") as { files: Record<string, { bytes: number; sha256: string }> };
export const repositoryRoot = fileURLToPath(REPOSITORY_ROOT);
export type Baseline = Awaited<ReturnType<typeof runBaselineSuite>>;
export type Coverage = ReturnType<typeof measureCoverage>;
export const jsonBytes = (value: unknown) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
export const decode = <T>(bytes: Buffer): T => JSON.parse(bytes.toString("utf8")) as T;

export function originalEvidence() {
  const baseline = readFileSync(new URL("_spec/evidence/ml-adjutant-phase1/baseline-report.json", REPOSITORY_ROOT));
  const verification = readFileSync(new URL("_spec/evidence/ml-adjutant-phase1/verification.json", REPOSITORY_ROOT));
  if (sha256(baseline) !== ORIGINAL_BASELINE_SHA256 || sha256(verification) !== ORIGINAL_VERIFICATION_SHA256) throw new Error("Original Phase1 raw-byte pins changed");
  return { baseline, verification };
}

export function readEvidenceGeneration() {
  const names = ["baseline-report.json", "coverage.json", "contract-report.json", "pin-migration.json"] as const;
  const fresh = process.env.HERMETIC_OUTPUT_DIRECTORY;
  if (fresh === "") throw new Error("HERMETIC_OUTPUT_DIRECTORY must name a fresh evidence directory");
  const historicalDirectory = fileURLToPath(new URL("_spec/evidence/ml-adjutant-phase2", REPOSITORY_ROOT));
  const refreshedDirectory = fileURLToPath(new URL("_spec/evidence/ml-adjutant-r2-refresh", REPOSITORY_ROOT));
  const directory = fresh ?? (existsSync(refreshedDirectory) ? refreshedDirectory : historicalDirectory);
  const historical = !fresh && directory === historicalDirectory;
  let files: Record<typeof names[number], Buffer> & { "r2-composition-report.json"?: Buffer };
  if (!fresh && !historical) {
    const { readPublishedBundle } = require("../../../hermetic/evidence-bundle.mjs") as {
      readPublishedBundle: (path: string) => { artifacts: Map<string, Buffer> };
    };
    const bundle = readPublishedBundle(directory);
    files = Object.fromEntries(names.map((name) => {
      const bytes = bundle.artifacts.get(name);
      if (!bytes) throw new Error(`Published evidence is missing ${name}`);
      return [name, bytes];
    })) as Record<typeof names[number], Buffer>;
    const composition = bundle.artifacts.get("r2-composition-report.json");
    if (!composition) throw new Error("Published evidence is missing r2-composition-report.json");
    files["r2-composition-report.json"] = composition;
  } else {
    files = Object.fromEntries(names.map((name) => [name, readFileSync(join(directory, name))])) as Record<typeof names[number], Buffer>;
    if (fresh) files["r2-composition-report.json"] = readFileSync(join(directory, "r2-composition-report.json"));
  }
  if (historical) {
    for (const name of names) {
      const pinned = history.files[`_spec/evidence/ml-adjutant-phase2/${name}`];
      if (!pinned || files[name].length !== pinned.bytes || sha256(files[name]) !== pinned.sha256) throw new Error(`Unpublished evidence is not locked history: ${name}`);
    }
  }
  return { files, historical, directory };
}

export function buildDiagnosticFixture() {
  const original = originalEvidence();
  const before = decode<Baseline>(original.baseline);
  const context = loadTrustedExecutionContext("all");
  const pins = { ...executionPins(), nodeVersion: `v${runtimePins.node}` };
  const rows = structuredClone(before.rows);
  const current: Baseline = {
    ...before, version: "phase2-baseline-report-v2", kind: "phase2-current-baseline",
    independentVerification: "_spec/evidence/ml-adjutant-r2-refresh/verification.json",
    migrationReference: "_spec/evidence/ml-adjutant-r2-refresh/pin-migration.json", pins, rows,
    summary: summarize(rows, context), accounting: classifyScheduledEvidence(rows, context),
    executionIntegrity: true, learnedGateEligible: false, learnedChallengePass: false, modelArtifact: null,
    deterministicRerun: { performed: true, equal: true, comparisons: rows.map((row) => ({
      key: row.match.key, equal: true, firstSha256: sha256(normalizeEvidence(row)), rerunSha256: sha256(normalizeEvidence(row)),
    })) },
  };
  const currentBytes = jsonBytes(current);
  const migration = createMigration(original.baseline, original.verification, currentBytes);
  if (!migration.passed) throw new Error("Fixture baseline migration failed");
  const coverage = measureCoverage();
  if (canonical(coverage) !== canonical(measureCoverage())) throw new Error("Fixture coverage rerun mismatch");
  const composition = measureR2Composition();
  return {
    "baseline-report.json": currentBytes,
    "coverage.json": jsonBytes(coverage),
    "r2-composition-report.json": jsonBytes(composition),
    "pin-migration.json": jsonBytes({ ...migration,
      fromPinFormat: "phase1-legacy-digests", toPinFormat: pins.version,
      ...migrationInventoryDiagnostics(pins.sourceInventory),
    }),
    "contract-report.json": jsonBytes({ version: "phase2-contract-report-v2", pins,
      r2CompositionVersion: composition.version, r2CompositionSha256: sha256(canonical(composition)),
      coverageSha256: sha256(canonical(coverage)), baselineReportSha256: sha256(currentBytes),
      phase1BaselineReportSha256: migration.originalBaselineSha256, migrationParity: migration.passed, coverageDeterministic: true,
      observationCodecVersion: coverage.observationCodecVersion, candidateCodecVersion: coverage.candidateCodecVersion,
      enumerationVersion: coverage.enumerationVersion, comparatorVersion: coverage.comparatorVersion,
      featureSchema: coverage.featureSchema, learnedGateEligible: false, modelArtifact: null,
    }),
  };
}

export function syntheticVitestReport(count: number, pkg: string) {
  return { success: true, numTotalTests: count, numPassedTests: count, numFailedTests: 0,
    numPendingTests: 0, numTodoTests: 0, numTotalTestSuites: 1, numPassedTestSuites: 1, numFailedTestSuites: 0,
    numPendingTestSuites: 0, startTime: 1, testResults: [{ name: `/app/packages/${pkg}/src/__tests__/synthetic.test.ts`,
      status: "passed", startTime: 1, endTime: 2, message: "", assertionResults: Array.from({ length: count }, (_, index) => ({
        ancestorTitles: ["synthetic test-only assertions"], fullName: `synthetic assertion ${index}`, title: `assertion ${index}`,
        status: "passed", duration: 1, failureMessages: [], meta: {},
      })) }], };
}

export function tarHeader(name: string, size: number) {
  const header = Buffer.alloc(512);
  header.write(name); header.write("0000644\0", 100); header.write("0000000\0", 108); header.write("0000000\0", 116);
  header.write(`${size.toString(8).padStart(11, "0")}\0`, 124); header.write("00000000000\0", 136);
  header.fill(32, 148, 156); header[156] = 48; header.write("ustar\0", 257); header.write("00", 263);
  const checksum = header.reduce((total, byte) => total + byte, 0);
  header.write(`${checksum.toString(8).padStart(6, "0")}\0 `, 148);
  return header;
}
export function tarArchive(entries: [string, Buffer][]) {
  return Buffer.concat([...entries.flatMap(([name, bytes]) => [tarHeader(name, bytes.length), bytes,
    Buffer.alloc((512 - bytes.length % 512) % 512)]), Buffer.alloc(1024)]);
}
export function syntheticImageArchive(options: { layers?: Buffer[]; manifestLayers?: string[]; duplicate?: boolean } = {}) {
  const layers = options.layers ?? [tarArchive([["test-only.txt", Buffer.from("synthetic uncompressed layer one")]]),
    tarArchive([["test-only.txt", Buffer.from("synthetic uncompressed layer two")]])];
  const config = jsonBytes({ architecture: "amd64", os: "linux", config: { User: "10001:10001" },
    rootfs: { type: "layers", diff_ids: layers.map((layer) => `sha256:${sha256(layer)}`) } });
  const entries: [string, Buffer][] = [["config.json", config], ...layers.map((layer, index): [string, Buffer] => [`layer-${index}.tar`, layer]),
    ["manifest.json", jsonBytes([{ Config: "config.json", RepoTags: null, Layers: options.manifestLayers ?? layers.map((_, index) => `layer-${index}.tar`) }])]];
  if (options.duplicate) entries.push(["config.json", config]);
  return { bytes: tarArchive(entries), image: `sha256:${sha256(config)}` };
}

type Log = { path: string; sha256: string; bytes: number; observedBytes: number; truncated: boolean };
export type Command = { executable: string; args: string[]; cwd: string; exitCode: number; signal: null; error: null;
  logs: { stdout: Log; stderr: Log }; tests?: { path?: string; success: boolean; failed: number; passed: number; total: number; sha256: string } };
export type Verification = { version: string; passed: boolean; assurance: Record<string, string>; commands: Command[];
  assertionFloorsVersion: string; assertionFloors: Record<string, number>;
  artifacts: { path: string; type: string; bytes: number; sha256: string }[] };

export function buildImportFixture(diagnostics: ReturnType<typeof buildDiagnosticFixture>, roots: string[]) {
  mkdirSync("/tmp/opencode", { recursive: true });
  const root = mkdtempSync("/tmp/opencode/import-root-");
  const output = mkdtempSync("/tmp/opencode/import-output-");
  roots.push(root, output);
  const original = originalEvidence();
  const originalDirectory = join(root, "_spec/evidence/ml-adjutant-phase1");
  mkdirSync(originalDirectory, { recursive: true });
  writeFileSync(join(originalDirectory, "baseline-report.json"), original.baseline);
  writeFileSync(join(originalDirectory, "verification.json"), original.verification);
  const target = "/app/_spec/evidence/ml-adjutant-r2-refresh";
  const current = decode<Baseline>(diagnostics["baseline-report.json"]);
  current.pins = { ...executionPins(), nodeVersion: `v${runtimePins.node}` };
  const currentBytes = jsonBytes(current);
  const migration = decode<Record<string, unknown>>(diagnostics["pin-migration.json"]);
  const contract = decode<Record<string, unknown>>(diagnostics["contract-report.json"]);
  const inventory = current.pins.sourceInventory;
  Object.assign(migration, { currentBaselineSha256: sha256(currentBytes), ...migrationInventoryDiagnostics(inventory) });
  Object.assign(contract, { pins: current.pins, baselineReportSha256: sha256(currentBytes) });
  const files: Record<string, Buffer> = { ...diagnostics,
    "baseline-report.json": currentBytes, "pin-migration.json": jsonBytes(migration), "contract-report.json": jsonBytes(contract),
    ...Object.fromEntries(Object.entries(VITEST_FLOORS).map(([file, count]) => [file, jsonBytes(syntheticVitestReport(count, file.slice(7, -5)))])),
    "public-closure-report.json": jsonBytes(checkPublicClosure(repositoryRoot)),
  };
  const commands = verificationCommands(repositoryRoot).map(({ executable, args, cwd }, index): Command => {
    const prefix = `logs/command-${String(index + 1).padStart(2, "0")}`;
    files[`${prefix}.stdout.log`] = index === 10 ? files["public-closure-report.json"]! : Buffer.from("synthetic test-only command output\n");
    files[`${prefix}.stderr.log`] = Buffer.alloc(0);
    const log = (stream: string): Log => ({ path: `${target}/${prefix}.${stream}.log`, sha256: sha256(files[`${prefix}.${stream}.log`]!), bytes: files[`${prefix}.${stream}.log`]!.length, observedBytes: files[`${prefix}.${stream}.log`]!.length, truncated: false });
    const command: Command = { executable, args, cwd, exitCode: 0, signal: null, error: null, logs: { stdout: log("stdout"), stderr: log("stderr") } };
    if (executable.endsWith("/vitest")) {
      const name = args.at(-1)!.split("/").at(-1)!;
      const count = VITEST_FLOORS[name]!;
      command.tests = { path: args.at(-1)!, success: true, failed: 0, passed: count, total: count, sha256: sha256(files[name]!) };
    }
    return command;
  });
  const assurance = { sourceSha256: "source", installedSha256: "installed", frozenStoreSha256: "store", toolsSha256: "tools" };
  const verification: Verification = { version: "hermetic-verification-v3", assertionFloorsVersion: ASSERTION_FLOORS_VERSION, assertionFloors: VITEST_FLOORS, passed: true, assurance, commands, artifacts: [] };
  const policy = { Id: "c".repeat(64), Image: "", HostConfig: { NetworkMode: "none", PidMode: "", IpcMode: "private", ReadonlyRootfs: true, Privileged: false, Init: true,
    NanoCpus: 2_000_000_000, Memory: 4 * 1024 ** 3, MemorySwap: 4 * 1024 ** 3, PidsLimit: 256,
    CapDrop: ["ALL"], CapAdd: null, SecurityOpt: ["no-new-privileges=true"], Tmpfs: { "/tmp": tmpfsOptions } },
    Config: { User: "10001:10001" }, Mounts: [{ Type: "bind", Destination: target, Source: output, RW: true, Propagation: "rprivate" }, { Type: "tmpfs", Destination: "/tmp" }] };
  const hostLog = Buffer.from("synthetic host log\n");
  const hostLogPath = join(output, "host.log"); writeFileSync(hostLogPath, hostLog);
  const host = { logs: Object.fromEntries(["stdout", "stderr"].map((stream) => [stream, { path: hostLogPath, sha256: sha256(hostLog), bytes: hostLog.length, observedBytes: hostLog.length, truncated: false }])) };
  const archive = syntheticImageArchive();
  const archivePath = join(output, "image.tar"); writeFileSync(archivePath, archive.bytes);
  policy.Image = archive.image;
  const envelope = { image: archive.image, imageInspection: { Id: archive.image },
    measurements: { source: { sourceSha256: "source" }, dependencies: { installedSha256: "installed", frozenStoreSha256: "store", toolTreeSha256: "tools" } },
    buildLog: host, executionLog: host, archive: archivePath, archiveSha256: sha256(archive.bytes), archiveBytes: archive.bytes.length };
  const execution = { ...envelope, executionLog: { ...host, executable: "docker", args: ["start", "--attach", policy.Id], exitCode: 0, signal: null, error: null }, passed: true, status: "passed", output, initialContainerInspection: policy,
    finalContainerInspection: { ...policy, State: { ExitCode: 0, OOMKilled: false } } };
  const controlSha256 = sha256("synthetic test-only infrastructure control");
  const dependencyImage = `sha256:${sha256("synthetic test-only dependency image independent of source image")}`;
  const infrastructureMeasurement = { dependencies: envelope.measurements.dependencies, capture: { controlSha256 },
    closure: { actual: { tools: { node: runtimePins.node }, packages: {} } }, method: "synthetic-test-only-host-boundary" };
  const context = join(output, "source-build/context");
  const dependencyTag = `starchess-hermetic-dependencies:${dependencyImage.slice(7)}`;
  const buildArguments = ["build", "--platform", "linux/amd64", "--pull=false", "--target", "runtime", "--network=none", "--build-arg", `FROZEN_DEPENDENCIES=${dependencyTag}`, "--iidfile", join(dirname(context), "image-id"), "--file", join(context, "Dockerfile"), context];
  const build = { ...envelope, buildArguments, buildLog: { ...host, executable: "docker", args: [...buildArguments], exitCode: 0, signal: null, error: null }, capture: { runtime: { sha256: "source" }, control: { sha256: controlSha256 } },
    frozenDependency: { image: dependencyImage, localBuildReference: dependencyTag, measurements: infrastructureMeasurement } };
  const paths = { execution: join(output, "execution.json"), build: join(output, "build.json"), export: join(output, "export.json"), infrastructure: join(output, "infrastructure.json") };
  const probeWork = join(output, "host-probe");
  const probeOutput = join(probeWork, "output");
  const infrastructureFiles: Record<string, Buffer> = {};
  const infrastructureLog = (path: string) => {
    const bytes = infrastructureFiles[path] ?? Buffer.alloc(0); infrastructureFiles[path] = bytes;
    return { path, bytes: bytes.length, sha256: sha256(bytes), observedBytes: bytes.length, truncated: false };
  };
  const probeCommands = [
    { executable: "/app/packages/starchess-arena/node_modules/.bin/tsx", args: ["/tmp/test/source-only-inventory.ts"] },
    { executable: "/app/packages/starchess-arena/node_modules/.bin/tsx", args: ["/tmp/test/direct.ts"] },
    { executable: "/app/packages/starchess-arena/node_modules/.bin/vitest", args: ["run", "--config", "/tmp/test/config.mts", "--configLoader", "native", "--reporter=default", "--reporter=json", "--outputFile", `${target}/vitest-probe.json`] },
  ].map((entry, index) => {
    const logs = Object.fromEntries(["stdout", "stderr"].map((stream) => {
      const relative = `logs/${["inventory", "tsx", "vitest"][index]}.${stream}.log`;
      const metadata = infrastructureLog(join(probeOutput, relative));
      return [stream, { ...metadata, path: `${target}/${relative}` }];
    }));
    return { ...entry, cwd: "/tmp/test", exitCode: 0, signal: null, error: null, logs };
  });
  const probeVitest = jsonBytes(syntheticVitestReport(1, "probe"));
  infrastructureFiles[join(probeOutput, "vitest-probe.json")] = probeVitest;
  Object.assign(probeCommands[2]!, { tests: { path: `${target}/vitest-probe.json`, sha256: sha256(probeVitest), success: true, total: 1, passed: 1, failed: 0, pending: 0, todo: 0 } });
  const probeReport: Record<string, any> = { passed: true, freshTemporaryRoot: true, sourceOnlyInventoryFiles: 1, commands: probeCommands,
    closure: infrastructureMeasurement.closure.actual, installedSha256: assurance.installedSha256, frozenStoreSha256: assurance.frozenStoreSha256, toolsSha256: assurance.toolsSha256 };
  const containerId = "d".repeat(64);
  const probePolicy = { ...structuredClone(policy), Id: containerId, Image: dependencyImage,
    Config: { User: "10001:10001", Entrypoint: ["node"], Cmd: ["/hermetic/probe.mjs"], WorkingDir: "/app", Env: [`HERMETIC_OUTPUT_DIRECTORY=${target}`] },
    Mounts: [{ Type: "bind", Destination: target, Source: probeOutput, RW: true, Propagation: "rprivate" }, { Type: "tmpfs", Destination: "/tmp" }] };
  const probeExecution: Record<string, any> = { image: dependencyImage, output: probeOutput, imageInspection: { Id: dependencyImage },
    initialContainerInspection: probePolicy, finalContainerInspection: { ...probePolicy, State: { ExitCode: 0, OOMKilled: false } }, report: probeReport,
    executionLog: { executable: "docker", args: ["start", "--attach", containerId], exitCode: 0, signal: null, error: null,
      logs: { stdout: infrastructureLog(join(probeWork, "docker.stdout.log")), stderr: infrastructureLog(join(probeWork, "docker.stderr.log")) } } };
  const probePath = join(probeOutput, "probe.json");
  const tapPath = join(output, "infrastructure.stdout.log");
  const tap = ["TAP version 13", "# Docker probe evidence: " + probePath,
    ...[
      "Dockerfile pins the official platform and isolates offline installation from acquisition",
      "context keeps the original lock and workspace links without root dependencies or host stores",
      "current verification freezes eleven exact commands and the complete strict source invoice",
      "runtime capture preserves JSONC config closure, tests, fixtures, and rejects escaping paths or ancestor symlinks",
      "CLI rejects mount injection and public output parents and preserves bounded success/failure logs",
      "Docker enforces policy, fresh temporary inventory, and logged offline TS/Vitest",
    ].map((name, index) => `ok ${index + 1} - ${name}`),
    "1..6", "# tests 6", "# suites 0", "# pass 6", "# fail 0", "# cancelled 0", "# skipped 0", "# todo 0", ""].join("\n");
  infrastructureFiles[tapPath] = Buffer.from(tap);
  const infrastructure: Record<string, any> = { version: INFRASTRUCTURE_VERSION, passed: true, image: dependencyImage, imageInspection: { Id: dependencyImage }, measurements: infrastructureMeasurement,
    host: infrastructureHost(readFileSync), command: { executable: process.execPath, args: ["--test", infraPath], cwd: repositoryRoot.replace(/\/$/, ""), env: { HERMETIC_DEPENDENCY_IMAGE: dependencyImage },
      started: "2026-10-04T00:00:00.000Z", finished: "2026-10-04T00:00:01.000Z", exitCode: 0, signal: null, error: null,
      logs: { stdout: infrastructureLog(tapPath), stderr: infrastructureLog(join(output, "infrastructure.stderr.log")) } },
    tap: { tests: 6, suites: 0, pass: 6, fail: 0, cancelled: 0, skipped: 0, todo: 0 }, probe: { artifacts: [] } };
  const rebindInfrastructure = () => {
    infrastructureFiles[probePath] = jsonBytes(probeReport);
    infrastructureFiles[join(probeWork, "execution.json")] = jsonBytes(probeExecution);
    const metadata = (path: string) => ({ path, bytes: infrastructureFiles[path]!.length, sha256: sha256(infrastructureFiles[path]!) });
    infrastructure.probe.report = metadata(probePath);
    infrastructure.probe.execution = metadata(join(probeWork, "execution.json"));
    infrastructure.probe.artifacts = Object.entries(infrastructureFiles).filter(([path]) => path.startsWith(probeWork) && path !== probePath && path !== join(probeWork, "execution.json")).map(([path]) => ({
      ...(path.endsWith(".log") ? infrastructureLog(path) : metadata(path)), relative: path.startsWith(probeOutput + "/") ? path.slice(probeOutput.length + 1) : path.slice(probeWork.length + 1),
    }));
    for (const stream of ["stdout", "stderr"]) infrastructure.command.logs[stream] = infrastructureLog(infrastructure.command.logs[stream].path);
  };
  rebindInfrastructure();
  const destination = join(root, "published");
  const save = () => {
    verification.artifacts = Object.entries(files).map(([path, bytes]) => ({ path, type: "file", bytes: bytes.length, sha256: sha256(bytes) }));
    for (const [path, bytes] of Object.entries(files)) { mkdirSync(dirname(join(output, path)), { recursive: true }); writeFileSync(join(output, path), bytes); }
    writeFileSync(join(output, "verification.json"), jsonBytes(verification));
    writeFileSync(paths.execution, jsonBytes(execution)); writeFileSync(paths.build, jsonBytes(build)); writeFileSync(paths.export, jsonBytes(envelope));
    for (const [path, bytes] of Object.entries(infrastructureFiles)) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, bytes); }
    writeFileSync(paths.infrastructure, jsonBytes(infrastructure));
  };
  const mutate = (path: string, change: (document: Record<string, any>) => void) => {
    const document = decode<Record<string, any>>(files[path]!); change(document); files[path] = jsonBytes(document);
    const command = commands.find((entry) => entry.tests?.path?.endsWith(`/${path}`));
    if (command?.tests) command.tests.sha256 = sha256(files[path]!);
  };
  const rebind = () => {
    mutate("pin-migration.json", (document) => { document.currentBaselineSha256 = sha256(files["baseline-report.json"]!); });
    mutate("contract-report.json", (document) => { document.baselineReportSha256 = sha256(files["baseline-report.json"]!); document.coverageSha256 = sha256(canonical(decode(files["coverage.json"]!))); document.r2CompositionSha256 = sha256(canonical(decode(files["r2-composition-report.json"]!))); });
  };
  save();
  return { root, output, files, verification, execution, build, paths, destination, archivePath, archive, save, mutate, rebind,
    infrastructure, infrastructureFiles, infrastructureMeasurement, probeReport, probeExecution, rebindInfrastructure,
    options: { repositoryRoot: root, executionPath: paths.execution, buildPath: paths.build, exportPath: paths.export,
      expectedImage: archive.image, destination, infrastructurePath: paths.infrastructure,
      measureInfrastructureImage: async () => structuredClone(infrastructureMeasurement),
      inspectImage: async () => ({ Id: archive.image }), measureImage: async () => ({ source: { sourceSha256: "source" }, dependencies: { installedSha256: "installed", frozenStoreSha256: "store", toolTreeSha256: "tools" } }),
      captureContext: async () => ({ runtime: { sha256: "source" }, control: { sha256: controlSha256 }, sourceRoot: repositoryRoot }),
    },
  };
}
