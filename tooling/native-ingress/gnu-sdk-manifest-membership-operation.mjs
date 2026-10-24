// SPEC: _spec/tooling/native-ingress/gnu-sdk-manifest-membership.puml
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { types } from 'node:util';

const descriptors = [
  ['tar-inventory', 15548, '050d629963fdf89bd5dff7639260c7de30b08be46320b7b6bb7ed4dac6bb8139'],
  ['elf-metadata', 19842, 'b223a655eae572137891a2c6efafee16887a2478fc91052f0092b48dfd65de85'],
  ['xz-staging', 16688, 'f75c21a58bb67e6ab3f8b1dafd090e11ac2d3a70f017da35afb81b00761b71b4'],
  ['gnu-sdk-inventory', 23261, 'bd2fc43633ca3b8f0c485eddb68a1b7505002edecd70eee4bf9cc661f588ef29'],
  ['gnu-sdk-inventory-v2-operation', 10102, '39da4bc85f6e7eaaecb0abd157d59ec4c2dcb6191a19c9247cbadd0080ae767a'],
  ['gnu-sdk-inventory-v4-operation', 12608, '2ea3c1bfe71676c37d01a05b64f9d3f11e4a7d7d93541cfdc4707a378bae17db'],
  ['sdk-driver-controls', 18551, '3e9acafe464aa0a4418d5c9c7522683c2948035b93f95c96a290b8fdb264ec93'],
  ['gnu-sdk-driver-controls-v2-operation', 16909, 'c87985fb61eeba3e6188a5dc5fa8f3fbe6c3db856c9ab4e745debad39be728e1'],
];
export const MANIFEST_MEMBERSHIP_SOURCE_PINS = Object.freeze({
  originalCollector: Object.freeze({ bytes: 18551, sha256: '3e9acafe464aa0a4418d5c9c7522683c2948035b93f95c96a290b8fdb264ec93' }),
  aliasCollector: Object.freeze({ bytes: 18643, sha256: 'b156311ac91f5a9078124a70b1388f7ea1cb6986fa06508a71eb54cf2a3eb69d' }),
  branchCollector: Object.freeze({ bytes: 18836, sha256: '5fbec232e273f85489c4ac1772bf3a6998424adc98871fb0143b6f7f0b063614' }),
  membershipCollector: Object.freeze({ bytes: 26517, sha256: '0b84b7c5a3f3645d15876167e3001cea687aa820b64fa2c2bd406279a36effe3' }),
  linkedCollector: Object.freeze({ bytes: 47286, sha256: 'ee562343f3bbb2409e6503de076db7dac3b15ba25e40a4abed3d9576ac89da11' }),
  linkedPipeline: Object.freeze({ bytes: 86321, sha256: '23ab71474cb22261dd7c7835aa72377488cd583d22536e47ee44f55aef949857' }),
  controlsCore: Object.freeze({ bytes: 23264, sha256: 'ac4aba7af508898603f7b19e37c9d31b5af488dab14192dd6560186b7654c12c' }),
  transformedTar: Object.freeze({ bytes: 15568, sha256: '56cac49b3cfe51dbf2a7f7d1f4a0d877ae8773f940585ebea72740373689fae2' }),
});
const membershipPatches = [
  ["function inspection(profile) {", "function inspection(profile) {\n  const membershipState = newMembershipMetadata(profile.expected.entries, profile.limits.maxLookupKeyBytes);"],
  ["    erase(); if (accepted) accepted.lookup.clear();", "    erase(); releaseMembershipMetadata(membershipState); if (accepted) accepted.lookup.clear();"],
  ["            const events = parser.feed(bytes); current.hash.update(input);", "            const events = parser.feed(bytes);\n            if (members) retainMembershipEvents(membershipState, events);\n            current.hash.update(input);"],
  ["        memberAccepted = true; phase = 'members-accepted'; return accepted.metadata;", "        acceptMembershipMetadata(membershipState, accepted.lookup, accepted.metadata.summary);\n        memberAccepted = true; phase = 'members-accepted'; return accepted.metadata;"],
  ["        const prefix = parseSdkLocation(current.buffers[1]), paths = manifest(current.buffers[2], profile.limits.maxManifestLines);\n        const joined = []; let bytes = 2;\n        for (const relativePath of paths) {\n          const span = accepted.lookup.get(root + '/' + relativePath);\n          if (!span) fail('E_REFERENCE');\n          const entry = Object.freeze({ relativePath, ...span });\n          bytes += Buffer.byteLength(JSON.stringify(entry)) + (joined.length ? 1 : 0);\n          if (bytes > profile.limits.maxJoinedBytes) fail('E_OUTPUT');\n          joined.push(entry);\n        }", "        requireMembershipManifest(current.buffers[2]);\n        const prefix = parseSdkLocation(current.buffers[1]), paths = manifest(current.buffers[2], profile.limits.maxManifestLines);\n        const membership = classifyManifestMembership(membershipState, paths, captureAccepted, profile.limits.maxJoinedBytes);"],
  ["relocs: Object.freeze({ ...refs[2], paths, joined: Object.freeze(joined), interpretation: 'DATA_ONLY_SINGLE_LEADING_DOT_ALIAS_PATHS_NOT_MUTATION_AUTHORITY' })", "relocs: Object.freeze({ ...refs[2], paths, observations: membership.observations, histogram: membership.histogram, totalReferences: membership.totalReferences, interpretation: 'MANIFEST_MEMBERSHIP_DATA_NOT_RELOCATION_AUTHORITY', relocationReady: false })"],
  ["        erase(); accepted.lookup.clear(); accepted = null; current = null; phase = 'released'; return result;", "        erase(); releaseMembershipMetadata(membershipState); accepted.lookup.clear(); accepted = null; current = null; phase = 'released'; return result;"]
].map(Object.freeze);
const membershipAppendix = `
// WHAT: Complete archive metadata and ordered data-only manifest membership observations.
const membershipLimits = Object.freeze({ maxEntries: 8412, maxMetadataBytes: 4194304, maxSpanBytes: 4194304, maxReferences: 4096, maxAncestors: 16, maxObservationBytes: 1048576 });
const membershipManifestPin = Object.freeze({ byteLength: 9367, sha256: '60f1b6054d8f01670a9f5ac3ac0181f7148e37be91025c2c4f111df30047305e' });
function newMembershipMetadata(expectedEntries, maxBytes) {
  return { entries: new Map(), spans: new Map(), links: [], expectedEntries, maxBytes: Math.min(4194304, maxBytes),
    recordCount: 0, serializedBytes: 2, complete: true, accepted: false, failureCode: null };
}
function membershipOwn(value, key, required = true) {
  if (!value || typeof value !== 'object' || types.isProxy(value)) fail('E_INPUT');
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor) { if (required) fail('E_INPUT'); return undefined; }
  if (!Object.hasOwn(descriptor, 'value')) fail('E_INPUT');
  return descriptor.value;
}
function membershipEntry(value) {
  const index = membershipOwn(value, 'index'), path = membershipOwn(value, 'path');
  const type = membershipOwn(value, 'type'), size = membershipOwn(value, 'size');
  if (!Number.isSafeInteger(index) || index < 1 || index > membershipLimits.maxEntries ||
    typeof path !== 'string' || !path || Buffer.byteLength(path) > 1024 ||
    !['file', 'directory', 'symlink', 'hardlink'].includes(type) || !Number.isSafeInteger(size) || size < 0 || size > 505333760) fail('E_INPUT');
  const linkpath = membershipOwn(value, 'linkpath', false), linkKind = membershipOwn(value, 'linkKind', false);
  if (type === 'hardlink' || type === 'symlink') {
    if (size !== 0 || typeof linkpath !== 'string' || !linkpath || Buffer.byteLength(linkpath) > 1024 ||
      !['absolute', 'parent-components', 'relative'].includes(linkKind)) fail('E_INPUT');
    return Object.freeze({ index, path, type, size, linkpath, linkKind });
  }
  if (linkpath !== undefined || linkKind !== undefined || (type === 'directory' && size !== 0)) fail('E_INPUT');
  return Object.freeze({ index, path, type, size });
}
function retainMembershipEvents(state, events) {
  if (!state.complete || state.accepted) return;
  let failureCode = 'E_INPUT';
  try {
    if (types.isProxy(events) || !Array.isArray(events)) fail('E_INPUT');
    const length = membershipOwn(events, 'length');
    if (!Number.isSafeInteger(length) || length > membershipLimits.maxEntries - state.recordCount) fail('E_INPUT');
    for (let i = 0; i < length; i++) {
      const entry = membershipEntry(membershipOwn(events, String(i)));
      if (entry.index !== state.recordCount + 1 || entry.index > state.expectedEntries || state.entries.has(entry.path)) fail('E_INPUT');
      const cost = Buffer.byteLength(JSON.stringify([entry.path, entry])) + (state.recordCount ? 1 : 0);
      if (cost > state.maxBytes - state.serializedBytes) { failureCode = 'E_OUTPUT'; fail('E_OUTPUT'); }
      state.entries.set(entry.path, entry); state.recordCount++; state.serializedBytes += cost;
    }
  } catch {
    state.complete = false; state.accepted = false; state.failureCode = failureCode; state.entries.clear();
  }
}
function acceptMembershipMetadata(state, spans, summary) {
  if (!state.complete) fail(state.failureCode ?? 'E_INPUT');
  if (!Number.isSafeInteger(state.expectedEntries) || state.expectedEntries > membershipLimits.maxEntries ||
    summary.entries !== state.expectedEntries || state.recordCount !== state.expectedEntries || state.entries.size !== state.expectedEntries) fail('E_SPAN');
  let files = 0, spanBytes = 2;
  const links = [];
  for (const entry of state.entries.values()) {
    const value = spans.get(entry.path);
    if (entry.type !== 'file') {
      if (value !== undefined) fail('E_SPAN');
      if (entry.type === 'symlink' || entry.type === 'hardlink') links.push(entry);
      continue;
    }
    if (value === undefined) fail('E_SPAN');
    const span = fields(value, ['index', 'path', 'bodyOffset', 'size'], true);
    if (span.index !== entry.index || span.path !== entry.path || span.size !== entry.size ||
      !Number.isSafeInteger(span.bodyOffset) || span.bodyOffset < 512 || span.bodyOffset > summary.expandedBytes ||
      span.size > summary.expandedBytes - span.bodyOffset) fail('E_SPAN');
    spanBytes += Buffer.byteLength(JSON.stringify(span)) + (files ? 1 : 0);
    if (spanBytes > membershipLimits.maxSpanBytes) fail('E_OUTPUT');
    state.spans.set(entry.path, Object.freeze({ ...span })); files++;
  }
  if (files !== spans.size) fail('E_SPAN');
  state.links = Object.freeze(links); state.accepted = true;
}
function requireMembershipManifest(bytes) {
  const input = view(bytes);
  if (input.length !== membershipManifestPin.byteLength || createHash('sha256').update(input).digest('hex') !== membershipManifestPin.sha256) fail('E_HASH');
}
function membershipEncodedSizes(value) {
  const json = JSON.stringify(value);
  return { utf8: Buffer.byteLength(json), ascii: Buffer.byteLength(json.replace(/[^\\x00-\\x7f]/g, ch => '\\\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'))) };
}
function classifyManifestMembership(state, paths, acceptedSecondPass, maxBytes) {
  if (acceptedSecondPass !== true || !state.complete || !state.accepted || state.recordCount !== state.expectedEntries || state.entries.size !== state.expectedEntries) fail('E_PHASE');
  const literals = items(paths, membershipLimits.maxReferences), seen = new Set(), observations = [];
  const histogram = { ANCESTOR_LINK: 0, REGULAR_FILE: 0, NONREGULAR_ENTRY: 0, ABSENT_FROM_ARCHIVE: 0 };
  const limit = Math.min(membershipLimits.maxObservationBytes, maxBytes);
  let utf8Bytes = 2, asciiBytes = 2;
  for (const relativePath of literals) {
    if (typeof relativePath !== 'string') fail('E_INPUT');
    literalPath(relativePath, 'E_MANIFEST');
    const rootedArchivePath = root + '/' + relativePath;
    if (Buffer.byteLength(rootedArchivePath) > 1024 || seen.has(relativePath)) fail('E_MANIFEST');
    seen.add(relativePath);
    const exactEntry = state.entries.get(rootedArchivePath) ?? null, regularSpan = state.spans.get(rootedArchivePath) ?? null, ancestorLinks = [];
    for (const entry of state.links) {
      if (rootedArchivePath.startsWith(entry.path + '/')) {
        if (ancestorLinks.length >= membershipLimits.maxAncestors) fail('E_OUTPUT');
        ancestorLinks.push(entry);
      }
    }
    const status = ancestorLinks.length ? 'ANCESTOR_LINK' : exactEntry?.type === 'file' ? 'REGULAR_FILE' : exactEntry ? 'NONREGULAR_ENTRY' : 'ABSENT_FROM_ARCHIVE';
    if (exactEntry?.type === 'file' && regularSpan === null) fail('E_SPAN');
    const row = Object.freeze({ relativePath, rootedArchivePath, status, exactEntry, regularSpan, ancestorLinks: Object.freeze(ancestorLinks) });
    const cost = membershipEncodedSizes(row), comma = observations.length ? 1 : 0;
    utf8Bytes += cost.utf8 + comma; asciiBytes += cost.ascii + comma;
    if (utf8Bytes > limit || asciiBytes > limit) fail('E_OUTPUT');
    observations.push(row); histogram[status]++;
  }
  if (observations.length !== literals.length || Object.values(histogram).reduce((sum, count) => sum + count, 0) !== literals.length) fail('E_OUTPUT');
  const result = Object.freeze({ observations: Object.freeze(observations), histogram: Object.freeze(histogram), totalReferences: literals.length });
  const sizes = membershipEncodedSizes(result);
  if (sizes.utf8 > limit || sizes.ascii > limit) fail('E_OUTPUT');
  return result;
}
function releaseMembershipMetadata(state) { state.entries.clear(); state.spans.clear(); state.links = []; state.accepted = false; }
`;
const identity = {
  root: { dev: '28', ino: '13894', mode: '16832', uid: '1000', gid: '1000', nlink: '2', size: '4096',
    mtimeNs: '1792805590304271582', ctimeNs: '1792805590304271582' },
  file: { dev: '29', ino: '1211332', mode: '33152', uid: '1000', gid: '1000', nlink: '1', size: '102296280',
    mtimeNs: '1792805605531830652', ctimeNs: '1792805605531830652' },
};
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const codes = new Set(['E_SOURCE_PIN', 'E_RECEIPT', 'E_INPUT', 'E_METADATA', 'E_BINDING', 'E_IO', 'E_CLOSE',
  'E_LENGTH', 'E_HASH', 'E_PREREQUISITE', 'E_SPAWN', 'E_PIPE', 'E_DECODER', 'E_TAR', 'E_OUTPUT',
  'E_DEADLINE', 'E_CLEANUP', 'E_CLOCK', 'E_LIMIT', 'E_PRELOAD', 'E_LAYOUT', 'E_PHASE', 'E_SUMMARY',
  'E_TARGET', 'E_SPAN', 'E_TEXT', 'E_LOCATION', 'E_MANIFEST', 'E_REFERENCE', 'E_ELF', 'E_RANGE',
  'E_PROGRAM_HEADERS', 'E_INTERPRETER', 'E_DYNAMIC', 'E_STRING_TABLE', 'E_STRING', 'E_VERSIONS', 'E_NOTES', 'E_PROPERTIES', 'E_LIMITS']);
