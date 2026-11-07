// SPEC: _spec/runtime-protocol.puml
import type {} from "bun";
import { isDeepStrictEqual } from "node:util";
import { CANONICAL_OPENING_PLACEMENT } from "@chess-coach/game-core";
import { decodeNativeReply, decodeNativeRequest, encodeNativeRequest } from "../../contracts/src/native-protocol";
import type { NativeBoundary, NativeMode, NativeReply, NativeRequest, NativeRole } from "../../contracts/src/native-protocol";
import type { GamePlans } from "../../contracts/src/game-session";
import { boundaryDigest } from "./worker";

export type ExitReceipt = { stdinClosed: boolean; stdoutEof: boolean; stderrEof: boolean; reaped: boolean; exitCode: number | null; forced: boolean };
export interface OwnedTransport {
  exchange(json: string): Promise<{ json: string; receivedNs: bigint }>;
  finish(): Promise<ExitReceipt>;
  terminate(reason: unknown): Promise<void>;
}
type Operation = { operation: "init" | "open" } | { operation: "settle"; plans: GamePlans };
type Prefix = { eventThrough: number; planningOrdinal: number };

export class NativeSession {
  private cursor = -1;
  private ordinal = 0;
  private messages = 0;
  private phase: "live" | "failed" | "closed" = "live";
  private busy = false;
  private committed: NativeBoundary | null = null;
  private cleanup: Promise<void> | null = null;
  private failure: unknown;
  private prefixes: Record<"w" | "b", Prefix> = { w: { eventThrough: 0, planningOrdinal: 0 }, b: { eventThrough: 0, planningOrdinal: 0 } };

  constructor(private readonly sessionId: string, private readonly mode: NativeMode, private readonly main: OwnedTransport,
    private readonly reference: OwnedTransport, private readonly clockNs: () => bigint, private readonly deadlineNs: bigint,
    private readonly cleanupDeadlineNs: bigint) {
    if (main === reference || deadlineNs <= clockNs() || cleanupDeadlineNs < deadlineNs) throw new Error("Native session: INITIAL_CONTEXT");
  }

  snapshot(): NativeBoundary | null { return this.committed === null ? null : structuredClone(this.committed); }
  initialize(): Promise<NativeBoundary> { return this.advance({ operation: "init" }); }
  open(): Promise<NativeBoundary> { return this.advance({ operation: "open" }); }
  settle(plans: GamePlans): Promise<NativeBoundary> { return this.advance({ operation: "settle", plans }); }

