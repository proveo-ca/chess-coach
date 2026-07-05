// SPEC: _spec/packages/engine-core/entities.puml
/**
 * Structural FEN + move-token validation, shared by the Bun server (apps/server)
 * and the browser engine. Pure string logic, no deps.
 *
 * SECURITY: the server writes FEN/move strings into UCI command lines sent to
 * native Stockfish/lc0 over stdin, one command per newline. An embedded newline
 * would inject arbitrary UCI commands. These validators are the boundary guard:
 * they reject any control character and enforce a single-line, well-formed shape
 * BEFORE the value can reach the engine. Full legality remains the engine's job;
 * the invariant here is "single line, no control chars, structurally sane".
 */

// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional — reject C0 controls + DEL
const CONTROL_CHARS = /[\x00-\x1f\x7f]/;

const RANK = /^[pnbrqkPNBRQK1-8]+$/;
const EN_PASSANT = /^(-|[a-h][36])$/;
const CASTLING = /^K?Q?k?q?$/;

function rankSumsToEight(rank: string): boolean {
  let count = 0;
  for (const ch of rank) {
    if (ch >= "1" && ch <= "8") count += Number(ch);
    else count += 1;
  }
  return count === 8;
}

/**
 * Structural FEN validity: no control chars, exactly 6 space-separated fields,
 * 8 ranks each summing to 8, valid side/castling/en-passant/clock fields.
 */
export function isValidFen(fen: string): boolean {
  if (typeof fen !== "string" || fen.length === 0 || fen.length > 100) return false;
  if (CONTROL_CHARS.test(fen)) return false;

  const fields = fen.split(" ");
  if (fields.length !== 6) return false;
  const [placement, side, castling, enPassant, halfmove, fullmove] = fields;

  const ranks = placement.split("/");
  if (ranks.length !== 8) return false;
  for (const rank of ranks) {
    if (!RANK.test(rank) || !rankSumsToEight(rank)) return false;
  }

  if (side !== "w" && side !== "b") return false;
  // castling: "-" or a non-empty subset of KQkq in order
  if (castling !== "-" && (castling === "" || !CASTLING.test(castling))) return false;
  if (!EN_PASSANT.test(enPassant)) return false;
  if (!/^\d+$/.test(halfmove)) return false; // halfmove clock ≥ 0
  if (!/^\d+$/.test(fullmove) || Number(fullmove) < 1) return false; // fullmove ≥ 1

  return true;
}

/** Throws (with a client-safe message) when the FEN is not structurally valid. */
export function assertValidFen(fen: string): void {
  if (!isValidFen(fen)) throw new Error("Invalid FEN");
}

/**
 * A single UCI or SAN move token — e2e4, e7e8q, Nf3, O-O, exd5, e8=Q+, Qxh7#.
 * No whitespace or control chars (so it can never inject a second UCI command).
 */
export function isValidMoveToken(move: string): boolean {
  if (typeof move !== "string") return false;
  return /^[A-Za-z0-9+#=x!?-]{1,10}$/.test(move);
}

/** Throws (with a client-safe message) when the move token is not valid. */
export function assertValidMoveToken(move: string): void {
  if (!isValidMoveToken(move)) throw new Error("Invalid move");
}
