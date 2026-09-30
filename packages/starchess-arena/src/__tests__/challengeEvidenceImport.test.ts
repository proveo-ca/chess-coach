// SPEC: _spec/packages/starchess-arena/ml-adjutant-phase2.puml
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { importEvidence, ORIGINAL_BASELINE_SHA256, safeRelative } = require("../../../../scripts/challenge-import-evidence.mjs") as {
  importEvidence: (options: Record<string, unknown>) => Promise<{ image: string }>;
  ORIGINAL_BASELINE_SHA256: string;
  safeRelative: (path: string) => string;
};

const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const image = `sha256:${"a".repeat(64)}`;
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

const policy = (output: string) => ({
  Image: image,
  HostConfig: { NetworkMode: "none", ReadonlyRootfs: true, Privileged: false, Init: true, NanoCpus: 2_000_000_000, Memory: 4 * 1024 ** 3, MemorySwap: 4 * 1024 ** 3, PidsLimit: 256, CapDrop: ["ALL"], CapAdd: null, SecurityOpt: ["no-new-privileges=true"], Tmpfs: { "/tmp": "rw,nosuid,nodev" } },
  Config: { User: "10001:10001" },
  Mounts: [{ Type: "bind", Destination: "/app/_spec/evidence/ml-adjutant-phase2", Source: output, RW: true }],
});

