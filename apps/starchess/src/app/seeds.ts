// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
/**
 * Canonical StarChess SCFEN positions — product source of truth.
 * Shipped screens, demos, and tests all seed from here; nothing seeds from
 * Storybook. Scenario *packages* (ply lists + queue steps) live in `demos/`.
 */

/** Classic StarChess starting placement — `/single` opening + maps gallery. */
export const STAR_STARTING_SCFEN =
  "SCFEN|4k3/2pppp2/8/8/8/8/2PPPP2/4K3|0|33|P|G:11:11|B:3:3|Q:w:;b:";

export const PROMOTION_CLEAN_SCFEN =
  "SCFEN|k7/4P3/8/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:;b:";

export const PROMOTION_MINE_SCFEN =
  "SCFEN|k7/4P3/8/8/8/8/8/4K3|1|33|P|G:11:11|M:b:e8|Q:w:;b:";

/** Enemy Hoverbike already spent gas — U: must not pierce fog for the opponent. */
export const GAS_USED_FOG_SCFEN =
  "SCFEN|4k3/8/8/4n3/8/8/8/4K3|0|33|P|G:11:11|U:e5|Q:w:;b:";
