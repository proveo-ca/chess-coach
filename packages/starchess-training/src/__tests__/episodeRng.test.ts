// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import jsSHA from "jssha/sha256";
import { mulberry32 } from "@chess-coach/starchess-core";
import { describe, expect, it, vi } from "vitest";
import * as rng from "../coordinator/episodeRng";
import type { ActiveStreamState } from "../coordinator/episodeContracts";
import type { EpisodeStreamLabel, Master } from "../coordinator/episodeContracts";
import { constructFloat64Hex } from "../economic/ownedKernel";

const labels = ["selection", "environment-settlement", "policy-sampling", "opponent"] as const;
const hostile = (target: object = {}) => {
  const trap = vi.fn(() => { throw new Error("trap"); });
  return { value: new Proxy(target, { get: trap, ownKeys: trap, getPrototypeOf: trap, getOwnPropertyDescriptor: trap }), trap };
};
const independentRoot = (master: Master, label: EpisodeStreamLabel): number => createHash("sha256")
  .update(JSON.stringify(["starchess-training-rng-v1", master, label]), "utf8").digest().readUInt32BE(0);

describe("episode-v2 private persistent RNG", () => {
  it("computes the exact 20 SHA UTF8 JSON roots without a fifth generator", () => {
    const rows = rng.computeEpisodeRootTable();
    expect(rows).toHaveLength(20);
    expect(new Set(rows.map(row => row.root)).size).toBe(20);
    expect(rows.map(row => [row.master, row.label])).toEqual([101, 102, 103, 104, 105].flatMap(master => labels.map(label => [master, label])));
    for (const row of rows) expect(row.root).toBe(independentRoot(row.master, row.label));
    expect(Object.isFrozen(rows)).toBe(true);
    rows.forEach(row => expect(Object.isFrozen(row)).toBe(true));
  });

  it("rejects collisions across all masters and labels without rederiving", () => {
    const hash = vi.spyOn(jsSHA.prototype, "getHash").mockReturnValue(new Uint8Array(32) as never);
    try {
      expect(() => rng.computeEpisodeRootTable()).toThrow("COLLISION");
      expect(hash).toHaveBeenCalledTimes(2);
    } finally { hash.mockRestore(); }
  });

  it.each([0, 1, 4294967295, ...labels.map(label => independentRoot(101, label))])("matches 1024 native mulberry32 draws from root %s", root => {
    const native = mulberry32(root), cursor = rng.restoreEpisodeRng(rng.constructActiveStreamState(root, root, 0));
    for (let index = 0; index < 1024; index++) expect(rng.drawEpisodeRng(cursor)).toBe(native());
    const state = rng.snapshotEpisodeRng(cursor);
    expect(state.drawCount).toBe(1024);
    expect(state.state).toBe((root + Math.imul(0x6d2b79f5, 1024)) >>> 0);
    expect(state.root).toBe(root);
  });

  it("restores at the next draw and keeps snapshots detached across attempts", () => {
    const root = independentRoot(103, "policy-sampling");
    const first = rng.restoreEpisodeRng(rng.constructActiveStreamState(root, root, 0));
    for (let draw = 0; draw < 137; draw++) rng.drawEpisodeRng(first);
    const before = rng.snapshotEpisodeRng(first), resumed = rng.restoreEpisodeRng(before);
    for (let draw = 0; draw < 100; draw++) expect(rng.drawEpisodeRng(resumed)).toBe(rng.drawEpisodeRng(first));
    expect(rng.snapshotEpisodeRng(resumed)).toEqual(rng.snapshotEpisodeRng(first));
    expect(before.drawCount).toBe(137);
    expect(Object.isFrozen(before)).toBe(true);
    expect(rng.snapshotEpisodeRng(first).drawCount).toBe(237);
  });

  it("uses captured imul and never calls environment or default randomness", () => {
    const expected = mulberry32(17)();
    const cursor = rng.restoreEpisodeRng(rng.constructActiveStreamState(17, 17, 0));
    const imul = vi.spyOn(Math, "imul").mockImplementation(() => { throw new Error("replacement imul"); });
    const random = vi.spyOn(Math, "random").mockImplementation(() => { throw new Error("random"); });
    try {
      expect(rng.drawEpisodeRng(cursor)).toBe(expected);
      expect(imul).not.toHaveBeenCalled();
      expect(random).not.toHaveBeenCalled();
      expect(() => rng.restoreEpisodeRng(rng.constructUnusedEnvironmentState(17) as unknown as ActiveStreamState)).toThrow("PROVENANCE");
    } finally { imul.mockRestore(); random.mockRestore(); }
  });

  it("rejects unsafe counters before advancing and checks max-safe state without multiplication rounding", () => {
    const root = independentRoot(105, "opponent"), count = Number.MAX_SAFE_INTEGER;
    const exactState = Number((BigInt(root) + 0x6d2b79f5n * BigInt(count)) & 0xffffffffn);
    const full = rng.constructActiveStreamState(root, exactState, count);
    expect(() => rng.checkPersistentEpisodeStream(full, root)).not.toThrow();
    const cursor = rng.restoreEpisodeRng(full), before = rng.snapshotEpisodeRng(cursor);
    expect(() => rng.drawEpisodeRng(cursor)).toThrow("COUNTER");
    expect(rng.snapshotEpisodeRng(cursor)).toEqual(before);
    for (const bad of [-0, -1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => rng.constructActiveStreamState(0, 0, bad)).toThrow("INTEGER");
    }
    for (const bad of [-0, -1, 4294967296, NaN, Infinity, 1.1]) {
      expect(() => rng.constructActiveStreamState(bad, 0, 0)).toThrow("INTEGER");
      expect(() => rng.constructActiveStreamState(0, bad, 0)).toThrow("INTEGER");
      expect(() => rng.constructUnusedEnvironmentState(bad)).toThrow("INTEGER");
    }
    const near = rng.restoreEpisodeRng(rng.constructActiveStreamState(root,
      Number((BigInt(root) + 0x6d2b79f5n * BigInt(count - 1)) & 0xffffffffn), count - 1));
    rng.drawEpisodeRng(near);
    expect(rng.snapshotEpisodeRng(near)).toEqual(full);
    expect(() => rng.drawEpisodeRng(near)).toThrow("COUNTER");
  });

  it("reconstructs persistent manifest-order descending Fisher-Yates and makes no live-seat draw", () => {
    const native = mulberry32(independentRoot(102, "selection"));
    for (let epoch = 0; epoch < 28; epoch++) {
      const permutation = Array.from({ length: 18 }, (_, index) => index);
      for (let index = 17; index > 0; index--) {
        const j = Math.floor(native() * (index + 1));
        [permutation[index], permutation[j]] = [permutation[j]!, permutation[index]!];
      }
      const ordinal = 36 * epoch;
      const even = rng.reconstructStartedSelection(102, ordinal), odd = rng.reconstructStartedSelection(102, ordinal + 1);
      expect(even.permutation).toEqual(permutation);
      expect(odd).toEqual(even);
      expect(even.selection.drawCount).toBe(17 * (epoch + 1));
      expect(Object.isFrozen(even.permutation)).toBe(true);
      expect(new Set(even.permutation).size).toBe(18);
    }
    expect(rng.reconstructStartedSelection(102, 999).selection.drawCount).toBe(476);
  });

  it("rejects raw graphs, proxies, getters, foreign roles and cloned receipts with zero inspection", async () => {
    const active = rng.constructActiveStreamState(7, 7, 0), unused = rng.constructUnusedEnvironmentState(7);
    const cursor = rng.restoreEpisodeRng(active), proxy = hostile(active), raw = hostile();
    const getter = vi.fn(() => { throw new Error("getter"); });
    const wide = Object.defineProperty(Object.fromEntries(Array.from({ length: 10000 }, (_, i) => [`key${i}`, i])), "root", { get: getter });
    const values = [null, undefined, {}, Object.freeze({ ...active }), structuredClone(active), proxy.value, raw.value, wide,
      constructFloat64Hex("0000000000000000"), cursor];
    for (const value of values) {
      expect(() => rng.requireActiveStreamState(value)).toThrow("PROVENANCE");
      expect(() => rng.requireUnusedEnvironmentState(value)).toThrow("PROVENANCE");
      expect(() => rng.requireEpisodeStartStreams(value)).toThrow("PROVENANCE");
      expect(() => rng.requireStartedSelection(value)).toThrow("PROVENANCE");
      expect(() => rng.restoreEpisodeRng(value as ActiveStreamState)).toThrow("PROVENANCE");
    }
    for (const value of [active, unused, ...values.filter(value => value !== cursor)]) {
      expect(() => rng.drawEpisodeRng(value as rng.EpisodeRng)).toThrow("PROVENANCE");
      expect(() => rng.snapshotEpisodeRng(value as rng.EpisodeRng)).toThrow("PROVENANCE");
    }
    expect(() => rng.equalEpisodeStreamStates(active, proxy.value as ActiveStreamState)).toThrow("PROVENANCE");
    expect(() => rng.checkPersistentEpisodeStream(proxy.value as ActiveStreamState, 7)).toThrow("PROVENANCE");
    for (const value of [proxy.value, raw.value]) {
      expect(() => rng.deriveEpisodeRoot(value as unknown as Master, "selection")).toThrow("MASTER");
      expect(() => rng.deriveEpisodeRoot(101, value as unknown as EpisodeStreamLabel)).toThrow("LABEL");
      expect(() => rng.requireEpisodeInteger(1, value as unknown as number, 2)).toThrow("INTEGER");
    }
    const modulePath = "../coordinator/episodeRng?foreign-host-rng";
    const foreign: typeof rng = await import(modulePath);
    expect(() => rng.requireActiveStreamState(foreign.constructActiveStreamState(7, 7, 0))).toThrow("PROVENANCE");
    expect(getter).not.toHaveBeenCalled();
    expect(proxy.trap).not.toHaveBeenCalled();
    expect(raw.trap).not.toHaveBeenCalled();
  });

  it("owns exactly the four start streams and distinguishes active zero-count from unused", () => {
    const active = rng.constructActiveStreamState(0, 0, 0), unused = rng.constructUnusedEnvironmentState(0);
    const streams = rng.constructEpisodeStartStreams(active, unused, active, active);
    expect(Object.keys(streams).sort()).toEqual([...labels].sort());
    expect(streams.selection.status).toBe("active");
    expect(streams["environment-settlement"]).toEqual({ status: "unused", root: 0, state: 0, drawCount: 0 });
    expect(Object.isFrozen(streams)).toBe(true);
    expect(() => rng.constructEpisodeStartStreams(unused as unknown as ActiveStreamState, unused, active, active)).toThrow("PROVENANCE");
    expect(() => rng.constructEpisodeStartStreams(active, active as unknown as typeof unused, active, active)).toThrow("PROVENANCE");
    expect(rng.equalEpisodeStreamStates(active, unused)).toBe(false);
  });

  it("keeps the unit private and introduces no arena RNG, imports or training execution", () => {
    const source = readFileSync(new URL("../coordinator/episodeRng.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/node:|starchess-arena|Math\.random|DEFAULT_RNG|arenaRng|JSON\.(parse|stringify)|Reflect/);
  });
});
