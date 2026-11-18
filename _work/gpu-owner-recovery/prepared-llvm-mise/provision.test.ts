// SPEC: _spec/gpu-build.puml
import { expect, test } from "bun:test";
import { executePlan, graphResultVerified, validateConfiguration, validateEffectiveScope } from "./provision";

const source = '[tools]\n"core:rust" = { version = "1.95.0", profile = "minimal", components = ["rustfmt", "clippy"], targets = [] }\n';
const configuration = "/fixture/repository/_work/gpu-owner-recovery/mise.toml";
const homes = { rustup: "/fixture/repository/cache/rustup", cargo: "/fixture/repository/cache/cargo" };
const listing = JSON.stringify([{ path: configuration, tools: ["rust"] }]);
const settings = [homes.rustup + "\n", homes.cargo + "\n", "x86_64-unknown-linux-gnu\n"];

function fixture(fail?: string, changeSource = false) {
  const calls: { name: string; args: string[]; timeoutMs: number }[] = [];
  let reads = 0;
  const io = { configuration, readConfiguration: async () => ++reads > 1 && changeSource ? source + "\n" : source,
    run: async (name: string, args: string[], timeoutMs: number) => {
      calls.push({ name, args, timeoutMs });
      const stdout = ({ config: listing, "rustup-home": settings[0], "cargo-home": settings[1], host: settings[2] } as Record<string, string>)[name] ?? "";
      return { status: name === fail ? "FAIL" : "PASS", stdout };
    } };
  return { io, calls };
}

test("only the pinned minimal profile and configured components are admitted", () => {
  expect(() => validateConfiguration(source)).not.toThrow();
  for (const changed of [source.replace("1.95.0", "stable"), source.replace('"minimal"', '"default"'), source.replace('"clippy"', '"llvm-tools"'), source.replace("targets = []", 'targets = ["wasm32-unknown-unknown"]')]) {
    expect(() => validateConfiguration(changed)).toThrow("PINNED_SCOPED_RUST_CONFIGURATION_REQUIRED");
  }
});

test("fresh discovery excludes unrelated root/global configuration", () => {
  expect(() => validateEffectiveScope(listing, settings, { configuration, ...homes })).not.toThrow();
  expect(() => validateEffectiveScope(JSON.stringify([{ path: "/unrelated/mise.toml", tools: ["rust"] }]), settings, { configuration, ...homes })).toThrow();
  expect(() => validateEffectiveScope(JSON.stringify([{ path: configuration, tools: ["rust"] }, { path: "/extra/mise.toml", tools: [] }]), settings, { configuration, ...homes })).toThrow();
  expect(() => validateEffectiveScope(listing, ["/global/rustup", homes.cargo, settings[2]!], { configuration, ...homes })).toThrow("REPOSITORY_OWNED_RUST_HOMES_REQUIRED");
});

test("the approved plan installs once after fresh checks and uses fixed deadlines", async () => {
  const { io, calls } = fixture();
  expect(await executePlan(io, homes)).toEqual({ status: "TOOLCHAIN_INSTALL_PASS", failedStep: null, installInvocations: 1 });
  expect(calls.filter(call => call.name === "install")).toEqual([{ name: "install", args: ["install", "--jobs", "1", "core:rust"], timeoutMs: 600_000 }]);
  expect(calls.filter(call => call.name !== "install").every(call => call.timeoutMs === 10_000)).toBe(true);
  expect(calls.find(call => call.name === "trust")?.args).toEqual(["trust", configuration]);
});

test("each preflight failure stops without installation", async () => {
  for (const failed of ["version", "install-help", "trust-help", "trust", "config", "rustup-home", "cargo-home", "host"]) {
    const { io, calls } = fixture(failed);
    expect((await executePlan(io, homes)).installInvocations).toBe(0);
    expect(calls.at(-1)?.name).toBe(failed);
    expect(calls.some(call => call.name === "install")).toBe(false);
  }
});

test("an installation failure consumes one attempt without a retry", async () => {
  const { io, calls } = fixture("install");
  expect(await executePlan(io, homes)).toEqual({ status: "FAIL_INSTALL", failedStep: "install", installInvocations: 1 });
  expect(calls.filter(call => call.name === "install")).toHaveLength(1);
});

test("configuration changes between discovery and installation stop the attempt", async () => {
  const { io, calls } = fixture(undefined, true);
  await expect(executePlan(io, homes)).rejects.toThrow("CONFIGURATION_CHANGED_BEFORE_INSTALL");
  expect(calls.some(call => call.name === "install")).toBe(false);
});

test("installation or static success alone cannot qualify offline feature trees", () => {
  const cargo = "/fixture/repository/cache/rustup/toolchains/1.95.0-x86_64-unknown-linux-gnu/bin/cargo";
  const rustc = cargo.replace(/cargo$/, "rustc");
  const graph = { status: "PASS", argv: [cargo, "tree"], expectedFeatureTextPresent: true };
  const receipt = { graphStatus: "PASS_FEATURE_TREE_ONLY", sourcesChangedDuringRun: false, graphEnvironment: { RUSTC: rustc }, graphs: [graph, graph, graph] };
  expect(graphResultVerified(receipt, cargo, rustc)).toBe(true);
  expect(graphResultVerified({ ...receipt, graphStatus: "UNAVAILABLE_CARGO" }, cargo, rustc)).toBe(false);
  expect(graphResultVerified({ ...receipt, graphs: [] }, cargo, rustc)).toBe(false);
  expect(graphResultVerified({ ...receipt, graphEnvironment: { RUSTC: "/global/rustc" } }, cargo, rustc)).toBe(false);
  expect(graphResultVerified({ ...receipt, sourcesChangedDuringRun: true }, cargo, rustc)).toBe(false);
});
