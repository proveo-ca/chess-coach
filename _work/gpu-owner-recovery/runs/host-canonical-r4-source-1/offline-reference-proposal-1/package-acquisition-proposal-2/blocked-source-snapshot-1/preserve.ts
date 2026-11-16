// SPEC: _spec/runtime-protocol.puml
import * as fs from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
const root = "/home/gu1lty/Projects/proveo/chess-coach";
const r2 = "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2";
const destination = join(root, r2, "blocked-source-snapshot-1");
if (process.cwd() !== root || process.versions["bun"] !== "1.4.0") throw Error("fixed-offline-preservation-context");
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
function write(name: string, bytes: Buffer) {
  if (bytes.length > 4194304) throw Error("bounded-preservation-file");
  const fd = fs.openSync(name, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o400);
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  const dir = fs.openSync(dirname(name), fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
  try { fs.fsyncSync(dir); } finally { fs.closeSync(dir); }
}
const proofPath = join(root, r2, "delivery-verification-7/receipt.json"), proofBytes = fs.readFileSync(proofPath);
if (sha(proofBytes) !== "f0d540e1cc21c57500ccb5c52af67887913828641a6935974efb12243fd1c4bf") throw Error("blocked-proof-seven-pin");
const proof = JSON.parse(proofBytes.toString()) as { sources: Record<string, { bytes: number; sha256: string }> };
const sourcePaths = Object.keys(proof.sources);
if (sourcePaths.length !== 7) throw Error("seven-blocked-sources-required");
for (const name of ["sources", "historical-proof-7"]) fs.mkdirSync(join(destination, name), { mode: 0o700 });
const rows = [];
for (const name of sourcePaths) {
  if (!name.startsWith(r2 + "/") || name.slice(r2.length + 1).includes("/")) throw Error("bounded-blocked-source-name");
  const bytes = fs.readFileSync(join(root, name)), pin = proof.sources[name]!;
  if (bytes.length !== pin.bytes || sha(bytes) !== pin.sha256) throw Error("blocked-source-drift");
  const copy = "sources/" + name.slice(r2.length + 1); write(join(destination, copy), bytes); rows.push({ original: name, copy, bytes: bytes.length, sha256: sha(bytes) });
}
for (const name of ["receipt.json", "source-manifest.json", "readchecks-before.json", "readchecks-after.json", "tests.stdout", "tests.stderr", "typecheck.stdout", "typecheck.stderr", "fish-syntax.stdout", "fish-syntax.stderr", "synthetic-nonrunning.fish"]) {
  const original = `${r2}/delivery-verification-7/${name}`, bytes = fs.readFileSync(join(root, original)), copy = `historical-proof-7/${name}`;
  write(join(destination, copy), bytes); rows.push({ original, copy, bytes: bytes.length, sha256: sha(bytes) });
}
write(join(destination, "manifest.json"), Buffer.from(JSON.stringify({ scope: "IMMUTABLE_BLOCKED_DELIVERY_GENERATION_BEFORE_ANONYMOUS_TRANSPORT_AMENDMENT", proofSevenSha256: sha(proofBytes), sourceCount: 7, historicalProofFiles: 11, originalProofsAndFixturesPreservedInPlace: true, files: rows }, null, 2) + "\n"));
process.stdout.write(destination + "/manifest.json\n");
