# F9 — checked-document root metadata controller and entry

**[Unverified] DESIGN ONLY.** The controller and entry below are proposed future control bytes, not an approved invocation or a read of the retained M2 root. The [metadata scope](native-ingress-root-metadata-proposal.md) and [preflight gate](native-ingress-preflight-packet.md) remain binding. Neither R-OUT nor R-IN is selected; `trainingReady:false`.

## Controller bytes

Extract exactly the UTF-8 bytes between the unique complete fenced delimiters below, including the final LF. Do not trim, reformat or decode escapes. The controller receives only the Node built-in `require` supplied by the verified entry.

<!-- BEGIN F9 ROOT METADATA CONTROLLER -->
```js
const fs = require('node:fs');
const paths = ['/tmp', '/tmp/opencode', '/tmp/opencode/f9-host-rust-1.95.0-m2'];
const labels = ['TMP', 'PARENT', 'ROOT'];
const max = (1n << 64n) - 1n;
const protocol = 'F9_ROOT_METADATA_V1';
let wrote = false;

function reject(reason) {
  throw reason;
}

function output(record) {
  const bytes = Buffer.from(JSON.stringify(record) + '\n', 'ascii');
  if (bytes.length > 1024) reject('OUTPUT');
  wrote = true;
  if (fs.writeSync(1, bytes, 0, bytes.length) !== bytes.length) process.exitCode = 2;
}

function check(stat, index, uid) {
  if (!stat.isDirectory() || stat.isSymbolicLink()) reject(labels[index]);
  if (index === 0) {
    if (stat.uid !== 0n || (stat.mode & 0o7777n) !== 0o1777n) reject('TMP');
  } else if (stat.uid !== uid) {
    reject(labels[index]);
  }
  if (index === 1 && (stat.mode & 0o022n) !== 0n) reject('PARENT');
  if (index === 2 && (stat.mode & 0o7777n) !== 0o700n) reject('ROOT');
  for (const value of [stat.dev, stat.ino, stat.uid, stat.mode]) {
    if (typeof value !== 'bigint' || value < 0n || value > max) reject(labels[index]);
  }
}

function exact(stat) {
  return {
    type: 'directory',
    uid: stat.uid.toString(10),
    mode: (stat.mode & 0o7777n).toString(8).padStart(4, '0'),
    dev: stat.dev.toString(10),
    ino: stat.ino.toString(10),
  };
}

try {
  if (process.platform !== 'linux' || process.arch !== 'x64') reject('PLATFORM');
  if (typeof process.geteuid !== 'function') reject('UID');
  const effective = process.geteuid();
  if (!Number.isSafeInteger(effective) || effective <= 0) reject('UID');
  const uid = BigInt(effective);
  const first = [];
  for (let index = 0; index < 3; index++) {
    let stat;
    try { stat = fs.lstatSync(paths[index], { bigint: true }); }
    catch { reject(labels[index]); }
    check(stat, index, uid);
    first[index] = stat;
  }
  for (let index = 2; index >= 0; index--) {
    let stat;
    try { stat = fs.lstatSync(paths[index], { bigint: true }); }
    catch { reject(labels[index]); }
    check(stat, index, uid);
    const before = first[index];
    if (stat.dev !== before.dev || stat.ino !== before.ino ||
        stat.uid !== before.uid || stat.mode !== before.mode ||
        stat.isDirectory() !== before.isDirectory()) reject('DRIFT');
  }
  output({ protocol, status: 'OBSERVED', reason: 'OK',
    tmp: exact(first[0]), parent: exact(first[1]), root: exact(first[2]) });
} catch (error) {
  process.exitCode = 2;
  if (!wrote) {
    try { output({ protocol, status: 'STOP',
      reason: typeof error === 'string' &&
        ['PLATFORM', 'UID', 'TMP', 'PARENT', 'ROOT', 'DRIFT', 'OUTPUT'].includes(error)
          ? error : 'CONTROLLER' }); }
    catch { process.exitCode = 2; }
  }
}
```
<!-- END F9 ROOT METADATA CONTROLLER -->

