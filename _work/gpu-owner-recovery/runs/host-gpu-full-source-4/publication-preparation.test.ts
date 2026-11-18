// SPEC: _spec/gpu-full-qualification.puml
import { expect, test } from "bun:test";
import { allowed, blob, branch, destination, documents, localOnly, parent, pushArgv, readArgv, root, sha256, sourceFiles, validateText } from "./publication-preparation";

test("generation four fixes parent, branch, destination and sixteen source-document members", () => {
  expect(parent).toBe("3d35125bdcf27542e6a0ad266a9ed118f9d14658"); expect(branch).toBe("feat-ml-adjuntant-ii"); expect(destination).toBe("https://github.com/proveo-ca/chess-coach.git");
  expect(documents).toHaveLength(12); expect(sourceFiles).toHaveLength(4); expect([...documents, ...sourceFiles].every(allowed)).toBe(true);
  expect(allowed("_work/gpu-owner-recovery/qualification/host-full/host.ts")).toBe(false);
});
test("candidate scope admits actual text history without caches binaries or unrelated source", () => {
  for (const name of ["host-gpu-full-observation-1/observation.json", "host-gpu-full-cadence-red-1/snapshots/0-driver.ts.txt", "host-gpu-full-cadence-green-1/receipt.json", "host-gpu-full-source-4/host-program.mjs", "host-gpu-full-source-3/publication-actions/push/command.stdout", "host-gpu-full-source-3/host-command-retry-review-1.json"]) expect(allowed("_work/gpu-owner-recovery/runs/" + name)).toBe(true);
  for (const path of [root + "home/key.json", root + "tmp/a.txt", root + "target/a.json", root + "scratch/x.json", root + "cache/a.json", root + "../outside.json", root + "a.tar", root + "worker", "Cargo.toml", "crates/policy-io/src/lib.rs", "_work/gpu-owner-recovery/runs/host-gpu-full-2/receipt.json", "_work/gpu-owner-recovery/runs/host-gpu-full-source-3/receipt.json"]) expect(allowed(path)).toBe(false);
});
test("self metadata and later action receipts remain local while prior action history stays eligible", () => {
  for (const name of ["publication-envelope.json", "publication-request.json", "publication-preparation-check.json", "publication-preparation-verification.json", "publication-review.json", "publication-approval.json", "publication-result.json", "publication-actions/push/command.stdout", "publication-preparation-actions/tracked/command.stdout"]) expect(localOnly(root + name)).toBe(true);
  expect(localOnly(root + "publication-preparation-selection.json")).toBe(false); expect(localOnly(root + "publication-preparation.ts")).toBe(false);
  expect(localOnly("_work/gpu-owner-recovery/runs/host-gpu-full-source-3/publication-result.json")).toBe(false);
});
test("bounded text validation rejects binary invalid UTF-8 and oversize content", () => {
  expect(() => validateText(Buffer.from("text\n"))).not.toThrow(); expect(() => validateText(Buffer.from([0]))).toThrow();
  expect(() => validateText(Buffer.from([255]))).toThrow(); expect(() => validateText(Buffer.alloc(4194305, 65))).toThrow();
  expect(sha256(Buffer.from(""))).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"); expect(blob(Buffer.from(""))).toBe("e69de29bb2d1d6434b8b29ae775ad8c2e48c5391");
});
test("read-only discovery compares HEAD and exposes no write or publication subcommand", () => {
  expect(readArgv.tracked).toEqual(["git", "diff", "--name-only", "HEAD", "--"]);
  for (const argv of Object.values(readArgv)) expect(["rev-parse", "symbolic-ref", "diff", "ls-files"]).toContain(argv[1]!);
});
test("fixed HTTPS push template accepts only a full commit SHA and never a transport fallback", () => {
  const commit = "1".repeat(40); expect(pushArgv(commit)).toEqual(["git", "push", "--porcelain", "--no-follow-tags", "--recurse-submodules=no", destination, commit + ":refs/heads/" + branch]);
  for (const value of ["HEAD", "--force", "a".repeat(39), "x".repeat(40), "1".repeat(40) + ";touch x"]) expect(() => pushArgv(value)).toThrow();
});
