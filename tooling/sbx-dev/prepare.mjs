#!/usr/bin/env bun
// SPEC: _spec/tooling/sbx-dev/preparation-workflow.puml
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { parseArgs } from "node:util";
import { readState } from "./stages.mjs";
import { readAcquiredTools, toolPins } from "./acquire-tools.mjs";

const stages = [
  ["validate", "dev:sbx:validate"], ["create", "dev:sbx:create-stage"],
  ["policy", "dev:sbx:policy"], ["accept-policy", "dev:sbx:accept-policy"],
  ["provision", "dev:sbx:provision"], ["install", "dev:sbx:install"], ["diagnose", "dev:sbx:diagnose"],
];

export function parsePreparation(argv) {
  const { values } = parseArgs({ args: argv, strict: true, allowPositionals: false, options: {
    sbx: { type: "string" }, bundle: { type: "string" }, sha256: { type: "string" }, plan: { type: "boolean" },
  } });
  const flags = argv.filter((value) => value.startsWith("--")).map((value) => value.split("=")[0]);
  if (new Set(flags).size !== flags.length || Boolean(values.bundle) !== Boolean(values.sha256)
    || (values.sha256 !== undefined && !/^[0-9a-f]{64}$/.test(values.sha256))) throw new Error("invalid preparation arguments");
  for (const key of ["sbx", "bundle"]) {
    const value = values[key];
    if (value !== undefined && (!value || !isAbsolute(value) || value.length > 4096
      || [...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127))) throw new Error("absolute input paths required");
  }
  return values;
}

export function preparationPlan(options) {
  const automatic = !options.bundle;
  return {
    schema: "dev-sbx-preparation-plan-v1", mode: "PLAN_ONLY", state: "PRIVATE_RUN_DIRECTORY_ALLOCATED_ONLY_ON_EXECUTION",
    tasks: [...(automatic ? [{ action: "acquire", task: "dev:sbx:acquire", freshTerminalApproval: true }] : []), ...stages.map(([action, task]) => ({ action, task, freshTerminalApproval: true }))],
    inputs: { sbx: options.sbx ?? "RESOLVED_FROM_PATH_AT_EXECUTION", tools: toolPins(), bundle: options.bundle, sha256: options.sha256 },
    nameSource: "Confirmed create result carried automatically in private state",
    previewEffects: { subprocesses: false, writes: false, downloads: false, installs: false },
    downloads: automatic, hostInstalls: automatic, guestDownloads: false,
    automaticRetryOrRemoval: false, trainingReady: false, result: "STOP",
  };
}

function invokeMise(mise, task, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(mise, ["run", "--raw", task, "--", ...args], { stdio: "inherit" });
    child.once("error", () => reject(new Error("child mise invocation unavailable")));
    child.once("exit", (code, signal) => {
      if (code === 0 && signal === null) resolve();
      else reject(new Error("child task did not confirm stage completion"));
    });
  });
}

export async function composePreparation(options, dependencies = {}) {
  const mise = dependencies.mise ?? Bun.which("mise", { PATH: process.env.PATH ?? "" });
  if (!mise || !isAbsolute(mise)) throw new Error("existing mise executable required");
  const selectedSbx = options.sbx ?? Bun.which("sbx", { PATH: process.env.PATH ?? "" });
  if (!selectedSbx) throw new Error("existing sbx executable required on PATH");
  const sbx = options.sbx ?? realpathSync(selectedSbx);
  const directory = (dependencies.createRunDirectory ?? (() => mkdtempSync(join(
    existsSync("/tmp/opencode") ? "/tmp/opencode" : tmpdir(), "dev-sbx-prepare-",
  ))))();
  const statePath = join(directory, "state.json");
  const announce = dependencies.announce ?? console.log;
  const invoke = dependencies.invoke ?? ((task, args) => invokeMise(mise, task, args));
  announce(`STATE_PATH=${statePath}`);
  let effective = { ...options, sbx };
  if (!options.bundle) {
    const manifest = join(directory, "tools.json");
    announce("BEGIN_STAGE=acquire TASK=dev:sbx:acquire");
    await invoke("dev:sbx:acquire", ["--manifest", manifest]);
    const acquired = readAcquiredTools(manifest);
    effective = { ...effective, bundle: acquired.bundlePath, sha256: acquired.sha256 };
    announce("END_STAGE=acquire");
  }
  let state, attemptId, createdName;
  for (const [action, task] of stages) {
    announce(`BEGIN_STAGE=${action} TASK=${task}`);
    const args = ["--state", statePath];
    if (action === "validate") args.push("--sbx", effective.sbx, "--bundle", effective.bundle, "--sha256", effective.sha256);
    await invoke(task, args);
    state = readState(statePath);
    if (state.completedStage !== action || state.status !== "READY" || state.inFlightStage !== null || state.trainingReady !== false) {
      throw new Error("child task state does not confirm the expected stage");
    }
    if (state.sbxPath !== effective.sbx || state.bundlePath !== effective.bundle || state.bundleSha256 !== effective.sha256
      || (attemptId !== undefined && state.attemptId !== attemptId)
      || (createdName !== undefined && state.createdName !== createdName)) throw new Error("workflow target or input binding changed");
    attemptId = state.attemptId;
    if (action === "create") createdName = state.createdName;
    announce(`END_STAGE=${action}`);
    if (action === "create") announce(`DEV_CREATED_NAME=${state.createdName}`);
  }
  return {
    schema: "dev-sbx-preparation-result-v1", statePath, createdName: state.createdName,
    reportPath: state.reportPath, developmentPrepared: true, diagnosticComplete: true,
    f9Qualified: false, trainingReady: false, result: "STOP",
  };
}

export const completionExplanation = [
  "Executor, DEVELOPMENT_SETUP_COMPLETE — development preparation and reconnaissance completed.",
  "F9_NOT_ASSESSED — independent acceptance verifiers did not run; these are not failed tests.",
  "F9=STOP; trainingReady=false; exit 2 is intentional, not a development setup failure.",
  "The offline explainer exits 0 for successful presentation only; rejected reports exit 2.",
  "Use mise run f9:explain -- --report with the receipt's reportPath for saved-report-only details.",
].join("\n");

export async function main(argv, { compose = composePreparation, output = console.log, explain = console.error } = {}) {
  try {
    const options = parsePreparation(argv);
    if (options.plan) {
      output(JSON.stringify(preparationPlan(options), null, 2));
      return 0;
    }
    if (!process.stdin.isTTY) throw new Error("a real terminal is required for per-stage approvals");
    output(JSON.stringify(await compose(options), null, 2));
    explain(completionExplanation);
    return 2;
  } catch (error) {
    explain(`STOP: ${error.message}; retain state and reconcile before any new attempt.`);
    return 2;
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
