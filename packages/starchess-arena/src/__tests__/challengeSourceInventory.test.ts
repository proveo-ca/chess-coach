import { cpSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { canonical } from "../challenge/config";
import { sha256 } from "../challenge/corpus";
import { collectSourceInventory, SOURCE_PARTITIONS, type SourceInventoryV1 } from "../challenge/sourceInventory";

const CORE = "packages/starchess-core";
const ARENA = "packages/starchess-arena";
const TRAINING = "packages/starchess-training";
const repository = fileURLToPath(new URL("../../../../", import.meta.url));
const temporary: string[] = [];
const ownMemberConstructors = [
  'const box: any = {f: () => {}}; box.f[["con", "structor"].join("")]("return process")();',
  'const box = {f: () => {}} as any; box.f[["con", "structor"].join("")]("return process")();',
  'const box = {f: () => {}}; (box.f as any)[["con", "structor"].join("")]("return process")();',
  'const box: any = {f: function () {}}; box["f"][["con", "structor"].join("")]("return process")();',
  'const box: any = {f() {}}; box.f[["con", "structor"].join("")]("return process")();',
  'const f: any = () => {}; const box: any = {f}; box.f[["con", "structor"].join("")]("return process")();',
  'const box: any = {nested: {f: () => {}}}; box.nested.f[["con", "structor"].join("")]("return process")();',
  'const box = {nested: {f: () => {}}} as any; const nested = box.nested; const alias = nested.f; alias[["con", "structor"].join("")]("return process")();',
  'const box: any = {get f() {return () => {};}}; box.f[["con", "structor"].join("")]("return process")();',
  'const box = {get f(): any {return () => {};}}; const alias = box.f; alias[["con", "structor"].join("")]("return process")();',
  'const box: any = {get nested() {return {f: () => {}};}}; const alias = box.nested.f; alias[["con", "structor"].join("")]("return process")();',
  'const box: any = {nested: {get f() {return () => {};}}}; const alias = box.nested.f; alias[["con", "structor"].join("")]("return process")();',
  'const box: any = {f: () => {}}; const alias = later; const later = box.f; alias[["con", "structor"].join("")]("return process")();',
  'const box: any = {f: () => {}}; const key = "f"; box[key][["con", "structor"].join("")]("return process")();',
  'const box: any = {f: 0, f: () => {}}; box.f[["con", "structor"].join("")]("return process")();',
  'const member: any = {f: () => {}}; const box: any = {...member}; box.f[["con", "structor"].join("")]("return process")();',
  'const box: any = {f: () => {}}; (0, box.f)[["con", "structor"].join("")]("return process")();',
];
const arrayMemberConstructors = [
  'const f:any=([()=>{}] as any)[0]; f[["con","structor"].join("")]("return process")();',
  'const array: any = [() => {}]; array[0][["con", "structor"].join("")]("return process")();',
  'const array = [function () {}] as any; const alias = array["0"]; alias[["con", "structor"].join("")]("return process")();',
  'const array: any = [0, () => {}]; const index = 1; const alias = array[index]; alias[["con", "structor"].join("")]("return process")();',
  'const array: any = [0, () => {}]; const alias = array[index]; alias[["con", "structor"].join("")]("return process")();',
  'const array: any = [[() => {}]]; array[0][0][["con", "structor"].join("")]("return process")();',
  'const box: any = {array: [[() => {}]]}; const alias = box.array[0][0]; alias[["con", "structor"].join("")]("return process")();',
  'const array: any = [{f: () => {}}]; array[0].f[["con", "structor"].join("")]("return process")();',
  'const array: any = [{nested: [() => {}]}]; const box = array[0]; const alias = box.nested[0]; alias[["con", "structor"].join("")]("return process")();',
  'const array: any = [{get f() {return () => {};}}]; const alias = array[0].f; alias[["con", "structor"].join("")]("return process")();',
  'const array: any = [{get nested() {return [() => {}];}}]; const alias = array[0].nested[0]; alias[["con", "structor"].join("")]("return process")();',
  'const [f] = [() => {}] as any; const alias = f; alias[["con", "structor"].join("")]("return process")();',
  'const [, f] = [0, () => {}] as any; f[["con", "structor"].join("")]("return process")();',
  'const [[f]] = [[() => {}]] as any; f[["con", "structor"].join("")]("return process")();',
  'const {nested: [f]} = {nested: [() => {}]} as any; f[["con", "structor"].join("")]("return process")();',
  'const [{f: alias}] = [{f: () => {}}] as any; alias[["con", "structor"].join("")]("return process")();',
  'const {0: f} = [() => {}] as any; f[["con", "structor"].join("")]("return process")();',
  'const [f = () => {}] = [] as any; f[["con", "structor"].join("")]("return process")();',
  'const items: any = [() => {}]; const array: any = [...items]; const f = array[0]; f[["con", "structor"].join("")]("return process")();',
  'const items: any = [() => {}]; const [f] = [...items] as any; f[["con", "structor"].join("")]("return process")();',
  'const items: any = [() => {}]; const array: any = [0, ...items]; array[1][["con", "structor"].join("")]("return process")();',
  'const [...array] = [() => {}] as any; array[0][["con", "structor"].join("")]("return process")();',
];
const dataArrayAccesses = [
  'const array: any = [1, 2]; void array[index];',
  'const array: any = [[1, 2]]; void array[0][index];',
  'const array: any = [{data: [1, 2]}]; const alias = array[0].data; void alias[index];',
  'const box: any = {f: () => {}, data: [[1, 2]]}; void box.data[0][index];',
  'const [data] = [[1, 2]] as any; void data[index];',
  'const {nested: [data]} = {nested: [[1, 2]]} as any; void data[index];',
  'const array: any = [() => {}, [1, 2]]; const [f, data] = array; void data[index];',
  'const path = [...rayBetween(from, to), to]; const blocked = 1; void path[blocked - 1];',
  'const rows = [...inputRows]; void rows[0][1];',
];
const unprovenComputedReceivers = [
  'const make:any=()=>()=>{}; const f=make(); const keys={indexOf:()=>["con","structor"].join("")} as unknown as number[]; const key=keys.indexOf(0); f[key]("return process")();',
  'const f: any = unknownFactory(); for (let key: any = 0; condition; key++) {key = ["con", "structor"].join(""); f[key]("return process")();}',
  'const f: any = unknownFactory(); String = (() => "constructor") as any; f[String(1)]("return process")();',
  'const f: any = unknownFactory(); Math.floor = (() => "constructor") as any; f[Math.floor(1)]("return process")();',
  'const f: any = unknownFactory(); globalThis.Math.floor = (() => "constructor") as any; f[Math.floor(1)]("return process")();',
  'const f: any = unknownFactory(); Array.prototype.indexOf = (() => "constructor") as any; f[[0].indexOf(0)]("return process")();',
  'const make:any=()=>()=>{}; const f=make(); const key=["con","structor"].join("") as "w"; f[key]("return process")();',
  'const make:any=()=>()=>{}; const f=make(); const key: "w"=["con","structor"].join("") as any; f[key]("return process")();',
  'const make:any=()=>()=>{}; const f=make(); const key=["con","structor"].join("") as unknown as number; f[key]("return process")();',
  'const make:any=()=>()=>{}; const f=make(); const makeKey=(): "w" => ["con","structor"].join("") as "w"; const key=makeKey(); f[key]("return process")();',
  'function make(): any {return () => {};} const value = make() as Record<string, number>; const compile: any = value[["con", "structor"].join("")]; compile("return process")();',
  'const make:any=()=>()=>{}; const f:Record<string,number>=make(); const c=f[["con","structor"].join("")] as unknown as (s:string)=>()=>unknown; c("return process")();',
  'const make = (): Record<string, number> => (() => {}) as unknown as Record<string, number>; const value = make(); const compile: any = value[["con", "structor"].join("")]; compile("return process")();',
  'const box: {f: number} = {f: 0}; (box as any).f = () => {}; const value = box.f as unknown as Record<string, number>; const compile: any = value[["con", "structor"].join("")]; compile("return process")();',
  'const make:any=()=>()=>{}; const f:any=make(); f[["con","structor"].join("")]("return process")();',
  'const box:any={f:0}; box.f=()=>{}; box.f[["con","structor"].join("")]("return process")();',
  'const make: any = function () {return function () {};}; const f: any = make(); f[["con", "structor"].join("")]("return process")();',
  'const make: any = () => ({f: () => {}}); const f = make().f; f[["con", "structor"].join("")]("return process")();',
  'const make: any = () => [() => {}]; const f = make()[0]; f[["con", "structor"].join("")]("return process")();',
  'const make: any = () => () => {}; const f = make(); const alias = f; alias[["con", "structor"].join("")]("return process")();',
  'const make: any = () => () => {}; const box: any = {f: make()}; box.f[["con", "structor"].join("")]("return process")();',
  'const make: any = () => ({f: () => {}}); const {f} = make(); f[["con", "structor"].join("")]("return process")();',
  'const make: any = () => [() => {}]; const [f] = make(); f[["con", "structor"].join("")]("return process")();',
  'const f: any = unknownFactory(); f[unknownKey];',
  'const make: any = () => () => {}; (make() as any)[["con", "structor"].join("")]("return process")();',
  'const box: any = {f: 0}; box["f"] = () => {}; const f = box.f; f[["con", "structor"].join("")]("return process")();',
  'const box: any = {nested: {f: 0}}; box.nested.f = () => {}; box.nested.f[["con", "structor"].join("")]("return process")();',
  'const box: any = {f: 0}; const alias = box; alias.f = () => {}; box.f[["con", "structor"].join("")]("return process")();',
  'const box: any = {nested: {f: 0}}; const alias = box.nested; alias.f = () => {}; box.nested.f[["con", "structor"].join("")]("return process")();',
  'const box: any = {nested: {f: 0}}; const {nested: alias} = box; alias.f = () => {}; box.nested.f[["con", "structor"].join("")]("return process")();',
  'const array: any = [0]; array[0] = () => {}; const [f] = array; f[["con", "structor"].join("")]("return process")();',
  'const box: any = {f: 0}; Object.assign(box, {f: () => {}}); box.f[["con", "structor"].join("")]("return process")();',
  'const box: any = {f: 0}; const alias = box; const api = Object; api.assign(alias, {f: () => {}}); box.f[["con", "structor"].join("")]("return process")();',
  'const box: any = {f: 0}; const assign = Object.assign; assign(box, {f: () => {}}); box.f[["con", "structor"].join("")]("return process")();',
  'const box: any = {f: 0}; Object.defineProperty(box, "f", {value: () => {}}); box.f[["con", "structor"].join("")]("return process")();',
  'const box: any = {f: 0}; Reflect.set(box, "f", () => {}); box.f[["con", "structor"].join("")]("return process")();',
  'const box: any = {f: 0}; [box.f] = [() => {}]; box.f[["con", "structor"].join("")]("return process")();',
  'const box: any = {f: 0}; ({f: box.f} = {f: () => {}}); box.f[["con", "structor"].join("")]("return process")();',
  'const box: any = {f: 0, other: 0}; box.other = 1; box.f[unknownKey];',
  'const make: any = () => () => {}; const f: any = condition ? make() : make(); f[["con", "structor"].join("")]("return process")();',
  'const make: any = () => () => {}; const f: any = make() || make(); f[["con", "structor"].join("")]("return process")();',
  'const make: any = async () => () => {}; const f: any = await make(); f[["con", "structor"].join("")]("return process")();',
  'const make: any = function () {return () => {};}; const f: any = new make(); f[["con", "structor"].join("")]("return process")();',
  'const box: any = {f: 0}; const f: any = box.f = () => {}; f[["con", "structor"].join("")]("return process")();',
  'const array: any = [0]; array.fill(() => {}); const f: any = array[0]; f[["con", "structor"].join("")]("return process")();',
  'const array: any = [0]; array.splice(0, 1, () => {}); const [f] = array; f[["con", "structor"].join("")]("return process")();',
  'const make: any = () => () => {}; const key = ["con", "structor"].join(""); if (["data"].includes(key) || true) make()[key]("return process")();',
  'const make: any = () => () => {}; let key: any = "data"; if (["data"].includes(key)) {key = ["con", "structor"].join(""); make()[key]("return process")();}',
  'const array: any = [0, () => {}]; array.reverse(); const f: any = array[0]; f[["con", "structor"].join("")]("return process")();',
  'const box = {f: 0}; (box as any).f = () => {}; (box.f as any)[["con", "structor"].join("")]("return process")();',
  'const box: any = {f: 0}; function mutate() {box.f = () => {};} mutate(); box.f[["con", "structor"].join("")]("return process")();',
];
const ordinaryComputedData = [
  'const values: any = unknownFactory(); for (let i = 0; i < 3; i++) void values[i];',
  'const values: any = unknownFactory(); const items = [1, 2]; for (let i = items.length - 1; i >= 0; i--) void values[i];',
  'const make: any = () => [1, 2]; const values = make(); void values[0];',
  'const values: any = unknownFactory(); const index: number = 1; void values[index];',
  'const values: any = unknownFactory(); void values["data"];',
  'const make = (): {[key: string]: number} => ({w: 1}); const values = make(); const key = "w"; void values[key];',
  'const box: {data: {[key: string]: number}} = {data: {w: 1}}; box.data.w = 2; const key = "w"; void box.data[key];',
  'const box: any = {data: [1, 2]}; box.data[0] = 3; void box.data[0];',
  'const box: any = {data: [1, 2]}; Object.assign(box, {data: [3, 4]}); void box.data[1];',
  'const values: any = unknownFactory(); const key: "w" | "b" = unknownSide; if (["w", "b"].includes(key)) void values[key];',
  'const values: any = unknownFactory(); for (const key of ["w", "b"]) void values[key];',
  'const values: any = unknownFactory(); const key = unknownKey; if (["w", "b"].includes(key)) void values[key];',
  'const values: any = unknownFactory(); void values[+values.indexOf("first") + 1];',
  'function charge(budget: any, field: string, amount: number) {budget[field] += amount; if (budget[field] > 100) throw new Error("limit");}',
  'function inspect(value: {[key: string]: unknown}, key: string) {let alias: unknown = value.data; alias = null; return value[key];}',
  'function access(array: any, index: number) {void array[index];} function Function(value: string) {return value;} void Function("data");',
];
afterEach(() => { for (const root of temporary.splice(0)) rmSync(root, { recursive: true, force: true }); });
const put = (root: string, path: string, value: string): void => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), value);
};
const fixture = (): string => {
  mkdirSync("/tmp/opencode", { recursive: true });
  const root = mkdtempSync("/tmp/opencode/challenge-source-inventory-");
  temporary.push(root);
  for (const path of ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", `${CORE}/package.json`, `${ARENA}/package.json`, `${TRAINING}/package.json`, `${CORE}/tsconfig.json`, `${ARENA}/tsconfig.json`, `${TRAINING}/tsconfig.json`, `${ARENA}/hermetic/pins.json`]) {
    put(root, path, readFileSync(join(repository, path), "utf8"));
  }
  put(root, `${CORE}/package.json`, JSON.stringify({ name: "@chess-coach/starchess-core", exports: { ".": "./src/index.ts" }, dependencies: { fflate: "^0.8.3" } }));
  put(root, `${ARENA}/package.json`, JSON.stringify({ name: "@chess-coach/starchess-arena", exports: {
    ".": "./src/index.ts", "./observations": "./src/observations.ts", "./intent-codec-v1": "./src/intent-codec-v1.ts",
  }, dependencies: { "@chess-coach/starchess-core": "workspace:*" }, devDependencies: { tsx: "^4.19.5", typescript: "~5.9.3" } }));
  put(root, `${TRAINING}/package.json`, JSON.stringify({ name: "@chess-coach/starchess-training", exports: { "./candidates": "./src/candidates.ts" }, dependencies: {
    "@chess-coach/starchess-core": "workspace:*", "@chess-coach/starchess-arena": "workspace:*", "@noble/hashes": "2.4.0",
  } }));
  for (const path of [`${CORE}/src/index.ts`, `${CORE}/src/seeds.ts`, `${ARENA}/src/index.ts`, `${ARENA}/src/observations.ts`, `${ARENA}/src/intent-codec-v1.ts`, `${TRAINING}/src/candidates.ts`, `${ARENA}/src/challenge/worker.ts`, `${ARENA}/src/challenge/sourceInventory.ts`, `${ARENA}/src/challengeContract/codec.ts`]) put(root, path, "export {};\n");
  put(root, `${ARENA}/src/cli/challenge.ts`, 'import "@chess-coach/starchess-core";\n');
  put(root, `${ARENA}/src/challenge/supervisor.ts`, 'import { createRequire } from "node:module";\ncreateRequire(import.meta.url).resolve("tsx");\nnew URL("./worker.ts", import.meta.url);\n');
  put(root, "scripts/challenge-contract-evidence.ts", `import "../${ARENA}/src/challengeContract/codec";\n`);
  put(root, `${ARENA}/hermetic/run.mjs`, 'import "./runtime.mjs";\nimport pins from "./pins.json" with { type: "json" };\nvoid pins;\n');
  put(root, `${ARENA}/hermetic/runtime.mjs`, 'import "node:child_process";\nnew URL(variable, import.meta.url);\n');
  put(root, `${ARENA}/hermetic/infra.test.mjs`, "export {};\n");
  put(root, `${ARENA}/src/__tests__/excluded.ts`, "import(computed);\n");
  return root;
};

