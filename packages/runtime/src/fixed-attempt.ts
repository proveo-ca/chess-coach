// SPEC: _spec/match-runtime.puml, _spec/runtime-protocol.puml
import { mkdirSync } from "node:fs";
import { MatchProcess } from "./match-process";
import { ProcessTransport } from "./process-transport";
import { NativeLearner } from "./native-learner";
import { LearnerPair } from "./learner-pair";
import type { RecordedCorpus } from "./corpus";
import type { StrategicApi } from "./strategic";
import type { AttemptSetup } from "./training-coordinator";
import { ModelInputs } from "./model-inputs";
import type { ExitReceipt, OwnedTransport } from "./native-session";

export type NativeObservation = Readonly<
  { kind: "request"; attemptId: string; channel: "a" | "b"; json: string }
  | { kind: "reply"; attemptId: string; channel: "a" | "b"; json: string; receivedNs: bigint }
  | { kind: "finish"; attemptId: string; channel: "a" | "b"; receipt: ExitReceipt }>;
export type NativeObserver = (event: NativeObservation) => void;

export function observeNativeTransport(raw: OwnedTransport, attemptId: string, channel: "a" | "b", observer?: NativeObserver): OwnedTransport {
  if (observer !== undefined && typeof observer !== "function") throw new Error("Fixed attempt: OBSERVER");
  if (observer === undefined) return raw;
  const observe = (event: NativeObservation): void => {
    const result: unknown = observer(Object.freeze(event));
    if (result !== undefined) {
      if (result instanceof Promise) void result.catch(() => {});
      throw new Error("Fixed attempt: OBSERVER_RETURN");
    }
  };
  return {
    async exchange(json) {
      observe({ kind: "request", attemptId, channel, json });
      const reply = await raw.exchange(json);
      observe({ kind: "reply", attemptId, channel, json: reply.json, receivedNs: reply.receivedNs });
      return reply;
    },
    async finish() {
      const receipt = await raw.finish();
      observe({ kind: "finish", attemptId, channel, receipt: Object.freeze({ ...receipt }) });
      return receipt;
    },
    terminate(reason) { return raw.terminate(reason); },
  };
}

export class FixedAttemptFactory {
  private readonly layout: Readonly<FixedAttemptLayout>;
  private readonly observer: NativeObserver | undefined;
  constructor(private readonly corpus: RecordedCorpus, private readonly strategic: StrategicApi | null, layout: FixedAttemptLayout = FIXED_ATTEMPT_LAYOUT, observer?: NativeObserver) {
    if (observer !== undefined && typeof observer !== "function") throw new Error("Fixed attempt: OBSERVER");
    this.observer = observer;
    this.layout = Object.freeze({ ...layout });
    if (Object.values(this.layout).some(path => !path.startsWith("/") || path.includes("\0"))) throw new Error("Fixed attempt: LAYOUT");
    mkdirSync(this.layout.scratchRoot, { mode: 0o700 });
  }
  readonly create: AttemptSetup = async ({ descriptor, model, timing }) => {
    const ports: ProcessTransport[] = [];
    let child: MatchProcess | null = null;
    let inputs: ModelInputs | null = null;
    try {
      if (timing.clockNs() >= timing.startupDeadlineNs || !/^[A-Za-z0-9._:-]{1,32}$/.test(descriptor.attemptId)) throw new Error("Fixed attempt: STARTUP");
      inputs = new ModelInputs(this.layout.scratchRoot, descriptor.attemptId, model);
      const { config, record } = inputs;
      const learner = (suffix: "a" | "b") => {
        const sessionId = `${descriptor.attemptId}:learner:${suffix}`;
        const port = new ProcessTransport({ runtime: "native", executable: this.layout.learnerExecutable, arguments: [config, record, sessionId], cwd: this.layout.cwd },
          { frameBytes: 8 * 1024 * 1024, stdoutBytes: 64 * 1024 * 1024, stderrBytes: 65536 }, timing.clockNs);
        ports.push(port);
        const observed = observeNativeTransport(port, descriptor.attemptId, suffix, this.observer);
        return new NativeLearner(sessionId, descriptor.modelId, observed, timing.clockNs, timing.workDeadlineNs, timing.cleanupDeadlineNs);
      };
      const first = learner("a"), second = learner("b"), learners = new LearnerPair(first, second);
      const remaining = timing.workDeadlineNs - timing.clockNs();
      if (remaining <= 0n) throw new Error("Fixed attempt: WORK_DEADLINE");
      child = new MatchProcess({ executable: this.layout.bunExecutable, entrypoint: this.layout.matchEntrypoint,
        arguments: [descriptor.attemptId, descriptor.modelId, String(remaining)], cwd: this.layout.cwd }, timing.clockNs, timing.cleanupDeadlineNs);
      return { transport: child, learners, verifier: first, corpus: this.corpus, strategic: this.strategic, releaseInputs: inputs.release };
    } catch (error) {
      const results = await Promise.allSettled([...(child ? [child.terminate(error)] : []), ...ports.map(port => port.terminate(error))]);
      const failures = results.flatMap(value => value.status === "rejected" ? [value.reason] : []);
      try { inputs?.release(); } catch (release) { failures.push(release); }
      if (failures.length) throw new AggregateError([error, ...failures], "Fixed attempt: CLEANUP");
      throw error;
    }
  };
}

export type FixedAttemptLayout = Readonly<{ scratchRoot: string; cwd: string; bunExecutable: string; learnerExecutable: string; matchEntrypoint: string }>;
export const FIXED_ATTEMPT_LAYOUT: FixedAttemptLayout = Object.freeze({ scratchRoot: "/tmp/episode-model", cwd: "/app", bunExecutable: "/usr/local/bin/bun",
  learnerExecutable: "/usr/local/bin/policy-channel", matchEntrypoint: "/app/packages/runtime/src/match-worker-main.ts" });
