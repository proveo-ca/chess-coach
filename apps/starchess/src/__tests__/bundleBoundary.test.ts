import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = join(import.meta.dirname, "..");

const walk = (dir: string): string[] => {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === ".gitkeep") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx|js|mjs)$/.test(p)) out.push(p);
  }
  return out;
};

describe("apps/starchess boundary", () => {
  it("does not import apps/ui, gameStore, coach, EnginePool, stockfish, web-llm", () => {
    const forbidden =
      /from ["'](?:.*apps\/ui|~\/(?:store|engine|hooks\/useChessBoard)|.*gameStore|.*coachStore|.*EnginePool|.*stockfish|.*web-llm|@mlc-ai)/;
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const text = readFileSync(file, "utf8");
      for (const line of text.split("\n")) {
        if (!line.includes("import")) continue;
        if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) continue;
        if (forbidden.test(line)) offenders.push(`${file}: ${line.trim()}`);
        if (line.includes("/chess/pieces/")) offenders.push(`${file}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
