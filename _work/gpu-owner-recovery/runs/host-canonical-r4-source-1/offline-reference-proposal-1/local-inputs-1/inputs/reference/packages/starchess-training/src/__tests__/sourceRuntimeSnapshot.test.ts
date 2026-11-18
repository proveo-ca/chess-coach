// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { sourceSha256 } from "../coordinator/sourceManifest";
import { capturedRuntimeManifest, readCapturedRuntimeFile, requireCapturedRuntimeSnapshot, SOURCE_INSTALLED_ROOTS,
  verifyCapturedRuntimeManifest } from "../coordinator/sourceRuntimeSnapshot";
import { sourceSnapshotFixture } from "./sourceSnapshotFixture";

const directories: string[] = [];
afterEach(() => { for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true }); });
describe("captured actual hermetic runtime trees", () => {
  it("retains existing dependency-manifest-v1 order, roots and encodings", () => {
    const f = sourceSnapshotFixture({ "node_modules/pkg/index.js": "module.exports = 1;\n" }); directories.push(f.directory);
    const manifest = capturedRuntimeManifest(f.runtime);
    expect(manifest.version).toBe(1);
    expect(manifest.installed.map(tree => tree.root)).toEqual(SOURCE_INSTALLED_ROOTS);
    expect(manifest.installedSha256).toBe(sourceSha256(JSON.stringify(manifest.installed)));
    expect(manifest.frozenStore.root).toBe("/pnpm/store");
    expect(manifest.tools.root).toBe("/opt/pnpm");
    for (const tree of [...manifest.installed, manifest.frozenStore, manifest.tools]) {
      expect(tree.algorithm).toBe("sha256(JSON.stringify(entries))");
      expect(tree.sha256).toBe(sourceSha256(JSON.stringify(tree.entries)));
      expect(Object.isFrozen(tree.entries)).toBe(true);
    }
    const bytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2) + "\n");
    expect(() => verifyCapturedRuntimeManifest(f.runtime, bytes)).not.toThrow();
    expect(() => verifyCapturedRuntimeManifest(f.runtime, new TextEncoder().encode(JSON.stringify(manifest)))).toThrow("RUNTIME");
  });

  it("retains private runtime buffers and supplies fresh reads after physical mutation", () => {
    const f = sourceSnapshotFixture({ "node_modules/pkg/index.js": "module.exports = 1;\n" }); directories.push(f.directory);
    const first = readCapturedRuntimeFile(f.runtime, "/app/node_modules/pkg/index.js"); first.fill(0);
    writeFileSync(join(f.repository, "node_modules/pkg/index.js"), "changed");
    expect(new TextDecoder().decode(readCapturedRuntimeFile(f.runtime, "/app/node_modules/pkg/index.js"))).toBe("module.exports = 1;\n");
    for (const value of [{}, structuredClone(f.runtime), new Proxy(f.runtime, {})]) expect(() => requireCapturedRuntimeSnapshot(value)).toThrow("RUNTIME");
    expect(() => readCapturedRuntimeFile(f.runtime, "/app/node_modules/../pkg/index.js")).toThrow("PATH");
  });
});
