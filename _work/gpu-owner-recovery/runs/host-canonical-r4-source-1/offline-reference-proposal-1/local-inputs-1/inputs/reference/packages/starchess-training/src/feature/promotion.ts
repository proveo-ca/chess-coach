// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { classicalRewriteCoordinatesAfterB, energyForTurn, isScMoveShape, marineSingleTarget, type ScActionInput, type SpawnPiece, type Square } from "@chess-coach/starchess-core/planning-v1";
import type { Meter, Promotion36, PromotionName, Side } from "../economic/contracts";
import { PROMOTION_CHANNELS, PROMOTION_KERNELS } from "../economic/contracts";
import { charge } from "../economic/work";
import type { OwnProjection } from "./projection";
import { ownLitSquares, stationaryRelation, type FeatureLayers, type OwnView } from "./relations";
import { beginPromotion36, finishPromotion36, putPromotion36 } from "../economic/ownedKernel";

type Promoted = Exclude<SpawnPiece, "p">;
export type MarineEntry = Readonly<{ square: Square; diagonal: boolean }>;
export type MarineOpportunity = Readonly<{ key: string; arrival: Square; promotion: Promoted | null; entries: readonly MarineEntry[] }>;
export type PromotionFrontiers = Readonly<{ witnessed: readonly Square[]; unlocated: readonly Square[] }>;
const PROMOTIONS: readonly Promoted[] = ["n", "b", "r", "q"];
const C_KINDS = ["none", "forward1", "forward2", "diagonalLeft", "diagonalRight"] as const;
const BOOLEAN_OPTIONS = [false, true] as const;
const COMPILED_ENTRIES = new Map<string, readonly MarineEntry[]>();

const destination = (from: Square, side: Side, kind: typeof C_KINDS[number]): Square | null => {
  if (kind === "none") return from;
  const file = from.charCodeAt(0) - 97 + (kind === "diagonalLeft" ? -1 : kind === "diagonalRight" ? 1 : 0);
  const rank = Number(from[1]) + (side === "w" ? 1 : -1) * (kind === "forward2" ? 2 : 1);
  return file < 0 || file > 7 || rank < 1 || rank > 8 ? null : `${String.fromCharCode(97 + file)}${rank}` as Square;
};

