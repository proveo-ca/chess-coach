// SPEC: _spec/runtime-protocol.puml, _spec/gate-closure.puml
import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
async function closure(entry: string): Promise<string[]> {
  const evidence = resolve(root, "artifacts/engine-layout");
  mkdirSync(evidence, { recursive: true });
  const output = mkdtempSync(resolve(evidence, "closure-"));
  const build = Bun.spawnSync([process.execPath, "--no-env-file", "--no-install", "build", "--target=bun", `--metafile=${output}/metafile.json`,
    `--outfile=${output}/audit-only.js`, "--external=/app/reference/*", resolve(root, entry)], { cwd: root, stdout: "pipe", stderr: "pipe", timeout: 10_000 });
  if (build.exitCode !== 0) throw new Error(new TextDecoder().decode(build.stderr));
  const metafile: { inputs: Record<string, unknown> } = JSON.parse(readFileSync(`${output}/metafile.json`, "utf8"));
  return Object.keys(metafile.inputs).map(path => resolve(root, path));
}

test("selected reference worker runtime closure cannot load the current resolver or producer as a reference", async () => {
  const paths = await closure("packages/runtime/src/reference-worker.ts");
  expect(paths).toContain(resolve(root, "packages/runtime/src/reference-driver.ts"));
  for (const forbidden of ["packages/runtime/src/current-driver.ts", "packages/contracts/src/game-session.ts", "packages/contracts/src/recipient.ts",
    "packages/game-core/src/resolve.ts", "packages/game-core/src/classical-resolution.ts", "packages/game-core/src/causal-producer.ts",
    "packages/starchess-core/src/resolve/submit-turn.ts", "packages/starchess-core/src/resolve/resolve-turn.ts",
    "packages/starchess-core/src/engine/resolve.ts", "packages/starchess-core/src/engine/classical-resolution.ts",
    "packages/starchess-core/src/engine/causal-producer.ts", "packages/starchess-core/src/engine/causal-events.ts"]) {
    expect(paths).not.toContain(resolve(root, forbidden));
  }
});

test("current driver uses the canonical product kernels without compatibility, AI or replay implementations", async () => {
  const paths = await closure("packages/runtime/src/current-driver.ts");
  for (const required of ["packages/starchess-core/src/resolve/submit-turn.ts", "packages/starchess-core/src/resolve/resolve-turn.ts",
    "packages/starchess-core/src/engine/causal-producer.ts", "packages/starchess-core/src/engine/causal-events.ts"]) {
    expect(paths).toContain(resolve(root, required));
  }
  for (const excluded of ["packages/game-core/src", "packages/starchess-core/src/ai", "packages/starchess-core/src/replay"]) {
    expect(paths.some(path => path.startsWith(resolve(root, excluded) + "/"))).toBe(false);
  }
});

test("selected native-proof workers exclude policy preparation, feature encoding and native learning dispatch", async () => {
  for (const entry of ["game-worker", "reference-worker", "job"]) {
    const paths = await closure(`packages/runtime/src/${entry}.ts`);
    expect(paths.some(path => path.startsWith(resolve(root, "packages/policy/src") + "/"))).toBe(false);
    for (const forbidden of ["policy-session", "native-learner", "learner-pair", "rng", "training-store", "curriculum", "corpus", "strategic",
      "match-worker", "match-worker-main", "match-session", "match-process", "frozen-scorer", "private-state", "training-coordinator", "fixed-attempt", "model-inputs", "storage-bounds"]) expect(paths).not.toContain(resolve(root, `packages/runtime/src/${forbidden}.ts`));
  }
});