The controller fence contains **2730 bytes / 78 LF-terminated lines**, SHA-256 `e9a7b287b3188ce69639632bb116ca7edf4ca2fe12bbc4071bc90fc6bb864c9b` at this draft revision. Any edit to its bytes invalidates this identity and the entry below.

## Entry bytes

Selected A (snapshot handoff), **DESIGN/SOURCE DRAFT ONLY**: a separately trusted outer launcher takes one bounded document snapshot and authenticates all three unique fences before loading the parent. It supplies the checked controller bytes as canonical base64 in the entry child's sole argument after `--` in `--eval <checked entry> -- <checked controller64>`. The entry never opens the document. It checks exact argument count, canonical base64, bounded byte length, final LF, exact UTF-8 round trip and the pinned controller SHA-256 before executing only those verified bytes. Mismatch emits one bounded STOP line with exit 2 where possible; it never forwards a raw error. The executable and pre-start Node environment remain outside this entry's authority.

<!-- BEGIN F9 ROOT METADATA ENTRY -->
```js
const fs = require('node:fs');
const { createHash } = require('node:crypto');
let entered = false;

try {
  if (process.argv.length !== 2) throw Error();
  const encoded = process.argv[1];
  if (typeof encoded !== 'string' || encoded.length !== 3640 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) throw Error();
  const controller = Buffer.from(encoded, 'base64');
  if (controller.length !== 2730 || controller.toString('base64') !== encoded ||
      controller.at(-1) !== 10 ||
      createHash('sha256').update(controller).digest('hex') !==
        'e9a7b287b3188ce69639632bb116ca7edf4ca2fe12bbc4071bc90fc6bb864c9b') throw Error();
  const text = controller.toString('utf8');
  if (!Buffer.from(text, 'utf8').equals(controller)) throw Error();
  entered = true;
  new Function('require', text)(require);
} catch {
  process.exitCode = 2;
  if (!entered) {
    try {
      const result = Buffer.from('{"protocol":"F9_ROOT_METADATA_V1","status":"STOP","reason":"CONTROLLER"}\n');
      if (fs.writeSync(1, result, 0, result.length) !== result.length) process.exitCode = 2;
    } catch { process.exitCode = 2; }
  }
}
```
<!-- END F9 ROOT METADATA ENTRY -->

The revised entry fence measures **1163 bytes / 27 LF-terminated lines**, SHA-256 `4c80a50b1095bfe4049d1449b53c95f7c5cb153ca005e2511965dd20cd41e64e`. Historical superseded entry identity: **1961 bytes / 45 LF-terminated lines**, SHA-256 `f3b594a5584e7797d0b7786adb878c2e3050b601815181c8640b21a4e1bdb85e`; do not use it for the revised fence.

## Parent verifier and capture bytes

This parent is a proposed control program, not a launcher. A separately trusted outer launcher must take **one** bounded document snapshot; verify the unique controller, entry and parent fences against independently approved lengths and SHA-256 digests; then load only the checked parent bytes with fixed Node selection and sanitized pre-start state. It passes exactly two canonical base64 arguments after `--` to `--eval <checked parent> -- <checked entry64> <checked controller64>`. The parent does not read the document. It checks both arguments again against independently pinned byte lengths/digests before passing the same checked entry bytes via `--eval` and the same checked controller64 after `--` to its fixed child. Its internal 4500-ms timer starts after parent startup and argument verification, so it does not reserve 500 ms inside the separate external 5000-ms clock, which must begin before startup. Neither parent self-attestation nor its timer proves immutable loading, termination or reap.

