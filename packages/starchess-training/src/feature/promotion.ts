import { classicalRewriteCoordinatesAfterB, energyForTurn, isScMoveShape, marineSingleTarget, type ScActionInput, type SpawnPiece, type Square } from "@chess-coach/starchess-core/planning-v1";
import type { Meter, Promotion36, PromotionName, Side } from "../economic/contracts";
import { PROMOTION_CHANNELS, PROMOTION_KERNELS } from "../economic/contracts";
import { charge } from "../economic/work";
import type { OwnProjection } from "./projection";
import { ownLitSquares, stationaryRelation, type FeatureLayers, type OwnView } from "./relations";

type Promoted = Exclude<SpawnPiece, "p">;
export type MarineEntry = Readonly<{ square: Square; diagonal: boolean }>;
export type MarineOpportunity = Readonly<{ key: string; arrival: Square; promotion: Promoted | null; entries: readonly MarineEntry[] }>;
export type PromotionFrontiers = Readonly<{ witnessed: readonly Square[]; unlocated: readonly Square[] }>;
const PROMOTIONS: readonly Promoted[] = ["n", "b", "r", "q"];
const C_KINDS = ["none", "forward1", "forward2", "diagonalLeft", "diagonalRight"] as const;
const BOOLEAN_OPTIONS = [false, true] as const;

const destination = (from: Square, side: Side, kind: typeof C_KINDS[number], meter: Meter): Square | null => {
  charge(meter, 32, "$.work.feature.promotion.templateCoordinates");
  if (kind === "none") return from;
  const file = from.charCodeAt(0) - 97 + (kind === "diagonalLeft" ? -1 : kind === "diagonalRight" ? 1 : 0);
  const rank = Number(from[1]) + (side === "w" ? 1 : -1) * (kind === "forward2" ? 2 : 1);
  return file < 0 || file > 7 || rank < 1 || rank > 8 ? null : `${String.fromCharCode(97 + file)}${rank}` as Square;
};

