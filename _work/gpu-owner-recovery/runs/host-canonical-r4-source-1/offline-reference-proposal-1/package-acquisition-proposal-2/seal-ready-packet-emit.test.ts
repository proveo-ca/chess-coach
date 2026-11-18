// SPEC: _spec/runtime-protocol.puml
import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { ROOT, R, equal, readRegular, validateEligibility } from "../package-acquisition-bun-source2/capture.ts";
import type { EligibilityReader } from "../package-acquisition-bun-source2/capture.ts";
import { validateInvocationReady } from "./invoke-approved-bun.ts";
import { createDeliveryRuntime } from "./delivery-bootstrap.ts";
import { CURRENT_REVIEWS, FILE_CAP, PACKET_PATH, byteIdentity, prepareCandidate, repositoryReader } from "./seal-ready-packet.ts";
import { LOCAL_FILE_IO, MANIFEST_PATH, RESULT_PATH, RESULT_STATUS, SOURCE_OUTPUT_PATHS, emitProtectedFixture } from "./seal-ready-packet-emit.ts";
import type { SealFileIO } from "./seal-ready-packet-emit.ts";
import { preservationState, protectedState } from "./seal-ready-packet-verify.ts";

const api = await createDeliveryRuntime();
const before = protectedState(), historicalBefore = preservationState();
const candidate = await prepareCandidate(repositoryReader, CURRENT_REVIEWS);
const evidence = process.env["SEAL_EVIDENCE_ROOT"];
if (!evidence || !/^seal-verification-[1-9][0-9]*$/.test(relative(join(ROOT, R), resolve(evidence)))) throw new Error("emitter-protected-evidence-root-required");
const evidenceRoot: string = evidence;
function setup(label: string): string {
  const fixtures = join(evidenceRoot, "fixtures");
  if (!fs.existsSync(fixtures)) api.freshDirectory(fixtures); else api.ancestors(fixtures);
  const base = join(fixtures, `emit-${label}`); api.freshDirectory(base);
  const root = join(base, "source"); api.freshDirectory(root);
  const directories = new Set<string>();
  for (const path of SOURCE_OUTPUT_PATHS) for (let parent = dirname(path); parent !== "."; parent = dirname(parent)) directories.add(parent);
  expect(directories.size).toBeLessThanOrEqual(256);
  for (const path of [...directories].sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b))) api.freshDirectory(join(root, path));
  return root;
}
type Fault = { kind: "open" | "write" | "sync" | "close" | "zero"; nth: number };
function probe(root: string, fault?: Fault) {
  const counts = { open: 0, write: 0, sync: 0, close: 0 }, created: string[] = [], closed: number[] = [], live = new Set<number>();
  const targets = SOURCE_OUTPUT_PATHS.map(path => join(root, path)), parents = new Set(targets.map(dirname));
  const fail = (kind: keyof typeof counts) => { counts[kind]++; if (fault?.kind === kind && counts[kind] === fault.nth) throw new Error(`injected-${kind}-${fault.nth}`); };
  const io: SealFileIO = {
    open(path, flags, mode) {
      expect(targets.includes(path) || parents.has(path)).toBe(true);
      fail("open"); const fd = LOCAL_FILE_IO.open(path, flags, mode); live.add(fd);
      if (flags & fs.constants.O_CREAT) { expect(flags & fs.constants.O_EXCL).not.toBe(0); expect(mode).toBe(0o600); created.push(path); }
      return fd;
    },
    write(fd, bytes, offset, length) { fail("write"); if (fault?.kind === "zero" && counts.write === fault.nth) return 0; return LOCAL_FILE_IO.write(fd, bytes, offset, length); },
    sync(fd) { fail("sync"); LOCAL_FILE_IO.sync(fd); },
    close(fd) { LOCAL_FILE_IO.close(fd); live.delete(fd); closed.push(fd); fail("close"); },
    lstat: LOCAL_FILE_IO.lstat, read: LOCAL_FILE_IO.read,
  };
  return { io, counts, created, closed, live };
}
const emit = (root: string, io: SealFileIO = LOCAL_FILE_IO, reader: EligibilityReader = repositoryReader) => emitProtectedFixture({ scope: "OFFLINE_PROTECTED_FIXTURE", root, reader, io });
function checkProvisionalOrAbsent(root: string): void {
  if (fs.existsSync(join(root, RESULT_PATH))) {
    const result = JSON.parse(readRegular(join(root, RESULT_PATH), 262144).toString()) as Record<string, unknown>;
    expect(result["status"]).toBe(RESULT_STATUS); expect(result["resultWriteDurabilityClaimed"]).toBe(false); expect(result["externalExit0AndPostcheckRequired"]).toBe(true);
  }
}

