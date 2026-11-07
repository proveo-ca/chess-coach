// SPEC: _spec/learning-runtime.puml, _spec/checkpoint-runtime.puml
import type { LearningReply } from "../../contracts/src/learning-channel";
import type { AckedDecision } from "./policy-session";
import { NativeLearner } from "./native-learner";

export type PairedProposal = Extract<LearningReply["result"], { kind: "proposed" | "diagnostic" }>;
export class LearnerPair {
  private phase: "new" | "active" | "proposed" | "closed" | "failed" = "new";
  private busy = false;
  constructor(private readonly first: NativeLearner, private readonly second: NativeLearner) {
    if (first === second || first.sameChannel(second) || first.binding().sessionId === second.binding().sessionId || first.binding().modelId !== second.binding().modelId) throw new Error("Learner pair: OWNED_CHANNELS");
  }
  private async perform<T>(phase: "new" | "active" | "proposed", next: "active" | "proposed" | "closed", action: () => Promise<T>): Promise<T> {
    if (this.busy || this.phase !== phase) return this.abort(new Error("Learner pair: PHASE"));
    this.busy = true;
    try {
      const result = await action();
      if (this.phase !== phase) throw new Error("Learner pair: REVOKED");
      this.phase = next;
      return result;
    } catch (error) { return this.abort(error); }
    finally { this.busy = false; }
  }
  begin(baseline: number): Promise<void> {
    return this.perform("new", "active", async () => { await Promise.all([this.first.begin(baseline), this.second.begin(baseline)]); });
  }
  accumulate(accepted: AckedDecision): Promise<void> {
    return this.perform("active", "active", async () => { await Promise.all([this.first.accumulate(structuredClone(accepted)), this.second.accumulate(structuredClone(accepted))]); });
  }
  propose(returnValue: -1 | 0 | 1): Promise<PairedProposal> {
    return this.perform("active", "proposed", async () => {
      const [first, second] = await Promise.all([this.first.propose(returnValue), this.second.propose(returnValue)]);
      if (first.kind !== second.kind || first.kind === "proposed" && (second.kind !== "proposed" || first.parameterSha256 !== second.parameterSha256 ||
        !Object.is(first.objective, second.objective) || first.sampledDecisions !== second.sampledDecisions || first.nonzeroPolicyGradient !== second.nonzeroPolicyGradient)) throw new Error("Learner pair: PROPOSAL_MISMATCH");
      return structuredClone(first);
    });
  }
  close(): Promise<void> {
    return this.perform("proposed", "closed", async () => { await Promise.all([this.first.close(), this.second.close()]); });
  }
  async abort(reason: unknown): Promise<never> {
    this.phase = "failed";
    const results = await Promise.allSettled([Promise.resolve().then(() => this.first.shutdown(reason)), Promise.resolve().then(() => this.second.shutdown(reason))]);
    const failures = results.flatMap(result => result.status === "rejected" ? [result.reason] : []);
    if (failures.length) throw new AggregateError([reason, ...failures], "Learner pair: CLEANUP");
    throw reason;
  }
}