<!-- BEGIN F9 ROOT METADATA PARENT -->
```js
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const { spawn } = require('node:child_process');
const protocol = 'F9_ROOT_METADATA_V1';
const max = (1n << 64n) - 1n;
const entryLength = 1163;
const entryDigest = '4c80a50b1095bfe4049d1449b53c95f7c5cb153ca005e2511965dd20cd41e64e';
let child;
let finished = false;

function stop() {
  if (finished) return;
  finished = true;
  process.exitCode = 2;
  try {
    const bytes = Buffer.from('{"protocol":"F9_ROOT_METADATA_V1","status":"STOP","reason":"CONTROLLER"}\n');
    fs.writeSync(1, bytes, 0, bytes.length);
  } catch { process.exitCode = 2; }
}

function checkedArgument(index, length, digest) {
  const encoded = process.argv[index];
  if (!Number.isSafeInteger(length) || length < 1 || length > 8192 ||
      typeof digest !== 'string' || !/^[a-f0-9]{64}$/.test(digest) ||
      typeof encoded !== 'string' || encoded.length !== Math.ceil(length / 3) * 4 ||
      encoded.length > 10924 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) throw Error();
  const value = Buffer.from(encoded, 'base64');
  if (value.length !== length || value.toString('base64') !== encoded || value.at(-1) !== 10 ||
      createHash('sha256').update(value).digest('hex') !== digest) throw Error();
  const text = value.toString('utf8');
  if (!Buffer.from(text, 'utf8').equals(value)) throw Error();
  return text;
}

function decimal(value) {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,19})$/.test(value)) throw Error();
  const number = BigInt(value);
  if (number > max) throw Error();
  return number;
}

function validate(bytes) {
  if (bytes.length > 1024 || bytes.length === 0 || bytes.some((value) => value > 127)) throw Error();
  const raw = bytes.toString('ascii');
  if (!raw.endsWith('\n') || raw.indexOf('\n') !== raw.length - 1) throw Error();
  const result = JSON.parse(raw.slice(0, -1));
  if (!result || Array.isArray(result) || typeof result !== 'object' ||
      Object.keys(result).join() !== 'protocol,status,reason,tmp,parent,root' ||
      result.protocol !== protocol || result.status !== 'OBSERVED' || result.reason !== 'OK' ||
      JSON.stringify(result) + '\n' !== raw) throw Error();
  const uid = process.geteuid();
  if (!Number.isSafeInteger(uid) || uid <= 0) throw Error();
  for (const [name, expected] of [['tmp', 0n], ['parent', BigInt(uid)], ['root', BigInt(uid)]]) {
    const item = result[name];
    if (!item || Array.isArray(item) || typeof item !== 'object' ||
        Object.keys(item).join() !== 'type,uid,mode,dev,ino' || item.type !== 'directory' ||
        typeof item.mode !== 'string' || !/^[0-7]{4}$/.test(item.mode) ||
        decimal(item.uid) !== expected) throw Error();
    decimal(item.dev);
    decimal(item.ino);
    const mode = BigInt('0o' + item.mode);
    if ((name === 'tmp' && mode !== 0o1777n) ||
        (name === 'parent' && (mode & 0o022n) !== 0n) ||
        (name === 'root' && mode !== 0o700n)) throw Error();
  }
  return bytes;
}

try {
  if (process.argv.length !== 3) throw Error();
  const entry = checkedArgument(1, entryLength, entryDigest);
  checkedArgument(2, 2730,
    'e9a7b287b3188ce69639632bb116ca7edf4ca2fe12bbc4071bc90fc6bb864c9b');
  child = spawn('/usr/local/bin/node',
    ['--no-warnings', '--eval', entry, '--', process.argv[2]], {
    shell: false, cwd: '/', env: {}, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = Buffer.alloc(0);
  let stderrBytes = 0;
  let overflow = false;
  let stdoutEnd = false;
  let stderrEnd = false;
  let exited = false;
  let exitCode = null;
  let exitSignal = null;
  function cancel() {
    if (overflow) return;
    overflow = true;
    try { child.kill('SIGKILL'); } catch { process.exitCode = 2; }
  }
  const timer = setTimeout(cancel, 4500);
  child.stdout.on('data', (bytes) => {
    if (finished || overflow) return;
    if (stdout.length + stderrBytes + bytes.length > 1024) {
      cancel();
    } else stdout = Buffer.concat([stdout, bytes]);
  });
  child.stderr.on('data', (bytes) => {
    if (finished || overflow) return;
    stderrBytes += bytes.length;
    if (stdout.length + stderrBytes > 1024) {
      cancel();
    }
  });
  child.stdout.on('end', () => { stdoutEnd = true; });
  child.stderr.on('end', () => { stderrEnd = true; });
  child.stdout.on('error', cancel);
  child.stderr.on('error', cancel);
  child.on('error', cancel);
  child.on('exit', (code, signal) => {
    exited = true;
    exitCode = code;
    exitSignal = signal;
  });
  child.on('close', () => {
    clearTimeout(timer);
    if (overflow || !exited || exitCode !== 0 || exitSignal !== null ||
        !stdoutEnd || !stderrEnd || stderrBytes !== 0) return stop();
    try {
      const valid = validate(stdout);
      const count = fs.writeSync(1, valid, 0, valid.length);
      finished = true;
      if (count !== valid.length) process.exitCode = 2;
    } catch { stop(); }
  });
} catch { stop(); }
```
<!-- END F9 ROOT METADATA PARENT -->

