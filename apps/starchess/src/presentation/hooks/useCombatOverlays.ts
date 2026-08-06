/**
 * Map match timeline cues → AnimationStage overlay props.
 */
import { createMemo } from "solid-js";

import type { MatchStore } from "~/app/MatchStoreContext";
import type { TimelineCue } from "~/app/matchTypes";
import type { AttackCue, DeathCue, DeployCue, MoveCue } from "~/presentation/types";
import type { StarChessPiece } from "@chess-coach/starchess-core";

const asPiece = (p: string): StarChessPiece => p as StarChessPiece;

type CueOf<K extends TimelineCue["kind"]> = Extract<TimelineCue, { kind: K }>;

const playing = <K extends TimelineCue["kind"]>(
  cues: readonly TimelineCue[],
  ids: readonly string[],
  kind: K,
): CueOf<K>[] => {
  if (ids.length === 0) return [];
  const set = new Set(ids);
  return cues.filter((c): c is CueOf<K> => c.kind === kind && set.has(c.id));
};

export const useCombatOverlays = (store: MatchStore) => {
  const tl = () => store.state().timeline;

  const attackCues = createMemo((): AttackCue[] => {
    const t = tl();
    if (!t.active) return [];
    return playing(t.cues, t.playingIds, "attack").map((c) => ({
      id: c.id,
      piece: asPiece(c.piece),
      color: c.color,
      from: c.from,
      to: c.to,
    }));
  });

  const deathCues = createMemo((): DeathCue[] => {
    const t = tl();
    if (!t.active) return [];
    return playing(t.cues, t.playingIds, "death").map((c) => ({
      id: c.id,
      piece: asPiece(c.piece),
      color: c.color,
      at: c.at,
      mine: c.mine,
    }));
  });

  const moveCues = createMemo((): MoveCue[] => {
    const t = tl();
    if (!t.active) return [];
    return playing(t.cues, t.playingIds, "move").map((c) => ({
      id: c.id,
      piece: asPiece(c.piece),
      color: c.color,
      from: c.from,
      to: c.to,
    }));
  });

  const moveProgress = createMemo((): Record<string, 0 | 1> => ({
    ...tl().moveProgress,
  }));

  const deployCues = createMemo((): DeployCue[] => {
    const t = tl();
    if (!t.active) return [];
    return playing(t.cues, t.playingIds, "deploy").map((c) => ({
      id: c.id,
      piece: asPiece(c.piece),
      color: c.color,
      at: c.at,
    }));
  });

  const hideSquares = createMemo(() => tl().hiddenSquares);

  return {
    attackCues,
    deathCues,
    moveCues,
    moveProgress,
    deployCues,
    hideSquares,
  };
};
