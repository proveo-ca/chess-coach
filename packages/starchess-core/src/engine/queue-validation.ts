// SPEC: _spec/turn-planning.puml, _spec/engine-consolidation.puml
import { placementToMap } from "./board";
import { assertBaselineFen, assertSpecialLegal, ScValidateError } from "../rules/validation";
export { assertBaselineFen, assertSpecialLegal, ScValidateError } from "../rules/validation";
import { mineAt } from "./mines";
import { nativeClassicalChecks } from "./native-classical";
import type { NativeClassicalEligibility } from "./native-classical";
import { classifyClassicalVacancy, gasPairKey } from "./planning-intents";
import type { ScAction, ScActionInput, ScFenSnapshot } from "./types";

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

export const assertActionAdmission = (snap: ScFenSnapshot, action: ScActionInput): void => {
  assertBaselineFen(snap);
  if (action.timing === "C") assertClassicalAdmission(snap, action as Extract<ScAction, { timing: "C" }>);
  else assertSpecialLegal(snap, action as Extract<ScAction, { timing: "B" | "F" }>);
};
