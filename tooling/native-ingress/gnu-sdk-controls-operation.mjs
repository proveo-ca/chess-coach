// SPEC: _spec/tooling/native-ingress/gnu-sdk-controls.puml
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
  ['sdk-control-inspection', 15257, 'f6736f8f00524782a32784b7a2f3bba350d39633545f521f12924524b8a856fa'],
];
export const SDK_CONTROLS_SOURCE_PINS = Object.freeze({
  originalCore: Object.freeze({ bytes: 23261, sha256: 'bd2fc43633ca3b8f0c485eddb68a1b7505002edecd70eee4bf9cc661f588ef29' }),
  streamCore: Object.freeze({ bytes: 23262, sha256: 'c163c52e915104a017d21c8e9d4db545f760d8c5c0652a270e38cad6fdeda8da' }),
  controlsCore: Object.freeze({ bytes: 23264, sha256: 'ac4aba7af508898603f7b19e37c9d31b5af488dab14192dd6560186b7654c12c' }),
  transformedTar: Object.freeze({ bytes: 15568, sha256: '56cac49b3cfe51dbf2a7f7d1f4a0d877ae8773f940585ebea72740373689fae2' }),
  inspection: Object.freeze({ bytes: 15257, sha256: 'f6736f8f00524782a32784b7a2f3bba350d39633545f521f12924524b8a856fa' }),
  linkedInspection: Object.freeze({ bytes: 36026, sha256: 'f5806e75d5d1e872e6e5ebe62f891762fdd6ec685108e8adf2d4d672508c9d4f' }),
  linkedPipeline: Object.freeze({ bytes: 71309, sha256: 'dccab592815279a160181fc84d1c7aab320f8868ae209562c9abce592afa4c64' }),
});
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
  'E_TARGET', 'E_SPAN', 'E_TEXT', 'E_ELF', 'E_RANGE', 'E_PROGRAM_HEADERS', 'E_INTERPRETER', 'E_DYNAMIC',
  'E_STRING_TABLE', 'E_STRING', 'E_VERSIONS', 'E_NOTES', 'E_PROPERTIES', 'E_LIMITS']);
