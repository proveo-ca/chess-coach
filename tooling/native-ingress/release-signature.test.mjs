// SPEC: _spec/tooling/native-ingress/release-signature.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import { constants, createHash, generateKeyPairSync, sign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { RELEASE_SIGNATURE_LIMITS, ReleaseSignatureError, verifyReleaseSignature, selectReleaseIndex } from './release-signature.mjs';

const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = pair.publicKey.export({ format: 'jwk' });
const modulus = Buffer.from(jwk.n, 'base64url');
const exponent = Buffer.from(jwk.e, 'base64url');
const hash = '0123456789abcdef'.repeat(4);
const path = 'main/binary-amd64/Packages.gz';
const expected = Object.freeze({ origin: 'Ubuntu', suite: 'resolute', codename: 'resolute', indexPath: path });
const display = `Origin: Ubuntu\nSuite: resolute\nCodename: resolute\nDate: Sat, 24 Oct 2026 00:00:00 UTC\nSHA256:\n ${hash} 123 ${path}`;
const canonical = `Origin: Ubuntu\r\nSuite: resolute\r\nCodename: resolute\r\nDate: Sat, 24 Oct 2026 00:00:00 UTC\r\nSHA256:\r\n ${hash} 123 ${path}`;

function u16(number) {
  const bytes = Buffer.alloc(2);
  bytes.writeUInt16BE(number);
  return bytes;
}

function u32(number) {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32BE(number);
  return bytes;
}

function mpi(bytes) {
  let at = 0;
  while (bytes[at] === 0) at++;
  const integer = bytes.subarray(at);
  const bits = integer.length ? (integer.length - 1) * 8 + integer[0].toString(2).length : 0;
  return Buffer.concat([u16(bits), integer]);
}

function packet(tag, body, style = 'new') {
  if (style === 'old1') return Buffer.concat([Buffer.from([128 | (tag << 2), body.length]), body]);
  if (style === 'old2') return Buffer.concat([Buffer.from([129 | (tag << 2)]), u16(body.length), body]);
  if (style === 'old4') return Buffer.concat([Buffer.from([130 | (tag << 2)]), u32(body.length), body]);
  if (style === 'new5') return Buffer.concat([Buffer.from([192 | tag, 255]), u32(body.length), body]);
  if (body.length < 192) return Buffer.concat([Buffer.from([192 | tag, body.length]), body]);
  if (body.length > 8383) return Buffer.concat([Buffer.from([192 | tag, 255]), u32(body.length), body]);
  const length = body.length - 192;
  return Buffer.concat([Buffer.from([192 | tag, 192 + (length >> 8), length & 255]), body]);
}

function keyBody(n = modulus, e = exponent, algorithm = 1) {
  return Buffer.concat([Buffer.from([4, 0, 0, 0, 1, algorithm]), mpi(n), mpi(e)]);
}

function fingerprint(body) {
  return createHash('sha1').update(Buffer.concat([Buffer.from([0x99]), u16(body.length), body])).digest('hex').toUpperCase();
}

const primary = keyBody();
const fp = fingerprint(primary);
const keyring = packet(6, primary);

function subpacket(kind, bytes, style = 'short') {
  const length = bytes.length + 1;
  const size = style === 'five' ? Buffer.concat([Buffer.from([255]), u32(length)]) :
    style === 'two' ? Buffer.from([192 + ((length - 192) >> 8), (length - 192) & 255]) : Buffer.from([length]);
  return Buffer.concat([size, Buffer.from([kind]), bytes]);
}

function signatureBody(options = {}) {
  const text = options.canonical ?? canonical;
  const algorithm = options.algorithm ?? 1;
  const digestName = options.hash ?? 'SHA256';
  const hashed = options.hashed ?? Buffer.alloc(0);
  const unhashed = options.unhashed ?? Buffer.alloc(0);
  const header = Buffer.concat([Buffer.from([4, 1, algorithm, digestName === 'SHA256' ? 8 : 10]), u16(hashed.length), hashed]);
  const preimage = Buffer.concat([
    Buffer.from(text, 'ascii'),
    header,
    Buffer.from([4, 255]),
    u32(6 + hashed.length),
  ]);
  const digest = createHash(digestName).update(preimage).digest();
  const signature = options.signature ?? sign(digestName, preimage, {
    key: pair.privateKey,
    padding: options.padding ?? constants.RSA_PKCS1_PADDING,
    saltLength: options.saltLength,
  });
  return Buffer.concat([header, u16(unhashed.length), unhashed, digest.subarray(0, 2), mpi(signature)]);
}

