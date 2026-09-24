/** BattleShip attack cue id — battleship laser (`data-attack-anim`). */
export const BATTLESHIP_LASER = "battleShipLaser" as const;

/**
 * Laser muzzle X in the 45×45 viewBox after bow→+x normalize
 * (`rotate(-90)` *outside* `PIECE_FRAME.Q` so Y stays 22.5).
 */
export const BATTLESHIP_LASER_MUZZLE_X = 37.21;

/** `.aimWrap { inset: 4% }` → usable fraction of the cell. */
export const BATTLESHIP_AIM_WRAP_SCALE = 0.92;
/** `.pieceFace { width/height: 96% }` of the aim wrap. */
export const BATTLESHIP_PIECE_FACE_SCALE = 0.96;
