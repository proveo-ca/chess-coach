/**
 * Map match timeline cues → AnimationStage overlay props.
 *
 * Important: return the same cue object refs from `timeline.cues` while a cue
 * is playing. Remapping into new objects on every TIMELINE_COMMIT remounts
 * Solid `<For>` rows and restarts CSS attack animations (knight/vulture
 * “plays twice”, bishop gatling looks like a loop).
 */
import { createMemo } from "solid-js";

import type { MatchStore, TimelineCue } from "~/types/match";
import type { AttackCue, DeathCue, DeployCue, MoveCue } from "~/types/cues";
import type { StarChessPiece } from "@chess-coach/starchess-core";

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

const asAttack = (c: CueOf<"attack">): AttackCue =>
  c as unknown as AttackCue & { piece: StarChessPiece };

const asDeath = (c: CueOf<"death">): DeathCue =>
  c as unknown as DeathCue & { piece: StarChessPiece };

const asMove = (c: CueOf<"move">): MoveCue =>
  c as unknown as MoveCue & { piece: StarChessPiece };

const asDeploy = (c: CueOf<"deploy">): DeployCue =>
  c as unknown as DeployCue & { piece: StarChessPiece };

export const useCombatOverlays = (store: MatchStore) => {
  const tl = () => store.state().timeline;

  const attackCues = createMemo((): AttackCue[] => {
    const t = tl();
    if (!t.active) return [];
    return playing(t.cues, t.playingIds, "attack").map(asAttack);
  });

  const deathCues = createMemo((): DeathCue[] => {
    const t = tl();
    if (!t.active) return [];
    return playing(t.cues, t.playingIds, "death").map(asDeath);
  });

  const moveCues = createMemo((): MoveCue[] => {
    const t = tl();
    if (!t.active) return [];
    return playing(t.cues, t.playingIds, "move").map(asMove);
  });

  /** Stable empty — avoid new `{}` each memo run when idle. */
  const emptyProgress: Record<string, 0 | 1> = {};

  const moveProgress = createMemo((): Record<string, 0 | 1> => {
    const p = tl().moveProgress;
    return Object.keys(p).length === 0 ? emptyProgress : p;
  });

  const deployCues = createMemo((): DeployCue[] => {
    const t = tl();
    if (!t.active) return [];
    return playing(t.cues, t.playingIds, "deploy").map(asDeploy);
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
