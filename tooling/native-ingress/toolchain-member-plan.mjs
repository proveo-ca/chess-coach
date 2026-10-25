// SPEC: _spec/tooling/native-ingress/step2.puml
import { createHash } from 'node:crypto';
import { types } from 'node:util';

export const TOOLCHAIN_MEMBER_PLAN_LIMITS = Object.freeze({ maxInputBytes: 16777216, maxOutputBytes: 16777216,
  maxDepth: 64, maxNodes: 1000000, maxMembers: 32768, maxExpandedBytes: 2147483648,
  maxLinkHops: 32, maxPathComponents: 1024, maxDeclarations: 32768 });
const roles = ['gnu-sdk', 'cargo', 'rustc', 'rust-std', 'rustfmt-preview', 'clippy-preview'];
const roots = ['x86-64--glibc--stable-2026.08-1', ...['cargo', 'rustc', 'rust-std', 'rustfmt', 'clippy'].map(n => `${n}-1.95.0-x86_64-unknown-linux-gnu`)];
const components = [null, 'cargo', 'rustc', 'rust-std-x86_64-unknown-linux-gnu', 'rustfmt-preview', 'clippy-preview'];
const counts = [[8412, 6891, 505333760, 46], [68, 56, 42864128, 1], [70, 53, 402308096, 7],
  [81, 74, 166755840, 1], [22, 16, 9112576, 2], [22, 16, 21706240, 2]];
const resultPins = ['01c24e73a65148b8a70c3c1d4034f86dcac8040859bc206b5cf40b784776cc22',
  '6364e2063f24be97096694f34d267d6c74e6ad538fd20218ca53d79d2627ea09',
  '2a2d410012e7b56be1cfaabaf8fb71823127b8b7826bc230d998f615184df3aa',
  '0a76a92d7ebc4bde40d0be317bc4557f684c3680b757d602f345b8df9ecf5ce7',
  '11fd1af89703029062560f8ff31dbc9d8fd2bbf08e2e8b9fe302f6a4a1600d35',
  '88528d4b1c184a5e5ad95cc2e3df0ea597863e9cf130d1659a78ded52e667dd3'];
const acceptancePins = ['d7a6b84bad258faa7c703d2f7fc344957e10c1e5e3607d71eddca3f113f4b23c',
  'c1c1d13f46c7c121f922aecb664919124d09047b61367dc10def3de059e17b37',
  '06f489950a405483b494384f3b4685fe24460e6db67ae4fe2195576daa8477bb',
  '8897b37d6d95a26ea39fb6905c0a81e770eba2a9eb8ccde530c98a193a592d9e',
  'ddccbe0c9e8a4f948549b4757e25111c0c6aadcdcff38805a49619c681be9217',
  'bac5a7b03b801c0ff5b7c3effbd7dedde6663be40f34ec64a3e9f5e058b114e6'];
const receiptPin = '4375220d2f54ac974eee99c5623f7dccbf693515034edae2bf500719169455ff';
const hostPin = '602209b5473b052df68acae9930a9bf348bf1431903b24b4ed56ad20e8d35894';
const hostReceiptPin = 'f8e895b46afe97c5f4e7754f534720577189e92e89126814f965d324ab962cd5';
const relocPin = '60f1b6054d8f01670a9f5ac3ac0181f7148e37be91025c2c4f111df30047305e';
const locationPin = 'e4df82547e211e82635d37dc97cd4bce2f5d941aebb24717a32b242811ea052f';
const negatives = Object.freeze(Object.fromEntries(['copyAuthorized', 'extractionAuthorized', 'installationAuthorized',
  'imagePrepared', 'imageEquivalent', 'runtimeProvidersQualified', 'abiVerified', 'symbolBindingsVerified',
  'loaderClosureVerified', 'pythonFreeSubsetVerified', 'noPythonRuntimeVerified', 'nativeQualified', 'rustReady',
  'trainingReady', 'sourceAuthenticated', 'compilerExecuted', 'rustExecuted', 'pythonRuntimeInvoked',
  'historicalMissingRawResultsRestored', 'rawHistoricalResultsRestored', 'futureBuildGraphQualified',
  'installerInterpretationVerified', 'completeInstallerInterpretation', 'completeInstallMap', 'relocationReady',
  'licenseComplianceVerified', 'licensePermissionClassified', 'sourceRootAuthentication', 'hostTargetPromotion',
  'policyChanged', 'defaultVersionsChanged', 'featuresChanged', 'backendsChanged', 'linkerSelectionChanged',
  'compilerFlagsChanged', 'includeClosureVerified', 'sysrootClosureVerified'].map(k => [k, false])));
