// SPEC: _spec/runtime-protocol.puml
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { qualificationBootstrapPlan } from "../qualification-bootstrap.ts";
import type { BootstrapReceipt } from "../qualification-bootstrap.ts";
import { GPU_QUERY, qualificationDockerCreate, qualificationPlan } from "../qualification-operator.ts";
import type { OperatorReport } from "../qualification-operator.ts";

export const PUBLICATION = "e821b5169f29b191b8418763508bd54292774aef";
const MIB = 1048576, bootstrapPlan = qualificationBootstrapPlan(), operatorPlan = qualificationPlan();
const hash = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const same = isDeepStrictEqual;
const clean = (r: { exitCode: number | null; signal: string | null; exited: boolean; reaped: boolean;
  stdoutEOF: boolean; stderrEOF: boolean; forced: boolean; error: string | null }) => r.exitCode === 0 && r.signal === null &&
  r.exited === true && r.reaped === true && r.stdoutEOF === true && r.stderrEOF === true && r.forced === false && r.error === null;
const finite = (n: number) => typeof n === "number" && Number.isFinite(n) && n >= 0;
const byteRef = (r: { byteLength: number; sha256: string }, cap: number) => Number.isSafeInteger(r.byteLength) &&
  r.byteLength >= 0 && r.byteLength <= cap && typeof r.sha256 === "string" && /^[a-f0-9]{64}$/.test(r.sha256) &&
  (r.byteLength !== 0 || r.sha256 === hash(new Uint8Array()));
