// SPEC: _spec/_plans/game-export-localstorage.puml, _spec/apps/starchess/replay-import.puml, _spec/packages/starchess-core/record-packing.puml
// WHAT: history export envelope — copy stored records to one JSON file.
import { unpackRecord } from "@chess-coach/starchess-core";

import type { StarChessGameRecord } from "~/types/review";

export const HISTORY_EXPORT_VERSION = 1;

export type HistoryExportEnvelope = {
  version: typeof HISTORY_EXPORT_VERSION;
  exportedAt: string;
  games: StarChessGameRecord[];
};

// WHAT: copy stored records, preserve result/opponent/scfens/resolves.
// The file is for people and other tools: resolves go out plain, not packed.
export const buildHistoryExport = (
  games: readonly StarChessGameRecord[],
  now: string = new Date().toISOString(),
): HistoryExportEnvelope => ({
  version: HISTORY_EXPORT_VERSION,
  exportedAt: now,
  games: games.map((g) => {
    const plain = unpackRecord(g);
    return { ...plain, scfens: [...plain.scfens], resolves: [...plain.resolves] };
  }),
});

export const serializeHistoryExport = (
  envelope: HistoryExportEnvelope,
): string => JSON.stringify(envelope);

// WHAT: file name for the downloaded history copy.
export const historyExportFilename = (
  now: Date = new Date(),
): string => {
  const pad = (n: number): string => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `starchess-match-history-${stamp}.json`;
};

// WHAT: trigger a JSON file download for the envelope copy.
export const downloadHistoryExport = (
  envelope: HistoryExportEnvelope,
  filename: string = historyExportFilename(),
): void => {
  if (typeof document === "undefined") return;
  const blob = new Blob([serializeHistoryExport(envelope)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const isRecord = (value: unknown): value is StarChessGameRecord => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const r = value as Record<string, unknown>;
  if (typeof r["id"] !== "string" || (r["id"] as string).trim() === "") {
    return false;
  }
  if (typeof r["startedAt"] !== "string" || typeof r["endedAt"] !== "string") {
    return false;
  }
  if (r["result"] !== "win" && r["result"] !== "loss" && r["result"] !== "draw") {
    return false;
  }
  if (r["playerColor"] !== "w" && r["playerColor"] !== "b") {
    return false;
  }
  if (typeof r["map"] !== "string") return false;
  const scfens = r["scfens"];
  const resolves = r["resolves"];
  if (!Array.isArray(scfens) || scfens.length === 0) return false;
  if (!scfens.every((s) => typeof s === "string")) return false;
  if (resolves === undefined) {
    const packed = r["packed"] as { count?: unknown; data?: unknown } | undefined;
    return (
      typeof packed?.data === "string" && packed.count === scfens.length - 1
    );
  }
  if (!Array.isArray(resolves) || resolves.length !== scfens.length - 1) {
    return false;
  }
  return true;
};

// WHAT: accept envelope, array, or single stored record.
export const extractExportedGames = (value: unknown): StarChessGameRecord[] | null => {
  if (Array.isArray(value)) {
    const games = value.filter(isRecord);
    return games.length === value.length && games.length > 0 ? games : null;
  }
  if (typeof value !== "object" || value === null) return null;
  const r = value as Record<string, unknown>;
  if (Array.isArray(r["games"]) && typeof r["version"] === "number") {
    const games = (r["games"] as unknown[]).filter(isRecord);
    return games.length === (r["games"] as unknown[]).length ? games : null;
  }
  return isRecord(value) ? [value] : null;
};

export type HistoryExportParse =
  | { ok: true; games: StarChessGameRecord[] }
  | { ok: false; error: string };

// WHAT: parse exported file text into stored records.
export const parseHistoryExportText = (text: string): HistoryExportParse => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid JSON" };
  }
  const games = extractExportedGames(parsed);
  if (!games || games.length === 0) {
    return { ok: false, error: "No exported games found" };
  }
  return { ok: true, games };
};
