// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  captureFilesystemSourceSnapshot, capturedSourceManifest, capturedSourceMember, capturedSourcePhysicalRoot,
  readCapturedSourceFile, requireCapturedSourceSnapshot, requireSourcePath, sourceSha256, verifyCapturedSourceManifest,
} from "../coordinator/sourceManifest";
import { createPrivateScratch, createScratchSourceRoot } from "./privateScratch";

const directories: string[] = [];
const fixture = () => {
  const directory = createPrivateScratch("b1-manifest-");
  directories.push(directory);
  const root = createScratchSourceRoot(directory, "source");
  mkdirSync(join(root, "src"), { mode: 0o755 });
  writeFileSync(join(root, "src", "module.ts"), "export const value = 1;\n", { mode: 0o644 });
  symlinkSync("module.ts", join(root, "src", "alias.ts"));
  return root;
};
const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value, null, 2) + "\n");
afterEach(() => { for (const root of directories.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe("B1 captured-source manifest-v1 bytes", () => {
  it("preserves the existing physical tree format and traversal/hash rules", () => {
    const root = fixture(), snapshot = captureFilesystemSourceSnapshot(root), manifest = capturedSourceManifest(snapshot);
    const entries = [
      { path: ".", mode: "755", type: "directory" },
      { path: "src", mode: "755", type: "directory" },
      { path: "src/alias.ts", mode: "777", type: "symlink", target: "module.ts", sha256: sourceSha256("module.ts") },
      { path: "src/module.ts", mode: "644", type: "file", bytes: 24, sha256: sourceSha256("export const value = 1;\n") },
    ];
    expect(manifest).toEqual({ version: 1, root: "/app", exclusions: ["node_modules", "_spec/evidence/ml-adjutant-r2-refresh"],
      inventoryLocation: "/hermetic-evidence/source.json (outside inventoried root)",
      algorithm: "sha256(JSON.stringify(entries))", sha256: sourceSha256(JSON.stringify(entries)), entries });
    expect(capturedSourcePhysicalRoot(snapshot)).toBe(root);
    expect(verifyCapturedSourceManifest(snapshot, bytes(manifest))).toBe(manifest);
    expect(Object.isFrozen(manifest)).toBe(true);
    expect(Object.isFrozen(manifest.entries)).toBe(true);
    expect(manifest.entries.every(Object.isFrozen)).toBe(true);
  });

  it("keeps actual captured file bytes exclusive without claiming a read-only filesystem", () => {
    const root = fixture(), snapshot = captureFilesystemSourceSnapshot(root), manifest = capturedSourceManifest(snapshot);
    const consumed = readCapturedSourceFile(snapshot, "src/module.ts");
    consumed.fill(0);
    writeFileSync(join(root, "src", "module.ts"), "export const value = 9;\n");
    expect(new TextDecoder().decode(readCapturedSourceFile(snapshot, "src/module.ts"))).toBe("export const value = 1;\n");
    expect(verifyCapturedSourceManifest(snapshot, bytes(manifest))).toBe(manifest);
    expect(() => verifyCapturedSourceManifest(captureFilesystemSourceSnapshot(root), bytes(manifest))).toThrow("MANIFEST");
  });

  it.each(["mode", "path", "bytes", "sha256", "type"])("compares every file member %s", field => {
    const snapshot = captureFilesystemSourceSnapshot(fixture()), original = capturedSourceManifest(snapshot);
    const altered = JSON.parse(JSON.stringify(original));
    const member = altered.entries.find((entry: { path: string }) => entry.path === "src/module.ts");
    member[field] = field === "bytes" ? 25 : field === "mode" ? "600" : field === "path" ? "src/replaced.ts" : field === "type" ? "directory" : "0".repeat(64);
    altered.sha256 = sourceSha256(JSON.stringify(altered.entries));
    expect(() => verifyCapturedSourceManifest(snapshot, bytes(altered))).toThrow("MANIFEST");
  });

  it.each(["directory", "symlink-target", "membership", "order"])("rejects changed %s even after rehash", change => {
    const snapshot = captureFilesystemSourceSnapshot(fixture()), altered = JSON.parse(JSON.stringify(capturedSourceManifest(snapshot)));
    if (change === "directory") altered.entries[1].mode = "700";
    if (change === "symlink-target") {
      altered.entries[2].target = "elsewhere.ts";
      altered.entries[2].sha256 = sourceSha256("elsewhere.ts");
    }
    if (change === "membership") altered.entries.pop();
    if (change === "order") altered.entries.reverse();
    altered.sha256 = sourceSha256(JSON.stringify(altered.entries));
    expect(() => verifyCapturedSourceManifest(snapshot, bytes(altered))).toThrow("MANIFEST");
  });

  it("retains exact exclusions and excludes evidence outside the source inventory", () => {
    const root = fixture();
    for (const path of ["node_modules/pkg", "src/node_modules/pkg", "_spec/evidence/ml-adjutant-r2-refresh"]) {
      mkdirSync(join(root, path), { recursive: true });
      writeFileSync(join(root, path, "excluded.ts"), "excluded");
    }
    const snapshot = captureFilesystemSourceSnapshot(root), manifest = capturedSourceManifest(snapshot);
    expect(manifest.entries.some(entry => entry.path.endsWith("excluded.ts"))).toBe(false);
    const altered = { ...manifest, exclusions: ["node_modules"] };
    expect(() => verifyCapturedSourceManifest(snapshot, bytes(altered))).toThrow("MANIFEST");
    expect(() => verifyCapturedSourceManifest(snapshot, bytes({ ...manifest, inventoryLocation: "source.json" }))).toThrow("MANIFEST");
    expect(() => verifyCapturedSourceManifest(snapshot, bytes({ ...manifest, extra: true }))).toThrow("MANIFEST");
  });

  it.each(["", "/absolute", "../outside", "src/../module.ts", "src//module.ts", "src/./module.ts", "src\\module.ts", "src/\0file"])(
    "rejects unsafe member path %j", path => {
      expect(() => requireSourcePath(path)).toThrow("PATH");
      const snapshot = captureFilesystemSourceSnapshot(fixture());
      expect(() => readCapturedSourceFile(snapshot, path)).toThrow("PATH");
      expect(() => capturedSourceMember(snapshot, path)).toThrow("PATH");
    });

  it("rejects foreign or cloned snapshots and symlink-selected physical roots", () => {
    const root = fixture(), snapshot = captureFilesystemSourceSnapshot(root);
    for (const candidate of [null, {}, { ...snapshot }, structuredClone(snapshot), new Proxy(snapshot, {})]) {
      expect(() => requireCapturedSourceSnapshot(candidate)).toThrow("PROVENANCE");
    }
    const parent = createPrivateScratch("b1-manifest-link-");
    directories.push(parent);
    symlinkSync(root, join(parent, "selected"));
    expect(() => captureFilesystemSourceSnapshot(join(parent, "selected"))).toThrow("SNAPSHOT");
  });

  it("rejects malformed UTF-8, duplicate/unknown top fields and excessive nesting", () => {
    const snapshot = captureFilesystemSourceSnapshot(fixture());
    expect(() => verifyCapturedSourceManifest(snapshot, new Uint8Array([0xff]))).toThrow("MANIFEST");
    expect(() => verifyCapturedSourceManifest(snapshot, new TextEncoder().encode("{"))).toThrow("MANIFEST");
    const original = new TextDecoder().decode(bytes(capturedSourceManifest(snapshot)));
    expect(() => verifyCapturedSourceManifest(snapshot, new TextEncoder().encode('{"version":0,' + original.slice(1)))).toThrow("MANIFEST");
    expect(() => verifyCapturedSourceManifest(snapshot, new TextEncoder().encode("[".repeat(130) + "0" + "]".repeat(130)))).toThrow("LIMIT");
  });
});
