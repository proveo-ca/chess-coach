// SPEC: _spec/tooling/native-ingress/step2.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { CONTAINMENT_METADATA_LIMITS as LIMITS, observeContainmentMetadataMock as observe,
  parseContainmentMountinfo as mountinfo, parseContainmentStatus as status,
  parseContainmentMembership as membership, parseContainmentControllers as controllers,
  parseContainmentLimit as limit, parseContainmentCpuMax as cpu } from './containment-metadata.mjs';
import { CONTAINMENT_METADATA_SOURCE_PIN as PIN,
  captureRegisteredContainmentMetadataSource as capture } from './containment-metadata-operation.mjs';

const ROOT = '/sys/fs/cgroup';
const PATHS = ['/proc/123/mountinfo', '/proc/123/status', '/proc/123/cgroup',
  ROOT + '/cgroup.controllers', ROOT + '/cgroup.subtree_control', ROOT + '/memory.max', ROOT + '/pids.max', ROOT + '/cpu.max'];
const MOUNT = '31 20 0:28 / /sys/fs/cgroup rw,nosuid,nodev,noexec,relatime - cgroup2 hidden-source rw\n';
const STATUS = 'Name:\tTOP_SECRET\nNoNewPrivs:\t0\nSeccomp:\t2\nCapEff:\t0000000000000000\n';
const BODIES = [MOUNT, STATUS, '0::/secret/membership:component\n', 'memory pids cpu io\n',
  'memory pids cpu\n', 'max\n', '256\n', 'max 100000\n'];
const stat = (mode = 0o100444n, dev = 90n, ino = 12n) => ({ dev, ino, mode, uid: 1000n, gid: 1000n, nlink: 1n,
  size: 0n, mtimeNs: 1n, ctimeNs: 1n });
const osError = code => Object.assign(new Error('DO_NOT_PRINT /secret/host/path'), { code });
const codeIs = expected => error => error?.code === expected && error.message === expected;

function fixture(options = {}) {
  const calls = [], owned = new Map(), openedPaths = [], closed = [];
  const bodies = new Map(PATHS.map((path, index) => [path, Buffer.from(options.bodies?.[index] ?? BODIES[index])]));
  let nextFd = 10, tick = 0n, peakOwned = 0;
  function hook(method, path, ...args) { calls.push([method, path, ...args]); return options.hook?.(method, path, ...args); }
  const fake = {
    constants: { O_RDONLY: 0, O_NOFOLLOW: 0x20000, O_NONBLOCK: 0x800, W_OK: 2 },
    lstatSync(path, flags) {
      assert.equal(flags.bigint, true); const replacement = hook('lstat', path);
      if (replacement !== undefined) return replacement;
      assert.ok(path === ROOT || PATHS.includes(path));
      return path === ROOT ? stat(options.rootMode ?? 0o040755n, 999n, 100n) : stat();
    },
    accessSync(path, mode) {
      assert.equal(path, ROOT); assert.equal(mode, 2); hook('access', path);
      if (options.accessError) throw osError(options.accessError);
    },
    openSync(path, flags) {
      hook('open', path); assert.ok(PATHS.includes(path)); assert.equal(flags, 0x20800);
      if (options.openError?.[path]) throw osError(options.openError[path]);
      assert.equal(owned.size, 0);
      const fd = nextFd++; owned.set(fd, { path, at: 0 }); openedPaths.push(path);
      peakOwned = Math.max(peakOwned, owned.size); return fd;
    },
    fstatSync(fd, flags) {
      assert.equal(flags.bigint, true); const path = owned.get(fd).path;
      return hook('fstat', path, fd) ?? stat();
    },
    readSync(fd, target, offset, length, position) {
      assert.equal(position, null); assert.equal(offset, 0); assert.ok(length > 0 && length <= 4096);
      const file = owned.get(fd), replacement = hook('read', file.path, length, fd);
      if (replacement !== undefined) return replacement;
      const source = bodies.get(file.path);
      const chunk = typeof options.chunk === 'function' ? options.chunk(file.path, file.at, length) : options.chunk ?? Infinity;
      const size = Math.min(length, chunk, source.length - file.at);
      source.copy(target, offset, file.at, file.at + size); file.at += size;
      return size;
    },
    closeSync(fd) {
      assert.ok(owned.has(fd)); const path = owned.get(fd).path;
      owned.delete(fd); closed.push(fd); hook('close', path, fd);
      if (options.closeError) throw osError('EACCES');
    },
  };
  const config = { fs: fake, pid: 123, now: () => { tick += options.tick ?? 1000n; return tick; } };
  return { fake, config, calls, owned, openedPaths, closed, bodies, peakOwned: () => peakOwned,
    run: () => observe(config) };
}

function stopped(result, code) {
  assert.equal(result.status, 'STOP'); assert.equal(result.error, code);
  assert.equal(result.observations, null); assert.equal(result.delegationCandidate, false);
  assert.equal(result.accountingComplete, false); assert.equal(result.containmentEstablished, false);
  assert.doesNotMatch(JSON.stringify(result), /DO_NOT_PRINT|secret\/host|Error:|stack/);
}

