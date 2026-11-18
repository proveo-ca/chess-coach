// SPEC: _spec/gate-closure.puml
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { expect, test } from "bun:test";
import { checkArtifactManifest, verifyArtifactFiles } from "../src/artifacts";
import type { ArtifactManifest } from "../src/artifacts";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const bounds = { manifestBytes: 4096, files: 4, fileBytes: 1024, totalBytes: 2048 };
const selected = (): ArtifactManifest => ({ version: "chess-coach.runtime-files.v1", files: [{ path: "fixed/main.ts", byteLength: 4, sha256: hash("main") }, { path: "fixed/reference.ts", byteLength: 9, sha256: hash("reference") }] });

test("independently pinned manifest selects exact required bytes before any output claim", async () => {
  const manifest = selected(), json = JSON.stringify(manifest), checked = checkArtifactManifest(json, hash(json), ["fixed/main.ts", "fixed/reference.ts"], bounds);
  const root = mkdtempSync("/tmp/opencode/chess-coach-ii-artifacts-");
  mkdirSync(`${root}/fixed`);
  writeFileSync(`${root}/fixed/main.ts`, "main"); writeFileSync(`${root}/fixed/reference.ts`, "reference");
  await verifyArtifactFiles(root, checked, bounds);
  writeFileSync(`${root}/fixed/main.ts`, "fake");
  await expect(verifyArtifactFiles(root, checked, bounds)).rejects.toThrow("CONTENT");
  writeFileSync(`${root}/fixed/main.ts`, "larger");
  await expect(verifyArtifactFiles(root, checked, bounds)).rejects.toThrow("LENGTH");
});

test("worker-nominated expectations, missing roles, paths, duplicates and byte exhaustion fail", () => {
  const manifest = selected(), json = JSON.stringify(manifest);
  expect(() => checkArtifactManifest(json.replace("main.ts", "other.ts"), hash(json), [], bounds)).toThrow("EXPECTATION");
  expect(() => checkArtifactManifest(json, hash(json), ["other.ts"], bounds)).toThrow("MISSING_ROLE");
  for (const path of ["../escape", "/absolute", "fixed/../escape", "fixed\\escape"]) {
    const bad = selected(); bad.files[0]!.path = path;
    const value = JSON.stringify(bad);
    expect(() => checkArtifactManifest(value, hash(value), [], bounds)).toThrow();
  }
  const duplicate = selected(); duplicate.files[1] = duplicate.files[0]!;
  const value = JSON.stringify(duplicate);
  expect(() => checkArtifactManifest(value, hash(value), [], bounds)).toThrow("ORDER");
  expect(() => checkArtifactManifest(json, hash(json), [], { ...bounds, totalBytes: 8, fileBytes: 8 })).toThrow("BOUND");
  expect(() => checkArtifactManifest(json, hash(json), [], { ...bounds, manifestBytes: 4 })).toThrow("MANIFEST_BOUND");
});

test("selected paths cannot traverse a substituted symlink or directory", async () => {
  const root = mkdtempSync("/tmp/opencode/chess-coach-ii-artifacts-");
  mkdirSync(`${root}/target`); writeFileSync(`${root}/target/main.ts`, "main");
  symlinkSync(`${root}/target`, `${root}/fixed`);
  await expect(verifyArtifactFiles(root, selected(), bounds)).rejects.toThrow("FILE_KIND");
});
