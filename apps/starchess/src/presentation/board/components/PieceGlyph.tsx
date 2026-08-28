// SPEC: _spec/apps/starchess/architecture/board-entities.puml
/**
 * One unit on a square — the **only** component that may reach for a static
 * piece asset.
 *
 * Product art is inline (`presentation/pieces/`). `pieceUrl` is reachable on
 * exactly one branch: `cburnett`, the fog tutorial's Chess skin, whose sole
 * entry point is `TutorialScreen`'s skin toggle. Everything else — live match,
 * review, demos, deploy/promotion pickers — renders the inline unit, so the
 * resting silhouette and the animating one come from the same source and cannot
 * drift apart. `__tests__/bundle/bundleBoundary.test.ts` enforces the boundary.
 *
 * Branching is reactive (`Show`) so the tutorial toggle swaps glyphs without
 * remounting the match.
 */
import { Match, Show, Switch, type Component, type JSX } from "solid-js";
import type { RookMode, StarChessPiece } from "@chess-coach/starchess-core";

import { pieceUrl } from "~/presentation/board/pieceUrl";
import { InlineBishop } from "~/presentation/pieces/InlineBishop";
import { InlineKing } from "~/presentation/pieces/InlineKing";
import { InlineKnight } from "~/presentation/pieces/InlineKnight";
import { InlinePawn } from "~/presentation/pieces/InlinePawn";
import { InlineQueen } from "~/presentation/pieces/InlineQueen";
import { InlineRook } from "~/presentation/pieces/InlineRook";
import type { PieceColor } from "~/presentation/pieces/teamColors";
import type { PieceSet } from "~/types/board";

export type PieceGlyphProps = {
  color: PieceColor;
  type: StarChessPiece;
  pieceSet: PieceSet;
  /** Rook only — ignored for cburnett, where both modes are the classic rook. */
  mode?: RookMode;
  /** Rook / king turret yaw. Omit for the resting pose. */
  aimDeg?: number;
  /** Bishop only — Charon Booster Missiles armed (twin shoulder launchers up). */
  armed?: boolean;
  /** Bishop only — play the pop-out on this render. */
  armAnim?: boolean;
  class?: string;
  alt?: string;
  "data-special-used"?: string;
  style?: JSX.CSSProperties;
};

/** The inline unit for a type, at rest unless the caller aims it. */
const InlineUnit: Component<PieceGlyphProps> = (props) => (
  <Switch
    fallback={<InlinePawn color={props.color} />}
  >
    <Match when={props.type === "r"}>
      <InlineRook
        color={props.color}
        mode={props.mode ?? "tank"}
        aimDeg={props.aimDeg}
      />
    </Match>
    <Match when={props.type === "b"}>
      <InlineBishop
        color={props.color}
        face="front"
        armed={!!props.armed}
        armAnim={props.armAnim}
      />
    </Match>
    <Match when={props.type === "n"}>
      <InlineKnight color={props.color} />
    </Match>
    <Match when={props.type === "q"}>
      <InlineQueen color={props.color} />
    </Match>
    <Match when={props.type === "k"}>
      <InlineKing color={props.color} aimDeg={props.aimDeg} />
    </Match>
  </Switch>
);

export const PieceGlyph: Component<PieceGlyphProps> = (props) => (
  <Show
    when={props.pieceSet === "cburnett"}
    fallback={
      // `span`, not `div`: the deploy / promotion pickers mount this inside a
      // `<button>`, where flow content is invalid. `.piece` sets
      // `position: absolute`, so the computed display is block either way.
      <span
        class={props.class}
        style={props.style}
        data-piece={props.type}
        data-piece-inline={props.type}
        data-special-used={props["data-special-used"]}
        data-charon-armed={props.armed ? "true" : undefined}
      >
        <InlineUnit {...props} />
      </span>
    }
  >
    <img
      class={props.class}
      style={props.style}
      src={pieceUrl(props.color, props.type, "cburnett")}
      alt={props.alt ?? ""}
      data-piece={props.type}
      data-special-used={props["data-special-used"]}
      draggable={false}
    />
  </Show>
);
