// SPEC: _spec/apps/starchess/animation-pipeline.md, _spec/apps/starchess/architecture/board-entities.puml
import type { Square } from "chess.js";

import { isBoardSquare } from "~/presentation/animations/boardGeom";

export type VisualOwnerKind =
  | "death"
  | "deploy"
  | "move"
  | "attack"
  | "jump"
  | "ccDamage"
  | "static";

export type VisualFrameInput = {
  attackCues?: readonly { id: string; from: Square; to?: Square }[];
  attackDying?: Readonly<Record<string, boolean>>;
  deathCues?: readonly { id: string; at: Square }[];
  moveCues?: readonly { id: string; from: Square; to: Square }[];
  jumpCues?: readonly { id: string; from: Square; to: Square }[];
  deployCues?: readonly { id: string; at: Square }[];
  ccDamage?: readonly { id: string; at: Square }[];
};

export type VisualFrame = {
  /** Priority: death > deploy > move/jump > attack > ccDamage > static */
  owners: ReadonlyMap<Square, { kind: VisualOwnerKind; cueId: string }>;
  hideSquares: ReadonlySet<Square>;
  /** Attack cue ids whose hull should be suppressed (dying or death owns from). */
  suppressedAttackIds: ReadonlySet<string>;
};

/**
 * Derive square ownership + hide set for combat overlays.
 * Higher-priority kinds claim first; later kinds skip already-owned squares.
 */
export function deriveVisualFrame(input: VisualFrameInput): VisualFrame {
  const owners = new Map<Square, { kind: VisualOwnerKind; cueId: string }>();

  const claim = (sq: Square, kind: VisualOwnerKind, cueId: string) => {
    if (owners.has(sq)) return;
    owners.set(sq, { kind, cueId });
  };

  for (const c of input.deathCues ?? []) claim(c.at, "death", c.id);
  for (const c of input.deployCues ?? []) claim(c.at, "deploy", c.id);

  for (const c of input.moveCues ?? []) {
    claim(c.from, "move", c.id);
    if (isBoardSquare(c.to)) claim(c.to, "move", c.id);
  }
  for (const c of input.jumpCues ?? []) {
    claim(c.from, "jump", c.id);
    if (isBoardSquare(c.to)) claim(c.to, "jump", c.id);
  }

  const dying = input.attackDying ?? {};
  for (const c of input.attackCues ?? []) {
    if (dying[c.id]) continue;
    if (owners.get(c.from)?.kind === "death") continue;
    claim(c.from, "attack", c.id);
  }

  for (const c of input.ccDamage ?? []) claim(c.at, "ccDamage", c.id);

  const suppressedAttackIds = new Set<string>();
  for (const c of input.attackCues ?? []) {
    if (dying[c.id] || owners.get(c.from)?.kind === "death") {
      suppressedAttackIds.add(c.id);
    }
  }

  // Owned squares + dying-attack origins (board glyph stays hidden under a
  // suppressed hull after the death cue ends, until the attack wave clears).
  const hideSquares = new Set(owners.keys());
  for (const c of input.attackCues ?? []) {
    if (dying[c.id]) hideSquares.add(c.from);
  }

  return {
    owners,
    hideSquares,
    suppressedAttackIds,
  };
}
