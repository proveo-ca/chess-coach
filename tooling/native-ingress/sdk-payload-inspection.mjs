// SPEC: _spec/tooling/native-ingress/step2.puml
import { createTarInventory as originalCreateTarInventory } from './tar-inventory.mjs';
import { inspectElf64RequirementsV3 } from './elf-requirements-v3.mjs';
import { createHash } from 'node:crypto';
import { types } from 'node:util';

export const SDK_PAYLOAD_ROOT = 'x86-64--glibc--stable-2026.08-1';
export const SDK_PAYLOAD_DECODED_SHA256 = '5e7f960281fb93121982f95976eb59ed980e009b54aabf993d5d3fa2982e056f';
export const SDK_PAYLOAD_EXPECTATION = Object.freeze({ expandedBytes: 505333760, headers: 10181,
  entries: 8412, extensionBytes: 193768, outputBytes: 1812885, collisionBytes: 783392, dataEvents: 7711,
  metadataSha256: 'efe53c8fda0b0f1e8b8ba6b7868707a88f33aa26b5692b9c76dc0e6da694d901' });
export const SDK_PAYLOAD_LIMITS = Object.freeze({ maxPayloadBytes: 67108864, maxElfSnapshotBytes: 67108864,
  maxTextBytes: 1048576, maxArBytes: 8388608, maxAggregateBytes: 268435456,
  maxObservationBytes: 4194304, maxCoreBytes: 4194304, maxOutputBytes: 2097152 });
