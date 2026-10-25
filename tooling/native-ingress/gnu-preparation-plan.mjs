// SPEC: _spec/tooling/native-ingress/step2.puml
import { createHash } from 'node:crypto';
import { types } from 'node:util';

const BASE = '_spec/tooling/native-ingress/';
const REPO = '/tmp/opencode/f9-bootstrap-correspondence/';
const ROOT = 'x86-64--glibc--stable-2026.08-1';
const GCC = 'lib/gcc/x86_64-buildroot-linux-gnu/15.3.0/';
const ARCHIVE_SHA = 'cde893afab04ac7dcd15c46aac214ff550441b982536124c88a71146a0eeedd3';
const DECODED_SHA = '5e7f960281fb93121982f95976eb59ed980e009b54aabf993d5d3fa2982e056f';
const LEGACY_SHA = 'efe53c8fda0b0f1e8b8ba6b7868707a88f33aa26b5692b9c76dc0e6da694d901';
const OFFSET_SHA = 'a3209a5860532febf8cbe41713629cb6bf94a5d081966fac96db496ddea35416';
const MAX_INPUT = 4 * 1024 * 1024;
const MAX_OUTPUT = 1024 * 1024;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const uint = value => Number.isSafeInteger(value) && value >= 0;
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const fail = code => { throw Object.freeze(Object.assign(new Error(code), { name: 'GnuPreparationPlanError', code })); };
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

export const GNU_PREPARATION_PLAN_V1_PINS = freeze({
  gnuEvidence: { name: 'gnuEvidence', path: BASE + 'gnu-evidence-collection-v1.result.json', byteLength: 2829942,
    sha256: '01c24e73a65148b8a70c3c1d4034f86dcac8040859bc206b5cf40b784776cc22' },
  gnuEvidenceReceipt: { name: 'gnuEvidenceReceipt', path: BASE + 'gnu-evidence-collection-v1.receipt.json', byteLength: 3428,
    sha256: 'bb7f0ad07f8022bcba026b142bb40fe27651f534c35e119a4e1d9a3d2862a6e8' },
  gnuPreparationEvidence: { name: 'gnuPreparationEvidence', path: BASE + 'gnu-preparation-evidence-v1.result.json', byteLength: 2724242,
    sha256: '3ae1a4949a913b972695a32dfab2076354e49a70a960021a34050c63a9bb281b' },
  gnuPreparationReceipt: { name: 'gnuPreparationReceipt', path: BASE + 'gnu-preparation-evidence-v1.receipt.json', byteLength: 8583,
    sha256: 'dc06975401c17e41b24e75beb37eb8de2bcf3c30066773aaf53defdcf6dd30b6' },
});

const FLAGS = freeze(Object.fromEntries([
  'sourceAuthenticated', 'licenseComplianceVerified', 'licensePermissionClassified', 'copyAuthorized',
  'includeClosureVerified', 'sysrootClosureVerified', 'relocationReady', 'pythonFreeSubsetVerified',
  'runtimeProvidersQualified', 'abiVerified', 'imagePrepared', 'nativeQualified', 'rustReady', 'trainingReady',
  'publisherAuthenticated', 'fullSourceGraphVerified', 'urlsFollowed', 'readmeInstructionsExecuted', 'sourceReady',
  'archiveExtracted', 'extracted', 'extractionAuthorized', 'filesInstalled', 'compilerExecuted', 'memberExecuted',
  'sdkExecuted', 'rustExecuted', 'runtimeExecuted', 'pythonRuntimeInvoked', 'noPythonRuntimeVerified',
  'nativeAuthority', 'qualified', 'roleSatisfied', 'provenanceVerified', 'loaderClosureVerified',
  'sourceRootAuthentication', 'hostTargetPromotion', 'shellEvaluated', 'semanticInterpretation',
].map(key => [key, false])));
const TEXT_PINS = freeze([
  [GCC + 'include-fixed/README', 8379, 504808448, 750, '32baa94efdf4fb418c20321f14a1b66982a6cd3c2b5bc8fbfbe438f687c528d6'],
  ['summary.csv', 8391, 505059840, 10391, 'da71ea6f278ae7314e122fb382a8860b19e88252bc89a730eea2a7f8d3c95621'],
  ['README.txt', 8412, 505326592, 1093, 'fa0b24cb67e660a5aebe2f4d4705b5a7ca2e5860e2e0405ddf6fddad40d4a41a'],
].map(([path, index, bodyOffset, size, bodySha256]) => ({ artifactRole: 'gnu-sdk', path: ROOT + '/' + path,
  type: 'file', index, bodyOffset, size, bodySha256 })));
