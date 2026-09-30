import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { historyFromRecord, parseScFen, scOutcome, scsanOf } from "@chess-coach/starchess-core";
import type { EndScTurnResult, ScAction } from "@chess-coach/starchess-core";

const root = new URL("../../../../", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("_spec/corpora/ml-adjutant-corpus.manifest.json", root), "utf8"));
const bytes = readFileSync(new URL(manifest.sourcePath, root));
const source = JSON.parse(bytes.toString("utf8"));

type SourceGame = {
  id: string;
  playerColor: "w";
  opponent: string;
  result: "win" | "draw";
  scfens: string[];
  resolves: EndScTurnResult[];
  scsan: string[];
};

const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const isChip = (resolve: EndScTurnResult) => resolve.events.some((event) => event.id.startsWith("ev-begin-"));
const whiteTrace = (game: SourceGame) => game.resolves.flatMap((resolve, index) =>
  isChip(resolve) ? [] : [{
    sourceTurn: parseScFen(game.scfens[index]!).turn,
    actions: resolve.queue!.filter((action) => action.color === "w").map(({ seq: _seq, ...action }) => action),
  }],
);

describe("pinned ML challenge corpus provenance", () => {
  it("pins the source bytes and all 18 White-player cases without filtering", () => {
    expect(manifest.version).toBe(1);
    expect(source.version).toBe(manifest.sourceVersion);
    expect(source.exportedAt).toBe(manifest.exportedAt);
    expect(bytes.length).toBe(manifest.sourceBytes);
    expect(hash(bytes)).toBe(manifest.sourceSha256);
    expect(source.games).toHaveLength(manifest.expectedGames);
    expect(manifest.expectedGames).toBe(18);
    expect(manifest.cases).toHaveLength(18);
    expect(new Set(manifest.cases.map((entry: { caseId: string }) => entry.caseId)).size).toBe(18);
    expect(new Set(manifest.cases.map((entry: { gameId: string }) => entry.gameId)).size).toBe(18);
    expect(manifest.traceSide).toBe("w");
    expect(manifest.candidateSide).toBe("b");
    expect(manifest.policy).toBe("strict-recorded-queues");
  });

  it("reproduces White intent hashes, planning/chip counts, and historical terminal labels", () => {
    let snapshots = 0;
    let chips = 0;
    let windows = 0;
    let actions = 0;
    const kinds: Record<string, number> = {};
    const traces = new Set<string>();
    for (const [index, game] of (source.games as SourceGame[]).entries()) {
      const entry = manifest.cases[index];
      expect(entry.sourceIndex).toBe(index);
      expect(entry.gameId).toBe(game.id);
      expect(game.playerColor).toBe("w");
      expect(game.opponent).toBe("strategic");
      expect(game.scfens[0]).toBe(manifest.openingScfen);
      expect(game.scfens).toHaveLength(game.resolves.length + 1);
      const history = historyFromRecord(game);
      expect(history.settledResolves).toHaveLength(history.settledSnapshots.length - 1);
      expect(scsanOf(history.settledResolves)).toEqual(game.scsan);
      snapshots += game.scfens.map((scfen) => parseScFen(scfen)).length;
      const terminal = history.settledSnapshots.at(-1)!;
      expect(terminal.turn).toBe(entry.terminalTurn);
      expect(entry.historicalResult).toBe(game.result);
      expect(scOutcome(terminal)).toEqual(game.result === "win" ? { winner: "w", draw: false } : { winner: null, draw: true });
      const chipCount = game.resolves.filter(isChip).length;
      const trace = whiteTrace(game);
      const digest = hash(JSON.stringify({ openingScfen: game.scfens[0], trace }));
      expect(digest).toBe(entry.traceSha256);
      traces.add(digest);
      const whiteActions = trace.flatMap((window) => window.actions);
      expect(game.resolves.length).toBe(entry.settledPlies);
      expect(chipCount).toBe(entry.chipPlies);
      expect(trace.length).toBe(entry.planningWindows);
      expect(whiteActions.length).toBe(entry.whiteActions);
      chips += chipCount;
      windows += trace.length;
      actions += whiteActions.length;
      for (const action of whiteActions as Omit<ScAction, "seq">[]) {
        kinds[action.kind] = (kinds[action.kind] ?? 0) + 1;
      }
    }
    expect(snapshots).toBe(manifest.audit.snapshotsParsed);
    expect(chips).toBe(manifest.audit.chipPlies);
    expect(windows).toBe(manifest.audit.planningWindows);
    expect(chips + windows).toBe(manifest.audit.settledPlies);
    expect(actions).toBe(manifest.audit.whiteActions);
    expect(kinds).toEqual(manifest.audit.actionKinds);
    expect(traces.size).toBe(manifest.audit.uniqueWhiteTraces);
  });

  it("keeps the live strategic schedule separate and paired across both colours", () => {
    expect(manifest.strategicSchedule.arenaSeeds).toEqual(Array.from({ length: 18 }, (_, index) => index));
    expect(manifest.strategicSchedule.candidateSides).toEqual(["w", "b"]);
    expect(manifest.strategicSchedule.expectedMatches).toBe(36);
    expect(manifest.strategicSchedule.feed).toBe("off");
    expect(manifest.strategicSchedule.inferenceSeed).toBe(0);
    expect(manifest.audit.currentRuleReexecution).toBe("pending");
    expect(manifest.audit.candidateWinrate).toBe("not measured");
  });
});