function* compileMacros(source: Square, side: Side, gas: number): Generator<MarineOpportunity> {
  const last = side === "w" ? "8" : "1";
  for (const b of BOOLEAN_OPTIONS) for (const c of C_KINDS) for (const f of BOOLEAN_OPTIONS) {
    if (b && f || (b || f) && gas < 1) continue;
    const bTo = b ? marineSingleTarget(source, side) : source;
    if (!bTo) continue;
    const bindings = b && c !== "none" ? ["original", "arrival"] as const : ["original"] as const;
    for (const binding of bindings) {
      const cFrom: Square = binding === "arrival" ? bTo : source;
      const cTo = destination(cFrom, side, c);
      if (!cTo) continue;
      // WHAT: native Marine geometry, including positional double eligibility.
      if (c !== "none" && !isScMoveShape("p", cFrom, cTo, side)) continue;
      const fAuthoredTo = f ? marineSingleTarget(source, side) : null;
      if (f && !fAuthoredTo) continue;
      const orders = f && c !== "none" ? ["CF", "FC"] as const : ["CF"] as const;
      for (const order of orders) {
        const afterCStep = f && c !== "none" ? marineSingleTarget(cTo, side) : null;
        if (f && c !== "none" && order === "CF" && afterCStep?.[1] === last) continue;
        const classical: Extract<ScActionInput, { timing: "C" }> = { kind: "classical", timing: "C", color: side, from: cFrom, to: cTo };
        const before: ScActionInput[] = b ? [{ kind: "stimStep", timing: "B", color: side, from: source, to: bTo }] : [];
        const rewrite = b && c !== "none" ? classicalRewriteCoordinatesAfterB(before, classical) : null;
        const effectiveFrom: Square = rewrite?.from ?? cFrom, effectiveTo: Square = rewrite?.to ?? cTo;
        const cActs = c !== "none" && effectiveFrom === bTo;
        const diagonal = c === "diagonalLeft" || c === "diagonalRight";
        const cArrival = cActs ? effectiveTo : bTo;
        const fArrival = f ? marineSingleTarget(cArrival, side) : null;
        const bPromotes = b && bTo[1] === last && !cActs;
        const cPromotes = cActs && cArrival[1] === last;
        const fPromotes = !bPromotes && !cPromotes && fArrival?.[1] === last && fAuthoredTo?.[1] === last;
        const entries: MarineEntry[] = [];
        if (b) entries.push({ square: bTo, diagonal: false });
        if (!bPromotes && cActs) {
          if (c === "forward2") {
            const mid = marineSingleTarget(effectiveFrom, side)!;
            entries.push({ square: mid, diagonal: false });
          }
          entries.push({ square: cArrival, diagonal });
        }
        if (!bPromotes && !cPromotes && fArrival) entries.push({ square: fArrival, diagonal: false });
        const arrival = bPromotes ? bTo : cPromotes ? cArrival : fArrival ?? cArrival;
        const alternatives: readonly (Promoted | null)[] = bPromotes || cPromotes || fPromotes ? PROMOTIONS : [null];
        const entryKey = entries.map(entry => `${entry.square}:${Number(entry.diagonal)}`).join("/");
        let compiledEntries = COMPILED_ENTRIES.get(entryKey);
        if (!compiledEntries) { compiledEntries = Object.freeze(entries.map(entry => Object.freeze(entry))); COMPILED_ENTRIES.set(entryKey, compiledEntries); }
        for (const promotion of alternatives) {
          yield Object.freeze({ key: `${b ? "B" : "-"}:${c}:${f ? "F" : "-"}:${binding}:${order}:${promotion ?? "p"}`, arrival, promotion,
            entries: compiledEntries });
        }
      }
    }
  }
}

const COMPILED_MACROS = new Map<string, readonly MarineOpportunity[]>();
for (const side of ["w", "b"] as const) for (let gas = 0; gas <= 3; gas++) for (let f = 0; f < 8; f++) for (let r = 1; r <= 8; r++) {
  const source = `${"abcdefgh"[f]}${r}` as Square;
  COMPILED_MACROS.set(`${side}:${source}:${gas}`, Object.freeze([...compileMacros(source, side, gas)]));
}
export function* marineOpportunities(source: Square, side: Side, gas: number, meter: Meter): Generator<MarineOpportunity> {
  charge(meter, 16, "$.work.feature.promotion.compiledGeometry");
  const macros = COMPILED_MACROS.get(`${side}:${source}:${gas}`)!;
  charge(meter, 8 + 4 * macros.length, "$.work.feature.promotion.compiledMacroVisits");
  yield* macros;
}

type RouteView = Readonly<{ compatible: boolean; blockers: ReadonlySet<Square>; cover: ReadonlySet<Square>; vision: ReadonlySet<Square> }>;
export type PromotionRoute = Readonly<{ key: string; source: Square; arrival: Square; promotion: Promoted; opportunities: number; baseline: RouteView; candidate: RouteView }>;
type EntryContact = Readonly<{ compatible: boolean; blocker: boolean; cover: boolean; vision: boolean }>;
type AnnotationCache = WeakMap<RouteView, WeakMap<readonly MarineEntry[], RouteView>>;

