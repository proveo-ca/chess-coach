// SPEC: _spec/recovery.md
import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { environment, repository, work } from "./provision";
import { grantPath, isolationEnvironment, miseStagePlan, probe, probeArgv, reviewedFiles, reviewPath, runMiseStages, sha256,
  validateGrant, validateMiseDiscovery, validateProbeFiles, validateReview, validateTaskConfiguration } from "./cuda-isolation";
import type { MiseStage, ProbeFile, ReviewInputs, TrustedProbeIO, TrustedSpawn } from "./cuda-isolation";

const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const originalGrant = JSON.parse(await readFile(resolve(repository, grantPath), "utf8"));
const granted = () => ({ ...structuredClone(originalGrant), authorityGranted: true, phase: "ISOLATION_PREFLIGHT_FIRST",
  status: "APPROVED_CONDITIONAL_DEVELOPMENT_SEQUENCE", renewedExecutorDecisionRequired: false,
  authorization: { ...structuredClone(originalGrant.authorization), grantStatus: "APPROVED_NOT_EXECUTED", firstActualFailureStopsSequence: true } });
const files = () => Object.fromEntries(reviewedFiles.map(path => [path, bytes(path)]));
const accepted = () => {
  const sourceFiles = files(), grantBytes = bytes(granted());
  return { grantBytes, files: sourceFiles, record: {
    version: "chess-coach.cuda-isolation-source-review.v1", staticUnitTestsPassed: true, staticTypesPassed: true,
    adversarialSourceAccepted: true, securitySourceAccepted: true, requestSha256: sha256(grantBytes),
    files: Object.fromEntries(reviewedFiles.map(path => [path, sha256(sourceFiles[path]!)])),
  } };
};
const probeFiles = (): ProbeFile[] => ["/usr/bin/true", "/usr/lib/x86_64-linux-gnu/libc.so.6", "/usr/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2"].map((path, index) => ({
  guest: path, path, device: "1", inode: String(index + 1), byteLength: 4096, mode: 0o100755, uid: 0, sha256: "a".repeat(64),
}));
const fakeIO = (spawn: TrustedSpawn, review: ReviewInputs = accepted()): TrustedProbeIO => ({
  readReview: async () => review, readProbeFiles: async () => probeFiles(), spawn,
});

test("fixed bwrap argv exposes only three regular files in a fresh minimal root", () => {
  expect(probeArgv(probeFiles())).toEqual([
    "/usr/bin/bwrap", "--die-with-parent", "--unshare-user", "--unshare-net", "--clearenv", "--cap-drop", "ALL",
    "--setenv", "PATH", "/usr/bin:/bin", "--setenv", "LANG", "C",
    "--dir", "/usr", "--dir", "/usr/bin", "--dir", "/usr/lib", "--dir", "/usr/lib/x86_64-linux-gnu", "--dir", "/usr/lib64",
    "--ro-bind", "/usr/bin/true", "/usr/bin/true",
    "--ro-bind", "/usr/lib/x86_64-linux-gnu/libc.so.6", "/usr/lib/x86_64-linux-gnu/libc.so.6",
    "--ro-bind", "/usr/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2", "/usr/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2",
    "--symlink", "usr/bin", "/bin", "--symlink", "usr/lib", "/lib", "--symlink", "usr/lib64", "/lib64",
    "--symlink", "../lib/x86_64-linux-gnu/ld-linux-x86-64.so.2", "/usr/lib64/ld-linux-x86-64.so.2",
    "--dev", "/dev", "--dir", "/proc", "--chdir", "/", "--", "/usr/bin/true",
  ]);
  const argv = probeArgv(probeFiles());
  for (const forbidden of ["--unshare-user-try", "--unshare-net-try", "--share-net", "--new-session", "--unshare-pid", "--unshare-all", "--preserve-fds", "--proc", "--bind", "--dev-bind"]) expect(argv).not.toContain(forbidden);
  for (const path of [repository, work, "/home", "/run", "/sys", "/proc/self/fd", "/proc/1/root"]) expect(argv).not.toContain(path);
});

