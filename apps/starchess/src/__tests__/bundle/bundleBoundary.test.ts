import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = join(import.meta.dirname, "../..");

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
    // Ban Coach UI / engine paths. StarChess may use its own `~/store/*`
    // (settings, capabilities, review vision) — not apps/ui's store tree.
    const forbidden =
      /from ["'](?:.*apps\/ui|~\/(?:engine|hooks\/useChessBoard)|.*gameStore|.*coachStore|.*EnginePool|.*stockfish|.*web-llm|@mlc-ai)/;
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

  it("ACL: only public @chess-coach/starchess-core — no deep resolve/rules/board paths", () => {
    // SPEC: _spec/apps/starchess/core/engine-boundary.puml
    const deep =
      /from ["']@chess-coach\/starchess-core\/(?:src\/)?(?:resolve|rules|board|commands|scfen|ai)\//;
    const relativeDeep =
      /from ["'](?:\.\.\/)+packages\/starchess-core\/src\/(?:resolve|rules)\//;
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      if (file.includes(`${join("src", "__tests__")}`)) continue;
      const text = readFileSync(file, "utf8");
      for (const line of text.split("\n")) {
        if (!line.includes("import") && !line.includes("require")) continue;
        if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) continue;
        if (deep.test(line) || relativeDeep.test(line)) {
          offenders.push(`${file}: ${line.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("live presentation never imports addScAction/endScTurn/beginScTurn (reducer/store only)", () => {
    // SPEC: _spec/apps/starchess/core/turn/match-state-machine.puml
    // Demos/tests/reviewHistory builders may call engine offline.
    const allow = [
      `${join("src", "app", "matchReducer.ts")}`,
      `${join("src", "app", "reviewHistory.ts")}`,
      `${join("src", "demos")}`,
      `${join("src", "__tests__")}`,
      `${join("src", "stories")}`,
    ];
    const engineWrite =
      /\b(?:addScAction|removeScAction|endScTurn|beginScTurn)\b/;
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      if (allow.some((a) => file.includes(a))) continue;
      // MatchStoreContext must not call beginScTurn (TURN_OPEN owns it).
      const text = readFileSync(file, "utf8");
      if (!engineWrite.test(text)) continue;
      for (const line of text.split("\n")) {
        const t = line.trim();
        if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) continue;
        if (t.includes("import") && engineWrite.test(t)) {
          // type-only imports ok; value imports of writers forbidden outside allow
          if (/\bimport\b/.test(t) && !/\btype\b/.test(t.split("{")[0] ?? "")) {
            offenders.push(`${file}: ${t}`);
          }
        } else if (
          engineWrite.test(t) &&
          !t.includes("SPEC") &&
          !t.includes("addScAction") && // comments about snap.gas
          !t.startsWith("*") &&
          !t.includes("`") &&
          (t.includes("beginScTurn(") ||
            t.includes("endScTurn(") ||
            t.includes("addScAction(") ||
            t.includes("removeScAction("))
        ) {
          offenders.push(`${file}: ${t}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
