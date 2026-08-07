/**
 * Selena / Selena Kerrigan — classic coach cat, optional Ghost sniper helm.
 * `identity="selena"` matches apps/ui CoachAvatar (no helm). Switching to
 * kerrigan drops the helm onto her forehead (500ms) with a happy bounce;
 * switching back lifts it toward the top-middle while she watches it leave.
 */
import clsx from "clsx";
import {
  createEffect,
  createSignal,
  on,
  onCleanup,
  type Component,
} from "solid-js";

import styles from "~/components/atoms/CoachAvatar.module.css";

export type CoachIdentity = "selena" | "kerrigan";

export type KerriganEmotion =
  | "idle"
  | "watching"
  | "watching--left"
  | "watching--right"
  | "watching--up"
  | "thinking"
  | "happy"
  | "shocked"
  | "sleepy"
  | "sleeping"
  /** Visor slides from forehead down over the eyes. */
  | "scanning";

export type CoachAvatarProps = {
  /** Force the sleeping pose (loading splash). */
  sleeping?: boolean;
  /** Bar-sized variant. */
  compact?: boolean;
  /** Emotion class — story / host driven (no coachStore in starchess). */
  emotion?: KerriganEmotion;
  /**
   * `selena` — classic cat, no Ghost gear (UI CoachAvatar look).
   * `kerrigan` — Ghost helm parked / emotion-driven.
   * Transitions animate the helm drop / lift over 500ms.
   */
  identity?: CoachIdentity;
};

const HELM_MS = 500;

type HelmPhase = "off" | "on" | "dropping" | "lifting";

/** Distance from forehead park to the top edge of the visible ferry stage. */
function ferryOffsetPx(avatarEl: HTMLElement): number {
  const stage =
    avatarEl.closest("[data-helm-ferry-stage]") ??
    document.getElementById("storybook-root") ??
    avatarEl.parentElement ??
    avatarEl;
  const stageTop = stage.getBoundingClientRect().top;
  const avatarTop = avatarEl.getBoundingClientRect().top;
  // Negative = up. Flush with the stage's top bound (top-middle of the HTML box).
  return Math.min(0, stageTop - avatarTop);
}

export const CoachAvatar: Component<CoachAvatarProps> = (props) => {
  const identity = () => props.identity ?? "kerrigan";
  const [helmPhase, setHelmPhase] = createSignal<HelmPhase>(
    identity() === "kerrigan" ? "on" : "off",
  );

  let rootEl: HTMLDivElement | undefined;
  let helmTimer: ReturnType<typeof setTimeout> | undefined;

  const syncFerryY = () => {
    if (!rootEl) return;
    rootEl.style.setProperty(
      "--helm-ferry-y",
      `${ferryOffsetPx(rootEl)}px`,
    );
  };

  createEffect(
    on(identity, (id, prev) => {
      if (prev === undefined) {
        // Settled Selena: stash at the measured top bound before first paint settles.
        queueMicrotask(syncFerryY);
        return;
      }
      if (helmTimer !== undefined) clearTimeout(helmTimer);

      syncFerryY();

      if (id === "kerrigan" && prev === "selena") {
        // Ensure start pose is the stage-top ferry before animating down.
        setHelmPhase("off");
        requestAnimationFrame(() => {
          syncFerryY();
          requestAnimationFrame(() => {
            setHelmPhase("dropping");
            helmTimer = setTimeout(() => setHelmPhase("on"), HELM_MS);
          });
        });
        return;
      }
      if (id === "selena" && prev === "kerrigan") {
        setHelmPhase("lifting");
        helmTimer = setTimeout(() => {
          setHelmPhase("off");
          syncFerryY();
        }, HELM_MS);
        return;
      }
      setHelmPhase(id === "kerrigan" ? "on" : "off");
    }),
  );

  onCleanup(() => {
    if (helmTimer !== undefined) clearTimeout(helmTimer);
  });

  const emotion = (): KerriganEmotion => {
    if (props.sleeping) return "sleeping";
    const phase = helmPhase();
    if (phase === "dropping") return "happy";
    if (phase === "lifting") return "watching--up";
    return props.emotion ?? "idle";
  };

  const character = () =>
    helmPhase() === "off" || helmPhase() === "lifting"
      ? "selena"
      : "selena-kerrigan";

  return (
    <div
      ref={(el) => {
        rootEl = el;
        syncFerryY();
      }}
      data-testid="coach-avatar"
      data-character={character()}
      data-identity={identity()}
      data-helm={helmPhase()}
      data-variant={
        props.sleeping ? "sleeping" : props.compact ? "compact" : "default"
      }
      data-emotion={emotion()}
      class={clsx(
        styles.cat,
        props.compact && styles.compact,
        styles[emotion()],
        helmPhase() === "off" && styles.helmOff,
        helmPhase() === "on" && styles.helmOn,
        helmPhase() === "dropping" && styles.helmDropping,
        helmPhase() === "lifting" && styles.helmLifting,
      )}
      aria-label={identity() === "selena" ? "Selena" : "Selena Kerrigan"}
    >
      <div class={clsx(styles.ear, styles["ear--left"])} />
      <div class={clsx(styles.ear, styles["ear--right"])} />

      {/* Ghost helm — absent for Selena; drop/lift between identities. */}
      <div class={styles.helmet} aria-hidden="true">
        <div class={styles.helmetRidge} />
        <div class={styles.helmetBrow} />
        <div class={clsx(styles.scope, styles["scope--left"])}>
          <div class={styles.scopeLens} data-size="large" />
        </div>
        <div class={clsx(styles.scope, styles["scope--right"])}>
          <div class={styles.scopeLens} data-size="small" />
          <div class={styles.scopeLens} data-size="small" />
        </div>
      </div>

      <div class={styles.face}>
        <div class={clsx(styles.eye, styles["eye--left"])}>
          <div class={styles["eye-pupil"]} />
        </div>
        <div class={clsx(styles.eye, styles["eye--right"])}>
          <div class={styles["eye-pupil"]} />
        </div>
      </div>
      {/* Nose sits above a scanning visor; kept outside .face for stacking. */}
      <div class={styles.muzzle} />

      <div class={styles["zzz-container"]}>
        <div class={clsx(styles.z, styles["z-1"])}>Z</div>
        <div class={clsx(styles.z, styles["z-2"])}>Z</div>
        <div class={clsx(styles.z, styles["z-3"])}>Z</div>
      </div>
    </div>
  );
};