test("unsupported physical layouts and invalid file identities fail at the filesystem layer", () => {
  const invalid: Partial<ProbeFile>[] = [
    { path: "/bin/true" }, { path: "/usr/bin/../bin/true" }, { guest: "/usr/bin/sh" }, { device: "-1" }, { inode: "0" },
    { byteLength: 0 }, { byteLength: 1024 * 1024 + 1 }, { mode: 0o040755 }, { mode: 0o100644 }, { mode: 0o100777 }, { uid: 1000 }, { sha256: "z".repeat(64) },
  ];
  for (const change of invalid) {
    const identities = probeFiles(); identities[0] = { ...identities[0]!, ...change };
    expect(() => probeArgv(identities)).toThrow("UNSUPPORTED_TRUSTED_FILE_LAYOUT");
  }
  for (const path of ["/usr/lib/libc.so.6", "/usr/lib/x86_64-linux-gnu-evil/libc.so.6", "/proc/self/root/usr/lib/x86_64-linux-gnu/libc.so.6"]) {
    const identities = probeFiles(); identities[1]!.path = path;
    expect(() => validateProbeFiles(identities)).toThrow("UNSUPPORTED_TRUSTED_FILE_LAYOUT");
  }
  const largeLibc = probeFiles(); largeLibc[1]!.byteLength = 16 * 1024 * 1024;
  expect(() => validateProbeFiles(largeLibc)).not.toThrow();
  largeLibc[1]!.byteLength++;
  expect(() => validateProbeFiles(largeLibc)).toThrow();
  const loader = probeFiles(); loader[2]!.byteLength = 1024 * 1024 + 1;
  expect(() => validateProbeFiles(loader)).toThrow();
  expect(() => validateProbeFiles(probeFiles().slice(1))).toThrow();
  expect(() => validateProbeFiles([...probeFiles(), probeFiles()[0]!])).toThrow();
});

test("the observed GNU true alias changes only its bind source and retains the fixed guest command", () => {
  const identities = probeFiles();
  identities[0] = { ...identities[0]!, path: "/usr/bin/gnutrue", device: "57", inode: "12199707", byteLength: 35288,
    sha256: "7d659da07aad1d5d1ed79e9f2822d24d2dea47ceec4c7e2e71718a177dc20b4b" };
  expect(() => validateProbeFiles(identities)).not.toThrow();
  const expected = probeArgv(probeFiles());
  expected[expected.indexOf("--ro-bind") + 1] = "/usr/bin/gnutrue";
  const actual = probeArgv(identities);
  expect(actual).toEqual(expected);
  expect(actual.slice(-2)).toEqual(["--", "/usr/bin/true"]);
  expect(actual.filter(value => value === "/usr/bin/gnutrue")).toHaveLength(1);
  for (const path of ["/usr/bin/false", "/usr/bin/gnutrue-extra", "/usr/local/bin/gnutrue", "/bin/gnutrue",
    "/usr/bin/../bin/gnutrue", "/usr/bin//gnutrue", "/usr/bin/gnutrue/", "/usr/bin-evil/gnutrue", "/proc/self/root/usr/bin/gnutrue"]) {
    expect(() => validateProbeFiles([{ ...identities[0]!, path }, ...identities.slice(1)])).toThrow("UNSUPPORTED_TRUSTED_FILE_LAYOUT");
  }
  for (const change of [{ uid: 1000 }, { mode: 0o100775 }, { mode: 0o100644 }, { mode: 0o040755 }, { byteLength: 0 },
    { byteLength: 1024 * 1024 + 1 }, { sha256: "invalid" }]) {
    expect(() => validateProbeFiles([{ ...identities[0]!, ...change }, ...identities.slice(1)])).toThrow("UNSUPPORTED_TRUSTED_FILE_LAYOUT");
  }
});

test("unknown CLI arguments fail before review reads, filesystem inspection or spawn", async () => {
  let calls = 0;
  const trusted: TrustedProbeIO = {
    readReview: async () => { calls++; throw Error("must not read"); },
    readProbeFiles: async () => { calls++; throw Error("must not inspect"); },
    spawn: () => { calls++; throw Error("must not spawn"); },
  };
  for (const args of [[], ["download"], ["probe", "--"], ["probe", "--command", "/bin/sh"], ["--help"]]) await expect(probe(args, trusted)).rejects.toThrow("CLOSED_PROBE_CLI_REQUIRED");
  expect(calls).toBe(0);
});

