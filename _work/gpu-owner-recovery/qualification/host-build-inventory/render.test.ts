// SPEC: _spec/gpu-host-build-inventory.puml
import { expect, test } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import plan from "./plan.json";
import { collectInventory, retainedPrefix, selectedContainer, type InventoryIO, type Query } from "./collector";
import { inventoryProgram, renderHostBuildInventory } from "./render";
import { sourceInventory } from "../../../../tooling/runtime/qualification";

const builder = () => ({ Name: "selected", Driver: "docker-container", Nodes: [{ Name: "selected0", Endpoint: "default", Status: "running" }] });
function fixture() {
  const calls: Query[] = [], state = { builder: builder(), fail: "", malformed: "", now: 0, dockerHost: undefined as string | undefined };
  const values: Record<string, string> = { "context-name": "default\n", "context-endpoint": '{"DockerEndpoint":"unix:///var/run/docker.sock"}',
    engine: '{"NCPU":8,"MemTotal":17179869184}', "pinned-images": '{"Id":"rust","RepoDigests":[]}\n{"Id":"bun","RepoDigests":[]}\n',
    "host-filesystem": "Filesystem 1024-blocks Used Available Capacity Mounted on\n", "host-memory": "MemAvailable: 10000000 kB\n", "selected-builder-container": '{"State":"running","Memory":0,"NanoCpus":0}' };
  const io: InventoryIO = { now: () => state.now, get dockerHost() { return state.dockerHost; }, run: async query => {
    calls.push(query);
    return { exitCode: query.id === state.fail ? 1 : 0, failure: null, stdout: query.id === state.malformed ? "not-json" : query.id === "selected-builder" ? JSON.stringify(state.builder) : values[query.id]! };
  } };
  return { calls, state, io };
}

test("proposal grants no operation and requires no publication or helper fetch", () => {
  expect(plan.hostExecutionApproved).toBe(false); expect(plan.sourcePublicationRequired).toBe(false); expect(plan.helperDownloads).toBe(0);
  expect(plan.maximumHostInvocations).toBe(1); expect(plan.trainingReady).toBe(false);
  expect(plan.limits.maximumQueries * plan.limits.perQueryStreamBytes * 2).toBe(plan.limits.allQueryStreamBytes);
  expect(plan.limits.workerTermMs + plan.limits.workerKillGraceMs).toBe(plan.limits.overallMs);
  expect(plan.limits.queryTermMs + plan.limits.queryKillGraceMs).toBe(5000);
});

test("one fixed sequence inspects only the selected builder, both pins and one derived container", async () => {
  const f = fixture(), result = await collectInventory(plan, f.io);
  expect(result.status).toBe("PASS_METADATA_ONLY"); expect(result.failure).toBeNull();
  expect(f.calls.map(call => call.id)).toEqual(["context-name", "context-endpoint", "selected-builder", "engine", "pinned-images", "host-filesystem", "host-memory", "selected-builder-container"]);
  expect(f.calls[2]!.argv).toEqual(["docker", "buildx", "inspect", "--format", "{{json .}}"]);
  expect(f.calls[4]!.argv.slice(0, 5)).toEqual(["docker", "image", "inspect", ...plan.images]);
  expect(f.calls[7]!.argv.slice(0, 4)).toEqual(["docker", "container", "inspect", "buildx_buildkit_selected0"]);
  expect(f.calls[5]!.argv).toEqual(["df", "-Pk", "--", "_work/gpu-owner-recovery/cache/host-receive-2/context"]);
  for (const call of f.calls) expect(call.argv).not.toContain("--bootstrap");
});

test("metadata PASS does not certify configured zero limits or any build capability", async () => {
  const f = fixture(), result = await collectInventory(plan, f.io);
  expect(result.metadata.builderContainer).toEqual({ State: "running", Memory: 0, NanoCpus: 0 });
  expect(result.unknowns).toContain("EFFECTIVE_WORKER_RESOURCE_ENFORCEMENT"); expect(result.unknowns).toContain("CANCELLATION_EFFECTIVENESS");
  expect(result.unknowns).toContain("BUILDKIT_CONTENT_STORE_IMAGE_AVAILABILITY"); expect(result.unknowns).toContain("HOST_CAPACITY_EQUALS_BUILDER_CAPACITY");
  for (const key of ["buildAuthorized", "buildPerformed", "containerExecutionPerformed", "imagePullPerformed", "nativeExecuted", "gpuExecuted", "trainingExecuted", "trainingReady"] as const) expect(result[key]).toBe(false);
  expect(result.remainingHostInvocations).toBe(0); expect(result.automaticRetryAuthorized).toBe(false);
});

