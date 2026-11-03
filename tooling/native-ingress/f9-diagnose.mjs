#!/usr/bin/env bun
// SPEC: _spec/tooling/native-ingress/f9-diagnostic.puml
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, lstat } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { parseArgs } from "node:util";
import { requirements } from "./f9-requirements.mjs";

const tools = ["tar", "sha256sum", "timeout", "gpgv", "patch", "make", "clang", "ld.bfd", "readelf", "node", "rustc", "cargo", "zig"];
export const guestScript = `set -eu
printf 'F9_GUEST_CAPABILITIES_V1\\n'
if command -v id >/dev/null 2>&1; then printf 'UID=%s\\n' "$(id -u)"; else printf 'UID=UNAVAILABLE\\n'; fi
printf 'FD_SOFT=%s\\n' "$(ulimit -n 2>/dev/null || printf UNAVAILABLE)"
if test -d /home/agent/workspace && test -w /home/agent/workspace; then printf 'WORKSPACE=WRITABLE\\n'; else printf 'WORKSPACE=UNAVAILABLE\\n'; fi
for tool in ${tools.join(" ")}; do
  if command -v "$tool" >/dev/null 2>&1; then printf 'TOOL_%s=PRESENT\\n' "$tool"; else printf 'TOOL_%s=MISSING\\n' "$tool"; fi
done
if test -x /home/agent/workspace/devrust-tools/bin/cargo && test -x /home/agent/workspace/devrust-tools/bin/rustc; then printf 'SEEDED_RUST=EXECUTABLES_PRESENT\\n'; else printf 'SEEDED_RUST=UNAVAILABLE\\n'; fi
printf 'GUEST_DONE=YES\\n'
`;

export function buildPlan({ sbx, name }) {
  return [
    { id: "VM_LOOKUP", argv: [sbx, "ls", "-q"], milliseconds: 10000, cap: 65536 },
    { id: "POLICY_READBACK", argv: [sbx, "policy", "ls", "--wide", name], milliseconds: 10000, cap: 65536 },
    { id: "GUEST_EXEC", argv: [sbx, "exec", name, "/usr/bin/timeout", "--kill-after=1s", "8s", "/bin/sh", "-c", guestScript], milliseconds: 20000, cap: 16384 },
  ];
}

export function runBounded(argv, { milliseconds, cap = 65536 }) {
  return new Promise((resolve) => {
    const beginning = performance.now();
    const child = spawn(argv[0], argv.slice(1), { stdio: ["ignore", "pipe", "pipe"], detached: true });
    const chunks = { stdout: [], stderr: [] };
    let bytes = 0, failure = null, settled = false, drainTimer;
    const finish = (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      clearTimeout(drainTimer);
      clearTimeout(reapTimer);
      process.off("SIGINT", interrupted);
      process.off("SIGTERM", interrupted);
      child.stdout?.destroy(); child.stderr?.destroy();
      if (child.exitCode === null && child.signalCode === null) child.unref();
      resolve({
        ok: failure === null && code === 0 && signal === null,
        outcome: failure ?? "EXIT", code, signal,
        elapsedMs: Math.ceil(performance.now() - beginning), bytes,
        stdout: Buffer.concat(chunks.stdout).toString("utf8"),
        stderr: Buffer.concat(chunks.stderr).toString("utf8"),
      });
    };
    let reapTimer;
    const stop = (reason) => {
      if (failure !== null) return;
      failure = reason;
      if (child.pid) {
        try { process.kill(-child.pid, "SIGKILL"); } catch {}
      }
      reapTimer = setTimeout(() => finish(child.exitCode, child.signalCode), 2000);
    };
    const interrupted = () => stop("INTERRUPTED");
    process.on("SIGINT", interrupted);
    process.on("SIGTERM", interrupted);
    const deadline = setTimeout(() => stop("TIMEOUT"), milliseconds);
    for (const stream of ["stdout", "stderr"]) {
      child[stream].on("data", (chunk) => {
        const available = Math.max(0, cap - bytes);
        if (available) chunks[stream].push(chunk.subarray(0, available));
        bytes += chunk.length;
        if (bytes > cap) stop("OUTPUT_LIMIT");
      });
      child[stream].on("error", () => stop("STREAM_ERROR"));
    }
    child.on("error", () => stop("SPAWN_ERROR"));
    child.on("exit", () => { if (!settled) drainTimer = setTimeout(() => stop("INCOMPLETE_STREAM"), 500); });
    child.on("close", (code, signal) => finish(code, signal));
  });
}