function parse(bytes: Uint8Array): unknown {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0 || bytes.byteLength > MIB) throw new Error("REPORT_BOUND");
  const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("REPORT_OBJECT");
  return value;
}
function timestamp(value: string): bigint {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\.(\d{9})Z$/.exec(value);
  if (!match) throw new Error("CONTAINER_TIMESTAMP");
  const seconds = Date.parse(match[1]! + "Z");
  if (!Number.isFinite(seconds)) throw new Error("CONTAINER_TIMESTAMP");
  return BigInt(seconds) * 1000000n + BigInt(match[2]!);
}
export function inspectQualificationReports(bootstrapBytes: Uint8Array, operatorBytes: Uint8Array) {
  const checks: { id: string; status: "PASS" | "FAIL" }[] = [];
  const verify = (id: string, action: () => boolean) => {
    let passed = false; try { passed = action() === true; } catch {}
    checks.push({ id, status: passed ? "PASS" : "FAIL" });
  };
  let b = {} as BootstrapReceipt, o = {} as OperatorReport;
  verify("bootstrap-json", () => { b = parse(bootstrapBytes) as BootstrapReceipt; return true; });
  verify("operator-json", () => { o = parse(operatorBytes) as OperatorReport; return true; });
  verify("bootstrap-identity-and-scope", () => b.version === "chess-coach.qualification-bootstrap.v1" && b.phase === "bootstrap" &&
    b.scope === bootstrapPlan.scope && b.publicationCommit === PUBLICATION && b.status === "PASS" &&
    b.qualified === false && b.trainingReady === false && same(b.failures, []) && b.referenceBuilds === 6);
  verify("bootstrap-manifest-reference", () => b.inputManifest?.path === `${bootstrapPlan.inputs}/qualification-inputs/input-manifest.json` &&
    b.inputManifest.byteLength > 0 && byteRef(b.inputManifest, 8 * MIB));
  verify("bootstrap-preparation-reference", () => b.preparationReceipt?.path === `${bootstrapPlan.delivery}/preparation-receipt.json` &&
    b.preparationReceipt.byteLength > 0 && byteRef(b.preparationReceipt, MIB));
  verify("bootstrap-fixed-argv", () => {
    const git = ["git", "--no-replace-objects", "--no-optional-locks", "-c", "core.autocrlf=false", "-c", "core.hooksPath=/dev/null",
      "-c", "core.fsmonitor=false", "-c", "init.templateDir=/dev/null"], s = bootstrapPlan.source;
    return same(b.commands.map(c => c.argv), [[...git, "init", s],
      [...git, "-C", s, "fetch", "--depth=1", "--no-tags", bootstrapPlan.repository, PUBLICATION],
      [...git, "-C", s, "checkout", "--detach", "FETCH_HEAD"], [...git, "-C", s, "rev-parse", "--verify", "HEAD"],
      [bootstrapPlan.bun, "--no-env-file", "--no-install", `${s}/${bootstrapPlan.entry}`, "prepare-worker", PUBLICATION]]) &&
      b.commands.every(c => c.cwd === bootstrapPlan.host);
  });
  verify("bootstrap-lifecycles-and-log-references", () => b.commands.length === 5 && b.commands.every((c, n) =>
    clean(c.result) && ["stdout", "stderr"].every(stream => {
      const ref = c[stream as "stdout" | "stderr"], label = n < 4 ? `git-${n}` : "prepare-worker";
      return ref.path === `${bootstrapPlan.delivery}/logs/${label}.${stream}` && byteRef(ref, MIB);
    })));
  verify("bootstrap-head-output-reference", () => b.commands[3]!.stdout.byteLength === 41 && b.commands[3]!.stdout.sha256 === hash(PUBLICATION + "\n"));
  verify("bootstrap-nonrenewing-budget-declarations", () => {
    const gitEnd = b.commands[0]!.deadlineMs, prepEnd = b.commands[4]!.deadlineMs;
    return finite(gitEnd) && finite(prepEnd) && gitEnd >= bootstrapPlan.gitMs &&
      b.commands.slice(0, 4).every(c => c.deadlineMs === gitEnd && c.cleanupDeadlineMs === gitEnd + bootstrapPlan.cleanupMs) &&
      prepEnd - bootstrapPlan.preparationMs >= gitEnd - bootstrapPlan.gitMs && prepEnd - bootstrapPlan.preparationMs < gitEnd &&
      b.commands[4]!.cleanupDeadlineMs === prepEnd + bootstrapPlan.cleanupMs;
  });
  verify("operator-scope-and-lifecycle", () => o.scope === operatorPlan.scope && o.status === "PASS" && o.qualified === false &&
    o.trainingReady === false && o.aborted === false && same(o.failures, []) && o.cleanup === "REMOVED" && /^[a-f0-9]{64}$/.test(o.cid!));
  verify("operator-original-envelope", () => finite(o.originMs) && finite(o.deadlineMs) && finite(o.elapsedMs) && o.elapsedMs > 0 &&
    Math.abs(o.deadlineMs - o.originMs - operatorPlan.limits.outerMs) < 0.000001 && o.elapsedMs < operatorPlan.limits.outerMs);
  const commands = Array.isArray(o.commands) ? o.commands : [];
  const queries = commands.filter(c => c?.argv?.[0] === "nvidia-smi"), docker = commands.filter(c => c?.argv?.[0] === "docker");
  verify("operator-complete-query-accounting", () => Number.isSafeInteger(o.queries) && o.queries > 0 &&
    o.queries <= operatorPlan.limits.queries && queries.length === o.queries && commands.length === queries.length + 4);
  verify("transcribed-monitor-count-fits-elapsed", () => finite(o.elapsedMs) && queries.length <= 1 + Math.floor(o.elapsedMs / operatorPlan.limits.intervalMs));
  verify("operator-natural-command-results-and-bounds", () => commands.length > 0 && commands.length <= operatorPlan.limits.queries + 7 &&
    commands.every(c => clean(c.result) && typeof c.result.stdout === "string" && typeof c.result.stderr === "string" &&
      Buffer.byteLength(c.result.stderr) <= 65536 && Buffer.byteLength(c.result.stdout) <=
      (c.argv[0] === "nvidia-smi" || c.argv[2] === "create" ? 4096 : c.argv[2] === "start" ? MIB : 65536)));
  verify("gpu-argv-and-reported-free-memory", () => queries.length > 0 && same(commands[0]?.argv, GPU_QUERY) && queries.every((c, n) => {
    const m = /^(GPU-[a-f0-9-]+), ([0-9]+)\n$/.exec(c.result.stdout), free = Number(m?.[2]);
    return same(c.argv, GPU_QUERY) && m?.[1] === operatorPlan.gpu && Number.isSafeInteger(free) &&
      free >= (n === 0 ? operatorPlan.limits.admissionMiB : operatorPlan.limits.runningMiB);
  }));
  const daemon = ["docker", "--host=unix:///var/run/docker.sock"];
  verify("docker-exact-owned-argv-and-output", () => same(commands[1]?.argv, qualificationDockerCreate()) &&
    same(docker.map(c => c.argv), [qualificationDockerCreate(), [...daemon, "start", "-a", o.cid],
      [...daemon, "inspect", "--format={{json .State}}", o.cid], [...daemon, "rm", o.cid]]) &&
    docker[0]!.result.stdout === o.cid + "\n" && docker[3]!.result.stdout === o.cid + "\n");
  verify("worker-reported-functional-summary", () => {
    const stdout = docker[1]!.result.stdout;
    return stdout.startsWith("Executor: ") && stdout.endsWith("\n") && same(JSON.parse(stdout.slice(10)), {
      scope: operatorPlan.scope, qualified: false, trainingReady: false, status: "PASS", failures: [], canonical: "PASS", r4: "PASS",
      functional: "PASS_RETAINED_FUNCTIONAL_EVIDENCE", rawQualified: false, nativeTrace: "COMPLETE" });
  });
  verify("container-reported-natural-state-and-duration", () => {
    const s = JSON.parse(docker[2]!.result.stdout) as { Status: string; Running: boolean; Paused: boolean; Restarting: boolean;
      OOMKilled: boolean; Dead: boolean; Pid: number; ExitCode: number; Error: string; StartedAt: string; FinishedAt: string };
    const elapsed = timestamp(s.FinishedAt) - timestamp(s.StartedAt);
    return s.Status === "exited" && s.Running === false && s.Paused === false && s.Restarting === false && s.OOMKilled === false &&
      s.Dead === false && s.Pid === 0 && s.ExitCode === 0 && s.Error === "" && elapsed > 0n &&
      elapsed <= BigInt(Math.floor(o.elapsedMs * 1000000));
  });
  return { status: checks.every(c => c.status === "PASS") ? "PASS_LOCAL_TRANSCRIPTION_CONSISTENCY_ONLY" : "LOCAL_TRANSCRIPTION_REQUIRES_READBACK",
    scope: "USER_REPORTED_JSON_TRANSCRIPTION_NOT_DIRECT_HOST_CAPTURE", checks,
    files: { bootstrap: { byteLength: bootstrapBytes.byteLength, sha256: hash(bootstrapBytes) },
      operatorTranscription: { byteLength: operatorBytes.byteLength, sha256: hash(operatorBytes) } },
    reported: { queries: o.queries ?? null, elapsedMs: o.elapsedMs ?? null, referenceBuilds: b.referenceBuilds ?? null,
      inputManifest: b.inputManifest ?? null, preparationReceipt: b.preparationReceipt ?? null },
    transcribed: { queryEntries: queries.length, dockerEntries: docker.length },
    actualHostFilesRead: false, reportedFileDigestsVerifiedAgainstHostBytes: false, perQueryTimingVerified: false,
    discrepancyAttribution: "UNRESOLVED_TRANSCRIPTION_FIDELITY_NOT_A_HOST_FAILURE_FINDING",
    functionalAcceptance: "PENDING", qualified: false, trainingReady: false } as const;
}
