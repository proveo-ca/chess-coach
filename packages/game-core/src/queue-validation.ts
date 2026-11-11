// SPEC: _spec/turn-planning.puml
import { hasExactCCPair, placementToMap } from "./board";
import { MAX_MINES_PER_SIDE, mineAt, minesFor } from "./mines";
import { marineSingleTarget } from "./moves";
import { nativeClassicalChecks } from "./native-classical";
import type { NativeClassicalEligibility } from "./native-classical";
import { appendTimeSpecialAnchor, classifyClassicalVacancy, gasPairKey } from "./planning-intents";
import { charonDiagonalSquaresFromSquare, spawnCCAnchorFromMap } from "./planning-specials";
import type { ScAction, ScActionInput, ScFenSnapshot } from "./types";

export class ScValidateError extends Error {
  constructor(readonly code: "SC_BASELINE_FEN" | "SC_SPECIAL", message: string) {
    super(message);
    this.name = "ScValidateError";
  }
}

export const assertBaselineFen = (snap: ScFenSnapshot): void => {
  if (snap.placement.split("/").length !== 8) throw new ScValidateError("SC_BASELINE_FEN", `bad placement ranks: ${snap.placement}`);
  if (!hasExactCCPair(snap.placement)) throw new ScValidateError("SC_BASELINE_FEN", `placement needs exactly 1 Command Center per side: ${snap.placement}`);
};

const actionsWithClassical = (snap: ScFenSnapshot, action: Extract<ScAction, { timing: "C" }>): ScAction[] => {
  const actions = snap.queue?.actions ?? [];
  if (actions.includes(action)) return [...actions];
  const seq = action.seq ?? Math.max(-1, ...actions.map(value => value.seq)) + 1;
  return [...actions, { ...action, seq }];
};

const eligibilityFor = (snap: ScFenSnapshot, actions: readonly ScAction[], action: Extract<ScAction, { timing: "C" }>) => {
  const ownUnits = new Map([...placementToMap(snap.placement)].filter(([, piece]) => piece.color === action.color));
  const ownSieged = new Set((snap.siegedTanks ?? []).filter(at => ownUnits.has(at)));
  return nativeClassicalChecks({ ownUnits, ownSieged }, actions.filter(value => value.color === action.color), action);
};

const assertClassicalTypeDependencies = (
  snap: ScFenSnapshot, action: Extract<ScAction, { timing: "C" }>, eligibility: NativeClassicalEligibility,
  clause?: "siege" | "promotion",
): void => {
  const piece = eligibility.actor;
  const map = placementToMap(snap.placement);
  if (clause !== "promotion" && piece?.type === "r" && eligibility.sieged.has(eligibility.from)) {
    const destination = map.get(action.to);
    const mine = mineAt(snap.mines, action.to);
    const onCross = eligibility.from[0] === eligibility.to[0] || eligibility.from[1] === eligibility.to[1];
    const enemyAttack = (!!destination && destination.color !== action.color) ||
      (!destination && !!mine && mine.color !== action.color) || (!destination && !mine && onCross);
    if (!enemyAttack) throw new ScValidateError("SC_SPECIAL", `sieged Tank on ${eligibility.from} cannot relocate`);
  }
  if (clause !== "siege" && piece?.type === "p" && Number(action.to[1]) === (action.color === "w" ? 8 : 1) && !action.promotion) {
    throw new ScValidateError("SC_SPECIAL", `classical last-rank ${action.from}→${action.to} needs promotion`);
  }
};

export const assertNativeClassicalDependencies = (snap: ScFenSnapshot, actions: readonly ScAction[], color?: "w" | "b"): void => {
  for (const action of [...actions].sort((a, b) => a.seq - b.seq)) {
    if (action.timing !== "C" || (color !== undefined && action.color !== color)) continue;
    const checks = eligibilityFor(snap, actions, action);
    for (const eligibility of [checks.insertion, checks.resulting]) {
      assertClassicalTypeDependencies(snap, action, eligibility);
      if (eligibility.diagnostic) throw new ScValidateError(eligibility.diagnostic.code, eligibility.diagnostic.message);
    }
  }
};

const assertClassicalAdmission = (snap: ScFenSnapshot, action: Extract<ScAction, { timing: "C" }>): void => {
  const vacancy = classifyClassicalVacancy(snap.queue?.actions, action.color);
  if (!vacancy.gasPairs.has(gasPairKey(action.from, action.to)) && vacancy.transit.has(action.to)) {
    throw new ScValidateError("SC_BASELINE_FEN", `cannot classical-target transit ${action.to}`);
  }
  const map = placementToMap(snap.placement);
  const actions = actionsWithClassical(snap, action);
  const current = actions.includes(action) ? action : actions[actions.length - 1]! as Extract<ScAction, { timing: "C" }>;
  const eligibility = eligibilityFor(snap, actions, current).insertion;
  assertClassicalTypeDependencies(snap, action, eligibility, "siege");
  const destination = map.get(action.to);
  if (destination?.color === action.color && !vacancy.bOrigins.has(action.to)) {
    throw new ScValidateError("SC_BASELINE_FEN", `cannot classical-target ally on ${action.to}`);
  }
  assertClassicalTypeDependencies(snap, action, eligibility, "promotion");
};

