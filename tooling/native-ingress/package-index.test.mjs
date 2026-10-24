// SPEC: _spec/tooling/native-ingress/package-index.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PACKAGE_INDEX_LIMITS, PackageIndexError, selectPackageReferences } from './package-index.mjs';

const sha = '0123456789abcdef'.repeat(4);
const version = '5.8.3-1';
const filename = 'pool/main/x/xz-utils/xz-utils_5.8.3-1_amd64.deb';
const target = Object.freeze({ package: 'xz-utils', version, architecture: 'amd64', sourcePackage: 'xz-utils', sourceVersion: version });
const golden = 'Package: xz-utils\nVersion: 5.8.3-1\nArchitecture: amd64\nFilename: pool/main/x/xz-utils/xz-utils_5.8.3-1_amd64.deb\nSize: 123\nSHA256: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const goldenSha256 = 'df2ddb86f863cf5cfea8266021c65f3a7d780fbd0bc1557ea15fa593c966dba1';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const reference = bytes => ({ byteLength: bytes.length, sha256: digest(bytes) });

function stanza(options = {}) {
  const fields = {
    Package: 'xz-utils', Version: version, Architecture: 'amd64',
    Filename: filename, Size: '123', SHA256: sha,
    ...options,
  };
  const lines = [];
  for (const [name, value] of Object.entries(fields)) if (value !== undefined) lines.push(`${name}: ${value}`);
  return lines.join('\n');
}

function run(text = golden, targets = [target], overrides = {}) {
  const bytes = typeof text === 'string' ? Buffer.from(text, 'utf8') : text;
  return selectPackageReferences(bytes, reference(bytes), targets, overrides);
}

function rejects(action, code) {
  assert.throws(action, error => {
    assert.ok(error instanceof PackageIndexError);
    assert.equal(error.name, 'PackageIndexError');
    assert.equal(error.message, error.code);
    assert.equal(error.code, code);
    assert.ok(Object.isFrozen(error));
    assert.equal(error.packages, undefined);
    assert.equal(error.cause, undefined);
    return true;
  });
}

test('literal golden index has the pinned full-byte SHA256', () => {
  const bytes = Buffer.from(golden);
  assert.equal(digest(bytes), goldenSha256);
  const result = selectPackageReferences(bytes, { byteLength: bytes.length, sha256: goldenSha256 }, [target]);
  assert.deepEqual(result, {
    profile: 'ubuntu-package-index-refs-v1', indexBytesMatched: true, byteLength: bytes.length,
    inputSha256: goldenSha256,
    packages: [{ package: 'xz-utils', version, architecture: 'amd64', sourcePackage: 'xz-utils',
      sourceVersion: version, filename, byteLength: 123, sha256: sha }],
    signatureVerified: false, provenanceVerified: false, sourceAuthenticated: false,
    nativeQualified: false, decoderQualified: false, rustReady: false, trainingReady: false,
  });
});

test('matching bytes never authenticate the publisher or mint readiness', () => {
  const result = run();
  for (const key of ['signatureVerified', 'provenanceVerified', 'sourceAuthenticated', 'nativeQualified', 'decoderQualified', 'rustReady', 'trainingReady']) assert.equal(result[key], false);
  assert.equal(result.publisherTrustEstablished, undefined);
});

test('exact package/version/architecture selection ignores older, newer and amd64v3 stanzas', () => {
  const text = [stanza({ Version: '5.8.2-1' }), stanza({ Version: '5.8.4-1' }),
    stanza({ Architecture: 'amd64v3' }), stanza({ Package: 'xz-utils-extra' }), golden].join('\n\n');
  assert.deepEqual(run(text).packages, run().packages);
});

test('an exact architecture literal can be requested without prefix matching', () => {
  const other = { ...target, architecture: 'arm64' };
  assert.equal(run(stanza({ Architecture: 'arm64' }), [other]).packages[0].architecture, 'arm64');
  rejects(() => run(stanza({ Architecture: 'amd64v3' })), 'E_PACKAGE');
});