const fail = code => { const error = new Error(code); error.code = code; Object.freeze(error); throw error; };
const typedPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const typedLength = Object.getOwnPropertyDescriptor(typedPrototype, 'length').get;
const typedBuffer = Object.getOwnPropertyDescriptor(typedPrototype, 'buffer').get;
const typedOffset = Object.getOwnPropertyDescriptor(typedPrototype, 'byteOffset').get;
const ascii = text => text.replace(/[^\x00-\x7f]/g, ch => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'));
function pinned(bytes, pin) { if (bytes.length !== pin.bytes || sha(bytes) !== pin.sha256) fail('E_SOURCE_PIN'); return bytes; }

// WHAT: Checked internal core-summary envelope; all streaming and parser limits remain fixed.
export function transformSdkControlsCoreSource(bytes) {
  if (types.isProxy(bytes) || !Buffer.isBuffer(bytes) || typedLength.call(bytes) !== SDK_CONTROLS_SOURCE_PINS.streamCore.bytes) fail('E_SOURCE_PIN');
  const backing = typedBuffer.call(bytes);
  if (types.isSharedArrayBuffer(backing)) fail('E_SOURCE_PIN');
  const captured = Buffer.from(new Uint8Array(backing, typedOffset.call(bytes), typedLength.call(bytes)));
  if (sha(captured) !== SDK_CONTROLS_SOURCE_PINS.streamCore.sha256) fail('E_SOURCE_PIN');
  const source = captured.toString('utf8'), needle = 'maxSummaryBytes: 262_144';
  if (source.split(needle).length !== 2) fail('E_SOURCE_PIN');
  return pinned(Buffer.from(source.replace(needle, 'maxSummaryBytes: 4_194_304')), SDK_CONTROLS_SOURCE_PINS.controlsCore);
}

export async function runRegisteredGnuSdkControls() {
  const started = performance.now();
  let last = started, error = null, result = null, inspection = null, payloads = null;
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
    function receipt(name, bytes, sha256) {
      guard(10000); counts.receiptReads++;
      const input = fs.readFileSync('/tmp/opencode/f9-bootstrap-correspondence/_spec/tooling/native-ingress/' + name + '.receipt.json');
      counts.receiptBytes += input.length; pinned(input, { bytes, sha256 });
      return JSON.parse(input.toString('utf8'));
    }
    const stagedReceipt = receipt('xz-qualification', 4239, 'e45d65231c0815ab2b895c0d74467500a0e6caf33cc0a4ee342b20489ce6b233');
    if (stagedReceipt.status !== 'FINITE_XZ_PROFILE_OBSERVED' || stagedReceipt.counts.spawnEvents !== 33 ||
      stagedReceipt.fixtureManifestSha256 !== '632a0d812366712ae99ce2ce442ad98a59534430640184f70af53df58656b4ea') fail('E_RECEIPT');
    const prior = receipt('gnu-sdk-inventory-v4', 2732, '755a922e587e17b5978e3df77f96ac4a6fb43499d19df895c9148f0952fedcf5');
    if (prior.profile !== 'registered-gnu-sdk-inventory-v4' || prior.status !== 'GNU_SDK_DATA_INVENTORY') fail('E_RECEIPT');
    receiptAccountingComplete = true;
    const uri = bytes => 'data:text/javascript;base64,' + bytes.toString('base64');
    const [v2, v4] = await Promise.all([import(uri(sources.get('gnu-sdk-inventory-v2-operation'))),
      import(uri(sources.get('gnu-sdk-inventory-v4-operation')))]);
    guard(10000);
    const tar = pinned(v4.transformTarInventoryV4Source(sources.get('tar-inventory')), SDK_CONTROLS_SOURCE_PINS.transformedTar);
    const core = transformSdkControlsCoreSource(v2.transformSdkInventoryV2Source(sources.get('gnu-sdk-inventory')));
    function link(bytes, dependency, dependencyUri) {
      const source = bytes.toString('utf8'), needle = "from './" + dependency + ".mjs'";
      if (source.split(needle).length !== 2) fail('E_SOURCE_PIN');
      return Buffer.from(source.replace(needle, "from '" + dependencyUri + "'"));
    }
    const elfUri = uri(sources.get('elf-metadata'));
    const stageSource = link(sources.get('xz-staging'), 'elf-metadata', elfUri);
    pinned(stageSource, { bytes: 43154, sha256: '89b6c5e3dcbf902937f81fc642d7238bd4ec4ca3c94f6b61f4d069efdce8c5f2' });
    const inspectionSource = pinned(link(sources.get('sdk-control-inspection'), 'tar-inventory', uri(tar)), SDK_CONTROLS_SOURCE_PINS.linkedInspection);
    const inspectionUri = uri(inspectionSource);
    const pipelineSource = pinned(link(core, 'tar-inventory', inspectionUri), SDK_CONTROLS_SOURCE_PINS.linkedPipeline);
    const [stage, inventory, controls, elf] = await Promise.all([
      import(uri(stageSource)), import(uri(pipelineSource)), import(inspectionUri), import(elfUri),
    ]);
    inspection = controls;
    if (!Object.entries(controls.SDK_CONTROL_EXPECTATION).every(([key, value]) => prior.inventory[key] === value) ||
      !controls.SDK_CONTROLS.every((target, index) => ['path', 'index', 'size'].every(key => target[key] === prior.registeredControlMembers[index][key]))) fail('E_RECEIPT');
    guard(10000);
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
          guard();
          attempts++; counts.spawnAttempts++;
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
    inspection.beginMemberPass();
    let first = await runPass(1);
    const metadata = inspection.acceptMemberPass(first); first = null;
    if (started + 250000 - guard() < 120000) fail('E_DEADLINE');
    inspection.beginCapturePass();
    const second = await runPass(2);
    inspection.acceptCapturePass(second); guard();
    if (counts.archivePasses !== 4 || counts.archiveDataBytes !== 409185120 || counts.archiveRequestedBytes !== 409185124 ||
      counts.archiveCloseAttempts !== 4 || counts.spawnAttempts !== 2 || counts.spawnEvents !== 2 || counts.stageChecks !== 4 || counts.preloadChecks !== 4) fail('E_RECEIPT');
    payloads = inspection.getCapturedControls();
    const wrapper = payloads.find(target => target.key === 'wrapper'), script = payloads.find(target => target.key === 'script');
    let scriptText;
    try { scriptText = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(script.bytes); }
    catch { fail('E_TEXT'); }
    if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/u.test(scriptText) || Buffer.byteLength(ascii(JSON.stringify(scriptText))) > 8192) fail('E_TEXT');
    const observed = elf.inspectElf64Requirements(wrapper.bytes, { maxInputBytes: 14704, maxOutputBytes: 65536 });
    if (observed.inputSha256 !== wrapper.sha256) fail('E_HASH');
    const wrapperMetadata = { profile: observed.profile, header: observed.header, interpreter: observed.interpreter,
      needed: observed.dynamic.needed, soname: observed.dynamic.soname, rpath: observed.dynamic.rpath, runpath: observed.dynamic.runpath,
      versionNeeds: observed.requirements.versionNeeds, versionDefinitions: observed.requirements.versionDefinitions,
      buildIds: observed.requirements.buildIds, abiTags: observed.requirements.abiTags, properties: observed.requirements.properties,
      scope: 'archive bytes only; wrapper not executed', candidateExecuted: false, decoderQualified: false,
      realCandidateRead: false, realArchiveInspected: false, nativeAuthority: false,
      nativeQualified: false, installedUsability: false, pythonFreeSubsetVerified: false, rustReady: false, trainingReady: false,
      loaderClosureVerified: false, provenanceVerified: false,
      noPythonRuntimeVerified: false, symbolBindingsVerified: false, hardwareCompatibilityVerified: false,
      instructionCoverageVerified: false, propertyEnforcementVerified: false, buildIdAuthenticated: false };
    if (Buffer.byteLength(ascii(JSON.stringify(wrapperMetadata))) > 65536) fail('E_OUTPUT');
    result = { summary: metadata.summary, candidates: metadata.candidates,
      decodedSha256: metadata.decodedSha256, decodedDigestScope: 'established by accepted pass one; equality checked in pass two',
      wrapper: { path: wrapper.path, index: wrapper.index, byteLength: wrapper.size, sha256: wrapper.sha256, metadata: wrapperMetadata },
      script: { path: script.path, index: script.index, byteLength: script.size, sha256: script.sha256, interpretation: 'DATA_ONLY_NOT_EXECUTED', scriptText } };
    guard();
  } catch (failure) {
    const descriptor = failure && !types.isProxy(failure) ? Object.getOwnPropertyDescriptor(failure, 'code') : null;
    error = descriptor && Object.hasOwn(descriptor, 'value') && codes.has(descriptor.value) ? descriptor.value : 'E_IO';
    if (inspection) inspection.abortControlInspection(); result = null;
  } finally { if (payloads) for (const payload of payloads) payload.bytes.fill(0); }
  const base = { profile: 'registered-gnu-sdk-controls-v1', status: error ? 'STOP' : 'SDK_CONTROL_DATA_INSPECTION',
    sourcePins: SDK_CONTROLS_SOURCE_PINS, counts, sourceAccountingComplete, receiptAccountingComplete, stageAccountingComplete,
    sourceCountersScope: 'attempted source/receipt reads; bytes returned by completed reads',
    stageCountersScope: 'completed verification helpers', archiveAccountingComplete: counts.completedCorePasses === 2,
    archiveCountersScope: 'completed joint-core results only', packetDiagnostics: packets.map(value => value.snapshot()),
    inspection: inspection ? inspection.snapshotControlInspection() : null,
    candidateInvocationAttempted: counts.spawnAttempts > 0,
    candidateExecuted: counts.completedCorePasses === 2 ? true : counts.spawnAttempts === 0 ? false : null,
    realArchiveInspected: error === null, archiveExtracted: false, filesInstalled: false, pythonRuntimeInvoked: false,
    nativeQualified: false, installedUsability: false, pythonFreeSubsetVerified: false, rustReady: false, trainingReady: false,
    hardRssBounded: false, hardDeadlineGuaranteed: false, processTreeBounded: false };
  let text = ascii(JSON.stringify({ ...base, ...(error ? { error } : { result }) })) + '\n';
  if (Buffer.byteLength(text) > 262144) { error = 'E_OUTPUT'; text = JSON.stringify({ ...base, status: 'STOP', realArchiveInspected: false, error }) + '\n'; }
  if (!error) {
    try { guard(); } catch { error = 'E_DEADLINE'; text = JSON.stringify({ ...base, status: 'STOP', realArchiveInspected: false, error }) + '\n'; }
  }
  return Object.freeze({ exitCode: error ? 1 : 0, text });
}
