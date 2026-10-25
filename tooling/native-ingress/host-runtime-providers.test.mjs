// SPEC: _spec/tooling/native-ingress/step2.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { HOST_RUNTIME_INPUTS as INPUTS, HOST_RUNTIME_LIMITS as LIMITS,
  observeHostRuntimeProviders, createHostRuntimeProvidersFixture } from './host-runtime-providers.mjs';
import { inspectElf64RequirementsV4, ELF_REQUIREMENTS_V4_LIMITS } from './elf-requirements-v4.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = name => fs.readFileSync(new URL(name, import.meta.url));
const clone = value => structuredClone(value);
const asciiJson = value => JSON.stringify(value).replace(/[\u007f-\uffff]/g,
  unit => '\\u' + unit.charCodeAt(0).toString(16).padStart(4, '0')) + '\n';
const keys = ['dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtimeNs', 'ctimeNs'];
const negative = ['nativeQualified', 'nativeAuthority', 'rustReady', 'trainingReady',
  'loaderClosureVerified', 'runtimeProvidersQualified', 'pythonFreeSubsetVerified', 'installedUsability',
  'imagePrepared', 'dockerProviderQualified', 'symbolBindingsVerified', 'hardRssBounded',
  'hardDeadlineGuaranteed', 'processTreeBounded', 'ancestorRacesExcluded', 'sourceAuthentication',
  'sourceRootAuthentication', 'atomicSnapshot', 'candidateExecuted', 'provenanceVerified',
  'noPythonRuntimeVerified', 'decoderQualified'];

function elf(row, length = 4096) {
  const bytes = Buffer.alloc(length);
  const base = 0x400000n;
  const table = Buffer.from('\0' + row.soname + '\0libdependency.so\0MOCK_1.0\0');
  const dependency = 2 + row.soname.length, version = dependency + 'libdependency.so'.length + 1;
  const entries = [[5n, base + 2048n], [10n, BigInt(table.length)], [14n, 1n], [1n, BigInt(dependency)],
    [0x6ffffffen, base + 1024n], [0x6fffffffn, 1n], [0x6ffffffcn, base + 1280n],
    [0x6ffffffdn, 1n], [0x70000001n, 42n], [0n, 0n]];
  const programs = [{ type: 1, offset: 0, address: base, size: length },
    { type: 2, offset: 512, address: base + 512n, size: entries.length * 16 }];
  if (row.interpreter !== null) programs.push({ type: 3, offset: 1536, address: base + 1536n,
    size: Buffer.byteLength(row.interpreter) + 1 });
  bytes.set([127, 69, 76, 70, 2, 1, 1]);
  bytes.writeUInt16LE(3, 16); bytes.writeUInt16LE(62, 18); bytes.writeUInt32LE(1, 20);
  bytes.writeBigUInt64LE(64n, 32); bytes.writeUInt16LE(64, 52); bytes.writeUInt16LE(56, 54);
  bytes.writeUInt16LE(programs.length, 56);
  programs.forEach((program, index) => {
    const at = 64 + 56 * index;
    bytes.writeUInt32LE(program.type, at); bytes.writeUInt32LE(4, at + 4);
    bytes.writeBigUInt64LE(BigInt(program.offset), at + 8); bytes.writeBigUInt64LE(program.address, at + 16);
    bytes.writeBigUInt64LE(BigInt(program.size), at + 32); bytes.writeBigUInt64LE(BigInt(program.size), at + 40);
    bytes.writeBigUInt64LE(1n, at + 48);
  });
  entries.forEach(([tag, value], index) => {
    bytes.writeBigInt64LE(tag, 512 + 16 * index); bytes.writeBigUInt64LE(value, 520 + 16 * index);
  });
  bytes.writeUInt16LE(1, 1024); bytes.writeUInt16LE(1, 1026); bytes.writeUInt32LE(dependency, 1028);
  bytes.writeUInt32LE(32, 1032); bytes.writeUInt32LE(17, 1056); bytes.writeUInt16LE(2, 1060);
  bytes.writeUInt16LE(3, 1062); bytes.writeUInt32LE(version, 1064);
  bytes.writeUInt16LE(1, 1280); bytes.writeUInt16LE(7, 1284); bytes.writeUInt16LE(1, 1286);
  bytes.writeUInt32LE(32, 1292); bytes.writeUInt32LE(version, 1312);
  table.copy(bytes, 2048);
  if (row.interpreter !== null) bytes.write(row.interpreter + '\0', 1536);
  return bytes;
}

function metadata(overrides = {}) {
  return { dev: 29n, ino: 100n, mode: 0o100644n, uid: 0n, gid: 0n,
    nlink: 1n, size: 4096n, mtimeNs: 123n, ctimeNs: 124n, ...overrides };
}
const textMetadata = meta => Object.fromEntries(keys.map(key => [key, String(meta[key])]));

