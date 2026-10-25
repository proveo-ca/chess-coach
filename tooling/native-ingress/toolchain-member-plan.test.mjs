// SPEC: _spec/tooling/native-ingress/step2.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { deriveToolchainMemberPlan, deriveToolchainMemberPlanForTest, encodeToolchainMemberPlan, TOOLCHAIN_MEMBER_PLAN_LIMITS } from './toolchain-member-plan.mjs';

const sha = text => createHash('sha256').update(text).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
const roles = ['gnu-sdk', 'cargo', 'rustc', 'rust-std', 'rustfmt-preview', 'clippy-preview'];
const roots = ['x86-64--glibc--stable-2026.08-1', ...['cargo', 'rustc', 'rust-std', 'rustfmt', 'clippy'].map(n => `${n}-1.95.0-x86_64-unknown-linux-gnu`)];
const components = [null, 'cargo', 'rustc', 'rust-std-x86_64-unknown-linux-gnu', 'rustfmt-preview', 'clippy-preview'];
const sysroot = 'x86_64-buildroot-linux-gnu/sysroot';
const pins = [
  ['toolchain-evidence-set-v1.receipt', 5444, '5a7b039d891d38875fe1cdd6494a47e355222200a67d26dc45290a08920db7ce'],
  ['gnu-evidence-collection-v1.result', 2829942, '01c24e73a65148b8a70c3c1d4034f86dcac8040859bc206b5cf40b784776cc22'],
  ['gnu-evidence-collection-v1.receipt', 3428, 'bb7f0ad07f8022bcba026b142bb40fe27651f534c35e119a4e1d9a3d2862a6e8'],
  ['host-runtime-providers.result', 49078, '602209b5473b052df68acae9930a9bf348bf1431903b24b4ed56ad20e8d35894'],
  ['host-runtime-providers.receipt', 6347, '2ca208cc0ccd413bfebe850e17116639d5bebceb54c6a6f949720860b47c1084'],
  ['rust-archive-cargo-v1.result', 44154, '6364e2063f24be97096694f34d267d6c74e6ad538fd20218ca53d79d2627ea09'],
  ['rust-archive-cargo-v1.receipt', 11248, 'c1c1d13f46c7c121f922aecb664919124d09047b61367dc10def3de059e17b37'],
  ['rust-archive-rustc-v1.result', 83556, '2a2d410012e7b56be1cfaabaf8fb71823127b8b7826bc230d998f615184df3aa'],
  ['rust-archive-rustc-v1.receipt', 11253, '06f489950a405483b494384f3b4685fe24460e6db67ae4fe2195576daa8477bb'],
  ['rust-archive-rust-std-v1.result', 60485, '0a76a92d7ebc4bde40d0be317bc4557f684c3680b757d602f345b8df9ecf5ce7'],
  ['rust-archive-rust-std-v1.receipt', 11265, '8897b37d6d95a26ea39fb6905c0a81e770eba2a9eb8ccde530c98a193a592d9e'],
  ['rust-archive-rustfmt-preview-v1.result', 33457, '11fd1af89703029062560f8ff31dbc9d8fd2bbf08e2e8b9fe302f6a4a1600d35'],
  ['rust-archive-rustfmt-preview-v1.receipt', 11276, 'ddccbe0c9e8a4f948549b4757e25111c0c6aadcdcff38805a49619c681be9217'],
  ['rust-archive-clippy-preview-v1.result', 33993, '88528d4b1c184a5e5ad95cc2e3df0ea597863e9cf130d1659a78ded52e667dd3'],
  ['rust-archive-clippy-preview-v1.receipt', 11273, 'bac5a7b03b801c0ff5b7c3effbd7dedde6663be40f34ec64a3e9f5e058b114e6'],
];
const accepted = new Map(pins.map(([name, bytes, digest]) => {
  const raw = readFileSync(new URL('../../_spec/tooling/native-ingress/' + name + '.json', import.meta.url));
  assert.equal(raw.length, bytes, name); assert.equal(sha(raw), digest, name);
  return [name, JSON.parse(raw)];
}));
const frozen = value => { if (value && typeof value === 'object') { for (const v of Object.values(value)) frozen(v); Object.freeze(value); } return value; };
const actual = frozen({ receipt: accepted.get('toolchain-evidence-set-v1.receipt'),
  gnu: { result: accepted.get('gnu-evidence-collection-v1.result'), acceptance: accepted.get('gnu-evidence-collection-v1.receipt') },
  rust: roles.slice(1).map(role => ({ role, result: accepted.get(`rust-archive-${role}-v1.result`), acceptance: accepted.get(`rust-archive-${role}-v1.receipt`) })),
  host: { result: accepted.get('host-runtime-providers.result'), receipt: accepted.get('host-runtime-providers.receipt') } });
