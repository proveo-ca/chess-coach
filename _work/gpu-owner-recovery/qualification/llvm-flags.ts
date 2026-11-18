// SPEC: _spec/gpu-qualification.puml
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { repository, work } from "../provision";
import { runBounded } from "../verify";

export const queries = ["--cxxflags", "--includedir", "--libdir", "--libs", "--system-libs"] as const;
export const executable = "/home/agent/toolchains/linux-amd64/.local/share/mise/installs/github-tracel-ai-tracel-llvm/23.1.0-4/bin/llvm-config";
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

async function main() {
  if (Bun.argv.length !== 2 || resolve(process.cwd()) !== resolve(repository)) throw Error("QUERY_CONTEXT_REQUIRED");
  const requestPath = resolve(work, "qualification/request.json");
  const request = JSON.parse(await readFile(requestPath, "utf8"));
  if (request.llvmExecutable !== executable || JSON.stringify(request.llvmQueries) !== JSON.stringify(queries)
    || request.maximumQueryInvocations !== 5 || request.queryDeadlineMs !== 10_000 || request.llvmQueryCommonArgument !== "--link-static") throw Error("EXACT_QUERY_SCOPE_REQUIRED");
  const directory = resolve(work, "runs/gpu-qualification-llvm-flags-1");
  await mkdir(directory);
  const sources = await Promise.all(["qualification/request.json", "qualification/llvm-flags.ts", "verify.ts", "command-supervisor.ts"].map(async path => ({
    path: relative(repository, resolve(work, path)), sha256: hash(await readFile(resolve(work, path))),
  })));
  await writeFile(resolve(directory, "sources.json"), JSON.stringify(sources, null, 2) + "\n", { flag: "wx" });
  const results = [];
  let failure: string | null = null;
  let consumed = 0;
  try {
    for (const query of queries) {
      const step = resolve(directory, query.slice(2));
      await mkdir(step);
      const argv = [executable, "--link-static", query];
      consumed++;
      const result = await runBounded(argv, step, 10_000, { cwd: repository, environment: { PATH: "/usr/local/bin:/usr/bin:/bin", LANG: "C", LC_ALL: "C" } });
      const streams = await Promise.all(["stdout", "stderr"].map(async stream => {
        const path = resolve(step, `command.${stream}`), bytes = await readFile(path);
        return { path: relative(repository, path), bytes: bytes.length, sha256: hash(bytes) };
      }));
      results.push({ query, argv, deadlineMs: 10_000, ...result, streams });
      if (result.status !== "PASS") break;
    }
  } catch (error) { failure = String(error); }
  let sourceChanged = false;
  try { sourceChanged = (await Promise.all(sources.map(async source => hash(await readFile(resolve(repository, source.path))) !== source.sha256))).some(Boolean); }
  catch { sourceChanged = true; }
  const status = !failure && !sourceChanged && results.length === 5 && results.every(result => result.status === "PASS") ? "PASS_FLAGS_ONLY" : "FAIL_OR_INCOMPLETE_FLAGS";
  const receipt = { version: "chess-coach.gpu-qualification-llvm-flags.v1", status, failure, sourceChanged, results,
    invocationsConsumed: consumed, remainingInvocations: 0, automaticRetryAuthorized: false, batchClosed: true,
    prefixModified: false, prefixSelected: false, prefixCopied: false, versionQueryRepeated: false, compilationPerformed: false,
    downloadsPerformed: false, imageOperationPerformed: false, hostGpuOperationPerformed: false, trainingReady: false };
  await writeFile(resolve(directory, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status, invocationsConsumed: consumed, receipt: relative(repository, resolve(directory, "receipt.json")) }));
  process.exitCode = status === "PASS_FLAGS_ONLY" ? 0 : 1;
}

if (import.meta.main) await main();
