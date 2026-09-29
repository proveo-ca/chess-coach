import { afterEach, describe, expect, it, vi } from "vitest";
import type { AdjutantKind } from "~/types/newGame";

import { createInitialMatchState } from "~/app/matchReducer";
import {
  MATCH_SESSION_KEY,
  clearMatchSession,
  loadMatchSession,
  matchSessionFromState,
  saveMatchSession,
} from "~/store/matchSessionStore";

describe("matchSessionStore", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("round-trips session blob through localStorage", () => {
    const state = createInitialMatchState();
    const blob = matchSessionFromState(state, "eclipse", {
      id: "sc-1",
      startedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(blob.v).toBe(1);
    expect(blob.map).toBe("eclipse");
    expect(blob.scfen.startsWith("SCFEN|")).toBe(true);
    saveMatchSession(blob);
    expect(loadMatchSession()).toEqual(blob);
    clearMatchSession();
    expect(loadMatchSession()).toBeNull();
  });

  it("rejects corrupt / incomplete blobs", () => {
    localStorage.setItem(MATCH_SESSION_KEY, "{");
    expect(loadMatchSession()).toBeNull();
    localStorage.setItem(MATCH_SESSION_KEY, JSON.stringify({ v: 2, scfen: "x" }));
    expect(loadMatchSession()).toBeNull();
    localStorage.setItem(
      MATCH_SESSION_KEY,
      JSON.stringify({
        v: 1,
        scfen: "SCFEN|4k3/8/8/8/8/8/4P3/4K3|0|33|P|G:11:11|Q:w:;b:",
        playerColor: "x",
        id: "a",
        startedAt: "t",
      }),
    );
    expect(loadMatchSession()).toBeNull();
    localStorage.setItem(
      MATCH_SESSION_KEY,
      JSON.stringify({
        v: 1,
        scfen: "SCFEN|4k3/8/8/8/8/8/4P3/4K3|0|33|P|G:11:11|Q:w:;b:",
        playerColor: "w",
        id: 1,
        startedAt: "t",
      }),
    );
    expect(loadMatchSession()).toBeNull();
  });

  it("swallows localStorage failures", () => {
    const err = new Error("quota");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw err;
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    saveMatchSession(
      matchSessionFromState(createInitialMatchState(), "eclipse", {
        id: "x",
        startedAt: "t",
      }),
    );
    expect(spy).toHaveBeenCalled();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw err;
    });
    expect(loadMatchSession()).toBeNull();
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw err;
    });
    clearMatchSession();
  });
});

describe("the resume blob remembers the opponent script", () => {
  afterEach(() => localStorage.clear());

  const blobFor = (opponent?: AdjutantKind) =>
    matchSessionFromState(createInitialMatchState(), "eclipse", {
      id: "sc-1",
      startedAt: "2026-01-01T00:00:00.000Z",
      opponent,
    });

  it("round-trips the script", () => {
    saveMatchSession(blobFor("strategic"));
    expect(loadMatchSession()?.opponent).toBe("strategic");
  });

  it.each(["machine-learning", "rlhf", "rlcd"] as const)("preserves %s so admission can block a placeholder session", (opponent) => {
    saveMatchSession(blobFor(opponent));
    expect(loadMatchSession()?.opponent).toBe(opponent);
  });

  it("stays absent when none is supplied", () => {
    saveMatchSession(blobFor());
    expect(loadMatchSession()?.opponent).toBeUndefined();
  });

  it("still loads blobs written before the field existed", () => {
    // v stays 1 — the field is additive, so old sessions must survive a reload
    // rather than being discarded mid-match.
    const { opponent: _drop, ...legacy } = blobFor("strategic");
    localStorage.setItem(MATCH_SESSION_KEY, JSON.stringify(legacy));
    const loaded = loadMatchSession();
    expect(loaded).not.toBeNull();
    expect(loaded?.opponent).toBeUndefined();
    expect(loaded?.scfen.startsWith("SCFEN|")).toBe(true);
  });

  it("drops an unrecognised script instead of failing the whole resume", () => {
    const blob = { ...blobFor("naive"), opponent: "wildcard" };
    localStorage.setItem(MATCH_SESSION_KEY, JSON.stringify(blob));
    const loaded = loadMatchSession();
    expect(loaded).not.toBeNull();
    expect(loaded?.opponent).toBeUndefined();
  });
});