function fixture(options = {}) {
  const state = { nodes: new Map(), handles: new Map(), events: [], time: 0, inspections: 0,
    hooks: {}, nextFd: 10 };
  const inputs = clone(INPUTS);
  const root = metadata({ dev: 28n, ino: 10n, mode: 0o040500n, uid: 1000n, gid: 1000n, nlink: 2n });
  const host = metadata({ dev: 1n, ino: 20n, mode: 0o040755n, nlink: 2n });
  state.nodes.set(INPUTS[0].root, { metadata: root });
  state.nodes.set(INPUTS[2].root, { metadata: host });
  inputs.forEach((row, index) => {
    const bytes = elf(row, options.sizes?.[index] ?? 4096);
    const meta = metadata({ ino: BigInt(100 + index), size: BigInt(bytes.length),
      ...(index < 2 ? { mode: index === 0 ? 0o100500n : 0o100400n, uid: 1000n, gid: 1000n } : {}) });
    state.nodes.set(row.path, { metadata: meta, bytes });
    if (index < 2) {
      row.expectedBytes = bytes.length; row.expectedSha256 = sha(bytes);
      row.rootIdentity = textMetadata(root); row.fileIdentity = textMetadata(meta);
    }
  });
  const event = (method, details, action) => {
    const record = { method, ...details }; state.events.push(record);
    const override = state.hooks[method]?.(record, state);
    return override === undefined ? action() : override;
  };
  const adapter = {
    constants: { O_RDONLY: 0, O_NOFOLLOW: 131072, O_NONBLOCK: 2048, O_DIRECTORY: 65536 },
    lstatSync(path, opts) {
      assert.deepEqual(opts, { bigint: true });
      return event('lstatSync', { path }, () => {
        const node = state.nodes.get(path); if (!node) throw new Error('SECRET missing ' + path);
        return { ...node.metadata };
      });
    },
    fstatSync(fd, opts) {
      assert.deepEqual(opts, { bigint: true });
      return event('fstatSync', { fd, path: state.handles.get(fd)?.path }, () => ({ ...state.handles.get(fd).node.metadata }));
    },
    openSync(path, flags) {
      return event('openSync', { path, flags }, () => {
        const node = state.nodes.get(path); if (!node) throw new Error('SECRET missing ' + path);
        const fd = state.nextFd++; state.handles.set(fd, { node, path }); return fd;
      });
    },
    readSync(fd, buffer, offset, length, position) {
      return event('readSync', { fd, path: state.handles.get(fd)?.path, offset, length, position }, () =>
        state.handles.get(fd).node.bytes.copy(buffer, offset, position, position + length));
    },
    closeSync(fd) {
      return event('closeSync', { fd, path: state.handles.get(fd)?.path }, () => {
        assert.equal(state.handles.delete(fd), true); return undefined;
      });
    },
  };
  const config = { mockOnly: true, inputs, limits: { ...options.limits } };
  const deps = { fs: adapter, now: () => options.now ? options.now(state) : state.time,
    inspectElf(bytes) {
      assert.equal(state.handles.size, 0);
      const index = state.inspections++;
      return options.inspect ? options.inspect(bytes, index, state) : inspectElf64RequirementsV4(bytes);
    } };
  options.configure?.({ state, config, deps, adapter });
  const api = createHostRuntimeProvidersFixture(config, deps);
  return { ...state, state, config, deps, adapter, api, run: () => api.observeHostRuntimeProviders() };
}