const actualBefore = JSON.stringify(actual);
const report = deriveToolchainMemberPlan(actual);
const roleRecord = (e, i = 0) => (i ? e.rust[i - 1] : e.gnu).result.collection.roles[0];
const rowAt = (r, role, suffix) => r.members.find(m => m.artifactRole === role && m.path === roots[roles.indexOf(role)] + '/' + suffix);
const gnuRow = (r, suffix) => rowAt(r, 'gnu-sdk', suffix);
function fixture(specs = {}) {
  const sources = roles.map((role, ordinal) => {
    const root = roots[ordinal], component = components[ordinal], files = new Map(), manifests = [];
    const put = (path, type = 'directory', body = '', extra = {}) => {
      if (!files.has(path)) files.set(path, { path, type, body, ...extra });
    };
    const add = (path, type = 'file', body = '', extra = {}) => {
      const full = root + '/' + path, parts = full.split('/');
      for (let j = 1; j < parts.length; j++) put(parts.slice(0, j).join('/'));
      put(full, type, body, extra);
    };
    put(root);
    const addManifest = (path, kind, text, declarations = []) => {
      add(path, 'file', text); manifests.push({ path: root + '/' + path, kind, bodySha256: sha(text), text, declarations, interpreted: false });
    };
    if (!ordinal) {
      addManifest('share/buildroot/sdk-location', 'GNU_RAW_TEXT', '/fixture/sdk\n');
      addManifest('share/buildroot/sdk-relocs', 'GNU_RAW_TEXT', specs.relocs ?? '');
    } else {
      const decls = specs[role]?.declarations ?? [];
      const text = specs[role]?.manifestText ?? decls.map(d => d.kind + ':' + d.path + '\n').join('');
      addManifest(component + '/manifest.in', 'RUST_MANIFEST', text, decls);
      addManifest('components', 'RUST_COMPONENTS', component + '\n');
      addManifest('rust-installer-version', 'RUST_INSTALLER_VERSION', '3\n');
    }
    for (const s of specs[role]?.members ?? []) add(s.path, s.type ?? 'file', s.body ?? '', s);
    let offset = 512;
    const members = [...files.values()].map((f, i) => {
      const m = { index: i + 1, path: f.path.startsWith(root) ? f.path : root + '/' + f.path,
        type: f.type, size: f.type === 'file' ? f.body.length : 0, bodyOffset: offset, mode: f.mode ?? 493, uid: 0, gid: 0, mtime: '0',
        bodySha256: f.type === 'file' ? sha(f.body) : null, ...(f.type !== 'file' ? { linkFollowed: false } : {}) };
      if (['symlink', 'hardlink'].includes(f.type)) {
        m.linkpath = f.linkpath; m.linkKind = f.linkpath.startsWith('/') ? 'absolute' : f.linkpath.split('/').includes('..') ? 'parent-components' : 'relative';
      }
      offset = Math.ceil((offset + m.size) / 512) * 512 + 512;
      return m;
    });
    const selected = (specs[role]?.selected ?? []).map(s => {
      const m = members.find(m => m.path === root + '/' + s.path); assert.ok(m, s.path);
      return { artifactRole: role, ...m, kind: s.kind ?? 'ELF_EXEC_DSO', domain: s.domain ?? 'HOST',
        expectedSha256: null, optionalForMinimalC: s.optionalForMinimalC ?? false, qualified: false, abiVerified: false, roleSatisfied: false,
        metadata: s.kind === 'LINKER_TEXT' ? { observation: { state: 'GNU_LD_REFERENCE_DATA', references: (s.references ?? []).map(([literal, directive = 'INPUT']) => ({ literal, directive, kind: 'LINKER_REFERENCE_DATA_NOT_HOST_PERMISSION', requiresApprovedSysrootMapping: true, followed: false })), evaluated: false, hostResolutionAttempted: false } } : {} };
    });
    const regularFiles = members.filter(m => m.type === 'file').length;
    return { role, result: { collection: { artifactCount: 1, entries: members.length, regularFiles, expandedBytes: offset,
      selectedPayloads: selected.length, completeNamespace: true, roles: [{ role, expectedRoot: root, completeNamespace: true, entries: members.length,
        regularFiles, expandedBytes: offset, members, manifests, selected }] } }, acceptance: {} };
  });
  return { receipt: {}, gnu: { result: sources[0].result, acceptance: {} }, rust: sources.slice(1), host: { result: { candidates: [] }, receipt: {} } };
}
const plan = specs => deriveToolchainMemberPlanForTest(fixture(specs));
const linkerFixture = (members, token, extra = {}) => fixture({ 'gnu-sdk': { members: [{ path: sysroot + '/usr/lib/script.so' }, ...members],
  selected: [{ path: sysroot + '/usr/lib/script.so', kind: 'LINKER_TEXT', domain: 'TARGET', references: [[token]] }] }, ...extra });
const reference = e => deriveToolchainMemberPlanForTest(e).linkerInputReferences[0];
function updateText(e, i, suffix, text, declarations) {
  const r = roleRecord(e, i), path = roots[i] + '/' + suffix, m = r.members.find(m => m.path === path), t = r.manifests.find(t => t.path === path);
  assert.ok(m); assert.ok(t); m.size = text.length; m.bodySha256 = sha(text); t.text = text; t.bodySha256 = sha(text);
  if (declarations) t.declarations = declarations;
}

