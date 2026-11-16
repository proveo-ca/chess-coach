// SPEC: _spec/packages/starchess-core/record-packing.puml
/**
 * Lossless storage codec for a record's resolves.
 *
 * A saved game is ~95% resolves, and almost all of that is repetition a
 * general-purpose compressor removes. So a packed record is the same data,
 * deflated — never a re-derivation. Nothing here runs the rules: a resolve is
 * what happened under the rules of the day it was played, and a replay under
 * today's rules could tell a different story.
 *
 * The one field that is dropped is a ply's `next`, and only on plies where
 * `parseScFen(scfens[i + 1])` gives it back exactly. `packResolves` proves the
 * whole round trip before it hands anything back; when it cannot, the caller
 * keeps the record plain.
 *
 * `scsan` is the per-ply intent line — the `Q:` field of the queue that was
 * resolved. It is a readable log of what each side asked for, stored beside the
 * resolves and never in place of them.
 */
import { deflateSync, inflateSync, strFromU8, strToU8 } from "fflate";

import { formatQueueField, migrateLegacyNames, parseScFen } from "../scfen";
import type { EndScTurnResult } from "../resolve/submit-turn";

export const PACKED_RESOLVES_VERSION = 1;

export type PackedResolves = {
  codec: "deflate";
  v: typeof PACKED_RESOLVES_VERSION;
  /** Ply count, so a list can size a game without inflating it. */
  count: number;
  /** base64 of deflate(JSON of the resolves, `next` omitted where rebuildable). */
  data: string;
};

/** Anything replayable: plain resolves, or a packed payload in their place. */
export type ReplayPayload = {
  scfens: string[];
  resolves?: EndScTurnResult[];
  packed?: PackedResolves;
  /** Per-ply `Q:` intent line; `null` where the ply recorded no queue. */
  scsan?: (string | null)[];
};

/** JSON with sorted keys — the equality a JSON store can actually keep. */
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, v: unknown) => {
    if (v === null || typeof v !== "object" || Array.isArray(v)) return v;
    return Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
  });

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const B64_INDEX = new Map([...B64].map((c, i) => [c, i]));

const toBase64 = (bytes: Uint8Array): string => {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]!;
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63]! : "=";
    out += i + 2 < bytes.length ? B64[n & 63]! : "=";
  }
  return out;
};

const fromBase64 = (text: string): Uint8Array => {
  const clean = text.replace(/=+$/, "");
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let n = 0;
  let bits = 0;
  let at = 0;
  for (const c of clean) {
    const v = B64_INDEX.get(c);
    if (v === undefined) throw new Error("packed resolves: invalid base64");
    n = (n << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[at++] = (n >> bits) & 0xff;
    }
  }
  return bytes;
};

const nextFromScfen = (scfen: string | undefined) =>
  scfen === undefined ? undefined : parseScFen(scfen);

export const unpackResolves = (
  scfens: readonly string[],
  packed: PackedResolves,
): EndScTurnResult[] => {
  if (packed.codec !== "deflate" || packed.v !== PACKED_RESOLVES_VERSION) {
    throw new Error(`packed resolves: unsupported ${packed.codec} v${packed.v}`);
  }
  const plies = JSON.parse(strFromU8(inflateSync(fromBase64(packed.data)))) as Record<
    string,
    unknown
  >[];
  if (!Array.isArray(plies) || plies.length !== packed.count) {
    throw new Error("packed resolves: ply count mismatch");
  }
  return plies.map((ply, i) =>
    "next" in ply ? ply : { ...ply, next: nextFromScfen(scfens[+i + 1]) },
  ) as unknown as EndScTurnResult[];
};

/** Pack, then prove the round trip. `null` = keep this record plain. */
export const packResolves = (
  scfens: readonly string[],
  resolves: readonly EndScTurnResult[],
): PackedResolves | null => {
  try {
    const plies = resolves.map((r, i) => {
      const rebuilt = nextFromScfen(scfens[+i + 1]);
      if (rebuilt === undefined || canonical(rebuilt) !== canonical(r.next)) return r;
      const { next: _next, ...rest } = r;
      return rest;
    });
    const packed: PackedResolves = {
      codec: "deflate",
      v: PACKED_RESOLVES_VERSION,
      count: resolves.length,
      data: toBase64(deflateSync(strToU8(JSON.stringify(plies)), { level: 9 })),
    };
    return canonical(unpackResolves(scfens, packed)) === canonical(resolves) ? packed : null;
  } catch {
    return null;
  }
};

/**
 * The `Q:` line each ply resolved; `null` for a ply that stored no queue.
 * Written in today's kind names — `parseQueueField` still reads the old ones.
 */
export const scsanOf = (resolves: readonly EndScTurnResult[]): (string | null)[] =>
  resolves.map((r) =>
    r.queue ? formatQueueField({ actions: migrateLegacyNames([...r.queue]) }) : null,
  );

export const resolvesOf = (record: ReplayPayload): EndScTurnResult[] => {
  if (record.resolves) return record.resolves;
  if (record.packed) return unpackResolves(record.scfens, record.packed);
  throw new Error("record carries neither resolves nor packed resolves");
};

/** Storage form: resolves packed (verified), intents alongside. */
export const packRecord = <T extends ReplayPayload>(record: T): T => {
  if (!record.resolves) return record;
  const packed = packResolves(record.scfens, record.resolves);
  if (!packed) return record;
  const { resolves, ...rest } = record;
  const scsan = scsanOf(resolves);
  return {
    ...rest,
    packed,
    ...(scsan.some((line) => line !== null) ? { scsan } : {}),
  } as T;
};

/** Plain form: resolves materialized, `packed` dropped. */
export const unpackRecord = <T extends ReplayPayload>(
  record: T,
): T & { resolves: EndScTurnResult[] } => {
  if (record.resolves) return record as T & { resolves: EndScTurnResult[] };
  const resolves = resolvesOf(record);
  const { packed: _packed, ...rest } = record;
  return { ...rest, resolves } as T & { resolves: EndScTurnResult[] };
};
