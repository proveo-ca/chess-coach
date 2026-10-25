// SPEC: _spec/tooling/native-ingress/step2.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  HOST_RUNTIME_OPERATION_INPUTS as INPUTS,
  HOST_RUNTIME_OPERATION_LIMITS as LIMITS,
  HOST_RUNTIME_OPERATION_SOURCE_PINS as PINS,
  runRegisteredHostRuntimeProviders,
  runRegisteredHostRuntimeProvidersMock,
} from './host-runtime-providers-operation.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const dataUri = bytes => `data:text/javascript;base64,${Buffer.from(bytes).toString('base64')}`;
const copy = value => JSON.parse(JSON.stringify(value));

test('captured data-URI operation imports and uses only its fixed repository source paths', async () => {
  const bytes = fs.readFileSync(new URL('./host-runtime-providers-operation.mjs', import.meta.url));
  assert.equal(bytes.toString('utf8').includes('import.meta.url'), false);
  const captured = await import(dataUri(bytes));
  assert.deepEqual(captured.HOST_RUNTIME_OPERATION_INPUTS, INPUTS);
  const state = fixture();
  const response = await captured.runRegisteredHostRuntimeProvidersMock(state.config);
  assert.equal(response.exitCode, 0);
  const result = JSON.parse(response.text);
  assert.equal(result.status, 'MOCK_HOST_RUNTIME_CANDIDATES_OBSERVED');
  assert.equal(result.sourceCounts.sourceReads, 5);
  assert.equal(result.sourceCounts.positiveCloses, 5);
  assert.equal(state.observerCalls, 1);
});
const names = ['helper', 'elf4', 'staging', 'metadata', 'receipt'];
const filenames = {
  helper: './host-runtime-providers.mjs', elf4: './elf-requirements-v4.mjs',
  staging: './xz-staging.mjs', metadata: './elf-metadata.mjs',
  receipt: '../../_spec/tooling/native-ingress/xz-qualification.receipt.json',
};
const repositoryPaths = Object.fromEntries(names.map(name => [name, fileURLToPath(new URL(filenames[name], import.meta.url))]));
const paths = Object.fromEntries(names.map(name => [name, name === 'receipt'
  ? '/tmp/opencode/f9-bootstrap-correspondence/_spec/tooling/native-ingress/xz-qualification.receipt.json'
  : '/tmp/opencode/f9-bootstrap-correspondence/tooling/native-ingress/' + filenames[name].slice(2)]));
