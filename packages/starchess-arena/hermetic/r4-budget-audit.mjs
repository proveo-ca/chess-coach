// SPEC: _spec/packages/starchess-training/r4-host-verification.puml
import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const toolRequire = createRequire(import.meta.url);
const repository = fileURLToPath(new URL("../../../", import.meta.url));
const training = "packages/starchess-training/src/";
export const R4_AUDIT_VERSION = "starchess-r4-planning-audit-v1";
const supportedSyntax = Object.freeze({
  "packages/starchess-arena/src/challenge/r3Session.ts": "0314a7e2e26dbb8bca30b82c56d71d796f9da7701db3744ecdd1d55d4f7ba86b",
  [`${training}coordinator/economicAdapter.ts`]: "a174cb3de10234971f860eda03a8fa3b944ad8d44cb57dad085f9ab54e529fef",
  [`${training}coordinator/episodeSupervisor.ts`]: "b26fec4c8ebe1750c64c33f4f30ea7130829823867284a7cdd2415d096a0f160",
  [`${training}coordinator/episodeVerification.ts`]: "9b14567fda5c4230cd5c2ab97ef92b892377ab78d8e5d1e09e65c82518d34c6b",
  [`${training}coordinator/episodeWorker.ts`]: "0d7e6e72fc9ab233d6a4d8e1fed3973c9bfcb5b56b82868f3c90d1c808f25212",
  [`${training}coordinator/planningScope.ts`]: "fe4f9b9aac8916dbacf4da491d6ddf3df20f2161f2cfa4f299c7377c43f672f8",
  [`${training}economic/contracts.ts`]: "815d0d787e154c0c8c859ae8b3cfe52348d1c4fac841b2619d56362266434b54",
  [`${training}economic/invoices.ts`]: "c391c571cc93ac1f9a94f84fa541be8354895f98d4c7d7b8a477ab8c9520b335",
  [`${training}economic/ownedKernel.ts`]: "26ce7a8f1ab1cbf56935d56ee3a23bd4b6503184ea303c54234134fc48265f6d",
  [`${training}economic/work.ts`]: "5121aeb11082c2e8fc845c8ccc1eb4cfe21ae286877138e2afffe409846145aa",
  [`${training}feature/manifest.ts`]: "ac5c3409159ce51eb9e21335bdf6b8341604cf880fb048a71a6e2a515a53ed85",
  [`${training}features.ts`]: "cc35430686506c8ec59faaebc54ea0a8ed596c4a49c28e2e17b33f8cd08c7c04",
});
export const R4_AUDITED_SOURCE_PATHS = Object.freeze(Object.keys(supportedSyntax).sort());
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const unsupported = (detail) => { throw new Error(`Unsupported R4 source shape: ${detail}`); };

function readSource(root, path) {
  const absolute = join(root, path);
  let cursor = sep;
  for (const part of absolute.split(sep).filter(part => part.length !== 0)) {
    cursor = join(cursor, part);
    if (lstatSync(cursor).isSymbolicLink()) unsupported(`symlink: ${path}`);
  }
  if (!lstatSync(absolute).isFile()) unsupported(`not a source file: ${path}`);
  return readFileSync(absolute);
}

function syntaxShape(ts, node, kinds) {
  const children = [];
  ts.forEachChild(node, (child) => { children.push(syntaxShape(ts, child, kinds)); });
  const text = ts.isIdentifier(node) || ts.isPrivateIdentifier(node) || ts.isLiteralExpression(node) || ts.isTemplateLiteralToken(node) ? node.text : null;
  return [kinds.get(String(node.kind)), text, typeof node.operator === "number" ? kinds.get(String(node.operator)) : null,
    ts.isVariableDeclarationList(node) ? node.flags : null,
    typeof node.isTypeOnly === "boolean" ? node.isTypeOnly : null,
    typeof node.isExportEquals === "boolean" ? node.isExportEquals : null, children];
}

