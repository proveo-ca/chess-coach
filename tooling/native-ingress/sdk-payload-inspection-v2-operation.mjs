// SPEC: _spec/tooling/native-ingress/step2.puml
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
];
export const SDK_PAYLOAD_V2_SOURCE_PINS = Object.freeze({
  adapter: Object.freeze({ bytes: 31569, sha256: 'fc301816588aa16360ce30a9c18ea7d5d82838432e7bd28f54155024e4445469' }),
  oldOperator: Object.freeze({ bytes: 20620, sha256: 'fa19e0512fc6a74b09de9fc0039b8f44ffa8ba61566c676683a5b8ce48e2b295' }),
  elfV3: Object.freeze({ bytes: 20493, sha256: '3bd878fe2a6de57a2b8252163cdf2a4d3093c6605a903105a9f531f039b84f10' }),
  elfV4: Object.freeze({ bytes: 21142, sha256: 'f5a428aae91593853acfd289c4e91fb715ca530744defa2fe9447f6dda0602f3' }),
  adapterBindings: Object.freeze({ bytes: 31569, sha256: '23a6e1e0fb000dd011085bc506c3f4b633fdd223b559643425dac3ec0276bb30' }),
  transformedAdapter: Object.freeze({ bytes: 31569, sha256: 'f589b7aa2a91528e5d2d42f984e0da6bf8adb6b408dac6d2ce0c1e44cbee95fd' }),
  eventCore: Object.freeze({ bytes: 23262, sha256: 'c163c52e915104a017d21c8e9d4db545f760d8c5c0652a270e38cad6fdeda8da' }),
  metadataCore: Object.freeze({ bytes: 23264, sha256: 'ac4aba7af508898603f7b19e37c9d31b5af488dab14192dd6560186b7654c12c' }),
  transformedTar: Object.freeze({ bytes: 15568, sha256: '56cac49b3cfe51dbf2a7f7d1f4a0d877ae8773f940585ebea72740373689fae2' }),
  linkedStage: Object.freeze({ bytes: 43154, sha256: '89b6c5e3dcbf902937f81fc642d7238bd4ec4ca3c94f6b61f4d069efdce8c5f2' }),
  tarLinkedAdapter: Object.freeze({ bytes: 52338, sha256: 'e9abb5e534ea46f8614244965ac4e6d9aa20617fe516dfd2ecee080e73077ef2' }),
  linkedAdapter: Object.freeze({ bytes: 80533, sha256: '534081ee4eaaa79fa551f46867d4fbdb195804a092fe4954ca1e1dcc7372b931' }),
  linkedPipeline: Object.freeze({ bytes: 130653, sha256: '50ca6a0c8cb2b56d796758846069e7f1005feb6b66ec9c3f4d9422bca4ca137b' }),
});
const identity = {
  root: { dev: '28', ino: '13894', mode: '16832', uid: '1000', gid: '1000', nlink: '2', size: '4096',
    mtimeNs: '1792805590304271582', ctimeNs: '1792805590304271582' },
  file: { dev: '29', ino: '1211332', mode: '33152', uid: '1000', gid: '1000', nlink: '1', size: '102296280',
    mtimeNs: '1792805605531830652', ctimeNs: '1792805605531830652' },
};
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = code => { const error = new Error(code); error.code = code; throw Object.freeze(error); };
const codes = new Set(['E_SOURCE_PIN', 'E_RECEIPT', 'E_INPUT', 'E_METADATA', 'E_BINDING', 'E_IO', 'E_CLOSE',
  'E_LENGTH', 'E_HASH', 'E_PREREQUISITE', 'E_SPAWN', 'E_PIPE', 'E_DECODER', 'E_TAR', 'E_OUTPUT',
  'E_DEADLINE', 'E_CLEANUP', 'E_CLOCK', 'E_LIMIT', 'E_PRELOAD', 'E_LAYOUT', 'E_PHASE', 'E_SUMMARY', 'E_SPAN',
  'E_TARGET', 'E_KIND', 'E_ELF', 'E_REL', 'E_REL_UNSUPPORTED', 'E_AR', 'E_AR_UNSUPPORTED', 'E_LINKER_TEXT', 'E_LINKER_UNSUPPORTED']);
