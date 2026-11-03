#!/usr/bin/env bun
// SPEC: _spec/tooling/bun-first-party-tooling.puml
import { spawn } from "node:child_process";
import {
  accessSync,
  closeSync,
  constants,
  fchmodSync,
  fstatSync,
  openSync,
  readFileSync,
  statSync,
  writeSync,
} from "node:fs";
import { constants as osConstants } from "node:os";
import { isAbsolute, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { parseArgs } from "node:util";

const MAX_LOG = 1024 * 1024;
const NAME = /^f9smoke-[0-9a-f]{24}$/;
const WAIT_CHANNEL = /^[a-zA-Z0-9_]{1,64}$/;

export function privateDirectory(path) {
  if (!isAbsolute(path) || path !== resolve(path)) {
    throw new Error("use a canonical absolute evidence directory");
  }
  const validateParent = (fd) => {
    const details = fstatSync(fd);
    if (details.uid !== 0 && details.uid !== process.getuid()) {
      throw new Error("untrusted evidence directory owner");
    }
    if ((details.mode & 0o022) && !(details.uid === 0 && (details.mode & 0o1000))) {
      throw new Error("writable evidence parent directory");
    }
  };
  let current = openSync("/", constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try {
    validateParent(current);
    for (const component of path.split("/").slice(1)) {
      if (!component) continue;
      const next = openSync(
        `/proc/self/fd/${current}/${component}`,
        constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
      );
      closeSync(current);
      current = next;
      validateParent(current);
    }
    const details = fstatSync(current);
    if (details.uid !== process.getuid() || (details.mode & 0o7777) !== 0o700) {
      throw new Error("evidence directory must be private and user-owned");
    }
    return current;
  } catch (error) {
    closeSync(current);
    throw error;
  }
}

export function createPrivateLog(parent, name) {
  if (name.length !== 32 || !NAME.test(name)) throw new Error("invalid smoke name");
  const fd = openSync(
    `/proc/self/fd/${parent}/${name}.debug.log`,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
    0o600,
  );
  try {
    fchmodSync(fd, 0o600);
    return fd;
  } catch (error) {
    closeSync(fd);
    throw error;
  }
}

function statFields(pid) {
  const text = readFileSync(`/proc/${pid}/stat`, "ascii");
  const boundary = text.lastIndexOf(") ");
  if (boundary < 0) throw new Error("invalid process stat");
  const fields = text.slice(boundary + 2).trim().split(/\s+/);
  if (!/^[0-9]+$/.test(fields[19] ?? "")) throw new Error("invalid start ticks");
  return fields;
}

function startTime(pid) {
  try {
    return statFields(pid)[19];
  } catch {
    return "UNKNOWN";
  }
}

function snapshot(pid, started) {
  if (started === "UNKNOWN") return ["UNAVAILABLE", "UNKNOWN"];
  try {
    const fields = statFields(pid);
    if (fields[19] !== started) return ["REUSED", "UNKNOWN"];
    const channel = readFileSync(`/proc/${pid}/wchan`, "ascii").trim();
    if (statFields(pid)[19] !== started) return ["REUSED", "UNKNOWN"];
    return [
      fields[0].length === 1 ? fields[0] : "UNKNOWN",
      channel.length <= 64 && WAIT_CHANNEL.test(channel) ? channel : "UNKNOWN",
    ];
  } catch {
    return ["UNAVAILABLE", "UNKNOWN"];
  }
}

async function run(sbx, name, seconds, logFd) {
  let interrupted = false;
  const onSignal = () => { interrupted = true; };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
  let child;
  let exited = false;
  let code;
  let spawnError;
  let stored = 0;
  let dropped = 0;
  let logFailed = false;
  const retain = (block) => {
    const size = Math.min(block.length, MAX_LOG - stored);
    let written = 0;
    if (!logFailed) {
      try {
        while (written < size) {
          const amount = writeSync(logFd, block, written, size - written);
          if (amount === 0) throw new Error("debug log write made no progress");
          written += amount;
          stored += amount;
        }
      } catch {
        logFailed = true;
      }
    }
    dropped += block.length - written;
  };
  try {
    child = spawn(sbx, [
      "-D", "create", "--name", name, "--pull", "never", "--skills", "off",
      "--deny-network", "**", "--cpus", "1", "--memory", "512m", "shell",
    ], { stdio: ["ignore", "pipe", "pipe"], detached: true });
    child.on("error", (error) => { spawnError = error; });
    child.on("exit", (exitCode, signal) => {
      exited = true;
      code = exitCode ?? -(osConstants.signals[signal] ?? 1);
    });
    child.stdout.on("data", retain);
    child.stderr.on("data", retain);
    child.stdout.on("error", () => { logFailed = true; });
    child.stderr.on("error", () => { logFailed = true; });
    const started = child.pid ? startTime(child.pid) : "UNKNOWN";
    console.log(`CREATE_CLI_PID=${child.pid ?? "UNKNOWN"} CREATE_CLI_START_TICKS=${started}`);
    const beginning = performance.now();
    const deadline = beginning + seconds * 1000;
    let sampleAt = beginning + Math.min(250, seconds * 250);
    let sentTerm = null;
    let sentKill = false;
    let exitedAt = null;
    while (true) {
      const now = performance.now();
      if (spawnError) throw spawnError;
      if (exited && exitedAt === null) exitedAt = now;
      if (!exited && sentTerm === null && (now >= deadline || interrupted || logFailed)) {
        child.kill("SIGTERM");
        sentTerm = now;
      }
      if (!exited && sentTerm !== null && now - sentTerm >= 2000 && !sentKill) {
        child.kill("SIGKILL");
        sentKill = true;
      }
      if (!exited && now >= sampleAt) {
        const [state, channel] = snapshot(child.pid, started);
        console.log(`CREATE_SAMPLE_SEC=${Math.floor((now - beginning) / 1000)} STATE=${state} WCHAN=${channel}`);
        sampleAt = now + 5000;
      }
      if (exited && ((child.stdout.readableEnded && child.stderr.readableEnded) || now - exitedAt >= 1000)) break;
      if (now >= deadline + 4000) break;
      await delay(100);
    }
    console.log(`CREATE_LOG_BYTES=${stored} CREATE_LOG_DROPPED=${dropped}`);
    if (!exited) {
      console.log("CREATE_CLI_STATUS=SURVIVED_DEADLINE");
      return 2;
    }
    if (logFailed) {
      console.log("CREATE_CLI_STATUS=LOG_WRITE_FAILED");
      return 2;
    }
    if (interrupted) {
      console.log("CREATE_CLI_STATUS=INTERRUPTED");
      return 2;
    }
    if (sentTerm !== null) {
      console.log("CREATE_CLI_STATUS=DEADLINE");
      return 2;
    }
    console.log(`CREATE_CLI_STATUS=EXIT_${code}`);
    return code === 0 ? 0 : 2;
  } finally {
    if (child) {
      child.stdout?.destroy();
      child.stderr?.destroy();
      if (!exited && child.pid) {
        child.kill("SIGKILL");
        const until = performance.now() + 1000;
        while (!exited && !spawnError && performance.now() < until) await delay(25);
      }
      if (!exited) child.unref();
    }
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
  }
}

async function main() {
  let args;
  try {
    args = parseArgs({
      options: {
        sbx: { type: "string" },
        name: { type: "string" },
        seconds: { type: "string" },
        "evidence-dir": { type: "string" },
        help: { type: "boolean", short: "h" },
      },
      allowPositionals: false,
    }).values;
    if (args.help) {
      console.log("usage: create-debug.mjs --sbx ABSOLUTE_EXECUTABLE --name f9smoke-HEX24 --seconds 1..60 --evidence-dir ABSOLUTE_PRIVATE_DIRECTORY");
      return 0;
    }
    delete args.help;
    if (Object.values(args).length !== 4) throw new Error("missing arguments");
  } catch {
    console.error("STOP: invalid instrumented create arguments");
    return 2;
  }
  const seconds = Number(args.seconds);
  if (args.name.length !== 32 || !NAME.test(args.name) || !/^[+-]?[0-9]+$/.test(args.seconds) || !Number.isInteger(seconds) || seconds < 1 || seconds > 60) {
    console.error("STOP: invalid instrumented create scope");
    return 2;
  }
  try {
    if (!isAbsolute(args.sbx) || !statSync(args.sbx).isFile()) throw new Error("invalid executable");
    accessSync(args.sbx, constants.X_OK);
  } catch {
    console.error("STOP: invalid sbx executable");
    return 2;
  }
  try {
    const parent = privateDirectory(args["evidence-dir"]);
    let logFd;
    try {
      logFd = createPrivateLog(parent, args.name);
    } finally {
      closeSync(parent);
    }
    try {
      console.log(`CREATE_DEBUG_PRIVATE_FILE=${args.name}.debug.log`);
      return await run(args.sbx, args.name, seconds, logFd);
    } finally {
      closeSync(logFd);
    }
  } catch (error) {
    console.error(`STOP: instrumented create failed (${error instanceof TypeError ? "TypeError" : "Error"})`);
    return 2;
  }
}

if (import.meta.main) process.exitCode = await main();
