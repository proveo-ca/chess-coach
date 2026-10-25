// SPEC: _spec/tooling/native-ingress/step2.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { OWN_CGROUP_LOCATOR_LIMITS as LIMITS, observeOwnCgroupAncestryMock as observe } from './own-cgroup-locator.mjs';
import { OWN_CGROUP_LOCATOR_SOURCE_PINS as PINS, captureRegisteredOwnCgroupLocatorSources as capture,
  runRegisteredOwnCgroupLocatorMock as operation } from './own-cgroup-locator-operation.mjs';

const ROOT = '/sys/fs/cgroup';
const BASE = '/tmp/opencode/f9-bootstrap-correspondence/tooling/native-ingress/';
const STATUS = 'Name:\tPRIVATE_PROCESS\nNoNewPrivs:\t0\nSeccomp:\t0\nCapEff:\t0000000000000000\n';
const NAMES = ['cgroup.controllers', 'cgroup.subtree_control', 'memory.max', 'pids.max', 'cpu.max'];
const CONTENT = ['memory pids cpu io\n', 'memory pids cpu\n', 'max\n', '123\n', 'max 100000\n'];
const hash = value => createHash('sha256').update(value).digest('hex');
const osError = code => Object.assign(new Error('PRIVATE_ERROR /private/do-not-print'), { code });
const stat = (mode = 0o100444n, ino = 1n, size = 0n) => ({ dev: 4n, ino, mode, uid: 0n, gid: 0n, nlink: 1n, size });
const mount = (root = '/private', point = ROOT, id = '31', type = 'cgroup2') =>
  `${id} 20 0:28 ${root} ${point} rw,nosuid - ${type} PRIVATE_SOURCE rw\n`;
const SOURCE_BYTES = {
  helper: fs.readFileSync(new URL('./own-cgroup-locator.mjs', import.meta.url)),
  dependency: fs.readFileSync(new URL('./containment-metadata.mjs', import.meta.url)),
};

function fixture(options = {}) {
  const calls = [], owned = new Map(), closed = [], opened = [], opens = new Map();
  const dirs = options.directories ?? [ROOT + '/team/leaf', ROOT + '/team', ROOT];
  const prefixes = new Set(['/']);
  for (const dir of dirs) {
    let prefix = '';
    for (const part of dir.slice(1).split('/')) { prefix += '/' + part; prefixes.add(prefix); }
  }
  const bodies = new Map([
    ['/proc/123/mountinfo', Buffer.from(options.mount ?? mount())],
    ['/proc/123/cgroup', Buffer.from(options.membership ?? '0::/private/team/leaf\n')],
    ['/proc/123/status', Buffer.from(options.status ?? STATUS)],
  ]);
  for (const dir of dirs) NAMES.forEach((name, index) => bodies.set(dir + '/' + name, Buffer.from(CONTENT[index])));
  for (const [file, body] of Object.entries(options.bodies ?? {})) bodies.set(file, Buffer.from(body));
  let tick = 0n, nextFd = 10, peak = 0;
  function hook(method, file, ...args) {
    calls.push([method, file, ...args]); return options.hook?.(method, file, ...args);
  }
  function fileStat(file) {
    assert.ok(prefixes.has(file) || bodies.has(file), 'unexpected mock path');
    return stat(prefixes.has(file) ? 0o040555n : 0o100444n, BigInt([...file].reduce((sum, char) => sum + char.codePointAt(0), 0)));
  }
  const fake = {
    constants: { O_RDONLY: 0, O_NOFOLLOW: 0x20000, O_NONBLOCK: 0x800, W_OK: 2 },
    lstatSync(file, flags) {
      assert.equal(flags.bigint, true);
      const replacement = hook('lstat', file); if (replacement !== undefined) return replacement;
      if (options.missing?.includes(file)) throw osError('ENOENT');
      return fileStat(file);
    },
    accessSync(file, flag) {
      assert.equal(flag, 2); assert.ok(dirs.includes(file)); hook('access', file);
      const code = options.access?.[file]; if (code) throw osError(code);
    },
    openSync(file, flags) {
      hook('open', file); assert.equal(flags, 0x20800); assert.ok(bodies.has(file)); assert.equal(owned.size, 0);
      if (options.denied?.[file]) throw osError(options.denied[file]);
      const fd = nextFd++; opens.set(file, (opens.get(file) ?? 0) + 1);
      owned.set(fd, { file, at: 0, pass: opens.get(file) }); opened.push(file); peak = Math.max(peak, owned.size); return fd;
    },
    fstatSync(fd, flags) {
      assert.equal(flags.bigint, true); const file = owned.get(fd).file;
      return hook('fstat', file, fd) ?? fileStat(file);
    },
    readSync(fd, target, offset, request, position) {
      assert.equal(position, null); assert.equal(offset, 0); assert.ok(request > 0 && request <= 4096);
      const record = owned.get(fd), replacement = hook('read', record.file, request, fd);
      if (replacement !== undefined) return replacement;
      const source = record.pass > 1 && options.final?.[record.file] !== undefined ? Buffer.from(options.final[record.file]) : bodies.get(record.file);
      const chunk = typeof options.chunk === 'function' ? options.chunk(record.file, record.at, request) : options.chunk ?? Infinity;
      const length = Math.min(request, chunk, source.length - record.at);
      source.copy(target, 0, record.at, record.at + length); record.at += length; return length;
    },
    closeSync(fd) {
      assert.ok(owned.has(fd)); const file = owned.get(fd).file;
      owned.delete(fd); closed.push(fd); hook('close', file, fd);
      if (options.closeError) throw osError('EACCES');
    },
  };
  const config = { fs: fake, pid: 123, now: () => { tick += options.tick ?? 1000n; return tick; } };
  return { config, fake, calls, owned, closed, opened, bodies, dirs, peak: () => peak, run: () => observe(config) };
}
function stopped(result, code) {
  assert.equal(result.status, 'STOP'); if (code) assert.equal(result.error, code);
  assert.equal(result.candidate, null); assert.equal(result.ancestry, null);
  assert.equal(result.delegationCandidate, false); assert.equal(result.rootProfileOnly, false);
  assert.equal(result.ownAncestryOnly, true);
  assert.equal(result.processStatus, null); assert.equal(result.accountingComplete, false);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|private\/|Error:|stack/);
}
function notReady(result) {
  for (const key of ['nativeQualified', 'rustReady', 'trainingReady', 'train', 'containmentEstablished',
    'ancestorProtectionProven', 'atomicSnapshotGuaranteed', 'hardDeadlineGuaranteed', 'capacityProven',
    'continuousStabilityProven', 'childCgroupManagementProven']) assert.equal(result[key], false);
}

