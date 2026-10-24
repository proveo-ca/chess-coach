// SPEC: _spec/tooling/native-ingress/release-signature.puml
import { constants, createHash, createPublicKey, verify } from 'node:crypto';
import { types } from 'node:util';

export const RELEASE_SIGNATURE_LIMITS = Object.freeze({
  maxReleaseBytes: 1048576,
  maxKeyringBytes: 1048576,
  maxSignatureBytes: 16384,
  maxPackets: 256,
  maxSignatures: 4,
  maxSubpackets: 128,
});

const codes = Object.freeze(['E_INPUT', 'E_ARMOR', 'E_PACKET', 'E_KEY', 'E_SIGNATURE', 'E_RELEASE']);
const typedPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const typedLength = Object.getOwnPropertyDescriptor(typedPrototype, 'length').get;
const typedBuffer = Object.getOwnPropertyDescriptor(typedPrototype, 'buffer').get;
const typedOffset = Object.getOwnPropertyDescriptor(typedPrototype, 'byteOffset').get;
const resizable = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;

export class ReleaseSignatureError extends Error {
  constructor(code) {
    const fixed = codes.includes(code) ? code : 'E_INPUT';
    super(fixed);
    this.name = 'ReleaseSignatureError';
    this.code = fixed;
    Object.freeze(this);
  }
}

function fail(code) {
  throw new ReleaseSignatureError(code);
}

function snapshot(bytes, cap) {
  if (types.isProxy(bytes) || !types.isUint8Array(bytes)) fail('E_INPUT');
  const prototype = Object.getPrototypeOf(bytes);
  if (prototype !== Uint8Array.prototype && prototype !== Buffer.prototype) fail('E_INPUT');
  const length = typedLength.call(bytes);
  const backing = typedBuffer.call(bytes);
  const offset = typedOffset.call(bytes);
  if (types.isSharedArrayBuffer(backing) || (resizable && resizable.call(backing))) fail('E_INPUT');
  if (length < 1 || length > cap) fail('E_INPUT');
  return Buffer.from(new Uint8Array(backing, offset, length));
}

function asciiLines(text, code) {
  if (/[^\x09\x0a\x0d\x20-\x7e]/.test(text) || /\r(?!\n)/.test(text)) fail(code);
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  if (lines.length > 32768) fail(code);
  return lines;
}

function crc24(bytes) {
  let crc = 0xb704ce;
  for (const byte of bytes) {
    crc ^= byte << 16;
    for (let bit = 0; bit < 8; bit++) {
      crc <<= 1;
      if (crc & 0x1000000) crc ^= 0x1864cfb;
    }
  }
  return crc & 0xffffff;
}

function decode64(text, cap) {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text) ||
    !text.length || text.length > Math.ceil(cap / 3) * 4) fail('E_ARMOR');
  const bytes = Buffer.from(text, 'base64');
  if (bytes.length > cap || bytes.toString('base64') !== text) fail('E_ARMOR');
  return bytes;
}

function armor(lines, start, label, cap) {
  if (lines[start] !== `-----BEGIN PGP ${label}-----`) fail('E_ARMOR');
  let at = start + 1;
  let headers = 0;
  while (at < lines.length && lines[at] !== '') {
    if (++headers > 16 || !/^(Version|Comment): [\x20-\x7e]{1,256}$/.test(lines[at])) fail('E_ARMOR');
    at++;
  }
  if (lines[at++] !== '') fail('E_ARMOR');
  let encoded = '';
  let checksum = null;
  while (at < lines.length && lines[at] !== `-----END PGP ${label}-----`) {
    const line = lines[at++];
    if (line.startsWith('=')) {
      if (checksum !== null || !/^=[A-Za-z0-9+/]{4}$/.test(line)) fail('E_ARMOR');
      checksum = line.slice(1);
    } else {
      if (checksum !== null || !/^[A-Za-z0-9+/=]{1,76}$/.test(line)) fail('E_ARMOR');
      encoded += line;
      if (encoded.length > Math.ceil(cap / 3) * 4) fail('E_ARMOR');
    }
  }
  if (lines[at++] !== `-----END PGP ${label}-----`) fail('E_ARMOR');
  for (; at < lines.length; at++) if (!/^[\t ]*$/.test(lines[at])) fail('E_ARMOR');
  const bytes = decode64(encoded, cap);
  if (checksum !== null) {
    const crc = decode64(checksum, 3);
    if (crc.length !== 3 || crc.readUIntBE(0, 3) !== crc24(bytes)) fail('E_ARMOR');
  }
  return bytes;
}

