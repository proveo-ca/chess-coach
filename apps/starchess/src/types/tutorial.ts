// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml, _spec/apps/starchess/tutorial/hints-and-coach.md
/** Tutorial stage ids (Breadcrumb / routes / script). */

import type { Square } from "chess.js";

import type { ScPiece, ScSpecialKind } from "@chess-coach/starchess-core";
import type { KerriganEmotion } from "~/types/coach";
import type { ReviewTurnPhase } from "~/types/review";

export type TutorialSectionId = "fog" | "specials" | "resolve" | "live-play";

/** Resolve timeline wave partitions for tutorial steppers. */
export type ResolveWaveId =
  | "specialBefore"
  | "attack"
  | "move"
  | "specialAfter";

/** Optional in-bubble CTA from a tutorial reaction or story intro. */
export type TutorialReactionAction =
  | { kind: "retryLesson"; label?: string }
  | { kind: "nextLesson"; label?: string }
  | { kind: "goSection"; section: TutorialSectionId; label: string };

/** Flat beat cursor: Turn N → Check → Intent → Resolve. */
export type TypewriterBeat =
  | { kind: "turn"; turn: number; resolveIndex: number; text: string }
  | {
      kind: "check";
      resolveIndex: number;
      hasCheck: boolean;
      text: string;
    }
  | { kind: "intent"; resolveIndex: number; text: string }
  | { kind: "resolve"; resolveIndex: number; text: string };

/**
 * Seed + board chrome for a live lesson — the catalog half of a story.
 * Storybook projects these; it never declares its own.
 */
export type LiveLessonBoard = {
  /** Opening position for this lesson. */
  scfen: string;
  /** Starting minerals for the viewer (defaults per host). */
  stored?: number;
  /** Force every Tank into a mode the seed cannot express. */
  tankMode?: "tank" | "siege";
  /** Auto-End threshold once the player has queued. */
  endTurnAfterQueue?: "first" | "moveAndSpecial";
  /** Script-driven opponent for live lessons. */
  opponent?: "adjutant";
  /**
   * Planning timer. `false` disables it (fog / specials lessons teach without
   * clock pressure); omitted means enabled, matching `autoArmTimer !== false`.
   */
  armTimer?: boolean;
  /**
   * What this board demonstrates, in prose. Storybook renders it as the story
   * description — the copy lives with the lesson, not in the story file.
   */
  docs?: string;
  /**
   * Imperative store choreography this lesson needs — a scripted opening or a
   * terminal condition. Resolved through the `demos/choreography/` registry.
   */
  choreography?: LessonChoreographyId;
  /**
   * Alert rings stick after the beat that introduced them, so fog and later
   * hints do not clear a last-seen square. `Command Center` also moves the ring when
   * the enemy Command Center is seen on a new square. `cc` always adds a ring
   * on the enemy Command Center's last *seen* square to each beat's own alerts.
   */
  alertLatch?: "sticky" | "king" | "cc";
};

/**
 * Latched alert rings. Empty `squares` means the lesson has not marked one yet.
 * `kingAt` is the square the ring was last pinned to, so a still-visible origin
 * cannot pull a scripted sighting backwards.
 */
export type AlertLatch = {
  squares: Square[];
  ccAt?: Square;
};

/** Lessons whose behavior is more than config. Registry: `demos/choreography/`. */
export type LessonChoreographyId =
  | "kingDefenseOpening"
  | "kingDefenseIIChecks"
  | "kingAttackTankCounter"
  | "kingHuntGraduation"
  | "siegeFocusCounter"
  | "pawnGasDefenseCounter"
  | "shipSnipeCounter"
  | "mineRa1Counter"
  | "turtledOpeningScript";

/**
 * Hint line drawn square-to-square — for a claim a ring cannot make, like the
 * long diagonal a piece x-rays down. Purely presentational; the board does not
 * check that the line is legal or unobstructed.
 */
export type TutorialBoardArrow = {
  from: Square;
  to: Square;
  /** Elbow of an L path (a Hoverbike hop). Straight when omitted. */
  via?: Square;
  /** Alert red. Omitted arrows stay guide green. */
  tone?: "alert";
};

