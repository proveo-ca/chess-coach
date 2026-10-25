// SPEC: _spec/tooling/native-ingress/step2.puml
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawn as nodeSpawn } from 'node:child_process';
import { types } from 'node:util';

const REPO = '/tmp/opencode/f9-bootstrap-correspondence';
const DECODER = '/tmp/opencode/f9-xz-qualification-01';
const fail = code => { throw Object.freeze(Object.assign(new Error(code), { code })); };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const uri = bytes => 'data:text/javascript;base64,' + Buffer.from(bytes).toString('base64');
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
const fn = (value, key) => {
  const method = own(value, key);
  if (typeof method !== 'function' || types.isProxy(method)) fail('E_COMPONENT');
  return method;
};
function exact(value, keys) {
  if (!value || typeof value !== 'object' || types.isProxy(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value)) ||
    Reflect.ownKeys(value).length !== keys.length || Reflect.ownKeys(value).some(key => !keys.includes(key))) fail('E_INPUT');
  for (const key of keys) own(value, key, 'E_INPUT');
}
const pins = rows => freeze(Object.fromEntries(rows.map(([key, bytes, sha256]) => [key, { bytes, sha256 }])));
export const RUST_HELPER_PATH = REPO + '/_spec/tooling/native-ingress/rust-helper-evidence-v1.result.json';
export const RUST_HELPER_LIMITS = freeze({ sourceMs: 10000, totalMs: 300000, roleMs: 120000, workMs: 117000,
  cleanupMs: 3000, publicationMs: 30000, admissionMs: 150000, sourceBytes: 1048576, sourceFsOperations: 8192,
  sourceReadsPerFile: 128, dataBytes: 16777216, receiptBytes: 65536, payloadBytes: 8388608, selectedBytes: 6995632,
  aggregateSelectedBytes: 25165824 });
export const RUST_HELPER_BOOTSTRAP_PINS = pins([
  ['oldOperation', 58904, 'e956352c591ae060759e00e69c83c68217269703852afb67172d06a6c14ca062'],
  ['acceptedRustc', 83556, '2a2d410012e7b56be1cfaabaf8fb71823127b8b7826bc230d998f615184df3aa'],
]);
export const RUST_HELPER_SOURCE_PINS = pins([
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
]);
export const RUST_HELPER_TARGETS = freeze([
  { artifactRole: 'rustc', path: 'rustc-1.95.0-x86_64-unknown-linux-gnu/rustc/lib/rustlib/x86_64-unknown-linux-gnu/bin/wasm-component-ld',
    index: 28, bodyOffset: 14370304, size: 5156664, expectedSha256: 'e98e7723010374a083dc08d26037050a103fe76040f08ccc17087bb38cc32adc',
    kind: 'ELF_EXEC_DSO', domain: 'HOST', optionalForMinimalC: false, selectionRole: 'RUST_SUPPLEMENTAL_HELPER_CANDIDATE', maxBytes: 8388608 },
  { artifactRole: 'rustc', path: 'rustc-1.95.0-x86_64-unknown-linux-gnu/rustc/libexec/rust-analyzer-proc-macro-srv',
    index: 63, bodyOffset: 400383488, size: 1557840, expectedSha256: '5ac4ddb2aaddef127a5a4d800494ea5a1d7599d7cc490992e8c020af2a1e9b29',
    kind: 'ELF_EXEC_DSO', domain: 'HOST', optionalForMinimalC: false, selectionRole: 'RUST_SUPPLEMENTAL_HELPER_CANDIDATE', maxBytes: 8388608 },
  { artifactRole: 'rustc', path: 'rustc-1.95.0-x86_64-unknown-linux-gnu/rustc/lib/rustlib/x86_64-unknown-linux-gnu/bin/rust-objcopy',
    index: 70, bodyOffset: 402025472, size: 281128, expectedSha256: '211b1e47ef0078d91f33d5076e958bf40a65b0f634d59c9802f0b049b9662728',
    kind: 'ELF_EXEC_DSO', domain: 'HOST', optionalForMinimalC: false, selectionRole: 'RUST_SUPPLEMENTAL_HELPER_CANDIDATE', maxBytes: 8388608 },
]);
const EXPECTATION = freeze({ role: 'rustc', expandedBytes: 402308096, entries: 70, headers: 71, regularFiles: 53,
  decodedSha256: '08c25740ad1acbcdf84625b6f05b316f994cba94efdb4f262749b5bbad7e0cc0',
  metadataSha256: '9a00ed58e31abdede8d8acfc74bd92e3afdb3fc3089a220f63b680830a8b471f', metadataHashKind: 'OFFSET_EVENT_METADATA' });
const ROOT_IDENTITY = freeze({ dev: '28', ino: '13954', mode: '16832', uid: '1000', gid: '1000', nlink: '2',
  size: '4096', mtimeNs: '1792857301045485610', ctimeNs: '1792857301045485610' });
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
const BOOTSTRAP_ROWS = freeze([
  ['oldOperation', REPO + '/tooling/native-ingress/rust-archive-evidence-operation.mjs'],
  ['acceptedRustc', REPO + '/_spec/tooling/native-ingress/rust-archive-rustc-v1.result.json'],
]);
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
const SDK_APPEND = '\nexport const SOURCE_FORMAT_INSPECTORS = Object.freeze({rel,archive,linker});\n';
const COLLECTOR_APPEND = `
export const SOURCE_HELPER_PROFILE = freeze({
  part: 'rust', mockOnly: false,
  inputs: SPLIT_TOOLCHAIN_EVIDENCE_INPUTS.rust.filter(input => input.role === 'rustc'),
  expectations: SPLIT_TOOLCHAIN_EVIDENCE_EXPECTATIONS.rust.filter(expected => expected.role === 'rustc'),
  targets: ${JSON.stringify(RUST_HELPER_TARGETS)},
  limits: { ...SPLIT_TOOLCHAIN_EVIDENCE_LIMITS, maxPayloadBytes: 8388608, maxElfSnapshotBytes: 8388608 },
});
let SOURCE_HELPER_INSTANCE = null;
export function SOURCE_CREATE_HELPERS() {
  if (arguments.length !== 0) fail('E_EVIDENCE_INPUT');
  if (SOURCE_HELPER_INSTANCE !== null) fail('E_EVIDENCE_STATE');
  SOURCE_HELPER_INSTANCE = collector(SOURCE_HELPER_PROFILE, {
    parserFactory: originalCreateTarInventory, elfInspector: inspectElf64RequirementsV5, formatInspectors: SOURCE_FORMAT_INSPECTORS,
  });
  return SOURCE_HELPER_INSTANCE;
}
export const SOURCE_RUSTC_TAR = limits => SOURCE_HELPER_INSTANCE.createTarInventory(limits);
`;
const WRITER_PARTS = "export const SPLIT_EVIDENCE_PARTS = Object.freeze(['gnu', 'rust']);";
const WRITER_PATHS = "export const SPLIT_EVIDENCE_PATHS = Object.freeze({\n" +
  "  gnu: '/tmp/opencode/f9-bootstrap-correspondence/_spec/tooling/native-ingress/gnu-evidence-collection-v1.result.json',\n" +
  "  rust: '/tmp/opencode/f9-bootstrap-correspondence/_spec/tooling/native-ingress/rust-evidence-collection-v1.result.json',\n});";