export function auditR4PlanningBudget(root = repository) {
  const ts = toolRequire("typescript");
  if (ts.version !== "5.9.3") unsupported(`TypeScript ${ts.version}`);
  const kinds = new Map(Object.entries(ts.SyntaxKind));
  const signatures = new Map(Object.entries(supportedSyntax));
  root = resolve(root);
  const sources = new Map();
  const sourceFiles = R4_AUDITED_SOURCE_PATHS.map((path) => {
    const bytes = readSource(root, path);
    const source = ts.createSourceFile(path, bytes.toString("utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    if (source.parseDiagnostics.length) unsupported(`syntax: ${path}`);
    const syntaxSha256 = sha256(JSON.stringify(syntaxShape(ts, source, kinds)));
    if (syntaxSha256 !== signatures.get(path)) unsupported(`AST drift: ${path}`);
    sources.set(path, source);
    return { path, byteLength: bytes.length, sha256: sha256(bytes), syntaxSha256 };
  });
  const source = (name) => sources.get(`${training}${name}.ts`);
  const find = (node, predicate) => {
    const found = [];
    const visit = (child) => {
      if (predicate(child)) found.push(child);
      ts.forEachChild(child, visit);
    };
    visit(node);
    return found;
  };
  const exactlyOne = (nodes, label) => nodes.length === 1 ? nodes[0] : unsupported(label);
  const declaration = (node, name) => exactlyOne(find(node, (child) => ts.isVariableDeclaration(child) && ts.isIdentifier(child.name) && child.name.text === name), name);
  const fn = (name, symbol) => {
    const value = declaration(source(name), symbol).initializer;
    if (!value || !ts.isArrowFunction(value)) unsupported(symbol);
    return value;
  };
  const referenceName = (node) => {
    if (node && ts.isIdentifier(node)) return node.text;
    if (node && ts.isPropertyAccessExpression(node)) {
      const parent = referenceName(node.expression);
      if (parent) return `${parent}.${node.name.text}`;
    }
    return null;
  };
  const callName = (node) => node && ts.isCallExpression(node) ? referenceName(node.expression) : null;
  const calls = (node, name) => find(node, (child) => callName(child) === name);
  const anchor = (node, symbol) => {
    const file = node.getSourceFile();
    return { path: file.fileName, symbol, line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1,
      endLine: file.getLineAndCharacterOfPosition(node.end).line + 1 };
  };
  const functionAnchor = (name, symbol) => anchor(fn(name, symbol), symbol);
  const unwrap = (node) => {
    while (node && (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node))) node = node.expression;
    return node;
  };
  const arithmetic = (node, bindings = {}, checked = false) => {
    node = unwrap(node);
    const values = new Map(Object.entries(bindings));
    let value;
    if (node && ts.isNumericLiteral(node)) value = Number(node.text);
    else if (node && ts.isIdentifier(node) && values.has(node.text)) value = values.get(node.text);
    else if (node && ts.isBinaryExpression(node)) {
      const left = arithmetic(node.left, bindings, checked), right = arithmetic(node.right, bindings, checked);
      if (node.operatorToken.kind === ts.SyntaxKind.PlusToken) value = left + right;
      else if (node.operatorToken.kind === ts.SyntaxKind.MinusToken) value = left - right;
      else if (node.operatorToken.kind === ts.SyntaxKind.AsteriskToken) value = left * right;
      else unsupported("arithmetic operator");
    } else if (checked && callName(node) === "checkedExtent" && node.arguments.length === 3 && node.arguments[2].getText() === "path") {
      const extent = arithmetic(node.arguments[0], bindings), maximum = arithmetic(node.arguments[1], bindings);
      if (extent < 0 || extent > maximum || Object.is(extent, -0)) throw new RangeError("CARDINALITY");
      value = extent;
    } else unsupported("arithmetic expression");
    if (!Number.isSafeInteger(value)) unsupported("non-integer arithmetic");
    return value;
  };
  const invoiceSource = source("economic/invoices");
  const constants = new Map();
  for (const name of ["PLANNING_WORK_CAP", "PLANNING_BOOTSTRAP_UNITS", "PLANNING_GATE_UNITS", "PLANNING_CLOSURE_UNITS", "PLANNING_ENTRY_UNITS", "PLANNING_INITIAL_UNITS", "blockControl"]) {
    constants.set(name, arithmetic(declaration(invoiceSource, name).initializer, Object.fromEntries(constants)));
  }
  const cap = constants.get("PLANNING_WORK_CAP");
  const quoteFunction = fn("economic/invoices", "quoteBlock");
  const quoteSwitch = exactlyOne(find(quoteFunction.body, ts.isSwitchStatement), "quote switch");
  const quoteCase = (block) => exactlyOne(quoteSwitch.caseBlock.clauses.filter((clause) => ts.isCaseClause(clause) && ts.isStringLiteral(clause.expression) && clause.expression.text === block), `quote ${block}`);
  const quote = (block, extent0) => {
    const clause = quoteCase(block);
    if (clause.statements.length !== 1 || !ts.isReturnStatement(clause.statements[0])) unsupported(`quote ${block}`);
    return arithmetic(clause.statements[0].expression, { ...Object.fromEntries(constants), extent0 }, true);
  };
  const blockQuoteAnchors = ["scalar", "float64-array", "float64-store", "r3-visit", "r3-node", "r3-byte-read"].map((block) => anchor(quoteCase(block), `quoteBlock:${block}`));
  const adapterBatch = fn("coordinator/economicAdapter", "constructOwnedGeneratedBatch");
  const batchTry = exactlyOne(adapterBatch.body.statements.filter(ts.isTryStatement), "batch try");
  const directCalls = (body, name) => body.statements.filter(ts.isExpressionStatement).map((statement) => statement.expression).filter((expression) => callName(expression) === name);
  const precharge = directCalls(batchTry.tryBlock, "pay")[0];
  if (!precharge || precharge.arguments.length !== 2) unsupported("batch precharge");
  const nDeclaration = declaration(adapterBatch.body, "n");
  if (callName(nDeclaration.initializer) !== "length") unsupported("candidate maximum");
  const candidateMaximum = arithmetic(nDeclaration.initializer.arguments[2]);
  const flatten = fn("feature/manifest", "flattenFeatureBlocksV3");
  const allocate = exactlyOne(calls(flatten.body, "allocateFloat64"), "flatten allocation");
  const dimension = arithmetic(allocate.arguments[0]);
  const literalNames = (name) => {
    const initializer = declaration(source("economic/contracts"), name).initializer;
    if (callName(initializer) !== "Object.freeze" || initializer.arguments.length !== 1) unsupported(name);
    const array = unwrap(initializer.arguments[0]);
    if (!ts.isArrayLiteralExpression(array) || !array.elements.every(ts.isStringLiteral) || new Set(array.elements.map((element) => element.text)).size !== array.elements.length) unsupported(name);
    return array.elements.length;
  };
  const promotionBuilder = fn("feature/manifest", "buildPromotionNames");
  const horizons = exactlyOne(find(promotionBuilder.body, (node) => ts.isArrayLiteralExpression(node) && node.elements.length > 0), "promotion horizons");
  const promotionWidth = literalNames("PROMOTION_KERNELS") * literalNames("PROMOTION_CHANNELS") * horizons.elements.length;
  const widths = new Map(Object.entries({ QUEUE_NAMES: literalNames("QUEUE_NAMES"), POSITION_NAMES: literalNames("POSITION_NAMES"), ECONOMIC_NAMES: literalNames("ECONOMIC_NAMES"), PROMOTION_NAMES_V3: promotionWidth }));
  const positionLoop = exactlyOne(flatten.body.statements.filter(ts.isForStatement), "flatten positions loop");
  const positionCount = arithmetic(positionLoop.condition.right);
  const laneLayout = [];
  for (const append of calls(flatten.body, "append")) {
    const name = append.arguments[1].getText();
    if (!widths.has(name)) unsupported("flatten names");
    const position = name === "POSITION_NAMES";
    for (let i = 0; i < (position ? positionCount : 1); i++) {
      laneLayout.push({ block: append.arguments[0].getText(), ...(position ? { position: i } : {}), start: arithmetic(append.arguments[2], { i }), width: widths.get(name) });
    }
  }
  let laneEnd = 0;
  for (const lane of laneLayout) {
    if (lane.start !== laneEnd) unsupported("flatten lane offsets");
    laneEnd += lane.width;
  }
  if (laneEnd !== dimension) unsupported("flatten width");
  const store = exactlyOne(calls(flatten.body, "consumeWorkBlock"), "flatten store quote");
  if (store.arguments[1].text !== "float64-store" || arithmetic(store.arguments[2]) !== dimension) unsupported("flatten store extent");
  const charges = calls(flatten.body, "charge");
  if (charges.length !== 2) unsupported("flatten charge count");
  const flattenComponents = [
    { component: "header", units: quote("scalar", arithmetic(charges[0].arguments[1])), sourceAnchor: anchor(charges[0], "flatten:header") },
    { component: "allocation", units: quote("float64-array", dimension), sourceAnchor: anchor(allocate, "flatten:allocation") },
    { component: "stores", units: quote("float64-store", dimension), sourceAnchor: anchor(store, "flatten:stores") },
    { component: "lane-visits", units: quote("scalar", arithmetic(charges[1].arguments[1])), sourceAnchor: anchor(charges[1], "flatten:lane-visits") },
  ];
  const flattenBodyReservationUnits = flattenComponents.reduce((sum, component) => sum + component.units, 0);
  const pipeline = fn("coordinator/economicAdapter", "executeCandidatePipeline");
  const pipelineTry = exactlyOne(pipeline.body.statements.filter(ts.isTryStatement), "pipeline try");
  const flattenCalls = calls(pipeline.body, "hostedFlattenFeaturesV3");
  const candidatePasses = [], selectedCalls = [];
  for (const call of flattenCalls) {
    if (call.arguments.length !== 2 || callName(call.arguments[1]) !== "hostedEncodeFeaturesV3") unsupported("pipeline flatten/encode pairing");
    let parent = call.parent;
    while (parent !== pipelineTry.tryBlock && !ts.isForStatement(parent)) parent = parent.parent;
    if (ts.isForStatement(parent)) {
      const initializer = parent.initializer;
      if (!ts.isVariableDeclarationList(initializer) || initializer.declarations.length !== 1 || initializer.declarations[0].name.getText() !== "i" ||
          arithmetic(initializer.declarations[0].initializer) !== 0 || !ts.isBinaryExpression(parent.condition) || parent.condition.operatorToken.kind !== ts.SyntaxKind.LessThanToken ||
          parent.condition.left.getText() !== "i" || parent.condition.right.getText() !== "n" || !ts.isPostfixUnaryExpression(parent.incrementor) ||
          parent.incrementor.operand.getText() !== "i" || parent.incrementor.operator !== ts.SyntaxKind.PlusPlusToken || !ts.isBlock(parent.statement) ||
          !ts.isVariableDeclaration(call.parent) || call.parent.initializer !== call || call.parent.parent.parent.parent !== parent.statement) unsupported("pipeline candidate pass");
      candidatePasses.push(parent);
    } else {
      if (!ts.isVariableDeclaration(call.parent) || call.parent.initializer !== call || call.parent.parent.parent.parent !== pipelineTry.tryBlock) unsupported("pipeline selected flatten");
      selectedCalls.push(call);
    }
  }
  if (candidatePasses.length !== 2 || new Set(candidatePasses).size !== 2 || selectedCalls.length !== 1 || flattenCalls.length !== 3) unsupported("pipeline flatten schedule");
  const flattenCallCount = candidatePasses.length * candidateMaximum + selectedCalls.length;
  const batchExtent = (n) => arithmetic(precharge.arguments[1], { n });
  const scalarOverhead = quote("scalar", 0);
  let firstRejectedCandidateCount = null;
  for (let n = 1; n <= candidateMaximum; n++) {
    if (batchExtent(n) > cap) { firstRejectedCandidateCount = n; break; }
  }
  const batchCases = [13, 14, candidateMaximum].map((n) => {
    const rawExtent = batchExtent(n), extentWithinDomain = rawExtent <= cap;
    return { n, rawExtent, extentWithinDomain, quoteUnits: extentWithinDomain ? quote("scalar", rawExtent) : null,
      quoteRejection: extentWithinDomain ? null : "CARDINALITY",
      remainingForAllOtherReservations: extentWithinDomain ? cap - quote("scalar", rawExtent) : null };
  });
  const storeUnitsPerCall = quote("float64-store", dimension);
  const storeQuoteTotal = flattenCallCount * storeUnitsPerCall;
  const entryUnits = arithmetic(exactlyOne(calls(fn("economic/ownedKernel", "arm").body, "debit"), "entry debit").arguments[1], Object.fromEntries(constants));
  const ingressDebit = exactlyOne(calls(fn("economic/ownedKernel", "beginIngress").body, "debit"), "ingress debit");
  const ingressUnits = (block) => arithmetic(ingressDebit.arguments[1], { ...Object.fromEntries(constants), units: quote(block, 1) });
  const r3Source = sources.get("packages/starchess-arena/src/challenge/r3Session.ts");
  const byteReader = declaration(r3Source, "economicByteReader").initializer;
  const byteCallback = exactlyOne(calls(byteReader, "chargeEconomic"), "byte read callback");
  const byteCallbackUnits = arithmetic(declaration(r3Source, byteCallback.arguments[3].getText()).initializer);
  const batchAnchors = [anchor(precharge, "constructOwnedGeneratedBatch:precharge"), functionAnchor("coordinator/economicAdapter", "pay"),
    anchor(quoteCase("scalar"), "quoteBlock:scalar"), functionAnchor("economic/invoices", "checkedExtent"), functionAnchor("economic/ownedKernel", "debit"),
    functionAnchor("economic/ownedKernel", "consumeWorkBlock"), functionAnchor("economic/ownedKernel", "reserveBlock")];
  const scheduleAnchors = [...candidatePasses.map((pass, i) => anchor(pass, i === 0 ? "pipeline:score-pass" : "pipeline:gradient-pass")), anchor(selectedCalls[0], "pipeline:selected-flatten"),
    functionAnchor("coordinator/planningScope", "hostedFlattenFeaturesV3"), functionAnchor("features", "flattenFeaturesV3"), functionAnchor("feature/manifest", "flattenFeatureBlocksV3"),
    functionAnchor("economic/work", "charge"), functionAnchor("economic/work", "allocateFloat64"),
    anchor(quoteCase("scalar"), "quoteBlock:scalar"), anchor(quoteCase("float64-array"), "quoteBlock:float64-array"), anchor(quoteCase("float64-store"), "quoteBlock:float64-store")];
  const stage = (id, sourceAnchors, reservations, unresolvedWork) => ({ id, sourceAnchors, reservations, unresolvedWork });
  const current = (fields) => ({ kind: "current-reservation", ...fields });
  const conditional = (fields) => ({ kind: "conditional-bound", ...fields });
  const stages = [
    stage("bootstrap-admission", [functionAnchor("economic/ownedKernel", "createPlanningLedger"), functionAnchor("coordinator/planningScope", "openPlanningScope")],
      [current({ initialUnits: constants.get("PLANNING_INITIAL_UNITS"), admissionUnits: constants.get("PLANNING_GATE_UNITS"), totalUnits: constants.get("PLANNING_INITIAL_UNITS") + constants.get("PLANNING_GATE_UNITS"),
        closureUnitsIncludedInInitial: constants.get("PLANNING_CLOSURE_UNITS") })], ["Source-seal, startup-binding and permit checks have no established coordinator invoice coverage."]),
    stage("ingress", [anchor(byteReader, "economicByteReader"), anchor(declaration(r3Source, "visitR3EconomicInputs"), "visitR3EconomicInputs"), functionAnchor("coordinator/planningScope", "openPlanningScope"), functionAnchor("economic/ownedKernel", "beginIngress")],
      [current({ visitUnits: ingressUnits("r3-visit"), nodeUnits: ingressUnits("r3-node"), byteReadCallbackUnits: byteCallbackUnits, byteReadExtentPerTicket: 1, unitsPerByteReadTicket: ingressUnits("r3-byte-read"), byteReadAccounting: "one new ingress ticket per read, including entry and gate" })],
      ["Ingress totals depend on retained boundaries and every byte read; this audit does not aggregate them."]),
    stage("reconstruction", [functionAnchor("coordinator/economicAdapter", "reconstructEconomicInput")], [],
      ["Descriptor reads, owned constructors, byte copying, canonical encoding, history comparisons and nested snapshot/hash reservations remain unaggregated."]),
    stage("candidate-copy", [functionAnchor("coordinator/planningScope", "openPlanningScope"), ...batchAnchors],
      [current({ extentExpression: precharge.arguments[1].getText(), scalarOverhead, candidateDomain: { minimum: 1, maximum: candidateMaximum } })],
      ["Candidate generation, provenance copies, diagnostics, digests and publication add work beyond this precharge.", "The precharge's feature-lane coverage overlaps later flatten-store invoices; coverage remains unresolved."]),
    stage("reductions", [functionAnchor("coordinator/economicAdapter", "executeCandidatePipeline"), functionAnchor("coordinator/planningScope", "hostedInitializeEconomicState"), functionAnchor("coordinator/planningScope", "hostedAdvanceEconomicState")],
      [conditional({ condition: "state === null; B retained boundaries; all reductions complete", initializeCalls: 1, advanceCalls: "B - 1", entryUnitsPerCall: entryUnits })],
      ["Reduction bodies, guards and construction invoices remain unaggregated."]),
    stage("readout", [functionAnchor("coordinator/planningScope", "hostedReadoutEconomic"), functionAnchor("features", "readoutEconomic")],
      [conditional({ condition: "pipeline reaches readout", calls: 1, entryUnitsPerCall: entryUnits })], ["Readout body invoices remain unaggregated."]),
    stage("score-pass", [anchor(candidatePasses[0], "pipeline:score-pass"), functionAnchor("coordinator/planningScope", "hostedEncodeFeaturesV3")],
      [conditional({ condition: "all n candidates complete", encodeCalls: "n", flattenCalls: "n", entryUnitsPerEncodeOrFlatten: entryUnits })],
      ["Weights, dot products, logit storage and maximum reduction have no established coordinator invoice coverage.", "Feature encoding invoices remain unaggregated."]),
    stage("distribution-selection", [functionAnchor("coordinator/economicAdapter", "executeCandidatePipeline")], [],
      ["Exponentiation, normalization, sampling, cumulative selection and fallback scans have no established coordinator invoice coverage."]),
    stage("gradient-pass", [anchor(candidatePasses[1], "pipeline:gradient-pass")],
      [conditional({ condition: "all n candidates complete", encodeCalls: "n", flattenCalls: "n", entryUnitsPerEncodeOrFlatten: entryUnits })],
      ["Probability-weighted accumulation has no established coordinator invoice coverage.", "Feature encoding invoices remain unaggregated."]),
    stage("selected-feature", [anchor(selectedCalls[0], "pipeline:selected-flatten"), ...scheduleAnchors.slice(3)],
      [conditional({ condition: "selection and both passes complete", encodeCalls: 1, flattenCalls: 1, entryUnitsPerEncodeOrFlatten: entryUnits })],
      ["Selected-minus-mean gradient and log-probability arithmetic have no established coordinator invoice coverage."]),
    stage("publication-closure", [functionAnchor("coordinator/economicAdapter", "executeCandidatePipeline"), functionAnchor("coordinator/planningScope", "closePlanningScope"), functionAnchor("coordinator/episodeVerification", "reconstructCandidateDecision")],
      [current({ closureUnits: constants.get("PLANNING_CLOSURE_UNITS"), includedIn: "bootstrap-admission.initialUnits", additionalCloseDebit: 0 })],
      ["Journal construction, scalar encoding, scoreDelta copying, rechecks and recomputation publication have no established complete invoice coverage."]),
    stage("parent-replica", [functionAnchor("coordinator/episodeWorker", "runEpisodeWorker"), functionAnchor("coordinator/episodeSupervisor", "superviseEpisodeChannel"), functionAnchor("coordinator/episodeVerification", "reconstructCandidateDecision")],
      [conditional({ condition: "parent receives a candidate decision-result", schedule: "independent reconstruction of the same candidate pipeline", capScope: "one ledger per planning scope; do not sum parent and child against one cap" })],
      ["Parent IPC decoding, equality checks, deadlines, acceptance and acknowledgements remain outside this partial reservation accounting."]),
  ];
  return {
    version: R4_AUDIT_VERSION, cap, dimension, candidateMaximum, sourceFiles,
    analysis: { mode: "TypeScript syntax-only; no program, source execution/eval or audited-source imports", parserVersion: ts.version,
      supportedShape: "frozen full-file AST signatures; trivia changes rebind byte hashes; all AST drift fails closed", scope: "partial reservation accounting with complete planning phase inventory; not a source/runtime closure or global cost proof" },
    stages, blockQuoteAnchors,
    witnesses: [
      { id: "adapter-batch-precharge", kind: "current-reservation", sourceAnchors: batchAnchors,
        condition: "a matching generated batch reaches the precharge with 1 <= n <= candidateMaximum",
        extentExpression: precharge.arguments[1].getText(), scalarOverhead, cases: batchCases, firstRejectedCandidateCount,
        rejectionOrder: "checkedExtent rejects an out-of-domain scalar extent with CARDINALITY before debit can report WORK_CAP",
        withinDomainMeaning: "quote acceptance alone does not prove enough remaining ledger capacity or a successful planning schedule" },
      { id: "pipeline-flatten-stores", kind: "conditional-bound", sourceAnchors: scheduleAnchors,
        condition: "both complete candidate passes and selected publication execute; this is not an observed or reachable execution claim",
        n: candidateMaximum, callsExpression: `${candidatePasses.length} * n + ${selectedCalls.length}`, flattenCallCount, lanesPerFlatten: dimension,
        laneLayout, storeUnitsPerCall, storeQuoteTotal, storeQuotesAloneExceedCap: storeQuoteTotal > cap,
        flattenBodyReservationUnits, flattenComponents, excludes: ["hosted entry/gate units", "encoding and reductions", "unresolved coordinator work"],
        independence: "store quotes alone exceed the cap without adding the adapter witness" },
    ],
    overlaps: [{ id: "adapter-precharge-vs-flatten-stores", status: "expected-overlap", sourceAnchors: [anchor(precharge, "batch:precharge"), anchor(store, "flatten:stores")],
      accounting: "do not sum the two witnesses; overlapping coverage is not an adequacy proof" }],
    scheduleStatus: firstRejectedCandidateCount !== null || storeQuoteTotal > cap ? "infeasible" : "unproven",
    invoiceAdequacy: "unproven", frozenDesignImpossibility: "not-proven", productionReady: false,
  };
}

export function planningAuditExitCode(report) {
  if (!["infeasible", "unproven"].includes(report.scheduleStatus) || report.productionReady !== false) unsupported("no feasible/ready result is supported");
  return 2;
}