describe("partitioned challenge source inventory", () => {
  it("preserves global evaluation rejection after data-type inference", () => {
    const root = fixture();
    put(root, `${CORE}/src/index.ts`, 'function access(array: any, index: number) {void array[index];} Function("return process")();');
    expect(() => collectSourceInventory(root)).toThrow("Unsupported string evaluation");
  });
  it.each(unprovenComputedReceivers)("rejects unproven call-derived or mutated receivers: %s", (code) => {
    const root = fixture();
    put(root, `${CORE}/src/index.ts`, code);
    expect(() => collectSourceInventory(root)).toThrow(/Unsupported code constructor acquisition|Unsupported mutable computed receiver|Unsupported builtin acquisition/);
  });
  it.each(ordinaryComputedData)("allows ordinary call-derived and mutated data indexing: %s", (code) => {
    const root = fixture();
    put(root, `${CORE}/src/index.ts`, code);
    expect(collectSourceInventory(root).audit.passed).toBe(true);
  });
  it.each(arrayMemberConstructors)("rejects numeric array function constructor acquisition: %s", (code) => {
    const root = fixture();
    put(root, `${CORE}/src/index.ts`, code);
    expect(() => collectSourceInventory(root)).toThrow("Unsupported code constructor acquisition");
  });
  it.each(dataArrayAccesses)("allows ordinary data array indexing: %s", (code) => {
    const root = fixture();
    put(root, `${CORE}/src/index.ts`, code);
    expect(collectSourceInventory(root).audit.passed).toBe(true);
  });
  it.each(ownMemberConstructors)("rejects computed constructors on own function members: %s", (code) => {
    const root = fixture();
    put(root, `${CORE}/src/index.ts`, code);
    expect(() => collectSourceInventory(root)).toThrow("Unsupported code constructor acquisition");
  });
  it("allows computed own data indexing beside function members", () => {
    const root = fixture();
    put(root, `${CORE}/src/index.ts`, 'const box: any = {f: () => {}, data: {w: 1, b: 2}}; const alias = box.data; void alias[key];');
    expect(collectSourceInventory(root).audit.passed).toBe(true);
  });
  it.each([
    'import.meta.url = "file:///contracts/anchor.cjs";',
    'delete import.meta.url;',
    'const meta = import.meta; Object.assign(meta, {url: "file:///contracts/anchor.cjs"});',
    'Object.defineProperty(import.meta, "url", {value: "file:///contracts/anchor.cjs"});',
    'const load = (() => {}).constructor(`return process.getBuiltinModule("module")`)();',
    'const compile = Reflect.get(() => {}, "constructor"); compile("return process")();',
    '[import.meta.url] = ["file:///contracts/anchor.cjs"];',
    '({url: import.meta.url} = {url: "file:///contracts/anchor.cjs"});',
    'for ([import.meta.url] of [["file:///contracts/anchor.cjs"]]) {}',
    'const key = "constructor"; const compile = (() => {})[key];',
    'const {constructor: compile} = () => {};',
    'const read = Reflect.get; const compile = read(() => {}, "constructor");',
    'const key = "con" + "structor"; const compile = (() => {})[key];',
    'const key = ["con", "structor"].join(""); const compile = ((() => {}) as any)[key];',
    'const fn: any = () => {}; const key = ["con", "structor"].join(""); const compile = fn[key];',
    'const key = ["con", "structor"].join(""); const compile = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(() => {}), key).value;',
    'let fn: any = {}; fn = () => {}; const key = ["con", "structor"].join(""); const compile = fn[key];',
    'let fn: any = {}; fn = () => {}; const alias = fn; const key = ["con", "structor"].join(""); const compile = alias[key];',
    'let fn: any = {}; [fn] = [() => {}]; const key = ["con", "structor"].join(""); const compile = fn[key];',
    'const {getPrototypeOf: p} = Object; const proto = p(() => {}); const key = ["con", "structor"].join(""); const compile = proto[key];',
    'let api: any = {}; api = Object; for (const key of ["getPrototypeOf"]) { const proto = api[key](() => {}); }',
    'let api: any = {}; api = Object; for (const key of ["getOwnPropertyDescriptor"]) { const descriptor = api[key]; }',
    'const api = Object; for (const key of ["getPrototypeOf"]) { const proto = api[key](() => {}); }',
  ])("rejects metadata mutation and indirect code constructors: %s", (code) => {
    const root = fixture();
    put(root, `${CORE}/src/index.ts`, code);
    expect(() => collectSourceInventory(root)).toThrow(/Unsupported import metadata|Unsupported code constructor|Unsupported mutable computed receiver|Unsupported builtin acquisition/);
  });
  it("audits execution files named infra.test.mjs instead of bypassing partition rules", () => {
    const root = fixture();
    put(root, `${ARENA}/src/infra.test.mjs`, 'import "./challengeContract/codec";\n');
    expect(() => collectSourceInventory(root)).toThrow("Forbidden partition edge");
  });

  it.each([
    'const load = createRequire(import.meta.url).bind(null); load(variable);',
    'const request = createRequire(import.meta.url); const bound = request.bind(null); bound(variable);',
    'const request = createRequire(import.meta.url); Reflect.apply(request, null, [variable]);',
    'const { resolve: locate } = createRequire(import.meta.url); locate(variable);',
  ])("rejects escaping a module loader: %s", (code) => {
    const root = fixture();
    put(root, `${ARENA}/src/escape.ts`, `import {createRequire} from "node:module";\n${code}\n`);
    expect(() => collectSourceInventory(root)).toThrow(/Unsupported loader/);
  });

  it.each([
    'import nodeModule from "node:module"; nodeModule.createRequire(import.meta.url)("../challengeContract/codec.ts");',
    'import nodeModule from "module"; nodeModule["createRequire"](import.meta.url)("../challengeContract/codec.ts");',
    'import {default as nodeModule} from "node:module"; nodeModule.createRequire(import.meta.url)("../challengeContract/codec.ts");',
    'import {Module as nodeModule} from "node:module"; nodeModule.createRequire(import.meta.url)("../challengeContract/codec.ts");',
    'import * as nodeModule from "node:module"; const alias = nodeModule; alias.createRequire(import.meta.url)("../challengeContract/codec.ts");',
    'import nodeModule from "node:module"; const second = first; const first = nodeModule; second["createRequire"](import.meta.url)("../challengeContract/codec.ts");',
    'import nodeModule from "node:module"; (0, nodeModule.createRequire)(import.meta.url)("../challengeContract/codec.ts");',
    'import nodeModule from "node:module"; (nodeModule["createRequire"] as typeof nodeModule.createRequire)!(import.meta.url)("../challengeContract/codec.ts");',
    'import nodeModule from "node:module"; const make = nodeModule.createRequire; make(import.meta.url)("../challengeContract/codec.ts");',
    'import nodeModule from "node:module"; const make = later; const later = nodeModule["createRequire"]; make(import.meta.url)("../challengeContract/codec.ts");',
    'import { createRequire as make } from "node:module"; const first = second; const second = make; first(import.meta.url)("../challengeContract/codec.ts");',
    'import { createRequire as make } from "node:module"; const load = later; const later = make(import.meta.url); load("../challengeContract/codec.ts");',
    'import { createRequire } from "node:module"; (createRequire(import.meta.url) as ReturnType<typeof createRequire>)!("../challengeContract/codec.ts");',
    'module["require"]("../challengeContract/codec.ts");',
  ])("audits literal forbidden targets through supported loader syntax: %s", (code) => {
    const root = fixture();
    put(root, `${ARENA}/src/challenge/worker.ts`, code);
    expect(() => collectSourceInventory(root)).toThrow("Forbidden partition edge");
  });

  it.each([
    'make("/app/packages/starchess-arena/src/challengeContract/anchor.cjs")("./codec.cjs");',
    'make(new URL("file:///app/packages/starchess-arena/src/challengeContract/anchor.cjs"))("./codec.cjs");',
    'make(new URL("../challengeContract/anchor.cjs", import.meta.url))("./codec.cjs");',
    'make(new URL(import.meta.url))("./codec.cjs");',
    'make("file:///app/packages/starchess-arena/src/challengeContract/anchor.cjs")("./codec.cjs");',
    'const base = import.meta.url; make(base)("./codec.cjs");',
    'make((other(), import.meta.url))("./codec.cjs");',
    'make()("./codec.cjs");',
    'make(import.meta.url, extra)("./codec.cjs");',
    'make(...args)("./codec.cjs");',
  ])("rejects unsupported factory bases through forward aliases: %s", (code) => {
    const root = fixture();
    put(root, `${ARENA}/src/challenge/codec.cjs`, 'module.exports = "execution decoy";\n');
    put(root, `${ARENA}/src/challengeContract/codec.cjs`, 'module.exports = "contracts target";\n');
    put(root, `${ARENA}/src/challenge/worker.ts`, `import nodeModule from "node:module";\nconst make = later; const later = nodeModule["createRequire"];\n${code}\n`);
    expect(() => collectSourceInventory(root)).toThrow("Unsupported createRequire base");
  });

  it.each(["absolute path", "URL"])("rejects a %s factory base that resolves to contracts instead of an execution decoy", (kind) => {
    const root = fixture();
    const anchor = join(root, `${ARENA}/src/challengeContract/anchor.cjs`);
    const worker = join(root, `${ARENA}/src/challenge/worker.ts`);
    put(root, `${ARENA}/src/challengeContract/anchor.cjs`, "module.exports = {};\n");
    put(root, `${ARENA}/src/challengeContract/codec.cjs`, 'module.exports = "contracts target";\n');
    put(root, `${ARENA}/src/challenge/codec.cjs`, 'module.exports = "execution decoy";\n');
    const base = kind === "URL" ? pathToFileURL(anchor) : anchor;
    expect(createRequire(base)("./codec.cjs")).toBe("contracts target");
    expect(createRequire(worker)("./codec.cjs")).toBe("execution decoy");
    const expression = kind === "URL" ? `new URL(${JSON.stringify(pathToFileURL(anchor).href)})` : JSON.stringify(anchor);
    put(root, `${ARENA}/src/challenge/worker.ts`, `import {createRequire as factory} from "node:module";\nconst make = later; const later = factory;\nmake(${expression})("./codec.cjs");\n`);
    expect(() => collectSourceInventory(root)).toThrow("Unsupported createRequire base");
  });

  it.each([
    'process.getBuiltinModule("module").createRequire(import.meta.url)("../challengeContract/codec.ts");',
    'process["getBuiltinModule"]("module").createRequire(import.meta.url)("../challengeContract/codec.ts");',
    'const acquire = process.getBuiltinModule; acquire("module");',
    'const p = later; const later = process; const acquire = p["getBuiltinModule"]; acquire("module");',
    'const key = "getBuiltinModule"; process[key]("module");',
    'const {getBuiltinModule: acquire} = process; acquire("module");',
    'const box = {process}; box.process.getBuiltinModule("module");',
    'import p from "node:process"; p.getBuiltinModule("module");',
    'import * as p from "node:process"; const alias = p; alias["getBuiltinModule"]("module");',
    'import * as p from "node:process"; p.default.getBuiltinModule("module");',
    'import {default as p} from "process"; p.getBuiltinModule("module");',
    'import {getBuiltinModule as acquire} from "node:process"; acquire("module");',
    'globalThis.process.getBuiltinModule("module");',
    'const g = globalThis; const p = g["process"]; p["getBuiltinModule"]("module");',
    'const g = global; g.globalThis.process.getBuiltinModule("module");',
    'const p = require("node:process"); p.getBuiltinModule("module");',
    'import("node:process").then(p => p.getBuiltinModule("module"));',
    'export {getBuiltinModule as acquire} from "node:process";',
    'export * from "node:process";',
  ])("rejects unsupported builtin acquisition: %s", (code) => {
    const root = fixture();
    put(root, `${ARENA}/src/challenge/worker.ts`, code);
    expect(() => collectSourceInventory(root)).toThrow("Unsupported builtin acquisition");
  });

  it("rejects an actual builtin acquisition that loads contracts in CommonJS", () => {
    const root = fixture();
    const path = `${ARENA}/src/challenge/acquire.cjs`;
    put(root, `${ARENA}/src/challengeContract/codec.cjs`, 'module.exports = "contracts target";\n');
    put(root, path, 'module.exports = process.getBuiltinModule("module").createRequire(__filename)("../challengeContract/codec.cjs");\n');
    expect(createRequire(import.meta.url)(join(root, path))).toBe("contracts target");
    expect(() => collectSourceInventory(root)).toThrow("Unsupported builtin acquisition");
  });

  it.each([
    'import {register} from "node:module"; register("../challengeContract/codec.ts", import.meta.url);',
    'import {registerHooks as install} from "module"; install(hooks);',
    'import nodeModule from "node:module"; nodeModule.register("../challengeContract/codec.ts", import.meta.url);',
    'import * as nodeModule from "node:module"; const alias = nodeModule; alias["registerHooks"](hooks);',
    'import {Module as nodeModule} from "node:module"; const install = nodeModule["register"]; install(variable);',
  ])("rejects unsupported Node module registration APIs: %s", (code) => {
    const root = fixture();
    put(root, `${ARENA}/src/challenge/worker.ts`, code);
    expect(() => collectSourceInventory(root)).toThrow("Unsupported module loader API");
  });

  it.each([
    'eval("require(\'../challengeContract/codec.cjs\')");',
    '(0, eval)("require(\'../challengeContract/codec.cjs\')");',
    '(eval as typeof eval)!(variable);',
    'const execute = eval; execute(variable);',
    'Reflect.apply(eval, null, [variable]);',
    'eval.call(null, variable);',
    'globalThis.eval(variable);',
    'globalThis["eval"](variable);',
    'const g = later; const later = globalThis; g["eval"](variable);',
    'const g = global; g.globalThis.eval(variable);',
    'Function("return import(\'../challengeContract/codec.ts\')")();',
    'new Function("return import(\'../challengeContract/codec.ts\')")();',
    '(0, Function)(variable)();',
    'const compile = Function; compile(variable)();',
    'globalThis["Function"](variable)();',
    'const g = globalThis; new g.Function(variable)();',
    'const box = {execute: eval}; box.execute(variable);',
  ])("rejects direct and indirect string evaluation: %s", (code) => {
    const root = fixture();
    put(root, `${ARENA}/src/challenge/escape.cjs`, code);
    expect(() => collectSourceInventory(root)).toThrow("Unsupported string evaluation");
  });

  it("rejects an actual CommonJS eval load into contracts", () => {
    const root = fixture();
    const path = `${ARENA}/src/challenge/evaluate.cjs`;
    put(root, `${ARENA}/src/challengeContract/codec.cjs`, 'module.exports = "contracts target";\n');
    put(root, path, 'module.exports = eval("require(\'../challengeContract/codec.cjs\')");\n');
    expect(createRequire(import.meta.url)(join(root, path))).toBe("contracts target");
    expect(() => collectSourceInventory(root)).toThrow("Unsupported string evaluation");
  });

  it("allows normalized import.meta.url factory bases and safe process namespace aliases", () => {
    const root = fixture();
    put(root, `${ARENA}/src/challenge/worker.ts`, 'import {createRequire as make} from "node:module";\nconst load = make(((import.meta.url as string)!));\nload("./supervisor.ts");\nimport * as p from "node:process"; const alias = p; void alias.env[variable]; void alias.default.argv;\nconst g = globalThis; void g.crypto;\n');
    expect(collectSourceInventory(root).audit.edges).toContainEqual(expect.objectContaining({
      importer: `${ARENA}/src/challenge/worker.ts`, target: `${ARENA}/src/challenge/supervisor.ts`, kind: "require",
    }));
  });

  it("allows genuine lexical shadows, property names and erased evaluation API types", () => {
    const root = fixture();
    put(root, `${ARENA}/src/challenge/worker.ts`, 'type Eval = typeof eval; type Constructor = Function;\nimport type {getBuiltinModule} from "node:process"; import type {registerHooks} from "node:module";\nexport type {getBuiltinModule, registerHooks};\nconst object = {eval: 1, Function: 2, getBuiltinModule: 3, register: 4}; void object.eval; void object.Function;\nfunction local(eval: (value: string) => string, Function: (value: string) => string, process: {getBuiltinModule: () => string}) { eval("safe"); Function("safe"); return process.getBuiltinModule(); }\nfunction scope() { function eval(value: string) { return value; } function Function(value: string) { return value; } return [eval("safe"), Function("safe")]; }\n');
    expect(collectSourceInventory(root).audit.passed).toBe(true);
  });

  it("allows actual CommonJS functions that shadow evaluation globals", () => {
    const root = fixture();
    const path = `${ARENA}/src/challenge/shadows.cjs`;
    put(root, path, 'function eval(value) { return value; }\nfunction Function(value) { return value; }\nfunction local(process, globalThis) { return [process.getBuiltinModule(), globalThis.eval(), globalThis.Function()]; }\nmodule.exports = [eval("local eval"), Function("local Function"), ...local({getBuiltinModule: () => "local process"}, {eval: () => "local method", Function: () => "local constructor method"})];\n');
    expect(createRequire(import.meta.url)(join(root, path))).toEqual(["local eval", "local Function", "local process", "local method", "local constructor method"]);
    expect(collectSourceInventory(root).audit.passed).toBe(true);
  });

  it.each([
    ["worker.ts", 'import {createRequire} from "node:module"; createRequire(import.meta.url).resolve("tsx");'],
    ["supervisor.ts", 'import {createRequire} from "node:module"; createRequire(import.meta.url).resolve("tsx/package.json");'],
    ["supervisor.ts", 'import {createRequire as make} from "node:module"; make(import.meta.url).resolve("tsx");'],
  ])("keeps the inline factory resolver confined to its existing supervisor scope: %s %s", (name, code) => {
    const root = fixture();
    put(root, `${ARENA}/src/challenge/${name}`, code);
    expect(() => collectSourceInventory(root)).toThrow("Undeclared createRequire resolver");
  });

  it.each([
    'const box = {make: nodeModule.createRequire}; box.make(import.meta.url)("../challengeContract/codec.js");',
    'const box = {make: nodeModule["createRequire"]}; box.make(import.meta.url)("../challengeContract/codec.ts");',
    'const make = nodeModule["createRequire"]; const box = {make}; box.make(import.meta.url)("../challengeContract/codec.ts");',
    'const make = later; const later = nodeModule.createRequire; const box = {make}; box.make(import.meta.url)("../challengeContract/codec.ts");',
    'const box = {nodeModule}; box.nodeModule.createRequire(import.meta.url)("../challengeContract/codec.ts");',
    'const alias = nodeModule; export {alias};',
    'export {nodeModule};',
    'export default nodeModule;',
    'export const alias = nodeModule;',
    'export const make = nodeModule.createRequire;',
    'export const load = nodeModule.createRequire(import.meta.url);',
    'const alias = nodeModule; alias = other;',
    'nodeModule = other;',
    'nodeModule.createRequire = other;',
    'const key = "createRequire"; nodeModule[key](import.meta.url)("../challengeContract/codec.ts");',
    'nodeModule[getter()](import.meta.url)("../challengeContract/codec.ts");',
    'nodeModule["default"].createRequire(import.meta.url)("../challengeContract/codec.ts");',
    'const {createRequire: make} = (nodeModule as unknown);',
    'consume(nodeModule);',
    'consume(nodeModule["createRequire"]);',
    'function getModule() { return nodeModule; }',
    'function getFactory() { return nodeModule.createRequire; }',
    'const load = nodeModule.createRequire(import.meta.url); consume(load);',
    'const load = nodeModule.createRequire(import.meta.url); const box = {load};',
    'const load = nodeModule.createRequire(import.meta.url); function getLoader() { return load; }',
    'const load = nodeModule.createRequire(import.meta.url); load = other;',
    'const load = nodeModule.createRequire(import.meta.url); const key = "resolve"; load[key]("../challengeContract/codec.ts");',
    'const load = nodeModule.createRequire(import.meta.url); load[getter()]("../challengeContract/codec.ts");',
    'const load = nodeModule.createRequire(import.meta.url); const locate = load["resolve"]; locate("../challengeContract/codec.ts");',
    'const make = nodeModule.createRequire; make = other;',
    'const make = nodeModule.createRequire; make["call"](null, import.meta.url)("../challengeContract/codec.ts");',
    'const box = [nodeModule.createRequire]; box[0](import.meta.url)("../challengeContract/codec.ts");',
  ])("fails closed on namespace, factory, or loader escapes: %s", (code) => {
    const root = fixture();
    put(root, `${ARENA}/src/challenge/worker.ts`, `import nodeModule from "node:module";\n${code}\n`);
    expect(() => collectSourceInventory(root)).toThrow(/Unsupported loader (escape|destructuring)|Forbidden partition edge/);
  });

  it.each([
    'export * from "node:module";',
    'export * as box from "node:module";',
    'export {createRequire as make} from "node:module";',
    'export {default as box} from "module";',
    'export {Module as box} from "node:module";',
    'import {createRequire as make} from "node:module"; export {make};',
    'import * as nodeModule from "node:module"; const alias = nodeModule; export {alias as box};',
  ])("rejects loader-bearing reexports: %s", (code) => {
    const root = fixture();
    put(root, `${ARENA}/src/challenge/worker.ts`, code);
    expect(() => collectSourceInventory(root)).toThrow("Unsupported loader escape");
  });

  it.each([
    'import("node:module").then(nodeModule => nodeModule.createRequire(import.meta.url)("../challengeContract/codec.ts"));',
    'const nodeModule = await import("module"); nodeModule.default.createRequire(import.meta.url)("../challengeContract/codec.ts");',
    'const nodeModule = require("node:module"); nodeModule.createRequire(import.meta.url)("../challengeContract/codec.ts");',
  ])("rejects non-static module namespaces: %s", (code) => {
    const root = fixture();
    put(root, `${ARENA}/src/challenge/worker.ts`, code);
    expect(() => collectSourceInventory(root)).toThrow("Unsupported dynamic module import");
  });

  it.each([
    'require("./helper.txt");',
    'require.resolve("./helper.txt");',
    'import nodeModule from "node:module"; (nodeModule.createRequire)(import.meta.url)("./helper.txt");',
    'import * as nodeModule from "node:module"; const alias = nodeModule; alias["createRequire"](import.meta.url)("./helper.txt");',
    'import {createRequire as make} from "node:module"; const load = make(import.meta.url); load("./helper.txt");',
    'import "./helper.txt";',
  ])("rejects actual unrecognized-extension executable sources: %s", (code) => {
    const root = fixture();
    const helper = `${ARENA}/src/challenge/helper.txt`;
    put(root, helper, 'exports.value = require("../challengeContract/codec.cjs").value;\n');
    put(root, `${ARENA}/src/challengeContract/codec.cjs`, "exports.value = 42;\n");
    expect(createRequire(import.meta.url)(join(root, helper))).toEqual({ value: 42 });
    put(root, `${ARENA}/src/challenge/worker.ts`, code);
    expect(() => collectSourceInventory(root)).toThrow("Unaudited executable extension");
  });

  it("preserves static named loaders, extensionless code, JSON, MJS, package resolution and supervisor edges", () => {
    const root = fixture();
    put(root, `${ARENA}/src/challenge/helper.ts`, "export {};\n");
    put(root, `${ARENA}/src/challenge/other.mjs`, "export {};\n");
    put(root, `${ARENA}/src/challenge/data.json`, '{"value":42}\n');
    put(root, `${ARENA}/src/challenge/worker.ts`, 'import {createRequire as make} from "node:module";\nconst load = make(import.meta.url);\nload("./helper");\nload("./other.mjs");\nload("./data.json");\nload.resolve("tsx/package.json");\n');
    const inventory = collectSourceInventory(root);
    expect(inventory.audit.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ specifier: "./helper", target: `${ARENA}/src/challenge/helper.ts`, kind: "require" }),
      expect.objectContaining({ specifier: "./other.mjs", kind: "require" }),
      expect.objectContaining({ specifier: "./data.json", kind: "require" }),
      expect.objectContaining({ specifier: "tsx/package.json", targetKind: "external", kind: "resolve" }),
      expect.objectContaining({ specifier: "tsx", kind: "resolve", importer: `${ARENA}/src/challenge/supervisor.ts` }),
      expect.objectContaining({ specifier: "./worker.ts", kind: "worker" }),
    ]));
  });

  it.each([
    'import nodeModule from "node:module"; (0, nodeModule.createRequire)(import.meta.url)("./supervisor.ts");',
    'import nodeModule from "node:module"; (nodeModule["createRequire"] as typeof nodeModule.createRequire)!(import.meta.url)("./supervisor.ts");',
    'import {createRequire} from "node:module"; (createRequire(import.meta.url) as ReturnType<typeof createRequire>)!("./supervisor.ts");',
    'import nodeModule from "node:module"; const make = later; const later = (nodeModule["createRequire"] satisfies typeof nodeModule.createRequire); make(import.meta.url)("./supervisor.ts");',
    'import * as nodeModule from "node:module"; const second = first; const first = (nodeModule); second.createRequire(import.meta.url)("./supervisor.ts");',
  ])("records allowed literal targets through wrappers and forward aliases: %s", (code) => {
    const root = fixture();
    put(root, `${ARENA}/src/challenge/worker.ts`, code);
    expect(collectSourceInventory(root).audit.edges).toContainEqual(expect.objectContaining({
      importer: `${ARENA}/src/challenge/worker.ts`, target: `${ARENA}/src/challenge/supervisor.ts`, kind: "require",
    }));
  });

  it("distinguishes lexical bindings and property names from loader value references", () => {
    const root = fixture();
    put(root, `${ARENA}/src/challenge/worker.ts`, 'import {isBuiltin} from "node:module";\nimport {createRequire as make} from "node:module";\nconst load = make(import.meta.url); load("./supervisor.ts");\nconst object = {createRequire: 1, require: 2, module: 3, make: 4};\nvoid object.createRequire; void object.require; void object.module; void object.make;\nfunction local(make: (value: string) => void, module: object, require: number) { make("unrelated"); return {module, require}; }\nfunction inner() { const load = (value: string) => value; return load("unrelated"); }\nvoid isBuiltin("fs");\nexport {isBuiltin};\n');
    expect(collectSourceInventory(root).audit.edges.filter((edge) => edge.importer.endsWith("/worker.ts") && edge.kind === "require")).toEqual([
      expect.objectContaining({ specifier: "./supervisor.ts", target: `${ARENA}/src/challenge/supervisor.ts` }),
    ]);
  });

  it.each([".mjs", ".js"])("audits loader aliases and escapes in JavaScript %s files", (extension) => {
    const root = fixture();
    const path = `${ARENA}/src/challenge/escape${extension}`;
    put(root, path, 'import nodeModule from "node:module"; const make = later; const later = nodeModule["createRequire"]; make(import.meta.url)("../challengeContract/codec.ts");\n');
    expect(() => collectSourceInventory(root)).toThrow("Forbidden partition edge");
    put(root, path, 'import nodeModule from "node:module"; const box = {make: nodeModule["createRequire"]}; box.make(import.meta.url)("../challengeContract/codec.ts");\n');
    expect(() => collectSourceInventory(root)).toThrow("Unsupported loader escape");
  });

  it.each([
    ['require(variable);', "Computed module loader"],
    ['const box = {require}; box.require("../challengeContract/codec.ts");', "Unsupported loader escape"],
    ['const nodeModule = require("node:module"); nodeModule.createRequire(__filename)("../challengeContract/codec.ts");', "Unsupported dynamic module import"],
  ])("rejects unauditable CommonJS loader uses: %s", (code, message) => {
    const root = fixture();
    put(root, `${ARENA}/src/challenge/escape.cjs`, code);
    expect(() => collectSourceInventory(root)).toThrow(message);
  });

  it("audits ordinary CommonJS imports and exports", () => {
    const root = fixture();
    put(root, `${ARENA}/src/challenge/helper.cjs`, "module.exports = {value: 42};\n");
    put(root, `${ARENA}/src/challenge/load.cjs`, 'module.exports = require("./helper.cjs");\n');
    expect(collectSourceInventory(root).audit.edges).toContainEqual(expect.objectContaining({
      importer: `${ARENA}/src/challenge/load.cjs`, target: `${ARENA}/src/challenge/helper.cjs`, kind: "require",
    }));
  });

  it("allows erased loader type queries and type-only reexports", () => {
    const root = fixture();
    put(root, `${ARENA}/src/challenge/worker.ts`, 'import {createRequire as make} from "node:module";\nimport nodeModule from "node:module";\ntype Factory = typeof make;\ntype Namespace = typeof nodeModule;\nexport type {make, nodeModule, Factory, Namespace};\nexport {type make as FactoryValue};\nexport {type createRequire} from "node:module";\n');
    expect(collectSourceInventory(root).audit.passed).toBe(true);
  });

  it("audits its own actual source without confusing AST property names with loader references", () => {
    const root = fixture();
    const path = `${ARENA}/src/challenge/sourceInventory.ts`;
    put(root, path, readFileSync(join(repository, path), "utf8"));
    put(root, `${ARENA}/src/challenge/config.ts`, "export const canonical = JSON.stringify;\n");
    expect(collectSourceInventory(root).audit.auditedFiles).toContain(path);
  });
  it("enumerates deterministic disjoint complete partitions, pins itself, and hashes explicit records", () => {
    const root = fixture();
    const inventory = collectSourceInventory(root);
    expect(collectSourceInventory(root)).toEqual(inventory);
    expect(inventory.version).toBe("challenge-source-inventory-v2");
    expect(inventory.policyVersion).toBe("challenge-source-policy-v2");
    expect(inventory.files.map((file) => file.path)).toEqual(inventory.files.map((file) => file.path).sort());
    expect(inventory.groups["verification-tooling"].some((file) => file.path.endsWith("/sourceInventory.ts"))).toBe(true);
    expect(inventory.files.some((file) => file.path.includes("__tests__"))).toBe(false);
    expect(inventory.groups["verification-tooling"].some((file) => file.path.endsWith("/infra.test.mjs"))).toBe(true);
    expect(inventory.audit.auditedFiles.some((path) => path.endsWith("/infra.test.mjs"))).toBe(true);
    expect(new Set(Object.values(inventory.groups).flat().map((file) => file.path)).size).toBe(inventory.files.length);
    expect(Object.keys(inventory.groups)).toEqual([...SOURCE_PARTITIONS]);
    for (const partition of SOURCE_PARTITIONS) expect(inventory.partitionSha256[partition]).toBe(sha256(canonical(inventory.groups[partition])));
    expect(inventory.runtimeConfigurationSha256).toBe(sha256(canonical(inventory.runtime)));
    expect(inventory.inventorySha256).toBe(sha256(canonical({ version: inventory.version, policyVersion: inventory.policyVersion,
      roots: inventory.roots, entrypoints: inventory.entrypoints, files: inventory.files, groups: inventory.groups })));
    expect(inventory.runtime.find((file) => file.path === ".npmrc")).toEqual({ path: ".npmrc", present: false, sha256: null });
  });

  it.each(["edit", "add", "delete", "rename"])("changes execution and inventory pins on a seeds.ts %s", (mutation) => {
    const root = fixture();
    const before = collectSourceInventory(root);
    const seed = `${CORE}/src/seeds.ts`;
    if (mutation === "edit") put(root, seed, "export const seed = 42;\n");
    if (mutation === "add") put(root, `${CORE}/src/new-seeds.ts`, "export {};\n");
    if (mutation === "delete") rmSync(join(root, seed));
    if (mutation === "rename") renameSync(join(root, seed), join(root, `${CORE}/src/renamed-seeds.ts`));
    const after = collectSourceInventory(root);
    expect(after.partitionSha256["core-rules"]).not.toBe(before.partitionSha256["core-rules"]);
    expect(after.inventorySha256).not.toBe(before.inventorySha256);
    expect(after.partitionSha256["arena-authorized"]).toBe(before.partitionSha256["arena-authorized"]);
    expect(after.partitionSha256["verification-tooling"]).toBe(before.partitionSha256["verification-tooling"]);
    expect(after.runtimeConfigurationSha256).toBe(before.runtimeConfigurationSha256);
  });

  it.each([
    ["verification-tooling", `${ARENA}/src/challengeContract/codec.ts`],
    ["verification-tooling", "scripts/unused.ts"],
    ["verification-tooling", `${ARENA}/hermetic/infra.test.mjs`],
    ["verification-tooling", `${ARENA}/hermetic/probe.mjs`],
    ["verification-tooling", `${ARENA}/hermetic/workspace-policy.mjs`],
    ["verification-tooling", `${ARENA}/hermetic/verification-plan.mjs`],
    ["verification-tooling", `${ARENA}/hermetic/public-closure.mjs`],
    ["verification-tooling", "scripts/r2-composition-evidence.ts"],
    ["verification-tooling", "scripts/__tests__/diagnostic.ts"],
    ["core-rules", `${CORE}/src/data.bin`],
    ["arena-authorized", `${ARENA}/src/observations.ts`],
    ["training-model", `${TRAINING}/src/candidates.ts`],
    ["training-coordinator", `${TRAINING}/src/coordinator/unused.ts`],
  ] as const)("pins all %s artifact bytes at %s", (partition, path) => {
    const root = fixture();
    const before = collectSourceInventory(root);
    put(root, path, path.endsWith(".bin") ? "binary asset" : "export const changed = true;\n");
    const after = collectSourceInventory(root);
    expect(after.partitionSha256[partition]).not.toBe(before.partitionSha256[partition]);
    if (partition !== "core-rules") expect(after.partitionSha256["core-rules"]).toBe(before.partitionSha256["core-rules"]);
  });

  it.each(["pnpm-lock.yaml", `${CORE}/package.json`, `${TRAINING}/package.json`, `${TRAINING}/tsconfig.json`, `${TRAINING}/vitest.config.ts`, `${ARENA}/tsconfig.json`, ".npmrc", ".pnpmfile.cjs", "pnpmfile.cjs", `${ARENA}/hermetic/pins.json`])("pins runtime input or explicit absence: %s", (path) => {
    const root = fixture();
    const before = collectSourceInventory(root);
    const original = before.runtime.find((file) => file.path === path)!;
    put(root, path, original.present ? `${readFileSync(join(root, path), "utf8")}\n` : "captured override\n");
    const after = collectSourceInventory(root);
    expect(after.runtimeConfigurationSha256).not.toBe(before.runtimeConfigurationSha256);
    expect(after.runtime.find((file) => file.path === path)?.present).toBe(true);
    for (const partition of SOURCE_PARTITIONS.filter((partition) => partition !== "verification-tooling")) expect(after.partitionSha256[partition]).toBe(before.partitionSha256[partition]);
  });

  it("captures recursive JSONC tsconfig extends and rejects escapes, cycles, and unresolved bases", () => {
    const root = fixture();
    put(root, `${CORE}/tsconfig.json`, '{ "extends": "../../config/base" }');
    put(root, "config/base.json", '{ // config\n "extends": "./strict.json" }');
    put(root, "config/strict.json", '{ "compilerOptions": { "strict": true } }');
    const before = collectSourceInventory(root);
    expect(before.runtime.some((file) => file.path === "config/strict.json")).toBe(true);
    put(root, "config/strict.json", '{ "compilerOptions": { "strict": false } }');
    expect(collectSourceInventory(root).runtimeConfigurationSha256).not.toBe(before.runtimeConfigurationSha256);
    put(root, "config/strict.json", '{ "extends": "./base.json" }');
    expect(() => collectSourceInventory(root)).toThrow("Cyclic tsconfig");
    put(root, "config/strict.json", '{ "extends": "./absent" }');
    expect(() => collectSourceInventory(root)).toThrow("Missing or ambiguous tsconfig");
    put(root, "config/strict.json", '{ "extends": "../../../../outside.json" }');
    expect(() => collectSourceInventory(root)).toThrow("Unsafe inventory path");
    put(root, "config/strict.json", '{ "extends": "@external/tsconfig" }');
    expect(() => collectSourceInventory(root)).toThrow("Unsafe tsconfig");
  });

  it.each([`${CORE}/src`, `${CORE}/src/symlink.ts`, `${ARENA}/src/__tests__/symlink.ts`, "pnpm-lock.yaml"])("fails closed on symlinks at %s", (path) => {
    const root = fixture();
    rmSync(join(root, path), { recursive: true, force: true });
    symlinkSync(join(root, `${ARENA}/src/challenge/worker.ts`), join(root, path));
    expect(() => collectSourceInventory(root)).toThrow("Symlink");
  });

  it("audits static, type, dynamic, require, import-type, workspace exports and explicit MJS/JS imports", () => {
    const root = fixture();
    put(root, `${CORE}/src/value.ts`, "export type Value = number;\n");
    put(root, `${CORE}/src/nested/index.ts`, "export {};\n");
    put(root, `${CORE}/src/module.mjs`, "export {};\n");
    put(root, `${CORE}/src/module.js`, "export {};\n");
    put(root, `${CORE}/src/index.ts`, 'import type { Value } from "./value";\nexport type { Value } from "./value";\nimport "./nested";\nrequire("./module.mjs");\nimport mjs = require("./module.mjs");\ntype Ref = import("./value").Value;\nimport "./module.js";\nimport "fflate";\n');
    put(root, `${ARENA}/src/challenge/worker.ts`, 'import "fs"; import "node:test"; import("./supervisor");');
    const inventory = collectSourceInventory(root);
    expect(new Set(inventory.audit.edges.map((edge) => edge.kind))).toEqual(new Set(["import", "export", "dynamic", "require", "import-type", "resolve", "worker"]));
    expect(inventory.audit.edges.some((edge) => edge.specifier === "@chess-coach/starchess-core" && edge.target === `${CORE}/src/index.ts`)).toBe(true);
    expect(inventory.audit.edges.some((edge) => edge.specifier === "fflate" && edge.targetKind === "external")).toBe(true);
    expect(inventory.audit.edges.some((edge) => edge.target.endsWith("/nested/index.ts"))).toBe(true);
  });

  it.each([
    ['import "undeclared-dependency";', "Undeclared external"],
    ['import "node:nonexistent-builtin";', "Undeclared external"],
    ['import "./absent";', "Missing or ambiguous import"],
    ['import "./__tests__/hidden";', "Import into excluded tests"],
    ['import "../raw-code.ts";', "Unclassified import target"],
    ['import(variable);', "Computed module loader"],
    ['require(variable);', "Computed module loader"],
    ['require.resolve(variable);', "Computed module loader"],
    ['require["resolve"](variable);', "Computed module loader"],
    ['module.require(variable);', "Computed module loader"],
    ['const load = require; load(variable);', "Computed module loader"],
    ['(0, require)(variable);', "Computed module loader"],
    ['import * as mod from "node:module"; const load = mod.createRequire(import.meta.url); load(variable);', "Computed module loader"],
    ['import { createRequire } from "node:module"; createRequire(import.meta.url)(variable);', "Computed module loader"],
    ['import { createRequire } from "node:module"; const load = createRequire(import.meta.url); load(variable);', "Computed module loader"],
    ['import { createRequire } from "node:module"; Reflect.apply(createRequire(import.meta.url), null, [variable]);', "Unsupported loader escape"],
    ['import * as mod from "node:module"; const { "createRequire": make } = mod; const load = make(import.meta.url); load("../challengeContract/codec");', "Unsupported loader destructuring"],
    ['import nodeModule from "node:module";\nconst load = nodeModule.createRequire(import.meta.url);\nload(variable);', "Computed module loader"],
    ['import * as nodeModule from "node:module";\nconst alias = nodeModule;\nalias.createRequire(import.meta.url)(variable);', "Computed module loader"],
    ['require("./helper.txt");', "Unaudited executable extension"],
    ['import nodeModule from "node:module";\n(nodeModule.createRequire)(import.meta.url)("./helper.txt");', "Unaudited executable extension"],
    ['import nodeModule from "node:module";\nconst key = "createRequire";\nnodeModule[key](import.meta.url)("./helper.txt");', "Unaudited executable extension"],
    ['import("node:module");', "Unsupported dynamic module import"],
  ])("rejects unauditable or excluded module edge %s", (code, message) => {
    const root = fixture();
    put(root, `${CORE}/src/__tests__/hidden.ts`, "export {};\n");
    put(root, `${CORE}/raw-code.ts`, "export {};\n");
    if (code.includes('"node:module"')) put(root, `${ARENA}/src/challenge/worker.ts`, code);
    else put(root, `${CORE}/src/index.ts`, code);
    expect(() => collectSourceInventory(root)).toThrow(message);
  });

  it("requires declared dependencies in the importer's pinned manifest", () => {
    const root = fixture();
    put(root, `${CORE}/src/index.ts`, 'import "tsx";');
    expect(() => collectSourceInventory(root)).toThrow("Undeclared external");
    const manifest: unknown = JSON.parse(readFileSync(join(root, `${CORE}/package.json`), "utf8"));
    put(root, `${CORE}/package.json`, JSON.stringify({ ...manifest as Record<string, unknown>, dependencies: { tsx: "4.19.5" } }));
    expect(collectSourceInventory(root).audit.edges.some((edge) => edge.specifier === "tsx")).toBe(true);
  });

  it("rejects ambiguous relative resolution and unsupported workspace export maps", () => {
    const root = fixture();
    put(root, `${CORE}/src/index.ts`, 'import "./seeds";');
    put(root, `${CORE}/src/seeds/index.ts`, "export {};\n");
    expect(() => collectSourceInventory(root)).toThrow("Missing or ambiguous import");
    rmSync(join(root, `${CORE}/src/seeds/index.ts`));
    put(root, `${CORE}/package.json`, JSON.stringify({ name: "@chess-coach/starchess-core", exports: { ".": { require: "./src/index.ts" } } }));
    expect(() => collectSourceInventory(root)).toThrow("Unsupported workspace export");
  });

  it.each([
    [`${ARENA}/src/challenge/worker.ts`, "../challengeContract/codec"],
    [`${ARENA}/src/challenge/worker.ts`, "../../../../scripts/challenge-contract-evidence"],
    [`${ARENA}/src/challengeContract/codec.ts`, "../../../../scripts/challenge-contract-evidence"],
  ])("rejects forbidden partition edges from %s", (path, target) => {
    const root = fixture();
    put(root, path, `import "${target}";\n`);
    expect(() => collectSourceInventory(root)).toThrow("Forbidden partition edge");
  });

  it("allows contracts to use execution and contracts, and diagnostics to use every partition", () => {
    const root = fixture();
    put(root, `${ARENA}/src/challengeContract/codec.ts`, 'import "../challenge/worker";\nimport "./other";');
    put(root, `${ARENA}/src/challengeContract/other.ts`, "export {};\n");
    put(root, "scripts/challenge-contract-evidence.ts", `import "../${ARENA}/src/challengeContract/codec";\nimport "../${ARENA}/src/challenge/worker";\nimport "../${ARENA}/hermetic/run.mjs";`);
    expect(collectSourceInventory(root).audit.passed).toBe(true);
  });

  it("requires every production entrypoint and inventory root", () => {
    const root = fixture();
    rmSync(join(root, "scripts/challenge-contract-evidence.ts"));
    expect(() => collectSourceInventory(root)).toThrow("Missing inventory entrypoint");
    rmSync(join(root, "scripts"), { recursive: true });
    expect(() => collectSourceInventory(root)).toThrow();
  });

  it("rejects an optional configuration directory rather than recording it as absent", () => {
    const root = fixture();
    mkdirSync(join(root, ".npmrc"));
    expect(() => collectSourceInventory(root)).toThrow("Non-file runtime configuration");
  });

  it("audits the exact locked hermetic closure loader and rejects changed computed loaders", () => {
    const root = fixture();
    const closure = "import {createRequire} from 'node:module';\nconst require = createRequire(import.meta.url);\nconst esbuild = require(require.resolve('esbuild', { paths: [require.resolve('tsx/package.json')] }));\n";
    put(root, `${ARENA}/hermetic/closure.mjs`, closure);
    expect(collectSourceInventory(root).audit.edges.some((edge) => edge.importer.endsWith("closure.mjs") && edge.specifier === "esbuild")).toBe(true);
    put(root, `${ARENA}/hermetic/closure.mjs`, closure.replace("require(require.resolve('esbuild', { paths: [require.resolve('tsx/package.json')] }))", "require(process.env.MODULE)"));
    expect(() => collectSourceInventory(root)).toThrow("Computed module loader");
  });

  it("keeps historical v1 literals and partition meanings distinct", () => {
    const historical: Pick<SourceInventoryV1, "version" | "policyVersion" | "files"> = {
      version: "challenge-source-inventory-v1", policyVersion: "challenge-source-policy-v1",
      files: [{ path: `${CORE}/src/index.ts`, sha256: "0".repeat(64), partition: "execution" }],
    };
    expect(historical.files[0]!.partition).toBe("execution");
    expect(collectSourceInventory(fixture()).version).not.toBe(historical.version);
  });

  it("audits the real repository graph with declared root tooling in an isolated fixture", () => {
    const root = fixture();
    for (const path of [`${CORE}/src`, `${ARENA}/src`, `${TRAINING}/src`, "scripts", `${ARENA}/hermetic`]) cpSync(join(repository, path), join(root, path), { recursive: true });
    for (const owner of [CORE, ARENA, TRAINING]) put(root, `${owner}/package.json`, readFileSync(join(repository, owner, "package.json"), "utf8"));
    const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    put(root, "package.json", JSON.stringify({ ...manifest, devDependencies: { ...manifest.devDependencies, typescript: "~5.9.3" } }));
    const inventory = collectSourceInventory(root);
    expect(inventory.audit.passed).toBe(true);
    expect(inventory.audit.edges).toContainEqual(expect.objectContaining({ importer: `${ARENA}/hermetic/public-closure.mjs`, specifier: "typescript", targetKind: "external" }));
    expect(inventory.audit.edges).toContainEqual(expect.objectContaining({ importer: "scripts/check-public-closure.mjs", target: `${ARENA}/hermetic/public-closure.mjs`, targetKind: "source" }));
    expect(inventory.audit.edges).toContainEqual(expect.objectContaining({ importer: "scripts/r2-composition-evidence.ts", target: `${TRAINING}/src/candidates.ts`, targetKind: "source" }));
    expect(inventory.groups["verification-tooling"].some((file) => file.path === "scripts/check-public-closure.mjs")).toBe(true);
  }, 120000);

  it.each([
    ['import "@chess-coach/starchess-arena";', "Forbidden partition edge"],
    ['import "./coordinator/run";', "Forbidden partition edge"],
    ['import "node:crypto";', "Forbidden builtin edge"],
    ['import type {Stats} from "node:fs";', "Forbidden builtin edge"],
    ['import "../../starchess-core/src/seeds";', "Forbidden deep private edge"],
    ['import "@chess-coach/starchess-arena/src/challenge/baseline";', "Unsupported workspace export"],
    ['void process.env;', "Forbidden process access"],
  ])("rejects model host, builtin and private links: %s", (code, message) => {
    const root = fixture();
    put(root, `${TRAINING}/src/coordinator/run.ts`, "export {};\n");
    put(root, `${TRAINING}/src/candidates.ts`, code);
    expect(() => collectSourceInventory(root)).toThrow(message);
  });

  it("allows model public seams and coordinator host edges without widening pure partitions", () => {
    const root = fixture();
    put(root, `${TRAINING}/src/candidates.ts`, 'import "@chess-coach/starchess-arena/observations"; import "@chess-coach/starchess-arena/intent-codec-v1"; import "@noble/hashes/sha2.js";');
    put(root, `${TRAINING}/src/coordinator/run.ts`, 'import "@chess-coach/starchess-arena"; import "node:fs"; import "../candidates";');
    const inventory = collectSourceInventory(root);
    expect(inventory.groups["training-model"].map((file) => file.path)).toEqual([`${TRAINING}/src/candidates.ts`]);
    expect(inventory.entrypoints).toEqual(expect.arrayContaining([`${TRAINING}/src/candidates.ts`, `${ARENA}/src/observations.ts`, `${ARENA}/src/intent-codec-v1.ts`]));
    expect(inventory.audit.edges).toContainEqual(expect.objectContaining({ importer: `${TRAINING}/src/candidates.ts`, specifier: "@noble/hashes/sha2.js", targetKind: "external" }));
  });

  it.each([
    [`${CORE}/src/index.ts`, "./seeds"],
    [`${ARENA}/src/observations.ts`, "./intent-codec-v1"],
    [`${TRAINING}/src/candidates.ts`, "./domain"],
  ])("rejects literal dynamic loading from a pure partition: %s", (path, target) => {
    const root = fixture();
    put(root, `${TRAINING}/src/domain.ts`, "export {};\n");
    put(root, path!, `import(${JSON.stringify(target)});`);
    expect(() => collectSourceInventory(root)).toThrow("Forbidden dynamic import edge");
  });

  it("allows only the reviewed descriptor-safe DTO function and retains the indexed array seam", () => {
    const root = fixture();
    const path = `${ARENA}/src/challengeContract/validation.ts`;
    put(root, path, readFileSync(join(repository, path), "utf8"));
    expect(collectSourceInventory(root).audit.auditedFiles).toContain(path);
    put(root, path, `${readFileSync(join(repository, path), "utf8")}\nObject.getPrototypeOf(() => {});`);
    expect(() => collectSourceInventory(root)).toThrow("Unsupported code constructor acquisition");
  });

  it.each([
    ['typeof input === "function" || typeof input === "symbol"', 'typeof input === "symbol"'],
    ['Object.getPrototypeOf(input)', 'Object.getPrototypeOf(() => {})'],
    ['Object.getOwnPropertyDescriptors(input)', 'Object.getOwnPropertyDescriptors(Object)'],
    ['visit(descriptor.value,', 'visit(descriptor.value.constructor,'],
    ['depth > 16 || ++state.visits > 8192', 'depth > 26 || ++state.visits > 81920'],
    ['if (state.ancestors.has(input)) fail(at);', 'if (false) fail(at);'],
    ['if (state.textbytes > MAX_CODEC_BYTES) fail(at, "SIZE");', 'if (false) fail(at, "SIZE");'],
    ['throw new ContractError(path, code);', 'return value as never;'],
  ])("rejects changes to the descriptor seam: %s", (before, after) => {
    const root = fixture();
    const path = `${ARENA}/src/challengeContract/validation.ts`;
    const original = readFileSync(join(repository, path), "utf8");
    expect(original).toContain(before);
    put(root, path, original.replace(before, after));
    expect(() => collectSourceInventory(root)).toThrow("Unsupported code constructor acquisition");
  });
});

