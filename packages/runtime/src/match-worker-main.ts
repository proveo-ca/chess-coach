// SPEC: _spec/match-runtime.puml
import type {} from "bun";
import { MAX_MATCH_PROGRESS_BYTES } from "../../contracts/src/match";
import { loadCapturedCorpus } from "./corpus";
import { FrozenScorer } from "./frozen-scorer";
import { jsonLines } from "./framing";
import { MatchWorker } from "./match-worker";
import { loadCapturedStrategicApi } from "./strategic";

export async function runMatchWorkerLoop(worker: MatchWorker): Promise<void> {
  let closed = false;
  for await (const frame of jsonLines(Bun.stdin.stream(), MAX_MATCH_PROGRESS_BYTES, 64 * 1024 * 1024, process.hrtime.bigint, true)) {
    if (closed) throw new Error("Match worker: TRAILING_INPUT");
    const reply = await worker.handle(frame.json);
    await Bun.write(Bun.stdout, reply + "\n");
    closed = JSON.parse(reply).kind === "closed";
  }
  if (!closed) throw new Error("Match worker: MISSING_CLOSE");
}
async function main(): Promise<void> {
  const [attemptId, modelId, work] = process.argv.slice(2);
  if (process.argv.length !== 5 || !attemptId || !/^[A-Za-z0-9._:-]{1,32}$/.test(attemptId) || !modelId || !/^[a-f0-9]{64}$/.test(modelId) || !work || !/^[1-9][0-9]{0,24}$/.test(work)) throw new Error("Match worker: LAUNCH_ARGUMENTS");
  const clock = process.hrtime.bigint, remaining = BigInt(work);
  if (remaining <= 0n || remaining > 297_000_000_000n) throw new Error("Match worker: LAUNCH_DEADLINE");
  const workDeadlineNs = clock() + remaining;
  const scorer = new FrozenScorer("/usr/local/bin/policy-score", `/tmp/episode-model/attempt-${attemptId}/config.json`, `/tmp/episode-model/attempt-${attemptId}/model.bpk`, modelId, clock, workDeadlineNs);
  try {
    const [corpus, strategic] = await Promise.all([loadCapturedCorpus(), loadCapturedStrategicApi()]);
    await runMatchWorkerLoop(new MatchWorker(attemptId, { corpus, strategic, scorer, modelId, clockNs: clock, workDeadlineNs }));
  } catch (error) { await scorer.shutdown(error); throw error; }
}
if (import.meta.main) {
  try { await main(); }
  catch (error) { await Bun.write(Bun.stderr, String(error) + "\n"); process.exitCode = 1; }
}
