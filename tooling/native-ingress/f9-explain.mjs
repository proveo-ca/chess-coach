// SPEC: _spec/tooling/native-ingress/f9-diagnostic.puml
import fs, { constants } from "node:fs";
import { isAbsolute, normalize } from "node:path";
import { formatDiagnosticSummary } from "./f9-summary.mjs";

const refusal = "Executor, STOP: saved report could not be explained; F9 remains unqualified; trainingReady=false.";
const cap = 128 * 1024;
const metadata = ["dev", "ino", "size", "mtimeNs", "ctimeNs", "mode", "nlink"];

export function readDiagnosticReport(reportPath) {
  try {
    if (typeof reportPath !== "string" || Buffer.byteLength(reportPath) > 4096
      || [...reportPath].some((character) => character.charCodeAt(0) < 32 || (character.charCodeAt(0) >= 127 && character.charCodeAt(0) <= 159)) || !isAbsolute(reportPath)
      || normalize(reportPath) !== reportPath || reportPath.endsWith("/")) throw new Error(refusal);
    const fd = fs.openSync(reportPath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const before = fs.fstatSync(fd, { bigint: true });
      if (!before.isFile() || before.size > BigInt(cap)) throw new Error(refusal);
      const buffer = Buffer.alloc(cap + 1);
      let bytes = 0;
      while (bytes < buffer.length) {
        const count = fs.readSync(fd, buffer, bytes, buffer.length - bytes, null);
        if (count === 0) break;
        bytes += count;
      }
      if (bytes > cap) throw new Error(refusal);
      const after = fs.fstatSync(fd, { bigint: true });
      if (metadata.some((key) => before[key] !== after[key]) || BigInt(bytes) !== before.size) throw new Error(refusal);
      return JSON.parse(buffer.toString("utf8", 0, bytes));
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    throw new Error(refusal);
  }
}

export function main(argv) {
  try {
    let reportPath;
    if (Array.isArray(argv) && argv.length === 2 && argv[0] === "--report" && typeof argv[1] === "string") reportPath = argv[1];
    else if (Array.isArray(argv) && argv.length === 1 && typeof argv[0] === "string" && argv[0].startsWith("--report=")) reportPath = argv[0].slice(9);
    else throw new Error(refusal);
    const summary = formatDiagnosticSummary(readDiagnosticReport(reportPath));
    process.stdout.write(summary);
  } catch {
    process.stderr.write(`${refusal}\n`);
  }
  return 2;
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
