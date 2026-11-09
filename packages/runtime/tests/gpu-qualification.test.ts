// SPEC: _spec/gpu-qualification.puml
import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { cpuCoverage, executeQualification, gpuSelectors, qualificationPlan, readArtifacts, recordAttempt, testPassed, validateHostApproval, validateLimits } from "../../../tooling/runtime/qualification";
import { checkSources } from "../../../_work/gpu-owner-recovery/qualification/verify";

const root = new URL("../../../", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");
const prefix = (mode: string) => `/build/native/target-${mode}/x86_64-unknown-linux-gnu/release/`;
const limits = { perTestMs: 100, totalMs: 610, cleanupReserveMs: 10 };
const summary = (count: number, ignored = 0) => `\ntest result: ok. ${count} passed; 0 failed; ${ignored} ignored; 0 measured; 0 filtered out; finished in 0.01s\n`;

function fixture(mode: "cpu" | "gpu") {
  const rows: Record<string, any[]> = { learning: [], "policy-io": [] };
  const add = (owner: string, kind: string, name: string, isTest: boolean) => rows[owner]!.push({ reason: "compiler-artifact",
    package_id: `path+file:///build/native/crates/${owner}#chess-coach-${owner}@0.1.0`, target: { name, kind: [kind] }, profile: { test: isTest },
    features: mode === "gpu" ? ["default", "gpu-cuda", "gpu-prepared-llvm"] : ["default"],
    executable: prefix(mode) + (isTest ? `deps/${name}-1234` : name) });
  if (mode === "cpu") for (const id of Object.keys(cpuCoverage)) { const [owner, kind, name] = id.split(":"); add(owner!, kind!, name!, true); }
  else { add("learning", "test", "finite_difference", true); add("policy-io", "test", "gpu", true); }
  for (const binary of ["policy-score", "policy-channel", "policy-initialize"]) add("policy-io", "bin", binary, false);
  const logs = () => Object.fromEntries(Object.entries(rows).map(([owner, messages]) => [owner, [...messages, { reason: "build-finished", success: true }].map(value => JSON.stringify(value)).join("\n")])) as { learning: string; "policy-io": string };
  return { rows, logs };
}

test("one host approval binds one exclusive run ID rather than arbitrary labels", () => {
  const approval = { version: "chess-coach.host-qualification-approval.v1", hostExecutionApproved: true, mode: "gpu", campaign: "feasibility",
    maximumCampaignInvocations: 1, runId: "qualification-feasibility-1", limits };
  expect(() => validateHostApproval(approval, "gpu", approval.runId)).not.toThrow();
  expect(() => validateHostApproval(approval, "gpu", "qualification-feasibility-2")).toThrow("FRESH_HOST_APPROVAL_REQUIRED");
  expect(() => validateHostApproval(approval, "cpu", approval.runId)).toThrow("FRESH_HOST_APPROVAL_REQUIRED");
  expect(() => validateHostApproval({ ...approval, runId: undefined }, "gpu", approval.runId)).toThrow("FRESH_HOST_APPROVAL_REQUIRED");
});

test("capture failure retains the attempted command and result instead of a preflight label", async () => {
  const attempts: Parameters<typeof recordAttempt>[0] = [];
  let captures = 0;
  await expect(recordAttempt(attempts, "test", ["/fixture/harness"], 100, {
    execute: async () => ({ status: "PASS", exitCode: 0, failure: null }),
    capture: async () => { captures++; throw Error("STREAM_UNREADABLE"); },
  })).rejects.toThrow("STREAM_UNREADABLE");
  expect(attempts).toHaveLength(1);
  expect(attempts[0]).toMatchObject({ id: "test", attempted: true, exitCode: 0, status: "FAIL", failure: "Error: STREAM_UNREADABLE" });
  expect(captures).toBe(1);
});

test("unreadable source checks return failure data for the terminal receipt", async () => {
  const result = await checkSources([{ path: "fixture", sha256: "0".repeat(64) }], async () => { throw Error("SOURCE_DELETED"); });
  expect(result).toEqual({ sourceChanged: true, failure: "Error: SOURCE_DELETED" });
});

test("the approved LLVM batch retained exactly five flags-only results without renewal", async () => {
  const request = JSON.parse(await read("_work/gpu-owner-recovery/qualification/request.json"));
  const receipt = JSON.parse(await read("_work/gpu-owner-recovery/runs/gpu-qualification-llvm-flags-1/receipt.json"));
  expect(receipt.status).toBe("PASS_FLAGS_ONLY");
  expect(receipt.invocationsConsumed).toBe(5);
  expect(receipt.remainingInvocations).toBe(0);
  expect(receipt.results.map((result: { argv: string[] }) => result.argv)).toEqual(request.llvmQueries.map((flag: string) => [request.llvmExecutable, "--link-static", flag]));
  expect(receipt.results.every((result: { status: string; deadlineMs: number }) => result.status === "PASS" && result.deadlineMs === 10000)).toBe(true);
  for (const field of ["prefixModified", "prefixSelected", "prefixCopied", "versionQueryRepeated", "compilationPerformed", "downloadsPerformed", "hostGpuOperationPerformed", "trainingReady"]) expect(receipt[field]).toBe(false);
});

test("GPU plans reuse all six exact fixtures with the feasibility pair first", () => {
  const artifacts = readArtifacts(fixture("gpu").logs(), "gpu");
  const full = qualificationPlan("gpu", "full", artifacts.artifacts);
  expect(full.map(step => step.selector)).toEqual([...gpuSelectors]);
  expect(qualificationPlan("gpu", "feasibility", artifacts.artifacts)).toEqual(full.slice(0, 2));
  expect(full.slice(2, 4).every(step => step.executable.includes("finite_difference"))).toBe(true);
  expect(() => qualificationPlan("gpu", "regression", artifacts.artifacts)).toThrow("MODE_CAMPAIGN_MISMATCH");
});

test("CPU coverage preserves all 39 tests including valid zero-test harnesses", () => {
  const parsed = readArtifacts(fixture("cpu").logs(), "cpu");
  const plan = qualificationPlan("cpu", "regression", parsed.artifacts);
  expect(plan).toHaveLength(16);
  expect(plan.reduce((total, step) => total + step.count, 0)).toBe(39);
  expect(plan.some(step => step.count === 0)).toBe(true);
  expect(() => qualificationPlan("cpu", "full", parsed.artifacts)).toThrow("MODE_CAMPAIGN_MISMATCH");
});

test("CPU and GPU artifacts cannot substitute for one another", () => {
  expect(() => readArtifacts(fixture("cpu").logs(), "gpu")).toThrow("MODE_SPECIFIC_EXECUTABLE_REQUIRED");
  expect(() => readArtifacts(fixture("gpu").logs(), "cpu")).toThrow("MODE_SPECIFIC_EXECUTABLE_REQUIRED");
  const changed = fixture("gpu");
  changed.rows.learning![0].features = ["default"];
  expect(() => readArtifacts(changed.logs(), "gpu")).toThrow("ARTIFACT_FEATURE_MISMATCH");
  const cpu = fixture("cpu");
  cpu.rows.learning![0].features = [];
  expect(() => readArtifacts(cpu.logs(), "cpu")).not.toThrow();
});

test("artifact admission requires successful builds and complete unique harness coverage", () => {
  const value = fixture("gpu");
  expect(() => readArtifacts({ ...value.logs(), learning: value.logs().learning.replace('"success":true', '"success":false') }, "gpu")).toThrow("SUCCESSFUL_CARGO_BUILD_REQUIRED");
  value.rows.learning = [];
  expect(() => readArtifacts(value.logs(), "gpu")).toThrow("MISSING_HARNESS_COVERAGE");
  const duplicate = fixture("gpu");
  duplicate.rows.learning!.push(duplicate.rows.learning![0]);
  expect(() => readArtifacts(duplicate.logs(), "gpu")).toThrow("UNEXPECTED_OR_DUPLICATE_HARNESS");
});

test("only compiler artifacts select executables, never build-script output", () => {
  const value = fixture("gpu");
  value.rows.learning!.unshift({ reason: "build-script-executed", executable: "/arbitrary" });
  expect(readArtifacts(value.logs(), "gpu").artifacts.size).toBe(2);
  value.rows.learning![1].package_id = "registry+https://example.invalid#chess-coach-learning@0.1.0";
  expect(() => readArtifacts(value.logs(), "gpu")).toThrow("MISSING_HARNESS_COVERAGE");
});

test("compiled policy subprocess paths must survive unchanged", () => {
  const value = fixture("gpu");
  value.rows["policy-io"]!.find(row => row.target.name === "policy-channel").executable = prefix("gpu") + "other-policy-channel";
  expect(() => readArtifacts(value.logs(), "gpu")).toThrow("COMPILED_SUBPROCESS_PATH_REQUIRED");
  const traversal = fixture("gpu");
  traversal.rows.learning![0].executable = prefix("gpu") + "../debug/test";
  expect(() => readArtifacts(traversal.logs(), "gpu")).toThrow("MODE_SPECIFIC_EXECUTABLE_REQUIRED");
});

test("zero-match, ignored-only and duplicate summaries cannot pass GPU qualification", () => {
  const good = { status: "PASS", exitCode: 0, failure: null, stdout: summary(1) };
  expect(testPassed(good, 1)).toBe(true);
  expect(testPassed({ ...good, stdout: summary(0) }, 1)).toBe(false);
  expect(testPassed({ ...good, stdout: summary(1, 1) }, 1)).toBe(false);
  expect(testPassed({ ...good, stdout: summary(1) + summary(1) }, 1)).toBe(false);
  expect(testPassed({ ...good, exitCode: 1 }, 1)).toBe(false);
  expect(testPassed({ ...good, failure: "COMMAND_OUTPUT_BOUND" }, 1)).toBe(false);
});

test("GPU execution uses exact ignored selectors serially without automatic full escalation", async () => {
  const plan = qualificationPlan("gpu", "feasibility", readArtifacts(fixture("gpu").logs(), "gpu").artifacts);
  const calls: string[][] = [];
  const result = await executeQualification(plan, limits, { now: () => 0, run: async (_step, argv, deadlineMs) => {
    calls.push(argv); expect(deadlineMs).toBe(100);
    return { status: "PASS", exitCode: 0, failure: null, stdout: summary(1) };
  } });
  expect(result.status).toBe("PASS_TESTS_ONLY");
  expect(calls).toHaveLength(2);
  expect(calls[0]).toEqual([plan[0]!.executable, gpuSelectors[0], "--exact", "--ignored", "--test-threads=1", "--nocapture", "--color=never"]);
});

test("failure or timeout stops the campaign without retry or later tests", async () => {
  for (const failure of [null, "COMMAND_DEADLINE", "COMMAND_OUTPUT_BOUND"]) {
    const plan = qualificationPlan("gpu", "full", readArtifacts(fixture("gpu").logs(), "gpu").artifacts);
    let calls = 0;
    const result = await executeQualification(plan, limits, { now: () => 0, run: async () => {
      calls++; return { status: "FAIL", exitCode: 1, failure, stdout: summary(0) };
    } });
    expect(result.status).toBe("FAIL_TEST");
    expect(calls).toBe(1);
  }
});

test("missing campaign budgets fail and the cleanup reserve cannot fund another test", async () => {
  expect(() => validateLimits({ ...limits, perTestMs: 0 }, 6)).toThrow();
  expect(() => validateLimits({ ...limits, totalMs: 600 }, 6)).toThrow();
  expect(() => validateLimits({ ...limits, cleanupReserveMs: null as unknown as number }, 6)).toThrow();
  const plan = qualificationPlan("gpu", "full", readArtifacts(fixture("gpu").logs(), "gpu").artifacts);
  let time = 0, calls = 0;
  const outcome = await executeQualification(plan, limits, { now: () => time, run: async () => {
    calls++; time = 601; return { status: "PASS", exitCode: 0, failure: null, stdout: summary(1) };
  } });
  expect(outcome.status).toBe("FAIL_CAMPAIGN_DEADLINE");
  expect(calls).toBe(1);
});

test("the CPU runner checks each frozen count rather than treating zero aggregate as regression", async () => {
  const plan = qualificationPlan("cpu", "regression", readArtifacts(fixture("cpu").logs(), "cpu").artifacts);
  const outcome = await executeQualification(plan, { perTestMs: 100, totalMs: 1610, cleanupReserveMs: 10 }, {
    now: () => 0, run: async step => ({ status: "PASS", exitCode: 0, failure: null, stdout: summary(step.count) }),
  });
  expect(outcome.status).toBe("PASS_TESTS_ONLY");
  expect(outcome.results).toHaveLength(16);
});

test("source selectors, coordinate counts and CPU coverage match the unchanged Rust fixtures", async () => {
  const gpu = await read("crates/policy-io/tests/gpu.rs");
  const finite = await read("crates/learning/tests/finite_difference.rs");
  for (const selector of gpuSelectors) expect(gpu + finite).toContain(`fn ${selector}()`);
  expect(finite).toContain("assert_eq!(coordinates.len(), 2335);");
  expect(finite).toContain("let tolerance = 1e-8 + 1e-5 * expected.abs().max(central.abs());");
  expect(finite).toContain("(plus - minus) / (2.0 * 1e-6)");
  for (const [id, count] of Object.entries(cpuCoverage)) {
    const [owner, kind, name] = id.split(":");
    if (kind !== "test" || name === "gpu") continue;
    const text = await read(`crates/${owner}/tests/${name}.rs`);
    expect([...text.matchAll(/#\[test\]/g)].length - [...text.matchAll(/#\[ignore/g)].length).toBe(count);
  }
  expect(gpu).toContain('env!("CARGO_BIN_EXE_policy-channel")');
  expect(gpu).toContain('.join("_work/gpu-owner-recovery/scratch")');
});

test("qualification recipe builds tests without execution and preserves separated absolute paths", async () => {
  const recipe = await read("tooling/runtime/Dockerfile.gpu-qualification");
  const commands = recipe.replace(/\\\n\s*/g, " ").split("\n").filter(line => line.startsWith("RUN "));
  expect(commands.every(line => line.startsWith("RUN --network=none "))).toBe(true);
  const builds = commands.filter(line => line.includes("cargo test"));
  expect(builds).toHaveLength(4);
  expect(builds.every(line => line.includes("--no-run --message-format=json") && line.includes("--locked --offline --jobs 2"))).toBe(true);
  const cpu = recipe.split("FROM inputs AS cpu-build")[1]!.split("FROM inputs AS gpu-build")[0]!;
  expect(cpu).not.toContain("--features");
  expect(recipe).toContain("--features gpu-prepared-llvm --test finite_difference");
  expect(recipe).toContain("--features gpu-prepared-llvm --test gpu");
  for (const mode of ["cpu", "gpu"]) {
    expect(recipe).toContain(`CARGO_TARGET_DIR=/build/native/target-${mode}`);
    expect(recipe).toContain(`COPY --from=${mode}-build /build/native/target-${mode}/ /build/native/target-${mode}/`);
    expect(recipe).toContain(`FROM runtime AS ${mode}-qualification`);
  }
  expect(recipe).toContain("scratch/home");
  expect(recipe).toContain("chown -R 1000:1000 /build/native/_work");
  for (const forbidden of ["curl ", "wget ", "apt-get ", "mise install", "DOCS_RS", "CARGO_FEATURE_XTASK"]) expect(recipe).not.toContain(forbidden);
});

test("the input packet leaves operations, unresolved inputs and training unapproved", async () => {
  const packet = JSON.parse(await read("_work/gpu-owner-recovery/qualification/host-inputs.json"));
  expect(Object.values(packet.approval).every(value => value === false)).toBe(true);
  expect(packet.llvm.selection).toBeNull();
  expect(packet.cuda.bindingVersion).toBeNull();
  expect(packet.cuda.libdeviceSource).toBeNull();
  expect(packet.trainingReady).toBe(false);
  expect(packet.numerics).toEqual({ dtype: "F64", finiteDifferenceCoordinates: 4670, eps: 1e-6, atol: 1e-8, rtol: 1e-5,
    initialization: "CPU_FLEX", masters: [101, 102, 103, 104, 105], c12: "EXACT_DIGEST_AGREEMENT_NO_TOLERANCE" });
  expect(packet.proposedLimitsNotApproved.gpuCooperativeCeilingsAndTelemetry).toBeNull();
  expect(packet.fullAssuranceHardening).toBe("DEFERRED_UNTIL_ALL_PLANNED_TRAINING_COMPLETES_AND_RESULTS_VALIDATE");
});
