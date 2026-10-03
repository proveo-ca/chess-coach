// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, truncateSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { canonical } from "../challenge/config";
import { sha256 } from "../challenge/corpus";
import { buildDiagnosticFixture, buildImportFixture, decode, evidenceLimits, jsonBytes, repositoryRoot,
  syntheticImageArchive, tarArchive, type Baseline } from "./fixtures/challengeEvidence";

const require = createRequire(import.meta.url);
const { importEvidence, assertImageArchive, safeRelative } = require("../../../../scripts/challenge-import-evidence.mjs") as {
  importEvidence: (options: Record<string, unknown>) => Promise<{ image: string }>;
  assertImageArchive: (path: string, image: string) => { sha256: string; bytes: number };
  safeRelative: (path: string) => string;
};
const roots: string[] = [];
let diagnostics: ReturnType<typeof buildDiagnosticFixture>;
beforeAll(() => { diagnostics = buildDiagnosticFixture(); }, 120000);
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const fixture = () => buildImportFixture(diagnostics, roots);
type Fixture = ReturnType<typeof fixture>;
const reject = async (value: Fixture, message: string | RegExp) => {
  value.rebind(); value.save();
  await expect(importEvidence(value.options)).rejects.toThrow(message);
  expect(existsSync(value.destination)).toBe(false);
};
const validate = (value: Fixture, extra: string[] = []) => {
  value.rebind(); value.save();
  const result = spawnSync(join(repositoryRoot, "packages/starchess-arena/node_modules/.bin/tsx"), [
    join(repositoryRoot, "scripts/challenge-validate-baseline.ts"),
    join(value.output, "baseline-report.json"), join(value.root, "_spec/evidence/ml-adjutant-phase1/baseline-report.json"),
    join(value.root, "_spec/evidence/ml-adjutant-phase1/verification.json"), join(value.output, "pin-migration.json"),
    join(value.output, "coverage.json"), join(value.output, "contract-report.json"), repositoryRoot, ...extra,
  ], { encoding: "utf8", timeout: 120000 });
  return { status: result.status, output: `${result.stdout ?? ""}${result.stderr ?? ""}`, error: result.error };
};

