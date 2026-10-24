// SPEC: _spec/tooling/native-ingress/gnu-sdk-inventory-v3.puml
import { createTarInventory as original } from './tar-inventory.mjs';
import { types } from 'node:util';

const typedLength = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), 'length').get;
const codes = new Set([
  'E_LIMITS', 'E_UTF8', 'E_TEXT', 'E_NUMBER', 'E_PAX_NUMBER', 'E_PAX', 'E_PAX_KEY',
  'E_PAX_DUPLICATE', 'E_PATH', 'E_SEALED', 'E_INTERNAL', 'E_GNU_LONG', 'E_DANGLING_EXTENSION',
  'E_TERMINATOR', 'E_HEADERS', 'E_CHECKSUM', 'E_MAGIC', 'E_SIZE', 'E_EXTENSION_REPEAT',
  'E_EXTENSION_BYTES', 'E_TYPE', 'E_NONFILE_BODY', 'E_LINK', 'E_COLLISION', 'E_COLLISION_BYTES',
  'E_EVENT_BYTES', 'E_OUTPUT_BYTES', 'E_SPAN_BYTES', 'E_CHUNK', 'E_DATA_EVENTS',
  'E_EXPANDED_BYTES', 'E_TRAILING', 'E_PADDING', 'E_TRUNCATED',
]);
const maxCalls = 32_769, maxBytes = 1_073_741_824 + 1_048_576;
const empty = () => ({ feedCalls: 0, completedFeedCalls: 0, attemptedFeedBytes: 0,
  errorPhase: null, errorCode: null, diagnosticCountersComplete: true });
let latest = empty();

// WHAT: Snapshot of the latest parser wrapper in this module instance.
export function snapshotTarInventoryDiagnostics() {
  return Object.freeze({ ...latest });
}

// WHAT: Transparent observation of a trusted parser with per-instance counters.
export function observeTarInventory(parser) {
  const state = empty();
  latest = state;
  function attempt(bytes) {
    try {
      if (state.feedCalls < maxCalls) state.feedCalls++;
      else state.diagnosticCountersComplete = false;
      if (types.isProxy(bytes) || !types.isUint8Array(bytes)) { state.diagnosticCountersComplete = false; return; }
      const length = typedLength.call(bytes);
      if (length > maxBytes - state.attemptedFeedBytes) {
        state.attemptedFeedBytes = maxBytes;
        state.diagnosticCountersComplete = false;
      } else state.attemptedFeedBytes += length;
    } catch { state.diagnosticCountersComplete = false; }
  }
  function completed() {
    if (state.completedFeedCalls < maxCalls) state.completedFeedCalls++;
    else state.diagnosticCountersComplete = false;
  }
  function failure(phase, error) {
    if (state.errorPhase !== null) return;
    state.errorPhase = phase;
    state.errorCode = 'UNCLASSIFIED';
    try {
      if (error === null || !['object', 'function'].includes(typeof error) || types.isProxy(error)) return;
      const descriptor = Object.getOwnPropertyDescriptor(error, 'code');
      if (descriptor && Object.hasOwn(descriptor, 'value') && typeof descriptor.value === 'string' && codes.has(descriptor.value)) {
        state.errorCode = descriptor.value;
      }
    } catch { state.diagnosticCountersComplete = false; }
  }
  return Object.freeze({
    feed(...args) {
      attempt(args[0]);
      let result;
      try { result = parser.feed(...args); }
      catch (error) { failure('feed', error); throw error; }
      completed();
      return result;
    },
    finish(...args) {
      try { return parser.finish(...args); }
      catch (error) { failure('finish', error); throw error; }
    },
  });
}

// WHAT: Unmodified TAR factory with a latest-instance diagnostic snapshot.
export function createTarInventory(...args) {
  latest = empty();
  return observeTarInventory(original(...args));
}
