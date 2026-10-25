// SPEC: _spec/tooling/native-ingress/step2.puml
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawn as nodeSpawn } from 'node:child_process';
import { types } from 'node:util';

const freeze = (value, seen = new WeakSet()) => {
  if (value && typeof value === 'object' && !seen.has(value)) {
    seen.add(value);
    for (const key of Reflect.ownKeys(value)) freeze(own(value, key), seen);
    Object.freeze(value);
  }
  return value;
};
const REPO = '/tmp/opencode/f9-bootstrap-correspondence';
const GNU = '/tmp/opencode/f9-gnu-2026-data-only-01';
const RUST = '/tmp/opencode/f9-rust-runtime-inputs-01';
const DECODER = '/tmp/opencode/f9-xz-qualification-01';
export const SPLIT_TOOLCHAIN_OPERATION_PARTS = freeze(['gnu', 'rust']);
export const SPLIT_TOOLCHAIN_OPERATION_PATHS = freeze(Object.fromEntries(SPLIT_TOOLCHAIN_OPERATION_PARTS.map(part =>
  [part, REPO + '/_spec/tooling/native-ingress/' + part + '-evidence-collection-v1.result.json'])));
export const SPLIT_TOOLCHAIN_OPERATION_LIMITS = freeze({ sourceMs: 10000, totalMs: 300000,
  cleanupMs: 3000, publicationMs: 30000, sourceBytes: 1048576, sourceFsOperations: 8192,
  sourceReadsPerFile: 128, dataBytes: 16777216, receiptBytes: 65536, depth: 64, nodes: 1048576 });
const rustIdentity = { dev: '28', ino: '13954', mode: '16832', uid: '1000', gid: '1000', nlink: '2',
  size: '4096', mtimeNs: '1792857301045485610', ctimeNs: '1792857301045485610' };
