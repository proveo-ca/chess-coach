// SPEC: _spec/runtime-protocol.puml
import { strict as assert } from "node:assert";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { runBounded } from "../../../../../verify";
import { SLICE as SEALED } from "../../local-inputs-1/prepare";
import { BASE, DOCUMENT_PATHS, FLAGS, PIN, ROOT, SLICE, sha256 } from "../prepare";

const programPaths = ["prepare.ts", "prepare.test.ts", "tsconfig.json", "verification-1/proof.ts"].map(path => SLICE + "/" + path);
const sealedPaths = ["prepare.ts", "prepare.test.ts", "tsconfig.json", "scope.json", "package-discovery.json", "discovery.json", "input-manifest.json", "materialization-start.json", "materialization.json", "check.json", "verification-1/proof.ts", "verification-2/receipt.json", "verification-3/receipt.json"].map(path => SEALED + "/" + path);
const paths = [...new Set([...programPaths, ...Object.values(DOCUMENT_PATHS), ...sealedPaths, "_work/gpu-owner-recovery/verify.ts", "_work/gpu-owner-recovery/command-supervisor.ts", "node_modules/typescript/package.json", "node_modules/typescript/lib/_tsc.js"])];

export async function prove(label: string) {
  assert.equal(process.execPath, "/usr/local/bin/bun"); assert.equal(Bun.version, "1.4.0"); assert.equal(process.cwd(), ROOT);
  assert.match(label, /^verification-[1-9][0-9]?$/);
  assert.equal(JSON.parse(await readFile(resolve(ROOT, "node_modules/typescript/package.json"), "utf8")).version, "5.9.3");
  const directory = resolve(BASE, label);
  if (label !== "verification-1") await mkdir(directory, { mode: 0o700 });
  await writeFile(resolve(directory, "started.json"), JSON.stringify({ label, reference: PIN }) + "\n", { flag: "wx", mode: 0o600 });
  for (const name of ["home", "tmp", "fixtures", "sources"]) await mkdir(resolve(directory, name), { mode: 0o700 });
  const sources = [];
  for (const [index, path] of paths.entries()) {
    const bytes = await readFile(resolve(ROOT, path)), snapshot = programPaths.includes(path) ? relative(ROOT, resolve(directory, "sources", String(index) + ".source")) : null;
    if (snapshot) await writeFile(resolve(ROOT, snapshot), bytes, { flag: "wx", mode: 0o600 });
    sources.push({ path, bytes: bytes.length, sha256: sha256(bytes), snapshot });
  }
  const bun = ["/usr/local/bin/bun", "--no-env-file", "--no-install"];
  const commands = [
    { id: "unit", argv: [...bun, "test", "./" + SLICE + "/prepare.test.ts"], timeoutMs: 120000 },
    { id: "strict-types", argv: [...bun, "node_modules/typescript/lib/_tsc.js", "-p", SLICE + "/tsconfig.json"], timeoutMs: 120000 },
    ...["prepare", "check"].map(id => ({ id, argv: [...bun, SLICE + "/prepare.ts", "--" + id], timeoutMs: 180000 })),
  ];
  const environment = { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: resolve(directory, "home"), TMPDIR: resolve(directory, "tmp"), BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0", NO_COLOR: "1",
    LANG: "C.UTF-8", LC_ALL: "C.UTF-8", TZ: "UTC", MISE_AUTO_INSTALL: "false", MISE_EXEC_AUTO_INSTALL: "false", MISE_TASK_RUN_AUTO_INSTALL: "false" };
  const results = []; let failure: string | null = null;
  try {
    for (const command of commands) {
      const step = resolve(directory, command.id); await mkdir(step, { mode: 0o700 });
      const result = await runBounded(command.argv, step, command.timeoutMs, { cwd: ROOT, environment }), streams = [];
      for (const channel of ["stdout", "stderr"]) { const path = relative(ROOT, resolve(step, "command." + channel)), bytes = await readFile(resolve(ROOT, path)); streams.push({ path, bytes: bytes.length, sha256: sha256(bytes) }); }
      results.push({ ...command, ...result, streams }); assert.equal(result.status, "PASS", "CORPUS_SIDECAR_VERIFICATION_FAILED:" + command.id);
    }
  } catch (error) { failure = error instanceof Error ? error.message : String(error); }
  let sourceChanged = false;
  for (const source of sources) { try { if (sha256(await readFile(resolve(ROOT, source.path))) !== source.sha256) sourceChanged = true; } catch { sourceChanged = true; } }
  const evidence = [];
  for (const name of ["input-manifest.json", "materialization.json", "check.json", "prepare-failure.json", "check-failure.json"]) {
    try { const path = SLICE + "/" + name, bytes = await readFile(resolve(ROOT, path)); evidence.push({ path, bytes: bytes.length, sha256: sha256(bytes) }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") { failure ??= String(error); } }
  }
  const pass = failure === null && !sourceChanged && results.length === commands.length;
  const receipt = { status: pass ? "PASS_BOUNDED_TWO_CORPUS_FILE_SIDECAR_PACKAGES_STILL_MISSING" : "FAIL_CORPUS_SIDECAR_VERIFICATION", reference: PIN, failure, sources, sourceChanged,
    sealedApplicationGenerationMetadataAndToolsUnchanged: !sourceChanged, sealedApplicationPayloadsRehashed: false, results, evidence, environment, bunVersion: Bun.version, typescriptVersion: "5.9.3", ...FLAGS };
  await writeFile(resolve(directory, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ status: receipt.status, receipt: relative(ROOT, resolve(directory, "receipt.json")), stages: results.length, sourceChanged })); return pass;
}
if (import.meta.main) { assert.equal(Bun.argv.length, 3); process.exitCode = await prove(Bun.argv[2]!) ? 0 : 1; }
