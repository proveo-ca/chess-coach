import { describe, expect, it } from "vitest";

import {
  decodeScfensParam,
  parseArenaFileText,
} from "~/app/arenaImport";

const START = "SCFEN|4k3/2pppp2/8/8/8/8/2PPPP2/4K3|0|33|P|G:11:11|B:3:3|Q:w:;b:";
const AFTER = "SCFEN|4k3/2pppp2/8/8/8/8/2PPP2/4K3|1|33|P|G:11:11|B:3:3|Q:w:;b:";

describe("arenaImport", () => {
  it("parseArenaFileText maps JSON parse error", () => {
    const res = parseArenaFileText("not json {");
    expect(res.ok).toBe(false);
  });

  it("parseArenaFileText validates record shape", () => {
    const good = JSON.stringify({
      id: "arc-1",
      startedAt: "2026-01-01T00:00:00.000Z",
      endedAt: "2026-01-01T00:00:01.000Z",
      players: { w: "a", b: "b" },
      mapSeed: START,
      outcome: { winner: "w", draw: false },
      turns: 1,
      scfens: [START, AFTER],
      resolves: [
        {
          resolved: null,
          next: null,
        },
      ],
    });
    expect(parseArenaFileText(good).ok).toBe(true);
    expect(parseArenaFileText(JSON.stringify({ bad: true })).ok).toBe(false);
  });

  it("decodeScfensParam validates SCFEN parse", () => {
    expect(decodeScfensParam([START, AFTER]).ok).toBe(true);
    const bad = decodeScfensParam(["SCFEN|NOT/A/VALID|SCFEN"]);
    expect(bad.ok).toBe(false);
  });

  it("decodeScfensParam requires non-empty", () => {
    expect(decodeScfensParam([]).ok).toBe(false);
  });
});
