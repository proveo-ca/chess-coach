// SPEC: _spec/packages/starchess-arena/ml-adjutant-phase1.puml
import { mulberry32 } from "@chess-coach/starchess-core";
import { deepFreeze } from "./config";
import type { AuditedCorpus } from "./corpus";
import type { ScheduledMatch } from "./types";

export const buildSchedule = (corpus: AuditedCorpus): ScheduledMatch[] => deepFreeze([
  ...corpus.traces.map((trace): ScheduledMatch => ({
    key: trace.caseId, suite: "corpus", candidateSide: "b", arenaSeed: 0, inferenceSeed: 0,
    opening: trace.openingScfen, trace,
  })),
  ...corpus.manifest.strategicSchedule.candidateSides.flatMap((candidateSide) =>
    corpus.manifest.strategicSchedule.arenaSeeds.map((arenaSeed): ScheduledMatch => ({
      key: `live-${candidateSide}-${arenaSeed}`, suite: "live-strategic", candidateSide, arenaSeed,
      inferenceSeed: 0, opening: corpus.manifest.openingScfen,
    }))),
]);

export const sampleOne = (corpus: AuditedCorpus, selectionSeed: number): ScheduledMatch =>
  buildSchedule(corpus)[Math.floor(mulberry32(selectionSeed)() * corpus.traces.length)]!;
