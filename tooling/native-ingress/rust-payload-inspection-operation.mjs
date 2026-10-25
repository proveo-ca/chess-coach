// SPEC: _spec/tooling/native-ingress/step2.puml
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawn as nodeSpawn } from 'node:child_process';
import { types } from 'node:util';

const freeze = value => {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
};
const REPO = '/tmp/opencode/f9-bootstrap-correspondence';
const ROOT = '/tmp/opencode/f9-rust-runtime-inputs-01';
const DECODER = '/tmp/opencode/f9-xz-qualification-01';
const FIELDS = freeze(['dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtimeNs', 'ctimeNs']);
export const RUST_PAYLOAD_ROLES = freeze(['cargo', 'rustc', 'rust-std', 'rustfmt-preview', 'clippy-preview']);
const rootIdentity = freeze({ dev: '28', ino: '13954', mode: '16832', uid: '1000', gid: '1000', nlink: '2',
  size: '4096', mtimeNs: '1792857301045485610', ctimeNs: '1792857301045485610' });
export const RUST_PAYLOAD_INPUTS = freeze([
  { role: 'cargo', root: ROOT, file: ROOT + '/cargo-1.95.0-x86_64-unknown-linux-gnu.tar.xz', archiveBytes: 10984780,
    archiveSha256: 'e74edd2cf7d0f1f1383b4f00eb90c843750bc489e2ccf7214e6476678a907425', expectedRoot: 'cargo-1.95.0-x86_64-unknown-linux-gnu',
    identity: { root: rootIdentity, file: { dev: '29', ino: '1211150', mode: '33152', uid: '1000', gid: '1000', nlink: '1', size: '10984780', mtimeNs: '1792857299153485617', ctimeNs: '1792857299153485617' } } },
  { role: 'rustc', root: ROOT, file: ROOT + '/rustc-1.95.0-x86_64-unknown-linux-gnu.tar.xz', archiveBytes: 80351960,
    archiveSha256: '8426a3d170a5879f5682f5fbdd024a1779b3951e7baba685af2d6dc32a6dfc15', expectedRoot: 'rustc-1.95.0-x86_64-unknown-linux-gnu',
    identity: { root: rootIdentity, file: { dev: '29', ino: '1211151', mode: '33152', uid: '1000', gid: '1000', nlink: '1', size: '80351960', mtimeNs: '1792857300349485612', ctimeNs: '1792857300349485612' } } },
  { role: 'rust-std', root: ROOT, file: ROOT + '/rust-std-1.95.0-x86_64-unknown-linux-gnu.tar.xz', archiveBytes: 29573972,
    archiveSha256: '047ea7098803d3500fa1072e9cee5392697e21525559e4458128a2bf874aa382', expectedRoot: 'rust-std-1.95.0-x86_64-unknown-linux-gnu',
    identity: { root: rootIdentity, file: { dev: '29', ino: '1211153', mode: '33152', uid: '1000', gid: '1000', nlink: '1', size: '29573972', mtimeNs: '1792857300901485610', ctimeNs: '1792857300901485610' } } },
  { role: 'rustfmt-preview', root: ROOT, file: ROOT + '/rustfmt-1.95.0-x86_64-unknown-linux-gnu.tar.xz', archiveBytes: 2164880,
    archiveSha256: 'f1b2a7301513ffdd95ebf22ebbdd932e4d17fc806f748d93924740d0297b1396', expectedRoot: 'rustfmt-1.95.0-x86_64-unknown-linux-gnu',
    identity: { root: rootIdentity, file: { dev: '29', ino: '1211154', mode: '33152', uid: '1000', gid: '1000', nlink: '1', size: '2164880', mtimeNs: '1792857301041485610', ctimeNs: '1792857301041485610' } } },
  { role: 'clippy-preview', root: ROOT, file: ROOT + '/clippy-1.95.0-x86_64-unknown-linux-gnu.tar.xz', archiveBytes: 4697128,
    archiveSha256: 'ac779bc9839dd47180806b133e4e2563c4a34716284cd5b8fede8ef289f452ca', expectedRoot: 'clippy-1.95.0-x86_64-unknown-linux-gnu',
    identity: { root: rootIdentity, file: { dev: '29', ino: '1211155', mode: '33152', uid: '1000', gid: '1000', nlink: '1', size: '4697128', mtimeNs: '1792857301361485608', ctimeNs: '1792857301361485608' } } },
]);
export const RUST_PAYLOAD_EXPECTATIONS = freeze([
  ['cargo', 42864128, 68, 68, '97faa298dac62ef85e60ac1bd30a343bfc8e1f587aee6b2875f6e9db7f3877d9', '22429805eca884d4f844843c8e7bc3dc3796737067e19274387953e5081a88f6'],
  ['rustc', 402308096, 70, 71, '9a00ed58e31abdede8d8acfc74bd92e3afdb3fc3089a220f63b680830a8b471f', '08c25740ad1acbcdf84625b6f05b316f994cba94efdb4f262749b5bbad7e0cc0'],
  ['rust-std', 166755840, 81, 146, 'f013cd265653f00e2a719b4b51daef65a9b73fa2527118a5b5baa64b0c203c75', 'a48379ce9b557559ff0e95c7f34a415fb454dad32e63a7f5ec77feb75bcbde96'],
  ['rustfmt-preview', 9112576, 22, 22, '33bf584dc2495890a712b449dc1cefda8fdcc8d1f940a67cd46fe1f6325bbe74', '7c33b012cd3b219844ee0d7c0bd3537ec1f1639883925207cb95474fbd43d6a2'],
  ['clippy-preview', 21706240, 22, 22, '2c4f9abdde502a3a18ce32db066f1d8cd866cfe1cf4d853db6994b46435020dc', 'a0b25caf8a302f4a7edf7f6c0ed3ab9cbf15e6a626bbd6de42babe694ede0f87'],
].map(([role, expandedBytes, entries, headers, metadataSha256, decodedSha256]) => ({ role, expandedBytes, entries, headers, metadataSha256, decodedSha256 })));
export const RUST_PAYLOAD_TARGETS = freeze([
  ['cargo', 'cargo/bin/cargo', 66, 651776, 42185192, '841072d1d92f9e841d9ba5b0814182a0adf064acf4527cd120967b7bc49dcb66'],
  ['rustc', 'rustc/bin/rustdoc', 25, 41984, 13303096, 'e5144902aed6cf94280eae3ad7708da5bdd3819b5281728af432d0e70231439c'],
  ['rustc', 'rustc/bin/rustc', 26, 13345792, 644784, 'bff349e72704ff70bc08a234a3847338e797065bbedde5e556808bc87b7bf7c6'],
  ['rustc', 'rustc/lib/rustlib/x86_64-unknown-linux-gnu/bin/rust-lld', 29, 19527680, 11604688, '60f305b55da767671e895b231e0c78e87f4ccbf790d7181842039c53bb60281c'],
  ['rustc', 'rustc/lib/rustlib/x86_64-unknown-linux-gnu/bin/gcc-ld/ld.lld', 31, 31511040, 376864, 'e7d44b7571a8250326e99aa238aa4be7ddaa1fa696cf3c0e2ca829da5846b325'],
  ['rustc', 'rustc/lib/libLLVM.so.22.1-rust-1.95.0-stable', 34, 31897088, 199603328, 'f6a654c837c51bc2fc00f83d58318607b6f30fec364a00f09b6172129e591fb5'],
  ['rustc', 'rustc/lib/libLLVM-22-rust-1.95.0-stable.so', 47, 246645760, 42, '044a388f61f18a07583a1126fa91c1288ecb0745f41a8369ec4a6b2acb9b51d3'],
  ['rustc', 'rustc/lib/librustc_driver-6108105cd7e839cf.so', 48, 246646784, 153621360, 'ae69468875215df490fde685ec1f1b969743482ba7e0251f4074a222606a5484'],
  ['rust-std', 'rust-std-x86_64-unknown-linux-gnu/lib/rustlib/x86_64-unknown-linux-gnu/lib/libstd-d1237ef7159db0a2.so', 80, 161335296, 5418488, 'abca53e870629e3f9f97ae72897181dcc4db555d8e6ace00351b02a74ef77c81'],
  ['rustfmt-preview', 'rustfmt-preview/bin/cargo-fmt', 21, 99840, 3715584, 'cd554fed0211e007995a6a540a7fd67bf22354986ae64960c752bb943d8e1184'],
  ['rustfmt-preview', 'rustfmt-preview/bin/rustfmt', 22, 3815936, 5295560, '56b31ad3ec8fe0277a2884a189e243b8f04e9b48e5fd22e547c1516c5f8fd34c'],
  ['clippy-preview', 'clippy-preview/bin/clippy-driver', 20, 99840, 20339280, '81bd985ee50d78e9d8c5810f6ca836614d1bf95e0e8142f1ec5f42eb250ed729'],
  ['clippy-preview', 'clippy-preview/bin/cargo-clippy', 22, 20441088, 1263912, 'b71b1263063707608daa1e9b231ad9d87507c11d6aa178ede2b01d8372d5effb'],
].map(([role, path, index, bodyOffset, size, sha256]) => ({ role,
  path: RUST_PAYLOAD_INPUTS.find(input => input.role === role).expectedRoot + '/' + path,
  index, bodyOffset, size, sha256, kind: size === 42 ? 'LINKER_TEXT' : 'ELF_EXEC_DSO', domain: role === 'rust-std' ? 'TARGET' : 'HOST' })));