test('closest own leaf qualifies as metadata only, with closed capabilities and no private paths', () => {
  const f = fixture(), result = f.run();
  assert.equal(result.status, 'OWN_CGROUP_METADATA_OBSERVED'); assert.equal(result.mapping, 'MAPPED');
  assert.equal(result.mockOnly, true); assert.match(result.profile, /MOCK/);
  assert.deepEqual(result.candidate, { directory: ROOT + '/team/leaf', interpretation: 'DATA_NOT_PERMISSION' });
  assert.equal(result.delegationCandidate, true); assert.equal(result.rootProfileOnly, false);
  assert.equal(result.ownAncestryOnly, true); assert.equal(result.scope, 'DATA_NOT_PERMISSION');
  assert.equal(result.accountingComplete, true); assert.equal(result.snapshotAgreement, true); notReady(result);
  assert.equal(result.ancestry.length, 3); assert.deepEqual(result.ancestry.map(record => record.depth), [0, 1, 2]);
  assert.equal(result.ancestry[0].hash, hash(ROOT + '/team/leaf'));
  assert.equal(result.processStatus.value.noNewPrivs, 0); assert.equal(result.processStatus.value.seccomp, 0);
  assert.ok(Object.values(result.processStatus.value.capabilities).every(value => value === false));
  assert.equal(f.peak(), 1); assert.equal(f.owned.size, 0); assert.equal(f.closed.length, 20);
  assert.equal(result.counts.directoryAccessAttempts, 3); assert.equal(result.unsupportedContext, false);
  assert.match(result.hashScope, /NOT_GUARANTEED_ANONYMITY/);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|private|CapEff|mountroot|membership/);
  assert.ok(Object.isFrozen(result.ancestry[0].fields));
});

test('no qualifying own ancestor keeps the candidate receipt false without a root-only scope claim', () => {
  const result = fixture({ access: { [ROOT + '/team/leaf']: 'EACCES', [ROOT + '/team']: 'EACCES', [ROOT]: 'EACCES' } }).run();
  assert.equal(result.status, 'OWN_CGROUP_METADATA_OBSERVED'); assert.equal(result.mapping, 'MAPPED');
  assert.equal(result.candidate, null); assert.equal(result.delegationCandidate, false);
  assert.equal(result.rootProfileOnly, false); assert.equal(result.ownAncestryOnly, true);
  assert.equal(result.scope, 'DATA_NOT_PERMISSION'); assert.equal(result.accountingComplete, true); notReady(result);
});
for (const failure of ['deadline', 'clock']) test('late output ' + failure + ' clears an otherwise positive candidate receipt', () => {
  const baseline = fixture({ tick: 0n }).run(); assert.equal(baseline.delegationCandidate, true);
  const lastClock = baseline.counts.clockReadAttempts, f = fixture(); let calls = 0;
  f.config.now = () => {
    if (++calls < lastClock) return 0n;
    if (failure === 'clock') throw new Error('PRIVATE_CLOCK');
    return 10000000000n;
  };
  const result = f.run(); stopped(result, failure === 'clock' ? 'E_CLOCK' : 'E_DEADLINE'); notReady(result);
  assert.equal(result.counts.clockReadAttempts, lastClock);
  assert.equal(f.closed.length, baseline.counts.closesCompleted); assert.equal(f.owned.size, 0);
});

test('mount root equal to membership maps to the mountpoint, not a duplicated host suffix', () => {
  const result = fixture({ membership: '0::/private\n', directories: [ROOT] }).run();
  assert.equal(result.candidate.directory, ROOT); assert.equal(result.ancestry.length, 1);
  assert.deepEqual(Object.keys(result.ancestry[0]), ['hash', 'depth', 'metadata', 'writeAccess', 'fields']);
});
test('hierarchy slash root maps a non-root membership correctly', () => {
  const result = fixture({ mount: mount('/'), membership: '0::/team/leaf\n' }).run();
  assert.equal(result.candidate.directory, ROOT + '/team/leaf');
});
test('hierarchy slash root and slash membership map to the mountpoint', () => {
  const result = fixture({ mount: mount('/'), membership: '0::/\n', directories: [ROOT] }).run();
  assert.equal(result.candidate.directory, ROOT); assert.equal(result.ancestry.length, 1);
});
for (const member of ['/other/team/leaf', '/private-other/team/leaf', '/', '/team/leaf'])
  test('namespace nonmatching membership stays UNMAPPABLE without a guess: ' + member, () => {
    const f = fixture({ membership: '0::' + member + '\n' }), result = f.run();
    assert.equal(result.status, 'OWN_CGROUP_METADATA_OBSERVED'); assert.equal(result.mapping, 'UNMAPPABLE');
    assert.equal(result.candidate, null); assert.deepEqual(result.ancestry, []);
    assert.ok(f.calls.every(([, file]) => file.startsWith('/proc/123/')));
  });
