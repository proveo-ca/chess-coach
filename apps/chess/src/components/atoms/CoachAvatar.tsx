// SPEC: _spec/apps/chess/components.puml, _spec/apps/chess/responsiveness/rules.md
import clsx from "clsx";
import type { Component } from "solid-js";

import styles from "~/components/atoms/CoachAvatar.module.css";
import { coachEmotion } from "~/store/coachStore";

interface CoachAvatarProps {
  /** Force the sleeping pose, ignoring the live coach emotion (used by the loading splash). */
  sleeping?: boolean;
  /** Bar-sized variant (MobileSidebar centre on short / dynamic Coach). */
  compact?: boolean;
}

export const CoachAvatar: Component<CoachAvatarProps> = (props) => {
  return (
    <div
      data-testid="coach-avatar"
      data-variant={props.sleeping ? "sleeping" : props.compact ? "compact" : "default"}
      class={clsx(
        styles.cat,
        props.compact && styles.compact,
        props.sleeping ? styles.sleeping : styles[coachEmotion()],
      )}
    >
      <div class={clsx(styles.ear, styles["ear--left"])}></div>
      <div class={clsx(styles.ear, styles["ear--right"])}></div>
      <div class={styles.face}>
        <div class={clsx(styles.eye, styles["eye--left"])}>
          <div class={styles["eye-pupil"]}></div>
        </div>
        <div class={clsx(styles.eye, styles["eye--right"])}>
          <div class={styles["eye-pupil"]}></div>
        </div>
        <div class={styles.muzzle}></div>
      </div>
      <div class={styles["zzz-container"]}>
        <div class={clsx(styles.z, styles["z-1"])}>Z</div>
        <div class={clsx(styles.z, styles["z-2"])}>Z</div>
        <div class={clsx(styles.z, styles["z-3"])}>Z</div>
      </div>
    </div>
  );
};
