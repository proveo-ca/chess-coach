// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { expect, it } from "vitest";

it("compiles source import descriptors and confines production to the approved pure closures", () => {
  const files = ["candidates", "composition", "contracts", "domain", "identity"];
  const external = new Set([
    "@chess-coach/starchess-arena/observations", "@chess-coach/starchess-arena/intent-codec-v1",
    "@chess-coach/starchess-core/planning-v1", "jssha/sha256",
  ]);
  const native = new Set([
    "appendTimeSpecialAnchor", "charonDiagonalSquaresFromSquare", "classicalActorAt",
    "classicalRewriteCoordinatesAfterB", "isScMoveShape", "knownAppendFailure", "marineSingleTarget", "spawnCCAnchorFromMap",
    "PlanningKnowledge", "ScActionInput", "SpawnPiece", "Square",
    "countedPlanningKnowledge", "CountedPlanningKnowledge", "MAX_MINES_PER_SIDE",
  ]);
  const observations = new Set(["AuthorizedObservationV1", "AuthorizedSnapshotV2", "AuthorizedHistory", "validateObservationV1", "validateObservation"]);
  const codec = new Set(["ACTION_KINDS", "decodeCandidate", "encodeCandidate", "requestedSpend", "validateActions", "EncodedCandidate"]);
  const imports = new Set<string>();
  for (const file of files) {
    const source = readFileSync(new URL(`../${file}.ts`, import.meta.url), "utf8");
    const ast = ts.createSourceFile(`${file}.ts`, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
    for (const statement of ast.statements) {
      if (ts.isClassDeclaration(statement) && statement.name?.text === "ContractError") {
        expect(ts.getCombinedModifierFlags(statement) & ts.ModifierFlags.Export).toBe(0);
      }
      if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
      if (!statement.moduleSpecifier) continue;
      expect(ts.isStringLiteral(statement.moduleSpecifier)).toBe(true);
      const module = (statement.moduleSpecifier as ts.StringLiteral).text;
      imports.add(module);
      expect(external.has(module) || files.some((name) => module === `./${name}`)).toBe(true);
      if ((module === "@chess-coach/starchess-core/planning-v1" || module === "@chess-coach/starchess-arena/observations" || module === "@chess-coach/starchess-arena/intent-codec-v1") && ts.isImportDeclaration(statement)) {
        const bindings = statement.importClause?.namedBindings;
        expect(bindings && ts.isNamedImports(bindings)).toBe(true);
        if (bindings && ts.isNamedImports(bindings)) {
          const approved = module === "@chess-coach/starchess-core/planning-v1" ? native
            : module === "@chess-coach/starchess-arena/observations" ? observations : codec;
          for (const item of bindings.elements) expect(approved.has((item.propertyName ?? item.name).text)).toBe(true);
        }
      }
    }
    const inspect = (node: ts.Node): void => {
      if (ts.isIdentifier(node)) {
        expect(["process", "require", "eval", "fetch", "WebSocket", "ScFenSnapshot", "addScAction", "resolveTurn", "endScTurn"].includes(node.text)).toBe(false);
      }
      if (ts.isCallExpression(node)) expect(node.expression.kind).not.toBe(ts.SyntaxKind.ImportKeyword);
      ts.forEachChild(node, inspect);
    };
    inspect(ast);
    const output = ts.transpileModule(source, { fileName: `${file}.ts`, reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, isolatedModules: true } });
    expect(output.diagnostics?.filter((d) => d.category === ts.DiagnosticCategory.Error)).toEqual([]);
  }
  expect([...external].every((specifier) => imports.has(specifier))).toBe(true);
});

