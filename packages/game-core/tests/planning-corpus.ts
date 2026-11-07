// SPEC: _spec/turn-planning.puml
import { createHash } from "node:crypto";
import { knownAppendFailure, nativeClassicalChecks, sq } from "../src";
import type { NativeClassicalEligibility, ScAction, ScActionInput, ScPiece, Square } from "../src";

export function planningCorpus(api: {
  knownAppendFailure: typeof knownAppendFailure;
  nativeClassicalChecks: typeof nativeClassicalChecks;
} = { knownAppendFailure, nativeClassicalChecks }) {
  const hashes = { append: createHash("sha256"), native: createHash("sha256") };
  const targets: Square[] = ["a1", "b2", "d2", "d4", "e5", "f6", "g7", "h8"];
  const squares = Array.from({ length: 64 }, (_, index) => sq(Math.floor(index / 8), index % 8 + 1)!);
  const normalized = (value: NativeClassicalEligibility) => ({
    kind: value.kind, from: value.from, to: value.to, actor: value.actor ?? null,
    sieged: [...value.sieged].sort(), diagnostic: value.diagnostic ?? null,
  });
  let worlds = 0, nativeQueries = 0, appendQueries = 0;
  for (const side of ["w", "b"] as const) {
    for (const type of ["p", "n", "b", "r", "q", "k"] as const) {
      for (const from of squares) {
        for (const blocked of [false, true]) {
          worlds++;
          const knownPieces = new Map<Square, ScPiece>([["e1", { type: "k", color: "w" }], ["e8", { type: "k", color: "b" }]]);
          if (blocked) {
            for (const at of ["b2", "c4", "g7"] as const) knownPieces.set(at, { type: "p", color: side });
            knownPieces.set("d5", { type: "q", color: side === "w" ? "b" : "w" });
          }
          knownPieces.set(from, { type, color: side });
          const ownSiegedTanks = new Set<Square>(type === "r" ? [from] : []);
          const knowledge = {
            side, knownPieces, unknownSquares: new Set(squares.filter(at => !knownPieces.has(at))), ownSiegedTanks,
            ownMines: new Set<Square>(blocked ? ["c3", "f6", "h1"] : []),
          };
          const own = { ownUnits: new Map([...knownPieces].filter(([, piece]) => piece.color === side)), ownSieged: ownSiegedTanks };
          const anchor: Square = side === "w" ? "e1" : "e8";
          const next = sq(from.charCodeAt(0) - 97, Number(from[1]) + (side === "w" ? 1 : -1)) ?? from;
          const step: ScActionInput = { timing: "B", kind: "stimStep", color: side, from, to: next };
          const birth: ScActionInput = { timing: "B", kind: "deploy", color: side, from: anchor, to: from, unit: "n" };
          for (const to of targets) {
            const classical: Extract<ScActionInput, { timing: "C" }> = {
              kind: "classical", timing: "C", color: side, from, to,
              ...(type === "p" && Number(to[1]) === (side === "w" ? 8 : 1) ? { promotion: "q" as const } : {}),
            };
            const queues = [[classical], [step, classical], [classical, step], [birth, step, classical]];
            const prefixes = [[], [step], [classical], [birth, step]];
            queues.forEach((queue, index) => {
              const actions: ScAction[] = queue.map((action, seq) => ({ ...action, seq }));
              const c = actions.find((action): action is Extract<ScAction, { timing: "C" }> => action.timing === "C")!;
              const checks = api.nativeClassicalChecks(own, actions, c);
              hashes.native.update(JSON.stringify({ insertion: normalized(checks.insertion), resulting: normalized(checks.resulting) }) + "\n");
              nativeQueries++;
              const timing = index % 2 === 0 ? "B" as const : "F" as const;
              const appends: ScActionInput[] = [classical,
                { kind: "deploy", timing, color: side, from: anchor, to, unit: "n" },
                { kind: "stimStep", timing, color: side, from, to },
                { kind: "spiderMine", timing, color: side, from },
                { kind: "charonMissiles", timing, color: side, from, to },
                { kind: "siegeMode", timing, color: side, from },
                { kind: "tacticalJump", timing, color: side, from, to },
              ];
              for (const action of appends) {
                hashes.append.update(JSON.stringify(api.knownAppendFailure(knowledge, prefixes[index]!, action)) + "\n");
                appendQueries++;
              }
            });
          }
        }
      }
    }
  }
  return { worlds, nativeQueries, appendQueries, sha256: Object.fromEntries(Object.entries(hashes).map(([key, hash]) => [key, hash.digest("hex")])) };
}
