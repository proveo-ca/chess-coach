// SPEC: _spec/gpu-host-receive.puml
import { expect, test } from "bun:test";
import { alignment, renderHostToolchainAlignment, versionMatches } from "./render";

function literal(value: string) {
  if (!value.startsWith("'") || !value.endsWith("'")) throw Error("FISH_LITERAL_REQUIRED");
  const source = value.slice(1, -1); let result = "";
  for (let index = 0; index < source.length; index++) {
    const character = source[index]!;
    if (character === "\\" && ["\\", "'"].includes(source[index + 1] ?? "")) result += source[++index];
    else { if (character === "'") throw Error("UNESCAPED_FISH_QUOTE"); result += character; }
  }
  return result;
}
function rendered() {
  const command = renderHostToolchainAlignment(), prefix = "fish --no-config -c ";
  expect(command.startsWith(prefix)).toBe(true);
  const parent = literal(command.slice(prefix.length));
  const marker = "; timeout --signal=TERM --kill-after=5s 895s fish --no-config -c ", suffix = ' > "$evidence/command.stdout"';
  const wrapper = literal(parent.slice(parent.indexOf(marker) + marker.length, parent.indexOf(suffix)));
  const start = "set -l program ", end = '; fish --no-config -n -c "$program"; or exit $status; fish --no-config -c "$program"';
  expect(wrapper.startsWith(start) && wrapper.endsWith(end)).toBe(true);
  return { command, parent, body: literal(wrapper.slice(start.length, -end.length)) };
}

test("alignment preserves repository pins and the selected Rust components and target", async () => {
  const root = Bun.TOML.parse(await Bun.file(new URL("../../../../mise.toml", import.meta.url)).text()) as { tools: Record<string, unknown> };
  const proposal = await Bun.file(new URL("./plan.json", import.meta.url)).json();
  expect(root.tools["core:bun"]).toBe(alignment.bun);
  expect(root.tools["core:rust"]).toEqual({ version: alignment.rust, profile: "minimal", components: ["rustfmt", "clippy", "llvm-tools"], targets: ["x86_64-unknown-linux-musl"] });
  expect(proposal.tools).toEqual({ "core:bun": alignment.bun, "core:rust": alignment.rust });
  expect(proposal.runtimeConfigSha256).toBe(new Bun.CryptoHasher("sha256").update(await Bun.file(new URL("../../../../mise.toml", import.meta.url)).text()).digest("hex"));
  expect(proposal.rust.miseRustupBootstrapIfMissingIncluded).toBe(true);
});

test("the command is fixed, one-line and round-trips its nested Fish literals", () => {
  const { command, body } = rendered();
  expect(command).toBe(renderHostToolchainAlignment());
  expect(command).not.toMatch(/[\x00\r\n]/);
  expect(body).toContain("printf '%s\\n'");
  expect(body).toContain("'^rustc 1[.]95[.]0([[:space:]]|$)'");
});

test("one explicit install and three exact pinned queries form the whole tool alignment", () => {
  const { body } = rendered();
  expect(body.match(/step install mise install --jobs 1 core:bun@1\.4\.0 core:rust@1\.95\.0/g)).toHaveLength(1);
  for (const tool of ["bun", "rustc", "cargo"]) expect(body).toContain(`step ${tool} mise exec core:bun@1.4.0 core:rust@1.95.0 -- ${tool} --version`);
  expect(body.match(/mise exec /g)).toHaveLength(3);
  expect(body.indexOf("step install ")).toBeLessThan(body.indexOf("step bun "));
  expect(body.indexOf("step bun ")).toBeLessThan(body.indexOf("step rustc "));
  expect(body.indexOf("step rustc ")).toBeLessThan(body.indexOf("step cargo "));
});

test("version comparisons accept exact stable tokens and reject precision or suffix drift", () => {
  expect(versionMatches("bun", "1.4.0")).toBe(true);
  for (const value of ["1.3.0", "1.4.0-canary", "1.4.01", " 1.4.0"]) expect(versionMatches("bun", value)).toBe(false);
  for (const tool of ["rustc", "cargo"] as const) {
    expect(versionMatches(tool, `${tool} 1.95.0 (hash date)`)).toBe(true);
    for (const value of [`${tool} 1.95.0-nightly`, `${tool} 1.95.01`, `${tool} 1.94.0`, `${tool} 1.95`]) expect(versionMatches(tool, value)).toBe(false);
  }
});

