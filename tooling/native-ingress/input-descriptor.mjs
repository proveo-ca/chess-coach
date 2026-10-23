// SPEC: _spec/tooling/native-ingress/custody.puml
import { types } from 'node:util';

export const MAX_FIXTURE_BYTES = 65_536;

export class CustodyError extends Error {
  constructor(code, cause) {
    super(code, cause ? { cause } : undefined);
    this.name = 'CustodyError';
    this.code = code;
  }
}

export function validateFixtureDescriptor(value) {
  const reject = () => { throw new CustodyError('E_INPUT'); };
  if (value === null || typeof value !== 'object' || types.isProxy(value)) reject();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) reject();
  const keys = Reflect.ownKeys(value);
  const expected = ['name', 'byteLength', 'sha256'];
  if (keys.length !== expected.length || keys.some(key => !expected.includes(key))) reject();
  const fields = expected.map(key => Object.getOwnPropertyDescriptor(value, key));
  if (fields.some(field => !field || !Object.hasOwn(field, 'value'))) reject();
  const [name, byteLength, sha256] = fields.map(field => field.value);
  if (name !== 'fixture.bin' || !Number.isSafeInteger(byteLength) || byteLength < 1 ||
    byteLength > MAX_FIXTURE_BYTES || typeof sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(sha256)) reject();
  return Object.freeze({ name, byteLength, sha256 });
}
