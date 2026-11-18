// SPEC: _spec/runtime-protocol.puml, _spec/training-container-access.puml
import { constants as C, writeSync } from "node:fs";
import * as fs from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { randomBytes } from "node:crypto";

export const VOLUME = "/var/lib/chess-coach/training-volume-1";
export const IMAGE = "docker.io/library/rust@sha256:4c2fd73ef19c5ef9d54bee03b06b2839a392604fbfcd578ed948b71b37c1d7fb";
export const HOST_BUN = "/home/gu1lty/Projects/proveo/chess-coach/_work/gpu-owner-recovery/cache/host-gpu-native-build-1/bun";
const PLATFORM = "--platform=linux/amd64";
const LABEL = "unconfined_u:object_r:var_lib_t:s0";
const VOLUME_ID = "38:45679082";
const PREFIX = ".packet2-access-probe-";
const TOKEN = /^[0-9a-f]{32}$/;
const CID = /^[0-9a-f]{64}$/;
const IDENTITY = /^[0-9]{1,20}:[0-9]{1,20}$/;
const CONFINED = /^[^:\s]+:[^:\s]+:container_t:[^\s]+$/;
export const CREATED_FORMAT = '{{json .State.Status}} {{json .ProcessLabel}} {{json .Config.User}} {{json .HostConfig.Runtime}} {{json .HostConfig.NetworkMode}} {{json .HostConfig.LogConfig.Type}} {{json .HostConfig.ReadonlyRootfs}} {{json .HostConfig.Privileged}} {{json .Mounts}}';
const PAYLOAD = 'ctx=$(tr -d "\\000" < /proc/self/attr/current) || exit 21; case "$ctx" in *:container_t:*) ;; *) exit 21 ;; esac; printf "%s\\n" "$ctx"; cd /probe || exit 26; [ "$(stat -c %d:%i -- .)" = "$2" ] || exit 26; seed=$(cat ./seed) || exit 22; [ "$seed" = "$1" ] || exit 22; umask 077; (set -C; printf "%s" "$1" > ./reply) || exit 23; reply=$(cat ./reply) || exit 24; [ "$reply" = "$1" ] || exit 24';
type Result = { exit: number | null; signal: string | null; out: string; err: string };
type IO = { metadata(path: string): Promise<string>; label(path: string): string; enforcing(): Promise<boolean>;
  createDirectory(path: string): Promise<void>; pinDirectory(path: string): Promise<string>; writeSeed(path: string, token: string): Promise<void>;
  verifyReply(path: string, token: string): Promise<void>; removeDirectory(path: string, identity: string, replyMayExist: boolean): Promise<void>;
  docker(args: string[]): Result };
const requireValue = (value: unknown, reason: string) => { if (!value) throw new Error(reason); };
const ok = (r: Result) => r.exit === 0 && r.signal === null;
const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 512);

export function createArgs(token: string, identity: string) {
  requireValue(TOKEN.test(token), "PROBE_TOKEN");
  requireValue(IDENTITY.test(identity), "PROBE_DIRECTORY_IDENTITY");
  return ["create", "--name", `packet2-access-${token}`, "--label", `org.proveo.packet2-access=${token}`,
    "--pull=never", PLATFORM, "--runtime=runc", "--network=none", "--restart=no", "--workdir=/",
    "--user=1000:1000", "--read-only", "--no-healthcheck", "--log-driver=none", "--memory=64m", "--memory-swap=64m", "--cpus=1", "--pids-limit=16",
    "--mount", `type=bind,src=${VOLUME}/${PREFIX}${token},dst=/probe,bind-propagation=rprivate`, "--entrypoint=/bin/sh", IMAGE, "-eu", "-c", PAYLOAD, "probe", token, identity];
}

function createdContext(result: Result, path: string): string {
  requireValue(ok(result), "CONTAINER_CONFIGURATION_NOT_CONFIRMED");
  const [status, label, user, runtime, network, logging, readonly, privileged, ...mountsJson] = result.out.trim().split(" ");
  requireValue(status === '"created"' && /^"[^"]+"$/.test(label ?? "") && CONFINED.test(label!.slice(1, -1)) &&
    user === '"1000:1000"' && runtime === '"runc"' && network === '"none"' && logging === '"none"' &&
    readonly === "true" && privileged === "false", "CONTAINER_CONFIGURATION_NOT_CONFIRMED");
  const mounts = JSON.parse(mountsJson.join(" "));
  requireValue(Array.isArray(mounts) && mounts.length === 1 && mounts[0] && mounts[0].Type === "bind" && mounts[0].Source === path &&
    mounts[0].Destination === "/probe" && mounts[0].RW === true && mounts[0].Propagation === "rprivate", "CONTAINER_BIND_NOT_CONFIRMED");
  return label!.slice(1, -1);
}

