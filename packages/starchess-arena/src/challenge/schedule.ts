// SPEC: _spec/packages/starchess-arena/ml-adjutant-challenge-harness.puml
import { mulberry32 } from "@chess-coach/starchess-core";
import { loadPinnedCorpus, type AuditedCorpus } from "./corpus";
import { deepFreeze } from "./config";
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

export type TrustedExecutionContext = { readonly version: "trusted-execution-context-v1" };
type TrustedRoster = { schedule: readonly ScheduledMatch[] };
const trustedRosters = new WeakMap<object, TrustedRoster>();

export const loadTrustedExecutionContext = (
  suite: "all" | "corpus" | "live-strategic" = "all",
): TrustedExecutionContext => {
  const corpus = loadPinnedCorpus();
  const schedule = buildSchedule(corpus).filter((match) => suite === "all" || match.suite === suite);
  if (new Set(schedule.map((match) => match.key)).size !== schedule.length) throw new Error("duplicate schedule key");
  const token: TrustedExecutionContext = Object.freeze({ version: "trusted-execution-context-v1" });
  trustedRosters.set(token, { schedule: deepFreeze([...schedule]) });
  return token;
};

const roster = (context: TrustedExecutionContext): TrustedRoster => {
  const found = trustedRosters.get(context);
  if (!found) throw new Error("untrusted execution context");
  return found;
};

export const expectedSchedule = (context: TrustedExecutionContext): readonly ScheduledMatch[] => roster(context).schedule;

export const expectedMatch = (context: TrustedExecutionContext, key: string): ScheduledMatch | undefined =>
  roster(context).schedule.find((match) => match.key === key);
