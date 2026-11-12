// SPEC: _spec/gpu-qualification.puml
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runBounded } from "../../verify";

export const root = "/home/gu1lty/Projects/proveo/chess-coach";
export const packet = "_work/gpu-owner-recovery/runs/host-cpu-regression-delivery-source-1";
export const handoff = root + "/_work/gpu-owner-recovery/cache/host-cpu39-handoff-1";
const fish = "/home/agent/toolchains/linux-amd64/.local/share/mise/installs/github-fish-shell-fish-shell/4.9.3/fish";
const quote = (value: string) => "'" + value.replaceAll("\\", "\\\\").replaceAll("'", "\\'") + "'";
const requireValue: (value: unknown, reason: string) => asserts value = (value, reason) => { if (!value) throw Error(reason); };
export const sha256 = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
export function blobBinding(bytes: Uint8Array) {
  requireValue(bytes.length > 0 && bytes.length < 131072, "BOUNDED_CANONICAL_FISH_BYTES_REQUIRED");
  return { gitBlobSha: createHash("sha1").update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest("hex"), bytes: bytes.length, sha256: sha256(bytes) };
}
export type Binding = ReturnType<typeof blobBinding>;
export function bindAcceptedCanonical(bytes: Uint8Array, canonicalPath: string, programs: { path: string; sha256: string }[]) {
  const rows = programs.filter(program => program.path === canonicalPath);
  requireValue(rows.length === 1 && sha256(bytes) === rows[0]!.sha256, "CPU_PROOF_CANONICAL_PROGRAM_BINDING_REQUIRED");
  return blobBinding(bytes);
}
export function verifyFetched(bytes: Uint8Array, expected: Binding, statuses: number[]) {
  requireValue(statuses.length === 3 && statuses.every(code => code === 0), "FETCH_DECODE_AND_BOUND_PIPELINE_REQUIRED");
  requireValue(bytes.length === expected.bytes && sha256(bytes) === expected.sha256, "EXACT_PUBLISHED_SCRIPT_BYTES_REQUIRED");
}
export async function sourceBytesChanged(sources: { path: string; sha256: string }[], read: (path: string) => Promise<Uint8Array> = readFile) {
  return (await Promise.all(sources.map(async item => sha256(await read(item.path)) !== item.sha256))).some(Boolean);
}
export function renderDelivery(expected: Binding) {
  requireValue(/^[a-f0-9]{40}$/.test(expected.gitBlobSha) && /^[a-f0-9]{64}$/.test(expected.sha256) && Number.isSafeInteger(expected.bytes) && expected.bytes > 0 && expected.bytes < 131072, "LITERAL_BLOB_BINDING_REQUIRED");
  const file = handoff + "/canonical-host-command.fish";
  const ready = JSON.stringify({ version: "chess-coach.cpu39-script-delivery.v1", status: "PASS_PUBLISHED_SCRIPT_DELIVERY_ONLY", ...expected, cpuExecutionEstablished: false, trainingReady: false });
  const body = [
    "test (pwd -P) = " + quote(root) + "; or exit 1",
    "command mkdir -- " + quote(handoff) + "; or exit 1",
    "command gh api --hostname github.com repos/proveo-ca/chess-coach/git/blobs/" + expected.gitBlobSha + " --jq .content | command base64 --decode | command head --bytes=" + (expected.bytes + 1) + " > " + quote(file),
    "set -l codes $pipestatus",
    "printf '%s\\n' $codes > " + quote(handoff + "/pipeline.exit") + "; or exit 1",
    "test (count $codes) -eq 3; or exit 1",
    "for code in $codes; test $code -eq 0; or exit 1; end",
    "test (command wc -c < " + quote(file) + ") -eq " + expected.bytes + "; or exit 1",
    "set -l observed (command sha256sum -- " + quote(file) + "); or exit 1",
    "test \"$observed\" = " + quote(expected.sha256 + "  " + file) + "; or exit 1",
    "printf '%s\\n' " + quote(ready) + " > " + quote(handoff + "/delivery.json") + "; or exit 1",
  ].join("; ");
  const launch = [
    "test (pwd -P) = " + quote(root) + "; or exit 1",
    "command timeout --signal=TERM --kill-after=2s 30s fish --no-config -c " + quote(body) + "; or exit $status",
    "command fish --no-config " + quote(file),
  ].join("; ");
  for (const argument of [body, launch]) requireValue(Buffer.byteLength(argument) + 1 <= 131072, "LINUX_DELIVERY_ARGUMENT_BOUND_REQUIRED");
  return { body, command: "fish --no-config -c " + quote(launch) + "\n" };
}

