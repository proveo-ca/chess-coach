// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import { readFileSync, existsSync } from "node:fs";
import { createRequire, isBuiltin } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import * as observations from "../observations";
import * as events from "../events";
import { array, object, tag } from "../authorized/v2/schema";

const arena = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const core = resolve(arena, "../starchess-core");
const require = createRequire(import.meta.url);
const localTarget = (importer: string, specifier: string): string => {
  const base = resolve(dirname(importer), specifier);
  const candidates = [base, `${base}.ts`, join(base, "index.ts")].filter((path) => existsSync(path) && path.endsWith(".ts"));
  expect(candidates, `${importer} -> ${specifier}`).toHaveLength(1);
  return candidates[0]!;
};
const runtimeEdges = (path: string): string[] => {
  const emitted = ts.transpileModule(readFileSync(path, "utf8"), {
    fileName: path, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  const source = ts.createSourceFile(path, emitted, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const edges: string[] = [];
  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      expect(ts.isStringLiteral(node.moduleSpecifier)).toBe(true);
      edges.push((node.moduleSpecifier as ts.StringLiteral).text);
    }
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
      ts.isIdentifier(node.expression) && node.expression.text === "require")) {
      expect(node.arguments).toHaveLength(1);
      expect(ts.isStringLiteral(node.arguments[0]!)).toBe(true);
      edges.push((node.arguments[0] as ts.StringLiteral).text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return edges;
};

describe("public V1 bridge isolation", () => {
  it("publishes exactly the selected arena subpaths through real package resolution", () => {
    const manifest = JSON.parse(readFileSync(join(arena, "package.json"), "utf8"));
    expect(manifest.exports).toEqual({
      ".": "./src/index.ts", "./observations": "./src/observations.ts", "./intent-codec-v1": "./src/intent-codec-v1.ts", "./events": "./src/events.ts",
    });
    for (const subpath of ["observations", "intent-codec-v1", "events"]) {
      expect(require.resolve(`@chess-coach/starchess-arena/${subpath}`)).toBe(join(arena, "src", `${subpath}.ts`));
    }
    expect(Object.keys(observations).sort()).toEqual(["decodeObservation", "decodeObservationV1", "encodeObservation", "encodeObservationV1", "validateObservation", "validateObservationV1"]);
    expect(Object.keys(events).sort()).toEqual(["advanceHistory", "reconcileBoundary", "validateBoundaryBatch"]);
    expect(manifest.dependencies.jssha).toBe("3.3.2");
  });

  it("rejects accessors in the exact reviewed V2 descriptor helpers without calling them", () => {
    let calls = 0;
    const getter = () => { calls++; throw new Error("accessor ran"); };
    const record = Object.defineProperty({}, "kind", { enumerable: true, get: getter });
    expect(() => object(record, "$", ["kind"])).toThrow("SCHEMA");
    expect(() => tag(record, "$", "kind")).toThrow("SCHEMA");
    const values = Object.defineProperty(["value"], "0", { enumerable: true, get: getter });
    expect(() => array(values, "$", 3, x => x)).toThrow("ARRAY");
    expect(calls).toBe(0);
  });

  it("reconstructs an own __proto__ data property without invoking the inherited setter", () => {
    const original = Object.getOwnPropertyDescriptor(Object.prototype, "__proto__")!;
    let calls = 0;
    Object.defineProperty(Object.prototype, "__proto__", {
      ...original,
      set(this: object, value: unknown) { calls++; original.set!.call(this, value); },
    });
    try {
      const input = JSON.parse('{"__proto__":{"polluted":true},"kind":"safe"}');
      const result = object(input, "$", ["__proto__", "kind"]);
      expect(calls).toBe(0);
      expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
      expect(Object.hasOwn(result, "__proto__")).toBe(true);
      expect(Object.getOwnPropertyDescriptor(result, "__proto__")).toEqual({
        value: input["__proto__"], enumerable: true, configurable: true, writable: true,
      });
      expect(Object.hasOwn(Object.prototype, "polluted")).toBe(false);
      expect(result).not.toBe(input);
    } finally {
      Object.defineProperty(Object.prototype, "__proto__", original);
    }
  });

  it("rejects extra and own __proto__ accessors without invoking either getter", () => {
    let calls = 0;
    const getter = () => { calls++; throw new Error("accessor ran"); };
    const extra = Object.defineProperty({ kind: "safe" }, "extra", { enumerable: true, get: getter });
    const ownProto = Object.defineProperty({}, "__proto__", { enumerable: true, get: getter });
    expect(() => object(extra, "$", ["kind"])).toThrow("SCHEMA");
    expect(() => object(ownProto, "$", ["__proto__"])).toThrow("SCHEMA");
    expect(calls).toBe(0);
  });

  it("keeps descriptor helpers strict about prototypes, symbols, enumeration and dense array bounds", () => {
    for (const value of [
      Object.assign(Object.create({ inherited: true }), { kind: "value" }),
      Object.defineProperty({}, "kind", { value: "value" }),
      { kind: "value", [Symbol("extra")]: true },
      { kind: "value", extra: true },
      () => "value",
    ]) expect(() => object(value, "$", ["kind"])).toThrow();
    expect(() => tag(Object.create({ kind: "value" }), "$", "kind")).toThrow();
    for (const value of [new Array(2), [0, 1, 2, 3], Object.assign([0], { extra: true }), Object.assign([0], { [Symbol("extra")]: true }), Object.setPrototypeOf([0], {})]) {
      expect(() => array(value, "$", 3, x => x)).toThrow();
    }
    const input = Object.assign(Object.create(null), { kind: "value" });
    const detached = object(input, "$", ["kind"]);
    expect(detached).toEqual({ kind: "value" });
    expect(detached).not.toBe(input);
    expect(array([0, 1], "$", 2, x => x, 2)).toEqual([0, 1]);
  });

  it.each(["observations.ts", "intent-codec-v1.ts"])("keeps %s runtime closure free of Node imports and arena host/baseline modules", (entry) => {
    const allowedArena = new Set([
      "observations.ts", "intent-codec-v1.ts", "authorized/v1/canonical.ts", "authorized/v1/squares.ts",
      "authorized/v1/observationCodec.ts", "challengeContract/candidateWire.ts", "challengeContract/validation.ts",
      "authorized/v2/observation.ts", "authorized/v2/schema.ts",
    ].map((path) => join(arena, "src", path)));
    const seen = new Set<string>();
    const visit = (path: string): void => {
      if (seen.has(path)) return;
      seen.add(path);
      if (path.startsWith(`${arena}/`)) expect(allowedArena.has(path), path).toBe(true);
      else expect(path.startsWith(`${core}/src/`), path).toBe(true);
      for (const specifier of runtimeEdges(path)) {
        expect(isBuiltin(specifier), `${path} -> ${specifier}`).toBe(false);
        if (specifier.startsWith(".")) visit(localTarget(path, specifier));
        else if (specifier === "@chess-coach/starchess-core/planning-v1") visit(require.resolve(specifier));
        else throw new Error(`Non-leaf runtime dependency: ${path} -> ${specifier}`);
      }
    };
    visit(join(arena, "src", entry));
    expect(seen.has(join(arena, "src/authorized/v1/observationCodec.ts"))).toBe(true);
    expect(seen.has(join(arena, "src/challengeContract/candidateWire.ts"))).toBe(entry === "intent-codec-v1.ts");
    expect(seen.has(join(core, "src/index.ts"))).toBe(false);
    expect(seen.has(join(core, "src/planning-v1.ts"))).toBe(true);
  });
});
