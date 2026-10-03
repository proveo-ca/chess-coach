// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  closeSync, existsSync, fsyncSync, linkSync, lstatSync, mkdirSync, mkdtempSync,
  openSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync,
  truncateSync, unlinkSync, writeFileSync, writeSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { evidenceLimits } from './evidence-limits.mjs';
import { PublicationError, publishBundleExclusive, readPublishedBundle } from './evidence-bundle.mjs';

const markerName = '.publication-complete';
const temporaryName = '.publication-complete.tmp';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const bytes = (text) => Buffer.from(text);
const artifacts = () => [
  { path: 'verification.json', bytes: bytes('{"verified":true}\n') },
  { path: 'logs/run/stdout.log', bytes: bytes('first\nsecond\n') },
  { path: 'logs/run/stderr.log', bytes: bytes('') },
  { path: 'logs/build.log', bytes: bytes('build complete\n') },
];

function fixture(t) {
  const parent = mkdtempSync('/tmp/opencode/evidence-bundle-');
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  return join(parent, 'published');
}

function sync(path) {
  const fd = openSync(path, 'r');
  try { fsyncSync(fd); } finally { closeSync(fd); }
}

function failure() {
  return Object.assign(new Error('injected I/O failure'), { code: 'EIO' });
}

function assertPublicationError(error, state, phase, target, cause) {
  assert(error instanceof PublicationError);
  assert.equal(error.state, state);
  assert.equal(error.phase, phase);
  assert.equal(error.target, target);
  if (cause) {
    assert.equal(error.cause, cause);
    assert.equal(error.code, cause.code);
  }
  assert.match(error.message, new RegExp(state));
  return true;
}

function assertReadable(target, original = artifacts()) {
  const result = readPublishedBundle(target);
  assert(result.artifacts instanceof Map);
  assert.equal(result.artifacts.size, original.length);
  for (const artifact of original) assert.deepEqual(result.artifacts.get(artifact.path), artifact.bytes);
  return result;
}

function replaceMarker(target, mutate) {
  const path = join(target, markerName);
  const marker = JSON.parse(readFileSync(path, 'utf8'));
  mutate(marker);
  writeFileSync(path, JSON.stringify(marker) + '\n');
}

test('publishes canonical hashed inventory and syncs every directory in commit order', (t) => {
  const target = fixture(t);
  const original = Object.freeze(artifacts().map(Object.freeze));
  const events = [];
  const result = publishBundleExclusive(target, original, {
    syncDirectory(path) {
      events.push({ path, committed: existsSync(join(target, markerName)) });
      sync(path);
    },
    link(source, destination) {
      assert.equal(source, join(target, temporaryName));
      assert.equal(destination, join(target, markerName));
      const inventory = JSON.parse(readFileSync(source, 'utf8'));
      for (const item of inventory.artifacts) {
        const content = readFileSync(join(target, item.path));
        assert.equal(item.bytes, content.length);
        assert.equal(item.sha256, hash(content));
      }
      linkSync(source, destination);
    },
  });
  assert.deepEqual(result, { target, state: 'committed', durability: 'confirmed', markerSha256: hash(readFileSync(join(target, markerName))) });
  const published = assertReadable(target, original);
  assert.deepEqual(published.marker, {
    version: 'phase2-publication-v1',
    artifacts: [...original].sort((a, b) => a.path < b.path ? -1 : 1)
      .map(({ path, bytes: content }) => ({ path, bytes: content.length, sha256: hash(content) })),
  });
  assert.deepEqual(events, [
    { path: join(target, 'logs/run'), committed: false },
    { path: join(target, 'logs'), committed: false },
    { path: target, committed: false },
    { path: target, committed: true },
    { path: dirname(target), committed: true },
  ]);
  assert(!existsSync(join(target, temporaryName)));
  assert.equal(lstatSync(target).mode & 0o777, 0o700);
});

