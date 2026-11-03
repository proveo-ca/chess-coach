// SPEC: _spec/tooling/native-ingress/f9-diagnostic.puml
import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import fs from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { formatDiagnosticSummary } from "../f9-summary.mjs";
import { main, readDiagnosticReport } from "../f9-explain.mjs";
import { requirements } from "../f9-requirements.mjs";

const refusal = "Executor, STOP: saved report could not be explained; F9 remains unqualified; trainingReady=false.";
const script = new URL("../f9-explain.mjs", import.meta.url).pathname;
const tools = ["tar", "sha256sum", "timeout", "gpgv", "patch", "make", "clang", "ld.bfd", "readelf", "node", "rustc", "cargo", "zig"];
const probeIds = ["PREFLIGHT", "VM_LOOKUP", "POLICY_READBACK", "GUEST_EXEC"];
const cap = 128 * 1024;
let root, reportPath, marker, bin;

function fixture() {
  return {
    schema: "f9-live-diagnostic-v1", scope: "DEVELOPMENT_RECONNAISSANCE_ONLY",
    diagnosticComplete: true, liveGuestObserved: true, f9Qualified: false,
    target: "devrust-0123456789abcdef01234567",
    probes: Object.fromEntries(probeIds.map((id) => [id, { status: "PASS" }])),
    requirements: requirements.map((row) => ({ ...row, status: "BLOCKED", execution: "NOT_RUN", verifier: null, reason: "PRIVATE_REASON\u001b[31m" })),
    guest: {
      UID: "1000", FD_SOFT: "1024", WORKSPACE: "WRITABLE",
      ...Object.fromEntries(tools.map((tool) => [`TOOL_${tool}`, ["rustc", "cargo", "clang", "zig"].includes(tool) ? "MISSING" : "PRESENT"])),
      SEEDED_RUST: "EXECUTABLES_PRESENT", GUEST_DONE: "YES",
    },
    trainingReady: false, result: "STOP",
  };
}

beforeEach(() => {
  root = fs.mkdtempSync("/tmp/opencode/f9-explain-");
  reportPath = join(root, "report.json");
  marker = join(root, "called");
  bin = join(root, "bin");
  fs.mkdirSync(bin);
  for (const name of ["mise", "sbx", "rustc", "cargo", "clang", "zig"]) {
    fs.writeFileSync(join(bin, name), `#!${process.execPath}\nimport { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(marker)}, "called");\nprocess.exit(97);\n`, { mode: 0o755 });
  }
  fs.writeFileSync(reportPath, JSON.stringify(fixture()), { mode: 0o644 });
});

