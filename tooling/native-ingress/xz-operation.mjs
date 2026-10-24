// SPEC: _spec/tooling/native-ingress/xz-qualification.puml
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';

const sources = Object.freeze([
  ['elf-metadata', 19842, 'b223a655eae572137891a2c6efafee16887a2478fc91052f0092b48dfd65de85'],
  ['xz-fixtures', 5760, '726fb0d891d7a62dad23522652639edbdffb4bde3b6d91da32145e56cbd400ac'],
  ['xz-compressed-fixture', 4706, '88b00aa4971b26725a4c9fe09550af714d4bb9bf06ea556f62cb45e59482aaa0'],
  ['xz-staging', 16688, 'f75c21a58bb67e6ab3f8b1dafd090e11ac2d3a70f017da35afb81b00761b71b4'],
  ['xz-qualification', 13615, '788392807fed76480116ab31ea5221903c9c330c1091b1d0c5775961fe4be7be'],
]);
const digest = value => createHash('sha256').update(value).digest('hex');
const fixed = ['E_SOURCE_PIN', 'E_INPUT', 'E_PLATFORM', 'E_METADATA', 'E_BINDING', 'E_HASH',
  'E_ELF', 'E_LOADING', 'E_EXISTS', 'E_IO', 'E_LENGTH', 'E_CLOSE', 'E_PRELOAD', 'E_LAYOUT',
  'E_PREREQUISITE', 'E_SPAWN', 'E_PIPE', 'E_OUTPUT', 'E_STDERR', 'E_EVENTS', 'E_EXIT', 'E_MISMATCH', 'E_DEADLINE',
  'E_CLOCK', 'E_CLEANUP', 'E_LIMIT', 'E_OVERFLOW_CHECK'];

