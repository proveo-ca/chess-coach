// SPEC: _spec/tooling/native-ingress/step2.puml
import { createHash } from 'node:crypto';
import { types } from 'node:util';

const keys = ['gnuEvidence', 'cargoEvidence', 'rustcEvidence', 'rustStdEvidence', 'rustfmtEvidence', 'clippyEvidence', 'hostEvidence', 'helperEvidence'];
const names = ['gnu-evidence-collection-v1', 'rust-archive-cargo-v1', 'rust-archive-rustc-v1', 'rust-archive-rust-std-v1', 'rust-archive-rustfmt-preview-v1', 'rust-archive-clippy-preview-v1', 'host-runtime-providers', 'rust-helper-evidence-v1'];
const sizes = [2829942, 44154, 83556, 60485, 33457, 33993, 49078, 55014];
const hashes = ['01c24e73a65148b8a70c3c1d4034f86dcac8040859bc206b5cf40b784776cc22',
  '6364e2063f24be97096694f34d267d6c74e6ad538fd20218ca53d79d2627ea09',
  '2a2d410012e7b56be1cfaabaf8fb71823127b8b7826bc230d998f615184df3aa',
  '0a76a92d7ebc4bde40d0be317bc4557f684c3680b757d602f345b8df9ecf5ce7',
  '11fd1af89703029062560f8ff31dbc9d8fd2bbf08e2e8b9fe302f6a4a1600d35',
  '88528d4b1c184a5e5ad95cc2e3df0ea597863e9cf130d1659a78ded52e667dd3',
  '602209b5473b052df68acae9930a9bf348bf1431903b24b4ed56ad20e8d35894',
  '003b26c6cd849670f5ef28f775466f0e1e0e09fa154058c70cf130e9587269d2'];
const roles = ['gnu-sdk', 'cargo', 'rustc', 'rust-std', 'rustfmt-preview', 'clippy-preview', 'host-runtime', 'rustc'];
const roots = ['x86-64--glibc--stable-2026.08-1', ...['cargo', 'rustc', 'rust-std', 'rustfmt', 'clippy'].map(n => `${n}-1.95.0-x86_64-unknown-linux-gnu`)];
const counts = [[8412, 6891, 505333760, 46], [68, 56, 42864128, 1], [70, 53, 402308096, 7],
  [81, 74, 166755840, 1], [22, 16, 9112576, 2], [22, 16, 21706240, 2]];
const hostRoles = ['HOST_LOADER', 'HOST_LIBC', 'HOST_LIBM', 'HOST_LIBDL', 'HOST_LIBPTHREAD', 'HOST_LIBRT', 'HOST_LIBGCC_S'];
const negativeNames = ['copyAuthorized', 'extractionAuthorized', 'installationAuthorized', 'sourceAuthenticated',
  'publisherAuthenticated', 'publisherAuthentication', 'sourceRootAuthentication', 'acceptanceVerified',
  'symbolBindingsVerified', 'loaderClosureVerified', 'abiVerified', 'runtimeProvidersQualified',
  'pythonFreeSubsetVerified', 'noPythonRuntimeVerified', 'imagePrepared', 'imageEquivalent', 'rustReady',
  'trainingReady', 'sourceBuildGraphVerified', 'licenseComplianceVerified', 'hostTargetPromotion',
  'nativeQualified', 'nativeAuthority', 'dockerProviderQualified'];
