// SPEC: _spec/packages/starchess-arena/ml-adjutant-challenge-harness.puml
import {
  beginScTurn, endScTurn, formatScFen, mulberry32, normalizeSnapGas, parseScFen, scOutcome,
  seedAttackerMemory, seedCcIntelForOpening, seedKvsForOpening, seedRunnerMemory,
  updateAttackersForSnap, updateCcIntelForSnap, updateKvsForSnap, updateRunnersForSnap, witnessFromEndTurn,
  type EndScTurnResult, type PieceColor, type ScActionInput,
} from "@chess-coach/starchess-core";
import { strategicScript } from "../players/strategic";
import type { ScriptPlayer, SideContext } from "../players/types";
import { grantStoredIncome, type Bank } from "../run/bank";
import { commitPair, stageQueue, type StagedQueue } from "./admission";
import { baselinePolicy } from "./baseline";
import { CHALLENGE_CONFIG, deepFreeze } from "./config";
import { observe } from "./observation";
import type {
  CandidatePolicy, ChallengeEvidence, ChallengeProgress, ChallengeStop, CheckedStages, PlanPermit, ScheduledMatch, Sighting,
} from "./types";

export type MatchOptions = {
  candidate?: CandidatePolicy; strategic?: ScriptPlayer;
  onProgress?: (event: ChallengeProgress) => void;
  limits?: { maxWindows: number; maxRecordedPlies: number };
  checked?: CheckedStages;
};

