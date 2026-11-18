fish --no-config -c 'set -l evidence \'_work/gpu-owner-recovery/runs/host-build-inventory-2\'; command mkdir -- "$evidence"; or exit 1; command timeout --signal=TERM --kill-after=5s 55s fish --no-config -c \'set -l program \\\'set -gx MISE_AUTO_INSTALL false; set -gx MISE_EXEC_AUTO_INSTALL false; set -gx MISE_TASK_RUN_AUTO_INSTALL false; command mise exec core:bun@1.4.0 core:rust@1.95.0 -- bun --no-env-file --no-install --eval \\\\\\\'import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { open, readFile, stat, writeFile } from "node:fs/promises";
const requireValue = (value, label) => {
  if (!value)
    throw Error(label);
}, object = (text) => {
  const value = JSON.parse(text);
  requireValue(value && typeof value === "object" && !Array.isArray(value), "METADATA_OBJECT_REQUIRED");
  return value;
}, contextFormat = \\\\\\\\\\\\\\\'{"DockerEndpoint":{{json .Endpoints.docker.Host}}}\\\\\\\\\\\\\\\', engineFormat = \\\\\\\\\\\\\\\'{"ID":{{json .ID}},"ServerVersion":{{json .ServerVersion}},"NCPU":{{json .NCPU}},"MemTotal":{{json .MemTotal}},"DockerRootDir":{{json .DockerRootDir}},"CgroupDriver":{{json .CgroupDriver}},"CgroupVersion":{{json .CgroupVersion}}}\\\\\\\\\\\\\\\', imageFormat = \\\\\\\\\\\\\\\'{"Id":{{json .Id}},"RepoDigests":{{json .RepoDigests}},"Os":{{json .Os}},"Architecture":{{json .Architecture}},"Size":{{json .Size}}}\\\\\\\\\\\\\\\', containerFormat = \\\\\\\\\\\\\\\'{"Id":{{json .Id}},"State":{{json .State.Status}},"NanoCpus":{{json .HostConfig.NanoCpus}},"CpuQuota":{{json .HostConfig.CpuQuota}},"CpuPeriod":{{json .HostConfig.CpuPeriod}},"Memory":{{json .HostConfig.Memory}},"MemorySwap":{{json .HostConfig.MemorySwap}},"CgroupParent":{{json .HostConfig.CgroupParent}},"NetworkMode":{{json .HostConfig.NetworkMode}}}\\\\\\\\\\\\\\\';
export function parseBuilderInspect(text) {
  const header = {}, nodes = [];
  let inNodes = !1, node;
  for (const line of text.split(/\\\\\\\\\\\\\\\\r?\\\\\\\\\\\\\\\\n/)) {
    if (!line || /^\\\\\\\\\\\\\\\\s/.test(line))
      continue;
    if (/^Nodes:\\\\\\\\\\\\\\\\s*$/.test(line)) {
      requireValue(!inNodes, "DUPLICATE_BUILDER_NODES_SECTION");
      inNodes = !0;
      continue;
    }
    const field = /^(Name|Driver|Endpoint|Status|Error):[ \\\\\\\\\\\\\\\\t]*(.*)$/.exec(line);
    if (!field)
      continue;
    const key = field[1], value = field[2].trim();
    requireValue(value.length > 0, "EMPTY_BUILDER_FIELD:" + key);
    if (!inNodes) {
      requireValue(["Name", "Driver", "Error"].includes(key) && !Object.hasOwn(header, key), "AMBIGUOUS_BUILDER_HEADER:" + key);
      header[key] = value;
    } else if (key === "Name") {
      requireValue(!nodes.some((row) => row.Name === value), "DUPLICATE_BUILDER_NODE");
      node = { Name: value };
      nodes.push(node);
    } else {
      requireValue(node && ["Endpoint", "Status", "Error"].includes(key) && !Object.hasOwn(node, key), "AMBIGUOUS_BUILDER_NODE_FIELD:" + key);
      Object.assign(node, { [key]: value });
    }
  }
  requireValue(header.Name && header.Driver && (inNodes || header.Error), "BUILDER_TEXT_HEADERS_REQUIRED");
  return { Name: header.Name, Driver: header.Driver, ...header.Error ? { Error: header.Error } : {}, Nodes: nodes };
}
export function selectedContainer(builder, context, endpoint, dockerHost) {
  if (builder.Error || builder.Nodes?.some((node) => node?.Error))
    return { container: null, reason: "SKIPPED_BUILDER_REPORTED_ERROR" };
  if (builder.Driver !== "docker-container")
    return { container: null, reason: "SKIPPED_DRIVER_HAS_NO_SELECTED_BUILDER_CONTAINER" };
  if (!Array.isArray(builder.Nodes) || builder.Nodes.length !== 1)
    return { container: null, reason: "SKIPPED_NOT_SINGLE_NODE" };
  const node = builder.Nodes[0];
  if (!node || node.Status !== "running")
    return { container: null, reason: "SKIPPED_NODE_NOT_REPORTED_RUNNING" };
  if (!endpoint.startsWith("unix://") || dockerHost !== void 0 && dockerHost !== endpoint || ![context, endpoint].includes(node.Endpoint))
    return { container: null, reason: "SKIPPED_NODE_NOT_SELECTED_LOCAL_ENDPOINT" };
  if (typeof node.Name !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,119}$/.test(node.Name))
    return { container: null, reason: "SKIPPED_NODE_NAME_NOT_UNAMBIGUOUS" };
  return { container: "buildx_buildkit_" + node.Name, reason: null };
}
export async function collectInventory(p, io) {
  const results = [], metadata = {}, skipped = [];
  let failure = null, last = io.now();
  const started = last, run = async (id, argv) => {
    requireValue(results.length < p.limits.maximumQueries, "QUERY_COUNT_LIMIT");
    const now = io.now();
    requireValue(Number.isFinite(now) && now >= last && now - started < 45000, "INVENTORY_SEQUENCE_DEADLINE");
    last = now;
    const query = { id, argv }, attempt = { ...query, exitCode: null, failure: null };
    results.push(attempt);
    try {
      const out = await io.run(query);
      attempt.exitCode = out.exitCode;
      attempt.failure = out.failure;
      requireValue(out.exitCode === 0 && out.failure === null, out.failure ?? "QUERY_NONZERO:" + id);
      return out.stdout;
    } catch (error) {
      attempt.failure ??= error instanceof Error ? error.message : "QUERY_FAILED";
      throw error;
    }
  };
  try {
    const context = (await run("context-name", ["docker", "context", "show"])).trim();
    requireValue(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(context), "CONTEXT_NAME_REQUIRED");
    metadata.contextName = context;
    const endpoint = object(await run("context-endpoint", ["docker", "context", "inspect", context, "--format", contextFormat]));
    requireValue(typeof endpoint.DockerEndpoint === "string", "DOCKER_ENDPOINT_REQUIRED");
    metadata.contextEndpoint = endpoint;
    metadata.dockerHostOverridePresent = io.dockerHost !== void 0;
    const builder = parseBuilderInspect(await run("selected-builder", ["docker", "buildx", "inspect"]));
    metadata.builder = builder;
    metadata.engine = object(await run("engine", ["docker", "info", "--format", engineFormat]));
    const images = (await run("pinned-images", ["docker", "image", "inspect", ...p.images, "--format", imageFormat])).trim().split(`
`).map(object);
    requireValue(images.length === 2 && images.every((image) => typeof image.Id === "string" && Array.isArray(image.RepoDigests)), "TWO_LOCAL_IMAGE_METADATA_RECORDS_REQUIRED");
    metadata.images = images;
    metadata.hostFilesystem = await run("host-filesystem", ["df", "-Pk", "--", p.context]);
    metadata.hostMemory = await run("host-memory", ["cat", "/proc/meminfo"]);
    const chosen = selectedContainer(builder, context, endpoint.DockerEndpoint, io.dockerHost);
    if (chosen.container !== null)
      metadata.builderContainer = object(await run("selected-builder-container", ["docker", "container", "inspect", chosen.container, "--format", containerFormat]));
    else
      skipped.push({ id: "selected-builder-container", reason: chosen.reason });
  } catch (error) {
    failure = error instanceof Error ? error.message : "INVENTORY_FAILED";
  }
  return {
    version: "chess-coach.host-build-inventory.v1",
    status: failure === null ? "PASS_METADATA_ONLY" : "FAIL_METADATA_ONLY",
    failure,
    results,
    skipped,
    metadata,
    unknowns: ["EFFECTIVE_WORKER_RESOURCE_ENFORCEMENT", "BUILDKIT_CONTENT_STORE_IMAGE_AVAILABILITY", "OFFLINE_IMAGE_RESOLUTION", "COMPILER_AND_RUNTIME_USABILITY", "CANCELLATION_EFFECTIVENESS", "HOST_CAPACITY_EQUALS_BUILDER_CAPACITY"],
    hostInvocationsConsumed: 1,
    remainingHostInvocations: 0,
    automaticRetryAuthorized: !1,
    buildAuthorized: !1,
    buildPerformed: !1,
    containerExecutionPerformed: !1,
    imagePullPerformed: !1,
    nativeExecuted: !1,
    gpuExecuted: !1,
    trainingExecuted: !1,
    trainingReady: !1
  };
}
export function retainedPrefix(chunk, retained, limit) {
  return chunk.subarray(0, Math.max(0, Math.min(chunk.length, limit - retained)));
}
export async function runHostInventory(p, launch = spawn) {
  requireValue(Bun.argv.at(-1) === p.grant && Bun.version === "1.4.0", "APPROVED_PINNED_HOST_INVENTORY_CONTEXT_REQUIRED");
  const hash = (bytes) => createHash("sha256").update(bytes).digest("hex"), captures = [];
  let activeStop = null, interrupted = !1;
  const interrupt = () => {
    interrupted = !0;
    activeStop?.("HOST_INVENTORY_INTERRUPTED");
  };
  process.on("SIGTERM", interrupt);
  process.on("SIGINT", interrupt);
  let preflightFailure = null;
  try {
    requireValue((await stat(p.context)).isDirectory(), "RECEIVED_CONTEXT_DIRECTORY_REQUIRED");
    requireValue(hash(await readFile("Cargo.lock")) === "77f674cc26a01f26558fd99c45bdcd5566017be05833fce1d39cae98cda05955", "HOST_REPOSITORY_CONTEXT_REQUIRED");
  } catch (error) {
    preflightFailure = error instanceof Error ? error.message : "INVENTORY_PREFLIGHT_FAILED";
  }
  const receipt = await collectInventory(p, { now: () => performance.now(), dockerHost: process.env.DOCKER_HOST, run: async (query) => {
    requireValue(!preflightFailure && !interrupted, preflightFailure ?? "HOST_INVENTORY_INTERRUPTED");
    const started = performance.now(), handles = [];
    try {
      for (const stream of ["stdout", "stderr"])
        handles.push(await open(`${p.evidence}/${query.id}.${stream}`, "wx", 384));
    } catch (error) {
      await Promise.all(handles.map((handle) => handle.close()));
      throw error;
    }
    const child = launch(query.argv[0], query.argv.slice(1), { detached: !0, stdio: ["ignore", "pipe", "pipe"], env: process.env });
    let failure = null, term, kill;
    const signal = (name) => {
      if (child.pid)
        try {
          process.kill(-child.pid, name);
        } catch {}
    }, stop = (reason) => {
      failure ??= reason;
      signal("SIGTERM");
      kill ??= setTimeout(() => signal("SIGKILL"), p.limits.queryKillGraceMs);
    };
    activeStop = stop;
    term = setTimeout(() => stop("QUERY_DEADLINE"), p.limits.queryTermMs);
    const done = new Promise((resolveDone) => {
      child.once("error", () => {
        failure ??= "QUERY_SPAWN_FAILED";
        resolveDone(null);
      });
      child.once("close", resolveDone);
    }), streams = [], stdout = [], drain = async (stream, index) => {
      const digest = createHash("sha256");
      let bytes = 0, seenBytes = 0;
      try {
        for await (const part of child[stream]) {
          const chunk = Buffer.from(part);
          seenBytes += chunk.length;
          const kept = retainedPrefix(chunk, bytes, p.limits.perQueryStreamBytes);
          if (kept.length) {
            await handles[index].writeFile(kept);
            digest.update(kept);
            bytes += kept.length;
            if (stream === "stdout")
              stdout.push(Buffer.from(kept));
          }
          if (kept.length < chunk.length)
            stop("QUERY_OUTPUT_LIMIT");
        }
      } catch {
        stop("QUERY_CAPTURE_FAILED");
      } finally {
        streams[index] = { path: `${p.evidence}/${query.id}.${stream}`, bytes, seenBytes, sha256: digest.digest("hex") };
      }
    };
    let exitCode = null;
    try {
      [exitCode] = await Promise.all([done, drain("stdout", 0), drain("stderr", 1)]);
    } finally {
      if (term)
        clearTimeout(term);
      if (kill)
        clearTimeout(kill);
      signal("SIGKILL");
      activeStop = null;
      await Promise.all(handles.map((handle) => handle.close()));
      captures.push({ id: query.id, elapsedMs: performance.now() - started, streams });
    }
    return { exitCode, failure, stdout: Buffer.concat(stdout).toString("utf8") };
  } });
  process.off("SIGTERM", interrupt);
  process.off("SIGINT", interrupt);
  const bytes = Buffer.from(JSON.stringify({ ...receipt, limits: p.limits, endpointScope: p.endpointScope, captures, parentDiagnosticsHaveOnlyPostExitSoftSizeCheck: !0 }, null, 2) + `
`);
  requireValue(bytes.length <= p.limits.receiptBytes, "INVENTORY_RECEIPT_SIZE_LIMIT");
  await writeFile(p.evidence + "/receipt.json", bytes, { flag: "wx" });
  console.log(JSON.stringify({ status: receipt.status, failure: receipt.failure, receipt: p.evidence + "/receipt.json", queries: receipt.results.length, trainingReady: !1 }));
  process.exitCode = receipt.status === "PASS_METADATA_ONLY" ? 0 : 1;
}

