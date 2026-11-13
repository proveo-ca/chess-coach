// SPEC: _spec/runtime-protocol.puml
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = "/home/gu1lty/Projects/proveo/chess-coach";
const canonical = "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1";
const proposal = `${canonical}/offline-reference-proposal-1`;
const records = `${proposal}/package-acquisition-proposal-1`;
const output = `${records}/bun-transition-baseline-1`;
type Binding = { path: string; bytes?: number; sha256: string };
function requireValue(value: unknown, code: string): asserts value {
  if (!value) throw new Error(code);
}
function local(path: string): string {
  requireValue(!path.startsWith("/") && !path.split("/").some(part => ["..", "cache", ".bun"].includes(part)), "path");
  requireValue(!/\.(?:tgz|tar|gz|xz|zip|zst|bpk)$/.test(path), "archive-path");
  return resolve(root, path);
}
function bytes(path: string): Buffer {
  const target = local(path);
  const info = lstatSync(target);
  requireValue(info.isFile() && !info.isSymbolicLink() && info.size <= 16 * 1024 * 1024, `regular-bounded:${path}`);
  return readFileSync(target);
}
function binding(path: string): Binding {
  const data = bytes(path);
  return { path, bytes: data.length, sha256: createHash("sha256").update(data).digest("hex") };
}
function json(path: string): any {
  return JSON.parse(bytes(path).toString("utf8"));
}
function check(rows: Binding[], count: number): void {
  requireValue(rows.length === count, "row-count");
  for (const row of rows) {
    const current = binding(row.path);
    requireValue(current.sha256 === row.sha256 && (row.bytes === undefined || current.bytes === row.bytes), `changed:${row.path}`);
  }
}
function absent(path: string): void {
  try { lstatSync(resolve(root, path)); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  throw new Error(`unexpected-operation-root:${path}`);
}
function save(name: string, value: unknown): void {
  writeFileSync(local(`${output}/${name}`), `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
}

requireValue(process.cwd() === root && Bun.version === "1.4.0", "toolchain-root");
const python = `${proposal}/package-acquisition-source1`;
const preserved = ["capture.py", "test_capture.py", "verify.py", ".gitignore", "verification-1/receipt.json", "verification-1/source-manifest.json", "verification-1/unittest.stdout", "verification-1/unittest.stderr"].map(name => binding(`${python}/${name}`));
const fixed = [
  ["request.json", "2eb3c9727f788f9c95f0f2650ee89bbd94a5eb5ed289db67d91226e978140b70"],
  ["plan.json", "8ecfce5156322da42fb852cd071a6091b96187e19a88226bec68295936505f6c"],
  ["approval1.json", "62af17fc6199b5537c3488c10680b9269baf170a05a322facfdfad3737fea945"],
] as const;
for (const [name, expected] of fixed) requireValue(binding(`${records}/${name}`).sha256 === expected, `issued-binding:${name}`);
requireValue(binding("_work/gpu-owner-recovery/runs/host-gpu-policy-record-correction-source-2/native-source-manifest.json").sha256 === "7e0aa13c178a77e01526d7fa02189c404c1ce3b44666914665cb9ca63a3521ec", "native65-manifest");
const manifests: [string, Binding[], number][] = [
  ["frozen347", json("_work/gpu-owner-recovery/runs/host-gpu-full-source-4/sources.json"), 347],
  ["frozen327", json("_work/gpu-owner-recovery/runs/host-gpu-feasibility-source-4/receipt.json").sources, 327],
  ["native65", json("_work/gpu-owner-recovery/runs/host-gpu-policy-record-correction-source-2/native-source-manifest.json"), 65],
  ["canonical92", json(`${canonical}/verification-4/sources-after.json`), 92],
];
for (const [, rows, count] of manifests) check(rows, count);
let inputFiles = 0;
let inputBytes = 0;
for (const [packet, count, size] of [["local-inputs-1", 427, 3850400], ["corpus-inputs-1", 2, 671849]] as const) {
  const materialization = json(`${proposal}/${packet}/materialization.json`);
  const rows: Binding[] = materialization.files.map((row: Binding) => ({ ...row, path: `${proposal}/${packet}/inputs/reference/${row.path}` }));
  check(rows, count);
  const total = rows.reduce((sum, row) => sum + (row.bytes ?? 0), 0);
  requireValue(total === size, "payload-total");
  inputFiles += rows.length;
  inputBytes += total;
}
const roots = [`${records}/acquisition-execution-1`, "_work/gpu-owner-recovery/cache/reference-package-inputs-1", `${proposal}/package-inputs-1`];
for (const path of roots) absent(path);
const historical = json(`${python}/verification-1/receipt.json`);
requireValue(historical.unitTests === 85 && historical.negativeCases === 104, "python-historical-counts");
const drift = Object.entries(historical.sourceHashes as Record<string, string>).filter(([name, hash]) => binding(`${python}/${name}`).sha256 !== hash).map(([name]) => name);
requireValue(drift.includes("capture.py"), "preserved-unverified-late-python-source");
check(preserved, preserved.length);
save("source-manifest.json", preserved);
const receipt = {
  status: "PASS_BUN_TRANSITION_PRESERVATION_BASELINE_ONLY",
  proof: binding(`${output}/proof.ts`),
  issuedBindings: fixed.map(([name]) => binding(`${records}/${name}`)),
  implementationChoice: binding(`${records}/implementation-choice1.json`),
  preservedPythonFiles: binding(`${output}/source-manifest.json`),
  historicalPythonVerification: { tests: 85, negativeCases: 104, currentSourceDiffers: drift, notBunVerification: true },
  unchangedBindings: Object.fromEntries(manifests.map(([label, , count]) => [label, count])),
  selectedSourceAndCorpusPayloadsRehashed: { files: inputFiles, bytes: inputBytes, assembledRuntimeRoot: false },
  absentProductionRoots: roots,
  actualAcquisitionInvoked: false,
  actualNetworkInvoked: false,
  archiveOrCachePayloadRead: false,
  preservedPythonExecuted: false,
  nativeHostGpuReferenceOrTrainingExecuted: false,
  publicationPerformed: false,
  existingApprovalConsumedOrRenewed: false,
  trainingReady: false,
};
save("receipt.json", receipt);
console.log(JSON.stringify({ status: receipt.status, receipt: `${output}/receipt.json` }));
