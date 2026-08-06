/**
 * Store-free combat cue player for DualNav review demos (legacy sequential).
 * Live match / DualNav store path uses {@link playTimeline}, which batches
 * same-rank opposing actions simultaneously (checks → attacks → moves).
 */
import type { Square } from "chess.js";
import type {
  EndScTurnResult,
  ScFenSnapshot,
  StarChessPiece,
} from "@chess-coach/starchess-core";
import { mapToPlacement, placementToMap } from "@chess-coach/starchess-core";

import { browserScheduler } from "~/adapters/browser";
import type { TimelineCue } from "~/types/match";
import { projectResolveTimeline } from "~/presentation/timeline/timelinePlayer";
import {
  ATTACK_MS,
  DEATH_MS,
  DEPLOY_MS,
  GAS_DROP_MS,
  moveDurationMs,
} from "~/presentation/timeline/timings";
import type {
  AttackCue,
  DeathCue,
  DeployCue,
  GasDropCue,
  MoveCue,
} from "~/presentation/types";

export type ResolveOverlayState = {
  attack: AttackCue[];
  death: DeathCue[];
  move: MoveCue[];
  deploy: DeployCue[];
  gasDrop: GasDropCue[];
  hide: Square[];
  moveProgress: Record<string, 0 | 1>;
};

export type ResolveBoardPatch = {
  placement?: string;
  kingLives?: ScFenSnapshot["kingLives"];
  mines?: ScFenSnapshot["mines"];
  siegedRooks?: readonly Square[];
};

const asPiece = (p: string): StarChessPiece => p as StarChessPiece;

const cueDuration = (cue: TimelineCue): number => {
  switch (cue.kind) {
    case "move":
      return moveDurationMs(cue.from, cue.to);
    case "attack":
      return ATTACK_MS;
    case "death":
      return DEATH_MS;
    case "deploy":
      return DEPLOY_MS;
    case "gasDrop":
      return GAS_DROP_MS;
  }
};

const emptyOverlays = (): ResolveOverlayState => ({
  attack: [],
  death: [],
  move: [],
  deploy: [],
  gasDrop: [],
  hide: [],
  moveProgress: {},
});

const relocatePlacement = (placement: string, from: Square, to: Square): string => {
  const map = placementToMap(placement);
  const piece = map.get(from);
  if (!piece) return placement;
  map.delete(from);
  map.set(to, piece);
  return mapToPlacement(map);
};

const withoutSquare = (placement: string, at: Square): string => {
  const map = placementToMap(placement);
  map.delete(at);
  return mapToPlacement(map);
};

const isSpawnDeploy = (cue: TimelineCue): boolean =>
  cue.kind === "deploy" && cue.id.startsWith("spawn-");

/**
 * Play projected EndScTurn cues on AnimationStage (sequential attack/death/move/deploy).
 * Spawn deploys from Command Center play in parallel for one DEPLOY_MS window.
 */
