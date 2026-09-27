/**
 * Presentational achievement glyph. Rises two squares in the first second,
 * then fades exponentially and is gone at 3s. No timer and no store.
 */
import type { Component } from "solid-js";

import { Bubble } from "@chess-coach/ui-web/primitives/Bubble";

export type AchievementBubbleProps = {
  icon: string;
  tint: string;
  left: string;
  top: string;
  width: string;
  height: string;
  /** Negative px — two board squares upward. */
  rise: string;
  shortId: string;
  origin: string;
  level: number;
};

export const AchievementBubble: Component<AchievementBubbleProps> = (props) => (
  <Bubble
    icon={props.icon}
    tint={props.tint}
    left={props.left}
    top={props.top}
    width={props.width}
    height={props.height}
    rise={props.rise}
    data-testid="achievement-bubble"
    data-short-id={props.shortId}
    data-origin={props.origin}
    data-level={props.level}
  />
);
