// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { createPlanningLedger } from "../economic/ownedKernel";

describe("private ingress cleanup diagnostics", () => {
  it("retains an adapter error through the actual reconstruction callback's expired cleanup", () => {
    const source = readFileSync(new URL("../coordinator/planningScope.ts", import.meta.url), "utf8");
    const ast = ts.createSourceFile("planningScope.ts", source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
    let callback: ts.ArrowFunction | undefined;
    const find = (node: ts.Node): void => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "reconstruct" &&
          node.initializer && ts.isArrowFunction(node.initializer)) callback = node.initializer;
      ts.forEachChild(node, find);
    };
    find(ast); expect(callback).toBeDefined();
    const pair = createPlanningLedger(); pair.owner.admitOnce();
    const visit = pair.owner.beginR3Visit(), node = pair.owner.beginR3Node(), origin = new Error("reader-failure");
    const before = pair.meter.used;
    const program = ts.transpileModule(`const reconstruct = ${callback!.getText(ast)}; reconstruct(undefined);`,
      { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    const context = { visit, node, input: undefined, c: { inputs: [], owner: pair.owner, meter: pair.meter },
      adapter: { reconstructEconomicInput() { pair.owner.abort(); throw origin; } } };
    let reported: unknown;
    try { new Script(program).runInNewContext(context, { timeout: 1000 }); } catch (error) { reported = error; }
    expect(reported).toBe(origin);
    expect(context.node).toBeNull(); expect(context.c.inputs).toEqual([]);
    expect(pair.meter.used).toBe(before);
    expect(() => pair.owner.finishIngress(visit)).toThrow("LIFECYCLE");
  });
});
