// SPEC: _spec/gpu-host-build-inventory.puml
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { open, readFile, stat, writeFile } from "node:fs/promises";
import type plan from "./plan.json";

type Plan = typeof plan;
export type Query = { id: string; argv: string[] };
export type QueryOutput = { exitCode: number | null; failure: string | null; stdout: string };
export type InventoryIO = { now(): number; run(query: Query): Promise<QueryOutput>; dockerHost?: string };
const requireValue = (value: unknown, label: string) => { if (!value) throw Error(label); };
const object = (text: string): Record<string, any> => {
  const value = JSON.parse(text);
  requireValue(value && typeof value === "object" && !Array.isArray(value), "METADATA_OBJECT_REQUIRED");
  return value;
};
const contextFormat = '{"DockerEndpoint":{{json .Endpoints.docker.Host}}}';
const engineFormat = '{"ID":{{json .ID}},"ServerVersion":{{json .ServerVersion}},"NCPU":{{json .NCPU}},"MemTotal":{{json .MemTotal}},"DockerRootDir":{{json .DockerRootDir}},"CgroupDriver":{{json .CgroupDriver}},"CgroupVersion":{{json .CgroupVersion}}}';
const imageFormat = '{"Id":{{json .Id}},"RepoDigests":{{json .RepoDigests}},"Os":{{json .Os}},"Architecture":{{json .Architecture}},"Size":{{json .Size}}}';
const containerFormat = '{"Id":{{json .Id}},"State":{{json .State.Status}},"NanoCpus":{{json .HostConfig.NanoCpus}},"CpuQuota":{{json .HostConfig.CpuQuota}},"CpuPeriod":{{json .HostConfig.CpuPeriod}},"Memory":{{json .HostConfig.Memory}},"MemorySwap":{{json .HostConfig.MemorySwap}},"CgroupParent":{{json .HostConfig.CgroupParent}},"NetworkMode":{{json .HostConfig.NetworkMode}}}';

export function selectedContainer(builder: Record<string, any>, context: string, endpoint: string, dockerHost?: string) {
  if (builder.Driver !== "docker-container") return { container: null, reason: "SKIPPED_DRIVER_HAS_NO_SELECTED_BUILDER_CONTAINER" };
  if (!Array.isArray(builder.Nodes) || builder.Nodes.length !== 1) return { container: null, reason: "SKIPPED_NOT_SINGLE_NODE" };
  const node = builder.Nodes[0];
  if (!node || node.Status !== "running") return { container: null, reason: "SKIPPED_NODE_NOT_REPORTED_RUNNING" };
  if (!endpoint.startsWith("unix://") || (dockerHost !== undefined && dockerHost !== endpoint) || ![context, endpoint].includes(node.Endpoint)) return { container: null, reason: "SKIPPED_NODE_NOT_SELECTED_LOCAL_ENDPOINT" };
  if (typeof node.Name !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,119}$/.test(node.Name)) return { container: null, reason: "SKIPPED_NODE_NAME_NOT_UNAMBIGUOUS" };
  return { container: "buildx_buildkit_" + node.Name, reason: null };
}

