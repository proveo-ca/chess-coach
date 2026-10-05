// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import jsSHA from "jssha/sha256";

export type Digest = (bytes: Uint8Array) => Uint8Array;
export const sha256: Digest = (bytes) => {
  const hash = new jsSHA("SHA-256", "UINT8ARRAY");
  hash.update(bytes);
  return hash.getHash("UINT8ARRAY");
};
export const compareBytes = (a: Uint8Array, b: Uint8Array): number => {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) return a[i]! - b[i]!;
  }
  return a.length - b.length;
};
export class KeyIndex {
  private readonly buckets = new Map<string, Uint8Array[]>();
  private readonly encoder = new TextEncoder();
  constructor(private readonly digest: Digest = sha256) {}
  bytes(key: string): Uint8Array { return this.encoder.encode(key); }
  has(bytes: Uint8Array): boolean {
    return this.bucket(bytes)?.some((other) => compareBytes(bytes, other) === 0) ?? false;
  }
  add(bytes: Uint8Array): void {
    const hash = this.hash(bytes);
    const bucket = this.buckets.get(hash);
    if (bucket) bucket.push(bytes);
    else this.buckets.set(hash, [bytes]);
  }
  private hash(bytes: Uint8Array): string {
    return Array.from(this.digest(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  private bucket(bytes: Uint8Array): Uint8Array[] | undefined { return this.buckets.get(this.hash(bytes)); }
}
