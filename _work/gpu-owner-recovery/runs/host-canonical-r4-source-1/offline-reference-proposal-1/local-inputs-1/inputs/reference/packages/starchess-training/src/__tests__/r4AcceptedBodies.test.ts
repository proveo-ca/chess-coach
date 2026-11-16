// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const accepted = [
  {
    file: "ml-adjutant-r4-episode-request-completion.md",
    marker: "R4 EPISODE REQUEST COMPLETION",
    length: 8959,
    sha256: "78f7032e39afece3497208b9d774f8192894cbe29ddcfdc2218209de994c7049",
  },
  {
    file: "ml-adjutant-r4-accounting-bootstrap-clarification.md",
    marker: "R4 ACCOUNTING BOOTSTRAP CLARIFICATION",
    length: 15189,
    sha256: "0b5af8d2189ec42ae2b69f0938eae00ca48bb37f701858d8b9c5b004da3fb2f3",
  },
];

describe("accepted R4 reading snapshots", () => {
  it.each(accepted)("preserves the exact accepted body of $file", ({ file, marker, length, sha256 }) => {
    const bytes = readFileSync(new URL(`../../../../_spec/_plans/${file}`, import.meta.url));
    const begin = Buffer.from(`<!-- BEGIN ${marker} ACCEPTED BODY -->\n`);
    const end = Buffer.from(`<!-- END ${marker} ACCEPTED BODY -->`);
    const start = bytes.indexOf(begin), stop = bytes.indexOf(end);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(stop).toBeGreaterThan(start + begin.length);
    expect(bytes.indexOf(begin, start + begin.length)).toBe(-1);
    expect(bytes.indexOf(end, stop + end.length)).toBe(-1);
    const body = bytes.subarray(start + begin.length, stop);
    expect(body.length).toBe(length);
    expect(body[body.length - 1]).toBe(10);
    expect(createHash("sha256").update(body).digest("hex")).toBe(sha256);
  });
});
