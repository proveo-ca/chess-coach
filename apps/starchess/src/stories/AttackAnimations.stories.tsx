import type { Meta, StoryObj } from "storybook-solidjs-vite";

import { attackVectorsFor } from "~/presentation/animations/attackVectors";
import { AttackBoardDemo } from "~/presentation/animations/components/AttackBoardDemo";
import type { RookMode, StarChessPiece } from "~/types/cues";

/**
 * One weapon per unit, cycling every legal attack direction from d4.
 * `AttackBoardDemo` owns the board and the cycle; a story only names the unit
 * and (for the tank) its mode — the vector table lives in
 * `presentation/animations/attackVectors.ts`, never here.
 * Mine attacks are not a unit weapon: see StarChess/Spider Mines → Attack (mine).
 * // SPEC: _spec/apps/starchess/demos.puml, _spec/apps/starchess/vfx-guarantees.md
 */
const meta = {
  title: "StarChess/Attack Animations",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Store-free AnimationStage + `attackCues`. Each story idles facing the camera, fires, then advances to the next direction — over one loop every unit covers all of its attack vectors. Marine 2 diagonals · Hoverbike 8 L-jumps · Mecha 4 diagonals · Siege Tank 4 orthogonals (tank turret / siege HE) · BattleShip and Command Center 8 surrounding squares.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

/** Project one unit's weapon; the direction count comes from the vector table. */
const attackStory = (
  piece: StarChessPiece,
  opts: { name: string; docs: string; rookMode?: RookMode },
): Story => ({
  name: opts.name,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        story: `${opts.docs} Cycles ${attackVectorsFor(piece, "d4").length} directions.`,
      },
    },
  },
  render: () => <AttackBoardDemo piece={piece} rookMode={opts.rookMode} />,
});

export const Pawn = attackStory("p", {
  name: "Marine (pawn)",
  docs:
    "`pawnRifle` on both capture diagonals, with a black marine on d6 firing back down the board — the face rule (helmet away, visor toward the camera) reads on both colors at once.",
});

export const Knight = attackStory("n", {
  name: "Hoverbike (knight)",
  docs:
    "`knightFrag`: the bike rides the long leg then the short leg of the L and lobs a frag, aimed along the diagonal of the target's quadrant.",
});

export const Bishop = attackStory("b", {
  name: "Mecha (bishop)",
  docs:
    "`bishopGatlings` on the 4 diagonals. Charon Booster Missiles are the gas special — StarChess/Special Moves → Mecha.",
});

export const RookTankMode = attackStory("r", {
  name: "Siege Tank (rook) · tank mode",
  docs: "`rookBattery` unpacked: the turret yaws to each orthogonal and fires.",
});

export const RookSiegeMode = attackStory("r", {
  name: "Siege Tank (rook) · siege mode",
  docs:
    "`rookBattery` packed: HE shell arcs onto the adjacent victim on d5, so the impact reads against a real target.",
  rookMode: "siege",
});

export const Queen = attackStory("q", {
  name: "BattleShip (queen)",
  docs: "`queenLaser`: hull and beam share one aim wrap across all 8 surrounding squares.",
});

export const King = attackStory("k", {
  name: "Command Center (king)",
  docs:
    "`kingDualCannon`: twin batteries swing off their resting player-facing aim to each of the 8 surrounding squares.",
});
