// SPEC: _spec/tooling/sbx-dev/preparation-workflow.puml
import { createHash, randomBytes } from "node:crypto";
import {
  accessSync, closeSync, constants, fchmodSync, fstatSync, fsyncSync, lstatSync,
  mkdirSync, mkdtempSync, openSync, readSync, readdirSync, realpathSync, writeSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { runBounded } from "../native-ingress/f9-diagnose.mjs";
import { privateDirectory } from "../sbx-smoke/create-debug.mjs";
import { artifactFileName, completeProfile, guestToolContext, validateGuestToolRoot } from "./complete-profile.mjs";

export const STAGES = Object.freeze([
  "policy", "preflight", "accept-policy", "reserve", "host-capacity", "acquire", "copy", "inspect", "install", "verify",
]);
const SOURCE_NAMES = ["complete-tools.mjs", "complete-profile.mjs", "complete-archive.mjs", "complete-guest.mjs"];
const GUEST_SOURCES = SOURCE_NAMES.slice(1);
const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT = resolve(HERE, "../..");
const SOURCE_CAP = 256 * 1024;
const RECORD_CAP = 64 * 1024;
const CHUNK = 128 * 1024;
const AUTHORITY = Object.freeze({ gate0: "OPEN", f9Qualified: false, trainingReady: false });
const hash = (value) => createHash("sha256").update(value).digest("hex");
const PROFILE_SHA = hash(JSON.stringify(completeProfile));
const hex = (value, length) => typeof value === "string" && value.length === length && !/[^0-9a-f]/.test(value);
const same = (a, b) => ["dev", "ino", "mode", "uid", "gid", "nlink", "size", "mtimeNs", "ctimeNs"]
  .every((key) => a[key] === b[key]);

function fail() { throw new Error("DEV_TOOLS_STOP"); }

function plain(value) {
  return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype;
}

function keys(value, expected) {
  if (!plain(value) || Reflect.ownKeys(value).length !== expected.length
    || expected.some((key) => !Object.hasOwn(value, key))
    || Reflect.ownKeys(value).some((key) => typeof key !== "string"
      || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), "value"))) fail();
}

function absolute(value) {
  if (typeof value !== "string" || !value || value.length > 4096 || !isAbsolute(value) || resolve(value) !== value
    || /[\x00-\x1f\x7f-\x9f]/.test(value) || Buffer.from(value).toString("utf8") !== value) fail();
  return value;
}

function name(value) {
  if (typeof value !== "string" || value.length > 64 || !/^[A-Za-z0-9]/.test(value) || /[^A-Za-z0-9_.-]/.test(value)) fail();
  return value;
}

function stateLocation(value) {
  absolute(value);
  if (basename(value) !== "attempt.json" || dirname(dirname(value)) !== "/tmp/opencode"
    || !/^dev-sbx-tools-[A-Za-z0-9-]+$/.test(basename(dirname(value)))) fail();
  return value;
}

function optionsChecked(options) {
  if (!plain(options) || Object.keys(options).some((key) => !["name", "sbx", "state", "stage", "plan"].includes(key))
    || (options.plan !== undefined && typeof options.plan !== "boolean")) fail();
  if (options.state !== undefined || options.stage !== undefined) {
    stateLocation(options.state);
    if (!STAGES.includes(options.stage) || options.name !== undefined || options.sbx !== undefined) fail();
  } else {
    name(options.name);
    if (options.sbx !== undefined) absolute(options.sbx);
  }
  return options;
}

export function parseCompleteTools(argv) {
  const { values, tokens } = parseArgs({ args: argv, strict: true, allowPositionals: false, tokens: true, options: {
    name: { type: "string" }, sbx: { type: "string" }, state: { type: "string" }, stage: { type: "string" }, plan: { type: "boolean" },
  } });
  if (tokens.some((token) => token.kind !== "option") || new Set(tokens.map((token) => token.name)).size !== tokens.length) fail();
  return optionsChecked({ ...values });
}

export function completeToolsPlan(options) {
  optionsChecked(options);
  return {
    schema: "dev-sbx-complete-plan-v1", result: "PLAN_ONLY", ...AUTHORITY,
    name: options.name ?? "BOUND_FROM_STATE_AT_EXECUTION", sbxPath: options.sbx ?? "RESOLVED_AT_EXECUTION",
    statePath: options.state ?? "ALLOCATED_AT_EXECUTION", stages: options.stage ? [options.stage] : [...STAGES],
    profile: completeProfile, profileSha256: PROFILE_SHA, sourceFiles: [...SOURCE_NAMES], freshApprovalPerStage: true,
    previewEffects: { subprocesses: false, writes: false, downloads: false, queries: false },
  };
}

function anchor(parent, directory) {
  const current = privateDirectory(directory);
  try {
    const a = fstatSync(parent, { bigint: true }), b = fstatSync(current, { bigint: true });
    if (realpathSync(`/proc/self/fd/${parent}`) !== directory
      || ["dev", "ino", "mode", "uid", "gid"].some((key) => a[key] !== b[key])) fail();
  } finally { closeSync(current); }
}

function details(fd, cap, mode) {
  const value = fstatSync(fd, { bigint: true });
  if (!value.isFile() || value.uid !== BigInt(process.getuid()) || value.nlink !== 1n
    || value.size < 0n || value.size > BigInt(cap) || (mode !== undefined && (value.mode & 0o7777n) !== BigInt(mode))) fail();
  return value;
}

function readSmall(path, cap, mode) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = details(fd, cap, mode), bytes = Buffer.alloc(Number(before.size) + 1);
    let size = 0;
    while (size < bytes.length) {
      const count = readSync(fd, bytes, size, bytes.length - size, null);
      if (!count) break;
      size += count;
    }
    if (BigInt(size) !== before.size || !same(before, details(fd, cap, mode))) fail();
    return bytes.subarray(0, size);
  } finally { closeSync(fd); }
}

