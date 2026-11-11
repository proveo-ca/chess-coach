// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
/**
 * Tutorial content config — single source of truth for lesson copy, board
 * seeds, hints, and advance/restart gates. **Data only**: no imports beyond the
 * type, no logic, no derived values. Types, accessors, and the line resolver
 * live in `tutorialScript.ts`.
 *
 * Each story is its own checked literal under `stories/<stage>/<story-id>.ts`
 * (`as ... satisfies TutorialStoryScript`) — this file only imports them and
 * reassembles the 4-stage `TUTORIAL_SCRIPT_CONFIG` array, in stage/story
 * order. Add a story by creating its file under `stories/<stage>/` and
 * listing it below; do not add lesson content here.
 *
 * `queued`/`and`/`or` are pure literal builders (no board reads, no derived
 * values) — they replace a hand-written `re: /SCFEN\|.../` regex for "is this
 * exact action queued" with a check against the parsed queue. Only stories
 * that use them import from `~/tutorial/when`.
 */
import type { TutorialScriptConfig } from "~/tutorial/tutorialScript";

import { king as fogKing } from "~/tutorial/steps/fog/king";
import { pawn as fogPawn } from "~/tutorial/steps/fog/pawn";
import { knight as fogKnight } from "~/tutorial/steps/fog/knight";
import { bishop as fogBishop } from "~/tutorial/steps/fog/bishop";
import { rookTank as fogRookTank } from "~/tutorial/steps/fog/rook-tank";
import { rookSiege as fogRookSiege } from "~/tutorial/steps/fog/rook-siege";
import { queen as fogQueen } from "~/tutorial/steps/fog/queen";
import { mine as fogMine } from "~/tutorial/steps/fog/mine";

import { cc as specialsCc } from "~/tutorial/steps/specials/cc";
import { marine as specialsMarine } from "~/tutorial/steps/specials/marine";
import { hoverbike as specialsHoverbike } from "~/tutorial/steps/specials/hoverbike";
import { mecha as specialsMecha } from "~/tutorial/steps/specials/mecha";
import { tank as specialsTank } from "~/tutorial/steps/specials/tank";
import { ship as specialsShip } from "~/tutorial/steps/specials/ship";

import { combatChain as resolveCombatChain } from "~/tutorial/steps/resolve/combat-chain";
import { kingHunt as resolveKingHunt } from "~/tutorial/steps/resolve/king-hunt";

import { livePlayDefense1 } from "~/tutorial/steps/live-play/live-play-defense-1";
import { livePlayDefense2 } from "~/tutorial/steps/live-play/live-play-defense-2";
import { livePlayDefense3 } from "~/tutorial/steps/live-play/live-play-defense-3";
import { livePlayDefense4 } from "~/tutorial/steps/live-play/live-play-defense-4";
import { livePlayDefense5 } from "~/tutorial/steps/live-play/live-play-defense-5";
import { livePlayDefense6 } from "~/tutorial/steps/live-play/live-play-defense-6";
import { livePlayAttack1 } from "~/tutorial/steps/live-play/live-play-attack-1";
import { livePlayAttack2 } from "~/tutorial/steps/live-play/live-play-attack-2";
import { livePlayAttack3 } from "~/tutorial/steps/live-play/live-play-attack-3";
import { livePlayAttack4 } from "~/tutorial/steps/live-play/live-play-attack-4";

export const TUTORIAL_SCRIPT_CONFIG = [
  {
    id: "fog",
    label: "Fog of War",
    stories: [fogKing, fogPawn, fogKnight, fogBishop, fogRookTank, fogRookSiege, fogQueen, fogMine],
  },
  {
    id: "specials",
    label: "Special Moves",
    stories: [specialsCc, specialsMarine, specialsHoverbike, specialsMecha, specialsTank, specialsShip],
  },
  {
    id: "resolve",
    label: "Turn Resolution",
    stories: [resolveCombatChain, resolveKingHunt],
  },
  {
    id: "live-play",
    label: "Live Play",
    stories: [
      livePlayDefense1,
      livePlayDefense2,
      livePlayDefense3,
      livePlayDefense4,
      livePlayDefense5,
      livePlayDefense6,
      livePlayAttack1,
      livePlayAttack2,
      livePlayAttack3,
      livePlayAttack4,
    ],
  },
] as const satisfies TutorialScriptConfig;
