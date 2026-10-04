// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import { describe, expect, it, vi } from "vitest";
import { ContractError, inspectDto, MAX_CODEC_BYTES, parseJson } from "../challengeContract/validation";

const sizeError = (run: () => unknown): void => {
  let caught: unknown;
  try { run(); } catch (error) { caught = error; }
  expect(caught).toBeInstanceOf(ContractError);
  expect((caught as ContractError).code).toBe("SIZE");
};
const chain = (levels: number, leaf: unknown = null): unknown => {
  let value = leaf;
  for (let index = 0; index < levels; index++) value = { next: value };
  return value;
};

describe("bounded detached raw DTO inspection", () => {
  it("accepts depth 16 and rejects depth 17 before requesting leaf descriptors", () => {
    expect(inspectDto(chain(16))).toEqual(chain(16));
    const getOwnPropertyDescriptor = vi.fn(() => { throw new Error("depth guard ran too late"); });
    sizeError(() => inspectDto(chain(17, new Proxy({}, { getOwnPropertyDescriptor }))));
    expect(getOwnPropertyDescriptor).not.toHaveBeenCalled();
  });

  it("counts the root and every edge at the exact 8192 visit boundary", () => {
    expect(inspectDto(Array(8191).fill(null))).toEqual(Array(8191).fill(null));
    sizeError(() => inspectDto(Array(8192).fill(null)));
    expect(inspectDto({ a: Array(8190).fill(null) })).toEqual({ a: Array(8190).fill(null) });
    sizeError(() => inspectDto({ a: Array(8191).fill(null) }));
    sizeError(() => inspectDto({ a: Array(4095).fill(null), b: Array(4095).fill(null) }));
  });

  it("caps input own keys before collecting descriptors", () => {
    const wide = Object.fromEntries(Array.from({ length: 8192 }, (_, index) => [`k${index}`, null]));
    const getOwnPropertyDescriptor = vi.fn(() => { throw new Error("key guard ran too late"); });
    sizeError(() => inspectDto(new Proxy(wide, { getOwnPropertyDescriptor })));
    expect(getOwnPropertyDescriptor).not.toHaveBeenCalled();
  });

  it("rejects huge sparse array lengths with ContractError SIZE", () => {
    for (const length of [8192, 1_000_000, 0xffffffff]) sizeError(() => inspectDto(new Array(length)));
    expect(() => inspectDto(new Array(65))).toThrow("ARRAY");
  });

  it.each(["a", "é", "€", "😀", "\ud800", "\udc00", "\ud800a"])("counts exact UTF-8 bytes for %j", (unit) => {
    const bytes = new TextEncoder().encode(unit).length;
    const text = unit.repeat(Math.floor(MAX_CODEC_BYTES / bytes)) + "a".repeat(MAX_CODEC_BYTES % bytes);
    expect(new TextEncoder().encode(text).length).toBe(MAX_CODEC_BYTES);
    expect(inspectDto(text)).toBe(text);
    sizeError(() => inspectDto(text + "a"));
  });

  it("shares the 1 MiB text budget between keys and string values", () => {
    const exact = { é: "a".repeat(MAX_CODEC_BYTES - 2) };
    expect(inspectDto(exact)).toEqual(exact);
    sizeError(() => inspectDto({ é: exact.é + "a" }));
    expect(inspectDto({ ["a".repeat(MAX_CODEC_BYTES)]: null })).toEqual({ ["a".repeat(MAX_CODEC_BYTES)]: null });
    sizeError(() => inspectDto({ ["a".repeat(MAX_CODEC_BYTES + 1)]: null }));
    sizeError(() => inspectDto(["a".repeat(MAX_CODEC_BYTES)]));
  });

  it("rejects oversized string lengths before allocating UTF-8 buffers", () => {
    const encode = vi.spyOn(TextEncoder.prototype, "encode");
    try {
      sizeError(() => inspectDto("a".repeat(MAX_CODEC_BYTES + 1)));
      sizeError(() => parseJson(" ".repeat(MAX_CODEC_BYTES + 1)));
      expect(encode).not.toHaveBeenCalled();
    } finally { encode.mockRestore(); }
  });

  it("memoizes shared references as detached call-local copies", () => {
    const shared = { text: "valid" };
    const input = { left: shared, right: shared };
    const first = inspectDto(input) as typeof input;
    const second = inspectDto(input) as typeof input;
    expect(first.left).toBe(first.right);
    expect(first.left).not.toBe(shared);
    expect(second.left).not.toBe(first.left);
    first.left.text = "changed";
    expect(shared.text).toBe("valid");
    expect(second.right.text).toBe("valid");
    shared.text = "new call";
    expect(inspectDto(input)).toEqual({ left: { text: "new call" }, right: { text: "new call" } });
  });

  it("handles shared DAGs without exponential expansion and rejects 26 levels", () => {
    const dag = (levels: number): object => {
      let value: object = {};
      for (let index = 0; index < levels; index++) value = { left: value, right: value };
      return value;
    };
    let output = inspectDto(dag(16)) as { left: object; right: object };
    for (let index = 0; index < 16; index++) {
      expect(output.left).toBe(output.right);
      output = output.left as typeof output;
    }
    sizeError(() => inspectDto(dag(26)));
  });

  it("checks the depth of a memoized subtree on deeper paths", () => {
    const shared = chain(3);
    expect(inspectDto({ shallow: shared, deep: chain(12, shared) })).toEqual({ shallow: shared, deep: chain(12, shared) });
    sizeError(() => inspectDto({ shallow: shared, deep: chain(13, shared) }));
  });

  it("rejects cycles when a shared branch points to an active ancestor", () => {
    const shared: Record<string, unknown> = {};
    const input = { left: shared, right: shared };
    shared.back = input;
    expect(() => inspectDto(input)).toThrow(ContractError);
    delete shared.back;
    shared.self = shared;
    expect(() => inspectDto(input)).toThrow(ContractError);
    const array: unknown[] = [];
    array.push(array);
    expect(() => inspectDto(array)).toThrow(ContractError);
  });
});
