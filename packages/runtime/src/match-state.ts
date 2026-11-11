// SPEC: _spec/match-runtime.puml
import { createHash } from "node:crypto";
import { scOutcome } from "@chess-coach/game-core";
import type { GameSession, GameTransition } from "../../contracts/src/game-session";
import { matchBoundaryShape } from "../../contracts/src/match";
import type { MatchBoundary, MatchStop } from "../../contracts/src/match";
import type { AttemptDescriptor } from "../../contracts/src/training-state";
import type { RecordedCorpus } from "./corpus";

export const matchDigest = (value: unknown): string => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function matchBoundary(session: GameSession, transition?: GameTransition): MatchBoundary {
  const kind = transition?.native.kind ?? "initial";
  return matchBoundaryShape.parse({ boundary: { kind, snapshot: session.snapshot, bank: session.bank, batches: session.batches,
    kernel: transition ? { kind, result: transition.native.value.result } : { kind } },
    provenanceDigest: matchDigest({ native: session.native, recipients: session.recipients }), journalDigest: transition ? matchDigest(transition.native.value.journal) : null });
}
export function naturalMatchStop(session: GameSession, descriptor: AttemptDescriptor, planningWindows: number, recordedPlies: number, corpus: RecordedCorpus | null): MatchStop | null {
  const outcome = scOutcome(session.snapshot);
  if (outcome) return { reason: "core-terminal", returnValue: outcome.winner === null ? 0 : outcome.winner === descriptor.schedule.candidateSide ? 1 : -1 };
  if (planningWindows >= 64 || recordedPlies >= 128) return { reason: "progress-cap", returnValue: -1 };
  if (descriptor.schedule.kind === "corpus") {
    if (corpus === null) throw new Error("Match: CORPUS_REQUIRED");
    if (corpus.window(descriptor.schedule.corpusIndex, planningWindows) === null) return { reason: "trace-exhaustion", returnValue: -1 };
  }
  return null;
}
export const planningSides = (descriptor: AttemptDescriptor): readonly ("w" | "b")[] => descriptor.schedule.kind === "corpus" ? ["b"] : ["w", "b"];