describe("phase2 hermetic evidence import with synthetic test-only image hooks", () => {
  it("validates independently built evidence and publishes nested command logs", async () => {
    const value = fixture();
    const current = decode<Baseline>(value.files["baseline-report.json"]!);
    expect(current.rows).toHaveLength(54);
    expect(current.accounting.acceptanceValid).toBe(true);
    const imported = await importEvidence(value.options);
    expect(imported.image).toBe(value.archive.image);
    expect(readFileSync(join(value.destination, "logs/command-01.stdout.log"), "utf8")).toBe("synthetic test-only command output\n");
    expect(JSON.parse(readFileSync(join(value.destination, "image-assurance.json"), "utf8")).image).toBe(value.archive.image);
    expect(readFileSync(join(value.destination, ".publication-complete"), "utf8")).toBe("ok\n");
  }, 120000);

  it.each(["../secret", "/tmp/x", "logs\\x", "logs/../x", ""])("rejects unsafe artifact path %s", (path) => {
    expect(() => safeRelative(path)).toThrow("Unsafe artifact path");
  });

  it("rejects an omitted Vitest report path", async () => {
    const value = fixture(); delete value.verification.commands[5]!.tests!.path;
    await reject(value, "Vitest report is not the command output");
  });
  it("rejects a swapped Vitest report path", async () => {
    const value = fixture(); value.verification.commands[5]!.tests!.path = value.verification.commands[6]!.tests!.path;
    await reject(value, "Vitest report is not the command output");
  });
  it("rejects a failed assertion concealed by passing report summaries", async () => {
    const value = fixture();
    value.mutate("vitest-starchess-core.json", (report) => { report.testResults[0].assertionResults[0].status = "failed"; });
    await reject(value, "Vitest report counts do not match: vitest-starchess-core.json");
  });
  it("rejects report summary counts that disagree with real assertions", async () => {
    const value = fixture(); value.mutate("vitest-starchess-core.json", (report) => { report.numPassedTests++; });
    await reject(value, "Vitest report counts do not match: vitest-starchess-core.json");
  });
  it.each([[5, "core", 425], [6, "arena", 433]] as const)("rejects below-floor passing assertions in command %i", async (index, pkg, count) => {
    const value = fixture();
    value.mutate(`vitest-starchess-${pkg}.json`, (report) => {
      report.testResults[0].assertionResults.length = count; report.numTotalTests = count; report.numPassedTests = count;
    });
    Object.assign(value.verification.commands[index]!.tests!, { passed: count, total: count });
    await reject(value, `Vitest report counts do not match: vitest-starchess-${pkg}.json`);
  });
  it.each([false, 0, "true", 1, null])("rejects non-true execution passed flag %j", async (flag) => {
    const value = fixture(); Object.assign(value.execution, { passed: flag });
    await reject(value, "Execution did not pass");
  });
  it("rejects a loose strict-check command that omits the validator", async () => {
    const value = fixture(); value.verification.commands[4]!.args.pop();
    await reject(value, "Required verification command missing");
  });
  it("rejects source capture drift after successful authoritative validation", async () => {
    const value = fixture();
    value.options.captureContext = async () => ({ runtime: { sha256: "drift" }, control: { sha256: "control" }, sourceRoot: repositoryRoot });
    await reject(value, "Captured source is not the inspected image source");
  }, 120000);
  it("rejects empty inventory at the artifact inventory gate", async () => {
    const value = fixture(); value.save(); value.verification.artifacts = [];
    writeFileSync(join(value.output, "verification.json"), jsonBytes(value.verification));
    await expect(importEvidence(value.options)).rejects.toThrow("Incomplete artifact inventory");
    expect(existsSync(value.destination)).toBe(false);
  });
  it("preserves a competing publication after all evidence checks pass", async () => {
    const value = fixture(); mkdirSync(value.destination); writeFileSync(join(value.destination, "kept"), "competitor");
    await expect(importEvidence(value.options)).rejects.toThrow(/destination already exists|EEXIST/);
    expect(readFileSync(join(value.destination, "kept"), "utf8")).toBe("competitor");
  }, 120000);
  it("rejects a sparse oversized input before decoding it", async () => {
    const value = fixture(); truncateSync(value.paths.execution, evidenceLimits.fileBytes + 1);
    await expect(importEvidence(value.options)).rejects.toThrow(/Input exceeds byte cap/);
    expect(existsSync(value.destination)).toBe(false);
  });
});

describe("authoritative seven-input baseline validator", () => {
  it("accepts the complete independent fixture without loading current output reports", () => {
    const result = validate(fixture());
    expect(result.error).toBeUndefined(); expect(result.status, result.output).toBe(0); expect(result.output.trim()).toBe("ok");
  }, 120000);

  const cases: [string, string, (document: Record<string, any>) => void, RegExp][] = [
    ["invented 54 integer rows", "baseline-report.json", (d) => { d.rows = Array.from({ length: 54 }, (_, index) => index); }, /evidence row|Scheduled evidence|baseline.*schema/i],
    ["unknown roster", "baseline-report.json", (d) => { d.rows[0].match.key = "invented-roster"; }, /schedule|Scheduled evidence/i],
    ["truthy learned flag", "baseline-report.json", (d) => { d.learnedGateEligible = "false"; }, /provenance|learned|baseline.*schema/i],
    ["falsy execution flag", "baseline-report.json", (d) => { d.executionIntegrity = 0; }, /provenance|integrity|Scheduled evidence|baseline.*schema/i],
    ["forged learned pass", "baseline-report.json", (d) => { d.learnedChallengePass = true; }, /learned|Scheduled evidence|provenance/i],
    ["forged summary bucket", "baseline-report.json", (d) => { d.summary.corpus.wins++; }, /summary|buckets/i],
    ["forged stop-kind summary", "baseline-report.json", (d) => { d.summary.corpus.stopKinds.invented = 1; }, /summary|buckets/i],
    ["forged rerun flag", "baseline-report.json", (d) => { d.deterministicRerun.performed = false; }, /rerun|parity|migration/i],
    ["forged rerun hash", "baseline-report.json", (d) => { d.deterministicRerun.comparisons[0].rerunSha256 = "0".repeat(64); }, /rerun|parity|migration/i],
    ["unequal migration", "pin-migration.json", (d) => { d.comparisons[0].equal = false; }, /comparison|migration/i],
    ["forged inventory", "baseline-report.json", (d) => { d.pins.sourceInventory.inventorySha256 = "0".repeat(64); }, /inventory|pins|provenance/i],
    ["coverage feature hash changed with identical counts", "coverage.json", (d) => { d.windows[0].featureSha256 = "0".repeat(64); }, /coverage/i],
  ];
  it.each(cases)("rejects %s with rebound raw checksums", (_name, path, mutate, message) => {
    const value = fixture(); value.mutate(path, mutate);
    const result = validate(value);
    expect(result.error).toBeUndefined(); expect(result.status).not.toBe(0); expect(result.output).toMatch(message);
  }, 120000);

  it("rejects an extra CLI input instead of silently ignoring it", () => {
    const result = validate(fixture(), ["unexpected"]);
    expect(result.status).not.toBe(0); expect(result.output).toMatch(/seven|7|Usage|required|arguments|paths/i);
  });
});

