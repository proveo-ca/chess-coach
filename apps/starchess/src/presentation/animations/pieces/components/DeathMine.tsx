import { For, type Component } from "solid-js";

import { Shard } from "~/presentation/animations/pieces/components/Shard";
import { TEAM_PRIMARY, type PieceColor } from "~/presentation/animations/teamColors";
import {
  MINE_LEG_COUNT,
  legPath,
  radialLeg,
} from "~/presentation/specials/spiderMineLegs";

type DeathMineProps = {
  seed: number;
  color?: PieceColor;
};

const LEG_INDEX = Array.from({ length: MINE_LEG_COUNT }, (_, i) => i);

/**
 * Board glyphs sit in SpiderMine's own box (`inset: 14%`, 72% of the square)
 * while the death layer's `.pieceFace` is `inset: 4%` — so the wreck shrinks to
 * 72/92 and starts on the exact silhouette that was standing there.
 */
const GLYPH_SCALE = 0.78;

/**
 * The wreck's parts are *small* — the mine art fills barely half its own
 * viewBox, so a part is 4–7px on a 55px tile. `shardFly`'s easing is
 * front-loaded, so at the default distance those specks clear the tile inside
 * ~100ms and the death reads as the mine blinking out. Keeping the scatter
 * close holds them on their own square long enough to be seen breaking up.
 */
const PART_FLIGHT = 0.42;

/**
 * Spider mine wreck — the crown cracks open and the legs peel off.
 *
 * Coordinates are lifted from `SpiderMine.tsx` unchanged (same 40×40 viewBox,
 * same leg geometry helper) so the wreck starts on the exact silhouette that was
 * standing there. Legs always come out, even for a mine that died burrowed: the
 * scatter is what reads as *destroyed* rather than *triggered*.
 */
export const DeathMine: Component<DeathMineProps> = (props) => {
  const team = () => TEAM_PRIMARY[props.color ?? "w"];

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 40 40"
      aria-hidden="true"
      overflow="visible"
      data-death-glyph="mine"
    >
      <Shard index={0} seed={props.seed} distScale={0.25}>
        <ellipse cx="20" cy="26.5" rx="8" ry="2.2" fill="rgba(0,0,0,0.14)" />
      </Shard>

      <g transform={`translate(20 20) scale(${GLYPH_SCALE}) translate(-20 -20)`}>
        <For each={[...LEG_INDEX]}>
          {(i) => {
            const g = radialLeg(i);
            return (
              <Shard index={i + 1} seed={props.seed} distScale={PART_FLIGHT}>
                <path
                  fill="none"
                  stroke={team()}
                  stroke-width="1"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d={legPath(g)}
                />
                <circle
                  cx={g.tx}
                  cy={g.ty}
                  r="1.15"
                  fill={team()}
                  stroke="#222"
                  stroke-width="0.55"
                />
              </Shard>
            );
          }}
        </For>

        <Shard index={5} seed={props.seed} distScale={PART_FLIGHT}>
          <path
            fill="#fff"
            stroke="#222"
            stroke-width="1"
            stroke-linejoin="round"
            d="
              M16.5 14
              C12.2 14 10 16.4 10 20
              C10 23.6 12.2 26 16.5 26
              C16.8 28.8 18.4 30.5 20.8 30.5
              C23.4 30.5 25.2 28.6 25.5 26
              C28.2 25.2 30 22.8 30 20
              C30 17.2 28.2 14.8 25.5 14
              C25.2 11.4 23.4 9.5 20.8 9.5
              C18.4 9.5 16.8 11.2 16.5 14
              Z
            "
          />
          <ellipse cx="16.2" cy="20" rx="2.2" ry="4.2" fill="#fff" opacity="0.5" />
        </Shard>

        <Shard index={6} seed={props.seed} distScale={PART_FLIGHT}>
          <ellipse cx="20.6" cy="11.2" rx="3.4" ry="3.1" fill={team()} stroke="#222" stroke-width="0.9" />
          <ellipse cx="19.4" cy="11.2" rx="1.2" ry="1.6" fill={team()} opacity="0.7" />
        </Shard>

        <Shard index={7} seed={props.seed} distScale={PART_FLIGHT}>
          <ellipse cx="20.6" cy="28.8" rx="3.4" ry="3.1" fill={team()} stroke="#222" stroke-width="0.9" />
          <ellipse cx="19.4" cy="28.8" rx="1.2" ry="1.6" fill={team()} opacity="0.7" />
        </Shard>

        <Shard index={8} seed={props.seed} distScale={PART_FLIGHT}>
          <circle cx="20.5" cy="20" r="2.1" fill={team()} stroke="#222" stroke-width="0.85" />
          <circle cx="20.2" cy="20" r="1.05" fill={team()} />
        </Shard>
      </g>
    </svg>
  );
};
