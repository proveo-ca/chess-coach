// SPEC: _spec/tooling/native-ingress/step2.puml
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawn as nodeSpawn } from 'node:child_process';
import { types } from 'node:util';

const freeze = value => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
const ROOT = '/tmp/opencode/f9-rust-runtime-inputs-01';
const REPO = '/tmp/opencode/f9-bootstrap-correspondence';
const DECODER = '/tmp/opencode/f9-xz-qualification-01';
const FIELDS = freeze(['dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtimeNs', 'ctimeNs']);
export const RUST_LAYOUT_ROLES = freeze(['cargo', 'rustc', 'rust-std', 'rustfmt-preview', 'clippy-preview']);
const rootIdentity = freeze({ dev: '28', ino: '13954', mode: '16832', uid: '1000', gid: '1000', nlink: '2',
  size: '4096', mtimeNs: '1792857301045485610', ctimeNs: '1792857301045485610' });
export const RUST_LAYOUT_INPUTS = freeze([
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
export const RUST_LAYOUT_SOURCE_PINS = freeze({
  rawCore: { bytes: 23261, sha256: 'bd2fc43633ca3b8f0c485eddb68a1b7505002edecd70eee4bf9cc661f588ef29' },
  rawTar: { bytes: 15548, sha256: '050d629963fdf89bd5dff7639260c7de30b08be46320b7b6bb7ed4dac6bb8139' },
  extensionTar: { bytes: 15551, sha256: 'b22db5d375d966016f5551b9161119079960d24f9611cf87d145893887575824' },
  v4Tar: { bytes: 15568, sha256: '56cac49b3cfe51dbf2a7f7d1f4a0d877ae8773f940585ebea72740373689fae2' },
  eventTar: { bytes: 15595, sha256: 'bf8c7fcc56c26aa0618c014d74046dc29b79c09340728b27dd0363a758b9ef9a' },
  v4Helper: { bytes: 12608, sha256: '2ea3c1bfe71676c37d01a05b64f9d3f11e4a7d7d93541cfdc4707a378bae17db' },
  stage: { bytes: 16688, sha256: 'f75c21a58bb67e6ab3f8b1dafd090e11ac2d3a70f017da35afb81b00761b71b4' },
  elf: { bytes: 19842, sha256: 'b223a655eae572137891a2c6efafee16887a2478fc91052f0092b48dfd65de85' },
  linkedStage: { bytes: 43154, sha256: '89b6c5e3dcbf902937f81fc642d7238bd4ec4ca3c94f6b61f4d069efdce8c5f2' },
  xzReceipt: { bytes: 4239, sha256: 'e45d65231c0815ab2b895c0d74467500a0e6caf33cc0a4ee342b20489ce6b233' },
  rustReceipt: { bytes: 4012, sha256: 'c068579e97c9c01c707bae0cdffb082bf23d7f089bcd404a114d290e0476be87' },
  collector: { bytes: 30039, sha256: 'c1f84c8141ee2ea5019e1df299c53ee41ca83f83f27275750f7a82fe7be2e162' },
  linkedCollector: { bytes: 50844, sha256: '25660c7d5df166b909b6128a76c70c0714f5f4f23273b613f934e583877a0ee9' },
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
  linkedCores: {
    cargo: { bytes: 90322, sha256: 'ba235bdf200bc270f0c7d95bd9f6341f7237303c663336b7baebf480b2b749fc' },
    rustc: { bytes: 90322, sha256: 'd97fcc85bb657eb29ccc1338563a43c66ded2583309096650c3344d34a071257' },
    'rust-std': { bytes: 90325, sha256: '4794ac95f3a9772bc84e228ad8a05c81daf3380b3a930835b26c000e47a14d37' },
    'rustfmt-preview': { bytes: 90323, sha256: 'acddb2185c9a62a2122d7211932470e2503fe1172394e181b871698c418a162f' },
    'clippy-preview': { bytes: 90322, sha256: 'e548f24984d73545f532198fdc5d09457a00041f33e16a610a31ff7dd175e3b3' },
  },
});
const CODES = new Set(['E_SOURCE_PIN', 'E_HELPER_PENDING', 'E_RECEIPT', 'E_INPUT', 'E_METADATA', 'E_BINDING',
  'E_IO', 'E_CLOSE', 'E_LENGTH', 'E_HASH', 'E_PREREQUISITE', 'E_SPAWN', 'E_PIPE', 'E_DECODER', 'E_TAR',
  'E_OUTPUT', 'E_DEADLINE', 'E_CLEANUP', 'E_CLOCK', 'E_LIMIT', 'E_PRELOAD', 'E_LAYOUT', 'E_PHASE',
  'E_MANIFEST', 'E_REFERENCE', 'E_SPAN', 'E_TEXT', 'E_LIMITS', 'E_SUMMARY', 'E_COMPONENT',
  'E_LAYOUT_INPUT', 'E_LAYOUT_LIMIT', 'E_LAYOUT_DATA', 'E_LAYOUT_STATE', 'E_LAYOUT_METADATA',
  'E_LAYOUT_OUTPUT', 'E_LAYOUT_ENTRIES', 'E_LAYOUT_DECLARATION', 'E_LAYOUT_BODY', 'E_LAYOUT_EVENT',
  'E_LAYOUT_ROOT', 'E_LAYOUT_CHUNK', 'E_LAYOUT_EXPANDED', 'E_LAYOUT_MANIFEST', 'E_LAYOUT_SUMMARY', 'E_LAYOUT_CORE']);
const fail = code => { throw Object.freeze(Object.assign(new Error(code), { code })); };
const errorCode = value => {
  if (!value || typeof value !== 'object' || types.isProxy(value)) return 'E_IO';
  const field = Object.getOwnPropertyDescriptor(value, 'code');
  return field && Object.hasOwn(field, 'value') && CODES.has(field.value) ? field.value : 'E_IO';
};
const LAYOUT_CODES = freeze(['E_LAYOUT_INPUT', 'E_LAYOUT_LIMIT', 'E_LAYOUT_DATA', 'E_LAYOUT_STATE',
  'E_LAYOUT_METADATA', 'E_LAYOUT_OUTPUT', 'E_LAYOUT_ENTRIES', 'E_LAYOUT_DECLARATION', 'E_LAYOUT_BODY',
  'E_LAYOUT_EVENT', 'E_LAYOUT_ROOT', 'E_LAYOUT_CHUNK', 'E_LAYOUT_EXPANDED', 'E_LAYOUT_MANIFEST', 'E_LAYOUT_SUMMARY', 'E_LAYOUT_CORE']);
function layoutFailure(collector) {
  if (!collector) return null;
  try {
    const snapshot = collector.snapshotLayout();
    if (!snapshot || typeof snapshot !== 'object' || types.isProxy(snapshot)) return null;
    const code = Object.getOwnPropertyDescriptor(snapshot, 'failureCode');
    const role = Object.getOwnPropertyDescriptor(snapshot, 'failureRole');
    if (!code || !role || !Object.hasOwn(code, 'value') || !Object.hasOwn(role, 'value') ||
      !LAYOUT_CODES.includes(code.value) || !(role.value === null || RUST_LAYOUT_ROLES.includes(role.value))) return null;
    return { failureCode: code.value, failureRole: role.value, scope: 'DATA_NOT_ACCEPTED_LAYOUT_EVIDENCE' };
  } catch { return null; }
}
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const uri = bytes => 'data:text/javascript;base64,' + bytes.toString('base64');
const typedPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const typedLength = Object.getOwnPropertyDescriptor(typedPrototype, 'length').get;
const typedBuffer = Object.getOwnPropertyDescriptor(typedPrototype, 'buffer').get;
const typedOffset = Object.getOwnPropertyDescriptor(typedPrototype, 'byteOffset').get;
function pinned(bytes, pin) {
  if (!pin || types.isProxy(bytes) || !Buffer.isBuffer(bytes) || typedLength.call(bytes) !== pin.bytes) fail('E_SOURCE_PIN');
  const backing = typedBuffer.call(bytes);
  if (types.isSharedArrayBuffer(backing) || backing.resizable === true) fail('E_SOURCE_PIN');
  const copy = Buffer.from(new Uint8Array(backing, typedOffset.call(bytes), typedLength.call(bytes)));
  if (sha(copy) !== pin.sha256) fail('E_SOURCE_PIN');
  return copy;
}
function replaceOnce(source, needle, replacement) {
  const matches = typeof needle === 'string' ? source.split(needle).length - 1 : [...source.matchAll(needle)].length;
  if (matches !== 1) fail('E_SOURCE_PIN');
  return source.replace(needle, () => replacement);
}
const descriptorBlock = /export const GNU_SDK_DESCRIPTOR = Object\.freeze\(\{\n(?:  [^\n]*\n)+\}\);/g;
const selectorBlock = /const selectors = Object\.freeze\(\[\n(?:  [^\n]*\n)+\]\);/g;
function transformCore(bytes, role) {
  const input = RUST_LAYOUT_INPUTS.find(value => value.role === role);
  if (!input) fail('E_INPUT');
  let source = pinned(bytes, RUST_LAYOUT_SOURCE_PINS.rawCore).toString('utf8');
  const stages = RUST_LAYOUT_SOURCE_PINS.coreStages[role];
  const fixed = { root: input.root, file: input.file, archiveBytes: input.archiveBytes,
    archiveSha256: input.archiveSha256, decoderRoot: DECODER };
  source = replaceOnce(source, descriptorBlock, 'export const GNU_SDK_DESCRIPTOR = Object.freeze(' + JSON.stringify(fixed, null, 2) + ');');
  pinned(Buffer.from(source), stages[0]);
  for (const [needle, replacement] of [['maxTotalMs: 120_000', 'maxTotalMs: 45_000'],
    ['maxStreamEvents: 32_768', 'maxStreamEvents: 262_144'], ['maxSummaryBytes: 262_144', 'maxSummaryBytes: 4_194_304']]) {
    source = replaceOnce(source, needle, replacement);
  }
  pinned(Buffer.from(source), stages[1]);
  source = replaceOnce(source, selectorBlock, 'const selectors = Object.freeze([]);');
  pinned(Buffer.from(source), stages[2]);
  source = replaceOnce(source, "'--memlimit-decompress=16777216'", "'--memlimit-decompress=268435456'");
  return pinned(Buffer.from(source), stages[3]);
}
function transformTar(bytes) {
  let source = pinned(bytes, RUST_LAYOUT_SOURCE_PINS.rawTar).toString('utf8');
  source = replaceOnce(source, 'maxExtensionBytes: 65_536', 'maxExtensionBytes: 4_194_304');
  pinned(Buffer.from(source), RUST_LAYOUT_SOURCE_PINS.extensionTar);
  source = replaceOnce(source, "if (size > limits.maxExtensionBytes - extensionBytes) fail('E_EXTENSION_BYTES');",
    "if (size > 65_536 || size > limits.maxExtensionBytes - extensionBytes) fail('E_EXTENSION_BYTES');");
  pinned(Buffer.from(source), RUST_LAYOUT_SOURCE_PINS.v4Tar);
  source = replaceOnce(source, '{ index: entries + 1, path: key, type: kind, size }',
    '{ index: entries + 1, path: key, type: kind, size, bodyOffset: consumedBytes }');
  return pinned(Buffer.from(source), RUST_LAYOUT_SOURCE_PINS.eventTar);
}
const link = (bytes, dependency, target) => Buffer.from(replaceOnce(bytes.toString('utf8'),
  "from './" + dependency + ".mjs'", "from '" + target + "'"));
const SOURCE_ROWS = freeze([
  ['rawCore', 'tooling/native-ingress/gnu-sdk-inventory.mjs'],
  ['rawTar', 'tooling/native-ingress/tar-inventory.mjs'],
  ['v4Helper', 'tooling/native-ingress/gnu-sdk-inventory-v4-operation.mjs'],
  ['stage', 'tooling/native-ingress/xz-staging.mjs'],
  ['elf', 'tooling/native-ingress/elf-metadata.mjs'],
  ['collector', 'tooling/native-ingress/rust-component-layout.mjs'],
  ['xzReceipt', '_spec/tooling/native-ingress/xz-qualification.receipt.json'],
  ['rustReceipt', '_spec/tooling/native-ingress/rust-runtime-inputs.receipt.json'],
]);
function captureCounts() {
  return { fsCalls: 0, rootChecks: 0, namedChecks: 0, fdChecks: 0, openAttempts: 0,
    readAttempts: 0, requestedBytes: 0, readBytes: 0, closeAttempts: 0, closes: 0,
    completedCaptures: 0, allocations: 0, allocatedBytes: 0, ownedFds: 0, peakOwnedFds: 0 };
}
function metadata(stat, directory, size = null) {
  if (!stat || typeof stat !== 'object' || types.isProxy(stat)) fail('E_METADATA');
  const result = {};
  for (const key of FIELDS) {
    const field = Object.getOwnPropertyDescriptor(stat, key);
    if (!field || !Object.hasOwn(field, 'value') || typeof field.value !== 'bigint' ||
      (field.value < 0n && key !== 'mtimeNs' && key !== 'ctimeNs')) fail('E_METADATA');
    result[key] = field.value;
  }
  if ((result.mode & 0o170000n) !== (directory ? 0o040000n : 0o100000n) || result.ino <= 0n ||
    (!directory && result.nlink !== 1n) || (size !== null && result.size !== BigInt(size))) fail('E_SOURCE_PIN');
  return result;
}
const same = (a, b) => { if (!FIELDS.every(key => a[key] === b[key])) fail('E_BINDING'); };
function captureSource(key, io, counts, guard) {
  const row = SOURCE_ROWS.find(value => value[0] === key), pin = RUST_LAYOUT_SOURCE_PINS[key];
  if (!row || !pin) fail(key === 'collector' ? 'E_HELPER_PENDING' : 'E_SOURCE_PIN');
  if (!Number.isSafeInteger(pin.bytes) || pin.bytes < 1 || pin.bytes >= 1048576) fail('E_SOURCE_PIN');
  const path = REPO + '/' + row[1];
  let owned = null, bytes;
  const call = (name, ...args) => {
    guard(10000);
    if (counts.fsCalls >= 4096 - (owned === null ? 0 : 1)) fail('E_LIMIT');
    counts.fsCalls++;
    let value;
    try { value = io[name](...args); } catch { fail('E_IO'); }
    guard(10000);
    return value;
  };
  const stat = (method, value, directory, length = null) => {
    counts[method === 'fstatSync' ? 'fdChecks' : value === REPO ? 'rootChecks' : 'namedChecks']++;
    return metadata(call(method, value, { bigint: true }), directory, length);
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
      counts.readBytes += n;
      return n;
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
  guard(10000); counts.completedCaptures++;
  return captured;
}
function asciiJson(value, maximum) {
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
      if (Object.hasOwn(FLAGS, key) && field.value !== false) fail('E_RECEIPT');
      if (count++) add(1);
      if (!array) { string(key); add(1); }
      visit(field.value, depth + 1);
    }
    if (array && count !== item.length) fail('E_OUTPUT');
    seen.delete(item);
  };
  visit(value, 0);
  return JSON.stringify(value).replace(/[^\x00-\x7f]/g, ch => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0')) + '\n';
}
function compareInputs(collector, rustReceipt) {
  if (rustReceipt.status !== 'RUST_INPUT_BYTES_MATCHED' || rustReceipt.root !== ROOT ||
    JSON.stringify(rustReceipt.rootFinal) !== JSON.stringify(rootIdentity) || !Array.isArray(rustReceipt.inputs) || rustReceipt.inputs.length !== 5) fail('E_RECEIPT');
  const expected = rustReceipt.inputs.map(row => {
    if (row.verified !== true || row.incomingSha256 !== row.readbackSha256) fail('E_RECEIPT');
    return { role: row.role, root: rustReceipt.root, file: rustReceipt.root + '/' + row.name,
      archiveBytes: row.byteLength, archiveSha256: row.readbackSha256, expectedRoot: row.name.replace(/\.tar\.xz$/, ''),
      identity: { root: rustReceipt.rootFinal, file: row.finalMetadata } };
  });
  if (asciiJson(expected, 65536) !== asciiJson(RUST_LAYOUT_INPUTS, 65536) ||
    asciiJson(collector.RUST_LAYOUT_INPUTS, 65536) !== asciiJson(RUST_LAYOUT_INPUTS, 65536) ||
    asciiJson(collector.RUST_LAYOUT_ROLES, 1024) !== asciiJson(RUST_LAYOUT_ROLES, 1024)) fail('E_RECEIPT');
}
const FLAGS = freeze({ archiveExtracted: false, filesInstalled: false, rustExecuted: false, pythonRuntimeInvoked: false,
  nativeQualified: false, rustReady: false, trainingReady: false, dockerProviderQualified: false,
  installedUsability: false, hardRssBounded: false, hardDeadlineGuaranteed: false, processTreeBounded: false });
let productionActive = false;

// WHAT: Closed five-component data-only operation.
export async function runRegisteredRustComponentLayout() {
  if (productionActive || arguments.length !== 0) return stopped('E_INPUT', false);
  productionActive = true;
  try { return await run({ fs, spawn: nodeSpawn, now: () => performance.now(), moduleImporter: target => import(target) }, false); }
  finally { productionActive = false; }
}
function stopped(error, mockOnly) {
  return Object.freeze({ exitCode: 1, text: asciiJson({ profile: 'registered-rust-component-layout-v1', status: 'STOP',
    error, mockOnly, realArchiveInspected: false, ...FLAGS }, 65536) });
}
// WHAT: In-memory capabilities for the fixed production manifest; never live qualification.
export async function runRegisteredRustComponentLayoutMock(config) {
  try {
    if (!config || typeof config !== 'object' || types.isProxy(config)) fail('E_INPUT');
    const allowed = ['fs', 'spawn', 'now', 'moduleImporter', 'setTimeout', 'clearTimeout'], deps = {};
    for (const key of Reflect.ownKeys(config)) {
      const field = Object.getOwnPropertyDescriptor(config, key);
      if (!allowed.includes(key) || !field || !Object.hasOwn(field, 'value')) fail('E_INPUT');
      deps[key] = field.value;
    }
    if (!deps.fs || deps.fs === fs || !['spawn', 'now', 'moduleImporter'].every(key => typeof deps[key] === 'function' && !types.isProxy(deps[key]))) fail('E_INPUT');
    return await run(deps, true);
  } catch (error) { return stopped(errorCode(error), true); }
}
async function run(deps, mockOnly) {
  const repoCapture = captureCounts();
  const counts = { spawnAttempts: 0, spawnEvents: 0, ownedChildren: 0, peakChildren: 0, childCloses: 0,
    stageChecks: 0, preloadChecks: 0, stageFsCalls: 0, stageReadBytes: 0, stageCloses: 0,
    completedCorePasses: 0, archivePasses: 0, archiveDataBytes: 0, archiveRequestedBytes: 0,
    archiveCloseAttempts: 0, expandedBytes: 0, streamEvents: 0, entries: 0 };
  let started, last, publicationStarted = null, roleStarted = null, collector = null, error = null, role = null, diagnostic = null;
  let sourceAccountingComplete = false, stageAccountingComplete = false;
  function guard(limit = 300000) {
    let now;
    try { now = deps.now(); } catch { fail('E_CLOCK'); }
    if (!Number.isFinite(now) || (last !== undefined && now < last)) fail('E_CLOCK');
    if (started === undefined) started = now;
    last = now;
    if (!Number.isFinite(started + 300000) || started + 300000 <= started) fail('E_CLOCK');
    if (now - started >= limit ||
      (roleStarted !== null && now - roleStarted >= 45000) ||
      (publicationStarted !== null && now - publicationStarted >= 30000)) fail('E_DEADLINE');
    return now;
  }
  const abort = () => { if (collector) { try { collector.abortLayoutBatch(); } catch { error = 'E_LAYOUT'; } } };
  const base = status => ({ profile: 'registered-rust-component-layout-v1', status, mockOnly,
    sourcePins: RUST_LAYOUT_SOURCE_PINS, counts, repoCapture, sourceAccountingComplete, stageAccountingComplete,
    sourceCountersScope: 'repository captures; positive closes before hashing, parsing or importing',
    stageCountersScope: 'completed verification helpers; closeAttempts positive only on return',
    archiveCountersScope: 'completed frozen-core results only; failed-pass bytes not zero-byte assertions',
    archiveAccountingComplete: counts.completedCorePasses === 5,
    candidateInvocationAttempted: counts.spawnAttempts > 0,
    candidateExecuted: counts.spawnAttempts === 0 ? false : !mockOnly && counts.completedCorePasses === 5 ? true : null,
    realArchiveInspected: status !== 'STOP' && !mockOnly, ...FLAGS });
  try {
    guard(10000);
    if (!RUST_LAYOUT_SOURCE_PINS.collector || !RUST_LAYOUT_SOURCE_PINS.linkedCores) fail('E_HELPER_PENDING');
    const sources = new Map();
    for (const [key] of SOURCE_ROWS) sources.set(key, captureSource(key, deps.fs, repoCapture, guard));
    if (repoCapture.ownedFds !== 0 || repoCapture.closes !== SOURCE_ROWS.length) fail('E_CLOSE');
    sourceAccountingComplete = true;
    const xzReceipt = freeze(JSON.parse(sources.get('xzReceipt').toString('utf8')));
    const rustReceipt = freeze(JSON.parse(sources.get('rustReceipt').toString('utf8')));
    if (xzReceipt.status !== 'FINITE_XZ_PROFILE_OBSERVED' || xzReceipt.counts.spawnEvents !== 33 ||
      xzReceipt.fixtureManifestSha256 !== '632a0d812366712ae99ce2ce442ad98a59534430640184f70af53df58656b4ea') fail('E_RECEIPT');
    const tar = transformTar(sources.get('rawTar'));
    const stageBytes = pinned(link(sources.get('stage'), 'elf-metadata', uri(sources.get('elf'))), RUST_LAYOUT_SOURCE_PINS.linkedStage);
    const collectorBytes = pinned(link(sources.get('collector'), 'tar-inventory', uri(tar)), RUST_LAYOUT_SOURCE_PINS.linkedCollector);
    const collectorUri = uri(collectorBytes);
    const pipeline = RUST_LAYOUT_ROLES.map(value => pinned(link(transformCore(sources.get('rawCore'), value),
      'tar-inventory', collectorUri), RUST_LAYOUT_SOURCE_PINS.linkedCores[value]));
    guard(10000);
    collector = await deps.moduleImporter(collectorUri); guard(10000);
    const stage = await deps.moduleImporter(uri(stageBytes)); guard(10000);
    const inventories = [];
    for (let index = 0; index < pipeline.length; index++) {
      const inventory = await deps.moduleImporter(uri(pipeline[index])); guard(10000);
      const input = RUST_LAYOUT_INPUTS[index];
      if (asciiJson(inventory.GNU_SDK_DESCRIPTOR, 4096) !== asciiJson({ root: input.root, file: input.file,
        archiveBytes: input.archiveBytes, archiveSha256: input.archiveSha256, decoderRoot: DECODER }, 4096) ||
        asciiJson(inventory.GNU_SDK_LIMITS, 4096) !== asciiJson({ maxTotalMs: 45000, cleanupMs: 3000,
          maxReadsPerPass: 4096, maxFsOperations: 10000, maxExpandedBytes: 1073741824, maxHeaders: 32768,
          maxStreamEvents: 262144, maxStderrBytes: 8192, maxSelectedEntries: 128, maxSelectedBytes: 131072,
          maxSummaryBytes: 4194304 }, 4096)) fail('E_COMPONENT');
      inventories.push(inventory);
    }
    compareInputs(collector, rustReceipt);
    collector.beginLayoutBatch(); guard(10000);
    const acceptedState = (number, currentRole = null) => {
      const snapshot = collector.snapshotLayout();
      if (snapshot.state !== 'ACTIVE' || snapshot.mockOnly !== false || snapshot.acceptedRoles !== number ||
        snapshot.currentRole !== currentRole || snapshot.entries !== counts.entries || snapshot.expandedBytes !== counts.expandedBytes ||
        ![snapshot.metadataBytes, snapshot.manifestBytes, snapshot.outputBytes].every(n => Number.isSafeInteger(n) && n >= 0) ||
        snapshot.metadataBytes > 8388608 || snapshot.manifestBytes > 4194304 || snapshot.outputBytes > 16777216) fail('E_LAYOUT');
      return snapshot;
    };
    acceptedState(0);
    const gate = () => {
      guard(); stageAccountingComplete = false;
      const checked = stage.verifyStagedXzImages(xzReceipt.staged);
      const c = checked.counters;
      if (![c.fsCalls, c.readBytes, c.closeAttempts].every(n => Number.isSafeInteger(n) && n >= 0) ||
        c.closeAttempts !== 5 || c.fsCalls > 1024 || c.readBytes !== 2758216) fail('E_RECEIPT');
      counts.stageChecks++; counts.stageFsCalls += c.fsCalls; counts.stageReadBytes += c.readBytes; counts.stageCloses += c.closeAttempts;
      stageAccountingComplete = true;
      if (stage.assertNoSystemPreload() !== true) fail('E_PRELOAD');
      counts.preloadChecks++;
      if (counts.stageChecks > 10 || counts.preloadChecks > 10 || counts.stageCloses > 50) fail('E_LIMIT');
      guard(); return { stagedImagesVerified: true, preloadAbsent: true, ordinaryProfileObserved: true };
    };
    for (let index = 0; index < 5; index++) {
      role = RUST_LAYOUT_ROLES[index];
      if (300000 - (guard() - started) < 75000) fail('E_DEADLINE');
      roleStarted = last;
      collector.beginLayoutRole(role);
      acceptedState(index, role);
      const input = RUST_LAYOUT_INPUTS[index];
      let roleAttempts = 0;
      const coreDeps = { beforeDecode: gate, afterDecode: gate, fs: deps.fs, now: deps.now,
        spawn(...args) {
          guard(); roleAttempts++; counts.spawnAttempts++;
          if (roleAttempts > 1 || counts.spawnAttempts > 5 || counts.ownedChildren !== 0) fail('E_LIMIT');
          const expectedArgs = ['--inhibit-cache', '--glibc-hwcaps-mask', '', '--library-path', DECODER,
            DECODER + '/xz', '--decompress', '--stdout', '--format=xz', '--threads=1', '--memlimit-decompress=268435456', '--', '-'];
          if (args[0] !== DECODER + '/ld-linux-x86-64.so.2' || asciiJson(args[1], 4096) !== asciiJson(expectedArgs, 4096) ||
            asciiJson(args[2], 4096) !== asciiJson({ cwd: DECODER, env: { LC_ALL: 'C', LANG: 'C', TZ: 'UTC' },
              shell: false, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true }, 4096)) fail('E_SPAWN');
          const child = deps.spawn(...args);
          counts.ownedChildren++; counts.peakChildren = Math.max(counts.peakChildren, counts.ownedChildren);
          child.once('spawn', () => { counts.spawnEvents++; });
          child.once('close', () => { counts.ownedChildren--; counts.childCloses++; });
          return child;
        } };
      for (const key of ['setTimeout', 'clearTimeout']) if (Object.hasOwn(deps, key)) coreDeps[key] = deps[key];
      const value = await inventories[index].runGnuSdkInventory(input.identity, coreDeps);
      guard();
      roleStarted = null;
      if (index === 4) publicationStarted = last;
      if (value.state !== 'GNU_SDK_DATA_INVENTORY' || value.mockOnly !== false ||
        value.archiveBytes !== input.archiveBytes || value.archiveSha256 !== input.archiveSha256 ||
        value.archivePasses !== 2 || value.archiveDataBytes !== input.archiveBytes * 2 ||
        value.archiveRequestedBytes !== input.archiveBytes * 2 + 2 || value.closeAttempts !== 2 ||
        value.exitCode !== 0 || value.signal !== null || roleAttempts !== 1 || counts.spawnEvents !== index + 1 ||
        counts.ownedChildren !== 0 || counts.childCloses !== index + 1 || counts.stageChecks !== (index + 1) * 2 ||
        counts.preloadChecks !== (index + 1) * 2 || counts.stageCloses !== (index + 1) * 10 ||
        !['stdinFinished', 'stdoutEnded', 'stderrEnded', 'closeObserved'].every(key => value[key] === true) ||
        ['extracted', 'nativeQualified', 'pythonFreeSubsetVerified', 'rustReady', 'trainingReady'].some(key => value[key] !== false)) fail('E_RECEIPT');
      if (![value.expandedBytes, value.streamEvents, value.inventory.entries].every(n => Number.isSafeInteger(n) && n >= 0) ||
        value.expandedBytes > 1073741824 || value.streamEvents > 262144 || value.inventory.entries > 32768 ||
        value.expandedBytes > 2147483648 - counts.expandedBytes || value.inventory.entries > 65536 - counts.entries) fail('E_LIMIT');
      counts.completedCorePasses++; counts.archivePasses += 2; counts.archiveDataBytes += value.archiveDataBytes;
      counts.archiveRequestedBytes += value.archiveRequestedBytes; counts.archiveCloseAttempts += value.closeAttempts;
      counts.expandedBytes += value.expandedBytes; counts.streamEvents += value.streamEvents; counts.entries += value.inventory.entries;
      collector.acceptLayoutRole(value); guard(); acceptedState(index + 1);
    }
    if (counts.archivePasses !== 10 || counts.archiveCloseAttempts !== 10 || counts.stageChecks !== 10 ||
      counts.preloadChecks !== 10 || counts.stageCloses !== 50 || counts.spawnAttempts !== 5 || counts.spawnEvents !== 5 ||
      counts.childCloses !== 5 || counts.ownedChildren !== 0 || counts.peakChildren !== 1) fail('E_RECEIPT');
    guard(); acceptedState(5);
    const layout = collector.finishLayoutBatch();
    guard();
    if (layout.state !== 'RUST_COMPONENT_LAYOUT_DATA' || layout.profile !== 'RUST_COMPONENT_LAYOUT_DATA' ||
      layout.mockOnly !== false || !Array.isArray(layout.roles) || layout.roles.length !== 5 ||
      !layout.roles.every((value, index) => value.role === RUST_LAYOUT_ROLES[index]) ||
      layout.entries !== counts.entries || layout.expandedBytes !== counts.expandedBytes) fail('E_LAYOUT');
    const text = asciiJson({ ...base(mockOnly ? 'MOCK_RUST_COMPONENT_LAYOUT' : 'RUST_COMPONENT_LAYOUT_DATA'), layout }, 16777216);
    guard();
    return Object.freeze({ exitCode: 0, text });
  } catch (failure) { error = errorCode(failure); diagnostic = layoutFailure(collector); abort(); }
  return Object.freeze({ exitCode: 1, text: asciiJson({ ...base('STOP'), error, role,
    ...(diagnostic ? { layoutFailure: diagnostic } : {}) }, 65536) });
}

export const rustLayoutSource = Object.freeze({ transformCore, transformTar, replaceOnce, link, pinned,
  captureSource, captureCounts, asciiJson, compareInputs, rows: SOURCE_ROWS });
