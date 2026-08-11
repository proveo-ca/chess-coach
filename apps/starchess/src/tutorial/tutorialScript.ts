/**
 * Tutorial script — Stage → Story → Selena comment (+ optional store/board reactions).
 * // SPEC: _spec/apps/starchess/menu-flow.puml
 */
import type { Square } from "chess.js";

import type { KerriganEmotion } from "~/types/coach";
import type {
  TutorialBoardHint,
  TutorialCompleteWhen,
  TutorialLine,
  TutorialLineHold,
  TutorialReactionAction,
  TutorialSectionId,
} from "~/types/tutorial";
import type { ReviewTurnPhase } from "~/types/review";

export type {
  TutorialBoardHint,
  TutorialCompleteWhen,
  TutorialLine,
  TutorialLineHold,
  TutorialReactionAction,
  TutorialSectionId,
} from "~/types/tutorial";

export type TutorialReactionWhen =
  /** DualNav / phase-stepper review phase. */
  | { kind: "reviewPhase"; phase: ReviewTurnPhase; /** 1-based planning ordinal. */ turn?: number }
  /** Timeline cues playing (resolve VFX). */
  | { kind: "timelineActive" }
  /** Fog section Chess skin toggle. */
  | { kind: "chessSkin"; chess: boolean }
  /** Live board SCFEN matches this pattern. */
  | { kind: "scfen"; re: RegExp }
  /** 1-based planning ordinal (`snap.turn + 1`; seed turn 0 → 1). */
  | { kind: "turn"; turn: number }
  /** Live targeting mode (e.g. Charon armed → `bishopSnipe`). */
  | { kind: "targeting"; targetingKind: string };

export type TutorialReaction = {
  when: TutorialReactionWhen;
  comment: string;
  emotion?: KerriganEmotion;
  /** Optional in-bubble CTA (e.g. retry after ally CC dies). */
  action?: TutorialReactionAction;
};

export type TutorialStoryScript = {
  id: string;
  title: string;
  /** Default Selena line when the story is focused. */
  comment: string;
  emotion?: KerriganEmotion;
  /** Optional CTA on the default intro line. */
  action?: TutorialReactionAction;
  /** Optional overlays when MatchStore / board state changes. */
  reactions?: readonly TutorialReaction[];
  /** Optional destination rings on the live board. */
  hints?: readonly TutorialBoardHint[];
  /**
   * When live SCFEN matches (and timeline is idle), tutorial advances as if
   * the player clicked Next Lesson. Must not match the lesson seed SCFEN.
   */
  completeWhen?: TutorialCompleteWhen;
  /**
   * When matched after resolve, remount/restart this lesson (e.g. ship died).
   * Must not match the lesson seed SCFEN.
   */
  restartWhen?: TutorialCompleteWhen;
};

export type TutorialStageScript = {
  id: TutorialSectionId;
  label: string;
  stories: readonly TutorialStoryScript[];
};

/** King lessons — SCFEN `|wb|` lives; ally white digit, enemy black digit. */
const KING_ALLY_HP2: TutorialReaction = {
  when: { kind: "scfen", re: /SCFEN\|[^|]+\|\d+\|2[0-3]\|/ },
  comment: "Checked, a fire represents the damage.",
  emotion: "shocked",
};
const KING_ALLY_HP1: TutorialReaction = {
  when: { kind: "scfen", re: /SCFEN\|[^|]+\|\d+\|1[0-3]\|/ },
  comment: "Another hit and it's done",
  emotion: "thinking",
};
const KING_ALLY_DEAD: TutorialReaction = {
  when: { kind: "scfen", re: /SCFEN\|[^|]+\|\d+\|0[0-3]\|/ },
  comment: "Oh no! Give it another try, it's a lot to process",
  emotion: "shocked",
  action: { kind: "retryLesson", label: "Retry lesson" },
};
const KING_ENEMY_DEAD: TutorialReaction = {
  when: { kind: "scfen", re: /SCFEN\|[^|]+\|\d+\|[0-3]0\|/ },
  comment: "Thinking the same thing",
  emotion: "happy",
};

