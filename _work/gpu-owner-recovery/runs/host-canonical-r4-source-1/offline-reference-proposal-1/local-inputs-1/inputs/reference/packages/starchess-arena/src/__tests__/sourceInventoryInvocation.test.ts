// SPEC: _spec/packages/starchess-arena/invocation-effect-analysis.puml
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { collectSourceInventory } from "../challenge/sourceInventory";
import { invocationCases, type InvocationCase } from "./fixtures/invocationCases";

const temporary: string[] = [];
const CORE = "packages/starchess-core";
const ARENA = "packages/starchess-arena";
const TRAINING = "packages/starchess-training";
const put = (root: string, path: string, text: string): void => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};
const fixture = (text: string): string => {
  const root = mkdtempSync(join(realpathSync(tmpdir()), "source-inventory-invocation-"));
  temporary.push(root);
  put(root, "package.json", JSON.stringify({ private: true }));
  put(root, "pnpm-workspace.yaml", "packages: [packages/*]\n");
  put(root, "pnpm-lock.yaml", "lockfileVersion: '9.0'\n");
  for (const [owner, name, exports] of [
    [CORE, "@chess-coach/starchess-core", { ".": "./src/index.ts", "./planning-v1": "./src/planning-v1.ts" }],
    [ARENA, "@chess-coach/starchess-arena", { ".": "./src/index.ts", "./observations": "./src/observations.ts", "./events": "./src/events.ts", "./intent-codec-v1": "./src/intent-codec-v1.ts" }],
    [TRAINING, "@chess-coach/starchess-training", { "./candidates": "./src/candidates.ts" }],
  ] as const) {
    put(root, `${owner}/package.json`, JSON.stringify({ name, exports }));
    put(root, `${owner}/tsconfig.json`, "{}");
    for (const target of Object.values(exports)) put(root, `${owner}/${target.slice(2)}`, "export {};\n");
  }
  for (const path of [`${ARENA}/src/cli/challenge.ts`, `${ARENA}/src/challenge/worker.ts`, "scripts/challenge-contract-evidence.ts", `${ARENA}/hermetic/run.mjs`, `${ARENA}/hermetic/runtime.mjs`]) put(root, path, "export {};\n");
  put(root, `${ARENA}/hermetic/pins.json`, "{}");
  put(root, `${TRAINING}/src/candidates.ts`, text);
  return root;
};
afterEach(() => { for (const root of temporary.splice(0)) rmSync(root, { recursive: true, force: true }); });