function writeAll(fd, bytes) {
  let offset = 0;
  while (offset < bytes.length) {
    const count = writeSync(fd, bytes, offset, bytes.length - offset);
    if (count <= 0) fail();
    offset += count;
  }
}

function exclusive(parent, filename, bytes, mode = 0o600) {
  const fd = openSync(`/proc/self/fd/${parent}/${filename}`,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW | constants.O_NONBLOCK, 0o600);
  try {
    fchmodSync(fd, 0o600);
    details(fd, bytes.length, 0o600);
    writeAll(fd, bytes);
    fchmodSync(fd, mode);
    fsyncSync(fd);
    if (details(fd, bytes.length, mode).size !== BigInt(bytes.length)) fail();
  } finally { closeSync(fd); }
  fsyncSync(parent);
}

function record(parent, filename, value, mode) {
  const bytes = Buffer.from(`${JSON.stringify(value)}\n`);
  if (bytes.length > RECORD_CAP) fail();
  exclusive(parent, filename, bytes, mode);
}

function existing(parent, filename, cap = RECORD_CAP, mode = 0o600) {
  try { return readSmall(`/proc/self/fd/${parent}/${filename}`, cap, mode); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

function eventName(stage, kind) {
  return `${String(STAGES.indexOf(stage) + 1).padStart(2, "0")}-${stage}.${kind}.json`;
}

function sourceBindings(dependencies) {
  const directory = dependencies.sourceDirectory ?? HERE;
  absolute(directory);
  const bindings = Object.fromEntries(SOURCE_NAMES.map((filename) => {
    const bytes = readSmall(join(directory, filename), SOURCE_CAP);
    if (!bytes.length) fail();
    return [filename, hash(bytes)];
  }));
  const config = Bun.TOML.parse(readSmall(join(dependencies.projectDirectory ?? PROJECT, "mise.toml"), RECORD_CAP).toString("utf8"));
  if (config.tools?.["core:bun"] !== "1.4.0" || config.tools?.["core:rust"]?.version !== "1.95.0"
    || config.settings?.auto_install !== false) fail();
  return bindings;
}

function executable(path) {
  absolute(path);
  if (realpathSync(path) !== path) fail();
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = fstatSync(fd, { bigint: true });
    if (!before.isFile()) fail();
    accessSync(path, constants.X_OK);
    if (!same(before, fstatSync(fd, { bigint: true }))) fail();
  } finally { closeSync(fd); }
  return path;
}

function resolveController(selected) {
  if (selected !== undefined) return executable(selected);
  for (const directory of (process.env.PATH ?? "").split(":")) {
    if (!isAbsolute(directory)) continue;
    try { return executable(realpathSync(join(directory, "sbx"))); } catch {}
  }
  fail();
}

function masterChecked(value) {
  keys(value, ["schema", "profileSha256", "attemptId", "name", "sbxPath", "guestToolRoot", "sourceBindings", ...Object.keys(AUTHORITY)]);
  if (value.schema !== "dev-sbx-complete-workflow-v1" || value.profileSha256 !== PROFILE_SHA || !hex(value.attemptId, 16)
    || value.guestToolRoot !== `/home/agent/workspace/devtools-${value.attemptId}`
    || Object.entries(AUTHORITY).some(([key, expected]) => value[key] !== expected)) fail();
  name(value.name);
  absolute(value.sbxPath);
  validateGuestToolRoot(value.guestToolRoot);
  keys(value.sourceBindings, SOURCE_NAMES);
  if (SOURCE_NAMES.some((filename) => !hex(value.sourceBindings[filename], 64))) fail();
  return value;
}

export function parseCapacity(stdout, minimumKiB) {
  if (typeof stdout !== "string" || Buffer.byteLength(stdout) > 16384 || /[\x00-\x08\x0b-\x1f\x7f-\x9f]/.test(stdout)) fail();
  const lines = stdout.split("\n");
  if (lines.length !== 3 || lines[2] !== "" || !/^Filesystem\s+1024-blocks\s+Used\s+Available\s+Capacity\s+Mounted on$/.test(lines[0])) fail();
  const fields = lines[1].trim().split(/\s+/);
  if (fields.length !== 6 || fields.slice(1, 4).some((field) => !/^[0-9]+$/.test(field))
    || !/^[0-9]{1,3}%$/.test(fields[4]) || !fields[5].startsWith("/")) fail();
  const total = Number(fields[1]), available = Number(fields[3]);
  if (![total, Number(fields[2]), available].every(Number.isSafeInteger) || available > total || available < minimumKiB) fail();
  return { freeKiB: available };
}

const PREFLIGHT = `set -eu
PATH=/usr/local/bin:/usr/bin:/bin
LC_ALL=C
export PATH LC_ALL
printf 'DEV_SBX_PREFLIGHT_V1\\n'
printf 'OS=%s\\n' "$(uname -s)"
printf 'ARCH=%s\\n' "$(uname -m)"
printf 'GLIBC=%s\\n' "$(getconf GNU_LIBC_VERSION)"
for tool in ${completeProfile.baseTools.join(" ")}; do
  if command -v "$tool" >/dev/null 2>&1; then printf 'TOOL_%s=PRESENT\\n' "$tool"; else printf 'TOOL_%s=MISSING\\n' "$tool"; fi
done
if test -w /home/agent/workspace; then printf 'WORKSPACE=WRITABLE\\n'; else printf 'WORKSPACE=UNAVAILABLE\\n'; fi
if test -x /usr/bin/tar; then printf 'TAR=EXECUTABLE\\n'; else printf 'TAR=MISSING\\n'; fi
if test -x /usr/bin/xz; then printf 'XZ=EXECUTABLE\\n'; else printf 'XZ=MISSING\\n'; fi
case "$(/usr/bin/tar --version)" in 'tar (GNU tar) '*) printf 'GNU_TAR=YES\\n';; *) printf 'GNU_TAR=NO\\n';; esac
printf 'DF_BEGIN\\n'
df -Pk /home/agent/workspace
printf 'DF_END\\nDONE\\n'
`;

export function parsePreflight(stdout) {
  if (typeof stdout !== "string" || Buffer.byteLength(stdout) > 16384) fail();
  const lines = stdout.split("\n");
  const take = (expected) => { if (lines.shift() !== expected) fail(); };
  take("DEV_SBX_PREFLIGHT_V1"); take("OS=Linux"); take("ARCH=x86_64");
  const libc = /^GLIBC=glibc ([0-9]{1,3})\.([0-9]{1,3})$/.exec(lines.shift() ?? "");
  if (!libc || !(Number(libc[1]) > 2 || (Number(libc[1]) === 2 && Number(libc[2]) >= 18))) fail();
  for (const tool of completeProfile.baseTools) take(`TOOL_${tool}=PRESENT`);
  take("WORKSPACE=WRITABLE"); take("TAR=EXECUTABLE"); take("XZ=EXECUTABLE"); take("GNU_TAR=YES"); take("DF_BEGIN");
  const capacity = parseCapacity(`${lines.shift()}\n${lines.shift()}\n`, 24 * 1024 ** 2);
  take("DF_END"); take("DONE"); take("");
  if (lines.length) fail();
  return { os: "Linux", arch: "x86_64", glibc: `${libc[1]}.${libc[2]}`, baseTools: [...completeProfile.baseTools],
    workspaceWritable: true, tar: true, xz: true, gnuTar: true, ...capacity };
}

function jsonData(value, depth = 0) {
  if (depth > 12) fail();
  if (value === null || typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) return;
  if (!plain(value) && !Array.isArray(value)) fail();
  if (Object.keys(value).length > 1000) fail();
  for (const key of Object.keys(value)) {
    if (["__proto__", "prototype", "constructor"].includes(key)) fail();
    if ((key === "gate0" && value[key] !== "OPEN") || (["f9Qualified", "trainingReady"].includes(key) && value[key] !== false)) fail();
    jsonData(value[key], depth + 1);
  }
}

export function parseGuestReport(stdout, action, state) {
  if (typeof stdout !== "string" || Buffer.byteLength(stdout) > RECORD_CAP || !["inspect", "install", "verify"].includes(action)) fail();
  const report = JSON.parse(stdout);
  keys(report, ["schema", "action", "root", "profileSha256", "result", "data", ...Object.keys(AUTHORITY)]);
  if (report.schema !== "dev-sbx-complete-guest-v1" || report.action !== action || report.root !== state.guestToolRoot
    || report.profileSha256 !== state.profileSha256 || report.result !== "PASS" || !plain(report.data)
    || Object.entries(AUTHORITY).some(([key, expected]) => report[key] !== expected)) fail();
  jsonData(report.data);
  if (action === "verify" && report.data.allToolsAvailable !== true) fail();
  return { schema: report.schema, action, root: report.root, profileSha256: report.profileSha256,
    result: "PASS", ...AUTHORITY, data: action === "verify" ? { allToolsAvailable: true } : {} };
}

function stageData(stage, data, state, events) {
  if (stage === "policy") {
    keys(data, ["policySha256", "bytes"]);
    if (!hex(data.policySha256, 64) || !Number.isSafeInteger(data.bytes) || data.bytes < 1 || data.bytes > RECORD_CAP) fail();
  } else if (stage === "preflight") {
    keys(data, ["os", "arch", "glibc", "baseTools", "workspaceWritable", "tar", "xz", "gnuTar", "freeKiB"]);
    const protocol = `DEV_SBX_PREFLIGHT_V1\nOS=${data.os}\nARCH=${data.arch}\nGLIBC=glibc ${data.glibc}\n`
      + data.baseTools.map((tool) => `TOOL_${tool}=PRESENT\n`).join("")
      + `WORKSPACE=${data.workspaceWritable === true ? "WRITABLE" : "NO"}\nTAR=${data.tar === true ? "EXECUTABLE" : "NO"}\nXZ=${data.xz === true ? "EXECUTABLE" : "NO"}\nGNU_TAR=${data.gnuTar === true ? "YES" : "NO"}\nDF_BEGIN\nFilesystem 1024-blocks Used Available Capacity Mounted on\n/dev/root ${data.freeKiB} 0 ${data.freeKiB} 0% /\nDF_END\nDONE\n`;
    if (JSON.stringify(parsePreflight(protocol)) !== JSON.stringify(data)) fail();
  } else if (stage === "accept-policy") {
    keys(data, ["policySha256", "preflightSha256"]);
    if (data.policySha256 !== events[0].data.policySha256 || data.preflightSha256 !== events[1].sha256) fail();
  } else if (stage === "reserve") {
    keys(data, ["reserved"]); if (data.reserved !== true) fail();
  } else if (stage === "host-capacity") {
    keys(data, ["freeKiB"]); if (!Number.isSafeInteger(data.freeKiB) || data.freeKiB < 10 * 1024 ** 2) fail();
  } else if (stage === "acquire") {
    keys(data, ["artifacts", "bootstrap"]);
    if (!Array.isArray(data.artifacts) || data.artifacts.length !== completeProfile.artifacts.length) fail();
    let total = 0;
    for (const [index, item] of data.artifacts.entries()) {
      keys(item, ["id", "bytes", "sha256"]);
      const expected = completeProfile.artifacts[index];
      if (item.id !== expected.id || item.sha256 !== expected.sha256 || !Number.isSafeInteger(item.bytes) || item.bytes < 1
        || item.bytes > completeProfile.limits.archiveBytes || (expected.bytes !== null && item.bytes !== expected.bytes)) fail();
      total += item.bytes;
    }
    keys(data.bootstrap, ["bytes", "sha256"]);
    if (total > completeProfile.limits.totalArchiveBytes || !hex(data.bootstrap.sha256, 64)
      || !Number.isSafeInteger(data.bootstrap.bytes) || data.bootstrap.bytes < 4 || data.bootstrap.bytes > completeProfile.limits.zipEntryBytes) fail();
  } else if (stage === "copy") {
    keys(data, ["files"]);
    const expected = copyInputs(state, events);
    if (!Array.isArray(data.files) || data.files.length !== expected.length) fail();
    data.files.forEach((item, index) => {
      keys(item, ["name", "bytes", "sha256"]);
      if (item.name !== expected[index].name || item.sha256 !== expected[index].sha256 || !Number.isSafeInteger(item.bytes)
        || item.bytes < 1 || item.bytes > expected[index].cap || (expected[index].bytes !== undefined && item.bytes !== expected[index].bytes)) fail();
    });
  } else if (JSON.stringify(parseGuestReport(JSON.stringify(data), stage, state)) !== JSON.stringify(data)) fail();
}

function readFrom(parent, statePath) {
  const raw = existing(parent, "attempt.json");
  if (!raw) fail();
  const master = masterChecked(JSON.parse(raw.toString("utf8"))), masterSha256 = hash(raw);
  const allowed = new Set(["attempt.json", "policy.txt", "bun-bootstrap", "snapshots", "receipt.json",
    ...completeProfile.artifacts.map(artifactFileName), ...STAGES.flatMap((stage) => [eventName(stage, "intent"), eventName(stage, "complete")])]);
  if (readdirSync(`/proc/self/fd/${parent}`).some((filename) => !allowed.has(filename))) fail();
  const events = [];
  let gap = false, inFlightStage = null;
  for (const stage of STAGES) {
    const intent = existing(parent, eventName(stage, "intent")), complete = existing(parent, eventName(stage, "complete"));
    if ((complete && !intent) || (gap && (intent || complete))) fail();
    for (const [kind, bytes] of [["intent", intent], ["complete", complete]]) {
      if (!bytes) continue;
      const event = JSON.parse(bytes.toString("utf8"));
      keys(event, ["schema", "kind", "stage", "masterSha256", "data"]);
      if (event.schema !== "dev-sbx-complete-event-v1" || event.kind !== kind || event.stage !== stage || event.masterSha256 !== masterSha256) fail();
      if (kind === "intent") keys(event.data, []);
      else {
        stageData(stage, event.data, master, events);
        events.push({ stage, data: event.data, sha256: hash(bytes) });
      }
    }
    if (!intent || !complete) { gap = true; if (intent) inFlightStage = stage; }
  }
  const state = { ...master, statePath, masterSha256, events, status: inFlightStage ? "RECONCILE" : "READY",
    inFlightStage, completedStage: events.at(-1)?.stage ?? null, nextStage: inFlightStage ? null : STAGES[events.length] ?? null };
  const savedReceipt = existing(parent, "receipt.json", RECORD_CAP, 0o400);
  if (savedReceipt && JSON.stringify(JSON.parse(savedReceipt.toString("utf8"))) !== JSON.stringify(receipt(state))) fail();
  return state;
}

export function readCompleteState(statePath) {
  stateLocation(statePath);
  const parent = privateDirectory(dirname(statePath));
  try { anchor(parent, dirname(statePath)); return readFrom(parent, statePath); }
  finally { closeSync(parent); }
}

async function confirmTTY({ prompt }) {
  if (!process.stdin.isTTY || !process.stderr.isTTY) return false;
  return new Promise((accept) => {
    const terminal = createInterface({ input: process.stdin, output: process.stderr, terminal: true });
    let finished = false;
    const finish = (value) => {
      if (finished) return;
      finished = true;
      process.off("SIGINT", interrupted); process.off("SIGTERM", interrupted);
      terminal.close(); accept(value);
    };
    const interrupted = () => finish(false);
    process.on("SIGINT", interrupted); process.on("SIGTERM", interrupted);
    terminal.once("SIGINT", interrupted); terminal.once("close", interrupted);
    terminal.once("line", (line) => finish(line === "approve"));
    process.stderr.write(`${prompt}\nType approve to authorize this stage only: `);
  });
}

function terminalRequired(dependencies) {
  if (!dependencies.confirm && (!process.stdin.isTTY || !process.stderr.isTTY)) fail();
}

function acknowledgement(parent, state) {
  const bytes = existing(parent, "policy.txt");
  if (!bytes || hash(bytes) !== state.events[0].data.policySha256) fail();
  const preflight = existing(parent, eventName("preflight", "complete"));
  if (!preflight || hash(preflight) !== state.events[1].sha256) fail();
  return { policySha256: hash(bytes), preflightSha256: hash(preflight) };
}

const OPERATIONS = {
  policy: "One sbx policy ls --wide NAME; 10s/64KiB. Retain private policy.txt without printing provider output.",
  preflight: "One sbx exec; guest timeout --kill-after=1s 15s; host 25s/16KiB. Fixed metadata only: uname -s/-m, getconf GNU_LIBC_VERSION (glibc>=2.18 for known Mise startup only), base9 command -v, writable workspace, executable /usr/bin/tar and /usr/bin/xz, GNU tar --version marker, df -Pk /home/agent/workspace. Require reported free>=24GiB; not quota or full runtime compatibility proof.",
  "accept-policy": "Review retained policy.txt and preflight completion before typing approve. Rehash both before and after acknowledgement. Human promise only, not reusable F9 enforcement proof. No sbx call.",
  reserve: "One sbx exec; guest timeout --kill-after=1s 20s; host 30s/16KiB. Atomically mkdir /home/agent/workspace/.complete-dev-tools-v1 mode0700, bind name/root, create fresh root and inputs mode0700 and reservation records. Refuse existing marker/root. Never remove any marker or root. Guest exec may start a stopped VM.",
  "host-capacity": "One /usr/bin/df -Pk RUN_DIR; 10s/16KiB; require reported free>=10GiB, not physical quota proof.",
  acquire: "GET exactly the five declared HTTPS URLs; redirects manual<=3, only initial host/release-assets.githubusercontent.com/objects.githubusercontent.com, default HTTPS port only. Per-request/body<=120s; whole acquisition<=600s. Stream into exclusive0600 files; exact known sizes and SHA256, Rust size unknown but bounded. Seal0400. Inspect only Bun ZIP in host memory, retain original archives/notices, copy ELF bun to exclusive0400 bun-bootstrap without execution. No source build or host install.",
  copy: "Exactly nine sequential sbx cp calls, each host180s/64KiB; no exec. First create exclusive0400 stable-FD snapshots: five artifacts, bun-bootstrap, complete-profile.mjs, complete-archive.mjs, complete-guest.mjs. Extra host space<=4GiB+128MiB+768KiB, in addition to originals; retain partial files on failure.",
  inspect: "One sbx exec; guest timeout --kill-after=2s 1200s, host1210s/64KiB grace1s. Hash-check three guest sources and opened bootstrap FD3; chmod0500 bootstrap and execute the same descriptor with --no-env-file --no-install and inspect. Run full guest archive inspection; acquisition read only Bun ZIP for bootstrap. Software caps only, not F9 hard bounds.",
  install: "One sbx exec; guest timeout --kill-after=2s 1200s, host1210s/64KiB grace1s. Hash-check sources/bootstrap FD3 and run fixed helper install only. Never run vendor Rust install.sh, source builds or compiler workloads. Development-only installation.",
  verify: "One sbx exec; guest timeout --kill-after=2s 1200s, host1210s/64KiB grace1s. Hash-check sources/bootstrap FD3 and run helper verify. Genuine executable startup/version queries only, not compiler workloads. Mise uses scoped dirs and no auto-install; external configuration behavior is not confined. Approval requires accepting that behavior. Explanation NOT_RUN; no F9 or training authority.",
};

function prompt(stage, state) {
  const copies = stage === "copy" ? copyInputs(state, state.events).map((item) => `${join(dirname(state.statePath), "snapshots", item.name)} -> ${state.name}:${state.guestToolRoot}/inputs/${item.name}`).join("\n") : "";
  return `STAGE=${stage}\nCONTROLLER=${state.sbxPath}\nNAME=${state.name}\nHOST_ROOT=${dirname(state.statePath)}\nGUEST_ROOT=${state.guestToolRoot}\nPROFILE_SHA256=${state.profileSha256}\nMASTER_SHA256=${state.masterSha256}\nSOURCES=${JSON.stringify(state.sourceBindings)}\nPRIOR_BINDINGS=${JSON.stringify(state.events)}\nARTIFACTS=${JSON.stringify(completeProfile.artifacts)}\nSOFTWARE_LIMITS=${JSON.stringify(completeProfile.limits)}\nSOURCE_CAP=${SOURCE_CAP}\n${OPERATIONS[stage]}\n${copies}\nPolicy review: ${join(dirname(state.statePath), "policy.txt")}\nSame-UID private files are mutable; these bindings are not qualified G1 source proof. Gate0 remains OPEN; f9Qualified=false; trainingReady=false.`;
}

async function checked(execute, argv, bounds, quiet = false) {
  const result = await execute(argv, bounds);
  if (!result || result.ok !== true || result.code !== 0 || result.signal !== null || result.outcome !== "EXIT"
    || typeof result.stdout !== "string" || typeof result.stderr !== "string"
    || Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr) > bounds.cap
    || (result.bytes !== undefined && (!Number.isSafeInteger(result.bytes) || result.bytes < 0 || result.bytes > bounds.cap))
    || (quiet && result.stderr !== "")) fail();
  return result.stdout;
}

