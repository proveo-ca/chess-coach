// SPEC: _spec/packages/starchess-training/r4-host-verification.puml
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { auditR4PlanningBudget, planningAuditExitCode, R4_AUDIT_VERSION } from "../packages/starchess-arena/hermetic/r4-budget-audit.mjs";

export { auditR4PlanningBudget, planningAuditExitCode };

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 0 && (args.length !== 2 || args[0] !== "--root" || !args[1] || args[1].startsWith("--"))) throw new Error("Usage: r4-planning-budget-audit.mjs [--root directory]");
    const report = auditR4PlanningBudget(args[1]);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = planningAuditExitCode(report);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ version: R4_AUDIT_VERSION, productionReady: false, error: error.message })}\n`);
    process.exitCode = 1;
  }
}
