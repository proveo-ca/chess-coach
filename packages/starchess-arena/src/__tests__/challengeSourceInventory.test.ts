import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { canonical } from "../challenge/config";
import { sha256 } from "../challenge/corpus";
import { collectSourceInventory } from "../challenge/sourceInventory";

const CORE = "packages/starchess-core";
const ARENA = "packages/starchess-arena";
const repository = fileURLToPath(new URL("../../../../", import.meta.url));
const temporary: string[] = [];
afterEach(() => { for (const root of temporary.splice(0)) rmSync(root, { recursive: true, force: true }); });
const put = (root: string, path: string, value: string): void => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), value);
};
const fixture = (): string => {
  mkdirSync("/tmp/opencode", { recursive: true });
  const root = mkdtempSync("/tmp/opencode/challenge-source-inventory-");
  temporary.push(root);
  for (const path of ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", `${CORE}/package.json`, `${ARENA}/package.json`, `${CORE}/tsconfig.json`, `${ARENA}/tsconfig.json`, `${ARENA}/hermetic/pins.json`]) {
    put(root, path, readFileSync(join(repository, path), "utf8"));
  }
  for (const path of [`${CORE}/src/index.ts`, `${CORE}/src/seeds.ts`, `${ARENA}/src/challenge/worker.ts`, `${ARENA}/src/challenge/sourceInventory.ts`, `${ARENA}/src/challengeContract/codec.ts`]) put(root, path, "export {};\n");
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
    expect(() => collectSourceInventory(root)).toThrow(/Unsupported loader (escape|destructuring)/);
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
  it("enumerates deterministic disjoint complete partitions, pins itself, and hashes explicit records", () => {
    const root = fixture();
    const inventory = collectSourceInventory(root);
    expect(collectSourceInventory(root)).toEqual(inventory);
    expect(inventory.version).toBe("challenge-source-inventory-v1");
    expect(inventory.policyVersion).toBe("challenge-source-policy-v1");
    expect(inventory.files.map((file) => file.path)).toEqual(inventory.files.map((file) => file.path).sort());
    expect(inventory.groups.execution.some((file) => file.path.endsWith("/sourceInventory.ts"))).toBe(true);
    expect(inventory.files.some((file) => file.path.includes("__tests__"))).toBe(false);
    expect(inventory.groups.diagnostics.some((file) => file.path.endsWith("/infra.test.mjs"))).toBe(true);
    expect(inventory.audit.auditedFiles.some((path) => path.endsWith("/infra.test.mjs"))).toBe(true);
    expect(new Set(Object.values(inventory.groups).flat().map((file) => file.path)).size).toBe(inventory.files.length);
    expect(inventory.executionSha256).toBe(sha256(canonical(inventory.groups.execution)));
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
    expect(after.executionSha256).not.toBe(before.executionSha256);
    expect(after.inventorySha256).not.toBe(before.inventorySha256);
    expect(after.contractsSha256).toBe(before.contractsSha256);
    expect(after.diagnosticsSha256).toBe(before.diagnosticsSha256);
    expect(after.runtimeConfigurationSha256).toBe(before.runtimeConfigurationSha256);
  });

  it.each([
    ["contracts", `${ARENA}/src/challengeContract/codec.ts`],
    ["diagnostics", "scripts/unused.ts"],
    ["diagnostics", `${ARENA}/hermetic/infra.test.mjs`],
    ["diagnostics", `${ARENA}/hermetic/probe.mjs`],
    ["diagnostics", "scripts/__tests__/diagnostic.ts"],
    ["execution", `${CORE}/src/data.bin`],
  ] as const)("pins all %s artifact bytes at %s", (partition, path) => {
    const root = fixture();
    const before = collectSourceInventory(root);
    put(root, path, path.endsWith(".bin") ? "binary asset" : "export const changed = true;\n");
    const after = collectSourceInventory(root);
    expect(after[`${partition}Sha256`]).not.toBe(before[`${partition}Sha256`]);
    if (partition !== "execution") expect(after.executionSha256).toBe(before.executionSha256);
  });

  it.each(["pnpm-lock.yaml", `${CORE}/package.json`, `${ARENA}/tsconfig.json`, ".npmrc", ".pnpmfile.cjs", "pnpmfile.cjs", `${ARENA}/hermetic/pins.json`])("pins runtime input or explicit absence: %s", (path) => {
    const root = fixture();
    const before = collectSourceInventory(root);
    const original = before.runtime.find((file) => file.path === path)!;
    put(root, path, original.present ? `${readFileSync(join(root, path), "utf8")}\n` : "captured override\n");
    const after = collectSourceInventory(root);
    expect(after.runtimeConfigurationSha256).not.toBe(before.runtimeConfigurationSha256);
    expect(after.runtime.find((file) => file.path === path)?.present).toBe(true);
    expect(after.executionSha256).toBe(before.executionSha256);
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
    put(root, `${CORE}/src/index.ts`, 'import type { Value } from "./value";\nexport type { Value } from "./value";\nimport("./nested");\nrequire("./module.mjs");\nimport mjs = require("./module.mjs");\ntype Ref = import("./value").Value;\nimport "./module.js";\nimport "fflate";\nimport "fs";\nimport "node:test";\n');
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
    ['import nodeModule from "node:module";\nconst key = "createRequire";\nnodeModule[key](import.meta.url)("./helper.txt");', "Unsupported loader escape"],
    ['import("node:module");', "Unsupported dynamic module import"],
  ])("rejects unauditable or excluded module edge %s", (code, message) => {
    const root = fixture();
    put(root, `${CORE}/src/__tests__/hidden.ts`, "export {};\n");
    put(root, `${CORE}/raw-code.ts`, "export {};\n");
    put(root, `${CORE}/src/index.ts`, code);
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
    put(root, `${CORE}/package.json`, JSON.stringify({ name: "@chess-coach/starchess-core", exports: { ".": { import: "./src/index.ts" } } }));
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
    put(root, `${ARENA}/hermetic/closure.mjs`, readFileSync(join(repository, `${ARENA}/hermetic/closure.mjs`), "utf8"));
    expect(collectSourceInventory(root).audit.edges.some((edge) => edge.importer.endsWith("closure.mjs") && edge.specifier === "esbuild")).toBe(true);
    put(root, `${ARENA}/hermetic/closure.mjs`, readFileSync(join(repository, `${ARENA}/hermetic/closure.mjs`), "utf8").replace("require(require.resolve('esbuild', { paths: [require.resolve('tsx/package.json')] }))", "require(process.env.MODULE)"));
    expect(() => collectSourceInventory(root)).toThrow("Computed module loader");
  });
});