describe("bounded source writer protected fixtures", () => {
  test("writes all five 0600 records and materializes all actual 48 members as 0400", async () => {
    const root = setup("positive"), p = probe(root), result = await emit(root, p.io);
    expect(result.status).toBe(RESULT_STATUS); expect(result.externalExit0AndPostcheckRequired).toBe(true);
    expect(p.created).toEqual(SOURCE_OUTPUT_PATHS.map(path => join(root, path)));
    expect(p.counts.open).toBe(10); expect(p.counts.sync).toBe(10); expect(p.counts.close).toBe(10); expect(p.live.size).toBe(0);
    for (const row of result.outputs) {
      const path = join(root, row.path), s = fs.lstatSync(path);
      expect(s.mode & 0o777).toBe(0o600); expect(s.nlink).toBe(1);
      expect({ path: row.path, ...byteIdentity(readRegular(path, row.path === PACKET_PATH ? 8388608 : 262144)) }).toEqual(row);
    }
    const manifest = JSON.parse(readRegular(join(root, MANIFEST_PATH), 262144).toString()) as Record<string, unknown>;
    expect(manifest["memberCount"]).toBe(48); expect(manifest["table"]).toEqual(candidate.packet.table); expect(manifest["inputs"]).toEqual(candidate.inputs);
    expect((manifest["authority"] as unknown[]).length).toBe(7); checkProvisionalOrAbsent(root);
    const verified = api.validatePacket(readRegular(join(root, PACKET_PATH), 8388608), result.packet, result.table);
    expect([...verified.files.keys()]).toEqual([...candidate.paths]); expect(verified.files.size).toBe(48);
    const snapshot = join(dirname(root), "snapshot"), dirs = new Set<string>();
    for (const path of verified.files.keys()) for (let parent = dirname(path); parent !== "."; parent = dirname(parent)) dirs.add(parent);
    expect(dirs.size).toBeLessThanOrEqual(256); api.freshDirectory(snapshot);
    for (const dir of [...dirs].sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b))) api.freshDirectory(join(snapshot, dir));
    for (const [path, bytes] of verified.files) api.writeExclusive(join(snapshot, path), bytes, 0o400);
    const reader: EligibilityReader = (path, cap) => {
      expect(verified.files.has(path)).toBe(true); const s = fs.lstatSync(join(snapshot, path));
      expect(s.mode & 0o777).toBe(0o400); expect(s.isSymbolicLink()).toBe(false); return readRegular(join(snapshot, path), Math.min(cap, FILE_CAP));
    };
    const identity = validateEligibility(reader); expect(identity).toEqual(candidate.identity); expect(validateInvocationReady(identity, reader)).toEqual(candidate.readiness);
    for (const row of result.table) expect({ path: row.path, ...byteIdentity(reader(row.path, FILE_CAP)) }).toEqual(row);
    for (const path of CURRENT_REVIEWS) expect(reader(path, FILE_CAP).equals(repositoryReader(path, FILE_CAP))).toBe(true);
    for (const path of [PACKET_PATH, MANIFEST_PATH, RESULT_PATH]) expect(fs.existsSync(join(snapshot, path))).toBe(false);
    const again = probe(root); await expect(emit(root, again.io)).rejects.toThrow("seal-output-collision"); expect(again.created).toEqual([]); expect(again.counts.write).toBe(0);
    for (const row of result.outputs) expect({ path: row.path, ...byteIdentity(readRegular(join(root, row.path), 8388608)) }).toEqual(row);
  });
  for (const kind of ["open", "sync", "close"] as const) for (let nth = 1; nth <= 10; nth++) {
    test(`preserves partials and rejects ${kind} failure ${nth}`, async () => {
      const root = setup(`${kind}-${nth}`), p = probe(root, { kind, nth });
      await expect(emit(root, p.io)).rejects.toThrow(`injected-${kind}-${nth}`);
      expect(p.live.size).toBe(0);
      for (const path of p.created) expect(fs.lstatSync(path).isFile()).toBe(true);
      checkProvisionalOrAbsent(root);
      if (p.created.length) { const retry = probe(root); await expect(emit(root, retry.io)).rejects.toThrow("seal-output-collision"); expect(retry.created).toEqual([]); }
    });
  }
  for (let nth = 1; nth <= 5; nth++) {
    test(`preserves write failure ${nth} without a successful result`, async () => {
      const root = setup(`write-${nth}`), p = probe(root, { kind: "write", nth });
      await expect(emit(root, p.io)).rejects.toThrow(`injected-write-${nth}`); expect(p.live.size).toBe(0);
      expect(p.created.length).toBe(nth); expect(p.counts.close).toBe(nth * 2);
      expect(fs.existsSync(join(root, RESULT_PATH))).toBe(nth === 5);
      if (nth === 5) expect(fs.statSync(join(root, RESULT_PATH)).size).toBe(0);
    });
  }
  test("positive short writes complete every byte", async () => {
    const root = setup("short-positive"), p = probe(root); const write = p.io.write;
    p.io.write = (fd, bytes, offset, length) => write(fd, bytes, offset, Math.min(length, 65536));
    const result = await emit(root, p.io); expect(p.counts.write).toBeGreaterThan(5); expect(p.live.size).toBe(0);
    expect(byteIdentity(readRegular(join(root, PACKET_PATH), 8388608))).toEqual(candidate.packet.pin); expect(result.outputs.length).toBe(5);
  });
  test("zero-progress short write rejects and closes both descriptors", async () => {
    const root = setup("zero-progress"), p = probe(root, { kind: "zero", nth: 1 });
    await expect(emit(root, p.io)).rejects.toThrow("seal-output-short-write"); expect(p.live.size).toBe(0); expect(p.counts.close).toBe(2);
    expect(fs.statSync(join(root, SOURCE_OUTPUT_PATHS[0]!)).size).toBe(0); expect(fs.existsSync(join(root, RESULT_PATH))).toBe(false);
  });
  test("first failure stays sticky while file and directory close attempts continue", async () => {
    const root = setup("sticky"), p = probe(root); const close = p.io.close;
    p.io.write = () => { throw new Error("first-write-failure"); };
    p.io.close = fd => { close(fd); throw new Error("later-close-failure"); };
    p.io.sync = () => { throw new Error("later-directory-sync-failure"); };
    await expect(emit(root, p.io)).rejects.toThrow("first-write-failure"); expect(p.counts.close).toBe(2); expect(p.live.size).toBe(0); expect(fs.existsSync(join(root, RESULT_PATH))).toBe(false);
  });
  for (const path of SOURCE_OUTPUT_PATHS) {
    test(`preflights collision before any output write: ${path.split("/").at(-1)}`, async () => {
      const root = setup(`collision-${SOURCE_OUTPUT_PATHS.indexOf(path)}`), marker = Buffer.from("existing-do-not-adopt\n"); api.writeExclusive(join(root, path), marker, 0o600);
      const p = probe(root); await expect(emit(root, p.io)).rejects.toThrow("seal-output-collision"); expect(p.created).toEqual([]); expect(readRegular(join(root, path), 64).equals(marker)).toBe(true);
    });
  }
  test("readback mismatch stops before result and preserves four records", async () => {
    const root = setup("readback"), p = probe(root); p.io.read = (path, cap) => path === join(root, PACKET_PATH) ? Buffer.from("{}") : LOCAL_FILE_IO.read(path, cap);
    await expect(emit(root, p.io)).rejects.toThrow("seal-output-readback-mismatch"); expect(p.created.length).toBe(4); expect(fs.existsSync(join(root, RESULT_PATH))).toBe(false);
  });
  for (const afterCreates of [4, 5]) {
    test(`uncached source drift after output ${afterCreates} fails without repair`, async () => {
      const root = setup(`drift-${afterCreates}`), p = probe(root), changed = candidate.inputs[0]!.path;
      const reader: EligibilityReader = (path, cap) => path === changed && p.created.length >= afterCreates ? Buffer.from("{}") : repositoryReader(path, cap);
      await expect(emit(root, p.io, reader)).rejects.toThrow("seal-uncached-input-drift"); expect(p.created.length).toBe(afterCreates); expect(p.live.size).toBe(0); checkProvisionalOrAbsent(root);
    });
  }
  test("missing current role prevents all target writes", async () => {
    const root = setup("missing-role"), p = probe(root);
    const reader: EligibilityReader = (path, cap) => { if (path === CURRENT_REVIEWS[11]) { const error = new Error("missing-role") as NodeJS.ErrnoException; error.code = "ENOENT"; throw error; } return repositoryReader(path, cap); };
    await expect(emit(root, p.io, reader)).rejects.toThrow("seal-current-reviews-missing"); expect(p.created).toEqual([]);
  });
  test("malformed cloned review cannot redirect targets", async () => {
    const root = setup("malformed-clone"), p = probe(root), path = CURRENT_REVIEWS[8]!;
    const clone = JSON.parse(repositoryReader(path, FILE_CAP).toString()) as Record<string, unknown>; clone["reviewedSource"] = { path: "../../outside.json", sha256: "0".repeat(64) };
    const reader: EligibilityReader = (name, cap) => name === path ? Buffer.from(JSON.stringify(clone)) : repositoryReader(name, cap);
    await expect(emit(root, p.io, reader)).rejects.toThrow("seal-relative-path"); expect(p.created).toEqual([]);
  });
  test("prohibited phase roots reject before reader or writes", async () => {
    for (const root of [ROOT, join(ROOT, R), join(ROOT, "_work/gpu-owner-recovery/runs/reference-package-handoff-2/snapshot"), join(evidenceRoot, "fixtures/wrong/snapshot"), `${evidenceRoot}/fixtures/wrong/source/../source`]) {
      let reads = 0;
      await expect(emitProtectedFixture({ scope: "OFFLINE_PROTECTED_FIXTURE", root, reader: () => { reads++; return Buffer.from("{}"); } })).rejects.toThrow("seal-protected-source-fixture-only"); expect(reads).toBe(0);
    }
  });
  test("symlink output parent rejects without following into another root", async () => {
    const root = setup("symlink-parent"), p = probe(root), base = join(dirname(dirname(root)), "emit-link-match"); api.freshDirectory(base);
    const alias = join(base, "source"); fs.symlinkSync(root, alias);
    await expect(emitProtectedFixture({ scope: "OFFLINE_PROTECTED_FIXTURE", root: alias, reader: repositoryReader, io: p.io })).rejects.toThrow("seal-existing-nonlink-output-parent"); expect(p.created).toEqual([]); expect(p.counts.open).toBe(0);
  });
  test("dangling target symlink counts as a collision before all writes", async () => {
    const root = setup("symlink-target"), p = probe(root); fs.symlinkSync(join(dirname(root), "never-created.json"), join(root, RESULT_PATH));
    await expect(emit(root, p.io)).rejects.toThrow("seal-output-collision"); expect(p.created).toEqual([]); expect(p.counts.open).toBe(0);
  });
  test("real issued records, source metadata, historical files, and five output absences stay unchanged", () => {
    expect(protectedState()).toEqual(before); expect(preservationState()).toEqual(historicalBefore);
    for (const path of SOURCE_OUTPUT_PATHS) expect(fs.existsSync(join(ROOT, path))).toBe(false);
    expect(equal(candidate.paths.filter(path => /seal-ready-packet/.test(path)), [])).toBe(true);
  });
});
