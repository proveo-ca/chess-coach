// SPEC: _spec/runtime-protocol.puml
import { expect, test } from "bun:test";
import { mkdirSync, writeFileSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { repositoryScratch } from "../../packages/runtime/tests/repository-scratch";
import { inspectQualificationSource, prepareQualificationInputDocuments, prepareQualificationBindingManifest } from "./qualification-input-documents";

function fixture() {
  const root = repositoryScratch("qualification-source-inputs-");
  const put = (path: string, text: string) => { const absolute = join(root, path); mkdirSync(dirname(absolute), { recursive: true }); writeFileSync(absolute, text); };
  for (const name of ["contracts", "policy", "starchess-core"]) {
    put(`packages/${name}/package.json`, JSON.stringify({ name: `@chess-coach/${name}`, exports: { ".": "./src/index.ts", "./part/*": "./src/*.ts" } }));
    put(`packages/${name}/src/index.ts`, "export const value = 1;\n");
  }
  put("entry.ts", 'import "node:crypto"; import "zod"; import "@chess-coach/contracts"; import "./side"; export const n = 1;\n');
  put("side.ts", 'export {value} from "@chess-coach/policy";\n');
  return { root, put };
}

test("source inspection walks literal local/workspace imports without evaluating them", () => {
  const env = fixture(); env.put("packages/contracts/src/index.ts", 'throw new Error("MUST_NOT_EVALUATE");\n');
  const result = inspectQualificationSource(env.root, ["entry.ts"]);
  expect(result.fileCount).toBe(7); expect(result.externalDependencies).toEqual(["zod"]);
  expect(result.sourceCopiedOrEvaluated).toBe(false); expect(result.referenceDelivery).toContain("PENDING");
  expect(result.files.every(row => /^[a-f0-9]{64}$/.test(row.sha256))).toBe(true);
});
test("wildcard workspace exports resolve only their selected source member", () => {
  const env = fixture(); env.put("entry.ts", 'import "@chess-coach/starchess-core/part/rule";'); env.put("packages/starchess-core/src/rule.ts", "export const rule=1;");
  expect(inspectQualificationSource(env.root, ["entry.ts"]).files.some(row => row.path.endsWith("/rule.ts"))).toBe(true);
});
test("JSON imports remain byte-hashed inputs without evaluation", () => {
  const env = fixture(); env.put("entry.ts", 'import data from "./data.json";'); env.put("data.json", '{"value":1}\n');
  expect(inspectQualificationSource(env.root, ["entry.ts"]).files.some(row => row.path === "data.json" && row.byteLength === 12)).toBe(true);
});
test("source inspection rejects missing imports instead of claiming a closure", () => {
  const env = fixture(); env.put("entry.ts", 'import "./missing";'); expect(() => inspectQualificationSource(env.root, ["entry.ts"])).toThrow("MISSING_IMPORT");
});
test("source inspection rejects unexpected external packages without installation", () => {
  const env = fixture(); env.put("entry.ts", 'import "unexpected-package";'); expect(() => inspectQualificationSource(env.root, ["entry.ts"])).toThrow("UNEXPECTED_DEPENDENCY");
});
test("source inspection records captured-reference imports as separately pending payloads", () => {
  const env = fixture(); env.put("entry.ts", 'const captured=import("/app/reference/packages/starchess-core/src/index.ts");');
  expect(inspectQualificationSource(env.root, ["entry.ts"]).dynamicReferencePaths).toEqual(["/app/reference/packages/starchess-core/src/index.ts"]);
});
test("source inspection rejects a selected symlink rather than following an external tree", () => {
  const env = fixture(); symlinkSync("entry.ts", join(env.root, "alias.ts")); expect(() => inspectQualificationSource(env.root, ["alias.ts"])).toThrow("FILE");
});
test("source inspection rejects escaping entries and malformed workspace package metadata", () => {
  const env = fixture(); expect(() => inspectQualificationSource(env.root, ["../escape.ts"])).toThrow("IMPORT_PATH");
  env.put("packages/contracts/package.json", '{"name":"other","exports":{}}'); expect(() => inspectQualificationSource(env.root, ["entry.ts"])).toThrow("PACKAGE");
});

test("document preparation rejects unsafe generations before reading or writing payloads", () => {
  const env = fixture();
  for (const value of ["../outside", "source-0", "source-1000", "/absolute", "source-01"]) {
    expect(() => prepareQualificationInputDocuments(env.root, value)).toThrow("GENERATION");
    expect(() => prepareQualificationBindingManifest(env.root, value)).toThrow("GENERATION");
  }
});

test("source inspection hashes exact adapter bytes while parsing past its known shebang", () => {
  const env = fixture(), path = "artifacts/training-functional/qualification-policy-score.ts";
  const source = '#!/usr/local/bin/bun\n// SPEC: _spec/runtime-protocol.puml\nimport "node:os"; export const n=1;\n';
  env.put(path, source);
  const result = inspectQualificationSource(env.root, [path]);
  expect(result.files.find(row => row.path === path)?.byteLength).toBe(Buffer.byteLength(source));
  expect(result.fileCount).toBe(4);
});

test("source inspection does not generally remove arbitrary executable headers", () => {
  const env = fixture(); env.put("entry.ts", '#!/usr/local/bin/bun\nexport const n=1;\n');
  expect(() => inspectQualificationSource(env.root, ["entry.ts"])).toThrow();
});
