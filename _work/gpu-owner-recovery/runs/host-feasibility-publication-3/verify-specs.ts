// SPEC: _spec/gpu-input-transfer.puml
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const directory = "_work/gpu-owner-recovery/runs/host-feasibility-publication-3";
const index = JSON.parse(await readFile("_spec/.spec-index.json", "utf8"));
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const diagrams = ["_spec/gpu-input-transfer.puml", "_spec/gpu-qualification.puml", "_spec/gpu-build.puml"];
const sources = [];
for (const path of [...diagrams, "_spec/.spec-index.json", "_spec/gpu-readiness.md", "_spec/gate-closure.md", directory + "/verify-specs.ts"]) {
  const bytes = await readFile(path);
  sources.push({ path, sha256: hash(bytes) });
  if (!diagrams.includes(path)) continue;
  const covers = [...bytes.toString().matchAll(/^' covers: (.+)$/gm)].map(match => match[1]);
  if (JSON.stringify(covers) !== JSON.stringify(index.specs.find((entry: { spec: string }) => entry.spec === path).covers)) throw Error("SPEC_INDEX_DRIFT:" + path);
}
const output = Bun.spawnSync(["/usr/bin/git", "diff", "--check"], { stdout: "pipe", stderr: "pipe", timeout: 1000 });
if (output.exitCode !== 0) throw Error("DIFF_WHITESPACE_CHECK_FAILED");
await writeFile(directory + "/spec-check.json", JSON.stringify({ version: "chess-coach.publication-outcome-spec-record-check.v1", status: "PASS_OUTCOME_SPEC_INDEX_AND_WHITESPACE_ONLY", sources,
  diagramsMatched: diagrams.length, sourceCommit: "f3e277dbbf33c0aa69172cca1890792656d4cd09", postPublicationRecordsCommitted: false,
  additionalCommitOrPushPerformed: false, hostOrGpuExecuted: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
console.log("PASS: three outcome diagram/index inventories and git diff --check; post-publication records remain local");
