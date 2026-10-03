// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, truncateSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { sha256 } from "../challenge/corpus";
import { buildDiagnosticFixture, buildImportFixture, decode, evidenceLimits, jsonBytes, repositoryRoot,
  syntheticImageArchive, tarArchive, type Baseline } from "./fixtures/challengeEvidence";

const require = createRequire(import.meta.url);
const { importEvidence, assertImageArchive, safeRelative } = require("../../../../scripts/challenge-import-evidence.mjs") as {
  importEvidence: (options: Record<string, unknown>) => Promise<{ image: string }>;
  assertImageArchive: (path: string, image: string) => { sha256: string; bytes: number } | Promise<{ sha256: string; bytes: number }>;
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
const runValidator = (args: string[]) => {
  const result = spawnSync(join(repositoryRoot, "packages/starchess-arena/node_modules/.bin/tsx"), [
    join(repositoryRoot, "scripts/challenge-validate-baseline.ts"), ...args,
  ], { encoding: "utf8", timeout: 120000 });
  return { status: result.status, stdout: result.stdout ?? "", output: `${result.stdout ?? ""}${result.stderr ?? ""}`, error: result.error };
};
const validate = (value: Fixture, extra: string[] = []) => {
  value.rebind(); value.save();
  return runValidator([
    join(value.output, "baseline-report.json"), join(value.root, "_spec/evidence/ml-adjutant-phase1/baseline-report.json"),
    join(value.root, "_spec/evidence/ml-adjutant-phase1/verification.json"), join(value.output, "pin-migration.json"),
    join(value.output, "coverage.json"), join(value.output, "contract-report.json"), repositoryRoot, ...extra,
  ]);
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
    const { readPublishedBundle } = require("../../hermetic/evidence-bundle.mjs") as { readPublishedBundle: (path: string) => { artifacts: Map<string, Buffer> } };
    expect(readPublishedBundle(value.destination).artifacts.get("baseline-report.json")).toEqual(value.files["baseline-report.json"]);
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
  it.each(["numPendingTestSuites", "numFailedTestSuites", "numPassedTestSuites", "numTotalTestSuites"])("rejects contradictory %s summaries", async (field) => {
    const value = fixture();
    value.mutate("vitest-starchess-core.json", (report) => { report[field] = field.startsWith("numPassed") || field.startsWith("numTotal") ? 0 : 1; });
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
  it("does not claim the destination when the before-publication hook fails", async () => {
    const value = fixture();
    await expect(importEvidence({ ...value.options, beforePublication: () => { throw new Error("injected before-publication failure"); } }))
      .rejects.toThrow("injected before-publication failure");
    expect(existsSync(value.destination)).toBe(false);
  }, 120000);
  it("retains committed-state information when snapshot cleanup fails after publication", async () => {
    const value = fixture();
    const capture = value.options.captureContext;
    const error = await importEvidence({ ...value.options, captureContext: async () => ({ ...await capture(), cleanup: () => { throw new Error("injected snapshot cleanup"); } }) }).catch((failure: unknown) => failure);
    expect(error).toMatchObject({ state: "committed", phase: "snapshot-cleanup", durability: "confirmed" });
    expect(existsSync(join(value.destination, ".publication-complete"))).toBe(true);
  }, 120000);
  it("rejects a sparse oversized input before decoding it", async () => {
    const value = fixture(); truncateSync(value.paths.execution, evidenceLimits.fileBytes + 1);
    await expect(importEvidence(value.options)).rejects.toThrow(/Input exceeds byte cap/);
    expect(existsSync(value.destination)).toBe(false);
  });
  it("bounds aggregate retention of individually bounded sparse artifacts", async () => {
    const value = fixture();
    const chunk = Buffer.alloc(1024 * 1024);
    const hash = createHash("sha256");
    for (let remaining = evidenceLimits.fileBytes; remaining > 0; remaining -= chunk.length) hash.update(chunk.subarray(0, Math.min(remaining, chunk.length)));
    const digest = hash.digest("hex");
    for (let index = 0; index <= Math.floor(evidenceLimits.retainedBytes / evidenceLimits.fileBytes); index++) {
      const path = `bounded-${index}.bin`;
      writeFileSync(join(value.output, path), ""); truncateSync(join(value.output, path), evidenceLimits.fileBytes);
      value.verification.artifacts.push({ path, type: "file", bytes: evidenceLimits.fileBytes, sha256: digest });
    }
    writeFileSync(join(value.output, "verification.json"), jsonBytes(value.verification));
    await expect(importEvidence(value.options)).rejects.toThrow(/Aggregate import byte cap exceeded/);
    expect(existsSync(value.destination)).toBe(false);
  });
});

describe("authoritative seven-input baseline validator", () => {
  it("accepts the complete independent fixture without loading current output reports", () => {
    const result = validate(fixture());
    expect(result.error).toBeUndefined(); expect(result.status, result.output).toBe(0); expect(result.stdout.trim()).toBe("ok");
  }, 120000);

  const cases: [string, string, (document: Record<string, any>) => void, RegExp][] = [
    ["invented 54 integer rows", "baseline-report.json", (d) => { d.rows = Array.from({ length: 54 }, (_, index) => index); }, /Invalid current scheduled evidence shape or cardinality/],
    ["unknown roster", "baseline-report.json", (d) => { d.rows[0].match.key = "invented-roster"; }, /current row match white-trace-01 mismatch/],
    ["truthy learned flag", "baseline-report.json", (d) => { d.learnedGateEligible = "false"; }, /Invalid current baseline provenance or flags/],
    ["falsy learned flag", "baseline-report.json", (d) => { d.learnedGateEligible = 0; }, /Invalid current baseline provenance or flags/],
    ["eligible learned flag", "baseline-report.json", (d) => { d.learnedGateEligible = true; }, /Invalid current baseline provenance or flags/],
    ["falsy execution flag", "baseline-report.json", (d) => { d.executionIntegrity = 0; }, /Invalid current baseline provenance or flags/],
    ["forged learned pass", "baseline-report.json", (d) => { d.learnedChallengePass = true; }, /Invalid current baseline provenance or flags/],
    ["falsy learned pass", "baseline-report.json", (d) => { d.learnedChallengePass = 0; }, /Invalid current baseline provenance or flags/],
    ["forged summary bucket", "baseline-report.json", (d) => { d.summary.corpus.wins++; }, /current full summary mismatch/],
    ["forged stop-kind summary", "baseline-report.json", (d) => { d.summary.corpus.stopKinds.invented = 1; }, /current full summary mismatch/],
    ["forged rerun flag", "baseline-report.json", (d) => { d.deterministicRerun.performed = false; }, /current deterministic rerun consistency mismatch/],
    ["forged rerun hash", "baseline-report.json", (d) => { d.deterministicRerun.comparisons[0].rerunSha256 = "0".repeat(64); }, /current deterministic rerun consistency mismatch/],
    ["unequal migration", "pin-migration.json", (d) => { d.comparisons[0].equal = false; }, /Full pin migration mismatch/],
    ["forged inventory", "baseline-report.json", (d) => { d.pins.sourceInventory.inventorySha256 = "0".repeat(64); }, /Current execution pins mismatch/],
    ["coverage feature hash changed with identical counts", "coverage.json", (d) => { d.windows[0].featureSha256 = "0".repeat(64); }, /Full frozen-corpus coverage mismatch/],
    ["coverage fixture hash changed with identical counts", "coverage.json", (d) => { d.fixtures.rows[0].featuresSha256 = "0".repeat(64); }, /Full frozen-corpus coverage mismatch/],
  ];
  it.each(cases)("rejects %s with rebound raw checksums", (_name, path, mutate, message) => {
    const value = fixture(); value.mutate(path, mutate);
    const result = validate(value);
    expect(result.error).toBeUndefined(); expect(result.status).not.toBe(0); expect(result.output).toMatch(message);
  }, 120000);

  it("rejects an extra CLI input instead of silently ignoring it", () => {
    const result = validate(fixture(), ["unexpected"]);
    expect(result.status).not.toBe(0); expect(result.output).toContain("Expected [currentBaseline, originalBaseline, originalVerification, migration, coverage, contract, frozenSourceRoot]");
  });
  it("rejects one sparse input beyond the shared file cap before decoding", () => {
    const value = fixture(); truncateSync(join(value.output, "coverage.json"), evidenceLimits.fileBytes + 1);
    const result = runValidator([join(value.output, "coverage.json"), ...Array(5).fill(value.paths.execution), repositoryRoot]);
    expect(result.status).not.toBe(0); expect(result.output).toContain("Validator input exceeds byte cap");
  });
  it("bounds aggregate retention before decoding sparse inputs", () => {
    const value = fixture(); const path = join(value.output, "bounded.json"); writeFileSync(path, ""); truncateSync(path, evidenceLimits.fileBytes);
    const result = runValidator([...Array(6).fill(path), repositoryRoot]);
    expect(result.status).not.toBe(0); expect(result.output).toContain("Validator retained-input byte cap exceeded");
  });
});

describe("synthetic test-only Docker-save archive parser", () => {
  const checkArchive = async (path: string, image: string) => assertImageArchive(path, image);
  const archivePath = () => {
    const root = mkdtempSync("/tmp/opencode/import-archive-"); roots.push(root); return join(root, "image.tar");
  };
  it("returns the digest and byte count for correctly checksummed tar and uncompressed layer diff IDs", async () => {
    const archive = syntheticImageArchive(); const path = archivePath(); writeFileSync(path, archive.bytes);
    await expect(checkArchive(path, archive.image)).resolves.toEqual({ sha256: sha256(archive.bytes), bytes: archive.bytes.length });
  });
  it("rejects a config hash for another image", async () => {
    const archive = syntheticImageArchive(); const path = archivePath(); writeFileSync(path, archive.bytes);
    await expect(checkArchive(path, `sha256:${"a".repeat(64)}`)).rejects.toThrow("config image ID mismatch");
  });
  it("rejects ordered layers whose manifest swaps their diff IDs", async () => {
    const archive = syntheticImageArchive({ manifestLayers: ["layer-1.tar", "layer-0.tar"] }); const path = archivePath(); writeFileSync(path, archive.bytes);
    await expect(checkArchive(path, archive.image)).rejects.toThrow("ordered layer diff_id mismatch");
  });
  it("rejects a doubled manifest layer", async () => {
    const archive = syntheticImageArchive({ manifestLayers: ["layer-0.tar", "layer-0.tar"] }); const path = archivePath(); writeFileSync(path, archive.bytes);
    await expect(checkArchive(path, archive.image)).rejects.toThrow("ordered layer diff_id mismatch");
  });
  it("rejects duplicate tar entries even when the metadata bytes match", async () => {
    const archive = syntheticImageArchive({ duplicate: true }); const path = archivePath(); writeFileSync(path, archive.bytes);
    await expect(checkArchive(path, archive.image)).rejects.toThrow("duplicate path config.json");
  });
  it("rejects a tar header with a damaged checksum", async () => {
    const archive = syntheticImageArchive(); archive.bytes[100] = 49; const path = archivePath(); writeFileSync(path, archive.bytes);
    await expect(checkArchive(path, archive.image)).rejects.toThrow("header checksum");
  });
  it("rejects malformed size bytes even after recomputing the header checksum", async () => {
    const archive = syntheticImageArchive(); archive.bytes.write("0000000000x\0", 124);
    archive.bytes.fill(32, 148, 156);
    const checksum = archive.bytes.subarray(0, 512).reduce((total, byte) => total + byte, 0);
    archive.bytes.write(`${checksum.toString(8).padStart(6, "0")}\0 `, 148);
    const path = archivePath(); writeFileSync(path, archive.bytes);
    await expect(checkArchive(path, archive.image)).rejects.toThrow("malformed numeric field");
  });
  it("rejects a config whose diff IDs do not hash its uncompressed layers", async () => {
    const layer = tarArchive([["file", Buffer.from("uncompressed layer")]]);
    const config = jsonBytes({ rootfs: { type: "layers", diff_ids: [`sha256:${"0".repeat(64)}`] } });
    const bytes = tarArchive([["config.json", config], ["layer.tar", layer], ["manifest.json", jsonBytes([{ Config: "config.json", Layers: ["layer.tar"] }])]]);
    const path = archivePath(); writeFileSync(path, bytes);
    await expect(checkArchive(path, `sha256:${sha256(config)}`)).rejects.toThrow("ordered layer diff_id mismatch");
  });
  it("rejects a sparse oversized archive without reading its entire payload", async () => {
    const archive = syntheticImageArchive(); const path = archivePath(); writeFileSync(path, archive.bytes);
    truncateSync(path, evidenceLimits.archiveBytes + 1);
    await expect(checkArchive(path, archive.image)).rejects.toThrow("archive size or file type");
  });
});