function stopped(value, code, role = undefined) {
  assert.equal(value.status, 'STOP'); assert.equal(value.error, code);
  if (role !== undefined) assert.equal(value.role, role);
  assert.equal(Object.hasOwn(value, 'candidates'), false);
  assert.equal(value.ioAccountingComplete, false);
  for (const key of negative) assert.equal(value.flags[key], false, key);
  const text = JSON.stringify(value);
  assert.doesNotMatch(text, /SECRET|inputSha256|rootMetadata|fileMetadata|rootIdentity|fileIdentity|\"sha256\"/);
  for (const row of INPUTS) assert.equal(text.includes(row.path), false);
  deepFrozen(value);
}
function observed(value) {
  assert.equal(value.status, 'HOST_RUNTIME_CANDIDATES_OBSERVED'); assert.equal(value.mockOnly, true);
  assert.equal(value.profile, 'host-runtime-providers-v1'); assert.equal(value.candidates.length, 7);
  assert.equal(value.ioAccountingComplete, true); assert.equal(value.closeFailed, false);
  assert.equal(value.cleanupUncertain, false); assert.equal(value.scope, 'CANDIDATE_DATA_NOT_RUNTIME_ADMISSION');
  for (const key of negative) assert.equal(value[key], false, key);
  deepFrozen(value);
}
function deepFrozen(value) {
  if (value === null || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) deepFrozen(child);
}

test('seven immutable inputs use the exact shared shape and closed order', () => {
  assert.deepEqual(INPUTS.map(row => row.role), ['HOST_LOADER', 'HOST_LIBC', 'HOST_LIBM', 'HOST_LIBDL',
    'HOST_LIBPTHREAD', 'HOST_LIBRT', 'HOST_LIBGCC_S']);
  for (const row of INPUTS) assert.deepEqual(Object.keys(row), ['role', 'root', 'path', 'soname', 'interpreter',
    'sourceKind', 'expectedBytes', 'expectedSha256', 'rootIdentity', 'fileIdentity']);
  assert.deepEqual(INPUTS.map(row => row.soname), ['ld-linux-x86-64.so.2', 'libc.so.6', 'libm.so.6',
    'libdl.so.2', 'libpthread.so.0', 'librt.so.1', 'libgcc_s.so.1']);
  assert.deepEqual(INPUTS.map(row => row.interpreter), [null, '/lib64/ld-linux-x86-64.so.2', null, null, null, null, null]);
  deepFrozen(INPUTS); assert.throws(() => { INPUTS[2].path = 'other'; }, TypeError);
});
test('two stage rows bind all nine receipt metadata fields and the profile body digests', () => {
  const receipt = JSON.parse(read('../../_spec/tooling/native-ingress/xz-qualification.receipt.json'));
  const source = read('./xz-staging.mjs').toString();
  for (const row of INPUTS.slice(0, 2)) {
    assert.equal(row.root, receipt.staged.root); assert.deepEqual(row.rootIdentity, receipt.staged.directory);
    assert.deepEqual(row.fileIdentity, receipt.staged.files.find(file => file.name === row.soname).metadata);
    assert.equal(row.path, row.root + '/' + row.soname); assert.equal(row.sourceKind, 'PINNED_ORDINARY_STAGE');
    assert.equal(row.expectedBytes, Number(row.fileIdentity.size)); assert.ok(source.includes(row.expectedSha256));
  }
  assert.equal(INPUTS[0].expectedBytes, 254864); assert.equal(INPUTS[1].expectedBytes, 2186512);
});
test('five host rows remain explicitly unpinned ordinary candidates', () => {
  for (const row of INPUTS.slice(2)) {
    assert.equal(row.root, '/usr/lib/x86_64-linux-gnu'); assert.equal(row.path, row.root + '/' + row.soname);
    assert.equal(row.sourceKind, 'ORDINARY_HOST_CANDIDATE_UNAUTHENTICATED');
    for (const key of ['expectedBytes', 'expectedSha256', 'rootIdentity', 'fileIdentity']) assert.equal(row[key], null);
  }
});
test('all production resource limits stay fixed', () => {
  assert.deepEqual(LIMITS, { maxFileBytes: 8388608, maxAggregateBytes: 33554432, maxRequestedBytes: 33554439,
    maxFsOperations: 2048, maxReadAttempts: 1024, maxClockReads: 8192, maxOutputBytes: 2097152,
    chunkBytes: 65536, maxTotalMs: 10000, cleanupMs: 2000 }); deepFrozen(LIMITS);
});
test('pinned repository inputs remain unchanged without touching host or stage files', () => {
  for (const [path, size, digest] of [
    ['./elf-requirements-v4.mjs', 21142, 'f5a428aae91593853acfd289c4e91fb715ca530744defa2fe9447f6dda0602f3'],
    ['./xz-staging.mjs', 16688, 'f75c21a58bb67e6ab3f8b1dafd090e11ac2d3a70f017da35afb81b00761b71b4'],
    ['../../_spec/tooling/native-ingress/xz-qualification.receipt.json', 4239,
      'e45d65231c0815ab2b895c0d74467500a0e6caf33cc0a4ee342b20489ce6b233'],
  ]) { const bytes = read(path); assert.equal(bytes.length, size); assert.equal(sha(bytes), digest); }
  assert.equal(ELF_REQUIREMENTS_V4_LIMITS.maxInputBytes, 67108864);
  assert.equal(ELF_REQUIREMENTS_V4_LIMITS.maxStringTableBytes, 16777216);
  assert.equal(ELF_REQUIREMENTS_V4_LIMITS.maxOutputBytes, 131072);
});
test('helper captures exactly four imports and has no discovery or execution route', () => {
  const source = read('./host-runtime-providers.mjs').toString();
  assert.deepEqual([...source.matchAll(/^import .* from '([^']+)';$/gm)].map(match => match[1]),
    ['node:fs', 'node:crypto', 'node:util', './elf-requirements-v4.mjs']);
  assert.doesNotMatch(source, /\b(?:process|fetch|spawn|exec|readdirSync|readlinkSync|realpathSync|readFileSync|writeFileSync|require|eval|Function)\b|\bimport\s*\(/);
  assert.equal(source.split('\n').filter(line => line.startsWith('//')).length, 1);
  assert.equal(observeHostRuntimeProviders.length, 0);
});
test('production rejects arguments before any filesystem or clock access and consumes once', t => {
  for (const method of ['openSync', 'lstatSync', 'fstatSync', 'readSync', 'closeSync']) {
    t.mock.method(fs, method, () => assert.fail('real filesystem access'));
  }
  const first = observeHostRuntimeProviders({ inputs: INPUTS, limits: LIMITS });
  stopped(first, 'E_ARGUMENTS', null); assert.equal(first.mockOnly, false);
  assert.equal(first.counts.fsOperationsAttempted, 0); assert.equal(first.counts.clockReads, 0);
  stopped(observeHostRuntimeProviders(), 'E_CONSUMED', null);
});
test('checked ELF4 data-URI linkage preserves the production source and fresh module one-shot state', async () => {
  const elfSource = read('./elf-requirements-v4.mjs');
  assert.equal(elfSource.length, 21142);
  assert.equal(sha(elfSource), 'f5a428aae91593853acfd289c4e91fb715ca530744defa2fe9447f6dda0602f3');
  const elfUri = 'data:text/javascript;base64,' + elfSource.toString('base64');
  const source = read('./host-runtime-providers.mjs').toString();
  const token = "from './elf-requirements-v4.mjs'";
  assert.equal(source.split(token).length, 2);
  const linked = source.replace(token, "from '" + elfUri + "'");
  const helperUri = 'data:text/javascript;base64,' + Buffer.from(linked).toString('base64');
  for (const suffix of ['#mock-link-a', '#mock-link-b']) {
    const helper = await import(helperUri + suffix);
    assert.deepEqual(helper.HOST_RUNTIME_INPUTS, INPUTS); assert.deepEqual(helper.HOST_RUNTIME_LIMITS, LIMITS);
    stopped(helper.observeHostRuntimeProviders(undefined), 'E_ARGUMENTS', null);
    stopped(helper.observeHostRuntimeProviders(), 'E_CONSUMED', null);
  }
});
test('successful mock captures all seven records only after fourteen closes', () => {
  const h = fixture(), value = h.run(); observed(value);
  assert.equal(h.state.inspections, 7); assert.equal(h.state.handles.size, 0);
  assert.equal(value.counts.closeAttempts, 14); assert.equal(value.counts.closesCompleted, 14);
  assert.equal(value.counts.openAttempts, 14); assert.equal(value.counts.peakOwnedFds, 2);
  assert.equal(value.counts.ownedFds, 0); assert.equal(value.counts.capturedFiles, 7);
  assert.equal(value.counts.inspectedFiles, 7); assert.equal(value.counts.filesAdmitted, 7);
  assert.deepEqual(value.candidates.map(row => row.role), INPUTS.map(row => row.role));
  for (const row of value.candidates) {
    assert.deepEqual(Object.keys(row), ['role', 'path', 'root', 'sourceKind', 'size', 'sha256',
      'rootMetadata', 'fileMetadata', 'requirements']);
    assert.equal(row.sha256, sha(h.state.nodes.get(row.path).bytes));
  }
});
test('root and leaf devices stay independent', () => {
  const value = fixture().run(); observed(value);
  assert.equal(value.candidates[0].rootMetadata.dev, '28'); assert.equal(value.candidates[0].fileMetadata.dev, '29');
  assert.equal(value.candidates[2].rootMetadata.dev, '1'); assert.equal(value.candidates[2].fileMetadata.dev, '29');
});
test('readonly flags protect each final component with exactly two simultaneous descriptors', () => {
  const h = fixture(); observed(h.run());
  for (const event of h.state.events.filter(event => event.method === 'openSync')) {
    const directory = INPUTS.some(row => row.root === event.path);
    assert.equal(event.flags, 131072 | 2048 | (directory ? 65536 : 0));
  }
  assert.deepEqual(new Set(h.state.events.map(event => event.method)),
    new Set(['lstatSync', 'openSync', 'fstatSync', 'readSync', 'closeSync']));
});
test('strict reads include exactly one EOF request per file and preserve requested versus returned counts', () => {
  const h = fixture(), value = h.run(); observed(value);
  assert.equal(value.counts.readAttempts, 14); assert.equal(value.counts.readsCompleted, 14);
  assert.equal(value.counts.returnedBytes, 7 * 4096); assert.equal(value.counts.requestedBytes, 7 * 4097);
  assert.equal(value.counts.allocatedBytes, 7 * 4097); assert.equal(value.counts.admittedBytes, 7 * 4096);
  for (const row of INPUTS) {
    assert.deepEqual(h.state.events.filter(event => event.method === 'readSync' && event.path === row.path)
      .map(event => [event.offset, event.length, event.position]), [[0, 4096, 0], [4096, 1, 4096]]);
  }
  assert.equal(value.counts.fsOperationsAttempted, h.state.events.length);
  assert.equal(value.counts.fsOperationsCompleted, h.state.events.length);
});
test('eight MiB source ceiling needs only 128 data reads plus one EOF', () => {
  const h = fixture({ sizes: [4096, 4096, 8388608] }), value = h.run(); observed(value);
  const reads = h.state.events.filter(event => event.method === 'readSync' && event.path === INPUTS[2].path);
  assert.equal(reads.length, 129); assert.ok(reads.slice(0, -1).every(event => event.length === 65536));
  assert.equal(reads.at(-1).length, 1); assert.equal(reads.at(-1).position, 8388608);
});
test('version needs, definitions and unknown dynamic tags remain data without resolving dependencies', () => {
  const h = fixture(), value = h.run(); observed(value);
  const requirements = value.candidates[0].requirements;
  assert.equal(requirements.requirements.versionNeeds[0].file, 'libdependency.so');
  assert.equal(requirements.requirements.versionNeeds[0].aux[0].name, 'MOCK_1.0');
  assert.deepEqual(requirements.requirements.versionDefinitions[0].names, ['MOCK_1.0']);
  assert.ok(requirements.dynamic.unknownTags.some(row => row.tag === '1879048193' && row.value === '42'));
  assert.equal(h.state.events.some(event => event.path?.includes('libdependency')), false);
});
test('a legitimate privateSnapshot true is not mistaken for runtime authority', () => {
  const h = fixture({ inspect: bytes => ({ ...inspectElf64RequirementsV4(bytes), privateSnapshot: true }) });
  const value = h.run(); observed(value); assert.equal(value.candidates[0].requirements.privateSnapshot, true);
});
test('NoPython remains unknown and stage versus ordinary-host evidence kinds remain distinct', () => {
  const value = fixture().run(); observed(value);
  assert.deepEqual([...new Set(value.candidates.map(row => row.sourceKind))],
    ['PINNED_ORDINARY_STAGE', 'ORDINARY_HOST_CANDIDATE_UNAUTHENTICATED']);
  for (const row of value.candidates) {
    assert.equal(row.requirements.noPythonRuntimeVerified, false);
    assert.equal(row.requirements.provenanceVerified, false);
  }
  assert.equal(value.pythonFreeSubsetVerified, false); assert.equal(value.runtimeProvidersQualified, false);
});

for (const [target, change] of [
  ['root UID', { uid: 1n }], ['root GID', { gid: 1n }], ['root group writable', { mode: 0o040775n }],
  ['root other writable', { mode: 0o040757n }], ['root symlink', { mode: 0o120777n }],
  ['root non-directory', { mode: 0o100755n }],
]) test('reject host ' + target + ' without opening a leaf', () => {
  const h = fixture(); Object.assign(h.state.nodes.get(INPUTS[2].root).metadata, change);
  stopped(h.run(), 'E_METADATA', 'HOST_LIBM');
  assert.equal(h.state.events.filter(event => event.method === 'openSync' && event.path === INPUTS[2].path).length, 0);
  assert.equal(h.state.handles.size, 0);
});
for (const [target, change] of [
  ['leaf UID', { uid: 1n }], ['leaf GID', { gid: 1n }], ['leaf group writable', { mode: 0o100664n }],
  ['leaf other writable', { mode: 0o100646n }], ['leaf symlink', { mode: 0o120777n }],
  ['leaf directory', { mode: 0o040755n }], ['leaf FIFO', { mode: 0o010644n }], ['leaf zero links', { nlink: 0n }],
]) test('reject host ' + target + ' before allocation', () => {
  const h = fixture(); Object.assign(h.state.nodes.get(INPUTS[2].path).metadata, change);
  const value = h.run(); stopped(value, 'E_METADATA', 'HOST_LIBM');
  assert.equal(value.counts.filesAdmitted, 2); assert.equal(h.state.handles.size, 0);
});
test('ordinary host leaf can have multiple links without gaining authenticity', () => {
  const h = fixture(); h.state.nodes.get(INPUTS[2].path).metadata.nlink = 2n;
  observed(h.run());
});
test('missing fixed host leaf stops with no alternative-path fallback', () => {
  const h = fixture(); h.state.nodes.delete(INPUTS[3].path);
  stopped(h.run(), 'E_IO', 'HOST_LIBDL');
  assert.equal(h.state.handles.size, 0);
  assert.equal(h.state.events.at(-1).method, 'closeSync');
  assert.ok(h.state.events.every(event => !event.path || INPUTS.some(row => row.path === event.path || row.root === event.path)));
});
for (const size of [0n, 8388609n]) test('size ' + size + ' rejects before admission or body allocation', () => {
  const h = fixture(); h.state.nodes.get(INPUTS[2].path).metadata.size = size;
  const value = h.run(); stopped(value, 'E_SIZE', 'HOST_LIBM');
  assert.equal(value.counts.filesAdmitted, 2); assert.equal(value.counts.allocatedBytes, 8194);
  assert.equal(h.state.events.some(event => event.method === 'readSync' && event.path === INPUTS[2].path), false);
  assert.equal(h.state.handles.size, 0);
});
test('aggregate admission precharges exact source bytes before each allocation', () => {
  const h = fixture({ limits: { maxAggregateBytes: 8192 } }), value = h.run();
  stopped(value, 'E_LIMIT', 'HOST_LIBM'); assert.equal(value.counts.admittedBytes, 8192);
  assert.equal(value.counts.filesAdmitted, 2); assert.equal(value.counts.allocatedBytes, 8194);
  assert.equal(h.state.handles.size, 0);
});
test('size and aggregate rejection occur before the real Buffer allocation entry point', t => {
  const tooLarge = fixture(), aggregate = fixture({ limits: { maxAggregateBytes: 8192 } });
  tooLarge.state.nodes.get(INPUTS[2].path).metadata.size = 8388609n;
  const allocate = Buffer.alloc, allocations = [];
  t.mock.method(Buffer, 'alloc', function (size, ...args) {
    allocations.push(size); assert.ok(size <= LIMITS.maxFileBytes + 1);
    return Reflect.apply(allocate, Buffer, [size, ...args]);
  });
  stopped(tooLarge.run(), 'E_SIZE', 'HOST_LIBM');
  assert.deepEqual(allocations, [4097, 4097]); allocations.length = 0;
  stopped(aggregate.run(), 'E_LIMIT', 'HOST_LIBM');
  assert.deepEqual(allocations, [4097, 4097]);
});
test('the production 32 MiB aggregate cap stops before a fifth large host allocation', () => {
  const h = fixture({ sizes: [4096, 4096, 8388608, 8388608, 8388608, 8380416] });
  h.state.nodes.get(INPUTS[6].path).metadata.size = 1n;
  const value = h.run(); stopped(value, 'E_LIMIT', 'HOST_LIBGCC_S');
  assert.equal(value.counts.admittedBytes, 33554432); assert.equal(value.counts.filesAdmitted, 6);
  assert.equal(value.counts.allocatedBytes, 33554438); assert.equal(h.state.handles.size, 0);
});
test('a short data read fails once without retrying and still closes leaf then root', () => {
  const h = fixture(); h.state.hooks.readSync = event => event.path === INPUTS[2].path ? 1 : undefined;
  const value = h.run(); stopped(value, 'E_LENGTH', 'HOST_LIBM');
  assert.equal(value.counts.returnedBytes, 8193); assert.equal(value.counts.requestedBytes, 12290);
  assert.equal(h.state.events.filter(event => event.method === 'readSync' && event.path === INPUTS[2].path).length, 1);
  assert.deepEqual(h.state.events.slice(-2).map(event => event.path), [INPUTS[2].path, INPUTS[2].root]);
});
test('nonzero exact EOF rejects appended bytes without retry', () => {
  const h = fixture(); h.state.hooks.readSync = event => event.path === INPUTS[2].path && event.length === 1 ? 1 : undefined;
  const value = h.run(); stopped(value, 'E_LENGTH', 'HOST_LIBM');
  assert.equal(value.counts.returnedBytes, 12289); assert.equal(h.state.handles.size, 0);
});
test('read throws preserve attempts and requested bytes while marking uncertain returned accounting', () => {
  const h = fixture(); h.state.hooks.readSync = event => {
    if (event.path === INPUTS[2].path) throw new Error('SECRET arbitrary filesystem details');
  };
  const value = h.run(); stopped(value, 'E_IO', 'HOST_LIBM');
  assert.equal(value.counts.readAttempts, 5); assert.equal(value.counts.readsCompleted, 4);
  assert.equal(value.counts.requestedBytes, 12290); assert.equal(value.counts.returnedBytes, 8192);
  assert.equal(value.counts.readAccountingUncertain, true); assert.equal(h.state.handles.size, 0);
});
for (const result of [-1, 4097, NaN, undefined, '4096']) test('invalid read return ' + String(result) + ' cannot claim complete accounting', () => {
  const h = fixture();
  if (result === undefined) h.adapter.readSync = () => undefined;
  h.state.hooks.readSync = event => event.path === INPUTS[2].path ? result : undefined;
  if (result === undefined) {
    const deps = { ...h.deps, fs: { ...h.adapter, readSync: () => undefined } };
    const api = createHostRuntimeProvidersFixture(h.config, deps);
    const value = api.observeHostRuntimeProviders(); stopped(value, 'E_LENGTH', 'HOST_LOADER');
    assert.equal(value.counts.readAccountingUncertain, true);
  } else {
    const value = h.run(); stopped(value, 'E_LENGTH', 'HOST_LIBM');
    assert.equal(value.counts.readAccountingUncertain, true);
  }
});
test('changed staged body digest fails after both closes and before ELF inspection', () => {
  const h = fixture(); h.state.nodes.get(INPUTS[0].path).bytes[3000] ^= 1;
  const value = h.run(); stopped(value, 'E_HASH', 'HOST_LOADER');
  assert.equal(value.counts.closesCompleted, 2); assert.equal(h.state.inspections, 0);
});
for (const field of keys) test('sealed staged root rejects changed ' + field, () => {
  const h = fixture(); h.state.nodes.get(INPUTS[0].root).metadata[field] += 1n;
  const value = h.run(); assert.equal(value.status, 'STOP'); assert.equal(value.role, 'HOST_LOADER');
  assert.equal(value.counts.allocatedBytes, 0); assert.equal(h.state.handles.size, 0);
});
for (const field of keys) test('sealed staged leaf rejects changed ' + field, () => {
  const h = fixture(); h.state.nodes.get(INPUTS[0].path).metadata[field] += 1n;
  const value = h.run(); assert.equal(value.status, 'STOP'); assert.equal(value.role, 'HOST_LOADER');
  assert.equal(value.counts.allocatedBytes, 0); assert.equal(h.state.handles.size, 0);
});
test('leaf pathname swap during capture rejects descriptor versus name identity', () => {
  const h = fixture(); h.state.hooks.readSync = (event, state) => {
    if (event.path === INPUTS[2].path && event.length === 1) {
      const node = state.nodes.get(event.path); state.nodes.set(event.path, { ...node,
        metadata: { ...node.metadata, ino: 999n } });
    }
  };
  stopped(h.run(), 'E_IDENTITY', 'HOST_LIBM'); assert.equal(h.state.handles.size, 0);
});
test('opened leaf mismatch rejects before allocation', () => {
  const h = fixture(); h.state.hooks.fstatSync = event => event.path === INPUTS[2].path ?
    { ...h.state.nodes.get(event.path).metadata, ino: 999n } : undefined;
  const value = h.run(); stopped(value, 'E_IDENTITY', 'HOST_LIBM');
  assert.equal(value.counts.allocatedBytes, 8194); assert.equal(h.state.handles.size, 0);
});
test('post-read leaf metadata mutation rejects even when the body stayed unchanged', () => {
  const h = fixture(); h.state.hooks.readSync = event => {
    if (event.path === INPUTS[2].path && event.length === 1) h.state.nodes.get(event.path).metadata.mtimeNs++;
  };
  stopped(h.run(), 'E_IDENTITY', 'HOST_LIBM'); assert.equal(h.state.handles.size, 0);
});
test('root metadata change during capture rejects the batch', () => {
  const h = fixture(); h.state.hooks.readSync = event => {
    if (event.path === INPUTS[2].path && event.length === 1) h.state.nodes.get(INPUTS[2].root).metadata.ctimeNs++;
  };
  stopped(h.run(), 'E_IDENTITY', 'HOST_LIBM'); assert.equal(h.state.handles.size, 0);
});
test('final root symlink rejects the batch', () => {
  const h = fixture(); h.state.hooks.lstatSync = event => {
    if (event.path === INPUTS[2].root && h.state.inspections === 2 &&
      h.state.events.filter(item => item.method === 'lstatSync' && item.path === event.path).length === 2) {
      return { ...h.state.nodes.get(event.path).metadata, mode: 0o120777n };
    }
  };
  stopped(h.run(), 'E_IDENTITY', 'HOST_LIBM'); assert.equal(h.state.handles.size, 0);
});
test('host root baseline remains bound across all five separate observations', () => {
  const h = fixture({ inspect(bytes, index, state) {
    const result = inspectElf64RequirementsV4(bytes);
    if (index === 2) state.nodes.get(INPUTS[2].root).metadata.ino++;
    return result;
  } });
  stopped(h.run(), 'E_IDENTITY', 'HOST_LIBDL'); assert.equal(h.state.handles.size, 0);
});
test('root fstat mismatch rejects before opening a leaf', () => {
  const h = fixture(); h.state.hooks.fstatSync = event => event.path === INPUTS[2].root ?
    { ...h.state.nodes.get(event.path).metadata, ino: 900n } : undefined;
  stopped(h.run(), 'E_IDENTITY', 'HOST_LIBM');
  assert.equal(h.state.events.some(event => event.method === 'openSync' && event.path === INPUTS[2].path), false);
});
for (const kind of ['getter', 'proxy', 'boxed bigint', 'inherited']) test('metadata ' + kind + ' cannot execute caller coercions', () => {
  const h = fixture(); h.state.hooks.lstatSync = event => {
    if (event.path !== INPUTS[2].path) return;
    const meta = { ...h.state.nodes.get(event.path).metadata };
    if (kind === 'getter') Object.defineProperty(meta, 'size', { get() { assert.fail('getter'); } });
    if (kind === 'proxy') return new Proxy(meta, { getOwnPropertyDescriptor() { assert.fail('proxy'); } });
    if (kind === 'boxed bigint') meta.size = Object(4096n);
    if (kind === 'inherited') { delete meta.size; Object.setPrototypeOf(meta, { size: 4096n }); }
    return meta;
  };
  stopped(h.run(), 'E_METADATA', 'HOST_LIBM'); assert.equal(h.state.handles.size, 0);
});

for (const [label, mutate] of [
  ['hash', value => { value.inputSha256 = '0'.repeat(64); }],
  ['size', value => { value.byteLength++; }], ['machine', value => { value.header.machine = 183; }],
  ['type', value => { value.header.type = 1; }], ['SONAME', value => { value.dynamic.soname = 'other.so'; }],
  ['interpreter', value => { value.interpreter = '/other/loader'; }],
  ['profile', value => { value.profile = 'elf64le-x86-64-requirements-v3'; }],
  ['native qualification', value => { value.nativeQualified = true; }],
  ['loader closure', value => { value.loaderClosureVerified = true; }],
  ['runtime provider qualification', value => { value.runtimeProvidersQualified = true; }],
  ['image qualification', value => { value.imagePrepared = true; }],
  ['Docker provider qualification', value => { value.dockerProviderQualified = true; }],
  ['training readiness', value => { value.trainingReady = true; }],
  ['symbol bindings', value => { value.requirements.symbolBindingsVerified = true; }],
  ['missing version definitions', value => { delete value.requirements.versionDefinitions; }],
]) test('inspector rejects mismatched ' + label + ' after cleanup', () => {
  const h = fixture({ inspect(bytes) { const value = clone(inspectElf64RequirementsV4(bytes)); mutate(value); return value; } });
  const value = h.run(); stopped(value, 'E_ELF', 'HOST_LOADER');
  assert.equal(value.counts.closesCompleted, 2); assert.equal(h.state.handles.size, 0);
});
test('libc requires its exact interpreter rather than silently accepting null', () => {
  const h = fixture({ inspect(bytes, index) {
    const value = clone(inspectElf64RequirementsV4(bytes)); if (index === 1) value.interpreter = null; return value;
  } }); stopped(h.run(), 'E_ELF', 'HOST_LIBC');
});
test('untrusted inspector data getters and proxies remain uninvoked', () => {
  for (const proxy of [false, true]) {
    const h = fixture({ inspect(bytes) {
      const value = { ...inspectElf64RequirementsV4(bytes) };
      if (proxy) return new Proxy(value, { get() { assert.fail('proxy'); }, ownKeys() { assert.fail('proxy'); } });
      Object.defineProperty(value, 'privateSnapshot', { enumerable: true, get() { assert.fail('getter'); } }); return value;
    } }); stopped(h.run(), 'E_ELF', 'HOST_LOADER');
  }
});
test('inspector errors never publish exception details', () => {
  const h = fixture({ inspect() { throw new Error('SECRET parser details'); } });
  stopped(h.run(), 'E_ELF', 'HOST_LOADER');
});
test('seventh-role failure withholds all previously accepted hashes and metadata', () => {
  const h = fixture({ inspect(bytes, index) {
    if (index === 6) throw new Error('SECRET seventh'); return inspectElf64RequirementsV4(bytes);
  } });
  const value = h.run(); stopped(value, 'E_ELF', 'HOST_LIBGCC_S'); assert.equal(value.counts.inspectedFiles, 6);
  assert.equal(value.counts.capturedFiles, 7); assert.equal(value.counts.closesCompleted, 14);
  for (const row of h.state.nodes.values()) if (row.bytes) assert.equal(JSON.stringify(value).includes(sha(row.bytes)), false);
});
for (const target of ['leaf', 'root', 'both']) test('close failure on ' + target + ' poisons the batch without retries', () => {
  const h = fixture(); h.state.hooks.closeSync = event => {
    if ((target !== 'root' && event.path === INPUTS[0].path) || (target !== 'leaf' && event.path === INPUTS[0].root)) {
      throw new Error('SECRET close failure');
    }
  };
  const value = h.run(); stopped(value, 'E_CLOSE', 'HOST_LOADER');
  assert.equal(value.closeFailed, true); assert.equal(value.cleanupUncertain, true);
  assert.equal(value.counts.closeAttempts, 2); assert.equal(value.counts.openAttempts, 2);
  assert.equal(value.counts.ownedFds, 0); assert.equal(h.state.inspections, 0);
  assert.equal(new Set(h.state.events.filter(event => event.method === 'closeSync').map(event => event.fd)).size, 2);
});
test('work deadline after open still releases acquired root descriptor', () => {
  const h = fixture(); h.state.hooks.openSync = () => { h.state.time = 8000; };
  const value = h.run(); stopped(value, 'E_DEADLINE', 'HOST_LOADER');
  assert.equal(value.counts.openAttempts, 1); assert.equal(value.counts.closeAttempts, 1);
  assert.equal(h.state.handles.size, 0); assert.equal(value.cleanupUncertain, false);
});
test('work deadline while holding both descriptors closes leaf then root', () => {
  const h = fixture(); h.state.hooks.readSync = () => { h.state.time = 8000; };
  const value = h.run(); stopped(value, 'E_DEADLINE', 'HOST_LOADER');
  assert.equal(value.counts.closeAttempts, 2); assert.equal(h.state.handles.size, 0);
  assert.deepEqual(h.state.events.slice(-2).map(event => event.path), [INPUTS[0].path, INPUTS[0].root]);
});
test('cleanup overrun remains observable and never suppresses either close', () => {
  const h = fixture(); h.state.hooks.readSync = () => { h.state.time = 10001; };
  const value = h.run(); stopped(value, 'E_DEADLINE', 'HOST_LOADER');
  assert.equal(value.cleanupOverrun, true); assert.equal(value.cleanupUncertain, true);
  assert.equal(value.counts.closeAttempts, 2); assert.equal(h.state.handles.size, 0);
});
for (const time of [-1, NaN, Infinity, '1']) test('clock anomaly ' + String(time) + ' stops work but not cleanup', () => {
  const h = fixture(); h.state.hooks.readSync = () => { h.state.time = time; };
  const value = h.run(); stopped(value, 'E_CLOCK', 'HOST_LOADER');
  assert.equal(value.counts.closeAttempts, 2); assert.equal(h.state.handles.size, 0);
  assert.equal(value.cleanupUncertain, true);
});
test('clock capability throwing during cleanup never prevents root release', () => {
  let broken = false;
  const h = fixture({ now() { if (broken) throw new Error('SECRET clock'); return 0; } });
  h.state.hooks.readSync = () => { broken = true; };
  const value = h.run(); stopped(value, 'E_CLOCK', 'HOST_LOADER');
  assert.equal(value.counts.closeAttempts, 2); assert.equal(h.state.handles.size, 0);
  assert.equal(value.cleanupUncertain, true);
});
test('invalid initial clock refuses I/O entirely', () => {
  const h = fixture({ now: () => NaN }), value = h.run(); stopped(value, 'E_CLOCK', null);
  assert.equal(value.counts.clockReads, 1); assert.equal(value.counts.fsOperationsAttempted, 0);
  assert.equal(h.state.events.length, 0);
});
test('successful published clock counters include publication preflight and its final guard', () => {
  let clocks = 0;
  const h = fixture({ now() { clocks++; return 0; } }), value = h.run(); observed(value);
  assert.equal(value.counts.clockReads, clocks); assert.equal(value.counts.clockReadsCompleted, clocks);
});
test('a single work clock includes all parsing without per-file deadline resets', () => {
  const h = fixture({ inspect(bytes, index, state) {
    state.time += 1500; return inspectElf64RequirementsV4(bytes);
  } }); const value = h.run(); stopped(value, 'E_DEADLINE', 'HOST_LIBRT');
  assert.equal(value.counts.capturedFiles, 6); assert.equal(value.counts.inspectedFiles, 5);
  assert.equal(value.counts.closesCompleted, 12); assert.equal(h.state.handles.size, 0);
});
test('deadline includes publication preflight rather than ending at the last read', () => {
  const h = fixture({ now(state) {
    if (state.inspections === 7) state.time += 100;
    return state.time;
  } });
  const value = h.run(); stopped(value, 'E_DEADLINE');
  assert.equal(value.counts.closesCompleted, 14); assert.equal(h.state.handles.size, 0);
});
test('clock-read exhaustion still attempts both closes using cleanup without a work guard', () => {
  const h = fixture({ limits: { maxClockReads: 12 } }), value = h.run(); stopped(value, 'E_LIMIT', 'HOST_LOADER');
  assert.equal(value.counts.clockReads, 12); assert.equal(value.counts.closeAttempts, 2);
  assert.equal(h.state.handles.size, 0); assert.equal(value.cleanupUncertain, true);
});
test('filesystem operation limit reserves cleanup attempts', () => {
  const h = fixture({ limits: { maxFsOperations: 8 } }), value = h.run(); stopped(value, 'E_LIMIT', 'HOST_LOADER');
  assert.equal(value.counts.fsOperationsAttempted, 8); assert.equal(value.counts.closeAttempts, 2);
  assert.equal(h.state.handles.size, 0);
});
test('read-attempt cap counts EOF and does not skip cleanup', () => {
  const h = fixture({ limits: { maxReadAttempts: 1 } }), value = h.run(); stopped(value, 'E_LIMIT', 'HOST_LOADER');
  assert.equal(value.counts.readAttempts, 1); assert.equal(value.counts.requestedBytes, 4096);
  assert.equal(value.counts.closeAttempts, 2); assert.equal(h.state.handles.size, 0);
});
test('requested-byte cap refuses EOF before its underlying read attempt', () => {
  const h = fixture({ limits: { maxRequestedBytes: 4096 } }), value = h.run(); stopped(value, 'E_LIMIT', 'HOST_LOADER');
  assert.equal(value.counts.requestedBytes, 4096); assert.equal(value.counts.readAttempts, 1);
  assert.equal(h.state.handles.size, 0);
});
test('open exception preserves attempt counts and exposes descriptor uncertainty', () => {
  const h = fixture(); h.state.hooks.openSync = () => { throw new Error('SECRET open'); };
  const value = h.run(); stopped(value, 'E_IO', 'HOST_LOADER');
  assert.equal(value.counts.openAttempts, 1); assert.equal(value.counts.opensCompleted, 0);
  assert.equal(value.cleanupUncertain, true); assert.equal(value.counts.fsAccountingUncertain, true);
});
test('fixture is one-shot and refuses per-call overrides without I/O', () => {
  const h = fixture(); stopped(h.api.observeHostRuntimeProviders({ path: '/other' }), 'E_ARGUMENTS', null);
  assert.equal(h.state.events.length, 0); stopped(h.run(), 'E_CONSUMED', null);
});
test('fixture requires an explicit complete mock-only trusted capability set', () => {
  const h = fixture();
  for (const deps of [undefined, {}, { fs: h.adapter }, { ...h.deps, fs }, { ...h.deps, now: null },
    { ...h.deps, inspectElf: null }, { ...h.deps, extra: true }]) {
    assert.throws(() => createHostRuntimeProvidersFixture(h.config, deps), { code: 'E_MOCK_TCB' });
  }
  assert.throws(() => createHostRuntimeProvidersFixture({ ...h.config, mockOnly: false }, h.deps), { code: 'E_MOCK_TCB' });
});
test('fixture configuration getters and proxies cannot run before validation', () => {
  const h = fixture();
  const config = { ...h.config };
  Object.defineProperty(config, 'inputs', { enumerable: true, get() { assert.fail('getter'); } });
  assert.throws(() => createHostRuntimeProvidersFixture(config, h.deps), { code: 'E_MOCK_TCB' });
  const proxy = new Proxy(h.config, { ownKeys() { assert.fail('proxy'); }, getPrototypeOf() { assert.fail('proxy'); } });
  assert.throws(() => createHostRuntimeProvidersFixture(proxy, h.deps), { code: 'E_MOCK_TCB' });
});
test('fixture requires all seven rows without holes, additions or reordering', () => {
  const h = fixture();
  for (const mutate of [rows => rows.pop(), rows => { delete rows[3]; }, rows => rows.push(rows[0]),
    rows => { [rows[2], rows[3]] = [rows[3], rows[2]]; }]) {
    const config = clone(h.config); mutate(config.inputs);
    assert.throws(() => createHostRuntimeProvidersFixture(config, h.deps), { code: 'E_INPUT' });
  }
});
for (const field of ['role', 'root', 'path', 'soname', 'interpreter', 'sourceKind']) test('fixture cannot override fixed ' + field, () => {
  const h = fixture(), config = clone(h.config); config.inputs[2][field] = 'other';
  assert.throws(() => createHostRuntimeProvidersFixture(config, h.deps), { code: 'E_INPUT' });
});
test('fixture cannot promote unknown host inputs into pinned stage evidence', () => {
  const h = fixture(), config = clone(h.config); config.inputs[2].expectedSha256 = '0'.repeat(64);
  assert.throws(() => createHostRuntimeProvidersFixture(config, h.deps), { code: 'E_INPUT' });
});
test('fixture rejects production stage digests and any raised resource limit', () => {
  const h = fixture(), config = clone(h.config); config.inputs[0].expectedSha256 = INPUTS[0].expectedSha256;
  assert.throws(() => createHostRuntimeProvidersFixture(config, h.deps), { code: 'E_INPUT' });
  for (const key of Object.keys(LIMITS)) {
    assert.throws(() => createHostRuntimeProvidersFixture({ ...h.config, limits: { [key]: LIMITS[key] + 1 } }, h.deps),
      { code: 'E_LIMITS' });
  }
});
for (const [key, value] of [['O_RDONLY', 1], ['O_NOFOLLOW', 0], ['O_DIRECTORY', -1], ['O_NONBLOCK', NaN]]) {
  test('invalid readonly/no-follow flag ' + key + ' rejects before I/O', () => {
    const h = fixture(); h.adapter.constants[key] = value;
    assert.throws(() => createHostRuntimeProvidersFixture(h.config, h.deps), { code: 'E_FLAGS' });
    assert.equal(h.state.events.length, 0);
  });
}
test('fixture snapshots inputs, limits, methods and dependencies before observation', () => {
  const h = fixture(); h.config.inputs[0].path = '/other'; h.config.limits.maxReadAttempts = 1;
  h.adapter.readSync = () => assert.fail('replaced method'); h.deps.inspectElf = () => assert.fail('replaced inspector');
  observed(h.run());
});
test('per-role metadata limit rejects oversized inspector output after both closes', () => {
  const h = fixture({ inspect: bytes => ({ ...inspectElf64RequirementsV4(bytes), padding: 'x'.repeat(131072) }) });
  const value = h.run(); stopped(value, 'E_OUTPUT', 'HOST_LOADER');
  assert.equal(value.counts.closesCompleted, 2);
});
test('escaped ASCII counts six bytes per non-ASCII UTF16 unit, including twelve per surrogate pair', () => {
  const make = text => fixture({ inspect: bytes => ({ ...inspectElf64RequirementsV4(bytes), padding: text }) }).run();
  const ascii = make('xxx'), unicode = make('é😀'); observed(ascii); observed(unicode);
  assert.equal(asciiJson(unicode).length - asciiJson(ascii).length, 7 * (18 - 3));
  assert.ok(Buffer.byteLength(JSON.stringify(unicode)) < asciiJson(unicode).length);
});
test('escaped ASCII publication includes LF and accepts exactly two MiB but rejects one more', () => {
  const capture = extra => fixture({ inspect(bytes, index) {
    return { ...inspectElf64RequirementsV4(bytes), padding: 'é'.repeat(49000) + (index === 0 ? 'x'.repeat(extra) : '') };
  } }).run();
  let extra = 0, value = capture(extra);
  observed(value);
  for (let attempt = 0; attempt < 6 && asciiJson(value).length !== LIMITS.maxOutputBytes; attempt++) {
    extra += LIMITS.maxOutputBytes - asciiJson(value).length;
    assert.ok(extra >= 0 && extra < 30000); value = capture(extra); observed(value);
  }
  assert.equal(asciiJson(value).length, LIMITS.maxOutputBytes);
  assert.ok(Buffer.byteLength(JSON.stringify(value)) < LIMITS.maxOutputBytes);
  stopped(capture(extra + 1), 'E_OUTPUT', null);
});
test('a lowered output cap cannot leak provisional candidates', () => {
  const h = fixture({ limits: { maxOutputBytes: 4096 } }); const value = h.run(); stopped(value, 'E_OUTPUT');
  assert.equal(h.state.handles.size, 0);
});
