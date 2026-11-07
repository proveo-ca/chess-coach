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
  private readonly root = "/tmp/episode-model";
  constructor(private readonly corpus: RecordedCorpus, private readonly strategic: StrategicApi) {
    mkdirSync(this.root, { mode: 0o700 });
  }
  readonly create: AttemptSetup = async ({ descriptor, model, timing }) => {
    const ports: ProcessTransport[] = [];
    let child: MatchProcess | null = null;
    try {
      if (timing.clockNs() >= timing.startupDeadlineNs || !/^[A-Za-z0-9._:-]{1,32}$/.test(descriptor.attemptId)) throw new Error("Fixed attempt: STARTUP");
      const inputs = new ModelInputs(this.root, descriptor.attemptId, model);
      const { config, record } = inputs;
      const learner = (suffix: string) => {
        const sessionId = `${descriptor.attemptId}:learner:${suffix}`;
        const port = new ProcessTransport({ runtime: "native", executable: "/usr/local/bin/policy-channel", arguments: [config, record, sessionId], cwd: "/app" },
          { frameBytes: 8 * 1024 * 1024, stdoutBytes: 64 * 1024 * 1024, stderrBytes: 65536 }, timing.clockNs);
        ports.push(port);
        return new NativeLearner(sessionId, descriptor.modelId, port, timing.clockNs, timing.workDeadlineNs, timing.cleanupDeadlineNs);
      };
      const first = learner("a"), second = learner("b"), learners = new LearnerPair(first, second);
      const remaining = timing.workDeadlineNs - timing.clockNs();
      if (remaining <= 0n) throw new Error("Fixed attempt: WORK_DEADLINE");
      child = new MatchProcess({ executable: "/usr/local/bin/bun", entrypoint: "/app/packages/runtime/src/match-worker-main.ts",
        arguments: [descriptor.attemptId, descriptor.modelId, String(remaining)], cwd: "/app" }, timing.clockNs, timing.cleanupDeadlineNs);
      return { transport: child, learners, verifier: first, corpus: this.corpus, strategic: this.strategic, releaseInputs: inputs.release };
    } catch (error) {
      const results = await Promise.allSettled([...(child ? [child.terminate(error)] : []), ...ports.map(port => port.terminate(error))]);
      const failures = results.flatMap(value => value.status === "rejected" ? [value.reason] : []);
      if (failures.length) throw new AggregateError([error, ...failures], "Fixed attempt: CLEANUP");
      throw error;
    }
  };
}
