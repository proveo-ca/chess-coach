// SPEC: _spec/runtime-protocol.puml, _spec/training-container-access.puml
import { expect, test } from "bun:test";
import { constants as C, readFileSync } from "node:fs";
import * as fs from "node:fs/promises";
import { join } from "node:path";
import { CREATED_FORMAT, createArgs, HOST_BUN, IMAGE, probe, removeProbeFiles, VOLUME } from "./probe";
import { renderCommand } from "./render-command";
import { repositoryScratch } from "../../../../packages/runtime/tests/repository-scratch";

const token = "a".repeat(32), cid = "b".repeat(64), cidOther = "c".repeat(64);
const path = `${VOLUME}/.packet2-access-probe-${token}`;
const label = "unconfined_u:object_r:var_lib_t:s0", ctx = "system_u:system_r:container_t:s0:c7,c8";
const result = (out = "", exit = 0, err = "") => ({ out, exit, err, signal: null });
const mount = { Type: "bind", Source: path, Destination: "/probe", RW: true, Propagation: "rprivate" };
const config = ["created", ctx, "1000:1000", "runc", "none", "none", true, false, [mount]];
const created = (values: unknown[] = config) => result(values.map(value => JSON.stringify(value)).join(" ") + "\n");
function scenario() {
  const calls: string[] = [], argv: string[][] = [];
  const replies = new Map([
    ["image", result("null\n")],
    ["create", result(cid + "\n")], ["start", result(ctx + "\n")],
    ["created", created()], ["inspect", result(`exited 0 ${ctx}\n`)], ["rm", result(cid + "\n")]
  ]);
  const io: Parameters<typeof probe>[0] = {
    metadata: async p => { calls.push(`stat:${p}`); return p === VOLUME ? "38:45679082" : "38:99"; },
    label: p => { calls.push(`label:${p}`); return label; },
    enforcing: async () => { calls.push("enforcing"); return true; },
    createDirectory: async p => { calls.push(`mkdir:${p}`); },
    pinDirectory: async p => { calls.push(`pin:${p}`); return "38:99"; },
    writeSeed: async (p, t) => { calls.push(`seed:${p}:${t}`); },
    verifyReply: async (p, t) => { calls.push(`reply:${p}:${t}`); },
    removeDirectory: async (p, i, replyMayExist) => { calls.push(`rmdir:${p}:${i}:${replyMayExist}`); },
    docker: args => { argv.push(args); calls.push(`docker:${args[0]}`); return replies.get(args[2] === `--format=${CREATED_FORMAT}` ? "created" : args[0]!)!; }
  };
  return { io, calls, argv, replies };
}

test("uses the packet2 image and interpreter, one private bind, and pinned offline CPU flags", () => {
  const { plan } = JSON.parse(readFileSync(new URL("../../full-training-packet-2/request.json", import.meta.url), "utf8"));
  expect(IMAGE).toBe(plan.image);
  expect(HOST_BUN).toBe(plan.cachedBun);
  const argv = createArgs(token, "38:99");
  for (const flag of ["--pull=never", "--platform=linux/amd64", "--network=none", "--runtime=runc", "--user=1000:1000", "--read-only", "--restart=no", "--no-healthcheck", "--log-driver=none"])
    expect(argv).toContain(flag);
  expect(argv.filter(arg => arg === "--mount")).toHaveLength(1);
  expect(argv[argv.indexOf("--mount") + 1]).toBe(`type=bind,src=${path},dst=/probe,bind-propagation=rprivate`);
  expect(argv).not.toContain("--privileged");
  expect(argv).not.toContain("--security-opt");
  expect(argv.join(" ")).not.toMatch(/--gpus|--device|label=disable|:(?:z|Z)(?: |$)/);
  expect(argv.indexOf(IMAGE)).toBeGreaterThan(argv.indexOf("--mount"));
  expect(argv.slice(-2)).toEqual([token, "38:99"]);
});

