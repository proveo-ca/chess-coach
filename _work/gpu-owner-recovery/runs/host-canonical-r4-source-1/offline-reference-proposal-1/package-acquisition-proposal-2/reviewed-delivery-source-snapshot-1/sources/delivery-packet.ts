// SPEC: _spec/runtime-protocol.puml
import * as fs from "node:fs";
import { join } from "node:path";
import { createDeliveryRuntime } from "./delivery-bootstrap.ts";
import type { DeliveryFileBinding, DeliveryRuntime } from "./delivery-bootstrap.ts";

export type LiteralClosure = { readonly scope: "OFFLINE_SYNTHETIC" | "LEAD_FROZEN_LITERAL_CLOSURE"; readonly paths: readonly string[] };
export async function buildLiteralPacket(closure: LiteralClosure, read: (path: string) => Uint8Array) {
  const api: DeliveryRuntime = await createDeliveryRuntime();
  api.need(closure.scope === "OFFLINE_SYNTHETIC" || closure.scope === "LEAD_FROZEN_LITERAL_CLOSURE", "explicit-literal-closure-scope-required");
  api.need(Array.isArray(closure.paths) && closure.paths.length > 0 && closure.paths.length <= api.constants.limits.files, "literal-closure-count");
  const seen = new Set<string>(), files = []; let aggregateBytes = 0;
  for (const path of closure.paths) {
    api.safePath(path); api.need(!seen.has(path), "duplicate-literal-member"); seen.add(path);
    const bytes = Buffer.from(read(path)); api.text(bytes);
    api.need(bytes.length <= api.constants.limits.file, "file-byte-cap");
    aggregateBytes += bytes.length; api.need(aggregateBytes <= api.constants.limits.source, "aggregate-source-cap");
    files.push({ path, ...api.identity(bytes), base64: bytes.toString("base64") });
  }
  const bytes = Buffer.from(JSON.stringify({ version: "chess-coach.literal-text-packet.v1", kind: "FIXED_LITERAL_TEXT_FILE_TABLE_NOT_A_RESOLVER", aggregateBytes, directories: api.directories(closure.paths), files }) + "\n");
  api.need(bytes.length <= api.constants.limits.packet, "packet-byte-cap");
  const table: DeliveryFileBinding[] = files.map(({ base64: _base64, ...binding }) => binding);
  const pin = api.identity(bytes); api.validatePacket(bytes, pin, table);
  return { bytes, pin, table };
}

export async function readLiteralText(root: string, relative: string): Promise<Buffer> {
  const api: DeliveryRuntime = await createDeliveryRuntime(); api.safePath(relative);
  const absolute = join(root, relative); api.ancestors(join(absolute, ".."));
  const fd = fs.openSync(absolute, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  let failure: unknown, bytes = Buffer.alloc(0);
  try {
    const before = fs.fstatSync(fd, { bigint: true });
    api.need(before.isFile() && before.size >= 0 && before.size <= BigInt(api.constants.limits.file), "bounded-regular-source");
    const buffer = Buffer.alloc(Number(before.size) + 1); let count = 0;
    while (count < buffer.length) { const got = fs.readSync(fd, buffer, count, buffer.length - count, null); if (!got) break; count += got; }
    const after = fs.fstatSync(fd, { bigint: true });
    api.need(count === Number(before.size) && before.ino === after.ino && before.dev === after.dev && before.size === after.size && before.mtimeNs === after.mtimeNs && before.ctimeNs === after.ctimeNs, "source-read-drift");
    bytes = buffer.subarray(0, count); api.text(bytes);
  } catch (error) { failure = error; }
  try { fs.closeSync(fd); } catch (error) { failure ??= error; }
  if (failure) throw failure; return bytes;
}