function urlAllowed(value, initialHost) {
  if (typeof value !== "string" || /[\x00-\x20\x7f-\x9f]/.test(value)) fail();
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.hash || (url.port && url.port !== "443")
    || ![initialHost, "release-assets.githubusercontent.com", "objects.githubusercontent.com"].includes(url.hostname)) fail();
  return url.href;
}

async function within(promise, milliseconds) {
  if (milliseconds <= 0) fail();
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("DEV_TOOLS_STOP")), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

export async function downloadArtifact(artifact, destination, dependencies = {}) {
  absolute(destination);
  const limits = dependencies.limits ?? completeProfile.limits;
  if (!plain(artifact) || !hex(artifact.sha256, 64) || (artifact.bytes !== null && (!Number.isSafeInteger(artifact.bytes) || artifact.bytes < 1))) fail();
  if (!["archiveBytes", "totalArchiveBytes"].every((key) => Number.isSafeInteger(limits[key]) && limits[key] > 0
    && limits[key] <= completeProfile.limits[key])) fail();
  const remainingBytes = dependencies.remainingBytes ?? limits.totalArchiveBytes;
  if (!Number.isSafeInteger(remainingBytes) || remainingBytes < 1 || remainingBytes > limits.totalArchiveBytes
    || (artifact.bytes !== null && artifact.bytes > completeProfile.limits.archiveBytes)) fail();
  const now = dependencies.now ?? Date.now;
  const deadline = Math.min(dependencies.deadline ?? Infinity, now() + 600000);
  if (!Number.isFinite(deadline)) fail();
  const initialHost = new URL(artifact.url).hostname;
  let url = urlAllowed(artifact.url, initialHost), fd, reader, signal;
  const parent = privateDirectory(dirname(destination));
  try {
    anchor(parent, dirname(destination));
    fd = openSync(`/proc/self/fd/${parent}/${basename(destination)}`,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW | constants.O_NONBLOCK, 0o600);
    fchmodSync(fd, 0o600); details(fd, 0, 0o600);
    let response, requestDeadline;
    for (let redirects = 0; ; redirects += 1) {
      requestDeadline = Math.min(deadline, now() + 120000);
      const remaining = requestDeadline - now();
      if (remaining <= 0) fail();
      signal = new AbortController();
      const timeoutSignal = AbortSignal.timeout(remaining);
      response = await within((dependencies.fetch ?? globalThis.fetch)(url, {
        method: "GET", redirect: "manual", signal: AbortSignal.any([signal.signal, timeoutSignal]),
      }), requestDeadline - now());
      if (response.redirected) fail();
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      if (redirects >= 3) fail();
      const location = response.headers.get("location");
      if (!location || /[\x00-\x20\x7f-\x9f]/.test(location)) fail();
      url = urlAllowed(new URL(location, url).href, initialHost);
      if (response.body) await within(response.body.cancel(), requestDeadline - now());
      signal.abort();
    }
    if (response.status !== 200 || !response.body || typeof response.body.getReader !== "function") fail();
    const cap = Math.min(limits.archiveBytes, remainingBytes);
    const length = response.headers.get("content-length");
    if (length !== null && (!/^[0-9]+$/.test(length) || !Number.isSafeInteger(Number(length)) || Number(length) > cap
      || (artifact.bytes !== null && Number(length) !== artifact.bytes))) fail();
    const digest = createHash("sha256");
    let bytes = 0;
    reader = response.body.getReader();
    while (true) {
      const chunk = await within(reader.read(), Math.min(deadline, requestDeadline) - now());
      if (chunk.done) break;
      if (!(chunk.value instanceof Uint8Array)) fail();
      bytes += chunk.value.byteLength;
      if (bytes > cap || (artifact.bytes !== null && bytes > artifact.bytes)) fail();
      digest.update(chunk.value); writeAll(fd, chunk.value);
    }
    const sha256 = digest.digest("hex");
    if (!bytes || (artifact.bytes !== null && bytes !== artifact.bytes) || sha256 !== artifact.sha256) fail();
    anchor(parent, dirname(destination));
    fchmodSync(fd, 0o400); fsyncSync(fd); fsyncSync(parent);
    if (details(fd, cap, 0o400).size !== BigInt(bytes)) fail();
    return { bytes, sha256 };
  } catch { throw new Error("DEV_TOOLS_STOP"); }
  finally {
    signal?.abort();
    if (reader) { try { reader.releaseLock(); } catch {} }
    if (fd !== undefined) closeSync(fd);
    closeSync(parent);
  }
}

