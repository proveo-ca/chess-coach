// SPEC: _spec/apps/server/starchess-arena-feed.puml
import { expect, test } from "bun:test";

import { ArenaRecordStore } from "../arena/ArenaRecordStore.ts";
import type { ArenaGameRecord } from "@chess-coach/starchess-arena";

const record = (id: string): ArenaGameRecord =>
  ({
    id,
    startedAt: "2026-01-01T00:00:00.000Z",
    endedAt: "2026-01-01T00:00:01.000Z",
    players: { w: "a", b: "b" },
    mapSeed: "SCFEN|4k3/8/8/8/8/8/8/4K3|5|33|P|G:11:11|Q:w:;b:",
    outcome: { winner: "w", draw: false },
    turns: 1,
    scfens: ["S1", "S2"],
    resolves: [],
    meta: { engine: null, status: "finished" },
  }) as unknown as ArenaGameRecord;

test("store returns all inserted records in insertion order", () => {
  const store = new ArenaRecordStore(10);
  store.put(record("a"));
  store.put(record("b"));
  expect(store.all().map((r) => r.id)).toEqual(["a", "b"]);
  expect(store.get("a")?.id).toBe("a");
  expect(store.size).toBe(2);
});

test("store evicts the oldest beyond the cap", () => {
  const store = new ArenaRecordStore(2);
  store.put(record("a"));
  store.put(record("b"));
  store.put(record("c"));
  expect(store.all().map((r) => r.id)).toEqual(["b", "c"]);
  expect(store.get("a")).toBeUndefined();
  expect(store.size).toBe(2);
});

test("re-putting an existing id does not reorder (keeps original slot)", () => {
  const store = new ArenaRecordStore(10);
  store.put(record("a"));
  store.put(record("b"));
  store.put(record("a"));
  expect(store.all().map((r) => r.id)).toEqual(["a", "b"]);
  expect(store.size).toBe(2);
});