export const assertSpecialLegal = (snap: ScFenSnapshot, action: Extract<ScAction, { timing: "B" | "F" }>): void => {
  const map = placementToMap(snap.placement);
  const actor = map.get(action.from);
  if (!actor || actor.color !== action.color) throw new ScValidateError("SC_SPECIAL", `no actor on ${action.from}`);
  const prefix = snap.queue?.actions ?? [];
  switch (action.kind) {
    case "deploy": {
      if (actor.type !== "k") throw new ScValidateError("SC_SPECIAL", "spawn requires Command Center");
      if (!action.to || !action.unit) throw new ScValidateError("SC_SPECIAL", "spawn needs to + unit");
      const { commandCenter, allyOccupied } = spawnCCAnchorFromMap(map, action.color, action.timing, prefix);
      if (!commandCenter) throw new ScValidateError("SC_SPECIAL", "Command Center missing");
      if (allyOccupied.has(action.to)) throw new ScValidateError("SC_SPECIAL", "spawn square occupied by Command Center");
      if (Math.abs(commandCenter.charCodeAt(0) - action.to.charCodeAt(0)) > 1 ||
        Math.abs(Number(commandCenter[1]) - Number(action.to[1])) > 1 || action.to === commandCenter) {
        throw new ScValidateError("SC_SPECIAL", "spawn not adjacent");
      }
      break;
    }
    case "charonMissiles": {
      if (actor.type !== "b") throw new ScValidateError("SC_SPECIAL", "Charon requires mecha");
      if (!action.to) throw new ScValidateError("SC_SPECIAL", "Charon needs aim square");
      const origin = appendTimeSpecialAnchor(prefix, action.color, action.from, action.timing);
      if (!charonDiagonalSquaresFromSquare(origin).includes(action.to)) throw new ScValidateError("SC_SPECIAL", "Charon aim must be on a Mecha diagonal");
      break;
    }
    case "tacticalJump":
      if (actor.type !== "q") throw new ScValidateError("SC_SPECIAL", "Jump requires BattleShip");
      if (!action.to) throw new ScValidateError("SC_SPECIAL", "Jump needs destination");
      if (map.has(action.to)) throw new ScValidateError("SC_SPECIAL", "Jump destination occupied");
      break;
    case "stimStep": {
      if (actor.type !== "p") throw new ScValidateError("SC_SPECIAL", "stimStep requires Marine");
      if (!action.to) throw new ScValidateError("SC_SPECIAL", "stimStep needs to");
      const expected = marineSingleTarget(action.from, action.color);
      if (!expected || action.to !== expected) throw new ScValidateError("SC_SPECIAL", `stimStep must step +1 to ${expected ?? "off-board"} (got ${action.to})`);
      const lastRank = action.color === "w" ? 8 : 1;
      if (Number(action.to[1]) === lastRank && !action.promotion) throw new ScValidateError("SC_SPECIAL", "stimStep onto last rank needs promotion");
      const classical = prefix.find(value => value.timing === "C" && value.kind === "classical" && value.color === action.color && value.from === action.from);
      if (action.timing === "F" && classical?.timing === "C") {
        const land = marineSingleTarget(classical.to, action.color);
        if (land && Number(land[1]) === lastRank) throw new ScValidateError("SC_SPECIAL", "stimStep after move onto last rank needs gas-first + promotion");
      }
      if (map.has(action.to)) {
        const chainHead = prefix.some(value => value.timing === "B" && value.kind === "stimStep" && value.color === action.color && value.from === action.to);
        if (action.timing === "B" && chainHead) return;
        if (!(action.timing === "F" && classical?.timing === "C" && classical.to === action.to)) throw new ScValidateError("SC_SPECIAL", "stimStep blocked");
      }
      break;
    }
    case "spiderMine": {
      if (actor.type !== "n") throw new ScValidateError("SC_SPECIAL", "mine requires Hoverbike");
      let at = action.to ?? action.from;
      if (action.timing === "F" && prefix.some(value => value.timing === "C" && value.kind === "classical" && value.color === action.color && value.from === action.from)) {
        at = appendTimeSpecialAnchor(prefix, action.color, action.from, action.timing);
      }
      if (mineAt(snap.mines, at)) throw new ScValidateError("SC_SPECIAL", "mine already on square");
      if (minesFor(snap.mines, action.color).length >= MAX_MINES_PER_SIDE) throw new ScValidateError("SC_SPECIAL", `mine cap ${MAX_MINES_PER_SIDE} reached`);
      break;
    }
    case "siegeMode":
      if (actor.type !== "r") throw new ScValidateError("SC_SPECIAL", "siege requires Tank");
      break;
  }
};

export const assertActionAdmission = (snap: ScFenSnapshot, action: ScActionInput): void => {
  assertBaselineFen(snap);
  if (action.timing === "C") assertClassicalAdmission(snap, action as Extract<ScAction, { timing: "C" }>);
  else assertSpecialLegal(snap, action as Extract<ScAction, { timing: "B" | "F" }>);
};
