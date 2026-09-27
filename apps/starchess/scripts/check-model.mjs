// SPEC: _spec/apps/starchess/models/tutorial-lesson.puml
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const app = join(dirname(fileURLToPath(import.meta.url)), "..");
const quint = join(app, "node_modules/.bin/quint");
const model = join(app, "../../_spec/apps/starchess/models/tutorialLesson.qnt");

const CHECKS = [
  { main: "fixed", steps: 10, expect: "holds" },
  { main: "staleOpponent", steps: 6, expect: "violated" },
  { main: "unownedStoreTimers", steps: 6, expect: "violated" },
  { main: "unguardedAutoEnd", steps: 6, expect: "violated" },
];

let failed = 0;
for (const { main, steps, expect } of CHECKS) {
  const run = spawnSync(
    quint,
    ["verify", model, `--main=${main}`, "--invariant=safe", `--max-steps=${steps}`],
    { encoding: "utf8" },
  );
  if (run.status !== 0 && run.status !== 1) {
    process.stderr.write(run.stdout + run.stderr);
    console.error(`✗ ${main}: quint exited ${run.status}`);
    failed++;
    continue;
  }
  const got = run.status === 0 ? "holds" : "violated";
  const ok = got === expect;
  console.log(`${ok ? "✓" : "✗"} ${main}: safe ${got} (expected ${expect}, ${steps} steps)`);
  if (!ok) failed++;
}
process.exit(failed ? 1 : 0);
