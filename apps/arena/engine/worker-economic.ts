// SPEC: _spec/apps/arena/burn-compat.puml
import { pathToFileURL } from "node:url";
import { EconomicReplay } from "./economic-replay";
import {
  ECONOMIC_PROTOCOL, ECONOMIC_REPLY_LIMIT, ECONOMIC_REQUEST_LIMIT, economicFailure,
  parseEconomicJson, parseEconomicRequest, type EconomicReply, type EconomicResult,
} from "./economic-wire";
import { EngineErrorV2 } from "./wire-v2";

export const ECONOMIC_STDERR_LIMIT = 65_536;

export class EconomicWorker {
  #lastId = -1;
  #replay = new EconomicReplay();
  #closed = false;

  get clean(): boolean { return this.#closed && !this.#replay.active; }

  handle(value: unknown): EconomicReply {
    let id: number | null = null;
    try {
      const request = parseEconomicRequest(value);
      id = request.id;
      if (id <= this.#lastId) throw new EngineErrorV2("BAD_REQUEST", "Request IDs must increase strictly");
      this.#lastId = id;
      let result: EconomicResult;
      switch (request.op) {
        case "economic.start": result = this.#replay.start(request.fixture); this.#closed = false; break;
        case "economic.open": result = this.#replay.open(request.planningOrdinal); break;
        case "economic.settle": result = this.#replay.settle(request.context, request.requests); break;
        case "economic.close": result = this.#replay.close(); this.#closed = true; break;
      }
      return { protocol: ECONOMIC_PROTOCOL, id, ok: true, result };
    } catch (error) { return economicFailure(id, error); }
  }
}

export class EconomicLineDecoder {
  #parts: Uint8Array[] = [];
  #bytes = 0;

  *push(chunk: Uint8Array): Generator<string> {
    let start = 0;
    for (let i = 0; i < chunk.length; i++) {
      if (chunk[i] !== 10) continue;
      this.#append(chunk.subarray(start, i));
      let line: string;
      try { line = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(Buffer.concat(this.#parts)); }
      catch { throw new EngineErrorV2("BAD_REQUEST", "Invalid UTF-8 request"); }
      this.#parts = []; this.#bytes = 0; start = i + 1;
      yield line;
    }
    this.#append(chunk.subarray(start));
  }

  #append(chunk: Uint8Array): void {
    if (this.#bytes + chunk.byteLength >= ECONOMIC_REQUEST_LIMIT) throw new EngineErrorV2("LIMIT", "Request exceeds 64 KiB");
    if (chunk.byteLength) this.#parts.push(Uint8Array.from(chunk));
    this.#bytes += chunk.byteLength;
  }

  finish(): void {
    if (this.#bytes) throw new EngineErrorV2("BAD_REQUEST", "Unexpected EOF inside a request");
  }
}

export function encodeEconomicReply(reply: EconomicReply): string {
  const line = `${JSON.stringify(reply)}\n`;
  if (Buffer.byteLength(line) > ECONOMIC_REPLY_LIMIT) throw new EngineErrorV2("LIMIT", "Economic reply exceeds 1 MiB");
  return line;
}

export async function runEconomicNdjson(input: AsyncIterable<Uint8Array>, write: (line: string) => Promise<void>, diagnostic: (message: string) => void): Promise<number> {
  const worker = new EconomicWorker(); const decoder = new EconomicLineDecoder();
  let outputFailed = false; let diagnosticBytes = 0;
  const diagnose = (message: string): void => {
    const bytes = Buffer.byteLength(message);
    if (diagnosticBytes + bytes <= ECONOMIC_STDERR_LIMIT) { diagnostic(message); diagnosticBytes += bytes; }
  };
  const output = async (reply: EconomicReply): Promise<void> => {
    const line = encodeEconomicReply(reply);
    try { await write(line); } catch (error) { outputFailed = true; throw error; }
  };
  try {
    for await (const chunk of input) for (const line of decoder.push(chunk)) {
      const reply = worker.handle(parseEconomicJson(line));
      await output(reply);
      if (!reply.ok && (reply.error.code === "BAD_REQUEST" || reply.error.code === "LIMIT")) return reply.error.code === "BAD_REQUEST" ? 2 : 1;
    }
    decoder.finish();
    if (!worker.clean) { diagnose("Economic EOF requires a closed engine\n"); return 1; }
    return 0;
  } catch (error) {
    if (!outputFailed) {
      try { await output(economicFailure(null, error)); }
      catch { diagnose("Economic output terminated\n"); return 1; }
    }
    diagnose("Economic transport terminated\n");
    return error instanceof EngineErrorV2 && error.packet.code === "BAD_REQUEST" ? 2 : 1;
  }
}

export async function mainEconomic(): Promise<number> {
  const write = (line: string): Promise<void> => new Promise((resolve, reject) => {
    process.stdout.write(line, error => error ? reject(error) : resolve());
  });
  if (process.argv.length !== 2) {
    await write(encodeEconomicReply(economicFailure(null, new EngineErrorV2("BAD_REQUEST", "The economic adapter accepts stdin only"))));
    return 2;
  }
  return runEconomicNdjson(process.stdin, write, message => { process.stderr.write(message); });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await mainEconomic();
