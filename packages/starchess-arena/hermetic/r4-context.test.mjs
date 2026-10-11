// SPEC: _spec/packages/starchess-training/r4-host-verification.puml
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { prepareContext, r4AcceptedDocuments } from './context.mjs';

const expectedDocuments = [
  '_spec/_plans/ml-adjutant-r4-episode-request-completion.md',
  '_spec/_plans/ml-adjutant-r4-accounting-bootstrap-clarification.md',
];

const fixture = t => {
  const parent = mkdtempSync(join(realpathSync(tmpdir()), 'r4-context-'));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const root = join(parent, 'repository');
  mkdirSync(root);
  const files = {
    'package.json': '{"private":true}',
    'pnpm-lock.yaml': 'lockfileVersion: 9\n',
    'pnpm-workspace.yaml': 'packages: []\n',
    'packages/starchess-arena/hermetic/Dockerfile': 'FROM scratch\n',
    'scripts/challenge-contract-evidence.ts': 'export {};\n',
    '_spec/corpora/ml-adjutant-corpus.manifest.json': '{"sourcePath":"corpus.json"}',
    '_spec/evidence/ml-adjutant-phase1/baseline-report.json': '{}',
    '_spec/evidence/ml-adjutant-phase1/verification.json': '{}',
    '_spec/_plans/unrelated.md': 'not a capture input\n',
    '_spec/_plans/neighbor.key': 'not a capture input\n',
    'corpus.json': '{}',
    ...Object.fromEntries(['core', 'arena', 'training'].flatMap(name => [
      [`packages/starchess-${name}/package.json`, '{}'],
      [`packages/starchess-${name}/tsconfig.json`, '{}'],
    ])),
    ...Object.fromEntries(expectedDocuments.map((path, index) => [path, `accepted\r\nbody ${index}\n\u03c6\n`])),
  };
  for (const [path, value] of Object.entries(files)) {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, value);
  }
  const context = () => {
    const path = mkdtempSync(join(parent, 'capture-'));
    return { path, capture: prepareContext(path, false, root) };
  };
  return { root, parent, files, context };
};

test('runtime capture includes only the two exact R4 document inputs byte-for-byte', t => {
  assert.deepEqual(r4AcceptedDocuments, expectedDocuments);
  const { root, context } = fixture(t);
  const { path, capture } = context();
  assert.deepEqual(capture.runtime.entries.filter(entry => entry.type === 'file' && entry.path.startsWith('_spec/_plans/'))
    .map(entry => entry.path).sort(), [...expectedDocuments].sort());
  for (const document of expectedDocuments) {
    const expected = readFileSync(join(root, document));
    assert.deepEqual(readFileSync(join(path, 'runtime', document)), expected);
    const member = capture.runtime.entries.find(entry => entry.path === document);
    assert.equal(member.bytes, expected.length);
    assert.equal(member.sha256, createHash('sha256').update(expected).digest('hex'));
  }
});

test('runtime capture rejects a missing accepted document', t => {
  const f = fixture(t);
  rmSync(join(f.root, r4AcceptedDocuments[0]));
  assert.throws(f.context, /ENOENT/);
});

test('runtime capture rejects a directory substituted for an accepted document', t => {
  const f = fixture(t), document = join(f.root, expectedDocuments[0]);
  rmSync(document);
  mkdirSync(document);
  writeFileSync(join(document, 'unexpected.txt'), 'not approved');
  assert.throws(f.context, /Non-file accepted R4 document/);
});

test('runtime capture rejects an accepted-document symlink instead of reading its target', t => {
  const f = fixture(t);
  const target = join(f.parent, 'outside.md');
  writeFileSync(target, 'substitute');
  rmSync(join(f.root, r4AcceptedDocuments[0]));
  symlinkSync(target, join(f.root, r4AcceptedDocuments[0]));
  assert.throws(f.context, /Host symlink excluded/);
});

test('runtime capture rejects a symlinked document ancestor', t => {
  const f = fixture(t);
  const plans = join(f.root, '_spec/_plans'), outside = join(f.parent, 'plans');
  renameSync(plans, outside);
  symlinkSync(outside, plans, 'dir');
  assert.throws(f.context, /Host symlink excluded/);
});

test('dependency-only capture does not acquire runtime documents', t => {
  const f = fixture(t);
  for (const document of r4AcceptedDocuments) rmSync(join(f.root, document));
  const path = mkdtempSync(join(f.parent, 'dependencies-'));
  const capture = prepareContext(path, true, f.root);
  assert.equal(capture.dependenciesOnly, true);
  assert.equal(capture.runtime, undefined);
});

test('synthetic capture fixtures accept a symlink-selected temporary directory canonically', t => {
  const temporary = mkdtempSync(join(realpathSync(tmpdir()), 'r4-context-parent-'));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const target = join(temporary, 'target'), alias = join(temporary, 'alias');
  mkdirSync(target);
  symlinkSync(target, alias, 'dir');
  const original = process.env.TMPDIR;
  process.env.TMPDIR = alias;
  try {
    const f = fixture(t), result = f.context();
    assert(result.path.startsWith(target + '/'));
    assert(result.capture.runtime.entries.some(entry => entry.path === expectedDocuments[0]));
  } finally {
    if (original === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = original;
  }
});
