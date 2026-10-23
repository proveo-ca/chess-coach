// SPEC: _spec/tooling/native-ingress/custody.puml
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { assertFileBirth, assertFilePhase, assertRoot, CustodyError,
  MAX_FIXTURE_BYTES, stageFixture } from './custody.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const payload = Buffer.from('ordinary custody fixture\n');
const input = () => ({ bytes: Buffer.from(payload), expectedSha256: sha(payload) });
const uid = 1000n;
const fileStat = () => ({ dev: 29n, ino: 17n, mode: 0o100600n, uid, gid: uid,
  nlink: 1n, size: 0n, mtimeNs: 1n, ctimeNs: 1n });
const rootStat = () => ({ ...fileStat(), dev: 28n, ino: 3n, mode: 0o40700n,
  nlink: 2n, size: 4096n });
const rejects = (action, code) => assert.throws(action,
  error => error instanceof CustodyError && error.code === code);

function fixtures(t) {
  const parent = fs.mkdtempSync('/tmp/opencode/f9-custody-test-');
  const roots = [];
  t.after(() => {
    t.mock.restoreAll();
    for (const root of roots.reverse()) {
      let stat;
      try { stat = fs.lstatSync(root); }
      catch (error) { if (error.code === 'ENOENT') continue; throw error; }
      if (stat.isSymbolicLink()) { fs.unlinkSync(root); continue; }
      for (const name of ['fixture.bin', 'sentinel']) {
        try { fs.unlinkSync(path.join(root, name)); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
      try { fs.rmdirSync(root); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    fs.rmdirSync(parent);
  });
  return () => {
    const root = path.join(parent, `case-${roots.length}`);
    roots.push(root);
    return root;
  };
}

test('root and file bind independently across device namespaces', () => {
  const root = rootStat(), file = fileStat();
  assertRoot({ ...root }, root, uid);
  assertFileBirth({ ...file }, file, uid);
  assert.notEqual(root.dev, file.dev);
  const sameDeviceFile = { ...file, dev: root.dev };
  assertFileBirth({ ...sameDeviceFile }, sameDeviceFile, uid);
  assertRoot({ ...root, size: 8192n, mtimeNs: 8n, ctimeNs: 9n }, root, uid);
});

for (const key of ['dev', 'ino', 'mode', 'uid', 'gid', 'nlink']) {
  test(`reject named/FD ${key} mismatch`, () => {
    const file = fileStat(), root = rootStat();
    rejects(() => assertFileBirth({ ...file, [key]: file[key] + 1n }, file, uid), 'E_BINDING');
    rejects(() => assertRoot({ ...root, [key]: root[key] + 1n }, root, uid), 'E_BINDING');
  });
}

for (const [key, value, code] of [
  ['mode', 0o120600n, 'E_FILE'], ['mode', 0o100644n, 'E_FILE'],
  ['mode', 0o104600n, 'E_FILE'], ['uid', 1001n, 'E_FILE'],
  ['nlink', 2n, 'E_FILE'], ['nlink', 0n, 'E_FILE'], ['size', 1n, 'E_LENGTH'],
]) {
  test(`reject file birth ${key}=${value}`, () => {
    const file = { ...fileStat(), [key]: value };
    rejects(() => assertFileBirth({ ...file }, file, uid), code);
  });
}

test('reject unsafe root type, owner and mode', () => {
  for (const change of [{ mode: 0o100700n }, { uid: 1001n }, { mode: 0o40755n }]) {
    const root = { ...rootStat(), ...change };
    rejects(() => assertRoot({ ...root }, root, uid), 'E_ROOT');
  }
});

test('validate phase size and named/FD content timestamps without atime', () => {
  const file = { ...fileStat(), size: 4n };
  assertFilePhase({ ...file, atimeNs: 999n }, file, uid, 4n);
  rejects(() => assertFilePhase({ ...file }, file, uid, 5n), 'E_LENGTH');
  for (const key of ['size', 'mtimeNs', 'ctimeNs']) {
    rejects(() => assertFilePhase({ ...file, [key]: file[key] + 1n }, file, uid, 4n), 'E_BINDING');
  }
  rejects(() => assertFileBirth({ ...fileStat(), ino: 4 }, fileStat(), uid), 'E_METADATA');
  rejects(() => assertFileBirth({ ...fileStat(), dev: -1n }, fileStat(), uid), 'E_METADATA');
  rejects(() => assertFileBirth({ ...fileStat(), ino: 1n << 64n }, fileStat(), uid), 'E_METADATA');
});

test('reject malformed paths, bytes and hashes before filesystem effects', t => {
  const next = fixtures(t), root = next();
  for (const invalid of ['relative', '/', root + '/', root + '/../elsewhere', root + '\0']) {
    rejects(() => stageFixture(invalid, input()), 'E_INPUT');
  }
  for (const invalid of [null, {}, { get bytes() { throw new Error('injected getter'); } },
    { ...input(), bytes: new Uint8Array([1]) },
    { ...input(), bytes: Buffer.alloc(0) }, { ...input(), bytes: Buffer.alloc(MAX_FIXTURE_BYTES + 1) },
    { ...input(), expectedSha256: 'A'.repeat(64) }, { ...input(), expectedSha256: 'x' }]) {
    rejects(() => stageFixture(root, invalid), 'E_INPUT');
  }
  rejects(() => stageFixture(root, { ...input(), expectedSha256: '0'.repeat(64) }), 'E_HASH');
  assert.equal(fs.existsSync(root), false);
});

test('stage, re-open, read back and close a fresh real fixture', t => {
  const root = fixtures(t)();
  const result = stageFixture(root, input());
  assert.deepEqual(fs.readFileSync(result.file), payload);
  assert.equal(fs.statSync(root).mode & 0o7777, 0o700);
  assert.equal(fs.statSync(result.file).mode & 0o7777, 0o600);
  assert.equal(result.profile, 'ordinary-per-object-v1');
  assert.equal(result.state, 'DATA_ONLY');
  assert.equal(result.sha256, sha(payload));
  assert.equal(result.byteLength, payload.length);
  assert.equal(result.nativeAuthority, false);
  assert.equal(result.installed, false);
  assert.equal(Object.isFrozen(result), true);
  t.diagnostic(`observed devices: directory=${result.rootDevice}, file=${result.fileDevice}`);
});

test('maximum fixture uses bounded positional I/O and at most two owned FDs', t => {
  const root = fixtures(t)(), bytes = Buffer.alloc(MAX_FIXTURE_BYTES, 0x5a);
  const open = fs.openSync, close = fs.closeSync, read = fs.readSync, write = fs.writeSync;
  const active = new Set();
  let peak = 0, opens = 0, closes = 0, reads = 0, writes = 0;
  t.mock.method(fs, 'openSync', (...args) => {
    const fd = open(...args); active.add(fd); opens++; peak = Math.max(peak, active.size); return fd;
  });
  t.mock.method(fs, 'closeSync', fd => {
    assert.equal(active.delete(fd), true); closes++; return close(fd);
  });
  t.mock.method(fs, 'readSync', (...args) => { reads++; assert.equal(typeof args[4], 'number'); return read(...args); });
  t.mock.method(fs, 'writeSync', (...args) => { writes++; assert.equal(args[4], 0); return write(...args); });
  const result = stageFixture(root, { bytes, expectedSha256: sha(bytes) });
  t.mock.restoreAll();
  assert.equal(result.byteLength, MAX_FIXTURE_BYTES);
  assert.equal(peak, 2); assert.equal(active.size, 0);
  assert.deepEqual({ opens, closes, reads, writes }, { opens: 3, closes: 3, reads: 17, writes: 1 });
});

test('existing root and symlink root are preserved without inspection or repair', t => {
  const next = fixtures(t), existing = next(), link = next();
  fs.mkdirSync(existing, { mode: 0o700 });
  fs.writeFileSync(path.join(existing, 'sentinel'), 'keep');
  const lstat = fs.lstatSync;
  t.mock.method(fs, 'lstatSync', () => { throw new Error('collision must not inspect'); });
  rejects(() => stageFixture(existing, input()), 'E_FS');
  t.mock.restoreAll();
  fs.symlinkSync(existing, link, 'dir');
  rejects(() => stageFixture(link, input()), 'E_FS');
  assert.equal(lstat(link).isSymbolicLink(), true);
  assert.equal(fs.readFileSync(path.join(existing, 'sentinel'), 'utf8'), 'keep');
  fs.unlinkSync(link);
});

test('fixture input is copied before filesystem callbacks can mutate caller memory', t => {
  const root = fixtures(t)(), request = input(), mkdir = fs.mkdirSync;
  t.mock.method(fs, 'mkdirSync', (...args) => { request.bytes.fill(0); return mkdir(...args); });
  const result = stageFixture(root, request);
  t.mock.restoreAll();
  assert.deepEqual(fs.readFileSync(result.file), payload);
});

test('capture input fields once before validating the copied fixture', t => {
  const root = fixtures(t)();
  let byteReads = 0, hashReads = 0;
  const request = {
    get bytes() { byteReads++; return byteReads === 1 ? payload : Buffer.alloc(MAX_FIXTURE_BYTES + 1); },
    get expectedSha256() { hashReads++; return hashReads === 1 ? sha(payload) : '0'.repeat(64); },
  };
  const result = stageFixture(root, request);
  assert.equal(result.sha256, sha(payload));
  assert.equal(byteReads, 1); assert.equal(hashReads, 1);
});

test('shadowed Buffer length cannot bypass the size bound or drive copying', t => {
  const next = fixtures(t), root = next();
  const oversized = Buffer.alloc(MAX_FIXTURE_BYTES + 1);
  Object.defineProperty(oversized, 'length', { get: () => 1 });
  rejects(() => stageFixture(root, { bytes: oversized, expectedSha256: '0'.repeat(64) }), 'E_INPUT');
  assert.equal(fs.existsSync(root), false);
  const changing = Buffer.alloc(MAX_FIXTURE_BYTES + 1);
  let changingReads = 0;
  Object.defineProperty(changing, 'length', {
    get: () => ++changingReads <= 2 ? 1 : MAX_FIXTURE_BYTES + 1,
  });
  rejects(() => stageFixture(root, { bytes: changing, expectedSha256: '0'.repeat(64) }), 'E_INPUT');
  assert.equal(changingReads, 0);

  const source = Buffer.from(payload);
  let lengthReads = 0;
  Object.defineProperty(source, 'length', {
    get: () => { lengthReads++; throw new Error('own length must not be read'); },
  });
  const result = stageFixture(next(), { bytes: source, expectedSha256: sha(payload) });
  assert.equal(result.byteLength, payload.length);
  assert.equal(lengthReads, 0);
});

for (const phase of [1, 2, 3, 4]) {
  test(`reject file name replacement at metadata phase ${phase}`, t => {
    const root = fixtures(t)(), target = path.join(root, 'fixture.bin'), lstat = fs.lstatSync;
    let calls = 0;
    t.mock.method(fs, 'lstatSync', (...args) => {
      const stat = lstat(...args);
      if (args[0] === target && ++calls === phase) return { ...stat, ino: stat.ino + 1n };
      return stat;
    });
    rejects(() => stageFixture(root, input()), 'E_BINDING');
  });
}

test('reject root name replacement before reader acquisition', t => {
  const root = fixtures(t)(), lstat = fs.lstatSync, open = fs.openSync;
  let rootChecks = 0, opens = 0;
  t.mock.method(fs, 'lstatSync', (...args) => {
    const stat = lstat(...args);
    return args[0] === root && ++rootChecks === 2 ? { ...stat, ino: stat.ino + 1n } : stat;
  });
  t.mock.method(fs, 'openSync', (...args) => { opens++; return open(...args); });
  rejects(() => stageFixture(root, input()), 'E_BINDING');
  assert.equal(opens, 2);
});

test('reject actual file replacement before readback', t => {
  const root = fixtures(t)(), target = path.join(root, 'fixture.bin');
  const open = fs.openSync, write = fs.writeSync, close = fs.closeSync;
  t.mock.method(fs, 'openSync', (name, flags, ...rest) => {
    if (name === target && (flags & fs.constants.O_WRONLY) === 0) {
      fs.unlinkSync(target);
      const fd = open(target, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
      try { write(fd, payload, 0, payload.length, 0); } finally { close(fd); }
    }
    return open(name, flags, ...rest);
  });
  rejects(() => stageFixture(root, input()), 'E_BINDING');
});

test('readback never follows a replacement symlink or changes its target', t => {
  const root = fixtures(t)(), target = path.join(root, 'fixture.bin');
  const sentinel = path.join(root, 'sentinel'), open = fs.openSync;
  t.mock.method(fs, 'openSync', (name, flags, ...rest) => {
    if (name === target && (flags & fs.constants.O_WRONLY) === 0) {
      fs.writeFileSync(sentinel, 'keep');
      fs.unlinkSync(target);
      fs.symlinkSync(sentinel, target);
    }
    return open(name, flags, ...rest);
  });
  rejects(() => stageFixture(root, input()), 'E_FS');
  t.mock.restoreAll();
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'keep');
  assert.equal(fs.lstatSync(target).isSymbolicLink(), true);
});

test('partial write is retained and never retried or read back', t => {
  const root = fixtures(t)(), write = fs.writeSync;
  let writes = 0, reads = 0;
  t.mock.method(fs, 'writeSync', (fd, bytes, offset, length, position) => {
    writes++; return write(fd, bytes, offset, length - 1, position);
  });
  t.mock.method(fs, 'readSync', () => { reads++; throw new Error('unexpected read'); });
  rejects(() => stageFixture(root, input()), 'E_IO');
  t.mock.restoreAll();
  assert.equal(writes, 1); assert.equal(reads, 0);
  assert.equal(fs.statSync(path.join(root, 'fixture.bin')).size, payload.length - 1);
});

test('short read is rejected without a progress retry', t => {
  const root = fixtures(t)(), read = fs.readSync;
  let reads = 0;
  t.mock.method(fs, 'readSync', (fd, bytes, offset, length, position) => {
    reads++; return read(fd, bytes, offset, length - 1, position);
  });
  rejects(() => stageFixture(root, input()), 'E_IO');
  assert.equal(reads, 1);
});

test('zero write and thrown I/O prevent reader acquisition', t => {
  const next = fixtures(t), open = fs.openSync;
  for (const [write, code] of [[() => 0, 'E_IO'],
    [() => { throw new Error('injected write failure'); }, 'E_FS']]) {
    const root = next(); let opens = 0;
    t.mock.method(fs, 'openSync', (...args) => { opens++; return open(...args); });
    t.mock.method(fs, 'writeSync', write);
    rejects(() => stageFixture(root, input()), code);
    t.mock.restoreAll();
    assert.equal(opens, 2);
  }
});

test('open failure closes the already acquired root descriptor', t => {
  const root = fixtures(t)(), open = fs.openSync, close = fs.closeSync;
  let opens = 0, closes = 0;
  t.mock.method(fs, 'openSync', (...args) => {
    if (++opens === 2) throw new Error('injected open failure');
    return open(...args);
  });
  t.mock.method(fs, 'closeSync', fd => { closes++; return close(fd); });
  rejects(() => stageFixture(root, input()), 'E_FS');
  assert.equal(opens, 2); assert.equal(closes, 1);
});

test('truncation during readback prevents success', t => {
  const root = fixtures(t)(), target = path.join(root, 'fixture.bin'), read = fs.readSync;
  let first = true;
  t.mock.method(fs, 'readSync', (...args) => {
    if (first) { first = false; fs.truncateSync(target, payload.length - 1); }
    return read(...args);
  });
  rejects(() => stageFixture(root, input()), 'E_IO');
});

test('altered readback bytes fail the independent digest', t => {
  const root = fixtures(t)(), read = fs.readSync;
  t.mock.method(fs, 'readSync', (...args) => {
    const count = read(...args); if (count > 0) args[1][args[2]] ^= 1; return count;
  });
  rejects(() => stageFixture(root, input()), 'E_HASH');
});

test('unexpected bytes at EOF prevent success', t => {
  const root = fixtures(t)(), read = fs.readSync;
  t.mock.method(fs, 'readSync', (...args) => args[4] === payload.length ? 1 : read(...args));
  rejects(() => stageFixture(root, input()), 'E_LENGTH');
});

for (const at of [1, 2, 3]) {
  test(`close failure ${at} prevents success and closes other owned descriptors once`, t => {
    const root = fixtures(t)(), close = fs.closeSync, open = fs.openSync;
    let closes = 0, opens = 0;
    t.mock.method(fs, 'openSync', (...args) => { opens++; return open(...args); });
    t.mock.method(fs, 'closeSync', fd => {
      closes++; close(fd); if (closes === at) throw new Error('injected close uncertainty');
    });
    rejects(() => stageFixture(root, input()), 'E_CLOSE');
    assert.equal(opens, at === 1 ? 2 : 3);
    assert.equal(closes, at === 1 ? 2 : 3);
  });
}

test('deadline after descriptor acquisition still closes both owned handles', t => {
  const root = fixtures(t)(), open = fs.openSync, close = fs.closeSync;
  let time = 0n, opens = 0, closes = 0;
  t.mock.method(process.hrtime, 'bigint', () => time);
  t.mock.method(fs, 'openSync', (...args) => {
    const fd = open(...args); if (++opens === 2) time = 4_000_000_000n; return fd;
  });
  t.mock.method(fs, 'closeSync', fd => { closes++; return close(fd); });
  try { rejects(() => stageFixture(root, input()), 'E_DEADLINE'); }
  finally { t.mock.restoreAll(); }
  assert.equal(opens, 2); assert.equal(closes, 2);
});
