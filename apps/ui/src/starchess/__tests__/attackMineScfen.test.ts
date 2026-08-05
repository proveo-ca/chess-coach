import { describe, expect, it } from "vitest";

import {
  ATTACK_MINE_PLY_SC,
  ATTACK_MINE_START_SCFEN,
  ATTACK_MINE_STEPS,
  queueAttackMineStep,
} from "~/starchess/demos/attackMine";
import { endScTurn } from "~/starchess/endScTurn";
import { parseScFen } from "~/starchess/scfen";

describe("attackMine SCFEN (attack → occupy)", () => {
  it("builds start + one resolve ply", () => {
    expect(ATTACK_MINE_PLY_SC).toHaveLength(2);
    expect(ATTACK_MINE_STEPS).toHaveLength(1);
  });

  it("attack clears mine then knight occupies c3", () => {
    const before = ATTACK_MINE_PLY_SC[0]!;
    const queued = queueAttackMineStep(before, ATTACK_MINE_STEPS[0]!);
    const { resolved, next } = endScTurn(queued);

    expect(resolved.attacks[0]).toMatchObject({
      kind: "mineBlast",
      from: "d1",
      to: "c3",
      mineColor: "b",
    });
    expect(resolved.attacks[0]).not.toHaveProperty("victim");
    expect(resolved.mineTriggers).toEqual([]);
    expect(resolved.moves).toEqual([
      { piece: "n", color: "w", from: "d1", to: "c3" },
    ]);
    expect(resolved.afterAttack.mines).toEqual([]);
    expect(next.placement).toBe("7k/8/8/8/8/2N5/8/4K3");
    expect(next.mines ?? []).toEqual([]);
    expect(ATTACK_MINE_PLY_SC[1]).toMatchObject({
      placement: next.placement,
    });
  });

  it("start SCFEN parses with black mine c3", () => {
    const s = parseScFen(ATTACK_MINE_START_SCFEN);
    expect(s.mines).toEqual([{ color: "b", at: "c3" }]);
    expect(s.placement).toBe("7k/8/8/8/8/8/8/3NK3");
  });
});
