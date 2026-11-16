// SPEC: _spec/runtime-protocol.puml
import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { HOSTROOT, D, R2, S2, HANDOFF, READ_ROOT, OBSERVER, MANUAL_CALLER_ARGS, APPROVAL_SHA256, productionRootContext } from "./root-context.ts";
import type { RootContext } from "./root-context.ts";

test("root matrix keeps snapshot reads and observer distinct from fixed host operations", () => {
  const fixture: RootContext = Object.freeze({ readRoot: join(HOSTROOT, S2), operationRoot: join(HOSTROOT, S2, "fullverification-999/fixtures"), observerRoot: join(HOSTROOT, S2, "fullverification-999/fixtures/observer") });
  assert.notEqual(fixture.readRoot, READ_ROOT);
  assert.equal(READ_ROOT, join(HOSTROOT, HANDOFF, "snapshot"));
  assert.equal(OBSERVER, `${R2}/acquisition-invocation-1`);
  assert.equal(R2, `${D}/package-acquisition-proposal-2`);
  assert.equal(S2, `${D}/package-acquisition-bun-source2`);
  assert.deepEqual(MANUAL_CALLER_ARGS, ["execute"]); assert.equal(Object.isFrozen(MANUAL_CALLER_ARGS), true);
});
test("production context rejects development checkout without touching filesystem", () => {
  assert.throws(() => productionRootContext(), /fixed-snapshot-root-required/);
});
test("production root factory has no runtime override or mutation APIs", () => {
  const text = readFileSync(new URL("./root-context.ts", import.meta.url), "utf8");
  for (const forbidden of ["process.env", "mkdir", "spawn(", "https", "readFile", "/usr/local/bin"]) assert.equal(text.includes(forbidden), false, forbidden);
  assert.equal(APPROVAL_SHA256, "4e68d36f8076e213744364cf4cd5f793ef3dbffda6157b93070edf2ffc282d3f");
});
