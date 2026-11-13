# OFFLINE_SYNTHETIC_NONRUNNING: syntax fixture only; no publication pins or operator command.
begin
  set -lx MISE_AUTO_INSTALL false
  set -lx MISE_TASK_RUN_AUTO_INSTALL false
  set -lx MISE_EXEC_AUTO_INSTALL false
  test (pwd -P) = '/home/gu1lty/Projects/proveo/chess-coach'; or exit 1
  command mise exec core:bun@1.4.0 -- bun --no-env-file --no-install --eval '(async function createDeliveryRuntime() {
  const bootstrapEntryOrigin = process.hrtime.bigint(), fs = await import("node:fs"), path = await import("node:path"), crypto = await import("node:crypto"), cp = await import("node:child_process"), bindings = [
    ["acquisitionRequest", "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/request.json", "c0288e1e34e24d2f7a81e12ee1967ffafbd2768b4c2a5bc2ba15826b6384ff3f"],
    ["acquisitionPlan", "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/plan.json", "7f6a90ca105d6a7c5a45951b508d4a1ecdd5e217625d1cefe08da23557847405"],
    ["manualHandoffRequest", "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/manual-handoff-request1.json", "47d63b8cb446cdc8a83323788c9106cdb82437992e7bd3a88f55821aa6bde52b"],
    ["manualHandoffPlan", "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/manual-handoff-plan1.json", "4297e4f1b763b5aa152b88a7a3e288a19cafc85331cbed2d776f38d043f8817a"]
  ], limits = { files: 96, file: 1048576, source: 6291456, packet: 8388608, response: 12582912, directories: 256, stageA: 120000, fetch: 30000, stderr: 65536 }, blockers = ["GH_2_46_API_REDIRECT_RETRY_PREVENTION_UNRESOLVED"];
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
    need(/\\.(?:ts|json|jsonl|yaml|yml|md|puml|stdout|stderr)$/.test(value), "text-source-extension");
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
      need(Number.isSafeInteger(row.bytes) && Number(row.bytes) > 0 && Number(row.bytes) <= limits.file, "file-byte-cap");
      const content = decode(row.base64, limits.file);
      text(content);
      match(content, wanted);
      aggregate += content.length;
      need(aggregate <= limits.source, "aggregate-source-cap");
      files.set(row.path, content);
    }
    const dirs = directories([...files.keys()]);
    need(envelope.aggregateBytes === aggregate && JSON.stringify(envelope.directories) === JSON.stringify(dirs), "packet-total-or-directory-table");
    for (const member of ["_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/invoke-approved-bun.ts", "_work/gpu-owner-recovery/verify.ts", "_work/gpu-owner-recovery/command-supervisor.ts"])
      need(files.has(member), "required-fixed-closure-member");
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
    } };
  }
  async function runChild(spec) {
    const stdout = [], stderr = [];
    let outBytes = 0, errBytes = 0, exitCode = null, signal = null, reaped = !1, closed = !1, outEOF = !1, errEOF = !1, failure = null, interrupted = !1, child;
    const started = process.hrtime.bigint(), fail = (reason) => {
      failure ??= reason;
    }, groupSignal = (sig) => {
      if (child?.pid === void 0)
        return;
      try {
        process.kill(-child.pid, sig);
      } catch (error) {
        if (error.code !== "ESRCH")
          fail("owned-group-signal-failed");
      }
    }, interrupt = () => {
      interrupted = !0;
      fail("delivery-interrupted");
      groupSignal("SIGTERM");
    }, readRemaining = () => {
      try {
        return spec.remainingMs();
      } catch {
        fail("parent-clock-failure");
        return -1;
      }
    };
    need(Number.isFinite(spec.workMs) && spec.workMs > 0 && spec.cleanupMs >= 0 && readRemaining() > 0, "child-local-duration-required");
    let doneResolve;
    const done = new Promise((resolve) => {
      doneResolve = resolve;
    });
    process.on("SIGINT", interrupt);
    process.on("SIGTERM", interrupt);
    let watchdog;
    try {
      child = cp.spawn(spec.executable, spec.args, { cwd: spec.cwd, env: spec.env, detached: !0, shell: !1, stdio: ["ignore", "pipe", "pipe"] });
      need(child.stdout && child.stderr, "owned-child-pipes-required");
      const collect = (data, isOut) => {
        const current = isOut ? outBytes : errBytes, cap = isOut ? spec.stdoutCap : spec.stderrCap, accepted = Math.max(0, Math.min(data.length, cap - current));
        if (accepted)
          (isOut ? stdout : stderr).push(Buffer.from(data.subarray(0, accepted)));
        if (isOut)
          outBytes += accepted;
        else
          errBytes += accepted;
        if (accepted !== data.length) {
          fail(isOut ? "child-stdout-cap" : "child-stderr-cap");
          groupSignal("SIGTERM");
        }
      };
      child.stdout.on("data", (data) => collect(data, !0));
      child.stderr.on("data", (data) => collect(data, !1));
      child.stdout.once("end", () => {
        outEOF = !0;
      });
      child.stderr.once("end", () => {
        errEOF = !0;
      });
      child.stdout.once("error", () => {
        fail("stdout-pipe-error");
      });
      child.stderr.once("error", () => {
        fail("stderr-pipe-error");
      });
      child.once("error", () => {
        fail("child-spawn-error");
      });
      child.once("exit", (code, sig) => {
        exitCode = code;
        signal = sig;
        reaped = !0;
      });
      child.once("close", () => {
        closed = !0;
        doneResolve();
      });
      let terminatingAt = null;
      watchdog = setInterval(() => {
        const elapsed = Number(process.hrtime.bigint() - started) / 1e6, left = readRemaining();
        if (spec.syntheticFault === "interrupt" && !interrupted)
          interrupt();
        const expired = spec.deadlineOwner !== "INNER_CALLER" && (elapsed >= spec.workMs || left <= spec.cleanupMs);
        if (expired || failure !== null) {
          if (expired)
            fail("child-deadline");
          terminatingAt ??= process.hrtime.bigint();
          groupSignal("SIGTERM");
          if (Number(process.hrtime.bigint() - terminatingAt) / 1e6 >= 50)
            groupSignal("SIGKILL");
        }
        if (terminatingAt !== null && Number(process.hrtime.bigint() - terminatingAt) / 1e6 >= spec.cleanupMs || spec.deadlineOwner !== "INNER_CALLER" && (elapsed >= spec.workMs + spec.cleanupMs || left <= 0)) {
          fail("child-cleanup-deadline");
          groupSignal("SIGKILL");
          doneResolve();
        }
      }, 5);
      await done;
      if (closed && !reaped && failure === "child-spawn-error")
        reaped = !0;
      if (!closed || !reaped || !outEOF || !errEOF) {
        fail("owned-child-reap-or-eof-unconfirmed");
        groupSignal("SIGKILL");
      }
      if (child.pid !== void 0)
        try {
          process.kill(-child.pid, 0);
          fail("owned-process-group-remains");
          groupSignal("SIGKILL");
        } catch (error) {
          if (error.code !== "ESRCH")
            fail("owned-process-group-check-failed");
        }
      if (spec.syntheticFault === "cleanup")
        fail("synthetic-cleanup-failed");
      if (exitCode !== 0 || signal !== null)
        fail("child-nonzero-or-signal");
      if (spec.deadlineOwner !== "INNER_CALLER" && readRemaining() <= 0)
        fail("child-finalization-deadline");
    } catch (error) {
      fail(error instanceof Error ? error.message : "child-failure");
      groupSignal("SIGKILL");
    } finally {
      if (watchdog !== void 0)
        clearInterval(watchdog);
      process.removeListener("SIGINT", interrupt);
      process.removeListener("SIGTERM", interrupt);
      child?.stdout?.destroy();
      child?.stderr?.destroy();
    }
    return { stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr), exitCode, signal, reaped, closed, outEOF, errEOF, failure, interrupted };
  }
  function ghEnvironment(parent) {
    const env = { PATH: parent.PATH ?? "/usr/bin:/bin", LANG: "C", LC_ALL: "C", GH_HOST: "github.com", GH_PROMPT_DISABLED: "1", GH_NO_UPDATE_NOTIFIER: "1", GH_NO_EXTENSION_UPDATE_NOTIFIER: "1", NO_COLOR: "1" };
    for (const name of ["HOME", "XDG_CONFIG_HOME", "GH_CONFIG_DIR"])
      if (parent[name] !== void 0)
        env[name] = parent[name];
    return env;
  }
  function ghArgs(oid) {
    need(/^[a-f0-9]{40}$/.test(oid), "committed-git-blob-pin-required");
    return ["api", "--hostname", "github.com", "--method", "GET", "-H", "Accept: application/vnd.github+json", `repos/proveo-ca/chess-coach/git/blobs/${oid}`];
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
    need(options.fakeGh === path.join(options.fixtureRoot, "fake-gh.ts"), "fixture-only-fake-gh-required");
    const fake = fs.lstatSync(options.fakeGh);
    need(fake.isFile() && !fake.isSymbolicLink(), "fixture-only-fake-gh-required");
    return path.join(options.fixtureRoot, "host");
  }
  async function runSynthetic(pins, options) {
    return run(pins, options);
  }
  async function runProduction(pins) {
    checkPins(pins);
    need(process.versions.bun === "1.4.0", "bun-1.4.0-required");
    throw Error(`PRODUCTION_DELIVERY_BLOCKED:${blockers.join(",")}`);
  }
  async function run(pins, synthetic) {
    checkPins(pins);
    need(process.versions.bun === "1.4.0", "bun-1.4.0-required");
    const host = syntheticContext(synthetic), handoff = path.join(host, "_work/gpu-owner-recovery/runs/reference-package-handoff-2"), snapshot = path.join(handoff, "snapshot"), evidence = path.join(handoff, "evidence"), timer = clock(synthetic.stageMs ?? limits.stageA, bootstrapEntryOrigin, synthetic.fault);
    let claimed = !1, sealed = !1, fetched = !1, stageB = !1, failure = null, fetchResult = null, callerResult = null;
    const parents = ["_work/gpu-owner-recovery/runs/host-canonical-r4-source-1", "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1", "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2"], forbidden = ["_work/gpu-owner-recovery/cache", "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-inputs-2", "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/acquisition-execution-1"];
    try {
      timer.check();
      need(path.resolve(host) !== "/home/gu1lty/Projects/proveo/chess-coach", "synthetic-production-root-forbidden");
      ancestors(path.join(host, "_work/gpu-owner-recovery/runs"));
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
      freshDirectory(handoff);
      claimed = !0;
      record(path.join(handoff, "handoff-claim.json"), { scope: synthetic.scope, approvalSha256: "4e68d36f8076e213744364cf4cd5f793ef3dbffda6157b93070edf2ffc282d3f", handoffAttemptsConsumed: 1, githubRequestSlots: 1, innerAttemptsConsumedByDelivery: 0 });
      freshDirectory(snapshot);
      freshDirectory(evidence);
      timer.check();
      fetched = !0;
      fetchResult = await runChild({ executable: process.execPath, args: ["--no-env-file", "--no-install", synthetic.fakeGh, ...ghArgs(pins.gitBlobOid)], cwd: synthetic.fixtureRoot, env: { LANG: "C", LC_ALL: "C" }, stdoutCap: limits.response, stderrCap: limits.stderr, remainingMs: timer.remaining, workMs: Math.min((synthetic.fetchMs ?? limits.fetch) - 100, timer.remaining() - 2000), cleanupMs: 100, ...synthetic.fault === void 0 ? {} : { syntheticFault: synthetic.fault } });
      need(fetchResult.failure === null && fetchResult.reaped && fetchResult.closed && fetchResult.outEOF && fetchResult.errEOF, `github-child:${fetchResult.failure ?? "incomplete"}`);
      timer.check();
      const packet = parseResponse(fetchResult.stdout, pins), verified = validatePacket(packet, pins, pins.fileTable);
      timer.check();
      for (const directory of verified.directories) {
        if (directory === "" || directory === "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/acquisition-invocation-1")
          continue;
        freshDirectory(path.join(snapshot, directory));
        timer.check();
      }
      for (const [relative, bytes] of verified.files) {
        timer.check();
        writeExclusive(path.join(snapshot, relative), bytes, 256, synthetic.fault);
      }
      timer.check();
      for (const directory of [...verified.directories].reverse()) {
        if (directory === "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/acquisition-invocation-1")
          continue;
        const absolute = path.join(snapshot, directory);
        durableDirectory(absolute, synthetic.fault);
        timer.check();
      }
      need(synthetic.fault !== "seal-deadline", "stage-a-seal-deadline");
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
      record(path.join(evidence, "transfer-receipt.json"), { status: "SEALED_STAGE_A", scope: synthetic.scope, packet: identity(packet), files: verified.files.size, approvalSha256: "4e68d36f8076e213744364cf4cd5f793ef3dbffda6157b93070edf2ffc282d3f", githubChildrenReaped: !0, githubPipesEOF: !0, innerAttemptsConsumedByDelivery: 0 }, synthetic.fault);
      durableDirectory(evidence);
      timer.check();
      stageB = !0;
      callerResult = await runChild({ executable: process.execPath, args: ["--no-env-file", "--no-install", path.join(snapshot, "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/invoke-approved-bun.ts"), "execute"], cwd: snapshot, env: { LANG: "C", LC_ALL: "C" }, stdoutCap: 65536, stderrCap: 65536, remainingMs: () => Number.MAX_SAFE_INTEGER, workMs: Number.MAX_SAFE_INTEGER, cleanupMs: 2000, deadlineOwner: "INNER_CALLER" });
      need(callerResult.failure === null, `caller-child:${callerResult.failure}`);
    } catch (error) {
      failure = error instanceof Error ? error.message : "delivery-failed";
    }
    if (claimed)
      try {
        record(path.join(handoff, "delivery-outcome.json"), { status: failure === null ? "PASS_OFFLINE_SYNTHETIC" : "FAIL_PRESERVE_PARTIALS", scope: synthetic.scope, failure, claimed, fetched, sealed, stageB, innerAttemptsConsumedByDelivery: 0, fetchedChild: fetchResult && { exitCode: fetchResult.exitCode, reaped: fetchResult.reaped, closed: fetchResult.closed, outEOF: fetchResult.outEOF, errEOF: fetchResult.errEOF, failure: fetchResult.failure }, callerChild: callerResult && { exitCode: callerResult.exitCode, failure: callerResult.failure } });
      } catch {
        failure ??= "durable-outcome-failed";
      }
    return { failure, claimed, fetched, sealed, stageB, handoff, snapshot, evidence, fetchResult, callerResult };
  }
  return { constants: { D: "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1", R2: "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2", HOSTROOT: "/home/gu1lty/Projects/proveo/chess-coach", HREL: "_work/gpu-owner-recovery/runs/reference-package-handoff-2", CALLER: "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/invoke-approved-bun.ts", OBSERVER: "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/acquisition-invocation-1", PACKET_PATH: "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/source-packet1.json", APPROVAL_SHA: "4e68d36f8076e213744364cf4cd5f793ef3dbffda6157b93070edf2ffc282d3f", BOUNDARY_PATH: "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/manual-launch-boundary-selection1.json", BOUNDARY_SHA: "44aa077f7db10d3bc3a462da355198973a6f2afba29b7745d4c2bba53f94cdc5", bindings, limits, blockers }, need, hash, blob, identity, safePath, text, decode, directories, validatePacket, parseResponse, verifyApproval, ancestors, absent, writeExclusive, freshDirectory, durableDirectory, record, clock, runChild, ghEnvironment, ghArgs, checkPins, runSynthetic, runProduction };
})().then(api=>api.runProduction({"bytes":29,"sha256":"ade861910339e7ef5544e8b13e469ff5c451213d2362c4f6ae4c000eab98588a","gitBlobOid":"9a53638cd423e7b6f3dbabe872d88af74d27700f","commitOid":"1111111111111111111111111111111111111111","packetPath":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/source-packet1.json","fileTable":[{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/invoke-approved-bun.ts","bytes":29,"sha256":"ade861910339e7ef5544e8b13e469ff5c451213d2362c4f6ae4c000eab98588a","gitBlobOid":"9a53638cd423e7b6f3dbabe872d88af74d27700f"}]})).catch(()=>{process.stderr.write("DELIVERY_BLOCKED_OR_FAILED\\n");process.exitCode=1;})'
end
