import { describe, expect, it } from "vitest";

import { armPieceSpecial, pieceSpecialDef } from "~/presentation/specials/pieceSpecials";
import { createMatchStore } from "~/app/MatchStoreContext";
import { createMatchStateFromScfen } from "~/app/matchReducer";

describe("armPieceSpecial", () => {
  const store = () =>
    createMatchStore({
      initial: createMatchStateFromScfen(
        "SCFEN|4k3/8/8/8/8/8/4P3/4K3|1|33|P|G:11:11|Q:w:;b:",
        5,
      ),
    });

  it("exposes defs for all pieces", () => {
    for (const p of ["p", "n", "b", "r", "q", "k"] as const) {
      expect(pieceSpecialDef(p).piece).toBe(p);
    }
  });

  it("returns false without handler or when already used", () => {
    const s = store();
    expect(
      armPieceSpecial(s, { square: "e2", piece: "p" }, {}),
    ).toBe(false);
    s.dispatch({ type: "MARK_SPECIAL_USED", square: "e2" });
    expect(
      armPieceSpecial(
        s,
        { square: "e2", piece: "n" },
        { n: () => "armed" },
      ),
    ).toBe(false);
  });

  it("marks specialsUsed on armed and skips on free/pending/false", () => {
    const s = store();
    expect(
      armPieceSpecial(s, { square: "b1", piece: "n" }, { n: () => false }),
    ).toBe(false);
    expect(
      armPieceSpecial(s, { square: "b1", piece: "n" }, { n: () => "pending" }),
    ).toBe(true);
    expect(s.state().specialsUsed.has("b1")).toBe(false);
    expect(
      armPieceSpecial(s, { square: "b1", piece: "n" }, { n: () => "free" }),
    ).toBe(true);
    expect(
      armPieceSpecial(s, { square: "b1", piece: "n" }, { n: () => "armed" }),
    ).toBe(true);
    expect(s.state().specialsUsed.has("b1")).toBe(true);
    const s2 = store();
    expect(
      armPieceSpecial(s2, { square: "g1", piece: "n" }, { n: () => true }),
    ).toBe(true);
    expect(s2.state().specialsUsed.has("g1")).toBe(true);
    const s3 = store();
    expect(
      armPieceSpecial(s3, { square: "a2", piece: "n" }, { n: () => undefined }),
    ).toBe(true);
  });
});
