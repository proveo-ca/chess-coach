// SPEC: _spec/tooling/native-ingress/gnu-sdk-subset-catalog.puml
import { createTarMemberInventory } from './tar-inventory.mjs';
import { createHash } from 'node:crypto';
import { types } from 'node:util';

export const SDK_CATALOG_ROOT = 'x86-64--glibc--stable-2026.08-1';
export const SDK_CATALOG_DECODED_SHA256 = '5e7f960281fb93121982f95976eb59ed980e009b54aabf993d5d3fa2982e056f';
export const SDK_CATALOG_EXPECTATION = Object.freeze({ expandedBytes: 505333760, headers: 10181,
  entries: 8412, extensionBytes: 193768, outputBytes: 1812885, collisionBytes: 783392, dataEvents: 7711,
  metadataSha256: 'efe53c8fda0b0f1e8b8ba6b7868707a88f33aa26b5692b9c76dc0e6da694d901' });
export const SDK_CATALOG_LIMITS = Object.freeze({ maxMetadataBytes: 4194304, maxSpanBytes: 4194304,
  maxCoreBytes: 4194304, maxCandidates: 512, maxSelectedBytes: 1048576, maxOutputBytes: 2097152 });
const target = 'x86_64-buildroot-linux-gnu', version = '15\\.3\\.0';
const root = SDK_CATALOG_ROOT, summaryKeys = Object.keys(SDK_CATALOG_EXPECTATION);
const so = '(?:ld-linux-x86-64\\.so\\.2|ld-[0-9]+(?:\\.[0-9]+)*\\.so|(?:libc|libm|libpthread|libdl|librt|libresolv|libgcc_s|libstdc\\+\\+|libgmp|libmpfr|libmpc|libisl|libz|libzstd|libexpat|libncurses|libncursesw|libtinfo)\\.so(?:\\.[0-9]+)*|(?:libbfd|libopcodes|libsframe)(?:-[0-9A-Za-z_.-]+)?\\.so(?:\\.[0-9]+)*)';
const selectors = [];
const add = (role, path, optionalForMinimalNoPython = false) => selectors.push(Object.freeze({ role,
  pattern: new RegExp('^' + root.replaceAll('.', '\\.') + '/' + path + '$', 'u'), optionalForMinimalNoPython }));
add('TOOLCHAIN_WRAPPER', 'bin/toolchain-wrapper');
add('COMPILER_DRIVER', 'bin/(?:' + target + '-(?:cc|gcc|gcc-' + version + '|g\\+\\+|cpp)|cc|gcc)(?:\\.br_real)?');
for (const name of ['as', 'ld', 'ld.bfd', 'ar', 'ranlib', 'nm', 'strip', 'objcopy', 'objdump']) {
  add('BINUTILS_' + name.toUpperCase().replaceAll('.', '_'), '(?:bin/' + target + '-|' + target + '/bin/)' + name.replaceAll('.', '\\.'));
}
for (const name of ['cc1', 'cc1plus', 'collect2', 'lto1', 'lto-wrapper']) {
  add('GCC_' + name.toUpperCase().replaceAll('-', '_'), 'libexec/gcc/' + target + '/' + version + '/' + name, ['cc1plus', 'lto1', 'lto-wrapper'].includes(name));
}
add('HOST_LIBRARY_DIRECTORY', '(?:lib|lib64)');
add('HOST_RUNTIME_PROVIDER', '(?:lib|lib64)/' + so);
const targetDirs = target + '/(?:(?:sysroot/)?(?:lib|lib64)|sysroot/usr/(?:lib|lib64))';
add('TARGET_LIBRARY_DIRECTORY', targetDirs);
add('TARGET_LINK_INPUT', targetDirs + '/(?:' + so + '|(?:crt1|Scrt1|rcrt1|crti|crtn)\\.o|libc(?:_nonshared)?\\.a|(?:libm|libpthread|libdl|librt|libgcc|libgcc_eh)\\.a)');
const gccDir = 'lib/gcc/' + target + '/' + version;
const gccInputs = '(?:(?:crtbegin|crtend)(?:S|T)?\\.o|libgcc(?:_eh)?\\.a|libgcc_s\\.so(?:\\.[0-9]+)*)';
add('GCC_PRIVATE_LINK_INPUT', gccDir + '/' + gccInputs);
add('TARGET_LINK_INPUT', gccDir + '/' + gccInputs);
add('GCC_LTO_PLUGIN', '(?:' + gccDir + '|libexec/gcc/' + target + '/' + version + ')/liblto_plugin\\.so(?:\\.[0-9]+)*', true);
add('GCC_SPECS_TEXT', gccDir + '/specs');
const roles = Object.freeze([...new Set(selectors.map(value => value.role))]);
const flags = Object.freeze({ relocationReady: false, pythonFreeSubsetVerified: false, installedUsability: false,
  rustReady: false, nativeQualified: false, nativeAuthority: false, trainingReady: false, extractionAuthorized: false });
