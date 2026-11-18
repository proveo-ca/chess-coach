// SPEC: _spec/policy-runtime.puml
import { createHash } from "node:crypto";
import { expect, test } from "bun:test";
import { streamStateShape } from "../../contracts/src/episode";
import { deriveRoster, deriveStream, drawStream } from "../src/rng";
import fixture from "./fixtures/rng-reference.json";

test("20 derived roots are distinct and match frozen reference draw fingerprints", () => {
  const roster = deriveRoster();
  expect(new Set(roster.map(entry => entry.stream.root)).size).toBe(20);
  for (const [index, entry] of roster.entries()) {
    const expected = fixture.roots[index]!;
    expect({ master: entry.master, label: String(entry.label), root: entry.stream.root }).toEqual({ master: expected.master, label: expected.label, root: expected.root });
    let current = { ...entry.stream, status: "active" as const };
    const draws = [];
    for (let i = 0; i < fixture.drawsPerRoot; i++) {
      const draw = drawStream(current);
      draws.push(draw.uniform);
      current = { ...draw.after, status: "active" };
    }
    expect(createHash("sha256").update(JSON.stringify(draws)).digest("hex")).toBe(expected.drawsSha256);
    expect(entry.stream.drawCount).toBe(0);
  }
});

test("standard JSON restore preserves the next draw and rejects impossible stream prefixes", () => {
  let current = deriveStream(101, "policy-sampling");
  for (let i = 0; i < 100; i++) current = drawStream(current).after;
  const restored = streamStateShape.parse(JSON.parse(JSON.stringify(current)));
  expect(drawStream(restored)).toEqual(drawStream(current));
  for (const invalid of [{ ...current, state: current.state ^ 1 }, { ...current, drawCount: current.drawCount + 1 },
    { ...current, status: "unused" }, { ...current, extra: true }]) expect(() => streamStateShape.parse(invalid)).toThrow();
  const unused = deriveStream(101, "environment-settlement");
  expect(() => drawStream(unused)).toThrow("CLOSED_OR_EXHAUSTED");
  expect(() => deriveStream(100, "selection")).toThrow("DOMAIN");
});
