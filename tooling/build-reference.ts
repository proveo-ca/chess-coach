// SPEC: _spec/runtime-protocol.puml, _spec/gate-closure.puml
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { builtinModules } from "node:module";
import selected from "./reference-entrypoints.json";

export function buildReferenceBundles(sourceRoot: string, outputRoot: string) {
  if (!isAbsolute(sourceRoot) || !isAbsolute(outputRoot) || Bun.version !== selected.bunVersion) throw new Error("Reference build: CONTEXT");
  const source = realpathSync(sourceRoot), root = resolve(outputRoot);
  if (root === source || root.startsWith(source + "/")) throw new Error("Reference build: OUTPUT_IN_SOURCE");
  mkdirSync(root, { mode: 0o700 });
  const inventory: { entry: string; inputs: { path: string; byteLength: number; sha256: string }[]; output: { path: string; byteLength: number; sha256: string } }[] = [];
  const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
  for (const [ordinal, entry] of selected.entries.entries()) {
    const output = resolve(root, entry), metafile = resolve(root, `metafile-${ordinal}.json`);
    mkdirSync(dirname(output), { recursive: true, mode: 0o700 });
    const result = Bun.spawnSync([process.execPath, "--no-env-file", "--no-install", "build", "--target=bun", "--reject-unresolved", `--metafile=${metafile}`, `--outfile=${output}`, entry],
      { cwd: source, env: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: "/nonexistent", NODE_ENV: "production", BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0" }, stdout: "pipe", stderr: "pipe", timeout: 30_000 });
    if (result.exitCode !== 0) throw new Error(`Reference build: BUN_FAILED\n${new TextDecoder().decode(result.stderr)}`);
    if (statSync(metafile).size > 1048576 || statSync(output).size > 16 * 1024 * 1024) throw new Error("Reference build: OUTPUT_BOUND");
    const metadata: { inputs: Record<string, { imports?: { path: string; external?: boolean }[] }> } = JSON.parse(readFileSync(metafile, "utf8"));
    const inputs = Object.entries(metadata.inputs).map(([path, input]) => {
      const actual = realpathSync(resolve(source, path));
      if (!actual.startsWith(source + "/") || statSync(actual).size > 16 * 1024 * 1024) throw new Error("Reference build: INPUT_SCOPE");
      for (const imported of input.imports ?? []) if (imported.external && !builtinModules.includes(imported.path.replace(/^node:/, "")) && !imported.path.startsWith("bun:")) throw new Error("Reference build: EXTERNAL_IMPORT");
      const bytes = readFileSync(actual);
      return { path: relative(source, actual), byteLength: bytes.byteLength, sha256: hash(bytes) };
    }).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
    const bytes = readFileSync(output);
    inventory.push({ entry, inputs, output: { path: entry, byteLength: bytes.byteLength, sha256: hash(bytes) } });
  }
  writeFileSync(resolve(root, "selected-reference.json"), JSON.stringify({ version: selected.version, reference: selected.reference, bunVersion: Bun.version, inventory }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  return inventory;
}
if (import.meta.main) {
  if (process.argv.length !== 4) throw new Error("Usage: build-reference.ts REGISTERED_SOURCE_ROOT EXCLUSIVE_OUTPUT_ROOT");
  console.log(JSON.stringify({ scope: "SELECTED_REFERENCE_BUILD_OUTPUTS_NOT_GATE0_REGISTRATION", inventory: buildReferenceBundles(process.argv[2]!, process.argv[3]!) }));
}
