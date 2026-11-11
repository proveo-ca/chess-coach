// SPEC: _spec/checkpoint-runtime.puml
import { z } from "zod";
import { modelConfigShape } from "./learning-channel";
import { bindingsShape, byteRefShape, countersShape, journalRefShape, masterShape } from "./training-state";

export const finalModelShape = z.strictObject({ version: z.literal("chess-coach.training-artifact.v1"), status: z.literal("VALID"), master: masterShape,
  model: modelConfigShape, recordRef: byteRefShape, configRef: byteRefShape, counters: countersShape, finalJournalRef: journalRefShape, bindings: bindingsShape })
  .refine(value => value.counters.started === 1000 && value.counters.verifiedCompleted === 1000 && value.counters.nonzeroPGUpdates >= 1 &&
    value.recordRef.sha256 === value.model.recordSha256 && value.recordRef.byteLength > 0 && value.recordRef.byteLength <= 1048576, { message: "Final model validity" });
export const experimentShape = z.strictObject({ version: z.literal("chess-coach.training-experiment.v1"), status: z.literal("COMPLETE"),
  artifacts: z.array(z.strictObject({ master: masterShape, artifactRef: byteRefShape })).length(5), primaryMaster: z.literal(101), primaryArtifactRef: byteRefShape })
  .refine(value => value.artifacts.every((entry, index) => entry.master === 101 + index) &&
    value.primaryArtifactRef.byteLength === value.artifacts[0]!.artifactRef.byteLength && value.primaryArtifactRef.sha256 === value.artifacts[0]!.artifactRef.sha256,
  { message: "Exact serial experiment roster / primary" });
export type TrainingExperiment = z.infer<typeof experimentShape>;
