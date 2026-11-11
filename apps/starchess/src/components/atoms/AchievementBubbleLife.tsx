/**
 * One bubble's lifetime. Calls `onDone` when the rise-and-fade finishes.
 */
import { onMount, type Component } from "solid-js";

import { createDelay } from "~/adapters/timers";
import { AchievementBubble } from "~/components/primitives/AchievementBubble";

export type AchievementBubbleLifeProps = {
  icon: string;
  tint: string;
  left: string;
  top: string;
  width: string;
  height: string;
  rise: string;
  shortId: string;
  origin: string;
  level: number;
  lifeMs: number;
  onDone: () => void;
};

export const AchievementBubbleLife: Component<AchievementBubbleLifeProps> = (props) => {
  onMount(() => {
    createDelay(props.lifeMs, () => props.onDone());
  });

  return (
    <AchievementBubble
      icon={props.icon}
      tint={props.tint}
      left={props.left}
      top={props.top}
      width={props.width}
      height={props.height}
      rise={props.rise}
      shortId={props.shortId}
      origin={props.origin}
      level={props.level}
    />
  );
};
