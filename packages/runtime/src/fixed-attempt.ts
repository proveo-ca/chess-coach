// SPEC: _spec/match-runtime.puml
import { mkdirSync } from "node:fs";
import { MatchProcess } from "./match-process";
import { ProcessTransport } from "./process-transport";
import { NativeLearner } from "./native-learner";
import { LearnerPair } from "./learner-pair";
import type { RecordedCorpus } from "./corpus";
import type { StrategicApi } from "./strategic";
import type { AttemptSetup } from "./training-coordinator";
import { ModelInputs } from "./model-inputs";

export class FixedAttemptFactory {
  private readonly layout: Readonly<FixedAttemptLayout>;
  constructor(private readonly corpus: RecordedCorpus, private readonly strategic: StrategicApi | null, layout: FixedAttemptLayout = FIXED_ATTEMPT_LAYOUT) {
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
      const learner = (suffix: string) => {
        const sessionId = `${descriptor.attemptId}:learner:${suffix}`;
        const port = new ProcessTransport({ runtime: "native", executable: this.layout.learnerExecutable, arguments: [config, record, sessionId], cwd: this.layout.cwd },
          { frameBytes: 8 * 1024 * 1024, stdoutBytes: 64 * 1024 * 1024, stderrBytes: 65536 }, timing.clockNs);
        ports.push(port);
        return new NativeLearner(sessionId, descriptor.modelId, port, timing.clockNs, timing.workDeadlineNs, timing.cleanupDeadlineNs);
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
