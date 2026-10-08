// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { canonical } from "../packages/starchess-arena/src/challenge/config";
import { REPOSITORY_ROOT, sha256 } from "../packages/starchess-arena/src/challenge/corpus";
import { executionPins } from "../packages/starchess-arena/src/challenge/evidence";
import { createMigration, migrationInventoryDiagnostics } from "../packages/starchess-arena/src/challenge/pinMigration";
import { publishReport } from "../packages/starchess-arena/src/challenge/publication";
import { measureCoverage } from "../packages/starchess-arena/src/challengeContract/coverage";
import { measureR2Composition } from "./r2-composition-evidence";

const output = process.env.HERMETIC_OUTPUT_DIRECTORY ?? fileURLToPath(new URL("_spec/evidence/ml-adjutant-r2-refresh", REPOSITORY_ROOT));
const originalBytes = readFileSync(new URL("_spec/evidence/ml-adjutant-phase1/baseline-report.json", REPOSITORY_ROOT));
const verificationBytes = readFileSync(new URL("_spec/evidence/ml-adjutant-phase1/verification.json", REPOSITORY_ROOT));
const currentBytes = readFileSync(`${output}/baseline-report.json`);
const current = JSON.parse(currentBytes.toString("utf8"));
const pins = executionPins();
if (canonical(current.pins) !== canonical(pins)) throw new Error("Current baseline pins drifted");
const migration = createMigration(originalBytes, verificationBytes, currentBytes);
if (!migration.passed) throw new Error("Baseline pin migration failed semantic parity");
const coverage = measureCoverage();
const repeated = measureCoverage();
if (canonical(coverage) !== canonical(repeated)) throw new Error("Coverage rerun mismatch");
if (coverage.codecRepresentability.covered !== coverage.codecRepresentability.total ||
  coverage.featureRepresentability.covered !== coverage.featureRepresentability.total) throw new Error("Incomplete reference representability");
publishReport(`${output}/coverage.json`, coverage);
const composition = measureR2Composition();
if (canonical(composition) !== canonical(measureR2Composition())) throw new Error("R2 composition rerun mismatch");
publishReport(`${output}/r2-composition-report.json`, composition);
publishReport(`${output}/pin-migration.json`, { ...migration,
  fromPinFormat: "phase1-legacy-digests", toPinFormat: pins.version,
  ...migrationInventoryDiagnostics(pins.sourceInventory),
});
publishReport(`${output}/contract-report.json`, {
  version: "phase2-contract-report-v2", pins, coverageSha256: sha256(canonical(coverage)),
  r2CompositionVersion: composition.version, r2CompositionSha256: sha256(canonical(composition)),
  baselineReportSha256: sha256(currentBytes), phase1BaselineReportSha256: migration.originalBaselineSha256,
  migrationParity: migration.passed, coverageDeterministic: true,
  observationCodecVersion: coverage.observationCodecVersion, candidateCodecVersion: coverage.candidateCodecVersion,
  enumerationVersion: coverage.enumerationVersion, comparatorVersion: coverage.comparatorVersion,
  featureSchema: coverage.featureSchema, learnedGateEligible: false, modelArtifact: null,
});
console.log(JSON.stringify({ migrationParity: migration.passed, queues: coverage.exactQueues, intents: coverage.singletonIntents, codec: coverage.codecRepresentability, features: coverage.featureRepresentability }));
