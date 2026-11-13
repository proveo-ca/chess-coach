// SPEC: _spec/runtime-protocol.puml
import { test, expect } from "bun:test";
import { classify, pin, safe, parseBatch, validateText, P, D, Q, SPECS } from "./verify-publication.ts";

test("only exact task roots and specs qualify", () => {
  expect(classify(`${P}canonical.ts`, new Set())).toBe("TASK_SOURCE_AND_HISTORICAL_TEXT_EVIDENCE");
  expect(classify(SPECS[0]!, new Set())).toBe("SPEC_PROJECTION");
  expect(classify("unrelated.ts", new Set())).toBeNull();
  expect(classify("_work/gpu-owner-recovery/runs/host-gpu-full-source-4/continuation-source-1/home/secret.json", new Set())).toBeNull();
});
for (const part of ["fixtures", "compiler-output", "home", "tmp", "cache", "target", "node_modules", "__pycache__", "scratch"]) test(`exclude generated ${part} trees`, () => {
  expect(classify(`${P}verification-1/${part}/input.json`, new Set())).toBeNull();
});
test("admit exact pinned fixture members without admitting fixture workspaces", () => {
  const p = `${D}local-inputs-1/inputs/reference/packages/ui/tests/fixtures/trace.json`;
  expect(classify(p, new Set([p]))).toBe("ORIGINAL_PINNED_APPLICATION_OR_CORPUS_INPUT");
  expect(classify(p, new Set())).toBeNull();
  expect(classify(`${P}verification-1/fixtures/unsafe @name.json`, new Set())).toBeNull();
});
test("late receipts and manifest controls never enter the recursive content table", () => {
  for (const n of ["paths.nul", "cohort.json", "freeze-observation.json", "stage-check.json", "push.stdout", "operator-command.fish"]) expect(classify(Q + n, new Set())).toBeNull();
});
for (const p of ["/absolute", "../escape", "a/../b", "a//b", "a\\b", "a\0b", "a/./b"]) test(`reject nonliteral path ${JSON.stringify(p)}`, () => expect(() => safe(p)).toThrow());
for (const ext of ["tgz", "gz", "zip", "bpk", "o", "so", "rlib", "rmeta", "exe"]) test(`reject unclassified binary or archive ${ext}`, () => expect(() => classify(`${P}payload.${ext}`, new Set())).toThrow());
test("batch validates exact staged bytes including empty blobs", () => {
  const bytes = Buffer.from("source\n"), empty = Buffer.alloc(0), rows = [bytes, empty].map((b, i) => ({ path: `p${i}`, classification: "TEST", mode: "100644", ...pin(b) }));
  const encoded = Buffer.concat(rows.flatMap((r, i) => [Buffer.from(`${r.gitBlobOid} blob ${r.bytes}\n`), [bytes, empty][i]!, Buffer.from("\n")]));
  expect(() => parseBatch(encoded, rows)).not.toThrow();
  expect(() => parseBatch(Buffer.concat([encoded, Buffer.from("extra")]), rows)).toThrow();
  expect(() => parseBatch(encoded.subarray(0, -1), rows)).toThrow();
  const wrong = Buffer.from(encoded); wrong[wrong.indexOf(10) + 1] = 88;
  expect(() => parseBatch(wrong, rows)).toThrow();
});
test("preserve captured UTF-8 test labels containing NUL without admitting binary source", () => {
  const bytes = Buffer.from("(pass) rejects path a\0b.ts\n");
  expect(() => validateText("tests.stderr", bytes)).not.toThrow();
  expect(() => validateText("capture.ts", bytes)).toThrow();
  expect(() => validateText("tests.stderr", Buffer.from([255]))).toThrow();
  expect(() => validateText("tests.stderr", Buffer.from([127, 69, 76, 70]))).toThrow();
  expect(() => validateText("tests.stderr", Buffer.alloc(65))).toThrow();
});