const hash = text => createHash('sha256').update(text).digest('hex');
const snapshotHash = value => hash(JSON.stringify(value) + '\n');
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const uint = value => Number.isSafeInteger(value) && value >= 0;
const fail = code => { throw Object.freeze(Object.assign(new Error(code), { name: 'ToolchainMemberPlanError', code })); };
function exact(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== keys.length || Object.keys(value).some(k => !keys.includes(k))) fail('E_PLAN_SCHEMA');
}
function stringBytes(text) {
  let size = 2;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    size += c === 34 || c === 92 || [8, 9, 10, 12, 13].includes(c) ? 2 : c < 32 || c >= 128 ? 6 : 1;
  }
  return size;
}
function snapshot(value, limits, budget = limits.maxInputBytes) {
  let bytes = 0, nodes = 0;
  const active = new Set();
  const charge = n => { if (n > budget - bytes) fail('E_PLAN_BYTES'); bytes += n; };
  function visit(v, depth) {
    if (++nodes > limits.maxNodes || depth > limits.maxDepth) fail('E_PLAN_STRUCTURE_LIMIT');
    if (typeof v === 'string') { if (v.length > budget - bytes) fail('E_PLAN_BYTES'); charge(stringBytes(v)); return v; }
    if (v === null || typeof v === 'boolean' || typeof v === 'number' && Number.isFinite(v)) { charge(String(v).length); return v; }
    if (!v || typeof v !== 'object' || types.isProxy(v) || active.has(v)) fail('E_PLAN_INPUT');
    const array = Array.isArray(v), proto = Object.getPrototypeOf(v);
    if (array ? proto !== Array.prototype && proto !== null : proto !== Object.prototype && proto !== null) fail('E_PLAN_INPUT');
    const keys = Reflect.ownKeys(v);
    active.add(v);
    let out;
    if (array) {
      const n = Object.getOwnPropertyDescriptor(v, 'length').value;
      if (!uint(n) || n > limits.maxNodes || keys.length !== n + 1) fail('E_PLAN_INPUT');
      charge(2 + Math.max(0, n - 1)); out = [];
      for (let i = 0; i < n; i++) {
        const d = Object.getOwnPropertyDescriptor(v, String(i));
        if (!d || !Object.hasOwn(d, 'value') || !d.enumerable) fail('E_PLAN_INPUT');
        out.push(visit(d.value, depth + 1));
      }
    } else {
      charge(2 + Math.max(0, keys.length - 1)); out = Object.create(null);
      for (const k of keys) {
        const d = Object.getOwnPropertyDescriptor(v, k);
        if (typeof k !== 'string' || k === 'toJSON' || !d || !Object.hasOwn(d, 'value') || !d.enumerable) fail('E_PLAN_INPUT');
        charge(stringBytes(k) + 1); out[k] = visit(d.value, depth + 1);
      }
    }
    active.delete(v); return out;
  }
  return { value: visit(value, 0), bytes };
}
function lower(value) {
  const p = snapshot(value, TOOLCHAIN_MEMBER_PLAN_LIMITS).value;
  if (!p || typeof p !== 'object' || Array.isArray(p)) fail('E_PLAN_LIMIT');
  const result = { ...TOOLCHAIN_MEMBER_PLAN_LIMITS };
  for (const [k, n] of Object.entries(p)) {
    if (!Object.hasOwn(result, k) || !Number.isSafeInteger(n) || n < 1 || n > result[k]) fail('E_PLAN_LIMIT');
    result[k] = n;
  }
  return result;
}
function canonical(path) {
  return typeof path === 'string' && path.length > 0 && path.length <= 1024 && !/[^\x21-\x7e]|\\/u.test(path)
    && !path.startsWith('/') && !/^[A-Za-z]:/u.test(path) && !path.split('/').some(p => !p || p === '.' || p === '..');
}
function freeze(value) {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
function namespace(role, ordinal, limits) {
  if (role.role !== roles[ordinal] || role.expectedRoot !== roots[ordinal] || role.completeNamespace !== true
    || !Array.isArray(role.members) || !Array.isArray(role.selected) || !Array.isArray(role.manifests)
    || !uint(role.expandedBytes) || !uint(role.entries) || !uint(role.regularFiles)
    || role.entries !== role.members.length) fail('E_PLAN_ROLE');
  if (role.entries > limits.maxMembers) fail('E_PLAN_LIMIT');
  const map = new Map(), root = role.expectedRoot;
  let regular = 0, declaredBytes = 0, previousEnd = 0;
  for (const m of role.members) {
    if (!m || !canonical(m.path) || m.path !== root && !m.path.startsWith(root + '/')
      || !['file', 'directory', 'symlink', 'hardlink'].includes(m.type) || m.index !== map.size + 1
      || !uint(m.size) || !uint(m.bodyOffset) || m.bodyOffset % 512 || m.bodyOffset < 512
      || m.bodyOffset < previousEnd || !uint(m.mode) || !uint(m.uid) || !uint(m.gid)
      || typeof m.mtime !== 'string' || !/^-?\d+(?:\.\d+)?$/u.test(m.mtime) || m.mtime.length > 32
      || m.type !== 'file' && (m.size !== 0 || m.bodySha256 !== null || m.linkFollowed !== false)
      || m.type === 'file' && !digest(m.bodySha256) || map.has(m.path)) fail('E_PLAN_MEMBER');
    if (m.type === 'symlink' || m.type === 'hardlink') {
      if (typeof m.linkpath !== 'string' || !m.linkpath || m.linkpath.length > 1024 || /[^\x21-\x7e]|\\/u.test(m.linkpath)) fail('E_PLAN_LINK');
      const kind = m.linkpath.startsWith('/') || /^[A-Za-z]:/u.test(m.linkpath) ? 'absolute' : m.linkpath.split('/').includes('..') ? 'parent-components' : 'relative';
      if (m.linkKind !== kind) fail('E_PLAN_LINK');
    }
    if (m.type === 'file') { regular++; declaredBytes += m.size; }
    if (declaredBytes > limits.maxExpandedBytes || m.size > limits.maxExpandedBytes - m.bodyOffset) fail('E_PLAN_EXPANDED');
    previousEnd = Math.ceil((m.bodyOffset + m.size) / 512) * 512;
    if (previousEnd > role.expandedBytes) fail('E_PLAN_EXPANDED');
    map.set(m.path, m);
  }
  if (map.get(root)?.type !== 'directory' || regular !== role.regularFiles) fail('E_PLAN_ROLE');
  for (const m of role.members) {
    const parts = m.path.split('/');
    while (parts.length > 1) {
      parts.pop(); const ancestor = map.get(parts.join('/'));
      if (ancestor && ancestor.type !== 'directory') fail('E_PLAN_NAMESPACE_CONFLICT');
    }
  }
  const selected = new Map();
  for (const s of role.selected) {
    const m = map.get(s.path);
    if (!m || m.type !== 'file' || selected.has(s.path) || s.artifactRole !== role.role
      || !['HOST', 'TARGET'].includes(s.domain) || !['ELF_EXEC_DSO', 'ET_REL', 'AR', 'LINKER_TEXT'].includes(s.kind)
      || ordinal === 0 && s.path.startsWith(root + '/x86_64-buildroot-linux-gnu/sysroot/') && s.domain !== 'TARGET'
      || ordinal > 0 && s.domain !== (ordinal === 3 ? 'TARGET' : 'HOST')
      || typeof s.optionalForMinimalC !== 'boolean' || s.qualified !== false || s.abiVerified !== false || s.roleSatisfied !== false
      || ['index', 'size', 'bodyOffset', 'bodySha256'].some(k => s[k] !== m[k])
      || s.expectedSha256 !== null && s.expectedSha256 !== m.bodySha256) fail('E_PLAN_SELECTED');
    selected.set(s.path, s);
  }
  const manifests = new Map();
  for (const t of role.manifests) {
    const m = map.get(t.path);
    if (!m || m.type !== 'file' || manifests.has(t.path) || typeof t.text !== 'string' || /[^\x00-\x7f]/u.test(t.text)
      || t.text.length !== m.size || hash(t.text) !== m.bodySha256 || t.bodySha256 !== m.bodySha256
      || !Array.isArray(t.declarations) || t.interpreted !== false) fail('E_PLAN_MANIFEST');
    manifests.set(t.path, t);
  }
  return { role, root, map, selected, manifests, ordinal };
}

function resolve(ns, path, limits) {
  const hops = [], seen = new Set();
  const result = (status, m = null) => ({ status, namespaceHops: hops, terminalIndex: m?.index ?? null,
    terminalPath: m?.path ?? null, terminalBodySha256: m?.bodySha256 ?? null });
  if (!canonical(path) || path !== ns.root && !path.startsWith(ns.root + '/')) return result('UNRESOLVED_OUTSIDE_NAMESPACE');
  let queue = path.split('/'), at = [], guard = 0;
  while (queue.length) {
    if (++guard > limits.maxPathComponents) return result('UNRESOLVED_COMPONENT_LIMIT');
    const part = queue.shift();
    if (part === '.') continue;
    if (part === '..') { if (at.length <= 1) return result('UNRESOLVED_ESCAPE'); at.pop(); continue; }
    if (!part) return result('UNRESOLVED_NONCANONICAL_LINK');
    at.push(part);
    const current = at.join('/'), m = ns.map.get(current);
    if (!m) return result('UNRESOLVED_MISSING_MEMBER');
    if (m.type === 'symlink' || m.type === 'hardlink') {
      if (hops.length >= limits.maxLinkHops) return result('UNRESOLVED_HOP_LIMIT');
      const key = current + '\n' + queue.join('/');
      if (seen.has(key)) return result('UNRESOLVED_LINK_LOOP');
      seen.add(key); hops.push({ index: m.index, path: current, type: m.type, rawLinkpath: m.linkpath });
      if (m.linkpath.startsWith('/') || /^[A-Za-z]:/u.test(m.linkpath)) return result('UNRESOLVED_ABSOLUTE_LINK');
      if (m.type === 'hardlink') {
        if (!canonical(m.linkpath) || !m.linkpath.startsWith(ns.root + '/')) return result('UNRESOLVED_HARDLINK_ROOT');
        if (queue.length) return result('UNRESOLVED_HARDLINK_NONTERMINAL');
        at = []; queue = m.linkpath.split('/');
      } else { at.pop(); queue = [...m.linkpath.split('/'), ...queue]; }
    } else if (queue.length && m.type !== 'directory') return result('UNRESOLVED_NON_DIRECTORY');
    else if (!queue.length) return m.type === 'file' ? result('DECLARED_MEMBER_MATCH_NOT_LINKER_PROOF', m) : result('UNRESOLVED_NONREGULAR_TERMINAL');
  }
  return result('UNRESOLVED_NONREGULAR_TERMINAL');
}
function* textLines(text) {
  let at = 0, lineNumber = 1;
  while (at < text.length) {
    const stop = text.indexOf('\n', at), end = stop < 0 ? text.length : stop;
    yield { rawLine: text.slice(at, end), lineNumber: lineNumber++ }; at = end + 1;
  }
}
function rustDeclarations(ns, ledger, unknown, limits) {
  const component = components[ns.ordinal], prefix = ns.root + '/' + component;
  const required = [[ns.root + '/components', 'RUST_COMPONENTS'], [ns.root + '/rust-installer-version', 'RUST_INSTALLER_VERSION'], [prefix + '/manifest.in', 'RUST_MANIFEST']];
  if (ns.manifests.size !== 3 || required.some(([p, kind]) => ns.manifests.get(p)?.kind !== kind)
    || ns.manifests.get(required[0][0]).text !== component + '\n'
    || ns.manifests.get(required[1][0]).text !== '3\n') fail('E_PLAN_COMPONENT');
  const manifest = ns.manifests.get(prefix + '/manifest.in'), parsed = [], declared = new Map(), expanded = new Set();
  const append = (path, kind, lineNumber, rawLine, expandedFromDirectory = null) => {
    if (ledger.length + unknown.length >= limits.maxDeclarations) fail('E_PLAN_DECLARATION_LIMIT');
    const sourcePath = prefix + '/' + path, m = ns.map.get(sourcePath);
    const matched = m?.type === (kind === 'dir' ? 'directory' : 'file');
    const row = { artifactRole: ns.role.role, manifestPath: manifest.path, lineNumber, rawLine, kind,
      destination: path, sourcePath, matchedSourceIndex: matched ? m.index : null, bodySha256: matched ? m.bodySha256 : null,
      proposedRelativeDestination: 'rust/' + path, status: matched ? 'DECLARED_MEMBER_MATCH_NOT_INSTALLER_PROOF' : 'UNRESOLVED_DECLARED_MEMBER',
      expandedFromDirectory, disposition: null, proposedDestinationStatus: 'PROPOSED_NOT_INSTALLATION_AUTHORITY' };
    ledger.push(row); if (matched) declared.set(m.path, row);
  };
  for (const { rawLine: line, lineNumber } of textLines(manifest.text)) {
    const match = /^(file|dir):(.*)$/u.exec(line);
    if (!match) {
      if (ledger.length + unknown.length >= limits.maxDeclarations) fail('E_PLAN_DECLARATION_LIMIT');
      unknown.push({ artifactRole: ns.role.role, manifestPath: manifest.path, lineNumber, rawLine: line, status: 'UNINTERPRETED' }); continue;
    }
    const [, kind, path] = match;
    if (!canonical(path)) fail('E_PLAN_DECLARATION');
    parsed.push({ kind, path }); append(path, kind, lineNumber, line);
    if (kind === 'dir') {
      const source = prefix + '/' + path;
      if (ns.map.get(source)?.type === 'directory') for (const m of ns.role.members) {
        if (m.path.startsWith(source + '/') && ['file', 'directory'].includes(m.type) && !expanded.has(m.path)) {
          append(m.path.slice(prefix.length + 1), m.type === 'file' ? 'file' : 'dir', lineNumber, line, path); expanded.add(m.path);
        }
      }
    }
  }
  if (JSON.stringify(parsed) !== JSON.stringify(manifest.declarations)) fail('E_PLAN_DECLARATION_MISMATCH');
  for (const [path] of required.slice(0, 2)) if (ns.manifests.get(path).declarations.length) fail('E_PLAN_DECLARATION_MISMATCH');
  return declared;
}
function classify(ns, m, declared) {
  const relative = m.path === ns.root ? '' : m.path.slice(ns.root.length + 1), base = relative.split('/').at(-1);
  const s = ns.selected.get(m.path), rust = ns.ordinal > 0, component = components[ns.ordinal];
  const componentRelative = rust && relative.startsWith(component + '/') ? relative.slice(component.length + 1) : null;
  const modulePath = /\.pyc?$/u.test(base);
  const headerPath = /\.(?:h|hpp|hh|hxx)$/iu.test(base);
  const licenseFolder = relative.split('/').slice(0, -1).some(p => /^licen[cs]es?$/iu.test(p));
  const licenseName = /^(?:licen[cs]e|copyright|copying)(?:$|\.(?:txt|md|rst|html?|rtf|lesser|lib|gpl|lgpl|mit|apache|bsd)$|[-_][A-Za-z0-9][A-Za-z0-9._-]*)$/iu.test(base);
  const license = m.type === 'file' && !modulePath && (licenseFolder || licenseName && !headerPath);
  const pythonTree = /(?:^|\/)(?:python[^/]*|libpython[^/]*)(?:\/|$)/iu.test(relative);
  let domain = s?.domain ?? (rust ? ns.ordinal === 3 ? 'TARGET' : 'UNKNOWN' : relative.startsWith('x86_64-buildroot-linux-gnu/sysroot/') ? 'TARGET' : 'UNKNOWN');
  let disposition = 'UNREVIEWED_OMIT_NOT_RUNTIME_PROOF', destination = null, reason = 'NO_PAYLOAD_QUALIFICATION';
  const set = (d, why, dest = null, scope = domain) => { disposition = d; reason = why; destination = dest; domain = scope; };
  if (m.type === 'directory') set('DIRECTORY_DATA', 'NAMESPACE_DIRECTORY_NOT_COPY_PERMISSION', rust ? componentRelative ? 'rust/' + componentRelative : null : relative ? 'gnu/' + relative : null);
  else if (base === 'install.sh' || base === 'relocate-sdk.sh') set('OMIT_INSTALLER_SCRIPT', 'NO_SCRIPT_EXECUTION_OR_INSTALLER_AUTHORITY');
  else if (license) set('LICENSE_DATA_CANDIDATE', pythonTree ? 'EXCLUDED_PYTHON_TREE_LICENSE_DATA' : 'NO_LEGAL_CONTENT_PERMISSION_OR_COMPLIANCE_INFERENCE', 'licenses/' + ns.role.role + '/' + relative, 'DISTRIBUTION_DATA');
  else if (/\.pyc?$/u.test(base) || /(?:^|\/)(?:python[^/]*|libpython[^/]*)(?:\/|$)/iu.test(relative)
    || /(?:^|\/)pkgconfig\/[^/]*python[^/]*$/iu.test(relative) || /^(?:rust-gdb|rust-gdbgui|rust-lldb|lldb_commands)$/u.test(base)
    || /(?:^|\/)gdb(?:\/|$)|gdbinit$|pydoc/iu.test(relative)) set('OMIT_PYTHON_DEBUGGER_SUPPORT', 'PATH_POLICY_ONLY_NOT_CONTENT_OR_NO_PYTHON_PROOF');
  else if (!rust && (s?.optionalForMinimalC || /(?:^|[-/])(?:g\+\+|c\+\+)(?:[-.]\d.*)?(?:\.br_real)?$/u.test(relative)
    || /(?:^|\/)(?:bin|libexec)\//u.test(relative) && /^(?:cc1plus|lto[^/]*|liblto[^/]*)$/u.test(base)
    || /libstdc\+\+|libsupc\+\+|libcp1plugin/u.test(base))) set('OMIT_OPTIONAL_CXX_LTO_MINIMAL_C_ONLY', 'MINIMAL_C_ONLY_FUTURE_CXX_LTO_GRAPH_OPEN');
  else if (rust && (['components', 'rust-installer-version', 'manifest.in'].includes(base)
    || !relative.includes('/') && !/^(?:license|copyright|copying)/iu.test(base))) set('DISTRIBUTION_METADATA_OMIT_IMAGE', 'DISTRIBUTION_METADATA_ONLY', null, 'DISTRIBUTION_DATA');
  else if (!rust && ['share/buildroot/sdk-relocs', 'share/buildroot/sdk-location'].includes(relative)) set('METADATA_NOT_RELOCATION_AUTHORITY', 'LITERAL_SDK_METADATA_ONLY', null, 'DISTRIBUTION_DATA');
  else if (s) set('INSPECTED_TOOLCHAIN_CANDIDATE', 'SELECTED_OBSERVATION_NOT_RUNTIME_QUALIFICATION', rust ? componentRelative ? 'rust/' + componentRelative : null : 'gnu/' + relative, s.domain);
  else if (!rust && m.type === 'file' && relative.startsWith('x86_64-buildroot-linux-gnu/sysroot/usr/include/')) set('C_HEADER_DATA_CANDIDATE', 'RECORDED_HEADER_NOT_PREPROCESSOR_CLOSURE', 'gnu/' + relative, 'TARGET');
  else if (rust && declared.has(m.path) && m.type === 'file') {
    const executableHelper = /(?:^|\/)(?:bin|libexec)\//u.test(componentRelative);
    if (executableHelper) set('CANDIDATE_NEEDS_QUALIFICATION', 'UNINSPECTED_HELPER_BUILD_GRAPH_OPEN', 'rust/' + componentRelative, 'HOST');
    else if (componentRelative.startsWith('lib/')) set('RUST_LIBRARY_CANDIDATE', 'LIBRARY_PAYLOAD_AND_BUILD_GRAPH_QUALIFICATION_OPEN', 'rust/' + componentRelative, ns.ordinal === 3 ? 'TARGET' : 'HOST');
    else set('DISTRIBUTION_DATA_CANDIDATE', 'DECLARED_DATA_NOT_INSTALLER_PROOF', 'rust/' + componentRelative, 'DISTRIBUTION_DATA');
  } else if (m.type === 'symlink' || m.type === 'hardlink') set('UNREVIEWED_LINK_DATA', 'INERT_LINK_NOT_ALIAS_CREATION_AUTHORITY');
  const reasonCodes = [reason];
  if (!license && !headerPath && !modulePath && /^(?:licen[cs]e|copyright|copying)/iu.test(base)) reasonCodes.push('LICENSE_LIKE_NAME_REQUIRES_REVIEW');
  return { artifactRole: ns.role.role, index: m.index, path: m.path, type: m.type, size: m.size, bodySha256: m.bodySha256,
    domain, disposition, reasonCodes, proposedRelativeDestination: destination, bodyOffset: m.bodyOffset, mode: m.mode,
    ...(m.type !== 'file' ? { linkFollowed: false } : {}),
    ...(m.type === 'symlink' || m.type === 'hardlink' ? { rawLinkpath: m.linkpath } : {}),
    ...(s ? { sourceKind: s.kind } : {}), requiresPayloadQualification: ['CANDIDATE_NEEDS_QUALIFICATION', 'RUST_LIBRARY_CANDIDATE', 'INSPECTED_TOOLCHAIN_CANDIDATE'].includes(disposition) };
}
function destinationCollisions(ledger) {
  const map = new Map(), collisions = [];
  for (const row of ledger) {
    const key = row.proposedRelativeDestination;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  for (const [path, entries] of map) {
    const parts = path.split('/'), ancestors = [];
    while (parts.length > 1) { parts.pop(); const p = parts.join('/'); if (map.get(p)?.some(r => r.kind === 'file')) ancestors.push(p); }
    const repeatedDirectoryOnly = entries.length > 1 && entries.every(r => r.kind === 'dir');
    if (entries.length > 1 || ancestors.length) {
      const blocked = !repeatedDirectoryOnly && entries.length > 1 || ancestors.length > 0;
      collisions.push({ proposedRelativeDestination: path, declarationCount: entries.length, repeatedDirectoryOnly, fileAncestors: ancestors,
        blocked, status: blocked ? 'BLOCKED_DESTINATION_COLLISION' : 'REPEATED_DIRECTORY_DATA' });
      if (blocked) {
        for (const row of entries) row.proposedDestinationStatus = 'BLOCKED_DESTINATION_COLLISION';
        for (const ancestor of ancestors) for (const row of map.get(ancestor)) row.proposedDestinationStatus = 'BLOCKED_DESTINATION_COLLISION';
      }
    }
  }
  return collisions;
}
function linkerReferences(ns, limits) {
  const ledger = [], sysroot = ns.root + '/x86_64-buildroot-linux-gnu/sysroot';
  for (const s of ns.role.selected) if (s.kind === 'LINKER_TEXT') {
    const observation = s.metadata?.observation;
    if (!observation || observation.state !== 'GNU_LD_REFERENCE_DATA' || observation.evaluated !== false
      || observation.hostResolutionAttempted !== false || !Array.isArray(observation.references)) fail('E_PLAN_LINKER');
    for (const r of observation.references) {
      exact(r, ['literal', 'directive', 'kind', 'requiresApprovedSysrootMapping', 'followed']);
      if (typeof r.literal !== 'string' || !r.literal || r.literal.length > 1024 || /[^\x21-\x7e]|\\/u.test(r.literal)
        || !['INPUT', 'GROUP', 'AS_NEEDED'].includes(r.directive) || r.followed !== false || r.requiresApprovedSysrootMapping !== true
        || r.kind !== 'LINKER_REFERENCE_DATA_NOT_HOST_PERMISSION') fail('E_PLAN_LINKER');
      let paths = [], mapping = 'UNSUPPORTED_LITERAL', match;
      if (ns.ordinal === 0 && r.literal === '-lgcc') {
        mapping = 'EXPLICIT_PROPOSED_GCC_SEARCH_NOT_LINKER_SEARCH_PROOF';
        paths = [ns.root + '/lib/gcc/x86_64-buildroot-linux-gnu/15.3.0', sysroot + '/usr/lib', sysroot + '/lib']
          .flatMap(p => [p + '/libgcc.so', p + '/libgcc.a']);
        const attempts = paths.map(p => ({ proposedPath: p, ...resolve(ns, p, limits) }));
        const matches = attempts.filter(a => a.terminalIndex !== null), unique = new Map(matches.map(a => [a.terminalIndex, a]));
        match = unique.size === 1 ? [...unique.values()][0] : { status: unique.size ? 'UNRESOLVED_AMBIGUOUS_GCC_LIBRARY' : 'UNRESOLVED_GCC_LIBRARY', namespaceHops: [], terminalIndex: null, terminalPath: null, terminalBodySha256: null };
        match = { ...match, searchAttempts: attempts };
      } else if (ns.ordinal === 0 && /^\/(?:lib64|usr\/lib64)\//u.test(r.literal) && canonical(r.literal.slice(1))) {
        mapping = 'PROPOSED_SYSROOT_MAPPING_NOT_APPROVED'; paths = [sysroot + r.literal];
      } else if (!r.literal.startsWith('-') && canonical(r.literal)) {
        mapping = 'RECORDED_SCRIPT_SIBLING_NAMESPACE'; paths = [s.path.slice(0, s.path.lastIndexOf('/') + 1) + r.literal];
      }
      match ??= paths.length ? resolve(ns, paths[0], limits) : { status: 'UNRESOLVED_UNSUPPORTED_LITERAL', namespaceHops: [], terminalIndex: null, terminalPath: null, terminalBodySha256: null };
      const terminalDomain = match.terminalPath ? ns.selected.get(match.terminalPath)?.domain
        ?? (ns.ordinal === 0 && match.terminalPath.startsWith(sysroot + '/') ? 'TARGET' : ns.ordinal > 0 ? ns.ordinal === 3 ? 'TARGET' : 'HOST' : 'UNKNOWN') : 'UNKNOWN';
      if (terminalDomain !== 'UNKNOWN' && terminalDomain !== s.domain) match = { ...match, status: 'UNRESOLVED_CROSS_DOMAIN_REFERENCE' };
      ledger.push({ artifactRole: ns.role.role, sourceIndex: s.index, sourcePath: s.path, sourceBodySha256: s.bodySha256,
        rawToken: r.literal, directive: r.directive, mapping, proposedPaths: paths, ...match,
        sourceDomain: s.domain, terminalDomain, hostTargetPromotion: false,
        requiresApprovedSysrootMapping: ns.ordinal === 0, mappingApproved: false, qualificationStatus: 'UNRESOLVED',
        evaluated: false, hostResolutionAttempted: false, linkerProof: false });
    }
  }
  return ledger;
}
function relocation(ns, rows, mockOnly, limits) {
  const relocs = ns.manifests.get(ns.root + '/share/buildroot/sdk-relocs'), location = ns.manifests.get(ns.root + '/share/buildroot/sdk-location');
  if (ns.manifests.size !== 2 || !relocs || !location || [relocs, location].some(t => t.kind !== 'GNU_RAW_TEXT' || t.declarations.length)) fail('E_PLAN_RELOCATION');
  if (!mockOnly && (relocs.text.length !== 9367 || relocs.bodySha256 !== relocPin || location.text.length !== 79 || location.bodySha256 !== locationPin)) fail('E_PLAN_RELOCATION');
  const seen = new Set(), references = [];
  for (const { rawLine: rawReference, lineNumber } of textLines(relocs.text)) {
    if (references.length >= limits.maxDeclarations) fail('E_PLAN_RELOCATION');
    const relative = rawReference.startsWith('./') ? rawReference.slice(2) : rawReference;
    if (!canonical(relative) || seen.has(relative)) fail('E_PLAN_RELOCATION'); seen.add(relative);
    const path = ns.root + '/' + relative, m = ns.map.get(path), row = m ? rows.get(path) : null;
    references.push({ lineNumber, rawReference, relativePath: relative, path,
      status: m?.type === 'file' ? 'REGULAR_FILE' : 'UNRESOLVED_WHOLE_SDK_CONTEXT', sourceIndex: m?.index ?? null,
      bodySha256: m?.type === 'file' ? m.bodySha256 : null, memberDisposition: row?.disposition ?? null,
      relocationSuccessful: false, assumedMinimalCBlocker: false });
  }
  const regularFiles = references.filter(r => r.status === 'REGULAR_FILE').length;
  if (!mockOnly && (references.length !== 190 || regularFiles !== 152 || references.length - regularFiles !== 38)) fail('E_PLAN_RELOCATION');
  return { interpretation: 'METADATA_NOT_RELOCATION_AUTHORITY', locationPrefixData: location.text,
    locationBodySha256: location.bodySha256, manifestBodySha256: relocs.bodySha256, totalReferences: references.length,
    regularFiles, unresolvedWholeSdkContext: references.length - regularFiles, references, relocationReady: false };
}
function derive(input, limits, mockOnly) {
  const e = snapshot(input, limits).value;
  exact(e, ['receipt', 'gnu', 'rust', 'host']); exact(e.gnu, ['result', 'acceptance']); exact(e.host, ['result', 'receipt']);
  if (!Array.isArray(e.rust) || e.rust.length !== 5) fail('E_PLAN_SCHEMA');
  for (let i = 0; i < 5; i++) { exact(e.rust[i], ['role', 'result', 'acceptance']); if (e.rust[i].role !== roles[i + 1]) fail('E_PLAN_ROLE'); }
  const sources = [e.gnu, ...e.rust];
  if (!mockOnly) {
    if (snapshotHash(e.receipt) !== receiptPin || snapshotHash(e.host.result) !== hostPin || snapshotHash(e.host.receipt) !== hostReceiptPin) fail('E_PLAN_ACCEPTED_SNAPSHOT');
    sources.forEach((s, i) => { if (snapshotHash(s.result) !== resultPins[i] || snapshotHash(s.acceptance) !== acceptancePins[i]) fail('E_PLAN_ACCEPTED_SNAPSHOT'); });
  }
  const namespaces = sources.map((s, i) => {
    const c = s.result?.collection;
    if (!c || c.artifactCount !== 1 || !Array.isArray(c.roles) || c.roles.length !== 1 || c.completeNamespace !== true) fail('E_PLAN_COLLECTION');
    const ns = namespace(c.roles[0], i, limits);
    if (c.entries !== ns.role.entries || c.regularFiles !== ns.role.regularFiles || c.expandedBytes !== ns.role.expandedBytes
      || c.selectedPayloads !== ns.selected.size) fail('E_PLAN_COLLECTION');
    if (counts[i].some((n, j) => mockOnly ? n < [c.entries, c.regularFiles, c.expandedBytes, c.selectedPayloads][j]
      : n !== [c.entries, c.regularFiles, c.expandedBytes, c.selectedPayloads][j])) fail('E_PLAN_COUNTS');
    return ns;
  });
  const totals = namespaces.reduce((a, n) => ({ entries: a.entries + n.map.size, regularFiles: a.regularFiles + n.role.regularFiles,
    expandedBytes: a.expandedBytes + n.role.expandedBytes, selectedPayloads: a.selectedPayloads + n.selected.size }), { entries: 0, regularFiles: 0, expandedBytes: 0, selectedPayloads: 0 });
  if (totals.entries > limits.maxMembers || totals.expandedBytes > limits.maxExpandedBytes) fail('E_PLAN_LIMIT');
  const declarations = [], unknownManifestLines = [], members = [], byNamespace = [], linkerInputReferences = [], aliasReferences = [];
  for (const ns of namespaces) {
    const declared = ns.ordinal ? rustDeclarations(ns, declarations, unknownManifestLines, limits) : new Map();
    const rows = new Map(); byNamespace.push(rows);
    for (const m of ns.role.members) { const row = classify(ns, m, declared); members.push(row); rows.set(m.path, row); }
    if (ns.ordinal === 0) for (const m of ns.role.members) if (['symlink', 'hardlink'].includes(m.type)) {
      const row = rows.get(m.path), resolved = resolve(ns, m.path, limits), terminal = rows.get(resolved.terminalPath);
      const supportsCandidate = row.disposition === 'UNREVIEWED_LINK_DATA' && terminal
        && ['INSPECTED_TOOLCHAIN_CANDIDATE', 'C_HEADER_DATA_CANDIDATE'].includes(terminal.disposition)
        && (row.domain === 'UNKNOWN' || row.domain === terminal.domain);
      if (row.domain !== 'UNKNOWN' && terminal && row.domain !== terminal.domain) row.reasonCodes.push('CROSS_DOMAIN_ALIAS_NOT_PROMOTED');
      if (supportsCandidate) {
        row.disposition = 'ALIAS_DATA_CANDIDATE'; row.reasonCodes.push('INERT_RECORDED_NAMESPACE_ALIAS_NOT_CREATION_AUTHORITY');
        row.proposedRelativeDestination = 'gnu/' + m.path.slice(ns.root.length + 1); row.domain = terminal.domain;
      }
      aliasReferences.push({ artifactRole: ns.role.role, sourceIndex: m.index, path: m.path, rawLinkpath: m.linkpath,
        ...resolved, supportsCandidate: Boolean(supportsCandidate), aliasCreationAuthorized: false, hostFollowed: false });
    }
    linkerInputReferences.push(...linkerReferences(ns, limits));
  }
  const collisions = destinationCollisions(declarations);
  for (const row of declarations) {
    const member = byNamespace[roles.indexOf(row.artifactRole)].get(row.sourcePath);
    row.disposition = member?.disposition ?? 'UNRESOLVED_DECLARED_MEMBER';
    if (row.proposedDestinationStatus === 'BLOCKED_DESTINATION_COLLISION' && member) {
      if (!member.reasonCodes.includes('PROPOSED_INSTALL_DESTINATION_COLLISION')) member.reasonCodes.push('PROPOSED_INSTALL_DESTINATION_COLLISION');
      member.proposedDestinationStatus = 'BLOCKED_DESTINATION_COLLISION';
    }
  }
  const gnuRelocation = relocation(namespaces[0], byNamespace[0], mockOnly, limits);
  const headers = members.filter(m => m.artifactRole === 'gnu-sdk' && m.disposition === 'C_HEADER_DATA_CANDIDATE');
  if (!mockOnly && (declarations.length !== 157 || declarations.some(r => r.kind !== 'file' || r.status !== 'DECLARED_MEMBER_MATCH_NOT_INSTALLER_PROOF') || headers.length !== 1434)) fail('E_PLAN_COUNTS');
  const byDisposition = Object.create(null), byRole = Object.create(null);
  for (const role of roles) byRole[role] = { entries: 0, regularFiles: 0, selectedPayloads: namespaces[roles.indexOf(role)].selected.size, byDisposition: Object.create(null) };
  for (const row of members) {
    byDisposition[row.disposition] = (byDisposition[row.disposition] ?? 0) + 1;
    const count = byRole[row.artifactRole]; count.entries++; count.regularFiles += Number(row.type === 'file');
    count.byDisposition[row.disposition] = (count.byDisposition[row.disposition] ?? 0) + 1;
  }
  const report = { profile: 'TOOLCHAIN_MEMBER_DISPOSITION_DATA', scope: 'PROPOSED_DISPOSITIONS_NOT_COPY_OR_IMAGE_AUTHORITY',
    mockOnly, callerInputsAuthenticated: false, acceptedSnapshotAssertionsMatched: !mockOnly, actualEvidenceProofClaimed: false,
    minimalCProfile: true, ...negatives, artifactCount: 6, roleOrder: [...roles], counts: { ...totals, byDisposition, byRole },
    sourceRootAuthority: { scope: 'METADATA_FALSE_DEFAULTS', authenticated: false, runtimeAuthority: false },
    members, rustDeclarations: declarations, unknownManifestLines, proposedDestinationCollisions: collisions,
    proposedDestinationsBlocked: collisions.some(c => c.blocked), gnuRelocation, linkerInputReferences, aliasReferences,
    headerAliasClosure: { regularHeaderCount: headers.length, regularHeaderNames: headers.map(r => r.path),
      aliasReferenceCount: aliasReferences.filter(a => a.supportsCandidate && headers.some(h => h.index === a.terminalIndex)).length,
      includeClosureVerified: false, sysrootClosureVerified: false, toolchainClosureVerified: false },
    hostCandidates: e.host.result.candidates ?? [], hostCandidateScope: 'HOST_DECLARATION_DATA_NEVER_TARGET_PROVIDERS',
    dependencyDeclarationComparison: { qualificationStatus: 'UNRESOLVED', nameVersionMatchesAreNotAbiProof: true,
      hostTargetPromotion: false, acceptedParentComparison: e.receipt.declarationComparison ?? null },
    licenseDataScope: 'PATH_CANDIDATES_ONLY_NO_CONTENT_OR_LEGAL_CLASSIFICATION',
    licenseDataGaps: roles.filter(role => !members.some(m => m.artifactRole === role && m.disposition === 'LICENSE_DATA_CANDIDATE')),
    gnuLicenseCoverage: { status: 'NAMES_ONLY_GNU_C_GCC_LICENSE_SOURCE_CONTEXT_UNQUALIFIED',
      gnuCGccLicenseCoverageVerified: false, sourcePackageContextVerified: false, licenseContentsInspected: false },
    blockers: ['CALLER_RAW_INPUT_PINNING_REQUIRED', 'NO_COPY_EXTRACTION_OR_IMAGE_AUTHORITY', 'GNU_SYSROOT_MAPPING_NOT_APPROVED',
      'LINKER_AND_LOADER_CLOSURE_NOT_QUALIFIED', 'RUST_HELPERS_AND_LIBRARY_PAYLOADS_REQUIRE_QUALIFICATION',
      'FUTURE_CXX_LTO_PROC_MACRO_BACKEND_BUILD_GRAPH_OPEN', 'INSTALLER_INTERPRETATION_NOT_VERIFIED', 'LICENSE_COMPLIANCE_NOT_ASSESSED'],
    constraints: { ...limits } };
  snapshot(report, limits, limits.maxOutputBytes - 1);
  return freeze(report);
}

export function deriveToolchainMemberPlan(evidence) {
  if (arguments.length !== 1) fail('E_PLAN_ARGUMENTS');
  return derive(evidence, TOOLCHAIN_MEMBER_PLAN_LIMITS, false);
}
export function deriveToolchainMemberPlanForTest(evidence, loweredLimits = {}) {
  if (arguments.length < 1 || arguments.length > 2) fail('E_PLAN_ARGUMENTS');
  return derive(evidence, lower(loweredLimits), true);
}
export function encodeToolchainMemberPlan(report) {
  if (arguments.length !== 1) fail('E_PLAN_ARGUMENTS');
  const { value } = snapshot(report, TOOLCHAIN_MEMBER_PLAN_LIMITS, TOOLCHAIN_MEMBER_PLAN_LIMITS.maxOutputBytes - 1);
  return JSON.stringify(value).replace(/[\u0080-\uffff]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')) + '\n';
}
