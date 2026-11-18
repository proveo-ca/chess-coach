// SPEC: _spec/gpu-host-receive.puml
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { repository } from "../../provision";
import { runBounded } from "../../verify";
import { identityFields, inspectOriginOutput, inspectRewriteOutput, publicationEnvironment } from "../../qualification/transfer/publish";
import { sourceInventory } from "../../../../tooling/runtime/qualification";
import { renderHostReceive } from "../../qualification/host-receive/bootstrap";
import request from "./request.json";

const directory = resolve(repository, "_work/gpu-owner-recovery/runs/host-input-receive-handoff-1");
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const check = (value: boolean, label: string) => { if (!value) throw Error(label); };
check(Bun.argv.length === 2 && resolve(process.cwd()) === resolve(repository), "SCOPED_SOURCE_PUBLICATION_CONTEXT_REQUIRED");
await writeFile(resolve(directory, "publication.started"), "", { flag: "wx" });
const started = performance.now(), deadline = started + request.sourcePublication.deadlineMs;
const environment = publicationEnvironment(process.env);
const result = { version: "chess-coach.host-receive-source-publication.v1", status: "FAIL", failure: null as string | null,
  attempts: { commit: 0, push: 0 }, commitSucceeded: false as boolean | null, sourceCommit: null as string | null, pushedCommit: null as string | null,
  elapsedMs: 0, sourceProof: request.sourceProof, helperSha256: request.helperSha256, operations: [] as { argv: string[]; timeoutMs: number; status: string; exitCode?: number; failure?: string | null; captureFailure?: string; streams: { path: string; bytes: number; sha256: string }[] }[],
  operatorHostExecuted: false, compilationPerformed: false, gpuExecuted: false, trainingReady: false };
