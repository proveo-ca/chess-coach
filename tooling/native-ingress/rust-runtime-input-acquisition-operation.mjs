// SPEC: _spec/tooling/native-ingress/rust-runtime-inputs.puml
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { types } from 'node:util';

export const RUST_INPUT_ACQUISITION_SOURCE_PIN = Object.freeze({ bytes: 22259, sha256: 'b59e0ab22f10acefbeef5aca69205f189145b06ec290eb4415fd84a2814042a7' });
const SOURCE = '/tmp/opencode/f9-bootstrap-correspondence/tooling/native-ingress/rust-runtime-input-acquisition.mjs';
const TYPED = Object.getPrototypeOf(Uint8Array.prototype);
const LENGTH = Object.getOwnPropertyDescriptor(TYPED, 'length').get;
const BACKING = Object.getOwnPropertyDescriptor(TYPED, 'buffer').get;
const OFFSET = Object.getOwnPropertyDescriptor(TYPED, 'byteOffset').get;
const ARRAY_LENGTH = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength').get;
const RESIZABLE = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
const fail = code => { const error = new Error(code); error.code = code; throw error; };

export function captureRegisteredRustAcquisitionSource(raw) {
  if (types.isProxy(raw) || !Buffer.isBuffer(raw)) fail('E_SOURCE_PIN');
  let bytes;
  try {
    const length = LENGTH.call(raw), backing = BACKING.call(raw);
    ARRAY_LENGTH.call(backing);
    if (RESIZABLE?.call(backing)) fail('E_SOURCE_PIN');
    if (length !== RUST_INPUT_ACQUISITION_SOURCE_PIN.bytes) fail('E_SOURCE_PIN');
    bytes = Buffer.alloc(length);
    Uint8Array.prototype.set.call(bytes, new Uint8Array(backing, OFFSET.call(raw), length));
  } catch { fail('E_SOURCE_PIN'); }
  if (createHash('sha256').update(bytes).digest('hex') !== RUST_INPUT_ACQUISITION_SOURCE_PIN.sha256) fail('E_SOURCE_PIN');
  return bytes;
}

// WHAT: One captured source import and one fixed acquisition; returns one ASCII JSONLF.
export async function runRegisteredRustRuntimeInputAcquisition() {
  const started = process.hrtime.bigint();
  const counts = { sourceReadAttempts: 0, sourceReads: 0, sourceBytes: 0, sourceImports: 0, acquisitionCalls: 0 };
  let result = null, error = null, sourceAccountingComplete = false;
  try {
    counts.sourceReadAttempts++;
    const raw = fs.readFileSync(SOURCE);
    counts.sourceReads++; counts.sourceBytes = LENGTH.call(raw);
    const captured = captureRegisteredRustAcquisitionSource(raw);
    sourceAccountingComplete = true;
    const uri = 'data:text/javascript;base64,' + captured.toString('base64');
    const helper = await import(uri);
    counts.sourceImports++;
    if (process.hrtime.bigint() - started >= 3000000000n) fail('E_DEADLINE');
    counts.acquisitionCalls++;
    result = await helper.acquireRegisteredRustInputs();
    if (result.status !== 'RUST_INPUT_BYTES_MATCHED' || result.mockOnly !== false) error = result.error ?? 'E_RESULT';
  } catch (failure) {
    error = ['E_SOURCE_PIN', 'E_DEADLINE'].includes(failure?.code) ? failure.code : 'E_IO';
  }
  const base = { profile: 'registered-rust-runtime-input-acquisition-operation-v1', sourcePin: RUST_INPUT_ACQUISITION_SOURCE_PIN,
    counts, sourceAccountingComplete, sourceCountersLowerBounds: !sourceAccountingComplete,
    acquisitionAccountingComplete: result !== null,
    acquisitionCountersLowerBounds: result === null || result.counterLowerBoundsOnFailure,
    sourceCountersScope: 'completedLogicalNodeOperations; sourceReadAttempts and acquisitionCalls are attempts',
    status: error ? 'STOP' : 'RUST_INPUT_BYTES_MATCHED', error, result,
    archiveExtracted: false, installedUsability: false, nativeQualified: false, rustReady: false,
    trainingReady: false, nativeAuthority: false, filesInstalled: false };
  let text = JSON.stringify(base) + '\n';
  if (!/^[\x20-\x7e]*\n$/.test(text) || Buffer.byteLength(text) > 24576) {
    error = 'E_OUTPUT';
    text = JSON.stringify({ profile: base.profile, status: 'STOP', error, counts, sourceAccountingComplete,
      sourceCountersLowerBounds: !sourceAccountingComplete, acquisitionAccountingComplete: false,
      acquisitionCountersLowerBounds: true, archiveExtracted: false, installedUsability: false,
      nativeQualified: false, rustReady: false, trainingReady: false, nativeAuthority: false, filesInstalled: false }) + '\n';
  }
  return Object.freeze({ exitCode: error ? 1 : 0, text });
}
