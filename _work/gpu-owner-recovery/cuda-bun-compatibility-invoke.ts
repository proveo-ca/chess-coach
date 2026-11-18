// SPEC: _spec/recovery.md
import { constants } from "node:fs";
import { link, lstat, mkdir, open, realpath } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

type Review = { version: string; requestSha256: string; files: Record<string, string>; predecessorProofs: Record<string, string>;
  snapshot: { requestBytes: Uint8Array; bindingBytes: Uint8Array; files: Record<string, Uint8Array> } };
export function validateInvocationResult(bytes: Uint8Array, bindingBytes: Uint8Array, requestSha256: string,
  streams: Readonly<Record<string, Uint8Array>>, root: string): { diagnosticComplete: true; compatibilityPassed: boolean } {
  const need = (condition: unknown): void => { if (!condition) throw Error("CLOSED_DIAGNOSTIC_INVOCATION_RESULT_REQUIRED"); };
  const object = (value: unknown): Record<string, any> => { need(!!value && typeof value === "object" && !Array.isArray(value)); return value as Record<string, any>; };
  const exact = (value: Record<string, any>, keys: string[]) => Object.keys(value).sort().join() === keys.sort().join();
  const hash = (value: Uint8Array) => createHash("sha256").update(value).digest("hex"), encode = (value: string) => new TextEncoder().encode(value);
  const canonical = (value: unknown) => JSON.stringify(value, (_key, item: unknown) => item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
  need(bytes.byteLength > 0 && bytes.byteLength <= 1048576);
  const value = object(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
  const denials = ["archiveAuditPassed", "fullPipelineRenewalAuthorized", "extractionPerformed", "llvmCodeExecuted", "buildIsolationQualified", "custodyQualified", "cudaCompilationEstablished", "actualHostExecuted", "cudaGpuCodeExecuted", "trainingAuthorized", "trainingReady"];
  need(exact(value, ["version", "status", "scope", "requestSha256", "haltedFullRequestSha256", "sourceReviewCanonicalSha256", "rootPlan", "cases", "diagnosticComplete", "compatibilityPassed", "outerBootstrapTrust", ...denials]) &&
    value.version === "chess-coach.cuda-bun-compatibility-diagnostic.v1" && value.scope === "DIAGNOSTIC_ONLY" && value.status === "DIAGNOSTIC_COMPLETE" &&
    value.diagnosticComplete === true && typeof value.compatibilityPassed === "boolean" && value.requestSha256 === requestSha256 &&
    value.haltedFullRequestSha256 === "e0b54ee82895a3da613e92e764ccd7db2c10f2001e95241543b36f49b6f1cc63" && denials.every(key => value[key] === false) &&
    value.sourceReviewCanonicalSha256 === hash(encode(canonical(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bindingBytes))))) &&
    value.outerBootstrapTrust === "EXISTING_C1_BUN_AND_MISE_BOOTSTRAP_ASSUMPTION_RETAINED_NOT_AUTHENTICATED_BY_GUEST_SNAPSHOT");
  const plan = object(value.rootPlan), base = "_work/gpu-owner-recovery/", run = base + "runs/cuda-bun-compatibility-1/";
  need(exact(plan, ["version", "files", "launcher", "nativeBinding", "custodyQualified", "nativeClosure", "directories", "inputDirectory", "outputDirectory", "evidenceRoot"]) &&
    plan.version === "chess-coach.cuda-bun-compatibility-root-plan.v1" && plan.nativeBinding === "C1_PATH_BIND_AFTER_FD_CLOSE_NOT_ATOMIC_MOUNT_CUSTODY" && plan.custodyQualified === false &&
    plan.evidenceRoot === resolve(root, run) && plan.inputDirectory === resolve(root, base + "scratch/cuda-bun-compatibility-1-inputs") &&
    plan.outputDirectory === resolve(root, base + "scratch/cuda-bun-compatibility-1-output"));
  need(Array.isArray(value.cases) && value.cases.length === 3);
  const names = ["startup", "parser", "xz"], usedStreams: string[] = []; let aborted = false;
  for (const [index, raw] of value.cases.entries()) {
    const item = object(raw), name = names[index]!;
    need(exact(item, ["name", "outcome", "reason", "invocations", "launcher", "streams"]) && item.name === name);
    if (aborted) { need(item.outcome === "SKIPPED_DEPENDENCY" && item.invocations === 0 && item.reason === "DEPENDENCY_BUN_ABORT_DIAGNOSTIC" && item.launcher === null && item.streams === null); continue; }
    need(typeof item.outcome === "string" && ["COMPATIBLE", "BUN_ABORT_DIAGNOSTIC_OBSERVED"].includes(item.outcome) && item.invocations === 1 && item.reason === null);
    const launcher = object(item.launcher);
    need(exact(launcher, ["exitCode", "signalCode", "reaped", "stdoutEOF", "stderrEOF", "failure", "stdoutOverflow", "stderrOverflow"]) &&
      launcher.reaped === true && launcher.stdoutEOF === true && launcher.stderrEOF === true && launcher.failure === null && launcher.stdoutOverflow === false && launcher.stderrOverflow === false &&
      (launcher.exitCode === null || (Number.isInteger(launcher.exitCode) && launcher.exitCode >= 0 && launcher.exitCode <= 255)) &&
      (launcher.signalCode === null || (Number.isInteger(launcher.signalCode) && launcher.signalCode > 0 && launcher.signalCode <= 128) || (typeof launcher.signalCode === "string" && /^SIG[A-Z0-9]{1,20}$/.test(launcher.signalCode))));
    need(Array.isArray(item.streams) && item.streams.length === 2);
    const rawBytes = item.streams.map((raw: unknown, streamIndex: number) => {
      const stream = object(raw), kind = ["stdout", "stderr"][streamIndex]!, path = run + name + "." + kind, data = streams[path];
      need(exact(stream, ["stream", "path", "bytes", "sha256"]) && stream.stream === kind && stream.path === path && data instanceof Uint8Array && data.length <= 65536 &&
        stream.bytes === data.length && stream.sha256 === hash(data)); usedStreams.push(path); return data!;
    });
    const stdout = rawBytes[0]!, stderr = rawBytes[1]!;
    if (item.outcome === "COMPATIBLE") need(launcher.exitCode === 0 && launcher.signalCode === null && stderr.length === 0 && Buffer.from(stdout).equals(Buffer.from(`CUDA_BUN_COMPAT_${name.toUpperCase()}_OK\n`)));
    else {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(stderr), lines = text.split("\n");
      const expected = [/^============================================================$/, /^Bun v1\.4\.0 \(34cbb9a40\) Linux x64$/, /^Linux Kernel v[^\r\n]+ \| glibc v[^\r\n]+$/, /^CPU: [a-zA-Z0-9 ]+$/,
        /^Args: "\/usr\/local\/bin\/bun" "--no-env-file" "--no-install" "-e" [^\r\n]+$/, /^Features: jsc ?$/, /^$/, /^Elapsed: \d+ms \| User: \d+ms \| Sys: \d+ms$/, /^RSS: [^\r\n]+ \| Peak: [^\r\n]+ \| Commit: [^\r\n]+ \| Faults: \d+$/, /^$/,
        /^panic\(main thread\): abort\(\) called$/, /^oh no: Bun has crashed\. This indicates a bug in Bun, not your code\.$/, /^$/, /^To send a redacted crash report to Bun's team,$/, /^please file a GitHub issue using the link below:$/, /^$/, /^ https:\/\/bun\.report\/1\.4\.0\/[^\s]+$/, /^$/, /^$/];
      need(stdout.length === 0 && ((Number.isInteger(launcher.exitCode) && launcher.exitCode > 0) || (launcher.exitCode === null && launcher.signalCode !== null)) && lines.length === expected.length &&
        expected.every((pattern, at) => pattern.test(lines[at]!)) && !/(?:bwrap\s*:|error[^\n]*setup|setup[^\n]*(?:error|fail)|Operation not permitted|Permission denied|No such file or directory)/i.test(text)); aborted = true;
    }
  }
  need(Object.keys(streams).sort().join() === usedStreams.sort().join() && value.compatibilityPassed === !aborted);
  return { diagnosticComplete: true, compatibilityPassed: !aborted };
}
export async function invocationGate(root: string, reviewSha256: string, requestSha256: string): Promise<Review> {
  const { constants } = await import("node:fs"), { open, lstat, realpath } = await import("node:fs/promises");
  const { createHash } = await import("node:crypto"), { resolve, dirname } = await import("node:path");
  const base = "_work/gpu-owner-recovery/", hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
  const need = (condition: unknown, code: string): void => { if (!condition) throw Error(code); };
  const read = async (relative: string): Promise<Uint8Array> => {
    need((relative.startsWith(base) || relative === "tsconfig.json") && !relative.split("/").some(part => ["", ".", "..", "cache", "scratch"].includes(part)) && !relative.includes("\0"), "FIXED_DIAGNOSTIC_INPUT_REALM");
    const path = resolve(root, relative);
    for (let current = dirname(path); ; current = dirname(current)) {
      const stat = await lstat(current);
      need(stat.isDirectory() && !stat.isSymbolicLink() && (stat.mode & 0o022) === 0 && [0, process.getuid!()].includes(stat.uid), "TRUSTED_DIAGNOSTIC_INPUT_ANCESTOR");
      if (current === "/") break;
    }
    need(await realpath(path) === path, "CANONICAL_DIAGNOSTIC_INPUT");
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const before = await handle.stat({ bigint: true }), identity = (stat: typeof before) => [stat.dev, stat.ino, stat.size, stat.mode, stat.uid, stat.gid, stat.nlink, stat.mtimeNs, stat.ctimeNs].map(String).join(":");
      need(before.isFile() && before.size >= 0n && before.size <= 1048576n && (before.mode & 0o7022n) === 0n && [0, process.getuid!()].includes(Number(before.uid)), "BOUNDED_DIAGNOSTIC_INPUT");
      const chunks: Uint8Array[] = []; let offset = 0;
      while (true) {
        const bytes = Buffer.alloc(Math.min(65536, 1048577 - offset)), result = await handle.read(bytes, 0, bytes.length, offset);
        if (!result.bytesRead) break;
        offset += result.bytesRead; need(offset <= 1048576, "DIAGNOSTIC_INPUT_LIMIT"); chunks.push(bytes.subarray(0, result.bytesRead));
      }
      need(offset === Number(before.size) && identity(before) === identity(await handle.stat({ bigint: true })) && identity(before) === identity(await lstat(path, { bigint: true })), "DIAGNOSTIC_INPUT_CHANGED");
      return Buffer.concat(chunks);
    } finally { await handle.close(); }
  };
  need(/^[a-f0-9]{64}$/.test(reviewSha256) && /^[a-f0-9]{64}$/.test(requestSha256), "OUTSIDE_DIAGNOSTIC_PINS_REQUIRED");
  const raw = await read(base + "cuda-bun-compatibility-reviewed.json");
  need(hash(raw) === reviewSha256, "PINNED_DIAGNOSTIC_BINDING_REQUIRED");
  const review = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
  const flags = ["staticUnitTestsPassed", "staticTypesPassed", "adversarialSourceAccepted", "securitySourceAccepted", "devopsSourceAccepted"];
  need(review && !Array.isArray(review) && Object.keys(review).sort().join() === ["version", ...flags, "requestSha256", "files", "predecessorProofs"].sort().join() &&
    review.version === "chess-coach.cuda-bun-compatibility-source-review.v1" && flags.every(flag => review[flag] === true) && review.requestSha256 === requestSha256 &&
    review.files && !Array.isArray(review.files) && Object.keys(review.files).length === 33 && review.predecessorProofs && !Array.isArray(review.predecessorProofs), "ACCEPTED_DIAGNOSTIC_BINDING_REQUIRED");
  const oldRaw = await read(base + "cuda-archive-reviewed-v2.json");
  need(hash(oldRaw) === "dacf7e484328711b65f72d48ee6cba4808164fd6ce9ddb7bf3366868486f173c", "PINNED_FAILED_AUDIT_BINDING_REQUIRED");
  const old = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(oldRaw)), run = base + "runs/cuda-archive-audit-2/", plan = base + "runs/cuda-archive-v2-plan-1/";
  const expectedFiles = [...Object.keys(old.files), ...["cuda-bun-compatibility.ts", "cuda-bun-compatibility.test.ts", "cuda-bun-compatibility-mise.toml",
    "cuda-bun-compatibility-fixture.ts", "cuda-bun-compatibility-fixture.test.ts", "fixtures/cuda-bun-compatibility.json", "cuda-bun-compatibility-invoke.ts"].map(path => base + path)];
  const expectedProofs = [...Object.keys(old.predecessorProofs), base + "cuda-llvm-request.json", base + "runs/cuda-bun-compatibility-1/llvm-request-halted.json",
    base + "cuda-archive-reviewed-v2.json", run + "source-review.json", run + "approved-request.json", run + "source-snapshot.json",
    ...Object.keys(old.files).map((_, index) => run + "source-snapshot/" + String(index).padStart(2, "0") + ".source"),
    ...["receipt.json", ".operation", "command.stdout", "command.stderr", "output-state-after-failure.json"].map(path => run + path),
    base + "cuda-archive-audit-2-classification.json", ...["receipt.json", "command.stdout", "command.stderr", "approved-request.json", "source-review.json"].map(path => plan + path)];
  need(Object.keys(review.files).sort().join() === expectedFiles.sort().join() && Object.keys(review.predecessorProofs).sort().join() === expectedProofs.sort().join(), "EXACT_DIAGNOSTIC_BINDING_MEMBERSHIP_REQUIRED");
  const requestBytes = await read(base + "cuda-bun-compatibility-request.json");
  need(hash(requestBytes) === requestSha256, "PINNED_DIAGNOSTIC_REQUEST_REQUIRED");
  const haltedHash = "e0b54ee82895a3da613e92e764ccd7db2c10f2001e95241543b36f49b6f1cc63";
  for (const path of [base + "cuda-llvm-request.json", base + "runs/cuda-bun-compatibility-1/llvm-request-halted.json"])
    need(hash(await read(path)) === haltedHash, "FULL_ARCHIVE_PIPELINE_MUST_REMAIN_HALTED");
  const files: Record<string, Uint8Array> = {};
  for (const [path, expected] of Object.entries({ ...review.files, ...review.predecessorProofs })) {
    const bytes = await read(path);
    need(typeof expected === "string" && /^[a-f0-9]{64}$/.test(expected) && hash(bytes) === expected, "PINNED_DIAGNOSTIC_INPUT_CHANGED");
    if (Object.hasOwn(review.files, path)) files[path] = bytes;
  }
  return { ...review, snapshot: { requestBytes, bindingBytes: raw, files } } as Review;
}

