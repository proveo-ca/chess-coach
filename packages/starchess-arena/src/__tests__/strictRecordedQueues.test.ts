// SPEC: _spec/packages/starchess-arena/ml-adjutant-challenge-harness.puml
import { describe, expect, it, vi } from "vitest";
import {
  addScAction, endScTurn, formatScFen, parseScFen, placementToMap,
  type ScActionInput, type ScFenSnapshot,
} from "@chess-coach/starchess-core";
import { commitPair, stageQueue } from "../challenge/admission";
import { extractWhiteWindows, loadPinnedCorpus } from "../challenge/corpus";
import { runChallengeMatch } from "../challenge/runChallengeMatch";
import type { CandidatePolicy, ScheduledMatch } from "../challenge/types";

const corpus = loadPinnedCorpus();
const opening = corpus.manifest.openingScfen;
const pass = (): CandidatePolicy => ({ name: "integrity-pass", choose: vi.fn(() => []) });
const request = (actions: ScActionInput[][], customOpening = opening): ScheduledMatch => ({
  key: "strict-integrity", suite: "corpus", candidateSide: "b", arenaSeed: 0, inferenceSeed: 0,
  opening: customOpening,
  trace: {
    ...structuredClone(corpus.traces[0]!), openingScfen: customOpening,
    windows: actions.map((queue, planningOrdinal) => ({
      planningOrdinal, sourcePlyIndex: 40 + planningOrdinal, sourceTurn: planningOrdinal, actions: queue,
    })),
  },
});
const stageOpening = () => parseScFen("SCFEN|4k3/8/8/8/1N1R4/8/P7/4K3|21|33|P|G:33:33|B:3:3|Q:w:;b:");
const prefix: ScActionInput[] = [
  { kind: "deploy", timing: "B", color: "w", from: "e1", to: "d1", unit: "p" },
  { kind: "classical", timing: "C", color: "w", from: "a2", to: "a3" },
];
const missing: ScActionInput = { kind: "siegeMode", timing: "F", color: "w", from: "h4" };
const admitted = (snapshot: ScFenSnapshot, side: "w" | "b", actions: ScActionInput[]) => {
  const result = stageQueue(snapshot, { w: 3, b: 3 }, side, actions, 0);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(JSON.stringify(result.failure));
  return result.staged;
};