export const SPLIT_TOOLCHAIN_OPERATION_INPUTS = freeze({
  gnu: [{ role: 'gnu-sdk', root: GNU, file: GNU + '/x86-64--glibc--stable-2026.08-1.tar.xz', archiveBytes: 102296280,
    archiveSha256: 'cde893afab04ac7dcd15c46aac214ff550441b982536124c88a71146a0eeedd3',
    expectedRoot: 'x86-64--glibc--stable-2026.08-1', decoderMemoryBytes: 16777216,
    identity: { root: { dev: '28', ino: '13894', mode: '16832', uid: '1000', gid: '1000', nlink: '2', size: '4096',
      mtimeNs: '1792805590304271582', ctimeNs: '1792805590304271582' },
    file: { dev: '29', ino: '1211332', mode: '33152', uid: '1000', gid: '1000', nlink: '1', size: '102296280',
      mtimeNs: '1792805605531830652', ctimeNs: '1792805605531830652' } } }],
  rust: [
    ['cargo', 'cargo', 10984780, 'e74edd2cf7d0f1f1383b4f00eb90c843750bc489e2ccf7214e6476678a907425', '1211150', '1792857299153485617'],
    ['rustc', 'rustc', 80351960, '8426a3d170a5879f5682f5fbdd024a1779b3951e7baba685af2d6dc32a6dfc15', '1211151', '1792857300349485612'],
    ['rust-std', 'rust-std', 29573972, '047ea7098803d3500fa1072e9cee5392697e21525559e4458128a2bf874aa382', '1211153', '1792857300901485610'],
    ['rustfmt-preview', 'rustfmt', 2164880, 'f1b2a7301513ffdd95ebf22ebbdd932e4d17fc806f748d93924740d0297b1396', '1211154', '1792857301041485610'],
    ['clippy-preview', 'clippy', 4697128, 'ac779bc9839dd47180806b133e4e2563c4a34716284cd5b8fede8ef289f452ca', '1211155', '1792857301361485608'],
  ].map(([role, name, archiveBytes, archiveSha256, ino, time]) => {
    const expectedRoot = name + '-1.95.0-x86_64-unknown-linux-gnu';
    return { role, root: RUST, file: RUST + '/' + expectedRoot + '.tar.xz', archiveBytes, archiveSha256, expectedRoot,
      identity: { root: rustIdentity, file: { dev: '29', ino, mode: '33152', uid: '1000', gid: '1000', nlink: '1',
        size: String(archiveBytes), mtimeNs: time, ctimeNs: time } }, decoderMemoryBytes: 268435456 };
  }),
});
export const SPLIT_TOOLCHAIN_OPERATION_PROFILES = freeze({
  gnu: { part: 'gnu', roles: ['gnu-sdk'], artifactCount: 1, targetCount: 46, expandedBytes: 505333760,
    entries: 8412, regularFiles: 6891 },
  rust: { part: 'rust', roles: ['cargo', 'rustc', 'rust-std', 'rustfmt-preview', 'clippy-preview'], artifactCount: 5,
    targetCount: 13, expandedBytes: 642746880, entries: 263, regularFiles: 215 },
});
const ROLE_MS = freeze({ gnu: 120000, rust: 40000 });
const ADMISSION_MS = freeze({ gnu: 150000, rust: 70000 });
export const SPLIT_TOOLCHAIN_SOURCE_PINS = freeze({
  rawCore: { bytes: 23261, sha256: 'bd2fc43633ca3b8f0c485eddb68a1b7505002edecd70eee4bf9cc661f588ef29' },
  rawTar: { bytes: 15548, sha256: '050d629963fdf89bd5dff7639260c7de30b08be46320b7b6bb7ed4dac6bb8139' },
  extensionTar: { bytes: 15551, sha256: 'b22db5d375d966016f5551b9161119079960d24f9611cf87d145893887575824' },
  boundedTar: { bytes: 15568, sha256: '56cac49b3cfe51dbf2a7f7d1f4a0d877ae8773f940585ebea72740373689fae2' },
  eventTar: { bytes: 15595, sha256: 'bf8c7fcc56c26aa0618c014d74046dc29b79c09340728b27dd0363a758b9ef9a' },
  sdk: { bytes: 31569, sha256: 'fc301816588aa16360ce30a9c18ea7d5d82838432e7bd28f54155024e4445469' },
  elfV3: { bytes: 20493, sha256: '3bd878fe2a6de57a2b8252163cdf2a4d3093c6605a903105a9f531f039b84f10' },
  elfV5: { bytes: 21800, sha256: '1d9ebc5b27944ab646b2f61d334d2ff4bf43bddf226402ba225f6c02cf11dccb' },
  stage: { bytes: 16688, sha256: 'f75c21a58bb67e6ab3f8b1dafd090e11ac2d3a70f017da35afb81b00761b71b4' },
  elfMetadata: { bytes: 19842, sha256: 'b223a655eae572137891a2c6efafee16887a2478fc91052f0092b48dfd65de85' },
  xzReceipt: { bytes: 4239, sha256: 'e45d65231c0815ab2b895c0d74467500a0e6caf33cc0a4ee342b20489ce6b233' },
  rustReceipt: { bytes: 4012, sha256: 'c068579e97c9c01c707bae0cdffb082bf23d7f089bcd404a114d290e0476be87' },
  sdkInventoryReceipt: { bytes: 2732, sha256: '755a922e587e17b5978e3df77f96ac4a6fb43499d19df895c9148f0952fedcf5' },
  sdkCatalogReceipt: { bytes: 5707, sha256: '6f0136fd082bf8c4a06fbb0d5f2734ab361c67707239f07b99f7087af1970492' },
  rustLayoutReceipt: { bytes: 7637, sha256: '48a8091b6ef4541593aeb98e0140b107e016c36466b323e3570323e337054239' },
  collector: { bytes: 49481, sha256: 'e3de2b2bebeec037a0962e8e7ca3a0e0cf69faec1363872232ef869a1b75b99c' },
  writer: { bytes: 18003, sha256: '9e3d6d84e58d5e86a3097a4d8a731dcef9c922622b1fc225acf0385b218f41aa' },
});
export const SPLIT_TOOLCHAIN_GRAPH_PINS = freeze(Object.fromEntries([
  ['eventTar', 15595, 'bf8c7fcc56c26aa0618c014d74046dc29b79c09340728b27dd0363a758b9ef9a'],
  ['appendedSdk', 31647, '22be684fb42feecbf6ac629f8e1fbf310bb31635325a9d1dc5a9e81fd75ee3b8'],
  ['tarLinkedSdk', 52452, '60931c3c8ba2b491ecdac39e4b0106da55fe312ecd9164fb3086909695d9fef2'],
  ['linkedSdk', 79779, 'aeeafd8124729ef1ee3d54787c40249a6740796ae806a8d97d370e042690d2f2'],
  ['appendedCollector', 49880, 'ce2a392e82cd3632005961dd27f1c17a493a4270cfb7e4bb362966e7e630241f'],
  ['tarLinkedCollector', 70685, '9e34f55a9c4355dd5d7fb554a6d0ba809f1eaa159e0c965e3babf2a28487eb93'],
  ['elfLinkedCollector', 99756, '35bd45ef08790f118df097d4f09d7e7d315554ebed06c046e54794f53242b248'],
  ['linkedCollector', 206128, 'bb39b839d45728423d0c376aa848a7fa0cfeafb262193355c7d642a70900426c'],
  ['linkedStage', 43154, '89b6c5e3dcbf902937f81fc642d7238bd4ec4ca3c94f6b61f4d069efdce8c5f2'],
  ['gnu-sdk:descriptor', 23268, '23818c09fa96c071fad754d1799312bd284c23d8c8b9406f7f92c9bff2bcc907'],
  ['gnu-sdk:events', 23269, '8e9cc0a83ba3137834e92876c1071c0fe8b085816bb60ff23431851f8f485b9f'],
  ['gnu-sdk:summary', 23271, '172aeed50a2c67901fd3e138a36b9accfa421d4689b613bd02e1e2a1363c431a'],
  ['gnu-sdk:selectors', 22514, 'dafb46d34d51c73718dd021b77fb3f123cc0fd96821988cfcf61a7317ef1c5b6'],
  ['gnu-sdk:parserBinding', 22532, '2fd7959317c37f89470725b0ec07a773f858fc1d7d018f2341500aaa4109ff3d'],
  ['gnu-sdk:linkedCore', 297381, 'a0bfe4c8a0dc3cd0cd6eea2f03a05297d0e8ddf0e66189671c341816c31ab61f'],
  ['cargo:descriptor', 23275, '110dcdd97383fb76f68233110013cf3523c1b3cf5e98cf02defad9ff83bb988b'],
  ['cargo:duration', 23274, '26bb318c0e603efe69f991a0d864d0c12958a47cfaccfc11555e653fbff5ed3d'],
  ['cargo:events', 23275, '793f7ea66aead8fa2b9574b97f2c339710485f030acdf5d29687c68a62ba30be'],
  ['cargo:summary', 23277, '9f0789cfdd1c2ffcbd7550152f8db08331c16781c1aa67f402e826a9f33ce8dd'],
  ['cargo:selectors', 22520, 'ffc786d1dad7a96a508c7d79a96de89bc06b96f3d98366b595c1ea77e49d3a35'],
  ['cargo:memory', 22521, '4481ec60469a7b2fcc31e188087a85f9e37744425bf418a1724b2c2f904e977b'],
  ['cargo:parserBinding', 22540, 'fdf9af9d3da8dfc3390199db25c3dd8c79055247f5ac7f4a0b4f8b97c7aa15bc'],
  ['cargo:linkedCore', 297389, '9788fc8964dc0d6bda20768f822bdff5fd450e2af503e2c241c8c9b14b52a072'],
  ['rustc:descriptor', 23275, 'f454d03eb05e38c6d6cbf35b0ac6e7d124fa35d67ce571e3809c2ec7a57e2920'],
  ['rustc:duration', 23274, 'd72d4dbcfbb119ceeee0f7792fc854de95a70f890f747d305866b4e9ac41f7aa'],
  ['rustc:events', 23275, '72b0deb75d1c225941be56dfd4da0cfb85903c97b157a723fe40de9c9cb9c338'],
  ['rustc:summary', 23277, '0d3124ebaa95f9ea81cda7c2ab8fa5e848b7c0be37d6574e0e85f9cec79a5731'],
  ['rustc:selectors', 22520, '2e8f3fdd6a8fefaac41556185bd074abf5ed1be5f51297849ad4b63a1db0867b'],
  ['rustc:memory', 22521, '0978a45c1e7d5009f5fe7c183926519e7de55817d733e70fbfb00b2701c5765f'],
  ['rustc:parserBinding', 22540, 'a6d9c5867845266b8f13b14c7a03a2f866b66e9aec3a7882e2347be78141f217'],
  ['rustc:linkedCore', 297389, '2c34c49c575af909c1290e6b5baa8029f34a6ff9ebb6e0ad60a82ba803ed110c'],
  ['rust-std:descriptor', 23278, '91daf6b52b5b6e584e853ab2a7ca4a28f71e33cae760d427b2d84cabf55b8774'],
  ['rust-std:duration', 23277, '9ac41ed686c7124c0f5aa05e7e07365e8b16681dfd630d62f0baeae9b9c1c2d9'],
  ['rust-std:events', 23278, 'fb78c569ae0145d67eadb0200ccf3317ade43e61a57a73f40d52297a10c69c52'],
  ['rust-std:summary', 23280, '5b645867566901e7fdddb82cfa23f0ffafd05b2947e6dfda63ace43b9a4cc1cd'],
  ['rust-std:selectors', 22523, 'a92cf96c92bb91b78ab2f71838b001f06e4a44b0b004b092e3c6faa27a74e139'],
  ['rust-std:memory', 22524, 'a2c602790a4cc00ecffbd157c2f22825aee3a78fa95d7ab40b1c64afbe30962c'],
  ['rust-std:parserBinding', 22543, '7fd1fac5eaa1a2301f266331169317c162e2ad0cc80f2946102227cdf459aeab'],
  ['rust-std:linkedCore', 297392, '2dc394392c70fab5c629a10254098f5b445f81e53ec3edf6cb6aef45e59695e2'],
  ['rustfmt-preview:descriptor', 23276, 'f9d96eebdb7cd9ccb36842dd895e8cbe1df62c8f5c3d39117b85a68fa445b44b'],
  ['rustfmt-preview:duration', 23275, '04b09481f25349c257b52c57f736645f196ee58fe5b5b9d8b64dc8015913c9fd'],
  ['rustfmt-preview:events', 23276, 'f2432eefaacc7852e09143b580b6b4a3e4e668b5d5eac8315539da769016081f'],
  ['rustfmt-preview:summary', 23278, 'ebb4a2f429c1006e35b49599f8c1d38607673f29d771c3e3e2e1015541ffb9f6'],
  ['rustfmt-preview:selectors', 22521, 'fbd5eba86691f5bb0ac2fb3533482cc08743960acc1eb27a8e6ffb497fea0d44'],
  ['rustfmt-preview:memory', 22522, 'fba768814bb151249b6a3eb0c723cbcbac144781ccf32d5e0b6df313dbe7233a'],
  ['rustfmt-preview:parserBinding', 22541, '54d8c5b5360fa561becb86c71301b7af0995e698a287c43cce3649081baa9a60'],
  ['rustfmt-preview:linkedCore', 297390, '88f92c212118b9adc02b5341a02b4ba96860309508f06b1c2cccf5f4899e0f6f'],
  ['clippy-preview:descriptor', 23275, '20f4b9a83e4d2aac41406b8ef5854fb22a05e3039211d320ade3920b1987080b'],
  ['clippy-preview:duration', 23274, 'db82e64d8c359e3ea140cb1634e8cc95901acd982e4dd46f50870a549a75febf'],
  ['clippy-preview:events', 23275, '52c11e2ddd05b959b2d4d77ce80998299017c6316d1bedff55eba686d85bb3b4'],
  ['clippy-preview:summary', 23277, 'dec69c67504fd88653edbb79a15d5071e956c4d7f3baa4d8ca6f0ebd3d36db20'],
  ['clippy-preview:selectors', 22520, 'cb800eda266522ca0ee4c59dae80c210598d0f66b674de03be793bf1368a0bae'],
  ['clippy-preview:memory', 22521, '4e0e5e2fc34fedd02e51cd4e9c832aaf4d96ffc0f5c43690862e2c140e843e93'],
  ['clippy-preview:parserBinding', 22540, '4023ded71ba69729e649353d1dbcff06fed7c2fce5c114e338d03d3589fd1ed2'],
  ['clippy-preview:linkedCore', 297389, '23871df009ab4702fdcf3f9b49f8f3639093a3283434d816fb1467d0477a262b'],
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
const CODES = new Set(['E_INPUT', 'E_HELPER_PENDING', 'E_SOURCE_PIN', 'E_METADATA', 'E_BINDING', 'E_IO',
  'E_CLOSE', 'E_LENGTH', 'E_HASH', 'E_PREREQUISITE', 'E_SPAWN', 'E_PIPE', 'E_DECODER', 'E_TAR', 'E_OUTPUT',
  'E_DEADLINE', 'E_CLEANUP', 'E_CLOCK', 'E_LIMIT', 'E_PRELOAD', 'E_COMPONENT', 'E_RECEIPT', 'E_COLLECTION',
  'E_COLLECTION_ABORT', 'E_PUBLICATION_RECORD', 'E_PUBLICATION_ABORT',
  ...['INPUT', 'LIMIT', 'CHUNK', 'INSPECT', 'DATA', 'STATE', 'METADATA', 'SPAN', 'BODY_HASH', 'MANIFEST', 'ROOT',
    'EVENT', 'TARGET', 'MANIFEST_LIMIT', 'EXPANDED', 'ENTRIES', 'SUMMARY', 'DECODED_HASH', 'METADATA_HASH', 'CORE',
    'OUTPUT'].map(code => 'E_EVIDENCE_' + code),
  ...['ARGUMENT', 'FIXTURE', 'LIMIT', 'GUARD', 'STATE', 'DIRECTORY', 'METADATA', 'BINDING', 'FILE', 'EXISTS',
    'IO', 'CLOSE', 'BYTES', 'JSON', 'WRITE', 'READ', 'HASH', 'EOF', 'ABORTED'].map(code => 'E_PUBLICATION_' + code)]);
const fail = code => { throw Object.freeze(Object.assign(new Error(code), { code })); };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const pinOf = bytes => ({ bytes: bytes.length, sha256: sha(bytes) });
const uri = bytes => 'data:text/javascript;base64,' + bytes.toString('base64');
function own(object, key, code = 'E_OUTPUT') {
  if (!object || !['object', 'function'].includes(typeof object) || types.isProxy(object)) fail(code);
  const field = Object.getOwnPropertyDescriptor(object, key);
  if (!field || !Object.hasOwn(field, 'value')) fail(code);
  return field.value;
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
function errorCode(error) {
  try { const code = own(error, 'code', 'E_IO'); return CODES.has(code) ? code : 'E_COLLECTION'; }
  catch { return 'E_IO'; }
}
function partOf(part) {
  if (!SPLIT_TOOLCHAIN_OPERATION_PARTS.includes(part)) fail('E_INPUT');
  return part;
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
  let source = pinned(bytes, SPLIT_TOOLCHAIN_SOURCE_PINS.rawTar).toString('utf8');
  source = replaceOnce(source, 'maxExtensionBytes: 65_536', 'maxExtensionBytes: 4_194_304');
  pinned(Buffer.from(source), SPLIT_TOOLCHAIN_SOURCE_PINS.extensionTar);
  source = replaceOnce(source, "if (size > limits.maxExtensionBytes - extensionBytes) fail('E_EXTENSION_BYTES');",
    "if (size > 65_536 || size > limits.maxExtensionBytes - extensionBytes) fail('E_EXTENSION_BYTES');");
  pinned(Buffer.from(source), SPLIT_TOOLCHAIN_SOURCE_PINS.boundedTar);
  source = replaceOnce(source, '{ index: entries + 1, path: key, type: kind, size }',
    '{ index: entries + 1, path: key, type: kind, size, bodyOffset: consumedBytes }');
  return pinned(Buffer.from(source), SPLIT_TOOLCHAIN_SOURCE_PINS.eventTar);
}
function descriptorFor(input) {
  return { root: input.root, file: input.file, archiveBytes: input.archiveBytes,
    archiveSha256: input.archiveSha256, decoderRoot: DECODER };
}
const coreLimits = part => ({ maxTotalMs: ROLE_MS[partOf(part)], cleanupMs: 3000, maxReadsPerPass: 4096,
  maxFsOperations: 10000, maxExpandedBytes: 1073741824, maxHeaders: 32768, maxStreamEvents: 262144,
  maxStderrBytes: 8192, maxSelectedEntries: 128, maxSelectedBytes: 131072, maxSummaryBytes: 4194304 });
function transformCore(bytes, part, role, observe = () => {}) {
  const input = SPLIT_TOOLCHAIN_OPERATION_INPUTS[partOf(part)].find(value => value.role === role);
  if (!input) fail('E_INPUT');
  let source = pinned(bytes, SPLIT_TOOLCHAIN_SOURCE_PINS.rawCore).toString('utf8');
  const step = (name, needle, replacement) => {
    source = replaceOnce(source, needle, replacement); observe(name, Buffer.from(source));
  };
  step('descriptor', /export const GNU_SDK_DESCRIPTOR = Object\.freeze\(\{\n(?:  [^\n]*\n)+\}\);/g,
    'export const GNU_SDK_DESCRIPTOR = Object.freeze(' + JSON.stringify(descriptorFor(input), null, 2) + ');');
  if (part === 'rust') step('duration', 'maxTotalMs: 120_000', 'maxTotalMs: 40_000');
  step('events', 'maxStreamEvents: 32_768', 'maxStreamEvents: 262_144');
  step('summary', 'maxSummaryBytes: 262_144', 'maxSummaryBytes: 4_194_304');
  step('selectors', /const selectors = Object\.freeze\(\[\n(?:  [^\n]*\n)+\]\);/g, 'const selectors = Object.freeze([]);');
  if (part === 'rust') step('memory', "'--memlimit-decompress=16777216'", "'--memlimit-decompress=268435456'");
  step('parserBinding', "import { createTarInventory } from './tar-inventory.mjs';",
    'import { SOURCE_' + part.toUpperCase() + "_TAR as createTarInventory } from './tar-inventory.mjs';");
  return Buffer.from(source);
}
const SDK_APPEND = '\nexport const SOURCE_FORMAT_INSPECTORS = Object.freeze({rel,archive,linker});\n';
const COLLECTOR_APPEND = `
const SOURCE_COLLECTORS = new Map();
export function SOURCE_CREATE_COLLECTOR(part) {
  const value = createSplitToolchainEvidenceCollector(part);
  SOURCE_COLLECTORS.set(part, value);
  return value;
}
export const SOURCE_GNU_TAR = limits => SOURCE_COLLECTORS.get('gnu').createTarInventory(limits);
export const SOURCE_RUST_TAR = limits => SOURCE_COLLECTORS.get('rust').createTarInventory(limits);
`;
function prepareSourceGraph(sources, expectedPins, mockOnly, part, rawPins = SPLIT_TOOLCHAIN_SOURCE_PINS) {
  partOf(part);
  const pins = {}, outputs = {};
  for (const [key] of SOURCE_ROWS) pinned(sources.get(key), rawPins[key]);
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
  const cores = SPLIT_TOOLCHAIN_OPERATION_INPUTS[part].map(input => {
    const core = transformCore(sources.get('rawCore'), part, input.role,
      (name, bytes) => checked(input.role + ':' + name, bytes));
    return checked(input.role + ':linkedCore', link(core, 'tar-inventory', collectorUri));
  });
  return { pins: freeze(pins), outputs, collectorUri, sdkUri: uri(sdk), stageUri: uri(stage),
    writerUri: uri(sources.get('writer')), coreUris: cores.map(uri) };
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
function captureSource(key, io, counts, guard, pins = SPLIT_TOOLCHAIN_SOURCE_PINS) {
  const row = SOURCE_ROWS.find(value => value[0] === key), pin = pins[key];
  if (!row) fail('E_SOURCE_PIN');
  if (!pin) fail('E_HELPER_PENDING');
  if (!Number.isSafeInteger(pin.bytes) || pin.bytes < 1 || pin.bytes >= 1048576) fail('E_SOURCE_PIN');
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
function compareConstants(helper, sdk, receipts) {
  sameData(own(helper, 'SPLIT_TOOLCHAIN_EVIDENCE_PARTS'), SPLIT_TOOLCHAIN_OPERATION_PARTS);
  sameData(own(helper, 'SPLIT_TOOLCHAIN_EVIDENCE_INPUTS'), SPLIT_TOOLCHAIN_OPERATION_INPUTS);
  sameData(own(helper, 'SPLIT_TOOLCHAIN_EVIDENCE_PROFILES'), SPLIT_TOOLCHAIN_OPERATION_PROFILES);
  sameData(own(helper, 'SPLIT_TOOLCHAIN_EVIDENCE_LIMITS'), COLLECTOR_LIMITS);
  functionOf(helper, 'createSplitToolchainEvidenceCollector');
  const rust = receipts.rustReceipt, inv = receipts.sdkInventoryReceipt;
  const catalog = receipts.sdkCatalogReceipt, layout = receipts.rustLayoutReceipt;
  if (rust.status !== 'RUST_INPUT_BYTES_MATCHED' || rust.root !== RUST || rust.inputs.length !== 5) fail('E_RECEIPT');
  sameData(rust.rootFinal, rustIdentity);
  rust.inputs.forEach((row, index) => {
    const input = SPLIT_TOOLCHAIN_OPERATION_INPUTS.rust[index];
    if (!row.verified || row.incomingSha256 !== input.archiveSha256 || row.readbackSha256 !== input.archiveSha256 ||
      row.name !== input.expectedRoot + '.tar.xz' || row.byteLength !== input.archiveBytes || row.role !== input.role) fail('E_RECEIPT');
    sameData(row.finalMetadata, input.identity.file);
  });
  const gnu = SPLIT_TOOLCHAIN_OPERATION_INPUTS.gnu[0];
  if (inv.status !== 'GNU_SDK_DATA_INVENTORY' || catalog.status !== 'SUBSET_CANDIDATE_CATALOG' ||
    layout.status !== 'RUST_COMPONENT_LAYOUT_DATA' || inv.archive.path !== gnu.file ||
    inv.archive.byteLength !== gnu.archiveBytes || inv.archive.sha256 !== gnu.archiveSha256 ||
    catalog.namespaceEntryCount !== 8412 || catalog.regularFileCount !== 6891 || layout.roles.length !== 5) fail('E_RECEIPT');
  const expectations = { gnu: [{ role: 'gnu-sdk', expandedBytes: 505333760, entries: 8412, headers: 10181,
    regularFiles: 6891, decodedSha256: catalog.decodedSha256, metadataSha256: inv.inventory.metadataSha256,
    metadataHashKind: 'LEGACY_WITHOUT_BODY_OFFSET' }], rust: layout.roles.map(row => ({ role: row.role,
    expandedBytes: row.expandedBytes, entries: row.entries, headers: row.headers, regularFiles: row.regularFiles,
    decodedSha256: row.decodedSha256, metadataSha256: row.metadataSha256, metadataHashKind: 'OFFSET_EVENT_METADATA' })) };
  sameData(own(helper, 'SPLIT_TOOLCHAIN_EVIDENCE_EXPECTATIONS'), expectations);
  const targets = own(helper, 'SPLIT_TOOLCHAIN_EVIDENCE_TARGETS');
  preflight(targets, 65536);
  shape(targets, ['gnu', 'rust'], 'E_COMPONENT');
  const oldTargets = dataSnapshot(own(sdk, 'SDK_PAYLOAD_TARGETS'), 65536);
  if (oldTargets.length !== 45 || catalog.selectedRegularMetadata.length !== 45 ||
    !Array.isArray(targets.gnu) || targets.gnu.length !== 46 || !Array.isArray(targets.rust) || targets.rust.length !== 13) fail('E_COMPONENT');
  const expectedTargets = { gnu: oldTargets.map((old, index) => {
    sameData([old.path, old.index, old.bodyOffset, old.size], catalog.selectedRegularMetadata[index]);
    return { artifactRole: 'gnu-sdk', path: gnu.expectedRoot + '/' + old.path, index: old.index,
      bodyOffset: old.bodyOffset, size: old.size, expectedSha256: null, kind: old.kind, domain: old.domain,
      selectionRole: old.role, optionalForMinimalC: old.optionalForMinimalC,
      maxBytes: old.kind === 'AR' ? 8388608 : old.kind === 'LINKER_TEXT' ? 1048576 : 67108864 };
  }), rust: layout.runtimeInspectionCandidates.map(old => ({ artifactRole: old.role, path: old.path,
    index: old.index, bodyOffset: old.bodyOffset, size: old.size, expectedSha256: old.sha256,
    kind: old.size === 42 ? 'LINKER_TEXT' : 'ELF_EXEC_DSO', domain: old.role === 'rust-std' ? 'TARGET' : 'HOST',
    selectionRole: 'RUST_RUNTIME_CANDIDATE', optionalForMinimalC: false, maxBytes: old.size === 42 ? 1048576 : 268435456 })) };
  expectedTargets.gnu.push({ artifactRole: 'gnu-sdk', path: gnu.expectedRoot + '/x86_64-buildroot-linux-gnu/sysroot/lib/libmvec.so.1',
    index: null, bodyOffset: null, size: null, expectedSha256: null, kind: 'ELF_EXEC_DSO', domain: 'TARGET',
    selectionRole: 'TARGET_LIBMVEC_PROVIDER', optionalForMinimalC: false, maxBytes: 8388608 });
  sameData(targets, expectedTargets);
  return { expectations, targets };
}
function validateCollection(collection, expectations, targets, part) {
  const profile = SPLIT_TOOLCHAIN_OPERATION_PROFILES[partOf(part)], inputs = SPLIT_TOOLCHAIN_OPERATION_INPUTS[part];
  if (collection.state !== 'SPLIT_TOOLCHAIN_EVIDENCE_DATA' || collection.profile !== collection.state || collection.part !== part ||
    collection.mockOnly !== false || !Array.isArray(collection.roles) || collection.roles.length !== inputs.length ||
    collection.entries !== profile.entries || collection.regularFiles !== profile.regularFiles || collection.expandedBytes !== profile.expandedBytes ||
    collection.completeNamespace !== true || collection.selectedPayloads !== profile.targetCount || collection.artifactCount !== inputs.length ||
    !Array.isArray(collection.declaredNeededEdges)) fail('E_COLLECTION');
  const expectedEdges = [];
  collection.roles.forEach((role, index) => {
    const expected = expectations[index], input = inputs[index], gnu = input.role === 'gnu-sdk';
    if (role.role !== input.role || role.decodedSha256 !== expected.decodedSha256 ||
      !Array.isArray(role.members) || role.members.length !== expected.entries || role.completeNamespace !== true ||
      role.metadataSha256 !== expected.metadataSha256 || role.metadataHashKind !== expected.metadataHashKind ||
      typeof role.offsetMetadataSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(role.offsetMetadataSha256) ||
      role.inventory?.metadataSha256 !== role.offsetMetadataSha256 ||
      (gnu ? role.legacyMetadataSha256 : role.offsetMetadataSha256) !== expected.metadataSha256 ||
      !Array.isArray(role.manifests) || role.manifests.length !== (gnu ? 2 : 3) || !Array.isArray(role.selected)) fail('E_COLLECTION');
    const names = new Set(); let regular = 0;
    role.members.forEach((member, ordinal) => {
      if (member.index !== ordinal + 1 || typeof member.path !== 'string' ||
        !(member.path === input.expectedRoot || member.path.startsWith(input.expectedRoot + '/')) ||
        member.path.length > 1024 || /[\u0000-\u001f\u007f-\u009f\\]/u.test(member.path) ||
        member.path.split('/').some(piece => piece === '.' || piece === '..' || piece === '') || names.has(member.path) ||
        !['file', 'directory', 'hardlink', 'symlink'].includes(member.type) ||
        !Number.isSafeInteger(member.bodyOffset) || member.bodyOffset < 512 || member.bodyOffset % 512 !== 0 ||
        !Number.isSafeInteger(member.size) || member.size < 0 || member.size > expected.expandedBytes - member.bodyOffset) fail('E_COLLECTION');
      names.add(member.path);
      if (member.type === 'file') {
        regular++; if (typeof member.bodySha256 !== 'string' || !/^[a-f0-9]{64}$/.test(member.bodySha256)) fail('E_COLLECTION');
      } else if (member.size !== 0 || member.bodySha256 !== null || member.linkFollowed !== false) fail('E_COLLECTION');
    });
    if (regular !== expected.regularFiles) fail('E_COLLECTION');
    const selectedTargets = targets.filter(target => target.artifactRole === input.role), selectedNames = new Set();
    if (role.selected.length !== selectedTargets.length) fail('E_COLLECTION');
    for (const selected of role.selected) {
      const target = selectedTargets.find(row => row.path === selected.path), member = role.members[selected.index - 1];
      if (!target || selectedNames.has(selected.path) || !member || member.path !== selected.path || member.type !== 'file' ||
        selected.bodySha256 !== member.bodySha256 || selected.bodyOffset !== member.bodyOffset || selected.size !== member.size ||
        selected.size > target.maxBytes || selected.qualified !== false || selected.abiVerified !== false || selected.roleSatisfied !== false ||
        !selected.metadata || typeof selected.metadata !== 'object' ||
        selected.hashObservation !== (target.expectedSha256 === null ? 'FRESH_BODY_HASH' : 'MATCHED_EXPECTED_BODY_HASH')) fail('E_COLLECTION');
      const metadata = selected.metadata;
      if (metadata.qualified !== false) fail('E_COLLECTION');
      if (selected.kind === 'ELF_EXEC_DSO') {
        const needed = metadata.requirements?.dynamic?.needed;
        if (metadata.state !== 'ELF_EXEC_DSO_REQUIREMENT_DATA' || !Array.isArray(needed) || needed.length > 32 ||
          !Array.isArray(metadata.unsafeLoadingTags) || metadata.loadingTagsQualification !== 'NOT_QUALIFIED') fail('E_COLLECTION');
        for (const name of needed) {
          if (typeof name !== 'string' || name.length < 1 || Buffer.byteLength(name) > 1024) fail('E_COLLECTION');
          expectedEdges.push({ artifactRole: selected.artifactRole, from: selected.path, domain: selected.domain, needed: name,
            status: 'UNRESOLVED', providerQualified: false, abiVerified: false, aliasFollowed: false, hostTargetPromotion: false });
        }
      } else if (metadata.state !== 'SOURCE_FORMAT_DATA' || !metadata.observation || typeof metadata.observation !== 'object') fail('E_COLLECTION');
      for (const key of ['artifactRole', 'path', 'expectedSha256', 'kind', 'domain', 'selectionRole', 'optionalForMinimalC', 'maxBytes']) {
        if (selected[key] !== target[key]) fail('E_COLLECTION');
      }
      for (const key of ['index', 'bodyOffset', 'size']) if (target[key] !== null && selected[key] !== target[key]) fail('E_COLLECTION');
      if (target.expectedSha256 !== null && selected.bodySha256 !== target.expectedSha256) fail('E_COLLECTION');
      selectedNames.add(selected.path);
    }
    const manifestNames = new Set();
    for (const manifest of role.manifests) {
      const member = role.members.find(row => row.path === manifest.path);
      if (!member || member.type !== 'file' || manifestNames.has(manifest.path) || manifest.bodySha256 !== member.bodySha256 ||
        typeof manifest.text !== 'string' || manifest.interpreted !== false || !Array.isArray(manifest.declarations)) fail('E_COLLECTION');
      const bytes = Buffer.from(manifest.text, 'utf8');
      if (bytes.length !== member.size || bytes.length > 1048576 || sha(bytes) !== manifest.bodySha256) fail('E_COLLECTION');
      if (gnu && manifest.path.endsWith('/share/buildroot/sdk-relocs') &&
        (bytes.length !== 9367 || manifest.bodySha256 !== '60f1b6054d8f01670a9f5ac3ac0181f7148e37be91025c2c4f111df30047305e')) fail('E_COLLECTION');
      manifestNames.add(manifest.path);
    }
  });
  for (const edge of collection.declaredNeededEdges) if (edge.status !== 'UNRESOLVED' || edge.providerQualified !== false ||
    edge.abiVerified !== false || edge.aliasFollowed !== false || edge.hostTargetPromotion !== false) fail('E_COLLECTION');
  sameData(collection.declaredNeededEdges, expectedEdges, 8388608);
}
function validatePublication(record, snapshot, length, hash, part) {
  if (record.part !== part || snapshot.part !== part || record.state !== 'PUBLISHED_READBACK_MATCHED' ||
    record.path !== SPLIT_TOOLCHAIN_OPERATION_PATHS[partOf(part)] || record.byteLength !== length || record.sha256 !== hash ||
    record.mode !== '0444' || record.readbackVerified !== true || record.directorySynced !== true || snapshot.phase !== record.state ||
    snapshot.ownedFDCount !== 0 || snapshot.created !== true || snapshot.sealed !== true || snapshot.error !== null ||
    snapshot.closeFailed !== false || snapshot.cleanupUncertain !== false) fail('E_PUBLICATION_RECORD');
  sameData(record.counts, snapshot.counts);
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
const productionConsumed = new Set();
function stopped(code, mockOnly, part) {
  return Object.freeze({ exitCode: 1, text: asciiJson({ profile: 'registered-split-toolchain-evidence-v1', part,
    status: 'STOP', publicationAccepted: false, error: code, mockOnly,
    path: SPLIT_TOOLCHAIN_OPERATION_PATHS[part], realArchiveInspected: false, ...FLAGS }, 65536) });
}
function production(part, count) {
  if (count !== 0 || productionConsumed.has(part)) return stopped('E_INPUT', false, part);
  productionConsumed.add(part);
  return run({ fs, spawn: nodeSpawn, now: () => performance.now(), moduleImporter: target => import(target) }, false,
    SPLIT_TOOLCHAIN_SOURCE_PINS, SPLIT_TOOLCHAIN_GRAPH_PINS, part);
}
// WHAT: Independent zero-argument, one-shot GNU evidence operation.
export async function runRegisteredGnuEvidenceCollectionV1() { return production('gnu', arguments.length); }
// WHAT: Independent zero-argument, one-shot Rust evidence operation.
export async function runRegisteredRustEvidenceCollectionV1() { return production('rust', arguments.length); }

// WHAT: Explicit pure-mock controller capabilities with independent closed-part latches.
export function createSplitToolchainEvidenceOperationFixture(options, dependencies) {
  if (arguments.length !== 2) fail('E_INPUT');
  shape(options, ['mockOnly', 'helperPins']);
  if (own(options, 'mockOnly', 'E_INPUT') !== true) fail('E_INPUT');
  const helpers = shape(own(options, 'helperPins', 'E_INPUT'), ['collector', 'writer']);
  const pins = { ...SPLIT_TOOLCHAIN_SOURCE_PINS };
  for (const key of ['collector', 'writer']) {
    const pin = shape(own(helpers, key, 'E_INPUT'), ['bytes', 'sha256']);
    if (!Number.isSafeInteger(pin.bytes) || pin.bytes < 1 || pin.bytes >= 1048576 || !/^[a-f0-9]{64}$/.test(pin.sha256)) fail('E_INPUT');
    pins[key] = { bytes: pin.bytes, sha256: pin.sha256 };
  }
  shape(dependencies, ['fs', 'spawn', 'now', 'moduleImporter', 'setTimeout', 'clearTimeout']);
  const deps = {}, backend = own(dependencies, 'fs', 'E_INPUT');
  shape(backend, ['lstatSync', 'openSync', 'fstatSync', 'readSync', 'closeSync']);
  if (backend === fs) fail('E_INPUT');
  deps.fs = {};
  for (const name of ['lstatSync', 'openSync', 'fstatSync', 'readSync', 'closeSync']) {
    const method = functionOf(backend, name);
    if (method === fs[name]) fail('E_INPUT');
    deps.fs[name] = (...args) => Reflect.apply(method, backend, args);
  }
  for (const key of ['spawn', 'now', 'moduleImporter', 'setTimeout', 'clearTimeout']) {
    if (['setTimeout', 'clearTimeout'].includes(key) && !Object.hasOwn(dependencies, key)) continue;
    deps[key] = functionOf(dependencies, key);
  }
  if (deps.spawn === nodeSpawn) fail('E_INPUT');
  const consumed = new Set();
  const once = (part, count) => {
    if (count !== 0 || consumed.has(part)) return stopped('E_INPUT', true, part);
    consumed.add(part); return run(deps, true, freeze(pins), null, part);
  };
  return Object.freeze({
    async runRegisteredGnuEvidenceCollectionV1() { return once('gnu', arguments.length); },
    async runRegisteredRustEvidenceCollectionV1() { return once('rust', arguments.length); },
  });
}
async function run(deps, mockOnly, sourcePins, expectedGraphPins, part) {
  const profile = SPLIT_TOOLCHAIN_OPERATION_PROFILES[part], inputs = SPLIT_TOOLCHAIN_OPERATION_INPUTS[part];
  const repoCapture = captureCounts(), n = inputs.length;
  const counts = { spawnAttempts: 0, spawnEvents: 0, ownedChildren: 0, peakChildren: 0, childCloses: 0,
    stageChecks: 0, preloadChecks: 0, stageFsCalls: 0, stageReadBytes: 0, stageCloses: 0,
    completedCorePasses: 0, archivePasses: 0, archiveDataBytes: 0, archiveRequestedBytes: 0,
    archiveCloseAttempts: 0, expandedBytes: 0, streamEvents: 0, entries: 0 };
  let started, last, roleStarted = null, publicationStarted = null, collector = null, publisher = null;
  let sourceAccountingComplete = false, stageAccountingComplete = false, error = null, role = null;
  let graphPins = null, publicationCounts = null, abortUncertain = false;
  function guard(limit = 300000) {
    let now;
    try { now = deps.now(); } catch { fail('E_CLOCK'); }
    if (!Number.isFinite(now) || (last !== undefined && now < last)) fail('E_CLOCK');
    if (started === undefined) started = now;
    last = now;
    if (!Number.isFinite(started + 300000) || started + 300000 <= started) fail('E_CLOCK');
    if (now - started >= limit || (roleStarted !== null && now - roleStarted >= ROLE_MS[part]) ||
      (publicationStarted !== null && now - publicationStarted >= 30000)) fail('E_DEADLINE');
    return now;
  }
  const base = status => ({ profile: 'registered-split-toolchain-evidence-v1', part, status, mockOnly,
    path: SPLIT_TOOLCHAIN_OPERATION_PATHS[part], sourceInputPins: { sources: sourcePins, transforms: graphPins, inputs },
    collectionCounts: { ...counts }, repoCapture: { ...repoCapture }, sourceAccountingComplete, stageAccountingComplete,
    archiveAccountingComplete: counts.completedCorePasses === n,
    archiveCountersScope: 'completed private core results; failed-pass bytes remain unaccounted, not zero',
    descriptorScope: 'source peak1; collection publisher2 +archive2 +stage2, aggregate peak at most6',
    startupAssumptions: 'trusted Node builtins, module loader, runtime and process startup; not I/O isolation',
    realArchiveInspected: status !== 'STOP' && !mockOnly, ...FLAGS });
  try {
    guard(10000);
    if (!sourcePins.collector || !sourcePins.writer || (!mockOnly && !expectedGraphPins)) fail('E_HELPER_PENDING');
    const sources = new Map();
    for (const [key] of SOURCE_ROWS) sources.set(key, captureSource(key, deps.fs, repoCapture, guard, sourcePins));
    if (repoCapture.ownedFds !== 0 || repoCapture.closes !== SOURCE_ROWS.length) fail('E_CLOSE');
    const receipts = {};
    for (const [key] of SOURCE_ROWS.filter(([key]) => key.endsWith('Receipt'))) receipts[key] = JSON.parse(sources.get(key).toString('utf8'));
    const xz = receipts.xzReceipt;
    if (xz.status !== 'FINITE_XZ_PROFILE_OBSERVED' || xz.counts.spawnEvents !== 33 ||
      xz.fixtureManifestSha256 !== '632a0d812366712ae99ce2ce442ad98a59534430640184f70af53df58656b4ea') fail('E_RECEIPT');
    guard(10000);
    const graph = prepareSourceGraph(sources, expectedGraphPins, mockOnly, part, sourcePins); graphPins = graph.pins;
    guard(10000);
    const helper = await deps.moduleImporter(graph.collectorUri); guard(10000);
    const stage = await deps.moduleImporter(graph.stageUri); guard(10000);
    const sdk = await deps.moduleImporter(graph.sdkUri); guard(10000);
    const writer = await deps.moduleImporter(graph.writerUri); guard(10000);
    const inventories = [];
    for (let index = 0; index < n; index++) {
      const core = await deps.moduleImporter(graph.coreUris[index]); guard(10000);
      sameData(own(core, 'GNU_SDK_DESCRIPTOR'), descriptorFor(inputs[index]));
      sameData(own(core, 'GNU_SDK_LIMITS'), coreLimits(part));
      functionOf(core, 'runGnuSdkInventory'); inventories.push(core);
    }
    const constants = compareConstants(helper, sdk, receipts), expectations = constants.expectations[part], targets = constants.targets[part];
    sameData(own(writer, 'SPLIT_EVIDENCE_PARTS'), SPLIT_TOOLCHAIN_OPERATION_PARTS);
    sameData(own(writer, 'SPLIT_EVIDENCE_PATHS'), SPLIT_TOOLCHAIN_OPERATION_PATHS);
    sameData(own(writer, 'SPLIT_EVIDENCE_PUBLICATION_LIMITS'), WRITER_LIMITS);
    functionOf(stage, 'verifyStagedXzImages'); functionOf(stage, 'assertNoSystemPreload');
    functionOf(writer, 'reserveSplitEvidencePublication');
    functionOf(helper, 'SOURCE_CREATE_COLLECTOR');
    guard(10000); sourceAccountingComplete = true;
    publisher = writer.reserveSplitEvidencePublication(part, () => guard());
    for (const name of ['publish', 'abort', 'snapshot']) functionOf(publisher, name);
    const reserved = dataSnapshot(publisher.snapshot(), 8192, guard);
    if (reserved.part !== part || reserved.phase !== 'RESERVED' || reserved.ownedFDCount !== 2 || reserved.created !== true ||
      reserved.sealed !== false || reserved.error !== null || reserved.closeFailed !== false || reserved.cleanupUncertain !== false ||
      reserved.counts.writtenBytes !== 0) fail('E_PUBLICATION_RECORD');
    collector = Reflect.apply(functionOf(helper, 'SOURCE_CREATE_COLLECTOR'), helper, [part]);
    for (const name of METHODS) functionOf(collector, name);
    collector.beginToolchainEvidenceBatch(); guard();
    const acceptedState = (accepted, current = null) => {
      const snapshot = dataSnapshot(collector.snapshotToolchainEvidenceBatch(), 8192, guard);
      if (snapshot.part !== part || snapshot.state !== 'ACTIVE' || snapshot.mockOnly !== false || snapshot.acceptedRoles !== accepted ||
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
      if (counts.stageChecks > n * 2 || counts.preloadChecks > n * 2 || counts.stageCloses > n * 10) fail('E_LIMIT');
      guard(); return { stagedImagesVerified: true, preloadAbsent: true, ordinaryProfileObserved: true };
    };
    for (let index = 0; index < n; index++) {
      const input = inputs[index]; role = input.role;
      if (300000 - (guard() - started) < ADMISSION_MS[part]) fail('E_DEADLINE');
      roleStarted = last;
      collector.beginToolchainEvidenceRole(role); acceptedState(index, role);
      let attempts = 0;
      const coreDeps = { fs: deps.fs, now: deps.now, beforeDecode: gate, afterDecode: gate,
        spawn(...args) {
          guard(); attempts++; counts.spawnAttempts++;
          if (attempts !== 1 || counts.spawnAttempts > n || counts.ownedChildren !== 0) fail('E_LIMIT');
          const expectedArgs = ['--inhibit-cache', '--glibc-hwcaps-mask', '', '--library-path', DECODER,
            DECODER + '/xz', '--decompress', '--stdout', '--format=xz', '--threads=1',
            '--memlimit-decompress=' + input.decoderMemoryBytes, '--', '-'];
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
      const raw = await inventories[index].runGnuSdkInventory(input.identity, coreDeps);
      guard();
      const value = dataSnapshot(raw, 4194304, guard);
      if (value.state !== 'GNU_SDK_DATA_INVENTORY' || value.mockOnly !== false ||
        value.archiveBytes !== input.archiveBytes || value.archiveSha256 !== input.archiveSha256 || value.archivePasses !== 2 ||
        value.archiveDataBytes !== input.archiveBytes * 2 || value.archiveRequestedBytes !== input.archiveBytes * 2 + 2 ||
        value.closeAttempts !== 2 || value.exitCode !== 0 || value.signal !== null || attempts !== 1 ||
        counts.spawnEvents !== index + 1 || counts.ownedChildren !== 0 || counts.childCloses !== index + 1 ||
        counts.stageChecks !== (index + 1) * 2 || counts.preloadChecks !== (index + 1) * 2 || counts.stageCloses !== (index + 1) * 10 ||
        !['stdinFinished', 'stdoutEnded', 'stderrEnded', 'closeObserved'].every(key => value[key] === true) ||
        !['extracted', 'extractionAuthorized', 'pythonFreeSubsetVerified', 'installedUsability', 'nativeQualified',
          'decoderQualified', 'rustReady', 'trainingReady', 'provenanceVerified', 'hardRssBounded', 'processTreeBounded',
          'hardDeadlineGuaranteed'].every(key => value[key] === false) ||
        value.expandedBytes !== expectations[index].expandedBytes || value.inventory.entries !== expectations[index].entries ||
        !Number.isSafeInteger(value.streamEvents) || value.streamEvents < 0 || value.streamEvents > 262144) fail('E_RECEIPT');
      collector.acceptToolchainEvidenceRole(raw);
      if (index === n - 1) publicationStarted = guard();
      roleStarted = null;
      counts.completedCorePasses++; counts.archivePasses += 2; counts.archiveDataBytes += value.archiveDataBytes;
      counts.archiveRequestedBytes += value.archiveRequestedBytes; counts.archiveCloseAttempts += value.closeAttempts;
      counts.expandedBytes += value.expandedBytes; counts.streamEvents += value.streamEvents; counts.entries += value.inventory.entries;
      guard(); acceptedState(index + 1);
    }
    const dataBytes = part === 'gnu' ? 204592560 : 255545440;
    if (counts.archivePasses !== n * 2 || counts.archiveDataBytes !== dataBytes || counts.archiveRequestedBytes !== dataBytes + n * 2 ||
      counts.archiveCloseAttempts !== n * 2 || counts.stageChecks !== n * 2 || counts.preloadChecks !== n * 2 || counts.stageCloses !== n * 10 ||
      counts.spawnAttempts !== n || counts.spawnEvents !== n || counts.childCloses !== n || counts.ownedChildren !== 0 ||
      counts.peakChildren !== 1 || counts.expandedBytes !== profile.expandedBytes || counts.entries !== profile.entries) fail('E_RECEIPT');
    guard();
    const collection = collector.finishToolchainEvidenceBatch();
    preflight(collection, 16777216, guard, true);
    validateCollection(collection, expectations, targets, part);
    guard();
    const text = asciiJson({ ...base('SPLIT_TOOLCHAIN_EVIDENCE_DATA'), collection }, 16777216, guard);
    guard();
    const bytes = Buffer.from(text, 'ascii'), hash = sha(bytes);
    guard();
    const record = dataSnapshot(publisher.publish(bytes), 16384, guard);
    const snapshot = dataSnapshot(publisher.snapshot(), 16384, guard);
    publicationCounts = snapshot.counts;
    validatePublication(record, snapshot, bytes.length, hash, part);
    guard();
    const receipt = { ...base('SPLIT_TOOLCHAIN_EVIDENCE_DATA'), publicationAccepted: true,
      byteLength: bytes.length, sha256: hash, mode: '0444', readbackVerified: true, directorySynced: true,
      publicationCounts, publicationFileMetadata: record.fileMetadata };
    const compact = asciiJson(receipt, 65536, guard);
    guard(); return Object.freeze({ exitCode: 0, text: compact });
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
    error, role, publicationCounts, abortUncertain }, 65536) });
}
export const splitToolchainEvidenceOperationSource = Object.freeze({ rows: SOURCE_ROWS, transformTar, transformCore,
  prepareSourceGraph, captureSource, captureCounts, preflight, asciiJson, replaceOnce, link, pinned,
  compareConstants, validateCollection, validatePublication, descriptorFor, coreLimits,
  collectorLimits: COLLECTOR_LIMITS, writerLimits: WRITER_LIMITS, roleMs: ROLE_MS, admissionMs: ADMISSION_MS, freeze });
