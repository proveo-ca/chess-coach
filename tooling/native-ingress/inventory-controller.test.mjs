// SPEC: _spec/tooling/native-ingress/inventory.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import { runMockInventory, MOCK_INVENTORY_LIMITS } from './inventory-controller.mjs';
import { InventoryError } from './tar-inventory.mjs';

const completion = () => ({ mockOnly: true, integrityVerified: true, compressedInputFullyAccountedFor: true });
const done = (value = completion()) => ({ done: true, value });
const chunk = (value) => ({ done: false, value });
const empty = () => Buffer.alloc(1024);

function member(path = 'a') {
  const bytes = Buffer.alloc(512);
  bytes.write(path, 0, 100);
  for (const [offset, width] of [[100, 8], [108, 8], [116, 8], [124, 12], [136, 12]]) bytes.write(`${'0'.repeat(width - 1)}\0`, offset, width);
  bytes[156] = 48;
  bytes.fill(32, 148, 156);
  const sum = bytes.reduce((total, byte) => total + byte, 0);
  bytes.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148, 8);
  return bytes;
}

function sourceOf(steps, close = () => undefined) {
  let calls = 0;
  let returns = 0;
  return {
    source: { mockOnly: true, next() { calls++; return steps.shift() ?? done(); }, return() { returns++; return close(); } },
    calls: () => calls,
    returns: () => returns,
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function drain() {
  for (let i = 0; i < 40; i++) await Promise.resolve();
}

function observe(promise) {
  const state = { settled: false };
  promise.then((value) => { state.settled = true; state.value = value; }, (error) => { state.settled = true; state.error = error; });
  return state;
}

function fakeClock(t) {
  let time = 0;
  let id = 0;
  const timers = new Map();
  t.mock.method(performance, 'now', () => time);
  t.mock.method(globalThis, 'setTimeout', (callback, delay) => {
    const key = ++id;
    timers.set(key, { callback, at: time + delay });
    return key;
  });
  t.mock.method(globalThis, 'clearTimeout', (key) => timers.delete(key));
  return {
    async tick(ms) {
      time += ms;
      for (const [key, timer] of [...timers]) {
        if (timer.at <= time) {
          timers.delete(key);
          timer.callback();
        }
      }
      await drain();
    },
    timers: () => timers.size,
    jump(ms) { time += ms; },
  };
}

const shortLimits = { maxDurationMs: 20, maxCleanupMs: 5 };

test('mock success requires explicit completion and preserves negative qualification flags', async () => {
  const fixture = sourceOf([chunk(Buffer.concat([member(), empty()])), done()]);
  const events = [];
  const result = await runMockInventory(fixture.source, (event) => events.push(event));
  assert.equal(result.state, 'MOCK_INVENTORY');
  assert.equal(result.mockOnly, true);
  assert.equal(result.parserSummary.state, 'TAR_INVENTORY');
  assert.equal(result.sourceEvents, 1);
  assert.equal(events.length, 1);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.parserSummary), true);
  for (const key of ['decoderQualified', 'realArchiveInspected', 'extractionAuthorized', 'nativeQualified', 'provenanceVerified', 'pythonFreeSubsetVerified', 'installedUsability', 'rustReady', 'trainingReady']) assert.equal(result[key], false);
  assert.equal(Object.hasOwn(result, 'compressedArchiveVerified'), false);
  assert.equal(fixture.calls(), 2);
  assert.equal(fixture.returns(), 0);
});

test('empty mock inventory succeeds without sink calls', async () => {
  const fixture = sourceOf([chunk(empty()), done()]);
  const result = await runMockInventory(fixture.source, () => assert.fail('no entries'));
  assert.equal(result.parserSummary.entries, 0);
});

