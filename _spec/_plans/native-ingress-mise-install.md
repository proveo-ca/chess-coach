# F9 M2 — one-time private mise/Rust installation proposal

**APPROVED ONCE / EXECUTED INSTALLED / PRECHECK + ENTRY + INSTALL/POSTCHECK GRANT CONSUMED. Controller SHA-256 `f2949057f3831affed40e7c6c08c9b3234a311593373caf5099906cb93571ac5`; 12117 UTF-8 bytes /223 LF-terminated lines. Entry SHA-256 `92b8d55e61b5ee7c78662efc5eb4347d83ed0b669c4239ffa673a006b4a553e0`; 1387 UTF-8 bytes /30 LF-terminated lines. HOST PREPARATION ONLY, NOT F9 CAPTURE/RUNTIME AUTHORITY.** Parent reports the exact2026-10-21 approval and execution in the [recorded outcome](#m2-recorded-execution--installed--grant-consumed). No rerun, root/log inspection or automatic next operation is authorized.

Earlier proposal/pending-approval/NOT RUN wording and choices below retain their historical pre-execution scope. The recorded outcome supersedes them for this one invocation only, without rewriting the controller or entry. Prior parse/static checks and presentation reviews preceded execution; they are not new runtime verdicts. This outcome edit changes no source, runtime, core, project configuration, accepted bf38 or F9 capture/resource/readiness contract.

## Direction, evidence and authority

- Executor said `continue, ignore the mise warning`. This directs continued planning using the printed `2026.9.1` as a provisional source hint. It does not retroactively pass [M1](native-ingress-host-preparation.md#m1-recorded-execution--stop--grant-consumed), renew its consumed grant, authorize another probe or generally suppress stderr. M1's exact fence, digest and raw STOP record remain unchanged.
- Parent supplies read-only upstream research: annotated tag `v2026.9.1` (tag-object prefix `cf9224…`) resolves to commit `8fe6385de7f73908ab5a6c9789f477a322eda3a5`. [Unverified] Installed mise bytes, backend behavior and correspondence to that source remain unbound. Ordinary trusted-host software behavior is an explicit proposed premise, not freshly proved identity or containment.
- That source supports `core:rust[profile="minimal",components=["rustfmt","clippy"]]@1.95.0` in `src/plugins/core/rust.rs`. It selects `MISE_CARGO_HOME`/`MISE_RUSTUP_HOME`; direct rustup also receives `CARGO_HOME`/`RUSTUP_HOME`. Existing rustup settings plus Cargo skip its otherwise mutable, unpinned `https://sh.rustup.rs` bootstrap. M2 preinitializes pinned rustup and checks those prerequisites before mise.
- `MISE_OFFLINE=1` returns requested `1.95.0` before remote exact resolution and suppresses mise registry refresh/version-host tracking. Use the environment setting, not an unsupported root `--offline` CLI flag. Rustup still needs HTTPS distribution acquisition. `CI=1` without inherited `RUSTUP_CI` disables rustup self-update. `--no-modify-path` still permits private Cargo env scripts, not shell-rc edits.
- A new writable `MISE_DATA_DIR` addresses the upstream migration-marker design; it does not prove installed behavior. `MISE_SYSTEM_DEPS=ignore` requests no system package preparation. A new bootstrap/dependency requirement means STOP, never an automatic fallback.
- The earlier `Host exception (Recommended)` selects planning only. Fresh exact M2 approval must explicitly permit the one-time N4 host-preparation network/install exception, metadata/platform/capacity preflight, private writes/new root, post-install version/component checks and ordinary host-software trust, including residual lack of OS containment and quota proof.
- Host-tool preparation is **not** the native window. No new exemption or capture permit is claimed. Accepted N1–N10/bf38, SAME BOTH-seat **1048576**, cold **10s**, lifecycle **300s** and all later capture/runtime/resource gates remain unchanged. M2 evidence is not RecipeRef, independent F9 installed-byte allowlisting, native authority, readiness, build or training permission.

## Immutable acquisition expectations — parent-supplied metadata

| Body | Exact HTTPS URL | Exact bytes | SHA-256 |
|---|---|---:|---|
| rustup-init 1.29.2 / GNU x86_64 | `https://static.rust-lang.org/rustup/archive/1.29.2/x86_64-unknown-linux-gnu/rustup-init` | 21139856 | `5be191e8c70a5007074254cb74d78dbfdd25cd5a61c27de7b8e5410122ec24f4` |
| Rust 1.95.0 manifest | `https://static.rust-lang.org/dist/channel-rust-1.95.0.toml` | 848342 | `821ff14e4c4a1cbe1e8915f35aff0a3fbbdf8d293ad48ab8f31e3b0440c581f9` |

Parent reports fetching only metadata over read-only HTTPS, not binary downloads. Manifest date is `2026-04-16`; available GNU host components include cargo, rustc, rust-std, rustfmt-preview and clippy-preview. Controller verification of this manifest establishes provenance only. Rustup independently refetches the manifest and checks upstream component hashes. M2 does **not** enforce an independent allowlist over every downloaded artifact or atomic checked-byte loading. TLS plus official published hashes is ordinary Rust distribution trust, not independent publisher authentication. Strict independent pinning of every payload requires another mechanism and another reviewed design.

## Enforced limits versus residual trust

- Fixed fresh root: `/tmp/opencode/f9-host-rust-1.95.0-m2`. Never reuse, resume, clean up or delete an existing root, on either success or failure. Retain logs and partial tools; another attempt requires a new proposal and approval.
- Before root writes/acquisition: Linux/x64, nonzero euid, canonical `/tmp/opencode`, directory owned by that euid without group/other write, absent root, numeric runtime glibc, executable regular mise candidate, `statfs` available space **≥8 GiB** and free inodes **≥100000**. Only the selected glibc string may leave the diagnostic report. No home/root walk or other installed-file inspection is proposed.
- Capacity and GNU metadata are point indicators, not effective-quota measurement, executable-mount proof or compatibility guarantees. The root is the intended private write scope, **not** an OS filesystem barrier. Native tools may create downloads, extracted toolchains, caches, scripts, tracking symlinks/shims and temporary files under redirected roots; flags cannot prove they never touch elsewhere.
- Controller acquisition: exactly two allowlisted HTTPS URLs, redirects rejected, no copied headers/credentials/proxy environment, **60s or remaining absolute time per request**, streamed counts before retaining bytes, **32 MiB bootstrap /2 MiB manifest** caps, exact length and SHA before any downloaded execution. Acquisition payload buffers are bounded by those caps; this is not total RSS proof. Copied rustup verification separately reads at most32 MiB.
- Absolute controller deadline **720000ms**; future outer-tool timeout **750000ms**. Direct-child `SIGKILL` timeouts: bootstrap **90000ms**, mise **600000ms**, each check **10000ms**, each reduced to remaining time. No retries or later child after any failure. These are requested deadlines, not absolute kernel/process-tree termination, descendant cleanup, RSS or CPU guarantees.
- Eight children maximum: two installers plus six checks. `spawnSync` requests `maxBuffer=1048576`; retained private logs clamp each stream to1 MiB and STOP on observed overflow. At most16 MiB retained child-log contents across eight steps. Node may transiently collect a chunk beyond its buffer threshold; no transient-memory guarantee follows. Record≤24000 ASCII bytes; only first4096 stderr bytes appear as base64, never raw stderr or an evaluated error object.
- Exit-zero warnings are retained, not printed raw, and are nonfatal only if every subsequent required check passes. This is a prospective M2 rule, **not** M1's stricter predicate. Missing/invalid record, nonzero controller exit or outer timeout means STOP, not proven cleanup or safe resumption.
- Intended outbound origin is `static.rust-lang.org`. `MISE_OFFLINE` is a request to an unbound installed program, not OS network denial or a per-origin firewall. Rustup/native child download bytes, extraction size, total disk/cache growth and peak coexistence are **not mechanically capped** by this controller. There is no hard transfer/disk quota or OS sandbox. If strict all-byte quotas or containment are required, this packet is not ready; choose another design.
- Existing trusted parent Node/Bash, stable owned paths and absence of malicious preload/harness mutation remain ordinary host premises. Child environment is literal, not inherited. No Node replacement, readelf, Zig, global tsc, mise upgrade, project dependencies, Cargo build/test, shell activation, persistent PATH change, global/project configuration, deployment or automatic next operation is included.

## Exact proposed JavaScript controller — inert document fence

Parent measured the controller identity from the exact UTF-8 fence body, without trimming/newline normalization. The fixed entry below reads **this repository document**, requires exactly one matching BEGIN/END fence, verifies the registered controller SHA and imports a data URL constructed from **the same checked JavaScript bytes**. It does not verify one read and execute another or create a private prepared copy. Entry failure emits bounded fixed STOP without stack/secret/error-object output. Source-control checking of this document is not immutable loading or native admission evidence. Nothing here authorizes running the entry.

<!-- BEGIN F9 MISE INSTALL CONTROLLER -->
```js
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const ROOT = '/tmp/opencode/f9-host-rust-1.95.0-m2';
const BASE = '/tmp/opencode', TARGET = 'x86_64-unknown-linux-gnu';
const MISE = '/usr/local/bin/mise', VERSION = '1.95.0';
const MiB = 1048576, DEADLINE = Date.now() + 720000;
const BOOT = Object.freeze({
  url: 'https://static.rust-lang.org/rustup/archive/1.29.2/x86_64-unknown-linux-gnu/rustup-init',
  bytes: 21139856, cap: 32 * MiB,
  sha: '5be191e8c70a5007074254cb74d78dbfdd25cd5a61c27de7b8e5410122ec24f4'
});
const MANIFEST = Object.freeze({
  url: 'https://static.rust-lang.org/dist/channel-rust-1.95.0.toml',
  bytes: 848342, cap: 2 * MiB,
  sha: '821ff14e4c4a1cbe1e8915f35aff0a3fbbdf8d293ad48ab8f31e3b0440c581f9'
});
const ENV = Object.freeze({
  PATH: '/usr/bin:/bin', HOME: ROOT + '/home', TMPDIR: ROOT + '/tmp',
  XDG_CONFIG_HOME: ROOT + '/config', XDG_DATA_HOME: ROOT + '/data',
  XDG_CACHE_HOME: ROOT + '/cache', XDG_STATE_HOME: ROOT + '/state',
  MISE_CONFIG_DIR: ROOT + '/config', MISE_GLOBAL_CONFIG_FILE: ROOT + '/config/config.toml',
  MISE_SYSTEM_CONFIG_DIR: ROOT + '/system-config', MISE_SYSTEM_DATA_DIR: ROOT + '/system-data',
  MISE_DATA_DIR: ROOT + '/data', MISE_CACHE_DIR: ROOT + '/cache',
  MISE_STATE_DIR: ROOT + '/state', MISE_TMP_DIR: ROOT + '/tmp/mise',
  MISE_CEILING_PATHS: ROOT, MISE_CARGO_HOME: ROOT + '/cargo', CARGO_HOME: ROOT + '/cargo',
  MISE_RUSTUP_HOME: ROOT + '/rustup', RUSTUP_HOME: ROOT + '/rustup',
  MISE_RUST_DEFAULT_HOST: TARGET, RUSTUP_TOOLCHAIN: VERSION + '-' + TARGET,
  RUSTUP_AUTO_INSTALL: '0', RUSTUP_DIST_SERVER: 'https://static.rust-lang.org',
  RUSTUP_UPDATE_ROOT: 'https://static.rust-lang.org/rustup', CI: '1',
  LANG: 'C.UTF-8', LC_ALL: 'C', NO_COLOR: '1',
  MISE_OFFLINE: '1', MISE_NO_CONFIG: '1', MISE_NO_ENV: '1', MISE_NO_HOOKS: '1',
  MISE_AUTO_INSTALL: '0', MISE_EXEC_AUTO_INSTALL: '0', MISE_AUTO_UPDATE: '0',
  MISE_SELF_UPDATE_AUTO: '0', MISE_REGISTRY_FLOATING: '0', MISE_USE_VERSIONS_HOST: '0',
  MISE_USE_VERSIONS_HOST_TRACK: '0', MISE_LOCKFILE: '0', MISE_SYSTEM_DEPS: 'ignore',
  MISE_DISABLE_UPDATE_WARNING: '1', MISE_DISABLE_HINTS: '*', MISE_CACHE_PRUNE_AGE: '0s'
});
let stage = 'preflight', reason = 'UNEXPECTED_CONTROLLER_ERROR', status = 'STOP';
let lastStderr = Buffer.alloc(0);
const steps = [], versions = {};
process.stdout.on('error', () => { process.exitCode = 3; });
function stop(code) { reason = code; throw new Error('STOP'); }
function requireThat(ok, code) { if (!ok) stop(code); }
function remaining() {
  const ms = DEADLINE - Date.now();
  requireThat(ms > 0, 'CONTROLLER_DEADLINE');
  return ms;
}
function executable(path) {
  requireThat(fs.statSync(path).isFile(), 'EXECUTABLE_NOT_REGULAR');
  fs.accessSync(path, fs.constants.X_OK);
}
function preflight() {
  requireThat(process.platform === 'linux' && process.arch === 'x64', 'PLATFORM');
  requireThat(typeof process.geteuid === 'function', 'EUID_UNAVAILABLE');
  const uid = process.geteuid();
  requireThat(uid !== 0, 'ROOT_USER');
  requireThat(fs.realpathSync(BASE) === BASE, 'BASE_NOT_CANONICAL');
  const base = fs.lstatSync(BASE);
  requireThat(base.isDirectory() && base.uid === uid && (base.mode & 0o022) === 0, 'BASE_METADATA');
  let absent = false;
  try { fs.lstatSync(ROOT); } catch (error) {
    if (error && error.code === 'ENOENT') absent = true; else throw error;
  }
  requireThat(absent, 'ROOT_ALREADY_EXISTS');
  const space = fs.statfsSync(BASE, { bigint: true });
  requireThat(space.bavail * space.bsize >= 8n * 1024n ** 3n && space.ffree >= 100000n, 'CAPACITY');
  requireThat(process.report && 'excludeEnv' in process.report, 'REPORT_ENV_EXCLUSION_UNAVAILABLE');
  process.report.excludeEnv = true;
  requireThat(process.report.excludeEnv === true, 'REPORT_ENV_EXCLUSION_UNAVAILABLE');
  const glibc = process.report.getReport().header.glibcVersionRuntime;
  requireThat(typeof glibc === 'string' && glibc.length <= 32 && /^\d+\.\d+(?:\.\d+)?$/.test(glibc), 'GNU_RUNTIME');
  versions.glibc = glibc;
  executable(MISE);
  remaining();
}
async function acquire(spec) {
  requireThat((spec.url === BOOT.url || spec.url === MANIFEST.url) && spec.url.startsWith('https://'), 'ACQUISITION_URL');
  const expires = Math.min(DEADLINE, Date.now() + 60000);
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), Math.min(60000, remaining()));
  try {
    const response = await fetch(spec.url, { redirect: 'error', credentials: 'omit', signal: abort.signal });
    requireThat(response.status === 200 && response.url === spec.url && response.body, 'ACQUISITION_RESPONSE');
    requireThat(spec.bytes <= spec.cap, 'ACQUISITION_LIMIT');
    const bytes = Buffer.alloc(spec.bytes), reader = response.body.getReader();
    let count = 0;
    while (true) {
      requireThat(Date.now() < expires, 'ACQUISITION_DEADLINE');
      const chunk = await reader.read();
      requireThat(Date.now() < expires, 'ACQUISITION_DEADLINE');
      if (chunk.done) break;
      const next = count + chunk.value.byteLength;
      requireThat(next <= spec.cap && next <= spec.bytes, 'ACQUISITION_BYTES');
      bytes.set(chunk.value, count);
      count = next;
    }
    requireThat(count === spec.bytes, 'ACQUISITION_LENGTH');
    requireThat(createHash('sha256').update(bytes).digest('hex') === spec.sha, 'ACQUISITION_SHA256');
    remaining();
    return bytes;
  } finally { clearTimeout(timer); abort.abort(); }
}
function mkdir(path) {
  fs.mkdirSync(path, { mode: 0o700 });
  const info = fs.lstatSync(path);
  requireThat(info.isDirectory() && info.uid === process.geteuid() && (info.mode & 0o777) === 0o700, 'NEW_DIRECTORY_METADATA');
}
function writePrivate(path, bytes, mode = 0o600) {
  fs.writeFileSync(path, bytes, { flag: 'wx', mode });
}
function copiedRustupHash() {
  const fd = fs.openSync(ROOT + '/cargo/bin/rustup', fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const info = fs.fstatSync(fd);
    requireThat(info.isFile() && info.size > 0 && info.size <= 32 * MiB, 'RUSTUP_COPY_SIZE');
    const bytes = Buffer.alloc(info.size);
    let offset = 0;
    while (offset < bytes.length) {
      remaining();
      const count = fs.readSync(fd, bytes, offset, bytes.length - offset, null);
      requireThat(count > 0, 'RUSTUP_COPY_SHORT');
      offset += count;
    }
    requireThat(fs.readSync(fd, Buffer.alloc(1), 0, 1, null) === 0, 'RUSTUP_COPY_LONG');
    requireThat(createHash('sha256').update(bytes).digest('hex') === BOOT.sha, 'RUSTUP_COPY_SHA256');
  } finally { fs.closeSync(fd); }
}
function runStep(label, exe, args, limit, withCargo = true) {
  stage = label;
  requireThat(steps.length < 8, 'STEP_LIMIT');
  const timeout = Math.min(limit, remaining());
  const result = spawnSync(exe, args, {
    cwd: ROOT, shell: false,
    env: { ...ENV, PATH: withCargo ? ROOT + '/cargo/bin:/usr/bin:/bin' : ENV.PATH },
    stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: MiB, timeout, killSignal: 'SIGKILL'
  });
  const validBuffers = Buffer.isBuffer(result.stdout) && Buffer.isBuffer(result.stderr);
  const stdout = Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.alloc(0);
  const stderr = Buffer.isBuffer(result.stderr) ? result.stderr : Buffer.alloc(0);
  lastStderr = stderr.subarray(0, 4096);
  const overflow = stdout.length > MiB || stderr.length > MiB;
  const safeSignal = result.signal === null || (typeof result.signal === 'string' && /^[A-Z0-9]{1,32}$/.test(result.signal));
  steps.push({ step: label, status: Number.isInteger(result.status) ? result.status : null,
    signal: safeSignal ? result.signal : null, hadError: Boolean(result.error) || !validBuffers || !safeSignal,
    timedOut: Boolean(result.error && result.error.code === 'ETIMEDOUT'),
    stdoutBytes: stdout.length, stderrBytes: stderr.length, overflow, timeoutMs: timeout });
  writePrivate(ROOT + '/logs/' + label + '-stdout.log', stdout.subarray(0, MiB));
  writePrivate(ROOT + '/logs/' + label + '-stderr.log', stderr.subarray(0, MiB));
  requireThat(!overflow, 'CHILD_OUTPUT_OVERFLOW');
  requireThat(validBuffers && safeSignal && !result.error && result.status === 0 && result.signal === null, 'CHILD_STOP');
  remaining();
  return stdout;
}
function lines(bytes) {
  requireThat(bytes.length > 0 && bytes.length <= 4096, 'CHECK_OUTPUT_SIZE');
  requireThat(bytes.every(byte => byte === 10 || byte === 13 || (byte >= 32 && byte <= 126)), 'CHECK_OUTPUT_ASCII');
  let text = bytes.toString('ascii').replace(/\r\n/g, '\n');
  requireThat(!text.includes('\r'), 'CHECK_OUTPUT_CR');
  if (text.endsWith('\n')) text = text.slice(0, -1);
  const values = text.split('\n');
  requireThat(values.every(value => value.length > 0), 'CHECK_EMPTY_LINE');
  return values;
}
function oneLine(bytes, pattern) {
  const values = lines(bytes);
  requireThat(values.length === 1 && values[0].length <= 160 && pattern.test(values[0]), 'VERSION_CHECK');
  return values[0];
}
async function main() {
  preflight();
  stage = 'acquire-bootstrap';
  const bootstrap = await acquire(BOOT);
  stage = 'acquire-manifest';
  const manifest = await acquire(MANIFEST);
  stage = 'create-root';
  remaining();
  mkdir(ROOT);
  for (const name of ['home', 'tmp', 'config', 'data', 'cache', 'state', 'system-config', 'system-data', 'logs', 'bootstrap']) mkdir(ROOT + '/' + name);
  mkdir(ROOT + '/tmp/mise');
  writePrivate(ROOT + '/bootstrap/rustup-init', bootstrap, 0o700);
  writePrivate(ROOT + '/bootstrap/channel-rust-1.95.0.toml', manifest);
  runStep('bootstrap', ROOT + '/bootstrap/rustup-init',
    ['-y', '--no-modify-path', '--default-host', TARGET, '--default-toolchain', 'none', '--profile', 'minimal'], 90000, false);
  stage = 'bootstrap-check';
  requireThat(fs.lstatSync(ROOT + '/rustup/settings.toml').isFile(), 'RUSTUP_SETTINGS');
  for (const name of ['rustup', 'cargo', 'rustc']) executable(ROOT + '/cargo/bin/' + name);
  copiedRustupHash();
  runStep('mise', MISE, ['install', '--jobs=1', 'core:rust[profile="minimal",components=["rustfmt","clippy"]]@1.95.0'], 600000);
  const rustc = lines(runStep('rustc', ROOT + '/cargo/bin/rustc', ['-Vv'], 10000));
  requireThat(rustc.filter(line => line.startsWith('release:')).length === 1 && rustc.includes('release: 1.95.0') &&
    rustc.filter(line => line.startsWith('host:')).length === 1 && rustc.includes('host: ' + TARGET), 'RUSTC_RELEASE_HOST');
  versions.rustc = VERSION;
  versions.cargo = oneLine(runStep('cargo', ROOT + '/cargo/bin/cargo', ['--version'], 10000), /^cargo 1\.95\.0\b[\x20-\x7e]*$/);
  versions.rustfmt = oneLine(runStep('rustfmt', ROOT + '/cargo/bin/rustfmt', ['--version'], 10000), /^rustfmt [\x20-\x7e]+$/);
  versions.clippy = oneLine(runStep('clippy', ROOT + '/cargo/bin/clippy-driver', ['--version'], 10000), /^clippy(?:-driver)? [\x20-\x7e]+$/);
  const components = lines(runStep('components', ROOT + '/cargo/bin/rustup',
    ['component', 'list', '--installed', '--toolchain', '1.95.0'], 10000)).sort();
  const expected = ['cargo', 'rustc', 'rust-std', 'rustfmt', 'clippy'].map(name => name + '-' + TARGET).sort();
  requireThat(components.length === expected.length && components.every((value, i) => value === expected[i]), 'COMPONENT_SET');
  const targets = lines(runStep('targets', ROOT + '/cargo/bin/rustup',
    ['target', 'list', '--installed', '--toolchain', '1.95.0'], 10000));
  requireThat(targets.length === 1 && targets[0] === TARGET, 'TARGET_SET');
  remaining();
  stage = 'complete';
}
try {
  await main();
  status = 'INSTALLED';
  reason = 'ALL_CHECKS_PASSED';
} catch {}
try {
  const record = { protocol: 'F9_MISE_INSTALL_V1', status, root: ROOT, stage, reason,
    phase: 'HOST_PREPARATION_ONLY', versions, steps, lastStderrBase64: lastStderr.toString('base64') };
  const line = JSON.stringify(record) + '\n';
  if (Buffer.byteLength(line, 'ascii') > 24000 || /[^\x00-\x7f]/.test(line)) throw new Error('STOP');
  process.exitCode = status === 'INSTALLED' ? 0 : 3;
  process.stdout.write(line);
} catch {
  process.exitCode = 3;
  process.stdout.write('{"protocol":"F9_MISE_INSTALL_V1","status":"STOP","reason":"CONTROLLER_RECORD"}\n');
}
```
<!-- END F9 MISE INSTALL CONTROLLER -->

`INSTALLED` requires all eight child steps and every intervening predicate, a valid bounded record, zero controller exit and no outer timeout. Rustfmt/clippy report their own component versions; M2 does not require those strings to equal Rust's `1.95.0`. No Cargo build/test/dependency fetch, capture, invoice, native proof or readiness check follows. A STOP leaves the fresh root, logs and partial installation intact without automatic rerun, resume, cleanup or next probe.

## Exact proposed entry — same checked bytes, no private snapshot

The future approval covers this entry and the registered controller together, with outer-tool timeout750000ms. Entry document input is bounded to65536 bytes plus one overflow-detection byte. A nonregular file, invalid UTF-8, duplicate markers, excess bytes or controller identity mismatch stops before importing it. The entry executes code only from the registered controller fence; returned tool output must still satisfy the record/exit/timeout rules above.

<!-- BEGIN F9 MISE INSTALL ENTRY -->
```bash
(
  node --input-type=module <<'NODE'
import fs from 'node:fs';
import { createHash } from 'node:crypto';
try {
  const fd = fs.openSync('_spec/_plans/native-ingress-mise-install.md', fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  let used = 0;
  const input = Buffer.alloc(65537);
  try {
    if (!fs.fstatSync(fd).isFile()) throw new Error('STOP');
    while (used < input.length) {
      const count = fs.readSync(fd, input, used, input.length - used, null);
      if (count === 0) break;
      used += count;
    }
  } finally { fs.closeSync(fd); }
  if (used > 65536) throw new Error('STOP');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(input.subarray(0, used));
  const a = '<!-- BEGIN F9 MISE INSTALL CONTROLLER -->\n```js\n';
  const b = '```\n<!-- END F9 MISE INSTALL CONTROLLER -->';
  if (text.split(a).length !== 2 || text.split(b).length !== 2) throw new Error('STOP');
  const code = Buffer.from(text.slice(text.indexOf(a) + a.length, text.indexOf(b)));
  if (code.length !== 12117 || createHash('sha256').update(code).digest('hex') !== 'f2949057f3831affed40e7c6c08c9b3234a311593373caf5099906cb93571ac5') throw new Error('STOP');
  await import('data:text/javascript;base64,' + code.toString('base64'));
} catch {
  process.exitCode = 3;
  process.stdout.write('{"protocol":"F9_MISE_INSTALL_V1","status":"STOP","reason":"ENTRY"}\n');
}
NODE
) 2>&-
```
<!-- END F9 MISE INSTALL ENTRY -->

## Sources and review-to-approval handoff

Parent-supplied upstream evidence, not an installed-byte binding:
- [Tagged Rust backend, exact resolved commit](https://github.com/jdx/mise/blob/8fe6385de7f73908ab5a6c9789f477a322eda3a5/src/plugins/core/rust.rs).
- [Offline environment support](https://github.com/jdx/mise/blob/8fe6385de7f73908ab5a6c9789f477a322eda3a5/src/env.rs#L1007) and [offline requested-version resolution](https://github.com/jdx/mise/blob/8fe6385de7f73908ab5a6c9789f477a322eda3a5/src/toolset/tool_version.rs#L602).
- [Official rustup-init SHA-256 metadata](https://static.rust-lang.org/rustup/archive/1.29.2/x86_64-unknown-linux-gnu/rustup-init.sha256).
- [Official Rust manifest SHA-256 metadata](https://static.rust-lang.org/dist/channel-rust-1.95.0.toml.sha256).
- [Node spawnSync](https://nodejs.org/api/child_process.html#child_processspawnsynccommand-args-options) and [buffer-limit caveat](https://nodejs.org/api/child_process.html#maxbuffer-and-unicode).

Parent measured both registered identities and passed controller/entry Node and entry Bash parse-only checks. These checks executed neither program and created no installation root or private controller artifact. Complete static/preservation checks and final reviews must resolve findings **before asking operational approval**. No runtime installation, host preflight, installed-file/PATH inspection or native/readiness PASS is claimed.

Parent static checks passed three-document scope,22 local links/anchors, whitespace, complete original PLAN suffix preservation, accepted bf38 and M1 command/raw-result preservation. These are document checks, not installer execution. Read-only reviews returned:

| Reviewer | Scope / verdict |
|---|---|
| DevOps `ses_ea0be7230ffeIHPw6XiYocRtlQ` |Full controller/entry operational-design review; no blocking operational findings; READY TO PRESENT yes. Runtime preconditions remain unverified. |
| Adversarial `ses_ea0a811beffewRd0ttWsG7sZKs` |No findings in three-document scope; READY TO PRESENT exact host-exception risk decision yes / DOCS READY yes. Parent checks were not independently rerun. |
| Security `ses_ea0a810f6ffeX1V4Ly479u3npa` |No concrete security findings; READY TO PRESENT exact explicit-risk decision yes / DOCS READY yes. Residual risk medium; no execution permission. |

After review, present at least these three choices **without asking a renewed planning-direction question now**:
1. **Approve exact one-time installation exception:** approve only the reviewed controller+entry identities, new root, preflight, intended HTTPS/install/private writes, eight checks, bounds and explicit ordinary-host residual trust/no-containment/no-quota premises. This is the scoped N4 host-preparation exception, not F9 capture/runtime authority.
2. **Revise / require containment:** do not run M2; design enforceable isolation, all-byte quotas and/or independent payload pinning and review a new packet.
3. **No installation:** keep M2 unrun and preserve M1 STOP/consumed grants and all open F9 gates.

## M2 recorded execution — INSTALLED / grant consumed

**2026-10-21 · parent-reported outcome, not keeper verification.** No UTC timestamp or execution duration is supplied.

Parent reports that Executor selected exact M2 installation approval in the full-scope question naming the controller SHA-256 `f2949057f3831affed40e7c6c08c9b3234a311593373caf5099906cb93571ac5` (12117 UTF-8 bytes/223 LF-terminated lines) and entry SHA-256 `92b8d55e61b5ee7c78662efc5eb4347d83ed0b669c4239ffa673a006b4a553e0` (1387 UTF-8 bytes/30 LF-terminated lines). Approval covered the one-time N4 host-preparation network/install exception, metadata/platform/capacity preflight, fresh private root and writes, eight direct children including six postchecks, root retention and no automatic retries. It explicitly accepted ordinary host-software trust and residual lack of an OS sandbox, all-byte quotas, per-origin firewall and absolute kernel/process-tree guarantees.

Parent reports immediate fence-identity verification printed `F9_MISE_INSTALL_CONTROL_BYTES_OK`, followed by exactly one invocation of the frozen30-line entry with outer-tool timeout750000ms. The tool completed with controller exit0; no timeout or truncation was reported. The full actual returned record was:

```json
{"protocol":"F9_MISE_INSTALL_V1","status":"INSTALLED","root":"/tmp/opencode/f9-host-rust-1.95.0-m2","stage":"complete","reason":"ALL_CHECKS_PASSED","phase":"HOST_PREPARATION_ONLY","versions":{"glibc":"2.43","rustc":"1.95.0","cargo":"cargo 1.95.0 (f2d3ce0bd 2026-03-21)","rustfmt":"rustfmt 1.9.0-stable (59807616e1 2026-04-14)","clippy":"clippy 0.1.95 (59807616e1 2026-04-14)"},"steps":[{"step":"bootstrap","status":0,"signal":null,"hadError":false,"timedOut":false,"stdoutBytes":1320,"stderrBytes":436,"overflow":false,"timeoutMs":90000},{"step":"mise","status":0,"signal":null,"hadError":false,"timedOut":false,"stdoutBytes":0,"stderrBytes":636,"overflow":false,"timeoutMs":600000},{"step":"rustc","status":0,"signal":null,"hadError":false,"timedOut":false,"stdoutBytes":196,"stderrBytes":0,"overflow":false,"timeoutMs":10000},{"step":"cargo","status":0,"signal":null,"hadError":false,"timedOut":false,"stdoutBytes":36,"stderrBytes":0,"overflow":false,"timeoutMs":10000},{"step":"rustfmt","status":0,"signal":null,"hadError":false,"timedOut":false,"stdoutBytes":45,"stderrBytes":0,"overflow":false,"timeoutMs":10000},{"step":"clippy","status":0,"signal":null,"hadError":false,"timedOut":false,"stdoutBytes":38,"stderrBytes":0,"overflow":false,"timeoutMs":10000},{"step":"components","status":0,"signal":null,"hadError":false,"timedOut":false,"stdoutBytes":161,"stderrBytes":0,"overflow":false,"timeoutMs":10000},{"step":"targets","status":0,"signal":null,"hadError":false,"timedOut":false,"stdoutBytes":25,"stderrBytes":0,"overflow":false,"timeoutMs":10000}],"lastStderrBase64":""}
```

### Bounded result and interpretation

- Parent reports exactly eight direct children: bootstrap and mise installers, then rustc, cargo, rustfmt, clippy, components and targets checks. Every status is0, every signal isnull, and every `hadError`, `timedOut` and `overflow` isfalse. No additional probe followed.
- Parent reports all intervening predicates passed: pre-write/acquisition platform/euid/canonical-parent/fresh-root/capacity/GNU/mise-candidate preflight, exact pinned acquisition lengths/hashes, fresh private directory creation, rustup settings/proxy prerequisites, copied-rustup hash, Rust release/host, component versions, exact five-component host set and sole host target. These describe that run, not a continuing executable identity, effective quota or current closure.
- Acquisition metadata remains the pinned bootstrap21139856 bytes and manifest848342 bytes recorded above. Checking the manifest was controller provenance only; Rustup's independent manifest/component acquisition still used ordinary upstream distribution trust, not controller-enforced independent pinning of all child payloads or atomic checked-byte loading.

| Selected value | Parent-reported exact string |
|---|---|
| Runtime glibc | `2.43` |
| Rust release | `1.95.0` |
| Cargo | `cargo 1.95.0 (f2d3ce0bd 2026-03-21)` |
| Rustfmt | `rustfmt 1.9.0-stable (59807616e1 2026-04-14)` |
| Clippy | `clippy 0.1.95 (59807616e1 2026-04-14)` |

Bootstrap stderr436 bytes and mise stderr636 bytes are **counts only**, not an assertion about their contents. No retained log was reread or classified as progress/warnings in this outcome edit. Empty `lastStderrBase64` belongs to the final target step; it does **not** mean that all child stderr was empty. M2's prospective exit-zero-with-valid-subsequent-checks rule accepted this completed sequence; M1's different strict predicate still records failed STOP and remains unchanged.

### Consumed authority, retained root and remaining gates

The one-time N4 host-preparation exception and precheck/entry/install/postcheck grant are **COMPLETED / CONSUMED**. Parent reports the private root `/tmp/opencode/f9-host-rust-1.95.0-m2` contains the private rustup/Cargo homes and `cargo/bin`. Retain that root and its logs. This is retention only, not permission to reread, stat, hash, inspect logs, retry, resume, clean up or delete it. No old receipt/control access or further operation follows from the completed grant.

Parent reports no global configuration, shell-rc or persistent PATH change; no other tools were installed and no source/project configuration, Cargo build/test/dependency fetch, activation or deployment formed part of this operation. These scoped statements do not prove OS-enforced absence of incidental effects. The accepted ordinary-host/no-sandbox/no-all-byte-quota/no-per-origin-firewall/no-absolute-process-tree premises remain explicit; point-in-time capacity does not become effective quota or continuing headroom proof.

`INSTALLED` means **bounded host-preparation completion only**. It establishes no installed mise byte identity, new captured closure, RecipeRef, independent F9 installed-byte allowlist, capture/native authority, runtime/resource/calibration/readiness or training proof. Host preparation is not the native window. Accepted N1–N10/bf38, SAME BOTH-seat1048576, cold10s and lifecycle300s remain unchanged, as do all later gates.

Remaining work includes placement/preservation routing, an exact current capture recipe and installed-byte allowlist, build/runtime split, licenses, native libraries/readelf, broader usability, effective capacity/peak coexistence, mixed audits and immutable loading, full policy and actual daemon-used init bytes, the invoice, all418 formulas and fullR5. Future use/capture or exact commands require their applicable plan/gate/operational approvals; the point-in-time result cannot be reused as standing permission. There is **no next automatic operational task**.

Earlier DevOps/Adversarial/Security verdicts covered the proposal **before execution**. Parent reports final read-only outcome-metadata reviews by Adversarial `ses_ea0a811beffewRd0ttWsG7sZKs` and Security `ses_ea0a810f6ffeX1V4Ly479u3npa`: no findings / DOCS READY yes for that documentation delta only, not independent runtime reruns or whole-batch publication reviews. Keeper only read/edited these repository documents and ran no command, hash, test, Git, agent, installed-root read/stat/hash, PATH inspection, probe or private control/receipt/log access; no independent verification or full-source/training completion is claimed.
