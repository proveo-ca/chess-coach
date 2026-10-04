// SPEC: _spec/packages/starchess-arena/newgeneration.puml
import type { PieceColor, ScActionInput, SpawnPiece } from "@chess-coach/starchess-core";
import { UNIT_COST } from "../../../starchess-core/src/rules/constants";
import { specialGasCost } from "../../../starchess-core/src/rules/specials/registry";
import { canonical, deepFreeze } from "../authorized/v1/canonical";
import type { AuthorizedObservation } from "../authorized/v1/types";
import { validateObservation } from "../authorized/v1/observationCodec";
import { array, fail, integer, object, parseJson, side, SPAWN_TYPES, square } from "./validation";

export const CANDIDATE_CODEC_VERSION = "challenge-candidate-codec-v1";
export const CANDIDATE_ENUMERATION_VERSION = "baseline-v1";
export const COMPARATOR_VERSION = "score-desc-key-asc-v1";
export const MAX_QUEUE_ACTIONS = 65;
export const ACTION_KINDS = ["classical", "deploy", "stimStep", "spiderMine", "charonMissiles", "siegeMode", "tacticalJump"] as const;
export type EncodedCandidate = {
  version: typeof CANDIDATE_CODEC_VERSION; key: string; actions: ScActionInput[];
  ownSpend: { minerals: number; gas: number };
};
const spawn = (value: unknown, path: string): SpawnPiece => SPAWN_TYPES.includes(value as SpawnPiece) ? value as SpawnPiece : fail(path);
export const validateActions = (value: unknown, color: PieceColor): ScActionInput[] => array(value, "$.actions", MAX_QUEUE_ACTIONS).map((entry, index): ScActionInput => {
  const path = `$.actions[${index}]`;
  const base = object(entry, path, ["kind", "timing", "color", "from"], ["to", "unit", "promotion"]);
  if (!ACTION_KINDS.includes(base.kind as typeof ACTION_KINDS[number]) || side(base.color, `${path}.color`) !== color) fail(path);
  const from = square(base.from, `${path}.from`);
  const to = Object.hasOwn(base, "to") ? square(base.to, `${path}.to`) : undefined;
  const promotion = Object.hasOwn(base, "promotion") ? spawn(base.promotion, `${path}.promotion`) : undefined;
  if (base.kind === "classical") {
    if (base.timing !== "C" || !to || Object.hasOwn(base, "unit")) fail(path);
    return { kind: "classical", timing: "C", color, from, to: to!, ...(promotion ? { promotion } : {}) };
  }
  if (base.timing !== "B" && base.timing !== "F") return fail(`${path}.timing`);
  if (promotion && base.kind !== "stimStep") fail(`${path}.promotion`);
  if (Object.hasOwn(base, "unit") && base.kind !== "deploy") fail(`${path}.unit`);
  if (["deploy", "stimStep", "charonMissiles", "tacticalJump"].includes(String(base.kind)) && !to) fail(`${path}.to`);
  const unit = base.kind === "deploy" ? spawn(base.unit, `${path}.unit`) : undefined;
  return { kind: base.kind as Exclude<typeof ACTION_KINDS[number], "classical">,
    timing: base.timing, color, from, ...(to ? { to } : {}), ...(unit ? { unit } : {}), ...(promotion ? { promotion } : {}) };
});
export const requestedSpend = (input: readonly ScActionInput[]) => {
  const actions = validateActions(input, side(input[0]?.color ?? "w", "$.side"));
  return {
    minerals: actions.reduce((sum, action) => sum + (action.kind === "deploy" && action.unit ? UNIT_COST[action.unit] : 0), 0),
    gas: actions.reduce((sum, action) => sum + (action.kind === "classical" ? 0 : specialGasCost(action.kind)), 0),
  };
};
export const encodeCandidate = (observation: AuthorizedObservation, value: readonly ScActionInput[]): EncodedCandidate => {
  const authorized = validateObservation(observation);
  const actions = validateActions(value, authorized.side);
  return deepFreeze({ version: CANDIDATE_CODEC_VERSION, key: canonical(actions), actions, ownSpend: requestedSpend(actions) });
};
export const decodeCandidate = (value: unknown, color: PieceColor): EncodedCandidate => {
  const record = object(typeof value === "string" ? parseJson(value) : value, "$", ["version", "key", "actions", "ownSpend"]);
  if (record.version !== CANDIDATE_CODEC_VERSION) fail("$.version", "VERSION");
  const actions = validateActions(record.actions, side(color, "$.side"));
  const spend = object(record.ownSpend, "$.ownSpend", ["minerals", "gas"]);
  const ownSpend = { minerals: integer(spend.minerals, "$.ownSpend.minerals", 0, MAX_QUEUE_ACTIONS * 9), gas: integer(spend.gas, "$.ownSpend.gas", 0, MAX_QUEUE_ACTIONS * 3) };
  if (record.key !== canonical(actions) || canonical(ownSpend) !== canonical(requestedSpend(actions))) fail("$", "DERIVED");
  return deepFreeze({ version: CANDIDATE_CODEC_VERSION, key: record.key as string, actions, ownSpend });
};
export const compareRankedCandidates = (a: { key: string; score: number }, b: { key: string; score: number }): number => {
  if (!Number.isFinite(a.score) || !Number.isFinite(b.score)) fail("$.score", "NUMBER");
  return b.score - a.score || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
};