function oracleCrc(bytes) {
  let result = 0xb704ce;
  for (const byte of bytes) {
    for (let mask = 128; mask; mask >>= 1) {
      const feedback = ((result >> 23) & 1) ^ Number(Boolean(byte & mask));
      result = (result << 1) & 0xffffff;
      if (feedback) result ^= 0x864cfb;
    }
  }
  return result;
}

function armor(bytes, label = 'SIGNATURE', options = {}) {
  const encoded = bytes.toString('base64').match(/.{1,64}/g)?.join('\n') ?? '';
  let crc = '';
  if (options.crc) {
    const checksum = Buffer.alloc(3);
    checksum.writeUIntBE(oracleCrc(bytes), 0, 3);
    crc = '\n=' + checksum.toString('base64');
  }
  return `-----BEGIN PGP ${label}-----\n${options.headers ?? ''}\n${encoded}${crc}\n-----END PGP ${label}-----\n`;
}

const validBody = signatureBody();
const validSignature = packet(2, validBody);

function inRelease(options = {}) {
  const signature = options.packets ?? (options.body ? packet(2, options.body) : validSignature);
  return Buffer.from(`-----BEGIN PGP SIGNED MESSAGE-----\nHash: ${options.hash ?? 'SHA256'}\n\n${options.display ?? display}\n${armor(signature, 'SIGNATURE', options)}`, 'ascii');
}

const valid = inRelease();
const check = (release = valid, keys = keyring, expectedFp = fp) => verifyReleaseSignature(release, keys, expectedFp);

function rejects(action, code) {
  assert.throws(action, error => {
    assert.ok(error instanceof ReleaseSignatureError);
    assert.equal(error.name, 'ReleaseSignatureError');
    assert.equal(error.message, error.code);
    assert.ok(Object.isFrozen(error));
    if (code) assert.equal(error.code, code);
    return true;
  });
}

test('literal independent preimage verifies RSA and leaves every authority flag false', () => {
  const result = check();
  assert.deepEqual(result, {
    profile: 'openpgp-v4-rsa-clearsign-v1', signatureVerified: true,
    publisherTrustEstablished: false, signerFingerprint: fp, hashAlgorithm: 'SHA256',
    canonicalText: canonical,
    signedTextSha256: createHash('sha256').update(canonical, 'ascii').digest('hex'),
    publicKeyAuthenticated: false, nativeQualified: false,
  });
  assert.ok(Object.isFrozen(result));
  assert.throws(() => { result.publisherTrustEstablished = true; }, TypeError);
});

test('SHA512 uses its full preimage once', () => {
  assert.equal(check(inRelease({ body: signatureBody({ hash: 'SHA512' }), hash: 'SHA512' })).hashAlgorithm, 'SHA512');
});

test('RSA sign-only primary algorithm 3 verifies only its matching signature algorithm', () => {
  const body = keyBody(modulus, exponent, 3);
  assert.equal(check(inRelease({ body: signatureBody({ algorithm: 3 }) }), packet(6, body), fingerprint(body)).signatureVerified, true);
  rejects(() => check(inRelease({ body: signatureBody({ algorithm: 3 }) })), 'E_SIGNATURE');
});

test('LF and CRLF transports produce identical signed text', () => {
  assert.deepEqual(check(Buffer.from(valid.toString('ascii').replace(/\n/g, '\r\n'))), check());
});

test('trailing ASCII spaces and tabs do not change signed text', () => {
  assert.equal(check(inRelease({ display: display.split('\n').join(' \t\n') + '\t ' })).canonicalText, canonical);
});

test('dash escape removes exactly one prefix', () => {
  const text = '- first\r\n- - second\r\nlast';
  const result = check(inRelease({ display: '- - first\n- - - second\nlast', body: signatureBody({ canonical: text }) }));
  assert.equal(result.canonicalText, text);
});

test('the separator LF is excluded but an extra signed final LF remains', () => {
  const text = 'one\r\n';
  assert.equal(check(inRelease({ display: 'one\n', body: signatureBody({ canonical: text }) })).canonicalText, text);
  rejects(() => check(inRelease({ display: 'one', body: signatureBody({ canonical: text }) })), 'E_SIGNATURE');
});

test('an empty cleartext line signs empty bytes', () => {
  assert.equal(check(inRelease({ display: '', body: signatureBody({ canonical: '' }) })).canonicalText, '');
});

test('altered content rejects even with intact signature packet', () => {
  rejects(() => check(inRelease({ display: display.replace('Ubuntu', 'Not-Ubuntu') })), 'E_SIGNATURE');
});

