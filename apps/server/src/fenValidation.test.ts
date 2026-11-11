import { expect, test } from "bun:test";

import { isValidFen, isValidMoveToken } from "@chess-coach/engine-core";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const AFTER_E4_FEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
const EN_PASSANT_FEN = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2";

test("accepts well-formed FENs", () => {
  expect(isValidFen(START_FEN)).toBe(true);
  expect(isValidFen(AFTER_E4_FEN)).toBe(true);
  expect(isValidFen(EN_PASSANT_FEN)).toBe(true);
  expect(isValidFen("8/8/8/8/8/8/8/8 w - - 0 1")).toBe(true); // empty board, no castling
});

test("rejects a FEN carrying an injected UCI command (newline)", () => {
  const injected = `${START_FEN}\nsetoption name Debug Log File value /tmp/pwn`;
  expect(isValidFen(injected)).toBe(false);
  // also \r and other control chars
  expect(isValidFen(`${START_FEN}\r`)).toBe(false);
  expect(isValidFen(`${START_FEN}\tsetoption`)).toBe(false);
});

test("rejects structurally invalid FENs", () => {
  expect(isValidFen("")).toBe(false);
  expect(isValidFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0")).toBe(false); // 5 fields
  expect(isValidFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP w KQkq - 0 1")).toBe(false); // 7 ranks
  expect(isValidFen("rnbqkbnr/pppppppp/9/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")).toBe(false); // rank sums to 9
  expect(isValidFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR x KQkq - 0 1")).toBe(false); // bad side
  expect(isValidFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq z9 0 1")).toBe(false); // bad en passant
  expect(isValidFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 0")).toBe(false); // fullmove < 1
});

test("move tokens: accepts UCI/SAN, rejects control chars and whitespace", () => {
  for (const ok of ["e2e4", "e7e8q", "Nf3", "O-O", "O-O-O", "exd5", "e8=Q+", "Qxh7#"]) {
    expect(isValidMoveToken(ok)).toBe(true);
  }
  expect(isValidMoveToken("e2e4\nsetoption")).toBe(false);
  expect(isValidMoveToken("e2 e4")).toBe(false);
  expect(isValidMoveToken("")).toBe(false);
  expect(isValidMoveToken("a".repeat(11))).toBe(false); // too long
});
