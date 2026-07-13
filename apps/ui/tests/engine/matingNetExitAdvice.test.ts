import { describe, expect, it } from "vitest";

import {
  exitsMatingNet,
  MATING_NET_EXIT_ADVICE,
  MATING_NET_EXIT_CP,
  pickMatingNetExitAdvice,
} from "~/engine/matingNetExitAdvice";

describe("exitsMatingNet", () => {
  it("is true when human had mate and after-eval is not mate-for-human", () => {
    expect(exitsMatingNet({ kind: "mate", value: 3 }, { kind: "cp", value: 0 })).toBe(true);
    expect(exitsMatingNet({ kind: "mate", value: 2 }, { kind: "mate", value: 4 })).toBe(true);
  });

  it("is false when human still has forced mate after the move", () => {
    expect(exitsMatingNet({ kind: "mate", value: 3 }, { kind: "mate", value: -5 })).toBe(false);
    expect(exitsMatingNet({ kind: "mate", value: 1 }, { kind: "mate", value: -1 })).toBe(false);
  });

  it("is false when human did not have a mating net before", () => {
    expect(exitsMatingNet({ kind: "cp", value: 200 }, { kind: "cp", value: -500 })).toBe(false);
    expect(exitsMatingNet({ kind: "mate", value: -2 }, { kind: "cp", value: 0 })).toBe(false);
  });
});

describe("pickMatingNetExitAdvice", () => {
  it("returns one of the five mating-net-exit phrases", () => {
    expect(MATING_NET_EXIT_CP).toBe(-9000);
    expect(MATING_NET_EXIT_ADVICE).toHaveLength(5);
    const pick = pickMatingNetExitAdvice();
    expect(MATING_NET_EXIT_ADVICE).toContain(pick);
  });
});