test("the exact grant authorizes only the preflight-first slice", () => {
  expect(() => validateGrant(granted())).not.toThrow();
  for (const change of [{ authorityGranted: false }, { authorityGranted: "true" }, { phase: "COMPILE" }, { objective: "GPU" },
    { executionGate: "BYPASS" }, { taskConfiguration: "mise.toml" }, { compileTargets: [] }, { normalDispatcherEnablementAuthorized: true }, { gpuExecutionAuthorized: true },
    { otherDownloadsOrNewToolsAuthorized: true }, { publicationAuthorized: true }, { trainingAuthorized: true }, { testBinaryOrModelExecutionAuthorized: true }]) {
    expect(() => validateGrant({ ...granted(), ...change })).toThrow("EXACT_PREFLIGHT_GRANT_REQUIRED");
  }
  for (const change of [{ namespaceAndCustodyPreflightDeadlineMs: 30001 }, { automaticRetryAllowed: true }, { stopSequenceAtFirstFailure: false }]) {
    const grant = granted(); Object.assign(grant.requestedExecutionLimits, change);
    expect(() => validateGrant(grant)).toThrow("EXACT_PREFLIGHT_GRANT_REQUIRED");
  }
  for (const key of ["name", "url", "byteLength", "sha256", "destination"]) {
    const grant = granted(); grant.artifacts[0][key] = "changed";
    expect(() => validateGrant(grant)).toThrow("EXACT_ARTIFACT_IDENTITIES_REQUIRED");
  }
  const extraArtifact = granted(); extraArtifact.artifacts.push(extraArtifact.artifacts[0]);
  expect(() => validateGrant(extraArtifact)).toThrow("EXACT_ARTIFACT_IDENTITIES_REQUIRED");
});

test("halted, consumed, renewal-required and missing approval cannot reuse a reviewed source generation", () => {
  for (const grantStatus of ["HALTED_AFTER_FIRST_FAILURE", "CONSUMED_SUCCESS", "APPROVED", "", undefined]) {
    const grant = granted(); grant.authorization.grantStatus = grantStatus;
    expect(() => validateGrant(grant)).toThrow("EXACT_PREFLIGHT_GRANT_REQUIRED");
  }
  for (const change of [{ renewedExecutorDecisionRequired: true }, { status: "HALTED_AFTER_FIRST_SETUP_FAILURE_RENEWAL_REQUIRED" },
    { status: "CONSUMED_SUCCESS" }, { authorization: undefined },
    { authorization: { ...granted().authorization, scope: "UNRESTRICTED" } },
    { authorization: { grantStatus: "APPROVED_NOT_EXECUTED", firstActualFailureStopsSequence: false } }]) {
    expect(() => validateGrant({ ...granted(), ...change })).toThrow();
  }
  const halted = { ...granted(), authorityGranted: false, status: "HALTED_AFTER_FIRST_SETUP_FAILURE_RENEWAL_REQUIRED",
    phase: "HALTED_BEFORE_NAMESPACE_PROBE", renewedExecutorDecisionRequired: true,
    authorization: { ...granted().authorization, grantStatus: "HALTED_AFTER_FIRST_FAILURE" } };
  expect(() => validateGrant(halted)).toThrow();
  const probeOnly = granted(); probeOnly.authorization.scope = "REVIEWED_INERT_ISOLATION_PROBE_ONLY";
  expect(() => validateGrant(probeOnly)).not.toThrow();
  expect(reviewPath).toBe("_work/gpu-owner-recovery/cuda-isolation-reviewed-v3.json");
});

const taskBytes = () => readFile(resolve(work, "cuda-mise.toml"));
const discovery = () => bytes([{ path: resolve(work, "cuda-mise.toml"), tools: [] }]);

test("the closed Mise plan trusts only the reviewed task file before paranoid discovery and task execution", async () => {
  const plan = miseStagePlan();
  expect(plan).toEqual([
    { name: "00-trust", argv: ["/usr/local/bin/mise", "trust", resolve(work, "cuda-mise.toml")] },
    { name: "01-config", argv: ["/usr/local/bin/mise", "config", "ls", "--json"] },
    { name: "02-inert-probe", argv: ["/usr/local/bin/mise", "run", "--raw", "cuda:isolation-probe"] },
  ]);
  let trustedConfiguration = false;
  const paranoidMise = (name: string) => {
    if (name === "00-trust") trustedConfiguration = true;
    else if (name === "01-config" && !trustedConfiguration) throw Error("CONFIG_NOT_TRUSTED");
  };
  expect(() => paranoidMise("01-config")).toThrow("CONFIG_NOT_TRUSTED");
  const visited: MiseStage["name"][] = [];
  let gates = 0;
  const result = await runMiseStages({ verifyOutsideGate: async () => { gates++; }, readTaskConfiguration: taskBytes,
    run: async stage => { visited.push(stage.name); paranoidMise(stage.name); return { exitCode: 0, stdout: discovery(), failure: null }; } });
  expect(visited).toEqual(["00-trust", "01-config", "02-inert-probe"]);
  expect(gates).toBe(6);
  expect(result).toEqual({ exitCode: 0, failedStage: null, failure: null, completedStages: visited, inertProbePassed: true,
    buildIsolationQualified: false, custodyQualified: false, cudaCompilationEstablished: false, trainingReady: false });
});

