// SPEC: _spec/tooling/native-ingress/step2.puml
import { createHash } from 'node:crypto';
import { TextDecoder, types } from 'node:util';

const SOURCE = '_spec/tooling/native-ingress/';
const MiB = 1024 * 1024;
const LIMITS = Object.freeze({ input: 8 * MiB, aggregate: 16 * MiB, output: 16 * MiB,
  nodes: 1000000, depth: 64, keys: 128, array: 32768, path: 1024, hops: 32,
  expanded: 2 * 1024 * MiB });

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const key of Object.keys(value)) freeze(value[key]);
    Object.freeze(value);
  }
  return value;
}

export const CANDIDATE_IMAGE_MANIFEST_V1_PINS = freeze({
  memberPlan: { path: SOURCE + 'toolchain-member-plan-v1.result.json', byteLength: 5679112,
    sha256: '2c4cd5218dce220e55dabe96345b97cc777c2cdc10c6e18b8d53f1357d2a94da' },
  gnuEvidence: { path: SOURCE + 'gnu-evidence-collection-v1.result.json', byteLength: 2829942,
    sha256: '01c24e73a65148b8a70c3c1d4034f86dcac8040859bc206b5cf40b784776cc22' },
  gnuPreparationPlan: { path: SOURCE + 'gnu-preparation-plan-v1.result.json', byteLength: 136598,
    sha256: '7d34c5e0308dc8397a221618dbd6e85f7c253b0ccfa8d806cb458a6b5e544f6e' },
  gccNotices: { path: SOURCE + 'bootlin-gcc-notices-v2.result.json', byteLength: 108099,
    sha256: '2d907e7bb2520918e6d27920cee0d1aba731a382056141cdf18f7d9b3198d2ed' },
});

const NAMES = Object.keys(CANDIDATE_IMAGE_MANIFEST_V1_PINS);
const FALSE_KEYS = `materializationAuthorized imageComplete closedRootfs copyAuthorized extractionAuthorized
installationAuthorized executionAllowed executableAllowed allowedForExecution roleQualified sourceAuthenticated
publisherAuthenticated callerInputsAuthenticated sourceRootAuthentication licenseComplianceVerified
licensePermissionClassified noticeApplicabilityVerified hostTargetPromotion pythonFreeSubsetVerified
noPythonRuntimeVerified runtimeProvidersQualified symbolBindingsVerified abiVerified imagePrepared imageEquivalent
nativeQualified rustReady trainingReady futureBuildGraphQualified compilerExecuted policyChanged
defaultVersionsChanged featuresChanged backendsChanged linkerSelectionChanged compilerFlagsChanged
partialProofClaimed step2Closed f9NativeProvided`.split(/\s+/);
const FALSE_FLAGS = freeze(Object.fromEntries(FALSE_KEYS.map(key => [key, false])));
const ROOT = 'x86-64--glibc--stable-2026.08-1';
const ORIGINAL_PREFIX = '/builds/buildroot.org/toolchains-builder/build/' + ROOT;
const LOCATION_HASH = 'e4df82547e211e82635d37dc97cd4bce2f5d941aebb24717a32b242811ea052f';
const SYSROOT = ROOT + '/x86_64-buildroot-linux-gnu/sysroot/';
const ROLES = ['gnu-sdk', 'cargo', 'rustc', 'rust-std', 'rustfmt-preview', 'clippy-preview'];
const ROOTS = [ROOT, 'cargo-1.95.0-x86_64-unknown-linux-gnu', 'rustc-1.95.0-x86_64-unknown-linux-gnu',
  'rust-std-1.95.0-x86_64-unknown-linux-gnu', 'rustfmt-1.95.0-x86_64-unknown-linux-gnu',
  'clippy-1.95.0-x86_64-unknown-linux-gnu'];
const ROLE_COUNTS = [8412, 68, 70, 81, 22, 22];
const REG_COUNTS = [6891, 56, 53, 74, 16, 16];
const DISPOSITIONS = freeze({ DIRECTORY_DATA: 400, UNREVIEWED_OMIT_NOT_RUNTIME_PROOF: 4661,
  ALIAS_DATA_CANDIDATE: 28, INSPECTED_TOOLCHAIN_CANDIDATE: 55, UNREVIEWED_LINK_DATA: 1127,
  OMIT_OPTIONAL_CXX_LTO_MINIMAL_C_ONLY: 40, OMIT_PYTHON_DEBUGGER_SUPPORT: 734,
  METADATA_NOT_RELOCATION_AUTHORITY: 2, C_HEADER_DATA_CANDIDATE: 1434, LICENSE_DATA_CANDIDATE: 35,
  OMIT_INSTALLER_SCRIPT: 6, DISTRIBUTION_DATA_CANDIDATE: 46, DISTRIBUTION_METADATA_OMIT_IMAGE: 40,
  CANDIDATE_NEEDS_QUALIFICATION: 6, RUST_LIBRARY_CANDIDATE: 61 });
const SELECTABLE = new Set(['INSPECTED_TOOLCHAIN_CANDIDATE', 'C_HEADER_DATA_CANDIDATE',
  'CANDIDATE_NEEDS_QUALIFICATION', 'RUST_LIBRARY_CANDIDATE']);
const IDENTITY_FIELDS = ['artifactRole', 'index', 'path', 'type', 'bodyOffset', 'size', 'bodySha256',
  'mode', 'domain', 'disposition', 'rawLinkpath', 'linkFollowed', 'sourceKind', 'requiresPayloadQualification'];
