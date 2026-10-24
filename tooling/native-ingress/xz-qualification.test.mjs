// SPEC: _spec/tooling/native-ingress/xz-qualification.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import {
  runXzFixtures, XzQualificationError, XZ_QUALIFICATION_ROOT,
} from './xz-qualification.mjs';

const root = XZ_QUALIFICATION_ROOT;
const prerequisites = () => ({ publisherAssociationCorroborated: true,
  imagesStagedAndVerified: true, preloadAbsent: true, opaqueLoadingTagsRejected: true });
const fixture = (overrides = {}) => ({ id: 'finite', inputHex: 'fd377a585a00',
  expectedExitCode: 0, expectedOutputHex: '6869', acceptOutput: true,
  memoryLimitBytes: 16777216, coverage: 'finite-stream', integrityCheck: true, ...overrides });
const profile = (overrides = {}) => ({ root, fixtures: [fixture()], prerequisites: prerequisites(), ...overrides });
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const drain = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };

function harness(behaviors = [], overrides = {}) {
  let time = 0;
  let nextTimer = 0;
  const timers = new Map();
  const calls = [];
  const children = [];
  const hooks = [];
  const deps = {
    now: () => time,
    setTimeout(callback, delay) {
      const id = ++nextTimer;
      timers.set(id, { callback, at: time + delay });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    beforeCase(context) { hooks.push(['before', context]); return { preloadAbsent: true }; },
    afterCase(context) { hooks.push(['after', context]); return { preloadAbsent: true }; },
    spawn(command, argv, options) {
      calls.push({ command, argv, options });
      const behavior = behaviors[children.length] ?? ((child) => child.complete());
      const child = new EventEmitter();
      child.stdin = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.kills = [];
      child.inputWrites = [];
      child.kill = (signal) => {
        child.kills.push(signal);
        if (child.onKill) child.onKill();
        else queueMicrotask(() => child.emit('close', null, 'SIGKILL'));
        return true;
      };
      child.eof = () => {
        child.stdout.emit('end'); child.stdout.emit('close');
        child.stderr.emit('end'); child.stderr.emit('close');
      };
      child.complete = (output = Buffer.from('hi'), code = 0, signal = null) => {
        child.stdout.emit('data', output);
        child.eof();
        child.emit('exit', code, signal);
        child.emit('close', code, signal);
      };
      child.stdin.end = (input) => {
        child.inputWrites.push(Buffer.from(input));
        child.stdin.emit('finish');
        queueMicrotask(() => behavior(child));
      };
      children.push(child);
      return child;
    },
    ...overrides,
  };
  return {
    deps, calls, children, hooks, timers,
    jump(value) { time = value; },
    async tick(ms) {
      time += ms;
      for (const [id, timer] of [...timers]) {
        if (timer.at <= time && timers.delete(id)) timer.callback();
      }
      await drain();
    },
  };
}

async function rejects(p, h, code) {
  await assert.rejects(runXzFixtures(p, h.deps), (error) => {
    assert.equal(error instanceof XzQualificationError, true);
    assert.equal(error.code, code);
    assert.equal(error.message, code);
    return true;
  });
  assert.equal(h.timers.size, 0);
}

test('finite success fixes loader, argv, cwd and non-inherited environment', async () => {
  const h = harness();
  const result = await runXzFixtures(profile(), h.deps);
  assert.deepEqual(h.calls, [{ command: `${root}/ld-linux-x86-64.so.2`, argv: [
    '--inhibit-cache', '--glibc-hwcaps-mask', '', '--library-path', root,
    `${root}/xz`, '--decompress', '--stdout', '--format=xz', '--threads=1',
    '--memlimit-decompress=16777216', '--', '-',
  ], options: { cwd: root, env: { LC_ALL: 'C', LANG: 'C', TZ: 'UTC' }, shell: false,
    stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true } }]);
  assert.equal(result.state, 'FINITE_XZ_FIXTURES_PASSED');
  assert.equal(result.scope, 'ordinary-host-source-context');
  assert.deepEqual(h.children[0].inputWrites, [Buffer.from('fd377a585a00', 'hex')]);
  assert.equal(h.children[0].kills.length, 0);
  assert.equal(h.timers.size, 0);
});

test('child close can precede user pipe-close listeners in the same event turn', async () => {
  const h = harness([(child) => {
    child.stdout.emit('data', Buffer.from('hi'));
    child.stdout.emit('end');
    child.stderr.emit('end');
    child.emit('exit', 0, null);
    child.emit('close', 0, null);
    child.stdout.emit('close');
    child.stderr.emit('close');
  }]);
  assert.equal((await runXzFixtures(profile(), h.deps)).state, 'FINITE_XZ_FIXTURES_PASSED');
  assert.equal(h.timers.size, 0);
});

test('observations are frozen digests without output bytes or general qualification', async () => {
  const h = harness();
  const result = await runXzFixtures(profile(), h.deps);
  const observation = result.observations[0];
  assert.equal(observation.outputSha256, hash('hi'));
  assert.equal(observation.stderrSha256, hash(''));
  assert.equal(observation.outputByteLength, 2);
  assert.equal(observation.acceptedOutputByteLength, 2);
  for (const object of [result, result.observations, observation]) assert.equal(Object.isFrozen(object), true);
  for (const key of ['hardRssBounded', 'processTreeBounded', 'hardDeadlineGuaranteed',
    'nativeQualified', 'decoderQualified', 'rustReady', 'trainingReady']) assert.equal(result[key], false);
  for (const key of ['output', 'outputHex', 'expectedOutputHex', 'stderr']) assert.equal(Object.hasOwn(observation, key), false);
});

test('negative case records but never accepts partial output', async () => {
  const h = harness([(child) => child.complete(Buffer.from('partial'), 1)]);
  const result = await runXzFixtures(profile({ fixtures: [fixture({ expectedExitCode: 1,
    expectedOutputHex: null, acceptOutput: false })] }), h.deps);
  assert.equal(result.observations[0].outputByteLength, 7);
  assert.equal(result.observations[0].acceptedOutputByteLength, 0);
});

test('Check None success retains a false integrity observation', async () => {
  const h = harness();
  const result = await runXzFixtures(profile({ fixtures: [fixture({ integrityCheck: false })] }), h.deps);
  assert.equal(result.observations[0].integrityCheck, false);
});

test('multiple fixtures remain serial and use immutable captured data', async () => {
  const original = fixture();
  const second = fixture({ id: 'second' });
  const h = harness([], { beforeCase(context) {
    original.inputHex = '00'; original.expectedOutputHex = 'ff'; second.id = 'mutated';
    assert.equal(Object.isFrozen(context), true);
    if (context.fixtureId === 'second') assert.equal(h.children[0].kills.length, 0);
    return { preloadAbsent: true };
  } });
  const result = await runXzFixtures(profile({ fixtures: [original, second] }), h.deps);
  assert.deepEqual(result.observations.map((item) => item.id), ['finite', 'second']);
  assert.equal(h.children[0].inputWrites[0].toString('hex'), 'fd377a585a00');
});

test('all prerequisite gates reject false and missing values before spawn', async () => {
  for (const key of Object.keys(prerequisites())) {
    for (const value of [false, undefined, 'true']) {
      const h = harness();
      await rejects(profile({ prerequisites: { ...prerequisites(), [key]: value } }), h, 'E_PREREQUISITE');
      assert.equal(h.calls.length, 0);
    }
  }
  const h = harness();
  await rejects(profile({ prerequisites: undefined }), h, 'E_PREREQUISITE');
  assert.equal(h.calls.length, 0);
});

test('root admission rejects alternative, relative and escaping paths', async () => {
  for (const path of ['.', `${root}/`, `${root}/../other`, '/tmp/other', `${root}\0`]) {
    const h = harness();
    await rejects(profile({ root: path }), h, 'E_INPUT');
    assert.equal(h.calls.length, 0);
  }
});

test('proxies and getter inputs never execute admission traps', async () => {
  let touched = 0;
  const proxy = new Proxy({}, { ownKeys() { touched++; throw Error('secret'); } });
  const getter = { get id() { touched++; throw Error('secret'); } };
  for (const value of [proxy, getter]) {
    const h = harness();
    await rejects(profile({ fixtures: [value] }), h, 'E_INPUT');
    assert.equal(h.calls.length, 0);
  }
  const h = harness();
  await rejects(new Proxy(profile(), {}), h, 'E_INPUT');
  assert.equal(touched, 0);
});

test('fixture arrays reject holes, extra properties and proxy arrays', async () => {
  const extra = [fixture()]; extra.extra = true;
  for (const fixtures of [new Array(1), extra, new Proxy([fixture()], {}), [], Array(33).fill(fixture())]) {
    const h = harness();
    await rejects(profile({ fixtures }), h, 'E_INPUT');
    assert.equal(h.calls.length, 0);
  }
});

test('fixture primitives, hex, memory and expected output remain strictly bounded', async () => {
  const invalid = [
    { inputHex: 'Ff' }, { inputHex: 'f' }, { inputHex: '00'.repeat(65537) },
    { expectedOutputHex: 'aa'.repeat(65537) }, { memoryLimitBytes: 0 },
    { memoryLimitBytes: 16777217 }, { memoryLimitBytes: 1.5 }, { expectedExitCode: 2 },
    { acceptOutput: true, expectedExitCode: 1 }, { expectedOutputHex: null },
    { acceptOutput: false }, { integrityCheck: 'true' }, { coverage: '' },
    { id: '../fixture' }, { extra: true },
  ];
  for (const overrides of invalid) {
    const h = harness();
    await rejects(profile({ fixtures: [fixture(overrides)] }), h, 'E_INPUT');
    assert.equal(h.calls.length, 0);
  }
});

test('suite input cap and duplicate identities reject before children', async () => {
  for (const fixtures of [
    [fixture(), fixture()],
    [0, 1, 2].map((i) => fixture({ id: `case${i}`, inputHex: '00'.repeat(65536) })),
  ]) {
    const h = harness();
    await rejects(profile({ fixtures }), h, 'E_INPUT');
    assert.equal(h.calls.length, 0);
  }
});

test('limit overrides cannot enlarge fixed bounds or consume cleanup reserve', async () => {
  for (const overrides of [{ maxCaseMs: 2001 }, { maxTotalMs: 60001 }, { cleanupMs: 3001 },
    { maxTotalMs: 5, cleanupMs: 5 }, { maxCaseMs: NaN }, { cleanupMs: 0 }]) {
    const h = harness();
    await rejects(profile(overrides), h, 'E_INPUT');
    assert.equal(h.calls.length, 0);
  }
});

test('before hook refuses false receipts, exceptions and unknown assertions without children', async () => {
  for (const beforeCase of [() => ({ preloadAbsent: false }), () => { throw Error('secret'); },
    () => ({ preloadAbsent: true, nativeQualified: true })]) {
    const h = harness([], { beforeCase });
    await rejects(profile(), h, 'E_PREREQUISITE');
    assert.equal(h.calls.length, 0);
  }
});

test('after hook failure prevents a second child and any success result', async () => {
  const h = harness([], { afterCase: () => ({ preloadAbsent: false }) });
  await rejects(profile({ fixtures: [fixture(), fixture({ id: 'second' })] }), h, 'E_PREREQUISITE');
  assert.equal(h.calls.length, 1);
});

test('missing hooks and proxy callbacks reject admission', async () => {
  for (const change of [{ beforeCase: undefined }, { afterCase: undefined },
    { beforeCase: new Proxy(() => ({ preloadAbsent: true }), {}) }]) {
    const h = harness([], change);
    await rejects(profile(), h, 'E_INPUT');
    assert.equal(h.calls.length, 0);
  }
});

test('empty successful output is compared even when expected bytes are nonempty', async () => {
  const h = harness([(child) => child.complete(Buffer.alloc(0))]);
  await rejects(profile(), h, 'E_MISMATCH');
});

test('empty expected output can succeed', async () => {
  const h = harness([(child) => child.complete(Buffer.alloc(0))]);
  const result = await runXzFixtures(profile({ fixtures: [fixture({ expectedOutputHex: '' })] }), h.deps);
  assert.equal(result.observations[0].acceptedOutputByteLength, 0);
});

test('wrong exit, signal and close disagreement cannot qualify', async () => {
  for (const behavior of [
    (child) => child.complete(Buffer.from('hi'), 1),
    (child) => child.complete(Buffer.from('hi'), 0, 'SIGTERM'),
    (child) => { child.eof(); child.emit('exit', 0, null); child.emit('close', 1, null); },
    (child) => { child.eof(); child.emit('close', 0, null); },
  ]) {
    const h = harness([behavior]);
    await rejects(profile(), h, 'E_EXIT');
  }
});

test('exit alone never succeeds before child close', async () => {
  const h = harness([(child) => {
    child.stdout.emit('data', Buffer.from('hi')); child.eof(); child.emit('exit', 0, null);
  }]);
  let done = false;
  const promise = runXzFixtures(profile(), h.deps).then((result) => { done = true; return result; });
  await drain();
  assert.equal(done, false);
  h.children[0].emit('close', 0, null);
  await promise;
  assert.equal(h.timers.size, 0);
});

test('child close requires both EOFs and stream closes', async () => {
  for (const omit of ['stdout-end', 'stderr-end', 'stdout-close', 'stderr-close']) {
    const h = harness([(child) => {
      child.stdout.emit('data', Buffer.from('hi'));
      for (const which of ['stdout', 'stderr']) for (const event of ['end', 'close']) {
        if (`${which}-${event}` !== omit) child[which].emit(event);
      }
      child.emit('exit', 0, null); child.emit('close', 0, null);
    }]);
    await rejects(profile(), h, 'E_PIPE');
  }
});

test('stdin finish is mandatory and input is ended exactly once', async () => {
  const h = harness();
  const spawn = h.deps.spawn;
  h.deps.spawn = (...args) => {
    const child = spawn(...args);
    child.stdin.end = (bytes) => {
      child.inputWrites.push(bytes);
      queueMicrotask(() => child.complete());
    };
    return child;
  };
  await rejects(profile(), h, 'E_PIPE');
  assert.equal(h.children[0].inputWrites.length, 1);
});

test('stdout and stderr drain concurrently in bounded chunks', async () => {
  const h = harness([(child) => {
    for (let i = 0; i < 100; i++) {
      child.stdout.emit('data', Uint8Array.of(120));
      child.stderr.emit('data', Buffer.from('e'));
    }
    child.eof(); child.emit('exit', 0, null); child.emit('close', 0, null);
  }]);
  const result = await runXzFixtures(profile({ fixtures: [fixture({ expectedOutputHex: '78'.repeat(100) })] }), h.deps);
  assert.equal(result.observations[0].outputByteLength, 100);
  assert.equal(result.observations[0].stderrByteLength, 100);
  assert.equal(result.observations[0].stderrSha256, hash('e'.repeat(100)));
});

test('stdout overflow kills once and never accepts oversized bytes', async () => {
  const h = harness([(child) => {
    child.stdout.emit('data', Buffer.alloc(65537));
    child.stdout.emit('data', Buffer.alloc(65537));
    child.stderr.emit('error', Error('late'));
  }]);
  await rejects(profile(), h, 'E_OUTPUT');
  assert.deepEqual(h.children[0].kills, ['SIGKILL']);
});

test('stderr overflow kills even with correct stdout', async () => {
  const h = harness([(child) => {
    child.stdout.emit('data', Buffer.from('hi'));
    child.stderr.emit('data', Buffer.alloc(8193));
  }]);
  await rejects(profile(), h, 'E_STDERR');
  assert.deepEqual(h.children[0].kills, ['SIGKILL']);
});

test('empty chunks share a suite-wide event budget', async () => {
  const h = harness([(child) => {
    for (let i = 0; i < 4097; i++) child.stdout.emit('data', Buffer.alloc(0));
  }]);
  await rejects(profile(), h, 'E_EVENTS');
  assert.equal(h.children[0].kills.length, 1);
});

test('nonbinary chunks fail without string conversion', async () => {
  const h = harness([(child) => child.stdout.emit('data', 'hi')]);
  await rejects(profile(), h, 'E_PIPE');
});

test('spawn exceptions expose only fixed errors', async () => {
  const h = harness([], { spawn() { throw Error('secret path'); } });
  await rejects(profile(), h, 'E_SPAWN');
});

test('asynchronous spawn error waits for close and handles late errors', async () => {
  const h = harness([(child) => child.emit('error', Error('secret path'))]);
  await rejects(profile(), h, 'E_SPAWN');
  const child = h.children[0];
  assert.doesNotThrow(() => {
    child.emit('error', Error('late')); child.stdin.emit('error', Error('late'));
    child.stdout.emit('error', Error('late')); child.stderr.emit('error', Error('late'));
    child.stdout.emit('data', Buffer.alloc(65537)); child.emit('close', 0, null);
  });
  assert.equal(h.timers.size, 0);
});

test('EPIPE fails conservatively, including negative expected exit', async () => {
  const h = harness([(child) => child.stdin.emit('error', Object.assign(Error('secret'), { code: 'EPIPE' }))]);
  await rejects(profile({ fixtures: [fixture({ expectedExitCode: 1, acceptOutput: false,
    expectedOutputHex: null })] }), h, 'E_PIPE');
  assert.deepEqual(h.children[0].kills, ['SIGKILL']);
});

test('per-case deadline kills once and observes cleanup close', async () => {
  const h = harness([() => {}]);
  const promise = assert.rejects(runXzFixtures(profile({ maxCaseMs: 10 }), h.deps),
    (error) => error.code === 'E_DEADLINE' && error.cleanupObserved === true);
  await drain(); await h.tick(10); await promise;
  assert.deepEqual(h.children[0].kills, ['SIGKILL']);
  assert.equal(h.timers.size, 0);
});

test('unobserved cleanup close returns E_CLEANUP within reserved budget', async () => {
  const h = harness([(child) => { child.onKill = () => {}; }]);
  const promise = assert.rejects(runXzFixtures(profile({ maxCaseMs: 10, cleanupMs: 5,
    maxTotalMs: 30 }), h.deps), (error) => error.code === 'E_CLEANUP' && error.cleanupObserved === false);
  await drain(); await h.tick(10); await h.tick(5); await promise;
  const child = h.children[0];
  assert.deepEqual(child.kills, ['SIGKILL']);
  child.emit('error', Error('late')); child.emit('close', null, 'SIGKILL');
  assert.equal(h.timers.size, 0);
});

test('kill failure does not fabricate cleanup success', async () => {
  const h = harness([(child) => { child.kill = () => { throw Error('secret'); }; }]);
  const promise = assert.rejects(runXzFixtures(profile({ maxCaseMs: 10, cleanupMs: 5 }), h.deps), { code: 'E_CLEANUP' });
  await drain(); await h.tick(10); await h.tick(5); await promise;
  assert.equal(h.timers.size, 0);
});

test('original suite deadline reserves cleanup instead of restarting per fixture', async () => {
  let caseNumber = 0;
  const h = harness([], { beforeCase() {
    h.jump(++caseNumber === 1 ? 8 : 16);
    return { preloadAbsent: true };
  } });
  await rejects(profile({ maxTotalMs: 20, cleanupMs: 5,
    fixtures: [fixture(), fixture({ id: 'second' })] }), h, 'E_DEADLINE');
  assert.equal(h.calls.length, 1);
});

test('unresolved pre-hook hits bounded deadline without a child', async () => {
  const h = harness([], { beforeCase: () => new Promise(() => {}) });
  const promise = assert.rejects(runXzFixtures(profile({ maxCaseMs: 10 }), h.deps), { code: 'E_DEADLINE' });
  await drain(); await h.tick(10); await promise;
  assert.equal(h.calls.length, 0);
  assert.equal(h.timers.size, 0);
});

test('clock regression and nonfinite clock reject before spawning', async () => {
  const h = harness([], { beforeCase() { h.jump(-1); return { preloadAbsent: true }; } });
  await rejects(profile(), h, 'E_CLOCK');
  assert.equal(h.calls.length, 0);
  const bad = harness([], { now: () => NaN });
  await rejects(profile(), bad, 'E_CLOCK');
});

test('clock regression during a child kills once and fails closed', async () => {
  const h = harness([(child) => { h.jump(-1); child.stdout.emit('data', Buffer.from('hi')); }]);
  await rejects(profile(), h, 'E_CLOCK');
  assert.deepEqual(h.children[0].kills, ['SIGKILL']);
});

test('a failed suite never returns earlier successful observations', async () => {
  const h = harness([undefined, (child) => child.complete(Buffer.from('bad'))]);
  await rejects(profile({ fixtures: [fixture(), fixture({ id: 'second' })] }), h, 'E_MISMATCH');
  assert.equal(h.calls.length, 2);
});

test('error constructors whitelist codes without interpolating raw diagnostics', () => {
  assert.equal(new XzQualificationError('secret').message, 'E_INPUT');
  assert.equal(Object.isFrozen(new XzQualificationError('E_PIPE')), true);
});

test('post-case check uses reserved cleanup time but never restarts the suite budget', async () => {
  let checked = 0;
  const h = harness([() => {}], { afterCase() { checked++; return { preloadAbsent: true }; } });
  const promise = assert.rejects(runXzFixtures(profile({ maxTotalMs: 20, cleanupMs: 5 }), h.deps),
    (error) => error.code === 'E_DEADLINE' && error.cleanupObserved === true);
  await drain(); await h.tick(15); await promise;
  assert.equal(checked, 1);
  assert.equal(h.timers.size, 0);
});

test('unresolved post-hook expires at the original total deadline', async () => {
  const h = harness([], { afterCase: () => new Promise(() => {}) });
  const promise = assert.rejects(runXzFixtures(profile({ maxTotalMs: 20, cleanupMs: 5 }), h.deps), { code: 'E_DEADLINE' });
  await drain(); await h.tick(20); await promise;
  assert.equal(h.calls.length, 1);
  assert.equal(h.timers.size, 0);
});

test('late completion of a timed-out pre-hook cannot spawn a child', async () => {
  let complete;
  const h = harness([], { beforeCase: () => new Promise((resolve) => { complete = resolve; }) });
  const promise = assert.rejects(runXzFixtures(profile({ maxCaseMs: 10 }), h.deps), { code: 'E_DEADLINE' });
  await drain(); await h.tick(10); await promise;
  complete({ preloadAbsent: true });
  await drain();
  assert.equal(h.calls.length, 0);
  assert.equal(h.timers.size, 0);
});

test('chunk budget carries across fixtures instead of resetting', async () => {
  const many = (child) => {
    for (let i = 0; i < 2500; i++) child.stdout.emit('data', Buffer.alloc(0));
    child.complete();
  };
  const h = harness([many, many]);
  await rejects(profile({ fixtures: [fixture(), fixture({ id: 'second' })] }), h, 'E_EVENTS');
  assert.equal(h.children[0].kills.length, 0);
  assert.deepEqual(h.children[1].kills, ['SIGKILL']);
});

test('exact output and stderr byte caps remain admissible', async () => {
  const h = harness([(child) => {
    child.stderr.emit('data', Buffer.alloc(8192));
    child.complete(Buffer.alloc(65536));
  }]);
  const result = await runXzFixtures(profile({ fixtures: [fixture({ expectedOutputHex: '00'.repeat(65536) })] }), h.deps);
  assert.equal(result.observations[0].acceptedOutputByteLength, 65536);
  assert.equal(result.observations[0].stderrByteLength, 8192);
});
