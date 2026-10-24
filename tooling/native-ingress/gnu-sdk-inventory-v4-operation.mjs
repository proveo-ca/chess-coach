// SPEC: _spec/tooling/native-ingress/gnu-sdk-inventory-v4.puml
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
  ['tar-observer', 3288, '6211785adf6470eb6af8f437a6815aa194b75063f0f7ad9a90c48ad9e3747ab1'],
];
export const GNU_SDK_V4_PINS = Object.freeze({
  v1SourcePin: Object.freeze({ bytes: 23261, sha256: 'bd2fc43633ca3b8f0c485eddb68a1b7505002edecd70eee4bf9cc661f588ef29' }),
  transformedSourcePin: Object.freeze({ bytes: 23262, sha256: 'c163c52e915104a017d21c8e9d4db545f760d8c5c0652a270e38cad6fdeda8da' }),
  originalTarSourcePin: Object.freeze({ bytes: 15548, sha256: '050d629963fdf89bd5dff7639260c7de30b08be46320b7b6bb7ed4dac6bb8139' }),
  intermediateTarSourcePin: Object.freeze({ bytes: 15551, sha256: 'b22db5d375d966016f5551b9161119079960d24f9611cf87d145893887575824' }),
  transformedTarSourcePin: Object.freeze({ bytes: 15568, sha256: '56cac49b3cfe51dbf2a7f7d1f4a0d877ae8773f940585ebea72740373689fae2' }),
  v2HelperSourcePin: Object.freeze({ bytes: 10102, sha256: '39da4bc85f6e7eaaecb0abd157d59ec4c2dcb6191a19c9247cbadd0080ae767a' }),
  observerSourcePin: Object.freeze({ bytes: 3288, sha256: '6211785adf6470eb6af8f437a6815aa194b75063f0f7ad9a90c48ad9e3747ab1' }),
  linkedObserverSourcePin: Object.freeze({ bytes: 24057, sha256: 'f516d8d3d478a35f09135a769cd25a80830453d7ae5802750e0308bb754e8b04' }),
  linkedSourcePin: Object.freeze({ bytes: 55347, sha256: '62aca920ea966549edea33c7c52a607716f63701d3bf35cc868e677eabd58923' }),
});
const receiptSha256 = 'e45d65231c0815ab2b895c0d74467500a0e6caf33cc0a4ee342b20489ce6b233';
const identity = {
  root: { dev: '28', ino: '13894', mode: '16832', uid: '1000', gid: '1000', nlink: '2', size: '4096',
    mtimeNs: '1792805590304271582', ctimeNs: '1792805590304271582' },
  file: { dev: '29', ino: '1211332', mode: '33152', uid: '1000', gid: '1000', nlink: '1', size: '102296280',
    mtimeNs: '1792805605531830652', ctimeNs: '1792805605531830652' },
};
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const known = new Set(['E_SOURCE_PIN', 'E_RECEIPT', 'E_INPUT', 'E_METADATA', 'E_BINDING', 'E_IO',
  'E_CLOSE', 'E_LENGTH', 'E_HASH', 'E_PREREQUISITE', 'E_SPAWN', 'E_PIPE', 'E_DECODER', 'E_TAR',
  'E_OUTPUT', 'E_DEADLINE', 'E_CLEANUP', 'E_CLOCK', 'E_LIMIT', 'E_PRELOAD', 'E_LAYOUT']);
const emptyPackets = Object.freeze({ stdoutEvents: 0, stderrEvents: 0, stdoutBytes: 0, stderrBytes: 0,
  diagnosticCountersComplete: true, diagnosticCountersScope: 'observed Node data packets; not OS syscall counts' });
const emptyTar = Object.freeze({ feedCalls: 0, completedFeedCalls: 0, attemptedFeedBytes: 0,
  errorPhase: null, errorCode: null, diagnosticCountersComplete: true });
const stop = code => { const failure = new Error(code); failure.code = code; Object.freeze(failure); throw failure; };
const typedPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const typedLength = Object.getOwnPropertyDescriptor(typedPrototype, 'length').get;
const typedBuffer = Object.getOwnPropertyDescriptor(typedPrototype, 'buffer').get;
const typedOffset = Object.getOwnPropertyDescriptor(typedPrototype, 'byteOffset').get;