/**
 * One condition a beat can gate on, beyond its own `turn`/`phase`. Replaces
 * two near-duplicate ~20-kind unions (`TutorialReactionWhen` in
 * `tutorialScript.ts`, this file's old `TutorialBoardHint.when`) that had to
 * be kept in sync by hand.
 *
 * `queued`/`and`/`or`/`not` (built via the constructors in `tutorial/when.ts`)
 * replace hand-written `re: /SCFEN\|.../` regexes for "is this action already
 * queued" — they check the *parsed* queue, not the raw wire string, so they
 * don't care about field order or B-vs-F timing the way a regex would.
 */
export type TutorialWhen =
  | TutorialQueuedWhen
  | TutorialAndWhen
  | TutorialOrWhen
  | TutorialNotWhen
  | { kind: "scfen"; re: RegExp }
  | { kind: "reviewPhase"; phase: ReviewTurnPhase }
  | { kind: "timelineActive" }
  | { kind: "chessSkin"; chess: boolean }
  | { kind: "targeting"; targetingKind: string }
  | { kind: "shipSniped" }
  | TutorialCoversWhen
  | TutorialTrajectoryWhen
  | TutorialBackrankWhen
  | TutorialMechaDiagonalWhen
  | TutorialMechaDeployReadyWhen
  | TutorialWrongQueueWhen
  | TutorialMechaThreatWhen
  | TutorialGasMarineWhen
  | TutorialForwardDeployWhen
  | TutorialPromotionWhen
  | TutorialChargeWhen
  | TutorialTankSiegeWhen
  | TutorialStopRunnerWhen
  | TutorialMineGuardWhen
  | TutorialShipJukeWhen
  | TutorialCcPressureWhen
  | TutorialCcThreatWhen
  | TutorialCcDeployWhen
  | TutorialBoardCondition;

/** A White or Black action already queued this turn, matched against the
 * *parsed* queue (see `tutorial/when.ts`'s `queued()`), e.g. `"C=a3c2"` or
 * `"B=siegeMode:e4"`. */
export type TutorialQueuedWhen = { kind: "queued"; color?: "w" | "b"; action: string };
export type TutorialAndWhen = { kind: "and"; all: readonly TutorialWhen[] };
export type TutorialOrWhen = { kind: "or"; any: readonly TutorialWhen[] };
export type TutorialNotWhen = { kind: "not"; not: TutorialWhen };

/** Board rings/arrows a beat paints. Any omitted field renders empty — a
 * matched beat's marks always replace the previous beat's wholesale, they
 * never merge. */
export type TutorialMark = {
  /** Guide-green rings. */
  squares?: readonly Square[];
  /** Alert-red rings. Same step as `squares`; both paint together. */
  alertSquares?: readonly Square[];
  gasSquares?: readonly Square[];
  cancelQueued?: string;
  gasOnMoveGhost?: boolean;
  gasOnCC?: boolean;
  gasOnPush?: boolean;
  pressureCC?: boolean;
  arrows?: readonly TutorialBoardArrow[];
  /**
   * Rewrite arrow origins to the viewer's BattleShip. The destination stays
   * the square named on the arrow.
   */
  fromBattleShip?: boolean;
};

/**
 * One scripted beat: a `when` (plus first-class `turn`/`phase` gates) paired
 * with the message and/or board marks that go together. Replaces the old
 * `reactions[]` + `hints[]` pair — no more writing the same `when` twice.
 * `say`/`mark` are independently optional: a beat can update just the coach
 * line, just the board marks, or both. Per field, the matching beat with the
 * highest `priority` wins, then the one with the most leaf gates
 * (`beatSpecificity`); array order only breaks a full tie.
 * SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
 */
export type TutorialBeat = {
  /** Rank over specificity; urgent beats (threat alerts) outrank tips. Default 0. */
  priority?: number;
  /** SCFEN turn field (`SCFEN|board|<turn>|…`), read from the wire itself. */
  turn?: number;
  phase?: ReviewTurnPhase | readonly ReviewTurnPhase[];
  when?: TutorialWhen;
  /** Coach line. Omit to leave the bubble to a later/fallback beat. */
  say?: string;
  emotion?: KerriganEmotion;
  action?: TutorialReactionAction;
  /** Momentary beat — shown while matched, never latched as the sticky line. */
  transient?: boolean;
  holdMs?: number;
  /** Board rings/arrows. Omit to leave marks to a later/fallback beat. */
  mark?: TutorialMark;
  final?: boolean;
};

