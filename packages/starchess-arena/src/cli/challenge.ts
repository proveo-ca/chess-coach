// SPEC: _spec/packages/starchess-arena/ml-adjutant-phase1.puml
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { runBaselineSuite, type Suite } from "../challenge/evidence";
import { publishReport } from "../challenge/publication";

const args = process.argv.slice(2);
const usage = "Usage: pnpm --filter @chess-coach/starchess-arena challenge [--suite all|corpus|live-strategic] [--rerun] --out <report.json>";
if (args.includes("--help")) console.log(usage);
else {
  let suite: Suite = "all";
  let rerun = false;
  let output: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--rerun") rerun = true;
    else if (arg === "--suite") {
      const value = args[++i];
      if (value !== "all" && value !== "corpus" && value !== "live-strategic") throw new Error(usage);
      suite = value;
    } else if (arg === "--out") {
      output = args[++i];
      if (!output || output.startsWith("--")) throw new Error(usage);
    } else throw new Error(usage);
  }
  if (!output) throw new Error(usage);
  const report = await runBaselineSuite(suite, rerun);
  const path = resolve(output);
  mkdirSync(dirname(path), { recursive: true });
  publishReport(path, report);
  console.log(JSON.stringify({ path, summary: report.summary, executionIntegrity: report.executionIntegrity, deterministicRerun: report.deterministicRerun.equal, learnedGateEligible: false }, null, 2));
  if (!report.executionIntegrity || (rerun && !report.deterministicRerun.equal)) process.exitCode = 1;
}
