import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { publishReport } from "../challenge/publication";

describe("exclusive atomic evidence publication", () => {
  it("publishes complete JSON and preserves an existing report", () => {
    const directory = mkdtempSync("/tmp/opencode/challenge-report-");
    try {
      const path = join(directory, "report.json");
      publishReport(path, { version: 1, rows: ["complete"] });
      const bytes = readFileSync(path, "utf8");
      expect(JSON.parse(bytes)).toEqual({ version: 1, rows: ["complete"] });
      expect(() => publishReport(path, { version: 2 })).toThrow();
      expect(readFileSync(path, "utf8")).toBe(bytes);
      expect(readdirSync(directory)).toEqual(["report.json"]);
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      expect(() => publishReport(join(directory, "failed.json"), circular)).toThrow();
      expect(readdirSync(directory)).toEqual(["report.json"]);
    } finally { rmSync(directory, { recursive: true }); }
  });
});