export const runChallengeMatch = async (request: ScheduledMatch, options: MatchOptions = {}): Promise<ChallengeEvidence> => {
  const candidate = options.candidate ?? baselinePolicy;
  const strategic = options.strategic ?? strategicScript({ feed: null });
  const limits = options.limits ?? CHALLENGE_CONFIG;
  let snap = parseScFen(request.opening);
  if (!snap.stored || snap.stored.w !== 3 || snap.stored.b !== 3 || (snap.queue?.actions.length ?? 0) !== 0) {
    throw new Error("challenge opening requires empty queues and bank 3:3");
  }
  if (request.suite === "corpus" && (request.candidateSide !== "b" || !request.trace)) throw new Error("invalid corpus request");
  let bank: Bank = { ...snap.stored };
  let kvs = seedKvsForOpening(snap);
  let ccIntel = seedCcIntelForOpening();
  let runners = seedRunnerMemory();
  let attackers = seedAttackerMemory();
  let memories: Record<PieceColor, Sighting[]> = { w: [], b: [] };
  const rngs = { w: mulberry32(request.arenaSeed), b: mulberry32(~request.arenaSeed) };
  const inferenceRng = mulberry32(request.inferenceSeed);
  const scfens = [formatScFen(normalizeSnapGas(snap))];
  const resolves: EndScTurnResult[] = [];
  const bankTrail: Bank[] = [];
  let planningOrdinal = 0;
  let phase = "initial";
  let activeSide: PieceColor | undefined;
  let stop: ChallengeStop | null = null;
  const enter = (nextPhase: string, side?: PieceColor) => {
    phase = nextPhase;
    activeSide = side;
    options.onProgress?.({ kind: "phase", phase, side, planningOrdinal, turn: snap.turn });
  };
  const fail = (kind: ChallengeStop["kind"], reason?: string): ChallengeStop => ({
    kind, phase, planningOrdinal, turn: snap.turn, ...(activeSide ? { side: activeSide } : {}), ...(reason ? { reason } : {}),
  });
  const updateMemory = () => {
    memories = { w: observe(snap, bank, "w", memories.w).memory, b: observe(snap, bank, "b", memories.b).memory };
  };
  const record = (resolve: EndScTurnResult) => {
    snap = resolve.next;
    resolves.push(resolve);
    const scfen = formatScFen(normalizeSnapGas(snap));
    scfens.push(scfen);
    bankTrail.push({ ...bank });
    kvs = updateKvsForSnap(kvs, snap);
    ccIntel = updateCcIntelForSnap(ccIntel, snap);
    const witness = witnessFromEndTurn(resolve);
    runners = updateRunnersForSnap(runners, snap, witness);
    attackers = updateAttackersForSnap(attackers, snap, witness);
    updateMemory();
    options.onProgress?.({ kind: "ply", scfen, resolve, bank: { ...bank } });
  };
  try {
    updateMemory();
    while (!stop) {
      if (scOutcome(snap)) { stop = fail("terminal"); break; }
      enter("turn-open");
      const opened = beginScTurn(snap);
      let checkedPermit: PlanPermit | null = null;
      if (options.checked) {
        const reply = await options.checked.turnOpen({ planningOrdinal, begin: opened, bank: { ...bank } });
        if (reply.kind === "permit") checkedPermit = reply.permit;
        else {
          snap = opened.next;
          if (opened.asResolve) record(opened.asResolve);
          const halted = reply.stop === "terminal" ? Boolean(scOutcome(snap))
            : reply.stop === "progress-limit" ? planningOrdinal >= limits.maxWindows || resolves.length >= limits.maxRecordedPlies
            : request.suite === "corpus" && !request.trace?.windows[planningOrdinal];
          if (!halted) throw new Error(`halt mismatch: ${reply.stop}`);
          stop = fail(reply.stop, reply.stop === "progress-limit" ? "deterministic progress budget exceeded" : undefined);
          break;
        }
      }
      snap = opened.next;
      if (opened.asResolve) record(opened.asResolve);
      if (scOutcome(snap)) {
        if (options.checked) throw new Error("permit issued after terminal begin");
        stop = fail("terminal"); break;
      }
      if (planningOrdinal >= limits.maxWindows || resolves.length >= limits.maxRecordedPlies) {
        if (options.checked) throw new Error("permit issued after progress limit");
        stop = fail("progress-limit", "deterministic progress budget exceeded"); break;
      }
      const recorded = request.trace?.windows[planningOrdinal];
      if (request.suite === "corpus" && !recorded) {
        if (options.checked) throw new Error("permit issued after trace exhaustion");
        stop = fail("trace-exhausted"); break;
      }
      if ((snap.queue?.actions.length ?? 0) !== 0) throw new Error("nonempty turn-open queue");
      updateMemory();
      const open = deepFreeze(structuredClone(snap));
      const openBank = deepFreeze({ ...bank });
      const observations = {
        w: observe(open, openBank, "w", memories.w), b: observe(open, openBank, "b", memories.b),
      };
      const contexts: Record<PieceColor, SideContext> = {
        w: { color: "w", storedFor: bank.w, bank: structuredClone(bank), kvs: structuredClone(kvs.perSide.w),
          ccIntel: structuredClone(ccIntel.perSide.w), runnerMemory: structuredClone(runners.perSide.w),
          attackerMemory: structuredClone(attackers.perSide.w), movetimeMs: 0, rng: rngs.w },
        b: { color: "b", storedFor: bank.b, bank: structuredClone(bank), kvs: structuredClone(kvs.perSide.b),
          ccIntel: structuredClone(ccIntel.perSide.b), runnerMemory: structuredClone(runners.perSide.b),
          attackerMemory: structuredClone(attackers.perSide.b), movetimeMs: 0, rng: rngs.b },
      };
      const intents: Record<PieceColor, ScActionInput[]> = { w: [], b: [] };
      const reportedSpend: Partial<Record<PieceColor, number>> = {};
      const policySides = (["w", "b"] as const).filter((side) => side === request.candidateSide || request.suite !== "corpus");
      if (options.checked) {
        let permit: PlanPermit | null = checkedPermit;
        for (const side of policySides) {
          if (!permit || permit.side !== side || permit.planningOrdinal !== planningOrdinal || permit.turn !== snap.turn) {
            throw new Error("permit does not match the required decision");
          }
          if (side === request.candidateSide) {
            enter("candidate-plan", side);
            intents[side] = structuredClone(await candidate.choose(observations[side], inferenceRng));
            const next = await options.checked.decision({ permit, actions: intents[side], reportedMinSpend: null });
            permit = next.kind === "permit" ? next.permit : null;
          } else {
            enter("strategic-plan", side);
            const plan = await strategic.play(structuredClone(open), contexts[side]);
            const actions = plan.snapshot.queue?.actions;
            if (!Array.isArray(actions) || actions.some((action) => action.color !== side)) {
              stop = fail("script-contract", "strategic returned an invalid side queue"); break;
            }
            intents[side] = actions.map(({ seq: _seq, ...action }) => action);
            reportedSpend[side] = plan.spendMinerals ?? 0;
            const next = await options.checked.decision({
              permit, actions: intents[side], reportedMinSpend: reportedSpend[side] ?? 0,
            });
            permit = next.kind === "permit" ? next.permit : null;
          }
        }
        if (stop) break;
        if (permit) throw new Error("unused permit after required decisions");
      } else {
        for (const side of ["w", "b"] as const) {
          if (side === request.candidateSide) {
            enter("candidate-plan", side);
            intents[side] = structuredClone(await candidate.choose(observations[side], inferenceRng));
          } else if (request.suite === "corpus") {
            intents[side] = structuredClone(recorded!.actions);
          } else {
            enter("strategic-plan", side);
            const plan = await strategic.play(structuredClone(open), contexts[side]);
            const actions = plan.snapshot.queue?.actions;
            if (!Array.isArray(actions) || actions.some((action) => action.color !== side)) {
              stop = fail("script-contract", "strategic returned an invalid side queue"); break;
            }
            intents[side] = actions.map(({ seq: _seq, ...action }) => action);
            reportedSpend[side] = plan.spendMinerals ?? 0;
          }
        }
      }
      if (request.suite === "corpus") intents.w = structuredClone(recorded!.actions);
      if (stop) break;
      const staged: Partial<Record<PieceColor, StagedQueue>> = {};
      for (const side of ["w", "b"] as const) {
        enter("admission", side);
        const result = stageQueue(open, openBank, side, intents[side], planningOrdinal);
        if (!result.ok) {
          stop = {
            ...result.failure, rejectedQueue: structuredClone(intents[side]),
            ...(request.suite === "corpus" && side === "w" ? { sourcePlyIndex: recorded!.sourcePlyIndex } : {}),
          };
          if (options.checked) await options.checked.admissionFailure({ stop, rejectedQueue: stop.rejectedQueue! });
          break;
        }
        if (reportedSpend[side] !== undefined && reportedSpend[side] !== result.staged.spend) {
          stop = fail("script-contract", "strategic spend differs from admitted deployment costs"); break;
        }
        staged[side] = result.staged;
      }
      if (stop) break;
      enter("settlement");
      const committed = commitPair(open, openBank, staged.w!, staged.b!);
      const resolve = endScTurn(committed.snapshot, { skipTurnStartChecks: true });
      bank = grantStoredIncome(committed.bank, resolve.next.turn);
      if (options.checked) await options.checked.settlement({ planningOrdinal, end: resolve, bank: { ...bank } });
      record(resolve);
      planningOrdinal++;
      if (scOutcome(snap)) stop = fail("terminal");
    }
  } catch (error) {
    stop = fail("exception", error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  }
  return {
    match: structuredClone(request), policy: candidate.name, modelArtifact: null, learnedGateEligible: false, fallbackCount: 0,
    scfens, resolves, bankTrail, finalBank: { ...bank }, outcome: stop?.kind === "terminal" ? scOutcome(snap) : null,
    stop: stop ?? fail("exception", "missing stop reason"),
  };
};
