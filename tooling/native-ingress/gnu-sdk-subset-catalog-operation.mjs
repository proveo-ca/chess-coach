// SPEC: _spec/tooling/native-ingress/gnu-sdk-subset-catalog.puml
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
export const SDK_SUBSET_CATALOG_SOURCE_PINS = Object.freeze({
  adapter: Object.freeze({ bytes: 16524, sha256: '71567d3f2672061f27508d959208a49b1e4d15a7896423e2433a1fbe9ca2ab88' }),
  eventCore: Object.freeze({ bytes: 23262, sha256: 'c163c52e915104a017d21c8e9d4db545f760d8c5c0652a270e38cad6fdeda8da' }),
  metadataCore: Object.freeze({ bytes: 23264, sha256: 'ac4aba7af508898603f7b19e37c9d31b5af488dab14192dd6560186b7654c12c' }),
  transformedTar: Object.freeze({ bytes: 15568, sha256: '56cac49b3cfe51dbf2a7f7d1f4a0d877ae8773f940585ebea72740373689fae2' }),
  linkedStage: Object.freeze({ bytes: 43154, sha256: '89b6c5e3dcbf902937f81fc642d7238bd4ec4ca3c94f6b61f4d069efdce8c5f2' }),
  linkedAdapter: Object.freeze({ bytes: 37293, sha256: 'ec5da02754e969a157dc87e970bb9bc0dc6fc8a8f0b819f2571fd88632c06ed3' }),
  linkedPipeline: Object.freeze({ bytes: 72997, sha256: 'c3c2e66d342ecd8a84ffd78ca5b2ce8f9cf5916501847d740924a5b622f73af0' }),
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
  'E_DEADLINE', 'E_CLEANUP', 'E_CLOCK', 'E_LIMIT', 'E_PRELOAD', 'E_LAYOUT', 'E_PHASE', 'E_SUMMARY', 'E_SPAN']);
