// SPEC: _spec/gpu-build.puml
import { expect, test } from "bun:test";
import { createHash } from "node:crypto";

const root = new URL("../", import.meta.url);
const read = (path: string) => Bun.file(new URL(path, root)).text();
const script = await read("gpu-runtime-lookup.fish");
const observation = JSON.parse(await read("runs/gpu-container-visibility-host-probe-1/operator-observation.json"));
const paste = await read("runs/gpu-container-visibility-host-probe-1/operator-paste.txt");

test("runtime lookup declares only four bounded Docker metadata commands", () => {
  const calls = [...script.matchAll(/timeout --kill-after=3s 10s docker ([^\n]+)/g)].map(match => match[1]!);
  expect(calls).toHaveLength(4);
  expect(calls.map(call => call.split(" --")[0])).toEqual(["version", "info", "context show)", "context inspect"]);
  expect(script.match(/\bdocker\b/g)).toHaveLength(5);
  expect(script.split("\n").slice(1).join("\n")).not.toMatch(/\b(run|pull|build|install|sudo|restart|nvidia-smi)\b/);
  expect(script).toContain("server=unavailable");
  expect(script).toContain("defaultRuntime={{.DefaultRuntime}}");
});

test("context inspection follows successful single-context resolution", () => {
  expect(script).toContain("set -l context_exit $status\n");
  expect(script).toContain('if test "$context_exit" -eq 0; and test (count $context) -eq 1; and test -n "$context"');
  expect(script).toContain('contextEndpoint={{.Endpoints.docker.Host}}\' -- "$context"');
  expect(script).toContain("for variable in DOCKER_HOST DOCKER_CONTEXT\n");
  expect(script).toContain("if set -qx $variable\n");
  for (const name of ["docker_version_exit", "docker_info_exit", "context_show_exit", "context_inspect_exit"]) {
    expect(script).toContain(name + "=%s");
  }
});

test("path checks do not execute NVIDIA tools or attribute client paths to the daemon", () => {
  expect(script).toContain("for tool in nvidia-container-runtime nvidia-container-runtime-hook nvidia-container-cli nvidia-ctk runc\n");
  expect(script).toContain('set -l resolved (command -s -- "$tool")');
  expect(script).toContain("for directory in /usr/bin /usr/sbin /usr/local/bin /usr/local/sbin /bin /sbin\n");
  expect(script).toContain('if test -e "$candidate"; or test -L "$candidate"');
  expect(script).toContain('if test -x "$candidate"');
  expect(script).not.toMatch(/\$tool\s+--version|\$candidate\s+--version/);
  expect(script).toContain("client_endpoint_and_shell_paths_do_not_prove_daemon_host_or_daemon_containerd_PATH=true");
});

test("the operator observation consumes both grants without claiming missing host evidence", () => {
  expect(observation.status).toBe("OCI_LAUNCHER_LOOKUP_FAILED_AUTHORITY_CONSUMED");
  expect(observation.authorityDisposition).toEqual({ pullInvocationsConsumed: 1, containerAttemptsConsumed: 1,
    remainingPullInvocations: 0, remainingContainerAttempts: 0, automaticRetryAuthorized: false, authorityRecordRetainedUnchanged: true });
  expect(observation.bun.reportedPullSucceeded).toBe(true);
  expect(observation.bun.reportedPullExitCode).toBeNull();
  expect(observation.bun.inspectExitCode).toBe(0);
  expect(observation.rust).toEqual({ inspectExitCode: 1, reportedMissing: true, pullAuthorized: false });
  expect(observation.container.queryExitCode).toBe(127);
  expect(observation.container.cleanupExitCode).toBe(0);
  expect(observation.container.originalHostEvidenceFilesReceived).toBe(false);
  expect(observation.container.inContainerGpuQueriesStarted).toBe(0);
  expect(paste).toContain(observation.container.reportedCid);
  expect(paste).toContain(observation.container.reportedFailure);
  expect(paste).toContain("query_exit=127 cleanup_exit=0 evidence=" + observation.container.reportedHostEvidenceDirectory);
  expect(observation.operatorSourceCommit).toBeNull();
  for (const key of ["dockerEngineVersion", "effectiveDaemonEndpoint", "defaultRuntime", "daemonLauncherPath", "nvidiaHookMode"]) {
    expect(observation[key]).toBeNull();
  }
  for (const key of ["runcGpuRouteSelected", "runcGpuRouteVerified", "newContainerOperationAuthorized", "hostConfigurationChangeAuthorized",
    "agentExecutedHostCommands", "containerGpuVisibilityEstablished", "cudaGpuCodeExecuted", "trainingReady"]) {
    expect(observation[key]).toBe(false);
  }
});

test("the failed packet and original syntax-bound artifacts remain byte unchanged", async () => {
  const receipt = JSON.parse(await read("runs/gpu-container-visibility-local-1/receipt.json"));
  for (const source of receipt.sources as { path: string; sha256: string }[]) {
    const path = source.path.replace("_work/gpu-owner-recovery/", "");
    expect(createHash("sha256").update(await read(path)).digest("hex")).toBe(source.sha256);
  }
});
