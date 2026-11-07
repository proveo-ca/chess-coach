// SPEC: _spec/learning-runtime.puml, _spec/policy-runtime.puml
import type {} from "bun";
import { createHash } from "node:crypto";
import { decodeScoreResponse, encodeScoreRequest, MAX_INFERENCE_BYTES } from "@chess-coach/contracts";
import type { ScoreRequest } from "@chess-coach/contracts";
import { decodeLearningReply, learningRequestShape } from "../../contracts/src/learning-channel";
import type { LearningReply, LearningRequest } from "../../contracts/src/learning-channel";
import type { AckedDecision, FrozenScorePort } from "./policy-session";
import type { OwnedTransport } from "./native-session";

export class NativeLearner implements FrozenScorePort {
  private ordinal = 0;
  private samples = 0;
  private busy = false;
  private phase: "new" | "active" | "finished" | "closed" | "failed" = "new";
  private cleanup: Promise<void> | null = null;
  sameChannel(other: NativeLearner): boolean { return this.transport === other.transport; }
  binding(): { modelId: string; sessionId: string } { return { modelId: this.modelId, sessionId: this.sessionId }; }
  private revoked(): boolean { return this.phase === "failed" || this.phase === "closed"; }
  private alive(): void { if (this.revoked()) throw new Error("Native learner: CLOSED"); }
  constructor(private readonly sessionId: string, private readonly modelId: string, private readonly transport: OwnedTransport,
    private readonly clockNs: () => bigint, private readonly workDeadlineNs: bigint, private readonly cleanupDeadlineNs: bigint) {
    if (workDeadlineNs <= clockNs() || cleanupDeadlineNs < workDeadlineNs) throw new Error("Native learner: DEADLINE_CONTEXT");
  }