test('output follows request order rather than index order', () => {
  const lib = { ...target, package: 'liblzma5' };
  const text = golden + '\n\n' + stanza({ Package: 'liblzma5', Source: 'xz-utils', Filename: 'pool/main/x/xz-utils/liblzma5.deb' });
  assert.deepEqual(run(text, [lib, target]).packages.map(value => value.package), ['liblzma5', 'xz-utils']);
});

test('absent Source falls back to the binary package and binary version', () => {
  assert.equal(run().packages[0].sourcePackage, target.package);
  assert.equal(run().packages[0].sourceVersion, target.version);
  rejects(() => run(golden, [{ ...target, sourcePackage: 'other' }]), 'E_PACKAGE');
});

test('Source name without a version inherits the exact binary version', () => {
  const lib = { ...target, package: 'liblzma5' };
  const selected = run(stanza({ Package: 'liblzma5', Source: 'xz-utils' }), [lib]).packages[0];
  assert.equal(selected.sourcePackage, 'xz-utils');
  assert.equal(selected.sourceVersion, version);
});

test('explicit source version remains distinct from the binary version', () => {
  const lib = { ...target, package: 'liblzma5', version: '1:5.8.3~rc1+git-2', sourceVersion: '1:5.8.3~rc1+git-1' };
  const text = stanza({ Package: lib.package, Version: lib.version, Source: `xz-utils (${lib.sourceVersion})` });
  const result = run(text, [lib]).packages[0];
  assert.equal(result.version, lib.version);
  assert.equal(result.sourceVersion, lib.sourceVersion);
  rejects(() => run(text, [{ ...lib, sourceVersion: lib.version }]), 'E_PACKAGE');
  rejects(() => run(text, [{ ...lib, sourcePackage: 'other' }]), 'E_PACKAGE');
});

test('Source folding and case-insensitive field names preserve complete values', () => {
  const text = stanza({ Source: 'xz-utils\n\t(5.8.3-1)' }).replace('Package:', 'pAcKaGe:').replace('SHA256:', 'sHa256:');
  assert.equal(run(text).packages[0].sourceVersion, version);
  const sourceLength = 'xz-utils (5.8.3-1)'.length;
  assert.equal(run(text, [target], { maxValueBytes: Math.max(sourceLength, filename.length, sha.length) }).packages[0].sourcePackage, 'xz-utils');
});

for (const source of ['', 'xz-utils ()', 'xz-utils (5.8.3-1) extra', 'xz-utils (= 5.8.3-1)', 'xz-utils [amd64]',
  'xz-utils (5.8.3-1', 'xz-utils  (5.8.3-1)', 'xz-utils (5.8.3-1 )', 'XZ-utils', 'xz-utils\t(5.8.3-1)', 'xz-utils (v1)', 'xz-utils (1\t2)']) {
  test(`malformed Source ${JSON.stringify(source)} rejects`, () => {
    rejects(() => run(stanza({ Source: source })), 'E_PACKAGE');
  });
}

for (const name of ['Package', 'Version', 'Architecture', 'Source', 'Filename', 'Size', 'SHA256']) {
  test(`duplicate ${name} and its case variant reject`, () => {
    const text = stanza({ Source: 'xz-utils' }) + `\n${name.toLowerCase()}: duplicate\n continuation`;
    rejects(() => run(text), 'E_PACKAGE');
  });
}

test('duplicates in unused fields and unselected paragraphs also reject', () => {
  rejects(() => run(golden + '\nDescription: one\ndescription: two'), 'E_PACKAGE');
  rejects(() => run(golden + '\n\nPackage: other\nPackage: again'), 'E_PACKAGE');
});

test('unknown continuations never attach themselves to the previous reported field', () => {
  const text = golden + '\nDescription: not emitted\n more private text\nMaintainer: not emitted\n folded';
  const result = run(text);
  assert.deepEqual(result.packages, run().packages);
  assert.equal(JSON.stringify(result).includes('private'), false);
  assert.equal(JSON.stringify(result).includes('Maintainer'), false);
});

