// SPEC: _spec/runtime-protocol.puml
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const root = "/home/gu1lty/Projects/proveo/chess-coach";
const record = "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-1/bun-spec-check-1";
const documents = ["_spec/.spec-index.json", "_spec/runtime-protocol.puml", "_spec/gpu-qualification.puml", "_spec/gpu-full-qualification.puml", "_spec/gpu-readiness.md", "_spec/gate-closure.md", "_spec/readiness.md"];
function requireValue(value: unknown, code: string): asserts value { if (!value) throw new Error(code); }
const hash = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");
const sources = () => [...documents, `${record}/check.ts`].map(path => { const data = readFileSync(`${root}/${path}`); return { path, bytes: data.length, sha256: hash(data) }; });
const save = (name: string, value: unknown) => writeFileSync(`${root}/${record}/${name}`, JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
function git(label: string, args: string[]): string {
  const result = spawnSync("/usr/bin/git", ["--no-optional-locks", "-c", "core.fsmonitor=false", ...args], { cwd: root, env: { PATH: "/usr/bin:/bin", LANG: "C.UTF-8", GIT_TERMINAL_PROMPT: "0" }, timeout: 10000, maxBuffer: 512 * 1024 });
  writeFileSync(`${root}/${record}/${label}.stdout`, result.stdout, { flag: "wx" });
  writeFileSync(`${root}/${record}/${label}.stderr`, result.stderr, { flag: "wx" });
  requireValue(!result.error && result.status === 0 && result.signal === null, `git:${label}`);
  return result.stdout.toString("utf8");
}
requireValue(Bun.version === "1.4.0" && process.cwd() === root, "pinned-bun-root");
const before = sources();
let failure: string | null = null;
try {
  const index = JSON.parse(readFileSync(`${root}/${documents[0]}`, "utf8"));
  requireValue(index.unresolved.length === 0 && index.specs.every((row: { covers: string[] }) => row.covers.length > 0), "index");
  for (const path of documents.slice(1)) {
    const text = readFileSync(`${root}/${path}`, "utf8");
    for (const token of ["implementation-choice1.json", "package-acquisition-bun-source1", "node:https", "node:zlib", "USTAR/PAX/GNU", "APPROVED_UNUSED", "104", "85", "trainingReady:false"]) requireValue(text.includes(token), `projection:${path}:${token}`);
    requireValue(/Python[^\n]*(?:STOPPED|stays preserved STOPPED)|STOPPED Python/.test(text), `python-history:${path}`);
    if (path.endsWith(".puml")) {
      requireValue((text.match(/@startuml/g) ?? []).length === 1 && (text.match(/@enduml/g) ?? []).length === 1, `diagram-delimiters:${path}`);
      const entry = index.specs.find((row: { spec: string }) => row.spec === path);
      requireValue(entry && JSON.stringify([...text.matchAll(/^' covers: (.+)$/gm)].map(match => match[1])) === JSON.stringify(entry.covers), `coverage:${path}`);
    }
  }
  const changed = git("changed", ["diff", "--name-only"]).trim().split("\n");
  const staged = git("staged", ["diff", "--cached", "--name-only"]).trim();
  requireValue(staged === "" && JSON.stringify(changed.sort()) === JSON.stringify([...documents].sort()), "tracked-change-scope");
  git("whitespace", ["diff", "--check", "--", ...documents]);
  git("spec-diff", ["diff", "--no-ext-diff", "--no-textconv", "HEAD", "--", ...documents]);
  requireValue(JSON.stringify(before) === JSON.stringify(sources()), "source-drift");
} catch (error) { failure = String(error); }
save("source-manifest.json", before);
const receipt = { status: failure ? "FAIL_BUN_SPEC_PROJECTION_CHECK" : "PASS_BUN_SPEC_PROJECTION_CHECK_ONLY", failure, documents: documents.length, specKeeperSession: "ses_e2e5aadc9ffe9zYkj9TmiJco3i", diagramCheck: "LOCAL_DELIMITERS_AND_COVERAGE_NOT_RENDERED", actualBunHelperVerified: false, actualAcquisitionInvoked: false, actualNetworkInvoked: false, publicationPerformed: false, approvalConsumedOrRenewed: false, trainingReady: false };
save("receipt.json", receipt);
console.log(JSON.stringify(receipt));
process.exitCode = failure ? 1 : 0;
