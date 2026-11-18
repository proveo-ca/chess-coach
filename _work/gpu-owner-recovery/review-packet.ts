// SPEC: _spec/recovery.md
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repository = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const baseline = "c04a8da9468f7d443bd27d73a08c0bd7ee0e9d20";
const rust = Bun.argv[2] === "rust";
const paths = rust ? ["Cargo.toml", "Cargo.lock", "crates/gpu-owner", "packages/contracts/src/gpu-job.ts", "packages/runtime/tests/fixtures/gpu-owner", "tooling/runtime/fixtures/gpu-policy-traces.json"] : ["packages/contracts/src/gpu-job.ts", "packages/contracts/tests/gpu-job.test.ts", "packages/runtime/src/gpu-job.ts",
  "packages/runtime/src/fixed-attempt.ts", "packages/runtime/src/match-session.ts", "packages/runtime/src/training-coordinator.ts",
  "packages/runtime/tests/gpu-job.test.ts", "packages/runtime/tests/fixed-attempt-gpu-owner.test.ts", "packages/runtime/tests/gpu-policy.test.ts",
  "packages/runtime/tests/gpu-policy-conformance.test.ts", "packages/runtime/tests/reference-bundles.test.ts", "packages/runtime/tests/fixtures/gpu-owner",
  "tooling/runtime/gpu-policy.ts", "tooling/runtime/fixtures/gpu-policy-traces.json"];
function git(args: string[], expected: number) {
  const child = Bun.spawnSync(["git", "--no-replace-objects", "--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "core.hooksPath=/dev/null", ...args], {
    cwd: repository, stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 10_000,
    env: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: "/nonexistent", LANG: "C", GIT_CONFIG_NOSYSTEM: "1" },
  });
  if (child.exitCode !== expected || child.stdout.byteLength > 1_048_576 || child.stderr.byteLength) throw Error("BOUNDED_REVIEW_DIFF_REQUIRED");
  return child.stdout;
}
if ((!rust && Bun.argv.length !== 2) || (rust && Bun.argv.length !== 3) || resolve(process.cwd()) !== repository) throw Error("CLOSED_REVIEW_PACKET_REQUIRED");
await Bun.write(Bun.stdout, `baseline: ${baseline}\nscope: ${rust ? "ISOLATED_RUST_GPU_OWNER" : "STABLE_TYPESCRIPT_GPU_BOUNDARIES"}\n\n`);
await Bun.write(Bun.stdout, git(["diff", "--no-ext-diff", "--no-textconv", "--binary", baseline, "--", ...paths], 0));
const untracked = new TextDecoder().decode(git(["ls-files", "--others", "--exclude-standard", "-z", "--", ...paths], 0)).split("\0").filter(Boolean).sort();
for (const path of untracked) await Bun.write(Bun.stdout, git(["diff", "--no-index", "--no-ext-diff", "--no-textconv", "--", "/dev/null", path], 1));