test('unselected large values remain irrelevant within the paragraph ceiling', () => {
  const text = 'Package: other\nDescription: ' + 'é'.repeat(2000) + '\n unicode continuation\n\n' + golden;
  assert.equal(run(text, [target], { maxParagraphBytes: 5000, maxValueBytes: 64 }).packages.length, 1);
});

test('complete folded reported values cannot bypass the value ceiling', () => {
  const full = 'pool/' + 'a'.repeat(1015) + '.deb';
  assert.equal(full.length, 1024);
  assert.equal(run(stanza({ Filename: full })).packages[0].filename, full);
  rejects(() => run(stanza({ Filename: full + 'a.deb' })), 'E_PACKAGE');
  rejects(() => run(stanza({ Filename: filename + '\n ' + 'a'.repeat(1024) })), 'E_PACKAGE');
  rejects(() => run(stanza({ Source: 'xz-utils\n (' + '1'.repeat(1024) + ')' })), 'E_PACKAGE');
});

test('selected values reject nonASCII and controls instead of trimming them away', () => {
  for (const text of [stanza({ Filename: '\u00a0' + filename }), stanza({ Filename: filename + '\u00a0' }),
    stanza({ Source: 'xz-utils\u0085' }), stanza({ Filename: 'pool/é.deb' }), stanza({ Filename: 'pool/a\t.deb' }),
    stanza({ Size: '12\t3' }), stanza({ SHA256: sha + '\n tail' })]) {
    rejects(() => run(text), 'E_PACKAGE');
  }
});

test('folded Filename and Size values cannot create multiple references or tokens', () => {
  rejects(() => run(stanza({ Filename: filename + '\n pool/other.deb' })), 'E_PACKAGE');
  rejects(() => run(stanza({ Size: '1\n 23' })), 'E_PACKAGE');
});

for (const name of ['Package', 'Version', 'Architecture', 'Filename', 'Size', 'SHA256']) {
  test(`selected mandatory ${name} cannot be missing`, () => {
    rejects(() => run(stanza({ [name]: undefined })), 'E_PACKAGE');
  });
}

test('every expected target must appear before any reference escapes', () => {
  rejects(() => run(golden, [target, { ...target, package: 'missing' }]), 'E_PACKAGE');
  rejects(() => run(stanza({ Version: '5.8.3-2' })), 'E_PACKAGE');
});

test('a late duplicate matching triplet rejects after a valid prefix', () => {
  const text = golden + '\n\nPackage: unrelated\nDescription: inert\n\n' + stanza({ Filename: 'pool/other.deb' });
  rejects(() => run(text), 'E_AMBIGUOUS');
});

test('a malformed tail after all selected targets still rejects', () => {
  rejects(() => run(golden + '\n\nmalformed tail'), 'E_PACKAGE');
  rejects(() => run(golden + '\n\n orphan continuation'), 'E_PACKAGE');
});

test('different versions of the same package do not create ambiguity', () => {
  assert.equal(run(golden + '\n\n' + stanza({ Version: '5.8.2-1' })).packages.length, 1);
  const earlier = { ...target, version: '5.8.2-1', sourceVersion: '5.8.2-1' };
  assert.deepEqual(run(golden + '\n\n' + stanza({ Version: earlier.version }), [earlier, target]).packages.map(value => value.version), ['5.8.2-1', version]);
});

test('a pool filename containing @ stays an inert string', () => {
  const value = 'pool/main/x/xz-utils/xz-utils_1@2+3-4_amd64.deb';
  const result = run(stanza({ Filename: value }));
  assert.equal(result.packages[0].filename, value);
  assert.equal(result.packages[0].url, undefined);
  assert.equal(result.packages[0].resolvedPath, undefined);
});

for (const value of ['/pool/a.deb', 'main/a.deb', 'pool/../a.deb', 'pool/./a.deb', 'pool//a.deb',
  'pool/a%2f.deb', 'pool/a%20.deb', 'pool/a\\b.deb', 'pool/a:b.deb', 'pool/a?.deb', 'pool/a#.deb',
  'pool/.deb/', 'pool/a.DEB', 'pool/a.deb/..', 'pool/', 'pool/a.deb\n /next']) {
  test(`unsafe Filename ${JSON.stringify(value)} rejects`, () => rejects(() => run(stanza({ Filename: value })), 'E_PACKAGE'));
}

