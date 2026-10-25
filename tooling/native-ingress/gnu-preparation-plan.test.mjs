// SPEC: _spec/tooling/native-ingress/step2.puml
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as production from './gnu-preparation-plan.mjs';

const { GNU_PREPARATION_PLAN_V1_PINS: pins, createGnuPreparationPlanV1: create } = production;
const source = readFileSync(new URL('./gnu-preparation-plan.mjs', import.meta.url), 'utf8');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const names = Object.keys(pins);
const inputs = Object.fromEntries(Object.entries(pins).map(([name, pin]) => [name, readFileSync(new URL('../../' + pin.path, import.meta.url))]));
const saved = Object.fromEntries(Object.entries(inputs).map(([name, bytes]) => [name, JSON.parse(bytes.toString('utf8'))]));
const report = create(inputs);
const root = 'x86-64--glibc--stable-2026.08-1';
const header = ['PACKAGE', 'VERSION', 'LICENSE', 'LICENSE FILES', 'SOURCE ARCHIVE', 'SOURCE SITE', 'DEPENDENCIES WITH LICENSES'];
const csvRecord = cells => cells.map(cell => '"' + cell.replaceAll('"', '""') + '"').join(',');
const headerText = csvRecord(header);
const row = ['package', '1.0', 'literal license', 'COPYING', 'source.tar.gz', 'https://example.invalid/raw', 'a [x] b [y]'];
const csv = (rows = [row], separator = '\n', final = true) => [headerText, ...rows.map(csvRecord)].join(separator) + (final ? separator : '');
const member = { path: root + '/summary.csv', index: 8391, bodyOffset: 505059840, size: 10391,
  bodySha256: 'da71ea6f278ae7314e122fb382a8860b19e88252bc89a730eea2a7f8d3c95621' };
const pinStart = source.indexOf('export const GNU_PREPARATION_PLAN_V1_PINS = freeze({');
const pinEnd = source.indexOf('\n});', pinStart) + '\n});'.length;
let moduleId = 0;
async function testModule({ testPins = pins, append = '', instrument = false } = {}) {
  assert.ok(pinStart >= 0 && pinEnd > pinStart);
  let text = source.slice(0, pinStart) + 'export const GNU_PREPARATION_PLAN_V1_PINS = freeze(' + JSON.stringify(testPins) + ');' + source.slice(pinEnd);
  if (instrument) {
    text = 'let TEST_ONLY_hashes = 0, TEST_ONLY_parses = 0;\n' + text;
    const hashLine = "const sha = bytes => createHash('sha256').update(bytes).digest('hex');";
    assert.ok(text.includes(hashLine));
    text = text.replace(hashLine, "const sha = bytes => (TEST_ONLY_hashes++, createHash('sha256').update(bytes).digest('hex'));");
    assert.ok(text.includes('value = JSON.parse('));
    text = text.replace('value = JSON.parse(', 'TEST_ONLY_parses++; value = JSON.parse(');
    append += '\nexport const TEST_ONLY_counts = () => ({ hashes: TEST_ONLY_hashes, parses: TEST_ONLY_parses });';
  }
  return import('data:text/javascript;base64,' + Buffer.from(text + '\n' + append + '\n// TEST_ONLY_MODULE_' + moduleId++).toString('base64'));
}
const internals = await testModule({ append: 'export { parseCsv as TEST_ONLY_csv, data as TEST_ONLY_data, boundedReport as TEST_ONLY_report };' });
const parseCsv = text => internals.TEST_ONLY_csv(text, member);
const smallInputs = Object.fromEntries(names.map(name => [name, Buffer.from('{}')]));
const smallPins = Object.fromEntries(names.map(name => [name, { ...pins[name], byteLength: 2, sha256: sha(smallInputs[name]) }]));
const small = await testModule({ testPins: smallPins, instrument: true,
  append: 'export { inputSnapshots as TEST_ONLY_snapshots };' });
