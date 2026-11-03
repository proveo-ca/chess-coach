// SPEC: _spec/tooling/native-ingress/f9-diagnostic.puml
import { afterEach, beforeEach, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { guestScript, parseGuest, runBounded } from "../f9-diagnose.mjs";
import { requirements } from "../f9-requirements.mjs";

const name = `devrust-${"a".repeat(24)}`;
const script = new URL("../f9-diagnose.mjs", import.meta.url).pathname;
const tools = ["tar", "sha256sum", "timeout", "gpgv", "patch", "make", "clang", "ld.bfd", "readelf", "node", "rustc", "cargo", "zig"];
const guest = ["F9_GUEST_CAPABILITIES_V1", "UID=10001", "FD_SOFT=1024", "WORKSPACE=WRITABLE", ...tools.map((tool) => `TOOL_${tool}=MISSING`), "SEEDED_RUST=UNAVAILABLE", "GUEST_DONE=YES", ""].join("\n");
let root, fake;
beforeEach(() => {
  root = mkdtempSync("/tmp/opencode/f9-diagnostic-");
  fake = join(root, "sbx");
  writeFileSync(fake, `#!${process.execPath}
import { appendFileSync } from "node:fs";
const args = process.argv.slice(2);
const mode = process.env.FAKE_DIAGNOSTIC_MODE;
appendFileSync(process.env.FAKE_DIAGNOSTIC_CALLS, JSON.stringify(args) + "\\n");
const at = args[0] === 'ls' ? 'lookup' : args[0] === 'policy' ? 'policy' : 'guest';
if (mode === at + '-fail') { console.error('PRIVATE_ERROR_NEVER_PRINT'); process.exit(1); }
if (mode === at + '-overflow') { process.stdout.write('x'.repeat(100000)); process.exit(0); }
if (args[0] === 'ls') {
  if (mode !== 'missing') console.log(${JSON.stringify(name)});
  if (mode === 'duplicate') console.log(${JSON.stringify(name)});
  if (mode === 'malformed-lookup') console.log('PRIVATE_INVALID=[]');
} else if (args[0] === 'policy') {
  if (mode !== 'empty-policy') console.log('PRIVATE_POLICY_NEVER_PRINT');
} else if (args[0] === 'exec') {
  let result = ${JSON.stringify(guest)};
  if (mode === 'all-tools') result = result.replaceAll('MISSING', 'PRESENT').replace('SEEDED_RUST=UNAVAILABLE', 'SEEDED_RUST=EXECUTABLES_PRESENT');
  process.stdout.write(mode === 'malformed' ? 'PRIVATE_GUEST_NEVER_PRINT' : result);
} else process.exit(99);
`);
  chmodSync(fake, 0o755);
});
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

function invoke(mode = "", args = ["--sbx", fake, "--name", name, "--confirm-dev-diagnostic"]) {
  const result = spawnSync(process.execPath, [script, ...args], {
    env: { ...process.env, FAKE_DIAGNOSTIC_MODE: mode, FAKE_DIAGNOSTIC_CALLS: join(root, "calls") },
    encoding: "utf8", timeout: 10000,
  });
  expect(result.error).toBeUndefined();
  expect(result.stderr).toBe("");
  return { ...result, report: JSON.parse(result.stdout) };
}
function calls() {
  return existsSync(join(root, "calls")) ? readFileSync(join(root, "calls"), "utf8").trim().split("\n").map(JSON.parse) : [];
}

test("full live diagnostic protocol completes without granting F9 readiness", () => {
  const result = invoke();
  expect(result.status).toBe(2);
  expect(result.report.diagnosticComplete).toBe(true);
  expect(result.report.liveGuestObserved).toBe(true);
  expect(result.report.result).toBe("STOP");
  expect(result.report.trainingReady).toBe(false);
  expect(result.report.requirements.length).toBe(requirements.length);
  expect(result.report.requirements.every((gate) => gate.status === "BLOCKED")).toBe(true);
  expect(result.report.guest.TOOL_cargo).toBe("MISSING");
  expect(calls()).toEqual([
    ["ls", "-q"], ["policy", "ls", "--wide", name], ["exec", name, "/usr/bin/timeout", "--kill-after=1s", "8s", "/bin/sh", "-c", guestScript],
  ]);
  expect(result.stdout).not.toContain("PRIVATE_");
  expect(Buffer.byteLength(result.stdout)).toBeLessThan(128 * 1024);
});

test("catalogue covers N1–N10 and G1–G5 with actionable source references", () => {
  const ids = requirements.map((gate) => gate.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids.slice().sort()).toEqual([
    ...Array.from({ length: 10 }, (_, index) => `N${index + 1}`),
    ...Array.from({ length: 5 }, (_, index) => `G${index + 1}`),
    ...Array.from({ length: 5 }, (_, index) => `GATE.${index}`),
    ...["a", "b", "c", "d"].map((suffix) => `GATE.5${suffix}`),
    ...Array.from({ length: 4 }, (_, index) => `HOST.${index + 1}`),
    "HOST.QUOTA", "POLICY.FULL", "CREATOR.A", "INIT.B", "NODE.MAIN", "NODE.REFERENCE",
    ...["MAIN", "REFERENCE"].flatMap((endpoint) => [0, 1, 2].map((fd) => `FD.${endpoint}.${fd}`)),
    "S0", "FIRST_EFFECT", "R4", "R5",
  ].sort());
  for (const [prefix, count] of [["N", 10], ["G", 5]]) {
    for (let index = 1; index <= count; index++) expect(ids).toContain(`${prefix}${index}`);
  }
  for (const gate of requirements) {
    expect(gate.nextStep.length).toBeGreaterThan(0);
    const [path, anchor] = gate.source.split("#");
    const source = readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");
    if (anchor) {
      const headings = [...source.matchAll(/^#{1,6} (.+)$/gm)].map((match) => match[1].toLowerCase().replace(/[^\w -]/g, "").replaceAll(" ", "-"));
      expect(headings).toContain(anchor);
    }
  }
});

test("all visible tools still cannot manufacture an F9 PASS", () => {
  const { report } = invoke("all-tools");
  expect(report.diagnosticComplete).toBe(true);
  expect(report.guest.TOOL_cargo).toBe("PRESENT");
  expect(report.f9Qualified).toBe(false);
  expect(report.trainingReady).toBe(false);
  expect(report.requirements.every((gate) => gate.status === "BLOCKED" && gate.execution === "NOT_RUN" && gate.verifier === null)).toBe(true);
});

test.each([
  ["missing", "VM_LOOKUP", 1], ["duplicate", "VM_LOOKUP", 1], ["lookup-fail", "VM_LOOKUP", 1],
  ["lookup-overflow", "VM_LOOKUP", 1], ["malformed-lookup", "VM_LOOKUP", 1], ["policy-fail", "POLICY_READBACK", 2], ["policy-overflow", "POLICY_READBACK", 2],
  ["empty-policy", "POLICY_READBACK", 2], ["guest-fail", "GUEST_EXEC", 3], ["guest-overflow", "GUEST_EXEC", 3], ["malformed", "GUEST_EXEC", 3],
])("%s stops at %s with no retry or extra operations", (mode, stage, count) => {
  const { report, stdout } = invoke(mode);
  expect(report.probes[stage].status).toBe("FAIL");
  expect(report.diagnosticComplete).toBe(false);
  expect(report.liveGuestObserved).toBe(false);
  expect(report.result).toBe("STOP");
  expect(calls()).toHaveLength(count);
  expect(stdout).not.toContain("PRIVATE_");
});

test("unknown, duplicate, injected, missing-confirmation and symlink inputs refuse before sbx", () => {
  const alias = join(root, "alias"); symlinkSync(fake, alias);
  for (const args of [
    [], ["--sbx", fake, "--name", name],
    ["--sbx", fake, "--name", "--bad", "--confirm-dev-diagnostic"],
    ["--sbx", fake, "--name", name, "--name", name, "--confirm-dev-diagnostic"],
    ["--sbx", fake, "--name", name, "--confirm-dev-diagnostic", "--approve=PRIVATE_SECRET"],
    ["--sbx", alias, "--name", name, "--confirm-dev-diagnostic"],
  ]) {
    const result = invoke("", args);
    expect(result.status).toBe(2);
    expect(result.report.probes.PREFLIGHT.status).toBe("FAIL");
    expect(result.report.probes.VM_LOOKUP.status).toBe("NOT_RUN");
    expect(result.stdout).not.toContain("PRIVATE_SECRET");
    expect(calls()).toEqual([]);
  }
});

test("plan mode prints the frozen operation scope without executing or inspecting sbx", () => {
  const { report } = invoke("", ["--sbx", "/nonexistent/sbx", "--name", name, "--plan"]);
  expect(report.mode).toBe("PLAN_ONLY");
  expect(report.liveGuestObserved).toBe(false);
  expect(report.plan).toHaveLength(3);
  expect(report.plan[2].argv).toContain("/usr/bin/timeout");
  expect(report.probes.VM_LOOKUP.status).toBe("NOT_RUN");
  expect(calls()).toEqual([]);
});

test("guest protocol refuses incomplete, duplicate, unrecognized and control-character data", () => {
  expect(parseGuest(guest).UID).toBe("10001");
  for (const output of [guest.replace("GUEST_DONE=YES", ""), guest + "UID=0\n", guest + "EXTRA=YES\n", guest.replace("UID=10001", "UID=\u001b[31m10001"), guest.replace("TOOL_cargo=MISSING", "TOOL_cargo=CLAIMED")]) {
    expect(() => parseGuest(output)).toThrow();
  }
});

test("bounded runner stops hangs and output floods", async () => {
  const timeout = await runBounded([process.execPath, "-e", "setInterval(() => {}, 1000)"], { milliseconds: 100, cap: 64 });
  expect(timeout.ok).toBe(false);
  expect(timeout.outcome).toBe("TIMEOUT");
  const flood = await runBounded([process.execPath, "-e", "process.stdout.write('x'.repeat(10000))"], { milliseconds: 1000, cap: 64 });
  expect(flood.ok).toBe(false);
  expect(flood.outcome).toBe("OUTPUT_LIMIT");
  expect(Buffer.byteLength(flood.stdout)).toBeLessThanOrEqual(64);
});

test("bounded runner handles spawn failure and incomplete inherited pipes", async () => {
  const absent = await runBounded([join(root, "absent")], { milliseconds: 1000 });
  expect(absent.ok).toBe(false);
  expect(absent.outcome).toBe("SPAWN_ERROR");
  const descendant = await runBounded([process.execPath, "-e", "const {spawn}=require('node:child_process'); spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:['ignore',1,2]}).unref();"], { milliseconds: 2000 });
  expect(descendant.ok).toBe(false);
  expect(descendant.outcome).toBe("INCOMPLETE_STREAM");
});

test("interruption stops the owned CLI group and returns an explicit outcome", async () => {
  const pending = runBounded([process.execPath, "-e", "setInterval(() => {}, 1000)"], { milliseconds: 1000 });
  process.emit("SIGTERM");
  const result = await pending;
  expect(result.ok).toBe(false);
  expect(result.outcome).toBe("INTERRUPTED");
});

test("mise wiring adds only the separate diagnostic and retains static status", () => {
  const config = Bun.TOML.parse(readFileSync(new URL("../../../mise.toml", import.meta.url), "utf8"));
  expect(config.tasks["f9:diagnose"].run).toContain("exec bun tooling/native-ingress/f9-diagnose.mjs");
  expect(config.tasks["f9:status"].run).toContain("tooling/native-ingress/f9-status.sh");
  expect(config.tasks["dev:sbx:ml-smoke"]).toBeUndefined();
});