async function dispatch(root: string, reviewSha256: string, requestSha256: string): Promise<void> {
  const { open } = await import("node:fs/promises"), { constants } = await import("node:fs");
  const work = root + "/_work/gpu-owner-recovery", directory = work + "/runs/cuda-bun-compatibility-1";
  const write = async (name: string, bytes: Uint8Array | string) => {
    const handle = await open(directory + "/" + name, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
  };
  await invocationGate(root, reviewSha256, requestSha256);
  const module = await import(work + "/cuda-bun-compatibility.ts");
  module.validateCompatibilityContinuation(await module.readCompatibilityInputs());
  const environment = module.compatibilityEnvironment();
  const result = await module.runCompatibilityMiseStages({
    verifyOutsideGate: () => invocationGate(root, reviewSha256, requestSha256).then(() => {}),
    readTaskConfiguration: async () => { const { readFile } = await import("node:fs/promises"); return readFile(work + "/cuda-bun-compatibility-mise.toml"); },
    run: async (stage: { name: string; argv: string[] }) => {
      await write(stage.name + ".argv.json", JSON.stringify(stage.argv, null, 2) + "\n");
      console.log(JSON.stringify({ stage: stage.name, argv: stage.argv }));
      if (stage.name === "02-diagnose") {
        const child = Bun.spawn(stage.argv, { cwd: work, env: environment, stdin: "ignore", stdout: "inherit", stderr: "inherit", detached: false });
        const exitCode = await child.exited;
        await write(stage.name + ".json", JSON.stringify({ stage: stage.name, argv: stage.argv, exitCode, signalCode: child.signalCode ?? null }) + "\n");
        return { exitCode, stdout: new Uint8Array(), failure: null };
      }
      const child = Bun.spawn(stage.argv, { cwd: work, env: environment, stdin: "ignore", stdout: "pipe", stderr: "pipe", detached: false });
      let failure: string | null = null;
      const stop = (code: string) => { failure ??= code; try { child.kill("SIGKILL"); } catch {} };
      const drain = async (stream: ReadableStream<Uint8Array>): Promise<Uint8Array> => {
        const chunks: Uint8Array[] = []; let total = 0;
        try { for await (const bytes of stream) {
          const keep = Math.min(bytes.length, Math.max(0, 65536 - total)); if (keep) chunks.push(bytes.slice(0, keep));
          total += bytes.length; if (total > 65536) stop("MISE_STAGE_OUTPUT_LIMIT");
        } } catch { stop("MISE_STAGE_STREAM_FAILED"); }
        return Buffer.concat(chunks);
      };
      const [stdout, stderr, exitCode] = await Promise.all([drain(child.stdout), drain(child.stderr), child.exited.catch(() => { stop("MISE_STAGE_REAP_FAILED"); return -1; })]);
      await write(stage.name + ".stdout", stdout); await write(stage.name + ".stderr", stderr);
      await write(stage.name + ".json", JSON.stringify({ stage: stage.name, argv: stage.argv, exitCode, signalCode: child.signalCode ?? null, failure }) + "\n");
      return { exitCode, stdout, failure };
    },
  });
  console.log(JSON.stringify(result)); process.exitCode = result.exitCode;
}

export async function invokeCompatibility(args: readonly string[]): Promise<void> {
  if (args.length !== 3 || args[0] !== "invoke" || !args.slice(1).every(value => /^[a-f0-9]{64}$/.test(value))) throw Error("CLOSED_DIAGNOSTIC_INVOCATION_REQUIRED");
  const root = resolve(fileURLToPath(new URL("../../", import.meta.url))), base = "_work/gpu-owner-recovery/";
  if (resolve(process.cwd()) !== root) throw Error("REPOSITORY_ROOT_REQUIRED");
  const reviewSha256 = args[1]!, requestSha256 = args[2]!, review = await invocationGate(root, reviewSha256, requestSha256);
  const { runBounded } = await import("./verify"), { environment: baseEnvironment } = await import("./provision");
  const directory = resolve(root, base + "runs/cuda-bun-compatibility-1"), stat = await lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid!() || stat.mode !== 0o40700 || await realpath(directory) !== directory) throw Error("OUTSIDE_PRIVATE_DIAGNOSTIC_RUN_REQUIRED");
  const write = async (name: string, value: Uint8Array | string) => {
    const handle = await open(resolve(directory, name), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try { await handle.writeFile(value); await handle.sync(); } finally { await handle.close(); }
  };
  const read = async (path: string) => { const { readFile } = await import("node:fs/promises"); return readFile(resolve(root, path)); };
  const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
  await write(".invocation", '{"version":"chess-coach.cuda-bun-compatibility-invocation-claim.v1","sequence":"cuda-bun-compatibility-1"}\n');
  await write("approved-request.json", review.snapshot.requestBytes);
  await write("source-review.json", review.snapshot.bindingBytes);
  await mkdir(resolve(directory, "source-snapshot"), { mode: 0o700 });
  const packet = [];
  for (const [index, [path, sha256]] of Object.entries(review.files).entries()) {
    const bytes = review.snapshot.files[path]!, snapshot = base + "runs/cuda-bun-compatibility-1/source-snapshot/" + String(index).padStart(2, "0") + ".source";
    if (hash(bytes) !== sha256) throw Error("DIAGNOSTIC_SOURCE_CHANGED_BEFORE_INVOCATION");
    await write("source-snapshot/" + String(index).padStart(2, "0") + ".source", bytes); packet.push({ path, snapshot, bytes: bytes.length, sha256 });
  }
  await write("source-snapshot.json", JSON.stringify({ captureTiming: "BEFORE_SYNTHETIC_DIAGNOSTIC_INVOCATION", files: packet }, null, 2) + "\n");
  const code = `const invocationGate=${invocationGate.toString()}; const dispatch=${dispatch.toString()}; await dispatch(${JSON.stringify(root)},${JSON.stringify(reviewSha256)},${JSON.stringify(requestSha256)});`;
  await write("invocation.source", code);
  await invocationGate(root, reviewSha256, requestSha256);
  const argv = [process.execPath, "--no-env-file", "--no-install", "-e", code];
  const environment = { ...baseEnvironment, MISE_OVERRIDE_CONFIG_FILENAMES: "cuda-bun-compatibility-mise.toml" };
  const result = await runBounded(argv, directory, 30000, { cwd: root, environment });
  let sourceChanged = false;
  try { await invocationGate(root, reviewSha256, requestSha256); } catch { sourceChanged = true; result.status = "FAIL"; result.failure ??= "DIAGNOSTIC_BOUND_INPUT_CHANGED"; }
  let diagnosticResult: { path: string; bytes: number; sha256: string; diagnosticComplete: boolean; compatibilityPassed: boolean } | null = null;
  if (result.status === "PASS") {
    try {
      const path = resolve(directory, "result.json"), handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      let bytes: Uint8Array;
      try {
        const before = await handle.stat({ bigint: true });
        if (!before.isFile() || before.mode !== 0o100600n || before.uid !== BigInt(process.getuid!()) || before.nlink !== 2n || before.size <= 0n || before.size > 1048576n) throw Error("BOUNDED_DIAGNOSTIC_RESULT_REQUIRED");
        const buffer = Buffer.alloc(Number(before.size) + 1); let count = 0;
        while (count < buffer.length) { const read = await handle.read(buffer, count, buffer.length - count, count); if (!read.bytesRead) break; count += read.bytesRead; }
        const after = await handle.stat({ bigint: true }), pathname = await lstat(path, { bigint: true }), pending = await lstat(resolve(directory, "result.pending.json"), { bigint: true });
        for (const stat of [after, pathname, pending]) if (["dev", "ino", "size", "mode", "uid", "nlink", "mtimeNs", "ctimeNs"].some(key => before[key as keyof typeof before] !== stat[key as keyof typeof stat])) throw Error("DIAGNOSTIC_RESULT_CHANGED");
        if (count !== Number(before.size)) throw Error("DIAGNOSTIC_RESULT_CHANGED"); bytes = buffer.subarray(0, count);
      } finally { await handle.close(); }
      const envelope = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      if (!Array.isArray(envelope.cases) || envelope.cases.length !== 3) throw Error("THREE_DIAGNOSTIC_RESULTS_REQUIRED");
      const retained: Record<string, Uint8Array> = {};
      for (const [index, name] of ["startup", "parser", "xz"].entries()) {
        if (envelope.cases[index]?.invocations !== 1) continue;
        for (const kind of ["stdout", "stderr"]) {
          const relative = base + "runs/cuda-bun-compatibility-1/" + name + "." + kind, path = resolve(root, relative);
          const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
          try {
            const before = await handle.stat({ bigint: true });
            if (!before.isFile() || before.mode !== 0o100600n || before.uid !== BigInt(process.getuid!()) || before.size < 0n || before.size > 65536n) throw Error("BOUNDED_DIAGNOSTIC_STREAM_REQUIRED");
            const data = Buffer.alloc(Number(before.size) + 1); let count = 0;
            while (count < data.length) { const next = await handle.read(data, count, data.length - count, count); if (!next.bytesRead) break; count += next.bytesRead; }
            for (const stat of [await handle.stat({ bigint: true }), await lstat(path, { bigint: true })])
              if (["dev", "ino", "size", "mode", "uid", "nlink", "mtimeNs", "ctimeNs"].some(key => before[key as keyof typeof before] !== stat[key as keyof typeof stat])) throw Error("DIAGNOSTIC_STREAM_CHANGED");
            if (count !== Number(before.size)) throw Error("DIAGNOSTIC_STREAM_CHANGED"); retained[relative] = data.subarray(0, count);
          } finally { await handle.close(); }
        }
      }
      const parsed = validateInvocationResult(bytes, review.snapshot.bindingBytes, requestSha256, retained, root);
      diagnosticResult = { path: base + "runs/cuda-bun-compatibility-1/result.json", bytes: bytes.length, sha256: hash(bytes), diagnosticComplete: parsed.diagnosticComplete, compatibilityPassed: parsed.compatibilityPassed };
    } catch { result.status = "FAIL"; result.failure ??= "DIAGNOSTIC_RESULT_INCOMPLETE_OR_INVALID"; }
  }
  try { await invocationGate(root, reviewSha256, requestSha256); } catch { sourceChanged = true; result.status = "FAIL"; result.failure ??= "DIAGNOSTIC_BOUND_INPUT_CHANGED"; }
  const streams = await Promise.all(["stdout", "stderr"].map(async stream => { const path = base + "runs/cuda-bun-compatibility-1/command." + stream, bytes = await read(path); return { stream, path, bytes: bytes.length, sha256: hash(bytes) }; }));
  await write("receipt.pending.json", JSON.stringify({ version: "chess-coach.cuda-bun-compatibility-invocation.v1", scope: "SYNTHETIC_DIAGNOSTICS_ONLY_NOT_COMPATIBILITY_OR_ARCHIVE_PASS", argv, ...result,
    environment, pinnedReviewSha256: reviewSha256, pinnedRequestSha256: requestSha256, reviewedFiles: review.files, predecessorProofs: review.predecessorProofs,
    sourceChanged, streams, diagnosticResult, oneOutsideDeadlineMs: 30000, stageConsumer: "runCompatibilityMiseStages", fullArchivePipelineAuthorityGranted: false,
    realArchiveReadRehashOrMountAuthorized: false, extractionPerformed: false, llvmCodeExecuted: false, cudaGpuCodeExecuted: false, trainingReady: false }, null, 2) + "\n");
  await link(resolve(directory, "receipt.pending.json"), resolve(directory, "receipt.json"));
  console.log(JSON.stringify({ receipt: base + "runs/cuda-bun-compatibility-1/receipt.json", status: result.status, sourceChanged, fullArchivePipelineAuthorityGranted: false, trainingReady: false }));
  process.exitCode = result.status === "PASS" ? 0 : 1;
}
if (import.meta.main) {
  try { await invokeCompatibility(Bun.argv.slice(2)); } catch (error) { console.error(error instanceof Error && /^[A-Z][A-Z0-9_]{0,127}$/.test(error.message) ? error.message : "DIAGNOSTIC_INVOCATION_FAILED"); process.exitCode = 1; }
}
