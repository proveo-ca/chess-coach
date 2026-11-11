// SPEC: _spec/checkpoint-runtime.puml
import type {} from "bun";
import { createHash } from "node:crypto";
import { open } from "node:fs/promises";
import { z } from "zod";
import { decodeNativeIntents, nativeIntentsShape } from "../../contracts/src/native-intents";

export const CORPUS_MANIFEST_SHA256 = "31ac6f865340a95f8e85c2c1577aaea0aada87feb92a37637cda90aee288cc3f";
export const CORPUS_SOURCE_SHA256 = "e6770cb032aa76dc05432c7a49e61c4905d1a1f7b859aa860a090821213e7ae6";
export const CORPUS_SOURCE_BYTES = 664540;
const opening = "SCFEN|4k3/2pppp2/8/8/8/8/2PPPP2/4K3|0|33|P|G:11:11|B:3:3|Q:w:;b:";
const id = z.string().min(1).max(64), digest = z.string().regex(/^[a-f0-9]{64}$/);
const windowShape = z.strictObject({ planningOrdinal: z.int().min(0).max(63), sourcePlyIndex: z.int().min(0).max(127), sourceTurn: z.int().min(0).max(44), actions: nativeIntentsShape });
const traceShape = z.strictObject({ caseId: id, gameId: id, historicalResult: z.enum(["win", "draw"]), openingScfen: z.literal(opening), traceSha256: digest, windows: z.array(windowShape).max(64) });
const auditShape = z.object({ manifestSha256: z.literal(CORPUS_MANIFEST_SHA256), manifest: z.object({ openingScfen: z.literal(opening), expectedGames: z.literal(18),
  cases: z.array(z.object({ caseId: id, gameId: id, sourceIndex: z.int().min(0).max(17), traceSha256: digest, planningWindows: z.int().min(0).max(64) })).length(18) }),
  traces: z.array(traceShape).length(18) });
export type RecordedWindow = z.infer<typeof windowShape>;
type Audit = z.infer<typeof auditShape>;
const hash = (value: Uint8Array): string => createHash("sha256").update(value).digest("hex");

export class RecordedCorpus {
  private readonly audited: Audit;
  constructor(trustedAudit: unknown) {
    this.audited = auditShape.parse(trustedAudit);
    if (new Set(this.audited.traces.map(trace => trace.gameId)).size !== 18 || new Set(this.audited.traces.map(trace => trace.traceSha256)).size !== 18) throw new Error("Corpus: ROSTER");
    for (const [index, trace] of this.audited.traces.entries()) {
      const expected = this.audited.manifest.cases[index]!;
      if (trace.caseId !== `white-trace-${String(index + 1).padStart(2, "0")}` || trace.caseId !== expected.caseId || trace.gameId !== expected.gameId || expected.sourceIndex !== index ||
        trace.traceSha256 !== expected.traceSha256 || trace.windows.length !== expected.planningWindows) throw new Error("Corpus: CASE_BINDING");
      let sourcePly = -1;
      for (const [ordinal, window] of trace.windows.entries()) {
        if (window.planningOrdinal !== ordinal || window.sourcePlyIndex <= sourcePly) throw new Error("Corpus: ORDER");
        decodeNativeIntents(JSON.stringify(window.actions), "w");
        sourcePly = window.sourcePlyIndex;
      }
    }
  }
  window(caseIndex: number, ordinal: number): RecordedWindow | null {
    if (!Number.isSafeInteger(caseIndex) || caseIndex < 0 || caseIndex >= 18 || !Number.isSafeInteger(ordinal) || ordinal < 0 || ordinal > 63) throw new Error("Corpus: CURSOR");
    const window = this.audited.traces[caseIndex]!.windows[ordinal];
    return window ? structuredClone(window) : null;
  }
  checkConsumedPrefix(caseIndex: number, windows: readonly RecordedWindow[]): void {
    this.window(caseIndex, 0);
    if (windows.length > 64) throw new Error("Corpus: PREFIX_BOUND");
    for (const [ordinal, actual] of windows.entries()) {
      const expected = this.window(caseIndex, ordinal);
      if (expected === null || JSON.stringify(windowShape.parse(actual)) !== JSON.stringify(expected)) throw new Error("Corpus: PREFIX_MISMATCH");
    }
  }
}

export async function auditPinnedCorpus(manifest: Uint8Array, source: Uint8Array,
  audit: (manifest: Uint8Array, source: Uint8Array) => unknown): Promise<RecordedCorpus> {
  if (manifest.byteLength > 1048576 || hash(manifest) !== CORPUS_MANIFEST_SHA256 || source.byteLength !== CORPUS_SOURCE_BYTES || hash(source) !== CORPUS_SOURCE_SHA256) throw new Error("Corpus: INPUT_IDENTITY");
  return new RecordedCorpus(await audit(manifest.slice(), source.slice()));
}
async function boundedRead(path: string, limit: number): Promise<Uint8Array> {
  const handle = await open(path, "r");
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > limit) throw new Error("Corpus: FILE_BOUND");
    const bytes = new Uint8Array(stat.size + 1);
    let offset = 0;
    while (offset < bytes.length) {
      const result = await handle.read(bytes, offset, bytes.length - offset, null);
      if (!result.bytesRead) break;
      offset += result.bytesRead;
    }
    if (offset !== stat.size) throw new Error("Corpus: FILE_CHANGED");
    return bytes.slice(0, offset);
  } finally { await handle.close(); }
}
export async function loadCapturedCorpus(): Promise<RecordedCorpus> {
  const path = "/app/reference/packages/starchess-arena/src/challenge/corpus.ts";
  const api = await import(path);
  if (typeof api.auditCorpus !== "function") throw new Error("Corpus: AUDIT_EXPORT");
  const [manifest, source] = await Promise.all([boundedRead("/app/reference/_spec/corpora/ml-adjutant-corpus.manifest.json", 1048576),
    boundedRead("/app/reference/starchess-match-history-20260929-203446.json", CORPUS_SOURCE_BYTES)]);
  return auditPinnedCorpus(manifest, source, api.auditCorpus);
}