export async function probe(io: IO, token: string) {
  requireValue(TOKEN.test(token), "PROBE_TOKEN");
  const path = `${VOLUME}/${PREFIX}${token}`, name = `packet2-access-${token}`;
  const checks: Record<string, Result> = {};
  const cleanupErrors: string[] = [];
  let identity: string | null = null, id: string | null = null, error: string | null = null, accessObserved = false;
  let directoryCreated = false, createRequested = false, startRequested = false, containerRemoved = false, directoryRemoved = false;
  try {
    requireValue(await io.metadata(VOLUME) === VOLUME_ID, "VOLUME_IDENTITY_CHANGED");
    requireValue(await io.enforcing(), "SELINUX_NOT_CONFIRMED_ENFORCING");
    requireValue(io.label(VOLUME) === LABEL, "VOLUME_LABEL_CHANGED_OR_UNKNOWN");
    const image = checks.image = io.docker(["image", "inspect", PLATFORM, "--format={{json .Config.Volumes}}", IMAGE]);
    requireValue(ok(image) && ["null", "{}"].includes(image.out.trim()), "RETAINED_IMAGE_OR_VOLUME_CONFIG_NOT_CONFIRMED");
    await io.createDirectory(path); directoryCreated = true;
    identity = await io.pinDirectory(path);
    requireValue(await io.metadata(VOLUME) === VOLUME_ID, "VOLUME_IDENTITY_CHANGED");
    requireValue(io.label(path) === LABEL, "DISPOSABLE_DIRECTORY_LABEL_DIFFERS");
    await io.writeSeed(`${path}/seed`, token);
    requireValue(io.label(`${path}/seed`) === LABEL, "SEED_LABEL_DIFFERS");
    requireValue(await io.metadata(path) === identity && await io.metadata(VOLUME) === VOLUME_ID, "VOLUME_OR_DISPOSABLE_DIRECTORY_CHANGED");
    const args = createArgs(token, identity);
    createRequested = true;
    const create = checks.create = io.docker(args);
    requireValue(ok(create) && CID.test(create.out.trim()), "CONTAINER_CREATE_NOT_CONFIRMED");
    id = create.out.trim();
    const configuredContext = createdContext(checks.created = io.docker(["inspect", "--type=container", `--format=${CREATED_FORMAT}`, id]), path);
    requireValue(await io.metadata(path) === identity && await io.metadata(VOLUME) === VOLUME_ID, "VOLUME_OR_DISPOSABLE_DIRECTORY_CHANGED_BEFORE_START");
    requireValue(await io.enforcing(), "SELINUX_NOT_CONFIRMED_ENFORCING_BEFORE_START");
    startRequested = true;
    const start = checks.start = io.docker(["start", "--attach", id]);
    const ctx = start.out.trim();
    requireValue(ok(start) && ctx === configuredContext, "CONTAINER_PROBE_FAILED_OR_CONTEXT_MISMATCH");
    const state = checks.state = io.docker(["inspect", "--type=container", "--format={{.State.Status}} {{.State.ExitCode}} {{.ProcessLabel}}", id]);
    requireValue(ok(state) && state.out.trim() === `exited 0 ${ctx}`, "CONTAINER_EXIT_OR_LABEL_NOT_CONFIRMED");
    requireValue(await io.metadata(path) === identity, "DISPOSABLE_DIRECTORY_CHANGED");
    await io.verifyReply(`${path}/reply`, token);
    requireValue(await io.enforcing(), "SELINUX_NOT_CONFIRMED_ENFORCING_AT_END");
    requireValue(io.label(path) === LABEL && io.label(VOLUME) === LABEL && await io.metadata(VOLUME) === VOLUME_ID &&
      await io.metadata(path) === identity, "VOLUME_OR_LABEL_CHANGED");
    accessObserved = true;
  } catch (e) { error = errorText(e); }
  finally {
    if (id !== null) {
      try {
        const r = checks.remove = io.docker(["rm", "-f", id]); containerRemoved = ok(r) && r.out.trim() === id;
        if (!containerRemoved) cleanupErrors.push("CONTAINER_REMOVAL_NOT_CONFIRMED");
      }
      catch (e) { cleanupErrors.push(errorText(e)); }
    }
    if (directoryCreated && identity !== null && (!createRequested || containerRemoved)) {
      try {
        requireValue(await io.metadata(VOLUME) === VOLUME_ID, "CLEANUP_VOLUME_IDENTITY_CHANGED");
        await io.removeDirectory(path, identity, startRequested); directoryRemoved = true;
      }
      catch (e) { cleanupErrors.push(errorText(e)); }
    } else if (directoryCreated) {
      cleanupErrors.push("DISPOSABLE_DIRECTORY_LEFT_IN_PLACE");
    }
  }
  const cleanupConfirmed = (!createRequested || containerRemoved) && (!directoryCreated || directoryRemoved);
  return { status: accessObserved && cleanupConfirmed ? "PASS_DISPOSABLE_CONTAINER_ACCESS" : "BLOCKED_DISPOSABLE_CONTAINER_ACCESS",
    image: IMAGE, uid: 1000, gid: 1000, runtime: "runc", expectedLabel: LABEL, path, name, id, checks, error, accessObserved,
    cleanupConfirmed, cleanupErrors, directoryCreated, directoryRemoved, createRequested, containerRemoved,
    campaignAccessVerified: false, relabelRequested: false, labelObservation: accessObserved ? "EXPECTED_AT_CHECKPOINTS" : "NOT_FULLY_CONFIRMED",
    enforcementObservation: accessObserved ? "ENFORCING_AT_HOST_CHECKPOINTS_NOT_CONTINUOUSLY_ATTESTED" : "NOT_FULLY_CONFIRMED",
    preparationExecuted: false, trainingExecuted: false };
}

