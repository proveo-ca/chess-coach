// SPEC: _spec/runtime-protocol.puml
export async function createDeliveryRuntime() {
  const bootstrapEntryOrigin = process.hrtime.bigint();
  const fs = await import("node:fs");
  const path = await import("node:path");
  const crypto = await import("node:crypto");
  const cp = await import("node:child_process");
  const https = await import("node:https");
  const D = "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1";
  const R2 = `${D}/package-acquisition-proposal-2`;
  const HOSTROOT = "/home/gu1lty/Projects/proveo/chess-coach";
  const HREL = "_work/gpu-owner-recovery/runs/reference-package-handoff-2";
  const CALLER = `${R2}/invoke-approved-bun.ts`;
  const OBSERVER = `${R2}/acquisition-invocation-1`;
  const PACKET_PATH = `${R2}/source-packet1.json`;
  const APPROVAL_SHA = "4e68d36f8076e213744364cf4cd5f793ef3dbffda6157b93070edf2ffc282d3f";
  const BOUNDARY_PATH = `${R2}/manual-launch-boundary-selection1.json`;
  const BOUNDARY_SHA = "44aa077f7db10d3bc3a462da355198973a6f2afba29b7745d4c2bba53f94cdc5";
  const AMENDMENT_PATH = `${R2}/manual-source-transport-amendment1.json`;
  const AMENDMENT_SHA = "f53b4985052f242a453d24e1bcccde47d1589288952543ea0a5b7d5756291918";
  const fixedInputs = [
    ["_work/gpu-owner-recovery/verify.ts", "9831b75035a5d832c6d86608b7d561821ee1a4c6dec8d2a7ecd31fbca55d5f58"],
    ["_work/gpu-owner-recovery/command-supervisor.ts", "88e56077c3bcddf722f81081a0cb7c6f94d1da106add486dbf13a92d165fb9c6"],
    [`${D}/local-inputs-1/inputs/reference/pnpm-lock.yaml`, "1d05ed3d8de5a94873f26a2fb51b88c080704d2e90bf942f9f0bb2ce75a504e0"]
  ] as const;
  const bindings = [
    ["acquisitionRequest", `${R2}/request.json`, "c0288e1e34e24d2f7a81e12ee1967ffafbd2768b4c2a5bc2ba15826b6384ff3f"],
    ["acquisitionPlan", `${R2}/plan.json`, "7f6a90ca105d6a7c5a45951b508d4a1ecdd5e217625d1cefe08da23557847405"],
    ["manualHandoffRequest", `${R2}/manual-handoff-request1.json`, "47d63b8cb446cdc8a83323788c9106cdb82437992e7bd3a88f55821aa6bde52b"],
    ["manualHandoffPlan", `${R2}/manual-handoff-plan1.json`, "4297e4f1b763b5aa152b88a7a3e288a19cafc85331cbed2d776f38d043f8817a"]
  ] as const;
  const limits = { files: 96, file: 1048576, source: 6291456, packet: 8388608, response: 12582912, directories: 256, stageA: 120000, fetch: 30000, stderr: 65536 } as const;
  const blockers: readonly string[] = [];
  type Row = { path: string; bytes: number; sha256: string; gitBlobOid: string; base64: string };
  type Pin = { bytes: number; sha256: string; gitBlobOid: string };
  type Pins = Pin & { commitOid: string; packetPath: string; fileTable: Omit<Row, "base64">[] };
  type Fault = "clock" | "clock-after-fetch" | "transport-clock" | "transport-finalization-deadline" | "child-clock" | "child-finalization-deadline" | "cleanup" | "interrupt" | "file-close" | "receipt-close" | "finalization-deadline" | "seal-deadline" | "directory-close";
  type Events = Pick<import("node:events").EventEmitter, "on" | "once" | "removeListener">;
  type SocketLike = Events & { destroyed: boolean; destroy(): unknown };
  type ResponseLike = Events & { statusCode?: number | undefined; complete: boolean; readableEnded: boolean; destroyed: boolean; destroy(): unknown };
  type RequestLike = Events & { destroyed: boolean; writableFinished: boolean; end(): unknown; destroy(): unknown };
  type RequestOptions = { protocol: "https:"; hostname: "api.github.com"; port: 443; path: string; method: "GET"; agent: false; headers: { Accept: string; "User-Agent": string; Connection: "close"; "Accept-Encoding": "identity" } };
  type RequestFactory = (options: RequestOptions, onResponse: (response: ResponseLike) => void) => RequestLike;
  type Synthetic = { scope: "OFFLINE_SYNTHETIC"; fixtureRoot: string; requestFactory: RequestFactory; fetchMs?: number; stageMs?: number; fault?: Fault };
  type ChildSpec = { executable: string; args: string[]; cwd: string; env: NodeJS.ProcessEnv; stdoutCap: number; stderrCap: number; remainingMs: () => number; workMs: number; cleanupMs: number; deadlineOwner?: "INNER_CALLER"; syntheticFault?: Fault };
  type PipeLike = { readonly destroyed: boolean; destroy(): unknown };
  type PipeState = { present: boolean | null; attempts: number; confirmed: boolean; destroyed: boolean | null; failed: boolean; firstFailure: string | null; getterErrors: number; destroyErrors: number; streamErrors: number; stateErrors: number };
  type PipeDestruction = { cleanupCalls: number; destructionAttempted: boolean; pipesDestroyed: boolean; cleanupFailed: boolean; stdout: PipeState; stderr: PipeState };
  type ChildResult = { stdout: Buffer; stderr: Buffer; spawnAttempted: boolean; spawned: boolean; pid: number | null; spawnError: boolean; noChildCreated: boolean; exitCode: number | null; signal: string | null; reaped: boolean; closed: boolean; outEOF: boolean; errEOF: boolean; failure: string | null; interrupted: boolean; cancellationSignal: NodeJS.Signals | null; cleanupStarted: boolean; cleanupReason: "FAILURE" | "POST_EXIT_DRAIN" | null; cleanupOriginElapsedMs: number | null; cleanupOriginsStarted: number; cleanupBudgetMs: number; cleanupExpired: boolean; cleanupClockFailed: boolean; pipesDestroyed: boolean; pipeDestructionAttempted: boolean; pipeCleanupFailed: boolean; pipeDestruction: PipeDestruction; processGroupGone: boolean | null; cleanupConfirmed: boolean; descendantsConfirmedGone: false; signalFailure: boolean; signalAttempts: { target: "CHILD" | "GROUP"; signal: NodeJS.Signals; result: "SENT" | "NOT_DELIVERED" | "THREW" }[] };
  type FetchResult = { body: Buffer; requestCalls: number; receivedBytes: number; retainedBytes: number; statusCode: number | null; failure: string | null; requestFinished: boolean; requestClosed: boolean; responseEOF: boolean; responseComplete: boolean; responseClosed: boolean; socketClosed: boolean; cleanupConfirmed: boolean; aborted: boolean; interrupted: boolean };
  function need(value: unknown, reason: string): asserts value { if (!value) throw new Error(reason); }
  function object(value: unknown): Record<string, unknown> { need(value !== null && typeof value === "object" && !Array.isArray(value), "object-required"); return value as Record<string, unknown>; }
  function hash(bytes: Uint8Array): string { return crypto.createHash("sha256").update(bytes).digest("hex"); }
  function blob(bytes: Uint8Array): string { return crypto.createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex"); }
  function identity(bytes: Uint8Array): Pin { return { bytes: bytes.length, sha256: hash(bytes), gitBlobOid: blob(bytes) }; }
  function safePath(value: unknown): asserts value is string {
    need(typeof value === "string" && value.length > 0 && value.length <= 1024 && /^[A-Za-z0-9_.\/-]+$/.test(value), "canonical-relative-path");
    const parts = value.split("/");
    need(parts.every(p => p !== "" && p !== "." && p !== ".."), "canonical-relative-path");
    need(!parts.some(p => /^(?:cache|archives?|node_modules|\.git|native|compiler-output|__pycache__|failed-full1|halted-llvm|reference-package-inputs-[12]|package-inputs-[12]|acquisition-execution-\d+|acquisition-invocation-\d+|reference-package-handoff-\d+)$/i.test(p)), "prohibited-packet-root");
    need(/\.(?:ts|json|jsonl|yaml|yml|md|puml|stdout|stderr)$/.test(value) || value === `${D}/package-acquisition-bun-source2/.gitignore`, "text-source-extension");
    need(value !== PACKET_PATH, "packet-self-membership-forbidden");
  }
  function text(bytes: Uint8Array): string {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    need(!/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(decoded), "text-only-source");
    need(Buffer.from(decoded).equals(Buffer.from(bytes)), "canonical-utf8"); return decoded;
  }
  function decode(value: unknown, maximum: number, wrapped = false): Buffer {
    need(typeof value === "string" && value.length <= Math.ceil(maximum / 3) * 4 + (wrapped ? Math.ceil(maximum / 45) * 2 + 2 : 0), "base64-size-cap");
    need(!wrapped || /^[A-Za-z0-9+/=\r\n]*$/.test(value), "base64-encoding");
    const canonical = wrapped ? value.replace(/[\r\n]/g, "") : value;
    need(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(canonical), "base64-encoding");
    const bytes = Buffer.from(canonical, "base64");
    need(bytes.length <= maximum && bytes.toString("base64") === canonical, "canonical-base64"); return bytes;
  }
  function directories(paths: readonly string[]): string[] {
    const found = new Set<string>([""]);
    for (const member of [...paths, `${OBSERVER}/placeholder`]) {
      let parent = path.posix.dirname(member);
      while (parent !== ".") { found.add(parent); parent = path.posix.dirname(parent); }
    }
    need(found.size <= limits.directories, "snapshot-directory-cap");
    return [...found].sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b));
  }
  function pinCheck(value: Pin): void {
    need(Number.isSafeInteger(value.bytes) && value.bytes > 0 && value.bytes <= limits.packet && /^[0-9a-f]{64}$/.test(value.sha256) && /^[0-9a-f]{40}$/.test(value.gitBlobOid), "literal-byte-binding-required");
  }
  function match(bytes: Uint8Array, expected: Pin): void { need(bytes.length === expected.bytes && hash(bytes) === expected.sha256 && blob(bytes) === expected.gitBlobOid, "length-sha256-git-blob-mismatch"); }
  function verifyApproval(files: Map<string, Buffer>): void {
    const approval = files.get(`${R2}/approval2.json`);
    need(approval && hash(approval) === APPROVAL_SHA, "genuine-approval-sha256");
    const row = object(JSON.parse(text(approval))), bound = object(row["bindings"]);
    need(row["status"] === "APPROVED_AT_ISSUANCE_NOT_EXECUTED" && row["manualHandoffGrantId"] === "reference-package-manual-host-handoff-2" && row["archiveGrantId"] === "reference-two-package-source-acquisition-2", "composite-approval-row");
    for (const [key, name, sha256] of bindings) {
      const item = object(bound[key]), content = files.get(name);
      need(item["path"] === name && item["sha256"] === sha256 && content && hash(content) === sha256, "four-immutable-approval-bindings");
    }
    const boundaryBytes = files.get(BOUNDARY_PATH);
    need(boundaryBytes && hash(boundaryBytes) === BOUNDARY_SHA, "genuine-launch-boundary-sha256");
    const boundary = object(JSON.parse(text(boundaryBytes)));
    need(boundary["status"] === "EXECUTOR_CONFIRMED_BOOTSTRAP_CLOCK_BOUNDARY" && object(boundary["approval"])["sha256"] === APPROVAL_SHA && object(boundary["manualPlan"])["sha256"] === bindings[3][2], "launch-boundary-bindings");
    const amendmentBytes = files.get(AMENDMENT_PATH);
    need(amendmentBytes && hash(amendmentBytes) === AMENDMENT_SHA, "genuine-transport-amendment-sha256");
    const amendment = object(JSON.parse(text(amendmentBytes)));
    need(amendment["status"] === "EXECUTOR_APPROVED_ANONYMOUS_SINGLE_HTTPS_REQUEST" && amendment["additionalAttemptsOrRequestsGranted"] === 0, "transport-amendment-row");
    for (const [key, name, sha256] of [["approval", `${R2}/approval2.json`, APPROVAL_SHA], ["manualRequest", bindings[2][1], bindings[2][2]], ["manualPlan", bindings[3][1], bindings[3][2]], ["launchBoundary", BOUNDARY_PATH, BOUNDARY_SHA]] as const) {
      const item = object(amendment[key]); need(item["path"] === name && item["sha256"] === sha256, "transport-amendment-bindings");
    }
  }
  function validatePacket(bytes: Buffer, expected: Pin, table: readonly Omit<Row, "base64">[]) {
    pinCheck(expected); need(bytes.length <= limits.packet, "packet-byte-cap"); match(bytes, expected);
    need(table.length > 0 && table.length <= limits.files, "literal-file-table-count");
    const envelope = object(JSON.parse(text(bytes)));
    need(envelope["version"] === "chess-coach.literal-text-packet.v1" && envelope["kind"] === "FIXED_LITERAL_TEXT_FILE_TABLE_NOT_A_RESOLVER", "literal-packet-envelope");
    need(Object.keys(envelope).sort().join(",") === "aggregateBytes,directories,files,kind,version", "packet-envelope-fields");
    const rows = envelope["files"]; need(Array.isArray(rows) && rows.length === table.length, "literal-file-table-count");
    const files = new Map<string, Buffer>(), expectedNames = new Set<string>(); let aggregate = 0;
    for (const entry of table) { safePath(entry.path); need(!expectedNames.has(entry.path), "duplicate-literal-member"); expectedNames.add(entry.path); }
    for (let index = 0; index < rows.length; index++) {
      const row = object(rows[index]), wanted = table[index]!; safePath(row["path"]);
      need(Object.keys(row).sort().join(",") === "base64,bytes,gitBlobOid,path,sha256", "file-row-fields");
      need(!files.has(row["path"]), "duplicate-packet-member");
      need(row["path"] === wanted.path && row["bytes"] === wanted.bytes && row["sha256"] === wanted.sha256 && row["gitBlobOid"] === wanted.gitBlobOid, "fixed-literal-table-mismatch");
      need(Number.isSafeInteger(row["bytes"]) && Number(row["bytes"]) >= 0 && Number(row["bytes"]) <= limits.file, "file-byte-cap");
      const content = decode(row["base64"], limits.file); text(content); match(content, wanted);
      aggregate += content.length; need(aggregate <= limits.source, "aggregate-source-cap"); files.set(row["path"], content);
    }
    const dirs = directories([...files.keys()]);
    need(envelope["aggregateBytes"] === aggregate && JSON.stringify(envelope["directories"]) === JSON.stringify(dirs), "packet-total-or-directory-table");
    need(files.has(CALLER), "required-fixed-closure-member");
    for (const [member, sha256] of fixedInputs) need(files.has(member) && hash(files.get(member)!) === sha256, "unchanged-helpers-and-lock-required");
    verifyApproval(files);
    return { files, directories: dirs, aggregateBytes: aggregate };
  }
  function parseResponse(bytes: Buffer, pins: Pin): Buffer {
    need(bytes.length <= limits.response, "github-response-cap");
    const response = object(JSON.parse(text(bytes)));
    need(response["encoding"] === "base64" && response["sha"] === pins.gitBlobOid && response["size"] === pins.bytes, "github-blob-response-identity");
    const packet = decode(response["content"], limits.packet, true); match(packet, pins); return packet;
  }
  function ancestors(directory: string): void {
    const all: string[] = [];
    for (let current = path.resolve(directory); ; current = path.dirname(current)) { all.push(current); if (path.dirname(current) === current) break; }
    for (const current of all.reverse()) { const stat = fs.lstatSync(current); need(stat.isDirectory() && !stat.isSymbolicLink(), "existing-nonsymlink-ancestor-required"); }
  }
  function absent(name: string): void {
    try { fs.lstatSync(name); throw new Error("fresh-path-required"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  function durableDirectory(directory: string, fault?: Fault): void {
    const fd = fs.openSync(directory, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
    let failed: unknown;
    try { fs.fsyncSync(fd); } catch (error) { failed = error; }
    try { fs.closeSync(fd); if (fault === "directory-close") throw new Error("synthetic-directory-close"); } catch (error) { failed ??= error; }
    if (failed) throw failed;
  }
  function freshDirectory(directory: string): void { ancestors(path.dirname(directory)); fs.mkdirSync(directory, { mode: 0o700 }); durableDirectory(directory); durableDirectory(path.dirname(directory)); }
  function writeExclusive(name: string, bytes: Uint8Array, mode = 0o400, fault?: Fault): void {
    ancestors(path.dirname(name));
    const fd = fs.openSync(name, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, mode);
    let failed: unknown;
    try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } catch (error) { failed = error; }
    try { fs.closeSync(fd); if (fault === "file-close" || fault === "receipt-close") throw new Error(`synthetic-${fault}`); } catch (error) { failed ??= error; }
    try { durableDirectory(path.dirname(name)); } catch (error) { failed ??= error; }
    if (failed) throw failed;
  }
  function record(name: string, value: unknown, fault?: Fault): void { const bytes = Buffer.from(JSON.stringify(value, null, 2) + "\n"); need(bytes.length <= 65536, "receipt-byte-cap"); writeExclusive(name, bytes, 0o400, fault); }
  function clock(budget: number, origin = bootstrapEntryOrigin, fault?: Fault) {
    need(Number.isFinite(budget) && budget > 0 && budget <= limits.stageA, "bounded-process-local-budget-required");
    let previous = origin, sticky = false, finalizing = false;
    const remaining = (): number => {
      const now = process.hrtime.bigint();
      if (fault === "clock" || now < previous) sticky = true;
      previous = now; need(!sticky, "stage-a-clock-failure");
      const left = budget - Number(now - origin) / 1e6;
      if (finalizing && fault === "finalization-deadline") return -1;
      return left;
    };
    return { remaining, check: () => need(remaining() > 0, "stage-a-deadline"), finalizing: () => { finalizing = true; }, invalidate: () => { sticky = true; } };
  }
  function createPipeCleanup() {
    const empty = (): PipeState => ({ present: null, attempts: 0, confirmed: false, destroyed: null, failed: false, firstFailure: null, getterErrors: 0, destroyErrors: 0, streamErrors: 0, stateErrors: 0 });
    const states = { stdout: empty(), stderr: empty() }; let cleanupCalls = 0;
    const increment = (value: number): number => Math.min(Number.MAX_SAFE_INTEGER, value + 1);
    function mark(name: "stdout" | "stderr", counter: "getterErrors" | "destroyErrors" | "streamErrors" | "stateErrors", reason: string): void {
      const state = states[name]; state.failed = true; state.firstFailure ??= reason; state[counter] = increment(state[counter]);
    }
    function inspect(name: "stdout" | "stderr", pipe: PipeLike): boolean | null {
      const state = states[name];
      try {
        const value = pipe.destroyed;
        if (typeof value !== "boolean") throw Error("invalid-pipe-state");
        state.destroyed = value; state.confirmed = value; return value;
      } catch { state.destroyed = null; state.confirmed = false; mark(name, "getterErrors", `${name}-pipe-state-unknown`); return null; }
    }
    function report(): PipeDestruction {
      return { cleanupCalls, destructionAttempted: states.stdout.attempts > 0 || states.stderr.attempts > 0, pipesDestroyed: states.stdout.confirmed && states.stderr.confirmed, cleanupFailed: states.stdout.failed || states.stderr.failed, stdout: { ...states.stdout }, stderr: { ...states.stderr } };
    }
    function attempt(stdout: PipeLike | null | undefined, stderr: PipeLike | null | undefined): PipeDestruction {
      cleanupCalls = increment(cleanupCalls);
      for (const [name, pipe] of [["stdout", stdout], ["stderr", stderr]] as const) {
        const state = states[name]; state.present = pipe !== null && pipe !== undefined;
        if (!pipe) { state.destroyed = null; state.confirmed = false; continue; }
        if (inspect(name, pipe) === true) continue;
        state.attempts = increment(state.attempts);
        try { pipe.destroy(); } catch { mark(name, "destroyErrors", `${name}-pipe-destroy-failed`); }
        if (inspect(name, pipe) !== true) mark(name, "stateErrors", `${name}-pipe-destroy-unconfirmed`);
      }
      return report();
    }
    return { attempt, report, noteError: (name: "stdout" | "stderr"): void => mark(name, "streamErrors", `${name}-pipe-error`) };
  }
  async function runChild(spec: ChildSpec): Promise<ChildResult> {
    const stdout: Buffer[] = [], stderr: Buffer[] = [];
    let outBytes = 0, errBytes = 0, exitCode: number | null = null, signal: string | null = null;
    let reaped = false, closed = false, outEOF = false, errEOF = false, failure: string | null = null, interrupted = false;
    let child: ReturnType<typeof cp.spawn> | undefined;
    let spawned = false, pid: number | null = null, spawnError = false, spawnAttemptCompleted = false, spawnAttempted = false;
    let started: bigint | null = null, previous: bigint | null = null, cleanupOrigin: bigint | null = null;
    let cleanupStarted = false, cleanupReason: ChildResult["cleanupReason"] = null, cleanupOriginElapsedMs: number | null = null;
    let cleanupOriginsStarted = 0, cleanupExpired = false, cleanupClockFailed = false, signalFailure = false;
    const pipeCleanup = createPipeCleanup();
    let processGroupGone: boolean | null = null, cancellationSignal: NodeJS.Signals | null = null, settled = false;
    const signalAttempts: ChildResult["signalAttempts"] = [], attempted = new Set<string>();
    let watchdog: ReturnType<typeof setInterval> | undefined, cleanupTimer: ReturnType<typeof setTimeout> | undefined, killTimer: ReturnType<typeof setTimeout> | undefined;
    let doneResolve!: () => void;
    const done = new Promise<void>(resolve => { doneResolve = resolve; });
    function sample(): bigint | null {
      try {
        const now = process.hrtime.bigint();
        if ((previous !== null && now < previous) || spec.syntheticFault === "child-clock") throw Error("clock");
        previous = now; return now;
      } catch { cleanupClockFailed = true; failure ??= "child-clock-failure"; return null; }
    }
    function finish(): void { if (!settled) { settled = true; doneResolve(); } }
    function destroyPipes(): void {
      const pipes = pipeCleanup.attempt(child?.stdout, child?.stderr);
      if (pipes.cleanupFailed) failure ??= pipes.stdout.firstFailure ?? pipes.stderr.firstFailure ?? "pipe-cleanup-failed";
    }
    function send(target: "CHILD" | "GROUP", sig: NodeJS.Signals): void {
      if (pid === null || attempted.has(`${target}:${sig}`)) return;
      attempted.add(`${target}:${sig}`);
      try {
        const delivered = target === "GROUP" ? process.kill(-pid, sig) : child?.kill(sig);
        signalAttempts.push({ target, signal: sig, result: delivered === true ? "SENT" : "NOT_DELIVERED" });
        if (delivered !== true) { signalFailure = true; failure ??= "owned-signal-not-delivered"; }
      } catch { signalAttempts.push({ target, signal: sig, result: "THREW" }); signalFailure = true; failure ??= "owned-signal-threw"; }
    }
    function terminate(): void {
      send("GROUP", "SIGTERM");
      if (killTimer === undefined && !settled) killTimer = setTimeout(() => { send("GROUP", "SIGKILL"); }, 50);
    }
    function startCleanup(reason: NonNullable<ChildResult["cleanupReason"]>): void {
      if (cleanupStarted) return;
      cleanupStarted = true; cleanupReason = reason; cleanupOriginsStarted++;
      cleanupOrigin = sample();
      if (cleanupOrigin !== null && started !== null) cleanupOriginElapsedMs = Number(cleanupOrigin - started) / 1e6;
      cleanupTimer = setTimeout(() => {
        cleanupExpired = true; failure ??= "child-cleanup-deadline";
        send("GROUP", "SIGTERM"); send("GROUP", "SIGKILL");
        destroyPipes(); finish();
      }, spec.cleanupMs);
    }
    function fail(reason: string): void { failure ??= reason; startCleanup("FAILURE"); terminate(); }
    function groupGone(): boolean | null {
      if (pid === null) return null;
      try {
        if (process.kill(-pid, 0) !== true) { fail("owned-process-group-check-failed"); return null; }
        return false;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ESRCH") return true;
        fail("owned-process-group-check-failed"); return null;
      }
    }
    function observe(): void {
      if (settled) return;
      if (spawnAttemptCompleted && !spawned && (spawnError || !spawnAttempted)) { destroyPipes(); finish(); return; }
      if (reaped && (!closed || !outEOF || !errEOF)) startCleanup("POST_EXIT_DRAIN");
      if (reaped && closed && outEOF && errEOF) {
        processGroupGone = groupGone();
        if (processGroupGone === true) finish(); else fail("owned-process-group-remains-or-unconfirmed");
      }
    }
    function interrupt(sig: NodeJS.Signals): void {
      if (interrupted) return;
      interrupted = true; cancellationSignal = sig; failure ??= "delivery-interrupted";
      startCleanup("FAILURE"); send("CHILD", sig); terminate(); observe();
    }
    const onInt = () => interrupt("SIGINT"), onTerm = () => interrupt("SIGTERM"), onHup = () => interrupt("SIGHUP");
    process.on("SIGINT", onInt); process.on("SIGTERM", onTerm); process.on("SIGHUP", onHup);
    try {
      need(Number.isFinite(spec.workMs) && spec.workMs > 0 && Number.isFinite(spec.cleanupMs) && spec.cleanupMs >= 0 && spec.cleanupMs <= 2000, "child-local-duration-required");
      started = sample();
      if (started === null) throw Error("child-clock-failure");
      if (spec.deadlineOwner !== "INNER_CALLER") need(spec.remainingMs() > 0, "child-parent-duration-required");
      watchdog = setInterval(() => {
        const now = sample();
        if (now === null) fail("child-clock-failure");
        if (spec.syntheticFault === "interrupt" && !interrupted) interrupt("SIGINT");
        if (spec.deadlineOwner !== "INNER_CALLER") {
          try {
            if (now !== null && started !== null && Number(now - started) / 1e6 >= spec.workMs) fail("child-deadline");
            if (spec.remainingMs() <= spec.cleanupMs) fail("child-deadline");
          } catch { cleanupClockFailed = true; fail("parent-clock-failure"); }
        }
        if (failure !== null) { startCleanup("FAILURE"); terminate(); }
        observe();
      }, 5);
      spawnAttempted = true;
      child = cp.spawn(spec.executable, spec.args, { cwd: spec.cwd, env: spec.env, detached: true, shell: false, stdio: ["ignore", "pipe", "pipe"] });
      spawnAttemptCompleted = true;
      if (typeof child.pid === "number") { spawned = true; pid = child.pid; }
      need(child.stdout && child.stderr, "owned-child-pipes-required");
      const collect = (data: Buffer, isOut: boolean): void => {
        const current = isOut ? outBytes : errBytes, cap = isOut ? spec.stdoutCap : spec.stderrCap;
        const accepted = Math.max(0, Math.min(data.length, cap - current));
        if (accepted) (isOut ? stdout : stderr).push(Buffer.from(data.subarray(0, accepted)));
        if (isOut) outBytes += accepted; else errBytes += accepted;
        if (accepted !== data.length) fail(isOut ? "child-stdout-cap" : "child-stderr-cap");
      };
      child.stdout.on("data", (data: Buffer) => collect(data, true)); child.stderr.on("data", (data: Buffer) => collect(data, false));
      child.stdout.once("end", () => { outEOF = true; observe(); }); child.stderr.once("end", () => { errEOF = true; observe(); });
      child.stdout.once("error", () => { pipeCleanup.noteError("stdout"); fail("stdout-pipe-error"); }); child.stderr.once("error", () => { pipeCleanup.noteError("stderr"); fail("stderr-pipe-error"); });
      child.once("spawn", () => { spawned = true; pid = child?.pid ?? pid; });
      child.once("error", () => { spawnError = !spawned && pid === null; fail(spawnError ? "child-spawn-error" : "child-process-error"); observe(); });
      child.once("exit", (code, sig) => { exitCode = code; signal = sig; reaped = true; if (code !== 0 || sig !== null) fail("child-nonzero-or-signal"); observe(); });
      child.once("close", () => { closed = true; observe(); });
      await done;
    } catch (error) {
      spawnAttemptCompleted = true; spawnError = spawnAttempted && !spawned && pid === null;
      fail(error instanceof Error ? error.message : "child-failure"); observe();
      if (!settled) await done;
    }
    finally {
      if (watchdog !== undefined) clearInterval(watchdog);
      if (cleanupTimer !== undefined) clearTimeout(cleanupTimer);
      if (killTimer !== undefined) clearTimeout(killTimer);
      process.removeListener("SIGINT", onInt); process.removeListener("SIGTERM", onTerm); process.removeListener("SIGHUP", onHup);
      if (!reaped || !closed || !outEOF || !errEOF) { failure ??= "owned-child-reap-or-eof-unconfirmed"; send("GROUP", "SIGKILL"); destroyPipes(); }
    }
    const stdoutBuffer = Buffer.concat(stdout), stderrBuffer = Buffer.concat(stderr);
    const finalNow = sample();
    if (finalNow === null) failure ??= "child-clock-failure";
    if (cleanupOrigin !== null && finalNow !== null && Number(finalNow - cleanupOrigin) / 1e6 >= spec.cleanupMs) { cleanupExpired = true; failure ??= "child-cleanup-deadline"; }
    if (spec.deadlineOwner !== "INNER_CALLER") { try { if (spec.remainingMs() <= 0) failure ??= "child-finalization-deadline"; } catch { cleanupClockFailed = true; failure ??= "parent-clock-failure"; } }
    if (spec.syntheticFault === "cleanup") failure ??= "synthetic-cleanup-failed";
    if (spec.syntheticFault === "child-finalization-deadline") failure ??= "child-finalization-deadline";
    const pipeDestruction = pipeCleanup.report(), pipesDestroyed = pipeDestruction.pipesDestroyed, pipeDestructionAttempted = pipeDestruction.destructionAttempted, pipeCleanupFailed = pipeDestruction.cleanupFailed;
    const cleanupConfirmed = spawned && reaped && closed && outEOF && errEOF && processGroupGone === true && !cleanupExpired && !cleanupClockFailed && pipeDestruction.cleanupCalls === 0 && !pipeCleanupFailed && !signalFailure && spec.syntheticFault !== "cleanup";
    if (failure === null && (!cleanupConfirmed || exitCode !== 0 || signal !== null)) failure = "child-lifecycle-incomplete";
    return { stdout: stdoutBuffer, stderr: stderrBuffer, spawnAttempted, spawned, pid, spawnError, noChildCreated: !spawned && pid === null && (spawnError || !spawnAttempted), exitCode, signal, reaped, closed, outEOF, errEOF, failure, interrupted, cancellationSignal, cleanupStarted, cleanupReason, cleanupOriginElapsedMs, cleanupOriginsStarted, cleanupBudgetMs: spec.cleanupMs, cleanupExpired, cleanupClockFailed, pipesDestroyed, pipeDestructionAttempted, pipeCleanupFailed, pipeDestruction, processGroupGone, cleanupConfirmed, descendantsConfirmedGone: false, signalFailure, signalAttempts };
  }
  function requestOptions(oid: string): RequestOptions {
    need(/^[a-f0-9]{40}$/.test(oid), "committed-git-blob-pin-required");
    return { protocol: "https:", hostname: "api.github.com", port: 443, path: `/repos/proveo-ca/chess-coach/git/blobs/${oid}`, method: "GET", agent: false, headers: { Accept: "application/vnd.github+json", "User-Agent": "chess-coach-reference-package-handoff-2", Connection: "close", "Accept-Encoding": "identity" } };
  }
  async function fetchPacket(oid: string, remainingMs: () => number, factory: RequestFactory, fetchMs: number, fault?: Fault): Promise<FetchResult> {
    const started = process.hrtime.bigint(); let previous = started;
    const chunks: Buffer[] = [];
    let request: RequestLike | null = null, response: ResponseLike | null = null, socket: SocketLike | null = null;
    let requestCalls = 0, receivedBytes = 0, retainedBytes = 0, statusCode: number | null = null, failure: string | null = null;
    let requestFinished = false, requestClosed = false, responseEOF = false, responseClosed = false, socketClosed = false;
    let cleanupStarted = false, cleanupFailed = false, aborted = false, settled = false, interrupted = false, factoryReturned = false;
    const destroyAttempted = new Set<RequestLike | ResponseLike | SocketLike>();
    let resolveDone!: () => void;
    const done = new Promise<void>(resolve => { resolveDone = resolve; });
    const cleanupReserve = Math.min(2000, fetchMs / 4);
    const fail = (reason: string) => { failure ??= reason; };
    const elapsed = (): number => {
      try { const now = process.hrtime.bigint(); if (now < previous || fault === "transport-clock") throw Error("clock"); previous = now; return Number(now - started) / 1e6; }
      catch { fail("https-clock-failure"); return Number.POSITIVE_INFINITY; }
    };
    const parentLeft = (): number => { try { return remainingMs(); } catch { fail("https-parent-clock-failure"); return -1; } };
    const destroy = (resource: RequestLike | ResponseLike | SocketLike | null): void => {
      if (!resource || destroyAttempted.has(resource)) return;
      destroyAttempted.add(resource);
      try { resource.destroy(); } catch { cleanupFailed = true; fail("https-owned-destroy-failed"); }
    };
    const allClosed = (): boolean => (!request || requestClosed) && (!response || responseClosed) && (!socket || socketClosed);
    const maybeDone = (): void => {
      if (factoryReturned && cleanupStarted && allClosed()) { settled = true; resolveDone(); }
    };
    const cleanup = (): void => {
      cleanupStarted = true; destroy(response); destroy(request); destroy(socket); maybeDone();
    };
    const abort = (reason: string): void => { fail(reason); aborted = true; cleanup(); };
    const interrupt = (): void => { interrupted = true; abort("https-interrupted"); };
    const onResponse = (incoming: ResponseLike): void => {
      if (response || settled) { fail("https-unexpected-response"); destroy(incoming); cleanup(); return; }
      response = incoming; statusCode = incoming.statusCode ?? null;
      incoming.on("error", () => { abort("https-response-error"); });
      incoming.once("aborted", () => { abort("https-response-aborted"); });
      incoming.once("close", () => { responseClosed = true; if (!responseEOF || !incoming.complete) abort("https-response-incomplete"); maybeDone(); });
      incoming.on("data", (value: unknown) => {
        if (!Buffer.isBuffer(value)) { abort("https-binary-stream-required"); return; }
        receivedBytes += value.length;
        const accepted = Math.max(0, Math.min(value.length, limits.response - retainedBytes));
        if (accepted > 0) { chunks.push(Buffer.from(value.subarray(0, accepted))); retainedBytes += accepted; }
        if (accepted !== value.length) abort("https-response-cap");
        if (elapsed() >= fetchMs - cleanupReserve || parentLeft() <= cleanupReserve) abort("https-deadline");
      });
      incoming.once("end", () => {
        responseEOF = true;
        if (!incoming.complete || !incoming.readableEnded) fail("https-response-incomplete");
        cleanup();
      });
      if (statusCode !== 200) abort(`https-status-${statusCode ?? "missing"}`);
    };
    process.on("SIGINT", interrupt); process.on("SIGTERM", interrupt);
    let watchdog: ReturnType<typeof setInterval> | undefined;
    let hardDeadline: ReturnType<typeof setTimeout> | undefined;
    try {
      need(Number.isFinite(fetchMs) && fetchMs > 0 && fetchMs <= limits.fetch && parentLeft() > cleanupReserve, "https-local-duration-required");
      hardDeadline = setTimeout(() => { fail("https-cleanup-deadline"); cleanup(); settled = true; resolveDone(); }, Math.max(0, fetchMs - Number(process.hrtime.bigint() - started) / 1e6));
      watchdog = setInterval(() => {
        const used = elapsed(), left = parentLeft();
        if (fault === "interrupt" && !interrupted) interrupt();
        if (used >= fetchMs - cleanupReserve || left <= cleanupReserve) abort("https-deadline");
      }, 5);
      requestCalls++;
      request = factory(requestOptions(oid), onResponse);
      factoryReturned = true;
      request.on("error", () => { abort("https-request-error"); });
      request.once("finish", () => { requestFinished = true; });
      request.once("close", () => { requestClosed = true; if (!responseEOF && failure === null) abort("https-request-premature-close"); maybeDone(); });
      request.on("socket", (owned: SocketLike) => {
        if (socket || settled) { fail("https-unexpected-socket"); destroy(owned); cleanup(); return; }
        socket = owned;
        owned.on("error", () => { abort("https-socket-error"); });
        owned.once("close", (hadError: boolean) => { socketClosed = true; if (hadError) fail("https-socket-close-error"); maybeDone(); });
        if (cleanupStarted) destroy(owned);
      });
      if (cleanupStarted) cleanup(); else request.end();
      await done;
    } catch (error) {
      factoryReturned = true; fail(error instanceof Error ? error.message : "https-request-construction-failed"); aborted = true; cleanup();
      if (!allClosed() && watchdog !== undefined) await done;
    }
    finally {
      if (watchdog !== undefined) clearInterval(watchdog);
      if (hardDeadline !== undefined) clearTimeout(hardDeadline);
      process.removeListener("SIGINT", interrupt); process.removeListener("SIGTERM", interrupt);
      if (!allClosed()) { cleanup(); if (!allClosed()) { cleanupFailed = true; fail("https-owned-cleanup-unconfirmed"); } }
    }
    const body = Buffer.concat(chunks);
    if (fault === "cleanup") { cleanupFailed = true; fail("https-synthetic-cleanup-failed"); }
    if (elapsed() >= fetchMs || parentLeft() <= 0 || fault === "transport-finalization-deadline") fail("https-finalization-deadline");
    const cleanupConfirmed = allClosed() && !cleanupFailed;
    const finalResponse = response as ResponseLike | null;
    if (failure === null && !(requestCalls === 1 && requestFinished && requestClosed && responseEOF && finalResponse?.complete && responseClosed && socketClosed && cleanupConfirmed && statusCode === 200)) fail("https-lifecycle-incomplete");
    return { body, requestCalls, receivedBytes, retainedBytes, statusCode, failure, requestFinished, requestClosed, responseEOF, responseComplete: finalResponse?.complete === true, responseClosed, socketClosed, cleanupConfirmed, aborted, interrupted };
  }
  function checkPins(pins: Pins): void {
    pinCheck(pins); need(/^[a-f0-9]{40}$/.test(pins.commitOid) && pins.packetPath === PACKET_PATH, "fixed-published-packet-required");
    need(Array.isArray(pins.fileTable) && pins.fileTable.length > 0 && pins.fileTable.length <= limits.files, "fixed-published-file-table-required");
  }
  function syntheticContext(options: Synthetic): string {
    need(options.scope === "OFFLINE_SYNTHETIC", "offline-synthetic-scope-required");
    const pattern = new RegExp(`^${HOSTROOT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/${R2}/delivery-verification-[1-9][0-9]{0,2}/fixtures/[a-z][a-z0-9-]{0,63}$`);
    need(pattern.test(options.fixtureRoot) && path.resolve(options.fixtureRoot) === options.fixtureRoot, "protected-fixture-root-required");
    ancestors(options.fixtureRoot);
    const marker = fs.lstatSync(path.join(options.fixtureRoot, "OFFLINE_SYNTHETIC.json"));
    need(marker.isFile() && !marker.isSymbolicLink() && fs.readFileSync(path.join(options.fixtureRoot, "OFFLINE_SYNTHETIC.json"), "utf8") === '{"scope":"OFFLINE_SYNTHETIC"}\n', "protected-fixture-marker-required");
    need(typeof options.requestFactory === "function", "fixture-only-fake-https-required");
    return path.join(options.fixtureRoot, "host");
  }
  async function runSynthetic(pins: Pins, options: Synthetic) { return run(pins, options); }
  async function runProduction(pins: Pins) {
    checkPins(pins); need(process.versions["bun"] === "1.4.0", "bun-1.4.0-required");
    need(blockers.length === 0, `PRODUCTION_DELIVERY_BLOCKED:${blockers.join(",")}`);
    return run(pins);
  }
  async function run(pins: Pins, synthetic?: Synthetic) {
    checkPins(pins); need(process.versions["bun"] === "1.4.0", "bun-1.4.0-required");
    const host = synthetic ? syntheticContext(synthetic) : HOSTROOT, handoff = path.join(host, HREL), snapshot = path.join(handoff, "snapshot"), evidence = path.join(handoff, "evidence");
    const scope = synthetic ? synthetic.scope : "EXECUTOR_MANUAL_OPERATOR_ONLY";
    const timer = clock(synthetic?.stageMs ?? limits.stageA, bootstrapEntryOrigin, synthetic?.fault);
    let claimed = false, sealed = false, fetched = false, stageB = false, failure: string | null = null;
    let fetchResult: Awaited<ReturnType<typeof fetchPacket>> | null = null, callerResult: Awaited<ReturnType<typeof runChild>> | null = null;
    const parents = [`_work/gpu-owner-recovery/runs/host-canonical-r4-source-1`, D, R2];
    const forbidden = ["_work/gpu-owner-recovery/cache/reference-package-inputs-2", `${D}/package-inputs-2`, `${R2}/acquisition-execution-1`];
    try {
      timer.check(); need(synthetic ? path.resolve(host) !== HOSTROOT : process.cwd() === HOSTROOT, "fixed-execution-root-required"); ancestors(path.join(host, "_work/gpu-owner-recovery/runs"));
      try { const cache = fs.lstatSync(path.join(host, "_work/gpu-owner-recovery/cache")); need(cache.isDirectory() && !cache.isSymbolicLink(), "fixed-cache-parent-invalid"); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
      for (const name of [HREL, ...forbidden]) absent(path.join(host, name));
      for (const relative of parents) {
        try { const stat = fs.lstatSync(path.join(host, relative)); need(stat.isDirectory() && !stat.isSymbolicLink(), "host-operation-parent-invalid"); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
      }
      timer.check(); fs.mkdirSync(handoff, { mode: 0o700 }); claimed = true; durableDirectory(handoff); durableDirectory(path.dirname(handoff));
      record(path.join(handoff, "handoff-claim.json"), { scope, approvalSha256: APPROVAL_SHA, launchBoundarySha256: BOUNDARY_SHA, transportAmendmentSha256: AMENDMENT_SHA, handoffAttemptsConsumed: 1, githubRequestSlots: 1, innerAttemptsConsumedByDelivery: 0 });
      freshDirectory(snapshot); freshDirectory(evidence); timer.check();
      fetched = true;
      const factory: RequestFactory = synthetic ? synthetic.requestFactory : (options, onResponse) => https.request(options, onResponse);
      fetchResult = await fetchPacket(pins.gitBlobOid, timer.remaining, factory, Math.min(synthetic?.fetchMs ?? limits.fetch, timer.remaining()), synthetic?.fault);
      need(fetchResult.failure === null && fetchResult.cleanupConfirmed && fetchResult.responseEOF, `github-https:${fetchResult.failure ?? "incomplete"}`);
      if (synthetic?.fault === "clock-after-fetch") timer.invalidate();
      timer.check();
      const packet = parseResponse(fetchResult.body, pins), verified = validatePacket(packet, pins, pins.fileTable); timer.check();
      for (const directory of verified.directories) {
        if (directory === "" || directory === OBSERVER) continue;
        freshDirectory(path.join(snapshot, directory)); timer.check();
      }
      for (const [relative, bytes] of verified.files) { timer.check(); writeExclusive(path.join(snapshot, relative), bytes, 0o400, synthetic?.fault === "file-close" ? synthetic.fault : undefined); }
      timer.check();
      for (const directory of [...verified.directories].reverse()) {
        if (directory === OBSERVER) continue;
        const absolute = path.join(snapshot, directory);
        durableDirectory(absolute, synthetic?.fault); timer.check();
      }
      need(synthetic?.fault !== "seal-deadline", "stage-a-seal-deadline");
      sealed = true;
      for (const relative of parents) {
        timer.check(); const absolute = path.join(host, relative);
        try { const stat = fs.lstatSync(absolute); need(stat.isDirectory() && !stat.isSymbolicLink(), "host-operation-parent-invalid"); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; freshDirectory(absolute); }
      }
      timer.finalizing(); timer.check();
      record(path.join(evidence, "transfer-receipt.json"), { status: "SEALED_STAGE_A_CANDIDATE_NOT_DELIVERY_SUCCESS", scope, packet: identity(packet), files: verified.files.size, aggregateSourceBytes: verified.aggregateBytes, snapshotDirectoriesIncludingObserver: verified.directories.length, approvalSha256: APPROVAL_SHA, launchBoundarySha256: BOUNDARY_SHA, transportAmendmentSha256: AMENDMENT_SHA, httpsRequestCalls: fetchResult.requestCalls, httpsStatusCode: fetchResult.statusCode, httpsResponseBytes: fetchResult.receivedBytes, httpsRetainedBytes: fetchResult.retainedBytes, httpsResponseEOF: true, httpsOwnedCleanupConfirmed: true, innerAttemptsConsumedByDelivery: 0 }, synthetic?.fault === "receipt-close" ? synthetic.fault : undefined);
      durableDirectory(evidence); timer.check();
      stageB = true;
      callerResult = await runChild({ executable: process.execPath, args: ["--no-env-file", "--no-install", path.join(snapshot, CALLER), "execute"], cwd: snapshot, env: { LANG: "C", LC_ALL: "C", TZ: "UTC" }, stdoutCap: 65536, stderrCap: 65536, remainingMs: () => Number.MAX_SAFE_INTEGER, workMs: Number.MAX_SAFE_INTEGER, cleanupMs: 2000, deadlineOwner: "INNER_CALLER" });
      need(callerResult.failure === null, `caller-child:${callerResult.failure}`);
    } catch (error) { failure = error instanceof Error ? error.message : "delivery-failed"; }
    if (claimed) {
      try { record(path.join(handoff, "delivery-outcome.json"), { status: failure === null ? "OBSERVATION_REQUIRES_SUCCESSFUL_FINAL_CLOSE" : "FAIL_PRESERVE_PARTIALS", scope, failure, claimed, fetched, sealed, stageB, innerAttemptsConsumedByDelivery: 0, sourceRequest: fetchResult && { requestCalls: fetchResult.requestCalls, statusCode: fetchResult.statusCode, receivedBytes: fetchResult.receivedBytes, responseEOF: fetchResult.responseEOF, requestClosed: fetchResult.requestClosed, responseClosed: fetchResult.responseClosed, socketClosed: fetchResult.socketClosed, cleanupConfirmed: fetchResult.cleanupConfirmed, failure: fetchResult.failure }, callerChild: callerResult && { ...callerResult, stdout: identity(callerResult.stdout), stderr: identity(callerResult.stderr) } }); }
      catch { failure ??= "durable-outcome-failed"; }
    }
    return { failure, claimed, fetched, sealed, stageB, handoff, snapshot, evidence, fetchResult, callerResult };
  }
  return { constants: { D, R2, HOSTROOT, HREL, CALLER, OBSERVER, PACKET_PATH, APPROVAL_SHA, BOUNDARY_PATH, BOUNDARY_SHA, AMENDMENT_PATH, AMENDMENT_SHA, fixedInputs, bindings, limits, blockers }, need: (value: unknown, reason: string): void => need(value, reason), hash, blob, identity, safePath: (value: unknown): void => safePath(value), text, decode, directories, validatePacket, parseResponse, verifyApproval, ancestors, absent, writeExclusive, freshDirectory, durableDirectory, record, clock, createPipeCleanup, runChild, requestOptions, checkPins, runSynthetic, runProduction };
}

export type DeliveryRuntime = Awaited<ReturnType<typeof createDeliveryRuntime>>;
export type DeliveryPins = Parameters<DeliveryRuntime["checkPins"]>[0];
export type DeliveryFileBinding = DeliveryPins["fileTable"][number];
export type DeliverySyntheticOptions = Parameters<DeliveryRuntime["runSynthetic"]>[1];
export type DeliveryRequestFactory = DeliverySyntheticOptions["requestFactory"];
