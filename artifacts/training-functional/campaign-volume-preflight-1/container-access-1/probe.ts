// SPEC: _spec/runtime-protocol.puml
import { constants as C } from "node:fs";
import * as fs from "node:fs/promises";
import { randomBytes } from "node:crypto";

export const VOLUME = "/var/lib/chess-coach/training-volume-1";
export const IMAGE = "docker.io/library/rust@sha256:4c2fd73ef19c5ef9d54bee03b06b2839a392604fbfcd578ed948b71b37c1d7fb";
const BUN = "/home/gu1lty/Projects/proveo/chess-coach/_work/gpu-owner-recovery/cache/host-gpu-native-build-1/bun";
const LABEL = "unconfined_u:object_r:var_lib_t:s0";
const PREFIX = ".packet2-access-probe-";
const TOKEN = /^[0-9a-f]{32}$/;
const CID = /^[0-9a-f]{64}$/;
const PAYLOAD = 'ctx=$(cat /proc/self/attr/current); case "$ctx" in *:container_t:*) ;; *) exit 21 ;; esac; printf "%s\\n" "$ctx"; seed=$(cat /probe/seed) || exit 22; [ "$seed" = "$1" ] || exit 22; umask 077; (set -C; printf "%s" "$1" > /probe/reply) || exit 23; reply=$(cat /probe/reply) || exit 24; [ "$reply" = "$1" ] || exit 24';
type Result = { exit: number | null; signal: string | null; out: string; err: string };
type IO = { metadata(path: string): Promise<string>; label(path: string): string; enforcing(): Promise<boolean>;
  createDirectory(path: string): Promise<void>; writeSeed(path: string, token: string): Promise<void>;
  verifyReply(path: string, token: string): Promise<void>; removeDirectory(path: string, identity: string): Promise<void>;
  docker(args: string[]): Result };
const requireValue = (value: unknown, reason: string) => { if (!value) throw new Error(reason); };
const ok = (r: Result) => r.exit === 0 && r.signal === null;
const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 512);

export function createArgs(token: string) {
  requireValue(TOKEN.test(token), "PROBE_TOKEN");
  return ["create", "--name", `packet2-access-${token}`, "--pull=never", "--platform=linux/amd64", "--runtime=runc", "--network=none",
    "--user=1000:1000", "--read-only", "--no-healthcheck", "--memory=64m", "--memory-swap=64m", "--cpus=1", "--pids-limit=16",
    "--mount", `type=bind,src=${VOLUME}/${PREFIX}${token},dst=/probe`, "--entrypoint=/bin/sh", IMAGE, "-eu", "-c", PAYLOAD, "probe", token];
}

export async function probe(io: IO, token: string) {
  const args = createArgs(token), path = `${VOLUME}/${PREFIX}${token}`, name = `packet2-access-${token}`;
  const checks: Record<string, Result> = {};
  let identity: string | null = null, id: string | null = null, error: string | null = null, accessObserved = false;
  let directoryCreated = false, createRequested = false, containerRemoved = false, directoryRemoved = false;
  try {
    const volumeIdentity = await io.metadata(VOLUME);
    requireValue(volumeIdentity === "38:45679082", "VOLUME_IDENTITY_CHANGED");
    requireValue(await io.enforcing(), "SELINUX_NOT_CONFIRMED_ENFORCING");
    requireValue(io.label(VOLUME) === LABEL, "VOLUME_LABEL_CHANGED_OR_UNKNOWN");
    await io.createDirectory(path); directoryCreated = true;
    identity = await io.metadata(path);
    requireValue(await io.metadata(VOLUME) === volumeIdentity, "VOLUME_IDENTITY_CHANGED");
    requireValue(io.label(path) === LABEL, "DISPOSABLE_DIRECTORY_LABEL_DIFFERS");
    await io.writeSeed(`${path}/seed`, token);
    requireValue(io.label(`${path}/seed`) === LABEL, "SEED_LABEL_DIFFERS");
    requireValue(await io.metadata(path) === identity && await io.metadata(VOLUME) === volumeIdentity, "VOLUME_OR_DISPOSABLE_DIRECTORY_CHANGED");
    createRequested = true;
    const create = checks.create = io.docker(args);
    requireValue(ok(create) && CID.test(create.out.trim()), "CONTAINER_CREATE_NOT_CONFIRMED");
    id = create.out.trim();
    const start = checks.start = io.docker(["start", "--attach", id]);
    const ctx = start.out.trim();
    requireValue(ok(start) && /^[^:\s]+:[^:\s]+:container_t:[^\s]+$/.test(ctx), "CONTAINER_PROBE_FAILED_OR_UNCONFINED");
    const state = checks.state = io.docker(["inspect", "--type=container", "--format={{.State.Status}} {{.State.ExitCode}} {{.ProcessLabel}}", id]);
    requireValue(ok(state) && state.out.trim() === `exited 0 ${ctx}`, "CONTAINER_EXIT_OR_LABEL_NOT_CONFIRMED");
    requireValue(await io.metadata(path) === identity, "DISPOSABLE_DIRECTORY_CHANGED");
    await io.verifyReply(`${path}/reply`, token);
    requireValue(await io.enforcing(), "SELINUX_NOT_CONFIRMED_ENFORCING_AT_END");
    requireValue(io.label(path) === LABEL && io.label(VOLUME) === LABEL && await io.metadata(VOLUME) === volumeIdentity, "VOLUME_OR_LABEL_CHANGED");
    accessObserved = true;
  } catch (e) { error = errorText(e); }
  finally {
    if (id !== null) {
      try { const r = checks.remove = io.docker(["rm", "-fv", id]); containerRemoved = ok(r) && r.out.trim() === id; }
      catch (e) { error ??= errorText(e); }
    }
    if (directoryCreated && identity !== null && (!createRequested || containerRemoved)) {
      try { await io.removeDirectory(path, identity); directoryRemoved = true; }
      catch (e) { error ??= errorText(e); }
    }
  }
  const cleanupConfirmed = (!createRequested || containerRemoved) && (!directoryCreated || directoryRemoved);
  return { status: accessObserved && cleanupConfirmed ? "PASS_DISPOSABLE_CONTAINER_ACCESS" : "BLOCKED_DISPOSABLE_CONTAINER_ACCESS",
    image: IMAGE, uid: 1000, gid: 1000, runtime: "runc", expectedLabel: LABEL, path, name, id, checks, error, accessObserved,
    cleanupConfirmed, directoryCreated, directoryRemoved, createRequested, containerRemoved,
    campaignAccessVerified: false, selinuxLabelsChanged: false, preparationExecuted: false, trainingExecuted: false };
}