test("the Mise consumer stops on the first stage failure without skipping forward or retrying", async () => {
  for (const failed of miseStagePlan()) {
    const visited: MiseStage["name"][] = [];
    const result = await runMiseStages({ verifyOutsideGate: async () => {}, readTaskConfiguration: taskBytes,
      run: async stage => { visited.push(stage.name); return { exitCode: stage.name === failed.name ? 7 : 0, stdout: discovery() }; } });
    expect(visited).toEqual(miseStagePlan().slice(0, miseStagePlan().findIndex(stage => stage.name === failed.name) + 1).map(stage => stage.name));
    expect(result.exitCode).toBe(7);
    expect(result.failedStage).toBe(failed.name);
    expect(result.inertProbePassed).toBe(false);
  }
  let calls = 0;
  const io = { verifyOutsideGate: async () => {}, readTaskConfiguration: taskBytes,
    run: async () => { calls++; return { exitCode: 0, stdout: discovery(), failure: "COMMAND_OUTPUT_BOUND" }; } };
  for (const failure of ["COMMAND_OUTPUT_BOUND", ""]) {
    calls = 0;
    const result = await runMiseStages({ ...io, run: async () => { calls++; return { exitCode: 0, stdout: discovery(), failure }; } });
    expect(result.exitCode).toBe(1);
    expect(result.failure).toBe(failure);
    expect(calls).toBe(1);
  }
  calls = 0;
  await expect(runMiseStages({ ...io, run: async () => { calls++; throw Error("SPAWN_DENIED"); } })).rejects.toThrow("SPAWN_DENIED");
  expect(calls).toBe(1);
  await expect(runMiseStages({ ...io, run: async () => ({ exitCode: -1, stdout: discovery() }) })).rejects.toThrow("INVALID_MISE_STAGE_EXIT");
});

test("the Mise consumer rejects malformed, extra or tool-bearing discovery before task execution", async () => {
  for (const output of [bytes([]), bytes([{ path: "/wrong", tools: [] }]), bytes([{ path: resolve(work, "cuda-mise.toml"), tools: ["rust"] }]),
    bytes([{ path: resolve(work, "cuda-mise.toml"), tools: "none" }]), bytes([{}, {}]), bytes({ path: resolve(work, "cuda-mise.toml") }),
    new TextEncoder().encode("not JSON"), new Uint8Array([255]), new Uint8Array(65537)]) {
    const visited: MiseStage["name"][] = [];
    await expect(runMiseStages({ verifyOutsideGate: async () => {}, readTaskConfiguration: taskBytes,
      run: async stage => { visited.push(stage.name); return { exitCode: 0, stdout: output }; } })).rejects.toThrow();
    expect(visited).toEqual(["00-trust", "01-config"]);
  }
  expect(() => validateMiseDiscovery(discovery())).not.toThrow();
});

test("outside gates and authenticated tasks-only TOML guard every Mise stage", async () => {
  let calls = 0;
  const io = { verifyOutsideGate: async () => { throw Error("OUTSIDE_HASH_MISMATCH"); }, readTaskConfiguration: taskBytes,
    run: async () => { calls++; return { exitCode: 0, stdout: discovery() }; } };
  await expect(runMiseStages(io)).rejects.toThrow("OUTSIDE_HASH_MISMATCH");
  expect(calls).toBe(0);
  const valid = await taskBytes();
  for (const invalid of [new TextEncoder().encode('[tools]\nrust="latest"'), new TextEncoder().encode('not TOML'), new Uint8Array(4097), new Uint8Array([255])]) {
    expect(() => validateTaskConfiguration(invalid)).toThrow();
    await expect(runMiseStages({ ...io, verifyOutsideGate: async () => {}, readTaskConfiguration: async () => invalid })).rejects.toThrow();
    expect(calls).toBe(0);
  }
  let reads = 0;
  await expect(runMiseStages({ ...io, verifyOutsideGate: async () => {},
    readTaskConfiguration: async () => ++reads === 1 ? valid : new TextEncoder().encode('[hooks]\nenter="bad"') })).rejects.toThrow();
  expect(calls).toBe(1);
  let checks = 0;
  calls = 0;
  await expect(runMiseStages({ ...io, verifyOutsideGate: async () => { if (++checks === 2) throw Error("CHANGED_AFTER_TRUST"); } })).rejects.toThrow("CHANGED_AFTER_TRUST");
  expect(calls).toBe(1);
});