for (const [label, source] of [
  ['null', null], ['array', []], ['unknown', { mockOnly: true, next() {}, return() {}, extra: true }],
  ['unmarked', { mockOnly: false, next() {}, return() {} }], ['missing return', { mockOnly: true, next() {} }],
  ['inherited', Object.create({ mockOnly: true, next() {}, return() {} })],
  ['proxy', new Proxy({ mockOnly: true, next() {}, return() {} }, {})],
  ['symbol', { mockOnly: true, next() {}, return() {}, [Symbol('extra')]: true }],
  ['bad next', { mockOnly: true, next: 1, return() {} }],
  ['getter', { mockOnly: true, get next() { throw new Error('getter'); }, return() {} }],
]) {
  test(`source admission rejects ${label} without acquiring callbacks`, async () => {
    await assert.rejects(runMockInventory(source, () => undefined), { code: 'E_SOURCE' });
  });
}
test('sink must be a non-proxy function before acquisition', async () => {
  for (const sink of [undefined, {}, new Proxy(() => undefined, {})]) {
    const fixture = sourceOf([]);
    await assert.rejects(runMockInventory(fixture.source, sink), { code: 'E_SOURCE' });
    assert.equal(fixture.calls(), 0);
    assert.equal(fixture.returns(), 0);
  }
});
test('proxy callbacks reject before acquisition', async () => {
  const fixture = sourceOf([]);
  fixture.source.next = new Proxy(fixture.source.next, {});
  await assert.rejects(runMockInventory(fixture.source, () => undefined), { code: 'E_SOURCE' });
  assert.equal(fixture.calls(), 0);
});

for (const [label, limits] of [
  ['extra', { extra: 1 }], ['symbol', { [Symbol('x')]: 1 }], ['increased duration', { maxDurationMs: 120001 }],
  ['increased parser cap', { maxHeaders: 65537 }], ['zero', { maxCleanupMs: 0 }], ['fractional', { maxSourceEvents: 1.5 }],
  ['inherited', Object.create({ maxHeaders: 1 })], ['proxy', new Proxy({}, {})],
  ['getter', { get maxHeaders() { throw new Error('getter'); } }],
  ['no work budget', { maxDurationMs: 5, maxCleanupMs: 5 }],
]) {
  test(`strict controller limits reject ${label} before callbacks`, async () => {
    const fixture = sourceOf([]);
    await assert.rejects(runMockInventory(fixture.source, () => undefined, limits), { code: 'E_LIMITS' });
    assert.equal(fixture.calls(), 0);
    assert.equal(fixture.returns(), 0);
  });
}

test('controller captures limits before trusted callbacks mutate them', async () => {
  const limits = { maxSourceEvents: 1 };
  const fixture = sourceOf([chunk(Buffer.alloc(512)), chunk(Buffer.alloc(512)), done()]);
  const next = fixture.source.next;
  fixture.source.next = () => { limits.maxSourceEvents = 20; return next(); };
  await assert.rejects(runMockInventory(fixture.source, () => undefined, limits), { code: 'E_SOURCE_EVENTS' });
  assert.equal(fixture.returns(), 1);
});

for (const [label, step] of [
  ['undefined', undefined], ['null', null], ['proxy', new Proxy({ done: true, value: completion() }, {})],
  ['missing done', { value: completion() }], ['nonboolean done', { done: 1, value: completion() }],
  ['extra field', { done: true, value: completion(), extra: 1 }],
  ['accessor done', { get done() { throw new Error('getter'); }, value: completion() }],
]) {
  test(`bad iterator step ${label} triggers one cleanup`, async () => {
    const fixture = sourceOf([]);
    fixture.source.next = () => step;
    await assert.rejects(runMockInventory(fixture.source, () => undefined), { code: 'E_SOURCE_STEP' });
    assert.equal(fixture.returns(), 1);
  });
}

for (const [label, value] of [
  ['undefined', undefined], ['false integrity', { ...completion(), integrityVerified: false }],
  ['false accounting', { ...completion(), compressedInputFullyAccountedFor: false }],
  ['false marker', { ...completion(), mockOnly: false }], ['missing flag', { mockOnly: true, integrityVerified: true }],
  ['extra flag', { ...completion(), decoderQualified: true }], ['proxy', new Proxy(completion(), {})],
  ['accessor', { mockOnly: true, integrityVerified: true, get compressedInputFullyAccountedFor() { throw new Error('getter'); } }],
]) {
  test(`completion rejects ${label} despite valid TAR`, async () => {
    const fixture = sourceOf([chunk(empty()), { done: true, value }]);
    await assert.rejects(runMockInventory(fixture.source, () => undefined), { code: 'E_COMPLETION' });
    assert.equal(fixture.returns(), 1);
  });
}

