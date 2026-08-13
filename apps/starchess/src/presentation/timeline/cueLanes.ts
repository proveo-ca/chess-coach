// SPEC: _spec/apps/starchess/timeline/cue-lanes.puml, _spec/apps/starchess/timeline/overview.puml
import type { CueBoard, CueLane, TimelineCue } from "~/types/match";

type LaneEntry = { prefix: string; lane: CueLane; board: CueBoard };

const REGISTRY: readonly LaneEntry[] = [
  { prefix: "gd", lane: "gasDrop", board: "preAfterB" },
  { prefix: "b", lane: "move", board: "preAfterB" },
  { prefix: "chd", lane: "bSpecial", board: "preAfterB" },
  { prefix: "ch", lane: "bSpecial", board: "preAfterB" },
  { prefix: "qjm", lane: "bSpecial", board: "preAfterB" },
  { prefix: "qjd", lane: "bSpecial", board: "preAfterB" },
  { prefix: "qj", lane: "bSpecial", board: "preAfterB" },
  { prefix: "armm", lane: "bSpecial", board: "preAfterB" },
  { prefix: "armd", lane: "bSpecial", board: "preAfterB" },
  { prefix: "spawn-", lane: "deploy", board: "afterB" },
  { prefix: "crush", lane: "crush", board: "afterB" },
  { prefix: "a", lane: "phase1Attack", board: "afterB" },
  { prefix: "pra", lane: "approach", board: "afterMove" },
  { prefix: "d", lane: "phase1Death", board: "afterB" },
  { prefix: "dk", lane: "phase1Death", board: "afterB" },
  { prefix: "m", lane: "phase1Death", board: "afterB" },
  { prefix: "c", lane: "move", board: "afterAttack" },
  { prefix: "mcm", lane: "collision", board: "afterAttack" },
  { prefix: "mc", lane: "collision", board: "afterAttack" },
  { prefix: "mm", lane: "mineMissile", board: "afterAttack" },
  { prefix: "mtm", lane: "mine", board: "afterMove" },
  { prefix: "mt", lane: "mine", board: "afterMove" },
  { prefix: "prd", lane: "approach", board: "afterMove" },
  { prefix: "prdth", lane: "approach", board: "afterMove" },
  { prefix: "prs", lane: "approach", board: "afterMove" },
  { prefix: "pro", lane: "approach", board: "afterMove" },
  { prefix: "prmm", lane: "mineMissile", board: "afterMove" },
  { prefix: "prm", lane: "mine", board: "afterMove" },
  { prefix: "prv", lane: "mine", board: "afterMove" },
  { prefix: "f", lane: "move", board: "afterMove" },
  { prefix: "pw", lane: "promoWalk", board: "afterMove" },
  { prefix: "pd", lane: "promoDeploy", board: "afterMove" },
];

const ORDERED = [...REGISTRY].sort((a, b) => b.prefix.length - a.prefix.length);

export const BOARD_RUNG: Record<CueBoard, number> = {
  preAfterB: 0,
  afterB: 1,
  afterAttack: 2,
  afterMove: 3,
};

export const laneFor = (id: string): LaneEntry => {
  const hit = ORDERED.find((e) => id.startsWith(e.prefix));
  return hit ?? { prefix: "", lane: "move", board: "afterMove" };
};

export const groupFor = (cue: TimelineCue): string =>
  `${cue.lane}:${cue.id.replace(/\d+$/, "")}`;

export const withLane = (cue: TimelineCue): TimelineCue => {
  const { lane, board } = laneFor(cue.id);
  return { ...cue, lane, board, group: `${lane}:${cue.id.replace(/\d+$/, "")}` };
};