const legacyImportFixture = `
import {
  COMPOSITION_VERSION, MAX_GENERATED_ACTIONS, MAX_ATTEMPTED_EXTENSIONS, MAX_RETAINED_CANDIDATES,
  composeCandidatesFromObservationV1, composeCandidatesFromHistoryV2, decodeCandidate,
  type Kind, type Lane, type PoolRecord, type CandidateBatchV3, type CandidateDiagnostics,
  type CandidateKind, type CandidateLane, type CandidatePool,
} from "@chess-coach/starchess-training/candidates";
import { CANDIDATE_CODEC_VERSION, encodeCandidate, type EncodedCandidate } from "@chess-coach/starchess-arena/intent-codec-v1";
import type { AuthorizedObservationV1, AuthorizedHistory } from "@chess-coach/starchess-arena/observations";
import type { ScActionInput } from "@chess-coach/starchess-core/planning-v1";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
type ExpectedKind = "classical" | "deploy" | "stimStep" | "spiderMine" | "charonMissiles" | "siegeMode" | "tacticalJump";
type ExpectedPool = Readonly<{ id: ExpectedKind | "shared-composition"; initialCapacity: number; finalCapacity: number; retained: number; exhausted: boolean }>;
type KindShape = Assert<Equal<Kind, ExpectedKind>>;
type LaneShape = Assert<Equal<Lane, ExpectedKind | "shared-composition">>;
type PoolShape = Assert<Equal<PoolRecord, ExpectedPool>>;
type KindAlias = Assert<Equal<Kind, CandidateKind>>;
type LaneAlias = Assert<Equal<Lane, CandidateLane>>;
type PoolAlias = Assert<Equal<PoolRecord, CandidatePool>>;

const compositionVersion: "challenge-composition-v3" = COMPOSITION_VERSION;
const wireVersion: "challenge-candidate-codec-v1" = CANDIDATE_CODEC_VERSION;
const generated: 4 = MAX_GENERATED_ACTIONS;
const attempted: 2048 = MAX_ATTEMPTED_EXTENSIONS;
const retained: 512 = MAX_RETAINED_CANDIDATES;
declare const observation: AuthorizedObservationV1;
declare const history: AuthorizedHistory;
const actions: ScActionInput[] = [
  { kind: "classical", timing: "C", color: "w", from: "e7", to: "e8", promotion: "n" },
  { kind: "classical", timing: "C", color: "w", from: "e7", to: "e8", promotion: "b" },
  { kind: "classical", timing: "C", color: "w", from: "e7", to: "e8", promotion: "r" },
  { kind: "classical", timing: "C", color: "w", from: "e7", to: "e8", promotion: "q" },
];
const encoded: EncodedCandidate = encodeCandidate(observation, actions);
const decoded: EncodedCandidate = decodeCandidate(encoded, "w");
const batch: CandidateBatchV3 = composeCandidatesFromObservationV1(observation);
const historyBatch: CandidateBatchV3 = composeCandidatesFromHistoryV2(history);
const diagnostics: CandidateDiagnostics = batch.diagnostics;
const kind: Kind = decoded.actions[0]!.kind;
const lane: Lane = diagnostics.exhaustedLanes[0]!;
const currentPool: PoolRecord = diagnostics.pools[0]!;
const poolRecord: PoolRecord = { id: "shared-composition", initialCapacity: 175, finalCapacity: 175, retained: 0, exhausted: false };
`;

it("typechecks legacy package imports and exact current aliases with incompatible-shape controls", () => {
  const configPath = fileURLToPath(new URL("../../tsconfig.json", import.meta.url));
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  expect(config.error).toBeUndefined();
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(configPath));
  expect(parsed.errors).toEqual([]);
  const options = { ...parsed.options, types: [] };
  const fixturePath = fileURLToPath(new URL("./legacyPublicImports.fixture.ts", import.meta.url));
  const compile = (suffix = "") => {
    const host = ts.createCompilerHost(options);
    const getSourceFile = host.getSourceFile;
    host.getSourceFile = (path, ...args) => path === fixturePath
      ? ts.createSourceFile(path, legacyImportFixture + suffix, ts.ScriptTarget.ES2022, true)
      : getSourceFile(path, ...args);
    return ts.getPreEmitDiagnostics(ts.createProgram([fixturePath], options, host))
      .filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error);
  };
  const valid = compile();
  expect(valid.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"))).toEqual([]);
  const invalid = compile(`
const invalidKind: Kind = "pass";
const invalidLane: Lane = "shared";
const invalidPool: PoolRecord = { id: "shared-composition", initialCapacity: 175, retained: 0, exhausted: false };
poolRecord.retained = 1;
const invalidVersion: CandidateBatchV3["version"] = "challenge-composition-v2";
`);
  expect(invalid.map(diagnostic => diagnostic.code).sort()).toEqual([2322, 2322, 2322, 2540, 2741]);
  expect(invalid.every(diagnostic => diagnostic.file?.fileName === fixturePath)).toBe(true);
});
