// SPEC: _spec/tooling/native-ingress/step2.puml
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawn as nodeSpawn } from 'node:child_process';
import { types } from 'node:util';

const REPO = '/tmp/opencode/f9-bootstrap-correspondence';
const RUST = '/tmp/opencode/f9-rust-runtime-inputs-01';
const DECODER = '/tmp/opencode/f9-xz-qualification-01';
const fail = code => { throw Object.freeze(Object.assign(new Error(code), { code })); };
function own(object, key, code = 'E_OUTPUT') {
  if (!object || !['object', 'function'].includes(typeof object) || types.isProxy(object)) fail(code);
  const field = Object.getOwnPropertyDescriptor(object, key);
  if (!field || !Object.hasOwn(field, 'value')) fail(code);
  return field.value;
}
function freeze(value, seen = new WeakSet()) {
  if (value && typeof value === 'object' && !seen.has(value)) {
    seen.add(value);
    for (const key of Reflect.ownKeys(value)) freeze(own(value, key), seen);
    Object.freeze(value);
  }
  return value;
}
function shape(value, keys, code = 'E_INPUT') {
  if (!value || typeof value !== 'object' || types.isProxy(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(code);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !keys.includes(key)) fail(code);
    own(value, key, code);
  }
  return value;
}
function functionOf(namespace, name) {
  const value = own(namespace, name, 'E_COMPONENT');
  if (typeof value !== 'function' || types.isProxy(value)) fail('E_COMPONENT');
  return value;
}
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const pinOf = bytes => ({ bytes: bytes.length, sha256: sha(bytes) });
const uri = bytes => 'data:text/javascript;base64,' + bytes.toString('base64');
export const RUST_ARCHIVE_ROLES = freeze(['cargo', 'rustc', 'rust-std', 'rustfmt-preview', 'clippy-preview']);
const roleOf = role => { if (!RUST_ARCHIVE_ROLES.includes(role)) fail('E_INPUT'); return role; };
export const RUST_ARCHIVE_PATHS = freeze(Object.fromEntries(RUST_ARCHIVE_ROLES.map(role =>
  [role, REPO + '/_spec/tooling/native-ingress/rust-archive-' + role + '-v1.result.json'])));
export const RUST_ARCHIVE_LIMITS = freeze({ sourceMs: 10000, totalMs: 300000, roleMs: 120000,
  cleanupMs: 3000, publicationMs: 30000, admissionMs: 150000, sourceBytes: 1048576,
  sourceFsOperations: 8192, sourceReadsPerFile: 128, dataBytes: 16777216, receiptBytes: 65536, depth: 64, nodes: 1048576 });
const rustIdentity = { dev: '28', ino: '13954', mode: '16832', uid: '1000', gid: '1000', nlink: '2',
  size: '4096', mtimeNs: '1792857301045485610', ctimeNs: '1792857301045485610' };
export const RUST_ARCHIVE_INPUTS = freeze(Object.fromEntries([
  ['cargo', 'cargo', 10984780, 'e74edd2cf7d0f1f1383b4f00eb90c843750bc489e2ccf7214e6476678a907425', '1211150', '1792857299153485617'],
  ['rustc', 'rustc', 80351960, '8426a3d170a5879f5682f5fbdd024a1779b3951e7baba685af2d6dc32a6dfc15', '1211151', '1792857300349485612'],
  ['rust-std', 'rust-std', 29573972, '047ea7098803d3500fa1072e9cee5392697e21525559e4458128a2bf874aa382', '1211153', '1792857300901485610'],
  ['rustfmt-preview', 'rustfmt', 2164880, 'f1b2a7301513ffdd95ebf22ebbdd932e4d17fc806f748d93924740d0297b1396', '1211154', '1792857301041485610'],
  ['clippy-preview', 'clippy', 4697128, 'ac779bc9839dd47180806b133e4e2563c4a34716284cd5b8fede8ef289f452ca', '1211155', '1792857301361485608'],
].map(([role, name, archiveBytes, archiveSha256, ino, time]) => {
  const expectedRoot = name + '-1.95.0-x86_64-unknown-linux-gnu';
  return [role, { role, root: RUST, file: RUST + '/' + expectedRoot + '.tar.xz', archiveBytes, archiveSha256,
    expectedRoot, decoderMemoryBytes: 268435456, identity: { root: rustIdentity, file: { dev: '29', ino,
      mode: '33152', uid: '1000', gid: '1000', nlink: '1', size: String(archiveBytes), mtimeNs: time, ctimeNs: time } } }];
})));
export const RUST_ARCHIVE_PROFILES = freeze(Object.fromEntries([
  ['cargo', 1, 42864128, 68, 56], ['rustc', 7, 402308096, 70, 53], ['rust-std', 1, 166755840, 81, 74],
  ['rustfmt-preview', 2, 9112576, 22, 16], ['clippy-preview', 2, 21706240, 22, 16],
].map(([role, targetCount, expandedBytes, entries, regularFiles]) => [role,
  { part: 'rust', roles: [role], artifactCount: 1, targetCount, expandedBytes, entries, regularFiles }])));