function command(argv: string[], limit = "8s"): Result {
  const p = Bun.spawnSync(["/usr/bin/timeout", "--foreground", "-k", "2s", limit, ...argv], { stdin: "ignore", stdout: "pipe", stderr: "pipe", maxBuffer: 1024,
    env: { PATH: "/usr/bin:/bin", HOME: "/", LC_ALL: "C" } });
  return { exit: p.exitCode, signal: p.signalCode ?? null, out: p.stdout.toString().slice(0, 1024), err: p.stderr.toString().slice(0, 1024) };
}

async function metadata(path: string) {
  const s = await fs.lstat(path, { bigint: true });
  requireValue(s.isDirectory() && s.uid === 1000n && s.gid === 1000n && (s.mode & 0o7777n) === 0o700n && await fs.realpath(path) === path, "DIRECTORY_METADATA");
  return `${s.dev}:${s.ino}`;
}

const fdPath = (f: FileHandle) => `/proc/self/fd/${f.fd}`;
const dirFlags = C.O_RDONLY | C.O_DIRECTORY | C.O_NOFOLLOW | C.O_NONBLOCK;
const identityOf = async (f: FileHandle) => { const s = await f.stat({ bigint: true }); return `${s.dev}:${s.ino}`; };

export async function removeProbeFiles(directory: FileHandle, seedOwned: boolean, replyMayExist: boolean) {
  for (const name of [seedOwned ? "seed" : null, replyMayExist ? "reply" : null]) {
    if (name === null) continue;
    try { await fs.unlink(`${fdPath(directory)}/${name}`); }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
  }
}

