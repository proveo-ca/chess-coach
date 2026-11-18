// SPEC: _spec/checkpoint-runtime.puml
import { initializeGame, openGame } from "../packages/contracts/src/game-session";
import type { PlanPermit } from "../packages/contracts/src/episode";
import { deriveStream } from "../packages/runtime/src/rng";
import { StrategicDriver } from "../packages/runtime/src/strategic";
import type { StrategicApi } from "../packages/runtime/src/strategic";
import expected from "../packages/runtime/tests/fixtures/reference-sources.json";

const root = "/home/gu1lty/Projects/proveo/chess-coach";
const corePath = `${root}/packages/starchess-core/src/index.ts`, playerPath = `${root}/packages/starchess-arena/src/players/strategic.ts`;
const [core, player] = await Promise.all([import(corePath), import(playerPath)]);
const api: StrategicApi = { strategicScript: player.strategicScript, seedKvsForOpening: core.seedKvsForOpening, seedCcIntelForOpening: core.seedCcIntelForOpening,
  seedRunnerMemory: core.seedRunnerMemory, seedAttackerMemory: core.seedAttackerMemory, updateKvsForSnap: core.updateKvsForSnap, updateCcIntelForSnap: core.updateCcIntelForSnap,
  updateRunnersForSnap: core.updateRunnersForSnap, updateAttackersForSnap: core.updateAttackersForSnap, witnessFromEndTurn: core.witnessFromEndTurn };
const results = [];
for (const side of ["w", "b"] as const) {
  const initial = initializeGame(), opened = openGame(initial), rng = deriveStream(101, "opponent");
  const worker = new StrategicDriver("synthetic", side, initial.snapshot, rng, api, () => 0n, 100_000_000_000n);
  const owner = new StrategicDriver("synthetic", side, initial.snapshot, rng, api, () => 0n, 100_000_000_000n);
  worker.advance(opened); owner.advance(opened);
  const permit: PlanPermit = { version: "chess-coach.plan-permit.v1", attemptId: "synthetic", permitId: `synthetic:plan:0:${side}`, planningOrdinal: 0,
    turn: 0, side, role: "strategic", issuedNs: "0", deadlineNs: "10000000000" };
  const json = await worker.plan(JSON.stringify(permit)), verified = await owner.verify({ json, receivedNs: 0n }, permit);
  worker.acceptAck(verified.digest);
  results.push({ side, digest: verified.digest, actions: verified.journal.actions, reportedMinSpend: verified.journal.reportedMinSpend, opponentAfter: worker.sampling() });
}
const fingerprints = results.map(result => ({ side: result.side, digest: result.digest, reportedMinSpend: result.reportedMinSpend, drawCount: result.opponentAfter.drawCount, state: result.opponentAfter.state }));
if (JSON.stringify(fingerprints) !== JSON.stringify(expected.strategic)) throw new Error("Strategic fixture: FROZEN_EXPECTATIONS");
console.log(JSON.stringify({ scope: "BOUNDED_SYNTHETIC_OPENING_PLANNING_FIXTURE_ONLY", reference: expected.reference, results,
  newGameRollouts: 0, trainingEpisodes: 0, runtimeQualification: false }));
