// SPEC: _spec/tooling/native-ingress/gnu-sdk-driver-controls-v2.puml
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
];
export const SDK_DRIVER_V2_SOURCE_PINS = Object.freeze({
  originalCollector: Object.freeze({ bytes: 18551, sha256: '3e9acafe464aa0a4418d5c9c7522683c2948035b93f95c96a290b8fdb264ec93' }),
  initializerCollector: Object.freeze({ bytes: 18626, sha256: 'b53dcc3d14bf26d8225fa1dffc555a793c6c57a6e0f764dfe20d20fccbd35a0e' }),
  aliasCollector: Object.freeze({ bytes: 18643, sha256: 'b156311ac91f5a9078124a70b1388f7ea1cb6986fa06508a71eb54cf2a3eb69d' }),
  linkedCollector: Object.freeze({ bytes: 39412, sha256: '276b530964b75115dee14659f69376a0ce2641490f57a014e1232ebb447b8939' }),
  linkedPipeline: Object.freeze({ bytes: 75825, sha256: '5d6ddaa029fa87a932430fc434dfd70f670eba49cc9bed42cf7f0063286fadf4' }),
  originalCore: Object.freeze({ bytes: 23261, sha256: 'bd2fc43633ca3b8f0c485eddb68a1b7505002edecd70eee4bf9cc661f588ef29' }),
  streamCore: Object.freeze({ bytes: 23262, sha256: 'c163c52e915104a017d21c8e9d4db545f760d8c5c0652a270e38cad6fdeda8da' }),
  controlsCore: Object.freeze({ bytes: 23264, sha256: 'ac4aba7af508898603f7b19e37c9d31b5af488dab14192dd6560186b7654c12c' }),
  transformedTar: Object.freeze({ bytes: 15568, sha256: '56cac49b3cfe51dbf2a7f7d1f4a0d877ae8773f940585ebea72740373689fae2' }),
});
export const SDK_DRIVER_V2_MANIFEST_PIN = Object.freeze({ byteLength: 9367,
  sha256: '60f1b6054d8f01670a9f5ac3ac0181f7148e37be91025c2c4f111df30047305e' });
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
function sourceSnapshot(bytes, pin) {
  if (types.isProxy(bytes) || !Buffer.isBuffer(bytes) || typedLength.call(bytes) !== pin.bytes) fail('E_SOURCE_PIN');
  const backing = typedBuffer.call(bytes);
  if (types.isSharedArrayBuffer(backing)) fail('E_SOURCE_PIN');
  return pinned(Buffer.from(new Uint8Array(backing, typedOffset.call(bytes), typedLength.call(bytes))), pin);
}

// WHAT: One leading ./ alias and its data-only interpretation label in a private source snapshot.
export function transformSdkDriverAliasSource(bytes) {
  const source = sourceSnapshot(bytes, SDK_DRIVER_V2_SOURCE_PINS.originalCollector).toString('utf8');
  const initializer = 'const path = value.slice(start, end);';
  const interpretation = 'DATA_ONLY_LITERAL_PATHS_NOT_MUTATION_AUTHORITY';
  if (source.split(initializer).length !== 2 || source.split(interpretation).length !== 2) fail('E_SOURCE_PIN');
  const intermediate = pinned(Buffer.from(source.replace(initializer,
    "const rawLine = value.slice(start, end);\n    const path = rawLine.startsWith('./') ? rawLine.slice(2) : rawLine;")), SDK_DRIVER_V2_SOURCE_PINS.initializerCollector);
  return pinned(Buffer.from(intermediate.toString('utf8').replace(interpretation,
    'DATA_ONLY_SINGLE_LEADING_DOT_ALIAS_PATHS_NOT_MUTATION_AUTHORITY')), SDK_DRIVER_V2_SOURCE_PINS.aliasCollector);
}
// WHAT: The existing pinned 4 MiB internal metadata-summary envelope.
export function transformSdkDriverV2CoreSource(bytes) {
  const source = sourceSnapshot(bytes, SDK_DRIVER_V2_SOURCE_PINS.streamCore).toString('utf8'), needle = 'maxSummaryBytes: 262_144';
  if (source.split(needle).length !== 2) fail('E_SOURCE_PIN');
  return pinned(Buffer.from(source.replace(needle, 'maxSummaryBytes: 4_194_304')), SDK_DRIVER_V2_SOURCE_PINS.controlsCore);
}

