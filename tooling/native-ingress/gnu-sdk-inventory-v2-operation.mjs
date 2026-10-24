// SPEC: _spec/tooling/native-ingress/gnu-sdk-inventory-v2.puml
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { types } from 'node:util';

const descriptors = [
  ['tar-inventory', 15548, '050d629963fdf89bd5dff7639260c7de30b08be46320b7b6bb7ed4dac6bb8139'],
  ['elf-metadata', 19842, 'b223a655eae572137891a2c6efafee16887a2478fc91052f0092b48dfd65de85'],
  ['xz-staging', 16688, 'f75c21a58bb67e6ab3f8b1dafd090e11ac2d3a70f017da35afb81b00761b71b4'],
  ['gnu-sdk-inventory', 23261, 'bd2fc43633ca3b8f0c485eddb68a1b7505002edecd70eee4bf9cc661f588ef29'],
];
export const GNU_SDK_V2_PINS = Object.freeze({
  v1SourcePin: Object.freeze({ bytes: 23261, sha256: 'bd2fc43633ca3b8f0c485eddb68a1b7505002edecd70eee4bf9cc661f588ef29' }),
  transformedSourcePin: Object.freeze({ bytes: 23262, sha256: 'c163c52e915104a017d21c8e9d4db545f760d8c5c0652a270e38cad6fdeda8da' }),
  linkedSourcePin: Object.freeze({ bytes: 44003, sha256: '01e233ab98615ecbb8845f1ae3fe1f6ea1177acf7b3400a7729ac101895f8633' }),
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
const typedLength = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), 'length').get;

export class NewGnuSdkInventoryError extends Error {
  constructor(code) {
    const fixed = known.has(code) ? code : 'E_INPUT';
    super(fixed);
    this.name = 'NewGnuSdkInventoryError';
    this.code = fixed;
    Object.freeze(this);
  }
}
const stop = code => { throw new NewGnuSdkInventoryError(code); };

// WHAT: Checked single-literal transform of the captured v1 inventory source.
export function transformSdkInventoryV2Source(bytes) {
  const { v1SourcePin, transformedSourcePin } = GNU_SDK_V2_PINS;
  if (types.isProxy(bytes) || !Buffer.isBuffer(bytes) || typedLength.call(bytes) !== v1SourcePin.bytes ||
    digest(bytes) !== v1SourcePin.sha256) stop('E_SOURCE_PIN');
  const source = bytes.toString('utf8'), needle = 'maxStreamEvents: 32_768';
  if (source.split(needle).length !== 2) stop('E_SOURCE_PIN');
  const transformed = Buffer.from(source.replace(needle, 'maxStreamEvents: 262_144'));
  if (transformed.length !== transformedSourcePin.bytes || digest(transformed) !== transformedSourcePin.sha256) stop('E_SOURCE_PIN');
  return transformed;
}

// WHAT: Saturating, payload-free observers for already-wired child streams.
export function createSdkV2Diagnostics() {
  let stdoutEvents = 0, stderrEvents = 0, stdoutBytes = 0, stderrBytes = 0;
  let diagnosticCountersComplete = true, attached = false;
  const maxEvents = 262_144 + 64, maxBytes = 1_073_741_824 + 1_048_576 + 8192;
  function observe(which, chunk) {
    if (!diagnosticCountersComplete) return;
    try {
      if (types.isProxy(chunk) || !Buffer.isBuffer(chunk)) { diagnosticCountersComplete = false; return; }
      const length = typedLength.call(chunk);
      if (stdoutEvents + stderrEvents >= maxEvents || length > maxBytes - stdoutBytes - stderrBytes) {
        diagnosticCountersComplete = false;
        return;
      }
      if (which === 'stdout') { stdoutEvents++; stdoutBytes += length; }
      else { stderrEvents++; stderrBytes += length; }
    } catch { diagnosticCountersComplete = false; }
  }
  return Object.freeze({
    observeSdkChild(child) {
      if (attached) { diagnosticCountersComplete = false; return; }
      attached = true;
      try {
        child.stdout.on('data', chunk => observe('stdout', chunk));
        child.stderr.on('data', chunk => observe('stderr', chunk));
      } catch { diagnosticCountersComplete = false; }
    },
    snapshot() {
      return Object.freeze({ stdoutEvents, stderrEvents, stdoutBytes, stderrBytes, diagnosticCountersComplete,
        diagnosticCountersScope: 'observed Node data packets; not OS syscall counts' });
    },
  });
}

export async function runRegisteredGnuSdkInventoryV2() {
  const started = performance.now();
  let last = started, result = null, error = null, stageAccountingComplete = false;
  const diagnostics = createSdkV2Diagnostics();
  const counts = { sourceReads: 0, sourceBytes: 0, receiptReads: 0, spawnAttempts: 0,
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
    counts.receiptReads++;
    const receiptBytes = fs.readFileSync('/tmp/opencode/f9-bootstrap-correspondence/_spec/tooling/native-ingress/xz-qualification.receipt.json');
    if (receiptBytes.length !== 4239 || digest(receiptBytes) !== receiptSha256) stop('E_SOURCE_PIN');
    const receipt = JSON.parse(receiptBytes.toString('utf8'));
    if (receipt.status !== 'FINITE_XZ_PROFILE_OBSERVED' || receipt.counts.spawnEvents !== 33 ||
      receipt.fixtureManifestSha256 !== '632a0d812366712ae99ce2ce442ad98a59534430640184f70af53df58656b4ea') stop('E_RECEIPT');
    sources.set('gnu-sdk-inventory', transformSdkInventoryV2Source(sources.get('gnu-sdk-inventory')));
    const uri = bytes => 'data:text/javascript;base64,' + bytes.toString('base64');
    function link(name, dependency) {
      const source = sources.get(name).toString('utf8'), needle = "from './" + dependency + ".mjs'";
      if (source.split(needle).length !== 2) stop('E_SOURCE_PIN');
      return Buffer.from(source.replace(needle, "from '" + uri(sources.get(dependency)) + "'"));
    }
    const stageSource = link('xz-staging', 'elf-metadata');
    if (stageSource.length !== 43154 || digest(stageSource) !== '89b6c5e3dcbf902937f81fc642d7238bd4ec4ca3c94f6b61f4d069efdce8c5f2') stop('E_SOURCE_PIN');
    const inventorySource = link('gnu-sdk-inventory', 'tar-inventory');
    if (inventorySource.length !== GNU_SDK_V2_PINS.linkedSourcePin.bytes ||
      digest(inventorySource) !== GNU_SDK_V2_PINS.linkedSourcePin.sha256) stop('E_SOURCE_PIN');
    const [stage, inventory] = await Promise.all([import(uri(stageSource)), import(uri(inventorySource))]);
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
  const base = { profile: 'registered-gnu-sdk-inventory-v2', status: error ? 'STOP' : 'GNU_SDK_DATA_INVENTORY',
    rawStreamEventLimit: 262144, ...GNU_SDK_V2_PINS, diagnostics: diagnostics.snapshot(),
    counts, stageAccountingComplete, stageCountersScope: 'completed verification helpers',
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
