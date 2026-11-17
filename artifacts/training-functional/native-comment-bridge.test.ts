// SPEC: _spec/runtime-protocol.puml
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkNativeCommentBridge, NATIVE_MANIFEST_PATH, SPEC_POINTER_DELTAS } from "./native-comment-bridge";

const root = fileURLToPath(new URL("../../", import.meta.url));
const manifest = readFileSync(resolve(root, NATIVE_MANIFEST_PATH));
const read = (path: string) => readFileSync(resolve(root, path));
const check = (path: string, mutate: (bytes: Buffer) => Uint8Array) => checkNativeCommentBridge(manifest, candidate => candidate === path ? mutate(read(candidate)) : read(candidate));

test("current native bindings differ only by the six exact SPEC first lines", () => {
  const receipt = checkNativeCommentBridge(manifest, read);
  expect(receipt).toMatchObject({ members: 65, byteIdenticalMembers: 59, specPointerOnlyMembers: 6,
    nativeExecuted: false, numericalTestsRerun: false, historicalManifestChanged: false });
  expect(receipt.rows.filter(row => row.comparison === "EXACT_SPEC_POINTER_ONLY").map(row => row.path).sort())
    .toEqual(SPEC_POINTER_DELTAS.map(row => row.path).sort());
});

for (const delta of SPEC_POINTER_DELTAS) {
  test(`native bridge rejects any suffix change in ${delta.path}`, () => {
    expect(() => check(delta.path, bytes => Buffer.concat([bytes, Buffer.from("\n")]))).toThrow("RESTORED_HASH");
  });
}

test("native bridge rejects general comment normalization and newline changes", () => {
  const delta = SPEC_POINTER_DELTAS[0];
  expect(() => check(delta.path, bytes => Buffer.from(bytes.toString().replace(delta.current, delta.current + " ")))).toThrow("EXACT_FIRST_LINE");
  expect(() => check(delta.path, bytes => Buffer.from(bytes.toString().replace("\n", "\r\n")))).toThrow("EXACT_FIRST_LINE");
  expect(() => check(delta.path, bytes => Buffer.from(bytes.toString().replace(delta.current, delta.old)))).toThrow("EXACT_FIRST_LINE");
});

test("native bridge rejects drift outside the six explicitly selected files", () => {
  expect(() => check("crates/policy-io/src/bin/policy-initialize.rs", bytes => Buffer.concat([bytes, Buffer.from("\n")]))).toThrow("DIRECT_HASH");
});

test("native bridge preserves the exact accepted manifest instead of repinning it", () => {
  expect(() => checkNativeCommentBridge(Buffer.concat([manifest, Buffer.from("\n")]), read)).toThrow("MANIFEST_BINDING");
});
