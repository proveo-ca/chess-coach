// SPEC: _spec/tooling/native-ingress/step2.puml
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as production from './candidate-image-manifest.mjs';

const { createCandidateImageManifestV1: create, CANDIDATE_IMAGE_MANIFEST_V1_PINS: pins } = production;
const source = readFileSync(new URL('./candidate-image-manifest.mjs', import.meta.url), 'utf8');
const names = ['memberPlan', 'gnuEvidence', 'gnuPreparationPlan', 'gccNotices'];
const inputs = Object.fromEntries(names.map(name => [name, readFileSync(new URL('../../' + pins[name].path, import.meta.url))]));
const documents = Object.fromEntries(names.map(name => [name, JSON.parse(inputs[name])]));
const hash = value => createHash('sha256').update(value).digest('hex');
const asciiJson = value => JSON.stringify(value).replace(/[\u007f-\uffff]/g,
  char => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0')) + '\n';
const result = create(inputs);
const falseKeys = `materializationAuthorized imageComplete closedRootfs copyAuthorized extractionAuthorized
installationAuthorized executionAllowed executableAllowed allowedForExecution roleQualified sourceAuthenticated
publisherAuthenticated callerInputsAuthenticated sourceRootAuthentication licenseComplianceVerified
licensePermissionClassified noticeApplicabilityVerified hostTargetPromotion pythonFreeSubsetVerified
noPythonRuntimeVerified runtimeProvidersQualified symbolBindingsVerified abiVerified imagePrepared imageEquivalent
nativeQualified rustReady trainingReady futureBuildGraphQualified compilerExecuted policyChanged
defaultVersionsChanged featuresChanged backendsChanged linkerSelectionChanged compilerFlagsChanged
partialProofClaimed step2Closed f9NativeProvided`.split(/\s+/);
const selectable = new Set(['INSPECTED_TOOLCHAIN_CANDIDATE', 'C_HEADER_DATA_CANDIDATE',
  'CANDIDATE_NEEDS_QUALIFICATION', 'RUST_LIBRARY_CANDIDATE']);
const originalPrefix = '/builds/buildroot.org/toolchains-builder/build/x86-64--glibc--stable-2026.08-1';
const originalMembers = documents.memberPlan.members;
const byId = new Map(originalMembers.map(row => [row.artifactRole + ':' + row.index, row]));
const roots = documents.gnuEvidence.collection.roles[0];

async function specialize(bytes, instrumentation = '') {
  let text = source;
  for (const name of names) {
    const oldLength = 'byteLength: ' + pins[name].byteLength;
    assert.equal(text.split(oldLength).length, 2);
    assert.equal(text.split(pins[name].sha256).length, 2);
    text = text.replace(oldLength, 'byteLength: ' + bytes[name].length)
      .replace(pins[name].sha256, hash(bytes[name]));
  }
  if (instrumentation) text = instrumentation(text);
  return import('data:text/javascript;base64,' + Buffer.from(text).toString('base64'));
}

function encodeMutation(mutate) {
  const docs = structuredClone(documents);
  mutate(docs);
  const bytes = Object.fromEntries(names.map(name => [name, Buffer.from(asciiJson(docs[name]))]));
  const prep = docs.gnuPreparationPlan;
  Object.assign(prep.inputBindings.gnuEvidence, { byteLength: bytes.gnuEvidence.length, sha256: hash(bytes.gnuEvidence) });
  Object.assign(prep.priorMemberPlanReference, { byteLength: bytes.memberPlan.length, sha256: hash(bytes.memberPlan) });
  bytes.gnuPreparationPlan = Buffer.from(asciiJson(prep));
  return bytes;
}

function mutation(name, mutate, code = /^E_/) {
  test(name, async () => {
    const bytes = encodeMutation(mutate);
    const module = await specialize(bytes);
    assert.throws(() => module.createCandidateImageManifestV1(bytes), error => {
      assert.match(error.message, code);
      assert.match(error.message, /^E_[A-Z_]+$/);
      return true;
    });
  });
}

function instrument(text) {
  const needle = 'const copy = new Uint8Array(length);';
  assert.equal(text.split(needle).length, 2);
  return 'let privateCopies = 0;\n' + text.replace(needle, 'privateCopies++; ' + needle) +
    '\nexport const testing = { copies: () => privateCopies, canonical, inspectData, jsonBytes, accumulator };\n';
}
const instrumented = await specialize(inputs, instrument);

test('public API contains exactly two exports', () => {
  assert.deepEqual(Object.keys(production).sort(), ['CANDIDATE_IMAGE_MANIFEST_V1_PINS', 'createCandidateImageManifestV1']);
});
test('production imports only builtin crypto and util', () => {
  assert.deepEqual([...source.matchAll(/from '([^']+)'/g)].map(match => match[1]), ['node:crypto', 'node:util']);
  assert.doesNotMatch(source, /\b(?:eval|process|fetch|require|import\s*\()\b/);
  assert.doesNotMatch(source, /Buffer\.from|\.valueOf\(|\.toString\(|Symbol\.iterator/);
});
test('production carries the parent SPEC pointer', () => {
  assert.equal(source.split('\n')[0], '// SPEC: _spec/tooling/native-ingress/step2.puml');
});
test('four exact frozen pins total 8753751 bytes', () => {
  assert.equal(Object.values(pins).reduce((sum, pin) => sum + pin.byteLength, 0), 8753751);
  assert.ok(Object.isFrozen(pins));
  for (const name of names) {
    assert.ok(Object.isFrozen(pins[name]));
    assert.equal(inputs[name].length, pins[name].byteLength);
    assert.equal(hash(inputs[name]), pins[name].sha256);
    assert.throws(() => { pins[name].sha256 = '0'.repeat(64); }, TypeError);
  }
});
test('real four Buffer inputs produce a proposed incomplete planning record', () => {
  assert.equal(result.profile, 'CANDIDATE_IMAGE_MANIFEST_V1');
  assert.equal(result.status, 'PROPOSED_INCOMPLETE');
  assert.equal(result.scope, 'UNIFIED_SDK_RUNTIME_PLANNING_ONLY');
  assert.equal(Object.getPrototypeOf(result), Object.prototype);
  assert.equal(result.candidateOnly, true);
});
test('all authority flags remain false at root and every actionable record', () => {
  for (const record of [result, ...result.candidatePlacements, ...result.runtimeRoleCandidates,
    ...result.rootAliasProposals, ...result.externalNoticeRecords]) {
    for (const key of falseKeys) assert.equal(record[key], false, key);
  }
});
test('the returned record is recursively frozen plain data', () => {
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    assert.ok(Object.isFrozen(value));
    assert.equal(Object.getPrototypeOf(value), Array.isArray(value) ? Array.prototype : Object.prototype);
    for (const key of Object.keys(value)) visit(value[key]);
  }
  visit(result);
  assert.throws(() => { result.candidatePlacements[0].copyAuthorized = true; }, TypeError);
});
test('all four input Buffers remain byte-identical', () => {
  for (const name of names) assert.equal(hash(inputs[name]), pins[name].sha256);
});
test('input byte verification does not authenticate a publisher or source root', () => {
  for (const name of names) {
    const binding = result.inputBindings[name];
    assert.equal(binding.bytesVerified, true);
    assert.equal(binding.sha256Verified, true);
    assert.equal(binding.identityMeaning, 'RAW_BYTE_IDENTITY_ONLY');
    assert.equal(binding.publisherAuthenticated, false);
    assert.equal(binding.sourceAuthenticated, false);
    assert.equal(binding.sourceRootAuthentication, false);
  }
});
test('exactly 8675 unique source identities retain every original field', () => {
  assert.equal(result.sourceIdentityLedger.length, 8675);
  assert.equal(new Set(result.sourceIdentityLedger.map(row => row.sourceId)).size, 8675);
  for (const row of result.sourceIdentityLedger) {
    const old = byId.get(row.sourceId);
    for (const key of Object.keys(old)) assert.deepEqual(row[key], old[key]);
  }
});
test('all six source roles retain their original counts and ordering', () => {
  assert.deepEqual([...new Set(result.sourceIdentityLedger.map(row => row.artifactRole))], documents.memberPlan.roleOrder);
  for (const role of documents.memberPlan.roleOrder) assert.equal(
    result.sourceIdentityLedger.filter(row => row.artifactRole === role).length,
    documents.memberPlan.counts.byRole[role].entries);
});
test('candidate placement count derives from the four allowlisted dispositions plus supplements', () => {
  const original = originalMembers.filter(row => selectable.has(row.disposition) && row.proposedRelativeDestination !== null);
  assert.equal(result.counts.originalSelected, original.length);
  assert.equal(result.candidatePlacements.length, original.length + 150 + 8);
  assert.equal(result.counts.identicalDeduplications, 8);
  assert.equal(new Set(result.candidatePlacements.map(row => row.imageDestination)).size, result.candidatePlacements.length);
});
test('every source identity has an explicit original selection or omission reason', () => {
  assert.equal(result.selectionLedger.length, 8675);
  for (const row of result.selectionLedger) {
    const old = byId.get(row.sourceId);
    assert.equal(row.sourceDisposition, old.disposition);
    assert.ok(row.reason);
    assert.equal(row.omissionIsNoPythonProof, false);
    assert.equal(row.selectionStatus === 'ORIGINAL_CANDIDATE',
      selectable.has(old.disposition) && old.proposedRelativeDestination !== null);
  }
});
test('directories links licenses distribution data and omitted trees are never automatically placed', () => {
  for (const row of result.candidatePlacements.filter(row => row.selectionReason === 'ORIGINAL_CONSERVATIVE_ALLOWLIST')) {
    assert.ok(selectable.has(row.sourceDisposition));
    assert.equal(row.type, 'file');
  }
  const pythonLicense = result.sourceIdentityLedger.find(row => row.path.endsWith('/lib/python3.14/LICENSE.txt'));
  assert.equal(pythonLicense.disposition, 'LICENSE_DATA_CANDIDATE');
  assert.ok(!result.candidatePlacements.some(row => row.sourceId === pythonLicense.sourceId));
});
test('all six Rust helper roles remain unresolved candidates', () => {
  const helpers = result.candidatePlacements.filter(row => row.sourceDisposition === 'CANDIDATE_NEEDS_QUALIFICATION');
  assert.equal(helpers.length, 6);
  assert.ok(helpers.every(row => row.qualificationStatus === 'UNRESOLVED' && row.requiresPayloadQualification));
  assert.equal(result.inertReferences.supplementaryHelperProofStatus, 'NOT_READ_OR_VERIFIED_BY_THIS_MODULE');
});
test('all 150 private headers join existing identities without rewriting old dispositions', () => {
  const headers = result.candidatePlacements.filter(row => row.selectionReason === 'PRIVATE_HEADER_SUPPLEMENT');
  assert.equal(headers.length, 150);
  assert.equal(headers.reduce((sum, row) => sum + row.size, 0), 2907751);
  for (const row of headers) {
    assert.equal(row.sourceDisposition, 'UNREVIEWED_OMIT_NOT_RUNTIME_PROOF');
    assert.equal(byId.get(row.sourceId).disposition, row.sourceDisposition);
    assert.equal(row.supplementDeclaredDomain, 'TARGET');
    const input = documents.gnuPreparationPlan.headerSelectionSupplement.records.find(h => h.index === row.memberIndex);
    for (const key of ['path', 'bodyOffset', 'size', 'bodySha256']) assert.equal(row[key], input[key]);
  }
});
test('the original GNU prefix comes from the exact 79-byte LF-terminated metadata', () => {
  assert.equal(result.prefixes.gnu.imagePrefix, originalPrefix);
  assert.equal(result.prefixes.gnu.rawLocationText, originalPrefix + '\n');
  assert.equal(result.prefixes.gnu.rawLocationByteLength, 79);
  assert.equal(hash(result.prefixes.gnu.rawLocationText), result.prefixes.gnu.rawLocationSha256);
  assert.equal(result.prefixes.gnu.hostMount, false);
});
test('Rust /opt/rust remains a proposal rather than a deployment root', () => {
  assert.equal(result.prefixes.rust.imagePrefix, '/opt/rust');
  assert.equal(result.prefixes.rust.prefixStatus, 'PROPOSED_NOT_MATERIALIZATION_ROOT');
  assert.equal(result.prefixes.rust.materializationAuthorized, false);
  assert.ok(result.candidatePlacements.filter(row => row.artifactRole !== 'gnu-sdk')
    .every(row => row.imageDestination.startsWith('/opt/rust/')));
});
test('placements preserve modes only as metadata and qualification flags without promotion', () => {
  for (const row of result.candidatePlacements) {
    const old = byId.get(row.sourceId);
    assert.equal(row.originalMode, old.mode);
    assert.equal(row.modeStatus, 'SOURCE_METADATA_NOT_EXECUTION_PERMISSION');
    assert.equal(row.requiresPayloadQualification, old.requiresPayloadQualification);
    assert.equal(row.qualificationStatus, 'UNRESOLVED');
  }
});
test('eight runtime proposals retain distinct TARGET source identities and HOST proposal IDs', () => {
  assert.equal(result.runtimeRoleCandidates.length, 8);
  assert.equal(result.runtimeRoleCandidates.reduce((sum, row) => sum + row.size, 0), 6183544);
  for (const row of result.runtimeRoleCandidates) {
    assert.equal(row.sourceDomain, 'TARGET');
    assert.equal(row.proposedDomain, 'HOST');
    assert.notEqual(row.candidateId, row.sourceRef.sourceId);
    assert.equal(byId.get(row.sourceRef.sourceId).domain, 'TARGET');
    assert.equal(row.qualificationStatus, 'UNRESOLVED');
    const raw = roots.members[row.sourceRef.memberIndex - 1];
    assert.equal(row.bodySha256, raw.bodySha256);
    assert.equal(row.rootDestination, '/' + raw.path.split('/sysroot/')[1]);
    assert.ok(row.rootDestination.startsWith('/lib/'));
    assert.deepEqual(row.qualificationRequired, ['LOAD', 'ISA', 'SYMBOLS', 'PRIVATE_ABI']);
  }
});
test('each runtime source has one original-prefix and one root placement', () => {
  for (const runtime of result.runtimeRoleCandidates) {
    const placements = result.candidatePlacements.filter(row => row.sourceId === runtime.sourceRef.sourceId);
    assert.equal(placements.length, 2);
    assert.ok(placements.some(row => row.imageDestination.startsWith(originalPrefix + '/')));
    assert.ok(placements.some(row => row.imageDestination === runtime.rootDestination));
  }
});
test('libgcc is not classified as glibc', () => {
  assert.equal(result.runtimeRoleCandidates.find(row => row.rootDestination === '/lib/libgcc_s.so.1').runtimeFamily, 'LIBGCC');
  assert.equal(result.runtimeRoleCandidates.filter(row => row.runtimeFamily === 'GLIBC').length, 7);
});
test('all seven old HOST candidates remain unused without touching their flags', () => {
  assert.equal(result.unusedHostCandidates.length, 7);
  result.unusedHostCandidates.forEach((row, i) => {
    assert.deepEqual(row.record, documents.memberPlan.hostCandidates[i]);
    assert.equal(row.usageStatus, 'UNUSED_PROPOSED_IMAGE');
    assert.equal(row.allowedForExecution, false);
    assert.equal(row.roleQualified, false);
  });
});
test('only the two explicit root aliases are proposed without following them', () => {
  assert.deepEqual(result.rootAliasProposals.map(row => [row.memberIndex, row.imageDestination, row.relativeTarget]),
    [[516, '/lib64', 'lib'], [4121, '/usr/lib64', 'lib']]);
  assert.ok(result.rootAliasProposals.every(row => row.targetResolution === 'PROPOSED_NOT_PROVED' &&
    row.aliasCreationAuthorized === false && row.aliasFollowed === false));
  assert.deepEqual(result.interpreterProposal, { path: '/lib64/ld-linux-x86-64.so.2',
    lexicalTargetProposal: '/lib/ld-linux-x86-64.so.2', status: 'PROPOSED_NOT_REALPATH',
    allowedForExecution: false, roleQualified: false, hostTargetPromotion: false });
});
test('old parent-relative aliases and all eight linker references remain inert unchanged data', () => {
  assert.deepEqual(result.inertReferences.aliasReferences, documents.memberPlan.aliasReferences);
  assert.deepEqual(result.inertReferences.headerAliasClosure, documents.memberPlan.headerAliasClosure);
  assert.deepEqual(result.inertReferences.linkerInputReferences, documents.memberPlan.linkerInputReferences);
  assert.ok(result.inertReferences.aliasReferences.some(row => row.rawLinkpath.includes('..')));
  assert.equal(result.inertReferences.status, 'INERT_REFS_NOT_APPROVED_MAPS');
});
test('157 Rust declarations and 190 relocation references preserve all absences', () => {
  assert.deepEqual(result.inertReferences.rustDeclarations, documents.memberPlan.rustDeclarations);
  assert.deepEqual(result.inertReferences.gnuRelocation, documents.memberPlan.gnuRelocation);
  assert.equal(result.inertReferences.gnuRelocation.references.filter(row => row.status === 'REGULAR_FILE').length, 152);
  assert.equal(result.inertReferences.gnuRelocation.references.filter(row =>
    row.status === 'UNRESOLVED_WHOLE_SDK_CONTEXT').length, 38);
  assert.deepEqual(result.inertReferences.unknownManifestLines, []);
});
test('all five external notice bodies bind to recorded bytes and hashes without archive tuple fabrication', () => {
  assert.equal(result.externalNoticeRecords.length, 5);
  assert.equal(result.externalNoticeRecords.reduce((sum, row) => sum + row.bodyByteLength, 0), 90639);
  result.externalNoticeRecords.forEach((row, i) => {
    const observed = documents.gccNotices.collection.observations[i];
    assert.equal(row.bodySha256, hash(observed.bodyUtf8));
    assert.equal(row.bodyByteLength, Buffer.byteLength(observed.bodyUtf8));
    assert.equal(row.sourceRecordOrdinal, i + 1);
    assert.equal(row.sourceUrl, observed.requestedUrl);
    assert.equal(row.contentTypeExposed, false);
    assert.equal(row.declaredContentType, null);
    assert.equal(row.eof, true);
    assert.equal(row.imageDestination, '/usr/share/licenses/gcc-final-15.3.0/' + documents.gccNotices.noticeContext.targetNames[i]);
    assert.equal(row.applicabilityStatus, 'UNRESOLVED');
    for (const key of ['memberIndex', 'bodyOffset', 'noticeBodyUtf8', 'bodyUtf8']) assert.ok(!Object.hasOwn(row, key));
  });
  assert.ok(documents.gccNotices.collection.observations.some(row => row.bodyUtf8.includes('\f')));
});
test('GCC declaration rows retain all seven cells and unresolved domains', () => {
  assert.deepEqual(result.inertReferences.noticeContext, documents.gccNotices.noticeContext);
  for (const row of result.inertReferences.noticeContext.declarationRows) {
    assert.equal(row.cells.length, 7);
    assert.equal(row.domain, 'UNRESOLVED');
    assert.deepEqual(row, documents.gnuPreparationPlan.distributionDeclarations.rows.find(p => p.ordinal === row.ordinal));
  }
});
test('all 35 old license candidates remain path metadata rather than observed Rust notices', () => {
  assert.equal(result.inertReferences.licenseCandidateRefs.length, 35);
  assert.equal(result.inertReferences.licenseScope, 'PATH_METADATA_ONLY_NOT_OBSERVED_RUST_NOTICE_CONTENT_OR_LEGAL_COVERAGE');
});
test('missing blockers stay nonempty and CPU memory PIDs swap remain null', () => {
  assert.ok(result.missing.length > 0);
  assert.equal(result.counts.missing, result.missing.length);
  assert.ok(result.missing.every(row => row.status === 'MISSING' && row.severity === 'BLOCKING' && row.resolved === false));
  assert.deepEqual(result.jobResourceProfile, { status: 'UNSPECIFIED_BLOCKING', memoryBytes: null, cpu: null,
    pids: null, swapBytes: null });
  for (const fragment of ['NODE_HELPER', 'ACTIVE_CARGO', 'ALIAS_CLOSURE', 'NO_PYTHON', 'AF_UNIX', 'CGROUP',
    'FRESH_DESTINATION', 'FINITE_COMPILER', 'SOURCE_LICENSE', 'DAEMON_IDENTITY']) {
    assert.ok(result.blockers.some(id => id.includes(fragment)), fragment);
  }
});
test('complete ASCII JSON including final LF fits the independently recomputed output budget', () => {
  const encoded = asciiJson(result);
  assert.equal(Buffer.byteLength(encoded), result.outputAccounting.byteLength);
  assert.ok(encoded.length <= 16 * 1024 * 1024);
  assert.match(encoded, /^[\x00-\x7f]+$/);
  assert.equal(encoded.at(-1), '\n');
});

for (const [label, args] of [
  ['no arguments', []], ['two arguments', [inputs, inputs]], ['undefined', [undefined]], ['null', [null]],
  ['array', [[...Object.values(inputs)]]], ['missing key', [{ ...inputs, gccNotices: undefined }]],
  ['extra key', [{ ...inputs, extra: true }]], ['symbol key', [{ ...inputs, [Symbol('extra')]: 0 }]],
  ['inherited record', [Object.assign(Object.create({ arbitrary: true }), inputs)]],
  ['inherited four keys', [Object.create(inputs)]],
  ['proxy record', [new Proxy(inputs, { ownKeys() { throw new Error('trap'); } })]],
]) test('rejects argument envelope: ' + label, () => assert.throws(() => create(...args), /^Error: E_/));

test('argument getters never run', () => {
  let calls = 0;
  const arg = { ...inputs };
  Object.defineProperty(arg, 'gccNotices', { get() { calls++; throw new Error('getter'); } });
  assert.throws(() => create(arg), /E_ARGUMENTS/);
  assert.equal(calls, 0);
});
test('a revoked Proxy argument never runs traps', () => {
  const { proxy, revoke } = Proxy.revocable(inputs, {});
  revoke();
  assert.throws(() => create(proxy), /E_ARGUMENTS/);
});
for (const [label, value] of [
  ['string', 'untrusted'], ['Uint8Array', new Uint8Array(4)], ['DataView', new DataView(new ArrayBuffer(4))],
  ['ArrayBuffer', new ArrayBuffer(4)], ['array', [1, 2]], ['proxy Buffer', new Proxy(inputs.gccNotices, {
    get() { throw new Error('trap'); }, getPrototypeOf() { throw new Error('trap'); },
  })], ['Buffer subclass prototype', Object.setPrototypeOf(Buffer.alloc(4), Object.create(Buffer.prototype))],
]) test('rejects non-genuine Buffer: ' + label, () => assert.throws(() => create({ ...inputs, gccNotices: value }), /E_BUFFER/));

test('SharedArrayBuffer-backed Buffer is rejected before copies', () => {
  const before = instrumented.testing.copies();
  const value = Buffer.from(new SharedArrayBuffer(4));
  assert.throws(() => instrumented.createCandidateImageManifestV1({ ...inputs, gccNotices: value }), /E_BACKING/);
  assert.equal(instrumented.testing.copies(), before);
});
test('resizable ArrayBuffer-backed Buffer is rejected before copies', () => {
  const before = instrumented.testing.copies();
  const value = Buffer.from(new ArrayBuffer(4, { maxByteLength: 8 }));
  assert.throws(() => instrumented.createCandidateImageManifestV1({ ...inputs, gccNotices: value }), /E_BACKING/);
  assert.equal(instrumented.testing.copies(), before);
});
test('oversize individual input is rejected before allocating any private copy', () => {
  const before = instrumented.testing.copies();
  assert.throws(() => instrumented.createCandidateImageManifestV1({ ...inputs,
    gccNotices: Buffer.alloc(8 * 1024 * 1024 + 1) }), /E_INPUT_LIMIT/);
  assert.equal(instrumented.testing.copies(), before);
});
test('aggregate over 16MiB is rejected before allocating any private copy', () => {
  const before = instrumented.testing.copies();
  const arg = Object.fromEntries(names.map(name => [name, Buffer.alloc(5 * 1024 * 1024)]));
  assert.throws(() => instrumented.createCandidateImageManifestV1(arg), /E_INPUT_LIMIT/);
  assert.equal(instrumented.testing.copies(), before);
});
test('late pin length mismatch is rejected before allocating any private copy', () => {
  const before = instrumented.testing.copies();
  assert.throws(() => instrumented.createCandidateImageManifestV1({ ...inputs, gccNotices: Buffer.alloc(1) }), /E_PIN_LENGTH/);
  assert.equal(instrumented.testing.copies(), before);
});
test('all four hashes match before any JSON.parse invocation', () => {
  const lateInvalid = Buffer.from(inputs.gccNotices);
  lateInvalid[lateInvalid.length - 2] ^= 1;
  const nativeParse = JSON.parse;
  let calls = 0;
  try {
    JSON.parse = (...args) => { calls++; return nativeParse(...args); };
    assert.throws(() => create({ ...inputs, gccNotices: lateInvalid }), /E_PIN_HASH/);
    assert.equal(calls, 0);
  } finally { JSON.parse = nativeParse; }
});
test('custom Buffer getters and coercion hooks are ignored without numeric-key reflection', () => {
  const arg = Object.fromEntries(names.map(name => [name, Buffer.from(inputs[name])]));
  let calls = 0;
  const fail = () => { calls++; throw new Error('untrusted Buffer property'); };
  for (const value of Object.values(arg)) for (const key of ['valueOf', 'toString', 'constructor',
    'length', 'byteLength', 'byteOffset', 'buffer', 'toJSON', Symbol.iterator, Symbol.toPrimitive]) {
    Object.defineProperty(value, key, { get: fail });
  }
  const nativeKeys = Reflect.ownKeys;
  const nativeFrom = Buffer.from;
  const protectedBuffers = new Set(Object.values(arg));
  try {
    Reflect.ownKeys = value => {
      assert.ok(!protectedBuffers.has(value), 'never reflect millions of Buffer numeric keys');
      return nativeKeys(value);
    };
    Buffer.from = function (value, ...rest) {
      assert.ok(!protectedBuffers.has(value), 'never use Buffer.from on caller Buffers');
      return nativeFrom.call(this, value, ...rest);
    };
    const output = create(arg);
    assert.equal(output.sourceIdentityLedger.length, 8675);
    assert.equal(calls, 0);
  } finally { Reflect.ownKeys = nativeKeys; Buffer.from = nativeFrom; }
});
test('borrowed native copy supports a Buffer view with a nonzero byte offset', () => {
  const backing = Buffer.alloc(inputs.gccNotices.length + 32);
  const view = backing.subarray(17, 17 + inputs.gccNotices.length);
  inputs.gccNotices.copy(view);
  assert.equal(create({ ...inputs, gccNotices: view }).counts.externalNotices, 5);
});

for (const [label, bytes, code] of [
  ['invalid UTF8', Buffer.from([0xc3, 0x28, 10]), /E_UTF8/],
  ['non-ASCII raw bytes', Buffer.from('"é"\n'), /E_RAW_ENCODING/],
  ['missing LF', Buffer.from('{}'), /E_RAW_ENCODING/],
  ['malformed JSON', Buffer.from('{\n'), /E_JSON/],
  ['null root', Buffer.from('null\n'), /E_SCHEMA/],
  ['array root', Buffer.from('[]\n'), /E_SCHEMA/],
]) test('test-only pin specialization rejects ' + label, async () => {
  const arg = { ...inputs, gccNotices: bytes };
  const module = await specialize(arg);
  assert.throws(() => module.createCandidateImageManifestV1(arg), code);
});
test('fatal UTF8 for the fourth input runs before any JSON parsing', async () => {
  const arg = { ...inputs, gccNotices: Buffer.from([0xff, 10]) };
  const module = await specialize(arg);
  const native = JSON.parse;
  let calls = 0;
  try {
    JSON.parse = (...args) => { calls++; return native(...args); };
    assert.throws(() => module.createCandidateImageManifestV1(arg), /E_UTF8/);
    assert.equal(calls, 0);
  } finally { JSON.parse = native; }
});

mutation('rejects an extra root key', d => { d.memberPlan.untrusted = true; }, /E_SCHEMA/);
mutation('rejects a changed historical member profile', d => { d.memberPlan.profile = 'READY'; }, /E_MEMBER_PROFILE/);
mutation('rejects publisher self-authorization', d => { d.gccNotices.publisherAuthenticated = true; }, /E_AUTHORITY/);
mutation('rejects a changed GNU root profile', d => { d.gnuEvidence.profile = 'other'; }, /E_GNU_PROFILE/);
mutation('rejects a mock notice collection', d => { d.gccNotices.collection.mockOnly = true; }, /E_NOTICE_PROFILE/);
mutation('rejects a malformed members shape with a fixed error code', d => { d.memberPlan.members = null; }, /E_SCHEMA/);
mutation('rejects a member index rewrite', d => { d.memberPlan.members[1].index++; }, /E_MEMBER_INDEX/);
mutation('rejects an old member path escape', d => { d.memberPlan.members[1].path = '../escape'; }, /E_PATH/);
mutation('rejects a source root escape', d => { d.memberPlan.members[1].path = 'different/file'; }, /E_SOURCE_ROOT/);
mutation('rejects a duplicate source path', d => { d.memberPlan.members[1].path = d.memberPlan.members[0].path; }, /E_SOURCE_DUPLICATE/);
mutation('rejects a nonregular hash or size', d => { d.memberPlan.members[0].size = 1; }, /E_LINK/);
mutation('rejects a source member followed-link claim', d => { d.memberPlan.members[0].linkFollowed = true; }, /E_LINK/);
mutation('rejects invalid regular hash syntax', d => { d.memberPlan.members[2].bodySha256 = 'invalid'; }, /E_MEMBER_HASH/);
mutation('rejects an unexpected disposition label', d => { d.memberPlan.members[2].disposition = 'READY'; }, /E_DISPOSITION/);
mutation('rejects old disposition count rewrites', d => {
  d.memberPlan.members[2].disposition = 'C_HEADER_DATA_CANDIDATE';
}, /E_DISPOSITION_COUNTS/);
mutation('rejects swapping old dispositions even when aggregate counts match', d => {
  const a = d.memberPlan.members.find(r => r.disposition === 'UNREVIEWED_OMIT_NOT_RUNTIME_PROOF');
  const b = d.memberPlan.members.find(r => r.disposition === 'OMIT_INSTALLER_SCRIPT');
  [a.disposition, b.disposition] = [b.disposition, a.disposition];
}, /E_IDENTITY_LEDGER/);
mutation('rejects old body hash rewrite even if GNU raw metadata is changed to agree', d => {
  d.memberPlan.members[2].bodySha256 = 'a'.repeat(64);
  d.gnuEvidence.collection.roles[0].members[2].bodySha256 = 'a'.repeat(64);
}, /E_IDENTITY_LEDGER/);
for (const [field, replacement] of [['path', 'changed'], ['type', 'directory'], ['bodyOffset', 1],
  ['size', 1], ['mode', 1], ['bodySha256', 'a'.repeat(64)]]) {
  mutation('rejects GNU raw/member rejoin mismatch: ' + field, d => {
    d.gnuEvidence.collection.roles[0].members[2][field] = replacement;
  }, /E_GNU_JOIN/);
}
mutation('rejects GNU raw ordinal drift', d => { d.gnuEvidence.collection.roles[0].members[2].index++; }, /E_GNU_INDEX/);
mutation('rejects mismatched selected TARGET payload hash', d => {
  d.gnuEvidence.collection.roles[0].selected.find(row => row.index === 5982).bodySha256 = 'a'.repeat(64);
}, /E_GNU_SELECTED/);
mutation('rejects selected TARGET to HOST promotion', d => {
  d.gnuEvidence.collection.roles[0].selected.find(row => row.index === 5982).domain = 'HOST';
}, /E_GNU_SELECTED/);
mutation('rejects runtime role substitution', d => {
  d.gnuEvidence.collection.roles[0].selected.find(row => row.index === 5982).selectionRole = 'TARGET_LIBM_PROVIDER';
}, /E_RUNTIME_JOIN/);
mutation('rejects selected ELF metadata self-hash mismatch', d => {
  d.gnuEvidence.collection.roles[0].selected.find(row => row.index === 5982).metadata.requirements.inputSha256 = 'a'.repeat(64);
}, /E_GNU_SELECTED/);
mutation('rejects qualifying selected GNU candidates', d => {
  d.gnuEvidence.collection.roles[0].selected[0].qualified = true;
}, /E_AUTHORITY/);
mutation('rejects missing LF in GNU prefix metadata', d => {
  d.gnuEvidence.collection.roles[0].manifests[0].text = originalPrefix;
}, /E_PREFIX/);
mutation('rejects NUL in GNU prefix metadata', d => {
  d.memberPlan.gnuRelocation.locationPrefixData = originalPrefix + '\0\n';
}, /E_PREFIX/);
mutation('rejects parent traversal in GNU prefix metadata', d => {
  d.gnuEvidence.collection.roles[0].manifests[0].text = '/builds/../escape\n';
}, /E_PREFIX/);
mutation('rejects header supplement count drift', d => { d.gnuPreparationPlan.headerSelectionSupplement.count--; }, /E_HEADER_COUNTS/);
mutation('rejects duplicate header membership', d => {
  const a = d.gnuPreparationPlan.headerSelectionSupplement.records;
  a[1] = structuredClone(a[0]);
}, /E_HEADER_JOIN/);
for (const [field, value] of [['path', 'wrong/header.h'], ['bodyOffset', 1], ['size', 1], ['bodySha256', 'a'.repeat(64)]]) {
  mutation('rejects private header join mismatch: ' + field, d => {
    d.gnuPreparationPlan.headerSelectionSupplement.records[0][field] = value;
  }, /E_HEADER_JOIN/);
}
mutation('rejects a header supplement made copy-authorized', d => {
  d.gnuPreparationPlan.headerSelectionSupplement.records[0].copyAuthorized = true;
}, /E_HEADER_JOIN/);
mutation('rejects an unsupported selected destination prefix', d => {
  const row = d.memberPlan.members.find(r => r.disposition === 'CANDIDATE_NEEDS_QUALIFICATION');
  row.proposedRelativeDestination = 'elsewhere/helper';
  for (const decl of d.memberPlan.rustDeclarations) if (decl.artifactRole === row.artifactRole &&
    decl.matchedSourceIndex === row.index) decl.proposedRelativeDestination = row.proposedRelativeDestination;
}, /E_DESTINATION_PREFIX/);

function changeRustDestination(d, row, destination) {
  row.proposedRelativeDestination = destination;
  for (const decl of d.memberPlan.rustDeclarations) if (decl.artifactRole === row.artifactRole &&
    decl.matchedSourceIndex === row.index) decl.proposedRelativeDestination = destination;
}
mutation('rejects an exact destination collision across distinct source identities', d => {
  const rows = d.memberPlan.members.filter(r => r.artifactRole === 'rustc' && selectable.has(r.disposition));
  changeRustDestination(d, rows[1], rows[0].proposedRelativeDestination);
}, /E_DESTINATION_COLLISION/);
mutation('rejects a nondirectory placement ancestor', d => {
  const rows = d.memberPlan.members.filter(r => r.artifactRole === 'rustc' && selectable.has(r.disposition));
  changeRustDestination(d, rows[1], rows[0].proposedRelativeDestination + '/child');
}, /E_NON_DIRECTORY_ANCESTOR/);
for (const destination of ['rust/../escape', 'rust//escape', 'rust/./escape', 'rust/a\\b', 'rust/a\0b', 'rust/']) {
  mutation('rejects noncanonical image destination ' + JSON.stringify(destination), d => {
    const row = d.memberPlan.members.find(r => r.disposition === 'CANDIDATE_NEEDS_QUALIFICATION');
    changeRustDestination(d, row, destination);
  }, /E_PATH/);
}
mutation('rejects changing explicit root alias target', d => {
  d.gnuEvidence.collection.roles[0].members[515].linkpath = '../lib';
}, /E_GNU_LINK/);
mutation('rejects changed alias target even if old and raw reports agree', d => {
  d.gnuEvidence.collection.roles[0].members[515].linkpath = '../lib';
  d.memberPlan.members[515].rawLinkpath = '../lib';
}, /E_ROOT_ALIAS/);
mutation('rejects treating absent relocation rows as not needed', d => {
  d.memberPlan.gnuRelocation.references[0].status = 'MINIMAL_C_NOT_NEEDED';
}, /E_RELOCATION_JOIN/);
mutation('rejects a missing Rust declaration', d => { d.memberPlan.rustDeclarations.pop(); }, /E_DECLARATIONS/);

mutation('rejects notice target-name case or ordering drift', d => { d.gccNotices.noticeContext.targetNames.reverse(); }, /E_NOTICE_CONTEXT/);
mutation('rejects a different notice origin', d => {
  d.gccNotices.collection.observations[0].requestedUrl = 'https://example.invalid/COPYING';
}, /E_NOTICE_RECORD/);
mutation('rejects notice EOF absence', d => { d.gccNotices.collection.observations[0].eof = false; }, /E_NOTICE_RECORD/);
mutation('rejects an active notice timer', d => { d.gccNotices.collection.counts.activeTimers = 1; }, /E_NOTICE_COUNTS/);
mutation('rejects uncertain notice cleanup', d => { d.gccNotices.collection.cleanupUncertain = true; }, /E_NOTICE_PROFILE/);
mutation('rejects missing notice releases', d => { d.gccNotices.collection.counts.releases--; }, /E_NOTICE_COUNTS/);
mutation('rejects notice body byte-count drift', d => { d.gccNotices.collection.observations[0].observedBodyBytes--; }, /E_NOTICE_HASH/);
mutation('rejects recomputed body hash mismatching the fixed observed notice', d => {
  const row = d.gccNotices.collection.observations[0];
  row.bodyUtf8 = 'X' + row.bodyUtf8.slice(1);
  row.bodySha256 = hash(row.bodyUtf8);
}, /E_NOTICE_HASH/);
mutation('rejects a notice body recorded-hash mismatch', d => {
  d.gccNotices.collection.observations[0].bodySha256 = 'a'.repeat(64);
}, /E_NOTICE_HASH/);
mutation('rejects unpaired notice-body surrogates', d => {
  d.gccNotices.collection.observations[0].bodyUtf8 = '\ud800';
}, /E_SURROGATE/);
mutation('rejects disallowed notice body controls', d => {
  const row = d.gccNotices.collection.observations[0];
  row.bodyUtf8 = '\x01' + row.bodyUtf8.slice(1);
}, /E_NOTICE_BODY/);
mutation('rejects fabricated exposed notice Content-Type', d => {
  d.gccNotices.collection.observations[0].exposedHeaders.push(['content-type', 'text/plain']);
}, /E_NOTICE_MEDIA/);
mutation('rejects changing the fixed notice media exposure profile', d => {
  d.gccNotices.collection.observations[0].contentTypeExposed = true;
  d.gccNotices.collection.observations[0].declaredContentType = 'text/plain';
}, /E_NOTICE_MEDIA/);
mutation('rejects notice declaration context mismatch in the seventh cell', d => {
  d.gccNotices.noticeContext.declarationRows[0].cells[6] = 'changed';
}, /E_NOTICE_CONTEXT/);
mutation('rejects a notice record with a fabricated archive offset', d => {
  d.gccNotices.collection.observations[0].bodyOffset = 0;
}, /E_SCHEMA/);
mutation('rejects parsed toJSON data hooks', d => { d.memberPlan.members[0].toJSON = 'not a hook'; }, /E_DATA/);
mutation('rejects parsed constructor data hooks', d => { d.memberPlan.members[0].constructor = 'not a hook'; }, /E_DATA/);
mutation('rejects too many object keys', d => {
  d.memberPlan.untrusted = Object.fromEntries(Array.from({ length: 129 }, (_, i) => ['k' + i, 0]));
}, /E_TREE_LIMIT/);
mutation('rejects array length above 32768', d => { d.memberPlan.untrusted = Array(32769).fill(0); }, /E_TREE_LIMIT/);
mutation('rejects depth above 64', d => {
  let value = 0;
  for (let i = 0; i < 65; i++) value = { next: value };
  d.memberPlan.untrusted = value;
}, /E_TREE_LIMIT/);

test('source instrumentation tests aggregate node budget across multiple trees', () => {
  const { inspectData } = instrumented.testing;
  const budget = { nodes: 999998 };
  inspectData(null, budget);
  inspectData(null, budget);
  assert.throws(() => inspectData(null, budget), /E_TREE_LIMIT/);
});
test('source instrumentation rejects live getters without invoking them', () => {
  let calls = 0;
  const value = Object.defineProperty({}, 'hook', { enumerable: true, get() { calls++; } });
  assert.throws(() => instrumented.testing.inspectData(value, { nodes: 0 }), /E_DATA/);
  assert.equal(calls, 0);
});
test('source instrumentation rejects arbitrary object prototypes and Proxy trees', () => {
  for (const value of [Object.create({ inherited: true }), new Proxy({}, {})]) {
    assert.throws(() => instrumented.testing.inspectData(value, { nodes: 0 }), /E_DATA/);
  }
});
test('source instrumentation measures escaped Unicode and JSON controls before serialization', () => {
  const value = { text: 'é\ud83d\ude00\n\t\f"\\\0' };
  assert.equal(instrumented.testing.jsonBytes(value), asciiJson(value).length - 1);
});
test('source instrumentation preflights the final 16MiB output limit', () => {
  assert.throws(() => instrumented.testing.jsonBytes({ text: 'x'.repeat(16 * 1024 * 1024) }), /E_OUTPUT_LIMIT/);
});
test('source instrumentation bounds incremental metadata before array push', () => {
  const append = instrumented.testing.accumulator();
  const rows = [];
  assert.throws(() => append(rows, { text: 'x'.repeat(16 * 1024 * 1024) }), /E_OUTPUT_LIMIT/);
  assert.equal(rows.length, 0);
  append(rows, { ok: true }, 1);
  assert.throws(() => append(rows, { ok: true }, 1), /E_OUTPUT_ARRAY/);
  assert.equal(rows.length, 1);
});
test('source instrumentation bounds lexical path work to 1024 characters', () => {
  assert.equal(instrumented.testing.canonical('a'.repeat(1024)), 'a'.repeat(1024));
  assert.throws(() => instrumented.testing.canonical('a'.repeat(1025)), /E_PATH/);
  for (const path of ['/double//slash', '/a/../b', '//root', '/a\\b', '/a\n', '/a/']) {
    assert.throws(() => instrumented.testing.canonical(path, true), /E_PATH/);
  }
});
