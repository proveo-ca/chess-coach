// SPEC: _spec/tooling/native-ingress/gate0-checker.puml
// SYNTHETIC_ONLY fixtures; no acceptance, provider, training, or publication.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  REQUIRED_RECORD_IDS,
  LIMITS,
  checkProfile,
  readGate0Input,
  main,
} from '../f9-gate0.mjs';

const CHECKER_PATH = fileURLToPath(new URL('../f9-gate0.mjs', import.meta.url));
const MISE_PATH = fileURLToPath(new URL('../../../mise.toml', import.meta.url));
const TEMP_ROOT = '/tmp/opencode';
const SYNTHETIC = 'SYNTHETIC_ONLY';
const PRIVATE_SENTINEL = 'PRIVATE_PAYLOAD_MUST_NOT_APPEAR_75da92';
const REQUIRED = Object.freeze([
  'PLAN', 'INPUTS', 'UNITS', 'PRODUCERS', 'RECIPE', 'TRUST', 'INVOICE', 'FIT',
  'AUDITS', 'OUTPUT_METHOD', 'VERIFICATION',
  'U-ROOT', 'U-RESOLVE', 'U-PRODUCER', 'U-QUERY', 'U-GENERATED', 'U-MACRO',
  'U-METADATA', 'U-LINK', 'U-NATIVE', 'U-ENFORCE', 'U-BOUNDS', 'U-HANDOFF',
  'G1', 'S0', 'FIRST_EFFECT', 'CREATOR.A', 'INIT.B', 'NODE.MAIN', 'NODE.REFERENCE',
  'FD.MAIN.0', 'FD.MAIN.1', 'FD.MAIN.2',
  'FD.REFERENCE.0', 'FD.REFERENCE.1', 'FD.REFERENCE.2',
]);
const ACTORS = Object.freeze([
  'G1', 'S0', 'FIRST_EFFECT', 'CREATOR.A', 'INIT.B', 'NODE.MAIN', 'NODE.REFERENCE',
]);
const REQUIRED_LINKS = Object.freeze({
  PLAN: ['RECIPE', 'VERIFICATION'],
  INPUTS: ['UNITS', 'RECIPE'],
  UNITS: ['U-ROOT', 'U-RESOLVE'],
  PRODUCERS: ['U-PRODUCER', 'U-QUERY', 'U-GENERATED', 'U-MACRO', 'U-METADATA', 'U-LINK', 'U-NATIVE', 'U-ENFORCE'],
  RECIPE: ['UNITS', 'PRODUCERS'],
  TRUST: [...ACTORS, 'FD.MAIN.0', 'FD.MAIN.1', 'FD.MAIN.2', 'FD.REFERENCE.0', 'FD.REFERENCE.1', 'FD.REFERENCE.2'],
  INVOICE: ['U-BOUNDS', 'FIRST_EFFECT'],
  FIT: ['U-BOUNDS', 'U-ENFORCE'],
  AUDITS: ['VERIFICATION', 'U-ENFORCE'],
  OUTPUT_METHOD: ['U-HANDOFF'],
});
const EXPECTED_LIMITS = Object.freeze({
  inputBytes: 1048576,
  totalBytes: 2097152,
  depth: 32,
  rows: 8192,
  stringBytes: 4096,
  nodes: 200000,
  edges: 65536,
  ledgerLines: 32768,
  blockers: 256,
});
const BLOCKER_CODES = new Set([
  'PROFILE_REQUIRED', 'LEDGER_REQUIRED', 'ARGUMENTS_INVALID', 'INPUT_INVALID',
  'INPUT_TOO_LARGE', 'INPUT_READ_FAILED', 'INPUT_CHANGED', 'JSON_INVALID',
  'LEDGER_INVALID', 'PROFILE_INVALID', 'ROW_INVALID', 'DUPLICATE_ID',
  'MISSING_RECORD', 'RECORD_OPEN', 'RECORD_UNDESCRIBED', 'DANGLING_REFERENCE',
  'RECORD_UNREFERENCED', 'MISSING_FILES', 'MISSING_INPUTS', 'MISSING_UNITS',
  'MISSING_PRODUCERS', 'MISSING_KIND', 'IDENTITY_INVALID',
  'OUTPUT_IDENTITY_FORBIDDEN', 'OUTPUT_OWNERSHIP_INVALID',
  'PRODUCER_CONSUMER_MISSING', 'DEPENDENCY_CYCLE', 'INVOICE_INVALID',
  'INVOICE_CAP_EXCEEDED', 'PHYSICAL_PEAK_INVALID',
  'PHYSICAL_ROLE_COVERAGE_MISSING', 'DECISION_BINDING_MISSING',
  'DECISION_BINDING_INVALID', 'LEDGER_MARKER_MISSING',
  'LEDGER_MARKER_DUPLICATE', 'ACCEPTANCE_PROTOCOL_UNAPPROVED',
]);
const REPORT_KEYS = [
  'schema', 'scope', 'mechanical', 'finalization', 'acceptanceProtocol',
  'ledgerTrust', 'blockers', 'omittedBlockers', 'profileSha256',
  'profileBytesSha256', 'ledgerSha256', 'requiredRecordIds', 'reviewObligations',
  'gate0', 'f9Qualified', 'trainingReady',
].sort();

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const encode = (value) => Buffer.from(JSON.stringify(value), 'utf8');
const clone = (value) => JSON.parse(JSON.stringify(value));

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function byteLines(bytes) {
  const result = [];
  let start = 0;
  while (start < bytes.length) {
    const newline = bytes.indexOf(10, start);
    const end = newline === -1 ? bytes.length : newline + 1;
    result.push(bytes.subarray(start, end));
    start = end;
  }
  return result;
}

function syntheticRecord(id) {
  return {
    id,
    state: 'DESCRIBED',
    text: `${SYNTHETIC} description for ${id}.`,
    refs: [...(REQUIRED_LINKS[id] ?? [])],
    sourceRefs: [{ path: 'synthetic/source.rs', anchor: `record-${id}` }],
  };
}

function syntheticLedger(records, { eol = '\n', finalNewline = true } = {}) {
  const lines = [`## 8 · Explicit acceptance checklist: ${SYNTHETIC}`];
  for (const record of records) {
    lines.push(`<!-- gate0-record:${record.id} -->`, `${SYNTHETIC}: ${record.id}`);
  }
  return Buffer.from(lines.join(eol) + (finalNewline ? eol : ''), 'utf8');
}

function seal(profile, ledger) {
  const { decisionBindings: _ignored, ...withoutBindings } = profile;
  const profileSha256 = sha256(canonical(withoutBindings));
  const ledgerSha256 = sha256(ledger);
  const lines = byteLines(ledger);
  const heading = lines.findIndex((line) => line.toString('utf8').replace(/\r?\n$/, '')
    === `## 8 · Explicit acceptance checklist: ${SYNTHETIC}`);
  profile.decisionBindings = profile.records.flatMap((record) => {
    const marker = `<!-- gate0-record:${record.id} -->`;
    const index = lines.findIndex((line, index) => index > heading
      && line.toString('utf8').replace(/\r?\n$/, '') === marker);
    if (index === -1) return [];
    const end = Math.min(index + 2, lines.length);
    return [{
      recordId: record.id,
      recordSha256: sha256(canonical(record)),
      profileSha256,
      ledgerSha256,
      ledgerSection: '8',
      startLine: index + 1,
      endLine: end,
      excerptSha256: sha256(Buffer.concat(lines.slice(index, end))),
    }];
  });
  return profile;
}

function fixture({ stage = 'anticipated', eol = '\n', finalNewline = true } = {}) {
  const records = REQUIRED.map(syntheticRecord);
  const file = (id, pathname, role) => ({
    id, path: pathname, role, apiIds: ['PLAN'],
    identity: stage === 'implemented' && role !== 'planned-output'
      ? { bytes: 1, sha256: sha256('x') } : null,
  });
  const input = (id, kind, recordId) => ({
    id, kind, bytes: Buffer.byteLength(`${SYNTHETIC}:${kind}`),
    sha256: sha256(`${SYNTHETIC}:${kind}`), recordId,
  });
  const profile = {
    schema: 'f9-gate0-profile-v1',
    stage,
    records,
    files: [
      file('FILE.RUST', 'synthetic/source.rs', 'source'),
      file('FILE.NODE', 'synthetic/source.mjs', 'source'),
      file('FILE.NATIVE', 'synthetic/source.c', 'source'),
      file('FILE.TEST', 'synthetic/test.mjs', 'test'),
      file('FILE.TOOL', 'synthetic/tool.mjs', 'tool'),
      file('FILE.OUTPUT.A', 'synthetic/planned-a', 'planned-output'),
      file('FILE.OUTPUT.B', 'synthetic/planned-b', 'planned-output'),
    ],
    inputs: [
      input('INPUT.SOURCE', 'source', 'INPUTS'),
      input('INPUT.TOOL', 'tool', 'INPUTS'),
      input('INPUT.REFERENCE', 'reference', 'INPUTS'),
    ],
    units: [
      {
        id: 'UNIT.RUST', kind: 'rust', fileId: 'FILE.RUST',
        inputIds: ['INPUT.SOURCE', 'INPUT.TOOL'], dependencyIds: [],
        producerIds: [], configRecordId: 'UNITS',
      },
      {
        id: 'UNIT.NODE', kind: 'node', fileId: 'FILE.NODE',
        inputIds: ['INPUT.REFERENCE'], dependencyIds: ['UNIT.RUST'],
        producerIds: ['PRODUCER.COMPILER'], configRecordId: 'UNITS',
      },
      {
        id: 'UNIT.NATIVE', kind: 'native', fileId: 'FILE.NATIVE',
        inputIds: ['INPUT.SOURCE'], dependencyIds: ['UNIT.NODE'],
        producerIds: ['PRODUCER.VALIDATOR'], configRecordId: 'UNITS',
      },
    ],
    producers: [
      {
        id: 'PRODUCER.COMPILER', kind: 'compiler', unitId: 'UNIT.RUST',
        predecessorIds: [], outputIds: ['FILE.OUTPUT.A'],
        methodRecordId: 'OUTPUT_METHOD', failureRecordId: 'VERIFICATION',
      },
      {
        id: 'PRODUCER.VALIDATOR', kind: 'validator', unitId: 'UNIT.NATIVE',
        predecessorIds: ['PRODUCER.COMPILER'], outputIds: ['FILE.OUTPUT.B'],
        methodRecordId: 'OUTPUT_METHOD', failureRecordId: 'VERIFICATION',
      },
    ],
    invoice: {
      terms: [{ id: 'TERM.SYNTHETIC', quantity: 2, coefficient: 3, recordId: 'INVOICE' }],
      existingLedgerMax: 10,
      F1Max: 20,
    },
    physicalPeaks: [{
      id: 'PEAK.SYNTHETIC',
      roleIds: ['UNIT.RUST', 'UNIT.NODE', 'UNIT.NATIVE', ...ACTORS],
      cpuMillis: 10, rssBytes: 4096, pids: 3, fds: 4,
      bytes: 512, inodes: 4, outputBytes: 64, elapsedMillis: 100,
      enforcementRecordId: 'U-ENFORCE',
    }],
    decisionBindings: [],
  };
  const ledger = syntheticLedger(records, { eol, finalNewline });
  seal(profile, ledger);
  return { profile, ledger };
}

let fixedObligations;
const fixedArtifacts = new Map();