The revised parent fence measures **4955 bytes / 127 LF-terminated lines**, SHA-256 `725eca59ec9cd85124579380d85780a9d92b25e01100779e83b16a0aa08cdd28`. Historical superseded parent identity: **5610 bytes / 145 LF-terminated lines**, SHA-256 `f72abf2410d969b74dd38c8512fa43da4fe0ce763d83d87c534bd876d2e9f18b`; do not use it for the revised fence. The controller's pinned identity remains unchanged. The hashes identify only fenced bytes, never the entire document. The outer launcher must independently pin all three current byte identities before any review of execution.

## Remaining approval boundary

**Selected A for design only; TRUSTED OUTER LAUNCHER STILL OPEN; EXECUTION STOP.** No outer launcher, trusted parent-byte pre-execution verifier or exact invocation is approved. The launcher alone must open/read **one** bounded document snapshot; authenticate unique fenced blocks against independently preapproved identities; and hand off the checked parent, entry and controller bytes as specified. Parent and entry make **zero** document reads. Controller alone performs its six installed-path `lstat` calls; Node startup can still load executable, libraries, preloads and host resources. Argument bytes are visible to local process observers and count against argv/OS argument-size limits; base64 is transport, not confidentiality or authority. The launcher must bound snapshot, argv, loader, pipe, output, timeout, termination and reap effects; establish fixed trusted Node byte/path selection and sanitized pre-start environment (including preloads/options/descriptors). It must start an **external** 5000-ms clock before Node startup, capture all parent stdout/stderr through exit and both EOFs, and reject without positive output on partial/extra record, stderr, signal, timeout, nonzero exit or incomplete stream. A kill request does not prove reap or full process-tree termination. The repository path's stable ancestry/immutable-loading premise remains unestablished; a bounded snapshot and hashes do not prove it. Neither snapshot metadata nor hashes create a Native immutable-loading seal.

These bytes are **not** an executable or operational grant. Authoring and measuring them neither checks current metadata nor closes M2 custody, installed-byte identity, capacity, RecipeRef, full F9 plan/invoice or runtime authority. The single-use M2/query grants remain consumed. No code block here has been executed against the M2 root; no capture/build/container/native operation or training permission follows. `trainingReady:false`.

Design-only navigation: [selected A snapshot-handoff design and open launcher obligations](native-ingress-root-metadata-launcher.md). This link does not approve execution.