test('mock profile remains distinct and all readiness flags stay false', () => {
  const f = fixture(), result = f.run();
  assert.equal(result.status, 'MOCK_CONTAINMENT_METADATA_OBSERVED'); assert.equal(result.mockOnly, true);
  assert.equal(result.delegationCandidate, true); assert.equal(result.accountingComplete, true);
  assert.equal(result.scope, 'CONTAINMENT_METADATA_NOT_ENFORCEMENT_PROOF');
  for (const key of ['nativeQualified', 'rustReady', 'trainingReady', 'containmentEstablished',
    'childCgroupManagementProven', 'ancestorProtectionProven', 'atomicSnapshotGuaranteed', 'hardDeadlineGuaranteed']) assert.equal(result[key], false);
  assert.equal(result.unsupportedContext, false); assert.equal(result.rootProfileOnly, true);
  assert.equal(f.peakOwned(), 1); assert.equal(f.owned.size, 0); assert.equal(f.closed.length, 8);
  assert.equal(result.counts.rootLstatAttempts, 1); assert.equal(result.counts.rootAccessAttempts, 1);
  assert.deepEqual(f.openedPaths, PATHS); assert.equal(result.counts.checkedFiles, 8);
});

test('mountinfo publishes only the exact mountpoint without source, root, or unrelated entries', () => {
  const other = '32 20 0:29 /SECRET_ROOT /hidden/path rw - tmpfs SECRET_SOURCE rw\n';
  const parsed = mountinfo(other + MOUNT.replace('/ /sys', '/PRIVATE_ROOT /sys'));
  assert.deepEqual(parsed, { exactMatchCount: 1, ambiguous: false,
    record: { mountpoint: ROOT, fsType: 'cgroup2', mountReadOnly: false, superblockReadOnly: false } });
  assert.doesNotMatch(JSON.stringify(parsed), /SECRET|PRIVATE|hidden-source|tmpfs/);
});

test('an exact cgroup2 mount accepts a dash source without publishing it', () => {
  const parsed = mountinfo(MOUNT.replace('hidden-source', '-'));
  assert.deepEqual(parsed, mountinfo(MOUNT));
  assert.deepEqual(Object.keys(parsed.record), ['mountpoint', 'fsType', 'mountReadOnly', 'superblockReadOnly']);
  assert.doesNotMatch(JSON.stringify(parsed), /source|"-"/);
});

test('an unrelated mount accepts a dash source and remains fully redacted', () => {
  const other = '32 20 0:29 /SECRET_ROOT /hidden/path rw - tmpfs - rw\n';
  const parsed = mountinfo(other + MOUNT);
  assert.deepEqual(parsed, mountinfo(MOUNT));
  assert.doesNotMatch(JSON.stringify(parsed), /SECRET|hidden|tmpfs|source|"-"/);
});

test('dash mount sources leave pre-separator optional-field validation intact', () => {
  const body = MOUNT.replace(' - cgroup2 hidden-source', ' shared:4 master:2 - cgroup2 -');
  assert.deepEqual(mountinfo(body), mountinfo(MOUNT));
  assert.throws(() => mountinfo(body.replace('shared:4', 'shared:not-numeric')), codeIs('E_SYNTAX'));
  assert.throws(() => mountinfo(body.replace('master:2', 'shared:5')), codeIs('E_SYNTAX'));
});

test('mocked exact and unrelated dash-source mounts preserve candidate gates and redaction', () => {
  const other = '32 20 0:29 /SECRET_ROOT /hidden/path rw - tmpfs - rw\n';
  const f = fixture({ bodies: [other + MOUNT.replace('hidden-source', '-')] }), result = f.run();
  assert.equal(result.status, 'MOCK_CONTAINMENT_METADATA_OBSERVED');
  assert.equal(result.delegationCandidate, true); assert.equal(result.accountingComplete, true);
  assert.deepEqual(result.observations.mountinfo.value, mountinfo(MOUNT));
  assert.doesNotMatch(JSON.stringify(result.observations.mountinfo), /SECRET|hidden|tmpfs|source|"-"/);
  assert.deepEqual(f.openedPaths, PATHS); assert.equal(f.closed.length, 8);
  for (const key of ['nativeQualified', 'rustReady', 'trainingReady', 'containmentEstablished']) assert.equal(result[key], false);
});

test('mocked dash-source read-only cgroup mounts still block delegation', () => {
  const body = MOUNT.replace('hidden-source rw', '- ro'), result = fixture({ bodies: [body] }).run();
  assert.equal(result.status, 'MOCK_CONTAINMENT_METADATA_OBSERVED');
  assert.equal(result.observations.mountinfo.value.record.superblockReadOnly, true);
  assert.equal(result.delegationCandidate, false); assert.ok(result.blockers.includes('CGROUP_MOUNT_READ_ONLY'));
  assert.equal(result.containmentEstablished, false);
});

test('mocked extra separators with a wrong field count still stop and close once', () => {
  const f = fixture({ bodies: [MOUNT.replace(' - cgroup2', ' - - cgroup2')] });
  stopped(f.run(), 'E_SYNTAX'); assert.equal(f.closed.length, 1); assert.equal(f.owned.size, 0);
});

