// SPEC: _spec/runtime-protocol.puml
import { expect, test } from "bun:test";
import { recheck } from "./recheck";

const identity = { uid: 1000, euid: 1000, gid: 1000, egid: 1000 };
const volume = "/var/lib/chess-coach/training-volume-1";
const meta = { directory: true, uid: 1000, gid: 1000, mode: 0o700, dev: "1", ino: "2", mtimeNs: "3", ctimeNs: "4" };
const errno = (code: string) => Object.assign(new Error(code), { code });
const labelOutput = `system_u:object_r:var_lib_t:s0 ${volume}\n`;
const labels = (signalCode?: string | null) => ({ exitCode: 0, signalCode, stdout: Buffer.from(labelOutput), stderr: Buffer.alloc(0) });
function fixture() {
  const paths: string[] = [];
  const io: Parameters<typeof recheck>[0] = { stat: async path => { paths.push(path); if (path === volume) return meta; throw errno("ENOENT"); },
    realpath: async path => path, access: async () => {}, labels: () => labels() };
  return { io, paths };
}
test("only fixed roots are checked and natural Bun label output is retained for undefined or null signal", async () => {
  for (const signal of [undefined, null]) {
    const { io, paths } = fixture(); io.labels = path => { expect(path).toBe(volume); return labels(signal); };
    const report = await recheck(io, identity);
    expect(paths).toEqual([volume, ...["training-campaign-delivery-2", "training-campaign-inputs-2", "training-campaign-2"].map(n => `${volume}/${n}`), volume]);
    expect(report.freshRoots.map(row => row.observation)).toEqual(["ABSENT", "ABSENT", "ABSENT"]);
    expect(report.labels).toEqual({ exitCode: 0, signal: null, stdout: labelOutput, stderr: "" });
    expect(report).toMatchObject({ posixAndRootsPass: true, parentStable: true, labelObserved: true, selinuxCompatibilityVerified: false, containerAccessVerified: false,
      preparationExecuted: false, trainingExecuted: false });
  }
});
test("observes lookup denial and occupied paths without interpreting them as absent", async () => {
  const { io } = fixture(); io.stat = async path => { if (path.endsWith("delivery-2")) throw errno("EACCES"); return meta; };
  const report = await recheck(io, identity);
  expect(report.freshRoots.map(row => row.observation)).toEqual(["UNKNOWN", "EXISTS", "EXISTS"]);
  expect(report.posixAndRootsPass).toBe(false);
});
test("skips child lookup without confirmed owner/mode and caller access", async () => {
  for (const block of ["metadata", "access"]) {
    const { io, paths } = fixture();
    if (block === "metadata") io.stat = async path => { paths.push(path); return { ...meta, mode: 0o644 }; };
    else io.access = async () => { throw errno("EACCES"); };
    const report = await recheck(io, identity);
    expect(paths).toEqual([volume]); expect(report.posixAndRootsPass).toBe(false);
    expect(report.freshRoots.map(row => row.error)).toEqual(Array(3).fill("PARENT_NOT_VERIFIED"));
  }
});
test("rejects a different caller or noncanonical volume before child lookups or label query", async () => {
  const { io, paths } = fixture(); let labelCalls = 0;
  io.labels = () => { labelCalls++; return labels(); };
  await expect(recheck(io, { ...identity, euid: 0 })).rejects.toThrow("EXPECTED_HOST_USER_1000_1000");
  expect(paths).toEqual([]);
  io.realpath = async () => "/wrong";
  await expect(recheck(io, identity)).rejects.toThrow("EXPECTED_PHYSICAL_VOLUME");
  expect(paths).toEqual([volume]);
  expect(labelCalls).toBe(0);
});
test("retains label diagnostics, preserves metadata-only meaning, and rejects oversized output", async () => {
  const { io } = fixture(); io.labels = () => ({ ...labels("SIGTERM"), exitCode: 143, stderr: Buffer.from("label diagnostic\n") });
  const report = await recheck(io, identity);
  expect(report.labels).toMatchObject({ exitCode: 143, signal: "SIGTERM", stderr: "label diagnostic\n" });
  expect(report.posixAndRootsPass).toBe(true); expect(report.labelObserved).toBe(false); expect(report.selinuxCompatibilityVerified).toBe(false);
  io.labels = () => ({ ...labels(), stdout: Buffer.from(`? ${volume}\n`) });
  expect((await recheck(io, identity)).labelObserved).toBe(false);
  io.labels = () => ({ ...labels(), stdout: Buffer.alloc(1025) });
  expect((await recheck(io, identity)).labels).toEqual({ error: "LABEL_BOUND" });
});
test("discards absence and label claims on volume inode or timestamp drift", async () => {
  for (const key of ["ino", "mtimeNs", "ctimeNs"]) {
    const { io } = fixture(); let changed = false;
    io.stat = async path => { if (path !== volume) throw errno("ENOENT"); return changed ? { ...meta, [key]: "5" } : meta; };
    io.labels = () => { changed = true; return labels(); };
    const report = await recheck(io, identity);
    expect(report.posixAndRootsPass).toBe(false);
    expect(report.labelObserved).toBe(false);
    expect(report.freshRoots.map(row => row.error)).toEqual(Array(3).fill("PARENT_CHANGED_OR_UNVERIFIED"));
  }
});