  private live(): void { if (this.phase !== "live") throw new Error("Native session: CLOSED"); }
  private checkTime(deadline = this.deadlineNs): void { if (this.clockNs() >= deadline) throw new Error("Native session: DEADLINE"); }
  private async bounded<T>(operation: Promise<T>, deadline = this.deadlineNs): Promise<T> {
    this.checkTime(deadline);
    const remaining = deadline - this.clockNs();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Native session: DEADLINE")), Number((remaining + 999999n) / 1000000n)); });
      const result = await Promise.race([operation, timeout]);
      this.checkTime(deadline);
      return result;
    } finally { if (timer !== undefined) clearTimeout(timer); }
  }
  private async abort(error: unknown): Promise<never> {
    if (this.cleanup === null) {
      this.phase = "failed";
      this.failure = error;
      this.cleanup = this.bounded(Promise.allSettled([this.main.terminate(error), this.reference.terminate(error)]), this.cleanupDeadlineNs).then(results => {
        const failures = results.flatMap(result => result.status === "rejected" ? [result.reason] : []);
        if (failures.length) throw new AggregateError(failures, "Native session: CLEANUP_ERRORS");
      });
    }
    try { await this.cleanup; }
    catch (cleanup) { throw new AggregateError([this.failure, cleanup], "Native session: FAILED_WITH_CLEANUP_ERRORS"); }
    throw this.failure;
  }
  private async pair(request: NativeRequest, kind: NativeReply["kind"], cursor: number): Promise<[NativeReply, NativeReply]> {
    this.live();
    this.checkTime();
    if (this.messages + 4 > 2048) throw new Error("Native session: MESSAGE_BOUND");
    this.messages += 4;
    const json = encodeNativeRequest(request), issued = this.clockNs();
    const replies = await this.bounded(Promise.all([this.main.exchange(json), this.reference.exchange(json)]));
    this.live();
    const result: NativeReply[] = [];
    for (const [index, raw] of replies.entries()) {
      if (raw.receivedNs < issued || raw.receivedNs >= this.deadlineNs || raw.receivedNs > this.clockNs()) throw new Error("Native session: RECEIPT_DEADLINE");
      const reply = decodeNativeReply(raw.json), role: NativeRole = index === 0 ? "main" : "reference";
      if (reply.role !== role || reply.sessionId !== this.sessionId || reply.ordinal !== this.ordinal || reply.cursor !== cursor || reply.kind !== kind) throw new Error("Native session: REPLY_BINDING");
      result.push(reply);
    }
    this.checkTime();
    this.ordinal++;
    return result as [NativeReply, NativeReply];
  }
  private request(): { version: "chess-coach.native.v1"; sessionId: string; ordinal: number; cursor: number } {
    return { version: "chess-coach.native.v1", sessionId: this.sessionId, ordinal: this.ordinal, cursor: this.cursor };
  }
  private verifyBoundary(boundary: NativeBoundary, kind: NativeBoundary["kind"]): Record<"w" | "b", Prefix> {
    const expectedCursor = this.cursor + 1;
    if (boundary.kind !== kind) throw new Error("Native session: BOUNDARY_PHASE");
    if (kind === "initial" && (this.cursor !== -1 || boundary.snapshot.placement !== CANONICAL_OPENING_PLACEMENT || boundary.snapshot.turn !== 0 ||
      boundary.snapshot.phase !== "P" || boundary.bank.w !== 3 || boundary.bank.b !== 3 || boundary.snapshot.ccLives.w !== 3 || boundary.snapshot.ccLives.b !== 3)) throw new Error("Native session: CANONICAL_OPENING");
    const next = structuredClone(this.prefixes);
    for (const side of ["w", "b"] as const) {
      const batch = boundary.batches[side], prior = this.prefixes[side];
      const planning = prior.planningOrdinal + (kind === "settled" ? 1 : 0);
      if (batch.ordinal !== expectedCursor || batch.planningOrdinal !== planning || kind === "initial" && (batch.events.length || batch.observation.economy.ownPaidDebits ||
        batch.observation.ownUnitLineage.some(unit => unit.paidBasis !== 0))) throw new Error("Native session: RECIPIENT_PREFIX");
      for (const [index, event] of batch.events.entries()) if (event.sequence !== prior.eventThrough + index + 1) throw new Error("Native session: EVENT_PREFIX");
      next[side] = { eventThrough: prior.eventThrough + batch.events.length, planningOrdinal: planning };
    }
    return next;
  }

  private async advance(operation: Operation): Promise<NativeBoundary> {
    this.live();
    if (this.busy) return this.abort(new Error("Native session: REENTRY"));
    this.busy = true;
    try {
      if (this.mode === "native-proof" && (operation.operation === "open" && this.cursor !== 0 || operation.operation === "settle" &&
        (this.cursor !== 1 || operation.plans.w.length || operation.plans.b.length))) throw new Error("Native session: NATIVE_SCOPE");
      const kind = operation.operation === "init" ? "initial" : operation.operation === "open" ? "opened" : "settled";
      const replies = await this.pair(decodeNativeRequest(JSON.stringify({ ...this.request(), ...operation })), "staged", this.cursor);
      const [main, reference] = replies;
      if (main.kind !== "staged" || reference.kind !== "staged" || main.stagedCursor !== this.cursor + 1 || reference.stagedCursor !== main.stagedCursor ||
        !isDeepStrictEqual(main.boundary, reference.boundary)) throw new Error("Native session: REFERENCE_MISMATCH");
      const prefixes = this.verifyBoundary(main.boundary, kind), digest = boundaryDigest(main.boundary);
      const committed = await this.pair({ ...this.request(), operation: "commit", stagedCursor: main.stagedCursor, digest }, "committed", main.stagedCursor);
      if (committed.some(reply => reply.kind !== "committed" || reply.digest !== digest)) throw new Error("Native session: COMMIT_ACK");
      this.live();
      this.checkTime();
      this.cursor = main.stagedCursor;
      this.prefixes = prefixes;
      this.committed = structuredClone(main.boundary);
      return structuredClone(main.boundary);
    } catch (error) { return this.abort(error); }
    finally { this.busy = false; }
  }

  async close(): Promise<void> {
    this.live();
    if (this.busy) return this.abort(new Error("Native session: REENTRY"));
    this.busy = true;
    try {
      if (this.cursor < 0 || this.mode === "native-proof" && this.cursor !== 2) throw new Error("Native session: CLOSE_PHASE");
      await this.pair({ ...this.request(), operation: "close" }, "closed", this.cursor);
      const receipts = await this.bounded(Promise.all([this.main.finish(), this.reference.finish()]));
      if (receipts.some(receipt => !receipt.stdinClosed || !receipt.stdoutEof || !receipt.stderrEof || !receipt.reaped || receipt.exitCode !== 0 || receipt.forced)) throw new Error("Native session: CLEAN_CLOSE");
      this.phase = "closed";
    } catch (error) { return this.abort(error); }
    finally { this.busy = false; }
  }
}
