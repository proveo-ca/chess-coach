/**
 * Map match timeline cues → AnimationStage overlay props.
 *
 * Important: return the same cue object refs from `timeline.cues` while a cue
 * is playing. Remapping into new objects on every TIMELINE_COMMIT remounts
 * Solid `<For>` rows and restarts CSS attack animations (knight/hoverbike
 * “plays twice”, bishop gatling looks like a loop).
 *
 * Memos also cache by playing-id key so idle ticks reuse the prior array.
 */
import { createMemo } from "solid-js";
import type { Square } from "chess.js";

import { deriveVisualFrame } from "~/presentation/animations/visualFrame";
import { capCues, capForDensity, type VfxDensity } from "~/presentation/animations/vfxPerf";
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

/** Cache last filtered list by id-key so Solid sees stable array identity. */
const stablePlaying = <K extends TimelineCue["kind"]>() => {
  let key = "";
  let prev: CueOf<K>[] = [];
  return (cues: readonly TimelineCue[], ids: readonly string[], kind: K): CueOf<K>[] => {
    if (ids.length === 0) {
      key = "";
      prev = [];
      return prev;
    }
    const nextKey = `${kind}:${ids.join(",")}`;
    if (nextKey === key) return prev;
    key = nextKey;
    prev = playing(cues, ids, kind);
    return prev;
  };
};

const playAttacks = stablePlaying<"attack">();
const playDeaths = stablePlaying<"death">();
const playMoves = stablePlaying<"move">();
const playDeploys = stablePlaying<"deploy">();
const playGas = stablePlaying<"gasDrop">();
const playMissiles = stablePlaying<"mineMissile">();

const asMineMissile = (c: CueOf<"mineMissile">): MineMissileCue => ({
  id: c.id,
  from: c.from,
  to: c.to,
  color: c.color,
});