const typed = Object.getPrototypeOf(Uint8Array.prototype);
const lengthOf = Object.getOwnPropertyDescriptor(typed, 'length').get;
const bufferOf = Object.getOwnPropertyDescriptor(typed, 'buffer').get;
const offsetOf = Object.getOwnPropertyDescriptor(typed, 'byteOffset').get;
const resizable = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
const ascii = text => text.replace(/[^\x00-\x7f]/g, ch => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'));
function pinned(bytes, pin) { if (bytes.length !== pin.bytes || sha(bytes) !== pin.sha256) fail('E_SOURCE_PIN'); return bytes; }
function capture(bytes, pin) {
  if (types.isProxy(bytes) || !Buffer.isBuffer(bytes) || lengthOf.call(bytes) !== pin.bytes) fail('E_SOURCE_PIN');
  const buffer = bufferOf.call(bytes);
  if (types.isSharedArrayBuffer(buffer) || (resizable && resizable.call(buffer))) fail('E_SOURCE_PIN');
  return pinned(Buffer.from(new Uint8Array(buffer, offsetOf.call(bytes), lengthOf.call(bytes))), pin);
}
function link(bytes, dependency, dependencyUri) {
  const source = bytes.toString('utf8'), needle = "from './" + dependency + ".mjs'";
  if (source.split(needle).length !== 2) fail('E_SOURCE_PIN');
  return Buffer.from(source.replace(needle, "from '" + dependencyUri + "'"));
}
function captureFailedTargetAttempt(value, targets) {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || types.isProxy(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value)) || Reflect.ownKeys(value).length !== 6) fail('E_OUTPUT');
  const result = {};
  for (const key of ['path', 'index', 'kind', 'code', 'underlyingCode', 'scope']) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail('E_OUTPUT');
    result[key] = descriptor.value;
  }
  if (typeof result.path !== 'string' || !Number.isSafeInteger(result.index) || typeof result.kind !== 'string' ||
    !['E_ELF', 'E_REL', 'E_REL_UNSUPPORTED', 'E_AR', 'E_AR_UNSUPPORTED', 'E_LINKER_TEXT', 'E_LINKER_UNSUPPORTED', 'E_LIMIT', 'E_KIND'].includes(result.code) ||
    (result.underlyingCode !== null && (result.kind !== 'ELF_EXEC_DSO' || result.code !== 'E_ELF' ||
      !['E_INPUT', 'E_LIMITS', 'E_ELF', 'E_RANGE', 'E_PROGRAM_HEADERS', 'E_INTERPRETER', 'E_DYNAMIC', 'E_STRING_TABLE',
        'E_STRING', 'E_OUTPUT', 'E_VERSIONS', 'E_NOTES', 'E_PROPERTIES'].includes(result.underlyingCode))) ||
    result.scope !== 'ATTEMPTED_LITERAL_TARGET_NOT_ACCEPTED_PAYLOAD_EVIDENCE') fail('E_OUTPUT');
  if (Buffer.byteLength(ascii(JSON.stringify(result))) > 4096 ||
    !targets.some(target => target.path === result.path && target.index === result.index && target.kind === result.kind)) fail('E_OUTPUT');
  return Object.freeze(result);
}

// WHAT: Fixed private ELF v4 binding and path transform of the consumed SDK adapter.
export function transformSdkPayloadV2AdapterSource(bytes) {
  const captured = capture(bytes, SDK_PAYLOAD_V2_SOURCE_PINS.adapter), source = captured.toString('utf8');
  if (source.split('inspectElf64RequirementsV3').length !== 3) fail('E_SOURCE_PIN');
  const bindings = pinned(Buffer.from(source.replaceAll('inspectElf64RequirementsV3', 'inspectElf64RequirementsV4')),
    SDK_PAYLOAD_V2_SOURCE_PINS.adapterBindings);
  const pathSource = bindings.toString('utf8');
  if (pathSource.split('./elf-requirements-v3.mjs').length !== 2) fail('E_SOURCE_PIN');
  return pinned(Buffer.from(pathSource.replace('./elf-requirements-v3.mjs', './elf-requirements-v4.mjs')),
    SDK_PAYLOAD_V2_SOURCE_PINS.transformedAdapter);
}