export function parseGuest(output) {
  const lines = output.trimEnd().split("\n");
  if (lines.shift() !== "F9_GUEST_CAPABILITIES_V1") throw new Error("malformed guest header");
  const fields = new Map();
  for (const line of lines) {
    const match = /^([A-Z_]+|TOOL_[a-z0-9_.]+)=([A-Z_]+|[0-9]+|unlimited)$/.exec(line);
    if (!match || fields.has(match[1])) throw new Error("malformed or duplicate guest field");
    fields.set(match[1], match[2]);
  }
  const valid = (key, predicate) => {
    if (!predicate(fields.get(key))) throw new Error("invalid guest observation");
  };
  valid("UID", (value) => value === "UNAVAILABLE" || /^[0-9]+$/.test(value ?? ""));
  valid("FD_SOFT", (value) => value === "UNAVAILABLE" || value === "unlimited" || /^[0-9]+$/.test(value ?? ""));
  valid("WORKSPACE", (value) => ["WRITABLE", "UNAVAILABLE"].includes(value));
  valid("SEEDED_RUST", (value) => ["EXECUTABLES_PRESENT", "UNAVAILABLE"].includes(value));
  valid("GUEST_DONE", (value) => value === "YES");
  for (const tool of tools) valid(`TOOL_${tool}`, (value) => ["PRESENT", "MISSING"].includes(value));
  if (fields.size !== tools.length + 5) throw new Error("unexpected guest fields");
  return Object.fromEntries(fields);
}

export async function diagnose(argv) {
  const report = {
    schema: "f9-live-diagnostic-v1", scope: "DEVELOPMENT_RECONNAISSANCE_ONLY",
    diagnosticComplete: false, liveGuestObserved: false, f9Qualified: false,
    probes: Object.fromEntries(["PREFLIGHT", "VM_LOOKUP", "POLICY_READBACK", "GUEST_EXEC"].map((id) => [id, { status: "NOT_RUN" }])),
    requirements: requirements.map((requirement) => ({ ...requirement, status: "BLOCKED", execution: "NOT_RUN", verifier: null, reason: "Independent acceptance/evidence verifier is not connected to this diagnostic." })),
    trainingReady: false, result: "STOP",
  };
  let stage = "PREFLIGHT";
  try {
    const { values } = parseArgs({ args: argv, strict: true, allowPositionals: false, options: {
      sbx: { type: "string" }, name: { type: "string" }, "confirm-dev-diagnostic": { type: "boolean" }, plan: { type: "boolean" },
    } });
    const names = argv.filter((value) => value.startsWith("--")).map((value) => value.split("=")[0]);
    if (new Set(names).size !== names.length || (!values.plan && !values["confirm-dev-diagnostic"])
      || !values.sbx || values.sbx.length > 4096 || [...values.sbx].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
      || !isAbsolute(values.sbx) || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/.test(values.name ?? "")) throw new Error("invalid arguments");
    const plan = buildPlan(values);
    if (values.plan) {
      report.mode = "PLAN_ONLY";
      report.plan = plan;
      report.probes.PREFLIGHT = { status: "PASS", detail: "Syntax checks only; no executable or sbx inspection." };
      return report;
    }
    const stat = await lstat(values.sbx);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("invalid executable");
    await access(values.sbx, constants.X_OK);
    report.target = values.name;
    report.probes.PREFLIGHT = { status: "PASS", detail: "Argument and executable checks only; no host qualification." };
    const call = async (id, command, milliseconds, cap) => {
      stage = id;
      const result = await runBounded(command, { milliseconds, cap });
      const { stdout, stderr, ok, ...metadata } = result;
      report.probes[id] = { status: ok ? "PASS" : "FAIL", cliSucceeded: ok, ...metadata };
      if (!result.ok) throw new Error("probe refused");
      return { stdout, stderr };
    };
    const invoke = (index) => call(plan[index].id, plan[index].argv, plan[index].milliseconds, plan[index].cap);
    const listing = await invoke(0);
    const listed = listing.stdout.split("\n");
    if (listed.at(-1) === "") listed.pop();
    if (listing.stderr || !listed.every((line) => /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(line))
      || listed.filter((line) => line === values.name).length !== 1) throw new Error("target not uniquely listed");
    const policy = await invoke(1);
    if (!policy.stdout.trim()) throw new Error("policy listing empty");
    report.policy = {
      sha256: createHash("sha256").update(policy.stdout).digest("hex"),
      interpretation: "LISTING_RETRIEVED_NOT_ENFORCEMENT_PROOF",
    };
    const guest = await invoke(2);
    if (guest.stderr) throw new Error("unexpected guest stderr");
    report.guest = parseGuest(guest.stdout);
    report.liveGuestObserved = true;
    report.diagnosticComplete = true;
  } catch {
    report.probes[stage] = { ...report.probes[stage], status: "FAIL" };
    report.error = `${stage}: failed, malformed, interrupted or unconfirmed; reconcile before another attempt.`;
  }
  return report;
}

if (import.meta.main) {
  console.log(JSON.stringify(await diagnose(process.argv.slice(2)), null, 2));
  process.exitCode = 2;
}