const CSV_HEADER = freeze(['PACKAGE', 'VERSION', 'LICENSE', 'LICENSE FILES', 'SOURCE ARCHIVE', 'SOURCE SITE', 'DEPENDENCIES WITH LICENSES']);
const typedArrayLength = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), 'length').get;

function exact(value, keys, code = 'E_SCHEMA') {
  if (!value || typeof value !== 'object' || types.isProxy(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(code);
  const names = Reflect.ownKeys(value);
  if (names.length !== keys.length) fail(code);
  for (const key of names) {
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !keys.includes(key) || !d || !Object.hasOwn(d, 'value') || !d.enumerable) fail(code);
  }
}
function same(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && same(a[key], b[key]));
}
function data(value) {
  const active = new Set();
  let nodes = 0;
  function visit(v, depth) {
    if (++nodes > 1000000 || depth > 64) fail('E_DATA_LIMIT');
    if (v === null || typeof v === 'string' || typeof v === 'boolean' || typeof v === 'number' && Number.isFinite(v)) return;
    if (!v || typeof v !== 'object' || types.isProxy(v) || active.has(v)) fail('E_DATA');
    const array = Array.isArray(v), keys = Reflect.ownKeys(v);
    if (Object.getPrototypeOf(v) !== (array ? Array.prototype : Object.prototype)) fail('E_DATA');
    if (array ? v.length > 32768 || keys.length !== v.length + 1 : keys.length > 128) fail('E_DATA_LIMIT');
    active.add(v);
    for (const key of keys) {
      if (array && key === 'length') continue;
      const d = Object.getOwnPropertyDescriptor(v, key);
      if (typeof key !== 'string' || ['__proto__', 'constructor', 'prototype', 'toJSON'].includes(key)
        || array && (!/^(?:0|[1-9]\d*)$/u.test(key) || Number(key) >= v.length)
        || !d || !Object.hasOwn(d, 'value') || !d.enumerable) fail('E_DATA');
      visit(d.value, depth + 1);
    }
    active.delete(v);
  }
  visit(value, 0);
  return value;
}
function inputSnapshots(options) {
  const names = Object.keys(GNU_PREPARATION_PLAN_V1_PINS);
  exact(options, names, 'E_INPUT');
  const inputs = [], lengths = [];
  let total = 0;
  for (const name of names) {
    const value = Object.getOwnPropertyDescriptor(options, name).value;
    if (!value || typeof value !== 'object' || types.isProxy(value) || !types.isUint8Array(value) || !Buffer.isBuffer(value)
      || Object.getPrototypeOf(value) !== Buffer.prototype) fail('E_INPUT');
    const length = Reflect.apply(typedArrayLength, value, []);
    if (length > MAX_INPUT || total + length > 4 * MAX_INPUT) fail('E_INPUT_LIMIT');
    total += length;
    inputs.push(value); lengths.push(length);
  }
  for (let i = 0; i < inputs.length; i++) {
    if (Reflect.ownKeys(inputs[i]).length !== lengths[i]) fail('E_INPUT');
  }
  const snapshots = inputs.map(value => Buffer.from(value));
  const observed = snapshots.map(bytes => ({ byteLength: bytes.length, sha256: sha(bytes) }));
  if (names.some((name, i) => observed[i].byteLength !== GNU_PREPARATION_PLAN_V1_PINS[name].byteLength
    || observed[i].sha256 !== GNU_PREPARATION_PLAN_V1_PINS[name].sha256)) fail('E_INPUT_PIN');
  return snapshots;
}
function parse(bytes) {
  let value;
  try { value = JSON.parse(Buffer.prototype.toString.call(bytes, 'utf8')); }
  catch { fail('E_JSON'); }
  return data(value);
}
function negatives(value, required = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('E_SCHEMA');
  for (const key of Object.keys(FLAGS)) if (Object.hasOwn(value, key) && value[key] !== false) fail('E_QUALIFICATION');
  for (const key of required) if (value[key] !== false) fail('E_QUALIFICATION');
}
function pinDeclaration(value, expected) {
  exact(value, ['bytes', 'sha256']);
  if (!uint(value.bytes) || !digest(value.sha256) || expected && (value.bytes !== expected.byteLength || value.sha256 !== expected.sha256)) fail('E_DECLARATION_PIN');
}
function pinSet(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length < 1 || Object.keys(value).length > 64) fail('E_DECLARATION_PIN');
  for (const pin of Object.values(value)) pinDeclaration(pin);
}
function inputDeclaration(value) {
  if (!value || value.role !== 'gnu-sdk' || value.root !== '/tmp/opencode/f9-gnu-2026-data-only-01'
    || value.file !== value.root + '/' + ROOT + '.tar.xz' || value.expectedRoot !== ROOT
    || value.archiveBytes !== 102296280 || value.archiveSha256 !== ARCHIVE_SHA || value.decoderMemoryBytes !== 16777216
    || !value.identity || !value.identity.root || !value.identity.file) fail('E_SOURCE_DECLARATION');
  for (const identity of [value.identity.root, value.identity.file]) {
    exact(identity, ['dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtimeNs', 'ctimeNs']);
    if (Object.values(identity).some(v => typeof v !== 'string' || !/^\d{1,24}$/u.test(v))) fail('E_SOURCE_DECLARATION');
  }
}
function sources(gnu, prep, receipt) {
  const old = gnu.sourceInputPins, fresh = prep.sourceInputPins;
  exact(old, ['sources', 'transforms', 'inputs']);
  exact(fresh, ['operation', 'sources', 'transforms', 'acceptedGnuData', 'input']);
  if (!Array.isArray(old.inputs) || old.inputs.length !== 1) fail('E_SOURCE_DECLARATION');
  inputDeclaration(old.inputs[0]); inputDeclaration(fresh.input);
  if (!same(old.inputs[0], fresh.input) || !same(fresh, receipt.sourceInputPins)) fail('E_SOURCE_DECLARATION');
  pinDeclaration(fresh.operation); pinDeclaration(fresh.acceptedGnuData, GNU_PREPARATION_PLAN_V1_PINS.gnuEvidence);
  for (const pins of [old.sources, old.transforms, fresh.sources, fresh.transforms]) pinSet(pins);
  for (const [key, pin] of Object.entries(fresh.sources)) if (!same(pin, old.sources[key])) fail('E_SOURCE_DECLARATION');
  return { status: 'DECLARED_IDENTITIES_ONLY', gnu: old, gnuPreparation: fresh,
    fullSourceGraphVerified: false, sourceFileBytesVerified: false, moduleGraphVerified: false,
    custodyStatus: 'SAVED_CLAIMS_NOT_INDEPENDENT_CURRENT_OBSERVATIONS' };
}
function envelope(value, preparation) {
  const profile = preparation ? 'registered-gnu-preparation-evidence-v1' : 'registered-split-toolchain-evidence-v1';
  const part = preparation ? 'gnu-preparation' : 'gnu';
  const status = preparation ? 'GNU_PREPARATION_EVIDENCE_DATA' : 'SPLIT_TOOLCHAIN_EVIDENCE_DATA';
  const pin = GNU_PREPARATION_PLAN_V1_PINS[preparation ? 'gnuPreparationEvidence' : 'gnuEvidence'];
  if (!value || value.profile !== profile || value.part !== part || value.status !== status || value.mockOnly !== false
    || value.path !== REPO + pin.path) fail('E_ENVELOPE');
  negatives(value, preparation ? Object.keys(FLAGS).filter(k => !['publisherAuthenticated', 'fullSourceGraphVerified', 'readmeInstructionsExecuted', 'semanticInterpretation'].includes(k))
    : ['abiVerified', 'imagePrepared', 'nativeQualified', 'rustReady', 'trainingReady', 'sourceReady']);
  if (preparation && (value.csvParsed !== false || value.sourceContext !== 'UNQUALIFIED')) fail('E_ENVELOPE');
}
function receipts(old, fresh, prep) {
  const gnuPin = GNU_PREPARATION_PLAN_V1_PINS.gnuEvidence, prepPin = GNU_PREPARATION_PLAN_V1_PINS.gnuPreparationEvidence;
  if (!old || old.version !== 'split-gnu-evidence-receipt-v1' || old.profile !== 'registered-split-toolchain-evidence-v1'
    || old.part !== 'gnu' || old.status !== 'SPLIT_TOOLCHAIN_EVIDENCE_DATA' || old.publicationAccepted !== true
    || old.consumed !== true || old.retryAuthorized !== false) fail('E_RECEIPT');
  const r = old.result;
  if (!r || r.path !== gnuPin.path || r.byteLength !== gnuPin.byteLength || r.sha256 !== gnuPin.sha256
    || r.mode !== '0444' || r.readbackVerified !== true || r.independentReadbackVerified !== true || r.directorySynced !== true) fail('E_RECEIPT');
  envelope(fresh, true);
  if (fresh.publicationAccepted !== true || fresh.byteLength !== prepPin.byteLength || fresh.sha256 !== prepPin.sha256
    || fresh.mode !== '0444' || fresh.readbackVerified !== true || fresh.directorySynced !== true) fail('E_RECEIPT');
  for (const key of ['sourceInputPins', 'collectionCounts', 'headerCount', 'headerBytes', 'selectedTextBytes', 'totalTextCaptures']) {
    if (!same(fresh[key], prep[key])) fail('E_RECEIPT');
  }
  if (old.entries !== 8412 || old.regularFiles !== 6891 || old.offsetMetadataSha256 !== OFFSET_SHA
    || old.legacyMetadataSha256 !== LEGACY_SHA) fail('E_RECEIPT');
  negatives(old);
}
function canonical(path) {
  return typeof path === 'string' && path.length <= 1024 && path.length > 0 && !/[^\x21-\x7e]|\\/u.test(path)
    && !path.startsWith('/') && !/^[A-Za-z]:/u.test(path) && !path.split('/').some(p => !p || p === '.' || p === '..');
}
function namespace(full, selectedCount) {
  const c = full.collection;
  if (!c || c.profile !== 'SPLIT_TOOLCHAIN_EVIDENCE_DATA' || c.state !== 'SPLIT_TOOLCHAIN_EVIDENCE_DATA'
    || c.part !== 'gnu' || c.mockOnly !== false || c.artifactCount !== 1 || c.completeNamespace !== true
    || c.entries !== 8412 || c.regularFiles !== 6891 || c.expandedBytes !== 505333760
    || c.targetCount !== selectedCount || c.selectedPayloads !== selectedCount || !Array.isArray(c.roles) || c.roles.length !== 1) fail('E_COLLECTION');
  negatives(c);
  const role = c.roles[0];
  if (!role || role.role !== 'gnu-sdk' || role.expectedRoot !== ROOT || role.completeNamespace !== true
    || role.entries !== 8412 || role.regularFiles !== 6891 || role.expandedBytes !== 505333760 || role.headers !== 10181
    || role.archiveBytes !== 102296280 || role.archiveSha256 !== ARCHIVE_SHA || role.decoderMemoryBytes !== 16777216
    || role.decodedSha256 !== DECODED_SHA || role.metadataSha256 !== LEGACY_SHA || role.legacyMetadataSha256 !== LEGACY_SHA
    || role.metadataHashKind !== 'LEGACY_WITHOUT_BODY_OFFSET' || role.legacyMetadataHashKind !== 'LEGACY_WITHOUT_BODY_OFFSET'
    || role.offsetMetadataSha256 !== OFFSET_SHA || role.offsetMetadataHashKind !== 'OFFSET_EVENT_METADATA'
    || role.inventory?.metadataSha256 !== OFFSET_SHA || !Array.isArray(role.members) || role.members.length !== 8412
    || !Array.isArray(role.selected) || role.selected.length !== selectedCount || !Array.isArray(role.manifests) || role.manifests.length !== 2) fail('E_NAMESPACE');
  negatives(role);
  const map = new Map();
  let files = 0, previousEnd = 0;
  for (const m of role.members) {
    if (!m || m.index !== map.size + 1 || !canonical(m.path) || m.path !== ROOT && !m.path.startsWith(ROOT + '/')
      || map.has(m.path) || !['file', 'directory', 'symlink', 'hardlink'].includes(m.type)
      || !uint(m.size) || !uint(m.bodyOffset) || m.bodyOffset < 512 || m.bodyOffset % 512 || m.bodyOffset < previousEnd
      || m.size > role.expandedBytes - m.bodyOffset || !uint(m.mode) || !uint(m.uid) || !uint(m.gid)
      || typeof m.mtime !== 'string' || !/^-?\d{1,24}(?:\.\d{1,9})?$/u.test(m.mtime)
      || (m.type === 'file' ? !digest(m.bodySha256) : m.size !== 0 || m.bodySha256 !== null || m.linkFollowed !== false)) fail('E_MEMBER');
    if (['symlink', 'hardlink'].includes(m.type) && (typeof m.linkpath !== 'string' || m.linkpath.length < 1 || m.linkpath.length > 1024)) fail('E_MEMBER');
    if (m.type === 'file') files++;
    previousEnd = Math.ceil((m.bodyOffset + m.size) / 512) * 512;
    if (previousEnd > role.expandedBytes) fail('E_MEMBER');
    map.set(m.path, m);
  }
  if (files !== 6891 || map.get(ROOT)?.type !== 'directory') fail('E_NAMESPACE');
  for (const m of role.members) {
    const parts = m.path.split('/');
    while (parts.length > 1) {
      parts.pop();
      const parent = map.get(parts.join('/'));
      if (parent && parent.type !== 'directory') fail('E_NAMESPACE');
    }
  }
  return { role, map };
}
function headers(prep, old, fresh) {
  if (!same(old.role.members, fresh.role.members) || !same(old.role.manifests, fresh.role.manifests)) fail('E_NAMESPACE_JOIN');
  if (!Array.isArray(prep.headerLedger) || prep.headerLedger.length !== 150) fail('E_HEADER');
  const records = [];
  let bytes = 0, pluginFiles = 0, pluginBytes = 0;
  for (const m of fresh.role.members) {
    if (m.type === 'file' && m.path.startsWith(ROOT + '/' + GCC + 'plugin/include/')) { pluginFiles++; pluginBytes += m.size; }
    if (m.type !== 'file' || !m.path.startsWith(ROOT + '/' + GCC + 'include/')) continue;
    const record = { artifactRole: 'gnu-sdk', index: m.index, path: m.path, bodyOffset: m.bodyOffset, size: m.size,
      bodySha256: m.bodySha256, domain: 'TARGET', disposition: 'C_HEADER_CANDIDATE',
      proposedRelativeDestination: 'gnu/' + m.path.slice(ROOT.length + 1), copyAuthorized: false, includeClosureVerified: false };
    if (!same(record, prep.headerLedger[records.length])) fail('E_HEADER');
    records.push(record); bytes += m.size;
  }
  if (records.length !== 150 || bytes !== 2907751 || prep.headerCount !== 150 || prep.headerBytes !== bytes
    || pluginFiles !== 560 || pluginBytes !== 9731900) fail('E_HEADER');
  const plugin = { prefix: ROOT + '/' + GCC + 'plugin/include/', regularFiles: 560, bytes: 9731900,
    sourceContext: 'UNQUALIFIED', admitted: false, copyAuthorized: false, includeClosureVerified: false };
  const fixed = { selectedREADMEOnly: true, admittedHeaders: 0, headersInferred: false, copyAuthorized: false };
  if (!same(prep.pluginSummary, plugin) || !same(prep.includeFixedContext, fixed)) fail('E_HEADER_CONTEXT');
  return { headerSelectionSupplement: { count: records.length, bytes, records },
    pluginSummary: { ...plugin, disposition: 'UNADMITTED' }, includeFixedContext: fixed };
}
function texts(prep, old, fresh) {
  if (prep.selectedTextBytes !== 12234 || prep.selectedTextCaptures !== 3) fail('E_TEXT');
  let total = 0;
  const result = TEXT_PINS.map((pin, i) => {
    const selected = fresh.role.selected[i], prior = old.map.get(pin.path), current = fresh.map.get(pin.path);
    if (!selected || !prior || !current || !same(prior, current)
      || Object.keys(pin).some(key => key !== 'artifactRole' && prior[key] !== pin[key])
      || ['index', 'path', 'bodyOffset', 'size', 'bodySha256'].some(key => selected[key] !== pin[key])
      || selected.artifactRole !== 'gnu-sdk' || selected.kind !== 'PREPARATION_TEXT' || selected.domain !== 'DISTRIBUTION_DATA'
      || selected.expectedSha256 !== pin.bodySha256 || selected.selectionRole !== 'GNU_PREPARATION_CONTEXT_TEXT'
      || selected.optionalForMinimalC !== false || selected.maxBytes !== 16384 || selected.hashObservation !== 'MATCHED_EXPECTED_BODY_HASH'
      || selected.metadata?.state !== 'SOURCE_FORMAT_DATA' || selected.metadata.qualified !== false) fail('E_TEXT');
    negatives(selected, ['qualified', 'abiVerified', 'roleSatisfied']);
    const observation = selected.metadata.observation;
    exact(observation, ['state', 'text', 'interpreted', 'urlsFollowed']);
    if (observation.state !== 'GNU_PREPARATION_RAW_TEXT_DATA' || observation.interpreted !== false || observation.urlsFollowed !== false
      || typeof observation.text !== 'string' || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(observation.text)) fail('E_TEXT');
    const bytes = Buffer.from(observation.text, 'utf8');
    if (bytes.length !== pin.size || sha(bytes) !== pin.bodySha256 || bytes.toString('utf8') !== observation.text) fail('E_TEXT');
    total += bytes.length;
    return { ...pin, kind: 'PREPARATION_TEXT', domain: 'DISTRIBUTION_DATA', sourceContext: 'UNQUALIFIED',
      rawObservation: { ...observation }, readmeInstructionsExecuted: false, qualified: false, copyAuthorized: false };
  });
  if (total !== 12234) fail('E_TEXT');
  return result;
}
function parseCsv(text, sourceMember) {
  if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > 16384) fail('E_CSV_LIMIT');
  if (!text || text.charCodeAt(0) === 0xfeff || Buffer.from(text, 'utf8').toString('utf8') !== text
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(text)) fail('E_CSV');
  const records = [];
  let at = 0, startByte = 0;
  while (at < text.length) {
    if (records.length >= 129) fail('E_CSV_LIMIT');
    const start = at, cells = [];
    while (true) {
      if (text[at++] !== '"') fail('E_CSV');
      let cell = '', closed = false;
      while (at < text.length) {
        const c = text[at++];
        if (c === '\n' || c === '\r') fail('E_CSV');
        if (c === '"') {
          if (text[at] === '"') { cell += '"'; at++; }
          else { closed = true; break; }
        } else cell += c;
      }
      if (!closed) fail('E_CSV');
      if (Buffer.byteLength(cell, 'utf8') > 4096) fail('E_CSV_LIMIT');
      cells.push(cell);
      if (cells.length > 7) fail('E_CSV');
      if (text[at] !== ',') break;
      at++;
    }
    if (cells.length !== 7) fail('E_CSV');
    const rawRecord = text.slice(start, at), endByte = startByte + Buffer.byteLength(rawRecord, 'utf8');
    records.push({ recordIndex: records.length + 1, sourceMember, sourceSpan: { startByte, endByte },
      rawRecord, rawRecordSha256: sha(Buffer.from(rawRecord, 'utf8')), cells });
    if (at < text.length) {
      if (text[at] === '\r' && text[at + 1] === '\n') { at += 2; startByte = endByte + 2; }
      else if (text[at] === '\n') { at++; startByte = endByte + 1; }
      else fail('E_CSV');
    }
  }
  if (!same(records[0]?.cells, CSV_HEADER)) fail('E_CSV_HEADER');
  return { header: [...CSV_HEADER], headerRecord: records[0], rowCount: records.length - 1,
    sourceSpanConvention: 'UTF8_BYTE_OFFSETS_HALF_OPEN_EXCLUDING_RECORD_SEPARATOR',
    csvParsed: true, semanticInterpretation: false,
    rows: records.slice(1).map((record, i) => ({ ...record, ordinal: i + 1, packageLabel: record.cells[0],
      domain: 'UNRESOLVED', sourceKind: 'DISTRIBUTION_DECLARATION', licenseNoticeStatus: 'UNRESOLVED', sourceContextStatus: 'UNRESOLVED' })) };
}
function boundedReport(report) {
  data(report);
  const ascii = JSON.stringify(report).replace(/[\u007f-\uffff]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')) + '\n';
  if (Buffer.byteLength(ascii, 'ascii') > MAX_OUTPUT) fail('E_OUTPUT_LIMIT');
  return freeze(report);
}

export function createGnuPreparationPlanV1(options) {
  if (arguments.length !== 1) fail('E_INPUT');
  const snapshots = inputSnapshots(options);
  const [gnu, gnuReceipt, prep, prepReceipt] = snapshots.map(parse);
  envelope(gnu, false); envelope(prep, true); receipts(gnuReceipt, prepReceipt, prep);
  const declarations = sources(gnu, prep, prepReceipt);
  const old = namespace(gnu, 46), fresh = namespace(prep, 3);
  const selection = headers(prep, old, fresh), context = texts(prep, old, fresh);
  const distributionDeclarations = parseCsv(context[1].rawObservation.text, TEXT_PINS[1]);
  const inputBindings = Object.fromEntries(Object.entries(GNU_PREPARATION_PLAN_V1_PINS).map(([name, pin]) =>
    [name, { ...pin, bytesVerified: true, sha256Verified: true, publisherAuthenticated: false }]));
  inputBindings.sourceDependencyDeclarations = declarations;
  return boundedReport({ profile: 'GNU_PREPARATION_PLAN_V1', status: 'PROPOSED_DATA_SUPPLEMENT', inputBindings,
    priorMemberPlanReference: { path: BASE + 'toolchain-member-plan-v1.result.json', byteLength: 5679112,
      sha256: '2c4cd5218dce220e55dabe96345b97cc777c2cdc10c6e18b8d53f1357d2a94da',
      relationship: 'APPEND_ONLY_REFERENCE_NOT_READ_OR_REVERIFIED', read: false, reverified: false },
    ...selection, distributionTextContext: context, distributionDeclarations, sourceContext: 'UNQUALIFIED',
    unresolvedObligations: [
      { kind: 'SOURCE_ARCHIVES', status: 'OPEN', resolution: 'UNRESOLVED', requiredArtifactsVerified: false },
      { kind: 'LICENSE_TEXTS_AND_NOTICES', status: 'OPEN', resolution: 'UNRESOLVED', requiredArtifactsVerified: false },
      { kind: 'COPY_PERMISSION', status: 'OPEN', resolution: 'UNRESOLVED', copyAuthorized: false },
    ], ...FLAGS, csvParsed: true });
}