test('production emits exactly all six namespaces and all selected observations', () => {
  assert.equal(report.profile, 'TOOLCHAIN_MEMBER_DISPOSITION_DATA'); assert.equal(report.scope, 'PROPOSED_DISPOSITIONS_NOT_COPY_OR_IMAGE_AUTHORITY');
  assert.deepEqual(report.roleOrder, roles); assert.equal(report.artifactCount, 6); assert.equal(report.members.length, 8675);
  assert.deepEqual([report.counts.entries, report.counts.regularFiles, report.counts.expandedBytes, report.counts.selectedPayloads], [8675, 7106, 1148080640, 59]);
  assert.equal(report.members.filter(m => m.sourceKind).length, 59);
});
test('production preserves exact role/source-index order and hashes without silent drops', () => {
  const inputs = [actual.gnu, ...actual.rust].flatMap(s => s.result.collection.roles[0].members.map(m => [s.result.collection.roles[0].role, m.index, m.path, m.type, m.size, m.bodySha256]));
  assert.deepEqual(report.members.map(m => [m.artifactRole, m.index, m.path, m.type, m.size, m.bodySha256]), inputs);
  assert.equal(Object.values(report.counts.byDisposition).reduce((a, b) => a + b, 0), 8675);
  for (const count of Object.values(report.counts.byRole)) assert.equal(Object.values(count.byDisposition).reduce((a, b) => a + b, 0), count.entries);
});
test('all authorization, execution, ABI, NoPy, image and source claims remain false', () => {
  for (const key of ['copyAuthorized', 'extractionAuthorized', 'installationAuthorized', 'imagePrepared', 'imageEquivalent', 'runtimeProvidersQualified',
    'abiVerified', 'symbolBindingsVerified', 'loaderClosureVerified', 'pythonFreeSubsetVerified', 'noPythonRuntimeVerified', 'nativeQualified',
    'rustReady', 'trainingReady', 'sourceAuthenticated', 'compilerExecuted', 'futureBuildGraphQualified', 'installerInterpretationVerified',
    'historicalMissingRawResultsRestored', 'rawHistoricalResultsRestored', 'licenseComplianceVerified', 'hostTargetPromotion', 'callerInputsAuthenticated']) assert.equal(report[key], false, key);
  assert.equal(report.dependencyDeclarationComparison.qualificationStatus, 'UNRESOLVED');
  assert.equal(report.sourceRootAuthority.runtimeAuthority, false); assert.equal(report.sourceRootAuthority.authenticated, false);
});
test('actual frozen evidence remains unchanged and returned graph is deeply immutable', () => {
  assert.equal(JSON.stringify(actual), actualBefore);
  const check = v => { if (v && typeof v === 'object') { assert.ok(Object.isFrozen(v)); for (const child of Object.values(v)) check(child); } };
  check(report); assert.throws(() => { report.members[0].domain = 'HOST'; }, TypeError);
});
test('mutable caller input stays mutable and report does not alias caller objects', () => {
  const e = fixture(), before = JSON.stringify(e), r = deriveToolchainMemberPlanForTest(e);
  assert.equal(JSON.stringify(e), before); assert.equal(Object.isFrozen(e), false); assert.equal(Object.isFrozen(roleRecord(e).members[0]), false);
  e.host.result.candidates.push({ note: 'later' }); assert.equal(r.hostCandidates.length, 0);
});
test('production Rust declaration ledger joins all 157 file declarations to exact regular members', () => {
  assert.equal(report.rustDeclarations.length, 157);
  for (const d of report.rustDeclarations) {
    assert.equal(d.kind, 'file'); assert.equal(d.status, 'DECLARED_MEMBER_MATCH_NOT_INSTALLER_PROOF'); assert.ok(d.matchedSourceIndex);
    const m = report.members.find(m => m.artifactRole === d.artifactRole && m.index === d.matchedSourceIndex);
    assert.equal(m.path, d.sourcePath); assert.equal(m.bodySha256, d.bodySha256); assert.equal(m.type, 'file');
  }
  assert.equal(report.unknownManifestLines.length, 0); assert.equal(report.installerInterpretationVerified, false);
});
test('production GNU relocation ledger preserves all 190 refs, 152 recorded files and 38 absences', () => {
  assert.deepEqual([report.gnuRelocation.totalReferences, report.gnuRelocation.regularFiles, report.gnuRelocation.unresolvedWholeSdkContext], [190, 152, 38]);
  assert.equal(report.gnuRelocation.manifestBodySha256, '60f1b6054d8f01670a9f5ac3ac0181f7148e37be91025c2c4f111df30047305e');
  assert.equal(report.gnuRelocation.locationBodySha256, 'e4df82547e211e82635d37dc97cd4bce2f5d941aebb24717a32b242811ea052f');
  assert.ok(report.gnuRelocation.references.every(r => !r.relocationSuccessful && !r.assumedMinimalCBlocker));
});
test('all 1434 regular GNU headers and the one inert header alias remain data only', () => {
  assert.equal(report.headerAliasClosure.regularHeaderCount, 1434); assert.equal(report.headerAliasClosure.aliasReferenceCount, 1);
  assert.equal(report.headerAliasClosure.includeClosureVerified, false); assert.equal(report.headerAliasClosure.sysrootClosureVerified, false);
  assert.equal(report.headerAliasClosure.toolchainClosureVerified, false);
  assert.ok(report.members.filter(m => m.disposition === 'C_HEADER_DATA_CANDIDATE').every(m => m.type === 'file' && m.domain === 'TARGET'));
});
test('actual in-middle lib64 aliases match accepted targets, not host filesystem paths', () => {
  const refs = report.linkerInputReferences.filter(r => r.artifactRole === 'gnu-sdk'); assert.equal(refs.length, 7);
  assert.ok(refs.every(r => r.requiresApprovedSysrootMapping && !r.mappingApproved && r.qualificationStatus === 'UNRESOLVED'));
  const mvec = refs.find(r => r.rawToken === '/lib64/libmvec.so.1');
  assert.equal(mvec.terminalIndex, 5973); assert.equal(mvec.terminalBodySha256, '9e2da73418d729805dbf935a0308d509344a99a66cae93f9ab0fd2fb885ccb15');
  assert.equal(mvec.namespaceHops[0].index, 516);
  assert.equal(refs.find(r => r.rawToken === '/usr/lib64/libc_nonshared.a').namespaceHops[0].index, 4121);
});
test('actual -lgcc uses only the explicit proposed GCC and two sysroot directories', () => {
  const ref = report.linkerInputReferences.find(r => r.rawToken === '-lgcc');
  assert.equal(ref.terminalIndex, 8375); assert.equal(ref.searchAttempts.length, 6); assert.equal(ref.mappingApproved, false);
  assert.equal(ref.status, 'DECLARED_MEMBER_MATCH_NOT_LINKER_PROOF'); assert.match(ref.mapping, /NOT_LINKER_SEARCH_PROOF/u);
});
test('actual Rust LLVM INPUT matches the sibling library hash without host resolution', () => {
  const ref = report.linkerInputReferences.find(r => r.artifactRole === 'rustc'); assert.equal(ref.directive, 'INPUT');
  assert.equal(ref.terminalIndex, 34); assert.equal(ref.rawToken, 'libLLVM.so.22.1-rust-1.95.0-stable');
  assert.equal(ref.terminalBodySha256, 'f6a654c837c51bc2fc00f83d58318607b6f30fec364a00f09b6172129e591fb5');
  assert.equal(ref.hostResolutionAttempted, false); assert.equal(ref.linkerProof, false);
});
test('actual g++ wrapper alias omits CXX before generic selected-wrapper alias analysis', () => {
  const gcc = gnuRow(report, 'bin/x86_64-buildroot-linux-gnu-gcc'), gxx = gnuRow(report, 'bin/x86_64-buildroot-linux-gnu-g++');
  assert.equal(gcc.index, 25); assert.equal(gxx.index, 34); assert.equal(gcc.rawLinkpath, 'toolchain-wrapper'); assert.equal(gxx.rawLinkpath, 'toolchain-wrapper');
  assert.equal(gcc.disposition, 'ALIAS_DATA_CANDIDATE'); assert.equal(gxx.disposition, 'OMIT_OPTIONAL_CXX_LTO_MINIMAL_C_ONLY');
});
test('actual unselected Rust proc macro, objcopy and alternate linker helpers require qualification', () => {
  for (const suffix of ['libexec/rust-analyzer-proc-macro-srv', 'lib/rustlib/x86_64-unknown-linux-gnu/bin/rust-objcopy',
    'lib/rustlib/x86_64-unknown-linux-gnu/bin/gcc-ld/ld64.lld', 'lib/rustlib/x86_64-unknown-linux-gnu/bin/gcc-ld/lld-link',
    'lib/rustlib/x86_64-unknown-linux-gnu/bin/gcc-ld/wasm-ld', 'lib/rustlib/x86_64-unknown-linux-gnu/bin/wasm-component-ld']) {
    const row = rowAt(report, 'rustc', 'rustc/' + suffix); assert.equal(row.disposition, 'CANDIDATE_NEEDS_QUALIFICATION', suffix); assert.ok(row.requiresPayloadQualification);
  }
});
test('actual six Python support files and three debugger launchers plus lldb_commands are omitted', () => {
  const omitted = report.members.filter(m => m.artifactRole === 'rustc' && m.disposition === 'OMIT_PYTHON_DEBUGGER_SUPPORT');
  assert.equal(omitted.filter(m => m.path.endsWith('.py')).length, 6); assert.equal(omitted.length, 10);
  assert.ok(omitted.every(m => m.reasonCodes.includes('PATH_POLICY_ONLY_NOT_CONTENT_OR_NO_PYTHON_PROOF')));
  assert.equal(report.noPythonRuntimeVerified, false);
});
test('all five installer scripts and GNU relocate-sdk script stay omitted', () => {
  assert.equal(report.members.filter(m => m.disposition === 'OMIT_INSTALLER_SCRIPT').length, 6);
  for (const m of report.members.filter(m => m.disposition === 'OMIT_INSTALLER_SCRIPT')) assert.equal(m.proposedRelativeDestination, null);
});
test('actual Rust rmeta, sanitizer archives and std libraries remain candidates without ELF proof', () => {
  const libraries = report.members.filter(m => m.artifactRole === 'rust-std' && m.disposition === 'RUST_LIBRARY_CANDIDATE');
  assert.ok(libraries.some(m => m.path.endsWith('.rmeta'))); assert.ok(libraries.some(m => /san.*\.a$/u.test(m.path)));
  assert.ok(libraries.every(m => m.domain === 'TARGET' && m.requiresPayloadQualification));
});
test('actual Python-tree license remains separate data without GNU C/GCC coverage inference', () => {
  const row = gnuRow(report, 'lib/python3.14/LICENSE.txt'); assert.equal(row.disposition, 'LICENSE_DATA_CANDIDATE');
  assert.ok(row.reasonCodes.includes('EXCLUDED_PYTHON_TREE_LICENSE_DATA')); assert.equal(row.proposedRelativeDestination, 'licenses/gnu-sdk/lib/python3.14/LICENSE.txt');
  assert.equal(report.members.filter(m => m.artifactRole === 'gnu-sdk' && m.disposition === 'LICENSE_DATA_CANDIDATE').length, 1);
  assert.equal(report.gnuLicenseCoverage.gnuCGccLicenseCoverageVerified, false); assert.equal(report.gnuLicenseCoverage.licenseContentsInspected, false);
  assert.equal(gnuRow(report, 'summary.csv').disposition, 'UNREVIEWED_OMIT_NOT_RUNTIME_PROOF');
});
test('root/component license copies receive distinct destinations without content or mode inference', () => {
  const licenseRows = report.members.filter(m => m.disposition === 'LICENSE_DATA_CANDIDATE');
  assert.equal(new Set(licenseRows.map(m => m.proposedRelativeDestination)).size, licenseRows.length);
  assert.ok(licenseRows.some(m => m.path.endsWith('COPYRIGHT-library.html')));
  const r = plan({ cargo: { members: [{ path: 'LICENSE-MIT', mode: 511 }, { path: 'cargo/LICENSE-MIT', mode: 0 }] } });
  assert.equal(r.members.filter(m => m.disposition === 'LICENSE_DATA_CANDIDATE').length, 2); assert.equal(r.licensePermissionClassified, false);
});
test('mock API preserves six fixed role roots and never claims actual evidence validation', () => {
  const r = plan(); assert.equal(r.mockOnly, true); assert.equal(r.callerInputsAuthenticated, false);
  assert.equal(r.acceptedSnapshotAssertionsMatched, false); assert.equal(r.actualEvidenceProofClaimed, false); assert.deepEqual(r.roleOrder, roles);
  assert.throws(() => deriveToolchainMemberPlan(fixture()), { code: 'E_PLAN_ACCEPTED_SNAPSHOT' });
});
test('mock supports lowered limits only and production rejects all extra override arguments', () => {
  assert.throws(() => deriveToolchainMemberPlan(actual, {}), { code: 'E_PLAN_ARGUMENTS' });
  for (const x of [{ maxMembers: 32769 }, { maxMembers: 0 }, { maxMembers: 2.5 }, { extra: 1 }]) assert.throws(() => deriveToolchainMemberPlanForTest(fixture(), x), { code: 'E_PLAN_LIMIT' });
  assert.throws(() => deriveToolchainMemberPlanForTest(fixture(), { maxMembers: 1 }), { code: 'E_PLAN_LIMIT' });
  assert.throws(() => deriveToolchainMemberPlan(), { code: 'E_PLAN_ARGUMENTS' });
});
for (const [name, mutate] of [
  ['missing namespace member', e => roleRecord(e).members.pop()],
  ['altered body hash', e => { roleRecord(e).members[1].bodySha256 = '0'.repeat(64); }],
  ['altered decoded hash', e => { roleRecord(e).decodedSha256 = '0'.repeat(64); }],
  ['mismatched GNU receipt', e => { e.gnu.acceptance.entries--; }],
  ['mismatched Rust compact receipt', e => { e.rust[0].acceptance.publicationAccepted = false; }],
  ['mismatched host receipt', e => { e.host.receipt.sourceAuthenticated = true; }],
  ['forged aggregation', e => { e.receipt.freshRawEvidenceSetValidated = false; }],
  ['extra source property', e => { e.gnu.result.override = true; }],
]) test('production refuses ' + name, () => { const e = clone(actual); mutate(e); assert.throws(() => deriveToolchainMemberPlan(e), { code: 'E_PLAN_ACCEPTED_SNAPSHOT' }); });
for (const [name, mutate] of [
  ['extra root override', e => { e.overrides = {}; }], ['extra GNU property', e => { e.gnu.overrides = {}; }],
  ['missing host receipt', e => { delete e.host.receipt; }], ['wrong rust order', e => { e.rust.reverse(); }],
  ['five roles only', e => { e.rust.pop(); }], ['renamed role root', e => { roleRecord(e, 4).expectedRoot = 'rustfmt-preview-1.95.0-x86_64-unknown-linux-gnu'; }],
]) test('closed evidence schema rejects ' + name, () => { const e = fixture(); mutate(e); assert.throws(() => deriveToolchainMemberPlanForTest(e)); });

