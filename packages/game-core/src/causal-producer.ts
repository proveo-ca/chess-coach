// SPEC: _spec/causal-journal.puml
import { CausalJournal } from "./causal-events";
import { beginScTurnKernel, endScTurnKernel } from "./resolve";
import type { BeginScTurnResult, EndScTurnOptions, EndScTurnResult } from "./resolve";
import type { CausalJournalData, CausalState } from "./causal-types";
import type { ScFenSnapshot } from "./types";

export { seedCausalState } from "./causal-events";
export type { CausalState, CausalJournalData, CausalEvent, CausalDiscovery } from "./causal-types";
export type Journaled<T> = { result: T; state: CausalState; journal: CausalJournalData };

export function beginWithJournal(snapshot: ScFenSnapshot, state: CausalState): Journaled<BeginScTurnResult> {
  const collector = new CausalJournal(state);
  collector.assertSnapshot(snapshot);
  const result = beginScTurnKernel(snapshot, collector);
  return { result, ...collector.finish(result.next) };
}

export function endWithJournal(snapshot: ScFenSnapshot, state: CausalState, options?: EndScTurnOptions): Journaled<EndScTurnResult> {
  const collector = new CausalJournal(state, snapshot.queue?.actions);
  collector.assertSnapshot(snapshot);
  const result = endScTurnKernel(snapshot, options, collector);
  return { result, ...collector.finish(result.next) };
}