const IDENTITY_ANCHOR = '0718cff6ef553b150daa2fd5ab52a300fdae437e10c72ed957473469a499f8d5';
const ROOT_KEYS = [
  `profile scope mockOnly callerInputsAuthenticated acceptedSnapshotAssertionsMatched actualEvidenceProofClaimed
minimalCProfile copyAuthorized extractionAuthorized installationAuthorized imagePrepared imageEquivalent
runtimeProvidersQualified abiVerified symbolBindingsVerified loaderClosureVerified pythonFreeSubsetVerified
noPythonRuntimeVerified nativeQualified rustReady trainingReady sourceAuthenticated compilerExecuted rustExecuted
pythonRuntimeInvoked historicalMissingRawResultsRestored rawHistoricalResultsRestored futureBuildGraphQualified
installerInterpretationVerified completeInstallerInterpretation completeInstallMap relocationReady
licenseComplianceVerified licensePermissionClassified sourceRootAuthentication hostTargetPromotion policyChanged
defaultVersionsChanged featuresChanged backendsChanged linkerSelectionChanged compilerFlagsChanged
includeClosureVerified sysrootClosureVerified artifactCount roleOrder counts sourceRootAuthority members
rustDeclarations unknownManifestLines proposedDestinationCollisions proposedDestinationsBlocked gnuRelocation
linkerInputReferences aliasReferences headerAliasClosure hostCandidates hostCandidateScope
dependencyDeclarationComparison licenseDataScope licenseDataGaps gnuLicenseCoverage blockers constraints`,
  `profile part status mockOnly path sourceInputPins collectionCounts repoCapture sourceAccountingComplete
stageAccountingComplete archiveAccountingComplete archiveCountersScope descriptorScope startupAssumptions
realArchiveInspected rawHistoricalResultsRestored archiveExtracted extracted extractionAuthorized filesInstalled
sdkExecuted rustExecuted runtimeExecuted pythonRuntimeInvoked pythonFreeSubsetVerified nativeQualified
nativeAuthority rustReady trainingReady dockerProviderQualified installedUsability relocationReady roleSatisfied
provenanceVerified loaderClosureVerified decoderQualified abiVerified runtimeProvidersQualified qualified
providerQualified imagePrepared sourceReady rootfsReady installReady completeInstallMap
completeInstallerInterpretation hardRssBounded hardDeadlineGuaranteed processTreeBounded ioIsolated
sourceRootAuthentication ancestorRacesExcluded atomicCrashCommit storageFailureSurvival authenticatedStorage
abiQualified noPythonRuntimeVerified imageEquivalent installMapInterpreted nodeIoQualified compilerExecuted
memberExecuted jointEvidenceSetComplete collection`,
  `profile status inputBindings priorMemberPlanReference headerSelectionSupplement pluginSummary
includeFixedContext distributionTextContext distributionDeclarations sourceContext unresolvedObligations
sourceAuthenticated licenseComplianceVerified licensePermissionClassified copyAuthorized includeClosureVerified
sysrootClosureVerified relocationReady pythonFreeSubsetVerified runtimeProvidersQualified abiVerified imagePrepared
nativeQualified rustReady trainingReady publisherAuthenticated fullSourceGraphVerified urlsFollowed
readmeInstructionsExecuted sourceReady archiveExtracted extracted extractionAuthorized filesInstalled
compilerExecuted memberExecuted sdkExecuted rustExecuted runtimeExecuted pythonRuntimeInvoked
noPythonRuntimeVerified nativeAuthority qualified roleSatisfied provenanceVerified loaderClosureVerified
sourceRootAuthentication hostTargetPromotion shellEvaluated semanticInterpretation csvParsed`,
  `profile status sourcePins collection noticeContext scope sourceAuthenticated publisherAuthenticated
licenseComplianceVerified noticeApplicabilityVerified copyAuthorized pythonFreeSubsetVerified
runtimeProvidersQualified abiVerified imagePrepared nativeQualified rustReady trainingReady`,
].map(text => text.split(/\s+/));
const RUNTIME = freeze([
  [5971, 'libm.so.6', 'TARGET_LIBM_PROVIDER'], [5972, 'libdl.so.2', 'TARGET_LIBDL_PROVIDER'],
  [5973, 'libmvec.so.1', 'TARGET_LIBMVEC_PROVIDER'], [5977, 'libpthread.so.0', 'TARGET_LIBPTHREAD_PROVIDER'],
  [5980, 'librt.so.1', 'TARGET_LIBRT_PROVIDER'], [5982, 'libc.so.6', 'TARGET_LIBC_PROVIDER'],
  [5983, 'ld-linux-x86-64.so.2', 'TARGET_LOADER_PROVIDER'], [5993, 'libgcc_s.so.1', 'TARGET_LIBGCC_PROVIDER'],
]);
const NOTICE_NAMES = ['COPYING', 'COPYING.LIB', 'COPYING.RUNTIME', 'COPYING3', 'COPYING3.LIB'];
const NOTICE_ROLES = ['copying', 'copying-lib', 'runtime-exception', 'copying3', 'copying3-lib'];
const NOTICE_SIZES = [18002, 26527, 3324, 35147, 7639];
const NOTICE_HASHES = [
  '231f7edcc7352d7734a96eef0b8030f77982678c516876fcb81e25b32d68564c',
  'a9bdde5616ecdd1e980b44f360600ee8783b1f99b8cc83a2beb163a0a390e861',
  '9d6b43ce4d8de0c878bf16b54d8e7a10d9bd42b75178153e3af6a815bdc90f74',
  '8ceb4b9ee5adedde47b31e975c1d90c73ad27b6b165a1dcd80c7c545eb65b903',
  'a853c2ffec17057872340eee242ae4d96cbf2b520ae27d903e1b2fef1a5f9d1c',
];
const NOTICE_URL = 'https://toolchains.bootlin.com/downloads/releases/licenses/gcc-final-15.3.0/';
const typedPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const nativeGet = name => Object.getOwnPropertyDescriptor(typedPrototype, name).get;
const getBuffer = nativeGet('buffer');
const getLength = nativeGet('byteLength');
const getOffset = nativeGet('byteOffset');
const nativeSet = typedPrototype.set;
const getResizable = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
const bufferPrototype = Buffer.prototype;
const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

class ManifestError extends Error {}

function check(condition, code) {
  if (!condition) throw new ManifestError(code);
}

function keys(value, required, optional = []) {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), 'E_SCHEMA');
  const actual = Object.keys(value);
  check(required.every(key => Object.hasOwn(value, key)) &&
    actual.every(key => required.includes(key) || optional.includes(key)), 'E_SCHEMA');
}

function same(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every(k => Object.hasOwn(b, k) && same(a[k], b[k]));
}

function validString(text) {
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = text.charCodeAt(++i);
      check(next >= 0xdc00 && next <= 0xdfff, 'E_SURROGATE');
    } else check(c < 0xdc00 || c > 0xdfff, 'E_SURROGATE');
  }
}

