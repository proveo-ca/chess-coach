// SPEC: _spec/gpu-owner.md, _spec/gpu-owner.puml
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { MatchWorker } from "../../../src/match-worker";
import { runMatchWorkerLoop } from "../../../src/match-worker-main";
import { SyntheticMatchScorer, syntheticCorpus } from "../../match-fixture";

if (import.meta.main) {
  try {
    const [attemptId, modelId, remaining] = Bun.argv.slice(2), clock = process.hrtime.bigint;
    if (Bun.argv.length !== 5 || !attemptId || !modelId || !remaining) throw new Error("GPU fixture match: ARGUMENTS");
    writeFileSync(join(dirname(import.meta.path), "match.started.json"), JSON.stringify({ pid: process.pid }) + "\n", { flag: "wx", mode: 0o600 });
    const scorer = new SyntheticMatchScorer(clock);
    await runMatchWorkerLoop(new MatchWorker(attemptId, { corpus: syntheticCorpus(0), strategic: null, scorer, modelId, clockNs: clock,
      workDeadlineNs: clock() + BigInt(remaining) }));
    writeFileSync(join(dirname(import.meta.path), "match.receipt.json"), JSON.stringify({ pid: process.pid, stdinEof: true, scores: scorer.scores,
      scorerClosed: scorer.closed, scorerStopped: scorer.stopped }) + "\n", { flag: "wx", mode: 0o600 });
  } catch (error) { await Bun.write(Bun.stderr, String(error) + "\n"); process.exitCode = 1; }
}