/** One viewer-side unit covering a square, via core attack geometry. */
export type SquareCoverer = {
  from: Square;
  kind: ScPiece["type"];
};

/** Enemy-occupied watch squares mapped to their current coverers. */
export type SquareCovers = Partial<Record<Square, SquareCoverer[]>>;

/** Live tactics beat — fires when listed kinds cover the square. */
export type TutorialCoversWhen = {
  kind: "covers";
  square: Square;
  kinds?: readonly ScPiece["type"][];
};

/** Staging post against the enemy Command Center (deploy or ride target). */
export type AttackTrajectory = {
  /** Stable key for tests/debug (e.g. "deploy-b-g2-d5"). */
  key: string;
  /** Square to stage on — the drop or ride destination. */
  from: Square;
  /** Enemy Command Center square the staging attacks. */
  to: Square;
};

/** Live tactics beat — fires when the staging post is available. */
export type TutorialTrajectoryWhen = {
  kind: "trajectory";
  from: Square;
  to: Square;
};

/**
 * g1 guard. The back rank is empty of allies and an enemy has a higher file
 * than every ally — a piece already on the back rank is the guard itself.
 */
export type TutorialBackrankWhen = { kind: "backrankGuard" };

/**
 * Mecha on the g2–a8 diagonal. Requires the classical Attack/Move to still
 * be open; `phases` limits it to queueing.
 */
export type TutorialMechaDiagonalWhen = {
  kind: "mechaDiagonal";
  phases?: readonly ReviewTurnPhase[];
};

export type TutorialWrongQueueWhen = {
  kind: "wrongQueue";
  sequence: readonly (string | readonly string[])[];
};

export type TutorialMechaDeployReadyWhen = {
  kind: "mechaDeployReady";
  phases?: readonly ReviewTurnPhase[];
};

/** Mecha already on g2, Attack/Move still open. */
export type TutorialMechaThreatWhen = {
  kind: "mechaThreat";
  phases?: readonly ReviewTurnPhase[];
};

/**
 * Classical move is queued and gas remains — drop it on the marine being pushed.
 * The highlighted square is that marine, not a square listed here.
 */
export type TutorialGasMarineWhen = {
  kind: "gasOnMarine";
  phases?: readonly ReviewTurnPhase[];
};

/**
 * Deploy on empty g2, ahead of gassing the marine. Empty h2 is not a target.
 * The matcher returns the one square this beat should name.
 */
export type TutorialForwardDeployWhen = {
  kind: "forwardDeploy";
  square: Square;
  phases?: readonly ReviewTurnPhase[];
};

/** Marine on h6 or h7 can promote this turn and has not chosen a piece yet. */
export type TutorialPromotionWhen = {
  kind: "promotionChoice";
  phases?: readonly ReviewTurnPhase[];
};

/** BattleShip or Tank on h8, Attack/Move open, and nothing urgent is defending. */
export type TutorialChargeWhen = {
  kind: "chargeH8";
  phases?: readonly ReviewTurnPhase[];
};

/** Packed Tank on h5 with gas left. */
export type TutorialTankSiegeWhen = {
  kind: "tankSiege";
  phases?: readonly ReviewTurnPhase[];
};

/**
 * An enemy Marine on the last three ranks still needs stopping. One beat for
 * every file — the board arrow is the stopper, not a second regex.
 */
export type TutorialStopRunnerWhen = { kind: "stopRunner" };

/**
 * Two or more of our Spider Mines are down beside the Hoverbike that laid
 * them. The hint rings the mines and draws the Hoverbike's hops; the line
 * names how many files that one unit guards.
 */
export type TutorialMineGuardWhen = { kind: "mineGuard" };

/**
 * The BattleShip's next Tactical Jump, read from where it stands now: a lit,
 * empty, unattacked landing, preferring one that re-checks the enemy
 * Command Center. The hint's ring and arrow are computed, not listed.
 */
export type TutorialShipJukeWhen = { kind: "shipJuke" };

/**
 * Any ally unit already attacking the enemy Command Center, wherever it
 * stands. The hint's ring(s) and arrow(s) are computed, not listed.
 */
export type TutorialCcPressureWhen = {
  kind: "ccPressure";
  phases?: readonly ReviewTurnPhase[];
};

