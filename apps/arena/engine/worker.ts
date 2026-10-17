// SPEC: _spec/apps/arena/burn-compat.puml
import { pathToFileURL } from "node:url";
import { failure, handleRequest, INPUT_LIMIT, OUTPUT_LIMIT } from "./protocol";

export async function main(): Promise<number> {
  if (process.argv.length !== 2) {
    process.stdout.write(`${JSON.stringify(failure(null, "BAD_REQUEST", "The engine adapter accepts stdin only"))}\n`);
    return 2;
  }
  let text: string;
  try {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of process.stdin) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.length;
      if (size > INPUT_LIMIT) throw new Error("Request exceeds 64 KiB");
      chunks.push(bytes);
    }
    text = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
  } catch {
    process.stdout.write(`${JSON.stringify(failure(null, "BAD_REQUEST", "Invalid bounded stdin"))}\n`);
    return 2;
  }
  let value: unknown;
  try { value = JSON.parse(text); }
  catch {
    process.stdout.write(`${JSON.stringify(failure(null, "BAD_REQUEST", "Expected one JSON request"))}\n`);
    return 2;
  }
  const { exit, reply } = handleRequest(value);
  const output = `${JSON.stringify(reply)}\n`;
  if (Buffer.byteLength(output) > OUTPUT_LIMIT) {
    process.stdout.write(`${JSON.stringify(failure(null, "ENGINE_FAILURE", "Engine reply exceeds its bound"))}\n`);
    return 1;
  }
  process.stdout.write(output);
  return exit;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main();
