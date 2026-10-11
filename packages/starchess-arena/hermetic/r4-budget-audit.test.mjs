// SPEC: _spec/packages/starchess-training/r4-host-verification.puml
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { auditR4PlanningBudget, planningAuditExitCode, R4_AUDITED_SOURCE_PATHS, R4_AUDIT_VERSION } from "./r4-budget-audit.mjs";

const repository = fileURLToPath(new URL("../../../", import.meta.url));
const wrapper = join(repository, "scripts/r4-planning-budget-audit.mjs");
const snapshot = new Map(R4_AUDITED_SOURCE_PATHS.map((path) => [path, readFileSync(join(repository, path))]));
const training = "packages/starchess-training/src/";
const adapter = `${training}coordinator/economicAdapter.ts`;
const invoices = `${training}economic/invoices.ts`;
const manifest = `${training}feature/manifest.ts`;
const batchExpression = "32768 + 418 * 1536 + n * (512 + 2 * 418 * 32) + 418 * 32";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

function fixture(t) {
  const root = mkdtempSync(join(realpathSync(process.env.OPENCODE_TMP_DIR || tmpdir()), "r4-budget-audit-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [path, bytes] of snapshot) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), bytes);
  }
  return root;
}

function change(root, path, before, after) {
  const text = readFileSync(join(root, path), "utf8");
  assert(text.includes(before), `missing mutation target: ${before}`);
  writeFileSync(join(root, path), text.replace(before, after));
}

function cli(args, cwd = repository) {
  return spawnSync(process.execPath, [wrapper, ...args], { cwd, encoding: "utf8", timeout: 15000,
    env: { ...process.env, NODE_NO_WARNINGS: "1" } });
}

test("source-bound report inventories complete sorted byte hashes and syntax anchors", (t) => {
  const root = fixture(t), report = auditR4PlanningBudget(root);
  assert.equal(report.version, R4_AUDIT_VERSION);
  assert.equal(report.cap, 1048576);
  assert.equal(report.dimension, 418);
  assert.equal(report.candidateMaximum, 512);
  assert.deepEqual(report.sourceFiles.map((file) => file.path), [...snapshot.keys()].sort());
  assert.equal(report.sourceFiles.length, 12);
  for (const file of report.sourceFiles) {
    assert.equal(file.byteLength, snapshot.get(file.path).length);
    assert.equal(file.sha256, hash(snapshot.get(file.path)));
    assert.match(file.syntaxSha256, /^[a-f0-9]{64}$/);
  }
  assert.equal(report.sourceFiles.find((file) => file.path === invoices).sha256, "9e25189774f8da03db2c29685af61e1aa012c9825b1e42eed8e088213b41b604");
  const anchors = [...report.stages.flatMap((stage) => stage.sourceAnchors), ...report.witnesses.flatMap((witness) => witness.sourceAnchors), ...report.blockQuoteAnchors];
  for (const anchor of anchors) {
    assert(snapshot.has(anchor.path), anchor.path);
    assert(anchor.line >= 1 && anchor.endLine >= anchor.line);
    assert(anchor.endLine <= snapshot.get(anchor.path).toString("utf8").split("\n").length);
    assert.equal(typeof anchor.symbol, "string");
  }
  assert.deepEqual(auditR4PlanningBudget(root), report);
});

test("batch witness distinguishes scalar quote CARDINALITY from ledger WORK_CAP", (t) => {
  const witness = auditR4PlanningBudget(fixture(t)).witnesses[0];
  assert.equal(witness.kind, "current-reservation");
  assert.equal(witness.extentExpression, batchExpression);
  assert.equal(witness.scalarOverhead, 128);
  assert.equal(witness.firstRejectedCandidateCount, 14);
  assert.deepEqual(witness.cases, [
    { n: 13, rawExtent: 1042624, extentWithinDomain: true, quoteUnits: 1042752, quoteRejection: null, remainingForAllOtherReservations: 5824 },
    { n: 14, rawExtent: 1069888, extentWithinDomain: false, quoteUnits: null, quoteRejection: "CARDINALITY", remainingForAllOtherReservations: null },
    { n: 512, rawExtent: 14647360, extentWithinDomain: false, quoteUnits: null, quoteRejection: "CARDINALITY", remainingForAllOtherReservations: null },
  ]);
  assert(witness.cases[0].rawExtent < 1048576);
  assert(witness.cases[1].rawExtent > 1048576);
  assert.match(witness.rejectionOrder, /CARDINALITY before debit can report WORK_CAP/);
  assert.match(witness.withinDomainMeaning, /does not prove/);
});

test("two full passes plus selected flatten independently exceed the cap on store quotes", (t) => {
  const report = auditR4PlanningBudget(fixture(t)), witness = report.witnesses[1];
  assert.equal(witness.kind, "conditional-bound");
  assert.match(witness.condition, /not an observed or reachable execution claim/);
  assert.equal(witness.callsExpression, "2 * n + 1");
  assert.equal(witness.n, 512);
  assert.equal(witness.flattenCallCount, 1025);
  assert.equal(witness.lanesPerFlatten, 418);
  assert.deepEqual(witness.laneLayout.map(({ start, width }) => [start, width]), [[0, 34], [34, 84], [118, 84], [202, 84], [286, 84], [370, 12], [382, 36]]);
  assert.equal(witness.storeUnitsPerCall, 128 + 418 * 32);
  assert.equal(witness.storeQuoteTotal, 13841600);
  assert.equal(witness.storeQuotesAloneExceedCap, true);
  assert(witness.storeQuoteTotal > report.cap);
  assert.deepEqual(witness.flattenComponents.map(({ component, units }) => [component, units]), [["header", 140], ["allocation", 578], ["stores", 13504], ["lane-visits", 3536]]);
  assert.equal(witness.flattenBodyReservationUnits, 17758);
  assert.equal(report.overlaps[0].status, "expected-overlap");
  assert.match(report.overlaps[0].accounting, /do not sum the two witnesses/);
  assert.equal(report.combinedWitnessTotal, undefined);
});

test("complete schedule inventory keeps per-read ingress, overlap and unpaid work unresolved", (t) => {
  const report = auditR4PlanningBudget(fixture(t));
  assert.deepEqual(report.stages.map(({ id }) => id), ["bootstrap-admission", "ingress", "reconstruction", "candidate-copy", "reductions", "readout", "score-pass", "distribution-selection", "gradient-pass", "selected-feature", "publication-closure", "parent-replica"]);
  for (const stage of report.stages) {
    assert(stage.sourceAnchors.length > 0);
    assert(stage.unresolvedWork.length > 0);
    for (const reservation of stage.reservations) assert(["current-reservation", "conditional-bound"].includes(reservation.kind));
  }
  assert.equal(report.stages[0].reservations[0].totalUnits, 3584);
  const ingress = report.stages.find(({ id }) => id === "ingress").reservations[0];
  assert.equal(ingress.visitUnits, 1792);
  assert.equal(ingress.nodeUnits, 1920);
  assert.equal(ingress.byteReadCallbackUnits, 64);
  assert.equal(ingress.byteReadExtentPerTicket, 1);
  assert.equal(ingress.unitsPerByteReadTicket, 1856);
  assert.equal(report.stages.find(({ id }) => id === "reductions").reservations[0].entryUnitsPerCall, 1536);
  assert.equal(report.stages.find(({ id }) => id === "publication-closure").reservations[0].additionalCloseDebit, 0);
  assert.match(report.stages.at(-1).reservations[0].capScope, /do not sum parent and child/);
  assert.equal(report.scheduleStatus, "infeasible");
  assert.equal(report.invoiceAdequacy, "unproven");
  assert.equal(report.frozenDesignImpossibility, "not-proven");
  assert.equal(report.productionReady, false);
});

const mutations = [
  ["batch arithmetic", adapter, batchExpression, batchExpression.replace("32768", "32769")],
  ["batch operator", adapter, "n * (512 + 2 * 418 * 32)", "n + (512 + 2 * 418 * 32)"],
  ["candidate maximum", adapter, "n = length(meter, raw, 512)", "n = length(meter, raw, 511)"],
  ["cap", invoices, "PLANNING_WORK_CAP = 1048576", "PLANNING_WORK_CAP = 2097152"],
  ["store tariff", invoices, 'case "float64-store": return blockControl + checkedExtent(extent0, 8034, path) * 32;', 'case "float64-store": return blockControl + checkedExtent(extent0, 8034, path) * 16;'],
  ["scalar quote overhead", invoices, 'case "scalar": return blockControl + checkedExtent', 'case "scalar": return 64 + checkedExtent'],
  ["quote domain sign", invoices, "value > maximum", "value >= maximum"],
  ["score loop increment", adapter, "logits[i] = logit; maximum = Math.max(maximum, logit);", "logits[i] = logit; maximum = Math.max(maximum, logit); i++;"],
  ["loop condition", adapter, "for (let i = 0; i < n; i++) {\n      const candidate", "for (let i = 0; i < n - 1; i++) {\n      const candidate"],
  ["gradient flatten", adapter, "const features = hostedFlattenFeaturesV3(scope, hostedEncodeFeaturesV3(scope, history, state, batch, requireCandidate(batch.candidates[i]!), bindings.artifact));", "const features = new Float64Array(418);"],
  ["selected flatten", adapter, "const selectedFeatures = hostedFlattenFeaturesV3(scope, hostedEncodeFeaturesV3(scope, history, state, batch, selected, bindings.artifact));", "const selectedFeatures = new Float64Array(418);"],
  ["flatten width", manifest, "allocateFloat64(418, meter", "allocateFloat64(419, meter"],
  ["flatten header", manifest, 'charge(meter, 12, "$.work.feature.flatten.header")', 'charge(meter, 13, "$.work.feature.flatten.header")'],
  ["flatten store extent", manifest, '"float64-store", 418,', '"float64-store", 417,'],
  ["flatten offset", manifest, "POSITION_NAMES, 34 + 84 * i", "POSITION_NAMES, 35 + 84 * i"],
  ["lane-name width", `${training}economic/contracts.ts`, '"ix.spendOwnPaidWaste", "ix.deployOwnPaidWaste",', '"ix.spendOwnPaidWaste", "ix.deployOwnPaidWaste", "extra-lane",'],
  ["array allocator", `${training}economic/work.ts`, '"float64-array", length, path', '"float64-store", length, path'],
  ["per-read ticket", `${training}coordinator/planningScope.ts`, "checkedExtent(1, 1048576)", "checkedExtent(2, 1048576)"],
  ["ledger debit sign", `${training}economic/ownedKernel.ts`, "units > PLANNING_WORK_CAP - control.used", "units >= PLANNING_WORK_CAP - control.used"],
  ["hosted adapter import", `${training}coordinator/planningScope.ts`, 'import("./economicAdapter")', 'import("./differentAdapter")'],
];

for (const [name, path, before, after] of mutations) {
  test(`fails closed on ${name} AST drift`, (t) => {
    const root = fixture(t);
    change(root, path, before, after);
    assert.throws(() => auditR4PlanningBudget(root), /Unsupported R4 source shape: AST drift:/);
  });
}

test("comments and whitespace cannot forge counterexamples and rebind full byte hashes", (t) => {
  const root = fixture(t), before = auditR4PlanningBudget(root);
  const comment = `// pay(meter, 0); hostedFlattenFeaturesV3(scope, fake); for (let i = 0; i < 999; i++) {}\n/* ${batchExpression.replace("32768", "0")} */\n\n`;
  writeFileSync(join(root, adapter), comment + snapshot.get(adapter).toString("utf8") + "\n ");
  const after = auditR4PlanningBudget(root);
  assert.deepEqual(after.witnesses.map(({ sourceAnchors, ...fields }) => fields), before.witnesses.map(({ sourceAnchors, ...fields }) => fields));
  const oldFile = before.sourceFiles.find(({ path }) => path === adapter), newFile = after.sourceFiles.find(({ path }) => path === adapter);
  assert.equal(newFile.syntaxSha256, oldFile.syntaxSha256);
  assert.notEqual(newFile.sha256, oldFile.sha256);
  assert.equal(newFile.sha256, hash(readFileSync(join(root, adapter))));
  assert.equal(newFile.byteLength, readFileSync(join(root, adapter)).length);
  assert.equal(after.witnesses[0].sourceAnchors[0].line, before.witnesses[0].sourceAnchors[0].line + comment.split("\n").length - 1);
});

test("inline trivia preserves structural references, loops and computed bounds", (t) => {
  const root = fixture(t);
  change(root, `${training}economic/contracts.ts`, "Object.freeze([", "Object /* float64-store: 0 */ . freeze([");
  change(root, adapter, "for (let i = 0; i < n; i++) {\n      const candidate", "for (let i = 0; i < /* 999 */ n; i++) {\n      const candidate");
  change(root, adapter, batchExpression, batchExpression.replace("32768 +", "32768 /* 1 */ +"));
  const report = auditR4PlanningBudget(root);
  assert.equal(report.witnesses[0].cases[1].rawExtent, 1069888);
  assert.equal(report.witnesses[0].firstRejectedCandidateCount, 14);
  assert.equal(report.witnesses[1].flattenCallCount, 1025);
  assert.equal(report.witnesses[1].storeQuoteTotal, 13841600);
  assert.equal(report.witnesses[1].flattenBodyReservationUnits, 17758);
});

for (const [name, replacement] of [
  ["comment decoy", `0 /* ${batchExpression} */`],
  ["string decoy", `Number(${JSON.stringify(batchExpression)})`],
]) {
  test(`old arithmetic in a ${name} cannot mask executable drift`, (t) => {
    const root = fixture(t);
    change(root, adapter, batchExpression, replacement);
    assert.throws(() => auditR4PlanningBudget(root), /Unsupported R4 source shape: AST drift:/);
  });
}

test("a comments/strings-only counterfeit is not a supported source AST", (t) => {
  const root = fixture(t);
  writeFileSync(join(root, adapter), `// ${batchExpression}\nconst counterexample = ${JSON.stringify(snapshot.get(adapter).toString("utf8"))};\n`);
  assert.throws(() => auditR4PlanningBudget(root), /Unsupported R4 source shape: AST drift:/);
});

test("missing, invalid and symlinked sources fail closed", (t) => {
  const missing = fixture(t);
  rmSync(join(missing, invoices));
  assert.throws(() => auditR4PlanningBudget(missing), /ENOENT/);
  const invalid = fixture(t);
  writeFileSync(join(invalid, adapter), "export const broken = ;");
  assert.throws(() => auditR4PlanningBudget(invalid), /Unsupported R4 source shape: syntax:/);
  const linked = fixture(t);
  rmSync(join(linked, adapter));
  symlinkSync(join(repository, adapter), join(linked, adapter));
  assert.throws(() => auditR4PlanningBudget(linked), /Unsupported R4 source shape: symlink:/);
});

test("audit uses the owner's parser only and never loads audited source modules", (t) => {
  const root = fixture(t), require = createRequire(import.meta.url), module = require("node:module");
  const originalLoad = module._load;
  const forbidden = new Set(["createProgram", "createIncrementalProgram", "createCompilerHost", "createLanguageService", "transpile", "transpileModule"]);
  let parseCalls = 0;
  module._load = function (request, ...args) {
    assert(!request.endsWith(".ts"), `audited source module import: ${request}`);
    const loaded = originalLoad.call(this, request, ...args);
    if (request !== "typescript") return loaded;
    return new Proxy(loaded, { get(target, property) {
      assert(!forbidden.has(property), `forbidden TypeScript API: ${property}`);
      if (property === "createSourceFile") return (...parameters) => { parseCalls++; return target.createSourceFile(...parameters); };
      return Reflect.get(target, property);
    } });
  };
  try { assert.equal(auditR4PlanningBudget(root).scheduleStatus, "infeasible"); }
  finally { module._load = originalLoad; }
  assert.equal(parseCalls, R4_AUDITED_SOURCE_PATHS.length);
});

test("CLI emits budget JSON and exit 2 from a source-only fixture without node_modules", (t) => {
  const root = fixture(t), result = cli(["--root", root], root);
  assert.equal(result.error, undefined);
  assert.equal(result.status, 2, result.stderr);
  assert.equal(result.stderr, "");
  const report = JSON.parse(result.stdout);
  assert.equal(report.scheduleStatus, "infeasible");
  assert.equal(report.version, R4_AUDIT_VERSION);
  assert.equal(report.productionReady, false);
  const defaultResult = cli([], root);
  assert.equal(defaultResult.status, 2, defaultResult.stderr);
  assert.equal(JSON.parse(defaultResult.stdout).cap, 1048576);
});

test("CLI emits only an error and exit 1 for unsupported AST or arguments", (t) => {
  const root = fixture(t);
  change(root, adapter, batchExpression, "1");
  const result = cli(["--root", root]);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  const error = JSON.parse(result.stderr);
  assert.equal(error.version, R4_AUDIT_VERSION);
  assert.equal(error.productionReady, false);
  assert.match(error.error, /Unsupported R4 source shape/);
  for (const args of [["--root"], ["--unknown"], ["--root", root, "--root", root], ["--root", "--ready"]]) {
    const failure = cli(args);
    assert.equal(failure.status, 1);
    assert.equal(failure.stdout, "");
    assert.match(JSON.parse(failure.stderr).error, /Usage:/);
  }
});

test("unproven uses exit 2 and no feasible or ready path exists", () => {
  assert.equal(planningAuditExitCode({ scheduleStatus: "infeasible", productionReady: false }), 2);
  assert.equal(planningAuditExitCode({ scheduleStatus: "unproven", productionReady: false }), 2);
  for (const report of [{ scheduleStatus: "feasible", productionReady: false }, { scheduleStatus: "unproven", productionReady: true }]) {
    assert.throws(() => planningAuditExitCode(report), /no feasible\/ready result/);
  }
});
