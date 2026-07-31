import { Show, type Component } from "solid-js";

import { ROOK_REST_AIM_DEG, svgPivotAround } from "~/broodwar/animations/attackAnim";
import { Shard } from "~/broodwar/animations/pieces/Shard";
import {
  INK_BLACK,
  INK_DARK_GRAY,
  INK_WHITE,
  NERD_FRAME,
  TEAM_PRIMARY,
  type PieceColor,
} from "~/broodwar/animations/teamColors";
import type { RookMode } from "~/types/broodwar";

type DeathRookProps = {
  seed: number;
  color?: PieceColor;
  /** Tank (tracks + twin tubes) vs siege (wedge armor + filled twins). */
  mode?: RookMode;
};

const PIVOT = { x: 22.5, y: 23.5 };

/** Siege tank shatter — mode-matched hull + battery shards. */
export const DeathRook: Component<DeathRookProps> = (props) => {
  const team = () => TEAM_PRIMARY[props.color ?? "w"];
  const mode = (): RookMode => props.mode ?? "tank";

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" aria-hidden="true" overflow="visible">
      <g transform={NERD_FRAME.R}>
        <g stroke="#222" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6">
          <Show
            when={mode() === "siege"}
            fallback={
              <>
                <Shard index={0} seed={props.seed}>
                  <rect fill={INK_BLACK} x="10" y="32.2" width="25" height="6" rx="2.2" />
                </Shard>
                <Shard index={1} seed={props.seed}>
                  <rect fill={INK_DARK_GRAY} x="11.2" y="33" width="22.6" height="4.2" rx="2.1" />
                </Shard>
                <Shard index={2} seed={props.seed}>
                  <rect fill={INK_WHITE} x="9" y="25.5" width="27" height="8" rx="2.2" />
                </Shard>
                <Shard index={3} seed={props.seed}>
                  <rect fill={team()} x="9.6" y="26.4" width="2.1" height="5.8" rx="0.7" />
                  <rect fill={team()} x="12.2" y="26.4" width="2.1" height="5.8" rx="0.7" />
                </Shard>
                <Shard index={4} seed={props.seed}>
                  <rect fill={team()} x="30.7" y="26.4" width="2.1" height="5.8" rx="0.7" />
                  <rect fill={team()} x="33.3" y="26.4" width="2.1" height="5.8" rx="0.7" />
                </Shard>
                <Shard index={5} seed={props.seed}>
                  <rect fill={INK_WHITE} x="12.2" y="21.2" width="20.6" height="5.8" rx="2.2" />
                  <path fill={INK_WHITE} d="M14 21.2 L22.5 17.6 L31 21.2z" />
                </Shard>
                <Shard index={6} seed={props.seed}>
                  <g transform={svgPivotAround(PIVOT.x, PIVOT.y, ROOK_REST_AIM_DEG)}>
                    <g transform={`translate(${PIVOT.x} ${PIVOT.y})`}>
                      <rect fill={team()} x="-4.5" y="-3.8" width="9" height="7.6" rx="1" />
                      <rect fill={INK_BLACK} x="2" y="-3.8" width="10.5" height="3.2" rx="0.7" />
                      <rect fill={INK_BLACK} x="2" y="0.6" width="10.5" height="3.2" rx="0.7" />
                    </g>
                  </g>
                </Shard>
                <Shard index={7} seed={props.seed}>
                  <rect fill={INK_BLACK} x="20" y="28.8" width="5" height="3" rx="1.2" />
                </Shard>
              </>
            }
          >
            <Shard index={0} seed={props.seed}>
              <path fill={INK_WHITE} d="M5 38.2 L10 26 L35 26 L40 38.2z" />
            </Shard>
            <Shard index={1} seed={props.seed}>
              <path fill={team()} d="M6 38.2 L10 28 L14 28 L10 38.2z" />
            </Shard>
            <Shard index={2} seed={props.seed}>
              <path fill={team()} d="M31 28 L35 28 L39 38.2 L35 38.2z" />
            </Shard>
            <Shard index={3} seed={props.seed}>
              <path fill={team()} d="M14 28 L22.5 26 L31 28 L31 30 L14 30z" />
            </Shard>
            <Shard index={4} seed={props.seed}>
              <path fill={INK_WHITE} d="M12 26 L22.5 22 L33 26z" />
            </Shard>
            <Shard index={5} seed={props.seed}>
              <g transform={svgPivotAround(PIVOT.x, PIVOT.y, ROOK_REST_AIM_DEG)}>
                <g transform={`translate(${PIVOT.x} ${PIVOT.y})`}>
                  <rect fill={team()} x="-4.5" y="-2.5" width="9" height="5" rx="1" />
                  <rect fill={INK_WHITE} x="1.2" y="-3" width="12" height="2.6" rx="0.7" />
                  <rect fill={INK_WHITE} x="1.2" y="0.4" width="12" height="2.6" rx="0.7" />
                </g>
              </g>
            </Shard>
            <Shard index={6} seed={props.seed}>
              <rect fill={INK_BLACK} x="20" y="33.5" width="5" height="3" rx="1" />
            </Shard>
          </Show>
        </g>
      </g>
    </svg>
  );
};
