// SPEC: _spec/packages/starchess-arena/invocation-effect-analysis.puml
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { afterEach, describe, expect, it } from "vitest";
import { collectSourceInventory } from "../challenge/sourceInventory";

const repository = fileURLToPath(new URL("../../../../", import.meta.url));
const CORE = "packages/starchess-core";
const ARENA = "packages/starchess-arena";
const TRAINING = "packages/starchess-training";
const temporary: string[] = [];
const put = (root: string, path: string, text: string): void => {
  mkdirSync(dirname(join(root, path)), {recursive: true}); writeFileSync(join(root, path), text);
};
const declaration = (path: string, name: string): string => {
  const source = ts.createSourceFile(path, readFileSync(join(repository, path), "utf8"), ts.ScriptTarget.Latest, true);
  const statement = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === name ||
    ts.isVariableStatement(node) && node.declarationList.declarations.some(entry => ts.isIdentifier(entry.name) && entry.name.text === name));
  if (!statement) throw new Error(`Missing actual declaration: ${path} ${name}`);
  return statement.getText(source);
};
const fixture = (source: string, reader = 'export function decode(value: unknown): string { if (typeof value !== "string") throw new Error("string"); return value; }', bridge = 'export {decode as read} from "./reader";'): string => {
  const root = mkdtempSync(join(realpathSync(tmpdir()), "inventory-callback-grounding-")); temporary.push(root);
  put(root, "package.json", '{"private":true}'); put(root, "pnpm-workspace.yaml", "packages: [packages/*]\n"); put(root, "pnpm-lock.yaml", "lockfileVersion: '9.0'\n");
  for (const [owner, name, exports] of [
    [CORE, "@chess-coach/starchess-core", {".": "./src/index.ts", "./planning-v1": "./src/planning-v1.ts"}],
    [ARENA, "@chess-coach/starchess-arena", {".": "./src/index.ts", "./observations": "./src/observations.ts", "./events": "./src/events.ts", "./intent-codec-v1": "./src/intent-codec-v1.ts"}],
    [TRAINING, "@chess-coach/starchess-training", {"./candidates": "./src/candidates.ts"}],
  ] as const) {
    put(root, `${owner}/package.json`, JSON.stringify({name, exports, dependencies: {"@chess-coach/starchess-core": "workspace:*", "@chess-coach/starchess-arena": "workspace:*"}}));
    put(root, `${owner}/tsconfig.json`, "{}");
    for (const target of Object.values(exports)) put(root, `${owner}/${target.slice(2)}`, "export {};\n");
  }
  for (const path of [`${ARENA}/src/cli/challenge.ts`, `${ARENA}/src/challenge/worker.ts`, "scripts/challenge-contract-evidence.ts", `${ARENA}/hermetic/run.mjs`, `${ARENA}/hermetic/runtime.mjs`]) put(root, path, "export {};\n");
  put(root, `${ARENA}/hermetic/pins.json`, "{}");
  if (source.includes('import {array}')) {
    const validation = `${ARENA}/src/challengeContract/validation.ts`;
    put(root, validation, `${declaration(validation, "ContractError")}\n${declaration(validation, "fail")}`);
    const schema = `${ARENA}/src/authorized/v2/schema.ts`;
    put(root, schema, `import {fail} from "../../challengeContract/validation";\n${["array", "integer", "id"].map(name => declaration(schema, name)).join("\n")}`);
    put(root, `${ARENA}/src/observations.ts`, 'export {array, id} from "./authorized/v2/schema";');
  }
  put(root, `${TRAINING}/src/reader.ts`, reader);
  put(root, `${TRAINING}/src/bridge.ts`, bridge);
  put(root, `${TRAINING}/src/candidates.ts`, `function consume(value: unknown) { void value; }\n${source}`);
  return root;
};
afterEach(() => { for (const root of temporary.splice(0)) rmSync(root, {recursive: true, force: true}); });
const imported = `import {array} from "@chess-coach/starchess-arena/observations"; import {read} from "./bridge";
  const values = array(externalInput, "$", 16, value => read(value));
  const created = values.filter(value => value.includes(":created:"));
  consume(values.some(value => value.includes(":created:") && !created.includes(value)));`;
const effect = (callback: string): string => `const data = {key: 1}; const values = [0, 1]; const bags = [data];
  bags.some(${callback}); consume(values[data.key]);`;