test('short writes complete artifact and marker bytes without mutating caller data', (t) => {
  const target = fixture(t);
  const original = artifacts();
  const saved = original.map(({ bytes: content }) => Buffer.from(content));
  let writes = 0;
  publishBundleExclusive(target, original, {
    write(fd, buffer, offset, length, position) {
      writes++;
      return writeSync(fd, buffer, offset, Math.min(3, length), position);
    },
  });
  assert(writes > 100);
  assertReadable(target, original);
  original.forEach((artifact, i) => assert.deepEqual(artifact.bytes, saved[i]));
});

test('snapshots validated inputs before the claim hook can mutate caller buffers', (t) => {
  const target = fixture(t);
  const original = artifacts();
  const saved = original.map(({ path, bytes: content }) => ({ path, bytes: Buffer.from(content) }));
  publishBundleExclusive(target, original, { beforeClaim() { original[0].bytes.fill(0); } });
  assertReadable(target, saved);
});

test('empty inventory publishes an independently readable committed bundle', (t) => {
  const target = fixture(t);
  publishBundleExclusive(target, []);
  assertReadable(target, []);
  assert.deepEqual(readdirSync(target), [markerName]);
});

test('rejects duplicate, noncanonical, reserved and conflicting paths before claim', (t) => {
  const invalidLists = [
    [{ path: 'a', bytes: bytes('1') }, { path: 'a', bytes: bytes('2') }],
    [{ path: 'a', bytes: bytes('1') }, { path: 'a/b', bytes: bytes('2') }],
    [{ path: 'a/b', bytes: bytes('2') }, { path: 'a', bytes: bytes('1') }],
    ...['', '/absolute', '../escape', 'a/../b', './a', 'a//b', 'a/', 'a\\b', 'a\0b', 'a\nb',
      'e\u0301', '\ud800', markerName, temporaryName, `logs/${markerName}/x`, `logs/${temporaryName}`,
      'x'.repeat(evidenceLimits.pathBytes + 1)].map((path) => [{ path, bytes: bytes('x') }]),
  ];
  for (const list of invalidLists) {
    const target = fixture(t);
    let claimed = false;
    assert.throws(() => publishBundleExclusive(target, list, { beforeClaim() { claimed = true; } }),
      (error) => assertPublicationError(error, 'uncommitted', 'validate', target));
    assert.equal(claimed, false);
    assert.equal(existsSync(target), false);
  }
});

test('rejects bytes, aggregate, metadata and entry limits before claim', (t) => {
  const maxFile = new Uint8Array(evidenceLimits.fileBytes);
  const lists = [
    [{ path: 'wrong-type', bytes: 'text' }],
    [{ path: 'too-big', bytes: new Uint8Array(evidenceLimits.fileBytes + 1) }],
    Array.from({ length: 5 }, (_, i) => ({ path: `file-${i}`, bytes: maxFile })),
    Array(evidenceLimits.entries + 1).fill({ path: 'x', bytes: bytes('') }),
    Array.from({ length: 4200 }, (_, i) => ({ path: `${i}-${'x'.repeat(4000)}`, bytes: bytes('') })),
  ];
  for (const list of lists) {
    const target = fixture(t);
    assert.throws(() => publishBundleExclusive(target, list),
      (error) => assertPublicationError(error, 'uncommitted', 'validate', target));
    assert(!existsSync(target));
  }
});

test('accepts the full 16 MiB file and 64 MiB retained resource profile', (t) => {
  const target = fixture(t);
  const content = Buffer.alloc(evidenceLimits.fileBytes, 0xa5);
  const original = Array.from({ length: 4 }, (_, i) => ({ path: `file-${i}`, bytes: content }));
  assert.equal(original.reduce((sum, artifact) => sum + artifact.bytes.length, 0), evidenceLimits.retainedBytes);
  publishBundleExclusive(target, original);
  assertReadable(target, original);
});

