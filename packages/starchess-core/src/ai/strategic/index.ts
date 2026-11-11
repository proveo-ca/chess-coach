// SPEC: _spec/apps/starchess/core/adjutant/strategic/strategic-architecture.puml
/**
 * Adjutant (SCRIPT STRATEGIC) — public entry.
 *
 * A parallel opponent planner to naive `adjutant` (see `ai/adjutant.ts`),
 * layering the known-vs-seen material model and strategic override dials on
 * top of the shared naive context / plans. Same legality guarantees: commits
 * only through `addScAction`, guarded by `clearsCheck`, fully deterministic.
 *
 * Usage mirrors naive:
 *
 *   strategicAdjutant(snap, { color, storedFor, kvs })
 *
 * `kvs` is the host-maintained known-vs-seen accumulator; omit it for a
 * deterministic one-turn estimate.
 */

export { strategicAdjutant } from "./orchestrator";
export type { StrategicResult, StrategicCandidatesResult } from "./orchestrator";
export { strategicCandidates, applyCandidate } from "./orchestrator";
export { buildStrategicCtx } from "./context";
export type { StrategicCtx, StrategicAdjutantContext } from "./context";
export type { Candidate } from "../context";
export {
  projectedBank,
  bestDeploySequence,
  isUnitInBestSequence,
  HORIZON,
  SHIP_HORIZON_BONUS,
  type DeploySequence,
} from "./deployLookahead";
export { getCCBestGuess, emptyCCIntel, type CCIntel } from "../context/ccIntel";
export {
  seedCcIntelForOpening,
  updateCcIntelForSnap,
  seedKvsForOpening,
  updateKvsForSnap,
  seedRunnerMemory,
  updateRunnersForSnap,
  seedAttackerMemory,
  updateAttackersForSnap,
  witnessFromEndTurn,
  type CcIntelState,
  type KvsState,
  type RunnerMemoryState,
  type AttackerMemoryState,
  type ResolveWitness,
} from "./tracking";
export {
  emptyAttackerMemory,
  foldAttackerMemory,
  wantedAt,
  ATTACKER_MEMORY_TURNS,
} from "./attackers";
export type { AttackerMemory, CCAttacker } from "./attackers";
export { runnerCrossings, ccAttackers } from "./witness";
export {
  attackers as attackersStrategy,
  avengeValue,
  avengeDeployValue,
  AVENGE_CC_SHOT,
  AVENGE_THRIFT,
} from "./strategies/attackers";
export {
  seedKnownVsSeen,
  knownForTurn,
  combineKnownVsSeen,
  estimateKnownVsSeen,
  detectCheesePromotion,
  hasHiddenMaterial,
  hiddenMaterial,
  isWinning,
} from "./intel";
export type { KnownVsSeen } from "./intel";
export {
  scanEnemyRunners,
  turnsToPromote,
  runnerSidesteps,
  isSoleBlocker,
  isUrgentRunner,
  emptyRunnerMemory,
  foldRunnerMemory,
  RUNNER_RANKS_PER_TURN,
  RUNNER_WATCH_TURNS,
  RUNNER_URGENT_TURNS,
  RUNNER_URGENT_CONFIDENCE,
  RUNNER_SEEK_DAMP,
  RUNNER_MEMORY_DECAY,
  RUNNER_MEMORY_FLOOR,
} from "./runners";
export type { EnemyRunner, RunnerGhost, RunnerMemory } from "./runners";
// The promotion-race dials: one module owns them, so one module exports them.
export {
  runnerTier,
  runnerStake,
  runnerUrgency,
  runnerDeployValue,
  RUNNER_STOP_CRITICAL,
  RUNNER_STOP_SERIOUS,
  RUNNER_STOP_WATCH,
  RUNNER_CAPTURE_SHARE,
  RUNNER_BLOCK_SHARE,
  RUNNER_SIDESTEP_SHARE,
  RUNNER_HANGING_SHARE,
  RUNNER_COVER_SHARE,
  RUNNER_CONTAINED_SHARE,
  RUNNER_ABANDON_SHARE,
} from "./strategies/runners";