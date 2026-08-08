/**
 * Tutorial script — Stage → Story → Selena comment (+ optional store/board reactions).
 * // SPEC: _spec/apps/starchess/menu-flow.puml
 */
import type { Square } from "chess.js";
import type { KerriganEmotion } from "~/types/coach";
import type {
  TutorialReactionAction,
  TutorialSectionId,
} from "~/types/tutorial";
import type { ReviewTurnPhase } from "~/types/review";

export type { TutorialReactionAction, TutorialSectionId } from "~/types/tutorial";

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
  | { kind: "turn"; turn: number };

export type TutorialReaction = {
  when: TutorialReactionWhen;
  comment: string;
  emotion?: KerriganEmotion;
  /** Optional in-bubble CTA (e.g. retry after ally CC dies). */
  action?: TutorialReactionAction;
};

/** Board hint step — first matching entry wins (SCFEN `when`, else fallback). */
export type TutorialBoardHint = {
  when?: { kind: "scfen"; re: RegExp };
  squares: readonly Square[];
};

export type TutorialStoryScript = {
  id: string;
  title: string;
  /** Default Selena line when the story is focused. */
  comment: string;
  emotion?: KerriganEmotion;
  /** Optional overlays when MatchStore / board state changes. */
  reactions?: readonly TutorialReaction[];
  /** Optional destination rings on the live board. */
  hints?: readonly TutorialBoardHint[];
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
        reactions: [
          {
            // White P on FEN rank 7 (2nd placement row) — promote tease.
            when: { kind: "scfen", re: /SCFEN\|[^/]*\/[^/]*P/ },
            comment: "Go ahead promote. See how the pieces look!",
            emotion: "happy",
          },
        ],
      },
      {
        id: "knight",
        title: "Knight",
        comment: "The Knight now rides a Hoverbike! As it moves, it clears the fog, pay close attention!",
        emotion: "watching",
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
        reactions: [
          {
            when: { kind: "timelineActive" },
            comment: "Boom + smoke on impact. Siege never slides — only shells.",
            emotion: "shocked",
          },
        ],
      },
      {
        id: "queen",
        title: "Queen",
        comment:
          "And finally, the Queen.",
        emotion: "watching",
      },
      {
        id: "mine",
        title: "Spider Mine",
        comment:
          "Hoverbikes can plant mines; they can only see their own squares. How? Let me show you!",
        emotion: "happy",
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
        reactions: [
          {
            when: { kind: "scfen", re: /B=pawnDouble:/ },
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
      },
      {
        id: "vulture",
        title: "Vulture",
        comment:
          "Use gas on a Hoverbike to deploy a mine. You can deploy the mine before or after moving!",
        emotion: "scanning",
      },
      {
        id: "goliath",
        title: "Goliath",
        comment:
          "1. Mecha can see Battleships anywhere! \n 2. Arm your Mecha with 2 gas canisters. \n3. Aim it to the flying Battleship \n4. Capture the Marine. \nShoot up and down at the same time!",
        emotion: "thinking",
      },
      {
        id: "bc",
        title: "Battlecruiser",
        comment:
          "The Battleship can teleport anywhere in the map in an instant. \nIt only takes 2 gas canisters.",
        emotion: "watching",
      },
      {
        id: "tank",
        title: "Siege Tank",
        comment:
          "There are 2 modes in a tank: sieged and mobile. \nGas can change the mode. \nTry stacking mode change with a move!",
        emotion: "happy",
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
              "Resolve in the following order: \n1. (Gas) Specials \n2. Attacks \n3. Moves \n4. Gas Specials",
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
        reactions: KING_HUNT_REVIEW_REACTIONS,
      },
      {
        id: "king-hunt-live",
        title: "King Hunt (live)",
        comment: "",
        emotion: "happy",
        reactions: [
          // Terminal HP first — never bury retry / win under board tips.
          KING_ALLY_DEAD,
          KING_ENEMY_DEAD,
          {
            // ≥2 black pawns in placement (`p`).
            when: { kind: "scfen", re: /SCFEN\|(?:[^|p]*p){2}[^|]*\|/ },
            comment:
              "Stop the enemy pawns! \nRemember the Hoverbike's mines",
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
              "Queue your intent: \nProtect the Hoverbike with your Mecha. \nDeploy more units.",
            emotion: "watching",
          },
          {
            when: { kind: "turn", turn: 1 },
            comment:
              "Final test: Hunt the stranded Command Center. \nMake me proud!",
            emotion: "happy",
          },
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
};

/** Pick the most specific Selena line for the current board/store context. */
export const resolveTutorialLine = (
  ctx: TutorialScriptContext,
): {
  comment: string;
  emotion?: KerriganEmotion;
  action?: TutorialReactionAction;
} => {
  const story = tutorialStory(ctx.stageId, ctx.storyId);
  if (!story) {
    return {
      comment: "Stay sharp — fog and fire favor the prepared.",
      emotion: "idle",
    };
  }

  const reactions = story.reactions ?? [];
  for (const r of reactions) {
    const w = r.when;
    if (w.kind === "reviewPhase" && ctx.reviewPhase === w.phase) {
      if (w.turn != null && ctx.turn !== w.turn) continue;
      return {
        comment: r.comment,
        emotion: r.emotion ?? story.emotion,
        action: r.action,
      };
    }
    if (w.kind === "timelineActive" && ctx.timelineActive) {
      return {
        comment: r.comment,
        emotion: r.emotion ?? story.emotion,
        action: r.action,
      };
    }
    if (w.kind === "chessSkin" && ctx.chessSkin === w.chess) {
      return {
        comment: r.comment,
        emotion: r.emotion ?? story.emotion,
        action: r.action,
      };
    }
    if (w.kind === "scfen" && ctx.scfen != null && w.re.test(ctx.scfen)) {
      return {
        comment: r.comment,
        emotion: r.emotion ?? story.emotion,
        action: r.action,
      };
    }
    if (w.kind === "turn" && ctx.turn === w.turn) {
      return {
        comment: r.comment,
        emotion: r.emotion ?? story.emotion,
        action: r.action,
      };
    }
  }

  return { comment: story.comment, emotion: story.emotion };
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
