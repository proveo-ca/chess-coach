// SPEC: _spec/tooling/native-ingress/xz-qualification.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import {
  XZ_STAGING_PROFILE as PROFILE, XzStagingError,
  stageXzImages, verifyStagedXzImages, assertNoSystemPreload,
} from './xz-staging.mjs';

const ROOT = '/tmp/opencode/f9-xz-qualification-01';
const pathOf = image => `${ROOT}/${image.name}`;
const error = code => Object.assign(new Error(code), { code });
const expectCode = code => value => value instanceof XzStagingError && value.code === code && value.message === code;
const stat = (ino, size, mode, dev = 56n, uid = 0n) => ({
  dev, ino, mode: BigInt(mode), uid, gid: 0n, nlink: mode === 0o040700 ? 2n : 1n,
  size: BigInt(size), mtimeNs: 1791560000000000000n, ctimeNs: 1791560000000000000n,
});

function metadata(image) {
  return {
    profile: 'elf64le-x86-64-requirements-v2', state: 'ELF_REQUIREMENTS_METADATA',
    byteLength: image.size, inputSha256: image.sha256, interpreter: image.interpreter,
    dynamic: { present: true, needed: [...image.needed], soname: image.soname,
      rpath: null, runpath: null, unknownTags: [{ tag: '7', value: '4096' }] },
    requirements: {
      versionNeeds: image.needed.map(file => ({ file, aux: [{ name: `${file}_VERSION` }] })),
      versionDefinitions: image.soname === null ? [] : [{ names: [`${image.soname}_VERSION`] }],
    },
  };
}

function fixture() {
  const nodes = new Map(PROFILE.images.map((image, index) => [image.source, {
    data: Buffer.alloc(image.size), stat: stat(BigInt(295 + index), image.size, image.sourceMode, index % 2 ? 82n : 56n),
  }]));
  const handles = new Map();
  const log = [];
  let nextFd = 20;
  const env = { nodes, handles, log, hook: null, metadataHook: null, hashHook: null };
  const node = path => {
    if (!nodes.has(path)) throw error('ENOENT');
    return nodes.get(path);
  };
  const handle = fd => {
    assert.ok(handles.has(fd), `unowned mock descriptor ${fd}`);
    return handles.get(fd);
  };
  const tick = value => { value.stat.mtimeNs++; value.stat.ctimeNs++; };
  const methods = {
    lstatSync(path, options) {
      assert.deepEqual(options, { bigint: true });
      return { ...node(path).stat };
    },
    fstatSync(fd, options) {
      assert.deepEqual(options, { bigint: true });
      return { ...handle(fd).node.stat };
    },
    openSync(path, flags, mode) {
      if (flags & constants.O_CREAT) {
        assert.equal(flags, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW | constants.O_NONBLOCK);
        assert.equal(mode, 0o600);
        if (nodes.has(path)) throw error('EEXIST');
        const index = PROFILE.images.findIndex(image => pathOf(image) === path);
        assert.ok(index >= 0);
        nodes.set(path, { data: Buffer.alloc(PROFILE.images[index].size),
          stat: stat(BigInt(700 + index), 0, 0o100600, BigInt(100 + index), node(ROOT).stat.uid) });
        tick(node(ROOT));
      } else {
        assert.equal(flags, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK |
          (path === ROOT ? constants.O_DIRECTORY : 0));
        assert.equal(mode, undefined);
      }
      const fd = nextFd++;
      handles.set(fd, { path, node: node(path) });
      return fd;
    },
    closeSync(fd) {
      handle(fd);
      handles.delete(fd);
    },
    readSync(fd, buffer, offset, length, position) {
      const value = handle(fd).node;
      assert.ok(length > 0 && length <= 65536);
      assert.ok(Number.isSafeInteger(position) && position >= 0);
      const available = Math.max(0, Math.min(length, Number(value.stat.size) - position));
      value.data.copy(buffer, offset, position, position + available);
      return available;
    },
    writeSync(fd, buffer, offset, length, position) {
      const value = handle(fd).node;
      assert.ok(length > 0 && length <= 65536);
      assert.equal(position, Number(value.stat.size));
      buffer.copy(value.data, position, offset, offset + length);
      value.stat.size += BigInt(length);
      tick(value);
      return length;
    },
    mkdirSync(path, options) {
      assert.equal(path, ROOT);
      assert.deepEqual(options, { mode: 0o700 });
      if (nodes.has(path)) throw error('EEXIST');
      nodes.set(path, { data: null, stat: stat(600n, 128, 0o040700, 99n, 1000n) });
    },
    fchmodSync(fd, mode) {
      const value = handle(fd).node;
      value.stat.mode = (value.stat.mode & 0o170000n) | BigInt(mode);
      tick(value);
    },
    fsyncSync(fd) { handle(fd); },
    readdirSync(path) {
      assert.equal(path, ROOT);
      return [...nodes.keys()].filter(key => key.startsWith(`${ROOT}/`)).map(key => key.slice(ROOT.length + 1));
    },
  };
  env.fs = Object.fromEntries(Object.entries(methods).map(([name, action]) => [name, (...args) => {
    log.push({ name, args, path: typeof args[0] === 'number' ? handles.get(args[0])?.path : args[0] });
    const override = env.hook?.(name, args, env);
    if (override && Object.hasOwn(override, 'value')) return override.value;
    return action(...args);
  }]));
  env.hash = bytes => {
    const image = PROFILE.images.find(item => item.size === bytes.length);
    assert.ok(image);
    return env.hashHook ? env.hashHook(bytes, image) : image.sha256;
  };
  env.inspect = bytes => {
    const image = PROFILE.images.find(item => item.size === bytes.length);
    const result = metadata(image);
    env.metadataHook?.(result, image);
    return result;
  };
  env.deps = { fs: env.fs, hash: env.hash, inspect: env.inspect };
  env.calls = name => log.filter(entry => entry.name === name);
  return env;
}

