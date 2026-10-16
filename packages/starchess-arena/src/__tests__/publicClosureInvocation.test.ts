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
const expectSemanticRejection = (check: () => unknown): Error => {
  let failure: unknown;
  expect(() => {
    try { check(); } catch (error) { failure = error; throw error; }
  }).toThrow(/parameter mutation|Code constructor acquisition/);
  expect(failure).toBeInstanceOf(Error);
  const error = failure as Error;
  expect(error.name).not.toMatch(/TypeError|SyntaxError|RangeError/);
  expect(error.message).not.toMatch(/analysis ceiling|Invalid closure syntax|parseDiagnostic|Maximum call stack|is not a function|Cannot (?:read|convert|set)/i);
  console.info(JSON.stringify({ publicClosureSemanticRefusal: { test: expect.getState().currentTestName, name: error.name, message: error.message } }));
  return error;
};
const recordSemanticRejection = (source: string): void => {
  const error = expectSemanticRejection(() => checkPublicClosure(fixture(source)));
  console.info(JSON.stringify({ publicClosurePolicyRefusal: { source, name: error.name, message: error.message } }));
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

  it("handles an absent apply vector without a parser or analyzer exception", () => {
    expect(checkPublicClosure(fixture('function noop(): void {} noop.apply(null);')).passed).toBe(true);
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

  describe("complete incoming and native-effect regressions", () => {
    it.each([false, true])("unions native and ordinary incoming frames, reverse=%s", reverse => {
      const calls = ['["x"].some(test);', "test(first);"];
      const source = probe(`
        function test(value: unknown): boolean {
          if (typeof value !== "string") { const bag = value as {key: number | string}; bag.key = "constructor"; }
          return true;
        }
        ${(reverse ? calls.reverse() : calls).join(" ")}
      `, ["first"]);
      expectWriterEffect(source);
    });

    it("retains unknown exported incoming beside native incoming", () => {
      const control = 'export function test(value: unknown): boolean { if (typeof value !== "string") throw new Error("invalid input"); return value.includes("x"); } ["x"].some(test);';
      expect(checkPublicClosure(fixture(control)).passed).toBe(true);
      const source = 'export function test(value: unknown): boolean { return (value as string).includes("x"); } ["x"].some(test);';
      expect(() => checkPublicClosure(fixture(source))).toThrow(/parameter mutation|Code constructor acquisition/);
    });

    it("resolves an invoked symbolic array element to its writer definition", () => {
      const source = probe(`
        function write(bag: {key: number | string}): void { bag.key = "constructor"; }
        const callbacks = [write]; callbacks.some(callback => { callback(first); return true; });
      `, ["first"]);
      expectWriterEffect(source);
    });

    it("rejects an unresolved invoked symbolic array element", () => {
      const control = 'const callbacks = [() => 0]; callbacks.some(callback => { callback(); return true; });';
      expect(checkPublicClosure(fixture(control)).passed).toBe(true);
      expect(() => checkPublicClosure(fixture('const callbacks = [unknownFactory()]; callbacks.some(callback => { callback(); return true; });')))
        .toThrow(/parameter mutation|Code constructor acquisition/);
    });

    it.each(["filter", "sort"].flatMap(method => [false, true].map(reverse => ({ method, reverse }))))
      ("retains every conditional receiver's writer effects, $method reverse=$reverse", ({ method, reverse }) => {
        const receivers = ["[]", "[first, second]"];
        const [left, right] = reverse ? receivers.reverse() : receivers;
        const source = probe(`
          const rows = true ? ${left} : ${right};
          rows.${method}(entry => { const bag = entry; bag.key = "constructor"; return 0; });
        `);
        expectWriterEffect(source);
      });

    it.each([
      'function write(bag = first): boolean { bag.key = "constructor"; return true; } const callbacks = [write.bind(null)]; callbacks.some(callback => callback());',
      'function write(...bags: {key: number | string}[]): boolean { for (const bag of bags) bag.key = "constructor"; return true; } [0].some(write.bind(null, first, second));',
      'function write({bag = first}: {bag?: {key: number | string}}): boolean { bag.key = "constructor"; return true; } [{}].some(write);',
      'function factory(bag: {key: number | string}) { return () => { bag.key = "constructor"; return true; }; } [0].some(factory(first));',
    ])("retains bound, default, rest and captured native inputs: %s", effect => {
      expectWriterEffect(probe(effect));
    });

    it.each([
      { name: "normal-function thisArg", effect: '[0].some(function() { const bag = this as {key: number | string}; bag.key = "constructor"; return true; }, first);' },
      { name: "arrow lexical this", effect: `
        function invoke(): void {
          [0].some(() => { const bag = this as {key: number | string}; bag.key = "constructor"; return true; }, second);
        }
        invoke.call(first);
      ` },
    ])("preserves $name instead of substituting the other receiver", ({ effect }) => {
      expectWriterEffect(probe(effect, ["first"]));
    });

    it.each([
      'const rows = ["x"]; rows.some = callback => { callback(first); return false; }; rows.some(value => { const bag = value as {key: number | string}; bag.key = "constructor"; return true; });',
      'const rows = {get some() { const bag = first; bag.key = "constructor"; return unknownFactory(); }}; rows.some(() => true);',
      'const text = "x"; text.localeCompare({toString() { const bag = first; bag.key = "constructor"; return "y"; }} as unknown as string);',
    ])("does not substitute a native model for own dispatch or coercion: %s", effect => {
      expect(checkPublicClosure(fixture(probe('["x"].some(value => value.includes("x"));'))).passed).toBe(true);
      expect(() => checkPublicClosure(fixture(probe(effect)))).toThrow(/parameter mutation|Code constructor acquisition/);
    });
  });

  describe("source-derived spread recipes", () => {
    it("retains a leading spread before a later literal on a cold query", () => {
      const body = 'const values = [0]; const part = ["constructor"]; const keys = [...part, 0]; consume(values[keys[0]]);';
      const prefix = 'function consume(value: unknown): void { void value; }';
      expect(checkPublicClosure(fixture(prefix + body.replace('["constructor"]', "[0]"))).passed).toBe(true);
      expect(() => checkPublicClosure(fixture(prefix + body))).toThrow(/parameter mutation|Code constructor acquisition/);
    });

    it("retains duplicate element positions in a returned spread", () => {
      const body = `
        function copy(input: string[]) { return [...input]; }
        const repeated = unknownFactory() as string;
        const result = copy([repeated, repeated, "x"]);
        result.some((entry, index, array) => array[1].includes("x"));
      `;
      expect(checkPublicClosure(fixture(body.replace("unknownFactory() as string", '"x"'))).passed).toBe(true);
      expect(() => checkPublicClosure(fixture(body))).toThrow(/parameter mutation|Code constructor acquisition/);
    });

    it("retains a fresh array with unknown elements without inventing element facts", () => {
      const source = 'const input = [unknownFactory()]; const result = [...input]; result.includes(0);';
      expect(checkPublicClosure(fixture(source)).passed).toBe(true);
      expect(() => checkPublicClosure(fixture(source.replace("result.includes(0)", 'result.some(value => (value as string).includes("x"))'))))
        .toThrow(/parameter mutation|Code constructor acquisition/);
    });

    it.each([false, true])("retains spread receiver alternatives in both orders, reverse=%s", reverse => {
      const body = 'function copy(input: string[]) { return [...input]; }';
      expect(checkPublicClosure(fixture(body + 'copy(true ? ["x"] : ["y"]).some(value => value.includes("x"));')).passed).toBe(true);
      const choices = reverse ? 'unknownFactory() : ["x"]' : '["x"] : unknownFactory()';
      expect(() => checkPublicClosure(fixture(body + `copy(true ? ${choices}).some(value => value.includes("x"));`)))
        .toThrow(/parameter mutation|Code constructor acquisition/);
    });

    it("retains shared object-element writer effects after copying the container", () => {
      expectWriterEffect(probe(`
        function copy(input: {key: number | string}[]) { return [...input]; }
        const result = copy([first, second]);
        result.some(entry => { const bag = entry; bag.key = "constructor"; return true; });
      `));
    });

    it.each([
      'input[Symbol.iterator] = unknownFactory();',
      'Object.defineProperty(input, Symbol.iterator, {get() { return unknownFactory(); }});',
      'Array.prototype[Symbol.iterator] = unknownFactory();',
    ])("does not erase iterator dispatch effects: %s", mutation => {
      const body = 'const input = ["x"];';
      const use = 'const result = [...input]; result.some(value => value.includes("x"));';
      expect(checkPublicClosure(fixture(body + use)).passed).toBe(true);
      expect(() => checkPublicClosure(fixture(body + mutation + use))).toThrow(/parameter mutation|Code constructor acquisition/);
    });
  });

  describe("source-derived callback grounding", () => {
    describe("post-pattern certificate regressions", () => {
      it.each([
        'export const exposed = {}; exposed.callback = inspect;',
        'export const exposed = {callback: safe}; exposed.callback = inspect;',
        'export const exposed = {get callback() { return inspect; }};',
        'export const exposed = {callback: safe, get reader() { return this.callback; }}; exposed.callback = inspect;',
      ])("retains callable exposure through updated fields and getters: %s", exposure => {
        const body = `function inspect(value: unknown) { return (value as string).includes("x"); }
          function safe(value: unknown) { void value; return true; }
          ${exposure} inspect("x");`;
        expect(checkPublicClosure(fixture(body.replace('return (value as string).includes("x");', 'if (typeof value !== "string") throw new Error("invalid"); return value.includes("x");'))).passed).toBe(true);
        expectSemanticRejection(() => checkPublicClosure(fixture(body)));
      });

      it("retains actual mutated array-like elements before Array.from callbacks", () => {
        const body = 'const input = {length: 1, 0: "x"}; input[0] = INPUT; Array.from(input).some(value => (value as string).includes("x"));';
        expect(checkPublicClosure(fixture(body.replace("INPUT", '"y"'))).passed).toBe(true);
        expectSemanticRejection(() => checkPublicClosure(fixture(body.replace("INPUT", "unknownFactory()"))));
      });

      it("does not re-evaluate a destructuring assignment result after binding writes", () => {
        const body = `function read() {
          let text: unknown = {text: "x", includes() { return true; }};
          return ({text} = text as {text: unknown});
        }`;
        expect(checkPublicClosure(fixture(body + 'function consume(value: unknown) { void value; } consume(read());')).passed).toBe(true);
        expectSemanticRejection(() => checkPublicClosure(fixture(body + '(read() as string).includes("x");')));
      });

      it("preserves the original RHS object as a destructuring expression result", () => {
        const body = `function read() {
          let text: unknown = {text: "x", includes() { return true; }};
          return ({text} = text as {text: unknown});
        }
        (read() as {text: string}).text.includes("x");`;
        expect(checkPublicClosure(fixture(body)).passed).toBe(true);
      });

      it("preserves argument uncertainty through bound apply forwarding", () => {
        const body = `function inspect(unused: unknown, value: unknown) { return (value as string).includes("x"); }
          const args = ["x", {includes() { return true; }}].filter(() => true) as [unknown, unknown];
          inspect.bind(null).apply(null, args);`;
        expect(checkPublicClosure(fixture(body.replace('{includes() { return true; }}', '"y"'))).passed).toBe(true);
        expectSemanticRejection(() => checkPublicClosure(fixture(body)));
      });

      it("preserves possible missing arguments across call and apply forwarding", () => {
        const body = `function read(value: unknown = {includes() { return true; }}) { return (value as string).includes("x"); }
          const args = ["receiver", "x"]; args.pop(); read.call.apply(null, args);`;
        expect(checkPublicClosure(fixture(body.replace('{includes() { return true; }}', '"y"'))).passed).toBe(true);
        expectSemanticRejection(() => checkPublicClosure(fixture(body)));
      });

      it("retains returned callable exposure through a summarized direct spread", () => {
        const body = `function inspect(value: unknown) { return (value as string).includes("x"); }
          function identity(value: typeof inspect) { return value; }
          const args = []; args.push(inspect); export const exposed = identity(...args); inspect("x");`;
        expect(checkPublicClosure(fixture(body.replace('return (value as string).includes("x");', 'if (typeof value !== "string") throw new Error("invalid"); return value.includes("x");'))).passed).toBe(true);
        expectSemanticRejection(() => checkPublicClosure(fixture(body)));
      });

      it("uses replaced own-field argument vectors for ordinary Reflect.apply", () => {
        const body = 'function poison(bag: {key: number}) { (bag as any).key = "changed"; } function probe(receiver: any, bag: {key: number}) { return receiver[bag.key]; } const data = {key: 0}; const decoy = {key: 0}; const args = [decoy]; const stored = {args}; stored.args = [data]; Reflect.apply(poison, null, stored.args); consume(probe(unknownFactory(), data));';
        expect(checkPublicClosure(fixture(body.replace('= "changed"', "= 0"))).passed).toBe(true);
        recordSemanticRejection(body);
      });

      it("does not expose a getter's callee when only its scalar return escapes", () => {
        const body = 'function inspect(value: unknown) { return (value as string).includes("x"); } export const exposed = {get result() { return inspect("x"); }};';
        expect(checkPublicClosure(fixture(body)).passed).toBe(true);
        expectSemanticRejection(() => checkPublicClosure(fixture(body.replace('return inspect("x")', "return inspect"))));
      });

      it.each([
        'unknownConsumer(data);',
        'const holder = {get value() { return data; }}; unknownConsumer(holder.value);',
        'unknownConsumer({nested: data});',
        'unknownConsumer([data]);',
        'unknownConsumer(() => data);',
        'unknownConsumer({get value() { return data; }});',
      ])
        ("retains unknown clobbers beside known numeric own fields: %s", effect => {
          const body = `const data = {key: 0}; ${effect} function consume(value: unknown) { void value; } consume([0][data.key]);`;
          expect(checkPublicClosure(fixture('function unknownConsumer(value: {key: number}) { value.key = 0; }' + body)).passed).toBe(true);
          expectSemanticRejection(() => checkPublicClosure(fixture(body)));
        });

      it("retains missing external arguments that select a captured default", () => {
        const body = 'const data = {key: 0}; export function poison(bag = data) { (bag as {key: unknown}).key = INPUT; } export function read() { return [0][data.key]; }';
        expect(checkPublicClosure(fixture(body.replace("INPUT", "0"))).passed).toBe(true);
        expectSemanticRejection(() => checkPublicClosure(fixture(body.replace("INPUT", '"constructor"'))));
      });

      it("retains spread values through native insertion without exposing scalar-only returns", () => {
        const body = 'function inspect(value: unknown) { return (value as string).includes("x"); } function identity(value: unknown) { return value; } const args = []; args.push(...[inspect].filter(() => true)); export const exposed = identity.apply(null, args); inspect("x");';
        expect(checkPublicClosure(fixture(body.replace('return (value as string).includes("x");', 'if (typeof value !== "string") throw new Error("invalid"); return value.includes("x");'))).passed).toBe(true);
        expect(checkPublicClosure(fixture(body.replace("return value;", "return true;"))).passed).toBe(true);
        expectSemanticRejection(() => checkPublicClosure(fixture(body)));
      });
    });

    describe("versioned allocation and graph exposure contracts", () => {
      it.each([false, true])("preserves nested renamed allocation aliases in both mutation directions, reverse=%s", reverse => {
        const body = `
          function identity({box: {rows: renamed}}: {box: {rows: unknown[]}}) { return renamed; }
          const original = ["x"], returned = identity({box: {rows: original}});
          ${reverse ? "original" : "returned"}.push(INPUT);
          ${reverse ? "returned" : "original"}.some(value => (value as string).includes("x"));
        `;
        expect(checkPublicClosure(fixture(body.replace("INPUT", '"y"'))).passed).toBe(true);
        expectSemanticRejection(() => checkPublicClosure(fixture(body.replace("INPUT", "unknownFactory()"))));
      });

      it.each([false, true])("keeps allocation instances and outer copies separate, reverse=%s", reverse => {
        const calls = ['const first = copy(["x"]);', 'const second = copy(["y"]);'];
        const body = `function copy(input: unknown[]) { return [...input]; } ${reverse ? calls.reverse().join(" ") : calls.join(" ")}
          const shallow = [...first]; shallow.push(unknownFactory());
          first.some(value => (value as string).includes("x")); second.some(value => (value as string).includes("y"));`;
        expect(checkPublicClosure(fixture(body)).passed).toBe(true);
        expectSemanticRejection(() => checkPublicClosure(fixture(body.replace("shallow.push", "first.push"))));
      });

      it.each([false, true])("separates equal-argument allocation calls at distinct sites, reverse=%s", reverse => {
        const calls = ['const first = copy(input);', 'const second = copy(input);'];
        const body = `function copy(value: unknown[]) { return [...value]; } const input = ["x"];
          ${reverse ? calls.reverse().join(" ") : calls.join(" ")}
          first.push(unknownFactory()); second.some(value => (value as string).includes("x"));`;
        expect(checkPublicClosure(fixture(body)).passed).toBe(true);
        expectSemanticRejection(() => checkPublicClosure(fixture(body.replace("second.some", "first.some"))));
      });

      it("separates zero-argument allocation calls at distinct sites", () => {
        const body = 'function create() { return ["x"]; } const first = create(), second = create(); first.push(unknownFactory()); second.some(value => value.includes("x"));';
        expect(checkPublicClosure(fixture(body)).passed).toBe(true);
        expectSemanticRejection(() => checkPublicClosure(fixture(body.replace("second.some", "first.some"))));
      });

      it.each([
        'const result = ["x"].map(inspect); export {result};',
        'function collect(input: unknown[]) { const result: unknown[] = []; for (const value of input) result.push(inspect(value)); return result; } export const result = collect(["x"]);',
        'function select(unused: unknown, value: unknown) { return inspect(value); } export const result = select.apply(null, [inspect, "x"]);',
      ])("does not expose a callable when only its scalar result escapes: %s", wrapper => {
        const body = `function inspect(value: unknown) { return (value as string).includes("x"); } ${wrapper}`;
        expect(checkPublicClosure(fixture(body)).passed).toBe(true);
        expectSemanticRejection(() => checkPublicClosure(fixture(body.replaceAll('["x"]', '[unknownFactory()]').replace('[inspect, "x"]', '[inspect, unknownFactory()]'))));
      });

      it.each([false, true])("retains duplicate ordered slots before a returned callable, summarized=%s", summarized => {
        const args = summarized ? 'const args = [safe, safe]; for (const value of [inspect].filter(() => true)) args.push(value);' : 'const args = [safe, safe, inspect];';
        const body = `function inspect(value: unknown) { return (value as string).includes("x"); }
          function safe() { return true; } function third(a: unknown, b: unknown, c: unknown) { return c; }
          ${args} export const exposed = third.apply(null, args); inspect("x");`;
        expect(checkPublicClosure(fixture(body.replace('return (value as string).includes("x");', 'if (typeof value !== "string") throw new Error("invalid"); return value.includes("x");'))).passed).toBe(true);
        expectSemanticRejection(() => checkPublicClosure(fixture(body)));
      });

      it.each(['text &&= INPUT;', 'if (text = INPUT) {}', '({text} = {text: INPUT});'])
        ("retains safe writes without changing their operator or syntax: %s", write => {
          const body = `function read() { let text: unknown = "x"; ${write} return text; } (read() as string).includes("x");`;
          expect(checkPublicClosure(fixture(body.replace("INPUT", '"y"'))).passed).toBe(true);
          expectSemanticRejection(() => checkPublicClosure(fixture(body.replace("INPUT", '{includes() { return true; }}'))));
        });

      it("preserves bound prefixes without exposing a bound scalar-only argument", () => {
        const body = 'function inspect(value: unknown) { return (value as string).includes("x"); } export const exposed = inspect.bind(null); inspect("x");';
        expect(checkPublicClosure(fixture(body.replace("inspect.bind(null)", 'inspect.bind(null, "x")'))).passed).toBe(true);
        expectSemanticRejection(() => checkPublicClosure(fixture(body)));
        expect(checkPublicClosure(fixture(body.replace('return (value as string).includes("x");', 'if (typeof value !== "string") throw new Error("invalid"); return value.includes("x");'))).passed).toBe(true);
      });

      it.each(["map", "from"])("uses the actual %s third-argument protocol", method => {
        const call = method === "map" ? '["x"].map(inspect);' : 'Array.from(["x"], inspect);';
        const body = `function inspect(value: string, index: number, array?: string[]) {
          if (Array.isArray(array)) return array[index].includes("x");
          return value.includes("x");
        } ${call}`;
        expect(checkPublicClosure(fixture(body)).passed).toBe(true);
        expectSemanticRejection(() => checkPublicClosure(fixture(body.replaceAll('["x"]', '[unknownFactory()]'))));
      });

      it.each([false, true])("retains sort's receiver allocation, reverse=%s", reverse => {
        const body = `const rows = ["x"], sorted = rows.sort(); ${reverse ? "rows" : "sorted"}.push(INPUT);
          ${reverse ? "sorted" : "rows"}.some(value => value.includes("x"));`;
        expect(checkPublicClosure(fixture(body.replace("INPUT", '"y"'))).passed).toBe(true);
        expectSemanticRejection(() => checkPublicClosure(fixture(body.replace("INPUT", "unknownFactory()"))));
      });

      it("copies finite Array.from elements without merging the outer allocation", () => {
        const body = 'const rows = ["x"], copy = Array.from(rows); copy.push(unknownFactory()); rows.some(value => value.includes("x"));';
        expect(checkPublicClosure(fixture(body)).passed).toBe(true);
        expect(checkPublicClosure(fixture(body.replace("unknownFactory()", '"y"').replace("rows.some", "copy.some"))).passed).toBe(true);
        expectSemanticRejection(() => checkPublicClosure(fixture(body.replace('rows.some', 'copy.some'))));
      });

      it("retains own array-like elements in Array.from exposure", () => {
        const body = 'function inspect(value: unknown) { return (value as string).includes("x"); } export const exposed = Array.from({length: 1, 0: inspect}); inspect("x");';
        expect(checkPublicClosure(fixture(body.replace('return (value as string).includes("x");', 'if (typeof value !== "string") throw new Error("invalid"); return value.includes("x");'))).passed).toBe(true);
        expectSemanticRejection(() => checkPublicClosure(fixture(body)));
      });

      it("retains possible callable elements without proving their numeric position", () => {
        const body = 'function inspect(value: unknown) { return (value as string).includes("x"); } const args = []; args.push(inspect); export const exposed = args[0]; inspect("x");';
        expect(checkPublicClosure(fixture(body.replace('return (value as string).includes("x");', 'if (typeof value !== "string") throw new Error("invalid"); return value.includes("x");'))).passed).toBe(true);
        expectSemanticRejection(() => checkPublicClosure(fixture(body)));
      });

      it("retains opaque escape incoming beside native incoming", () => {
        const body = 'function inspect(value: unknown) { return (value as string).includes("x"); } ["x"].some(inspect); unknownConsumer(inspect); inspect("x");';
        expect(checkPublicClosure(fixture(body.replace('return (value as string).includes("x");', 'if (typeof value !== "string") throw new Error("invalid"); return value.includes("x");'))).passed).toBe(true);
        expectSemanticRejection(() => checkPublicClosure(fixture(body)));
      });

      it("does not expose pushed arguments when only an actual scalar return escapes", () => {
        const body = 'function inspect(value: unknown) { return (value as string).includes("x"); } function select(value: unknown) { return true; } const args = []; args.push(inspect); export const result = select.apply(null, args); inspect("x");';
        expect(checkPublicClosure(fixture(body)).passed).toBe(true);
        expectSemanticRejection(() => checkPublicClosure(fixture(body.replace("return true;", "return value;"))));
      });
    });

    describe("adversarial allocation and exposure controls", () => {
      it.each(['[0].filter(() => false)', '"".split("x")'])
        ("retains zero iterations for a summarized source: %s", iterable => {
          const body = `
            function select() { let key: string | number = "constructor"; for (const n of ${iterable}) key = 0; return {key}; }
            function consume(value: unknown): void { void value; }
            const values = [0]; consume(values[select().key]);
          `;
          expect(checkPublicClosure(fixture(body.replace(iterable, "[0]"))).passed).toBe(true);
          expect(checkPublicClosure(fixture(body.replace('= "constructor"', "= 0"))).passed).toBe(true);
          expect(() => checkPublicClosure(fixture(body))).toThrow(/parameter mutation|Code constructor acquisition/);
        });

      it.each([
        'const rows = [...["x"]]; rows.push(INPUT); rows.some(value => value.includes("x"));',
        'function read() { const rows = ["x"]; const alias = rows; alias.push(INPUT); return rows; } read().some(value => value.includes("x"));',
        'function copy() { return [...["x"]]; } const rows = copy(); rows.push(INPUT); rows.some(value => value.includes("x"));',
        'function build() { const rows: unknown[] = []; const holder = {rows}; rows.push(INPUT); return holder.rows; } build().some(value => (value as string).includes("x"));',
        'const rows = ["x"].filter(() => true); rows.push(INPUT); rows.some(value => value.includes("x"));',
        'function build() { const rows = ["x"].map(value => value); rows.push(INPUT); return rows; } build().some(value => value.includes("x"));',
        'function identity(value: unknown[]) { return value; } const rows = identity(["x"]); rows.push(INPUT); rows.some(value => (value as string).includes("x"));',
        'function identity({rows}: {rows: unknown[]}) { return rows; } const rows = identity({rows: ["x"]}); rows.push(INPUT); rows.some(value => (value as string).includes("x"));',
        'function build() { let text: unknown = "x"; function replace() { text = INPUT; } replace(); return text; } (build() as string).includes("x");',
      ])("retains mutations of every allocation recipe: %s", body => {
        expect(checkPublicClosure(fixture(body.replace("INPUT", '"y"'))).passed).toBe(true);
        recordSemanticRejection(body.replace("INPUT", "unknownFactory()"));
      });

      it.each([false, true])("does not rebuild pristine initializer contents after Array.isArray, imported=%s", imported => {
        const body = `
          export function select() {
            const keys = [0]; keys.push(INPUT);
            if (!Array.isArray(keys)) throw new Error("invalid");
            let key: number | string = 0;
            for (const entry of keys) key = entry;
            return {key};
          }
        `;
        const use = 'function consume(value: unknown): void { void value; } const values = [0]; consume(values[select().key]);';
        const rootFor = (input: string): string => {
          if (!imported) return fixture(body.replace("INPUT", input) + use);
          const root = fixture('import {select} from "./authorized/v1/canonical";' + use);
          put(root, "packages/starchess-arena/src/authorized/v1/canonical.ts", body.replace("INPUT", input));
          return root;
        };
        expect(checkPublicClosure(rootFor("1")).passed).toBe(true);
        expect(() => checkPublicClosure(rootFor('"constructor"'))).toThrow(/parameter mutation|Code constructor acquisition/);
      });

      it.each([
        'function read() { let text: unknown = "x"; text &&= INPUT; return text; } (read() as string).includes("x");',
        'function read() { let text: unknown = "x"; ({text} = {text: INPUT}); return text; } (read() as string).includes("x");',
        'function read() { let text: unknown = "x"; if (text = INPUT) {} return text; } (read() as string).includes("x");',
        'function read() { let text: unknown = "x"; const ignored = (text = INPUT); return text; } (read() as string).includes("x");',
      ])("invalidates unsupported contextual binding updates: %s", body => {
        expect(checkPublicClosure(fixture(body.replace("INPUT", '"y"').replace("&&=", "=" ).replace("({text} = {text: \"y\"})", 'text = "y"'))).passed).toBe(true);
        expect(() => checkPublicClosure(fixture(body.replace("INPUT", '{includes() { return true; }}')))).toThrow(/parameter mutation|Code constructor acquisition/);
      });

      it.each([false, true])("unions destructured binding writes, imported=%s", imported => {
        const body = 'export let {text}: {text: unknown} = {text: "x"}; text = INPUT;';
        const use = '(text as string).includes("x");';
        const rootFor = (input: string): string => {
          if (!imported) return fixture(body.replace("INPUT", input) + use);
          const root = fixture('import {text} from "./authorized/v1/canonical";' + use);
          put(root, "packages/starchess-arena/src/authorized/v1/canonical.ts", body.replace("INPUT", input));
          return root;
        };
        expect(checkPublicClosure(rootFor('"y"')).passed).toBe(true);
        expect(() => checkPublicClosure(rootFor('{includes() { return true; }}'))).toThrow(/parameter mutation|Code constructor acquisition/);
      });

      it.each([
        'export let exposed = () => false; exposed = inspect;',
        'export const exposed = Object.freeze([inspect]);',
        'function preserve(value: unknown) { return value; } export const exposed = preserve([inspect]);',
        'function identity(value: typeof inspect) { return value; } export const exposed = identity(inspect);',
        'function identity(value: typeof inspect) { return value; } export const exposed = identity.call(null, inspect);',
        'function identity() { return this; } export const exposed = identity.call(inspect);',
      ])("retains unknown incoming for escaped callable values: %s", exposure => {
        const body = `function inspect(value: unknown) { return (value as string).includes("x"); } ${exposure} inspect("x");`;
        expect(checkPublicClosure(fixture(body.replace('return (value as string).includes("x");', 'if (typeof value !== "string") throw new Error("invalid"); return value.includes("x");'))).passed).toBe(true);
        expect(() => checkPublicClosure(fixture(body))).toThrow(/parameter mutation|Code constructor acquisition/);
      });

      it("does not expose the callee when only its primitive result escapes", () => {
        const body = 'function inspect(value: unknown) { return (value as string).includes("x"); } export const result = inspect("x");';
        expect(checkPublicClosure(fixture(body)).passed).toBe(true);
        expect(() => checkPublicClosure(fixture(body.replace('inspect("x")', "inspect(unknownFactory())")))).toThrow(/parameter mutation|Code constructor acquisition/);
      });

      it("keeps captured primitive values distinct from later binding updates", () => {
        const body = `
          function read() {
            let text: unknown = "x";
            const captured = {value: text}, ignored = (text = {includes() { return true; }});
            return captured.value;
          }
          (read() as string).includes("x");
        `;
        expect(checkPublicClosure(fixture(body)).passed).toBe(true);
        expect(() => checkPublicClosure(fixture(body.replace("return captured.value", "return text")))).toThrow(/parameter mutation|Code constructor acquisition/);
      });

      it.each([
        'export const exposed = ["x"].map(() => inspect);',
        'function collect(input: unknown[]) { const result: unknown[] = []; for (const entry of input) result.push(entry); return result; } export const exposed = collect([inspect]);',
        'function identity(value: typeof inspect) { return value; } const args = []; args.push(inspect); export const exposed = identity.apply(null, args);',
      ])("closes public exposure through actual returned array contents: %s", exposure => {
        const body = `function inspect(value: unknown) { return (value as string).includes("x"); } ${exposure} inspect("x");`;
        expect(checkPublicClosure(fixture(body.replace('return (value as string).includes("x");', 'if (typeof value !== "string") throw new Error("invalid"); return value.includes("x");'))).passed).toBe(true);
        recordSemanticRejection(body);
      });

      it("charges allocation alias and mutator relations before traversal", () => {
        const body = (count: number): string => `
          const rows = ["x"];
          ${Array.from({length: count}, (_, index) => `const alias${index} = ${index ? `alias${index - 1}` : "rows"}; alias${index}.push("y");`).join("\n")}
          rows.some(value => value.includes("x"));
        `;
        expect(checkPublicClosure(fixture(body(4))).passed).toBe(true);
        const hostile = body(4).replace('alias3.push("y")', "alias3.push(unknownFactory())");
        expect(() => checkPublicClosure(fixture(hostile))).toThrow(/parameter mutation|Code constructor acquisition/);
      });

      it("does not prefer an array-like length over an unproved iterator", () => {
        const body = probe(`
          function write(bag: {key: number | string}) { bag.key = "constructor"; return true; }
          const input = {length: 0, [Symbol.iterator]: () => [first].values()};
          Array.from(input).some(write);
        `, ["first"]);
        expect(checkPublicClosure(fixture(body.replace(', [Symbol.iterator]: () => [first].values()', ""))).passed).toBe(true);
        expect(() => checkPublicClosure(fixture(body))).toThrow(/parameter mutation|Code constructor acquisition/);
      });

      it("uses established enclosing-owner reachability without dropping public alternatives", () => {
        const helper = `
          export const marker = 1;
          export function collect(value: unknown) {
            const rows: {from: unknown}[] = [];
            rows.push({from: value});
            rows.sort((a, b) => (a.from as string).localeCompare(b.from as string));
            return rows;
          }
        `;
        const rootFor = (source: string, body = helper): string => {
          const root = fixture(source);
          put(root, "packages/starchess-arena/src/authorized/v1/canonical.ts", body);
          return root;
        };
        expect(checkPublicClosure(rootFor('export {marker} from "./authorized/v1/canonical";')).passed).toBe(true);
        expect(checkPublicClosure(rootFor('import {collect} from "./authorized/v1/canonical"; collect("x");')).passed).toBe(true);
        expect(() => checkPublicClosure(rootFor('export {collect} from "./authorized/v1/canonical"; import {collect} from "./authorized/v1/canonical"; collect("x");'))).toThrow(/parameter mutation|Code constructor acquisition/);
        expect(() => checkPublicClosure(rootFor('import {collect} from "./authorized/v1/canonical"; collect(unknownFactory());'))).toThrow(/parameter mutation|Code constructor acquisition/);
        expect(() => checkPublicClosure(rootFor('export {marker} from "./authorized/v1/canonical";', helper.replace("return rows;", 'return rows["constructor"];')))).toThrow(/Code constructor acquisition/);
      });
    });

    it("charges retained binding-map work against the existing ceilings", () => {
      const source = (count: number): string => `
        function build() {
          ${Array.from({length: count}, (_, index) => `const v${index} = ${index};`).join("\n")}
          return "x";
        }
        build().includes("x");
      `;
      expect(checkPublicClosure(fixture(source(20))).passed).toBe(true);
      expect(() => checkPublicClosure(fixture(source(600)))).toThrow(/analysis ceiling/);
    });

    it("retains reachable break exits in a normal-return selector", () => {
      const body = `
        function select() {
          let key: string | number = "constructor";
          for (const n of [0]) { if (n === 0) break; key = 0; }
          return {key};
        }
        function consume(value: unknown): void { void value; }
        const values = [0]; consume(values[select().key]);
      `;
      expect(checkPublicClosure(fixture(body.replace("if (n === 0) break;", ""))).passed).toBe(true);
      expect(() => checkPublicClosure(fixture(body))).toThrow(/parameter mutation|Code constructor acquisition/);
    });

    it("does not retain a primitive initializer after the receiver is replaced", () => {
      const body = 'let text: unknown = "x"; text = {includes() { return true; }}; (text as string).includes("x");';
      expect(checkPublicClosure(fixture(body.replace('text = {includes() { return true; }};', 'text = "y";'))).passed).toBe(true);
      expect(() => checkPublicClosure(fixture(body))).toThrow(/parameter mutation|Code constructor acquisition/);
    });

    it("retains inserted element alternatives before native callback grounding", () => {
      const body = 'const rows = ["x"]; rows.push(unknownFactory()); rows.some(value => value.includes("x"));';
      expect(checkPublicClosure(fixture(body.replace("unknownFactory()", '"y"'))).passed).toBe(true);
      expect(() => checkPublicClosure(fixture(body))).toThrow(/parameter mutation|Code constructor acquisition/);
    });

    it("retains unknown public incoming through a callable export alias", () => {
      const body = `
        function inspect(value: unknown) { return (value as string).includes("x"); }
        export const exposed = inspect;
        inspect("x");
      `;
      expect(checkPublicClosure(fixture(body.replace('return (value as string).includes("x");', 'if (typeof value !== "string") throw new Error("invalid"); return value.includes("x");'))).passed).toBe(true);
      expect(() => checkPublicClosure(fixture(body))).toThrow(/parameter mutation|Code constructor acquisition/);
    });

    it("does not authorize a primitive call from an absent enclosing frame", () => {
      const control = 'function inspect(value: unknown): boolean { return (value as string).includes("x"); } inspect("x");';
      expect(checkPublicClosure(fixture(control)).passed).toBe(true);
      expect(() => checkPublicClosure(fixture('function inspect(value: unknown): boolean { return (value as string).includes("x"); } unknownConsumer(inspect);')))
        .toThrow(/parameter mutation|Code constructor acquisition/);
    });

    it.each([false, true])("retains late collector alternatives, reverse=%s", reverse => {
      const body = 'function collect(input: {key: string}[]) { const result: {key: string}[] = []; for (const entry of input) result.push(entry); return result; }';
      const valid = '[{key: "x"}]', invalid = '[{key: unknownFactory() as string}]';
      expect(checkPublicClosure(fixture(body + `collect(${valid}).sort((a, b) => a.key.localeCompare(b.key));`)).passed).toBe(true);
      const choices = reverse ? `${invalid} : ${valid}` : `${valid} : ${invalid}`;
      expect(() => checkPublicClosure(fixture(body + `collect(true ? ${choices}).sort((a, b) => a.key.localeCompare(b.key));`)))
        .toThrow(/parameter mutation|Code constructor acquisition/);
    });

    it("derives created identifiers through actual flatMap and filter returns", () => {
      const source = `
        const receipts = [{kind: "materialized", id: "w:unit:created:1"}, {kind: "unmaterialized", id: "unused"}];
        const created = receipts.flatMap(value => value.kind === "materialized" ? [value.id] : []);
        const remaining = created.filter(value => value.includes(":created:"));
        remaining.some(value => value.includes(":created:") && created.includes(value));
      `;
      expect(checkPublicClosure(fixture(source)).passed).toBe(true);
      expect(() => checkPublicClosure(fixture(source.replace('id: "w:unit:created:1"', 'id: unknownFactory() as string'))))
        .toThrow(/parameter mutation|Code constructor acquisition/);
    });

    it("grounds Array.from indexes without accepting a length getter", () => {
      const source = 'const values = [0, 1]; Array.from({length: 2}, (_, index) => values[index]);';
      expect(checkPublicClosure(fixture(source)).passed).toBe(true);
      expect(() => checkPublicClosure(fixture(source.replace('{length: 2}', '{get length() { return unknownFactory(); }}'))))
        .toThrow(/parameter mutation|Code constructor acquisition/);
    });

    it("does not prove imported dispatch pristine from the importing unit alone", () => {
      const source = 'import { values } from "./authorized/v1/canonical"; values.some(value => value.includes("x"));';
      const good = fixture(source);
      put(good, "packages/starchess-arena/src/authorized/v1/canonical.ts", 'export const values = ["x"];');
      expect(checkPublicClosure(good).passed).toBe(true);
      const bad = fixture(source);
      put(bad, "packages/starchess-arena/src/authorized/v1/canonical.ts", 'export const values = ["x"]; const alias = values; alias.some = unknownFactory();');
      expect(() => checkPublicClosure(bad)).toThrow(/parameter mutation|Code constructor acquisition/);
    });

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
