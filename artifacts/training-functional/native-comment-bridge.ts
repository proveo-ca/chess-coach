// SPEC: _spec/runtime-protocol.puml
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const NATIVE_MANIFEST_PATH = "_work/gpu-owner-recovery/runs/host-gpu-policy-record-correction-source-2/native-source-manifest.json";
export const NATIVE_MANIFEST_SHA256 = "7e0aa13c178a77e01526d7fa02189c404c1ce3b44666914665cb9ca63a3521ec";
export const SPEC_POINTER_DELTAS = [
  { path: "Cargo.toml", old: "# SPEC: _spec/architecture.puml", current: "# SPEC: _spec/ml-runtime-architecture.puml" },
  { path: "crates/learning/Cargo.toml", old: "# SPEC: _spec/architecture.puml", current: "# SPEC: _spec/ml-runtime-architecture.puml" },
  { path: "crates/learning/src/batch.rs", old: "// SPEC: _spec/architecture.puml", current: "// SPEC: _spec/ml-runtime-architecture.puml" },
  { path: "crates/learning/src/lib.rs", old: "// SPEC: _spec/architecture.puml, _spec/learning.puml", current: "// SPEC: _spec/ml-runtime-architecture.puml, _spec/learning.puml" },
  { path: "crates/learning/src/model.rs", old: "// SPEC: _spec/architecture.puml, _spec/learning.puml, _spec/representation.puml", current: "// SPEC: _spec/ml-runtime-architecture.puml, _spec/learning.puml, _spec/representation.puml" },
  { path: "crates/learning/tests/model.rs", old: "// SPEC: _spec/architecture.puml", current: "// SPEC: _spec/ml-runtime-architecture.puml" },
] as const;
const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

export function checkNativeCommentBridge(manifestBytes: Uint8Array, readSource: (path: string) => Uint8Array) {
  if (sha256(manifestBytes) !== NATIVE_MANIFEST_SHA256) throw new Error("Native bridge: MANIFEST_BINDING");
  const manifest = JSON.parse(Buffer.from(manifestBytes).toString("utf8")) as { path: string; sha256: string }[];
  if (manifest.length !== 65 || new Set(manifest.map(row => row.path)).size !== 65) throw new Error("Native bridge: MEMBERSHIP");
  let totalBytes = 0;
  const rows = manifest.map(expected => {
    if (expected.path.startsWith("/") || expected.path.split("/").includes("..")) throw new Error("Native bridge: PATH");
    const bytes = Buffer.from(readSource(expected.path));
    if (bytes.length > 16 * 1024 * 1024 || (totalBytes += bytes.length) > 32 * 1024 * 1024) throw new Error("Native bridge: READ_BOUND");
    const currentSha256 = sha256(bytes), delta = SPEC_POINTER_DELTAS.find(item => item.path === expected.path);
    if (!delta) {
      if (currentSha256 !== expected.sha256) throw new Error(`Native bridge: DIRECT_HASH:${expected.path}`);
      return { path: expected.path, comparison: "BYTE_IDENTICAL" as const, currentSha256, acceptedSha256: expected.sha256 };
    }
    const prefix = Buffer.from(delta.current + "\n");
    if (!bytes.subarray(0, prefix.length).equals(prefix)) throw new Error(`Native bridge: EXACT_FIRST_LINE:${expected.path}`);
    const restored = Buffer.concat([Buffer.from(delta.old + "\n"), bytes.subarray(prefix.length)]);
    if (sha256(restored) !== expected.sha256) throw new Error(`Native bridge: RESTORED_HASH:${expected.path}`);
    return { path: expected.path, comparison: "EXACT_SPEC_POINTER_ONLY" as const, currentSha256, acceptedSha256: expected.sha256,
      oldFirstLine: delta.old, currentFirstLine: delta.current };
  });
  if (rows.filter(row => row.comparison === "EXACT_SPEC_POINTER_ONLY").length !== 6) throw new Error("Native bridge: DELTA_MEMBERSHIP");
  return { status: "PASS_EXACT_SIX_SPEC_POINTER_DELTAS_ONLY" as const, manifestSha256: NATIVE_MANIFEST_SHA256,
    members: rows.length, byteIdenticalMembers: 59, specPointerOnlyMembers: 6, bytesRead: totalBytes, rows,
    nativeExecuted: false, numericalTestsRerun: false, historicalManifestChanged: false };
}

export function inspectNativeCommentBridge(root: string) {
  return checkNativeCommentBridge(readFileSync(resolve(root, NATIVE_MANIFEST_PATH)), path => readFileSync(resolve(root, path)));
}
