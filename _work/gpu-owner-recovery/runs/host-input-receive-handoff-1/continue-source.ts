// SPEC: _spec/gpu-host-receive.puml
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { lstat, readFile, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { repository } from "../../provision";
import { runBounded } from "../../verify";
import { inspectOriginOutput, inspectRewriteOutput, publicationEnvironment } from "../../qualification/transfer/publish";
import { renderHostReceive } from "../../qualification/host-receive/bootstrap";
import request from "./request.json";

const directory = resolve(repository, "_work/gpu-owner-recovery/runs/host-input-receive-handoff-1");
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const check = (value: boolean, label: string) => { if (!value) throw Error(label); };
export async function sharedRemainingMs() { return Math.floor((await lstat(resolve(directory, "publication.started"))).mtimeMs + request.sourcePublication.deadlineMs - Date.now()); }

async function main() {
  check(Bun.argv.length === 2 && resolve(process.cwd()) === resolve(repository), "SCOPED_SOURCE_CONTINUATION_CONTEXT_REQUIRED");
  const initial = JSON.parse(await readFile(resolve(directory, "publication.json"), "utf8"));
  check(initial.status === "FAIL" && initial.attempts.commit === 0 && initial.attempts.push === 0 && initial.operations.at(-1).exitCode === 2
    && JSON.stringify(initial.operations.at(-1).argv) === JSON.stringify(["/usr/bin/git", "diff", "--cached", "--check"]), "STATIC_CHECK_ONLY_CONTINUATION_REQUIRED");
  const sharedMs = await sharedRemainingMs(); check(sharedMs > 0, "ORIGINAL_SOURCE_PUBLICATION_DEADLINE_EXPIRED");
  const deadline = performance.now() + sharedMs;
  await writeFile(resolve(directory, "continuation.started"), "", { flag: "wx" });
  const result = { status: "FAIL", failure: null as string | null, originalReceipt: "_work/gpu-owner-recovery/runs/host-input-receive-handoff-1/publication.json", originalBudgetRemainingAtContinuationMs: sharedMs,
    attempts: { commit: 0, push: 0 }, commitSucceeded: false as boolean | null, sourceCommit: null as string | null, pushedCommit: null as string | null,
    rawEvidenceWhitespacePreserved: true, operations: [] as { argv: string[]; status: string; exitCode?: number; failure?: string | null; captureFailure?: string; streams?: { path: string; bytes: number; sha256: string }[] }[], operatorHostExecuted: false, trainingReady: false };
  let ordinal = 0;
  const environment = publicationEnvironment(process.env);
  const remaining = () => { const ms = Math.floor(deadline - performance.now()); check(ms > 0, "ORIGINAL_SOURCE_PUBLICATION_DEADLINE_EXPIRED"); return ms; };
  async function command(argv: string[], mutation?: "commit" | "push") {
    const step = resolve(directory, "continuation-" + String(++ordinal).padStart(2, "0"));
    const { mkdir } = await import("node:fs/promises"); await mkdir(step);
    const operation: typeof result.operations[number] = { argv, status: "STARTED" }; result.operations.push(operation);
    if (mutation) { result.attempts[mutation]++; if (mutation === "commit") result.commitSucceeded = null; }
    try { const output = await runBounded(argv, step, remaining(), { cwd: repository, environment });
      operation.status = output.status; operation.exitCode = output.exitCode; operation.failure = output.failure;
      try { operation.streams = await Promise.all(["stdout", "stderr"].map(async stream => { const path = resolve(step, "command." + stream), bytes = await readFile(path); return { path: relative(repository, path), bytes: bytes.length, sha256: hash(bytes) }; })); }
      catch { operation.captureFailure = "COMMAND_STREAM_HASH_FAILED"; throw Error("COMMAND_STREAM_HASH_FAILED"); }
      check(output.status === "PASS" && output.exitCode === 0, "SOURCE_CONTINUATION_COMMAND_FAILED");
      return readFile(resolve(step, "command.stdout"), "utf8");
    } catch (error) { if (operation.status === "STARTED") operation.status = "FAIL_RUNNER_OUTCOME_UNKNOWN"; throw error; }
  }
  async function transport() {
    const query = (args: string[]) => new Promise<{ code: number; stdout: string; stderr: string }>(resolveQuery => {
      execFile("/usr/bin/git", args, { cwd: repository, env: environment, timeout: remaining(), maxBuffer: 65536, encoding: "utf8" }, (error, stdout, stderr) => resolveQuery({ code: error === null ? 0 : typeof error.code === "number" ? error.code : -1, stdout, stderr }));
    });
    for (const push of [false, true]) { const output = await query(["remote", "get-url", ...(push ? ["--push"] : []), "--all", "origin"]); check(inspectOriginOutput(output.code, output.stdout, output.stderr), "SOURCE_REPOSITORY_MISMATCH"); }
    const output = await query(["config", "--includes", "--get-regexp", "^url\\..*\\.(insteadof|pushinsteadof)$"]);
    check(inspectRewriteOutput(output.code, output.stdout, output.stderr).allowed, "SOURCE_HTTPS_REWRITE_NOT_ACCEPTED");
  }
  async function frozen(commit?: string) {
    const proof = JSON.parse(await readFile(resolve(repository, request.sourceProof), "utf8"));
    check(proof.status === "PASS_HOST_RECEIVE_SOURCE_ONLY" && proof.sourceChanged === false && proof.helper.sha256 === request.helperSha256, "FROZEN_HELPER_PROOF_REQUIRED");
    for (const source of proof.sources) {
      check(hash(await readFile(resolve(repository, source.path))) === source.sha256, "SOURCE_CHANGED:" + source.path);
      if (commit !== undefined) {
        const blob = Bun.spawnSync(["/usr/bin/git", "cat-file", "blob", commit + ":" + source.path], { cwd: repository, env: { PATH: "/usr/bin:/bin", GIT_NO_LAZY_FETCH: "1" }, stdout: "pipe", stderr: "pipe", timeout: remaining() });
        check(blob.exitCode === 0 && hash(blob.stdout) === source.sha256, "COMMITTED_SOURCE_MISMATCH:" + source.path);
      }
    }
    return proof;
  }
  try {
    const proof = await frozen();
    const listing = Bun.spawnSync(["/usr/bin/git", "ls-files", "--others", "--exclude-standard"], { cwd: repository, stdout: "pipe", stderr: "pipe", timeout: remaining() });
    check(listing.exitCode === 0, "LOCAL_TEXT_INVENTORY_FAILED");
    const added = listing.stdout.toString().trim().split("\n").filter(Boolean);
    for (const path of added) {
      check(path.startsWith("_work/gpu-owner-recovery/runs/host-input-receive-handoff-1/") && !path.includes("/home/") && !path.includes("/tmp/"), "CONTINUATION_TEXT_ONLY");
      const bytes = await readFile(resolve(repository, path)); check(bytes.length <= 4 * 1024 * 1024 && !bytes.includes(0), "BOUNDED_TEXT_REQUIRED"); new TextDecoder("utf8", { fatal: true }).decode(bytes);
    }
    if (added.length) await command(["/usr/bin/git", "add", "--", ...added]);
    await command(["/usr/bin/git", "diff", "--cached", "--check", "--", "_spec", "_work/gpu-owner-recovery/qualification", ":(glob)_work/gpu-owner-recovery/runs/**/*.ts"]);
    await transport();
    await command(["/usr/bin/git", "commit", "-m", "chore: prepare bounded operator input receive"], "commit"); result.commitSucceeded = true;
    const commit = (await command(["/usr/bin/git", "rev-parse", "--verify", "HEAD"])).trim(); check(/^[a-f0-9]{40}$/.test(commit), "FULL_HANDOFF_COMMIT_REQUIRED"); result.sourceCommit = commit;
    await frozen(commit);
    check((await command(["/usr/bin/git", "branch", "--show-current"])).trim() === request.sourcePublication.branch, "SOURCE_BRANCH_CHANGED");
    await transport();
    await command(["/usr/bin/git", "push", request.sourcePublication.url, commit + ":refs/heads/" + request.sourcePublication.branch], "push"); result.pushedCommit = commit;
    await frozen(commit);
    const hostCommand = renderHostReceive(commit, request.helperSha256);
    await writeFile(resolve(directory, "host-command.fish"), hostCommand + "\n", { flag: "wx" });
    await writeFile(resolve(directory, "handoff.json"), JSON.stringify({ status: "READY_FOR_ONE_APPROVED_OPERATOR_INVOCATION", helperSourceCommit: commit, assetSourceCommit: "f3e277dbbf33c0aa69172cca1890792656d4cd09", helper: proof.helper,
      command: "_work/gpu-owner-recovery/runs/host-input-receive-handoff-1/host-command.fish", commandSha256: hash(Buffer.from(hostCommand + "\n")),
      expectedReceipt: "_work/gpu-owner-recovery/runs/host-input-receive-1/receipt.json", expectedStatus: "PASS_HOST_RECEIVE_AND_EXTRACT_ONLY", operatorHostExecutedByCodingAgent: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
    remaining(); result.status = "PASS_SOURCE_PUBLISHED_OPERATOR_OUTPUT_PENDING";
  } catch (error) { result.failure = error instanceof Error ? error.message : "SOURCE_CONTINUATION_FAILED"; }
  await writeFile(resolve(directory, "continuation.json"), JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: result.status, failure: result.failure, sourceCommit: result.sourceCommit, pushedCommit: result.pushedCommit, operatorOutputRequired: true }));
  process.exitCode = result.status === "PASS_SOURCE_PUBLISHED_OPERATOR_OUTPUT_PENDING" ? 0 : 1;
}

if (import.meta.main) {
  if (Bun.argv.length === 3 && Bun.argv[2] === "--budget-only") console.log(JSON.stringify({ sharedRemainingMs: await sharedRemainingMs() }));
  else await main();
}