test('correct digest prefix does not authenticate forged RSA bytes', () => {
  const body = signatureBody({ signature: Buffer.from([1]) });
  assert.deepEqual(body.subarray(8, 10), validBody.subarray(8, 10));
  rejects(() => check(inRelease({ body })), 'E_SIGNATURE');
});

test('RSA-PSS cannot substitute for PKCS1 v1.5', () => {
  rejects(() => check(inRelease({ body: signatureBody({ padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 }) })), 'E_SIGNATURE');
});

test('a signature of the digest instead of the full preimage cannot verify', () => {
  const preimage = Buffer.concat([Buffer.from(canonical), Buffer.from([4, 1, 1, 8, 0, 0, 4, 255, 0, 0, 0, 6])]);
  const wrong = sign('sha256', createHash('sha256').update(preimage).digest(), pair.privateKey);
  rejects(() => check(inRelease({ body: signatureBody({ signature: wrong }) })), 'E_SIGNATURE');
});

test('a different provided RSA key cannot verify a signature from this key', () => {
  const n = Buffer.from(modulus);
  n[n.length - 1] ^= 2;
  const body = keyBody(n);
  rejects(() => check(valid, packet(6, body), fingerprint(body)), 'E_SIGNATURE');
});

test('external full fingerprint is mandatory and cannot be replaced by an issuer hint', () => {
  for (const value of [undefined, null, fp.toLowerCase(), fp.slice(-16), 'G'.repeat(40), '0'.repeat(41), new String(fp)]) {
    rejects(() => verifyReleaseSignature(valid, keyring, value), 'E_INPUT');
  }
  rejects(() => verifyReleaseSignature(valid, keyring), 'E_INPUT');
  rejects(() => check(valid, keyring, '0'.repeat(40)), 'E_KEY');
});

test('matching hashed and unhashed issuer fingerprints are not trust roots', () => {
  for (const field of ['hashed', 'unhashed']) {
    const attrs = { [field]: subpacket(33, Buffer.concat([Buffer.from([4]), Buffer.from(fp, 'hex')])) };
    assert.equal(check(inRelease({ body: signatureBody(attrs) })).publicKeyAuthenticated, false);
  }
});

test('conflicting fingerprint hints cannot override the externally selected primary key', () => {
  for (const field of ['hashed', 'unhashed']) {
    const attrs = { [field]: subpacket(33, Buffer.concat([Buffer.from([4]), Buffer.alloc(20)])) };
    rejects(() => check(inRelease({ body: signatureBody(attrs) })), 'E_SIGNATURE');
  }
});

test('issuer IDs remain inert metadata', () => {
  const body = signatureBody({ unhashed: subpacket(16, Buffer.alloc(8, 7)) });
  assert.equal(check(inRelease({ body })).signerFingerprint, fp);
});

test('revocations, identities and expiration metadata do not establish key authentication', () => {
  const attrs = Buffer.concat([subpacket(2, u32(1)), subpacket(3, u32(1)), subpacket(9, u32(1))]);
  const keys = Buffer.concat([keyring, packet(13, Buffer.from('Untrusted Ubuntu')), packet(2, Buffer.from([4, 32]))]);
  const result = check(inRelease({ body: signatureBody({ hashed: attrs }) }), keys);
  assert.equal(result.publicKeyAuthenticated, false);
  assert.equal(result.publisherTrustEstablished, false);
});

test('a subkey packet never supplies the selected primary key', () => {
  rejects(() => check(valid, packet(14, primary)), 'E_KEY');
  assert.equal(check(valid, Buffer.concat([packet(14, primary), keyring])).signatureVerified, true);
});

test('duplicate matching primary keys reject ambiguity', () => {
  rejects(() => check(valid, Buffer.concat([keyring, keyring])), 'E_KEY');
});

test('an unmatched primary cannot select itself from signature metadata', () => {
  const other = keyBody(modulus, Buffer.from([3]));
  assert.equal(check(valid, Buffer.concat([packet(6, other), keyring])).signerFingerprint, fp);
  rejects(() => check(valid, packet(6, other)), 'E_KEY');
});

for (const tag of [5, 7]) {
  test(`secret key packet ${tag} rejects without interpretation`, () => {
    rejects(() => check(valid, Buffer.concat([keyring, packet(tag, Buffer.from([0]))])), 'E_KEY');
  });
}

for (const style of ['old2', 'old4', 'new5']) {
  test(`finite ${style} packet framing verifies`, () => {
    assert.equal(check(inRelease({ packets: packet(2, validBody, style) }), packet(6, primary, style)).signatureVerified, true);
  });
}

