/**
 * King Defense tutorial — Turn 1 enemy bishop slides into check; Turn 2 player saves CC.
 *
 * Start: Ke1, bh2 (not checking), kh8.
 * Turn 1 (auto): Bh2→g3 onto the e1 diagonal (check becomes visible).
 * Turn 2 (player): check chips CC · deploy Marine f2 · capture g3.
 */
export const KING_DEFENSE_START_SCFEN =
  "SCFEN|7k/8/8/8/8/8/7b/4K3|0|33|P|G:11:11|B:3:3|Q:w:;b:C=h2g3";

export const KING_DEFENSE_STORED = 4;
