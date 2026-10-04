// SPEC: _spec/apps/starchess/core/scfen/document.puml
/**
 * Names as they were first written, before the chess words left the engine:
 * special kinds on the wire and field names inside stored resolves. Saves,
 * exports and arena records carry them, so reads keep accepting them; writes
 * only ever produce the current name.
 */
import type { ScSpecialKind } from "../model/types";

export const LEGACY_SPECIAL_KINDS: Readonly<Record<string, ScSpecialKind | "ccShot">> = {
  spawn: "deploy",
  pawnDouble: "stimStep",
  knightMine: "spiderMine",
  bishopSnipe: "charonMissiles",
  rookSiege: "siegeMode",
  queenWarp: "tacticalJump",
  // Not a special — the attack kind a check lands as.
  kingShot: "ccShot",
};

/** Stored-resolve field names renamed with the engine (`kingLives` → `ccLives`, …). */
export const LEGACY_FIELD_NAMES: Readonly<Record<string, string>> = {
  kingLives: "ccLives",
  siegedRooks: "siegedTanks",
  siegedRook: "siegedTank",
  pendingKingShots: "pendingCCShots",
  pendingKingShotsArmed: "pendingCCShotsArmed",
};

/** The current name for a kind string, legacy or not. */
export const currentKind = (kind: string): string => Object.entries(LEGACY_SPECIAL_KINDS).find(([key]) => key === kind)?.[1] ?? kind;

/**
 * Rewrite a persisted payload (a resolve: queue, events, attacks, boards) to
 * current names — legacy field names and legacy `kind` values. Returns a copy.
 */
export const migrateLegacyNames = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map(migrateLegacyNames) as T;
  if (value === null || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    out[Object.entries(LEGACY_FIELD_NAMES).find(([name]) => name === key)?.[1] ?? key] =
      key === "kind" && typeof entry === "string" ? currentKind(entry) : migrateLegacyNames(entry);
  }
  return out as T;
};