export const SDK_PAYLOAD_TARGETS = Object.freeze([
  ['bin/toolchain-wrapper',10,52593664,14704,'ELF_EXEC_DSO','HOST_TOOLCHAIN_WRAPPER','HOST',false],
  ['bin/x86_64-buildroot-linux-gnu-gcc-15.3.0.br_real',29,61895680,2349760,'ELF_EXEC_DSO','HOST_COMPILER_DRIVER','HOST',false],
  ['bin/x86_64-buildroot-linux-gnu-ar',12,54300160,1501128,'ELF_EXEC_DSO','HOST_ARCHIVER','HOST',false],
  ['bin/x86_64-buildroot-linux-gnu-ld',26,57344512,3009296,'ELF_EXEC_DSO','HOST_LINKER','HOST',false],
  ['bin/x86_64-buildroot-linux-gnu-ranlib',47,84785664,1488240,'ELF_EXEC_DSO','HOST_RANLIB','HOST',false],
  ['bin/x86_64-buildroot-linux-gnu-as',54,89146368,2315552,'ELF_EXEC_DSO','HOST_ASSEMBLER','HOST',false],
  ['libexec/gcc/x86_64-buildroot-linux-gnu/15.3.0/liblto_plugin.so',84,96312320,105704,'ELF_EXEC_DSO','HOST_OPTIONAL_LTO_PLUGIN','HOST',true],
  ['libexec/gcc/x86_64-buildroot-linux-gnu/15.3.0/lto1',85,96418816,47221664,'ELF_EXEC_DSO','HOST_OPTIONAL_LTO_COMPILER','HOST',true],
  ['libexec/gcc/x86_64-buildroot-linux-gnu/15.3.0/cc1plus',86,143641088,51506040,'ELF_EXEC_DSO','HOST_OPTIONAL_CXX_COMPILER','HOST',true],
  ['libexec/gcc/x86_64-buildroot-linux-gnu/15.3.0/collect2',87,195147776,1469208,'ELF_EXEC_DSO','HOST_COLLECT2','HOST',false],
  ['libexec/gcc/x86_64-buildroot-linux-gnu/15.3.0/lto-wrapper',93,196962304,2264120,'ELF_EXEC_DSO','HOST_OPTIONAL_LTO_WRAPPER','HOST',true],
  ['libexec/gcc/x86_64-buildroot-linux-gnu/15.3.0/cc1',95,199229440,48824928,'ELF_EXEC_DSO','HOST_C_COMPILER','HOST',false],
  ['x86_64-buildroot-linux-gnu/bin/ar',307,274525696,1501128,'ELF_EXEC_DSO','HOST_TARGET_ARCHIVER','HOST',false],
  ['x86_64-buildroot-linux-gnu/bin/ld',308,276027392,3009296,'ELF_EXEC_DSO','HOST_TARGET_LINKER','HOST',false],
  ['x86_64-buildroot-linux-gnu/bin/as',311,282148864,2315552,'ELF_EXEC_DSO','HOST_TARGET_ASSEMBLER','HOST',false],
  ['x86_64-buildroot-linux-gnu/sysroot/usr/lib/rcrt1.o',4127,349121536,2104,'ET_REL','TARGET_CRT_RCRT1','TARGET',false],
  ['x86_64-buildroot-linux-gnu/sysroot/usr/lib/crtn.o',4144,349262848,784,'ET_REL','TARGET_CRT_CRTN','TARGET',false],
  ['x86_64-buildroot-linux-gnu/sysroot/usr/lib/libc.so',4148,349748224,253,'LINKER_TEXT','TARGET_LIBC_LINK_SCRIPT','TARGET',false],
  ['x86_64-buildroot-linux-gnu/sysroot/usr/lib/libc_nonshared.a',4154,358256128,6274,'AR','TARGET_LIBC_NONSHARED_ARCHIVE','TARGET',false],
  ['x86_64-buildroot-linux-gnu/sysroot/usr/lib/crt1.o',4163,359263232,2432,'ET_REL','TARGET_CRT_CRT1','TARGET',false],
  ['x86_64-buildroot-linux-gnu/sysroot/usr/lib/crti.o',4166,359268352,1200,'ET_REL','TARGET_CRT_CRTI','TARGET',false],
  ['x86_64-buildroot-linux-gnu/sysroot/usr/lib/Scrt1.o',4444,372030976,2104,'ET_REL','TARGET_CRT_SCRT1','TARGET',false],
  ['x86_64-buildroot-linux-gnu/sysroot/usr/lib/libm.so',4448,372037120,110,'LINKER_TEXT','TARGET_LIBM_LINK_SCRIPT','TARGET',false],
  ['x86_64-buildroot-linux-gnu/sysroot/usr/lib/libc.a',4456,372434432,6334062,'AR','TARGET_LIBC_ARCHIVE','TARGET',false],
  ['x86_64-buildroot-linux-gnu/sysroot/lib/libm.so.6',5971,389391872,1412648,'ELF_EXEC_DSO','TARGET_LIBM_PROVIDER','TARGET',false],
  ['x86_64-buildroot-linux-gnu/sysroot/lib/libdl.so.2',5972,390805504,15784,'ELF_EXEC_DSO','TARGET_LIBDL_PROVIDER','TARGET',false],
  ['x86_64-buildroot-linux-gnu/sysroot/lib/libpthread.so.0',5977,392000000,16640,'ELF_EXEC_DSO','TARGET_LIBPTHREAD_PROVIDER','TARGET',false],
  ['x86_64-buildroot-linux-gnu/sysroot/lib/librt.so.1',5980,392103936,16480,'ELF_EXEC_DSO','TARGET_LIBRT_PROVIDER','TARGET',false],
  ['x86_64-buildroot-linux-gnu/sysroot/lib/libc.so.6',5982,392137216,2465144,'ELF_EXEC_DSO','TARGET_LIBC_PROVIDER','TARGET',false],
  ['x86_64-buildroot-linux-gnu/sysroot/lib/ld-linux-x86-64.so.2',5983,394603008,271544,'ELF_EXEC_DSO','TARGET_LOADER_PROVIDER','TARGET',false],
  ['x86_64-buildroot-linux-gnu/sysroot/lib/libgcc_s.so',5985,394875904,132,'LINKER_TEXT','TARGET_LIBGCC_LINK_SCRIPT','TARGET',false],
  ['x86_64-buildroot-linux-gnu/sysroot/lib/libgcc_s.so.1',5993,395318784,904616,'ELF_EXEC_DSO','TARGET_LIBGCC_PROVIDER','TARGET',false],
  ['lib/libz.so.1.3.2',6899,411889664,110232,'ELF_EXEC_DSO','HOST_LIBZ_PROVIDER','HOST',false],
  ['lib/libmpfr.so.6.2.2',6900,412000768,777664,'ELF_EXEC_DSO','HOST_LIBMPFR_PROVIDER','HOST',false],
  ['lib/libexpat.so.1.12.4',6905,413210624,222744,'ELF_EXEC_DSO','HOST_LIBEXPAT_PROVIDER','HOST',false],
  ['lib/libncursesw.so.6.6',6908,451882496,530864,'ELF_EXEC_DSO','HOST_LIBNCURSESW_PROVIDER','HOST',false],
  ['lib/libmpc.so.3.4.1',6909,452413952,156168,'ELF_EXEC_DSO','HOST_LIBMPC_PROVIDER','HOST',false],
  ['lib/libgmp.so.10.5.0',7608,486219776,541904,'ELF_EXEC_DSO','HOST_LIBGMP_PROVIDER','HOST',false],
  ['lib/gcc/x86_64-buildroot-linux-gnu/15.3.0/crtbegin.o',8208,500116992,2496,'ET_REL','TARGET_GCC_CRTBEGIN','TARGET',false],
  ['lib/gcc/x86_64-buildroot-linux-gnu/15.3.0/libgcc_eh.a',8209,500120064,342074,'AR','TARGET_GCC_EH_ARCHIVE','TARGET',false],
  ['lib/gcc/x86_64-buildroot-linux-gnu/15.3.0/crtbeginS.o',8212,500472320,2800,'ET_REL','TARGET_GCC_CRTBEGINS','TARGET',false],
  ['lib/gcc/x86_64-buildroot-linux-gnu/15.3.0/crtend.o',8221,500492800,1216,'ET_REL','TARGET_GCC_CRTEND','TARGET',false],
  ['lib/gcc/x86_64-buildroot-linux-gnu/15.3.0/libgcc.a',8375,503557632,1244128,'AR','TARGET_GCC_ARCHIVE','TARGET',false],
  ['lib/gcc/x86_64-buildroot-linux-gnu/15.3.0/crtendS.o',8376,504802304,1216,'ET_REL','TARGET_GCC_CRTENDS','TARGET',false],
  ['lib/gcc/x86_64-buildroot-linux-gnu/15.3.0/crtbeginT.o',8377,504804352,3000,'ET_REL','TARGET_GCC_CRTBEGINT','TARGET',false],
].map(([path,index,bodyOffset,size,kind,role,domain,optionalForMinimalC]) => Object.freeze({
  path,index,bodyOffset,size,kind,role,domain,optionalForMinimalC,
})));