export function* marineOpportunities(source: Square, side: Side, gas: number, meter: Meter): Generator<MarineOpportunity> {
  charge(meter, 5, "$.work.feature.promotion.macroSetup");
  const last = side === "w" ? "8" : "1";
  for (const b of BOOLEAN_OPTIONS) for (const c of C_KINDS) for (const f of BOOLEAN_OPTIONS) {
    charge(meter, 12, "$.work.feature.promotion.grammarVisit");
    if (b && f || (b || f) && gas < 1) continue;
    charge(meter, 20, "$.work.feature.promotion.nativeBTarget");
    const bTo = b ? marineSingleTarget(source, side) : source;
    if (!bTo) continue;
    charge(meter, 6, "$.work.feature.promotion.bindingsAllocate");
    const bindings = b && c !== "none" ? ["original", "arrival"] as const : ["original"] as const;
    for (const binding of bindings) {
      charge(meter, 7, "$.work.feature.promotion.bindingVisit");
      const cFrom: Square = binding === "arrival" ? bTo : source;
      const cTo = destination(cFrom, side, c, meter);
      if (!cTo) continue;
      // WHAT: native Marine geometry, including positional double eligibility.
      charge(meter, 64, "$.work.feature.promotion.nativeCShape");
      if (c !== "none" && !isScMoveShape("p", cFrom, cTo, side)) continue;
      charge(meter, 20, "$.work.feature.promotion.nativeFTarget");
      const fAuthoredTo = f ? marineSingleTarget(source, side) : null;
      if (f && !fAuthoredTo) continue;
      charge(meter, 6, "$.work.feature.promotion.ordersAllocate");
      const orders = f && c !== "none" ? ["CF", "FC"] as const : ["CF"] as const;
      for (const order of orders) {
        charge(meter, 20, "$.work.feature.promotion.appendRestriction");
        const afterCStep = f && c !== "none" ? marineSingleTarget(cTo, side) : null;
        if (f && c !== "none" && order === "CF" && afterCStep?.[1] === last) continue;
        charge(meter, 18, "$.work.feature.promotion.authoredActions");
        const classical: Extract<ScActionInput, { timing: "C" }> = { kind: "classical", timing: "C", color: side, from: cFrom, to: cTo };
        const before: ScActionInput[] = b ? [{ kind: "stimStep", timing: "B", color: side, from: source, to: bTo }] : [];
        charge(meter, 100 + 8 * before.length, "$.work.feature.promotion.nativeRewrite");
        const rewrite = b && c !== "none" ? classicalRewriteCoordinatesAfterB(before, classical) : null;
        charge(meter, 24, "$.work.feature.promotion.effectiveCoordinates");
        const effectiveFrom: Square = rewrite?.from ?? cFrom, effectiveTo: Square = rewrite?.to ?? cTo;
        const cActs = c !== "none" && effectiveFrom === bTo;
        const diagonal = c === "diagonalLeft" || c === "diagonalRight";
        const cArrival = cActs ? effectiveTo : bTo;
        const fArrival = f ? marineSingleTarget(cArrival, side) : null;
        charge(meter, 18, "$.work.feature.promotion.firstPromotion");
        const bPromotes = b && bTo[1] === last && !cActs;
        const cPromotes = cActs && cArrival[1] === last;
        const fPromotes = !bPromotes && !cPromotes && fArrival?.[1] === last && fAuthoredTo?.[1] === last;
        charge(meter, 8, "$.work.feature.promotion.entriesAllocate");
        const entries: MarineEntry[] = [];
        if (b) { charge(meter, 5, "$.work.feature.promotion.BEntry"); entries.push({ square: bTo, diagonal: false }); }
        if (!bPromotes && cActs) {
          if (c === "forward2") {
            charge(meter, 25, "$.work.feature.promotion.doubleIntermediate");
            const mid = marineSingleTarget(effectiveFrom, side)!;
            entries.push({ square: mid, diagonal: false });
          }
          charge(meter, 5, "$.work.feature.promotion.CEntry");
          entries.push({ square: cArrival, diagonal });
        }
        if (!bPromotes && !cPromotes && fArrival) { charge(meter, 5, "$.work.feature.promotion.FEntry"); entries.push({ square: fArrival, diagonal: false }); }
        charge(meter, 12, "$.work.feature.promotion.arrivalAndAlternatives");
        const arrival = bPromotes ? bTo : cPromotes ? cArrival : fArrival ?? cArrival;
        const alternatives: readonly (Promoted | null)[] = bPromotes || cPromotes || fPromotes ? PROMOTIONS : [null];
        for (const promotion of alternatives) {
          // WHAT: four output fields, bounded template-key character lanes, and entry references.
          charge(meter, 4 * 3 + 64 * 2 + entries.length * 3, "$.work.feature.promotion.macroRecord");
          yield { key: `${b ? "B" : "-"}:${c}:${f ? "F" : "-"}:${binding}:${order}:${promotion ?? "p"}`, arrival, promotion, entries };
        }
      }
    }
  }
}

type RouteView = Readonly<{ compatible: boolean; blockers: ReadonlySet<Square>; cover: ReadonlySet<Square>; vision: ReadonlySet<Square> }>;
export type PromotionRoute = Readonly<{ key: string; source: Square; arrival: Square; promotion: Promoted; opportunities: number; baseline: RouteView; candidate: RouteView }>;
type EntryContact = Readonly<{ compatible: boolean; blocker: boolean; cover: boolean; vision: boolean }>;

