// SPEC: _spec/runtime-protocol.puml
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type InputFile = { path: string; byteLength: number; sha256: string };
const root = fileURLToPath(new URL("../../", import.meta.url)), Q = "artifacts/training-functional/qualification-packet-1";
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const packages = ["contracts", "policy", "starchess-core"] as const;
const entries = ["artifacts/training-functional/qualification-operator.ts", "artifacts/training-functional/qualification-evidence.ts",
  "artifacts/training-functional/qualification-policy-score.ts", "artifacts/training-functional/qualification-policy-channel.ts",
  "packages/runtime/src/game-worker.ts", "packages/runtime/src/reference-worker.ts", "packages/runtime/src/match-worker-main.ts"];
const read = (base: string, path: string, cap = 8 * 1024 * 1024) => {
  const absolute = resolve(base, path), rel = relative(base, absolute);
  if (!rel || rel.startsWith("../") || isAbsolute(rel)) throw new Error("Qualification inputs: PATH");
  const info = lstatSync(absolute);
  if (!info.isFile() || info.size > cap || !realpathSync(absolute).startsWith(realpathSync(base) + "/")) throw new Error("Qualification inputs: FILE");
  return readFileSync(absolute);
};
const pin = (base: string, path: string, cap?: number): InputFile => { const bytes = read(base, path, cap); return { path, byteLength: bytes.length, sha256: sha(bytes) }; };

export function inspectQualificationSource(base: string, seeds: readonly string[] = entries) {
  if (!isAbsolute(base) || !seeds.length || seeds.length > 32) throw new Error("Qualification inputs: CONTEXT");
  const aliases = new Map(packages.map(name => {
    const path = `packages/${name}/package.json`, value: unknown = JSON.parse(read(base, path).toString());
    if (!value || typeof value !== "object" || !("name" in value) || value.name !== `@chess-coach/${name}` || !("exports" in value) || !value.exports || typeof value.exports !== "object") throw new Error("Qualification inputs: PACKAGE");
    return [`@chess-coach/${name}`, { directory: `packages/${name}`, exports: value.exports as Record<string, unknown> }] as const;
  }));
  const selected = new Map<string, InputFile>(), external = new Set<string>(), references = new Set<string>(), pending = [...seeds, ...packages.map(name => `packages/${name}/package.json`)];
  let total = 0;
  const locate = (path: string) => {
    const absolute = resolve(base, path), rel = relative(base, absolute);
    if (isAbsolute(path) || rel.startsWith("../") || isAbsolute(rel)) throw new Error("Qualification inputs: IMPORT_PATH");
    for (const item of [rel, `${rel}.ts`, `${rel}.tsx`, `${rel}.json`, `${rel}/index.ts`, ...(rel.endsWith(".js") ? [rel.slice(0, -3) + ".ts"] : [])]) {
      if (!existsSync(resolve(base, item))) continue;
      const info = lstatSync(resolve(base, item));
      if (info.isSymbolicLink()) throw new Error("Qualification inputs: FILE");
      if (info.isFile()) return item;
    }
    throw new Error(`Qualification inputs: MISSING_IMPORT:${rel}`);
  };
  while (pending.length) {
    const path = locate(pending.pop()!);
    if (selected.has(path)) continue;
    const bytes = read(base, path, 4 * 1024 * 1024);
    if (selected.size >= 1024 || (total += bytes.length) > 32 * 1024 * 1024) throw new Error("Qualification inputs: SOURCE_BOUND");
    selected.set(path, { path, byteLength: bytes.length, sha256: sha(bytes) });
    if (path.endsWith(".json")) { JSON.parse(bytes.toString()); continue; }
    const adapter = ["artifacts/training-functional/qualification-policy-score.ts", "artifacts/training-functional/qualification-policy-channel.ts"].includes(path);
    const header = Buffer.from("#!/usr/local/bin/bun\n"), parserBytes = adapter && bytes.subarray(0, header.length).equals(header) ? bytes.subarray(header.length) : bytes;
    for (const item of new Bun.Transpiler({ loader: path.endsWith(".tsx") ? "tsx" : "ts" }).scanImports(parserBytes)) {
      const specifier = item.path;
      if (specifier.startsWith("node:") || specifier.startsWith("bun:") || builtinModules.includes(specifier)) continue;
      if (specifier.startsWith("/app/reference/")) { references.add(specifier); continue; }
      if (specifier.startsWith(".")) { pending.push(relative(base, resolve(base, dirname(path), specifier))); continue; }
      if (specifier === "zod" || specifier.startsWith("zod/") || specifier === "fflate") { external.add(specifier); continue; }
      const alias = [...aliases.keys()].find(name => specifier === name || specifier.startsWith(name + "/")), pkg = alias && aliases.get(alias);
      if (!pkg) throw new Error(`Qualification inputs: UNEXPECTED_DEPENDENCY:${specifier}`);
      const key = specifier === alias ? "." : "." + specifier.slice(alias!.length);
      let target = pkg.exports[key];
      if (target === undefined) for (const [pattern, value] of Object.entries(pkg.exports)) {
        const star = pattern.indexOf("*");
        if (star >= 0 && key.startsWith(pattern.slice(0, star)) && key.endsWith(pattern.slice(star + 1)) && typeof value === "string") target = value.replace("*", key.slice(star, key.length - pattern.length + star + 1));
      }
      if (typeof target !== "string" || !target.startsWith("./")) throw new Error("Qualification inputs: EXPORT");
      pending.push(`${pkg.directory}/${target.slice(2)}`);
    }
  }
  return { scope: "STATIC_LITERAL_SOURCE_CLOSURE_WITH_EXPLICIT_DYNAMIC_AND_EXTERNAL_INPUTS", baseCommit: "6a77f4c637f1d44260d5787c57a57b34fbffd754",
    files: [...selected.values()].sort((a, b) => a.path.localeCompare(b.path)), fileCount: selected.size, byteLength: total,
    externalDependencies: [...external].sort(), dynamicReferencePaths: [...references].sort(),
    dependencyPayloadInventory: "PENDING_SEPARATE_DELIVERY_PREPARATION", referenceDelivery: "PENDING_TRANSFER_OR_SEPARATELY_APPROVED_OFFLINE_BUILD",
    sourceCopiedOrEvaluated: false, nativeExecuted: false, trainingReady: false };
}

