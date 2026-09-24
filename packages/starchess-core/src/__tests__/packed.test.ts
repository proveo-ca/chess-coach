import { describe, expect, it } from "vitest";

import {
  addScMove,
  endScTurn,
  formatScFen,
  historyFromRecord,
  packRecord,
  packResolves,
  parseScFen,
  resolvesOf,
  scsanOf,
  unpackRecord,
  unpackResolves,
  validateArenaRecord,
  type EndScTurnResult,
} from "../index";

/** Three settled plies of a real resolve chain — the shape live play records. */
const game = () => {
  let snap = parseScFen("SCFEN|4k3/2pppp2/8/8/8/8/2PPPP2/4K3|0|33|P|G:11:11|Q:w:;b:");
  const scfens = [formatScFen(snap)];
  const resolves: EndScTurnResult[] = [];
  const moves = [
    [{ color: "w", from: "d2", to: "d3" }, { color: "b", from: "e7", to: "e6" }],
    [{ color: "w", from: "e2", to: "e3" }, { color: "b", from: "d7", to: "d6" }],
    [{ color: "w", from: "c2", to: "c3" }],
  ] as const;
  for (const ply of moves) {
    for (const m of ply) snap = addScMove(snap, m);
    const r = endScTurn(snap, { skipTurnStartChecks: true });
    resolves.push(r);
    scfens.push(formatScFen(r.next));
    snap = r.next;
  }
  return { scfens, resolves };
};

const same = (a: unknown, b: unknown) => expect(JSON.parse(JSON.stringify(a))).toEqual(JSON.parse(JSON.stringify(b)));

describe("packed resolves", () => {
  it("round-trips exactly and drops only a rebuildable next", () => {
    const { scfens, resolves } = game();
    const packed = packResolves(scfens, resolves)!;
    expect(packed).toMatchObject({ codec: "deflate", v: 1, count: 3 });
    same(unpackResolves(scfens, packed), resolves);
    expect(packed.data.length).toBeLessThan(JSON.stringify(resolves).length / 3);
  });

  it("keeps a next the SCFEN cannot give back", () => {
    const { scfens, resolves } = game();
    const odd = resolves.map((r, i) =>
      i === 1 ? { ...r, next: { ...r.next, legacyOnly: true } } : r,
    ) as EndScTurnResult[];
    const back = unpackResolves(scfens, packResolves(scfens, odd)!);
    expect((back[1]!.next as unknown as { legacyOnly?: boolean }).legacyOnly).toBe(true);
    same(back, odd);
  });

  it("refuses to decode a corrupted payload", () => {
    const { scfens, resolves } = game();
    const packed = packResolves(scfens, resolves)!;
    expect(() => unpackResolves(scfens, { ...packed, data: packed.data.slice(0, 40) })).toThrow();
    expect(() => unpackResolves(scfens, { ...packed, count: 4 })).toThrow(/count/);
  });
});

describe("packed records", () => {
  it("stores packed resolves plus the per-ply intent line", () => {
    const { scfens, resolves } = game();
    const stored = packRecord({ id: "g", scfens, resolves });
    expect(stored.resolves).toBeUndefined();
    expect(stored.scsan).toEqual([
      "Q:w:C=d2d3;b:C=e7e6",
      "Q:w:C=e2e3;b:C=d7d6",
      "Q:w:C=c2c3;b:",
    ]);
    same(unpackRecord(stored).resolves, resolves);
    same(historyFromRecord(stored), historyFromRecord({ scfens, resolves }));
  });

  it("writes intents in today's kind names", () => {
    const { resolves } = game();
    const legacy = [
      { ...resolves[0]!, queue: [{ timing: "B", kind: "spawn", color: "w", from: "e1", to: "f1", unit: "n", seq: 0 }] },
      { ...resolves[1]!, queue: undefined },
    ] as unknown as EndScTurnResult[];
    expect(scsanOf(legacy)).toEqual(["Q:w:B=deploy:e1:f1:n;b:", null]);
  });

  it("leaves an already-packed record alone and reads either form", () => {
    const { scfens, resolves } = game();
    const stored = packRecord({ scfens, resolves });
    expect(packRecord(stored)).toBe(stored);
    same(resolvesOf(stored), resolves);
    expect(() => resolvesOf({ scfens })).toThrow();
  });

  it("imports a packed arena record as a plain one", () => {
    const { scfens, resolves } = game();
    const plain = {
      id: "arc-1",
      startedAt: "2026-09-24T00:00:00.000Z",
      endedAt: "2026-09-24T00:05:00.000Z",
      players: { w: "adjutant-naive", b: "adjutant-strategic" },
      mapSeed: scfens[0],
      outcome: { winner: "w", draw: false },
      turns: 3,
      scfens,
      resolves,
    };
    const v = validateArenaRecord(packRecord(plain));
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect("packed" in v.record).toBe(false);
      same(v.record.resolves, resolves);
    }
    const broken = { ...packRecord(plain), packed: { codec: "deflate", v: 1, count: 3, data: "!!" } };
    expect(validateArenaRecord(broken)).toMatchObject({ ok: false });
  });
});