export const useCombatOverlays = (store: MatchStore) => {
  const tl = () => store.timeline();

  /**
   * Review playback runs under phase === "gameOver" while the timeline is
   * active (matchReducer guards REVIEW_PLAY to gameOver; live play stays
   * resolving until TIMELINE_DONE, which resets the timeline). Gating on
   * `active` keeps live game-over trail fades (which outlive TIMELINE_DONE)
   * on full caps so they never get truncated by the review caps.
   */
  const density = createMemo(
    (): VfxDensity =>
      tl().active && store.shell().phase === "gameOver" ? "review" : "full",
  );
  const cap = createMemo(() => capForDensity(density()));

  /** Stable empty — avoid new `{}` / `[]` each memo run when idle. */
  const emptyProgress: Record<string, 0 | 1> = {};
  const emptyLeg: Record<string, 0 | 1> = {};
  const emptyDying: Record<string, boolean> = {};
  const emptyTrails: QueenJumpTrail[] = [];
  const emptyGas: GasDropCue[] = [];
  const emptyMissiles: MineMissileCue[] = [];
  const emptySpent: Square[] = [];
  const emptyAttacks: AttackCue[] = [];
  const emptyDeaths: DeathCue[] = [];
  const emptyMoves: MoveCue[] = [];
  const emptyDeploys: DeployCue[] = [];
  let lastMissileKey = "";
  let lastMissiles: MineMissileCue[] = emptyMissiles;
  let lastHullKey = "";
  let lastHull: MoveCue[] = emptyMoves;
  let lastJumpKey = "";
  let lastJump: MoveCue[] = emptyMoves;

  const attackCues = createMemo((): readonly AttackCue[] => {
    const t = tl();
    if (!t.active) return emptyAttacks;
    return capCues(playAttacks(t.cues, t.playingIds, "attack"), cap()) as readonly AttackCue[];
  });

  const deathCues = createMemo((): readonly DeathCue[] => {
    const t = tl();
    if (!t.active) return emptyDeaths;
    return capCues(playDeaths(t.cues, t.playingIds, "death"), cap()) as readonly DeathCue[];
  });

  const moveCues = createMemo((): readonly MoveCue[] => {
    const t = tl();
    if (!t.active) return emptyMoves;
    const all = playMoves(t.cues, t.playingIds, "move");
    const key = `hull:${cap()}:${all.map((c) => c.id).join(",")}`;
    if (key === lastHullKey) return lastHull;
    lastHullKey = key;
    lastHull = [...capCues(all.filter((c) => !c.queenJump), cap())] as MoveCue[];
    return lastHull;
  });

  const jumpCues = createMemo((): readonly MoveCue[] => {
    const t = tl();
    if (!t.active) return emptyMoves;
    const all = playMoves(t.cues, t.playingIds, "move");
    const key = `jump:${cap()}:${all.map((c) => c.id).join(",")}`;
    if (key === lastJumpKey) return lastJump;
    lastJumpKey = key;
    lastJump = [...capCues(all.filter((c) => !!c.queenJump), cap())] as MoveCue[];
    return lastJump;
  });

  const attackDying = createMemo((): Record<string, boolean> => {
    const d = tl().attackDying;
    return Object.keys(d).length === 0 ? emptyDying : (d as Record<string, boolean>);
  });

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
    return capCues(t.jumpTrails, cap());
  });

  const mineMissiles = createMemo((): readonly MineMissileCue[] => {
    const t = tl();
    if (!t.active) return emptyMissiles;
    const raw = playMissiles(t.cues, t.playingIds, "mineMissile");
    const key = `${cap()}:${raw.map((c) => c.id).join(",")}`;
    if (key === lastMissileKey) return lastMissiles;
    lastMissileKey = key;
    // Mine missiles need a thin projection object (timeline cue is a superset).
    lastMissiles = [...capCues(raw.map(asMineMissile), cap())];
    return lastMissiles;
  });

  const mineMissileTrails = createMemo(() => {
    const t = tl();
    if (t.mineMissileTrails.length === 0) return emptyTrails;
    return capCues(t.mineMissileTrails, cap());
  });

  const spentMines = createMemo((): readonly Square[] => {
    const t = tl();
    if (t.spentMines.length === 0) return emptySpent;
    return t.spentMines;
  });

  const gasDropCues = createMemo((): readonly GasDropCue[] => {
    const t = tl();
    if (!t.active) return emptyGas;
    return capCues(playGas(t.cues, t.playingIds, "gasDrop"), cap()) as readonly GasDropCue[];
  });

  const deployCues = createMemo((): readonly DeployCue[] => {
    const t = tl();
    if (!t.active) return emptyDeploys;
    return capCues(playDeploys(t.cues, t.playingIds, "deploy"), cap()) as readonly DeployCue[];
  });

  /**
   * Prefer ownership from playing cues + attackDying when combat overlays are
   * present; otherwise fall back to timeline.hiddenSquares.
   * LiveStarChessBoard still merges kingDamage + auto-deploy extras.
   */
  const hideSquares = createMemo((): ReadonlySet<Square> => {
    const attacks = attackCues();
    const deaths = deathCues();
    const moves = moveCues();
    const jumps = jumpCues();
    const deploys = deployCues();
    if (
      attacks.length === 0 &&
      deaths.length === 0 &&
      moves.length === 0 &&
      jumps.length === 0 &&
      deploys.length === 0
    ) {
      return tl().hiddenSquares;
    }
    return deriveVisualFrame({
      attackCues: attacks,
      attackDying: attackDying(),
      deathCues: deaths,
      moveCues: moves,
      jumpCues: jumps,
      deployCues: deploys,
    }).hideSquares;
  });

  return {
    attackCues,
    attackDying,
    deathCues,
    moveCues,
    jumpCues,
    jumpTrails,
    mineMissiles,
    mineMissileTrails,
    spentMines,
    gasDropCues,
    moveProgress,
    moveLeg,
    deployCues,
    hideSquares,
  };
};
