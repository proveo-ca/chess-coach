// SPEC: _spec/tooling/native-ingress/step2.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as api from './toolchain-provider-plan.mjs';

const { createToolchainProviderPlanV1: create, TOOLCHAIN_PROVIDER_PLAN_V1_PINS: pins } = api;
const source = readFileSync(new URL('./toolchain-provider-plan.mjs', import.meta.url), 'utf8');
const keys = Object.keys(pins);
const saved = Object.fromEntries(keys.map(k => [k, readFileSync(new URL('../../' + pins[k].path, import.meta.url))]));
const docs = Object.fromEntries(keys.map(k => [k, JSON.parse(saved[k])]));
const sha = b => createHash('sha256').update(b).digest('hex');
const result = create(saved);
const originals = () => ({ ...saved });
const role = (d, k = 'gnuEvidence') => d[k].collection.roles[0];
const req = (d, k = 'cargoEvidence', n = 0) => role(d, k).selected[n].metadata.requirements;
function frozen(v) {
  if (!v || typeof v !== 'object') return;
  assert.ok(Object.isFrozen(v));
  assert.ok(Array.isArray(v) || Object.getPrototypeOf(v) === Object.prototype);
  for (const x of Object.values(v)) frozen(x);
}
function throws(fn, code) {
  assert.throws(fn, e => e.name === 'ToolchainProviderPlanError' && e.code === code && e.message === code && Object.isFrozen(e));
}
async function specialized(change, transform = s => s) {
  const d = structuredClone(docs);
  change(d);
  const input = Object.fromEntries(keys.map(k => [k, Buffer.from(JSON.stringify(d[k]) + '\n')]));
  return specializedBytes(input, transform);
}
async function specializedBytes(input, transform = s => s) {
  let text = source.replace(/const sizes = \[[^;]+;/u, 'const sizes = ' + JSON.stringify(keys.map(k => input[k].length)) + ';')
    .replace(/const hashes = \[[^;]+;/u, 'const hashes = ' + JSON.stringify(keys.map(k => sha(input[k]))) + ';');
  text = transform(text);
  const module = await import('data:text/javascript;base64,' + Buffer.from(text).toString('base64'));
  return { run: () => module.createToolchainProviderPlanV1(input), input };
}

test('public API exposes only the two frozen-contract exports', () => {
  assert.deepEqual(Object.keys(api).sort(), ['TOOLCHAIN_PROVIDER_PLAN_V1_PINS', 'createToolchainProviderPlanV1']);
  assert.equal(create.length, 1);
  assert.match(source, /^\/\/ SPEC: _spec\/tooling\/native-ingress\/step2\.puml/u);
  assert.deepEqual([...source.matchAll(/from '([^']+)'/gu)].map(m => m[1]), ['node:crypto', 'node:util']);
});
test('closed API rejects missing or extra arguments', () => {
  throws(() => create(), 'E_PROVIDER_INPUT');
  throws(() => create(saved, {}), 'E_PROVIDER_INPUT');
});
test('all eight original byte lengths and SHA256 identities match independent constants', () => {
  const lengths = [2829942, 44154, 83556, 60485, 33457, 33993, 49078, 55014];
  const hashes = ['01c24e73a65148b8a70c3c1d4034f86dcac8040859bc206b5cf40b784776cc22',
    '6364e2063f24be97096694f34d267d6c74e6ad538fd20218ca53d79d2627ea09',
    '2a2d410012e7b56be1cfaabaf8fb71823127b8b7826bc230d998f615184df3aa',
    '0a76a92d7ebc4bde40d0be317bc4557f684c3680b757d602f345b8df9ecf5ce7',
    '11fd1af89703029062560f8ff31dbc9d8fd2bbf08e2e8b9fe302f6a4a1600d35',
    '88528d4b1c184a5e5ad95cc2e3df0ea597863e9cf130d1659a78ded52e667dd3',
    '602209b5473b052df68acae9930a9bf348bf1431903b24b4ed56ad20e8d35894',
    '003b26c6cd849670f5ef28f775466f0e1e0e09fa154058c70cf130e9587269d2'];
  keys.forEach((k, i) => {
    assert.equal(saved[k].length, lengths[i]); assert.equal(sha(saved[k]), hashes[i]);
    assert.equal(pins[k].byteLength, lengths[i]); assert.equal(pins[k].sha256, hashes[i]);
  });
  assert.equal(lengths.reduce((a, b) => a + b), 3189679);
});
test('pins and output are recursively frozen plain records', () => { frozen(pins); frozen(result); });
test('receipts remain path and NOT_READ_OR_REVERIFIED marker only', () => {
  for (const binding of result.inputBindings) {
    assert.deepEqual(Object.keys(binding.declaredReceipt).sort(), ['marker', 'path']);
    assert.equal(binding.declaredReceipt.marker, 'NOT_READ_OR_REVERIFIED');
    assert.equal(binding.declaredReceipt.path, binding.path.replace('.result.json', '.receipt.json'));
    assert.equal(binding.pinMeaning, 'FULL_BYTE_IDENTITY_ONLY');
  }
});
test('real aggregate counts derive from all eight source adapters', () => {
  assert.deepEqual(result.counts, { selected: 69, selectedElf: 51, providers: 25, neededEdges: 159,
    primaryVersionReferences: 373, sourceMembers: 8745, helperNeededEdges: 16, helperVersionReferences: 24 });
  assert.equal(result.counts.neededEdges - result.counts.helperNeededEdges, 143);
  assert.equal(result.counts.primaryVersionReferences - result.counts.helperVersionReferences, 349);
});
test('all per-source selected counts match saved evidence', () => {
  assert.deepEqual(keys.map(k => result.selectedDeclarations.filter(s => s.sourceRole === k).length), [46, 1, 7, 1, 2, 2, 7, 3]);
});
test('declaration state never claims readiness', () => {
  assert.equal(result.profile, 'TOOLCHAIN_PROVIDER_PLAN_V1');
  assert.equal(result.state, 'PROPOSED_DECLARATION_SUPPLEMENT');
  assert.equal(result.status, result.state);
  for (const [k, v] of Object.entries(result).filter(([, v]) => typeof v === 'boolean')) {
    assert.equal(v, false, k);
    for (const rows of [result.owners, result.providers, result.neededEdges]) for (const row of rows) assert.equal(row[k], false, k);
  }
});
test('all edges remain unresolved even with unique metadata candidates', () => {
  assert.ok(result.neededEdges.some(e => e.candidateCount === 1));
  for (const e of result.neededEdges) { assert.equal(e.status, 'UNRESOLVED'); assert.equal(e.candidateCount, e.candidateProviderIds.length); }
});
test('every provider stays a candidate with explicit false Native and Docker authority', () => {
  assert.ok(result.providers.every(provider => provider.candidateOnly === true));
  for (const row of [result, ...result.providers]) {
    for (const key of ['nativeQualified', 'nativeAuthority', 'dockerProviderQualified']) assert.equal(row[key], false);
  }
});
test('every ELF owner retains every DT_NEEDED ordinal in order', () => {
  for (const owner of result.owners) {
    const data = owner.sourceRole === 'hostEvidence' ? docs.hostEvidence.candidates[owner.index].requirements
      : role(docs, owner.sourceRole).selected.find(s => s.index === owner.index).metadata.requirements;
    const edges = result.neededEdges.filter(e => e.ownerId === owner.ownerId);
    assert.deepEqual(edges.map(e => e.name), data.dynamic.needed);
    assert.deepEqual(edges.map(e => e.neededOrdinal), data.dynamic.needed.map((_, i) => i));
  }
});
test('exact SONAME and domain matching retains every identity', () => {
  for (const edge of result.neededEdges) assert.deepEqual(edge.candidateProviderIds,
    result.providers.filter(p => p.domain === edge.domain && p.soname === edge.name).map(p => p.providerId));
  assert.equal(new Set(result.providers.map(p => p.providerId)).size, result.providers.length);
});
test('host schema assigns HOST without claiming authentication from sourceKind', () => {
  const hosts = result.owners.filter(o => o.sourceRole === 'hostEvidence');
  assert.equal(hosts.length, 7);
  hosts.forEach((h, i) => {
    assert.equal(h.domain, 'HOST'); assert.equal(h.sourceKind, docs.hostEvidence.candidates[i].sourceKind);
    assert.equal(h.sourceAuthenticated, false); assert.equal(h.publisherAuthenticated, false);
    assert.equal(h.path, docs.hostEvidence.candidates[i].path);
  });
});
test('rust std remains TARGET and other Rust owners remain HOST', () => {
  assert.equal(result.selectedDeclarations.find(o => o.sourceRole === 'rustStdEvidence').domain, 'TARGET');
  for (const o of result.owners.filter(o => ['cargoEvidence', 'rustcEvidence', 'rustfmtEvidence', 'clippyEvidence', 'helperEvidence'].includes(o.sourceRole))) assert.equal(o.domain, 'HOST');
});
test('target providers never enter HOST edges', () => {
  const target = new Set(result.providers.filter(p => p.domain === 'TARGET').map(p => p.providerId));
  assert.ok(target.size > 0);
  for (const edge of result.neededEdges.filter(e => e.domain === 'HOST')) assert.ok(edge.candidateProviderIds.every(p => !target.has(p)));
});
test('helper namespace joins exactly and helper owners remain distinct', () => {
  assert.deepEqual(role(docs, 'rustcEvidence').members, role(docs, 'helperEvidence').members);
  assert.deepEqual(result.owners.filter(o => o.sourceRole === 'helperEvidence').map(o => o.index), [28, 63, 70]);
  const old = new Set(result.owners.filter(o => o.sourceRole === 'rustcEvidence').map(o => o.path));
  assert.ok(result.owners.filter(o => o.sourceRole === 'helperEvidence').every(o => !old.has(o.path)));
});
test('version references preserve all source record ordinals independently from edges', () => {
  let count = 0;
  for (const owner of result.owners) {
    const r = owner.sourceRole === 'hostEvidence' ? docs.hostEvidence.candidates[owner.index].requirements
      : role(docs, owner.sourceRole).selected.find(s => s.index === owner.index).metadata.requirements;
    r.requirements.versionNeeds.forEach((need, n) => need.aux.forEach((aux, a) => {
      const ref = result.versionReferences.find(v => v.ownerId === owner.ownerId && v.versionNeedOrdinal === n && v.auxOrdinal === a);
      assert.ok(ref); assert.equal(ref.name, aux.name); assert.equal(ref.file, need.file); assert.equal(ref.expectedElfHash, aux.hash); count++;
    }));
  }
  assert.equal(count, 373);
});
test('interpreter and RPATH/RUNPATH stay raw without lookup or expansion', () => {
  assert.ok(result.owners.some(o => o.runpath?.includes('$ORIGIN')));
  for (const owner of result.owners) {
    const r = owner.sourceRole === 'hostEvidence' ? docs.hostEvidence.candidates[owner.index].requirements
      : role(docs, owner.sourceRole).selected.find(s => s.index === owner.index).metadata.requirements;
    assert.equal(owner.interpreter, r.interpreter); assert.equal(owner.rpath, r.dynamic.rpath); assert.equal(owner.runpath, r.dynamic.runpath);
  }
  for (const a of result.interpreterAnnotations) { assert.deepEqual(a.candidateProviderIds, []); assert.equal(a.searchPerformed, false); }
});
test('four linker texts retain full observation without treating LLVM script as ELF', () => {
  assert.equal(result.linkerDeclarations.length, 4);
  for (const l of result.linkerDeclarations) {
    assert.deepEqual(l.rawDeclaration, role(docs, l.sourceRole).selected.find(s => s.index === l.index).metadata);
    assert.equal(l.interpreted, false); assert.equal(l.status, 'UNRESOLVED');
  }
  const llvm = result.linkerDeclarations.find(l => l.sourceRole === 'rustcEvidence');
  assert.equal(llvm.size, 42);
  assert.ok(!result.owners.some(o => o.path === llvm.path));
});
test('LLD byte equality annotations do not collapse names or qualify argv personality', () => {
  assert.equal(result.byteEqualityAnnotations.length, 3);
  assert.deepEqual(result.byteEqualityAnnotations.map(a => a.path.split('/').at(-1)).sort(), ['ld64.lld', 'lld-link', 'wasm-ld']);
  for (const a of result.byteEqualityAnnotations) { assert.equal(a.byteEqualityOnly, true); assert.equal(a.argvPersonalityQualified, false); }
});
test('source/package/license obligations remain separate from dynamic metadata', () => {
  assert.deepEqual(result.unresolvedObligations.map(o => o.code), ['SOURCE_PACKAGE_PROVENANCE', 'LICENSE_INPUTS', 'SEARCH_ORDER', 'SYMBOL_BINDINGS', 'LOAD_PRIVATE_ABI', 'ROLE_BEHAVIOR', 'IMAGE_CONTAINMENT']);
  assert.ok(result.unresolvedObligations.every(o => o.status === 'UNRESOLVED'));
});
test('deterministic output remains under escaped ASCII JSON plus LF bound', () => {
  assert.deepEqual(create(saved), result);
  const json = JSON.stringify(result).replace(/[\u007f-\uffff]/gu, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')) + '\n';
  assert.ok(Buffer.byteLength(json) <= 4194304);
});
test('input proxy rejects without running traps', () => {
  let calls = 0;
  throws(() => create(new Proxy(saved, { ownKeys() { calls++; throw Error(); }, getPrototypeOf() { calls++; throw Error(); } })), 'E_PROVIDER_INPUT');
  assert.equal(calls, 0);
});
test('accessor evidence rejects without invoking getter', () => {
  let calls = 0; const input = originals();
  Object.defineProperty(input, 'gnuEvidence', { enumerable: true, get() { calls++; return saved.gnuEvidence; } });
  throws(() => create(input), 'E_PROVIDER_INPUT'); assert.equal(calls, 0);
});
for (const [label, change] of [
  ['missing key', i => { delete i.helperEvidence; }],
  ['extra key', i => { i.extra = 1; }],
  ['symbol key', i => { i[Symbol('x')] = 1; }],
  ['inherited key', i => { delete i.gnuEvidence; Object.setPrototypeOf(i, { gnuEvidence: saved.gnuEvidence }); }],
  ['Uint8Array', i => { i.gnuEvidence = new Uint8Array(1); }],
  ['Buffer proxy', i => { i.gnuEvidence = new Proxy(saved.gnuEvidence, {}); }],
  ['Buffer subclass', i => { const b = Buffer.from('x'); Object.setPrototypeOf(b, class B extends Buffer {}.prototype); i.gnuEvidence = b; }],
  ['Buffer own getter override', i => { const b = Buffer.from('x'); Object.defineProperty(b, 'length', { get() { throw Error('must not run'); } }); i.gnuEvidence = b; }],
  ['Buffer custom method', i => { const b = Buffer.from('x'); b.toString = () => { throw Error('must not run'); }; i.gnuEvidence = b; }],
  ['shared backing', i => { i.gnuEvidence = Buffer.from(new SharedArrayBuffer(1)); }]
]) test(`rejects ${label}`, () => { const input = originals(); change(input); throws(() => create(input), 'E_PROVIDER_INPUT'); });
test('per-input allocation bound precedes byte copying', () => {
  const input = originals(); input.gnuEvidence = Buffer.alloc(4194305); throws(() => create(input), 'E_PROVIDER_INPUT_BYTES');
});
test('aggregate allocation bound precedes copies', () => {
  const input = Object.fromEntries(keys.map(k => [k, Buffer.alloc(2097153)])); throws(() => create(input), 'E_PROVIDER_INPUT_BYTES');
});
test('all eight pins precede every JSON.parse', () => {
  const input = originals(); input.gnuEvidence = Buffer.from('{'); input.helperEvidence = Buffer.from('{}');
  throws(() => create(input), 'E_PROVIDER_PIN');
});
for (const k of keys) test(`rejects altered byte identity for ${k}`, () => {
  const input = originals(); input[k] = Buffer.from(saved[k]); input[k][0] ^= 1;
  throws(() => create(input), 'E_PROVIDER_PIN');
});
test('late pin failure calls no parser even with specialized early invalid JSON', async () => {
  const input = originals(); input.gnuEvidence = Buffer.from('{');
  const fixture = await specializedBytes(input);
  fixture.input.helperEvidence = Buffer.from('{}');
  throws(fixture.run, 'E_PROVIDER_PIN');
});
test('specialized malformed JSON reports a fixed error', async () => {
  const input = originals(); input.gnuEvidence = Buffer.from('{');
  const f = await specializedBytes(input); throws(f.run, 'E_PROVIDER_JSON');
});
test('invalid UTF-8 fails before a replacement character can enter parsed metadata', async () => {
  const input = originals();
  input.cargoEvidence = Buffer.concat([Buffer.from('{"extra":"'), Buffer.from([0xff]), Buffer.from('"}')]);
  const fixture = await specializedBytes(input);
  throws(fixture.run, 'E_PROVIDER_JSON');
});
test('preparse lexical nesting limit rejects 65 levels', async () => {
  const input = originals(); input.gnuEvidence = Buffer.from('['.repeat(65) + '0' + ']'.repeat(65));
  const f = await specializedBytes(input); throws(f.run, 'E_PROVIDER_STRUCTURE');
});
test('preparse scanner ignores quoted braces and escaped quotes', async () => {
  const f = await specialized(d => { d.cargoEvidence.extra = '{['.repeat(100) + '\\"}'; });
  assert.deepEqual(f.run().counts, result.counts);
});
for (const k of keys) test(`specialized invalid producer schema rejects ${k}`, async () => {
  const f = await specialized(d => { d[k].status = 'WRONG'; }); throws(f.run, k === 'hostEvidence' ? 'E_PROVIDER_HOST' : 'E_PROVIDER_SOURCE');
});
test('root readiness and authentication cannot be promoted', async () => {
  const f = await specialized(d => { d.hostEvidence.sourceAuthenticated = true; }); throws(f.run, 'E_PROVIDER_SOURCE');
});
test('mock-only evidence is not admitted', async () => {
  const f = await specialized(d => { d.helperEvidence.mockOnly = true; }); throws(f.run, 'E_PROVIDER_SOURCE');
});
test('wrong GNU expectedRoot cannot be inferred from arbitrary container', async () => {
  const f = await specialized(d => { role(d).expectedRoot = 'other'; }); throws(f.run, 'E_PROVIDER_ROLE');
});
test('source namespace size limit rejects before member extraction', async () => {
  const f = await specialized(d => { role(d).members = Array(32769).fill(null); }); throws(f.run, 'E_PROVIDER_STRUCTURE');
});
test('GNU sysroot TARGET cannot be promoted to HOST', async () => {
  const f = await specialized(d => { role(d).selected.find(s => s.path.includes('/sysroot/') && s.kind === 'ELF_EXEC_DSO').domain = 'HOST'; });
  throws(f.run, 'E_PROVIDER_DOMAIN');
});
test('Rust std TARGET cannot be promoted to HOST', async () => {
  const f = await specialized(d => { role(d, 'rustStdEvidence').selected[0].domain = 'HOST'; }); throws(f.run, 'E_PROVIDER_DOMAIN');
});
test('helper member-body mismatch rejects the complete namespace join', async () => {
  const f = await specialized(d => { role(d, 'helperEvidence').members[1].mode ^= 1; }); throws(f.run, 'E_PROVIDER_HELPER_NAMESPACE');
});
test('helper selected-body mismatch rejects before metadata', async () => {
  const f = await specialized(d => { role(d, 'helperEvidence').selected[0].bodySha256 = '0'.repeat(64); }); throws(f.run, 'E_PROVIDER_SELECTED');
});
test('requirement input SHA must equal selected member body identity', async () => {
  const f = await specialized(d => { req(d).inputSha256 = '0'.repeat(64); }); throws(f.run, 'E_PROVIDER_METADATA');
});
test('requirement byte length must equal selected member size', async () => {
  const f = await specialized(d => { d.hostEvidence.candidates[0].requirements.byteLength++; }); throws(f.run, 'E_PROVIDER_METADATA');
});
test('host role cannot be inferred from path', async () => {
  const f = await specialized(d => { d.hostEvidence.candidates[0].role = 'TARGET_LOADER'; }); throws(f.run, 'E_PROVIDER_HOST');
});
test('host sourceKind cannot transfer or invent authentication', async () => {
  const f = await specialized(d => { d.hostEvidence.candidates[2].sourceKind = 'PINNED_ORDINARY_STAGE'; }); throws(f.run, 'E_PROVIDER_HOST');
});
test('path traversal rejects without consulting host files', async () => {
  const f = await specialized(d => { d.hostEvidence.candidates[0].path = '/a/../libc.so.6'; }); throws(f.run, 'E_PROVIDER_SCHEMA');
});
test('duplicate SONAME candidates retain every distinct provider identity', async () => {
  const f = await specialized(d => { d.hostEvidence.candidates[2].requirements.dynamic.soname = 'libc.so.6'; });
  const r = f.run(), edge = r.neededEdges.find(e => e.domain === 'HOST' && e.name === 'libc.so.6');
  assert.equal(edge.candidateCount, 2); assert.equal(new Set(edge.candidateProviderIds).size, 2);
  assert.equal(edge.ambiguity, 'MULTIPLE_METADATA_CANDIDATES'); assert.equal(edge.status, 'UNRESOLVED');
});
test('missing exact SONAME does not fall back to basename or TARGET', async () => {
  const f = await specialized(d => { d.hostEvidence.candidates[1].requirements.dynamic.soname = 'not-libc.so.6'; });
  const r = f.run();
  for (const e of r.neededEdges.filter(e => e.domain === 'HOST' && e.name === 'libc.so.6')) { assert.deepEqual(e.candidateProviderIds, []); assert.equal(e.status, 'UNRESOLVED'); }
});
test('byte-identical separate host candidates remain separate providers', async () => {
  const f = await specialized(d => {
    const a = d.hostEvidence.candidates[1], b = d.hostEvidence.candidates[2];
    b.requirements = structuredClone(a.requirements); b.size = a.size; b.sha256 = a.sha256;
  });
  const r = f.run(), rows = r.providers.filter(p => p.domain === 'HOST' && p.soname === 'libc.so.6');
  assert.equal(rows.length, 2); assert.notEqual(rows[0].providerId, rows[1].providerId); assert.equal(rows[0].bodySha256, rows[1].bodySha256);
});
test('duplicate DT_NEEDED ordinals do not duplicate independent version records', async () => {
  const f = await specialized(d => { req(d).dynamic.needed.push(req(d).dynamic.needed[0]); });
  const r = f.run(); assert.equal(r.counts.neededEdges, 160); assert.equal(r.counts.primaryVersionReferences, 373);
  const owner = r.owners.find(o => o.sourceRole === 'cargoEvidence');
  const refs = r.versionReferences.filter(v => v.ownerId === owner.ownerId && v.file === req(docs).dynamic.needed[0]);
  assert.ok(refs.length); assert.ok(refs.every(v => v.neededEdgeIds.length === 2));
});
test('orphan version need remains an independent unresolved reference', async () => {
  const f = await specialized(d => { req(d).requirements.versionNeeds[0].file = 'undeclared-needed.so'; });
  const r = f.run(), v = r.versionReferences.find(v => v.file === 'undeclared-needed.so');
  assert.ok(v); assert.deepEqual(v.neededEdgeIds, []); assert.equal(v.status, 'UNRESOLVED');
});
test('version need name hash mismatch rejects with the fixed version error', async () => {
  const f = await specialized(d => { req(d).requirements.versionNeeds[0].aux[0].hash++; }); throws(f.run, 'E_PROVIDER_VERSION_HASH');
});
test('version definition primary name hash mismatch rejects', async () => {
  const f = await specialized(d => { d.hostEvidence.candidates[1].requirements.requirements.versionDefinitions[0].hash++; }); throws(f.run, 'E_PROVIDER_VERSION_HASH');
});
test('version definition aliases never satisfy a different primary name', async () => {
  let name;
  const f = await specialized(d => {
    const needs = req(d).requirements.versionNeeds.find(n => n.file === 'libc.so.6'); name = needs.aux[0].name;
    d.hostEvidence.candidates[1].requirements.requirements.versionDefinitions = [{ names: ['A', name], hash: 65 }];
  });
  const r = f.run(), v = r.versionReferences.find(v => v.name === name && v.file === 'libc.so.6' && v.candidates.length);
  assert.ok(v); assert.ok(v.candidates.every(c => !c.primaryNameMatches && !c.primaryDeclarationMatches));
});
test('repeated primary declarations preserve all definition ordinals', async () => {
  const f = await specialized(d => {
    const defs = d.hostEvidence.candidates[1].requirements.requirements.versionDefinitions;
    defs.push(structuredClone(defs.find(v => v.names[0] === 'GLIBC_2.2.5')));
  });
  const v = f.run().versionReferences.find(v => v.file === 'libc.so.6' && v.name === 'GLIBC_2.2.5' && v.domain === 'HOST');
  assert.equal(v.candidates[0].declarations.length, 2); assert.equal(v.status, 'UNRESOLVED');
});
test('interpreter matching requires exact HOST_LOADER path', async () => {
  const f = await specialized(d => { req(d).interpreter = d.hostEvidence.candidates[0].path; });
  const r = f.run(), owner = r.owners.find(o => o.sourceRole === 'cargoEvidence');
  const a = r.interpreterAnnotations.find(a => a.ownerId === owner.ownerId);
  assert.equal(a.candidateProviderIds.length, 1); assert.equal(a.status, 'UNRESOLVED'); assert.equal(a.searchPerformed, false);
});
test('DT_NEEDED aggregate limit rejects during extraction', async () => {
  const f = await specialized(d => { req(d).dynamic.needed = Array(512).fill('x'); }); throws(f.run, 'E_PROVIDER_LIMIT');
});
test('version reference aggregate limit rejects during extraction', async () => {
  const f = await specialized(d => { const a = req(d).requirements.versionNeeds[0].aux[0]; req(d).requirements.versionNeeds[0].aux = Array(1024).fill(a); });
  throws(f.run, 'E_PROVIDER_LIMIT');
});
test('bounded version string rejects non-ASCII or oversized names', async () => {
  const f = await specialized(d => { req(d).requirements.versionNeeds[0].aux[0].name = 'é'; }); throws(f.run, 'E_PROVIDER_SCHEMA');
});
test('candidate cap is enforced before appending the overflowing identity', async () => {
  const f = await specialized(d => { d.hostEvidence.candidates[2].requirements.dynamic.soname = 'libc.so.6'; },
    s => s.replace("check(rows.length < 128, 'E_PROVIDER_CANDIDATES')", "check(rows.length < 1, 'E_PROVIDER_CANDIDATES')"));
  throws(f.run, 'E_PROVIDER_CANDIDATES');
});
test('construction budget rejects repeated identity expansion before final serialization', async () => {
  const f = await specialized(d => {
    d.hostEvidence.candidates[1].rootMetadata.extraDeclaration = '\\'.repeat(700000);
  }, s => s.replace("check(measure(result) + 1 <= 4194304, 'E_PROVIDER_OUTPUT_BYTES');", "fail('E_TEST_FINAL_SERIALIZATION_REACHED');"));
  throws(f.run, 'E_PROVIDER_OUTPUT_BYTES');
});
test('structure aggregate node limit rejects before source extraction', async () => {
  const f = await specialized(d => { d.cargoEvidence.extra = Array.from({ length: 32 }, () => Array(32768).fill(0)); });
  throws(f.run, 'E_PROVIDER_STRUCTURE');
});
