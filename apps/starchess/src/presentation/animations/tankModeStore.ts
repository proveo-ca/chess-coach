// SPEC: _spec/apps/starchess/architecture/board-entities.puml, _spec/apps/starchess/architecture/reactivity/presentation.md
import type { Square } from "chess.js";
import { createSignal } from "solid-js";
import type { TankMode } from "@chess-coach/starchess-core";

const [modes, setModes] = createSignal<ReadonlyMap<Square, TankMode>>(new Map());

const NO_MODES: ReadonlyMap<Square, TankMode> = new Map();

export const clearSiegedTanks = () => setModes((prev) => (prev.size === 0 ? prev : NO_MODES));

export const setTankMode = (sq: Square, mode: TankMode) => {
  setModes((prev) => {
    if ((prev.get(sq) === "siege") === (mode === "siege")) return prev;
    const next = new Map(prev);
    if (mode === "siege") next.set(sq, "siege");
    else next.delete(sq);
    return next;
  });
};

export const tankModeAt = (sq: Square): TankMode =>
  modes().get(sq) === "siege" ? "siege" : "tank";

let listFor: ReadonlyMap<Square, TankMode> | null = null;
let list: Square[] = [];

export const siegedTanksList = (): Square[] => {
  const m = modes();
  if (m !== listFor) {
    listFor = m;
    list = [...m.entries()].filter(([, mode]) => mode === "siege").map(([sq]) => sq);
  }
  return list;
};
