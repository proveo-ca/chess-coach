// SPEC: _spec/tooling/native-ingress/package-claims.puml
import { types } from 'node:util';

const typed = Object.getPrototypeOf(Uint8Array.prototype);
const lengthOf = Object.getOwnPropertyDescriptor(typed, 'length').get;
const bufferOf = Object.getOwnPropertyDescriptor(typed, 'buffer').get;
const offsetOf = Object.getOwnPropertyDescriptor(typed, 'byteOffset').get;
const resizable = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
const wanted = ['xz-utils', 'liblzma5', 'libc6'];
const selected = ['Package', 'Source', 'Version', 'Architecture', 'Status', 'Built-Using'];

export class PackageClaimError extends Error {
  constructor() { super('E_PACKAGE'); this.code = 'E_PACKAGE'; Object.freeze(this); }
}

function fail() { throw new PackageClaimError(); }

export function selectPackageClaims(input, maximumBytes = 4194304) {
  try {
    if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1 || maximumBytes > 4194304) fail();
    if (types.isProxy(input) || !types.isUint8Array(input)) fail();
    const length = lengthOf.call(input), backing = bufferOf.call(input), offset = offsetOf.call(input);
    if (length < 1 || length > maximumBytes || types.isSharedArrayBuffer(backing) || (resizable && resizable.call(backing))) fail();
    const bytes = Buffer.from(new Uint8Array(backing, offset, length));
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    if (text.includes('\r') || text.includes('\0')) fail();
    const paragraphs = text.split(/\n\n+/);
    if (paragraphs.length > 4096) fail();
    const output = [], names = new Set();
    for (const paragraph of paragraphs) {
      if (Buffer.byteLength(paragraph) > 131072) fail();
      const record = {};
      let previous = null;
      for (const line of paragraph.split('\n')) {
        if (/^[ \t]/.test(line)) {
          if (previous === null) fail();
          if (selected.includes(previous)) record[previous] += ' ' + line.trim();
          continue;
        }
        if (line === '') { previous = null; continue; }
        const split = line.indexOf(':');
        if (split < 1 || !/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(line.slice(0, split))) fail();
        const name = line.slice(0, split).toLowerCase();
        previous = selected.find(field => field.toLowerCase() === name) ?? name;
        if (!selected.includes(previous)) continue;
        if (Object.hasOwn(record, previous)) fail();
        record[previous] = line.slice(split + 1).trim();
      }
      if (!wanted.includes(record.Package)) continue;
      if (names.has(record.Package)) fail();
      names.add(record.Package);
      for (const value of Object.values(record)) if (Buffer.byteLength(value) > 512 || /[\u0000-\u001f\u007f-\u009f]/u.test(value)) fail();
      output.push(Object.freeze(record));
    }
    return Object.freeze(output);
  } catch (error) {
    if (error instanceof PackageClaimError) throw error;
    fail();
  }
}
