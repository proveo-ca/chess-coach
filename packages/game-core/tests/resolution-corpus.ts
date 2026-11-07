// SPEC: _spec/resolution-primitives.puml
import { createHash } from "node:crypto";
import { charonRayEdge, charonStrikeTarget, charonTargetShips, getSideVision, hostileMineOn, mapToPlacement,
  mineContact, moverContact, rayBetween, scanRay, sq, timedMover, travelTicks, withoutMine } from "../src";
import type { ScMine, ScPiece, Square } from "../src";

export function resolutionCorpus(api: {
  charonRayEdge: typeof charonRayEdge; charonStrikeTarget: typeof charonStrikeTarget;
  charonTargetShips: typeof charonTargetShips; hostileMineOn: typeof hostileMineOn;
  mineContact: typeof mineContact; moverContact: typeof moverContact; scanRay: typeof scanRay;
  timedMover: typeof timedMover; travelTicks: typeof travelTicks; withoutMine: typeof withoutMine;
} = { charonRayEdge, charonStrikeTarget, charonTargetShips, hostileMineOn, mineContact, moverContact, scanRay, timedMover, travelTicks, withoutMine }) {
  const hashes = { timing: createHash("sha256"), mines: createHash("sha256"), charon: createHash("sha256"), rays: createHash("sha256") };
  const counts = { schedules: 0, contacts: 0, mines: 0, charon: 0, rays: 0 };
  const record = (key: keyof typeof hashes, value: unknown) => hashes[key].update(JSON.stringify(value) + "\n");
  const squares = Array.from({ length: 64 }, (_, index) => sq(Math.floor(index / 8), index % 8 + 1)!);
  const types = ["p", "n", "b", "r", "q", "k"] as const;
  for (const from of squares) {
    for (const to of squares) {
      for (const piece of types) {
        for (const dies of [false, true]) {
          const mover = api.timedMover(from, to, piece, { diesOnLanding: dies });
          record("timing", [api.travelTicks(from, to, piece), mover]);
          counts.schedules++;
          for (const other of types) {
            record("timing", api.moverContact(mover, api.timedMover(to, from, other)));
            counts.contacts++;
          }
        }
      }
      for (const color of ["w", "b"] as const) {
        const enemy = color === "w" ? "b" as const : "w" as const;
        const middle = rayBetween(from, to)[0];
        for (let variant = 0; variant < 6; variant++) {
          const map = new Map<Square, ScPiece>();
          if (variant !== 5) map.set(from, { type: "b", color });
          map.set(to, { type: variant === 4 ? "p" : "q", color: variant === 1 ? color : enemy });
          if (middle && variant >= 2 && variant <= 4) map.set(middle, { type: variant === 4 ? "p" : "q", color: variant === 3 ? color : enemy });
          for (const bound of [undefined, color]) {
            record("charon", [api.charonStrikeTarget(map, from, to, bound), api.charonTargetShips(map, from), api.charonRayEdge(from, to)]);
            counts.charon++;
          }
        }
      }
    }
  }
  for (const color of ["w", "b"] as const) {
    const enemy = color === "w" ? "b" as const : "w" as const;
    for (const from of squares) {
      const targets: Square[] = ["a1", "a8", "h1", "h8"];
      for (const to of targets) {
        const path = [...rayBetween(from, to), to];
        const first = path[0]!;
        const layouts: (ScMine[] | undefined)[] = [undefined, [], [{ at: first, color }], [{ at: first, color: enemy }],
          [{ at: to, color: enemy }], [{ at: first, color }, { at: first, color: enemy }],
          [{ at: first, color: enemy }, { at: first, color }], [{ at: first, color: enemy }, { at: to, color: enemy }]];
        for (const mines of layouts) for (const piece of types) for (const mode of ["attack", "walk", "arrive", "walkThenAttack"] as const) {
          const hit = api.mineContact({ mines, color, piece, squares: path, mode });
          record("mines", [hit, api.withoutMine(mines ?? [], hit), api.hostileMineOn(mines, color, first)]);
          counts.mines++;
        }
      }
      targets.push(sq(from.charCodeAt(0) - 97, 1)!, sq(from.charCodeAt(0) - 97, 8)!);
      for (const to of targets) for (const type of types) for (let variant = 0; variant < 3; variant++) {
        const board = new Map<Square, ScPiece>([[from, { type, color }]]);
        const mids = rayBetween(from, to);
        if (variant && mids.length) board.set(mids[variant === 1 ? 0 : mids.length - 1]!, { type: "p", color: enemy });
        if (from !== "h8") board.set("h8", { type: "q", color: enemy });
        const placement = mapToPlacement(board);
        const visionOpts = { tankModeFor: () => variant === 2 ? "siege" as const : "tank" as const, mines: [{ at: "b2" as const, color }] };
        const vision = getSideVision(board, color, visionOpts);
        const evaluated: unknown[] = [];
        const result = api.scanRay({
          board, placement, from, intentTo: to, color, visionOpts,
          canSee: (_side, at) => vision.litSquares.has(at) || vision.revealedPieces.has(at),
        }, target => {
          const steps: [Square, boolean][] = [];
          return { step: (mid, visible) => steps.push([mid, visible]), returned: value => evaluated.push({ target, steps, value }) };
        });
        record("rays", [result, evaluated]);
        counts.rays++;
      }
    }
  }
  return { ...counts, sha256: Object.fromEntries(Object.entries(hashes).map(([key, hash]) => [key, hash.digest("hex")])) };
}