const RESERVE = `set -eu
PATH=/usr/local/bin:/usr/bin:/bin
export PATH
umask 077
test "$#" -eq 4
marker=/home/agent/workspace/.complete-dev-tools-v1
test ! -e "$marker"
test ! -L "$marker"
mkdir -m 700 "$marker"
printf '%s\\n%s\\n%s\\n%s\\n' "$4" "$1" "$2" "$3" > "$marker/reservation"
test ! -e "$1"
test ! -L "$1"
mkdir -m 700 "$1"
mkdir -m 700 "$1/inputs"
printf 'complete-dev-v1\\n%s\\n%s\\n' "$2" "$3" > "$1/.reservation"
chmod 400 "$1/.reservation"
printf 'RESERVED\\n'
`;

const HASH_BOOTSTRAP = `set -eu
PATH=/usr/local/bin:/usr/bin:/bin
export PATH
test "$#" -eq 7
root=$1
for module in complete-profile.mjs complete-archive.mjs complete-guest.mjs; do
  test -f "$root/inputs/$module"
  test ! -L "$root/inputs/$module"
done
printf '%s  %s\\n' "$4" "$root/inputs/complete-profile.mjs" "$5" "$root/inputs/complete-archive.mjs" "$6" "$root/inputs/complete-guest.mjs" | sha256sum -c - >/dev/null
test -f "$root/inputs/bun-bootstrap"
test ! -L "$root/inputs/bun-bootstrap"
exec 3<"$root/inputs/bun-bootstrap"
test -f /proc/self/fd/3
printf '%s  /proc/self/fd/3\\n' "$3" | sha256sum -c - >/dev/null
chmod 500 /proc/self/fd/3
exec /proc/self/fd/3 --no-env-file --no-install "$root/inputs/complete-guest.mjs" "$7" --root "$root" --profile-sha "$2"
`;