test('valid completion cannot certify truncated TAR', async () => {
  const fixture = sourceOf([chunk(Buffer.alloc(512)), done()]);
  await assert.rejects(runMockInventory(fixture.source, () => undefined), { code: 'E_TRUNCATED' });
  assert.equal(fixture.returns(), 0);
});
test('mock EOF without any TAR data is not success', async () => {
  const fixture = sourceOf([done()]);
  await assert.rejects(runMockInventory(fixture.source, () => undefined), { code: 'E_TRUNCATED' });
});
test('parser errors prevent sink and future source pulls', async () => {
  const fixture = sourceOf([chunk(Buffer.alloc(0)), chunk(empty()), done()]);
  await assert.rejects(runMockInventory(fixture.source, () => assert.fail('no sink')), { code: 'E_CHUNK' });
  assert.equal(fixture.calls(), 1);
  assert.equal(fixture.returns(), 1);
});
test('parser output admission runs before any sink call', async () => {
  const fixture = sourceOf([chunk(Buffer.concat([member(), empty()])), done()]);
  await assert.rejects(runMockInventory(fixture.source, () => assert.fail('no sink'), { maxOutputBytes: 1 }), { code: 'E_OUTPUT_BYTES' });
  assert.equal(fixture.calls(), 1);
});
test('source-event cap exact boundary allows explicit done', async () => {
  const fixture = sourceOf([chunk(empty()), done()]);
  assert.equal((await runMockInventory(fixture.source, () => undefined, { maxSourceEvents: 1 })).sourceEvents, 1);
});
test('source-event cap plus one rejects before feeding', async () => {
  const fixture = sourceOf([chunk(Buffer.alloc(512)), chunk(Buffer.alloc(512)), done()]);
  await assert.rejects(runMockInventory(fixture.source, () => undefined, { maxSourceEvents: 1 }), { code: 'E_SOURCE_EVENTS' });
  assert.equal(fixture.calls(), 2);
  assert.equal(fixture.returns(), 1);
});
test('parser data-event cap remains independent from source cap', async () => {
  const fixture = sourceOf([chunk(Buffer.alloc(512)), chunk(Buffer.alloc(512)), done()]);
  await assert.rejects(runMockInventory(fixture.source, () => undefined, { maxDataEvents: 1 }), { code: 'E_DATA_EVENTS' });
});

for (const asynchronous of [false, true]) {
  test(`${asynchronous ? 'async' : 'sync'} source failure becomes fixed error and closes once`, async () => {
    const fixture = sourceOf([]);
    fixture.source.next = () => {
      if (asynchronous) return Promise.reject(new Error('private-source-error'));
      throw new Error('private-source-error');
    };
    await assert.rejects(runMockInventory(fixture.source, () => undefined), (error) => error instanceof InventoryError && error.code === 'E_CALLBACK' && !error.message.includes('private'));
    assert.equal(fixture.returns(), 1);
  });
  test(`${asynchronous ? 'async' : 'sync'} sink failure stops later events and closes once`, async () => {
    const fixture = sourceOf([chunk(Buffer.concat([member('a'), member('b'), empty()])), done()]);
    let sinks = 0;
    await assert.rejects(runMockInventory(fixture.source, () => {
      sinks++;
      if (asynchronous) return Promise.reject(new Error('private-sink-error'));
      throw new Error('private-sink-error');
    }), { code: 'E_CALLBACK' });
    assert.equal(sinks, 1);
    assert.equal(fixture.calls(), 1);
    assert.equal(fixture.returns(), 1);
  });
}

