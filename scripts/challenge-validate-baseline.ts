// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml
import { readFileSync } from "node:fs";
import { classifyScheduledEvidence } from "../packages/starchess-arena/src/challenge/evidence.ts";
import { executionIntegrity, normalizeEvidence } from "../packages/starchess-arena/src/challenge/evidence.ts";
import { sha256 } from "../packages/starchess-arena/src/challenge/corpus.ts";
import { expectedSchedule, loadTrustedExecutionContext } from "../packages/starchess-arena/src/challenge/schedule.ts";
import type { ChallengeEvidence } from "../packages/starchess-arena/src/challenge/types.ts";

const [currentPath, originalPath, migrationPath] = process.argv.slice(2);
if (!currentPath || !originalPath || !migrationPath) throw new Error("baseline, original baseline, and migration paths are required");
const read = (path: string) => JSON.parse(readFileSync(path, "utf8")) as {
  rows?: ChallengeEvidence[];
  comparisons?: { key?: string; equal?: boolean; originalSha256?: string; currentSha256?: string }[];
};
const current = read(currentPath);
const original = read(originalPath);
const migration = read(migrationPath);
const context = loadTrustedExecutionContext("all");
const schedule = expectedSchedule(context);
const rows = current.rows ?? [];
const originalRows = original.rows ?? [];
const comparisons = migration.comparisons ?? [];
if (rows.length !== schedule.length || originalRows.length !== schedule.length || comparisons.length !== schedule.length) {
  throw new Error("Scheduled evidence cardinality mismatch");
}
const accounting = classifyScheduledEvidence(rows, context);
if (!accounting.acceptanceValid) throw new Error("Scheduled evidence failed authoritative validation");
for (const [index, match] of schedule.entries()) {
  const row = rows[index]!;
  const previous = originalRows[index]!;
  const comparison = comparisons[index]!;
  if (row.match.key !== match.key || previous.match.key !== match.key || comparison.key !== match.key) throw new Error(`Schedule identity mismatch: ${match.key}`);
  if (!executionIntegrity(row, true, context) || !executionIntegrity(previous, true, context)) throw new Error(`Authoritative replay failed: ${match.key}`);
  const originalSha256 = sha256(normalizeEvidence(previous));
  const currentSha256 = sha256(normalizeEvidence(row));
  if (comparison.originalSha256 !== originalSha256 || comparison.currentSha256 !== currentSha256 || comparison.equal !== (originalSha256 === currentSha256)) {
    throw new Error(`Semantic comparison mismatch: ${match.key}`);
  }
}
console.log("ok");