const fail = code => { const error = new Error(code); error.code = code; throw Object.freeze(error); };
function object(value) {
  if (!value || typeof value !== 'object' || types.isProxy(value)) fail('E_INPUT');
  const proto = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && proto !== Object.prototype && proto !== null) fail('E_INPUT');
}
function own(value, key, required = true) {
  object(value);
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor) { if (required) fail('E_INPUT'); return undefined; }
  if (!Object.hasOwn(descriptor, 'value')) fail('E_INPUT');
  return descriptor.value;
}
function items(value, max) {
  object(value); if (!Array.isArray(value)) fail('E_INPUT');
  const length = own(value, 'length');
  if (length > max || Reflect.ownKeys(value).length !== length + 1) fail('E_INPUT');
  return Array.from({ length }, (_, i) => own(value, String(i)));
}
function data(value, depth = 0) {
  if (value === null || ['string', 'boolean'].includes(typeof value)) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (depth >= 16) fail('E_INPUT');
  object(value);
  if (Array.isArray(value)) return items(value, 100000).map(item => data(item, depth + 1));
  const result = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') fail('E_INPUT');
    result[key] = data(own(value, key), depth + 1);
  }
  return result;
}
const ascii = text => text.replace(/[^\x00-\x7f]/g, ch => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'));
function bound(value, max) {
  const json = JSON.stringify(data(value));
  if (Buffer.byteLength(json) > max || Buffer.byteLength(ascii(json)) > max) fail('E_OUTPUT');
}
function canonical(path) {
  if (typeof path !== 'string' || !path || Buffer.byteLength(path) > 1024 || /[\u0000-\u001f\u007f-\u009f\\]/u.test(path) ||
    !(path === root || path.startsWith(root + '/')) || path.split('/').some(part => !part || part === '.' || part === '..')) fail('E_INPUT');
}
function entry(value) {
  object(value); if (Array.isArray(value)) fail('E_INPUT');
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') fail('E_INPUT');
    own(value, key);
  }
  const index = own(value, 'index'), path = own(value, 'path'), type = own(value, 'type'), size = own(value, 'size');
  canonical(path);
  if (!Number.isSafeInteger(index) || index < 1 || index > 8412 || !['file', 'directory', 'symlink', 'hardlink'].includes(type) ||
    !Number.isSafeInteger(size) || size < 0 || size > 505333760 || (type !== 'file' && size !== 0)) fail('E_INPUT');
  const linkpath = own(value, 'linkpath', false), linkKind = own(value, 'linkKind', false);
  if (type === 'symlink' || type === 'hardlink') {
    if (typeof linkpath !== 'string' || !linkpath || Buffer.byteLength(linkpath) > 1024 || /[\u0000-\u001f\u007f-\u009f\\]/u.test(linkpath) ||
      !['relative', 'absolute', 'parent-components'].includes(linkKind)) fail('E_INPUT');
  } else if (linkpath !== undefined || linkKind !== undefined) fail('E_INPUT');
  return Object.freeze({ index, path, type, size, link: linkpath ?? null });
}
const typed = Object.getPrototypeOf(Uint8Array.prototype);
const lengthOf = Object.getOwnPropertyDescriptor(typed, 'length').get;
const bufferOf = Object.getOwnPropertyDescriptor(typed, 'buffer').get;
const offsetOf = Object.getOwnPropertyDescriptor(typed, 'byteOffset').get;
const resizable = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
function inputView(bytes) {
  if (types.isProxy(bytes) || !types.isUint8Array(bytes)) fail('E_INPUT');
  const length = lengthOf.call(bytes), buffer = bufferOf.call(bytes);
  if (!length || length > 65536 || types.isSharedArrayBuffer(buffer) || (resizable && resizable.call(buffer))) fail('E_INPUT');
  return new Uint8Array(buffer, offsetOf.call(bytes), length);
}
function catalog(profile) {
  let phase = 'idle', pending = null, accepted = false, factoryCalls = 0, cursor = 0, metadataBytes = 2;
  let hash = null;
  const entries = new Map(), spans = new Map();
  function abortCatalog() { entries.clear(); spans.clear(); pending = null; hash = null; accepted = false; phase = 'failed'; }
  function guarded(fn) { try { return fn(); } catch (error) { abortCatalog(); throw error; } }
  function summary(value) {
    if (own(value, 'state') !== 'TAR_MEMBER_INVENTORY' || !summaryKeys.every(key => own(value, key) === profile.expected[key])) fail('E_SUMMARY');
  }
  function completeSpans(value) {
    const all = items(own(value, 'fileSpans'), profile.expected.entries);
    let previousIndex = 0, previousEnd = 0, spanBytes = 2;
    for (const value of all) {
      object(value); if (Reflect.ownKeys(value).length !== 4) fail('E_SPAN');
      const span = Object.freeze(Object.fromEntries(['index', 'path', 'bodyOffset', 'size'].map(key => [key, own(value, key)])));
      const record = entries.get(span.path);
      if (!record || record.type !== 'file' || span.index !== record.index || span.size !== record.size || spans.has(span.path) ||
        span.index <= previousIndex || !Number.isSafeInteger(span.bodyOffset) || span.bodyOffset < 512 || span.bodyOffset < previousEnd ||
        span.bodyOffset > profile.expected.expandedBytes || span.size > profile.expected.expandedBytes - span.bodyOffset) fail('E_SPAN');
      spanBytes += Buffer.byteLength(JSON.stringify(span)) + (spans.size ? 1 : 0);
      if (spanBytes > profile.limits.maxSpanBytes) fail('E_OUTPUT');
      spans.set(span.path, span); previousIndex = span.index; previousEnd = span.bodyOffset + span.size;
    }
    if (spans.size !== profile.regularFileCount || [...entries.values()].some(value => (value.type === 'file') !== spans.has(value.path))) fail('E_SPAN');
  }
  return Object.freeze({
    beginCatalogPass() { return guarded(() => { if (phase !== 'idle') fail('E_PHASE'); hash = createHash('sha256'); phase = 'configured'; }); },
    createTarInventory(overrides = {}) { return guarded(() => {
      if (phase !== 'configured' || factoryCalls !== 0) fail('E_PHASE');
      const parser = createTarMemberInventory(overrides, profile.limits.maxSpanBytes); factoryCalls++; phase = 'running';
      return Object.freeze({
        feed(bytes) { return guarded(() => {
          if (phase !== 'running') fail('E_PHASE');
          const input = inputView(bytes);
          if (input.length > profile.expected.expandedBytes - cursor) fail('E_LENGTH');
          const events = parser.feed(bytes);
          for (const value of items(events, profile.expected.entries - entries.size)) {
            const record = entry(value);
            if (record.index !== entries.size + 1 || entries.has(record.path)) fail('E_INPUT');
            const cost = Buffer.byteLength(JSON.stringify([record.path, record])) + (entries.size ? 1 : 0);
            if (cost > profile.limits.maxMetadataBytes - metadataBytes) fail('E_OUTPUT');
            entries.set(record.path, record); metadataBytes += cost;
          }
          hash.update(input); cursor += input.length; return events;
        }); },
        finish() { return guarded(() => {
          if (phase !== 'running') fail('E_PHASE');
          const result = parser.finish(); summary(result);
          if (cursor !== profile.expected.expandedBytes || entries.size !== profile.expected.entries) fail('E_LENGTH');
          bound(result, profile.limits.maxCoreBytes); completeSpans(result);
          if (hash.digest('hex') !== profile.digest) fail('E_HASH');
          hash = null; pending = result; phase = 'complete'; return result;
        }); },
      });
    }); },
    acceptCatalogPass(result) { return guarded(() => {
      if (phase !== 'complete' || accepted || entries.size !== profile.expected.entries) fail('E_PHASE');
      const fields = ['state', 'mockOnly', 'inventory', 'archiveBytes', 'archiveSha256', 'archivePasses', 'archiveDataBytes', 'archiveRequestedBytes',
        'closeAttempts', 'stdinFinished', 'stdoutEnded', 'stderrEnded', 'closeObserved', 'exitCode', 'signal', 'extracted', 'nativeQualified', 'pythonFreeSubsetVerified'];
      const r = Object.fromEntries(fields.map(key => [key, own(result, key)]));
      if (r.inventory !== pending || r.state !== 'GNU_SDK_DATA_INVENTORY' || r.mockOnly !== profile.mockOnly || r.archivePasses !== 2 || r.closeAttempts !== 2 ||
        r.exitCode !== 0 || r.signal !== null || !['stdinFinished', 'stdoutEnded', 'stderrEnded', 'closeObserved'].every(key => r[key] === true) ||
        ['extracted', 'nativeQualified', 'pythonFreeSubsetVerified'].some(key => r[key] !== false) ||
        (!profile.mockOnly && (r.archiveBytes !== 102296280 || r.archiveSha256 !== 'cde893afab04ac7dcd15c46aac214ff550441b982536124c88a71146a0eeedd3' ||
          r.archiveDataBytes !== 204592560 || r.archiveRequestedBytes !== 204592562))) fail('E_RECEIPT');
      bound(result, profile.limits.maxCoreBytes); accepted = true;
    }); },
    getCatalogData() { return guarded(() => {
      if (phase !== 'complete' || !accepted || entries.size !== profile.expected.entries) fail('E_PHASE');
      const candidates = [], observations = new Map(roles.map(role => [role, []]));
      for (const record of entries.values()) {
        const matchedRoles = [...new Set(selectors.filter(selector => selector.pattern.test(record.path)).map(selector => selector.role))];
        if (!matchedRoles.length) continue;
        if (candidates.length >= profile.limits.maxCandidates) fail('E_OUTPUT');
        const row = Object.freeze({ ...record, regularSpan: spans.get(record.path) ?? null, matchedRoles: Object.freeze(matchedRoles) });
        candidates.push(row); for (const role of matchedRoles) observations.get(role).push(record.index);
      }
      bound(candidates, profile.limits.maxSelectedBytes);
      const roleObservations = Object.freeze(roles.map(role => Object.freeze({ role,
        status: observations.get(role).length ? 'CANDIDATES_PRESENT' : 'NO_CANDIDATE_MATCH',
        candidateIndices: Object.freeze(observations.get(role)),
        optionalForMinimalNoPython: selectors.filter(value => value.role === role).every(value => value.optionalForMinimalNoPython),
        roleSatisfied: false })));
      const result = Object.freeze({ state: 'SUBSET_CANDIDATE_CATALOG', mockOnly: profile.mockOnly, namespaceComplete: true,
        namespaceEntryCount: entries.size, regularFileCount: spans.size, decodedSha256: profile.digest,
        interpretation: 'DATA_NOT_MEMBER_SELECTION_OR_PERMISSION', sourceProfile: 'CANDIDATE_PRESENCE_NOT_ROLE_FULFILLMENT',
        candidates: Object.freeze(candidates), roleObservations, ...flags });
      bound(result, profile.limits.maxOutputBytes);
      entries.clear(); spans.clear(); pending = null; accepted = false; phase = 'released'; return result;
    }); },
    snapshot() { return Object.freeze({ phase, factoryCalls, accepted, retainedEntries: entries.size, retainedSpans: spans.size, metadataBytes }); },
    abortCatalog,
  });
}

