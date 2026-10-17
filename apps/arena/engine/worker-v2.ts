// SPEC: _spec/apps/arena/burn-compat.puml
import { pathToFileURL } from "node:url";
import { PlanningManager } from "./planning";
import { NativeReplay } from "./replay";
import { PrivateSession } from "./session";
import { EngineErrorV2, failureV2, parseRequestV2, PROTOCOL_V2, type ReplyV2 } from "./wire-v2";

export const INPUT_LIMIT_V2 = 64 * 1024;
export const OUTPUT_LIMIT_V2 = 1024 * 1024;

export class WorkerV2 {
  #lastId = -1;
  #session = new PrivateSession();
  #replay = new NativeReplay();
  #planning = new PlanningManager();

  get clean(): boolean { return !this.#session.active && !this.#replay.active && this.#planning.liveContexts === 0; }

  handle(value: unknown): ReplyV2 {
    let id: number | null = null;
    try {
      const request = parseRequestV2(value);
      id = request.id;
      if (id <= this.#lastId) throw new EngineErrorV2("BAD_REQUEST", "Request IDs must increase strictly");
      this.#lastId = id;
      let result: unknown;
      switch (request.op) {
        case "session.start": case "replay.start": {
          if (this.#session.active || this.#replay.active) throw new EngineErrorV2("STATE", "An engine is already active");
          result = (request.op === "session.start" ? this.#session : this.#replay).start(request.fixture);
          break;
        }
        case "session.open": result = this.#session.open(request.session, request.planningOrdinal); break;
        case "replay.open": result = this.#replay.open(request.session, request.planningOrdinal); break;
        case "session.commit": result = this.#session.commit(request.context, request.requests); break;
        case "replay.commit": result = this.#replay.commit(request.context, request.requests); break;
        case "session.close": result = this.#session.close(request.session); break;
        case "replay.close": result = this.#replay.close(request.session); break;
        case "plan.open": result = this.#planning.open(request.view); break;
        case "plan.next": result = this.#planning.next(request.planning, request.pulls); break;
        case "plan.close": result = this.#planning.close(request.planning); break;
      }
      return { protocol: PROTOCOL_V2, id, ok: true, result };
    } catch (error) { return failureV2(id, error); }
  }
}

export class LineDecoderV2 {
  #parts: Uint8Array[] = [];
  #bytes = 0;

  *push(chunk: Uint8Array): Generator<string> {
    let start = 0;
    for (let i = 0; i < chunk.length; i++) {
      if (chunk[i] !== 10) continue;
      this.#append(chunk.subarray(start, i));
      if (this.#bytes + 1 > INPUT_LIMIT_V2) throw new EngineErrorV2("BAD_REQUEST", "Request exceeds 64 KiB");
      let line: string;
      try { line = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(Buffer.concat(this.#parts)); }
      catch { throw new EngineErrorV2("BAD_REQUEST", "Invalid UTF-8 request"); }
      this.#parts = [];
      this.#bytes = 0;
      start = i + 1;
      yield line;
    }
    this.#append(chunk.subarray(start));
  }

  #append(chunk: Uint8Array): void {
    if (this.#bytes + chunk.byteLength >= INPUT_LIMIT_V2) throw new EngineErrorV2("BAD_REQUEST", "Request exceeds 64 KiB");
    if (chunk.byteLength) this.#parts.push(Uint8Array.from(chunk));
    this.#bytes += chunk.byteLength;
  }

  finish(): void {
    if (this.#bytes) throw new EngineErrorV2("BAD_REQUEST", "Unexpected EOF inside a request");
  }
}

export function encodeReplyV2(reply: ReplyV2): string {
  const line = `${JSON.stringify(reply)}\n`;
  return Buffer.byteLength(line) <= OUTPUT_LIMIT_V2 ? line : `${JSON.stringify(failureV2(reply.id, new EngineErrorV2("ENGINE_FAILURE", "Engine reply exceeds 1 MiB")))}\n`;
}

export async function runNdjsonV2(input: AsyncIterable<Uint8Array>, write: (line: string) => Promise<void>, diagnostic: (message: string) => void): Promise<number> {
  const worker = new WorkerV2();
  const decoder = new LineDecoderV2();
  let outputFailed = false;
  const output = async (reply: ReplyV2): Promise<void> => {
    try { await write(encodeReplyV2(reply)); }
    catch (error) { outputFailed = true; throw error; }
  };
  try {
    for await (const chunk of input) {
      for (const line of decoder.push(chunk)) {
        let value: unknown;
        try { value = JSON.parse(line); }
        catch { throw new EngineErrorV2("BAD_REQUEST", "Expected one JSON request per line"); }
        const reply = worker.handle(value);
        await output(reply);
        if (!reply.ok && reply.error.code === "BAD_REQUEST") return 2;
      }
    }
    decoder.finish();
    if (!worker.clean) {
      diagnostic("Engine EOF requires closed engine and planning contexts\n");
      return 1;
    }
    return 0;
  } catch (error) {
    if (!outputFailed) {
      try { await output(failureV2(null, error)); }
      catch { diagnostic("Engine output terminated\n"); return 1; }
    }
    diagnostic("Engine transport terminated\n");
    return error instanceof EngineErrorV2 && error.packet.code === "BAD_REQUEST" ? 2 : 1;
  }
}

export async function mainV2(): Promise<number> {
  const write = (line: string): Promise<void> => new Promise((resolve, reject) => {
    process.stdout.write(line, error => error ? reject(error) : resolve());
  });
  if (process.argv.length !== 2) {
    await write(encodeReplyV2(failureV2(null, new EngineErrorV2("BAD_REQUEST", "The engine adapter accepts stdin only"))));
    return 2;
  }
  return runNdjsonV2(process.stdin, write, message => { process.stderr.write(message); });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await mainV2();