test('backpressure awaits every sink before the next pull or success', async (t) => {
  const clock = fakeClock(t);
  const first = deferred();
  const second = deferred();
  const fixture = sourceOf([chunk(Buffer.concat([member('a'), member('b'), empty()])), done()]);
  const seen = [];
  const state = observe(runMockInventory(fixture.source, (event) => {
    seen.push(event.path);
    return seen.length === 1 ? first.promise : second.promise;
  }));
  await drain();
  assert.deepEqual(seen, ['a']);
  assert.equal(fixture.calls(), 1);
  assert.equal(state.settled, false);
  first.resolve();
  await drain();
  assert.deepEqual(seen, ['a', 'b']);
  assert.equal(fixture.calls(), 1);
  assert.equal(state.settled, false);
  second.resolve();
  await drain();
  assert.equal(state.settled, true);
  assert.equal(state.value.state, 'MOCK_INVENTORY');
  assert.equal(clock.timers(), 0);
});
test('TAR terminator alone does not bypass pending mock completion', async (t) => {
  const clock = fakeClock(t);
  const end = deferred();
  const fixture = sourceOf([chunk(empty()), end.promise]);
  const state = observe(runMockInventory(fixture.source, () => undefined));
  await drain();
  assert.equal(state.settled, false);
  end.resolve(done());
  await drain();
  assert.equal(state.settled, true);
  assert.equal(state.value.state, 'MOCK_INVENTORY');
  assert.equal(clock.timers(), 0);
});
test('late nonzero trailing data invalidates previously delivered provisional metadata', async (t) => {
  const clock = fakeClock(t);
  const fixture = sourceOf([
    chunk(Buffer.concat([member(), empty()])),
    chunk(Buffer.from([1])),
    chunk(empty()),
    done(),
  ]);
  const delivered = [];
  const state = observe(runMockInventory(fixture.source, (event) => delivered.push(event)));
  await drain();
  assert.equal(state.settled, true);
  assert.equal(state.error.code, 'E_TRAILING');
  assert.equal(state.value, undefined);
  assert.equal(delivered.length, 1);
  assert.equal(delivered[0].path, 'a');
  assert.equal(Object.isFrozen(delivered[0]), true);
  assert.equal(fixture.calls(), 2);
  assert.equal(fixture.returns(), 1);
  await drain();
  assert.equal(delivered.length, 1);
  assert.equal(fixture.calls(), 2);
  assert.equal(clock.timers(), 0);
});
test('sink-returned qualification objects cannot grant authority', async () => {
  const fixture = sourceOf([chunk(Buffer.concat([member(), empty()])), done()]);
  const result = await runMockInventory(fixture.source, () => ({ extractionAuthorized: true, nativeQualified: true }));
  assert.equal(result.extractionAuthorized, false);
  assert.equal(result.nativeQualified, false);
});
test('trusted sink receives only frozen metadata, not payload bytes', async () => {
  const fixture = sourceOf([chunk(Buffer.concat([member(), empty()])), done()]);
  await runMockInventory(fixture.source, (event) => {
    assert.equal(Object.isFrozen(event), true);
    assert.deepEqual(Object.keys(event), ['index', 'path', 'type', 'size', 'mode', 'uid', 'gid', 'mtime']);
    assert.equal(Object.values(event).some((value) => value instanceof Uint8Array), false);
  });
});