const error = (fn, code) => assert.throws(fn, e => e.code === code && e.message === code && Object.isFrozen(e));
function allFrozen(value) {
  if (!value || typeof value !== 'object') return;
  assert.ok(Object.isFrozen(value));
  for (const child of Object.values(value)) allFrozen(child);
}
async function mutation(change) {
  const docs = structuredClone(saved);
  change(docs);
  let bytes = Buffer.from(JSON.stringify(docs.gnuEvidence) + '\n');
  const gnuPin = { ...pins.gnuEvidence, byteLength: bytes.length, sha256: sha(bytes) };
  Object.assign(docs.gnuEvidenceReceipt.result, { byteLength: gnuPin.byteLength, sha256: gnuPin.sha256 });
  docs.gnuPreparationEvidence.sourceInputPins.acceptedGnuData = { bytes: gnuPin.byteLength, sha256: gnuPin.sha256 };
  docs.gnuPreparationReceipt.sourceInputPins = structuredClone(docs.gnuPreparationEvidence.sourceInputPins);
  bytes = Buffer.from(JSON.stringify(docs.gnuPreparationEvidence) + '\n');
  Object.assign(docs.gnuPreparationReceipt, { byteLength: bytes.length, sha256: sha(bytes) });
  const testInputs = Object.fromEntries(names.map(name => [name, Buffer.from(JSON.stringify(docs[name]) + '\n')]));
  const testPins = Object.fromEntries(names.map(name => [name, { ...pins[name], byteLength: testInputs[name].length, sha256: sha(testInputs[name]) }]));
  const unit = await testModule({ testPins });
  return () => unit.createGnuPreparationPlanV1(testInputs);
}