test("a success requires attach, exact SELinux process label, host readback, and confirmed cleanup", async () => {
  const { io, argv, calls } = scenario();
  const r = await probe(io, token);
  expect(r).toMatchObject({ status: "PASS_DISPOSABLE_CONTAINER_ACCESS", id: cid, accessObserved: true, cleanupConfirmed: true,
    containerRemoved: true, directoryRemoved: true, campaignAccessVerified: false, relabelRequested: false, trainingExecuted: false, cleanupErrors: [] });
  expect(argv).toEqual([["image", "inspect", "--platform=linux/amd64", "--format={{json .Config.Volumes}}", IMAGE],
    createArgs(token, "38:99"), ["inspect", "--type=container", `--format=${CREATED_FORMAT}`, cid], ["start", "--attach", cid],
    ["inspect", "--type=container", "--format={{.State.Status}} {{.State.ExitCode}} {{.ProcessLabel}}", cid], ["rm", "-f", cid]]);
  expect(calls.indexOf(`reply:${path}/reply:${token}`)).toBeGreaterThan(calls.lastIndexOf("docker:inspect"));
  expect(calls.indexOf(`rmdir:${path}:38:99:true`)).toBeGreaterThan(calls.indexOf("docker:rm"));
});

test("rejects a malformed nonce before performing any operation", async () => {
  const { io, calls } = scenario();
  await expect(probe(io, "../probe")).rejects.toThrow("PROBE_TOKEN");
  expect(calls).toEqual([]);
});

test("volume mismatch, missing enforcement, or changed context stop before a disposable write", async () => {
  for (const mode of ["identity", "enforcing", "label"]) {
    const { io, argv, calls } = scenario();
    if (mode === "identity") io.metadata = async () => "1:1";
    if (mode === "enforcing") io.enforcing = async () => false;
    if (mode === "label") io.label = () => "unexpected";
    expect(await probe(io, token)).toMatchObject({ accessObserved: false, cleanupConfirmed: true, directoryCreated: false });
    expect(argv).toEqual([]);
    expect(calls.some(call => call.startsWith("mkdir:"))).toBe(false);
  }
});

test("an absent retained image or an image-declared volume blocks before writes", async () => {
  for (const image of [result("", 1), result('{"/extra":{}}')]) {
    const { io, argv, calls, replies } = scenario();
    replies.set("image", image);
    expect(await probe(io, token)).toMatchObject({ error: "RETAINED_IMAGE_OR_VOLUME_CONFIG_NOT_CONFIRMED", directoryCreated: false, cleanupConfirmed: true });
    expect(argv.map(args => args[0])).toEqual(["image"]);
    expect(calls.some(call => call.startsWith("mkdir:"))).toBe(false);
  }
});

test("a directory collision is never removed and a different child label blocks container creation", async () => {
  const collision = scenario();
  collision.io.createDirectory = async () => { throw new Error("EEXIST"); };
  expect(await probe(collision.io, token)).toMatchObject({ error: "EEXIST", directoryCreated: false });
  expect(collision.calls.some(call => call.startsWith("rmdir:"))).toBe(false);
  const changed = scenario();
  changed.io.label = p => p === VOLUME ? label : "unexpected";
  expect(await probe(changed.io, token)).toMatchObject({ error: "DISPOSABLE_DIRECTORY_LABEL_DIFFERS", directoryRemoved: true });
  expect(changed.argv.map(args => args[0])).toEqual(["image"]);
});

test("ambiguous create never starts, removes, or adopts a container or removes its pending bind", async () => {
  for (const response of [result(cid, 124), result("shortid"), result("", 1)]) {
    const { io, argv, replies, calls } = scenario();
    replies.set("create", response);
    expect(await probe(io, token)).toMatchObject({ error: "CONTAINER_CREATE_NOT_CONFIRMED", id: null, cleanupConfirmed: false, directoryRemoved: false });
    expect(argv.map(args => args[0])).toEqual(["image", "create"]);
    expect(calls.some(call => call.startsWith("rmdir:"))).toBe(false);
  }
});

test("detects directory replacement before attach and removes only the known container", async () => {
  const { io, argv } = scenario();
  let childReads = 0;
  io.metadata = async p => p === VOLUME ? "38:45679082" : (++childReads >= 2 ? "38:100" : "38:99");
  const r = await probe(io, token);
  expect(r).toMatchObject({ error: "VOLUME_OR_DISPOSABLE_DIRECTORY_CHANGED_BEFORE_START", accessObserved: false, containerRemoved: true });
  expect(argv.map(args => args[0])).toEqual(["image", "create", "inspect", "rm"]);
});

