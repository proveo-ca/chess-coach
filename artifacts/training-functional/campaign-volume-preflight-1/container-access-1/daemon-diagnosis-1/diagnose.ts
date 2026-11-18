// SPEC: _spec/training-daemon-diagnosis.puml
import { closeSync, constants as C, fstatSync, lstatSync, openSync, readSync, realpathSync } from "node:fs";
import type { Stats } from "node:fs";
import { hostname } from "node:os";
import { isDeepStrictEqual } from "node:util";

const BUN = "/home/gu1lty/Projects/proveo/chess-coach/_work/gpu-owner-recovery/cache/host-gpu-native-build-1/bun";
const PROBE = "5f2a1e8fb35116e41ad4a4b048c0e161c81ea41c";
const DEFAULT = "/etc/docker/daemon.json";
const properties = ["ActiveState", "SubState", "MainPID", "InvocationID", "ExecMainStartTimestamp"];
export const serviceArgs = ["/usr/bin/systemctl", "--system", "show", "--no-pager", ...properties.map(p => `--property=${p}`), "--", "docker.service"] as const;

type Sample = { pid: number; invocation: string; startedAt: string };
type IO = {
  service(): string;
  processSample(pid: number): { commandLine: string; startTicks: string };
  defaultConfig(): string | null;
};

function service(text: string): Sample {
  if (text.length > 2048) throw new Error("SERVICE_OUTPUT_LIMIT");
  const fields = new Map<string, string>();
  for (const line of text.trimEnd().split("\n")) {
    const index = line.indexOf("="), key = line.slice(0, index);
    if (index < 1 || !properties.includes(key) || fields.has(key)) throw new Error("SERVICE_FIELDS_UNRECOGNIZED");
    fields.set(key, line.slice(index + 1));
  }
  if (fields.get("ActiveState") !== "active" || fields.get("SubState") !== "running") throw new Error("DOCKER_SERVICE_NOT_RUNNING");
  const pid = fields.get("MainPID") ?? "", invocation = fields.get("InvocationID") ?? "", startedAt = fields.get("ExecMainStartTimestamp") ?? "";
  if (!/^[1-9]\d{0,9}$/.test(pid) || Number(pid) < 2 || !/^[0-9a-f]{32}$/.test(invocation) || /^0+$/.test(invocation) ||
      !/^[A-Z][a-z]{2} \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC$/.test(startedAt)) throw new Error("SERVICE_IDENTITY_NOT_CONFIRMED");
  return { pid: Number(pid), invocation, startedAt };
}

function projectArgs(text: string) {
  if (!text.endsWith("\0") || text.length > 32768) throw new Error("COMMAND_LINE_UNRECOGNIZED");
  const [exe, ...args] = text.slice(0, -1).split("\0");
  if (exe !== "/usr/bin/dockerd" && exe !== "dockerd") throw new Error("MAINPID_NOT_EXPECTED_DOCKERD");
  let cliSELinux: boolean | null = null, configPath: string | null = null;
  let cliSELinuxForm = "NOT_OBSERVED";
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--" || /^--rootless(?:=.*)?$/.test(arg)) throw new Error("COMMAND_LINE_UNRECOGNIZED");
    if (arg === "--selinux-enabled" || arg.startsWith("--selinux-enabled=")) {
      if (cliSELinux !== null || !["--selinux-enabled", "--selinux-enabled=true", "--selinux-enabled=false"].includes(arg)) {
        throw new Error("SELINUX_FLAG_UNRECOGNIZED");
      }
      cliSELinux = arg !== "--selinux-enabled=false";
      cliSELinuxForm = arg === "--selinux-enabled" ? "BARE_TOKEN" : "EXPLICIT_TOKEN";
    } else if (arg === "--config-file" || arg.startsWith("--config-file=")) {
      if (configPath !== null) throw new Error("CONFIG_FLAG_UNRECOGNIZED");
      configPath = arg === "--config-file" ? args[++i] ?? "" : arg.slice("--config-file=".length);
      if (!configPath.startsWith("/")) throw new Error("CONFIG_FLAG_UNRECOGNIZED");
    }
  }
  return { cliSELinux, cliSELinuxForm, configSelection: configPath === null ? "IMPLICIT_DEFAULT" : configPath === DEFAULT ? "EXPLICIT_DEFAULT" : "CUSTOM_NOT_READ" };
}

function projectConfig(text: string | null) {
  if (text === null) return { state: "NOT_FOUND" };
  if (text.length > 65536) return { state: "UNAVAILABLE" };
  const data: unknown = JSON.parse(text);
  if (!data || typeof data !== "object" || Array.isArray(data)) return { state: "UNAVAILABLE" };
  if (!Object.hasOwn(data, "selinux-enabled")) return { state: "KEY_ABSENT" };
  const value = (data as Record<string, unknown>)["selinux-enabled"];
  return typeof value === "boolean" ? { state: "BOOLEAN_ON_DISK", value } : { state: "UNAVAILABLE" };
}