test('old one-byte and new one-byte metadata packets are bounded and ignored', () => {
  const metadata = Buffer.concat([packet(13, Buffer.from('x'), 'old1'), packet(13, Buffer.from('y'))]);
  assert.equal(check(valid, Buffer.concat([keyring, metadata])).signatureVerified, true);
});

for (const bytes of [Buffer.from([0]), Buffer.from([0xc6, 224]), Buffer.from([0x9b]), Buffer.from([0xc6, 255, 255, 255, 255, 255]), Buffer.from([0xc6, 192])]) {
  test(`malformed packet framing ${bytes.toString('hex')} rejects`, () => {
    rejects(() => check(valid, bytes), 'E_PACKET');
  });
}

test('packet budget includes both the keyring and the signature stream', () => {
  const metadata = packet(13, Buffer.alloc(0));
  assert.equal(check(valid, Buffer.concat([keyring, ...Array(254).fill(metadata)])).signatureVerified, true);
  rejects(() => check(valid, Buffer.concat([keyring, ...Array(255).fill(metadata)])), 'E_PACKET');
});

test('one valid signature among four is sufficient but a fifth rejects', () => {
  const forged = packet(2, signatureBody({ signature: Buffer.from([1]) }));
  assert.equal(check(inRelease({ packets: Buffer.concat([forged, forged, validSignature, forged]) })).signatureVerified, true);
  rejects(() => check(inRelease({ packets: Buffer.concat(Array(5).fill(validSignature)) })), 'E_SIGNATURE');
});

test('non-signature packets in signature armor reject', () => {
  rejects(() => check(inRelease({ packets: packet(13, Buffer.from('not a signature')) })), 'E_SIGNATURE');
});

test('all signature packets must fit the supported profile', () => {
  const bad = Buffer.from(validBody);
  bad[3] = 2;
  rejects(() => check(inRelease({ packets: Buffer.concat([validSignature, packet(2, bad)]) })), 'E_SIGNATURE');
});

for (const [offset, value] of [[0, 3], [1, 0], [2, 17], [3, 2]]) {
  test(`unsupported signature header ${offset}:${value} rejects`, () => {
    const body = Buffer.from(validBody);
    body[offset] = value;
    rejects(() => check(inRelease({ body })), 'E_SIGNATURE');
  });
}

test('declared Hash must agree with the verified signature hash', () => {
  rejects(() => check(inRelease({ hash: 'SHA512' })), 'E_SIGNATURE');
});

test('malformed signature prefix and MPI cannot produce partial success', () => {
  const prefix = Buffer.from(validBody);
  prefix[8] ^= 1;
  rejects(() => check(inRelease({ body: prefix })), 'E_SIGNATURE');
  const bits = Buffer.from(validBody);
  bits.writeUInt16BE(bits.readUInt16BE(10) + 1, 10);
  rejects(() => check(inRelease({ body: bits })), 'E_SIGNATURE');
  rejects(() => check(inRelease({ body: Buffer.concat([validBody, Buffer.from([0])]) })), 'E_SIGNATURE');
  rejects(() => check(inRelease({ body: validBody.subarray(0, -1) })), 'E_SIGNATURE');
  rejects(() => check(inRelease({ body: Buffer.from([4, 1, 1, 8, 255, 255]) })), 'E_SIGNATURE');
});

test('signature MPI cannot exceed the selected modulus width', () => {
  rejects(() => check(inRelease({ body: signatureBody({ signature: Buffer.alloc(257, 1) }) })), 'E_SIGNATURE');
});

test('zero MPI and noncanonical leading zero reject', () => {
  const head = validBody.subarray(0, 10);
  rejects(() => check(inRelease({ body: Buffer.concat([head, Buffer.from([0, 0])]) })), 'E_SIGNATURE');
  rejects(() => check(inRelease({ body: Buffer.concat([head, Buffer.from([0, 9, 0, 1])]) })), 'E_SIGNATURE');
});

test('RSA key MPIs require bounded canonical positive integers', () => {
  const badBits = Buffer.from(primary);
  badBits.writeUInt16BE(2047, 6);
  const invalid = [badBits, Buffer.concat([primary, Buffer.from([0])]), primary.subarray(0, -1),
    keyBody(Buffer.alloc(128, 255)), keyBody(Buffer.alloc(1025, 255)), keyBody(modulus, Buffer.from([1])),
    keyBody(modulus, Buffer.from([2])), keyBody(modulus, Buffer.alloc(9, 1)), keyBody(modulus, Buffer.alloc(0))];
  for (const body of invalid) rejects(() => check(valid, packet(6, body), fingerprint(body)), 'E_KEY');
});

