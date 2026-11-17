// SPEC: _spec/runtime-protocol.puml
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { inspectQualificationReports, PUBLICATION } from "./validate.ts";
import type { BootstrapReceipt } from "../qualification-bootstrap.ts";
import type { OperatorReport } from "../qualification-operator.ts";

const bootstrap = readFileSync(new URL("./bootstrap.json", import.meta.url));
const operator = readFileSync(new URL("./operator-transcription-1-unverified.json", import.meta.url));
const encode = (value: unknown) => Buffer.from(JSON.stringify(value) + "\n");
function synthetic() {
  const b = JSON.parse(bootstrap.toString()) as BootstrapReceipt, o = JSON.parse(operator.toString()) as OperatorReport;
  o.queries = o.commands.filter(c => c.argv[0] === "nvidia-smi").length;
  o.elapsedMs = 200000;
  return { b, o, inspect: () => inspectQualificationReports(encode(b), encode(o)) };
}
test("provisional transcription retains its inconsistency without blaming HOST", () => {
  const r = inspectQualificationReports(bootstrap, operator);
  expect(r.status).toBe("LOCAL_TRANSCRIPTION_REQUIRES_READBACK");
  expect(r.reported.queries).toBe(85); expect(r.transcribed.queryEntries).toBe(93);
  expect(r.checks.filter(c => c.status === "FAIL").map(c => c.id)).toEqual([
    "operator-complete-query-accounting", "transcribed-monitor-count-fits-elapsed"]);
  expect(r.discrepancyAttribution).toBe("UNRESOLVED_TRANSCRIPTION_FIDELITY_NOT_A_HOST_FAILURE_FINDING");
  expect(r.actualHostFilesRead).toBe(false); expect(r.reportedFileDigestsVerifiedAgainstHostBytes).toBe(false);
  expect(r.qualified).toBe(false); expect(r.trainingReady).toBe(false);
});
test("synthetic coherent reports pass local checks but never confer acceptance", () => {
  const r = synthetic().inspect(); expect(r.status).toBe("PASS_LOCAL_TRANSCRIPTION_CONSISTENCY_ONLY");
  expect(r.functionalAcceptance).toBe("PENDING"); expect(r.trainingReady).toBe(false);
});
const cases: [string, (b: BootstrapReceipt, o: OperatorReport) => void][] = [
  ["wrong publication", b => { b.publicationCommit = "a".repeat(40); }],
  ["unqualified bootstrap scope", b => { b.qualified = true as false; }],
  ["missing offline build", b => { b.referenceBuilds = 5; }],
  ["wrong manifest path", b => { b.inputManifest!.path += ".other"; }],
  ["malformed manifest digest", b => { b.inputManifest!.sha256 = "x"; }],
  ["wrong preparation path", b => { b.preparationReceipt!.path += ".other"; }],
  ["wrong Git cwd", b => { b.commands[0]!.cwd += "/other"; }],
  ["wrong fetch pin", b => { b.commands[1]!.argv = [...b.commands[1]!.argv.slice(0, -1), "a".repeat(40)]; }],
  ["renewed Git budget", b => { b.commands[2]!.deadlineMs += 1; }],
  ["wrong HEAD digest", b => { b.commands[3]!.stdout.sha256 = "b".repeat(64); }],
  ["forced preparation", b => { b.commands[4]!.result.forced = true; }],
  ["missing EOF", (_b, o) => { o.commands[0]!.result.stdoutEOF = false; }],
  ["extra Docker operation", (_b, o) => { o.commands.push(structuredClone(o.commands.at(-1)!)); }],
  ["changed mount", (_b, o) => { o.commands[1]!.argv = o.commands[1]!.argv.map(a => a.replace("dst=/app,readonly", "dst=/app")); }],
  ["wrong GPU", (_b, o) => { o.commands[0]!.argv = ["nvidia-smi", "--all"]; }],
  ["low admission memory", (_b, o) => { o.commands[0]!.result.stdout = o.commands[0]!.result.stdout.replace("7731", "2048"); }],
  ["renewed outer deadline", (_b, o) => { o.deadlineMs += 1; }],
  ["invalid elapsed", (_b, o) => { o.elapsedMs = -1; }],
  ["unremoved container", (_b, o) => { o.cleanup = "UNCONFIRMED"; }],
  ["worker readiness bypass", (_b, o) => { o.commands.find(c => c.argv[2] === "start")!.result.stdout =
    o.commands.find(c => c.argv[2] === "start")!.result.stdout.replace('"trainingReady":false', '"trainingReady":true'); }],
  ["OOM state", (_b, o) => { o.commands.find(c => c.argv[2] === "inspect")!.result.stdout =
    o.commands.find(c => c.argv[2] === "inspect")!.result.stdout.replace('"OOMKilled":false', '"OOMKilled":true'); }],
];
for (const [name, mutate] of cases) test(`rejects ${name} without executing commands`, () => {
  const f = synthetic(); mutate(f.b, f.o); expect(f.inspect().status).toBe("LOCAL_TRANSCRIPTION_REQUIRES_READBACK");
});
for (const value of ["null", "[]", "{}", "not-json"]) test(`rejects malformed report ${value}`, () => {
  expect(inspectQualificationReports(Buffer.from(value), operator).status).toBe("LOCAL_TRANSCRIPTION_REQUIRES_READBACK");
});
test("the publication pin and retained input bytes remain unchanged", () => {
  expect(PUBLICATION).toBe("e821b5169f29b191b8418763508bd54292774aef");
  expect(readFileSync(new URL("./bootstrap.json", import.meta.url))).toEqual(bootstrap);
  expect(readFileSync(new URL("./operator-transcription-1-unverified.json", import.meta.url))).toEqual(operator);
});