export async function collectInventory(p: Plan, io: InventoryIO) {
  const results: { id: string; argv: string[]; exitCode: number | null; failure: string | null }[] = [];
  const metadata: Record<string, unknown> = {}, skipped: { id: string; reason: string }[] = [];
  let failure: string | null = null, last = io.now();
  const started = last;
  const run = async (id: string, argv: string[]) => {
    requireValue(results.length < p.limits.maximumQueries, "QUERY_COUNT_LIMIT");
    const now = io.now(); requireValue(Number.isFinite(now) && now >= last && now - started < 45000, "INVENTORY_SEQUENCE_DEADLINE"); last = now;
    const query = { id, argv }, attempt = { ...query, exitCode: null as number | null, failure: null as string | null };
    results.push(attempt);
    try {
      const out = await io.run(query); attempt.exitCode = out.exitCode; attempt.failure = out.failure;
      requireValue(out.exitCode === 0 && out.failure === null, out.failure ?? "QUERY_NONZERO:" + id);
      return out.stdout.trim();
    } catch (error) { attempt.failure ??= error instanceof Error ? error.message : "QUERY_FAILED"; throw error; }
  };
  try {
    const context = await run("context-name", ["docker", "context", "show"]);
    requireValue(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(context), "CONTEXT_NAME_REQUIRED"); metadata.contextName = context;
    const endpoint = object(await run("context-endpoint", ["docker", "context", "inspect", context, "--format", contextFormat]));
    requireValue(typeof endpoint.DockerEndpoint === "string", "DOCKER_ENDPOINT_REQUIRED"); metadata.contextEndpoint = endpoint;
    metadata.dockerHostOverridePresent = io.dockerHost !== undefined;
    const builder = object(await run("selected-builder", ["docker", "buildx", "inspect", "--format", "{{json .}}"]));
    requireValue(typeof builder.Name === "string" && typeof builder.Driver === "string" && Array.isArray(builder.Nodes), "SELECTED_BUILDER_METADATA_REQUIRED");
    metadata.builder = builder;
    metadata.engine = object(await run("engine", ["docker", "info", "--format", engineFormat]));
    const images = (await run("pinned-images", ["docker", "image", "inspect", ...p.images, "--format", imageFormat])).split("\n").map(object);
    requireValue(images.length === 2 && images.every(image => typeof image.Id === "string" && Array.isArray(image.RepoDigests)), "TWO_LOCAL_IMAGE_METADATA_RECORDS_REQUIRED");
    metadata.images = images;
    metadata.hostFilesystem = await run("host-filesystem", ["df", "-Pk", "--", p.context]);
    metadata.hostMemory = await run("host-memory", ["cat", "/proc/meminfo"]);
    const chosen = selectedContainer(builder, context, endpoint.DockerEndpoint, io.dockerHost);
    if (chosen.container !== null) metadata.builderContainer = object(await run("selected-builder-container", ["docker", "container", "inspect", chosen.container, "--format", containerFormat]));
    else skipped.push({ id: "selected-builder-container", reason: chosen.reason! });
  } catch (error) { failure = error instanceof Error ? error.message : "INVENTORY_FAILED"; }
  return { version: "chess-coach.host-build-inventory.v1", status: failure === null ? "PASS_METADATA_ONLY" : "FAIL_METADATA_ONLY", failure, results, skipped, metadata,
    unknowns: ["EFFECTIVE_WORKER_RESOURCE_ENFORCEMENT", "BUILDKIT_CONTENT_STORE_IMAGE_AVAILABILITY", "OFFLINE_IMAGE_RESOLUTION", "COMPILER_AND_RUNTIME_USABILITY", "CANCELLATION_EFFECTIVENESS", "HOST_CAPACITY_EQUALS_BUILDER_CAPACITY"],
    hostInvocationsConsumed: 1, remainingHostInvocations: 0, automaticRetryAuthorized: false, buildAuthorized: false, buildPerformed: false,
    containerExecutionPerformed: false, imagePullPerformed: false, nativeExecuted: false, gpuExecuted: false, trainingExecuted: false, trainingReady: false };
}

export function retainedPrefix(chunk: Uint8Array, retained: number, limit: number) {
  return chunk.subarray(0, Math.max(0, Math.min(chunk.length, limit - retained)));
}

