/**
 * Map match timeline cues → AnimationStage overlay props.
 *
 * Important: return the same cue object refs from `timeline.cues` while a cue
 * is playing. Remapping into new objects on every TIMELINE_COMMIT remounts
 * Solid `<For>` rows and restarts CSS attack animations (knight/vulture
 * “plays twice”, bishop gatling looks like a loop).
 */
import { createMemo } from "solid-js";
import type { Square } from "chess.js";

import type { StarChessPiece } from "@chess-coach/starchess-core";

import type { MatchStore, TimelineCue } from "~/types/match";
import type {
  AttackCue,
  DeathCue,
  DeployCue,
  GasDropCue,
  MineMissileCue,
  MoveCue,
  QueenJumpTrail,
} from "~/types/cues";

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

const asGasDrop = (c: CueOf<"gasDrop">): GasDropCue => c as GasDropCue;

const asMineMissile = (c: CueOf<"mineMissile">): MineMissileCue => ({
  id: c.id,
  from: c.from,
  to: c.to,
  color: c.color,
});

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
    // Hull slides only — Tactical Jump uses QueenJumpAnimation.
    return playing(t.cues, t.playingIds, "move")
      .filter((c) => !c.queenJump)
      .map(asMove);
  });

  const jumpCues = createMemo((): MoveCue[] => {
    const t = tl();
    if (!t.active) return [];
    return playing(t.cues, t.playingIds, "move")
      .filter((c) => !!c.queenJump)
      .map(asMove);
  });

  /** Stable empty — avoid new `{}` each memo run when idle. */
  const emptyProgress: Record<string, 0 | 1> = {};
  const emptyLeg: Record<string, 0 | 1> = {};
  const emptyTrails: QueenJumpTrail[] = [];
  const emptyGas: GasDropCue[] = [];
  const emptyMissiles: MineMissileCue[] = [];
  const emptySpent: Square[] = [];

  const moveProgress = createMemo((): Record<string, 0 | 1> => {
    const p = tl().moveProgress;
    return Object.keys(p).length === 0 ? emptyProgress : p;
  });

  const moveLeg = createMemo((): Record<string, 0 | 1> => {
    const p = tl().moveLeg;
    return Object.keys(p).length === 0 ? emptyLeg : p;
  });

  const jumpTrails = createMemo(() => {
    const t = tl();
    // Trails outlive the jump hull (1000ms fade) and may remain after
    // timeline.active flips false on TIMELINE_DONE — do not gate on active.
    if (t.jumpTrails.length === 0) return emptyTrails;
    return t.jumpTrails;
  });

  const mineMissiles = createMemo((): MineMissileCue[] => {
    const t = tl();
    if (!t.active) return emptyMissiles;
    return playing(t.cues, t.playingIds, "mineMissile").map(asMineMissile);
  });

  const mineMissileTrails = createMemo(() => {
    const t = tl();
    if (t.mineMissileTrails.length === 0) return emptyTrails;
    return t.mineMissileTrails;
  });

  const spentMines = createMemo((): readonly Square[] => {
    const t = tl();
    if (t.spentMines.length === 0) return emptySpent;
    return t.spentMines;
  });

  const gasDropCues = createMemo((): GasDropCue[] => {
    const t = tl();
    if (!t.active) return emptyGas;
    return playing(t.cues, t.playingIds, "gasDrop").map(asGasDrop);
  });

  /** Squares that will / did absorb gas this resolve — hide intent canisters. */
  const gasDropSquares = createMemo((): ReadonlySet<string> => {
    const t = tl();
    if (!t.active) return new Set();
    return new Set(
      t.cues.filter((c): c is CueOf<"gasDrop"> => c.kind === "gasDrop").map((c) => c.at),
    );
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
    jumpCues,
    jumpTrails,
    mineMissiles,
    mineMissileTrails,
    spentMines,
    gasDropCues,
    gasDropSquares,
    moveProgress,
    moveLeg,
    deployCues,
    hideSquares,
  };
};