for (const id of ["context-name", "context-endpoint", "selected-builder", "engine", "pinned-images", "host-filesystem", "host-memory", "selected-builder-container"]) {
  test(`nonzero ${id} stops without repair, fallback query or retry`, async () => {
    const f = fixture(); f.state.fail = id;
    const result = await collectInventory(plan, f.io);
    expect(result.status).toBe("FAIL_METADATA_ONLY"); expect(f.calls.at(-1)?.id).toBe(id);
    expect(result.results.at(-1)?.exitCode).toBe(1); expect(f.calls.filter(call => call.id === id)).toHaveLength(1);
  });
}

for (const reason of ["QUERY_DEADLINE", "QUERY_OUTPUT_LIMIT", "QUERY_CAPTURE_FAILED", "QUERY_SPAWN_FAILED", "HOST_INVENTORY_INTERRUPTED"]) {
  test(`${reason} remains failure evidence`, async () => {
    const result = await collectInventory(plan, { now: () => 0, run: async () => ({ exitCode: null, failure: reason, stdout: "" }) });
    expect(result.status).toBe("FAIL_METADATA_ONLY"); expect(result.failure).toBe(reason); expect(result.results).toHaveLength(1);
  });
}

test("malformed or unsupported JSON format stops before subsequent queries", async () => {
  for (const id of ["context-endpoint", "selected-builder", "engine", "pinned-images", "selected-builder-container"]) {
    const f = fixture(); f.state.malformed = id;
    const result = await collectInventory(plan, f.io);
    expect(result.status).toBe("FAIL_METADATA_ONLY"); expect(f.calls.at(-1)?.id).toBe(id);
  }
});

test("single-node local derivation rejects alternative endpoints, states and ambiguous names", () => {
  const b = builder(), endpoint = "unix:///var/run/docker.sock";
  expect(selectedContainer(b, "default", endpoint)).toEqual({ container: "buildx_buildkit_selected0", reason: null });
  expect(selectedContainer({ ...b, Driver: "docker" }, "default", endpoint).reason).toBe("SKIPPED_DRIVER_HAS_NO_SELECTED_BUILDER_CONTAINER");
  expect(selectedContainer({ ...b, Nodes: [b.Nodes[0], b.Nodes[0]] }, "default", endpoint).reason).toBe("SKIPPED_NOT_SINGLE_NODE");
  expect(selectedContainer({ ...b, Nodes: [{ ...b.Nodes[0], Status: "stopped" }] }, "default", endpoint).reason).toBe("SKIPPED_NODE_NOT_REPORTED_RUNNING");
  for (const value of ["other", "tcp://remote:2376", undefined]) expect(selectedContainer({ ...b, Nodes: [{ ...b.Nodes[0], Endpoint: value }] }, "default", endpoint).container).toBeNull();
  expect(selectedContainer(b, "default", "tcp://remote:2376").container).toBeNull();
  expect(selectedContainer(b, "default", endpoint, "tcp://remote:2376").container).toBeNull();
  for (const name of ["../other", "--all", "", "a b", "x".repeat(121)]) expect(selectedContainer({ ...b, Nodes: [{ ...b.Nodes[0], Name: name }] }, "default", endpoint).container).toBeNull();
});

test("non-container drivers yield seven metadata queries and explicit unknowns, not setup", async () => {
  const f = fixture(); f.state.builder.Driver = "docker";
  const result = await collectInventory(plan, f.io);
  expect(result.status).toBe("PASS_METADATA_ONLY"); expect(f.calls).toHaveLength(7);
  expect(result.skipped).toEqual([{ id: "selected-builder-container", reason: "SKIPPED_DRIVER_HAS_NO_SELECTED_BUILDER_CONTAINER" }]);
});