function inspectData(value, budget, depth = 0) {
  check(++budget.nodes <= LIMITS.nodes && depth <= LIMITS.depth, 'E_TREE_LIMIT');
  if (typeof value === 'string') { validString(value); return; }
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'number') { check(Number.isFinite(value), 'E_DATA'); return; }
  check(typeof value === 'object' && !types.isProxy(value), 'E_DATA');
  const array = Array.isArray(value);
  check(Object.getPrototypeOf(value) === (array ? Array.prototype : Object.prototype), 'E_DATA');
  const own = Reflect.ownKeys(value);
  check(array ? value.length <= LIMITS.array && own.length === value.length + 1 : own.length <= LIMITS.keys,
    'E_TREE_LIMIT');
  for (const key of own) {
    if (array && key === 'length') continue;
    check(typeof key === 'string' && !['__proto__', 'constructor', 'prototype', 'toJSON'].includes(key), 'E_DATA');
    const desc = Object.getOwnPropertyDescriptor(value, key);
    check(Object.hasOwn(desc, 'value') && desc.enumerable, 'E_DATA');
    validString(key);
    inspectData(desc.value, budget, depth + 1);
  }
}

function inputCopies(arg, argumentCount) {
  check(argumentCount === 1 && arg && typeof arg === 'object' && !types.isProxy(arg), 'E_ARGUMENTS');
  check([Object.prototype, null].includes(Object.getPrototypeOf(arg)), 'E_ARGUMENTS');
  const own = Reflect.ownKeys(arg);
  check(own.length === 4 && own.every(k => typeof k === 'string' && NAMES.includes(k)), 'E_ARGUMENTS');
  const inputs = [];
  let total = 0;
  for (const name of NAMES) {
    const desc = Object.getOwnPropertyDescriptor(arg, name);
    check(desc && Object.hasOwn(desc, 'value'), 'E_ARGUMENTS');
    const value = desc.value;
    check(value && !types.isProxy(value) && types.isUint8Array(value) &&
      Object.getPrototypeOf(value) === bufferPrototype, 'E_BUFFER');
    const backing = getBuffer.call(value);
    check(types.isArrayBuffer(backing) && !types.isSharedArrayBuffer(backing) &&
      (!getResizable || getResizable.call(backing) === false), 'E_BACKING');
    const length = getLength.call(value);
    check(length > 0 && length <= LIMITS.input, 'E_INPUT_LIMIT');
    total += length;
    check(getOffset.call(value) >= 0, 'E_BUFFER');
    inputs.push({ value, length });
  }
  check(total <= LIMITS.aggregate, 'E_INPUT_LIMIT');
  for (let i = 0; i < inputs.length; i++) {
    check(inputs[i].length === CANDIDATE_IMAGE_MANIFEST_V1_PINS[NAMES[i]].byteLength, 'E_PIN_LENGTH');
  }
  const copies = inputs.map(({ value, length }) => {
    const copy = new Uint8Array(length);
    nativeSet.call(copy, value);
    return copy;
  });
  for (let i = 0; i < copies.length; i++) {
    check(digest(copies[i]) === CANDIDATE_IMAGE_MANIFEST_V1_PINS[NAMES[i]].sha256, 'E_PIN_HASH');
  }
  return copies;
}

function parseInputs(copies) {
  const texts = copies.map(copy => {
    let text;
    try { text = utf8.decode(copy); } catch { throw new ManifestError('E_UTF8'); }
    check(copy[copy.length - 1] === 10 && copy.every(byte => byte < 128), 'E_RAW_ENCODING');
    return text;
  });
  const budget = { nodes: 0 };
  return texts.map((text, i) => {
    let value;
    try { value = JSON.parse(text); } catch { throw new ManifestError('E_JSON'); }
    inspectData(value, budget);
    keys(value, ROOT_KEYS[i]);
    for (const key of FALSE_KEYS) if (Object.hasOwn(value, key)) check(value[key] === false, 'E_AUTHORITY');
    return value;
  });
}

function canonical(path, absolute = false) {
  check(typeof path === 'string' && path.length > 0 && path.length <= LIMITS.path &&
    !/[^\x20-\x7e]|\\/.test(path), 'E_PATH');
  check(absolute ? path.startsWith('/') && !path.startsWith('//') : !path.startsWith('/'), 'E_PATH');
  const parts = (absolute ? path.slice(1) : path).split('/');
  check(parts.length <= LIMITS.path && parts.every(p => p && p !== '.' && p !== '..'), 'E_PATH');
  return path;
}

function integer(value, max = Number.MAX_SAFE_INTEGER) {
  check(Number.isSafeInteger(value) && value >= 0 && value <= max, 'E_INTEGER');
}

function sourceRef(row) {
  return { sourceId: row.artifactRole + ':' + row.index, sourceArtifact: CANDIDATE_IMAGE_MANIFEST_V1_PINS.memberPlan.path,
    artifactRole: row.artifactRole, memberIndex: row.index, path: row.path, type: row.type,
    bodyOffset: row.bodyOffset, size: row.size, bodySha256: row.bodySha256 };
}

function noFileAncestors(map) {
  for (const path of map.keys()) {
    let end = path.lastIndexOf('/');
    let components = 0;
    while (end > 0) {
      check(++components <= LIMITS.path, 'E_PATH');
      const parent = map.get(path.slice(0, end));
      check(!parent || parent.type === 'directory', 'E_NON_DIRECTORY_ANCESTOR');
      end = path.lastIndexOf('/', end - 1);
    }
  }
}

