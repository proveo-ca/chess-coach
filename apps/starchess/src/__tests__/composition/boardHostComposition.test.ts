import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(import.meta.dirname, "../..");

const HOSTS = ["app/BaseScreen.tsx", "demos/ReviewDemoScreen.tsx", "demos/TutorialReviewHost.tsx"];

const PARTS = [
  "<MatchBoardHost>",
  "<MatchBoardHost.BoardColumn>",
  "<MatchBoardHost.BoardHost",
  "<LiveBoardBinding",
  "<MatchBoardHost.Rail",
];

describe("MatchBoardHost compound composition", () => {
  it.each(HOSTS)("%s composes the full board row itself", (file) => {
    const src = readFileSync(join(SRC, file), "utf8");
    const at = PARTS.map((part) => src.indexOf(part));
    for (const [i, part] of PARTS.entries()) expect(at[i], `${file} lacks ${part}`).toBeGreaterThan(-1);
    const column = at.slice(0, 4);
    expect(column, `${file}: Root → BoardColumn → BoardHost → LiveBoardBinding order`).toEqual(
      [...column].sort((a, b) => a - b),
    );
  });

  it("MatchBoardHost keeps no slot props", () => {
    const src = readFileSync(join(SRC, "presentation/hud/components/MatchBoardHost.tsx"), "utf8");
    expect(src).not.toMatch(/\b(board|overlay|rail|header|footer)\??:\s*JSX\.Element/);
  });
});
