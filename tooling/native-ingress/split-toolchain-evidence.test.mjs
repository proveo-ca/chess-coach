// SPEC: _spec/tooling/native-ingress/step2.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(name, import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const uri = bytes => 'data:text/javascript;base64,' + Buffer.from(bytes).toString('base64');
const ascii = value => JSON.stringify(value).replace(/[^\x00-\x7f]/g, ch => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'));
const pins = {
  './toolchain-evidence.mjs': [48345, 'a59213bf419d509d222d84e8a870ff4fb895f510a058a956725c84e47e154365'],
  './gnu-sdk-inventory.mjs': [23261, 'bd2fc43633ca3b8f0c485eddb68a1b7505002edecd70eee4bf9cc661f588ef29'],
  './tar-inventory.mjs': [15548, '050d629963fdf89bd5dff7639260c7de30b08be46320b7b6bb7ed4dac6bb8139'],
  './sdk-payload-inspection.mjs': [31569, 'fc301816588aa16360ce30a9c18ea7d5d82838432e7bd28f54155024e4445469'],
  './elf-requirements-v5.mjs': [21800, '1d9ebc5b27944ab646b2f61d334d2ff4bf43bddf226402ba225f6c02cf11dccb'],
  './elf-requirements-v3.mjs': [20493, '3bd878fe2a6de57a2b8252163cdf2a4d3093c6605a903105a9f531f039b84f10'],
};
const raw = Object.fromEntries(Object.entries(pins).map(([name, [length, hash]]) => {
  const bytes = read(name); assert.equal(bytes.length, length); assert.equal(sha(bytes), hash); return [name, bytes];
}));
const rawTar = raw['./tar-inventory.mjs'], rawSdk = raw['./sdk-payload-inspection.mjs'];
const rawElf = raw['./elf-requirements-v5.mjs'], rawElfV3 = raw['./elf-requirements-v3.mjs'];
const privateTar = rawTar.toString().replace('maxExtensionBytes: 65_536', 'maxExtensionBytes: 4_194_304')
  .replace("if (size > limits.maxExtensionBytes - extensionBytes) fail('E_EXTENSION_BYTES');", "if (size > 65_536 || size > limits.maxExtensionBytes - extensionBytes) fail('E_EXTENSION_BYTES');")
  .replace('{ index: entries + 1, path: key, type: kind, size }', '{ index: entries + 1, path: key, type: kind, size, bodyOffset: consumedBytes }');
assert.equal(Buffer.byteLength(privateTar), 15595);
assert.equal(sha(privateTar), 'bf8c7fcc56c26aa0618c014d74046dc29b79c09340728b27dd0363a758b9ef9a');
const appendedSdk = Buffer.concat([rawSdk, Buffer.from('\nexport const SOURCE_FORMAT_INSPECTORS = Object.freeze({rel,archive,linker});\n')]);
const tarLinkedSdk = appendedSdk.toString().replace("from './tar-inventory.mjs'", `from '${uri(privateTar)}'`);
const linkedSdk = tarLinkedSdk.replace("from './elf-requirements-v3.mjs'", `from '${uri(rawElfV3)}'`);
assert.equal(sha(appendedSdk), '22be684fb42feecbf6ac629f8e1fbf310bb31635325a9d1dc5a9e81fd75ee3b8');
assert.equal(sha(linkedSdk), 'aeeafd8124729ef1ee3d54787c40249a6740796ae806a8d97d370e042690d2f2');
const source = read('./split-toolchain-evidence.mjs').toString();
const tarLinkedCollector = source.replace("from './tar-inventory.mjs'", `from '${uri(privateTar)}'`);
const elfLinkedCollector = tarLinkedCollector.replace("from './elf-requirements-v5.mjs'", `from '${uri(rawElf)}'`);
const linkedSource = elfLinkedCollector.replace("from './sdk-payload-inspection.mjs'", `from '${uri(linkedSdk)}'`);
const inertV1 = raw['./toolchain-evidence.mjs'].toString().split('const negativeFlags =')[0].replace(/^import .+;\n/gmu, '');
assert.doesNotMatch(inertV1, /function collector|const production|beginToolchainEvidenceBatch/u);
const [m, old, tar, sdk, elf] = await Promise.all([
  import(uri(linkedSource)), import(uri(inertV1)), import(uri(privateTar)), import(uri(linkedSdk)), import(uri(rawElf)),
]);
const { SPLIT_TOOLCHAIN_EVIDENCE_PARTS: parts, SPLIT_TOOLCHAIN_EVIDENCE_INPUTS: inputs,
  SPLIT_TOOLCHAIN_EVIDENCE_TARGETS: targets, SPLIT_TOOLCHAIN_EVIDENCE_EXPECTATIONS: expectations,
  SPLIT_TOOLCHAIN_EVIDENCE_LIMITS: limits, SPLIT_TOOLCHAIN_EVIDENCE_PROFILES: profiles,
  createSplitToolchainEvidenceCollector: production, createSplitToolchainEvidenceFixture: fixture } = m;
const formatInspectors = sdk.SOURCE_FORMAT_INSPECTORS;
const trusted = { parserFactory: tar.createTarInventory, elfInspector: elf.inspectElf64RequirementsV5, formatInspectors };
const legacy = e => {
  const p = { index: e.index, path: e.path, type: e.type, size: e.size };
  if (['symlink', 'hardlink'].includes(e.type)) { p.linkpath = e.linkpath; p.linkKind = e.linkKind; }
  return { ...p, mode: e.mode, uid: e.uid, gid: e.gid, mtime: e.mtime };
};
function header(path, size = 0, type = '0', link = '') {
  const b = Buffer.alloc(512), slash = path.lastIndexOf('/');
  if (Buffer.byteLength(path) > 100) { b.write(path.slice(slash + 1), 0, 100); b.write(path.slice(0, slash), 345, 155); }
  else b.write(path, 0, 100);
  for (const [at, width, value] of [[100,8,0o644],[108,8,1000],[116,8,1000],[124,12,size],[136,12,0]]) b.write(value.toString(8).padStart(width - 1, '0') + '\0', at, width, 'ascii');
  b[156] = type.charCodeAt(0); b.write(link,157,100); b.write('ustar\0',257,6); b.write('00',263,2); b.fill(32,148,156);
  b.write(b.reduce((a,v) => a + v,0).toString(8).padStart(6,'0') + '\0 ',148,8); return b;
}
const member = (path, body = Buffer.alloc(0), type = '0', link = '') => Buffer.concat([header(path,body.length,type,link),body,Buffer.alloc((512 - body.length % 512) % 512)]);
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
function profile(part, options = {}) {
  const archives = [], observedBodies = [], selected = new Map(), expected = [];
  for (const [i, input] of inputs[part].entries()) {
    const root = input.expectedRoot, component = input.role === 'rust-std' ? 'rust-std-x86_64-unknown-linux-gnu' : input.role;
    const chunks = [], bodies = new Map();
    const add = (path, bytes = Buffer.alloc(0), type = '0', link = '') => { chunks.push(member(path,bytes,type,link)); if (type === '0') bodies.set(path,bytes); };
    add(root,Buffer.alloc(0),'5');
    if (input.role === 'gnu-sdk') {
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
    const rows = targets[part].filter(t => t.artifactRole === input.role).sort((a,b) => (a.index ?? 10000) - (b.index ?? 10000));
    for (const t of rows) {
      let body = t.kind === 'ELF_EXEC_DSO' ? elfBody() : t.kind === 'ET_REL' ? elfBody(1) : t.kind === 'AR' ? arBody() : Buffer.from('INPUT ( libfixture.so )\n');
      body = options.body?.(body,t) ?? body;
      const offset = chunks.reduce((n,b) => n + b.length,0) + 512, index = chunks.length + 1;
      const supplemental = t.selectionRole === 'TARGET_LIBMVEC_PROVIDER';
      selected.set(t.path,{ ...t, index: supplemental ? null : index, bodyOffset: supplemental ? null : offset,
        size: supplemental ? null : body.length, expectedSha256: t.expectedSha256 === null ? null : sha(body) });
      if (supplemental && options.missingSupplemental) continue;
      if (supplemental && options.aliasSupplemental) add(t.path,Buffer.alloc(0),'2','libm.so.6');
      else add(t.path,body);
    }
    const bytes = Buffer.concat([...chunks,Buffer.alloc(1024)]), parser = tar.createTarInventory(), events = [];
    for (let at = 0; at < bytes.length; at += 65536) events.push(...parser.feed(bytes.subarray(at,at + 65536)));
    const summary = parser.finish();
    expected.push({ ...expectations[part][i], expandedBytes: bytes.length, entries: summary.entries, headers: summary.headers,
      regularFiles: events.filter(e => e.type === 'file').length, decodedSha256: sha(bytes),
      metadataSha256: input.role === 'gnu-sdk' ? sha(events.map(e => JSON.stringify(legacy(e)) + '\n').join('')) : summary.metadataSha256 });
    archives.push(bytes); observedBodies.push(bodies);
  }
  return { part, archives, observedBodies, p: { mockOnly: true, inputs: inputs[part].map((input,i) => {
    const root = '/fixture/toolchain-' + i, archiveBytes = i + 3;
    return { ...input, root, file: `${root}/${input.expectedRoot}.tar.xz`, archiveBytes, archiveSha256: sha('compressed fixture ' + part + i),
      identity: { root: { ...input.identity.root, ino: String(i + 1) }, file: { ...input.identity.file, ino: String(i + 10), size: String(archiveBytes) } } };
  }), targets: targets[part].map(t => selected.get(t.path)), expectations: expected, limits: options.limits ?? {} } };
}
function harness(part, options = {}) {
  const f = profile(part, options); options.mutate?.(f.p);
  const log = { arrays: [], summaries: [], parserCalls: 0, parserLimits: [], elfCalls: 0, formatCalls: [], captures: [] };
  const batch = fixture(part, f.p, { parserFactory(parserLimits) {
    const i = log.parserLimits.length; log.parserLimits.push(parserLimits);
    const parser = tar.createTarInventory(parserLimits);
    return Object.freeze({ feed(bytes) {
      log.parserCalls++; const original = parser.feed(bytes), events = options.events?.(original,i) ?? original;
      log.arrays.push(events); return events;
    }, finish() { const original = parser.finish(), summary = options.summary?.(original,i) ?? original; log.summaries.push(summary); return summary; } });
  }, elfInspector(bytes) {
    log.elfCalls++; log.captures.push(bytes); return options.elf ? options.elf(bytes) : elf.inspectElf64RequirementsV5(bytes);
  }, formatInspectors: Object.fromEntries(Object.entries(formatInspectors).map(([kind,fn]) => [kind,bytes => {
    log.formatCalls.push(kind); log.captures.push(bytes); return fn(bytes);
  }])) });
  return { ...f, batch, log };
}
const mandatoryFlags = ['extracted','extractionAuthorized','pythonFreeSubsetVerified','installedUsability','nativeQualified',
  'decoderQualified','rustReady','trainingReady','provenanceVerified','hardRssBounded','processTreeBounded','hardDeadlineGuaranteed'];
function coreFor(input, inventory) {
  return { state: 'GNU_SDK_DATA_INVENTORY', mockOnly: true, inventory, archiveBytes: input.archiveBytes, archiveSha256: input.archiveSha256,
    archivePasses: 2, archiveDataBytes: input.archiveBytes * 2, archiveRequestedBytes: input.archiveBytes * 2 + 2,
    closeAttempts: 2, stdinFinished: true, stdoutEnded: true, stderrEnded: true, closeObserved: true, exitCode: 0, signal: null,
    ...Object.fromEntries(mandatoryFlags.map(key => [key,false])) };
}
function parse(h,i,options = {}) {
  h.batch.beginToolchainEvidenceRole(inputs[h.part][i].role);
  const parser = h.batch.createTarInventory(options.overrides ?? {}), arrays = [], bytes = options.bytes ?? h.archives[i], chunk = options.chunk ?? 65536;
  for (let at = 0; at < bytes.length; at += chunk) arrays.push(parser.feed(bytes.subarray(at,at + chunk)));
  const inventory = parser.finish(); return { parser, arrays, inventory, core: coreFor(h.p.inputs[i],inventory) };
}
function run(part, options = {}) {
  const h = harness(part,options); h.batch.beginToolchainEvidenceBatch();
  for (let i = 0; i < inputs[part].length; i++) h.batch.acceptToolchainEvidenceRole(parse(h,i,{ chunk: options.chunk }).core);
  return { ...h, result: h.batch.finishToolchainEvidenceBatch() };
}
function preceding(h) {
  h.batch.beginToolchainEvidenceBatch();
  for (let i = 0; i < inputs[h.part].length - 1; i++) h.batch.acceptToolchainEvidenceRole(parse(h,i).core);
}
function rejected(fn,code) {
  assert.throws(fn,error => {
    assert.equal(error.code,code); assert.ok(Object.isFrozen(error));
    for (const key of ['payload','hash','members','inventory','cause','result']) assert.equal(Object.hasOwn(error,key),false);
    return true;
  });
}
function released(batch) {
  const s = batch.snapshotToolchainEvidenceBatch();
  for (const key of ['acceptedRoles','entries','regularFiles','expandedBytes','capturedBytes','selectedPayloads','metadataBytes','manifestBytes','activeBufferBytes','activeBodyHashes','buffersAllocated','buffersErased','peakPayloadBytes']) assert.equal(s[key],0,key);
  assert.equal(s.currentRole,null); assert.doesNotMatch(JSON.stringify(s), /sha256|\.so|\/|members|manifests|inventory/u);
}
function deepFrozen(value) {
  if (!value || typeof value !== 'object') return;
  assert.ok(Object.isFrozen(value)); for (const child of Object.values(value)) deepFrozen(child);
}

test('production API is closed and has no I/O, execution, timing or old collector authority', () => {
  assert.ok(source.startsWith('// SPEC: _spec/tooling/native-ingress/step2.puml\n'));
  assert.deepEqual([...source.matchAll(/from '([^']+)'/gu)].map(row => row[1]), ['node:crypto','node:util','./tar-inventory.mjs','./elf-requirements-v5.mjs','./sdk-payload-inspection.mjs']);
  assert.doesNotMatch(source,/node:(?:fs|path|child_process)|\b(?:fetch|spawn|eval|readFile|writeFile|performance|Date|setTimeout)\b|from '.\/toolchain-evidence/u);
  assert.deepEqual(Object.keys(m).sort(), ['SPLIT_TOOLCHAIN_EVIDENCE_PARTS','SPLIT_TOOLCHAIN_EVIDENCE_INPUTS','SPLIT_TOOLCHAIN_EVIDENCE_EXPECTATIONS',
    'SPLIT_TOOLCHAIN_EVIDENCE_TARGETS','SPLIT_TOOLCHAIN_EVIDENCE_LIMITS','SPLIT_TOOLCHAIN_EVIDENCE_PROFILES','createSplitToolchainEvidenceCollector','createSplitToolchainEvidenceFixture'].sort());
  assert.doesNotMatch(source, /accepted\.length (?:!==|>=) 6|selectedCount !== 59|artifactCount: 6|selectedPayloads: 59/u);
});
test('private graph uses the pinned event TAR and appended SDK formats without modifying any old source', () => {
  assert.equal(read('./sdk-payload-inspection.mjs').includes('export const SOURCE_FORMAT_INSPECTORS'),false);
  assert.deepEqual(appendedSdk.subarray(0,rawSdk.length),rawSdk); assert.deepEqual(Object.keys(formatInspectors),['rel','archive','linker']);
  for (const [name, [length, hash]] of Object.entries(pins)) { const bytes = read(name); assert.equal(bytes.length,length); assert.equal(sha(bytes),hash); }
});
test('shared exact part enum and unchanged flat limits equal inert pinned V1 constants', () => {
  assert.deepEqual(parts,['gnu','rust']); assert.deepEqual(limits,old.TOOLCHAIN_EVIDENCE_LIMITS);
  deepFrozen(parts); deepFrozen(limits);
});
test('profiles contain exact fixed production totals without authority', () => {
  assert.deepEqual(profiles, {
    gnu: { part:'gnu',roles:['gnu-sdk'],artifactCount:1,targetCount:46,expandedBytes:505333760,entries:8412,regularFiles:6891 },
    rust: { part:'rust',roles:['cargo','rustc','rust-std','rustfmt-preview','clippy-preview'],artifactCount:5,targetCount:13,expandedBytes:642746880,entries:263,regularFiles:215 },
  }); deepFrozen(profiles);
});
test('production rejects unknown parts and extra arguments before reserving either one-shot partition', () => {
  for (const part of [undefined,null,'all','GNU','gnu-sdk',[],{},new Proxy({}, { get(){ assert.fail('proxy'); } })]) rejected(() => production(part),'E_EVIDENCE_INPUT');
  rejected(() => production(),'E_EVIDENCE_INPUT');
  for (const part of parts) {
    rejected(() => production(part,{}),'E_EVIDENCE_INPUT');
    const batch = production(part); assert.ok(Object.isFrozen(batch));
    assert.deepEqual(Object.keys(batch),['beginToolchainEvidenceBatch','beginToolchainEvidenceRole','createTarInventory','acceptToolchainEvidenceRole',
      'finishToolchainEvidenceBatch','abortToolchainEvidenceBatch','getToolchainEvidenceFailure','snapshotToolchainEvidenceBatch']);
    assert.equal(batch.snapshotToolchainEvidenceBatch().part,part); assert.equal(batch.snapshotToolchainEvidenceBatch().mockOnly,false);
    batch.beginToolchainEvidenceBatch(); batch.beginToolchainEvidenceRole(inputs[part][0].role); batch.abortToolchainEvidenceBatch();
    rejected(() => production(part),'E_EVIDENCE_STATE'); released(batch);
  }
});
test('GNU sdk-relocs SHA and size retain the authoritative receipt guard', () => {
  const receipt = JSON.parse(read('../../_spec/tooling/native-ingress/gnu-sdk-manifest-membership.receipt.json'));
  const hash = source.match(/^const SDK_RELOCS_SHA256 = '([0-9a-f]{64})';$/mu)[1];
  assert.equal(hash,receipt.manifest.sha256); assert.equal(receipt.manifest.byteLength,9367);
  assert.ok(source.includes("if (!mockOnly && b.manifest === 'GNU_RAW_TEXT' && b.event.path.endsWith('/sdk-relocs')\n        && (b.event.size !== SDK_RELOCS_BYTES || sha256 !== SDK_RELOCS_SHA256)) fail('E_EVIDENCE_BODY_HASH');"));
  assert.ok(source.includes("if (!mockOnly && active.input.role === 'gnu-sdk' && p.size !== (p.path.endsWith('/sdk-relocs') ? SDK_RELOCS_BYTES : 79)) fail('E_EVIDENCE_MANIFEST');"));
});

for (const part of parts) {
  test(`${part}: every descriptor, identity, expectation and target equals the inert pinned V1 partition`, () => {
    const keep = row => part === 'gnu' ? (row.role ?? row.artifactRole) === 'gnu-sdk' : (row.role ?? row.artifactRole) !== 'gnu-sdk';
    assert.deepEqual(inputs[part],old.TOOLCHAIN_EVIDENCE_INPUTS.filter(keep));
    assert.deepEqual(expectations[part],old.TOOLCHAIN_EVIDENCE_EXPECTATIONS.filter(keep));
    assert.deepEqual(targets[part],old.TOOLCHAIN_EVIDENCE_TARGETS.filter(keep));
    assert.equal(inputs[part].length,profiles[part].artifactCount); assert.equal(targets[part].length,profiles[part].targetCount);
    for (const key of ['entries','regularFiles','expandedBytes']) assert.equal(expectations[part].reduce((n,r) => n + r[key],0),profiles[part][key]);
    for (const value of [inputs,expectations,targets]) deepFrozen(value);
    assert.equal(targets[part].some(t => t.selectionRole === 'TARGET_LIBMVEC_PROVIDER'),part === 'gnu');
  });
  test(`${part}: full independent collection returns the complete partition and all negative qualifications`, () => {
    const h = run(part), r = h.result;
    assert.equal(r.profile,'SPLIT_TOOLCHAIN_EVIDENCE_DATA'); assert.equal(r.state,r.profile); assert.equal(r.part,part);
    assert.equal(r.artifactCount,inputs[part].length); assert.equal(r.selectedPayloads,targets[part].length); assert.equal(r.targetCount,targets[part].length);
    assert.deepEqual(r.roles.map(r => r.role),profiles[part].roles); assert.ok(r.roles.every(r => r.completeNamespace && !r.qualified));
    for (const key of ['entries','regularFiles','expandedBytes']) assert.equal(r[key],h.p.expectations.reduce((n,v) => n + v[key],0));
    for (const key of [...mandatoryFlags,'archiveExtracted','filesInstalled','pythonRuntimeInvoked','noPythonRuntimeVerified','nativeAuthority','compilerExecuted','sourceReady','rootfsReady','installReady','abiVerified','loaderClosureVerified','runtimeProvidersQualified','imageEquivalent','nodeIoQualified','dockerProviderQualified','relocationReady','roleSatisfied','rustExecuted','imagePrepared','installMapInterpreted']) assert.equal(r[key],false,key);
    for (const key of ['publicationAccepted','selfDigest','postwriteCounts','sourceInputPins']) assert.equal(Object.hasOwn(r,key),false);
    assert.equal(r.completeNamespace,true); assert.equal(r.historicalRawNotRestored,true); assert.equal(r.mockOnly,true);
    deepFrozen(r); released(h.batch);
    assert.equal(h.log.elfCalls,part === 'gnu' ? 29 : 12);
    assert.ok(h.log.captures.every(b => b.every(v => v === 0)));
  });
  for (const chunk of part === 'gnu' ? [7,511,512,513,700,1023,4096,65536] : [1,7,511,512,513,700,1023,4096,65536]) test(`${part}: streaming hashes, null non-REG bodies and feed identity survive chunk ${chunk}`, () => {
    const h = run(part,{chunk});
    for (let i = 0; i < h.result.roles.length; i++) for (const member of h.result.roles[i].members) {
      assert.equal(member.bodySha256,member.type === 'file' ? sha(h.observedBodies[i].get(member.path)) : null);
      if (member.type !== 'file') { assert.equal(member.size,0); assert.equal(member.linkFollowed,false); assert.ok(Object.hasOwn(member,'bodySha256')); }
    }
    assert.equal(h.log.arrays.length,h.log.parserCalls);
    assert.equal(h.result.resourceAccounting.buffersAllocated,h.result.resourceAccounting.buffersErased);
    released(h.batch);
  });
  test(`${part}: original feed arrays, events and pending inventory retain identity`, () => {
    const h = harness(part); h.batch.beginToolchainEvidenceBatch(); const r = parse(h,0,{chunk:513});
    r.arrays.forEach((a,i) => { assert.equal(a,h.log.arrays[i]); for (let j = 0; j < a.length; j++) assert.equal(a[j],h.log.arrays[i][j]); });
    assert.equal(r.inventory,h.log.summaries[0]); h.batch.acceptToolchainEvidenceRole(r.core);
    assert.equal(h.batch.snapshotToolchainEvidenceBatch().acceptedRoles,1); h.batch.abortToolchainEvidenceBatch(); released(h.batch);
  });
  test(`${part}: manifests preserve complete raw UTF8, unsupported lines and zero-file hashes as inert data`, () => {
    const h = run(part);
    for (const r of h.result.roles) {
      assert.equal(r.members.find(m => m.path.endsWith('/unselected/zero')).bodySha256,sha(''));
      assert.ok(r.members.every(m => !Object.hasOwn(m,'bytes') && !Object.hasOwn(m,'text')));
      assert.ok(r.manifests.every(m => !m.interpreted));
      if (r.role === 'gnu-sdk') {
        assert.equal(r.manifests.length,2); assert.equal(r.manifests[0].text,'unknown relocation DATA\n');
        const link = r.members.find(m => m.type === 'symlink'); assert.equal(link.linkpath,'../literal-only'); assert.equal(link.linkFollowed,false);
      } else {
        assert.deepEqual(r.manifests.map(m => m.kind),['RUST_COMPONENTS','RUST_INSTALLER_VERSION','RUST_MANIFEST']);
        const manifest = r.manifests[2]; assert.equal(manifest.text,'file:bin/tool\ndir:lib\nfuture:retain verbatim\n');
        assert.deepEqual(manifest.declarations,[{kind:'file',path:'bin/tool'},{kind:'dir',path:'lib'}]);
        assert.ok(r.members.every(m => !m.path.includes('/share/buildroot/')));
      }
    }
  });
  test(`${part}: external shallow-frozen ELF roots acquire deeply immutable descendants`, () => {
    const observed = [];
    const h = run(part,{elf:bytes => {
      const dynamic = {present:true,needed:['libsame.so'],soname:null,unknownTags:[{tag:'1879047931',value:'1'}]};
      assert.equal(Object.isFrozen(dynamic),false);
      const root = Object.freeze({...elf.inspectElf64RequirementsV5(bytes),dynamic}); observed.push(root); return root;
    }});
    for (const root of observed) { deepFrozen(root); assert.throws(() => root.dynamic.needed.push('mutable'),TypeError); }
    assert.equal(h.result.declaredNeededEdges.length,part === 'gnu' ? 29 : 12);
    for (const edge of h.result.declaredNeededEdges) {
      assert.equal(edge.status,'UNRESOLVED'); assert.equal(edge.hostTargetPromotion,false); assert.equal(edge.aliasFollowed,false); assert.equal(edge.providerQualified,false); assert.equal(edge.abiVerified,false);
      assert.equal(edge.domain,targets[part].find(t => t.path === edge.from).domain);
    }
    for (const role of h.result.roles) for (const t of role.selected.filter(t => t.kind === 'ELF_EXEC_DSO')) {
      assert.equal(t.metadata.unsafeLoadingTags.length,1); assert.equal(t.metadata.qualified,false);
    }
  });
  for (const role of profiles[part === 'gnu' ? 'rust' : 'gnu'].roles) test(`${part}: cross-part role ${role} cannot enter the lifecycle`, () => {
    const h = harness(part); h.batch.beginToolchainEvidenceBatch();
    rejected(() => h.batch.beginToolchainEvidenceRole(role),'E_EVIDENCE_STATE'); released(h.batch);
  });
  test(`${part}: incomplete partition and an extra role both fail closed`, () => {
    const h = harness(part); preceding(h); rejected(() => h.batch.finishToolchainEvidenceBatch(),'E_EVIDENCE_STATE'); released(h.batch);
    const other = harness(part); other.batch.beginToolchainEvidenceBatch();
    for (let i = 0; i < inputs[part].length; i++) other.batch.acceptToolchainEvidenceRole(parse(other,i).core);
    rejected(() => other.batch.beginToolchainEvidenceRole(inputs[part][0].role),'E_EVIDENCE_STATE'); released(other.batch);
  });
  test(`${part}: manifest paths cannot overlap selected targets`, () => {
    const f = profile(part), input = inputs[part][0];
    f.p.targets[0].path = input.expectedRoot + (part === 'gnu' ? '/share/buildroot/sdk-relocs' : '/components');
    rejected(() => fixture(part,f.p,trusted),'E_EVIDENCE_TARGET');
  });
  for (const [key,value] of [['index',1],['bodyOffset',512],['size',1]]) test(`${part}: known selected ${key} mismatch stops before inspection`, () => {
    const h = harness(part,{mutate:p => {p.targets[0][key] = value;}}); h.batch.beginToolchainEvidenceBatch();
    rejected(() => parse(h,0),'E_EVIDENCE_TARGET'); assert.equal(h.log.elfCalls,0); released(h.batch);
  });
  for (const [key,value] of [['mode',-1],['uid','1000'],['mtime','NaN'],['bodyOffset',513],['size',1]]) test(`${part}: malformed non-REG event ${key} fails before allocation`, () => {
    const h = harness(part,{events:events => Object.freeze(events.map(e => e.index === 1 ? Object.freeze({...e,[key]:value}) : e))});
    h.batch.beginToolchainEvidenceBatch(); rejected(() => parse(h,0),'E_EVIDENCE_EVENT'); assert.equal(h.log.elfCalls,0); released(h.batch);
  });
  test(`${part}: selected regular members cannot become directories or links`, () => {
    for (const type of ['directory','symlink','hardlink']) {
      const h = harness(part,{events:events => Object.freeze(events.map(e => e.path !== targets[part][0].path ? e : Object.freeze({
        ...e,type,size:0,...(type === 'directory' ? {} : {linkpath:'literal-only',linkKind:'relative'}),
      })))}); h.batch.beginToolchainEvidenceBatch();
      rejected(() => parse(h,0),'E_EVIDENCE_TARGET'); assert.equal(h.log.elfCalls,0); released(h.batch);
    }
  });
  test(`${part}: the expected root cannot change through header discovery`, () => {
    const h = harness(part,{events:events => Object.freeze(events.map(e => Object.freeze({...e,path:'discovered-root/' + e.path})))});
    h.batch.beginToolchainEvidenceBatch(); rejected(() => parse(h,0),'E_EVIDENCE_ROOT'); released(h.batch);
  });
  for (const [key,value] of [['archiveBytes',0],['archivePasses',1],['archiveDataBytes',0],['archiveRequestedBytes',0],['archiveSha256','0'.repeat(64)],['closeAttempts',1],['stdinFinished',false],['stdoutEnded',false],['stderrEnded',false],['closeObserved',false],['exitCode',1],['signal','SIGTERM'],['mockOnly',false],['nativeQualified',true],['hardDeadlineGuaranteed',true]]) test(`${part}: final core ${key} withholds every provisional role`, () => {
    const h = harness(part); preceding(h); const r = parse(h,inputs[part].length - 1); r.core[key] = value;
    rejected(() => h.batch.acceptToolchainEvidenceRole(r.core),'E_EVIDENCE_CORE'); released(h.batch);
  });
  for (const key of mandatoryFlags) test(`${part}: final core explicitly requires false ${key}`, () => {
    const h = harness(part); preceding(h); const r = parse(h,inputs[part].length - 1); delete r.core[key];
    rejected(() => h.batch.acceptToolchainEvidenceRole(r.core),'E_EVIDENCE_CORE'); released(h.batch);
  });
  test(`${part}: final core rejects a copied pending inventory`, () => {
    const h = harness(part); preceding(h); const r = parse(h,inputs[part].length - 1); r.core.inventory = {...r.inventory};
    rejected(() => h.batch.acceptToolchainEvidenceRole(r.core),'E_EVIDENCE_CORE'); released(h.batch);
  });
  for (const key of ['decodedSha256','metadataSha256']) test(`${part}: late final ${key} drops all provisional namespaces`, () => {
    const h = harness(part,{mutate:p => { p.expectations.at(-1)[key] = '0'.repeat(64); }}); preceding(h);
    rejected(() => parse(h,inputs[part].length - 1),key === 'decodedSha256' ? 'E_EVIDENCE_DECODED_HASH' : 'E_EVIDENCE_METADATA_HASH'); released(h.batch);
  });
  test(`${part}: late final TAR close failure exposes only a fixed code and no source data`, () => {
    const h = harness(part); preceding(h); const i = inputs[part].length - 1, bytes = Buffer.from(h.archives[i]); bytes[bytes.length - 1] = 1;
    rejected(() => parse(h,i,{bytes}),'E_EVIDENCE_DATA'); released(h.batch);
    assert.equal(h.batch.getToolchainEvidenceFailure().underlyingCode,'E_TERMINATOR');
    assert.doesNotMatch(JSON.stringify(h.batch.getToolchainEvidenceFailure()),/members|manifests|sha256|payload/u);
  });
  test(`${part}: late wrong TAR count fails before core admission`, () => {
    const h = harness(part,{summary:(s,i) => i === inputs[part].length - 1 ? Object.freeze({...s,headers:s.headers + 1}) : s}); preceding(h);
    rejected(() => parse(h,inputs[part].length - 1),'E_EVIDENCE_SUMMARY'); released(h.batch);
  });
  test(`${part}: snapshot counters never grant source or publication permission`, () => {
    const h = harness(part); preceding(h); const snapshot = h.batch.snapshotToolchainEvidenceBatch();
    assert.equal(snapshot.acceptedRoles,inputs[part].length - 1); assert.equal(snapshot.part,part);
    assert.doesNotMatch(JSON.stringify(snapshot),/sha256|\.so|\/|members|manifests|inventory|Accepted|Authorized|sourceReady/u);
    assert.equal(h.batch.getToolchainEvidenceFailure(),null); h.batch.abortToolchainEvidenceBatch(); released(h.batch);
  });
  for (const make of [() => new Proxy(Buffer.from([1]),{get(){assert.fail('proxy trap');}}),() => new Uint8Array(new SharedArrayBuffer(8)),
    () => {const b = Buffer.from([1]); Object.defineProperty(b,'length',{get(){assert.fail('getter');}}); return b;},
    () => ({get byteLength(){assert.fail('getter');}}),() => Buffer.alloc(65537),() => Buffer.alloc(0)]) test(`${part}: malformed or unsafe backing rejects without parser dispatch`, () => {
    const h = harness(part); h.batch.beginToolchainEvidenceBatch(); h.batch.beginToolchainEvidenceRole(inputs[part][0].role); const parser = h.batch.createTarInventory();
    rejected(() => parser.feed(make()),'E_EVIDENCE_CHUNK'); assert.equal(h.log.parserCalls,0); released(h.batch);
  });
  test(`${part}: resizable backing rejects without parser dispatch where supported`, () => {
    if (!Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'resizable')) return;
    const h = harness(part); h.batch.beginToolchainEvidenceBatch(); h.batch.beginToolchainEvidenceRole(inputs[part][0].role); const parser = h.batch.createTarInventory();
    rejected(() => parser.feed(new Uint8Array(new ArrayBuffer(8,{maxByteLength:16}))),'E_EVIDENCE_CHUNK'); assert.equal(h.log.parserCalls,0); released(h.batch);
  });
  test(`${part}: event accessors and proxies reject without invoking traps`, () => {
    for (const proxy of [false,true]) {
      const h = harness(part,{events:events => {
        const first = proxy ? new Proxy(events[0],{get(){assert.fail('get');},ownKeys(){assert.fail('keys');}})
          : Object.freeze(Object.defineProperty({...events[0]},'path',{get(){assert.fail('path getter');},enumerable:true}));
        return Object.freeze([first,...events.slice(1)]);
      }}); h.batch.beginToolchainEvidenceBatch(); rejected(() => parse(h,0),'E_EVIDENCE_INPUT'); released(h.batch);
    }
  });
  test(`${part}: core accessors and proxies reject without invoking traps`, () => {
    for (const proxy of [false,true]) {
      const h = harness(part); preceding(h); const r = parse(h,inputs[part].length - 1);
      const bad = proxy ? new Proxy(r.core,{ownKeys(){assert.fail('proxy');}}) : Object.defineProperty(r.core,'unused',{get(){assert.fail('getter');}});
      rejected(() => h.batch.acceptToolchainEvidenceRole(bad),'E_EVIDENCE_INPUT'); released(h.batch);
    }
  });
  for (const key of ['maxPayloadBytes','maxAggregatePayloadBytes','maxElfSnapshotBytes']) test(`${part}: lower ${key} rejects before payload inspection`, () => {
    const h = harness(part,{limits:{[key]:1}}); h.batch.beginToolchainEvidenceBatch();
    rejected(() => parse(h,0),'E_EVIDENCE_LIMIT'); assert.equal(h.log.elfCalls,0); released(h.batch);
  });
  for (const key of ['maxManifestBytes','maxBatchManifestBytes']) test(`${part}: lower ${key} rejects before manifest allocation`, () => {
    const h = harness(part,{limits:{[key]:1}}); h.batch.beginToolchainEvidenceBatch();
    rejected(() => parse(h,0),'E_EVIDENCE_MANIFEST_LIMIT'); assert.equal(h.log.elfCalls,0); released(h.batch);
  });
  test(`${part}: exact batch metadata boundary preserves the accounting cost`, () => {
    const cap = run(part).result.resourceAccounting.metadataBytes;
    assert.equal(run(part,{limits:{maxBatchMetadataBytes:cap}}).result.resourceAccounting.metadataBytes,cap);
    assert.throws(() => run(part,{limits:{maxBatchMetadataBytes:cap - 1}}),{code:'E_EVIDENCE_METADATA'});
  });
  test(`${part}: complete escaped ASCII output accepts the exact boundary and rejects one byte below`, () => {
    const size = ascii(run(part).result).length, cap = size - (String(limits.maxOutputBytes).length - String(size).length);
    assert.equal(ascii(run(part,{limits:{maxOutputBytes:cap}}).result).length,cap);
    assert.throws(() => run(part,{limits:{maxOutputBytes:cap - 1}}),{code:'E_EVIDENCE_OUTPUT'});
  });
  test(`${part}: Unicode ASCII escaping, rather than UTF8 size, exhausts role metadata`, () => {
    const text = '密'.repeat(100), options = part === 'gnu' ? {gnuText:text} : {manifest:'future:' + text};
    const h = harness(part,{...options,limits:{maxRoleMetadataBytes:512}}); h.batch.beginToolchainEvidenceBatch();
    rejected(() => parse(h,0),'E_EVIDENCE_METADATA'); released(h.batch);
  });
  test(`${part}: UTF8 manifest failure withholds raw text`, () => {
    const h = harness(part); h.batch.beginToolchainEvidenceBatch();
    const bytes = Buffer.from(h.archives[0]), marker = part === 'gnu' ? 'unknown relocation DATA\n' : 'file:bin/tool\n';
    const at = bytes.indexOf(marker); assert.ok(at > 0); bytes[at] = 255;
    rejected(() => parse(h,0,{bytes}),'E_EVIDENCE_MANIFEST'); released(h.batch);
  });
  test(`${part}: fixture rejects extra arguments, role subsets, extra paths, raised caps and production inputs`, () => {
    const changes = [p => {p.mockOnly = false;},p => {p.inputs.pop();},p => {p.targets.pop();},p => {p.expectations.pop();},
      p => {p.inputs[0].root = inputs[part][0].root;},p => {p.inputs[0].archiveSha256 = inputs[part][0].archiveSha256;},
      p => {p.targets[0].path += '/new';},p => {p.targets[0].kind = 'AR';},p => {p.targets[0].artifactRole = 'other';},
      p => {p.targets[0].maxBytes++;},p => {p.limits.maxEntries = 32769;},p => {p.limits.totalMs = 300001;},p => {p.inputs.reverse();p.targets.reverse();}];
    for (const change of changes) {const f = profile(part); change(f.p); assert.throws(() => fixture(part,f.p,trusted));}
    const f = profile(part); rejected(() => fixture(part,f.p,trusted,{}),'E_EVIDENCE_INPUT');
    rejected(() => fixture(part === 'gnu' ? 'rust' : 'gnu',f.p,trusted),'E_EVIDENCE_INPUT');
  });
  test(`${part}: no restart, no second parser and no lifecycle extra arguments`, () => {
    const h = harness(part); h.batch.beginToolchainEvidenceBatch(); h.batch.beginToolchainEvidenceRole(inputs[part][0].role); h.batch.createTarInventory();
    rejected(() => h.batch.createTarInventory(),'E_EVIDENCE_STATE'); released(h.batch);
    const done = run(part); rejected(() => done.batch.beginToolchainEvidenceBatch(),'E_EVIDENCE_STATE');
    for (const method of ['beginToolchainEvidenceBatch','finishToolchainEvidenceBatch','abortToolchainEvidenceBatch','getToolchainEvidenceFailure','snapshotToolchainEvidenceBatch']) {
      const other = harness(part); rejected(() => other.batch[method]({}),'E_EVIDENCE_INPUT'); released(other.batch);
    }
  });
  test(`${part}: parser lower-only overrides and independent single-extension gate retain old limits`, () => {
    const h = harness(part); h.batch.beginToolchainEvidenceBatch(); h.batch.beginToolchainEvidenceRole(inputs[part][0].role);
    rejected(() => h.batch.createTarInventory({maxChunkBytes:65537}),'E_EVIDENCE_LIMIT'); released(h.batch);
    const other = harness(part); other.batch.beginToolchainEvidenceBatch(); other.batch.beginToolchainEvidenceRole(inputs[part][0].role);
    const parser = other.batch.createTarInventory(); rejected(() => parser.feed(header('extension',65537,'L')),'E_EVIDENCE_DATA');
    assert.equal(other.batch.getToolchainEvidenceFailure().underlyingCode,'E_EXTENSION_BYTES'); released(other.batch);
  });
  test(`${part}: unselected regular bodies use one streaming hash and no payload buffer`, () => {
    const text = 'unselected license body '.repeat(200), h = harness(part,{license:text});
    h.batch.beginToolchainEvidenceBatch(); h.batch.beginToolchainEvidenceRole(inputs[part][0].role); const parser = h.batch.createTarInventory();
    const at = h.archives[0].indexOf(text); parser.feed(h.archives[0].subarray(0,at + 1));
    const snapshot = h.batch.snapshotToolchainEvidenceBatch(); assert.equal(snapshot.activeBufferBytes,0); assert.equal(snapshot.activeBodyHashes,1);
    assert.equal(snapshot.selectedPayloads,0); h.batch.abortToolchainEvidenceBatch(); released(h.batch);
  });
  test(`${part}: untrusted inspector error text cannot escape fixed literal diagnostics`, () => {
    const secret = 'PRIVATE_PAYLOAD_AND_CURRENT_HEADER';
    const h = harness(part,{elf:() => {throw Object.assign(new Error(secret),{code:secret});}}); h.batch.beginToolchainEvidenceBatch();
    rejected(() => parse(h,0),'E_EVIDENCE_INSPECT'); const f = h.batch.getToolchainEvidenceFailure();
    assert.equal(f.underlyingCode,null); assert.doesNotMatch(JSON.stringify(f),new RegExp(secret)); released(h.batch);
  });
}

test('Rust cargo at partition-local zero uses OFFSET_EVENT_METADATA, not GNU legacy hashing', () => {
  const h = run('rust'), role = h.result.roles[0];
  assert.equal(role.role,'cargo'); assert.equal(role.metadataHashKind,'OFFSET_EVENT_METADATA');
  assert.equal(role.metadataSha256,role.offsetMetadataSha256); assert.notEqual(role.metadataSha256,role.legacyMetadataSha256);
  const bad = harness('rust',{mutate:p => {
    const f = profile('rust'), parser = tar.createTarInventory(), events = parser.feed(f.archives[0]); parser.finish();
    p.expectations[0].metadataSha256 = sha(events.map(e => JSON.stringify(legacy(e)) + '\n').join(''));
  }}); bad.batch.beginToolchainEvidenceBatch(); rejected(() => parse(bad,0),'E_EVIDENCE_METADATA_HASH'); released(bad.batch);
});
test('partition fixtures coexist without sharing roles, provisional data, counters or failure state', () => {
  const gnu = harness('gnu'), rust = harness('rust');
  gnu.batch.beginToolchainEvidenceBatch(); rust.batch.beginToolchainEvidenceBatch();
  gnu.batch.acceptToolchainEvidenceRole(parse(gnu,0).core);
  rust.batch.acceptToolchainEvidenceRole(parse(rust,0).core);
  rejected(() => gnu.batch.beginToolchainEvidenceRole('cargo'),'E_EVIDENCE_STATE'); released(gnu.batch);
  assert.equal(rust.batch.snapshotToolchainEvidenceBatch().acceptedRoles,1); assert.equal(rust.batch.getToolchainEvidenceFailure(),null);
  for (let i = 1; i < inputs.rust.length; i++) rust.batch.acceptToolchainEvidenceRole(parse(rust,i).core);
  assert.equal(rust.batch.finishToolchainEvidenceBatch().selectedPayloads,13); released(rust.batch);
});
test('Rust roles reject out-of-order and repeated role admission at partition-relative positions', () => {
  const h = harness('rust'); h.batch.beginToolchainEvidenceBatch();
  rejected(() => h.batch.beginToolchainEvidenceRole('rustc'),'E_EVIDENCE_STATE'); released(h.batch);
  const other = harness('rust'); other.batch.beginToolchainEvidenceBatch(); other.batch.acceptToolchainEvidenceRole(parse(other,0).core);
  rejected(() => other.batch.beginToolchainEvidenceRole('cargo'),'E_EVIDENCE_STATE'); released(other.batch);
});
test('GNU one-byte fragments retain the unchanged independent TAR data-event ceiling', () => {
  const h = harness('gnu'); h.batch.beginToolchainEvidenceBatch(); rejected(() => parse(h,0,{chunk:1}),'E_EVIDENCE_DATA');
  assert.equal(h.batch.getToolchainEvidenceFailure().underlyingCode,'E_DATA_EVENTS'); released(h.batch);
});
test('GNU legacy hashing cannot substitute the offset summary', () => {
  const h = harness('gnu',{mutate:p => {
    const f = profile('gnu'), parser = tar.createTarInventory(); parser.feed(f.archives[0]); p.expectations[0].metadataSha256 = parser.finish().metadataSha256;
  }}); h.batch.beginToolchainEvidenceBatch(); rejected(() => parse(h,0),'E_EVIDENCE_METADATA_HASH'); released(h.batch);
});
test('known Rust payload hashes verify before inspector dispatch', () => {
  const h = harness('rust',{mutate:p => {p.targets[0].expectedSha256 = '0'.repeat(64);}}); h.batch.beginToolchainEvidenceBatch();
  rejected(() => parse(h,0),'E_EVIDENCE_BODY_HASH'); assert.equal(h.log.elfCalls,0); released(h.batch);
});
for (const path of ['../escape','/absolute','a//b','a/./b','a/../b','C:/drive','back\\slash','bad\r']) test(`recognized Rust manifest rejects ${JSON.stringify(path)}`, () => {
  const h = harness('rust',{manifest:'file:' + path + '\n'}); h.batch.beginToolchainEvidenceBatch();
  rejected(() => parse(h,0),'E_EVIDENCE_MANIFEST'); released(h.batch);
});
for (const [option,code] of [['missingSupplemental','E_EVIDENCE_SUMMARY'],['aliasSupplemental','E_EVIDENCE_TARGET']]) test(`GNU supplemental ${option} stops without alias or fallback`, () => {
  const h = harness('gnu',{[option]:true}); h.batch.beginToolchainEvidenceBatch(); rejected(() => parse(h,0),code); released(h.batch);
});
test('GNU supplemental unknown span records a fresh literal regular body and nothing fabricated', () => {
  const h = run('gnu'), t = h.result.roles[0].selected.find(t => t.selectionRole === 'TARGET_LIBMVEC_PROVIDER');
  assert.ok(t.index > 0); assert.equal(t.bodyOffset % 512,0); assert.equal(t.size,512); assert.equal(t.bodySha256,sha(elfBody()));
  assert.equal(t.expectedSha256,null); assert.equal(t.hashObservation,'FRESH_BODY_HASH');
  assert.ok(h.result.roles[0].selected.every(t => t.expectedSha256 === null));
});
test('GNU supplemental 8 MiB gate stops before allocation without falling back to another path', () => {
  const supplemental = targets.gnu.at(-1); let reached = false;
  const h = harness('gnu',{events:events => Object.freeze(events.map(e => {
    if (e.path !== supplemental.path) return e; reached = true; return Object.freeze({...e,size:8388609});
  }))}); h.batch.beginToolchainEvidenceBatch(); rejected(() => parse(h,0),'E_EVIDENCE_LIMIT');
  assert.equal(reached,true); assert.equal(h.log.elfCalls,28); assert.equal(h.batch.getToolchainEvidenceFailure().path,supplemental.path); released(h.batch);
});
for (const key of ['maxArBytes','maxTextBytes']) test(`GNU lower ${key} retains the old independent format bound`, () => {
  const h = harness('gnu',{limits:{[key]:1}}); h.batch.beginToolchainEvidenceBatch(); rejected(() => parse(h,0),'E_EVIDENCE_LIMIT'); released(h.batch);
});
test('GNU 64 MiB and Rust 256 MiB callers retain independent ELF defensive-snapshot ceilings', () => {
  assert.ok(targets.gnu.slice(0,-1).filter(t => t.kind === 'ELF_EXEC_DSO').every(t => t.maxBytes === 67108864));
  assert.ok(targets.rust.filter(t => t.kind === 'ELF_EXEC_DSO').every(t => t.maxBytes === 268435456));
  assert.equal(elf.ELF_REQUIREMENTS_V5_LIMITS.maxInputBytes,268435456);
  assert.match(source,/target\.artifactRole === 'gnu-sdk' \? 67108864 : 268435456/u);
  assert.equal(limits.maxAggregatePayloadBytes,805306368); assert.equal(limits.maxArBytes,8388608); assert.equal(limits.maxTextBytes,1048576);
});
test('the private freeze cache marks only recursively visited frozen objects, never shallow-frozen external roots', () => {
  assert.match(source,/const ownedFrozen = new WeakSet\(\)/u);
  assert.match(source,/for \(const child of Object\.values\(value\)\) freeze\(child\);\n    Object\.freeze\(value\); ownedFrozen\.add\(value\);/u);
  assert.doesNotMatch(source,/Object\.isFrozen\(value\)\) return/u);
});
test('repo sources remain unchanged after every in-memory partition exercise', () => {
  for (const [name,[length,hash]] of Object.entries(pins)) {const bytes = read(name); assert.equal(bytes.length,length); assert.equal(sha(bytes),hash);}
  for (const bytes of [Buffer.from(source),Buffer.from(tarLinkedCollector),Buffer.from(elfLinkedCollector),Buffer.from(linkedSource)]) assert.match(sha(bytes),/^[0-9a-f]{64}$/u);
});
