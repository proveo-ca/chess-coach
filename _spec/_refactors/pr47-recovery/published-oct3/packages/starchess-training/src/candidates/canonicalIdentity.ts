// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import { sha256 } from "@noble/hashes/sha2.js";

export type Digest = (bytes: Uint8Array) => Uint8Array;
export const keyBytes = (key: string): Uint8Array => new TextEncoder().encode(key);
export const compareBytes = (left: Uint8Array, right: Uint8Array): number => {
  for (let index = 0; index < Math.min(left.length, right.length); index++) {
    if (left[index] !== right[index]) return left[index]! - right[index]!;
  }
  return left.length - right.length;
};
export const digestKey = (bytes: Uint8Array): Uint8Array => sha256(bytes);

export const createIdentity = (digest: Digest = digestKey) => {
  const buckets = new Map<string, Uint8Array[]>();
  const bucketId = (bytes: Uint8Array) => Array.from(digest(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return {
    has(bytes: Uint8Array): boolean {
      return buckets.get(bucketId(bytes))?.some((existing) => compareBytes(existing, bytes) === 0) ?? false;
    },
    add(bytes: Uint8Array): void {
      const id = bucketId(bytes);
      const bucket = buckets.get(id) ?? [];
      if (!bucket.some((existing) => compareBytes(existing, bytes) === 0)) bucket.push(bytes.slice());
      buckets.set(id, bucket);
    },
  };
};
