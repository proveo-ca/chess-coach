// SPEC: _spec/runtime-protocol.puml
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const HOSTROOT = "/home/gu1lty/Projects/proveo/chess-coach";
export const D = "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1";
export const R2 = `${D}/package-acquisition-proposal-2`;
export const S2 = `${D}/package-acquisition-bun-source2`;
export const HANDOFF = "_work/gpu-owner-recovery/runs/reference-package-handoff-2";
export const READ_ROOT = `${HOSTROOT}/${HANDOFF}/snapshot`;
export const OBSERVER = `${R2}/acquisition-invocation-1`;
export const MANUAL_CALLER_ARGS = Object.freeze(["execute"] as const);
export const APPROVAL_SHA256 = "4e68d36f8076e213744364cf4cd5f793ef3dbffda6157b93070edf2ffc282d3f";
export type RootContext = Readonly<{ readRoot: string; operationRoot: string; observerRoot: string }>;

export function productionRootContext(): RootContext {
  const own = fileURLToPath(import.meta.url);
  const readRoot = resolve(dirname(own), ...S2.split("/").map(() => ".."));
  if (own !== join(READ_ROOT, S2, "root-context.ts") || readRoot !== READ_ROOT) throw new Error("fixed-snapshot-root-required");
  return Object.freeze({ readRoot, operationRoot: HOSTROOT, observerRoot: join(readRoot, OBSERVER) });
}
export function assertProductionContext(context: RootContext): void {
  const fixed = productionRootContext();
  if (context.readRoot !== fixed.readRoot || context.operationRoot !== fixed.operationRoot || context.observerRoot !== fixed.observerRoot) throw new Error("fixed-production-context-required");
}
export function validateBunRuntime(): string {
  if (process.versions["bun"] !== "1.4.0" || !process.execArgv.includes("--no-env-file") || !process.execArgv.includes("--no-install")) throw new Error("version-checked-bun-required");
  return process.execPath;
}