function assertReport(report) {
  assert.deepEqual(Object.keys(report).sort(), REPORT_KEYS);
  assert.equal(report.schema, 'f9-gate0-report-v1');
  assert.equal(report.scope, 'OFFLINE_STRUCTURAL_CONSISTENCY_ONLY');
  assert.ok(['READY_FOR_REVIEW', 'BLOCKED'].includes(report.mechanical));
  assert.ok(['NOT_REQUESTED', 'BLOCKED'].includes(report.finalization));
  assert.equal(report.acceptanceProtocol, 'UNAPPROVED');
  assert.equal(report.ledgerTrust, 'UNAUTHENTICATED_SNAPSHOT');
  assert.equal(report.gate0, 'OPEN');
  assert.equal(report.f9Qualified, false);
  assert.equal(report.trainingReady, false);
  assert.deepEqual(report.requiredRecordIds, REQUIRED);
  assert.ok(Array.isArray(report.reviewObligations));
  assert.ok(report.reviewObligations.length > 0);
  for (const obligation of report.reviewObligations) {
    assert.equal(typeof obligation, 'string');
    assert.ok(obligation.trim().length > 0);
  }
  if (fixedObligations === undefined) fixedObligations = clone(report.reviewObligations);
  assert.deepEqual(report.reviewObligations, fixedObligations);
  assert.ok(Number.isSafeInteger(report.omittedBlockers));
  assert.ok(report.omittedBlockers >= 0);
  assert.ok(Array.isArray(report.blockers));
  assert.ok(report.blockers.length <= EXPECTED_LIMITS.blockers);
  for (const blocker of report.blockers) {
    assert.deepEqual(Object.keys(blocker).sort(), ['code', 'index', 'nextArtifact', 'recordId']);
    assert.ok(BLOCKER_CODES.has(blocker.code), `unknown blocker code: ${blocker.code}`);
    assert.ok(blocker.recordId === null || REQUIRED.includes(blocker.recordId));
    assert.ok(blocker.index === null || (Number.isSafeInteger(blocker.index) && blocker.index >= 0));
    assert.equal(typeof blocker.nextArtifact, 'string');
    assert.ok(blocker.nextArtifact.trim().length > 0);
    if (!fixedArtifacts.has(blocker.code)) fixedArtifacts.set(blocker.code, blocker.nextArtifact);
    assert.equal(blocker.nextArtifact, fixedArtifacts.get(blocker.code));
  }
  for (const key of ['profileSha256', 'profileBytesSha256', 'ledgerSha256']) {
    assert.ok(report[key] === null || (typeof report[key] === 'string' && /^[0-9a-f]{64}$/.test(report[key])));
  }
  assert.ok(!JSON.stringify(report).includes(PRIVATE_SENTINEL));
  return report;
}

function check(profile, ledger, options) {
  return assertReport(checkProfile(encode(profile), ledger, options));
}

function assertReady(report) {
  assertReport(report);
  assert.equal(report.mechanical, 'READY_FOR_REVIEW');
  assert.deepEqual(report.blockers, []);
  assert.equal(report.omittedBlockers, 0);
  assert.equal(report.finalization, 'NOT_REQUESTED');
}

function assertBlocked(report, code) {
  assertReport(report);
  assert.equal(report.mechanical, 'BLOCKED');
  assert.ok(report.blockers.length > 0);
  if (code !== undefined) {
    assert.ok(report.blockers.some((blocker) => blocker.code === code), `missing ${code}`);
  }
}

function changedFixture(mutate, { reseal = true, ...options } = {}) {
  const data = fixture(options);
  mutate(data.profile, data);
  if (reseal) seal(data.profile, data.ledger);
  return data;
}

async function invoke(argv, read) {
  const outputs = [];
  let forbiddenReads = 0;
  const reader = read ?? (() => { forbiddenReads += 1; throw new Error('unexpected fixture read'); });
  const exitCode = await main(argv, { output: (...args) => outputs.push(args), read: reader });
  assert.equal(forbiddenReads, 0, 'lexical refusals and plan previews must not read');
  assert.ok(exitCode === 0 || exitCode === 2);
  assert.equal(outputs.length, 1);
  assert.equal(outputs[0].length, 1);
  assert.equal(typeof outputs[0][0], 'string');
  const report = JSON.parse(outputs[0][0]);
  assert.ok(!outputs[0][0].includes(PRIVATE_SENTINEL));
  return { exitCode, report, text: outputs[0][0] };
}

