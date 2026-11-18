// SPEC: _spec/gate-closure.puml, _spec/runtime-protocol.puml
import type {} from "bun";
import { createHash } from "node:crypto";
import { lstat, open } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { z } from "zod";

const pathShape = z.string().min(1).max(1024).regex(/^[A-Za-z0-9_.@+-]+(?:\/[A-Za-z0-9_.@+-]+)*$/)
  .refine(path => path.split("/").every(part => part !== "." && part !== ".."));
const byteRef = { byteLength: z.int().min(1).max(Number.MAX_SAFE_INTEGER), sha256: z.string().regex(/^[a-f0-9]{64}$/) };
const fileShape = z.strictObject({ path: pathShape, ...byteRef });
const manifestShape = z.strictObject({ version: z.literal("chess-coach.runtime-files.v1"), files: z.array(fileShape).min(1) });
export type ArtifactFile = z.infer<typeof fileShape>;
export type ArtifactLimits = { manifestBytes: number; files: number; fileBytes: number; totalBytes: number };
export type ArtifactManifest = z.infer<typeof manifestShape>;

function limits(value: ArtifactLimits): void {
  if (Object.values(value).some(limit => !Number.isSafeInteger(limit) || limit < 1) || value.fileBytes > value.totalBytes) throw new Error("Artifacts: LIMITS");
}
export function checkArtifactManifest(json: string, expectedSha256: string, requiredPaths: readonly string[], bounds: ArtifactLimits): ArtifactManifest {
  limits(bounds);
  if (json.length > bounds.manifestBytes || Buffer.byteLength(json) > bounds.manifestBytes) throw new Error("Artifacts: MANIFEST_BOUND");
  if (!/^[a-f0-9]{64}$/.test(expectedSha256) || createHash("sha256").update(json).digest("hex") !== expectedSha256) throw new Error("Artifacts: EXPECTATION");
  const manifest = boundedManifest(JSON.parse(json), bounds);
  for (const path of requiredPaths) {
    pathShape.parse(path);
    if (!manifest.files.some(file => file.path === path)) throw new Error("Artifacts: MISSING_ROLE");
  }
  return manifest;
}
function boundedManifest(value: unknown, bounds: ArtifactLimits): ArtifactManifest {
  limits(bounds);
  const manifest = manifestShape.parse(value);
  if (manifest.files.length > bounds.files) throw new Error("Artifacts: FILE_COUNT");
  let total = 0, prior = "";
  for (const file of manifest.files) {
    total += file.byteLength;
    if (file.path <= prior || file.byteLength > bounds.fileBytes || !Number.isSafeInteger(total) || total > bounds.totalBytes) throw new Error("Artifacts: FILE_BOUND_OR_ORDER");
    prior = file.path;
  }
  return manifest;
}

export async function verifyArtifactFiles(root: string, selected: ArtifactManifest, bounds: ArtifactLimits): Promise<void> {
  const manifest = boundedManifest(selected, bounds);
  if (!isAbsolute(root) || !(await lstat(root)).isDirectory()) throw new Error("Artifacts: ROOT");
  for (const file of manifest.files) {
    const parts = file.path.split("/");
    let path = root;
    for (const [index, part] of parts.entries()) {
      path = join(path, part);
      const stat = await lstat(path);
      if (stat.isSymbolicLink() || (index === parts.length - 1 ? !stat.isFile() : !stat.isDirectory())) throw new Error("Artifacts: FILE_KIND");
    }
    const handle = await open(path, "r");
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size !== file.byteLength) throw new Error("Artifacts: LENGTH");
      const hash = createHash("sha256"), buffer = Buffer.alloc(65536);
      let read = 0;
      for (;;) {
        const next = await handle.read(buffer, 0, Math.min(buffer.length, file.byteLength - read + 1), null);
        if (!next.bytesRead) break;
        read += next.bytesRead;
        if (read > file.byteLength) throw new Error("Artifacts: LENGTH");
        hash.update(buffer.subarray(0, next.bytesRead));
      }
      if (read !== file.byteLength || hash.digest("hex") !== file.sha256) throw new Error("Artifacts: CONTENT");
    } finally { await handle.close(); }
  }
}
