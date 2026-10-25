// SPEC: _spec/tooling/native-ingress/step2.puml
import { createHash } from 'node:crypto';
import { types } from 'node:util';
import { createTarInventory as originalCreateTarInventory, INVENTORY_LIMITS } from './tar-inventory.mjs';

export const RUST_LAYOUT_ROLES = Object.freeze(['cargo', 'rustc', 'rust-std', 'rustfmt-preview', 'clippy-preview']);
export const RUST_LAYOUT_LIMITS = Object.freeze({
  maxExpandedBytes: 1_073_741_824, maxBatchExpandedBytes: 2_147_483_648,
  maxEntries: 32_768, maxBatchEntries: 65_536,
  maxRoleMetadataBytes: 4_194_304, maxBatchMetadataBytes: 8_388_608,
  maxManifestBytes: 1_048_576, maxBatchManifestBytes: 4_194_304,
  maxOutputBytes: 16_777_216,
});
const root = '/tmp/opencode/f9-rust-runtime-inputs-01';
const rootIdentity = Object.freeze({ dev: '28', ino: '13954', mode: '16832', uid: '1000', gid: '1000', nlink: '2', size: '4096', mtimeNs: '1792857301045485610', ctimeNs: '1792857301045485610' });
const inputRows = [
  ['cargo', 'cargo', 10984780, 'e74edd2cf7d0f1f1383b4f00eb90c843750bc489e2ccf7214e6476678a907425', '1211150', '1792857299153485617'],
  ['rustc', 'rustc', 80351960, '8426a3d170a5879f5682f5fbdd024a1779b3951e7baba685af2d6dc32a6dfc15', '1211151', '1792857300349485612'],
  ['rust-std', 'rust-std', 29573972, '047ea7098803d3500fa1072e9cee5392697e21525559e4458128a2bf874aa382', '1211153', '1792857300901485610'],
  ['rustfmt-preview', 'rustfmt', 2164880, 'f1b2a7301513ffdd95ebf22ebbdd932e4d17fc806f748d93924740d0297b1396', '1211154', '1792857301041485610'],
  ['clippy-preview', 'clippy', 4697128, 'ac779bc9839dd47180806b133e4e2563c4a34716284cd5b8fede8ef289f452ca', '1211155', '1792857301361485608'],
];
export const RUST_LAYOUT_INPUTS = Object.freeze(inputRows.map(([role, name, archiveBytes, archiveSha256, ino, time]) => {
  const expectedRoot = `${name}-1.95.0-x86_64-unknown-linux-gnu`;
  return Object.freeze({ role, root, file: `${root}/${expectedRoot}.tar.xz`, archiveBytes, archiveSha256, expectedRoot,
    identity: Object.freeze({ root: rootIdentity, file: Object.freeze({ dev: '29', ino, mode: '33152', uid: '1000', gid: '1000', nlink: '1', size: String(archiveBytes), mtimeNs: time, ctimeNs: time }) }) });
}));
const negativeFlags = Object.freeze({
  archiveExtracted: false, filesInstalled: false, rustExecuted: false, pythonRuntimeInvoked: false,
  extractionAuthorized: false, relocationReady: false, installedUsability: false,
  pythonFreeSubsetVerified: false, nativeQualified: false, nativeAuthority: false,
  rustReady: false, trainingReady: false, dockerProviderQualified: false,
  hardRssBounded: false, hardDeadlineGuaranteed: false, processTreeBounded: false,
  completeInstallerInterpretation: false, completeInstallMap: false, provenanceVerified: false,
});
const fields = ['dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtimeNs', 'ctimeNs'];
const typedPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const typedLength = Object.getOwnPropertyDescriptor(typedPrototype, 'length').get;
const typedBuffer = Object.getOwnPropertyDescriptor(typedPrototype, 'buffer').get;
const typedOffset = Object.getOwnPropertyDescriptor(typedPrototype, 'byteOffset').get;
const resizable = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
const digestPattern = /^[0-9a-f]{64}$/u;
const bytesOf = value => Buffer.byteLength(value, 'utf8');
const collectorCodes = new Set(['E_LAYOUT_INPUT', 'E_LAYOUT_LIMIT', 'E_LAYOUT_STATE', 'E_LAYOUT_DATA',
  'E_LAYOUT_METADATA', 'E_LAYOUT_OUTPUT', 'E_LAYOUT_ENTRIES', 'E_LAYOUT_DECLARATION', 'E_LAYOUT_BODY',
  'E_LAYOUT_ROOT', 'E_LAYOUT_EVENT', 'E_LAYOUT_CHUNK', 'E_LAYOUT_EXPANDED', 'E_LAYOUT_MANIFEST',
  'E_LAYOUT_SUMMARY', 'E_LAYOUT_CORE']);