function copyInputs(state, events) {
  const acquired = events.find((event) => event.stage === "acquire")?.data;
  if (!acquired) fail();
  return [
    ...completeProfile.artifacts.map((artifact, index) => ({ name: artifactFileName(artifact),
      sha256: artifact.sha256, bytes: acquired.artifacts[index].bytes, cap: completeProfile.limits.archiveBytes })),
    { name: "bun-bootstrap", ...acquired.bootstrap, cap: completeProfile.limits.zipEntryBytes },
    ...GUEST_SOURCES.map((filename) => ({ name: filename, sha256: state.sourceBindings[filename], cap: SOURCE_CAP })),
  ];
}

function snapshot(parent, directory, item, source) {
  const input = openSync(source, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  let output;
  try {
    anchor(parent, directory);
    const before = details(input, item.cap), digest = createHash("sha256"), buffer = Buffer.alloc(CHUNK);
    if (item.bytes !== undefined && before.size !== BigInt(item.bytes)) fail();
    output = openSync(`/proc/self/fd/${parent}/${item.name}`,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW | constants.O_NONBLOCK, 0o600);
    fchmodSync(output, 0o600); details(output, 0, 0o600);
    let bytes = 0;
    while (true) {
      const count = readSync(input, buffer, 0, Math.min(CHUNK, Number(before.size) - bytes + 1), null);
      if (!count) break;
      bytes += count;
      if (bytes > Number(before.size)) fail();
      digest.update(buffer.subarray(0, count)); writeAll(output, buffer.subarray(0, count));
    }
    if (bytes !== Number(before.size) || !same(before, details(input, item.cap)) || digest.digest("hex") !== item.sha256) fail();
    anchor(parent, directory);
    fchmodSync(output, 0o400); fsyncSync(output); fsyncSync(parent);
    if (details(output, item.cap, 0o400).size !== BigInt(bytes)) fail();
    return { name: item.name, bytes, sha256: item.sha256 };
  } finally { if (output !== undefined) closeSync(output); closeSync(input); }
}

async function copyChecked(execute, state, directory, item) {
  const path = join(directory, item.name), fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = details(fd, item.bytes, 0o400), digest = createHash("sha256"), buffer = Buffer.alloc(CHUNK);
    let bytes = 0;
    while (true) {
      const count = readSync(fd, buffer, 0, CHUNK, null);
      if (!count) break;
      bytes += count;
      if (bytes > item.bytes) fail();
      digest.update(buffer.subarray(0, count));
    }
    if (bytes !== item.bytes || digest.digest("hex") !== item.sha256 || !same(before, details(fd, item.bytes, 0o400))) fail();
    await checked(execute, [state.sbxPath, "cp", path, `${state.name}:${state.guestToolRoot}/inputs/${item.name}`],
      { milliseconds: 180000, cap: RECORD_CAP });
    if (!same(before, details(fd, item.bytes, 0o400)) || !same(before, lstatSync(path, { bigint: true }))) fail();
  } finally { closeSync(fd); }
}