for (const value of ['0', '00', '01', '-1', '+1', '1.0', '1e2', '8388609', '9007199254740992', '1 2']) {
  test(`noncanonical or oversized Size ${value} rejects`, () => rejects(() => run(stanza({ Size: value })), 'E_PACKAGE'));
}

test('package byte bounds are inclusive and never load package bytes', () => {
  for (const size of [1, 8388608]) assert.equal(run(stanza({ Size: String(size) })).packages[0].byteLength, size);
  assert.equal(run(golden, [target], { maxPackageBytes: 123 }).packages[0].byteLength, 123);
  rejects(() => run(golden, [target], { maxPackageBytes: 122 }), 'E_PACKAGE');
});

for (const value of [sha.toUpperCase(), sha.slice(1), sha + '0', 'g'.repeat(64), '']) {
  test(`SHA256 is exact lowercase hexadecimal ${JSON.stringify(value)}`, () => rejects(() => run(stanza({ SHA256: value })), 'E_PACKAGE'));
}

test('the entire input length and SHA256 match before any syntax or UTF8 parsing', () => {
  const bytes = Buffer.from([255, 0, 13]);
  rejects(() => selectPackageReferences(bytes, { byteLength: bytes.length, sha256: '0'.repeat(64) }, [target]), 'E_HASH');
  rejects(() => selectPackageReferences(bytes, { byteLength: bytes.length + 1, sha256: digest(bytes) }, [target]), 'E_HASH');
  rejects(() => selectPackageReferences(bytes, reference(bytes), [target]), 'E_PACKAGE');
  const malformed = Buffer.from('bad private index');
  rejects(() => selectPackageReferences(malformed, { byteLength: malformed.length, sha256: '0'.repeat(64) }, [target]), 'E_HASH');
});

test('a matching prefix never substitutes for hashing the full index', () => {
  const bytes = Buffer.from(golden + '\n\nPackage: other');
  rejects(() => selectPackageReferences(bytes, reference(Buffer.from(golden)), [target]), 'E_HASH');
  rejects(() => selectPackageReferences(bytes, { byteLength: bytes.length, sha256: digest(Buffer.from(golden)) }, [target]), 'E_HASH');
});

test('index reference accepts only exact own-data length/hash properties', () => {
  const bytes = Buffer.from(golden);
  const ref = reference(bytes);
  const accessor = { ...ref };
  Object.defineProperty(accessor, 'sha256', { get() { assert.fail('reference getter'); } });
  const invalid = [null, [], { ...ref, filename }, { sha256: ref.sha256 }, accessor,
    Object.create(ref), new Proxy(ref, { ownKeys() { assert.fail('reference proxy'); } }),
    { ...ref, byteLength: 0 }, { ...ref, byteLength: 16777217 }, { ...ref, byteLength: 1.5 },
    { ...ref, byteLength: NaN }, { ...ref, byteLength: '1' }, { ...ref, sha256: ref.sha256.toUpperCase() },
    { ...ref, sha256: 'g'.repeat(64) }, { ...ref, sha256: new String(ref.sha256) }, { ...ref, [Symbol('hidden')]: 1 }];
  for (const value of invalid) rejects(() => selectPackageReferences(bytes, value, [target]), 'E_INPUT');
  assert.equal(selectPackageReferences(bytes, Object.assign(Object.create(null), ref), [target]).indexBytesMatched, true);
  rejects(() => selectPackageReferences(bytes, { ...ref, byteLength: 16777216 }, [target]), 'E_HASH');
});

test('expected package arrays reject holes, accessors, proxies and extra properties', () => {
  const getterArray = [target];
  Object.defineProperty(getterArray, '0', { get() { assert.fail('array getter'); } });
  const extra = [target];
  extra.extra = 'private';
  const symbol = [target];
  symbol[Symbol('private')] = 1;
  const sparse = new Array(1);
  const disguised = new Array(2);
  disguised[1] = target;
  disguised.extra = 1;
  class Custom extends Array {}
  for (const value of [null, {}, [], sparse, disguised, getterArray, extra, symbol, new Custom(target),
    new Proxy([target], { getPrototypeOf() { assert.fail('array proxy'); } }), Array(9).fill(target)]) {
    rejects(() => run(golden, value), 'E_INPUT');
  }
});

