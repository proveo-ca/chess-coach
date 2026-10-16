// SPEC: _spec/packages/starchess-arena/invocation-effect-analysis.puml
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { collectSourceInventory } from "../challenge/sourceInventory";
import { createRequire } from "node:module";

const { checkPublicClosure } = createRequire(import.meta.url)("../../hermetic/public-closure.mjs") as {
  checkPublicClosure(root: string): { passed: boolean };
};

const temporary: string[] = [];
const fixture = (text: string): string => {
  const root = mkdtempSync(join(realpathSync(tmpdir()), "computed-array-acquisition-"));
  temporary.push(root);
  const put = (path: string, value: string): void => { const file = join(root, path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, value); };
  put("package.json", '{"private":true}');
  put("pnpm-workspace.yaml", "packages: [packages/*]\n");
  put("pnpm-lock.yaml", "lockfileVersion: '9.0'\n");
  for (const [owner, name, exports] of [
    ["starchess-core", "@chess-coach/starchess-core", { ".": "./src/index.ts", "./planning-v1": "./src/planning-v1.ts" }],
    ["starchess-arena", "@chess-coach/starchess-arena", { ".": "./src/index.ts", "./observations": "./src/observations.ts", "./events": "./src/events.ts", "./intent-codec-v1": "./src/intent-codec-v1.ts" }],
    ["starchess-training", "@chess-coach/starchess-training", { "./candidates": "./src/candidates.ts" }],
  ] as const) {
    put(`packages/${owner}/package.json`, JSON.stringify({ name, exports }));
    put(`packages/${owner}/tsconfig.json`, "{}");
    for (const target of Object.values(exports)) put(`packages/${owner}/${target.slice(2)}`, "export {};\n");
  }
  for (const path of ["packages/starchess-arena/src/cli/challenge.ts", "packages/starchess-arena/src/challenge/worker.ts", "scripts/challenge-contract-evidence.ts",
    "packages/starchess-arena/hermetic/run.mjs", "packages/starchess-arena/hermetic/runtime.mjs"]) put(path, "export {};\n");
  put("packages/starchess-arena/hermetic/pins.json", "{}");
  put("packages/starchess-training/src/candidates.ts", `function consume(value: unknown): void { void value; }\n${text}`);
  return root;
};
afterEach(() => { for (const root of temporary.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe.each([
  ["source inventory", (root: string): boolean => collectSourceInventory(root).audit.passed],
  ["public closure", (root: string): boolean => checkPublicClosure(root).passed],
] as const)("independent literal-array selector evidence: %s", (_, audit) => {
  it.each([
    "const values = [0, 1]; consume(values[0]);",
    'const values = [0, 1]; consume(values["1"]);',
    "const values = [0, 1]; const index = 1; consume(values[index]);",
    'const values = [0, 1]; consume(values["length"]);',
    "const box = {values: [[0, 1]]}; const values = box.values[0]; consume(values[1]);",
    "const data = {key: 1}; const values = [0, 1]; function read(bag: {key: number}) { void bag.key; } read(data); consume(values[data.key]);",
    "const data: {key: number | string} = {key: 1}; const values = [0, 1]; function read(bag: {key: number | string}) { void bag.key; } read(data); consume(values[data.key]);",
    "const values: any = [0, 1]; void values[unknownKey];",
  ])("retains safe or discarded array observation: %s", source => {
    expect(audit(fixture(source))).toBe(true);
  });

  it.each([
    "const values = [0, 1]; const key: string = externalKey; consume(values[key]);",
    "const values = []; consume(values[unknownKey]);",
    'const values = [0, 1]; const key = "constructor"; consume(values[key]);',
    'const values = [0, 1]; consume(values["toString"]);',
    "const values = [0, 1]; consume(values[unknownKey] === 1);",
    "const box = {values: [[0, 1]]}; consume(box.values[unknownKey][0]);",
    "const values = condition ? [0, 1] : []; consume(values[unknownKey]);",
    'const data = {key: 1}; const values = [0, 1]; function write(bag: {key: number}) { (bag as any).key = "constructor"; } write(data); consume(values[data.key]);',
  ])("rejects inherited or unproved selector acquisition: %s", source => {
    expect(() => audit(fixture(source))).toThrow(/[Cc]ode constructor acquisition/);
  });
});