await runHostInventory({"version":"chess-coach.host-build-inventory-proposal.v1","status":"SOURCE_ONLY_AWAITING_ONE_CORRECTED_HOST_INVOCATION_APPROVAL","evidence":"_work/gpu-owner-recovery/runs/host-build-inventory-2","context":"_work/gpu-owner-recovery/cache/host-receive-2/context","grant":"--approved-host-build-inventory-2","priorFailure":"_work/gpu-owner-recovery/runs/host-build-inventory-observation-1/observation.json","correction":"PLAIN_BUILDX_INSPECT_WITH_DOCUMENTED_TEXT_PARSER","images":["docker.io/library/rust@sha256:4c2fd73ef19c5ef9d54bee03b06b2839a392604fbfcd578ed948b71b37c1d7fb","docker.io/oven/bun@sha256:18639686662e5cd8a963ffb967dd130034a2a2d076a52e65dfd4fe18f75cc038"],"execution":{"pins":["core:bun@1.4.0","core:rust@1.95.0"],"automaticInstallation":false},"limits":{"maximumQueries":8,"queryTermMs":4000,"queryKillGraceMs":1000,"workerTermMs":55000,"workerKillGraceMs":5000,"overallMs":60000,"perQueryStreamBytes":32768,"allQueryStreamBytes":524288,"receiptBytes":65536,"parentDiagnosticSoftLimitBytes":65536},"endpointScope":"READ_ONLY_METADATA_RPC_TO_EXISTING_SELECTED_DOCKER_AND_BUILDX_ENDPOINTS","conditionalContainerInspection":"ONE_RUNNING_SINGLE_NODE_DOCKER_CONTAINER_BUILDER_ON_SELECTED_LOCAL_ENDPOINT_ONLY","maximumHostInvocations":1,"helperDownloads":0,"sourcePublicationRequired":false,"hostExecutionApproved":false,"startupOrBootstrapOrConfigurationChangesAuthorized":false,"imagePullOrBuildOrContainerExecutionAuthorized":false,"payloadCopyOrStagingAuthorized":false,"nativeOrGpuExecutionAuthorized":false,"trainingAuthorized":false,"automaticRetryAuthorized":false,"trainingReady":false});\\\\\\\' -- \\\\\\\'--approved-host-build-inventory-2\\\\\\\' < /dev/null\\\'; fish --no-config -n -c "$program" > \\\'_work/gpu-owner-recovery/runs/host-build-inventory-2/syntax.stdout\\\' 2> \\\'_work/gpu-owner-recovery/runs/host-build-inventory-2/syntax.stderr\\\'; or exit $status; fish --no-config -c "$program"\' > "$evidence/worker.stdout" 2> "$evidence/worker.stderr"; set -l code $status; for stream in stdout stderr; if test (command wc -c < "$evidence/worker.$stream") -gt 65536; set code 1; end; end; printf \'%s\\n\' $code > "$evidence/command.exit"; or exit 1; if test -f "$evidence/syntax.stderr"; command cat -- "$evidence/syntax.stderr" >&2; end; command cat -- "$evidence/worker.stdout"; command cat -- "$evidence/worker.stderr" >&2; if test -f "$evidence/receipt.json"; command cat -- "$evidence/receipt.json"; end; printf \'HOST_BUILD_INVENTORY_EXIT=%s\\n\' $code; exit $code'
