// SPEC: _spec/gpu-host-build-reuse.puml
import { beforeAll, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { builtinModules } from "node:module";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import base from "../host-build/plan.json";
import { reusePlan } from "./plan";
import { buildReusePrograms, renderReusePacket } from "./render";

const scope = "SOURCE_ONLY_MOCK_NOT_HOST_EVIDENCE";
const repository = fileURLToPath(new URL("../../../../", import.meta.url));
const fishPrefix = "fish --no-config -c ";
type Programs = Awaited<ReturnType<typeof buildReusePrograms>>;
type Packet = Awaited<ReturnType<typeof renderReusePacket>>;
let evidence: string, programs: Programs, packet: Packet, renderer: string;

beforeAll(async () => {
  const selectedBase = process.env.HOST_BUILD_REUSE_TEST_EVIDENCE;
  if (!selectedBase) throw Error("HOST_BUILD_REUSE_TEST_EVIDENCE_REQUIRED");
  const runs = resolve(repository, "_work/gpu-owner-recovery/runs"), selected = resolve(repository, selectedBase);
  const name = relative(runs, selected), run = name.split(sep)[0]!;
  if (!name || isAbsolute(name) || name.startsWith("..") || !/^[A-Za-z0-9._-]*(?:source|test|verif)[A-Za-z0-9._-]*$/.test(run)) throw Error("SOURCE_VERIFIER_RUN_EVIDENCE_REQUIRED");
  const actual = relative(await realpath(runs), await realpath(selected));
  if (!actual || isAbsolute(actual) || actual.startsWith("..") || actual !== name) throw Error("REPOSITORY_OWNED_TEST_EVIDENCE_REQUIRED");
  evidence = resolve(selected, "host-build-reuse-render-tests");
  await mkdir(evidence);
  await writeFile(evidence + "/fixture-scope.json", JSON.stringify({ scope, sourceRenderingOnly: true, actualDockerProcesses: 0,
    actualNativeProcesses: 0, fishSyntaxExecuted: false, hostEvidence: false, cacheAccessPerformed: false,
    dockerCliCompatibilityValidated: false, nativeCliCompatibilityValidated: false }) + "\n", { flag: "wx" });
  programs = await buildReusePrograms(); packet = await renderReusePacket();
  renderer = await readFile(new URL("./render.ts", import.meta.url), "utf8");
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

function decoded() {
  expect(packet.command.startsWith(fishPrefix)).toBe(true);
  const outer = fishLiteral(packet.command, fishPrefix.length); expect(outer.end).toBe(packet.command.length);
  const parent = outer.value, timeout = "command timeout --signal=TERM --kill-after=120s 4080s fish --no-config -c ";
  const timeoutAt = parent.indexOf(timeout); expect(timeoutAt).toBeGreaterThan(0);
  const checked = fishLiteral(parent, timeoutAt + timeout.length);
  const marker = "set -l program ", programAt = checked.value.indexOf(marker); expect(programAt).toBeGreaterThan(0);
  const worker = fishLiteral(checked.value, programAt + marker.length);
  const invocation = "command mise exec core:bun@1.4.0 core:rust@1.95.0 -- bun --no-env-file --no-install --eval ";
  const invocationAt = worker.value.indexOf(invocation); expect(invocationAt).toBeGreaterThan(0);
  const inline = fishLiteral(worker.value, invocationAt + invocation.length);
  return { parent, checked: checked.value, checkedPrefix: checked.value.slice(0, programAt), checkedSuffix: checked.value.slice(worker.end),
    worker: worker.value, invocationAt, inline: inline.value, inlineSuffix: worker.value.slice(inline.end), afterTimeout: parent.slice(checked.end) };
}

test("both deterministic local bundles parse as JavaScript and retain only normalized Node built-in imports", async () => {
  expect(await buildReusePrograms()).toEqual(programs);
  expect(packet.programs).toEqual(programs); expect(await renderReusePacket()).toEqual(packet);
  for (const program of [programs.host, programs.native]) {
    const scan = new Bun.Transpiler({ loader: "js", target: "bun" }).scan(program);
    expect(scan.imports.length).toBeGreaterThan(0);
    for (const row of scan.imports) expect(builtinModules).toContain(row.path.replace(/^node:/, ""));
    expect(program).not.toMatch(/\bimport\s+type\b|from\s+["']\.\.?\//);
    expect(Buffer.byteLength(program)).toBeLessThan(131072);
  }
});

test("one complete plan is embedded in the host while the native entrypoint reads the exclusively delivered plan", async () => {
  const { plan, host, native } = programs, embedded = JSON.stringify(plan);
  expect(plan).toEqual(await reusePlan());
  expect(host.endsWith(`\nawait runReuseHost(${embedded},${JSON.stringify(native)});`)).toBe(true);
  expect(host.split(embedded)).toHaveLength(2);
  expect(native.endsWith('\nawait runReuseNative(JSON.parse(await Bun.file("/evidence/plan.json").text()));')).toBe(true);
  expect(native).not.toContain(embedded);
  expect(native.match(/\nawait runReuseNative\(/g)).toHaveLength(1);
  expect(host.match(/\nawait runReuseHost\(/g)).toHaveLength(1);
  const runtime = await readFile(new URL("./runtime.ts", import.meta.url), "utf8");
  expect(runtime).toMatch(/writeFile\(evidence\s*\+\s*"\/plan\.json",\s*JSON\.stringify\(p\)\s*\+\s*"\\n",\s*\{\s*flag:\s*"wx"\s*\}\)/);
});

test("bundling omits disk-output configuration and excludes old executable entrypoints and donor command paths", () => {
  expect(renderer).toMatch(/\bBun\.build\s*\(/);
  expect(renderer).toMatch(/target:\s*"bun"/); expect(renderer).toMatch(/sourcemap:\s*"none"/);
  for (const [key, value] of [["whitespace", "true"], ["syntax", "true"], ["identifiers", "false"]]) expect(renderer).toMatch(new RegExp(key + ":\\s*" + value));
  expect(renderer).not.toMatch(/\b(?:outdir|outfile|write)\s*:|\bBun\.(?:write|compile|spawn|spawnSync)\s*\(|\b(?:execFile|execSync|spawn)\s*\(/);
  expect(renderer).toMatch(/outputs\[0\]!\.text\(\)/);
  for (const program of [programs.host, programs.native]) {
    expect(program).not.toMatch(/\b(?:runHostBuild|executeBuild|runNativeBuild)\s*\(|["'](?:donor-create|donor-start|bun-copy)["']/);
    expect(program).not.toMatch(/(?:Bun\.argv|process\.argv)\s*\.\s*(?:includes|indexOf)\s*\(\s*["']--(?:host|native)-build/);
  }
});

test("nested Fish quoting round-trips the exact inline host, fresh grant and bounded single-argument sources", () => {
  const value = decoded();
  expect(value.inline).toBe(programs.host);
  expect(value.inlineSuffix).toBe(` -- '${programs.plan.grant}' < /dev/null`);
  expect(programs.plan.grant).not.toBe(base.grant);
  expect(packet.command).not.toContain("\0");
  const literal = fishLiteral(value.parent, "set -l evidence ".length);
  expect(literal.value).toBe(programs.plan.evidence);
  for (const argument of [value.parent, value.checked, value.worker, value.inline]) expect(Buffer.byteLength(argument)).toBeLessThan(131072);
  expect(renderer).toMatch(/\[worker,\s*checked,\s*parent\]\.some\(/);
});

test("three disabled Mise auto-install switches precede the exact pinned no-install no-env-file stdin-closed invocation", () => {
  const { worker, invocationAt } = decoded();
  const switches = ["MISE_AUTO_INSTALL", "MISE_EXEC_AUTO_INSTALL", "MISE_TASK_RUN_AUTO_INSTALL"];
  expect(worker.slice(0, invocationAt)).toBe(switches.map(name => `set -gx ${name} false`).join("; ") + "; ");
  expect(worker.match(/command mise exec /g)).toHaveLength(1);
  expect(worker).toContain("core:bun@1.4.0 core:rust@1.95.0 -- bun --no-env-file --no-install --eval ");
  expect(worker.endsWith(" < /dev/null")).toBe(true);
  expect(worker.slice(0, invocationAt)).not.toMatch(/mise\s+(?:install|trust|use|upgrade)|--yes|--force|sudo/);
  expect(programs.plan.hostExecutionApproved).toBe(false); expect(programs.plan.cacheWritesAuthorized).toBe(false);
});

test("an exclusive parent evidence directory and common epoch bound Fish syntax and execution to 4080+120 seconds", () => {
  const { parent, checked, checkedPrefix, checkedSuffix } = decoded(), p = programs.plan;
  expect(parent).toStartWith(`set -l evidence '${p.evidence}'; command mkdir -- "$evidence"; or exit 1; command timeout `);
  expect(parent.match(/command timeout /g)).toHaveLength(1);
  expect(parent).toContain("--signal=TERM --kill-after=120s 4080s fish --no-config -c ");
  expect(4080000 + 120000).toBe(p.limits.overallMs);
  expect(checkedPrefix).toBe("set -gx HOST_NATIVE_BUILD_STARTED_MS (command date +%s%3N); or exit $status; ");
  expect(checked.match(/command date \+%s%3N/g)).toHaveLength(1);
  expect(checkedSuffix).toBe(`; fish --no-config -n -c "$program" > '${p.evidence}/syntax.stdout' 2> '${p.evidence}/syntax.stderr'; or exit $status; fish --no-config -c "$program"`);
  expect(checked.indexOf("HOST_NATIVE_BUILD_STARTED_MS")).toBeLessThan(checked.indexOf('fish --no-config -n -c "$program"'));
  expect(checked.indexOf("HOST_NATIVE_BUILD_STARTED_MS")).toBeLessThan(checked.indexOf("command mise exec "));
  expect(parent).not.toMatch(/mkdir -p|\brm\s|\brmdir\s|\bchmod\s|\bchown\s|\bulimit\s/);
});

test("the parent preserves separate streams, immediate status, post-exit 64-KiB soft caps and one exit marker", () => {
  const { parent, afterTimeout } = decoded();
  expect(afterTimeout).toStartWith(' > "$evidence/worker.stdout" 2> "$evidence/worker.stderr"; set -l code $status; ');
  expect(afterTimeout).toContain('for stream in stdout stderr; if test (command wc -c < "$evidence/worker.$stream") -gt 65536; set code 1; end; end');
  expect(afterTimeout).toContain('printf \'%s\\n\' $code > "$evidence/command.exit"; or exit 1');
  expect(afterTimeout).toContain('command cat -- "$evidence/worker.stdout"; command cat -- "$evidence/worker.stderr" >&2');
  expect(afterTimeout).toContain('if test -f "$evidence/receipt.json"; command cat -- "$evidence/receipt.json"; end');
  expect(parent.endsWith("printf 'HOST_NATIVE_BUILD_EXIT=%s\\n' $code; exit $code")).toBe(true);
  expect(parent.match(/HOST_NATIVE_BUILD_EXIT=/g)).toHaveLength(1);
});

test("rendered executable paths contain no publication, fetching, shared builder, GPU or elevated-permission commands", () => {
  const value = decoded(), commandOutsideProgram = value.worker.slice(0, value.invocationAt) + value.inlineSuffix + value.afterTimeout;
  expect(commandOutsideProgram).not.toMatch(/\b(?:git|sudo|curl|wget|nvidia-smi|nvcc)\s|\bgh\s+(?:api|release|auth|repo)\b|--gpus|--privileged|--security-opt/);
  for (const program of [programs.host, programs.native]) {
    expect(program).not.toMatch(/\bfetch\s*\(|["'](?:git|curl|wget|nvidia-smi|nvcc|buildx|push|pull|--gpus|--privileged|--security-opt)["']/);
    expect(program).not.toMatch(/docker\(p,\s*["']cp["']/);
  }
  for (const [key, value] of Object.entries(programs.plan)) if (/Authorized$|Approved$|trainingReady$|sourcePublicationRequired$/.test(key)) expect(value).toBe(false);
  expect(programs.plan.maximums.bunCopies).toBe(0); expect(programs.plan.maximums.donorCreates).toBe(0);
});

test("the delivery binds exact corrected repository bytes while retaining the two existing helpers and Cargo.lock dependency", async () => {
  const { plan, host, native } = programs;
  const corrected = await readFile(resolve(repository, plan.overlay.path), "utf8");
  const manifest = await readFile(resolve(repository, "_work/gpu-owner-recovery/runs/host-gpu-policy-record-correction-source-2/native-source-manifest.json"), "utf8");
  expect(plan.overlay.correctedUtf8).toBe(corrected); expect(plan.correctedManifest.utf8).toBe(manifest);
  expect(host).toContain(JSON.stringify(plan));
  expect(native).not.toContain(JSON.stringify(corrected)); expect(native).not.toContain(JSON.stringify(manifest));
  expect(plan.existingHelpers).toEqual(base.existingHelpers); expect(plan.existingHelpers).toHaveLength(2);
  expect(host).toContain("EXISTING_HOST_HELPER_MISMATCH:"); expect(host).toContain("HOST_REPOSITORY_CONTEXT_REQUIRED");
  expect(native).toContain("/_work/gpu-owner-recovery/verify.ts");
  expect(native).toContain("/tooling/runtime/qualification.ts");
  const lockHash = createHash("sha256").update(await readFile(resolve(repository, "Cargo.lock"))).digest("hex");
  expect(lockHash).toBe("77f674cc26a01f26558fd99c45bdcd5566017be05833fce1d39cae98cda05955");
  expect(host).toContain(lockHash); expect(plan.helperDownloads).toBe(0);
});

test("bounded rendered fixtures persist only under fresh source-only verifier evidence without running any delivery", async () => {
  const files = { "source-only-native.mjs": programs.native, "source-only-host.mjs": programs.host,
    "source-only-command.fish": packet.command + "\n", "source-only-plan.json": JSON.stringify(programs.plan, null, 2) + "\n" };
  for (const [name, text] of Object.entries(files)) {
    expect(Buffer.byteLength(text)).toBeLessThan(262144);
    await writeFile(evidence + "/" + name, text, { flag: "wx" });
    expect(await readFile(evidence + "/" + name, "utf8")).toBe(text);
  }
  const retained = JSON.parse(await readFile(evidence + "/fixture-scope.json", "utf8"));
  expect(retained.scope).toBe(scope); expect(retained.sourceRenderingOnly).toBe(true);
  expect(retained.actualDockerProcesses).toBe(0); expect(retained.actualNativeProcesses).toBe(0);
  for (const key of ["hostEvidence", "fishSyntaxExecuted", "cacheAccessPerformed", "dockerCliCompatibilityValidated", "nativeCliCompatibilityValidated"]) expect(retained[key]).toBe(false);
});
