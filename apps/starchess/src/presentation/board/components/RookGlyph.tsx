/**
 * Rook board glyph — product path is {@link InlineRook} (`nerd`).
 * `cburnett` flattens tank/siege to a classic rook img for the **fog tutorial
 * Chess skin only** — presentation prop, never a core concept.
 *
 * Branching is reactive (`Show`) so the tutorial toggle swaps glyphs without
 * remounting the match.
 */
import { Show, type Component, type JSX } from "solid-js";
import type { RookMode } from "@chess-coach/starchess-core";

import { pieceUrl } from "~/presentation/board/pieceUrl";
import { InlineRook } from "~/presentation/pieces/InlineRook";
import type { PieceSet } from "~/types/board";
import type { PieceColor } from "~/presentation/pieces/teamColors";

export type RookGlyphProps = {
  color: PieceColor;
  pieceSet: PieceSet;
  /** Ignored for cburnett — both tank and siege resolve to the classic rook. */
  mode?: RookMode;
  aimDeg?: number;
  class?: string;
  alt?: string;
  "data-special-used"?: string;
  style?: JSX.CSSProperties;
};

/**
 * `cburnett` → flat classic rook (tank or siege).
 * `nerd` → InlineRook — `mode` defaults to **tank**.
 */
export const RookGlyph: Component<RookGlyphProps> = (props) => (
  <Show
    when={props.pieceSet === "cburnett"}
    fallback={
      <div
        class={props.class}
        style={props.style}
        data-piece-inline="r"
        data-special-used={props["data-special-used"]}
      >
        <InlineRook
          color={props.color}
          mode={props.mode ?? "tank"}
          aimDeg={props.aimDeg}
        />
      </div>
    }
  >
    <img
      class={props.class}
      style={props.style}
      src={pieceUrl(props.color, "r", "cburnett")}
      alt={props.alt ?? ""}
      data-special-used={props["data-special-used"]}
      draggable={false}
    />
  </Show>
);