// WHAT: Lower-only, in-memory fixture profile with an independently supplied synthetic digest.
export function createSdkSubsetCatalogFixture(value) {
  object(value);
  const expectedValue = own(value, 'expectedSummary'), expected = Object.create(null);
  object(expectedValue);
  if (Reflect.ownKeys(value).length !== 4 || Reflect.ownKeys(expectedValue).length !== summaryKeys.length) fail('E_INPUT');
  for (const key of summaryKeys) {
    const v = own(expectedValue, key);
    if (key === 'metadataSha256' ? typeof v !== 'string' || !/^[0-9a-f]{64}$/u.test(v) : !Number.isSafeInteger(v) || v < 0 || v > SDK_CATALOG_EXPECTATION[key]) fail('E_INPUT');
    expected[key] = v;
  }
  const digest = own(value, 'expectedDecodedSha256'), regularFileCount = own(value, 'regularFileCount'), overrides = own(value, 'limits');
  if (expected.expandedBytes < 1 || expected.expandedBytes > 1048576 || typeof digest !== 'string' || !/^[0-9a-f]{64}$/u.test(digest) ||
    !Number.isSafeInteger(regularFileCount) || regularFileCount < 0 || regularFileCount > Math.min(6891, expected.entries)) fail('E_INPUT');
  object(overrides); const limits = { ...SDK_CATALOG_LIMITS };
  for (const key of Reflect.ownKeys(overrides)) {
    const v = own(overrides, key);
    if (!Object.hasOwn(limits, key) || !Number.isSafeInteger(v) || v < 1 || v > limits[key]) fail('E_INPUT');
    limits[key] = v;
  }
  return catalog(Object.freeze({ expected: Object.freeze(expected), digest, regularFileCount, limits: Object.freeze(limits), mockOnly: true }));
}
const registered = catalog(Object.freeze({ expected: SDK_CATALOG_EXPECTATION, digest: SDK_CATALOG_DECODED_SHA256,
  regularFileCount: 6891, limits: SDK_CATALOG_LIMITS, mockOnly: false }));
export const beginCatalogPass = () => registered.beginCatalogPass();
export const createTarInventory = overrides => registered.createTarInventory(overrides);
export const acceptCatalogPass = value => registered.acceptCatalogPass(value);
export const getCatalogData = () => registered.getCatalogData();
export const snapshotCatalog = () => registered.snapshot();
export const abortCatalog = () => registered.abortCatalog();
