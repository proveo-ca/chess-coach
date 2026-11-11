// SPEC: _spec/checkpoint-runtime.puml
import { expect, test } from "bun:test";
import { auditPinnedCorpus, CORPUS_MANIFEST_SHA256, RecordedCorpus } from "../src/corpus";

function fixture() {
  const openingScfen = "SCFEN|4k3/2pppp2/8/8/8/8/2PPPP2/4K3|0|33|P|G:11:11|B:3:3|Q:w:;b:";
  const traces = Array.from({ length: 18 }, (_, index) => ({ caseId: `white-trace-${String(index + 1).padStart(2, "0")}`, gameId: `synthetic-game-${index}`,
    historicalResult: "win", openingScfen, traceSha256: index.toString(16).padStart(64, "0"), windows: [
      { planningOrdinal: 0, sourcePlyIndex: 0, sourceTurn: 0, actions: [] }, { planningOrdinal: 1, sourcePlyIndex: 2, sourceTurn: 1, actions: [] }] }));
  return { manifestSha256: CORPUS_MANIFEST_SHA256, manifest: { openingScfen, expectedGames: 18,
    cases: traces.map((trace, sourceIndex) => ({ caseId: trace.caseId, gameId: trace.gameId, sourceIndex, traceSha256: trace.traceSha256, planningWindows: 2 })) }, traces };
}

test("synthetic trusted-audit adapter preserves empty queues and exact complete consumed prefixes", () => {
  const input = fixture(), corpus = new RecordedCorpus(input);
  input.traces[0]!.gameId = "mutated-caller";
  const first = corpus.window(0, 0)!, second = corpus.window(0, 1)!;
  expect(first.actions).toEqual([]);
  expect(second.sourcePlyIndex).toBe(2);
  expect(corpus.window(0, 2)).toBeNull();
  corpus.checkConsumedPrefix(0, [first, second]);
  expect(() => corpus.checkConsumedPrefix(0, [second])).toThrow("PREFIX_MISMATCH");
  expect(() => corpus.checkConsumedPrefix(0, [first, first])).toThrow("PREFIX_MISMATCH");
  expect(() => corpus.window(18, 0)).toThrow("CURSOR");
});

test("raw corpus bytes cannot nominate their own pins or invoke a fallback audit", async () => {
  let invoked = 0;
  await expect(auditPinnedCorpus(Buffer.from("{}"), Buffer.from("{}"), () => { invoked++; return fixture(); })).rejects.toThrow("INPUT_IDENTITY");
  expect(invoked).toBe(0);
});

test("missing, duplicate, reordered and tampered roster/window data fail before gameplay", () => {
  for (const kind of ["roster", "hash", "order", "side", "count"] as const) {
    const input = fixture();
    if (kind === "roster") input.traces[1]!.gameId = input.traces[0]!.gameId;
    else if (kind === "hash") input.traces[1]!.traceSha256 = input.traces[0]!.traceSha256;
    else if (kind === "order") input.traces[0]!.windows.reverse();
    else if (kind === "count") input.traces.pop();
    else Reflect.set(input.traces[0]!.windows[0]!, "actions", [{ kind: "classical", timing: "C", color: "b", from: "e7", to: "e6" }]);
    expect(() => new RecordedCorpus(input)).toThrow();
  }
});