function pinnedRepositorySource(name) {
  const pin = PINS.raw[name];
  assert.ok(pin && pin.bytes > 0 && pin.bytes <= 262144);
  const before = fs.lstatSync(repositoryPaths[name], { bigint: true });
  assert.equal(before.isFile(), true);
  assert.equal(before.size, BigInt(pin.bytes));
  const fd = fs.openSync(repositoryPaths[name], fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  let bytes;
  try {
    const initial = fs.fstatSync(fd, { bigint: true });
    for (const key of ['dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtimeNs', 'ctimeNs']) {
      assert.equal(initial[key], before[key]);
    }
    bytes = Buffer.alloc(pin.bytes);
    for (let offset = 0; offset < bytes.length; offset += 65536) {
      const length = Math.min(65536, bytes.length - offset);
      assert.equal(fs.readSync(fd, bytes, offset, length, offset), length);
    }
    assert.equal(fs.readSync(fd, Buffer.alloc(1), 0, 1, bytes.length), 0);
    const final = fs.fstatSync(fd, { bigint: true });
    const named = fs.lstatSync(repositoryPaths[name], { bigint: true });
    for (const key of ['dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtimeNs', 'ctimeNs']) {
      assert.equal(final[key], before[key]);
      assert.equal(named[key], before[key]);
    }
  } finally { fs.closeSync(fd); }
  assert.equal(digest(bytes), pin.sha256);
  return bytes;
}
const repositorySources = Object.fromEntries(names.filter(name => name !== 'helper').map(name =>
  [name, pinnedRepositorySource(name)]));
const deliveredHelper = pinnedRepositorySource('helper');
const fakeHelper = Buffer.from("import { inspectElf64RequirementsV4 } from './elf-requirements-v4.mjs';\nexport const mockOnly = true;\n");
const linkedStage = Buffer.from(repositorySources.staging.toString().replace("'./elf-metadata.mjs'",
  `'${dataUri(repositorySources.metadata)}'`));
const fakeLinkedHelper = Buffer.from(fakeHelper.toString().replace("'./elf-requirements-v4.mjs'",
  `'${dataUri(repositorySources.elf4)}'`));
const deliveredLinkedHelper = Buffer.from(deliveredHelper.toString().replace("'./elf-requirements-v4.mjs'",
  `'${dataUri(repositorySources.elf4)}'`));
const HELPER_FLAGS = {
  scope: 'CANDIDATE_DATA_NOT_RUNTIME_ADMISSION',
  nativeQualified: false, nativeAuthority: false, rustReady: false, trainingReady: false,
  loaderClosureVerified: false, runtimeProvidersQualified: false, pythonFreeSubsetVerified: false,
  installedUsability: false, imagePrepared: false, dockerProviderQualified: false,
  symbolBindingsVerified: false, hardRssBounded: false, hardDeadlineGuaranteed: false,
  processTreeBounded: false, ancestorRacesExcluded: false, sourceAuthentication: false,
  sourceRootAuthentication: false, atomicSnapshot: false, candidateExecuted: false,
  provenanceVerified: false, noPythonRuntimeVerified: false, decoderQualified: false,
};
const stageModule = {
  XZ_STAGING_PROFILE: {
    profile: 'fixed-xz-ordinary-staging-v1', root: INPUTS[0].root,
    images: [
      { source: '/usr/bin/xz', name: 'xz' },
      { source: '/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2', name: INPUTS[0].soname,
        size: INPUTS[0].expectedBytes, sha256: INPUTS[0].expectedSha256,
        soname: INPUTS[0].soname, interpreter: INPUTS[0].interpreter },
      { source: '/lib/x86_64-linux-gnu/liblzma.so.5.8.3', name: 'liblzma.so.5' },
      { source: '/lib/x86_64-linux-gnu/libc.so.6', name: INPUTS[1].soname,
        size: INPUTS[1].expectedBytes, sha256: INPUTS[1].expectedSha256,
        soname: INPUTS[1].soname, interpreter: INPUTS[1].interpreter },
    ],
  },
};

function identity(index, directory, size) {
  return { dev: '91', ino: String(100 + index), mode: String(directory ? 0o40755 : 0o100644),
    uid: '0', gid: '0', nlink: directory ? '2' : '1', size: String(directory ? 4096 : size),
    mtimeNs: '1', ctimeNs: '1' };
}

function frame(input, size, sha256) {
  return {
    profile: 'elf64le-x86-64-requirements-v4', state: 'ELF_REQUIREMENTS_METADATA',
    byteLength: size, inputSha256: sha256,
    header: { type: 3, machine: 62, version: 1, osAbi: 0, abiVersion: 0, entryPoint: '0',
      flags: 0, programHeaderOffset: '64', programHeaderCount: 0, programHeaderBytes: 56 },
    programHeaders: [], interpreter: input.interpreter,
    dynamic: { present: true, declaredSlots: 1, activeEntries: 1, needed: [], soname: input.soname,
      rpath: null, runpath: null, stringTable: null, unknownTags: [] },
    requirements: { versionNeeds: [], versionDefinitions: [], notes: [], buildIds: [], abiTags: [], properties: [],
      symbolBindingsVerified: false, hardwareCompatibilityVerified: false, instructionCoverageVerified: false,
      propertyEnforcementVerified: false, buildIdAuthenticated: false },
    candidateExecuted: false, decoderQualified: false, realCandidateRead: false, realArchiveInspected: false,
    provenanceVerified: false, noPythonRuntimeVerified: false, loaderClosureVerified: false,
    nativeAuthority: false, nativeQualified: false, installedUsability: false, rustReady: false, trainingReady: false,
  };
}

function observation() {
  const bodyBytes = INPUTS.reduce((total, input) => total + (input.expectedBytes ?? 64), 0);
  return {
    profile: 'host-runtime-providers-v1', status: 'HOST_RUNTIME_CANDIDATES_OBSERVED', mockOnly: true,
    candidates: INPUTS.map((input, index) => {
      const size = input.expectedBytes ?? 64;
      const sha256 = input.expectedSha256 ?? digest(Buffer.alloc(size, index));
      return { role: input.role, path: input.path, root: input.root, sourceKind: input.sourceKind, size, sha256,
        rootMetadata: copy(input.rootIdentity ?? identity(99, true, size)),
        fileMetadata: copy(input.fileIdentity ?? identity(index + 10, false, size)),
        requirements: frame(input, size, sha256) };
    }),
    counts: { fsOperationsAttempted: 134, fsOperationsCompleted: 134,
      openAttempts: 14, opensCompleted: 14, lstatAttempts: 28, lstatsCompleted: 28,
      fstatAttempts: 28, fstatsCompleted: 28, readAttempts: 50, readsCompleted: 50,
      requestedBytes: bodyBytes + 7, returnedBytes: bodyBytes, closeAttempts: 14, closesCompleted: 14,
      clockReads: 500, clockReadsCompleted: 500, filesAdmitted: 7, admittedBytes: bodyBytes,
      capturedFiles: 7, inspectedFiles: 7, allocatedBytes: bodyBytes + 7, peakOwnedFds: 2, ownedFds: 0,
      fsAccountingUncertain: false, readAccountingUncertain: false },
    ioAccountingComplete: true, closeFailed: false, cleanupUncertain: false, cleanupOverrun: false, privateSnapshot: true,
    ...HELPER_FLAGS,
    runtimeQualified: false, abiQualified: false, symbolBindingsVerified: false, dockerQualified: false,
    noPythonRuntimeVerified: false, sourceAuthenticated: false, publisherAuthenticated: false,
    candidateExecuted: false, rustReady: false, trainingReady: false,
  };
}

function fixture(options = {}) {
  const sources = { helper: fakeHelper, ...repositorySources, ...options.sources };
  const events = [];
  const handles = new Map();
  let fdNext = 10;
  const stats = Object.fromEntries(names.map((name, index) => [name, {
    dev: 1n, ino: BigInt(index + 1), mode: 0o100644n, uid: 1000n, gid: 1000n,
    nlink: 1n, size: BigInt(sources[name].length), mtimeNs: 1n, ctimeNs: 1n,
  }]));
  const pathName = path => {
    const name = names.find(name => paths[name] === path);
    assert.ok(name, 'mock admits only five repository source paths');
    return name;
  };
  const adapter = {
    lstatSync(path, config) {
      const name = pathName(path);
      assert.equal(config.bigint, true);
      events.push(['lstat', name]);
      return options.named?.(name, events, stats[name]) ?? { ...stats[name] };
    },
    fstatSync(fd, config) {
      const name = handles.get(fd);
      assert.ok(name);
      assert.equal(config.bigint, true);
      events.push(['fstat', name]);
      return options.fdstat?.(name, events, stats[name]) ?? { ...stats[name] };
    },
    openSync(path, flags) {
      const name = pathName(path);
      events.push(['open', name, flags]);
      assert.ok(flags & fs.constants.O_NOFOLLOW);
      assert.ok(flags & fs.constants.O_NONBLOCK);
      assert.equal(handles.size, 0);
      if (options.openFailure === name) throw new Error('secret open message');
      const fd = fdNext++;
      handles.set(fd, name);
      return fd;
    },
    readSync(fd, target, offset, length, position) {
      const name = handles.get(fd);
      assert.ok(name);
      assert.ok(length <= 65536);
      events.push(['read', name, position, length]);
      if (options.readFailure === name) throw new Error('secret read message');
      if (options.eofFailure === name && position === sources[name].length) return 1;
      if (options.zeroRead === name && position === 0) return 0;
      const count = Math.min(length, sources[name].length - position, options.shortReads ?? Infinity);
      if (count === 0) return 0;
      sources[name].copy(target, offset, position, position + count);
      return count;
    },
    closeSync(fd) {
      const name = handles.get(fd);
      assert.ok(name, 'no double close');
      events.push(['close', name]);
      handles.delete(fd);
      if (options.closeFailure === name) throw new Error('secret close message');
    },
  };
  let observerCalls = 0;
  let current = 0;
  const helperModule = {
    HOST_RUNTIME_INPUTS: copy(INPUTS), HOST_RUNTIME_LIMITS: copy(LIMITS),
    observeHostRuntimeProviders(...args) {
      assert.equal(args.length, 0);
      observerCalls++;
      events.push(['observe']);
      if (options.observer) return options.observer({ args, events, advance: value => { current += value; } });
      return options.result ?? observation();
    },
  };
  options.helperModule?.(helperModule);
  const imports = [];
  const config = {
    mockOnly: true, fs: adapter,
    now: options.now ?? (() => current),
    async moduleImporter(value) {
      assert.equal(handles.size, 0);
      assert.equal(events.filter(event => event[0] === 'close').length, 5);
      imports.push(value);
      events.push(['import', imports.length]);
      if (options.importFailure) throw new Error('secret import message');
      if (options.importer) return options.importer(value, imports.length, helperModule);
      if (imports.length === 1) {
        assert.equal(value, dataUri(linkedStage));
        return options.stagingModule ?? stageModule;
      }
      assert.equal(value, dataUri(fakeLinkedHelper));
      return helperModule;
    },
    helperPin: { bytes: sources.helper.length, sha256: digest(sources.helper) },
    linkedHelperPin: { bytes: fakeLinkedHelper.length, sha256: digest(fakeLinkedHelper) },
  };
  options.config?.(config);
  return { config, events, imports, handles, stats, helperModule, get observerCalls() { return observerCalls; },
    run: () => runRegisteredHostRuntimeProvidersMock(config) };
}

async function runCase(options) {
  const state = fixture(options);
  const response = await state.run();
  const result = JSON.parse(response.text);
  assert.deepEqual(Object.keys(response), ['exitCode', 'text']);
  assert.equal(Object.isFrozen(response), true);
  assert.match(response.text, /^[\x00-\x7f]*\n$/);
  assert.equal(response.text.endsWith('\n\n'), false);
  assert.ok(Buffer.byteLength(response.text) <= LIMITS.maxOutputBytes);
  assert.equal(result.mockOnly, true);
  assert.equal(result.nativeQualified, false);
  assert.equal(result.rustReady, false);
  assert.equal(result.trainingReady, false);
  assert.equal(state.handles.size, 0);
  return { state, response, result };
}

function stopped(value, code) {
  assert.equal(value.response.exitCode, 1);
  assert.equal(value.result.status, 'MOCK_HOST_RUNTIME_PROVIDERS_STOP');
  if (code) assert.equal(value.result.code, code);
  assert.equal(Object.hasOwn(value.result, 'candidates'), false);
  assert.equal(value.response.text.includes('secret '), false);
  for (const input of INPUTS) assert.equal(value.response.text.includes(input.path), false);
  for (const candidate of observation().candidates) assert.equal(value.response.text.includes(candidate.sha256), false);
}

test('production accepts no public arguments and consumes rejected calls without provider I/O', async () => {
  assert.equal(runRegisteredHostRuntimeProviders.length, 0);
  const first = await runRegisteredHostRuntimeProviders({});
  assert.equal(JSON.parse(first.text).code, 'E_ARGUMENTS');
  const second = await runRegisteredHostRuntimeProviders();
  assert.equal(JSON.parse(second.text).code, 'E_ONESHOT');
});

test('five repository source pins and both linked graph pins match complete bytes', () => {
  for (const name of names.filter(name => name !== 'helper')) {
    assert.equal(repositorySources[name].length, PINS.raw[name].bytes);
    assert.equal(digest(repositorySources[name]), PINS.raw[name].sha256);
  }
  assert.equal(linkedStage.length, PINS.linked.staging.bytes);
  assert.equal(digest(linkedStage), PINS.linked.staging.sha256);
  assert.equal(deliveredHelper.length, PINS.raw.helper.bytes);
  assert.equal(digest(deliveredHelper), PINS.raw.helper.sha256);
  assert.equal(deliveredLinkedHelper.length, PINS.linked.helper.bytes);
  assert.equal(digest(deliveredLinkedHelper), PINS.linked.helper.sha256);
});

test('exact seven-input order, staged paths, and five unauthenticated unknowns', () => {
  assert.deepEqual(INPUTS.map(input => input.role), ['HOST_LOADER', 'HOST_LIBC', 'HOST_LIBM', 'HOST_LIBDL',
    'HOST_LIBPTHREAD', 'HOST_LIBRT', 'HOST_LIBGCC_S']);
  assert.equal(INPUTS.length, 7);
  for (const input of INPUTS) {
    assert.equal(Object.isFrozen(input), true);
    assert.deepEqual(Object.keys(input), ['role', 'root', 'path', 'soname', 'interpreter', 'sourceKind',
      'expectedBytes', 'expectedSha256', 'rootIdentity', 'fileIdentity']);
    assert.equal(input.path, `${input.root}/${input.soname}`);
    assert.equal(input.role.includes('TARGET'), false);
  }
  for (const input of INPUTS.slice(2)) {
    assert.equal(input.root, '/usr/lib/x86_64-linux-gnu');
    assert.equal(input.sourceKind, 'ORDINARY_HOST_CANDIDATE_UNAUTHENTICATED');
    for (const key of ['expectedBytes', 'expectedSha256', 'rootIdentity', 'fileIdentity', 'interpreter']) {
      assert.equal(input[key], null);
    }
  }
});

test('two staged constants use receipt metadata but staging profile body hashes', () => {
  const receipt = JSON.parse(repositorySources.receipt);
  for (const [input, index] of [[INPUTS[0], 1], [INPUTS[1], 3]]) {
    assert.deepEqual(input.rootIdentity, receipt.staged.directory);
    assert.deepEqual(input.fileIdentity, receipt.staged.files[index].metadata);
    assert.equal(Object.hasOwn(receipt.staged.files[index], 'sha256'), false);
    assert.equal(input.sourceKind, 'PINNED_ORDINARY_STAGE');
  }
});

test('all seven candidates publish atomically through the linked helper URI and zero arguments', async () => {
  const value = await runCase();
  assert.equal(value.response.exitCode, 0);
  assert.equal(value.result.status, 'MOCK_HOST_RUNTIME_CANDIDATES_OBSERVED');
  assert.equal(value.result.candidates.length, 7);
  assert.equal(value.state.observerCalls, 1);
  assert.deepEqual(value.state.imports, [dataUri(linkedStage), dataUri(fakeLinkedHelper)]);
  assert.equal(value.result.sourceCounts.closeAttempts, 5);
  assert.equal(value.result.sourceCounts.positiveCloses, 5);
  assert.equal(value.result.counts.closesCompleted, 14);
  assert.equal(value.result.sourceCounts.peakOwnedFds, 1);
  assert.equal(value.result.evidenceScope, 'CANDIDATE_DATA_NOT_RUNTIME_ADMISSION');
  assert.equal(value.result.candidates[2].sourceKind, 'ORDINARY_HOST_CANDIDATE_UNAUTHENTICATED');
  assert.equal(value.result.sourceAuthenticated, false);
});

for (const name of ['helper', 'elf4', 'receipt']) {
  test(`oversized ${name} stops before opening or allocating its body`, async () => {
    const value = await runCase({ named: (current, events, stat) => current === name ?
      { ...stat, size: stat.size + 1n } : undefined });
    stopped(value, 'E_SOURCE_LENGTH');
    assert.equal(value.state.events.some(event => event[0] === 'open' && event[1] === name), false);
    assert.equal(value.state.imports.length, 0);
  });
}

test('symlink metadata stops without opening source', async () => {
  const value = await runCase({ named: (name, events, stat) => name === 'helper' ?
    { ...stat, mode: 0o120777n } : undefined });
  stopped(value, 'E_SOURCE_METADATA');
  assert.equal(value.result.sourceCounts.allocatedBytes, 0);
});

test('named/FD binding failure allocates no body and positively closes', async () => {
  const value = await runCase({ fdstat: (name, events, stat) => name === 'helper' ?
    { ...stat, ino: stat.ino + 1n } : undefined });
  stopped(value, 'E_SOURCE_BINDING');
  assert.equal(value.result.sourceCounts.allocatedBytes, 0);
  assert.equal(value.result.sourceCounts.positiveCloses, 1);
});

test('metadata changes after capture suppress imports', async () => {
  const value = await runCase({ named: (name, events, stat) => name === 'helper' &&
    events.some(event => event[0] === 'read') ? { ...stat, ctimeNs: 2n } : undefined });
  stopped(value, 'E_SOURCE_BINDING');
  assert.equal(value.result.sourceCounts.positiveCloses, 1);
  assert.equal(value.state.imports.length, 0);
});

test('same FD EOF probe rejects extra bytes and closes', async () => {
  const value = await runCase({ eofFailure: 'helper' });
  stopped(value, 'E_SOURCE_LENGTH');
  assert.equal(value.result.sourceCounts.positiveCloses, 1);
});

test('short positive reads complete bounded same FD capture', async () => {
  const value = await runCase({ shortReads: 512 });
  assert.equal(value.response.exitCode, 0);
  assert.ok(value.result.sourceCounts.readAttempts > 100);
  assert.ok(value.result.sourceCounts.readAttempts <= 640);
});

test('read attempts cap prevents one-byte read amplification', async () => {
  const value = await runCase({ shortReads: 1 });
  stopped(value, 'E_SOURCE_LIMIT');
  assert.equal(value.state.imports.length, 0);
});

for (const [option, expected] of [['openFailure', 'E_SOURCE_IO'], ['readFailure', 'E_SOURCE_IO'],
  ['zeroRead', 'E_SOURCE_LENGTH'], ['closeFailure', 'E_SOURCE_CLOSE']]) {
  test(`${option} stops all later files and cleans ownership once`, async () => {
    const value = await runCase({ [option]: 'helper' });
    stopped(value, expected);
    assert.equal(value.state.events.some(event => event[0] === 'open' && event[1] !== 'helper'), false);
    assert.equal(value.state.events.filter(event => event[0] === 'close').length, option === 'openFailure' ? 0 : 1);
    if (option === 'closeFailure') {
      assert.equal(value.result.sourceAccountingComplete, false);
      assert.equal(value.result.sourceCloseFailed, true);
    }
  });
}

test('source digest mismatch suppresses all linking and imports', async () => {
  const corrupt = Buffer.from(repositorySources.elf4);
  corrupt[100] ^= 1;
  const value = await runCase({ sources: { elf4: corrupt } });
  stopped(value, 'E_SOURCE_HASH');
  assert.equal(value.state.imports.length, 0);
  assert.equal(value.result.sourceCounts.positiveCloses, 2);
});

test('linked helper complete bytes and digest must match before import', async () => {
  const value = await runCase({ config: config => { config.linkedHelperPin.sha256 = '0'.repeat(64); } });
  stopped(value, 'E_LINK');
  assert.equal(value.state.imports.length, 0);
});

test('helper dependency must occur exactly once', async () => {
  const duplicate = Buffer.concat([fakeHelper, Buffer.from("// './elf-requirements-v4.mjs'\n")]);
  const value = await runCase({ sources: { helper: duplicate } });
  stopped(value, 'E_LINK');
});

test('import failure never calls the observer', async () => {
  const value = await runCase({ importFailure: true });
  stopped(value, 'E_IMPORT');
  assert.equal(value.state.observerCalls, 0);
});

for (const field of ['path', 'sourceKind', 'expectedBytes', 'rootIdentity']) {
  test(`helper input ${field} drift rejects before observation`, async () => {
    const value = await runCase({ helperModule: helper => { helper.HOST_RUNTIME_INPUTS[2][field] = 'drift'; } });
    stopped(value, 'E_CONSTANTS');
    assert.equal(value.state.observerCalls, 0);
  });
}

test('helper limit drift rejects without lowering established gates', async () => {
  const value = await runCase({ helperModule: helper => { helper.HOST_RUNTIME_LIMITS.maxFileBytes--; } });
  stopped(value, 'E_CONSTANTS');
});

test('staging source path differs legitimately from newly observed staged path', async () => {
  const value = await runCase();
  assert.equal(value.response.exitCode, 0);
  assert.notEqual(stageModule.XZ_STAGING_PROFILE.images[1].source, INPUTS[0].path);
});

test('old staging functions are never invoked', async () => {
  const stagingModule = { ...stageModule };
  for (const name of ['stageXzImages', 'verifyStagedXzImages', 'assertNoSystemPreload']) {
    Object.defineProperty(stagingModule, name, { get() { assert.fail('old operation access'); } });
  }
  const value = await runCase({ stagingModule });
  assert.equal(value.response.exitCode, 0);
});

test('seventh helper STOP strips malicious candidates, paths, bodies and hashes', async () => {
  const result = observation();
  result.status = 'STOP';
  result.role = 'HOST_LIBGCC_S';
  result.error = 'E_IO';
  result.flags = copy(HELPER_FLAGS);
  result.ioAccountingComplete = false;
  result.message = 'secret diagnostic';
  Object.defineProperty(result, 'candidates', { enumerable: true, get() { assert.fail('partial candidates read'); } });
  const value = await runCase({ result });
  stopped(value, 'E_HELPER_STOP');
  assert.equal(value.result.role, 'HOST_LIBGCC_S');
});

for (const key of ['closeFailed', 'cleanupUncertain']) {
  test(`${key} on seventh candidate suppresses every candidate hash`, async () => {
    const result = observation();
    result[key] = true;
    stopped(await runCase({ result }), 'E_ACCOUNTING');
  });
}

for (const mutation of ['soname', 'interpreter', 'hash', 'length', 'machine', 'type']) {
  test(`seventh ELF ${mutation} mismatch suppresses complete batch`, async () => {
    const result = observation();
    const frame = result.candidates[6].requirements;
    if (mutation === 'soname') frame.dynamic.soname += '.alias';
    if (mutation === 'interpreter') frame.interpreter = '/lib64/ld-linux-x86-64.so.2';
    if (mutation === 'hash') frame.inputSha256 = '0'.repeat(64);
    if (mutation === 'length') frame.byteLength++;
    if (mutation === 'machine') frame.header.machine = 183;
    if (mutation === 'type') frame.header.type = 1;
    stopped(await runCase({ result }), 'E_ELF');
  });
}

for (const [key, value] of [['nativeQualified', true], ['runtimeQualified', true], ['abiQualified', true],
  ['symbolBindingsVerified', true], ['dockerQualified', true], ['noPythonRuntimeVerified', true],
  ['mockOnly', false]]) {
  test(`helper cannot promote ${key}`, async () => {
    const result = observation();
    result[key] = value;
    stopped(await runCase({ result }), key === 'mockOnly' ? 'E_HELPER_DATA' : 'E_QUALIFICATION');
  });
}

test('seventh candidate unknown sourceKind cannot inherit staged provenance', async () => {
  const result = observation();
  result.candidates[6].sourceKind = 'PINNED_ORDINARY_STAGE';
  stopped(await runCase({ result }), 'E_CANDIDATES');
});

test('unknown host metadata requires public root ownership and non-writable libraries', async () => {
  const result = observation();
  result.candidates[6].fileMetadata.mode = String(0o100666);
  stopped(await runCase({ result }), 'E_CANDIDATES');
});

test('all fourteen successful helper closes are necessary independently from source closes', async () => {
  const result = observation();
  result.counts.closesCompleted = 13;
  stopped(await runCase({ result }), 'E_ACCOUNTING');
});

test('one-second source preflight rejects and positively closes owned descriptor', async () => {
  let ticks = 0;
  const value = await runCase({ now: () => ++ticks < 4 ? 0 : 1001 });
  stopped(value, 'E_PREFLIGHT');
  assert.equal(value.state.observerCalls, 0);
});

test('imports remain inside the original one-second preflight', async () => {
  let time = 0;
  const value = await runCase({ now: () => time,
    importer: (uri, index, helper) => { time = 1001; return index === 1 ? stageModule : helper; } });
  stopped(value, 'E_PREFLIGHT');
  assert.equal(value.state.observerCalls, 0);
});

test('exactly one-second preflight leaves the full ten-second helper budget', async () => {
  let time = 0;
  const value = await runCase({ now: () => time, importer: (uri, index, helper) => {
    time = 1000;
    return index === 1 ? stageModule : helper;
  }, observer: () => { time += 10000; return observation(); } });
  assert.equal(value.response.exitCode, 0);
});

test('eleven-second outer guard cannot reset at helper entry', async () => {
  let time = 0;
  const value = await runCase({ now: () => time, importer: (uri, index, helper) => {
    time = 999;
    return index === 1 ? stageModule : helper;
  }, observer: () => { time += 10002; return observation(); } });
  stopped(value, 'E_OUTER');
});

for (const invalid of [NaN, Infinity, -Infinity, '0']) {
  test(`non-finite or non-numeric clock ${String(invalid)} fails closed`, async () => {
    stopped(await runCase({ now: () => invalid }), 'E_CLOCK');
  });
}

test('backwards clock fails closed without resetting origin', async () => {
  let count = 0;
  stopped(await runCase({ now: () => ++count < 5 ? 10 : 9 }), 'E_CLOCK');
});

test('output escapes non-ASCII UTF-16 units and DEL including exactly one LF', async () => {
  const result = observation();
  result.candidates[6].requirements.dynamic.rpath = 'é😀\u007f\b\n\\"';
  const value = await runCase({ result });
  assert.equal(value.response.exitCode, 0);
  assert.ok(value.response.text.includes('\\u00e9\\ud83d\\ude00\\u007f'));
  assert.equal(value.result.candidates[6].requirements.dynamic.rpath, 'é😀\u007f\b\n\\"');
});

test('complete envelope accepts exact 2 MiB with LF and rejects one more ASCII byte', async () => {
  const empty = observation();
  empty.candidates[6].requirements.dynamic.rpath = '';
  const base = await runCase({ result: empty });
  const fill = LIMITS.maxOutputBytes - base.response.text.length;
  const exact = observation();
  exact.candidates[6].requirements.dynamic.rpath = 'x'.repeat(fill);
  const accepted = await runCase({ result: exact });
  assert.equal(accepted.response.exitCode, 0);
  assert.equal(accepted.response.text.length, LIMITS.maxOutputBytes);
  exact.candidates[6].requirements.dynamic.rpath += 'x';
  stopped(await runCase({ result: exact }), 'E_OUTPUT');
});

test('six-byte Unicode expansion rejects oversize before publication serialization', async () => {
  const result = observation();
  result.candidates[6].requirements.dynamic.rpath = 'é'.repeat(Math.ceil(LIMITS.maxOutputBytes / 6));
  stopped(await runCase({ result }), 'E_OUTPUT');
});

test('proxy result never executes proxy traps', async () => {
  const result = new Proxy({}, { get() { assert.fail('get trap'); }, ownKeys() { assert.fail('ownKeys trap'); },
    getPrototypeOf() { assert.fail('prototype trap'); } });
  stopped(await runCase({ result }), 'E_HELPER_DATA');
});

test('getter candidate never executes getter', async () => {
  const result = observation();
  Object.defineProperty(result.candidates[6], 'sha256', { enumerable: true, get() { assert.fail('hash getter'); } });
  stopped(await runCase({ result }), 'E_HELPER_DATA');
});

test('shared and resizable byte buffers cannot enter public metadata', async () => {
  for (const payload of [new SharedArrayBuffer(8), new ArrayBuffer(8, { maxByteLength: 16 }), new Uint8Array(8)]) {
    const result = observation();
    result.candidates[6].requirements.dynamic.rpath = payload;
    stopped(await runCase({ result }), 'E_HELPER_DATA');
  }
});

test('mock configuration cannot omit fake FS, importer, clock, or mockOnly', async () => {
  for (const key of ['fs', 'moduleImporter', 'now', 'mockOnly']) {
    const state = fixture();
    delete state.config[key];
    const response = await state.run();
    assert.equal(JSON.parse(response.text).code, 'E_CONFIG');
    assert.equal(JSON.parse(response.text).mockOnly, true);
    assert.equal(state.events.length, 0);
  }
});

test('mock output snapshots caller data and exposes no stale .result API', async () => {
  const result = observation();
  const value = await runCase({ result });
  const text = value.response.text;
  result.candidates[6].sha256 = 'f'.repeat(64);
  assert.equal(value.response.text, text);
  assert.equal(Object.hasOwn(value.response, 'result'), false);
  assert.equal(Object.isFrozen(value.response), true);
});

test('sixth candidate failure also suppresses the entire seven-source batch', async () => {
  const result = observation();
  result.candidates[5].requirements.inputSha256 = '0'.repeat(64);
  const value = await runCase({ result });
  stopped(value, 'E_ELF');
  assert.equal(value.result.role, 'HOST_LIBRT');
});

test('helper STOP publishes bounded counters and uncertainty without candidate data', async () => {
  const result = observation();
  result.status = 'STOP';
  result.role = 'HOST_LIBGCC_S';
  result.error = 'E_CLOSE';
  result.flags = copy(HELPER_FLAGS);
  result.closeFailed = true;
  result.cleanupUncertain = true;
  result.ioAccountingComplete = false;
  result.counts.closesCompleted = 13;
  const value = await runCase({ result });
  stopped(value, 'E_HELPER_STOP');
  assert.equal(value.result.helperCode, 'E_CLOSE');
  assert.equal(value.result.helperCloseFailed, true);
  assert.equal(value.result.helperCleanupUncertain, true);
  assert.equal(value.result.helperIoAccountingComplete, false);
  assert.equal(value.result.sourceAccountingComplete, true);
});

test('malicious STOP counter metadata cannot leak paths or nonnumeric data', async () => {
  const result = observation();
  result.status = 'STOP';
  result.role = 'HOST_LIBGCC_S';
  result.error = 'E_IO';
  result.flags = copy(HELPER_FLAGS);
  result.ioAccountingComplete = false;
  result.counts.extra = INPUTS[6].path;
  const value = await runCase({ result });
  stopped(value, 'E_HELPER_STOP');
  assert.equal(Object.hasOwn(value.result, 'helperCounts'), false);
});

test('unknown helper error code is replaced with a fixed code', async () => {
  const result = observation();
  result.status = 'STOP';
  result.role = 'HOST_LIBGCC_S';
  result.error = 'E_PRIVATE_NONCE_123';
  result.flags = copy(HELPER_FLAGS);
  result.ioAccountingComplete = false;
  const value = await runCase({ result });
  stopped(value, 'E_HELPER_STOP');
  assert.equal(value.result.helperCode, 'E_HELPER_STOP');
  assert.equal(value.response.text.includes('NONCE'), false);
});

test('no inherited toJSON runs during publication', async () => {
  const result = observation();
  const state = fixture({ result });
  let invoked = false;
  const previous = Object.getOwnPropertyDescriptor(Array.prototype, 'toJSON');
  try {
    Object.defineProperty(Array.prototype, 'toJSON', { configurable: true,
      get() { invoked = true; throw new Error('secret inherited serialization getter'); } });
    const response = await state.run();
    assert.equal(response.exitCode, 0);
    assert.equal(invoked, false);
  } finally {
    if (previous) Object.defineProperty(Array.prototype, 'toJSON', previous);
    else Reflect.deleteProperty(Array.prototype, 'toJSON');
  }
});

test('cyclic candidate data fails closed', async () => {
  const result = observation();
  result.candidates[6].requirements.dynamic.loop = result;
  stopped(await runCase({ result }), 'E_HELPER_DATA');
});

test('sparse and accessor arrays fail closed without reading accessors', async () => {
  for (const accessor of [false, true]) {
    const result = observation();
    let invoked = false;
    if (accessor) {
      Object.defineProperty(result.candidates, '6', { enumerable: true,
        get() { invoked = true; return null; } });
    } else {
      Reflect.deleteProperty(result.candidates, '6');
    }
    stopped(await runCase({ result }), 'E_HELPER_DATA');
    assert.equal(invoked, false);
  }
});

test('non-ordinary data prototypes cannot enter the public envelope', async () => {
  const result = observation();
  Object.setPrototypeOf(result.candidates[6], { injected: true });
  stopped(await runCase({ result }), 'E_HELPER_DATA');
});

test('nested positive qualification never survives under a data-only field', async () => {
  const result = observation();
  result.candidates[6].requirements.requirements.notes.push({ nativeQualified: true });
  stopped(await runCase({ result }), 'E_QUALIFICATION');
});

test('source stat getters are rejected before invoking them', async () => {
  let invoked = false;
  const value = await runCase({ named: (name, events, stat) => {
    if (name !== 'helper') return undefined;
    const modified = { ...stat };
    Object.defineProperty(modified, 'size', { enumerable: true, get() { invoked = true; return 1n; } });
    return modified;
  } });
  stopped(value, 'E_SOURCE_METADATA');
  assert.equal(invoked, false);
});

test('source close error outranks read error and never retries close', async () => {
  const value = await runCase({ readFailure: 'helper', closeFailure: 'helper' });
  stopped(value, 'E_SOURCE_CLOSE');
  assert.equal(value.state.events.filter(event => event[0] === 'close').length, 1);
  assert.equal(value.result.sourceCloseFailed, true);
});

test('missing repository input has no alternate path or import fallback', async () => {
  const value = await runCase({ openFailure: 'elf4' });
  stopped(value, 'E_SOURCE_IO');
  assert.deepEqual(value.state.events.filter(event => event[0] === 'open').map(event => event[1]), ['helper', 'elf4']);
  assert.equal(value.state.imports.length, 0);
});

test('clock expiry immediately after open still closes the acquired descriptor', async () => {
  const state = fixture();
  let time = 0;
  const originalOpen = state.config.fs.openSync;
  state.config.now = () => time;
  state.config.fs.openSync = (...args) => {
    const fd = originalOpen(...args);
    time = 1001;
    return fd;
  };
  const response = await state.run();
  const result = JSON.parse(response.text);
  stopped({ state, response, result }, 'E_PREFLIGHT');
  assert.equal(state.handles.size, 0);
  assert.equal(result.sourceCounts.closeAttempts, 1);
});

test('publication clock expiry suppresses a fully observed candidate batch', async () => {
  let afterHelper = false;
  let postReads = 0;
  const value = await runCase({ now: () => afterHelper && ++postReads >= 3 ? 11001 : 0,
    observer: () => { afterHelper = true; return observation(); } });
  stopped(value, 'E_OUTER');
  assert.equal(value.state.observerCalls, 1);
});

function publicLibraryBytes(input) {
  const bytes = Buffer.alloc(1024);
  const base = 0x400000n;
  const strings = Buffer.from(`\0${input.soname}\0libc.so.6\0PUBLIC_MOCK_1\0GLIBC_2.2.5\0`);
  const sonameAt = 1;
  const neededAt = sonameAt + Buffer.byteLength(input.soname) + 1;
  const definitionAt = neededAt + Buffer.byteLength('libc.so.6') + 1;
  const versionAt = definitionAt + Buffer.byteLength('PUBLIC_MOCK_1') + 1;
  bytes.set([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1]);
  bytes.writeUInt16LE(3, 16);
  bytes.writeUInt16LE(62, 18);
  bytes.writeUInt32LE(1, 20);
  bytes.writeBigUInt64LE(64n, 32);
  bytes.writeUInt16LE(64, 52);
  bytes.writeUInt16LE(56, 54);
  bytes.writeUInt16LE(input.interpreter === null ? 3 : 4, 56);
  const ph = (index, type, offset, length, alignment) => {
    const at = 64 + index * 56;
    bytes.writeUInt32LE(type, at);
    bytes.writeUInt32LE(4, at + 4);
    bytes.writeBigUInt64LE(BigInt(offset), at + 8);
    bytes.writeBigUInt64LE(base + BigInt(offset), at + 16);
    bytes.writeBigUInt64LE(BigInt(length), at + 32);
    bytes.writeBigUInt64LE(BigInt(length), at + 40);
    bytes.writeBigUInt64LE(BigInt(alignment), at + 48);
  };
  ph(0, 1, 0, bytes.length, 4096);
  ph(1, 2, 320, 144, 8);
  ph(2, 4, 848, 20, 4);
  if (input.interpreter !== null) {
    const interpreter = Buffer.from(`${input.interpreter}\0`);
    ph(3, 3, 784, interpreter.length, 1);
    interpreter.copy(bytes, 784);
  }
  const dynamic = [[1n, BigInt(neededAt)], [5n, base + 640n], [10n, BigInt(strings.length)],
    [14n, BigInt(sonameAt)], [0x6ffffffcn, base + 512n], [0x6ffffffdn, 1n],
    [0x6ffffffen, base + 560n], [0x6fffffffn, 1n], [0n, 0n]];
  for (const [index, [tag, value]] of dynamic.entries()) {
    bytes.writeBigInt64LE(tag, 320 + index * 16);
    bytes.writeBigUInt64LE(value, 328 + index * 16);
  }
  bytes.writeUInt16LE(1, 512);
  bytes.writeUInt16LE(2, 516);
  bytes.writeUInt16LE(1, 518);
  bytes.writeUInt32LE(20, 524);
  bytes.writeUInt32LE(definitionAt, 532);
  bytes.writeUInt16LE(1, 560);
  bytes.writeUInt16LE(1, 562);
  bytes.writeUInt32LE(neededAt, 564);
  bytes.writeUInt32LE(16, 568);
  bytes.writeUInt16LE(2, 582);
  bytes.writeUInt32LE(versionAt, 584);
  strings.copy(bytes, 640);
  bytes.writeUInt32LE(4, 848);
  bytes.writeUInt32LE(4, 852);
  bytes.writeUInt32LE(3, 856);
  bytes.write('GNU\0', 860);
  bytes.set([1, 2, 3, 4], 864);
  return bytes;
}

function publicLibraryModel(options = {}) {
  const inputs = copy(INPUTS);
  const bodies = inputs.map(publicLibraryBytes);
  for (let index = 0; index < 2; index++) {
    inputs[index].expectedBytes = bodies[index].length;
    inputs[index].expectedSha256 = digest(bodies[index]);
    inputs[index].fileIdentity.size = String(bodies[index].length);
  }
  const records = new Map();
  const hostRoot = identity(99, true, 4096);
  inputs.forEach((input, index) => {
    records.set(input.root, { metadata: input.rootIdentity ?? hostRoot, directory: true });
    records.set(input.path, { metadata: input.fileIdentity ?? identity(index + 10, false, bodies[index].length),
      directory: false, body: bodies[index] });
  });
  const handles = new Map();
  const events = [];
  let next = 100;
  const record = path => {
    assert.ok(records.has(path), 'only the two declared roots and seven literal leaves enter fake provider I/O');
    return records.get(path);
  };
  const stat = value => Object.fromEntries(Object.entries(value.metadata).map(([key, field]) => [key, BigInt(field)]));
  const adapter = {
    constants: Object.fromEntries(['O_RDONLY', 'O_NOFOLLOW', 'O_NONBLOCK', 'O_DIRECTORY'].map(name => [name, fs.constants[name]])),
    lstatSync(path, config) {
      assert.equal(config.bigint, true);
      events.push(['lstat', path]);
      return stat(record(path));
    },
    fstatSync(fd, config) {
      assert.equal(config.bigint, true);
      assert.ok(handles.has(fd));
      events.push(['fstat', handles.get(fd)]);
      return stat(record(handles.get(fd)));
    },
    openSync(path, flags) {
      const value = record(path);
      assert.ok(flags & fs.constants.O_NOFOLLOW);
      assert.ok(flags & fs.constants.O_NONBLOCK);
      assert.equal(Boolean(flags & fs.constants.O_DIRECTORY), value.directory);
      assert.ok(handles.size < 2);
      const fd = next++;
      handles.set(fd, path);
      events.push(['open', path]);
      return fd;
    },
    readSync(fd, buffer, offset, length, position) {
      assert.ok(handles.has(fd));
      const path = handles.get(fd);
      const value = record(path);
      assert.equal(value.directory, false);
      assert.ok(length <= 65536);
      events.push(['read', path, position, length]);
      const count = Math.min(length, value.body.length - position);
      if (count) value.body.copy(buffer, offset, position, position + count);
      return count;
    },
    closeSync(fd) {
      assert.ok(handles.has(fd), 'close clears ownership once');
      const path = handles.get(fd);
      handles.delete(fd);
      events.push(['close', path]);
      if (options.closeFailure === path) throw new Error('secret fake provider close error');
    },
  };
  return { inputs, bodies, adapter, events, handles };
}

async function deliveredIntegration(options = {}) {
  const helperUri = dataUri(deliveredLinkedHelper);
  const elfUri = dataUri(repositorySources.elf4);
  const helper = await import(helperUri);
  const elf = await import(elfUri);
  const model = publicLibraryModel(options);
  const inspected = [];
  const observerFixture = helper.createHostRuntimeProvidersFixture({ mockOnly: true, inputs: model.inputs, limits: {} }, {
    fs: model.adapter, now: () => 0,
    inspectElf(bytes) {
      assert.equal(arguments.length, 1);
      assert.equal(model.handles.size, 0, 'both provider descriptors close before qualified ELF inspection');
      const frame = elf.inspectElf64RequirementsV4(bytes);
      inspected.push(frame);
      return frame;
    },
  });
  let observed;
  let calls = 0;
  const state = fixture({ sources: { helper: deliveredHelper }, config: config => {
    config.helperPin = copy(PINS.raw.helper);
    config.linkedHelperPin = copy(PINS.linked.helper);
  }, importer: async (value, index) => {
    if (index === 1) {
      assert.equal(value, dataUri(linkedStage));
      return import(value);
    }
    assert.equal(value, helperUri);
    const namespace = await import(value);
    assert.equal(namespace, helper);
    assert.equal(await import(elfUri), elf);
    return {
      HOST_RUNTIME_INPUTS: namespace.HOST_RUNTIME_INPUTS,
      HOST_RUNTIME_LIMITS: namespace.HOST_RUNTIME_LIMITS,
      observeHostRuntimeProviders(...args) {
        assert.equal(args.length, 0);
        calls++;
        observed = options.canonicalMock ? observation() : observerFixture.observeHostRuntimeProviders();
        return observed;
      },
    };
  } });
  const response = await state.run();
  const result = JSON.parse(response.text);
  assert.equal(model.handles.size, 0);
  return { state, response, result, model, observed, helper, elf, helperUri, elfUri, inspected, calls, observerFixture };
}

test('delivered helper and ELF4 share the exact pinned URI graph and retain strict production constants', async () => {
  const value = await deliveredIntegration({ canonicalMock: true });
  assert.equal(value.response.exitCode, 0);
  assert.equal(value.result.status, 'MOCK_HOST_RUNTIME_CANDIDATES_OBSERVED');
  assert.equal(value.result.mockOnly, true);
  assert.equal(value.calls, 1);
  assert.equal(value.model.events.length, 0, 'the canonical mock observer carries no provider read authority');
  assert.deepEqual(value.helper.HOST_RUNTIME_INPUTS, INPUTS);
  assert.deepEqual(value.helper.HOST_RUNTIME_LIMITS, LIMITS);
  assert.equal(value.helper.observeHostRuntimeProviders.length, 0);
  assert.equal(value.helper.createHostRuntimeProvidersFixture.length, 2);
  assert.equal(value.state.imports[1], value.helperUri);
  assert.equal(deliveredLinkedHelper.toString().split(`'${value.elfUri}'`).length - 1, 1);
  assert.equal(value.result.sourceCounts.positiveCloses, 5);
  assert.equal(value.result.sourceCounts.capturedBytes, 84937);
});

test('delivered helper plus qualified shared ELF4 observes all seven synthetic files without host I/O', async () => {
  const value = await deliveredIntegration();
  assert.equal(value.observed.status, 'HOST_RUNTIME_CANDIDATES_OBSERVED');
  assert.equal(value.observed.mockOnly, true);
  assert.equal(Object.isFrozen(value.observed), true);
  assert.equal(value.observed.candidates.length, 7);
  assert.equal(value.inspected.length, 7);
  assert.equal(value.observed.counts.closesCompleted, 14);
  assert.equal(value.observed.counts.peakOwnedFds, 2);
  assert.equal(value.observed.counts.returnedBytes, 7168);
  assert.equal(value.observed.counts.requestedBytes, 7175);
  for (const [index, candidate] of value.observed.candidates.entries()) {
    assert.equal(candidate.sha256, digest(value.model.bodies[index]));
    assert.equal(candidate.requirements.inputSha256, candidate.sha256);
    assert.equal(candidate.requirements.byteLength, 1024);
    assert.equal(candidate.requirements.profile, 'elf64le-x86-64-requirements-v4');
    assert.equal(candidate.requirements.dynamic.soname, INPUTS[index].soname);
    assert.equal(candidate.requirements.interpreter, INPUTS[index].interpreter);
    assert.deepEqual(candidate.requirements.requirements.versionDefinitions[0].names, ['PUBLIC_MOCK_1']);
    assert.equal(candidate.requirements.requirements.versionNeeds[0].aux[0].name, 'GLIBC_2.2.5');
    assert.deepEqual(candidate.requirements.requirements.buildIds, ['01020304']);
    assert.equal(candidate.requirements.requirements.symbolBindingsVerified, false);
  }
  stopped(value, 'E_CANDIDATES');
  assert.equal(value.result.role, 'HOST_LOADER', 'lowered synthetic stage pins never replace operation production pins');
  for (const candidate of value.observed.candidates) assert.equal(value.response.text.includes(candidate.sha256), false);
});

test('delivered helper seventh-leaf close failure publishes only real STOP fields and counters', async () => {
  const value = await deliveredIntegration({ closeFailure: INPUTS[6].path });
  assert.equal(value.observed.status, 'STOP');
  assert.equal(value.observed.error, 'E_CLOSE');
  assert.equal(value.observed.role, 'HOST_LIBGCC_S');
  assert.equal(Object.hasOwn(value.observed, 'candidates'), false);
  assert.deepEqual(value.observed.flags, HELPER_FLAGS);
  assert.equal(value.inspected.length, 6);
  assert.equal(value.observed.counts.closeAttempts, 14);
  assert.equal(value.observed.counts.closesCompleted, 13);
  stopped(value, 'E_HELPER_STOP');
  assert.equal(value.result.role, 'HOST_LIBGCC_S');
  assert.equal(value.result.helperCode, 'E_CLOSE');
  assert.equal(value.result.helperCloseFailed, true);
  assert.equal(value.result.helperCleanupUncertain, true);
  assert.equal(value.result.helperIoAccountingComplete, false);
  assert.equal(value.result.sourceAccountingComplete, true);
  assert.deepEqual(value.result.helperFlags, HELPER_FLAGS);
});

test('delivered helper fixture is one-shot and never reuses candidate metadata after consumption', async () => {
  const value = await deliveredIntegration();
  const before = value.model.events.length;
  const consumed = value.observerFixture.observeHostRuntimeProviders();
  assert.equal(consumed.status, 'STOP');
  assert.equal(consumed.error, 'E_CONSUMED');
  assert.equal(consumed.mockOnly, true);
  assert.equal(Object.hasOwn(consumed, 'candidates'), false);
  assert.equal(value.model.events.length, before);
  assert.equal(consumed.counts.fsOperationsAttempted, 0);
});

test('qualified ELF4 parser cap remains independent from the helper 8 MiB capture cap', async () => {
  const value = await deliveredIntegration();
  assert.equal(value.elf.ELF_REQUIREMENTS_V4_LIMITS.maxInputBytes, 67108864);
  assert.equal(value.helper.HOST_RUNTIME_LIMITS.maxFileBytes, 8388608);
  assert.equal(value.helper.HOST_RUNTIME_LIMITS.maxAggregateBytes, 33554432);
  assert.equal(value.elf.inspectElf64RequirementsV4.length, 1);
  assert.equal(value.observed.runtimeProvidersQualified, false);
  assert.equal(value.observed.imagePrepared, false);
  assert.equal(value.observed.dockerProviderQualified, false);
  assert.equal(value.observed.noPythonRuntimeVerified, false);
});

test('unknown host root identity must remain equal across the five fixed candidate paths', async () => {
  const result = observation();
  result.candidates[6].rootMetadata.ino = '99999';
  stopped(await runCase({ result }), 'E_CANDIDATES');
});

test('actual helper accounting flags are booleans, not invented numeric counters', async () => {
  const result = observation();
  result.counts.fsAccountingUncertain = 0;
  stopped(await runCase({ result }), 'E_ACCOUNTING');
});

test('helper scopes and all actual direct negative flags are mandatory on success', async () => {
  for (const key of Object.keys(HELPER_FLAGS)) {
    const result = observation();
    Reflect.deleteProperty(result, key);
    stopped(await runCase({ result }), 'E_QUALIFICATION');
  }
});

for (const key of ['size', 'sha256', 'soname', 'interpreter']) {
  test(`staged profile ${key} drift cannot replace the separately pinned receipt semantics`, async () => {
    const stagingModule = copy(stageModule);
    stagingModule.XZ_STAGING_PROFILE.images[1][key] = 'drift';
    const value = await runCase({ stagingModule });
    stopped(value, 'E_CONSTANTS');
    assert.equal(value.state.observerCalls, 0);
  });
}

test('a helper staged path cannot be replaced by old profile source or target promotion', async () => {
  for (const [index, key, replacement] of [[0, 'path', stageModule.XZ_STAGING_PROFILE.images[1].source],
    [2, 'role', 'TARGET_LIBM'], [2, 'expectedSha256', '0'.repeat(64)]]) {
    const value = await runCase({ helperModule: helper => { helper.HOST_RUNTIME_INPUTS[index][key] = replacement; } });
    stopped(value, 'E_CONSTANTS');
    assert.equal(value.state.observerCalls, 0);
  }
});

test('source allocation never exceeds the aggregate 256 KiB admission budget', async () => {
  const helper = Buffer.alloc(240000, 0x20);
  fakeHelper.copy(helper);
  const value = await runCase({ sources: { helper } });
  stopped(value, 'E_SOURCE_LIMIT');
  assert.equal(value.result.sourceCounts.allocatedBytes, 261142);
  assert.equal(value.result.sourceCounts.positiveCloses, 3);
  assert.equal(value.state.imports.length, 0);
});

test('source I/O failures conservatively mark operation source accounting uncertain', async () => {
  for (const option of ['readFailure', 'openFailure', 'closeFailure']) {
    const value = await runCase({ [option]: 'helper' });
    stopped(value);
    assert.equal(value.result.sourceAccountingComplete, false);
    assert.equal(value.result.sourceIoAccountingUncertain, true);
  }
});

test('helper counters cannot claim more completed closes, reads, or bytes than attempts permit', async () => {
  for (const [key, value] of [['closesCompleted', 15], ['readsCompleted', 51], ['returnedBytes', 33554433],
    ['ownedFds', 1], ['fsAccountingUncertain', true], ['readAccountingUncertain', true]]) {
    const result = observation();
    result.counts[key] = value;
    stopped(await runCase({ result }), 'E_ACCOUNTING');
  }
});

test('cleanup overrun suppresses an otherwise complete helper batch', async () => {
  const result = observation();
  result.cleanupOverrun = true;
  stopped(await runCase({ result }), 'E_ACCOUNTING');
});

test('STOP nested flags cannot assert runtime or image qualification', async () => {
  const result = observation();
  result.status = 'STOP';
  result.error = 'E_CLOSE';
  result.role = 'HOST_LIBGCC_S';
  result.flags = { ...HELPER_FLAGS, runtimeProvidersQualified: true };
  result.ioAccountingComplete = false;
  const value = await runCase({ result });
  stopped(value, 'E_HELPER_STOP');
  assert.equal(Object.hasOwn(value.result, 'helperFlags'), false);
  assert.equal(Object.hasOwn(value.result, 'helperCounts'), false);
});
