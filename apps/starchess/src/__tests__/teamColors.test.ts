import { describe, expect, it } from "vitest";

import {
  TEAM_PRIMARY,
  TEAM_RGB,
  teamTintStyle,
} from "~/presentation/animations/teamColors";

/** `#a22` and `#aa2222` are the same colour — TEAM_PRIMARY uses both forms. */
const hexToRgb = (hex: string): string => {
  const raw = hex.replace("#", "");
  const full = raw.length === 3 ? [...raw].map((c) => c + c).join("") : raw;
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(", ");
};

describe("teamTintStyle", () => {
  it("hands CSS both spellings of the player's swatch", () => {
    expect(teamTintStyle("w")).toEqual({
      "--team-tint": "#3b7dd8",
      "--team-rgb": "59, 125, 216",
    });
    expect(teamTintStyle("b")).toEqual({
      "--team-tint": "#a22",
      "--team-rgb": "170, 34, 34",
    });
  });

  it("keeps TEAM_RGB in step with TEAM_PRIMARY", () => {
    // Two spellings of one colour drift silently — rgba() needs the triplet,
    // color-mix() needs the hex, and only this check ties them together.
    for (const color of ["w", "b"] as const) {
      expect(TEAM_RGB[color]).toBe(hexToRgb(TEAM_PRIMARY[color]));
    }
  });
});
