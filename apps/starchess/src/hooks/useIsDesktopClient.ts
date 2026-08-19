// SPEC: _spec/packages/client-platform/entities.puml
/**
 * Reactive "safe to mention a keyboard shortcut" gate.
 *
 * The pointer half is a live media query (a Bluetooth mouse can appear, and the
 * band flips without a reload); the user-agent half is fixed for the session.
 * Both must agree — see `isDesktopClient` for why either alone misfires.
 */
import { createMemo, type Accessor } from "solid-js";

import {
  DESKTOP_POINTER_MQ,
  detectClientDevice,
  isDesktopClient,
} from "@chess-coach/client-platform";

import { useMediaQuery } from "~/hooks/useMediaQuery";

export function useIsDesktopClient(): Accessor<boolean> {
  const device = detectClientDevice();
  const finePointer = useMediaQuery(DESKTOP_POINTER_MQ);
  return createMemo(() => isDesktopClient({ device, finePointer: finePointer() }));
}
