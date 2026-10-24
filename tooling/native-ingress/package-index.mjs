// SPEC: _spec/tooling/native-ingress/package-index.puml
import { createHash } from 'node:crypto';
import { types } from 'node:util';

export const PACKAGE_INDEX_LIMITS = Object.freeze({
  maxInputBytes: 16777216,
  maxParagraphBytes: 131072,
  maxParagraphs: 65536,
  maxSelected: 8,
  maxValueBytes: 1024,
  maxPackageBytes: 8388608,
  maxOutputBytes: 65536,
});

const codes = Object.freeze(['E_INPUT', 'E_LIMITS', 'E_HASH', 'E_PACKAGE', 'E_AMBIGUOUS', 'E_OUTPUT']);
const typed = Object.getPrototypeOf(Uint8Array.prototype);
const lengthOf = Object.getOwnPropertyDescriptor(typed, 'length').get;
const bufferOf = Object.getOwnPropertyDescriptor(typed, 'buffer').get;
const offsetOf = Object.getOwnPropertyDescriptor(typed, 'byteOffset').get;
const resizable = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
const identityFields = Object.freeze(['package', 'version', 'architecture', 'sourcePackage', 'sourceVersion']);
const reportedFields = Object.freeze(['package', 'version', 'architecture', 'source', 'filename', 'size', 'sha256']);
const packagePattern = /^[a-z0-9][a-z0-9+.-]*$/;
const architecturePattern = /^[a-z0-9][a-z0-9-]*$/;
const versionPattern = /^[0-9][A-Za-z0-9.+:~\-]*$/;

export class PackageIndexError extends Error {
  constructor(code) {
    const fixed = codes.includes(code) ? code : 'E_INPUT';
    super(fixed);
    this.name = 'PackageIndexError';
    this.code = fixed;
    Object.freeze(this);
  }
}

function fail(code) {
  throw new PackageIndexError(code);
}

function ownData(input, allowed, exact, code) {
  if (input === null || typeof input !== 'object' || types.isProxy(input)) fail(code);
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) fail(code);
  const keys = Reflect.ownKeys(input);
  if (exact && keys.length !== allowed.length) fail(code);
  const result = Object.create(null);
  for (const key of keys) {
    if (typeof key !== 'string' || !allowed.includes(key)) fail(code);
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!Object.hasOwn(descriptor, 'value')) fail(code);
    result[key] = descriptor.value;
  }
  return result;
}

function limitsFrom(overrides) {
  const supplied = ownData(overrides, Object.keys(PACKAGE_INDEX_LIMITS), false, 'E_LIMITS');
  const limits = { ...PACKAGE_INDEX_LIMITS };
  for (const key of Object.keys(supplied)) {
    const value = supplied[key];
    if (!Number.isSafeInteger(value) || value < 1 || value > limits[key]) fail('E_LIMITS');
    limits[key] = value;
  }
  return limits;
}

function expectedReference(input) {
  const ref = ownData(input, ['byteLength', 'sha256'], true, 'E_INPUT');
  if (!Number.isSafeInteger(ref.byteLength) || ref.byteLength < 1 || ref.byteLength > PACKAGE_INDEX_LIMITS.maxInputBytes ||
    typeof ref.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(ref.sha256)) fail('E_INPUT');
  return ref;
}

function identityString(value) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 256 ||
    !/^[\x21-\x7e]+$/.test(value)) fail('E_INPUT');
  return value;
}

function expectedTargets(input, limits) {
  if (types.isProxy(input) || !Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype) fail('E_INPUT');
  const size = Object.getOwnPropertyDescriptor(input, 'length').value;
  if (size < 1 || size > limits.maxSelected || Reflect.ownKeys(input).length !== size + 1) fail('E_INPUT');
  const targets = [];
  for (let index = 0; index < size; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail('E_INPUT');
    const target = ownData(descriptor.value, identityFields, true, 'E_INPUT');
    for (const name of identityFields) identityString(target[name]);
    if (!packagePattern.test(target.package) || !packagePattern.test(target.sourcePackage) ||
      !architecturePattern.test(target.architecture) || !versionPattern.test(target.version) || !versionPattern.test(target.sourceVersion)) fail('E_INPUT');
    for (const previous of targets) {
      if (target.package === previous.package && target.version === previous.version && target.architecture === previous.architecture) fail('E_INPUT');
    }
    targets.push(target);
  }
  return targets;
}

function snapshot(input, maximum) {
  if (types.isProxy(input) || !types.isUint8Array(input)) fail('E_INPUT');
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Uint8Array.prototype && prototype !== Buffer.prototype) fail('E_INPUT');
  const length = lengthOf.call(input);
  const backing = bufferOf.call(input);
  const offset = offsetOf.call(input);
  if (length < 1 || length > maximum || types.isSharedArrayBuffer(backing) ||
    (resizable && resizable.call(backing))) fail('E_INPUT');
  return Buffer.from(new Uint8Array(backing, offset, length));
}

function trimAscii(value) {
  return value.replace(/^[\t ]+|[\t ]+$/g, '');
}

