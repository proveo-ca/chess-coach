// SPEC: _spec/tooling/native-ingress/step2.puml
import { createHash } from 'node:crypto';
import { types } from 'node:util';
import { createTarInventory as originalCreateTarInventory, INVENTORY_LIMITS } from './tar-inventory.mjs';
import { inspectElf64RequirementsV5 } from './elf-requirements-v5.mjs';
import { SOURCE_FORMAT_INSPECTORS } from './sdk-payload-inspection.mjs';

const ownedFrozen = new WeakSet();
function freeze(value) {
  if (value && typeof value === 'object' && !ownedFrozen.has(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value); ownedFrozen.add(value);
  }
  return value;
}
export const SPLIT_TOOLCHAIN_EVIDENCE_PARTS = freeze(['gnu', 'rust']);
export const SPLIT_TOOLCHAIN_EVIDENCE_LIMITS = Object.freeze({
  maxExpandedBytes: 1073741824, maxBatchExpandedBytes: 2147483648,
  maxEntries: 32768, maxBatchEntries: 65536,
  maxRoleMetadataBytes: 4194304, maxBatchMetadataBytes: 8388608,
  maxManifestBytes: 1048576, maxBatchManifestBytes: 4194304,
  maxPayloadBytes: 268435456, maxAggregatePayloadBytes: 805306368,
  maxElfSnapshotBytes: 268435456, maxArBytes: 8388608, maxTextBytes: 1048576,
  maxOutputBytes: 16777216, maxChunkBytes: 65536,
});
const gnuRoot = 'x86-64--glibc--stable-2026.08-1';
const SDK_RELOCS_SHA256 = '60f1b6054d8f01670a9f5ac3ac0181f7148e37be91025c2c4f111df30047305e';
const SDK_RELOCS_BYTES = 9367;
const rustRoot = '/tmp/opencode/f9-rust-runtime-inputs-01';
const rustIdentity = { dev: '28', ino: '13954', mode: '16832', uid: '1000', gid: '1000', nlink: '2', size: '4096', mtimeNs: '1792857301045485610', ctimeNs: '1792857301045485610' };
const pinnedInputs = freeze([
  { role: 'gnu-sdk', root: '/tmp/opencode/f9-gnu-2026-data-only-01',
    file: '/tmp/opencode/f9-gnu-2026-data-only-01/x86-64--glibc--stable-2026.08-1.tar.xz',
    archiveBytes: 102296280, archiveSha256: 'cde893afab04ac7dcd15c46aac214ff550441b982536124c88a71146a0eeedd3', expectedRoot: gnuRoot,
    identity: { root: { dev: '28', ino: '13894', mode: '16832', uid: '1000', gid: '1000', nlink: '2', size: '4096', mtimeNs: '1792805590304271582', ctimeNs: '1792805590304271582' },
      file: { dev: '29', ino: '1211332', mode: '33152', uid: '1000', gid: '1000', nlink: '1', size: '102296280', mtimeNs: '1792805605531830652', ctimeNs: '1792805605531830652' } }, decoderMemoryBytes: 16777216 },
  ...[
    ['cargo', 'cargo', 10984780, 'e74edd2cf7d0f1f1383b4f00eb90c843750bc489e2ccf7214e6476678a907425', '1211150', '1792857299153485617'],
    ['rustc', 'rustc', 80351960, '8426a3d170a5879f5682f5fbdd024a1779b3951e7baba685af2d6dc32a6dfc15', '1211151', '1792857300349485612'],
    ['rust-std', 'rust-std', 29573972, '047ea7098803d3500fa1072e9cee5392697e21525559e4458128a2bf874aa382', '1211153', '1792857300901485610'],
    ['rustfmt-preview', 'rustfmt', 2164880, 'f1b2a7301513ffdd95ebf22ebbdd932e4d17fc806f748d93924740d0297b1396', '1211154', '1792857301041485610'],
    ['clippy-preview', 'clippy', 4697128, 'ac779bc9839dd47180806b133e4e2563c4a34716284cd5b8fede8ef289f452ca', '1211155', '1792857301361485608'],
  ].map(([role, name, archiveBytes, archiveSha256, ino, time]) => {
    const expectedRoot = `${name}-1.95.0-x86_64-unknown-linux-gnu`;
    return { role, root: rustRoot, file: `${rustRoot}/${expectedRoot}.tar.xz`, archiveBytes, archiveSha256, expectedRoot,
      identity: { root: rustIdentity, file: { dev: '29', ino, mode: '33152', uid: '1000', gid: '1000', nlink: '1', size: String(archiveBytes), mtimeNs: time, ctimeNs: time } }, decoderMemoryBytes: 268435456 };
  }),
]);
const pinnedExpectations = freeze([
  ['gnu-sdk', 505333760, 8412, 10181, 6891, '5e7f960281fb93121982f95976eb59ed980e009b54aabf993d5d3fa2982e056f', 'efe53c8fda0b0f1e8b8ba6b7868707a88f33aa26b5692b9c76dc0e6da694d901'],
  ['cargo', 42864128, 68, 68, 56, '22429805eca884d4f844843c8e7bc3dc3796737067e19274387953e5081a88f6', '97faa298dac62ef85e60ac1bd30a343bfc8e1f587aee6b2875f6e9db7f3877d9'],
  ['rustc', 402308096, 70, 71, 53, '08c25740ad1acbcdf84625b6f05b316f994cba94efdb4f262749b5bbad7e0cc0', '9a00ed58e31abdede8d8acfc74bd92e3afdb3fc3089a220f63b680830a8b471f'],
  ['rust-std', 166755840, 81, 146, 74, 'a48379ce9b557559ff0e95c7f34a415fb454dad32e63a7f5ec77feb75bcbde96', 'f013cd265653f00e2a719b4b51daef65a9b73fa2527118a5b5baa64b0c203c75'],
  ['rustfmt-preview', 9112576, 22, 22, 16, '7c33b012cd3b219844ee0d7c0bd3537ec1f1639883925207cb95474fbd43d6a2', '33bf584dc2495890a712b449dc1cefda8fdcc8d1f940a67cd46fe1f6325bbe74'],
  ['clippy-preview', 21706240, 22, 22, 16, 'a0b25caf8a302f4a7edf7f6c0ed3ab9cbf15e6a626bbd6de42babe694ede0f87', '2c4f9abdde502a3a18ce32db066f1d8cd866cfe1cf4d853db6994b46435020dc'],
].map(([role, expandedBytes, entries, headers, regularFiles, decodedSha256, metadataSha256]) => ({ role, expandedBytes, entries, headers, regularFiles, decodedSha256, metadataSha256,
  metadataHashKind: role === 'gnu-sdk' ? 'LEGACY_WITHOUT_BODY_OFFSET' : 'OFFSET_EVENT_METADATA' })));