export const RUST_ARCHIVE_SOURCE_PINS = freeze(Object.fromEntries([
  ['rawCore', 23261, 'bd2fc43633ca3b8f0c485eddb68a1b7505002edecd70eee4bf9cc661f588ef29'],
  ['rawTar', 15548, '050d629963fdf89bd5dff7639260c7de30b08be46320b7b6bb7ed4dac6bb8139'],
  ['extensionTar', 15551, 'b22db5d375d966016f5551b9161119079960d24f9611cf87d145893887575824'],
  ['boundedTar', 15568, '56cac49b3cfe51dbf2a7f7d1f4a0d877ae8773f940585ebea72740373689fae2'],
  ['eventTar', 15595, 'bf8c7fcc56c26aa0618c014d74046dc29b79c09340728b27dd0363a758b9ef9a'],
  ['sdk', 31569, 'fc301816588aa16360ce30a9c18ea7d5d82838432e7bd28f54155024e4445469'],
  ['elfV3', 20493, '3bd878fe2a6de57a2b8252163cdf2a4d3093c6605a903105a9f531f039b84f10'],
  ['elfV5', 21800, '1d9ebc5b27944ab646b2f61d334d2ff4bf43bddf226402ba225f6c02cf11dccb'],
  ['stage', 16688, 'f75c21a58bb67e6ab3f8b1dafd090e11ac2d3a70f017da35afb81b00761b71b4'],
  ['elfMetadata', 19842, 'b223a655eae572137891a2c6efafee16887a2478fc91052f0092b48dfd65de85'],
  ['xzReceipt', 4239, 'e45d65231c0815ab2b895c0d74467500a0e6caf33cc0a4ee342b20489ce6b233'],
  ['rustReceipt', 4012, 'c068579e97c9c01c707bae0cdffb082bf23d7f089bcd404a114d290e0476be87'],
  ['sdkInventoryReceipt', 2732, '755a922e587e17b5978e3df77f96ac4a6fb43499d19df895c9148f0952fedcf5'],
  ['sdkCatalogReceipt', 5707, '6f0136fd082bf8c4a06fbb0d5f2734ab361c67707239f07b99f7087af1970492'],
  ['rustLayoutReceipt', 7637, '48a8091b6ef4541593aeb98e0140b107e016c36466b323e3570323e337054239'],
  ['collector', 49481, 'e3de2b2bebeec037a0962e8e7ca3a0e0cf69faec1363872232ef869a1b75b99c'],
  ['writer', 18003, '9e3d6d84e58d5e86a3097a4d8a731dcef9c922622b1fc225acf0385b218f41aa'],
].map(([key, bytes, sha256]) => [key, { bytes, sha256 }])));
export const RUST_ARCHIVE_GRAPH_PINS = freeze(Object.fromEntries([
  ['eventTar', 15595, 'bf8c7fcc56c26aa0618c014d74046dc29b79c09340728b27dd0363a758b9ef9a'],
  ['appendedSdk', 31647, '22be684fb42feecbf6ac629f8e1fbf310bb31635325a9d1dc5a9e81fd75ee3b8'],
  ['tarLinkedSdk', 52452, '60931c3c8ba2b491ecdac39e4b0106da55fe312ecd9164fb3086909695d9fef2'],
  ['linkedSdk', 79779, 'aeeafd8124729ef1ee3d54787c40249a6740796ae806a8d97d370e042690d2f2'],
  ['appendedCollector', 51128, 'bbfd5e6a7abb7e79bebfc8e5e0edc06443a25219ca25f2b35433210ad83826c9'],
  ['tarLinkedCollector', 71933, '8aef409e6121d260577023370c1b1183bbfbba11c6e377bae704296c212bf522'],
  ['elfLinkedCollector', 101004, 'b950fa71689d4fd4399a4a4b271a504c4f311465aa52f2a13a08f6a1eed03263'],
  ['linkedCollector', 207376, '253913c219f0d4f4f3c5d5dfe6fbd14ad1eaabf511b895bf6f5a58aee014d16c'],
  ['linkedStage', 43154, '89b6c5e3dcbf902937f81fc642d7238bd4ec4ca3c94f6b61f4d069efdce8c5f2'],
  ['writerParts', 18051, 'e0707a461ba06135cd20c5ad83dd31c90533a0a8489f26834201ecc8608f3187'],
  ['linkedWriter', 18447, 'ca1d9ca61b349eb24a1b10b15fbfdd3994bd6154aa740e493656bc9f6ee1145a'],
  ['cargo:descriptor', 23275, '110dcdd97383fb76f68233110013cf3523c1b3cf5e98cf02defad9ff83bb988b'],
  ['cargo:events', 23276, '195fa04a81d43aed4749e6b6c029fec31efa49712f2a9bae49c60640c7351189'],
  ['cargo:summary', 23278, '4be41e170a7176357e55de21fb973cba3cd680278665b26377d5de474a3e63d7'],
  ['cargo:selectors', 22521, '54ff4c34ea6bf20047d2d3618fabb345a98ad274fd64ebdb1ed017b13abee3af'],
  ['cargo:memory', 22522, '0920c030c84f7c84946932f2af3eb82b1777c3c0d9fb483e3fffa2c15543b2a9'],
  ['cargo:parserBinding', 22542, '5e9ee28d27acf7fdfeab7aad234f2ee508fa4de5d734c6ae669a9c466e8e0e51'],
  ['cargo:linkedCore', 299055, '911a49841a3fcff6b5d859998d32e8f83b741aa12c539047716913f42b11f525'],
  ['rustc:descriptor', 23275, 'f454d03eb05e38c6d6cbf35b0ac6e7d124fa35d67ce571e3809c2ec7a57e2920'],
  ['rustc:events', 23276, '71384fb84fa026ed0abe85a89245280a47987eec1551ccf6f523d14df061f827'],
  ['rustc:summary', 23278, '627e57d83cffcb23e95c37a2f538848a042458cbdb3d340aed7aca615c927576'],
  ['rustc:selectors', 22521, '627f2bdb9a5a114aed22481400cc72ad5cae754e2250342ece49e1ff0687daca'],
  ['rustc:memory', 22522, '9012b1688c887219713352b3830f2284392f3ef3fb6b7c7a9c36693618350b2f'],
  ['rustc:parserBinding', 22542, 'f023527820fef6a86524d215f75abb5cadeb4bef009aefd29613cbbfdfe785cc'],
  ['rustc:linkedCore', 299055, 'b5e75878e30904e882a85369607aa331a9330f3480307b5cf763d2839f1d687b'],
  ['rust-std:descriptor', 23278, '91daf6b52b5b6e584e853ab2a7ca4a28f71e33cae760d427b2d84cabf55b8774'],
  ['rust-std:events', 23279, 'f087722b4ab82ca94d90b4a78d95127a79020e54acdd7c7faebbb14feb9b619b'],
  ['rust-std:summary', 23281, '4ee8968ae9546f455c4f8ff740211f56cbf6863bb6ae6afc89c3ca9c502d53d6'],
  ['rust-std:selectors', 22524, 'ffad04489106ef6f14edae787d55872ebc9da41863c126bf14333e72e27dd586'],
  ['rust-std:memory', 22525, '3862f4aa09bf46874abf7197c7241b24ef5831e1ada9f32d6b3d49521d2207ec'],
  ['rust-std:parserBinding', 22548, 'c61ac3abf1dc1b83e33ee477eb3aab6849bb370c818eaac7ed0273072377d6c8'],
  ['rust-std:linkedCore', 299061, '9b1ce3338ccbc664e906419e8a2690eb267620dca303f7e6fb46282e7c306d91'],
  ['rustfmt-preview:descriptor', 23276, 'f9d96eebdb7cd9ccb36842dd895e8cbe1df62c8f5c3d39117b85a68fa445b44b'],
  ['rustfmt-preview:events', 23277, '18a0aaf45c1d929ee50acb546f6892ce0fa5e68f6ee03b8dd93ebc449c3983f3'],
  ['rustfmt-preview:summary', 23279, '347deaf36633485189b1b8b6686b635dd740c5ade5eb7887d0e712922bebf4e2'],
  ['rustfmt-preview:selectors', 22522, 'febbe837afaa60971ad313d938d7aa14ef151b3124c298babde030f9905aa811'],
  ['rustfmt-preview:memory', 22523, 'cde57bdb81ac99ada4d787d13c5b39933af58660269d504aeca33772e8c7bbc2'],
  ['rustfmt-preview:parserBinding', 22545, 'af62e04f2e27dc3b0eeb5ca09e891fb13b9aa58368c5e116905dbcf7ccef6b3b'],
  ['rustfmt-preview:linkedCore', 299058, '7d57edb9ecd5c03a1d766fcf2e67959c8083a8a9857ba15d435e3b78d65ac9e5'],
  ['clippy-preview:descriptor', 23275, '20f4b9a83e4d2aac41406b8ef5854fb22a05e3039211d320ade3920b1987080b'],
  ['clippy-preview:events', 23276, 'f4780d9487e436c86152801b7f02c26824e78ae41a927046a748f2b83293c11a'],
  ['clippy-preview:summary', 23278, '63aadf38752d2dac79f5016ed825546b80057a545e18209d58eeb43490ebfe07'],
  ['clippy-preview:selectors', 22521, 'be0403beb8ee45e21febac76c34e310fadc58408fef26ac429bed50636dac702'],
  ['clippy-preview:memory', 22522, '86a2340dac2c44b75ba551467d7745b631dd7791ce7331a2304916aa138e3e29'],
  ['clippy-preview:parserBinding', 22543, 'afeec3f873ddec13f7425029d0047da96d02485a34c3e44dd3bd459ee2c64f3e'],
  ['clippy-preview:linkedCore', 299056, 'a20b1b5ee0e02f78cbaf595fce3f05fe92bf57a213e4ba8ec4b9bcc53c908dcd'],
].map(([key, bytes, sha256]) => [key, { bytes, sha256 }])));
const FIXED_GRAPH_PINS = freeze(Object.fromEntries([
  ['eventTar', 15595, 'bf8c7fcc56c26aa0618c014d74046dc29b79c09340728b27dd0363a758b9ef9a'],
  ['appendedSdk', 31647, '22be684fb42feecbf6ac629f8e1fbf310bb31635325a9d1dc5a9e81fd75ee3b8'],
  ['tarLinkedSdk', 52452, '60931c3c8ba2b491ecdac39e4b0106da55fe312ecd9164fb3086909695d9fef2'],
  ['linkedSdk', 79779, 'aeeafd8124729ef1ee3d54787c40249a6740796ae806a8d97d370e042690d2f2'],
  ['linkedStage', 43154, '89b6c5e3dcbf902937f81fc642d7238bd4ec4ca3c94f6b61f4d069efdce8c5f2'],
].map(([key, bytes, sha256]) => [key, { bytes, sha256 }])));
const SOURCE_ROWS = freeze([
  ['rawCore', REPO + '/tooling/native-ingress/gnu-sdk-inventory.mjs'],
  ['rawTar', REPO + '/tooling/native-ingress/tar-inventory.mjs'],
  ['sdk', REPO + '/tooling/native-ingress/sdk-payload-inspection.mjs'],
  ['elfV3', REPO + '/tooling/native-ingress/elf-requirements-v3.mjs'],
  ['elfV5', REPO + '/tooling/native-ingress/elf-requirements-v5.mjs'],
  ['stage', REPO + '/tooling/native-ingress/xz-staging.mjs'],
  ['elfMetadata', REPO + '/tooling/native-ingress/elf-metadata.mjs'],
  ['collector', REPO + '/tooling/native-ingress/split-toolchain-evidence.mjs'],
  ['writer', REPO + '/tooling/native-ingress/split-evidence-publication.mjs'],
  ['xzReceipt', REPO + '/_spec/tooling/native-ingress/xz-qualification.receipt.json'],
  ['rustReceipt', REPO + '/_spec/tooling/native-ingress/rust-runtime-inputs.receipt.json'],
  ['sdkInventoryReceipt', REPO + '/_spec/tooling/native-ingress/gnu-sdk-inventory-v4.receipt.json'],
  ['sdkCatalogReceipt', REPO + '/_spec/tooling/native-ingress/gnu-sdk-subset-catalog.receipt.json'],
  ['rustLayoutReceipt', REPO + '/_spec/tooling/native-ingress/rust-component-layout.receipt.json'],
]);
const FLAGS = freeze(Object.fromEntries([
  'rawHistoricalResultsRestored', 'archiveExtracted', 'extracted', 'extractionAuthorized', 'filesInstalled',
  'sdkExecuted', 'rustExecuted', 'runtimeExecuted', 'pythonRuntimeInvoked', 'pythonFreeSubsetVerified',
  'nativeQualified', 'nativeAuthority', 'rustReady', 'trainingReady', 'dockerProviderQualified', 'installedUsability',
  'relocationReady', 'roleSatisfied', 'provenanceVerified', 'loaderClosureVerified', 'decoderQualified', 'abiVerified',
  'runtimeProvidersQualified', 'qualified', 'providerQualified', 'imagePrepared', 'sourceReady', 'rootfsReady',
  'installReady', 'completeInstallMap', 'completeInstallerInterpretation', 'hardRssBounded', 'hardDeadlineGuaranteed',
  'processTreeBounded', 'ioIsolated', 'sourceRootAuthentication', 'ancestorRacesExcluded', 'atomicCrashCommit',
  'storageFailureSurvival', 'authenticatedStorage', 'abiQualified', 'noPythonRuntimeVerified', 'imageEquivalent',
  'installMapInterpreted', 'nodeIoQualified', 'compilerExecuted', 'memberExecuted', 'jointEvidenceSetComplete',
].map(key => [key, false])));
const CODES = new Set(['E_INPUT', 'E_IN_FLIGHT', 'E_HELPER_PENDING', 'E_SOURCE_PIN', 'E_METADATA', 'E_BINDING', 'E_IO',
  'E_CLOSE', 'E_LENGTH', 'E_HASH', 'E_PREREQUISITE', 'E_SPAWN', 'E_PIPE', 'E_DECODER', 'E_TAR', 'E_OUTPUT',
  'E_DEADLINE', 'E_CLEANUP', 'E_CLOCK', 'E_LIMIT', 'E_PRELOAD', 'E_COMPONENT', 'E_RECEIPT', 'E_COLLECTION',
  'E_COLLECTION_ABORT', 'E_PUBLICATION_RECORD', 'E_PUBLICATION_ABORT',
  ...['INPUT', 'LIMIT', 'CHUNK', 'INSPECT', 'DATA', 'STATE', 'METADATA', 'SPAN', 'BODY_HASH', 'MANIFEST', 'ROOT',
    'EVENT', 'TARGET', 'MANIFEST_LIMIT', 'EXPANDED', 'ENTRIES', 'SUMMARY', 'DECODED_HASH', 'METADATA_HASH', 'CORE',
    'OUTPUT'].map(code => 'E_EVIDENCE_' + code),
  ...['ARGUMENT', 'FIXTURE', 'LIMIT', 'GUARD', 'STATE', 'DIRECTORY', 'METADATA', 'BINDING', 'FILE', 'EXISTS',
    'IO', 'CLOSE', 'BYTES', 'JSON', 'WRITE', 'READ', 'HASH', 'EOF', 'ABORTED'].map(code => 'E_PUBLICATION_' + code)]);