test('profile fixes four source images, hashes, paths, limits and non-Native assurances', () => {
  assert.equal(PROFILE.root, ROOT);
  assert.deepEqual(PROFILE.images.map(image => [image.source, image.size, image.sha256]), [
    ['/usr/bin/xz', 101392, '1f6ca26fd33066c9d5b95e58a0d9e2f5789cb18fd5741518574113b37ea1934d'],
    ['/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2', 254864, 'c5e80a563850d6ab5c2f2482e4202d9c1b71fbf44854b8c399e63527202c64e1'],
    ['/lib/x86_64-linux-gnu/liblzma.so.5.8.3', 215448, '515749273a91ca5e3b273b4025dc2c1f8827f90005baea0ab85ffb594e74f72f'],
    ['/lib/x86_64-linux-gnu/libc.so.6', 2186512, 'a3947513a02831ec692ebf13053c07614882ab54a2101fb91a1b15724062ed0c'],
  ]);
  assert.equal(PROFILE.images.reduce((sum, image) => sum + image.size, 0), 2758216);
  assert.ok(Object.isFrozen(PROFILE) && Object.isFrozen(PROFILE.images[0].needed));
  assert.equal(PROFILE.assurances.ordinaryStage, true);
  for (const [name, value] of Object.entries(PROFILE.assurances)) if (name !== 'ordinaryStage') assert.equal(value, false);
  assert.throws(() => { PROFILE.images[0].source = '/other'; }, TypeError);
});

test('healthy staging captures all sources before mkdir and verifies exact staged images', () => {
  const env = fixture();
  const result = stageXzImages(env.deps);
  assert.equal(env.handles.size, 0);
  const mkdir = env.log.findIndex(call => call.name === 'mkdirSync');
  assert.equal(env.log.slice(0, mkdir).filter(call => call.name === 'closeSync').length, 4);
  assert.equal(env.log.slice(0, mkdir).filter(call => call.name === 'readSync').length, 48);
  assert.equal(env.calls('writeSync').length, 44);
  assert.equal(env.calls('fsyncSync').length, 5);
  assert.deepEqual(env.calls('fchmodSync').map(call => call.args[1]), [0o500, 0o500, 0o400, 0o400, 0o500]);
  assert.deepEqual(result.files.map(file => file.name), ['xz', 'ld-linux-x86-64.so.2', 'liblzma.so.5', 'libc.so.6']);
  assert.equal(result.directory.mode, String(0o040500));
  assert.equal(result.counters.readBytes, 2 * PROFILE.totalSourceBytes);
  assert.equal(result.counters.writtenBytes, PROFILE.totalSourceBytes);
  assert.equal(result.counters.fsCalls, env.log.length);
  assert.equal(result.counters.peakOwnedFds, 2);
  assert.ok(result.counters.fsCalls < 1024);
  assert.ok(Object.isFrozen(result.files[0].metadata));
  assert.doesNotThrow(() => JSON.stringify(result));
  assert.equal(JSON.stringify(result).includes('"fd"'), false);
});

