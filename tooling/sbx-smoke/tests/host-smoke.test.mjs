// SPEC: _spec/tooling/bun-first-party-tooling.puml
import { afterEach, beforeEach, test } from "bun:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  chmodSync, closeSync, existsSync, fstatSync, mkdirSync, mkdtempSync,
  readFileSync, readdirSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPrivateLog, privateDirectory } from "../create-debug.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, "../host-smoke.sh");
const DEBUG = resolve(HERE, "../create-debug.mjs");
const FAKE = readFileSync(join(HERE, "fixtures/fake-sbx.mjs"), "utf8");
const NAME = `f9smoke-${"a".repeat(24)}`;
let root;
let fake;

beforeEach(() => {
  root = mkdtempSync("/tmp/opencode/sbx-smoke-");
  fake = join(root, "sbx");
  writeFileSync(fake, `#!${process.execPath}\n${FAKE}`, { mode: 0o755 });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function environment(mode = "success") {
  return {
    PATH: `${dirname(process.execPath)}:/usr/bin:/bin`,
    HOME: root,
    TMPDIR: "/tmp/opencode",
    LC_ALL: "C",
    FAKE_SBX_HOME: root,
    FAKE_SBX_MODE: mode,
  };
}

function request(command, { mode = "success", onLine, timeout = 15_000 } = {}) {
  return new Promise((fulfill, reject) => {
    const child = spawn(command[0], command.slice(1), {
      env: environment(mode), stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let pending = "";
    let failure;
    const timer = setTimeout(() => {
      failure = new Error("fake smoke exceeded its test deadline");
      child.kill("SIGKILL");
      child.stdout.destroy();
      child.stderr.destroy();
      reject(failure);
    }, timeout);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (text) => {
      stdout += text;
      pending += text;
      while (pending.includes("\n")) {
        const end = pending.indexOf("\n");
        const line = pending.slice(0, end);
        pending = pending.slice(end + 1);
        try {
          onLine?.(line);
        } catch (error) {
          failure = error;
          child.kill("SIGKILL");
        }
      }
    });
    child.stderr.on("data", (text) => { stderr += text; });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (failure) reject(failure);
      else fulfill({ code, signal, stdout, stderr });
    });
  });
}

function invoke(mode = "success", extra = [], options = {}) {
  return request([
    "/usr/bin/bash", "--noprofile", "--norc", SCRIPT,
    "--confirm-dev-shared-daemon", "--sbx", fake, "--create-seconds", "1", ...extra,
  ], { ...options, mode });
}

function debug(extra = [], options = {}) {
  return request([
    process.execPath, DEBUG, "--sbx", fake, "--name", NAME, "--seconds", "1",
    "--evidence-dir", privatePath(), ...extra,
  ], options);
}

function calls() {
  const path = join(root, "calls");
  return existsSync(path) ? readFileSync(path, "utf8").trim().split("\n").map((line) => JSON.parse(line)) : [];
}

function verbs() {
  return calls().map((call) => call[0]);
}

function privatePath() {
  const path = join(root, "private");
  if (!existsSync(path)) mkdirSync(path, { mode: 0o700 });
  return path;
}

function assertDead(pid = Number(readFileSync(join(root, "create-pid"), "utf8"))) {
  const status = `/proc/${pid}/status`;
  if (existsSync(status)) {
    const state = /^State:\s+(\S+)/m.exec(readFileSync(status, "utf8"))?.[1];
    assert.ok(["Z", "X"].includes(state), `stopped fake CLI survived: ${pid} (${state})`);
  }
}

function check(name, body) {
  test(name, body, 20_000);
}

check("success creates, executes, and confirms the exact owned name is absent", async () => {
  const result = await invoke();
  assert.equal(result.code, 0, result.stderr);
  assert.ok(result.stdout.includes("RESULT=DEV_SMOKE_ONLY\n"));
  const name = /^ATTEMPT_NAME=(.+)$/m.exec(result.stdout)?.[1];
  assert.match(name, /^f9smoke-[0-9a-f]{24}$/);
  assert.ok(result.stdout.includes(`NAME_ABSENT_AFTER_RM=${name}\n`));
  assert.deepEqual(calls(), [
    ["ls", "-q"],
    ["create", "--name", name, "--pull", "never", "--skills", "off", "--deny-network", "**", "--cpus", "1", "--memory", "512m", "shell"],
    ["ls", "-q"], ["exec", name, "/bin/true"], ["rm", "--force", name], ["ls", "-q"],
  ]);
  assert.equal(existsSync(join(root, "state")), false);
});

check("missing confirmation refuses before the CLI", async () => {
  const result = await request(["/usr/bin/bash", "--noprofile", "--norc", SCRIPT, "--sbx", fake]);
  assert.equal(result.code, 2);
  assert.deepEqual(calls(), []);
});

check("a preexisting name refuses without creating", async () => {
  const result = await invoke("preexisting", [], {
    onLine(line) {
      if (line.startsWith("ATTEMPT_NAME=")) writeFileSync(join(root, "preexisting"), line.split("=")[1]);
    },
  });
  assert.equal(result.code, 2, result.stderr);
  assert.ok(result.stderr.includes("smoke name already exists"));
  assert.deepEqual(calls(), [["ls", "-q"]]);
  assert.equal(result.stdout.includes("RESULT=DEV_SMOKE_ONLY"), false);
});

for (const mode of ["list-fail-before", "list-overflow"]) {
  check(`${mode} refuses before creating`, async () => {
    const result = await invoke(mode);
    assert.equal(result.code, 2);
    assert.deepEqual(calls(), [["ls", "-q"]]);
    assert.equal(result.stdout.includes("RESULT=DEV_SMOKE_ONLY"), false);
  });
}

check("ordinary create timeout kills its stopped child and never removes", async () => {
  const result = await invoke("create-stopped-after-state");
  assert.equal(result.code, 2, result.stderr);
  assert.ok(result.stderr.includes("CREATE_UNCONFIRMED_NAME="));
  assert.deepEqual(verbs(), ["ls", "create"]);
  assert.ok(existsSync(join(root, "state")));
  assert.equal(result.stdout.includes("RESULT=DEV_SMOKE_ONLY"), false);
  assertDead();
});

check("failed create after partial creation never removes", async () => {
  const result = await invoke("create-fail-after-state");
  assert.equal(result.code, 2);
  assert.ok(result.stderr.includes("CREATE_UNCONFIRMED_NAME="));
  assert.deepEqual(verbs(), ["ls", "create"]);
  assert.ok(existsSync(join(root, "state")));
});

for (const mode of ["list-fail-after", "create-success-unlisted"]) {
  check(`${mode} never removes an unconfirmed name`, async () => {
    const result = await invoke(mode);
    assert.equal(result.code, 2);
    assert.ok(result.stderr.includes("OWNERSHIP_UNCONFIRMED_NAME="));
    assert.deepEqual(verbs(), ["ls", "create", "ls"]);
    assert.equal(existsSync(join(root, "state")), mode === "list-fail-after");
  });
}

check("failed exec still removes the confirmed name", async () => {
  const result = await invoke("exec-fail");
  assert.equal(result.code, 2);
  assert.ok(result.stderr.includes("EXEC_FAILED_NAME="));
  assert.ok(result.stdout.includes("NAME_ABSENT_AFTER_RM="));
  assert.deepEqual(verbs(), ["ls", "create", "ls", "exec", "rm", "ls"]);
  assert.equal(existsSync(join(root, "state")), false);
  assert.equal(result.stdout.includes("RESULT=DEV_SMOKE_ONLY"), false);
});

check("failed removal never reports success", async () => {
  const result = await invoke("remove-fail");
  assert.equal(result.code, 2);
  assert.ok(result.stderr.includes("REMOVE_UNCONFIRMED_NAME="));
  assert.ok(existsSync(join(root, "state")));
  assert.deepEqual(verbs(), ["ls", "create", "ls", "exec", "rm"]);
});

for (const mode of ["remove-still-listed", "list-fail-remove"]) {
  check(`${mode} leaves removal uncertain`, async () => {
    const result = await invoke(mode);
    assert.equal(result.code, 2);
    assert.ok(result.stderr.includes("REMOVE_UNCONFIRMED_NAME="));
    assert.equal(result.stdout.includes("RESULT=DEV_SMOKE_ONLY"), false);
  });
}

check("instrumented success keeps debug output private", async () => {
  const privateDir = privatePath();
  const result = await invoke("success", ["--instrumented-debug", privateDir]);
  assert.equal(result.code, 0, result.stderr);
  assert.ok(result.stdout.includes("CREATE_CLI_STATUS=EXIT_0"));
  assert.ok(result.stdout.includes("RESULT=DEV_SMOKE_ONLY"));
  assert.equal((result.stdout + result.stderr).includes("PRIVATE_DEBUG_SENTINEL"), false);
  assert.deepEqual(verbs(), ["ls", "-D", "ls", "exec", "rm", "ls"]);
  const files = readdirSync(privateDir);
  assert.equal(files.length, 1);
  const log = join(privateDir, files[0]);
  assert.equal(statSync(log).mode & 0o777, 0o600);
  assert.ok(readFileSync(log, "utf8").includes("PRIVATE_DEBUG_SENTINEL"));
});

check("instrumented launcher passes explicit dotenv and package isolation flags", () => {
  const source = readFileSync(SCRIPT, "utf8");
  assert.ok(source.includes('bun --no-env-file --no-install "${BASH_SOURCE[0]%/*}/create-debug.mjs"'));
});

for (const mode of ["create-stopped-after-state", "create-term-resistant"]) {
  check(`instrumented ${mode} samples and kills only its stopped CLI`, async () => {
    const beginning = performance.now();
    const result = await invoke(mode, ["--instrumented-debug", privatePath()]);
    const elapsed = performance.now() - beginning;
    assert.equal(result.code, 2, result.stderr);
    assert.match(result.stdout, /CREATE_CLI_PID=[0-9]+ CREATE_CLI_START_TICKS=[0-9]+/);
    assert.match(result.stdout, /CREATE_SAMPLE_SEC=[0-9]+ STATE=T WCHAN=[a-zA-Z0-9_]+/);
    assert.ok(result.stdout.includes("CREATE_CLI_STATUS=DEADLINE"));
    assert.ok(result.stderr.includes("CREATE_UNCONFIRMED_NAME="));
    assert.deepEqual(verbs(), ["ls", "-D"]);
    assert.ok(elapsed >= 3000 && elapsed < 10_000, `unexpected deadline: ${elapsed}ms`);
    assertDead();
  });
}

check("instrumented failed create never removes a partial name", async () => {
  const result = await invoke("create-fail-after-state", ["--instrumented-debug", privatePath()]);
  assert.equal(result.code, 2);
  assert.ok(result.stdout.includes("CREATE_CLI_STATUS=EXIT_1"));
  assert.ok(result.stderr.includes("CREATE_UNCONFIRMED_NAME="));
  assert.deepEqual(verbs(), ["ls", "-D"]);
  assert.ok(existsSync(join(root, "state")));
});

for (const signal of ["SIGTERM", "SIGINT"]) {
  check(`instrumented ${signal} terminates its own CLI`, async () => {
    let childPid;
    let signaled = false;
    const result = await invoke("create-stopped-after-state", ["--instrumented-debug", privatePath()], {
      onLine(line) {
        if (line.startsWith("CREATE_CLI_PID=")) childPid = Number(line.split(" ")[0].split("=")[1]);
        if (line.startsWith("CREATE_SAMPLE_SEC=") && line.includes("STATE=T") && !signaled) {
          const status = readFileSync(`/proc/${childPid}/status`, "utf8");
          const observerPid = Number(/^PPid:\s+([0-9]+)/m.exec(status)[1]);
          const command = readFileSync(`/proc/${observerPid}/cmdline`, "utf8");
          assert.ok(command.includes("create-debug.mjs"));
          process.kill(observerPid, signal);
          signaled = true;
        }
      },
    });
    assert.ok(signaled);
    assert.equal(result.code, 2, result.stderr);
    assert.ok(result.stdout.includes("CREATE_CLI_STATUS=INTERRUPTED"));
    assert.ok(result.stderr.includes("CREATE_UNCONFIRMED_NAME="));
    assert.deepEqual(verbs(), ["ls", "-D"]);
    assertDead(childPid);
  });
}

check("instrumented log size is capped while excess output drains", async () => {
  const privateDir = privatePath();
  const result = await invoke("create-debug-flood", ["--instrumented-debug", privateDir]);
  assert.equal(result.code, 0, result.stderr);
  const counts = /CREATE_LOG_BYTES=([0-9]+) CREATE_LOG_DROPPED=([0-9]+)/.exec(result.stdout);
  assert.equal(Number(counts[1]), 1024 * 1024);
  assert.equal(Number(counts[1]) + Number(counts[2]), 2 * 1024 * 1024 + Buffer.byteLength("PRIVATE_DEBUG_SENTINEL\n"));
  assert.equal((result.stdout + result.stderr).includes("PRIVATE_DEBUG_SENTINEL"), false);
  assert.equal(statSync(join(privateDir, readdirSync(privateDir)[0])).size, 1024 * 1024);
});

check("instrumented exec failure removes the confirmed name", async () => {
  const result = await invoke("exec-fail", ["--instrumented-debug", privatePath()]);
  assert.equal(result.code, 2);
  assert.ok(result.stderr.includes("EXEC_FAILED_NAME="));
  assert.ok(result.stdout.includes("NAME_ABSENT_AFTER_RM="));
  assert.deepEqual(verbs(), ["ls", "-D", "ls", "exec", "rm", "ls"]);
});

check("instrumented nonprivate evidence refuses before creating", async () => {
  const publicDir = join(root, "public");
  mkdirSync(publicDir, { mode: 0o755 });
  const result = await invoke("success", ["--instrumented-debug", publicDir]);
  assert.equal(result.code, 2);
  assert.ok(result.stderr.includes("STOP: instrumented create failed"));
  assert.deepEqual(calls(), [["ls", "-q"]]);
  assert.deepEqual(readdirSync(publicDir), []);
});

check("instrumented symlink evidence and existing logs refuse without replacement", async () => {
  const privateDir = privatePath();
  const alias = join(root, "alias");
  symlinkSync(privateDir, alias, "dir");
  const result = await invoke("success", ["--instrumented-debug", alias]);
  assert.equal(result.code, 2);
  assert.deepEqual(calls(), [["ls", "-q"]]);
  const existing = join(privateDir, `${NAME}.debug.log`);
  writeFileSync(existing, "keep");
  const direct = await debug();
  assert.equal(direct.code, 2);
  assert.equal(readFileSync(existing, "utf8"), "keep");
  assert.deepEqual(calls(), [["ls", "-q"]]);
});

check("private directory validation rejects noncanonical and symlinked ancestors", () => {
  const privateDir = privatePath();
  const alias = join(root, "alias");
  symlinkSync(root, alias, "dir");
  for (const path of ["relative", `${privateDir}/`, `${root}//private`, `${root}/./private`, `${privateDir}/../private`, `${alias}/private`]) {
    assert.throws(() => privateDirectory(path), undefined, path);
  }
});

check("private directory validation rejects writable parents and non-0700 leaves", () => {
  const parent = join(root, "parent");
  const leaf = join(parent, "private");
  mkdirSync(parent, { mode: 0o700 });
  mkdirSync(leaf, { mode: 0o700 });
  for (const mode of [0o722, 0o777]) {
    chmodSync(parent, mode);
    assert.throws(() => privateDirectory(leaf));
  }
  chmodSync(parent, 0o700);
  for (const mode of [0o500, 0o755, 0o1700]) {
    chmodSync(leaf, mode);
    assert.throws(() => privateDirectory(leaf));
  }
  chmodSync(leaf, 0o700);
  const parentFd = privateDirectory(leaf);
  closeSync(parentFd);
});

check("private log creation stays anchored when the directory pathname changes", () => {
  const privateDir = privatePath();
  const moved = join(root, "moved");
  const fd = privateDirectory(privateDir);
  try {
    renameSync(privateDir, moved);
    mkdirSync(privateDir, { mode: 0o700 });
    const log = createPrivateLog(fd, NAME);
    try {
      assert.equal(fstatSync(log).mode & 0o777, 0o600);
    } finally {
      closeSync(log);
    }
    assert.deepEqual(readdirSync(privateDir), []);
    assert.deepEqual(readdirSync(moved), [`${NAME}.debug.log`]);
  } finally {
    closeSync(fd);
  }
});

check("private log creation refuses symlinks and name traversal", () => {
  const privateDir = privatePath();
  const target = join(root, "target");
  writeFileSync(target, "keep");
  symlinkSync(target, join(privateDir, `${NAME}.debug.log`));
  const fd = privateDirectory(privateDir);
  try {
    assert.throws(() => createPrivateLog(fd, NAME));
    assert.throws(() => createPrivateLog(fd, "../target"));
    assert.throws(() => createPrivateLog(fd, `${NAME}\n`));
    assert.equal(readFileSync(target, "utf8"), "keep");
  } finally {
    closeSync(fd);
  }
});

check("instrumented scope and executable validation run before the fake CLI", async () => {
  for (const args of [
    ["--seconds", "0"], ["--seconds", "61"], ["--seconds", "1.5"],
    ["--name", `${NAME}\n`], ["--name", "../target"],
    ["--sbx", "relative"], ["--sbx", root], ["--unknown", "value"],
  ]) {
    const result = await debug(args);
    assert.equal(result.code, 2, JSON.stringify(args));
    assert.equal(result.stdout, "");
    assert.deepEqual(calls(), []);
    assert.deepEqual(readdirSync(privatePath()), []);
  }
});

check("instrumented help preserves a CLI-free successful exit", async () => {
  for (const flag of ["--help", "-h"]) {
    const result = await request([process.execPath, DEBUG, flag]);
    assert.equal(result.code, 0);
    assert.ok(result.stdout.startsWith("usage: create-debug.mjs "));
    assert.equal(result.stderr, "");
    assert.deepEqual(calls(), []);
  }
});

check("instrumented maximum create deadline accepts an immediately successful fake", async () => {
  const result = await debug(["--seconds", "60"]);
  assert.equal(result.code, 0, result.stderr);
  assert.ok(result.stdout.includes("CREATE_CLI_STATUS=EXIT_0"));
  assert.deepEqual(verbs(), ["-D"]);
});

check("instrumented deadline signals only the direct child and bounds inherited-pipe draining", async () => {
  let cleanupError;
  try {
    const beginning = performance.now();
    const result = await invoke("create-descendant", ["--instrumented-debug", privatePath()]);
    assert.equal(result.code, 2, result.stderr);
    assert.ok(result.stdout.includes("CREATE_CLI_STATUS=DEADLINE"));
    assert.deepEqual(verbs(), ["ls", "-D"]);
    assertDead();
    const witnessPid = Number(readFileSync(join(root, "witness-pid"), "utf8"));
    const state = /^State:\s+(\S+)/m.exec(readFileSync(`/proc/${witnessPid}/status`, "utf8"))[1];
    assert.equal(["Z", "X"].includes(state), false, "the observer signaled a descendant");
    assert.ok(performance.now() - beginning < 10_000);
  } finally {
    const path = join(root, "witness-pid");
    if (existsSync(path)) {
      try {
        process.kill(Number(readFileSync(path, "utf8")), "SIGKILL");
      } catch (error) {
        if (error.code !== "ESRCH") cleanupError = error;
      }
    }
  }
  assert.ifError(cleanupError);
});