  private async bounded<T>(action: () => Promise<T>, deadline = this.workDeadlineNs): Promise<T> {
    if (this.clockNs() >= deadline) throw new Error("Native learner: DEADLINE");
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const expired = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Native learner: DEADLINE")), Number((deadline - this.clockNs() + 999999n) / 1000000n)); });
      const result = await Promise.race([action(), expired]);
      if (this.clockNs() >= deadline) throw new Error("Native learner: DEADLINE");
      return result;
    } finally { if (timer !== undefined) clearTimeout(timer); }
  }

  private async exchange(command: LearningRequest["command"]): Promise<{ result: LearningReply["result"]; receivedNs: bigint }> {
    if (this.revoked() || this.busy) {
      this.phase = "failed";
      const error = new Error("Native learner: CLOSED_OR_PENDING");
      await this.shutdown(error);
      throw error;
    }
    this.busy = true;
    try {
      const request = learningRequestShape.parse({ version: "chess-coach.learning-channel.v1", sessionId: this.sessionId, modelId: this.modelId, ordinal: this.ordinal, command });
      const json = JSON.stringify(request);
      if (Buffer.byteLength(json) > MAX_INFERENCE_BYTES) throw new Error("Native learner: INPUT_BOUND");
      const issued = this.clockNs(), raw = await this.bounded(() => this.transport.exchange(json)), reply = decodeLearningReply(raw.json);
      if (raw.receivedNs < issued || raw.receivedNs >= this.workDeadlineNs || raw.receivedNs > this.clockNs() ||
        this.revoked() || reply.sessionId !== this.sessionId || reply.modelId !== this.modelId || reply.ordinal !== this.ordinal) throw new Error("Native learner: BINDING");
      this.ordinal++;
      return { result: reply.result, receivedNs: raw.receivedNs };
    } catch (error) { return this.abort(error); }
    finally { this.busy = false; }
  }

  async begin(baseline: number): Promise<void> {
    if (this.phase !== "new") return this.abort(new Error("Native learner: BEGIN_PHASE"));
    const reply = await this.exchange({ kind: "begin", baseline });
    this.alive();
    if (reply.result.kind !== "begun") return this.abort(new Error("Native learner: BEGIN_ACK"));
    this.phase = "active";
  }
  async score(requestJson: string): Promise<{ json: string; receivedNs: bigint }> {
    if (this.phase !== "active") return this.abort(new Error("Native learner: SCORE_PHASE"));
    if (requestJson.length > MAX_INFERENCE_BYTES || Buffer.byteLength(requestJson) > MAX_INFERENCE_BYTES) return this.abort(new Error("Native learner: INPUT_BOUND"));
    let request: ScoreRequest;
    try { request = JSON.parse(requestJson); }
    catch (error) { return this.abort(error); }
    const reply = await this.exchange({ kind: "score", request });
    this.alive();
    if (reply.result.kind !== "scored") return this.abort(new Error("Native learner: SCORE_ACK"));
    const json = JSON.stringify(reply.result.response);
    try { decodeScoreResponse(json, request); }
    catch (error) { return this.abort(error); }
    return { json, receivedNs: reply.receivedNs };
  }
  async accumulate(accepted: AckedDecision): Promise<void> {
    if (this.phase !== "active" || accepted.journal.mode !== "sample" || accepted.journal.modelId !== this.modelId ||
      createHash("sha256").update(JSON.stringify(accepted.journal)).digest("hex") !== accepted.digest) return this.abort(new Error("Native learner: ACK_BINDING"));
    const request: ScoreRequest = { version: "chess-coach.inference.v1", featureVersion: accepted.features.featureVersion,
      requestId: accepted.journal.permitId, modelId: this.modelId, rows: accepted.features.rows, values: Array.from(accepted.features.values) };
    try { encodeScoreRequest(request); }
    catch (error) { return this.abort(error); }
    const reply = await this.exchange({ kind: "acknowledge", request, selected: accepted.journal.selectedIndex, journalDigest: accepted.digest });
    this.alive();
    if (reply.result.kind !== "acknowledged" || reply.result.journalDigest !== accepted.digest || reply.result.sampledDecisions !== this.samples + 1) return this.abort(new Error("Native learner: ACK_PREFIX"));
    this.samples++;
  }
  async propose(returnValue: -1 | 0 | 1): Promise<Extract<LearningReply["result"], { kind: "proposed" | "diagnostic" }>> {
    if (this.phase !== "active") return this.abort(new Error("Native learner: FINISH_PHASE"));
    const reply = await this.exchange({ kind: "finish", returnValue });
    this.alive();
    if (reply.result.kind === "diagnostic") {
      if (this.samples !== 0) return this.abort(new Error("Native learner: SAMPLE_COUNT"));
    } else if (reply.result.kind === "proposed") {
      const proposed = reply.result;
      if (proposed.sampledDecisions !== this.samples || createHash("sha256").update(Uint8Array.from(proposed.record)).digest("hex") !== proposed.config.recordSha256) return this.abort(new Error("Native learner: PROPOSAL"));
    } else return this.abort(new Error("Native learner: FINISH_ACK"));
    this.phase = "finished";
    return structuredClone(reply.result);
  }
  async close(): Promise<void> {
    if (this.phase !== "finished") return this.abort(new Error("Native learner: CLOSE_PHASE"));
    const reply = await this.exchange({ kind: "close" });
    this.alive();
    if (reply.result.kind !== "closed") return this.abort(new Error("Native learner: CLOSE_ACK"));
    try {
      const receipt = await this.bounded(() => this.transport.finish());
      this.alive();
      if (!receipt.stdinClosed || !receipt.stdoutEof || !receipt.stderrEof || !receipt.reaped || receipt.exitCode !== 0 || receipt.forced) throw new Error("Native learner: CLEAN_CLOSE");
      this.phase = "closed";
    } catch (error) { return this.abort(error); }
  }
  async abort(error: unknown): Promise<never> {
    await this.shutdown(error);
    throw error;
  }
  shutdown(reason: unknown): Promise<void> {
    this.phase = "failed";
    if (this.cleanup === null) {
      const operation = this.transport.terminate(reason);
      this.cleanup = this.bounded(() => operation, this.cleanupDeadlineNs);
    }
    return this.cleanup;
  }
}