test('public verification accepts JSON receipts and records an independent bounded pass', () => {
  const env = fixture();
  const original = stageXzImages(env.deps);
  const start = env.log.length;
  const verified = verifyStagedXzImages(JSON.parse(JSON.stringify(original)), env.deps);
  assert.deepEqual(verified.files, original.files);
  assert.equal(verified.counters.readBytes, PROFILE.totalSourceBytes);
  assert.equal(verified.counters.fsCalls, env.log.length - start);
  assert.equal(verified.counters.writtenBytes, 0);
  assert.equal(env.handles.size, 0);
});

test('independent device and inode records do not inherit the parent identity', () => {
  const env = fixture();
  const result = stageXzImages(env.deps);
  assert.deepEqual(result.files.map(file => file.metadata.dev), ['100', '101', '102', '103']);
  for (const file of result.files) {
    assert.notEqual(file.metadata.dev, result.directory.dev);
    assert.notEqual(file.metadata.ino, result.directory.ino);
  }
});

test('hash mismatch fails before mkdir', () => {
  const env = fixture();
  env.hashHook = () => '0'.repeat(64);
  assert.throws(() => stageXzImages(env.deps), expectCode('E_HASH'));
  assert.equal(env.calls('mkdirSync').length, 0);
  assert.equal(env.calls('closeSync').length, 1);
});

test('production hash default rejects mock zero bytes without creating a directory', () => {
  const env = fixture();
  assert.throws(() => stageXzImages({ fs: env.fs, inspect: env.inspect }), expectCode('E_HASH'));
  assert.equal(env.calls('mkdirSync').length, 0);
});

test('production ELF default rejects mock zero bytes after all hashes and closes', () => {
  const env = fixture();
  assert.throws(() => stageXzImages({ fs: env.fs, hash: env.hash }), expectCode('E_ELF'));
  assert.equal(env.calls('closeSync').length, 4);
  assert.equal(env.calls('mkdirSync').length, 0);
});

for (const tag of ['1879047932', '1879047931', '2147483647', '2147483645']) {
  test(`hidden dependency tag ${tag} fails before any staging`, () => {
    const env = fixture();
    env.metadataHook = meta => { meta.dynamic.unknownTags.push({ tag, value: '1' }); };
    assert.throws(() => stageXzImages(env.deps), expectCode('E_LOADING'));
    assert.equal(env.calls('mkdirSync').length, 0);
    assert.equal(env.calls('writeSync').length, 0);
  });
}

test('opaque hidden-dependency tags also fail closed', () => {
  const env = fixture();
  env.metadataHook = meta => { meta.dynamic.opaqueTags = [{ tag: '2147483647' }]; };
  assert.throws(() => stageXzImages(env.deps), expectCode('E_LOADING'));
  assert.equal(env.calls('mkdirSync').length, 0);
});

for (const [name, mutate] of [
  ['needed order', meta => { meta.dynamic.needed.reverse(); }],
  ['extra needed image', meta => { meta.dynamic.needed.push('libhidden.so'); }],
  ['soname', meta => { meta.dynamic.soname = 'wrong.so'; }],
  ['interpreter', meta => { meta.interpreter = '/other/ld.so'; }],
  ['rpath', meta => { meta.dynamic.rpath = ''; }],
  ['runpath', meta => { meta.dynamic.runpath = '/tmp'; }],
  ['unprovided version', meta => { meta.requirements.versionNeeds[0].aux[0].name = 'MISSING_VERSION'; }],
]) {
  test(`loading closure rejects ${name} before mkdir`, () => {
    const env = fixture();
    env.metadataHook = (meta, image) => { if (image.name === 'xz') mutate(meta); };
    assert.throws(() => stageXzImages(env.deps), expectCode('E_LOADING'));
    assert.equal(env.calls('mkdirSync').length, 0);
  });
}

