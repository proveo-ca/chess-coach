import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const APP = join(import.meta.dirname, "../../..");

describe("first paint", () => {
  const html = readFileSync(join(APP, "index.html"), "utf8");
  const head = html.slice(0, html.indexOf("</head>"));

  it("paints html and body black before any stylesheet or script loads", () => {
    expect(head).toMatch(/<meta name="color-scheme" content="dark"\s*\/?>/);
    const inline = head.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
    expect(inline).toMatch(/html,\s*body\s*\{[^}]*background:\s*#000\b/);
    expect(head.indexOf("<style>")).toBeLessThan(head.indexOf("<script") === -1 ? Infinity : head.indexOf("<script"));
  });

  it("the installed PWA splash is black too", () => {
    const config = readFileSync(join(APP, "vite.config.ts"), "utf8");
    expect(config).toMatch(/background_color:\s*"#000000"/);
  });
});