async function effect(stage, state, parent, dependencies) {
  const execute = dependencies.execute ?? runBounded, directory = dirname(state.statePath);
  if (stage === "policy") {
    const stdout = await checked(execute, [state.sbxPath, "policy", "ls", "--wide", state.name], { milliseconds: 10000, cap: RECORD_CAP });
    if (!stdout.trim()) fail();
    exclusive(parent, "policy.txt", Buffer.from(stdout));
    return { policySha256: hash(stdout), bytes: Buffer.byteLength(stdout) };
  }
  if (stage === "preflight") return parsePreflight(await checked(execute, [state.sbxPath, "exec", state.name,
    "/usr/bin/timeout", "--kill-after=1s", "15s", "/bin/sh", "-c", PREFLIGHT, "sh"], { milliseconds: 25000, cap: 16384 }, true));
  if (stage === "accept-policy") return acknowledgement(parent, state);
  if (stage === "reserve") {
    const stdout = await checked(execute, [state.sbxPath, "exec", state.name, "/usr/bin/timeout", "--kill-after=1s", "20s",
      "/bin/sh", "-c", RESERVE, "sh", state.guestToolRoot, state.profileSha256, state.attemptId, state.name], { milliseconds: 30000, cap: 16384 }, true);
    if (stdout !== "RESERVED\n") fail();
    return { reserved: true };
  }
  if (stage === "host-capacity") return parseCapacity(await checked(execute, ["/usr/bin/df", "-Pk", directory], { milliseconds: 10000, cap: 16384 }, true), 10 * 1024 ** 2);
  if (stage === "acquire") {
    const artifacts = [], deadline = Date.now() + 600000;
    let total = 0;
    for (const artifact of completeProfile.artifacts) {
      anchor(parent, directory);
      const result = await downloadArtifact(artifact, join(directory, artifactFileName(artifact)), {
        fetch: dependencies.fetch, remainingBytes: completeProfile.limits.totalArchiveBytes - total, deadline,
      });
      total += result.bytes; artifacts.push({ id: artifact.id, ...result });
    }
    const bun = completeProfile.artifacts[0], zip = readSmall(join(directory, artifactFileName(bun)), bun.bytes, 0o400);
    if (Date.now() >= deadline || zip.length !== bun.bytes || hash(zip) !== bun.sha256) fail();
    const bytes = await bunBootstrap(zip);
    if (Date.now() >= deadline) fail();
    anchor(parent, directory); exclusive(parent, "bun-bootstrap", bytes, 0o400);
    return { artifacts, bootstrap: { bytes: bytes.length, sha256: hash(bytes) } };
  }
  if (stage === "copy") {
    mkdirSync(`/proc/self/fd/${parent}/snapshots`, { mode: 0o700 }); fsyncSync(parent);
    const snapshotDirectory = join(directory, "snapshots"), snapshots = privateDirectory(snapshotDirectory), files = [];
    try {
      for (const item of copyInputs(state, state.events)) {
        anchor(parent, directory);
        const source = GUEST_SOURCES.includes(item.name) ? join(dependencies.sourceDirectory ?? HERE, item.name) : join(directory, item.name);
        files.push(snapshot(snapshots, snapshotDirectory, item, source));
      }
      for (const item of files) {
        anchor(parent, directory); anchor(snapshots, snapshotDirectory);
        await copyChecked(execute, state, snapshotDirectory, item);
      }
      return { files };
    } finally { closeSync(snapshots); }
  }
  const bootstrap = state.events.find((event) => event.stage === "acquire").data.bootstrap;
  const stdout = await checked(execute, [state.sbxPath, "exec", state.name, "/usr/bin/timeout", "--kill-after=2s", "1200s",
    "/bin/sh", "-c", HASH_BOOTSTRAP, "sh", state.guestToolRoot, state.profileSha256, bootstrap.sha256,
    ...GUEST_SOURCES.map((filename) => state.sourceBindings[filename]), stage],
  { milliseconds: 1210000, cap: RECORD_CAP, graceMilliseconds: 1000 }, true);
  return parseGuestReport(stdout, stage, state);
}

