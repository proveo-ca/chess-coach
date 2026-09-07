// SPEC: _spec/apps/starchess/core/board/board-queries.puml, _spec/apps/starchess/core/turn/command-queue.puml
/**
 * Command Center deploy arm (king `spawn`) — owns the modal → pick → commit
 * flow extracted from `app/BaseScreen.tsx`. Board rendering (DeployModal,
 * target hit-slots) stays in the screen; this hook owns signals + queueing.
 */
import type { Square } from "chess.js";
import { createSignal } from "solid-js";

import {
  findKing,
  placementToMap,
  UNIT_COST,
  type ScFenSnapshot,
  type SpawnPiece,
} from "@chess-coach/starchess-core";

import { storedMaterial, viewerColor } from "~/app/matchEconomy";
import type { MatchStore } from "~/types/match";
import { kingDeployTargets } from "~/presentation/specials/deployTargets";
import { specialTimingFor, tryQueue } from "~/presentation/specials/queue";

export type SpawnPhase = "idle" | "modal" | "pick";

export const createKingDeploy = (
  store: MatchStore,
  snap: () => ScFenSnapshot,
  opts?: { onAfterOpen?: () => void },
) => {
  const [spawnUnit, setSpawnUnit] = createSignal<SpawnPiece | null>(null);
  const [spawnPhase, setSpawnPhase] = createSignal<SpawnPhase>("idle");

  // Raw-placement king: the spawn `from` must name the square holding the king
  // in the unresolved placement (engine validates the actor there). Deliberately
  // NOT the F-projected anchor from `kingDeployTargets` — after a classical
  // king move that square is empty until End.
  const activeKingSq = (): Square | null =>
    findKing(placementToMap(snap().placement), viewerColor(store));

  /** Ring targets for the pick step (empty while not picking). */
  const spawnAdjacent = (): Square[] => {
    if (spawnPhase() !== "pick") return [];
    return kingDeployTargets(snap(), viewerColor(store)).targets;
  };

  /** Gas-drop arm for the king — opens the deploy modal. */
  const openDeployModal = (): "pending" | false => {
    if (!activeKingSq()) {
      store.dispatch({ type: "QUEUE_REJECT", message: "No command center on the board" });
      return false;
    }
    setSpawnUnit(null);
    setSpawnPhase("modal");
    store.dispatch({
      type: "QUEUE_REJECT",
      message: `Pick a unit to deploy · minerals ${storedMaterial(store)}`,
    });
    return "pending"; // open modal; mark used only after spawn commits
  };

  const onSelectSpawnUnit = (piece: SpawnPiece): void => {
    const cost = UNIT_COST[piece];
    if (storedMaterial(store) < cost) {
      store.dispatch({
        type: "QUEUE_REJECT",
        message: `Need ${cost} minerals (have ${storedMaterial(store)})`,
      });
      return;
    }
    setSpawnUnit(piece);
    setSpawnPhase("pick");
    store.dispatch({
      type: "QUEUE_REJECT",
      message: `Tap a highlighted square to deploy ${piece.toUpperCase()}`,
    });
    store.dispatch({
      type: "OPEN_SPAWN",
      color: viewerColor(store),
      unit: piece,
    });
    opts?.onAfterOpen?.();
  };

  const onCancelSpawn = (): void => {
    setSpawnPhase("idle");
    setSpawnUnit(null);
    store.dispatch({ type: "CANCEL_TARGET" });
  };

  /** Reset to idle without touching targeting (for b/q arms taking over). */
  const resetSpawn = (): void => {
    setSpawnPhase("idle");
    setSpawnUnit(null);
  };

  const deploySpawnAt = (to: Square): void => {
    const unit = spawnUnit();
    const from = activeKingSq();
    const color = viewerColor(store);
    if (!unit || !from) return;
    // Stale/off-ring clicks (e.g. ring moved under the pick overlay) are
    // rejected before spending — the engine remains the authority via tryQueue.
    if (!kingDeployTargets(snap(), color).targets.includes(to)) {
      store.dispatch({
        type: "QUEUE_REJECT",
        message: `Cannot deploy on ${to} — outside the command-center ring`,
      });
      return;
    }
    const cost = UNIT_COST[unit];
    const before = store.shell().economies[color].stored;
    store.dispatch({ type: "SPEND_STORED", color, amount: cost });
    if (store.shell().economies[color].stored === before) {
      store.dispatch({
        type: "QUEUE_REJECT",
        message: `Need ${cost} minerals (have ${storedMaterial(store)})`,
      });
      return;
    }
    const timing = specialTimingFor(snap().queue, color);
    const ok = tryQueue(
      store,
      { timing, kind: "spawn", color, from, to, unit },
      `Deploy ${unit.toUpperCase()} → ${to} queued · End to drop`,
    );
    if (!ok) {
      store.dispatch({ type: "REFUND_STORED", color, amount: cost });
      return;
    }
    store.dispatch({ type: "MARK_SPECIAL_USED", square: from });
    setSpawnPhase("idle");
    setSpawnUnit(null);
  };

  return {
    spawnUnit,
    spawnPhase,
    resetSpawn,
    spawnAdjacent,
    openDeployModal,
    onSelectSpawnUnit,
    onCancelSpawn,
    deploySpawnAt,
  };
};
