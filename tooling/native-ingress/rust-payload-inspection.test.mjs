// SPEC: _spec/tooling/native-ingress/step2.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const uri = text => 'data:text/javascript;base64,' + Buffer.from(text).toString('base64');
const ascii = value => JSON.stringify(value).replace(/[^\x00-\x7f]/g, ch => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'));
const sizeOf = value => ascii(value).length;
const source = read('./rust-payload-inspection.mjs').toString('utf8');
const rawTar = read('./tar-inventory.mjs').toString('utf8');
assert.equal(Buffer.byteLength(rawTar), 15548);
assert.equal(sha(rawTar), '050d629963fdf89bd5dff7639260c7de30b08be46320b7b6bb7ed4dac6bb8139');
const privateTar = rawTar.replace('maxExtensionBytes: 65_536', 'maxExtensionBytes: 4_194_304')
  .replace("if (size > limits.maxExtensionBytes - extensionBytes) fail('E_EXTENSION_BYTES');",
    "if (size > 65_536 || size > limits.maxExtensionBytes - extensionBytes) fail('E_EXTENSION_BYTES');")
  .replace('{ index: entries + 1, path: key, type: kind, size }', '{ index: entries + 1, path: key, type: kind, size, bodyOffset: consumedBytes }');
assert.equal(Buffer.byteLength(privateTar), 15595);
assert.equal(sha(privateTar), 'bf8c7fcc56c26aa0618c014d74046dc29b79c09340728b27dd0363a758b9ef9a');
const tar = await import(uri(privateTar));
const mockV5 = uri("export function inspectElf64RequirementsV5() { throw Object.freeze(Object.assign(new Error('fixture default'), {code:'E_ELF'})); }");
const linked = source.replace("from './tar-inventory.mjs'", `from '${uri(privateTar)}'`)
  .replace("from './elf-requirements-v5.mjs'", `from '${mockV5}'`);
const m = await import(uri(linked));
const { RUST_PAYLOAD_ROLES: roles, RUST_PAYLOAD_INPUTS: inputs, RUST_PAYLOAD_TARGETS: targets,
  RUST_PAYLOAD_EXPECTATIONS: expectations, RUST_PAYLOAD_LIMITS: limits, createRustPayloadInspectionFixture: fixture } = m;
const receipt = JSON.parse(read('../../_spec/tooling/native-ingress/rust-component-layout.receipt.json'));
const acquisition = JSON.parse(read('../../_spec/tooling/native-ingress/rust-runtime-inputs.receipt.json'));
const oldFiles = ['rust-component-layout.mjs', 'rust-component-layout.test.mjs',
  'rust-component-layout-operation.mjs', 'rust-component-layout-operation.test.mjs', 'tar-inventory.mjs'];
const oldPins = oldFiles.map(path => [path, sha(read('./' + path))]);

function header(path, size = 0, type = '0') {
  const b = Buffer.alloc(512), slash = path.lastIndexOf('/');
  if (Buffer.byteLength(path) > 100) { b.write(path.slice(slash + 1), 0, 100); b.write(path.slice(0, slash), 345, 155); }
  else b.write(path, 0, 100);
  for (const [at, width, value] of [[100, 8, 0o644], [108, 8, 1000], [116, 8, 1000], [124, 12, size], [136, 12, 0]]) {
    b.write(value.toString(8).padStart(width - 1, '0') + '\0', at, width, 'ascii');
  }
  b[156] = type.charCodeAt(0); b.write('ustar\0', 257, 6, 'ascii'); b.write('00', 263, 2, 'ascii');
  b.fill(32, 148, 156);
  b.write(b.reduce((sum, v) => sum + v, 0).toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');
  return b;
}
const member = (path, body = Buffer.alloc(0), type = '0') => Buffer.concat([header(path, body.length, type), body, Buffer.alloc((512 - body.length % 512) % 512)]);
function requirements(id) {
  return { profile: 'elf64le-x86-64-requirements-v5', state: 'ELF_REQUIREMENTS_METADATA',
    interpreter: '/fixture/loader', header: { type: 3, machine: 62 }, programHeaders: [],
    dynamic: { present: true, needed: ['libsame.so'], soname: 'libsame.so', rpath: '$ORIGIN/../lib', runpath: '$ORIGIN',
      stringTable: { bytes: 1025 }, unknownTags: [{ tag: '1879047931', value: '12' }, { tag: '42', value: String(id) }] },
    requirements: { versionNeeds: [{ file: 'libsame.so', versions: [{ name: 'GLIBC_2.17', flags: 0 }] }],
      versionDefinitions: [{ name: 'FIXTURE_1', parents: ['BASE'] }], notes: [], properties: [], buildIds: ['abcd'] },
    nativeQualified: false, installedUsability: false, trainingReady: false, rustReady: false };
}
function profile(options = {}) {
  const bodies = targets.map((t, i) => {
    if (t.kind === 'LINKER_TEXT') return Buffer.from(options.text ?? 'INPUT ( libLLVM.so )\n');
    const b = Buffer.alloc(options.bodySize ?? 96, options.validElf ? 0 : i + 1);
    b.set([127, 69, 76, 70]); b[8] = i;
    if (options.validElf) {
      b.set([2, 1, 1], 4); b.writeUInt16LE(3, 16); b.writeUInt16LE(62, 18); b.writeUInt32LE(1, 20);
      b.writeUInt16LE(64, 52); b.writeUInt16LE(56, 54);
    }
    return b;
  });
  const archives = [], selected = [], expected = [];
  for (let i = 0; i < 5; i++) {
    const root = inputs[i].expectedRoot;
    const parts = [member(root, Buffer.alloc(0), '5'), member(root + '/unselected/ignored.py', Buffer.from([255, 0, 128])),
      member(root + '/unselected/wrapper', Buffer.alloc(0))];
    let cursor = parts.reduce((sum, b) => sum + b.length, 0), index = parts.length;
    for (let j = 0; j < targets.length; j++) if (targets[j].role === roles[i]) {
      selected.push({ ...targets[j], index: ++index, bodyOffset: cursor + 512, size: bodies[j].length, sha256: sha(bodies[j]) });
      const b = member(targets[j].path, bodies[j]); parts.push(b); cursor += b.length;
    }
    const bytes = Buffer.concat([...parts, Buffer.alloc(1024 + (options.extraTrailer ?? 0))]); archives.push(bytes);
    const parser = tar.createTarInventory({ maxExtensionBytes: 4194304 });
    parser.feed(bytes); const summary = parser.finish();
    expected.push({ role: roles[i], expandedBytes: summary.expandedBytes, entries: summary.entries, headers: summary.headers,
      metadataSha256: summary.metadataSha256, decodedSha256: sha(bytes) });
  }
  const p = { mockOnly: true, inputs: inputs.map((input, i) => {
    const root = '/fixture/rust-payload-' + i, archiveBytes = i + 3;
    return { ...input, root, file: `${root}/${input.expectedRoot}.tar.xz`, archiveBytes,
      archiveSha256: sha('compressed fixture ' + i), identity: { root: { ...input.identity.root, ino: String(i + 1) },
        file: { ...input.identity.file, ino: String(i + 11), size: String(archiveBytes) } } };
  }), targets: selected, expectations: expected, limits: options.limits ?? {} };
  return { p, archives, bodies };
}
function harness(options = {}) {
  const { p, archives, bodies } = profile(options);
  options.mutateProfile?.(p);
  const log = { arrays: [], events: [], summaries: [], parserLimits: [], parserCalls: 0, elfCalls: 0, captures: [], requirements: [] };
  const elf = options.elf ?? (bytes => {
    log.elfCalls++; log.captures.push(bytes);
    const req = options.requirements ? options.requirements(bytes[8]) : requirements(bytes[8]);
    log.requirements.push(req); return req;
  });
  const parserFactory = options.factory ?? (parserLimits => {
    const role = log.parserLimits.length; log.parserLimits.push(parserLimits);
    const parser = tar.createTarInventory(parserLimits);
    return Object.freeze({
      feed(bytes) {
        log.parserCalls++;
        const original = parser.feed(bytes), events = options.events ? options.events(original, role) : original;
        log.arrays.push(events); log.events.push(...original); return events;
      },
      finish() { const original = parser.finish(), summary = options.summary ? options.summary(original, role) : original; log.summaries.push(summary); return summary; },
    });
  });
  return { batch: fixture(p, parserFactory, elf), p, archives, bodies, log };
}
function coreFor(input, inventory) {
  return { state: 'GNU_SDK_DATA_INVENTORY', mockOnly: true, inventory, archiveBytes: input.archiveBytes,
    archiveSha256: input.archiveSha256, archivePasses: 2, archiveDataBytes: input.archiveBytes * 2,
    archiveRequestedBytes: input.archiveBytes * 2 + 2, closeAttempts: 2, stdinFinished: true, stdoutEnded: true,
    stderrEnded: true, closeObserved: true, exitCode: 0, signal: null, extracted: false, nativeQualified: false, pythonFreeSubsetVerified: false,
    extractionAuthorized: false, installedUsability: false, decoderQualified: false, rustReady: false, trainingReady: false,
    provenanceVerified: false, hardRssBounded: false, processTreeBounded: false, hardDeadlineGuaranteed: false };
}
function parseRole(h, i, options = {}) {
  h.batch.beginRustPayloadRole(roles[i]);
  const parser = h.batch.createTarInventory(options.overrides ?? {}), bytes = options.bytes ?? h.archives[i];
  const arrays = [], chunkSize = options.chunkSize ?? 65536;
  for (let at = 0; at < bytes.length; at += chunkSize) arrays.push(parser.feed(bytes.subarray(at, at + chunkSize)));
  const inventory = parser.finish();
  return { parser, arrays, inventory, core: coreFor(h.p.inputs[i], inventory) };
}
function run(options = {}) {
  const h = harness(options); h.batch.beginRustPayloadBatch();
  for (let i = 0; i < 5; i++) h.batch.acceptRustPayloadRole(parseRole(h, i, { chunkSize: options.chunkSize }).core);
  return { ...h, result: h.batch.finishRustPayloadBatch() };
}
function code(fn, expected) {
  assert.throws(fn, error => {
    assert.equal(error.code, expected); assert.ok(Object.isFrozen(error));
    for (const field of ['cause', 'members', 'payload', 'inventory', 'hash', 'result']) assert.equal(Object.hasOwn(error, field), false);
    return true;
  });
}
function released(batch) {
  const s = batch.snapshotRustPayloadBatch();
  for (const key of ['acceptedRoles', 'targetCount', 'capturedBytes', 'expandedBytes', 'entries', 'observationBytes',
    'activePayloadBytes', 'buffersAllocated', 'buffersErased', 'peakPayloadBytes']) assert.equal(s[key], 0, key);
  assert.equal(s.currentRole, null); assert.doesNotMatch(JSON.stringify(s), /\/|\.so|sha256|namespace/u);
}
function fifth(h) {
  h.batch.beginRustPayloadBatch();
  for (let i = 0; i < 4; i++) h.batch.acceptRustPayloadRole(parseRole(h, i).core);
}

test('all thirteen production tuples equal the accepted receipt without extra wrappers or .py files', () => {
  assert.deepEqual(targets.map(({ kind, domain, ...row }) => row), receipt.runtimeInspectionCandidates);
  assert.equal(targets.reduce((n, row) => n + row.size, 0), 457372178);
  assert.equal(targets.filter(t => t.kind === 'ELF_EXEC_DSO').length, 12);
  assert.deepEqual(targets.filter(t => t.kind === 'LINKER_TEXT').map(t => [t.role, t.size, t.path]), [
    ['rustc', 42, 'rustc-1.95.0-x86_64-unknown-linux-gnu/rustc/lib/libLLVM-22-rust-1.95.0-stable.so'],
  ]);
  assert.deepEqual(targets.filter(t => t.domain === 'TARGET').map(t => t.role), ['rust-std']);
  assert.ok(targets.filter(t => t.role !== 'rust-std').every(t => t.domain === 'HOST'));
  assert.ok(targets.every(t => !/\.py$|wrapper/u.test(t.path)));
});
test('all five immutable decoded and TAR expectations match the accepted role summaries', () => {
  assert.deepEqual(roles, ['cargo', 'rustc', 'rust-std', 'rustfmt-preview', 'clippy-preview']);
  assert.deepEqual(expectations, receipt.roles.map(({ role, expandedBytes, entries, headers, metadataSha256, decodedSha256 }) =>
    ({ role, expandedBytes, entries, headers, metadataSha256, decodedSha256 })));
  assert.equal(expectations.reduce((n, r) => n + r.expandedBytes, 0), 642746880);
  assert.equal(expectations.reduce((n, r) => n + r.entries, 0), 263);
  for (const list of [roles, targets, inputs, expectations]) { assert.ok(Object.isFrozen(list)); for (const row of list) if (typeof row === 'object') assert.ok(Object.isFrozen(row)); }
});
test('input descriptors copy the original consumed layout shape and accepted physical identities', async () => {
  const layout = await import('./rust-component-layout.mjs');
  assert.deepEqual(inputs, layout.RUST_LAYOUT_INPUTS);
  for (let i = 0; i < 5; i++) {
    const r = acquisition.inputs[i];
    assert.deepEqual(inputs[i], { role: r.role, root: acquisition.root, file: acquisition.root + '/' + r.name,
      archiveBytes: r.byteLength, archiveSha256: r.readbackSha256, expectedRoot: r.name.slice(0, -7),
      identity: { root: acquisition.rootFinal, file: r.finalMetadata } });
    assert.ok(Object.isFrozen(inputs[i].identity)); assert.ok(Object.isFrozen(inputs[i].identity.root)); assert.ok(Object.isFrozen(inputs[i].identity.file));
  }
});
test('exports and production imports expose only the accepted API and pinned private linking sites', () => {
  assert.deepEqual(Object.keys(m).sort(), ['RUST_PAYLOAD_ROLES', 'RUST_PAYLOAD_INPUTS', 'RUST_PAYLOAD_TARGETS',
    'RUST_PAYLOAD_EXPECTATIONS', 'RUST_PAYLOAD_LIMITS', 'beginRustPayloadBatch', 'beginRustPayloadRole', 'createTarInventory',
    'acceptRustPayloadRole', 'finishRustPayloadBatch', 'abortRustPayloadBatch', 'getRustPayloadFailure', 'snapshotRustPayloadBatch',
    'createRustPayloadInspectionFixture'].sort());
  assert.ok(source.startsWith('// SPEC: _spec/tooling/native-ingress/step2.puml\n'));
  assert.deepEqual([...source.matchAll(/from '([^']+)'/gu)].map(m => m[1]), ['node:crypto', 'node:util', './tar-inventory.mjs', './elf-requirements-v5.mjs']);
  assert.doesNotMatch(source, /node:fs|node:child_process|fetch\(|createTarMemberInventory|readFile|spawn\(|eval\(/u);
});
test('fixed resource caps match the accepted profile', () => {
  assert.deepEqual(limits, { maxExpandedBytes: 1073741824, maxBatchExpandedBytes: 2147483648,
    maxEntries: 32768, maxBatchEntries: 65536, maxChunkBytes: 65536, maxPayloadBytes: 268435456,
    maxElfSnapshotBytes: 268435456, maxAggregateBytes: 536870912, maxTextBytes: 1048576,
    maxObservationBytes: 4194304, maxOutputBytes: 2097152, maxLinkerDepth: 32, maxLinkerReferences: 1024 });
  assert.ok(Object.isFrozen(limits));
});
test('original parser feed arrays, events and inventory survive by identity', () => {
  const h = harness(); h.batch.beginRustPayloadBatch(); const r = parseRole(h, 0, { chunkSize: 513 });
  r.arrays.forEach((events, i) => assert.equal(events, h.log.arrays[i]));
  assert.equal(r.arrays.flat()[0], h.log.events[0]); assert.equal(r.inventory, h.log.summaries[0]);
  assert.equal(h.batch.snapshotRustPayloadBatch().acceptedRoles, 0); assert.equal(h.batch.getRustPayloadFailure(), null);
  h.batch.acceptRustPayloadRole(r.core); assert.equal(h.batch.snapshotRustPayloadBatch().acceptedRoles, 1);
  h.batch.abortRustPayloadBatch(); released(h.batch);
});
for (const chunkSize of [1, 7, 511, 512, 513, 700, 1023, 1024, 4096, 65536]) {
  test(`thirteen payload hashes survive header/body/padding boundaries at chunk size ${chunkSize}`, () => {
    const { result, bodies, log, p } = run({ chunkSize });
    assert.equal(result.targetCount, 13); assert.equal(result.mockOnly, true); assert.equal(log.elfCalls, 12);
    assert.deepEqual(result.members.map(t => t.sha256), bodies.map(sha));
    assert.equal(result.capturedBytes, bodies.reduce((n, b) => n + b.length, 0));
    assert.deepEqual(result.roles.map(r => r.decodedSha256), p.expectations.map(e => e.decodedSha256));
    assert.equal(result.resourceAccounting.buffersAllocated, 13); assert.equal(result.resourceAccounting.buffersErased, 13);
    assert.equal(result.resourceAccounting.peakPayloadBytes, 96);
  });
}
test('multiple bodies and empty unselected files in one chunk never capture headers or padding', () => {
  const { result } = run();
  assert.equal(result.members.length, 13); assert.equal(result.entries, 28);
  assert.ok(result.members.every(row => !row.path.includes('unselected')));
  assert.equal(result.pythonFreeSubsetVerified, false);
});
test('full decoded SHA includes trailing zero blocks rather than only selected bodies', () => {
  const { result, archives } = run({ extraTrailer: 1024 });
  assert.deepEqual(result.roles.map(r => r.decodedSha256), archives.map(sha));
});
test('no observation can be obtained before all five role receipts pass', () => {
  const h = harness(); fifth(h);
  assert.equal(h.batch.snapshotRustPayloadBatch().acceptedRoles, 4);
  assert.equal(h.batch.getRustPayloadFailure(), null);
  code(() => h.batch.finishRustPayloadBatch(), 'E_PAYLOAD_STATE'); released(h.batch);
});
test('all metadata requirements remain unchanged, including version definitions, needs, loading tags and search paths', () => {
  const { result, log } = run();
  const elfs = result.members.filter(t => t.kind === 'ELF_EXEC_DSO');
  elfs.forEach((row, i) => {
    assert.equal(row.metadata.requirements, log.requirements[i]);
    assert.deepEqual(row.metadata.requirements.requirements.versionDefinitions, [{ name: 'FIXTURE_1', parents: ['BASE'] }]);
    assert.deepEqual(row.metadata.requirements.requirements.versionNeeds[0].versions, [{ name: 'GLIBC_2.17', flags: 0 }]);
    assert.equal(row.metadata.requirements.dynamic.rpath, '$ORIGIN/../lib');
    assert.equal(row.metadata.requirements.dynamic.runpath, '$ORIGIN');
    assert.equal(row.metadata.requirements.interpreter, '/fixture/loader');
    assert.deepEqual(row.metadata.unsafeLoadingTags, [{ tag: '1879047931', value: '12' }]);
    assert.equal(row.metadata.loadingTagsQualification, 'NOT_QUALIFIED');
    assert.ok(Object.isFrozen(row.metadata.requirements.requirements.versionNeeds));
  });
});
test('1024 is a per-referenced-string limit, not a count of aggregate string bytes', () => {
  const { result } = run({ requirements: id => {
    const r = requirements(id); r.dynamic.needed = ['a'.repeat(1024), 'b'.repeat(1024)]; return r;
  } });
  assert.equal(result.declaredNeededEdges.length, 24);
  assert.equal(result.members[0].metadata.requirements.dynamic.needed[0].length, 1024);
});
test('a thousand bounded version auxiliaries remain intact rather than becoming a 1024-byte aggregate cap', () => {
  const { result } = run({ requirements: id => {
    const r = requirements(id);
    if (id === 0) r.requirements.versionNeeds[0].versions = Array.from({ length: 1024 }, (_, i) => ({ name: 'V_' + i, flags: 0 }));
    return r;
  } });
  assert.equal(result.members[0].metadata.requirements.requirements.versionNeeds[0].versions.length, 1024);
});
test('escaped metadata preserves complete V5-sized Unicode objects without inventing a stricter 128 KiB ASCII cap', () => {
  const opaque = 'é'.repeat(22000);
  const { result } = run({ requirements: id => { const r = requirements(id); if (id === 0) r.requirements.opaque = opaque; return r; } });
  const r = result.members[0].metadata.requirements;
  assert.ok(Buffer.byteLength(JSON.stringify(r)) < 131072); assert.ok(sizeOf(r) > 131072);
  assert.equal(r.requirements.opaque, opaque);
});
test('the handed-off V5 default inspector parses only small synthetic in-memory ELF bodies', async () => {
  const bytes = read('./elf-requirements-v5.mjs');
  assert.equal(bytes.length, 21800); assert.equal(sha(bytes), '1d9ebc5b27944ab646b2f61d334d2ff4bf43bddf226402ba225f6c02cf11dccb');
  const actual = await import('./rust-payload-inspection.mjs');
  const h = profile({ validElf: true }); h.batch = actual.createRustPayloadInspectionFixture(h.p, tar.createTarInventory);
  h.batch.beginRustPayloadBatch();
  for (let i = 0; i < 5; i++) h.batch.acceptRustPayloadRole(parseRole(h, i).core);
  const result = h.batch.finishRustPayloadBatch();
  assert.equal(result.mockOnly, true); assert.equal(result.nativeQualified, false);
  for (const row of result.members.filter(t => t.kind === 'ELF_EXEC_DSO')) {
    assert.equal(row.metadata.requirements.profile, 'elf64le-x86-64-requirements-v5');
    assert.equal(row.metadata.requirements.nativeQualified, false);
  }
  assert.equal(result.declaredNeededEdges.length, 0); released(h.batch);
});
test('the actual V5 default binding fails closed on a malformed synthetic ELF without text fallback', async () => {
  const actual = await import('./rust-payload-inspection.mjs');
  const h = profile(); h.batch = actual.createRustPayloadInspectionFixture(h.p, tar.createTarInventory);
  h.batch.beginRustPayloadBatch(); code(() => parseRole(h, 0), 'E_PAYLOAD_ELF');
  assert.equal(h.batch.getRustPayloadFailure().underlyingCode, 'E_ELF'); released(h.batch);
});
test('same-domain SONAME matches remain unresolved name declarations without ABI or automatic HOST/TARGET links', () => {
  const { result } = run();
  assert.equal(result.declaredNeededEdges.length, 12);
  for (const edge of result.declaredNeededEdges) {
    const source = result.members.find(t => t.path === edge.from);
    assert.equal(edge.status, 'UNRESOLVED'); assert.equal(edge.abiVerified, false); assert.equal(edge.providerQualified, false);
    assert.ok(edge.declaredProviderNames.every(path => result.members.find(t => t.path === path).domain === source.domain));
    assert.equal(edge.declaredProviderNames.length, source.domain === 'HOST' ? 11 : 1);
  }
});
test('every qualification, role, execution, extraction, image and readiness claim stays false', () => {
  const { result, batch } = run();
  for (const field of ['archiveExtracted', 'filesInstalled', 'rustExecuted', 'pythonRuntimeInvoked', 'pythonFreeSubsetVerified',
    'installedUsability', 'extractionAuthorized', 'roleSatisfied', 'abiVerified', 'loaderClosureVerified', 'runtimeProvidersQualified',
    'provenanceVerified', 'nativeAuthority', 'nativeQualified', 'rustReady', 'trainingReady', 'imagePrepared',
    'dockerProviderQualified', 'sourceReady', 'rootfsReady', 'installReady', 'hardRssBounded']) assert.equal(result[field], false, field);
  assert.equal(result.state, 'RUST_PAYLOAD_DATA_INSPECTED'); assert.equal(result.profile, result.state);
  assert.ok(result.members.every(t => !t.roleSatisfied && !t.qualified && !t.abiVerified));
  assert.equal(batch.getRustPayloadFailure(), null); released(batch);
});
for (const [name, mutate] of [
  ['index', t => { t.index++; }], ['offset off by one', t => { t.bodyOffset++; }],
  ['wrong role', t => { t.role = 'rustc'; }],
  ['wrong kind', t => { t.kind = 'LINKER_TEXT'; }], ['wrong domain', t => { t.domain = 'TARGET'; }],
  ['unknown path', t => { t.path += '.py'; }],
]) {
  test(`synthetic profile rejects ${name} without introducing a new target`, () => {
    const { p } = profile(); mutate(p.targets[0]);
    assert.throws(() => fixture(p, () => assert.fail('parser created'), () => assert.fail('ELF called')));
  });
}
for (const [name, change] of [
  ['path mismatch', e => ({ ...e, path: inputs[0].expectedRoot + '/unknown' })],
  ['size mismatch', e => ({ ...e, size: e.size + 1 })],
  ['offset mismatch', e => ({ ...e, bodyOffset: e.bodyOffset + 512 })],
  ['target directory', e => ({ ...e, type: 'directory', size: 0 })],
  ['role mismatch', e => ({ ...e, path: targets[1].path })],
]) {
  test(`original target correspondence fails closed on ${name}`, () => {
    const h = harness({ events: events => Object.freeze(events.map(e => e.index === 4 ? Object.freeze(change(e)) : e)) });
    h.batch.beginRustPayloadBatch(); assert.throws(() => parseRole(h, 0)); released(h.batch); assert.equal(h.log.elfCalls, 0);
  });
}
test('overlapping target ranges are rejected before any buffer allocation', () => {
  const { p } = profile(); p.targets[2].bodyOffset = p.targets[1].bodyOffset;
  code(() => fixture(p, () => assert.fail('parser created')), 'E_PAYLOAD_SPAN');
});
test('overlapping original event spans are rejected independently', () => {
  const h = harness({ events: events => Object.freeze(events.map(e => e.index === 4 ? Object.freeze({ ...e, bodyOffset: 512 }) : e)) });
  h.batch.beginRustPayloadBatch(); code(() => parseRole(h, 0), 'E_PAYLOAD_EVENT'); released(h.batch);
});
test('payload body SHA verification precedes every ELF inspector call', () => {
  const h = harness(); h.batch.beginRustPayloadBatch(); const changed = Buffer.from(h.archives[0]);
  changed[h.p.targets[0].bodyOffset + 20] ^= 1;
  code(() => parseRole(h, 0, { bytes: changed }), 'E_PAYLOAD_BODY_HASH');
  assert.equal(h.log.elfCalls, 0); released(h.batch);
  const d = h.batch.getRustPayloadFailure(); assert.equal(d.path, targets[0].path); assert.equal(d.index, targets[0].index);
  assert.equal(d.scope, 'ATTEMPTED_LITERAL_TARGET_NOT_ACCEPTED_PAYLOAD_EVIDENCE');
  assert.equal(d.sourceProfile, 'RUST_COMPONENT_LAYOUT_DATA'); assert.ok(sizeOf(d) <= 4096);
  assert.doesNotMatch(JSON.stringify(d), /sha256|stack|message|actual|\u0000/u);
});
test('linker-text SHA mismatch stops before syntax inspection or an ELF fallback', () => {
  const h = harness({ text: 'INPUT(a)' }); h.batch.beginRustPayloadBatch(); h.batch.acceptRustPayloadRole(parseRole(h, 0).core);
  const b = Buffer.from(h.archives[1]), target = h.p.targets.find(t => t.kind === 'LINKER_TEXT');
  b[target.bodyOffset] = 255;
  code(() => parseRole(h, 1, { bytes: b }), 'E_PAYLOAD_BODY_HASH');
  assert.equal(h.batch.getRustPayloadFailure().kind, 'LINKER_TEXT'); assert.equal(h.log.elfCalls, 6); released(h.batch);
});
test('an allowed synthetic size change must still match the authoritative parser event exactly', () => {
  const h = harness({ mutateProfile: p => { p.targets[0].size++; } }); h.batch.beginRustPayloadBatch();
  code(() => parseRole(h, 0), 'E_PAYLOAD_TARGET'); assert.equal(h.log.elfCalls, 0); released(h.batch);
});
test('one owned buffer is wiped before the next target inspector runs', () => {
  let prior = null, calls = 0;
  const { result } = run({ elf: bytes => {
    if (prior) assert.ok(prior.every(byte => byte === 0));
    prior = bytes; calls++; return requirements(bytes[8]);
  } });
  assert.ok(prior.every(byte => byte === 0)); assert.equal(calls, 12);
  assert.equal(result.resourceAccounting.buffersAllocated, result.resourceAccounting.buffersErased);
});
test('an incomplete capture is wiped on abort and cannot resume', () => {
  const h = harness(); h.batch.beginRustPayloadBatch(); h.batch.beginRustPayloadRole('cargo'); const parser = h.batch.createTarInventory();
  const allocate = Buffer.alloc, owned = [];
  Buffer.alloc = function (...args) { const b = Reflect.apply(allocate, Buffer, args); if (args[0] === 96) owned.push(b); return b; };
  try {
    parser.feed(h.archives[0].subarray(0, h.p.targets[0].bodyOffset + 9));
    assert.equal(owned.length, 1); assert.ok(owned[0].some(byte => byte !== 0));
    h.batch.abortRustPayloadBatch(); assert.ok(owned[0].every(byte => byte === 0)); released(h.batch);
    code(() => parser.feed(Buffer.alloc(1)), 'E_PAYLOAD_STATE');
  } finally { Buffer.alloc = allocate; }
});
for (const [name, patch] of [
  ['compressed SHA', { archiveSha256: '0'.repeat(64) }], ['compressed bytes', { archiveBytes: 1 }],
  ['archive passes', { archivePasses: 1 }], ['data bytes', { archiveDataBytes: 0 }],
  ['requested bytes', { archiveRequestedBytes: 0 }], ['FD close results', { closeAttempts: 1 }],
  ['stdin finish', { stdinFinished: false }], ['stdout finish', { stdoutEnded: false }],
  ['stderr finish', { stderrEnded: false }], ['child close', { closeObserved: false }],
  ['exit code', { exitCode: 1 }], ['signal', { signal: 'SIGKILL' }],
  ['state', { state: 'OTHER' }], ['mock label', { mockOnly: false }],
  ['extraction claim', { extracted: true }], ['native claim', { nativeQualified: true }],
  ['decoder claim', { decoderQualified: true }],
  ['Python-free claim', { pythonFreeSubsetVerified: true }], ['role claim', { roleSatisfied: true }],
]) {
  test(`late fifth-role ${name} failure withholds all provisional roles, members and edges`, () => {
    const h = harness(); fifth(h); const r = parseRole(h, 4);
    code(() => h.batch.acceptRustPayloadRole({ ...r.core, ...patch }), 'E_PAYLOAD_CORE'); released(h.batch);
    const first = h.batch.getRustPayloadFailure(); assert.equal(first.role, 'clippy-preview');
    h.batch.abortRustPayloadBatch(); assert.equal(h.batch.getRustPayloadFailure(), first);
    code(() => h.batch.finishRustPayloadBatch(), 'E_PAYLOAD_STATE'); assert.equal(h.batch.getRustPayloadFailure(), first);
  });
}
test('core inventory matching uses exact object identity, not an equivalent clone', () => {
  const h = harness(); fifth(h); const r = parseRole(h, 4);
  code(() => h.batch.acceptRustPayloadRole({ ...r.core, inventory: Object.freeze({ ...r.inventory }) }), 'E_PAYLOAD_CORE'); released(h.batch);
});
test('all original core qualification flags must be explicitly false rather than missing', () => {
  for (const key of ['extracted', 'extractionAuthorized', 'pythonFreeSubsetVerified', 'installedUsability', 'nativeQualified',
    'decoderQualified', 'rustReady', 'trainingReady', 'provenanceVerified', 'hardRssBounded', 'processTreeBounded', 'hardDeadlineGuaranteed']) {
    const h = harness(); fifth(h); const { core } = parseRole(h, 4); delete core[key];
    code(() => h.batch.acceptRustPayloadRole(core), 'E_PAYLOAD_CORE'); released(h.batch);
  }
});
test('late fifth-role whole-decoded SHA failure clears the earlier accepted roles', () => {
  const h = harness({ mutateProfile: p => { p.expectations[4].decodedSha256 = sha('not the decoded stream'); } });
  fifth(h); code(() => parseRole(h, 4), 'E_PAYLOAD_DECODED_HASH'); released(h.batch);
});
test('a late fifth-role TAR finish exception leaves no provisional evidence or raw error message', () => {
  let ordinal = 0;
  const h = harness({ factory: caps => {
    const role = ordinal++, parser = tar.createTarInventory(caps);
    return { feed: parser.feed, finish() { if (role === 4) throw { code: 'E_TRUNCATED', message: 'do not disclose' }; return parser.finish(); } };
  } });
  fifth(h); code(() => parseRole(h, 4), 'E_PAYLOAD_DATA'); released(h.batch);
  assert.equal(h.batch.getRustPayloadFailure().code, 'E_TRUNCATED');
  assert.doesNotMatch(JSON.stringify(h.batch.getRustPayloadFailure()), /disclose/u);
});
for (const [name, patch] of [
  ['TAR metadata SHA', { metadataSha256: '0'.repeat(64) }], ['TAR headers', { headers: 6 }],
  ['TAR entries', { entries: 0 }], ['TAR expanded bytes', { expandedBytes: 1 }],
  ['TAR state', { state: 'OTHER' }], ['TAR extraction', { extractionAuthorized: true }],
  ['TAR native claim', { nativeQualified: true }], ['TAR decoder claim', { decoderQualified: true }],
  ['TAR output bound', { outputBytes: 16777217 }], ['TAR extension bound', { extensionBytes: 4194305 }],
  ['TAR collision bound', { collisionBytes: 33554433 }], ['TAR data event bound', { dataEvents: 32769 }],
]) {
  test(`late fifth-role ${name} failure clears the entire batch`, () => {
    const h = harness({ summary: (s, i) => i === 4 ? Object.freeze({ ...s, ...patch }) : s });
    fifth(h); code(() => parseRole(h, 4), 'E_PAYLOAD_SUMMARY'); released(h.batch);
  });
}
test('other valid TAR summary fields require bounds, not invented receipt literals', () => {
  const { result } = run({ summary: s => Object.freeze({ ...s, outputBytes: 1, collisionBytes: 1, dataEvents: 2, extensionBytes: 12 }) });
  assert.equal(result.roles[4].inventory.extensionBytes, 12);
});
for (const [name, mutate] of [
  ['checksum', b => { b[0] ^= 1; return b; }], ['padding', b => { b[515] = 1; return b; }],
  ['trailer', b => { b[b.length - 1] = 1; return b; }], ['terminator', b => b.subarray(0, -512)],
]) {
  test(`single original TAR parser rejects synthetic ${name} corruption`, () => {
    const h = harness(); h.batch.beginRustPayloadBatch();
    assert.throws(() => parseRole(h, 0, { bytes: mutate(Buffer.from(h.archives[0])) })); released(h.batch);
  });
}
test('fixed ELF kind never falls back to text after ELF rejection', () => {
  let calls = 0;
  const h = harness({ elf() { calls++; throw Object.freeze({ code: 'E_ELF' }); } }); h.batch.beginRustPayloadBatch();
  code(() => parseRole(h, 0), 'E_PAYLOAD_ELF'); assert.equal(calls, 1);
  const d = h.batch.getRustPayloadFailure(); assert.equal(d.kind, 'ELF_EXEC_DSO'); assert.equal(d.underlyingCode, 'E_ELF'); released(h.batch);
});
test('fixed linker-text kind never falls back to ELF after invalid text', () => {
  const h = harness({ text: '\x7fELF' }); h.batch.beginRustPayloadBatch();
  h.batch.acceptRustPayloadRole(parseRole(h, 0).core);
  code(() => parseRole(h, 1), 'E_PAYLOAD_LINKER_TEXT');
  assert.equal(h.log.elfCalls, 6); assert.equal(h.batch.getRustPayloadFailure().kind, 'LINKER_TEXT'); released(h.batch);
});
for (const text of ['INPUT(libLLVM.so)', 'GROUP(AS_NEEDED(libLLVM.so))',
  '/* x */ INPUT(a) GROUP(b)', 'INPUT/*x*/(a/*y*/b)', 'OUTPUT_FORMAT(elf64) INPUT(a)']) {
  test(`strict bounded GNU linker grammar recognizes ${text}`, () => {
    const { result } = run({ text }); const metadata = result.members.find(t => t.kind === 'LINKER_TEXT').metadata;
    assert.equal(metadata.text, text); assert.equal(metadata.evaluated, false); assert.equal(metadata.hostResolutionAttempted, false);
    assert.ok(metadata.references.every(r => r.scope === 'DATA_NOT_HOSTPATH_PERMISSION' && r.requiresApprovedImageMapping && !r.followed));
  });
}
test('linker traversal and absolute references stay inert literal data without path mapping authority', () => {
  const { result } = run({ text: 'INPUT(../../opaque /not-opened)' });
  const refs = result.members.find(t => t.kind === 'LINKER_TEXT').metadata.references;
  assert.deepEqual(refs.map(r => r.literal), ['../../opaque', '/not-opened']);
  assert.ok(refs.every(r => r.requiresApprovedImageMapping && !r.followed));
});
for (const text of ['INCLUDE /opaque', 'INPUT("a")', "INPUT('a')", 'INPUT($(anything))', 'INPUT(`anything`)',
  'PLUGIN(a)', 'INPUT(a', 'INPUT()', 'INPUT(a))', 'INPUT(a);', 'INPUT(a\0)', 'INPUT(a\x01)',
  '/* unclosed INPUT(a)', '/* /* nested */ INPUT(a)', 'INPUT(AS_NEEDED())', 'OUTPUT_FORMAT(elf64)', 'INPUT(UNKNOWN(a))',
  'GROUP(INPUT(a))', 'INPUT(a) OUTPUT_FORMAT(elf64)']) {
  test(`strict linker parser rejects unknown or malformed syntax ${JSON.stringify(text)}`, () => {
    const h = harness({ text }); h.batch.beginRustPayloadBatch(); h.batch.acceptRustPayloadRole(parseRole(h, 0).core);
    assert.throws(() => parseRole(h, 1)); released(h.batch);
    assert.ok(['E_PAYLOAD_LINKER_TEXT', 'E_PAYLOAD_LINKER_UNSUPPORTED'].includes(h.batch.getRustPayloadFailure().code));
  });
}
test('linker text rejects malformed UTF-8 before tokenization', () => {
  const h = harness({ text: Buffer.from([0xc3, 0x28]) }); h.batch.beginRustPayloadBatch(); h.batch.acceptRustPayloadRole(parseRole(h, 0).core);
  code(() => parseRole(h, 1), 'E_PAYLOAD_LINKER_TEXT'); released(h.batch);
});
test('lowered linker depth accepts equality and rejects the next nested AS_NEEDED', () => {
  run({ text: 'GROUP(AS_NEEDED(a))', limits: { maxLinkerDepth: 2 } });
  const h = harness({ text: 'GROUP(AS_NEEDED(AS_NEEDED(a)))', limits: { maxLinkerDepth: 2 } });
  h.batch.beginRustPayloadBatch(); h.batch.acceptRustPayloadRole(parseRole(h, 0).core);
  code(() => parseRole(h, 1), 'E_PAYLOAD_LINKER_TEXT'); released(h.batch);
});
test('lowered linker reference count accepts equality and rejects +1', () => {
  run({ text: 'INPUT(a b)', limits: { maxLinkerReferences: 2 } });
  const h = harness({ text: 'INPUT(a b c)', limits: { maxLinkerReferences: 2 } });
  h.batch.beginRustPayloadBatch(); h.batch.acceptRustPayloadRole(parseRole(h, 0).core);
  code(() => parseRole(h, 1), 'E_PAYLOAD_LINKER_TEXT'); released(h.batch);
});
for (const [name, make] of [
  ['proxy', () => new Proxy(new Uint8Array(8), { get() { assert.fail('proxy getter'); }, ownKeys() { assert.fail('proxy trap'); } })],
  ['SAB', () => new Uint8Array(new SharedArrayBuffer(8))], ['empty', () => new Uint8Array(0)],
  ['oversized', () => new Uint8Array(65537)], ['non-byte array', () => new Uint16Array(8)],
  ['accessors', () => ({ get buffer() { assert.fail('getter'); }, get length() { assert.fail('getter'); } })],
  ['detached', () => { const b = new ArrayBuffer(8), v = new Uint8Array(b); structuredClone(b, { transfer: [b] }); return v; }],
]) {
  test(`unsafe ${name} chunk stops before parser calls, copying or capture allocation`, () => {
    const h = harness(); h.batch.beginRustPayloadBatch(); h.batch.beginRustPayloadRole('cargo'); const parser = h.batch.createTarInventory();
    code(() => parser.feed(make()), 'E_PAYLOAD_CHUNK'); assert.equal(h.log.parserCalls, 0); assert.equal(h.log.elfCalls, 0); released(h.batch);
  });
}
test('resizable chunk backing stops before parsing when supported', { skip: !Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable') }, () => {
  const h = harness(); h.batch.beginRustPayloadBatch(); h.batch.beginRustPayloadRole('cargo');
  code(() => h.batch.createTarInventory().feed(new Uint8Array(new ArrayBuffer(8, { maxByteLength: 16 }))), 'E_PAYLOAD_CHUNK');
  assert.equal(h.log.parserCalls, 0); released(h.batch);
});
test('chunk intrinsic getters ignore own properties and nonzero backing offsets', () => {
  const h = harness(); h.batch.beginRustPayloadBatch(); h.batch.beginRustPayloadRole('cargo'); const parser = h.batch.createTarInventory();
  const bytes = h.archives[0], b = Buffer.alloc(bytes.length + 13, 255); b.set(bytes, 7);
  const view = new Uint8Array(b.buffer, b.byteOffset + 7, bytes.length);
  for (const key of ['length', 'byteLength', 'buffer', 'byteOffset']) Object.defineProperty(view, key, { get() { assert.fail('own chunk getter'); } });
  parser.feed(view); const inventory = parser.finish(); h.batch.acceptRustPayloadRole(coreFor(h.p.inputs[0], inventory));
  for (let i = 1; i < 5; i++) h.batch.acceptRustPayloadRole(parseRole(h, i).core);
  assert.equal(h.batch.finishRustPayloadBatch().roles[0].decodedSha256, sha(bytes));
});
for (const key of ['event', 'array', 'summary', 'core', 'requirements', 'error']) {
  test(`${key} proxies and getters never run`, () => {
    for (const mode of ['proxy', 'getter']) {
      const poison = (obj, field) => mode === 'proxy' ? new Proxy(obj, { get() { assert.fail('proxy get'); }, ownKeys() { assert.fail('proxy keys'); } })
        : Object.defineProperty({ ...obj }, field, { get() { assert.fail('property getter'); }, enumerable: true });
      const options = {};
      if (key === 'event') options.events = es => Object.freeze(es.map(e => poison(e, 'path')));
      if (key === 'array') options.events = es => mode === 'proxy' ? poison(es, '0') : Object.freeze(Object.defineProperty([...es], '0', { get() { assert.fail('array getter'); } }));
      if (key === 'summary') options.summary = s => poison(s, 'state');
      if (key === 'requirements') options.requirements = id => poison(requirements(id), 'dynamic');
      if (key === 'error') options.elf = () => { throw poison({}, 'code'); };
      const h = harness(options); h.batch.beginRustPayloadBatch();
      if (key === 'core') { const r = parseRole(h, 0); code(() => h.batch.acceptRustPayloadRole(poison(r.core, 'state')), 'E_PAYLOAD_INPUT'); }
      else assert.throws(() => parseRole(h, 0));
      released(h.batch);
      if (key === 'error') assert.equal(h.batch.getRustPayloadFailure().underlyingCode, null);
    }
  });
}
test('ELF failure diagnostics retain only first whitelisted code and literal production target', () => {
  const h = harness({ elf() { throw { code: 'E_STRING', message: 'private text', stack: 'secret', payload: 'secret', hash: sha('secret') }; } });
  h.batch.beginRustPayloadBatch(); code(() => parseRole(h, 0), 'E_PAYLOAD_ELF');
  const d = h.batch.getRustPayloadFailure(); assert.equal(d.underlyingCode, 'E_STRING'); assert.equal(d.index, 66);
  assert.ok(Object.isFrozen(d)); assert.ok(sizeOf(d) <= 4096);
  assert.doesNotMatch(JSON.stringify(d), /secret|private text|hash|stack|message/u);
  h.batch.abortRustPayloadBatch(); assert.equal(h.batch.getRustPayloadFailure(), d);
  code(() => h.batch.beginRustPayloadBatch(), 'E_PAYLOAD_STATE'); assert.equal(h.batch.getRustPayloadFailure(), d);
});
test('unrecognized ELF error codes never enter a failure receipt', () => {
  const h = harness({ elf() { throw { code: 'SECRET_UNRECOGNIZED' }; } }); h.batch.beginRustPayloadBatch();
  code(() => parseRole(h, 0), 'E_PAYLOAD_ELF'); assert.equal(h.batch.getRustPayloadFailure().underlyingCode, null);
});
test('lowered per-role 1 GiB decoded cap accepts equality and rejects +1 before parser feed', () => {
  const baseline = profile(), max = Math.max(...baseline.archives.map(b => b.length));
  run({ limits: { maxExpandedBytes: max } });
  const h = harness({ limits: { maxExpandedBytes: baseline.archives[0].length - 1 } }); h.batch.beginRustPayloadBatch();
  code(() => parseRole(h, 0), 'E_PAYLOAD_EXPANDED'); assert.equal(h.log.parserCalls, 0); released(h.batch);
});
test('lowered 2 GiB batch decoded cap accepts equality and rejects fifth-role +1', () => {
  const total = profile().archives.reduce((n, b) => n + b.length, 0);
  run({ limits: { maxBatchExpandedBytes: total } });
  const h = harness({ limits: { maxBatchExpandedBytes: total - 1 } }); fifth(h);
  const count = h.log.parserCalls; code(() => parseRole(h, 4), 'E_PAYLOAD_EXPANDED');
  assert.equal(h.log.parserCalls, count); released(h.batch);
});
for (const cap of ['maxPayloadBytes', 'maxElfSnapshotBytes']) {
  test(`lowered ${cap} accepts equality and stops +1 before owned allocation`, () => {
    run({ limits: { [cap]: 96 } });
    const h = harness({ limits: { [cap]: 95 } }); h.batch.beginRustPayloadBatch();
    const allocate = Buffer.alloc; let calls = 0;
    Buffer.alloc = function (...args) { if (args[0] === 96) calls++; return Reflect.apply(allocate, Buffer, args); };
    try { code(() => parseRole(h, 0), 'E_PAYLOAD_LIMIT'); assert.equal(calls, 0); } finally { Buffer.alloc = allocate; }
    assert.equal(h.log.elfCalls, 0); released(h.batch);
  });
}
test('lowered 512 MiB aggregate capture cap accepts equality and rejects fifth-role +1 before allocation', () => {
  const p = profile(), total = p.bodies.reduce((n, b) => n + b.length, 0);
  run({ limits: { maxAggregateBytes: total } });
  const h = harness({ limits: { maxAggregateBytes: total - 1 } }); fifth(h);
  code(() => parseRole(h, 4), 'E_PAYLOAD_LIMIT'); released(h.batch);
  assert.equal(h.log.elfCalls, 11);
});
test('lowered linker-text byte cap accepts equality and stops +1 before text interpretation', () => {
  const n = profile().bodies[6].length; run({ limits: { maxTextBytes: n } });
  const h = harness({ limits: { maxTextBytes: n - 1 } }); h.batch.beginRustPayloadBatch(); h.batch.acceptRustPayloadRole(parseRole(h, 0).core);
  code(() => parseRole(h, 1), 'E_PAYLOAD_LIMIT'); released(h.batch);
});
test('per-role and batch member caps reject excess synthetic events', () => {
  run({ limits: { maxEntries: 10, maxBatchEntries: 28 } });
  const h = harness({ limits: { maxBatchEntries: 27 } }); fifth(h);
  code(() => parseRole(h, 4), 'E_PAYLOAD_ENTRIES'); released(h.batch);
  const perRole = harness({ limits: { maxEntries: 3 } }); perRole.batch.beginRustPayloadBatch();
  assert.throws(() => parseRole(perRole, 0)); released(perRole.batch);
});
test('escaped ASCII observation accounting includes every retained role, member and edge', () => {
  const { result } = run();
  const exact = sizeOf(result.roles) + sizeOf(result.members) + sizeOf(result.declaredNeededEdges);
  assert.equal(result.resourceAccounting.observationBytes, exact);
  run({ limits: { maxObservationBytes: exact } });
  const h = harness({ limits: { maxObservationBytes: exact - 1 } }); fifth(h); h.batch.acceptRustPayloadRole(parseRole(h, 4).core);
  code(() => h.batch.finishRustPayloadBatch(), 'E_PAYLOAD_METADATA'); released(h.batch);
});
for (const sample of ['é', '漢', '😀', '"\\\u0000\n']) {
  test(`escaped ASCII metadata and output boundaries preserve ${JSON.stringify(sample)}`, () => {
    const req = id => { const r = requirements(id); r.requirements.opaque = sample.repeat(10); return r; };
    const baseline = run({ requirements: req }).result;
    const exactMetadata = baseline.resourceAccounting.observationBytes;
    assert.equal(exactMetadata, sizeOf(baseline.roles) + sizeOf(baseline.members) + sizeOf(baseline.declaredNeededEdges));
    assert.equal(run({ requirements: req, limits: { maxObservationBytes: exactMetadata } }).result.resourceAccounting.observationBytes, exactMetadata);
    const low = harness({ requirements: req, limits: { maxObservationBytes: exactMetadata - 1 } }); fifth(low);
    low.batch.acceptRustPayloadRole(parseRole(low, 4).core);
    code(() => low.batch.finishRustPayloadBatch(), 'E_PAYLOAD_METADATA'); released(low.batch);
    const budgeted = run({ requirements: req, limits: { maxOutputBytes: 100000 } }).result;
    const exactOutput = sizeOf(budgeted);
    const expected = { ...budgeted, constraints: { ...budgeted.constraints, maxOutputBytes: exactOutput } };
    const stableOutput = sizeOf(expected);
    const equal = run({ requirements: req, limits: { maxOutputBytes: stableOutput } }).result;
    assert.equal(sizeOf(equal), stableOutput);
    const over = harness({ requirements: req, limits: { maxOutputBytes: stableOutput - 1 } }); fifth(over);
    over.batch.acceptRustPayloadRole(parseRole(over, 4).core);
    code(() => over.batch.finishRustPayloadBatch(), 'E_PAYLOAD_OUTPUT'); released(over.batch);
    assert.equal(sizeOf(equal) + 1, (ascii(equal) + '\n').length);
    assert.equal(equal.members[0].metadata.requirements.requirements.opaque, sample.repeat(10));
  });
}
test('edge declarations count against the private observation budget', () => {
  const baseline = run().result;
  const beforeEdges = sizeOf(baseline.roles) + sizeOf(baseline.members) + 2;
  const h = harness({ limits: { maxObservationBytes: beforeEdges } }); fifth(h); h.batch.acceptRustPayloadRole(parseRole(h, 4).core);
  code(() => h.batch.finishRustPayloadBatch(), 'E_PAYLOAD_METADATA'); released(h.batch);
});
test('fixture rejects role subsets, production paths, alternate targets and positive mock labels', () => {
  for (const mutate of [p => { p.inputs.pop(); }, p => { p.targets.pop(); }, p => { p.expectations.pop(); },
    p => { p.mockOnly = false; }, p => { p.inputs[0] = inputs[0]; }, p => { p.targets[0] = targets[0]; },
    p => { p.inputs[0].file = '/host/opaque'; }, p => { p.inputs[0].root = 'https://opaque'; },
    p => { p.targets[0].path = 'elsewhere'; }, p => { p.targets.reverse(); }]) {
    const { p } = profile(); mutate(p); assert.throws(() => fixture(p, () => assert.fail('parser called')));
  }
});
test('fixture rejects getters, proxies and arbitrary callback-shaped profile fields', () => {
  const { p } = profile();
  for (const value of [new Proxy(p, { ownKeys() { assert.fail('proxy trap'); } }),
    Object.defineProperty({ ...p }, 'targets', { get() { assert.fail('getter'); } }), { ...p, fs() {} }]) {
    code(() => fixture(value, () => assert.fail('parser called')), 'E_PAYLOAD_INPUT');
  }
});
test('nested numeric profile fields reject coercion objects and proxies without running hooks', () => {
  for (const group of ['targets', 'expectations']) {
    for (const field of group === 'targets' ? ['index', 'bodyOffset', 'size'] : ['expandedBytes', 'entries', 'headers']) {
      for (const v of [{ valueOf() { assert.fail('coercion hook'); } },
        new Proxy({}, { get() { assert.fail('coercion proxy trap'); } })]) {
        const { p } = profile(); p[group][0][field] = v;
        code(() => fixture(p, () => assert.fail('parser called')), 'E_PAYLOAD_INPUT');
      }
    }
  }
});
for (const [key, value] of [['maxPayloadBytes', 268435457], ['maxExpandedBytes', 1073741825],
  ['maxBatchExpandedBytes', 2147483649], ['maxAggregateBytes', 536870913], ['maxEntries', 32769],
  ['maxObservationBytes', 4194305], ['maxOutputBytes', 2097153], ['maxLinkerReferences', 1025], ['arbitrary', 1]]) {
  test(`fixture lower-only limits reject ${key}=${value}`, () => {
    const { p } = profile({ limits: { [key]: value } }); code(() => fixture(p, () => assert.fail('parser called')), 'E_PAYLOAD_LIMIT');
  });
}
test('production factory cannot receive roots, paths, parser callbacks, ELF callbacks or replacement descriptors', async () => {
  for (const value of [{ root: '/fixture/no' }, { file: '/fixture/no' }, { parserFactory() {} }, { elfInspector() {} }, { maxChunkBytes: 65537 }]) {
    const prod = await import(uri(linked) + '#' + Math.random()); prod.beginRustPayloadBatch(); prod.beginRustPayloadRole('cargo');
    code(() => prod.createTarInventory(value), 'E_PAYLOAD_LIMIT'); released(prod);
  }
});
test('parser overrides lower existing caps but never widen the accepted production envelope', () => {
  const h = harness(); h.batch.beginRustPayloadBatch();
  h.batch.acceptRustPayloadRole(parseRole(h, 0, { overrides: { maxHeaders: 32768, maxExpandedBytes: 1073741824 } }).core);
  assert.equal(h.log.parserLimits[0].maxChunkBytes, 65536); assert.equal(h.log.parserLimits[0].maxExtensionBytes, 4194304);
  for (const value of [{ maxChunkBytes: 65537 }, { maxHeaders: 32769 }, { maxExpandedBytes: 1073741825 }, { maxHeaders: 0 }, { maxHeaders: NaN }]) {
    const other = harness(); other.batch.beginRustPayloadBatch(); other.batch.beginRustPayloadRole('cargo');
    code(() => other.batch.createTarInventory(value), 'E_PAYLOAD_LIMIT'); assert.equal(other.log.parserLimits.length, 0); released(other.batch);
  }
});
test('fixed role order, one active role and one factory per role are mandatory', () => {
  const wrong = harness(); wrong.batch.beginRustPayloadBatch(); code(() => wrong.batch.beginRustPayloadRole('rustc'), 'E_PAYLOAD_STATE');
  const overlap = harness(); overlap.batch.beginRustPayloadBatch(); overlap.batch.beginRustPayloadRole('cargo');
  code(() => overlap.batch.beginRustPayloadRole('cargo'), 'E_PAYLOAD_STATE'); released(overlap.batch);
  const twice = harness(); twice.batch.beginRustPayloadBatch(); twice.batch.beginRustPayloadRole('cargo'); twice.batch.createTarInventory();
  code(() => twice.batch.createTarInventory(), 'E_PAYLOAD_STATE'); assert.equal(twice.log.parserLimits.length, 1); released(twice.batch);
});
test('acceptance before inventory finish and old role closures cannot affect newer roles', () => {
  const early = harness(); early.batch.beginRustPayloadBatch(); early.batch.beginRustPayloadRole('cargo');
  code(() => early.batch.acceptRustPayloadRole({}), 'E_PAYLOAD_STATE'); released(early.batch);
  const h = harness(); h.batch.beginRustPayloadBatch(); const old = parseRole(h, 0); h.batch.acceptRustPayloadRole(old.core);
  h.batch.beginRustPayloadRole('rustc'); h.batch.createTarInventory();
  code(() => old.parser.finish(), 'E_PAYLOAD_STATE'); released(h.batch);
});
test('abort and successful completion are one-shot with no reused private state', () => {
  const { result, batch } = run(); released(batch); assert.equal(batch.snapshotRustPayloadBatch().state, 'FINISHED');
  batch.abortRustPayloadBatch(); assert.equal(batch.snapshotRustPayloadBatch().state, 'FINISHED');
  code(() => batch.beginRustPayloadBatch(), 'E_PAYLOAD_STATE'); assert.equal(result.members.length, 13);
  assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.members)); assert.ok(Object.isFrozen(result.declaredNeededEdges));
  const aborted = harness(); aborted.batch.beginRustPayloadBatch(); aborted.batch.abortRustPayloadBatch();
  assert.equal(aborted.batch.snapshotRustPayloadBatch().state, 'ABORTED'); assert.equal(aborted.batch.getRustPayloadFailure(), null);
  code(() => aborted.batch.beginRustPayloadBatch(), 'E_PAYLOAD_STATE'); released(aborted.batch);
});
test('snapshots disclose only state, counts, fixed role and known failure codes', () => {
  const h = harness(); fifth(h); const snapshot = h.batch.snapshotRustPayloadBatch();
  assert.deepEqual(Object.keys(snapshot), ['state', 'mockOnly', 'acceptedRoles', 'currentRole', 'targetCount', 'capturedBytes',
    'expandedBytes', 'entries', 'observationBytes', 'activePayloadBytes', 'buffersAllocated', 'buffersErased', 'peakPayloadBytes', 'failureCode', 'failureRole']);
  assert.equal(snapshot.acceptedRoles, 4); assert.equal(snapshot.failureCode, null); assert.equal(snapshot.failureRole, null);
  assert.doesNotMatch(JSON.stringify(snapshot), /\.so|\.py|\/|sha256|namespace|members|edges/u);
  h.batch.abortRustPayloadBatch(); released(h.batch);
});
test('existing source files remain untouched and helper pin is available for parent linking', t => {
  for (const [path, digest] of oldPins) assert.equal(sha(read('./' + path)), digest, path);
  t.diagnostic(JSON.stringify({ helper: { bytes: Buffer.byteLength(source), sha256: sha(source) },
    tests: { bytes: read('./rust-payload-inspection.test.mjs').length, sha256: sha(read('./rust-payload-inspection.test.mjs')) },
    privateTar: { bytes: Buffer.byteLength(privateTar), sha256: sha(privateTar) }, elfExecution: 'TRUSTED_FIXTURE_ONLY_NO_STEP2_CLAIM' }));
});