const gnuTargets = [
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
].map(([path, index, bodyOffset, size, kind, selectionRole, domain, optionalForMinimalC]) => ({ artifactRole: 'gnu-sdk', path: `${gnuRoot}/${path}`, index, bodyOffset, size, expectedSha256: null, kind, domain, selectionRole, optionalForMinimalC,
  maxBytes: kind === 'AR' ? 8388608 : kind === 'LINKER_TEXT' ? 1048576 : 67108864 }));
const rustTargets = [
  ['cargo','cargo-1.95.0-x86_64-unknown-linux-gnu/cargo/bin/cargo',66,651776,42185192,'841072d1d92f9e841d9ba5b0814182a0adf064acf4527cd120967b7bc49dcb66','ELF_EXEC_DSO','HOST'],
  ['rustc','rustc-1.95.0-x86_64-unknown-linux-gnu/rustc/bin/rustdoc',25,41984,13303096,'e5144902aed6cf94280eae3ad7708da5bdd3819b5281728af432d0e70231439c','ELF_EXEC_DSO','HOST'],
  ['rustc','rustc-1.95.0-x86_64-unknown-linux-gnu/rustc/bin/rustc',26,13345792,644784,'bff349e72704ff70bc08a234a3847338e797065bbedde5e556808bc87b7bf7c6','ELF_EXEC_DSO','HOST'],
  ['rustc','rustc-1.95.0-x86_64-unknown-linux-gnu/rustc/lib/rustlib/x86_64-unknown-linux-gnu/bin/rust-lld',29,19527680,11604688,'60f305b55da767671e895b231e0c78e87f4ccbf790d7181842039c53bb60281c','ELF_EXEC_DSO','HOST'],
  ['rustc','rustc-1.95.0-x86_64-unknown-linux-gnu/rustc/lib/rustlib/x86_64-unknown-linux-gnu/bin/gcc-ld/ld.lld',31,31511040,376864,'e7d44b7571a8250326e99aa238aa4be7ddaa1fa696cf3c0e2ca829da5846b325','ELF_EXEC_DSO','HOST'],
  ['rustc','rustc-1.95.0-x86_64-unknown-linux-gnu/rustc/lib/libLLVM.so.22.1-rust-1.95.0-stable',34,31897088,199603328,'f6a654c837c51bc2fc00f83d58318607b6f30fec364a00f09b6172129e591fb5','ELF_EXEC_DSO','HOST'],
  ['rustc','rustc-1.95.0-x86_64-unknown-linux-gnu/rustc/lib/libLLVM-22-rust-1.95.0-stable.so',47,246645760,42,'044a388f61f18a07583a1126fa91c1288ecb0745f41a8369ec4a6b2acb9b51d3','LINKER_TEXT','HOST'],
  ['rustc','rustc-1.95.0-x86_64-unknown-linux-gnu/rustc/lib/librustc_driver-6108105cd7e839cf.so',48,246646784,153621360,'ae69468875215df490fde685ec1f1b969743482ba7e0251f4074a222606a5484','ELF_EXEC_DSO','HOST'],
  ['rust-std','rust-std-1.95.0-x86_64-unknown-linux-gnu/rust-std-x86_64-unknown-linux-gnu/lib/rustlib/x86_64-unknown-linux-gnu/lib/libstd-d1237ef7159db0a2.so',80,161335296,5418488,'abca53e870629e3f9f97ae72897181dcc4db555d8e6ace00351b02a74ef77c81','ELF_EXEC_DSO','TARGET'],
  ['rustfmt-preview','rustfmt-1.95.0-x86_64-unknown-linux-gnu/rustfmt-preview/bin/cargo-fmt',21,99840,3715584,'cd554fed0211e007995a6a540a7fd67bf22354986ae64960c752bb943d8e1184','ELF_EXEC_DSO','HOST'],
  ['rustfmt-preview','rustfmt-1.95.0-x86_64-unknown-linux-gnu/rustfmt-preview/bin/rustfmt',22,3815936,5295560,'56b31ad3ec8fe0277a2884a189e243b8f04e9b48e5fd22e547c1516c5f8fd34c','ELF_EXEC_DSO','HOST'],
  ['clippy-preview','clippy-1.95.0-x86_64-unknown-linux-gnu/clippy-preview/bin/clippy-driver',20,99840,20339280,'81bd985ee50d78e9d8c5810f6ca836614d1bf95e0e8142f1ec5f42eb250ed729','ELF_EXEC_DSO','HOST'],
  ['clippy-preview','clippy-1.95.0-x86_64-unknown-linux-gnu/clippy-preview/bin/cargo-clippy',22,20441088,1263912,'b71b1263063707608daa1e9b231ad9d87507c11d6aa178ede2b01d8372d5effb','ELF_EXEC_DSO','HOST'],
].map(([artifactRole, path, index, bodyOffset, size, expectedSha256, kind, domain]) => ({ artifactRole, path, index, bodyOffset, size, expectedSha256, kind, domain, selectionRole: 'RUST_RUNTIME_CANDIDATE', optionalForMinimalC: false, maxBytes: kind === 'LINKER_TEXT' ? 1048576 : 268435456 }));
export const SPLIT_TOOLCHAIN_EVIDENCE_INPUTS = freeze({ gnu: pinnedInputs.slice(0, 1), rust: pinnedInputs.slice(1) });
export const SPLIT_TOOLCHAIN_EVIDENCE_EXPECTATIONS = freeze({ gnu: pinnedExpectations.slice(0, 1), rust: pinnedExpectations.slice(1) });
export const SPLIT_TOOLCHAIN_EVIDENCE_TARGETS = freeze({ gnu: [...gnuTargets,
  { artifactRole: 'gnu-sdk', path: `${gnuRoot}/x86_64-buildroot-linux-gnu/sysroot/lib/libmvec.so.1`, index: null, bodyOffset: null, size: null, expectedSha256: null,
    kind: 'ELF_EXEC_DSO', domain: 'TARGET', selectionRole: 'TARGET_LIBMVEC_PROVIDER', optionalForMinimalC: false, maxBytes: 8388608 },
], rust: rustTargets });
export const SPLIT_TOOLCHAIN_EVIDENCE_PROFILES = freeze({
  gnu: { part: 'gnu', roles: ['gnu-sdk'], artifactCount: 1, targetCount: 46, expandedBytes: 505333760, entries: 8412, regularFiles: 6891 },
  rust: { part: 'rust', roles: ['cargo', 'rustc', 'rust-std', 'rustfmt-preview', 'clippy-preview'], artifactCount: 5, targetCount: 13, expandedBytes: 642746880, entries: 263, regularFiles: 215 },
});

