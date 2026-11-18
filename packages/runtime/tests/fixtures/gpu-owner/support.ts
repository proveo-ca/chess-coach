// SPEC: _spec/gpu-owner.md, _spec/gpu-owner.puml
import { mkdirSync, mkdtempSync } from "node:fs";
import { resolve } from "node:path";

export function gpuOwnerTestRoot(label: string): string {
  const scratch = resolve(import.meta.dir, "../../../../..", "_work/gpu-owner-recovery/scratch");
  mkdirSync(scratch, { recursive: true, mode: 0o700 });
  return mkdtempSync(resolve(scratch, `${label}-`));
}
export const inputStream = (bytes: string | Uint8Array): ReadableStream<Uint8Array> => new ReadableStream({ start(controller) {
  controller.enqueue(typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes); controller.close();
} });
