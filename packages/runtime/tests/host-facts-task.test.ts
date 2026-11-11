// SPEC: _spec/host-entrypoint.puml
import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const source = readFileSync(resolve(root, "mise.toml"), "utf8");
const run = "./target/host-facts/67541b7b2fb0388cd7bfefedfb69fcc74a7cca2e34cdf7f937fea15d2880538a/host-docker-runtime-facts-linux-x86_64-musl";
const mise = Bun.which("mise");
const miseTest = mise === null ? test.skip : test;

test("host artifact expectations bind the static bytes without granting execution or qualification", () => {
  const artifact: unknown = JSON.parse(readFileSync(resolve(root, "tooling/runtime/host-facts-artifact.json"), "utf8"));
  expect(artifact).toEqual({
    version: "chess-coach.host-facts-artifact.v1",
    filename: "host-docker-runtime-facts-linux-x86_64-musl",
    sha256: "67541b7b2fb0388cd7bfefedfb69fcc74a7cca2e34cdf7f937fea15d2880538a",
    byteLength: 674400,
    target: "x86_64-unknown-linux-musl",
    rustVersion: "1.95.0",
    reportVersion: "chess-coach.host-docker-runtime-facts.v2",
    elf: { class: 64, machine: "x86_64", interpreter: null, neededLibraries: [], rpath: null, runpath: null },
    scope: "METADATA_ONLY_NOT_RUNTIME_QUALIFICATION",
    deploymentQualified: false,
    runtimeAdmissionQualified: false,
    gpuQualification: "NOT_QUALIFIED",
    hostExecutionAuthorized: false,
    provisioningAuthorized: false,
    trainingAuthorized: false,
    trainingReady: false,
  });
});

test("host mise task invokes only the pinned prebuilt artifact and retains existing Python entrypoints", () => {
  const config = Bun.TOML.parse(source) as {
    settings: { auto_install: boolean; task: { run_auto_install: boolean } };
    tasks: Record<string, Record<string, unknown>>;
  };
  expect(config.settings.auto_install).toBe(false);
  expect(config.settings.task.run_auto_install).toBe(false);
  expect(config.tasks["host:docker-runtime-facts"]).toEqual({
    description: "Host-only prebuilt Rust Docker metadata; no build, install, download, container or GPU operation",
    raw_args: true, raw: true, quiet: true, run,
  });
  expect(config.tasks["host:preflight"]?.run).toBe("python3 -I -B tooling/runtime/host_preflight.py");
  expect(config.tasks["host:sbx-contract"]?.run).toBe("python3 -I -B tooling/runtime/host_preflight.py --sbx-contract");
  expect(config.tasks["host:admission-facts"]?.run).toBe("python3 -I -B tooling/runtime/host_preflight.py --admission-facts");
});

function fixture(withArtifact: boolean) {
  const directory = mkdtempSync("/tmp/opencode/chess-coach-host-task-");
  writeFileSync(resolve(directory, "mise.toml"), source, { flag: "wx", mode: 0o600 });
  if (withArtifact) {
    const executable = resolve(directory, run);
    mkdirSync(dirname(executable), { recursive: true, mode: 0o700 });
    writeFileSync(executable, '#!/bin/sh\nprintf \'%s\\n\' "$@"\n', { flag: "wx", mode: 0o700 });
  }
  const env = {
    ...process.env,
    HOME: directory,
    MISE_AUTO_INSTALL: "false", MISE_TASK_RUN_AUTO_INSTALL: "false", MISE_OFFLINE: "true",
    MISE_DATA_DIR: resolve(directory, "data"), MISE_CACHE_DIR: resolve(directory, "cache"),
    MISE_STATE_DIR: resolve(directory, "state"), MISE_TRUSTED_CONFIG_PATHS: directory,
    MISE_GLOBAL_CONFIG_FILE: resolve(directory, "absent-global.toml"),
    MISE_SYSTEM_CONFIG_FILE: resolve(directory, "absent-system.toml"),
    RUSTUP_HOME: resolve(directory, "rustup"), MISE_RUSTUP_HOME: resolve(directory, "rustup"),
    CARGO_HOME: resolve(directory, "cargo"), MISE_CARGO_HOME: resolve(directory, "cargo"),
  };
  return { directory, env };
}

function assertNoInstallation(directory: string) {
  const installs = resolve(directory, "data/installs");
  expect(existsSync(installs) ? readdirSync(installs) : []).toEqual([]);
  expect(existsSync(resolve(directory, "rustup/toolchains"))).toBe(false);
}

miseTest("synthetic prebuilt mise fixture forwards literal arguments without seeded Rust or Bun", () => {
  if (mise === null) throw new Error("MISE_UNAVAILABLE");
  const { directory, env } = fixture(true);
  const arguments_ = ["--help", "one two", "; printf SHOULD_NOT_RUN", "$(printf SHOULD_NOT_RUN)", "--confirm-host"];
  const result = Bun.spawnSync([mise, "run", "host:docker-runtime-facts", ...arguments_], {
    cwd: directory, env, stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 10_000,
  });
  expect(result.exitCode).toBe(0);
  expect(new TextDecoder().decode(result.stdout)).toBe(arguments_.join("\n") + "\n");
  assertNoInstallation(directory);
});

miseTest("missing prebuilt bytes fail without staging, installation or a source-build fallback", () => {
  if (mise === null) throw new Error("MISE_UNAVAILABLE");
  const { directory, env } = fixture(false);
  const result = Bun.spawnSync([mise, "run", "host:docker-runtime-facts", "--help"], {
    cwd: directory, env, stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 10_000,
  });
  expect(result.exitCode).not.toBe(0);
  expect(result.stdout.length).toBe(0);
  expect(existsSync(resolve(directory, "target"))).toBe(false);
  assertNoInstallation(directory);
});