function validateMembers(m) {
  check(m.profile === 'TOOLCHAIN_MEMBER_DISPOSITION_DATA' &&
    m.scope === 'PROPOSED_DISPOSITIONS_NOT_COPY_OR_IMAGE_AUTHORITY' && m.mockOnly === false &&
    m.actualEvidenceProofClaimed === false && m.artifactCount === 6 && same(m.roleOrder, ROLES), 'E_MEMBER_PROFILE');
  check(m.members.length === 8675 && m.counts.entries === 8675 && m.counts.regularFiles === 7106 &&
    m.counts.expandedBytes === 1148080640 && same(m.counts.byDisposition, DISPOSITIONS), 'E_MEMBER_COUNTS');
  check(m.proposedDestinationCollisions.length === 0 && m.proposedDestinationsBlocked === false,
    'E_DESTINATION_COLLISION');
  integer(m.counts.expandedBytes, LIMITS.expanded);
  const indices = new Map();
  const spaces = ROLES.map(() => new Map());
  const counts = ROLES.map(() => ({ entries: 0, regularFiles: 0, byDisposition: {} }));
  let roleOrdinal = 0;
  let totalSize = 0;
  const observed = {};
  for (const row of m.members) {
    keys(row, `artifactRole index path type size bodySha256 domain disposition reasonCodes
proposedRelativeDestination bodyOffset mode requiresPayloadQualification`.split(/\s+/),
    ['linkFollowed', 'rawLinkpath', 'sourceKind']);
    const role = ROLES.indexOf(row.artifactRole);
    check(role >= roleOrdinal && role <= roleOrdinal + 1 && role >= 0, 'E_ROLE');
    roleOrdinal = role;
    const count = counts[role];
    check(row.index === ++count.entries, 'E_MEMBER_INDEX');
    canonical(row.path);
    check(row.path === ROOTS[role] || row.path.startsWith(ROOTS[role] + '/'), 'E_SOURCE_ROOT');
    check(!spaces[role].has(row.path), 'E_SOURCE_DUPLICATE');
    check(['file', 'directory', 'symlink', 'hardlink'].includes(row.type) &&
      ['UNKNOWN', 'HOST', 'TARGET', 'DISTRIBUTION_DATA'].includes(row.domain), 'E_MEMBER_TYPE');
    integer(row.size, LIMITS.expanded);
    integer(row.bodyOffset, LIMITS.expanded);
    integer(row.bodyOffset + row.size, LIMITS.expanded);
    integer(row.mode, 0o7777);
    check(typeof row.requiresPayloadQualification === 'boolean' && Array.isArray(row.reasonCodes) &&
      row.reasonCodes.length > 0 && row.reasonCodes.every(x => typeof x === 'string'), 'E_MEMBER_SCHEMA');
    check(Object.hasOwn(DISPOSITIONS, row.disposition), 'E_DISPOSITION');
    check(row.proposedRelativeDestination === null || typeof row.proposedRelativeDestination === 'string', 'E_DESTINATION');
    if (row.type === 'file') {
      check(typeof row.bodySha256 === 'string' && /^[a-f0-9]{64}$/.test(row.bodySha256), 'E_MEMBER_HASH');
      count.regularFiles++;
    } else check(row.bodySha256 === null && row.size === 0 && row.linkFollowed === false, 'E_LINK');
    if (row.type === 'symlink' || row.type === 'hardlink') check(typeof row.rawLinkpath === 'string', 'E_LINK');
    if (Object.hasOwn(row, 'linkFollowed')) check(row.linkFollowed === false, 'E_LINK');
    totalSize += row.size;
    integer(totalSize, LIMITS.expanded);
    count.byDisposition[row.disposition] = (count.byDisposition[row.disposition] || 0) + 1;
    observed[row.disposition] = (observed[row.disposition] || 0) + 1;
    indices.set(row.artifactRole + ':' + row.index, row);
    spaces[role].set(row.path, row);
  }
  check(same(observed, DISPOSITIONS), 'E_DISPOSITION_COUNTS');
  ROLES.forEach((role, i) => {
    check(counts[i].entries === ROLE_COUNTS[i] && counts[i].regularFiles === REG_COUNTS[i] &&
      same(counts[i].byDisposition, m.counts.byRole[role].byDisposition), 'E_ROLE_COUNTS');
    noFileAncestors(spaces[i]);
  });
  return indices;
}

function validateGnu(g, m, indices) {
  check(g.profile === 'registered-split-toolchain-evidence-v1' && g.status === 'SPLIT_TOOLCHAIN_EVIDENCE_DATA' &&
    g.part === 'gnu' && g.mockOnly === false, 'E_GNU_PROFILE');
  const c = g.collection;
  check(c.profile === 'SPLIT_TOOLCHAIN_EVIDENCE_DATA' && c.state === 'SPLIT_TOOLCHAIN_EVIDENCE_DATA' &&
    c.part === 'gnu' && c.mockOnly === false && c.artifactCount === 1 && c.entries === 8412 &&
    c.regularFiles === 6891 && c.roles.length === 1 && c.expandedBytes <= LIMITS.expanded, 'E_GNU_SCHEMA');
  const role = c.roles[0];
  check(role.role === 'gnu-sdk' && role.expectedRoot === ROOT && role.entries === 8412 &&
    role.regularFiles === 6891 && role.members.length === 8412 && role.expandedBytes === c.expandedBytes,
  'E_GNU_ROLE');
  for (let i = 0; i < role.members.length; i++) {
    const raw = role.members[i];
    keys(raw, 'index path type size bodyOffset mode uid gid mtime bodySha256'.split(' '),
      ['linkpath', 'linkKind', 'linkFollowed']);
    check(raw.index === i + 1, 'E_GNU_INDEX');
    const old = indices.get('gnu-sdk:' + raw.index);
    for (const key of ['index', 'path', 'type', 'size', 'bodyOffset', 'mode', 'bodySha256']) {
      check(raw[key] === old[key], 'E_GNU_JOIN');
    }
    integer(raw.uid); integer(raw.gid);
    check(typeof raw.mtime === 'string' && /^\d+$/.test(raw.mtime), 'E_GNU_SCHEMA');
    if (old.type !== 'file') check(raw.linkFollowed === false, 'E_GNU_LINK');
    if (old.rawLinkpath !== undefined) check(raw.linkpath === old.rawLinkpath &&
      ['relative', 'absolute', 'parent-components'].includes(raw.linkKind), 'E_GNU_LINK');
  }
  check(role.selected.length === 46 && c.selectedPayloads === 46, 'E_GNU_SELECTED');
  const selected = new Map();
  for (const row of role.selected) {
    const old = indices.get('gnu-sdk:' + row.index);
    check(old && !selected.has(row.index) && row.artifactRole === 'gnu-sdk', 'E_GNU_SELECTED');
    for (const key of ['path', 'bodyOffset', 'size', 'bodySha256', 'domain']) check(row[key] === old[key], 'E_GNU_SELECTED');
    check(row.qualified === false && row.abiVerified === false && row.roleSatisfied === false, 'E_AUTHORITY');
    if (row.kind === 'ELF_EXEC_DSO') check(row.metadata.requirements.inputSha256 === row.bodySha256 &&
      row.metadata.requirements.byteLength === row.size, 'E_GNU_SELECTED');
    selected.set(row.index, row);
  }
  check(role.manifests.length === 2, 'E_PREFIX');
  const location = role.manifests.find(row => row.path === ROOT + '/share/buildroot/sdk-location');
  check(location && location.kind === 'GNU_RAW_TEXT' && location.text === ORIGINAL_PREFIX + '\n' &&
    location.bodySha256 === LOCATION_HASH && location.interpreted === false &&
    m.gnuRelocation.locationPrefixData === location.text && m.gnuRelocation.locationBodySha256 === LOCATION_HASH &&
    indices.get('gnu-sdk:279').bodySha256 === LOCATION_HASH && indices.get('gnu-sdk:279').size === 79,
  'E_PREFIX');
  return { role, selected };
}

