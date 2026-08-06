import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = join(import.meta.dirname, "../src");

const walk = (dir: string): string[] => {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
};

describe("starchess-core boundary", () => {
  it("does not import apps/, SolidJS, CSS, or UI animations", () => {
    const forbidden =
      /from ["'](?:solid-js|.*\.module\.css|.*\/apps\/ui|~\/(?:animations|store|components|hooks))/;
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const text = readFileSync(file, "utf8");
      for (const line of text.split("\n")) {
        if (!line.includes("import")) continue;
        // SPEC comments may mention apps/ui paths — ignore those.
        if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) continue;
        if (forbidden.test(line)) offenders.push(`${file}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
