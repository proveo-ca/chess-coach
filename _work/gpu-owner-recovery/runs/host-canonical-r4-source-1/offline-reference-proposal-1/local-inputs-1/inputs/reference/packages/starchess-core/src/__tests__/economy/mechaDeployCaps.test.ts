/**
 * Mecha deploy caps — shared gate for both adjutant scripts.
 * At most 2 own Mechas per square-color (a1 is dark) and at most 4 total;
 * only an instant classical capture of a *visible* enemy BattleShip/Tank from the
 * landing square bypasses the per-color cap (never the total).
 */
import { describe, expect, it } from "vitest";
import type { Square } from "chess.js";

import {
  countMechasByColor,
  deployCapturesBigThreat,
  isMechaDeployCapped,
  MAX_MECHAS_PER_COLOR,
  MAX_MECHAS_TOTAL,
  squareColor,
} from "../../ai/strategies/economy";
import { placementToMap } from "../../board/placement";

const mapOf = (placement: string) => placementToMap(placement);
const always = () => true;
const never = () => false;

describe("squareColor", () => {
  it("calls a1 dark and alternates", () => {
    expect(squareColor("a1")).toBe("dark");
    expect(squareColor("h1")).toBe("light");
    expect(squareColor("e1")).toBe("dark");
    expect(squareColor("e8")).toBe("light");
    expect(squareColor("d8")).toBe("dark");
    expect(squareColor("d7")).toBe("light");
  });
});

describe("countMechasByColor", () => {
  it("splits own Mechas and ignores everything else", () => {
    // Black Mechas b6 + d4 (dark), a4 (light); white Mecha b3; black Marine e5.
    const map = mapOf("4k3/8/1b6/8/b2b4/1B6/4p3/4K3");
    expect(countMechasByColor(map, "b")).toEqual({ dark: 2, light: 1, total: 3 });
    expect(countMechasByColor(map, "w")).toEqual({ dark: 0, light: 1, total: 1 });
  });
});

describe("isMechaDeployCapped", () => {
  it("allows the first two per color and the fourth overall", () => {
    const map = mapOf("4k3/8/1b6/8/8/8/8/4K3"); // one dark Mecha
    expect(isMechaDeployCapped(map, "b", "e7", always)).toBe(false);
  });

  it("suppresses the third on a color", () => {
    // Two dark Mechas already (b6, d4); d8/e7/f8 ring squares are dark.
    const map = mapOf("4k3/8/1b6/8/3b4/8/8/4K3");
    expect(isMechaDeployCapped(map, "b", "e7", always)).toBe(true);
    expect(isMechaDeployCapped(map, "b", "d7", always)).toBe(false);
  });

  it("suppresses the fifth Mecha even with a BattleShip in sight", () => {
    // Four black Mechas: b6 + d4 dark, a4 + g2 light.
    const base = "4k3/8/1b6/8/b2b4/8/6b1/4K3";
    expect(countMechasByColor(mapOf(base), "b")).toEqual({ dark: 2, light: 2, total: 4 });
    // BattleShip visible on a diagonal of the landing square — still capped.
    const withBattleShip = mapOf("4k3/8/1b6/5Q2/b2b4/8/6b1/4K3");
    expect(isMechaDeployCapped(withBattleShip, "b", "d7", always)).toBe(true);
  });

  it("nets out a crush-replaced own Mecha", () => {
    // Two dark Mechas, one standing ON the target square: replacing it is
    // not a third.
    const map = mapOf("4k3/4b3/1b6/8/8/8/8/4K3"); // e7 + b6 dark Mechas
    const occ = map.get("e7");
    expect(occ).toEqual({ type: "b", color: "b" });
    expect(isMechaDeployCapped(map, "b", "e7", always)).toBe(false);
  });

  it("lets the third through when it instantly captures a big threat", () => {
    // Two dark Mechas (b6, d4); Mecha dropped on e7 takes BattleShip c5.
    const map = mapOf("4k3/8/1b6/2Q5/3b4/8/8/4K3");
    expect(deployCapturesBigThreat(map, "b", "e7", always)).toBe(true);
    expect(isMechaDeployCapped(map, "b", "e7", always)).toBe(false);
  });

  it("admits a Tank capture and refuses through a blocked ray", () => {
    // White Tank h4 on the e7 diagonal (via f6, g5): exception.
    const tank = mapOf("4k3/8/1b6/8/3b3R/8/8/4K3");
    expect(deployCapturesBigThreat(tank, "b", "e7", always)).toBe(true);
    // Same ray with a black Marine on f6 in the way: no capture.
    const blocked = mapOf("4k3/8/1b3p2/8/3b3R/8/8/4K3");
    expect(deployCapturesBigThreat(blocked, "b", "e7", always)).toBe(false);
  });

  it("counts crushing the BattleShip on the landing square itself", () => {
    // Two dark Mechas; enemy BattleShip sits ON the dark ring square e7.
    const map = mapOf("4k3/4Q3/1b6/8/3b4/8/8/4K3");
    expect(deployCapturesBigThreat(map, "b", "e7", always)).toBe(true);
    expect(isMechaDeployCapped(map, "b", "e7", always)).toBe(false);
    // ...but not when that BattleShip is unseen.
    expect(deployCapturesBigThreat(map, "b", "e7", never)).toBe(false);
    expect(isMechaDeployCapped(map, "b", "e7", never)).toBe(true);
  });

  it("nets a replace-at-total-four down to three", () => {
    // Four Mechas (e7 + b6 dark, a4 + g2 light) with one standing on the
    // target: replacing it projects 3 total / 1 dark, so it is allowed.
    const map = mapOf("4k3/4b3/1b6/8/b7/8/6b1/4K3");
    expect(countMechasByColor(map, "b")).toEqual({ dark: 2, light: 2, total: 4 });
    expect(isMechaDeployCapped(map, "b", "e7", always)).toBe(false);
  });

  it("withholds the exception for unlit victims, minor victims, and Command Centers", () => {
    const map = mapOf("4k3/8/1b6/2Q5/3b4/8/8/4K3");
    // Unlit BattleShip: no exception.
    expect(deployCapturesBigThreat(map, "b", "e7", never)).toBe(false);
    expect(isMechaDeployCapped(map, "b", "e7", never)).toBe(true);
    // Hoverbike on the diagonal is not a big threat.
    const hoverbike = mapOf("4k3/8/1b6/2N5/3b4/8/8/4K3");
    expect(deployCapturesBigThreat(hoverbike, "b", "e7", always)).toBe(false);
    // Command Center on the diagonal is never a capture.
    const commandCenter = mapOf("4k3/8/1b6/2K5/3b4/8/8/4K3");
    expect(deployCapturesBigThreat(commandCenter, "b", "e7", always)).toBe(false);
  });

  it("constants hold their designed values", () => {
    expect(MAX_MECHAS_TOTAL).toBe(4);
    expect(MAX_MECHAS_PER_COLOR).toBe(2);
  });
});