describe("static browser public closure", () => {
  const check = async (root: string) => {
    const script = pathToFileURL(join(repository, "scripts/check-public-closure.mjs")).href;
    const { checkPublicClosure } = await import(/* @vite-ignore */ script);
    return checkPublicClosure(root);
  };

  it("preserves public host-global rejection after data-type inference", async () => {
    const root = fixture();
    put(root, `${CORE}/src/index.ts`, 'function access(array: any, index: number) {void array[index];} Function("return process")();');
    await expect(check(root)).rejects.toThrow("Host global in public closure");
  });

  it.each(unprovenComputedReceivers)("rejects public unproven call-derived or mutated receivers: %s", async (code) => {
    const root = fixture();
    put(root, `${CORE}/src/index.ts`, code);
    await expect(check(root)).rejects.toThrow("Code constructor acquisition in public closure");
  });
  it.each(ordinaryComputedData)("allows ordinary public call-derived and mutated data indexing: %s", async (code) => {
    const root = fixture();
    put(root, `${CORE}/src/index.ts`, code);
    expect((await check(root)).passed).toBe(true);
  });

  it.each(arrayMemberConstructors)("rejects public numeric array function constructor acquisition: %s", async (code) => {
    const root = fixture();
    put(root, `${CORE}/src/index.ts`, code);
    await expect(check(root)).rejects.toThrow("Code constructor acquisition in public closure");
  });
  it.each(dataArrayAccesses)("allows ordinary public data array indexing: %s", async (code) => {
    const root = fixture();
    put(root, `${CORE}/src/index.ts`, code);
    expect((await check(root)).passed).toBe(true);
  });

  it.each(ownMemberConstructors)("rejects computed constructors on own public function members: %s", async (code) => {
    const root = fixture();
    put(root, `${CORE}/src/index.ts`, code);
    await expect(check(root)).rejects.toThrow("Code constructor acquisition in public closure");
  });
  it("allows computed public data indexing and the reviewed DTO descriptors", async () => {
    const root = fixture();
    put(root, `${CORE}/src/index.ts`, 'const box: any = {f: () => {}, data: {w: 1, b: 2}}; const alias = box.data; void alias[key];');
    const path = `${ARENA}/src/challengeContract/validation.ts`;
    put(root, path, readFileSync(join(repository, path), "utf8"));
    put(root, `${ARENA}/src/observations.ts`, 'export {inspectDto} from "./challengeContract/validation";');
    expect((await check(root)).verifiedPaths).toContain(path);
  });

  it.each([
    ['depth > 16 || ++state.visits > 8192', 'depth > 26 || ++state.visits > 81920'],
    ['throw new ContractError(path, code);', 'return value as never;'],
  ])("rejects a changed public DTO seam: %s", async (before, after) => {
    const root = fixture();
    const path = `${ARENA}/src/challengeContract/validation.ts`;
    const original = readFileSync(join(repository, path), "utf8");
    expect(original).toContain(before);
    put(root, path, original.replace(before, after));
    put(root, `${ARENA}/src/observations.ts`, 'export {inspectDto} from "./challengeContract/validation";');
    await expect(check(root)).rejects.toThrow("Code constructor acquisition in public closure");
  });

  it("traverses actual conditional exports and pins source and manifest bytes", async () => {
    const root = fixture();
    put(root, `${TRAINING}/src/candidates.ts`, 'import "@chess-coach/starchess-arena/observations";');
    put(root, `${ARENA}/src/observations.ts`, 'export * from "./authorized/v1/types";');
    put(root, `${ARENA}/src/authorized/v1/types.ts`, "export type Observation = number;");
    const first = await check(root);
    expect(first.passed).toBe(true);
    expect(first.entries).toHaveLength(4);
    expect(first.verifiedPaths).toContain(`${ARENA}/src/authorized/v1/types.ts`);
    expect(await check(root)).toEqual(first);
    put(root, `${ARENA}/src/authorized/v1/types.ts`, "export type Observation = string;");
    expect((await check(root)).sourceSha256).not.toBe(first.sourceSha256);
    put(root, `${CORE}/package.json`, JSON.stringify({ name: "@chess-coach/starchess-core", exports: { ".": {
      node: "./src/index.ts", browser: { import: "./src/index.ts" }, default: "./src/index.ts",
    } } }));
    expect((await check(root)).entries[0].path).toBe(`${CORE}/src/index.ts`);
  });

  it.each([
    [CORE, ".", "./src/index.ts"],
    [ARENA, ".", "./src/index.ts"],
    [ARENA, "./observations", "./src/observations.ts"],
    [ARENA, "./intent-codec-v1", "./src/intent-codec-v1.ts"],
    [TRAINING, "./candidates", "./src/candidates.ts"],
  ])("rejects node and default alternatives for every canonical workspace export: %s %s", async (owner, subpath, target) => {
    const root = fixture();
    const path = `${owner}/package.json`;
    const manifest = JSON.parse(readFileSync(join(root, path), "utf8"));
    put(root, `${owner}/outside.mjs`, 'import "node:fs";');
    put(root, `${owner}/src/host.ts`, 'import "node:fs";');
    for (const condition of ["node", "default"]) {
      for (const alternative of ["./outside.mjs", "./src/host.ts"]) {
        manifest.exports[subpath!] = { browser: { import: target }, [condition]: alternative };
        put(root, path, JSON.stringify(manifest));
        await expect(check(root)).rejects.toThrow(`Unapproved public export map: ${owner}`);
      }
    }
  });

  it.each([
    "./src/*.ts", "./src/../outside.mjs", "../outside.mjs", "/outside.mjs", "./src\\index.ts", "./src//index.ts",
    null, ["./src/index.ts"], {}, { browser: "./src/index.ts", node: { default: "./outside.mjs" } },
  ])("rejects wildcard, unsafe and unsupported workspace targets in unselected branches: %j", async (target) => {
    const root = fixture();
    put(root, `${CORE}/package.json`, JSON.stringify({ name: "@chess-coach/starchess-core", exports: {
      ".": { browser: "./src/index.ts", default: target },
    } }));
    await expect(check(root)).rejects.toThrow(`Unapproved public export map: ${CORE}`);
  });

  it.each([
    ['import "@chess-coach/starchess-arena";', /Host\/baseline/],
    ['import "@chess-coach/starchess-arena/src/challenge/baseline";', /Unexported private/],
    ['import "../../starchess-core/src/seeds";', /Deep private/],
    ['import "node:fs";', /Node builtin/],
    ['import "node:crypto";', /Node builtin/],
    ['void process.getBuiltinModule("crypto").randomBytes(4);', /Host global|Host acquisition/],
    ['import(variable);', /Dynamic import/],
    ['import("./composition");', /Dynamic import/],
    ['export type { Hidden } from "./coordinator/run";', /Coordinator/],
  ])("rejects an actual public graph edge without tree-shaking: %s", async (code, message) => {
    const root = fixture();
    put(root, `${TRAINING}/src/composition.ts`, "export {};\n");
    put(root, `${TRAINING}/src/coordinator/run.ts`, "export type Hidden = string;");
    put(root, `${TRAINING}/src/candidates.ts`, code);
    await expect(check(root)).rejects.toThrow(message);
  });

  it.each([
    [TRAINING, "."],
    [TRAINING, "./composition"],
    [TRAINING, "./*"],
    [ARENA, "./challenge"],
    [CORE, "./private"],
  ])("rejects an unapproved export even when public entries do not import it: %s %s", async (owner, subpath) => {
    const root = fixture();
    const path = `${owner}/package.json`;
    const manifest = JSON.parse(readFileSync(join(root, path), "utf8"));
    manifest.exports[subpath!] = "./src/index.ts";
    put(root, path, JSON.stringify(manifest));
    await expect(check(root)).rejects.toThrow(`Unapproved public export map: ${owner}`);
  });

  it("pins external browser ESM and SHA transitive files instead of Node export branches", async () => {
    const root = fixture();
    put(root, `${CORE}/src/index.ts`, 'import "fflate";');
    put(root, `${TRAINING}/src/candidates.ts`, 'import "@noble/hashes/sha2.js";');
    for (const [owner, name] of [[CORE, "fflate"], [TRAINING, "@noble/hashes"]]) {
      const source = join(repository, owner!, "node_modules", name!);
      const target = join(root, owner!, "node_modules", name!);
      mkdirSync(dirname(target), { recursive: true });
      symlinkSync(source, target);
    }
    const report = await check(root);
    expect(report.dependencyFiles.map((file: {path: string}) => file.path)).toEqual(expect.arrayContaining([
      "fflate@0.8.3/esm/browser.js", "@noble/hashes@2.4.0/sha2.js", "@noble/hashes@2.4.0/_md.js", "@noble/hashes@2.4.0/_u64.js", "@noble/hashes@2.4.0/utils.js",
    ]));
    expect(report.dependencyFiles.every((file: {sha256: string}) => /^[0-9a-f]{64}$/.test(file.sha256))).toBe(true);
    expect(report.edges.some((edge: {specifier: string}) => edge.specifier.startsWith("node:"))).toBe(false);
  });
});