const fail = code => { const error = new Error(code); error.code = code; Object.freeze(error); throw error; };
const typedPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const typedLength = Object.getOwnPropertyDescriptor(typedPrototype, 'length').get;
const typedBuffer = Object.getOwnPropertyDescriptor(typedPrototype, 'buffer').get;
const typedOffset = Object.getOwnPropertyDescriptor(typedPrototype, 'byteOffset').get;
const ascii = text => text.replace(/[^\x00-\x7f]/g, ch => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'));
function pinned(bytes, pin) { if (bytes.length !== pin.bytes || sha(bytes) !== pin.sha256) fail('E_SOURCE_PIN'); return bytes; }

// WHAT: Pinned all-reference membership interpretation in a private fixed-target collector.
export function transformSdkManifestMembershipSource(bytes) {
  if (types.isProxy(bytes) || !Buffer.isBuffer(bytes) || typedLength.call(bytes) !== MANIFEST_MEMBERSHIP_SOURCE_PINS.aliasCollector.bytes) fail('E_SOURCE_PIN');
  const backing = typedBuffer.call(bytes);
  if (types.isSharedArrayBuffer(backing)) fail('E_SOURCE_PIN');
  const captured = Buffer.from(new Uint8Array(backing, typedOffset.call(bytes), typedLength.call(bytes)));
  pinned(captured, MANIFEST_MEMBERSHIP_SOURCE_PINS.aliasCollector);
  let source = captured.toString('utf8');
  if (!membershipPatches.every(([needle]) => source.split(needle).length === 2)) fail('E_SOURCE_PIN');
  for (const [needle, replacement] of membershipPatches) source = source.replace(needle, replacement);
  const branch = pinned(Buffer.from(source), MANIFEST_MEMBERSHIP_SOURCE_PINS.branchCollector);
  return pinned(Buffer.from(branch.toString('utf8') + membershipAppendix), MANIFEST_MEMBERSHIP_SOURCE_PINS.membershipCollector);
}

export async function runRegisteredGnuSdkManifestMembership() {
  const started = performance.now();
  let last = started, error = null, result = null, collector = null, data = null;
  let sourceAccountingComplete = false, receiptAccountingComplete = false, stageAccountingComplete = false;
  const packets = [], counts = { sourceReads: 0, sourceBytes: 0, receiptReads: 0, receiptBytes: 0,
    spawnAttempts: 0, spawnEvents: 0, stageChecks: 0, preloadChecks: 0, stageFsCalls: 0, stageReadBytes: 0,
    stageCloses: 0, completedCorePasses: 0, archivePasses: 0, archiveDataBytes: 0, archiveRequestedBytes: 0, archiveCloseAttempts: 0 };
  function guard(limit = 250000) {
    const now = performance.now();
    if (!Number.isFinite(now) || now < last) fail('E_CLOCK');
    last = now;
    if (now - started >= limit) fail('E_DEADLINE');
    return now;
  }
  try {
    const sources = new Map();
    for (const [name, bytes, sha256] of descriptors) {
      guard(10000); counts.sourceReads++;
      const source = fs.readFileSync('/tmp/opencode/f9-bootstrap-correspondence/tooling/native-ingress/' + name + '.mjs');
      counts.sourceBytes += source.length; pinned(source, { bytes, sha256 }); sources.set(name, source);
    }
    sourceAccountingComplete = true;
    guard(10000); counts.receiptReads++;
    const receiptBytes = fs.readFileSync('/tmp/opencode/f9-bootstrap-correspondence/_spec/tooling/native-ingress/xz-qualification.receipt.json');
    counts.receiptBytes += receiptBytes.length;
    pinned(receiptBytes, { bytes: 4239, sha256: 'e45d65231c0815ab2b895c0d74467500a0e6caf33cc0a4ee342b20489ce6b233' });
    const stagedReceipt = JSON.parse(receiptBytes.toString('utf8'));
    if (stagedReceipt.status !== 'FINITE_XZ_PROFILE_OBSERVED' || stagedReceipt.counts.spawnEvents !== 33 ||
      stagedReceipt.fixtureManifestSha256 !== '632a0d812366712ae99ce2ce442ad98a59534430640184f70af53df58656b4ea') fail('E_RECEIPT');
    receiptAccountingComplete = true;
    const uri = bytes => 'data:text/javascript;base64,' + bytes.toString('base64');
    const [v2, v4, driverV2] = await Promise.all([import(uri(sources.get('gnu-sdk-inventory-v2-operation'))),
      import(uri(sources.get('gnu-sdk-inventory-v4-operation'))), import(uri(sources.get('gnu-sdk-driver-controls-v2-operation')))]);
    guard(10000);
    const tar = pinned(v4.transformTarInventoryV4Source(sources.get('tar-inventory')), MANIFEST_MEMBERSHIP_SOURCE_PINS.transformedTar);
    const core = pinned(driverV2.transformSdkDriverV2CoreSource(v2.transformSdkInventoryV2Source(sources.get('gnu-sdk-inventory'))), MANIFEST_MEMBERSHIP_SOURCE_PINS.controlsCore);
    const alias = pinned(driverV2.transformSdkDriverAliasSource(sources.get('sdk-driver-controls')), MANIFEST_MEMBERSHIP_SOURCE_PINS.aliasCollector);
    const membershipSource = transformSdkManifestMembershipSource(alias);
    function link(bytes, dependency, dependencyUri) {
      const source = bytes.toString('utf8'), needle = "from './" + dependency + ".mjs'";
      if (source.split(needle).length !== 2) fail('E_SOURCE_PIN');
      return Buffer.from(source.replace(needle, "from '" + dependencyUri + "'"));
    }
    const elfUri = uri(sources.get('elf-metadata'));
    const stageSource = link(sources.get('xz-staging'), 'elf-metadata', elfUri);
    pinned(stageSource, { bytes: 43154, sha256: '89b6c5e3dcbf902937f81fc642d7238bd4ec4ca3c94f6b61f4d069efdce8c5f2' });
    const collectorSource = pinned(link(membershipSource, 'tar-inventory', uri(tar)), MANIFEST_MEMBERSHIP_SOURCE_PINS.linkedCollector);
    const collectorUri = uri(collectorSource);
    const pipelineSource = pinned(link(core, 'tar-inventory', collectorUri), MANIFEST_MEMBERSHIP_SOURCE_PINS.linkedPipeline);
    const [stage, inventory, controls, elf] = await Promise.all([
      import(uri(stageSource)), import(uri(pipelineSource)), import(collectorUri), import(elfUri),
    ]);
    collector = controls; guard(10000);
    const gate = () => {
      guard(); stageAccountingComplete = false;
      const checked = stage.verifyStagedXzImages(stagedReceipt.staged);
      counts.stageChecks++; counts.stageFsCalls += checked.counters.fsCalls;
      counts.stageReadBytes += checked.counters.readBytes; counts.stageCloses += checked.counters.closeAttempts;
      stageAccountingComplete = true; counts.preloadChecks++;
      if (stage.assertNoSystemPreload() !== true) fail('E_PRELOAD');
      if (counts.stageChecks > 4 || counts.stageFsCalls > 4096 || counts.stageReadBytes > 11032864 || counts.stageCloses > 20) fail('E_LIMIT');
      guard();
      return { stagedImagesVerified: true, preloadAbsent: true, ordinaryProfileObserved: true };
    };
    async function runPass(number) {
      guard(); const diagnostics = v2.createSdkV2Diagnostics(); packets.push(diagnostics);
      let attempts = 0;
      const value = await inventory.runGnuSdkInventory(identity, {
        beforeDecode: gate, afterDecode: gate,
        spawn(...args) {
          guard(); attempts++; counts.spawnAttempts++;
          if (attempts > 1 || counts.spawnAttempts > 2) fail('E_LIMIT');
          const child = spawn(...args);
          child.once('spawn', () => { counts.spawnEvents++; diagnostics.observeSdkChild(child); });
          return child;
        },
      });
      guard();
      if (value.state !== 'GNU_SDK_DATA_INVENTORY' || value.mockOnly !== false || value.archiveBytes !== 102296280 ||
        value.archiveSha256 !== 'cde893afab04ac7dcd15c46aac214ff550441b982536124c88a71146a0eeedd3' ||
        value.archivePasses !== 2 || value.archiveDataBytes !== 204592560 || value.archiveRequestedBytes !== 204592562 ||
        value.closeAttempts !== 2 || value.exitCode !== 0 || value.signal !== null || counts.spawnEvents !== number ||
        counts.stageChecks !== number * 2 || counts.preloadChecks !== number * 2 ||
        !['stdinFinished', 'stdoutEnded', 'stderrEnded', 'closeObserved'].every(key => value[key] === true) ||
        ['extracted', 'nativeQualified', 'pythonFreeSubsetVerified'].some(key => value[key] !== false)) fail('E_RECEIPT');
      counts.completedCorePasses++; counts.archivePasses += value.archivePasses;
      counts.archiveDataBytes += value.archiveDataBytes; counts.archiveRequestedBytes += value.archiveRequestedBytes;
      counts.archiveCloseAttempts += value.closeAttempts;
      return value;
    }
    collector.beginMemberPass();
    let first = await runPass(1);
    const metadata = collector.acceptMemberPass(first); first = null;
    if (started + 250000 - guard() < 120000) fail('E_DEADLINE');
    collector.beginCapturePass();
    const second = await runPass(2);
    collector.acceptCapturePass(second); guard();
    if (counts.archivePasses !== 4 || counts.archiveDataBytes !== 409185120 || counts.archiveRequestedBytes !== 409185124 ||
      counts.archiveCloseAttempts !== 4 || counts.spawnAttempts !== 2 || counts.spawnEvents !== 2 || counts.stageChecks !== 4 || counts.preloadChecks !== 4) fail('E_RECEIPT');
    data = collector.getInspectionData();
    if (data.relocs.byteLength !== driverV2.SDK_DRIVER_V2_MANIFEST_PIN.byteLength || data.relocs.sha256 !== driverV2.SDK_DRIVER_V2_MANIFEST_PIN.sha256) fail('E_HASH');
    const driver = data.driver;
    const observed = elf.inspectElf64Requirements(driver.bytes);
    if (observed.inputSha256 !== driver.sha256) fail('E_HASH');
    const declarations = { profile: observed.profile, header: observed.header, interpreter: observed.interpreter,
      needed: observed.dynamic.needed, soname: observed.dynamic.soname, rpath: observed.dynamic.rpath, runpath: observed.dynamic.runpath,
      versionNeeds: observed.requirements.versionNeeds, versionDefinitions: observed.requirements.versionDefinitions,
      buildIds: observed.requirements.buildIds, abiTags: observed.requirements.abiTags, properties: observed.requirements.properties,
      scope: 'archive bytes only; driver not executed', candidateExecuted: false, decoderQualified: false,
      realCandidateRead: false, realArchiveInspected: false, nativeAuthority: false,
      nativeQualified: false, installedUsability: false, pythonFreeSubsetVerified: false, rustReady: false, trainingReady: false,
      loaderClosureVerified: false, provenanceVerified: false, noPythonRuntimeVerified: false, symbolBindingsVerified: false,
      hardwareCompatibilityVerified: false, instructionCoverageVerified: false, propertyEnforcementVerified: false, buildIdAuthenticated: false };
    if (Buffer.byteLength(ascii(JSON.stringify(declarations))) > 131072) fail('E_OUTPUT');
    result = { state: 'MANIFEST_MEMBERSHIP_OBSERVED', interpretation: 'MANIFEST_MEMBERSHIP_DATA_NOT_RELOCATION_AUTHORITY', relocationReady: false,
      summary: metadata.summary, decodedSha256: metadata.decodedSha256, decodedDigestScope: 'independently expected digest verified in both complete passes',
      regularFileCount: metadata.regularFileCount, locationPrefixData: data.location.prefix,
      manifestByteRef: { byteLength: data.relocs.byteLength, sha256: data.relocs.sha256 },
      manifestPinScope: 'raw manifest SHA/length checked before membership interpretation; rechecked before ELF inspection/publication',
      driver: { path: driver.path, index: driver.index, bodyOffset: driver.bodyOffset, byteLength: driver.size, sha256: driver.sha256, declarations },
      location: data.location, manifestRefs: data.relocs };
    guard();
  } catch (failure) {
    const descriptor = failure && !types.isProxy(failure) ? Object.getOwnPropertyDescriptor(failure, 'code') : null;
    error = descriptor && Object.hasOwn(descriptor, 'value') && codes.has(descriptor.value) ? descriptor.value : 'E_IO';
    if (collector) collector.abortDriverInspection(); result = null;
  } finally { if (data) data.driver.bytes.fill(0); }
  const base = { profile: 'registered-gnu-sdk-manifest-membership-v1', status: error ? 'STOP' : 'MANIFEST_MEMBERSHIP_OBSERVED',
    interpretation: 'MANIFEST_MEMBERSHIP_DATA_NOT_RELOCATION_AUTHORITY', relocationReady: false, manifestInterpretation: 'single-leading-dot-slash-v1',
    sourcePins: MANIFEST_MEMBERSHIP_SOURCE_PINS, counts, sourceAccountingComplete, receiptAccountingComplete, stageAccountingComplete,
    sourceCountersScope: 'attempted source/receipt reads; bytes returned by completed reads',
    stageCountersScope: 'completed verification helpers', archiveAccountingComplete: counts.completedCorePasses === 2,
    archiveCountersScope: 'completed joint-core results only', packetDiagnostics: packets.map(value => value.snapshot()),
    inspection: collector ? collector.snapshotDriverInspection() : null,
    candidateInvocationAttempted: counts.spawnAttempts > 0,
    candidateExecuted: counts.completedCorePasses === 2 ? true : counts.spawnAttempts === 0 ? false : null,
    realArchiveInspected: error === null, archiveExtracted: false, filesInstalled: false, pythonRuntimeInvoked: false,
    nativeQualified: false, installedUsability: false, pythonFreeSubsetVerified: false, rustReady: false, trainingReady: false,
    hardRssBounded: false, hardDeadlineGuaranteed: false, processTreeBounded: false };
  let text = ascii(JSON.stringify({ ...base, ...(error ? { error } : { result }) })) + '\n';
  if (Buffer.byteLength(text) > 2097152) { error = 'E_OUTPUT'; text = JSON.stringify({ ...base, status: 'STOP', realArchiveInspected: false, error }) + '\n'; }
  if (!error) {
    try { guard(); } catch { error = 'E_DEADLINE'; text = JSON.stringify({ ...base, status: 'STOP', realArchiveInspected: false, error }) + '\n'; }
  }
  return Object.freeze({ exitCode: error ? 1 : 0, text });
}