export function diagnose(io: IO) {
  const base = { probeSourceCommit: PROBE, sampledAtUtc: new Date().toISOString(), diagnosticScope: "PASSIVE_LOCAL_STARTUP_EVIDENCE",
    dockerCliInvoked: false, socketConnected: false, serviceChangeRequested: false, daemonEffectiveSELinuxKnown: false,
    earlierDaemonInstanceProven: false, bindAccessVerified: false, processConfinementVerified: false };
  let stage = "initial-service";
  try {
    const initial = service(io.service());
    stage = "process-arguments";
    const sample = io.processSample(initial.pid);
    const args = projectArgs(sample.commandLine);
    stage = "default-config";
    let config: ReturnType<typeof projectConfig> = { state: "CUSTOM_NOT_READ" };
    if (args.configSelection !== "CUSTOM_NOT_READ") {
      try { config = projectConfig(io.defaultConfig()); }
      catch { config = { state: "UNAVAILABLE" }; }
    }
    stage = "final-service";
    if (!isDeepStrictEqual(io.processSample(initial.pid), sample)) throw new Error("PROCESS_SAMPLE_CHANGED");
    if (!isDeepStrictEqual(service(io.service()), initial)) throw new Error("SERVICE_INSTANCE_CHANGED");
    return { ...base, status: "OBSERVED_DOCKER_STARTUP_EVIDENCE", startedAtUtcSample: initial.startedAt, ...args, config, failedStage: null, reason: null };
  } catch (error) {
    const reasons = ["SERVICE_OUTPUT_LIMIT", "SERVICE_FIELDS_UNRECOGNIZED", "DOCKER_SERVICE_NOT_RUNNING", "SERVICE_IDENTITY_NOT_CONFIRMED",
      "COMMAND_LINE_UNRECOGNIZED", "MAINPID_NOT_EXPECTED_DOCKERD", "SELINUX_FLAG_UNRECOGNIZED", "CONFIG_FLAG_UNRECOGNIZED",
      "PROCESS_SAMPLE_CHANGED", "SERVICE_INSTANCE_CHANGED"];
    const reason = error instanceof Error && reasons.includes(error.message) ? error.message : "LOCAL_READ_NOT_CONFIRMED";
    return { ...base, status: "BLOCKED_DAEMON_DIAGNOSIS", failedStage: stage, reason };
  }
}

function boundedRead(path: string, cap: number, check: (s: Stats) => boolean) {
  const fd = openSync(path, C.O_RDONLY | C.O_NOFOLLOW | C.O_NONBLOCK);
  try {
    if (!check(fstatSync(fd))) throw new Error("UNEXPECTED_FILE");
    const buffer = Buffer.alloc(cap + 1);
    let used = 0;
    while (used <= cap) {
      const n = readSync(fd, buffer, used, buffer.length - used, null);
      if (n === 0) return new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, used));
      used += n;
    }
    throw new Error("LOCAL_SIZE_LIMIT");
  } finally { closeSync(fd); }
}

const production: IO = {
  service() {
    const r = Bun.spawnSync(["/usr/bin/timeout", "--foreground", "-k", "1s", "5s", ...serviceArgs], {
      env: { PATH: "/usr/bin:/bin", HOME: "/", LC_ALL: "C", TZ: "UTC0" }, stdin: "ignore", stdout: "pipe", stderr: "pipe", maxBuffer: 4096
    });
    if (r.exitCode !== 0 || r.signalCode != null || r.stderr.length !== 0) throw new Error("SERVICE_QUERY_FAILED");
    return r.stdout.toString();
  },
  processSample(pid) {
    const dir = `/proc/${pid}`;
    const st = lstatSync(dir);
    if (!st.isDirectory() || st.uid !== 0) throw new Error("NOT_ROOTFUL");
    const readProc = (leaf: string, cap: number) => boundedRead(`${dir}/${leaf}`, cap, s => s.isFile() && s.uid === 0);
    const ticks = () => {
      const start = /^(\d+) \(dockerd\) [A-Z] .+$/.exec(readProc("stat", 4096).trimEnd());
      if (!start || Number(start[1]) !== pid) throw new Error("MAINPID_NOT_EXPECTED_DOCKERD");
      const value = start[0].slice(start[0].indexOf(") ") + 2).split(" ")[19];
      if (!value || !/^[1-9]\d{0,19}$/.test(value)) throw new Error("MAINPID_NOT_EXPECTED_DOCKERD");
      return value;
    };
    const startTicks = ticks();
    if (readProc("comm", 64) !== "dockerd\n") throw new Error("MAINPID_NOT_EXPECTED_DOCKERD");
    const commandLine = readProc("cmdline", 32768);
    if (ticks() !== startTicks) throw new Error("PROCESS_SAMPLE_CHANGED");
    return { commandLine, startTicks };
  },
  defaultConfig() {
    try {
      if (realpathSync("/etc/docker") !== "/etc/docker") throw new Error("UNEXPECTED_CONFIG_PARENT");
      const st = lstatSync("/etc/docker");
      if (!st.isDirectory() || st.uid !== 0 || (st.mode & 0o022) !== 0) throw new Error("UNEXPECTED_CONFIG_PARENT");
      const leaf = lstatSync(DEFAULT);
      const regularConfig = (s: Stats) => s.isFile() && s.uid === 0 && (s.mode & 0o022) === 0;
      if (!regularConfig(leaf)) throw new Error("UNEXPECTED_CONFIG_FILE");
      return boundedRead(DEFAULT, 65536, s => regularConfig(s) && s.dev === leaf.dev && s.ino === leaf.ino);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }
};

if (import.meta.main) {
  const valid = process.platform === "linux" && process.execPath === BUN && Bun.version === "1.4.0" &&
    !hostname().startsWith("proveo-opencode-") && Bun.argv.length === 2 &&
    [process.getuid!(), process.geteuid!(), process.getgid!(), process.getegid!()].every(id => id === 1000);
  const report = valid ? diagnose(production) :
    { status: "BLOCKED_DAEMON_DIAGNOSIS", probeSourceCommit: PROBE, failedStage: "launcher", reason: "EXPECTED_HOST_CONTEXT",
      dockerCliInvoked: false, socketConnected: false };
  console.log("Executor: " + JSON.stringify(report));
  process.exitCode = report.status === "OBSERVED_DOCKER_STARTUP_EVIDENCE" ? 0 : 1;
}