/** Review DualNav king-hunt — HP teaching only (no live retry / incomplete flows). */
const KING_HUNT_REVIEW_REACTIONS: readonly TutorialReaction[] = [
  KING_ALLY_HP2,
  KING_ALLY_HP1,
  KING_ENEMY_DEAD,
];

export const TUTORIAL_SCRIPT: readonly TutorialStageScript[] = [
  {
    id: "fog",
    label: "Fog of War",
    stories: [
      {
        id: "king",
        title: "King",
        comment:
          "The pieces move the same as Chess! Except now the pieces have vision.",
        emotion: "watching",
        // Seed turn 0 — any command-center resolve advances turn ≥ 1.
        completeWhen: { kind: "scfen", re: /SCFEN\|[^|]+\|[1-9]/ },
        reactions: [
          {
            when: { kind: "chessSkin", chess: true },
            comment: "Classic board, classic pieces for your reference.",
            emotion: "watching",
          },
        ],
      },
      {
        id: "pawn",
        title: "Pawn",
        comment:
          "With each piece having vision, slowly the fog of war clears.",
        emotion: "idle",
        // After promote (white piece on rank 8) — seed is `7k` only.
        completeWhen: { kind: "scfen", re: /SCFEN\|[^|/]*[NBRQ]/ },
        reactions: [
          {
            // White P on FEN rank 7 (2nd placement row) — promote tease.
            when: { kind: "scfen", re: /SCFEN\|[^/]*\/[^/]*P/ },
            comment: "Go ahead promote. See how the pieces look!",
            emotion: "happy",
          },
        ],
        hints: [
          { squares: ["d8"] },
        ],
      },
      {
        id: "knight",
        title: "Knight",
        comment: "The Knight now rides a Hoverbike! As it moves, it clears the fog, pay close attention!",
        emotion: "watching",
        // Path complete: Ng5 — hold so "Did you see that?!" is readable.
        completeWhen: {
          kind: "scfen",
          re: /SCFEN\|(?:[^/]*\/){3}6N1/,
          delayMs: 2000,
        },
        reactions: [
          // N on g5 (`6N1` on rank 5 — file g, not `5N2`/f)
          {
            when: { kind: "scfen", re: /SCFEN\|(?:[^/]*\/){3}6N1/ },
            comment: "Did you see that?!",
            emotion: "shocked",
          },
          // N on e6 (`4N3` on rank 6)
          {
            when: { kind: "scfen", re: /SCFEN\|(?:[^/]*\/){2}4N3/ },
            comment: "Now move to g5",
            emotion: "watching",
          },
        ],
        hints: [
          // Nd4→e6→g5 — clear when the hoverbike sits on g5 (`6N1` on rank 5).
          { when: { kind: "scfen", re: /SCFEN\|(?:[^/]*\/){3}6N1/ }, squares: [] },
          // On e6 (`4N3` on rank 6) → next hop g5.
          {
            when: { kind: "scfen", re: /SCFEN\|(?:[^/]*\/){2}4N3/ },
            squares: ["g5"],
          },
          { squares: ["e6"] },
        ],
      },
      {
        id: "bishop",
        title: "Bishop",
        comment:
          "Units capture just like Chess, if it wasn't for the fog...",
        emotion: "thinking",
        // After Bxg7 + turn-open check chips black HP.
        completeWhen: { kind: "scfen", re: /SCFEN\|7k\/6B1\/.*\|32\|/, delayMs: 2000, },
        reactions: [
          // After Bxg7, turn-open check chips black HP (`|32|`) with Bg7.
          {
            when: { kind: "scfen", re: /SCFEN\|7k\/6B1\/.*\|32\|/ },
            comment: "...Did you just set that King on fire?",
            emotion: "thinking",
          },
          {
            when: { kind: "reviewPhase", phase: "resolve" },
            comment: "A pawn blocks your way!?",
            emotion: "shocked",
          },
        ],
        hints: [{ squares: ["h8"] }],
      },
      {
        id: "rook-tank",
        title: "Rook (tank)",
        comment:
          "This is a rook, it would also capture if it wasn't for the fog...",
        emotion: "watching",
        // Any resolve after the fog-edge capture path.
        completeWhen: { kind: "scfen", re: /SCFEN\|[^|]+\|[1-9]/ },
        reactions: [
          {
            when: { kind: "reviewPhase", phase: "resolve" },
            comment: "Reveal pawn on d7, capture.",
            emotion: "happy",
          },
        ],
        hints: [{ squares: ["d8"] }],
      },
      {
        id: "rook-siege",
        title: "Rook (siege)",
        comment:
          "This is the immobile rook mode; it has the biggest range. \nIt reveals the entire board when in the center!",
        emotion: "scanning",
        // All four cross pawns gone (a4/d2/d7/h4) — placement has no black `p`.
        completeWhen: {
          kind: "scfen",
          re: /SCFEN\|[^|p]*\|/,
          delayMs: 1200,
        },
        reactions: [
          {
            when: { kind: "scfen", re: /SCFEN\|[^|p]*\|/ },
            comment: "Four shells, four kills — siege owns the cross.",
            emotion: "happy",
          },
          {
            when: { kind: "timelineActive" },
            comment: "Boom + smoke on impact. Siege never slides — only shells.",
            emotion: "shocked",
          },
        ],
        // Shell every pawn on the file/rank cross (auto-End each shot).
        hints: [
          { when: { kind: "scfen", re: /SCFEN\|[^|p]*\|/ }, squares: [] },
          { squares: ["a4", "d2", "d7", "h4"] },
        ],
      },
      {
        id: "queen",
        title: "Queen",
        comment:
          "And finally, the Queen.",
        emotion: "watching",
        completeWhen: { kind: "scfen", re: /SCFEN\|[^|]+\|[1-9]/, delayMs: 2000 },
      },
      {
        id: "mine",
        title: "Spider Mine",
        comment:
          "Hoverbikes can plant mines; they can only see their own squares. How? Let me show you!",
        emotion: "happy",
        action: {
          kind: "goSection",
          section: "specials",
          label: "See Specials",
        },
        reactions: [
          {
            when: { kind: "chessSkin", chess: true },
            comment: "Even on wood, that mine is a one-square lantern.",
            emotion: "watching",
          },
        ],
      },
    ],
  },
  {
    id: "specials",
    label: "Special Moves",
    stories: [
      {
        id: "marine",
        title: "Marine",
        comment:
          "See that gas canister in the bottom? Drag and drop it into a Marine. \nTry stacking a 2 pawn move with gas!",
        emotion: "idle",
        // Stack complete: classical + pawnDouble gas (either order). Hold 1s after resolve.
        completeWhen: {
          kind: "queue",
          classical: true,
          specialKind: "pawnDouble",
          delayMs: 1000,
        },
        reactions: [
          {
            // Gas on a Marine — B (before move) or F (after move).
            when: { kind: "scfen", re: /[BF]=pawnDouble:/ },
            comment: "Oh, yeah!",
            emotion: "watching",
          },
        ],
      },
      {
        id: "cc",
        title: "Command Center",
        comment:
          "The Command Center can deploy units with gas!",
        emotion: "watching",
        // Deploy queued (B=spawn) → auto-End → unit on board → next lesson.
        completeWhen: {
          kind: "queue",
          specialKind: "spawn",
          delayMs: 1000,
        },
      },
      {
        id: "hoverbike",
        title: "Hoverbike",
        comment:
          "Use gas on a Hoverbike to deploy a mine. You can deploy the mine before or after moving!",
        emotion: "scanning",
        // Two white mines on the board — `M:w:d4e6;b:` (square pairs after M:w:).
        completeWhen: {
          kind: "scfen",
          re: /M:w:(?:[a-h][1-8]){2}/,
          delayMs: 1000,
        },
      },
      {
        id: "mecha",
        title: "Mecha",
        comment:
          "Mecha can see BattleShips anywhere in the board! \nArm your Mecha with 2 gas canisters.",
        emotion: "thinking",
        // Bishop on e5 after capturing the marine (rank 5 = 4th FEN row).
        completeWhen: {
          kind: "scfen",
          re: /SCFEN\|(?:[^/]*\/){3}4B3/,
          delayMs: 2000,
        },
        reactions: [
          // After resolve — bishop sits on e5 (captured the marine).
          {
            when: { kind: "scfen", re: /SCFEN\|(?:[^/]*\/){3}4B3/ },
            comment: "It shoots up and down at the same time!",
            emotion: "happy",
          },
          // Ship snipe queued — still need the marine capture.
          {
            when: { kind: "scfen", re: /bishopSnipe:/ },
            comment: "Plan to attack that marine too!",
            emotion: "watching",
          },
          // Gas-armed Charon targeting the battleship.
          {
            when: { kind: "targeting", targetingKind: "bishopSnipe" },
            comment: "Now plan to attack that ship!",
            emotion: "scanning",
          },
        ],
        hints: [
          { when: { kind: "scfen", re: /bishopSnipe:/ }, squares: ["e5"] },
          { squares: ["h8"] },
        ],
      },
      {
        id: "ship",
        title: "BattleShip",
        comment:
          "The BattleShip can teleport anywhere in the map in an instant. \nIt only takes 2 gas canisters.",
        emotion: "watching",
        // White Q still on board after turn advances (survived Charon).
        completeWhen: {
          kind: "scfen",
          re: /SCFEN\|[^|]*Q[^|]*\|(?:1[2-9]|[2-9]\d+)/,
          delayMs: 1200,
        },
        // Turn advanced and no white Q — Charon hit; auto-restart lesson.
        restartWhen: {
          kind: "scfen",
          re: /SCFEN\|[^|Q]*\|(?:1[2-9]|[2-9]\d+)/,
          delayMs: 800,
        },
        reactions: [
          // Ship dead after Charon (no white Q, turn advanced) — before auto-restart.
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|[^|Q]*\|(?:1[2-9]|[2-9]\d+)/,
            },
            comment: "Bruh",
            emotion: "watching",
          },
          {
            when: { kind: "scfen", re: /queenWarp:/ },
            comment: "Lightspeed escape!",
            emotion: "shocked",
          },
        ],
      },
      {
        id: "tank",
        title: "Siege Tank",
        comment:
          "The tank has 2 modes: sieged and mobile. \nGas can change the mode. \nTry stacking mode change with a move!",
        emotion: "happy",
        // Move + gas siege toggle (either order via B/F rookSiege + C).
        completeWhen: {
          kind: "queue",
          classical: true,
          specialKind: "rookSiege",
          delayMs: 2000,
        },
      },
    ],
  },
  {
    id: "resolve",
    label: "Turn Resolution",
    stories: [
      {
        id: "combat-chain",
        title: "Combat Chain",
        comment:
          "In StarChess, turns are simultaneous, with 3 phases:\n 1. Checks \n2. Intents: Players queue actions \n3. Resolve: The actions simultaneously.",
        emotion: "idle",
        // After typewriter finishes Turn 3 Resolve → King Damage section.
        completeWhen: {
          kind: "typewriter",
          turn: 3,
          beat: "resolve",
          delayMs: 1200,
        },
        reactions: [
          {
            when: { kind: "reviewPhase", phase: "check" },
            comment: "Check phase — turn-open shots before anyone queues intent.",
            emotion: "shocked",
          },
          {
            when: { kind: "reviewPhase", phase: "intent" },
            comment: "Intent ghosts are promises. Nothing moves until Resolve.",
            emotion: "watching",
          },
          {
            when: { kind: "reviewPhase", phase: "resolve" },
            comment:
              "Resolve in the following order: \n1. (Gas) Specials \n2. Attacks \n3. Moves \n4. (Gas) Specials",
            emotion: "scanning",
          },
          {
            when: { kind: "timelineActive" },
            comment: "VFX is the contract — attacks die before occupies land.",
            emotion: "thinking",
          },
        ],
      },
    ],
  },
  {
    id: "king",
    label: "King Damage",
    stories: [
      {
        id: "king-hunt",
        title: "King Hunt",
        comment:
          "A Command Center crumbles when being checked 3 times.",
        emotion: "watching",
        // Blue (white) king HP → 0 — advance to King Defense.
        completeWhen: {
          kind: "scfen",
          re: /SCFEN\|[^|]+\|\d+\|0[0-3]\|/,
          delayMs: 1200,
        },
        reactions: KING_HUNT_REVIEW_REACTIONS,
      },
      {
        id: "king-defense",
        title: "King Defense",
        comment: "",
        emotion: "shocked",
        // Enemy bishop off the board (captured on g3).
        completeWhen: {
          kind: "scfen",
          re: /SCFEN\|[^|b]*\|/,
          delayMs: 1200,
        },
        restartWhen: {
          kind: "scfen",
          re: /SCFEN\|[^|]+\|\d+\|0[0-3]\|/,
          delayMs: 800,
        },
        reactions: [
          {
            when: { kind: "scfen", re: /B=spawn:/ },
            comment: "Attach the Mecha!",
            emotion: "watching",
          },
          // After Turn 2 check chips ally CC to HP 2 (`|2b|`).
          {
            when: { kind: "scfen", re: /SCFEN\|[^|]+\|\d+\|2[0-3]\|/ },
            comment:
              "Your Command Center is under attack! \nDeploy a Marine to save it.",
            emotion: "shocked",
          },
        ],
        hints: [
          { when: { kind: "scfen", re: /spawn:[^:;]*:f2/ }, squares: ["g3"] },
          { squares: ["f2"] },
        ],
      },
      {
        id: "king-hunt-live",
        title: "King Hunt (live)",
        comment: "",
        emotion: "happy",
        // Enemy (black) CC destroyed — `|w0|` lives. Modal opens (play single player).
        completeWhen: {
          kind: "scfen",
          re: /SCFEN\|[^|]+\|\d+\|[0-3]0\|/,
          delayMs: 1200,
        },
        reactions: [
          // Terminal HP first — never bury retry / win under board tips.
          KING_ALLY_DEAD,
          KING_ENEMY_DEAD,
          {
            // ≥2 black pawns in placement (`p`).
            when: { kind: "scfen", re: /SCFEN\|(?:[^|p]*p){2}[^|]*\|/ },
            comment:
              "Stop the enemy pawns! \nKeep a guard in g1 for your Command Center.",
            emotion: "shocked",
          },
          {
            // White Marine on rank 5 + ally HP ≥ 2 (`|wb|` white digit 2–3).
            when: {
              kind: "scfen",
              re: /SCFEN\|(?:[^/]*\/){3}[^/]*P[^|]*\|\d+\|[23][0-3]\|/,
            },
            comment:
              "Yes, keep pushing your Marine. \nRemember Gas gives you an extra step!",
            emotion: "happy",
          },
          KING_ALLY_HP2,
          KING_ALLY_HP1,
          {
            when: { kind: "reviewPhase", phase: "intent", turn: 1 },
            comment:
              "The enemy King is overextended. \nPunish it!. \nDeploy more units.",
            emotion: "watching",
          },
          {
            // Second planning window (wire turn 1 → ordinal 2).
            when: { kind: "turn", turn: 2 },
            comment: "Prioritize planting mines with your hoverbike!",
            emotion: "watching",
          },
        ],
        hints: [
          // Opening planning (wire turn 0).
          { when: { kind: "scfen", re: /SCFEN\|[^|]+\|0\|/ }, squares: ["h2"] },
          // Turn 2 planning (wire turn 1).
          { when: { kind: "scfen", re: /SCFEN\|[^|]+\|1\|/ }, squares: ["c2"] },
          { squares: [] },
        ],
      },
    ],
  },
];

