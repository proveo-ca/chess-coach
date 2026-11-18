// SPEC: _spec/gpu-host-build.puml
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { repository, work } from "../../provision";
import { buildPrograms, renderHostBuild } from "./render";

const [label] = Bun.argv.slice(2);
if (Bun.argv.length !== 3 || !/^host-gpu-build-source-[1-9][0-9]*$/.test(label ?? "") || resolve(process.cwd()) !== resolve(repository)) throw Error("HOST_BUILD_RECORD_CONTEXT_REQUIRED");
const directory = resolve(work, "runs", label!), relativeDirectory = "_work/gpu-owner-recovery/runs/" + label;
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const check = (value: boolean, reason: string) => { if (!value) throw Error(reason); };
const proofBytes = await readFile(directory + "/receipt.json"), proof = JSON.parse(proofBytes.toString());
check(proof.status === "PASS_HOST_NATIVE_BUILD_SOURCE_ONLY" && proof.sourceChanged === false && proof.results.length === 6, "SOURCE_ONLY_PROOF_REQUIRED");
for (const source of proof.sources) check(hash(await readFile(source.path)) === source.sha256, "SOURCE_CHANGED:" + source.path);
let streams = 0;
for (const result of proof.results) {
  check(result.status === "PASS" && result.exitCode === 0, "SOURCE_VERIFICATION_STAGE_FAILED");
  for (const stream of result.streams) { const bytes = await readFile(stream.path); check(bytes.length === stream.bytes && hash(bytes) === stream.sha256, "SOURCE_CAPTURE_CHANGED"); streams++; }
}
const programs = await buildPrograms(), command = await readFile(proof.command.path);
check(command.length === proof.command.bytes && hash(command) === proof.command.sha256 && command.toString() === await renderHostBuild() + "\n", "EXACT_BUILD_LITERAL_CHANGED");
for (const entry of proof.programs) check(Buffer.byteLength(programs[entry.name as keyof typeof programs]) === entry.bytes && hash(Buffer.from(programs[entry.name as keyof typeof programs])) === entry.sha256, "GENERATED_PROGRAM_CHANGED");
const index = JSON.parse(await readFile("_spec/.spec-index.json", "utf8"));
for (const path of ["_spec/gpu-host-build.puml", "_spec/gpu-host-build-inventory.puml", "_spec/gpu-host-receive.puml", "_spec/gpu-input-transfer.puml", "_spec/gpu-qualification.puml", "_spec/gpu-build.puml"]) {
  const covers = [...(await readFile(path, "utf8")).matchAll(/^' covers: (.+)$/gm)].map(match => match[1]);
  check(JSON.stringify(covers) === JSON.stringify(index.specs.find((entry: { spec: string }) => entry.spec === path).covers), "SPEC_INDEX_DRIFT:" + path);
}
const fixtures = [];
for (const name of ["e2e-happy", "e2e-native-failure", "e2e-cleanup-failure"]) {
  const root = directory + "/e2e/host-build-build-tests/" + name + "/";
  const fixture = JSON.parse(await readFile(root + "fixture-scope.json", "utf8"));
  check(fixture.scope === "SOURCE_ONLY_MOCK_NOT_HOST_EVIDENCE" && fixture.actualDockerProcesses === 0 && fixture.actualNativeProcesses === 0 && fixture.hostEvidence === false, "MOCKED_FIXTURE_SCOPE");
  for (const file of ["fixture-scope.json", "result.json", "argv.json", "effects.json"]) { const bytes = await readFile(root + file); fixtures.push({ path: relativeDirectory + "/e2e/host-build-build-tests/" + name + "/" + file, bytes: bytes.length, sha256: hash(bytes) }); }
}
const observationRoot = "_work/gpu-owner-recovery/runs/host-build-inventory-observation-2/";
const observation = JSON.parse(await readFile(observationRoot + "record-check.json", "utf8"));
check(observation.status === "PASS_OPERATOR_REPORTED_INVENTORY2_RECORDS_ONLY" && observation.hostInvocationsRemaining === 0 && observation.buildAuthorized === false, "METADATA_GRANT_CONSUMED_BUILD_NOT_AUTHORIZED");
for (const source of observation.sources) check(hash(await readFile(source.path)) === source.sha256, "OBSERVATION_RECORD_CHANGED");
const sourceProof = { path: relativeDirectory + "/receipt.json", sha256: hash(proofBytes) };
await writeFile(directory + "/host-command-approval.json", JSON.stringify({ version: "chess-coach.owned-container-build-approval-proposal.v1", status: "AWAITING_EXPLICIT_HOST_BUILD_METHOD_AND_NATIVE_EXECUTION_APPROVAL",
  sourceProof, command: proof.command, plan: proof.plan, helperDependencyPaths: proof.plan.existingHelpers, maximumHostInvocations: 1,
  approvalIncludesIfSelected: ["OWNED_CONTAINER_METHOD_INSTEAD_OF_SHARED_BUILDKIT", "ONE_NEVER_STARTED_BUN_DONOR_AND_ONE_BUN_INTERPRETER_COPY", "FRESH_NATIVE_AND_CARGO_STAGING", "ONE_RESOURCE_CAPPED_RUST_WORKER_START_AND_LOG_FOLLOW", "THREE_NATIVE_VERSION_GUARDS_AND_TWO_OFFLINE_CARGO_COMPILATIONS_WITH_BUILD_SCRIPTS", "ONLY_OWNED_CONTAINER_STOP_KILL_INSPECT_AND_REMOVAL"],
  hostExecutionApproved: false, sourcePublicationApproved: false, qualificationImageBuilt: false, gpuExecutionAuthorized: false, trainingAuthorized: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
await writeFile(directory + "/record-check.json", JSON.stringify({ status: "PASS_HOST_NATIVE_BUILD_SOURCE_AND_COMMAND_RECORDS_ONLY", sourceProof, sourceHashesChecked: proof.sources.length,
  verificationStreamsChecked: streams, mockedLifecycleFixtureFiles: fixtures, diagramIndexMatches: 6, commandSha256: hash(command),
  localFishSyntaxValidated: false, hostExecutionApproved: false, actualHostOrDockerOperationsPerformed: false, nativeCompilationPerformed: false, sourcePublicationPerformed: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ status: "PASS_HOST_NATIVE_BUILD_SOURCE_AND_COMMAND_RECORDS_ONLY", sourceProof, command: proof.command }));
