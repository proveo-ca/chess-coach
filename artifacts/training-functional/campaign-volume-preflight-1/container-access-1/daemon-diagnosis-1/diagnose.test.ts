// SPEC: _spec/training-daemon-diagnosis.puml
import { expect, test } from "bun:test";
import { diagnose, serviceArgs } from "./diagnose";

const stamp = "Wed 2026-11-18 14:30:00 UTC";
const unit = `MainPID=100\nActiveState=active\nSubState=running\nInvocationID=${"a".repeat(32)}\nExecMainStartTimestamp=${stamp}\n`;
const cmd = (...parts: string[]) => ["/usr/bin/dockerd", ...parts].join("\0") + "\0";
function fixture() {
  const calls: string[] = [];
  let serviceReads = 0, processReads = 0;
  const samples = { unit: [unit, unit], commandLine: cmd("-H", "fd://"), ticks: ["10", "10"], config: '{"private":"do-not-report","selinux-enabled":false}' as string | null };
  const io: Parameters<typeof diagnose>[0] = {
    service: () => { calls.push("service"); return samples.unit[serviceReads++]!; },
    processSample: pid => { calls.push(`cmdline:${pid}`); return { commandLine: samples.commandLine, startTicks: samples.ticks[processReads++]! }; },
    defaultConfig: () => { calls.push("defaultConfig"); return samples.config; }
  };
  return { calls, samples, io };
}

test("reports projected startup and on-disk evidence without claiming daemon behavior", () => {
  const { io, calls } = fixture();
  const report = diagnose(io);
  expect(report).toMatchObject({ status: "OBSERVED_DOCKER_STARTUP_EVIDENCE", startedAtUtcSample: stamp, cliSELinux: null,
    configSelection: "IMPLICIT_DEFAULT", config: { state: "BOOLEAN_ON_DISK", value: false }, daemonEffectiveSELinuxKnown: false,
    earlierDaemonInstanceProven: false, bindAccessVerified: false, processConfinementVerified: false, dockerCliInvoked: false, socketConnected: false });
  expect(JSON.stringify(report)).not.toContain("do-not-report");
  expect(JSON.stringify(report)).not.toContain("InvocationID");
  expect(calls).toEqual(["service", "cmdline:100", "defaultConfig", "cmdline:100", "service"]);
  expect(serviceArgs.slice(0, 4)).toEqual(["/usr/bin/systemctl", "--system", "show", "--no-pager"]);
  expect(serviceArgs.at(-1)).toBe("docker.service");
});

test("inactive, oversized, duplicate, or unrecognized service samples stop before reading files", () => {
  for (const text of [
    unit.replace("active\n", "inactive\n"), unit.replace("running\n", "dead\n"), unit.replace("100\n", "0\n"),
    unit.replace(stamp, "n/a"), unit + "MainPID=200\n", "x".repeat(2049)
  ]) {
    const { io, samples, calls } = fixture();
    samples.unit[0] = text;
    expect(diagnose(io)).toMatchObject({ status: "BLOCKED_DAEMON_DIAGNOSIS", failedStage: "initial-service", socketConnected: false });
    expect(calls).toEqual(["service"]);
  }
});

test("rejects unrecognized daemon and arguments without reading configuration or leaking input", () => {
  for (const text of [
    "/other/dockerd\0", cmd("--rootless"), cmd("--"), cmd("--selinux-enabled=secret"), cmd("--selinux-enabled", "--selinux-enabled=false"),
    cmd("--config-file", "/not-listed", "--config-file", "/duplicate"), cmd("--config-file"), cmd("--config-file=relative"), cmd("x".repeat(32769))
  ]) {
    const { io, samples, calls } = fixture();
    samples.commandLine = text;
    const report = diagnose(io);
    expect(report).toMatchObject({ status: "BLOCKED_DAEMON_DIAGNOSIS", failedStage: "process-arguments" });
    expect(JSON.stringify(report)).not.toContain("secret");
    expect(calls).toEqual(["service", "cmdline:100"]);
  }
});

test("custom config is never read and explicit default flags remain distinct", () => {
  const custom = fixture();
  custom.samples.commandLine = cmd("--selinux-enabled=true", "--config-file", "/private/untrusted-config");
  const report = diagnose(custom.io);
  expect(report).toMatchObject({ cliSELinux: true, configSelection: "CUSTOM_NOT_READ", config: { state: "CUSTOM_NOT_READ" } });
  expect(JSON.stringify(report)).not.toContain("untrusted-config");
  expect(custom.calls).toEqual(["service", "cmdline:100", "cmdline:100", "service"]);
  const standard = fixture();
  standard.samples.commandLine = cmd("--selinux-enabled=false", "--config-file=/etc/docker/daemon.json");
  expect(diagnose(standard.io)).toMatchObject({ cliSELinux: false, configSelection: "EXPLICIT_DEFAULT", config: { state: "BOOLEAN_ON_DISK", value: false } });
  const bare = fixture();
  bare.samples.commandLine = cmd("--selinux-enabled");
  expect(diagnose(bare.io)).toMatchObject({ cliSELinux: true, cliSELinuxForm: "BARE_TOKEN" });
});

test("config is evidence only and a changed service discards the sample", () => {
  for (const [content, state] of [[null, "NOT_FOUND"], ["{}", "KEY_ABSENT"], ["garbage", "UNAVAILABLE"],
    ['{"selinux-enabled":"false"}', "UNAVAILABLE"], ["x".repeat(65537), "UNAVAILABLE"]] as const) {
    const { io, samples } = fixture();
    samples.config = content;
    expect(diagnose(io)).toMatchObject({ config: { state }, daemonEffectiveSELinuxKnown: false });
  }
  const denied = fixture();
  denied.io.defaultConfig = () => { throw new Error("private config path"); };
  expect(diagnose(denied.io)).toMatchObject({ config: { state: "UNAVAILABLE" } });
  const changed = fixture();
  changed.samples.unit[1] = unit.replace("a".repeat(32), "b".repeat(32));
  const result = diagnose(changed.io);
  expect(result).toMatchObject({ status: "BLOCKED_DAEMON_DIAGNOSIS", failedStage: "final-service", reason: "SERVICE_INSTANCE_CHANGED" });
  expect(result).not.toHaveProperty("config");
  const reused = fixture();
  reused.samples.ticks[1] = "11";
  expect(diagnose(reused.io)).toMatchObject({ status: "BLOCKED_DAEMON_DIAGNOSIS", reason: "PROCESS_SAMPLE_CHANGED" });
});
