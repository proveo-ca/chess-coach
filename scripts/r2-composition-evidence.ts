// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import { historyFromRecord, parseScFen, refillTurnGas, type PieceColor, type ScActionInput, type Square } from "../packages/starchess-core/src/index";
import { ACTION_KINDS, encodeCandidate } from "../packages/starchess-arena/src/intent-codec-v1";
import { encodeObservationV1, type AuthorizedObservationV1 } from "../packages/starchess-arena/src/observations";
import { canonical } from "../packages/starchess-arena/src/challenge/config";
import { loadPinnedCorpus, readPinnedCorpusBytes, REPOSITORY_ROOT, sha256, type PinnedCorpusBytes, type SourceGame } from "../packages/starchess-arena/src/challenge/corpus";
import { observe } from "../packages/starchess-arena/src/challenge/observation";
import type { Sighting } from "../packages/starchess-arena/src/challenge/types";
import { composeCandidatesFromObservationV1 } from "../packages/starchess-training/src/candidates";
import { appendFailure, appendState, emptyPrefix, planningKnowledge, primitiveDomain } from "../packages/starchess-training/src/domain";

export const R2_COMPOSITION_REPORT_VERSION = "r2-composition-report-v1";
export const R2_FIXTURES = Object.freeze([
  { id: "promotion", scfen: "SCFEN|7k/8/4P3/8/8/4p3/8/7K|21|33|P|G:33:33|B:12:12|Q:w:;b:" },
  { id: "mine-reservations", scfen: "SCFEN|7k/nnn5/8/8/8/8/NNN5/7K|21|33|P|G:33:33|B:12:12|Q:w:;b:" },
  { id: "append-time-anchors", scfen: "SCFEN|7k/qbr5/8/8/8/8/QBR5/7K|21|33|P|G:33:33|B:12:12|Q:w:;b:" },
] as const);

const primitiveMembership = (observation: AuthorizedObservationV1, actions: readonly ScActionInput[]) => {
  if (actions.length > 4) return false;
  const knowledge = planningKnowledge(observation);
  let state = emptyPrefix();
  for (const action of actions) {
    const key = canonical(action);
    if (![...primitiveDomain(knowledge, state, action.kind)].some((entry) => canonical(entry) === key) ||
      appendFailure(observation, knowledge, state, action) !== null) return false;
    state = appendState(knowledge, state, action);
  }
  return true;
};

const measurement = (id: string, observation: AuthorizedObservationV1, references: readonly (readonly ScActionInput[])[]) => {
  const batch = composeCandidatesFromObservationV1(observation);
  const keys = new Set(batch.candidates.map((candidate) => candidate.key));
  const queues = references.map((actions) => {
    const key = encodeCandidate(observation, actions).key;
    return { key, length: actions.length, primitive: primitiveMembership(observation, actions), retained: keys.has(key) };
  });
  return {
    id, side: observation.side, observationSha256: sha256(encodeObservationV1(observation)),
    candidateKeysSha256: sha256(canonical([...keys])), diagnostics: batch.diagnostics,
    primitiveCoverage: { covered: queues.filter((queue) => queue.primitive).length, total: queues.length },
    retainedCoverage: { covered: queues.filter((queue) => queue.retained).length, total: queues.length },
    omittedPrimitiveKeys: queues.filter((queue) => queue.primitive && !queue.retained).map((queue) => queue.key), queues,
  };
};

