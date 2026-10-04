// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkPublicClosure } from "../packages/starchess-arena/hermetic/public-closure.mjs";

export { checkPublicClosure };

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.stdout.write(`${JSON.stringify(checkPublicClosure(), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ version: "public-closure-v1", passed: false, error: error.message })}\n`);
    process.exitCode = 1;
  }
}