const negativeFlags = freeze({ extracted: false, archiveExtracted: false, filesInstalled: false, extractionAuthorized: false,
  pythonFreeSubsetVerified: false, noPythonRuntimeVerified: false, pythonRuntimeInvoked: false, rustExecuted: false, installedUsability: false, nativeQualified: false,
  nativeAuthority: false, decoderQualified: false, rustReady: false, trainingReady: false, provenanceVerified: false,
  hardRssBounded: false, processTreeBounded: false, hardDeadlineGuaranteed: false, relocationReady: false,
  roleSatisfied: false, abiVerified: false, loaderClosureVerified: false, runtimeProvidersQualified: false,
  imagePrepared: false, imageEquivalent: false, installMapInterpreted: false, nodeIoQualified: false, compilerExecuted: false,
  sourceReady: false, rootfsReady: false, installReady: false, dockerProviderQualified: false });
const coreFlags = ['extracted', 'extractionAuthorized', 'pythonFreeSubsetVerified', 'installedUsability', 'nativeQualified',
  'decoderQualified', 'rustReady', 'trainingReady', 'provenanceVerified', 'hardRssBounded', 'processTreeBounded', 'hardDeadlineGuaranteed'];
const tarCodes = new Set(['E_LIMITS','E_UTF8','E_TEXT','E_NUMBER','E_PAX_NUMBER','E_PAX','E_PAX_KEY','E_PAX_DUPLICATE','E_PATH','E_SEALED','E_INTERNAL','E_GNU_LONG','E_DANGLING_EXTENSION','E_TERMINATOR','E_HEADERS','E_CHECKSUM','E_MAGIC','E_SIZE','E_EXTENSION_REPEAT','E_EXTENSION_BYTES','E_NONFILE_BODY','E_TYPE','E_LINK','E_COLLISION','E_COLLISION_BYTES','E_EVENT_BYTES','E_OUTPUT_BYTES','E_SPAN_BYTES','E_CHUNK','E_DATA_EVENTS','E_EXPANDED_BYTES','E_PADDING','E_TRAILING','E_TRUNCATED']);
const inspectorCodes = new Set(['E_INPUT','E_LIMITS','E_ELF','E_RANGE','E_PROGRAM_HEADERS','E_INTERPRETER','E_DYNAMIC','E_STRING_TABLE','E_STRING','E_OUTPUT','E_VERSIONS','E_NOTES','E_PROPERTIES','E_REL','E_REL_UNSUPPORTED','E_AR','E_AR_UNSUPPORTED','E_LINKER_TEXT','E_LINKER_UNSUPPORTED','E_LIMIT','E_KIND']);
const errors = new WeakSet();
function fail(code, underlyingCode = null) {
  const error = Object.freeze(Object.assign(new Error(code), { name: 'ToolchainEvidenceError', code, underlyingCode }));
  errors.add(error); throw error;
}
function requirePart(part) { if (part !== 'gnu' && part !== 'rust') fail('E_EVIDENCE_INPUT'); }
function fixedCode(error, key, allowed) {
  if (!error || typeof error !== 'object' || types.isProxy(error)) return null;
  const d = Object.getOwnPropertyDescriptor(error, key);
  return d && Object.hasOwn(d, 'value') && typeof d.value === 'string' && allowed.has(d.value) ? d.value : null;
}
function data(value, keys) {
  if (!value || typeof value !== 'object' || types.isProxy(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('E_EVIDENCE_INPUT');
  const found = Reflect.ownKeys(value), result = Object.create(null);
  if (found.length > 128 || keys && (found.length !== keys.length || found.some(key => !keys.includes(key)))) fail('E_EVIDENCE_INPUT');
  for (const key of found) {
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !Object.hasOwn(d, 'value')) fail('E_EVIDENCE_INPUT');
    result[key] = d.value;
  }
  return result;
}
function arrayLength(value, max = 65536) {
  if (types.isProxy(value) || !Array.isArray(value) || ![Array.prototype, null].includes(Object.getPrototypeOf(value))) fail('E_EVIDENCE_INPUT');
  const n = Object.getOwnPropertyDescriptor(value, 'length').value;
  if (!Number.isSafeInteger(n) || n < 0 || n > max || Reflect.ownKeys(value).length !== n + 1) fail('E_EVIDENCE_INPUT');
  for (let i = 0; i < n; i++) if (!Object.hasOwn(Object.getOwnPropertyDescriptor(value, String(i)) ?? {}, 'value')) fail('E_EVIDENCE_INPUT');
  return n;
}
function lower(value, base) {
  const p = data(value), result = { ...base };
  for (const [key, n] of Object.entries(p)) {
    if (!Object.hasOwn(base, key) || !Number.isSafeInteger(n) || n < 1 || n > base[key]) fail('E_EVIDENCE_LIMIT');
    result[key] = n;
  }
  return Object.freeze(result);
}
const isDigest = value => typeof value === 'string' && /^[0-9a-f]{64}$/u.test(value);
const integer = (value, min = 0) => Number.isSafeInteger(value) && value >= min;
function canonical(path) {
  return typeof path === 'string' && path.length > 0 && Buffer.byteLength(path) <= 1024 && !/[\u0000-\u001f\u007f-\u009f\\]/u.test(path)
    && !path.startsWith('/') && !/^[A-Za-z]:/u.test(path) && !path.split('/').some(part => !part || part === '.' || part === '..');
}
function jsonSize(value, max, code = 'E_EVIDENCE_METADATA') {
  let total = 0, nodes = 0;
  const parents = new Set();
  const charge = n => { if (n > max - total) fail(code); total += n; };
  function string(text) {
    charge(2);
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      charge(c === 34 || c === 92 || [8,9,10,12,13].includes(c) ? 2 : c < 32 || c >= 128 ? 6 : 1);
    }
  }
  function visit(v, depth) {
    if (++nodes > 2000000 || depth > 40) fail(code);
    if (typeof v === 'string') { string(v); return; }
    if (v === null || typeof v === 'boolean' || typeof v === 'number' && Number.isFinite(v)) { charge(String(v).length); return; }
    if (!v || typeof v !== 'object' || types.isProxy(v) || parents.has(v)) fail('E_EVIDENCE_INPUT');
    parents.add(v);
    if (Array.isArray(v)) {
      const n = arrayLength(v); charge(2 + Math.max(0, n - 1));
      for (let i = 0; i < n; i++) visit(Object.getOwnPropertyDescriptor(v, String(i)).value, depth + 1);
    } else {
      const p = data(v), keys = Object.keys(p); charge(2 + Math.max(0, keys.length - 1));
      for (const key of keys) { string(key); charge(1); visit(p[key], depth + 1); }
    }
    parents.delete(v);
  }
  visit(value, 0); return total;
}
const typed = Object.getPrototypeOf(Uint8Array.prototype);
const lengthOf = Object.getOwnPropertyDescriptor(typed, 'length').get;
const bufferOf = Object.getOwnPropertyDescriptor(typed, 'buffer').get;
const offsetOf = Object.getOwnPropertyDescriptor(typed, 'byteOffset').get;
const resizable = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
function chunkView(value, max) {
  if (types.isProxy(value) || !types.isUint8Array(value) || ![Uint8Array.prototype, Buffer.prototype].includes(Object.getPrototypeOf(value))) fail('E_EVIDENCE_CHUNK');
  for (const key of ['length','byteLength','buffer','byteOffset']) if (Object.getOwnPropertyDescriptor(value, key)) fail('E_EVIDENCE_CHUNK');
  const n = lengthOf.call(value), buffer = bufferOf.call(value), offset = offsetOf.call(value);
  if (!n || n > max || types.isSharedArrayBuffer(buffer) || resizable && resizable.call(buffer)) fail('E_EVIDENCE_CHUNK');
  try { return new Uint8Array(buffer, offset, n); } catch { fail('E_EVIDENCE_CHUNK'); }
}
function legacyEvent(e) {
  const result = { index: e.index, path: e.path, type: e.type, size: e.size };
  if (e.type === 'symlink' || e.type === 'hardlink') { result.linkpath = e.linkpath; result.linkKind = e.linkKind; }
  return { ...result, mode: e.mode, uid: e.uid, gid: e.gid, mtime: e.mtime };
}
function manifestKind(input, path) {
  const relative = path.slice(input.expectedRoot.length + 1);
  if (input.role === 'gnu-sdk') return ['share/buildroot/sdk-relocs', 'share/buildroot/sdk-location'].includes(relative) ? 'GNU_RAW_TEXT' : null;
  if (relative === 'components') return 'RUST_COMPONENTS';
  if (relative === 'rust-installer-version') return 'RUST_INSTALLER_VERSION';
  const component = input.role === 'rust-std' ? 'rust-std-x86_64-unknown-linux-gnu' : input.role;
  return relative === `${component}/manifest.in` ? 'RUST_MANIFEST' : null;
}
function inspect(target, bytes, trusted, limits) {
  let result;
  try {
    if (target.kind === 'ELF_EXEC_DSO') {
      if (bytes.length > limits.maxElfSnapshotBytes || bytes.length > (target.artifactRole === 'gnu-sdk' ? 67108864 : 268435456)) fail('E_EVIDENCE_LIMIT');
      const requirements = trusted.elfInspector(bytes);
      jsonSize(requirements, limits.maxRoleMetadataBytes);
      const p = data(requirements), dynamic = data(p.dynamic);
      arrayLength(dynamic.needed, 32); arrayLength(dynamic.unknownTags, 1024);
      for (const needed of dynamic.needed) if (typeof needed !== 'string' || !needed || Buffer.byteLength(needed) > 1024) fail('E_EVIDENCE_INSPECT');
      if (dynamic.soname !== null && (typeof dynamic.soname !== 'string' || Buffer.byteLength(dynamic.soname) > 1024)) fail('E_EVIDENCE_INSPECT');
      const loading = new Set(['1879047930','1879047931','1879047932','2147483645','2147483646','2147483647']);
      result = { state: 'ELF_EXEC_DSO_REQUIREMENT_DATA', requirements,
        unsafeLoadingTags: dynamic.unknownTags.filter(row => loading.has(data(row).tag)), loadingTagsQualification: 'NOT_QUALIFIED', qualified: false };
    } else {
      const method = { ET_REL: 'rel', AR: 'archive', LINKER_TEXT: 'linker' }[target.kind];
      if (!method) fail('E_EVIDENCE_INSPECT');
      result = { state: 'SOURCE_FORMAT_DATA', observation: trusted.formatInspectors[method](bytes), qualified: false };
    }
  } catch (error) {
    if (errors.has(error)) throw error;
    fail('E_EVIDENCE_INSPECT', fixedCode(error, 'code', inspectorCodes));
  }
  jsonSize(result, limits.maxRoleMetadataBytes);
  return result;
}

