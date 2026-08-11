/**
 * One-shot flag: Coach `/chess/` → `/starchess/` should play MenuArrival
 * (Chess mockup → glass → Kerrigan → shatter → StarChess).
 * // SPEC: _spec/apps/starchess/menu-flow.puml
 */
const ENTRANCE_KEY = "starchess_from_chess";

/** Call before navigating from Coach into StarChess. */
export const markChessMenuEntrance = (): void => {
  try {
    sessionStorage.setItem(ENTRANCE_KEY, "1");
  } catch {
    /* private mode / blocked storage */
  }
};

/** Consume the flag once — true when this visit should start on the Chess mockup. */
export const consumeChessMenuEntrance = (): boolean => {
  try {
    const v = sessionStorage.getItem(ENTRANCE_KEY);
    if (!v) return false;
    sessionStorage.removeItem(ENTRANCE_KEY);
    return true;
  } catch {
    return false;
  }
};