function temp(t) {
  const directory = fs.mkdtempSync(path.join(TEMP_ROOT, 'f9-gate0-synthetic-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

let fixedReadMessage;

function fixedReadFailure(action, forbidden = PRIVATE_SENTINEL) {
  let caught;
  try { action(); } catch (error) { caught = error; }
  assert.ok(caught instanceof Error, 'reader must throw its fixed error');
  assert.equal(typeof caught.message, 'string');
  assert.ok(caught.message.length > 0 && caught.message.length <= 160);
  assert.ok(!caught.message.includes(forbidden));
  assert.ok(!/[\r\n]/.test(caught.message));
  if (fixedReadMessage === undefined) fixedReadMessage = caught.message;
  assert.equal(caught.message, fixedReadMessage);
  return caught;
}

function trackedIO(overrides = {}) {
  const events = { opens: [], stats: [], reads: 0, closes: [] };
  const io = {
    ...fs,
    openSync(...args) {
      events.opens.push(args);
      return fs.openSync(...args);
    },
    fstatSync(...args) {
      events.stats.push(args);
      return fs.fstatSync(...args);
    },
    readSync(...args) { events.reads += 1; return fs.readSync(...args); },
    closeSync(fd) { events.closes.push(fd); return fs.closeSync(fd); },
    ...overrides,
  };
  return { io, events };
}

test('exports the complete frozen, proposed-only record set and bounded limits', () => {
  assert.equal(REQUIRED.length, 36);
  assert.deepEqual(REQUIRED_RECORD_IDS, REQUIRED);
  assert.ok(Object.isFrozen(REQUIRED_RECORD_IDS));
  assert.ok(Object.isFrozen(LIMITS));
  assert.deepEqual(LIMITS, EXPECTED_LIMITS);
});

test('independent canonicalization uses fixed SHA-256 golden vectors', () => {
  assert.equal(sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(canonical({ b: 2, a: 1 }), '{"a":1,"b":2}');
  assert.equal(sha256(canonical({ b: 2, a: 1 })),
    '43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777');
  assert.equal(canonical({ z: [{ b: 2, a: 1 }], A: '\u00e9' }), '{"A":"é","z":[{"a":1,"b":2}]}');
});

for (const stage of ['anticipated', 'implemented']) {
  test(`${stage}: independently bound SYNTHETIC_ONLY profile is only ready for review`, () => {
    const { profile, ledger } = fixture({ stage });
    const before = encode(profile);
    const ledgerBefore = Buffer.from(ledger);
    const report = check(profile, ledger);
    assertReady(report);
    const { decisionBindings: _ignored, ...withoutBindings } = profile;
    assert.equal(report.profileSha256, sha256(canonical(withoutBindings)));
    assert.equal(report.profileBytesSha256, sha256(before));
    assert.equal(report.ledgerSha256, sha256(ledger));
    assert.deepEqual(encode(profile), before);
    assert.deepEqual(ledger, ledgerBefore);
    assert.deepEqual(check(profile, ledger), report);
  });
}

test('raw profile bytes and canonical profile identity remain distinct', () => {
  const { profile, ledger } = fixture();
  const compact = encode(profile);
  const pretty = Buffer.from(` \n${JSON.stringify(profile, null, 2)}\n `);
  const first = assertReport(checkProfile(compact, ledger));
  const second = assertReport(checkProfile(pretty, ledger));
  assertReady(first);
  assertReady(second);
  assert.equal(first.profileSha256, second.profileSha256);
  assert.notEqual(first.profileBytesSha256, second.profileBytesSha256);
  assert.equal(second.profileBytesSha256, sha256(pretty));
});

test('recursive object-key order is canonical but array order is significant', () => {
  const { profile, ledger } = fixture();
  function reverseKeys(value) {
    if (Array.isArray(value)) return value.map(reverseKeys);
    if (value === null || typeof value !== 'object') return value;
    return Object.fromEntries(Object.keys(value).reverse().map((key) => [key, reverseKeys(value[key])]));
  }
  const original = check(profile, ledger);
  const reordered = check(reverseKeys(profile), ledger);
  assertReady(reordered);
  assert.equal(reordered.profileSha256, original.profileSha256);
  profile.records.reverse();
  assertBlocked(check(profile, ledger), 'DECISION_BINDING_INVALID');
  seal(profile, ledger);
  const resealed = check(profile, ledger);
  assertReady(resealed);
  assert.notEqual(resealed.profileSha256, original.profileSha256);
});

test('record-reference cycles are permitted independently of build DAGs', () => {
  const { profile, ledger } = changedFixture((profile) => {
    profile.records[0].refs.push('INPUTS');
    profile.records[1].refs.push('PLAN');
  });
  assertReady(check(profile, ledger));
});

for (const [recordId, targets] of Object.entries(REQUIRED_LINKS)) {
  for (const target of targets) {
    test(`required record link ${recordId} -> ${target} cannot be omitted`, () => {
      const { profile, ledger } = changedFixture((profile) => {
        const record = profile.records.find((row) => row.id === recordId);
        record.refs = record.refs.filter((id) => id !== target);
      });
      assertBlocked(check(profile, ledger), 'DANGLING_REFERENCE');
    });
  }
}

for (const referenceKind of ['record', 'supporting-row']) {
  test(`a referenced extra record is permitted through ${referenceKind}`, () => {
    const { profile, ledger } = fixture();
    profile.records.push(syntheticRecord('EXTRA.SYNTHETIC'));
    if (referenceKind === 'record') profile.records[0].refs.push('EXTRA.SYNTHETIC');
    else profile.units[0].configRecordId = 'EXTRA.SYNTHETIC';
    const expandedLedger = syntheticLedger(profile.records);
    seal(profile, expandedLedger);
    assertReady(check(profile, expandedLedger));
    profile.decisionBindings = profile.decisionBindings.filter((row) => row.recordId !== 'EXTRA.SYNTHETIC');
    assertReady(check(profile, expandedLedger));
    assert.notDeepEqual(ledger, expandedLedger);
  });
}

test('a disconnected extra record is not silently accepted', () => {
  const { profile, ledger } = changedFixture((profile) => {
    profile.records.push(syntheticRecord('EXTRA.SYNTHETIC'));
  });
  assertBlocked(check(profile, ledger), 'RECORD_UNREFERENCED');
});

for (const kind of ['self', 'mutual']) {
  test(`a disconnected ${kind}-referencing detail component remains unreferenced`, () => {
    const { profile, ledger } = changedFixture((profile) => {
      const first = syntheticRecord('EXTRA.CYCLE.A');
      first.refs = [kind === 'self' ? first.id : 'EXTRA.CYCLE.B'];
      profile.records.push(first);
      if (kind === 'mutual') {
        const second = syntheticRecord('EXTRA.CYCLE.B');
        second.refs = [first.id];
        profile.records.push(second);
      }
    });
    assertBlocked(check(profile, ledger), 'RECORD_UNREFERENCED');
    profile.records[0].refs.push('EXTRA.CYCLE.A');
    seal(profile, ledger);
    assertReady(check(profile, ledger));
  });
}

test('a binding alone does not make an extra record part of the supported closure', () => {
  const { profile } = fixture();
  profile.records.push(syntheticRecord('EXTRA.BINDING.ONLY'));
  const ledger = syntheticLedger(profile.records);
  seal(profile, ledger);
  assert.ok(profile.decisionBindings.some((row) => row.recordId === 'EXTRA.BINDING.ONLY'));
  assertBlocked(check(profile, ledger), 'RECORD_UNREFERENCED');
});

test('an empty record inventory reports all 36 missing obligations', () => {
  const { profile, ledger } = changedFixture((profile) => { profile.records = []; });
  const report = check(profile, ledger);
  assertBlocked(report, 'MISSING_RECORD');
  const missing = report.blockers.filter((row) => row.code === 'MISSING_RECORD').map((row) => row.recordId);
  assert.deepEqual(missing, REQUIRED);
});

for (const recordId of REQUIRED) {
  test(`${recordId}: missing required record blocks mechanical review`, () => {
    const { profile, ledger } = changedFixture((profile) => {
      profile.records = profile.records.filter((row) => row.id !== recordId);
    });
    assertBlocked(check(profile, ledger), 'MISSING_RECORD');
  });
  test(`${recordId}: OPEN is not DESCRIBED`, () => {
    const { profile, ledger } = changedFixture((profile) => {
      profile.records.find((row) => row.id === recordId).state = 'OPEN';
    });
    assertBlocked(check(profile, ledger), 'RECORD_OPEN');
  });
}

const rowAt = {
  record: (profile) => profile.records[0],
  sourceRef: (profile) => profile.records[0].sourceRefs[0],
  file: (profile) => profile.files[0],
  input: (profile) => profile.inputs[0],
  unit: (profile) => profile.units[0],
  producer: (profile) => profile.producers[0],
  invoice: (profile) => profile.invoice,
  term: (profile) => profile.invoice.terms[0],
  peak: (profile) => profile.physicalPeaks[0],
};

for (const [name, select] of Object.entries(rowAt)) {
  test(`${name}: unexpected fields are refused`, () => {
    const { profile, ledger } = changedFixture((profile) => {
      select(profile).unexpected = PRIVATE_SENTINEL;
    });
    assertBlocked(check(profile, ledger));
  });
  test(`${name}: missing fields are refused`, () => {
    const { profile, ledger } = changedFixture((profile) => {
      const row = select(profile);
      const key = Object.keys(row).find((key) => key !== 'id');
      delete row[key];
    });
    assertBlocked(check(profile, ledger));
  });
}

for (const table of ['records', 'files', 'inputs', 'units', 'producers', 'physicalPeaks', 'decisionBindings']) {
  test(`${table}: null rows return a fixed blocked report instead of throwing`, () => {
    const { profile, ledger } = fixture();
    profile[table][0] = null;
    assertBlocked(check(profile, ledger));
  });
}

for (const mutate of [
  (profile) => { profile.extra = PRIVATE_SENTINEL; },
  (profile) => { delete profile.stage; },
  (profile) => { profile.schema = 'f9-gate0-profile-v2'; },
  (profile) => { profile.stage = 'accepted'; },
  (profile) => { profile.files = {}; },
  (profile) => { profile.invoice = []; },
]) {
  test(`profile exact shape: ${mutate.toString()}`, () => {
    const { profile, ledger } = changedFixture(mutate);
    assertBlocked(check(profile, ledger));
  });
}

for (const [name, mutate, code] of [
  ['empty record text', (p) => { p.records[0].text = ''; }, 'RECORD_UNDESCRIBED'],
  ['whitespace record text', (p) => { p.records[0].text = '   '; }, 'RECORD_UNDESCRIBED'],
  ['empty source refs', (p) => { p.records[0].sourceRefs = []; }, 'RECORD_UNDESCRIBED'],
  ['empty source anchor', (p) => { p.records[0].sourceRefs[0].anchor = ''; }, undefined],
  ['empty source path', (p) => { p.records[0].sourceRefs[0].path = ''; }, undefined],
  ['unknown state', (p) => { p.records[0].state = 'ACCEPTED'; }, undefined],
  ['duplicate refs', (p) => { p.records[0].refs = ['INPUTS', 'INPUTS']; }, undefined],
  ['dangling record ref', (p) => { p.records[0].refs = ['UNKNOWN.SYNTHETIC']; }, 'DANGLING_REFERENCE'],
]) {
  test(name, () => {
    const { profile, ledger } = changedFixture(mutate);
    assertBlocked(check(profile, ledger), code);
  });
}

const declarationRows = [
  ['record', (p) => p.records[0]],
  ['file', (p) => p.files[0]],
  ['input', (p) => p.inputs[0]],
  ['unit', (p) => p.units[0]],
  ['producer', (p) => p.producers[0]],
  ['term', (p) => p.invoice.terms[0]],
  ['peak', (p) => p.physicalPeaks[0]],
];

for (const [name, rows] of [
  ['records', (p) => p.records], ['files', (p) => p.files],
  ['inputs', (p) => p.inputs], ['units', (p) => p.units],
  ['producers', (p) => p.producers], ['terms', (p) => p.invoice.terms],
  ['peaks', (p) => p.physicalPeaks],
]) {
  test(`${name}: duplicate declarations within a table are refused`, () => {
    const { profile, ledger } = changedFixture((profile) => {
      const table = rows(profile);
      table.push(clone(table[0]));
    });
    assertBlocked(check(profile, ledger), 'DUPLICATE_ID');
  });
}

for (const [table, field] of [['records', 'refs'], ['units', 'inputIds'], ['producers', 'predecessorIds']]) {
  for (const preceding of ['malformed', 'duplicate']) {
    test(`${table}: reference findings preserve source indices after a ${preceding} row`, () => {
      const { profile, ledger } = fixture();
      const rows = profile[table];
      let index;
      if (preceding === 'malformed') { rows.unshift(null); index = 1; }
      else { rows.splice(1, 0, clone(rows[0])); index = 2; }
      rows[index][field].push('UNKNOWN.SYNTHETIC');
      const report = check(profile, ledger);
      assertBlocked(report, 'DANGLING_REFERENCE');
      assert.ok(report.blockers.some((row) => row.code === 'DANGLING_REFERENCE' && row.index === index));
    });
  }
}

for (let i = 0; i < declarationRows.length; i += 1) {
  for (let j = i + 1; j < declarationRows.length; j += 1) {
    const [leftName, left] = declarationRows[i];
    const [rightName, right] = declarationRows[j];
    test(`declaration IDs are globally unique: ${leftName}/${rightName}`, () => {
      const { profile, ledger } = changedFixture((profile) => { right(profile).id = left(profile).id; });
      assertBlocked(check(profile, ledger), 'DUPLICATE_ID');
    });
  }
}

for (const badId of ['lowercase', '1START', '', 'BAD/ID', 'É', 'A'.repeat(65)]) {
  test(`opaque ASCII ID grammar refuses ${JSON.stringify(badId)}`, () => {
    const { profile, ledger } = changedFixture((profile) => { profile.files[0].id = badId; });
    assertBlocked(check(profile, ledger));
  });
}

test('opaque IDs permit the full ASCII grammar and the inclusive 64-byte limit', () => {
  for (const id of ['A_.:-9', 'A'.repeat(64)]) {
    const { profile, ledger } = changedFixture((profile) => {
      profile.files[0].id = id;
      profile.units[0].fileId = id;
    });
    assertReady(check(profile, ledger));
  }
});

for (const [name, mutate, code] of [
  ['no files', (p) => { p.files = []; }, 'MISSING_FILES'],
  ['no inputs', (p) => { p.inputs = []; }, 'MISSING_INPUTS'],
  ['no units', (p) => { p.units = []; }, 'MISSING_UNITS'],
  ['no producers', (p) => { p.producers = []; }, 'MISSING_PRODUCERS'],
  ['no source file', (p) => { p.files.forEach((f) => { if (f.role === 'source') f.role = 'tool'; }); }, 'MISSING_KIND'],
  ['no test file', (p) => { p.files.find((f) => f.role === 'test').role = 'tool'; }, 'MISSING_KIND'],
  ['no tool file', (p) => { p.files.find((f) => f.role === 'tool').role = 'test'; }, 'MISSING_KIND'],
  ['no source input', (p) => { p.inputs[0].kind = 'tool'; }, 'MISSING_KIND'],
  ['no tool input', (p) => { p.inputs[1].kind = 'source'; }, 'MISSING_KIND'],
  ['no reference input', (p) => { p.inputs[2].kind = 'source'; }, 'MISSING_KIND'],
  ['no rust unit', (p) => { p.units[0].kind = 'node'; }, 'MISSING_KIND'],
  ['no node unit', (p) => { p.units[1].kind = 'rust'; }, 'MISSING_KIND'],
  ['no native unit', (p) => { p.units[2].kind = 'rust'; }, 'MISSING_KIND'],
  ['unknown file role', (p) => { p.files[0].role = 'binary'; }, undefined],
  ['unknown input kind', (p) => { p.inputs[0].kind = 'network'; }, undefined],
  ['unknown unit kind', (p) => { p.units[0].kind = 'unsupported'; }, undefined],
  ['unknown producer kind', (p) => { p.producers[0].kind = 'acceptance'; }, undefined],
]) {
  test(name, () => {
    const { profile, ledger } = changedFixture(mutate);
    assertBlocked(check(profile, ledger), code);
  });
}

for (const pathname of [
  '', '.', '..', '../escape', 'synthetic/../escape', 'synthetic/./source',
  'synthetic//source', 'synthetic/source/', 'synthetic\\source',
  '/synthetic/../escape', '/synthetic//source', '/',
]) {
  test(`file path must be a normalized POSIX file path: ${JSON.stringify(pathname)}`, () => {
    const { profile, ledger } = changedFixture((profile) => { profile.files[0].path = pathname; });
    assertBlocked(check(profile, ledger));
  });
}

test('declared file paths do not imply filesystem access', () => {
  const { profile, ledger } = changedFixture((profile) => {
    profile.files[0].path = '/SYNTHETIC_ONLY/nonexistent/source.rs';
    profile.files[1].path = 'SYNTHETIC_ONLY/no file.mjs';
    profile.records[0].sourceRefs[0].path = '/SYNTHETIC_ONLY/nonexistent/source.rs';
  });
  assertReady(check(profile, ledger));
});

for (const anchor of ['has space', 'has/slash', 'é', 'a'.repeat(257)]) {
  test(`source anchors require bounded ASCII symbols: ${JSON.stringify(anchor)}`, () => {
    const { profile, ledger } = changedFixture((profile) => { profile.records[0].sourceRefs[0].anchor = anchor; });
    assertBlocked(check(profile, ledger), 'ROW_INVALID');
  });
}

test('source anchors permit the inclusive 256-byte limit', () => {
  const { profile, ledger } = changedFixture((profile) => { profile.records[0].sourceRefs[0].anchor = 'a'.repeat(256); });
  assertReady(check(profile, ledger));
});

for (const stage of ['anticipated', 'implemented']) {
  test(`${stage}: logical outputs cannot carry a claimed actual identity`, () => {
    const { profile, ledger } = changedFixture((profile) => {
      profile.files.find((file) => file.role === 'planned-output').identity = { bytes: 1, sha256: sha256('x') };
    }, { stage });
    assertBlocked(check(profile, ledger), 'OUTPUT_IDENTITY_FORBIDDEN');
  });
}

test('anticipated non-output identities must remain null', () => {
  const { profile, ledger } = changedFixture((profile) => {
    profile.files[0].identity = { bytes: 1, sha256: sha256('x') };
  });
  assertBlocked(check(profile, ledger), 'IDENTITY_INVALID');
});

for (const identity of [null, {}, { bytes: 0, sha256: sha256('x') },
  { bytes: 1, sha256: 'A'.repeat(64) }, { bytes: 1, sha256: 'a'.repeat(63) },
  { bytes: 1, sha256: sha256('x'), actualOutput: true }]) {
  test(`implemented identity refuses ${JSON.stringify(identity)}`, () => {
    const { profile, ledger } = changedFixture((profile) => { profile.files[0].identity = identity; }, { stage: 'implemented' });
    assertBlocked(check(profile, ledger));
  });
}

test('input and implemented-file digests require strings, not coercible arrays', () => {
  for (const select of [(p) => p.inputs[0], (p) => p.files[0].identity]) {
    const { profile, ledger } = changedFixture((profile) => {
      const row = select(profile);
      row.sha256 = [row.sha256];
    }, { stage: 'implemented' });
    assertBlocked(check(profile, ledger), 'IDENTITY_INVALID');
  }
});

for (const [name, mutate, code] of [
  ['empty file API IDs', (p) => { p.files[0].apiIds = []; }, undefined],
  ['unknown file API ID', (p) => { p.files[0].apiIds = ['UNKNOWN.SYNTHETIC']; }, 'DANGLING_REFERENCE'],
  ['input zero bytes', (p) => { p.inputs[0].bytes = 0; }, undefined],
  ['input invalid digest', (p) => { p.inputs[0].sha256 = 'A'.repeat(64); }, undefined],
  ['input unknown record', (p) => { p.inputs[0].recordId = 'UNKNOWN.SYNTHETIC'; }, 'DANGLING_REFERENCE'],
  ['unit unknown file', (p) => { p.units[0].fileId = 'UNKNOWN.SYNTHETIC'; }, 'DANGLING_REFERENCE'],
  ['unit output as source', (p) => { p.units[0].fileId = 'FILE.OUTPUT.A'; }, undefined],
  ['unit empty inputs', (p) => { p.units[0].inputIds = []; }, undefined],
  ['unit duplicate inputs', (p) => { p.units[0].inputIds.push('INPUT.SOURCE'); }, undefined],
  ['unit unknown input', (p) => { p.units[0].inputIds = ['UNKNOWN.SYNTHETIC']; }, 'DANGLING_REFERENCE'],
  ['unit unknown dependency', (p) => { p.units[0].dependencyIds = ['UNKNOWN.SYNTHETIC']; }, 'DANGLING_REFERENCE'],
  ['unit duplicate dependencies', (p) => { p.units[1].dependencyIds.push('UNIT.RUST'); }, undefined],
  ['unit unknown producer', (p) => { p.units[0].producerIds = ['UNKNOWN.SYNTHETIC']; }, 'DANGLING_REFERENCE'],
  ['unit duplicate producers', (p) => { p.units[1].producerIds.push('PRODUCER.COMPILER'); }, undefined],
  ['unit unknown config', (p) => { p.units[0].configRecordId = 'UNKNOWN.SYNTHETIC'; }, 'DANGLING_REFERENCE'],
  ['unconsumed input', (p) => { p.units[1].inputIds = ['INPUT.SOURCE']; }, undefined],
  ['build unit cycle', (p) => { p.units[0].dependencyIds = ['UNIT.NATIVE']; }, 'DEPENDENCY_CYCLE'],
  ['build unit self cycle', (p) => { p.units[0].dependencyIds = ['UNIT.RUST']; }, 'DEPENDENCY_CYCLE'],
  ['producer owner missing', (p) => { p.producers[0].unitId = 'UNKNOWN.SYNTHETIC'; }, 'DANGLING_REFERENCE'],
  ['producer predecessor missing', (p) => { p.producers[0].predecessorIds = ['UNKNOWN.SYNTHETIC']; }, 'DANGLING_REFERENCE'],
  ['producer duplicate predecessors', (p) => { p.producers[1].predecessorIds.push('PRODUCER.COMPILER'); }, undefined],
  ['producer cycle', (p) => { p.producers[0].predecessorIds = ['PRODUCER.VALIDATOR']; }, 'DEPENDENCY_CYCLE'],
  ['producer self cycle', (p) => { p.producers[0].predecessorIds = ['PRODUCER.COMPILER']; }, 'DEPENDENCY_CYCLE'],
  ['producer empty outputs', (p) => { p.producers[0].outputIds = []; }, undefined],
  ['producer unknown output', (p) => { p.producers[0].outputIds = ['UNKNOWN.SYNTHETIC']; }, undefined],
  ['producer non-output file', (p) => { p.producers[0].outputIds = ['FILE.RUST']; }, 'OUTPUT_OWNERSHIP_INVALID'],
  ['producer duplicate outputs', (p) => { p.producers[0].outputIds.push('FILE.OUTPUT.A'); }, undefined],
  ['output multiple owners', (p) => { p.producers[1].outputIds.push('FILE.OUTPUT.A'); }, 'OUTPUT_OWNERSHIP_INVALID'],
  ['orphan planned output', (p) => { p.producers[0].outputIds = ['FILE.OUTPUT.B']; }, 'OUTPUT_OWNERSHIP_INVALID'],
  ['orphan producer', (p) => { p.units[1].producerIds = []; }, 'PRODUCER_CONSUMER_MISSING'],
  ['producer unknown method', (p) => { p.producers[0].methodRecordId = 'UNKNOWN.SYNTHETIC'; }, 'DANGLING_REFERENCE'],
  ['producer unknown failure record', (p) => { p.producers[0].failureRecordId = 'UNKNOWN.SYNTHETIC'; }, 'DANGLING_REFERENCE'],
  ['producer actual output hash field', (p) => { p.producers[0].outputSha256 = sha256('x'); }, undefined],
]) {
  test(name, () => {
    const { profile, ledger } = changedFixture(mutate);
    assertBlocked(check(profile, ledger), code);
  });
}

for (const kind of ['build-script', 'compiler', 'proc-macro', 'query', 'metadata', 'link', 'copy', 'validator', 'native-helper']) {
  test(`declared producer kind ${kind} is structural, not executable`, () => {
    const { profile, ledger } = changedFixture((profile) => { profile.producers[0].kind = kind; });
    assertReady(check(profile, ledger));
  });
}

test('a producer output set may be consumed by more than one unit', () => {
  const { profile, ledger } = changedFixture((profile) => {
    profile.units[2].producerIds.push('PRODUCER.COMPILER');
  });
  assertReady(check(profile, ledger));
});

for (const [name, mutate, code] of [
  ['empty invoice terms', (p) => { p.invoice.terms = []; }, 'INVOICE_INVALID'],
  ['negative quantity', (p) => { p.invoice.terms[0].quantity = -1; }, 'INVOICE_INVALID'],
  ['zero coefficient', (p) => { p.invoice.terms[0].coefficient = 0; }, 'INVOICE_INVALID'],
  ['negative coefficient', (p) => { p.invoice.terms[0].coefficient = -1; }, 'INVOICE_INVALID'],
  ['negative ledger maximum', (p) => { p.invoice.existingLedgerMax = -1; }, 'INVOICE_INVALID'],
  ['negative F1 maximum', (p) => { p.invoice.F1Max = -1; }, 'INVOICE_INVALID'],
  ['invoice unknown record', (p) => { p.invoice.terms[0].recordId = 'UNKNOWN.SYNTHETIC'; }, 'DANGLING_REFERENCE'],
  ['invoice cap plus one', (p) => { p.invoice = { terms: [{ id: 'TERM.SYNTHETIC', quantity: 1048577, coefficient: 1, recordId: 'INVOICE' }], existingLedgerMax: 0, F1Max: 0 }; }, 'INVOICE_CAP_EXCEEDED'],
  ['invoice multiplication overflow', (p) => { p.invoice.terms[0].quantity = Number.MAX_SAFE_INTEGER; p.invoice.terms[0].coefficient = 2; }, undefined],
  ['invoice addition overflow', (p) => { p.invoice.existingLedgerMax = Number.MAX_SAFE_INTEGER; p.invoice.F1Max = Number.MAX_SAFE_INTEGER; }, undefined],
  ['invoice includes ledger maximum', (p) => { p.invoice.existingLedgerMax = 1048576; }, 'INVOICE_CAP_EXCEEDED'],
  ['invoice includes F1 maximum', (p) => { p.invoice.F1Max = 1048576; }, 'INVOICE_CAP_EXCEEDED'],
]) {
  test(name, () => {
    const { profile, ledger } = changedFixture(mutate);
    assertBlocked(check(profile, ledger), code);
  });
}

test('invoice cap is inclusive and permits zero quantity', () => {
  for (const quantity of [0, 1048576]) {
    const { profile, ledger } = changedFixture((profile) => {
      profile.invoice.terms[0].quantity = quantity;
      profile.invoice.terms[0].coefficient = 1;
      profile.invoice.existingLedgerMax = 0;
      profile.invoice.F1Max = 0;
    });
    assertReady(check(profile, ledger));
  }
});

for (const field of ['cpuMillis', 'rssBytes', 'pids', 'fds', 'bytes', 'inodes', 'outputBytes']) {
  test(`physical ${field}: negative declarations are invalid`, () => {
    const { profile, ledger } = changedFixture((profile) => { profile.physicalPeaks[0][field] = -1; });
    assertBlocked(check(profile, ledger), 'PHYSICAL_PEAK_INVALID');
  });
  test(`physical ${field}: zero is permitted without inventing an F9 threshold`, () => {
    const { profile, ledger } = changedFixture((profile) => { profile.physicalPeaks[0][field] = 0; });
    assertReady(check(profile, ledger));
  });
}

for (const elapsedMillis of [0, -1, 300001]) {
  test(`elapsedMillis refuses ${elapsedMillis}`, () => {
    const { profile, ledger } = changedFixture((profile) => { profile.physicalPeaks[0].elapsedMillis = elapsedMillis; });
    assertBlocked(check(profile, ledger), 'PHYSICAL_PEAK_INVALID');
  });
}

for (const [name, mutate, code] of [
  ['empty physical coverage', (p) => { p.physicalPeaks = []; }, 'PHYSICAL_ROLE_COVERAGE_MISSING'],
  ['empty role list', (p) => { p.physicalPeaks[0].roleIds = []; }, undefined],
  ['duplicate physical role', (p) => { p.physicalPeaks[0].roleIds.push('G1'); }, undefined],
  ['unknown physical role', (p) => { p.physicalPeaks[0].roleIds.push('UNKNOWN.SYNTHETIC'); }, 'PHYSICAL_PEAK_INVALID'],
  ['file is not physical role', (p) => { p.physicalPeaks[0].roleIds.push('FILE.RUST'); }, 'PHYSICAL_PEAK_INVALID'],
  ['unknown enforcement record', (p) => { p.physicalPeaks[0].enforcementRecordId = 'UNKNOWN.SYNTHETIC'; }, 'DANGLING_REFERENCE'],
]) {
  test(name, () => {
    const { profile, ledger } = changedFixture(mutate);
    assertBlocked(check(profile, ledger), code);
  });
}

for (const role of ['UNIT.RUST', 'UNIT.NODE', 'UNIT.NATIVE', ...ACTORS]) {
  test(`physical declared coverage must include ${role}`, () => {
    const { profile, ledger } = changedFixture((profile) => {
      profile.physicalPeaks[0].roleIds = profile.physicalPeaks[0].roleIds.filter((id) => id !== role);
    });
    assertBlocked(check(profile, ledger), 'PHYSICAL_ROLE_COVERAGE_MISSING');
  });
}

test('peak union covers actors across rows and uses the inclusive time cap', () => {
  const { profile, ledger } = changedFixture((profile) => {
    const first = profile.physicalPeaks[0];
    const second = { ...clone(first), id: 'PEAK.SECOND', roleIds: first.roleIds.splice(3) };
    first.elapsedMillis = 300000;
    second.elapsedMillis = 300000;
    profile.physicalPeaks.push(second);
  });
  assertReady(check(profile, ledger));
});

test('declared safe resource maxima do not invent an F9 acceptance threshold', () => {
  const { profile, ledger } = changedFixture((profile) => {
    for (const key of ['cpuMillis', 'rssBytes', 'pids', 'fds', 'bytes', 'inodes', 'outputBytes']) {
      profile.physicalPeaks[0][key] = Number.MAX_SAFE_INTEGER;
    }
    profile.inputs[0].bytes = Number.MAX_SAFE_INTEGER;
    profile.files[0].identity.bytes = Number.MAX_SAFE_INTEGER;
  }, { stage: 'implemented' });
  assertReady(check(profile, ledger));
});

for (const recordId of REQUIRED) {
  test(`${recordId}: a decision binding is mandatory`, () => {
    const { profile, ledger } = fixture();
    profile.decisionBindings = profile.decisionBindings.filter((row) => row.recordId !== recordId);
    assertBlocked(check(profile, ledger), 'DECISION_BINDING_MISSING');
  });
}

for (const field of ['recordSha256', 'profileSha256', 'ledgerSha256', 'excerptSha256']) {
  test(`binding ${field} cannot be stale or substituted`, () => {
    const { profile, ledger } = fixture();
    profile.decisionBindings[0][field] = '0'.repeat(64);
    assertBlocked(check(profile, ledger), 'DECISION_BINDING_INVALID');
  });
}

for (const [name, mutate] of [
  ['extra binding field', (p) => { p.decisionBindings[0].consent = PRIVATE_SENTINEL; }],
  ['missing binding field', (p) => { delete p.decisionBindings[0].excerptSha256; }],
  ['duplicate binding', (p) => { p.decisionBindings.push(clone(p.decisionBindings[0])); }],
  ['unknown binding record', (p) => { p.decisionBindings[0].recordId = 'UNKNOWN.SYNTHETIC'; }],
  ['wrong ledger section', (p) => { p.decisionBindings[0].ledgerSection = '9'; }],
  ['numeric ledger section', (p) => { p.decisionBindings[0].ledgerSection = 8; }],
  ['zero start line', (p) => { p.decisionBindings[0].startLine = 0; }],
  ['negative end line', (p) => { p.decisionBindings[0].endLine = -1; }],
  ['reversed range', (p) => { p.decisionBindings[0].startLine = 4; p.decisionBindings[0].endLine = 2; }],
  ['range includes section heading', (p) => { p.decisionBindings[0].startLine = 1; }],
  ['range omits marker', (p) => { p.decisionBindings[0].startLine += 1; }],
  ['range beyond EOF', (p) => { p.decisionBindings[0].endLine = 100000; }],
]) {
  test(name, () => {
    const { profile, ledger } = fixture();
    mutate(profile);
    assertBlocked(check(profile, ledger), 'DECISION_BINDING_INVALID');
  });
}

test('full record rows, including source refs, participate in decision binding hashes', () => {
  const { profile, ledger } = fixture();
  profile.records[0].sourceRefs[0].anchor = 'changed-synthetic-anchor';
  const { decisionBindings: _ignored, ...withoutBindings } = profile;
  const newProfileHash = sha256(canonical(withoutBindings));
  for (const binding of profile.decisionBindings) binding.profileSha256 = newProfileHash;
  assertBlocked(check(profile, ledger), 'DECISION_BINDING_INVALID');
});

test('changing a supporting row invalidates bindings to the previous profile', () => {
  const { profile, ledger } = fixture();
  profile.invoice.F1Max += 1;
  assertBlocked(check(profile, ledger), 'DECISION_BINDING_INVALID');
});

for (const eol of ['\n', '\r\n']) {
  for (const finalNewline of [true, false]) {
    test(`ledger byte ranges preserve ${JSON.stringify(eol)} and EOF newline=${finalNewline}`, () => {
      const { profile, ledger } = fixture({ eol, finalNewline });
      assertReady(check(profile, ledger));
      const last = profile.decisionBindings.at(-1);
      const lines = byteLines(ledger);
      assert.equal(last.endLine, lines.length);
      assert.equal(last.excerptSha256, sha256(Buffer.concat(lines.slice(last.startLine - 1, last.endLine))));
      const wrong = clone(profile);
      wrong.decisionBindings.at(-1).endLine += 1;
      assertBlocked(check(wrong, ledger), 'DECISION_BINDING_INVALID');
    });
  }
}

test('an excerpt ending at a marker includes its literal LF byte', () => {
  const { profile, ledger } = fixture();
  const binding = profile.decisionBindings[0];
  binding.endLine = binding.startLine;
  const markerLine = byteLines(ledger)[binding.startLine - 1];
  binding.excerptSha256 = sha256(markerLine);
  assertReady(check(profile, ledger));
  binding.excerptSha256 = sha256(markerLine.subarray(0, -1));
  assertBlocked(check(profile, ledger), 'DECISION_BINDING_INVALID');
});

test('the ledger digest binds the raw snapshot, not normalized text', () => {
  const { profile, ledger } = fixture();
  const crlf = Buffer.from(ledger.toString('utf8').replaceAll('\n', '\r\n'));
  assertBlocked(check(profile, crlf), 'DECISION_BINDING_INVALID');
});

for (const fence of ['```', '~~~']) {
  test(`${fence} fenced duplicate markers and headings have no ledger authority`, () => {
    const { profile, ledger } = fixture();
    const fake = `${fence}markdown\n## 8 · Explicit acceptance checklist: FAKE\n<!-- gate0-record:PLAN -->\n${fence}\n`;
    const fenced = Buffer.concat([Buffer.from(fake), ledger]);
    seal(profile, fenced);
    assertReady(check(profile, fenced));
  });

  test(`${fence} fenced-only markers do not satisfy required marker presence`, () => {
    const { profile, ledger } = fixture();
    const hidden = Buffer.from(ledger.toString('utf8').replace(
      '<!-- gate0-record:PLAN -->', `${fence}\n<!-- gate0-record:PLAN -->\n${fence}`));
    seal(profile, hidden);
    assertBlocked(check(profile, hidden), 'LEDGER_MARKER_MISSING');
  });
}

test('a shorter fence does not close a longer opening fence', () => {
  const { profile, ledger } = fixture();
  const prefix = Buffer.from('````markdown\n```\n## 8 · Explicit acceptance checklist: FAKE\n<!-- gate0-record:PLAN -->\n````\n');
  const fenced = Buffer.concat([prefix, ledger]);
  seal(profile, fenced);
  assertReady(check(profile, fenced));
});

for (const [name, transform, code] of [
  ['missing section 8', (text) => text.replace('## 8 · Explicit acceptance checklist:', '## 7 · Other:'), 'LEDGER_INVALID'],
  ['duplicate unfenced section 8', (text) => `${text}\n## 8 · Explicit acceptance checklist: SECOND\n`, 'LEDGER_INVALID'],
  ['missing required marker', (text) => text.replace('<!-- gate0-record:PLAN -->', 'SYNTHETIC_ONLY no marker'), 'LEDGER_MARKER_MISSING'],
  ['duplicate required marker', (text) => `${text}<!-- gate0-record:PLAN -->\n`, 'LEDGER_MARKER_DUPLICATE'],
  ['inline marker', (text) => text.replace('<!-- gate0-record:PLAN -->', 'text <!-- gate0-record:PLAN --> text'), 'LEDGER_MARKER_MISSING'],
  ['marker after next level-two heading', (text) => text.replace('<!-- gate0-record:PLAN -->', '## 9 · SYNTHETIC_ONLY\n<!-- gate0-record:PLAN -->'), 'LEDGER_MARKER_MISSING'],
  ['marker before section heading', (text) => `<!-- gate0-record:PLAN -->\n${text.replace('<!-- gate0-record:PLAN -->\n', '')}`, 'LEDGER_MARKER_MISSING'],
]) {
  test(name, () => {
    const { profile, ledger } = fixture();
    const modified = Buffer.from(transform(ledger.toString('utf8')));
    seal(profile, modified);
    assertBlocked(check(profile, modified), code);
  });
}

test('a binding range cannot cross the next level-two heading', () => {
  const { profile, ledger } = fixture();
  const extended = Buffer.concat([ledger, Buffer.from('## 9 · SYNTHETIC_ONLY\nnot section 8\n')]);
  seal(profile, extended);
  const last = profile.decisionBindings.at(-1);
  last.endLine = byteLines(extended).length;
  last.excerptSha256 = sha256(Buffer.concat(byteLines(extended).slice(last.startLine - 1)));
  assertBlocked(check(profile, extended), 'DECISION_BINDING_INVALID');
});

for (const heading of ['##\t9 · Other', '  ## 9 · Other', '   ##\t9 · Other', '##']) {
  test(`valid ATX level-two heading terminates section 8: ${JSON.stringify(heading)}`, () => {
    const { profile, ledger } = fixture();
    const modified = Buffer.from(ledger.toString('utf8').replace(
      '<!-- gate0-record:PLAN -->', `${heading}\n<!-- gate0-record:PLAN -->`));
    seal(profile, modified);
    assertBlocked(check(profile, modified), 'LEDGER_MARKER_MISSING');
  });
}

for (const prefix of ['##\t', '  ## ', '   ##\t']) {
  test(`section-8 uniqueness recognizes valid ATX prefix ${JSON.stringify(prefix)}`, () => {
    const { profile, ledger } = fixture();
    const duplicate = Buffer.concat([ledger, Buffer.from(`${prefix}8 · Explicit acceptance checklist: SECOND\n`)]);
    seal(profile, duplicate);
    assertBlocked(check(profile, duplicate), 'LEDGER_INVALID');
    const modified = Buffer.from(ledger.toString('utf8').replace(/^## /, prefix));
    seal(profile, modified);
    assertReady(check(profile, modified));
  });
}

test('markers outside section 8 do not duplicate an in-section marker', () => {
  const { profile, ledger } = fixture();
  const extended = Buffer.concat([ledger, Buffer.from('## 9 · SYNTHETIC_ONLY\n<!-- gate0-record:PLAN -->\n')]);
  seal(profile, extended);
  assertReady(check(profile, extended));
});

test('fixed report metadata never includes raw rows, private refs, paths, or unknown IDs', () => {
  const { profile, ledger } = fixture();
  profile.records[0].text = PRIVATE_SENTINEL;
  profile.records[0].refs = [`UNKNOWN.${PRIVATE_SENTINEL}`];
  profile.records[0].sourceRefs = [{ path: `/${PRIVATE_SENTINEL}/secret`, anchor: PRIVATE_SENTINEL }];
  profile.files[0].path = `/${PRIVATE_SENTINEL}/private`;
  const report = check(profile, ledger);
  assertBlocked(report);
  const serialized = JSON.stringify(report);
  assert.ok(!serialized.includes('UNKNOWN.'));
  assert.ok(!serialized.includes('sourceRefs'));
  assert.ok(!serialized.includes('Error:'));
});

for (const value of [null, undefined, '', '{}', {}, [], new Uint8Array([123, 125])]) {
  test(`checker requires Buffer profile input: ${typeof value}/${String(value)}`, () => {
    const { ledger } = fixture();
    assertBlocked(assertReport(checkProfile(value, ledger)), 'INPUT_INVALID');
  });
  test(`checker requires Buffer ledger input: ${typeof value}/${String(value)}`, () => {
    const { profile } = fixture();
    assertBlocked(assertReport(checkProfile(encode(profile), value)), 'INPUT_INVALID');
  });
}

test('rejected non-Buffer objects cannot expose data through getters or conversion hooks', () => {
  let accesses = 0;
  const hostile = Object.defineProperties({}, {
    toString: { get() { accesses += 1; throw new Error(PRIVATE_SENTINEL); } },
    valueOf: { get() { accesses += 1; throw new Error(PRIVATE_SENTINEL); } },
    schema: { get() { accesses += 1; throw new Error(PRIVATE_SENTINEL); } },
  });
  const { ledger } = fixture();
  assertBlocked(assertReport(checkProfile(hostile, ledger)), 'INPUT_INVALID');
  assert.equal(accesses, 0);
});

for (const [name, source] of [
  ['duplicate decoded root key', '{"schema":1,"\\u0073chema":2}'],
  ['duplicate nested key', '{"x":{"a":1,"a":2}}'],
  ['prototype key', '{"__proto__":{}}'],
  ['escaped prototype key', '{"\\u005f_proto__":{}}'],
  ['constructor key', '{"x":{"constructor":1}}'],
  ['prototype property key', '{"x":{"prototype":1}}'],
  ['unpaired high surrogate', '{"text":"\\ud800"}'],
  ['unpaired low surrogate', '{"text":"\\udfff"}'],
  ['high surrogate followed by ordinary char', '{"text":"\\ud800x"}'],
  ['fraction', '{"number":1.5}'],
  ['unsafe integer', '{"number":9007199254740992}'],
  ['negative unsafe integer', '{"number":-9007199254740992}'],
  ['negative zero', '{"number":-0}'],
  ['overflow exponent', '{"number":1e999}'],
  ['trailing garbage', '{} trailing'],
  ['second JSON document', '{}{}'],
  ['trailing comma', '{"a":1,}'],
  ['JSON comment', '{/* no */"a":1}'],
  ['empty input', ''],
]) {
  test(`strict JSON refuses ${name}`, () => {
    const { ledger } = fixture();
    assertBlocked(assertReport(checkProfile(Buffer.from(source), ledger)), 'JSON_INVALID');
  });
}

for (const codePoint of [0, 1, 9, 10, 13, 31, 127, 128, 133, 159]) {
  test(`JSON value control U+${codePoint.toString(16).padStart(4, '0')} is refused`, () => {
    const { profile, ledger } = fixture();
    profile.records[0].text = `synthetic${String.fromCodePoint(codePoint)}`;
    assertBlocked(assertReport(checkProfile(encode(profile), ledger)), 'JSON_INVALID');
  });
}

test('paired Unicode and non-control UTF-8 are not rejected as malformed', () => {
  const { profile, ledger } = changedFixture((profile) => { profile.records[0].text = `${SYNTHETIC} café 🚀`; });
  assertReady(check(profile, ledger));
});

test('safe integral JSON values may use decimal or exponent syntax', () => {
  const { profile, ledger } = fixture();
  for (const numericToken of ['2.0', '2e0']) {
    const bytes = Buffer.from(JSON.stringify(profile).replace('"quantity":2,', `"quantity":${numericToken},`));
    assertReady(assertReport(checkProfile(bytes, ledger)));
  }
});

for (const numericToken of ['1.0000000000000001', '9007199254740990.5', '1e-9999']) {
  test(`strict JSON rejects mathematically noninteger token ${numericToken} before binding checks`, () => {
    const { profile, ledger } = fixture();
    const bytes = Buffer.from(JSON.stringify(profile).replace('"quantity":2,', `"quantity":${numericToken},`));
    assertBlocked(assertReport(checkProfile(bytes, ledger)), 'JSON_INVALID');
  });
}

for (const numericToken of ['1.0', '1e0', '100e-2']) {
  test(`strict JSON accepts exact integer token ${numericToken} with canonical value-one bindings`, () => {
    const { profile, ledger } = changedFixture((profile) => { profile.invoice.terms[0].quantity = 1; });
    const bytes = Buffer.from(JSON.stringify(profile).replace('"quantity":1,', `"quantity":${numericToken},`));
    assertReady(assertReport(checkProfile(bytes, ledger)));
  });
}

for (const [name, bytes] of [
  ['UTF-8 BOM', Buffer.from([0xef, 0xbb, 0xbf])],
  ['invalid byte', Buffer.from([0xff])],
  ['overlong UTF-8', Buffer.from([0xc0, 0xaf])],
  ['truncated UTF-8', Buffer.from([0xe2, 0x82])],
  ['UTF-8 surrogate', Buffer.from([0xed, 0xa0, 0x80])],
]) {
  for (const side of ['profile', 'ledger']) {
    test(`${side}: strict UTF-8 rejects ${name}`, () => {
      const { profile, ledger } = fixture();
      const profileBytes = side === 'profile' ? Buffer.concat([bytes, encode(profile)]) : encode(profile);
      const ledgerBytes = side === 'ledger' ? Buffer.concat([bytes, ledger]) : ledger;
      assertBlocked(assertReport(checkProfile(profileBytes, ledgerBytes)));
    });
  }
}

for (const side of ['profile', 'ledger']) {
  test(`${side}: byte cap refuses one extra byte without throwing`, () => {
    const { profile, ledger } = fixture();
    const large = Buffer.alloc(EXPECTED_LIMITS.inputBytes + 1, 32);
    assertBlocked(assertReport(checkProfile(
      side === 'profile' ? large : encode(profile),
      side === 'ledger' ? large : ledger,
    )), 'INPUT_TOO_LARGE');
  });
}

test('a valid whitespace-padded profile may use the inclusive byte cap', () => {
  const { profile, ledger } = fixture();
  const bytes = encode(profile);
  const padded = Buffer.concat([bytes, Buffer.alloc(EXPECTED_LIMITS.inputBytes - bytes.length, 32)]);
  assert.equal(padded.length, EXPECTED_LIMITS.inputBytes);
  const report = assertReport(checkProfile(padded, ledger));
  assertReady(report);
  assert.equal(report.profileBytesSha256, sha256(padded));
});

for (const [name, bytes] of [
  ['depth cap', Buffer.from('{"x":' + '['.repeat(33) + '0' + ']'.repeat(33) + '}')],
  ['node cap', Buffer.from('{"x":[' + Array(EXPECTED_LIMITS.nodes + 1).fill('[]').join(',') + ']}')],
]) {
  test(`parser bounds ${name} without a thrown recursion error`, () => {
    const { ledger } = fixture();
    assertBlocked(assertReport(checkProfile(bytes, ledger)));
  });
}

function referenceEdgeCount(profile) {
  const sum = (rows, fields) => rows.reduce((total, row) => total
    + fields.reduce((subtotal, field) => subtotal + row[field].length, 0), 0);
  return sum(profile.records, ['refs']) + sum(profile.files, ['apiIds'])
    + sum(profile.units, ['inputIds', 'dependencyIds', 'producerIds'])
    + sum(profile.producers, ['predecessorIds', 'outputIds'])
    + sum(profile.physicalPeaks, ['roleIds']);
}

test('the reference edge cap is inclusive and rejects one additional edge', () => {
  const { profile, ledger } = fixture();
  const extras = Array.from({ length: 1000 }, (_, index) => syntheticRecord(`E.${index}`));
  profile.records.push(...extras);
  profile.records[0].refs.push(...extras.map((row) => row.id));
  const targets = extras.slice(0, 65).map((row) => row.id);
  let remaining = EXPECTED_LIMITS.edges - referenceEdgeCount(profile);
  for (const record of extras) {
    const available = targets.filter((id) => id !== record.id);
    const count = Math.min(remaining, available.length);
    record.refs = available.slice(0, count);
    remaining -= count;
  }
  assert.equal(remaining, 0);
  assert.equal(referenceEdgeCount(profile), EXPECTED_LIMITS.edges);
  seal(profile, ledger);
  assert.ok(encode(profile).length < EXPECTED_LIMITS.inputBytes);
  assertReady(check(profile, ledger));
  extras.at(-1).refs.push('PLAN');
  seal(profile, ledger);
  assert.equal(referenceEdgeCount(profile), EXPECTED_LIMITS.edges + 1);
  assertBlocked(check(profile, ledger), 'PROFILE_INVALID');
});

test('row cap blocks a bounded synthetic invoice with too many rows', () => {
  const { profile, ledger } = fixture();
  profile.invoice.terms = Array.from({ length: EXPECTED_LIMITS.rows + 1 }, (_, index) => ({
    id: `TERM.SYNTHETIC.${index}`, quantity: 0, coefficient: 1, recordId: 'INVOICE',
  }));
  assert.ok(encode(profile).length < EXPECTED_LIMITS.inputBytes);
  assertBlocked(check(profile, ledger));
});

test('string cap counts UTF-8 bytes rather than JavaScript code units', () => {
  const { profile, ledger } = fixture();
  profile.records[0].text = 'é'.repeat(2049);
  assert.ok(profile.records[0].text.length < EXPECTED_LIMITS.stringBytes);
  assertBlocked(check(profile, ledger));
});

test('the inclusive string cap still permits a complete described record', () => {
  const { profile, ledger } = changedFixture((profile) => { profile.records[0].text = 'x'.repeat(4096); });
  assertReady(check(profile, ledger));
});

test('ledger line cap refuses bounded input with too many lines', () => {
  const { profile } = fixture();
  const ledger = Buffer.from('\n'.repeat(EXPECTED_LIMITS.ledgerLines + 1));
  assertBlocked(check(profile, ledger));
});

test('duplicate markers at the inclusive ledger line cap remain bounded and blocked', () => {
  const { profile, ledger } = fixture();
  const remaining = EXPECTED_LIMITS.ledgerLines - byteLines(ledger).length;
  const repeated = Buffer.concat([ledger, Buffer.from('<!-- gate0-record:PLAN -->\n'.repeat(remaining))]);
  assert.equal(byteLines(repeated).length, EXPECTED_LIMITS.ledgerLines);
  assert.ok(repeated.length < EXPECTED_LIMITS.inputBytes);
  seal(profile, repeated);
  assertBlocked(check(profile, repeated), 'LEDGER_MARKER_DUPLICATE');
});

test('blocker collection is capped and counts omitted findings', () => {
  const { profile, ledger } = fixture();
  for (let i = 0; i < 600; i += 1) profile.records.push(syntheticRecord(`EXTRA.ORPHAN.${i}`));
  const report = check(profile, ledger);
  assertBlocked(report);
  assert.equal(report.blockers.length, EXPECTED_LIMITS.blockers);
  assert.ok(report.omittedBlockers > 0);
});

test('finalization never closes Gate0, even for a mechanically ready profile', () => {
  const { profile, ledger } = fixture();
  const report = check(profile, ledger, { finalize: true });
  assert.equal(report.mechanical, 'READY_FOR_REVIEW');
  assert.equal(report.finalization, 'BLOCKED');
  assert.ok(report.blockers.some((row) => row.code === 'ACCEPTANCE_PROTOCOL_UNAPPROVED'));
});

test('a blocked profile remains blocked under finalization', () => {
  const { profile, ledger } = changedFixture((profile) => { profile.records[0].state = 'OPEN'; });
  const report = check(profile, ledger, { finalize: true });
  assertBlocked(report, 'RECORD_OPEN');
  assert.equal(report.finalization, 'BLOCKED');
  assert.ok(report.blockers.some((row) => row.code === 'ACCEPTANCE_PROTOCOL_UNAPPROVED'));
});

test('non-boolean finalization options cannot grant authority', () => {
  const { profile, ledger } = fixture();
  assertBlocked(check(profile, ledger, { finalize: 'true' }), 'ARGUMENTS_INVALID');
});

test('main with no arguments reports required IDs without reading', async () => {
  const { exitCode, report } = await invoke([]);
  assert.equal(exitCode, 2);
  assertBlocked(report, 'PROFILE_REQUIRED');
});

test('--plan is lexical, read-free, effect-free, and non-authoritative', async () => {
  const { exitCode, report } = await invoke(['--plan']);
  assert.equal(exitCode, 0);
  assert.equal(report.schema, 'f9-gate0-plan-v1');
  assert.equal(report.result, 'PLAN_ONLY');
  assert.equal(report.scope, 'OFFLINE_STRUCTURAL_CONSISTENCY_ONLY');
  assert.equal(report.profileSchema, 'f9-gate0-profile-v1');
  assert.deepEqual(report.stages, ['anticipated', 'implemented']);
  assert.deepEqual(report.requiredRecords, REQUIRED);
  assert.deepEqual(report.limits, EXPECTED_LIMITS);
  assert.deepEqual(report.previewEffects, { reads: false, subprocesses: false, writes: false, network: false });
  assert.equal(report.gate0, 'OPEN');
  assert.equal(report.f9Qualified, false);
  assert.equal(report.trainingReady, false);
  assert.equal(report.acceptanceProtocol, 'UNAPPROVED');
  assert.equal(report.finalization, 'BLOCKED');
});

test('parsed --finalize remains unapproved when inputs are missing or unreadable', async () => {
  for (const argv of [
    ['--finalize'],
    ['--profile', '/synthetic/profile', '--finalize'],
    ['--profile', '/synthetic/profile', '--ledger', '/synthetic/ledger', '--finalize'],
  ]) {
    const reader = argv.includes('--ledger') ? (() => { throw new Error(PRIVATE_SENTINEL); }) : undefined;
    const { exitCode, report } = await invoke(argv, reader);
    assert.equal(exitCode, 2);
    assertBlocked(report, 'ACCEPTANCE_PROTOCOL_UNAPPROVED');
    assert.equal(report.finalization, 'BLOCKED');
  }
});

for (const argv of [
  ['--plan', '--plan'], ['--plan', '--finalize'],
  ['--plan', '--profile', '/synthetic/profile', '--ledger', '/synthetic/ledger'],
  ['--profile', '/synthetic/profile', '--profile', '/synthetic/profile', '--ledger', '/synthetic/ledger'],
  ['--profile', '/synthetic/profile', '--ledger', '/synthetic/ledger', '--ledger', '/synthetic/ledger'],
  ['--profile', '/synthetic/profile', '--ledger', '/synthetic/ledger', '--finalize', '--finalize'],
  ['positional'], ['--unknown'], ['--yes'], ['--accept'], ['--execute'],
  ['--publish'], ['--install'], ['--train'], ['--help'],
  ['--profile'], ['--ledger'], ['--profile', '--ledger'],
  ['--profile', '/synthetic/profile', '--ledger', '/synthetic/ledger', 'positional'],
]) {
  test(`invalid argv refuses before reading: ${JSON.stringify(argv)}`, async () => {
    const { exitCode, report } = await invoke(argv);
    assert.equal(exitCode, 2);
    assertBlocked(report, 'ARGUMENTS_INVALID');
  });
}

for (const [argv, code] of [
  [['--profile', '/synthetic/profile'], 'LEDGER_REQUIRED'],
  [['--ledger', '/synthetic/ledger'], 'PROFILE_REQUIRED'],
  [['--finalize'], 'PROFILE_REQUIRED'],
]) {
  test(`partial input refuses without a read: ${JSON.stringify(argv)}`, async () => {
    const { exitCode, report } = await invoke(argv);
    assert.equal(exitCode, 2);
    assertBlocked(report, code);
  });
}

for (const invalidPath of [
  '', 'relative', '/', '/synthetic/../profile', '/synthetic/./profile',
  '/synthetic//profile', '/synthetic/profile/', '/synthetic\\profile',
  '/synthetic/a\nb', '/synthetic/a\0b', '/synthetic/a\x7fb',
  `/${'é'.repeat(2048)}`,
]) {
  for (const side of ['profile', 'ledger']) {
    test(`main rejects noncanonical ${side} path before any read: ${JSON.stringify(invalidPath)}`, async () => {
      const argv = ['--profile', '/synthetic/profile', '--ledger', '/synthetic/ledger'];
      argv[side === 'profile' ? 1 : 3] = invalidPath;
      const { exitCode, report } = await invoke(argv);
      assert.equal(exitCode, 2);
      assertBlocked(report, invalidPath === '' ? undefined : 'ARGUMENTS_INVALID');
    });
  }
}

for (const finalize of [false, true]) {
  test(`main uses only the supplied byte reader; finalize=${finalize}`, async () => {
    const { profile, ledger } = fixture();
    const reads = [];
    const argv = ['--ledger', '/synthetic/ledger', '--profile', '/synthetic/profile'];
    if (finalize) argv.push('--finalize');
    const result = await invoke(argv, (pathname) => {
      reads.push(pathname);
      if (pathname === '/synthetic/profile') return encode(profile);
      if (pathname === '/synthetic/ledger') return ledger;
      throw new Error(PRIVATE_SENTINEL);
    });
    assert.equal(reads.length, 2);
    assert.deepEqual(new Set(reads), new Set(['/synthetic/profile', '/synthetic/ledger']));
    assertReport(result.report);
    assert.equal(result.report.mechanical, 'READY_FOR_REVIEW');
    assert.equal(result.exitCode, finalize ? 2 : 0);
    assert.equal(result.report.finalization, finalize ? 'BLOCKED' : 'NOT_REQUESTED');
  });
}

test('main maps untrusted reader errors to closed output without private details', async () => {
  const argv = ['--profile', `/${PRIVATE_SENTINEL}/profile`, '--ledger', '/synthetic/ledger'];
  const { exitCode, report } = await invoke(argv, () => {
    throw new Error(`${PRIVATE_SENTINEL}\nprovider body\nprivate stack`);
  });
  assert.equal(exitCode, 2);
  assertBlocked(report);
});

test('main does not evaluate getters on arbitrary thrown reader values', async () => {
  let accesses = 0;
  const hostile = Object.defineProperties({}, {
    code: { get() { accesses += 1; throw new Error(PRIVATE_SENTINEL); } },
    message: { get() { accesses += 1; throw new Error(PRIVATE_SENTINEL); } },
    stack: { get() { accesses += 1; throw new Error(PRIVATE_SENTINEL); } },
    toString: { get() { accesses += 1; throw new Error(PRIVATE_SENTINEL); } },
  });
  const { exitCode, report } = await invoke(
    ['--profile', '/synthetic/profile', '--ledger', '/synthetic/ledger'],
    () => { throw hostile; },
  );
  assert.equal(exitCode, 2);
  assertBlocked(report);
  assert.equal(accesses, 0);
});

test('main does not throw when the supplied reader returns non-Buffers', async () => {
  const { exitCode, report } = await invoke(
    ['--profile', '/synthetic/profile', '--ledger', '/synthetic/ledger'],
    () => PRIVATE_SENTINEL,
  );
  assert.equal(exitCode, 2);
  assertBlocked(report, 'INPUT_INVALID');
});

test('main handles a throwing output callback without exposing its error', async () => {
  const exitCode = await main(['--plan'], { output() { throw new Error(PRIVATE_SENTINEL); } });
  assert.equal(exitCode, 2);
});

test('reader accepts copied ordinary documents using read-only nonblocking nofollow flags', (t) => {
  const directory = temp(t);
  const filename = path.join(directory, 'copied-document');
  const bytes = Buffer.from(`${SYNTHETIC}\ncopy\n`);
  fs.writeFileSync(filename, bytes, { mode: 0o666 });
  fs.chmodSync(filename, 0o666);
  const { io, events } = trackedIO();
  assert.deepEqual(readGate0Input(filename, io), bytes);
  assert.equal(events.opens.length, 1);
  assert.equal(events.opens[0][0], filename);
  assert.equal(events.opens[0][1], fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  assert.ok(events.stats.length >= 2);
  for (const [, options] of events.stats) assert.equal(options.bigint, true);
  assert.deepEqual(events.closes, [events.stats[0][0]]);
  assert.deepEqual(fs.readFileSync(filename), bytes);
});

test('reader permits stable empty regular files and stable hard-linked copies', (t) => {
  const directory = temp(t);
  const empty = path.join(directory, 'empty');
  fs.writeFileSync(empty, '');
  assert.deepEqual(readGate0Input(empty), Buffer.alloc(0));
  const copy = path.join(directory, 'copy');
  fs.writeFileSync(copy, SYNTHETIC);
  fs.linkSync(copy, path.join(directory, 'second-name'));
  assert.deepEqual(readGate0Input(copy), Buffer.from(SYNTHETIC));
});

test('reader allows ancestor aliases but refuses a symbolic-link leaf', (t) => {
  const directory = temp(t);
  const realDirectory = path.join(directory, 'real');
  fs.mkdirSync(realDirectory);
  const filename = path.join(realDirectory, 'document');
  fs.writeFileSync(filename, SYNTHETIC);
  fs.symlinkSync(realDirectory, path.join(directory, 'ancestor-alias'));
  assert.deepEqual(readGate0Input(path.join(directory, 'ancestor-alias', 'document')), Buffer.from(SYNTHETIC));
  const leaf = path.join(directory, `leaf-${PRIVATE_SENTINEL}`);
  fs.symlinkSync(filename, leaf);
  fixedReadFailure(() => readGate0Input(leaf));
});

test('reader refuses a directory, a missing leaf, and an oversized regular file', (t) => {
  const directory = temp(t);
  fixedReadFailure(() => readGate0Input(directory));
  fixedReadFailure(() => readGate0Input(path.join(directory, PRIVATE_SENTINEL)));
  const filename = path.join(directory, 'oversized');
  fs.writeFileSync(filename, Buffer.alloc(EXPECTED_LIMITS.inputBytes + 1));
  const { io, events } = trackedIO();
  fixedReadFailure(() => readGate0Input(filename, io));
  assert.equal(events.closes.length, 1);
});

test('reader accepts the inclusive file byte cap', (t) => {
  const directory = temp(t);
  const filename = path.join(directory, 'at-cap');
  const bytes = Buffer.alloc(EXPECTED_LIMITS.inputBytes, 120);
  fs.writeFileSync(filename, bytes);
  assert.deepEqual(readGate0Input(filename), bytes);
});

test('reader rejects malformed paths before opening anything', () => {
  let opens = 0;
  const io = { ...fs, openSync() { opens += 1; throw new Error(PRIVATE_SENTINEL); } };
  for (const filename of ['', 'relative', '/', '/a/../b', '/a//b', '/a/./b', '/a/', '/a\\b', '/a\nb', '/a\0b', `/${'é'.repeat(2048)}`]) {
    fixedReadFailure(() => readGate0Input(filename, io));
  }
  assert.equal(opens, 0);
});

test('reader handles repeated short reads without dropping or padding bytes', (t) => {
  const directory = temp(t);
  const filename = path.join(directory, 'short-read');
  const bytes = Buffer.from(`${SYNTHETIC}: multi-read bytes`);
  fs.writeFileSync(filename, bytes);
  let reads = 0;
  const io = {
    ...fs,
    readSync(fd, buffer, offset, length, position) {
      reads += 1;
      if (typeof offset === 'object') {
        return fs.readSync(fd, buffer, { ...offset, length: Math.min(offset.length ?? buffer.length, 3) });
      }
      return fs.readSync(fd, buffer, offset, Math.min(length, 3), position);
    },
  };
  assert.deepEqual(readGate0Input(filename, io), bytes);
  assert.ok(reads > 1);
});

for (const field of ['dev', 'ino', 'mode', 'nlink', 'size', 'mtimeNs', 'ctimeNs']) {
  test(`reader detects changed BigInt ${field} and closes the descriptor`, (t) => {
    const directory = temp(t);
    const filename = path.join(directory, 'changing-metadata');
    fs.writeFileSync(filename, SYNTHETIC);
    let stats = 0;
    let closes = 0;
    const io = {
      ...fs,
      fstatSync(fd, options) {
        assert.equal(options.bigint, true);
        const stat = fs.fstatSync(fd, options);
        stats += 1;
        if (stats > 1) {
          return Object.assign(Object.create(Object.getPrototypeOf(stat)), stat, { [field]: stat[field] + 1n });
        }
        return stat;
      },
      closeSync(fd) { closes += 1; return fs.closeSync(fd); },
    };
    fixedReadFailure(() => readGate0Input(filename, io));
    assert.equal(closes, 1);
  });
}

for (const mutation of ['grow', 'shrink', 'replace']) {
  test(`reader refuses a file that changes during read: ${mutation}`, (t) => {
    const directory = temp(t);
    const filename = path.join(directory, 'changing-file');
    fs.writeFileSync(filename, `${SYNTHETIC}: original bytes`);
    let changed = false;
    let closes = 0;
    const io = {
      ...fs,
      readSync(...args) {
        if (!changed) {
          changed = true;
          if (mutation === 'grow') fs.appendFileSync(filename, ': growth');
          if (mutation === 'shrink') fs.truncateSync(filename, 1);
          if (mutation === 'replace') {
            const replacement = path.join(directory, 'replacement');
            fs.writeFileSync(replacement, `${SYNTHETIC}: replacement`);
            fs.renameSync(replacement, filename);
          }
        }
        return fs.readSync(...args);
      },
      closeSync(fd) { closes += 1; return fs.closeSync(fd); },
    };
    fixedReadFailure(() => readGate0Input(filename, io));
    assert.equal(closes, 1);
  });
}

for (const failurePoint of ['fstatSync', 'readSync']) {
  test(`reader closes its descriptor after ${failurePoint} throws`, (t) => {
    const directory = temp(t);
    const filename = path.join(directory, 'throwing-io');
    fs.writeFileSync(filename, SYNTHETIC);
    let closes = 0;
    const io = {
      ...fs,
      [failurePoint]() { throw new Error(PRIVATE_SENTINEL); },
      closeSync(fd) { closes += 1; return fs.closeSync(fd); },
    };
    fixedReadFailure(() => readGate0Input(filename, io));
    assert.equal(closes, 1);
  });
}

test('reader maps a close-hook failure to the same fixed error', (t) => {
  const directory = temp(t);
  const filename = path.join(directory, 'close-error');
  fs.writeFileSync(filename, SYNTHETIC);
  let closes = 0;
  const io = {
    ...fs,
    closeSync(fd) {
      closes += 1;
      fs.closeSync(fd);
      throw new Error(PRIVATE_SENTINEL);
    },
  };
  fixedReadFailure(() => readGate0Input(filename, io));
  assert.equal(closes, 1);
});

for (const [failurePoint, expectedCode] of [
  ['read', 'INPUT_READ_FAILED'], ['metadata', 'INPUT_CHANGED'], ['size', 'INPUT_TOO_LARGE'],
]) {
  test(`reader preserves the primary ${failurePoint} refusal when close also throws`, async (t) => {
    const directory = temp(t);
    const filename = path.join(directory, 'primary-refusal');
    fs.writeFileSync(filename, SYNTHETIC);
    let stats = 0;
    let closes = 0;
    let reads = 0;
    const io = {
      ...fs,
      fstatSync(fd, options) {
        const stat = fs.fstatSync(fd, options);
        stats += 1;
        if (failurePoint === 'size') {
          return Object.assign(Object.create(Object.getPrototypeOf(stat)), stat, {
            size: BigInt(EXPECTED_LIMITS.inputBytes) + 1n,
          });
        }
        if (failurePoint === 'metadata' && stats > 1) {
          return Object.assign(Object.create(Object.getPrototypeOf(stat)), stat, { ino: stat.ino + 1n });
        }
        return stat;
      },
      readSync(...args) {
        reads += 1;
        if (failurePoint === 'read') throw new Error(`${PRIVATE_SENTINEL}: primary read body`);
        return fs.readSync(...args);
      },
      closeSync(fd) {
        closes += 1;
        fs.closeSync(fd);
        throw new Error(`${PRIVATE_SENTINEL}: close body`);
      },
    };
    const { exitCode, report } = await invoke(
      ['--profile', filename, '--ledger', path.join(directory, 'unused-ledger')],
      (pathname) => {
        assert.equal(pathname, filename);
        return readGate0Input(pathname, io);
      },
    );
    assert.equal(exitCode, 2);
    assertBlocked(report, expectedCode);
    assert.equal(closes, 1);
    if (failurePoint === 'size') assert.equal(reads, 0);
  });
}

for (const received of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, EXPECTED_LIMITS.inputBytes + 2]) {
  test(`reader refuses an invalid injected read count ${received}`, (t) => {
    const directory = temp(t);
    const filename = path.join(directory, 'invalid-read-count');
    fs.writeFileSync(filename, SYNTHETIC);
    let closes = 0;
    const io = {
      ...fs,
      readSync() { return received; },
      closeSync(fd) { closes += 1; return fs.closeSync(fd); },
    };
    fixedReadFailure(() => readGate0Input(filename, io));
    assert.equal(closes, 1);
  });
}

test('reader refuses fake special-file metadata before any read', (t) => {
  const directory = temp(t);
  const filename = path.join(directory, 'fake-special');
  fs.writeFileSync(filename, SYNTHETIC);
  let reads = 0;
  let closes = 0;
  const io = {
    ...fs,
    fstatSync(fd, options) {
      const stat = fs.fstatSync(fd, options);
      return Object.assign(Object.create(Object.getPrototypeOf(stat)), stat, { isFile: () => false });
    },
    readSync() { reads += 1; throw new Error(PRIVATE_SENTINEL); },
    closeSync(fd) { closes += 1; return fs.closeSync(fd); },
  };
  fixedReadFailure(() => readGate0Input(filename, io));
  assert.equal(reads, 0);
  assert.equal(closes, 1);
});

function ownedBun(args, { cwd, env = {} } = {}) {
  assert.ok(process.versions.bun, 'black-box fixtures must run only with the owned Bun interpreter');
  const child = spawnSync(process.execPath, ['--no-env-file', '--no-install', ...args], {
    cwd,
    env: { PATH: path.join(cwd, 'forbidden-bin'), HOME: cwd, TMPDIR: cwd,
      BUN_RUNTIME_TRANSPILER_CACHE_PATH: '0', ...env },
    encoding: 'utf8',
    timeout: 10000,
    maxBuffer: 2 * EXPECTED_LIMITS.inputBytes,
    shell: false,
  });
  assert.equal(child.error, undefined);
  assert.equal(child.signal, null);
  assert.equal(child.stderr, '');
  return child;
}

function forbiddenProviderPath(directory) {
  const bin = path.join(directory, 'forbidden-bin');
  fs.mkdirSync(bin);
  const marker = path.join(directory, 'FORBIDDEN_PROVIDER_WAS_CALLED');
  const script = `#!${process.execPath}\nimport { writeFileSync } from 'node:fs';\nwriteFileSync(${JSON.stringify(marker)}, 'FORBIDDEN');\nprocess.exit(91);\n`;
  for (const name of ['native', 'sbx', 'SBXNative', 'mise', 'cargo', 'rustc', 'node', 'bun', 'git', 'curl', 'wget', 'train']) {
    fs.writeFileSync(path.join(bin, name), script, { mode: 0o700 });
  }
  return marker;
}

const bunOnly = { skip: !process.versions.bun && 'black-box subprocesses require the owned Bun interpreter' };

function stableFileMetadata(filename) {
  const stat = fs.statSync(filename, { bigint: true });
  return Object.fromEntries(['dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtimeNs', 'ctimeNs']
    .map((key) => [key, stat[key]]));
}

test('black-box CLI remains lexical for --plan with forbidden provider PATH', bunOnly, (t) => {
  const directory = temp(t);
  const marker = forbiddenProviderPath(directory);
  const before = fs.readdirSync(directory).sort();
  const child = ownedBun([CHECKER_PATH, '--plan'], { cwd: directory });
  assert.equal(child.status, 0);
  assert.equal(JSON.parse(child.stdout).result, 'PLAN_ONLY');
  assert.equal(fs.existsSync(marker), false);
  assert.deepEqual(fs.readdirSync(directory).sort(), before);
});

test('black-box import has no CLI effects, output, or provider probes', bunOnly, (t) => {
  const directory = temp(t);
  const marker = forbiddenProviderPath(directory);
  const harness = path.join(directory, 'import-only.mjs');
  const url = new URL('../f9-gate0.mjs', import.meta.url).href;
  fs.writeFileSync(harness, [
    "import fs from 'node:fs';",
    'let importEffects = 0;',
    "for (const method of ['openSync', 'readSync', 'readFileSync', 'statSync', 'lstatSync', 'accessSync', 'existsSync', 'writeFileSync', 'appendFileSync', 'mkdirSync']) {",
    "  fs[method] = () => { importEffects += 1; throw new Error('SYNTHETIC_ONLY_IMPORT_IO_FORBIDDEN'); };",
    '}',
    `process.argv = [process.execPath, ${JSON.stringify(CHECKER_PATH)}, '--finalize', '--profile', '/SYNTHETIC_ONLY/missing', '--ledger', '/SYNTHETIC_ONLY/missing'];`,
    `const imported = await import(${JSON.stringify(url)});`,
    "if (typeof imported.main !== 'function') process.exit(92);",
    'if (importEffects !== 0) process.exit(93);',
    "console.log('SYNTHETIC_ONLY_IMPORT_COMPLETED');",
  ].join('\n'));
  const before = fs.readdirSync(directory).sort();
  const child = ownedBun([harness], { cwd: directory });
  assert.equal(child.status, 0);
  assert.equal(child.stdout, 'SYNTHETIC_ONLY_IMPORT_COMPLETED\n');
  assert.equal(fs.existsSync(marker), false);
  assert.deepEqual(fs.readdirSync(directory).sort(), before);
});

for (const finalize of [false, true]) {
  test(`black-box CLI reads only synthetic inputs and never writes; finalize=${finalize}`, bunOnly, (t) => {
    const directory = temp(t);
    const marker = forbiddenProviderPath(directory);
    const { profile, ledger } = fixture();
    const profilePath = path.join(directory, 'profile.json');
    const ledgerPath = path.join(directory, 'ledger.md');
    const profileBytes = encode(profile);
    fs.writeFileSync(profilePath, profileBytes);
    fs.writeFileSync(ledgerPath, ledger);
    const before = fs.readdirSync(directory).sort();
    const metadataBefore = [stableFileMetadata(profilePath), stableFileMetadata(ledgerPath)];
    const args = [CHECKER_PATH, '--profile', profilePath, '--ledger', ledgerPath];
    if (finalize) args.push('--finalize');
    const child = ownedBun(args, { cwd: directory });
    assert.equal(child.status, finalize ? 2 : 0);
    const report = assertReport(JSON.parse(child.stdout));
    assert.equal(report.mechanical, 'READY_FOR_REVIEW');
    assert.equal(report.finalization, finalize ? 'BLOCKED' : 'NOT_REQUESTED');
    assert.deepEqual(fs.readFileSync(profilePath), profileBytes);
    assert.deepEqual(fs.readFileSync(ledgerPath), ledger);
    assert.deepEqual([stableFileMetadata(profilePath), stableFileMetadata(ledgerPath)], metadataBefore);
    assert.deepEqual(fs.readdirSync(directory).sort(), before);
    assert.equal(fs.existsSync(marker), false);
  });
}

test('black-box CLI missing inputs and rejected authority flags remain exit 2', bunOnly, (t) => {
  const directory = temp(t);
  const marker = forbiddenProviderPath(directory);
  const before = fs.readdirSync(directory).sort();
  for (const argv of [
    [], ['--yes'], ['--accept'], ['--execute'],
    ['--profile', path.join(directory, PRIVATE_SENTINEL), '--ledger', path.join(directory, 'missing-ledger')],
  ]) {
    const child = ownedBun([CHECKER_PATH, ...argv], { cwd: directory });
    assert.equal(child.status, 2);
    assertBlocked(assertReport(JSON.parse(child.stdout)));
    assert.ok(!child.stdout.includes(PRIVATE_SENTINEL));
  }
  assert.deepEqual(fs.readdirSync(directory).sort(), before);
  assert.equal(fs.existsSync(marker), false);
});

test('Mise exposes the checker as an isolated no-install, no-env-file Bun task', () => {
  const mise = fs.readFileSync(MISE_PATH, 'utf8');
  const task = mise.match(/^\[tasks\."f9:gate0"\]\s*\n([\s\S]*?)(?=^\[|$(?![\s\S]))/m);
  assert.ok(task, 'Mise must define f9:gate0');
  assert.match(task[1], /^raw_args\s*=\s*true\s*$/m);
  assert.match(task[1], /^run\s*=\s*"bun --no-env-file --no-install tooling\/native-ingress\/f9-gate0\.mjs"\s*$/m);
  assert.doesNotMatch(task[1], /^\s*(?:depends|wait_for)\s*=/m);
});
