#!/usr/bin/env bun
// SPEC: _spec/tooling/native-ingress/f9-diagnostic.puml
import fs, { constants } from "node:fs";
import { isAbsolute, normalize } from "node:path";
import { parseArgs } from "node:util";
import { runBounded } from "./f9-diagnose.mjs";
import { guestToolContext, validateGuestToolRoot } from "../sbx-dev/complete-profile.mjs";

export const guestTools = Object.freeze([
  "tar", "sha256sum", "timeout", "gpgv", "patch", "make", "clang", "ld.bfd",
  "readelf", "node", "rustc", "cargo", "zig", "mise", "bun",
]);

export const guestVerificationScript = `set -eu
test "$#" -eq 2
printf 'F9_SBX_EXPLAIN_V1\\n'
missing=0
for tool in ${guestTools.join(" ")}; do
  if command -v "$tool" >/dev/null 2>&1; then
    printf 'TOOL_%s=PRESENT\\n' "$tool"
  else
    printf 'TOOL_%s=MISSING\\n' "$tool"
    missing=1
  fi
done
if test "$missing" -ne 0; then
  printf 'RESULT=TOOLS_MISSING\\n'
  exit 2
fi
if ! cd "$1" 2>/dev/null; then
  printf 'RESULT=REPO_UNAVAILABLE\\n'
  exit 2
fi
if MISE_AUTO_INSTALL=false mise run f9:explain --report "$2" >/dev/null 2>&1; then
  printf 'RESULT=EXPLAIN_SUCCEEDED\\n'
else
  printf 'RESULT=EXPLAIN_FAILED\\n'
  exit 2
fi
`;

const contextRoot = "/home/agent/workspace/devtools-0000000000000000";
const contextEnvironment = guestToolContext(contextRoot).env;
export const profiledGuestVerificationScript = guestVerificationScript.replace(
  'test "$#" -eq 2',
  ['test "$#" -eq 3', ...Object.entries(contextEnvironment).map(([key, value]) => `${key}="${value.replaceAll(contextRoot, "$3")}"`),
    `export ${Object.keys(contextEnvironment).join(" ")}`].join("\n"),
);

function absolutePath(value) {
  if (typeof value !== "string" || Buffer.byteLength(value) > 4096
    || !isAbsolute(value) || normalize(value) !== value || value.endsWith("/")
    || Buffer.from(value).toString("utf8") !== value
    || [...value].some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || (code >= 127 && code <= 159);
    })) throw new Error("INVALID_ARGUMENTS");
  return value;
}

export function parseVerificationArgs(argv) {
  const { values, tokens } = parseArgs({ args: argv, strict: true, allowPositionals: false, tokens: true, options: {
    sbx: { type: "string" }, name: { type: "string" }, repo: { type: "string" }, report: { type: "string" },
    "tool-root": { type: "string" },
    plan: { type: "boolean" }, "confirm-dev-verification": { type: "boolean" },
  } });
  if (tokens.some((token) => token.kind !== "option")
    || new Set(tokens.map((token) => token.name)).size !== tokens.length
    || Boolean(values.plan) === Boolean(values["confirm-dev-verification"])
    || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/.test(values.name ?? "")) throw new Error("INVALID_ARGUMENTS");
  return {
    sbx: absolutePath(values.sbx), name: values.name,
    repo: absolutePath(values.repo), report: absolutePath(values.report),
    mode: values.plan ? "PLAN_ONLY" : "EXECUTE",
    ...(values["tool-root"] !== undefined ? { toolRoot: validateGuestToolRoot(values["tool-root"]) } : {}),
  };
}

export function buildVerificationPlan(options) {
  return {
    id: "GUEST_TOOLS_AND_EXPLAIN",
    argv: [options.sbx, "exec", options.name, "/usr/bin/timeout", "--kill-after=1s", "25s",
      "/bin/sh", "-c", options.toolRoot ? profiledGuestVerificationScript : guestVerificationScript,
      "sh", options.repo, options.report, ...(options.toolRoot ? [options.toolRoot] : [])],
    milliseconds: 35000, cap: 65536, graceMilliseconds: 1000,
  };
}