function clearsign(bytes) {
  const lines = asciiLines(bytes.toString('latin1'), 'E_ARMOR');
  if (lines[0] !== '-----BEGIN PGP SIGNED MESSAGE-----') fail('E_ARMOR');
  let at = 1;
  let hash = null;
  while (at < lines.length && lines[at] !== '') {
    if (hash !== null || !/^Hash: (SHA256|SHA512)$/.test(lines[at])) fail('E_ARMOR');
    hash = lines[at++].slice(6);
  }
  if (hash === null || lines[at++] !== '') fail('E_ARMOR');
  const text = [];
  while (at < lines.length && lines[at] !== '-----BEGIN PGP SIGNATURE-----') {
    let line = lines[at++];
    if (line.startsWith('- ')) line = line.slice(2);
    else if (line.startsWith('-')) fail('E_ARMOR');
    text.push(line.replace(/[\t ]+$/, ''));
  }
  if (!text.length) fail('E_ARMOR');
  return {
    canonicalText: text.join('\r\n'),
    hash,
    signatures: armor(lines, at, 'SIGNATURE', RELEASE_SIGNATURE_LIMITS.maxSignatureBytes),
  };
}

function span(bytes, at, size, code) {
  if (!Number.isSafeInteger(size) || size < 0 || at > bytes.length || size > bytes.length - at) fail(code);
}

function finiteLength(bytes, at, code, subpacket = false) {
  span(bytes, at, 1, code);
  const first = bytes[at++];
  if (first < 192) return { size: first, at };
  if (first < 224 || (subpacket && first < 255)) {
    span(bytes, at, 1, code);
    return { size: ((first - 192) << 8) + bytes[at] + 192, at: at + 1 };
  }
  if (first !== 255) fail(code);
  span(bytes, at, 4, code);
  return { size: bytes.readUInt32BE(at), at: at + 4 };
}

function packets(bytes, budget) {
  const result = [];
  let at = 0;
  while (at < bytes.length) {
    if (++budget.count > RELEASE_SIGNATURE_LIMITS.maxPackets) fail('E_PACKET');
    const first = bytes[at++];
    if (!(first & 128)) fail('E_PACKET');
    let tag;
    let size;
    if (first & 64) {
      tag = first & 63;
      ({ size, at } = finiteLength(bytes, at, 'E_PACKET'));
    } else {
      tag = (first >> 2) & 15;
      const kind = first & 3;
      if (kind === 3) fail('E_PACKET');
      const width = 1 << kind;
      span(bytes, at, width, 'E_PACKET');
      size = bytes.readUIntBE(at, width);
      at += width;
    }
    span(bytes, at, size, 'E_PACKET');
    result.push({ tag, body: bytes.subarray(at, at + size) });
    at += size;
  }
  return result;
}

function mpi(bytes, at, code) {
  span(bytes, at, 2, code);
  const bits = bytes.readUInt16BE(at);
  const size = Math.ceil(bits / 8);
  at += 2;
  span(bytes, at, size, code);
  if (!bits || !bytes[at] || (size - 1) * 8 + 32 - Math.clz32(bytes[at]) !== bits) fail(code);
  return { bits, bytes: bytes.subarray(at, at + size), at: at + size };
}

function publicKey(bytes, expected, budget) {
  let encoded = bytes;
  if (bytes[0] === 45) encoded = armor(asciiLines(bytes.toString('latin1'), 'E_ARMOR'), 0, 'PUBLIC KEY BLOCK', RELEASE_SIGNATURE_LIMITS.maxKeyringBytes);
  let selected = null;
  for (const packet of packets(encoded, budget)) {
    if (packet.tag === 5 || packet.tag === 7) fail('E_KEY');
    if (packet.tag !== 6) continue;
    const body = packet.body;
    if (body.length < 6 || body.length > 65535 || body[0] !== 4) fail('E_KEY');
    const prefix = Buffer.alloc(3);
    prefix[0] = 0x99;
    prefix.writeUInt16BE(body.length, 1);
    const fingerprint = createHash('sha1').update(prefix).update(body).digest('hex').toUpperCase();
    if (body[5] !== 1 && body[5] !== 3) {
      if (fingerprint === expected) fail('E_KEY');
      continue;
    }
    const n = mpi(body, 6, 'E_KEY');
    const e = mpi(body, n.at, 'E_KEY');
    if (e.at !== body.length || n.bits < 2048 || n.bits > 8192 || e.bytes.length > 8 ||
      !(e.bytes[e.bytes.length - 1] & 1) || (e.bytes.length === 1 && e.bytes[0] < 3)) fail('E_KEY');
    if (fingerprint !== expected) continue;
    if (selected !== null) fail('E_KEY');
    const key = createPublicKey({ key: { kty: 'RSA', n: n.bytes.toString('base64url'), e: e.bytes.toString('base64url') }, format: 'jwk' });
    selected = { key, width: n.bytes.length, algorithm: body[5] };
  }
  if (selected === null) fail('E_KEY');
  return selected;
}