// WHAT: One registered XZ child and fixed ELF v4 data inspection of all 45 original payload spans.
export async function runRegisteredSdkPayloadInspectionV2() {
  const started = performance.now();
  let last = started, publicationStarted = null, error = null, result = null, collector = null, diagnostics = null;
  let payloadPassStarted = false;
  let sourceAccountingComplete = false, receiptAccountingComplete = false, stageAccountingComplete = false;
  const counts = { sourceReads: 0, sourceBytes: 0, receiptReads: 0, receiptBytes: 0, spawnAttempts: 0, spawnEvents: 0,
    stageChecks: 0, preloadChecks: 0, stageFsCalls: 0, stageReadBytes: 0, stageCloses: 0, completedCorePasses: 0,
    archivePasses: 0, archiveDataBytes: 0, archiveRequestedBytes: 0, archiveCloseAttempts: 0 };
  const repoCapture = { fsCalls: 0, rootChecks: 0, namedChecks: 0, fdChecks: 0, openAttempts: 0,
    readAttempts: 0, requestedBytes: 0, readBytes: 0, closeAttempts: 0, closes: 0, completedCaptures: 0,
    sourceCaptures: 0, receiptCaptures: 0, allocations: 0, allocatedBytes: 0, ownedFds: 0, peakOwnedFds: 0 };
  const repoRoot = '/tmp/opencode/f9-bootstrap-correspondence';
  const repoSources = [...descriptors,
    ['elf-requirements-v3', SDK_PAYLOAD_V2_SOURCE_PINS.elfV3.bytes, SDK_PAYLOAD_V2_SOURCE_PINS.elfV3.sha256],
    ['elf-requirements-v4', SDK_PAYLOAD_V2_SOURCE_PINS.elfV4.bytes, SDK_PAYLOAD_V2_SOURCE_PINS.elfV4.sha256],
    ['sdk-payload-inspection', SDK_PAYLOAD_V2_SOURCE_PINS.adapter.bytes, SDK_PAYLOAD_V2_SOURCE_PINS.adapter.sha256],
    ['sdk-payload-inspection-operation', SDK_PAYLOAD_V2_SOURCE_PINS.oldOperator.bytes, SDK_PAYLOAD_V2_SOURCE_PINS.oldOperator.sha256]]
    .map(([name, bytes, sha256]) => ({ name, path: repoRoot + '/tooling/native-ingress/' + name + '.mjs', pin: { bytes, sha256 } }));
  const repoReceipt = { path: repoRoot + '/_spec/tooling/native-ingress/xz-qualification.receipt.json',
    pin: { bytes: 4239, sha256: 'e45d65231c0815ab2b895c0d74467500a0e6caf33cc0a4ee342b20489ce6b233' } };
  const repoFields = ['dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtimeNs', 'ctimeNs'];
  function guard(limit = 160000) {
    const now = performance.now();
    if (!Number.isFinite(now) || !Number.isFinite(started) || now < last) fail('E_CLOCK');
    last = now;
    if (now - started >= limit || (publicationStarted !== null && now - publicationStarted >= 30000)) fail('E_DEADLINE');
    return now;
  }
  function repoStat(method, value) {
    guard(10000); repoCapture.fsCalls++;
    if (method === 'fstatSync') repoCapture.fdChecks++;
    else if (value === repoRoot) repoCapture.rootChecks++;
    else repoCapture.namedChecks++;
    let stat;
    try { stat = fs[method](value, { bigint: true }); } catch { fail('E_IO'); }
    guard(10000); return stat;
  }
  function repoMetadata(stat, directory, size = null) {
    if (!stat || typeof stat !== 'object' || types.isProxy(stat)) fail('E_METADATA');
    const result = {};
    for (const key of repoFields) {
      const descriptor = Object.getOwnPropertyDescriptor(stat, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value') || typeof descriptor.value !== 'bigint' || descriptor.value < 0n) fail('E_METADATA');
      result[key] = descriptor.value;
    }
    if ((result.mode & 0o170000n) !== (directory ? 0o040000n : 0o100000n) ||
      (size !== null && result.size !== BigInt(size))) fail('E_SOURCE_PIN');
    return result;
  }
  function sameRepoMetadata(before, after) {
    if (!repoFields.every(key => before[key] === after[key])) fail('E_BINDING');
  }
  function readPinnedRepoSource(fixedPath, pin) {
    const descriptor = fixedPath === repoReceipt.path ? repoReceipt : repoSources.find(row => row.path === fixedPath);
    if (!descriptor || descriptor.pin !== pin) fail('E_SOURCE_PIN');
    let owned = null, bytes = null;
    try {
      guard(10000);
      const c = fs.constants;
      if (!c || c.O_RDONLY !== 0 || !['O_NOFOLLOW', 'O_NONBLOCK'].every(key => Number.isInteger(c[key]) && c[key] > 0)) fail('E_PREREQUISITE');
      const root = repoMetadata(repoStat('lstatSync', repoRoot), true);
      const named = repoMetadata(repoStat('lstatSync', fixedPath), false, pin.bytes);
      guard(10000); repoCapture.fsCalls++; repoCapture.openAttempts++;
      try { owned = fs.openSync(fixedPath, c.O_RDONLY | c.O_NOFOLLOW | c.O_NONBLOCK); } catch { fail('E_IO'); }
      if (!Number.isInteger(owned) || owned < 0) { owned = null; fail('E_IO'); }
      repoCapture.ownedFds++; repoCapture.peakOwnedFds = Math.max(repoCapture.peakOwnedFds, repoCapture.ownedFds);
      guard(10000);
      const bound = repoMetadata(repoStat('fstatSync', owned), false, pin.bytes);
      sameRepoMetadata(named, bound);
      bytes = Buffer.alloc(pin.bytes + 1); repoCapture.allocations++; repoCapture.allocatedBytes += bytes.length;
      let position = 0, calls = 0;
      function read(length) {
        guard(10000); repoCapture.fsCalls++; repoCapture.readAttempts++; repoCapture.requestedBytes += length;
        let n;
        try { n = fs.readSync(owned, bytes, position, length, position); } catch { fail('E_IO'); }
        if (!Number.isInteger(n) || n < 0 || n > length) fail('E_IO');
        repoCapture.readBytes += n;
        if (descriptor === repoReceipt) counts.receiptBytes += n; else counts.sourceBytes += n;
        guard(10000); return n;
      }
      while (position < pin.bytes) {
        if (++calls > 63) fail('E_LIMIT');
        const n = read(Math.min(65536, pin.bytes - position));
        if (!n) fail('E_SOURCE_PIN');
        position += n;
      }
      if (++calls > 64) fail('E_LIMIT');
      if (read(1) !== 0) fail('E_SOURCE_PIN');
      sameRepoMetadata(bound, repoMetadata(repoStat('fstatSync', owned), false, pin.bytes));
      sameRepoMetadata(named, repoMetadata(repoStat('lstatSync', fixedPath), false, pin.bytes));
      sameRepoMetadata(root, repoMetadata(repoStat('lstatSync', repoRoot), true));
      guard(10000); bytes = pinned(bytes.subarray(0, pin.bytes), pin); guard(10000);
    } finally {
      if (owned !== null) {
        const fd = owned; owned = null; repoCapture.ownedFds--; repoCapture.closeAttempts++; repoCapture.fsCalls++;
        try { fs.closeSync(fd); repoCapture.closes++; } catch { fail('E_CLOSE'); }
      }
    }
    guard(10000); repoCapture.completedCaptures++;
    if (descriptor === repoReceipt) repoCapture.receiptCaptures++; else repoCapture.sourceCaptures++;
    return bytes;
  }
  try {
    if (arguments.length !== 0) fail('E_INPUT');
    const sources = new Map();
    for (const { name, path, pin } of repoSources) {
      guard(10000); counts.sourceReads++;
      sources.set(name, readPinnedRepoSource(path, pin));
    }
    sourceAccountingComplete = true;
    guard(10000); counts.receiptReads++;
    const receiptBytes = readPinnedRepoSource(repoReceipt.path, repoReceipt.pin);
    const receipt = JSON.parse(receiptBytes.toString('utf8'));
    if (receipt.status !== 'FINITE_XZ_PROFILE_OBSERVED' || receipt.counts.spawnEvents !== 33 ||
      receipt.fixtureManifestSha256 !== '632a0d812366712ae99ce2ce442ad98a59534430640184f70af53df58656b4ea') fail('E_RECEIPT');
    receiptAccountingComplete = true;
    const uri = bytes => 'data:text/javascript;base64,' + bytes.toString('base64');
    const [v2, v4, oldOperator] = await Promise.all([
      import(uri(sources.get('gnu-sdk-inventory-v2-operation'))),
      import(uri(sources.get('gnu-sdk-inventory-v4-operation'))),
      import(uri(sources.get('sdk-payload-inspection-operation'))),
    ]);
    guard(10000);
    const tar = pinned(v4.transformTarInventoryV4Source(sources.get('tar-inventory')), SDK_PAYLOAD_V2_SOURCE_PINS.transformedTar);
    const eventCore = pinned(v2.transformSdkInventoryV2Source(sources.get('gnu-sdk-inventory')), SDK_PAYLOAD_V2_SOURCE_PINS.eventCore);
    const core = pinned(oldOperator.transformSdkPayloadCoreSource(eventCore), SDK_PAYLOAD_V2_SOURCE_PINS.metadataCore);
    const stageSource = pinned(link(sources.get('xz-staging'), 'elf-metadata', uri(sources.get('elf-metadata'))), SDK_PAYLOAD_V2_SOURCE_PINS.linkedStage);
    const privateAdapter = transformSdkPayloadV2AdapterSource(sources.get('sdk-payload-inspection'));
    const tarLinkedAdapter = pinned(link(privateAdapter, 'tar-inventory', uri(tar)), SDK_PAYLOAD_V2_SOURCE_PINS.tarLinkedAdapter);
    const adapterSource = pinned(link(tarLinkedAdapter, 'elf-requirements-v4', uri(sources.get('elf-requirements-v4'))), SDK_PAYLOAD_V2_SOURCE_PINS.linkedAdapter);
    const collectorUri = uri(adapterSource);
    const pipelineSource = pinned(link(core, 'tar-inventory', collectorUri), SDK_PAYLOAD_V2_SOURCE_PINS.linkedPipeline);
    guard(10000);
    const [stage, inventory, adapter] = await Promise.all([import(uri(stageSource)), import(uri(pipelineSource)), import(collectorUri)]);
    collector = adapter; diagnostics = v2.createSdkV2Diagnostics(); guard(10000);
    const gate = () => {
      guard(); stageAccountingComplete = false;
      const checked = stage.verifyStagedXzImages(receipt.staged);
      counts.stageChecks++; counts.stageFsCalls += checked.counters.fsCalls;
      counts.stageReadBytes += checked.counters.readBytes; counts.stageCloses += checked.counters.closeAttempts;
      stageAccountingComplete = true; counts.preloadChecks++;
      if (stage.assertNoSystemPreload() !== true) fail('E_PRELOAD');
      if (counts.stageChecks > 2 || counts.stageFsCalls > 2048 || counts.stageReadBytes > 5516432 || counts.stageCloses > 10) fail('E_LIMIT');
      guard(); return { stagedImagesVerified: true, preloadAbsent: true, ordinaryProfileObserved: true };
    };
    if (started + 160000 - guard() < 150000) fail('E_DEADLINE');
    collector.beginPayloadPass();
    payloadPassStarted = true;
    const value = await inventory.runGnuSdkInventory(identity, {
      beforeDecode: gate, afterDecode: gate,
      spawn(...args) {
        guard(); if (++counts.spawnAttempts > 1) fail('E_LIMIT');
        const child = spawn(...args);
        child.once('spawn', () => { counts.spawnEvents++; diagnostics.observeSdkChild(child); });
        return child;
      },
    });
    publicationStarted = guard();
    if (value.state !== 'GNU_SDK_DATA_INVENTORY' || value.mockOnly !== false || value.archiveBytes !== 102296280 ||
      value.archiveSha256 !== 'cde893afab04ac7dcd15c46aac214ff550441b982536124c88a71146a0eeedd3' || value.archivePasses !== 2 ||
      value.archiveDataBytes !== 204592560 || value.archiveRequestedBytes !== 204592562 || value.closeAttempts !== 2 ||
      value.exitCode !== 0 || value.signal !== null || counts.spawnAttempts !== 1 || counts.spawnEvents !== 1 ||
      counts.stageChecks !== 2 || counts.preloadChecks !== 2 ||
      !['stdinFinished', 'stdoutEnded', 'stderrEnded', 'closeObserved'].every(key => value[key] === true) ||
      ['extracted', 'nativeQualified', 'pythonFreeSubsetVerified'].some(key => value[key] !== false)) fail('E_RECEIPT');
    counts.completedCorePasses++; counts.archivePasses += value.archivePasses;
    counts.archiveDataBytes += value.archiveDataBytes; counts.archiveRequestedBytes += value.archiveRequestedBytes; counts.archiveCloseAttempts += value.closeAttempts;
    collector.acceptPayloadPass(value); guard();
    result = collector.getPayloadData(); guard();
    if (result.state !== 'SDK_PAYLOAD_DATA_INSPECTED' || result.mockOnly !== false || result.targetCount !== 45 || result.capturedBytes !== 184285137 ||
      result.decodedSha256 !== '5e7f960281fb93121982f95976eb59ed980e009b54aabf993d5d3fa2982e056f') fail('E_RECEIPT');
  } catch (failure) {
    const descriptor = failure && !types.isProxy(failure) ? Object.getOwnPropertyDescriptor(failure, 'code') : null;
    error = descriptor && Object.hasOwn(descriptor, 'value') && codes.has(descriptor.value) ? descriptor.value : 'E_IO';
    if (collector) collector.abortPayloadInspection(); result = null;
  }
  const base = { profile: 'registered-sdk-payload-inspection-v2', sourcePins: SDK_PAYLOAD_V2_SOURCE_PINS,
    elfRequirementsProfile: 'elf64le-x86-64-requirements-v4', maxStringTableSpanBytes: 16777216,
    elfPolicyScope: 'FIXED_SOURCE_POLICY_NOT_OBSERVED_DT_STRSZ',
    dataObservationScope: 'APPROVED_PROFILE_ID_AND_FIXED_PARSER_CODE_ONLY', failedTargetAttempt: null,
    interpretation: 'DATA_NOT_EXTRACTION_MEMBER_EXECUTION_OR_HOST_PERMISSION', counts, sourceAccountingComplete, receiptAccountingComplete, stageAccountingComplete,
    sourceCountersScope: 'attempted source captures; validated returned read bytes including failed prefixes and any positive EOF probe; complete after all ten source pins and closes pass',
    receiptCountersScope: 'attempted receipt captures; validated returned read bytes including failed prefixes and any positive EOF probe; complete after capture, close and receipt validation',
    repoCapture, repoCaptureAccountingComplete: repoCapture.completedCaptures === 11 && repoCapture.closes === 11 && repoCapture.ownedFds === 0,
    repoCaptureCountersScope: 'repository only, separate from stage and archive I/O; attempted FS calls, requested bytes, valid returned bytes, allocations and close attempts; closes count successful returns; ownedFds records retry authority, not proof of closure',
    stageCountersScope: 'completed verification helpers', archiveAccountingComplete: counts.completedCorePasses === 1,
    archiveCountersScope: 'completed joint-core results only', packetDiagnostics: diagnostics ? diagnostics.snapshot() : null,
    candidateInvocationAttempted: counts.spawnAttempts > 0, candidateExecuted: counts.completedCorePasses === 1 ? true : counts.spawnAttempts ? null : false,
    archiveExtracted: false, filesInstalled: false, pythonRuntimeInvoked: false, relocationReady: false,
    nativeQualified: false, nativeAuthority: false, trainingReady: false, pythonFreeSubsetVerified: false, installedUsability: false, rustReady: false,
    archiveImmutable: false, nodeBootstrapAuthenticated: false, hardRssBounded: false, hardDeadlineGuaranteed: false, processTreeBounded: false,
    trustScope: 'ordinary Node bootstrap and host-source context; GNU SDK files remain DATA only' };
  let text;
  try {
    if (error && payloadPassStarted) base.failedTargetAttempt = captureFailedTargetAttempt(collector.getFailedTargetAttempt(), collector.SDK_PAYLOAD_TARGETS);
    guard();
    text = ascii(JSON.stringify({ ...base, status: error ? 'STOP' : 'SDK_PAYLOAD_DATA_INSPECTED', realArchiveInspected: !error,
      ...(error ? { error } : { result }) })) + '\n';
    if (Buffer.byteLength(text) > 2097152) fail('E_OUTPUT');
    guard();
  } catch (failure) {
    const descriptor = failure && !types.isProxy(failure) ? Object.getOwnPropertyDescriptor(failure, 'code') : null;
    error ??= descriptor && Object.hasOwn(descriptor, 'value') && codes.has(descriptor.value) ? descriptor.value : 'E_IO';
    if (collector) collector.abortPayloadInspection(); result = null;
  }
  if (error) text = JSON.stringify({ ...base, status: 'STOP', realArchiveInspected: false, error }) + '\n';
  return Object.freeze({ exitCode: error ? 1 : 0, text });
}