afterEach(() => {
  mock.restore();
  try { expect(fs.existsSync(marker)).toBe(false); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
});

function invoke(args = ["--report", reportPath], env = {}) {
  const result = spawnSync(process.execPath, ["--no-env-file", "--no-install", script, ...args], {
    env: { ...process.env, PATH: "/nonexistent", ...env }, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", timeout: 5000,
  });
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  expect(result.status).toBe(2);
  return result;
}

function refused(result) {
  expect(result.stdout).toBe("");
  expect(result.stderr).toBe(`${refusal}\n`);
}

function freeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

test("complete saved observations distinguish unassessed F9 rows from failed tests", () => {
  const report = freeze(fixture());
  const before = JSON.stringify(report);
  const summary = formatDiagnosticSummary(report);
  expect(summary.split("\n")[0]).toBe("Executor, SAVED_REPORT_ONLY — recorded observations; no live checks performed.");
  expect(summary).toContain(`Recorded target: ${report.target}`);
  expect(summary).toContain("Reconnaissance: 4/4 PASS");
  expect(summary).toContain("F9_NOT_ASSESSED: 44/44 BLOCKED; execution=NOT_RUN; verifier=null.");
  expect(summary).toContain("not 44 failed tests");
  expect(summary).toContain("F9: STOP; f9Qualified=false; trainingReady=false; exit=2 (intentional).");
  expect(summary).toContain("A saved report does not establish workflow completion.");
  expect(JSON.stringify(report)).toBe(before);
});

test("PATH absence coexists with both seeded executable checks without claiming execution or versions", () => {
  const summary = formatDiagnosticSummary(fixture());
  for (const tool of tools) expect(summary).toContain(`  ${tool}: ${fixture().guest[`TOOL_${tool}`]}`);
  for (const tool of ["rustc", "cargo"]) expect(summary).toContain(`/home/agent/workspace/devrust-tools/bin/${tool}: passed executable checks.`);
  expect(summary).toContain("MISSING does not establish a missing installation");
  expect(summary).toContain("The diagnostic did not execute Rust/Cargo or verify their versions.");
});

test("combined seeded unavailability leaves each executable's individual availability unknown", () => {
  const report = fixture();
  report.guest.SEEDED_RUST = "UNAVAILABLE";
  const summary = formatDiagnosticSummary(report);
  for (const tool of ["rustc", "cargo"]) expect(summary).toContain(`/home/agent/workspace/devrust-tools/bin/${tool}: individual availability unknown.`);
  expect(summary).not.toContain("passed executable checks");
  expect(summary).not.toMatch(/devrust-tools\/bin\/(?:rustc|cargo): (?:absent|MISSING)/);
});

test("all PATH tools present still leaves F9 unassessed and training stopped", () => {
  const report = fixture();
  for (const tool of tools) report.guest[`TOOL_${tool}`] = "PRESENT";
  expect(formatDiagnosticSummary(report)).toContain("F9_NOT_ASSESSED: 44/44 BLOCKED");
  fs.writeFileSync(reportPath, JSON.stringify(report));
  const result = invoke();
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("F9: STOP; f9Qualified=false; trainingReady=false; exit=2 (intentional).");
});

test("opaque private fields, policy, reasons, and controls never reach output", () => {
  const report = fixture();
  const secret = "PRIVATE_CONTROL_\u001b[31m\r\n\u009b";
  report.error = secret;
  report.policy = { sha256: secret, interpretation: secret };
  report.private = { path: secret };
  for (const probe of Object.values(report.probes)) probe.detail = secret;
  for (const row of report.requirements) row.reason = secret;
  const summary = formatDiagnosticSummary(report);
  fs.writeFileSync(reportPath, JSON.stringify(report));
  const result = invoke();
  expect(result.stdout).toBe(summary);
  expect(result.stderr).toBe("");
  for (const forbidden of ["PRIVATE", "\u001b", "\r", "\u009b"]) expect(summary).not.toContain(forbidden);
});

test.each([
  ["schema", "unknown"], ["scope", "F9_QUALIFIED"], ["mode", "PLAN_ONLY"], ["mode", undefined],
  ["diagnosticComplete", false], ["diagnosticComplete", "true"], ["liveGuestObserved", false],
  ["f9Qualified", true], ["f9Qualified", 0], ["trainingReady", true], ["result", "PASS"],
])("unsupported or inconsistent %s=%j rejects with a fixed error", (key, value) => {
  const report = fixture();
  report[key] = value;
  expect(() => formatDiagnosticSummary(report)).toThrow(refusal);
});

test.each([undefined, null, "", "-bad", "a/b", "a b", "a\n", "a\u001b[31m", "a".repeat(65), ["safe"]].map((target) => [target]))("invalid or missing target %j rejects", (target) => {
  const report = fixture();
  if (target === undefined) delete report.target;
  else report.target = target;
  expect(() => formatDiagnosticSummary(report)).toThrow(refusal);
});

test("producer target boundaries and alternate valid guest scalar values are accepted", () => {
  for (const target of ["A", `a${"_.-0".repeat(15)}abc`]) {
    const report = fixture();
    report.target = target;
    report.guest.UID = "UNAVAILABLE";
    report.guest.FD_SOFT = "unlimited";
    report.guest.WORKSPACE = "UNAVAILABLE";
    expect(formatDiagnosticSummary(report)).toContain(`Recorded target: ${target}\n`);
  }
  const report = fixture();
  report.guest.FD_SOFT = "UNAVAILABLE";
  expect(() => formatDiagnosticSummary(report)).not.toThrow();
});

test("exactly four known PASS probes and all ordered catalogue identities are mandatory", () => {
  const changes = [
    (r) => { delete r.probes.GUEST_EXEC; },
    (r) => { r.probes.UNKNOWN = { status: "PASS" }; },
    ...probeIds.flatMap((id) => ["FAIL", "NOT_RUN", null].map((status) => (r) => { r.probes[id].status = status; })),
    (r) => { r.requirements.pop(); }, (r) => { r.requirements.push({ ...r.requirements[0] }); },
    (r) => { [r.requirements[0], r.requirements[1]] = [r.requirements[1], r.requirements[0]]; },
    ...["id", "source", "nextStep", "status", "execution", "verifier"].map((key) => (r) => { r.requirements[0][key] = "PRIVATE_FORGERY"; }),
  ];
  for (const change of changes) {
    const report = fixture();
    change(report);
    expect(() => formatDiagnosticSummary(report)).toThrow(refusal);
    fs.writeFileSync(reportPath, JSON.stringify(report));
    refused(invoke());
  }
});

test("guest fields follow the producer's complete fixed vocabulary", () => {
  for (const key of [...tools.map((tool) => `TOOL_${tool}`), "UID", "FD_SOFT", "WORKSPACE", "SEEDED_RUST", "GUEST_DONE"]) {
    for (const invalid of [undefined, "PRIVATE_\u001b[31m", null, 1000]) {
      const report = fixture();
      if (invalid === undefined) delete report.guest[key];
      else report.guest[key] = invalid;
      expect(() => formatDiagnosticSummary(report)).toThrow(refusal);
    }
  }
  const report = fixture();
  report.guest.EXTRA = "YES";
  expect(() => formatDiagnosticSummary(report)).toThrow(refusal);
  for (const malformed of [null, [], {}, { ...fixture(), probes: [] }, { ...fixture(), guest: [] }, { ...fixture(), requirements: {} }]) {
    expect(() => formatDiagnosticSummary(malformed)).toThrow(refusal);
  }
});

test("recorded PASS statuses cannot contradict explicit execution metadata", () => {
  for (const [key, value] of [["cliSucceeded", false], ["outcome", "TIMEOUT"], ["code", 2], ["signal", "SIGTERM"]]) {
    const report = fixture();
    report.probes.GUEST_EXEC[key] = value;
    expect(() => formatDiagnosticSummary(report)).toThrow(refusal);
    fs.writeFileSync(reportPath, JSON.stringify(report));
    refused(invoke());
  }
});

test("mise explanation wiring is independent of acquisition and retains explicit Bun isolation", () => {
  const config = Bun.TOML.parse(fs.readFileSync(new URL("../../../mise.toml", import.meta.url), "utf8"));
  const task = config.tasks["f9:explain"];
  expect(task.run).toBe("bun --no-env-file --no-install tooling/native-ingress/f9-explain.mjs");
  expect(task.raw_args).toBe(true);
  for (const key of ["depends", "depends_post", "tools", "env"]) expect(task[key]).toBeUndefined();
  expect(config.settings.auto_install).toBe(false);
});

test("CLI accepts both report syntaxes without a TTY or PATH providers and leaves fixtures unchanged", () => {
  const snapshot = () => fs.readdirSync(root).sort().map((name) => [name, fs.statSync(join(root, name)).isFile() ? fs.readFileSync(join(root, name), "utf8") : fs.readdirSync(join(root, name)).sort().map((entry) => [entry, fs.readFileSync(join(root, name, entry), "utf8")])]);
  const before = snapshot();
  const reportBefore = fs.statSync(reportPath, { bigint: true });
  for (const args of [["--report", reportPath], [`--report=${reportPath}`]]) {
    const result = invoke(args);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe(formatDiagnosticSummary(fixture()));
  }
  expect(invoke(["--report", reportPath], { PATH: bin }).stderr).toBe("");
  expect(snapshot()).toEqual(before);
  const reportAfter = fs.statSync(reportPath, { bigint: true });
  for (const key of ["dev", "ino", "size", "mtimeNs", "ctimeNs", "mode", "nlink"]) expect(reportAfter[key]).toBe(reportBefore[key]);
});

test("argument errors, incomplete reports, and unreadable inputs emit only the fixed refusal", () => {
  for (const args of [[], ["--report"], ["--report="], [reportPath], ["--report", reportPath, "extra"],
    ["--unknown=PRIVATE"], ["--report", reportPath, "--report", reportPath], [`--report=${reportPath}`, `--report=${reportPath}`],
    ["--report", reportPath, `--report=${reportPath}`], ["--report", join(root, "PRIVATE_ABSENT")]]) refused(invoke(args));
  for (const contents of ["PRIVATE_INVALID_JSON", "", "null", "[]", JSON.stringify({ ...fixture(), diagnosticComplete: false }), JSON.stringify({ ...fixture(), mode: "PLAN_ONLY" }), JSON.stringify({ ...fixture(), trainingReady: true })]) {
    fs.writeFileSync(reportPath, contents);
    refused(invoke());
  }
});

test("exported main returns intentional exit 2 and never leaks caught errors", () => {
  const out = spyOn(process.stdout, "write").mockImplementation(() => true);
  const err = spyOn(process.stderr, "write").mockImplementation(() => true);
  expect(main(["--report", reportPath])).toBe(2);
  expect(out).toHaveBeenCalledWith(formatDiagnosticSummary(fixture()));
  expect(err).not.toHaveBeenCalled();
  out.mockClear();
  expect(main(["--PRIVATE"])).toBe(2);
  expect(out).not.toHaveBeenCalled();
  expect(err).toHaveBeenCalledWith(`${refusal}\n`);
});

test("reader accepts copied report permissions and ancestor aliases but refuses leaf links and directories", () => {
  fs.chmodSync(root, 0o755);
  expect(readDiagnosticReport(reportPath)).toEqual(fixture());
  const leaf = join(root, "leaf");
  fs.symlinkSync(reportPath, leaf);
  expect(() => readDiagnosticReport(leaf)).toThrow(refusal);
  expect(() => readDiagnosticReport(root)).toThrow(refusal);
  const ancestor = join(root, "ancestor");
  fs.symlinkSync(root, ancestor);
  expect(readDiagnosticReport(join(ancestor, "report.json"))).toEqual(fixture());
});

test("reader rejects noncanonical, control-bearing, and oversized paths before opening anything", () => {
  const open = spyOn(fs, "openSync");
  for (const value of [undefined, null, "", "report.json", "/", `${reportPath}/`, `${root}//report.json`, `${root}/./report.json`, `${root}/x/../report.json`, `${reportPath}\n`, `${reportPath}\u007f`, `${reportPath}\u009b`, `/${"a".repeat(4096)}`, `/${"é".repeat(2048)}`]) {
    expect(() => readDiagnosticReport(value)).toThrow(refusal);
  }
  expect(open).not.toHaveBeenCalled();
});

test("reader uses one no-follow nonblocking read-only descriptor with BigInt metadata and always closes", () => {
  const open = spyOn(fs, "openSync");
  const stat = spyOn(fs, "fstatSync");
  const read = spyOn(fs, "readSync");
  const close = spyOn(fs, "closeSync");
  expect(readDiagnosticReport(reportPath)).toEqual(fixture());
  expect(open).toHaveBeenCalledTimes(1);
  expect(open).toHaveBeenCalledWith(reportPath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  const fd = close.mock.calls[0][0];
  expect(stat.mock.calls).toEqual([[fd, { bigint: true }], [fd, { bigint: true }]]);
  expect(read).toHaveBeenCalledTimes(2);
  expect(read.mock.calls.every((call) => call[0] === fd && call[1].length === cap + 1 && call[4] === null)).toBe(true);
  expect(close).toHaveBeenCalledTimes(1);
});

test("reader bounds file size, catches growth through EOF, and closes on malformed JSON", () => {
  const content = fs.readFileSync(reportPath, "utf8");
  fs.writeFileSync(reportPath, content.padEnd(cap, " "));
  expect(readDiagnosticReport(reportPath)).toEqual(fixture());
  fs.writeFileSync(reportPath, " ".repeat(cap + 1));
  const read = spyOn(fs, "readSync");
  const close = spyOn(fs, "closeSync");
  expect(() => readDiagnosticReport(reportPath)).toThrow(refusal);
  expect(read).not.toHaveBeenCalled();
  expect(close).toHaveBeenCalledTimes(1);
  fs.writeFileSync(reportPath, "PRIVATE_MALFORMED");
  expect(() => readDiagnosticReport(reportPath)).toThrow(refusal);
  expect(close).toHaveBeenCalledTimes(2);
});

test.each(["dev", "ino", "size", "mtimeNs", "ctimeNs", "mode", "nlink"])("reader rejects changed %s metadata and closes", (key) => {
  const before = fs.statSync(reportPath, { bigint: true });
  const stat = spyOn(fs, "fstatSync").mockReturnValueOnce(before).mockReturnValueOnce({ ...before, [key]: before[key] + 1n });
  const close = spyOn(fs, "closeSync");
  expect(() => readDiagnosticReport(reportPath)).toThrow(refusal);
  expect(stat).toHaveBeenCalledTimes(2);
  expect(close).toHaveBeenCalledTimes(1);
});

test("reader rejects special files and read errors while closing the held descriptor", () => {
  const before = fs.statSync(reportPath, { bigint: true });
  const stat = spyOn(fs, "fstatSync").mockReturnValueOnce({ ...before, isFile: () => false });
  const read = spyOn(fs, "readSync");
  const close = spyOn(fs, "closeSync");
  expect(() => readDiagnosticReport(reportPath)).toThrow(refusal);
  expect(read).not.toHaveBeenCalled();
  expect(close).toHaveBeenCalledTimes(1);
  stat.mockRestore();
  read.mockImplementation(() => { throw new Error("PRIVATE_READ_ERROR"); });
  expect(() => readDiagnosticReport(reportPath)).toThrow(refusal);
  expect(close).toHaveBeenCalledTimes(2);
});

test("reader reads until EOF rather than trusting initial size and caps growing streams at cap+1", () => {
  const originalRead = fs.readSync;
  const read = spyOn(fs, "readSync").mockImplementation((fd, buffer, offset, length, position) => originalRead(fd, buffer, offset, Math.min(length, 31), position));
  expect(readDiagnosticReport(reportPath)).toEqual(fixture());
  expect(read.mock.calls.length).toBeGreaterThan(2);
  read.mockRestore();
  const before = fs.statSync(reportPath, { bigint: true });
  spyOn(fs, "fstatSync").mockReturnValue(before);
  let bytes = 0;
  spyOn(fs, "readSync").mockImplementation((_fd, buffer, offset, length) => {
    buffer.fill(32, offset, offset + length);
    bytes += length;
    return length;
  });
  const close = spyOn(fs, "closeSync");
  expect(() => readDiagnosticReport(reportPath)).toThrow(refusal);
  expect(bytes).toBe(cap + 1);
  expect(close).toHaveBeenCalledTimes(1);
});

test("reader rejects length mismatch even when both metadata snapshots claim stability", () => {
  const before = fs.statSync(reportPath, { bigint: true });
  spyOn(fs, "fstatSync").mockReturnValue({ ...before, isFile: () => true, size: before.size + 1n });
  expect(() => readDiagnosticReport(reportPath)).toThrow(refusal);
});
