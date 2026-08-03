/**
 * Pure SCFEN planning appenders — the only way a queue is created.
 * See STARCHESS_FEN.md §3.
 */

import type { Square } from "chess.js";

import { specialGasCost } from "~/starchess/scfen";
import { assertQueueShape } from "~/starchess/scfen";
import type {
  PieceColor,
  ScAction,
  ScFenSnapshot,
  SpawnPiece,
} from "~/types/starchess";

export type AddScActionErrorCode =
  | "SC_PHASE"
  | "SC_QUEUE_SHAPE"
  | "SC_GAS";

export class AddScActionError extends Error {
  readonly code: AddScActionErrorCode;
  constructor(code: AddScActionErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "AddScActionError";
  }
}

const sideActions = (snap: ScFenSnapshot, color: PieceColor): ScAction[] =>
  (snap.queue?.actions ?? []).filter((a) => a.color === color);

const nextSeq = (snap: ScFenSnapshot): number => {
  const actions = snap.queue?.actions ?? [];
  if (actions.length === 0) return 0;
  return Math.max(...actions.map((a) => a.seq)) + 1;
};

/**
 * Append one planning action. Assigns `seq`, enforces MODE budget
 * (≤1 special xor, ≤1 classical) and gas cost for specials.
 */
export const addScAction = (input: {
  snapshot: ScFenSnapshot;
  action: Omit<ScAction, "seq">;
}): { snapshot: ScFenSnapshot; action: ScAction } => {
  const { snapshot: snap } = input;
  if (snap.phase !== "P") {
    throw new AddScActionError("SC_PHASE", `addScAction requires phase P (got ${snap.phase})`);
  }

  const action: ScAction = { ...input.action, seq: nextSeq(snap) } as ScAction;
  const existing = snap.queue?.actions ?? [];
  const side = sideActions(snap, action.color);

  if (action.timing === "C") {
    if (side.some((a) => a.timing === "C")) {
      throw new AddScActionError(
        "SC_QUEUE_SHAPE",
        `side ${action.color} already has a classical action`,
      );
    }
  } else {
    if (side.some((a) => a.timing === "B" || a.timing === "F")) {
      throw new AddScActionError(
        "SC_QUEUE_SHAPE",
        `side ${action.color} already has a special action`,
      );
    }
    const cost = specialGasCost(action.kind);
    if (snap.gas[action.color] < cost) {
      throw new AddScActionError(
        "SC_GAS",
        `side ${action.color} needs ${cost} gas but has ${snap.gas[action.color]}`,
      );
    }
  }

  const actions = [...existing, action];
  assertQueueShape(actions);

  const gas =
    action.timing === "C"
      ? snap.gas
      : {
          ...snap.gas,
          [action.color]: snap.gas[action.color] - specialGasCost(action.kind),
        };

  const next: ScFenSnapshot = {
    ...snap,
    gas,
    queue: { actions },
  };
  return { snapshot: next, action };
};

/** Convenience: queue a classical C action for one side. */
export const addScMove = (
  snapshot: ScFenSnapshot,
  move: {
    color: PieceColor;
    from: Square;
    to: Square;
    promotion?: SpawnPiece;
  },
): ScFenSnapshot => {
  const { snapshot: next } = addScAction({
    snapshot,
    action: {
      timing: "C",
      kind: "classical",
      color: move.color,
      from: move.from,
      to: move.to,
      ...(move.promotion ? { promotion: move.promotion } : {}),
    },
  });
  return next;
};

/**
 * SAN helper for the FEN-legal classical subset only.
 * Parses simple `e2e4` / `e2e4q` coordinate SAN; full algebraic SAN is out of scope.
 */
export const addScMoveSan = (snapshot: ScFenSnapshot, san: string, color: PieceColor): ScFenSnapshot => {
  const m = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(san.trim());
  if (!m) {
    throw new AddScActionError("SC_QUEUE_SHAPE", `addScMoveSan expects coordinate move, got ${san}`);
  }
  return addScMove(snapshot, {
    color,
    from: m[1] as Square,
    to: m[2] as Square,
    ...(m[3] ? { promotion: m[3] as SpawnPiece } : {}),
  });
};
