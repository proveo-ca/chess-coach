// SPEC: _spec/checkpoint-runtime.puml, _spec/match-runtime.puml
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { expect, test } from "bun:test";
import { PrivateState } from "../src/private-state";

test("private retained journal refs bind actual exclusive cumulative bytes and global record ordinals", () => {
  const root = `${mkdtempSync("/tmp/opencode/chess-coach-ii-private-state-")}/packet`, state = new PrivateState(root);
  const first = state.attempt("first");
  const a = state.appendJournal("first", '{"ordinal":0,"kind":"synthetic"}\n');
  const second = state.attempt("second");
  const b = state.appendJournal("second", '{"ordinal":0,"kind":"synthetic"}\n{"ordinal":1,"kind":"synthetic"}\n');
  const bytes = Buffer.concat([readFileSync(`${first}/${readdirSync(first)[0]}`), readFileSync(`${second}/${readdirSync(second)[0]}`)]);
  expect(a.lastRecordOrdinal).toBe(1);
  expect(b.lastRecordOrdinal).toBe(3);
  expect(b.byteLength).toBe(bytes.byteLength);
  expect(b.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
  expect(bytes.toString()).toContain('"recordOrdinal":3');
  expect(state.usage().byteLength).toBe(128 * 1024 * 1024 + bytes.byteLength);
  expect(() => new PrivateState(root)).toThrow();
});

test("private write exhaustion and attempt reuse preserve earlier bytes and close the publisher", () => {
  const root = `${mkdtempSync("/tmp/opencode/chess-coach-ii-private-state-")}/packet`, state = new PrivateState(root);
  const path = state.attempt("first");
  state.write("first", "started", Buffer.from("retained"));
  expect(() => state.write("first", "oversize", new Uint8Array(64 * 1024 * 1024 + 1))).toThrow("BOUND");
  expect(readFileSync(`${path}/000000-started.bin`, "utf8")).toBe("retained");
  expect(() => state.attempt("retry")).toThrow("CLOSED");
  const other = new PrivateState(`${root}-other`);
  other.attempt("first");
  expect(() => other.attempt("first")).toThrow("REUSE");
  expect(other.usage().failed).toBe(true);
});

test("C15 predeclared packets retain C9 bounds and exhaustion closes every packet without replacement", () => {
  const root = `${mkdtempSync("/tmp/opencode/chess-coach-ii-private-state-")}/packet`, state = new PrivateState(root, 6);
  state.attempt("first", 0);
  state.attempt("last", 49);
  state.write("first", "retained", Buffer.from("a"));
  expect(state.usage().packets).toBe(2);
  expect(() => state.write("first", "exhausted", Buffer.from("b"))).toThrow("BOUND");
  expect(() => state.write("last", "retry", Buffer.from("c"))).toThrow("CLOSED");
  expect(() => state.attempt("replacement", 1)).toThrow("CLOSED");
});

test("journal record exhaustion preserves prior files and aborts without a truncated replacement", () => {
  const root = `${mkdtempSync("/tmp/opencode/chess-coach-ii-private-state-")}/packet`, state = new PrivateState(root);
  const path = state.attempt("first");
  state.write("first", "retained", Buffer.from("preserve"));
  const audit = Array.from({ length: 513 }, (_, ordinal) => JSON.stringify({ ordinal, kind: "synthetic" })).join("\n") + "\n";
  expect(() => state.appendJournal("first", audit)).toThrow("JOURNAL_FRAME");
  expect(readdirSync(path)).toEqual(["000000-retained.bin"]);
  expect(readFileSync(`${path}/000000-retained.bin`, "utf8")).toBe("preserve");
  expect(() => state.attempt("retry")).toThrow("CLOSED");
});