const negatives = Object.fromEntries(negativeNames.map(k => [k, false]));
const obligationCodes = ['SOURCE_PACKAGE_PROVENANCE', 'LICENSE_INPUTS', 'SEARCH_ORDER', 'SYMBOL_BINDINGS', 'LOAD_PRIVATE_ABI', 'ROLE_BEHAVIOR', 'IMAGE_CONTAINMENT'];
const fail = code => { throw Object.freeze(Object.assign(new Error(code), { name: 'ToolchainProviderPlanError', code })); };
const check = (ok, code = 'E_PROVIDER_SCHEMA') => { if (!ok) fail(code); };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const uint = n => Number.isSafeInteger(n) && n >= 0;
const digest = s => typeof s === 'string' && /^[a-f0-9]{64}$/u.test(s);
function freeze(v) {
  if (v && typeof v === 'object') { for (const child of Object.values(v)) freeze(child); Object.freeze(v); }
  return v;
}
export const TOOLCHAIN_PROVIDER_PLAN_V1_PINS = freeze(Object.fromEntries(keys.map((key, i) => [key, {
  path: `_spec/tooling/native-ingress/${names[i]}.result.json`, byteLength: sizes[i], sha256: hashes[i],
  declaredReceipt: { path: `_spec/tooling/native-ingress/${names[i]}.receipt.json`, marker: 'NOT_READ_OR_REVERIFIED' }
}])));

