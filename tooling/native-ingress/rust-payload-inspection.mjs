// SPEC: _spec/tooling/native-ingress/step2.puml
import { createHash } from 'node:crypto';
import { types } from 'node:util';
import { createTarInventory as originalCreateTarInventory, INVENTORY_LIMITS } from './tar-inventory.mjs';
import { inspectElf64RequirementsV5 } from './elf-requirements-v5.mjs';

export const RUST_PAYLOAD_ROLES = Object.freeze(['cargo', 'rustc', 'rust-std', 'rustfmt-preview', 'clippy-preview']);
export const RUST_PAYLOAD_LIMITS = Object.freeze({
  maxExpandedBytes: 1_073_741_824, maxBatchExpandedBytes: 2_147_483_648,
  maxEntries: 32_768, maxBatchEntries: 65_536, maxChunkBytes: 65_536,
  maxPayloadBytes: 268_435_456, maxElfSnapshotBytes: 268_435_456,
  maxAggregateBytes: 536_870_912, maxTextBytes: 1_048_576,
  maxObservationBytes: 4_194_304, maxOutputBytes: 2_097_152,
  maxLinkerDepth: 32, maxLinkerReferences: 1024,
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
export const RUST_PAYLOAD_INPUTS = Object.freeze(inputRows.map(([role, name, archiveBytes, archiveSha256, ino, time]) => {
  const expectedRoot = `${name}-1.95.0-x86_64-unknown-linux-gnu`;
  return Object.freeze({ role, root, file: `${root}/${expectedRoot}.tar.xz`, archiveBytes, archiveSha256, expectedRoot,
    identity: Object.freeze({ root: rootIdentity, file: Object.freeze({ dev: '29', ino, mode: '33152', uid: '1000', gid: '1000', nlink: '1', size: String(archiveBytes), mtimeNs: time, ctimeNs: time }) }) });
}));
export const RUST_PAYLOAD_TARGETS = Object.freeze([
  ['cargo', 'cargo-1.95.0-x86_64-unknown-linux-gnu/cargo/bin/cargo', 66, 651776, 42185192, '841072d1d92f9e841d9ba5b0814182a0adf064acf4527cd120967b7bc49dcb66', 'ELF_EXEC_DSO', 'HOST'],
  ['rustc', 'rustc-1.95.0-x86_64-unknown-linux-gnu/rustc/bin/rustdoc', 25, 41984, 13303096, 'e5144902aed6cf94280eae3ad7708da5bdd3819b5281728af432d0e70231439c', 'ELF_EXEC_DSO', 'HOST'],
  ['rustc', 'rustc-1.95.0-x86_64-unknown-linux-gnu/rustc/bin/rustc', 26, 13345792, 644784, 'bff349e72704ff70bc08a234a3847338e797065bbedde5e556808bc87b7bf7c6', 'ELF_EXEC_DSO', 'HOST'],
  ['rustc', 'rustc-1.95.0-x86_64-unknown-linux-gnu/rustc/lib/rustlib/x86_64-unknown-linux-gnu/bin/rust-lld', 29, 19527680, 11604688, '60f305b55da767671e895b231e0c78e87f4ccbf790d7181842039c53bb60281c', 'ELF_EXEC_DSO', 'HOST'],
  ['rustc', 'rustc-1.95.0-x86_64-unknown-linux-gnu/rustc/lib/rustlib/x86_64-unknown-linux-gnu/bin/gcc-ld/ld.lld', 31, 31511040, 376864, 'e7d44b7571a8250326e99aa238aa4be7ddaa1fa696cf3c0e2ca829da5846b325', 'ELF_EXEC_DSO', 'HOST'],
  ['rustc', 'rustc-1.95.0-x86_64-unknown-linux-gnu/rustc/lib/libLLVM.so.22.1-rust-1.95.0-stable', 34, 31897088, 199603328, 'f6a654c837c51bc2fc00f83d58318607b6f30fec364a00f09b6172129e591fb5', 'ELF_EXEC_DSO', 'HOST'],
  ['rustc', 'rustc-1.95.0-x86_64-unknown-linux-gnu/rustc/lib/libLLVM-22-rust-1.95.0-stable.so', 47, 246645760, 42, '044a388f61f18a07583a1126fa91c1288ecb0745f41a8369ec4a6b2acb9b51d3', 'LINKER_TEXT', 'HOST'],
  ['rustc', 'rustc-1.95.0-x86_64-unknown-linux-gnu/rustc/lib/librustc_driver-6108105cd7e839cf.so', 48, 246646784, 153621360, 'ae69468875215df490fde685ec1f1b969743482ba7e0251f4074a222606a5484', 'ELF_EXEC_DSO', 'HOST'],
  ['rust-std', 'rust-std-1.95.0-x86_64-unknown-linux-gnu/rust-std-x86_64-unknown-linux-gnu/lib/rustlib/x86_64-unknown-linux-gnu/lib/libstd-d1237ef7159db0a2.so', 80, 161335296, 5418488, 'abca53e870629e3f9f97ae72897181dcc4db555d8e6ace00351b02a74ef77c81', 'ELF_EXEC_DSO', 'TARGET'],
  ['rustfmt-preview', 'rustfmt-1.95.0-x86_64-unknown-linux-gnu/rustfmt-preview/bin/cargo-fmt', 21, 99840, 3715584, 'cd554fed0211e007995a6a540a7fd67bf22354986ae64960c752bb943d8e1184', 'ELF_EXEC_DSO', 'HOST'],
  ['rustfmt-preview', 'rustfmt-1.95.0-x86_64-unknown-linux-gnu/rustfmt-preview/bin/rustfmt', 22, 3815936, 5295560, '56b31ad3ec8fe0277a2884a189e243b8f04e9b48e5fd22e547c1516c5f8fd34c', 'ELF_EXEC_DSO', 'HOST'],
  ['clippy-preview', 'clippy-1.95.0-x86_64-unknown-linux-gnu/clippy-preview/bin/clippy-driver', 20, 99840, 20339280, '81bd985ee50d78e9d8c5810f6ca836614d1bf95e0e8142f1ec5f42eb250ed729', 'ELF_EXEC_DSO', 'HOST'],
  ['clippy-preview', 'clippy-1.95.0-x86_64-unknown-linux-gnu/clippy-preview/bin/cargo-clippy', 22, 20441088, 1263912, 'b71b1263063707608daa1e9b231ad9d87507c11d6aa178ede2b01d8372d5effb', 'ELF_EXEC_DSO', 'HOST'],
].map(([role, path, index, bodyOffset, size, sha256, kind, domain]) => Object.freeze({ role, path, index, bodyOffset, size, sha256, kind, domain })));
export const RUST_PAYLOAD_EXPECTATIONS = Object.freeze([
  ['cargo', 42864128, 68, 68, '97faa298dac62ef85e60ac1bd30a343bfc8e1f587aee6b2875f6e9db7f3877d9', '22429805eca884d4f844843c8e7bc3dc3796737067e19274387953e5081a88f6'],
  ['rustc', 402308096, 70, 71, '9a00ed58e31abdede8d8acfc74bd92e3afdb3fc3089a220f63b680830a8b471f', '08c25740ad1acbcdf84625b6f05b316f994cba94efdb4f262749b5bbad7e0cc0'],
  ['rust-std', 166755840, 81, 146, 'f013cd265653f00e2a719b4b51daef65a9b73fa2527118a5b5baa64b0c203c75', 'a48379ce9b557559ff0e95c7f34a415fb454dad32e63a7f5ec77feb75bcbde96'],
  ['rustfmt-preview', 9112576, 22, 22, '33bf584dc2495890a712b449dc1cefda8fdcc8d1f940a67cd46fe1f6325bbe74', '7c33b012cd3b219844ee0d7c0bd3537ec1f1639883925207cb95474fbd43d6a2'],
  ['clippy-preview', 21706240, 22, 22, '2c4f9abdde502a3a18ce32db066f1d8cd866cfe1cf4d853db6994b46435020dc', 'a0b25caf8a302f4a7edf7f6c0ed3ab9cbf15e6a626bbd6de42babe694ede0f87'],
].map(([role, expandedBytes, entries, headers, metadataSha256, decodedSha256]) => Object.freeze({ role, expandedBytes, entries, headers, metadataSha256, decodedSha256 })));

const flags = Object.freeze({ archiveExtracted: false, filesInstalled: false, rustExecuted: false,
  pythonRuntimeInvoked: false, pythonFreeSubsetVerified: false, installedUsability: false,
  extractionAuthorized: false, relocationReady: false, roleSatisfied: false, abiVerified: false,
  decoderQualified: false, candidateExecuted: false,
  loaderClosureVerified: false, runtimeProvidersQualified: false, provenanceVerified: false,
  nativeAuthority: false, nativeQualified: false, rustReady: false, trainingReady: false,
  imagePrepared: false, dockerProviderQualified: false, sourceReady: false, rootfsReady: false,
  installReady: false, hardRssBounded: false, hardDeadlineGuaranteed: false, processTreeBounded: false });
const coreNegativeFlags = Object.freeze(['extracted', 'extractionAuthorized', 'pythonFreeSubsetVerified',
  'installedUsability', 'nativeQualified', 'decoderQualified', 'rustReady', 'trainingReady',
  'provenanceVerified', 'hardRssBounded', 'processTreeBounded', 'hardDeadlineGuaranteed']);
const codes = new Set(['E_PAYLOAD_INPUT', 'E_PAYLOAD_LIMIT', 'E_PAYLOAD_STATE', 'E_PAYLOAD_DATA',
  'E_PAYLOAD_CHUNK', 'E_PAYLOAD_EXPANDED', 'E_PAYLOAD_ENTRIES', 'E_PAYLOAD_ROOT', 'E_PAYLOAD_EVENT',
  'E_PAYLOAD_TARGET', 'E_PAYLOAD_SPAN', 'E_PAYLOAD_BODY_HASH', 'E_PAYLOAD_DECODED_HASH',
  'E_PAYLOAD_SUMMARY', 'E_PAYLOAD_CORE', 'E_PAYLOAD_ELF', 'E_PAYLOAD_LINKER_TEXT',
  'E_PAYLOAD_LINKER_UNSUPPORTED', 'E_PAYLOAD_METADATA', 'E_PAYLOAD_OUTPUT']);
const elfCodes = new Set(['E_INPUT', 'E_LIMITS', 'E_ELF', 'E_RANGE', 'E_PROGRAM_HEADERS',
  'E_INTERPRETER', 'E_DYNAMIC', 'E_STRING_TABLE', 'E_STRING', 'E_OUTPUT', 'E_VERSIONS', 'E_NOTES', 'E_PROPERTIES']);
const tarCodes = new Set(['E_LIMITS', 'E_UTF8', 'E_TEXT', 'E_NUMBER', 'E_PAX_NUMBER', 'E_PAX',
  'E_PAX_KEY', 'E_PAX_DUPLICATE', 'E_PATH', 'E_SEALED', 'E_INTERNAL', 'E_GNU_LONG', 'E_DANGLING_EXTENSION',
  'E_TERMINATOR', 'E_HEADERS', 'E_CHECKSUM', 'E_MAGIC', 'E_SIZE', 'E_EXTENSION_REPEAT', 'E_EXTENSION_BYTES',
  'E_NONFILE_BODY', 'E_TYPE', 'E_LINK', 'E_COLLISION', 'E_COLLISION_BYTES', 'E_EVENT_BYTES', 'E_OUTPUT_BYTES',
  'E_SPAN_BYTES', 'E_CHUNK', 'E_DATA_EVENTS', 'E_EXPANDED_BYTES', 'E_PADDING', 'E_TRAILING', 'E_TRUNCATED']);
const ownedErrors = new WeakSet();
const digestPattern = /^[0-9a-f]{64}$/u;
const typed = Object.getPrototypeOf(Uint8Array.prototype);
const lengthOf = Object.getOwnPropertyDescriptor(typed, 'length').get;
const bufferOf = Object.getOwnPropertyDescriptor(typed, 'buffer').get;
const offsetOf = Object.getOwnPropertyDescriptor(typed, 'byteOffset').get;
const resizable = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
const fail = (code, underlyingCode = null) => {
  const fixed = codes.has(code) ? code : 'E_PAYLOAD_DATA';
  const error = Object.assign(new Error(fixed), { name: 'RustPayloadError', code: fixed, underlyingCode });
  ownedErrors.add(error); throw Object.freeze(error);
};
function fixedCode(error, key, allowed) {
  if (!error || typeof error !== 'object' || types.isProxy(error)) return null;
  const d = Object.getOwnPropertyDescriptor(error, key);
  return d && Object.hasOwn(d, 'value') && typeof d.value === 'string' && allowed.has(d.value) ? d.value : null;
}
function data(value, keys) {
  if (!value || typeof value !== 'object' || types.isProxy(value)) fail('E_PAYLOAD_INPUT');
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) fail('E_PAYLOAD_INPUT');
  const found = Reflect.ownKeys(value);
  if (found.length > 128 || (keys && (found.length !== keys.length || found.some(key => !keys.includes(key))))) fail('E_PAYLOAD_INPUT');
  const result = Object.create(null);
  for (const key of found) {
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !d || !Object.hasOwn(d, 'value')) fail('E_PAYLOAD_INPUT');
    result[key] = d.value;
  }
  return result;
}
function arrayLength(value, max = 65_536) {
  if (types.isProxy(value) || !Array.isArray(value) || ![Array.prototype, null].includes(Object.getPrototypeOf(value))) fail('E_PAYLOAD_INPUT');
  const n = Object.getOwnPropertyDescriptor(value, 'length').value;
  if (!Number.isSafeInteger(n) || n > max || Reflect.ownKeys(value).length !== n + 1) fail('E_PAYLOAD_INPUT');
  for (let i = 0; i < n; i++) {
    const d = Object.getOwnPropertyDescriptor(value, String(i));
    if (!d || !Object.hasOwn(d, 'value')) fail('E_PAYLOAD_INPUT');
  }
  return n;
}
function lowerLimits(value, base) {
  const p = data(value), result = { ...base };
  for (const [key, n] of Object.entries(p)) {
    if (!Object.hasOwn(base, key) || !Number.isSafeInteger(n) || n < 1 || n > base[key]) fail('E_PAYLOAD_LIMIT');
    result[key] = n;
  }
  return Object.freeze(result);
}
function canonical(path) {
  return typeof path === 'string' && path.length > 0 && Buffer.byteLength(path) <= 1024
    && !/[\u0000-\u001f\u007f-\u009f\\]/u.test(path) && !path.startsWith('/') && !/^[A-Za-z]:/u.test(path)
    && !path.split('/').some(part => part === '' || part === '.' || part === '..');
}
function stringSize(text, charge) {
  charge(2);
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    charge(c === 34 || c === 92 || [8, 9, 10, 12, 13].includes(c) ? 2 : c < 32 || c >= 128 ? 6 : 1);
  }
}
function jsonSize(value, max, code = 'E_PAYLOAD_METADATA') {
  let total = 0, nodes = 0;
  const parents = new Set();
  const charge = n => { if (n > max - total) fail(code); total += n; };
  function visit(v, depth) {
    if (++nodes > 200_000 || depth > 32) fail(code);
    if (typeof v === 'string') { stringSize(v, charge); return; }
    if (v === null || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))) { charge(String(v).length); return; }
    if (!v || typeof v !== 'object' || types.isProxy(v) || parents.has(v)) fail('E_PAYLOAD_INPUT');
    parents.add(v);
    if (Array.isArray(v)) {
      const n = arrayLength(v); charge(2 + Math.max(0, n - 1));
      for (let i = 0; i < n; i++) visit(Object.getOwnPropertyDescriptor(v, String(i)).value, depth + 1);
    } else {
      const p = data(v), keys = Object.keys(p); charge(2 + Math.max(0, keys.length - 1));
      for (const key of keys) { stringSize(key, charge); charge(1); visit(p[key], depth + 1); }
    }
    parents.delete(v);
  }
  visit(value, 0); return total;
}
function freezeTree(value) {
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) freezeTree(Object.getOwnPropertyDescriptor(value, key).value);
    Object.freeze(value);
  }
  return value;
}
function chunkView(chunk, max) {
  if (types.isProxy(chunk) || !types.isUint8Array(chunk)) fail('E_PAYLOAD_CHUNK');
  const n = lengthOf.call(chunk), backing = bufferOf.call(chunk), offset = offsetOf.call(chunk);
  if (!n || n > max || types.isSharedArrayBuffer(backing) || (resizable && resizable.call(backing))) fail('E_PAYLOAD_CHUNK');
  try { return new Uint8Array(backing, offset, n); } catch { fail('E_PAYLOAD_CHUNK'); }
}
function linker(bytes, limits) {
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); } catch { fail('E_PAYLOAD_LINKER_TEXT'); }
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/u.test(text)) fail('E_PAYLOAD_LINKER_TEXT');
  let at = 0, tokens = 0, statements = 0;
  const references = [], formats = [];
  function token() {
    while (at < text.length) {
      if (/[ \t\r\n]/u.test(text[at])) { at++; continue; }
      if (text.startsWith('/*', at)) {
        const end = text.indexOf('*/', at + 2);
        if (end < 0 || text.indexOf('/*', at + 2) !== -1 && text.indexOf('/*', at + 2) < end) fail('E_PAYLOAD_LINKER_TEXT');
        at = end + 2; continue;
      }
      break;
    }
    if (at === text.length) return null;
    if (++tokens > 65_536) fail('E_PAYLOAD_LINKER_TEXT');
    if (text[at] === '(' || text[at] === ')') return text[at++];
    const start = at;
    while (at < text.length && /[A-Za-z0-9_./+:-]/u.test(text[at]) && !text.startsWith('/*', at)) {
      if (++at - start > 1024) fail('E_PAYLOAD_LINKER_UNSUPPORTED');
    }
    if (start === at) fail('E_PAYLOAD_LINKER_UNSUPPORTED');
    return text.slice(start, at);
  }
  function list(directive, depth, scope) {
    if (depth > limits.maxLinkerDepth || token() !== '(') fail('E_PAYLOAD_LINKER_TEXT');
    let count = 0, item;
    while ((item = token()) !== ')') {
      if (item === null || item === '(') fail('E_PAYLOAD_LINKER_TEXT');
      if (item === 'AS_NEEDED') {
        if (directive === 'OUTPUT_FORMAT') fail('E_PAYLOAD_LINKER_UNSUPPORTED');
        list(item, depth + 1, [...scope, item]);
      } else {
        if (/^[A-Z][A-Z_]*$/u.test(item)) fail('E_PAYLOAD_LINKER_UNSUPPORTED');
        if (directive === 'OUTPUT_FORMAT') {
          if (formats.length || !/^[A-Za-z0-9_-]+$/u.test(item)) fail('E_PAYLOAD_LINKER_UNSUPPORTED');
          formats.push(item);
        } else {
          if (references.length >= limits.maxLinkerReferences) fail('E_PAYLOAD_LINKER_TEXT');
          references.push({ literal: item, directive, directives: scope, scope: 'DATA_NOT_HOSTPATH_PERMISSION',
            requiresApprovedImageMapping: true, followed: false });
        }
      }
      count++;
    }
    if (!count || directive === 'OUTPUT_FORMAT' && count !== 1) fail('E_PAYLOAD_LINKER_TEXT');
  }
  let directive;
  while ((directive = token()) !== null) {
    if (!['OUTPUT_FORMAT', 'GROUP', 'INPUT'].includes(directive)) fail('E_PAYLOAD_LINKER_UNSUPPORTED');
    if (directive === 'OUTPUT_FORMAT' && statements !== 0) fail('E_PAYLOAD_LINKER_UNSUPPORTED');
    list(directive, 1, [directive]); statements++;
  }
  if (!statements || !references.length) fail('E_PAYLOAD_LINKER_TEXT');
  return { state: 'GNU_LD_REFERENCE_DATA', text, formats, references,
    evaluated: false, hostResolutionAttempted: false, qualified: false };
}
function inspect(target, bytes, limits, elfInspector) {
  if (target.kind === 'LINKER_TEXT') return linker(bytes, limits);
  let requirements;
  try { requirements = elfInspector(bytes); } catch (error) { fail('E_PAYLOAD_ELF', fixedCode(error, 'code', elfCodes)); }
  jsonSize(requirements, limits.maxObservationBytes);
  const p = data(requirements), dynamic = data(p.dynamic);
  const n = arrayLength(dynamic.needed, 32);
  for (let i = 0; i < n; i++) if (typeof dynamic.needed[i] !== 'string' || !dynamic.needed[i] || Buffer.byteLength(dynamic.needed[i]) > 1024) fail('E_PAYLOAD_ELF');
  if (dynamic.soname !== null && (typeof dynamic.soname !== 'string' || Buffer.byteLength(dynamic.soname) > 1024)) fail('E_PAYLOAD_ELF');
  const loading = new Set(['1879047930', '1879047931', '1879047932', '2147483645', '2147483646', '2147483647']);
  const unknown = dynamic.unknownTags;
  arrayLength(unknown, 1024);
  const unsafeLoadingTags = unknown.filter(row => loading.has(data(row).tag));
  return { state: 'ELF_EXEC_DSO_REQUIREMENT_DATA', requirements, unsafeLoadingTags,
    loadingTagsQualification: 'NOT_QUALIFIED', abiVerified: false, qualified: false };
}

