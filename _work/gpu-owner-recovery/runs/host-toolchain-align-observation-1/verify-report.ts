// SPEC: _spec/gpu-host-receive.puml
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const directory = "_work/gpu-owner-recovery/runs/host-toolchain-align-observation-1";
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const check = (value: boolean, label: string) => { if (!value) throw Error(label); };
const report = JSON.parse(await readFile(directory + "/observation.json", "utf8"));
const paste = await readFile(directory + "/operator-paste.txt", "utf8");
const lines = paste.trimEnd().split("\n");
const names = ["free-before", "install", "bun", "rustc", "cargo", "free-after"];
check(lines.length === 11 && names.every((name, index) => lines[index] === name + "_EXIT=0" && report.reportedStepExits[name] === 0), "REPORTED_STEP_EXITS");
check(lines[6] === report.reportedVersions.bun && lines[6] === "1.4.0", "REPORTED_BUN_PIN");
check(lines[7] === report.reportedRustcBanner && lines[7]!.startsWith("rustc 1.95.0 ("), "REPORTED_RUST_PIN");
check(lines[8] === report.reportedCargoBanner && lines[8]!.startsWith("cargo 1.95.0 ("), "REPORTED_CARGO_PIN");
check(lines[9] === report.reportedFinalStatus && lines[10] === "HOST_TOOLCHAIN_EXIT=0" && report.reportedHostToolchainExit === 0, "REPORTED_ALIGNMENT_STATUS");
check(report.originalHostFilesReceived === false && report.actualOperatorCommandBytesVerified === false && report.remainingAlignmentInvocations === 0 && report.trainingReady === false, "REPORT_SCOPE_AND_CONSUMPTION");
const paths = [directory + "/operator-paste.txt", directory + "/observation.json", directory + "/verify-report.ts", report.request];
const sources = await Promise.all(paths.map(async path => ({ path, sha256: hash(await readFile(path)) })));
await writeFile(directory + "/record-check.json", JSON.stringify({ version: "chess-coach.host-alignment-report-record-check.v1", status: "PASS_OPERATOR_REPORTED_ALIGNMENT_RECORDS_ONLY", sources,
  reportedVersionFactsAccepted: true, originalHostFilesReceived: false, componentOrTargetAvailabilityIndependentlyVerified: false, hostOrGpuOperationsPerformed: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
console.log("PASS: six reported exit codes and Bun/Rust/Cargo pins; alignment consumed, no receiver authority renewed");
