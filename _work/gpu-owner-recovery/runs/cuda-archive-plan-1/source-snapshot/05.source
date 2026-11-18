// SPEC: _spec/recovery.md
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { runBounded } from "./verify";

export const repository = fileURLToPath(new URL("../../", import.meta.url));
export const work = resolve(repository, "_work/gpu-owner-recovery"), cache = resolve(work, "cache");
export const environment: Record<string, string> = {
  HOME: `${cache}/home`, PATH: "/usr/local/bin:/usr/bin:/bin", TMPDIR: `${cache}/tmp`, LANG: "C.UTF-8", LC_ALL: "C.UTF-8", TZ: "UTC",
  XDG_CONFIG_HOME: `${cache}/xdg/config`, XDG_CACHE_HOME: `${cache}/xdg/cache`, XDG_DATA_HOME: `${cache}/xdg/data`, XDG_STATE_HOME: `${cache}/xdg/state`,
  MISE_DATA_DIR: `${cache}/mise/data`, MISE_CACHE_DIR: `${cache}/mise/cache`, MISE_STATE_DIR: `${cache}/mise/state`, MISE_CONFIG_DIR: `${cache}/mise/config`,
  MISE_TMP_DIR: `${cache}/mise/tmp`, MISE_GLOBAL_CONFIG_FILE: `${cache}/mise/config/config.toml`, MISE_SYSTEM_CONFIG_DIR: `${cache}/mise/system`, MISE_SYSTEM_DIR: `${cache}/mise/system`,
  MISE_SYSTEM_CONFIG_FILE: `${cache}/mise/system/config.toml`, MISE_CEILING_PATHS: resolve(repository, "_work"), MISE_OVERRIDE_CONFIG_FILENAMES: "mise.toml",
  MISE_AUTO_ENV: "false", MISE_NO_ENV: "1", MISE_NO_HOOKS: "1", MISE_PARANOID: "1", MISE_AUTO_INSTALL: "false", MISE_TASK_RUN_AUTO_INSTALL: "false",
  MISE_RUSTUP_HOME: `${cache}/rustup`, RUSTUP_HOME: `${cache}/rustup`, MISE_CARGO_HOME: `${cache}/cargo`, CARGO_HOME: `${cache}/cargo`,
  MISE_RUST_DEFAULT_HOST: "x86_64-unknown-linux-gnu", RUSTUP_DIST_SERVER: "https://static.rust-lang.org", RUSTUP_UPDATE_ROOT: "https://static.rust-lang.org/rustup", RUSTUP_AUTO_INSTALL: "0",
  CARGO_TARGET_DIR: resolve(repository, "target/gpu-owner-recovery"), CARGO_BUILD_JOBS: "2", CARGO_INCREMENTAL: "0", CARGO_PROFILE_DEV_DEBUG: "0", CARGO_PROFILE_TEST_DEBUG: "0", RAYON_NUM_THREADS: "2", RUST_TEST_THREADS: "2",
};
const plans: Record<string, string[][]> = {
  inspect: [["--version"], ["install", "--help"], ["trust", "--help"], ["trust", `${work}/mise.toml`], ["config", "ls", "--json"],
    ["settings", "get", "rust.rustup_home"], ["settings", "get", "rust.cargo_home"], ["settings", "get", "rust.default_host"]],
  install: [["install", "--jobs", "1", "core:rust"]],
  "cpu-linker": [["install", "--jobs", "1", "core:zig@0.15.2"]],
  list: [["config", "ls", "--json"], ["ls", "--installed", "--json"]],
};

export async function prepare() {
  if (JSON.parse(await readFile(resolve(repository, "package.json"), "utf8")).name !== "chess-coach" || resolve(process.cwd()) !== resolve(repository)) throw Error("REPOSITORY_ROOT_REQUIRED");
  const paths = ["home", "tmp", "rustup", "cargo", "xdg/config", "xdg/cache", "xdg/data", "xdg/state", "mise/data", "mise/cache", "mise/state", "mise/config", "mise/tmp", "mise/system"];
  for (const path of paths) await mkdir(resolve(cache, path), { recursive: true, mode: 0o700 });
  await mkdir(resolve(work, "runs"), { recursive: true, mode: 0o700 });
}

async function main() {
  const [mode, label] = Bun.argv.slice(2);
  if (Bun.argv.length !== 4 || !plans[mode!] || !/^[a-z0-9-]{1,48}$/.test(label ?? "")) throw Error("CLOSED_PROVISION_MODE_REQUIRED");
  await prepare();
  if (mode === "install" || mode === "cpu-linker") {
    const inspected = resolve(work, "runs/mise-isolation-inspection");
    const configurations = JSON.parse(await readFile(resolve(inspected, "04/command.stdout"), "utf8"));
    const expected = [environment.RUSTUP_HOME, environment.CARGO_HOME, "x86_64-unknown-linux-gnu"];
    if (configurations.length !== 1 || configurations[0].path !== `${work}/mise.toml` || JSON.stringify(configurations[0].tools) !== JSON.stringify(["rust"])) throw Error("SCOPED_MISE_CONFIG_REQUIRED");
    for (const [index, value] of expected.entries()) if ((await readFile(resolve(inspected, `${String(index + 5).padStart(2,"0")}/command.stdout`),"utf8")).trim() !== value) throw Error("REPOSITORY_TOOL_HOME_REQUIRED");
    const configuration = Bun.TOML.parse(await readFile(`${work}/mise.toml`, "utf8"));
    if (JSON.stringify(configuration) !== JSON.stringify({ tools: { "core:rust": { version:"1.95.0", profile:"minimal", components:["rustfmt","clippy"], targets:[] } } })) throw Error("PINNED_MINIMAL_RUST_CONFIG_REQUIRED");
  }
  const directory = resolve(work, "runs", label!);
  await mkdir(directory, { mode: 0o700 });
  const results = [];
  for (const [ordinal, args] of plans[mode!].entries()) {
    const step = resolve(directory, String(ordinal).padStart(2,"0"));
    await mkdir(step, { mode: 0o700 });
    const argv = ["/usr/local/bin/mise", ...args];
    const result = await runBounded(argv, step, ["install", "cpu-linker"].includes(mode!) ? 600_000 : 30_000, { cwd: work, environment });
    const receipt = { version: "chess-coach.provision-step.v1", argv, ...result, cwd: relative(repository, work), environment, trainingReady: false };
    await writeFile(resolve(step,"receipt.json"),JSON.stringify(receipt,null,2)+"\n",{flag:"wx",mode:0o600});
    results.push({step:relative(repository,step),...result});
    if (result.status !== "PASS") break;
  }
  const success = results.length === plans[mode!]!.length && results.every(result=>result.status==="PASS");
  await writeFile(resolve(directory,"receipt.json"),JSON.stringify({mode,success,results,actualHostExecuted:false,cudaGpuCodeExecuted:false,trainingReady:false},null,2)+"\n",{flag:"wx",mode:0o600});
  console.log(JSON.stringify({receipt:relative(repository,resolve(directory,"receipt.json")),success,trainingReady:false}));
  process.exitCode = success ? 0 : 1;
}

if (import.meta.main) await main();