function collector(profile, trusted) {
  const { part, inputs, targets, expectations, limits, mockOnly } = profile;
  let state = 'IDLE', active = null, accepted = [], failure = null, attempt = null;
  let entries = 0, regularFiles = 0, expandedBytes = 0, capturedBytes = 0, selectedCount = 0;
  let metadataBytes = 0, manifestBytes = 0, reservedPayloadBytes = 0, buffersAllocated = 0, buffersErased = 0, peakPayloadBytes = 0;
  function wipeBody() {
    if (active?.body?.bytes) { active.body.bytes.fill(0); active.body.bytes = null; buffersErased++; }
  }
  function release() {
    wipeBody(); active = null; accepted = []; attempt = null;
    entries = 0; regularFiles = 0; expandedBytes = 0; capturedBytes = 0; selectedCount = 0;
    metadataBytes = 0; manifestBytes = 0; reservedPayloadBytes = 0; buffersAllocated = 0; buffersErased = 0; peakPayloadBytes = 0;
  }
  function guarded(fn) {
    try { return fn(); } catch (error) {
      if (!failure) {
        const attempted = attempt ?? active?.body?.target;
        const literal = attempted ? SPLIT_TOOLCHAIN_EVIDENCE_TARGETS[part].find(t => t.path === attempted.path) : null;
        failure = Object.freeze({ code: errors.has(error) ? error.code : 'E_EVIDENCE_DATA',
          role: active?.input.role ?? null, path: literal?.path ?? null, kind: literal?.kind ?? null, index: literal?.index ?? null,
          sourceProfile: 'SPLIT_TOOLCHAIN_EVIDENCE_DATA', part,
          underlyingCode: errors.has(error) ? error.underlyingCode : fixedCode(error, 'code', tarCodes),
          scope: 'ATTEMPTED_LITERAL_ONLY_NOT_PROVISIONAL_EVIDENCE' });
      }
      release(); state = 'FAILED';
      if (errors.has(error)) throw error;
      fail('E_EVIDENCE_DATA');
    }
  }
  const noArgs = args => { if (args.length) fail('E_EVIDENCE_INPUT'); };
  const requireActive = () => { if (state !== 'ACTIVE') fail('E_EVIDENCE_STATE'); };
  function metadataCharge(cost) {
    if (cost > limits.maxRoleMetadataBytes - active.metadataBytes || cost > limits.maxBatchMetadataBytes - metadataBytes) fail('E_EVIDENCE_METADATA');
    active.metadataBytes += cost; metadataBytes += cost;
  }
  function append(list, value) {
    const cost = jsonSize(value, limits.maxRoleMetadataBytes) + (list.length ? 1 : 0);
    metadataCharge(cost); list.push(freeze(value));
  }
  function completeBody() {
    const b = active.body;
    if (!b || b.used !== b.event.size) fail('E_EVIDENCE_SPAN');
    const sha256 = b.hash.digest('hex'); b.hash = null;
    const member = { ...b.event, bodySha256: sha256 };
    attempt = b.target;
    try {
      if (b.target && b.target.expectedSha256 !== null && sha256 !== b.target.expectedSha256) fail('E_EVIDENCE_BODY_HASH');
      if (!mockOnly && b.manifest === 'GNU_RAW_TEXT' && b.event.path.endsWith('/sdk-relocs')
        && (b.event.size !== SDK_RELOCS_BYTES || sha256 !== SDK_RELOCS_SHA256)) fail('E_EVIDENCE_BODY_HASH');
      if (b.manifest) {
        let text;
        try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(b.bytes); } catch { fail('E_EVIDENCE_MANIFEST'); }
        wipeBody();
        const declarations = [];
        const manifestRecord = { path: b.event.path, kind: b.manifest, bodySha256: sha256, text, declarations, interpreted: false };
        metadataCharge(jsonSize(manifestRecord, limits.maxRoleMetadataBytes) + (active.manifests.length ? 1 : 0));
        let at = 0;
        if (b.manifest === 'RUST_MANIFEST') while (at < text.length) {
          const stop = text.indexOf('\n', at), end = stop === -1 ? text.length : stop;
          const line = text.slice(at, end); at = end + 1;
          if (line.startsWith('file:') || line.startsWith('dir:')) {
            const colon = line.indexOf(':'), path = line.slice(colon + 1);
            if (!canonical(path)) fail('E_EVIDENCE_MANIFEST');
            const declaration = { kind: line.slice(0, colon), path };
            const cost = jsonSize(declaration, limits.maxRoleMetadataBytes) + (declarations.length ? 1 : 0);
            if (declarations.length >= limits.maxEntries) fail('E_EVIDENCE_METADATA');
            metadataCharge(cost); declarations.push(freeze(declaration));
          }
        }
        active.manifests.push(freeze(manifestRecord));
      }
      if (b.target) {
        const metadata = inspect(b.target, b.bytes, trusted, limits);
        append(active.selected, { ...b.target, index: b.event.index, bodyOffset: b.event.bodyOffset, size: b.event.size,
          bodySha256: sha256, hashObservation: b.target.expectedSha256 === null ? 'FRESH_BODY_HASH' : 'MATCHED_EXPECTED_BODY_HASH',
          metadata, qualified: false, abiVerified: false, roleSatisfied: false });
        selectedCount++;
      }
      active.members.push(freeze(member));
    } finally { wipeBody(); }
    active.body = null; attempt = null;
  }
  function consumeBody(view, start, end) {
    const b = active.body;
    if (!b) return;
    const from = Math.max(start, b.event.bodyOffset), to = Math.min(end, b.event.bodyOffset + b.event.size);
    if (to > from) {
      if (from !== b.event.bodyOffset + b.used) fail('E_EVIDENCE_SPAN');
      const part = view.subarray(from - start, to - start);
      b.hash.update(part); if (b.bytes) b.bytes.set(part, b.used); b.used += part.length;
      if (b.target) capturedBytes += part.length;
    }
    if (b.used === b.event.size) completeBody();
  }
  function event(value, start, end) {
    const p = data(value), linked = p.type === 'symlink' || p.type === 'hardlink';
    const keys = ['index','path','type','size','bodyOffset', ...(linked ? ['linkpath','linkKind'] : []), 'mode','uid','gid','mtime'];
    data(value, keys);
    if (!Object.isFrozen(value) || !canonical(p.path) || !['file','directory','symlink','hardlink'].includes(p.type)
      || p.path !== active.input.expectedRoot && !p.path.startsWith(active.input.expectedRoot + '/')
      || p.path === active.input.expectedRoot && p.type !== 'directory') fail('E_EVIDENCE_ROOT');
    if (p.index !== active.entries + 1 || !integer(p.size) || p.size > limits.maxExpandedBytes || p.type !== 'file' && p.size !== 0
      || !integer(p.bodyOffset, 512) || p.bodyOffset % 512 || p.bodyOffset < active.nextBodyOffset
      || p.bodyOffset <= start || p.bodyOffset > end || !Number.isSafeInteger(p.bodyOffset + p.size)) fail('E_EVIDENCE_EVENT');
    for (const key of ['mode','uid','gid']) if (!integer(p[key])) fail('E_EVIDENCE_EVENT');
    if (typeof p.mtime !== 'string' || p.mtime.length > 32 || !/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u.test(p.mtime)
      || BigInt(p.mtime.split('.')[0]) > BigInt(Number.MAX_SAFE_INTEGER) || BigInt(p.mtime.split('.')[0]) < -BigInt(Number.MAX_SAFE_INTEGER)) fail('E_EVIDENCE_EVENT');
    if (linked && (typeof p.linkpath !== 'string' || !p.linkpath || Buffer.byteLength(p.linkpath) > 1024 || /[\u0000-\u001f\u007f-\u009f\\]/u.test(p.linkpath)
      || p.linkKind !== (p.linkpath.startsWith('/') || /^[A-Za-z]:/u.test(p.linkpath) ? 'absolute' : p.linkpath.split('/').includes('..') ? 'parent-components' : 'relative'))) fail('E_EVIDENCE_EVENT');
    if (active.body) fail('E_EVIDENCE_SPAN');
    const byPath = targets.find(t => t.path === p.path), byIndex = active.targets.find(t => t.index === p.index);
    attempt = byPath ?? byIndex ?? null;
    if (byPath || byIndex) {
      if (!byPath || byPath.artifactRole !== active.input.role || p.type !== 'file' || byIndex && byIndex !== byPath
        || byPath.index !== null && byPath.index !== p.index || byPath.bodyOffset !== null && byPath.bodyOffset !== p.bodyOffset
        || byPath.size !== null && byPath.size !== p.size || active.seen.has(byPath.path)) fail('E_EVIDENCE_TARGET');
      active.seen.add(byPath.path);
    }
    const manifest = manifestKind(active.input, p.path);
    if (manifest && (p.type !== 'file' || byPath)) fail('E_EVIDENCE_MANIFEST');
    if (byPath) {
      const cap = byPath.kind === 'AR' ? limits.maxArBytes : byPath.kind === 'LINKER_TEXT' ? limits.maxTextBytes : byPath.kind === 'ELF_EXEC_DSO' ? limits.maxElfSnapshotBytes : limits.maxPayloadBytes;
      if (p.size > byPath.maxBytes || p.size > cap || p.size > limits.maxPayloadBytes
        || p.size > limits.maxAggregatePayloadBytes - reservedPayloadBytes) fail('E_EVIDENCE_LIMIT');
      reservedPayloadBytes += p.size;
    }
    if (manifest) {
      if (p.size > limits.maxManifestBytes || p.size > limits.maxBatchManifestBytes - manifestBytes) fail('E_EVIDENCE_MANIFEST_LIMIT');
      if (!mockOnly && active.input.role === 'gnu-sdk' && p.size !== (p.path.endsWith('/sdk-relocs') ? SDK_RELOCS_BYTES : 79)) fail('E_EVIDENCE_MANIFEST');
      manifestBytes += p.size; active.manifestBytes += p.size;
    }
    active.legacyHash.update(JSON.stringify(legacyEvent(p)) + '\n');
    active.offsetHash.update(JSON.stringify(value) + '\n');
    active.entries++; entries++;
    active.nextBodyOffset = Math.ceil((p.bodyOffset + p.size) / 512) * 512 + 512;
    if (p.type === 'file') {
      active.regularFiles++; regularFiles++;
      metadataCharge(jsonSize({ ...p, bodySha256: '0'.repeat(64) }, limits.maxRoleMetadataBytes) + (active.members.length ? 1 : 0));
      const bytes = byPath || manifest ? Buffer.alloc(p.size) : null;
      if (bytes) { buffersAllocated++; peakPayloadBytes = Math.max(peakPayloadBytes, p.size); }
      active.body = { event: { ...p }, target: byPath ?? null, manifest, bytes, hash: createHash('sha256'), used: 0 };
    } else append(active.members, { ...p, bodySha256: null, linkFollowed: false });
    attempt = null;
  }
  function feed(token, chunk) {
    return guarded(() => {
      requireActive();
      if (!active || active.token !== token || !active.parser || active.inventory) fail('E_EVIDENCE_STATE');
      const view = chunkView(chunk, limits.maxChunkBytes), start = active.cursor, end = start + view.length;
      if (view.length > limits.maxExpandedBytes - start || view.length > limits.maxBatchExpandedBytes - expandedBytes || end > active.expected.expandedBytes) fail('E_EVIDENCE_EXPANDED');
      const events = active.parser.feed(chunk), n = arrayLength(events);
      if (!Object.isFrozen(events) || n > limits.maxEntries - active.entries || n > limits.maxBatchEntries - entries) fail('E_EVIDENCE_ENTRIES');
      active.hash.update(view);
      consumeBody(view, start, end);
      for (let i = 0; i < n; i++) { event(events[i], start, end); consumeBody(view, start, end); }
      active.cursor = end; expandedBytes += view.length;
      return events;
    });
  }
  function finishParser(token) {
    return guarded(() => {
      requireActive();
      if (!active || active.token !== token || !active.parser || active.inventory || active.body) fail('E_EVIDENCE_STATE');
      const inventory = active.parser.finish(), p = data(inventory);
      if (!Object.isFrozen(inventory) || p.state !== 'TAR_INVENTORY' || p.mockOnly !== false || p.expandedBytes !== active.cursor || p.entries !== active.entries
        || active.entries !== active.expected.entries || active.regularFiles !== active.expected.regularFiles || p.headers !== active.expected.headers
        || p.expandedBytes !== active.expected.expandedBytes || active.seen.size !== active.targets.length || active.selected.length !== active.targets.length) fail('E_EVIDENCE_SUMMARY');
      for (const key of ['decoderQualified','realArchiveInspected','extractionAuthorized','pythonFreeSubsetVerified','installedUsability','rustReady','trainingReady','nativeQualified','provenanceVerified']) if (p[key] !== false) fail('E_EVIDENCE_SUMMARY');
      for (const [key, cap] of [['headers','maxHeaders'],['extensionBytes','maxExtensionBytes'],['outputBytes','maxOutputBytes'],['collisionBytes','maxCollisionBytes'],['dataEvents','maxDataEvents']]) {
        if (!integer(p[key]) || p[key] > active.parserLimits[cap]) fail('E_EVIDENCE_SUMMARY');
      }
      const decodedSha256 = active.hash.digest('hex'), legacyMetadataSha256 = active.legacyHash.digest('hex'), offsetMetadataSha256 = active.offsetHash.digest('hex');
      active.hash = null; active.legacyHash = null; active.offsetHash = null;
      if (decodedSha256 !== active.expected.decodedSha256) fail('E_EVIDENCE_DECODED_HASH');
      if (p.metadataSha256 !== offsetMetadataSha256 || (active.input.role === 'gnu-sdk' ? legacyMetadataSha256 : offsetMetadataSha256) !== active.expected.metadataSha256) fail('E_EVIDENCE_METADATA_HASH');
      active.observed = { decodedSha256, legacyMetadataSha256, legacyMetadataHashKind: 'LEGACY_WITHOUT_BODY_OFFSET',
        offsetMetadataSha256, offsetMetadataHashKind: 'OFFSET_EVENT_METADATA' };
      active.inventory = inventory; active.parser = null;
      return inventory;
    });
  }
  function beginToolchainEvidenceBatch(...args) {
    return guarded(() => { noArgs(args); if (state !== 'IDLE') fail('E_EVIDENCE_STATE'); state = 'ACTIVE'; });
  }
  function beginToolchainEvidenceRole(...args) {
    return guarded(() => {
      requireActive();
      if (args.length !== 1 || active || accepted.length >= inputs.length || args[0] !== inputs[accepted.length].role) fail('E_EVIDENCE_STATE');
      const i = accepted.length, input = inputs[i];
      active = { input, expected: expectations[i], targets: targets.filter(t => t.artifactRole === input.role), token: Symbol(input.role),
        factoryUsed: false, parser: null, inventory: null, parserLimits: null, hash: createHash('sha256'), legacyHash: createHash('sha256'), offsetHash: createHash('sha256'),
        entries: 0, regularFiles: 0, cursor: 0, nextBodyOffset: 512, body: null, members: [], manifests: [], selected: [], seen: new Set(),
        metadataBytes: 0, manifestBytes: 0 };
      metadataCharge(6);
    });
  }
  function createTarInventory(...args) {
    return guarded(() => {
      requireActive();
      if (args.length > 1 || !active || active.factoryUsed) fail('E_EVIDENCE_STATE');
      const base = { ...INVENTORY_LIMITS, maxExtensionBytes: 4194304, maxExpandedBytes: limits.maxExpandedBytes, maxHeaders: limits.maxEntries, maxChunkBytes: limits.maxChunkBytes };
      const parserLimits = lower(args.length ? args[0] : {}, base), parser = data(trusted.parserFactory(parserLimits), ['feed','finish']);
      for (const key of ['feed','finish']) if (typeof parser[key] !== 'function' || types.isProxy(parser[key])) fail('E_EVIDENCE_INPUT');
      active.factoryUsed = true; active.parser = parser; active.parserLimits = parserLimits;
      const token = active.token;
      return Object.freeze({ feed: (...a) => guarded(() => { if (a.length !== 1) fail('E_EVIDENCE_INPUT'); return feed(token, a[0]); }),
        finish: (...a) => guarded(() => { noArgs(a); return finishParser(token); }) });
    });
  }
  function acceptToolchainEvidenceRole(...args) {
    return guarded(() => {
      requireActive();
      if (args.length !== 1 || !active?.inventory || accepted.length >= inputs.length || active.input !== inputs[accepted.length]) fail('E_EVIDENCE_STATE');
      const p = data(args[0]), input = active.input;
      if (p.state !== 'GNU_SDK_DATA_INVENTORY' || p.mockOnly !== mockOnly || p.inventory !== active.inventory
        || p.archiveBytes !== input.archiveBytes || p.archiveSha256 !== input.archiveSha256 || p.archivePasses !== 2
        || p.archiveDataBytes !== input.archiveBytes * 2 || p.archiveRequestedBytes !== input.archiveBytes * 2 + 2
        || p.closeAttempts !== 2 || p.stdinFinished !== true || p.stdoutEnded !== true || p.stderrEnded !== true || p.closeObserved !== true
        || p.exitCode !== 0 || p.signal !== null || coreFlags.some(key => p[key] !== false)) fail('E_EVIDENCE_CORE');
      for (const key of Object.keys(negativeFlags)) if (Object.hasOwn(p, key) && p[key] !== false) fail('E_EVIDENCE_CORE');
      const record = { role: input.role, archiveBytes: input.archiveBytes, archiveSha256: input.archiveSha256, decoderMemoryBytes: input.decoderMemoryBytes,
        expectedRoot: input.expectedRoot, ...active.expected, ...active.observed, inventory: active.inventory,
        members: active.members, manifests: active.manifests, selected: active.selected, completeNamespace: true, qualified: false };
      const overhead = { ...record, members: [], manifests: [], selected: [] };
      metadataCharge(jsonSize(overhead, limits.maxRoleMetadataBytes) + (accepted.length ? 1 : 0));
      freeze(record); accepted.push(record); active = null;
    });
  }
  function finishToolchainEvidenceBatch(...args) {
    return guarded(() => {
      noArgs(args); requireActive();
      if (active || accepted.length !== inputs.length || selectedCount !== targets.length
        || ['entries','regularFiles','expandedBytes'].some(key => expectations.reduce((n, row) => n + row[key], 0) !== ({ entries, regularFiles, expandedBytes })[key])) fail('E_EVIDENCE_STATE');
      const declaredNeededEdges = [];
      let edgeBytes = 2;
      for (const role of accepted) for (const member of role.selected) if (member.kind === 'ELF_EXEC_DSO') {
        for (const needed of member.metadata.requirements.dynamic.needed) {
          const edge = { artifactRole: member.artifactRole, from: member.path, domain: member.domain, needed,
            status: 'UNRESOLVED', providerQualified: false, abiVerified: false, aliasFollowed: false, hostTargetPromotion: false };
          const cost = jsonSize(edge, limits.maxBatchMetadataBytes) + (declaredNeededEdges.length ? 1 : 0);
          if (cost > limits.maxBatchMetadataBytes - metadataBytes - edgeBytes) fail('E_EVIDENCE_METADATA');
          edgeBytes += cost; declaredNeededEdges.push(freeze(edge));
        }
      }
      if (metadataBytes + edgeBytes > limits.maxBatchMetadataBytes) fail('E_EVIDENCE_METADATA');
      const resourceAccounting = { metadataBytes: metadataBytes + edgeBytes, manifestBytes, capturedBytes, buffersAllocated, buffersErased, peakPayloadBytes,
        maxAdditionalElfSnapshotBytes: limits.maxElfSnapshotBytes, secureStringErasureClaimed: false,
        metadataAccounting: 'ESCAPED_ASCII_JSON_MEMBERS_MANIFESTS_SELECTED_ROLE_ENVELOPES_AND_EDGES',
        outputAccounting: 'ESCAPED_ASCII_COMPLETE_HELPER_OBJECT_EXCLUDING_LF_AND_CONTROLLER_ENVELOPE',
        separatelyBoundedParserStateAndChunkCopies: true, hardRssBounded: false };
      const envelope = { profile: 'SPLIT_TOOLCHAIN_EVIDENCE_DATA', state: 'SPLIT_TOOLCHAIN_EVIDENCE_DATA', part, mockOnly,
        artifactCount: inputs.length, entries, regularFiles, expandedBytes, targetCount: targets.length, selectedPayloads: targets.length, roles: [], declaredNeededEdges: [],
        completeNamespace: true, dataScope: 'FRESH_CLOSED_PARTITION_DATA_NOT_INSTALLATION_OR_QUALIFICATION', newProfile: true,
        historicalRawNotRestored: true, historicalRawRecovered: false, constraints: limits, resourceAccounting, ...negativeFlags };
      const cost = jsonSize(envelope, limits.maxOutputBytes, 'E_EVIDENCE_OUTPUT')
        + jsonSize(accepted, limits.maxOutputBytes, 'E_EVIDENCE_OUTPUT') - 2
        + jsonSize(declaredNeededEdges, limits.maxOutputBytes, 'E_EVIDENCE_OUTPUT') - 2;
      if (cost > limits.maxOutputBytes) fail('E_EVIDENCE_OUTPUT');
      const result = freeze({ ...envelope, roles: accepted, declaredNeededEdges });
      release(); state = 'FINISHED'; return result;
    });
  }
  function abortToolchainEvidenceBatch(...args) {
    return guarded(() => { noArgs(args); release(); if (state !== 'FINISHED' && state !== 'FAILED') state = 'ABORTED'; });
  }
  function getToolchainEvidenceFailure(...args) { return guarded(() => { noArgs(args); return failure; }); }
  function snapshotToolchainEvidenceBatch(...args) {
    return guarded(() => {
      noArgs(args);
      return Object.freeze({ state, part, mockOnly, acceptedRoles: accepted.length, currentRole: active?.input.role ?? null, entries, regularFiles, expandedBytes,
        selectedPayloads: selectedCount, capturedBytes, metadataBytes, manifestBytes, activeBufferBytes: active?.body?.bytes?.length ?? 0,
        activeBodyHashes: active?.body ? 1 : 0, buffersAllocated, buffersErased, peakPayloadBytes, failureCode: failure?.code ?? null, failureRole: failure?.role ?? null });
    });
  }
  return Object.freeze({ beginToolchainEvidenceBatch, beginToolchainEvidenceRole, createTarInventory, acceptToolchainEvidenceRole,
    finishToolchainEvidenceBatch, abortToolchainEvidenceBatch, getToolchainEvidenceFailure, snapshotToolchainEvidenceBatch });
}