test('component boundary /a does not map /ab', () => {
  const result = fixture({ mount: mount('/a'), membership: '0::/ab\n' }).run();
  assert.equal(result.mapping, 'UNMAPPABLE'); assert.equal(result.candidate, null);
});
test('space octal escape maps canonical paths without exposing the mount root', () => {
  const result = fixture({ mount: mount('/private\\040root'), membership: '0::/private root/team/leaf\n' }).run();
  assert.equal(result.candidate.directory, ROOT + '/team/leaf'); assert.doesNotMatch(JSON.stringify(result), /private root/);
});
for (const escape of ['011', '012', '134']) test('decoded forbidden path octal ' + escape + ' stops', () => {
  stopped(fixture({ mount: mount('/private\\' + escape + 'root') }).run(), 'E_PATH');
});
test('unknown octal escape stops rather than normalizing', () => stopped(fixture({ mount: mount('/private\\057root') }).run(), 'E_SYNTAX'));
for (const invalid of ['relative', '/a//b', '/a/./b', '/a/../b', '/a/', '/a\\b', '/a\t', '/a\x7f'])
  test('noncanonical mount root stops: ' + JSON.stringify(invalid), () => stopped(fixture({ mount: mount(invalid) }).run()));
for (const invalid of ['/a//b', '/a/./b', '/a/../b', '/a/', '/a\\b', '/a\t', '/a\0'])
  test('noncanonical membership stops: ' + JSON.stringify(invalid), () => stopped(fixture({ membership: '0::' + invalid + '\n' }).run()));
test('invalid UTF8 stops with a fixed code and no raw data', () => {
  stopped(fixture({ bodies: { '/proc/123/cgroup': Buffer.from([0xff]) } }).run(), 'E_UTF8');
});
test('duplicate unified membership stops', () => stopped(fixture({ membership: '0::/private\n0::/other\n' }).run(), 'E_SYNTAX'));
test('missing unified membership is unavailable, not a namespace guess', () => {
  const result = fixture({ membership: '1:memory:/private\n' }).run();
  assert.equal(result.mapping, 'UNAVAILABLE'); assert.equal(result.candidate, null);
});
test('multiple exact mounts are unavailable without inspecting an ancestry', () => {
  const f = fixture({ mount: mount() + mount('/private', ROOT, '32') }), result = f.run();
  assert.equal(result.status, 'OWN_CGROUP_METADATA_OBSERVED'); assert.equal(result.mapping, 'UNAVAILABLE');
  assert.equal(result.candidate, null); assert.ok(f.calls.every(([, file]) => file.startsWith('/proc/123/')));
});
test('wrong exact filesystem is unavailable', () => {
  const result = fixture({ mount: mount('/private', ROOT, '31', 'tmpfs') }).run();
  assert.equal(result.mapping, 'UNAVAILABLE'); assert.equal(result.candidate, null);
});
for (const point of [ROOT + '/team', ROOT + '/team/leaf', ROOT + '/team/leaf/nested', ROOT + '/memory.max', ROOT + '/team/cpu.max'])
  test('overlapping own-ancestry mount stops before directory inspection: ' + point, () => {
    const f = fixture({ mount: mount() + mount('/', point, '32', 'tmpfs') }); stopped(f.run(), 'E_SHADOW');
    assert.ok(f.calls.every(([, file]) => file.startsWith('/proc/123/')));
  });