test("monotonic sequence deadline and query-count bounds stop the orchestration", async () => {
  const f = fixture(); f.state.now = -1; let calls = 0;
  const r = await collectInventory(plan, { now: () => calls++ === 0 ? 0 : 45000, run: f.io.run });
  expect(r.failure).toBe("INVENTORY_SEQUENCE_DEADLINE"); expect(f.calls).toHaveLength(0);
  const b = await collectInventory({ ...plan, limits: { ...plan.limits, maximumQueries: 1 } }, fixture().io);
  expect(b.failure).toBe("QUERY_COUNT_LIMIT"); expect(b.results).toHaveLength(1);
});

test("stream retention keeps only the bounded prefix, including exact-boundary chunks", () => {
  expect([...retainedPrefix(new Uint8Array([1, 2, 3]), 0, 2)]).toEqual([1, 2]);
  expect(retainedPrefix(new Uint8Array([1, 2]), 32768, 32768)).toHaveLength(0);
  expect(retainedPrefix(new Uint8Array([1, 2]), 32766, 32768)).toHaveLength(2);
});

test("inline JS contains only builtin imports, no local helper dependency or invocation during rendering", async () => {
  const program = await inventoryProgram();
  expect(program).not.toMatch(/from ["']\.\.?\//); expect(program).not.toContain('import type');
  expect(program).toContain("await runHostInventory(");
  expect(() => new Bun.Transpiler({ loader: "js" }).scan(program)).not.toThrow();
  expect(Buffer.byteLength(program)).toBeLessThan(65536);
});

test("Fish literal selects exact Mise pins without implicit install and retains status and streams", async () => {
  const command = await renderHostBuildInventory();
  expect(command).toStartWith("fish --no-config -c '");
  expect(command).toContain("core:bun@1.4.0 core:rust@1.95.0");
  for (const name of ["MISE_AUTO_INSTALL", "MISE_EXEC_AUTO_INSTALL", "MISE_TASK_RUN_AUTO_INSTALL"]) expect(command.indexOf(`set -gx ${name} false`)).toBeLessThan(command.indexOf("mise exec "));
  const unquote = (text: string) => text.slice(1, -1).replace(/\\([\\'])/g, "$1");
  const parent = unquote(command.slice("fish --no-config -c ".length));
  const marker = "command timeout --signal=TERM --kill-after=5s 55s fish --no-config -c ";
  const checked = unquote(parent.slice(parent.indexOf(marker) + marker.length, parent.indexOf(' > "$evidence/worker.stdout"')));
  expect(checked).toContain('fish --no-config -n -c "$program"');
  expect(checked).toContain('; or exit $status; fish --no-config -c "$program"');
  expect(parent.indexOf("set -l code $status")).toBeGreaterThan(parent.indexOf(marker));
  expect(parent).toContain('"$evidence/command.exit"');
  for (const text of ["--kill-after=5s 55s", "worker.stdout", "worker.stderr", "command.exit", "HOST_BUILD_INVENTORY_EXIT=%s", "--approved-host-build-inventory-1"]) expect(command).toContain(text);
  expect(command).not.toMatch(/mise (install|trust|use|upgrade)|rustc --version|cargo --version|llvm-config --version|nvidia-smi|gh api/);
});

test("native65 and both production recipes retain their prepared identities", async () => {
  const prepared = JSON.parse(await readFile("_work/gpu-owner-recovery/runs/host-feasibility-inputs-1/preparation.json", "utf8"));
  expect(await sourceInventory(process.cwd())).toEqual(prepared.nativeSourceInventory);
  const sources = JSON.parse(await readFile("_work/gpu-owner-recovery/runs/gpu-prepared-llvm-local-6/sources.json", "utf8"));
  for (const path of ["tooling/runtime/Dockerfile", "tooling/runtime/Dockerfile.gpu"]) {
    const expected = sources.find((row: { path: string }) => row.path === path);
    expect(createHash("sha256").update(await readFile(path)).digest("hex")).toBe(expected.sha256);
  }
});

for (const mode of ["pass", "overflow", "deadline"] as const) {
  test(`standalone mocked-query e2e ${mode} preserves receipt and separate bounded streams`, async () => {
    const base = process.env.INVENTORY_TEST_EVIDENCE;
    if (!base) throw Error("REPOSITORY_OWNED_E2E_EVIDENCE_REQUIRED");
    const evidence = resolve(base, mode); await mkdir(evidence);
    await writeFile(evidence + "/fixture-scope.json", JSON.stringify({ scope: "SOURCE_ONLY_MOCKED_QUERIES_NOT_HOST_EVIDENCE", actualDockerQueries: 0, nativeOrGpuExecution: false }) + "\n", { flag: "wx" });
    const p = { ...plan, context: ".", evidence, limits: { ...plan.limits, queryTermMs: 300, queryKillGraceMs: 100 } };
    const outputs: Record<string, string> = { context: "default\n", endpoint: '{"DockerEndpoint":"unix:///var/run/docker.sock"}',
      builder: JSON.stringify(builder()), engine: '{"NCPU":2}', images: '{"Id":"rust","RepoDigests":[]}\n{"Id":"bun","RepoDigests":[]}\n',
      filesystem: "Filesystem mocked\n", memory: "MemAvailable: 12345 kB\n", container: '{"State":"running","Memory":0}' };
    const fixtureJs = `const a=JSON.parse(process.argv.at(-1)); const outputs=${JSON.stringify(outputs)}; let id=a[0]==="context"?(a[1]==="show"?"context":"endpoint"):a[0]==="buildx"?"builder":a[0]==="info"?"engine":a[0]==="image"?"images":a[0]==="container"?"container":a[0]==="-Pk"?"filesystem":"memory"; if(id==="engine"&&${JSON.stringify(mode)}==="overflow"){process.stdout.write("x".repeat(65536));process.stderr.write("y".repeat(65536));setInterval(()=>{},10000);} else if(id==="engine"&&${JSON.stringify(mode)}==="deadline"){process.on("SIGTERM",()=>{});setInterval(()=>{},10000);} else process.stdout.write(outputs[id]);`;
    const original = await inventoryProgram(), suffix = `\nawait runHostInventory(${JSON.stringify(plan)});`;
    expect(original.endsWith(suffix)).toBe(true);
    const program = original.slice(0, -suffix.length) + `\nawait runHostInventory(${JSON.stringify(p)}, (_file,args,options)=>spawn(process.execPath,["--no-env-file","--no-install","--eval",${JSON.stringify(fixtureJs)},"--",JSON.stringify(args)],options));`;
    const child = Bun.spawn([process.execPath, "--no-env-file", "--no-install", "--eval", program, "--", plan.grant], { cwd: process.cwd(), stdin: "ignore", stdout: "pipe", stderr: "pipe" });
    const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
    await writeFile(evidence + "/outer.stdout", stdout, { flag: "wx" }); await writeFile(evidence + "/outer.stderr", stderr, { flag: "wx" });
    expect(stderr).toBe(""); expect(exitCode).toBe(mode === "pass" ? 0 : 1);
    const receipt = JSON.parse(await readFile(evidence + "/receipt.json", "utf8"));
    expect(receipt.status).toBe(mode === "pass" ? "PASS_METADATA_ONLY" : "FAIL_METADATA_ONLY");
    expect(receipt.failure).toBe(mode === "pass" ? null : mode === "overflow" ? "QUERY_OUTPUT_LIMIT" : "QUERY_DEADLINE");
    expect(receipt.results).toHaveLength(mode === "pass" ? 8 : 4);
    for (const capture of receipt.captures) for (const stream of capture.streams) {
      const bytes = await readFile(stream.path); expect(bytes.length).toBeLessThanOrEqual(32768);
      expect(bytes.length).toBe(stream.bytes); expect(createHash("sha256").update(bytes).digest("hex")).toBe(stream.sha256);
    }
    if (mode === "overflow") expect(receipt.captures.at(-1).streams.some((stream: { seenBytes: number; bytes: number }) => stream.seenBytes > stream.bytes)).toBe(true);
    if (mode === "deadline") expect(receipt.captures.at(-1).elapsedMs).toBeLessThan(2000);
  });
}
