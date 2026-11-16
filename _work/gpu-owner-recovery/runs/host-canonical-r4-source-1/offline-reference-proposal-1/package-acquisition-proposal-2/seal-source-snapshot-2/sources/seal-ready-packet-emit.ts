// SPEC: _spec/runtime-protocol.puml
import * as fs from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CAPS, ROOT, R, equal, readRegular, requireThat, validateEligibility } from "../package-acquisition-bun-source2/capture.ts";
import type { EligibilityReader } from "../package-acquisition-bun-source2/capture.ts";
import { validateInvocationReady } from "./invoke-approved-bun.ts";
import { createDeliveryRuntime } from "./delivery-bootstrap.ts";
import { BINDING_PATH, READY_PATH, PACKET_PATH, CURRENT_REVIEWS, FILE_CAP, byteIdentity, prepareCandidate, repositoryReader } from "./seal-ready-packet.ts";

export const MANIFEST_PATH = `${R}/sealed-packet-manifest1.json`;
export const RESULT_PATH = `${R}/sealed-packet-result1.json`;
export const SOURCE_OUTPUT_PATHS = Object.freeze([BINDING_PATH, READY_PATH, PACKET_PATH, MANIFEST_PATH, RESULT_PATH]);
export const RESULT_STATUS = "SEALED_SOURCE_PACKET_REQUIRES_MATCHING_EXTERNAL_EXIT0_AND_POSTCHECK";
const RECORD_CAP = 262144;
export interface SealFileIO {
  open(path: string, flags: number, mode?: number): number;
  write(fd: number, bytes: Buffer, offset: number, length: number): number;
  sync(fd: number): void;
  close(fd: number): void;
  lstat(path: string): fs.Stats;
  read(path: string, cap: number): Buffer;
}
export const LOCAL_FILE_IO: Readonly<SealFileIO> = Object.freeze({
  open: (path: string, flags: number, mode?: number) => fs.openSync(path, flags, mode),
  write: (fd: number, bytes: Buffer, offset: number, length: number) => fs.writeSync(fd, bytes, offset, length),
  sync: (fd: number) => fs.fsyncSync(fd), close: (fd: number) => fs.closeSync(fd),
  lstat: (path: string) => fs.lstatSync(path), read: (path: string, cap: number) => readRegular(path, cap),
});
function ancestors(directory: string, io: SealFileIO): void {
  const parents: string[] = [];
  for (let path = directory; ; path = dirname(path)) { requireThat(parents.length < 256, "seal-output-parent-cap"); parents.push(path); if (dirname(path) === path) break; }
  for (const path of parents.reverse()) { const s = io.lstat(path); requireThat(s.isDirectory() && !s.isSymbolicLink(), "seal-existing-nonlink-output-parent"); }
}
function absent(path: string, io: SealFileIO): void {
  try { io.lstat(path); throw new Error("seal-output-collision"); }
  catch (error) { if ((error as NodeJS.ErrnoException | null)?.code !== "ENOENT") throw error; }
}
function syncDirectory(path: string, io: SealFileIO): void {
  const fd = io.open(path, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
  let failed = false, failure: unknown;
  try { io.sync(fd); } catch (error) { failed = true; failure = error; }
  try { io.close(fd); } catch (error) { if (!failed) { failed = true; failure = error; } }
  if (failed) throw failure;
}
function exclusive(path: string, bytes: Buffer, cap: number, io: SealFileIO): void {
  requireThat(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= cap, "seal-output-byte-cap");
  ancestors(dirname(path), io);
  const fd = io.open(path, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK, 0o600);
  let failed = false, failure: unknown;
  try {
    let offset = 0;
    while (offset < bytes.length) { const n = io.write(fd, bytes, offset, bytes.length - offset); requireThat(Number.isSafeInteger(n) && n > 0 && n <= bytes.length - offset, "seal-output-short-write"); offset += n; }
    io.sync(fd);
  } catch (error) { failed = true; failure = error; }
  try { io.close(fd); } catch (error) { if (!failed) { failed = true; failure = error; } }
  try { syncDirectory(dirname(path), io); } catch (error) { if (!failed) { failed = true; failure = error; } }
  if (failed) throw failure;
}
function encodedRecord(value: unknown): Buffer {
  const bytes = Buffer.from(JSON.stringify(value) + "\n"); requireThat(bytes.length > 0 && bytes.length <= RECORD_CAP, "seal-source-record-cap"); return bytes;
}

async function emitSource(reader: EligibilityReader, root: string, io: SealFileIO) {
  const candidate = await prepareCandidate(reader, CURRENT_REVIEWS), api = await createDeliveryRuntime();
  const targets = SOURCE_OUTPUT_PATHS.map(path => join(root, path));
  const bindingPin = { path: BINDING_PATH, ...byteIdentity(candidate.binding) }, readyPin = { path: READY_PATH, ...byteIdentity(candidate.ready) };
  const packetPin = { path: PACKET_PATH, ...candidate.packet.pin };
  const authorityNames = ["approval2.json", "request.json", "plan.json", "manual-handoff-request1.json", "manual-handoff-plan1.json", "manual-launch-boundary-selection1.json", "manual-source-transport-amendment1.json"].map(name => `${R}/${name}`);
  const authority = authorityNames.map(path => { const row = candidate.inputs.find(input => input.path === path); requireThat(row, "seal-authority-input-required"); return row; });
  const evidence = { scope: "SOURCE_PREPARATION_ONLY_NOT_EXECUTION_AUTHORITY", nonAuthorizing: true, packet: packetPin, memberCount: 48, table: candidate.packet.table, inputs: candidate.inputs, authority,
    captureProof: candidate.readiness.captureProof, invocationProof: candidate.readiness.invocationProof, deliveryProof: candidate.deliveryProof, deliveryManifest: candidate.deliveryManifest,
    identitySha256: candidate.readiness.identitySha256, binding: bindingPin, readiness: readyPin, manualAttemptsConsumed: 0, innerAttemptsConsumed: 0, executionReadinessClaimed: false };
  const manifest = encodedRecord({ version: "chess-coach.sealed-source-packet-manifest.v1", ...evidence });
  const manifestPin = { path: MANIFEST_PATH, ...byteIdentity(manifest) };
  const result = encodedRecord({ version: "chess-coach.sealed-source-packet-result.v1", status: RESULT_STATUS, ...evidence, manifest: manifestPin,
    preResultPostchecks: "PASS_PURE_VALIDATORS_AND_UNCACHED_INPUT_READBACK", resultWriteDurabilityClaimed: false, externalExit0AndPostcheckRequired: true });
  const data = [candidate.binding, candidate.ready, candidate.packet.bytes, manifest, result];
  const caps = [CAPS.receipt, CAPS.receipt, api.constants.limits.packet, RECORD_CAP, RECORD_CAP];
  requireThat(candidate.paths.length === 48 && candidate.inputs.length <= 96 && new Set(candidate.inputs.map(row => row.path)).size === candidate.inputs.length, "seal-source-inventory");
  const verified = api.validatePacket(candidate.packet.bytes, candidate.packet.pin, candidate.packet.table);
  requireThat(equal([...verified.files.keys()], candidate.paths) && verified.files.get(BINDING_PATH)?.equals(candidate.binding) && verified.files.get(READY_PATH)?.equals(candidate.ready), "seal-source-candidate-bytes");
  for (let i = 0; i < targets.length; i++) { requireThat(data[i]!.length > 0 && data[i]!.length <= caps[i]!, "seal-prewrite-caps"); ancestors(dirname(targets[i]!), io); absent(targets[i]!, io); }
  const unchangedInputs = () => {
    for (const row of candidate.inputs) {
      const bytes = reader(row.path, FILE_CAP);
      requireThat(Buffer.isBuffer(bytes) && bytes.length <= FILE_CAP && equal({ path: row.path, ...byteIdentity(bytes) }, row), "seal-uncached-input-drift");
    }
  };
  const readOutput = (index: number): Buffer => {
    const path = targets[index]!, cap = caps[index]!; ancestors(dirname(path), io);
    const s = io.lstat(path);
    requireThat(s.isFile() && !s.isSymbolicLink() && s.nlink === 1 && s.size >= 0 && s.size <= cap && (s.mode & 0o777) === 0o600, "seal-output-regular-0600");
    const bytes = io.read(path, cap);
    requireThat(Buffer.isBuffer(bytes) && bytes.length <= cap && equal(byteIdentity(bytes), byteIdentity(data[index]!)), "seal-output-readback-mismatch");
    return bytes;
  };
  unchangedInputs();
  for (let i = 0; i < 4; i++) exclusive(targets[i]!, data[i]!, caps[i]!, io);
  unchangedInputs();
  const liveRead: EligibilityReader = (path, cap) => {
    const index = path === BINDING_PATH ? 0 : path === READY_PATH ? 1 : -1;
    const bytes = index < 0 ? reader(path, Math.min(cap, FILE_CAP)) : readOutput(index);
    requireThat(Buffer.isBuffer(bytes) && bytes.length <= Math.min(cap, FILE_CAP), "seal-written-validator-cap"); return bytes;
  };
  const identity = validateEligibility(liveRead);
  requireThat(equal(identity, candidate.identity) && equal(validateInvocationReady(identity, liveRead), candidate.readiness), "seal-written-pure-validation");
  const parsed = api.validatePacket(readOutput(2), candidate.packet.pin, candidate.packet.table); readOutput(3);
  for (const [path, bytes] of parsed.files) requireThat(bytes.equals(liveRead(path, FILE_CAP)), "seal-written-packet-member-drift");
  unchangedInputs();
  exclusive(targets[4]!, result, RECORD_CAP, io);
  for (let i = 0; i < 5; i++) readOutput(i);
  unchangedInputs();
  return { status: RESULT_STATUS, nonAuthorizing: true, externalExit0AndPostcheckRequired: true, outputs: SOURCE_OUTPUT_PATHS.map((path, index) => ({ path, ...byteIdentity(data[index]!) })), packet: packetPin, table: candidate.packet.table };
}

export async function emitProtectedFixture(context: { scope: "OFFLINE_PROTECTED_FIXTURE"; root: string; reader: EligibilityReader; io?: SealFileIO }) {
  requireThat(context?.scope === "OFFLINE_PROTECTED_FIXTURE" && typeof context.root === "string" && context.root === resolve(context.root) && /^seal-verification-[1-9][0-9]*\/fixtures\/[A-Za-z0-9_-]+\/source$/.test(relative(join(ROOT, R), context.root)), "seal-protected-source-fixture-only");
  return emitSource(context.reader, context.root, context.io ?? LOCAL_FILE_IO);
}

async function emitOfflineSourcePacket() {
  requireThat(import.meta.main && process.cwd() === ROOT && fileURLToPath(import.meta.url) === join(ROOT, R, "seal-ready-packet-emit.ts") && process.argv.length === 3 && process.argv[2] === "emit-offline-source-packet" && process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url), "seal-explicit-fixed-source-emitter-required");
  requireThat(process.versions["bun"] === "1.4.0" && process.execPath.startsWith("/") && process.execArgv.includes("--no-env-file") && process.execArgv.includes("--no-install"), "seal-emitter-pinned-bun-and-flags-required");
  return emitSource(repositoryReader, ROOT, LOCAL_FILE_IO);
}
if (import.meta.main) {
  try { const result = await emitOfflineSourcePacket(); process.stdout.write(`${result.status} ${RESULT_PATH}\n`); }
  catch (error) { process.stderr.write(`${error instanceof Error ? error.message.slice(0, 384) : "seal-source-emission-failed"}\n`); process.exitCode = 1; }
}
