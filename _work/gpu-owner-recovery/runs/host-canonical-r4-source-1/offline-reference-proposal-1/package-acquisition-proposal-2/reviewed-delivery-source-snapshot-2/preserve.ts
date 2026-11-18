// SPEC: _spec/runtime-protocol.puml
import * as fs from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
const root = "/home/gu1lty/Projects/proveo/chess-coach";
const r2 = "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2";
const target = join(root, r2, "reviewed-delivery-source-snapshot-2");
if (process.cwd() !== root || process.versions["bun"] !== "1.4.0") throw Error("fixed-offline-preservation-context");
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
function metadata(name: string) {
  const s = fs.lstatSync(name, { bigint: true });
  if (!s.isFile() || s.isSymbolicLink() || s.size > 4194304n) throw Error("bounded-preserved-regular-file");
  return { dev: String(s.dev), ino: String(s.ino), mode: String(s.mode), size: String(s.size), mtimeNs: String(s.mtimeNs), ctimeNs: String(s.ctimeNs) };
}
function read(relative: string) { metadata(join(root, relative)); return fs.readFileSync(join(root, relative)); }
function write(name: string, bytes: Buffer) {
  const fd = fs.openSync(name, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o400);
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  const parent = fs.openSync(dirname(name), fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
  try { fs.fsyncSync(parent); } finally { fs.closeSync(parent); }
}
const proofBytes = read(`${r2}/delivery-verification-14/receipt.json`);
if (sha(proofBytes) !== "42e7d861c2d5c284ab082c7b76fe71d21c3ee6076bad49cacab20bfb77570871") throw Error("reviewed-proof-fourteen-pin");
if (sha(read(`${r2}/delivery-verification-14/source-manifest.json`)) !== "bc92baf8c663da9ff3049764f1b788bb7b74ce79f6583d5bfa55bc809418851e") throw Error("reviewed-manifest-fourteen-pin");
const proof = JSON.parse(proofBytes.toString()) as { sources: Record<string, { bytes: number; sha256: string }> };
if (Object.keys(proof.sources).length !== 7) throw Error("seven-reviewed-delivery-sources-required");
const previousBytes = read(`${r2}/reviewed-delivery-source-snapshot-1/manifest.json`);
if (sha(previousBytes) !== "e8d75962caa40426dff207fb9b6b53330901ac7620310c93849d128019a73114") throw Error("previous-reviewed-generation-pin");
const previous = JSON.parse(previousBytes.toString()) as { protectedRuntimeSourceCount: number; protectedRuntime: Record<string, { bytes: number; sha256: string; metadata: Record<string, string> }> };
if (previous.protectedRuntimeSourceCount !== 18 || Object.keys(previous.protectedRuntime).length !== 52) throw Error("fixed-runtime-inventory");
for (const [name, row] of Object.entries(previous.protectedRuntime)) {
  const bytes = read(name), current = metadata(join(root, name)) as Record<string, string>;
  if (bytes.length !== row.bytes || sha(bytes) !== row.sha256 || !Object.entries(row.metadata).every(([key, value]) => current[key] === value)) throw Error("runtime-source-proof-or-review-drift");
}
for (const name of ["sources", "historical-proof-14", "delivery-reviews"]) fs.mkdirSync(join(target, name), { mode: 0o700 });
const files = [];
function preserve(original: string, copy: string, pin?: { bytes: number; sha256: string }) {
  const originalMetadata = metadata(join(root, original)), bytes = read(original);
  if (pin && (pin.bytes !== bytes.length || pin.sha256 !== sha(bytes))) throw Error("reviewed-source-drift");
  write(join(target, copy), bytes); files.push({ original, copy, bytes: bytes.length, sha256: sha(bytes), originalMetadata, copyMetadata: metadata(join(target, copy)) });
}
for (const [name, pin] of Object.entries(proof.sources)) {
  if (!name.startsWith(r2 + "/") || name.slice(r2.length + 1).includes("/")) throw Error("finite-reviewed-source-name");
  preserve(name, "sources/" + name.slice(r2.length + 1), pin);
}
for (const name of ["receipt.json", "source-manifest.json", "readchecks-before.json", "readchecks-after.json", "tests.stdout", "tests.stderr", "typecheck.stdout", "typecheck.stderr", "fish-syntax.stdout", "fish-syntax.stderr", "synthetic-nonrunning.fish"]) preserve(`${r2}/delivery-verification-14/${name}`, `historical-proof-14/${name}`);
for (const role of ["backend", "devops", "adversarial", "security"]) preserve(`${r2}/implementation-review-3/delivery/${role}.json`, `delivery-reviews/${role}.json`);
write(join(target, "manifest.json"), Buffer.from(JSON.stringify({ scope: "REVIEWED_DELIVERY_GENERATION_BEFORE_PER_PIPE_EVIDENCE_AND_BUN_LABEL_FIXES", proofFourteenSha256: sha(proofBytes), sourceCount: 7, historicalProofFiles: 11, deliveryReviews: 4, originalProofsFailedFixturesAndHistoryPreserved: true, files, protectedRuntimeSourceCount: 18, protectedRuntime: previous.protectedRuntime }, null, 2) + "\n"));
process.stdout.write(target + "/manifest.json\n");
