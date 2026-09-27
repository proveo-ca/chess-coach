import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const APP = join(import.meta.dirname, "../../..");
const OXLINT = join(APP, "node_modules/.bin/oxlint");
const PLUGIN = join(APP, "lint/architecture.ts");

const FLAGGED: Record<string, string> = {
  bare: "setTimeout(() => {}, 1);",
  clear: "clearInterval(1);",
  windowMember: "window.setTimeout(() => {}, 1);",
  globalThisMember: "globalThis.setInterval(() => {}, 1);",
  computed: 'window["setTimeout"](() => {}, 1);',
  nestedHost: "globalThis.window.setTimeout(() => {}, 1);",
  defaultView: "document.defaultView?.setTimeout(() => {}, 1);",
  alias: "const t = setTimeout; t(() => {}, 1);",
  destructure: "const { setTimeout: st } = window; st(() => {}, 1);",
  destructureShorthand: "const { clearTimeout } = globalThis; clearTimeout(1);",
  reflect: 'Reflect.get(window, "setTimeout");',
  typeQuery: "let id: ReturnType<typeof setTimeout>;",
};

const CLEAN: Record<string, string> = {
  shadowedParam: "export const f = (clearTimeout: () => void) => clearTimeout();",
  shadowedLocal: "const setTimeout = (fn: () => void) => fn(); setTimeout(() => {});",
  objectKey: "export const o = { setTimeout: 1 };",
  classField: "export class C { setInterval = 1; clearTimeout() {} }",
  interfaceMember: "export interface I { setTimeout: number; clearInterval(): void }",
  otherMember: "declare const clock: { setTimeout(): void }; clock.setTimeout();",
  shadowedHost: "const window = { setTimeout: () => {} }; window.setTimeout();",
  raf: "requestAnimationFrame(() => {}); queueMicrotask(() => {});",
};

let root = "";

const lint = (files: Record<string, string>): Map<string, number> => {
  let out = "";
  try {
    out = execFileSync(OXLINT, ["-c", join(root, "oxlint.json"), "-f", "json", ...Object.keys(files)], {
      cwd: root,
      encoding: "utf8",
    });
  } catch (e) {
    out = (e as { stdout: string }).stdout;
  }
  const counts = new Map<string, number>(Object.keys(files).map((f) => [f, 0]));
  for (const d of JSON.parse(out).diagnostics as { code: string; filename: string }[]) {
    if (!d.code.includes("no-raw-timer")) continue;
    const file = Object.keys(files).find((f) => d.filename.endsWith(f));
    if (file) counts.set(file, (counts.get(file) ?? 0) + 1);
  }
  return counts;
};

const write = (cases: Record<string, string>, dir: string) =>
  Object.fromEntries(
    Object.entries(cases).map(([name, code]) => {
      const rel = `${dir}/${name}.ts`;
      mkdirSync(dirname(join(root, rel)), { recursive: true });
      writeFileSync(join(root, rel), code);
      return [rel, code];
    }),
  );

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "no-raw-timer-"));
  writeFileSync(
    join(root, "oxlint.json"),
    JSON.stringify({ jsPlugins: [PLUGIN], rules: { "proveo-starchess/no-raw-timer": "error" } }),
  );
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("proveo-starchess/no-raw-timer", () => {
  it("flags every raw-timer spelling in app source", () => {
    const counts = lint(write(FLAGGED, "src/app"));
    for (const [file, n] of counts) expect(n, file).toBeGreaterThan(0);
  });

  it("does not flag locals, keys, members of other objects, or frame hooks", () => {
    const counts = lint(write(CLEAN, "src/app"));
    for (const [file, n] of counts) expect(n, file).toBe(0);
  });

  it("exempts the browser adapter and test code", () => {
    const counts = lint({
      ...write({ index: FLAGGED.bare }, "src/adapters/browser"),
      ...write({ helper: FLAGGED.bare }, "src/__tests__/fixtures"),
      ...write({ "x.test": FLAGGED.bare }, "src/app"),
    });
    for (const [file, n] of counts) expect(n, file).toBe(0);
  });
});
