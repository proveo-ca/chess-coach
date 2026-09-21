import { describe, expect, it } from "vitest";

import {
  HISTORY_EXPORT_VERSION,
  buildHistoryExport,
  extractExportedGames,
  historyExportFilename,
  parseHistoryExportText,
  serializeHistoryExport,
} from "~/app/historyExport";
import type { StarChessGameRecord } from "~/types/review";

const SCFEN_A =
  "SCFEN|4k3/2pppp2/8/8/8/8/2PPPP2/4K3|0|33|P|G:11:11|B:3:3|Q:w:;b:";
const SCFEN_B =
  "SCFEN|4k3/2pppp2/8/8/8/8/2PPP2/4K3|1|33|P|G:11:11|B:3:3|Q:w:;b:";

const record = (id: string): StarChessGameRecord => ({
  id,
  startedAt: "2026-01-01T00:00:00.000Z",
  endedAt: "2026-01-01T00:10:00.000Z",
  result: "win",
  map: "eclipse",
  playerColor: "w",
  playerName: "Tester",
  opponent: "strategic",
  scfens: [SCFEN_A, SCFEN_B],
  resolves: [{ resolved: null, next: null } as unknown as StarChessGameRecord["resolves"][number]],
});

describe("historyExport", () => {
  it("builds a versioned copy preserving outcome fields", () => {
    const source = [record("sc-1"), record("sc-2")];
    const envelope = buildHistoryExport(source, "2026-09-21T00:00:00.000Z");
    expect(envelope.version).toBe(HISTORY_EXPORT_VERSION);
    expect(envelope.exportedAt).toBe("2026-09-21T00:00:00.000Z");
    expect(envelope.games).toHaveLength(2);
    expect(envelope.games[0]!.result).toBe("win");
    expect(envelope.games[0]!.opponent).toBe("strategic");
    expect(envelope.games[0]!.scfens).toEqual(source[0]!.scfens);
    expect(envelope.games[0]!.resolves).toEqual(source[0]!.resolves);
    expect(envelope.games[0]).not.toBe(source[0]);
  });

  it("round-trips envelope text through the importer shape", () => {
    const envelope = buildHistoryExport([record("sc-1")]);
    const parsed = parseHistoryExportText(serializeHistoryExport(envelope));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.games).toHaveLength(1);
      expect(parsed.games[0]!.id).toBe("sc-1");
    }
  });

  it("accepts bare array and single record copies", () => {
    expect(extractExportedGames([record("a"), record("b")])).toHaveLength(2);
    expect(extractExportedGames(record("solo"))).toHaveLength(1);
    expect(extractExportedGames({ version: 1, games: [record("e")] })).toHaveLength(1);
  });

  it("rejects malformed copies", () => {
    expect(parseHistoryExportText("not json {").ok).toBe(false);
    expect(parseHistoryExportText(JSON.stringify({ version: 1, games: [] })).ok).toBe(false);
    expect(
      parseHistoryExportText(JSON.stringify({ id: "x", result: "win" })).ok,
    ).toBe(false);
    expect(extractExportedGames([{ id: "bad" }])).toBeNull();
  });

  it("names the download file with a timestamp", () => {
    const name = historyExportFilename(new Date("2026-09-21T12:34:56.000Z"));
    expect(name.startsWith("starchess-match-history-20260921-")).toBe(true);
    expect(name.endsWith(".json")).toBe(true);
  });
});