// WHAT: Pinned cumulative extension budget with an independent 64 KiB payload gate.
export function transformTarInventoryV4Source(bytes) {
  const { originalTarSourcePin, intermediateTarSourcePin, transformedTarSourcePin } = GNU_SDK_V4_PINS;
  if (types.isProxy(bytes) || !Buffer.isBuffer(bytes) || typedLength.call(bytes) !== originalTarSourcePin.bytes) stop('E_SOURCE_PIN');
  const backing = typedBuffer.call(bytes);
  if (types.isSharedArrayBuffer(backing)) stop('E_SOURCE_PIN');
  const captured = Buffer.from(new Uint8Array(backing, typedOffset.call(bytes), typedLength.call(bytes)));
  if (digest(captured) !== originalTarSourcePin.sha256) stop('E_SOURCE_PIN');
  const source = captured.toString('utf8');
  const defaultNeedle = 'maxExtensionBytes: 65_536';
  const guardNeedle = "if (size > limits.maxExtensionBytes - extensionBytes) fail('E_EXTENSION_BYTES');";
  if (source.split(defaultNeedle).length !== 2 || source.split(guardNeedle).length !== 2) stop('E_SOURCE_PIN');
  const intermediate = Buffer.from(source.replace(defaultNeedle, 'maxExtensionBytes: 4_194_304'));
  if (intermediate.length !== intermediateTarSourcePin.bytes || digest(intermediate) !== intermediateTarSourcePin.sha256) stop('E_SOURCE_PIN');
  const transformed = Buffer.from(intermediate.toString('utf8').replace(guardNeedle,
    "if (size > 65_536 || size > limits.maxExtensionBytes - extensionBytes) fail('E_EXTENSION_BYTES');"));
  if (transformed.length !== transformedTarSourcePin.bytes || digest(transformed) !== transformedTarSourcePin.sha256) stop('E_SOURCE_PIN');
  return transformed;
}

