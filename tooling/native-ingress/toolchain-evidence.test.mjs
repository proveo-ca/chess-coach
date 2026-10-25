// SPEC: _spec/tooling/native-ingress/step2.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(name, import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const uri = bytes => 'data:text/javascript;base64,' + Buffer.from(bytes).toString('base64');
const ascii = value => JSON.stringify(value).replace(/[^\x00-\x7f]/g, ch => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'));
const rawTar = read('./tar-inventory.mjs'), rawSdk = read('./sdk-payload-inspection.mjs'), rawElf = read('./elf-requirements-v5.mjs'), rawElfV3 = read('./elf-requirements-v3.mjs');
assert.equal(rawTar.length, 15548);
assert.equal(sha(rawTar), '050d629963fdf89bd5dff7639260c7de30b08be46320b7b6bb7ed4dac6bb8139');
const privateTar = rawTar.toString().replace('maxExtensionBytes: 65_536', 'maxExtensionBytes: 4_194_304')
  .replace("if (size > limits.maxExtensionBytes - extensionBytes) fail('E_EXTENSION_BYTES');", "if (size > 65_536 || size > limits.maxExtensionBytes - extensionBytes) fail('E_EXTENSION_BYTES');")
  .replace('{ index: entries + 1, path: key, type: kind, size }', '{ index: entries + 1, path: key, type: kind, size, bodyOffset: consumedBytes }');
assert.equal(Buffer.byteLength(privateTar), 15595);
assert.equal(sha(privateTar), 'bf8c7fcc56c26aa0618c014d74046dc29b79c09340728b27dd0363a758b9ef9a');
assert.equal(rawSdk.length, 31569);
assert.equal(sha(rawSdk), 'fc301816588aa16360ce30a9c18ea7d5d82838432e7bd28f54155024e4445469');
assert.equal(rawElf.length, 21800);
assert.equal(sha(rawElf), '1d9ebc5b27944ab646b2f61d334d2ff4bf43bddf226402ba225f6c02cf11dccb');
assert.equal(rawElfV3.length, 20493);
assert.equal(sha(rawElfV3), '3bd878fe2a6de57a2b8252163cdf2a4d3093c6605a903105a9f531f039b84f10');
const appendedSdk = Buffer.concat([rawSdk, Buffer.from('export const SOURCE_FORMAT_INSPECTORS = Object.freeze({rel,archive,linker});\n')]);
const linkedSdk = appendedSdk.toString().replace("from './tar-inventory.mjs'", `from '${uri(privateTar)}'`)
  .replace("from './elf-requirements-v3.mjs'", `from '${uri(rawElfV3)}'`);
const source = read('./toolchain-evidence.mjs').toString();
const linkedSource = source.replace("from './tar-inventory.mjs'", `from '${uri(privateTar)}'`)
  .replace("from './elf-requirements-v5.mjs'", `from '${uri(rawElf)}'`)
  .replace("from './sdk-payload-inspection.mjs'", `from '${uri(linkedSdk)}'`);
const [m, tar, sdk, elf] = await Promise.all([import(uri(linkedSource)), import(uri(privateTar)), import(uri(linkedSdk)), import(uri(rawElf))]);
const { TOOLCHAIN_EVIDENCE_ROLES: roles, TOOLCHAIN_EVIDENCE_INPUTS: inputs, TOOLCHAIN_EVIDENCE_TARGETS: targets,
  TOOLCHAIN_EVIDENCE_EXPECTATIONS: expectations, TOOLCHAIN_EVIDENCE_LIMITS: limits, createToolchainEvidenceFixture: fixture } = m;
const formatInspectors = sdk.SOURCE_FORMAT_INSPECTORS;
const legacy = e => {
  const p = { index: e.index, path: e.path, type: e.type, size: e.size };
  if (['symlink','hardlink'].includes(e.type)) { p.linkpath = e.linkpath; p.linkKind = e.linkKind; }
  return { ...p, mode: e.mode, uid: e.uid, gid: e.gid, mtime: e.mtime };
};
function header(path, size = 0, type = '0', link = '', mode = 0o644) {
  const b = Buffer.alloc(512), slash = path.lastIndexOf('/');
  if (Buffer.byteLength(path) > 100) { b.write(path.slice(slash + 1), 0, 100); b.write(path.slice(0, slash), 345, 155); }
  else b.write(path, 0, 100);
  for (const [at, width, value] of [[100,8,mode],[108,8,1000],[116,8,1000],[124,12,size],[136,12,0]]) b.write(value.toString(8).padStart(width - 1, '0') + '\0', at, width, 'ascii');
  b[156] = type.charCodeAt(0); b.write(link,157,100); b.write('ustar\0',257,6); b.write('00',263,2); b.fill(32,148,156);
  b.write(b.reduce((a,v) => a + v,0).toString(8).padStart(6,'0') + '\0 ',148,8);
  return b;
}
const member = (path, body = Buffer.alloc(0), type = '0', link = '', mode) => Buffer.concat([header(path,body.length,type,link,mode),body,Buffer.alloc((512 - body.length % 512) % 512)]);
function elfBody(type = 3) {
  const b = Buffer.alloc(type === 1 ? 128 : 512); b.set([127,69,76,70,2,1,1]);
  b.writeUInt16LE(type,16); b.writeUInt16LE(62,18); b.writeUInt32LE(1,20); b.writeUInt16LE(64,52); b.writeUInt16LE(type === 1 ? 0 : 56,54);
  if (type === 1) { b.writeBigUInt64LE(64n,40); b.writeUInt16LE(64,58); b.writeUInt16LE(1,60); }
  return b;
}
function arBody() {
  const b = elfBody(1), field = (v,n) => String(v).padEnd(n,' ');
  return Buffer.concat([Buffer.from('!<arch>\n'),Buffer.from(field('obj.o/',16) + field(0,12) + field(0,6) + field(0,6) + field('644',8) + field(b.length,10) + '`\n'),b]);
}
function profile(options = {}) {
  const archives = [], observedBodies = [], selected = new Map(), expected = [];
  for (let i = 0; i < 6; i++) {
    const root = inputs[i].expectedRoot, component = roles[i] === 'rust-std' ? 'rust-std-x86_64-unknown-linux-gnu' : roles[i];
    const parts = [], bodies = new Map();
    const add = (path, bytes = Buffer.alloc(0), type = '0', link = '') => { parts.push(member(path,bytes,type,link, options.mode)); if (type === '0') bodies.set(path,bytes); };
    add(root,Buffer.alloc(0),'5');
    if (i === 0) {
      add(root + '/share/buildroot/sdk-relocs',Buffer.from(options.gnuText ?? 'unknown relocation DATA\n'));
      add(root + '/share/buildroot/sdk-location',Buffer.from('/fixture/original\n'));
      add(root + '/alias',Buffer.alloc(0),'2','../literal-only');
      add(root + '/hard',Buffer.alloc(0),'1',root + '/unselected/license');
    } else {
      add(root + '/components',Buffer.from(component + '\n'));
      add(root + '/rust-installer-version',Buffer.from('3\n'));
      add(root + '/' + component + '/manifest.in',Buffer.from(options.manifest ?? 'file:bin/tool\ndir:lib\nfuture:retain verbatim\n'));
    }
    add(root + '/unselected/license',Buffer.from(options.license ?? '许可证\n'));
    add(root + '/unselected/zero');
    const rows = targets.filter(t => t.artifactRole === roles[i]).sort((a,b) => (a.index ?? 10000) - (b.index ?? 10000));
    for (const t of rows) {
      let body = t.kind === 'ELF_EXEC_DSO' ? elfBody() : t.kind === 'ET_REL' ? elfBody(1) : t.kind === 'AR' ? arBody() : Buffer.from(options.linker ?? 'INPUT ( libfixture.so )\n');
      body = options.body?.(body,t) ?? body;
      const offset = parts.reduce((n,b) => n + b.length,0) + 512, index = parts.length + 1;
      const supplemental = t.selectionRole === 'TARGET_LIBMVEC_PROVIDER';
      selected.set(t.path,{ ...t, index: supplemental && !options.fixedSupplemental ? null : index,
        bodyOffset: supplemental && !options.fixedSupplemental ? null : offset, size: supplemental && !options.fixedSupplemental ? null : body.length,
        expectedSha256: t.expectedSha256 === null ? null : sha(body) });
      if (supplemental && options.missingSupplemental) continue;
      if (supplemental && options.aliasSupplemental) add(t.path,Buffer.alloc(0),'2','libm.so.6');
      else add(t.path,body);
    }
    const bytes = Buffer.concat([...parts,Buffer.alloc(1024)]), parser = tar.createTarInventory({ maxChunkBytes: 65536 });
    const events = [];
    for (let at = 0; at < bytes.length; at += 65536) events.push(...parser.feed(bytes.subarray(at,at + 65536)));
    const summary = parser.finish();
    expected.push({ ...expectations[i], expandedBytes: bytes.length, entries: summary.entries, headers: summary.headers,
      regularFiles: events.filter(e => e.type === 'file').length, decodedSha256: sha(bytes),
      metadataSha256: i ? summary.metadataSha256 : sha(events.map(e => JSON.stringify(legacy(e)) + '\n').join('')) });
    archives.push(bytes); observedBodies.push(bodies);
  }
  return { archives, observedBodies, p: { mockOnly: true, inputs: inputs.map((input,i) => {
    const root = '/fixture/toolchain-' + i, archiveBytes = i + 3;
    return { ...input, root, file: `${root}/${input.expectedRoot}.tar.xz`, archiveBytes, archiveSha256: sha('compressed fixture ' + i),
      identity: { root: { ...input.identity.root, ino: String(i + 1) }, file: { ...input.identity.file, ino: String(i + 10), size: String(archiveBytes) } } };
  }), targets: targets.map(t => selected.get(t.path)), expectations: expected, limits: options.limits ?? {} } };
}
function harness(options = {}) {
  const f = profile(options); options.mutate?.(f.p);
  const log = { arrays: [], summaries: [], parserCalls: 0, parserLimits: [], elfCalls: 0, formatCalls: [], captures: [] };
  const batch = fixture(f.p, { parserFactory(parserLimits) {
    const i = log.parserLimits.length; log.parserLimits.push(parserLimits);
    const parser = tar.createTarInventory(parserLimits);
    return Object.freeze({ feed(bytes) {
      log.parserCalls++; const original = parser.feed(bytes), events = options.events?.(original,i) ?? original;
      log.arrays.push(events); return events;
    }, finish() { const original = parser.finish(), summary = options.summary?.(original,i) ?? original; log.summaries.push(summary); return summary; } });
  }, elfInspector(bytes) {
    log.elfCalls++; log.captures.push(bytes);
    return options.elf ? options.elf(bytes) : elf.inspectElf64RequirementsV5(bytes);
  }, formatInspectors: Object.fromEntries(Object.entries(formatInspectors).map(([kind,fn]) => [kind,bytes => {
    log.formatCalls.push(kind); log.captures.push(bytes); return fn(bytes);
  }])) });
  return { ...f, batch, log };
}
function coreFor(input, inventory) {
  return { state: 'GNU_SDK_DATA_INVENTORY', mockOnly: true, inventory, archiveBytes: input.archiveBytes, archiveSha256: input.archiveSha256,
    archivePasses: 2, archiveDataBytes: input.archiveBytes * 2, archiveRequestedBytes: input.archiveBytes * 2 + 2,
    closeAttempts: 2, stdinFinished: true, stdoutEnded: true, stderrEnded: true, closeObserved: true, exitCode: 0, signal: null,
    extracted: false, extractionAuthorized: false, pythonFreeSubsetVerified: false, installedUsability: false, nativeQualified: false,
    decoderQualified: false, rustReady: false, trainingReady: false, provenanceVerified: false, hardRssBounded: false, processTreeBounded: false, hardDeadlineGuaranteed: false };
}
function parse(h,i,options = {}) {
  h.batch.beginToolchainEvidenceRole(roles[i]); const parser = h.batch.createTarInventory(options.overrides ?? {}), arrays = [];
  const bytes = options.bytes ?? h.archives[i], chunk = options.chunk ?? 65536;
  for (let at = 0; at < bytes.length; at += chunk) arrays.push(parser.feed(bytes.subarray(at,at + chunk)));
  const inventory = parser.finish(); return { parser, arrays, inventory, core: coreFor(h.p.inputs[i],inventory) };
}
function run(options = {}) {
  const h = harness(options); h.batch.beginToolchainEvidenceBatch();
  for (let i = 0; i < 6; i++) h.batch.acceptToolchainEvidenceRole(parse(h,i,{ chunk: options.chunk }).core);
  return { ...h, result: h.batch.finishToolchainEvidenceBatch() };
}
function rejected(fn,code) {
  assert.throws(fn,error => { assert.equal(error.code,code); assert.ok(Object.isFrozen(error));
    for (const key of ['payload','hash','members','inventory','cause','result']) assert.equal(Object.hasOwn(error,key),false);
    return true;
  });
}
function released(batch) {
  const s = batch.snapshotToolchainEvidenceBatch();
  for (const key of ['acceptedRoles','entries','regularFiles','expandedBytes','capturedBytes','selectedPayloads','metadataBytes','manifestBytes','activeBufferBytes','activeBodyHashes','buffersAllocated','buffersErased','peakPayloadBytes']) assert.equal(s[key],0,key);
  assert.equal(s.currentRole,null); assert.doesNotMatch(JSON.stringify(s), /sha256|\.so|\/|payloadBytes/u);
}
function five(h) {
  h.batch.beginToolchainEvidenceBatch();
  for (let i = 0; i < 5; i++) h.batch.acceptToolchainEvidenceRole(parse(h,i).core);
}

test('production imports and exact lifecycle expose no I/O, time, execution or acquisition authority', () => {
  assert.ok(source.startsWith('// SPEC: _spec/tooling/native-ingress/step2.puml\n'));
  assert.deepEqual([...source.matchAll(/from '([^']+)'/gu)].map(row => row[1]), ['node:crypto','node:util','./tar-inventory.mjs','./elf-requirements-v5.mjs','./sdk-payload-inspection.mjs']);
  assert.doesNotMatch(source,/node:(?:fs|path|child_process)|\b(?:fetch|spawn|eval|readFile|writeFile|performance|Date|setTimeout)\b/u);
  assert.deepEqual(Object.keys(m).sort(), ['TOOLCHAIN_EVIDENCE_ROLES','TOOLCHAIN_EVIDENCE_INPUTS','TOOLCHAIN_EVIDENCE_EXPECTATIONS','TOOLCHAIN_EVIDENCE_TARGETS','TOOLCHAIN_EVIDENCE_LIMITS',
    'beginToolchainEvidenceBatch','beginToolchainEvidenceRole','createTarInventory','acceptToolchainEvidenceRole','finishToolchainEvidenceBatch','abortToolchainEvidenceBatch','getToolchainEvidenceFailure','snapshotToolchainEvidenceBatch','createToolchainEvidenceFixture'].sort());
});
test('private augmentation leaves original SDK source unchanged and links a shared parser instance', () => {
  assert.equal(Buffer.from(linkedSdk).subarray(0,rawSdk.length).equals(rawSdk),false);
  assert.deepEqual(appendedSdk.subarray(0,rawSdk.length),rawSdk);
  assert.equal(read('./sdk-payload-inspection.mjs').includes('export const SOURCE_FORMAT_INSPECTORS'),false);
  assert.deepEqual(Object.keys(formatInspectors),['rel','archive','linker']);
  assert.equal(elf.ELF_REQUIREMENTS_V5_LIMITS.maxInputBytes,268435456);
  assert.equal(elf.ELF_REQUIREMENTS_V5_LIMITS.maxStringTableBytes,16777216);
  assert.equal(elf.ELF_REQUIREMENTS_V5_LIMITS.maxStringBytes,1024);
});
test('closed ordered six descriptors copy Rust source and GNU frozen nine-field identities', async () => {
  const rustSource = read('./rust-payload-inspection.mjs').toString().replace("from './tar-inventory.mjs'",`from '${uri(privateTar)}'`).replace("from './elf-requirements-v5.mjs'",`from '${uri(rawElf)}'`);
  const rust = await import(uri(rustSource));
  assert.deepEqual(roles,['gnu-sdk','cargo','rustc','rust-std','rustfmt-preview','clippy-preview']);
  assert.deepEqual(inputs.slice(1).map(({ decoderMemoryBytes,...row }) => row),rust.RUST_PAYLOAD_INPUTS);
  assert.ok(inputs.slice(1).every(row => row.decoderMemoryBytes === 268435456)); assert.equal(inputs[0].decoderMemoryBytes,16777216);
  assert.equal(inputs[0].identity.root.ino,'13894'); assert.equal(inputs[0].identity.file.ino,'1211332');
  assert.equal(inputs[0].identity.file.size,String(inputs[0].archiveBytes));
});
test('all expectations bind receipt counts and preserve distinct legacy and offset hash labels', () => {
  const receipt = JSON.parse(read('../../_spec/tooling/native-ingress/rust-component-layout.receipt.json'));
  assert.deepEqual(expectations.slice(1),receipt.roles.map(({ role,expandedBytes,entries,headers,regularFiles,decodedSha256,metadataSha256 }) =>
    ({ role,expandedBytes,entries,headers,regularFiles,decodedSha256,metadataSha256,metadataHashKind:'OFFSET_EVENT_METADATA' })));
  assert.equal(expectations.reduce((n,r) => n + r.entries,0),8675);
  assert.equal(expectations.reduce((n,r) => n + r.regularFiles,0),7106);
  assert.equal(expectations.reduce((n,r) => n + r.expandedBytes,0),1148080640);
  assert.equal(expectations[0].metadataHashKind,'LEGACY_WITHOUT_BODY_OFFSET');
  assert.equal(expectations[0].metadataSha256,sdk.SDK_PAYLOAD_EXPECTATION.metadataSha256);
});
test('production sdk-relocs checksum and length bind the original membership receipt without weakening its guard', () => {
  const receipt = JSON.parse(read('../../_spec/tooling/native-ingress/gnu-sdk-manifest-membership.receipt.json'));
  const hashes = [...source.matchAll(/^const SDK_RELOCS_SHA256 = '([^']+)';$/gmu)];
  const lengths = [...source.matchAll(/^const SDK_RELOCS_BYTES = ([0-9]+);$/gmu)];
  assert.equal(hashes.length,1); assert.equal(lengths.length,1);
  assert.match(hashes[0][1],/^[0-9a-f]{64}$/u);
  assert.equal(hashes[0][1],receipt.manifest.sha256);
  assert.equal(receipt.manifest.byteLength,9367);
  assert.equal(Number(lengths[0][1]),receipt.manifest.byteLength);
  assert.ok(source.includes("if (!mockOnly && b.manifest === 'GNU_RAW_TEXT' && b.event.path.endsWith('/sdk-relocs')\n        && (b.event.size !== SDK_RELOCS_BYTES || sha256 !== SDK_RELOCS_SHA256)) fail('E_EVIDENCE_BODY_HASH');"));
  assert.ok(source.includes("if (!mockOnly && active.input.role === 'gnu-sdk' && p.size !== (p.path.endsWith('/sdk-relocs') ? SDK_RELOCS_BYTES : 79)) fail('E_EVIDENCE_MANIFEST');"));
});
test('all 59 immutable literals match 45 SDK and 13 Rust selections plus only fixed libmvec', async () => {
  assert.equal(targets.length,59); assert.equal(new Set(targets.map(t => t.path)).size,59);
  assert.deepEqual(targets.slice(0,45).map(({ path,index,bodyOffset,size,kind,domain,selectionRole,optionalForMinimalC }) =>
    ({ path:path.slice(gnuRootLength()),index,bodyOffset,size,kind,domain,role:selectionRole,optionalForMinimalC })),sdk.SDK_PAYLOAD_TARGETS);
  assert.ok(targets.slice(0,45).every(t => t.expectedSha256 === null));
  const receipt = JSON.parse(read('../../_spec/tooling/native-ingress/rust-component-layout.receipt.json'));
  assert.deepEqual(targets.slice(45,58).map(t => ({ role:t.artifactRole,path:t.path,index:t.index,bodyOffset:t.bodyOffset,size:t.size,sha256:t.expectedSha256 })),receipt.runtimeInspectionCandidates);
  assert.equal(targets.slice(0,58).reduce((n,t) => n + t.size,0),641657315);
  assert.deepEqual(targets[58],{ artifactRole:'gnu-sdk',path:inputs[0].expectedRoot + '/x86_64-buildroot-linux-gnu/sysroot/lib/libmvec.so.1',index:null,bodyOffset:null,size:null,expectedSha256:null,kind:'ELF_EXEC_DSO',domain:'TARGET',selectionRole:'TARGET_LIBMVEC_PROVIDER',optionalForMinimalC:false,maxBytes:8388608 });
  for (const list of [roles,inputs,expectations,targets,limits]) assert.ok(Object.isFrozen(list));
  assert.ok(targets.every(Object.isFrozen));
});
function gnuRootLength() { return inputs[0].expectedRoot.length + 1; }
test('resource ceilings match the fixed accepted data profile', () => {
  assert.deepEqual(limits,{ maxExpandedBytes:1073741824,maxBatchExpandedBytes:2147483648,maxEntries:32768,maxBatchEntries:65536,
    maxRoleMetadataBytes:4194304,maxBatchMetadataBytes:8388608,maxManifestBytes:1048576,maxBatchManifestBytes:4194304,
    maxPayloadBytes:268435456,maxAggregatePayloadBytes:805306368,maxElfSnapshotBytes:268435456,maxArBytes:8388608,maxTextBytes:1048576,maxOutputBytes:16777216,maxChunkBytes:65536 });
});
test('original frozen event arrays, objects and summaries pass through by identity once per feed', () => {
  const h = harness(); h.batch.beginToolchainEvidenceBatch(); const r = parse(h,0,{ chunk:513 });
  assert.equal(r.arrays.length,h.log.parserCalls); r.arrays.forEach((a,i) => { assert.equal(a,h.log.arrays[i]); for (let j=0;j<a.length;j++) assert.equal(a[j],h.log.arrays[i][j]); });
  assert.equal(r.inventory,h.log.summaries[0]); h.batch.acceptToolchainEvidenceRole(r.core);
  assert.equal(h.batch.snapshotToolchainEvidenceBatch().acceptedRoles,1); h.batch.abortToolchainEvidenceBatch(); released(h.batch);
});
for (const chunk of [7,511,512,513,700,1023,4096,65536]) test(`all regular body hashes and original single-pass events survive chunk size ${chunk}`, () => {
  const h = run({ chunk });
  for (let i = 0; i < 6; i++) for (const member of h.result.roles[i].members) {
    assert.equal(member.bodySha256,member.type === 'file' ? sha(h.observedBodies[i].get(member.path)) : null);
  }
  assert.equal(h.result.regularFiles,h.observedBodies.reduce((n,bodies) => n + bodies.size,0));
  assert.equal(h.result.selectedPayloads,59); assert.equal(h.log.elfCalls,41);
  assert.equal(h.log.formatCalls.filter(k => k === 'rel').length,10); assert.equal(h.log.formatCalls.filter(k => k === 'archive').length,4); assert.equal(h.log.formatCalls.filter(k => k === 'linker').length,4);
  assert.ok(h.log.captures.every(b => b.every(v => v === 0))); released(h.batch);
});
test('legacy projection preserves original key order including raw link metadata, omitting only bodyOffset', () => {
  const h = run(), g = h.result.roles[0], events = h.log.arrays.flat().filter(e => e.path === inputs[0].expectedRoot || e.path.startsWith(inputs[0].expectedRoot + '/'));
  assert.equal(g.legacyMetadataSha256,sha(events.map(e => JSON.stringify(legacy(e)) + '\n').join('')));
  assert.equal(g.offsetMetadataSha256,g.inventory.metadataSha256); assert.notEqual(g.legacyMetadataSha256,g.offsetMetadataSha256);
  assert.equal(g.legacyMetadataHashKind,'LEGACY_WITHOUT_BODY_OFFSET'); assert.equal(g.offsetMetadataHashKind,'OFFSET_EVENT_METADATA');
  const link = g.members.find(e => e.type === 'symlink'); assert.equal(link.linkpath,'../literal-only'); assert.equal(link.linkKind,'parent-components'); assert.equal(link.linkFollowed,false);
});
test('manifest raw text, unknown lines, license hashes and zero files remain data without payload retention', () => {
  const h = run();
  for (const r of h.result.roles) {
    assert.ok(r.members.find(m => m.path.endsWith('/unselected/license')).bodySha256);
    assert.equal(r.members.find(m => m.path.endsWith('/unselected/zero')).bodySha256,sha(''));
    assert.ok(r.members.every(m => !Object.hasOwn(m,'bytes') && !Object.hasOwn(m,'text')));
    assert.ok(r.manifests.every(m => !m.interpreted));
    if (r.role !== 'gnu-sdk') {
      const m = r.manifests.find(m => m.kind === 'RUST_MANIFEST'); assert.equal(m.text,'file:bin/tool\ndir:lib\nfuture:retain verbatim\n');
      assert.deepEqual(m.declarations,[{kind:'file',path:'bin/tool'},{kind:'dir',path:'lib'}]);
    }
  }
  assert.equal(h.result.roles[0].manifests[0].text,'unknown relocation DATA\n');
  assert.equal(h.result.resourceAccounting.buffersAllocated,h.result.resourceAccounting.buffersErased);
  assert.ok(h.result.roles[0].selected.every(t => t.hashObservation === 'FRESH_BODY_HASH'));
  assert.ok(h.result.roles[1].selected.every(t => t.hashObservation === 'MATCHED_EXPECTED_BODY_HASH'));
});
for (const path of ['../escape','/absolute','a//b','a/./b','a/../b','C:/drive','back\\slash','bad\r']) test(`recognized manifest path rejects ${JSON.stringify(path)}`, () => {
  const h = harness({ manifest:'file:' + path + '\n' }); h.batch.beginToolchainEvidenceBatch(); h.batch.acceptToolchainEvidenceRole(parse(h,0).core);
  rejected(() => parse(h,1),'E_EVIDENCE_MANIFEST'); released(h.batch);
});
test('fatal manifest UTF8 rejects before raw bytes can escape', () => {
  const h = harness(); h.batch.beginToolchainEvidenceBatch();
  const bytes = Buffer.from(h.archives[0]), marker = Buffer.from('unknown relocation DATA\n'), at = bytes.indexOf(marker); bytes[at] = 255;
  rejected(() => parse(h,0,{ bytes }),'E_EVIDENCE_MANIFEST'); released(h.batch);
});
for (const [option,code] of [['missingSupplemental','E_EVIDENCE_SUMMARY'],['aliasSupplemental','E_EVIDENCE_TARGET']]) test(`fixed libmvec ${option} stops without alias fallback`, () => {
  const h = harness({ [option]:true }); h.batch.beginToolchainEvidenceBatch(); rejected(() => parse(h,0),code); released(h.batch);
});
test('supplemental unknown span records only the observed literal regular-file span', () => {
  const h = run(), t = h.result.roles[0].selected.find(t => t.selectionRole === 'TARGET_LIBMVEC_PROVIDER');
  assert.ok(t.index > 0); assert.equal(t.bodyOffset % 512,0); assert.equal(t.size,512); assert.equal(t.bodySha256,sha(elfBody()));
});
test('Rust selected body SHA verifies before inspector dispatch', () => {
  const h = harness({ mutate:p => { p.targets[45].expectedSha256 = '0'.repeat(64); } }); h.batch.beginToolchainEvidenceBatch();
  h.batch.acceptToolchainEvidenceRole(parse(h,0).core); const calls = h.log.elfCalls;
  rejected(() => parse(h,1),'E_EVIDENCE_BODY_HASH'); assert.equal(h.log.elfCalls,calls); released(h.batch);
});
for (const [key,value] of [['index',1],['bodyOffset',512],['size',1]]) test(`known selected ${key} mismatch stops without dispatch`, () => {
  const h = harness({ mutate:p => { p.targets[0][key] = value; } }); h.batch.beginToolchainEvidenceBatch();
  rejected(() => parse(h,0),'E_EVIDENCE_TARGET'); assert.equal(h.log.elfCalls,0); released(h.batch);
});
for (const [key,value] of [['archivePasses',1],['archiveDataBytes',0],['archiveRequestedBytes',0],['archiveSha256','0'.repeat(64)],['closeAttempts',1],['stdinFinished',false],['stdoutEnded',false],['stderrEnded',false],['closeObserved',false],['exitCode',1],['signal','SIGTERM'],['mockOnly',false],['nativeQualified',true],['hardDeadlineGuaranteed',true]]) test(`sixth-core ${key} rejects all five previously accepted roles`, () => {
  const h = harness(); five(h); const r = parse(h,5); r.core[key] = value;
  rejected(() => h.batch.acceptToolchainEvidenceRole(r.core),'E_EVIDENCE_CORE'); released(h.batch);
});
test('sixth core must retain the pending original inventory by identity', () => {
  const h = harness(); five(h); const r = parse(h,5); r.core.inventory = { ...r.inventory };
  rejected(() => h.batch.acceptToolchainEvidenceRole(r.core),'E_EVIDENCE_CORE'); released(h.batch);
});
for (const key of ['decodedSha256','metadataSha256']) test(`late sixth ${key} failure drops all provisional namespaces`, () => {
  const h = harness({ mutate:p => { p.expectations[5][key] = '0'.repeat(64); } }); five(h);
  rejected(() => parse(h,5),key === 'decodedSha256' ? 'E_EVIDENCE_DECODED_HASH' : 'E_EVIDENCE_METADATA_HASH'); released(h.batch);
});
test('late sixth original TAR failure exposes only fixed underlying code and wipes all five roles', () => {
  const h = harness(); five(h); const bytes = Buffer.from(h.archives[5]); bytes[bytes.length - 1] = 1;
  rejected(() => parse(h,5,{ bytes }),'E_EVIDENCE_DATA'); released(h.batch);
  assert.equal(h.batch.getToolchainEvidenceFailure().underlyingCode,'E_TERMINATOR');
});
test('snapshot never releases pending data, hashes, paths, core results or namespace records', () => {
  const h = harness(); five(h); const snapshot = h.batch.snapshotToolchainEvidenceBatch();
  assert.equal(snapshot.acceptedRoles,5); assert.doesNotMatch(JSON.stringify(snapshot),/sha256|\.so|\/|members|manifests|inventory/u);
  assert.equal(h.batch.getToolchainEvidenceFailure(),null); h.batch.abortToolchainEvidenceBatch(); released(h.batch);
});
test('same instance cannot restart after abort or finish and cannot create a second parser per role', () => {
  const h = harness(); h.batch.beginToolchainEvidenceBatch(); h.batch.beginToolchainEvidenceRole(roles[0]); h.batch.createTarInventory();
  rejected(() => h.batch.createTarInventory(),'E_EVIDENCE_STATE'); released(h.batch);
  const done = run(); rejected(() => done.batch.beginToolchainEvidenceBatch(),'E_EVIDENCE_STATE');
});
for (const make of [() => new Proxy(Buffer.from([1]),{ get(){ assert.fail('proxy trap'); } }),() => new Uint8Array(new SharedArrayBuffer(8)),
  () => { const b = Buffer.from([1]); Object.defineProperty(b,'length',{ get(){ assert.fail('length getter'); } }); return b; },
  () => ({ get byteLength(){ assert.fail('object getter'); } })]) test('malformed, shared, proxy or accessor chunk rejects without parser calls', () => {
  const h = harness(); h.batch.beginToolchainEvidenceBatch(); h.batch.beginToolchainEvidenceRole(roles[0]); const p = h.batch.createTarInventory();
  rejected(() => p.feed(make()),'E_EVIDENCE_CHUNK'); assert.equal(h.log.parserCalls,0); released(h.batch);
});
test('chunks over 64 KiB reject before parser calls', () => {
  const h = harness(); h.batch.beginToolchainEvidenceBatch(); h.batch.beginToolchainEvidenceRole(roles[0]); const p = h.batch.createTarInventory();
  rejected(() => p.feed(Buffer.alloc(65537)),'E_EVIDENCE_CHUNK'); assert.equal(h.log.parserCalls,0);
});
test('metadata core accessor and proxy records never invoke traps', () => {
  for (const proxied of [false,true]) {
    const h = harness(); five(h); const r = parse(h,5);
    const bad = proxied ? new Proxy(r.core,{ ownKeys(){ assert.fail('proxy'); } }) : Object.defineProperty(r.core,'unused',{ get(){ assert.fail('getter'); } });
    rejected(() => h.batch.acceptToolchainEvidenceRole(bad),'E_EVIDENCE_INPUT'); released(h.batch);
  }
});
for (const key of ['maxPayloadBytes','maxAggregatePayloadBytes','maxElfSnapshotBytes','maxArBytes','maxTextBytes']) test(`lowered ${key} rejects before selected body allocation or inspection`, () => {
  const h = harness({ limits:{ [key]:1 } }); h.batch.beginToolchainEvidenceBatch();
  rejected(() => parse(h,0),'E_EVIDENCE_LIMIT'); assert.ok(h.log.captures.every(b => b.every(v => v === 0))); released(h.batch);
});
for (const key of ['maxManifestBytes','maxBatchManifestBytes']) test(`lowered ${key} rejects before manifest allocation`, () => {
  const h = harness({ limits:{ [key]:1 } }); h.batch.beginToolchainEvidenceBatch();
  rejected(() => parse(h,0),'E_EVIDENCE_MANIFEST_LIMIT'); assert.equal(h.log.elfCalls,0); released(h.batch);
});
test('escaped Unicode metadata obeys the role limit rather than UTF8 byte count', () => {
  const h = harness({ limits:{ maxRoleMetadataBytes:256 }, license:'密'.repeat(100) }); h.batch.beginToolchainEvidenceBatch();
  rejected(() => parse(h,0),'E_EVIDENCE_METADATA'); released(h.batch);
});
test('batch metadata accepts its exact accounting boundary and rejects one byte below', () => {
  const base = run(), cap = base.result.resourceAccounting.metadataBytes;
  assert.ok(cap < 8388608); assert.equal(run({ limits:{ maxBatchMetadataBytes:cap } }).result.resourceAccounting.metadataBytes,cap);
  assert.throws(() => run({ limits:{ maxBatchMetadataBytes:cap - 1 } }),{ code:'E_EVIDENCE_METADATA' });
});
test('complete ASCII output accepts its exact boundary and rejects plus-one size', () => {
  const base = run(), size = ascii(base.result).length;
  const cap = size - (String(limits.maxOutputBytes).length - String(size).length);
  const h = run({ limits:{ maxOutputBytes:cap } }); assert.equal(ascii(h.result).length,cap);
  assert.throws(() => run({ limits:{ maxOutputBytes:cap - 1 } }),{ code:'E_EVIDENCE_OUTPUT' });
});
test('fixture rejects changed roles, new paths, raised caps and production identities', () => {
  const trusted = { parserFactory:tar.createTarInventory,elfInspector:elf.inspectElf64RequirementsV5,formatInspectors };
  for (const change of [p => { p.mockOnly = false; },p => { p.inputs[0].root = inputs[0].root; },p => { p.targets[0].path += '/new'; },p => { p.targets[58].maxBytes = 8388609; },p => { p.limits.maxEntries = 32769; }]) {
    const { p } = profile(); change(p); assert.throws(() => fixture(p,trusted));
  }
});
test('ELF metadata preserves unsafe dynamic tags and leaves every declared edge unresolved in its domain', () => {
  const h = run({ elf:bytes => ({ ...elf.inspectElf64RequirementsV5(bytes),dynamic:{ present:true,needed:['libsame.so'],soname:'libsame.so',unknownTags:[{tag:'1879047931',value:'1'},{tag:'42',value:'2'}] } }) });
  assert.equal(h.result.declaredNeededEdges.length,41);
  for (const edge of h.result.declaredNeededEdges) { assert.equal(edge.status,'UNRESOLVED'); assert.equal(edge.hostTargetPromotion,false); assert.equal(edge.providerQualified,false); }
  for (const role of h.result.roles) for (const t of role.selected.filter(t => t.kind === 'ELF_EXEC_DSO')) {
    assert.equal(t.metadata.requirements.dynamic.unknownTags.length,2); assert.deepEqual(t.metadata.unsafeLoadingTags,[{tag:'1879047931',value:'1'}]); assert.equal(t.metadata.qualified,false);
  }
});
test('publication and authority fields remain exclusively controller-owned', () => {
  const { result } = run(); assert.equal(result.completeNamespace,true); assert.equal(result.historicalRawNotRestored,true); assert.equal(result.mockOnly,true);
  for (const key of ['publicationAccepted','selfDigest','postwriteCounts','sourceInputPins']) assert.equal(Object.hasOwn(result,key),false);
  for (const key of ['extracted','nativeQualified','pythonFreeSubsetVerified','noPythonRuntimeVerified','rustExecuted','rustReady','trainingReady','abiVerified','runtimeProvidersQualified','imageEquivalent','nodeIoQualified','compilerExecuted','installMapInterpreted','hardRssBounded','hardDeadlineGuaranteed','processTreeBounded']) assert.equal(result[key],false,key);
});
test('private linking version-chain pins remain reproducible without calling any physical collector', () => {
  for (const bytes of [rawTar,Buffer.from(privateTar),rawSdk,appendedSdk,Buffer.from(linkedSdk),rawElf,Buffer.from(source),Buffer.from(linkedSource)]) assert.match(sha(bytes),/^[0-9a-f]{64}$/u);
  assert.equal(read('./tar-inventory.mjs').equals(rawTar),true); assert.equal(read('./sdk-payload-inspection.mjs').equals(rawSdk),true);
});
test('GNU offset summary cannot substitute for the legacy expected metadata digest', () => {
  const h = harness({ mutate:p => {
    const f = profile(), parser = tar.createTarInventory(); parser.feed(f.archives[0]);
    p.expectations[0].metadataSha256 = parser.finish().metadataSha256;
  } });
  h.batch.beginToolchainEvidenceBatch(); rejected(() => parse(h,0),'E_EVIDENCE_METADATA_HASH'); released(h.batch);
});
test('unselected regular bodies maintain one hash but no body buffer or decoded spool', () => {
  const text = 'unselected license body '.repeat(200), h = harness({ license:text });
  h.batch.beginToolchainEvidenceBatch(); h.batch.beginToolchainEvidenceRole(roles[0]); const parser = h.batch.createTarInventory();
  const at = h.archives[0].indexOf(Buffer.from(text)); assert.ok(at > 0); parser.feed(h.archives[0].subarray(0,at + 1));
  const snapshot = h.batch.snapshotToolchainEvidenceBatch(); assert.equal(snapshot.activeBufferBytes,0); assert.equal(snapshot.activeBodyHashes,1);
  assert.equal(snapshot.selectedPayloads,0); h.batch.abortToolchainEvidenceBatch(); released(h.batch);
});
test('one-byte fragments work within the unchanged original data-event ceiling', () => {
  const h = harness(); h.batch.beginToolchainEvidenceBatch(); h.batch.acceptToolchainEvidenceRole(parse(h,0).core);
  const r = parse(h,1,{ chunk:1 }); h.batch.acceptToolchainEvidenceRole(r.core);
  assert.equal(h.batch.snapshotToolchainEvidenceBatch().acceptedRoles,2); h.batch.abortToolchainEvidenceBatch(); released(h.batch);
});
test('fixed supplemental 8 MiB gate rejects oversized declared body before allocation or inspector', () => {
  let supplementalReached = false, callsAtGate;
  const h = harness({ events:(events,i) => i ? events : Object.freeze(events.map(e => {
    if (e.path !== targets[58].path) return e;
    supplementalReached = true; callsAtGate = h.log.elfCalls;
    return Object.freeze({ ...e,size:8388609 });
  })) });
  h.batch.beginToolchainEvidenceBatch(); rejected(() => parse(h,0),'E_EVIDENCE_LIMIT');
  assert.equal(supplementalReached,true); assert.equal(h.log.elfCalls,28); assert.ok(callsAtGate <= h.log.elfCalls);
  assert.equal(h.batch.getToolchainEvidenceFailure().path,targets[58].path); assert.equal(h.batch.getToolchainEvidenceFailure().index,null); released(h.batch);
});
test('GNU 64 MiB and Rust 256 MiB wrappers remain separate fixed caller gates', () => {
  assert.ok(targets.slice(0,45).filter(t => t.kind === 'ELF_EXEC_DSO').every(t => t.maxBytes === 67108864));
  assert.ok(targets.slice(45,58).filter(t => t.kind === 'ELF_EXEC_DSO').every(t => t.maxBytes === 268435456));
  assert.match(source,/target\.artifactRole === 'gnu-sdk' \? 67108864 : 268435456/u);
  const h = harness({ mutate:p => { p.targets[0].maxBytes = 511; } });
  h.batch.beginToolchainEvidenceBatch(); rejected(() => parse(h,0),'E_EVIDENCE_LIMIT'); assert.equal(h.log.elfCalls,0); released(h.batch);
});
for (const [key,value] of [['mode',-1],['uid','1000'],['mtime','NaN'],['bodyOffset',513]]) test(`malformed original-event ${key} rejects before capture`, () => {
  const h = harness({ events:events => Object.freeze(events.map(e => e.index === 1 ? Object.freeze({ ...e,[key]:value }) : e)) });
  h.batch.beginToolchainEvidenceBatch(); rejected(() => parse(h,0),'E_EVIDENCE_EVENT'); assert.equal(h.log.elfCalls,0); released(h.batch);
});
test('fixed known selected regular member cannot be replaced with a directory', () => {
  const h = harness({ events:events => Object.freeze(events.map(e => e.path === targets[0].path ? Object.freeze({ ...e,type:'directory',size:0 }) : e)) });
  h.batch.beginToolchainEvidenceBatch(); rejected(() => parse(h,0),'E_EVIDENCE_TARGET'); assert.equal(h.log.elfCalls,0); released(h.batch);
});
test('late sixth wrong original TAR count drops previous roles even when core has not run', () => {
  const h = harness({ summary:(s,i) => i === 5 ? Object.freeze({ ...s,headers:s.headers + 1 }) : s }); five(h);
  rejected(() => parse(h,5),'E_EVIDENCE_SUMMARY'); released(h.batch);
});
test('every original core negative flag remains mandatory on the sixth role', () => {
  const fields = ['extracted','extractionAuthorized','pythonFreeSubsetVerified','installedUsability','decoderQualified','rustReady','trainingReady','provenanceVerified','hardRssBounded','processTreeBounded'];
  for (const key of fields) {
    const h = harness(); five(h); const r = parse(h,5); delete r.core[key];
    rejected(() => h.batch.acceptToolchainEvidenceRole(r.core),'E_EVIDENCE_CORE'); released(h.batch);
  }
});
test('private TAR retains the independent 64 KiB single-extension gate', () => {
  const h = harness(); h.batch.beginToolchainEvidenceBatch(); h.batch.beginToolchainEvidenceRole(roles[0]); const parser = h.batch.createTarInventory();
  rejected(() => parser.feed(header('extension',65537,'L')),'E_EVIDENCE_DATA');
  assert.equal(h.batch.getToolchainEvidenceFailure().underlyingCode,'E_EXTENSION_BYTES'); released(h.batch);
});
test('parser overrides lower only and cannot exceed the fixed 64 KiB chunk profile', () => {
  const h = harness(); h.batch.beginToolchainEvidenceBatch(); h.batch.beginToolchainEvidenceRole(roles[0]);
  rejected(() => h.batch.createTarInventory({ maxChunkBytes:65537 }),'E_EVIDENCE_LIMIT'); released(h.batch);
});
test('original event arrays and record accessors reject without invoking getters', () => {
  let invoked = false;
  const h = harness({ events:events => {
    const first = { ...events[0] }; Object.defineProperty(first,'path',{ get(){ invoked = true; throw Error('private path'); },enumerable:true });
    return Object.freeze([Object.freeze(first),...events.slice(1)]);
  } });
  h.batch.beginToolchainEvidenceBatch(); rejected(() => parse(h,0),'E_EVIDENCE_INPUT'); assert.equal(invoked,false); released(h.batch);
});
test('unsafe inspector error text never enters fixed failure diagnostics', () => {
  const secret = 'PRIVATE_PAYLOAD_AND_CURRENT_HEADER';
  const h = harness({ elf:() => { throw Object.assign(new Error(secret),{ code:secret }); } });
  h.batch.beginToolchainEvidenceBatch(); rejected(() => parse(h,0),'E_EVIDENCE_INSPECT');
  const failure = h.batch.getToolchainEvidenceFailure(); assert.equal(failure.underlyingCode,null); assert.equal(failure.path,targets[0].path);
  assert.doesNotMatch(JSON.stringify(failure),new RegExp(secret)); released(h.batch);
});
test('resizable backing rejects before parser calls when the runtime supports it', () => {
  if (!Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'resizable')) return;
  const h = harness(); h.batch.beginToolchainEvidenceBatch(); h.batch.beginToolchainEvidenceRole(roles[0]); const parser = h.batch.createTarInventory();
  rejected(() => parser.feed(new Uint8Array(new ArrayBuffer(8,{ maxByteLength:16 }))),'E_EVIDENCE_CHUNK'); assert.equal(h.log.parserCalls,0); released(h.batch);
});
