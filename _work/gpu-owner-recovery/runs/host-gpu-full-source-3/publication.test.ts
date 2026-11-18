// SPEC: _spec/gpu-full-qualification.puml
import { expect, test } from "bun:test";
import { allowed, blob, post, publicationRef, pushArgv, reviewedMode, root, validateReviewBinding } from "./publication";

test("publication scope admits only bounded task text paths", () => {
  for (const path of ["_spec/gpu-full-qualification.puml", root + "host-command.fish", root + "publication-request.json", root + "full-unit/command.stderr", "_work/gpu-owner-recovery/qualification/host-full/driver.ts"]) expect(allowed(path)).toBe(true);
  for (const path of ["package.json", root + "home/cache.json", root + "tmp/command.stdout", root + "../other.json", root + "policy-channel", root + "archive.tar", root + "scratch/input.json", "_work/gpu-owner-recovery/cache/native/source.json"]) expect(allowed(path)).toBe(false);
});
test("expected Git blob identity uses the exact raw bytes", () => {
  expect(blob(Buffer.from(""))).toBe("e69de29bb2d1d6434b8b29ae775ad8c2e48c5391");
  expect(blob(Buffer.from("hello\n"))).toBe("ce013625030ba8dba906f756967f9e9ca394464a");
});
test("publication pushes only the fixed HTTPS branch without tags, submodule pushes or force", () => {
  const commit = "a".repeat(40), argv = pushArgv(commit);
  expect(argv).toEqual(["git", "push", "--porcelain", "--no-follow-tags", "--recurse-submodules=no", "https://github.com/proveo-ca/chess-coach.git", commit + ":refs/heads/feat-ml-adjuntant-ii"]);
  expect(argv.join(" ")).not.toMatch(/--force|--no-verify|--amend|ssh:|git@/);
});
test("a READY review must bind the exact current check path, content and mode", () => {
  const expected = { path: root + "publication-check-2.json", sha256: "a".repeat(64), mode: "100644" };
  expect(() => validateReviewBinding({ status: "READY_TO_PUBLISH_EXACT_BOUNDED_TEXT_GENERATION", check: expected }, expected)).not.toThrow();
  for (const change of [{ path: root + "publication-check.json" }, { sha256: "b".repeat(64) }, { mode: "100755" }]) expect(() => validateReviewBinding({ status: "READY_TO_PUBLISH_EXACT_BOUNDED_TEXT_GENERATION", check: { ...expected, ...change } }, expected)).toThrow();
  expect(() => validateReviewBinding({ status: "NOT_READY", check: expected }, expected)).toThrow();
});
test("reviewed executable-mode changes fail before envelope regeneration", async () => {
  expect(() => reviewedMode("100644", 0o100644)).not.toThrow(); expect(() => reviewedMode("100755", 0o100755)).not.toThrow();
  expect(() => reviewedMode("100644", 0o100755)).toThrow("REVIEWED_MODE_CHANGED"); expect(() => reviewedMode("100755", 0o100644)).toThrow("REVIEWED_MODE_CHANGED");
  expect(await publicationRef(root + "publication-request.json")).toMatchObject({ path: root + "publication-request.json", mode: "100644" });
});
test("post-action exclusion is narrow and preserves earlier publication history", () => {
  expect(post(root + "publication-actions/commit/command.stdout")).toBe(true); expect(post(root + "publication-result.json")).toBe(true);
  expect(post("_work/gpu-owner-recovery/runs/host-gpu-feasibility-source-4/publication-actions/push/command.stdout")).toBe(false);
  expect(post(root + "publication-check-2.json")).toBe(false);
});