export const tutorialStage = (
  stageId: TutorialSectionId,
): TutorialStageScript =>
  TUTORIAL_SCRIPT.find((s) => s.id === stageId) ?? TUTORIAL_SCRIPT[0]!;

export const tutorialStory = (
  stageId: TutorialSectionId,
  storyId: string,
): TutorialStoryScript | undefined =>
  tutorialStage(stageId).stories.find((s) => s.id === storyId);

/** Normalize route / breadcrumb aliases → canonical stage id. */
export const parseTutorialSection = (
  raw: string | undefined,
): TutorialSectionId => {
  if (raw === "specials" || raw === "special-moves") return "specials";
  if (raw === "resolve" || raw === "turn-resolution") return "resolve";
  if (raw === "king" || raw === "king-damage") return "king";
  if (raw === "fog" || raw === "fog-of-war") return "fog";
  return "fog";
};

/** First story id when missing / unknown — keeps deep links resilient. */
export const resolveTutorialStoryId = (
  stageId: TutorialSectionId,
  storyId: string | undefined,
): string => {
  const stories = tutorialStage(stageId).stories;
  if (storyId && stories.some((s) => s.id === storyId)) return storyId;
  return stories[0]!.id;
};

/** Canonical tutorial deep link: `/tutorial/fog/king`. */
export const tutorialPath = (
  stageId: TutorialSectionId,
  storyId?: string,
): string => {
  const id = resolveTutorialStoryId(stageId, storyId);
  return `/tutorial/${stageId}/${id}`;
};

