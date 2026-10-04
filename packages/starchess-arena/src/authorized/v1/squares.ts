// SPEC: _spec/packages/starchess-arena/newgeneration.puml
import type { Square } from "@chess-coach/starchess-core";

export const SQUARES = Array.from({ length: 64 }, (_, index) =>
  `${"abcdefgh"[Math.floor(index / 8)]}${index % 8 + 1}` as Square);
