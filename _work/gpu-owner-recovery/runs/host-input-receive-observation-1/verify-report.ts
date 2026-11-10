// SPEC: _spec/gpu-host-receive.puml
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const directory = "_work/gpu-owner-recovery/runs/host-input-receive-observation-1";
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const check = (value: boolean, label: string) => { if (!value) throw Error(label); };
const output = Bun.argv[2] ?? "record-check.json";
check(Bun.argv.length <= 3 && /^record-check(?:-[1-9][0-9]*)?\.json$/.test(output), "NEW_RECORD_FILENAME_REQUIRED");
const paste = await readFile(directory + "/operator-paste.txt", "utf8");
const observation = JSON.parse(await readFile(directory + "/observation.json", "utf8"));
check(paste === "BOOTSTRAP_STARTED\nBUN_VERSION_MISMATCH\nHOST_COMMAND_EXIT=1\n", "OPERATOR_REPORT_FRAMES");
check(observation.reportedHostCommandExit === 1 && observation.reportedActualBunVersion === null && observation.originalHostFilesReceived === false, "REPORTED_EVIDENCE_SCOPE");
check(observation.operatorInvocationsConsumedAtReportScope === 1 && observation.remainingOperatorInvocations === 0 && observation.automaticRetryAuthorized === false, "CONSUMED_HOST_INVOCATION");
const bootstrap = await readFile("_work/gpu-owner-recovery/qualification/host-receive/bootstrap.ts", "utf8");
const guard = bootstrap.indexOf("BUN_VERSION_MISMATCH"), fetch = bootstrap.indexOf("55s gh api");
check(guard >= 0 && fetch >= 0 && guard < fetch, "PUBLISHED_VERSION_GUARD_PRECEDES_FETCH");
check(hash(await readFile(observation.expectedCommand)) === observation.expectedCommandSha256, "EXPECTED_COMMAND_BYTES");
const paths = [directory + "/operator-paste.txt", directory + "/observation.json", directory + "/verify-report.ts", "_work/gpu-owner-recovery/qualification/host-receive/bootstrap.ts", observation.expectedCommand];
const sources = await Promise.all(paths.map(async path => ({ path, sha256: hash(await readFile(path)) })));
await writeFile(directory + "/" + output, JSON.stringify({ version: "chess-coach.host-receive-report-record-check.v1", status: "PASS_OPERATOR_REPORT_RECORDS_ONLY", sources,
  originalHostFilesReceived: false, actualHostBunVersionEstablished: false, hostReceiveOrExtractionQualified: false, hostOrGpuOperationsPerformed: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
console.log("PASS: reported Bun-version failure retained; actual version and original host records remain unknown");