export const adjacentTutorialStoryId = (
  stageId: TutorialSectionId,
  storyId: string,
  delta: -1 | 1,
  opts?: { wrap?: boolean },
): string | null => {
  const stories = tutorialStage(stageId).stories;
  const idx = stories.findIndex((s) => s.id === storyId);
  if (idx < 0) return null;
  if (opts?.wrap) {
    const next = (idx + delta + stories.length) % stories.length;
    return stories[next]!.id;
  }
  const next = idx + delta;
  if (next < 0 || next >= stories.length) return null;
  return stories[next]!.id;
};

export type TutorialScriptContext = {
  stageId: TutorialSectionId;
  storyId: string;
  reviewPhase?: ReviewTurnPhase;
  timelineActive?: boolean;
  chessSkin?: boolean;
  /** Live `formatScFen` wire for `scfen` reactions. */
  scfen?: string;
  /** 1-based planning ordinal (`snap.turn + 1`; seed turn 0 → 1). */
  turn?: number;
  /** Live targeting kind (`bishopSnipe`, …). */
  targetingKind?: string | null;
};

/** Pick the most specific Selena line for the current board/store context. */
export const resolveTutorialLine = (ctx: TutorialScriptContext): TutorialLine => {
  const story = tutorialStory(ctx.stageId, ctx.storyId);
  if (!story) {
    return {
      comment: "Stay sharp — fog and fire favor the prepared.",
      emotion: "idle",
      source: "intro",
    };
  }

  const reactions = story.reactions ?? [];
  const reactionLine = (r: (typeof reactions)[number]): TutorialLine => ({
    comment: r.comment,
    emotion: r.emotion ?? story.emotion,
    ...(r.action ? { action: r.action } : {}),
    source: "reaction",
  });

  for (const r of reactions) {
    const w = r.when;
    if (w.kind === "reviewPhase" && ctx.reviewPhase === w.phase) {
      if (w.turn != null && ctx.turn !== w.turn) continue;
      return reactionLine(r);
    }
    if (w.kind === "timelineActive" && ctx.timelineActive) {
      return reactionLine(r);
    }
    if (w.kind === "chessSkin" && ctx.chessSkin === w.chess) {
      return reactionLine(r);
    }
    if (w.kind === "scfen" && ctx.scfen != null && w.re.test(ctx.scfen)) {
      return reactionLine(r);
    }
    if (w.kind === "turn" && ctx.turn === w.turn) {
      return reactionLine(r);
    }
    if (
      w.kind === "targeting" &&
      ctx.targetingKind != null &&
      ctx.targetingKind === w.targetingKind
    ) {
      return reactionLine(r);
    }
  }

  return {
    comment: story.comment,
    emotion: story.emotion,
    ...(story.action ? { action: story.action } : {}),
    source: "intro",
  };
};

