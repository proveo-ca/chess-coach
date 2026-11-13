# OFFLINE_SYNTHETIC_NONRUNNING: syntax fixture only; no publication pins or operator command.
exit 1
begin
  set -lx MISE_AUTO_INSTALL false
  set -lx MISE_TASK_RUN_AUTO_INSTALL false
  set -lx MISE_EXEC_AUTO_INSTALL false
  test (pwd -P) = '/home/gu1lty/Projects/proveo/chess-coach'; or exit 1
  command mise exec core:bun@1.4.0 -- bun --no-env-file --no-install --eval '(async function createDeliveryRuntime() {
  const bootstrapEntryOrigin = process.hrtime.bigint(), fs = await import("node:fs"), path = await import("node:path"), crypto = await import("node:crypto"), cp = await import("node:child_process"), https = await import("node:https"), fixedInputs = [
    ["_work/gpu-owner-recovery/verify.ts", "9831b75035a5d832c6d86608b7d561821ee1a4c6dec8d2a7ecd31fbca55d5f58"],
    ["_work/gpu-owner-recovery/command-supervisor.ts", "88e56077c3bcddf722f81081a0cb7c6f94d1da106add486dbf13a92d165fb9c6"],
    ["_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/local-inputs-1/inputs/reference/pnpm-lock.yaml", "1d05ed3d8de5a94873f26a2fb51b88c080704d2e90bf942f9f0bb2ce75a504e0"]
  ], bindings = [
    ["acquisitionRequest", "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/request.json", "c0288e1e34e24d2f7a81e12ee1967ffafbd2768b4c2a5bc2ba15826b6384ff3f"],
    ["acquisitionPlan", "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/plan.json", "7f6a90ca105d6a7c5a45951b508d4a1ecdd5e217625d1cefe08da23557847405"],
    ["manualHandoffRequest", "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/manual-handoff-request1.json", "47d63b8cb446cdc8a83323788c9106cdb82437992e7bd3a88f55821aa6bde52b"],
    ["manualHandoffPlan", "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/manual-handoff-plan1.json", "4297e4f1b763b5aa152b88a7a3e288a19cafc85331cbed2d776f38d043f8817a"]
  ], limits = { files: 96, file: 1048576, source: 6291456, packet: 8388608, response: 12582912, directories: 256, stageA: 120000, fetch: 30000, stderr: 65536 }, blockers = [];
  function need(value, reason) {
    if (!value)
      throw Error(reason);
  }
  function object(value) {
    need(value !== null && typeof value === "object" && !Array.isArray(value), "object-required");
    return value;
  }
  function hash(bytes) {
    return crypto.createHash("sha256").update(bytes).digest("hex");
  }
  function blob(bytes) {
    return crypto.createHash("sha1").update(`blob ${bytes.length}\\x00`).update(bytes).digest("hex");
  }
  function identity(bytes) {
    return { bytes: bytes.length, sha256: hash(bytes), gitBlobOid: blob(bytes) };
  }
  function safePath(value) {
    need(typeof value === "string" && value.length > 0 && value.length <= 1024 && /^[A-Za-z0-9_.\\/-]+$/.test(value), "canonical-relative-path");
    const parts = value.split("/");
    need(parts.every((p) => p !== "" && p !== "." && p !== ".."), "canonical-relative-path");
    need(!parts.some((p) => /^(?:cache|archives?|node_modules|\\.git|native|compiler-output|__pycache__|failed-full1|halted-llvm|reference-package-inputs-[12]|package-inputs-[12]|acquisition-execution-\\d+|acquisition-invocation-\\d+|reference-package-handoff-\\d+)$/i.test(p)), "prohibited-packet-root");
    need(/\\.(?:ts|json|jsonl|yaml|yml|md|puml|stdout|stderr)$/.test(value) || value === "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-bun-source2/.gitignore", "text-source-extension");
    need(value !== "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/source-packet1.json", "packet-self-membership-forbidden");
  }
  function text(bytes) {
    const decoded = new TextDecoder("utf-8", { fatal: !0 }).decode(bytes);
    need(!/[\\x00-\\x08\\x0b\\x0c\\x0e-\\x1f\\x7f]/.test(decoded), "text-only-source");
    need(Buffer.from(decoded).equals(Buffer.from(bytes)), "canonical-utf8");
    return decoded;
  }
  function decode(value, maximum, wrapped = !1) {
    need(typeof value === "string" && value.length <= Math.ceil(maximum / 3) * 4 + (wrapped ? Math.ceil(maximum / 45) * 2 + 2 : 0), "base64-size-cap");
    need(!wrapped || /^[A-Za-z0-9+/=\\r\\n]*$/.test(value), "base64-encoding");
    const canonical = wrapped ? value.replace(/[\\r\\n]/g, "") : value;
    need(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(canonical), "base64-encoding");
    const bytes = Buffer.from(canonical, "base64");
    need(bytes.length <= maximum && bytes.toString("base64") === canonical, "canonical-base64");
    return bytes;
  }
  function directories(paths) {
    const found = new Set([""]);
    for (const member of [...paths, "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/acquisition-invocation-1/placeholder"]) {
      let parent = path.posix.dirname(member);
      while (parent !== ".") {
        found.add(parent);
        parent = path.posix.dirname(parent);
      }
    }
    need(found.size <= limits.directories, "snapshot-directory-cap");
    return [...found].sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b));
  }
  function pinCheck(value) {
    need(Number.isSafeInteger(value.bytes) && value.bytes > 0 && value.bytes <= limits.packet && /^[0-9a-f]{64}$/.test(value.sha256) && /^[0-9a-f]{40}$/.test(value.gitBlobOid), "literal-byte-binding-required");
  }
  function match(bytes, expected) {
    need(bytes.length === expected.bytes && hash(bytes) === expected.sha256 && blob(bytes) === expected.gitBlobOid, "length-sha256-git-blob-mismatch");
  }
  function verifyApproval(files) {
    const approval = files.get("_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/approval2.json");
    need(approval && hash(approval) === "4e68d36f8076e213744364cf4cd5f793ef3dbffda6157b93070edf2ffc282d3f", "genuine-approval-sha256");
    const row = object(JSON.parse(text(approval))), bound = object(row.bindings);
    need(row.status === "APPROVED_AT_ISSUANCE_NOT_EXECUTED" && row.manualHandoffGrantId === "reference-package-manual-host-handoff-2" && row.archiveGrantId === "reference-two-package-source-acquisition-2", "composite-approval-row");
    for (const [key, name, sha256] of bindings) {
      const item = object(bound[key]), content = files.get(name);
      need(item.path === name && item.sha256 === sha256 && content && hash(content) === sha256, "four-immutable-approval-bindings");
    }
    const boundaryBytes = files.get("_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/manual-launch-boundary-selection1.json");
    need(boundaryBytes && hash(boundaryBytes) === "44aa077f7db10d3bc3a462da355198973a6f2afba29b7745d4c2bba53f94cdc5", "genuine-launch-boundary-sha256");
    const boundary = object(JSON.parse(text(boundaryBytes)));
    need(boundary.status === "EXECUTOR_CONFIRMED_BOOTSTRAP_CLOCK_BOUNDARY" && object(boundary.approval).sha256 === "4e68d36f8076e213744364cf4cd5f793ef3dbffda6157b93070edf2ffc282d3f" && object(boundary.manualPlan).sha256 === bindings[3][2], "launch-boundary-bindings");
    const amendmentBytes = files.get("_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/manual-source-transport-amendment1.json");
    need(amendmentBytes && hash(amendmentBytes) === "f53b4985052f242a453d24e1bcccde47d1589288952543ea0a5b7d5756291918", "genuine-transport-amendment-sha256");
    const amendment = object(JSON.parse(text(amendmentBytes)));
    need(amendment.status === "EXECUTOR_APPROVED_ANONYMOUS_SINGLE_HTTPS_REQUEST" && amendment.additionalAttemptsOrRequestsGranted === 0, "transport-amendment-row");
    for (const [key, name, sha256] of [["approval", "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/approval2.json", "4e68d36f8076e213744364cf4cd5f793ef3dbffda6157b93070edf2ffc282d3f"], ["manualRequest", bindings[2][1], bindings[2][2]], ["manualPlan", bindings[3][1], bindings[3][2]], ["launchBoundary", "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/manual-launch-boundary-selection1.json", "44aa077f7db10d3bc3a462da355198973a6f2afba29b7745d4c2bba53f94cdc5"]]) {
      const item = object(amendment[key]);
      need(item.path === name && item.sha256 === sha256, "transport-amendment-bindings");
    }
  }
  function validatePacket(bytes, expected, table) {
    pinCheck(expected);
    need(bytes.length <= limits.packet, "packet-byte-cap");
    match(bytes, expected);
    need(table.length > 0 && table.length <= limits.files, "literal-file-table-count");
    const envelope = object(JSON.parse(text(bytes)));
    need(envelope.version === "chess-coach.literal-text-packet.v1" && envelope.kind === "FIXED_LITERAL_TEXT_FILE_TABLE_NOT_A_RESOLVER", "literal-packet-envelope");
    need(Object.keys(envelope).sort().join(",") === "aggregateBytes,directories,files,kind,version", "packet-envelope-fields");
    const rows = envelope.files;
    need(Array.isArray(rows) && rows.length === table.length, "literal-file-table-count");
    const files = new Map, expectedNames = new Set;
    let aggregate = 0;
    for (const entry of table) {
      safePath(entry.path);
      need(!expectedNames.has(entry.path), "duplicate-literal-member");
      expectedNames.add(entry.path);
    }
    for (let index = 0;index < rows.length; index++) {
      const row = object(rows[index]), wanted = table[index];
      safePath(row.path);
      need(Object.keys(row).sort().join(",") === "base64,bytes,gitBlobOid,path,sha256", "file-row-fields");
      need(!files.has(row.path), "duplicate-packet-member");
      need(row.path === wanted.path && row.bytes === wanted.bytes && row.sha256 === wanted.sha256 && row.gitBlobOid === wanted.gitBlobOid, "fixed-literal-table-mismatch");
      need(Number.isSafeInteger(row.bytes) && Number(row.bytes) >= 0 && Number(row.bytes) <= limits.file, "file-byte-cap");
      const content = decode(row.base64, limits.file);
      text(content);
      match(content, wanted);
      aggregate += content.length;
      need(aggregate <= limits.source, "aggregate-source-cap");
      files.set(row.path, content);
    }
    const dirs = directories([...files.keys()]);
    need(envelope.aggregateBytes === aggregate && JSON.stringify(envelope.directories) === JSON.stringify(dirs), "packet-total-or-directory-table");
    need(files.has("_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/invoke-approved-bun.ts"), "required-fixed-closure-member");
    for (const [member, sha256] of fixedInputs)
      need(files.has(member) && hash(files.get(member)) === sha256, "unchanged-helpers-and-lock-required");
    verifyApproval(files);
    return { files, directories: dirs, aggregateBytes: aggregate };
  }
  function parseResponse(bytes, pins) {
    need(bytes.length <= limits.response, "github-response-cap");
    const response = object(JSON.parse(text(bytes)));
    need(response.encoding === "base64" && response.sha === pins.gitBlobOid && response.size === pins.bytes, "github-blob-response-identity");
    const packet = decode(response.content, limits.packet, !0);
    match(packet, pins);
    return packet;
  }
  function ancestors(directory) {
    const all = [];
    for (let current = path.resolve(directory);; current = path.dirname(current)) {
      all.push(current);
      if (path.dirname(current) === current)
        break;
    }
    for (const current of all.reverse()) {
      const stat = fs.lstatSync(current);
      need(stat.isDirectory() && !stat.isSymbolicLink(), "existing-nonsymlink-ancestor-required");
    }
  }
  function absent(name) {
    try {
      fs.lstatSync(name);
      throw Error("fresh-path-required");
    } catch (error) {
      if (error.code !== "ENOENT")
        throw error;
    }
  }
  function durableDirectory(directory, fault) {
    const fd = fs.openSync(directory, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
    let failed;
    try {
      fs.fsyncSync(fd);
    } catch (error) {
      failed = error;
    }
    try {
      fs.closeSync(fd);
      if (fault === "directory-close")
        throw Error("synthetic-directory-close");
    } catch (error) {
      failed ??= error;
    }
    if (failed)
      throw failed;
  }
  function freshDirectory(directory) {
    ancestors(path.dirname(directory));
    fs.mkdirSync(directory, { mode: 448 });
    durableDirectory(directory);
    durableDirectory(path.dirname(directory));
  }
  function writeExclusive(name, bytes, mode = 256, fault) {
    ancestors(path.dirname(name));
    const fd = fs.openSync(name, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, mode);
    let failed;
    try {
      fs.writeFileSync(fd, bytes);
      fs.fsyncSync(fd);
    } catch (error) {
      failed = error;
    }
    try {
      fs.closeSync(fd);
      if (fault === "file-close" || fault === "receipt-close")
        throw Error(`synthetic-${fault}`);
    } catch (error) {
      failed ??= error;
    }
    try {
      durableDirectory(path.dirname(name));
    } catch (error) {
      failed ??= error;
    }
    if (failed)
      throw failed;
  }
  function record(name, value, fault) {
    const bytes = Buffer.from(JSON.stringify(value, null, 2) + `
`);
    need(bytes.length <= 65536, "receipt-byte-cap");
    writeExclusive(name, bytes, 256, fault);
  }
  function clock(budget, origin = bootstrapEntryOrigin, fault) {
    need(Number.isFinite(budget) && budget > 0 && budget <= limits.stageA, "bounded-process-local-budget-required");
    let previous = origin, sticky = !1, finalizing = !1;
    const remaining = () => {
      const now = process.hrtime.bigint();
      if (fault === "clock" || now < previous)
        sticky = !0;
      previous = now;
      need(!sticky, "stage-a-clock-failure");
      const left = budget - Number(now - origin) / 1e6;
      if (finalizing && fault === "finalization-deadline")
        return -1;
      return left;
    };
    return { remaining, check: () => need(remaining() > 0, "stage-a-deadline"), finalizing: () => {
      finalizing = !0;
    }, invalidate: () => {
      sticky = !0;
    } };
  }
  function createPipeCleanup() {
    const empty = () => ({ present: null, attempts: 0, confirmed: !1, destroyed: null, failed: !1, firstFailure: null, getterErrors: 0, destroyErrors: 0, streamErrors: 0, stateErrors: 0 }), states = { stdout: empty(), stderr: empty() };
    let cleanupCalls = 0;
    const increment = (value) => Math.min(Number.MAX_SAFE_INTEGER, value + 1);
    function mark(name, counter, reason) {
      const state = states[name];
      state.failed = !0;
      state.firstFailure ??= reason;
      state[counter] = increment(state[counter]);
    }
    function inspect(name, pipe) {
      const state = states[name];
      try {
        const value = pipe.destroyed;
        if (typeof value !== "boolean")
          throw Error("invalid-pipe-state");
        state.destroyed = value;
        state.confirmed = value;
        return value;
      } catch {
        state.destroyed = null;
        state.confirmed = !1;
        mark(name, "getterErrors", `${name}-pipe-state-unknown`);
        return null;
      }
    }
    function report() {
      return { cleanupCalls, destructionAttempted: states.stdout.attempts > 0 || states.stderr.attempts > 0, pipesDestroyed: states.stdout.confirmed && states.stderr.confirmed, cleanupFailed: states.stdout.failed || states.stderr.failed, stdout: { ...states.stdout }, stderr: { ...states.stderr } };
    }
    function attempt(stdout, stderr) {
      cleanupCalls = increment(cleanupCalls);
      for (const [name, pipe] of [["stdout", stdout], ["stderr", stderr]]) {
        const state = states[name];
        state.present = pipe !== null && pipe !== void 0;
        if (!pipe) {
          state.destroyed = null;
          state.confirmed = !1;
          continue;
        }
        if (inspect(name, pipe) === !0)
          continue;
        state.attempts = increment(state.attempts);
        try {
          pipe.destroy();
        } catch {
          mark(name, "destroyErrors", `${name}-pipe-destroy-failed`);
        }
        if (inspect(name, pipe) !== !0)
          mark(name, "stateErrors", `${name}-pipe-destroy-unconfirmed`);
      }
      return report();
    }
    return { attempt, report, noteError: (name) => mark(name, "streamErrors", `${name}-pipe-error`) };
  }
  async function runChild(spec) {
    const stdout = [], stderr = [];
    let outBytes = 0, errBytes = 0, exitCode = null, signal = null, reaped = !1, closed = !1, outEOF = !1, errEOF = !1, failure = null, interrupted = !1, child, spawned = !1, pid = null, spawnError = !1, spawnAttemptCompleted = !1, spawnAttempted = !1, started = null, previous = null, cleanupOrigin = null, cleanupStarted = !1, cleanupReason = null, cleanupOriginElapsedMs = null, cleanupOriginsStarted = 0, cleanupExpired = !1, cleanupClockFailed = !1, signalFailure = !1;
    const pipeCleanup = createPipeCleanup();
    let processGroupGone = null, cancellationSignal = null, settled = !1;
    const signalAttempts = [], attempted = new Set;
    let watchdog, cleanupTimer, killTimer, doneResolve;
    const done = new Promise((resolve) => {
      doneResolve = resolve;
    });
    function sample() {
      try {
        const now = process.hrtime.bigint();
        if (previous !== null && now < previous || spec.syntheticFault === "child-clock")
          throw Error("clock");
        previous = now;
        return now;
      } catch {
        cleanupClockFailed = !0;
        failure ??= "child-clock-failure";
        return null;
      }
    }
    function finish() {
      if (!settled) {
        settled = !0;
        doneResolve();
      }
    }
    function destroyPipes() {
      const pipes = pipeCleanup.attempt(child?.stdout, child?.stderr);
      if (pipes.cleanupFailed)
        failure ??= pipes.stdout.firstFailure ?? pipes.stderr.firstFailure ?? "pipe-cleanup-failed";
    }
    function send(target, sig) {
      if (pid === null || attempted.has(`${target}:${sig}`))
        return;
      attempted.add(`${target}:${sig}`);
      try {
        const delivered = target === "GROUP" ? process.kill(-pid, sig) : child?.kill(sig);
        signalAttempts.push({ target, signal: sig, result: delivered === !0 ? "SENT" : "NOT_DELIVERED" });
        if (delivered !== !0) {
          signalFailure = !0;
          failure ??= "owned-signal-not-delivered";
        }
      } catch {
        signalAttempts.push({ target, signal: sig, result: "THREW" });
        signalFailure = !0;
        failure ??= "owned-signal-threw";
      }
    }
    function terminate() {
      send("GROUP", "SIGTERM");
      if (killTimer === void 0 && !settled)
        killTimer = setTimeout(() => {
          send("GROUP", "SIGKILL");
        }, 50);
    }
    function startCleanup(reason) {
      if (cleanupStarted)
        return;
      cleanupStarted = !0;
      cleanupReason = reason;
      cleanupOriginsStarted++;
      cleanupOrigin = sample();
      if (cleanupOrigin !== null && started !== null)
        cleanupOriginElapsedMs = Number(cleanupOrigin - started) / 1e6;
      cleanupTimer = setTimeout(() => {
        cleanupExpired = !0;
        failure ??= "child-cleanup-deadline";
        send("GROUP", "SIGTERM");
        send("GROUP", "SIGKILL");
        destroyPipes();
        finish();
      }, spec.cleanupMs);
    }
    function fail(reason) {
      failure ??= reason;
      startCleanup("FAILURE");
      terminate();
    }
    function groupGone() {
      if (pid === null)
        return null;
      try {
        if (process.kill(-pid, 0) !== !0) {
          fail("owned-process-group-check-failed");
          return null;
        }
        return !1;
      } catch (error) {
        if (error.code === "ESRCH")
          return !0;
        fail("owned-process-group-check-failed");
        return null;
      }
    }
    function observe() {
      if (settled)
        return;
      if (spawnAttemptCompleted && !spawned && (spawnError || !spawnAttempted)) {
        destroyPipes();
        finish();
        return;
      }
      if (reaped && (!closed || !outEOF || !errEOF))
        startCleanup("POST_EXIT_DRAIN");
      if (reaped && closed && outEOF && errEOF) {
        processGroupGone = groupGone();
        if (processGroupGone === !0)
          finish();
        else
          fail("owned-process-group-remains-or-unconfirmed");
      }
    }
    function interrupt(sig) {
      if (interrupted)
        return;
      interrupted = !0;
      cancellationSignal = sig;
      failure ??= "delivery-interrupted";
      startCleanup("FAILURE");
      send("CHILD", sig);
      terminate();
      observe();
    }
    const onInt = () => interrupt("SIGINT"), onTerm = () => interrupt("SIGTERM"), onHup = () => interrupt("SIGHUP");
    process.on("SIGINT", onInt);
    process.on("SIGTERM", onTerm);
    process.on("SIGHUP", onHup);
    try {
      need(Number.isFinite(spec.workMs) && spec.workMs > 0 && Number.isFinite(spec.cleanupMs) && spec.cleanupMs >= 0 && spec.cleanupMs <= 2000, "child-local-duration-required");
      started = sample();
      if (started === null)
        throw Error("child-clock-failure");
      if (spec.deadlineOwner !== "INNER_CALLER")
        need(spec.remainingMs() > 0, "child-parent-duration-required");
      watchdog = setInterval(() => {
        const now = sample();
        if (now === null)
          fail("child-clock-failure");
        if (spec.syntheticFault === "interrupt" && !interrupted)
          interrupt("SIGINT");
        if (spec.deadlineOwner !== "INNER_CALLER")
          try {
            if (now !== null && started !== null && Number(now - started) / 1e6 >= spec.workMs)
              fail("child-deadline");
            if (spec.remainingMs() <= spec.cleanupMs)
              fail("child-deadline");
          } catch {
            cleanupClockFailed = !0;
            fail("parent-clock-failure");
          }
        if (failure !== null) {
          startCleanup("FAILURE");
          terminate();
        }
        observe();
      }, 5);
      spawnAttempted = !0;
      child = cp.spawn(spec.executable, spec.args, { cwd: spec.cwd, env: spec.env, detached: !0, shell: !1, stdio: ["ignore", "pipe", "pipe"] });
      spawnAttemptCompleted = !0;
      if (typeof child.pid === "number") {
        spawned = !0;
        pid = child.pid;
      }
      need(child.stdout && child.stderr, "owned-child-pipes-required");
      const collect = (data, isOut) => {
        const current = isOut ? outBytes : errBytes, cap = isOut ? spec.stdoutCap : spec.stderrCap, accepted = Math.max(0, Math.min(data.length, cap - current));
        if (accepted)
          (isOut ? stdout : stderr).push(Buffer.from(data.subarray(0, accepted)));
        if (isOut)
          outBytes += accepted;
        else
          errBytes += accepted;
        if (accepted !== data.length)
          fail(isOut ? "child-stdout-cap" : "child-stderr-cap");
      };
      child.stdout.on("data", (data) => collect(data, !0));
      child.stderr.on("data", (data) => collect(data, !1));
      child.stdout.once("end", () => {
        outEOF = !0;
        observe();
      });
      child.stderr.once("end", () => {
        errEOF = !0;
        observe();
      });
      child.stdout.once("error", () => {
        pipeCleanup.noteError("stdout");
        fail("stdout-pipe-error");
      });
      child.stderr.once("error", () => {
        pipeCleanup.noteError("stderr");
        fail("stderr-pipe-error");
      });
      child.once("spawn", () => {
        spawned = !0;
        pid = child?.pid ?? pid;
      });
      child.once("error", () => {
        spawnError = !spawned && pid === null;
        fail(spawnError ? "child-spawn-error" : "child-process-error");
        observe();
      });
      child.once("exit", (code, sig) => {
        exitCode = code;
        signal = sig;
        reaped = !0;
        if (code !== 0 || sig !== null)
          fail("child-nonzero-or-signal");
        observe();
      });
      child.once("close", () => {
        closed = !0;
        observe();
      });
      await done;
    } catch (error) {
      spawnAttemptCompleted = !0;
      spawnError = spawnAttempted && !spawned && pid === null;
      fail(error instanceof Error ? error.message : "child-failure");
      observe();
      if (!settled)
        await done;
    } finally {
      if (watchdog !== void 0)
        clearInterval(watchdog);
      if (cleanupTimer !== void 0)
        clearTimeout(cleanupTimer);
      if (killTimer !== void 0)
        clearTimeout(killTimer);
      process.removeListener("SIGINT", onInt);
      process.removeListener("SIGTERM", onTerm);
      process.removeListener("SIGHUP", onHup);
      if (!reaped || !closed || !outEOF || !errEOF) {
        failure ??= "owned-child-reap-or-eof-unconfirmed";
        send("GROUP", "SIGKILL");
        destroyPipes();
      }
    }
    const stdoutBuffer = Buffer.concat(stdout), stderrBuffer = Buffer.concat(stderr), finalNow = sample();
    if (finalNow === null)
      failure ??= "child-clock-failure";
    if (cleanupOrigin !== null && finalNow !== null && Number(finalNow - cleanupOrigin) / 1e6 >= spec.cleanupMs) {
      cleanupExpired = !0;
      failure ??= "child-cleanup-deadline";
    }
    if (spec.deadlineOwner !== "INNER_CALLER")
      try {
        if (spec.remainingMs() <= 0)
          failure ??= "child-finalization-deadline";
      } catch {
        cleanupClockFailed = !0;
        failure ??= "parent-clock-failure";
      }
    if (spec.syntheticFault === "cleanup")
      failure ??= "synthetic-cleanup-failed";
    if (spec.syntheticFault === "child-finalization-deadline")
      failure ??= "child-finalization-deadline";
    const pipeDestruction = pipeCleanup.report(), pipesDestroyed = pipeDestruction.pipesDestroyed, pipeDestructionAttempted = pipeDestruction.destructionAttempted, pipeCleanupFailed = pipeDestruction.cleanupFailed, cleanupConfirmed = spawned && reaped && closed && outEOF && errEOF && processGroupGone === !0 && !cleanupExpired && !cleanupClockFailed && pipeDestruction.cleanupCalls === 0 && !pipeCleanupFailed && !signalFailure && spec.syntheticFault !== "cleanup";
    if (failure === null && (!cleanupConfirmed || exitCode !== 0 || signal !== null))
      failure = "child-lifecycle-incomplete";
    return { stdout: stdoutBuffer, stderr: stderrBuffer, spawnAttempted, spawned, pid, spawnError, noChildCreated: !spawned && pid === null && (spawnError || !spawnAttempted), exitCode, signal, reaped, closed, outEOF, errEOF, failure, interrupted, cancellationSignal, cleanupStarted, cleanupReason, cleanupOriginElapsedMs, cleanupOriginsStarted, cleanupBudgetMs: spec.cleanupMs, cleanupExpired, cleanupClockFailed, pipesDestroyed, pipeDestructionAttempted, pipeCleanupFailed, pipeDestruction, processGroupGone, cleanupConfirmed, descendantsConfirmedGone: !1, signalFailure, signalAttempts };
  }
  function requestOptions(oid) {
    need(/^[a-f0-9]{40}$/.test(oid), "committed-git-blob-pin-required");
    return { protocol: "https:", hostname: "api.github.com", port: 443, path: `/repos/proveo-ca/chess-coach/git/blobs/${oid}`, method: "GET", agent: !1, headers: { Accept: "application/vnd.github+json", "User-Agent": "chess-coach-reference-package-handoff-2", Connection: "close", "Accept-Encoding": "identity" } };
  }
  async function fetchPacket(oid, remainingMs, factory, fetchMs, fault) {
    const started = process.hrtime.bigint();
    let previous = started;
    const chunks = [];
    let request = null, response = null, socket = null, requestCalls = 0, receivedBytes = 0, retainedBytes = 0, statusCode = null, failure = null, requestFinished = !1, requestClosed = !1, responseEOF = !1, responseClosed = !1, socketClosed = !1, cleanupStarted = !1, cleanupFailed = !1, aborted = !1, settled = !1, interrupted = !1, factoryReturned = !1;
    const destroyAttempted = new Set;
    let resolveDone;
    const done = new Promise((resolve) => {
      resolveDone = resolve;
    }), cleanupReserve = Math.min(2000, fetchMs / 4), fail = (reason) => {
      failure ??= reason;
    }, elapsed = () => {
      try {
        const now = process.hrtime.bigint();
        if (now < previous || fault === "transport-clock")
          throw Error("clock");
        previous = now;
        return Number(now - started) / 1e6;
      } catch {
        fail("https-clock-failure");
        return Number.POSITIVE_INFINITY;
      }
    }, parentLeft = () => {
      try {
        return remainingMs();
      } catch {
        fail("https-parent-clock-failure");
        return -1;
      }
    }, destroy = (resource) => {
      if (!resource || destroyAttempted.has(resource))
        return;
      destroyAttempted.add(resource);
      try {
        resource.destroy();
      } catch {
        cleanupFailed = !0;
        fail("https-owned-destroy-failed");
      }
    }, allClosed = () => (!request || requestClosed) && (!response || responseClosed) && (!socket || socketClosed), maybeDone = () => {
      if (factoryReturned && cleanupStarted && allClosed()) {
        settled = !0;
        resolveDone();
      }
    }, cleanup = () => {
      cleanupStarted = !0;
      destroy(response);
      destroy(request);
      destroy(socket);
      maybeDone();
    }, abort = (reason) => {
      fail(reason);
      aborted = !0;
      cleanup();
    }, interrupt = () => {
      interrupted = !0;
      abort("https-interrupted");
    }, onResponse = (incoming) => {
      if (response || settled) {
        fail("https-unexpected-response");
        destroy(incoming);
        cleanup();
        return;
      }
      response = incoming;
      statusCode = incoming.statusCode ?? null;
      incoming.on("error", () => {
        abort("https-response-error");
      });
      incoming.once("aborted", () => {
        abort("https-response-aborted");
      });
      incoming.once("close", () => {
        responseClosed = !0;
        if (!responseEOF || !incoming.complete)
          abort("https-response-incomplete");
        maybeDone();
      });
      incoming.on("data", (value) => {
        if (!Buffer.isBuffer(value)) {
          abort("https-binary-stream-required");
          return;
        }
        receivedBytes += value.length;
        const accepted = Math.max(0, Math.min(value.length, limits.response - retainedBytes));
        if (accepted > 0) {
          chunks.push(Buffer.from(value.subarray(0, accepted)));
          retainedBytes += accepted;
        }
        if (accepted !== value.length)
          abort("https-response-cap");
        if (elapsed() >= fetchMs - cleanupReserve || parentLeft() <= cleanupReserve)
          abort("https-deadline");
      });
      incoming.once("end", () => {
        responseEOF = !0;
        if (!incoming.complete || !incoming.readableEnded)
          fail("https-response-incomplete");
        cleanup();
      });
      if (statusCode !== 200)
        abort(`https-status-${statusCode ?? "missing"}`);
    };
    process.on("SIGINT", interrupt);
    process.on("SIGTERM", interrupt);
    let watchdog, hardDeadline;
    try {
      need(Number.isFinite(fetchMs) && fetchMs > 0 && fetchMs <= limits.fetch && parentLeft() > cleanupReserve, "https-local-duration-required");
      hardDeadline = setTimeout(() => {
        fail("https-cleanup-deadline");
        cleanup();
        settled = !0;
        resolveDone();
      }, Math.max(0, fetchMs - Number(process.hrtime.bigint() - started) / 1e6));
      watchdog = setInterval(() => {
        const used = elapsed(), left = parentLeft();
        if (fault === "interrupt" && !interrupted)
          interrupt();
        if (used >= fetchMs - cleanupReserve || left <= cleanupReserve)
          abort("https-deadline");
      }, 5);
      requestCalls++;
      request = factory(requestOptions(oid), onResponse);
      factoryReturned = !0;
      request.on("error", () => {
        abort("https-request-error");
      });
      request.once("finish", () => {
        requestFinished = !0;
      });
      request.once("close", () => {
        requestClosed = !0;
        if (!responseEOF && failure === null)
          abort("https-request-premature-close");
        maybeDone();
      });
      request.on("socket", (owned) => {
        if (socket || settled) {
          fail("https-unexpected-socket");
          destroy(owned);
          cleanup();
          return;
        }
        socket = owned;
        owned.on("error", () => {
          abort("https-socket-error");
        });
        owned.once("close", (hadError) => {
          socketClosed = !0;
          if (hadError)
            fail("https-socket-close-error");
          maybeDone();
        });
        if (cleanupStarted)
          destroy(owned);
      });
      if (cleanupStarted)
        cleanup();
      else
        request.end();
      await done;
    } catch (error) {
      factoryReturned = !0;
      fail(error instanceof Error ? error.message : "https-request-construction-failed");
      aborted = !0;
      cleanup();
      if (!allClosed() && watchdog !== void 0)
        await done;
    } finally {
      if (watchdog !== void 0)
        clearInterval(watchdog);
      if (hardDeadline !== void 0)
        clearTimeout(hardDeadline);
      process.removeListener("SIGINT", interrupt);
      process.removeListener("SIGTERM", interrupt);
      if (!allClosed()) {
        cleanup();
        if (!allClosed()) {
          cleanupFailed = !0;
          fail("https-owned-cleanup-unconfirmed");
        }
      }
    }
    const body = Buffer.concat(chunks);
    if (fault === "cleanup") {
      cleanupFailed = !0;
      fail("https-synthetic-cleanup-failed");
    }
    if (elapsed() >= fetchMs || parentLeft() <= 0 || fault === "transport-finalization-deadline")
      fail("https-finalization-deadline");
    const cleanupConfirmed = allClosed() && !cleanupFailed, finalResponse = response;
    if (failure === null && !(requestCalls === 1 && requestFinished && requestClosed && responseEOF && finalResponse?.complete && responseClosed && socketClosed && cleanupConfirmed && statusCode === 200))
      fail("https-lifecycle-incomplete");
    return { body, requestCalls, receivedBytes, retainedBytes, statusCode, failure, requestFinished, requestClosed, responseEOF, responseComplete: finalResponse?.complete === !0, responseClosed, socketClosed, cleanupConfirmed, aborted, interrupted };
  }
  function checkPins(pins) {
    pinCheck(pins);
    need(/^[a-f0-9]{40}$/.test(pins.commitOid) && pins.packetPath === "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/source-packet1.json", "fixed-published-packet-required");
    need(Array.isArray(pins.fileTable) && pins.fileTable.length > 0 && pins.fileTable.length <= limits.files, "fixed-published-file-table-required");
  }
  function syntheticContext(options) {
    need(options.scope === "OFFLINE_SYNTHETIC", "offline-synthetic-scope-required");
    const pattern = new RegExp(`^${"/home/gu1lty/Projects/proveo/chess-coach".replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}/_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/delivery-verification-[1-9][0-9]{0,2}/fixtures/[a-z][a-z0-9-]{0,63}$`);
    need(pattern.test(options.fixtureRoot) && path.resolve(options.fixtureRoot) === options.fixtureRoot, "protected-fixture-root-required");
    ancestors(options.fixtureRoot);
    const marker = fs.lstatSync(path.join(options.fixtureRoot, "OFFLINE_SYNTHETIC.json"));
    need(marker.isFile() && !marker.isSymbolicLink() && fs.readFileSync(path.join(options.fixtureRoot, "OFFLINE_SYNTHETIC.json"), "utf8") === `{"scope":"OFFLINE_SYNTHETIC"}
`, "protected-fixture-marker-required");
    need(typeof options.requestFactory === "function", "fixture-only-fake-https-required");
    return path.join(options.fixtureRoot, "host");
  }
  async function runSynthetic(pins, options) {
    return run(pins, options);
  }
  async function runProduction(pins) {
    checkPins(pins);
    need(process.versions.bun === "1.4.0", "bun-1.4.0-required");
    need(blockers.length === 0, `PRODUCTION_DELIVERY_BLOCKED:${blockers.join(",")}`);
    return run(pins);
  }
  async function run(pins, synthetic) {
    checkPins(pins);
    need(process.versions.bun === "1.4.0", "bun-1.4.0-required");
    const host = synthetic ? syntheticContext(synthetic) : "/home/gu1lty/Projects/proveo/chess-coach", handoff = path.join(host, "_work/gpu-owner-recovery/runs/reference-package-handoff-2"), snapshot = path.join(handoff, "snapshot"), evidence = path.join(handoff, "evidence"), scope = synthetic ? synthetic.scope : "EXECUTOR_MANUAL_OPERATOR_ONLY", timer = clock(synthetic?.stageMs ?? limits.stageA, bootstrapEntryOrigin, synthetic?.fault);
    let claimed = !1, sealed = !1, fetched = !1, stageB = !1, failure = null, fetchResult = null, callerResult = null;
    const parents = ["_work/gpu-owner-recovery/runs/host-canonical-r4-source-1", "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1", "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2"], forbidden = ["_work/gpu-owner-recovery/cache/reference-package-inputs-2", "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-inputs-2", "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/acquisition-execution-1"];
    try {
      timer.check();
      need(synthetic ? path.resolve(host) !== "/home/gu1lty/Projects/proveo/chess-coach" : process.cwd() === "/home/gu1lty/Projects/proveo/chess-coach", "fixed-execution-root-required");
      ancestors(path.join(host, "_work/gpu-owner-recovery/runs"));
      try {
        const cache = fs.lstatSync(path.join(host, "_work/gpu-owner-recovery/cache"));
        need(cache.isDirectory() && !cache.isSymbolicLink(), "fixed-cache-parent-invalid");
      } catch (error) {
        if (error.code !== "ENOENT")
          throw error;
      }
      for (const name of ["_work/gpu-owner-recovery/runs/reference-package-handoff-2", ...forbidden])
        absent(path.join(host, name));
      for (const relative of parents)
        try {
          const stat = fs.lstatSync(path.join(host, relative));
          need(stat.isDirectory() && !stat.isSymbolicLink(), "host-operation-parent-invalid");
        } catch (error) {
          if (error.code !== "ENOENT")
            throw error;
        }
      timer.check();
      fs.mkdirSync(handoff, { mode: 448 });
      claimed = !0;
      durableDirectory(handoff);
      durableDirectory(path.dirname(handoff));
      record(path.join(handoff, "handoff-claim.json"), { scope, approvalSha256: "4e68d36f8076e213744364cf4cd5f793ef3dbffda6157b93070edf2ffc282d3f", launchBoundarySha256: "44aa077f7db10d3bc3a462da355198973a6f2afba29b7745d4c2bba53f94cdc5", transportAmendmentSha256: "f53b4985052f242a453d24e1bcccde47d1589288952543ea0a5b7d5756291918", handoffAttemptsConsumed: 1, githubRequestSlots: 1, innerAttemptsConsumedByDelivery: 0 });
      freshDirectory(snapshot);
      freshDirectory(evidence);
      timer.check();
      fetched = !0;
      const factory = synthetic ? synthetic.requestFactory : (options, onResponse) => https.request(options, onResponse);
      fetchResult = await fetchPacket(pins.gitBlobOid, timer.remaining, factory, Math.min(synthetic?.fetchMs ?? limits.fetch, timer.remaining()), synthetic?.fault);
      need(fetchResult.failure === null && fetchResult.cleanupConfirmed && fetchResult.responseEOF, `github-https:${fetchResult.failure ?? "incomplete"}`);
      if (synthetic?.fault === "clock-after-fetch")
        timer.invalidate();
      timer.check();
      const packet = parseResponse(fetchResult.body, pins), verified = validatePacket(packet, pins, pins.fileTable);
      timer.check();
      for (const directory of verified.directories) {
        if (directory === "" || directory === "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/acquisition-invocation-1")
          continue;
        freshDirectory(path.join(snapshot, directory));
        timer.check();
      }
      for (const [relative, bytes] of verified.files) {
        timer.check();
        writeExclusive(path.join(snapshot, relative), bytes, 256, synthetic?.fault === "file-close" ? synthetic.fault : void 0);
      }
      timer.check();
      for (const directory of [...verified.directories].reverse()) {
        if (directory === "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/acquisition-invocation-1")
          continue;
        const absolute = path.join(snapshot, directory);
        durableDirectory(absolute, synthetic?.fault);
        timer.check();
      }
      need(synthetic?.fault !== "seal-deadline", "stage-a-seal-deadline");
      sealed = !0;
      for (const relative of parents) {
        timer.check();
        const absolute = path.join(host, relative);
        try {
          const stat = fs.lstatSync(absolute);
          need(stat.isDirectory() && !stat.isSymbolicLink(), "host-operation-parent-invalid");
        } catch (error) {
          if (error.code !== "ENOENT")
            throw error;
          freshDirectory(absolute);
        }
      }
      timer.finalizing();
      timer.check();
      record(path.join(evidence, "transfer-receipt.json"), { status: "SEALED_STAGE_A_CANDIDATE_NOT_DELIVERY_SUCCESS", scope, packet: identity(packet), files: verified.files.size, aggregateSourceBytes: verified.aggregateBytes, snapshotDirectoriesIncludingObserver: verified.directories.length, approvalSha256: "4e68d36f8076e213744364cf4cd5f793ef3dbffda6157b93070edf2ffc282d3f", launchBoundarySha256: "44aa077f7db10d3bc3a462da355198973a6f2afba29b7745d4c2bba53f94cdc5", transportAmendmentSha256: "f53b4985052f242a453d24e1bcccde47d1589288952543ea0a5b7d5756291918", httpsRequestCalls: fetchResult.requestCalls, httpsStatusCode: fetchResult.statusCode, httpsResponseBytes: fetchResult.receivedBytes, httpsRetainedBytes: fetchResult.retainedBytes, httpsResponseEOF: !0, httpsOwnedCleanupConfirmed: !0, innerAttemptsConsumedByDelivery: 0 }, synthetic?.fault === "receipt-close" ? synthetic.fault : void 0);
      durableDirectory(evidence);
      timer.check();
      stageB = !0;
      callerResult = await runChild({ executable: process.execPath, args: ["--no-env-file", "--no-install", path.join(snapshot, "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/invoke-approved-bun.ts"), "execute"], cwd: snapshot, env: { LANG: "C", LC_ALL: "C", TZ: "UTC" }, stdoutCap: 65536, stderrCap: 65536, remainingMs: () => Number.MAX_SAFE_INTEGER, workMs: Number.MAX_SAFE_INTEGER, cleanupMs: 2000, deadlineOwner: "INNER_CALLER" });
      need(callerResult.failure === null, `caller-child:${callerResult.failure}`);
    } catch (error) {
      failure = error instanceof Error ? error.message : "delivery-failed";
    }
    if (claimed)
      try {
        record(path.join(handoff, "delivery-outcome.json"), { status: failure === null ? "OBSERVATION_REQUIRES_SUCCESSFUL_FINAL_CLOSE" : "FAIL_PRESERVE_PARTIALS", scope, failure, claimed, fetched, sealed, stageB, innerAttemptsConsumedByDelivery: 0, sourceRequest: fetchResult && { requestCalls: fetchResult.requestCalls, statusCode: fetchResult.statusCode, receivedBytes: fetchResult.receivedBytes, responseEOF: fetchResult.responseEOF, requestClosed: fetchResult.requestClosed, responseClosed: fetchResult.responseClosed, socketClosed: fetchResult.socketClosed, cleanupConfirmed: fetchResult.cleanupConfirmed, failure: fetchResult.failure }, callerChild: callerResult && { ...callerResult, stdout: identity(callerResult.stdout), stderr: identity(callerResult.stderr) } });
      } catch {
        failure ??= "durable-outcome-failed";
      }
    return { failure, claimed, fetched, sealed, stageB, handoff, snapshot, evidence, fetchResult, callerResult };
  }
  return { constants: { D: "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1", R2: "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2", HOSTROOT: "/home/gu1lty/Projects/proveo/chess-coach", HREL: "_work/gpu-owner-recovery/runs/reference-package-handoff-2", CALLER: "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/invoke-approved-bun.ts", OBSERVER: "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/acquisition-invocation-1", PACKET_PATH: "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/source-packet1.json", APPROVAL_SHA: "4e68d36f8076e213744364cf4cd5f793ef3dbffda6157b93070edf2ffc282d3f", BOUNDARY_PATH: "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/manual-launch-boundary-selection1.json", BOUNDARY_SHA: "44aa077f7db10d3bc3a462da355198973a6f2afba29b7745d4c2bba53f94cdc5", AMENDMENT_PATH: "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/manual-source-transport-amendment1.json", AMENDMENT_SHA: "f53b4985052f242a453d24e1bcccde47d1589288952543ea0a5b7d5756291918", fixedInputs, bindings, limits, blockers }, need: (value, reason) => need(value, reason), hash, blob, identity, safePath: (value) => safePath(value), text, decode, directories, validatePacket, parseResponse, verifyApproval, ancestors, absent, writeExclusive, freshDirectory, durableDirectory, record, clock, createPipeCleanup, runChild, requestOptions, checkPins, runSynthetic, runProduction };
})().then(api=>api.runProduction({"bytes":29,"sha256":"ade861910339e7ef5544e8b13e469ff5c451213d2362c4f6ae4c000eab98588a","gitBlobOid":"9a53638cd423e7b6f3dbabe872d88af74d27700f","commitOid":"1111111111111111111111111111111111111111","packetPath":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/source-packet1.json","fileTable":[{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/invoke-approved-bun.ts","bytes":29,"sha256":"ade861910339e7ef5544e8b13e469ff5c451213d2362c4f6ae4c000eab98588a","gitBlobOid":"9a53638cd423e7b6f3dbabe872d88af74d27700f"}]})).then(result=>{if(result.failure!==null)process.exitCode=1;}).catch(()=>{process.stderr.write("DELIVERY_BLOCKED_OR_FAILED\\n");process.exitCode=1;})'
end
