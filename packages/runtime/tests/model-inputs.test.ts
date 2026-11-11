// SPEC: _spec/match-runtime.puml, _spec/checkpoint-runtime.puml
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { expect, test } from "bun:test";
import { ModelInputs } from "../src/model-inputs";
import { syntheticRecord } from "./training-fixture";

test("serial model scratch release retains no accumulating pair and leaves private evidence untouched", () => {
  const root = mkdtempSync("/tmp/opencode/chess-coach-ii-model-inputs-"), model = syntheticRecord("synthetic-input");
  writeFileSync(`${root}/retained-private-evidence`, "retained", { flag: "wx" });
  for (let ordinal = 0; ordinal < 100; ordinal++) {
    const inputs = new ModelInputs(root, String(ordinal), model);
    expect(readFileSync(inputs.record)).toEqual(Buffer.from(model.record));
    expect(JSON.parse(readFileSync(inputs.config, "utf8"))).toEqual(model.config);
    inputs.release();
    expect(existsSync(inputs.record)).toBe(false);
    expect(() => inputs.release()).toThrow("RELEASE_CONTENTS");
  }
  expect(readdirSync(root)).toEqual(["retained-private-evidence"]);
});

test("failed model staging is not overwritten and unexpected files prevent scratch cleanup", () => {
  const root = mkdtempSync("/tmp/opencode/chess-coach-ii-model-inputs-"), model = syntheticRecord("retained-failed-input");
  const inputs = new ModelInputs(root, "failed", model);
  expect(() => new ModelInputs(root, "failed", model)).toThrow();
  writeFileSync(`${root}/attempt-failed/unknown`, "preserve", { flag: "wx" });
  expect(() => inputs.release()).toThrow("RELEASE_CONTENTS");
  expect(readFileSync(inputs.record)).toEqual(Buffer.from(model.record));
  expect(readFileSync(`${root}/attempt-failed/unknown`, "utf8")).toBe("preserve");
});