const flags = Object.freeze({ installedUsability: false, nativeQualified: false, nativeAuthority: false,
  relocationReady: false, pythonFreeSubsetVerified: false, trainingReady: false, rustReady: false,
  extractionAuthorized: false, roleSatisfied: false, provenanceVerified: false, loaderClosureVerified: false });
const fail = code => { const error = new Error(code); error.code = code; throw Object.freeze(error); };
const elfFailureCodes = new Set(['E_INPUT', 'E_LIMITS', 'E_ELF', 'E_RANGE', 'E_PROGRAM_HEADERS',
  'E_INTERPRETER', 'E_DYNAMIC', 'E_STRING_TABLE', 'E_STRING', 'E_OUTPUT', 'E_VERSIONS', 'E_NOTES', 'E_PROPERTIES']);
const parserFailureCodes = new Set(['E_ELF', 'E_REL', 'E_REL_UNSUPPORTED', 'E_AR', 'E_AR_UNSUPPORTED',
  'E_LINKER_TEXT', 'E_LINKER_UNSUPPORTED', 'E_LIMIT', 'E_KIND']);
function fixedOwnCode(error, key, allowed) {
  if (!error || !['object', 'function'].includes(typeof error) || types.isProxy(error)) return null;
  const descriptor = Object.getOwnPropertyDescriptor(error, key);
  return descriptor && Object.hasOwn(descriptor, 'value') && typeof descriptor.value === 'string' && allowed.has(descriptor.value) ? descriptor.value : null;
}
function elfFailure(error) {
  const failure = new Error('E_ELF'); failure.code = 'E_ELF';
  Object.defineProperty(failure, 'underlyingCode', { value: fixedOwnCode(error, 'code', elfFailureCodes) });
  throw Object.freeze(failure);
}
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const ascii = text => text.replace(/[^\x00-\x7f]/g, ch => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'));
function freeze(value) {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
function object(value) {
  if (!value || typeof value !== 'object' || types.isProxy(value)) fail('E_INPUT');
  const proto = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && proto !== Object.prototype && proto !== null) fail('E_INPUT');
}
function own(value, key) {
  object(value); const d = Object.getOwnPropertyDescriptor(value, key);
  if (!d || !Object.hasOwn(d, 'value')) fail('E_INPUT');
  return d.value;
}
function array(value, max) {
  object(value); if (!Array.isArray(value)) fail('E_INPUT');
  const n = own(value, 'length');
  if (n > max || Reflect.ownKeys(value).length !== n + 1) fail('E_INPUT');
  return Array.from({ length: n }, (_, i) => own(value, String(i)));
}
function bound(value, max) {
  let nodes = 0, cost = 0;
  function visit(v, depth) {
    if (++nodes > 200000 || depth > 32) fail('E_OUTPUT');
    if (v === null || typeof v === 'boolean') cost += 5;
    else if (typeof v === 'number' && Number.isFinite(v)) cost += 24;
    else if (typeof v === 'string') cost += v.length + 2;
    else {
      object(v); const keys = Reflect.ownKeys(v);
      if (keys.length > 100000) fail('E_OUTPUT');
      for (const key of keys) {
        if (typeof key !== 'string') fail('E_INPUT');
        if (Array.isArray(v) && key === 'length') continue;
        cost += key.length + 3; visit(own(v, key), depth + 1);
      }
    }
    if (cost > max * 8) fail('E_OUTPUT');
  }
  visit(value, 0);
  if (Buffer.byteLength(ascii(JSON.stringify(value))) > max) fail('E_OUTPUT');
}
const typed = Object.getPrototypeOf(Uint8Array.prototype);
const lengthOf = Object.getOwnPropertyDescriptor(typed, 'length').get;
const bufferOf = Object.getOwnPropertyDescriptor(typed, 'buffer').get;
const offsetOf = Object.getOwnPropertyDescriptor(typed, 'byteOffset').get;
const resizable = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
function input(bytes) {
  if (types.isProxy(bytes) || !types.isUint8Array(bytes) || ![Uint8Array.prototype, Buffer.prototype].includes(Object.getPrototypeOf(bytes))) fail('E_INPUT');
  const n = lengthOf.call(bytes), backing = bufferOf.call(bytes);
  if (!n || n > 65536 || types.isSharedArrayBuffer(backing) || (resizable && resizable.call(backing))) fail('E_INPUT');
  return Buffer.from(backing, offsetOf.call(bytes), n);
}
function rel(bytes) {
  if (bytes.length < 64) fail('E_REL');
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.length), u16 = at => v.getUint16(at, true);
  const u32 = at => v.getUint32(at, true), u64 = at => v.getBigUint64(at, true), length = BigInt(bytes.length);
  if (bytes[0] !== 127 || bytes[1] !== 69 || bytes[2] !== 76 || bytes[3] !== 70 || bytes[4] !== 2 || bytes[5] !== 1 || bytes[6] !== 1 ||
    u16(16) !== 1 || u16(18) !== 62 || u32(20) !== 1 || u16(52) !== 64) fail('E_REL');
  if (u16(56) !== 0 || u64(32) !== 0n) fail('E_REL_UNSUPPORTED');
  const count = u16(60), strings = u16(62), offset = u64(40);
  if (!count || count > 4096 || strings === 65535 || strings >= count || u16(58) !== 64 || offset < 64n ||
    offset > length || BigInt(count) * 64n > length - offset) fail('E_REL');
  let nobits = 0;
  const metadata = createHash('sha256');
  for (let i = 0; i < count; i++) {
    const at = Number(offset) + i * 64, type = u32(at + 4), address = u64(at + 16), start = u64(at + 24), size = u64(at + 32), alignment = u64(at + 48);
    if (address + size > (1n << 64n) || (alignment > 1n && (alignment & (alignment - 1n)) !== 0n) || u32(at + 40) >= count) fail('E_REL');
    if (type === 8) nobits++;
    else if (start > length || size > length - start) fail('E_REL');
    metadata.update(bytes.subarray(at, at + 64));
  }
  return { state: 'ELF_REL_HEADER_SECTION_DATA', header: { type: 1, machine: 62, version: 1, class: 64, endian: 'LE',
    sectionHeaderOffset: offset.toString(), sectionHeaderCount: count, sectionHeaderBytes: 64, sectionNameIndex: strings },
    nobitsSections: nobits, sectionHeadersSha256: metadata.digest('hex'), symbolRelocationsVerified: false };
}
function archive(bytes) {
  if (bytes.length < 8 || bytes[0] !== 33 || bytes[1] !== 60 || bytes[2] !== 97 || bytes[3] !== 114 ||
    bytes[4] !== 99 || bytes[5] !== 104 || bytes[6] !== 62 || bytes[7] !== 10) fail('E_AR');
  let at = 8, count = 0, objects = 0, symbols = 0, sections = 0, table = null;
  const metadata = createHash('sha256');
  function numeric(start, width, base = 10, allowEmpty = false) {
    const raw = bytes.toString('ascii', start, start + width), match = raw.match(base === 8 ? /^(0|[1-7][0-7]*) *$/ : /^(0|[1-9][0-9]*) *$/);
    if (allowEmpty && /^ +$/.test(raw)) return null;
    if (!match) fail('E_AR');
    const n = BigInt((base === 8 ? '0o' : '') + match[1]);
    if (n > BigInt(Number.MAX_SAFE_INTEGER)) fail('E_AR');
    return Number(n);
  }
  while (at < bytes.length) {
    if (++count > 65536 || bytes.length - at < 60) fail('E_AR');
    for (let i = at; i < at + 60; i++) if (bytes[i] < 32 || bytes[i] > 126) { if (i !== at + 59 || bytes[i] !== 10) fail('E_AR'); }
    if (bytes[at + 58] !== 96 || bytes[at + 59] !== 10) fail('E_AR');
    const field = bytes.toString('ascii', at, at + 16);
    if (!/^\S+ *$/.test(field)) fail('E_AR');
    const rawName = field.trimEnd();
    const special = ['/', '//', '/SYM64/'].includes(rawName);
    numeric(at + 16, 12, 10, special); numeric(at + 28, 6, 10, special); numeric(at + 34, 6, 10, special); numeric(at + 40, 8, 8, special);
    const size = numeric(at + 48, 10), start = at + 60;
    if (size > bytes.length - start) fail('E_AR');
    const end = start + size; let name = rawName, kind;
    if (rawName === '//') {
      if (table || size > 1048576) fail('E_AR');
      table = bytes.subarray(start, end); kind = 'NAME_INDEX';
      let p = 0;
      while (p < table.length) {
        if (p === table.length - 1 && table[p] === 10) break;
        const stop = table.indexOf('\n', p, 'ascii');
        if (stop < p + 2 || table[stop - 1] !== 47 || stop - p > 1024) fail('E_AR');
        for (let i = p; i < stop - 1; i++) if (table[i] < 33 || table[i] > 126) fail('E_AR');
        p = stop + 1;
      }
    } else if (rawName === '/' || rawName === '/SYM64/') { symbols++; kind = 'SYMBOL_INDEX'; }
    else {
      if (rawName.startsWith('#1/')) fail('E_AR_UNSUPPORTED');
      if (rawName.startsWith('/')) {
        if (!/^\/(0|[1-9][0-9]*)$/.test(rawName) || !table) fail('E_AR');
        const ref = BigInt(rawName.slice(1));
        if (ref >= BigInt(table.length)) fail('E_AR');
        const p = Number(ref), stop = table.indexOf('\n', p, 'ascii');
        if ((p !== 0 && table[p - 1] !== 10) || stop < p + 2 || table[stop - 1] !== 47) fail('E_AR');
        name = table.toString('ascii', p, stop - 1);
      } else {
        if (!/^[A-Za-z0-9_.+:-]+\/$/.test(rawName)) fail('E_AR_UNSUPPORTED');
        name = rawName.slice(0, -1);
      }
      const r = rel(bytes.subarray(start, end)); sections += r.header.sectionHeaderCount;
      if (sections > 65536) fail('E_AR');
      objects++; kind = 'ELF64LE_X86_64_ET_REL';
    }
    metadata.update(JSON.stringify({ index: count, name, kind, bodyOffset: start, size, sha256: sha(bytes.subarray(start, end)) }) + '\n');
    at = end;
    if (size % 2) { if (bytes[at] !== 10) fail('E_AR'); at++; }
  }
  if (at !== bytes.length || !objects) fail('E_AR');
  return { state: 'AR_MEMBER_METADATA', memberCount: count, objectCount: objects, symbolIndexCount: symbols,
    longNameTablePresent: table !== null, memberMetadataSha256: metadata.digest('hex'),
    objectType: 'ELF64LE_X86_64_ET_REL', symbolGraphVerified: false, externalPathsOpened: false };
}
function linker(bytes) {
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); } catch { fail('E_LINKER_TEXT'); }
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/.test(text)) fail('E_LINKER_TEXT');
  let at = 0, tokens = 0;
  const references = [], formats = [];
  function token() {
    while (at < text.length) {
      if (/\s/.test(text[at])) { at++; continue; }
      if (text.startsWith('/*', at)) { const end = text.indexOf('*/', at + 2); if (end < 0) fail('E_LINKER_TEXT'); at = end + 2; continue; }
      break;
    }
    if (at === text.length) return null;
    if (++tokens > 65536) fail('E_LINKER_TEXT');
    if (text[at] === '(' || text[at] === ')') return text[at++];
    const match = /^[a-zA-Z0-9_./+:-]+/.exec(text.slice(at));
    if (!match || match[0].length > 4096) fail('E_LINKER_UNSUPPORTED');
    at += match[0].length; return match[0];
  }
  function list(directive, depth) {
    if (depth > 32 || token() !== '(') fail('E_LINKER_TEXT');
    let count = 0, item;
    while ((item = token()) !== ')') {
      if (item === null || item === '(') fail('E_LINKER_TEXT');
      if (item === 'AS_NEEDED') {
        if (directive === 'OUTPUT_FORMAT') fail('E_LINKER_UNSUPPORTED');
        list(item, depth + 1);
      } else {
        if (/^[A-Z][A-Z_]*$/.test(item)) fail('E_LINKER_UNSUPPORTED');
        if (directive === 'OUTPUT_FORMAT') formats.push(item);
        else references.push({ literal: item, directive, kind: 'LINKER_REFERENCE_DATA_NOT_HOST_PERMISSION',
          requiresApprovedSysrootMapping: true, followed: false });
      }
      if (++count > 65536) fail('E_LINKER_TEXT');
    }
    if (!count) fail('E_LINKER_TEXT');
    if (directive === 'OUTPUT_FORMAT' && count !== 1) fail('E_LINKER_UNSUPPORTED');
  }
  let directive, count = 0;
  while ((directive = token()) !== null) {
    if (!['OUTPUT_FORMAT', 'GROUP', 'INPUT'].includes(directive)) fail('E_LINKER_UNSUPPORTED');
    list(directive, 1); count++;
  }
  if (!count || !references.length) fail('E_LINKER_TEXT');
  return { state: 'GNU_LD_REFERENCE_DATA', formats, references, evaluated: false, hostResolutionAttempted: false };
}
function inspect(target, bytes, limits) {
  if (target.kind === 'ELF_EXEC_DSO') {
    if (bytes.length > limits.maxElfSnapshotBytes) fail('E_LIMIT');
    let requirements;
    try { requirements = inspectElf64RequirementsV3(bytes); } catch (error) { elfFailure(error); }
    const loading = new Set(['1879047930', '1879047931', '1879047932', '2147483645', '2147483646', '2147483647']);
    return { state: 'ELF_EXEC_DSO_REQUIREMENT_DATA', requirements,
      unsafeLoadingTags: requirements.dynamic.unknownTags.filter(row => loading.has(row.tag)),
      loadingTagsQualification: 'NOT_QUALIFIED', qualified: false };
  }
  if (target.kind === 'ET_REL') return rel(bytes);
  if (target.kind === 'AR') { if (bytes.length > limits.maxArBytes) fail('E_LIMIT'); return archive(bytes); }
  if (target.kind === 'LINKER_TEXT') { if (bytes.length > limits.maxTextBytes) fail('E_LIMIT'); return linker(bytes); }
  fail('E_KIND');
}
function adapter(profile) {
  let phase = 'idle', pending = null, accepted = false, factoryCalls = 0, cursor = 0, next = 0, active = null;
  let hash = null, capturedBytes = 0, observationBytes = 2, buffersAllocated = 0, buffersErased = 0, peakPayloadBytes = 0;
  let failedTargetAttempt = null;
  const observations = new Map(), eventsSeen = new Set(), sorted = [...profile.targets].sort((a, b) => a.bodyOffset - b.bodyOffset);
  const byPath = new Map(profile.targets.map(row => [SDK_PAYLOAD_ROOT + '/' + row.path, row]));
  const byIndex = new Map(profile.targets.map(row => [row.index, row]));
  function wipe() { if (active) { active.bytes.fill(0); active = null; buffersErased++; } }
  function abortPayloadInspection() { wipe(); observations.clear(); eventsSeen.clear(); pending = null; hash = null; accepted = false; phase = 'failed'; }
  function guarded(fn) { try { return fn(); } catch (error) { abortPayloadInspection(); throw error; } }
  return Object.freeze({
    beginPayloadPass() { return guarded(() => { if (phase !== 'idle') fail('E_PHASE'); phase = 'configured'; hash = createHash('sha256'); }); },
    createTarInventory(overrides = {}) { return guarded(() => {
      if (phase !== 'configured' || factoryCalls !== 0) fail('E_PHASE');
      const parser = originalCreateTarInventory(overrides); factoryCalls++; phase = 'running';
      return Object.freeze({
        feed(bytes) { return guarded(() => {
          if (phase !== 'running') fail('E_PHASE');
          const view = input(bytes), end = cursor + view.length;
          if (end > profile.expected.expandedBytes) fail('E_LENGTH');
          const events = parser.feed(bytes);
          for (const event of array(events, profile.expected.entries)) {
            const path = own(event, 'path'), index = own(event, 'index'), target = byPath.get(path);
            if (target || byIndex.has(index)) {
              if (!target || target !== byIndex.get(index) || own(event, 'type') !== 'file' || own(event, 'size') !== target.size || eventsSeen.has(path)) fail('E_TARGET');
              eventsSeen.add(path);
            }
          }
          hash.update(view);
          while (next < sorted.length && sorted[next].bodyOffset < end) {
            const target = sorted[next], start = Math.max(cursor, target.bodyOffset), stop = Math.min(end, target.bodyOffset + target.size);
            if (start >= stop) fail('E_SPAN');
            if (!active) {
              if (start !== target.bodyOffset || observations.has(target.path)) fail('E_SPAN');
              active = { bytes: Buffer.alloc(target.size), filled: 0, hash: createHash('sha256') };
              buffersAllocated++; peakPayloadBytes = Math.max(peakPayloadBytes, target.size);
            }
            if (start !== target.bodyOffset + active.filled || stop - start > profile.limits.maxAggregateBytes - capturedBytes) fail('E_SPAN');
            const part = view.subarray(start - cursor, stop - cursor);
            active.bytes.set(part, active.filled); active.hash.update(part); active.filled += part.length; capturedBytes += part.length;
            if (active.filled !== target.size) break;
            try {
              let metadata;
              try { metadata = inspect(target, active.bytes, profile.limits); }
              catch (error) {
                if (failedTargetAttempt === null) {
                  const code = fixedOwnCode(error, 'code', parserFailureCodes) ?? (target.kind === 'ELF_EXEC_DSO' ? 'E_ELF' :
                    target.kind === 'ET_REL' ? 'E_REL' : target.kind === 'AR' ? 'E_AR' : target.kind === 'LINKER_TEXT' ? 'E_LINKER_TEXT' : 'E_KIND');
                  const attempt = Object.freeze({ path: target.path, index: target.index, kind: target.kind, code,
                    underlyingCode: target.kind === 'ELF_EXEC_DSO' && code === 'E_ELF' ? fixedOwnCode(error, 'underlyingCode', elfFailureCodes) : null,
                    scope: 'ATTEMPTED_LITERAL_TARGET_NOT_ACCEPTED_PAYLOAD_EVIDENCE' });
                  bound(attempt, 4096); failedTargetAttempt = attempt;
                }
                throw error;
              }
              const row = { ...target, sha256: active.hash.digest('hex'), metadata, roleSatisfied: false, qualified: false };
              bound(row, profile.limits.maxObservationBytes);
              const cost = Buffer.byteLength(ascii(JSON.stringify(row))) + 1;
              if (cost > profile.limits.maxObservationBytes - observationBytes) fail('E_OUTPUT');
              observations.set(target.path, freeze(row)); observationBytes += cost;
            } finally { wipe(); }
            next++;
          }
          cursor = end; return events;
        }); },
        finish() { return guarded(() => {
          if (phase !== 'running') fail('E_PHASE');
          const result = parser.finish();
          if (own(result, 'state') !== 'TAR_INVENTORY' || !Object.keys(profile.expected).every(key => own(result, key) === profile.expected[key])) fail('E_SUMMARY');
          if (active || cursor !== profile.expected.expandedBytes || next !== 45 || observations.size !== 45 || eventsSeen.size !== 45 || capturedBytes !== profile.totalBytes) fail('E_LENGTH');
          if (hash.digest('hex') !== profile.digest) fail('E_HASH');
          bound(result, profile.limits.maxCoreBytes); hash = null; pending = result; phase = 'complete'; return result;
        }); },
      });
    }); },
    acceptPayloadPass(result) { return guarded(() => {
      if (phase !== 'complete' || accepted) fail('E_PHASE');
      bound(result, profile.limits.maxCoreBytes);
      const expected = { state: 'GNU_SDK_DATA_INVENTORY', mockOnly: profile.mockOnly, inventory: pending,
        archivePasses: 2, closeAttempts: 2, stdinFinished: true, stdoutEnded: true, stderrEnded: true, closeObserved: true,
        exitCode: 0, signal: null, extracted: false, nativeQualified: false, pythonFreeSubsetVerified: false };
      if (!profile.mockOnly) Object.assign(expected, { archiveBytes: 102296280,
        archiveSha256: 'cde893afab04ac7dcd15c46aac214ff550441b982536124c88a71146a0eeedd3', archiveDataBytes: 204592560, archiveRequestedBytes: 204592562 });
      if (!Object.keys(expected).every(key => own(result, key) === expected[key])) fail('E_RECEIPT');
      accepted = true;
    }); },
    getPayloadData() { return guarded(() => {
      if (phase !== 'complete' || !accepted) fail('E_PHASE');
      const members = profile.targets.map(row => observations.get(row.path)), edges = [];
      let edgeBytes = 2;
      for (const member of members) {
        const requirements = member.metadata.requirements;
        if (!requirements) continue;
        for (const needed of requirements.dynamic.needed) {
          const providers = members.filter(row => row.domain === member.domain && row.metadata.requirements?.dynamic.soname === needed).map(row => row.path);
          const edge = { from: member.path, domain: member.domain, needed, declaredProviderNames: providers, status: 'UNRESOLVED', abiVerified: false, aliasFollowed: false };
          edgeBytes += Buffer.byteLength(ascii(JSON.stringify(edge))) + 1;
          if (edgeBytes > profile.limits.maxObservationBytes - observationBytes) fail('E_OUTPUT');
          edges.push(edge);
        }
      }
      bound(edges, profile.limits.maxObservationBytes - observationBytes);
      const result = { state: 'SDK_PAYLOAD_DATA_INSPECTED', mockOnly: profile.mockOnly,
        interpretation: 'DATA_NOT_EXTRACTION_MEMBER_EXECUTION_OR_HOST_PERMISSION', decodedSha256: profile.digest,
        targetCount: 45, capturedBytes, members, declaredNeededEdges: edges,
        resourceAccounting: { peakPayloadBytes, buffersAllocated, buffersErased, maxAdditionalElfSnapshotBytes: profile.limits.maxElfSnapshotBytes,
          observationBytes: observationBytes + edgeBytes, edgeObservationBytes: edgeBytes,
          observationAccounting: 'ASCII_JSON_MEMBERS_AND_EDGES_NOT_RSS', observationBudgetBytes: profile.limits.maxObservationBytes,
          hardRssBounded: false, secureStringErasureClaimed: false }, ...flags };
      bound(result, profile.limits.maxOutputBytes); freeze(result);
      observations.clear(); eventsSeen.clear(); pending = null; accepted = false; phase = 'released'; return result;
    }); },
    snapshot() { return Object.freeze({ phase, factoryCalls, accepted, retainedObservations: observations.size,
      activePayloadBytes: active ? active.bytes.length : 0, capturedBytes, buffersAllocated, buffersErased, peakPayloadBytes }); },
    getFailedTargetAttempt() { return failedTargetAttempt; },
    abortPayloadInspection,
  });
}
function profile(targets, expected, digest, limits, mockOnly) {
  const paths = new Set(), indices = new Set(); let totalBytes = 0, previousEnd = 0;
  for (const row of [...targets].sort((a, b) => a.bodyOffset - b.bodyOffset)) {
    const cap = Math.min(limits.maxPayloadBytes, row.kind === 'AR' ? limits.maxArBytes : row.kind === 'LINKER_TEXT' ? limits.maxTextBytes : row.kind === 'ELF_EXEC_DSO' ? limits.maxElfSnapshotBytes : limits.maxPayloadBytes);
    if (paths.has(row.path) || indices.has(row.index) || !Number.isSafeInteger(row.index) || row.index < 1 || row.index > expected.entries ||
      !Number.isSafeInteger(row.bodyOffset) || row.bodyOffset < 512 || row.bodyOffset < previousEnd ||
      !Number.isSafeInteger(row.size) || row.size < 1 || row.size > cap || row.bodyOffset > expected.expandedBytes || row.size > expected.expandedBytes - row.bodyOffset) fail('E_SPAN');
    paths.add(row.path); indices.add(row.index); totalBytes += row.size; previousEnd = row.bodyOffset + row.size;
  }
  if (targets.length !== 45 || totalBytes > limits.maxAggregateBytes) fail('E_LIMIT');
  return Object.freeze({ targets, expected, digest, limits, mockOnly, totalBytes });
}

