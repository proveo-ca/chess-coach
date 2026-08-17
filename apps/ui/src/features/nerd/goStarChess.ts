/**
 * The one hop from Coach to the standalone StarChess app, search + hash kept.
 *
 * `starchess_from_chess` is consumed by apps/starchess MenuArrival /
 * menuEntrance to play the glass / shatter arrival instead of a cold menu.
 * // SPEC: _spec/apps/starchess/deployment.puml
 */
export const goStarChess = (nav: "assign" | "replace" = "assign"): void => {
  const { search, hash } = window.location;
  try {
    sessionStorage.setItem("starchess_from_chess", "1");
  } catch {
    /* ignore */
  }
  window.location[nav](`/starchess/${search}${hash}`);
};