function mapDestination(relative) {
  canonical(relative);
  if (relative.startsWith('gnu/')) return canonical(ORIGINAL_PREFIX + '/' + relative.slice(4), true);
  if (relative.startsWith('rust/')) return canonical('/opt/rust/' + relative.slice(5), true);
  throw new ManifestError('E_DESTINATION_PREFIX');
}

function escapedStringBytes(text) {
  let size = 2;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    size += c === 34 || c === 92 || [8, 9, 10, 12, 13].includes(c) ? 2 : c < 32 || c > 126 ? 6 : 1;
  }
  return size;
}

function jsonBytes(value) {
  if (value === null) return 4;
  if (typeof value === 'string') return escapedStringBytes(value);
  if (typeof value === 'boolean') return value ? 4 : 5;
  if (typeof value === 'number') return String(value).length;
  let size = 2;
  const array = Array.isArray(value);
  const own = Object.keys(value);
  for (const key of own) {
    if (size > 2) size++;
    if (!array) size += escapedStringBytes(key) + 1;
    size += jsonBytes(value[key]);
    check(size <= LIMITS.output, 'E_OUTPUT_LIMIT');
  }
  return size;
}

function accumulator() {
  let bytes = 0;
  return (array, row, max = LIMITS.array) => {
    check(array.length < max, 'E_OUTPUT_ARRAY');
    bytes += jsonBytes(row) + 1;
    check(bytes < LIMITS.output, 'E_OUTPUT_LIMIT');
    array.push(row);
    return row;
  };
}

function validateDeclarations(m, indices) {
  check(m.rustDeclarations.length === 157 && m.unknownManifestLines.length === 0 &&
    m.linkerInputReferences.length === 8 && m.aliasReferences.length === 1169 &&
    m.hostCandidates.length === 7 && m.gnuRelocation.references.length === 190 &&
    m.gnuRelocation.totalReferences === 190 && m.gnuRelocation.regularFiles === 152 &&
    m.gnuRelocation.unresolvedWholeSdkContext === 38, 'E_DECLARATIONS');
  let regular = 0;
  for (const row of m.gnuRelocation.references) {
    check(row.relocationSuccessful === false && row.assumedMinimalCBlocker === false, 'E_AUTHORITY');
    if (row.status === 'REGULAR_FILE') {
      const old = indices.get('gnu-sdk:' + row.sourceIndex);
      check(old && old.type === 'file' && old.path === row.path && old.bodySha256 === row.bodySha256 &&
        old.disposition === row.memberDisposition, 'E_RELOCATION_JOIN');
      regular++;
    } else check(row.status === 'UNRESOLVED_WHOLE_SDK_CONTEXT' && row.sourceIndex === null &&
      row.bodySha256 === null, 'E_RELOCATION_JOIN');
  }
  check(regular === 152, 'E_DECLARATIONS');
  for (const row of m.rustDeclarations) {
    const old = indices.get(row.artifactRole + ':' + row.matchedSourceIndex);
    check(old && row.artifactRole !== 'gnu-sdk' && old.path === row.sourcePath &&
      old.bodySha256 === row.bodySha256 && old.disposition === row.disposition &&
      row.status === 'DECLARED_MEMBER_MATCH_NOT_INSTALLER_PROOF', 'E_RUST_DECLARATION');
    canonical(row.proposedRelativeDestination);
    if (SELECTABLE.has(old.disposition)) check(row.proposedRelativeDestination === old.proposedRelativeDestination,
      'E_RUST_DECLARATION');
  }
}

function noticeRecords(n, p, append, destinations) {
  check(n.profile === 'BOOTLIN_GCC_NOTICES_V2_RESULT' && n.status === 'BOOTLIN_GCC_NOTICES_V2_DATA' &&
    n.collection.profile === 'registered-bootlin-gcc-notices-v2' &&
    n.collection.status === 'BOOTLIN_LICENSE_NOTICES_DATA' && n.collection.mockOnly === false &&
    n.collection.cleanupUncertain === false && n.collection.observations.length === 5, 'E_NOTICE_PROFILE');
  const context = n.noticeContext;
  check(context.packageLabel === 'gcc-final' && context.version === '15.3.0' &&
    same(context.targetNames, NOTICE_NAMES) && context.domain === 'UNRESOLVED' &&
    context.noticeApplicabilityVerified === false && context.copyAuthorized === false &&
    context.semanticInterpretation === false, 'E_NOTICE_CONTEXT');
  const declarations = p.distributionDeclarations;
  check(declarations.rows.length === 30 && declarations.rowCount === 30 &&
    same(declarations.header, ['PACKAGE', 'VERSION', 'LICENSE', 'LICENSE FILES', 'SOURCE ARCHIVE',
      'SOURCE SITE', 'DEPENDENCIES WITH LICENSES']), 'E_NOTICE_CONTEXT');
  const gcc = declarations.rows.filter(row => row.packageLabel === 'gcc-final');
  check(gcc.length === 2 && gcc[0].ordinal === 1 && gcc[1].ordinal === 8 &&
    same(context.declarationRows, gcc) && gcc.every(row => row.cells.length === 7 &&
      row.cells[0] === 'gcc-final' && row.cells[1] === '15.3.0' && row.domain === 'UNRESOLVED' &&
      row.licenseNoticeStatus === 'UNRESOLVED' && row.sourceContextStatus === 'UNRESOLVED'), 'E_NOTICE_CONTEXT');
  const counts = n.collection.counts;
  for (const key of ['requestsAttempted', 'fetchCalls', 'releases', 'eofObservations', 'completedObservations']) {
    check(counts[key] === 5, 'E_NOTICE_COUNTS');
  }
  check(counts.deliveredBytes === 90639 && counts.retainedBytes === 90639 && counts.clearedTimers === 6 &&
    counts.activeTimers === 0 && counts.rejectedChunks === 0 && counts.cancellations === 0, 'E_NOTICE_COUNTS');
  const records = [];
  let total = 0;
  n.collection.observations.forEach((row, i) => {
    keys(row, `role requestedUrl responseUrl status exposedHeaders observedBodyBytes bodySha256 bodyUtf8
contentTypeExposed declaredContentType eof utf8Validated urlsFollowed interpreted sourceKind
sourceAuthenticated licenseComplianceVerified`.split(/\s+/));
    const url = NOTICE_URL + NOTICE_NAMES[i];
    check(row.role === NOTICE_ROLES[i] && row.requestedUrl === url && row.responseUrl === url &&
      row.status === 200 && row.eof === true && row.utf8Validated === true && row.urlsFollowed === false &&
      row.interpreted === false && row.sourceKind === 'PUBLIC_LICENSE_NOTICE_TEXT' &&
      row.sourceAuthenticated === false && row.licenseComplianceVerified === false, 'E_NOTICE_RECORD');
    check(row.contentTypeExposed === false && row.declaredContentType === null &&
      row.exposedHeaders.every(pair => Array.isArray(pair) && pair.length === 2 &&
        pair.every(x => typeof x === 'string') && pair[0].toLowerCase() !== 'content-type'), 'E_NOTICE_MEDIA');
    check(typeof row.bodyUtf8 === 'string' && !/[^\x09\x0a\x0c\x0d\x20-\x7e]/.test(row.bodyUtf8), 'E_NOTICE_BODY');
    const length = row.bodyUtf8.length;
    check(length === NOTICE_SIZES[i] && length === row.observedBodyBytes &&
      row.bodySha256 === NOTICE_HASHES[i] && digest(row.bodyUtf8) === row.bodySha256, 'E_NOTICE_HASH');
    total += length;
    const imageDestination = canonical('/usr/share/licenses/gcc-final-15.3.0/' + NOTICE_NAMES[i], true);
    check(!destinations.has(imageDestination), 'E_DESTINATION_COLLISION');
    destinations.set(imageDestination, { type: 'file' });
    append(records, { ...FALSE_FLAGS, candidateOnly: true, qualificationStatus: 'UNRESOLVED',
      sourceArtifact: CANDIDATE_IMAGE_MANIFEST_V1_PINS.gccNotices.path, sourceUrl: url,
      sourceRecordOrdinal: i + 1, sourceRecordPath: 'collection.observations[' + i + '].bodyUtf8',
      bodyByteLength: length, bodySha256: row.bodySha256, imageDestination, kind: 'LICENSE_NOTICE_TEXT',
      contentTypeExposed: row.contentTypeExposed, declaredContentType: row.declaredContentType, eof: row.eof,
      declarationOrdinals: [1, 8], applicabilityStatus: 'UNRESOLVED', bodyRetention: 'PINNED_INPUT_UTF8_VALUE' });
  });
  check(total === 90639, 'E_NOTICE_COUNTS');
  return records;
}