export const RUST_HELPER_GRAPH_PINS = pins([
  ['eventTar', 15595, 'bf8c7fcc56c26aa0618c014d74046dc29b79c09340728b27dd0363a758b9ef9a'],
  ['appendedSdk', 31647, '22be684fb42feecbf6ac629f8e1fbf310bb31635325a9d1dc5a9e81fd75ee3b8'],
  ['tarLinkedSdk', 52452, '60931c3c8ba2b491ecdac39e4b0106da55fe312ecd9164fb3086909695d9fef2'],
  ['linkedSdk', 79779, 'aeeafd8124729ef1ee3d54787c40249a6740796ae806a8d97d370e042690d2f2'],
  ['linkedStage', 43154, '89b6c5e3dcbf902937f81fc642d7238bd4ec4ca3c94f6b61f4d069efdce8c5f2'],
  ['appendedCollector', 51601, 'fb21a9237e2c4470536b3121482a0bd29a3239c029797672a26824d334a3da0e'],
  ['tarLinkedCollector', 72406, 'f898cfc5740e3d0af4b0d08207f181ba268a4f3a01b4bb0e6c3f6524c4bb46bc'],
  ['elfLinkedCollector', 101477, '23e14eb9a45f4ef9dcaad6370d2c91b7cc1b1d9929996d0e476b2cd150597f62'],
  ['linkedCollector', 207849, '73272d3d5238f2b6d124c7ae8bb434d42e7c80b0eb3ab02d4fe91e61fe815cbd'],
  ['writerParts', 18003, 'f0613ce54fbc83017e3c5769d22856b3272865df2dd4d27f3a5af576ec47032a'],
  ['linkedWriter', 17887, '5fdf5d068ce7d0233d2fff4f3239fc22c26a79644bd356214cbb12b8ed27f242'],
  ['rustc:linkedCore', 299683, '663fa6767bbd1229392c9a2e412e2d783590361189f327230bc88e6849298bee'],
  ['rustc:descriptor', 23275, 'f454d03eb05e38c6d6cbf35b0ac6e7d124fa35d67ce571e3809c2ec7a57e2920'],
  ['rustc:events', 23276, '71384fb84fa026ed0abe85a89245280a47987eec1551ccf6f523d14df061f827'],
  ['rustc:summary', 23278, '627e57d83cffcb23e95c37a2f538848a042458cbdb3d340aed7aca615c927576'],
  ['rustc:selectors', 22521, '627f2bdb9a5a114aed22481400cc72ad5cae754e2250342ece49e1ff0687daca'],
  ['rustc:memory', 22522, '9012b1688c887219713352b3830f2284392f3ef3fb6b7c7a9c36693618350b2f'],
  ['rustc:parserBinding', 22542, 'f023527820fef6a86524d215f75abb5cadeb4bef009aefd29613cbbfdfe785cc'],
]);
function prepareGraph(src, sources) {
  const outputs = {}, imagePins = {};
  for (const [key] of SOURCE_ROWS) src.pinned(sources.get(key), RUST_HELPER_SOURCE_PINS[key]);
  const checked = (key, bytes) => {
    outputs[key] = src.pinned(bytes, RUST_HELPER_GRAPH_PINS[key]);
    imagePins[key] = RUST_HELPER_GRAPH_PINS[key]; return outputs[key];
  };
  const tar = checked('eventTar', src.transformTar(sources.get('rawTar'))), tarUri = uri(tar);
  const sdk1 = checked('appendedSdk', Buffer.concat([sources.get('sdk'), Buffer.from(SDK_APPEND)]));
  const sdk2 = checked('tarLinkedSdk', src.link(sdk1, 'tar-inventory', tarUri));
  const sdk = checked('linkedSdk', src.link(sdk2, 'elf-requirements-v3', uri(sources.get('elfV3'))));
  const helper0 = checked('appendedCollector', Buffer.concat([sources.get('collector'), Buffer.from(COLLECTOR_APPEND)]));
  const helper1 = checked('tarLinkedCollector', src.link(helper0, 'tar-inventory', tarUri));
  const helper2 = checked('elfLinkedCollector', src.link(helper1, 'elf-requirements-v5', uri(sources.get('elfV5'))));
  const helper = checked('linkedCollector', src.link(helper2, 'sdk-payload-inspection', uri(sdk))), collectorUri = uri(helper);
  const stage = checked('linkedStage', src.link(sources.get('stage'), 'elf-metadata', uri(sources.get('elfMetadata'))));
  const parts = checked('writerParts', Buffer.from(src.replaceOnce(sources.get('writer').toString(), WRITER_PARTS,
    "export const SPLIT_EVIDENCE_PARTS = Object.freeze(['rust-helper']);")));
  const writer = checked('linkedWriter', Buffer.from(src.replaceOnce(parts.toString(), WRITER_PATHS,
    'export const SPLIT_EVIDENCE_PATHS = Object.freeze(' + JSON.stringify({ 'rust-helper': RUST_HELPER_PATH }, null, 2) + ');')));
  const core0 = src.transformCore(sources.get('rawCore'), 'rustc', (name, bytes) => checked('rustc:' + name, bytes));
  const core = checked('rustc:linkedCore', src.link(core0, 'tar-inventory', collectorUri));
  return { outputs, pins: freeze(imagePins), collectorUri, stageUri: uri(stage), writerUri: uri(writer), coreUri: uri(core), sdkUri: uri(sdk) };
}
const FIELDS = freeze(['dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtimeNs', 'ctimeNs']);
function captureCounts() {
  return { fsCalls: 0, rootChecks: 0, namedChecks: 0, fdChecks: 0, openAttempts: 0, readAttempts: 0,
    requestedBytes: 0, readBytes: 0, closeAttempts: 0, closes: 0, completedCaptures: 0,
    allocations: 0, allocatedBytes: 0, ownedFds: 0, peakOwnedFds: 0 };
}
function bootstrapCapture(key, io, counts, guard) {
  const row = BOOTSTRAP_ROWS.find(value => value[0] === key), pin = RUST_HELPER_BOOTSTRAP_PINS[key];
  if (!row || !pin) fail('E_SOURCE_PIN');
  const path = row[1]; let owned = null, bytes;
  const call = (method, ...args) => {
    guard(10000);
    if (counts.fsCalls + 1 + Number(owned !== null) > 8192) fail('E_LIMIT');
    counts.fsCalls++; let result;
    try { result = io[method](...args); } catch { fail('E_IO'); }
    guard(10000); return result;
  };
  const stat = (method, target, directory, size = null) => {
    counts[method === 'fstatSync' ? 'fdChecks' : target === REPO ? 'rootChecks' : 'namedChecks']++;
    const raw = call(method, target, { bigint: true }), value = {};
    for (const field of FIELDS) {
      const n = own(raw, field, 'E_METADATA');
      if (typeof n !== 'bigint' || n < 0n && !field.endsWith('Ns')) fail('E_METADATA');
      value[field] = n;
    }
    if ((value.mode & 0o170000n) !== (directory ? 0o040000n : 0o100000n) || value.ino <= 0n ||
      !directory && value.nlink !== 1n || size !== null && value.size !== BigInt(size)) fail('E_SOURCE_PIN');
    return value;
  };
  const same = (a, b) => { if (!FIELDS.every(key => a[key] === b[key])) fail('E_BINDING'); };
  try {
    const c = fs.constants;
    if (c.O_RDONLY !== 0 || ![c.O_NOFOLLOW, c.O_NONBLOCK].every(n => Number.isInteger(n) && n > 0)) fail('E_PREREQUISITE');
    const root = stat('lstatSync', REPO, true), named = stat('lstatSync', path, false, pin.bytes);
    guard(10000); if (counts.fsCalls + 2 > 8192) fail('E_LIMIT');
    counts.fsCalls++; counts.openAttempts++;
    try { owned = io.openSync(path, c.O_RDONLY | c.O_NOFOLLOW | c.O_NONBLOCK); } catch { fail('E_IO'); }
    if (!Number.isSafeInteger(owned) || owned < 0) { owned = null; fail('E_IO'); }
    counts.ownedFds++; counts.peakOwnedFds = Math.max(counts.peakOwnedFds, counts.ownedFds); guard(10000);
    const bound = stat('fstatSync', owned, false, pin.bytes); same(named, bound);
    if (counts.ownedFds !== 1 || counts.allocatedBytes + pin.bytes + 1 > 1048576) fail('E_LIMIT');
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
      const length = Math.min(65536, pin.bytes - position);
      if (read(length) !== length) fail('E_LENGTH'); position += length;
    }
    if (read(1) !== 0) fail('E_LENGTH');
    same(bound, stat('fstatSync', owned, false, pin.bytes)); same(named, stat('lstatSync', path, false, pin.bytes));
    same(root, stat('lstatSync', REPO, true));
  } finally {
    if (owned !== null) {
      const fd = owned; owned = null; counts.ownedFds--; counts.closeAttempts++; counts.fsCalls++;
      try { io.closeSync(fd); counts.closes++; } catch { fail('E_CLOSE'); }
    }
  }
  guard(10000); const captured = bytes.subarray(0, pin.bytes);
  if (sha(captured) !== pin.sha256) fail('E_SOURCE_PIN');
  guard(10000); counts.completedCaptures++; return captured;
}
function sameData(src, a, b, code = 'E_COMPONENT', maximum = 8388608) {
  src.preflight(a, maximum); src.preflight(b, maximum);
  const equal = (x, y) => {
    if (x === y) return true;
    if (!x || !y || typeof x !== 'object' || typeof y !== 'object' || Array.isArray(x) !== Array.isArray(y)) return false;
    const keys = Object.keys(x).sort(), other = Object.keys(y).sort();
    return keys.length === other.length && keys.every((key, i) => key === other[i] && equal(x[key], y[key]));
  };
  if (!equal(a, b)) fail(code);
}
function compareProfile(src, helper, input, accepted) {
  const profile = own(helper, 'SOURCE_HELPER_PROFILE');
  const limits = { ...src.collectorLimits, maxPayloadBytes: 8388608, maxElfSnapshotBytes: 8388608 };
  sameData(src, profile, { part: 'rust', mockOnly: false, inputs: [input], expectations: [EXPECTATION], targets: RUST_HELPER_TARGETS, limits });
  if (input.archiveBytes !== 80351960 || input.archiveSha256 !== '8426a3d170a5879f5682f5fbdd024a1779b3951e7baba685af2d6dc32a6dfc15' ||
    input.root !== '/tmp/opencode/f9-rust-runtime-inputs-01' || input.expectedRoot !== 'rustc-1.95.0-x86_64-unknown-linux-gnu' ||
    input.file !== input.root + '/' + input.expectedRoot + '.tar.xz' || input.decoderMemoryBytes !== 268435456) fail('E_COMPONENT');
  sameData(src, input.identity.root, ROOT_IDENTITY);
  sameData(src, input.identity.file, { dev: '29', ino: '1211151', mode: '33152', uid: '1000', gid: '1000', nlink: '1',
    size: '80351960', mtimeNs: '1792857300349485612', ctimeNs: '1792857300349485612' });
  if (accepted.status !== 'RUST_ARCHIVE_EVIDENCE_DATA' || accepted.artifactRole !== 'rustc' || accepted.mockOnly !== false ||
    accepted.collection?.roles?.length !== 1) fail('E_RECEIPT');
  const role = accepted.collection.roles[0];
  for (const [key, value] of Object.entries(EXPECTATION)) if (role[key] !== value) fail('E_RECEIPT');
  if (role.members?.length !== 70 || role.members.filter(row => row.type === 'file').length !== 53 ||
    role.offsetMetadataSha256 !== EXPECTATION.metadataSha256 || role.completeNamespace !== true) fail('E_RECEIPT');
  let bytes = 0;
  for (const target of RUST_HELPER_TARGETS) {
    const member = role.members[target.index - 1];
    if (!member || member.type !== 'file' || ['path', 'index', 'size', 'bodyOffset'].some(key => member[key] !== target[key]) ||
      member.bodySha256 !== target.expectedSha256) fail('E_RECEIPT');
    bytes += target.size;
  }
  if (bytes !== 6995632 || bytes > 25165824) fail('E_LIMIT');
  return profile;
}
function validateCollection(src, collection, input) {
  const c = collection, expectedEdges = [];
  if (c.state !== 'SPLIT_TOOLCHAIN_EVIDENCE_DATA' || c.profile !== c.state || c.part !== 'rust' || c.mockOnly !== false ||
    c.artifactCount !== 1 || c.targetCount !== 3 || c.selectedPayloads !== 3 || c.entries !== 70 || c.regularFiles !== 53 ||
    c.expandedBytes !== 402308096 || c.completeNamespace !== true || c.roles?.length !== 1 || !Array.isArray(c.declaredNeededEdges)) fail('E_COLLECTION');
  const role = c.roles[0];
  for (const [key, value] of Object.entries(EXPECTATION)) if (role[key] !== value) fail('E_COLLECTION');
  if (role.archiveBytes !== input.archiveBytes || role.archiveSha256 !== input.archiveSha256 || role.expectedRoot !== input.expectedRoot ||
    role.decoderMemoryBytes !== 268435456 || role.completeNamespace !== true || role.offsetMetadataSha256 !== EXPECTATION.metadataSha256 ||
    role.inventory?.metadataSha256 !== EXPECTATION.metadataSha256 || role.members?.length !== 70 || role.selected?.length !== 3 ||
    role.manifests?.length !== 3) fail('E_COLLECTION');
  const names = new Set(); let regular = 0, bytes = 0;
  for (const [ordinal, member] of role.members.entries()) {
    if (member.index !== ordinal + 1 || typeof member.path !== 'string' || names.has(member.path) ||
      !(member.path === input.expectedRoot || member.path.startsWith(input.expectedRoot + '/')) || Buffer.byteLength(member.path) > 1024 ||
      /[\u0000-\u001f\u007f-\u009f\\]/u.test(member.path) || member.path.split('/').some(p => !p || p === '.' || p === '..') ||
      !['file', 'directory', 'hardlink', 'symlink'].includes(member.type) || !Number.isSafeInteger(member.bodyOffset) ||
      member.bodyOffset < 512 || member.bodyOffset % 512 || !Number.isSafeInteger(member.size) || member.size < 0 ||
      member.size > 402308096 - member.bodyOffset) fail('E_COLLECTION');
    names.add(member.path);
    if (member.type === 'file') { regular++; if (!/^[a-f0-9]{64}$/.test(member.bodySha256)) fail('E_COLLECTION'); }
    else if (member.size !== 0 || member.bodySha256 !== null || member.linkFollowed !== false) fail('E_COLLECTION');
  }
  if (regular !== 53) fail('E_COLLECTION');
  const selectedNames = new Set();
  for (const selected of role.selected) {
    const target = RUST_HELPER_TARGETS.find(row => row.path === selected.path), member = role.members[selected.index - 1];
    if (!target || selectedNames.has(selected.path) || !member || member.type !== 'file' || member.path !== selected.path ||
      selected.bodySha256 !== target.expectedSha256 || member.bodySha256 !== target.expectedSha256 ||
      member.size !== target.size || member.bodyOffset !== target.bodyOffset || selected.qualified !== false ||
      selected.abiVerified !== false || selected.roleSatisfied !== false || selected.hashObservation !== 'MATCHED_EXPECTED_BODY_HASH') fail('E_COLLECTION');
    for (const key of Object.keys(target)) if (selected[key] !== target[key]) fail('E_COLLECTION');
    const metadata = selected.metadata, requirements = metadata?.requirements;
    if (metadata?.state !== 'ELF_EXEC_DSO_REQUIREMENT_DATA' || metadata.qualified !== false ||
      requirements?.byteLength !== target.size || requirements.inputSha256 !== target.expectedSha256 ||
      !Array.isArray(requirements.dynamic?.needed) || requirements.dynamic.needed.length > 32 ||
      !Array.isArray(metadata.unsafeLoadingTags) || metadata.loadingTagsQualification !== 'NOT_QUALIFIED') fail('E_COLLECTION');
    for (const needed of requirements.dynamic.needed) {
      if (typeof needed !== 'string' || !needed || Buffer.byteLength(needed) > 1024) fail('E_COLLECTION');
      expectedEdges.push({ artifactRole: 'rustc', from: target.path, domain: 'HOST', needed, status: 'UNRESOLVED',
        providerQualified: false, abiVerified: false, aliasFollowed: false, hostTargetPromotion: false });
    }
    bytes += target.size; selectedNames.add(target.path);
  }
  if (bytes !== 6995632 || bytes > 25165824) fail('E_COLLECTION');
  const manifests = new Set();
  for (const manifest of role.manifests) {
    const member = role.members.find(row => row.path === manifest.path);
    if (!member || member.type !== 'file' || manifests.has(manifest.path) || manifest.bodySha256 !== member.bodySha256 ||
      typeof manifest.text !== 'string' || manifest.interpreted !== false || !Array.isArray(manifest.declarations)) fail('E_COLLECTION');
    const text = Buffer.from(manifest.text);
    if (text.length !== member.size || text.length > 1048576 || sha(text) !== manifest.bodySha256) fail('E_COLLECTION');
    manifests.add(manifest.path);
  }
  sameData(src, c.declaredNeededEdges, expectedEdges, 'E_COLLECTION');
  const r = c.resourceAccounting;
  if (!r || r.capturedBytes !== 6995632 || r.maxAdditionalElfSnapshotBytes !== 8388608 || r.peakPayloadBytes !== 5156664 ||
    r.buffersAllocated !== 6 || r.buffersErased !== 6 || r.hardRssBounded !== false ||
    !['metadataBytes', 'manifestBytes'].every(key => Number.isSafeInteger(r[key]) && r[key] >= 0) ||
    r.metadataBytes > 8388608 || r.manifestBytes > 4194304) fail('E_COLLECTION');
  sameData(src, c.constraints, { ...src.collectorLimits, maxPayloadBytes: 8388608, maxElfSnapshotBytes: 8388608 }, 'E_COLLECTION');
}
function validatePublication(src, record, snapshot, length, hash) {
  if (record.part !== 'rust-helper' || snapshot.part !== 'rust-helper' || record.state !== 'PUBLISHED_READBACK_MATCHED' ||
    record.path !== RUST_HELPER_PATH || record.byteLength !== length || record.sha256 !== hash || record.mode !== '0444' ||
    record.readbackVerified !== true || record.directorySynced !== true || snapshot.phase !== record.state || snapshot.ownedFDCount !== 0 ||
    snapshot.created !== true || snapshot.sealed !== true || snapshot.error !== null || snapshot.closeFailed !== false ||
    snapshot.cleanupUncertain !== false) fail('E_PUBLICATION_RECORD');
  sameData(src, record.counts, snapshot.counts, 'E_PUBLICATION_RECORD');
  const c = record.counts, m = record.fileMetadata;
  if (m.mode !== '33060' || m.size !== String(length) || m.nlink !== '1' || m.uid !== '1000' || m.gid !== '1000' ||
    !FIELDS.every(key => typeof m[key] === 'string' && /^-?[0-9]{1,40}$/.test(m[key])) || BigInt(m.ino) <= 0n ||
    !Object.values(c).every(n => Number.isSafeInteger(n) && n >= 0) || c.opens !== 3 || c.closeAttempts !== 3 || c.closes !== 3 ||
    c.cleanupCloseAttempts !== 0 || c.fsyncs !== 4 || c.chmods !== 1 || c.peakOwnedFDs !== 2 ||
    !['inputBytes', 'copiedBytes', 'inputHashBytes', 'writtenBytes', 'readbackBytes', 'readbackHashBytes'].every(key => c[key] === length) ||
    c.requestedReadBytes < length + 1 || c.requestedReadBytes > 16777217 || c.ownedSnapshotBytes !== 0 || c.ownedScratchBytes !== 0 ||
    c.fsOperations > 8192 || c.writeAttempts < 1 || c.writeAttempts > 4096 || c.readAttempts < 2 || c.readAttempts > 1024) fail('E_PUBLICATION_RECORD');
  for (const key of ['sourceRootAuthentication', 'ancestorRacesExcluded', 'atomicCrashCommit', 'storageFailureSurvival',
    'hardDeadlineGuaranteed', 'nativeQualified', 'abiQualified', 'authenticatedStorage']) if (record[key] !== false) fail('E_PUBLICATION_RECORD');
}
const CODES = new Set(['E_INPUT', 'E_IN_FLIGHT', 'E_SOURCE_PIN', 'E_METADATA', 'E_BINDING', 'E_IO', 'E_CLOSE', 'E_LENGTH', 'E_HASH',
  'E_PREREQUISITE', 'E_SPAWN', 'E_PIPE', 'E_DECODER', 'E_TAR', 'E_OUTPUT', 'E_DEADLINE', 'E_CLEANUP', 'E_CLOCK', 'E_LIMIT',
  'E_PRELOAD', 'E_COMPONENT', 'E_RECEIPT', 'E_COLLECTION', 'E_COLLECTION_ABORT', 'E_PUBLICATION_RECORD', 'E_PUBLICATION_ABORT',
  ...['INPUT','LIMIT','CHUNK','INSPECT','DATA','STATE','METADATA','SPAN','BODY_HASH','MANIFEST','ROOT','EVENT','TARGET',
    'MANIFEST_LIMIT','EXPANDED','ENTRIES','SUMMARY','DECODED_HASH','METADATA_HASH','CORE','OUTPUT'].map(c => 'E_EVIDENCE_' + c),
  ...['ARGUMENT','FIXTURE','LIMIT','GUARD','STATE','DIRECTORY','METADATA','BINDING','FILE','EXISTS','IO','CLOSE','BYTES','JSON',
    'WRITE','READ','HASH','EOF','ABORTED'].map(c => 'E_PUBLICATION_' + c)]);
