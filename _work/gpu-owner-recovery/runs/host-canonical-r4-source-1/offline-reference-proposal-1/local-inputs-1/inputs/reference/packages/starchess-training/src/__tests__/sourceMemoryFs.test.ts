// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { captureFilesystemSourceSnapshot } from "../coordinator/sourceManifest";
import { createSourceMemoryFs } from "../coordinator/sourceMemoryFs";
import { sourceSnapshotFixture } from "./sourceSnapshotFixture";

const directories: string[] = [];
const fixture = () => {
  const f = sourceSnapshotFixture({ "src/value.ts": "export const value = 1;\n", "node_modules/pkg/index.js": "runtime" });
  directories.push(f.directory);
  return { ...f, memory: createSourceMemoryFs(f.source, f.runtime) };
};
afterEach(() => { for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true }); });
describe("closed immutable-memory filesystem", () => {
  it("reads only captured source/runtime with fresh buffers and read-only descriptors", () => {
    const f = fixture(), fs = f.memory.fs as any;
    const bytes = fs.readFileSync("/app/src/value.ts"); bytes.fill(0);
    writeFileSync(join(f.repository, "src/value.ts"), "changed");
    expect(fs.readFileSync("/app/src/value.ts", "utf8")).toBe("export const value = 1;\n");
    expect(fs.readFileSync("/app/node_modules/pkg/index.js", "utf8")).toBe("runtime");
    expect(fs.readdirSync("/app/src")).toEqual(["value.ts"]);
    const fd = fs.openSync("/app/src/value.ts", "r"), target = Buffer.alloc(6);
    expect(fs.readSync(fd, target, 0, 6, 0)).toBe(6);
    expect(target.toString()).toBe("export");
    expect(fs.fstatSync(fd).isFile()).toBe(true); fs.closeSync(fd);
    expect(() => f.memory.assertCurrent()).not.toThrow();
  });

  it.each(["/etc/passwd", "/app/../etc/passwd", "/app/src//value.ts", "/app/src/./value.ts", "/app/src\\value.ts"])(
    "latches caught forbidden path %s without native fallback", path => {
      const f = fixture(), fs = f.memory.fs as any;
      expect(() => fs.existsSync(path)).toThrow("FORBIDDEN_ACQUISITION");
      expect(() => f.memory.assertCurrent()).toThrow("FORBIDDEN_ACQUISITION");
      expect(() => fs.readFileSync("/app/src/value.ts")).toThrow("FORBIDDEN_ACQUISITION");
    });

  it.each(["writeFileSync", "unlinkSync", "mkdirSync", "watch", "createWriteStream"])("latches caught mutation acquisition %s", method => {
    const f = fixture(), fs = f.memory.fs as any;
    expect(() => fs[method]("/app/src/value.ts", "changed")).toThrow("FORBIDDEN_ACQUISITION");
    expect(() => f.memory.assertCurrent()).toThrow("FORBIDDEN_ACQUISITION");
  });

  it("permits absent members inside the snapshot without acquiring a native file", () => {
    const f = fixture(), fs = f.memory.fs as any;
    expect(fs.existsSync("/app/missing.ts")).toBe(false);
    expect(() => fs.readFileSync("/app/missing.ts")).toThrow("ENOENT");
    expect(() => f.memory.assertCurrent()).not.toThrow();
    f.memory.revoke();
    expect(() => fs.readFileSync("/app/src/value.ts")).toThrow("REVOKED");
  });

  it("canonicalizes internal links and rejects escape/cycle links with a permanent latch", () => {
    const f = fixture();
    symlinkSync("value.ts", join(f.repository, "src/alias.ts"));
    symlinkSync("/etc/passwd", join(f.repository, "src/escape.ts"));
    symlinkSync("cycle.ts", join(f.repository, "src/cycle.ts"));
    const source = captureFilesystemSourceSnapshot(f.repository), memory = createSourceMemoryFs(source, f.runtime), fs = memory.fs as any;
    expect(fs.realpathSync("/app/src/alias.ts")).toBe("/app/src/value.ts");
    expect(fs.lstatSync("/app/src/alias.ts").isSymbolicLink()).toBe(true);
    expect(() => fs.readFileSync("/app/src/escape.ts")).toThrow("FORBIDDEN_ACQUISITION");
    expect(() => memory.assertCurrent()).toThrow("FORBIDDEN_ACQUISITION");
    const second = createSourceMemoryFs(source, f.runtime);
    expect(() => (second.fs as any).realpathSync("/app/src/cycle.ts")).toThrow("FORBIDDEN_ACQUISITION");
  });
});