export async function runRegisteredXzQualification() {
  const start = performance.now(), end = start + 120000, workEnd = end - 3000;
  let last = start, failure = null, staged = null, result = null, overflow = null;
  let ioAccountingComplete = true, stagingAttempted = false;
  const counts = { sourceReads: 0, sourceBytes: 0, spawnCalls: 0, spawnEvents: 0, preloadChecks: 0,
    fsCalls: 0, readBytes: 0, writtenBytes: 0, closeAttempts: 0 };
  const code = new Map();
  function stop(value) { const error = new Error(); error.code = value; throw error; }
  function guard(final = false) {
    const now = performance.now();
    if (!Number.isFinite(now) || now < last) stop('E_CLOCK');
    last = now;
    if (now >= (final ? end : workEnd)) stop('E_DEADLINE');
  }
  function account(receipt) {
    for (const key of ['fsCalls', 'readBytes', 'writtenBytes', 'closeAttempts']) counts[key] += receipt.counters[key];
    if (counts.fsCalls > 10000 || counts.readBytes > 268435456 || counts.writtenBytes > 2758216 || counts.closeAttempts > 400) stop('E_LIMIT');
  }
  let fixtureManifestSha256 = null;
  try {
    for (const [name, size, sha256] of sources) {
      guard(); counts.sourceReads++;
      const bytes = fs.readFileSync('/tmp/opencode/f9-bootstrap-correspondence/tooling/native-ingress/' + name + '.mjs');
      counts.sourceBytes += bytes.length;
      if (bytes.length !== size || digest(bytes) !== sha256) stop('E_SOURCE_PIN');
      code.set(name, bytes);
    }
    const uri = bytes => 'data:text/javascript;base64,' + bytes.toString('base64');
    const needle = "from './elf-metadata.mjs'";
    const raw = code.get('xz-staging').toString('utf8');
    if (raw.split(needle).length !== 2) stop('E_SOURCE_PIN');
    const linked = Buffer.from(raw.replace(needle, "from '" + uri(code.get('elf-metadata')) + "'"));
    if (linked.length !== 43154 || digest(linked) !== '89b6c5e3dcbf902937f81fc642d7238bd4ec4ca3c94f6b61f4d069efdce8c5f2') stop('E_SOURCE_PIN');
    const [stage, fixtures, compressed, controller] = await Promise.all([
      import(uri(linked)), import(uri(code.get('xz-fixtures'))),
      import(uri(code.get('xz-compressed-fixture'))), import(uri(code.get('xz-qualification'))),
    ]);
    guard();
    const selected = [...fixtures.createXzQualificationFixtures().filter(row => row.id !== 'output-limit-payload'),
      compressed.createCompressedXzKnownAnswerFixture()];
    if (selected.length !== 32) stop('E_INPUT');
    fixtureManifestSha256 = digest(JSON.stringify(selected));
    if (fixtureManifestSha256 !== '632a0d812366712ae99ce2ce442ad98a59534430640184f70af53df58656b4ea') stop('E_SOURCE_PIN');
    function preload() {
      guard(); counts.preloadChecks++;
      if (stage.assertNoSystemPreload() !== true) stop('E_PRELOAD');
    }
    preload();
    stagingAttempted = true; ioAccountingComplete = false;
    staged = stage.stageXzImages();
    account(staged); ioAccountingComplete = true; guard();
    const gate = () => {
      guard(); ioAccountingComplete = false;
      account(stage.verifyStagedXzImages(staged)); ioAccountingComplete = true; preload();
      return { preloadAbsent: true };
    };
    const dependencies = {
      spawn(...args) {
        guard(); if (++counts.spawnCalls > 33) stop('E_LIMIT');
        const child = spawn(...args);
        child.once('spawn', () => { counts.spawnEvents++; });
        return child;
      },
      beforeCase: gate, afterCase: gate,
    };
    const prerequisites = { publisherAssociationCorroborated: true, imagesStagedAndVerified: true,
      preloadAbsent: true, opaqueLoadingTagsRejected: true };
    result = await controller.runXzFixtures({ root: staged.root, fixtures: selected, prerequisites }, dependencies);
    guard();
    const known = compressed.createCompressedXzKnownAnswerFixture();
    const oversized = { ...known, id: 'compressed-output-overflow', inputHex: known.inputHex.repeat(36),
      expectedOutputHex: null, acceptOutput: false };
    try {
      await controller.runXzFixtures({ root: staged.root, fixtures: [oversized], prerequisites,
        maxTotalMs: 5000, cleanupMs: 1000 }, dependencies);
      stop('E_OVERFLOW_CHECK');
    } catch (error) {
      if (error.code !== 'E_OUTPUT' || error.cleanupObserved !== true) throw error;
      overflow = { id: oversized.id, inputBytes: oversized.inputHex.length / 2,
        decodedBytesExpected: known.expectedOutputHex.length / 2 * 36,
        observedError: 'E_OUTPUT', closeObserved: true, acceptedOutputByteLength: 0 };
    }
    guard(); ioAccountingComplete = false;
    account(stage.verifyStagedXzImages(staged)); ioAccountingComplete = true; preload();
    if (counts.spawnCalls !== 33 || counts.spawnEvents !== 33 || result.state !== 'FINITE_XZ_FIXTURES_PASSED') stop('E_INPUT');
    guard(true);
  } catch (error) { failure = fixed.includes(error.code) ? error.code : 'E_IO'; }
  const base = { profile: 'registered-xz-ordinary-operation-v1',
    status: failure ? 'STOP' : 'FINITE_XZ_PROFILE_OBSERVED',
    counts, fixtureManifestSha256, ordinaryPublisherAssociationCorroborated: true,
    ioAccountingComplete, filesystemCountsScope: 'completed staging helpers; source reads and preload checks counted separately',
    candidateInvocationAttempted: counts.spawnCalls > 0,
    candidateExecuted: result !== null ? true : counts.spawnCalls === 0 ? false : null,
    stagingReturned: staged !== null, partialStagingMayRemain: stagingAttempted && staged === null,
    filesInstalled: false, retainedFilesDeleted: false,
    hardRssBounded: false, hardDeadlineGuaranteed: false, processTreeBounded: false,
    nativeQualified: false, decoderQualified: false, rustReady: false, trainingReady: false };
  let text = JSON.stringify({ ...base, ...(failure ? { error: failure } : { staged, result, overflow }) }) + '\n';
  if (Buffer.byteLength(text) > 65536 || !/^[\x20-\x7e\n]*$/.test(text)) {
    failure = 'E_OUTPUT'; text = JSON.stringify({ ...base, status: 'STOP', error: failure }) + '\n';
  }
  if (!failure) {
    try { guard(true); }
    catch { failure = 'E_DEADLINE'; text = JSON.stringify({ ...base, status: 'STOP', error: failure }) + '\n'; }
  }
  return Object.freeze({ exitCode: failure ? 1 : 0, text });
}