test('requires real trusted parent and rejects a symlinked parent', (t) => {
  const target = fixture(t);
  const alias = join(dirname(target), 'alias');
  symlinkSync(dirname(target), alias);
  assert.throws(() => publishBundleExclusive(join(alias, 'output'), artifacts()), /real canonical parent/);
  assert(!existsSync(target));
  const publicTarget = join('/tmp/opencode', `public-publication-${process.pid}`);
  assert.throws(() => publishBundleExclusive(publicTarget, artifacts()), /private host-owned ancestor/);
  assert(!existsSync(publicTarget));
});

test('existing empty, populated, file and symlink targets remain untouched', (t) => {
  for (const kind of ['empty', 'populated', 'file', 'symlink']) {
    const target = fixture(t);
    if (kind === 'file') writeFileSync(target, 'keep');
    else if (kind === 'symlink') symlinkSync(dirname(target), target);
    else {
      mkdirSync(target);
      if (kind === 'populated') writeFileSync(join(target, 'keep'), 'keep');
    }
    const stat = lstatSync(target);
    assert.throws(() => publishBundleExclusive(target, artifacts()),
      (error) => assertPublicationError(error, 'uncommitted', 'claim', target) && error.code === 'EEXIST');
    assert.equal(lstatSync(target).ino, stat.ino);
    if (kind === 'file') assert.equal(readFileSync(target, 'utf8'), 'keep');
    if (kind === 'populated') assert.equal(readFileSync(join(target, 'keep'), 'utf8'), 'keep');
    if (kind === 'empty') assert.deepEqual(readdirSync(target), []);
  }
});

test('a competitor that claims the target wins without loser cleanup', (t) => {
  const target = fixture(t);
  let winner;
  assert.throws(() => publishBundleExclusive(target, [{ path: 'loser', bytes: bytes('lose') }], {
    beforeClaim(path) { winner = publishBundleExclusive(path, artifacts()); },
  }), (error) => assertPublicationError(error, 'uncommitted', 'claim', target) && error.code === 'EEXIST');
  assert.equal(winner.state, 'committed');
  assertReadable(target);
  assert(!existsSync(join(target, 'loser')));
});

test('partial artifact and marker write failures remove only the owned uncommitted tree', (t) => {
  for (const failAt of [1, 2, 3, 4]) {
    const target = fixture(t);
    const cause = failure();
    let files = 0;
    let failingFd;
    assert.throws(() => publishBundleExclusive(target, artifacts(), {
      write(fd, buffer, offset, length, position) {
        if (offset === 0) files++;
        if (files === failAt) {
          if (failingFd === fd) throw cause;
          failingFd = fd;
          return writeSync(fd, buffer, offset, 1, position);
        }
        return writeSync(fd, buffer, offset, length, position);
      },
    }), (error) => assertPublicationError(error, 'uncommitted', failAt === 4 ? 'write-marker' : 'write-artifacts', target, cause));
    assert(!existsSync(target));
  }
});

test('zero and invalid write progress fails cleanly', (t) => {
  for (const count of [0, -1, NaN, 1.5, Infinity, 1000000]) {
    const target = fixture(t);
    assert.throws(() => publishBundleExclusive(target, artifacts(), { write() { return count; } }), /invalid progress/);
    assert(!existsSync(target));
  }
});

test('fault before each precommit directory sync removes uncommitted output', (t) => {
  for (const failAt of [1, 2, 3]) {
    const target = fixture(t);
    const cause = failure();
    let count = 0;
    assert.throws(() => publishBundleExclusive(target, artifacts(), {
      syncDirectory(path) {
        assert(!existsSync(join(target, markerName)));
        if (++count === failAt) throw cause;
        sync(path);
      },
    }), (error) => assertPublicationError(error, 'uncommitted', 'sync-directories', target, cause));
    assert(!existsSync(target));
  }
});

