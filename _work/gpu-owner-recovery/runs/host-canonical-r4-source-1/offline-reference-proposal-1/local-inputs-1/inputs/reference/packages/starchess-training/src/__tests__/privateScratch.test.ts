// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml, _spec/packages/starchess-training/r4-host-verification.puml
import { lstatSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPrivateScratch, createScratchSourceRoot } from "./privateScratch";

const directories: string[] = [];
const fixture = () => {
  const directory = createPrivateScratch("private-scratch-test-");
  directories.push(directory);
  return directory;
};
afterEach(() => {
  vi.unstubAllEnvs();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("portable private test scratch", () => {
  it("creates distinct canonical 0700 children without changing the temporary parent mode", () => {
    const temporary = realpathSync(tmpdir()), mode = lstatSync(temporary).mode;
    const first = fixture(), second = fixture();
    expect(first).not.toBe(second);
    for (const directory of [first, second]) {
      expect(dirname(directory)).toBe(temporary);
      expect(realpathSync(directory)).toBe(directory);
      expect(lstatSync(directory).isDirectory()).toBe(true);
      expect(lstatSync(directory).mode & 0o7777).toBe(0o700);
    }
    expect(lstatSync(temporary).mode).toBe(mode);
  });

  it("canonicalizes symlink-selected TMPDIR without changing the link or shared target mode", () => {
    const directory = fixture(), temporary = createScratchSourceRoot(directory, "temporary"), selected = join(directory, "selected");
    symlinkSync(temporary, selected, "dir");
    const targetMode = lstatSync(temporary).mode, linkMode = lstatSync(selected).mode;
    vi.stubEnv("TMPDIR", selected);
    const child = createPrivateScratch("captured-");
    expect(dirname(child)).toBe(temporary);
    expect(realpathSync(child)).toBe(child);
    expect(lstatSync(child).mode & 0o7777).toBe(0o700);
    expect(lstatSync(temporary).mode).toBe(targetMode);
    expect(lstatSync(selected).isSymbolicLink()).toBe(true);
    expect(lstatSync(selected).mode).toBe(linkMode);
  });

  it("rejects relative, missing and file-selected TMPDIR without changing existing entries", () => {
    const directory = fixture(), file = join(directory, "file");
    writeFileSync(file, "preserved");
    const entries = readdirSync(directory), mode = lstatSync(file).mode;
    for (const selected of ["relative", join(directory, "missing"), file]) {
      vi.stubEnv("TMPDIR", selected);
      expect(() => createPrivateScratch("captured-")).toThrow();
    }
    expect(readdirSync(directory)).toEqual(entries);
    expect(readFileSync(file, "utf8")).toBe("preserved");
    expect(lstatSync(file).mode).toBe(mode);
  });

  it("creates 0755 source roots only beneath owned private children and leaves existing links untouched", () => {
    const directory = fixture(), root = createScratchSourceRoot(directory, "source");
    expect(dirname(root)).toBe(directory);
    expect(lstatSync(root).mode & 0o7777).toBe(0o755);
    expect(lstatSync(directory).mode & 0o7777).toBe(0o700);
    expect(() => createScratchSourceRoot(root, "foreign")).toThrow("PRIVATE_SCRATCH_OWNER");
    const link = join(directory, "selected");
    symlinkSync(root, link, "dir");
    const mode = lstatSync(root).mode;
    expect(() => createScratchSourceRoot(directory, "selected")).toThrow();
    expect(lstatSync(link).isSymbolicLink()).toBe(true);
    expect(lstatSync(root).mode).toBe(mode);
  });

  it.each(["", ".", "..", "../outside", "/absolute", "nested/name", "nested\\name", "nul\0name"])("rejects unsafe child name %j", name => {
    const directory = fixture(), entries = readdirSync(directory);
    expect(() => createPrivateScratch(name)).toThrow("PRIVATE_SCRATCH_NAME");
    expect(() => createScratchSourceRoot(directory, name)).toThrow("PRIVATE_SCRATCH_NAME");
    expect(readdirSync(directory)).toEqual(entries);
  });
});
