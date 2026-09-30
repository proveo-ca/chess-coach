import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type EndScTurnResult, type ScAction } from "@chess-coach/starchess-core";
import { auditCorpus, extractWhiteWindows, loadPinnedCorpus, REPOSITORY_ROOT, type SourceGame } from "../challenge/corpus";
import { buildSchedule, sampleOne } from "../challenge/schedule";

const corpus = loadPinnedCorpus();
const manifestBytes = readFileSync(new URL("_spec/corpora/ml-adjutant-corpus.manifest.json", REPOSITORY_ROOT));
const bytes = readFileSync(new URL(corpus.manifest.sourcePath, REPOSITORY_ROOT));

describe("strict corpus extraction and scheduling", () => {
  it("audits all pinned18 and builds every54 case without replacement", () => {
    const schedule = buildSchedule(corpus);
    expect(corpus.traces).toHaveLength(18);
    expect(schedule).toHaveLength(54);
    expect(new Set(schedule.map((match) => match.key)).size).toBe(54);
    expect(schedule.slice(0, 18).map((match) => match.trace?.caseId)).toEqual(corpus.manifest.cases.map((entry) => entry.caseId));
    expect(schedule.slice(0, 18).every((match) => match.candidateSide === "b" && match.arenaSeed === 0)).toBe(true);
    for (const [offset, side] of [[18, "w"], [36, "b"]] as const) {
      expect(schedule.slice(offset, offset + 18).map((match) => match.arenaSeed)).toEqual(Array.from({ length: 18 }, (_, index) => index));
      expect(schedule.slice(offset, offset + 18).every((match) => match.candidateSide === side && match.inferenceSeed === 0 && !match.trace)).toBe(true);
    }
  });

  it("rejects source byte/count/ID/trace changes and manifest changes before execution", () => {
    const source = JSON.parse(bytes.toString("utf8"));
    const variations = [
      { ...source, games: source.games.slice(1) },
      { ...source, games: [source.games[0], source.games[0], ...source.games.slice(2)] },
      { ...source, games: source.games.map((game: SourceGame, index: number) => index === 0 ? { ...game, id: "replaced" } : game) },
    ];
    for (const variation of variations) expect(() => auditCorpus(manifestBytes, Buffer.from(JSON.stringify(variation)))).toThrow("source pin mismatch");
    expect(() => auditCorpus(Buffer.from(`${manifestBytes.toString("utf8")} `), bytes)).toThrow("manifest pin mismatch");
    expect(() => auditCorpus(manifestBytes, bytes.subarray(0, bytes.length - 1))).toThrow("source pin mismatch");
  });

  it("preserves action array order/timing/intent, empty queues, and planning ordinals across chips", () => {
    const opening = corpus.manifest.openingScfen;
    const action = { timing: "F", kind: "deploy", color: "w", from: "e1", to: "f1", unit: "p", seq: 90 } as ScAction;
    const other = { timing: "C", kind: "classical", color: "b", from: "e8", to: "f8", seq: 5 } as ScAction;
    const move = { timing: "C", kind: "classical", color: "w", from: "e1", to: "d1", seq: 3 } as ScAction;
    const resolve = (queue: ScAction[] | undefined, chip = false) => ({ queue, events: chip ? [{ id: "ev-begin-fixture" }] : [] }) as EndScTurnResult;
    const game = { scfens: [opening, opening, opening, opening, opening], resolves: [resolve(undefined, true), resolve([]), resolve([action, other, move]), resolve(undefined, true)] } as SourceGame;
    const windows = extractWhiteWindows(game);
    expect(windows.map(({ planningOrdinal, sourcePlyIndex }) => [planningOrdinal, sourcePlyIndex])).toEqual([[0, 1], [1, 2]]);
    expect(windows[0]!.actions).toEqual([]);
    expect(windows[1]!.actions).toEqual([
      { timing: "F", kind: "deploy", color: "w", from: "e1", to: "f1", unit: "p" },
      { timing: "C", kind: "classical", color: "w", from: "e1", to: "d1" },
    ]);
    expect(action.seq).toBe(90);
    expect(() => extractWhiteWindows({ ...game, resolves: [resolve(undefined), ...game.resolves.slice(1)] })).toThrow("missing planning queue");
    expect(() => extractWhiteWindows({ ...game, scfens: [opening] })).toThrow("cardinality");
  });

  it("samples deterministically through private manifest order without changing exhaustive coverage", () => {
    for (const seed of [0, 1, 2, 42, 999]) {
      expect(sampleOne(corpus, seed)).toEqual(sampleOne(corpus, seed));
      expect(corpus.traces.some((trace) => trace.caseId === sampleOne(corpus, seed).key)).toBe(true);
    }
    expect(buildSchedule(corpus)).toHaveLength(54);
  });
});