let ordinal = 0;
const remaining = () => { const ms = Math.floor(deadline - performance.now()); check(ms > 0, "SOURCE_PUBLICATION_DEADLINE"); return ms; };
async function command(argv: string[], mutation?: "commit" | "push") {
  const timeoutMs = remaining(), step = resolve(directory, "command-" + String(++ordinal).padStart(2, "0")); await mkdir(step);
  const operation: typeof result.operations[number] = { argv, timeoutMs, status: "STARTED", streams: [] }; result.operations.push(operation);
  if (mutation) { result.attempts[mutation]++; if (mutation === "commit") result.commitSucceeded = null; }
  try {
    const output = await runBounded(argv, step, Math.min(timeoutMs, remaining()), { cwd: repository, environment });
    operation.status = output.status; operation.exitCode = output.exitCode; operation.failure = output.failure;
    try {
      operation.streams = await Promise.all(["stdout", "stderr"].map(async stream => { const path = resolve(step, "command." + stream), bytes = await readFile(path); return { path: relative(repository, path), bytes: bytes.length, sha256: hash(bytes) }; }));
    } catch { operation.captureFailure = "COMMAND_STREAM_HASH_FAILED"; throw Error("COMMAND_STREAM_HASH_FAILED"); }
    check(output.status === "PASS" && output.exitCode === 0, "SOURCE_PUBLICATION_COMMAND_FAILED");
    return readFile(resolve(step, "command.stdout"), "utf8");
  } catch (error) {
    if (operation.status === "STARTED") { operation.status = "FAIL_RUNNER_OUTCOME_UNKNOWN"; operation.failure = "RUNNER_DID_NOT_RETURN_AN_OUTCOME"; }
    throw error;
  }
}
async function query(args: string[]) {
  return new Promise<{ code: number; stdout: string; stderr: string }>(resolveQuery => {
    execFile("/usr/bin/git", args, { cwd: repository, env: environment, timeout: remaining(), maxBuffer: 65536, encoding: "utf8" }, (error, stdout, stderr) => resolveQuery({ code: error === null ? 0 : typeof error.code === "number" ? error.code : -1, stdout, stderr }));
  });
}
async function transport() {
  for (const push of [false, true]) { const output = await query(["remote", "get-url", ...(push ? ["--push"] : []), "--all", "origin"]); check(inspectOriginOutput(output.code, output.stdout, output.stderr), "SOURCE_REPOSITORY_MISMATCH"); }
  const output = await query(["config", "--includes", "--get-regexp", "^url\\..*\\.(insteadof|pushinsteadof)$"]);
  check(inspectRewriteOutput(output.code, output.stdout, output.stderr).allowed, "SOURCE_HTTPS_REWRITE_NOT_ACCEPTED");
}
async function frozen(commit?: string) {
  const proof = JSON.parse(await readFile(resolve(repository, request.sourceProof), "utf8"));
  check(proof.status === "PASS_HOST_RECEIVE_SOURCE_ONLY" && proof.sourceChanged === false && proof.helper.sha256 === request.helperSha256, "PASSING_HOST_RECEIVE_PROOF_REQUIRED");
  for (const source of proof.sources) {
    check(hash(await readFile(resolve(repository, source.path))) === source.sha256, "REVIEWED_SOURCE_CHANGED:" + source.path);
    if (commit !== undefined) {
      const blob = Bun.spawnSync(["/usr/bin/git", "cat-file", "blob", commit + ":" + source.path], { cwd: repository, env: { PATH: "/usr/bin:/bin", GIT_NO_LAZY_FETCH: "1" }, stdout: "pipe", stderr: "pipe", timeout: remaining() });
      check(blob.exitCode === 0 && hash(blob.stdout) === source.sha256, "COMMITTED_SOURCE_MISMATCH:" + source.path);
    }
  }
  const original = JSON.parse(await readFile(resolve(repository, "_work/gpu-owner-recovery/runs/host-feasibility-inputs-1/preparation.json"), "utf8"));
  check(JSON.stringify(await sourceInventory(repository)) === JSON.stringify(original.nativeSourceInventory), "PREPARED_NATIVE_INPUTS_CHANGED");
  return proof;
}
try {
  check((await command(["/usr/bin/git", "branch", "--show-current"])).trim() === request.sourcePublication.branch, "SOURCE_BRANCH_MISMATCH");
  await transport();
  check(identityFields.every(field => !!environment[field]), "EXISTING_IDENTITY_FIELDS_REQUIRED");
  for (const field of ["GIT_AUTHOR_IDENT", "GIT_COMMITTER_IDENT"]) { const output = await query(["var", field]); check(output.code === 0 && output.stderr === "" && output.stdout.trim().length > 0, "EXISTING_GIT_IDENTITY_REQUIRED"); }
  const proof = await frozen();
  check((await command(["/usr/bin/git", "diff", "--cached", "--name-only"])).length === 0, "UNEXPECTED_PREEXISTING_INDEX");
  const paths = [...new Set([...(await command(["/usr/bin/git", "diff", "HEAD", "--name-only"])).split("\n"), ...(await command(["/usr/bin/git", "ls-files", "--others", "--exclude-standard"])).split("\n")])].filter(Boolean).sort();
  const allowedRoots = ["_work/gpu-owner-recovery/qualification/host-receive/", "_work/gpu-owner-recovery/runs/host-feasibility-publication-3/", "_work/gpu-owner-recovery/runs/host-input-receive-source-1/", "_work/gpu-owner-recovery/runs/host-input-receive-source-2/", "_work/gpu-owner-recovery/runs/host-input-receive-handoff-1/"];
  const allowedDocs = ["_spec/.spec-index.json", "_spec/gpu-host-receive.puml", "_spec/gpu-input-transfer.puml", "_spec/gpu-qualification.puml", "_spec/gpu-build.puml", "_spec/gpu-readiness.md", "_spec/gate-closure.md"];
  const sources = []; let textBytes = 0;
  for (const path of paths) {
    if (path === relative(repository, resolve(directory, "publication.started"))) continue;
    check(allowedDocs.includes(path) || allowedRoots.some(root => path.startsWith(root)), "UNAPPROVED_SOURCE_TEXT_PATH:" + path);
    check(!/(^|\/)(home|tmp|cache|node_modules|target)(\/|$)/.test(path), "CACHE_OR_PAYLOAD_EXCLUDED");
    const metadata = await lstat(resolve(repository, path)), bytes = await readFile(resolve(repository, path));
    check(metadata.isFile() && !bytes.includes(0) && bytes.length <= 4 * 1024 * 1024, "BOUNDED_TEXT_REQUIRED");
    new TextDecoder("utf8", { fatal: true }).decode(bytes); textBytes += bytes.length;
    sources.push({ path, bytes: bytes.length, sha256: hash(bytes) });
  }
  check(textBytes <= 16 * 1024 * 1024 && sources.length > 0, "CONTROLLED_TEXT_BYTE_LIMIT");
  const auditPath = resolve(directory, "stage-audit.json");
  await writeFile(auditPath, JSON.stringify({ status: "PASS_CONTROLLED_TEXT_AUDIT", sources, textBytes, sourceProof: request.sourceProof, helperSha256: request.helperSha256, binaryOrCacheIncluded: false }, null, 2) + "\n", { flag: "wx" });
  await command(["/usr/bin/git", "add", "--", ...sources.map(source => source.path), relative(repository, auditPath)]);
  await command(["/usr/bin/git", "diff", "--cached", "--check"]);
  await command(["/usr/bin/git", "commit", "-m", "chore: prepare bounded operator input receive"], "commit"); result.commitSucceeded = true;
  const commit = (await command(["/usr/bin/git", "rev-parse", "--verify", "HEAD"])).trim(); check(/^[a-f0-9]{40}$/.test(commit), "EXACT_HANDOFF_COMMIT_REQUIRED"); result.sourceCommit = commit;
  await frozen(commit); await transport();
  check((await command(["/usr/bin/git", "branch", "--show-current"])).trim() === request.sourcePublication.branch, "SOURCE_BRANCH_CHANGED");
  await command(["/usr/bin/git", "push", request.sourcePublication.url, commit + ":refs/heads/" + request.sourcePublication.branch], "push"); result.pushedCommit = commit;
  check((await command(["/usr/bin/git", "rev-parse", "--verify", "HEAD"])).trim() === commit, "HANDOFF_COMMIT_CHANGED");
  await frozen(commit);
  const hostCommand = renderHostReceive(commit, request.helperSha256);
  await writeFile(resolve(directory, "host-command.fish"), hostCommand + "\n", { flag: "wx" });
  await writeFile(resolve(directory, "handoff.json"), JSON.stringify({ status: "READY_FOR_ONE_APPROVED_OPERATOR_INVOCATION", helperSourceCommit: commit, assetSourceCommit: "f3e277dbbf33c0aa69172cca1890792656d4cd09",
    helper: proof.helper, commandSha256: hash(Buffer.from(hostCommand + "\n")), command: relative(repository, resolve(directory, "host-command.fish")),
    expectedReceipt: "_work/gpu-owner-recovery/runs/host-input-receive-1/receipt.json", expectedStatus: "PASS_HOST_RECEIVE_AND_EXTRACT_ONLY",
    operatorHostExecutedByCodingAgent: false, compilationPerformed: false, gpuExecuted: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
  remaining(); result.status = "PASS_SOURCE_PUBLISHED_OPERATOR_OUTPUT_PENDING";
} catch (error) { result.failure = error instanceof Error ? error.message : "SOURCE_PUBLICATION_FAILED"; }
result.elapsedMs = performance.now() - started;
await writeFile(resolve(directory, "publication.json"), JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ status: result.status, failure: result.failure, sourceCommit: result.sourceCommit, pushedCommit: result.pushedCommit, receipt: relative(repository, resolve(directory, "publication.json")), operatorOutputRequired: true }));
process.exitCode = result.status === "PASS_SOURCE_PUBLISHED_OPERATOR_OUTPUT_PENDING" ? 0 : 1;