export const holdTutorialLine = (
  hold: TutorialLineHold,
  lessonKey: string,
  raw: TutorialLine,
  ctx: Pick<
    TutorialScriptContext,
    "scfen" | "timelineActive" | "reviewPhase"
  >,
): { hold: TutorialLineHold; line: TutorialLine } => {
  let h =
    hold.lessonKey === lessonKey
      ? hold
      : {
          lessonKey,
          baselineScfen: undefined,
          introDone: false,
          sticky: undefined,
        };

  if (ctx.scfen && h.baselineScfen == null) {
    h = { ...h, baselineScfen: ctx.scfen };
  }

  const scfenMoved =
    h.baselineScfen != null &&
    ctx.scfen != null &&
    ctx.scfen !== h.baselineScfen;
  const phaseActed =
    ctx.timelineActive === true ||
    ctx.reviewPhase === "resolve" ||
    ctx.reviewPhase === "check";
  const acted = scfenMoved || phaseActed;

  if (raw.source === "reaction") {
    h = { ...h, introDone: true, sticky: raw };
    return { hold: h, line: raw };
  }

  if (acted || h.introDone) {
    h = { ...h, introDone: true };
    // Prefer last reaction; otherwise silence (do not revive intro).
    const line =
      h.sticky ??
      ({
        comment: "",
        emotion: raw.emotion,
        source: "intro" as const,
      } satisfies TutorialLine);
    return { hold: h, line };
  }

  return { hold: h, line: raw };
};