/**
 * A *visible* enemy unit attacks the ally Command Center. The hint alert-rings
 * each attacker and draws its arrow onto the Command Center.
 */
export type TutorialCcThreatWhen = {
  kind: "ccThreat";
  phases?: readonly ReviewTurnPhase[];
};

/**
 * An affordable gas deploy on the ally Command Center's ring attacks the
 * *visible* enemy Command Center or a square around it. Line and marks are
 * computed (`ccDeployPressure`).
 */
export type TutorialCcDeployWhen = {
  kind: "ccDeploy";
  phases?: readonly ReviewTurnPhase[];
};

/**
 * White BattleShip was on h8 and is gone. Armed while it stands there; `sniped`
 * stays up through the resolve that removes it.
 */
export type BattleShipWatch = { onH8: boolean; sniped: boolean };

/** SCFEN piece letter: White upper-case, Black lower-case. */
export type ScfenPieceLetter = "K" | "Q" | "R" | "B" | "N" | "P" | "k" | "q" | "r" | "b" | "n" | "p";

/**
 * Command Center HP, read from the SCFEN lives field. The tutorial always
 * plays White, so `own` is White's and `enemy` Black's. An omitted side
 * matches any HP.
 */
export type TutorialLivesWhen = {
  kind: "lives";
  own?: number;
  enemy?: number;
  phases?: readonly ReviewTurnPhase[];
};

/** None of these units is left anywhere on the board. */
export type TutorialLostWhen = {
  kind: "lost";
  pieces: readonly ScfenPieceLetter[];
  phases?: readonly ReviewTurnPhase[];
};

/** A White special of this kind, queued from this square. */
export type QueuedSpecial = { kind: ScSpecialKind; from: Square };

/** Units standing on named squares, optionally qualified by White's queue. */
export type TutorialBoardWhen = {
  kind: "board";
  /** Every listed square holds exactly this unit. */
  at: Partial<Record<Square, ScfenPieceLetter>>;
  queued?: QueuedSpecial;
  notQueued?: QueuedSpecial;
  /** No White action (classical or special) lands on this square. */
  notQueuedOnto?: Square;
  phases?: readonly ReviewTurnPhase[];
};

/**
 * Named board conditions — what a hand-built SCFEN regex used to spell out.
 * Valid in reactions, hints, `completeWhen` and `restartWhen` alike.
 */
export type TutorialBoardCondition = TutorialLivesWhen | TutorialLostWhen | TutorialBoardWhen;

/** Auto-advance to next lesson when live intent / board matches. */
export type TutorialCompleteWhen =
  | {
      kind: "scfen";
      re: RegExp;
    }
  | TutorialBoardCondition
  | {
      /** Live intent queue — classical + special stack (gas↔move, etc.). */
      kind: "queue";
      /** Require a `C` classical action. */
      classical?: boolean;
      /** Require this special kind on B or F (e.g. `stimStep`). */
      specialKind?: string;
    }
  | {
      /** Typewriter stepper (Turn Resolution) at a given turn + beat. */
      kind: "typewriter";
      turn: number;
      beat: "turn" | "check" | "intent" | "resolve";
    }
  | {
      /** Auto-advance after ms on the lesson — no board action required. */
      kind: "elapsed";
      ms: number;
    };

/** One guide-bubble line (intro or reaction). */
export type TutorialLine = {
  comment: string;
  emotion?: KerriganEmotion;
  action?: TutorialReactionAction;
  /** `intro` = story.comment fallback; `reaction` = when-clause hit. */
  source: "intro" | "reaction";
  /** Momentary beat — shown while matched, never latched as the sticky line. */
  transient?: boolean;
  holdMs?: number;
};

/**
 * Latch for guide bubble: story intro only before the first action/reaction.
 * After that, keep the last reaction (never bounce back to the opening line).
 */
export type TutorialLineHold = {
  lessonKey: string;
  /** First live SCFEN seen for this lesson (seed). */
  baselineScfen?: string;
  /** Last `turnStartChecksApplied` seen — the flip re-baselines the seed. */
  checksApplied?: boolean;
  /** Intro already retired (user acted or a reaction fired). */
  introDone: boolean;
  /** Last reaction line to keep when no when-clause matches. */
  sticky?: TutorialLine;
};