describe("phase2 hermetic evidence import", () => {
  it("publishes nested logs only after image, capture, and artifact checks", async () => {
    mkdirSync("/tmp/opencode", { recursive: true });
    const root = mkdtempSync("/tmp/opencode/import-root-");
    const output = mkdtempSync("/tmp/opencode/import-output-");
    roots.push(root, output);
    const files: Record<string, string> = {
      "baseline-report.json": JSON.stringify({ version: "phase2-baseline-report-v1", kind: "phase2-current-baseline", pins: { version: "challenge-execution-pins-v2", marker: 1 }, rows: Array.from({ length: 54 }, (_, index) => index), deterministicRerun: { comparisons: Array.from({ length: 54 }, () => ({ equal: true })) }, executionIntegrity: true, learnedGateEligible: false }),
      "contract-report.json": "",
      "coverage.json": JSON.stringify({ windows: 282 }),
      "pin-migration.json": "",
      "vitest-starchess-core.json": JSON.stringify({ success: true, numTotalTests: 2, numPassedTests: 2, numFailedTests: 0 }),
      "vitest-starchess-arena.json": JSON.stringify({ success: true, numTotalTests: 3, numPassedTests: 3, numFailedTests: 0 }),
      "logs/command-01.stdout.log": "baseline ok\n",
      "logs/command-01.stderr.log": "",
    };
    const coverageBytes = Buffer.from(files["coverage.json"]!);
    const baselineBytes = Buffer.from(files["baseline-report.json"]!);
    files["contract-report.json"] = JSON.stringify({ pins: { version: "challenge-execution-pins-v2", marker: 1 }, coverageSha256: hash(JSON.stringify({ windows: 282 })), baselineReportSha256: hash(baselineBytes), learnedGateEligible: false });
    files["pin-migration.json"] = JSON.stringify({ passed: true, comparisons: Array.from({ length: 54 }, () => ({ equal: true })), originalBaselineSha256: ORIGINAL_BASELINE_SHA256, originalVerificationSha256: "55d965afa71d775ff6ee1e95b6650a27d0ce759b966a81c43a3bb364236c7508", currentBaselineSha256: hash(baselineBytes) });
    mkdirSync(join(root, "_spec/evidence/ml-adjutant-phase1"), { recursive: true });
    writeFileSync(join(root, "_spec/evidence/ml-adjutant-phase1/baseline-report.json"), "original-baseline");
    writeFileSync(join(root, "_spec/evidence/ml-adjutant-phase1/verification.json"), "original-verification");
    const originalBaseline = readFileSync(new URL("../../../../_spec/evidence/ml-adjutant-phase1/baseline-report.json", import.meta.url));
    const originalVerification = readFileSync(new URL("../../../../_spec/evidence/ml-adjutant-phase1/verification.json", import.meta.url));
    writeFileSync(join(root, "_spec/evidence/ml-adjutant-phase1/baseline-report.json"), originalBaseline);
    writeFileSync(join(root, "_spec/evidence/ml-adjutant-phase1/verification.json"), originalVerification);
    const logs = Object.fromEntries(["stdout", "stderr"].map((name) => [name, { path: `/app/_spec/evidence/ml-adjutant-phase2/logs/command-01.${name}.log`, sha256: hash(files[`logs/command-01.${name}.log`]!), bytes: Buffer.byteLength(files[`logs/command-01.${name}.log`]!) }]));
    const commands = [
      { executable: "tsx", args: ["challenge.ts", "--suite", "all", "--rerun"], cwd: "/app", exitCode: 0, signal: null, error: null, logs },
      { executable: "tsx", args: ["/app/scripts/challenge-contract-evidence.ts"], cwd: "/app", exitCode: 0, signal: null, error: null, logs },
      { executable: "tsc", args: ["-p", "tsconfig.json", "--noEmit"], cwd: "/app/packages/starchess-core", exitCode: 0, signal: null, error: null, logs },
      { executable: "tsc", args: ["-p", "tsconfig.json", "--noEmit"], cwd: "/app/packages/starchess-arena", exitCode: 0, signal: null, error: null, logs },
      { executable: "tsc", args: ["--noEmit", "--strict", "--skipLibCheck"], cwd: "/app/packages/starchess-arena", exitCode: 0, signal: null, error: null, logs },
      { executable: "vitest", args: ["run"], cwd: "/app/packages/starchess-core", exitCode: 0, signal: null, error: null, logs, tests: { path: "/out/vitest-starchess-core.json", success: true, failed: 0, passed: 2, total: 2 } },
      { executable: "vitest", args: ["run"], cwd: "/app/packages/starchess-arena", exitCode: 0, signal: null, error: null, logs, tests: { path: "/out/vitest-starchess-arena.json", success: true, failed: 0, passed: 3, total: 3 } },
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
    const archivePath = join(output, "image.tar");
    writeFileSync(archivePath, "image-bytes");
    const envelope = { image, imageInspection: { Id: image }, measurements, buildLog: logged, executionLog: logged, archive: archivePath, archiveSha256: hash("image-bytes"), archiveBytes: Buffer.byteLength("image-bytes") };
    const execution = { ...envelope, passed: true, status: "passed", output, initialContainerInspection: policy(output), finalContainerInspection: { ...policy(output), State: { ExitCode: 0, OOMKilled: false } } };
    const paths = { execution: join(output, "execution.json"), build: join(output, "build.json"), export: join(output, "export.json") };
    writeFileSync(paths.execution, JSON.stringify(execution));
    writeFileSync(paths.build, JSON.stringify({ ...envelope, capture: { runtime: { sha256: "runtime" }, control: { sha256: "control" } } }));
    writeFileSync(paths.export, JSON.stringify(envelope));
    const destination = join(root, "_spec/evidence/ml-adjutant-phase2");
    const imported = await importEvidence({ repositoryRoot: root, executionPath: paths.execution, buildPath: paths.build, exportPath: paths.export, expectedImage: image, destination, inspectImage: async () => ({ Id: image }), captureContext: async () => ({ runtime: { sha256: "runtime" }, control: { sha256: "control" } }) });
    expect(imported.image).toBe(image);
    expect(readFileSync(join(destination, "logs/command-01.stdout.log"), "utf8")).toBe("baseline ok\n");
    expect(JSON.parse(readFileSync(join(destination, "image-assurance.json"), "utf8")).image).toBe(image);
    expect(coverageBytes.length).toBeGreaterThan(0);
  });

  it.each(["../secret", "/tmp/x", "logs\\x", "logs/../x", ""])("rejects unsafe artifact path %s", (path) => {
    expect(() => safeRelative(path)).toThrow("Unsafe artifact path");
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
