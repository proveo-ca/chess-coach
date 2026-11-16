// SPEC: _spec/packages/starchess-arena/ml-adjutant-challenge-harness.puml
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { historyFromRecord, parseScFen, scOutcome, scsanOf, type EndScTurnResult, type ScActionInput } from "@chess-coach/starchess-core";
import { canonical, deepFreeze } from "./config";
import type { RecordedTrace, RecordedWindow } from "./types";

export const REPOSITORY_ROOT = new URL("../../../../", import.meta.url);
export const MANIFEST_SHA256 = "31ac6f865340a95f8e85c2c1577aaea0aada87feb92a37637cda90aee288cc3f";
export const sha256 = (value: string | Uint8Array): string => createHash("sha256").update(value).digest("hex");
export type SourceGame = {
  id: string; playerColor: "w"; opponent: string; result: "win" | "draw";
  scfens: string[]; resolves: EndScTurnResult[]; scsan: string[];
};
type ManifestCase = {
  caseId: string; gameId: string; sourceIndex: number; traceSha256: string;
  settledPlies: number; chipPlies: number; planningWindows: number; whiteActions: number;
  terminalTurn: number; historicalResult: string;
};
export type CorpusManifest = {
  version: number; sourcePath: string; sourceSha256: string; sourceBytes: number;
  sourceVersion: number; exportedAt: string; expectedGames: number; openingScfen: string;
  extractionVersion: string; cases: ManifestCase[];
  strategicSchedule: { arenaSeeds: number[]; candidateSides: ("w" | "b")[]; expectedMatches: number; feed: string; inferenceSeed: number };
};
export type AuditedCorpus = { manifest: CorpusManifest; manifestSha256: string; traces: RecordedTrace[] };
export type PinnedCorpusBytes = { readonly manifestBytes: Uint8Array; readonly sourceBytes: Uint8Array };

export const isChip = (resolve: EndScTurnResult): boolean => {
  if (!Array.isArray(resolve.events)) throw new Error("missing resolve events");
  return resolve.events.some((event) => event.id.startsWith("ev-begin-"));
};

export const extractWhiteWindows = (game: SourceGame): RecordedWindow[] => {
  if (game.scfens.length !== game.resolves.length + 1) throw new Error("snapshot/resolve cardinality mismatch");
  const windows: RecordedWindow[] = [];
  for (const [sourcePlyIndex, resolve] of game.resolves.entries()) {
    if (isChip(resolve)) continue;
    if (!Array.isArray(resolve.queue)) throw new Error(`missing planning queue at ply ${sourcePlyIndex}`);
    const actions: ScActionInput[] = resolve.queue.filter((action) => action.color === "w")
      .map(({ seq: _seq, ...action }) => action);
    windows.push({ planningOrdinal: windows.length, sourcePlyIndex,
      sourceTurn: parseScFen(game.scfens[sourcePlyIndex]!).turn, actions });
  }
  return windows;
};

export const auditCorpus = (manifestBytes: Uint8Array, sourceBytes: Uint8Array): AuditedCorpus => {
  if (sha256(manifestBytes) !== MANIFEST_SHA256) throw new Error("manifest pin mismatch");
  const manifest = JSON.parse(Buffer.from(manifestBytes).toString("utf8")) as CorpusManifest;
  if (sourceBytes.length !== manifest.sourceBytes || sha256(sourceBytes) !== manifest.sourceSha256) throw new Error("source pin mismatch");
  const source = JSON.parse(Buffer.from(sourceBytes).toString("utf8")) as { version: number; exportedAt: string; games: SourceGame[] };
  if (manifest.version !== 1 || manifest.expectedGames !== 18 || manifest.extractionVersion !== "white-planning-queues-v1" ||
    source.version !== manifest.sourceVersion || source.exportedAt !== manifest.exportedAt ||
    source.games.length !== 18 || manifest.cases.length !== 18) throw new Error("corpus header mismatch");
  const ids = new Set<string>();
  const hashes = new Set<string>();
  const traces = manifest.cases.map((entry, index): RecordedTrace => {
    const game = source.games[index]!;
    if (entry.sourceIndex !== index || game.id !== entry.gameId || game.playerColor !== "w" || game.opponent !== "strategic" ||
      game.scfens[0] !== manifest.openingScfen || ids.has(game.id)) throw new Error(`case identity mismatch: ${index}`);
    ids.add(game.id);
    const windows = extractWhiteWindows(game);
    const digest = sha256(JSON.stringify({ openingScfen: game.scfens[0],
      trace: windows.map(({ sourceTurn, actions }) => ({ sourceTurn, actions })) }));
    if (digest !== entry.traceSha256 || hashes.has(digest) || game.resolves.length !== entry.settledPlies ||
      game.resolves.filter(isChip).length !== entry.chipPlies || windows.length !== entry.planningWindows ||
      windows.reduce((sum, window) => sum + window.actions.length, 0) !== entry.whiteActions) throw new Error(`trace pin mismatch: ${entry.caseId}`);
    hashes.add(digest);
    for (const snapshot of game.scfens) parseScFen(snapshot);
    const history = historyFromRecord(game);
    const terminal = history.settledSnapshots.at(-1)!;
    if (history.settledSnapshots.length !== game.scfens.length || history.settledResolves.length !== game.resolves.length ||
      canonical(scsanOf(history.settledResolves)) !== canonical(game.scsan) || terminal.turn !== entry.terminalTurn ||
      game.result !== entry.historicalResult || canonical(scOutcome(terminal)) !== canonical(
        game.result === "win" ? { winner: "w", draw: false } : { winner: null, draw: true },
      )) throw new Error(`codec/outcome pin mismatch: ${entry.caseId}`);
    return { caseId: entry.caseId, gameId: game.id, historicalResult: game.result,
      openingScfen: manifest.openingScfen, traceSha256: digest, windows };
  });
  return deepFreeze({ manifest, manifestSha256: MANIFEST_SHA256, traces });
};

export const readPinnedCorpusBytes = (root: URL = REPOSITORY_ROOT): PinnedCorpusBytes => {
  const manifestBytes = readFileSync(new URL("_spec/corpora/ml-adjutant-corpus.manifest.json", root));
  if (sha256(manifestBytes) !== MANIFEST_SHA256) throw new Error("manifest pin mismatch");
  const manifest = JSON.parse(manifestBytes.toString("utf8")) as CorpusManifest;
  return { manifestBytes, sourceBytes: readFileSync(new URL(manifest.sourcePath, root)) };
};

export const loadPinnedCorpus = (
  root: URL = REPOSITORY_ROOT, bytes: PinnedCorpusBytes = readPinnedCorpusBytes(root),
): AuditedCorpus => auditCorpus(bytes.manifestBytes, bytes.sourceBytes);
