// SPEC: _spec/match-runtime.puml
import { MatchWorker } from "../../src/match-worker";
import { FrozenScorer } from "../../src/frozen-scorer";
import { runMatchWorkerLoop } from "../../src/match-worker-main";
import { syntheticCorpus } from "../match-fixture";

const [modelId, work, config, record, executable] = process.argv.slice(2);
if (process.argv.length !== 7 || !modelId || !work || !config || !record || !executable) throw new Error("Synthetic match fixture: ARGUMENTS");
const clock = process.hrtime.bigint, deadline = clock() + BigInt(work);
const scorer = new FrozenScorer(executable, config, record, modelId, clock, deadline);
try {
  await runMatchWorkerLoop(new MatchWorker("synthetic-match", { corpus: syntheticCorpus(), strategic: null, scorer, modelId, clockNs: clock, workDeadlineNs: deadline }));
} catch (error) { await scorer.shutdown(error); throw error; }
