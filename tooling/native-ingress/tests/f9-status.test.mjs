// SPEC: _spec/tooling/bun-first-party-tooling.puml
import { afterEach, beforeEach, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const SCRIPT = path.join(ROOT, "tooling/native-ingress/f9-status.sh");
const TASK = Bun.TOML.parse(fs.readFileSync(path.join(ROOT, "mise.toml"), "utf8")).tasks["f9:status"];
let root, marker, env;

beforeEach(() => {
  root = fs.mkdtempSync("/tmp/opencode/f9-status-");
  marker = path.join(root, "called");
  for (const name of ["sbx", "mise", "cargo", "systemctl", "curl", ["py", "thon"].join(""), ["py", "thon3"].join(""), "bun"]) {
    fs.writeFileSync(path.join(root, name), `#!${process.execPath}\nimport { appendFileSync } from "node:fs";\nappendFileSync(process.env.POISON_MARKER, "called\\n");\nprocess.exit(97);\n`, { mode: 0o755 });
  }
  env = { ...process.env, PATH: root, POISON_MARKER: marker, F9_HOST_GUARD: path.join(root, "sbx"), F9_PROVENANCE_VERIFIER: path.join(root, "sbx"), F9_DEDICATED_UNIT: "claimed-ready.service" };
});

afterEach(() => {
  try {
    expect(fs.existsSync(marker)).toBe(false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function run(args, options = {}) {
  const result = spawnSync("/usr/bin/bash", ["-p", ...args], { env, encoding: "utf8", timeout: 5000, ...options });
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  return result;
}

test("fixed STOP with claimed provider environment", () => {
  const result = run([SCRIPT]);
  expect(result.status).toBe(2);
  expect(result.stderr).toBe("");
  const lines = result.stdout.trimEnd().split("\n");
  expect(lines.slice(0, 3)).toEqual(["F9_OFFLINE_STATUS_V1", "MODE=STATIC_PREREQUISITES_ONLY", "EVIDENCE=NOT_INSPECTED"]);
  expect(lines).toContain("GATE0=REQUIRES_ACCEPTED_PLAN");
  expect(lines).toContain("5D_NATIVE=REQUIRES_SEPARATE_APPROVAL_AND_NATIVE_PROOF");
  expect(lines.slice(-2)).toEqual(["TRAINING_READY=false", "RESULT=STOP"]);
  expect(result.stdout + result.stderr).not.toContain("PASS");
});

test("arguments refuse before reporting or echoing values", () => {
  const result = run([SCRIPT, "--approve", "secret-value"]);
  expect(result.status).toBe(2);
  expect(result.stdout).toBe("RESULT=STOP\n");
  expect(result.stderr).toBe("STOP: f9:status accepts no arguments\n");
  expect(result.stdout + result.stderr).not.toContain("secret-value");
});

test("mise task refuses without helper and never invokes providers", () => {
  expect(TASK.raw_args).toBe(true);
  expect(TASK.run.split("tooling/native-ingress/f9-status.sh").length - 1).toBe(3);
  const result = run(["-c", TASK.run], { cwd: root });
  expect(result.status).toBe(2);
  expect(result.stdout).toBe("RESULT=STOP\n");
  expect(result.stderr).toBe("");
});

test("mise task delegates without invoking providers", () => {
  const helper = path.join(root, "tooling/native-ingress/f9-status.sh");
  fs.mkdirSync(path.dirname(helper), { recursive: true });
  fs.copyFileSync(SCRIPT, helper);
  const result = run(["-c", TASK.run], { cwd: root });
  expect(result.status).toBe(2);
  expect(result.stdout).toBe(run([SCRIPT]).stdout);
  expect(result.stderr).toBe("");
});

test("mise task refuses a symlinked helper", () => {
  const helper = path.join(root, "tooling/native-ingress/f9-status.sh");
  fs.mkdirSync(path.dirname(helper), { recursive: true });
  fs.symlinkSync(SCRIPT, helper);
  const result = run(["-c", TASK.run], { cwd: root });
  expect(result.status).toBe(2);
  expect(result.stdout).toBe("RESULT=STOP\n");
  expect(result.stderr).toBe("");
});

test("mise task forwards arguments into fixed STOP", () => {
  const helper = path.join(root, "tooling/native-ingress/f9-status.sh");
  fs.mkdirSync(path.dirname(helper), { recursive: true });
  fs.copyFileSync(SCRIPT, helper);
  const result = run(["-c", TASK.run, "f9:status", "--approve", "secret-value"], { cwd: root });
  expect(result.status).toBe(2);
  expect(result.stdout).toBe("RESULT=STOP\n");
  expect(result.stderr).toBe("STOP: f9:status accepts no arguments\n");
  expect(result.stdout + result.stderr).not.toContain("secret-value");
});