test("review acceptance requires every boolean and exact current request and source bytes", () => {
  const input = accepted();
  expect(() => validateReview(input.record, input.grantBytes, input.files)).not.toThrow();
  for (const key of ["staticUnitTestsPassed", "staticTypesPassed", "adversarialSourceAccepted", "securitySourceAccepted"]) {
    expect(() => validateReview({ ...input.record, [key]: false }, input.grantBytes, input.files)).toThrow("ACCEPTED_SOURCE_REVIEW_REQUIRED");
    const missing = { ...input.record } as Record<string, unknown>; delete missing[key];
    expect(() => validateReview(missing, input.grantBytes, input.files)).toThrow("ACCEPTED_SOURCE_REVIEW_REQUIRED");
  }
  expect(() => validateReview(undefined, input.grantBytes, input.files)).toThrow();
  expect(() => validateReview({ ...input.record, operationallyAccepted: true }, input.grantBytes, input.files)).toThrow();
  expect(() => validateReview(input.record, bytes({ ...granted(), authorityGranted: false }), input.files)).toThrow("REVIEW_HASH_MISMATCH");
  for (const path of reviewedFiles) {
    expect(() => validateReview(input.record, input.grantBytes, { ...input.files, [path]: bytes("changed") })).toThrow("REVIEW_HASH_MISMATCH");
    const missing = { ...input.files }; delete missing[path];
    expect(() => validateReview(input.record, input.grantBytes, missing)).toThrow("REVIEW_HASH_MISMATCH");
    expect(() => validateReview({ ...input.record, files: { ...input.record.files, [path]: "b".repeat(64) } }, input.grantBytes, input.files)).toThrow("REVIEW_HASH_MISMATCH");
  }
  const unapproved = bytes({ ...granted(), authorityGranted: false });
  expect(() => validateReview({ ...input.record, requestSha256: sha256(unapproved) }, unapproved, input.files)).toThrow("EXACT_PREFLIGHT_GRANT_REQUIRED");
});

test("a missing or mismatched review stops before any binary inspection or spawn", async () => {
  let effects = 0;
  const trusted = fakeIO(() => { effects++; throw Error("must not spawn"); });
  trusted.readProbeFiles = async () => { effects++; throw Error("must not inspect"); };
  trusted.readReview = async () => { throw Error("ENOENT: missing review"); };
  await expect(probe(["probe"], trusted)).rejects.toThrow("missing review");
  const input = accepted(); input.record.requestSha256 = "0".repeat(64);
  trusted.readReview = async () => input;
  await expect(probe(["probe"], trusted)).rejects.toThrow("REVIEW_HASH_MISMATCH");
  const haltedInput = accepted();
  const haltedGrant = granted(); haltedGrant.authorization.grantStatus = "HALTED_AFTER_FIRST_FAILURE";
  haltedInput.grantBytes = bytes(haltedGrant); haltedInput.record.requestSha256 = sha256(haltedInput.grantBytes);
  trusted.readReview = async () => haltedInput;
  await expect(probe(["probe"], trusted)).rejects.toThrow("EXACT_PREFLIGHT_GRANT_REQUIRED");
  expect(effects).toBe(0);
});

test("probe awaits the actual exit in the existing process group and reports only inert success", async () => {
  let finish!: (code: number) => void, spawned = 0, completed = false;
  const exited = new Promise<number>(resolve => { finish = resolve; });
  const pending = probe(["probe"], fakeIO((argv, options) => {
    spawned++;
    expect(argv).toEqual(probeArgv(probeFiles()));
    expect(options).toEqual({ cwd: "/", env: { PATH: "/usr/bin:/bin", LANG: "C" }, stdin: "ignore", stdout: "inherit", stderr: "inherit", detached: false });
    return { exited };
  })).then(result => { completed = true; return result; });
  for (let index = 0; index < 8; index++) await Promise.resolve();
  expect(spawned).toBe(1);
  expect(completed).toBe(false);
  finish(0);
  expect(await pending).toEqual({ exitCode: 0, inertProbePassed: true, buildIsolationQualified: false, custodyQualified: false,
    cudaCompilationEstablished: false, trainingReady: false, inputs: probeFiles() });
});