const annotateEntries = (entries: readonly MarineEntry[], prior: RouteView, own: OwnView, layers: FeatureLayers, lit: ReadonlySet<Square>, contacts: Map<string, EntryContact>, meter: Meter): RouteView => {
  charge(meter, 8 + 3 * (prior.blockers.size + prior.cover.size + prior.vision.size), "$.work.feature.promotion.annotationCopy");
  const blockers = new Set(prior.blockers), cover = new Set(prior.cover), vision = new Set(prior.vision);
  let compatible = prior.compatible;
  for (const entry of entries) {
    charge(meter, 13, "$.work.feature.promotion.contactCacheLookup");
    const key = `${entry.square}:${Number(entry.diagonal)}`;
    let contact = contacts.get(key);
    if (!contact) {
      charge(meter, 30, "$.work.feature.promotion.entryOccupancy");
      const token = own.at.get(entry.square), unit = token ? own.units.get(token) : undefined;
      const compatible = !entry.diagonal || !!unit || own.mines.has(entry.square);
      const blocker = entry.diagonal ? unit?.type === "k" : !!unit || own.mines.has(entry.square);
      const vision = lit.has(entry.square);
      let cover = false;
      for (const source of own.units.values()) {
        charge(meter, 3, "$.work.feature.promotion.coverSourceVisit");
        if (stationaryRelation(layers, own, source, entry.square, meter) !== "none") {
          charge(meter, 2, "$.work.feature.promotion.coverContact");
          cover = true; break;
        }
      }
      charge(meter, 12, "$.work.feature.promotion.contactCacheStore");
      contact = { compatible, blocker, cover, vision }; contacts.set(key, contact);
    }
    charge(meter, 16, "$.work.feature.promotion.contactApply");
    compatible &&= contact.compatible;
    if (contact.blocker) blockers.add(entry.square);
    if (contact.cover) cover.add(entry.square);
    if (contact.vision) vision.add(entry.square);
  }
  charge(meter, 5, "$.work.feature.promotion.annotationResult");
  return { compatible, blockers, cover, vision };
};

export function* promotionRoutes(projection: OwnProjection, sources: readonly Square[], enemySide: Side, turn: number, horizon: 1 | 2 | 3, meter: Meter): Generator<PromotionRoute> {
  const baselineLit = ownLitSquares(projection.baseline, meter), candidateLit = ownLitSquares(projection.final, meter);
  charge(meter, 6 * 4 + 12, "$.work.feature.promotion.routeSetup");
  const empty: RouteView = { compatible: true, blockers: new Set(), cover: new Set(), vision: new Set() };
  const seen = new Set<string>();
  const baselineContacts = new Map<string, EntryContact>(), candidateContacts = new Map<string, EntryContact>();
  function* walk(source: Square, square: Square, sequence: string, depth: number, baseline: RouteView, candidate: RouteView): Generator<PromotionRoute> {
    charge(meter, 14, "$.work.feature.promotion.depthVisit");
    if (depth === horizon) return;
    // WHAT: maximum Marine rank progress is three per remaining opportunity.
    const distance = enemySide === "w" ? 8 - Number(square[1]) : Number(square[1]) - 1;
    if (distance === 0 || distance > 3 * (horizon - depth)) return;
    charge(meter, 16, "$.work.feature.promotion.publicEnergy");
    const gas = energyForTurn(turn + depth);
    for (const macro of marineOpportunities(square, enemySide, gas, meter)) {
      charge(meter, 6 + 2 * (sequence.length + macro.key.length), "$.work.feature.promotion.sequenceAllocate");
      const key = `${sequence}/${macro.key}`;
      const b = annotateEntries(macro.entries, baseline, projection.baseline, projection.layers, baselineLit, baselineContacts, meter);
      const q = annotateEntries(macro.entries, candidate, projection.final, projection.layers, candidateLit, candidateContacts, meter);
      charge(meter, 5, "$.work.feature.promotion.commonCompatibility");
      if (!b.compatible && !q.compatible) continue;
      if (macro.promotion) {
        charge(meter, 14 + 2 * key.length, "$.work.feature.promotion.routeIdentity");
        const identity = `${source}:${key}:${macro.promotion}`;
        if (seen.has(identity)) continue;
        seen.add(identity);
        charge(meter, 7 * 3 + 4, "$.work.feature.promotion.routeRecord");
        yield { key: identity, source, arrival: macro.arrival, promotion: macro.promotion, opportunities: depth + 1, baseline: b, candidate: q };
      } else yield* walk(source, macro.arrival, key, depth + 1, b, q);
    }
  }
  for (const source of sources) {
    charge(meter, 4, "$.work.feature.promotion.sourceVisit");
    yield* walk(source, source, "", 0, empty, empty);
  }
}

