/**
 * The UA table plus the one rule that matters: a keyboard hint needs *both*
 * opinions to agree. Each row here is a device that breaks one opinion alone.
 * // SPEC: _spec/packages/client-platform/entities.puml
 */
import { describe, expect, it } from "vitest";

import { isDesktopClient, resolveClientOS, type ClientDevice } from "@chess-coach/client-platform";

const UA = {
  macSafari:
    "mozilla/5.0 (macintosh; intel mac os x 10_15_7) applewebkit/605.1.15 (khtml, like gecko) version/17.0 safari/605.1.15",
  iPadOS:
    "mozilla/5.0 (macintosh; intel mac os x 10_15_7) applewebkit/605.1.15 (khtml, like gecko) version/17.0 safari/605.1.15",
  iPhone:
    "mozilla/5.0 (iphone; cpu iphone os 17_0 like mac os x) applewebkit/605.1.15 (khtml, like gecko) mobile/15e148",
  android:
    "mozilla/5.0 (linux; android 14; pixel 8) applewebkit/537.36 (khtml, like gecko) chrome/120 mobile safari/537.36",
  windows:
    "mozilla/5.0 (windows nt 10.0; win64; x64) applewebkit/537.36 (khtml, like gecko) chrome/120 safari/537.36",
  linux:
    "mozilla/5.0 (x11; linux x86_64) applewebkit/537.36 (khtml, like gecko) chrome/120 safari/537.36",
  chromeOS:
    "mozilla/5.0 (x11; cros x86_64 14541.0.0) applewebkit/537.36 (khtml, like gecko) chrome/120 safari/537.36",
};

describe("resolveClientOS", () => {
  it("reads the plain desktop and mobile agents", () => {
    expect(resolveClientOS(UA.macSafari)).toBe("macos");
    expect(resolveClientOS(UA.windows)).toBe("windows");
    expect(resolveClientOS(UA.linux)).toBe("linux");
    expect(resolveClientOS(UA.chromeOS)).toBe("linux");
    expect(resolveClientOS(UA.iPhone)).toBe("ios");
    expect(resolveClientOS(UA.android)).toBe("android");
    expect(resolveClientOS("")).toBe("unknown");
  });

  it("catches iPadOS masquerading as desktop Safari via touch points", () => {
    // Identical UA string — only maxTouchPoints separates the two.
    expect(resolveClientOS(UA.iPadOS, "", 5)).toBe("ios");
    expect(resolveClientOS(UA.macSafari, "", 0)).toBe("macos");
  });

  it("prefers a UA-CH platform hint over the string", () => {
    expect(resolveClientOS("", "Windows")).toBe("windows");
    expect(resolveClientOS("", "Android")).toBe("android");
    expect(resolveClientOS("", "Chrome OS")).toBe("linux");
  });
});

describe("isDesktopClient — a keyboard hint needs both opinions", () => {
  const desktop: ClientDevice = { os: "macos", isMobile: false };
  const phone: ClientDevice = { os: "android", isMobile: true };
  const tablet: ClientDevice = { os: "ios", isMobile: true };

  it("says yes only for a non-mobile UA with a fine pointer", () => {
    expect(isDesktopClient({ device: desktop, finePointer: true })).toBe(true);
  });

  it("says no to a touchscreen desktop — no fine pointer, no key hint", () => {
    expect(isDesktopClient({ device: desktop, finePointer: false })).toBe(false);
  });

  it("says no to a phone with a bluetooth mouse — fine pointer is not enough", () => {
    expect(isDesktopClient({ device: phone, finePointer: true })).toBe(false);
  });

  it("says no to an iPad, keyboard case or not", () => {
    expect(isDesktopClient({ device: tablet, finePointer: true })).toBe(false);
    expect(isDesktopClient({ device: tablet, finePointer: false })).toBe(false);
  });
});