test("spawn errors and exact nonzero exits never become no-op success or trigger retries", async () => {
  let attempts = 0;
  await expect(probe(["probe"], fakeIO(() => { attempts++; throw Error("SPAWN_DENIED"); }))).rejects.toThrow("SPAWN_DENIED");
  expect(attempts).toBe(1);
  await expect(probe(["probe"], fakeIO(() => ({ exited: Promise.reject(Error("EXIT_WAIT_FAILED")) })))).rejects.toThrow("EXIT_WAIT_FAILED");
  for (const code of [1, 7, 126, 137, 255]) {
    let count = 0;
    const result = await probe(["probe"], fakeIO(() => { count++; return { exited: Promise.resolve(code) }; }));
    expect(count).toBe(1);
    expect(result.exitCode).toBe(code);
    expect(result.inertProbePassed).toBe(false);
    expect(result.buildIsolationQualified || result.custodyQualified || result.cudaCompilationEstablished || result.trainingReady).toBe(false);
  }
  for (const code of [-1, 256, NaN, 1.5]) await expect(probe(["probe"], fakeIO(() => ({ exited: Promise.resolve(code) })))).rejects.toThrow("INVALID_PROBE_EXIT");
});

test("mise is tasks-only with a fixed Bun command and preserves the entire private provisioning environment", async () => {
  const configuration = Bun.TOML.parse(await readFile(resolve(work, "cuda-mise.toml"), "utf8"));
  expect(configuration).toEqual({ tasks: { "cuda:isolation-probe": { dir: "../..",
    run: "/usr/local/bin/bun --no-env-file --no-install _work/gpu-owner-recovery/cuda-isolation.ts probe" } } });
  expect(isolationEnvironment()).toEqual({ ...environment, MISE_OVERRIDE_CONFIG_FILENAMES: "cuda-mise.toml" });
  expect(environment.MISE_OVERRIDE_CONFIG_FILENAMES).toBe("mise.toml");
  const isolated = isolationEnvironment();
  for (const key of ["HOME", "TMPDIR", "XDG_CONFIG_HOME", "XDG_CACHE_HOME", "XDG_DATA_HOME", "XDG_STATE_HOME", "MISE_DATA_DIR", "MISE_CACHE_DIR", "MISE_STATE_DIR", "MISE_CONFIG_DIR", "MISE_TMP_DIR", "MISE_GLOBAL_CONFIG_FILE", "MISE_SYSTEM_CONFIG_FILE", "MISE_SYSTEM_CONFIG_DIR", "MISE_SYSTEM_DIR"]) expect(isolated[key]!.startsWith(`${work}/cache/`)).toBe(true);
  expect(isolated.MISE_CEILING_PATHS).toBe(resolve(repository, "_work"));
  for (const key of ["MISE_AUTO_INSTALL", "MISE_TASK_RUN_AUTO_INSTALL", "MISE_AUTO_ENV"]) expect(isolated[key]).toBe("false");
  for (const key of ["MISE_NO_ENV", "MISE_NO_HOOKS", "MISE_PARANOID"]) expect(isolated[key]).toBe("1");
});

test("the implementation has no native-operation dispatch, nested supervisor, timer, retry or ambient environment", async () => {
  const source = await readFile(resolve(work, "cuda-isolation.ts"), "utf8");
  for (const pattern of [/\bfetch\s*\(/, /Bun\.\$/, /\bspawnSync\s*\(/, /\bexec(?:Sync|File|FileSync)?\s*\(/,
    /\brunBounded\s*\(/, /\bset(?:Timeout|Interval)\s*\(/, /process\.env/, /detached:\s*true/, /\b(?:mkdir|writeFile|unlink|rm|chmod)\s*\(/]) expect(source).not.toMatch(pattern);
  expect(source.match(/Bun\.spawn\(/g)).toHaveLength(1);
  expect(source).toContain("process.exitCode = result.exitCode");
  expect(source).not.toContain("--preserve-fds");
  expect(source).not.toContain("--new-session");
  expect(source).not.toContain("--unshare-pid");
});
