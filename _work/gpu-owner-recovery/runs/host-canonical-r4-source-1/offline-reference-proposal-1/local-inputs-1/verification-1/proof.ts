// SPEC: _spec/runtime-protocol.puml
import { strict as assert } from "node:assert";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { runBounded } from "../../../../../verify";
import { BASE, PIN, QUALIFICATION, ROOT, SLICE, sha256 } from "../prepare";

const boundPaths = ["prepare.ts", "prepare.test.ts", "tsconfig.json", "scope.json", "package-discovery.json", "verification-1/proof.ts"].map(path => SLICE + "/" + path)
  .concat(["_work/gpu-owner-recovery/verify.ts", "_work/gpu-owner-recovery/command-supervisor.ts", "node_modules/typescript/package.json", "node_modules/typescript/lib/_tsc.js"]);

export async function prove(label: string, verifyExisting = false) {
  assert.equal(process.execPath, "/usr/local/bin/bun"); assert.equal(Bun.version, "1.4.0"); assert.equal(process.cwd(), ROOT);
  assert.match(label, /^verification-[1-9][0-9]?$/); assert.notEqual(label, "verification-1");
  assert.equal(JSON.parse(await readFile(resolve(ROOT, "node_modules/typescript/package.json"), "utf8")).version, "5.9.3");
  const directory = resolve(BASE, label); await mkdir(directory, { mode: 0o700 });
  for (const name of ["home", "tmp", "fixtures", "sources"]) await mkdir(resolve(directory, name), { mode: 0o700 });
  const sources = [];
  for (let index = 0; index < boundPaths.length; index++) {
    const path = boundPaths[index]!, bytes = await readFile(resolve(ROOT, path));
    const snapshot = index < 8 ? relative(ROOT, resolve(directory, "sources", String(index) + ".source")) : null;
    if (snapshot) await writeFile(resolve(ROOT, snapshot), bytes, { flag: "wx", mode: 0o600 });
    sources.push({ path, bytes: bytes.length, sha256: sha256(bytes), snapshot });
  }
  const bun = ["/usr/local/bin/bun", "--no-env-file", "--no-install"];
  const commands = [
    { id: "unit", argv: [...bun, "test", "./" + SLICE + "/prepare.test.ts"], timeoutMs: 120000 },
    { id: "strict-types", argv: [...bun, "node_modules/typescript/lib/_tsc.js", "-p", SLICE + "/tsconfig.json"], timeoutMs: 120000 },
    ...(verifyExisting ? ["check"] : ["discover", "materialize", "check"]).map(id => ({ id, argv: [...bun, SLICE + "/prepare.ts", "--" + id], timeoutMs: 180000 })),
  ];
  const environment = { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: resolve(directory, "home"), TMPDIR: resolve(directory, "tmp"), BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0",
    NO_COLOR: "1", LANG: "C.UTF-8", LC_ALL: "C.UTF-8", TZ: "UTC", MISE_AUTO_INSTALL: "false", MISE_EXEC_AUTO_INSTALL: "false", MISE_TASK_RUN_AUTO_INSTALL: "false" };
  const results = [];
  let failure: string | null = null;
  try {
    for (const command of commands) {
      const step = resolve(directory, command.id); await mkdir(step, { mode: 0o700 });
      const result = await runBounded(command.argv, step, command.timeoutMs, { cwd: ROOT, environment });
      const streams = [];
      for (const channel of ["stdout", "stderr"]) {
        const path = relative(ROOT, resolve(step, "command." + channel)), bytes = await readFile(resolve(ROOT, path));
        streams.push({ path, bytes: bytes.length, sha256: sha256(bytes) });
      }
      results.push({ ...command, ...result, streams });
      assert.equal(result.status, "PASS", "LOCAL_INPUT_VERIFICATION_FAILED:" + command.id);
    }
  } catch (error) { failure = error instanceof Error ? error.message : String(error); }
  let sourceChanged = false;
  for (const source of sources) {
    try { if (sha256(await readFile(resolve(ROOT, source.path))) !== source.sha256) sourceChanged = true; } catch { sourceChanged = true; }
  }
  const evidence = [];
  for (const name of ["discovery.json", "input-manifest.json", "materialization-start.json", "materialization.json", "check.json", "discover-failure.json", "materialize-failure.json", "check-failure.json"]) {
    try { const bytes = await readFile(resolve(BASE, name)); evidence.push({ path: SLICE + "/" + name, bytes: bytes.length, sha256: sha256(bytes) }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  let preparationEvidenceUnchanged: boolean | null = null;
  if (verifyExisting) {
    try {
      const path = SLICE + "/verification-2/receipt.json", bytes = await readFile(resolve(ROOT, path));
      evidence.push({ path, bytes: bytes.length, sha256: sha256(bytes) });
      const prior = JSON.parse(bytes.toString("utf8"));
      for (const row of prior.evidence) assert.equal(sha256(await readFile(resolve(ROOT, row.path))), row.sha256, "PREPARATION_EVIDENCE_CHANGED:" + row.path);
      preparationEvidenceUnchanged = true;
    } catch (error) { preparationEvidenceUnchanged = false; failure ??= error instanceof Error ? error.message : String(error); }
  }
  const pass = failure === null && !sourceChanged && results.length === commands.length;
  const receipt = { status: pass ? verifyExisting ? "PASS_FRESH_TESTS_TYPES_AND_PRESERVED_MATERIALIZED_INPUT_RECHECK" : "PASS_BOUNDED_LOCAL_SOURCE_PREPARATION_PACKAGES_STILL_MISSING" : "FAIL_LOCAL_SOURCE_PREPARATION", reference: PIN, failure, sources, sourceChanged, results, evidence,
    verifyExisting, preparationEvidenceUnchanged,
    bunVersion: Bun.version, typescriptVersion: "5.9.3", environment, installedPackageFilesCopied: 0, localVerificationOnly: true, ...QUALIFICATION };
  await writeFile(resolve(directory, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ status: receipt.status, receipt: relative(ROOT, resolve(directory, "receipt.json")), stages: results.length, sourceChanged }));
  return pass;
}

if (import.meta.main) {
  assert.ok(Bun.argv.length === 3 || Bun.argv.length === 4);
  if (Bun.argv.length === 4) assert.equal(Bun.argv[3], "--verify-existing");
  process.exitCode = await prove(Bun.argv[2]!, Bun.argv.length === 4) ? 0 : 1;
}