test('link failure occurs before commitment and removes the owned tree', (t) => {
  const target = fixture(t);
  const cause = failure();
  assert.throws(() => publishBundleExclusive(target, artifacts(), {
    link(source, destination) {
      assert(existsSync(source));
      assert(!existsSync(destination));
      throw cause;
    },
  }), (error) => assertPublicationError(error, 'uncommitted', 'commit-marker', target, cause));
  assert(!existsSync(target));
});

test('completion link never overwrites an existing marker', (t) => {
  const target = fixture(t);
  let observed;
  assert.throws(() => publishBundleExclusive(target, artifacts(), {
    link(source, destination) {
      writeFileSync(destination, 'competitor marker', { flag: 'wx' });
      try { linkSync(source, destination); } finally { observed = readFileSync(destination, 'utf8'); }
    },
  }), (error) => assertPublicationError(error, 'uncommitted', 'commit-marker', target) && error.code === 'EEXIST');
  assert.equal(observed, 'competitor marker');
  assert(!existsSync(target));
});

test('cleanup preserves a replacement target with a different inode', (t) => {
  const target = fixture(t);
  const moved = join(dirname(target), 'owned-moved');
  const cause = failure();
  assert.throws(() => publishBundleExclusive(target, artifacts(), {
    write() {
      renameSync(target, moved);
      mkdirSync(target);
      writeFileSync(join(target, 'competitor'), 'keep');
      throw cause;
    },
  }), (error) => assertPublicationError(error, 'uncommitted', 'write-artifacts', target, cause));
  assert.equal(readFileSync(join(target, 'competitor'), 'utf8'), 'keep');
  assert(existsSync(moved));
});

test('postcommit root and parent sync failures preserve readable committed bundles', (t) => {
  for (const failAt of [4, 5]) {
    const target = fixture(t);
    const cause = failure();
    let count = 0;
    assert.throws(() => publishBundleExclusive(target, artifacts(), {
      syncDirectory(path) {
        if (++count === failAt) throw cause;
        sync(path);
      },
    }), (error) => {
      assertPublicationError(error, 'committed', failAt === 4 ? 'sync-root' : 'sync-parent', target, cause);
      assert.equal(error.durability, 'unconfirmed');
      assert.match(error.message, /durability unconfirmed/);
      return true;
    });
    assertReadable(target);
    assert(!existsSync(join(target, temporaryName)));
  }
});

test('reader accepts the logical commit while its temporary hardlink still exists', (t) => {
  const target = fixture(t);
  publishBundleExclusive(target, artifacts(), {
    link(source, destination) {
      linkSync(source, destination);
      assertReadable(target);
      assert.equal(lstatSync(source).ino, lstatSync(destination).ino);
    },
  });
  linkSync(join(target, markerName), join(target, temporaryName));
  assertReadable(target);
  unlinkSync(join(target, temporaryName));
  writeFileSync(join(target, temporaryName), readFileSync(join(target, markerName)));
  assert.throws(() => readPublishedBundle(target), /Unexpected temporary marker/);
});

test('reader requires marker and rejects malformed JSON and open schemas', (t) => {
  const target = fixture(t);
  mkdirSync(target);
  writeFileSync(join(target, 'verification.json'), '{}');
  assert.throws(() => readPublishedBundle(target), /no publication completion marker/);
  rmSync(target, { recursive: true });
  publishBundleExclusive(target, artifacts());
  const good = readFileSync(join(target, markerName));
  for (const text of ['{', '{}', '{"version":"old","artifacts":[]}\n', good.toString().replace('"version":', '"extra":1,"version":')]) {
    writeFileSync(join(target, markerName), text);
    assert.throws(() => readPublishedBundle(target), /marker (JSON|schema)/);
  }
});