for (const [name, bad] of [
  ['getter', () => Object.defineProperty({}, 'receipt', { enumerable: true, get() { assert.fail('getter invoked'); } })],
  ['proxy', () => new Proxy({}, { get() { assert.fail('proxy get'); }, ownKeys() { assert.fail('proxy ownKeys'); }, getPrototypeOf() { assert.fail('proxy prototype'); } })],
  ['sparse array', () => Array(3)], ['typed array', () => new Uint8Array(3)], ['shared array buffer', () => new SharedArrayBuffer(4)],
  ['array buffer', () => new ArrayBuffer(3)], ['date', () => new Date()], ['map', () => new Map()], ['function', () => () => assert.fail('function called')],
  ['toJSON', () => ({ toJSON() { assert.fail('toJSON called'); } })], ['nonfinite', () => NaN], ['infinity', () => Infinity], ['bigint', () => 1n],
  ['symbol key', () => ({ [Symbol('x')]: 1 })], ['undefined', () => undefined],
  ['cycle', () => { const x = {}; x.x = x; return x; }],
  ['nonenumerable', () => Object.defineProperty({}, 'secret', { value: 1 })],
  ['array accessor', () => Object.defineProperty([0], '0', { get() { assert.fail('array getter'); } })],
]) test('passive validation refuses hostile ' + name + ' before serialization', () => {
  const e = fixture(); e.receipt = bad(); assert.throws(() => deriveToolchainMemberPlanForTest(e)); assert.throws(() => encodeToolchainMemberPlan(e));
});
test('nested getters and revoked proxies never execute property operations', () => {
  const e = fixture(); Object.defineProperty(roleRecord(e).members[0], 'path', { get() { assert.fail('nested getter'); } });
  assert.throws(() => deriveToolchainMemberPlanForTest(e), { code: 'E_PLAN_INPUT' });
  const revoked = Proxy.revocable({}, {}); revoked.revoke(); assert.throws(() => deriveToolchainMemberPlanForTest(revoked.proxy), { code: 'E_PLAN_INPUT' });
});
test('depth, nodes, escaped input bytes and declared expansion have independent lower-only bounds', () => {
  const e = fixture(); assert.throws(() => deriveToolchainMemberPlanForTest(e, { maxDepth: 3 }), { code: 'E_PLAN_STRUCTURE_LIMIT' });
  assert.throws(() => deriveToolchainMemberPlanForTest(e, { maxNodes: 50 }));
  assert.throws(() => deriveToolchainMemberPlanForTest(e, { maxInputBytes: 100 }), { code: 'E_PLAN_BYTES' });
  assert.throws(() => deriveToolchainMemberPlanForTest(e, { maxExpandedBytes: 1 }));
  e.receipt.padding = 'π'.repeat(1000); assert.throws(() => deriveToolchainMemberPlanForTest(e, { maxInputBytes: 6000 }), { code: 'E_PLAN_BYTES' });
});
for (const [name, path] of [['absolute', '/host'], ['parent traversal', '../bad'], ['empty component', 'a//b'], ['dot', './a'], ['Unicode', 'π'], ['backslash', 'a\\b'], ['drive', 'C:/x']]) {
  test('canonical source namespace refuses ' + name, () => {
    const e = fixture(); roleRecord(e).members[1].path = path; assert.throws(() => deriveToolchainMemberPlanForTest(e), { code: 'E_PLAN_MEMBER' });
  });
}
test('namespace rejects duplicates, file descendants, unsupported member kinds and untrusted hash shapes', () => {
  for (const mutate of [
    r => { r.members[1].path = r.members[0].path; },
    r => { r.members.find(m => m.path.endsWith('/share')).type = 'file'; r.members.find(m => m.path.endsWith('/share')).bodySha256 = sha(''); r.regularFiles++; },
    r => { r.members[0].type = 'device'; }, r => { r.members.at(-1).bodySha256 = null; },
    r => { r.members[0].bodySha256 = sha(''); }, r => { r.members[0].linkFollowed = true; },
  ]) { const e = fixture(); mutate(roleRecord(e)); assert.throws(() => deriveToolchainMemberPlanForTest(e)); }
});
test('selected observations must bind actual regular member indices, offsets, sizes and hashes', () => {
  for (const key of ['index', 'size', 'bodyOffset', 'bodySha256']) {
    const e = fixture({ 'gnu-sdk': { members: [{ path: 'bin/cc' }], selected: [{ path: 'bin/cc' }] } });
    roleRecord(e).selected[0][key] = key === 'bodySha256' ? '0'.repeat(64) : 123;
    assert.throws(() => deriveToolchainMemberPlanForTest(e), { code: 'E_PLAN_SELECTED' });
  }
});
test('nonregular namespace records retain null body hashes and inert raw links', () => {
  const r = plan({ 'gnu-sdk': { members: [{ path: 'link', type: 'symlink', linkpath: '/host/secret' }] } });
  const m = gnuRow(r, 'link'); assert.equal(m.bodySha256, null); assert.equal(m.linkFollowed, false); assert.equal(m.rawLinkpath, '/host/secret');
  assert.equal(r.aliasReferences[0].status, 'UNRESOLVED_ABSOLUTE_LINK');
});
test('component/version exact text rejects version and component alias assumptions', () => {
  for (const [suffix, text] of [['components', 'cargo\nother\n'], ['components', 'rustfmt\n'], ['rust-installer-version', '4\n'], ['rust-installer-version', '3']]) {
    const e = fixture(); updateText(e, 1, suffix, text); assert.throws(() => deriveToolchainMemberPlanForTest(e), { code: 'E_PLAN_COMPONENT' });
  }
});
test('raw Rust manifest reparse must agree with retained normalized declarations', () => {
  const e = fixture({ cargo: { declarations: [{ kind: 'file', path: 'bin/cargo' }], members: [{ path: 'cargo/bin/cargo' }] } });
  roleRecord(e, 1).manifests[0].declarations[0].path = 'bin/other';
  assert.throws(() => deriveToolchainMemberPlanForTest(e), { code: 'E_PLAN_DECLARATION_MISMATCH' });
});
test('unknown Rust declaration lines remain uninterpreted without installer claims', () => {
  const r = plan({ cargo: { manifestText: 'unrecognized:bin/x\n', declarations: [] } });
  assert.equal(r.unknownManifestLines[0].status, 'UNINTERPRETED'); assert.equal(r.completeInstallerInterpretation, false); assert.equal(r.installerInterpretationVerified, false);
});
for (const path of ['../escape', '/host/bin', 'a//b', './bin/cargo', 'bin\\cargo']) test('Rust file declaration rejects literal unsafe destination ' + path, () => {
  const e = fixture({ cargo: { declarations: [{ kind: 'file', path }] } }); assert.throws(() => deriveToolchainMemberPlanForTest(e), { code: 'E_PLAN_DECLARATION' });
});
test('missing Rust declaration and symlink declarations stay unresolved, not installer matches', () => {
  const r = plan({ cargo: { declarations: [{ kind: 'file', path: 'bin/missing' }, { kind: 'file', path: 'bin/link' }],
    members: [{ path: 'cargo/bin/link', type: 'symlink', linkpath: 'missing' }] } });
  assert.ok(r.rustDeclarations.every(d => d.status === 'UNRESOLVED_DECLARED_MEMBER' && d.bodySha256 === null));
});
test('directory declaration expands bounded descendants without flattening paths', () => {
  const specs = { cargo: { declarations: [{ kind: 'dir', path: 'lib/sub' }], members: [{ path: 'cargo/lib/sub/nested/a.rlib' }] } };
  const r = plan(specs); assert.equal(r.rustDeclarations.length, 3);
  const file = r.rustDeclarations.find(d => d.kind === 'file'); assert.equal(file.destination, 'lib/sub/nested/a.rlib');
  assert.equal(file.expandedFromDirectory, 'lib/sub'); assert.equal(file.proposedRelativeDestination, 'rust/lib/sub/nested/a.rlib');
  assert.throws(() => deriveToolchainMemberPlanForTest(fixture(specs), { maxDeclarations: 2 }), { code: 'E_PLAN_DECLARATION_LIMIT' });
});
test('all-role proposed manifest destination collisions are explicit and blocked', () => {
  const shared = { declarations: [{ kind: 'file', path: 'bin/shared' }], members: [{ path: 'cargo/bin/shared' }] };
  const r = plan({ cargo: shared, rustc: { ...shared, members: [{ path: 'rustc/bin/shared' }] } });
  assert.ok(r.proposedDestinationsBlocked); assert.equal(r.proposedDestinationCollisions[0].status, 'BLOCKED_DESTINATION_COLLISION');
  assert.ok(r.rustDeclarations.every(d => d.proposedDestinationStatus === 'BLOCKED_DESTINATION_COLLISION'));
});
test('repeated directory declarations and normal ancestry are not destination conflicts', () => {
  const r = plan({ cargo: { declarations: [{ kind: 'dir', path: 'lib' }, { kind: 'dir', path: 'lib' }], members: [{ path: 'cargo/lib', type: 'directory' }] } });
  assert.equal(r.proposedDestinationCollisions.length, 1); assert.ok(r.proposedDestinationCollisions[0].repeatedDirectoryOnly); assert.equal(r.proposedDestinationsBlocked, false);
});
test('repeated populated directories expand once without inventing file destination collisions', () => {
  const r = plan({ cargo: { declarations: [{ kind: 'dir', path: 'lib' }, { kind: 'dir', path: 'lib' }], members: [{ path: 'cargo/lib/nested/file.rlib' }] } });
  assert.equal(r.rustDeclarations.filter(d => d.kind === 'file').length, 1); assert.equal(r.proposedDestinationsBlocked, false);
});
test('proposed file/descendant collisions block even across artifacts', () => {
  const r = plan({ cargo: { declarations: [{ kind: 'file', path: 'lib/shared' }], members: [{ path: 'cargo/lib/shared' }] },
    rustc: { declarations: [{ kind: 'file', path: 'lib/shared/child' }], members: [{ path: 'rustc/lib/shared/child' }] } });
  assert.ok(r.proposedDestinationsBlocked); assert.deepEqual(r.proposedDestinationCollisions[0].fileAncestors, ['rust/lib/shared']);
  assert.ok(r.rustDeclarations.every(d => d.proposedDestinationStatus === 'BLOCKED_DESTINATION_COLLISION'));
});

