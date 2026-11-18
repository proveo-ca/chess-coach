// SPEC: _spec/gpu-full-qualification.puml
import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runBounded } from "../../verify";

const [label] = Bun.argv.slice(2);
assert.match(label ?? "", /^host-gpu-full-source-[1-9][0-9]*$/);
const root = "_work/gpu-owner-recovery/runs/" + label + "/";
const json = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
type HashRow = { path: string; sha256: string; bytes?: number };
async function checkRows(rows: HashRow[]) {
  for (const row of rows) {
    const bytes = await readFile(row.path); assert.equal(sha256(bytes), row.sha256, row.path);
    if (row.bytes !== undefined) assert.equal(bytes.length, row.bytes, row.path);
  }
}
const proof = await json(root + "receipt.json"), records = await json(root + "record-check.json");
assert.equal(proof.status, "PASS_GPU_FULL_SOURCE_ONLY"); assert.equal(proof.sourceChanged, false);
assert.equal(records.status, "PASS_GPU_FULL_SOURCE_PACKET_RECORDS_ONLY");
assert.equal(sha256(await readFile(root + "receipt.json")), records.proof.sha256);
await checkRows(proof.sources); await checkRows(proof.programs); await checkRows([proof.command]);
const request = await json(root + "host-command-request.json");
assert.equal(request.status, "AWAITING_FRESH_EXACT_OPERATOR_HOST_APPROVAL");
assert.deepEqual(request.command, proof.command); assert.deepEqual(request.sourceProof, records.proof);
assert.deepEqual(request.resources, proof.plan.resources); assert.deepEqual(request.testLoop, proof.plan.testLoop); assert.deepEqual(request.limits, proof.plan.limits);
assert.deepEqual(request.retainedReadOnly, proof.plan.retained);
assert.deepEqual(request.scratchGuestAliases, ["/scratch", "/build/native/_work/gpu-owner-recovery/scratch"]);
assert.equal(request.maximumHostInvocations, 1); assert.equal(request.maximumContainers, 1); assert.equal(request.maximumDockerOperations, 7);
for (const key of ["hostExecutionApproved", "gpuExecutionApproved", "kernelJitCompilationApproved", "publicationApproved", "trainingApproved", "trainingReady", "automaticRetryAuthorized", "commandDeliveryOrPublicationAuthorized"]) assert.equal(request[key], false, key);
let fullStreams = 0;
for (const result of [...proof.results, await json(root + "records-verification.json")]) {
  assert.equal(result.status, "PASS"); assert.equal(result.exitCode, 0); assert.equal(result.failure, null);
  await checkRows(result.streams); fullStreams += result.streams.length;
}
const observationRoot = "_work/gpu-owner-recovery/runs/host-gpu-feasibility-observation-1/";
const observedRecords = await json(observationRoot + "record-check.json");
assert.equal(observedRecords.sources.length, 12); await checkRows(observedRecords.sources);
let observationStreams = 0;
for (const result of (await json(observationRoot + "verification.json")).results) {
  assert.equal(result.status, "PASS"); assert.equal(result.exitCode, 0); await checkRows(result.streams); observationStreams += result.streams.length;
}
const frozen = await json("_work/gpu-owner-recovery/runs/host-gpu-feasibility-source-4/receipt.json");
assert.equal(frozen.sources.length, 327); await checkRows(frozen.sources);
const diagrams = ["gpu-feasibility", "gpu-host-build-reuse", "gpu-host-build", "gpu-host-build-inventory", "gpu-build", "gpu-qualification", "gpu-input-transfer", "gpu-host-receive", "gpu-full-qualification"].map(name => "_spec/" + name + ".puml");
const index = await json("_spec/.spec-index.json");
for (const path of diagrams) {
  const text = await readFile(path, "utf8"), covered = [...text.matchAll(/^' covers: (.+)$/gm)].map(match => match[1]!);
  const rows = index.specs.filter((row: { spec: string }) => row.spec === path);
  assert.equal(rows.length, 1, path); assert.ok(covered.length > 0, path); assert.deepEqual(rows[0].covers, covered, path);
}
const owner = (pattern: string, expected: string) => assert.deepEqual(index.specs.filter((row: { covers: string[] }) => row.covers.includes(pattern)).map((row: { spec: string }) => row.spec), [expected], pattern);
owner(observationRoot + "**", "_spec/gpu-feasibility.puml");
owner("_work/gpu-owner-recovery/runs/host-gpu-native-build-observation-2/**", "_spec/gpu-host-build-reuse.puml");
owner("_work/gpu-owner-recovery/qualification/host-full/**", "_spec/gpu-full-qualification.puml");
owner(root + "**", "_spec/gpu-full-qualification.puml");
assert.ok(!index.specs.some((row: { covers: string[] }) => row.covers.some(path => path.includes("/cache/host-gpu-full-") || path.includes("/runs/host-gpu-full-1/"))));
const documentPaths = [...diagrams, "_spec/gpu-readiness.md", "_spec/gate-closure.md", "_spec/.spec-index.json"];
const docHashes = await Promise.all(documentPaths.map(async path => ({ path, sha256: sha256(await readFile(path)) })));
for (const row of proof.sources.filter((row: HashRow) => row.path.startsWith("_work/gpu-owner-recovery/qualification/host-full/"))) assert.ok(!/[\t ]+$/m.test(await readFile(row.path, "utf8")), row.path);
const commands = [
  { id: "closeout-types-final", argv: [process.execPath, "--no-env-file", "--no-install", "node_modules/typescript/lib/_tsc.js", "--noEmit", "--strict", "--noUnusedLocals", "--noUnusedParameters", "--target", "ES2022", "--module", "ESNext", "--moduleResolution", "Bundler", "--resolveJsonModule", "--types", "bun", fileURLToPath(import.meta.url)] },
  { id: "git-head", argv: ["git", "rev-parse", "HEAD"] },
  { id: "tracked-whitespace", argv: ["git", "diff", "--check"] },
  { id: "tracked-scope", argv: ["git", "diff", "--name-only"] },
  { id: "working-scope", argv: ["git", "status", "--short", "--untracked-files=normal"] },
];
await mkdir(root + "final-checks"); const results = [];
for (const command of commands) {
  const directory = root + "final-checks/" + command.id; await mkdir(directory);
  const result = await runBounded(command.argv, resolve(directory), command.id === "closeout-types-final" ? 120000 : 20000, { cwd: process.cwd(), environment: { PATH: "/usr/local/bin:/usr/bin:/bin", NO_COLOR: "1" } });
  const streams = await Promise.all(["stdout", "stderr"].map(async stream => { const path = directory + "/command." + stream, bytes = await readFile(path); return { path, bytes: bytes.length, sha256: sha256(bytes) }; }));
  results.push({ ...command, ...result, streams }); assert.equal(result.status, "PASS"); assert.equal(result.exitCode, 0);
}
const head = (await readFile(root + "final-checks/git-head/command.stdout", "utf8")).trim();
assert.equal(head, "250d438685d2fc7560b0e31439f282bb2c145888");
assert.ok((await readFile(root + "final-checks/tracked-scope/command.stdout", "utf8")).trim().split("\n").every(path => path.startsWith("_spec/")));
await checkRows(docHashes); await checkRows(proof.sources);
const inputPaths = [root + "receipt.json", root + "record-check.json", root + "records-verification.json", root + "approval-proposal.json", root + "host-command-request.json", root + "review.json", observationRoot + "record-check.json", observationRoot + "verification.json", relative(process.cwd(), fileURLToPath(import.meta.url))];
const inputs = await Promise.all(inputPaths.map(async path => ({ path, sha256: sha256(await readFile(path)) })));
await writeFile(root + "final-docs-and-source-check.json", JSON.stringify({ status: "PASS_GPU_FULL_SOURCE_DOCS_AND_RECORDS_ONLY", sources: docHashes, inputs, results,
  orderedDiagramIndexMatches: 9, docHashes: docHashes.length, sourceHashesChecked: proof.sources.length, protectedFeasibilitySourcesChecked: 327,
  observationInputHashesChecked: 12, observationVerificationStreamsChecked: observationStreams, fullVerificationStreamsChecked: fullStreams,
  counts: records.counts, typechecks: records.typechecks, head, pumlRenderingPerformed: false,
  verificationScope: "STATIC_TYPES_PURE_MOCK_E2E_AND_ORDERED_SPEC_INDEX_ONLY", newHostExecutionAuthorized: false,
  originalHostArtifactBytesRehashed: false, publicationAuthorized: false, trainingAuthorized: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
console.log("PASS_GPU_FULL_SOURCE_DOCS_AND_RECORDS_ONLY");
