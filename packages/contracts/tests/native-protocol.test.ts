// SPEC: _spec/runtime-protocol.puml
import { expect, test } from "bun:test";
import { decodeNativeReply, decodeNativeRequest, MAX_NATIVE_MESSAGE_BYTES, nativeProtocolJsonSchema } from "../src/native-protocol";
import { NativeWorker } from "../../runtime/src/worker";
import { currentGameDriver } from "../../runtime/src/current-driver";

test("native protocol accepts actual bounded initial data but no code selectors or self-issued authority", () => {
  const request = { version: "chess-coach.native.v1", sessionId: "test", ordinal: 0, cursor: -1, operation: "init" } as const;
  expect(decodeNativeRequest(JSON.stringify(request))).toEqual(request);
  const worker = new NativeWorker("main", "native-proof", "test", currentGameDriver);
  expect(decodeNativeReply(worker.handle(JSON.stringify(request)))).toMatchObject({ kind: "staged", stagedCursor: 0, role: "main" });
  for (const extra of [{ verified: true }, { trainingReady: true }, { executable: "/bad" }, { snapshot: {} }, { expectedDigest: "0".repeat(64) }]) {
    expect(() => decodeNativeRequest(JSON.stringify({ ...request, ...extra }))).toThrow();
  }
  expect(nativeProtocolJsonSchema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
});

test("native codec rejects oversized raw text before parsing and wrong BOTH recipient pairing", () => {
  expect(() => decodeNativeRequest(" ".repeat(MAX_NATIVE_MESSAGE_BYTES + 1))).toThrow(RangeError);
  const worker = new NativeWorker("main", "native-proof", "test", currentGameDriver);
  const reply = JSON.parse(worker.handle(JSON.stringify({ version: "chess-coach.native.v1", sessionId: "test", ordinal: 0, cursor: -1, operation: "init" })));
  reply.boundary.batches.b = reply.boundary.batches.w;
  expect(() => decodeNativeReply(JSON.stringify(reply))).toThrow("pair mismatch");
});
