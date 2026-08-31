/**
 * Chip-ply coverage — `beginScTurn` king shots settle as their own recorded
 * ply (`{ scfen: post-chip, resolve: asResolve }`), including a terminal king
 * chip. Fixture: white bishop d7 aims at the black king e8 on a line the
 * bishop itself lights (so the target is revealed to white at turn-open).
 */
import { describe, expect, it } from "vitest";

import {
  formatScFen,
  normalizeSnapGas,
  type EndScTurnResult,
} from "@chess-coach/starchess-core";

import { naiveScript } from "../players/naive";
import { recordFromRun } from "../record/record";
import { runMatch } from "../run/runMatch";

const BISHOP_LINE = "SCFEN|4k3/3B4/8/8/8/8/8/7K|";

/** lives=11 (1 per king) ⇒ the first turn-open chip is terminal (white won). */
const LIVES_1 = `${BISHOP_LINE}0|11|P|G:11:11|B:3:3|Q:w:;b:`;
/** lives=33 (max, like the canonical start) ⇒ chips can land in sequence. */
const LIVES_5 = `${BISHOP_LINE}0|33|P|G:11:11|B:3:3|Q:w:;b:`;

const chipEvent = (resolve: EndScTurnResult): boolean =>
  resolve.events.some((e) => e.phase === "attack" && e.id.startsWith("ev-begin"));

describe("turn-open chip plies", () => {
  it("records a terminal king chip as its own single ply", async () => {
    const run = await runMatch({
      players: { w: naiveScript(), b: naiveScript() },
      opening: LIVES_1,
    });

    expect(run.outcome).toMatchObject({ winner: "w" });
    expect(run.meta.status).toBe("finished");
    expect(run.plies).toHaveLength(1);
    expect(chipEvent(run.plies[0]!.resolve)).toBe(true);
  });

  it("settles every turn-open chip as a recorded ply", async () => {
    const run = await runMatch({
      players: { w: naiveScript(), b: naiveScript() },
      opening: LIVES_5,
    });

    // The first turn opens with the bishop d7 already aimed at the black king —
    // resolves[0] must be the turn-open chip while the line is still clear.
    expect(run.plies.length).toBeGreaterThanOrEqual(1);
    expect(chipEvent(run.plies[0]!.resolve)).toBe(true);
  });

  it("keeps scfens/resolves paired across the extra ply (i+1 invariant)", async () => {
    const run = await runMatch({
      players: { w: naiveScript(), b: naiveScript() },
      opening: LIVES_5,
    });
    const record = recordFromRun(run);
    for (let i = 0; i < record.resolves.length; i += 1) {
      // resolves[i] produced scfens[i+1] — chip plies included.
      expect(record.scfens[i + 1]).toBe(
        formatScFen(normalizeSnapGas(record.resolves[i]!.next)),
      );
    }
  });
});