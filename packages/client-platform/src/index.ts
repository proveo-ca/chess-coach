// SPEC: _spec/packages/client-platform/entities.puml
/**
 * Client device facts, shared by `apps/ui` and `apps/starchess`.
 *
 * Framework-free on purpose (same rule as `starchess-core` / `engine-core`) so
 * either app can read it from a hook, a service, or a plain module.
 *
 * **Two questions, two answers.** "Which OS is this?" is a user-agent question
 * and is answered here. "Can this player press a key / hover a tooltip?" is a
 * *capability* question, and no user agent answers it reliably — an iPad with a
 * Magic Keyboard, a Surface in tablet mode, and a touchscreen desktop all lie in
 * one direction or the other. So `isDesktopClient` takes the capability as an
 * argument and the caller supplies it from `DESKTOP_POINTER_MQ`; the UA is only
 * ever the *second* opinion.
 */

/** Detected client OS. */
export type ClientOS = "linux" | "macos" | "windows" | "ios" | "android" | "unknown";

export type ClientDevice = {
  os: ClientOS;
  /** UA-CH `mobile`, or a phone/tablet OS — phone **and** tablet, not "small". */
  isMobile: boolean;
};

interface UADataLike {
  platform?: string;
  mobile?: boolean;
}

/**
 * Media query for "this pointer can hover and land on small targets", i.e. a
 * mouse or trackpad. Lives here so both apps ask the same question — the CSS
 * bands in each app own *viewport* size, which is a different axis entirely.
 */
export const DESKTOP_POINTER_MQ = "(pointer: fine) and (hover: hover)";

/**
 * Resolve the OS from a lower-cased UA string plus optional UA-CH platform hint.
 * `maxTouchPoints` is passed in rather than read: iPadOS 13+ ships a desktop
 * Safari UA, and touch capability is the only thing that gives it away.
 */
export const resolveClientOS = (
  ua: string,
  hintPlatform = "",
  maxTouchPoints = 0,
): ClientOS => {
  const p = hintPlatform.toLowerCase();
  const iPadOS = /macintosh/.test(ua) && maxTouchPoints > 1;
  if (/android/.test(ua) || p === "android") return "android";
  if (/iphone|ipad|ipod/.test(ua) || iPadOS) return "ios";
  if (/windows|win32|win64/.test(ua) || p === "windows") return "windows";
  if (/mac os x|macintosh/.test(ua) || p === "macos") return "macos";
  if (/linux|x11|cros/.test(ua) || p === "linux" || p === "chrome os") return "linux";
  return "unknown";
};

/** Read the live `navigator`. Returns the `unknown` device off-DOM (SSR, tests). */
export const detectClientDevice = (): ClientDevice => {
  if (typeof navigator === "undefined") return { os: "unknown", isMobile: false };
  const uaData = (navigator as Navigator & { userAgentData?: UADataLike }).userAgentData;
  const ua = navigator.userAgent.toLowerCase();
  const os = resolveClientOS(ua, uaData?.platform ?? "", navigator.maxTouchPoints ?? 0);
  return { os, isMobile: uaData?.mobile ?? (os === "ios" || os === "android") };
};

/**
 * Is it safe to tell this player about a **keyboard** shortcut?
 *
 * Both opinions must agree, because either one alone is wrong in a way players
 * notice: a fine pointer alone would offer Esc to a phone with a Bluetooth mouse,
 * and a desktop UA alone would offer it to a Windows tablet held in two hands.
 * When they disagree, say nothing about keys — the copy that names only the
 * pointer gesture is correct on every device.
 */
export const isDesktopClient = (input: {
  device: ClientDevice;
  /** `matchMedia(DESKTOP_POINTER_MQ).matches` from the caller. */
  finePointer: boolean;
}): boolean => input.finePointer && !input.device.isMobile;
