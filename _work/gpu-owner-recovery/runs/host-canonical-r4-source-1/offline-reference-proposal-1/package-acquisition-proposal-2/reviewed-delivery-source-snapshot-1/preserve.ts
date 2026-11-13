// SPEC: _spec/runtime-protocol.puml
import * as fs from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
const root = "/home/gu1lty/Projects/proveo/chess-coach";
const d = "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1";
const r2 = `${d}/package-acquisition-proposal-2`, s2 = `${d}/package-acquisition-bun-source2`;
const target = join(root, r2, "reviewed-delivery-source-snapshot-1");
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
const proofPath = `${r2}/delivery-verification-10/receipt.json`, proofBytes = read(proofPath);
if (sha(proofBytes) !== "6580b856618b95270bb5fe0fbe8d6c1d64d168bb32dcdd0ead4d8a8e28c1dddf") throw Error("reviewed-proof-ten-pin");
const manifestPath = `${r2}/delivery-verification-10/source-manifest.json`;
if (sha(read(manifestPath)) !== "5f22251535c5a26b1e0ba5e29731e89e73d720ed9f49c1583173c3b27f6a77a0") throw Error("reviewed-manifest-ten-pin");
const proof = JSON.parse(proofBytes.toString()) as { sources: Record<string, { bytes: number; sha256: string }> };
if (Object.keys(proof.sources).length !== 7) throw Error("seven-reviewed-delivery-sources-required");
for (const name of ["sources", "historical-proof-10", "delivery-reviews"]) fs.mkdirSync(join(target, name), { mode: 0o700 });
const files = [];
function preserve(original: string, copy: string, pin?: { bytes: number; sha256: string }) {
  const originalMetadata = metadata(join(root, original)), bytes = read(original);
  if (pin && (pin.bytes !== bytes.length || pin.sha256 !== sha(bytes))) throw Error("reviewed-source-drift");
  write(join(target, copy), bytes);
  files.push({ original, copy, bytes: bytes.length, sha256: sha(bytes), originalMetadata, copyMetadata: metadata(join(target, copy)) });
}
for (const [name, pin] of Object.entries(proof.sources)) {
  if (!name.startsWith(r2 + "/") || name.slice(r2.length + 1).includes("/")) throw Error("finite-reviewed-source-name");
  preserve(name, "sources/" + name.slice(r2.length + 1), pin);
}
for (const name of ["receipt.json", "source-manifest.json", "readchecks-before.json", "readchecks-after.json", "tests.stdout", "tests.stderr", "typecheck.stdout", "typecheck.stderr", "fish-syntax.stdout", "fish-syntax.stderr", "synthetic-nonrunning.fish"]) preserve(`${r2}/delivery-verification-10/${name}`, `historical-proof-10/${name}`);
for (const role of ["backend", "devops", "adversarial", "security"]) preserve(`${r2}/implementation-review-2/delivery/${role}.json`, `delivery-reviews/${role}.json`);
const runtime: Record<string, unknown> = {};
function protect(name: string, pin?: string) {
  const bytes = read(name); if (pin !== undefined && sha(bytes) !== pin) throw Error("protected-runtime-pin-drift");
  runtime[name] = { bytes: bytes.length, sha256: sha(bytes), metadata: metadata(join(root, name)) };
}
const callerManifest = JSON.parse(read(`${r2}/invocation-verification-6/source-manifest.json`).toString()) as Record<string, Record<string, string>>;
let sources = 0;
for (const section of ["source", "caller", "observer"]) for (const [name, pin] of Object.entries(callerManifest[section]!)) { protect(name, pin); sources++; }
if (sources !== 18) throw Error("eighteen-runtime-sources-required");
for (const [scope, proofDirectory] of [["capture", `${s2}/fullverification-9`], ["caller", `${r2}/invocation-verification-6`]] as const) {
  for (const role of ["backend", "devops", "adversarial", "security"]) {
    const name = `${r2}/implementation-review-2/${scope}/${role}.json`, row = JSON.parse(read(name).toString());
    if (row.status !== `READY_${scope.toUpperCase()}_IMPLEMENTATION_SCOPE`) throw Error("eight-ready-runtime-reviews-required");
    protect(name); protect(row.verificationReceipt.path, row.verificationReceipt.sha256); protect(row.sourceManifest.path, row.sourceManifest.sha256);
  }
  for (const name of fs.readdirSync(join(root, proofDirectory)).sort()) {
    if (name === "fixtures") continue;
    if (!/^[a-z][a-z0-9.-]+$/.test(name)) throw Error("finite-runtime-proof-name");
    protect(`${proofDirectory}/${name}`);
  }
}
protect(`${r2}/runtime-eligibility-reads2.json`); protect(`${r2}/runtime-entry-contract1.json`);
write(join(target, "manifest.json"), Buffer.from(JSON.stringify({ scope: "REVIEWED_DELIVERY_GENERATION_BEFORE_CONTAINED_LIFECYCLE_AND_ASSESSMENT_FIXES", proofTenSha256: sha(proofBytes), sourceCount: 7, historicalProofFiles: 11, deliveryReviews: 4, originalProofsFailedFixturesAndHistoryPreserved: true, files, protectedRuntimeSourceCount: sources, protectedRuntime: runtime }, null, 2) + "\n"));
process.stdout.write(target + "/manifest.json\n");
