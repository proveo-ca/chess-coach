// SPEC: _spec/tooling/bun-first-party-tooling.puml, _spec/tooling/sbx-dev/preparation-workflow.puml
import { afterEach, beforeEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { checkBundle } from "../check-bundle.mjs";

const ROOT = new URL("../", import.meta.url).pathname;
let root, fake, archive, digest;
const fakeSource = `#!${process.execPath}
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
const root = process.env.FAKE_SBX_HOME;
const args = process.argv.slice(2);
appendFileSync(root + '/calls', JSON.stringify(args) + '\\n');
const mode = process.env.FAKE_MODE;
const state = root + '/name';
if (args[0] === 'ls') {
  if (existsSync(state) && mode !== 'unlisted') console.log(readFileSync(state, 'utf8'));
} else if (args[0] === 'create') {
  writeFileSync(state, args[2]);
  if (mode === 'create-fail') process.exit(1);
} else if (args[0] === 'cp') {
  if (mode === 'copy-fail') process.exit(1);
} else if (args[0] === 'exec') {
  if (mode === 'exec-fail') process.exit(1);
} else process.exit(3);
`;

function tar(entries = [{ name: "bin/rustc" }, { name: "bin/cargo" }]) {
  const chunks = [];
  for (const entry of entries) {
    const data = Buffer.from(entry.data ?? "offline fixture");
    const header = Buffer.alloc(512);
    header.write(entry.name, 0, 100, "ascii");
    function octal(value, at, length) { header.write(value.toString(8).padStart(length - 1, "0") + "\0", at, length, "ascii"); }
    octal(entry.mode ?? 0o755, 100, 8);
    octal(0, 108, 8); octal(0, 116, 8);
    octal(entry.type ? 0 : data.length, 124, 12); octal(0, 136, 12);
    header.fill(32, 148, 156);
    header.write(entry.type ?? "0", 156, 1);
    if (entry.link) header.write(entry.link, 157, 100, "ascii");
    header.write("ustar\0", 257, 6); header.write("00", 263, 2);
    octal(header.reduce((sum, byte) => sum + byte, 0), 148, 7);
    header[155] = 32;
    chunks.push(header);
    if (!entry.type) chunks.push(data, Buffer.alloc((512 - data.length % 512) % 512));
  }
  writeFileSync(archive, Buffer.concat([...chunks, Buffer.alloc(1024)]));
  digest = createHash("sha256").update(readFileSync(archive)).digest("hex");
}
beforeEach(() => {
  root = mkdtempSync("/tmp/opencode/sbx-dev-");
  fake = join(root, "sbx");
  writeFileSync(fake, fakeSource); chmodSync(fake, 0o755);
  archive = join(root, "tools.tar");
  tar();
});
afterEach(() => { rmSync(root, { recursive: true, force: true }); });
function invoke(script, args, mode = "") {
  return spawnSync("/usr/bin/bash", ["--noprofile", "--norc", join(ROOT, script), ...args], {
    env: { ...process.env, FAKE_SBX_HOME: root, FAKE_MODE: mode }, encoding: "utf8", timeout: 15000,
  });
}
function create(mode = "") { return invoke("create.sh", ["--sbx", fake], mode); }
function calls() { return existsSync(join(root, "calls")) ? readFileSync(join(root, "calls"), "utf8").trim().split("\n").map(JSON.parse) : []; }

test("create uses one exact mountless command and retains the named VM", () => {
  const result = create();
  expect(result.status).toBe(0);
  const name = readFileSync(join(root, "name"), "utf8");
  expect(name).toMatch(/^devrust-[0-9a-f]{24}$/);
  expect(result.stdout).toContain(`DEV_CREATED_NAME=${name}`);
  expect(calls()).toEqual([
    ["ls", "-q"], ["create", "--name", name, "--pull", "never", "--skills", "off", "--deny-network", "**", "--cpus", "2", "--memory", "4g", "shell"], ["ls", "-q"],
  ]);
});
test("placeholder executable refuses before any provider", () => {
  expect(invoke("create.sh", ["--sbx", "/absolute/path/to/sbx"]).status).toBe(2);
  expect(calls()).toEqual([]);
});
test.each(["create-fail", "unlisted"])("ambiguous %s does not retry or remove", (mode) => {
  expect(create(mode).status).toBe(2);
  expect(calls()).toHaveLength(mode === "unlisted" ? 3 : 2);
  expect(calls().some(([command]) => command === "rm")).toBe(false);
});
test("deprecated combined seed refuses before any provider or guest execution", () => {
  for (const args of [[], ["--sbx", fake, "--name", "devrust-" + "a".repeat(24), "--bundle", archive, "--sha256", digest]]) {
    const result = invoke("seed.sh", args);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("combined seed is disabled");
    expect(calls()).toEqual([]);
  }
});
test("archive validates hashes and refuses symlink archives", async () => {
  await checkBundle(archive, digest);
  await expect(checkBundle(archive, "0".repeat(64))).rejects.toThrow("digest mismatch");
  const alias = join(root, "alias.tar");
  symlinkSync(archive, alias);
  await expect(checkBundle(alias, digest)).rejects.toThrow("regular file");
});
test.each([
  [{ name: "../../host" }],
  [{ name: "/absolute" }],
  [{ name: "bin/rustc", type: "2", link: "/home/agent/.ssh" }],
  [{ name: "bin/rustc", type: "1", link: "other" }],
  [{ name: "bin/rustc" }, { name: "bin/rustc" }],
  [{ name: "bin/rustc", mode: 0o644 }, { name: "bin/cargo" }],
  [{ name: "line\nname" }],
].map((entries) => ({ entries })))("unsafe archives refuse before any provider: %j", async ({ entries }) => {
  tar(entries);
  await expect(checkBundle(archive, digest)).rejects.toThrow();
  expect(calls()).toEqual([]);
});
test("malformed archive returns bounded STOP", () => {
  writeFileSync(archive, "not an archive");
  digest = createHash("sha256").update(readFileSync(archive)).digest("hex");
  const result = spawnSync(process.execPath, ["--no-env-file", "--no-install", join(ROOT, "check-bundle.mjs"), archive, digest], { encoding: "utf8" });
  expect(result.status).toBe(2);
  expect(result.stderr).toContain("STOP:");
  expect(calls()).toEqual([]);
});
