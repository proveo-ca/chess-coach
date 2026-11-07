// SPEC: _spec/classical-resolution.puml
import { createHash } from "node:crypto";
import { expect, test } from "bun:test";
import { resolveTurn } from "../src";
import { CLASSICAL_LAYOUTS, classicalCorpus } from "./classical-corpus";
import fixture from "./fixtures/canonical-classical-resolution.json";

const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable)
  : value !== null && typeof value === "object"
    ? Object.fromEntries(Object.entries(value).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, item]) => [key, stable(item)])) : value;

fixture.layouts.forEach((layout, index) => {
  test(`classical phase matches canonical reference for ${layout.layout.join(" / ")}`, () => {
    expect(CLASSICAL_LAYOUTS[index]!.map(String)).toEqual(layout.layout);
    const hash = createHash("sha256");
    let count = 0;
    for (const input of classicalCorpus(index)) {
      hash.update(JSON.stringify(stable(resolveTurn(input))) + "\n");
      count++;
    }
    expect(count).toBe(layout.cases);
    expect(hash.digest("hex")).toBe(layout.sha256);
  }, 30_000);
});
