// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml
import { historyFromRecord, parseScFen, refillTurnGas, type ScActionInput } from "@chess-coach/starchess-core";
import { canonical } from "../challenge/config";
import { loadPinnedCorpus, readPinnedCorpusBytes, REPOSITORY_ROOT, sha256, type PinnedCorpusBytes, type SourceGame } from "../challenge/corpus";
import { observe } from "../challenge/observation";
import type { Sighting } from "../challenge/types";
import { ACTION_KINDS, CANDIDATE_CODEC_VERSION, CANDIDATE_ENUMERATION_VERSION, COMPARATOR_VERSION, encodeBaselineCandidates, encodeCandidate } from "./candidateCodec";
import { encodeFeatures, FEATURE_SCHEMA } from "./features";
import { decodeObservation, encodeObservation, OBSERVATION_CODEC_VERSION } from "./observationCodec";

const counter = () => ({ covered: 0, total: 0 });
export const measureCoverage = (root: URL = REPOSITORY_ROOT, bytes: PinnedCorpusBytes = readPinnedCorpusBytes(root)) => {
  const corpus = loadPinnedCorpus(root, bytes);
  const source = JSON.parse(Buffer.from(bytes.sourceBytes).toString("utf8")) as { games: SourceGame[] };
  const byKind = Object.fromEntries(ACTION_KINDS.map((kind) => [kind, counter()]));
  const byTiming = Object.fromEntries(["B", "C", "F"].map((timing) => [timing, counter()]));
  const byDeployUnit: Record<string, ReturnType<typeof counter>> = {};
  const byQueueLength: Record<string, ReturnType<typeof counter>> = {};
  const exactQueues = counter();
  const singletonIntents = counter();
  const codec = counter();
  const features = counter();
  const proposalHistogram: Record<string, number> = {};
  const windows: { caseId: string; planningOrdinal: number; proposals: number; exactQueue: boolean; representable: boolean; featureSha256: string | null; error: string | null }[] = [];
  for (const [index, trace] of corpus.traces.entries()) {
    const game = source.games[index]!;
    const history = historyFromRecord(game);
    let memory: Sighting[] = [];
    for (const [sourcePlyIndex, snapshot] of history.settledSnapshots.entries()) {
      const raw = parseScFen(game.scfens[sourcePlyIndex]!);
      if (!raw.stored) throw new Error(`Historical observation lacks recorded own bank: ${trace.caseId}/${sourcePlyIndex}`);
      const observation = observe(refillTurnGas(snapshot), raw.stored, "w", memory);
      memory = observation.memory;
      const window = trace.windows.find((entry) => entry.sourcePlyIndex === sourcePlyIndex);
      if (!window) continue;
      const decoded = decodeObservation(encodeObservation(observation));
      const proposals = encodeBaselineCandidates(decoded);
      const keys = new Set(proposals.map((entry) => entry.candidate.key));
      const exact = keys.has(canonical(window.actions));
      exactQueues.total++;
      exactQueues.covered += Number(exact);
      const lengths = byQueueLength[window.actions.length] ??= counter();
      lengths.total++;
      lengths.covered += Number(exact);
      proposalHistogram[proposals.length] = (proposalHistogram[proposals.length] ?? 0) + 1;
      for (const action of window.actions) {
        const covered = keys.has(canonical([action]));
        singletonIntents.total++;
        singletonIntents.covered += Number(covered);
        byKind[action.kind]!.total++;
        byKind[action.kind]!.covered += Number(covered);
        byTiming[action.timing]!.total++;
        byTiming[action.timing]!.covered += Number(covered);
        if (action.kind === "deploy" && action.unit) {
          const units = byDeployUnit[action.unit] ??= counter();
          units.total++;
          units.covered += Number(covered);
        }
      }
      codec.total++;
      features.total++;
      let representable = false;
      let featureSha256: string | null = null;
      let error: string | null = null;
      try {
        const encoded = encodeCandidate(decoded, window.actions);
        if (encoded.key !== canonical(window.actions)) throw new Error("Reference intent loss");
        codec.covered++;
        const numeric = encodeFeatures(decoded, encoded);
        for (const proposal of proposals) encodeFeatures(decoded, proposal.candidate);
        features.covered++;
        representable = true;
        featureSha256 = sha256(canonical(numeric));
      } catch (failure) { error = String(failure); }
      windows.push({ caseId: trace.caseId, planningOrdinal: window.planningOrdinal, proposals: proposals.length, exactQueue: exact, representable, featureSha256, error });
    }
  }
  const opening = parseScFen(corpus.manifest.openingScfen);
  const fixtureRows = (["w", "b"] as const).flatMap((color) => ACTION_KINDS.map((kind) => {
    const observation = observe(opening, { w: 3, b: 3 }, color);
    const from = color === "w" ? "e1" : "e8";
    const to = color === "w" ? "d1" : "d8";
    const action: ScActionInput = kind === "classical" ? { kind, timing: "C", color, from, to }
      : { kind, timing: "B", color, from, ...(kind === "siegeMode" ? {} : { to }), ...(kind === "deploy" ? { unit: "p" as const } : {}) };
    const candidate = encodeCandidate(observation, [action]);
    return { color, kind, representable: true, featuresSha256: sha256(canonical(encodeFeatures(observation, candidate))) };
  }));
  return {
    version: "phase2-coverage-v1", population: "recorded White authorized historical observations; not live counterplay",
    manifestSha256: corpus.manifestSha256, sourceSha256: corpus.manifest.sourceSha256,
    observationCodecVersion: OBSERVATION_CODEC_VERSION, candidateCodecVersion: CANDIDATE_CODEC_VERSION,
    enumerationVersion: CANDIDATE_ENUMERATION_VERSION, comparatorVersion: COMPARATOR_VERSION,
    featureSchema: FEATURE_SCHEMA,
    exactQueues, singletonIntents, byKind, byTiming, byDeployUnit, byQueueLength,
    codecRepresentability: codec, featureRepresentability: features,
    proposalHistogram, maximumProposals: Math.max(...windows.map((window) => window.proposals)),
    passOnlyWindows: windows.filter((window) => window.proposals === 1).length,
    limitations: ["baseline-v1 generates classical singletons, Marine deployment singletons, and pass", "Historical membership does not prove live coverage or winning counterplay", "Nominal spend and structural encoding do not prove host admission", "Square sightings do not count unique enemy units"],
    fixtures: { population: "14 structural encoding fixtures; not legality or tactical coverage", rows: fixtureRows }, windows,
  };
};