function errorCode(error) {
  try { const code = own(error, 'code'); return CODES.has(code) ? code : 'E_COLLECTION'; } catch { return 'E_IO'; }
}
const base = mockOnly => ({ profile: 'registered-rust-helper-evidence-v1', part: 'rust', artifactRole: 'rustc',
  targetCount: 3, selectedPayloads: 3, path: RUST_HELPER_PATH, mockOnly,
  scope: 'FRESH_STATIC_HELPER_DATA_NOT_ROLE_OR_RUNTIME_QUALIFICATION', realArchiveInspected: false, ...FLAGS });
const stopped = (code, mockOnly) => Object.freeze({ exitCode: 1, text: JSON.stringify({ ...base(mockOnly), status: 'STOP',
  selectedPayloads: 0, publicationAccepted: false, error: code, failure: { role: 'rustc', path: null, kind: null, index: null } }) + '\n' });
function entries(deps, mockOnly) {
  let consumed = false, inFlight = false;
  return Object.freeze({ async runRegisteredRustHelperEvidenceV1() {
    if (arguments.length !== 0) return stopped('E_INPUT', mockOnly);
    if (inFlight) return stopped('E_IN_FLIGHT', mockOnly);
    if (consumed) return stopped('E_INPUT', mockOnly);
    consumed = true; inFlight = true;
    try { return await run(deps, mockOnly); } finally { inFlight = false; }
  } });
}
const production = entries({ fs, spawn: nodeSpawn, now: () => performance.now(), moduleImporter: target => import(target),
  setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout }, false);
