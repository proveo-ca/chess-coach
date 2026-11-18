// SPEC: _spec/gpu-host-build.puml
import { beforeAll, expect, test } from "bun:test";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import plan from "./plan.json";
import { buildPrograms, renderHostBuild } from "./render";

const scope = "SOURCE_ONLY_MOCK_NOT_HOST_EVIDENCE";
const repository = fileURLToPath(new URL("../../../../", import.meta.url));
const fishPrefix = "fish --no-config -c ";
let evidence: string;

beforeAll(async () => {
  const base = process.env.HOST_BUILD_TEST_EVIDENCE;
  if (!base) throw Error("HOST_BUILD_TEST_EVIDENCE_REQUIRED");
  const runs = resolve(repository, "_work/gpu-owner-recovery/runs"), selected = resolve(repository, base);
  const name = relative(runs, selected), run = name.split(sep)[0]!;
  if (!name || isAbsolute(name) || name.startsWith("..") || !/^[A-Za-z0-9._-]*(?:source|test|verif)[A-Za-z0-9._-]*$/.test(run)) throw Error("SOURCE_VERIFIER_RUN_EVIDENCE_REQUIRED");
  const actual = relative(await realpath(runs), await realpath(selected));
  if (!actual || isAbsolute(actual) || actual.startsWith("..") || actual !== name) throw Error("REPOSITORY_OWNED_TEST_EVIDENCE_REQUIRED");
  evidence = resolve(selected, "host-build-render-tests"); await mkdir(evidence);
  await writeFile(evidence + "/fixture-scope.json", JSON.stringify({ scope, sourceRenderingOnly: true, actualDockerProcesses: 0, actualNativeProcesses: 0,
    fishSyntaxExecuted: false, dockerCliCompatibilityValidated: false, nativeCliCompatibilityValidated: false, hostEvidence: false }) + "\n", { flag: "wx" });
});

function fishLiteral(source: string, start = 0): { value: string; end: number } {
  if (source[start] !== "'") throw Error("FISH_LITERAL_REQUIRED");
  let value = "";
  for (let index = start + 1; index < source.length; index++) {
    const character = source[index]!;
    if (character === "'") return { value, end: index + 1 };
    if (character === "\\" && ["\\", "'"].includes(source[index + 1] ?? "")) value += source[++index];
    else value += character;
  }
  throw Error("UNTERMINATED_FISH_LITERAL");
}

function wholeLiteral(source: string) {
  const literal = fishLiteral(source); expect(literal.end).toBe(source.length); return literal.value;
}

async function decoded() {
  const programs = await buildPrograms(), command = await renderHostBuild();
  expect(command.startsWith(fishPrefix)).toBe(true);
  const parent = wholeLiteral(command.slice(fishPrefix.length));
  const timeout = "command timeout --signal=TERM --kill-after=120s 4080s fish --no-config -c ";
  const position = parent.indexOf(timeout); expect(position).toBeGreaterThan(0);
  const checked = fishLiteral(parent, position + timeout.length);
  expect(parent.slice(checked.end)).toStartWith(' > "$evidence/worker.stdout" 2> "$evidence/worker.stderr"; set -l code $status; ');
  const programMarker = "set -l program ", programAt = checked.value.indexOf(programMarker); expect(programAt).toBeGreaterThan(0);
  const worker = fishLiteral(checked.value, programAt + programMarker.length);
  const invocation = "command mise exec core:bun@1.4.0 core:rust@1.95.0 -- bun --no-env-file --no-install --eval ";
  const invocationAt = worker.value.indexOf(invocation); expect(invocationAt).toBeGreaterThan(0);
  const inline = fishLiteral(worker.value, invocationAt + invocation.length);
  return { ...programs, command, parent, checked: checked.value, checkedPrefix: checked.value.slice(0, programAt), checkedSuffix: checked.value.slice(worker.end), worker: worker.value,
    invocationAt, inline: inline.value, inlineSuffix: worker.value.slice(inline.end) };
}

