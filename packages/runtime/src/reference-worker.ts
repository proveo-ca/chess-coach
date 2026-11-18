// SPEC: _spec/runtime-protocol.puml
import type {} from "bun";
import { loadCapturedReferenceProofDriver } from "./reference-driver";
import { workerMain } from "./worker-loop";

if (import.meta.main) {
  try { await workerMain("reference", await loadCapturedReferenceProofDriver(), "native-proof"); }
  catch (error) { await Bun.write(Bun.stderr, String(error) + "\n"); process.exitCode = 1; }
}
