// SPEC: _spec/checkpoint-runtime.puml, _spec/match-runtime.puml
import { mkdirSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export function repositoryScratch(prefix: string): string {
  if (!/^[a-z0-9-]+$/.test(prefix)) throw new Error("Repository scratch: PREFIX");
  const parent = fileURLToPath(new URL("../../../artifacts/training-functional/scratch/", import.meta.url));
  mkdirSync(parent, { recursive: true, mode: 0o700 });
  return mkdtempSync(join(parent, prefix));
}
