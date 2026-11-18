// SPEC: _spec/runtime-protocol.puml
import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const originalRoot = "artifacts/training-functional/scratch/reference-prep-2/source";
const destination = "artifacts/training-functional/reference-inputs";
const manifestPath = "artifacts/training-functional/reference-prep-2/input-manifest.json";
const manifestSha256 = "51b6e846ec9c9e0fa645b4f309a667e5a95842306f8f610a06123b2cf9af97d7";
const mapping = [
  ["node_modules/fflate/package.json", "fflate-package.json"],
  ["node_modules/fflate/esm/index.mjs", "fflate-esm-index.mjs"],
  ["node_modules/fflate/LICENSE", "fflate-LICENSE"],
  ["node_modules/jssha/package.json", "jssha-package.json"],
  ["node_modules/jssha/dist/sha256.mjs", "jssha-dist-sha256.mjs"],
  ["node_modules/jssha/LICENSE", "jssha-LICENSE"],
] as const;
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

export function retainReferenceInputs(): void {
  const bytes = readFileSync(resolve(root, manifestPath));
  if (bytes.length > 1024 * 1024 || sha(bytes) !== manifestSha256) throw new Error("Retain inputs: MANIFEST_BINDING");
  const manifest = JSON.parse(bytes.toString()) as { files: { path: string; bytes: number; sha256: string; sourceMode: string }[] };
  const rows = mapping.map(([source, output]) => {
    const expected = manifest.files.filter(row => row.path === source);
    const path = resolve(root, originalRoot, source), info = lstatSync(path);
    if (expected.length !== 1 || !info.isFile() || info.size > 1024 * 1024) throw new Error("Retain inputs: FILE_BOUND");
    const data = readFileSync(path), row = expected[0]!;
    if (data.length !== row.bytes || sha(data) !== row.sha256 || (info.mode & 0o777) !== parseInt(row.sourceMode, 8) % 0o1000) throw new Error("Retain inputs: FILE_BINDING");
    return { source, output, data, sourceMode: row.sourceMode, sha256: row.sha256 };
  });
  if (rows.reduce((sum, row) => sum + row.data.length, 0) !== 113300) throw new Error("Retain inputs: TOTAL_BOUND");
  mkdirSync(resolve(root, destination), { mode: 0o700 });
  for (const row of rows) writeFileSync(resolve(root, destination, row.output), row.data, { flag: "wx", mode: parseInt(row.sourceMode, 8) % 0o1000 });
  const receipt = { scope: "USER_APPROVED_FLAT_SOURCE_INPUTS_AND_LICENSES_FOR_PUBLICATION_NOT_BUILT_OUTPUTS", sourceManifest: { path: manifestPath, sha256: manifestSha256 },
    files: rows.map(({ source, output, data, sourceMode, sha256 }) => ({ source, path: `${destination}/${output}`, bytes: data.length, sourceMode, sha256 })),
    filesCopied: rows.length, bytesCopied: 113300, originalInputsModified: false, newNetworkRequests: 0, referenceBuilds: 0,
    fflateOrigin: "SELECTED_INSTALLED_PACKAGE_BYTES_NOT_ARCHIVE_SRI_ATTESTATION", jsshaOrigin: "PINNED_SHA512_VERIFIED_ARCHIVE_SELECTED_MEMBERS", trainingReady: false };
  writeFileSync(resolve(root, destination, "manifest.json"), JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
  console.log("Executor: " + JSON.stringify({ filesCopied: rows.length, bytesCopied: 113300, manifest: `${destination}/manifest.json`, trainingReady: false }));
}

if (import.meta.main) retainReferenceInputs();
