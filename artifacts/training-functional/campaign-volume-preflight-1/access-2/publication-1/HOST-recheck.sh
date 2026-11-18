env -i PATH=/usr/bin:/bin LC_ALL=C BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 /usr/bin/bash --noprofile --norc -c '
exec /usr/bin/timeout -k 2s 10s /home/gu1lty/Projects/proveo/chess-coach/_work/gpu-owner-recovery/cache/host-gpu-native-build-1/bun --no-env-file --no-install - "$1" <<"BUN_TS"
// SPEC: _spec/runtime-protocol.puml
import { constants as C } from "node:fs";
import * as fs from "node:fs/promises";

const volume = "/var/lib/chess-coach/training-volume-1";
const bun = "/home/gu1lty/Projects/proveo/chess-coach/_work/gpu-owner-recovery/cache/host-gpu-native-build-1/bun";
const roots = ["training-campaign-delivery-2", "training-campaign-inputs-2", "training-campaign-2"].map(name => `${volume}/${name}`);
type Meta = { directory: boolean; uid: number; gid: number; mode: number; dev: string; ino: string; mtimeNs: string; ctimeNs: string };
type Labels = { exitCode: number; signalCode?: string | null; stdout: Uint8Array; stderr: Uint8Array };
type IO = { stat(path: string): Promise<Meta>; realpath(path: string): Promise<string>; access(path: string): Promise<void>; labels(path: string): Labels };
const code = (error: unknown) => typeof (error as NodeJS.ErrnoException)?.code === "string" && /^[A-Z0-9_]{1,40}$/.test((error as NodeJS.ErrnoException).code!) ? (error as NodeJS.ErrnoException).code! : "METADATA_ERROR";

export async function recheck(io: IO, identity: { uid: number; euid: number; gid: number; egid: number }) {
  if (Object.values(identity).some(id => id !== 1000)) throw new Error("EXPECTED_HOST_USER_1000_1000");
  const metadata = await io.stat(volume);
  if (!metadata.directory || await io.realpath(volume) !== volume) throw new Error("EXPECTED_PHYSICAL_VOLUME");
  const ownerModeMatch = metadata.uid === 1000 && metadata.gid === 1000 && metadata.mode === 0o700;
  let callerAccessError: string | null = null;
  try { await io.access(volume); } catch (error) { callerAccessError = code(error); }
  const freshRoots = [];
  for (const path of roots) {
    if (!ownerModeMatch || callerAccessError !== null) { freshRoots.push({ path, observation: "UNKNOWN", error: "PARENT_NOT_VERIFIED" }); continue; }
    try { await io.stat(path); freshRoots.push({ path, observation: "EXISTS", error: null }); }
    catch (error) { const errno = code(error); freshRoots.push({ path, observation: errno === "ENOENT" ? "ABSENT" : "UNKNOWN", error: errno }); }
  }
  let labels: { exitCode: number; signal: string | null; stdout: string; stderr: string } | { error: string };
  try {
    const p = io.labels(volume);
    if (!Number.isInteger(p.exitCode) || p.stdout.byteLength > 1024 || p.stderr.byteLength > 1024) throw Object.assign(new Error("LABEL_BOUND"), { code: "LABEL_BOUND" });
    const decode = (bytes: Uint8Array) => new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    labels = { exitCode: p.exitCode, signal: p.signalCode ?? null, stdout: decode(p.stdout), stderr: decode(p.stderr) };
  } catch (error) { labels = { error: code(error) }; }
  let parentStable = false;
  if (ownerModeMatch && callerAccessError === null) {
    try {
      const after = await io.stat(volume);
      parentStable = after.directory && after.uid === metadata.uid && after.gid === metadata.gid && after.mode === metadata.mode &&
        after.dev === metadata.dev && after.ino === metadata.ino && after.mtimeNs === metadata.mtimeNs && after.ctimeNs === metadata.ctimeNs &&
        await io.realpath(volume) === volume;
    } catch { parentStable = false; }
    if (!parentStable) for (const row of freshRoots) { row.observation = "UNKNOWN"; row.error = "PARENT_CHANGED_OR_UNVERIFIED"; }
  }
  const labelObserved = parentStable && "exitCode" in labels && labels.exitCode === 0 && labels.signal === null && /^[^:\s?]+:[^:\s?]+:[^:\s?]+:[^\s?]+[ \t]/.test(labels.stdout);
  const posixAndRootsPass = parentStable && freshRoots.every(row => row.observation === "ABSENT");
  return { version: "chess-coach.campaign-volume-recheck.v1", identity, volume, metadata, ownerModeMatch, callerAccessError, parentStable, freshRoots, labels, labelObserved,
    posixAndRootsPass, selinuxCompatibilityVerified: false, containerAccessVerified: false, preparationExecuted: false, trainingExecuted: false };
}

if (import.meta.main) {
  if (Bun.version !== "1.4.0" || process.platform !== "linux" || process.execPath !== bun) throw new Error("HOST_CONTEXT");
  const publicationCommit = Bun.argv[2];
  if (Bun.argv.length !== 3 || !/^[a-f0-9]{40}$/.test(publicationCommit ?? "")) throw new Error("EXPECTED_PUBLICATION_COMMIT");
  const result = await recheck({
    stat: async path => { const s = await fs.lstat(path, { bigint: true }); return { directory: s.isDirectory(), uid: Number(s.uid), gid: Number(s.gid), mode: Number(s.mode & 0o7777n), dev: String(s.dev), ino: String(s.ino), mtimeNs: String(s.mtimeNs), ctimeNs: String(s.ctimeNs) }; },
    realpath: fs.realpath,
    access: path => fs.access(path, C.R_OK | C.W_OK | C.X_OK),
    labels: path => Bun.spawnSync(["/usr/bin/ls", "-Zd", "--", path], { stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 1000,
      maxBuffer: 1024, env: { PATH: "/usr/bin:/bin", LC_ALL: "C" } })
  }, { uid: process.getuid!(), euid: process.geteuid!(), gid: process.getgid!(), egid: process.getegid!() });
  console.log("Executor: " + JSON.stringify({ publicationCommit, report: result }));
  process.exitCode = result.posixAndRootsPass && result.labelObserved ? 0 : 1;
}
BUN_TS
' _ bbc4d1376c08e2c24d7a44250898397daebe3598