test('normal enclosing mounts and disjoint siblings do not shadow the selected mount', () => {
  const result = fixture({ mount: mount('/', '/', '1', 'overlay').replace('1 20 ', '1 0 ') +
    mount('/', '/sys', '20', 'sysfs').replace('20 20 ', '20 1 ') +
    mount() + mount('/', ROOT + '/sibling', '32', 'tmpfs') }).run();
  assert.equal(result.candidate.directory, ROOT + '/team/leaf');
});
for (const point of ['/', '/sys', '/sys/fs']) test('a non-ancestral enclosing overmount stops: ' + point, () => {
  const f = fixture({ mount: mount() + mount('/', point, '32', 'tmpfs') });
  stopped(f.run(), 'E_SHADOW'); assert.ok(f.calls.every(([, file]) => file.startsWith('/proc/123/')));
});
test('cyclic selected mount ancestry is malformed mapping metadata', () => {
  stopped(fixture({ mount: mount().replace('31 20 ', '31 31 ') }).run(), 'E_SYNTAX');
});
test('a self-parented namespace root is a terminal enclosing mount, not a guessed membership mapping', () => {
  const result = fixture({ mount: mount('/', '/', '20', 'overlay') + mount() }).run();
  assert.equal(result.status, 'OWN_CGROUP_METADATA_OBSERVED'); assert.equal(result.candidate.directory, ROOT + '/team/leaf');
});
test('closest qualifying ancestor wins when the leaf denies W_OK', () => {
  const result = fixture({ access: { [ROOT + '/team/leaf']: 'EACCES' } }).run();
  assert.equal(result.candidate.directory, ROOT + '/team');
});
test('parent subtree flags belong to the parent and do not replace leaf availability', () => {
  const result = fixture({ bodies: { [ROOT + '/team/leaf/cgroup.controllers']: 'memory pids\n',
    [ROOT + '/team/cgroup.subtree_control']: 'cpu pids\n' } }).run();
  assert.equal(result.candidate.directory, ROOT);
  assert.equal(result.ancestry[0].fields.controllers.value.cpu, false);
  assert.equal(result.ancestry[1].fields.subtreeControl.value.memory, false);
});
for (const option of ['mount', 'superblock']) test(option + ' read-only context never qualifies', () => {
  const body = option === 'mount' ? mount().replace('rw,nosuid', 'ro,nosuid') : mount().replace('PRIVATE_SOURCE rw', 'PRIVATE_SOURCE ro');
  const result = fixture({ mount: body }).run(); assert.equal(result.mapping, 'MAPPED'); assert.equal(result.candidate, null);
});
test('root-only denied profile with absent hierarchy-root limits reports metadata without delegation claims', () => {
  const missing = ['memory.max', 'pids.max', 'cpu.max'].map(name => ROOT + '/' + name);
  const result = fixture({ mount: mount('/'), membership: '0::/\n', directories: [ROOT], missing,
    access: { [ROOT]: 'EACCES' } }).run();
  assert.equal(result.status, 'OWN_CGROUP_METADATA_OBSERVED'); assert.equal(result.candidate, null);
  assert.equal(result.ancestry[0].metadata.value.uid, '0'); assert.equal(result.ancestry[0].metadata.value.mode, String(0o040555));
  assert.equal(result.ancestry[0].fields.controllers.status, 'OBSERVED'); assert.equal(result.ancestry[0].fields.memoryMax.reason, 'ENOENT');
  assert.equal(result.unsupportedContext, false); notReady(result);
});
test('W_OK runs exactly once per accessible ancestry directory without a write syscall', () => {
  const f = fixture(), result = f.run(); assert.equal(result.status, 'OWN_CGROUP_METADATA_OBSERVED');
  for (const dir of f.dirs) assert.equal(f.calls.filter(([method, file]) => method === 'access' && file === dir).length, 1);
  assert.ok(f.calls.every(([method]) => ['lstat', 'access', 'open', 'fstat', 'read', 'close'].includes(method)));
});
test('hierarchy-root ENOENT max files alone do not demote otherwise complete metadata', () => {
  const result = fixture({ mount: mount('/'), membership: '0::/\n', directories: [ROOT],
    missing: ['memory.max', 'pids.max', 'cpu.max'].map(name => ROOT + '/' + name) }).run();
  assert.equal(result.candidate.directory, ROOT);
});
test('non-global mount root needs all max metadata', () => {
  const result = fixture({ membership: '0::/private\n', directories: [ROOT], missing: [ROOT + '/memory.max'] }).run();
  assert.equal(result.candidate, null); assert.equal(result.ancestry[0].fields.memoryMax.status, 'UNAVAILABLE');
});
for (const name of NAMES) test('unavailable own field remains point-in-time metadata: ' + name, () => {
  const result = fixture({ denied: { [ROOT + '/team/leaf/' + name]: 'EACCES' } }).run();
  assert.equal(result.status, 'OWN_CGROUP_METADATA_OBSERVED'); assert.equal(result.candidate.directory, ROOT + '/team');
  assert.ok(Object.values(result.ancestry[0].fields).some(field => field.reason === 'EACCES'));
});
test('missing status prevents a positive candidate without broad unsupported claims', () => {
  const result = fixture({ denied: { '/proc/123/status': 'EACCES' } }).run();
  assert.equal(result.candidate, null); assert.equal(result.processStatus.reason, 'EACCES');
  assert.equal(result.unsupportedContext, false);
});
test('missing directory metadata forbids descendant file inspection while leaving safe ancestors eligible', () => {
  const f = fixture({ missing: [ROOT + '/team/leaf'] }), result = f.run();
  assert.equal(result.candidate.directory, ROOT + '/team');
  assert.ok(!f.opened.some(file => file.startsWith(ROOT + '/team/leaf/')));
});
test('depth 33 stops before any ancestry lstat instead of truncating', () => {
  const member = '/private/' + Array(32).fill('x').join('/');
  const f = fixture({ membership: '0::' + member + '\n' }); stopped(f.run(), 'E_DEPTH');
  assert.ok(f.calls.every(([, file]) => file.startsWith('/proc/123/')));
});
test('depth 32 completes with 512-byte cgroup chunks within every aggregate budget', () => {
  const leaf = ROOT + '/' + Array(31).fill('x').join('/'), dirs = [];
  let dir = leaf;
  while (true) { dirs.push(dir); if (dir === ROOT) break; dir = dir.slice(0, dir.lastIndexOf('/')); }
  const f = fixture({ membership: '0::/private/' + Array(31).fill('x').join('/') + '\n', directories: dirs }), result = f.run();
  assert.equal(result.status, 'OWN_CGROUP_METADATA_OBSERVED'); assert.equal(result.ancestry.length, 32);
  assert.ok(result.counts.requestedReadBytes <= LIMITS.requestedReadBytes); assert.ok(result.counts.readAttempts <= 512);
  assert.ok(result.counts.openAttempts <= 256); assert.ok(result.counts.closeAttempts <= 256);
  assert.ok(result.counts.fsOperationAttempts <= 4096); assert.ok(result.counts.clockReadAttempts <= 16384);
  assert.ok(Buffer.byteLength(JSON.stringify(result)) <= 65536);
  assert.ok(f.calls.filter(([method, file]) => method === 'read' && file.startsWith(ROOT)).every(call => call[2] <= 512));
});
for (const prefix of ['/', '/sys', '/sys/fs', ROOT, ROOT + '/team', ROOT + '/team/leaf'])
  test('observed symlink prefix stops without descendant opens: ' + prefix, () => {
    const f = fixture({ hook(method, file) { if (method === 'lstat' && file === prefix) return stat(0o120777n); } });
    stopped(f.run(), 'E_SYMLINK'); assert.ok(f.opened.every(file => file.startsWith('/proc/123/')));
  });