test('reader rejects schema, path, length, hash and canonical inventory tampering', (t) => {
  const mutations = [
    (marker) => { marker.artifacts[0].extra = true; },
    (marker) => { marker.artifacts[0].bytes = -1; },
    (marker) => { marker.artifacts[0].bytes = 1.5; },
    (marker) => { marker.artifacts[0].bytes = Number.MAX_SAFE_INTEGER + 1; },
    (marker) => { marker.artifacts[0].bytes = evidenceLimits.fileBytes + 1; },
    (marker) => { marker.artifacts[0].bytes++; },
    (marker) => { marker.artifacts[0].sha256 = 'A'.repeat(64); },
    (marker) => { marker.artifacts[0].sha256 = '0'.repeat(64); },
    (marker) => { marker.artifacts[0].path = '../escape'; },
    (marker) => { marker.artifacts[0].path = temporaryName; },
    (marker) => { marker.artifacts.push(marker.artifacts[0]); },
    (marker) => { marker.artifacts.reverse(); },
    (marker) => { marker.artifacts[1].path = marker.artifacts[0].path + '/child'; },
  ];
  for (const mutate of mutations) {
    const target = fixture(t);
    publishBundleExclusive(target, artifacts());
    replaceMarker(target, mutate);
    assert.throws(() => readPublishedBundle(target));
  }
});

test('reader rejects oversized metadata and aggregate inventory before retaining data', (t) => {
  const target = fixture(t);
  publishBundleExclusive(target, artifacts());
  const original = readFileSync(join(target, markerName));
  truncateSync(join(target, markerName), evidenceLimits.metadataBytes + 1);
  assert.throws(() => readPublishedBundle(target), /Marker metadata exceeds/);
  writeFileSync(join(target, markerName), original);
  replaceMarker(target, (marker) => {
    marker.artifacts = Array.from({ length: 5 }, (_, i) => ({ path: `file-${i}`, bytes: evidenceLimits.fileBytes, sha256: '0'.repeat(64) }));
  });
  assert.throws(() => readPublishedBundle(target), /Retained artifacts exceeds/);
});

test('reader rejects changed content, missing files, extras and extra directories', (t) => {
  const mutations = [
    (target) => writeFileSync(join(target, 'logs/build.log'), 'BUILD COMPLETE\n'),
    (target) => truncateSync(join(target, 'logs/build.log'), 1),
    (target) => truncateSync(join(target, 'logs/build.log'), evidenceLimits.fileBytes + 1),
    (target) => unlinkSync(join(target, 'logs/build.log')),
    (target) => rmSync(join(target, 'logs/run'), { recursive: true }),
    (target) => writeFileSync(join(target, 'extra.json'), '{}'),
    (target) => mkdirSync(join(target, 'extra-directory')),
    (target) => writeFileSync(join(target, 'logs', temporaryName), 'extra'),
  ];
  for (const mutate of mutations) {
    const target = fixture(t);
    publishBundleExclusive(target, artifacts());
    mutate(target);
    assert.throws(() => readPublishedBundle(target));
  }
});

test('reader rejects symlinked roots, markers, artifacts and nested directories', (t) => {
  for (const relative of ['', markerName, 'verification.json', 'logs/run']) {
    const target = fixture(t);
    publishBundleExclusive(target, artifacts());
    const path = relative ? join(target, relative) : target;
    const saved = join(dirname(target), 'saved');
    renameSync(path, saved);
    symlinkSync(saved, path);
    assert.throws(() => readPublishedBundle(target), /real directory|regular file|symlink rejected/);
  }
});

test('reader rejects noncanonical marker encoding and duplicate JSON keys', (t) => {
  const target = fixture(t);
  publishBundleExclusive(target, artifacts());
  const original = readFileSync(join(target, markerName), 'utf8');
  for (const text of [original.trimEnd(), original.replace('{', '{ '), original.replace('"version":', '"version":"ignored","version":')]) {
    writeFileSync(join(target, markerName), text);
    assert.throws(() => readPublishedBundle(target), /encoding is not canonical/);
  }
});
