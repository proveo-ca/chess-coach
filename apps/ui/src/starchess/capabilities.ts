import type { ScreenCapabilities } from "~/types/capabilities";
import { LAN_OBSERVER_CAPABILITIES } from "~/store/capabilitiesStore";

/** StarChess board: Nerd set on both sides, free-move sandbox with fog. */
export const NERD_CAPABILITIES: ScreenCapabilities = {
  ...LAN_OBSERVER_CAPABILITIES,
  opponentUsesPlayerPieceSet: true,
  readOnly: false,
  freeColorControl: true,
};