test('partial reads continue until explicit EOF with a single owned descriptor', () => {
  const f = fixture({ chunk: 11 }), result = f.run();
  assert.equal(result.status, 'OWN_CGROUP_METADATA_OBSERVED'); assert.ok(result.counts.readAttempts > 40);
  assert.equal(result.counts.returnedReadBytes, result.counts.acceptedReadBytes); assert.equal(f.peak(), 1);
  for (const file of new Set(f.opened)) assert.ok(f.calls.filter(([method, path]) => method === 'read' && path === file).length >= 2);
});
for (const [file, size] of [['/proc/123/status', 65536], [ROOT + '/team/leaf/cgroup.controllers', 4096]]) {
  test('exact file cap needs EOF, not stat size: ' + file, () => {
    const prefix = file.startsWith('/proc/') ? STATUS : 'memory pids cpu\n';
    const result = fixture({ bodies: { [file]: prefix + ' '.repeat(size - Buffer.byteLength(prefix)) } }).run();
    assert.equal(result.status, 'OWN_CGROUP_METADATA_OBSERVED');
  });
  test('cap plus one stops and closes: ' + file, () => {
    const f = fixture({ bodies: { [file]: 'x'.repeat(size + 1) } }); stopped(f.run(), 'E_LENGTH'); assert.equal(f.owned.size, 0);
  });
}
test('requested read amplification stops at one MiB including EOF requests', () => {
  const f = fixture({ chunk: 1, bodies: { '/proc/123/mountinfo': mount() + ' '.repeat(2000) } }), result = f.run();
  stopped(result, 'E_LIMIT'); assert.equal(result.counts.requestedReadBytes, 1048576);
  assert.equal(result.counts.readAttempts, 256); assert.equal(f.closed.length, 1); assert.equal(f.owned.size, 0);
});
test('global 512-read limit stops before another read even below the byte budget', () => {
  const f = fixture({ chunk(file) { return file.startsWith(ROOT) ? 1 : Infinity; },
    bodies: { [ROOT + '/team/leaf/cgroup.controllers']: 'memory pids cpu' + ' '.repeat(600) } });
  const result = f.run(); stopped(result, 'E_LIMIT'); assert.equal(result.counts.readAttempts, 512);
  assert.ok(result.counts.requestedReadBytes < 1048576); assert.equal(f.owned.size, 0);
});
test('failed opens consume the attempt count without positive closes', () => {
  const f = fixture({ denied: { [ROOT + '/team/leaf/memory.max']: 'EPERM' } }), result = f.run();
  assert.equal(result.counts.openAttempts, 20); assert.equal(result.counts.opensCompleted, 19);
  assert.equal(result.counts.closeAttempts, 19); assert.equal(result.counts.closesCompleted, 19);
});
for (const field of ['dev', 'ino', 'mode', 'uid', 'gid', 'nlink'])
  test('SECURITY6 named/descriptor drift stops: ' + field, () => {
    let calls = 0;
    const f = fixture({ hook(method) { if (method === 'fstat' && ++calls === 2) return { ...stat(), [field]: 999n }; } });
    stopped(f.run(), 'E_IDENTITY'); assert.equal(f.closed.length, 1);
  });
