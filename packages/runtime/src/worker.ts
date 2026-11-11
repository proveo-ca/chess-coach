// SPEC: _spec/runtime-protocol.puml
import type {} from "bun";
import { createHash } from "node:crypto";
import { decodeNativeRequest, encodeNativeReply, nativeBoundaryShape } from "../../contracts/src/native-protocol";
import type { NativeBoundary, NativeMode, NativeReply, NativeRole } from "../../contracts/src/native-protocol";
import type { GamePlans } from "../../contracts/src/game-session";

export type StagedGame<S> = { state: S; boundary: NativeBoundary };
export interface GameDriver<S> {
  initialize(): StagedGame<S>;
  open(state: S): StagedGame<S>;
  settle(state: S, plans: GamePlans): StagedGame<S>;
  commit?(state: S): S;
}
const hash = (value: NativeBoundary): string => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const boundaryDigest = hash;
export class NativeWorker<S> {
  private cursor = -1;
  private ordinal = 0;
  private current: S | undefined;
  private pending: (StagedGame<S> & { digest: string; cursor: number }) | null = null;
  private previous: { ordinal: number; request: string; reply: string } | null = null;
  private closed = false;
  private failed = false;
  private busy = false;

  constructor(private readonly role: NativeRole, private readonly mode: NativeMode, private readonly sessionId: string,
    private readonly driver: GameDriver<S>) {}

  handle(json: string): string {
    if (this.closed || this.failed) throw new Error("Native worker: CLOSED");
    if (this.busy) { this.failed = true; throw new Error("Native worker: REENTRY"); }
    this.busy = true;
    try {
      const request = decodeNativeRequest(json);
      if (request.sessionId !== this.sessionId) throw new Error("Native worker: SESSION");
      if (request.ordinal === this.previous?.ordinal) {
        if (json !== this.previous.request) throw new Error("Native worker: REPLAY_CONFLICT");
        return this.previous.reply;
      }
      if (request.ordinal !== this.ordinal || request.cursor !== this.cursor) throw new Error("Native worker: SEQUENCE");
      const header = { version: "chess-coach.native.v1" as const, sessionId: this.sessionId, ordinal: request.ordinal, cursor: this.cursor, role: this.role };
      let reply: NativeReply;
      if (request.operation === "commit") {
        if (!this.pending || request.stagedCursor !== this.pending.cursor || request.digest !== this.pending.digest) throw new Error("Native worker: COMMIT");
        this.current = this.driver.commit ? this.driver.commit(this.pending.state) : this.pending.state;
        this.cursor = this.pending.cursor;
        this.pending = null;
        reply = { ...header, cursor: this.cursor, kind: "committed", digest: request.digest };
      } else if (request.operation === "close") {
        if (this.pending || this.cursor < 0 || this.mode === "native-proof" && this.cursor !== 2) throw new Error("Native worker: CLOSE_PHASE");
        this.closed = true;
        reply = { ...header, kind: "closed" };
      } else {
        if (this.pending) throw new Error("Native worker: PENDING");
        let staged: StagedGame<S>;
        if (request.operation === "init") {
          if (this.cursor !== -1) throw new Error("Native worker: INIT_PHASE");
          staged = this.driver.initialize();
        } else {
          if (this.current === undefined) throw new Error("Native worker: UNINITIALIZED");
          if (request.operation === "open") {
            if (this.mode === "native-proof" && this.cursor !== 0) throw new Error("Native worker: NATIVE_SCOPE");
            staged = this.driver.open(this.current);
          } else {
            if (this.mode === "native-proof" && (this.cursor !== 1 || request.plans.w.length || request.plans.b.length)) throw new Error("Native worker: NATIVE_SCOPE");
            staged = this.driver.settle(this.current, request.plans);
          }
        }
        const boundary = nativeBoundaryShape.parse(staged.boundary);
        this.pending = { state: staged.state, boundary, digest: hash(boundary), cursor: this.cursor + 1 };
        reply = { ...header, kind: "staged", stagedCursor: this.pending.cursor, boundary };
      }
      const encoded = encodeNativeReply(reply);
      this.previous = { ordinal: request.ordinal, request: json, reply: encoded };
      this.ordinal++;
      return encoded;
    } catch (error) { this.failed = true; throw error; }
    finally { this.busy = false; }
  }
}
