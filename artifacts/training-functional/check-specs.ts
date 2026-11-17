// SPEC: _spec/runtime-protocol.puml, _spec/checkpoint-runtime.puml
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const paths = ["_spec/checkpoint-runtime.puml", "_spec/runtime-protocol.puml", "_spec/qualification-bootstrap.puml"];
const indexPath = "_spec/.spec-index.json";
const index = JSON.parse(readFileSync(resolve(root, indexPath), "utf8")) as { specs: { spec: string; covers: string[] }[] };
const rows = paths.map(path => {
  const source = readFileSync(resolve(root, path), "utf8");
  if (!source.startsWith("@startuml ") || !/^@enduml\s*$/m.test(source) || !source.includes("!include https://raw.githubusercontent.com/proveo-ca/identity/main/proveo.puml")) {
    throw new Error(`Spec check: ENVELOPE:${path}`);
  }
  const covers = [...source.matchAll(/^' covers: (.+)$/gm)].map(match => match[1]!);
  const entries = index.specs.filter(entry => entry.spec === path);
  if (entries.length !== 1 || JSON.stringify(entries[0]!.covers) !== JSON.stringify(covers) || covers.length === 0) throw new Error(`Spec check: INDEX:${path}`);
  for (const pattern of covers) {
    if (pattern.startsWith("/") || pattern.split("/").includes("..")) throw new Error(`Spec check: PATH:${pattern}`);
    let found = false;
    for (const _file of new Bun.Glob(pattern.endsWith("/**") ? `${pattern}/*` : pattern).scanSync({ cwd: root, onlyFiles: true, followSymlinks: false })) { found = true; break; }
    if (!found) throw new Error(`Spec check: COVERAGE:${pattern}`);
  }
  let notes = 0;
  for (const match of source.matchAll(/^note[^\n]*\n([\s\S]*?)^end note/gm)) {
    const lines = match[1]!.trimEnd().split("\n");
    if (lines.length < 2 || lines.length > 5 || lines.some(line => line.trim().length > 50)) throw new Error(`Spec check: NOTE_BOUND:${path}`);
    notes++;
  }
  return { path, covers, notes, sha256: createHash("sha256").update(source).digest("hex") };
});
const sources = ["packages/runtime/src/training-campaign.ts", "packages/runtime/src/training-coordinator.ts",
  "packages/runtime/tests/training-campaign.test.ts", "packages/runtime/tests/training-coordinator.test.ts", "packages/runtime/tests/repository-scratch.ts",
  ...new Bun.Glob("artifacts/training-functional/*.ts").scanSync({ cwd: root, onlyFiles: true, followSymlinks: false })];
for (const path of sources) {
  const lines = readFileSync(resolve(root, path), "utf8").split("\n");
  const adapters = ["artifacts/training-functional/qualification-policy-score.ts", "artifacts/training-functional/qualification-policy-channel.ts"];
  const header = adapters.includes(path) && lines[0] === "#!/usr/local/bin/bun" ? lines[1]! : lines[0]!;
  if (!header.startsWith("// SPEC: ")) throw new Error(`Spec check: POINTER:${path}`);
  for (const pointer of header.slice("// SPEC: ".length).split(", ")) if (!existsSync(resolve(root, pointer))) throw new Error(`Spec check: MISSING_SPEC:${path}`);
}
console.log(JSON.stringify({ status: "PASS_STATIC_SPEC_ENVELOPES_COVERAGE_NOTES_AND_POINTERS_ONLY", diagrams: rows, sourcePointers: sources.length,
  indexSha256: createHash("sha256").update(readFileSync(resolve(root, indexPath))).digest("hex"), rendered: false,
  renderSkipReason: "Native PlantUML requires Java and remote theme access outside the Bun/TypeScript-or-Rust-only task scope" }));