for (const [name, mutate] of [
  ['missing dynamic', meta => { meta.dynamic = null; }],
  ['missing requirements', meta => { meta.requirements = null; }],
  ['wrong digest', meta => { meta.inputSha256 = '0'.repeat(64); }],
  ['missing unknown tags', meta => { delete meta.dynamic.unknownTags; }],
  ['malformed dynamic tag', meta => { meta.dynamic.unknownTags = [{}]; }],
  ['sparse needed array', meta => { delete meta.dynamic.needed[0]; }],
  ['sparse version definition', meta => { meta.requirements.versionDefinitions = Array(1); }],
  ['empty version auxiliary records', meta => { meta.requirements.versionNeeds[0].aux = []; }],
]) {
  test(`malformed ELF metadata rejects ${name}`, () => {
    const env = fixture();
    env.metadataHook = mutate;
    assert.throws(() => stageXzImages(env.deps), expectCode('E_ELF'));
    assert.equal(env.calls('mkdirSync').length, 0);
  });
}

for (const [field, value] of [
  ['uid', 1n], ['gid', 1n], ['nlink', 2n], ['mode', 0o100775n],
  ['mode', 0o104755n], ['mode', 0o120755n], ['size', 101391n], ['ctimeNs', 1],
]) {
  test(`source ${field}=${value} fails before reading`, () => {
    const env = fixture();
    env.nodes.get('/usr/bin/xz').stat[field] = value;
    assert.throws(() => stageXzImages(env.deps), expectCode('E_METADATA'));
    assert.equal(env.calls('readSync').length, 0);
    assert.equal(env.calls('mkdirSync').length, 0);
  });
}

for (const field of ['dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtimeNs', 'ctimeNs']) {
  test(`source before-read FD binding checks ${field}`, () => {
    const env = fixture();
    env.hook = (name, args) => {
      if (name === 'fstatSync') return { value: { ...env.nodes.get('/usr/bin/xz').stat,
        [field]: env.nodes.get('/usr/bin/xz').stat[field] + 1n } };
    };
    assert.throws(() => stageXzImages(env.deps), expectCode('E_BINDING'));
    assert.equal(env.calls('readSync').length, 0);
    assert.equal(env.calls('closeSync').length, 1);
  });
}

test('short source read stops without retry', () => {
  const env = fixture();
  env.hook = name => name === 'readSync' ? { value: 1 } : undefined;
  assert.throws(() => stageXzImages(env.deps), expectCode('E_LENGTH'));
  assert.equal(env.calls('readSync').length, 1);
  assert.equal(env.calls('mkdirSync').length, 0);
  assert.equal(env.handles.size, 0);
});

test('source EOF rejects an extra byte', () => {
  const env = fixture();
  env.hook = (name, args) => name === 'readSync' && args[4] === 101392 ? { value: 1 } : undefined;
  assert.throws(() => stageXzImages(env.deps), expectCode('E_LENGTH'));
  assert.equal(env.calls('mkdirSync').length, 0);
});

test('source changes after reading fail full nine-field stability', () => {
  const env = fixture();
  env.hook = (name, args) => {
    if (name === 'readSync' && args[4] === 101392) env.nodes.get('/usr/bin/xz').stat.ctimeNs++;
  };
  assert.throws(() => stageXzImages(env.deps), expectCode('E_BINDING'));
  assert.equal(env.calls('mkdirSync').length, 0);
});

