import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonical } from "../../challenge/config";
import { REPOSITORY_ROOT, sha256 } from "../../challenge/corpus";
import { classifyScheduledEvidence, executionPins, normalizeEvidence, summarize, type runBaselineSuite } from "../../challenge/evidence";
import { createMigration, ORIGINAL_BASELINE_SHA256, ORIGINAL_VERIFICATION_SHA256 } from "../../challenge/pinMigration";
import { loadTrustedExecutionContext } from "../../challenge/schedule";
import { measureCoverage } from "../../challengeContract/coverage";

const require = createRequire(import.meta.url);
const { tmpfsOptions } = require("../../../hermetic/policy.mjs") as { tmpfsOptions: string };
export const { evidenceLimits } = require("../../../hermetic/evidence-limits.mjs") as {
  evidenceLimits: { fileBytes: number; retainedBytes: number; archiveBytes: number; scanBytes: number; metadataBytes: number; entries: number; pathBytes: number };
};
const runtimePins = require("../../../hermetic/pins.json") as { node: string };
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
  const refreshedDirectory = fileURLToPath(new URL("_spec/evidence/ml-adjutant-r0-refresh", REPOSITORY_ROOT));
  const directory = fresh ?? (existsSync(refreshedDirectory) ? refreshedDirectory : historicalDirectory);
  const historical = !fresh && directory === historicalDirectory && !existsSync(join(directory, ".publication-complete"));
  let files: Record<typeof names[number], Buffer>;
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
  } else {
    files = Object.fromEntries(names.map((name) => [name, readFileSync(join(directory, name))])) as Record<typeof names[number], Buffer>;
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
    ...before, version: "phase2-baseline-report-v1", kind: "phase2-current-baseline",
    independentVerification: "_spec/evidence/ml-adjutant-phase2/verification.json",
    migrationReference: "_spec/evidence/ml-adjutant-phase2/pin-migration.json", pins, rows,
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
  return {
    "baseline-report.json": currentBytes,
    "coverage.json": jsonBytes(coverage),
    "pin-migration.json": jsonBytes({ ...migration,
      fromPinFormat: "phase1-legacy-digests", toPinFormat: pins.version,
      inventorySha256: pins.sourceInventory.inventorySha256, importAuditSha256: sha256(canonical(pins.sourceInventory.audit)),
      newlyCoveredPaths: pins.sourceInventory.files.filter((entry) => !entry.path.startsWith("packages/starchess-core/src/") &&
        !["challenge", "cli", "players", "run"].some((directory) => entry.path.startsWith(`packages/starchess-arena/src/${directory}/`))).map((entry) => entry.path),
    }),
    "contract-report.json": jsonBytes({ version: "phase2-contract-report-v1", pins,
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

type Log = { path: string; sha256: string; bytes: number };
export type Command = { executable: string; args: string[]; cwd: string; exitCode: number; signal: null; error: null;
  logs: { stdout: Log; stderr: Log }; tests?: { path?: string; success: boolean; failed: number; passed: number; total: number; sha256: string } };
export type Verification = { version: string; passed: boolean; assurance: Record<string, string>; commands: Command[];
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
  const target = "/app/_spec/evidence/ml-adjutant-phase2";
  const current = decode<Baseline>(diagnostics["baseline-report.json"]);
  current.pins = { ...executionPins(), nodeVersion: `v${runtimePins.node}` };
  const currentBytes = jsonBytes(current);
  const migration = decode<Record<string, unknown>>(diagnostics["pin-migration.json"]);
  const contract = decode<Record<string, unknown>>(diagnostics["contract-report.json"]);
  const inventory = current.pins.sourceInventory;
  Object.assign(migration, { currentBaselineSha256: sha256(currentBytes), inventorySha256: inventory.inventorySha256,
    importAuditSha256: sha256(canonical(inventory.audit)), newlyCoveredPaths: inventory.files.filter((entry) =>
      !entry.path.startsWith("packages/starchess-core/src/") &&
      !["challenge", "cli", "players", "run"].some((directory) => entry.path.startsWith(`packages/starchess-arena/src/${directory}/`))).map((entry) => entry.path) });
  Object.assign(contract, { pins: current.pins, baselineReportSha256: sha256(currentBytes) });
  const files: Record<string, Buffer> = { ...diagnostics,
    "baseline-report.json": currentBytes, "pin-migration.json": jsonBytes(migration), "contract-report.json": jsonBytes(contract),
    "vitest-starchess-core.json": jsonBytes(syntheticVitestReport(426, "starchess-core")),
    "vitest-starchess-arena.json": jsonBytes(syntheticVitestReport(434, "starchess-arena")),
  };
  const specs: [string, string[], string][] = [
    ["/app/packages/starchess-arena/node_modules/.bin/tsx", ["/app/packages/starchess-arena/src/cli/challenge.ts", "--suite", "all", "--rerun", "--out", `${target}/baseline-report.json`], "/app"],
    ["/app/packages/starchess-arena/node_modules/.bin/tsx", ["/app/scripts/challenge-contract-evidence.ts"], "/app"],
    ...["starchess-core", "starchess-arena"].map((pkg): [string, string[], string] => [`/app/packages/${pkg}/node_modules/.bin/tsc`, ["-p", "tsconfig.json", "--noEmit"], `/app/packages/${pkg}`]),
    ["/app/packages/starchess-arena/node_modules/.bin/tsc", ["--noEmit", "--target", "ES2022", "--module", "ESNext", "--moduleResolution", "Bundler", "--strict", "--skipLibCheck",
      ...readdirSync(join(repositoryRoot, "packages/starchess-arena/src/__tests__")).filter((name) => /^challenge.*\.test\.ts$/.test(name) || ["observationIsolation.test.ts", "resourceLedger.test.ts", "strictRecordedQueues.test.ts"].includes(name)).sort().map((name) => `/app/packages/starchess-arena/src/__tests__/${name}`),
      "/app/scripts/challenge-contract-evidence.ts", "/app/scripts/challenge-validate-baseline.ts"], "/app/packages/starchess-arena"],
    ...["starchess-core", "starchess-arena"].map((pkg): [string, string[], string] => [`/app/packages/${pkg}/node_modules/.bin/vitest`, ["run", "--config", `/tmp/${pkg}.vitest.mts`, "--configLoader", "native", "--maxWorkers", "2", "--reporter=default", "--reporter=json", "--outputFile", `${target}/vitest-${pkg}.json`], `/app/packages/${pkg}`]),
    ["/usr/local/bin/node", ["--test", "/app/packages/starchess-arena/hermetic/evidence-bundle.test.mjs", "/app/packages/starchess-arena/hermetic/image-measurement.test.mjs", "/app/packages/starchess-arena/hermetic/tar.test.mjs"], "/app"],
  ];
  const commands = specs.map(([executable, args, cwd], index): Command => {
    const prefix = `logs/command-${String(index + 1).padStart(2, "0")}`;
    files[`${prefix}.stdout.log`] = Buffer.from("synthetic test-only command output\n");
    files[`${prefix}.stderr.log`] = Buffer.alloc(0);
    const log = (stream: string): Log => ({ path: `${target}/${prefix}.${stream}.log`, sha256: sha256(files[`${prefix}.${stream}.log`]!), bytes: files[`${prefix}.${stream}.log`]!.length });
    const command: Command = { executable, args, cwd, exitCode: 0, signal: null, error: null, logs: { stdout: log("stdout"), stderr: log("stderr") } };
    if (executable.endsWith("/vitest")) {
      const name = args.at(-1)!.split("/").at(-1)!;
      const count = name.includes("core") ? 426 : 434;
      command.tests = { path: args.at(-1)!, success: true, failed: 0, passed: count, total: count, sha256: sha256(files[name]!) };
    }
    return command;
  });
  const assurance = { sourceSha256: "source", installedSha256: "installed", frozenStoreSha256: "store", toolsSha256: "tools" };
  const verification: Verification = { version: "hermetic-verification-v2", passed: true, assurance, commands, artifacts: [] };
  const policy = { Image: "", HostConfig: { NetworkMode: "none", ReadonlyRootfs: true, Privileged: false, Init: true,
    NanoCpus: 2_000_000_000, Memory: 4 * 1024 ** 3, MemorySwap: 4 * 1024 ** 3, PidsLimit: 256,
    CapDrop: ["ALL"], CapAdd: null, SecurityOpt: ["no-new-privileges=true"], Tmpfs: { "/tmp": tmpfsOptions } },
    Config: { User: "10001:10001" }, Mounts: [{ Type: "bind", Destination: target, Source: output, RW: true, Propagation: "rprivate" }, { Type: "tmpfs", Destination: "/tmp" }] };
  const hostLog = Buffer.from("synthetic host log\n");
  const hostLogPath = join(output, "host.log"); writeFileSync(hostLogPath, hostLog);
  const host = { logs: Object.fromEntries(["stdout", "stderr"].map((stream) => [stream, { path: hostLogPath, sha256: sha256(hostLog), bytes: hostLog.length }])) };
  const archive = syntheticImageArchive();
  const archivePath = join(output, "image.tar"); writeFileSync(archivePath, archive.bytes);
  policy.Image = archive.image;
  const envelope = { image: archive.image, imageInspection: { Id: archive.image },
    measurements: { source: { sourceSha256: "source" }, dependencies: { installedSha256: "installed", frozenStoreSha256: "store", toolTreeSha256: "tools" } },
    buildLog: host, executionLog: host, archive: archivePath, archiveSha256: sha256(archive.bytes), archiveBytes: archive.bytes.length };
  const execution = { ...envelope, passed: true, status: "passed", output, initialContainerInspection: policy,
    finalContainerInspection: { ...policy, State: { ExitCode: 0, OOMKilled: false } } };
  const build = { ...envelope, capture: { runtime: { sha256: "source" }, control: { sha256: "control" } } };
  const paths = { execution: join(output, "execution.json"), build: join(output, "build.json"), export: join(output, "export.json") };
  const destination = join(root, "published");
  const save = () => {
    verification.artifacts = Object.entries(files).map(([path, bytes]) => ({ path, type: "file", bytes: bytes.length, sha256: sha256(bytes) }));
    for (const [path, bytes] of Object.entries(files)) { mkdirSync(dirname(join(output, path)), { recursive: true }); writeFileSync(join(output, path), bytes); }
    writeFileSync(join(output, "verification.json"), jsonBytes(verification));
    writeFileSync(paths.execution, jsonBytes(execution)); writeFileSync(paths.build, jsonBytes(build)); writeFileSync(paths.export, jsonBytes(envelope));
  };
  const mutate = (path: string, change: (document: Record<string, any>) => void) => {
    const document = decode<Record<string, any>>(files[path]!); change(document); files[path] = jsonBytes(document);
    const command = commands.find((entry) => entry.tests?.path?.endsWith(`/${path}`));
    if (command?.tests) command.tests.sha256 = sha256(files[path]!);
  };
  const rebind = () => {
    mutate("pin-migration.json", (document) => { document.currentBaselineSha256 = sha256(files["baseline-report.json"]!); });
    mutate("contract-report.json", (document) => { document.baselineReportSha256 = sha256(files["baseline-report.json"]!); document.coverageSha256 = sha256(canonical(decode(files["coverage.json"]!))); });
  };
  save();
  return { root, output, files, verification, execution, build, paths, destination, archivePath, archive, save, mutate, rebind,
    options: { repositoryRoot: root, executionPath: paths.execution, buildPath: paths.build, exportPath: paths.export,
      expectedImage: archive.image, destination,
      inspectImage: async () => ({ Id: archive.image }), measureImage: async () => ({ source: { sourceSha256: "source" }, dependencies: { installedSha256: "installed", frozenStoreSha256: "store", toolTreeSha256: "tools" } }),
      captureContext: async () => ({ runtime: { sha256: "source" }, control: { sha256: "control" }, sourceRoot: repositoryRoot }),
    },
  };
}
