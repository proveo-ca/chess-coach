import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createPersistedStore,
  createSharedSettingsFieldStore,
} from "~/store/createPersistedStore";
import {
  playerName,
  setPlayerName,
  SETTINGS_STORAGE_KEY,
} from "~/store/settingsStore";
import {
  addMatchRecord,
  getMatchById,
  matchHistory,
  recordFromMatchState,
} from "~/store/matchHistoryStore";
import { createInitialMatchState } from "~/app/matchReducer";

describe("createPersistedStore + settings + history", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("loads merged state and persists updates", () => {
    localStorage.setItem("t-key", JSON.stringify({ a: 2 }));
    const [store, setStore] = createPersistedStore("t-key", { a: 1, b: 0 });
    expect(store.a).toBe(2);
    setStore("b", 9);
    expect(JSON.parse(localStorage.getItem("t-key")!).b).toBe(9);
  });

  it("handles corrupt load and save errors", () => {
    localStorage.setItem("bad", "{");
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const [store] = createPersistedStore("bad", { x: 1 });
    expect(store.x).toBe(1);
    expect(spy).toHaveBeenCalled();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    const [, setStore] = createPersistedStore("ok", { y: 1 });
    setStore("y", 2);
  });

  it("shared settings field store patches without wiping peers", () => {
    localStorage.setItem(
      "shared",
      JSON.stringify({ playerName: "Ada", theme: "dark" }),
    );
    const [store, setStore] = createSharedSettingsFieldStore("shared", {
      playerName: "x",
    });
    expect(store.playerName).toBe("Ada");
    setStore("playerName", "Bob");
    const raw = JSON.parse(localStorage.getItem("shared")!);
    expect(raw.playerName).toBe("Bob");
    expect(raw.theme).toBe("dark");
  });

  it("settingsStore playerName mutators", () => {
    setPlayerName("Tester");
    expect(playerName()).toBe("Tester");
    expect(SETTINGS_STORAGE_KEY).toContain("settings");
  });

  it("addMatchRecord / getMatchById", () => {
    const match = {
      ...createInitialMatchState(),
      outcome: { winner: "w" as const },
      playerColor: "w" as const,
    };
    const rec = recordFromMatchState(match, {
      id: "sc-cov",
      startedAt: "t",
      map: "eclipse",
    });
    expect(rec).not.toBeNull();
    addMatchRecord(rec!);
    expect(getMatchById("sc-cov")?.id).toBe("sc-cov");
    expect(matchHistory().some((g) => g.id === "sc-cov")).toBe(true);
    expect(recordFromMatchState(createInitialMatchState(), {
      id: "x",
      startedAt: "t",
      map: "eclipse",
    })).toBeNull();
  });
});
