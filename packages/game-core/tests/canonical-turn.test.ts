// SPEC: _spec/turn-resolution.puml
import { createHash } from "node:crypto";
import { expect, test } from "bun:test";
import { turnCaseOutcome, TURN_QUEUES } from "./turn-corpus";
import fixture from "./fixtures/canonical-turn-resolution.json";

const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable)
  : value !== null && typeof value === "object"
    ? Object.fromEntries(Object.entries(value).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, item]) => [key, stable(item)])) : value;

for (const variant of fixture.variants) {
  test(`full canonical begin/admission/settlement matches variant ${variant.variant}`, () => {
    expect(TURN_QUEUES.length).toBe(fixture.queuesPerSide);
    const hash = createHash("sha256");
    let count = 0, settled = 0, rejected = 0;
    for (let white = 0; white < TURN_QUEUES.length; white++) for (let black = 0; black < TURN_QUEUES.length; black++) {
      const result = turnCaseOutcome({ variant: variant.variant, white, black });
      if ((result as { kind: string }).kind === "settled") settled++; else rejected++;
      hash.update(JSON.stringify(stable(result)) + "\n");
      count++;
    }
    expect(count).toBe(variant.cases);
    expect(settled).toBe(variant.settled);
    expect(rejected).toBe(variant.rejected);
    expect(hash.digest("hex")).toBe(variant.sha256);
  }, 30_000);
}
