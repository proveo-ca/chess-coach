import { describe, expect, it } from "vitest";

import {
  COMBAT_CHAIN_PLY_SC,
  COMBAT_CHAIN_STEPS,
  queueCombatChainStep,
} from "~/starchess/demos/combatChain";
import { endScTurn } from "~/starchess/endScTurn";

describe("probe", () => {
  it("dump resolve", () => {
    for (let i = 0; i < COMBAT_CHAIN_STEPS.length; i++) {
      const step = COMBAT_CHAIN_STEPS[i]!;
      const before = COMBAT_CHAIN_PLY_SC[i]!;
      const q = queueCombatChainStep(before, step);
      const r = endScTurn(q);
      const attacks = r.resolved.attacks.map((a) => JSON.stringify(a));
      const moves = r.resolved.moves.map((m) => `${m.color}${m.piece}${m.from}->${m.to}`);
      const collisions = r.resolved.moveCollisions.map((a) => `${a.kind}:${a.color}${a.from}->${a.to}`);
      const mineTriggers = r.resolved.mineTriggers.map((a) => `${a.kind}:${a.color}${a.from}->${a.to}`);
      process.stdout.write(
        [
          `\nTurn ${i + 1} ${step.caption}`,
          `before placement: ${before.placement}`,
          `attacks: ${JSON.stringify(attacks)}`,
          `moves: ${JSON.stringify(moves)}`,
          `moveCollisions: ${JSON.stringify(collisions)}`,
          `mineTriggers: ${JSON.stringify(mineTriggers)}`,
          `after placement: ${r.next.placement}`,
          "",
        ].join("\n"),
      );
    }
    expect(true).toBe(true);
  });
});