function makeProfile(inputs, targets, expectations, limits, mockOnly) {
  let totalBytes = 0;
  for (let i = 0; i < 5; i++) {
    const expected = expectations[i], selected = targets.filter(t => t.role === RUST_PAYLOAD_ROLES[i]);
    let previousEnd = 0, previousIndex = 0;
    if (!Number.isSafeInteger(expected.expandedBytes) || expected.expandedBytes < 1 || expected.expandedBytes > RUST_PAYLOAD_EXPECTATIONS[i].expandedBytes
      || !Number.isSafeInteger(expected.entries) || expected.entries < 1 || expected.entries > RUST_PAYLOAD_EXPECTATIONS[i].entries
      || !Number.isSafeInteger(expected.headers) || expected.headers < expected.entries || expected.headers > RUST_PAYLOAD_EXPECTATIONS[i].headers
      || !digestPattern.test(typeof expected.metadataSha256 === 'string' ? expected.metadataSha256 : '')
      || !digestPattern.test(typeof expected.decodedSha256 === 'string' ? expected.decodedSha256 : '')) fail('E_PAYLOAD_INPUT');
    for (const target of selected) {
      const cap = target.kind === 'LINKER_TEXT' ? RUST_PAYLOAD_LIMITS.maxTextBytes : RUST_PAYLOAD_LIMITS.maxElfSnapshotBytes;
      if (!Number.isSafeInteger(target.index) || target.index <= previousIndex || target.index > expected.entries
        || !Number.isSafeInteger(target.bodyOffset) || target.bodyOffset % 512 || target.bodyOffset < Math.max(512, previousEnd)
        || !Number.isSafeInteger(target.size) || target.size < 1 || target.size > cap || target.size > RUST_PAYLOAD_LIMITS.maxPayloadBytes
        || target.size > expected.expandedBytes - target.bodyOffset || !digestPattern.test(typeof target.sha256 === 'string' ? target.sha256 : '')) fail('E_PAYLOAD_SPAN');
      totalBytes += target.size; previousEnd = Math.ceil((target.bodyOffset + target.size) / 512) * 512 + 512; previousIndex = target.index;
    }
  }
  if (targets.length !== 13 || totalBytes > RUST_PAYLOAD_LIMITS.maxAggregateBytes) fail('E_PAYLOAD_LIMIT');
  return Object.freeze({ inputs, targets, expectations, limits, mockOnly, totalBytes });
}
function collector(profile, parserFactory, elfInspector) {
  const { inputs, targets, expectations, limits, mockOnly } = profile;
  let state = 'IDLE', active = null, accepted = [], members = [], edges = [], failure = null, attempt = null;
  let expandedBytes = 0, entries = 0, capturedBytes = 0, observationBytes = 6;
  let buffersAllocated = 0, buffersErased = 0, peakPayloadBytes = 0;
  function wipe() {
    if (active?.capture) { active.capture.bytes.fill(0); active.capture.hash = null; active.capture = null; buffersErased++; }
  }
  function release() {
    wipe(); active = null; accepted = []; members = []; edges = []; attempt = null;
    expandedBytes = 0; entries = 0; capturedBytes = 0; observationBytes = 6;
    buffersAllocated = 0; buffersErased = 0; peakPayloadBytes = 0;
  }
  function guarded(fn) {
    try { return fn(); } catch (error) {
      const code = ownedErrors.has(error) ? fixedCode(error, 'code', codes) : fixedCode(error, 'code', tarCodes) ?? 'E_PAYLOAD_DATA';
      if (failure === null) {
        const attempted = attempt ?? (active?.capture ? active.selected[active.next] : null);
        const literal = attempted === null ? null : RUST_PAYLOAD_TARGETS.find(t => t.path === attempted.path);
        failure = Object.freeze({ sourceProfile: 'RUST_COMPONENT_LAYOUT_DATA', role: literal?.role ?? active?.input.role ?? null,
          path: literal?.path ?? null, index: literal?.index ?? null, kind: literal?.kind ?? null, code,
          underlyingCode: code === 'E_PAYLOAD_ELF' ? fixedCode(error, 'underlyingCode', elfCodes) : null,
          scope: 'ATTEMPTED_LITERAL_TARGET_NOT_ACCEPTED_PAYLOAD_EVIDENCE' });
        jsonSize(failure, 4096);
      }
      release(); state = 'FAILED';
      if (ownedErrors.has(error)) throw error;
      fail('E_PAYLOAD_DATA');
    }
  }
  function requireState() { if (state !== 'ACTIVE') fail('E_PAYLOAD_STATE'); }
  function noArgs(args) { if (args.length) fail('E_PAYLOAD_INPUT'); }
  function append(list, value) {
    const cost = jsonSize(value, limits.maxObservationBytes) + (list.length ? 1 : 0);
    if (cost > limits.maxObservationBytes - observationBytes) fail('E_PAYLOAD_METADATA');
    freezeTree(value); list.push(value); observationBytes += cost;
  }
  function validateEvent(value, start, end) {
    const e = data(value, ['index', 'path', 'type', 'size', 'bodyOffset', 'mode', 'uid', 'gid', 'mtime']);
    if (!Object.isFrozen(value) || !['file', 'directory'].includes(e.type) || !canonical(e.path)
      || (e.path !== active.input.expectedRoot && !e.path.startsWith(active.input.expectedRoot + '/'))
      || (e.path === active.input.expectedRoot && e.type !== 'directory')) fail('E_PAYLOAD_ROOT');
    if (!Number.isSafeInteger(e.index) || e.index !== active.entries + 1 || !Number.isSafeInteger(e.size) || e.size < 0
      || e.size > limits.maxExpandedBytes || e.type !== 'file' && e.size !== 0
      || !Number.isSafeInteger(e.bodyOffset) || e.bodyOffset % 512 || e.bodyOffset < active.nextBodyOffset
      || e.bodyOffset <= start || e.bodyOffset > end || !Number.isSafeInteger(e.bodyOffset + e.size)) fail('E_PAYLOAD_EVENT');
    for (const key of ['mode', 'uid', 'gid']) if (!Number.isSafeInteger(e[key]) || e[key] < 0) fail('E_PAYLOAD_EVENT');
    if (typeof e.mtime !== 'string' || e.mtime.length > 32 || !/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u.test(e.mtime)
      || BigInt(e.mtime.split('.')[0]) > BigInt(Number.MAX_SAFE_INTEGER) || BigInt(e.mtime.split('.')[0]) < -BigInt(Number.MAX_SAFE_INTEGER)) fail('E_PAYLOAD_EVENT');
    active.nextBodyOffset = Math.ceil((e.bodyOffset + e.size) / 512) * 512 + 512;
    const byPath = targets.find(t => t.path === e.path);
    const byIndex = active.selected.find(t => t.index === e.index);
    if (byPath || byIndex) {
      attempt = byPath ?? byIndex;
      if (!byPath || byPath !== byIndex || byPath.role !== active.input.role || e.type !== 'file'
        || e.size !== byPath.size || e.bodyOffset !== byPath.bodyOffset || active.seen.has(byPath.path)) fail('E_PAYLOAD_TARGET');
      active.seen.add(byPath.path); attempt = null;
    }
    active.entries++; entries++;
  }
  function capture(view, start, end) {
    while (active.next < active.selected.length) {
      const target = active.selected[active.next];
      if (target.bodyOffset >= end) break;
      attempt = target;
      const from = Math.max(start, target.bodyOffset), to = Math.min(end, target.bodyOffset + target.size);
      if (to <= from || !active.seen.has(target.path)) fail('E_PAYLOAD_SPAN');
      if (!active.capture) {
        if (from !== target.bodyOffset || target.size > limits.maxPayloadBytes
          || target.size > (target.kind === 'LINKER_TEXT' ? limits.maxTextBytes : limits.maxElfSnapshotBytes)
          || target.size > limits.maxAggregateBytes - capturedBytes) fail('E_PAYLOAD_LIMIT');
        active.capture = { bytes: Buffer.alloc(target.size), used: 0, hash: createHash('sha256') };
        buffersAllocated++; peakPayloadBytes = Math.max(peakPayloadBytes, target.size);
      }
      const c = active.capture;
      if (from !== target.bodyOffset + c.used || to - from > limits.maxAggregateBytes - capturedBytes) fail('E_PAYLOAD_SPAN');
      const part = view.subarray(from - start, to - start);
      c.bytes.set(part, c.used); c.hash.update(part); c.used += to - from; capturedBytes += to - from;
      if (c.used !== target.size) { attempt = null; break; }
      try {
        if (c.hash.digest('hex') !== target.sha256) fail('E_PAYLOAD_BODY_HASH');
        c.hash = null;
        const metadata = inspect(target, c.bytes, limits, elfInspector);
        append(members, { ...target, metadata, roleSatisfied: false, abiVerified: false, qualified: false });
      } finally { wipe(); }
      active.next++; attempt = null;
    }
  }
  function feed(token, chunk) {
    return guarded(() => {
      requireState();
      if (!active || active.token !== token || !active.parser || active.inventory) fail('E_PAYLOAD_STATE');
      const view = chunkView(chunk, limits.maxChunkBytes), start = active.cursor, end = start + view.length;
      if (view.length > limits.maxExpandedBytes - start || view.length > limits.maxBatchExpandedBytes - expandedBytes
        || end > active.expected.expandedBytes) fail('E_PAYLOAD_EXPANDED');
      const events = active.parser.feed(chunk), count = arrayLength(events);
      if (!Object.isFrozen(events) || count > limits.maxEntries - active.entries || count > limits.maxBatchEntries - entries) fail('E_PAYLOAD_ENTRIES');
      for (let i = 0; i < count; i++) validateEvent(events[i], start, end);
      active.hash.update(view); capture(view, start, end);
      active.cursor = end; expandedBytes += view.length;
      return events;
    });
  }
  function finishParser(token) {
    return guarded(() => {
      requireState();
      if (!active || active.token !== token || !active.parser || active.inventory || active.capture) fail('E_PAYLOAD_STATE');
      const inventory = active.parser.finish();
      const p = data(inventory, ['state', 'mockOnly', 'decoderQualified', 'realArchiveInspected', 'extractionAuthorized',
        'pythonFreeSubsetVerified', 'installedUsability', 'rustReady', 'trainingReady', 'nativeQualified', 'provenanceVerified',
        'expandedBytes', 'headers', 'entries', 'extensionBytes', 'outputBytes', 'collisionBytes', 'dataEvents', 'metadataSha256']);
      if (!Object.isFrozen(inventory) || p.state !== 'TAR_INVENTORY' || p.mockOnly !== false
        || p.expandedBytes !== active.cursor || p.entries !== active.entries) fail('E_PAYLOAD_SUMMARY');
      for (const key of ['expandedBytes', 'entries', 'headers', 'metadataSha256']) if (p[key] !== active.expected[key]) fail('E_PAYLOAD_SUMMARY');
      for (const key of ['decoderQualified', 'realArchiveInspected', 'extractionAuthorized', 'pythonFreeSubsetVerified',
        'installedUsability', 'rustReady', 'trainingReady', 'nativeQualified', 'provenanceVerified']) if (p[key] !== false) fail('E_PAYLOAD_SUMMARY');
      for (const [key, cap] of [['headers', 'maxHeaders'], ['extensionBytes', 'maxExtensionBytes'], ['outputBytes', 'maxOutputBytes'],
        ['collisionBytes', 'maxCollisionBytes'], ['dataEvents', 'maxDataEvents']]) {
        if (!Number.isSafeInteger(p[key]) || p[key] < 0 || p[key] > active.parserLimits[cap]) fail('E_PAYLOAD_SUMMARY');
      }
      if (p.headers < p.entries || active.next !== active.selected.length || active.seen.size !== active.selected.length) fail('E_PAYLOAD_SUMMARY');
      const decodedSha256 = active.hash.digest('hex'); active.hash = null;
      if (decodedSha256 !== active.expected.decodedSha256) fail('E_PAYLOAD_DECODED_HASH');
      active.inventory = inventory; active.parser = null;
      return inventory;
    });
  }
  function beginRustPayloadBatch(...args) {
    return guarded(() => { noArgs(args); if (state !== 'IDLE') fail('E_PAYLOAD_STATE'); state = 'ACTIVE'; });
  }
  function beginRustPayloadRole(...args) {
    return guarded(() => {
      requireState();
      if (args.length !== 1 || active || accepted.length >= 5 || args[0] !== RUST_PAYLOAD_ROLES[accepted.length]) fail('E_PAYLOAD_STATE');
      const ordinal = accepted.length, input = inputs[ordinal];
      active = { input, expected: expectations[ordinal], selected: targets.filter(t => t.role === input.role),
        token: Symbol(input.role), factoryUsed: false, parser: null, inventory: null, parserLimits: null,
        hash: createHash('sha256'), capture: null, seen: new Set(), next: 0, cursor: 0, entries: 0, nextBodyOffset: 512 };
    });
  }
  function createTarInventory(...args) {
    return guarded(() => {
      requireState();
      if (args.length > 1 || !active || active.factoryUsed) fail('E_PAYLOAD_STATE');
      const base = { ...INVENTORY_LIMITS, maxExpandedBytes: limits.maxExpandedBytes,
        maxHeaders: limits.maxEntries, maxChunkBytes: limits.maxChunkBytes, maxExtensionBytes: 4_194_304 };
      const parserLimits = lowerLimits(args.length ? args[0] : {}, base);
      const parser = data(parserFactory(parserLimits), ['feed', 'finish']);
      if (typeof parser.feed !== 'function' || typeof parser.finish !== 'function' || types.isProxy(parser.feed) || types.isProxy(parser.finish)) fail('E_PAYLOAD_INPUT');
      active.factoryUsed = true; active.parser = parser; active.parserLimits = parserLimits;
      const token = active.token;
      return Object.freeze({ feed: (...a) => guarded(() => { if (a.length !== 1) fail('E_PAYLOAD_INPUT'); return feed(token, a[0]); }),
        finish: (...a) => guarded(() => { noArgs(a); return finishParser(token); }) });
    });
  }
  function acceptRustPayloadRole(...args) {
    return guarded(() => {
      requireState();
      if (args.length !== 1 || !active?.inventory) fail('E_PAYLOAD_STATE');
      const p = data(args[0]), input = active.input;
      if (p.state !== 'GNU_SDK_DATA_INVENTORY' || p.mockOnly !== mockOnly || p.inventory !== active.inventory
        || p.archiveBytes !== input.archiveBytes || p.archiveSha256 !== input.archiveSha256 || p.archivePasses !== 2
        || p.archiveDataBytes !== input.archiveBytes * 2 || p.archiveRequestedBytes !== input.archiveBytes * 2 + 2
        || p.closeAttempts !== 2 || p.stdinFinished !== true || p.stdoutEnded !== true || p.stderrEnded !== true
        || p.closeObserved !== true || p.exitCode !== 0 || p.signal !== null
        || coreNegativeFlags.some(key => p[key] !== false)) fail('E_PAYLOAD_CORE');
      for (const key of Object.keys(flags)) if (Object.hasOwn(p, key) && p[key] !== false) fail('E_PAYLOAD_CORE');
      const record = { role: input.role, archiveBytes: input.archiveBytes, archiveSha256: input.archiveSha256,
        ...active.expected, inventory: active.inventory, qualified: false, roleSatisfied: false };
      append(accepted, record); active = null;
    });
  }
  function finishRustPayloadBatch(...args) {
    return guarded(() => {
      noArgs(args); requireState();
      if (active || accepted.length !== 5 || members.length !== 13 || capturedBytes !== profile.totalBytes) fail('E_PAYLOAD_STATE');
      for (const member of members) {
        if (member.kind !== 'ELF_EXEC_DSO') continue;
        for (const needed of member.metadata.requirements.dynamic.needed) {
          const providers = members.filter(row => row.domain === member.domain && row.kind === 'ELF_EXEC_DSO'
            && row.metadata.requirements.dynamic.soname === needed).map(row => row.path);
          append(edges, { from: member.path, role: member.role, domain: member.domain, needed,
            declaredProviderNames: providers, status: 'UNRESOLVED', abiVerified: false, providerQualified: false, aliasFollowed: false });
        }
      }
      const result = { profile: 'RUST_PAYLOAD_DATA_INSPECTED', state: 'RUST_PAYLOAD_DATA_INSPECTED', mockOnly,
        interpretation: 'DATA_NOT_EXTRACTION_MEMBER_EXECUTION_OR_HOST_PERMISSION',
        selectionScope: 'EXACT_13_LAYOUT_CANDIDATES_NOT_WHOLE_ARCHIVE_PYTHON_FREE_PROOF',
        expandedBytes, entries, targetCount: 13, capturedBytes, roles: accepted, members, declaredNeededEdges: edges,
        constraints: limits, resourceAccounting: { peakPayloadBytes, buffersAllocated, buffersErased,
          maxAdditionalElfSnapshotBytes: limits.maxElfSnapshotBytes, observationBytes,
          observationAccounting: 'ESCAPED_ASCII_JSON_ROLES_MEMBERS_EDGES_INCLUDING_ARRAY_DELIMITERS',
          outputAccounting: 'ESCAPED_ASCII_JSON_HELPER_RESULT_EXCLUDING_TERMINAL_LF_AND_OPERATION_ENVELOPE',
          hardRssBounded: false, secureStringErasureClaimed: false }, ...flags };
      jsonSize(result, limits.maxOutputBytes, 'E_PAYLOAD_OUTPUT'); freezeTree(result);
      release(); state = 'FINISHED'; return result;
    });
  }
  function abortRustPayloadBatch(...args) {
    return guarded(() => { noArgs(args); release(); if (state !== 'FINISHED' && state !== 'FAILED') state = 'ABORTED'; });
  }
  function getRustPayloadFailure(...args) { return guarded(() => { noArgs(args); return failure; }); }
  function snapshotRustPayloadBatch(...args) {
    return guarded(() => {
      noArgs(args);
      return Object.freeze({ state, mockOnly, acceptedRoles: accepted.length, currentRole: active?.input.role ?? null,
        targetCount: members.length, capturedBytes, expandedBytes, entries, observationBytes: observationBytes === 6 ? 0 : observationBytes,
        activePayloadBytes: active?.capture?.bytes.length ?? 0, buffersAllocated, buffersErased, peakPayloadBytes,
        failureCode: failure?.code ?? null, failureRole: failure?.role ?? null });
    });
  }
  return Object.freeze({ beginRustPayloadBatch, beginRustPayloadRole, createTarInventory, acceptRustPayloadRole,
    finishRustPayloadBatch, abortRustPayloadBatch, getRustPayloadFailure, snapshotRustPayloadBatch });
}