const parserCodes = new Set(['E_LIMITS', 'E_UTF8', 'E_TEXT', 'E_NUMBER', 'E_PAX_NUMBER', 'E_PAX',
  'E_PAX_KEY', 'E_PAX_DUPLICATE', 'E_PATH', 'E_SEALED', 'E_INTERNAL', 'E_GNU_LONG', 'E_DANGLING_EXTENSION',
  'E_TERMINATOR', 'E_HEADERS', 'E_CHECKSUM', 'E_MAGIC', 'E_SIZE', 'E_EXTENSION_REPEAT', 'E_EXTENSION_BYTES',
  'E_NONFILE_BODY', 'E_TYPE', 'E_LINK', 'E_COLLISION', 'E_COLLISION_BYTES', 'E_EVENT_BYTES', 'E_OUTPUT_BYTES',
  'E_SPAN_BYTES', 'E_CHUNK', 'E_DATA_EVENTS', 'E_EXPANDED_BYTES', 'E_PADDING', 'E_TRAILING', 'E_TRUNCATED']);
const ownedErrors = new WeakSet();
const stop = code => { const fixed = collectorCodes.has(code) ? code : 'E_LAYOUT_DATA'; const error = new Error(fixed); error.name = 'RustLayoutError'; error.code = fixed; ownedErrors.add(error); throw Object.freeze(error); };

function failureCodeFrom(error) {
  if (ownedErrors.has(error)) return Object.getOwnPropertyDescriptor(error, 'code').value;
  if (!error || typeof error !== 'object' || types.isProxy(error)) return 'E_LAYOUT_DATA';
  try {
    const name = Object.getOwnPropertyDescriptor(error, 'name');
    const code = Object.getOwnPropertyDescriptor(error, 'code');
    return name && Object.hasOwn(name, 'value') && name.value === 'InventoryError'
      && code && Object.hasOwn(code, 'value') && typeof code.value === 'string'
      && code.value.length <= 32 && parserCodes.has(code.value) ? code.value : 'E_LAYOUT_DATA';
  } catch { return 'E_LAYOUT_DATA'; }
}

function ownData(value, exactKeys) {
  if (!value || typeof value !== 'object' || types.isProxy(value)) stop('E_LAYOUT_INPUT');
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) stop('E_LAYOUT_INPUT');
  const keys = Reflect.ownKeys(value);
  if (exactKeys && (keys.length !== exactKeys.length || keys.some(key => !exactKeys.includes(key)))) stop('E_LAYOUT_INPUT');
  const result = Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !descriptor || !Object.hasOwn(descriptor, 'value')) stop('E_LAYOUT_INPUT');
    result[key] = descriptor.value;
  }
  return result;
}

function ownArray(value) {
  if (types.isProxy(value) || !Array.isArray(value)) stop('E_LAYOUT_INPUT');
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Array.prototype && prototype !== null) stop('E_LAYOUT_INPUT');
  const length = Object.getOwnPropertyDescriptor(value, 'length').value;
  if (!Number.isSafeInteger(length) || length > 65_536 || Reflect.ownKeys(value).length !== length + 1) stop('E_LAYOUT_INPUT');
  for (let i = 0; i < length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) stop('E_LAYOUT_INPUT');
  }
  return length;
}

function lowerLimits(value, base) {
  const data = ownData(value);
  const result = { ...base };
  for (const [key, limit] of Object.entries(data)) {
    if (!Object.hasOwn(base, key) || !Number.isSafeInteger(limit) || limit < 1 || limit > base[key]) stop('E_LAYOUT_LIMIT');
    result[key] = limit;
  }
  return Object.freeze(result);
}