const DELIVERED_PINS = freeze({ helper: { bytes: 38480, sha256: 'ca9ad030e0abcb235943e9fc0c0670988ced32d801fb1f3fd25c17e9ae91c9e8' }, tarLinkedHelper: { bytes: 59285, sha256: 'e49eed113dad86aa12294bbde750819fa4ad7f03e965e35a1792512e7b29602c' }, linkedHelper: { bytes: 88356, sha256: 'e5543ada172aceab6c26280f319b1d61fb212dc3a084d447f4975775f816b971' }, linkedCores: { cargo: { bytes: 140338, sha256: '02ae20bfb87ef183a241608a194dd3a34ffb83c83eff5da0143e73509b1afcd4' }, rustc: { bytes: 140338, sha256: 'c8496705c5da5142601fd2b70bff4917a3af8f1839460431c651272da79dc19c' }, 'rust-std': { bytes: 140341, sha256: 'b31edbdd6e10a4ff739cfdf1734cbb3d6441e8a5ad41b531e389310a206e065c' }, 'rustfmt-preview': { bytes: 140339, sha256: '66dcb84015d7a009feb9c63cdb31093ab71ffb1564e7ac0651bf3fdc6ef7c7e7' }, 'clippy-preview': { bytes: 140338, sha256: '0c88d086498ea6382986351e24f17aa4c5d65e7fe6c6173148fc03e60af391b1' } } });
export const RUST_PAYLOAD_SOURCE_PINS = freeze({
  layoutOperation: { bytes: 34052, sha256: 'faed15d44d6f88c73f6a9ad219de712a5d012012ec970c3f82189d9195b1041a' },
  rawCore: { bytes: 23261, sha256: 'bd2fc43633ca3b8f0c485eddb68a1b7505002edecd70eee4bf9cc661f588ef29' },
  rawTar: { bytes: 15548, sha256: '050d629963fdf89bd5dff7639260c7de30b08be46320b7b6bb7ed4dac6bb8139' },
  extensionTar: { bytes: 15551, sha256: 'b22db5d375d966016f5551b9161119079960d24f9611cf87d145893887575824' },
  boundedTar: { bytes: 15568, sha256: '56cac49b3cfe51dbf2a7f7d1f4a0d877ae8773f940585ebea72740373689fae2' },
  eventTar: { bytes: 15595, sha256: 'bf8c7fcc56c26aa0618c014d74046dc29b79c09340728b27dd0363a758b9ef9a' },
  stage: { bytes: 16688, sha256: 'f75c21a58bb67e6ab3f8b1dafd090e11ac2d3a70f017da35afb81b00761b71b4' },
  elfMetadata: { bytes: 19842, sha256: 'b223a655eae572137891a2c6efafee16887a2478fc91052f0092b48dfd65de85' },
  elfV5: { bytes: 21800, sha256: '1d9ebc5b27944ab646b2f61d334d2ff4bf43bddf226402ba225f6c02cf11dccb' },
  linkedStage: { bytes: 43154, sha256: '89b6c5e3dcbf902937f81fc642d7238bd4ec4ca3c94f6b61f4d069efdce8c5f2' },
  xzReceipt: { bytes: 4239, sha256: 'e45d65231c0815ab2b895c0d74467500a0e6caf33cc0a4ee342b20489ce6b233' },
  rustReceipt: { bytes: 4012, sha256: 'c068579e97c9c01c707bae0cdffb082bf23d7f089bcd404a114d290e0476be87' },
  layoutReceipt: { bytes: 7637, sha256: '48a8091b6ef4541593aeb98e0140b107e016c36466b323e3570323e337054239' },
  coreStages: {
    cargo: [
      { bytes: 23275, sha256: '110dcdd97383fb76f68233110013cf3523c1b3cf5e98cf02defad9ff83bb988b' },
      { bytes: 23277, sha256: '6624b9afc2118d5076e680b8abc9be5bf1237d1a6fb78b2a7c8e1a1cb24b0fc8' },
      { bytes: 22520, sha256: 'b1ccc79cc2c222b23b0977b1bd40beebe34db42977a8294dda430b915b5268ef' },
      { bytes: 22521, sha256: '34b2f9c0c17ce279c1bee10f8bcdc4cb2c1356c34fda39d3ccf2d78a6a13bcdb' },
    ],
    rustc: [
      { bytes: 23275, sha256: 'f454d03eb05e38c6d6cbf35b0ac6e7d124fa35d67ce571e3809c2ec7a57e2920' },
      { bytes: 23277, sha256: 'c69c365a709d20c8acb03763df98aeeb794a49ef458ffd5658aee4a01c67ac40' },
      { bytes: 22520, sha256: '0d4009e537dfbf1d68207b54a4f20d88fd445c84503b79e69b33d0dd37804bf2' },
      { bytes: 22521, sha256: '9337f4726a133b3924416f97e4614a80db24eba376a87cb0d7af0dae7f552935' },
    ],
    'rust-std': [
      { bytes: 23278, sha256: '91daf6b52b5b6e584e853ab2a7ca4a28f71e33cae760d427b2d84cabf55b8774' },
      { bytes: 23280, sha256: 'a38105ded2e84f2ba6fa85dab4846d50be880754e191c9b3bfcd457f3e1fa77e' },
      { bytes: 22523, sha256: '9124f7230bace6a5ad472cbd4d444dcd2870bf5827e0cd08b00ada571b6b60f1' },
      { bytes: 22524, sha256: '0c5e04dba9504071b9fc474a189448ef669c8e4f4c61ec86ba594c376591838a' },
    ],
    'rustfmt-preview': [
      { bytes: 23276, sha256: 'f9d96eebdb7cd9ccb36842dd895e8cbe1df62c8f5c3d39117b85a68fa445b44b' },
      { bytes: 23278, sha256: '49694ab9b884b7ab43c97f16b683a256f5d77748202f5f253dfde77bdddbdbae' },
      { bytes: 22521, sha256: 'd5bb2b780709858b124b0f4f0b850684d09b4c47a3a4241374b1d1fb4208be38' },
      { bytes: 22522, sha256: '31d73f69bc7ba36d0000ca8d413011b3d30ada226706848d6bdd132c628f11ae' },
    ],
    'clippy-preview': [
      { bytes: 23275, sha256: '20f4b9a83e4d2aac41406b8ef5854fb22a05e3039211d320ade3920b1987080b' },
      { bytes: 23277, sha256: '5658694ca65d2f146579ce3af8f817a3d0174babadeb508c05630c2634c95c62' },
      { bytes: 22520, sha256: '3195aafe805d126cb58184222d30b20e990a9e75fca85132e927cb2dbdfbcecb' },
      { bytes: 22521, sha256: '54b063b2fe9bd69bb0029171ddbcb1a16b10fb23f5e0d8b3a090a689591a5e02' },
    ],
  },
  ...DELIVERED_PINS,
});
const SOURCE_ROWS = freeze([
  ['layoutOperation', 'tooling/native-ingress/rust-component-layout-operation.mjs'],
  ['rawCore', 'tooling/native-ingress/gnu-sdk-inventory.mjs'],
  ['rawTar', 'tooling/native-ingress/tar-inventory.mjs'],
  ['stage', 'tooling/native-ingress/xz-staging.mjs'],
  ['elfMetadata', 'tooling/native-ingress/elf-metadata.mjs'],
  ['elfV5', 'tooling/native-ingress/elf-requirements-v5.mjs'],
  ['helper', 'tooling/native-ingress/rust-payload-inspection.mjs'],
  ['xzReceipt', '_spec/tooling/native-ingress/xz-qualification.receipt.json'],
  ['rustReceipt', '_spec/tooling/native-ingress/rust-runtime-inputs.receipt.json'],
  ['layoutReceipt', '_spec/tooling/native-ingress/rust-component-layout.receipt.json'],
]);
const FLAGS = freeze({ archiveExtracted: false, extracted: false, extractionAuthorized: false, filesInstalled: false,
  rustExecuted: false, runtimeExecuted: false, pythonRuntimeInvoked: false, nativeQualified: false, nativeAuthority: false,
  rustReady: false, trainingReady: false, pythonFreeSubsetVerified: false, dockerProviderQualified: false,
  installedUsability: false, relocationReady: false, roleSatisfied: false, provenanceVerified: false,
  loaderClosureVerified: false, decoderQualified: false, abiVerified: false, runtimeProvidersQualified: false,
  qualified: false, providerQualified: false,
  imagePrepared: false, sourceReady: false, rootfsReady: false, installReady: false,
  hardRssBounded: false, hardDeadlineGuaranteed: false, processTreeBounded: false });
