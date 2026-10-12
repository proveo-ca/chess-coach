// SPEC: _spec/packages/starchess-arena/invocation-effect-analysis.puml
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { invocationCases } from "./fixtures/invocationCases";

const require = createRequire(import.meta.url);
const { checkPublicClosure } = require("../../hermetic/public-closure.mjs") as {
  checkPublicClosure(root?: string): {
    passed: boolean;
    entries: { package: string; subpath: string; path: string }[];
    dependencyFiles: { path: string }[];
    verifiedPaths: string[];
  };
};
const roots: string[] = [];
const put = (root: string, path: string, text: string): void => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};
const fixture = (source: string): string => {
  const root = mkdtempSync(join(realpathSync(tmpdir()), "public-invocation-"));
  roots.push(root);
  put(root, "package.json", JSON.stringify({ private: true, type: "module" }));
  for (const [owner, name, exports, dependencies] of [
    ["starchess-core", "@chess-coach/starchess-core", { ".": "./src/index.ts", "./planning-v1": "./src/planning-v1.ts" }, {}],
    ["starchess-arena", "@chess-coach/starchess-arena", { ".": "./src/index.ts", "./intent-codec-v1": "./src/intent-codec-v1.ts", "./observations": "./src/observations.ts", "./events": "./src/events.ts" }, { "@chess-coach/starchess-core": "workspace:*", jssha: "3.3.2" }],
    ["starchess-training", "@chess-coach/starchess-training", { "./candidates": "./src/candidates.ts" }, { "@chess-coach/starchess-core": "workspace:*", "@chess-coach/starchess-arena": "workspace:*" }],
  ] as const) put(root, `packages/${owner}/package.json`, JSON.stringify({ name, type: "module", exports, dependencies }));
  put(root, "packages/starchess-core/src/planning-v1.ts", "export const planning = 1;");
  put(root, "packages/starchess-arena/src/observations.ts", 'export { planning } from "@chess-coach/starchess-core/planning-v1";');
  put(root, "packages/starchess-arena/src/intent-codec-v1.ts", 'import SHA from "jssha/sha256"; export { SHA };');
  put(root, "packages/starchess-arena/src/events.ts", source);
  put(root, "packages/starchess-training/src/candidates.ts", 'export { planning } from "@chess-coach/starchess-arena/observations";');
  put(root, "packages/starchess-arena/node_modules/jssha/package.json", JSON.stringify({ name: "jssha", version: "3.3.2", type: "module", exports: { "./sha256": "./dist/sha256.mjs" } }));
  put(root, "packages/starchess-arena/node_modules/jssha/dist/sha256.mjs", "export default class SHA {}");
  return root;
};
const probe = (effect: string, watched: readonly string[] = ["first", "second"]): string => `
  const first = { key: 1 };
  const second = { key: 1 };
  const values = [0, 1];
  function consume(value: unknown): void { void value; }
  ${effect}
  ${watched.map(name => `consume(values[${name}.key]);`).join(" ")}
`;
const expectWriterEffect = (source: string): void => {
  const control = source.replaceAll('bag.key = "constructor";', "void bag.key;");
  expect(control).not.toBe(source);
  expect(checkPublicClosure(fixture(control)).passed).toBe(true);
  expect(() => checkPublicClosure(fixture(source))).toThrow(/parameter mutation|Code constructor acquisition/);
};
const groundingFixture = (source: string, reader: string, reexport = 'export { read, rows } from "./canonical";'): string => {
  const root = fixture(source);
  put(root, "packages/starchess-arena/src/authorized/v1/canonical.ts", reader);
  put(root, "packages/starchess-arena/src/authorized/v1/types.ts", reexport);
  return root;
};
const guardedReader = `
  function stop(): never { throw new Error("invalid input"); }
  export function read(value: unknown): string {
    if (typeof value !== "string") return stop();
    return value;
  }
  export function rows(value: unknown): {key: string}[] {
    if (!Array.isArray(value)) return stop();
    const result: {key: string}[] = [];
    for (const entry of value) result.push({key: read(entry)});
    return result;
  }
`;

afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true }); });

describe("independent finite public-closure invocation analysis", () => {
  it("audits the five actual model roots and the exact SHA dependency target", () => {
    const report = checkPublicClosure(fixture("export const event = 1;"));
    expect(report.passed).toBe(true);
    expect(report.entries.map(entry => [entry.package, entry.subpath])).toEqual([
      ["@chess-coach/starchess-core", "./planning-v1"],
      ["@chess-coach/starchess-arena", "./observations"],
      ["@chess-coach/starchess-arena", "./intent-codec-v1"],
      ["@chess-coach/starchess-arena", "./events"],
      ["@chess-coach/starchess-training", "./candidates"],
    ]);
    expect(report.dependencyFiles.map(file => file.path)).toEqual(["jssha@3.3.2/dist/sha256.mjs", "jssha@3.3.2/package.json"]);
  });

  it.each(invocationCases)("$name", ({ source, expected, controlSource }) => {
    if (controlSource !== undefined) expect(checkPublicClosure(fixture(controlSource)).passed).toBe(true);
    const root = fixture(source);
    if (expected === "pass") expect(checkPublicClosure(root).passed).toBe(true);
    else expect(() => checkPublicClosure(root)).toThrow(/parameter mutation|Code constructor acquisition/);
  });

  it.each([false, true].flatMap(reverse => ["first", "second"].map(watched => ({ reverse, watched }))))("preserves ordered bound vectors, reverse=$reverse, observed=$watched", ({ reverse, watched }) => {
    const calls = ["run(write.bind(null, first, second));", "run(write.bind(null, second, first));"];
    const source = probe(`
      function write(unused: object, bag: {key: number | string}): void { bag.key = "constructor"; }
      function run(callback: () => void): void { callback(); }
      ${reverse ? calls.reverse().join(" ") : calls.join(" ")}
    `, [watched]);
    expectWriterEffect(source);
  });

  it("does not execute a writer while only constructing an uninvoked binding", () => {
    const source = probe(`
      function write(bag: {key: number | string}): void { bag.key = "constructor"; }
      const bound = write.bind(null, first); void bound;
    `, ["first"]);
    expect(checkPublicClosure(fixture(source)).passed).toBe(true);
    const invoked = source.replace("void bound;", "bound();");
    expect(() => checkPublicClosure(fixture(invoked))).toThrow(/parameter mutation|Code constructor acquisition/);
  });

  it.each([
    "run.call(null, write, first);",
    "run.apply(null, [write, first]);",
    "Reflect.apply(run, null, [write, first]);",
    "const bound = run.bind(null, write, first); bound();",
  ])("enumerates non-direct incoming calls: %s", call => {
    const source = probe(`
      function write(bag: {key: number | string}): void { bag.key = "constructor"; }
      function run(callback: typeof write, bag: {key: number | string}): void { callback(bag); }
      ${call}
    `);
    expectWriterEffect(source);
  });

  it("rejects an unknown argument vector instead of treating it as empty", () => {
    const source = probe(`
      function write(bag = first): void { bag.key = "constructor"; }
      function run(callback: typeof write, args: unknown[]): void { callback.apply(null, args); }
      run(write, JSON.parse("[]"));
    `);
    const control = source.replace('bag.key = "constructor";', "void bag.key;").replace('JSON.parse("[]")', "[]");
    expect(checkPublicClosure(fixture(control)).passed).toBe(true);
    expect(() => checkPublicClosure(fixture(source))).toThrow(/parameter mutation|Code constructor acquisition/);
  });

  it("does not prove an unseeded callback cycle", () => {
    const source = `
      function writer(bag: object): void { (bag as {key: number}).key = 2; }
      function run(callback: typeof writer, bag: object): void { run(callback, bag); callback(bag); }
    `;
    const control = source.replace('(bag as {key: number}).key = 2;', "void bag;") + "run(writer, {});";
    expect(checkPublicClosure(fixture(control)).passed).toBe(true);
    expect(() => checkPublicClosure(fixture(source))).toThrow(/parameter mutation|Code constructor acquisition/);
  });

  it("retains unknown alternatives beside a grounded writer", () => {
    const source = probe(`
      function write(bag: {key: number | string}): void { bag.key = "constructor"; }
      function run(callback: typeof write, bag: {key: number | string}): void { callback(bag); }
      const unknown = JSON.parse("null"); run(true ? write : unknown, first);
    `);
    const control = source.replace('bag.key = "constructor";', "void bag.key;").replace("true ? write : unknown", "write");
    expect(checkPublicClosure(fixture(control)).passed).toBe(true);
    expect(() => checkPublicClosure(fixture(source))).toThrow(/parameter mutation|Code constructor acquisition/);
  });

  it("does not filter a second writer behind an expected harmless callback", () => {
    const source = probe(`
      function safe(bag: {key: number | string}): void { void bag; }
      function write(bag: {key: number | string}): void { bag.key = "constructor"; }
      function run(callback: typeof write, bag: {key: number | string}): void { callback(bag); }
      run(true ? safe : write, first);
    `);
    expectWriterEffect(source);
  });

  it("retains callback binding-element defaults", () => {
    const source = probe(`
      function write({bag = first}: {bag?: {key: number | string}}): void { bag.key = "constructor"; }
      function run(callback: typeof write): void { callback({}); }
      run(write);
    `);
    expectWriterEffect(source);
  });

  it.each([16, 17])("keeps the existing structural wrapper limit at depth %s", depth => {
    const root = fixture(`function noop(): void {} noop${".call".repeat(depth)}(null);`);
    if (depth === 16) expect(checkPublicClosure(root).passed).toBe(true);
    else expect(() => checkPublicClosure(root)).toThrow("parameter mutation wrapper");
  });

  it.each([16, 17])("keeps the existing literal spread limit at depth %s", depth => {
    let args = "[]";
    for (let index = 1; index < depth; index++) args = `[...${args}]`;
    const root = fixture(`function write(bag = {key: 0}): void { bag.key = 2; } write(...${args});`);
    if (depth === 16) expect(checkPublicClosure(root).passed).toBe(true);
    else expect(() => checkPublicClosure(root)).toThrow(/parameter mutation (wrapper|arguments)/);
  });

  it("rejects growing bound prefixes across a semantic parameter cycle", () => {
    const source = `
      function write(bag: {key: number}): void { bag.key = 2; }
      function run(callback: typeof write): void { run(callback.bind(null, {key: 0})); callback({key: 1}); }
      run(write);
    `;
    expect(() => checkPublicClosure(fixture(source))).toThrow(/parameter mutation/);
  });

  it.each([2, 3])("charges incoming wrapper cost across the parameter edge plus %s local wrappers", local => {
    let receiver = "run";
    for (let index = 0; index < 7; index++) receiver += `.bind(null${index === 0 ? ", noop" : ""})`;
    const source = `function noop(): void {} function run(callback: typeof noop): void { callback${".call".repeat(local)}(null); } ${receiver}();`;
    if (local === 2) expect(checkPublicClosure(fixture(source)).passed).toBe(true);
    else expect(() => checkPublicClosure(fixture(source))).toThrow(/parameter mutation wrapper/);
  });

  it("retains the ordinary public string-comparator callback", () => {
    const source = `const rows = [{key: "b"}, {key: "a"}]; rows.sort((left, right) => left.key.localeCompare(right.key));`;
    expect(checkPublicClosure(fixture(source)).passed).toBe(true);
  });

  it.each([
    'const values = [0, 1]; const key: string = "constructor"; consume(values[key]);',
    'const values = [0, 1]; const alias = values; const key: string = unknownFactory(); consume(alias[key]);',
    'const values = [[0, 1]]; const key: string = unknownFactory(); consume(values[0][key]);',
    'const holder = {values: [0, 1]}; const key: string = unknownFactory(); consume(holder.values[key]);',
    'const values = true ? [0, 1] : [2, 3]; const key: string = unknownFactory(); consume(values[key]);',
    'const values = true ? [0, 1] : (() => 0); const key: string = unknownFactory(); consume(values[key]);',
    'const values = [0, 1]; consume(values["toString"]);',
    'const values = [0, 1]; const key: string = unknownFactory(); consume(values[key] === undefined);',
  ])("rejects inherited literal-array acquisition without a scalar-context shortcut: %s", source => {
    const prefix = "function consume(value: unknown): void { void value; }";
    expect(checkPublicClosure(fixture(prefix + "const values = [0, 1]; const key = 1; consume(values[key]);")).passed).toBe(true);
    expect(() => checkPublicClosure(fixture(prefix + source))).toThrow(/Code constructor acquisition/);
  });

  it.each(["0", '"0"', '"length"', "1 + 0"])('retains numeric or own-length literal-array selectors: %s', key => {
    expect(checkPublicClosure(fixture(`function consume(value: unknown): void { void value; } const values = [0, 1]; consume(values[${key}]);`)).passed).toBe(true);
  });

  it.each([
    'const values = () => 0; consume(values[0]);',
    'const values = () => 0; const alias = values; consume(alias[0]);',
  ])("retains the original unsafe-receiver guard even for a numeric selector: %s", source => {
    expect(() => checkPublicClosure(fixture("function consume(value: unknown): void { void value; }" + source))).toThrow(/Code constructor acquisition/);
  });

  it.each([
    "const values = true ? [0, 1] : (() => 0);",
    "function callback(): number { return 0; } const values = true ? [0, 1] : callback;",
    "class Local {} const values = true ? [0, 1] : Local;",
  ])("rejects a callable receiver alternative alongside a literal array: %s", alternative => {
    const prefix = "function consume(value: unknown): void { void value; }";
    expect(checkPublicClosure(fixture(prefix + "const values = [0, 1]; consume(values[0]);")).passed).toBe(true);
    expect(() => checkPublicClosure(fixture(prefix + alternative + "consume(values[0]);"))).toThrow(/Code constructor acquisition/);
  });

  it.each(["void values[key];", "values[key];", "(values[key], 0);"])('preserves discarded computed-array reads: %s', expression => {
    expect(checkPublicClosure(fixture(`const values = [0, 1]; const key: string = unknownFactory(); ${expression}`)).passed).toBe(true);
  });

  it("always rejects a known constructor even when discarded", () => {
    expect(() => checkPublicClosure(fixture('const values = [0, 1]; void values["constructor"];'))).toThrow(/Code constructor acquisition/);
  });

  it("does not reuse a safe result from an earlier root or mutation epoch", () => {
    const root = fixture(probe("function safe(bag: object): void {} safe(first);"));
    expect(checkPublicClosure(root).passed).toBe(true);
    const source = probe(`
      function safe(bag: object): void {}
      function write(bag: {key: number | string}): void { bag.key = "constructor"; }
      const holder = {callback: safe};
      function replace(value: typeof holder): void { value.callback = write; }
      replace(holder); holder.callback(first);
    `);
    expectWriterEffect(source);
    put(root, "packages/starchess-arena/src/events.ts", source);
    expect(() => checkPublicClosure(root)).toThrow(/parameter mutation|Code constructor acquisition/);
  });

  describe("source-derived callback grounding", () => {
    const importedComparator = `
      import { rows } from "./authorized/v1/types";
      const result = rows(unknownFactory());
      result.sort((left, right) => left.key.localeCompare(right.key));
    `;
    const importedPredicate = `
      import { rows } from "./authorized/v1/types";
      const result = rows(unknownFactory());
      const created = ["w:unit:created:1"];
      result.some(entry => entry.key.includes(":created:") && !created.includes(entry.key));
    `;

    it.each([importedComparator, importedPredicate])("grounds native callbacks from guarded runtime reexports: %s", source => {
      expect(checkPublicClosure(groundingFixture(source, guardedReader)).passed).toBe(true);
    });

    it("derives normal-return evidence from executable guards, not a reader name", () => {
      const renamed = guardedReader.replaceAll("read", "checkedText").replaceAll("stop", "raiseInputError");
      const root = groundingFixture(importedComparator, renamed, 'export { checkedText as read, rows } from "./canonical";');
      expect(checkPublicClosure(root).passed).toBe(true);
    });

    it.each([
      'export function read(value: unknown): string { return value as string; }',
      'export function read(value: unknown): string { if (typeof value === "string") return value; return value as string; }',
      'export function read(value: unknown): string { if (typeof value !== "string") stop(); return value as string; } function stop(): void {}',
      'export function read(value: unknown): string { try { if (typeof value !== "string") throw new Error("bad"); } catch {} return value as string; }',
      'export function read(value: unknown): string { if (typeof value !== "string") return stop() as string; return value; } function stop(): unknown { return unknownFactory(); }',
      'export function read(value: unknown): string { return ({ get key(): string { return value as string; } }).key; }',
    ])("rejects uncovered or forged primitive normal returns: %s", reader => {
      expect(checkPublicClosure(groundingFixture(importedComparator, guardedReader)).passed).toBe(true);
      const replacement = guardedReader.slice(guardedReader.indexOf("export function rows"));
      expect(() => checkPublicClosure(groundingFixture(importedComparator, reader + replacement))).toThrow(/parameter mutation|Code constructor acquisition/);
    });

    it("rejects a runtime reexport substituted with a type-only reader", () => {
      expect(checkPublicClosure(groundingFixture(importedComparator, guardedReader)).passed).toBe(true);
      const root = groundingFixture(importedComparator, guardedReader, `
        import type { read } from "./canonical";
        export function rows(value: unknown): {key: string}[] {
          return [{key: (read as (entry: unknown) => string)(value)}];
        }
      `);
      expect(() => checkPublicClosure(root)).toThrow(/parameter mutation|Code constructor acquisition|public closure/);
    });

    it("does not reuse a guarded reader after its physical definition changes", () => {
      const root = groundingFixture(importedComparator, guardedReader);
      expect(checkPublicClosure(root).passed).toBe(true);
      put(root, "packages/starchess-arena/src/authorized/v1/canonical.ts", guardedReader.replace(
        'if (typeof value !== "string") return stop();', "void value;",
      ));
      expect(() => checkPublicClosure(root)).toThrow(/parameter mutation|Code constructor acquisition/);
    });

    it("keeps distinct reader captures for the same returned callback body", () => {
      const reader = guardedReader + `
        export function factory(reader: (value: unknown) => string) {
          return (value: unknown): {key: string}[] => {
            if (!Array.isArray(value)) throw new Error("invalid array");
            const result: {key: string}[] = [];
            for (const entry of value) result.push({key: reader(entry)});
            return result;
          };
        }
        export const safeRows = factory(read);
        export const unsafeRows = factory(value => value as string);
      `;
      expect(checkPublicClosure(groundingFixture(importedComparator, reader, 'export { safeRows as rows } from "./canonical";')).passed).toBe(true);
      expect(() => checkPublicClosure(groundingFixture(importedComparator, reader, 'export { unsafeRows as rows } from "./canonical";'))).toThrow(/parameter mutation|Code constructor acquisition/);
    });

    it("does not ground a mixed receiver from only its verified imported recipe", () => {
      expect(checkPublicClosure(groundingFixture(importedComparator, guardedReader)).passed).toBe(true);
      const mixed = importedComparator.replace("rows(unknownFactory())", "true ? rows(unknownFactory()) : unknownFactory()");
      expect(() => checkPublicClosure(groundingFixture(mixed, guardedReader))).toThrow(/parameter mutation|Code constructor acquisition/);
    });

    it.each([false, true])("keeps parent array frames distinct regardless of call order, reverse=%s", reverse => {
      const body = `
        function order(rows: {key: string}[]): void { rows.sort((left, right) => left.key.localeCompare(right.key)); }
        const known = [{key: "a"}, {key: "b"}];
      `;
      expect(checkPublicClosure(fixture(body + "order(known);")).passed).toBe(true);
      const calls = ["order(known);", "order([{key: unknownFactory() as string}]);"];
      expect(() => checkPublicClosure(fixture(body + (reverse ? calls.reverse() : calls).join(" ")))).toThrow(/parameter mutation|Code constructor acquisition/);
    });

    it.each(["some", "every", "filter", "map", "flatMap"])("grounds readonly %s callbacks and preserves element-writer effects", method => {
      const source = probe(`
        const rows = [first, second];
        rows.${method}(entry => { const bag = entry; bag.key = "constructor"; return true; });
      `);
      expectWriterEffect(source);
    });

    it("retains both elements from the same sort receiver during writer propagation", () => {
      const source = probe(`
        const rows = [first, second];
        rows.sort((left, right) => { const bag = right; bag.key = "constructor"; return left.key - right.key; });
      `, ["first", "second"]);
      expectWriterEffect(source);
    });

    it("preserves a native predicate's supplied thisArg effects", () => {
      const source = probe(`
        const rows = ["x"];
        rows.some(function(): boolean { const bag = this as {key: number | string}; bag.key = "constructor"; return true; }, first);
      `, ["first"]);
      expectWriterEffect(source);
    });

    it("preserves a bound comparator's receiver effects", () => {
      const source = probe(`
        const rows = ["a", "b"];
        function compare(): number { const bag = this as {key: number | string}; bag.key = "constructor"; return 0; }
        rows.sort(compare.bind(first));
      `, ["first"]);
      expectWriterEffect(source);
    });

    it.each([
      'Array.prototype.some = () => false;',
      'String.prototype.includes = () => true;',
      'String.prototype.localeCompare = () => 0;',
    ])("rejects native-dispatch poisoning before callback grounding: %s", mutation => {
      expect(checkPublicClosure(groundingFixture(importedPredicate, guardedReader)).passed).toBe(true);
      expect(() => checkPublicClosure(groundingFixture(mutation + importedPredicate, guardedReader))).toThrow(/Code constructor acquisition/);
    });

    it.each([
      'const rows = {some(callback: (value: unknown) => unknown) { callback(unknownFactory()); }}; rows.some(value => (value as string).includes("x"));',
      'const rows = {get some() { return unknownFactory(); }}; rows.some((value: string) => value.includes("x"));',
      'const rows = true ? ["x"] : unknownFactory(); rows.some((value: string) => value.includes("x"));',
      'const rows = ["x"]; rows.some = unknownFactory(); rows.some(value => value.includes("x"));',
      'const rows = [{key: "x"}]; function replace(value: typeof rows): void { value[0] = unknownFactory(); } replace(rows); rows.some(value => value.key.includes("x"));',
    ])("rejects unclosed receivers, own dispatch and replaced element provenance: %s", source => {
      expect(checkPublicClosure(fixture('const rows = ["x"]; rows.some(value => value.includes("x"));')).passed).toBe(true);
      expect(() => checkPublicClosure(fixture(source))).toThrow(/parameter mutation|Code constructor acquisition/);
    });

    it.each([
      'const text = unknownFactory() as string; text.includes("x");',
      'const text = {includes() { return true; }}; text.includes("x");',
      'const text = true ? "x" : unknownFactory(); text.includes("x");',
      'const text = "x"; text.localeCompare(unknownFactory());',
      'const text = "x"; text.localeCompare("y", undefined, {get sensitivity() { return unknownFactory(); }});',
      'const text = "x"; text.includes({toString() { return unknownFactory(); }} as unknown as string);',
    ])("rejects unproved String dispatch or coercion: %s", source => {
      expect(checkPublicClosure(fixture('const text = "x"; text.includes("x"); text.localeCompare("y");')).passed).toBe(true);
      expect(() => checkPublicClosure(fixture(source))).toThrow(/parameter mutation|Code constructor acquisition/);
    });

    it("checks supplied callback arguments even for a known empty native array", () => {
      expect(checkPublicClosure(fixture('const rows: string[] = []; rows.some(value => value.includes("x"));')).passed).toBe(true);
      expect(() => checkPublicClosure(fixture('const rows: string[] = []; rows.some(value => value.includes("x"), Array.prototype);'))).toThrow(/Code constructor acquisition/);
    });
  });
});
