/**
 * SCFEN notation mutation matrix — valid / invalid wire shapes.
 */
import { describe, expect, it } from "vitest";

import {
  formatScFen,
  parseScFen,
  validateScFen,
} from "~/starchess/scfen";
import type { ScFenSnapshot } from "~/starchess/types";

const COMBAT_START =
  "SCFEN|4bk2/8/5n2/4p3/8/2R5/3P4/4K3|0|33|P|G:11:11|Q:w:;b:";

const baseSnap = (): ScFenSnapshot => ({
  placement: "4bk2/8/5n2/4p3/8/2R5/3P4/4K3",
  turn: 0,
  kingLives: { w: 3, b: 3 },
  phase: "P",
  gas: { w: 1, b: 1 },
  gasIncome: { w: 1, b: 1 },
  queue: { actions: [] },
});

describe("SCFEN notation — valid shapes", () => {
  it("round-trips Combat Chain start", () => {
    const snap = parseScFen(COMBAT_START);
    expect(snap.placement).toBe("4bk2/8/5n2/4p3/8/2R5/3P4/4K3");
    expect(snap.gas).toEqual({ w: 1, b: 1 });
    expect(snap.gasIncome).toEqual({ w: 1, b: 1 });
    expect(snap.queue?.actions).toEqual([]);
    expect(formatScFen(snap)).toBe(COMBAT_START);
  });

  it("accepts empty Q:w:;b:", () => {
    const r = validateScFen(COMBAT_START);
    expect(r.ok).toBe(true);
  });

  it("accepts dual classical C actions", () => {
    const raw =
      "SCFEN|4bk2/8/5n2/4p3/8/2R5/3P4/4K3|0|33|P|G:11:11|Q:w:C=d2d4;b:C=e8c6";
    const r = validateScFen(raw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.snap.queue?.actions).toHaveLength(2);
    expect(r.snap.queue?.actions.map((a) => a.timing)).toEqual(["C", "C"]);
  });

  it("accepts snapshot-only (no Q:)", () => {
    const raw = "SCFEN|4bk2/8/5n2/4p3/8/2R5/3P4/4K3|0|33|P|G:11:11";
    const r = validateScFen(raw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.snap.queue).toBeUndefined();
  });

  it("accepts special+classical with enough income (post-spend remaining)", () => {
    // Charon cost 2; turn 11 income 2; remaining after spend 0 → G:02:22
    const raw =
      "SCFEN|4k3/8/8/8/3B4/8/8/4K3|11|33|P|G:02:22|Q:w:B=bishopSnipe:d4:h8,C=e2e4;b:";
    const r = validateScFen(raw);
    expect(r.ok).toBe(true);
  });

  it("round-trips King Hunt start", () => {
    const raw = "SCFEN|k7/5r2/8/2n5/4K3/8/7b/8|0|33|P|G:11:11|Q:w:;b:";
    expect(formatScFen(parseScFen(raw))).toBe(raw);
  });
});

describe("SCFEN notation — invalid mutations", () => {
  it("rejects missing G:", () => {
    const r = validateScFen("SCFEN|4bk2/8/5n2/4p3/8/2R5/3P4/4K3|0|33|P|Q:w:;b:");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("SC_SCHEMA");
  });

  it("rejects two classical moves on white", () => {
    const r = validateScFen(
      "SCFEN|4bk2/8/5n2/4p3/8/2R5/3P4/4K3|0|33|P|G:11:11|Q:w:C=d2d4,C=e2e4;b:",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("SC_QUEUE_SHAPE");
  });

  it("rejects B + F on the same side", () => {
    const r = validateScFen(
      "SCFEN|4k3/8/8/8/3B4/8/8/4K3|0|33|P|G:11:11|Q:w:B=pawnDouble:e2:e3,F=rookSiege:a1;b:",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("SC_QUEUE_SHAPE");
  });

  it("rejects Charon when income cannot cover cost (G:10:11)", () => {
    const r = validateScFen(
      "SCFEN|4k3/8/8/8/3B4/8/8/4K3|0|33|P|G:10:11|Q:w:B=bishopSnipe:d4:h8;b:",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("SC_GAS");
  });

  it("rejects G: income that does not match turn tier (no banked gas)", () => {
    const r = validateScFen(
      "SCFEN|4k3/8/8/8/8/8/8/4K3|0|33|P|G:33:33|Q:w:;b:",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("SC_GAS");
  });

  it("rejects unknown special kind", () => {
    const r = validateScFen(
      "SCFEN|4k3/8/8/8/8/8/8/4K3|0|33|P|G:11:11|Q:w:B=nuke:e2:e8;b:",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("SC_QUEUE_SHAPE");
  });

  it("rejects bad lives", () => {
    const r = validateScFen("SCFEN|4k3/8/8/8/8/8/8/4K3|0|99|P|G:11:11");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("SC_SCHEMA");
  });

  it("rejects missing king", () => {
    const r = validateScFen("SCFEN|4k3/8/8/8/8/8/8/8|0|33|P|G:11:11");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("SC_PLACEMENT");
  });

  it("rejects bad phase", () => {
    const r = validateScFen("SCFEN|4k3/8/8/8/8/8/8/4K3|0|33|Z|G:11:11");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("SC_PHASE");
  });

  it("rejects gas conservation violation (remaining + spent > income)", () => {
    // Charon spent 2, remaining 1, income 2 → 1+2 > 2
    const r = validateScFen(
      "SCFEN|4k3/8/8/8/3B4/8/8/4K3|11|33|P|G:12:22|Q:w:B=bishopSnipe:d4:h8;b:",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("SC_GAS");
  });
});

describe("SCFEN format from snap", () => {
  it("emits G: and empty queue", () => {
    expect(formatScFen(baseSnap())).toBe(COMBAT_START);
  });
});