test('expected records contain exactly five own-data identity strings', () => {
  const accessor = { ...target };
  Object.defineProperty(accessor, 'version', { get() { assert.fail('target getter'); } });
  const missing = { ...target };
  delete missing.sourceVersion;
  const invalid = [null, [], missing, { ...target, filename }, accessor, Object.create(target),
    new Proxy(target, { ownKeys() { assert.fail('target proxy'); } }), { ...target, [Symbol('private')]: 1 },
    { ...target, package: '' }, { ...target, package: 'x'.repeat(257) }, { ...target, version: 1 },
    { ...target, version: ' 1' }, { ...target, version: '1 ' }, { ...target, version: '1\t2' },
    { ...target, package: 'XZ-utils' }, { ...target, sourcePackage: 'bad_name' },
    { ...target, architecture: 'amd64/v3' }, { ...target, version: 'v1' }, { ...target, sourceVersion: '1 (bad)' }];
  for (const value of invalid) rejects(() => run(golden, [value]), 'E_INPUT');
  assert.equal(run(golden, [Object.assign(Object.create(null), target)]).packages.length, 1);
});

test('duplicate expected triplets reject even when source expectations differ', () => {
  rejects(() => run(golden, [target, { ...target, sourceVersion: '1' }]), 'E_INPUT');
});

test('selected target limit tightens the fixed eight-target ceiling', () => {
  const other = { ...target, package: 'other', sourcePackage: 'other' };
  const text = golden + '\n\n' + stanza({ Package: 'other' });
  assert.equal(run(text, [target, other], { maxSelected: 2 }).packages.length, 2);
  rejects(() => run(text, [target, other], { maxSelected: 1 }), 'E_INPUT');
});

test('all eight expected identities remain ordered and independently required', () => {
  const targets = [];
  const paragraphs = [];
  for (let index = 0; index < 8; index++) {
    const name = `package-${index}`;
    targets.push({ ...target, package: name, sourcePackage: name });
    paragraphs.unshift(stanza({ Package: name }));
  }
  const selected = run(paragraphs.join('\n\n'), targets).packages;
  assert.deepEqual(selected.map(value => value.package), targets.map(value => value.package));
  paragraphs.pop();
  rejects(() => run(paragraphs.join('\n\n'), targets), 'E_PACKAGE');
});

test('every limit accepts only positive safe integers no larger than its fixed ceiling', () => {
  for (const [key, ceiling] of Object.entries(PACKAGE_INDEX_LIMITS)) {
    for (const value of [0, -1, 1.5, NaN, Infinity, '1', 1n, ceiling + 1]) {
      rejects(() => run(golden, [target], { [key]: value }), 'E_LIMITS');
    }
    assert.equal(run(golden, [target], { [key]: ceiling }).packages.length, 1);
  }
  assert.ok(Object.isFrozen(PACKAGE_INDEX_LIMITS));
  assert.deepEqual(PACKAGE_INDEX_LIMITS, { maxInputBytes: 16777216, maxParagraphBytes: 131072,
    maxParagraphs: 65536, maxSelected: 8, maxValueBytes: 1024, maxPackageBytes: 8388608, maxOutputBytes: 65536 });
});

test('limit records reject unknown, inherited, accessor, symbol and proxy properties', () => {
  const accessor = {};
  Object.defineProperty(accessor, 'maxInputBytes', { get() { assert.fail('limit getter'); } });
  for (const value of [null, [], accessor, { unknown: 1 }, { filename }, { callback() {} },
    Object.create({ maxInputBytes: 1 }), { [Symbol('limit')]: 1 },
    new Proxy({}, { ownKeys() { assert.fail('limit proxy'); } })]) {
    rejects(() => run(golden, [target], value), 'E_LIMITS');
  }
  assert.equal(run(golden, [target], Object.create(null)).packages.length, 1);
});