export async function bunBootstrap(zip) {
  const bun = completeProfile.artifacts[0], limits = completeProfile.limits;
  const { inspectZipArchive } = await import("./complete-archive.mjs");
  const inspected = inspectZipArchive(zip, { root: bun.root, maxBytes: limits.zipEntryBytes,
    maxMembers: limits.members, maxMetadataBytes: limits.metadataBytes, maxEntryBytes: limits.zipEntryBytes });
  const matches = inspected.entries.filter((entry) => entry.path === `${bun.root}/bun`);
  if (matches.length !== 1 || matches[0].type !== "file" || !Buffer.isBuffer(matches[0].content)) fail();
  const bytes = matches[0].content;
  if (bytes.length < 4 || bytes.length > limits.zipEntryBytes || !bytes.subarray(0, 4).equals(Buffer.from([127, 69, 76, 70]))) fail();
  return bytes;
}

function eventRecord(state, stage, kind, data) {
  return { schema: "dev-sbx-complete-event-v1", kind, stage, masterSha256: state.masterSha256, data };
}

function receipt(state) {
  if (state.events.length !== STAGES.length || state.status !== "READY" || state.events.at(-1).data.data.allToolsAvailable !== true) fail();
  const context = guestToolContext(state.guestToolRoot);
  return { schema: "dev-sbx-complete-receipt-v1", developmentToolsPrepared: true, explanation: "NOT_RUN",
    guestToolRoot: context.root, path: context.path, statePath: state.statePath, target: state.name,
    ...AUTHORITY, result: "DEV_TOOLS_READY" };
}

