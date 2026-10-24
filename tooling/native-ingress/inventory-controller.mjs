// SPEC: _spec/tooling/native-ingress/inventory.puml
import { types } from 'node:util';
import { createTarInventory, INVENTORY_LIMITS, InventoryError } from './tar-inventory.mjs';

export const MOCK_INVENTORY_LIMITS = Object.freeze({
  ...INVENTORY_LIMITS,
  maxDurationMs: 120_000,
  maxCleanupMs: 1000,
  maxSourceEvents: 32_768,
});

const fail = (code) => { throw new InventoryError(code); };
const now = () => performance.now();

function ownData(object, key, code) {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail(code);
  return descriptor.value;
}

function plain(object, code) {
  if (!object || typeof object !== 'object' || types.isProxy(object)) fail(code);
  const prototype = Object.getPrototypeOf(object);
  if (prototype !== Object.prototype && prototype !== null) fail(code);
}

function captureLimits(overrides) {
  plain(overrides, 'E_LIMITS');
  const limits = { ...MOCK_INVENTORY_LIMITS };
  for (const key of Reflect.ownKeys(overrides)) {
    if (typeof key !== 'string' || !Object.hasOwn(limits, key)) fail('E_LIMITS');
    const value = ownData(overrides, key, 'E_LIMITS');
    if (!Number.isSafeInteger(value) || value < 1 || value > limits[key]) fail('E_LIMITS');
    limits[key] = value;
  }
  if (limits.maxCleanupMs >= limits.maxDurationMs) fail('E_LIMITS');
  return Object.freeze(limits);
}

function receipt(value) {
  plain(value, 'E_COMPLETION');
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 3 || !['mockOnly', 'integrityVerified', 'compressedInputFullyAccountedFor'].every((key) => ownData(value, key, 'E_COMPLETION') === true)) fail('E_COMPLETION');
}

// Mock-only protocol: own data mockOnly/next/return; done receipts attest only the test contract.
export async function runMockInventory(source, sink, overrides = {}) {
  const started = now();
  const limits = captureLimits(overrides);
  const totalDeadline = started + limits.maxDurationMs;
  const workDeadline = totalDeadline - limits.maxCleanupMs;
  const parserLimits = {};
  for (const key of Object.keys(INVENTORY_LIMITS)) parserLimits[key] = limits[key];
  const parser = createTarInventory(parserLimits);
  plain(source, 'E_SOURCE');
  const sourceKeys = Reflect.ownKeys(source);
  if (sourceKeys.length !== 3 || !sourceKeys.every((key) => ['mockOnly', 'next', 'return'].includes(key))) fail('E_SOURCE');
  if (ownData(source, 'mockOnly', 'E_SOURCE') !== true) fail('E_SOURCE');
  const next = ownData(source, 'next', 'E_SOURCE');
  const close = ownData(source, 'return', 'E_SOURCE');
  if (typeof next !== 'function' || typeof close !== 'function' || typeof sink !== 'function' || types.isProxy(next) || types.isProxy(close) || types.isProxy(sink)) fail('E_SOURCE');
  let acquired = false;
  let completed = false;
  let returned = false;
  let sourceEvents = 0;

  function check(deadline, code) {
    if (now() >= deadline) fail(code);
  }

  async function bounded(callback, deadline, code) {
    check(deadline, code);
    let timer;
    try {
      const operation = Promise.resolve().then(() => {
        check(deadline, code);
        let result;
        try { result = callback(); } catch { fail(code === 'E_SOURCE_CLEANUP' ? code : 'E_CALLBACK'); }
        return Promise.resolve(result).then((value) => value, () => { fail(code === 'E_SOURCE_CLEANUP' ? code : 'E_CALLBACK'); });
      });
      const timeout = new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new InventoryError(code)), Math.max(0, deadline - now()));
      });
      const result = await Promise.race([operation, timeout]);
      check(deadline, code);
      return result;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  try {
    while (true) {
      check(workDeadline, 'E_DEADLINE');
      acquired = true;
      const step = await bounded(() => Reflect.apply(next, source, []), workDeadline, 'E_DEADLINE');
      plain(step, 'E_SOURCE_STEP');
      if (Reflect.ownKeys(step).length !== 2) fail('E_SOURCE_STEP');
      const done = ownData(step, 'done', 'E_SOURCE_STEP');
      const value = ownData(step, 'value', 'E_SOURCE_STEP');
      if (done === true) {
        receipt(value);
        check(workDeadline, 'E_DEADLINE');
        completed = true;
        const parserSummary = parser.finish();
        check(workDeadline, 'E_DEADLINE');
        return Object.freeze({
          state: 'MOCK_INVENTORY',
          mockOnly: true,
          decoderQualified: false,
          realArchiveInspected: false,
          extractionAuthorized: false,
          nativeQualified: false,
          provenanceVerified: false,
          pythonFreeSubsetVerified: false,
          installedUsability: false,
          rustReady: false,
          trainingReady: false,
          sourceEvents,
          parserSummary,
        });
      }
      if (done !== false) fail('E_SOURCE_STEP');
      if (++sourceEvents > limits.maxSourceEvents) fail('E_SOURCE_EVENTS');
      check(workDeadline, 'E_DEADLINE');
      const events = parser.feed(value);
      check(workDeadline, 'E_DEADLINE');
      for (const event of events) {
        await bounded(() => sink(event), workDeadline, 'E_DEADLINE');
      }
    }
  } catch (cause) {
    const original = cause instanceof InventoryError ? cause : new InventoryError('E_CALLBACK');
    if (acquired && !completed && !returned) {
      returned = true;
      try {
        await bounded(() => Reflect.apply(close, source, []), Math.min(totalDeadline, now() + limits.maxCleanupMs), 'E_SOURCE_CLEANUP');
      } catch {
        throw new InventoryError('E_SOURCE_CLEANUP', original);
      }
    }
    throw original;
  }
}
