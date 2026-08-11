import type { Component } from "solid-js";

import { INK_BLACK } from "~/presentation/pieces/teamColors";

/** Barrel length along local +x (muzzle forward). */
export const TWIN_BATTERY_LEN = 10.5;
/** Each tube height — stacked with no gap. */
export const TWIN_BATTERY_H = 3.2;

/**
 * On-screen size equalizers — rook runs `PIECE_FRAME.R × ROOK_CONTENT_SCALE (1.3)`,
 * king only `PIECE_FRAME.K`. Scale each host so TwinBattery hits the midpoint.
 *
 *   rookEff ≈ √(0.8299×1.0503)×1.3 ≈ 1.213
 *   kingEff ≈ √(0.9169×1.1172) ≈ 1.012
 *   mid ≈ 1.1125
 */
export const TWIN_BATTERY_SCALE_ROOK = 0.917;
export const TWIN_BATTERY_SCALE_KING = 1.099;

type TwinBatteryProps = {
  /** Team / player primary fill for the turret hull. */
  team: string;
  /**
   * When false, omit the team turret block (e.g. {@link InlineRook} supplies
   * its own rotating deck). Default true for {@link InlineKing}.
   */
  showTurret?: boolean;
  /** Vertical gap between the twin tubes (0 = abutted, king default). */
  gap?: number;
};

/**
 * Shared Siege Tank (tank-mode) / Command Center dual battery.
 * Local +x = muzzle forward. Parent supplies pivot (`translate` + `rotate`)
 * and host scale ({@link TWIN_BATTERY_SCALE_ROOK} / {@link TWIN_BATTERY_SCALE_KING}).
 *
 * Exact same tube SVG on {@link InlineRook} tank face and {@link InlineKing}.
 */
export const TwinBattery: Component<TwinBatteryProps> = (props) => {
  const len = TWIN_BATTERY_LEN;
  const h = TWIN_BATTERY_H;
  const gap = () => props.gap ?? 0;
  const flashX = len + 3.2;
  const topY = () => -h - gap() / 2;
  const botY = () => gap() / 2;

  return (
    <g data-part="twins">
      {/* Player-colored turret hull the twins grow out of */}
      {props.showTurret !== false && (
        <rect fill={props.team} x="-4.5" y={-h - gap() / 2} width="9" height={h * 2 + gap()} rx="1" />
      )}
      <g data-part="cannon-recoil">
        <rect fill={INK_BLACK} x="2" y={topY()} width={len} height={h} rx="0.7" />
        <rect fill={INK_BLACK} x="2" y={botY()} width={len} height={h} rx="0.7" />
        <ellipse
          data-part="cannon-flash"
          fill="#ffe08a"
          cx={flashX}
          cy={topY() + h / 2}
          rx="2.8"
          ry="2"
          stroke="none"
          opacity="0"
        />
        <ellipse
          data-part="cannon-flash"
          fill="#ffe08a"
          cx={flashX}
          cy={botY() + h / 2}
          rx="2.8"
          ry="2"
          stroke="none"
          opacity="0"
        />
      </g>
    </g>
  );
};