const gains = (after: ReadonlySet<Square>, before: ReadonlySet<Square>, meter: Meter): boolean => {
  for (const square of after) {
    charge(meter, 5, "$.work.feature.promotion.localSetDifference");
    if (!before.has(square)) return true;
  }
  charge(meter, 1, "$.work.feature.promotion.localSetDifferenceReturn");
  return false;
};

export const promotionFeatures = (projection: OwnProjection, frontiers: PromotionFrontiers, side: Side, turn: number, meter: Meter): Promotion36 => {
  charge(meter, 4, "$.work.feature.promotion.blockAllocate");
  const result = {} as Record<PromotionName, number>;
  const exposureCache = new Map<string, boolean>();
  for (const channel of PROMOTION_CHANNELS) {
    // WHAT: six kernel arrays with three initialized horizon sets each.
    charge(meter, 4 + 6 * (4 + 3 * 4), "$.work.feature.promotion.filePoolsAllocate");
    const files = PROMOTION_KERNELS.map(() => [new Set<string>(), new Set<string>(), new Set<string>()]);
    for (const route of promotionRoutes(projection, frontiers[channel], side === "w" ? "b" : "w", turn, 3, meter)) {
      charge(meter, 8, "$.work.feature.promotion.fileIdentity");
      const file = route.arrival[0];
      charge(meter, 12, "$.work.feature.promotion.exposureEligibility");
      let exposed = false;
      if (route.candidate.compatible && route.candidate.blockers.size === 0) {
        charge(meter, 15, "$.work.feature.promotion.exposureCacheLookup");
        const key = `${route.arrival}:${route.promotion}`, cached = exposureCache.get(key);
        if (cached !== undefined) exposed = cached;
        else {
          for (const target of projection.final.units.values()) {
            charge(meter, 12, "$.work.feature.promotion.exposureTarget");
            if (stationaryRelation(projection.layers, projection.final, { square: route.arrival, type: route.promotion, color: side === "w" ? "b" : "w" }, target.square, meter) !== "none") { exposed = true; break; }
          }
          charge(meter, 4, "$.work.feature.promotion.exposureCacheStore");
          exposureCache.set(key, exposed);
        }
      }
      charge(meter, 7, "$.work.feature.promotion.predicatesAllocate");
      const predicates = [exposed,
        gains(route.candidate.blockers, route.baseline.blockers, meter), gains(route.baseline.blockers, route.candidate.blockers, meter),
        gains(route.candidate.cover, route.baseline.cover, meter), gains(route.baseline.cover, route.candidate.cover, meter),
        gains(route.candidate.vision, route.baseline.vision, meter)];
      for (let k = 0; k < 6; k++) for (let h = route.opportunities; h <= 3; h++) {
        charge(meter, 9, "$.work.feature.promotion.filePoolVisit");
        if (predicates[k]) files[k][h - 1].add(file);
      }
    }
    for (let k = 0; k < 6; k++) for (let h = 1; h <= 3; h++) {
      charge(meter, 12, "$.work.feature.promotion.coordinateAndScale");
      result[`${PROMOTION_KERNELS[k]}.${channel}.h${h}` as PromotionName] = files[k][h - 1].size / 8;
    }
  }
  charge(meter, 37, "$.work.feature.promotion.blockFreeze");
  return Object.freeze(result);
};