export async function runHostInventory(p: Plan, launch: typeof spawn = spawn) {
  requireValue(Bun.argv.at(-1) === p.grant && Bun.version === "1.4.0", "APPROVED_PINNED_HOST_INVENTORY_CONTEXT_REQUIRED");
  const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
  const captures: { id: string; elapsedMs: number; streams: { path: string; bytes: number; seenBytes: number; sha256: string }[] }[] = [];
  let activeStop: ((reason: string) => void) | null = null, interrupted = false;
  const interrupt = () => { interrupted = true; activeStop?.("HOST_INVENTORY_INTERRUPTED"); };
  process.on("SIGTERM", interrupt); process.on("SIGINT", interrupt);
  let preflightFailure: string | null = null;
  try {
    requireValue((await stat(p.context)).isDirectory(), "RECEIVED_CONTEXT_DIRECTORY_REQUIRED");
    requireValue(hash(await readFile("Cargo.lock")) === "77f674cc26a01f26558fd99c45bdcd5566017be05833fce1d39cae98cda05955", "HOST_REPOSITORY_CONTEXT_REQUIRED");
  } catch (error) { preflightFailure = error instanceof Error ? error.message : "INVENTORY_PREFLIGHT_FAILED"; }
  const receipt = await collectInventory(p, { now: () => performance.now(), dockerHost: process.env.DOCKER_HOST, run: async query => {
    requireValue(!preflightFailure && !interrupted, preflightFailure ?? "HOST_INVENTORY_INTERRUPTED");
    const started = performance.now(), handles: Awaited<ReturnType<typeof open>>[] = [];
    try { for (const stream of ["stdout", "stderr"]) handles.push(await open(`${p.evidence}/${query.id}.${stream}`, "wx", 0o600)); }
    catch (error) { await Promise.all(handles.map(handle => handle.close())); throw error; }
    const child = launch(query.argv[0]!, query.argv.slice(1), { detached: true, stdio: ["ignore", "pipe", "pipe"], env: process.env });
    let failure: string | null = null, term: ReturnType<typeof setTimeout> | undefined, kill: ReturnType<typeof setTimeout> | undefined;
    const signal = (name: NodeJS.Signals) => { if (child.pid) { try { process.kill(-child.pid, name); } catch {} } };
    const stop = (reason: string) => { failure ??= reason; signal("SIGTERM"); kill ??= setTimeout(() => signal("SIGKILL"), p.limits.queryKillGraceMs); };
    activeStop = stop;
    term = setTimeout(() => stop("QUERY_DEADLINE"), p.limits.queryTermMs);
    const done = new Promise<number | null>(resolveDone => { child.once("error", () => { failure ??= "QUERY_SPAWN_FAILED"; resolveDone(null); }); child.once("close", resolveDone); });
    const streams: { path: string; bytes: number; seenBytes: number; sha256: string }[] = [], stdout: Buffer[] = [];
    const drain = async (stream: "stdout" | "stderr", index: number) => {
      const digest = createHash("sha256"); let bytes = 0, seenBytes = 0;
      try {
        for await (const part of child[stream]!) {
          const chunk = Buffer.from(part); seenBytes += chunk.length;
          const kept = retainedPrefix(chunk, bytes, p.limits.perQueryStreamBytes);
          if (kept.length) { await handles[index]!.writeFile(kept); digest.update(kept); bytes += kept.length; if (stream === "stdout") stdout.push(Buffer.from(kept)); }
          if (kept.length < chunk.length) stop("QUERY_OUTPUT_LIMIT");
        }
      } catch { stop("QUERY_CAPTURE_FAILED"); }
      finally { streams[index] = { path: `${p.evidence}/${query.id}.${stream}`, bytes, seenBytes, sha256: digest.digest("hex") }; }
    };
    let exitCode: number | null = null;
    try { [exitCode] = await Promise.all([done, drain("stdout", 0), drain("stderr", 1)]); }
    finally {
      if (term) clearTimeout(term); if (kill) clearTimeout(kill);
      signal("SIGKILL"); activeStop = null;
      await Promise.all(handles.map(handle => handle.close()));
      captures.push({ id: query.id, elapsedMs: performance.now() - started, streams });
    }
    return { exitCode, failure, stdout: Buffer.concat(stdout).toString("utf8") };
  } });
  process.off("SIGTERM", interrupt); process.off("SIGINT", interrupt);
  const bytes = Buffer.from(JSON.stringify({ ...receipt, limits: p.limits, endpointScope: p.endpointScope, captures, parentDiagnosticsHaveOnlyPostExitSoftSizeCheck: true }, null, 2) + "\n");
  requireValue(bytes.length <= p.limits.receiptBytes, "INVENTORY_RECEIPT_SIZE_LIMIT");
  await writeFile(p.evidence + "/receipt.json", bytes, { flag: "wx" });
  console.log(JSON.stringify({ status: receipt.status, failure: receipt.failure, receipt: p.evidence + "/receipt.json", queries: receipt.results.length, trainingReady: false }));
  process.exitCode = receipt.status === "PASS_METADATA_ONLY" ? 0 : 1;
}
