// SPEC: _spec/tooling/native-ingress/step2.puml
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawn as nodeSpawn } from 'node:child_process';
import { types } from 'node:util';

const REPO = '/tmp/opencode/f9-bootstrap-correspondence';
const PART = 'gnu-preparation';
const ROOT = 'x86-64--glibc--stable-2026.08-1';
const DECODER = '/tmp/opencode/f9-xz-qualification-01';
const fail = code => { throw Object.freeze(Object.assign(new Error(code), { code })); };
function own(value, key, code = 'E_COMPONENT') {
  if (!value || !['object', 'function'].includes(typeof value) || types.isProxy(value)) fail(code);
  const field = Object.getOwnPropertyDescriptor(value, key);
  if (!field || !Object.hasOwn(field, 'value')) fail(code);
  return field.value;
}
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const key of Reflect.ownKeys(value)) freeze(own(value, key));
    Object.freeze(value);
  }
  return value;
}
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const pinOf = bytes => ({ bytes: bytes.length, sha256: sha(bytes) });
const uri = bytes => 'data:text/javascript;base64,' + bytes.toString('base64');
function shape(value, keys) {
  if (!value || typeof value !== 'object' || types.isProxy(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('E_INPUT');
  if (Reflect.ownKeys(value).length !== keys.length) fail('E_INPUT');
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !keys.includes(key)) fail('E_INPUT');
    own(value, key, 'E_INPUT');
  }
  return value;
}
function fn(value, name) {
  const method = own(value, name);
  if (typeof method !== 'function' || types.isProxy(method)) fail('E_COMPONENT');
  return method;
}
function pin(bytes, expected) {
  if (!Buffer.isBuffer(bytes) || types.isProxy(bytes) || bytes.length !== expected.bytes || sha(bytes) !== expected.sha256) fail('E_SOURCE_PIN');
  return bytes;
}
export const GNU_PREPARATION_OPERATION_PATH = REPO + '/_spec/tooling/native-ingress/gnu-preparation-evidence-v1.result.json';
export const GNU_PREPARATION_OPERATION_LIMITS = freeze({ sourceMs: 10000, totalMs: 300000,
  roleMs: 120000, workMs: 117000, cleanupMs: 3000, publicationMs: 30000, admissionMs: 150000,
  sourceBytes: 1048576, acceptedDataBytes: 4194304, sourceFsOperations: 8192, sourceReadsPerFile: 128,
  dataBytes: 16777216, receiptBytes: 65536, targetBytes: 16384, aggregateSelectedBytes: 49152 });
const OPERATION_PIN = freeze({ bytes: 60938, sha256: '47969e039e9f3bd192c869b0a43dd9ec88b2b934aeb11fc5e4f56da9918475b1' });
const DATA_PIN = freeze({ bytes: 2829942, sha256: '01c24e73a65148b8a70c3c1d4034f86dcac8040859bc206b5cf40b784776cc22' });
const OPERATION_PATH = REPO + '/tooling/native-ingress/split-toolchain-evidence-operation.mjs';
const DATA_PATH = REPO + '/_spec/tooling/native-ingress/gnu-evidence-collection-v1.result.json';
const SOURCE_PINS = freeze(Object.fromEntries([
  ['rawCore', 23261, 'bd2fc43633ca3b8f0c485eddb68a1b7505002edecd70eee4bf9cc661f588ef29'],
  ['rawTar', 15548, '050d629963fdf89bd5dff7639260c7de30b08be46320b7b6bb7ed4dac6bb8139'],
  ['sdk', 31569, 'fc301816588aa16360ce30a9c18ea7d5d82838432e7bd28f54155024e4445469'],
  ['elfV3', 20493, '3bd878fe2a6de57a2b8252163cdf2a4d3093c6605a903105a9f531f039b84f10'],
  ['elfV5', 21800, '1d9ebc5b27944ab646b2f61d334d2ff4bf43bddf226402ba225f6c02cf11dccb'],
  ['stage', 16688, 'f75c21a58bb67e6ab3f8b1dafd090e11ac2d3a70f017da35afb81b00761b71b4'],
  ['elfMetadata', 19842, 'b223a655eae572137891a2c6efafee16887a2478fc91052f0092b48dfd65de85'],
  ['collector', 49481, 'e3de2b2bebeec037a0962e8e7ca3a0e0cf69faec1363872232ef869a1b75b99c'],
  ['writer', 18003, '9e3d6d84e58d5e86a3097a4d8a731dcef9c922622b1fc225acf0385b218f41aa'],
  ['xzReceipt', 4239, 'e45d65231c0815ab2b895c0d74467500a0e6caf33cc0a4ee342b20489ce6b233'],
  ['rustReceipt', 4012, 'c068579e97c9c01c707bae0cdffb082bf23d7f089bcd404a114d290e0476be87'],
  ['sdkInventoryReceipt', 2732, '755a922e587e17b5978e3df77f96ac4a6fb43499d19df895c9148f0952fedcf5'],
  ['sdkCatalogReceipt', 5707, '6f0136fd082bf8c4a06fbb0d5f2734ab361c67707239f07b99f7087af1970492'],
  ['rustLayoutReceipt', 7637, '48a8091b6ef4541593aeb98e0140b107e016c36466b323e3570323e337054239'],
].map(([name, bytes, sha256]) => [name, { bytes, sha256 }])));
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
export const GNU_PREPARATION_INPUT = freeze({ role: 'gnu-sdk', root: '/tmp/opencode/f9-gnu-2026-data-only-01',
  file: '/tmp/opencode/f9-gnu-2026-data-only-01/' + ROOT + '.tar.xz', archiveBytes: 102296280,
  archiveSha256: 'cde893afab04ac7dcd15c46aac214ff550441b982536124c88a71146a0eeedd3', expectedRoot: ROOT,
  decoderMemoryBytes: 16777216,
  identity: { root: { dev: '28', ino: '13894', mode: '16832', uid: '1000', gid: '1000', nlink: '2', size: '4096',
    mtimeNs: '1792805590304271582', ctimeNs: '1792805590304271582' },
  file: { dev: '29', ino: '1211332', mode: '33152', uid: '1000', gid: '1000', nlink: '1', size: '102296280',
    mtimeNs: '1792805605531830652', ctimeNs: '1792805605531830652' } } });
const EXPECTED = freeze({ role: 'gnu-sdk', expandedBytes: 505333760, entries: 8412, headers: 10181, regularFiles: 6891,
  decodedSha256: '5e7f960281fb93121982f95976eb59ed980e009b54aabf993d5d3fa2982e056f',
  metadataSha256: 'efe53c8fda0b0f1e8b8ba6b7868707a88f33aa26b5692b9c76dc0e6da694d901',
  metadataHashKind: 'LEGACY_WITHOUT_BODY_OFFSET' });