test('input byte ceiling is checked before copying or parsing', () => {
  const length = Buffer.byteLength(golden);
  assert.equal(run(golden, [target], { maxInputBytes: length }).byteLength, length);
  rejects(() => run(golden, [target], { maxInputBytes: length - 1 }), 'E_INPUT');
});

test('paragraph byte ceiling counts full UTF8 including unselected metadata', () => {
  const padding = 'Description: ' + 'é'.repeat(200);
  const text = padding + '\n\n' + golden;
  const bytes = Buffer.byteLength(padding);
  assert.equal(run(text, [target], { maxParagraphBytes: bytes }).packages.length, 1);
  rejects(() => run(text, [target], { maxParagraphBytes: bytes - 1 }), 'E_PACKAGE');
});

test('paragraph ceiling counts unselected paragraphs after a selected prefix', () => {
  const text = golden + '\n\nPackage: other\n\nPackage: third';
  assert.equal(run(text, [target], { maxParagraphs: 3 }).packages.length, 1);
  rejects(() => run(text, [target], { maxParagraphs: 2 }), 'E_PACKAGE');
});

test('value ceiling counts complete folded UTF8 values before field-specific parsing', () => {
  const value = 'pool/' + 'a'.repeat(80) + '.deb';
  assert.equal(run(stanza({ Filename: value }), [target], { maxValueBytes: value.length }).packages[0].filename, value);
  rejects(() => run(stanza({ Filename: value }), [target], { maxValueBytes: value.length - 1 }), 'E_PACKAGE');
  const longVersion = '1'.repeat(70);
  const wanted = { ...target, version: longVersion, sourceVersion: longVersion };
  const text = stanza({ Version: longVersion, Source: 'xz-utils\n (' + longVersion + ')' });
  const complete = 'xz-utils (' + longVersion + ')';
  assert.equal(run(text, [wanted], { maxValueBytes: complete.length }).packages[0].sourceVersion, longVersion);
  rejects(() => run(text, [wanted], { maxValueBytes: complete.length - 1 }), 'E_PACKAGE');
});

test('serialized output ceiling is inclusive and rejects without partial references', () => {
  const size = Buffer.byteLength(JSON.stringify(run()));
  assert.deepEqual(run(golden, [target], { maxOutputBytes: size }), run());
  rejects(() => run(golden, [target], { maxOutputBytes: size - 1 }), 'E_OUTPUT');
});

test('UTF8 errors, NUL, CRLF and other controls reject even in unselected metadata', () => {
  for (const bytes of [Buffer.from([255]), Buffer.from([0xc3, 0x28]), Buffer.from(golden + '\nDescription: x\0y'),
    Buffer.from(golden.replace(/\n/g, '\r\n')), Buffer.from(golden + '\nDescription: x\u000by'),
    Buffer.from(golden + '\nDescription: x\u007fy')]) {
    rejects(() => run(bytes), 'E_PACKAGE');
  }
});

test('paragraph grammar rejects missing colons, malformed names and orphan continuations', () => {
  for (const text of [' orphan\n' + golden, golden + '\nBad Field: x', golden + '\nNoColon', golden + '\n: x']) {
    rejects(() => run(text), 'E_PACKAGE');
  }
});

test('ordinary blank separators and final LF do not change selected metadata', () => {
  const text = '\n\n' + golden + '\n\n\nPackage: ignored\n';
  assert.deepEqual(run(text).packages, run().packages);
  assert.deepEqual(run(golden + '\n').packages, run().packages);
  assert.notEqual(run(golden + '\n').inputSha256, run().inputSha256);
  rejects(() => run('\n\n'), 'E_PACKAGE');
});

test('byte input types reject proxies, subclasses, shared, resizable and detached buffers', () => {
  const bytes = Buffer.from(golden);
  const ref = reference(bytes);
  const trap = () => assert.fail('input proxy trap');
  class Custom extends Uint8Array {}
  const detached = new Uint8Array(8);
  structuredClone(detached.buffer, { transfer: [detached.buffer] });
  const variable = new ArrayBuffer(8, { maxByteLength: 16 });
  for (const input of [null, golden, [], new DataView(new ArrayBuffer(8)), Buffer.alloc(0), new Custom(8),
    new Uint8Array(new SharedArrayBuffer(8)), new Uint8Array(variable), detached,
    new Proxy(bytes, { get: trap, getPrototypeOf: trap })]) {
    rejects(() => selectPackageReferences(input, ref, [target]), 'E_INPUT');
  }
});