test('unsupported public key versions and matched algorithms reject', () => {
  for (const [offset, value] of [[0, 5], [0, 6], [5, 17]]) {
    const body = Buffer.from(primary);
    body[offset] = value;
    rejects(() => check(valid, packet(6, body), fingerprint(body)), 'E_KEY');
  }
  rejects(() => check(valid, packet(6, Buffer.from([4]))), 'E_KEY');
});

test('unknown unmatched primary algorithms remain inert', () => {
  const other = Buffer.from(primary);
  other[5] = 17;
  assert.equal(check(valid, Buffer.concat([packet(6, other), keyring])).signatureVerified, true);
});

test('known subpacket sizes and critical unsupported semantics reject', () => {
  const invalid = [subpacket(0x80 | 20, Buffer.alloc(0)), Buffer.from([0]), Buffer.from([5, 2, 0]),
    subpacket(2, Buffer.alloc(3)), subpacket(16, Buffer.alloc(7)), subpacket(33, Buffer.alloc(21)),
    Buffer.from([255, 255, 255, 255, 255])];
  for (const hashed of invalid) rejects(() => check(inRelease({ body: signatureBody({ hashed }) })), 'E_SIGNATURE');
});

test('unknown noncritical subpackets are inert across one/two/five-byte lengths', () => {
  const attrs = Buffer.concat([subpacket(100, Buffer.from([1])), subpacket(100, Buffer.alloc(191), 'two'), subpacket(100, Buffer.alloc(7), 'five')]);
  assert.equal(check(inRelease({ body: signatureBody({ hashed: attrs }) })).signatureVerified, true);
});

test('two-byte subpacket lengths include first octets 224 through 254', () => {
  const attrs = subpacket(100, Buffer.alloc(8383), 'two');
  assert.equal(attrs[0], 224);
  assert.equal(check(inRelease({ body: signatureBody({ hashed: attrs }) })).signatureVerified, true);
});

test('subpacket budget combines hashed and unhashed subpackets', () => {
  const item = subpacket(100, Buffer.alloc(0));
  const hashed = Buffer.concat(Array(64).fill(item));
  assert.equal(check(inRelease({ body: signatureBody({ hashed, unhashed: hashed }) })).signatureVerified, true);
  rejects(() => check(inRelease({ body: signatureBody({ hashed, unhashed: Buffer.concat([hashed, item]) }) })), 'E_SIGNATURE');
});

test('independent CRC oracle has the published CRC24 check vector', () => {
  assert.equal(oracleCrc(Buffer.from('123456789')), 0x21cf02);
  assert.equal(check(inRelease({ crc: true })).signatureVerified, true);
});

test('ASCII-armored public keys accept optional checksum and metadata headers', () => {
  const armored = armor(keyring, 'PUBLIC KEY BLOCK', { crc: true, headers: 'Version: synthetic\nComment: RAM fixture\n' });
  assert.equal(check(valid, Buffer.from(armored)).signatureVerified, true);
  assert.equal(check(inRelease({ headers: 'Comment: synthetic\n' })).signatureVerified, true);
});

test('missing armor checksum is accepted without implying key authentication', () => {
  assert.equal(check().publicKeyAuthenticated, false);
});

test('invalid CRC and noncanonical base64 padding reject', () => {
  const crc = inRelease({ crc: true }).toString('ascii').replace(/^=....$/m, '=AAAA');
  rejects(() => check(Buffer.from(crc)), 'E_ARMOR');
  const encoded = Buffer.from([1]).toString('base64');
  assert.equal(encoded, 'AQ==');
  const invalid = armor(Buffer.from([1])).replace('AQ==', 'AR==');
  const prefix = '-----BEGIN PGP SIGNED MESSAGE-----\nHash: SHA256\n\nx\n';
  rejects(() => check(Buffer.from(prefix + invalid)), 'E_ARMOR');
  rejects(() => check(Buffer.from(prefix + invalid.replace('AR==', 'A==='))), 'E_ARMOR');
});

test('armor accepts only trailing ASCII whitespace and no additional object', () => {
  assert.equal(check(Buffer.concat([valid, Buffer.from(' \t\n')])).signatureVerified, true);
  for (const suffix of ['x', armor(validSignature), '\0']) rejects(() => check(Buffer.concat([valid, Buffer.from(suffix)])), 'E_ARMOR');
});

