import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { composeCandidatesFromObservationV1 } from "../candidates";
import { composeWithRuntime } from "../composition";
import { KeyIndex, sha256, type Digest } from "../identity";
import { allActors } from "./fixtures";

describe("candidate identity byte ownership", () => {
  it.each(["SHA-256", "forced collision"])("retains inserted bytes after caller mutation with %s", mode => {
    const digest: Digest = mode === "SHA-256" ? sha256 : () => new Uint8Array(32);
    const index = new KeyIndex(digest);
    const first = index.bytes("[a]");
    const second = index.bytes("[b]");
    index.add(first);
    first.set(second);
    expect(index.has(index.bytes("[a]"))).toBe(true);
    expect(index.has(second)).toBe(false);
    index.add(second);
    second.fill(0);
    expect(index.has(index.bytes("[a]"))).toBe(true);
    expect(index.has(index.bytes("[b]"))).toBe(true);
    expect(index.has(second)).toBe(false);
  });

  it("copies offset typed arrays intrinsically without caller slice, iterator or species callbacks", () => {
    const index = new KeyIndex(() => new Uint8Array(32));
    const backing = Uint8Array.of(9, 1, 2, 3, 9);
    const input = backing.subarray(1, 4);
    const callback = vi.fn(() => { throw Error("caller callback"); });
    Object.defineProperty(input, "slice", { value: callback });
    Object.defineProperty(input, Symbol.iterator, { value: callback });
    Object.defineProperty(input, "constructor", { get: callback });
    index.add(input);
    backing.fill(0);
    expect(index.has(Uint8Array.of(1, 2, 3))).toBe(true);
    expect(index.has(Uint8Array.of(0, 0, 0))).toBe(false);
    expect(callback).not.toHaveBeenCalled();
  });

  it.each(["w", "b"] as const)("preserves complete %s composition batches, diagnostics and independent SHA-256 under forced collisions", side => {
    const observation = allActors(side);
    const normal = composeCandidatesFromObservationV1(observation);
    const colliding = composeWithRuntime(observation, () => new Uint8Array(32)).batch;
    expect(colliding).toEqual(normal);
    const bytes = new TextEncoder().encode(JSON.stringify(normal));
    const expected = createHash("sha256").update(bytes).digest("hex");
    expect(expected).toBe(side === "w"
      ? "4d67ac149889cafd82a15ece48061d844a8061691a55ea201b5f65e0b4150908"
      : "57a5afdfda19fda8a5a71da19dcbe9d2ab79763306ffecdff19bef69b84fe253");
    expect(Buffer.from(sha256(bytes)).toString("hex")).toBe(expected);
    expect(createHash("sha256").update(JSON.stringify(colliding)).digest("hex")).toBe(expected);
  });
});