test('intrinsic snapshot ranges bypass shadow getters and custom iterators', () => {
  const raw = Buffer.from('xx' + golden + 'yy');
  const input = raw.subarray(2, -2);
  const ref = reference(Buffer.from(golden));
  for (const key of ['length', 'buffer', 'byteOffset', Symbol.iterator]) Object.defineProperty(input, key, { get() { assert.fail('shadow property'); } });
  assert.equal(selectPackageReferences(input, ref, [target]).inputSha256, ref.sha256);
  assert.equal(run(new Uint8Array(Buffer.from(golden))).packages.length, 1);
});

test('all mutable caller data is detached from deeply frozen output', () => {
  const bytes = Buffer.from(golden);
  const ref = reference(bytes);
  const wanted = [{ ...target }];
  const overrides = { maxPackageBytes: 123 };
  const result = selectPackageReferences(bytes, ref, wanted, overrides);
  bytes.fill(0);
  ref.sha256 = '0'.repeat(64);
  wanted[0].package = 'mutated';
  wanted.push({ ...target });
  overrides.maxPackageBytes = 1;
  assert.equal(result.packages[0].package, 'xz-utils');
  assert.equal(result.packages[0].byteLength, 123);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.packages));
  assert.ok(Object.isFrozen(result.packages[0]));
  assert.equal(Object.getPrototypeOf(result), Object.prototype);
  assert.equal(Object.getPrototypeOf(result.packages[0]), Object.prototype);
  assert.throws(() => { result.packages[0].filename = 'pool/other.deb'; }, TypeError);
  assert.throws(() => result.packages.push({}), TypeError);
  assert.ok(Object.values(result.packages[0]).every(value => typeof value !== 'object'));
});

test('fixed error constructor never exposes an unknown private message', () => {
  assert.equal(new PackageIndexError('private input').message, 'E_INPUT');
  assert.ok(Object.isFrozen(new PackageIndexError('E_HASH')));
});

test('small deterministic malformed UTF8/index fuzz returns fixed package errors', () => {
  for (let size = 1; size < 40; size++) {
    const bytes = Buffer.alloc(size);
    for (let at = 0; at < size; at++) bytes[at] = (at * 71 + size * 23) & 255;
    rejects(() => run(bytes), 'E_PACKAGE');
  }
});
test('unexpected runtime errors expose no private details or partial references', t => {
  const bytes = Buffer.from(golden), ref = reference(bytes);
  t.mock.method(Buffer, 'byteLength', () => { throw new Error('private-runtime-detail'); });
  rejects(() => selectPackageReferences(bytes, ref, [target]), 'E_INPUT');
});
test('source/test pointers, owner covers and exact index entry agree', async () => {
  const spec = '_spec/tooling/native-ingress/package-index.puml';
  const files = ['tooling/native-ingress/package-index.mjs', 'tooling/native-ingress/package-index.test.mjs'];
  const diagram = await readFile(new URL('../../' + spec, import.meta.url), 'utf8');
  const index = JSON.parse(await readFile(new URL('../../_spec/.spec-index.json', import.meta.url), 'utf8'));
  assert.deepEqual(index.specs.filter(entry => entry.spec === spec), [{ spec, covers: files, fingerprint: null }]);
  for (const file of files) {
    const source = await readFile(new URL('../../' + file, import.meta.url), 'utf8');
    assert.ok(source.startsWith('// SPEC: ' + spec + '\n'));
    assert.ok(diagram.includes("' covers: " + file + '\n'));
    if (!file.endsWith('.test.mjs')) assert.deepEqual([...source.matchAll(/^import .* from '([^']+)';$/gm)].map(match => match[1]), ['node:crypto', 'node:util']);
  }
});