test("both deterministic inline programs parse as JavaScript without executing their host or native entrypoints", async () => {
  const programs = await buildPrograms(); expect(await buildPrograms()).toEqual(programs);
  for (const program of [programs.native, programs.host]) {
    expect(() => new Bun.Transpiler({ loader: "js", target: "bun" }).scan(program)).not.toThrow();
    expect(program).not.toMatch(/\bimport\s+type\b|from\s+["']\.\.?\//);
    const imports = new Bun.Transpiler({ loader: "js", target: "bun" }).scan(program).imports;
    expect(imports.length).toBeGreaterThan(0);
    for (const row of imports) expect(row.path).toStartWith("node:");
  }
  expect(Buffer.byteLength(programs.host)).toBeLessThanOrEqual(131072);
  expect(Buffer.byteLength(programs.native)).toBeLessThan(65536);
});

test("rendered programs embed the exact pending plan and the same native driver without a local runtime import", async () => {
  const { native, host } = await buildPrograms();
  expect(native.endsWith(`\nawait runNativeBuild(${JSON.stringify(plan)});`)).toBe(true);
  expect(host.endsWith(`\nawait runHostBuild(${JSON.stringify(plan)},${JSON.stringify(native)});`)).toBe(true);
  expect(native.match(/\nawait runNativeBuild\(/g)).toHaveLength(1); expect(host.match(/\nawait runHostBuild\(/g)).toHaveLength(1);
  for (const text of ["./plan.json", 'from "./driver', 'from "./build', 'from "../host-receive']) expect(native + host).not.toContain(text);
  expect(host).toContain("FRESH_PINNED_HOST_BUILD_CONTEXT_REQUIRED"); expect(host).toContain('Bun.version === "1.4.0"');
  expect(host).toContain("Bun.argv.at(-1) === p.grant"); expect(native).toContain("NATIVE_BUN_CONTEXT_REQUIRED");
});

test("only two existing pinned helpers are admitted and no rendered program fetches or installs helpers", async () => {
  expect(plan.existingHelpers).toEqual([
    { path: "_work/gpu-owner-recovery/verify.ts", sha256: "9831b75035a5d832c6d86608b7d561821ee1a4c6dec8d2a7ecd31fbca55d5f58" },
    { path: "_work/gpu-owner-recovery/command-supervisor.ts", sha256: "88e56077c3bcddf722f81081a0cb7c6f94d1da106add486dbf13a92d165fb9c6" },
  ]);
  const { native, host } = await buildPrograms();
  expect(host).toContain('"EXISTING_HOST_HELPER_MISMATCH:"');
  expect(host).toContain("hash(await readFile(helper.path)) === helper.sha256");
  expect(host.indexOf("EXISTING_HOST_HELPER_MISMATCH")).toBeLessThan(host.indexOf("receipt = await executeBuild("));
  expect(host).toContain("pathToFileURL(resolve(p.existingHelpers[0]");
  expect(native).toContain('root + "/_work/gpu-owner-recovery/verify.ts"');
  expect(native).toContain('root + "/tooling/runtime/qualification.ts"');
  expect(native + host).not.toMatch(/https?:\/\/|\bfetch\s*\(|\b(?:curl|wget)\b|\bgh\s+api\b|Bun\.install|bun install|mise install/);
  expect(plan.helperDownloads).toBe(0);
});

test("nested Fish literals round-trip the complete inline host program and exact grant without execution", async () => {
  const value = await decoded();
  expect(await renderHostBuild()).toBe(value.command); expect(value.command).not.toContain("\0");
  expect(value.inline).toBe(value.host); expect(value.inlineSuffix).toBe(` -- '${plan.grant}' < /dev/null`);
  const evidence = fishLiteral(value.parent, "set -l evidence ".length);
  expect(evidence.value).toBe(plan.evidence);
  expect(value.checkedSuffix).toBe(`; fish --no-config -n -c "$program" > '${plan.evidence}/syntax.stdout' 2> '${plan.evidence}/syntax.stderr'; or exit $status; fish --no-config -c "$program"`);
});

test("all three Mise automatic-install switches precede the single exact pinned invocation", async () => {
  const { worker, invocationAt } = await decoded();
  const switches = ["MISE_AUTO_INSTALL", "MISE_EXEC_AUTO_INSTALL", "MISE_TASK_RUN_AUTO_INSTALL"];
  expect(worker.slice(0, invocationAt)).toBe(switches.map(name => `set -gx ${name} false`).join("; ") + "; ");
  expect(worker.match(/command mise exec /g)).toHaveLength(1);
  expect(worker).toContain("core:bun@1.4.0 core:rust@1.95.0 -- bun --no-env-file --no-install --eval ");
  expect(worker).not.toMatch(/mise (?:install|trust|use|upgrade)|--yes|--force|sudo|sourcePublicationRequired":true|hostExecutionApproved":true/);
});

test("parent ownership, syntax checking and the 4080-second plus 120-second grace bound precede execution", async () => {
  const { parent, checked } = await decoded();
  expect(parent).toStartWith(`set -l evidence '${plan.evidence}'; command mkdir -- "$evidence"; or exit 1; command timeout `);
  expect(4080 * 1000 + 120 * 1000).toBe(plan.limits.overallMs);
  expect(parent.match(/command timeout /g)).toHaveLength(1);
  expect(checked.indexOf('fish --no-config -n -c "$program"')).toBeLessThan(checked.lastIndexOf('fish --no-config -c "$program"'));
  expect(checked).toContain('; or exit $status; fish --no-config -c "$program"');
  expect(parent).not.toMatch(/mkdir -p|\brm\s|\brmdir\s|\bchmod\s|\bchown\s|\bulimit\s/);
});

test("the shared start epoch precedes Fish syntax checking and Mise without querying a real host clock", async () => {
  const { checked, checkedPrefix } = await decoded();
  expect(checkedPrefix).toBe("set -gx HOST_NATIVE_BUILD_STARTED_MS (command date +%s%3N); or exit $status; ");
  expect(checked.match(/command date \+%s%3N/g)).toHaveLength(1);
  expect(checked.indexOf("HOST_NATIVE_BUILD_STARTED_MS")).toBeLessThan(checked.indexOf('fish --no-config -n -c "$program"'));
  expect(checked.indexOf("HOST_NATIVE_BUILD_STARTED_MS")).toBeLessThan(checked.indexOf("command mise exec "));
});

test("inline host source validates elapsed preflight time and passes the original origin and exclusive deadline file to the pipeline", async () => {
  const { host } = await buildPrograms();
  expect(host).toContain("Number(process.env.HOST_NATIVE_BUILD_STARTED_MS)"); expect(host).toContain("elapsed = Date.now() - startedEpoch");
  expect(host).toContain("Number.isSafeInteger(startedEpoch) && startedEpoch > 0 && elapsed >= 0 && elapsed < p.limits.normalOperationsMs");
  expect(host).toContain("HOST_BUILD_START_TIME_REQUIRED"); expect(host).toContain("startedAt = performance.now() - elapsed");
  expect(host).toMatch(/now: \(\) => performance\.now\(\),\s*startedAt,/);
  expect(host).toContain("started = io.startedAt ?? io.now()");
  expect(host).toContain('evidence + "/deadline.json"'); expect(host).toContain("normalDeadlineEpoch: startedEpoch + p.limits.normalOperationsMs");
  expect(host.indexOf("HOST_BUILD_START_TIME_REQUIRED")).toBeLessThan(host.indexOf("EXISTING_HOST_HELPER_MISMATCH"));
  expect(host.indexOf('evidence + "/deadline.json"')).toBeLessThan(host.indexOf("receipt = await executeBuild("));
  const source = await readFile(new URL("./build.ts", import.meta.url), "utf8");
  expect(source).toMatch(/writeFile\(evidence \+ "\/deadline\.json",[^\n]+\{ flag: "wx" \}\)/);
});

test("inline native source clips its 3600-second ceiling to the remaining shared normal deadline instead of resetting it", async () => {
  const { native } = await buildPrograms();
  expect(native).toContain('readFile("/evidence/deadline.json", "utf8")');
  expect(native).toContain("Number.isSafeInteger(hostDeadline) && hostDeadline > Date.now()");
  expect(native).toContain("NATIVE_HOST_DEADLINE_REQUIRED");
  expect(native).toContain("deadline = Math.min(started + p.limits.nativeWorkMs, performance.now() + hostDeadline - Date.now())");
  expect(native.indexOf("NATIVE_HOST_DEADLINE_REQUIRED")).toBeLessThan(native.indexOf('stage = "staging"'));
  expect(native).not.toContain("deadline = started + p.limits.nativeWorkMs"); expect(plan.limits.nativeWorkMs).toBe(3600000);
});

test("inline lifecycle separates capped start from log following and requires checked source stability", async () => {
  const { host } = await buildPrograms();
  expect(host).toContain('operation("worker-start", docker(p, "start", ids.worker)');
  expect(host).toContain('operation("worker-logs", docker(p, "logs", "--follow", ids.worker)'); expect(host).not.toContain("--attach");
  expect(host.indexOf('operation("worker-start"')).toBeLessThan(host.indexOf('operation("worker-logs"'));
  expect(host).toMatch(/native\.sourceChanged === (?:false|!1)/); expect(host).toMatch(/native\.sourceStabilityChecked === (?:true|!0)/);
  expect(host).toContain("await unwatch()"); expect(host).toContain("await stopPromise");
  expect(host).toContain("Math.min(p.limits.artifactValidationMs, normalDeadline - io.now())");
  expect(host).toContain("await io.artifacts(artifactMs)"); expect(host).toContain("io.now() < normalDeadline");
});

test("host source protects signals independently before preflight and releases only after receipt, marker and exit finalization", async () => {
  const source = await readFile(new URL("./build.ts", import.meta.url), "utf8"), body = source.slice(source.indexOf("export async function runHostBuild("));
  const anchors = ["const protection = protectFinalizationSignals()", 'requireValue(!protection.observed(), "HOST_BUILD_INTERRUPTED_DURING_PREFLIGHT")',
    "receipt = await executeBuild(", 'await writeFile(evidence + "/receipt.json"', "console.log(", "process.exitCode =", "protection.release()"];
  let previous = -1;
  for (const anchor of anchors) { const index = body.indexOf(anchor); expect(index).toBeGreaterThan(previous); previous = index; }
  expect(body.match(/protectFinalizationSignals\(/g)).toHaveLength(1); expect(body.match(/protection\.release\(\)/g)).toHaveLength(1);
  expect(body).toMatch(/\}\s*finally \{ protection\.release\(\); \}\s*\}\s*$/);
  expect(body).toContain('receipt.failure ??= "HOST_BUILD_INTERRUPTED"'); expect(body).toContain("finalizationSignalObserved: protection.observed()");
  const pipeline = source.slice(source.indexOf("export async function executeBuild("), source.indexOf("export type TreeIO"));
  expect(pipeline.indexOf("await unwatch()")).toBeGreaterThan(0);
  expect(pipeline.indexOf("await unwatch()")).toBeLessThan(pipeline.indexOf('for (const kind of ["worker", "donor"]'));
  const monitor = source.slice(source.indexOf("export function watchWorkspace("), source.indexOf("export function protectFinalizationSignals("));
  expect(monitor).toContain('process.off("SIGTERM", interrupt)'); expect(monitor).toContain('process.off("SIGINT", interrupt)'); expect(monitor).not.toContain("protection.release");
  const { host } = await buildPrograms(); expect(host).toContain("protectFinalizationSignals"); expect(host).toContain("finalizationSignalObserved: protection.observed()");
});

test("a signal observed during receipt IO must fail the later status marker and parent exit without replacing an earlier failure", async () => {
  const source = await readFile(new URL("./build.ts", import.meta.url), "utf8"), body = source.slice(source.indexOf("export async function runHostBuild("));
  const write = body.indexOf('await writeFile(evidence + "/receipt.json"'), marker = body.indexOf("console.log(", write);
  expect(write).toBeGreaterThan(0); expect(marker).toBeGreaterThan(write);
  const afterWriteBeforeMarker = body.slice(write, marker);
  expect(afterWriteBeforeMarker).toContain("protection.observed()");
  expect(afterWriteBeforeMarker).toContain('receipt.status = "FAIL_HOST_GPU_NATIVE_BUILD_ONLY"');
  expect(afterWriteBeforeMarker).toContain('receipt.failure ??= "HOST_BUILD_INTERRUPTED"');
  expect(body.slice(marker)).toContain('status: receipt.status, failure: receipt.failure');
  expect(body.slice(marker)).toContain('process.exitCode = receipt.status === "PASS_HOST_GPU_NATIVE_BUILD_ONLY" ? 0 : 1');
  const { parent } = await decoded(); expect(parent).toContain("set -l code $status"); expect(parent.endsWith("printf 'HOST_NATIVE_BUILD_EXIT=%s\\n' $code; exit $code")).toBe(true);
});

test("native source rechecks inventory outside the command try-catch and preserves primary failure before writing stability evidence", async () => {
  const source = await readFile(new URL("./driver.ts", import.meta.url), "utf8");
  const body = source.slice(source.indexOf("export async function runNativeBuild("));
  expect(body).toMatch(/\}\s*catch \(error\) \{ failure = [^\n]+ \}\s*const sourceCheck = await recheckNativeSource\(inventory, inventoryReader, remaining\);/);
  expect(body).toContain('failure ??= sourceCheck.sourceChanged ? "NATIVE_SOURCE_CHANGED" : "NATIVE_SOURCE_STABILITY_UNCHECKED"');
  expect(body).toContain("results, ...sourceCheck"); expect(body).not.toMatch(/sourceChanged:\s*false|sourceStabilityChecked:\s*true/);
  expect(body.indexOf("await recordNativeCommand(")).toBeLessThan(body.indexOf("await recheckNativeSource("));
  expect(body.indexOf("await recheckNativeSource(")).toBeLessThan(body.indexOf('await writeFile(directory + "/receipt.json"'));
  const { native } = await buildPrograms();
  expect(native).toContain("captureFailures"); expect(native).toContain("canonicalCopyFailures"); expect(native).toContain("sourceCheckFailure");
});

test("parent preserves separate streams, immediate child status, post-exit soft caps and one common exit label", async () => {
  const { parent } = await decoded();
  expect(parent).toContain(' > "$evidence/worker.stdout" 2> "$evidence/worker.stderr"; set -l code $status; for stream in stdout stderr;');
  expect(parent).toContain('if test (command wc -c < "$evidence/worker.$stream") -gt 65536; set code 1; end; end');
  expect(parent).toContain('printf \'%s\\n\' $code > "$evidence/command.exit"; or exit 1');
  expect(parent).toContain('command cat -- "$evidence/worker.stdout"; command cat -- "$evidence/worker.stderr" >&2');
  expect(parent).toContain('if test -f "$evidence/receipt.json"; command cat -- "$evidence/receipt.json"; end');
  expect(parent.endsWith("printf 'HOST_NATIVE_BUILD_EXIT=%s\\n' $code; exit $code")).toBe(true);
  expect(parent.match(/HOST_NATIVE_BUILD_EXIT=/g)).toHaveLength(1);
});

test("rendering carries no Git, publication, image-fetch, shared-builder, permission-change or GPU command", async () => {
  const { native, host, command } = await decoded();
  expect(native + host + command).not.toMatch(/\b(?:git|sudo|curl|wget|nvidia-smi|nvcc)\s|\bgh\s+(?:api|release|auth|repo)\b|\b(?:chmod|chown)\s*\(|\bfetch\s*\(|["']buildx["']|["']pull["']|["']--gpus["']|["']--privileged["']|["']--security-opt["']/);
  expect(plan.sourcePublicationRequired).toBe(false); expect(plan.hostExecutionApproved).toBe(false);
  expect(plan.imagePullOrDependencyFetchAuthorized).toBe(false); expect(plan.sharedBuilderModificationAuthorized).toBe(false);
  expect(plan.gpuExecutionAuthorized).toBe(false); expect(plan.trainingAuthorized).toBe(false); expect(plan.trainingReady).toBe(false);
});

test("native source performs compilation only, with exclusive logs and receipts rather than test-binary execution", async () => {
  const { native, host } = await buildPrograms();
  expect(native).toContain('"--no-run"'); expect(native).toContain('"--message-format=json"');
  expect(native).toContain("constants.COPYFILE_EXCL"); expect(native).toContain('flag: "wx"');
  expect(native).toMatch(/testsExecuted: (?:false|!1)/); expect(native).toMatch(/gpuExecuted: (?:false|!1)/); expect(native).toMatch(/trainingReady: (?:false|!1)/);
  for (const key of ["testsExecuted", "gpuDevicesRequested", "workspaceIsFilesystemQuota", "dockerWritableLayerIncludedInWorkspaceAccounting"]) expect(host).toMatch(new RegExp(key + ": (?:false|!1)"));
  for (const key of ["bunCopyHasOnlyPostCopySizeCheck", "parentDiagnosticsHaveOnlyPostExitSoftSizeCheck"]) expect(host).toMatch(new RegExp(key + ": (?:true|!0)"));
  expect(native).not.toMatch(/Bun\.spawn|\bexecFile\b|\bspawn\s*\(/);
});

test("bounded rendered fixtures remain in fresh source-only evidence without invoking Fish, Docker or native tools", async () => {
  const { native, host } = await buildPrograms(), command = await renderHostBuild();
  const files = { "source-only-native.mjs": native, "source-only-host.mjs": host, "source-only-command.fish": command + "\n" };
  for (const [name, text] of Object.entries(files)) {
    expect(Buffer.byteLength(text)).toBeLessThan(262144); await writeFile(evidence + "/" + name, text, { flag: "wx" });
    expect(await readFile(evidence + "/" + name, "utf8")).toBe(text);
  }
  const retained = JSON.parse(await readFile(evidence + "/fixture-scope.json", "utf8"));
  expect(retained.scope).toBe(scope); expect(retained.hostEvidence).toBe(false);
  expect(retained.fishSyntaxExecuted).toBe(false); expect(retained.dockerCliCompatibilityValidated).toBe(false); expect(retained.nativeCliCompatibilityValidated).toBe(false);
});
