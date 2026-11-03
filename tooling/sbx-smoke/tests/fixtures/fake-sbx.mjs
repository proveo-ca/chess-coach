// SPEC: _spec/tooling/bun-first-party-tooling.puml
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  appendFileSync, existsSync, readFileSync, unlinkSync, writeFileSync, writeSync,
} from "node:fs";
import { join } from "node:path";

const root = process.env.FAKE_SBX_HOME;
const mode = process.env.FAKE_SBX_MODE ?? "success";
let args = process.argv.slice(2);
if (args[0] === "witness") {
  writeFileSync(join(root, "witness-pid"), String(process.pid));
  await new Promise(() => { setInterval(() => {}, 1000); });
}
appendFileSync(join(root, "calls"), `${JSON.stringify(args)}\n`);
if (args[0] === "-D") {
  args = args.slice(1);
  writeSync(2, "PRIVATE_DEBUG_SENTINEL\n");
}
const state = join(root, "state");
if (JSON.stringify(args) === JSON.stringify(["ls", "-q"])) {
  const count = join(root, "list-count");
  const number = existsSync(count) ? Number(readFileSync(count, "utf8")) + 1 : 1;
  writeFileSync(count, String(number));
  if (mode === "list-overflow") {
    writeSync(1, Buffer.alloc(70_000, "x"));
    process.exit(0);
  }
  if ((mode === "list-fail-before" && number === 1)
    || (mode === "list-fail-after" && number === 2)
    || (mode === "list-fail-remove" && number === 3)) process.exit(1);
  console.log("unrelated-sandbox");
  if (mode === "preexisting" && number === 1) {
    const until = performance.now() + 5000;
    while (!existsSync(join(root, "preexisting")) && performance.now() < until) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }
    console.log(readFileSync(join(root, "preexisting"), "utf8"));
  }
  if (existsSync(state)) console.log(readFileSync(state, "utf8"));
} else if (args[0] === "create") {
  assert.equal(args.length, 14);
  assert.equal(args[1], "--name");
  assert.deepEqual(args.slice(3), [
    "--pull", "never", "--skills", "off", "--deny-network", "**",
    "--cpus", "1", "--memory", "512m", "shell",
  ]);
  writeFileSync(state, args[2]);
  if (mode === "create-debug-flood") {
    const flood = Buffer.alloc(2 * 1024 * 1024, "x");
    let offset = 0;
    while (offset < flood.length) {
      try {
        offset += writeSync(2, flood, offset, flood.length - offset);
      } catch (error) {
        if (error.code !== "EAGAIN" && error.code !== "EWOULDBLOCK") throw error;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1);
      }
    }
  }
  if (mode === "create-descendant") {
    spawn(process.execPath, [import.meta.filename, "witness"], { stdio: ["ignore", 1, 2] });
    const until = performance.now() + 5000;
    while (!existsSync(join(root, "witness-pid")) && performance.now() < until) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }
    assert.ok(existsSync(join(root, "witness-pid")));
  }
  if (["create-stopped-after-state", "create-term-resistant", "create-descendant"].includes(mode)) {
    writeFileSync(join(root, "create-pid"), String(process.pid));
    if (mode === "create-term-resistant") process.on("SIGTERM", () => {});
    process.kill(process.pid, "SIGSTOP");
  }
  if (mode === "create-fail-after-state") process.exit(1);
  if (mode === "create-success-unlisted") unlinkSync(state);
} else if (args[0] === "exec") {
  assert.deepEqual(args, ["exec", readFileSync(state, "utf8"), "/bin/true"]);
  if (mode === "exec-fail") process.exit(1);
} else if (args[0] === "rm") {
  assert.deepEqual(args, ["rm", "--force", readFileSync(state, "utf8")]);
  if (mode === "remove-fail") process.exit(1);
  if (mode !== "remove-still-listed") unlinkSync(state);
} else {
  throw new Error("unexpected sbx invocation");
}
