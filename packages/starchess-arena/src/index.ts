/**
 * @chess-coach/starchess-arena — headless script-vs-script matches on the pure
 * SCFEN engine. Node/Bun-runnable, zero DOM/worker/fetch; records are shared
 * (`packages/starchess-core` schema) and replayable in the web app.
 *
 * // SPEC: _spec/packages/starchess-arena/arena.puml, _spec/packages/starchess-arena/index.puml
 */

export { runMatch, DEFAULT_MAX_TURNS } from "./run/runMatch";
export type {
  ArenaRun,
  ArenaRunOptions,
  ArenaRunStatus,
  ArenaPly,
} from "./run/runMatch";
export {
  seedBankForOpening,
  grantStoredIncome,
  debitSpend,
  type Bank,
} from "./run/bank";

export { seedKvsForOpening, updateKvsForSnap, type KvsState } from "./players/kvs";
export type { SideContext, ScriptPlan, ScriptPlayer, Players } from "./players/types";
export { naiveScript, NAIVE_SCRIPT_NAME } from "./players/naive";
export { strategicScript, STRATEGIC_SCRIPT_NAME } from "./players/strategic";

export type {
  EngineFeed,
  EngineFeedOptions,
  EngineCandidate,
  EngineSuggestion,
} from "./feed/types";

export { recordFromRun } from "./record/record";
export type { ArenaGameRecord, ArenaRecordStatus } from "./record/record";
export { summarize, materialMarginAtTerminal } from "./compare/compare";
export type { ScriptRow, ScriptScoreboard } from "./compare/compare";

export { ARENA_SEEDS, seedForIndex, STAR_STARTING_SCFEN } from "./seeds";