function subpackets(bytes, expected, budget) {
  let at = 0;
  let matches = true;
  while (at < bytes.length) {
    if (++budget.count > RELEASE_SIGNATURE_LIMITS.maxSubpackets) fail('E_SIGNATURE');
    const length = finiteLength(bytes, at, 'E_SIGNATURE', true);
    at = length.at;
    if (length.size < 1) fail('E_SIGNATURE');
    span(bytes, at, length.size, 'E_SIGNATURE');
    const kind = bytes[at] & 127;
    const critical = bytes[at] & 128;
    const data = bytes.subarray(at + 1, at + length.size);
    if ([2, 3, 9].includes(kind)) {
      if (data.length !== 4) fail('E_SIGNATURE');
    } else if (kind === 16) {
      if (data.length !== 8) fail('E_SIGNATURE');
    } else if (kind === 33) {
      if (data.length !== 21 || data[0] !== 4) fail('E_SIGNATURE');
      if (data.subarray(1).toString('hex').toUpperCase() !== expected) matches = false;
    } else if (critical) fail('E_SIGNATURE');
    at += length.size;
  }
  return matches;
}

function signature(body, expected) {
  span(body, 0, 6, 'E_SIGNATURE');
  if (body[0] !== 4 || body[1] !== 1 || ![1, 3].includes(body[2]) || ![8, 10].includes(body[3])) fail('E_SIGNATURE');
  const hashedLength = body.readUInt16BE(4);
  span(body, 6, hashedLength, 'E_SIGNATURE');
  const header = body.subarray(0, 6 + hashedLength);
  let at = header.length;
  span(body, at, 2, 'E_SIGNATURE');
  const unhashedLength = body.readUInt16BE(at);
  at += 2;
  span(body, at, unhashedLength + 2, 'E_SIGNATURE');
  const budget = { count: 0 };
  const hashedMatches = subpackets(body.subarray(6, header.length), expected, budget);
  const unhashedMatches = subpackets(body.subarray(at, at + unhashedLength), expected, budget);
  at += unhashedLength;
  const prefix = body.subarray(at, at + 2);
  const rsa = mpi(body, at + 2, 'E_SIGNATURE');
  if (rsa.at !== body.length) fail('E_SIGNATURE');
  return {
    header, prefix, rsa: rsa.bytes,
    algorithm: body[2],
    hash: body[3] === 8 ? 'SHA256' : 'SHA512',
    matches: hashedMatches && unhashedMatches,
  };
}

export function verifyReleaseSignature(inReleaseBytes, keyringBytes, expectedFingerprint) {
  try {
    if (typeof expectedFingerprint !== 'string' || !/^[0-9A-F]{40}$/.test(expectedFingerprint)) fail('E_INPUT');
    const release = snapshot(inReleaseBytes, RELEASE_SIGNATURE_LIMITS.maxReleaseBytes);
    const keyring = snapshot(keyringBytes, RELEASE_SIGNATURE_LIMITS.maxKeyringBytes);
    const clear = clearsign(release);
    const budget = { count: 0 };
    const selected = publicKey(keyring, expectedFingerprint, budget);
    const signedPackets = packets(clear.signatures, budget);
    if (!signedPackets.length || signedPackets.length > RELEASE_SIGNATURE_LIMITS.maxSignatures) fail('E_SIGNATURE');
    let verified = false;
    const text = Buffer.from(clear.canonicalText, 'ascii');
    for (const packet of signedPackets) {
      if (packet.tag !== 2) fail('E_SIGNATURE');
      const sig = signature(packet.body, expectedFingerprint);
      if (sig.rsa.length > selected.width) fail('E_SIGNATURE');
      if (!sig.matches || sig.algorithm !== selected.algorithm || sig.hash !== clear.hash) continue;
      const trailer = Buffer.alloc(6);
      trailer[0] = 4;
      trailer[1] = 255;
      trailer.writeUInt32BE(sig.header.length, 2);
      const preimage = Buffer.concat([text, sig.header, trailer]);
      const digest = createHash(sig.hash).update(preimage).digest();
      if (!digest.subarray(0, 2).equals(sig.prefix)) continue;
      const padded = Buffer.alloc(selected.width);
      sig.rsa.copy(padded, selected.width - sig.rsa.length);
      if (verify(sig.hash, preimage, { key: selected.key, padding: constants.RSA_PKCS1_PADDING }, padded)) verified = true;
    }
    if (!verified) fail('E_SIGNATURE');
    return Object.freeze({
      profile: 'openpgp-v4-rsa-clearsign-v1',
      signatureVerified: true,
      publisherTrustEstablished: false,
      signerFingerprint: expectedFingerprint,
      hashAlgorithm: clear.hash,
      canonicalText: clear.canonicalText,
      signedTextSha256: createHash('sha256').update(text).digest('hex'),
      publicKeyAuthenticated: false,
      nativeQualified: false,
    });
  } catch (error) {
    if (error instanceof ReleaseSignatureError) throw error;
    fail('E_INPUT');
  }
}