test('pending next times out, closes once and ignores late source bytes', async (t) => {
  const clock = fakeClock(t);
  const pending = deferred();
  const fixture = sourceOf([pending.promise]);
  let sinks = 0;
  const state = observe(runMockInventory(fixture.source, () => { sinks++; }, shortLimits));
  await drain();
  assert.equal(state.settled, false);
  await clock.tick(15);
  assert.equal(state.settled, true);
  assert.equal(state.error.code, 'E_DEADLINE');
  assert.equal(fixture.returns(), 1);
  pending.resolve(chunk(Buffer.concat([member(), empty()])));
  await drain();
  assert.equal(sinks, 0);
  assert.equal(fixture.calls(), 1);
  assert.equal(clock.timers(), 0);
});
test('late source rejection stays handled after timeout', async (t) => {
  const clock = fakeClock(t);
  const pending = deferred();
  const fixture = sourceOf([pending.promise]);
  const state = observe(runMockInventory(fixture.source, () => undefined, shortLimits));
  await drain();
  await clock.tick(15);
  assert.equal(state.settled, true);
  pending.reject(new Error('late-rejection'));
  await drain();
  assert.equal(state.error.code, 'E_DEADLINE');
  assert.equal(clock.timers(), 0);
});
test('pending sink timeout prevents all later sinks and next calls', async (t) => {
  const clock = fakeClock(t);
  const pending = deferred();
  const fixture = sourceOf([chunk(Buffer.concat([member('a'), member('b'), empty()])), done()]);
  let sinks = 0;
  const state = observe(runMockInventory(fixture.source, () => { sinks++; return pending.promise; }, shortLimits));
  await drain();
  assert.equal(sinks, 1);
  await clock.tick(15);
  assert.equal(state.settled, true);
  assert.equal(state.error.code, 'E_DEADLINE');
  pending.reject(new Error('late-sink-rejection'));
  await drain();
  assert.equal(sinks, 1);
  assert.equal(fixture.calls(), 1);
  assert.equal(fixture.returns(), 1);
  assert.equal(clock.timers(), 0);
});
test('timer cannot mint EOF or success', async (t) => {
  const clock = fakeClock(t);
  const pending = deferred();
  const fixture = sourceOf([chunk(empty()), pending.promise]);
  const state = observe(runMockInventory(fixture.source, () => undefined, shortLimits));
  await drain();
  await clock.tick(15);
  assert.equal(state.settled, true);
  assert.equal(state.error.code, 'E_DEADLINE');
  assert.equal(state.value, undefined);
  pending.resolve(done());
  await drain();
  assert.equal(state.value, undefined);
  assert.equal(clock.timers(), 0);
});
test('cleanup timeout consumes only its reserved budget', async (t) => {
  const clock = fakeClock(t);
  const pending = deferred();
  const cleanup = deferred();
  const fixture = sourceOf([pending.promise], () => cleanup.promise);
  const state = observe(runMockInventory(fixture.source, () => undefined, shortLimits));
  await drain();
  await clock.tick(15);
  assert.equal(state.settled, false);
  assert.equal(fixture.returns(), 1);
  await clock.tick(5);
  assert.equal(state.settled, true);
  assert.equal(state.error.code, 'E_SOURCE_CLEANUP');
  assert.equal(state.error.cause.code, 'E_DEADLINE');
  assert.equal(clock.timers(), 0);
  pending.reject(new Error('late-next'));
  cleanup.reject(new Error('late-return'));
  await drain();
});
test('early failure cleanup is bounded by cleanup cap, not full remaining work', async (t) => {
  const clock = fakeClock(t);
  const cleanup = deferred();
  const fixture = sourceOf([chunk(Buffer.alloc(0))], () => cleanup.promise);
  const state = observe(runMockInventory(fixture.source, () => undefined, shortLimits));
  await drain();
  await clock.tick(4);
  assert.equal(state.settled, false);
  await clock.tick(1);
  assert.equal(state.settled, true);
  assert.equal(state.error.code, 'E_SOURCE_CLEANUP');
  assert.equal(state.error.cause.code, 'E_CHUNK');
  cleanup.resolve();
  await drain();
  assert.equal(clock.timers(), 0);
});
for (const asynchronous of [false, true]) {
  test(`${asynchronous ? 'async' : 'sync'} cleanup failure preserves first fixed cause`, async () => {
    const fixture = sourceOf([chunk(Buffer.alloc(0))], () => {
      if (asynchronous) return Promise.reject(new Error('private-cleanup'));
      throw new Error('private-cleanup');
    });
    await assert.rejects(runMockInventory(fixture.source, () => undefined), (error) => error.code === 'E_SOURCE_CLEANUP' && error.cause.code === 'E_CHUNK' && !error.message.includes('private'));
    assert.equal(fixture.returns(), 1);
  });
}
test('captured return callback survives caller mutation after acquisition', async () => {
  const fixture = sourceOf([chunk(Buffer.alloc(0))]);
  const next = fixture.source.next;
  fixture.source.next = () => { delete fixture.source.return; return next(); };
  await assert.rejects(runMockInventory(fixture.source, () => undefined), { code: 'E_CHUNK' });
  assert.equal(fixture.returns(), 1);
});
test('callback-thrown InventoryError cannot choose controller failure codes', async () => {
  const fixture = sourceOf([]);
  fixture.source.next = () => { throw new InventoryError('FORGED_SOURCE_CODE'); };
  await assert.rejects(runMockInventory(fixture.source, () => undefined), { code: 'E_CALLBACK' });
  const withSink = sourceOf([chunk(Buffer.concat([member(), empty()])), done()]);
  await assert.rejects(runMockInventory(withSink.source, () => Promise.reject(new InventoryError('FORGED_SINK_CODE'))), { code: 'E_CALLBACK' });
});
test('callback call properties cannot replace captured functions', async () => {
  const fixture = sourceOf([chunk(empty()), done()]);
  Object.defineProperty(fixture.source.next, 'call', { get() { assert.fail('call getter'); } });
  const result = await runMockInventory(fixture.source, () => undefined);
  assert.equal(result.state, 'MOCK_INVENTORY');
  assert.equal(fixture.calls(), 2);
});
test('pending cleanup prevents reporting the original failure before receipt', async (t) => {
  const clock = fakeClock(t);
  const cleanup = deferred();
  const fixture = sourceOf([chunk(Buffer.alloc(0))], () => cleanup.promise);
  const state = observe(runMockInventory(fixture.source, () => undefined));
  await drain();
  assert.equal(fixture.returns(), 1);
  assert.equal(state.settled, false);
  cleanup.resolve();
  await drain();
  assert.equal(state.settled, true);
  assert.equal(state.error.code, 'E_CHUNK');
  assert.equal(clock.timers(), 0);
});
test('thenable callback rejection is normalized and cleaned up', async () => {
  const fixture = sourceOf([]);
  fixture.source.next = () => ({ get then() { throw new InventoryError('FORGED_THENABLE'); } });
  await assert.rejects(runMockInventory(fixture.source, () => undefined), { code: 'E_CALLBACK' });
  assert.equal(fixture.returns(), 1);
});
test('synchronous callback clock overrun cannot produce success', async (t) => {
  const clock = fakeClock(t);
  const fixture = sourceOf([chunk(empty()), done()]);
  const next = fixture.source.next;
  fixture.source.next = () => { const step = next(); clock.jump(16); return step; };
  const state = observe(runMockInventory(fixture.source, () => undefined, shortLimits));
  await drain();
  assert.equal(state.settled, true);
  assert.equal(state.error.code, 'E_DEADLINE');
  assert.equal(fixture.returns(), 1);
});
test('total budget includes validation time before acquisition', async (t) => {
  const clock = fakeClock(t);
  const fixture = sourceOf([chunk(empty()), done()]);
  let reads = 0;
  t.mock.method(performance, 'now', () => reads++ === 0 ? 0 : 16);
  const state = observe(runMockInventory(fixture.source, () => undefined, shortLimits));
  await drain();
  assert.equal(state.settled, true);
  assert.equal(state.error.code, 'E_DEADLINE');
  assert.equal(fixture.calls(), 0);
  assert.equal(fixture.returns(), 0);
  assert.equal(clock.timers(), 0);
});
test('cleanup never extends past the original total deadline', async (t) => {
  const clock = fakeClock(t);
  const fixture = sourceOf([]);
  fixture.source.next = () => { clock.jump(25); throw new Error('overrun'); };
  const state = observe(runMockInventory(fixture.source, () => undefined, shortLimits));
  await drain();
  assert.equal(state.settled, true);
  assert.equal(state.error.code, 'E_SOURCE_CLEANUP');
  assert.equal(state.error.cause.code, 'E_CALLBACK');
  assert.equal(fixture.returns(), 0);
  assert.equal(clock.timers(), 0);
});
test('successful operations clear all timers', async (t) => {
  const clock = fakeClock(t);
  const fixture = sourceOf([chunk(Buffer.concat([member(), empty()])), done()]);
  const result = await runMockInventory(fixture.source, () => undefined, shortLimits);
  assert.equal(result.state, 'MOCK_INVENTORY');
  assert.equal(clock.timers(), 0);
  assert.equal(Object.isFrozen(MOCK_INVENTORY_LIMITS), true);
  assert.equal(MOCK_INVENTORY_LIMITS.maxDurationMs, 120000);
  assert.equal(MOCK_INVENTORY_LIMITS.maxCleanupMs, 1000);
});
