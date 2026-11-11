// SPEC: _spec/checkpoint-runtime.puml
import type {} from "bun";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { addScAction, UNIT_COST } from "@chess-coach/game-core";
import type { ScFenSnapshot } from "@chess-coach/game-core";
import { nativeSnapshotShape } from "../../contracts/src/resolution";
import { decodeNativeIntents } from "../../contracts/src/native-intents";
import { opponentJournalShape as journalShape } from "../../contracts/src/match";
import type { OpponentJournal } from "../../contracts/src/match";
import { planPermitShape, streamStateShape } from "../../contracts/src/episode";
import type { PlanPermit, StreamState } from "../../contracts/src/episode";
import type { GameTransition } from "../../contracts/src/game-session";
import { drawStream } from "./rng";

type Call = (...args: unknown[]) => unknown;
const call = z.custom<Call>(value => typeof value === "function");
const apiShape = z.strictObject({ strategicScript: call, seedKvsForOpening: call, seedCcIntelForOpening: call, seedRunnerMemory: call, seedAttackerMemory: call,
  updateKvsForSnap: call, updateCcIntelForSnap: call, updateRunnersForSnap: call, updateAttackersForSnap: call, witnessFromEndTurn: call });
export type StrategicApi = z.infer<typeof apiShape>;
const pair = z.object({ perSide: z.strictObject({ w: z.unknown(), b: z.unknown() }) });
export type { OpponentJournal } from "../../contracts/src/match";
const digest = (value: unknown): string => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export class StrategicDriver {
  private readonly api: StrategicApi;
  private readonly play: Call;
  private snapshot: ScFenSnapshot;
  private phase: "initial" | "opened" | "tentative" | "acked" | "settled" = "initial";
  private failed = false;
  private boundary = 0;
  private ordinal = 0;
  private samplingState: StreamState;
  private tentative: OpponentJournal | null = null;
  private memory: { kvs: unknown; ccIntel: unknown; runner: unknown; attacker: unknown };

  constructor(private readonly attemptId: string, private readonly side: "w" | "b", snapshot: ScFenSnapshot, sampling: StreamState, input: StrategicApi,
    private readonly clockNs: () => bigint, private readonly workDeadlineNs: bigint) {
    this.api = apiShape.parse(input);
    this.snapshot = nativeSnapshotShape.parse(snapshot);
    this.samplingState = streamStateShape.parse(sampling);
    const now = clockNs();
    if (sampling.status !== "active" || !this.snapshot.stored || workDeadlineNs <= now || workDeadlineNs - now > 300_000_000_000n) throw new Error("Strategic: CONTEXT");
    this.play = z.object({ play: call }).parse(this.api.strategicScript({ feed: null })).play;
    this.memory = { kvs: this.api.seedKvsForOpening(structuredClone(this.snapshot)), ccIntel: this.api.seedCcIntelForOpening(),
      runner: this.api.seedRunnerMemory(), attacker: this.api.seedAttackerMemory() };
    for (const value of Object.values(this.memory)) pair.parse(value);
  }

  sampling(): StreamState { return structuredClone(this.samplingState); }
  private checkTime(deadline: bigint): void { if (this.clockNs() >= deadline) throw new Error("Strategic: DEADLINE"); }
  private fold(result: unknown, snapshot: ScFenSnapshot): void {
    const witness = this.api.witnessFromEndTurn(structuredClone(result));
    this.memory = { kvs: this.api.updateKvsForSnap(this.memory.kvs, structuredClone(snapshot)),
      ccIntel: this.api.updateCcIntelForSnap(this.memory.ccIntel, structuredClone(snapshot)),
      runner: this.api.updateRunnersForSnap(this.memory.runner, structuredClone(snapshot), structuredClone(witness)),
      attacker: this.api.updateAttackersForSnap(this.memory.attacker, structuredClone(snapshot), structuredClone(witness)) };
    for (const value of Object.values(this.memory)) pair.parse(value);
  }
  advance(transition: GameTransition): void {
    try {
      if (this.failed || transition.session.history.length !== this.boundary + 1) throw new Error("Strategic: BOUNDARY");
      if (transition.native.kind === "opened") {
        if (this.phase !== "initial" && this.phase !== "settled") throw new Error("Strategic: PHASE");
        if (transition.native.value.result.asResolve) this.fold(transition.native.value.result.asResolve, transition.session.snapshot);
        this.phase = "opened";
      } else {
        if (this.phase !== "acked") throw new Error("Strategic: PHASE");
        this.fold(transition.native.value.result, transition.session.snapshot);
        this.ordinal++;
        this.phase = "settled";
      }
      this.snapshot = nativeSnapshotShape.parse(transition.session.snapshot);
      this.boundary++;
    } catch (error) { this.failed = true; throw error; }
  }

  private async prepare(permitJson: string, verification: boolean): Promise<{ journal: OpponentJournal; digest: string }> {
    if (this.failed || this.phase !== "opened") { this.failed = true; throw new Error("Strategic: PHASE"); }
    this.phase = "tentative";
    try {
      if (Buffer.byteLength(permitJson) > 1048576) throw new Error("Strategic: FRAME_BOUND");
      const permit = planPermitShape.parse(JSON.parse(permitJson));
      if (permit.role !== "strategic" || permit.attemptId !== this.attemptId || permit.side !== this.side || permit.turn !== this.snapshot.turn || permit.planningOrdinal !== this.ordinal ||
        permit.permitId !== `${this.attemptId}:plan:${this.ordinal}:${this.side}` || BigInt(permit.deadlineNs) - BigInt(permit.issuedNs) !== 10_000_000_000n ||
        BigInt(permit.deadlineNs) > this.workDeadlineNs || this.clockNs() < BigInt(permit.issuedNs)) throw new Error("Strategic: PERMIT");
      const deadline = verification ? this.workDeadlineNs : BigInt(permit.deadlineNs);
      this.checkTime(deadline);
      const own = (value: unknown): unknown => structuredClone(pair.parse(value).perSide[this.side]);
      const bank = structuredClone(this.snapshot.stored!), before = structuredClone(this.samplingState);
      let after = structuredClone(before);
      const context = { color: this.side, storedFor: bank[this.side], bank, kvs: own(this.memory.kvs), ccIntel: own(this.memory.ccIntel),
        runnerMemory: own(this.memory.runner), attackerMemory: own(this.memory.attacker), movetimeMs: 0, rng: () => {
          this.checkTime(deadline);
          const draw = drawStream(after); after = draw.after; return draw.uniform;
        } };
      let timer: ReturnType<typeof setTimeout> | undefined;
      let raw: unknown;
      try {
        const expired = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Strategic: DEADLINE")), Number((deadline - this.clockNs() + 999999n) / 1000000n)); });
        raw = await Promise.race([Promise.resolve(this.play(structuredClone(this.snapshot), context)), expired]);
      } finally { if (timer !== undefined) clearTimeout(timer); }
      this.checkTime(deadline);
      if (this.failed) throw new Error("Strategic: REVOKED");
      const result = z.strictObject({ snapshot: nativeSnapshotShape, spendMinerals: z.int().min(0).max(12).optional() }).parse(raw);
      const actions = decodeNativeIntents(JSON.stringify((result.snapshot.queue?.actions ?? []).map(({ seq: _seq, ...action }) => action)), this.side);
      let expected = structuredClone(this.snapshot), spend = 0;
      for (const action of actions) {
        expected = addScAction({ snapshot: expected, action }).snapshot;
        if (action.kind === "deploy") spend += UNIT_COST[action.unit];
      }
      if (spend !== (result.spendMinerals ?? 0) || spend > bank[this.side] || !isDeepStrictEqual(expected, result.snapshot)) throw new Error("Strategic: RESULT_MUTATION_OR_SPEND");
      const journal = journalShape.parse({ version: "chess-coach.opponent.v1", attemptId: this.attemptId, permitId: permit.permitId, planningOrdinal: this.ordinal, side: this.side,
        snapshotDigest: digest(this.snapshot), actions, reportedMinSpend: spend, opponentBefore: before, opponentAfter: after });
      this.checkTime(deadline);
      this.tentative = journal;
      return { journal: structuredClone(journal), digest: digest(journal) };
    } catch (error) { this.failed = true; throw error; }
  }
  async plan(permitJson: string): Promise<string> { return JSON.stringify((await this.prepare(permitJson, false)).journal); }
  acceptAck(ack: string): void {
    try {
      this.checkTime(this.workDeadlineNs);
      if (this.failed || this.phase !== "tentative" || this.tentative === null || digest(this.tentative) !== ack) throw new Error("Strategic: ACK");
      this.samplingState = structuredClone(this.tentative.opponentAfter);
      this.tentative = null;
      this.phase = "acked";
    } catch (error) { this.failed = true; throw error; }
  }
  async verify(raw: { json: string; receivedNs: bigint }, permit: PlanPermit): Promise<{ journal: OpponentJournal; digest: string }> {
    try {
      if (raw.receivedNs < BigInt(permit.issuedNs) || raw.receivedNs >= BigInt(permit.deadlineNs) || raw.receivedNs > this.clockNs() || raw.json.length > 1048576 || Buffer.byteLength(raw.json) > 1048576) throw new Error("Strategic: RECEIPT");
      const claimed = journalShape.parse(JSON.parse(raw.json)), expected = await this.prepare(JSON.stringify(permit), true);
      if (!isDeepStrictEqual(claimed, expected.journal)) throw new Error("Strategic: REPLAY_MISMATCH");
      this.acceptAck(expected.digest);
      return expected;
    } catch (error) { this.failed = true; throw error; }
  }
}

export async function loadCapturedStrategicApi(): Promise<StrategicApi> {
  const corePath = "/app/reference/packages/starchess-core/src/index.ts", playerPath = "/app/reference/packages/starchess-arena/src/players/strategic.ts";
  const [core, player] = await Promise.all([import(corePath), import(playerPath)]);
  return apiShape.parse({ strategicScript: player.strategicScript, seedKvsForOpening: core.seedKvsForOpening, seedCcIntelForOpening: core.seedCcIntelForOpening,
    seedRunnerMemory: core.seedRunnerMemory, seedAttackerMemory: core.seedAttackerMemory, updateKvsForSnap: core.updateKvsForSnap,
    updateCcIntelForSnap: core.updateCcIntelForSnap, updateRunnersForSnap: core.updateRunnersForSnap, updateAttackersForSnap: core.updateAttackersForSnap, witnessFromEndTurn: core.witnessFromEndTurn });
}