function productionIO(token: string) {
  requireValue(TOKEN.test(token), "PROBE_TOKEN");
  const leaf = `${PREFIX}${token}`, path = `${VOLUME}/${leaf}`;
  let parent: FileHandle | undefined, child: FileHandle | undefined;
  let seedOwned = false;
  const boundChild = (name: "seed" | "reply") => {
    if (!child) throw new Error("NO_OWNED_DIRECTORY_DESCRIPTOR");
    return `${fdPath(child)}/${name}`;
  };
  const production: IO = {
  metadata,
  label: path => {
    const r = command(["/usr/bin/ls", "-Zd", "--", path], "2s");
    requireValue(ok(r) && r.out.trim() === `${LABEL} ${path}`, `LABEL_NOT_CONFIRMED:${path}:${r.exit}:${r.err.slice(0, 160)}`);
    return LABEL;
  },
  enforcing: async () => {
    const f = await fs.open("/sys/fs/selinux/enforce", C.O_RDONLY | C.O_NOFOLLOW | C.O_NONBLOCK);
    try { const buf = Buffer.alloc(4), { bytesRead } = await f.read(buf, 0, buf.length, null); return buf.subarray(0, bytesRead).toString().trim() === "1"; }
    finally { await f.close(); }
  },
  createDirectory: async target => {
    requireValue(target === path && !parent, "DISPOSABLE_PATH");
    parent = await fs.open(VOLUME, dirFlags);
    requireValue(await identityOf(parent) === VOLUME_ID, "VOLUME_DESCRIPTOR_MISMATCH");
    await fs.mkdir(`${fdPath(parent)}/${leaf}`, { mode: 0o700 });
  },
  pinDirectory: async target => {
    requireValue(target === path && parent && !child, "DISPOSABLE_PATH");
    child = await fs.open(`${fdPath(parent!)}/${leaf}`, dirFlags);
    const identity = await metadata(path);
    requireValue(await identityOf(child) === identity, "DISPOSABLE_DESCRIPTOR_MISMATCH");
    return identity;
  },
  writeSeed: async (target, nonce) => {
    requireValue(target === `${path}/seed` && token === nonce, "DISPOSABLE_PATH");
    const f = await fs.open(boundChild("seed"), C.O_WRONLY | C.O_CREAT | C.O_EXCL | C.O_NOFOLLOW, 0o600);
    seedOwned = true;
    try { await f.writeFile(nonce); } finally { await f.close(); }
  },
  verifyReply: async (target, nonce) => {
    requireValue(target === `${path}/reply` && token === nonce, "DISPOSABLE_PATH");
    const f = await fs.open(boundChild("reply"), C.O_RDONLY | C.O_NOFOLLOW | C.O_NONBLOCK);
    try {
      const s = await f.stat();
      requireValue(s.isFile() && s.uid === 1000 && s.gid === 1000 && (s.mode & 0o777) === 0o600 && s.size === 32, "PROBE_REPLY_METADATA");
      const buf = Buffer.alloc(33), { bytesRead } = await f.read(buf, 0, buf.length, 0);
      requireValue(bytesRead === 32 && buf.subarray(0, bytesRead).toString() === nonce, "PROBE_REPLY_MISMATCH");
    } finally { await f.close(); }
  },
  removeDirectory: async (target, identity, replyMayExist) => {
    requireValue(target === path && parent && child && await identityOf(parent) === VOLUME_ID &&
      await metadata(path) === identity, "CLEANUP_DIRECTORY_IDENTITY_CHANGED");
    requireValue(await identityOf(child!) === identity, "CLEANUP_DIRECTORY_DESCRIPTOR_MISMATCH");
    await removeProbeFiles(child!, seedOwned, replyMayExist);
    const anchoredPath = `${fdPath(parent!)}/${leaf}`;
    const current = await fs.lstat(anchoredPath, { bigint: true });
    requireValue(current.isDirectory() && `${current.dev}:${current.ino}` === identity, "CLEANUP_DIRECTORY_IDENTITY_CHANGED");
    await fs.rmdir(anchoredPath);
    try { await fs.lstat(path); }
    catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT" && await metadata(VOLUME) === VOLUME_ID) return;
      throw e;
    }
    throw new Error("DISPOSABLE_PATH_ABSENCE_NOT_CONFIRMED");
  },
  docker: args => command(["/usr/bin/docker", "--host=unix:///var/run/docker.sock", ...args])
  };
  return { production, close: async () => { await Promise.allSettled([child?.close(), parent?.close()]); } };
}

if (import.meta.main) {
  const commit = Bun.argv[2];
  requireValue(process.platform === "linux" && Bun.version === "1.4.0" && process.execPath === HOST_BUN && Bun.argv.length === 3 && /^[a-f0-9]{40}$/.test(commit ?? "") &&
    [process.getuid!(), process.geteuid!(), process.getgid!(), process.getegid!()].every(id => id === 1000), "EXPECTED_HOST_CONTEXT");
  process.umask(0o077);
  const token = randomBytes(16).toString("hex"), { production, close } = productionIO(token);
  const intent = Buffer.from("Executor: " + JSON.stringify({ publicationCommit: commit, intent: { name: `packet2-access-${token}`, path: `${VOLUME}/${PREFIX}${token}` } }) + "\n");
  requireValue(writeSync(1, intent) === intent.byteLength, "INTENT_NOT_WRITTEN");
  const result = await probe(production, token).finally(close);
  console.log("Executor: " + JSON.stringify({ publicationCommit: commit, report: result }));
  process.exitCode = result.status === "PASS_DISPOSABLE_CONTAINER_ACCESS" ? 0 : 1;
}