test('Linux mountinfo escaping decodes only the four defined octal sequences', () => {
  for (const escape of ['040', '011', '012', '134']) {
    const other = `32 20 0:29 /a\\${escape}b /different\\${escape}path rw - tmpfs hidden rw\n`;
    assert.equal(mountinfo(other + MOUNT).exactMatchCount, 1);
  }
  assert.equal(mountinfo(MOUNT.replace(ROOT, '/sys/fs\\134cgroup')).record, null);
  assert.throws(() => mountinfo(MOUNT.replace(ROOT, '/sys/fs\\057cgroup')), codeIs('E_SYNTAX'));
});

test('mountpoint matching never normalizes dot segments, double slash, or trailing slash', () => {
  for (const path of ['/sys//fs/cgroup', '/sys/fs/./cgroup', ROOT + '/', '/sys/fs/a/../cgroup'])
    assert.equal(mountinfo(MOUNT.replace(ROOT, path)).exactMatchCount, 0);
});

test('valid mount options can contain escaped paths and non-alphanumeric option values', () => {
  const body = MOUNT.replace('hidden-source rw', 'hidden-source rw,example=/some\\040path,context=user@domain%value');
  assert.equal(mountinfo(body).record.superblockReadOnly, false);
  assert.doesNotMatch(JSON.stringify(mountinfo(body)), /example|some|domain/);
});

test('multiple exact RW matches are ambiguous and cannot produce a candidate', () => {
  const f = fixture({ bodies: [MOUNT + MOUNT.replace('31 ', '32 ')] }), result = f.run();
  assert.equal(result.status, 'MOCK_CONTAINMENT_METADATA_OBSERVED');
  assert.equal(result.observations.mountinfo.value.ambiguous, true);
  assert.equal(result.observations.mountinfo.value.record, null); assert.equal(result.delegationCandidate, false);
});

for (const [name, body] of [
  ['mount read-only', MOUNT.replace('rw,nosuid', 'ro,nosuid')],
  ['superblock read-only', MOUNT.replace('hidden-source rw', 'hidden-source ro')],
]) test(name + ' blocks the candidate', () => {
  const result = fixture({ bodies: [body] }).run();
  assert.equal(result.delegationCandidate, false); assert.ok(result.blockers.includes('CGROUP_MOUNT_READ_ONLY'));
});

test('a different filesystem at the exact mountpoint cannot qualify', () => {
  const result = fixture({ bodies: [MOUNT.replace('cgroup2', 'tmpfs')] }).run();
  assert.equal(result.delegationCandidate, false); assert.equal(result.observations.mountinfo.value.record, null);
});

for (const [name, body] of [
  ['empty', ''], ['bad ID', MOUNT.replace('31 ', '-1 ')], ['overflow ID', MOUNT.replace('31 ', '4294967296 ')],
  ['bad device', MOUNT.replace('0:28', '0:no')], ['extra separator', MOUNT.replace(' - cgroup2', ' - - cgroup2')],
  ['missing separator', MOUNT.replace(' - ', ' ')], ['extra field', MOUNT.trimEnd() + ' extra\n'],
  ['bad options', MOUNT.replace('rw,nosuid', 'rw,ro,nosuid')], ['literal tab', MOUNT.replace('hidden-source', 'hidden\tsource')],
  ['bad escape', MOUNT.replace('hidden-source', 'hidden\\777source')],
]) test('mountinfo rejects ' + name, () => assert.throws(() => mountinfo(body), codeIs('E_SYNTAX')));

test('status redacts other fields and publishes only selected capability bits', () => {
  const parsed = status(STATUS.replace('0000000000000000', 'ffffffffffffffff') + 'SeccompX\nUid:\t1234\n');
  assert.deepEqual(parsed, { noNewPrivs: 0, seccomp: 2, capabilities: {
    CAP_SYS_ADMIN: true, CAP_SYS_RESOURCE: true, CAP_SYS_PTRACE: true, CAP_DAC_OVERRIDE: true, CAP_NET_ADMIN: true } });
  assert.doesNotMatch(JSON.stringify(parsed), /TOP_SECRET|Uid|CapEff|ffffffff|Landlock/);
});

test('an unrelated capability bit does not leak or set the selected bits', () => {
  assert.ok(Object.values(status(STATUS.replace('0000000000000000', '1')).capabilities).every(value => value === false));
  for (const [name, bit] of Object.entries({ CAP_SYS_ADMIN: 21, CAP_SYS_RESOURCE: 24, CAP_SYS_PTRACE: 19, CAP_DAC_OVERRIDE: 1, CAP_NET_ADMIN: 12 })) {
    const caps = status(STATUS.replace('0000000000000000', (1n << BigInt(bit)).toString(16))).capabilities;
    for (const [key, value] of Object.entries(caps)) assert.equal(value, key === name);
  }
});