const PAYLOAD_CODES = freeze(['E_PAYLOAD_INPUT', 'E_PAYLOAD_LIMIT', 'E_PAYLOAD_STATE', 'E_PAYLOAD_DATA',
  'E_PAYLOAD_CHUNK', 'E_PAYLOAD_EXPANDED', 'E_PAYLOAD_ENTRIES', 'E_PAYLOAD_ROOT', 'E_PAYLOAD_EVENT',
  'E_PAYLOAD_TARGET', 'E_PAYLOAD_SPAN', 'E_PAYLOAD_BODY_HASH', 'E_PAYLOAD_DECODED_HASH', 'E_PAYLOAD_SUMMARY',
  'E_PAYLOAD_CORE', 'E_PAYLOAD_ELF', 'E_PAYLOAD_LINKER_TEXT', 'E_PAYLOAD_LINKER_UNSUPPORTED',
  'E_PAYLOAD_METADATA', 'E_PAYLOAD_OUTPUT']);
const TAR_CODES = freeze(['E_LIMITS', 'E_UTF8', 'E_TEXT', 'E_NUMBER', 'E_PAX_NUMBER', 'E_PAX', 'E_PAX_KEY',
  'E_PAX_DUPLICATE', 'E_PATH', 'E_SEALED', 'E_INTERNAL', 'E_GNU_LONG', 'E_DANGLING_EXTENSION', 'E_TERMINATOR',
  'E_HEADERS', 'E_CHECKSUM', 'E_MAGIC', 'E_SIZE', 'E_EXTENSION_REPEAT', 'E_EXTENSION_BYTES', 'E_NONFILE_BODY',
  'E_TYPE', 'E_LINK', 'E_COLLISION', 'E_COLLISION_BYTES', 'E_EVENT_BYTES', 'E_OUTPUT_BYTES', 'E_SPAN_BYTES',
  'E_CHUNK', 'E_DATA_EVENTS', 'E_EXPANDED_BYTES', 'E_PADDING', 'E_TRAILING', 'E_TRUNCATED']);
const CODES = new Set(['E_SOURCE_PIN', 'E_HELPER_PENDING', 'E_RECEIPT', 'E_INPUT', 'E_METADATA', 'E_BINDING', 'E_IO',
  'E_CLOSE', 'E_LENGTH', 'E_HASH', 'E_PREREQUISITE', 'E_SPAWN', 'E_PIPE', 'E_DECODER', 'E_TAR', 'E_OUTPUT',
  'E_DEADLINE', 'E_CLEANUP', 'E_CLOCK', 'E_LIMIT', 'E_PRELOAD', 'E_COMPONENT', 'E_PAYLOAD', 'E_PHASE',
  'E_SUMMARY', 'E_SPAN', 'E_TARGET', 'E_KIND', 'E_ELF', 'E_LINKER_TEXT', 'E_LINKER_UNSUPPORTED', 'E_STATE', ...PAYLOAD_CODES, ...TAR_CODES]);
