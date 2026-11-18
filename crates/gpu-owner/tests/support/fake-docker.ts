#!/usr/local/bin/bun --no-env-file
// SPEC: _spec/gpu-owner.md, _spec/gpu-owner.puml
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const cfg = __TRUSTED_FIXTURE_CONFIGURATION__;
const log = (event: string, value: unknown = null) => appendFileSync(cfg.events, JSON.stringify({ event, value, pid: process.pid }) + "\n", { mode: 0o600 });
const put = (path: string, value: string) => writeFileSync(path, value, { mode: 0o600 });
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const requireEqual = (actual: unknown, expected: unknown, label: string) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`fixture ${label}: ${JSON.stringify(actual)}`);
};
const attachPid = () => existsSync(cfg.attachPid) ? Number(readFileSync(cfg.attachPid, "utf8")) : 0;
const running = () => attachPid() !== 0 && !existsSync(cfg.finished);
function replaceState() {
  renameSync(cfg.stateSource, cfg.preservedState);
  mkdirSync(cfg.stateSource, { mode: 0o700 });
  put(cfg.stateReplaced, "replaced\n");
}
function leaf(pid: number) {
  mkdirSync(cfg.leaf, { mode: 0o700 });
  for (const [name, value] of Object.entries({ "cpu.max": "400000 100000\n", "memory.max": "8589934592\n", "memory.swap.max": "0\n",
    "pids.max": "512\n", "cpuset.cpus.effective": "1,2,3,4\n", "cgroup.procs": `${pid}\n`, "cgroup.threads": `${pid}\n` })) put(join(cfg.leaf, name), value);
  mkdirSync(join(cfg.procRoot, String(pid)), { mode: 0o700 });
  put(join(cfg.procRoot, String(pid), "cgroup"), "0::/aggregate/jobs/owned\n");
}
function inspect() {
  const count = existsSync(cfg.inspectCount) ? Number(readFileSync(cfg.inspectCount, "utf8")) + 1 : 1;
  put(cfg.inspectCount, String(count));
  const isRunning = running(), pid = isRunning ? attachPid() : 0;
  if (cfg.mode === "state-replaced-running" && isRunning && !existsSync(cfg.stateReplaced)) replaceState();
  let image = cfg.imageId, token = cfg.token;
  const storageFailed = existsSync(cfg.evidenceFault);
  if (cfg.mode === "wrong-image" || (cfg.mode === "storage-wrong-image" && storageFailed)) image = `sha256:${"b".repeat(64)}`;
  if (cfg.mode === "wrong-label" || (cfg.mode === "storage-wrong-label" && storageFailed)) token = "f".repeat(32);
  const request = { Driver: "nvidia", Count: 0, DeviceIDs: [cfg.uuid], Capabilities: [["gpu"]], Options: {} };
  const host: Record<string, unknown> = { CpuPeriod: 100000, CpuQuota: 400000, CpusetCpus: "1,2,3,4", Memory: 8589934592, MemorySwap: 8589934592,
    PidsLimit: 512, NetworkMode: "none", IpcMode: "private", CgroupnsMode: "private", Runtime: "nvidia", CgroupParent: "synthetic.slice",
    Privileged: false, PublishAllPorts: false, AutoRemove: false, ReadonlyRootfs: true, CapDrop: ["ALL"], SecurityOpt: ["no-new-privileges"],
    RestartPolicy: { Name: "no", MaximumRetryCount: 0 }, LogConfig: { Type: "none", Config: {} }, DeviceRequests: [request],
    Devices: [], DeviceCgroupRules: [], CapAdd: [], GroupAdd: [], VolumesFrom: [], Links: [], ExtraHosts: [], Dns: [], DnsOptions: [], DnsSearch: [],
    PidMode: "", UTSMode: "", UsernsMode: "", ContainerIDFile: "", VolumeDriver: "", PortBindings: {}, Binds: [],
    Tmpfs: { "/tmp": "rw,nosuid,nodev,noexec,size=2147483648,nr_inodes=16384" },
    Ulimits: [{ Name: "nofile", Soft: 256, Hard: 256 }, { Name: "fsize", Soft: 67108864, Hard: 67108864 }],
    Mounts: [{ Type: "bind", Source: cfg.stateSource, Target: "/state", ReadOnly: false, BindOptions: { Propagation: "rprivate" } }] };
  if (cfg.mode === "extra-gpu") (host.DeviceRequests as unknown[]).push({ ...request, DeviceIDs: ["GPU-22222222-2222-2222-2222-222222222222"] });
  const mounts = [{ Type: "bind", Source: cfg.stateSource, Destination: "/state", RW: true, Propagation: "rprivate" }];
  if (cfg.mode === "extra-mount") mounts.push({ Type: "bind", Source: cfg.root, Destination: "/run/foreign", RW: true, Propagation: "rprivate" });
  const value = { Id: cfg.id, Image: image, Name: `/${cfg.containerName}`, State: { Pid: pid, Running: isRunning }, HostConfig: host,
    Config: { Labels: { "chess-coach.gpu-owner.ownership": token }, User: "1000:1000", OpenStdin: true, Tty: false,
      Entrypoint: ["/sbin/chess-init"], Cmd: ["-g", "--", "/usr/local/bin/bun", "--no-env-file", "--no-install", "/app/packages/runtime/src/gpu-job.ts", cfg.registration.sessionId],
      Env: [`NVIDIA_VISIBLE_DEVICES=${cfg.uuid}`, "NVIDIA_DRIVER_CAPABILITIES=compute"], Volumes: {} }, Mounts: mounts };
  if (cfg.mode.startsWith("storage-") && isRunning && !storageFailed) {
    renameSync(cfg.packetRoot, cfg.preservedPacket);
    writeFileSync(cfg.packetRoot, "EVIDENCE_PATH_REPLACED\n", { flag: "wx", mode: 0o600 });
    put(cfg.evidenceFault, "failed\n");
    log("evidence-replaced");
  }
  log("inspect", { count, image, token, running: isRunning, initPid: pid });
  return value;
}
async function start() {
  if (!existsSync(cfg.created) || existsSync(cfg.attachPid)) throw new Error("fixture start authority");
  leaf(process.pid);
  put(cfg.attachPid, String(process.pid));
  log("attach-start");
  if (cfg.mode === "cleanup-attach-overflow") {
    await Bun.write(Bun.stdout, JSON.stringify({ version: "chess-coach.gpu-job.v1", sessionId: cfg.registration.sessionId, kind: "boot" }) + "\n");
    const end = Date.now() + 8000;
    while (!existsSync(cfg.cleanupInspection)) {
      if (Date.now() >= end) throw new Error("fixture missing cleanup inspection");
      await delay(2);
    }
    await Bun.write(Bun.stderr, "x".repeat(70000));
    await new Promise(() => { setInterval(() => {}, 1000); });
    return;
  }
  if (cfg.mode === "premature-startup") {
    const common = { version: "chess-coach.gpu-job.v1", sessionId: cfg.registration.sessionId };
    await Bun.write(Bun.stdout, JSON.stringify({ ...common, kind: "boot" }) + "\n");
    const end = Date.now() + 8000;
    while (!existsSync(join(cfg.packetRoot, "job-start.json"))) {
      if (Date.now() >= end) throw new Error("fixture missing job-start evidence");
      await delay(2);
    }
    await Bun.write(Bun.stdout, JSON.stringify({ ...common, kind: "startup", attemptId: cfg.registration.attemptId,
      inputSha256: cfg.inputSha256, descriptorSha256: cfg.registration.expectedDescriptorSha256, initialModelId: cfg.registration.initialModelId }) + "\n");
    put(cfg.prematureSent, "sent\n");
    log("premature-startup-sent");
    await new Promise(() => { setInterval(() => {}, 1000); });
    return;
  }
  const child = Bun.spawn(["/usr/local/bin/bun", "--no-env-file", "--no-install", cfg.registration.driverPath, cfg.registration.sessionId], {
    cwd: cfg.registration.layout.factory.cwd, stdin: "inherit", stdout: "pipe", stderr: "pipe",
    env: { LANG: "C", LC_ALL: "C", TZ: "UTC", BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0" } });
  put(cfg.driverPid, String(child.pid));
  log("driver-start", { pid: child.pid });
  const relay = async (stream: ReadableStream<Uint8Array>, path: string, destination: typeof Bun.stdout) => {
    for await (const bytes of stream) { appendFileSync(path, bytes, { mode: 0o600 }); await Bun.write(destination, bytes); }
  };
  const [, , exitCode] = await Promise.all([relay(child.stdout, cfg.driverStdout, Bun.stdout), relay(child.stderr, cfg.driverStderr, Bun.stderr), child.exited]);
  put(cfg.finished, JSON.stringify({ exitCode, pid: child.pid, stdoutEof: true, stderrEof: true, reaped: true }) + "\n");
  log("driver-reaped", { exitCode, pid: child.pid });
  if (cfg.mode === "trailing-stdout") await Bun.write(Bun.stdout, "trailing-after-proposal\n");
  process.exitCode = cfg.mode === "nonzero-after-proposal" ? 23 : exitCode;
}
async function remove() {
  const pid = attachPid();
  const end = Date.now() + 1000;
  while (pid !== 0 && !existsSync(cfg.finished)) {
    try {
      const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
      if (stat.slice(stat.lastIndexOf(")") + 2).startsWith("Z ")) break;
      process.kill(pid, 0);
    } catch (error) { if ((error as NodeJS.ErrnoException).code === "ESRCH" || (error as NodeJS.ErrnoException).code === "ENOENT") break; throw error; }
    if (Date.now() >= end) throw new Error("fixture remove before owned attach stop");
    await delay(2);
  }
  if (pid !== 0 && existsSync(cfg.leaf)) {
    put(join(cfg.leaf, "cgroup.procs"), "");
    put(join(cfg.leaf, "cgroup.threads"), "");
    if (cfg.mode !== "retained-cgroup") {
      for (const name of ["cpu.max", "memory.max", "memory.swap.max", "pids.max", "cpuset.cpus.effective", "cgroup.procs", "cgroup.threads"]) unlinkSync(join(cfg.leaf, name));
      rmdirSync(cfg.leaf);
    }
    const proc = join(cfg.procRoot, String(pid));
    unlinkSync(join(proc, "cgroup")); rmdirSync(proc);
  }
  put(cfg.removed, "removed\n");
  log("remove", { id: cfg.id, retained: cfg.mode === "retained-cgroup" });
  await Bun.write(Bun.stdout, cfg.id + "\n");
}
try {
  const args = Bun.argv.slice(2);
  requireEqual(args.slice(0, 4), ["--config", cfg.anonymousConfig, "--host", `unix://${cfg.endpoint}`], "prefix");
  requireEqual(Object.keys(process.env).sort(), ["LANG", "LC_ALL", "TZ"], "clearenv");
  const [operation, ...rest] = args.slice(4);
  log("invoke", { operation, args: rest });
  if (operation === "create") {
    const expected = ["--pull=never", "--interactive", "--network=none", "--read-only", "--user=1000:1000", "--cpu-period=100000", "--cpu-quota=400000",
      "--cpuset-cpus=1,2,3,4", "--memory=8589934592", "--memory-swap=8589934592", "--pids-limit=512", "--cap-drop=ALL", "--security-opt=no-new-privileges",
      "--restart=no", "--ipc=private", "--cgroupns=private", "--log-driver=none", "--ulimit=nofile=256:256", "--ulimit=fsize=67108864:67108864",
      "--tmpfs=/tmp:rw,nosuid,nodev,noexec,size=2147483648,nr_inodes=16384", "--runtime=nvidia", `--name=${cfg.containerName}`,
      `--label=chess-coach.gpu-owner.ownership=${cfg.token}`, "--cgroup-parent=synthetic.slice", `--gpus=driver=nvidia,device=${cfg.uuid}`,
      `--env=NVIDIA_VISIBLE_DEVICES=${cfg.uuid}`, "--env=NVIDIA_DRIVER_CAPABILITIES=compute",
      `--mount=type=bind,source=${cfg.stateSource},target=/state,bind-propagation=rprivate`, "--entrypoint=/sbin/chess-init", cfg.imageId,
      "-g", "--", "/usr/local/bin/bun", "--no-env-file", "--no-install", "/app/packages/runtime/src/gpu-job.ts", cfg.registration.sessionId];
    requireEqual(rest, expected, "create C2/C13");
    if (!existsSync(cfg.packetRoot) || !readdirSync(cfg.packetRoot).some(name => /started/i.test(name))) throw new Error("fixture STARTED evidence missing before create");
    writeFileSync(cfg.created, cfg.id + "\n", { flag: "wx", mode: 0o600 });
    log("create", { id: cfg.id });
    if (cfg.mode === "state-replaced-after-create") replaceState();
    await Bun.write(Bun.stdout, cfg.id + "\n");
  } else if (operation === "start") {
    requireEqual(rest, ["--attach", "--interactive", cfg.id], "start"); await start();
  } else if (operation === "inspect") {
    if (rest[2] !== cfg.id && !(rest[2] === cfg.containerName && existsSync(cfg.created))) throw new Error("fixture inspect authority");
    requireEqual(rest, ["--type=container", "--format={{json .}}", rest[2]], "inspect");
    if (["cold-after-queue", "cleanup-attach-overflow"].includes(cfg.mode) && existsSync(join(cfg.packetRoot, "job-start.json"))) {
      put(cfg.cleanupInspection, "seen\n");
      await delay(200);
    }
    await Bun.write(Bun.stdout, JSON.stringify(inspect()) + "\n");
  } else if (operation === "rm") {
    requireEqual(rest, ["--force", cfg.id], "remove"); await remove();
  } else throw new Error("fixture forbidden manager operation");
} catch (error) { log("fixture-error", String(error)); await Bun.write(Bun.stderr, String(error) + "\n"); process.exitCode = 91; }