function errorCode(error) {
  try { const code = own(error, 'code', 'E_IO'); return CODES.has(code) ? code : 'E_COLLECTION'; }
  catch { return 'E_IO'; }
}
const typed = Object.getPrototypeOf(Uint8Array.prototype);
const typedLength = Object.getOwnPropertyDescriptor(typed, 'length').get;
const typedBacking = Object.getOwnPropertyDescriptor(typed, 'buffer').get;
const typedOffset = Object.getOwnPropertyDescriptor(typed, 'byteOffset').get;
const resizable = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
function pinned(bytes, pin) {
  if (!pin) fail('E_HELPER_PENDING');
  if (!Number.isSafeInteger(pin.bytes) || pin.bytes < 1 || !/^[a-f0-9]{64}$/.test(pin.sha256) ||
    types.isProxy(bytes) || !Buffer.isBuffer(bytes) || typedLength.call(bytes) !== pin.bytes) fail('E_SOURCE_PIN');
  const backing = typedBacking.call(bytes);
  if (types.isSharedArrayBuffer(backing) || (resizable && resizable.call(backing))) fail('E_SOURCE_PIN');
  const captured = Buffer.from(new Uint8Array(backing, typedOffset.call(bytes), typedLength.call(bytes)));
  if (sha(captured) !== pin.sha256) fail('E_SOURCE_PIN');
  return captured;
}
function replaceOnce(source, needle, replacement) {
  const matches = typeof needle === 'string' ? source.split(needle).length - 1 : [...source.matchAll(needle)].length;
  if (matches !== 1) fail('E_SOURCE_PIN');
  return source.replace(needle, () => replacement);
}
const link = (bytes, name, target) => Buffer.from(replaceOnce(bytes.toString('utf8'),
  "from './" + name + ".mjs'", "from '" + target + "'"));
function transformTar(bytes) {
  let source = pinned(bytes, RUST_ARCHIVE_SOURCE_PINS.rawTar).toString('utf8');
  source = replaceOnce(source, 'maxExtensionBytes: 65_536', 'maxExtensionBytes: 4_194_304');
  pinned(Buffer.from(source), RUST_ARCHIVE_SOURCE_PINS.extensionTar);
  source = replaceOnce(source, "if (size > limits.maxExtensionBytes - extensionBytes) fail('E_EXTENSION_BYTES');",
    "if (size > 65_536 || size > limits.maxExtensionBytes - extensionBytes) fail('E_EXTENSION_BYTES');");
  pinned(Buffer.from(source), RUST_ARCHIVE_SOURCE_PINS.boundedTar);
  source = replaceOnce(source, '{ index: entries + 1, path: key, type: kind, size }',
    '{ index: entries + 1, path: key, type: kind, size, bodyOffset: consumedBytes }');
  return pinned(Buffer.from(source), RUST_ARCHIVE_SOURCE_PINS.eventTar);
}
const BRIDGES = freeze({ cargo: 'SOURCE_CARGO_TAR', rustc: 'SOURCE_RUSTC_TAR', 'rust-std': 'SOURCE_RUST_STD_TAR',
  'rustfmt-preview': 'SOURCE_RUSTFMT_TAR', 'clippy-preview': 'SOURCE_CLIPPY_TAR' });
function descriptorFor(input) {
  return { root: input.root, file: input.file, archiveBytes: input.archiveBytes,
    archiveSha256: input.archiveSha256, decoderRoot: DECODER };
}
const coreLimits = () => ({ maxTotalMs: 120000, cleanupMs: 3000, maxReadsPerPass: 4096,
  maxFsOperations: 10000, maxExpandedBytes: 1073741824, maxHeaders: 32768, maxStreamEvents: 262144,
  maxStderrBytes: 8192, maxSelectedEntries: 128, maxSelectedBytes: 131072, maxSummaryBytes: 4194304 });
function transformCore(bytes, role, observe = () => {}) {
  const input = RUST_ARCHIVE_INPUTS[roleOf(role)];
  let source = pinned(bytes, RUST_ARCHIVE_SOURCE_PINS.rawCore).toString('utf8');
  const step = (name, needle, replacement) => {
    source = replaceOnce(source, needle, replacement); observe(name, Buffer.from(source));
  };
  step('descriptor', /export const GNU_SDK_DESCRIPTOR = Object\.freeze\(\{\n(?:  [^\n]*\n)+\}\);/g,
    'export const GNU_SDK_DESCRIPTOR = Object.freeze(' + JSON.stringify(descriptorFor(input), null, 2) + ');');
  step('events', 'maxStreamEvents: 32_768', 'maxStreamEvents: 262_144');
  step('summary', 'maxSummaryBytes: 262_144', 'maxSummaryBytes: 4_194_304');
  step('selectors', /const selectors = Object\.freeze\(\[\n(?:  [^\n]*\n)+\]\);/g, 'const selectors = Object.freeze([]);');
  step('memory', "'--memlimit-decompress=16777216'", "'--memlimit-decompress=268435456'");
  step('parserBinding', "import { createTarInventory } from './tar-inventory.mjs';",
    'import { ' + BRIDGES[role] + " as createTarInventory } from './tar-inventory.mjs';");
  return Buffer.from(source);
}
const SDK_APPEND = '\nexport const SOURCE_FORMAT_INSPECTORS = Object.freeze({rel,archive,linker});\n';
const COLLECTOR_APPEND = `
const SOURCE_ARCHIVE_COLLECTORS = new Map();
export const SOURCE_ARCHIVE_PROFILES = freeze(Object.fromEntries(['cargo','rustc','rust-std','rustfmt-preview','clippy-preview'].map(role => [role, {
  part: 'rust', mockOnly: false,
  inputs: SPLIT_TOOLCHAIN_EVIDENCE_INPUTS.rust.filter(input => input.role === role),
  expectations: SPLIT_TOOLCHAIN_EVIDENCE_EXPECTATIONS.rust.filter(expected => expected.role === role),
  targets: SPLIT_TOOLCHAIN_EVIDENCE_TARGETS.rust.filter(target => target.artifactRole === role),
  limits: SPLIT_TOOLCHAIN_EVIDENCE_LIMITS,
}])));
export function SOURCE_CREATE_ARCHIVE(role) {
  if (arguments.length !== 1 || typeof role !== 'string' || !Object.hasOwn(SOURCE_ARCHIVE_PROFILES, role)) fail('E_EVIDENCE_INPUT');
  if (SOURCE_ARCHIVE_COLLECTORS.has(role)) fail('E_EVIDENCE_STATE');
  const value = collector(SOURCE_ARCHIVE_PROFILES[role], {
    parserFactory: originalCreateTarInventory, elfInspector: inspectElf64RequirementsV5, formatInspectors: SOURCE_FORMAT_INSPECTORS,
  });
  SOURCE_ARCHIVE_COLLECTORS.set(role, value);
  return value;
}
export const SOURCE_CARGO_TAR = limits => SOURCE_ARCHIVE_COLLECTORS.get('cargo').createTarInventory(limits);
export const SOURCE_RUSTC_TAR = limits => SOURCE_ARCHIVE_COLLECTORS.get('rustc').createTarInventory(limits);
export const SOURCE_RUST_STD_TAR = limits => SOURCE_ARCHIVE_COLLECTORS.get('rust-std').createTarInventory(limits);
export const SOURCE_RUSTFMT_TAR = limits => SOURCE_ARCHIVE_COLLECTORS.get('rustfmt-preview').createTarInventory(limits);
export const SOURCE_CLIPPY_TAR = limits => SOURCE_ARCHIVE_COLLECTORS.get('clippy-preview').createTarInventory(limits);
`;
const WRITER_PARTS = "export const SPLIT_EVIDENCE_PARTS = Object.freeze(['gnu', 'rust']);";
const WRITER_PATHS = "export const SPLIT_EVIDENCE_PATHS = Object.freeze({\n" +
  "  gnu: '/tmp/opencode/f9-bootstrap-correspondence/_spec/tooling/native-ingress/gnu-evidence-collection-v1.result.json',\n" +
  "  rust: '/tmp/opencode/f9-bootstrap-correspondence/_spec/tooling/native-ingress/rust-evidence-collection-v1.result.json',\n});";
