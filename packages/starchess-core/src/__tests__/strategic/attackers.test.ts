// SPEC: _spec/apps/starchess/core/adjutant/strategic/cc-retaliation.puml
/**
 * Retaliation — the shooter comes off the board, however possible.
 *
 * Firing on a Command Center is the one act fog cannot cover: the hit is felt
 * and the shot names its origin. The standing instruction is blunt, so these
 * cases check the blunt thing — that the answer wins the turn against the
 * offers that normally would.
 */
import { describe, expect, it } from "vitest";

import { parseScFen } from "../../index";
import { UNIT_COST } from "../../rules/constants";
import { evaluateMove } from "../../ai/context";
import { strategicAdjutant } from "../../ai/strategic";
import { buildStrategicCtx } from "../../ai/strategic/context";
import type { AttackerMemory } from "../../ai/strategic/attackers";
import {
  attackers as attackersStrategy,
  avengeDeployValue,
  avengeValue,
  AVENGE_CC_SHOT,
  AVENGE_THRIFT,
} from "../../ai/strategic/strategies/attackers";

const snapOf = (placement: string, turn = 5) =>
  parseScFen(`SCFEN|${placement}|${turn}|33|P|G:11:11|Q:w:;b:`);

const wanted = (at: string, turn = 5): AttackerMemory => ({
  attackers: [{ at: at as never, piece: "r", turn }],
  turn,
});

const blackActions = (snapshot: ReturnType<typeof parseScFen>) =>
  snapshot.queue?.actions.filter((a) => a.color === "b") ?? [];

describe("Command Center retaliation", () => {
  /**
   * The white tank on c8 shot our Command Center and is no longer in line with
   * it — the case the memory exists for, since a shooter that is *still*
   * checking is survival's business (and `DEPLOY_ATTACK_SURVIVAL` already
   * outbids everything to take a live checker). Our tank on c1 can go up the
   * file and collect the debt.
   */
  const SHOOTER_AT_LARGE = "2R5/4k3/8/8/8/8/8/Q1r1K3";

  it("takes the shooter once it is remembered", () => {
    const plan = strategicAdjutant(snapOf(SHOOTER_AT_LARGE), {
      color: "b",
      storedFor: () => 0,
      attackerMemory: wanted("c8"),
    });
    const moves = blackActions(plan.snapshot).filter((a) => a.kind === "classical");
    expect(moves.map((a) => a.to)).toContain("c8");
  });

  it("pays the debt only for the shooter's square, and only to a capture", () => {
    const ctx = buildStrategicCtx(snapOf(SHOOTER_AT_LARGE), {
      color: "b",
      attackerMemory: wanted("c8"),
    })!;
    const scoreOf = (from: string, to: string) => {
      const move = {
        from: from as never,
        to: to as never,
        capture: ctx.map.get(to as never) ?? null,
      };
      return attackersStrategy.score!(evaluateMove(move, ctx)!, ctx);
    };

    // Taking the shooter — the tank spends itself, so thrift shaves its cost.
    expect(scoreOf("c1", "c8")).toBe(AVENGE_CC_SHOT - AVENGE_THRIFT * UNIT_COST.r);
    // Taking the BattleShip instead settles nothing.
    expect(scoreOf("c1", "a1")).toBe(0);
    // Nor does merely standing on the square's file.
    expect(scoreOf("c1", "c7")).toBe(0);
  });

  it("crushes the shooter with a deploy when the ring reaches it", () => {
    // The shooter sits on d7, inside our Command Center's deploy ring, and
    // nothing of ours can reach it by moving.
    const plan = strategicAdjutant(snapOf("4k3/3R4/8/8/8/8/8/4K3"), {
      color: "b",
      storedFor: () => 3,
      attackerMemory: wanted("d7"),
    });
    const spawns = blackActions(plan.snapshot).filter((a) => a.kind === "spawn");
    expect(spawns.map((a) => a.to)).toContain("d7");
  });

  it("answers with the cheapest unit that can do the job", () => {
    const ctx = buildStrategicCtx(snapOf("4k3/3R4/8/8/8/8/8/4K3"), {
      color: "b",
      attackerMemory: wanted("d7"),
    })!;

    // On the move path, a marine collecting the debt beats a tank doing it.
    expect(avengeValue(ctx, "d7", UNIT_COST.p)).toBeGreaterThan(
      avengeValue(ctx, "d7", UNIT_COST.r),
    );

    // On the deploy path the same must hold *after* the deploy loop's own
    // `trade × (1 + cost)` preference for spending big is added back — the
    // thrift has to out-run that slope or the ring answers with the dearest
    // unit it can afford, which is exactly backwards.
    const net = (cost: number) =>
      avengeDeployValue(ctx, "d7", cost) + ctx.weights.trade * (1 + cost);
    expect(net(UNIT_COST.p)).toBeGreaterThan(net(UNIT_COST.q));
  });

  it("pays a deploy nothing when the wanted square holds no one", () => {
    // The record can outlive the shooter on a square we cannot see; a crush
    // needs something to crush, and every ring square is lit by our own CC.
    const ctx = buildStrategicCtx(snapOf("4k3/8/8/8/8/8/8/4K3"), {
      color: "b",
      attackerMemory: wanted("d7"),
    })!;
    expect(avengeDeployValue(ctx, "d7", UNIT_COST.p)).toBe(0);
  });
});
