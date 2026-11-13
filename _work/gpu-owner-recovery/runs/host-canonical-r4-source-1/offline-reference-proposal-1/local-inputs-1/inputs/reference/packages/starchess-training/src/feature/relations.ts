// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { attacksSquare, getUnitVision, rayBetween, type ScPiece, type Square } from "@chess-coach/starchess-core/planning-v1";
import type { Meter, Side } from "../economic/contracts";
import { charge } from "../economic/work";

export type FeatureUnit = Readonly<{
  token: string; square: Square; type: ScPiece["type"]; color: Side;
  paidBasis: number; baseline: boolean; mode: "tank" | "siege" | null; nominal: boolean;
}>;
export type OwnView = Readonly<{ units: ReadonlyMap<string, FeatureUnit>; at: ReadonlyMap<Square, string>; mines: ReadonlySet<Square> }>;
export type FeatureLayers = Readonly<{ enemies: ReadonlyMap<Square, ScPiece>; unknown: ReadonlySet<Square> }>;
export type Relation = "none" | "known" | "possible";
export type RayMeasurement = Readonly<{ applicable: boolean; empty: number; occupied: number; unknown: number; distance: number }>;
const REPLACEMENT = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 } as const;

const SQUARES = Object.freeze(Array.from({ length: 64 }, (_, i) => `${"abcdefgh"[Math.floor(i / 8)]}${i % 8 + 1}` as Square));
const geometry = new Map<string, boolean>();
const rays = new Map<string, readonly Square[]>();
const vision = new Map<string, readonly Square[]>();
for (const from of SQUARES) {
  for (const to of SQUARES) {
    rays.set(`${from}:${to}`, Object.freeze(rayBetween(from, to)));
    for (const color of ["w", "b"] as const) for (const type of ["p", "n", "b", "r", "q", "k"] as const) {
      geometry.set(`${color}:${type}:${from}:${to}`, attacksSquare(new Map([[from, { type, color }]]), from, to));
    }
  }
  for (const color of ["w", "b"] as const) for (const type of ["p", "n", "b", "r", "q", "k"] as const) for (const mode of ["tank", "siege"] as const) {
    const lit = getUnitVision(new Map([[from, { type, color }]]), from, { tankModeFor: () => mode }).litSquares;
    vision.set(`${color}:${type}:${from}:${mode}`, Object.freeze([...lit]));
  }
}
const litCache = new WeakMap<OwnView, ReadonlySet<Square>>();
const exposureCache = new WeakMap<OwnView, WeakMap<FeatureLayers, Map<Square, Readonly<{ known: number; possible: number }>>>>();

export const replacementValue = (type: ScPiece["type"], meter: Meter): number => {
  charge(meter, 3, "$.work.feature.replacement.lookup");
  return REPLACEMENT[type];
};

export const chebyshev = (from: Square, to: Square, meter: Meter): number => {
  charge(meter, 16, "$.work.feature.distance.coordinates");
  return Math.max(Math.abs(from.charCodeAt(0) - to.charCodeAt(0)), Math.abs(Number(from[1]) - Number(to[1])));
};

const slidingShape = (type: ScPiece["type"], from: Square, to: Square, meter: Meter): boolean => {
  charge(meter, 28, "$.work.feature.ray.shape");
  const df = Math.abs(from.charCodeAt(0) - to.charCodeAt(0)), dr = Math.abs(Number(from[1]) - Number(to[1]));
  if (from === to) return false;
  const diagonal = df === dr, cross = df === 0 || dr === 0;
  return type === "b" ? diagonal : type === "r" ? cross : type === "q" && (diagonal || cross);
};

export const measureRay = (layers: FeatureLayers, view: OwnView, type: ScPiece["type"], from: Square, to: Square, meter: Meter): RayMeasurement => {
  const applicable = slidingShape(type, from, to, meter);
  charge(meter, 8, "$.work.feature.ray.record");
  if (!applicable) return { applicable: false, empty: 0, occupied: 0, unknown: 0, distance: 0 };
  charge(meter, 16, "$.work.feature.ray.compiled");
  const mids = rays.get(`${from}:${to}`)!;
  charge(meter, 3, "$.work.feature.ray.counters");
  let empty = 0, occupied = 0, unknown = 0;
  for (const mid of mids) {
    charge(meter, 12, "$.work.feature.ray.layerVisit");
    if (layers.enemies.has(mid) || view.at.has(mid)) occupied++;
    else if (layers.unknown.has(mid)) unknown++;
    else empty++;
  }
  charge(meter, 7, "$.work.feature.ray.result");
  return { applicable, empty, occupied, unknown, distance: chebyshev(from, to, meter) };
};