const OFFSET_SHA = 'a3209a5860532febf8cbe41713629cb6bf94a5d081966fac96db496ddea35416';
export const GNU_PREPARATION_TARGETS = freeze([
  ['lib/gcc/x86_64-buildroot-linux-gnu/15.3.0/include-fixed/README', 8379, 504808448, 750,
    '32baa94efdf4fb418c20321f14a1b66982a6cd3c2b5bc8fbfbe438f687c528d6'],
  ['summary.csv', 8391, 505059840, 10391, 'da71ea6f278ae7314e122fb382a8860b19e88252bc89a730eea2a7f8d3c95621'],
  ['README.txt', 8412, 505326592, 1093, 'fa0b24cb67e660a5aebe2f4d4705b5a7ca2e5860e2e0405ddf6fddad40d4a41a'],
].map(([path, index, bodyOffset, size, expectedSha256]) => ({ artifactRole: 'gnu-sdk', path: ROOT + '/' + path,
  index, bodyOffset, size, expectedSha256, kind: 'PREPARATION_TEXT', domain: 'DISTRIBUTION_DATA',
  selectionRole: 'GNU_PREPARATION_CONTEXT_TEXT', optionalForMinimalC: false, maxBytes: 16384 })));
const FLAGS = freeze(Object.fromEntries([
  'sourceAuthenticated', 'licenseComplianceVerified', 'licensePermissionClassified', 'copyAuthorized',
  'includeClosureVerified', 'sysrootClosureVerified', 'relocationReady', 'pythonFreeSubsetVerified',
  'runtimeProvidersQualified', 'abiVerified', 'imagePrepared', 'nativeQualified', 'rustReady', 'trainingReady',
  'csvParsed', 'shellEvaluated', 'urlsFollowed', 'archiveExtracted', 'extracted', 'extractionAuthorized',
  'filesInstalled', 'compilerExecuted', 'memberExecuted', 'sdkExecuted', 'rustExecuted', 'runtimeExecuted',
  'pythonRuntimeInvoked', 'noPythonRuntimeVerified', 'nativeAuthority', 'qualified', 'roleSatisfied',
  'provenanceVerified', 'decoderQualified', 'installedUsability', 'hardRssBounded', 'hardDeadlineGuaranteed',
  'processTreeBounded', 'ioIsolated', 'sourceRootAuthentication', 'ancestorRacesExcluded', 'atomicCrashCommit',
  'storageFailureSurvival', 'authenticatedStorage', 'abiQualified', 'nodeIoQualified', 'imageEquivalent',
  'loaderClosureVerified', 'sourceReady', 'rootfsReady', 'installReady', 'dockerProviderQualified',
  'installMapInterpreted', 'hostTargetPromotion', 'jointEvidenceSetComplete',
].map(key => [key, false])));

function inspectPreparationText(bytes) {
  const reject = () => { throw Object.freeze(Object.assign(new Error('E_INPUT'), { code: 'E_INPUT' })); };
  if (!Buffer.isBuffer(bytes) || types.isProxy(bytes) || bytes.length > 16384) reject();
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { reject(); }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(text)) reject();
  return { state: 'GNU_PREPARATION_RAW_TEXT_DATA', text, interpreted: false, urlsFollowed: false };
}
const DISPATCH = "{ ET_REL: 'rel', AR: 'archive', LINKER_TEXT: 'linker' }";
const NEW_DISPATCH = "{ ET_REL: 'rel', AR: 'archive', LINKER_TEXT: 'linker', PREPARATION_TEXT: 'text' }";
const SDK_APPEND = '\nexport const SOURCE_FORMAT_INSPECTORS = Object.freeze({rel,archive,linker});\n';
const COLLECTOR_APPEND = '\n' + inspectPreparationText.toString() + `
const SOURCE_PREPARATION_PROFILE = freeze({ part: 'gnu', mockOnly: false,
  inputs: SPLIT_TOOLCHAIN_EVIDENCE_INPUTS.gnu, expectations: SPLIT_TOOLCHAIN_EVIDENCE_EXPECTATIONS.gnu,
  targets: ${JSON.stringify(GNU_PREPARATION_TARGETS)},
  limits: { ...SPLIT_TOOLCHAIN_EVIDENCE_LIMITS, maxPayloadBytes: 16384, maxElfSnapshotBytes: 16384 } });
let SOURCE_PREPARATION_INSTANCE = null;
let SOURCE_PREPARATION_CONSUMED = false;
export function SOURCE_CREATE_GNU_PREPARATION() {
  if (SOURCE_PREPARATION_CONSUMED) fail('E_EVIDENCE_STATE');
  SOURCE_PREPARATION_CONSUMED = true;
  if (arguments.length) fail('E_EVIDENCE_INPUT');
  SOURCE_PREPARATION_INSTANCE = collector(SOURCE_PREPARATION_PROFILE,
    { parserFactory: originalCreateTarInventory, elfInspector: inspectElf64RequirementsV5,
      formatInspectors: Object.freeze({ ...SOURCE_FORMAT_INSPECTORS, text: inspectPreparationText }) });
  return SOURCE_PREPARATION_INSTANCE;
}
export const SOURCE_GNU_TAR = limits => SOURCE_PREPARATION_INSTANCE.createTarInventory(limits);
`;
const WRITER_PARTS = "export const SPLIT_EVIDENCE_PARTS = Object.freeze(['gnu', 'rust']);";
const WRITER_PATHS = `export const SPLIT_EVIDENCE_PATHS = Object.freeze({
  gnu: '${REPO}/_spec/tooling/native-ingress/gnu-evidence-collection-v1.result.json',
  rust: '${REPO}/_spec/tooling/native-ingress/rust-evidence-collection-v1.result.json',
});`;
const GRAPH_PINS = freeze(Object.fromEntries([
  ['eventTar', 15595, 'bf8c7fcc56c26aa0618c014d74046dc29b79c09340728b27dd0363a758b9ef9a'],
  ['appendedSdk', 31647, '22be684fb42feecbf6ac629f8e1fbf310bb31635325a9d1dc5a9e81fd75ee3b8'],
  ['tarLinkedSdk', 52452, '60931c3c8ba2b491ecdac39e4b0106da55fe312ecd9164fb3086909695d9fef2'],
  ['linkedSdk', 79779, 'aeeafd8124729ef1ee3d54787c40249a6740796ae806a8d97d370e042690d2f2'],
  ['classifiedCollector', 49507, '2fa93163e1a1e21adca6539f4d9a8de13e2c616e1f239a99e2092756f8a15a34'],
  ['appendedCollector', 52163, '17db9877a527e547025e22af6b1334da341441e8b089d444fc4a11f69a6282cc'],
  ['tarLinkedCollector', 72968, '23762c42bcca85061af22fbc3e5d4cf77a903012087d65a772cbf8d508410d0e'],
  ['elfLinkedCollector', 102039, 'fff7bab5d941c438c51d04bb67a835cd01bd8c42b6465058bd5b4e6da83ce553'],
  ['linkedCollector', 208411, '51f0f2ec103970eb7ce0d7c7b9c9d092a1506e36447d08d02b4f78430c33da1b'],
  ['linkedStage', 43154, '89b6c5e3dcbf902937f81fc642d7238bd4ec4ca3c94f6b61f4d069efdce8c5f2'],
  ['gnu-sdk:descriptor', 23268, '23818c09fa96c071fad754d1799312bd284c23d8c8b9406f7f92c9bff2bcc907'],
  ['gnu-sdk:events', 23269, '8e9cc0a83ba3137834e92876c1071c0fe8b085816bb60ff23431851f8f485b9f'],
  ['gnu-sdk:summary', 23271, '172aeed50a2c67901fd3e138a36b9accfa421d4689b613bd02e1e2a1363c431a'],
  ['gnu-sdk:selectors', 22514, 'dafb46d34d51c73718dd021b77fb3f123cc0fd96821988cfcf61a7317ef1c5b6'],
  ['gnu-sdk:parserBinding', 22532, '2fd7959317c37f89470725b0ec07a773f858fc1d7d018f2341500aaa4109ff3d'],
  ['gnu-sdk:linkedCore', 300425, '48b21ad0fa43ce25a6b4ba8ce43c10bb3803e3ddc187f468388d366b721da0a0'],
  ['writerParts', 18007, '38d4b5585dc669fb1732d9666b2993f33ecdff96326a01e31c7c9fe44d50ad48'],
  ['linkedWriter', 17897, '999af1b6e82df0aebdb5d91380cdcc7433757132a26d23d91c8675a6db18b33a'],
].map(([key, bytes, sha256]) => [key, { bytes, sha256 }])));