const annotateEntries = (entries: readonly MarineEntry[], prior: RouteView, own: OwnView, layers: FeatureLayers, lit: ReadonlySet<Square>, contacts: Map<string, EntryContact>, cache: AnnotationCache, meter: Meter): RouteView => {
  if (entries.length === 0) return prior;
  const cached = cache.get(prior)?.get(entries);
  if (cached) return cached;
  charge(meter, 8 + 3 * (prior.blockers.size + prior.cover.size + prior.vision.size) + 29 * entries.length + 5, "$.work.feature.promotion.annotationCopy");
  const blockers = new Set(prior.blockers), cover = new Set(prior.cover), vision = new Set(prior.vision);
  let compatible = prior.compatible;
  for (const entry of entries) {
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
    compatible &&= contact.compatible;
    if (contact.blocker) blockers.add(entry.square);
    if (contact.cover) cover.add(entry.square);
    if (contact.vision) vision.add(entry.square);
  }
  const result = { compatible, blockers, cover, vision };
  let byEntries = cache.get(prior);
  if (!byEntries) { byEntries = new WeakMap(); cache.set(prior, byEntries); }
  byEntries.set(entries, result);
  return result;
};

function* routeFamily(projection: OwnProjection, sources: readonly Square[], enemySide: Side, turn: number, horizon: 1 | 2 | 3, meter: Meter, pooled: boolean): Generator<PromotionRoute> {
  const baselineLit = ownLitSquares(projection.baseline, meter), candidateLit = ownLitSquares(projection.final, meter);
  charge(meter, 6 * 4 + 12, "$.work.feature.promotion.routeSetup");
  const empty: RouteView = { compatible: true, blockers: new Set(), cover: new Set(), vision: new Set() };
  const seen = new Set<string>();
  const baselineContacts = new Map<string, EntryContact>(), candidateContacts = new Map<string, EntryContact>();
  const baselineAnnotations: AnnotationCache = new WeakMap(), candidateAnnotations: AnnotationCache = new WeakMap();
  const macrosBySquareGas = new Map<string, readonly MarineOpportunity[]>();
  const prefixes = new Set<string>(), arrivals = new Set<string>();
  const contactKeys = new WeakMap<RouteView, string>();
  const contactKey = (view: RouteView): string => {
    const cached = contactKeys.get(view);
    if (cached !== undefined) return cached;
    const count = view.blockers.size + view.cover.size + view.vision.size;
    charge(meter, 16 + count * (8 + 4 * Math.ceil(Math.log2(count + 1))), "$.work.feature.promotion.contactKey");
    const key = `${Number(view.compatible)}:${[...view.blockers].sort().join(",")}:${[...view.cover].sort().join(",")}:${[...view.vision].sort().join(",")}`;
    contactKeys.set(view, key); return key;
  };
  function* walk(source: Square, square: Square, sequence: string, depth: number, baseline: RouteView, candidate: RouteView): Generator<PromotionRoute> {
    charge(meter, 30, "$.work.feature.promotion.depthVisit");
    if (depth === horizon) return;
    // WHAT: maximum Marine rank progress is three per remaining opportunity.
    const distance = enemySide === "w" ? 8 - Number(square[1]) : Number(square[1]) - 1;
    if (distance === 0 || distance > 3 * (horizon - depth)) return;
    if (pooled) {
      const bKey = contactKey(baseline), qKey = contactKey(candidate);
      charge(meter, 20 + 2 * (bKey.length + qKey.length), "$.work.feature.promotion.prefixKey");
      const prefix = `${square}:${depth}:${bKey}:${qKey}`;
      if (prefixes.has(prefix)) return;
      prefixes.add(prefix);
    }
    charge(meter, 16, "$.work.feature.promotion.publicEnergy");
    const gas = energyForTurn(turn + depth);
    charge(meter, 12, "$.work.feature.promotion.geometryCache");
    const macroKey = `${square}:${gas}`;
    let macros = macrosBySquareGas.get(macroKey);
    if (!macros) {
      macros = Object.freeze([...marineOpportunities(square, enemySide, gas, meter)]);
      macrosBySquareGas.set(macroKey, macros);
    }
    charge(meter, 16 + macros.length * (6 + 2 * (sequence.length + 32) + 24 + 5 + 14 + 2 * (source.length + sequence.length + 40) + 25), "$.work.feature.promotion.routeBranchVisits");
    for (const macro of macros) {
      const key = pooled ? macro.key : `${sequence}/${macro.key}`;
      const b = annotateEntries(macro.entries, baseline, projection.baseline, projection.layers, baselineLit, baselineContacts, baselineAnnotations, meter);
      const q = annotateEntries(macro.entries, candidate, projection.final, projection.layers, candidateLit, candidateContacts, candidateAnnotations, meter);
      if (!b.compatible && !q.compatible) continue;
      if (macro.promotion) {
        if (pooled) {
          const bKey = contactKey(b), qKey = contactKey(q);
          charge(meter, 24 + 2 * (bKey.length + qKey.length), "$.work.feature.promotion.arrivalKey");
          const arrival = `${macro.arrival}:${macro.promotion}:${depth + 1}:${bKey}:${qKey}`;
          if (arrivals.has(arrival)) continue;
          arrivals.add(arrival);
        }
        const identity = `${source}:${key}:${macro.promotion}`;
        if (!pooled && seen.has(identity)) continue;
        if (!pooled) seen.add(identity);
        yield { key: identity, source, arrival: macro.arrival, promotion: macro.promotion, opportunities: depth + 1, baseline: b, candidate: q };
      } else yield* walk(source, macro.arrival, key, depth + 1, b, q);
    }
  }
  for (const source of sources) {
    charge(meter, 4, "$.work.feature.promotion.sourceVisit");
    yield* walk(source, source, "", 0, empty, empty);
  }
}
export function* promotionRoutes(projection: OwnProjection, sources: readonly Square[], enemySide: Side, turn: number, horizon: 1 | 2 | 3, meter: Meter): Generator<PromotionRoute> {
  yield* routeFamily(projection, sources, enemySide, turn, horizon, meter, false);
}

