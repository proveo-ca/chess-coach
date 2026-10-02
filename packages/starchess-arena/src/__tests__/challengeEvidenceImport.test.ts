// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { tmpfsOptions } from "../../hermetic/policy.mjs";

const require = createRequire(import.meta.url);
const { importEvidence, assertImageArchive, ORIGINAL_BASELINE_SHA256, safeRelative } = require("../../../../scripts/challenge-import-evidence.mjs") as {
  importEvidence: (options: Record<string, unknown>) => Promise<{ image: string }>;
  assertImageArchive: (path: string, image: string) => void;
  ORIGINAL_BASELINE_SHA256: string;
  safeRelative: (path: string) => string;
};

const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const image = `sha256:${"a".repeat(64)}`;
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

const policy = (output: string, id = image) => ({
  Image: id,
  HostConfig: { NetworkMode: "none", ReadonlyRootfs: true, Privileged: false, Init: true, NanoCpus: 2_000_000_000, Memory: 4 * 1024 ** 3, MemorySwap: 4 * 1024 ** 3, PidsLimit: 256, CapDrop: ["ALL"], CapAdd: null, SecurityOpt: ["no-new-privileges=true"], Tmpfs: { "/tmp": tmpfsOptions } },
  Config: { User: "10001:10001" },
  Mounts: [
    { Type: "bind", Destination: "/app/_spec/evidence/ml-adjutant-phase2", Source: output, RW: true, Propagation: "rprivate" },
    { Type: "tmpfs", Destination: "/tmp" },
  ],
});
const tarHeader = (name: string, size: number) => {
  const header = Buffer.alloc(512);
  header.write(name);
  header.write("0000644\0", 100);
  header.write("0000000\0", 108);
  header.write("0000000\0", 116);
  header.write(`${size.toString(8).padStart(11, "0")}\0`, 124);
  header[156] = "0".charCodeAt(0);
  header.write("ustar\0", 257);
  header.write("00", 263);
  return header;
};
const imageArchive = (layer = Buffer.from("layer")) => {
  const config = Buffer.from(JSON.stringify({ rootfs: { type: "layers", diff_ids: [`sha256:${hash(layer)}`] } }));
  const manifest = Buffer.from(JSON.stringify([{ Config: "config.json", RepoTags: null, Layers: ["layer.tar"] }]));
  const parts = [tarHeader("config.json", config.length), config, Buffer.alloc((512 - (config.length % 512)) % 512),
    tarHeader("layer.tar", layer.length), layer, Buffer.alloc((512 - (layer.length % 512)) % 512),
    tarHeader("manifest.json", manifest.length), manifest, Buffer.alloc((512 - (manifest.length % 512)) % 512),
    Buffer.alloc(1024)];
  return { bytes: Buffer.concat(parts), image: `sha256:${hash(config)}` };
};