const typed = Object.getPrototypeOf(Uint8Array.prototype);
const lengthOf = Object.getOwnPropertyDescriptor(typed, 'length').get;
const bufferOf = Object.getOwnPropertyDescriptor(typed, 'buffer').get;
const offsetOf = Object.getOwnPropertyDescriptor(typed, 'byteOffset').get;
const ascii = text => text.replace(/[^\x00-\x7f]/g, ch => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'));
function pinned(bytes, pin) { if (bytes.length !== pin.bytes || sha(bytes) !== pin.sha256) fail('E_SOURCE_PIN'); return bytes; }
function capture(bytes, pin) {
  if (types.isProxy(bytes) || !Buffer.isBuffer(bytes) || lengthOf.call(bytes) !== pin.bytes) fail('E_SOURCE_PIN');
  const buffer = bufferOf.call(bytes);
  if (types.isSharedArrayBuffer(buffer)) fail('E_SOURCE_PIN');
  return pinned(Buffer.from(new Uint8Array(buffer, offsetOf.call(bytes), lengthOf.call(bytes))), pin);
}
function link(bytes, dependency, dependencyUri) {
  const source = bytes.toString('utf8'), needle = "from './" + dependency + ".mjs'";
  if (source.split(needle).length !== 2) fail('E_SOURCE_PIN');
  return Buffer.from(source.replace(needle, "from '" + dependencyUri + "'"));
}

// WHAT: Pinned whole-core summary budget transform after the existing event-budget transform.
export function transformSdkSubsetCatalogCoreSource(bytes) {
  const captured = capture(bytes, SDK_SUBSET_CATALOG_SOURCE_PINS.eventCore), source = captured.toString('utf8');
  const needle = 'maxSummaryBytes: 262_144';
  if (source.split(needle).length !== 2) fail('E_SOURCE_PIN');
  return pinned(Buffer.from(source.replace(needle, 'maxSummaryBytes: 4_194_304')), SDK_SUBSET_CATALOG_SOURCE_PINS.metadataCore);
}

// WHAT: One fixed decoder child, two archive hash/EOF passes, and data-only namespace candidates.
export async function runRegisteredGnuSdkSubsetCatalog() {
  const started = performance.now();
  let last = started, publicationStarted = null, error = null, result = null, collector = null, diagnostics = null;
  let sourceAccountingComplete = false, receiptAccountingComplete = false, stageAccountingComplete = false;
  const counts = { sourceReads: 0, sourceBytes: 0, receiptReads: 0, receiptBytes: 0, spawnAttempts: 0, spawnEvents: 0,
    stageChecks: 0, preloadChecks: 0, stageFsCalls: 0, stageReadBytes: 0, stageCloses: 0, completedCorePasses: 0,
    archivePasses: 0, archiveDataBytes: 0, archiveRequestedBytes: 0, archiveCloseAttempts: 0 };
  function guard(limit = 130000) {
    const now = performance.now();
    if (!Number.isFinite(now) || !Number.isFinite(started) || now < last) fail('E_CLOCK');
    last = now;
    if (now - started >= limit || (publicationStarted !== null && now - publicationStarted >= 5000)) fail('E_DEADLINE');
    return now;
  }
  try {
    const sources = new Map();
    for (const [name, bytes, sha256] of [...descriptors, ['gnu-sdk-subset-catalog', SDK_SUBSET_CATALOG_SOURCE_PINS.adapter.bytes, SDK_SUBSET_CATALOG_SOURCE_PINS.adapter.sha256]]) {
      guard(5000); counts.sourceReads++;
      const source = fs.readFileSync('/tmp/opencode/f9-bootstrap-correspondence/tooling/native-ingress/' + name + '.mjs');
      counts.sourceBytes += lengthOf.call(source); sources.set(name, capture(source, { bytes, sha256 }));
    }
    sourceAccountingComplete = true;
    guard(5000); counts.receiptReads++;
    const receiptRaw = fs.readFileSync('/tmp/opencode/f9-bootstrap-correspondence/_spec/tooling/native-ingress/xz-qualification.receipt.json');
    counts.receiptBytes += lengthOf.call(receiptRaw);
    const receiptBytes = capture(receiptRaw, { bytes: 4239, sha256: 'e45d65231c0815ab2b895c0d74467500a0e6caf33cc0a4ee342b20489ce6b233' });
    const receipt = JSON.parse(receiptBytes.toString('utf8'));
    if (receipt.status !== 'FINITE_XZ_PROFILE_OBSERVED' || receipt.counts.spawnEvents !== 33 ||
      receipt.fixtureManifestSha256 !== '632a0d812366712ae99ce2ce442ad98a59534430640184f70af53df58656b4ea') fail('E_RECEIPT');
    receiptAccountingComplete = true;
    const uri = bytes => 'data:text/javascript;base64,' + bytes.toString('base64');
    const [v2, v4] = await Promise.all([import(uri(sources.get('gnu-sdk-inventory-v2-operation'))), import(uri(sources.get('gnu-sdk-inventory-v4-operation')))]);
    guard(5000);
    const tar = pinned(v4.transformTarInventoryV4Source(sources.get('tar-inventory')), SDK_SUBSET_CATALOG_SOURCE_PINS.transformedTar);
    const eventCore = pinned(v2.transformSdkInventoryV2Source(sources.get('gnu-sdk-inventory')), SDK_SUBSET_CATALOG_SOURCE_PINS.eventCore);
    const core = transformSdkSubsetCatalogCoreSource(eventCore);
    const stageSource = pinned(link(sources.get('xz-staging'), 'elf-metadata', uri(sources.get('elf-metadata'))), SDK_SUBSET_CATALOG_SOURCE_PINS.linkedStage);
    const adapterSource = pinned(link(sources.get('gnu-sdk-subset-catalog'), 'tar-inventory', uri(tar)), SDK_SUBSET_CATALOG_SOURCE_PINS.linkedAdapter);
    const collectorUri = uri(adapterSource);
    const pipelineSource = pinned(link(core, 'tar-inventory', collectorUri), SDK_SUBSET_CATALOG_SOURCE_PINS.linkedPipeline);
    guard(5000);
    const [stage, inventory, adapter] = await Promise.all([import(uri(stageSource)), import(uri(pipelineSource)), import(collectorUri)]);
    collector = adapter; diagnostics = v2.createSdkV2Diagnostics(); guard(5000);
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
    if (started + 130000 - guard() < 125000) fail('E_DEADLINE');
    collector.beginCatalogPass();
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
    collector.acceptCatalogPass(value); guard();
    result = collector.getCatalogData(); guard();
    if (result.state !== 'SUBSET_CANDIDATE_CATALOG' || result.namespaceComplete !== true || result.mockOnly !== false ||
      result.namespaceEntryCount !== 8412 || result.regularFileCount !== 6891 || result.decodedSha256 !== '5e7f960281fb93121982f95976eb59ed980e009b54aabf993d5d3fa2982e056f') fail('E_RECEIPT');
  } catch (failure) {
    const descriptor = failure && !types.isProxy(failure) ? Object.getOwnPropertyDescriptor(failure, 'code') : null;
    error = descriptor && Object.hasOwn(descriptor, 'value') && codes.has(descriptor.value) ? descriptor.value : 'E_IO';
    if (collector) collector.abortCatalog(); result = null;
  }
  const base = { profile: 'registered-gnu-sdk-subset-catalog-v1', sourcePins: SDK_SUBSET_CATALOG_SOURCE_PINS,
    interpretation: 'DATA_NOT_MEMBER_SELECTION_OR_PERMISSION', counts, sourceAccountingComplete, receiptAccountingComplete, stageAccountingComplete,
    sourceCountersScope: 'attempted source reads; completed read bytes; complete only after every raw source pin passes',
    receiptCountersScope: 'attempted receipt reads; completed read bytes; complete only after receipt validation',
    stageCountersScope: 'completed verification helpers', archiveAccountingComplete: counts.completedCorePasses === 1,
    archiveCountersScope: 'completed joint-core results only', packetDiagnostics: diagnostics ? diagnostics.snapshot() : null,
    candidateInvocationAttempted: counts.spawnAttempts > 0, candidateExecuted: counts.completedCorePasses === 1 ? true : counts.spawnAttempts ? null : false,
    archiveExtracted: false, filesInstalled: false, pythonRuntimeInvoked: false, relocationReady: false,
    nativeQualified: false, nativeAuthority: false, trainingReady: false, pythonFreeSubsetVerified: false, installedUsability: false, rustReady: false,
    archiveImmutable: false, nodeBootstrapAuthenticated: false, hardRssBounded: false, hardDeadlineGuaranteed: false, processTreeBounded: false,
    trustScope: 'ordinary Node bootstrap and host-source context; GNU SDK files remain DATA only' };
  let text;
  try {
    guard();
    text = ascii(JSON.stringify({ ...base, status: error ? 'STOP' : 'SUBSET_CANDIDATE_CATALOG', realArchiveInspected: !error,
      ...(error ? { error } : { result }) })) + '\n';
    if (Buffer.byteLength(text) > 2097152) fail('E_OUTPUT');
    guard();
  } catch (failure) {
    const descriptor = failure && !types.isProxy(failure) ? Object.getOwnPropertyDescriptor(failure, 'code') : null;
    error ??= descriptor && Object.hasOwn(descriptor, 'value') && codes.has(descriptor.value) ? descriptor.value : 'E_IO';
    if (collector) collector.abortCatalog(); result = null;
  }
  if (error) text = JSON.stringify({ ...base, status: 'STOP', realArchiveInspected: false, error }) + '\n';
  return Object.freeze({ exitCode: error ? 1 : 0, text });
}