function command(argv: string[]): Result {
  const p = Bun.spawnSync(["/usr/bin/timeout", "-k", "2s", "8s", ...argv], { stdin: "ignore", stdout: "pipe", stderr: "pipe", maxBuffer: 4096,
    env: { PATH: "/usr/bin:/bin", HOME: "/", LC_ALL: "C" } });
  return { exit: p.exitCode, signal: p.signalCode ?? null, out: p.stdout.toString().slice(0, 4096), err: p.stderr.toString().slice(0, 4096) };
}

async function metadata(path: string) {
  const s = await fs.lstat(path, { bigint: true });
  requireValue(s.isDirectory() && s.uid === 1000n && s.gid === 1000n && (s.mode & 0o7777n) === 0o700n && await fs.realpath(path) === path, "DIRECTORY_METADATA");
  return `${s.dev}:${s.ino}`;
}

const production: IO = {
  metadata,
  label: path => {
    const r = command(["/usr/bin/ls", "-Zd", "--", path]);
    requireValue(ok(r) && r.out.trim() === `${LABEL} ${path}`, "LABEL_NOT_CONFIRMED");
    return LABEL;
  },
  enforcing: async () => {
    const f = await fs.open("/sys/fs/selinux/enforce", C.O_RDONLY | C.O_NOFOLLOW | C.O_NONBLOCK);
    try { const buf = Buffer.alloc(4), { bytesRead } = await f.read(buf, 0, buf.length, null); return buf.subarray(0, bytesRead).toString().trim() === "1"; }
    finally { await f.close(); }
  },
  createDirectory: path => fs.mkdir(path, { mode: 0o700 }).then(() => {}),
  writeSeed: (path, token) => fs.writeFile(path, token, { mode: 0o600, flag: "wx" }),
  verifyReply: async (path, token) => {
    const f = await fs.open(path, C.O_RDONLY | C.O_NOFOLLOW | C.O_NONBLOCK);
    try {
      const s = await f.stat();
      requireValue(s.isFile() && s.uid === 1000 && s.gid === 1000 && (s.mode & 0o777) === 0o600 && s.size === 32, "PROBE_REPLY_METADATA");
      const buf = Buffer.alloc(33), { bytesRead } = await f.read(buf, 0, buf.length, 0);
      requireValue(bytesRead === 32 && buf.subarray(0, bytesRead).toString() === token, "PROBE_REPLY_MISMATCH");
    } finally { await f.close(); }
  },
  removeDirectory: async (path, identity) => {
    requireValue(await metadata(path) === identity, "CLEANUP_DIRECTORY_IDENTITY_CHANGED");
    for (const leaf of ["seed", "reply"]) {
      try { await fs.unlink(`${path}/${leaf}`); }
      catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
    }
    await fs.rmdir(path);
  },
  docker: args => command(["/usr/bin/docker", "--host=unix:///var/run/docker.sock", ...args])
};

if (import.meta.main) {
  const commit = Bun.argv[2];
  requireValue(process.platform === "linux" && Bun.version === "1.4.0" && process.execPath === BUN && Bun.argv.length === 3 && /^[a-f0-9]{40}$/.test(commit ?? "") &&
    [process.getuid!(), process.geteuid!(), process.getgid!(), process.getegid!()].every(id => id === 1000), "EXPECTED_HOST_CONTEXT");
  const result = await probe(production, randomBytes(16).toString("hex"));
  console.log("Executor: " + JSON.stringify({ publicationCommit: commit, report: result }));
  process.exitCode = result.status === "PASS_DISPOSABLE_CONTAINER_ACCESS" ? 0 : 1;
}