describe("strict whole-queue admission", () => {
  it.each([0, 1, 2])("rolls back a rejection at action %i", (actionIndex) => {
    const open = stageOpening();
    const bank = { w: 3, b: 3 };
    const actions = [...prefix];
    actions.splice(actionIndex, 0, missing);
    const before = structuredClone({ open, bank, actions });
    expect(stageQueue(open, bank, "w", actions, 7)).toMatchObject({
      ok: false, failure: {
        kind: "queue-rejected", phase: "admission", planningOrdinal: 7, turn: 21,
        side: "w", actionIndex, action: missing, engineCode: "SC_SPECIAL", reason: "no actor on h4",
      },
    });
    expect({ open, bank, actions }).toEqual(before);
    expect(stageQueue(open, bank, "w", prefix, 7)).toMatchObject({
      ok: true, staged: { gasAfter: 2, spend: 1, intents: prefix },
    });
  });

  it.each([
    ["wrong side", { ...prefix[0], color: "b" }],
    ["source sequence", { ...prefix[0], seq: 91 }],
    ["malformed square", { ...prefix[0], to: "i9" }],
    ["wrong timing", { ...prefix[1], timing: "B" }],
    ["unknown kind", { ...prefix[0], kind: "teleport" }],
    ["missing deploy unit", { kind: "deploy", timing: "B", color: "w", from: "e1", to: "d1" }],
    ["invalid unit", { ...prefix[0], unit: "k" }],
    ["invalid promotion", { ...prefix[1], promotion: "k" }],
    ["null action", null],
  ])("rejects %s before core settlement", (_label, action) => {
    const open = stageOpening();
    const before = structuredClone(open);
    expect(stageQueue(open, { w: 3, b: 3 }, "w", [action] as ScActionInput[], 0)).toMatchObject({
      ok: false, failure: { kind: "queue-rejected", actionIndex: 0, reason: "invalid-intent" },
    });
    expect(open).toEqual(before);
  });

  it("rejects a non-array selected queue", () => {
    expect(stageQueue(stageOpening(), { w: 3, b: 3 }, "w", {} as ScActionInput[], 0)).toMatchObject({
      ok: false, failure: { kind: "queue-rejected", reason: "invalid-intent-array" },
    });
  });

  it.each([
    ["gas shortfall", "", { ...prefix[0] }, "SC_GAS", /needs 1 gas but has 0/],
    ["existing mine", "|M:w:b4", { kind: "spiderMine", timing: "B", color: "w", from: "b4", to: "b4" }, "SC_SPECIAL", /mine already/],
    ["mine cap", "|M:w:a3c3e3", { kind: "spiderMine", timing: "B", color: "w", from: "b4", to: "b4" }, "SC_SPECIAL", /mine cap 3/],
    ["wrong mine actor", "", { kind: "spiderMine", timing: "B", color: "w", from: "a2", to: "a2" }, "SC_SPECIAL", /mine requires Hoverbike/],
    ["invalid stim step", "", { kind: "stimStep", timing: "B", color: "w", from: "a2", to: "a4" }, "SC_SPECIAL", /stimStep must step/],
    ["nonadjacent deploy", "", { ...prefix[0], to: "h8" }, "SC_SPECIAL", /spawn not adjacent/],
  ] as const)("uses core rejection for %s", (label, extras, action, engineCode, reason) => {
    const open = parseScFen(`SCFEN|4k3/8/8/8/1N1R4/8/P7/4K3|21|33|P|G:33:33|B:3:3|Q:w:;b:${extras}`);
    if (label === "gas shortfall") open.gas.w = 0;
    const before = structuredClone(open);
    expect(stageQueue(open, { w: 3, b: 3 }, "w", [action], 3)).toMatchObject({
      ok: false, failure: { engineCode, reason: expect.stringMatching(reason), actionIndex: 0 },
    });
    expect(open).toEqual(before);
  });

  it("rolls back an earlier gas debit when a later special exceeds gas", () => {
    const open = stageOpening();
    open.gas.w = 1;
    const actions: ScActionInput[] = [
      { kind: "spiderMine", timing: "B", color: "w", from: "b4", to: "b4" },
      { kind: "siegeMode", timing: "F", color: "w", from: "d4" },
    ];
    const before = structuredClone(open);
    expect(stageQueue(open, { w: 3, b: 3 }, "w", actions, 0)).toMatchObject({
      ok: false, failure: { actionIndex: 1, engineCode: "SC_GAS" },
    });
    expect(open).toEqual(before);
  });

  it("rejects a stim step into an occupied square without spending gas", () => {
    const open = parseScFen("SCFEN|4k3/8/8/8/8/p7/P7/4K3|0|33|P|G:11:11|B:3:3|Q:w:;b:");
    const before = structuredClone(open);
    expect(stageQueue(open, { w: 3, b: 3 }, "w", [
      { kind: "stimStep", timing: "B", color: "w", from: "a2", to: "a3" },
    ], 0)).toMatchObject({ ok: false, failure: { engineCode: "SC_SPECIAL", reason: "stimStep blocked", actionIndex: 0 } });
    expect(open).toEqual(before);
  });

  it("rejects duplicate classical and same-actor special queues atomically", () => {
    const open = stageOpening();
    const before = structuredClone(open);
    for (const actions of [
      [prefix[1]!, { ...prefix[1]!, from: "b4", to: "c6" }],
      [prefix[0]!, { ...prefix[0]!, timing: "F", to: "f1" }],
    ] as ScActionInput[][]) {
      expect(stageQueue(open, { w: 3, b: 3 }, "w", actions, 0)).toMatchObject({
        ok: false, failure: { actionIndex: 1, engineCode: "SC_QUEUE_SHAPE" },
      });
      expect(open).toEqual(before);
    }
  });
});