// WHAT: Lower-only, same-45-path synthetic in-memory profile; never a production qualification.
export function createSdkPayloadInspectionFixture(value) {
  object(value);
  if (Reflect.ownKeys(value).length !== 4) fail('E_INPUT');
  const rawExpected = own(value, 'expectedSummary'), expected = {};
  object(rawExpected);
  if (Reflect.ownKeys(rawExpected).length !== Object.keys(SDK_PAYLOAD_EXPECTATION).length) fail('E_INPUT');
  for (const key of Object.keys(SDK_PAYLOAD_EXPECTATION)) {
    const v = own(rawExpected, key);
    if (key === 'metadataSha256' ? typeof v !== 'string' || !/^[a-f0-9]{64}$/.test(v) : !Number.isSafeInteger(v) || v < 0 || v > SDK_PAYLOAD_EXPECTATION[key]) fail('E_INPUT');
    expected[key] = v;
  }
  const digest = own(value, 'expectedDecodedSha256');
  if (!/^[a-f0-9]{64}$/.test(typeof digest === 'string' ? digest : '') || expected.expandedBytes < 1 || expected.expandedBytes > 1048576) fail('E_INPUT');
  const overrides = own(value, 'limits'), limits = { ...SDK_PAYLOAD_LIMITS }; object(overrides);
  for (const key of Reflect.ownKeys(overrides)) {
    const v = own(overrides, key);
    if (!Object.hasOwn(limits, key) || !Number.isSafeInteger(v) || v < 1 || v > limits[key]) fail('E_INPUT');
    limits[key] = v;
  }
  const seen = new Set(), targets = array(own(value, 'targets'), 45).map(value => {
    object(value); if (Reflect.ownKeys(value).length !== 4) fail('E_INPUT');
    const path = own(value, 'path'), original = SDK_PAYLOAD_TARGETS.find(row => row.path === path);
    if (!original || seen.has(path)) fail('E_TARGET'); seen.add(path);
    const row = { ...original, index: own(value, 'index'), bodyOffset: own(value, 'bodyOffset'), size: own(value, 'size') };
    if (row.size > original.size || row.index > original.index || row.bodyOffset > original.bodyOffset) fail('E_LIMIT');
    return Object.freeze(row);
  });
  return adapter(profile(Object.freeze(targets), Object.freeze(expected), digest, Object.freeze(limits), true));
}
const registered = adapter(profile(SDK_PAYLOAD_TARGETS, SDK_PAYLOAD_EXPECTATION, SDK_PAYLOAD_DECODED_SHA256, SDK_PAYLOAD_LIMITS, false));
export const beginPayloadPass = () => registered.beginPayloadPass();
export const createTarInventory = overrides => registered.createTarInventory(overrides);
export const acceptPayloadPass = value => registered.acceptPayloadPass(value);
export const getPayloadData = () => registered.getPayloadData();
export const getFailedTargetAttempt = () => registered.getFailedTargetAttempt();
export const abortPayloadInspection = () => registered.abortPayloadInspection();