export function createCandidateImageManifestV1(arg) {
  try { return createManifest(arg, arguments.length); }
  catch (error) {
    if (error instanceof ManifestError) throw error;
    throw new ManifestError('E_SCHEMA');
  }
}

function createManifest(arg, argumentCount) {
  const copies = inputCopies(arg, argumentCount);
  const [m, g, p, n] = parseInputs(copies);
  const indices = validateMembers(m);
  const { role, selected } = validateGnu(g, m, indices);
  validateDeclarations(m, indices);
  check(p.profile === 'GNU_PREPARATION_PLAN_V1' && p.status === 'PROPOSED_DATA_SUPPLEMENT' &&
    p.inputBindings.gnuEvidence.path === CANDIDATE_IMAGE_MANIFEST_V1_PINS.gnuEvidence.path &&
    p.inputBindings.gnuEvidence.byteLength === CANDIDATE_IMAGE_MANIFEST_V1_PINS.gnuEvidence.byteLength &&
    p.inputBindings.gnuEvidence.sha256 === CANDIDATE_IMAGE_MANIFEST_V1_PINS.gnuEvidence.sha256 &&
    p.priorMemberPlanReference.sha256 === CANDIDATE_IMAGE_MANIFEST_V1_PINS.memberPlan.sha256,
  'E_PREPARATION_BINDING');
  const append = accumulator();
  const placements = [];
  const sourceIdentityLedger = [];
  const selectionLedger = [];
  const destinations = new Map();
  const placementCounts = { originalSelected: 0, privateHeaders: 0, runtimeRoots: 0, identicalDeduplications: 0 };
  function placement(row, destination, reason, evidenceRefs) {
    canonical(destination, true);
    check(!destinations.has(destination), 'E_DESTINATION_COLLISION');
    const result = { ...FALSE_FLAGS, ...sourceRef(row), placementId: 'placement:' + (placements.length + 1),
      domain: row.domain, sourceDisposition: row.disposition, imageDestination: destination,
      selectionReason: reason, evidenceRefs, originalMode: row.mode,
      modeStatus: 'SOURCE_METADATA_NOT_EXECUTION_PERMISSION', qualificationStatus: 'UNRESOLVED',
      requiresPayloadQualification: row.requiresPayloadQualification, candidateOnly: true,
      prefixStatus: 'PROPOSED_NOT_MATERIALIZATION_ROOT',
      ...(reason === 'PRIVATE_HEADER_SUPPLEMENT' ? { supplementDeclaredDomain: 'TARGET' } : {}) };
    destinations.set(destination, result);
    return append(placements, result);
  }
  for (const row of m.members) {
    append(sourceIdentityLedger, { ...row, ...sourceRef(row), sourceRoot: ROOTS[ROLES.indexOf(row.artifactRole)] });
    const chosen = SELECTABLE.has(row.disposition) && row.proposedRelativeDestination !== null;
    if (chosen) {
      check(row.type === 'file', 'E_SELECTED_TYPE');
      if (row.artifactRole === 'gnu-sdk') check(row.proposedRelativeDestination ===
        'gnu/' + row.path.slice(ROOT.length + 1), 'E_DESTINATION_SOURCE');
      placement(row, mapDestination(row.proposedRelativeDestination), 'ORIGINAL_CONSERVATIVE_ALLOWLIST',
        [{ sourceArtifact: CANDIDATE_IMAGE_MANIFEST_V1_PINS.memberPlan.path, memberIndex: row.index,
          artifactRole: row.artifactRole }]);
      placementCounts.originalSelected++;
    }
    append(selectionLedger, { sourceId: row.artifactRole + ':' + row.index,
      sourceDisposition: row.disposition, selectionStatus: chosen ? 'ORIGINAL_CANDIDATE' : 'EXCLUDED_FROM_ORIGINAL_SELECTION',
      reason: chosen ? 'ALLOWLIST_AND_NON_NULL_DESTINATION' : SELECTABLE.has(row.disposition) ?
        'NO_PROPOSED_DESTINATION' : 'DISPOSITION_NOT_ALLOWLISTED', omissionIsNoPythonProof: false });
  }
  const supplement = p.headerSelectionSupplement;
  check(supplement.count === 150 && supplement.bytes === 2907751 && supplement.records.length === 150,
    'E_HEADER_COUNTS');
  let headerBytes = 0;
  const headerIndices = new Set();
  for (const header of supplement.records) {
    keys(header, `artifactRole index path bodyOffset size bodySha256 domain disposition
proposedRelativeDestination copyAuthorized includeClosureVerified`.split(/\s+/));
    const old = indices.get('gnu-sdk:' + header.index);
    check(old && header.artifactRole === 'gnu-sdk' && !headerIndices.has(header.index) && old.type === 'file' &&
      old.disposition === 'UNREVIEWED_OMIT_NOT_RUNTIME_PROOF' && header.disposition === 'C_HEADER_CANDIDATE' &&
      header.domain === 'TARGET' && header.copyAuthorized === false && header.includeClosureVerified === false,
    'E_HEADER_JOIN');
    for (const key of ['path', 'bodyOffset', 'size', 'bodySha256']) check(header[key] === old[key], 'E_HEADER_JOIN');
    check(header.proposedRelativeDestination === 'gnu/' + old.path.slice(ROOT.length + 1) &&
      old.path.startsWith(ROOT + '/lib/gcc/x86_64-buildroot-linux-gnu/15.3.0/include/'), 'E_HEADER_JOIN');
    headerIndices.add(header.index);
    headerBytes += header.size;
    placement(old, mapDestination(header.proposedRelativeDestination), 'PRIVATE_HEADER_SUPPLEMENT',
      [{ sourceArtifact: CANDIDATE_IMAGE_MANIFEST_V1_PINS.gnuPreparationPlan.path,
        recordPath: 'headerSelectionSupplement.records', memberIndex: header.index }]);
    placementCounts.privateHeaders++;
  }
  check(headerBytes === 2907751, 'E_HEADER_COUNTS');
  const runtimeRoleCandidates = [];
  let runtimeBytes = 0;
  for (const [index, name, selectionRole] of RUNTIME) {
    const old = indices.get('gnu-sdk:' + index);
    const raw = role.members[index - 1];
    const observation = selected.get(index);
    check(old && raw.path === SYSROOT + 'lib/' + name && old.domain === 'TARGET' &&
      observation && observation.kind === 'ELF_EXEC_DSO' && observation.domain === 'TARGET' &&
      observation.selectionRole === selectionRole, 'E_RUNTIME_JOIN');
    runtimeBytes += old.size;
    const originalDestination = mapDestination(old.proposedRelativeDestination);
    const existing = destinations.get(originalDestination);
    if (existing) {
      check(existing.sourceId === 'gnu-sdk:' + index && existing.bodySha256 === old.bodySha256 &&
        existing.bodyOffset === old.bodyOffset && existing.size === old.size, 'E_DESTINATION_COLLISION');
      placementCounts.identicalDeduplications++;
    } else placement(old, originalDestination, 'RUNTIME_ORIGINAL_PREFIX', []);
    const rootDestination = canonical('/' + raw.path.slice(SYSROOT.length), true);
    const rootPlacement = placement(old, rootDestination, 'TARGET_BYTES_HOST_RUNTIME_PROPOSAL',
      [{ sourceArtifact: CANDIDATE_IMAGE_MANIFEST_V1_PINS.gnuEvidence.path, recordPath: 'collection.roles[0].selected',
        memberIndex: index, bodySha256: old.bodySha256 }]);
    placementCounts.runtimeRoots++;
    append(runtimeRoleCandidates, { ...FALSE_FLAGS, candidateOnly: true, qualificationStatus: 'UNRESOLVED',
      candidateId: 'HOST_RUNTIME_PROPOSAL:' + index, sourceRef: sourceRef(old), sourceDomain: 'TARGET',
      proposedDomain: 'HOST', bodySha256: old.bodySha256, size: old.size, rootDestination,
      placementId: rootPlacement.placementId, runtimeFamily: name === 'libgcc_s.so.1' ? 'LIBGCC' : 'GLIBC',
      requirementsRef: { sourceArtifact: CANDIDATE_IMAGE_MANIFEST_V1_PINS.gnuEvidence.path,
        memberIndex: index, inputSha256: old.bodySha256 }, qualificationRequired: ['LOAD', 'ISA', 'SYMBOLS', 'PRIVATE_ABI'] });
  }
  check(runtimeBytes === 6183544, 'E_RUNTIME_COUNTS');
  const rootAliasProposals = [];
  for (const [index, relative, destination] of [[516, 'lib64', '/lib64'], [4121, 'usr/lib64', '/usr/lib64']]) {
    const raw = role.members[index - 1];
    const old = indices.get('gnu-sdk:' + index);
    check(raw.path === SYSROOT + relative && raw.type === 'symlink' && raw.linkpath === 'lib' &&
      raw.linkKind === 'relative' && raw.linkFollowed === false && old.rawLinkpath === 'lib', 'E_ROOT_ALIAS');
    canonical(destination, true);
    check(!destinations.has(destination), 'E_DESTINATION_COLLISION');
    destinations.set(destination, { type: 'symlink' });
    append(rootAliasProposals, { ...FALSE_FLAGS, ...sourceRef(old), candidateOnly: true,
      qualificationStatus: 'UNRESOLVED', imageDestination: destination, relativeTarget: 'lib',
      targetResolution: 'PROPOSED_NOT_PROVED', aliasCreationAuthorized: false, aliasFollowed: false,
      lexicalTargetProposal: destination === '/lib64' ? '/lib' : '/usr/lib' }, 128);
  }
  const externalNoticeRecords = noticeRecords(n, p, append, destinations);
  noFileAncestors(destinations);
  for (const destination of destinations.keys()) check(destination !== ORIGINAL_PREFIX &&
    !ORIGINAL_PREFIX.startsWith(destination + '/') && destination !== '/opt/rust' &&
    !'/opt/rust'.startsWith(destination + '/'), 'E_PREFIX_NAMESPACE');
  const identityHash = createHash('sha256');
  for (const row of m.members) for (const field of IDENTITY_FIELDS) {
    const value = row[field];
    const text = value === undefined ? 'u' : value === null ? 'n' : typeof value + ':' + value;
    identityHash.update(text.length + ':' + text);
  }
  check(identityHash.digest('hex') === IDENTITY_ANCHOR, 'E_IDENTITY_LEDGER');
  const missing = [
    'ROOTFS_FULL_CONTENT_AND_UNSELECTED_MEMBERS', 'FRESH_DESTINATION_APPROVAL',
    'NODE_HELPER_CONTROLLER_CLI_EXACT_BYTES_AND_RUNTIME_CLOSURE',
    'ACTIVE_CARGO_HOST_TARGET_SOURCES_CHECKSUMS_LICENSES_BUILDSCRIPTS_PROCMACROS_GRAPH',
    'HOST_CANDIDATE_ROLE_QUALIFICATION_ISA_SYMBOLS_PRIVATE_ABI_LOADING',
    'GCC_WRAPPER_HELPERS_SYSROOT_HEADERS_LINKER_SEARCH_AND_ALIAS_CLOSURE', 'NO_PYTHON_WHOLE_IMAGE_PROOF',
    'RUST_HELPER_ROLE_AND_STDLIB_GRAPHS', 'SOURCE_LICENSE_PACKAGE_CORRESPONDENCE_BEYOND_NOTICE_CONTEXT',
    'DAEMON_IDENTITY_AND_AGENT_HOST_PATH_MAPPING', 'UNSPECIFIED_JOB_MEMORY_CPU_PIDS_SWAP_PROFILE',
    'FILESYSTEM_SOCKET_AF_UNIX_NETWORK_EXEC_DENIAL_AND_EFFECTIVE_LIMITS',
    'NATIVE_EXTERNAL_ORIGINAL_CLOCK_DESCENDANT_CLEANUP_AND_EMPTY_CGROUP',
    'FINITE_COMPILER_FIXTURES_AND_FROZEN_OFFLINE_WORKSPACE',
  ].map(id => ({ id, status: 'MISSING', severity: 'BLOCKING', resolved: false }));
  const result = {
    profile: 'CANDIDATE_IMAGE_MANIFEST_V1', status: 'PROPOSED_INCOMPLETE', ...FALSE_FLAGS,
    candidateOnly: true, scope: 'UNIFIED_SDK_RUNTIME_PLANNING_ONLY',
    inputBindings: Object.fromEntries(NAMES.map(name => [name, { ...CANDIDATE_IMAGE_MANIFEST_V1_PINS[name],
      bytesVerified: true, sha256Verified: true, identityMeaning: 'RAW_BYTE_IDENTITY_ONLY',
      sourceAuthenticated: false, publisherAuthenticated: false, sourceRootAuthentication: false }])),
    prefixes: { gnu: { imagePrefix: ORIGINAL_PREFIX, rawLocationText: ORIGINAL_PREFIX + '\n',
      rawLocationByteLength: 79, rawLocationSha256: LOCATION_HASH, status: 'PROPOSED_NOT_MATERIALIZATION_ROOT',
      hostMount: false, sourceRootAuthentication: false },
    rust: { imagePrefix: '/opt/rust', prefixStatus: 'PROPOSED_NOT_MATERIALIZATION_ROOT',
      hostMount: false, materializationAuthorized: false } },
    sourceIdentityLedger, selectionLedger, candidatePlacements: placements, runtimeRoleCandidates,
    rootAliasProposals, externalNoticeRecords,
    unusedHostCandidates: m.hostCandidates.map(record => ({ record, usageStatus: 'UNUSED_PROPOSED_IMAGE',
      hostTargetPromotion: false, roleQualified: false, allowedForExecution: false })),
    inertReferences: { status: 'INERT_REFS_NOT_APPROVED_MAPS', qualificationStatus: 'UNRESOLVED',
      aliasReferences: m.aliasReferences, headerAliasClosure: m.headerAliasClosure,
      linkerInputReferences: m.linkerInputReferences, gnuRelocation: m.gnuRelocation,
      rustDeclarations: m.rustDeclarations, unknownManifestLines: m.unknownManifestLines,
      dependencyDeclarationComparison: m.dependencyDeclarationComparison,
      noticeContext: n.noticeContext, distributionDeclarations: p.distributionDeclarations,
      supplementaryHelperProofStatus: 'NOT_READ_OR_VERIFIED_BY_THIS_MODULE',
      licenseCandidateRefs: m.members.filter(row => row.disposition === 'LICENSE_DATA_CANDIDATE').map(sourceRef),
      licenseScope: 'PATH_METADATA_ONLY_NOT_OBSERVED_RUST_NOTICE_CONTENT_OR_LEGAL_COVERAGE' },
    interpreterProposal: { path: '/lib64/ld-linux-x86-64.so.2',
      lexicalTargetProposal: '/lib/ld-linux-x86-64.so.2', status: 'PROPOSED_NOT_REALPATH',
      allowedForExecution: false, roleQualified: false, hostTargetPromotion: false },
    jobResourceProfile: { status: 'UNSPECIFIED_BLOCKING', memoryBytes: null, cpu: null, pids: null, swapBytes: null },
    missing, blockers: missing.map(row => row.id),
    deduplicationRule: 'ONLY_IDENTICAL_SOURCE_TUPLE_AT_EXISTING_RUNTIME_ORIGINAL_PREFIX_PLACEMENT',
    counts: { sourceIdentities: sourceIdentityLedger.length, roles: 6, regularFiles: 7106,
      candidatePlacements: placements.length, ...placementCounts, runtimeRoleCandidates: 8,
      runtimeCandidateBytes: runtimeBytes, rootAliasProposals: 2, externalNotices: 5, noticeBytes: 90639,
      selectionLedger: selectionLedger.length, originalExclusions: selectionLedger.filter(row =>
        row.selectionStatus === 'EXCLUDED_FROM_ORIGINAL_SELECTION').length,
      rustDeclarations: 157, relocationRegular: 152, relocationAbsentUnresolved: 38,
      licensePathCandidates: 35, unusedHostCandidates: 7, missing: missing.length },
    constraints: { ...LIMITS }, outputAccounting: { encoding: 'ASCII_ESCAPED_JSON_PLUS_LF', byteLength: 0 },
  };
  inspectData(result, { nodes: 0 });
  for (let i = 0; i < 4; i++) {
    const bytes = jsonBytes(result) + 1;
    check(bytes <= LIMITS.output, 'E_OUTPUT_LIMIT');
    if (bytes === result.outputAccounting.byteLength) return freeze(result);
    result.outputAccounting.byteLength = bytes;
  }
  throw new ManifestError('E_OUTPUT_ACCOUNTING');
}