export async function runRegisteredGnuSdkDriverControlsV2() {
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
    const [v2, v4] = await Promise.all([import(uri(sources.get('gnu-sdk-inventory-v2-operation'))), import(uri(sources.get('gnu-sdk-inventory-v4-operation')))]);
    guard(10000);
    const tar = pinned(v4.transformTarInventoryV4Source(sources.get('tar-inventory')), SDK_DRIVER_V2_SOURCE_PINS.transformedTar);
    const core = transformSdkDriverV2CoreSource(v2.transformSdkInventoryV2Source(sources.get('gnu-sdk-inventory')));
    const aliasSource = transformSdkDriverAliasSource(sources.get('sdk-driver-controls'));
    function link(bytes, dependency, dependencyUri) {
      const source = bytes.toString('utf8'), needle = "from './" + dependency + ".mjs'";
      if (source.split(needle).length !== 2) fail('E_SOURCE_PIN');
      return Buffer.from(source.replace(needle, "from '" + dependencyUri + "'"));
    }
    const elfUri = uri(sources.get('elf-metadata'));
    const stageSource = link(sources.get('xz-staging'), 'elf-metadata', elfUri);
    pinned(stageSource, { bytes: 43154, sha256: '89b6c5e3dcbf902937f81fc642d7238bd4ec4ca3c94f6b61f4d069efdce8c5f2' });
    const collectorSource = pinned(link(aliasSource, 'tar-inventory', uri(tar)), SDK_DRIVER_V2_SOURCE_PINS.linkedCollector);
    const collectorUri = uri(collectorSource);
    const pipelineSource = pinned(link(core, 'tar-inventory', collectorUri), SDK_DRIVER_V2_SOURCE_PINS.linkedPipeline);
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
    if (data.relocs.byteLength !== SDK_DRIVER_V2_MANIFEST_PIN.byteLength || data.relocs.sha256 !== SDK_DRIVER_V2_MANIFEST_PIN.sha256) fail('E_HASH');
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
    result = { summary: metadata.summary, decodedSha256: metadata.decodedSha256,
      decodedDigestScope: 'independently expected digest verified in both complete passes', regularFileCount: metadata.regularFileCount,
      manifestPinScope: 'raw manifest length and SHA checked after parsing/joining and before ELF inspection/publication',
      canonicalJoinScope: 'canonical relative paths joined by SDK prefix to accepted regular spans; data only, no host opens or mutation permission',
      driver: { path: driver.path, index: driver.index, bodyOffset: driver.bodyOffset, byteLength: driver.size, sha256: driver.sha256, declarations },
      location: data.location, relocs: data.relocs,
      manifestJoinScope: 'one leading ./ alias removed; canonical literals joined to accepted regular spans; no extraction, exclusion or mutation permission' };
    guard();
  } catch (failure) {
    const descriptor = failure && !types.isProxy(failure) ? Object.getOwnPropertyDescriptor(failure, 'code') : null;
    error = descriptor && Object.hasOwn(descriptor, 'value') && codes.has(descriptor.value) ? descriptor.value : 'E_IO';
    if (collector) collector.abortDriverInspection(); result = null;
  } finally { if (data) data.driver.bytes.fill(0); }
  const base = { profile: 'registered-gnu-sdk-driver-controls-v2', status: error ? 'STOP' : 'SDK_DRIVER_CONTROL_DATA_INSPECTION',
    manifestInterpretation: 'single-leading-dot-slash-v1', sourcePins: SDK_DRIVER_V2_SOURCE_PINS,
    counts, sourceAccountingComplete, receiptAccountingComplete, stageAccountingComplete,
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