export function parseGuestVerification(output) {
  if (typeof output !== "string" || Buffer.byteLength(output) > 65536) throw new Error("MALFORMED_PROTOCOL");
  const lines = output.split("\n");
  if (lines.shift() !== "F9_SBX_EXPLAIN_V1" || lines.pop() !== "" || lines.length !== guestTools.length + 1) {
    throw new Error("MALFORMED_PROTOCOL");
  }
  const tools = Object.fromEntries(guestTools.map((tool, index) => {
    const prefix = `TOOL_${tool}=`;
    const line = lines[index];
    const value = line.startsWith(prefix) ? line.slice(prefix.length) : "";
    if (!["PRESENT", "MISSING"].includes(value)) throw new Error("MALFORMED_PROTOCOL");
    return [tool, value];
  }));
  const result = lines.at(-1);
  const allowed = ["RESULT=TOOLS_MISSING", "RESULT=REPO_UNAVAILABLE", "RESULT=EXPLAIN_FAILED", "RESULT=EXPLAIN_SUCCEEDED"];
  const missing = guestTools.filter((tool) => tools[tool] === "MISSING");
  if (!allowed.includes(result) || (result === "RESULT=TOOLS_MISSING") !== (missing.length > 0)) {
    throw new Error("MALFORMED_PROTOCOL");
  }
  return { tools, missing, result: result.slice(7) };
}

function inspectExecutable(path) {
  const before = fs.lstatSync(path, { bigint: true });
  if (!before.isFile() || before.isSymbolicLink()) throw new Error("INVALID_EXECUTABLE");
  fs.accessSync(path, constants.X_OK);
  const after = fs.lstatSync(path, { bigint: true });
  if (["dev", "ino", "mode", "size", "mtimeNs", "ctimeNs"].some((key) => before[key] !== after[key])) {
    throw new Error("INVALID_EXECUTABLE");
  }
}

export async function verifySbx(argv, { execute = runBounded, inspect = inspectExecutable } = {}) {
  const report = {
    schema: "f9-sbx-explain-verification-v1", scope: "DEVELOPMENT_CONVENIENCE_ONLY", mode: "NOT_RUN",
    tools: null, missingTools: [], allToolsAvailable: false, explanationSucceeded: false,
    gate0: "OPEN", f9Qualified: false, trainingReady: false, result: "STOP",
  };
  let stage = "INVALID_ARGUMENTS";
  try {
    const options = parseVerificationArgs(argv);
    report.mode = options.mode;
    report.target = options.name;
    if (options.toolRoot) report.guestToolRoot = options.toolRoot;
    const plan = buildVerificationPlan(options);
    if (options.mode === "PLAN_ONLY") {
      report.plan = plan;
      report.result = "PLAN_ONLY";
      return report;
    }
    stage = "INVALID_EXECUTABLE";
    inspect(options.sbx);
    stage = "EXECUTION_FAILED";
    const result = await execute(plan.argv, { milliseconds: plan.milliseconds, cap: plan.cap, graceMilliseconds: plan.graceMilliseconds });
    if (!result || typeof result.stdout !== "string" || typeof result.stderr !== "string") throw new Error(stage);
    if (Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr) > plan.cap || result.bytes > plan.cap) {
      stage = "OUTPUT_LIMIT";
      throw new Error(stage);
    }
    if (result.outcome !== "EXIT" || result.signal !== null) throw new Error(stage);
    if (result.stderr !== "") {
      stage = "UNEXPECTED_STDERR";
      throw new Error(stage);
    }
    stage = "MALFORMED_PROTOCOL";
    const observed = parseGuestVerification(result.stdout);
    report.tools = observed.tools;
    report.missingTools = observed.missing;
    report.allToolsAvailable = observed.missing.length === 0;
    stage = observed.result === "EXPLAIN_SUCCEEDED" ? "EXECUTION_FAILED" : observed.result;
    if (observed.result !== "EXPLAIN_SUCCEEDED" || result.ok !== true || result.code !== 0) throw new Error(stage);
    report.explanationSucceeded = true;
    report.result = "PASS";
  } catch {
    report.error = stage;
  }
  return report;
}

if (import.meta.main) {
  const report = await verifySbx(process.argv.slice(2));
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = ["PASS", "PLAN_ONLY"].includes(report.result) ? 0 : 2;
}