describe("phase2 hermetic evidence import", () => {
  it("publishes nested logs only after image, capture, and artifact checks", async () => {
    mkdirSync("/tmp/opencode", { recursive: true });
    const root = mkdtempSync("/tmp/opencode/import-root-");
    const output = mkdtempSync("/tmp/opencode/import-output-");
    roots.push(root, output);
    const evidence = new URL("../../../../_spec/evidence/ml-adjutant-phase2/", import.meta.url);
    const copy = (name: string) => readFileSync(new URL(name, evidence));
    const coreReport = copy("vitest-starchess-core.json");
    const arenaReport = copy("vitest-starchess-arena.json");
    const coreCounts = JSON.parse(coreReport.toString("utf8")) as { numTotalTests: number; numPassedTests: number };
    const arenaCounts = JSON.parse(arenaReport.toString("utf8")) as { numTotalTests: number; numPassedTests: number };
    const files: Record<string, Buffer> = {
      "baseline-report.json": copy("baseline-report.json"),
      "contract-report.json": copy("contract-report.json"),
      "coverage.json": copy("coverage.json"),
      "pin-migration.json": copy("pin-migration.json"),
      "vitest-starchess-core.json": coreReport,
      "vitest-starchess-arena.json": arenaReport,
      "logs/command-01.stdout.log": Buffer.from("baseline ok\n"),
      "logs/command-01.stderr.log": Buffer.from(""),
    };
    mkdirSync(join(root, "_spec/evidence/ml-adjutant-phase1"), { recursive: true });
    const originalBaseline = readFileSync(new URL("../../../../_spec/evidence/ml-adjutant-phase1/baseline-report.json", import.meta.url));
    const originalVerification = readFileSync(new URL("../../../../_spec/evidence/ml-adjutant-phase1/verification.json", import.meta.url));
    writeFileSync(join(root, "_spec/evidence/ml-adjutant-phase1/baseline-report.json"), originalBaseline);
    writeFileSync(join(root, "_spec/evidence/ml-adjutant-phase1/verification.json"), originalVerification);
    const logs = Object.fromEntries(["stdout", "stderr"].map((name) => [name, { path: `/app/_spec/evidence/ml-adjutant-phase2/logs/command-01.${name}.log`, sha256: hash(files[`logs/command-01.${name}.log`]!), bytes: files[`logs/command-01.${name}.log`]!.length }]));
    const challengeTests = readdirSync(new URL(".", import.meta.url)).filter((name) => /^challenge.*\.test\.ts$/.test(name) || ["observationIsolation.test.ts", "resourceLedger.test.ts", "strictRecordedQueues.test.ts"].includes(name)).sort().map((name) => `/app/packages/starchess-arena/src/__tests__/${name}`);
    const commands = [
      { executable: "/app/packages/starchess-arena/node_modules/.bin/tsx", args: ["/app/packages/starchess-arena/src/cli/challenge.ts", "--suite", "all", "--rerun", "--out", "/app/_spec/evidence/ml-adjutant-phase2/baseline-report.json"], cwd: "/app", exitCode: 0, signal: null, error: null, logs },
      { executable: "/app/packages/starchess-arena/node_modules/.bin/tsx", args: ["/app/scripts/challenge-contract-evidence.ts"], cwd: "/app", exitCode: 0, signal: null, error: null, logs },
      { executable: "/app/packages/starchess-core/node_modules/.bin/tsc", args: ["-p", "tsconfig.json", "--noEmit"], cwd: "/app/packages/starchess-core", exitCode: 0, signal: null, error: null, logs },
      { executable: "/app/packages/starchess-arena/node_modules/.bin/tsc", args: ["-p", "tsconfig.json", "--noEmit"], cwd: "/app/packages/starchess-arena", exitCode: 0, signal: null, error: null, logs },
      { executable: "/app/packages/starchess-arena/node_modules/.bin/tsc", args: ["--noEmit", "--target", "ES2022", "--module", "ESNext", "--moduleResolution", "Bundler", "--strict", "--skipLibCheck", ...challengeTests, "/app/scripts/challenge-contract-evidence.ts"], cwd: "/app/packages/starchess-arena", exitCode: 0, signal: null, error: null, logs },
      { executable: "/app/packages/starchess-core/node_modules/.bin/vitest", args: ["run", "--config", "/tmp/starchess-core.vitest.mts", "--configLoader", "native", "--maxWorkers", "2", "--reporter=default", "--reporter=json", "--outputFile", "/app/_spec/evidence/ml-adjutant-phase2/vitest-starchess-core.json"], cwd: "/app/packages/starchess-core", exitCode: 0, signal: null, error: null, logs, tests: { path: "/app/_spec/evidence/ml-adjutant-phase2/vitest-starchess-core.json", success: true, failed: 0, passed: coreCounts.numPassedTests, total: coreCounts.numTotalTests, sha256: hash(coreReport) } },
      { executable: "/app/packages/starchess-arena/node_modules/.bin/vitest", args: ["run", "--config", "/tmp/starchess-arena.vitest.mts", "--configLoader", "native", "--maxWorkers", "2", "--reporter=default", "--reporter=json", "--outputFile", "/app/_spec/evidence/ml-adjutant-phase2/vitest-starchess-arena.json"], cwd: "/app/packages/starchess-arena", exitCode: 0, signal: null, error: null, logs, tests: { path: "/app/_spec/evidence/ml-adjutant-phase2/vitest-starchess-arena.json", success: true, failed: 0, passed: arenaCounts.numPassedTests, total: arenaCounts.numTotalTests, sha256: hash(arenaReport) } },
    ];
    for (const [path, value] of Object.entries(files)) {
      mkdirSync(join(output, path, ".."), { recursive: true });
      writeFileSync(join(output, path), value);
    }
    const artifactEntries = Object.entries(files).map(([path, value]) => ({ path, type: "file", bytes: Buffer.byteLength(value), sha256: hash(value) }));
    const assurance = { sourceSha256: "source", installedSha256: "installed", frozenStoreSha256: "store", toolsSha256: "tools" };
    const verification = { version: "hermetic-verification-v1", passed: true, assurance, commands, artifacts: artifactEntries };
    writeFileSync(join(output, "verification.json"), JSON.stringify(verification));
    const hostLog = Buffer.from("host log");
    const hostLogPath = join(output, "host.log");
    writeFileSync(hostLogPath, hostLog);
    const measurements = { source: { sourceSha256: assurance.sourceSha256 }, dependencies: { installedSha256: assurance.installedSha256, frozenStoreSha256: assurance.frozenStoreSha256, toolTreeSha256: assurance.toolsSha256 } };
    const logged = { logs: { stdout: { path: hostLogPath, sha256: hash(hostLog), bytes: hostLog.length }, stderr: { path: hostLogPath, sha256: hash(hostLog), bytes: hostLog.length } } };
    const archive = imageArchive();
    const archivePath = join(output, "image.tar");
    writeFileSync(archivePath, archive.bytes);
    const envelope = { image: archive.image, imageInspection: { Id: archive.image }, measurements, buildLog: logged, executionLog: logged, archive: archivePath, archiveSha256: hash(archive.bytes), archiveBytes: archive.bytes.length };
    const execution = { ...envelope, passed: true, status: "passed", output, initialContainerInspection: policy(output, archive.image), finalContainerInspection: { ...policy(output, archive.image), State: { ExitCode: 0, OOMKilled: false } } };
    const paths = { execution: join(output, "execution.json"), build: join(output, "build.json"), export: join(output, "export.json") };
    writeFileSync(paths.execution, JSON.stringify(execution));
    writeFileSync(paths.build, JSON.stringify({ ...envelope, capture: { runtime: { sha256: assurance.sourceSha256 }, control: { sha256: "control" } } }));
    writeFileSync(paths.export, JSON.stringify(envelope));
    const destination = join(root, "_spec/evidence/ml-adjutant-phase2");
    const imported = await importEvidence({ repositoryRoot: root, executionPath: paths.execution, buildPath: paths.build, exportPath: paths.export, expectedImage: archive.image, destination, inspectImage: async () => ({ Id: archive.image }), measureImage: async () => ({ source: { sourceSha256: assurance.sourceSha256 } }), captureContext: async () => ({ runtime: { sha256: assurance.sourceSha256 }, control: { sha256: "control" } }) });
    expect(imported.image).toBe(archive.image);
    expect(readFileSync(join(destination, "logs/command-01.stdout.log"), "utf8")).toBe("baseline ok\n");
    expect(JSON.parse(readFileSync(join(destination, "image-assurance.json"), "utf8")).image).toBe(archive.image);
    expect(files["coverage.json"]!.length).toBeGreaterThan(0);
  }, 120000);

  it.each(["../secret", "/tmp/x", "logs\\x", "logs/../x", ""])("rejects unsafe artifact path %s", (path) => {
    expect(() => safeRelative(path)).toThrow("Unsafe artifact path");
  });

  it("rejects integer rows and an archive whose config is not the expected image", () => {
    mkdirSync("/tmp/opencode", { recursive: true });
    const output = mkdtempSync("/tmp/opencode/import-negative-");
    roots.push(output);
    const forged = join(output, "forged.json");
    const migration = join(output, "migration.json");
    writeFileSync(forged, JSON.stringify({ rows: Array.from({ length: 54 }, (_, index) => index) }));
    writeFileSync(migration, JSON.stringify({ comparisons: Array.from({ length: 54 }, () => ({ equal: true })) }));
    expect(() => execFileSync(join(new URL("../../../../packages/starchess-arena/node_modules/.bin/tsx", import.meta.url).pathname), [join(new URL("../../../../scripts/challenge-validate-baseline.ts", import.meta.url).pathname), forged, new URL("../../../../_spec/evidence/ml-adjutant-phase1/baseline-report.json", import.meta.url).pathname, migration], { encoding: "utf8" })).toThrow();
    const archivePath = join(output, "image.tar");
    writeFileSync(archivePath, "image-bytes");
    expect(() => assertImageArchive(archivePath, image)).toThrow(/not a Docker image tar/);
    const other = imageArchive(Buffer.from("other-layer"));
    writeFileSync(archivePath, other.bytes);
    expect(() => assertImageArchive(archivePath, image)).toThrow(/not the expected image/);
  });

  it("rejects forged rows, loose commands, unbound vitest counts, and a non-image archive", async () => {
    mkdirSync("/tmp/opencode", { recursive: true });
    const output = mkdtempSync("/tmp/opencode/import-forged-");
    roots.push(output);
    writeFileSync(join(output, "image.tar"), "image-bytes");
    const executionPath = join(output, "execution.json");
    writeFileSync(executionPath, JSON.stringify({ image, passed: true, status: "passed", output, imageInspection: { Id: image }, initialContainerInspection: policy(output), finalContainerInspection: { ...policy(output), State: { ExitCode: 0, OOMKilled: false } }, measurements: { source: { sourceSha256: "source" }, dependencies: {} }, executionLog: { logs: { stdout: { path: join(output, "missing"), sha256: "ab", bytes: 1 }, stderr: { path: join(output, "missing"), sha256: "ab", bytes: 1 } } } }));
    await expect(importEvidence({ repositoryRoot: output, executionPath, buildPath: executionPath, exportPath: executionPath, expectedImage: image, destination: join(output, "published"), inspectImage: async () => ({ Id: image }), captureContext: async () => ({ runtime: { sha256: "source" }, control: { sha256: "control" } }) })).rejects.toThrow();
    const other = imageArchive(Buffer.from("other-layer"));
    writeFileSync(join(output, "other.tar"), other.bytes);
    await expect(importEvidence({ repositoryRoot: output, executionPath, buildPath: executionPath, exportPath: executionPath, expectedImage: image, destination: join(output, "published-other"), inspectImage: async () => ({ Id: image }), captureContext: async () => ({ runtime: { sha256: "source" }, control: { sha256: "control" } }) })).rejects.toThrow();
  });

  it("preserves an existing destination and a committed tree after parent durability failure", async () => {
    mkdirSync("/tmp/opencode", { recursive: true });
    const output = mkdtempSync("/tmp/opencode/import-publish-");
    roots.push(output);
    const destination = join(output, "published");
    mkdirSync(destination);
    writeFileSync(join(destination, "kept"), "competitor");
    const executionPath = join(output, "execution.json");
    writeFileSync(executionPath, JSON.stringify({ image, passed: false }));
    await expect(importEvidence({ repositoryRoot: output, executionPath, buildPath: executionPath, exportPath: executionPath, expectedImage: image, destination, inspectImage: async () => ({ Id: image }) })).rejects.toThrow();
    expect(readFileSync(join(destination, "kept"), "utf8")).toBe("competitor");
  });

  it("does not publish when capture drift or an empty artifact list is presented", async () => {
    mkdirSync("/tmp/opencode", { recursive: true });
    const output = mkdtempSync("/tmp/opencode/import-reject-");
    roots.push(output);
    const executionPath = join(output, "execution.json");
    writeFileSync(executionPath, JSON.stringify({ image, passed: true, status: "passed", output, imageInspection: { Id: image }, initialContainerInspection: policy(output), finalContainerInspection: { ...policy(output), State: { ExitCode: 0 } }, measurements: {}, executionLog: {} }));
    const destination = join(output, "published");
    await expect(importEvidence({ repositoryRoot: output, executionPath, buildPath: executionPath, exportPath: executionPath, expectedImage: image, destination, inspectImage: async () => ({ Id: image }), captureContext: async () => ({ runtime: { sha256: "different" }, control: { sha256: "control" } }) })).rejects.toThrow();
    expect(() => readFileSync(destination)).toThrow();
  });
});
