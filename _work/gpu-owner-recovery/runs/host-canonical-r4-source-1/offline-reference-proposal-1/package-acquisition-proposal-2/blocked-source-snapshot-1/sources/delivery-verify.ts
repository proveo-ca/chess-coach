// SPEC: _spec/runtime-protocol.puml
import * as fs from "node:fs";
import { join, resolve } from "node:path";
import { createDeliveryRuntime } from "./delivery-bootstrap.ts";
import type { DeliveryRuntime } from "./delivery-bootstrap.ts";
import { renderDelivery } from "./delivery-render.ts";

const api: DeliveryRuntime = await createDeliveryRuntime();
const C = api.constants;
const SOURCE_NAMES = ["delivery-bootstrap.ts", "delivery-packet.ts", "delivery-render.ts", "delivery.test.ts", "delivery-verify.ts", "delivery.tsconfig.json", "delivery-contract1.json"];
const FISH = "/home/agent/toolchains/linux-amd64/.local/share/mise/installs/github-fish-shell-fish-shell/4.9.3/fish";
const S2 = `${C.D}/package-acquisition-bun-source2`;
const productionAbsent = [C.HREL, `${C.HREL}/snapshot`, `${C.HREL}/evidence`, "_work/gpu-owner-recovery/cache", "_work/gpu-owner-recovery/cache/reference-package-inputs-2", `${C.D}/package-inputs-2`, `${C.D}/package-inputs-2/files`, `${C.R2}/acquisition-execution-1`, `${C.R2}/acquisition-invocation-1`];
function object(value: unknown): Record<string, unknown> { api.need(value !== null && typeof value === "object" && !Array.isArray(value), "record-required"); return value as Record<string, unknown>; }
function read(relative: string): Buffer {
  api.need(!relative.split("/").some(part => ["cache", "fixtures", "compiler-output", "node_modules", "__pycache__"].includes(part)), "verification-record-source-only");
  api.need(!relative.startsWith("/") && !relative.split("/").includes(".."), "relative-record-required");
  const name = join(C.HOSTROOT, relative); api.ancestors(join(name, ".."));
  const fd = fs.openSync(name, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const stat = fs.fstatSync(fd, { bigint: true }); api.need(stat.isFile() && stat.size <= 4194304n, "bounded-regular-record-required");
    const bytes = Buffer.alloc(Number(stat.size) + 1); let count = 0;
    while (count < bytes.length) { const got = fs.readSync(fd, bytes, count, bytes.length - count, null); if (!got) break; count += got; }
    const after = fs.fstatSync(fd, { bigint: true });
    api.need(count === Number(stat.size) && stat.ino === after.ino && stat.size === after.size && stat.mtimeNs === after.mtimeNs && stat.ctimeNs === after.ctimeNs, "record-read-drift");
    return bytes.subarray(0, count);
  } finally { fs.closeSync(fd); }
}
function state(relative: string) {
  try {
    const s = fs.lstatSync(join(C.HOSTROOT, relative), { bigint: true });
    return { exists: true, directory: s.isDirectory(), regularFile: s.isFile(), symlink: s.isSymbolicLink(), dev: String(s.dev), ino: String(s.ino), mode: String(s.mode), nlink: String(s.nlink), uid: String(s.uid), gid: String(s.gid), size: String(s.size), mtimeNs: String(s.mtimeNs), ctimeNs: String(s.ctimeNs) };
  } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return { exists: false }; throw error; }
}
function preservedPreparation() {
  const hashes: Record<string, string> = {}, metadata: Record<string, unknown> = {}; let count = 0;
  function walk(relative: string): void {
    api.need(++count <= 512, "bounded-preparation-history");
    const current = state(relative); metadata[relative] = current;
    api.need(current.exists && !("symlink" in current && current.symlink), "preserved-preparation-source-required");
    if ("directory" in current && current.directory) {
      if (["fixtures", "compiler-output", "__pycache__"].includes(relative.split("/").at(-1) ?? "")) return;
      for (const name of fs.readdirSync(join(C.HOSTROOT, relative)).sort()) walk(`${relative}/${name}`);
    } else hashes[relative] = api.hash(read(relative));
  }
  for (const root of [...Array.from({ length: 5 }, (_, i) => `${S2}/freshverification-${i + 1}`), `${S2}/preparatory-source-snapshot-1`, `${C.R2}/review-1`]) walk(root);
  return { hashes, metadata };
}
function checks() {
  const paths = Object.fromEntries(productionAbsent.map(name => [name, state(name)]));
  for (const [name, value] of Object.entries(paths)) api.need(value.exists === false, `production-must-stay-absent:${name}`);
  const immutable = Object.fromEntries([...C.bindings.map(([, name, sha256]) => [name, sha256] as const), [`${C.R2}/approval2.json`, C.APPROVAL_SHA], [C.BOUNDARY_PATH, C.BOUNDARY_SHA]]);
  for (const [name, sha256] of Object.entries(immutable)) api.need(api.hash(read(name)) === sha256, `immutable-record-drift:${name}`);
  const historical = object(object(JSON.parse(read(`${S2}/freshverification-3/source-manifest.json`).toString()))["historical"]);
  const oldHashes = object(historical["hashes"]), oldMetadata = object(historical["metadata"]);
  const currentHashes = Object.fromEntries(Object.keys(oldHashes).map(name => [name, api.hash(read(name))]));
  const currentMetadata = Object.fromEntries(Object.keys(oldMetadata).map(name => [name, state(name)]));
  api.need(JSON.stringify(currentHashes) === JSON.stringify(oldHashes), "historical-hash-drift");
  api.need(JSON.stringify(currentMetadata) === JSON.stringify(oldMetadata), "historical-metadata-drift");
  const helperPins = {
    "_work/gpu-owner-recovery/verify.ts": "9831b75035a5d832c6d86608b7d561821ee1a4c6dec8d2a7ecd31fbca55d5f58",
    "_work/gpu-owner-recovery/command-supervisor.ts": "88e56077c3bcddf722f81081a0cb7c6f94d1da106add486dbf13a92d165fb9c6"
  };
  for (const [name, sha256] of Object.entries(helperPins)) api.need(api.hash(read(name)) === sha256, "unchanged-observer-helper-required");
  return { paths, immutable, immutableMetadata: Object.fromEntries(Object.keys(immutable).map(name => [name, state(name)])), historical: { hashes: currentHashes, metadata: currentMetadata }, preservedPreparation: preservedPreparation(), helperPins };
}
function write(evidence: string, name: string, value: unknown): void {
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + "\n"); api.need(bytes.length <= 4194304, "bounded-verification-record"); api.writeExclusive(join(evidence, name), bytes);
}
export async function verifyDelivery(): Promise<void> {
  api.need(process.cwd() === C.HOSTROOT && process.versions["bun"] === "1.4.0", "same-current-bun-1.4.0-required");
  api.need(JSON.parse(fs.readFileSync(join(C.HOSTROOT, "node_modules/typescript/package.json"), "utf8")).version === "5.9.3", "typescript-5.9.3-required");
  let evidence = "";
  for (let i = 1; i <= 999; i++) {
    const candidate = join(C.HOSTROOT, C.R2, `delivery-verification-${i}`);
    try { api.freshDirectory(candidate); evidence = candidate; break; } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
  }
  api.need(evidence !== "", "fresh-verification-labels-exhausted");
  const before = checks(); write(evidence, "readchecks-before.json", before);
  const sources = Object.fromEntries(SOURCE_NAMES.map(name => [`${C.R2}/${name}`, api.identity(read(`${C.R2}/${name}`))]));
  write(evidence, "source-manifest.json", { scope: "OFFLINE_DELIVERY_SOURCE_ONLY", sources, finalPacketCreated: false, finalClosureFrozen: false });
  const synthetic = Buffer.from("OFFLINE_SYNTHETIC_NONRUNNING\n"), identity = api.identity(synthetic);
  const rendered = await renderDelivery({ ...identity, commitOid: "1".repeat(40), packetPath: C.PACKET_PATH, fileTable: [{ path: C.CALLER, ...identity }] }, "OFFLINE_SYNTHETIC_NONRUNNING");
  api.writeExclusive(join(evidence, "synthetic-nonrunning.fish"), Buffer.from(rendered.body));
  const commands = [
    { name: "tests", executable: process.execPath, args: ["--no-env-file", "--no-install", "test", `${C.R2}/delivery.test.ts`, "--timeout", "10000"], env: { LANG: "C", LC_ALL: "C", DELIVERY_EVIDENCE_ROOT: evidence } },
    { name: "typecheck", executable: process.execPath, args: ["--no-env-file", "--no-install", "node_modules/typescript/bin/tsc", "-p", `${C.R2}/delivery.tsconfig.json`], env: { LANG: "C", LC_ALL: "C" } },
    { name: "fish-syntax", executable: FISH, args: ["--no-config", "--no-execute", join(evidence, "synthetic-nonrunning.fish")], env: { LANG: "C", LC_ALL: "C" } }
  ];
  const results = [];
  for (const command of commands) {
    const origin = process.hrtime.bigint();
    const result = await api.runChild({ ...command, cwd: C.HOSTROOT, stdoutCap: 262144, stderrCap: 262144, remainingMs: () => 60000 - Number(process.hrtime.bigint() - origin) / 1e6, workMs: 58000, cleanupMs: 2000 });
    api.writeExclusive(join(evidence, `${command.name}.stdout`), result.stdout); api.writeExclusive(join(evidence, `${command.name}.stderr`), result.stderr);
    const { stdout, stderr, ...outcome } = result;
    results.push({ name: command.name, argv: [command.executable, ...command.args], ...outcome, stdout: api.identity(stdout), stderr: api.identity(stderr), text: stdout.toString() + stderr.toString() });
  }
  let after: unknown;
  try { after = checks(); } catch (error) { after = { error: error instanceof Error ? error.message : "readchecks-failed" }; }
  write(evidence, "readchecks-after.json", after);
  const unchanged = JSON.stringify(before) === JSON.stringify(after), sourceUnchanged = Object.entries(sources).every(([name, pin]) => api.hash(read(name)) === pin.sha256);
  const text = results[0]!.text, testsPassed = Number(text.match(/^\s*(\d+) pass\s*$/m)?.[1] ?? -1), testsFailed = Number(text.match(/^\s*(\d+) fail\s*$/m)?.[1] ?? -1);
  const passed = unchanged && sourceUnchanged && testsPassed > 0 && testsFailed === 0 && results.every(row => row.failure === null && row.exitCode === 0 && row.reaped && row.closed && row.outEOF && row.errEOF);
  const receipt = { version: "chess-coach.offline-delivery-verification.v1", status: passed ? "PASS_OFFLINE_DELIVERY_ONLY_PRODUCTION_BLOCKED" : "FAIL_OFFLINE_DELIVERY", evidence, sources, testsPassed, testsFailed, immutableAndHistoricalReadchecksMatch: unchanged, sourceUnchanged, historicalRecordsPreserved: Object.keys(before.historical.hashes).length, results: results.map(({ text: _text, ...value }) => value), runtime: { bun: process.versions["bun"], executable: process.execPath, typescript: "5.9.3", strictNoEmit: true, noInstall: true }, launchBoundary: { path: C.BOUNDARY_PATH, sha256: C.BOUNDARY_SHA, endToEndFishInvocationBoundClaimed: false }, productionBlockers: C.blockers, realNetworkRequests: 0, productionRootsCreated: false, productionRunEntered: false, productionEntryGateProbed: false, historicalGateProbe: { evidenceRuns: [1, 2, 3, 4, 5, 6], pureUnitGateOnly: true, blockedBeforeProductionRun: true, manualAttemptsConsumed: 0 }, syntheticFixtureScope: "OFFLINE_SYNTHETIC_PROTECTED_REPOSITORY_ROOTS_ONLY", fishExecuted: false, fishNoExecuteChecked: results[2]!.failure === null && results[2]!.exitCode === 0, finalPacketCreated: false, actualClosureFrozen: false, bindingsOrReadyRecordsCreated: false, publicationPerformed: false, runnableOperatorCommandDelivered: false, actualManualAttemptsConsumed: 0, actualInnerAttemptsConsumed: 0, executionReadinessClaimed: false };
  write(evidence, "receipt.json", receipt);
  process.stdout.write(`${receipt.status} ${evidence}/receipt.json\n`); process.exitCode = passed ? 0 : 1;
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  try { await verifyDelivery(); } catch (error) { process.stderr.write(`${error instanceof Error ? error.message : "delivery-verification-failed"}\n`); process.exitCode = 1; }
}
