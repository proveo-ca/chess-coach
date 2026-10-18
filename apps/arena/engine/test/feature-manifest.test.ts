// SPEC: _spec/apps/arena/burn-compat.puml
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

type Entry = { name: string; meaningId: string; scaleId: string };
type Manifest = { version: string; dimension: number; names: string[]; entries: Entry[]; scales: Record<string, number> };

const fixture = (): Manifest => JSON.parse(readFileSync(new URL("../../../../packages/training/tests/fixtures/feature-manifest-v3.json", import.meta.url), "utf8")) as Manifest;

test("actual legacy production manifest readout matches all 418 frozen metadata coordinates", () => {
  const readout = spawnSync(process.execPath, ["--import", "tsx", fileURLToPath(new URL("./feature-manifest-legacy.mjs", import.meta.url))], {
    cwd: fileURLToPath(new URL("../..", import.meta.url)), encoding: "utf8", timeout: 10_000, maxBuffer: 1_048_576,
    env: { PATH: process.env.PATH ?? "/usr/bin:/bin" },
  });
  assert.equal(readout.error, undefined);
  assert.equal(readout.signal, null);
  assert.equal(readout.status, 0, readout.stderr);
  assert.equal(readout.stderr, "");
  assert.ok(readout.stdout.length > 0);
  assert.ok(Buffer.byteLength(readout.stdout, "utf8") <= 1_048_576);
  assert.equal(readout.stdout, readout.stdout.trim());
  assert.ok(!readout.stdout.includes("\n"));
  const actual = JSON.parse(readout.stdout) as Manifest;
  assert.deepEqual(Object.keys(actual).sort(), ["dimension", "entries", "names", "scales", "version"]);
  assert.equal(actual.version, "challenge-feature-manifest-v3");
  assert.equal(actual.dimension, 418);
  assert.equal(actual.names.length, 418);
  assert.equal(actual.entries.length, 418);
  assert.equal(new Set(actual.names).size, 418);
  for (const [index, entry] of actual.entries.entries()) {
    assert.deepEqual(Object.keys(entry).sort(), ["meaningId", "name", "scaleId"]);
    assert.equal(entry.name, actual.names[index]);
  }
  assert.deepEqual(actual.scales, {
    minerals: 12, gas: 3, turn: 45, ccLives: 3, maxSpawn: 9, paid: 3072, replacement: 2304,
    coords: 7, squares: 64, actions: 4, pairs: 6, relationPairs: 4096, visionOverlap: 256, files: 8,
  });
  for (let position = 0; position < 4; position++) {
    assert.equal(actual.names[34 + 84 * position + 23], `position.${position}.promotion.p`);
  }
  assert.deepEqual(actual, fixture());
});