const fixtureReferences = (id: typeof R2_FIXTURES[number]["id"], side: PieceColor): ScActionInput[][] => {
  const rank = side === "w" ? "2" : "7";
  const square = (file: string): Square => `${file}${rank}` as Square;
  if (id === "promotion") {
    const from: Square = side === "w" ? "e6" : "e3";
    const to: Square = side === "w" ? "e7" : "e2";
    return (["n", "b", "r", "q"] as const).map((promotion) => [
      { kind: "stimStep", timing: "B", color: side, from, to },
      { kind: "classical", timing: "C", color: side, from, to, promotion },
    ]);
  }
  if (id === "mine-reservations") return [
    ["a"], ["a", "b"], ["a", "b", "c"],
  ].map((files) => files.map((file) => ({ kind: "spiderMine", timing: "B", color: side, from: square(file) })));
  const to: Square = side === "w" ? "c3" : "c6";
  return [
    [{ kind: "classical", timing: "C", color: side, from: square("b"), to },
      { kind: "charonMissiles", timing: "F", color: side, from: square("b"), to: side === "w" ? "d4" : "d5" }],
    [{ kind: "charonMissiles", timing: "F", color: side, from: square("b"), to },
      { kind: "classical", timing: "C", color: side, from: square("b"), to }],
  ];
};

export const measureR2Composition = (root: URL = REPOSITORY_ROOT, bytes: PinnedCorpusBytes = readPinnedCorpusBytes(root)) => {
  const corpus = loadPinnedCorpus(root, bytes);
  const source = JSON.parse(Buffer.from(bytes.sourceBytes).toString("utf8")) as { games: SourceGame[] };
  const historical = corpus.traces.flatMap((trace, index) => {
    const game = source.games[index]!;
    let memory: Sighting[] = [];
    return historyFromRecord(game).settledSnapshots.flatMap((snapshot, sourcePlyIndex) => {
      const recorded = parseScFen(game.scfens[sourcePlyIndex]!);
      if (!recorded.stored) throw new Error("R2 historical observation lacks recorded own bank");
      const observation = observe(refillTurnGas(snapshot), recorded.stored, "w", memory);
      memory = observation.memory;
      const window = trace.windows.find((entry) => entry.sourcePlyIndex === sourcePlyIndex);
      return window ? [measurement(`${trace.caseId}/${window.planningOrdinal}`, observation, [window.actions])] : [];
    });
  });
  const fixtures = R2_FIXTURES.flatMap((fixture) => (["w", "b"] as const).map((side) => {
    const snapshot = parseScFen(fixture.scfen);
    return measurement(`${fixture.id}/${side}`, observe(snapshot, { w: 12, b: 12 }, side), fixtureReferences(fixture.id, side));
  }));
  const rows = [...historical, ...fixtures];
  const histogram = (values: readonly (string | number)[]) => Object.fromEntries([...new Set(values)].sort().map((value) => [String(value), values.filter((entry) => entry === value).length]));
  return {
    version: R2_COMPOSITION_REPORT_VERSION, generatorVersion: "challenge-composition-v3", observationVersion: "challenge-observation-v1",
    status: "diagnostic", learnedGateEligible: false, learnedChallengePass: false, modelArtifact: null,
    manifestSha256: corpus.manifestSha256, sourceSha256: corpus.manifest.sourceSha256,
    fixtureDefinitionsSha256: sha256(canonical(R2_FIXTURES)), domains: ["promotion", "mine-reservations", "append-time-anchors"],
    fixtureSides: ["w", "b"], historicalPopulation: "recorded White authorized observations from the pinned 18 original games",
    limits: { candidates: 512, attemptedExtensions: 2048, queueLength: 4 },
    attemptsHistogram: histogram(rows.map((row) => row.diagnostics.attemptedExtensions)),
    retainedHistogram: histogram(rows.map((row) => row.diagnostics.uniqueIncludingPass)),
    stopHistogram: histogram(rows.map((row) => row.diagnostics.stopReason)),
    quotaHistogram: histogram(rows.map((row) => canonical(row.diagnostics.pools))),
    retainedByOwner: Object.fromEntries(ACTION_KINDS.map((kind) => [kind, rows.reduce((sum, row) => sum + row.diagnostics.retainedByOwner[kind], 0)])),
    coverageFlags: { primitiveIsAdmission: false, retainedIsExhaustive: false, retainedIsWinning: false, learnedPolicyImplemented: false },
    historical, fixtures,
  };
};