describe("strict recorded and selected queues", () => {
  it.each([0, 1, 2])("publishes no recorded prefix when action %i fails", async (actionIndex) => {
    const actions = [...prefix];
    actions.splice(actionIndex, 0, missing);
    const candidate = pass();
    const match = request([actions], "SCFEN|4k3/8/8/8/1N1R4/8/P7/4K3|21|33|P|G:33:33|B:3:3|Q:w:;b:");
    const before = structuredClone(match);
    const evidence = await runChallengeMatch(match, { candidate });
    expect(evidence.stop).toMatchObject({ kind: "queue-rejected", side: "w", actionIndex, sourcePlyIndex: 40 });
    expect(evidence.resolves).toEqual([]);
    expect(evidence.scfens).toHaveLength(1);
    expect(evidence.bankTrail).toEqual([]);
    expect(evidence.finalBank).toEqual({ w: 3, b: 3 });
    expect(evidence.outcome).toBeNull();
    expect(candidate.choose).toHaveBeenCalledTimes(1);
    expect(match).toEqual(before);
  });

  it.each([0, 1, 2])("rejects candidate action %i once without publishing either side's prefix or debit", async (actionIndex) => {
    const white: ScActionInput[] = [
      { kind: "deploy", timing: "B", color: "w", from: "e1", to: "d1", unit: "n" },
      { kind: "classical", timing: "C", color: "w", from: "c2", to: "c3" },
    ];
    const actions: ScActionInput[] = [
      { kind: "deploy", timing: "B", color: "b", from: "e8", to: "d8", unit: "p" },
      { kind: "classical", timing: "C", color: "b", from: "c7", to: "c6" },
    ];
    actions.splice(actionIndex, 0, { kind: "siegeMode", timing: "F", color: "b", from: "h4" });
    const candidate: CandidatePolicy = {
      name: "selected-rejection", choose: vi.fn<CandidatePolicy["choose"]>().mockReturnValueOnce(actions).mockReturnValue([]),
    };
    const strategic = { name: "forbidden-rescue", play: vi.fn(() => { throw new Error("rescue"); }) };
    const onProgress = vi.fn();
    const evidence = await runChallengeMatch(request([white]), { candidate, strategic, onProgress });
    expect(evidence.stop).toMatchObject({ kind: "queue-rejected", side: "b", actionIndex, engineCode: "SC_SPECIAL", reason: "no actor on h4" });
    expect(candidate.choose).toHaveBeenCalledTimes(1);
    expect(strategic.play).not.toHaveBeenCalled();
    expect(onProgress.mock.calls.map(([event]) => event.kind)).not.toContain("ply");
    expect(evidence.resolves).toEqual([]);
    expect(evidence.scfens).toHaveLength(1);
    expect(evidence.bankTrail).toEqual([]);
    expect(evidence.finalBank).toEqual({ w: 3, b: 3 });
    expect(evidence).toMatchObject({ outcome: null, fallbackCount: 0, modelArtifact: null, learnedGateEligible: false });
  });

  it.each(["B-C", "C-F"] as const)("preserves %s intent order with fresh White-then-Black sequences", async (order) => {
    const move: ScActionInput = { kind: "classical", timing: "C", color: "w", from: "c2", to: "c4" };
    const special: ScActionInput = { kind: "stimStep", timing: order === "B-C" ? "B" : "F", color: "w", from: "c2", to: "c3" };
    const actions = order === "B-C" ? [special, move] : [move, special];
    const black: ScActionInput[] = [
      { kind: "classical", timing: "C", color: "b", from: "c7", to: "c6" },
      { kind: "stimStep", timing: "F", color: "b", from: "c7", to: "c6" },
    ];
    const candidate: CandidatePolicy = { name: "ordered", choose: vi.fn(() => black) };
    const evidence = await runChallengeMatch(request([actions]), {
      candidate, limits: { maxWindows: 1, maxRecordedPlies: 4 },
    });
    expect(evidence.stop.kind).toBe("progress-limit");
    expect(evidence.resolves[0]!.queue).toEqual([...actions, ...black].map((action, seq) => ({ ...action, seq })));
    expect(evidence.resolves[0]!.next.gasIncome).toEqual({ w: 1, b: 1 });
    expect(evidence.finalBank).toEqual({ w: 4, b: 4 });
  });

  it("replaces historical sequences extracted from a real core resolve", async () => {
    const actions: ScActionInput[] = [
      { kind: "stimStep", timing: "B", color: "w", from: "c2", to: "c3" },
      { kind: "classical", timing: "C", color: "w", from: "c2", to: "c4" },
    ];
    let snapshot = parseScFen(opening);
    for (const action of actions) snapshot = addScAction({ snapshot, action }).snapshot;
    const resolve = endScTurn(snapshot, { skipTurnStartChecks: true });
    const historical = { ...resolve, queue: resolve.queue.map((action, index) => ({ ...action, seq: 80 + index })) };
    const windows = extractWhiteWindows({
      id: "sequence-fixture", playerColor: "w", opponent: "strategic", result: "draw",
      scfens: [opening, formatScFen(resolve.next)], resolves: [historical], scsan: [],
    });
    expect(windows[0]!.actions).toEqual(actions);
    const match = request([]);
    match.trace!.windows = windows;
    const evidence = await runChallengeMatch(match, { candidate: pass(), limits: { maxWindows: 1, maxRecordedPlies: 4 } });
    expect(evidence.resolves[0]!.queue.map((action) => action.seq)).toEqual([0, 1]);
    expect(evidence.resolves[0]!.queue.map(({ seq: _seq, ...action }) => action)).toEqual(actions);
    expect(corpus.traces.every((trace) => trace.windows.every((window) => window.actions.every((action) => !("seq" in action))))).toBe(true);
  });

  it("distinguishes an explicit empty window from nonterminal exhaustion", async () => {
    const candidate = pass();
    const explicit = await runChallengeMatch(request([[]]), { candidate });
    expect(explicit.stop).toMatchObject({ kind: "trace-exhausted", planningOrdinal: 1, turn: 1 });
    expect(explicit.resolves).toHaveLength(1);
    expect(explicit.resolves[0]!.queue).toEqual([]);
    expect(explicit.finalBank).toEqual({ w: 4, b: 4 });
    expect(explicit.outcome).toBeNull();
    expect(candidate.choose).toHaveBeenCalledTimes(1);
    const absentCandidate = pass();
    const absent = await runChallengeMatch(request([]), { candidate: absentCandidate });
    expect(absent.stop).toMatchObject({ kind: "trace-exhausted", planningOrdinal: 0, turn: 0 });
    expect(absent.resolves).toEqual([]);
    expect(absent.finalBank).toEqual({ w: 3, b: 3 });
    expect(absent.outcome).toBeNull();
    expect(absentCandidate.choose).not.toHaveBeenCalled();
  });

  it("records a frustrated admitted intent, then rejects the missing historical actor next window", async () => {
    const customOpening = "SCFEN|4k3/8/8/8/R1r5/8/8/4K3|0|33|P|G:11:11|B:3:3|Q:w:;b:";
    const white: ScActionInput[] = [
      { kind: "classical", timing: "C", color: "w", from: "a4", to: "a5" },
      { kind: "siegeMode", timing: "F", color: "w", from: "a4" },
    ];
    const nextWhite: ScActionInput[] = [
      { kind: "siegeMode", timing: "B", color: "w", from: "a5" },
      { kind: "classical", timing: "C", color: "w", from: "a5", to: "a6" },
    ];
    const unfrustrated = await runChallengeMatch(request([white, nextWhite], customOpening), { candidate: pass() });
    expect(unfrustrated.stop.kind).toBe("trace-exhausted");
    expect(unfrustrated.resolves).toHaveLength(2);
    expect(placementToMap(unfrustrated.resolves[1]!.next.placement).get("a6")).toEqual({ color: "w", type: "r" });
    const candidate: CandidatePolicy = {
      name: "capture-actor", choose: vi.fn()
        .mockReturnValueOnce([{ kind: "classical", timing: "C", color: "b", from: "c4", to: "a4" }])
        .mockReturnValue([]),
    };
    const evidence = await runChallengeMatch(request([white, nextWhite], customOpening), { candidate });
    expect(evidence.resolves).toHaveLength(1);
    expect(evidence.resolves[0]!.queue.slice(0, 2)).toEqual(white.map((action, seq) => ({ ...action, seq })));
    expect(placementToMap(evidence.resolves[0]!.next.placement).get("a5")).toBeUndefined();
    expect([...placementToMap(evidence.resolves[0]!.next.placement).values()]).not.toContainEqual({ color: "w", type: "r" });
    expect(evidence.resolves[0]!.next.siegedTanks ?? []).toEqual([]);
    expect(evidence.stop).toMatchObject({
      kind: "queue-rejected", side: "w", planningOrdinal: 1, actionIndex: 0, sourcePlyIndex: 41,
      engineCode: "SC_SPECIAL", reason: "no actor on a5",
    });
    expect(evidence.finalBank).toEqual({ w: 4, b: 4 });
    expect(evidence.outcome).toBeNull();
    expect(candidate.choose).toHaveBeenCalledTimes(2);
  });

  it("stages independently and commits each stable array without mutating inputs", () => {
    const open = parseScFen(opening);
    const white = admitted(open, "w", [prefix[0]!]);
    const black = admitted(open, "b", [{ kind: "deploy", timing: "B", color: "b", from: "e8", to: "d8", unit: "n" }]);
    const bank = { w: 3, b: 3 };
    const before = structuredClone({ open, bank, white, black });
    const committed = commitPair(open, bank, white, black);
    expect(committed.bank).toEqual({ w: 2, b: 0 });
    expect(committed.snapshot.gas).toEqual({ w: 0, b: 0 });
    expect(committed.snapshot.queue!.actions.map((action) => [action.color, action.seq])).toEqual([["w", 0], ["b", 1]]);
    expect({ open, bank, white, black }).toEqual(before);
  });
});