// WHAT: Trusted in-memory, same-five-role, same-thirteen-path, lower-only fixture.
export function createRustPayloadInspectionFixture(profile, parserFactory, elfInspector = inspectElf64RequirementsV5) {
  const p = data(profile, ['mockOnly', 'inputs', 'targets', 'expectations', 'limits']);
  if (p.mockOnly !== true || typeof parserFactory !== 'function' || types.isProxy(parserFactory)
    || typeof elfInspector !== 'function' || types.isProxy(elfInspector)
    || arrayLength(p.inputs, 5) !== 5 || arrayLength(p.targets, 13) !== 13 || arrayLength(p.expectations, 5) !== 5) fail('E_PAYLOAD_INPUT');
  const inputs = p.inputs.map((value, i) => {
    const t = data(value, ['role', 'root', 'file', 'archiveBytes', 'archiveSha256', 'expectedRoot', 'identity']);
    const original = RUST_PAYLOAD_INPUTS[i];
    if (t.role !== original.role || t.expectedRoot !== original.expectedRoot || typeof t.root !== 'string'
      || !t.root.startsWith('/fixture/') || !canonical(t.root.slice(1)) || t.file !== `${t.root}/${t.expectedRoot}.tar.xz`
      || !Number.isSafeInteger(t.archiveBytes) || t.archiveBytes < 1 || t.archiveBytes > original.archiveBytes
      || !digestPattern.test(typeof t.archiveSha256 === 'string' ? t.archiveSha256 : '') || t.archiveSha256 === original.archiveSha256) fail('E_PAYLOAD_INPUT');
    const identity = data(t.identity, ['root', 'file']), captured = {};
    for (const kind of ['root', 'file']) {
      const stat = data(identity[kind], ['dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtimeNs', 'ctimeNs']);
      for (const field of Object.keys(stat)) if (typeof stat[field] !== 'string' || stat[field].length > 40 || !/^(?:0|[1-9][0-9]*)$/u.test(stat[field])) fail('E_PAYLOAD_INPUT');
      if (stat.uid !== '1000' || stat.gid !== '1000' || stat.ino === '0' || stat.mode !== (kind === 'root' ? '16832' : '33152')
        || stat.nlink !== (kind === 'root' ? '2' : '1') || kind === 'file' && stat.size !== String(t.archiveBytes)) fail('E_PAYLOAD_INPUT');
      captured[kind] = Object.freeze(stat);
    }
    return Object.freeze({ ...t, identity: Object.freeze(captured) });
  });
  const targets = p.targets.map((value, i) => {
    const t = data(value, ['role', 'path', 'index', 'bodyOffset', 'size', 'sha256', 'kind', 'domain']), original = RUST_PAYLOAD_TARGETS[i];
    for (const key of ['role', 'path', 'kind', 'domain']) if (t[key] !== original[key]) fail('E_PAYLOAD_TARGET');
    for (const key of ['index', 'bodyOffset', 'size']) {
      if (!Number.isSafeInteger(t[key]) || t[key] < 1) fail('E_PAYLOAD_INPUT');
      if (t[key] > original[key]) fail('E_PAYLOAD_LIMIT');
    }
    if (t.sha256 === original.sha256) fail('E_PAYLOAD_INPUT');
    return Object.freeze(t);
  });
  const expectations = p.expectations.map((value, i) => {
    const e = data(value, ['role', 'expandedBytes', 'entries', 'headers', 'metadataSha256', 'decodedSha256']);
    for (const key of ['expandedBytes', 'entries', 'headers']) if (!Number.isSafeInteger(e[key]) || e[key] < 1) fail('E_PAYLOAD_INPUT');
    if (e.role !== RUST_PAYLOAD_ROLES[i] || e.decodedSha256 === RUST_PAYLOAD_EXPECTATIONS[i].decodedSha256
      || e.metadataSha256 === RUST_PAYLOAD_EXPECTATIONS[i].metadataSha256 || e.expandedBytes > 1_048_576) fail('E_PAYLOAD_INPUT');
    return Object.freeze(e);
  });
  return collector(makeProfile(Object.freeze(inputs), Object.freeze(targets), Object.freeze(expectations),
    lowerLimits(p.limits, RUST_PAYLOAD_LIMITS), true), parserFactory, elfInspector);
}
const production = collector(makeProfile(RUST_PAYLOAD_INPUTS, RUST_PAYLOAD_TARGETS, RUST_PAYLOAD_EXPECTATIONS,
  RUST_PAYLOAD_LIMITS, false), originalCreateTarInventory, inspectElf64RequirementsV5);
export const beginRustPayloadBatch = production.beginRustPayloadBatch;
export const beginRustPayloadRole = production.beginRustPayloadRole;
export const createTarInventory = production.createTarInventory;
export const acceptRustPayloadRole = production.acceptRustPayloadRole;
export const finishRustPayloadBatch = production.finishRustPayloadBatch;
export const abortRustPayloadBatch = production.abortRustPayloadBatch;
export const getRustPayloadFailure = production.getRustPayloadFailure;
export const snapshotRustPayloadBatch = production.snapshotRustPayloadBatch;
