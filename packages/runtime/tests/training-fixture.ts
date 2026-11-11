// SPEC: _spec/checkpoint-runtime.puml
import { createHash } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { bindingsShape } from "../../contracts/src/training-state";
import type { TrainingState } from "../../contracts/src/training-state";
import { TrainingStore } from "../src/training-store";
import type { CompletionValues, NativeRecord } from "../src/training-store";
import { drawStream } from "../src/rng";

export const byteRef = (label = "synthetic") => ({ byteLength: label.length, sha256: createHash("sha256").update(label).digest("hex") });
export function bindings() {
  return bindingsShape.parse(Object.fromEntries(["source", "tests", "closure", "dependencyLock", "image", "runtimeConfiguration", "coreRules", "strategicSource",
    "corpusManifest", "corpusSource", "recipe", "featureLayout", "fixtureManifest", "hostConfiguration"].map(key => [key, byteRef(key)])));
}
export function syntheticRecord(label: string): NativeRecord {
  const record = Buffer.from(label);
  return { record, config: { version: "chess-coach.model-config.v1", architecture: "mlp-relu-32", featureVersion: "chess-coach.features.v1",
    inputFeatures: 2271, hiddenUnits: 32, recordSha256: createHash("sha256").update(record).digest("hex") } };
}
export function storeFixture() {
  const root = mkdtempSync("/tmp/opencode/chess-coach-ii-sqlite-fixture-"), path = `${root}/private.sqlite`, selected = syntheticRecord("synthetic-initial-record-not-a-burn-model");
  return { root, path, selected, store: new TrainingStore(path, bindings()) };
}
export function syntheticCompletion(state: TrainingState, samples: number, reward: -1 | 0 | 1, proposal: NativeRecord | null): CompletionValues {
  const rngAfter = structuredClone(state.rng);
  for (let i = 0; i < samples; i++) rngAfter["policy-sampling"] = drawStream(rngAfter["policy-sampling"]).after;
  const baseline = state.counters.baselineCount ? state.counters.baselineSum / state.counters.baselineCount : 0;
  return { reason: "core-terminal", returnValue: reward, sampledDecisions: samples, nonzeroPolicyGradient: samples > 0 && reward !== baseline,
    rngAfter, journalRef: { byteLength: (state.journalRef?.byteLength ?? 0) + 10, lastRecordOrdinal: (state.journalRef?.lastRecordOrdinal ?? 0) + 1, sha256: byteRef(String(state.counters.started)).sha256 },
    historyRef: byteRef(`synthetic-history-${state.counters.started}`), proposalRef: proposal ? { byteLength: proposal.record.byteLength, sha256: proposal.config.recordSha256 } : null };
}