const probe = (effect: string): string => `
  const data = {key: 1}; const other = {key: 1}; const values = [0, 1];
  function consume(value: unknown): void { void value; }
  ${effect}
  consume(values[data.key]); consume(values[other.key]);
`;
const extraCases: readonly InvocationCase[] = [
  { name: "unresolved key cannot acquire a literal-array constructor", expected: "reject", source: "const values = [0, 1]; const key: string = externalKey; function consume(value: unknown) { void value; } consume(values[key]);" },
  { name: "unseeded callable cycle rejects", expected: "reject", source: "function loop(callback: () => void) { loop(callback); callback(); }" },
  { name: "unknown callable seed rejects", expected: "reject", source: "function run(callback: () => void) { callback(); } run(unknownCallback);" },
  { name: "missing callback input rejects", expected: "reject", source: "function run(callback: () => void) { callback(); } run();" },
  ...[false, true].map(reverse => ({
    name: `mixed grounded and unknown inputs ${reverse ? "reverse" : "forward"}`,
    expected: "reject" as const,
    source: `function read() {} function run(callback: () => void) { callback(); } ${reverse ? "run(unknownCallback); run(read);" : "run(read); run(unknownCallback);"}`,
  })),
  ...["call", "apply", "reflect", "bind"].map(shape => ({
    name: `${shape} incoming writer retains its actual input`, expected: "reject" as const,
    source: probe(`function write(bag: {key: number | string}) { bag.key = "constructor"; }
      function run(callback: typeof write, bag: {key: number | string}) { callback(bag); }
      ${shape === "call" ? "run.call(null, write, data);" : shape === "apply" ? "run.apply(null, [write, data]);" : shape === "reflect" ? "Reflect.apply(run, null, [write, data]);" : "run.bind(null, write, data)();"}`),
  })),
  { name: "growing recursive bind vectors reject", expected: "reject", source: "function read() {} function loop(callback: () => void) { loop(callback.bind(null, 1)); callback(); } loop(read);" },
  ...[false, true].map(reverse => ({
    name: `correlated conditional callback and bag ${reverse ? "reverse" : "forward"}`,
    expected: "reject" as const,
    source: probe(`function write(bag: {key: number | string}) { bag.key = "constructor"; }
      function run(callback: typeof write, bag: {key: number | string}) { callback(bag); }
      const input = flag ? {callback: write, bag: ${reverse ? "data" : "{key: 0}"}} : {callback: write, bag: ${reverse ? "{key: 0}" : "data"}};
      run(input.callback, input.bag);`),
  })),
  ...["call", "apply", "reflect"].map(shape => ({
    name: `unknown callback through ${shape} rejects`, expected: "reject" as const,
    source: `function run(callback: () => void) { ${shape === "call" ? "callback.call(null);" : shape === "apply" ? "callback.apply(null, []);" : "Reflect.apply(callback, null, []);"} } run(unknownCallback);`,
  })),
  { name: "exported caller does not close from one local seed", expected: "reject", source: "function read() {} export function run(callback: () => void) { callback(); } run(read);" },
  { name: "reassigned apply callee retains its captured default", expected: "reject", source: probe('function write(bag = data) { bag.key = "constructor" as any; } let invoke: any = 0; invoke = write; invoke.apply(null, []);') },
  { name: "acyclic wrapper composition above sixteen rejects", expected: "reject", source: `function read() {} ${Array.from({length: 18}, (_, i) => `const bound${i} = ${i ? `bound${i - 1}` : "read"}.bind(null);`).join("\n")} bound17();` },
  { name: "spread composition above sixteen rejects", expected: "reject", source: `function read(...values: unknown[]) {} read(...${"[...".repeat(17)}[1]${"]".repeat(17)});` },
  { name: "late forwarded callable assignment invalidates positive cache", expected: "reject", source: probe(`
    function read(bag: {key: number | string}) { void bag.key; }
    function write(bag: {key: number | string}) { bag.key = "constructor"; }
    function replace(box: {callback: typeof read}) { box.callback = write; }
    function relay(box: {callback: typeof read}) { replace(box); }
    function run(callback: typeof read, bag: {key: number | string}) { callback(bag); }
    const box = {callback: read}; run(box.callback, data); relay(box); run(box.callback, other);
  `) },
  ...[false, true].flatMap(reverse => ["data", "other"].map(bag => ({
    name: `bound and unbound effects reach ${bag} ${reverse ? "reverse" : "forward"}`,
    expected: "reject" as const,
    source: `const data = {key: 1}; const other = {key: 1}; const values = [0, 1];
      function consume(value: unknown) { void value; }
      function write(bag: {key: number | string}) { bag.key = "constructor"; }
      function run(callback: (bag: {key: number | string}) => void, bag: {key: number | string}) { callback(bag); }
      ${reverse ? "run(write, other); run(write.bind(null, data), other);" : "run(write.bind(null, data), other); run(write, other);"}
      consume(values[${bag}.key]);`,
  }))),
];

describe("actual source inventory finite invocation resolution", () => {
  it("audits a complete minimal graph with the exact workspace exports", () => {
    const result = collectSourceInventory(fixture("export {};"));
    expect(result.audit.passed).toBe(true);
    expect(result.entrypoints).toContain(`${TRAINING}/src/candidates.ts`);
    expect(result.audit.auditedFiles).toContain(`${TRAINING}/src/candidates.ts`);
  });
  it("rejects argument-ID resource exhaustion rather than truncating vectors", () => {
    const vector = Array.from({length: 1024}, () => "1").join(",");
    const root = fixture(`function read(...values: unknown[]) {} ${Array.from({length: 257}, () => `read(${vector});`).join("\n")}`);
    expect(() => collectSourceInventory(root)).toThrow(/Unsupported parameter mutation .* limit/);
  });
  it.each(extraCases.filter(test => test.name.startsWith("correlated conditional")))("observes the data-root effect: $name", ({source}) => {
    expect(collectSourceInventory(fixture(source.replaceAll('bag.key = "constructor";', "void bag.key;"))).audit.passed).toBe(true);
    expect(() => collectSourceInventory(fixture(source))).toThrow(/unproved array selector: values\[data.key\]/);
  });
  it.each([...invocationCases, ...extraCases])("$name", ({source, expected}) => {
    const root = fixture(source);
    if (expected === "pass") expect(collectSourceInventory(root).audit.passed).toBe(true);
    else expect(() => collectSourceInventory(root)).toThrow(/Unsupported (?:parameter mutation|code constructor acquisition)/);
  });
  it.each(invocationCases.filter(test => test.controlSource !== undefined))("read-only control: $name", ({controlSource}) => {
    expect(collectSourceInventory(fixture(controlSource!)).audit.passed).toBe(true);
  });
});
