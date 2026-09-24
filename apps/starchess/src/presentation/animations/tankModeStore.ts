// SPEC: _spec/apps/starchess/architecture/board-entities.puml
import type { Square } from "chess.js";
import { createSignal } from "solid-js";
import type { TankMode } from "@chess-coach/starchess-core";

const [modes, setModes] = createSignal<ReadonlyMap<Square, TankMode>>(new Map());

export const clearSiegedTanks = () => setModes(new Map());

export const setTankMode = (sq: Square, mode: TankMode) => {
  setModes((prev) => {
    const next = new Map(prev);
    if (mode === "siege") next.set(sq, "siege");
    else next.delete(sq);
    return next;
  });
};

export const tankModeAt = (sq: Square): TankMode =>
  modes().get(sq) === "siege" ? "siege" : "tank";

export const siegedTanksList = (): Square[] =>
  [...modes().entries()].filter(([, m]) => m === "siege").map(([sq]) => sq);