const PARSER_CODES = new Set([...PAYLOAD_CODES, ...TAR_CODES]);
const ELF_CODES = new Set(['E_INPUT', 'E_LIMITS', 'E_ELF', 'E_RANGE', 'E_PROGRAM_HEADERS', 'E_INTERPRETER',
  'E_DYNAMIC', 'E_STRING_TABLE', 'E_STRING', 'E_OUTPUT', 'E_VERSIONS', 'E_NOTES', 'E_PROPERTIES']);
const fail = code => { throw Object.freeze(Object.assign(new Error(code), { code })); };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const uri = bytes => 'data:text/javascript;base64,' + bytes.toString('base64');
function own(value, key, code = 'E_OUTPUT') {
  if (!value || typeof value !== 'object' || types.isProxy(value)) fail(code);
  const field = Object.getOwnPropertyDescriptor(value, key);
  if (!field || !Object.hasOwn(field, 'value')) fail(code);
  return field.value;
}
function errorCode(value) {
  if (!value || typeof value !== 'object' || types.isProxy(value)) return 'E_IO';
  const field = Object.getOwnPropertyDescriptor(value, 'code');
  return field && Object.hasOwn(field, 'value') && CODES.has(field.value) ? field.value : 'E_IO';
}
const typed = Object.getPrototypeOf(Uint8Array.prototype);
const lengthOf = Object.getOwnPropertyDescriptor(typed, 'length').get;
const bufferOf = Object.getOwnPropertyDescriptor(typed, 'buffer').get;
const offsetOf = Object.getOwnPropertyDescriptor(typed, 'byteOffset').get;
const resizable = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
function pinned(bytes, pin) {
  if (!pin || types.isProxy(bytes) || !Buffer.isBuffer(bytes) || lengthOf.call(bytes) !== pin.bytes) fail('E_SOURCE_PIN');
  const backing = bufferOf.call(bytes);
  if (types.isSharedArrayBuffer(backing) || (resizable && resizable.call(backing))) fail('E_SOURCE_PIN');
  const copy = Buffer.from(new Uint8Array(backing, offsetOf.call(bytes), lengthOf.call(bytes)));
  if (sha(copy) !== pin.sha256) fail('E_SOURCE_PIN');
  return copy;
}
function replaceOnce(source, needle, replacement) {
  if (source.split(needle).length !== 2) fail('E_SOURCE_PIN');
  return source.replace(needle, () => replacement);
}
const link = (bytes, dependency, target) => Buffer.from(replaceOnce(bytes.toString('utf8'),
  "from './" + dependency + ".mjs'", "from '" + target + "'"));
