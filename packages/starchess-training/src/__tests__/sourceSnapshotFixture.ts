// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { captureFilesystemSourceSnapshot } from "../coordinator/sourceManifest";
import { captureFilesystemRuntimeSnapshot } from "../coordinator/sourceRuntimeSnapshot";

export const sourceSnapshotFixture = (files: Readonly<Record<string, string>>, compiler = false) => {
  const preferred = "/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode";
  const directory = mkdtempSync(join(existsSync(preferred) ? preferred : tmpdir(), "b1-memory-"));
  const repository = join(directory, "repository"), store = join(directory, "store"), tools = join(directory, "tools");
  for (const root of [repository, store, tools, ...["", "packages/starchess-core", "packages/starchess-arena", "packages/starchess-training"]
    .map(owner => join(repository, owner, "node_modules"))]) mkdirSync(root, { recursive: true });
  for (const [path, bytes] of Object.entries(files)) {
    mkdirSync(dirname(join(repository, path)), { recursive: true });
    writeFileSync(join(repository, path), bytes);
  }
  if (compiler) {
    const require = createRequire(import.meta.url), installed = dirname(require.resolve("typescript"));
    const target = join(repository, "node_modules/typescript/lib");
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, "typescript.js"), readFileSync(join(installed, "typescript.js")));
    writeFileSync(join(target, "../package.json"), readFileSync(join(installed, "../package.json")));
    for (const name of ["starchess-core", "starchess-arena", "starchess-training"]) {
      symlinkSync("../../../node_modules/typescript", join(repository, `packages/${name}/node_modules/typescript`));
    }
  }
  return { directory, repository, store, tools, source: captureFilesystemSourceSnapshot(repository),
    runtime: captureFilesystemRuntimeSnapshot(repository, store, tools) };
};