test('production exports only the pinned constant and pure entry point', () => {
  assert.deepEqual(Object.keys(production).sort(), ['GNU_PREPARATION_PLAN_V1_PINS', 'createGnuPreparationPlanV1']);
  assert.match(source, /^\/\/ SPEC: _spec\/tooling\/native-ingress\/step2\.puml\n/u);
  assert.deepEqual([...source.matchAll(/^import .* from '([^']+)';$/gmu)].map(match => match[1]), ['node:crypto', 'node:util']);
  assert.doesNotMatch(source, /\b(?:process|fetch|console|require|eval|Function|stdin|child_process)\b|\bimport\s*\(/u);
});
test('four exact immutable production pins match saved input bytes', () => {
  assert.deepEqual(names, ['gnuEvidence', 'gnuEvidenceReceipt', 'gnuPreparationEvidence', 'gnuPreparationReceipt']);
  assert.deepEqual(names.map(name => pins[name].byteLength), [2829942, 3428, 2724242, 8583]);
  assert.deepEqual(names.map(name => pins[name].sha256), [
    '01c24e73a65148b8a70c3c1d4034f86dcac8040859bc206b5cf40b784776cc22',
    'bb7f0ad07f8022bcba026b142bb40fe27651f534c35e119a4e1d9a3d2862a6e8',
    '3ae1a4949a913b972695a32dfab2076354e49a70a960021a34050c63a9bb281b',
    'dc06975401c17e41b24e75beb37eb8de2bcf3c30066773aaf53defdcf6dd30b6',
  ]);
  for (const name of names) {
    assert.equal(inputs[name].length, pins[name].byteLength);
    assert.equal(sha(inputs[name]), pins[name].sha256);
    assert.equal(pins[name].name, name);
  }
  allFrozen(pins);
});
test('real four-buffer report succeeds without full-result self-publication fields', () => {
  assert.equal(Object.hasOwn(saved.gnuEvidence, 'publicationAccepted'), false);
  assert.equal(Object.hasOwn(saved.gnuPreparationEvidence, 'publicationAccepted'), false);
  assert.equal(Object.hasOwn(saved.gnuEvidenceReceipt, 'mockOnly'), false);
  assert.equal(report.profile, 'GNU_PREPARATION_PLAN_V1');
  assert.equal(report.status, 'PROPOSED_DATA_SUPPLEMENT');
  assert.equal(report.csvParsed, true);
  assert.equal(report.semanticInterpretation, false);
  assert.equal(report.sourceContext, 'UNQUALIFIED');
});
test('real report remains recursively frozen deterministic DATA below one MiB', () => {
  allFrozen(report);
  assert.equal(JSON.stringify(create(inputs)), JSON.stringify(report));
  assert.equal(internals.TEST_ONLY_report(structuredClone(report)).status, report.status);
  const ascii = JSON.stringify(report).replace(/[\u007f-\uffff]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')) + '\n';
  assert.ok(Buffer.byteLength(ascii) < 1048576);
  assert.equal(JSON.stringify(internals.TEST_ONLY_report(structuredClone(report))), JSON.stringify(report));
});
test('caller buffers remain byte-for-byte unchanged', () => {
  for (const name of names) assert.equal(sha(inputs[name]), pins[name].sha256);
});
test('all qualification and authority flags stay false', () => {
  for (const key of ['sourceAuthenticated', 'licenseComplianceVerified', 'licensePermissionClassified', 'copyAuthorized',
    'includeClosureVerified', 'sysrootClosureVerified', 'relocationReady', 'pythonFreeSubsetVerified',
    'runtimeProvidersQualified', 'abiVerified', 'imagePrepared', 'nativeQualified', 'rustReady', 'trainingReady',
    'publisherAuthenticated', 'fullSourceGraphVerified', 'urlsFollowed', 'readmeInstructionsExecuted', 'sourceReady']) assert.equal(report[key], false);
  assert.ok(report.unresolvedObligations.every(obligation => obligation.status === 'OPEN' && obligation.resolution === 'UNRESOLVED'));
  for (const obligation of report.unresolvedObligations.filter(row => row.kind !== 'COPY_PERMISSION')) {
    assert.equal(obligation.requiredArtifactsVerified, false);
    assert.equal(Object.hasOwn(obligation, 'actualArtifactsPresent'), false);
  }
});
test('source dependencies and custody claims remain declared rather than currently observed', () => {
  const declarations = report.inputBindings.sourceDependencyDeclarations;
  assert.deepEqual(declarations.gnu, saved.gnuEvidence.sourceInputPins);
  assert.deepEqual(declarations.gnuPreparation, saved.gnuPreparationEvidence.sourceInputPins);
  assert.equal(declarations.status, 'DECLARED_IDENTITIES_ONLY');
  assert.equal(declarations.sourceFileBytesVerified, false);
  assert.equal(declarations.moduleGraphVerified, false);
  assert.equal(declarations.custodyStatus, 'SAVED_CLAIMS_NOT_INDEPENDENT_CURRENT_OBSERVATIONS');
});
test('old member plan stays an unread append-only reference', () => {
  assert.deepEqual(report.priorMemberPlanReference, {
    path: '_spec/tooling/native-ingress/toolchain-member-plan-v1.result.json', byteLength: 5679112,
    sha256: '2c4cd5218dce220e55dabe96345b97cc777c2cdc10c6e18b8d53f1357d2a94da',
    relationship: 'APPEND_ONLY_REFERENCE_NOT_READ_OR_REVERIFIED', read: false, reverified: false,
  });
});
test('all 150 exact private-header ledger records survive unchanged', () => {
  const supplement = report.headerSelectionSupplement;
  assert.equal(supplement.count, 150);
  assert.equal(supplement.bytes, 2907751);
  assert.deepEqual(supplement.records, saved.gnuPreparationEvidence.headerLedger);
  assert.equal(new Set(supplement.records.map(record => record.path)).size, 150);
  const old = saved.gnuEvidence.collection.roles[0].members;
  for (const record of supplement.records) {
    const m = old[record.index - 1];
    for (const key of ['index', 'path', 'bodyOffset', 'size', 'bodySha256']) assert.equal(record[key], m[key]);
    assert.equal(m.type, 'file');
    assert.equal(record.domain, 'TARGET');
    assert.equal(record.copyAuthorized, false);
  }
});
test('plugin inventory and include-fixed README stay unadmitted context', () => {
  assert.equal(report.pluginSummary.regularFiles, 560);
  assert.equal(report.pluginSummary.bytes, 9731900);
  assert.equal(report.pluginSummary.disposition, 'UNADMITTED');
  assert.equal(report.pluginSummary.copyAuthorized, false);
  assert.equal(report.includeFixedContext.admittedHeaders, 0);
  assert.equal(report.includeFixedContext.headersInferred, false);
});
test('all three literal raw observations retain their member hashes and false interpretation', () => {
  assert.equal(report.distributionTextContext.length, 3);
  let bytes = 0;
  for (const [i, context] of report.distributionTextContext.entries()) {
    const selected = saved.gnuPreparationEvidence.collection.roles[0].selected[i];
    assert.deepEqual(context.rawObservation, selected.metadata.observation);
    assert.equal(context.rawObservation.interpreted, false);
    assert.equal(context.rawObservation.urlsFollowed, false);
    assert.equal(sha(Buffer.from(context.rawObservation.text)), context.bodySha256);
    assert.equal(Buffer.byteLength(context.rawObservation.text), context.size);
    assert.equal(context.domain, 'DISTRIBUTION_DATA');
    assert.equal(context.readmeInstructionsExecuted, false);
    bytes += context.size;
  }
  assert.equal(bytes, 12234);
});
test('real CSV keeps every row, cell, raw record and byte span', () => {
  const declarations = report.distributionDeclarations;
  const text = report.distributionTextContext[1].rawObservation.text;
  const parsed = parseCsv(text);
  assert.deepEqual(declarations.header, header);
  assert.equal(declarations.rowCount, parsed.rowCount);
  assert.equal(declarations.rows.length, text.trimEnd().split('\n').length - 1);
  const bytes = Buffer.from(text);
  for (const [i, record] of [declarations.headerRecord, ...declarations.rows].entries()) {
    assert.equal(record.recordIndex, i + 1);
    assert.equal(bytes.subarray(record.sourceSpan.startByte, record.sourceSpan.endByte).toString(), record.rawRecord);
    assert.equal(sha(Buffer.from(record.rawRecord)), record.rawRecordSha256);
    assert.equal(record.cells.length, 7);
    assert.equal(record.sourceMember.path, root + '/summary.csv');
    if (i) {
      assert.equal(record.ordinal, i);
      assert.equal(record.domain, 'UNRESOLVED');
      assert.equal(record.licenseNoticeStatus, 'UNRESOLVED');
      assert.equal(record.sourceContextStatus, 'UNRESOLVED');
    }
  }
});
test('real duplicate package declarations stay separate and license/dependency cells stay literal', () => {
  const rows = report.distributionDeclarations.rows;
  for (const name of ['gcc-final', 'gdb', 'readline', 'ncurses']) assert.ok(rows.filter(record => record.packageLabel === name).length >= 2);
  assert.ok(rows.some(record => record.cells[2].includes(',')));
  assert.ok(rows.some(record => record.cells[6].includes(' [')));
  assert.equal(Object.hasOwn(report.distributionDeclarations, 'byPackage'), false);
});

for (const [label, options] of [
  ['undefined', undefined], ['null', null], ['array', []], ['missing field', { ...smallInputs, gnuEvidence: undefined }],
  ['extra option', { ...smallInputs, limits: {} }], ['prototype', Object.assign(Object.create({}), smallInputs)],
  ['symbol option', { ...smallInputs, [Symbol('extra')]: 1 }], ['Uint8Array', { ...smallInputs, gnuEvidence: new Uint8Array(2) }],
]) test('rejects top-level shape: ' + label, () => error(() => small.createGnuPreparationPlanV1(options), 'E_INPUT'));
test('rejects additional positional arguments and omitted argument', () => {
  error(() => small.createGnuPreparationPlanV1(smallInputs, {}), 'E_INPUT');
  error(() => small.createGnuPreparationPlanV1(), 'E_INPUT');
});
test('rejects a missing own field even with matching field count', () => {
  const options = { ...smallInputs };
  delete options.gnuEvidence;
  options.wrong = Buffer.from('{}');
  error(() => small.createGnuPreparationPlanV1(options), 'E_INPUT');
});
test('rejects top-level proxy without executing any trap', () => {
  let calls = 0;
  const proxy = new Proxy(smallInputs, { get() { calls++; throw Error(); }, ownKeys() { calls++; throw Error(); }, getPrototypeOf() { calls++; throw Error(); } });
  error(() => small.createGnuPreparationPlanV1(proxy), 'E_INPUT');
  assert.equal(calls, 0);
});
test('rejects revoked proxy without accessing it', () => {
  const { proxy, revoke } = Proxy.revocable({}, {});
  revoke();
  error(() => small.createGnuPreparationPlanV1(proxy), 'E_INPUT');
});
test('rejects option getter without invoking it', () => {
  let calls = 0;
  const options = { ...smallInputs };
  Object.defineProperty(options, 'gnuEvidence', { enumerable: true, get() { calls++; return smallInputs.gnuEvidence; } });
  error(() => small.createGnuPreparationPlanV1(options), 'E_INPUT');
  assert.equal(calls, 0);
});
test('rejects non-enumerable option and toJSON hook without invocation', () => {
  const options = { ...smallInputs };
  Object.defineProperty(options, 'gnuEvidence', { enumerable: false, value: smallInputs.gnuEvidence });
  error(() => small.createGnuPreparationPlanV1(options), 'E_INPUT');
  let calls = 0;
  error(() => small.createGnuPreparationPlanV1({ ...smallInputs, toJSON() { calls++; } }), 'E_INPUT');
  assert.equal(calls, 0);
});
test('rejects Buffer proxy without traps', () => {
  let calls = 0;
  const value = new Proxy(Buffer.from('{}'), { get() { calls++; throw Error(); }, getPrototypeOf() { calls++; throw Error(); } });
  error(() => small.createGnuPreparationPlanV1({ ...smallInputs, gnuEvidence: value }), 'E_INPUT');
  assert.equal(calls, 0);
});
test('rejects Buffer subclass prototype', () => {
  class Subclass extends Buffer {}
  const value = Object.setPrototypeOf(Buffer.from('{}'), Subclass.prototype);
  error(() => small.createGnuPreparationPlanV1({ ...smallInputs, gnuEvidence: value }), 'E_INPUT');
});
for (const key of ['length', 'toJSON', 'toString', 'valueOf', Symbol.iterator]) test('rejects Buffer own hook without invoking ' + String(key), () => {
  let calls = 0;
  const value = Buffer.from('{}');
  Object.defineProperty(value, key, { get() { calls++; throw Error(); } });
  error(() => small.createGnuPreparationPlanV1({ ...smallInputs, gnuEvidence: value }), 'E_INPUT');
  assert.equal(calls, 0);
});
test('rejects forged Buffer prototype without reaching copies or parsing', () => {
  const value = Object.create(Buffer.prototype);
  error(() => small.createGnuPreparationPlanV1({ ...smallInputs, gnuEvidence: value }), 'E_INPUT');
});
test('checks byte cap before inspecting Buffer own hooks or copying', () => {
  const before = small.TEST_ONLY_counts();
  const value = Buffer.alloc(4194305);
  let calls = 0;
  Object.defineProperty(value, 'toJSON', { get() { calls++; throw Error(); } });
  error(() => small.createGnuPreparationPlanV1({ ...smallInputs, gnuEvidence: value }), 'E_INPUT_LIMIT');
  assert.deepEqual(small.TEST_ONLY_counts(), before);
  assert.equal(calls, 0);
});
test('accepts null-prototype exact options and makes detached byte snapshots', () => {
  const options = Object.assign(Object.create(null), Object.fromEntries(names.map(name => [name, Buffer.from('{}')])));
  const copies = small.TEST_ONLY_snapshots(options);
  for (const [i, name] of names.entries()) {
    assert.notEqual(copies[i], options[name]);
    options[name][0] = 0;
    assert.equal(copies[i].toString(), '{}');
  }
});
for (const name of names) for (const kind of ['length', 'digest']) test('hashes all four before parsing on ' + name + ' ' + kind + ' mismatch', () => {
  const before = small.TEST_ONLY_counts();
  const bytes = Buffer.from(kind === 'length' ? '{' : '[]');
  error(() => small.createGnuPreparationPlanV1({ ...smallInputs, [name]: bytes }), 'E_INPUT_PIN');
  const after = small.TEST_ONLY_counts();
  assert.equal(after.hashes - before.hashes, 4);
  assert.equal(after.parses - before.parses, 0);
});
test('production rejects same-length changed evidence bytes before JSON parsing', () => {
  const changed = Buffer.from(inputs.gnuEvidence);
  changed[0] = 0;
  error(() => create({ ...inputs, gnuEvidence: changed }), 'E_INPUT_PIN');
});
test('parses only after all four successful pins and reports fixed JSON errors', async () => {
  const bytes = Buffer.from('{!');
  const testPins = { ...smallPins, gnuEvidence: { ...smallPins.gnuEvidence, sha256: sha(bytes) } };
  const unit = await testModule({ testPins, instrument: true });
  error(() => unit.createGnuPreparationPlanV1({ ...smallInputs, gnuEvidence: bytes }), 'E_JSON');
  assert.deepEqual(unit.TEST_ONLY_counts(), { hashes: 4, parses: 1 });
});
test('test-only specialization does not modify production pins or source bytes', () => {
  assert.equal(pins.gnuEvidence.byteLength, 2829942);
  assert.equal(pins.gnuEvidence.sha256, sha(inputs.gnuEvidence));
  assert.equal(readFileSync(new URL('./gnu-preparation-plan.mjs', import.meta.url), 'utf8'), source);
  assert.equal(small.GNU_PREPARATION_PLAN_V1_PINS.gnuEvidence.byteLength, 2);
  assert.equal(Object.hasOwn(production, 'TEST_ONLY_csv'), false);
});

test('CSV accepts LF, CRLF and optional final terminator', () => {
  for (const separator of ['\n', '\r\n']) for (const final of [false, true]) {
    const parsed = parseCsv(csv([row], separator, final));
    assert.deepEqual(parsed.rows[0].cells, row);
    assert.equal(parsed.rows[0].ordinal, 1);
    assert.equal(parsed.rows[0].recordIndex, 2);
  }
});
test('CSV accepts doubled quotes and keeps exact raw quoting and commas', () => {
  const cells = ['a"b', 'v,2', '', '"COPYING"', 'archive', 'url', 'deps "x,y"'];
  const parsed = parseCsv(csv([cells]));
  assert.deepEqual(parsed.rows[0].cells, cells);
  assert.equal(parsed.rows[0].rawRecord, csvRecord(cells));
});
test('CSV keeps spaces, tabs, empty cells and duplicate package rows without repair', () => {
  const cells = [' same ', '\t1 ', '  GPL literal  ', '', '', '', ' a  [b]\t'];
  const parsed = parseCsv(csv([cells, cells]));
  assert.equal(parsed.rowCount, 2);
  assert.deepEqual(parsed.rows[0].cells, cells);
  assert.deepEqual(parsed.rows[1].cells, cells);
  assert.notEqual(parsed.rows[0].ordinal, parsed.rows[1].ordinal);
});
test('CSV computes UTF-8 byte spans across non-ASCII BMP and astral characters', () => {
  const cells = ['é中🙂', '１', 'licensé', '', '', '', ''];
  const text = csv([cells, row], '\r\n', false), bytes = Buffer.from(text);
  const parsed = parseCsv(text);
  for (const record of [parsed.headerRecord, ...parsed.rows]) {
    const rawBytes = bytes.subarray(record.sourceSpan.startByte, record.sourceSpan.endByte);
    assert.equal(rawBytes.toString(), record.rawRecord);
    assert.equal(sha(rawBytes), record.rawRecordSha256);
  }
  assert.equal(parsed.rows[1].sourceSpan.startByte,
    Buffer.byteLength(headerText + '\r\n' + csvRecord(cells) + '\r\n'));
});
test('CSV header is distinct from one-based data ordinals and carries the source member', () => {
  const parsed = parseCsv(csv());
  assert.equal(parsed.headerRecord.recordIndex, 1);
  assert.equal(Object.hasOwn(parsed.headerRecord, 'ordinal'), false);
  assert.equal(parsed.rows[0].recordIndex, 2);
  assert.equal(parsed.rows[0].ordinal, 1);
  assert.deepEqual(parsed.rows[0].sourceMember, member);
  assert.deepEqual(parsed.header, header);
});
test('CSV accepts an exact header with zero data rows', () => {
  assert.equal(parseCsv(headerText).rowCount, 0);
});
for (const [label, text] of [
  ['empty', ''], ['BOM', '\ufeff' + csv()], ['unquoted header', header.join(',') + '\n'],
  ['wrong header case', csv().replace('PACKAGE', 'package')], ['header padding', csv().replace('PACKAGE', ' PACKAGE')],
  ['unquoted cell', headerText + '\n' + 'package,' + csvRecord(row.slice(1))],
  ['unclosed quote', headerText + '\n"unterminated'], ['stray quote', csv().replace('"package"', '"pack"age"')],
  ['space after closing quote', csv().replace('"package",', '"package" ,')],
  ['space before opening quote', headerText + '\n ' + csvRecord(row)],
  ['missing column', headerText + '\n' + csvRecord(row.slice(0, 6))],
  ['extra column', headerText + '\n' + csvRecord([...row, 'extra'])],
  ['trailing comma', headerText + '\n' + csvRecord(row) + ','],
  ['blank record', csv() + '\n'], ['bare CR record separator', headerText + '\r' + csvRecord(row)],
  ['embedded LF', csv([[...row.slice(0, 6), 'x\ny']])], ['embedded CR', csv([[...row.slice(0, 6), 'x\ry']])],
  ['lone surrogate', csv([[...row.slice(0, 6), '\ud800']])],
]) test('CSV rejects malformed ' + label, () => assert.throws(() => parseCsv(text), e => /^E_CSV/u.test(e.code)));
for (const code of [0, 1, 8, 11, 12, 14, 31, 127, 128, 133, 159]) test('CSV rejects control U+' + code.toString(16), () => {
  error(() => parseCsv(csv([[...row.slice(0, 6), String.fromCharCode(code)]])), 'E_CSV');
});
test('CSV row limit accepts 128 and rejects 129 rows', () => {
  const cells = ['', '', '', '', '', '', ''];
  assert.equal(parseCsv(csv(Array.from({ length: 128 }, () => cells))).rowCount, 128);
  error(() => parseCsv(csv(Array.from({ length: 129 }, () => cells))), 'E_CSV_LIMIT');
});
test('CSV decoded-cell byte cap accepts 4096 and rejects 4097 including Unicode', () => {
  for (const cell of ['x'.repeat(4096), 'é'.repeat(2048)]) {
    assert.equal(parseCsv(csv([[cell, '', '', '', '', '', '']])).rows[0].cells[0], cell);
    error(() => parseCsv(csv([[cell + 'x', '', '', '', '', '', '']])), 'E_CSV_LIMIT');
  }
});
test('CSV cell limit counts decoded bytes rather than doubled raw quote bytes', () => {
  const cell = '"'.repeat(4096);
  assert.equal(parseCsv(csv([[cell, '', '', '', '', '', '']])).rows[0].cells[0], cell);
});
test('CSV text byte cap accepts exactly 16384 and rejects 16385', () => {
  const overhead = Buffer.byteLength(csv([['', '', '', '', '', '', '']]));
  let remaining = 16384 - overhead;
  const cells = Array.from({ length: 7 }, () => { const n = Math.min(4096, remaining); remaining -= n; return 'x'.repeat(n); });
  assert.equal(remaining, 0);
  const text = csv([cells]);
  assert.equal(Buffer.byteLength(text), 16384);
  assert.equal(parseCsv(text).rowCount, 1);
  error(() => parseCsv(text + '\n'), 'E_CSV_LIMIT');
});

for (const [label, make] of [
  ['proxy', () => new Proxy({}, { ownKeys() { throw Error('trap'); } })],
  ['getter', () => Object.defineProperty({}, 'x', { enumerable: true, get() { throw Error('getter'); } })],
  ['toJSON', () => ({ toJSON() { throw Error('hook'); } })],
  ['cycle', () => { const x = {}; x.x = x; return x; }], ['NaN', () => ({ x: NaN })],
  ['Infinity', () => ({ x: Infinity })], ['custom prototype', () => Object.create({})],
]) test('internal DATA validation rejects ' + label + ' before serialization', () => error(() => internals.TEST_ONLY_report(make()), 'E_DATA'));
test('escaped-ASCII output byte cap counts escape expansion and LF', () => {
  const record = { text: 'é'.repeat(174762) };
  assert.ok(Buffer.byteLength(JSON.stringify(record)) < 1048576);
  error(() => internals.TEST_ONLY_report(record), 'E_OUTPUT_LIMIT');
});
test('output bound counts both UTF-16 surrogate escapes for astral characters', () => {
  const record = { text: '🙂'.repeat(87382) };
  assert.ok(Buffer.byteLength(JSON.stringify(record)) < 1048576);
  error(() => internals.TEST_ONLY_report(record), 'E_OUTPUT_LIMIT');
});
test('output bound includes the final LF at the exact one MiB boundary', () => {
  const record = { x: 'x'.repeat(1048567) };
  assert.equal(Buffer.byteLength(JSON.stringify(record) + '\n'), 1048576);
  assert.ok(Object.isFrozen(internals.TEST_ONLY_report(record)));
  error(() => internals.TEST_ONLY_report({ x: record.x + 'x' }), 'E_OUTPUT_LIMIT');
});
test('DATA validation rejects sparse arrays with compensating non-index properties', () => {
  const array = new Array(1);
  array.extra = 1;
  error(() => internals.TEST_ONLY_report({ array }), 'E_DATA');
});

for (const [label, change, expected] of [
  ['changed namespace member', docs => { docs.gnuPreparationEvidence.collection.roles[0].members[3].mode++; }, 'E_NAMESPACE_JOIN'],
  ['duplicate namespace path', docs => { docs.gnuPreparationEvidence.collection.roles[0].members[3].path = docs.gnuPreparationEvidence.collection.roles[0].members[2].path; }, 'E_MEMBER'],
  ['non-digest regular file', docs => { docs.gnuPreparationEvidence.collection.roles[0].members[2].bodySha256 = null; }, 'E_MEMBER'],
  ['noncanonical member', docs => { docs.gnuPreparationEvidence.collection.roles[0].members[2].path = root + '/../escape'; }, 'E_MEMBER'],
  ['nested count bound', docs => { docs.gnuPreparationEvidence.collection.roles[0].members.pop(); }, 'E_NAMESPACE'],
  ['changed archive identity', docs => { docs.gnuPreparationEvidence.collection.roles[0].archiveSha256 = '0'.repeat(64); }, 'E_NAMESPACE'],
  ['changed header destination', docs => { docs.gnuPreparationEvidence.headerLedger[0].proposedRelativeDestination = 'gnu/wrong.h'; }, 'E_HEADER'],
  ['header extra metadata', docs => { docs.gnuPreparationEvidence.headerLedger[0].extra = true; }, 'E_HEADER'],
  ['changed header disposition', docs => { docs.gnuPreparationEvidence.headerLedger[0].disposition = 'ADMITTED'; }, 'E_HEADER'],
  ['promoted copy flag', docs => { docs.gnuPreparationEvidence.copyAuthorized = true; }, 'E_QUALIFICATION'],
  ['promoted header copy flag', docs => { docs.gnuPreparationEvidence.headerLedger[0].copyAuthorized = true; }, 'E_HEADER'],
  ['changed literal raw text', docs => { docs.gnuPreparationEvidence.collection.roles[0].selected[0].metadata.observation.text += 'x'; }, 'E_TEXT'],
  ['promoted raw interpretation', docs => { docs.gnuPreparationEvidence.collection.roles[0].selected[1].metadata.observation.interpreted = true; }, 'E_TEXT'],
  ['wrong selected domain', docs => { docs.gnuPreparationEvidence.collection.roles[0].selected[0].domain = 'TARGET'; }, 'E_TEXT'],
  ['wrong source root', docs => { docs.gnuPreparationEvidence.sourceInputPins.input.root = '/other'; }, 'E_SOURCE_DECLARATION'],
  ['changed source declaration', docs => { docs.gnuPreparationEvidence.sourceInputPins.sources.sdk.sha256 = '0'.repeat(64); }, 'E_SOURCE_DECLARATION'],
  ['unaccepted GNU receipt', docs => { docs.gnuEvidenceReceipt.publicationAccepted = false; }, 'E_RECEIPT'],
  ['unverified GNU readback', docs => { docs.gnuEvidenceReceipt.result.independentReadbackVerified = false; }, 'E_RECEIPT'],
  ['unaccepted preparation receipt', docs => { docs.gnuPreparationReceipt.publicationAccepted = false; }, 'E_RECEIPT'],
  ['inferred include-fixed headers', docs => { docs.gnuPreparationEvidence.includeFixedContext.headersInferred = true; }, 'E_HEADER_CONTEXT'],
  ['admitted plugins', docs => { docs.gnuPreparationEvidence.pluginSummary.admitted = true; }, 'E_HEADER_CONTEXT'],
]) test('test-local repinning still rejects semantic mutation: ' + label, async () => {
  const run = await mutation(change);
  error(run, expected);
});