function captureCounts() {
  return { fsCalls: 0, rootChecks: 0, namedChecks: 0, fdChecks: 0, openAttempts: 0, readAttempts: 0,
    requestedBytes: 0, readBytes: 0, closeAttempts: 0, closes: 0, completedCaptures: 0,
    allocations: 0, allocatedBytes: 0, ownedFds: 0, peakOwnedFds: 0 };
}
function metadata(stat, directory, size = null) {
  const result = {};
  for (const key of FIELDS) {
    const value = own(stat, key, 'E_METADATA');
    if (typeof value !== 'bigint' || (value < 0n && key !== 'mtimeNs' && key !== 'ctimeNs')) fail('E_METADATA');
    result[key] = value;
  }
  if ((result.mode & 0o170000n) !== (directory ? 0o040000n : 0o100000n) || result.ino <= 0n ||
    (!directory && result.nlink !== 1n) || (size !== null && result.size !== BigInt(size))) fail('E_SOURCE_PIN');
  return result;
}
const same = (a, b) => { if (!FIELDS.every(key => a[key] === b[key])) fail('E_BINDING'); };
function captureSource(key, io, counts, guard) {
  const row = SOURCE_ROWS.find(value => value[0] === key), pin = RUST_PAYLOAD_SOURCE_PINS[key];
  if (!row || !pin || !Number.isSafeInteger(pin.bytes) || pin.bytes < 1 || pin.bytes >= 1048576) fail('E_SOURCE_PIN');
  const path = REPO + '/' + row[1];
  let owned = null, bytes;
  const call = (name, ...args) => {
    guard(10000);
    if (counts.fsCalls >= 4096 - (owned === null ? 0 : 1)) fail('E_LIMIT');
    counts.fsCalls++;
    let value;
    try { value = io[name](...args); } catch { fail('E_IO'); }
    guard(10000); return value;
  };
  const stat = (method, value, directory, size = null) => {
    counts[method === 'fstatSync' ? 'fdChecks' : value === REPO ? 'rootChecks' : 'namedChecks']++;
    return metadata(call(method, value, { bigint: true }), directory, size);
  };
  try {
    const c = fs.constants;
    if (c.O_RDONLY !== 0 || ![c.O_NOFOLLOW, c.O_NONBLOCK].every(n => Number.isInteger(n) && n > 0)) fail('E_PREREQUISITE');
    const root = stat('lstatSync', REPO, true), named = stat('lstatSync', path, false, pin.bytes);
    guard(10000); counts.openAttempts++;
    if (counts.fsCalls >= 4095) fail('E_LIMIT');
    counts.fsCalls++;
    try { owned = io.openSync(path, c.O_RDONLY | c.O_NOFOLLOW | c.O_NONBLOCK); } catch { fail('E_IO'); }
    if (!Number.isSafeInteger(owned) || owned < 0) { owned = null; fail('E_IO'); }
    counts.ownedFds++; counts.peakOwnedFds = Math.max(counts.peakOwnedFds, counts.ownedFds);
    guard(10000);
    const bound = stat('fstatSync', owned, false, pin.bytes); same(named, bound);
    if (counts.ownedFds !== 1 || counts.allocatedBytes + pin.bytes + 1 > 524288) fail('E_LIMIT');
    bytes = Buffer.alloc(pin.bytes + 1); counts.allocations++; counts.allocatedBytes += bytes.length;
    let position = 0, reads = 0;
    const read = length => {
      if (++reads > 128) fail('E_LIMIT');
      counts.readAttempts++; counts.requestedBytes += length;
      const n = call('readSync', owned, bytes, position, length, position);
      if (!Number.isSafeInteger(n) || n < 0 || n > length) fail('E_LENGTH');
      counts.readBytes += n; return n;
    };
    while (position < pin.bytes) {
      const length = Math.min(65536, pin.bytes - position), n = read(length);
      if (n !== length) fail('E_LENGTH');
      position += n;
    }
    if (read(1) !== 0) fail('E_LENGTH');
    same(bound, stat('fstatSync', owned, false, pin.bytes));
    same(named, stat('lstatSync', path, false, pin.bytes));
    same(root, stat('lstatSync', REPO, true));
  } finally {
    if (owned !== null) {
      const fd = owned; owned = null; counts.ownedFds--; counts.closeAttempts++; counts.fsCalls++;
      try { io.closeSync(fd); counts.closes++; } catch { fail('E_CLOSE'); }
    }
  }
  guard(10000);
  const captured = pinned(bytes.subarray(0, pin.bytes), pin);
  guard(10000); counts.completedCaptures++; return captured;
}
function preflight(value, maximum, flags = FLAGS) {
  let cost = 1, nodes = 0;
  const seen = new Set();
  const add = n => { cost += n; if (cost > maximum) fail('E_OUTPUT'); };
  const string = text => {
    add(2);
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      add(code > 127 ? 6 : code < 32 ? [8, 9, 10, 12, 13].includes(code) ? 2 : 6 : code === 34 || code === 92 ? 2 : 1);
    }
  };
  const visit = (item, depth) => {
    if (++nodes > 1048576 || depth > 64) fail('E_OUTPUT');
    if (item === null || typeof item === 'boolean') { add(item === null || item === true ? 4 : 5); return; }
    if (typeof item === 'string') { string(item); return; }
    if (typeof item === 'number') { if (!Number.isFinite(item)) fail('E_OUTPUT'); add(JSON.stringify(item).length); return; }
    if (!item || typeof item !== 'object' || types.isProxy(item) || seen.has(item)) fail('E_OUTPUT');
    const array = Array.isArray(item), prototype = Object.getPrototypeOf(item);
    if (prototype !== (array ? Array.prototype : Object.prototype) && !(prototype === null && !array)) fail('E_OUTPUT');
    seen.add(item); add(2);
    const keys = Reflect.ownKeys(item);
    if (keys.length > 1048576) fail('E_OUTPUT');
    let count = 0;
    for (const key of keys) {
      if (array && key === 'length') continue;
      if (typeof key !== 'string' || key === 'toJSON' || (array && key !== String(count))) fail('E_OUTPUT');
      const field = Object.getOwnPropertyDescriptor(item, key);
      if (!field || !Object.hasOwn(field, 'value') || !field.enumerable) fail('E_OUTPUT');
      if (Object.hasOwn(flags, key) && field.value !== false) fail('E_RECEIPT');
      if (count++) add(1);
      if (!array) { string(key); add(1); }
      visit(field.value, depth + 1);
    }
    if (array && count !== own(item, 'length')) fail('E_OUTPUT');
    seen.delete(item);
  };
  visit(value, 0); return cost;
}
function asciiJson(value, maximum) {
  const cost = preflight(value, maximum);
  const text = JSON.stringify(value).replace(/[^\x00-\x7f]/g, ch => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0')) + '\n';
  if (text.length !== cost || text.length > maximum) fail('E_OUTPUT');
  return text;
}
function ownData(value, keys, maximum = 65536) {
  preflight(value, maximum);
  for (const key of keys) own(value, key);
  return value;
}
function equal(a, b, maximum = 65536) {
  preflight(a, maximum); preflight(b, maximum);
  const compare = (left, right) => {
    if (left === right) return;
    if (!left || !right || typeof left !== 'object' || typeof right !== 'object' || Array.isArray(left) !== Array.isArray(right)) fail('E_RECEIPT');
    const leftKeys = Object.keys(left).sort(), rightKeys = Object.keys(right).sort();
    if (leftKeys.length !== rightKeys.length || leftKeys.some((key, index) => key !== rightKeys[index])) fail('E_RECEIPT');
    for (const key of leftKeys) compare(own(left, key), own(right, key));
  };
  compare(a, b);
}
function compareConstants(helper, rustReceipt, layoutReceipt, old) {
  ownData(rustReceipt, ['status', 'root', 'inputs', 'rootFinal']);
  ownData(layoutReceipt, ['status', 'registration', 'roles', 'runtimeInspectionCandidates']);
  if (rustReceipt.status !== 'RUST_INPUT_BYTES_MATCHED' || rustReceipt.root !== ROOT || rustReceipt.inputs.length !== 5 ||
    layoutReceipt.status !== 'RUST_COMPONENT_LAYOUT_DATA' || layoutReceipt.registration.operationSha256 !== RUST_PAYLOAD_SOURCE_PINS.layoutOperation.sha256) fail('E_RECEIPT');
  const expected = rustReceipt.inputs.map(row => {
    if (row.verified !== true || row.incomingSha256 !== row.readbackSha256) fail('E_RECEIPT');
    return { role: row.role, root: rustReceipt.root, file: rustReceipt.root + '/' + row.name,
      archiveBytes: row.byteLength, archiveSha256: row.readbackSha256, expectedRoot: row.name.replace(/\.tar\.xz$/, ''),
      identity: { root: rustReceipt.rootFinal, file: row.finalMetadata } };
  });
  equal(expected, RUST_PAYLOAD_INPUTS);
  equal(own(old, 'RUST_LAYOUT_INPUTS'), RUST_PAYLOAD_INPUTS);
  equal(own(helper, 'RUST_PAYLOAD_INPUTS'), RUST_PAYLOAD_INPUTS);
  equal(own(helper, 'RUST_PAYLOAD_ROLES'), RUST_PAYLOAD_ROLES);
  equal(own(helper, 'RUST_PAYLOAD_TARGETS'), RUST_PAYLOAD_TARGETS);
  equal(own(helper, 'RUST_PAYLOAD_EXPECTATIONS'), RUST_PAYLOAD_EXPECTATIONS);
  equal(own(helper, 'RUST_PAYLOAD_LIMITS'), RUST_PAYLOAD_LIMITS);
  equal(layoutReceipt.runtimeInspectionCandidates, RUST_PAYLOAD_TARGETS.map(({ role, path, index, bodyOffset, size, sha256 }) => ({ role, path, index, bodyOffset, size, sha256 })));
  equal(layoutReceipt.roles.map(({ role, expandedBytes, entries, headers, metadataSha256, decodedSha256 }) =>
    ({ role, expandedBytes, entries, headers, metadataSha256, decodedSha256 })), RUST_PAYLOAD_EXPECTATIONS);
}
function captureFailure(value) {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || types.isProxy(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value)) || Reflect.ownKeys(value).length !== 8) fail('E_OUTPUT');
  const result = {};
  for (const key of ['sourceProfile', 'role', 'path', 'index', 'kind', 'code', 'underlyingCode', 'scope']) result[key] = own(value, key);
  if (result.sourceProfile !== 'RUST_COMPONENT_LAYOUT_DATA' || !PARSER_CODES.has(result.code) || (result.underlyingCode !== null &&
    (result.kind !== 'ELF_EXEC_DSO' || result.code !== 'E_PAYLOAD_ELF' || !ELF_CODES.has(result.underlyingCode))) ||
    result.scope !== 'ATTEMPTED_LITERAL_TARGET_NOT_ACCEPTED_PAYLOAD_EVIDENCE' ||
    !RUST_PAYLOAD_TARGETS.some(target => ['role', 'path', 'index', 'kind'].every(key => target[key] === result[key]))) fail('E_OUTPUT');
  asciiJson(result, 4096); return Object.freeze(result);
}
export const RUST_PAYLOAD_CORE_LIMITS = freeze({ maxTotalMs: 45000, cleanupMs: 3000, maxReadsPerPass: 4096,
  maxFsOperations: 10000, maxExpandedBytes: 1073741824, maxHeaders: 32768, maxStreamEvents: 262144,
  maxStderrBytes: 8192, maxSelectedEntries: 128, maxSelectedBytes: 131072, maxSummaryBytes: 4194304 });