function buildGraph(sources, src) {
  const outputs = {}, pins = {};
  const save = (key, bytes) => { outputs[key] = bytes; pins[key] = pinOf(bytes); return bytes; };
  for (const [key] of SOURCE_ROWS) pin(sources.get(key), SOURCE_PINS[key]);
  const tar = save('eventTar', src.transformTar(sources.get('rawTar'))), tarUri = uri(tar);
  const sdk1 = save('appendedSdk', Buffer.concat([sources.get('sdk'), Buffer.from(SDK_APPEND)]));
  const sdk2 = save('tarLinkedSdk', src.link(sdk1, 'tar-inventory', tarUri));
  const sdk = save('linkedSdk', src.link(sdk2, 'elf-requirements-v3', uri(sources.get('elfV3'))));
  const classified = save('classifiedCollector', Buffer.from(src.replaceOnce(sources.get('collector').toString('utf8'), DISPATCH, NEW_DISPATCH)));
  const appended = save('appendedCollector', Buffer.concat([classified, Buffer.from(COLLECTOR_APPEND)]));
  const c1 = save('tarLinkedCollector', src.link(appended, 'tar-inventory', tarUri));
  const c2 = save('elfLinkedCollector', src.link(c1, 'elf-requirements-v5', uri(sources.get('elfV5'))));
  const c3 = save('linkedCollector', src.link(c2, 'sdk-payload-inspection', uri(sdk)));
  const collectorUri = uri(c3);
  const stage = save('linkedStage', src.link(sources.get('stage'), 'elf-metadata', uri(sources.get('elfMetadata'))));
  const transformed = src.transformCore(sources.get('rawCore'), 'gnu', 'gnu-sdk', (name, bytes) => save('gnu-sdk:' + name, bytes));
  const core = save('gnu-sdk:linkedCore', src.link(transformed, 'tar-inventory', collectorUri));
  let writer = src.replaceOnce(sources.get('writer').toString('utf8'), WRITER_PARTS,
    "export const SPLIT_EVIDENCE_PARTS = Object.freeze(['gnu-preparation']);");
  save('writerParts', Buffer.from(writer));
  writer = save('linkedWriter', Buffer.from(src.replaceOnce(writer, WRITER_PATHS,
    "export const SPLIT_EVIDENCE_PATHS = Object.freeze({ 'gnu-preparation': '" + GNU_PREPARATION_OPERATION_PATH + "' });")));
  return { outputs, pins: freeze(pins), collectorUri, coreUri: uri(core), stageUri: uri(stage), writerUri: uri(writer) };
}
function admitGraph(graph) {
  if (Object.keys(graph.outputs).length !== Object.keys(GRAPH_PINS).length) fail('E_SOURCE_PIN');
  for (const [key, bytes] of Object.entries(graph.outputs)) pin(bytes, GRAPH_PINS[key]);
}
function captureCounts() {
  return { fsCalls: 0, rootChecks: 0, namedChecks: 0, fdChecks: 0, openAttempts: 0, readAttempts: 0,
    requestedBytes: 0, readBytes: 0, eofChecks: 0, closeAttempts: 0, closes: 0, completedCaptures: 0,
    allocations: 0, allocatedBytes: 0, ownedFds: 0, peakOwnedFds: 0 };
}
const FIELDS = freeze(['dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtimeNs', 'ctimeNs']);
function metadata(value, directory, size = null) {
  const result = {};
  for (const key of FIELDS) {
    const n = own(value, key, 'E_METADATA');
    if (typeof n !== 'bigint' || n > 0xffffffffffffffffn || n < (key.endsWith('Ns') ? -0x8000000000000000n : 0n)) fail('E_METADATA');
    result[key] = n;
  }
  if ((result.mode & 0o170000n) !== (directory ? 0o040000n : 0o100000n) || result.ino <= 0n ||
    (!directory && result.nlink !== 1n) || (size !== null && result.size !== BigInt(size))) fail('E_METADATA');
  return result;
}
function sameMetadata(a, b) { if (!FIELDS.every(key => a[key] === b[key])) fail('E_BINDING'); }
function capture(path, expected, io, counts, budget, guard) {
  if (!Number.isSafeInteger(expected.bytes) || expected.bytes < 1 || expected.bytes + 1 > budget ||
    !/^[a-f0-9]{64}$/.test(expected.sha256) || counts.allocatedBytes + expected.bytes + 1 > budget) fail('E_LIMIT');
  let fd = null, bytes;
  const call = (method, ...args) => {
    guard(10000);
    if (counts.fsCalls + 1 + Number(fd !== null) > 8192) fail('E_LIMIT');
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
    const root = stat('lstatSync', REPO, true), named = stat('lstatSync', path, false, expected.bytes);
    const c = fs.constants;
    if (c.O_RDONLY !== 0 || ![c.O_NOFOLLOW, c.O_NONBLOCK].every(n => Number.isInteger(n) && n > 0)) fail('E_PREREQUISITE');
    guard(10000);
    if (counts.fsCalls + 2 > 8192) fail('E_LIMIT');
    counts.fsCalls++; counts.openAttempts++;
    try { fd = io.openSync(path, c.O_RDONLY | c.O_NOFOLLOW | c.O_NONBLOCK); } catch { fail('E_IO'); }
    if (!Number.isSafeInteger(fd) || fd < 0) { fd = null; fail('E_IO'); }
    counts.ownedFds++; counts.peakOwnedFds = Math.max(counts.peakOwnedFds, counts.ownedFds);
    guard(10000);
    const bound = stat('fstatSync', fd, false, expected.bytes); sameMetadata(named, bound);
    if (counts.ownedFds !== 1 || counts.allocatedBytes + expected.bytes + 1 > budget) fail('E_LIMIT');
    bytes = Buffer.alloc(expected.bytes + 1); counts.allocations++; counts.allocatedBytes += bytes.length;
    let position = 0, attempts = 0;
    const read = length => {
      if (++attempts > 128) fail('E_LIMIT');
      counts.readAttempts++; counts.requestedBytes += length;
      const amount = call('readSync', fd, bytes, position, length, position);
      if (!Number.isSafeInteger(amount) || amount < 0 || amount > length) fail('E_LENGTH');
      counts.readBytes += amount; return amount;
    };
    while (position < expected.bytes) {
      const length = Math.min(65536, expected.bytes - position);
      if (read(length) !== length) fail('E_LENGTH');
      position += length;
    }
    if (read(1) !== 0) fail('E_LENGTH');
    counts.eofChecks++;
    sameMetadata(bound, stat('fstatSync', fd, false, expected.bytes));
    sameMetadata(named, stat('lstatSync', path, false, expected.bytes));
    sameMetadata(root, stat('lstatSync', REPO, true));
  } finally {
    if (fd !== null) {
      const owned = fd; fd = null; counts.ownedFds--; counts.closeAttempts++; counts.fsCalls++;
      try { io.closeSync(owned); counts.closes++; } catch { fail('E_CLOSE'); }
    }
  }
  guard(10000);
  const captured = pin(bytes.subarray(0, expected.bytes), expected);
  guard(10000); counts.completedCaptures++; return captured;
}