for (const field of ['NoNewPrivs', 'Seccomp', 'CapEff']) {
  test('status requires ' + field, () => assert.throws(() => status(STATUS.replace(new RegExp(field + ':[^\n]*\n'), '')), codeIs('E_SYNTAX')));
  test('status rejects duplicate ' + field, () => assert.throws(() => status(STATUS + field + ':\t0\n'), codeIs('E_SYNTAX')));
}

for (const [before, after] of [['NoNewPrivs:\t0', 'NoNewPrivs:\t2'], ['Seccomp:\t2', 'Seccomp:\t3'],
  ['CapEff:\t0000000000000000', 'CapEff:\t10000000000000000']])
  test('status rejects invalid ' + before.split(':')[0], () => assert.throws(() => status(STATUS.replace(before, after)), codeIs('E_SYNTAX')));

test('membership keeps counts but no hierarchy paths, IDs, unknown controller names, or hashes', () => {
  const parsed = membership('0::/TOP_SECRET\n5:cpu,cpuacct:/other:secret\n6:memory,pids:/private\n7:name=SECRET:/named\n');
  assert.deepEqual(parsed, { entryCount: 4, unifiedEntryPresent: true, controllerEntryCounts: { memory: 1, pids: 1, cpu: 1 } });
  assert.doesNotMatch(JSON.stringify(parsed), /SECRET|other|private|cpuacct|hash|named/);
});

for (const body of ['', '0::relative\n', '0:cpu:/\n', '1::/\n', '1:cpu,cpu:/\n', '0::/\n0::/other\n', 'x:cpu:/\n'])
  test('membership rejects malformed fixture ' + JSON.stringify(body), () => assert.throws(() => membership(body), codeIs('E_SYNTAX')));

test('controller publication uses a closed set and an unknown count only', () => {
  assert.deepEqual(controllers('memory pids cpu SECRET\n'.toLowerCase()), { memory: true, pids: true, cpu: true, unknownTokenCount: 1 });
  assert.deepEqual(controllers('\n'), { memory: false, pids: false, cpu: false, unknownTokenCount: 0 });
});
for (const body of ['cpu cpu\n', 'cpu +memory\n', '+cpu\n', 'cpu cpu.unknown\n'])
  test('controller tokens reject ' + JSON.stringify(body), () => assert.throws(() => controllers(body), codeIs('E_SYNTAX')));

test('u64 limits remain exact decimal strings, including max and zero', () => {
  for (const value of ['max', '0', '1', '9007199254740993', '18446744073709551615']) assert.equal(limit(value + '\n'), value);
  assert.deepEqual(cpu('18446744073709551615 9007199254740993\n'), { quota: '18446744073709551615', period: '9007199254740993' });
  assert.deepEqual(cpu('max 1\n'), { quota: 'max', period: '1' });
});
for (const value of ['', '18446744073709551616', '1e3', '1.0', '-0', '-1', '+1', ' 1', '1\n\n', 'MAX', '01'])
  test('limit rejects ' + JSON.stringify(value), () => assert.throws(() => limit(value), codeIs('E_SYNTAX')));
for (const value of ['max 0', 'max', 'max 1 extra', 'max -0', 'max 1e3', '1.5 1', 'max max'])
  test('cpu.max rejects ' + JSON.stringify(value), () => assert.throws(() => cpu(value), codeIs('E_SYNTAX')));

test('pure parsers reject NUL, control bytes, invalid UTF8, and lone surrogates', () => {
  for (const parser of [mountinfo, status, membership, controllers, limit, cpu]) {
    for (const raw of [Buffer.from([0]), Buffer.from([13]), Buffer.from([127]), Buffer.from([0xc2, 0x85])])
      assert.throws(() => parser(raw), codeIs('E_SYNTAX'));
    assert.throws(() => parser(Buffer.from([0xff])), codeIs('E_UTF8'));
    assert.throws(() => parser('\ud800'), codeIs('E_UTF8'));
  }
});