test('own-directory metadata drift suppresses all candidates', () => {
  let seen = 0;
  const f = fixture({ hook(method, file) {
    if (method === 'lstat' && file === ROOT + '/team/leaf' && ++seen === 3) return stat(0o040555n, 999n);
  } }); stopped(f.run(), 'E_IDENTITY');
});
test('exact root metadata is checked before and after each candidate observation', () => {
  let seen = 0;
  const f = fixture({ hook(method, file) {
    if (method === 'lstat' && file === ROOT && ++seen === 3) return stat(0o040555n, 999n);
  } }); stopped(f.run(), 'E_IDENTITY'); assert.equal(seen, 3);
});
test('size zero and volatile non-security metadata do not imply EOF or identity drift', () => {
  const f = fixture({ hook(method, file) {
    if (method === 'fstat') return { ...stat(0o100444n, BigInt([...file].reduce((sum, char) => sum + char.codePointAt(0), 0))), size: 999999n };
  } }); assert.equal(f.run().status, 'OWN_CGROUP_METADATA_OBSERVED');
});
test('close failure absorbs read and cleanup-clock failures and forbids another file', () => {
  let closed = false;
  const f = fixture({ closeError: true, hook(method) { if (method === 'read') throw osError('EIO'); if (method === 'close') closed = true; } });
  f.config.now = () => { if (closed) throw new Error('PRIVATE_CLOCK'); return 0n; };
  stopped(f.run(), 'E_CLOSE'); assert.equal(f.closed.length, 1); assert.equal(f.opened.length, 1); assert.equal(f.owned.size, 0);
});
test('deadline during an owned read still performs one ungated positive close', () => {
  let read = false;
  const f = fixture({ hook(method) { if (method === 'read') read = true; } });
  f.config.now = () => read ? 9000000000n : 0n;
  stopped(f.run(), 'E_DEADLINE'); assert.equal(f.closed.length, 1); assert.equal(f.owned.size, 0);
});
test('cleanup time counts toward the inclusive ten-second source envelope', () => {
  let closed = false;
  const f = fixture({ hook(method) { if (method === 'close') closed = true; } });
  f.config.now = () => closed ? 10000000000n : 0n;
  stopped(f.run(), 'E_DEADLINE'); assert.equal(f.closed.length, 1);
});
for (const bad of [-1n, 0, NaN]) test('invalid clock fails before filesystem: ' + String(bad), () => {
  const f = fixture(); f.config.now = () => bad; stopped(f.run(), 'E_CLOCK'); assert.equal(f.calls.length, 0);
});
test('clock rollback fails closed', () => {
  let count = 0; const f = fixture(); f.config.now = () => ++count === 1 ? 2n : 1n;
  stopped(f.run(), 'E_CLOCK'); assert.equal(f.calls.length, 0);
});
for (const [name, body] of [
  ['mount root', mount('/changed')], ['membership', '0::/private/team/other\n'],
  ['mount read-only', mount().replace('rw,nosuid', 'ro,nosuid')],
  ['shadow mount', mount() + mount('/', ROOT + '/team', '32', 'tmpfs')],
]) test('final ' + name + ' drift stops and redacts all partial candidates', () => {
  const file = name === 'membership' ? '/proc/123/cgroup' : '/proc/123/mountinfo';
  const f = fixture({ final: { [file]: body } }); stopped(f.run()); assert.equal(f.owned.size, 0);
});
test('final irrelevant source spelling does not masquerade as mapping drift', () => {
  const result = fixture({ final: { '/proc/123/mountinfo': mount().replace('PRIVATE_SOURCE', 'OTHER_SOURCE') } }).run();
  assert.equal(result.status, 'OWN_CGROUP_METADATA_OBSERVED'); assert.equal(result.snapshotAgreement, true);
});
test('final membership still must agree when the initial mount is unavailable', () => {
  const f = fixture({ denied: { '/proc/123/mountinfo': 'EACCES' }, final: { '/proc/123/cgroup': '0::/other\n' } });
  stopped(f.run(), 'E_MAPPING_DRIFT');
});
test('selected capabilities remain a closed set without raw CapEff', () => {
  const result = fixture({ status: STATUS.replace('0000000000000000', 'ffffffffffffffff') }).run();
  assert.equal(Object.keys(result.processStatus.value.capabilities).length, 5);
  assert.ok(Object.values(result.processStatus.value.capabilities).every(value => value === true));
  assert.doesNotMatch(JSON.stringify(result), /ffffffff|CapEff|PRIVATE_PROCESS/);
});
test('invalid PID values never access any filesystem', () => {
  for (const pid of [0, -1, 4294967296, 1.5, '123', {}, NaN]) {
    const f = fixture(); f.config.pid = pid; stopped(f.run(), 'E_PID'); assert.equal(f.calls.length, 0);
  }
});
test('mock dependencies are complete and reject getters/proxies without invoking them', () => {
  for (const key of ['fs', 'now', 'pid']) {
    const f = fixture(); delete f.config[key]; stopped(f.run()); assert.equal(f.calls.length, 0);
  }
  const f = fixture(); Object.defineProperty(f.config, 'pid', { get() { throw new Error('TRAP'); } });
  stopped(f.run(), 'E_PID'); assert.equal(f.calls.length, 0);
  stopped(observe(new Proxy({}, { get() { throw new Error('TRAP'); } })), 'E_MOCK_TCB');
  stopped(observe(), 'E_ARGUMENTS');
});
test('invalid nofollow and nonblock flags fail before access', () => {
  for (const [key, value] of [['O_RDONLY', 1], ['O_NOFOLLOW', 0], ['O_NONBLOCK', 2], ['O_NONBLOCK', 0x20000], ['W_OK', 4]]) {
    const f = fixture(); f.fake.constants[key] = value; stopped(f.run(), 'E_FLAGS'); assert.equal(f.calls.length, 0);
  }
});
test('malformed read counts always close once', () => {
  for (const returned of [-1, 4097, 0.5, NaN, '1']) {
    const f = fixture({ hook(method) { if (method === 'read') return returned; } });
    stopped(f.run(), 'E_IO'); assert.equal(f.closed.length, 1);
  }
});
test('unexpected errors expose no paths, stacks, or proxy traps', () => {
  const f = fixture({ hook(method) { if (method === 'read') throw new Proxy({}, { get() { throw new Error('TRAP'); } }); } });
  stopped(f.run(), 'E_IO');
});
test('source has fixed own-PID inputs and no observer cache or write/enforcement interface', () => {
  const source = SOURCE_BYTES.helper.toString('utf8');
  assert.match(source, /export function observeOwnCgroupAncestry\(\)/);
  assert.match(source, /Buffer\.alloc\(65537\)/); assert.match(source, /Buffer\.alloc\(4096\)/);
  assert.doesNotMatch(source, /process\.env|\/proc\/self|\/proc\/1\/|realpath|readlink|readdir|mkdir|writeFile|child_process|observeContainmentMetadata\(/);
  assert.equal((source.match(/Buffer\.alloc\(/g) ?? []).length, 2);
  const f = fixture(); f.run(); const a = f.run(); assert.equal(a.status, 'OWN_CGROUP_METADATA_OBSERVED');
  assert.equal(a.counts.openAttempts, 20);
});

function operationFixture(options = {}) {
  const own = fixture(), owned = new Map(), calls = [], closed = [];
  const paths = new Map(Object.entries(SOURCE_BYTES).map(([key, bytes]) => [BASE + (key === 'helper' ? 'own-cgroup-locator.mjs' : 'containment-metadata.mjs'), bytes]));
  let nextFd = 30, tick = 0n, loads = 0;
  const fileStat = file => stat(0o100444n, file.endsWith('/own-cgroup-locator.mjs') ? 10n : 11n, BigInt(paths.get(file).length));
  function hook(method, file) { calls.push([method, file]); return options.hook?.(method, file); }
  const fake = {
    constants: { O_RDONLY: 0, O_NOFOLLOW: 0x20000, O_NONBLOCK: 0x800 },
    lstatSync(file) { assert.ok(paths.has(file)); return hook('lstat', file) ?? fileStat(file); },
    openSync(file, flags) {
      hook('open', file); assert.ok(paths.has(file)); assert.equal(flags, 0x20800); assert.equal(owned.size, 0);
      const fd = nextFd++; owned.set(fd, { file, at: 0 }); return fd;
    },
    fstatSync(fd) { const file = owned.get(fd).file; return hook('fstat', file) ?? fileStat(file); },
    readSync(fd, target, offset, request, position) {
      assert.equal(position, null); assert.ok(request > 0 && request <= 4096);
      const record = owned.get(fd), replacement = hook('read', record.file);
      if (replacement !== undefined) return replacement;
      const source = options.corrupt ? Buffer.from(paths.get(record.file)) : paths.get(record.file);
      if (options.corrupt) source[0] ^= 1;
      const length = Math.min(options.chunk ?? Infinity, request, source.length - record.at);
      source.copy(target, offset, record.at, record.at + length); record.at += length; return length;
    },
    closeSync(fd) {
      const file = owned.get(fd).file; assert.ok(owned.delete(fd)); closed.push(fd); hook('close', file);
      if (options.closeError) throw osError('EACCES');
    },
  };
  const config = { fs: fake, now: () => { tick += 1000n; return tick; }, observation: own.config,
    load: async url => {
      loads++; assert.match(url, /^data:text\/javascript;base64,/);
      const linked = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
      assert.equal(hash(linked), PINS.linked.sha256); assert.doesNotMatch(linked.toString('utf8'), /from '\.\/containment-metadata\.mjs'/);
      return { observeOwnCgroupAncestryMock: observe, observeOwnCgroupAncestry() { throw new Error('PRODUCTION_FORBIDDEN'); } };
    } };
  return { config, fake, own, owned, calls, closed, loads: () => loads, run: () => operation(config) };
}
test('raw helper, unchanged parser dependency, and fully linked source pins match repository bytes', () => {
  const graph = capture(SOURCE_BYTES);
  for (const key of ['helper', 'dependency', 'linked']) {
    assert.equal(graph[key].length, PINS[key].bytes); assert.equal(hash(graph[key]), PINS[key].sha256);
  }
  assert.equal(PINS.dependency.bytes, 19928);
  assert.equal(PINS.dependency.sha256, '249480f9af1b172c83f5f554184df1cfd486d6e7b98a2af4d60ca6433efb6401');
  const inputs = { helper: Buffer.from(SOURCE_BYTES.helper), dependency: Buffer.from(SOURCE_BYTES.dependency) }, copy = capture(inputs);
  inputs.helper[0] ^= 1; assert.notEqual(inputs.helper[0], copy.helper[0]);
  assert.throws(() => capture(inputs), { code: 'E_SOURCE_PIN' });
});
test('capture rejects proxy, shared buffers, shadows, missing inputs and non-Buffer types', () => {
  for (const helper of [new Proxy(Buffer.alloc(0), { get() { throw new Error('TRAP'); } }),
    Buffer.from(new SharedArrayBuffer(PINS.helper.bytes)), new Uint8Array(PINS.helper.bytes)])
    assert.throws(() => capture({ helper, dependency: SOURCE_BYTES.dependency }), { code: 'E_SOURCE_PIN' });
  const helper = Buffer.from(SOURCE_BYTES.helper); Object.defineProperty(helper, 'buffer', { get() { throw new Error('TRAP'); } });
  assert.throws(() => capture({ helper, dependency: SOURCE_BYTES.dependency }), { code: 'E_SOURCE_PIN' });
  assert.throws(() => capture({ helper: SOURCE_BYTES.helper }), { code: 'E_SOURCE_PIN' });
});
test('registered mock capture closes both sources, links before import and calls only the mock entry', async () => {
  const f = operationFixture(), output = await f.run(), result = JSON.parse(output.text);
  assert.equal(output.exitCode, 0); assert.equal(result.mockOnly, true); assert.match(result.profile, /MOCK/);
  assert.equal(result.status, 'OWN_CGROUP_METADATA_OBSERVED'); assert.equal(result.pinScope, 'SOURCE_RECEIPT_NOT_AUTH');
  assert.equal(result.sourceAccountingComplete, true); assert.equal(result.observationAccountingComplete, true);
  assert.equal(f.closed.length, 2); assert.equal(f.owned.size, 0); assert.equal(f.loads(), 1);
  assert.match(output.text, /^[\x20-\x7e]*\n$/); assert.ok(Buffer.byteLength(output.text) <= 65536);
  assert.equal(result.counts.observationCalls, 1); assert.equal(result.result.mockOnly, true);
  assert.equal(result.delegationCandidate, true); assert.equal(result.result.delegationCandidate, true);
  assert.equal(result.rootProfileOnly, false); assert.equal(result.ownAncestryOnly, true);
  assert.equal(result.result.rootProfileOnly, false); assert.equal(result.result.ownAncestryOnly, true);
});
test('registered no-candidate observation preserves false delegation and own-ancestry scope', async () => {
  const f = operationFixture();
  f.config.observation = fixture({ access: { [ROOT + '/team/leaf']: 'EACCES', [ROOT + '/team']: 'EACCES', [ROOT]: 'EACCES' } }).config;
  const output = await f.run(), result = JSON.parse(output.text);
  assert.equal(output.exitCode, 0); assert.equal(result.result.candidate, null);
  assert.equal(result.delegationCandidate, false); assert.equal(result.result.delegationCandidate, false);
  assert.equal(result.rootProfileOnly, false); assert.equal(result.ownAncestryOnly, true);
});
test('registered output-size failure resets the positive delegation receipt after successful capture and observation', async () => {
  const f = operationFixture();
  f.config.load = async () => ({ observeOwnCgroupAncestryMock(config) {
    const result = observe(config); assert.equal(result.delegationCandidate, true);
    return { ...result, padding: 'X'.repeat(65536) };
  } });
  const output = await f.run(), result = JSON.parse(output.text);
  assert.equal(output.exitCode, 1); assert.equal(result.error, 'E_OUTPUT'); assert.equal(result.result, null);
  assert.equal(result.delegationCandidate, false); assert.equal(result.observationAccountingComplete, false);
  assert.equal(result.sourceAccountingComplete, true); assert.equal(result.counts.observationCalls, 1);
  assert.equal(result.rootProfileOnly, false); assert.equal(result.ownAncestryOnly, true);
  assert.equal(result.scope, 'DATA_NOT_PERMISSION'); assert.equal(result.containmentEstablished, false);
});
test('registered late output clock failure clears the positive delegation receipt', async () => {
  const baseline = JSON.parse((await operationFixture().run()).text);
  assert.equal(baseline.delegationCandidate, true);
  const f = operationFixture(); let calls = 0;
  f.config.now = () => ++calls < baseline.counts.clockReadAttempts ? 0n : 11000000000n;
  const output = await f.run(), result = JSON.parse(output.text);
  assert.equal(output.exitCode, 1); assert.equal(result.error, 'E_DEADLINE'); assert.equal(result.result, null);
  assert.equal(result.delegationCandidate, false); assert.equal(result.sourceAccountingComplete, true);
  assert.equal(result.counts.clockReadAttempts, baseline.counts.clockReadAttempts);
  assert.equal(result.rootProfileOnly, false); assert.equal(result.ownAncestryOnly, true);
});
for (const override of [{ delegationCandidate: false }, { candidate: null }, { snapshotAgreement: false },
  { rootProfileOnly: true }, { ownAncestryOnly: false }])
  test('registered receipt validation rejects inconsistent scope/candidate metadata: ' + JSON.stringify(override), async () => {
    const f = operationFixture();
    f.config.load = async () => ({ observeOwnCgroupAncestryMock(config) { return { ...observe(config), ...override }; } });
    const output = await f.run(), result = JSON.parse(output.text);
    assert.equal(output.exitCode, 1); assert.equal(result.error, 'E_RESULT'); assert.equal(result.result, null);
    assert.equal(result.delegationCandidate, false);
  });
test('private linked graph imports and runs only against complete mock filesystem dependencies', async () => {
  const graph = capture(SOURCE_BYTES), module = await import('data:text/javascript;base64,' + graph.linked.toString('base64'));
  const f = fixture(), result = module.observeOwnCgroupAncestryMock(f.config);
  assert.equal(result.mockOnly, true); assert.equal(result.status, 'OWN_CGROUP_METADATA_OBSERVED');
});
test('source capture rejects exact-size drift before open or allocation', async () => {
  const f = operationFixture({ hook(method) { if (method === 'lstat') return stat(0o100444n, 1n, 0n); } });
  const result = JSON.parse((await f.run()).text); assert.equal(result.error, 'E_SOURCE_PIN');
  assert.equal(result.counts.sourceOpenAttempts, 0); assert.equal(f.loads(), 0);
});
test('source symlink is rejected before opening', async () => {
  const f = operationFixture({ hook(method) { if (method === 'lstat') return stat(0o120777n, 1n, BigInt(PINS.helper.bytes)); } });
  const result = JSON.parse((await f.run()).text); assert.equal(result.error, 'E_SOURCE_METADATA'); assert.equal(f.closed.length, 0);
});
test('source named SECURITY6 drift after EOF prevents import and closes once', async () => {
  let seen = 0;
  const f = operationFixture({ hook(method) {
    if (method === 'lstat' && ++seen === 2) return stat(0o100444n, 999n, BigInt(PINS.helper.bytes));
  } });
  const result = JSON.parse((await f.run()).text); assert.equal(result.error, 'E_SOURCE_METADATA');
  assert.equal(f.closed.length, 1); assert.equal(f.loads(), 0);
});
test('source oversized read count does not escape the captured source bound', async () => {
  const f = operationFixture({ hook(method) { if (method === 'read') return 4097; } });
  const result = JSON.parse((await f.run()).text); assert.equal(result.error, 'E_SOURCE_IO');
  assert.equal(f.closed.length, 1); assert.equal(f.loads(), 0);
});
test('source capture cannot substitute an accessor-backed size', async () => {
  const f = operationFixture({ hook(method) {
    if (method === 'lstat') {
      const raw = stat(); Object.defineProperty(raw, 'size', { get() { throw new Error('TRAP'); } }); return raw;
    }
  } });
  const result = JSON.parse((await f.run()).text); assert.equal(result.error, 'E_SOURCE_METADATA'); assert.equal(f.closed.length, 0);
});
test('source pin mismatch forbids import and observation', async () => {
  const f = operationFixture({ corrupt: true }), result = JSON.parse((await f.run()).text);
  assert.equal(result.error, 'E_SOURCE_PIN'); assert.equal(f.loads(), 0); assert.equal(result.result, null);
});
test('source EOF capture handles partial reads rather than assuming short-read EOF', async () => {
  const f = operationFixture({ chunk: 2048 }), result = JSON.parse((await f.run()).text);
  assert.equal(result.status, 'OWN_CGROUP_METADATA_OBSERVED'); assert.ok(result.counts.sourceReadAttempts > 20);
  assert.equal(result.counts.sourceReturnedReadBytes, PINS.helper.bytes + PINS.dependency.bytes);
});
test('source read amplification has a fixed bounded stop and one close', async () => {
  const f = operationFixture({ chunk: 1 }), result = JSON.parse((await f.run()).text);
  assert.equal(result.status, 'STOP'); assert.equal(result.error, 'E_LIMIT');
  assert.ok(result.counts.sourceRequestedReadBytes <= 131072); assert.ok(result.counts.sourceReadAttempts <= 64);
  assert.equal(f.closed.length, 1); assert.equal(f.loads(), 0);
});
test('source close failure is absorbing and prevents opening the dependency', async () => {
  let closed = false;
  const f = operationFixture({ closeError: true, hook(method) { if (method === 'close') closed = true; } });
  f.config.now = () => { if (closed) throw new Error('PRIVATE_CLOCK'); return 0n; };
  const result = JSON.parse((await f.run()).text); assert.equal(result.error, 'E_SOURCE_CLOSE');
  assert.equal(f.closed.length, 1); assert.equal(result.counts.sourceOpenAttempts, 1); assert.equal(f.loads(), 0);
});
test('source deadline performs positive close without waiting for another clock allowance', async () => {
  let reading = false;
  const f = operationFixture({ hook(method) { if (method === 'read') reading = true; } });
  f.config.now = () => reading ? 1000000000n : 0n;
  const result = JSON.parse((await f.run()).text); assert.equal(result.error, 'E_DEADLINE');
  assert.equal(f.closed.length, 1); assert.equal(f.owned.size, 0);
});
test('wrapper final eleven-second envelope suppresses a late observation', async () => {
  const f = operationFixture(); let observed = false;
  f.config.load = async () => ({ observeOwnCgroupAncestryMock(config) { const result = observe(config); observed = true; return result; } });
  f.config.now = () => observed ? 11000000000n : 0n;
  const result = JSON.parse((await f.run()).text); assert.equal(result.error, 'E_DEADLINE'); assert.equal(result.result, null);
});
test('mock operation cannot omit its loader, fs, clock, or observation dependencies', async () => {
  for (const key of ['fs', 'now', 'load', 'observation']) {
    const f = operationFixture(); delete f.config[key];
    const result = JSON.parse((await f.run()).text); assert.equal(result.error, 'E_MOCK_TCB');
  }
});
test('Unicode selected candidate is escaped to bounded ASCII by the registered operation', async () => {
  const f = operationFixture(), dir = ROOT + '/caf\u00e9';
  f.config.observation = fixture({ membership: '0::/private/caf\u00e9\n', directories: [dir, ROOT] }).config;
  const output = await f.run(); assert.equal(output.exitCode, 0); assert.match(output.text, /^[\x20-\x7e]*\n$/);
  assert.match(output.text, /caf\\u00e9/); assert.equal(JSON.parse(output.text).result.candidate.directory, dir);
});
test('registered production wrapper has no configurable paths or direct source-path import', () => {
  const source = fs.readFileSync(new URL('./own-cgroup-locator-operation.mjs', import.meta.url), 'utf8');
  assert.match(source, /export async function runRegisteredOwnCgroupLocator\(\)/);
  assert.match(source, /load: url => import\(url\)/);
  assert.doesNotMatch(source, /readFileSync|process\.env|child_process|mkdir|writeFile|\/proc\//);
  assert.match(source, /argumentCount === \(mockOnly \? 1 : 0\)/);
});
