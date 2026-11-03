// SPEC: _spec/tooling/native-ingress/f9-diagnostic.puml
import { requirements } from "./f9-requirements.mjs";

const refusal = "Executor, STOP: saved report could not be explained; F9 remains unqualified; trainingReady=false.";
const probes = ["PREFLIGHT", "VM_LOOKUP", "POLICY_READBACK", "GUEST_EXEC"];
const tools = ["tar", "sha256sum", "timeout", "gpgv", "patch", "make", "clang", "ld.bfd", "readelf", "node", "rustc", "cargo", "zig"];
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const digits = (value) => typeof value === "string" && /^[0-9]+$/.test(value);
const present = (value) => value === "PRESENT" || value === "MISSING";
const pass = (value) => object(value) && value.status === "PASS"
  && Object.entries({ cliSucceeded: true, outcome: "EXIT", code: 0, signal: null }).every(([key, expected]) => !Object.hasOwn(value, key) || value[key] === expected);

export function formatDiagnosticSummary(report) {
  const guest = report?.guest;
  if (!object(report) || report.schema !== "f9-live-diagnostic-v1"
    || report.scope !== "DEVELOPMENT_RECONNAISSANCE_ONLY" || Object.hasOwn(report, "mode")
    || report.diagnosticComplete !== true || report.liveGuestObserved !== true
    || report.f9Qualified !== false || report.trainingReady !== false || report.result !== "STOP"
    || typeof report.target !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/.test(report.target)
    || !object(report.probes) || Object.keys(report.probes).length !== probes.length
    || !probes.every((id) => Object.hasOwn(report.probes, id) && pass(report.probes[id]))
    || !Array.isArray(report.requirements) || report.requirements.length !== requirements.length
    || !requirements.every((expected, index) => {
      const row = report.requirements[index];
      return object(row) && ["id", "source", "nextStep"].every((key) => row[key] === expected[key])
        && row.status === "BLOCKED" && row.execution === "NOT_RUN" && row.verifier === null;
    })
    || !object(guest) || Object.keys(guest).length !== tools.length + 5
    || ![...tools.map((tool) => `TOOL_${tool}`), "UID", "FD_SOFT", "WORKSPACE", "SEEDED_RUST", "GUEST_DONE"].every((key) => Object.hasOwn(guest, key))
    || !tools.every((tool) => present(guest[`TOOL_${tool}`]))
    || !(guest.UID === "UNAVAILABLE" || digits(guest.UID))
    || !(guest.FD_SOFT === "UNAVAILABLE" || guest.FD_SOFT === "unlimited" || digits(guest.FD_SOFT))
    || !["WRITABLE", "UNAVAILABLE"].includes(guest.WORKSPACE)
    || !["EXECUTABLES_PRESENT", "UNAVAILABLE"].includes(guest.SEEDED_RUST) || guest.GUEST_DONE !== "YES") {
    throw new Error(refusal);
  }

  const seeded = guest.SEEDED_RUST === "EXECUTABLES_PRESENT" ? "passed executable checks" : "individual availability unknown";
  return [
    "Executor, SAVED_REPORT_ONLY — recorded observations; no live checks performed.",
    `Recorded target: ${report.target}`,
    `Reconnaissance: ${probes.length}/${probes.length} PASS (recorded probes only).`,
    `F9_NOT_ASSESSED: ${requirements.length}/${requirements.length} BLOCKED; execution=NOT_RUN; verifier=null.`,
    `These are ${requirements.length} unassessed requirements, not ${requirements.length} failed tests.`,
    "Recorded guest PATH observations:",
    ...tools.map((tool) => `  ${tool}: ${guest[`TOOL_${tool}`]}`),
    "PRESENT/MISSING describe PATH lookup only; MISSING does not establish a missing installation.",
    `Recorded seeded Rust: ${guest.SEEDED_RUST}`,
    `  /home/agent/workspace/devrust-tools/bin/rustc: ${seeded}.`,
    `  /home/agent/workspace/devrust-tools/bin/cargo: ${seeded}.`,
    "The diagnostic did not execute Rust/Cargo or verify their versions.",
    "F9: STOP; f9Qualified=false; trainingReady=false.",
    "f9:diagnose still exits 2; f9:explain exits 0 when formatting succeeds.",
    "Formatter success is not F9 qualification or training permission.",
    "A saved report does not establish workflow completion.",
    "",
  ].join("\n");
}