function safePath(path) {
  if (path.length < 1 || path.length > 256 || !/^[A-Za-z0-9._+@-]+(?:\/[A-Za-z0-9._+@-]+)*$/.test(path)) fail('E_RELEASE');
  for (const segment of path.split('/')) if (segment === '.' || segment === '..') fail('E_RELEASE');
  return path;
}

function expectation(input) {
  if (input === null || typeof input !== 'object' || types.isProxy(input)) fail('E_INPUT');
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) fail('E_INPUT');
  const keys = Reflect.ownKeys(input);
  if (keys.length !== 4) fail('E_INPUT');
  const result = Object.create(null);
  for (const key of keys) {
    if (!['origin', 'suite', 'codename', 'indexPath'].includes(key)) fail('E_INPUT');
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!Object.hasOwn(descriptor, 'value')) fail('E_INPUT');
    const value = descriptor.value;
    if (typeof value !== 'string' || !value.length || value.length > 256 || !/^[\x20-\x7e]+$/.test(value) || value.trim() !== value) fail('E_INPUT');
    result[key] = value;
  }
  if (result.origin !== 'Ubuntu' || result.codename !== 'resolute') fail('E_INPUT');
  safePath(result.indexPath);
  return result;
}

export function selectReleaseIndex(canonicalText, expected) {
  try {
    if (typeof canonicalText !== 'string' || canonicalText.length < 1 || canonicalText.length > RELEASE_SIGNATURE_LIMITS.maxReleaseBytes) fail('E_INPUT');
    const wanted = expectation(expected);
    const lines = asciiLines(canonicalText, 'E_RELEASE');
    const fields = new Map();
    let current = null;
    let ended = false;
    for (const line of lines) {
      if (line === '') {
        ended = true;
        continue;
      }
      if (ended) fail('E_RELEASE');
      if (/^[\t ]/.test(line)) {
        if (current === null) fail('E_RELEASE');
        fields.get(current).push(line);
      } else {
        const match = /^([A-Za-z0-9][A-Za-z0-9-]*):[\t ]*(.*)$/.exec(line);
        if (!match) fail('E_RELEASE');
        current = match[1].toLowerCase();
        if (fields.has(current)) fail('E_RELEASE');
        fields.set(current, [match[2]]);
      }
    }
    const values = Object.create(null);
    for (const name of ['origin', 'suite', 'codename', 'date', 'valid-until']) {
      const parts = fields.get(name);
      if (!parts) {
        if (name === 'valid-until') continue;
        fail('E_RELEASE');
      }
      let value = '';
      for (const part of parts) value += (value ? ' ' : '') + part.trim();
      if (!value.length || value.length > 256) fail('E_RELEASE');
      values[name] = value;
    }
    if (values.origin !== wanted.origin || values.suite !== wanted.suite || values.codename !== wanted.codename) fail('E_RELEASE');
    const hashes = fields.get('sha256');
    if (!hashes || hashes[0] !== '' || hashes.length < 2) fail('E_RELEASE');
    const paths = new Set();
    let selected = null;
    for (let index = 1; index < hashes.length; index++) {
      const match = /^[\t ]+([0-9a-f]{64})[\t ]+(0|[1-9][0-9]*)[\t ]+([^\t ]+)$/.exec(hashes[index]);
      if (!match) fail('E_RELEASE');
      const path = safePath(match[3]);
      if (paths.has(path)) fail('E_RELEASE');
      paths.add(path);
      const size = Number(match[2]);
      if (!Number.isSafeInteger(size)) fail('E_RELEASE');
      if (path === wanted.indexPath) {
        if (size < 1 || size > 16777216) fail('E_RELEASE');
        selected = { path, byteLength: size, sha256: match[1] };
      }
    }
    if (selected === null) fail('E_RELEASE');
    return Object.freeze({
      ...selected,
      origin: values.origin,
      suite: values.suite,
      codename: values.codename,
      date: values.date,
      validUntil: values['valid-until'] ?? null,
      signedTextSha256: createHash('sha256').update(canonicalText, 'ascii').digest('hex'),
      signatureVerified: false,
    });
  } catch (error) {
    if (error instanceof ReleaseSignatureError) throw error;
    fail('E_INPUT');
  }
}