for (const [name, change] of [
  ['preamble', text => 'x\n' + text],
  ['bare CR', text => text.replace('Origin:', '\rOrigin:')],
  ['unknown cleartext header', text => text.replace('Hash: SHA256', 'Version: synthetic')],
  ['missing Hash', text => text.replace('Hash: SHA256\n', '')],
  ['duplicate Hash', text => text.replace('Hash: SHA256', 'Hash: SHA256\nHash: SHA256')],
  ['unsupported Hash', text => text.replace('SHA256', 'SHA1')],
  ['unescaped dash', text => text.replace('Origin: Ubuntu', '-Ubuntu')],
  ['missing signature boundary', text => text.replace('-----BEGIN PGP SIGNATURE-----', 'not armor')],
  ['missing end boundary', text => text.replace('-----END PGP SIGNATURE-----', '')],
  ['unknown signature header', text => text.replace('-----BEGIN PGP SIGNATURE-----\n', '-----BEGIN PGP SIGNATURE-----\nBad: x\n')],
  ['nonASCII', text => text.replace('Ubuntu', 'Ubunté')],
]) {
  test(`strict armor rejects ${name}`, () => rejects(() => check(Buffer.from(change(valid.toString('ascii')))), 'E_ARMOR'));
}

test('armor header and line counts remain bounded', () => {
  rejects(() => check(inRelease({ headers: 'Comment: x\n'.repeat(17) })), 'E_ARMOR');
  rejects(() => check(Buffer.concat([valid, Buffer.from('\n'.repeat(32768))])), 'E_ARMOR');
});

test('decoded signature byte ceiling applies before packet parsing', () => {
  rejects(() => check(inRelease({ packets: Buffer.alloc(16385) })), 'E_ARMOR');
});

test('release input ceiling is inclusive with bounded trailing whitespace', () => {
  const padding = Buffer.from(' '.repeat(1048576 - valid.length));
  assert.equal(check(Buffer.concat([valid, padding])).signatureVerified, true);
});

test('keyring input ceiling is inclusive for finite ignored metadata', () => {
  const body = Buffer.alloc(1048576 - keyring.length - 6);
  const keys = Buffer.concat([keyring, packet(13, body, 'new5')]);
  assert.equal(keys.length, 1048576);
  assert.equal(check(valid, keys).signatureVerified, true);
});

test('untrusted byte containers never invoke custom accessors or proxy traps', () => {
  const trap = () => assert.fail('external accessor invoked');
  const inputs = [null, 'x', [], new DataView(new ArrayBuffer(8)), Buffer.alloc(0),
    new Uint8Array(new SharedArrayBuffer(8)), new Proxy(Buffer.from('x'), { get: trap, getPrototypeOf: trap })];
  class Custom extends Uint8Array {}
  inputs.push(new Custom(8));
  const variable = new ArrayBuffer(8, { maxByteLength: 16 });
  inputs.push(new Uint8Array(variable));
  const detached = new Uint8Array(8);
  structuredClone(detached.buffer, { transfer: [detached.buffer] });
  inputs.push(detached);
  for (const input of inputs) {
    rejects(() => check(input), 'E_INPUT');
    rejects(() => check(valid, input), 'E_INPUT');
  }
});

test('intrinsic byte ranges bypass shadow properties and custom iterators', () => {
  const input = Buffer.concat([Buffer.from('xx'), valid, Buffer.from('yy')]).subarray(2, -2);
  const keys = new Uint8Array(keyring);
  for (const bytes of [input, keys]) {
    for (const name of ['length', 'buffer', 'byteOffset', Symbol.iterator]) Object.defineProperty(bytes, name, { get() { assert.fail('shadow property'); } });
  }
  assert.equal(check(input, keys).signatureVerified, true);
});

test('returned strings and immutable evidence do not retain input views', () => {
  const release = Buffer.from(valid);
  const keys = Buffer.from(keyring);
  const result = check(release, keys);
  release.fill(0);
  keys.fill(0);
  assert.equal(result.canonicalText, canonical);
  assert.equal(result.signerFingerprint, fp);
  assert.ok(Object.values(result).every(value => typeof value !== 'object'));
});

test('caps and fixed error codes are immutable', () => {
  assert.deepEqual(RELEASE_SIGNATURE_LIMITS, { maxReleaseBytes: 1048576, maxKeyringBytes: 1048576,
    maxSignatureBytes: 16384, maxPackets: 256, maxSignatures: 4, maxSubpackets: 128 });
  assert.ok(Object.isFrozen(RELEASE_SIGNATURE_LIMITS));
  assert.equal(new ReleaseSignatureError('raw secret').message, 'E_INPUT');
});

test('small deterministic binary fuzz always returns a fixed error', () => {
  for (let size = 1; size < 64; size++) {
    const bytes = Buffer.alloc(size);
    for (let at = 0; at < size; at++) bytes[at] = (at * 73 + size * 19) & 255;
    rejects(() => check(bytes));
    rejects(() => check(valid, bytes));
  }
});

