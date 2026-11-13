// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { constructOwnedNumber, requireFloat64Hex, requireRef, type OwnedFloat64Hex } from "./ownedKernel";

const FixedArrayBuffer = ArrayBuffer;
const FixedDataView = DataView;
const putByte = DataView.prototype.setUint8;
const getNumber = DataView.prototype.getFloat64;
const apply = Reflect.apply;
const charCode = String.prototype.charCodeAt;

export const encodeOwnedNumber = (value: number): OwnedFloat64Hex => {
  return constructOwnedNumber(value);
};

export const decodeOwnedNumber = (value: unknown): number => {
  const owned = requireFloat64Hex(value);
  const view = new FixedDataView(new FixedArrayBuffer(8));
  for (let i = 0; i < 8; i++) {
    let byte = 0;
    for (let j = 0; j < 2; j++) {
      const code = apply(charCode, owned.hex, [2 * i + j]) as number;
      byte = 16 * byte + (code <= 57 ? code - 48 : code - 87);
    }
    apply(putByte, view, [i, byte]);
  }
  return apply(getNumber, view, [0, false]) as number;
};

export const equalOwnedRefs = (left: unknown, right: unknown): boolean => {
  const a = requireRef(left), b = requireRef(right);
  return a.byteLength === b.byteLength && a.sha256 === b.sha256;
};
