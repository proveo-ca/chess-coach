import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { compareBytes, createIdentity, digestKey, keyBytes } from "../candidates/canonicalIdentity";

describe("canonical UTF-8 identity", () => {
  it.each(["", "abc", "a".repeat(1_000_000), "[]", "é🙂\u0000"])("matches SHA-256 for vector length %i", (text) => {
    const bytes = keyBytes(text);
    expect(Buffer.from(digestKey(bytes)).toString("hex")).toBe(createHash("sha256").update(bytes).digest("hex"));
  });
  it("uses unsigned UTF-8 lexicographic order including prefix length", () => {
    expect(compareBytes(new Uint8Array([127]), new Uint8Array([128]))).toBeLessThan(0);
    expect(compareBytes(keyBytes("a"), keyBytes("aa"))).toBeLessThan(0);
    expect(compareBytes(keyBytes("é"), keyBytes("z"))).toBeGreaterThan(0);
    expect(compareBytes(keyBytes("same"), keyBytes("same"))).toBe(0);
  });
  it("retains exact identities in a forced digest collision bucket", () => {
    const collision = createIdentity(() => new Uint8Array(32));
    const original = keyBytes("first");
    collision.add(original);
    original.fill(0);
    expect(collision.has(keyBytes("first"))).toBe(true);
    expect(collision.has(keyBytes("second"))).toBe(false);
    collision.add(keyBytes("second"));
    expect(collision.has(keyBytes("first"))).toBe(true);
    expect(collision.has(keyBytes("second"))).toBe(true);
    expect(createIdentity().has(keyBytes("first"))).toBe(false);
  });
});