export async function runRegisteredRustHelperEvidenceV1() {
  return Reflect.apply(production.runRegisteredRustHelperEvidenceV1, null, arguments);
}
// WHAT: Complete explicit fake capabilities; no native capability fallback.
export function createRustHelperEvidenceOperationFixture(config) {
  if (arguments.length !== 1) fail('E_INPUT');
  exact(config, ['mockOnly', 'fs', 'spawn', 'now', 'moduleImporter', 'setTimeout', 'clearTimeout']);
  if (own(config, 'mockOnly') !== true) fail('E_INPUT');
  const backend = own(config, 'fs'), deps = { fs: {} };
  const methods = ['lstatSync', 'openSync', 'fstatSync', 'readSync', 'closeSync', 'writeSync', 'fsyncSync', 'fchmodSync'];
  exact(backend, methods); if (backend === fs) fail('E_INPUT');
  for (const name of methods) {
    const method = fn(backend, name); if (method === fs[name]) fail('E_INPUT');
    deps.fs[name] = (...args) => Reflect.apply(method, backend, args);
  }
  for (const key of ['spawn', 'now', 'moduleImporter', 'setTimeout', 'clearTimeout']) deps[key] = fn(config, key);
  if (deps.spawn === nodeSpawn || deps.setTimeout === globalThis.setTimeout || deps.clearTimeout === globalThis.clearTimeout) fail('E_INPUT');
  return entries(deps, true);
}
async function run(deps, mockOnly) {
  const repoCapture = captureCounts(), counts = { spawnAttempts: 0, spawnEvents: 0, ownedChildren: 0, peakChildren: 0,
    childCloses: 0, stageChecks: 0, preloadChecks: 0, stageFsCalls: 0, stageReadBytes: 0, stageCloses: 0,
    completedCorePasses: 0, archivePasses: 0, archiveDataBytes: 0, archiveRequestedBytes: 0,
    archiveCloseAttempts: 0, expandedBytes: 0, streamEvents: 0, entries: 0 };
  let started, last, roleStarted = null, publicationStarted = null, collector = null, publisher = null, src = null;
  let graphPins = null, input = null, publicationCounts = null, error = null, abortUncertain = false;
  let sourceAccountingComplete = false, stageAccountingComplete = false, childCloseAccepted = false;
  function guard(limit = 300000) {
    let now; try { now = deps.now(); } catch { fail('E_CLOCK'); }
    if (!Number.isFinite(now) || last !== undefined && now < last) fail('E_CLOCK');
    if (started === undefined) started = now; last = now;
    if (!Number.isFinite(started + 300000) || started + 300000 <= started) fail('E_CLOCK');
    if (now - started >= limit || roleStarted !== null && now - roleStarted >= 120000 ||
      publicationStarted !== null && now - publicationStarted >= 30000) fail('E_DEADLINE');
    return now;
  }
  const snapshot = (value, maximum = 16384, check = guard) => JSON.parse(src.asciiJson(value, maximum, check));
  const envelope = status => ({ ...base(mockOnly), status, selectedPayloads: status === 'STOP' ? 0 : 3,
    realArchiveInspected: status !== 'STOP' && !mockOnly, sourceInputPins: { bootstrap: RUST_HELPER_BOOTSTRAP_PINS,
      sources: RUST_HELPER_SOURCE_PINS, transforms: graphPins, input }, repoCapture: { ...repoCapture },
    collectionCounts: { ...counts }, sourceAccountingComplete, stageAccountingComplete,
    archiveAccountingComplete: counts.completedCorePasses === 1,
    archiveCountersScope: 'completed private core results; failed-pass bytes remain unaccounted, not zero',
    descriptorScope: 'source peak1; collection publisher2 +archive2 +stage2, aggregate peak at most6',
    startupAssumptions: 'trusted Node builtins, module loader, runtime and process startup; not I/O isolation' });
  try {
    guard(10000);
    const oldBytes = bootstrapCapture('oldOperation', deps.fs, repoCapture, guard);
    const old = await deps.moduleImporter(uri(oldBytes)); guard(10000);
    const utility = own(old, 'rustArchiveEvidenceOperationSource');
    for (const name of ['pinned', 'replaceOnce', 'link', 'preflight', 'asciiJson', 'captureSource', 'transformTar',
      'transformCore', 'descriptorFor', 'coreLimits']) fn(utility, name);
    sameData(utility, own(old, 'RUST_ARCHIVE_SOURCE_PINS'), RUST_HELPER_SOURCE_PINS);
    sameData(utility, own(utility, 'rows'), SOURCE_ROWS); src = utility;
    const acceptedBytes = bootstrapCapture('acceptedRustc', deps.fs, repoCapture, guard);
    const accepted = JSON.parse(acceptedBytes.toString('utf8')), sources = new Map();
    const allowed = new Set([REPO, ...SOURCE_ROWS.map(row => row[1])]), sourceFds = new Set();
    const sourceIo = {
      lstatSync(path, ...args) { if (!allowed.has(path)) fail('E_INPUT'); return deps.fs.lstatSync(path, ...args); },
      openSync(path, ...args) {
        if (!allowed.has(path) || path === REPO || sourceFds.size) fail('E_INPUT');
        const fd = deps.fs.openSync(path, ...args); sourceFds.add(fd); return fd;
      },
      fstatSync(fd, ...args) { if (!sourceFds.has(fd)) fail('E_INPUT'); return deps.fs.fstatSync(fd, ...args); },
      readSync(fd, ...args) { if (!sourceFds.has(fd)) fail('E_INPUT'); return deps.fs.readSync(fd, ...args); },
      closeSync(fd) { if (!sourceFds.delete(fd)) fail('E_INPUT'); return deps.fs.closeSync(fd); },
    };
    for (const [key] of SOURCE_ROWS) sources.set(key, src.captureSource(key, sourceIo, repoCapture, guard));
    if (repoCapture.ownedFds !== 0 || repoCapture.closes !== 16 || repoCapture.completedCaptures !== 16 ||
      repoCapture.readBytes !== 383472 || repoCapture.requestedBytes !== 383488 || repoCapture.allocatedBytes !== 383488 ||
      repoCapture.peakOwnedFds !== 1) fail('E_CLOSE');
    const xz = JSON.parse(sources.get('xzReceipt').toString());
    if (xz.status !== 'FINITE_XZ_PROFILE_OBSERVED' || xz.counts.spawnEvents !== 33 ||
      xz.fixtureManifestSha256 !== '632a0d812366712ae99ce2ce442ad98a59534430640184f70af53df58656b4ea') fail('E_RECEIPT');
    guard(10000); const graph = prepareGraph(src, sources); graphPins = graph.pins; guard(10000);
    const helper = await deps.moduleImporter(graph.collectorUri); guard(10000);
    const stage = await deps.moduleImporter(graph.stageUri); guard(10000);
    const writer = await deps.moduleImporter(graph.writerUri); guard(10000);
    const core = await deps.moduleImporter(graph.coreUri); guard(10000);
    input = own(own(old, 'RUST_ARCHIVE_INPUTS'), 'rustc'); compareProfile(src, helper, input, accepted);
    sameData(src, own(core, 'GNU_SDK_DESCRIPTOR'), src.descriptorFor(input));
    sameData(src, own(core, 'GNU_SDK_LIMITS'), src.coreLimits()); fn(core, 'runGnuSdkInventory');
    sameData(src, own(writer, 'SPLIT_EVIDENCE_PARTS'), ['rust-helper']);
    sameData(src, own(writer, 'SPLIT_EVIDENCE_PATHS'), { 'rust-helper': RUST_HELPER_PATH });
    sameData(src, own(writer, 'SPLIT_EVIDENCE_PUBLICATION_LIMITS'), src.writerLimits);
    fn(stage, 'verifyStagedXzImages'); fn(stage, 'assertNoSystemPreload');
    fn(writer, 'reserveSplitEvidencePublication'); fn(helper, 'SOURCE_CREATE_HELPERS'); fn(helper, 'SOURCE_RUSTC_TAR');
    guard(10000); sourceAccountingComplete = true;
    try { publisher = writer.reserveSplitEvidencePublication('rust-helper', () => guard()); }
    catch (failure) { if (errorCode(failure) === 'E_PUBLICATION_CLOSE') abortUncertain = true; throw failure; }
    for (const name of ['publish', 'abort', 'snapshot']) fn(publisher, name);
    const reserved = snapshot(publisher.snapshot());
    if (reserved.part !== 'rust-helper' || reserved.phase !== 'RESERVED' || reserved.ownedFDCount !== 2 || reserved.created !== true ||
      reserved.sealed !== false || reserved.error !== null || reserved.closeFailed !== false || reserved.cleanupUncertain !== false ||
      reserved.counts.writtenBytes !== 0) fail('E_PUBLICATION_RECORD');
    collector = helper.SOURCE_CREATE_HELPERS();
    for (const name of ['beginToolchainEvidenceBatch', 'beginToolchainEvidenceRole', 'createTarInventory', 'acceptToolchainEvidenceRole',
      'finishToolchainEvidenceBatch', 'abortToolchainEvidenceBatch', 'getToolchainEvidenceFailure', 'snapshotToolchainEvidenceBatch']) fn(collector, name);
    const acceptedState = (acceptedRoles, currentRole = null) => {
      const value = snapshot(collector.snapshotToolchainEvidenceBatch());
      if (value.part !== 'rust' || value.state !== 'ACTIVE' || value.mockOnly !== false || value.acceptedRoles !== acceptedRoles ||
        value.currentRole !== currentRole || value.entries !== counts.entries || value.expandedBytes !== counts.expandedBytes ||
        !['metadataBytes', 'manifestBytes', 'capturedBytes', 'selectedPayloads', 'activeBufferBytes', 'activeBodyHashes'].every(key =>
          Number.isSafeInteger(value[key]) && value[key] >= 0) || value.metadataBytes > 8388608 || value.manifestBytes > 4194304 ||
        value.capturedBytes > 6995632 || value.selectedPayloads > 3 || value.activeBufferBytes !== 0 || value.activeBodyHashes !== 0 ||
        acceptedRoles === 1 && (value.capturedBytes !== 6995632 || value.selectedPayloads !== 3)) fail('E_COLLECTION');
    };
    collector.beginToolchainEvidenceBatch(); guard(); acceptedState(0);
    const gate = () => {
      guard(); stageAccountingComplete = false;
      const checked = snapshot(stage.verifyStagedXzImages(xz.staged)), c = checked.counters;
      if (![c.fsCalls, c.readBytes, c.closeAttempts].every(n => Number.isSafeInteger(n) && n >= 0) ||
        c.closeAttempts !== 5 || c.fsCalls > 1024 || c.readBytes !== 2758216) fail('E_RECEIPT');
      counts.stageChecks++; counts.stageFsCalls += c.fsCalls; counts.stageReadBytes += c.readBytes; counts.stageCloses += c.closeAttempts;
      stageAccountingComplete = true;
      if (stage.assertNoSystemPreload() !== true) fail('E_PRELOAD'); counts.preloadChecks++;
      if (counts.stageChecks > 2 || counts.preloadChecks > 2 || counts.stageCloses > 10) fail('E_LIMIT');
      guard(); return { stagedImagesVerified: true, preloadAbsent: true, ordinaryProfileObserved: true };
    };
    if (300000 - (guard() - started) < 150000) fail('E_DEADLINE');
    roleStarted = last; collector.beginToolchainEvidenceRole('rustc'); acceptedState(0, 'rustc');
    const coreDeps = { fs: deps.fs, now: deps.now, beforeDecode: gate, afterDecode: gate,
      setTimeout: deps.setTimeout, clearTimeout: deps.clearTimeout,
      spawn(...args) {
        guard(); counts.spawnAttempts++;
        if (counts.spawnAttempts !== 1 || counts.ownedChildren !== 0) fail('E_LIMIT');
        if (args.length !== 3 || args[0] !== DECODER + '/ld-linux-x86-64.so.2') fail('E_SPAWN');
        sameData(src, args[1], ['--inhibit-cache', '--glibc-hwcaps-mask', '', '--library-path', DECODER,
          DECODER + '/xz', '--decompress', '--stdout', '--format=xz', '--threads=1', '--memlimit-decompress=268435456', '--', '-']);
        sameData(src, args[2], { cwd: DECODER, env: { LC_ALL: 'C', LANG: 'C', TZ: 'UTC' },
          shell: false, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
        const child = deps.spawn(...args); counts.ownedChildren++; counts.peakChildren = Math.max(counts.peakChildren, counts.ownedChildren);
        child.once('spawn', () => { counts.spawnEvents++; });
        child.once('close', (code, signal) => {
          counts.ownedChildren--; counts.childCloses++; childCloseAccepted = code === 0 && signal === null;
        }); return child;
      } };
    const raw = await core.runGnuSdkInventory(input.identity, coreDeps); guard();
    const value = snapshot(raw, 4194304);
    if (value.state !== 'GNU_SDK_DATA_INVENTORY' || value.mockOnly !== false || value.archiveBytes !== 80351960 ||
      value.archiveSha256 !== input.archiveSha256 || value.archivePasses !== 2 || value.archiveDataBytes !== 160703920 ||
      value.archiveRequestedBytes !== 160703922 || value.closeAttempts !== 2 || value.exitCode !== 0 || value.signal !== null ||
      counts.spawnAttempts !== 1 || counts.spawnEvents !== 1 || counts.ownedChildren !== 0 || counts.childCloses !== 1 || !childCloseAccepted ||
      counts.stageChecks !== 2 || counts.preloadChecks !== 2 || counts.stageCloses !== 10 ||
      !['stdinFinished', 'stdoutEnded', 'stderrEnded', 'closeObserved'].every(key => value[key] === true) ||
      !['extracted', 'extractionAuthorized', 'pythonFreeSubsetVerified', 'installedUsability', 'nativeQualified', 'decoderQualified',
        'rustReady', 'trainingReady', 'provenanceVerified', 'hardRssBounded', 'processTreeBounded', 'hardDeadlineGuaranteed'].every(key => value[key] === false) ||
      value.expandedBytes !== 402308096 || value.inventory?.entries !== 70 || value.inventory.headers !== 71 ||
      value.inventory.metadataSha256 !== EXPECTATION.metadataSha256 || !Number.isSafeInteger(value.streamEvents) ||
      value.streamEvents < 0 || value.streamEvents > 262144) fail('E_RECEIPT');
    collector.acceptToolchainEvidenceRole(raw); guard();
    publicationStarted = last; roleStarted = null;
    counts.completedCorePasses++; counts.archivePasses = 2; counts.archiveDataBytes = value.archiveDataBytes;
    counts.archiveRequestedBytes = value.archiveRequestedBytes; counts.archiveCloseAttempts = value.closeAttempts;
    counts.expandedBytes = value.expandedBytes; counts.streamEvents = value.streamEvents; counts.entries = value.inventory.entries;
    guard(); acceptedState(1);
    const collection = collector.finishToolchainEvidenceBatch(); src.preflight(collection, 16777216, guard, true);
    validateCollection(src, collection, input); guard();
    const text = src.asciiJson({ ...envelope('RUST_HELPER_EVIDENCE_DATA'), collection }, 16777216, guard);
    const bytes = Buffer.from(text, 'ascii'), hash = sha(bytes); guard();
    const record = snapshot(publisher.publish(bytes)), published = snapshot(publisher.snapshot()); publicationCounts = published.counts;
    validatePublication(src, record, published, bytes.length, hash); guard();
    if (repoCapture.ownedFds !== 0 || repoCapture.closes !== 16 || counts.ownedChildren !== 0 || counts.peakChildren !== 1) fail('E_CLOSE');
    const compact = src.asciiJson({ ...envelope('RUST_HELPER_EVIDENCE_DATA'), publicationAccepted: true,
      byteLength: bytes.length, sha256: hash, mode: '0444', readbackVerified: true, directorySynced: true,
      publicationCounts, publicationFileMetadata: record.fileMetadata }, 65536, guard); guard();
    return Object.freeze({ exitCode: 0, text: compact });
  } catch (failure) {
    error = errorCode(failure);
    if (publisher) {
      try {
        const aborted = snapshot(Reflect.apply(fn(publisher, 'abort'), publisher, []), 16384, () => {});
        const after = snapshot(Reflect.apply(fn(publisher, 'snapshot'), publisher, []), 16384, () => {});
        publicationCounts = after.counts;
        if (aborted.closeFailed !== false || aborted.cleanupUncertain !== false || after.closeFailed !== false ||
          after.cleanupUncertain !== false || after.ownedFDCount !== 0) { error = 'E_PUBLICATION_CLOSE'; abortUncertain = true; }
      } catch { error = 'E_PUBLICATION_ABORT'; abortUncertain = true; }
    }
    if (collector) {
      try { Reflect.apply(fn(collector, 'abortToolchainEvidenceBatch'), collector, []); }
      catch { if (!abortUncertain) error = 'E_COLLECTION_ABORT'; abortUncertain = true; }
    }
  }
  const result = { ...envelope('STOP'), publicationAccepted: false, error, publicationCounts, abortUncertain,
    failure: { role: 'rustc', path: null, kind: null, index: null } };
  return Object.freeze({ exitCode: 1, text: src ? src.asciiJson(result, 65536) : JSON.stringify(result) + '\n' });
}
export const rustHelperEvidenceOperationSource = Object.freeze({ rows: SOURCE_ROWS, bootstrapRows: BOOTSTRAP_ROWS,
  bootstrapCapture, captureCounts, prepareGraph, compareProfile, validateCollection, validatePublication,
  collectorAppend: COLLECTOR_APPEND, sdkAppend: SDK_APPEND, writerParts: WRITER_PARTS, writerPaths: WRITER_PATHS });
