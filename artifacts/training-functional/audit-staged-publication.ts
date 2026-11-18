// SPEC: _spec/runtime-protocol.puml
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url)), original = "/home/gu1lty/Projects/proveo/chess-coach";
const label = Bun.argv[2];
if (Bun.argv.length !== 3 || !/^[a-z0-9][a-z0-9-]{0,40}$/.test(label ?? "")) throw new Error("Publication audit: LABEL");
const git = (args: string[], input?: string) => {
  const result = Bun.spawnSync(["git", "--no-pager", "--no-optional-locks", ...args], { cwd: root, stdin: input === undefined ? "ignore" : Buffer.from(input), stdout: "pipe", stderr: "pipe", timeout: 30000,
    env: { PATH: "/usr/local/bin:/usr/bin:/bin", GIT_NO_LAZY_FETCH: "1" } });
  if (result.exitCode !== 0 || result.stderr.length || result.stdout.length > 64 * 1024 * 1024) throw new Error("Publication audit: GIT_READ");
  return result.stdout;
};
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const exact = new Set([".gitignore", "_spec/.spec-index.json", "_spec/checkpoint-runtime.puml", "_spec/readiness.md", "_spec/runtime-protocol.puml",
  "packages/runtime/src/training-coordinator.ts", "packages/runtime/src/training-campaign.ts", "packages/runtime/tests/training-coordinator.test.ts",
  "packages/runtime/tests/training-campaign.test.ts", "packages/runtime/tests/training-fixture.ts", "packages/runtime/tests/repository-scratch.ts"]);
