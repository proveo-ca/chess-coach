// SPEC: _spec/recovery.md
import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repository = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const baseline = "c04a8da9468f7d443bd27d73a08c0bd7ee0e9d20";
const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
function git(cwd: string, ...args: string[]) {
  return Bun.spawnSync(["git", "--no-replace-objects", "--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "core.hooksPath=/dev/null", ...args], {
    cwd, stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 10_000,
    env: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: "/nonexistent", LANG: "C", GIT_CONFIG_NOSYSTEM: "1" },
  });
}

test("lock audit authenticates the original baseline despite checksum-substituting replacement refs", () => {
  const scratch = resolve(repository, "_work/gpu-owner-recovery/scratch");
  mkdirSync(scratch, { recursive: true, mode: 0o700 });
  const root = mkdtempSync(resolve(scratch, "audit-objects-"));
  expect(git(repository, "clone", "--shared", "--no-checkout", "--", repository, root).exitCode).toBe(0);
  expect(git(root, "read-tree", baseline).exitCode).toBe(0);
  const frozen = git(root, "ls-tree", "-r", "--name-only", "-z", baseline, "--", "Cargo.toml", "Cargo.lock", "tooling/runtime", "crates/host-facts", "packages/runtime/src/job.ts", "packages/contracts/src/training-state.ts", "packages/contracts/src/episode.ts", "crates/policy-io/src/bin/policy-initialize.rs", "package.json", "bun.lock");
  expect(frozen.exitCode).toBe(0);
  expect(git(root, "checkout-index", "--", ...text(frozen.stdout).split("\0").filter(Boolean)).exitCode).toBe(0);
  const scripts = resolve(root, "_work/gpu-owner-recovery");
  mkdirSync(scripts, { recursive: true, mode: 0o700 });
  for (const name of ["audit-lock.ts", "provision.ts", "verify.ts"]) writeFileSync(resolve(scripts, name), readFileSync(resolve(repository, "_work/gpu-owner-recovery", name)), { flag: "wx", mode: 0o600 });
  writeFileSync(resolve(root, "Cargo.toml"), readFileSync(resolve(repository, "Cargo.toml")));
  const approved = readFileSync(resolve(repository, "Cargo.lock"), "utf8");
  writeFileSync(resolve(root, "Cargo.lock"), approved);
  const audit = (script: string, label: string) => Bun.spawnSync([process.execPath, "--no-env-file", "--no-install", resolve(scripts, script), label], {
    cwd: root, stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 20_000,
    env: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: root, TMPDIR: root, LANG: "C", BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0" },
  });
  const clean = audit("audit-lock.ts", "clean-baseline");
  expect(clean.exitCode).toBe(0);
  const baselineBytes = git(root, "show", `${baseline}:Cargo.lock`);
  expect(baselineBytes.exitCode).toBe(0);
  const original = text(baselineBytes.stdout);
  const packages = (Bun.TOML.parse(original) as { package: { name: string; checksum?: string }[] }).package;
  const checksum = packages.find(item => item.name === "sha2")!.checksum!;
  const substituted = (checksum.startsWith("a") ? "b" : "a") + checksum.slice(1);
  writeFileSync(resolve(root, "Cargo.lock"), original.replace(checksum, substituted));
  expect(git(root, "add", "--", "Cargo.lock").exitCode).toBe(0);
  const tree = git(root, "write-tree");
  expect(tree.exitCode).toBe(0);
  const replacement = git(root, "-c", "user.name=Synthetic fixture", "-c", "user.email=fixture@example.invalid", "commit-tree", text(tree.stdout).trim(), "-p", baseline, "-m", "synthetic lock replacement");
  expect(replacement.exitCode).toBe(0);
  expect(git(root, "replace", baseline, text(replacement.stdout).trim()).exitCode).toBe(0);
  writeFileSync(resolve(root, "Cargo.lock"), approved.replace(checksum, substituted));
  const guardedSource = readFileSync(resolve(scripts, "audit-lock.ts"), "utf8");
  const previousSource = guardedSource.replace('"--no-replace-objects", ', "");
  expect(previousSource).not.toBe(guardedSource);
  writeFileSync(resolve(scripts, "previous-audit.ts"), previousSource, { flag: "wx", mode: 0o600 });
  expect(audit("previous-audit.ts", "replacement-enabled").exitCode).toBe(0);
  const rejected = audit("audit-lock.ts", "original-baseline-required");
  expect(rejected.exitCode).not.toBe(0);
  expect(text(rejected.stderr)).toContain("UNAPPROVED_LOCK_DELTA");
}, 30_000);