test("never starts a container with a mismatched configured process label, logging, privileges, or bind", async () => {
  for (const [index, wrong] of [[1, ""], [2, "0:0"], [3, "nvidia"], [4, "bridge"], [5, "syslog"], [6, false], [7, true],
    [8, [{ ...mount, Source: VOLUME }]], [8, [mount, mount]]] as const) {
    const { io, argv, replies, calls } = scenario();
    const values: unknown[] = [...config]; values[index] = wrong;
    replies.set("created", created(values));
    expect(await probe(io, token)).toMatchObject({ accessObserved: false, containerRemoved: true, cleanupConfirmed: true });
    expect(argv.map(args => args[0])).toEqual(["image", "create", "inspect", "rm"]);
    expect(calls).toContain(`rmdir:${path}:38:99:false`);
  }
});

test("attach failure, unconfined label, and mismatched inspected state are blocked and clean up the owned ID", async () => {
  for (const [stage, response] of [["start", result(ctx, 124)], ["start", result("unconfined_u:unconfined_r:unconfined_t:s0")],
    ["inspect", result(`exited 24 ${ctx}`)], ["inspect", result("exited 0 system_u:system_r:container_t:s0:c9,c10")]] as const) {
    const { io, argv, replies } = scenario();
    replies.set(stage, response);
    expect(await probe(io, token)).toMatchObject({ status: "BLOCKED_DISPOSABLE_CONTAINER_ACCESS", accessObserved: false, cleanupConfirmed: true });
    expect(argv.at(-1)).toEqual(["rm", "-f", cid]);
  }
});

test("reply and final enforcement failures cannot pass", async () => {
  for (const mode of ["reply", "before-start", "after-start"]) {
    const { io, argv } = scenario();
    if (mode === "reply") io.verifyReply = async () => { throw new Error("PROBE_REPLY_MISMATCH"); };
    else { let checked = 0; io.enforcing = async () => ++checked < (mode === "before-start" ? 2 : 3); }
    expect(await probe(io, token)).toMatchObject({ accessObserved: false, cleanupConfirmed: true, status: "BLOCKED_DISPOSABLE_CONTAINER_ACCESS" });
    if (mode === "before-start") expect(argv.map(args => args[0])).not.toContain("start");
  }
});

test("unconfirmed removal preserves the bind and exposes a cleanup error", async () => {
  for (const response of [result(cidOther), result(cid, 124)]) {
    const { io, replies, calls } = scenario();
    replies.set("rm", response);
    expect(await probe(io, token)).toMatchObject({ error: null, cleanupErrors: ["CONTAINER_REMOVAL_NOT_CONFIRMED", "DISPOSABLE_DIRECTORY_LEFT_IN_PLACE"], accessObserved: true,
      cleanupConfirmed: false, directoryRemoved: false, status: "BLOCKED_DISPOSABLE_CONTAINER_ACCESS" });
    expect(calls.some(call => call.startsWith("rmdir:"))).toBe(false);
  }
});

test("cleanup checks volume identity and reports a retained directory on cleanup failure", async () => {
  for (const mode of ["drift", "cleanup"]) {
    const { io, argv, calls } = scenario();
    if (mode === "drift") io.metadata = async p => p === VOLUME ? (argv.at(-1)?.[0] === "rm" ? "7:7" : "38:45679082") : "38:99";
    else io.removeDirectory = async () => { throw new Error("ENOTEMPTY"); };
    expect(await probe(io, token)).toMatchObject({ error: null, cleanupErrors: [mode === "drift" ? "CLEANUP_VOLUME_IDENTITY_CHANGED" : "ENOTEMPTY"],
      accessObserved: true, containerRemoved: true, directoryRemoved: false, cleanupConfirmed: false });
    expect(calls.some(call => call.startsWith("rmdir:"))).toBe(false);
  }
});

test("preserves the original probe error separately from later cleanup failures", async () => {
  const { io, replies } = scenario();
  replies.set("start", result(ctx, 124));
  replies.set("rm", result("", 124));
  expect(await probe(io, token)).toMatchObject({ error: "CONTAINER_PROBE_FAILED_OR_CONTEXT_MISMATCH",
    cleanupErrors: ["CONTAINER_REMOVAL_NOT_CONFIRMED", "DISPOSABLE_DIRECTORY_LEFT_IN_PLACE"], cleanupConfirmed: false });
});