function paragraphFields(paragraph) {
  const fields = Object.create(null);
  const seen = new Set();
  let previous = null;
  for (const line of paragraph.split('\n')) {
    if (line === '') {
      previous = null;
      continue;
    }
    if (/^[\t ]/.test(line)) {
      if (previous === null) fail('E_PACKAGE');
      if (reportedFields.includes(previous)) fields[previous] += ' ' + trimAscii(line);
      continue;
    }
    const colon = line.indexOf(':');
    if (colon < 1 || !/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(line.slice(0, colon))) fail('E_PACKAGE');
    previous = line.slice(0, colon).toLowerCase();
    if (seen.has(previous)) fail('E_PACKAGE');
    seen.add(previous);
    if (reportedFields.includes(previous)) fields[previous] = trimAscii(line.slice(colon + 1));
  }
  return fields;
}

function filenameFrom(value) {
  if (!value.startsWith('pool/') || !value.endsWith('.deb') ||
    !/^[A-Za-z0-9._+@-]+(?:\/[A-Za-z0-9._+@-]+)*$/.test(value)) fail('E_PACKAGE');
  for (const part of value.split('/')) if (part === '.' || part === '..') fail('E_PACKAGE');
  return value;
}

function selectedReference(fields, target, limits) {
  for (const name of reportedFields) {
    const value = fields[name];
    if (name === 'source' && value === undefined) continue;
    if (typeof value !== 'string' || !value.length || Buffer.byteLength(value, 'utf8') > limits.maxValueBytes ||
      !/^[\x20-\x7e]+$/.test(value) || trimAscii(value) !== value) fail('E_PACKAGE');
  }
  if (!packagePattern.test(fields.package) || !versionPattern.test(fields.version) || !architecturePattern.test(fields.architecture)) fail('E_PACKAGE');
  let sourcePackage = fields.package;
  let sourceVersion = fields.version;
  if (fields.source !== undefined) {
    const match = /^([a-z0-9][a-z0-9+.-]*)(?: \(([0-9][A-Za-z0-9.+:~\-]*)\))?$/.exec(fields.source);
    if (!match) fail('E_PACKAGE');
    sourcePackage = match[1];
    if (match[2] !== undefined) sourceVersion = match[2];
  }
  if (sourcePackage !== target.sourcePackage || sourceVersion !== target.sourceVersion ||
    !/^[1-9][0-9]*$/.test(fields.size) || !/^[0-9a-f]{64}$/.test(fields.sha256)) fail('E_PACKAGE');
  const byteLength = Number(fields.size);
  if (!Number.isSafeInteger(byteLength) || byteLength > limits.maxPackageBytes) fail('E_PACKAGE');
  return {
    package: fields.package,
    version: fields.version,
    architecture: fields.architecture,
    sourcePackage,
    sourceVersion,
    filename: filenameFrom(fields.filename),
    byteLength,
    sha256: fields.sha256,
  };
}

export function selectPackageReferences(inputBytes, expectedIndexRef, expectedPackages, overrides = {}) {
  try {
    const limits = limitsFrom(overrides);
    const indexRef = expectedReference(expectedIndexRef);
    const targets = expectedTargets(expectedPackages, limits);
    const bytes = snapshot(inputBytes, limits.maxInputBytes);
    const inputSha256 = createHash('sha256').update(bytes).digest('hex');
    if (bytes.length !== indexRef.byteLength || inputSha256 !== indexRef.sha256) fail('E_HASH');
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    } catch {
      fail('E_PACKAGE');
    }
    if (/[\x00-\x08\x0b-\x1f\x7f]/.test(text)) fail('E_PACKAGE');
    const selected = new Array(targets.length);
    let count = 0;
    let at = 0;
    while (at < text.length) {
      const separator = text.indexOf('\n\n', at);
      const end = separator < 0 ? text.length : separator;
      const paragraph = text.slice(at, end);
      at = end;
      while (text[at] === '\n') at++;
      if (!paragraph.length) continue;
      if (++count > limits.maxParagraphs || Buffer.byteLength(paragraph, 'utf8') > limits.maxParagraphBytes) fail('E_PACKAGE');
      const fields = paragraphFields(paragraph);
      for (let index = 0; index < targets.length; index++) {
        const target = targets[index];
        if (fields.package !== target.package || fields.version !== target.version || fields.architecture !== target.architecture) continue;
        if (selected[index] !== undefined) fail('E_AMBIGUOUS');
        selected[index] = selectedReference(fields, target, limits);
      }
    }
    for (let index = 0; index < targets.length; index++) if (selected[index] === undefined) fail('E_PACKAGE');
    const result = {
      profile: 'ubuntu-package-index-refs-v1',
      indexBytesMatched: true,
      byteLength: bytes.length,
      inputSha256,
      packages: selected,
      signatureVerified: false,
      provenanceVerified: false,
      sourceAuthenticated: false,
      nativeQualified: false,
      decoderQualified: false,
      rustReady: false,
      trainingReady: false,
    };
    if (Buffer.byteLength(JSON.stringify(result), 'utf8') > limits.maxOutputBytes) fail('E_OUTPUT');
    for (const reference of selected) Object.freeze(reference);
    Object.freeze(selected);
    return Object.freeze(result);
  } catch (error) {
    if (error instanceof PackageIndexError) throw error;
    fail('E_INPUT');
  }
}