test('extractor returns the exact SHA256 row without authenticating unsigned text', () => {
  const result = selectReleaseIndex(canonical, expected);
  assert.deepEqual(result, { path, byteLength: 123, sha256: hash, origin: 'Ubuntu', suite: 'resolute',
    codename: 'resolute', date: 'Sat, 24 Oct 2026 00:00:00 UTC', validUntil: null,
    signedTextSha256: createHash('sha256').update(canonical).digest('hex'), signatureVerified: false });
  assert.ok(Object.isFrozen(result));
  assert.equal(result.nativeQualified, undefined);
  assert.equal(result.publisherTrustEstablished, undefined);
});

test('verified cleartext and extracted descriptor bind only through the exact text hash', () => {
  const evidence = check();
  assert.equal(selectReleaseIndex(evidence.canonicalText, expected).signedTextSha256, evidence.signedTextSha256);
  assert.notEqual(selectReleaseIndex(display, expected).signedTextSha256, evidence.signedTextSha256);
  assert.equal(selectReleaseIndex(evidence.canonicalText, expected).signatureVerified, false);
});

test('field names are case-insensitive and continuations unfold', () => {
  const text = display.replace('Origin:', 'oRiGiN:').replace('Date: Sat, 24 Oct 2026 00:00:00 UTC', 'Date: Sat, 24 Oct\n 2026 00:00:00 UTC');
  assert.equal(selectReleaseIndex(text, expected).date, 'Sat, 24 Oct 2026 00:00:00 UTC');
});

test('Date and Valid-Until remain unevaluated claims, not clock proofs', () => {
  const text = display.replace('Date: Sat, 24 Oct 2026 00:00:00 UTC', 'Date: not a calendar date\nValid-Until: long expired');
  const result = selectReleaseIndex(text, expected);
  assert.equal(result.date, 'not a calendar date');
  assert.equal(result.validUntil, 'long expired');
  assert.equal(result.signatureVerified, false);
});

for (const name of ['Origin', 'Suite', 'Codename', 'Date', 'SHA256']) {
  test(`duplicate ${name} field and ambiguous case variants reject`, () => {
    rejects(() => selectReleaseIndex(display + `\n${name.toLowerCase()}: x`, expected), 'E_RELEASE');
  });
}

test('all duplicate fields reject even if their values are unused', () => {
  rejects(() => selectReleaseIndex(display + '\nUnused: one\nuNuSeD: two', expected), 'E_RELEASE');
});

test('missing required fields and identity mismatches reject', () => {
  for (const name of ['Origin', 'Suite', 'Codename', 'Date']) {
    const text = display.split('\n').filter(line => !line.startsWith(name + ':')).join('\n');
    rejects(() => selectReleaseIndex(text, expected), 'E_RELEASE');
  }
  for (const name of ['Origin', 'Suite', 'Codename']) rejects(() => selectReleaseIndex(display.replace(name + ': ', name + ': wrong-'), expected), 'E_RELEASE');
  rejects(() => selectReleaseIndex(display.replace('SHA256:', 'SHA512:'), expected), 'E_RELEASE');
});

test('selects only the exact requested path with no fallback', () => {
  const text = display.replace(path, 'main/binary-arm64/Packages.gz');
  rejects(() => selectReleaseIndex(text, expected), 'E_RELEASE');
  const rows = text + `\n ${'a'.repeat(64)} 42 ${path}`;
  assert.equal(selectReleaseIndex(rows, expected).byteLength, 42);
  assert.equal(selectReleaseIndex(rows, expected).sha256, 'a'.repeat(64));
});

test('every duplicate SHA256 path rejects including unselected paths', () => {
  for (const text of [display + `\n ${hash} 123 ${path}`,
    display + `\n ${hash} 1 other/Index\n ${hash} 2 other/Index`]) {
    rejects(() => selectReleaseIndex(text, expected), 'E_RELEASE');
  }
});
test('empty unselected indexes are valid but the selected transport must be nonempty', () => {
  assert.equal(selectReleaseIndex(display + `\n ${'0'.repeat(64)} 0 other/Empty`, expected).byteLength, 123);
  rejects(() => selectReleaseIndex(display.replace(' 123 ', ' 0 '), expected), 'E_RELEASE');
});
test('ordinary Ubuntu dep11 at-sign filenames do not invalidate other signed rows', () => {
  const icon = 'main/dep11/icons-128x128@2.tar.gz';
  const text = display + `\n ${'a'.repeat(64)} 42 ${icon}`;
  assert.equal(selectReleaseIndex(text, expected).path, path);
  assert.equal(selectReleaseIndex(text, { ...expected, indexPath: icon }).path, icon);
});

