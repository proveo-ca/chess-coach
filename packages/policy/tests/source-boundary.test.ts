// SPEC: _spec/ml-runtime-architecture.puml, _spec/initialization.puml, _spec/causal-journal.puml
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const entry = `${root}packages/policy/src/index.ts`;
const core = `${root}packages/game-core/src/index.ts`;
const producer = `${root}packages/contracts/src/initialization.ts`;
const causalProducers = ["packages/game-core/src/causal-producer.ts", "packages/game-core/src/causal-events.ts",
  "packages/contracts/src/causal-journal.ts", "packages/contracts/src/recipient.ts", "packages/contracts/src/recipient-codec.ts",
  "packages/contracts/src/game-session.ts", "packages/contracts/src/native-protocol.ts", "packages/contracts/src/resolution.ts",
  "packages/contracts/src/episode.ts", "packages/contracts/src/learning-channel.ts", "packages/contracts/src/training-state.ts",
  "packages/contracts/src/native-intents.ts", "packages/contracts/src/match.ts", "packages/contracts/src/training-artifact.ts"].map(path => `${root}${path}`);
const config = ts.readConfigFile(`${root}tsconfig.json`, ts.sys.readFile);
const options = ts.parseJsonConfigFileContent(config.config, ts.sys, root).options;

function boundaryIssues(overrides: ReadonlyMap<string, string> = new Map()): string[] {
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (path, languageVersion, onError, shouldCreateNewSourceFile) => {
    const replacement = overrides.get(path);
    return replacement === undefined ? getSourceFile(path, languageVersion, onError, shouldCreateNewSourceFile)
      : ts.createSourceFile(path, replacement, languageVersion, true);
  };
  const program = ts.createProgram({ rootNames: [entry], options, host });
  const issues: string[] = [];
  for (const source of program.getSourceFiles()) {
    if (source.fileName.includes("/node_modules/") || (source.isDeclarationFile && !source.fileName.startsWith(root))) continue;
    const path = source.fileName;
    const relative = path.slice(root.length);
    if (path === producer || causalProducers.includes(path) || path.startsWith(`${root}packages/runtime/src/`)) issues.push("HOST_PRODUCER");
    if (!path.startsWith(root) || !/^(packages\/(game-core|contracts|policy)\/src\/.*\.ts|schemas\/feature-layout\.json)$/.test(relative)) {
      issues.push("OUTSIDE_MODEL_SOURCE");
    }
    const inspectSpecifier = (specifier: string): void => {
      if (!specifier.startsWith(".") && !["zod", "@chess-coach/contracts", "@chess-coach/game-core"].includes(specifier)) {
        issues.push("UNAPPROVED_IMPORT");
      }
      if (!ts.resolveModuleName(specifier, path, options, host).resolvedModule) issues.push("UNRESOLVED_IMPORT");
    };
    const visit = (node: ts.Node): void => {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        inspectSpecifier(node.moduleSpecifier.text);
      }
      if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) inspectSpecifier(node.argument.literal.text);
      if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) && node.moduleReference.expression && ts.isStringLiteral(node.moduleReference.expression)) inspectSpecifier(node.moduleReference.expression.text);
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require"))) issues.push("DYNAMIC_LOADING");
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return issues;
}

test("actual first-party policy runtime/type/reexport closure excludes host producers", () => {
  expect(boundaryIssues()).toEqual([]);
});

test("host producer import and transitive core reexport fail the first-party boundary", () => {
  const original = readFileSync(entry, "utf8");
  expect(boundaryIssues(new Map([[entry, `${original}\nexport { canonicalInitialObservation } from '@chess-coach/contracts/initialization';`]])))
    .toContain("HOST_PRODUCER");
  expect(boundaryIssues(new Map([[core, `${readFileSync(core, "utf8")}\nexport { canonicalInitialObservation } from '../../contracts/src/initialization';`]])))
    .toContain("HOST_PRODUCER");
});

test("type-only producer dependencies also fail the first-party boundary", () => {
  const original = readFileSync(entry, "utf8");
  expect(boundaryIssues(new Map([[entry, `${original}\nexport type Producer = typeof import('@chess-coach/contracts/initialization').canonicalInitialObservation;`]])))
    .toContain("HOST_PRODUCER");
});

for (const [dependency, relative] of [["@chess-coach/game-core/causal-producer", "./causal-producer"],
    ["@chess-coach/contracts/causal-journal", "../../contracts/src/causal-journal"],
    ["@chess-coach/contracts/recipient", "../../contracts/src/recipient"],
    ["@chess-coach/contracts/recipient-codec", "../../contracts/src/recipient-codec"],
    ["@chess-coach/contracts/game-session", "../../contracts/src/game-session"],
    ["@chess-coach/contracts/native-protocol", "../../contracts/src/native-protocol"],
    ["@chess-coach/contracts/episode", "../../contracts/src/episode"],
    ["../../contracts/src/learning-channel", "../../contracts/src/learning-channel"],
    ["../../contracts/src/training-state", "../../contracts/src/training-state"],
    ["../../contracts/src/match", "../../contracts/src/match"],
    ["../../runtime/src/match-session", "../../runtime/src/match-session"],
    ["../../runtime/src/training-coordinator", "../../runtime/src/training-coordinator"],
    ["../../runtime/src/training-store", "../../runtime/src/training-store"],
    ["../../runtime/src/curriculum", "../../runtime/src/curriculum"],
    ["../../runtime/src/index", "../../runtime/src/index"]]) {
  test(`private runtime/type/transitive model closure rejects ${dependency}`, () => {
    const original = readFileSync(entry, "utf8"), originalCore = readFileSync(core, "utf8");
    expect(boundaryIssues(new Map([[entry, `${original}\nimport '${dependency}';`]]))).toContain("HOST_PRODUCER");
    expect(boundaryIssues(new Map([[entry, `${original}\nexport type Private = typeof import('${dependency}');`]]))).toContain("HOST_PRODUCER");
    expect(boundaryIssues(new Map([[core, `${originalCore}\nexport * from '${relative}';`]]))).toContain("HOST_PRODUCER");
  });
}
test("actual-mutation sink reexports stay outside the model closure", () => {
  const originalCore = readFileSync(core, "utf8");
  expect(boundaryIssues(new Map([[core, `${originalCore}\nexport { CausalJournal } from './causal-events';`]]))).toContain("HOST_PRODUCER");
});

test("first-party model source rejects host builtins and dynamic loaders", () => {
  const original = readFileSync(entry, "utf8");
  expect(boundaryIssues(new Map([[entry, `${original}\nimport fs from 'node:fs';`]]))).toContain("UNAPPROVED_IMPORT");
  expect(boundaryIssues(new Map([[entry, `${original}\nexport type Host = typeof import('node:fs');`]]))).toContain("UNAPPROVED_IMPORT");
  expect(boundaryIssues(new Map([[entry, `${original}\nimport Missing from './unregistered-worker';`]]))).toContain("UNRESOLVED_IMPORT");
  expect(boundaryIssues(new Map([[entry, `${original}\nexport const load = () => import('./candidates');`]]))).toContain("DYNAMIC_LOADING");
  expect(boundaryIssues(new Map([[entry, `${original}\nexport const load = (path: string) => require(path);`]]))).toContain("DYNAMIC_LOADING");
  const undeclared = boundaryIssues(new Map([[entry, `${original}\nimport '@chess-coach/runtime';`]]));
  expect(undeclared).toContain("UNAPPROVED_IMPORT");
  expect(undeclared).toContain("UNRESOLVED_IMPORT");
});