test('named source replacement after EOF fails binding', () => {
  const env = fixture();
  let named = 0;
  env.hook = (name, args) => {
    if (name === 'lstatSync' && args[0] === '/usr/bin/xz' && ++named === 2) {
      return { value: { ...env.nodes.get('/usr/bin/xz').stat, ino: 999n } };
    }
  };
  assert.throws(() => stageXzImages(env.deps), expectCode('E_BINDING'));
  assert.equal(env.calls('mkdirSync').length, 0);
});

test('existing root receives no probes, writes, chmod or cleanup', () => {
  const env = fixture();
  const sentinel = { data: Buffer.from('preserve'), stat: stat(600n, 8, 0o040700) };
  env.nodes.set(ROOT, sentinel);
  assert.throws(() => stageXzImages(env.deps), expectCode('E_EXISTS'));
  const last = env.log.at(-1);
  assert.equal(last.name, 'mkdirSync');
  assert.equal(env.nodes.get(ROOT), sentinel);
  assert.equal(env.calls('writeSync').length, 0);
  assert.equal(env.calls('fchmodSync').length, 0);
});

test('short write stops without retry and retains partial files', () => {
  const env = fixture();
  env.hook = name => name === 'writeSync' ? { value: 1 } : undefined;
  assert.throws(() => stageXzImages(env.deps), expectCode('E_LENGTH'));
  assert.equal(env.calls('writeSync').length, 1);
  assert.ok(env.nodes.has(`${ROOT}/xz`));
  assert.ok(env.nodes.has(ROOT));
  assert.equal(env.handles.size, 0);
});

for (const method of ['writeSync', 'fsyncSync', 'fchmodSync']) {
  test(`${method} failure closes owned descriptors and retains stage`, () => {
    const env = fixture();
    env.hook = name => { if (name === method) throw error('EIO'); };
    assert.throws(() => stageXzImages(env.deps), expectCode('E_IO'));
    assert.equal(env.handles.size, 0);
    assert.ok(env.nodes.has(`${ROOT}/xz`));
    assert.equal(env.calls(method).length, 1);
  });
}

test('source close failure clears ownership before the single close attempt', () => {
  const env = fixture();
  env.hook = name => { if (name === 'closeSync') throw error('EINTR'); };
  assert.throws(() => stageXzImages(env.deps), expectCode('E_CLOSE'));
  assert.equal(env.calls('closeSync').length, 1);
  assert.equal(env.calls('mkdirSync').length, 0);
});

test('stage close failure never retries that FD and still closes the root', () => {
  const env = fixture();
  env.hook = (name, args) => {
    if (name === 'closeSync' && env.handles.get(args[0]).path === `${ROOT}/xz`) throw error('EINTR');
  };
  assert.throws(() => stageXzImages(env.deps), expectCode('E_CLOSE'));
  const closed = env.calls('closeSync').map(call => call.args[0]);
  assert.equal(new Set(closed).size, closed.length);
  assert.equal(env.log.at(-1).path, ROOT);
});

test('post-write staged digest mismatch rejects publication', () => {
  const env = fixture();
  env.hashHook = (bytes, image) => env.nodes.has(ROOT) ? '0'.repeat(64) : image.sha256;
  assert.throws(() => stageXzImages(env.deps), expectCode('E_HASH'));
  assert.equal(env.nodes.get(ROOT).stat.mode, 0o040500n);
  assert.equal(env.handles.size, 0);
  assert.equal(env.calls('writeSync').length, 44);
});