export const stationaryRelation = (layers: FeatureLayers, view: OwnView, source: Readonly<{ square: Square; type: ScPiece["type"]; color: Side }>, target: Square, meter: Meter): Relation => {
  charge(meter, 8, "$.work.feature.relation.dispatch");
  if (source.square === target) return "none";
  charge(meter, 24, "$.work.feature.relation.compiledGeometry");
  if (!geometry.get(`${source.color}:${source.type}:${source.square}:${target}`)) return "none";
  if (source.type === "b" || source.type === "r" || source.type === "q") {
    const ray = measureRay(layers, view, source.type, source.square, target, meter);
    charge(meter, 7, "$.work.feature.relation.rayClassify");
    return !ray.applicable || ray.occupied > 0 ? "none" : ray.unknown > 0 ? "possible" : "known";
  }
  charge(meter, 1, "$.work.feature.relation.nonRayReturn");
  return "known";
};

export const exposure = (layers: FeatureLayers, view: OwnView, target: Square, meter: Meter): Readonly<{ known: number; possible: number }> => {
  charge(meter, 12, "$.work.feature.exposure.cache");
  const cached = exposureCache.get(view)?.get(layers)?.get(target);
  if (cached) return cached;
  let known = 0, possible = 0;
  for (const [square, piece] of layers.enemies) {
    charge(meter, 10, "$.work.feature.exposure.sourceVisit");
    const relation = stationaryRelation(layers, view, { square, ...piece }, target, meter);
    charge(meter, 5, "$.work.feature.exposure.reduce");
    if (relation === "known") known++;
    else if (relation === "possible") possible++;
  }
  charge(meter, 3, "$.work.feature.exposure.result");
  const result = Object.freeze({ known, possible });
  let byLayers = exposureCache.get(view);
  if (!byLayers) { byLayers = new WeakMap(); exposureCache.set(view, byLayers); }
  let byTarget = byLayers.get(layers);
  if (!byTarget) { byTarget = new Map(); byLayers.set(layers, byTarget); }
  byTarget.set(target, result);
  return result;
};

export const pressure = (layers: FeatureLayers, view: OwnView, actor: FeatureUnit, meter: Meter): Readonly<{ units: number; cc: number }> => {
  charge(meter, 4, "$.work.feature.pressure.allocate");
  let units = 0, cc = 0;
  for (const [square, piece] of layers.enemies) {
    charge(meter, 7, "$.work.feature.pressure.targetVisit");
    const relation = stationaryRelation(layers, view, actor, square, meter);
    charge(meter, 5, "$.work.feature.pressure.reduce");
    if (relation === "known") { if (piece.type === "k") cc = 1; else units++; }
  }
  charge(meter, 3, "$.work.feature.pressure.result");
  return { units, cc };
};

export const threatened = (layers: FeatureLayers, view: OwnView, meter: Meter): Readonly<{ units: number; ccKnown: boolean }> => {
  charge(meter, 4, "$.work.feature.threatened.allocate");
  let units = 0, ccKnown = false;
  for (const unit of view.units.values()) {
    charge(meter, 5, "$.work.feature.threatened.tokenVisit");
    const e = exposure(layers, view, unit.square, meter);
    charge(meter, 8, "$.work.feature.threatened.reduce");
    if (unit.type === "k") ccKnown ||= e.known > 0;
    else if (e.known + e.possible > 0) units++;
  }
  charge(meter, 3, "$.work.feature.threatened.result");
  return { units, ccKnown };
};

export const ownLitSquares = (view: OwnView, meter: Meter): ReadonlySet<Square> => {
  charge(meter, 8, "$.work.feature.vision.cache");
  const cached = litCache.get(view);
  if (cached) return cached;
  charge(meter, 2 + 3 * view.mines.size, "$.work.feature.vision.mineCopy");
  const result = new Set(view.mines);
  for (const unit of view.units.values()) {
    charge(meter, 24, "$.work.feature.vision.compiledUnit");
    const lit = vision.get(`${unit.color}:${unit.type}:${unit.square}:${unit.mode ?? "tank"}`)!;
    for (const square of lit) {
      charge(meter, 4, "$.work.feature.vision.unionVisit");
      result.add(square);
    }
  }
  charge(meter, 1, "$.work.feature.vision.return");
  litCache.set(view, result);
  return result;
};