function safeJson(value, maximum, guard = () => {}, requireFrozen = false) {
  let cost = 1, nodes = 0;
  const parents = new Set();
  const add = n => { cost += n; if (cost > maximum) fail('E_OUTPUT'); };
  const string = text => {
    add(2);
    for (let i = 0; i < text.length; i++) {
      if ((i & 65535) === 0) guard();
      const c = text.charCodeAt(i);
      add(c > 127 ? 6 : c < 32 ? [8, 9, 10, 12, 13].includes(c) ? 2 : 6 : c === 34 || c === 92 ? 2 : 1);
    }
  };
  const visit = (v, depth) => {
    if (++nodes > 1048576 || depth > 64) fail('E_OUTPUT');
    if ((nodes & 1023) === 0) guard();
    if (v === null || typeof v === 'boolean') { add(v === false ? 5 : 4); return; }
    if (typeof v === 'string') { string(v); return; }
    if (typeof v === 'number' && Number.isFinite(v)) { add(JSON.stringify(v).length); return; }
    if (!v || typeof v !== 'object' || types.isProxy(v) || parents.has(v)) fail('E_OUTPUT');
    const array = Array.isArray(v);
    if (![array ? Array.prototype : Object.prototype, ...(array ? [] : [null])].includes(Object.getPrototypeOf(v))) fail('E_OUTPUT');
    if (requireFrozen && !Object.isFrozen(v)) fail('E_COLLECTION');
    parents.add(v); add(2);
    const keys = Reflect.ownKeys(v);
    if (keys.length > 1048576) fail('E_OUTPUT');
    let count = 0;
    for (const key of keys) {
      if (array && key === 'length') continue;
      if (typeof key !== 'string' || key === 'toJSON' || array && key !== String(count)) fail('E_OUTPUT');
      const field = Object.getOwnPropertyDescriptor(v, key);
      if (!field || !Object.hasOwn(field, 'value') || !field.enumerable) fail('E_OUTPUT');
      if (Object.hasOwn(FLAGS, key) && field.value !== false) fail('E_RECEIPT');
      if (count++) add(1);
      if (!array) { string(key); add(1); }
      visit(field.value, depth + 1);
    }
    if (array && count !== own(v, 'length')) fail('E_OUTPUT');
    parents.delete(v);
  };
  guard(); visit(value, 0); guard();
  const text = JSON.stringify(value).replace(/[^\x00-\x7f]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')) + '\n';
  if (text.length !== cost || text.length > maximum) fail('E_OUTPUT');
  guard(); return text;
}
const snapshot = (value, maximum = 16384, guard = () => {}) => JSON.parse(safeJson(value, maximum, guard));
function sameData(a, b) {
  const equal = (x, y) => {
    if (x === y) return true;
    if (!x || !y || typeof x !== 'object' || typeof y !== 'object' || Array.isArray(x) !== Array.isArray(y)) return false;
    const keys = Object.keys(x).sort(), other = Object.keys(y).sort();
    return keys.length === other.length && keys.every((key, i) => key === other[i] && equal(x[key], y[key]));
  };
  if (!equal(a, b)) fail('E_COLLECTION');
}
function validateMembers(role, accepted, guard = () => {}) {
  if (!Array.isArray(role.members) || role.members.length !== 8412 || !Array.isArray(accepted.members) || accepted.members.length !== 8412) fail('E_COLLECTION');
  let regular = 0;
  for (let i = 0; i < role.members.length; i++) {
    if ((i & 255) === 0) guard();
    const member = role.members[i];
    sameData(member, accepted.members[i]);
    if (member.index !== i + 1 || typeof member.path !== 'string' ||
      member.path !== ROOT && !member.path.startsWith(ROOT + '/') ||
      !Number.isSafeInteger(member.bodyOffset) || member.bodyOffset < 512 || member.bodyOffset % 512 ||
      !Number.isSafeInteger(member.size) || member.size < 0 || member.bodyOffset + member.size > 505333760) fail('E_COLLECTION');
    if (member.type === 'file') {
      regular++;
      if (!/^[a-f0-9]{64}$/.test(member.bodySha256)) fail('E_COLLECTION');
    } else if (!['directory', 'symlink', 'hardlink'].includes(member.type) || member.bodySha256 !== null || member.linkFollowed !== false || member.size !== 0) fail('E_COLLECTION');
  }
  if (regular !== 6891) fail('E_COLLECTION');
}
const HEADER_PREFIX = ROOT + '/lib/gcc/x86_64-buildroot-linux-gnu/15.3.0/include/';
const PLUGIN_PREFIX = ROOT + '/lib/gcc/x86_64-buildroot-linux-gnu/15.3.0/plugin/include/';
function headerLedger(role, accepted, guard = () => {}) {
  const fresh = role.members.filter(m => m.type === 'file' && m.path.startsWith(HEADER_PREFIX));
  const old = accepted.members.filter(m => m.type === 'file' && m.path.startsWith(HEADER_PREFIX));
  sameData(fresh, old);
  if (fresh.length !== 150 || fresh.reduce((sum, m) => sum + m.size, 0) !== 2907751) fail('E_COLLECTION');
  return fresh.map(member => {
    guard();
    return { artifactRole: 'gnu-sdk', index: member.index, path: member.path, bodyOffset: member.bodyOffset,
      size: member.size, bodySha256: member.bodySha256, domain: 'TARGET', disposition: 'C_HEADER_CANDIDATE',
      proposedRelativeDestination: 'gnu/' + member.path.slice(ROOT.length + 1), copyAuthorized: false, includeClosureVerified: false };
  });
}
function validateRoleEnvelope(role) {
  for (const [key, expected] of Object.entries(EXPECTED)) if (role[key] !== expected) fail('E_COLLECTION');
  if (role.completeNamespace !== true || role.offsetMetadataSha256 !== OFFSET_SHA ||
    role.legacyMetadataSha256 !== EXPECTED.metadataSha256 || role.inventory?.metadataSha256 !== OFFSET_SHA ||
    role.inventory?.entries !== 8412 || role.inventory?.headers !== 10181 || role.inventory?.expandedBytes !== 505333760) fail('E_COLLECTION');
}
function acceptedRole(data, guard) {
  if (data.status !== 'SPLIT_TOOLCHAIN_EVIDENCE_DATA' || data.part !== 'gnu' || data.mockOnly !== false ||
    data.collection?.roles?.length !== 1 || data.collection.completeNamespace !== true) fail('E_COLLECTION');
  const role = data.collection.roles[0];
  validateRoleEnvelope(role); validateMembers(role, role, guard);
  for (const target of GNU_PREPARATION_TARGETS) {
    const member = role.members[target.index - 1];
    for (const key of ['path', 'index', 'bodyOffset', 'size']) if (member[key] !== target[key]) fail('E_COLLECTION');
    if (member.type !== 'file' || member.bodySha256 !== target.expectedSha256) fail('E_COLLECTION');
  }
  headerLedger(role, role, guard); return role;
}
function validateCollection(collection, accepted, guard = () => {}) {
  if (collection.state !== 'SPLIT_TOOLCHAIN_EVIDENCE_DATA' || collection.profile !== collection.state || collection.part !== 'gnu' ||
    collection.mockOnly !== false || collection.completeNamespace !== true || collection.entries !== 8412 || collection.regularFiles !== 6891 ||
    collection.expandedBytes !== 505333760 || collection.artifactCount !== 1 || collection.targetCount !== 3 || collection.selectedPayloads !== 3 ||
    collection.roles?.length !== 1 || !Array.isArray(collection.declaredNeededEdges) || collection.declaredNeededEdges.length !== 0) fail('E_COLLECTION');
  const role = collection.roles[0]; validateRoleEnvelope(role); validateMembers(role, accepted, guard);
  if (!Array.isArray(role.selected) || role.selected.length !== 3 || !Array.isArray(role.manifests) || role.manifests.length !== 2) fail('E_COLLECTION');
  let selectedBytes = 0;
  for (let i = 0; i < 3; i++) {
    const selected = role.selected[i], target = GNU_PREPARATION_TARGETS[i];
    for (const key of Object.keys(target)) if (selected[key] !== target[key]) fail('E_COLLECTION');
    if (selected.bodySha256 !== target.expectedSha256 || selected.hashObservation !== 'MATCHED_EXPECTED_BODY_HASH' ||
      selected.qualified !== false || selected.abiVerified !== false || selected.roleSatisfied !== false ||
      selected.metadata?.state !== 'SOURCE_FORMAT_DATA' || selected.metadata.qualified !== false) fail('E_COLLECTION');
    const observation = selected.metadata.observation;
    if (typeof observation?.text !== 'string' || Buffer.byteLength(observation.text, 'utf8') !== target.size) fail('E_COLLECTION');
    selectedBytes += target.size;
    if (target.size > 16384 || selectedBytes > 49152) fail('E_COLLECTION');
    sameData(observation, inspectPreparationText(Buffer.from(observation.text, 'utf8')));
  }
  sameData(role.manifests, accepted.manifests);
  if (selectedBytes !== 12234) fail('E_COLLECTION');
  for (const manifest of role.manifests) {
    const member = role.members.find(m => m.path === manifest.path), bytes = Buffer.from(manifest.text, 'utf8');
    if (!member || bytes.length !== member.size || sha(bytes) !== member.bodySha256 || manifest.bodySha256 !== member.bodySha256 ||
      manifest.interpreted !== false || manifest.declarations.length !== 0) fail('E_COLLECTION');
  }
  const a = collection.resourceAccounting;
  if (!a || a.buffersAllocated !== 5 || a.buffersErased !== 5 || a.peakPayloadBytes !== 10391 ||
    a.capturedBytes !== 12234 || a.manifestBytes !== 9446 || a.maxAdditionalElfSnapshotBytes !== 16384 ||
    a.secureStringErasureClaimed !== false || a.hardRssBounded !== false ||
    !Number.isSafeInteger(a.metadataBytes) || a.metadataBytes > 8388608) fail('E_COLLECTION');
  const headers = headerLedger(role, accepted, guard);
  const plugins = role.members.filter(m => m.type === 'file' && m.path.startsWith(PLUGIN_PREFIX));
  if (plugins.length !== 560 || plugins.reduce((n, m) => n + m.size, 0) !== 9731900) fail('E_COLLECTION');
  return { headerLedger: headers, headerCount: 150, headerBytes: 2907751,
    includeFixedContext: { selectedREADMEOnly: true, admittedHeaders: 0, headersInferred: false, copyAuthorized: false },
    pluginSummary: { prefix: PLUGIN_PREFIX, regularFiles: 560, bytes: 9731900, sourceContext: 'UNQUALIFIED', admitted: false,
      copyAuthorized: false, includeClosureVerified: false },
    selectedTextBytes: 12234, selectedTextCaptures: 3, manifestTextCaptures: 2, totalTextCaptures: 5,
    totalCapturedTextBytes: 21680, actualElfInspections: 0, additionalElfSnapshotPolicyBytes: 16384 };
}
function validatePublication(record, state, length, hash) {
  if (record.part !== PART || state.part !== PART || record.state !== 'PUBLISHED_READBACK_MATCHED' ||
    record.path !== GNU_PREPARATION_OPERATION_PATH || record.byteLength !== length || record.sha256 !== hash ||
    record.mode !== '0444' || record.readbackVerified !== true || record.directorySynced !== true || state.phase !== record.state ||
    state.ownedFDCount !== 0 || state.created !== true || state.sealed !== true || state.error !== null ||
    state.closeFailed !== false || state.cleanupUncertain !== false) fail('E_PUBLICATION_RECORD');
  sameData(record.counts, state.counts);
  const c = record.counts, m = record.fileMetadata;
  if (!m || !FIELDS.every(key => typeof m[key] === 'string' && /^-?[0-9]{1,40}$/.test(m[key])) ||
    m.mode !== '33060' || m.size !== String(length) || m.nlink !== '1' || m.uid !== '1000' || m.gid !== '1000' || BigInt(m.ino) <= 0n) fail('E_PUBLICATION_RECORD');
  if (!Object.values(c).every(n => Number.isSafeInteger(n) && n >= 0) || c.opens !== 3 || c.closeAttempts !== 3 || c.closes !== 3 ||
    c.cleanupCloseAttempts !== 0 || c.fsyncs !== 4 || c.chmods !== 1 || c.peakOwnedFDs !== 2 ||
    !['inputBytes', 'copiedBytes', 'inputHashBytes', 'writtenBytes', 'readbackBytes', 'readbackHashBytes'].every(key => c[key] === length) ||
    c.requestedReadBytes < length + 1 || c.requestedReadBytes > 16777217 || c.ownedSnapshotBytes !== 0 || c.ownedScratchBytes !== 0 ||
    c.fsOperations > 8192 || c.writeAttempts < 1 || c.writeAttempts > 4096 || c.readAttempts < 2 || c.readAttempts > 1024) fail('E_PUBLICATION_RECORD');
  for (const key of ['sourceRootAuthentication', 'ancestorRacesExcluded', 'atomicCrashCommit', 'storageFailureSurvival',
    'hardDeadlineGuaranteed', 'nativeQualified', 'abiQualified', 'authenticatedStorage']) if (record[key] !== false) fail('E_PUBLICATION_RECORD');
}
const METHODS = freeze(['beginToolchainEvidenceBatch', 'beginToolchainEvidenceRole', 'createTarInventory',
  'acceptToolchainEvidenceRole', 'finishToolchainEvidenceBatch', 'abortToolchainEvidenceBatch',
  'getToolchainEvidenceFailure', 'snapshotToolchainEvidenceBatch']);
function codeOf(error) {
  try {
    const code = own(error, 'code');
    return typeof code === 'string' && /^E_(?:INPUT|COMPONENT|SOURCE_PIN|METADATA|BINDING|IO|CLOSE|LENGTH|HASH|PREREQUISITE|LIMIT|CLOCK|DEADLINE|OUTPUT|RECEIPT|COLLECTION|SPAWN|PIPE|DECODER|TAR|PRELOAD|CLEANUP|EVIDENCE_[A-Z_]+|PUBLICATION_[A-Z_]+)$/.test(code) ? code : 'E_COLLECTION';
  } catch { return 'E_IO'; }
}
const stopInput = mockOnly => Object.freeze({ exitCode: 1, text: safeJson({ profile: 'registered-gnu-preparation-evidence-v1',
  part: PART, status: 'STOP', publicationAccepted: false, error: 'E_INPUT', mockOnly,
  realArchiveInspected: false, sourceContext: 'UNQUALIFIED', ...FLAGS }, 65536) });
let productionConsumed = false;
// WHAT: Independent zero-argument, one-shot GNU preparation evidence operation.
export async function runRegisteredGnuPreparationEvidenceV1() {
  const consumed = productionConsumed; productionConsumed = true;
  if (arguments.length || consumed) return stopInput(false);
  return run({ fs, spawn: nodeSpawn, now: () => performance.now(), moduleImporter: target => import(target),
    setTimeout, clearTimeout }, false);
}
// WHAT: Complete injected mock-only I/O capabilities with no production fallback.
export function createGnuPreparationEvidenceOperationFixture(options, dependencies) {
  if (arguments.length !== 2) fail('E_INPUT');
  shape(options, ['mockOnly']);
  if (own(options, 'mockOnly') !== true) fail('E_INPUT');
  shape(dependencies, ['fs', 'spawn', 'now', 'moduleImporter', 'setTimeout', 'clearTimeout']);
  const backend = own(dependencies, 'fs');
  const names = ['lstatSync', 'openSync', 'fstatSync', 'readSync', 'closeSync'];
  shape(backend, names);
  if (backend === fs) fail('E_INPUT');
  const deps = { fs: {} };
  for (const name of names) {
    const method = fn(backend, name);
    if (method === fs[name]) fail('E_INPUT');
    deps.fs[name] = (...args) => Reflect.apply(method, backend, args);
  }
  for (const name of ['spawn', 'now', 'moduleImporter', 'setTimeout', 'clearTimeout']) deps[name] = fn(dependencies, name);
  if (deps.spawn === nodeSpawn) fail('E_INPUT');
  let consumed = false;
  return Object.freeze({ async runRegisteredGnuPreparationEvidenceV1() {
    const previous = consumed; consumed = true;
    if (arguments.length || previous) return stopInput(true);
    return run(deps, true);
  } });
}

async function run(deps, mockOnly) {
  const repoCapture = captureCounts(), dataCapture = captureCounts();
  const counts = { spawnAttempts: 0, spawnEvents: 0, childCloses: 0, ownedChildren: 0, peakChildren: 0,
    stageChecks: 0, preloadChecks: 0, stageFsCalls: 0, stageReadBytes: 0, stageCloses: 0,
    completedCorePasses: 0, archivePasses: 0, archiveDataBytes: 0, archiveRequestedBytes: 0,
    archiveCloseAttempts: 0, expandedBytes: 0, entries: 0, streamEvents: 0 };
  let started, last, roleStarted = null, publicationStarted = null, collector = null, publisher = null;
  let sourceAccountingComplete = false, stageAccountingComplete = false, graphPins = null, publicationCounts = null;
  let error = null, abortUncertain = false, publicationReservationUncertain = false, diagnostic = null;
  function guard(limit = 300000) {
    let now;
    try { now = deps.now(); } catch { fail('E_CLOCK'); }
    if (!Number.isFinite(now) || last !== undefined && now < last) fail('E_CLOCK');
    if (started === undefined) started = now;
    last = now;
    if (!Number.isFinite(started + 300000) || started + 300000 <= started) fail('E_CLOCK');
    if (now - started >= limit || roleStarted !== null && now - roleStarted >= 120000 ||
      publicationStarted !== null && now - publicationStarted >= 30000) fail('E_DEADLINE');
    return now;
  }
  const base = status => ({ profile: 'registered-gnu-preparation-evidence-v1', part: PART, status, mockOnly,
    path: GNU_PREPARATION_OPERATION_PATH, sourceContext: 'UNQUALIFIED',
    sourceInputPins: { operation: OPERATION_PIN, sources: SOURCE_PINS, transforms: graphPins, acceptedGnuData: DATA_PIN,
      input: GNU_PREPARATION_INPUT }, repoCapture: { ...repoCapture }, acceptedDataCapture: { ...dataCapture },
    collectionCounts: { ...counts }, sourceAccountingComplete, stageAccountingComplete,
    archiveAccountingComplete: counts.completedCorePasses === 1,
    archiveCountersScope: 'completed private core results; failed-pass bytes remain unaccounted, not zero',
    descriptorScope: 'source peak1; collection publisher2 +archive2 +stage2, aggregate peak at most6',
    startupAssumptions: 'ordinary trusted Node builtins, runtime, process startup and module loader; not I/O isolation',
    realArchiveInspected: status !== 'STOP' && !mockOnly, ...FLAGS });
  try {
    guard(10000);
    const rawOperation = capture(OPERATION_PATH, OPERATION_PIN, deps.fs, repoCapture, 1048576, guard);
    const old = await deps.moduleImporter(uri(rawOperation)); guard(10000);
    const src = own(old, 'splitToolchainEvidenceOperationSource');
    sameData(snapshot(own(src, 'rows')), SOURCE_ROWS);
    for (const name of ['transformTar', 'transformCore', 'replaceOnce', 'link', 'descriptorFor', 'coreLimits']) fn(src, name);
    const sources = new Map();
    for (const [key, path] of SOURCE_ROWS) sources.set(key, capture(path, SOURCE_PINS[key], deps.fs, repoCapture, 1048576, guard));
    if (repoCapture.readBytes !== 301950 || repoCapture.requestedBytes !== 301965 || repoCapture.closes !== 15 ||
      repoCapture.eofChecks !== 15 || repoCapture.completedCaptures !== 15 || repoCapture.ownedFds !== 0) fail('E_CLOSE');
    const graph = buildGraph(sources, src); admitGraph(graph); graphPins = graph.pins; guard(10000);
    const helper = await deps.moduleImporter(graph.collectorUri); guard(10000);
    const stage = await deps.moduleImporter(graph.stageUri); guard(10000);
    const writer = await deps.moduleImporter(graph.writerUri); guard(10000);
    const core = await deps.moduleImporter(graph.coreUri); guard(10000);
    sameData(snapshot(own(core, 'GNU_SDK_DESCRIPTOR')), src.descriptorFor(GNU_PREPARATION_INPUT));
    sameData(snapshot(own(core, 'GNU_SDK_LIMITS')), src.coreLimits('gnu'));
    fn(core, 'runGnuSdkInventory'); fn(helper, 'SOURCE_CREATE_GNU_PREPARATION'); fn(helper, 'SOURCE_GNU_TAR');
    fn(stage, 'verifyStagedXzImages'); fn(stage, 'assertNoSystemPreload');
    sameData(snapshot(own(writer, 'SPLIT_EVIDENCE_PARTS')), [PART]);
    sameData(snapshot(own(writer, 'SPLIT_EVIDENCE_PATHS')), { [PART]: GNU_PREPARATION_OPERATION_PATH });
    sameData(snapshot(own(writer, 'SPLIT_EVIDENCE_PUBLICATION_LIMITS')), own(src, 'writerLimits'));
    fn(writer, 'reserveSplitEvidencePublication');
    const xz = JSON.parse(sources.get('xzReceipt').toString('utf8'));
    if (xz.status !== 'FINITE_XZ_PROFILE_OBSERVED' || xz.counts.spawnEvents !== 33 ||
      xz.fixtureManifestSha256 !== '632a0d812366712ae99ce2ce442ad98a59534430640184f70af53df58656b4ea') fail('E_RECEIPT');
    sourceAccountingComplete = true; guard(10000);
    try { publisher = writer.reserveSplitEvidencePublication(PART, () => guard()); }
    catch (failure) { if (codeOf(failure) === 'E_PUBLICATION_CLOSE') publicationReservationUncertain = true; throw failure; }
    for (const name of ['publish', 'abort', 'snapshot']) fn(publisher, name);
    const reserved = snapshot(publisher.snapshot(), 16384, guard);
    if (reserved.part !== PART || reserved.phase !== 'RESERVED' || reserved.ownedFDCount !== 2 || reserved.created !== true ||
      reserved.sealed !== false || reserved.error !== null || reserved.closeFailed !== false || reserved.cleanupUncertain !== false ||
      reserved.counts.writtenBytes !== 0) fail('E_PUBLICATION_RECORD');
    const acceptedBytes = capture(DATA_PATH, DATA_PIN, deps.fs, dataCapture, 4194304, guard);
    if (dataCapture.readBytes !== 2829942 || dataCapture.requestedBytes !== 2829943 || dataCapture.closes !== 1 ||
      dataCapture.eofChecks !== 1 || dataCapture.completedCaptures !== 1 || dataCapture.ownedFds !== 0) fail('E_CLOSE');
    const accepted = acceptedRole(JSON.parse(acceptedBytes.toString('utf8')), guard); guard(10000);
    collector = helper.SOURCE_CREATE_GNU_PREPARATION();
    for (const name of METHODS) fn(collector, name);
    collector.beginToolchainEvidenceBatch(); guard();
    const acceptedState = (n, current = null) => {
      const state = snapshot(collector.snapshotToolchainEvidenceBatch(), 16384, guard);
      if (state.part !== 'gnu' || state.state !== 'ACTIVE' || state.mockOnly !== false || state.acceptedRoles !== n ||
        state.currentRole !== current || state.entries !== counts.entries || state.expandedBytes !== counts.expandedBytes ||
        !['metadataBytes', 'manifestBytes', 'capturedBytes', 'selectedPayloads', 'activeBufferBytes', 'activeBodyHashes'].every(key =>
          Number.isSafeInteger(state[key]) && state[key] >= 0) || state.metadataBytes > 8388608 || state.manifestBytes > 9446 ||
        state.capturedBytes > 12234 || state.selectedPayloads > 3 || state.activeBufferBytes !== 0 || state.activeBodyHashes !== 0) fail('E_COLLECTION');
    };
    acceptedState(0);
    const gate = () => {
      guard(); stageAccountingComplete = false;
      const checked = snapshot(stage.verifyStagedXzImages(xz.staged), 16384, guard), c = checked.counters;
      if (![c.fsCalls, c.readBytes, c.closeAttempts].every(n => Number.isSafeInteger(n) && n >= 0) ||
        c.closeAttempts !== 5 || c.fsCalls > 1024 || c.readBytes !== 2758216) fail('E_RECEIPT');
      counts.stageChecks++; counts.stageFsCalls += c.fsCalls; counts.stageReadBytes += c.readBytes; counts.stageCloses += c.closeAttempts;
      if (stage.assertNoSystemPreload() !== true) fail('E_PRELOAD');
      counts.preloadChecks++; stageAccountingComplete = true;
      if (counts.stageChecks > 2 || counts.preloadChecks > 2 || counts.stageCloses > 10) fail('E_LIMIT');
      guard(); return { stagedImagesVerified: true, preloadAbsent: true, ordinaryProfileObserved: true };
    };
    if (300000 - (guard() - started) < 150000) fail('E_DEADLINE');
    roleStarted = last;
    collector.beginToolchainEvidenceRole('gnu-sdk'); acceptedState(0, 'gnu-sdk');
    let attempts = 0, childCode = null, childSignal = null;
    const coreDeps = { fs: deps.fs, now: deps.now, beforeDecode: gate, afterDecode: gate,
      setTimeout: deps.setTimeout, clearTimeout: deps.clearTimeout,
      spawn(...args) {
        guard(); attempts++; counts.spawnAttempts++;
        if (attempts !== 1 || counts.ownedChildren !== 0) fail('E_LIMIT');
        if (args.length !== 3 || args[0] !== DECODER + '/ld-linux-x86-64.so.2') fail('E_SPAWN');
        sameData(snapshot(args[1]), ['--inhibit-cache', '--glibc-hwcaps-mask', '', '--library-path', DECODER,
          DECODER + '/xz', '--decompress', '--stdout', '--format=xz', '--threads=1', '--memlimit-decompress=16777216', '--', '-']);
        sameData(snapshot(args[2]), { cwd: DECODER, env: { LC_ALL: 'C', LANG: 'C', TZ: 'UTC' }, shell: false,
          stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
        const child = deps.spawn(...args);
        counts.ownedChildren++; counts.peakChildren = Math.max(counts.peakChildren, counts.ownedChildren);
        child.once('spawn', () => { counts.spawnEvents++; });
        child.once('close', (code, signal) => { childCode = code; childSignal = signal; counts.ownedChildren--; counts.childCloses++; });
        return child;
      } };
    const raw = await core.runGnuSdkInventory(GNU_PREPARATION_INPUT.identity, coreDeps); guard();
    const value = snapshot(raw, 4194304, guard);
    if (value.state !== 'GNU_SDK_DATA_INVENTORY' || value.mockOnly !== false || value.archiveBytes !== 102296280 ||
      value.archiveSha256 !== GNU_PREPARATION_INPUT.archiveSha256 || value.archivePasses !== 2 || value.archiveDataBytes !== 204592560 ||
      value.archiveRequestedBytes !== 204592562 || value.closeAttempts !== 2 || value.exitCode !== 0 || value.signal !== null ||
      attempts !== 1 || counts.spawnEvents !== 1 || counts.ownedChildren !== 0 || counts.childCloses !== 1 || childCode !== 0 || childSignal !== null ||
      counts.stageChecks !== 2 || counts.preloadChecks !== 2 || counts.stageCloses !== 10 || counts.stageReadBytes !== 5516432 ||
      !['stdinFinished', 'stdoutEnded', 'stderrEnded', 'closeObserved'].every(key => value[key] === true) ||
      !['extracted', 'extractionAuthorized', 'pythonFreeSubsetVerified', 'installedUsability', 'nativeQualified', 'decoderQualified',
        'rustReady', 'trainingReady', 'provenanceVerified', 'hardRssBounded', 'processTreeBounded', 'hardDeadlineGuaranteed'].every(key => value[key] === false) ||
      value.expandedBytes !== 505333760 || value.inventory?.entries !== 8412 || value.inventory?.headers !== 10181 ||
      value.inventory?.metadataSha256 !== OFFSET_SHA || !Number.isSafeInteger(value.streamEvents) || value.streamEvents < 0 || value.streamEvents > 262144) fail('E_RECEIPT');
    collector.acceptToolchainEvidenceRole(raw);
    publicationStarted = guard(); roleStarted = null;
    counts.completedCorePasses = 1; counts.archivePasses = 2; counts.archiveDataBytes = value.archiveDataBytes;
    counts.archiveRequestedBytes = value.archiveRequestedBytes; counts.archiveCloseAttempts = value.closeAttempts;
    counts.expandedBytes = value.expandedBytes; counts.entries = value.inventory.entries; counts.streamEvents = value.streamEvents;
    guard(); acceptedState(1);
    const collection = collector.finishToolchainEvidenceBatch();
    safeJson(collection, 16777216, guard, true);
    const preparation = validateCollection(collection, accepted, guard); guard();
    const text = safeJson({ ...base('GNU_PREPARATION_EVIDENCE_DATA'), collection, ...preparation }, 16777216, guard);
    const bytes = Buffer.from(text, 'ascii'), hash = sha(bytes); guard();
    const record = snapshot(publisher.publish(bytes), 16384, guard);
    const state = snapshot(publisher.snapshot(), 16384, guard); publicationCounts = state.counts;
    validatePublication(record, state, bytes.length, hash); guard();
    const compact = safeJson({ ...base('GNU_PREPARATION_EVIDENCE_DATA'), publicationAccepted: true,
      byteLength: bytes.length, sha256: hash, mode: '0444', readbackVerified: true, directorySynced: true,
      publicationCounts, publicationFileMetadata: record.fileMetadata,
      headerCount: 150, headerBytes: 2907751, selectedTextBytes: 12234, totalTextCaptures: 5 }, 65536, guard);
    guard(); return Object.freeze({ exitCode: 0, text: compact });
  } catch (failure) {
    error = codeOf(failure);
    if (collector) {
      try {
        const detail = collector.getToolchainEvidenceFailure();
        if (detail) {
          const value = snapshot(detail);
          diagnostic = { code: codeOf({ code: value.code }), role: value.role === 'gnu-sdk' ? 'gnu-sdk' : null,
            path: null, kind: null, index: null, underlyingCode: null };
        }
      } catch { diagnostic = null; }
    }
    if (publisher) {
      try {
        const aborted = snapshot(publisher.abort()); publicationCounts = aborted.counts;
        if (aborted.closeFailed !== false || aborted.cleanupUncertain !== false) { error = 'E_PUBLICATION_CLOSE'; abortUncertain = true; }
        const state = snapshot(publisher.snapshot());
        if (state.ownedFDCount !== 0 || state.closeFailed !== false || state.cleanupUncertain !== false) { error = 'E_PUBLICATION_CLOSE'; abortUncertain = true; }
      } catch { error = 'E_PUBLICATION_ABORT'; abortUncertain = true; }
    }
    if (collector) {
      try { collector.abortToolchainEvidenceBatch(); }
      catch { if (!abortUncertain) error = 'E_COLLECTION_ABORT'; abortUncertain = true; }
    }
  }
  return Object.freeze({ exitCode: 1, text: safeJson({ ...base('STOP'), publicationAccepted: false, error,
    diagnostic, publicationCounts, abortUncertain: abortUncertain || publicationReservationUncertain,
    publicationReservationUncertain }, 65536) });
}
export const gnuPreparationEvidenceOperationSource = Object.freeze({ rows: SOURCE_ROWS, sourcePins: SOURCE_PINS,
  operationPin: OPERATION_PIN, operationPath: OPERATION_PATH, dataPin: DATA_PIN, dataPath: DATA_PATH,
  graphPins: GRAPH_PINS, expected: EXPECTED, offsetSha256: OFFSET_SHA, flags: FLAGS, fields: FIELDS,
  collectorAppend: COLLECTOR_APPEND, dispatch: DISPATCH, newDispatch: NEW_DISPATCH, sdkAppend: SDK_APPEND,
  headerPrefix: HEADER_PREFIX, pluginPrefix: PLUGIN_PREFIX, buildGraph, admitGraph, capture, captureCounts,
  inspectPreparationText, validateMembers, headerLedger, validateCollection, validatePublication, safeJson,
  acceptedRole, freeze, pinOf });