for (const [name, change, code] of [
  ['unknown entry', env => env.nodes.set(`${ROOT}/extra`, { data: Buffer.alloc(0), stat: stat(999n, 0, 0o100400) }), 'E_LAYOUT'],
  ['missing entry', env => env.nodes.delete(`${ROOT}/xz`), 'E_LAYOUT'],
  ['symlink', env => { env.nodes.get(`${ROOT}/xz`).stat.mode = 0o120500n; }, 'E_LAYOUT'],
  ['wrong mode', env => { env.nodes.get(`${ROOT}/xz`).stat.mode = 0o100700n; }, 'E_LAYOUT'],
  ['wrong owner', env => { env.nodes.get(`${ROOT}/xz`).stat.uid = 0n; }, 'E_LAYOUT'],
  ['hard link', env => { env.nodes.get(`${ROOT}/xz`).stat.nlink = 2n; }, 'E_LAYOUT'],
  ['replacement inode', env => { env.nodes.get(`${ROOT}/xz`).stat.ino++; }, 'E_BINDING'],
  ['root mode', env => { env.nodes.get(ROOT).stat.mode = 0o040700n; }, 'E_LAYOUT'],
  ['root replacement', env => { env.nodes.get(ROOT).stat.ino++; }, 'E_BINDING'],
  ['root timestamps', env => { env.nodes.get(ROOT).stat.mtimeNs++; }, 'E_BINDING'],
]) {
  test(`verification rejects ${name} without writes`, () => {
    const env = fixture();
    const result = stageXzImages(env.deps);
    const writes = env.calls('writeSync').length;
    change(env);
    assert.throws(() => verifyStagedXzImages(result, env.deps), expectCode(code));
    assert.equal(env.calls('writeSync').length, writes);
    assert.equal(env.handles.size, 0);
  });
}

test('verification propagates readdir failure without recursive exploration', () => {
  const env = fixture();
  const result = stageXzImages(env.deps);
  const start = env.log.length;
  env.hook = name => { if (name === 'readdirSync') throw error('EACCES'); };
  assert.throws(() => verifyStagedXzImages(result, env.deps), expectCode('E_IO'));
  assert.deepEqual(env.log.slice(start).map(call => call.name), ['lstatSync', 'readdirSync']);
});

test('receipt cannot select another root or filename', () => {
  const env = fixture();
  const result = stageXzImages(env.deps);
  const start = env.log.length;
  assert.throws(() => verifyStagedXzImages({ ...result, root: '/other' }, env.deps), expectCode('E_INPUT'));
  const copy = JSON.parse(JSON.stringify(result));
  copy.files[0].name = '../other';
  assert.throws(() => verifyStagedXzImages(copy, env.deps), expectCode('E_INPUT'));
  assert.equal(env.log.length, start);
});

test('options reject caller paths, getters and proxies before mock FS calls', () => {
  const env = fixture();
  assert.throws(() => stageXzImages({ ...env.deps, root: '/other' }), expectCode('E_INPUT'));
  let called = false;
  const options = Object.defineProperty({}, 'fs', { get() { called = true; return env.fs; } });
  assert.throws(() => stageXzImages(options), expectCode('E_INPUT'));
  assert.throws(() => stageXzImages(new Proxy(env.deps, {})), expectCode('E_INPUT'));
  for (const key of ['fs', 'hash', 'inspect']) {
    assert.throws(() => stageXzImages({ ...env.deps, [key]: null }), expectCode('E_INPUT'));
  }
  assert.equal(called, false);
  assert.equal(env.log.length, 0);
});

test('preload invalid options fail before selecting the real filesystem', () => {
  for (const options of [null, 1, { fs: null }, { root: ROOT }, new Proxy({}, {})]) {
    assert.throws(() => assertNoSystemPreload(options), expectCode('E_INPUT'));
  }
  let called = false;
  const options = Object.defineProperty({}, 'fs', { get() { called = true; } });
  assert.throws(() => assertNoSystemPreload(options), expectCode('E_INPUT'));
  assert.equal(called, false);
});

test('preload absence uses one literal lstat and only ENOENT succeeds', () => {
  const calls = [];
  const mock = { lstatSync(...args) { calls.push(args); throw error('ENOENT'); } };
  assert.equal(assertNoSystemPreload({ fs: mock }), true);
  assert.deepEqual(calls, [['/etc/ld.so.preload', { bigint: true }]]);
});

for (const kind of ['file', 'directory', 'symlink', 'EACCES', 'EIO']) {
  test(`preload ${kind} fails closed after one lstat`, () => {
    let calls = 0;
    const mock = { lstatSync(path) {
      calls++;
      assert.equal(path, '/etc/ld.so.preload');
      if (kind.startsWith('E')) throw error(kind);
      return { kind };
    } };
    assert.throws(() => assertNoSystemPreload({ fs: mock }), expectCode('E_PRELOAD'));
    assert.equal(calls, 1);
  });
}