export async function prepareDelivery(sourceLabel: string, verificationLabel: string) {
  requireValue(/^host-cpu-regression-source-[1-9][0-9]?$/.test(sourceLabel) && process.cwd() === root && Bun.version === "1.4.0" && process.execPath === "/usr/local/bin/bun", "PINNED_SOURCE_PACKET_CONTEXT_REQUIRED");
  requireValue(/^verification-[1-9][0-9]?$/.test(verificationLabel), "FRESH_BOUNDED_DELIVERY_VERIFICATION_LABEL_REQUIRED");
  const source = "_work/gpu-owner-recovery/runs/" + sourceLabel;
  const receiptPath = source + "/receipt.json", receiptBytes = await readFile(receiptPath), receipt = JSON.parse(receiptBytes.toString());
  requireValue(receipt.status === "PASS_SOURCE_ONLY" && receipt.sourceChanged === false && receipt.actualHostExecuted === false, "PASS_SOURCE_ONLY_CPU_PACKET_REQUIRED");
  requireValue(Array.isArray(receipt.programs), "CPU_SOURCE_PROOF_PROGRAM_BINDINGS_REQUIRED");
  const canonicalPath = source + "/canonical-host-command.fish", bytes = await readFile(canonicalPath), expected = bindAcceptedCanonical(bytes, canonicalPath, receipt.programs), rendered = renderDelivery(expected);
  const directory = resolve(root, packet + "/" + verificationLabel); await mkdir(directory);
  const sources = await Promise.all([packet + "/delivery.ts", packet + "/delivery.test.ts", canonicalPath, receiptPath, "tsconfig.json", "tsconfig.tests.json", "package.json"].map(async path => ({ path, sha256: sha256(path === canonicalPath ? bytes : path === receiptPath ? receiptBytes : await readFile(path)) })));
  await writeFile(directory + "/host-command.fish", rendered.command, { flag: "wx" });
  await writeFile(directory + "/delivery-body.fish", rendered.body + "\n", { flag: "wx" });
  await writeFile(directory + "/binding.json", JSON.stringify({ sourceLabel, canonicalPath, cpuProofReceipt: { path: receiptPath, sha256: sha256(receiptBytes) }, acceptedCpuProgramBinding: receipt.programs.find((program: { path: string }) => program.path === canonicalPath), ...expected }, null, 2) + "\n", { flag: "wx" });
  const request = { version: "chess-coach.cpu39-script-delivery-request.v1", status: "UNAPPROVED_SOURCE_ONLY", canonicalPath, binding: expected,
    repository: "https://github.com/proveo-ca/chess-coach.git", publicationRef: "refs/heads/feat-ml-adjuntant-ii-continuation-2b24d9c5a", handoff,
    successfulPublicationRequired: true, committedBlobByteCheckRequired: true, hostCheckoutChangeRequired: false,
    requestedTextFetches: 1, maximumDeliveryAttemptsIncludingPreflight: 1, sourceDeliveryPhaseTimeoutMs: 30000, sourceDeliveryKillGraceMs: 2000,
    sourceDeliveryStoredBytesMaximum: expected.bytes + 1 + 2048, cpuCampaignPhaseMaximumMs: 4200000,
    clocksAreSeparatePhaseCeilingsNotStrictEndToEnd4232Seconds: true, pipelineExitCodesRequired: [0, 0, 0],
    existingToolsOnly: ["fish", "timeout", "gh", "base64", "head", "wc", "sha256sum"],
    fetchAuthorized: false, publicationAuthorized: false, hostExecutionApproved: false, automaticRetryAuthorized: false,
    installationOrDependencyAcquisitionAuthorized: false, credentialModificationAuthorized: false, trainingAuthorized: false, trainingReady: false };
  await writeFile(directory + "/request.json", JSON.stringify(request, null, 2) + "\n", { flag: "wx" });
  const results = [];
  for (const command of [
    { id: "unit", argv: [process.execPath, "--no-env-file", "--no-install", "test", "./" + packet + "/delivery.test.ts"] },
    { id: "types", argv: [process.execPath, "--no-env-file", "--no-install", "node_modules/typescript/lib/_tsc.js", "--noEmit", "--strict", "--noUnusedLocals", "--noUnusedParameters", "--target", "ES2022", "--module", "ESNext", "--moduleResolution", "Bundler", "--types", "bun", packet + "/delivery.ts", packet + "/delivery.test.ts"] },
    { id: "fish-launch-syntax", argv: [fish, "--no-config", "--no-execute", directory + "/host-command.fish"] },
    { id: "fish-body-syntax", argv: [fish, "--no-config", "--no-execute", directory + "/delivery-body.fish"] },
    { id: "runtime-types", argv: [process.execPath, "--no-env-file", "--no-install", "node_modules/typescript/lib/_tsc.js", "-p", "tsconfig.json"] },
    { id: "runtime-test-types", argv: [process.execPath, "--no-env-file", "--no-install", "node_modules/typescript/lib/_tsc.js", "-p", "tsconfig.tests.json"] },
  ]) {
    const step = directory + "/" + command.id; await mkdir(step);
    const result = await runBounded(command.argv, step, 120000, { cwd: root, environment: { PATH: "/usr/local/bin:/usr/bin:/bin", NO_COLOR: "1", MISE_AUTO_INSTALL: "false", MISE_EXEC_AUTO_INSTALL: "false" } });
    const streams = await Promise.all(["stdout", "stderr"].map(async name => { const path = step + "/command." + name, value = await readFile(path); return { path, bytes: value.length, sha256: sha256(value) }; }));
    results.push({ ...command, ...result, streams }); if (result.status !== "PASS") break;
  }
  const sourceChanged = await sourceBytesChanged(sources);
  const passed = results.length === 6 && results.every(result => result.status === "PASS" && result.exitCode === 0 && result.failure === null) && !sourceChanged;
  const proof = { status: passed ? "PASS_DELIVERY_SOURCE_TESTS_AND_TYPES_ONLY" : "FAIL_DELIVERY_SOURCE_CHECK", sources, sourceChanged, results, binding: expected,
    fishSyntaxChecked: results.filter(result => result.id.startsWith("fish-")).length === 2 && results.filter(result => result.id.startsWith("fish-")).every(result => result.status === "PASS"),
    fishParser: fish, downloadsPerformed: false, actualHostExecuted: false, publicationPerformed: false, trainingReady: false };
  await writeFile(directory + "/receipt.json", JSON.stringify(proof, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: proof.status, receipt: packet + "/" + verificationLabel + "/receipt.json", trainingReady: false })); process.exitCode = passed ? 0 : 1;
}

if (import.meta.main && Bun.argv[2] === "--prepare") {
  requireValue(Bun.argv.length === 5, "EXACT_DELIVERY_PREPARATION_ARGUMENTS_REQUIRED"); await prepareDelivery(Bun.argv[3]!, Bun.argv[4]!);
}