const typed = Object.getPrototypeOf(Uint8Array.prototype);
const byteLength = Object.getOwnPropertyDescriptor(typed, 'byteLength').get;
const backing = Object.getOwnPropertyDescriptor(typed, 'buffer').get;
function snapshots(input) {
  check(input && typeof input === 'object' && !types.isProxy(input), 'E_PROVIDER_INPUT');
  check(Object.getPrototypeOf(input) === Object.prototype || Object.getPrototypeOf(input) === null, 'E_PROVIDER_INPUT');
  const own = Reflect.ownKeys(input);
  check(own.length === 8 && own.every(k => keys.includes(k)), 'E_PROVIDER_INPUT');
  let total = 0;
  const values = keys.map(k => {
    const d = Object.getOwnPropertyDescriptor(input, k);
    check(d && Object.hasOwn(d, 'value') && d.enumerable, 'E_PROVIDER_INPUT');
    const v = d.value;
    check(v && !types.isProxy(v) && Buffer.isBuffer(v) && Object.getPrototypeOf(v) === Buffer.prototype, 'E_PROVIDER_INPUT');
    const n = byteLength.call(v);
    check(n <= 4194304 && total + n <= 16777216, 'E_PROVIDER_INPUT_BYTES');
    total += n;
    check(!types.isSharedArrayBuffer(backing.call(v)), 'E_PROVIDER_INPUT');
    return { v, n };
  });
  for (const { v, n } of values) {
    const props = Reflect.ownKeys(v);
    check(props.length === n && props.every((k, i) => k === String(i)), 'E_PROVIDER_INPUT');
  }
  const copies = values.map(({ v, n }) => {
    const copy = Buffer.alloc(n);
    Uint8Array.prototype.set.call(copy, v);
    return copy;
  });
  for (let i = 0; i < copies.length; i++) {
    const pin = TOOLCHAIN_PROVIDER_PLAN_V1_PINS[keys[i]];
    check(copies[i].length === pin.byteLength && hash(copies[i]) === pin.sha256, 'E_PROVIDER_PIN');
  }
  return copies;
}
function lexicalDepth(bytes) {
  let depth = 0, quoted = false, escaped = false;
  for (const c of bytes) {
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === 92) escaped = true;
      else if (c === 34) quoted = false;
    } else if (c === 34) quoted = true;
    else if (c === 123 || c === 91) check(++depth <= 64, 'E_PROVIDER_STRUCTURE');
    else if (c === 125 || c === 93) check(--depth >= 0, 'E_PROVIDER_JSON');
  }
  check(!quoted && depth === 0, 'E_PROVIDER_JSON');
}
function documents(copies) {
  for (const copy of copies) lexicalDepth(copy);
  const docs = copies.map(copy => {
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(copy)); }
    catch { fail('E_PROVIDER_JSON'); }
  });
  let nodes = 0;
  function visit(v, depth) {
    check(++nodes <= 1000000 && depth <= 64, 'E_PROVIDER_STRUCTURE');
    check(typeof v !== 'number' || Number.isFinite(v), 'E_PROVIDER_SCHEMA');
    if (v && typeof v === 'object') {
      check(Object.keys(v).length <= 32768, 'E_PROVIDER_STRUCTURE');
      for (const x of Object.values(v)) visit(x, depth + 1);
    }
  }
  for (const doc of docs) visit(doc, 0);
  return docs;
}
function ascii(s, max = 4096, empty = false) {
  check(typeof s === 'string' && (empty || s.length > 0) && s.length <= max && !/[^\x20-\x7e]/u.test(s));
  return s;
}
function path(s, absolute = false) {
  ascii(s);
  check(!/[^\x21-\x7e]/u.test(s) && !s.includes('\\') && (absolute ? s.startsWith('/') : !s.startsWith('/') && !/^[A-Za-z]:/u.test(s))
    && !s.split('/').slice(absolute ? 1 : 0).some(p => !p || p === '.' || p === '..'));
  return s;
}
function array(v, max = 32768) { check(Array.isArray(v)); check(v.length <= max, 'E_PROVIDER_LIMIT'); return v; }
function elfHash(name) {
  ascii(name, 1024);
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = ((h << 4) + name.charCodeAt(i)) >>> 0;
    const g = h & 0xf0000000;
    if (g) h = (h ^ (g >>> 24)) >>> 0;
    h = (h & ~g) >>> 0;
  }
  return h;
}
function measure(v) {
  if (typeof v === 'string') {
    let n = 2;
    for (let i = 0; i < v.length; i++) {
      const c = v.charCodeAt(i);
      n += c === 34 || c === 92 || [8, 9, 10, 12, 13].includes(c) ? 2 : c < 32 || c >= 128 ? 6 : 1;
      check(n <= 4194304, 'E_PROVIDER_OUTPUT_BYTES');
    }
    return n;
  }
  if (!v || typeof v !== 'object') { check(v !== undefined); return String(v).length; }
  let n = 2, first = true;
  for (const [k, x] of Object.entries(v)) {
    n += (first ? 0 : 1) + (Array.isArray(v) ? 0 : measure(k) + 1) + measure(x);
    check(n <= 4194304, 'E_PROVIDER_OUTPUT_BYTES'); first = false;
  }
  return n;
}
function metadata(req, size, sha, accounting, host = false) {
  check(req && req.state === 'ELF_REQUIREMENTS_METADATA' && req.profile === `elf64le-x86-64-requirements-v${host ? 4 : 5}`
    && req.byteLength === size && req.inputSha256 === sha, 'E_PROVIDER_METADATA');
  check(req.dynamic && req.requirements, 'E_PROVIDER_METADATA');
  check(req.header && [2, 3].includes(req.header.type) && req.header.machine === 62, 'E_PROVIDER_METADATA');
  array(req.dynamic.needed, 512).forEach(n => ascii(n, 4096));
  accounting.needed += req.dynamic.needed.length;
  check(accounting.needed <= 512, 'E_PROVIDER_LIMIT');
  for (const field of ['soname', 'rpath', 'runpath']) if (req.dynamic[field] !== null) ascii(req.dynamic[field], 4096, true);
  if (req.interpreter !== null) ascii(req.interpreter);
  for (const need of array(req.requirements.versionNeeds, 1024)) {
    ascii(need.file);
    for (const aux of array(need.aux, 1024)) {
      check(++accounting.versions <= 1024, 'E_PROVIDER_LIMIT');
      check(uint(aux.hash) && aux.hash === elfHash(aux.name), 'E_PROVIDER_VERSION_HASH');
    }
  }
  for (const def of array(req.requirements.versionDefinitions, 1024)) {
    check(++accounting.versions <= 1024, 'E_PROVIDER_LIMIT');
    check(array(def.names, 1024).length > 0);
    def.names.forEach(n => ascii(n, 1024));
    check(uint(def.hash) && def.hash === elfHash(def.names[0]), 'E_PROVIDER_VERSION_HASH');
  }
  return req;
}
function namespace(doc, i, accounting) {
  const ordinal = i === 7 ? 2 : i;
  const status = i === 0 ? 'SPLIT_TOOLCHAIN_EVIDENCE_DATA' : i === 7 ? 'RUST_HELPER_EVIDENCE_DATA' : 'RUST_ARCHIVE_EVIDENCE_DATA';
  check(doc && doc.status === status && doc.mockOnly === false && doc.part === (i === 0 ? 'gnu' : 'rust')
    && (i === 0 || doc.artifactRole === roles[i]), 'E_PROVIDER_SOURCE');
  check(doc.profile === (i === 0 ? 'registered-split-toolchain-evidence-v1' : i === 7 ? 'registered-rust-helper-evidence-v1' : 'RUST_ARCHIVE_EVIDENCE_DATA'), 'E_PROVIDER_SOURCE');
  const c = doc.collection;
  check(c && c.profile === 'SPLIT_TOOLCHAIN_EVIDENCE_DATA' && c.state === 'SPLIT_TOOLCHAIN_EVIDENCE_DATA'
    && c.part === doc.part && c.mockOnly === false && c.completeNamespace === true && array(c.roles, 1).length === 1, 'E_PROVIDER_SOURCE');
  const r = c.roles[0], expected = counts[ordinal];
  check(r && typeof r === 'object', 'E_PROVIDER_ROLE');
  for (const flag of negativeNames) if (Object.hasOwn(c, flag)) check(c[flag] === false, 'E_PROVIDER_SOURCE');
  check(r.role === roles[i] && r.expectedRoot === roots[ordinal] && r.completeNamespace === true
    && r.entries === expected[0] && r.regularFiles === expected[1] && r.expandedBytes === expected[2]
    && c.artifactCount === 1 && c.entries === r.entries && c.regularFiles === r.regularFiles && c.expandedBytes === r.expandedBytes
    && c.targetCount === (i === 7 ? 3 : expected[3]) && c.selectedPayloads === c.targetCount, 'E_PROVIDER_ROLE');
  const members = array(r.members), selected = array(r.selected, 128);
  accounting.members += members.length;
  accounting.selected += selected.length;
  check(accounting.members <= 65536 && accounting.selected <= 128, 'E_PROVIDER_LIMIT');
  check(members.length === r.entries && selected.length === (i === 7 ? 3 : expected[3]), 'E_PROVIDER_ROLE');
  const byPath = new Map(); let regular = 0;
  for (const m of members) {
    path(m.path);
    check(m.path === r.expectedRoot || m.path.startsWith(r.expectedRoot + '/'));
    check(m.index === byPath.size + 1 && !byPath.has(m.path) && uint(m.size) && uint(m.bodyOffset)
      && m.bodyOffset >= 512 && m.bodyOffset % 512 === 0 && m.size <= r.expandedBytes - m.bodyOffset
      && ['directory', 'file', 'symlink', 'hardlink'].includes(m.type), 'E_PROVIDER_MEMBER');
    if (m.type === 'file') { regular++; check(digest(m.bodySha256), 'E_PROVIDER_MEMBER'); }
    byPath.set(m.path, m);
  }
  check(regular === r.regularFiles && members[0]?.type === 'directory', 'E_PROVIDER_ROLE');
  const seen = new Set();
  for (const s of selected) {
    check(s && typeof s === 'object', 'E_PROVIDER_SELECTED');
    const m = byPath.get(s.path);
    check(m?.type === 'file' && !seen.has(s.path) && s.artifactRole === r.role
      && ['index', 'path', 'bodyOffset', 'size', 'bodySha256'].every(k => s[k] === m[k])
      && (s.expectedSha256 === null || s.expectedSha256 === m.bodySha256), 'E_PROVIDER_SELECTED');
    check(['HOST', 'TARGET'].includes(s.domain) && ['ELF_EXEC_DSO', 'LINKER_TEXT', 'ET_REL', 'AR'].includes(s.kind), 'E_PROVIDER_SELECTED');
    check(s.qualified === false && s.abiVerified === false && s.roleSatisfied === false, 'E_PROVIDER_SELECTED');
    if (i === 0) {
      const sysroot = s.path.startsWith(r.expectedRoot + '/x86_64-buildroot-linux-gnu/sysroot/');
      check(!sysroot || s.domain === 'TARGET', 'E_PROVIDER_DOMAIN');
      check(sysroot || s.kind !== 'ELF_EXEC_DSO' || s.domain === 'HOST', 'E_PROVIDER_DOMAIN');
    } else check(s.domain === (i === 3 ? 'TARGET' : 'HOST'), 'E_PROVIDER_DOMAIN');
    seen.add(s.path);
  }
  return r;
}