export async function runCompleteStage(stage, options, dependencies = {}) {
  if (!STAGES.includes(stage)) fail();
  if (!plain(options) || (options.stage !== undefined && options.stage !== stage)) fail();
  options = optionsChecked({ ...options, stage });
  if (!options.state) fail();
  if (options.plan) return completeToolsPlan(options);
  terminalRequired(dependencies);
  const statePath = stateLocation(options.state), directory = dirname(statePath), parent = privateDirectory(directory);
  try {
    anchor(parent, directory);
    const state = readFrom(parent, statePath);
    if (state.status !== "READY" || state.nextStage !== stage) fail();
    if ((dependencies.resolveController ?? resolveController)(state.sbxPath) !== state.sbxPath
      || JSON.stringify(sourceBindings(dependencies)) !== JSON.stringify(state.sourceBindings)) fail();
    const acknowledgementBefore = stage === "accept-policy" ? acknowledgement(parent, state) : null;
    if (await (dependencies.confirm ?? confirmTTY)({ stage, state: structuredClone(state), prompt: prompt(stage, state) }) !== true) fail();
    anchor(parent, directory);
    if (JSON.stringify(readFrom(parent, statePath)) !== JSON.stringify(state)
      || JSON.stringify(sourceBindings(dependencies)) !== JSON.stringify(state.sourceBindings)
      || (dependencies.resolveController ?? resolveController)(state.sbxPath) !== state.sbxPath) fail();
    if (stage === "accept-policy" && JSON.stringify(acknowledgement(parent, state)) !== JSON.stringify(acknowledgementBefore)) fail();
    record(parent, eventName(stage, "intent"), eventRecord(state, stage, "intent", {}));
    const data = await effect(stage, state, parent, dependencies);
    anchor(parent, directory);
    if (JSON.stringify(sourceBindings(dependencies)) !== JSON.stringify(state.sourceBindings)) fail();
    const pending = readFrom(parent, statePath);
    if (pending.masterSha256 !== state.masterSha256 || pending.inFlightStage !== stage
      || JSON.stringify(pending.events) !== JSON.stringify(state.events)) fail();
    stageData(stage, data, state, state.events);
    record(parent, eventName(stage, "complete"), eventRecord(state, stage, "complete", data));
    const result = readFrom(parent, statePath);
    if (stage === "verify") {
      const ready = receipt(result);
      record(parent, "receipt.json", ready, 0o400);
      return ready;
    }
    return { schema: "dev-sbx-complete-stage-v1", stage, statePath, target: state.name, ...AUTHORITY, result: "DEV_STAGE_COMPLETE" };
  } catch { throw new Error("DEV_TOOLS_STOP"); }
  finally { closeSync(parent); }
}

export async function prepareCompleteTools(options, dependencies = {}) {
  optionsChecked(options);
  if (options.plan) return completeToolsPlan(options);
  if (options.state) return runCompleteStage(options.stage, options, dependencies);
  terminalRequired(dependencies);
  const sbxPath = absolute((dependencies.resolveController ?? resolveController)(options.sbx));
  const bindings = sourceBindings(dependencies);
  const directory = absolute((dependencies.createDirectory ?? (() => mkdtempSync("/tmp/opencode/dev-sbx-tools-")))());
  const statePath = stateLocation(join(directory, "attempt.json")), parent = privateDirectory(directory);
  try {
    if (readdirSync(`/proc/self/fd/${parent}`).length) fail();
    const attemptId = randomBytes(8).toString("hex");
    record(parent, "attempt.json", masterChecked({ schema: "dev-sbx-complete-workflow-v1", profileSha256: PROFILE_SHA,
      attemptId, name: options.name, sbxPath, guestToolRoot: `/home/agent/workspace/devtools-${attemptId}`,
      sourceBindings: bindings, ...AUTHORITY }));
  } finally { closeSync(parent); }
  (dependencies.announce ?? ((value) => process.stderr.write(`${value}\n`)))(`STATE_PATH=${statePath}`);
  let result;
  for (const stage of STAGES) result = await runCompleteStage(stage, { state: statePath, stage }, dependencies);
  return result;
}

export async function main(argv, dependencies = {}) {
  try {
    const options = parseCompleteTools(argv);
    const result = options.plan ? completeToolsPlan(options) : await prepareCompleteTools(options, dependencies);
    (dependencies.output ?? console.log)(JSON.stringify(result));
    return 0;
  } catch {
    (dependencies.error ?? console.error)("DEV_TOOLS_STOP; retain attempt files and guest reservation; reconcile in-flight stages; never retry an attempted stage or remove reservations; Gate0=OPEN; f9Qualified=false; trainingReady=false.");
    return 2;
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
