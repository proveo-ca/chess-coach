// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
/**
 * Storybook is a projection, not a source. These guards make that structural
 * rather than aspirational — the previous arrangement had `/single` reading its
 * opening position out of `src/stories/fixtures/`.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";

import { TUTORIAL_SCRIPT } from "~/tutorial/tutorialScript";

const SRC = join(import.meta.dirname, "../..");

const walk = (dir: string): string[] => {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if ([".ts", ".tsx"].includes(extname(p))) out.push(p);
  }
  return out;
};

const isStory = (file: string) => /\.stories\.tsx?$/.test(file);

describe("Storybook projection", () => {
  it("no non-story source imports from ~/stories/", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      if (isStory(file)) continue;
      for (const line of readFileSync(file, "utf8").split("\n")) {
        if (!line.includes("import")) continue;
        if (line.trimStart().startsWith("*")) continue;
        if (/from ["']~\/stories\//.test(line)) {
          offenders.push(`${file.slice(SRC.length + 1)}: ${line.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("stories declare no board content of their own", () => {
    // An SCFEN literal in a story means the catalog was bypassed.
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      if (!isStory(file)) continue;
      for (const [i, line] of readFileSync(file, "utf8").split("\n").entries()) {
        if (/["'`]SCFEN\|/.test(line)) {
          offenders.push(`${file.slice(SRC.length + 1)}:${i + 1}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("every live lesson is reachable from a story file", () => {
    const storyText = walk(SRC)
      .filter(isStory)
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");

    const missing: string[] = [];
    for (const stage of TUTORIAL_SCRIPT) {
      for (const story of stage.stories) {
        if (!story.board) continue;
        // `lessonStory("fog", "king")` — projected by section + id.
        const projected = new RegExp(
          `["']${stage.id}["']\\s*,\\s*["']${story.id}["']`,
        ).test(storyText);
        if (!projected) missing.push(`${stage.id}/${story.id}`);
      }
    }
    // King lessons ship inside `/tutorial` only; they need no standalone story.
    expect(missing).toEqual([
      "king/king-defense",
      "king/king-defense-2",
      "king/king-defense-3",
      "king/king-defense-4",
      "king/king-defense-5",
      "king/king-defense-6",
      "king/king-attack-1",
      "king/king-attack-2",
    ]);
  });
});
