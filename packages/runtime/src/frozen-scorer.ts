// SPEC: _spec/match-runtime.puml, _spec/policy-io.puml
import type {} from "bun";
import { decodeScoreResponse, MAX_INFERENCE_BYTES } from "@chess-coach/contracts";
import type { ScoreRequest } from "@chess-coach/contracts";
import type { MatchScorer } from "./match-worker";

export class FrozenScorer implements MatchScorer {
  private child: Bun.Subprocess<"pipe", "pipe", "pipe"> | null = null;
  private closed = false;
  private busy = false;
  constructor(private readonly executable: string, private readonly config: string, private readonly record: string, private readonly modelId: string,
    private readonly clockNs: () => bigint, private readonly workDeadlineNs: bigint) {
    if (![executable, config, record].every(path => path.startsWith("/") && !path.includes("\0")) || !/^[a-f0-9]{64}$/.test(modelId)) throw new Error("Frozen scorer: CONFIGURATION");
  }
  async score(json: string): Promise<{ json: string; receivedNs: bigint }> {
    if (this.closed || this.busy) throw new Error("Frozen scorer: CLOSED_OR_PENDING");
    this.busy = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (Buffer.byteLength(json) > MAX_INFERENCE_BYTES || this.clockNs() >= this.workDeadlineNs) throw new Error("Frozen scorer: BOUND_OR_DEADLINE");
      const request: ScoreRequest = JSON.parse(json);
      if (request.modelId !== this.modelId) throw new Error("Frozen scorer: MODEL");
      const child = Bun.spawn([this.executable, this.config, this.record], { stdin: "pipe", stdout: "pipe", stderr: "pipe",
        env: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: "/nonexistent", RAYON_NUM_THREADS: "2" } });
      this.child = child;
      const read = async (stream: ReadableStream<Uint8Array>, limit: number): Promise<Uint8Array> => {
        let size = 0; const chunks: Uint8Array[] = [];
        for await (const chunk of stream) {
          size += chunk.byteLength;
          if (size > limit) throw new Error("Frozen scorer: OUTPUT_BOUND");
          chunks.push(chunk);
        }
        return Buffer.concat(chunks);
      };
      const exchange = Promise.all([read(child.stdout, 65536), read(child.stderr, 65536), child.exited,
        Promise.resolve().then(async () => { child.stdin.write(json); await child.stdin.end(); })]);
      const expired = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Frozen scorer: DEADLINE")), Number((this.workDeadlineNs - this.clockNs() + 999999n) / 1000000n)); });
      const [out, error, exit] = await Promise.race([exchange, expired]);
      const receivedNs = this.clockNs();
      if (this.closed || receivedNs >= this.workDeadlineNs || exit !== 0 || error.byteLength !== 0) throw new Error("Frozen scorer: EXIT_OR_DEADLINE");
      const response = new TextDecoder("utf-8", { fatal: true }).decode(out);
      decodeScoreResponse(response, request);
      this.child = null;
      return { json: response, receivedNs };
    } catch (error) { await this.shutdown(error); throw error; }
    finally { if (timer !== undefined) clearTimeout(timer); this.busy = false; }
  }
  async close(): Promise<void> {
    if (this.closed || this.busy || this.child !== null) throw new Error("Frozen scorer: CLOSE_PHASE");
    this.closed = true;
  }
  async shutdown(_reason: unknown): Promise<void> {
    this.closed = true;
    if (this.child !== null) {
      const child = this.child;
      if (child.exitCode === null) child.kill("SIGKILL");
      try { await child.stdin.end(); } catch {}
      await child.exited;
      this.child = null;
    }
  }
}