test('pure native byte inputs reject proxies without invoking their traps', () => {
  const poison = new Proxy(Buffer.from('max'), { get() { throw new Error('TRAP'); }, getPrototypeOf() { throw new Error('TRAP'); } });
  assert.throws(() => limit(poison), codeIs('E_BYTES'));
  assert.throws(() => limit(new Uint16Array([1])), codeIs('E_BYTES'));
  assert.throws(() => limit(Buffer.from(new SharedArrayBuffer(8))), codeIs('E_BYTES'));
  if (Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable'))
    assert.throws(() => limit(new Uint8Array(new ArrayBuffer(3, { maxByteLength: 4 }))), codeIs('E_BYTES'));
});

test('pure byte bounds and branded shadowing fail with fixed codes', () => {
  assert.throws(() => controllers('a'.repeat(4097)), codeIs('E_LENGTH'));
  const raw = Buffer.from('max'); Object.defineProperty(raw, 'length', { get() { throw new Error('TRAP'); } });
  assert.throws(() => limit(raw), codeIs('E_BYTES'));
});

for (const error of ['ENOENT', 'EACCES', 'EPERM', 'EROFS'])
  test('root W_OK ' + error + ' stays unavailable without writes or losing file observations', () => {
    const f = fixture({ accessError: error }), result = f.run();
    assert.equal(result.status, 'MOCK_CONTAINMENT_METADATA_OBSERVED'); assert.equal(result.accountingComplete, true);
    assert.equal(result.observations.rootWriteAccess.reason, error); assert.equal(result.delegationCandidate, false);
    assert.equal(result.observations.cpuMax.status, 'OBSERVED'); assert.deepEqual(f.openedPaths, PATHS);
    assert.equal(result.counts.rootAccessAttempts, 1);
  });

for (const mode of [0o120777n, 0o100644n, 0o020600n])
  test('non-directory root ' + mode.toString(8) + ' stays unavailable and never qualifies', () => {
    const f = fixture({ rootMode: mode }), result = f.run();
    assert.equal(result.observations.root.reason, 'NOT_REAL_DIRECTORY'); assert.equal(result.delegationCandidate, false);
    assert.equal(result.counts.rootAccessAttempts, 1); assert.equal(result.counts.openAttempts, 8);
  });

test('root lstat ENOENT does not skip the one access attempt or fixed file list', () => {
  const f = fixture({ hook(method, path) { if (method === 'lstat' && path === ROOT) throw osError('ENOENT'); } });
  const result = f.run(); assert.equal(result.observations.root.reason, 'ENOENT');
  assert.equal(result.counts.rootLstatAttempts, 1); assert.equal(result.counts.rootAccessAttempts, 1);
  assert.deepEqual(f.openedPaths, PATHS); assert.equal(result.delegationCandidate, false);
});

test('root and per-file device IDs remain independent without a cross-device policy', () => {
  const result = fixture().run(); assert.equal(result.delegationCandidate, true);
  assert.equal(result.observations.root.value.dev, '999');
  assert.doesNotMatch(JSON.stringify(result.observations), /"dev":"90"|"ino":"12"/);
});

for (const index of [3, 4]) test('missing required ' + ['controllers', 'enabled subtree'][index - 3] + ' blocks candidate', () => {
  const bodies = [...BODIES]; bodies[index] = 'memory pids\n';
  const result = fixture({ bodies }).run(); assert.equal(result.delegationCandidate, false);
  assert.ok(result.blockers.includes(index === 3 ? 'CGROUP_CONTROLLERS_UNAVAILABLE' : 'CGROUP_CONTROLLERS_NOT_ENABLED'));
});

for (const index of [0, 1, 2, 3, 4, 5, 6, 7]) test('expected missing resource ' + index + ' continues every fixed path without retry', () => {
  const f = fixture({ openError: { [PATHS[index]]: ['ENOENT', 'EACCES', 'EPERM', 'EROFS'][index % 4] } }), result = f.run();
  assert.equal(result.status, 'MOCK_CONTAINMENT_METADATA_OBSERVED'); assert.equal(result.accountingComplete, true);
  assert.equal(result.delegationCandidate, false); assert.equal(result.counts.openAttempts, 8);
  assert.equal(result.counts.opensCompleted, 7); assert.equal(result.counts.closeAttempts, 7);
  assert.deepEqual(f.calls.filter(call => call[0] === 'open').map(call => call[1]), PATHS);
  assert.ok(result.blockers.includes('CGROUP_OBSERVATION_UNAVAILABLE')); assert.equal(result.unsupportedContext, false);
});

test('expected resource read failure closes that FD, preserves other observations, and never retries', () => {
  const f = fixture({ hook(method, path) { if (method === 'read' && path === PATHS[2]) throw osError('EPERM'); } });
  const result = f.run(); assert.equal(result.status, 'MOCK_CONTAINMENT_METADATA_OBSERVED');
  assert.equal(result.observations.membership.reason, 'EPERM'); assert.equal(result.observations.cpuMax.status, 'OBSERVED');
  assert.equal(result.delegationCandidate, false); assert.equal(result.accountingComplete, true);
  assert.equal(result.counts.closeAttempts, 8); assert.equal(result.counts.closesCompleted, 8);
  assert.equal(f.calls.filter(call => call[0] === 'read' && call[1] === PATHS[2]).length, 1);
});

test('expected named-stat denial continues the remaining fixed list without opening a denied file', () => {
  const f = fixture({ hook(method, path) { if (method === 'lstat' && path === PATHS[4]) throw osError('EACCES'); } });
  const result = f.run(); assert.equal(result.status, 'MOCK_CONTAINMENT_METADATA_OBSERVED');
  assert.equal(result.observations.subtreeControl.reason, 'EACCES'); assert.equal(result.counts.openAttempts, 7);
  assert.deepEqual(f.openedPaths, PATHS.filter(path => path !== PATHS[4])); assert.equal(result.delegationCandidate, false);
});

test('partial reads loop to EOF instead of treating a short pseudo-file read as EOF', () => {
  const f = fixture({ chunk: 13 }), result = f.run();
  assert.equal(result.delegationCandidate, true); assert.ok(result.counts.readAttempts > 16);
  assert.equal(result.counts.returnedReadBytes, BODIES.reduce((sum, body) => sum + Buffer.byteLength(body), 0));
  assert.equal(result.counts.acceptedReadBytes, result.counts.returnedReadBytes);
  assert.ok(result.counts.requestedReadBytes > result.counts.returnedReadBytes);
});

test('pseudo-file size zero and changing size/mtime do not imply a length or identity failure', () => {
  let sequence = 0;
  const result = fixture({ hook(method, path) {
    if ((method === 'fstat' || method === 'lstat') && path !== ROOT) return { ...stat(), size: BigInt(sequence++), mtimeNs: BigInt(sequence) };
  } }).run();
  assert.equal(result.delegationCandidate, true);
});

for (const field of ['dev', 'ino', 'mode', 'uid', 'gid', 'nlink'])
  test('source FD drift in SECURITY6 ' + field + ' stops and closes exactly once', () => {
    let count = 0;
    const f = fixture({ hook(method) { if (method === 'fstat' && ++count === 2) return { ...stat(), [field]: stat()[field] + 1n }; } });
    const result = f.run(); stopped(result, 'E_IDENTITY'); assert.equal(f.closed.length, 1); assert.equal(f.owned.size, 0);
  });

test('named-path drift after reading stops even if FD identity remains stable', () => {
  let count = 0;
  const f = fixture({ hook(method, path) { if (method === 'lstat' && path === PATHS[0] && ++count === 2) return stat(0o100444n, 90n, 13n); } });
  stopped(f.run(), 'E_IDENTITY'); assert.equal(f.closed.length, 1);
});

test('a final file symlink stops before opening that file', () => {
  const f = fixture({ hook(method, path) { if (method === 'lstat' && path === PATHS[0]) return stat(0o120777n); } });
  stopped(f.run(), 'E_METADATA'); assert.equal(f.closed.length, 0); assert.equal(f.openedPaths.length, 0);
});

test('malformed or accessor-backed metadata fails closed without invoking user getters', () => {
  const raw = stat(); Object.defineProperty(raw, 'ino', { get() { throw new Error('TRAP'); } });
  for (const replacement of [raw, { ...stat(), dev: 90 }, new Proxy(stat(), { get() { throw new Error('TRAP'); } })]) {
    const f = fixture({ hook(method) { if (method === 'fstat') return replacement; } });
    stopped(f.run(), 'E_METADATA'); assert.equal(f.closed.length, 1); assert.equal(f.owned.size, 0);
  }
});

test('sysfs exact-cap content uses a capped one-byte EOF probe and succeeds', () => {
  const bodies = [...BODIES]; bodies[3] = 'memory pids cpu' + ' '.repeat(4095 - 15);
  assert.equal(Buffer.byteLength(bodies[3]), 4095);
  bodies[3] += ' ';
  const f = fixture({ bodies }), result = f.run(); assert.equal(result.delegationCandidate, true);
  assert.deepEqual(f.calls.filter(call => call[0] === 'read' && call[1] === PATHS[3]).map(call => call[2]), [4096, 1]);
});

test('proc exact-cap content uses a capped EOF probe without size assumptions', () => {
  const bodies = [...BODIES]; bodies[1] = STATUS + 'X'.repeat(65536 - Buffer.byteLength(STATUS));
  const f = fixture({ bodies }), result = f.run(); assert.equal(result.delegationCandidate, true);
  const reads = f.calls.filter(call => call[0] === 'read' && call[1] === PATHS[1]);
  assert.equal(reads.at(-1)[2], 1); assert.equal(reads.length, 17);
});

for (const [index, maximum] of [[0, 65536], [3, 4096]]) test('cap plus one stops resource ' + index + ' and closes', () => {
  const bodies = [...BODIES]; bodies[index] = 'x'.repeat(maximum + 1);
  const f = fixture({ bodies }), result = f.run(); stopped(result, 'E_LENGTH');
  assert.equal(result.counts.returnedReadBytes - result.counts.acceptedReadBytes, 1);
  assert.equal(f.owned.size, 0); assert.equal(result.counts.closeAttempts, index + 1);
});

test('requested read budget stops short-read amplification before exceeding 240 KiB', () => {
  const f = fixture({ chunk: 1 }), result = f.run(); stopped(result, 'E_LIMIT');
  assert.ok(result.counts.requestedReadBytes <= 245760); assert.equal(result.counts.readAttempts, 60);
  assert.equal(result.counts.returnedReadBytes, 60); assert.equal(result.counts.acceptedReadBytes, 60);
  assert.equal(result.counts.closeAttempts, 1); assert.equal(f.owned.size, 0);
});

test('bounded file read attempts stop a non-EOF pseudo-file stream', () => {
  const bodies = [...BODIES]; bodies[3] = ' '.repeat(4096);
  const f = fixture({ bodies, chunk: 64 }), result = f.run(); stopped(result, 'E_LIMIT');
  assert.equal(f.calls.filter(call => call[0] === 'read' && call[1] === PATHS[3]).length, 64);
  assert.equal(f.closed.length, 4); assert.ok(result.counts.requestedReadBytes < LIMITS.requestedReadBytes);
});

test('global read-attempt limit stops at 256 before a 257th call even with remaining byte budget', () => {
  const bodies = [...BODIES];
  bodies[0] = MOUNT.replace('hidden-source', 'x'.repeat(65536 - MOUNT.length + 'hidden-source'.length));
  bodies[1] = STATUS + 'X'.repeat(65536 - STATUS.length);
  bodies[2] = '0::/' + 'x'.repeat(65536 - 4);
  bodies[3] = 'memory pids cpu' + ' '.repeat(4096 - 15);
  const f = fixture({ bodies, chunk(path, at, request) {
    const cap = PATHS.indexOf(path) < 3 ? 65536 : 4096, tail = cap === 65536 ? 47 : 62;
    return at < cap - tail ? Math.min(request, cap - tail - at) : 1;
  } });
  const result = f.run(); stopped(result, 'E_LIMIT');
  assert.equal(result.counts.readAttempts, 256); assert.ok(result.counts.requestedReadBytes < 245760);
  assert.equal(result.counts.closeAttempts, 5); assert.equal(f.owned.size, 0);
});

test('close failure is absorbing, clears ownership, and prevents retries or later opens', () => {
  const f = fixture({ closeError: true }), result = f.run(); stopped(result, 'E_CLOSE');
  assert.equal(result.counts.closeAttempts, 1); assert.equal(result.counts.closesCompleted, 0);
  assert.equal(f.closed.length, 1); assert.equal(f.owned.size, 0); assert.equal(f.openedPaths.length, 1);
});

test('close failure overrides an earlier read failure', () => {
  const f = fixture({ closeError: true, hook(method) { if (method === 'read') throw osError('EIO'); } });
  stopped(f.run(), 'E_CLOSE'); assert.equal(f.closed.length, 1);
});

test('close failure remains absorbing when the clock also fails during cleanup', () => {
  let closeSeen = false;
  const f = fixture({ closeError: true, hook(method) { if (method === 'close') closeSeen = true; } });
  f.config.now = () => { if (closeSeen) throw new Error('PRIVATE_CLOCK'); return 0n; };
  stopped(f.run(), 'E_CLOSE'); assert.equal(f.closed.length, 1);
});

test('reader exceptions and proxy error objects never leak text or invoke traps', () => {
  for (const failure of [new Error('DO_NOT_PRINT'), new Proxy({}, { get() { throw new Error('TRAP'); } })]) {
    const f = fixture({ hook(method) { if (method === 'read') throw failure; } });
    stopped(f.run(), 'E_IO'); assert.equal(f.closed.length, 1);
  }
});

test('invalid read counts stop and always close the owned FD', () => {
  for (const count of [-1, 4097, 0.5, NaN, '1']) {
    const f = fixture({ hook(method) { if (method === 'read') return count; } });
    stopped(f.run(), 'E_IO'); assert.equal(f.closed.length, 1);
  }
});

test('deadline starts before PID validation and before the first filesystem operation', () => {
  const f = fixture(); let call = 0;
  f.config.now = () => ++call === 1 ? 0n : 4000000000n;
  stopped(f.run(), 'E_DEADLINE'); assert.equal(f.calls.length, 0);
});

test('deadline during a read closes the FD without another clock-gated cleanup operation', () => {
  let reading = false;
  const f = fixture({ hook(method) { if (method === 'read') reading = true; } });
  f.config.now = () => reading ? 4000000000n : 0n;
  stopped(f.run(), 'E_DEADLINE'); assert.equal(f.closed.length, 1); assert.equal(f.owned.size, 0);
});

test('clock exceptions after opening still close exactly once', () => {
  const f = fixture();
  f.config.now = () => { if (f.owned.size) throw new Error('PRIVATE_CLOCK'); return 0n; };
  stopped(f.run(), 'E_CLOCK'); assert.equal(f.closed.length, 1);
});

test('clock rollback, negative and non-bigint clocks fail closed', () => {
  for (const bad of [-1n, 0, NaN]) {
    const f = fixture(); f.config.now = () => bad; stopped(f.run(), 'E_CLOCK'); assert.equal(f.calls.length, 0);
  }
  const f = fixture(); let call = 0; f.config.now = () => ++call === 1 ? 2n : 1n;
  stopped(f.run(), 'E_CLOCK'); assert.equal(f.calls.length, 0);
});

test('malformed selected observations stop and suppress every prior observation', () => {
  const bodies = [...BODIES]; bodies[7] = 'not-valid\n';
  const f = fixture({ bodies }); stopped(f.run(), 'E_SYNTAX'); assert.equal(f.closed.length, 8);
});

test('invalid PIDs stop before fs access with no raw coercion', () => {
  for (const pid of [0, -1, 4294967296, 1.5, '123', NaN, {}, new Proxy({}, { get() { throw new Error('TRAP'); } })]) {
    const f = fixture(); f.config.pid = pid; stopped(f.run(), 'E_PID'); assert.equal(f.calls.length, 0);
  }
});

test('mock dependencies are mandatory and never inherit production fs, clock, or PID', () => {
  for (const key of ['fs', 'now', 'pid']) {
    const f = fixture(); delete f.config[key];
    stopped(f.run(), key === 'pid' ? 'E_PID' : 'E_MOCK_TCB'); assert.equal(f.calls.length, 0);
  }
  const proxy = new Proxy({}, { get() { throw new Error('TRAP'); } }); stopped(observe(proxy), 'E_MOCK_TCB');
  stopped(observe(), 'E_ARGUMENTS');
});

test('mock dependency getters are rejected without invocation', () => {
  const f = fixture(); Object.defineProperty(f.config, 'pid', { get() { throw new Error('TRAP'); } });
  stopped(f.run(), 'E_PID'); assert.equal(f.calls.length, 0);
  const g = fixture(); Object.defineProperty(g.fake, 'readSync', { get() { throw new Error('TRAP'); } });
  stopped(g.run(), 'E_MOCK_TCB'); assert.equal(g.calls.length, 0);
});

test('invalid read-only flag constants fail before any filesystem call', () => {
  for (const [key, value] of [['O_RDONLY', 1], ['O_NOFOLLOW', 0], ['O_NOFOLLOW', 1], ['O_NONBLOCK', 2],
    ['O_NONBLOCK', 3], ['O_NONBLOCK', 0x20000], ['W_OK', 4]]) {
    const f = fixture(); f.fake.constants[key] = value; stopped(f.run(), 'E_FLAGS'); assert.equal(f.calls.length, 0);
  }
});

test('flag constant getters are rejected without invoking them', () => {
  const f = fixture(); Object.defineProperty(f.fake.constants, 'O_NOFOLLOW', { get() { throw new Error('TRAP'); } });
  stopped(f.run(), 'E_FLAGS'); assert.equal(f.calls.length, 0);
});

test('one reusable body buffer and one scratch buffer bound live reader storage', () => {
  const source = fs.readFileSync(new URL('./containment-metadata.mjs', import.meta.url), 'utf8');
  assert.equal(source.match(/Buffer\.alloc\(65537\)/g)?.length, 1);
  assert.equal(source.match(/Buffer\.alloc\(4096\)/g)?.length, 1);
  assert.equal(LIMITS.bodyBufferBytes, 65537); assert.equal(LIMITS.scratchBytes, 4096);
});

test('successful output remains small ASCII and retains no raw source bodies', () => {
  const result = fixture().run(), serialized = JSON.stringify(result);
  assert.match(serialized, /^[\x20-\x7e]*$/); assert.ok(Buffer.byteLength(serialized) <= 16384);
  assert.doesNotMatch(serialized, /TOP_SECRET|secret\/membership|hidden-source|CapEff|"mtime|"ctime/);
  assert.equal(result.counts.openAttempts, 8); assert.equal(result.counts.opensCompleted, 8);
  assert.equal(result.counts.closeAttempts, 8); assert.equal(result.counts.closesCompleted, 8);
  assert.equal(result.counts.fsOperationAttempts, result.counts.fsOperationsCompleted);
  assert.ok(result.counts.fsOperationAttempts <= 1024); assert.ok(Object.isFrozen(result.observations.root.value));
});

test('source pin matches only repository helper bytes and captures a private copy', () => {
  const raw = fs.readFileSync(new URL('./containment-metadata.mjs', import.meta.url));
  assert.equal(raw.length, PIN.bytes); assert.equal(createHash('sha256').update(raw).digest('hex'), PIN.sha256);
  const captured = capture(raw); assert.notEqual(captured.buffer, raw.buffer);
  const original = captured[0]; raw[0] ^= 1; assert.equal(captured[0], original);
  assert.throws(() => capture(raw), codeIs('E_SOURCE_PIN'));
});

test('source capture rejects proxy, SAB, resizable backing and shadows before copying', () => {
  const proxy = new Proxy(Buffer.alloc(0), { get() { throw new Error('TRAP'); }, getPrototypeOf() { throw new Error('TRAP'); } });
  assert.throws(() => capture(proxy), codeIs('E_SOURCE_PIN'));
  assert.throws(() => capture(Buffer.from(new SharedArrayBuffer(PIN.bytes))), codeIs('E_SOURCE_PIN'));
  if (Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable'))
    assert.throws(() => capture(Buffer.from(new ArrayBuffer(PIN.bytes, { maxByteLength: PIN.bytes + 1 }))), codeIs('E_SOURCE_PIN'));
  const raw = Buffer.alloc(PIN.bytes); Object.defineProperty(raw, 'buffer', { get() { throw new Error('TRAP'); } });
  assert.throws(() => capture(raw), codeIs('E_SOURCE_PIN'));
  assert.throws(() => capture(new Uint8Array(PIN.bytes)), codeIs('E_SOURCE_PIN'));
});

test('operation has a zero-argument wrapper and a private captured-byte data import', () => {
  const source = fs.readFileSync(new URL('./containment-metadata-operation.mjs', import.meta.url), 'utf8');
  assert.match(source, /export async function runRegisteredContainmentMetadata\(\)/);
  assert.match(source, /arguments\.length !== 0/);
  assert.match(source, /import\('data:text\/javascript;base64,' \+ captured\.toString\('base64'\)\)/);
  assert.doesNotMatch(source, /readFileSync|child_process|process\.env|mkdir|writeFile|\/proc\//);
});