function canonical(value) {
  return typeof value === 'string' && value.length > 0 && bytesOf(value) <= 1024
    && !/[\u0000-\u001f\u007f-\u009f\\]/u.test(value) && !value.startsWith('/')
    && !/^[A-Za-z]:/u.test(value) && !value.split('/').some(part => part === '' || part === '.' || part === '..');
}

function stringSize(value) {
  let total = 2;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code === 34 || code === 92 || [8, 9, 10, 12, 13].includes(code)) total += 2;
    else if (code < 32) total += 6;
    else if (code < 128) total++;
    else total += 6;
  }
  return total;
}

function jsonSize(value) {
  if (typeof value === 'string') return stringSize(value);
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return String(value).length;
  if (Array.isArray(value)) return 2 + value.reduce((sum, item) => sum + jsonSize(item), 0) + Math.max(0, value.length - 1);
  const entries = Object.entries(value);
  return 2 + entries.reduce((sum, [key, item]) => sum + stringSize(key) + 1 + jsonSize(item), 0) + Math.max(0, entries.length - 1);
}

function fixtureInputs(value) {
  if (ownArray(value) !== 5) stop('E_LAYOUT_INPUT');
  const inputs = [];
  for (let i = 0; i < 5; i++) {
    const input = value[i];
    const p = ownData(input, ['role', 'root', 'file', 'archiveBytes', 'archiveSha256', 'expectedRoot', 'identity']);
    if (p.role !== RUST_LAYOUT_ROLES[i] || p.expectedRoot !== RUST_LAYOUT_INPUTS[i].expectedRoot
      || typeof p.root !== 'string' || !p.root.startsWith('/fixture/') || !canonical(p.root.slice(1))
      || p.file !== `${p.root}/${p.expectedRoot}.tar.xz`
      || !Number.isSafeInteger(p.archiveBytes) || p.archiveBytes < 1 || p.archiveBytes > RUST_LAYOUT_INPUTS[i].archiveBytes
      || typeof p.archiveSha256 !== 'string' || !digestPattern.test(p.archiveSha256) || p.archiveSha256 === RUST_LAYOUT_INPUTS[i].archiveSha256) stop('E_LAYOUT_INPUT');
    const identity = ownData(p.identity, ['root', 'file']);
    const captured = {};
    for (const kind of ['root', 'file']) {
      const stat = ownData(identity[kind], fields);
      for (const field of fields) if (typeof stat[field] !== 'string' || stat[field].length > 40 || !/^(?:0|[1-9][0-9]*)$/u.test(stat[field])) stop('E_LAYOUT_INPUT');
      if (stat.uid !== '1000' || stat.gid !== '1000' || stat.ino === '0'
        || stat.mode !== (kind === 'root' ? '16832' : '33152') || stat.nlink !== (kind === 'root' ? '2' : '1')
        || (kind === 'file' && stat.size !== String(p.archiveBytes))) stop('E_LAYOUT_INPUT');
      captured[kind] = Object.freeze(stat);
    }
    inputs.push(Object.freeze({ ...p, identity: Object.freeze(captured) }));
  }
  return Object.freeze(inputs);
}