describe("source inventory actual callback value grounding", () => {
  it("grounds the unchanged R3 reader and its physical throwing failure path", () => {
    const reader = 'import {id} from "@chess-coach/starchess-arena/observations"; export const decode = (value: unknown): string => id(value, "$", "w", "unit");';
    expect(collectSourceInventory(fixture(imported, reader)).audit.passed).toBe(true);
  });
  it("grounds imported guarded normal returns through an actual fresh-array collector", () => {
    expect(collectSourceInventory(fixture(imported)).audit.passed).toBe(true);
  });
  it("preserves actual runtime alias and reexport identities", () => {
    expect(collectSourceInventory(fixture(imported, undefined, 'import {decode as local} from "./reader"; const alias = local; export {alias as read};')).audit.passed).toBe(true);
  });
  it.each([
    'export function decode(value: unknown): string { return value as string; }',
    'export function decode(value: unknown): string { if (condition && typeof value !== "string") throw new Error("string"); return value as string; }',
    'export function decode(value: unknown): string { try { if (typeof value !== "string") throw new Error("string"); } catch {} return value as string; }',
    'function fail(): never { return undefined as never; } export function decode(value: unknown): string { if (typeof value !== "string") return fail(); return value; }',
  ])("rejects annotation or incomplete termination evidence: %s", reader => {
    expect(() => collectSourceInventory(fixture(imported, reader))).toThrow(/Unsupported (?:parameter mutation|code constructor acquisition)/);
  });
  it.each([false, true])("rejects a substituted runtime export in either branch order: %s", reverse => {
    const bridge = `import {decode} from "./reader"; const unsafe = (value: unknown): string => value as string; export const read = condition ? ${reverse ? "unsafe : decode" : "decode : unsafe"};`;
    expect(() => collectSourceInventory(fixture(imported, undefined, bridge))).toThrow(/Unsupported (?:parameter mutation|code constructor acquisition)/);
  });
  it.each([
    'const strings = ["a:created:", "b"]; const created = strings.filter(value => value.includes(":created:")); consume(strings.some(value => value.includes(":created:") && !created.includes(value)));',
    'const records = [{name: "b"}, {name: "a"}]; records.sort((left, right) => left.name.localeCompare(right.name)); consume(records[0].name);',
    'const strings = ["b", "a"]; strings.sort((left, right) => left.localeCompare(right)); consume(strings[0]);',
    'const strings = ["a"]; const aliases = strings.map(value => value); consume(aliases.every(value => value.includes("a")));',
    'const strings = ["a"]; const aliases = strings.flatMap(value => [value]); consume(aliases.some(value => value.includes("a")));',
    'const strings: string[] = []; consume(strings.some(value => value.includes("a")));',
  ])("retains genuine native frames and readonly effects: %s", source => {
    expect(collectSourceInventory(fixture(source)).audit.passed).toBe(true);
  });
  it("observes the callback writer at the unsafe operation while its readonly control passes", () => {
    expect(collectSourceInventory(fixture(effect('bag => { void bag.key; return false; }'))).audit.passed).toBe(true);
    expect(() => collectSourceInventory(fixture(effect('bag => { bag.key = "constructor" as any; return false; }')))).toThrow(/unproved array selector: values\[data.key\]/);
  });
  it.each([
    'const strings = ["a"]; strings.some = foreignMethod; consume(strings.some(value => value.includes("a")));',
    'const strings = ["a"]; Object.defineProperty(strings, "some", {get() { return foreignMethod; }}); consume(strings.some(value => value.includes("a")));',
    'Array.prototype.some = foreignMethod; const strings = ["a"]; consume(strings.some(value => value.includes("a")));',
    'String.prototype.includes = foreignMethod; const strings = ["a"]; consume(strings.some(value => value.includes("a")));',
    'String.prototype.localeCompare = foreignMethod; const strings = ["a"]; strings.sort((left, right) => left.localeCompare(right));',
    'const strings: string[] = ["a"]; strings[0] = foreignValue; consume(strings.some(value => value.includes("a")));',
    'const strings = [{get name(): string { return foreignValue; }}, {name: "a"}]; strings.sort((left, right) => left.name.localeCompare(right.name));',
    'const strings = [{includes: foreignMethod}] as unknown as string[]; consume(strings.some(value => value.includes("a")));',
    'const strings = ["a"]; strings.sort((left, right) => left.localeCompare(right, undefined, {get sensitivity() { return foreignValue; }}));',
  ])("rejects unproved dispatch, element provenance or coercion: %s", source => {
    expect(() => collectSourceInventory(fixture(source))).toThrow(/Unsupported (?:parameter mutation|code constructor acquisition)/);
  });
  it.each([false, true])("retains unknown receiver alternatives in either branch order: %s", reverse => {
    const source = `const strings = condition ? ${reverse ? 'foreignArray : ["a"]' : '["a"] : foreignArray'}; consume(strings.some(value => value.includes("a")));`;
    expect(() => collectSourceInventory(fixture(source))).toThrow(/Unsupported (?:parameter mutation|code constructor acquisition)/);
  });
});
