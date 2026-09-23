/**
 * Read-only view of Coach's `isNerd` (apps/chess `features/nerd/identity`) — the
 * shared origin shares the blob, same as `chess_coach_settings_state`.
 *
 * StarChess never writes it: the flag is Coach's to set, and the only thing on
 * this side that cares is the Chess mock menu, which has to show the menu the
 * player just left. Hand-rolled rather than `createPersistedStore` for exactly
 * that reason — that helper mirrors the store back on creation, which would
 * have StarChess writing a key it does not own.
 * // SPEC: _spec/apps/starchess/menu-flow.puml
 */
const NERD_KEY = "isNerd";

/** Whether Coach's menu is currently offering its StarChess shortcut. */
export const isNerd = (): boolean => {
  try {
    const raw = localStorage.getItem(NERD_KEY);
    if (!raw) return false;
    return (JSON.parse(raw) as { isNerd?: boolean }).isNerd === true;
  } catch {
    /* private mode / blocked storage / malformed blob */
    return false;
  }
};