/** First matching board-hint step for the live SCFEN (empty = clear marks). */
export const resolveTutorialHints = (
  hints: readonly TutorialBoardHint[] | undefined,
  scfen: string | undefined,
): Square[] => {
  if (!hints?.length) return [];
  for (const h of hints) {
    if (!h.when) return [...h.squares];
    if (h.when.kind === "scfen" && scfen != null && h.when.re.test(scfen)) {
      return [...h.squares];
    }
  }
  return [];
};

/** Live narration fields used by {@link matchesTutorialCompleteWhen}. */
export type TutorialCompleteContext = {
  scfen?: string;
  queue?: readonly { timing: string; kind: string; color?: string }[];
  typewriterTurn?: number;
  typewriterBeat?: "turn" | "check" | "intent" | "resolve";
};

/** True when live intent / SCFEN satisfies a story's auto-advance rule. */
export const matchesTutorialCompleteWhen = (
  when: TutorialCompleteWhen | undefined,
  ctx: TutorialCompleteContext | string | undefined,
): boolean => {
  if (!when || ctx == null) return false;
  const scfen = typeof ctx === "string" ? ctx : ctx.scfen;
  const queue = typeof ctx === "string" ? undefined : ctx.queue;
  const twTurn = typeof ctx === "string" ? undefined : ctx.typewriterTurn;
  const twBeat = typeof ctx === "string" ? undefined : ctx.typewriterBeat;
  if (when.kind === "scfen") {
    return scfen != null && when.re.test(scfen);
  }
  if (when.kind === "queue") {
    const q = queue ?? [];
    if (q.length === 0) return false;
    const hasC = q.some((a) => a.timing === "C");
    const hasSpecial = when.specialKind
      ? q.some(
          (a) =>
            a.kind === when.specialKind &&
            (a.timing === "B" || a.timing === "F"),
        )
      : q.some((a) => a.timing === "B" || a.timing === "F");
    if (when.classical && !hasC) return false;
    if ((when.specialKind || when.classical) && when.specialKind && !hasSpecial)
      return false;
    if (when.classical && when.specialKind) return hasC && hasSpecial;
    if (when.classical) return hasC;
    if (when.specialKind) return hasSpecial;
    return q.length > 0;
  }
  if (when.kind === "typewriter") {
    return twTurn === when.turn && twBeat === when.beat;
  }
  // `elapsed` is driven by TutorialScreen timers — never a live match.
  if (when.kind === "elapsed") return false;
  return false;
};
