// SPEC: _spec/tooling/native-ingress/xz-qualification.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { runRegisteredXzQualification } from './xz-operation.mjs';
import { createXzQualificationFixtures } from './xz-fixtures.mjs';
import { createCompressedXzKnownAnswerFixture } from './xz-compressed-fixture.mjs';

const digest = x => createHash('sha256').update(x).digest('hex');
const source = fs.readFileSync(new URL('./xz-operation.mjs', import.meta.url), 'utf8');

test('registration entry point is inert until explicitly called', () => {
  assert.equal(typeof runRegisteredXzQualification, 'function');
  assert.equal(runRegisteredXzQualification.length, 0);
  assert.match(source, /export async function runRegisteredXzQualification\(\)/);
  assert.doesNotMatch(source, /await runRegisteredXzQualification|process\.argv|process\.env/);
});

test('registered module graph binds every captured source byte image', () => {
  const descriptors = [...source.matchAll(/\['([a-z-]+)', (\d+), '([0-9a-f]{64})'\]/g)];
  assert.deepEqual(descriptors.map(x => x[1]), ['elf-metadata', 'xz-fixtures', 'xz-compressed-fixture', 'xz-staging', 'xz-qualification']);
  for (const [, name, size, sha] of descriptors) {
    const bytes = fs.readFileSync(new URL('./' + name + '.mjs', import.meta.url));
    assert.equal(bytes.length, Number(size));
    assert.equal(digest(bytes), sha);
  }
});

test('captured staging import has exactly one deterministic linked form', () => {
  const stage = fs.readFileSync(new URL('./xz-staging.mjs', import.meta.url), 'utf8');
  const elf = fs.readFileSync(new URL('./elf-metadata.mjs', import.meta.url));
  const needle = "from './elf-metadata.mjs'";
  assert.equal(stage.split(needle).length, 2);
  const linked = Buffer.from(stage.replace(needle, "from 'data:text/javascript;base64," + elf.toString('base64') + "'"));
  assert.equal(linked.length, 43154);
  assert.equal(digest(linked), '89b6c5e3dcbf902937f81fc642d7238bd4ec4ca3c94f6b61f4d069efdce8c5f2');
  assert.ok(source.includes(digest(linked)));
});

test('the physical suite fixes32 cases and exact independent input/output bytes', () => {
  const selected = [...createXzQualificationFixtures().filter(x => x.id !== 'output-limit-payload'), createCompressedXzKnownAnswerFixture()];
  assert.equal(selected.length, 32);
  assert.equal(new Set(selected.map(x => x.id)).size, 32);
  assert.equal(selected.reduce((n, x) => n + x.inputHex.length / 2, 0), 3432);
  assert.equal(digest(JSON.stringify(selected)), '632a0d812366712ae99ce2ce442ad98a59534430640184f70af53df58656b4ea');
  assert.ok(source.includes(digest(JSON.stringify(selected))));
});

test('overflow input remains within the compressed-input cap and exceeds output cap', () => {
  const known = createCompressedXzKnownAnswerFixture();
  assert.equal(known.inputHex.length / 2 * 36, 38016);
  assert.equal(known.expectedOutputHex.length / 2 * 36, 69156);
  assert.ok(38016 <= 65536);
  assert.ok(69156 > 65536);
  assert.match(source, /error\.code !== 'E_OUTPUT' \|\| error\.cleanupObserved !== true/);
});

test('operator has no deletion, network, replacement or shell path', () => {
  assert.doesNotMatch(source, /\b(?:unlink|rmSync|rmdir|rename|fetch|execSync|execFileSync|shell\s*:)\b/);
  assert.match(source, /candidateInvocationAttempted: counts\.spawnCalls > 0/);
  assert.match(source, /candidateExecuted: result !== null \? true : counts\.spawnCalls === 0 \? false : null/);
  assert.match(source, /ioAccountingComplete, filesystemCountsScope:/);
  assert.match(source, /child\.once\('spawn'/);
  assert.match(source, /nativeQualified: false, decoderQualified: false/);
  assert.match(source, /hardRssBounded: false, hardDeadlineGuaranteed: false/);
});

test('qualification owner covers the complete source/test graph', () => {
  const spec = '_spec/tooling/native-ingress/xz-qualification.puml';
  const diagram = fs.readFileSync(new URL('../../' + spec, import.meta.url), 'utf8');
  const index = JSON.parse(fs.readFileSync(new URL('../../_spec/.spec-index.json', import.meta.url), 'utf8'));
  const files = ['xz-fixtures', 'xz-compressed-fixture', 'xz-staging', 'xz-qualification', 'xz-operation']
    .flatMap(name => ['.mjs', '.test.mjs'].map(suffix => 'tooling/native-ingress/' + name + suffix));
  assert.deepEqual(index.specs.filter(x => x.spec === spec), [{ spec, covers: files, fingerprint: null }]);
  for (const file of files) {
    assert.ok(diagram.includes("' covers: " + file + '\n'));
    assert.ok(fs.readFileSync(new URL('../../' + file, import.meta.url), 'utf8').startsWith('// SPEC: ' + spec + '\n'));
  }
});

test('persisted physical receipt remains a scoped transcription of all registered cases', () => {
  const receipt = JSON.parse(fs.readFileSync(new URL('../../_spec/tooling/native-ingress/xz-qualification.receipt.json', import.meta.url), 'utf8'));
  const selected = [...createXzQualificationFixtures().filter(x => x.id !== 'output-limit-payload'), createCompressedXzKnownAnswerFixture()];
  assert.equal(receipt.status, 'FINITE_XZ_PROFILE_OBSERVED');
  assert.equal(receipt.evidenceKind, 'parent transcription of selected registered physical-operation fields');
  assert.equal(receipt.fixtureManifestSha256, digest(JSON.stringify(selected)));
  assert.deepEqual(receipt.acceptedCases, selected.filter(x => x.expectedExitCode === 0).map(x => x.id));
  assert.deepEqual(receipt.rejectedCases, selected.filter(x => x.expectedExitCode === 1).map(x => x.id));
  assert.equal(receipt.counts.spawnCalls, 33);
  assert.equal(receipt.counts.spawnEvents, 33);
  assert.equal(receipt.counts.preloadChecks, 68);
  assert.equal(receipt.ioAccountingComplete, true);
  assert.equal(receipt.candidateExecuted, true);
  assert.equal(receipt.staged.root, '/tmp/opencode/f9-xz-qualification-01');
  assert.deepEqual(receipt.staged.files.map(x => x.metadata.dev), ['29', '29', '29', '29']);
  assert.equal(receipt.staged.directory.dev, '28');
  for (const key of ['filesInstalled', 'retainedFilesDeleted', 'hardRssBounded', 'hardDeadlineGuaranteed', 'processTreeBounded', 'nativeQualified', 'decoderQualified', 'rustReady', 'trainingReady']) assert.equal(receipt[key], false);
  assert.equal(receipt.compressedKnownAnswer.outputSha256, digest(Buffer.from(createCompressedXzKnownAnswerFixture().expectedOutputHex, 'hex')));
  assert.deepEqual(receipt.overflow, { id: 'compressed-output-overflow', inputBytes: 38016, decodedBytesExpected: 69156,
    observedError: 'E_OUTPUT', closeObserved: true, acceptedOutputByteLength: 0 });
});
