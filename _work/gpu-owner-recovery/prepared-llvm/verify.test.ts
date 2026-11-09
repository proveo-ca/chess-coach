// SPEC: _spec/gpu-build.puml
import { expect, test } from "bun:test";
import { graphToolchain } from "./verify";

const environment = { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: "/fixture/home", CARGO_NET_OFFLINE: "true" };
const pinned = { path: "/fixture/rust/1.95.0/bin/cargo", executableAvailable: true, eligibleForGraphProbe: true,
  rustcPath: "/fixture/rust/1.95.0/bin/rustc", rustcExecutableAvailable: true };

test("graph checks bind Cargo and rustc from the same pinned toolchain", () => {
  const selected = graphToolchain([pinned], environment);
  expect(selected?.cargo).toBe(pinned.path);
  expect(selected?.environment.RUSTC).toBe(pinned.rustcPath);
  expect(selected?.environment.PATH).toBe("/fixture/rust/1.95.0/bin:" + environment.PATH);
  expect(selected?.environment.CARGO_NET_OFFLINE).toBe("true");
});

test("Cargo without its paired rustc cannot activate graph checks", () => {
  expect(graphToolchain([{ ...pinned, rustcExecutableAvailable: false }], environment)).toBeNull();
  expect(graphToolchain([{ ...pinned, rustcPath: null }], environment)).toBeNull();
});

test("unversioned tool availability cannot substitute for a pinned toolchain", () => {
  expect(graphToolchain([{ ...pinned, path: "/usr/bin/cargo", eligibleForGraphProbe: false }], environment)).toBeNull();
});

test("unavailable Cargo produces no selected graph environment", () => {
  expect(graphToolchain([], environment)).toBeNull();
  expect(graphToolchain([{ ...pinned, executableAvailable: false }], environment)).toBeNull();
});

test("graph toolchain selection leaves the static-check environment unchanged", () => {
  const before = { ...environment };
  const selected = graphToolchain([pinned], environment);
  expect(environment).toEqual(before);
  expect(environment).not.toHaveProperty("RUSTC");
  expect(selected?.environment).not.toBe(environment);
});