function transformWriter(bytes, observe = () => {}) {
  let source = pinned(bytes, RUST_ARCHIVE_SOURCE_PINS.writer).toString('utf8');
  source = replaceOnce(source, WRITER_PARTS, 'export const SPLIT_EVIDENCE_PARTS = Object.freeze(' + JSON.stringify(RUST_ARCHIVE_ROLES) + ');');
  observe('writerParts', Buffer.from(source));
  source = replaceOnce(source, WRITER_PATHS, 'export const SPLIT_EVIDENCE_PATHS = Object.freeze(' + JSON.stringify(RUST_ARCHIVE_PATHS, null, 2) + ');');
  observe('linkedWriter', Buffer.from(source));
  return Buffer.from(source);
}
function prepareSourceGraph(sources, expectedPins, mockOnly, role) {
  roleOf(role);
  if (typeof mockOnly !== 'boolean') fail('E_INPUT');
  const pins = {}, outputs = {};
  for (const [key] of SOURCE_ROWS) pinned(sources.get(key), RUST_ARCHIVE_SOURCE_PINS[key]);
  const checked = (name, bytes) => {
    if (FIXED_GRAPH_PINS[name]) pinned(bytes, FIXED_GRAPH_PINS[name]);
    if (!mockOnly) pinned(bytes, expectedPins?.[name]);
    pins[name] = pinOf(bytes); outputs[name] = bytes; return bytes;
  };
  const tar = checked('eventTar', transformTar(sources.get('rawTar'))), tarUri = uri(tar);
  const appended = checked('appendedSdk', Buffer.concat([sources.get('sdk'), Buffer.from(SDK_APPEND)]));
  const tarSdk = checked('tarLinkedSdk', link(appended, 'tar-inventory', tarUri));
  const sdk = checked('linkedSdk', link(tarSdk, 'elf-requirements-v3', uri(sources.get('elfV3'))));
  const appendedCollector = checked('appendedCollector', Buffer.concat([sources.get('collector'), Buffer.from(COLLECTOR_APPEND)]));
  const collector1 = checked('tarLinkedCollector', link(appendedCollector, 'tar-inventory', tarUri));
  const collector2 = checked('elfLinkedCollector', link(collector1, 'elf-requirements-v5', uri(sources.get('elfV5'))));
  const collector = checked('linkedCollector', link(collector2, 'sdk-payload-inspection', uri(sdk)));
  const collectorUri = uri(collector);
  const stage = checked('linkedStage', link(sources.get('stage'), 'elf-metadata', uri(sources.get('elfMetadata'))));
  const writer = transformWriter(sources.get('writer'), checked);
  const coreUris = Object.fromEntries(RUST_ARCHIVE_ROLES.map(selected => {
    const core = transformCore(sources.get('rawCore'), selected, (name, bytes) => checked(selected + ':' + name, bytes));
    return [selected, uri(checked(selected + ':linkedCore', link(core, 'tar-inventory', collectorUri)))];
  }));
  return { pins: freeze(pins), outputs, collectorUri, sdkUri: uri(sdk), stageUri: uri(stage), writerUri: uri(writer), coreUris };
}
function captureCounts() {
  return { fsCalls: 0, rootChecks: 0, namedChecks: 0, fdChecks: 0, openAttempts: 0, readAttempts: 0,
    requestedBytes: 0, readBytes: 0, closeAttempts: 0, closes: 0, completedCaptures: 0,
    allocations: 0, allocatedBytes: 0, ownedFds: 0, peakOwnedFds: 0 };
}
const FIELDS = freeze(['dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtimeNs', 'ctimeNs']);
function metadata(value, directory, size = null) {
  const result = {};
  for (const key of FIELDS) {
    const field = own(value, key, 'E_METADATA');
    if (typeof field !== 'bigint' || (field < 0n && !key.endsWith('Ns'))) fail('E_METADATA');
    result[key] = field;
  }
  if ((result.mode & 0o170000n) !== (directory ? 0o040000n : 0o100000n) || result.ino <= 0n ||
    (!directory && result.nlink !== 1n) || (size !== null && result.size !== BigInt(size))) fail('E_SOURCE_PIN');
  return result;
}
function sameMetadata(before, after) {
  if (!FIELDS.every(key => before[key] === after[key])) fail('E_BINDING');
}
function captureSource(key, io, counts, guard) {
  const row = SOURCE_ROWS.find(value => value[0] === key), pin = RUST_ARCHIVE_SOURCE_PINS[key];
  if (!row || !pin || !Number.isSafeInteger(pin.bytes) || pin.bytes < 1 || pin.bytes >= 1048576) fail('E_SOURCE_PIN');
  const path = row[1];
  let owned = null, bytes;
  const call = (method, ...args) => {
    guard(10000);
    if (counts.fsCalls + 1 + Number(owned !== null) > 8192) fail('E_LIMIT');
    counts.fsCalls++;
    let result;
    try { result = io[method](...args); } catch { fail('E_IO'); }
    guard(10000); return result;
  };
  const stat = (method, target, directory, size = null) => {
    counts[method === 'fstatSync' ? 'fdChecks' : target === REPO ? 'rootChecks' : 'namedChecks']++;
    return metadata(call(method, target, { bigint: true }), directory, size);
  };
  try {
    const c = fs.constants;
    if (c.O_RDONLY !== 0 || ![c.O_NOFOLLOW, c.O_NONBLOCK].every(value => Number.isInteger(value) && value > 0)) fail('E_PREREQUISITE');
    const root = stat('lstatSync', REPO, true), named = stat('lstatSync', path, false, pin.bytes);
    guard(10000);
    if (counts.fsCalls + 2 > 8192) fail('E_LIMIT');
    counts.fsCalls++; counts.openAttempts++;
    try { owned = io.openSync(path, c.O_RDONLY | c.O_NOFOLLOW | c.O_NONBLOCK); } catch { fail('E_IO'); }
    if (!Number.isSafeInteger(owned) || owned < 0) { owned = null; fail('E_IO'); }
    counts.ownedFds++; counts.peakOwnedFds = Math.max(counts.peakOwnedFds, counts.ownedFds);
    guard(10000);
    const bound = stat('fstatSync', owned, false, pin.bytes); sameMetadata(named, bound);
    if (counts.ownedFds !== 1 || counts.allocatedBytes + pin.bytes + 1 > 1048576) fail('E_LIMIT');
    bytes = Buffer.alloc(pin.bytes + 1); counts.allocations++; counts.allocatedBytes += bytes.length;
    let position = 0, reads = 0;
    const read = length => {
      if (++reads > 128) fail('E_LIMIT');
      counts.readAttempts++; counts.requestedBytes += length;
      const amount = call('readSync', owned, bytes, position, length, position);
      if (!Number.isSafeInteger(amount) || amount < 0 || amount > length) fail('E_LENGTH');
      counts.readBytes += amount; return amount;
    };
    while (position < pin.bytes) {
      const length = Math.min(65536, pin.bytes - position), amount = read(length);
      if (amount !== length) fail('E_LENGTH');
      position += amount;
    }
    if (read(1) !== 0) fail('E_LENGTH');
    sameMetadata(bound, stat('fstatSync', owned, false, pin.bytes));
    sameMetadata(named, stat('lstatSync', path, false, pin.bytes));
    sameMetadata(root, stat('lstatSync', REPO, true));
  } finally {
    if (owned !== null) {
      const fd = owned; owned = null; counts.ownedFds--; counts.closeAttempts++; counts.fsCalls++;
      try { io.closeSync(fd); counts.closes++; } catch { fail('E_CLOSE'); }
    }
  }
  guard(10000);
  const captured = bytes.subarray(0, pin.bytes);
  if (sha(captured) !== pin.sha256) fail('E_SOURCE_PIN');
  guard(10000); counts.completedCaptures++; return captured;
}
function preflight(value, maximum, guard = () => {}, requireFrozen = false) {
  let cost = 1, nodes = 0;
  const seen = new Set();
  const add = amount => { cost += amount; if (cost > maximum) fail('E_OUTPUT'); };
  const string = text => {
    add(2);
    for (let i = 0; i < text.length; i++) {
      if ((i & 65535) === 0) guard();
      const code = text.charCodeAt(i);
      add(code > 127 ? 6 : code < 32 ? [8, 9, 10, 12, 13].includes(code) ? 2 : 6 : code === 34 || code === 92 ? 2 : 1);
    }
  };
  const visit = (item, depth) => {
    if (++nodes > 1048576 || depth > 64) fail('E_OUTPUT');
    if ((nodes & 1023) === 0) guard();
    if (item === null || typeof item === 'boolean') { add(item === null || item === true ? 4 : 5); return; }
    if (typeof item === 'string') { string(item); return; }
    if (typeof item === 'number') { if (!Number.isFinite(item)) fail('E_OUTPUT'); add(JSON.stringify(item).length); return; }
    if (!item || typeof item !== 'object' || types.isProxy(item) || seen.has(item)) fail('E_OUTPUT');
    const array = Array.isArray(item), prototype = Object.getPrototypeOf(item);
    if (prototype !== (array ? Array.prototype : Object.prototype) && !(prototype === null && !array)) fail('E_OUTPUT');
    if (requireFrozen && !Object.isFrozen(item)) fail('E_COLLECTION');
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
    if (array && count !== own(item, 'length')) fail('E_OUTPUT');
    seen.delete(item);
  };
  guard(); visit(value, 0); guard(); return cost;
}
function asciiJson(value, maximum, guard = () => {}) {
  const cost = preflight(value, maximum, guard);
  const result = JSON.stringify(value).replace(/[^\x00-\x7f]/g,
    char => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0')) + '\n';
  if (result.length !== cost || result.length > maximum) fail('E_OUTPUT');
  guard(); return result;
}
const dataSnapshot = (value, maximum, guard = () => {}) => JSON.parse(asciiJson(value, maximum, guard));
function sameData(a, b, maximum = 65536) {
  preflight(a, maximum); preflight(b, maximum);
  const equal = (x, y) => {
    if (x === y) return true;
    if (!x || !y || typeof x !== 'object' || typeof y !== 'object' || Array.isArray(x) !== Array.isArray(y)) return false;
    const keys = Object.keys(x).sort(), other = Object.keys(y).sort();
    return keys.length === other.length && keys.every((key, index) => key === other[index] && equal(x[key], y[key]));
  };
  if (!equal(a, b)) fail('E_COMPONENT');
}
const COLLECTOR_LIMITS = freeze({ maxExpandedBytes: 1073741824, maxBatchExpandedBytes: 2147483648,
  maxEntries: 32768, maxBatchEntries: 65536, maxRoleMetadataBytes: 4194304, maxBatchMetadataBytes: 8388608,
  maxManifestBytes: 1048576, maxBatchManifestBytes: 4194304, maxPayloadBytes: 268435456,
  maxAggregatePayloadBytes: 805306368, maxElfSnapshotBytes: 268435456, maxArBytes: 8388608,
  maxTextBytes: 1048576, maxOutputBytes: 16777216, maxChunkBytes: 65536 });
const WRITER_LIMITS = freeze({ maxBytes: 16777216, chunkBytes: 65536, maxFsOperations: 8192,
  maxWriteAttempts: 4096, maxReadAttempts: 1024, maxRequestedReadBytes: 16777217 });
const METHODS = freeze(['beginToolchainEvidenceBatch', 'beginToolchainEvidenceRole', 'createTarInventory',
  'acceptToolchainEvidenceRole', 'finishToolchainEvidenceBatch', 'abortToolchainEvidenceBatch',
  'getToolchainEvidenceFailure', 'snapshotToolchainEvidenceBatch']);
function compareConstants(helper, receipts, role) {
  roleOf(role);
  sameData(own(helper, 'SPLIT_TOOLCHAIN_EVIDENCE_PARTS'), ['gnu', 'rust']);
  const inputs = own(helper, 'SPLIT_TOOLCHAIN_EVIDENCE_INPUTS'), expected = own(helper, 'SPLIT_TOOLCHAIN_EVIDENCE_EXPECTATIONS');
  const targets = own(helper, 'SPLIT_TOOLCHAIN_EVIDENCE_TARGETS'), profiles = own(helper, 'SPLIT_TOOLCHAIN_EVIDENCE_PROFILES');
  sameData(own(helper, 'SPLIT_TOOLCHAIN_EVIDENCE_LIMITS'), COLLECTOR_LIMITS);
  preflight(inputs, 65536); preflight(expected, 65536); preflight(targets, 65536); preflight(profiles, 65536);
  sameData(inputs.rust, RUST_ARCHIVE_ROLES.map(key => RUST_ARCHIVE_INPUTS[key]));
  sameData(profiles.rust, { part: 'rust', roles: RUST_ARCHIVE_ROLES, artifactCount: 5, targetCount: 13,
    expandedBytes: 642746880, entries: 263, regularFiles: 215 });
  const rust = receipts.rustReceipt, layout = receipts.rustLayoutReceipt;
  if (rust.status !== 'RUST_INPUT_BYTES_MATCHED' || rust.root !== RUST || rust.inputs.length !== 5 ||
    layout.status !== 'RUST_COMPONENT_LAYOUT_DATA' || layout.roles.length !== 5) fail('E_RECEIPT');
  sameData(rust.rootFinal, rustIdentity);
  rust.inputs.forEach((row, index) => {
    const input = RUST_ARCHIVE_INPUTS[RUST_ARCHIVE_ROLES[index]];
    if (row.verified !== true || row.incomingSha256 !== input.archiveSha256 || row.readbackSha256 !== input.archiveSha256 ||
      row.name !== input.expectedRoot + '.tar.xz' || row.byteLength !== input.archiveBytes || row.role !== input.role) fail('E_RECEIPT');
    sameData(row.finalMetadata, input.identity.file);
  });
  const expectations = layout.roles.map(row => ({ role: row.role, expandedBytes: row.expandedBytes, entries: row.entries,
    headers: row.headers, regularFiles: row.regularFiles, decodedSha256: row.decodedSha256,
    metadataSha256: row.metadataSha256, metadataHashKind: 'OFFSET_EVENT_METADATA' }));
  const selected = layout.runtimeInspectionCandidates.map(old => ({ artifactRole: old.role, path: old.path,
    index: old.index, bodyOffset: old.bodyOffset, size: old.size, expectedSha256: old.sha256,
    kind: old.size === 42 ? 'LINKER_TEXT' : 'ELF_EXEC_DSO', domain: old.role === 'rust-std' ? 'TARGET' : 'HOST',
    selectionRole: 'RUST_RUNTIME_CANDIDATE', optionalForMinimalC: false, maxBytes: old.size === 42 ? 1048576 : 268435456 }));
  if (selected.length !== 13) fail('E_COMPONENT');
  sameData(expected.rust, expectations); sameData(targets.rust, selected);
  const singleton = own(own(helper, 'SOURCE_ARCHIVE_PROFILES'), role);
  const result = { part: 'rust', mockOnly: false, inputs: [RUST_ARCHIVE_INPUTS[role]],
    expectations: expectations.filter(row => row.role === role), targets: selected.filter(row => row.artifactRole === role), limits: COLLECTOR_LIMITS };
  sameData(singleton, result);
  const profile = RUST_ARCHIVE_PROFILES[role], expectation = result.expectations[0];
  if (result.expectations.length !== 1 || result.targets.length !== profile.targetCount ||
    ['entries', 'regularFiles', 'expandedBytes'].some(key => expectation[key] !== profile[key])) fail('E_COMPONENT');
  return result;
}
function validateCollection(collection, expectations, targets, artifactRole) {
  const profile = RUST_ARCHIVE_PROFILES[roleOf(artifactRole)], input = RUST_ARCHIVE_INPUTS[artifactRole], expected = expectations[0];
  if (collection.state !== 'SPLIT_TOOLCHAIN_EVIDENCE_DATA' || collection.profile !== collection.state || collection.part !== 'rust' ||
    collection.mockOnly !== false || !Array.isArray(collection.roles) || collection.roles.length !== 1 ||
    collection.entries !== profile.entries || collection.regularFiles !== profile.regularFiles || collection.expandedBytes !== profile.expandedBytes ||
    collection.completeNamespace !== true || collection.selectedPayloads !== profile.targetCount || collection.artifactCount !== 1 ||
    collection.targetCount !== profile.targetCount || !Array.isArray(collection.declaredNeededEdges)) fail('E_COLLECTION');
  const role = collection.roles[0], expectedEdges = [];
  if (role.role !== artifactRole || role.decodedSha256 !== expected.decodedSha256 ||
    !Array.isArray(role.members) || role.members.length !== expected.entries || role.completeNamespace !== true ||
    role.metadataSha256 !== expected.metadataSha256 || role.metadataHashKind !== 'OFFSET_EVENT_METADATA' ||
    role.offsetMetadataSha256 !== expected.metadataSha256 || role.inventory?.metadataSha256 !== role.offsetMetadataSha256 ||
    role.archiveBytes !== input.archiveBytes || role.archiveSha256 !== input.archiveSha256 ||
    role.expectedRoot !== input.expectedRoot || role.decoderMemoryBytes !== input.decoderMemoryBytes ||
    !Array.isArray(role.manifests) || role.manifests.length !== 3 || !Array.isArray(role.selected)) fail('E_COLLECTION');
  const names = new Set(); let regular = 0;
  role.members.forEach((member, ordinal) => {
    if (member.index !== ordinal + 1 || typeof member.path !== 'string' ||
      !(member.path === input.expectedRoot || member.path.startsWith(input.expectedRoot + '/')) ||
      Buffer.byteLength(member.path) > 1024 || /[\u0000-\u001f\u007f-\u009f\\]/u.test(member.path) ||
      member.path.split('/').some(piece => piece === '.' || piece === '..' || piece === '') || names.has(member.path) ||
      !['file', 'directory', 'hardlink', 'symlink'].includes(member.type) ||
      !Number.isSafeInteger(member.bodyOffset) || member.bodyOffset < 512 || member.bodyOffset % 512 !== 0 ||
      !Number.isSafeInteger(member.size) || member.size < 0 || member.size > expected.expandedBytes - member.bodyOffset) fail('E_COLLECTION');
    names.add(member.path);
    if (member.type === 'file') {
      regular++; if (typeof member.bodySha256 !== 'string' || !/^[a-f0-9]{64}$/.test(member.bodySha256)) fail('E_COLLECTION');
    } else if (member.size !== 0 || member.bodySha256 !== null || member.linkFollowed !== false) fail('E_COLLECTION');
  });
  if (regular !== expected.regularFiles || role.selected.length !== targets.length) fail('E_COLLECTION');
  const selectedNames = new Set();
  for (const selected of role.selected) {
    const target = targets.find(row => row.path === selected.path), member = role.members[selected.index - 1];
    if (!target || selectedNames.has(selected.path) || !member || member.path !== selected.path || member.type !== 'file' ||
      selected.bodySha256 !== member.bodySha256 || selected.bodyOffset !== member.bodyOffset || selected.size !== member.size ||
      selected.size > target.maxBytes || selected.qualified !== false || selected.abiVerified !== false || selected.roleSatisfied !== false ||
      !selected.metadata || typeof selected.metadata !== 'object' || selected.hashObservation !== 'MATCHED_EXPECTED_BODY_HASH') fail('E_COLLECTION');
    const metadata = selected.metadata;
    if (metadata.qualified !== false) fail('E_COLLECTION');
    if (selected.kind === 'ELF_EXEC_DSO') {
      const needed = metadata.requirements?.dynamic?.needed;
      if (metadata.state !== 'ELF_EXEC_DSO_REQUIREMENT_DATA' || !Array.isArray(needed) || needed.length > 32 ||
        !Array.isArray(metadata.unsafeLoadingTags) || metadata.loadingTagsQualification !== 'NOT_QUALIFIED') fail('E_COLLECTION');
      for (const name of needed) {
        if (typeof name !== 'string' || name.length < 1 || Buffer.byteLength(name) > 1024) fail('E_COLLECTION');
        expectedEdges.push({ artifactRole, from: selected.path, domain: selected.domain, needed: name,
          status: 'UNRESOLVED', providerQualified: false, abiVerified: false, aliasFollowed: false, hostTargetPromotion: false });
      }
    } else if (metadata.state !== 'SOURCE_FORMAT_DATA' || !metadata.observation || typeof metadata.observation !== 'object') fail('E_COLLECTION');
    for (const key of ['artifactRole', 'path', 'expectedSha256', 'kind', 'domain', 'selectionRole', 'optionalForMinimalC', 'maxBytes', 'index', 'bodyOffset', 'size']) {
      if (selected[key] !== target[key]) fail('E_COLLECTION');
    }
    if (selected.bodySha256 !== target.expectedSha256) fail('E_COLLECTION');
    selectedNames.add(selected.path);
  }
  const manifestNames = new Set();
  for (const manifest of role.manifests) {
    const member = role.members.find(row => row.path === manifest.path);
    if (!member || member.type !== 'file' || manifestNames.has(manifest.path) || manifest.bodySha256 !== member.bodySha256 ||
      typeof manifest.text !== 'string' || manifest.interpreted !== false || !Array.isArray(manifest.declarations)) fail('E_COLLECTION');
    const bytes = Buffer.from(manifest.text, 'utf8');
    if (bytes.length !== member.size || bytes.length > 1048576 || sha(bytes) !== manifest.bodySha256) fail('E_COLLECTION');
    manifestNames.add(manifest.path);
  }
  for (const edge of collection.declaredNeededEdges) if (edge.status !== 'UNRESOLVED' || edge.providerQualified !== false ||
    edge.abiVerified !== false || edge.aliasFollowed !== false || edge.hostTargetPromotion !== false) fail('E_COLLECTION');
  sameData(collection.declaredNeededEdges, expectedEdges, 8388608);
}
function validatePublication(record, snapshot, length, hash, role) {
  if (record.part !== role || snapshot.part !== role || record.state !== 'PUBLISHED_READBACK_MATCHED' ||
    record.path !== RUST_ARCHIVE_PATHS[roleOf(role)] || record.byteLength !== length || record.sha256 !== hash ||
    record.mode !== '0444' || record.readbackVerified !== true || record.directorySynced !== true || snapshot.phase !== record.state ||
    snapshot.ownedFDCount !== 0 || snapshot.created !== true || snapshot.sealed !== true || snapshot.error !== null ||
    snapshot.closeFailed !== false || snapshot.cleanupUncertain !== false) fail('E_PUBLICATION_RECORD');
  try { sameData(record.counts, snapshot.counts); } catch { fail('E_PUBLICATION_RECORD'); }
  const c = record.counts, m = record.fileMetadata;
  if (m.mode !== '33060' || m.size !== String(length) || m.nlink !== '1' || m.uid !== '1000' || m.gid !== '1000' ||
    !FIELDS.every(key => typeof m[key] === 'string' && /^-?[0-9]{1,40}$/.test(m[key])) || BigInt(m.ino) <= 0n) fail('E_PUBLICATION_RECORD');
  if (!Object.values(c).every(value => Number.isSafeInteger(value) && value >= 0) ||
    c.opens !== 3 || c.closeAttempts !== 3 || c.closes !== 3 || c.cleanupCloseAttempts !== 0 || c.fsyncs !== 4 ||
    c.chmods !== 1 || c.peakOwnedFDs !== 2 ||
    !['inputBytes', 'copiedBytes', 'inputHashBytes', 'writtenBytes', 'readbackBytes', 'readbackHashBytes'].every(key => c[key] === length) ||
    c.requestedReadBytes < length + 1 || c.requestedReadBytes > 16777217 || c.ownedSnapshotBytes !== 0 || c.ownedScratchBytes !== 0 ||
    c.fsOperations > 8192 || c.writeAttempts < 1 || c.writeAttempts > 4096 || c.readAttempts < 2 || c.readAttempts > 1024) fail('E_PUBLICATION_RECORD');
  for (const key of ['sourceRootAuthentication', 'ancestorRacesExcluded', 'atomicCrashCommit', 'storageFailureSurvival',
    'hardDeadlineGuaranteed', 'nativeQualified', 'abiQualified', 'authenticatedStorage']) if (record[key] !== false) fail('E_PUBLICATION_RECORD');
}
function stopped(code, mockOnly, role) {
  return Object.freeze({ exitCode: 1, text: asciiJson({ profile: 'registered-rust-archive-evidence-v1', part: 'rust', artifactRole: role,
    status: 'STOP', publicationAccepted: false, error: code, mockOnly,
    path: RUST_ARCHIVE_PATHS[role], realArchiveInspected: false, ...FLAGS }, 65536) });
}
function entries(deps, mockOnly) {
  const consumed = new Set(); let inFlight = false;
  async function once(role, count) {
    if (count !== 0 || consumed.has(role)) return stopped('E_INPUT', mockOnly, role);
    if (inFlight) return stopped('E_IN_FLIGHT', mockOnly, role);
    consumed.add(role); inFlight = true;
    try { return await run(deps, mockOnly, role); }
    finally { inFlight = false; }
  }
  return Object.freeze({
    async runRegisteredCargoEvidenceV1() { return once('cargo', arguments.length); },
    async runRegisteredRustcEvidenceV1() { return once('rustc', arguments.length); },
    async runRegisteredRustStdEvidenceV1() { return once('rust-std', arguments.length); },
    async runRegisteredRustfmtEvidenceV1() { return once('rustfmt-preview', arguments.length); },
    async runRegisteredClippyEvidenceV1() { return once('clippy-preview', arguments.length); },
  });
}
const production = entries({ fs, spawn: nodeSpawn, now: () => performance.now(), moduleImporter: target => import(target) }, false);
export async function runRegisteredCargoEvidenceV1() { return Reflect.apply(production.runRegisteredCargoEvidenceV1, null, arguments); }
export async function runRegisteredRustcEvidenceV1() { return Reflect.apply(production.runRegisteredRustcEvidenceV1, null, arguments); }
export async function runRegisteredRustStdEvidenceV1() { return Reflect.apply(production.runRegisteredRustStdEvidenceV1, null, arguments); }
export async function runRegisteredRustfmtEvidenceV1() { return Reflect.apply(production.runRegisteredRustfmtEvidenceV1, null, arguments); }
export async function runRegisteredClippyEvidenceV1() { return Reflect.apply(production.runRegisteredClippyEvidenceV1, null, arguments); }

// WHAT: Complete explicit fake capabilities with independent role latches and serialized admission.
export function createRustArchiveEvidenceOperationFixture(config) {
  if (arguments.length !== 1) fail('E_INPUT');
  shape(config, ['mockOnly', 'fs', 'spawn', 'now', 'moduleImporter', 'setTimeout', 'clearTimeout']);
  if (own(config, 'mockOnly', 'E_INPUT') !== true) fail('E_INPUT');
  const backend = own(config, 'fs', 'E_INPUT'), deps = { fs: {} };
  shape(backend, ['lstatSync', 'openSync', 'fstatSync', 'readSync', 'closeSync']);
  if (backend === fs) fail('E_INPUT');
  for (const name of ['lstatSync', 'openSync', 'fstatSync', 'readSync', 'closeSync']) {
    const method = functionOf(backend, name);
    if (method === fs[name]) fail('E_INPUT');
    deps.fs[name] = (...args) => Reflect.apply(method, backend, args);
  }
  for (const key of ['spawn', 'now', 'moduleImporter', 'setTimeout', 'clearTimeout']) deps[key] = functionOf(config, key);
  if (deps.spawn === nodeSpawn || deps.setTimeout === globalThis.setTimeout || deps.clearTimeout === globalThis.clearTimeout) fail('E_INPUT');
  return entries(deps, true);
}
async function run(deps, mockOnly, artifactRole) {
  const profile = RUST_ARCHIVE_PROFILES[artifactRole], input = RUST_ARCHIVE_INPUTS[artifactRole];
  const repoCapture = captureCounts();
  const counts = { spawnAttempts: 0, spawnEvents: 0, ownedChildren: 0, peakChildren: 0, childCloses: 0,
    stageChecks: 0, preloadChecks: 0, stageFsCalls: 0, stageReadBytes: 0, stageCloses: 0,
    completedCorePasses: 0, archivePasses: 0, archiveDataBytes: 0, archiveRequestedBytes: 0,
    archiveCloseAttempts: 0, expandedBytes: 0, streamEvents: 0, entries: 0 };
  let started, last, roleStarted = null, publicationStarted = null, collector = null, publisher = null;
  let sourceAccountingComplete = false, stageAccountingComplete = false, error = null;
  let graphPins = null, publicationCounts = null, abortUncertain = false;
  function guard(limit = 300000) {
    let now;
    try { now = deps.now(); } catch { fail('E_CLOCK'); }
    if (!Number.isFinite(now) || (last !== undefined && now < last)) fail('E_CLOCK');
    if (started === undefined) started = now;
    last = now;
    if (!Number.isFinite(started + 300000) || started + 300000 <= started) fail('E_CLOCK');
    if (now - started >= limit || (roleStarted !== null && now - roleStarted >= 120000) ||
      (publicationStarted !== null && now - publicationStarted >= 30000)) fail('E_DEADLINE');
    return now;
  }
  const base = status => ({ profile: 'RUST_ARCHIVE_EVIDENCE_DATA', part: 'rust', artifactRole, status, mockOnly,
    path: RUST_ARCHIVE_PATHS[artifactRole], sourceInputPins: { sources: RUST_ARCHIVE_SOURCE_PINS, transforms: graphPins, input },
    collectionCounts: { ...counts }, repoCapture: { ...repoCapture }, sourceAccountingComplete, stageAccountingComplete,
    archiveAccountingComplete: counts.completedCorePasses === 1,
    archiveCountersScope: 'completed private core results; failed-pass bytes remain unaccounted, not zero',
    descriptorScope: 'source peak1; collection publisher2 +archive2 +stage2, aggregate peak at most6',
    startupAssumptions: 'trusted Node builtins, module loader, runtime and process startup; not I/O isolation',
    realArchiveInspected: status !== 'STOP' && !mockOnly, ...FLAGS });
  try {
    guard(10000);
    const sources = new Map();
    for (const [key] of SOURCE_ROWS) sources.set(key, captureSource(key, deps.fs, repoCapture, guard));
    if (repoCapture.ownedFds !== 0 || repoCapture.closes !== SOURCE_ROWS.length) fail('E_CLOSE');
    const receipts = {};
    for (const [key] of SOURCE_ROWS.filter(([key]) => key.endsWith('Receipt'))) receipts[key] = JSON.parse(sources.get(key).toString('utf8'));
    const xz = receipts.xzReceipt;
    if (xz.status !== 'FINITE_XZ_PROFILE_OBSERVED' || xz.counts.spawnEvents !== 33 ||
      xz.fixtureManifestSha256 !== '632a0d812366712ae99ce2ce442ad98a59534430640184f70af53df58656b4ea') fail('E_RECEIPT');
    guard(10000);
    const graph = prepareSourceGraph(sources, RUST_ARCHIVE_GRAPH_PINS, false, artifactRole); graphPins = graph.pins;
    guard(10000);
    const helper = await deps.moduleImporter(graph.collectorUri); guard(10000);
    const stage = await deps.moduleImporter(graph.stageUri); guard(10000);
    const writer = await deps.moduleImporter(graph.writerUri); guard(10000);
    const core = await deps.moduleImporter(graph.coreUris[artifactRole]); guard(10000);
    sameData(own(core, 'GNU_SDK_DESCRIPTOR'), descriptorFor(input));
    sameData(own(core, 'GNU_SDK_LIMITS'), coreLimits()); functionOf(core, 'runGnuSdkInventory');
    const constants = compareConstants(helper, receipts, artifactRole), { expectations, targets } = constants;
    sameData(own(writer, 'SPLIT_EVIDENCE_PARTS'), RUST_ARCHIVE_ROLES);
    sameData(own(writer, 'SPLIT_EVIDENCE_PATHS'), RUST_ARCHIVE_PATHS);
    sameData(own(writer, 'SPLIT_EVIDENCE_PUBLICATION_LIMITS'), WRITER_LIMITS);
    functionOf(stage, 'verifyStagedXzImages'); functionOf(stage, 'assertNoSystemPreload');
    functionOf(writer, 'reserveSplitEvidencePublication'); functionOf(helper, 'SOURCE_CREATE_ARCHIVE');
    for (const name of Object.values(BRIDGES)) functionOf(helper, name);
    guard(10000); sourceAccountingComplete = true;
    publisher = writer.reserveSplitEvidencePublication(artifactRole, () => guard());
    for (const name of ['publish', 'abort', 'snapshot']) functionOf(publisher, name);
    const reserved = dataSnapshot(publisher.snapshot(), 8192, guard);
    if (reserved.part !== artifactRole || reserved.phase !== 'RESERVED' || reserved.ownedFDCount !== 2 || reserved.created !== true ||
      reserved.sealed !== false || reserved.error !== null || reserved.closeFailed !== false || reserved.cleanupUncertain !== false ||
      reserved.counts.writtenBytes !== 0) fail('E_PUBLICATION_RECORD');
    collector = Reflect.apply(functionOf(helper, 'SOURCE_CREATE_ARCHIVE'), helper, [artifactRole]);
    for (const name of METHODS) functionOf(collector, name);
    collector.beginToolchainEvidenceBatch(); guard();
    const acceptedState = (accepted, current = null) => {
      const snapshot = dataSnapshot(collector.snapshotToolchainEvidenceBatch(), 8192, guard);
      if (snapshot.part !== 'rust' || snapshot.state !== 'ACTIVE' || snapshot.mockOnly !== false || snapshot.acceptedRoles !== accepted ||
        snapshot.currentRole !== current || snapshot.entries !== counts.entries || snapshot.expandedBytes !== counts.expandedBytes ||
        ![snapshot.metadataBytes, snapshot.manifestBytes, snapshot.capturedBytes, snapshot.selectedPayloads,
          snapshot.activeBufferBytes, snapshot.activeBodyHashes].every(value => Number.isSafeInteger(value) && value >= 0) ||
        snapshot.metadataBytes > 8388608 || snapshot.manifestBytes > 4194304 || snapshot.capturedBytes > 805306368 ||
        snapshot.selectedPayloads > profile.targetCount || snapshot.activeBufferBytes !== 0 || snapshot.activeBodyHashes !== 0) fail('E_COLLECTION');
    };
    acceptedState(0);
    const gate = () => {
      guard(); stageAccountingComplete = false;
      const checked = dataSnapshot(stage.verifyStagedXzImages(xz.staged), 8192, guard), c = checked.counters;
      if (![c.fsCalls, c.readBytes, c.closeAttempts].every(value => Number.isSafeInteger(value) && value >= 0) ||
        c.closeAttempts !== 5 || c.fsCalls > 1024 || c.readBytes !== 2758216) fail('E_RECEIPT');
      counts.stageChecks++; counts.stageFsCalls += c.fsCalls; counts.stageReadBytes += c.readBytes; counts.stageCloses += c.closeAttempts;
      stageAccountingComplete = true;
      if (stage.assertNoSystemPreload() !== true) fail('E_PRELOAD');
      counts.preloadChecks++;
      if (counts.stageChecks > 2 || counts.preloadChecks > 2 || counts.stageCloses > 10) fail('E_LIMIT');
      guard(); return { stagedImagesVerified: true, preloadAbsent: true, ordinaryProfileObserved: true };
    };
    if (300000 - (guard() - started) < 150000) fail('E_DEADLINE');
    roleStarted = last;
    collector.beginToolchainEvidenceRole(artifactRole); acceptedState(0, artifactRole);
    let attempts = 0;
    const coreDeps = { fs: deps.fs, now: deps.now, beforeDecode: gate, afterDecode: gate,
      spawn(...args) {
        guard(); attempts++; counts.spawnAttempts++;
        if (attempts !== 1 || counts.spawnAttempts > 1 || counts.ownedChildren !== 0) fail('E_LIMIT');
        const expectedArgs = ['--inhibit-cache', '--glibc-hwcaps-mask', '', '--library-path', DECODER,
          DECODER + '/xz', '--decompress', '--stdout', '--format=xz', '--threads=1',
          '--memlimit-decompress=268435456', '--', '-'];
        if (args.length !== 3 || args[0] !== DECODER + '/ld-linux-x86-64.so.2') fail('E_SPAWN');
        sameData(args[1], expectedArgs);
        sameData(args[2], { cwd: DECODER, env: { LC_ALL: 'C', LANG: 'C', TZ: 'UTC' },
          shell: false, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
        const child = deps.spawn(...args);
        counts.ownedChildren++; counts.peakChildren = Math.max(counts.peakChildren, counts.ownedChildren);
        child.once('spawn', () => { counts.spawnEvents++; });
        child.once('close', () => { counts.ownedChildren--; counts.childCloses++; });
        return child;
      } };
    for (const key of ['setTimeout', 'clearTimeout']) if (Object.hasOwn(deps, key)) coreDeps[key] = deps[key];
    const raw = await core.runGnuSdkInventory(input.identity, coreDeps); guard();
    const value = dataSnapshot(raw, 4194304, guard);
    if (value.state !== 'GNU_SDK_DATA_INVENTORY' || value.mockOnly !== false ||
      value.archiveBytes !== input.archiveBytes || value.archiveSha256 !== input.archiveSha256 || value.archivePasses !== 2 ||
      value.archiveDataBytes !== input.archiveBytes * 2 || value.archiveRequestedBytes !== input.archiveBytes * 2 + 2 ||
      value.closeAttempts !== 2 || value.exitCode !== 0 || value.signal !== null || attempts !== 1 ||
      counts.spawnEvents !== 1 || counts.ownedChildren !== 0 || counts.childCloses !== 1 ||
      counts.stageChecks !== 2 || counts.preloadChecks !== 2 || counts.stageCloses !== 10 ||
      !['stdinFinished', 'stdoutEnded', 'stderrEnded', 'closeObserved'].every(key => value[key] === true) ||
      !['extracted', 'extractionAuthorized', 'pythonFreeSubsetVerified', 'installedUsability', 'nativeQualified',
        'decoderQualified', 'rustReady', 'trainingReady', 'provenanceVerified', 'hardRssBounded', 'processTreeBounded',
        'hardDeadlineGuaranteed'].every(key => value[key] === false) ||
      value.expandedBytes !== expectations[0].expandedBytes || value.inventory.entries !== expectations[0].entries ||
      !Number.isSafeInteger(value.streamEvents) || value.streamEvents < 0 || value.streamEvents > 262144) fail('E_RECEIPT');
    collector.acceptToolchainEvidenceRole(raw); guard();
    publicationStarted = last; roleStarted = null;
    counts.completedCorePasses++; counts.archivePasses += 2; counts.archiveDataBytes += value.archiveDataBytes;
    counts.archiveRequestedBytes += value.archiveRequestedBytes; counts.archiveCloseAttempts += value.closeAttempts;
    counts.expandedBytes += value.expandedBytes; counts.streamEvents += value.streamEvents; counts.entries += value.inventory.entries;
    guard(); acceptedState(1);
    if (counts.archivePasses !== 2 || counts.archiveDataBytes !== input.archiveBytes * 2 ||
      counts.archiveRequestedBytes !== input.archiveBytes * 2 + 2 || counts.archiveCloseAttempts !== 2 ||
      counts.stageChecks !== 2 || counts.preloadChecks !== 2 || counts.stageCloses !== 10 ||
      counts.spawnAttempts !== 1 || counts.spawnEvents !== 1 || counts.childCloses !== 1 || counts.ownedChildren !== 0 ||
      counts.peakChildren !== 1 || counts.expandedBytes !== profile.expandedBytes || counts.entries !== profile.entries) fail('E_RECEIPT');
    guard();
    const collection = collector.finishToolchainEvidenceBatch();
    preflight(collection, 16777216, guard, true);
    validateCollection(collection, expectations, targets, artifactRole); guard();
    const text = asciiJson({ ...base('RUST_ARCHIVE_EVIDENCE_DATA'), collection }, 16777216, guard); guard();
    const bytes = Buffer.from(text, 'ascii'), hash = sha(bytes); guard();
    const record = dataSnapshot(publisher.publish(bytes), 16384, guard);
    const snapshot = dataSnapshot(publisher.snapshot(), 16384, guard); publicationCounts = snapshot.counts;
    validatePublication(record, snapshot, bytes.length, hash, artifactRole); guard();
    if (repoCapture.ownedFds !== 0 || repoCapture.closes !== 14 || counts.ownedChildren !== 0) fail('E_CLOSE');
    const receipt = { ...base('RUST_ARCHIVE_EVIDENCE_DATA'), publicationAccepted: true,
      byteLength: bytes.length, sha256: hash, mode: '0444', readbackVerified: true, directorySynced: true,
      publicationCounts, publicationFileMetadata: record.fileMetadata };
    const compact = asciiJson(receipt, 65536, guard); guard();
    return Object.freeze({ exitCode: 0, text: compact });
  } catch (failure) {
    error = errorCode(failure);
    if (publisher) {
      try {
        const aborted = dataSnapshot(Reflect.apply(functionOf(publisher, 'abort'), publisher, []), 16384);
        publicationCounts = aborted.counts;
        if (aborted.closeFailed !== false || aborted.cleanupUncertain !== false) { error = 'E_PUBLICATION_CLOSE'; abortUncertain = true; }
      } catch { error = 'E_PUBLICATION_ABORT'; abortUncertain = true; }
    }
    if (collector) {
      try { Reflect.apply(functionOf(collector, 'abortToolchainEvidenceBatch'), collector, []); }
      catch { if (!abortUncertain) error = 'E_COLLECTION_ABORT'; abortUncertain = true; }
    }
  }
  return Object.freeze({ exitCode: 1, text: asciiJson({ ...base('STOP'), publicationAccepted: false,
    error, publicationCounts, abortUncertain }, 65536) });
}
export const rustArchiveEvidenceOperationSource = Object.freeze({ rows: SOURCE_ROWS, transformTar, transformCore,
  transformWriter, prepareSourceGraph, captureSource, captureCounts, preflight, asciiJson, replaceOnce, link, pinned,
  compareConstants, validateCollection, validatePublication, descriptorFor, coreLimits, bridges: BRIDGES,
  collectorLimits: COLLECTOR_LIMITS, writerLimits: WRITER_LIMITS, freeze });