describe("synthetic test-only Docker-save archive parser", () => {
  const archivePath = () => fixture().archivePath;
  it("returns the digest and byte count for correctly checksummed tar and uncompressed layer diff IDs", () => {
    const archive = syntheticImageArchive(); const path = archivePath(); writeFileSync(path, archive.bytes);
    expect(assertImageArchive(path, archive.image)).toEqual({ sha256: sha256(archive.bytes), bytes: archive.bytes.length });
  });
  it("rejects a config hash for another image", () => {
    const archive = syntheticImageArchive(); const path = archivePath(); writeFileSync(path, archive.bytes);
    expect(() => assertImageArchive(path, `sha256:${"a".repeat(64)}`)).toThrow("not the expected image");
  });
  it("rejects ordered layers whose manifest swaps their diff IDs", () => {
    const archive = syntheticImageArchive({ manifestLayers: ["layer-1.tar", "layer-0.tar"] }); const path = archivePath(); writeFileSync(path, archive.bytes);
    expect(() => assertImageArchive(path, archive.image)).toThrow("layers are not the expected image");
  });
  it("rejects a doubled manifest layer", () => {
    const archive = syntheticImageArchive({ manifestLayers: ["layer-0.tar", "layer-0.tar"] }); const path = archivePath(); writeFileSync(path, archive.bytes);
    expect(() => assertImageArchive(path, archive.image)).toThrow("layers are not the expected image");
  });
  it("rejects duplicate tar entries even when the metadata bytes match", () => {
    const archive = syntheticImageArchive({ duplicate: true }); const path = archivePath(); writeFileSync(path, archive.bytes);
    expect(() => assertImageArchive(path, archive.image)).toThrow(/duplicate.*entry/i);
  });
  it("rejects a tar header with a damaged checksum", () => {
    const archive = syntheticImageArchive(); archive.bytes[100] = 49; const path = archivePath(); writeFileSync(path, archive.bytes);
    expect(() => assertImageArchive(path, archive.image)).toThrow(/checksum/i);
  });
  it("rejects malformed size bytes even after recomputing the header checksum", () => {
    const archive = syntheticImageArchive(); archive.bytes.write("0000000000x\0", 124);
    archive.bytes.fill(32, 148, 156);
    const checksum = archive.bytes.subarray(0, 512).reduce((total, byte) => total + byte, 0);
    archive.bytes.write(`${checksum.toString(8).padStart(6, "0")}\0 `, 148);
    const path = archivePath(); writeFileSync(path, archive.bytes);
    expect(() => assertImageArchive(path, archive.image)).toThrow(/Invalid.*(entry|size)|malformed.*size/i);
  });
  it("rejects a config whose diff IDs do not hash its uncompressed layers", () => {
    const layer = tarArchive([["file", Buffer.from("uncompressed layer")]]);
    const config = jsonBytes({ rootfs: { type: "layers", diff_ids: [`sha256:${"0".repeat(64)}`] } });
    const bytes = tarArchive([["config.json", config], ["layer.tar", layer], ["manifest.json", jsonBytes([{ Config: "config.json", Layers: ["layer.tar"] }])]]);
    const path = archivePath(); writeFileSync(path, bytes);
    expect(() => assertImageArchive(path, `sha256:${sha256(config)}`)).toThrow("layers are not the expected image");
  });
  it("rejects a sparse oversized archive without reading its entire payload", () => {
    const value = fixture(); truncateSync(value.archivePath, evidenceLimits.archiveBytes + 1);
    expect(() => assertImageArchive(value.archivePath, value.archive.image)).toThrow(/Archive exceeds byte cap/);
  });
});