const paths = new TextDecoder().decode(git(["diff", "--cached", "--no-renames", "--name-only", "-z"])).split("\0").filter(Boolean);
if (!paths.length || paths.length > 1024 || new Set(paths).size !== paths.length) throw new Error("Publication audit: MEMBERSHIP");
const entries = new TextDecoder().decode(git(["ls-files", "--stage", "-z", "--", ...paths])).split("\0").filter(Boolean).map(row => {
  const match = /^(100644|100755) ([a-f0-9]{40}) 0\t(.+)$/.exec(row);
  if (!match) throw new Error("Publication audit: INDEX_ENTRY");
  return { mode: match[1]!, oid: match[2]!, path: match[3]! };
});
if (entries.length !== paths.length) throw new Error("Publication audit: INDEX_MEMBERSHIP");
const blobs = git(["cat-file", "--batch"], entries.map(row => row.oid).join("\n") + "\n");
let offset = 0, total = 0;
const forbidden = /(?:^|\/)(?:scratch|cache|node_modules|bundles|target|\.cache)(?:\/|$)|\.(?:tgz|tar|gz|zip|bpk|sqlite(?:-[a-z]+)?|wasm|so|rlib|rmeta)$/;
const credentials = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|AKIA[0-9A-Z]{16}/;
const upstreamModules = new Set(["artifacts/training-functional/reference-inputs/fflate-esm-index.mjs", "artifacts/training-functional/reference-inputs/jssha-dist-sha256.mjs"]);
const files = entries.map(entry => {
  if ((!exact.has(entry.path) && !entry.path.startsWith("artifacts/training-functional/")) || forbidden.test(entry.path)) throw new Error(`Publication audit: SCOPE:${entry.path}`);
  if (/\.[cm]?js$/.test(entry.path) && !upstreamModules.has(entry.path)) throw new Error(`Publication audit: UNAPPROVED_MODULE:${entry.path}`);
  const end = blobs.indexOf(10, offset), header = blobs.subarray(offset, end).toString("ascii");
  const match = /^([a-f0-9]{40}) blob ([0-9]+)$/.exec(header);
  if (end < offset || !match || match[1] !== entry.oid) throw new Error("Publication audit: BLOB_HEADER");
  const length = Number(match[2]); offset = end + 1;
  if (length > 16 * 1024 * 1024 || (total += length) > 64 * 1024 * 1024 || offset + length >= blobs.length) throw new Error("Publication audit: BYTE_BOUND");
  const bytes = blobs.subarray(offset, offset + length); offset += length;
  if (blobs[offset++] !== 10 || bytes.includes(0)) throw new Error(`Publication audit: BINARY:${entry.path}`);
  const info = lstatSync(resolve(root, entry.path));
  if (!info.isFile() || sha(bytes) !== sha(readFileSync(resolve(root, entry.path)))) throw new Error(`Publication audit: WORKTREE_DRIFT:${entry.path}`);
  if (credentials.test(bytes.toString("utf8"))) throw new Error(`Publication audit: CREDENTIAL_INDICATOR:${entry.path}`);
  return { ...entry, bytes: length, sha256: sha(bytes) };
});
if (offset !== blobs.length) throw new Error("Publication audit: BLOB_TRAILER");
const retained = JSON.parse(readFileSync(resolve(root, "artifacts/training-functional/reference-inputs/manifest.json"), "utf8")) as { files: { path: string; bytes: number; sha256: string }[] };
for (const row of retained.files) if (!files.some(file => file.path === row.path && file.bytes === row.bytes && file.sha256 === row.sha256)) throw new Error("Publication audit: RETAINED_INPUT");
const command = JSON.parse(readFileSync(resolve(root, "artifacts/training-functional/host-facts-1/command-verification-2.json"), "utf8")) as { source: { path: string; sha256: string }; command: { path: string; sha256: string } };
for (const row of [command.source, command.command]) if (!files.some(file => file.path === row.path && file.sha256 === row.sha256)) throw new Error("Publication audit: OPERATOR_BYTES");
for (const [path, expected] of [["source-acceptance.json", "aa4757f80864996dea6e030cd920fddbd8331403f004006af1ac511a0b33eb90"], ["source-acceptance-2.json", "b12bf0da43401b1858a3b3f1c3be9820d8030b6f07329e9448239886c5911e70"]]) {
  if (!files.some(file => file.path === `artifacts/training-functional/${path}` && file.sha256 === expected)) throw new Error("Publication audit: IMMUTABLE_ACCEPTANCE");
}
const originalStatus = new TextDecoder().decode(git(["-C", original, "status", "--porcelain=v1", "-z", "--untracked-files=no"]));
const originalPaths = [".gitignore", "README.md", "_spec/.spec-index.json", "_spec/manual-handoff-implementation-3.puml", "_spec/runtime-protocol.puml"];
if (JSON.stringify(originalStatus.split("\0").filter(Boolean).map(row => row.slice(3)).sort()) !== JSON.stringify([...originalPaths].sort())) throw new Error("Publication audit: ORIGINAL_STATUS");
const originalPins = originalPaths.map(path => { const bytes = readFileSync(resolve(original, path)); return { path, bytes: bytes.length, sha256: sha(bytes) }; });
const whitespaceExemptions = ["artifacts/training-functional/checks/host-review-red-1/command.stderr", "artifacts/training-functional/checks/r4-review-red-1/r4/command.stderr", "artifacts/training-functional/reference-inputs/jssha-LICENSE"];
const receipt = { status: "PASS_EXACT_STAGED_COHORT_AND_RETAINED_INPUT_BYTES", head: new TextDecoder().decode(git(["rev-parse", "HEAD"])).trim(), files, fileCount: files.length, stagedBytes: total,
  stagedDiffCheck: new TextDecoder().decode(git(["diff", "--cached", "--check", "--", ".", ...whitespaceExemptions.map(path => `:(exclude)${path}`)])),
  whitespaceExemptions: { paths: whitespaceExemptions, reason: "Preserve raw failure output and exact upstream license bytes; all staged hashes and other checks still apply" },
  originalCheckout: { root: original, status: originalStatus, pins: originalPins },
  credentialScan: "NO_HIGH_CONFIDENCE_PRIVATE_KEY_OR_GITHUB_AWS_TOKEN_INDICATORS_NOT_A_GENERAL_SECRET_AUDIT", operatorQueryExecuted: false, trainingReady: false };
const output = resolve(root, "artifacts/training-functional/host-facts-1", `${label}.json`);
writeFileSync(output, JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
console.log("Executor: " + JSON.stringify({ status: receipt.status, fileCount: files.length, stagedBytes: total, originalCheckoutPaths: originalPins.length, receipt: output }));