const gains = (after: ReadonlySet<Square>, before: ReadonlySet<Square>): boolean => {
  for (const square of after) {
    if (!before.has(square)) return true;
  }
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
    for (const route of routeFamily(projection, frontiers[channel], side === "w" ? "b" : "w", turn, 3, meter, true)) {
      charge(meter, 8 + 12 + 7 + 6 * 3 * 9 + 5 + 5 * (route.candidate.blockers.size + route.baseline.blockers.size + route.candidate.cover.size + route.baseline.cover.size + route.candidate.vision.size), "$.work.feature.promotion.fileIdentityAndPools");
      const file = route.arrival[0];
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
      const predicates = [exposed,
        gains(route.candidate.blockers, route.baseline.blockers), gains(route.baseline.blockers, route.candidate.blockers),
        gains(route.candidate.cover, route.baseline.cover), gains(route.baseline.cover, route.candidate.cover),
        gains(route.candidate.vision, route.baseline.vision)];
      for (let k = 0; k < 6; k++) for (let h = route.opportunities; h <= 3; h++) {
        if (predicates[k]) files[k][h - 1].add(file);
      }
    }
    for (let k = 0; k < 6; k++) for (let h = 1; h <= 3; h++) {
      charge(meter, 12, "$.work.feature.promotion.coordinateAndScale");
      result[`${PROMOTION_KERNELS[k]}.${channel}.h${h}` as PromotionName] = files[k][h - 1].size / 8;
    }
  }
  charge(meter, 37, "$.work.feature.promotion.blockFreeze");
  const cursor = beginPromotion36(meter);
  let index = 0;
  for (const kernel of PROMOTION_KERNELS) for (const channel of PROMOTION_CHANNELS) for (const h of [1, 2, 3] as const)
    putPromotion36(meter, cursor, index++, result[`${kernel}.${channel}.h${h}`]);
  return finishPromotion36(meter, cursor);
};