export const playResolveCues = (
  result: EndScTurnResult,
  applyBoard: (patch: ResolveBoardPatch) => void,
  setOverlays: (o: ResolveOverlayState) => void,
  onDone: () => void,
): (() => void) => {
  const cues = projectResolveTimeline(result);
  let cancelled = false;
  let cancelDelay: (() => void) | null = null;
  let displayPlacement = result.afterPending.placement;
  let afterBApplied = false;

  const clearOverlays = () => setOverlays(emptyOverlays());

  const applyAfterB = () => {
    afterBApplied = true;
    displayPlacement = result.afterB.placement;
    applyBoard({
      placement: result.afterB.placement,
      mines: result.afterB.mines,
      kingLives: result.afterPending.kingLives,
      siegedRooks: result.afterB.siegedRooks,
    });
  };

  applyBoard({
    placement: result.afterPending.placement,
    mines: result.afterPending.mines,
    kingLives: result.afterPending.kingLives,
  });

  const run = (index: number) => {
    if (cancelled) return;
    if (index >= cues.length) {
      clearOverlays();
      applyBoard({
        placement: result.next.placement,
        kingLives: result.next.kingLives,
        mines: result.next.mines,
        siegedRooks: result.next.siegedRooks,
      });
      onDone();
      return;
    }

    const cue = cues[index]!;

    // Gas absorbs — stay on afterPending; do not advance to afterB yet.
    if (cue.kind === "gasDrop") {
      const batch: Extract<TimelineCue, { kind: "gasDrop" }>[] = [];
      let i = index;
      while (i < cues.length && cues[i]!.kind === "gasDrop") {
        batch.push(cues[i]! as Extract<TimelineCue, { kind: "gasDrop" }>);
        i++;
      }
      setOverlays({
        attack: [],
        death: [],
        move: [],
        deploy: [],
        gasDrop: batch.map((c) => ({
          id: c.id,
          at: c.at,
          color: c.color,
          corner: c.corner,
        })),
        hide: [],
        moveProgress: {},
      });
      cancelDelay = browserScheduler.delay(GAS_DROP_MS, () => {
        clearOverlays();
        run(i);
      });
      return;
    }

    if (isSpawnDeploy(cue)) {
      const batch: Extract<TimelineCue, { kind: "deploy" }>[] = [];
      let i = index;
      while (i < cues.length && isSpawnDeploy(cues[i]!)) {
        batch.push(cues[i]! as Extract<TimelineCue, { kind: "deploy" }>);
        i++;
      }
      applyAfterB();
      setOverlays({
        attack: [],
        death: [],
        move: [],
        deploy: batch.map((c) => ({
          id: c.id,
          piece: asPiece(c.piece),
          color: c.color,
          at: c.at,
        })),
        gasDrop: [],
        hide: batch.map((c) => c.at),
        moveProgress: {},
      });
      cancelDelay = browserScheduler.delay(DEPLOY_MS, () => {
        clearOverlays();
        run(i);
      });
      return;
    }

    if (!afterBApplied && cue.kind !== "move") applyAfterB();
    if (!afterBApplied && cue.kind === "move" && !cue.id.startsWith("b")) applyAfterB();

    clearOverlays();

    if (cue.kind === "attack") {
      setOverlays({
        attack: [
          {
            id: cue.id,
            piece: asPiece(cue.piece),
            color: cue.color,
            from: cue.from,
            to: cue.to,
          },
        ],
        death: [],
        move: [],
        deploy: [],
        gasDrop: [],
        hide: [cue.from],
        moveProgress: {},
      });
    } else if (cue.kind === "death") {
      setOverlays({
        attack: [],
        death: [
          {
            id: cue.id,
            piece: asPiece(cue.piece),
            color: cue.color,
            at: cue.at,
            mine: cue.mine,
          },
        ],
        move: [],
        deploy: [],
        gasDrop: [],
        hide: [],
        moveProgress: {},
      });
    } else if (cue.kind === "move") {
      const move: MoveCue = {
        id: cue.id,
        piece: asPiece(cue.piece),
        color: cue.color,
        from: cue.from,
        to: cue.to,
      };
      setOverlays({
        attack: [],
        death: [],
        move: [move],
        deploy: [],
        gasDrop: [],
        hide: [cue.from],
        moveProgress: { [cue.id]: 0 },
      });
      requestAnimationFrame(() => {
        if (!cancelled) {
          setOverlays({
            attack: [],
            death: [],
            move: [move],
            deploy: [],
            gasDrop: [],
            hide: [cue.from],
            moveProgress: { [cue.id]: 1 },
          });
        }
      });
    } else if (cue.kind === "deploy") {
      const map = placementToMap(displayPlacement);
      map.set(cue.at, { type: asPiece(cue.piece), color: cue.color });
      displayPlacement = mapToPlacement(map);
      applyBoard({ placement: displayPlacement });
      setOverlays({
        attack: [],
        death: [],
        move: [],
        deploy: [
          {
            id: cue.id,
            piece: asPiece(cue.piece),
            color: cue.color,
            at: cue.at,
          },
        ],
        gasDrop: [],
        hide: [cue.at],
        moveProgress: {},
      });
    }

    cancelDelay = browserScheduler.delay(cueDuration(cue), () => {
      if (cue.kind === "move" && cue.id.startsWith("b")) {
        displayPlacement = relocatePlacement(displayPlacement, cue.from, cue.to);
        applyBoard({ placement: displayPlacement });
        clearOverlays();
      } else if (cue.kind === "move" && cue.id.startsWith("pw")) {
        displayPlacement = withoutSquare(displayPlacement, cue.from);
        applyBoard({ placement: displayPlacement });
        clearOverlays();
      }
      run(index + 1);
    });
  };

  if (cues.length === 0) {
    clearOverlays();
    applyBoard({
      placement: result.next.placement,
      kingLives: result.next.kingLives,
      mines: result.next.mines,
      siegedRooks: result.next.siegedRooks,
    });
    cancelDelay = browserScheduler.delay(120, onDone);
  } else {
    run(0);
  }

  return () => {
    cancelled = true;
    cancelDelay?.();
  };
};