test("Mise auto-install stays disabled outside the explicit install operation", () => {
  const { body } = rendered();
  for (const key of ["MISE_AUTO_INSTALL", "MISE_EXEC_AUTO_INSTALL", "MISE_TASK_RUN_AUTO_INSTALL"]) expect(body).toContain(`set -gx ${key} false`);
  expect(body).toContain('command $argv < /dev/null > "$evidence/$name.stdout"');
  expect(body).not.toMatch(/mise (use|trust|settings|upgrade)|--yes|--force|--global|sudo|shell.*activate/);
});

test("runtime-config and ordinary free-space checks precede installation", () => {
  const { body } = rendered();
  expect(body).toContain(alignment.configSha256);
  expect(body).toContain('step free-before df --output=avail -B1 -- "$HOME" .');
  expect(body).toContain("test $amount -ge 8589934592");
  expect(body.indexOf("RUNTIME_CONFIG_MISMATCH")).toBeLessThan(body.indexOf("step install "));
  expect(body.indexOf("HOST_MINIMUM_FREE_SPACE_REQUIRED")).toBeLessThan(body.indexOf("step install "));
  expect(body).toContain('step free-after df --output=avail -B1 -- "$HOME" .');
});

test("surviving parent preserves exit and streams under the grace-inclusive worker deadline", () => {
  const { parent, body } = rendered();
  expect(parent).toContain('command mkdir -- "$evidence"; or begin;');
  expect(parent).toContain("timeout --signal=TERM --kill-after=5s 895s");
  expect(parent).toContain('set -l code $status; printf \'%s\\n\' $code > "$evidence/command.exit"');
  expect(parent).toContain("HOST_TOOLCHAIN_EXIT=%s");
  expect(parent.indexOf('command mkdir -- "$evidence"')).toBeLessThan(parent.indexOf("; timeout "));
  expect(body).toContain('set -l code $status; printf \'%s\\n\' $code > "$evidence/$name.exit"');
  expect(body).toContain("STEP_FAILED:$name");
});

test("host Fish syntax check precedes operations without claiming coding-side parsing", () => {
  const { parent } = rendered();
  expect(parent).toContain('fish --no-config -n -c "$program"; or exit $status');
  expect(parent.indexOf("fish --no-config -n -c")).toBeLessThan(parent.lastIndexOf("fish --no-config -c"));
});

test("success is alignment only and cannot replay the failed receiver or run workloads", () => {
  const { body, parent } = rendered();
  expect(body).toContain("PASS_HOST_TOOLCHAIN_ALIGNMENT_ONLY");
  for (const value of ["host-input-bootstrap-1", "--approved-host-receive-1", "gh api", "docker", "cargo build", "cargo test", "llvm-config", "nvidia-smi", "curl", "wget"]) expect(body + parent).not.toContain(value);
  expect(body + parent).not.toMatch(/mkdir -p|\brm\b|\brmdir\b|git push|git commit/);
});

test("the proposal grants no installation or retry until the actual host-command decision", async () => {
  const proposal = await Bun.file(new URL("./plan.json", import.meta.url)).json();
  expect(proposal.maximumMiseInstallInvocations).toBe(1);
  expect(proposal.maximumVersionQueries).toBe(3);
  for (const key of ["hostInstallationOrVersionVerificationApproved", "miseInstallOrUpgradeAuthorized", "automaticTrustOrGlobalSelectionOrConfigurationChangeAuthorized", "automaticRetryOrForceOrDeletionAuthorized", "receiveReplayOrAssetDownloadOrExtractionAuthorized", "sourceCommitOrPushAuthorized", "imageBuildOrCompilationAuthorized", "cubeclLlvmExecutionAuthorized", "gpuExecutionAuthorized", "trainingAuthorized", "trainingReady"]) expect(proposal[key]).toBe(false);
});