test('component-by-component namespace resolution handles a directory symlink in the middle', () => {
  const e = linkerFixture([{ path: sysroot + '/lib/libx.so', body: 'target' }, { path: sysroot + '/lib64', type: 'symlink', linkpath: 'lib' }], '/lib64/libx.so');
  const r = reference(e); assert.equal(r.status, 'DECLARED_MEMBER_MATCH_NOT_LINKER_PROOF'); assert.equal(r.terminalBodySha256, sha('target'));
  assert.equal(r.namespaceHops[0].rawLinkpath, 'lib'); assert.equal(r.mappingApproved, false);
});
test('parent-component symlink targets resolve only within the recorded root', () => {
  const e = linkerFixture([{ path: 'lib/real.so', body: 'target' }, { path: sysroot + '/usr/lib/link.so', type: 'symlink', linkpath: '../../../../lib/real.so' }], 'link.so');
  assert.equal(reference(e).terminalPath, roots[0] + '/lib/real.so');
});
for (const [name, members, token, status] of [
  ['missing intermediate directory', [], '/lib64/x', 'UNRESOLVED_MISSING_MEMBER'],
  ['absolute symlink target', [{ path: sysroot + '/usr/lib/link', type: 'symlink', linkpath: '/host/lib.so' }], 'link', 'UNRESOLVED_ABSOLUTE_LINK'],
  ['escaping relative symlink', [{ path: sysroot + '/usr/lib/link', type: 'symlink', linkpath: '../../../../../../host' }], 'link', 'UNRESOLVED_ESCAPE'],
  ['self loop', [{ path: sysroot + '/usr/lib/link', type: 'symlink', linkpath: 'link' }], 'link', 'UNRESOLVED_LINK_LOOP'],
  ['two-link loop', [{ path: sysroot + '/usr/lib/a', type: 'symlink', linkpath: 'b' }, { path: sysroot + '/usr/lib/b', type: 'symlink', linkpath: 'a' }], 'a', 'UNRESOLVED_LINK_LOOP'],
  ['directory terminal', [{ path: sysroot + '/usr/lib/dir', type: 'directory' }], 'dir', 'UNRESOLVED_NONREGULAR_TERMINAL'],
  ['unsupported host absolute literal', [], '/etc/host.so', 'UNRESOLVED_UNSUPPORTED_LITERAL'],
  ['unapproved traversal literal', [], '../host.so', 'UNRESOLVED_UNSUPPORTED_LITERAL'],
  ['unapproved library search', [], '-lstdc++', 'UNRESOLVED_UNSUPPORTED_LITERAL'],
]) test('inert linker resolver reports ' + name, () => {
  const r = reference(linkerFixture(members, token)); assert.equal(r.status, status); assert.equal(r.terminalIndex, null); assert.equal(r.hostResolutionAttempted, false);
});
test('hardlinks use archive-root targets, not the symlink parent directory', () => {
  const e = linkerFixture([{ path: 'lib/real.so', body: 'archive-root' }, { path: sysroot + '/usr/lib/link', type: 'hardlink', linkpath: roots[0] + '/lib/real.so' }], 'link');
  const r = reference(e); assert.equal(r.terminalBodySha256, sha('archive-root')); assert.equal(r.namespaceHops[0].type, 'hardlink');
});
test('hardlink sibling names cannot masquerade as archive-root names', () => {
  const e = linkerFixture([{ path: sysroot + '/usr/lib/real.so' }, { path: sysroot + '/usr/lib/link', type: 'hardlink', linkpath: 'real.so' }], 'link');
  assert.equal(reference(e).status, 'UNRESOLVED_HARDLINK_ROOT');
});
test('link hop and total component guards stop before any fallback search', () => {
  const members = [{ path: sysroot + '/usr/lib/real', body: 'x' }, ...Array.from({ length: 33 }, (_, i) => ({ path: sysroot + '/usr/lib/a' + i, type: 'symlink', linkpath: i === 32 ? 'real' : 'a' + (i + 1) }))];
  const e = linkerFixture(members, 'a0'); assert.equal(reference(e).status, 'UNRESOLVED_HOP_LIMIT');
  const r = deriveToolchainMemberPlanForTest(e, { maxPathComponents: 3 }); assert.equal(r.linkerInputReferences[0].status, 'UNRESOLVED_COMPONENT_LIMIT');
});
test('missing -lgcc records six finite proposed searches without host fallback', () => {
  const r = reference(linkerFixture([], '-lgcc')); assert.equal(r.status, 'UNRESOLVED_GCC_LIBRARY'); assert.equal(r.searchAttempts.length, 6);
  assert.ok(r.searchAttempts.every(a => a.proposedPath.startsWith(roots[0] + '/')));
});
test('multiple distinct -lgcc candidates are ambiguous instead of claiming actual linker order', () => {
  const r = reference(linkerFixture([{ path: 'lib/gcc/x86_64-buildroot-linux-gnu/15.3.0/libgcc.a', body: 'a' },
    { path: sysroot + '/lib/libgcc.so', body: 'b' }], '-lgcc'));
  assert.equal(r.status, 'UNRESOLVED_AMBIGUOUS_GCC_LIBRARY'); assert.equal(r.terminalIndex, null);
});
test('aliases cannot override optional CXX/LTO or Python-debugger omission', () => {
  const r = plan({ 'gnu-sdk': { members: [{ path: 'bin/toolchain-wrapper' }, { path: 'bin/g++', type: 'symlink', linkpath: 'toolchain-wrapper' },
    { path: 'bin/c++', type: 'symlink', linkpath: 'toolchain-wrapper' }, { path: 'bin/lto-wrapper', type: 'symlink', linkpath: 'toolchain-wrapper' },
    { path: 'bin/python3', type: 'symlink', linkpath: 'toolchain-wrapper' }, { path: 'bin/gcc', type: 'symlink', linkpath: 'toolchain-wrapper' }], selected: [{ path: 'bin/toolchain-wrapper' }] } });
  for (const suffix of ['bin/g++', 'bin/c++', 'bin/lto-wrapper']) assert.equal(gnuRow(r, suffix).disposition, 'OMIT_OPTIONAL_CXX_LTO_MINIMAL_C_ONLY');
  assert.equal(gnuRow(r, 'bin/python3').disposition, 'OMIT_PYTHON_DEBUGGER_SUPPORT'); assert.equal(gnuRow(r, 'bin/gcc').disposition, 'ALIAS_DATA_CANDIDATE');
});
test('uninspected GNU target paths never receive false HOST classification', () => {
  const r = plan({ 'gnu-sdk': { members: [{ path: sysroot + '/usr/lib/unknown.so' }] } });
  assert.equal(gnuRow(r, sysroot + '/usr/lib/unknown.so').domain, 'TARGET'); assert.equal(gnuRow(r, sysroot + '/usr/lib/unknown.so').disposition, 'UNREVIEWED_OMIT_NOT_RUNTIME_PROOF');
});
test('license.h and license.hpp remain C headers, not legal-notice candidates', () => {
  const r = plan({ 'gnu-sdk': { members: [{ path: sysroot + '/usr/include/license.h' }, { path: sysroot + '/usr/include/license.hpp' }] } });
  assert.equal(r.members.filter(m => m.disposition === 'LICENSE_DATA_CANDIDATE').length, 0); assert.equal(r.headerAliasClosure.regularHeaderCount, 2);
});
test('unknown license-like names require review and Python modules inside license folders stay omitted', () => {
  const r = plan({ 'gnu-sdk': { members: [{ path: 'LICENSE.weird' }, { path: 'licenses/module.py' },
    { path: sysroot + '/usr/include/COPYRIGHT-library.hpp' }, { path: sysroot + '/usr/include/lto.h' }] } });
  assert.ok(gnuRow(r, 'LICENSE.weird').reasonCodes.includes('LICENSE_LIKE_NAME_REQUIRES_REVIEW'));
  assert.equal(gnuRow(r, 'licenses/module.py').disposition, 'OMIT_PYTHON_DEBUGGER_SUPPORT');
  assert.equal(r.headerAliasClosure.regularHeaderCount, 2);
});
test('lower-only test snapshots cannot exceed the accepted per-role selected count', () => {
  const e = fixture({ cargo: { members: [{ path: 'cargo/bin/a' }, { path: 'cargo/bin/b' }], selected: [{ path: 'cargo/bin/a' }, { path: 'cargo/bin/b' }] } });
  assert.throws(() => deriveToolchainMemberPlanForTest(e), { code: 'E_PLAN_COUNTS' });
});
test('unknown manifest lines use the same bounded declaration budget', () => {
  const e = fixture({ cargo: { manifestText: 'unknown\nunknown\nunknown\n' } });
  assert.throws(() => deriveToolchainMemberPlanForTest(e, { maxDeclarations: 2 }), { code: 'E_PLAN_DECLARATION_LIMIT' });
});
test('GNU relocation parsing also obeys the finite reference budget', () => {
  const e = fixture({ relocs: './a\n./b\n./c\n' });
  assert.throws(() => deriveToolchainMemberPlanForTest(e, { maxDeclarations: 2 }), { code: 'E_PLAN_RELOCATION' });
});
test('TARGET namespace aliases cannot promote selected HOST tools into TARGET providers', () => {
  const r = plan({ 'gnu-sdk': { members: [{ path: 'bin/host-tool' }, { path: sysroot + '/alias', type: 'symlink', linkpath: '../../bin/host-tool' }], selected: [{ path: 'bin/host-tool' }] } });
  const m = gnuRow(r, sysroot + '/alias'); assert.equal(m.domain, 'TARGET'); assert.equal(m.disposition, 'UNREVIEWED_LINK_DATA');
  assert.ok(m.reasonCodes.includes('CROSS_DOMAIN_ALIAS_NOT_PROMOTED'));
});
test('selected GNU sysroot observations cannot claim HOST domain', () => {
  const e = fixture({ 'gnu-sdk': { members: [{ path: sysroot + '/lib/libx.so' }], selected: [{ path: sysroot + '/lib/libx.so', domain: 'HOST' }] } });
  assert.throws(() => deriveToolchainMemberPlanForTest(e), { code: 'E_PLAN_SELECTED' });
});
test('cross-domain linker namespace matches remain unresolved despite finding recorded bytes', () => {
  const e = fixture({ 'gnu-sdk': { members: [{ path: 'lib/host.so', body: 'host' }, { path: sysroot + '/usr/lib/script.so' },
    { path: sysroot + '/usr/lib/link.so', type: 'symlink', linkpath: '../../../../lib/host.so' }],
    selected: [{ path: 'lib/host.so' }, { path: sysroot + '/usr/lib/script.so', kind: 'LINKER_TEXT', domain: 'TARGET', references: [['link.so']] }] } });
  const ref = reference(e); assert.equal(ref.status, 'UNRESOLVED_CROSS_DOMAIN_REFERENCE');
  assert.equal(ref.sourceDomain, 'TARGET'); assert.equal(ref.terminalDomain, 'HOST'); assert.equal(ref.hostTargetPromotion, false);
});
test('exactly 32 namespace link hops can match but the thirty-third remains unresolved', () => {
  const chain = n => [{ path: sysroot + '/usr/lib/real', body: 'terminal' }, ...Array.from({ length: n }, (_, i) => ({
    path: sysroot + '/usr/lib/a' + i, type: 'symlink', linkpath: i + 1 === n ? 'real' : 'a' + (i + 1) }))];
  assert.equal(reference(linkerFixture(chain(32), 'a0')).status, 'DECLARED_MEMBER_MATCH_NOT_LINKER_PROOF');
  assert.equal(reference(linkerFixture(chain(33), 'a0')).status, 'UNRESOLVED_HOP_LIMIT');
});
for (const literal of ['././a\n', '../a\n', '/absolute\n', 'a\r\n', '\n', 'a\n./a\n', ' a\n']) test('GNU relocation refuses normalization or trimming of ' + JSON.stringify(literal), () => {
  assert.throws(() => deriveToolchainMemberPlanForTest(fixture({ relocs: literal })), { code: 'E_PLAN_RELOCATION' });
});
test('GNU relocation observes only exact regular records and strips exactly one ./', () => {
  const r = plan({ relocs: './bin/exact\n./bin/link\nmissing\n', 'gnu-sdk': { members: [{ path: 'bin/exact' }, { path: 'bin/link', type: 'symlink', linkpath: 'exact' }] } });
  assert.deepEqual(r.gnuRelocation.references.map(r => r.status), ['REGULAR_FILE', 'UNRESOLVED_WHOLE_SDK_CONTEXT', 'UNRESOLVED_WHOLE_SDK_CONTEXT']);
  assert.equal(r.gnuRelocation.references[0].rawReference, './bin/exact'); assert.equal(r.gnuRelocation.references[1].bodySha256, null);
});
test('ASCII encoder counts every Unicode UTF-16 unit and all short JSON escapes', () => {
  const value = { text: 'π😀\b\t\n\f\r"\\' }, encoded = encodeToolchainMemberPlan(value);
  assert.equal(encoded, '{"text":"\\u03c0\\ud83d\\ude00\\b\\t\\n\\f\\r\\"\\\\"}\n');
  assert.deepEqual(JSON.parse(encoded), value); assert.doesNotMatch(encoded, /[^\x00-\x7f]/u);
});
test('ASCII output cap includes terminal LF and refuses one-byte overflow', () => {
  const max = TOOLCHAIN_MEMBER_PLAN_LIMITS.maxOutputBytes;
  assert.equal(encodeToolchainMemberPlan('a'.repeat(max - 3)).length, max);
  assert.throws(() => encodeToolchainMemberPlan('a'.repeat(max - 2)), { code: 'E_PLAN_BYTES' });
});
test('Unicode expansion and all short escapes use exact bounded ASCII accounting', () => {
  const max = TOOLCHAIN_MEMBER_PLAN_LIMITS.maxOutputBytes, unicode = 'π'.repeat(Math.floor((max - 3) / 6));
  assert.equal(encodeToolchainMemberPlan(unicode).length, unicode.length * 6 + 3);
  assert.throws(() => encodeToolchainMemberPlan(unicode + 'π'), { code: 'E_PLAN_BYTES' });
  const short = '\b\t\n\f\r"\\'.repeat(300); assert.equal(encodeToolchainMemberPlan(short).length, short.length * 2 + 3);
});
test('derive output budget refuses complete report instead of returning partial members', () => {
  assert.throws(() => deriveToolchainMemberPlanForTest(fixture(), { maxOutputBytes: 100 }), { code: 'E_PLAN_BYTES' });
});
test('full actual output round-trips as bounded ASCII with LF and no caller mutation', () => {
  const encoded = encodeToolchainMemberPlan(report); assert.ok(encoded.length <= 16777216); assert.ok(encoded.endsWith('\n'));
  assert.doesNotMatch(encoded, /[^\x00-\x7f]/u); assert.deepEqual(JSON.parse(encoded), clone(report)); assert.equal(JSON.stringify(actual), actualBefore);
});
test('module imports only pure Node crypto/util and exposes no IO, process or execution mechanism', () => {
  const source = readFileSync(new URL('./toolchain-member-plan.mjs', import.meta.url), 'utf8');
  assert.ok(source.startsWith('// SPEC: _spec/tooling/native-ingress/step2.puml\n'));
  assert.deepEqual([...source.matchAll(/from '([^']+)'/gu)].map(m => m[1]), ['node:crypto', 'node:util']);
  assert.doesNotMatch(source, /\b(?:fetch|eval|readFile|writeFile|spawn|require)\s*\(|(?<!\.)\bexec\s*\(|\bimport\s*\(|process\./u);
  assert.equal(deriveToolchainMemberPlan.length, 1); assert.equal(deriveToolchainMemberPlanForTest.length, 1);
});
