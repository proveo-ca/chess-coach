// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import { createHash } from "node:crypto";
import { it } from "vitest";
import { composeCandidatesFromObservationV1 } from "../candidates";
import { allActors } from "./fixtures";

it("records pre-extraction complete V1 batch bytes", () => {
  for (const side of ["w", "b"] as const) {
    for (const count of [0, 1, 2, 3]) {
      const o = allActors(side);
      o.own.mines = (["a4", "a5", "a6"] as const).slice(0, count);
      const bytes = JSON.stringify(composeCandidatesFromObservationV1(o));
      console.info("Executor, V1 baseline", side, count, createHash("sha256").update(bytes).digest("hex"));
    }
  }
});