test("descriptor-relative cleanup cannot delete files from a symlink replacement", async () => {
  const scratch = repositoryScratch("probe-fd-cleanup-");
  const original = join(scratch, "probe"), moved = join(scratch, "moved"), replacement = join(scratch, "outside");
  await fs.mkdir(original); await fs.mkdir(replacement);
  for (const name of ["seed", "reply"]) {
    await fs.writeFile(join(original, name), "owned", { flag: "wx" });
    await fs.writeFile(join(replacement, name), "outside", { flag: "wx" });
  }
  const fd = await fs.open(original, C.O_RDONLY | C.O_DIRECTORY | C.O_NOFOLLOW);
  try {
    await fs.rename(original, moved);
    await fs.symlink(replacement, original);
    await removeProbeFiles(fd, false, false);
    expect(await fs.readFile(join(moved, "seed"), "utf8")).toBe("owned");
    await removeProbeFiles(fd, true, true);
    for (const name of ["seed", "reply"]) {
      await expect(fs.lstat(join(moved, name))).rejects.toMatchObject({ code: "ENOENT" });
      expect(await fs.readFile(join(replacement, name), "utf8")).toBe("outside");
    }
  } finally {
    await fd.close();
    await fs.unlink(original);
    for (const base of [moved, replacement]) {
      for (const name of ["seed", "reply"]) await fs.unlink(join(base, name)).catch(error => { if (error.code !== "ENOENT") throw error; });
      await fs.rmdir(base);
    }
    await fs.rmdir(scratch);
  }
});

test("the offline launcher binds the published commit and exact TypeScript bytes", () => {
  const commit = "d".repeat(40);
  const source = readFileSync(new URL("./probe.ts", import.meta.url), "utf8");
  const command = renderCommand(source, commit);
  expect(command.startsWith("/usr/bin/env -i ")).toBe(true);
  expect(command).toContain(` _ ${commit} '`);
  expect(command).toContain(`/usr/bin/timeout -k 2s 75s ${HOST_BUN} --config=/dev/null`);
  const payload = / '([A-Za-z0-9+/=]+)'\n$/.exec(command)?.[1];
  expect(payload && Buffer.from(payload, "base64").toString()).toBe(source);
  for (const text of ["missing newline", "nul\0\n", "cr\r\n", "x".repeat(16384) + "\n"])
    expect(() => renderCommand(text, commit)).toThrow("PROBE_COMMAND_ENVELOPE");
  expect(() => renderCommand(source, "invalid")).toThrow("PROBE_COMMAND_ENVELOPE");
});

test("a harmless embedded program runs without a caller-directory Bun preload", async () => {
  const scratch = repositoryScratch("probe-launcher-");
  const config = join(scratch, "bunfig.toml"), preload = join(scratch, "preload.ts");
  await fs.writeFile(config, 'preload = ["./preload.ts"]\n', { flag: "wx" });
  await fs.writeFile(preload, 'console.log("CALLER_PRELOAD");\n', { flag: "wx" });
  const commit = "e".repeat(40);
  const command = renderCommand('console.log(JSON.stringify({ cwd: process.cwd(), commit: Bun.argv[2] }));\n', commit)
    .replace(HOST_BUN, process.execPath);
  try {
    const baseline = Bun.spawnSync([process.execPath, "--no-env-file", "--no-install", "-e", "console.log('baseline')"], {
      cwd: scratch, env: { PATH: "/usr/bin:/bin", HOME: "/" }, stdout: "pipe", stderr: "pipe", timeout: 5000
    });
    expect(baseline.exitCode).toBe(0);
    expect(baseline.stdout.toString()).toContain("CALLER_PRELOAD");
    const wrapped = Bun.spawnSync(["/usr/bin/bash", "--noprofile", "--norc", "-c", command], {
      cwd: scratch, stdout: "pipe", stderr: "pipe", timeout: 5000
    });
    expect(wrapped.exitCode).toBe(0);
    expect(wrapped.stdout.toString()).toBe(JSON.stringify({ cwd: "/", commit }) + "\n");
    expect(wrapped.stderr.toString()).toBe("");
  } finally {
    await fs.unlink(config); await fs.unlink(preload); await fs.rmdir(scratch);
  }
});