function build(input) {
  const docs = documents(snapshots(input));
  for (const doc of docs) {
    check(doc && typeof doc === 'object', 'E_PROVIDER_SOURCE');
    for (const flag of negativeNames) if (Object.hasOwn(doc, flag)) check(doc[flag] === false, 'E_PROVIDER_SOURCE');
    for (const flag of ['sourceRootAuthentication', 'nativeQualified', 'nativeAuthority', 'rustReady', 'trainingReady',
      'loaderClosureVerified', 'runtimeProvidersQualified', 'pythonFreeSubsetVerified', 'noPythonRuntimeVerified', 'imagePrepared']) {
      check(doc[flag] === false, 'E_PROVIDER_SOURCE');
    }
  }
  const accounting = { members: 0, selected: 0, needed: 0, versions: 0 };
  const namespaces = docs.map((d, i) => i === 6 ? null : namespace(d, i, accounting));
  check(JSON.stringify(namespaces[2].members) === JSON.stringify(namespaces[7].members), 'E_PROVIDER_HELPER_NAMESPACE');
  const oldSelected = new Set(namespaces[2].selected.map(s => s.path));
  check(namespaces[7].selected.every(s => !oldSelected.has(s.path)), 'E_PROVIDER_HELPER_SELECTED');
  const host = docs[6];
  check(host && host.profile === 'registered-host-runtime-providers-v1' && host.status === 'HOST_RUNTIME_CANDIDATES_OBSERVED'
    && host.mockOnly === false && array(host.candidates, 7).length === 7
    && host.counts?.filesAdmitted === 7 && host.counts.capturedFiles === 7 && host.counts.inspectedFiles === 7, 'E_PROVIDER_HOST');
  const owners = [], providers = [], neededEdges = [], versionReferences = [], linkerDeclarations = [], selectedDeclarations = [], byteEqualityAnnotations = [], interpreterAnnotations = [];
  const reqs = new Map();
  const obligations = () => obligationCodes.map(code => ({ code, status: 'UNRESOLVED' }));
  const result = { profile: 'TOOLCHAIN_PROVIDER_PLAN_V1', state: 'PROPOSED_DECLARATION_SUPPLEMENT', status: 'PROPOSED_DECLARATION_SUPPLEMENT',
    inputBindings: keys.map(key => ({ sourceRole: key, ...TOOLCHAIN_PROVIDER_PLAN_V1_PINS[key], pinMeaning: 'FULL_BYTE_IDENTITY_ONLY', ...negatives })),
    owners, providers, neededEdges, versionReferences, selectedDeclarations, linkerDeclarations, interpreterAnnotations, byteEqualityAnnotations,
    counts: { selected: 128, selectedElf: 128, providers: 128, neededEdges: 512, primaryVersionReferences: 1024,
      sourceMembers: 65536, helperNeededEdges: 512, helperVersionReferences: 1024 },
    unresolvedObligations: obligations(), ...negatives };
  let outputBytes = measure(result) + 1;
  const append = (rows, row, max) => {
    check(rows.length < max, 'E_PROVIDER_LIMIT');
    const n = measure(row) + 1;
    check(n <= 4194304 - outputBytes, 'E_PROVIDER_OUTPUT_BYTES');
    outputBytes += n; rows.push(row);
  };
  function addOwner(identity, req) {
    metadata(req, identity.size, identity.bodySha256, accounting, identity.sourceRole === 'hostEvidence');
    const ownerId = 'owner:' + hash(JSON.stringify([identity.sourceRole, identity.path, identity.index, identity.bodySha256, identity.domain]));
    const owner = { ownerId, ...identity, interpreter: req.interpreter, rpath: req.dynamic.rpath, runpath: req.dynamic.runpath,
      soname: req.dynamic.soname, status: 'UNRESOLVED', ...negatives };
    append(owners, owner, 128); reqs.set(ownerId, req);
    if (req.dynamic.soname) append(providers, { providerId: 'provider:' + ownerId.slice(6), ownerId, ...identity,
      soname: req.dynamic.soname, versionDefinitions: req.requirements.versionDefinitions,
      candidateOnly: true, status: 'UNRESOLVED', ...negatives }, 128);
  }
  for (let i = 0; i < docs.length; i++) {
    if (i === 6) {
      for (let index = 0; index < host.candidates.length; index++) {
        const c = host.candidates[index];
        check(c.role === hostRoles[index] && c.sourceKind === (index < 2 ? 'PINNED_ORDINARY_STAGE' : 'ORDINARY_HOST_CANDIDATE_UNAUTHENTICATED')
          && uint(c.size) && digest(c.sha256) && c.rootMetadata && c.fileMetadata, 'E_PROVIDER_HOST');
        path(c.path, true); path(c.root, true);
        const identity = { sourceRole: keys[i], artifactRole: c.role, sourcePath: TOOLCHAIN_PROVIDER_PLAN_V1_PINS[keys[i]].path,
          path: c.path, root: c.root, index, bodyOffset: null, size: c.size, bodySha256: c.sha256, domain: 'HOST',
          sourceKind: c.sourceKind, rootMetadata: c.rootMetadata, fileMetadata: c.fileMetadata };
        append(selectedDeclarations, { ...identity, kind: 'ELF_EXEC_DSO', status: 'UNRESOLVED', ...negatives }, 128);
        addOwner(identity, c.requirements);
      }
      continue;
    }
    const r = namespaces[i];
    for (const s of [...r.selected].sort((a, b) => a.index - b.index)) {
      const identity = { sourceRole: keys[i], artifactRole: r.role, sourcePath: TOOLCHAIN_PROVIDER_PLAN_V1_PINS[keys[i]].path,
        path: s.path, root: r.expectedRoot, index: s.index, bodyOffset: s.bodyOffset, size: s.size, bodySha256: s.bodySha256, domain: s.domain };
      append(selectedDeclarations, { ...identity, kind: s.kind, status: 'UNRESOLVED', ...negatives }, 128);
      if (s.kind === 'ELF_EXEC_DSO') {
        check(s.metadata?.state === 'ELF_EXEC_DSO_REQUIREMENT_DATA', 'E_PROVIDER_METADATA');
        addOwner(identity, s.metadata.requirements);
      }
      else if (s.kind === 'LINKER_TEXT') {
        check(s.metadata?.state === 'SOURCE_FORMAT_DATA' && s.metadata.observation, 'E_PROVIDER_METADATA');
        append(linkerDeclarations, { ...identity, rawDeclaration: s.metadata, status: 'UNRESOLVED', interpreted: false, ...negatives }, 16);
      }
    }
  }
  function candidates(domain, name) {
    const rows = [];
    for (const p of providers) if (p.domain === domain && p.soname === name) {
      check(rows.length < 128, 'E_PROVIDER_CANDIDATES'); rows.push(p);
    }
    return rows;
  }
  for (const owner of owners) {
    const req = reqs.get(owner.ownerId);
    for (let ordinal = 0; ordinal < req.dynamic.needed.length; ordinal++) {
      const name = req.dynamic.needed[ordinal], matches = candidates(owner.domain, name);
      append(neededEdges, { edgeId: `${owner.ownerId}:needed:${ordinal}`, ownerId: owner.ownerId, neededOrdinal: ordinal,
        name, domain: owner.domain, candidateProviderIds: matches.map(p => p.providerId), candidateCount: matches.length,
        ambiguity: matches.length > 1 ? 'MULTIPLE_METADATA_CANDIDATES' : matches.length === 1 ? 'UNIQUE_METADATA_CANDIDATE_NOT_RESOLUTION' : 'NO_METADATA_CANDIDATE',
        status: 'UNRESOLVED', obligations: obligations(), ...negatives }, 512);
    }
    for (let n = 0; n < req.requirements.versionNeeds.length; n++) {
      const need = req.requirements.versionNeeds[n];
      for (let a = 0; a < need.aux.length; a++) {
        const aux = need.aux[a], matches = [];
        for (const p of candidates(owner.domain, need.file)) {
          const declarations = [];
          for (let d = 0; d < p.versionDefinitions.length; d++) {
            const def = p.versionDefinitions[d];
            if (def.names[0] === aux.name) append(declarations, { definitionOrdinal: d, primaryNameMatches: true,
              hashMatches: def.hash === aux.hash, primaryDeclarationMatches: def.hash === aux.hash }, 1024);
          }
          append(matches, { providerId: p.providerId, primaryNameMatches: declarations.length > 0,
            hashMatches: declarations.some(d => d.hashMatches), primaryDeclarationMatches: declarations.some(d => d.primaryDeclarationMatches), declarations }, 128);
        }
        append(versionReferences, { ownerId: owner.ownerId, domain: owner.domain, file: need.file, versionNeedOrdinal: n, auxOrdinal: a,
          name: aux.name, expectedElfHash: aux.hash, neededEdgeIds: neededEdges.filter(e => e.ownerId === owner.ownerId && e.name === need.file).map(e => e.edgeId),
          candidates: matches, status: 'UNRESOLVED', ...negatives }, 1024);
      }
    }
  }
  for (const owner of owners) if (owner.interpreter !== null) append(interpreterAnnotations, { ownerId: owner.ownerId,
    rawInterpreter: owner.interpreter,
    candidateOwnerIds: owners.filter(o => owner.domain === 'HOST' && o.artifactRole === 'HOST_LOADER' && o.path === owner.interpreter).map(o => o.ownerId),
    candidateProviderIds: providers.filter(p => owner.domain === 'HOST' && p.artifactRole === 'HOST_LOADER' && p.path === owner.interpreter).map(p => p.providerId),
    status: 'UNRESOLVED', searchPerformed: false, ...negatives }, 128);
  const lld = namespaces[2].selected.find(s => s.path.endsWith('/gcc-ld/ld.lld'));
  if (lld) for (const m of namespaces[2].members) if (m.type === 'file' && m.path !== lld.path && m.bodySha256 === lld.bodySha256) {
    append(byteEqualityAnnotations, { sourceRole: 'rustcEvidence', referenceIndex: lld.index, referencePath: lld.path,
      index: m.index, path: m.path, bodySha256: m.bodySha256, byteEqualityOnly: true, argvPersonalityQualified: false, status: 'UNRESOLVED' }, 128);
  }
  result.counts = { selected: selectedDeclarations.length, selectedElf: owners.length, providers: providers.length, neededEdges: neededEdges.length,
      primaryVersionReferences: versionReferences.length, sourceMembers: accounting.members,
      helperNeededEdges: neededEdges.filter(e => owners.find(o => o.ownerId === e.ownerId)?.sourceRole === 'helperEvidence').length,
      helperVersionReferences: versionReferences.filter(v => owners.find(o => o.ownerId === v.ownerId)?.sourceRole === 'helperEvidence').length };
  check(measure(result) + 1 <= 4194304, 'E_PROVIDER_OUTPUT_BYTES');
  return freeze(result);
}

export function createToolchainProviderPlanV1(input) {
  if (arguments.length !== 1) fail('E_PROVIDER_INPUT');
  try { return build(input); }
  catch (error) {
    if (error?.name === 'ToolchainProviderPlanError') throw error;
    fail('E_PROVIDER_SCHEMA');
  }
}
