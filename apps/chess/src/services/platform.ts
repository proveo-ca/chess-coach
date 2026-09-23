// SPEC: _spec/apps/ui/multiplayer.puml, _spec/packages/client-platform/entities.puml
import { detectClientDevice } from "@chess-coach/client-platform";

import type { OS, PlatformInfo } from "~/types/multiplayer";

/**
 * Tailscale onboarding copy for the detected client — download link + install
 * docs on the LanScreen.
 *
 * This is presentation-only: we never gate functionality on it, we just point
 * the user at the right install instructions. *Which* device this is comes from
 * `@chess-coach/client-platform` (one UA table for both apps); everything below
 * is the Tailscale-specific mapping, which is this app's business alone.
 */
const DOWNLOAD_BASE = "https://tailscale.com/download";

const OS_LABEL: Record<OS, string> = {
  linux: "Linux",
  macos: "macOS",
  windows: "Windows",
  ios: "iOS",
  android: "Android",
  unknown: "your device",
};

const DOWNLOAD_PATH: Record<OS, string> = {
  linux: "/linux",
  macos: "/mac",
  windows: "/windows",
  ios: "/ios",
  android: "/android",
  unknown: "",
};

const INSTALL_DOCS: Record<OS, string> = {
  linux: "https://tailscale.com/docs/install/linux",
  macos: "https://tailscale.com/download/mac",
  windows: "https://tailscale.com/download/windows",
  ios: "https://tailscale.com/download/ios",
  android: "https://tailscale.com/download/android",
  unknown: DOWNLOAD_BASE,
};

export function detectPlatform(): PlatformInfo {
  // `ClientOS` and this app's `OS` are the same union — the lib is the source.
  const { os, isMobile }: { os: OS; isMobile: boolean } = detectClientDevice();
  return {
    os,
    isMobile,
    label: OS_LABEL[os],
    downloadUrl: os === "unknown" ? DOWNLOAD_BASE : `${DOWNLOAD_BASE}${DOWNLOAD_PATH[os]}`,
    installDocsUrl: INSTALL_DOCS[os],
  };
}
