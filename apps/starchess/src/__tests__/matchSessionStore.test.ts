import { afterEach, describe, expect, it, vi } from "vitest";

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
