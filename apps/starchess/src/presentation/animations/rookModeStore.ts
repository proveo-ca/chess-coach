// SPEC: _spec/apps/starchess/architecture/board-entities.puml
import type { Square } from "chess.js";
import { createSignal } from "solid-js";
import type { RookMode } from "@chess-coach/starchess-core";

const [modes, setModes] = createSignal<ReadonlyMap<Square, RookMode>>(new Map());

export const clearSiegedRooks = () => setModes(new Map());

export const setRookMode = (sq: Square, mode: RookMode) => {
  setModes((prev) => {
    const next = new Map(prev);
    if (mode === "siege") next.set(sq, "siege");
    else next.delete(sq);
    return next;
  });
};

export const rookModeAt = (sq: Square): RookMode =>
  modes().get(sq) === "siege" ? "siege" : "tank";

export const siegedRooksList = (): Square[] =>
  [...modes().entries()].filter(([, m]) => m === "siege").map(([sq]) => sq);