export const RUST_PAYLOAD_LIMITS = freeze({ maxExpandedBytes: 1073741824, maxBatchExpandedBytes: 2147483648,
  maxEntries: 32768, maxBatchEntries: 65536, maxChunkBytes: 65536, maxPayloadBytes: 268435456,
  maxElfSnapshotBytes: 268435456, maxAggregateBytes: 536870912, maxTextBytes: 1048576,
  maxObservationBytes: 4194304, maxOutputBytes: 2097152, maxLinkerDepth: 32, maxLinkerReferences: 1024 });
const CORE_FLAGS = freeze(['extracted', 'extractionAuthorized', 'pythonFreeSubsetVerified', 'installedUsability',
  'nativeQualified', 'decoderQualified', 'rustReady', 'trainingReady', 'provenanceVerified', 'hardRssBounded',
  'processTreeBounded', 'hardDeadlineGuaranteed']);
const descriptor = input => ({ root: input.root, file: input.file, archiveBytes: input.archiveBytes,
  archiveSha256: input.archiveSha256, decoderRoot: DECODER });
let productionConsumed = false;
function stopped(error, mockOnly) {
  return Object.freeze({ exitCode: 1, text: asciiJson({ profile: 'registered-rust-payload-inspection-v1', status: 'STOP',
    error, mockOnly, realArchiveInspected: false, ...FLAGS }, 65536) });
}
// WHAT: One-shot fixed five-role DATA inspection.
export async function runRegisteredRustPayloadInspection() {
  if (arguments.length !== 0 || productionConsumed) return stopped('E_INPUT', false);
  productionConsumed = true;
  return run({ fs, spawn: nodeSpawn, now: () => performance.now(), moduleImporter: target => import(target) }, false);
}
// WHAT: Complete fake capabilities; no live qualification.
export async function runRegisteredRustPayloadInspectionMock(config) {
  try {
    if (arguments.length !== 1 || !config || typeof config !== 'object' || types.isProxy(config)) fail('E_INPUT');
    const allowed = ['fs', 'spawn', 'now', 'moduleImporter', 'setTimeout', 'clearTimeout'], deps = {};
    for (const key of Reflect.ownKeys(config)) {
      if (!allowed.includes(key)) fail('E_INPUT');
      deps[key] = own(config, key, 'E_INPUT');
    }
    if (!deps.fs || deps.fs === fs || types.isProxy(deps.fs)) fail('E_INPUT');
    for (const key of ['lstatSync', 'fstatSync', 'openSync', 'readSync', 'closeSync']) {
      const fn = own(deps.fs, key, 'E_INPUT');
      if (typeof fn !== 'function' || types.isProxy(fn)) fail('E_INPUT');
    }
    for (const key of ['spawn', 'now', 'moduleImporter', ...['setTimeout', 'clearTimeout'].filter(key => Object.hasOwn(deps, key))]) {
      if (typeof deps[key] !== 'function' || types.isProxy(deps[key])) fail('E_INPUT');
    }
    if (deps.spawn === nodeSpawn) fail('E_INPUT');
    return await run(deps, true);
  } catch (error) { return stopped(errorCode(error), true); }
}
async function run(deps, mockOnly) {
  const repoCapture = captureCounts();
  const counts = { spawnAttempts: 0, spawnEvents: 0, ownedChildren: 0, peakChildren: 0, childCloses: 0,
    stageChecks: 0, preloadChecks: 0, stageFsCalls: 0, stageReadBytes: 0, stageCloses: 0, completedCorePasses: 0,
    archivePasses: 0, archiveDataBytes: 0, archiveRequestedBytes: 0, archiveCloseAttempts: 0,
    expandedBytes: 0, streamEvents: 0, entries: 0 };
  let started, last, roleStarted = null, publicationStarted = null, helper = null, api = null, role = null;
  let sourceAccountingComplete = false, stageAccountingComplete = false, batchBegun = false;
  function guard(limit = 300000) {
    let now;
    try { now = deps.now(); } catch { fail('E_CLOCK'); }
    if (!Number.isFinite(now) || (last !== undefined && now < last)) fail('E_CLOCK');
    if (started === undefined) started = now;
    last = now;
    if (!Number.isFinite(started + 300000) || started + 300000 <= started) fail('E_CLOCK');
    if (now - started >= limit || (roleStarted !== null && now - roleStarted >= 45000) ||
      (publicationStarted !== null && now - publicationStarted >= 30000)) fail('E_DEADLINE');
    return now;
  }
  const base = status => ({ profile: 'registered-rust-payload-inspection-v1', status, mockOnly,
    sourcePins: RUST_PAYLOAD_SOURCE_PINS, counts, repoCapture, sourceAccountingComplete, stageAccountingComplete,
    sourceCountersScope: 'attempted repository captures; positive closes before hash, import or JSON; separate from stage/archive I/O',
    stageCountersScope: 'completed verification helpers; positive closes only on successful return',
    archiveCountersScope: 'completed frozen-core results only; failed-pass bytes are not zero-I/O assertions',
    repoCaptureAccountingComplete: repoCapture.completedCaptures === 10 && repoCapture.closes === 10 && repoCapture.ownedFds === 0,
    archiveAccountingComplete: counts.completedCorePasses === 5,
    decoderInvocationAttempted: counts.spawnAttempts > 0,
    candidateInvocationAttempted: false,
    candidateScope: 'selected Rust members remain DATA; decoder fields describe staged XZ only',
    candidateExecuted: false,
    decoderExecuted: counts.spawnAttempts === 0 ? false : !mockOnly && counts.completedCorePasses === 5 ? true : null,
    realArchiveInspected: status !== 'STOP' && !mockOnly,
    operationalAdequacy: '45-second role policy ceiling; not a throughput or deadline guarantee',
    interpretation: 'DATA only; unresolved edges mean unqualified, not necessarily incompatible',
    memoryScope: '256MiB active payload plus separate 256MiB ELF snapshot; not hard RSS',
    trustScope: 'ordinary Node bootstrap and host-source context; selected members remain DATA only', ...FLAGS });
  try {
    guard(10000);
    if (!DELIVERED_PINS) fail('E_HELPER_PENDING');
    const sources = new Map();
    for (const [key] of SOURCE_ROWS) sources.set(key, captureSource(key, deps.fs, repoCapture, guard));
    if (repoCapture.ownedFds !== 0 || repoCapture.closes !== 10) fail('E_CLOSE');
    sourceAccountingComplete = true;
    const xzReceipt = JSON.parse(sources.get('xzReceipt').toString('utf8'));
    const rustReceipt = JSON.parse(sources.get('rustReceipt').toString('utf8'));
    const layoutReceipt = JSON.parse(sources.get('layoutReceipt').toString('utf8'));
    preflight(xzReceipt, 65536);
    if (xzReceipt.status !== 'FINITE_XZ_PROFILE_OBSERVED' || xzReceipt.counts.spawnEvents !== 33 ||
      xzReceipt.fixtureManifestSha256 !== '632a0d812366712ae99ce2ce442ad98a59534430640184f70af53df58656b4ea') fail('E_RECEIPT');
    const old = await deps.moduleImporter(uri(sources.get('layoutOperation'))); guard(10000);
    const transform = own(old, 'rustLayoutSource');
    const tar = pinned(own(transform, 'transformTar')(sources.get('rawTar')), RUST_PAYLOAD_SOURCE_PINS.eventTar);
    const stageBytes = pinned(link(sources.get('stage'), 'elf-metadata', uri(sources.get('elfMetadata'))), RUST_PAYLOAD_SOURCE_PINS.linkedStage);
    const tarLinked = pinned(link(sources.get('helper'), 'tar-inventory', uri(tar)), RUST_PAYLOAD_SOURCE_PINS.tarLinkedHelper);
    const helperBytes = pinned(link(tarLinked, 'elf-requirements-v5', uri(sources.get('elfV5'))), RUST_PAYLOAD_SOURCE_PINS.linkedHelper);
    const helperUri = uri(helperBytes);
    const pipeline = RUST_PAYLOAD_ROLES.map(value => pinned(link(pinned(own(transform, 'transformCore')(sources.get('rawCore'), value),
      RUST_PAYLOAD_SOURCE_PINS.coreStages[value][3]),
      'tar-inventory', helperUri), RUST_PAYLOAD_SOURCE_PINS.linkedCores[value]));
    guard(10000);
    helper = await deps.moduleImporter(helperUri); guard(10000);
    api = {};
    for (const key of ['beginRustPayloadBatch', 'beginRustPayloadRole', 'createTarInventory', 'acceptRustPayloadRole',
      'finishRustPayloadBatch', 'abortRustPayloadBatch', 'getRustPayloadFailure', 'snapshotRustPayloadBatch']) {
      const fn = own(helper, key, 'E_COMPONENT');
      if (typeof fn !== 'function' || types.isProxy(fn)) fail('E_COMPONENT');
      api[key] = fn;
    }
    const stage = await deps.moduleImporter(uri(stageBytes)); guard(10000);
    const verifyStage = own(stage, 'verifyStagedXzImages'), verifyPreload = own(stage, 'assertNoSystemPreload');
    if (![verifyStage, verifyPreload].every(fn => typeof fn === 'function' && !types.isProxy(fn))) fail('E_COMPONENT');
    const inventories = [];
    for (let index = 0; index < 5; index++) {
      const inventory = await deps.moduleImporter(uri(pipeline[index])); guard(10000);
      equal(own(inventory, 'GNU_SDK_DESCRIPTOR'), descriptor(RUST_PAYLOAD_INPUTS[index]));
      equal(own(inventory, 'GNU_SDK_LIMITS'), RUST_PAYLOAD_CORE_LIMITS);
      const fn = own(inventory, 'runGnuSdkInventory');
      if (typeof fn !== 'function' || types.isProxy(fn)) fail('E_COMPONENT');
      inventories.push(fn);
    }
    compareConstants(helper, rustReceipt, layoutReceipt, old); guard(10000);
    api.beginRustPayloadBatch(); batchBegun = true;
    const acceptedState = (number, currentRole = null) => {
      const snapshot = ownData(api.snapshotRustPayloadBatch(), ['state', 'mockOnly', 'acceptedRoles', 'currentRole',
        'entries', 'expandedBytes', 'capturedBytes', 'observationBytes']);
      if (snapshot.state !== 'ACTIVE' || snapshot.mockOnly !== false || snapshot.acceptedRoles !== number ||
        snapshot.currentRole !== currentRole || snapshot.entries !== counts.entries || snapshot.expandedBytes !== counts.expandedBytes ||
        ![snapshot.capturedBytes, snapshot.observationBytes].every(n => Number.isSafeInteger(n) && n >= 0) ||
        snapshot.capturedBytes > 536870912 || snapshot.observationBytes > 4194304) fail('E_PAYLOAD');
    };
    acceptedState(0);
    const gate = () => {
      guard(); stageAccountingComplete = false;
      const checked = ownData(verifyStage(xzReceipt.staged), ['counters']);
      const c = ownData(checked.counters, ['fsCalls', 'readBytes', 'closeAttempts']);
      if (![c.fsCalls, c.readBytes, c.closeAttempts].every(n => Number.isSafeInteger(n) && n >= 0) ||
        c.closeAttempts !== 5 || c.fsCalls > 1024 || c.readBytes !== 2758216) fail('E_RECEIPT');
      counts.stageChecks++; counts.stageFsCalls += c.fsCalls; counts.stageReadBytes += c.readBytes; counts.stageCloses += c.closeAttempts;
      stageAccountingComplete = true;
      if (verifyPreload() !== true) fail('E_PRELOAD');
      counts.preloadChecks++;
      if (counts.stageChecks > 10 || counts.preloadChecks > 10 || counts.stageCloses > 50) fail('E_LIMIT');
      guard(); return { stagedImagesVerified: true, preloadAbsent: true, ordinaryProfileObserved: true };
    };
    for (let index = 0; index < 5; index++) {
      role = RUST_PAYLOAD_ROLES[index];
      if (300000 - (guard() - started) < 75000) fail('E_DEADLINE');
      roleStarted = last;
      api.beginRustPayloadRole(role); acceptedState(index, role);
      const input = RUST_PAYLOAD_INPUTS[index];
      let roleAttempts = 0;
      const coreDeps = { beforeDecode: gate, afterDecode: gate, fs: deps.fs, now: () => guard(),
        spawn(...args) {
          guard(); roleAttempts++; counts.spawnAttempts++;
          if (roleAttempts > 1 || counts.spawnAttempts > 5 || counts.ownedChildren !== 0) fail('E_LIMIT');
          const expectedArgs = ['--inhibit-cache', '--glibc-hwcaps-mask', '', '--library-path', DECODER,
            DECODER + '/xz', '--decompress', '--stdout', '--format=xz', '--threads=1', '--memlimit-decompress=268435456', '--', '-'];
          if (args[0] !== DECODER + '/ld-linux-x86-64.so.2') fail('E_SPAWN');
          try {
            equal(args[1], expectedArgs, 4096);
            equal(args[2], { cwd: DECODER, env: { LC_ALL: 'C', LANG: 'C', TZ: 'UTC' }, shell: false,
              stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true }, 4096);
          } catch { fail('E_SPAWN'); }
          const child = deps.spawn(...args);
          counts.ownedChildren++; counts.peakChildren = Math.max(counts.peakChildren, counts.ownedChildren);
          child.once('spawn', () => { counts.spawnEvents++; });
          child.once('close', () => { counts.ownedChildren--; counts.childCloses++; });
          return child;
        } };
      for (const key of ['setTimeout', 'clearTimeout']) if (Object.hasOwn(deps, key)) coreDeps[key] = deps[key];
      const value = await inventories[index](input.identity, coreDeps); guard();
      ownData(value, ['state', 'mockOnly', 'archiveBytes', 'archiveSha256', 'archivePasses', 'archiveDataBytes',
        'archiveRequestedBytes', 'closeAttempts', 'exitCode', 'signal', 'stdinFinished', 'stdoutEnded', 'stderrEnded',
        'closeObserved', 'extracted', 'nativeQualified', 'pythonFreeSubsetVerified', 'rustReady', 'trainingReady',
        'expandedBytes', 'streamEvents', 'inventory'], 4194304);
      if (value.state !== 'GNU_SDK_DATA_INVENTORY' || value.mockOnly !== false || value.archiveBytes !== input.archiveBytes ||
        value.archiveSha256 !== input.archiveSha256 || value.archivePasses !== 2 || value.archiveDataBytes !== input.archiveBytes * 2 ||
        value.archiveRequestedBytes !== input.archiveBytes * 2 + 2 || value.closeAttempts !== 2 || value.exitCode !== 0 || value.signal !== null ||
        roleAttempts !== 1 || counts.spawnEvents !== index + 1 || counts.ownedChildren !== 0 || counts.childCloses !== index + 1 ||
        counts.stageChecks !== (index + 1) * 2 || counts.preloadChecks !== (index + 1) * 2 || counts.stageCloses !== (index + 1) * 10 ||
        !['stdinFinished', 'stdoutEnded', 'stderrEnded', 'closeObserved'].every(key => value[key] === true) ||
        CORE_FLAGS.some(key => own(value, key) !== false)) fail('E_RECEIPT');
      const expected = RUST_PAYLOAD_EXPECTATIONS[index];
      const inventory = ownData(value.inventory, ['expandedBytes', 'entries', 'headers', 'metadataSha256'], 4194304);
      if (value.expandedBytes !== expected.expandedBytes || inventory.expandedBytes !== expected.expandedBytes ||
        inventory.entries !== expected.entries || inventory.headers !== expected.headers || inventory.metadataSha256 !== expected.metadataSha256) fail('E_SUMMARY');
      if (![value.streamEvents, inventory.entries, inventory.headers].every(n => Number.isSafeInteger(n) && n >= 0) ||
        value.expandedBytes > 1073741824 || value.streamEvents > 262144 || inventory.headers > 32768 ||
        value.expandedBytes > 2147483648 - counts.expandedBytes || inventory.entries > 65536 - counts.entries) fail('E_LIMIT');
      counts.completedCorePasses++; counts.archivePasses += 2; counts.archiveDataBytes += value.archiveDataBytes;
      counts.archiveRequestedBytes += value.archiveRequestedBytes; counts.archiveCloseAttempts += value.closeAttempts;
      counts.expandedBytes += value.expandedBytes; counts.streamEvents += value.streamEvents; counts.entries += inventory.entries;
      api.acceptRustPayloadRole(value); guard(); acceptedState(index + 1); roleStarted = null;
      if (index === 4) publicationStarted = last;
    }
    if (counts.archivePasses !== 10 || counts.archiveCloseAttempts !== 10 || counts.stageChecks !== 10 || counts.preloadChecks !== 10 ||
      counts.stageCloses !== 50 || counts.spawnAttempts !== 5 || counts.spawnEvents !== 5 || counts.childCloses !== 5 ||
      counts.ownedChildren !== 0 || counts.peakChildren !== 1 || counts.archiveDataBytes !== 255545440 ||
      counts.archiveRequestedBytes !== 255545450 || !sourceAccountingComplete || !stageAccountingComplete) fail('E_RECEIPT');
    guard(); acceptedState(5);
    const result = api.finishRustPayloadBatch(); guard();
    ownData(result, ['state', 'mockOnly', 'members', 'declaredNeededEdges', 'roles', 'targetCount',
      'capturedBytes', 'expandedBytes', 'entries', 'candidateExecuted'], 2097152);
    preflight(result, 2097152, { ...FLAGS, candidateExecuted: false });
    if (result.state !== 'RUST_PAYLOAD_DATA_INSPECTED' || result.mockOnly !== false || !Array.isArray(result.members) ||
      result.members.length !== 13 || !Array.isArray(result.declaredNeededEdges) || !Array.isArray(result.roles) ||
      result.roles.length !== 5 || result.targetCount !== 13 || result.capturedBytes !== 457372178 ||
      result.expandedBytes !== counts.expandedBytes || result.entries !== counts.entries || result.candidateExecuted !== false) fail('E_PAYLOAD');
    for (let index = 0; index < 13; index++) {
      const member = result.members[index], expected = RUST_PAYLOAD_TARGETS[index];
      for (const key of Object.keys(expected)) if (own(member, key) !== expected[key]) fail('E_PAYLOAD');
      if (own(member, 'roleSatisfied') !== false) fail('E_PAYLOAD');
    }
    for (let index = 0; index < 5; index++) {
      const record = result.roles[index], expected = RUST_PAYLOAD_EXPECTATIONS[index];
      for (const key of Object.keys(expected)) if (own(record, key) !== expected[key]) fail('E_PAYLOAD');
      if (own(record, 'roleSatisfied') !== false) fail('E_PAYLOAD');
    }
    const text = asciiJson({ ...base(mockOnly ? 'MOCK_RUST_PAYLOAD_DATA_INSPECTED' : 'RUST_PAYLOAD_DATA_INSPECTED'), result }, 2097152);
    guard(); return Object.freeze({ exitCode: 0, text });
  } catch (failure) {
    const error = errorCode(failure);
    let failedTargetAttempt = null;
    if (api && batchBegun) { try { failedTargetAttempt = captureFailure(api.getRustPayloadFailure()); } catch { failedTargetAttempt = null; } }
    if (api) { try { api.abortRustPayloadBatch(); } catch { /* WHAT: Suppress every provisional observation. */ } }
    return Object.freeze({ exitCode: 1, text: asciiJson({ ...base('STOP'), error, role,
      ...(failedTargetAttempt ? { failedTargetAttempt } : {}) }, 65536) });
  }
}
export const rustPayloadSource = Object.freeze({ captureSource, captureCounts, pinned, replaceOnce, link, uri,
  preflight, asciiJson, compareConstants, captureFailure, rows: SOURCE_ROWS });