function createCollector(inputs, limits, parserFactory, mockOnly) {
  let state = 'IDLE';
  let active = null;
  let accepted = [];
  const destinations = new Map();
  let expandedBytes = 0, entries = 0, metadataBytes = 0, manifestBytes = 0, outputBytes = 0;
  let roleMetadata = [0, 0, 0, 0, 0];
  let unknownLines = 0;
  let failureCode = null, failureRole = null;

  function release() {
    if (active?.file?.capture) active.file.capture.fill(0);
    if (active) { active.parser = null; active.hash = null; active.file = null; active.inventory = null; active.record = null; }
    active = null;
    accepted = [];
    destinations.clear();
    roleMetadata = [0, 0, 0, 0, 0];
    expandedBytes = 0; entries = 0; metadataBytes = 0; manifestBytes = 0; outputBytes = 0; unknownLines = 0;
  }
  function guarded(fn) {
    try { return fn(); }
    catch (error) {
      if (failureCode === null) {
        failureCode = failureCodeFrom(error);
        failureRole = active ? RUST_LAYOUT_ROLES[active.ordinal] : null;
      }
      release(); state = 'FAILED';
      if (ownedErrors.has(error)) throw error;
      stop('E_LAYOUT_DATA');
    }
  }
  function requireState(expected) { if (state !== expected) stop('E_LAYOUT_STATE'); }
  function chargeMetadata(roleIndex, delta) {
    if (delta > limits.maxRoleMetadataBytes - roleMetadata[roleIndex] || delta > limits.maxBatchMetadataBytes - metadataBytes) stop('E_LAYOUT_METADATA');
    roleMetadata[roleIndex] += delta;
    metadataBytes += delta;
  }
  function chargeOutput(delta) {
    if (delta > limits.maxOutputBytes - outputBytes) stop('E_LAYOUT_OUTPUT');
    outputBytes += delta;
  }
  function updateRecord(fields) {
    const candidate = { ...active.record, ...fields };
    const shell = { ...candidate, members: [], texts: [], declarations: [] };
    const cost = jsonSize(shell);
    const delta = cost - active.shellBytes;
    chargeMetadata(active.ordinal, delta); chargeOutput(delta);
    Object.assign(active.record, fields);
    active.shellBytes = cost;
  }
  function append(array, value, metadataValue = value) {
    const comma = array.length ? 1 : 0;
    chargeMetadata(active.ordinal, jsonSize(metadataValue) + comma);
    chargeOutput(jsonSize(value) + comma);
    array.push(Object.freeze(value));
  }

  function addDeclaration(declaration) {
    if (destinations.size >= 65_536 && !destinations.has(declaration.destination)) stop('E_LAYOUT_ENTRIES');
    append(active.record.declarations, declaration);
    const old = destinations.get(declaration.destination);
    const next = { destination: declaration.destination, count: (old?.count ?? 0) + 1,
      fileCount: (old?.fileCount ?? 0) + Number(declaration.type === 'file'),
      directoryCount: (old?.directoryCount ?? 0) + Number(declaration.type === 'directory'),
      firstOwner: old?.firstOwner ?? Object.freeze({ role: declaration.role, memberIndex: declaration.memberIndex, lineNumber: declaration.lineNumber }),
      roles: Object.freeze(RUST_LAYOUT_ROLES.filter(role => role === declaration.role || old?.roles.includes(role))) };
    const delta = jsonSize(next) - (old ? jsonSize(old) : 0) + (!old && destinations.size ? 1 : 0);
    chargeMetadata(RUST_LAYOUT_ROLES.indexOf(next.firstOwner.role), delta);
    chargeOutput(delta);
    destinations.set(declaration.destination, Object.freeze(next));
  }

  function captureText(file) {
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(file.capture); }
    finally { file.capture.fill(0); file.capture = null; }
    const lines = [];
    if (file.kind === 'manifest') {
      let start = 0, lineNumber = 1;
      while (start < text.length || (start === 0 && text.length === 0)) {
        const newline = text.indexOf('\n', start);
        const end = newline === -1 ? text.length : newline;
        const line = text.slice(start, end);
        const type = line.startsWith('file:') ? 'file' : line.startsWith('dir:') ? 'directory' : null;
        let row;
        if (type) {
          const destination = line.slice(type === 'file' ? 5 : 4);
          if (!canonical(destination)) stop('E_LAYOUT_DECLARATION');
          row = { lineNumber, recognized: true, type, destination };
          addDeclaration({ role: active.record.role, memberIndex: file.memberIndex, manifestPath: file.path, lineNumber, destination, type });
        } else {
          row = { lineNumber, text: line, recognized: false };
          unknownLines++;
        }
        append(lines, row, type ? row : { lineNumber, recognized: false });
        if (newline === -1) break;
        start = end + 1; lineNumber++;
      }
    }
    const value = { memberIndex: file.memberIndex, path: file.path, kind: file.kind, text, lines: Object.freeze(lines) };
    const metadata = { memberIndex: file.memberIndex, path: file.path, kind: file.kind, lines: [] };
    const output = { ...value, lines: [] };
    chargeMetadata(active.ordinal, jsonSize(metadata) + (active.record.texts.length ? 1 : 0));
    chargeOutput(jsonSize(output) + (active.record.texts.length ? 1 : 0));
    active.record.texts.push(Object.freeze(value));
  }

  function endFile() {
    const file = active.file;
    if (file.used !== file.size) stop('E_LAYOUT_BODY');
    const old = active.record.members[file.slot];
    active.record.members[file.slot] = Object.freeze({ ...old, bodySha256: file.hash.digest('hex') });
    file.hash = null;
    if (file.capture) captureText(file);
    active.file = null;
  }
  function consumeBody(view, start, end) {
    const file = active.file;
    if (!file) return;
    const from = Math.max(start, file.bodyOffset + file.used);
    const to = Math.min(end, file.bodyOffset + file.size);
    if (to > from) {
      if (from !== file.bodyOffset + file.used) stop('E_LAYOUT_BODY');
      const part = view.subarray(from - start, to - start);
      file.hash.update(part);
      if (file.capture) file.capture.set(part, file.used);
      file.used += to - from;
    }
    if (file.used === file.size) endFile();
  }

  function validateEvent(value, chunkStart, chunkEnd) {
    const event = ownData(value);
    const link = event.type === 'hardlink' || event.type === 'symlink';
    const keys = ['index', 'path', 'type', 'size', 'bodyOffset', 'mode', 'uid', 'gid', 'mtime', ...(link ? ['linkpath', 'linkKind'] : [])];
    if (Object.keys(event).length !== keys.length || Object.keys(event).some(key => !keys.includes(key)) || !Object.isFrozen(value)) stop('E_LAYOUT_EVENT');
    if (!['file', 'directory', 'hardlink', 'symlink'].includes(event.type) || !canonical(event.path)
      || (event.path !== active.input.expectedRoot && !event.path.startsWith(`${active.input.expectedRoot}/`))
      || (event.path === active.input.expectedRoot && event.type !== 'directory')) stop('E_LAYOUT_ROOT');
    if (!Number.isSafeInteger(event.index) || event.index !== active.record.members.length + 1
      || !Number.isSafeInteger(event.size) || event.size < 0 || event.size > limits.maxExpandedBytes
      || (event.type !== 'file' && event.size !== 0)
      || !Number.isSafeInteger(event.bodyOffset) || event.bodyOffset % 512 !== 0
      || event.bodyOffset < active.nextBodyOffset || event.bodyOffset <= chunkStart || event.bodyOffset > chunkEnd
      || !Number.isSafeInteger(event.bodyOffset + event.size)) stop('E_LAYOUT_EVENT');
    for (const key of ['mode', 'uid', 'gid']) if (!Number.isSafeInteger(event[key]) || event[key] < 0) stop('E_LAYOUT_EVENT');
    if (typeof event.mtime !== 'string' || event.mtime.length > 32 || !/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u.test(event.mtime)
      || BigInt(event.mtime.split('.')[0]) > BigInt(Number.MAX_SAFE_INTEGER) || BigInt(event.mtime.split('.')[0]) < -BigInt(Number.MAX_SAFE_INTEGER)) stop('E_LAYOUT_EVENT');
    if (link) {
      if (typeof event.linkpath !== 'string' || !event.linkpath || bytesOf(event.linkpath) > 1024 || /[\u0000-\u001f\u007f-\u009f\\]/u.test(event.linkpath)) stop('E_LAYOUT_EVENT');
      const kind = event.linkpath.startsWith('/') || /^[A-Za-z]:/u.test(event.linkpath) ? 'absolute' : event.linkpath.split('/').includes('..') ? 'parent-components' : 'relative';
      if (event.linkKind !== kind) stop('E_LAYOUT_EVENT');
    }
    active.nextBodyOffset = Math.ceil((event.bodyOffset + event.size) / 512) * 512 + 512;
    return event;
  }

  function feed(token, chunk) {
    return guarded(() => {
      requireState('ACTIVE');
      if (!active || active.token !== token || !active.parser || active.inventory) stop('E_LAYOUT_STATE');
      if (types.isProxy(chunk) || !types.isUint8Array(chunk)) stop('E_LAYOUT_CHUNK');
      const length = typedLength.call(chunk), backing = typedBuffer.call(chunk), offset = typedOffset.call(chunk);
      if (types.isSharedArrayBuffer(backing) || (resizable && resizable.call(backing)) || length < 1 || length > 65_536) stop('E_LAYOUT_CHUNK');
      const view = new Uint8Array(backing, offset, length);
      if (length > limits.maxExpandedBytes - active.record.expandedBytes || length > limits.maxBatchExpandedBytes - expandedBytes) stop('E_LAYOUT_EXPANDED');
      const start = active.record.expandedBytes, end = start + length;
      updateRecord({ expandedBytes: end }); expandedBytes += length;
      active.hash.update(view);
      const events = active.parser.feed(chunk);
      const count = ownArray(events);
      if (!Object.isFrozen(events) || count > limits.maxEntries - active.record.members.length || count > limits.maxBatchEntries - entries) stop('E_LAYOUT_ENTRIES');
      consumeBody(view, start, end);
      for (let i = 0; i < count; i++) {
        const event = validateEvent(events[i], start, end);
        if (active.file) stop('E_LAYOUT_BODY');
        entries++;
        const member = { ...event, ...(event.type === 'file' ? { bodySha256: '0'.repeat(64) } : {}) };
        append(active.record.members, member);
        if (event.type === 'file') {
          const suffix = event.path.slice(active.input.expectedRoot.length + 1);
          const kind = suffix === 'components' ? 'components' : suffix === 'rust-installer-version' ? 'installer-version' : suffix.split('/').at(-1) === 'manifest.in' ? 'manifest' : null;
          if (kind && (event.size > limits.maxManifestBytes || event.size > limits.maxBatchManifestBytes - manifestBytes)) stop('E_LAYOUT_MANIFEST');
          if (kind) manifestBytes += event.size;
          active.file = { memberIndex: event.index, path: event.path, kind, slot: active.record.members.length - 1,
            bodyOffset: event.bodyOffset, size: event.size, used: 0, hash: createHash('sha256'), capture: kind ? Buffer.alloc(event.size) : null };
          consumeBody(view, start, end);
        }
      }
      return events;
    });
  }

  function finishParser(token) {
    return guarded(() => {
      requireState('ACTIVE');
      if (!active || active.token !== token || !active.parser || active.inventory || active.file) stop('E_LAYOUT_STATE');
      const inventory = active.parser.finish();
      const summary = ownData(inventory, ['state', 'mockOnly', 'decoderQualified', 'realArchiveInspected', 'extractionAuthorized', 'pythonFreeSubsetVerified', 'installedUsability', 'rustReady', 'trainingReady', 'nativeQualified', 'provenanceVerified', 'expandedBytes', 'headers', 'entries', 'extensionBytes', 'outputBytes', 'collisionBytes', 'dataEvents', 'metadataSha256']);
      if (!Object.isFrozen(inventory) || summary.state !== 'TAR_INVENTORY' || summary.mockOnly !== false
        || summary.expandedBytes !== active.record.expandedBytes || summary.entries !== active.record.members.length
        || typeof summary.metadataSha256 !== 'string' || !digestPattern.test(summary.metadataSha256)) stop('E_LAYOUT_SUMMARY');
      for (const key of ['decoderQualified', 'realArchiveInspected', 'extractionAuthorized', 'pythonFreeSubsetVerified', 'installedUsability', 'rustReady', 'trainingReady', 'nativeQualified', 'provenanceVerified']) if (summary[key] !== false) stop('E_LAYOUT_SUMMARY');
      for (const key of ['headers', 'extensionBytes', 'outputBytes', 'collisionBytes', 'dataEvents']) if (!Number.isSafeInteger(summary[key]) || summary[key] < 0) stop('E_LAYOUT_SUMMARY');
      if (summary.headers < summary.entries || summary.headers > active.parserLimits.maxHeaders || summary.extensionBytes > active.parserLimits.maxExtensionBytes
        || summary.outputBytes > active.parserLimits.maxOutputBytes || summary.collisionBytes > active.parserLimits.maxCollisionBytes
        || summary.dataEvents > active.parserLimits.maxDataEvents) stop('E_LAYOUT_SUMMARY');
      updateRecord({ decodedSha256: active.hash.digest('hex'), inventory });
      active.hash = null; active.parser = null; active.inventory = inventory;
      return inventory;
    });
  }

  function beginLayoutBatch(...args) {
    return guarded(() => {
      if (args.length) stop('E_LAYOUT_INPUT');
      requireState('IDLE'); failureCode = null; failureRole = null; state = 'ACTIVE';
    });
  }
  function beginLayoutRole(...args) {
    return guarded(() => {
      requireState('ACTIVE');
      if (args.length !== 1 || typeof args[0] !== 'string' || args[0] !== RUST_LAYOUT_ROLES[accepted.length] || active || accepted.length >= 5) stop('E_LAYOUT_STATE');
      const ordinal = accepted.length;
      const input = inputs[ordinal];
      active = { ordinal, input, token: Symbol(input.role), parser: null, factoryUsed: false, inventory: null, file: null,
        hash: createHash('sha256'), nextBodyOffset: 512,
        record: { role: input.role, expandedBytes: 0, decodedSha256: '', members: [], texts: [], declarations: [] } };
      active.shellBytes = jsonSize(active.record);
      chargeMetadata(ordinal, active.shellBytes + (accepted.length ? 1 : 0));
      chargeOutput(active.shellBytes + (accepted.length ? 1 : 0));
    });
  }
  function createTarInventory(...args) {
    return guarded(() => {
      requireState('ACTIVE');
      if (args.length > 1 || !active || active.factoryUsed) stop('E_LAYOUT_STATE');
      const base = { ...INVENTORY_LIMITS, maxExpandedBytes: limits.maxExpandedBytes, maxHeaders: 32_768, maxChunkBytes: 65_536, maxExtensionBytes: 4_194_304 };
      const parserLimits = lowerLimits(args.length ? args[0] : {}, base);
      active.factoryUsed = true;
      const parser = ownData(parserFactory(parserLimits), ['feed', 'finish']);
      if (typeof parser.feed !== 'function' || typeof parser.finish !== 'function' || types.isProxy(parser.feed) || types.isProxy(parser.finish)) stop('E_LAYOUT_INPUT');
      active.parser = parser; active.parserLimits = parserLimits;
      const token = active.token;
      return Object.freeze({ feed: chunk => feed(token, chunk), finish: () => finishParser(token) });
    });
  }
  function acceptLayoutRole(...args) {
    return guarded(() => {
      requireState('ACTIVE');
      if (args.length !== 1 || !active?.inventory) stop('E_LAYOUT_STATE');
      const core = ownData(args[0]);
      if (core.state !== 'GNU_SDK_DATA_INVENTORY' || core.mockOnly !== mockOnly || core.inventory !== active.inventory
        || core.archiveBytes !== active.input.archiveBytes || core.archiveSha256 !== active.input.archiveSha256
        || core.archivePasses !== 2 || core.archiveDataBytes !== 2 * active.input.archiveBytes
        || core.archiveRequestedBytes !== 2 * active.input.archiveBytes + 2 || core.closeAttempts !== 2
        || core.stdinFinished !== true || core.stdoutEnded !== true || core.stderrEnded !== true || core.closeObserved !== true
        || core.exitCode !== 0 || core.signal !== null || core.extracted !== false || core.nativeQualified !== false || core.pythonFreeSubsetVerified !== false) stop('E_LAYOUT_CORE');
      const record = active.record;
      updateRecord({ archiveBytes: active.input.archiveBytes, archiveSha256: active.input.archiveSha256 });
      for (const key of ['members', 'texts', 'declarations']) Object.freeze(record[key]);
      accepted.push(Object.freeze(record));
      active = null;
    });
  }
  function finishLayoutBatch(...args) {
    return guarded(() => {
      if (args.length) stop('E_LAYOUT_INPUT');
      requireState('ACTIVE');
      if (active || accepted.length !== 5) stop('E_LAYOUT_STATE');
      const index = [...destinations.values()].sort((a, b) => a.destination < b.destination ? -1 : a.destination > b.destination ? 1 : 0);
      const collisions = [];
      for (const item of index) {
        let prefix = '', firstNonDirectoryAncestor = null, nonDirectoryAncestorCount = 0;
        const parts = item.destination.split('/');
        for (let i = 0; i < parts.length - 1; i++) {
          prefix += (i ? '/' : '') + parts[i];
          const ancestor = destinations.get(prefix);
          if (ancestor?.fileCount) { nonDirectoryAncestorCount++; firstNonDirectoryAncestor ??= prefix; }
        }
        if (item.count > 1 || nonDirectoryAncestorCount) {
          const collision = Object.freeze({ destination: item.destination, declarationCount: item.count,
            duplicateDeclarations: item.count > 1, kindConflict: item.fileCount > 0 && item.directoryCount > 0,
            repeatedDirectoryOnly: item.fileCount === 0 && item.count > 1,
            nonDirectoryAncestorCount, firstNonDirectoryAncestor,
            conflict: (item.fileCount > 0 && item.count > 1) || nonDirectoryAncestorCount > 0 });
          const cost = jsonSize(collision) + (collisions.length ? 1 : 0);
          chargeMetadata(RUST_LAYOUT_ROLES.indexOf(item.firstOwner.role), cost); chargeOutput(cost);
          collisions.push(collision);
        }
      }
      const result = { profile: 'RUST_COMPONENT_LAYOUT_DATA', state: 'RUST_COMPONENT_LAYOUT_DATA', mockOnly,
        ...negativeFlags, expandedBytes, entries, manifestBytes, metadataBytes, unknownManifestLines: unknownLines,
        manifestLineConvention: 'LF split; terminal LF sentinel excluded; full text preserved',
        decodedHashScope: 'observed decoded bytes; no prior decoded hash or general XZ integrity claim',
        verificationScope: 'collector lifecycle tests do not prove real decoder behavior',
        metadataScope: 'exact escaped ASCII JSON retained records, indexes and collisions; text properties and result envelope excluded',
        memoryScope: 'retained JSON budgets; parser collision state and chunk copies separately bounded; not hard RSS',
        roles: Object.freeze(accepted), destinations: Object.freeze(index), collisions: Object.freeze(collisions) };
      const shell = { ...result, roles: [], destinations: [], collisions: [] };
      chargeOutput(jsonSize(shell));
      if (jsonSize(result) !== outputBytes || outputBytes > limits.maxOutputBytes) stop('E_LAYOUT_OUTPUT');
      Object.freeze(result);
      release(); failureCode = null; failureRole = null; state = 'FINISHED';
      return result;
    });
  }
  function abortLayoutBatch(...args) {
    return guarded(() => { if (args.length) stop('E_LAYOUT_INPUT'); release(); if (state !== 'FINISHED') state = 'ABORTED'; });
  }
  function snapshotLayout(...args) {
    return guarded(() => {
      if (args.length) stop('E_LAYOUT_INPUT');
      return Object.freeze({ state, mockOnly, acceptedRoles: accepted.length, currentRole: active?.input.role ?? null,
        entries, expandedBytes, metadataBytes, manifestBytes, outputBytes, failureCode, failureRole });
    });
  }
  return Object.freeze({ beginLayoutBatch, beginLayoutRole, createTarInventory, acceptLayoutRole, finishLayoutBatch, abortLayoutBatch, snapshotLayout });
}

export function createRustLayoutFixture(profile, trustedParserFactory) {
  const p = ownData(profile, ['mockOnly', 'inputs', 'limits']);
  if (p.mockOnly !== true || typeof trustedParserFactory !== 'function' || types.isProxy(trustedParserFactory)) stop('E_LAYOUT_INPUT');
  return createCollector(fixtureInputs(p.inputs), lowerLimits(p.limits, RUST_LAYOUT_LIMITS), trustedParserFactory, true);
}

const production = createCollector(RUST_LAYOUT_INPUTS, RUST_LAYOUT_LIMITS, originalCreateTarInventory, false);
export const beginLayoutBatch = production.beginLayoutBatch;
export const beginLayoutRole = production.beginLayoutRole;
export const createTarInventory = production.createTarInventory;
export const acceptLayoutRole = production.acceptLayoutRole;
export const finishLayoutBatch = production.finishLayoutBatch;
export const abortLayoutBatch = production.abortLayoutBatch;
export const snapshotLayout = production.snapshotLayout;