function generationDirectory(generation: string): string {
  if (!/^source-[1-9][0-9]{0,2}$/.test(generation)) throw new Error("Qualification inputs: GENERATION");
  return `${Q}/${generation}`;
}
export function prepareQualificationInputDocuments(base = root, generation = "source-1") {
  const output = generationDirectory(generation);
  const source = inspectQualificationSource(base), plan = pin(base, `${Q}/plan.json`);
  const factsPath = "artifacts/training-functional/host-facts-1/operator-result-1.json", factsRef = pin(base, factsPath);
  if (factsRef.sha256 !== "4128e7b587c40da0073c99ff86ab6711981ffc69423a74e4d41fd8870432bfd7") throw new Error("Qualification inputs: HOST_FACTS");
  const facts = JSON.parse(read(base, factsPath).toString()), image = facts.results.find((row: { name: string }) => row.name === "docker-image");
  const documents = {
    "source-manifest.json": { ...source, generation },
    "core-rules.json": { scope: "CURRENT_EXECUTION_RULE_SOURCE_MEMBERS_NOT_COMPLETE_PRODUCT_RULE_COVERAGE", files: source.files.filter(row => row.path.startsWith("packages/starchess-core/src/") || row.path === "packages/contracts/src/game-session.ts"), trainingReady: false },
    "image-observation.json": { scope: "USER_REPORTED_DOCKER_CONFIGURATION_ID_NOT_REGISTRY_MANIFEST_VERIFICATION", source: factsRef, result: image, trainingReady: false },
    "runtime-configuration.json": { scope: "PROPOSED_CONFIGURATION_NOT_EXECUTION", plan, implementations: source.files.filter(row => /qualification-(?:operator|evidence|policy-score|policy-channel)\.ts$/.test(row.path)), executionAuthorized: false, trainingReady: false },
  };
  mkdirSync(resolve(base, output));
  for (const [name, value] of Object.entries(documents)) writeFileSync(resolve(base, output, name), JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
  return Object.keys(documents).map(name => pin(base, `${output}/${name}`));
}

export function prepareQualificationBindingManifest(base = root, generation = "source-1") {
  const output = generationDirectory(generation);
  const corpus = "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/corpus-inputs-1/inputs/reference";
  const paths = { source: `${output}/source-manifest.json`, tests: `${output}/verification.json`, closure: "artifacts/training-functional/reference-prep-2/selected-reference.json", dependencyLock: "pnpm-lock.yaml",
    image: `${output}/image-observation.json`, runtimeConfiguration: `${output}/runtime-configuration.json`, coreRules: `${output}/core-rules.json`, strategicSource: "artifacts/training-functional/scratch/reference-prep-2/bundles/packages/starchess-arena/src/players/strategic.ts",
    corpusManifest: `${corpus}/_spec/corpora/ml-adjutant-corpus.manifest.json`, corpusSource: `${corpus}/starchess-match-history-20260929-203446.json`, recipe: `${Q}/plan.json`, featureLayout: "schemas/feature-layout.json",
    fixtureManifest: "packages/runtime/tests/fixtures/native-reference-proof.json", hostConfiguration: "artifacts/training-functional/host-facts-1/operator-result-1.json" };
  const documents = Object.entries(paths).map(([role, path]) => ({ role, source: pin(base, path), futurePath: `/app/qualification-inputs/${role}.bin` }));
  const record = { scope: "FOURTEEN_ACTUAL_DOCUMENT_REFS_NOT_STAGED_NOT_EXECUTION_AUTHORITY", documents, inputPayloadsCopied: false, referenceBundlesPublished: false, trainingReady: false };
  writeFileSync(resolve(base, output, "binding-documents.json"), JSON.stringify(record, null, 2) + "\n", { flag: "wx" });
  return record;
}

if (import.meta.main) {
  if (Bun.argv.length !== 4 || !["source", "bindings"].includes(Bun.argv[2]!)) throw new Error("usage: qualification-input-documents.ts source|bindings source-N");
  const result = Bun.argv[2] === "source" ? prepareQualificationInputDocuments(root, Bun.argv[3]!) : prepareQualificationBindingManifest(root, Bun.argv[3]!);
  console.log("Executor: " + JSON.stringify(result));
}