for (const badPath of ['/abs', '../up', 'main/../up', 'main/./x', 'main//x', 'main\\x', 'main/%2e%2e/x', 'main/x%20', 'main/x/', '.', '..', 'a:b', 'a\0b', 'a'.repeat(257)]) {
  test(`unsafe SHA256 path ${JSON.stringify(badPath)} rejects even when unselected`, () => {
    rejects(() => selectReleaseIndex(display + `\n ${hash} 1 ${badPath}`, expected), 'E_RELEASE');
  });
}

for (const size of ['0', '-1', '+1', '01', '1.0', '1e2', '16777217', '9999999999999999999999999999']) {
  test(`noncanonical or oversized selected index size ${size} rejects`, () => {
    rejects(() => selectReleaseIndex(display.replace(' 123 ', ` ${size} `), expected), 'E_RELEASE');
  });
}

test('compressed index size bounds include one byte and sixteen MiB', () => {
  for (const size of [1, 16777216]) assert.equal(selectReleaseIndex(display.replace(' 123 ', ` ${size} `), expected).byteLength, size);
});

test('SHA256 rows require lowercase hashes, complete records, and an empty section header', () => {
  for (const text of [display.replace(hash, hash.toUpperCase()), display.replace(hash, hash.slice(1)),
    display.replace('SHA256:', 'SHA256: x'), display.replace(' 123 ', ' '), display + '\n malformed',
    display.replace(` ${hash} 123 ${path}`, ''), display.replace(` ${hash}`, hash)]) {
    rejects(() => selectReleaseIndex(text, expected), 'E_RELEASE');
  }
});

test('expectations require exactly four own string data properties', () => {
  const trap = () => assert.fail('external accessor invoked');
  const accessor = { ...expected };
  Object.defineProperty(accessor, 'suite', { get: trap });
  const invalid = [null, [], new Proxy(expected, { get: trap, ownKeys: trap }), accessor,
    { ...expected, extra: true }, { ...expected, origin: 'Debian' }, { ...expected, codename: 'other' },
    { ...expected, suite: '' }, { ...expected, suite: 'x'.repeat(257) }, { ...expected, suite: ' resolute' },
    { ...expected, suite: 1 }, Object.create(expected), { ...expected, [Symbol('extra')]: 1 }];
  for (const value of invalid) rejects(() => selectReleaseIndex(display, value), 'E_INPUT');
  const missing = { ...expected };
  delete missing.suite;
  rejects(() => selectReleaseIndex(display, missing), 'E_INPUT');
  rejects(() => selectReleaseIndex(display, { ...expected, indexPath: '../bad' }), 'E_RELEASE');
  assert.equal(selectReleaseIndex(display, Object.assign(Object.create(null), expected)).path, path);
});

test('suite is a literal expectation rather than an inferred default', () => {
  const text = display.replace('Suite: resolute', 'Suite: resolute-updates');
  rejects(() => selectReleaseIndex(text, expected), 'E_RELEASE');
  assert.equal(selectReleaseIndex(text, { ...expected, suite: 'resolute-updates' }).suite, 'resolute-updates');
});

test('Release parsing rejects controls, bare CR, paragraph ambiguity and orphan continuations', () => {
  for (const text of [' orphan\n' + display, display.replace('Origin:', 'Bad Field:'),
    display.replace('Suite:', '\nSuite:'), display.replace('Ubuntu', 'Ubunté'), display + '\r',
    display.replace('Ubuntu', 'Ub\0untu'), display.replace('Date: Sat', 'Date: ' + 'x'.repeat(257) + ' Sat'),
    display.replace('Date: Sat, 24 Oct 2026 00:00:00 UTC', 'Date:')]) {
    rejects(() => selectReleaseIndex(text, expected), 'E_RELEASE');
  }
  assert.equal(selectReleaseIndex(display + '\n', expected).path, path);
});

test('Release text accepts only bounded primitive strings', () => {
  for (const value of [null, Buffer.from(display), new String(display), '', 1]) rejects(() => selectReleaseIndex(value, expected), 'E_INPUT');
  rejects(() => selectReleaseIndex(display + '\n'.repeat(32768), expected), 'E_RELEASE');
});
test('source/test pointers, diagram and index agree and source has no I/O imports', async () => {
  const spec = '_spec/tooling/native-ingress/release-signature.puml';
  const files = ['tooling/native-ingress/release-signature.mjs', 'tooling/native-ingress/release-signature.test.mjs'];
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
