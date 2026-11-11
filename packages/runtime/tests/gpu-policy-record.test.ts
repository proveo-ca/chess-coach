// SPEC: _spec/gpu-host-build.puml
import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { afterWrite, assertNativeGenerationDelta, assertRecordSliceCorrection, beforeWrite, nativePath } from "../../../_work/gpu-owner-recovery/qualification/policy-record-fix/correction";

const header = "fn cuda_f64_policy_channel_subprocesses_agree_and_reload() {";
const before = `${header}\n    let record = fixture_model(&device()).into_record().into_bytes().unwrap();\n    ${beforeWrite}\n}\n`;
const after = before.replace(beforeWrite, afterWrite);
const native = () => [{ path: nativePath, sha256: "a".repeat(64) }, ...Array.from({ length: 64 }, (_, index) => ({ path: `fixture-${index}.rs`, sha256: "a".repeat(64) }))];

test("record coercion rule accepts only the single borrowed-slice replacement", () => {
  expect(() => assertRecordSliceCorrection(before, after)).not.toThrow();
  for (const candidate of [before, after + "\n", after.replace("&*record", "record.to_vec()"), after.replace("&*record", "record.as_ref()")]) expect(() => assertRecordSliceCorrection(before, candidate)).toThrow();
});

test("record coercion rule rejects an unrelated write or duplicate write sites", () => {
  const unrelated = `fn unrelated() {\n    ${beforeWrite}\n}\n${header}\n}\n`;
  expect(() => assertRecordSliceCorrection(unrelated, unrelated.replace(beforeWrite, afterWrite))).toThrow();
  const duplicate = before.replace(beforeWrite, beforeWrite + "\n    " + beforeWrite);
  expect(() => assertRecordSliceCorrection(duplicate, duplicate.replace(beforeWrite, afterWrite))).toThrow();
});

test("actual GPU subprocess source writes the existing serialized record as a borrowed slice", async () => {
  const source = await readFile(new URL("../../../" + nativePath, import.meta.url), "utf8");
  expect(source.split(afterWrite)).toHaveLength(2);
  expect(source).not.toContain(beforeWrite);
  expect(() => assertRecordSliceCorrection(source.replace(afterWrite, beforeWrite), source)).not.toThrow();
});

test("new native generation retains all 65 members and changes only the policy GPU fixture", () => {
  const original = native(), corrected = structuredClone(original); corrected[0]!.sha256 = "b".repeat(64);
  expect(assertNativeGenerationDelta(original, corrected)).toEqual([nativePath]);
  for (const candidate of [original, corrected.slice(1), [...corrected, { path: "extra.rs", sha256: "c".repeat(64) }], [...corrected].reverse()]) expect(() => assertNativeGenerationDelta(original, candidate)).toThrow();
  corrected[1]!.sha256 = "c".repeat(64);
  expect(() => assertNativeGenerationDelta(original, corrected)).toThrow();
});
