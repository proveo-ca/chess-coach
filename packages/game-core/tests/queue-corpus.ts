// SPEC: _spec/turn-planning.puml
import { createHash } from "node:crypto";
import { addScAction, mapToPlacement, removeScAction, sq } from "../src";
import type { ScActionInput, ScFenSnapshot, ScPiece, Square } from "../src";

export function queueCorpus(api: { addScAction: typeof addScAction; removeScAction: typeof removeScAction } = { addScAction, removeScAction }) {
  const hash = createHash("sha256");
  const targets: Square[] = ["a1", "b2", "d2", "d4", "e5", "f6", "g7", "h8"];
  const squares = Array.from({ length: 64 }, (_, index) => sq(Math.floor(index / 8), index % 8 + 1)!);
  let worlds = 0, appends = 0, accepted = 0, removals = 0;
  const record = (value: unknown): void => { hash.update(JSON.stringify(value) + "\n"); };
  const errorValue = (error: unknown) => {
    const value = error as { code: string; name: string; message: string };
    return { code: value.code, name: value.name, message: value.message };
  };
  for (const color of ["w", "b"] as const) {
    for (const type of ["p", "n", "b", "r", "q", "k"] as const) {
      for (const from of squares) {
        for (const blocked of [false, true]) {
          worlds++;
          const map = new Map<Square, ScPiece>([["e1", { type: "k", color: "w" }], ["e8", { type: "k", color: "b" }]]);
          if (blocked) {
            for (const at of ["b2", "c4", "g7"] as const) map.set(at, { type: "p", color });
            map.set("d5", { type: "q", color: color === "w" ? "b" : "w" });
          }
          map.set(from, { type, color });
          const snapshot: ScFenSnapshot = {
            placement: mapToPlacement(map), phase: "P", turn: 21, ccLives: { w: 3, b: 3 },
            gas: { w: 3, b: 3 }, gasIncome: { w: 3, b: 3 }, queue: { actions: [] },
            ...(type === "r" ? { siegedTanks: [from] } : {}),
            ...(blocked ? { mines: [{ at: "c3", color }, { at: "f6", color }, { at: "h1", color }] } : {}),
          };
          for (const to of targets) {
            const timing = blocked ? "F" as const : "B" as const;
            const actions: ScActionInput[] = [
              { kind: "classical", timing: "C", color, from, to,
                ...(type === "p" && Number(to[1]) === (color === "w" ? 8 : 1) ? { promotion: "q" as const } : {}) },
              { kind: "deploy", timing, color, from, to, unit: "n" },
              { kind: "stimStep", timing, color, from, to },
              { kind: "spiderMine", timing, color, from },
              { kind: "charonMissiles", timing, color, from, to },
              { kind: "siegeMode", timing, color, from },
              { kind: "tacticalJump", timing, color, from, to },
            ];
            for (const action of actions) {
              appends++;
              try {
                const added = api.addScAction({ snapshot, action });
                record(added);
                accepted++;
                removals++;
                try { record(api.removeScAction({ snapshot: added.snapshot, seq: added.action.seq })); } catch (error) { record(errorValue(error)); }
                appends++;
                try { record(api.addScAction({ snapshot: added.snapshot, action })); } catch (error) { record(errorValue(error)); }
              } catch (error) { record(errorValue(error)); }
            }
          }
        }
      }
    }
  }
  return { worlds, appends, accepted, removals, sha256: hash.digest("hex") };
}