// WHAT: Closed partition, lower-only in-memory fixture.
export function createSplitToolchainEvidenceFixture(...args) {
  if (args.length !== 3) fail('E_EVIDENCE_INPUT');
  const [part, profile, trusted] = args; requirePart(part);
  const originals = SPLIT_TOOLCHAIN_EVIDENCE_INPUTS[part], selected = SPLIT_TOOLCHAIN_EVIDENCE_TARGETS[part], expected = SPLIT_TOOLCHAIN_EVIDENCE_EXPECTATIONS[part];
  const p = data(profile, ['mockOnly','inputs','targets','expectations','limits']);
  const t = data(trusted, ['parserFactory','elfInspector','formatInspectors']), formats = data(t.formatInspectors, ['rel','archive','linker']);
  if (p.mockOnly !== true || arrayLength(p.inputs, originals.length) !== originals.length || arrayLength(p.targets, selected.length) !== selected.length || arrayLength(p.expectations, expected.length) !== expected.length) fail('E_EVIDENCE_INPUT');
  for (const fn of [t.parserFactory, t.elfInspector, ...Object.values(formats)]) if (typeof fn !== 'function' || types.isProxy(fn)) fail('E_EVIDENCE_INPUT');
  const inputs = p.inputs.map((value, i) => {
    const v = data(value, Object.keys(originals[i])), original = originals[i];
    if (v.role !== original.role || v.expectedRoot !== original.expectedRoot || v.decoderMemoryBytes !== original.decoderMemoryBytes
      || typeof v.root !== 'string' || !v.root.startsWith('/fixture/') || !canonical(v.root.slice(1)) || v.file !== `${v.root}/${v.expectedRoot}.tar.xz`
      || !integer(v.archiveBytes, 1) || v.archiveBytes > original.archiveBytes || !isDigest(v.archiveSha256) || v.archiveSha256 === original.archiveSha256) fail('E_EVIDENCE_INPUT');
    const identity = data(v.identity, ['root','file']), captured = {};
    for (const kind of ['root','file']) {
      const stat = data(identity[kind], ['dev','ino','mode','uid','gid','nlink','size','mtimeNs','ctimeNs']);
      for (const field of Object.keys(stat)) if (typeof stat[field] !== 'string' || stat[field].length > 40 || !/^(?:0|[1-9][0-9]*)$/u.test(stat[field])) fail('E_EVIDENCE_INPUT');
      if (stat.ino === '0' || stat.uid !== '1000' || stat.gid !== '1000' || stat.mode !== (kind === 'root' ? '16832' : '33152')
        || stat.nlink !== (kind === 'root' ? '2' : '1') || kind === 'file' && stat.size !== String(v.archiveBytes)) fail('E_EVIDENCE_INPUT');
      captured[kind] = stat;
    }
    return freeze({ ...v, identity: captured });
  });
  const targets = p.targets.map((value, i) => {
    const original = selected[i], v = data(value, Object.keys(original));
    for (const key of ['artifactRole','path','kind','domain','selectionRole','optionalForMinimalC']) if (v[key] !== original[key]) fail('E_EVIDENCE_TARGET');
    if (manifestKind(originals.find(input => input.role === v.artifactRole), v.path)) fail('E_EVIDENCE_MANIFEST');
    for (const key of ['index','bodyOffset','size']) {
      if (original[key] === null && v[key] === null) continue;
      if (!integer(v[key], key === 'size' ? 0 : 1) || original[key] !== null && v[key] > original[key]) fail('E_EVIDENCE_LIMIT');
    }
    if (v.bodyOffset !== null && v.bodyOffset % 512 || !integer(v.maxBytes, 1) || v.maxBytes > original.maxBytes
      || v.expectedSha256 !== null && (!isDigest(v.expectedSha256) || v.expectedSha256 === original.expectedSha256)
      || original.expectedSha256 !== null && v.expectedSha256 === null) fail('E_EVIDENCE_INPUT');
    return freeze(v);
  });
  const expectations = p.expectations.map((value, i) => {
    const original = expected[i], v = data(value, Object.keys(original));
    if (v.role !== original.role || v.metadataHashKind !== original.metadataHashKind || !isDigest(v.decodedSha256) || !isDigest(v.metadataSha256)
      || v.decodedSha256 === original.decodedSha256 || v.metadataSha256 === original.metadataSha256) fail('E_EVIDENCE_INPUT');
    for (const key of ['expandedBytes','entries','headers','regularFiles']) if (!integer(v[key], 1) || v[key] > original[key]) fail('E_EVIDENCE_LIMIT');
    if (v.headers < v.entries || v.regularFiles > v.entries || v.expandedBytes > 1048576) fail('E_EVIDENCE_INPUT');
    return freeze(v);
  });
  return collector({ part, mockOnly: true, inputs: freeze(inputs), targets: freeze(targets), expectations: freeze(expectations), limits: lower(p.limits, SPLIT_TOOLCHAIN_EVIDENCE_LIMITS) },
    { parserFactory: t.parserFactory, elfInspector: t.elfInspector, formatInspectors: freeze(formats) });
}
const production = new Map();
export function createSplitToolchainEvidenceCollector(...args) {
  if (args.length !== 1) fail('E_EVIDENCE_INPUT');
  const [part] = args; requirePart(part);
  if (production.has(part)) fail('E_EVIDENCE_STATE');
  const instance = collector({ part, mockOnly: false, inputs: SPLIT_TOOLCHAIN_EVIDENCE_INPUTS[part], targets: SPLIT_TOOLCHAIN_EVIDENCE_TARGETS[part],
    expectations: SPLIT_TOOLCHAIN_EVIDENCE_EXPECTATIONS[part], limits: SPLIT_TOOLCHAIN_EVIDENCE_LIMITS },
  { parserFactory: originalCreateTarInventory, elfInspector: inspectElf64RequirementsV5, formatInspectors: SOURCE_FORMAT_INSPECTORS });
  production.set(part, instance); return instance;
}