export async function runRegisteredGnuSdkInventoryV4() {
  const started = performance.now();
  let last = started, result = null, error = null, stageAccountingComplete = false;
  let sourceAccountingComplete = false, receiptAccountingComplete = false;
  let diagnostics = null, observer = null, inventoryInvocationAttempted = false;
  const counts = { sourceReads: 0, sourceBytes: 0, receiptReads: 0, receiptBytes: 0, spawnAttempts: 0,
    spawnEvents: 0, stageChecks: 0, preloadChecks: 0, stageFsCalls: 0, stageReadBytes: 0, stageCloses: 0 };
  function guard(limit = 130000) {
    const now = performance.now();
    if (!Number.isFinite(now) || now < last) stop('E_CLOCK');
    last = now;
    if (now - started >= limit) stop('E_DEADLINE');
  }
  try {
    const sources = new Map();
    for (const [name, size, sha] of descriptors) {
      guard(10000); counts.sourceReads++;
      const bytes = fs.readFileSync('/tmp/opencode/f9-bootstrap-correspondence/tooling/native-ingress/' + name + '.mjs');
      counts.sourceBytes += bytes.length;
      if (bytes.length !== size || digest(bytes) !== sha) stop('E_SOURCE_PIN');
      sources.set(name, bytes);
    }
    sourceAccountingComplete = true;
    counts.receiptReads++;
    const receiptBytes = fs.readFileSync('/tmp/opencode/f9-bootstrap-correspondence/_spec/tooling/native-ingress/xz-qualification.receipt.json');
    counts.receiptBytes += receiptBytes.length;
    if (receiptBytes.length !== 4239 || digest(receiptBytes) !== receiptSha256) stop('E_SOURCE_PIN');
    const receipt = JSON.parse(receiptBytes.toString('utf8'));
    if (receipt.status !== 'FINITE_XZ_PROFILE_OBSERVED' || receipt.counts.spawnEvents !== 33 ||
      receipt.fixtureManifestSha256 !== '632a0d812366712ae99ce2ce442ad98a59534430640184f70af53df58656b4ea') stop('E_RECEIPT');
    receiptAccountingComplete = true;
    const uri = bytes => 'data:text/javascript;base64,' + bytes.toString('base64');
    const helper = await import(uri(sources.get('gnu-sdk-inventory-v2-operation')));
    guard(10000);
    diagnostics = helper.createSdkV2Diagnostics();
    const transformed = helper.transformSdkInventoryV2Source(sources.get('gnu-sdk-inventory'));
    if (transformed.length !== GNU_SDK_V4_PINS.transformedSourcePin.bytes ||
      digest(transformed) !== GNU_SDK_V4_PINS.transformedSourcePin.sha256) stop('E_SOURCE_PIN');
    const transformedTar = transformTarInventoryV4Source(sources.get('tar-inventory'));
    function link(bytes, dependency, dependencyUri) {
      const source = bytes.toString('utf8'), needle = "from './" + dependency + ".mjs'";
      if (source.split(needle).length !== 2) stop('E_SOURCE_PIN');
      return Buffer.from(source.replace(needle, "from '" + dependencyUri + "'"));
    }
    const stageSource = link(sources.get('xz-staging'), 'elf-metadata', uri(sources.get('elf-metadata')));
    if (stageSource.length !== 43154 || digest(stageSource) !== '89b6c5e3dcbf902937f81fc642d7238bd4ec4ca3c94f6b61f4d069efdce8c5f2') stop('E_SOURCE_PIN');
    const observerSource = link(sources.get('tar-observer'), 'tar-inventory', uri(transformedTar));
    if (observerSource.length !== GNU_SDK_V4_PINS.linkedObserverSourcePin.bytes ||
      digest(observerSource) !== GNU_SDK_V4_PINS.linkedObserverSourcePin.sha256) stop('E_SOURCE_PIN');
    const observerUri = uri(observerSource);
    const inventorySource = link(transformed, 'tar-inventory', observerUri);
    if (inventorySource.length !== GNU_SDK_V4_PINS.linkedSourcePin.bytes ||
      digest(inventorySource) !== GNU_SDK_V4_PINS.linkedSourcePin.sha256) stop('E_SOURCE_PIN');
    const [stage, inventory, observed] = await Promise.all([
      import(uri(stageSource)), import(uri(inventorySource)), import(observerUri),
    ]);
    observer = observed;
    guard(10000);
    const gate = () => {
      guard(); stageAccountingComplete = false;
      const checked = stage.verifyStagedXzImages(receipt.staged);
      counts.stageChecks++; counts.stageFsCalls += checked.counters.fsCalls;
      counts.stageReadBytes += checked.counters.readBytes; counts.stageCloses += checked.counters.closeAttempts;
      stageAccountingComplete = true; counts.preloadChecks++;
      if (stage.assertNoSystemPreload() !== true) stop('E_PRELOAD');
      if (counts.stageChecks > 2 || counts.stageFsCalls > 2048 || counts.stageReadBytes > 5516432 || counts.stageCloses > 10) stop('E_LIMIT');
      guard();
      return { stagedImagesVerified: true, preloadAbsent: true, ordinaryProfileObserved: true };
    };
    inventoryInvocationAttempted = true;
    result = await inventory.runGnuSdkInventory(identity, {
      beforeDecode: gate, afterDecode: gate,
      spawn(...args) {
        guard(); if (++counts.spawnAttempts > 1) stop('E_LIMIT');
        const child = spawn(...args);
        child.once('spawn', () => { counts.spawnEvents++; diagnostics.observeSdkChild(child); });
        return child;
      },
    });
    guard();
    if (result.state !== 'GNU_SDK_DATA_INVENTORY' || result.mockOnly !== false ||
      result.archiveDataBytes !== 204592560 || result.closeAttempts !== 2 || counts.spawnEvents !== 1 ||
      counts.stageChecks !== 2 || result.extracted || result.nativeQualified || result.pythonFreeSubsetVerified) stop('E_RECEIPT');
  } catch (failure) { error = known.has(failure.code) ? failure.code : 'E_IO'; }
  const base = { profile: 'registered-gnu-sdk-inventory-v4', status: error ? 'STOP' : 'GNU_SDK_DATA_INVENTORY',
    cumulativeExtensionBytesLimit: 4194304, individualExtensionPayloadLimit: 65536,
    rawStreamEventLimit: 262144, ...GNU_SDK_V4_PINS, diagnostics: diagnostics ? diagnostics.snapshot() : emptyPackets,
    tarDiagnostics: inventoryInvocationAttempted && observer ? observer.snapshotTarInventoryDiagnostics() : emptyTar,
    tarDiagnosticsScope: 'latest parser wrapper for this inventory invocation; feed calls, not entry events',
    counts, sourceAccountingComplete, receiptAccountingComplete,
    sourceCountersScope: 'attempted source reads; bytes returned by completed reads; complete after all source pins pass',
    receiptCountersScope: 'attempted receipt reads; bytes returned by completed reads; complete after receipt validation',
    stageAccountingComplete, stageCountersScope: 'completed verification helpers',
    candidateInvocationAttempted: counts.spawnAttempts > 0,
    candidateExecuted: result !== null ? true : counts.spawnAttempts === 0 ? false : null,
    realArchiveInspected: result !== null && error === null,
    archiveExtracted: false, filesInstalled: false, pythonRuntimeInvoked: false,
    pythonFreeSubsetVerified: false, nativeQualified: false, rustReady: false, trainingReady: false,
    hardRssBounded: false, hardDeadlineGuaranteed: false, processTreeBounded: false };
  let text = (JSON.stringify({ ...base, ...(error ? { error } : { result }) }) + '\n')
    .replace(/[^\x00-\x7f]/g, ch => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'));
  if (Buffer.byteLength(text) > 1048576) { error = 'E_OUTPUT'; text = JSON.stringify({ ...base, status: 'STOP', realArchiveInspected: false, error }) + '\n'; }
  if (!error) {
    try { guard(); } catch { error = 'E_DEADLINE'; text = JSON.stringify({ ...base, status: 'STOP', realArchiveInspected: false, error }) + '\n'; }
  }
  return Object.freeze({ exitCode: error ? 1 : 0, text });
}
