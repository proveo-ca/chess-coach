/**
 * Pure SCFEN planning appenders / removers — the only way a queue mutates.
 * See _spec/packages/starchess-core/scfen-queue.puml.
 * // SPEC: _spec/packages/starchess-core/scfen-queue.puml
 */

import type { Square } from "chess.js";

import { specialGasCost, assertQueueShape } from "../scfen";
import { assertActionDeep, ScValidateError } from "../rules/validation";
import type {
  PieceColor,
  ScAction,
  ScActionInput,
  ScFenSnapshot,
  SpawnPiece,
} from "../model/types";

export type AddScActionErrorCode =
  | "SC_PHASE"
  | "SC_QUEUE_SHAPE"
  | "SC_GAS"
  | "SC_BASELINE_FEN"
  | "SC_SPECIAL";

export class AddScActionError extends Error {
  readonly code: AddScActionErrorCode;
  constructor(code: AddScActionErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "AddScActionError";
  }
}

export type RemoveScActionErrorCode = "SC_PHASE" | "SC_NOT_FOUND";

export class RemoveScActionError extends Error {
  readonly code: RemoveScActionErrorCode;
  constructor(code: RemoveScActionErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "RemoveScActionError";
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
 * (≤1 classical; any number of specials all B or all F — B xor F) and gas
 * cost for specials.
 */
export const addScAction = (input: {
  snapshot: ScFenSnapshot;
  action: ScActionInput;
}): { snapshot: ScFenSnapshot; action: ScAction } => {
  const { snapshot: snap } = input;
  if (snap.phase !== "P") {
    throw new AddScActionError("SC_PHASE", `addScAction requires phase P (got ${snap.phase})`);
  }

  try {
    assertActionDeep(snap, input.action);
  } catch (e) {
    if (e instanceof ScValidateError) {
      throw new AddScActionError(e.code, e.message);
    }
    throw e;
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
    const existingSpecial = side.find((a) => a.timing === "B" || a.timing === "F");
    if (existingSpecial && existingSpecial.timing !== action.timing) {
      throw new AddScActionError(
        "SC_QUEUE_SHAPE",
        `side ${action.color} specials must all be ${existingSpecial.timing} (B xor F)`,
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

/**
 * Remove one queued action by seq. Refunds gas for B|F specials.
 * Remaining seqs are stable (TurnBar X targets).
 */
export const removeScAction = (input: {
  snapshot: ScFenSnapshot;
  seq: number;
}): { snapshot: ScFenSnapshot; removed: ScAction } => {
  const { snapshot: snap } = input;
  if (snap.phase !== "P") {
    throw new RemoveScActionError(
      "SC_PHASE",
      `removeScAction requires phase P (got ${snap.phase})`,
    );
  }
  const existing = snap.queue?.actions ?? [];
  const removed = existing.find((a) => a.seq === input.seq);
  if (!removed) {
    throw new RemoveScActionError(
      "SC_NOT_FOUND",
      `no queued action with seq ${input.seq}`,
    );
  }
  const actions = existing.filter((a) => a.seq !== input.seq);
  assertQueueShape(actions);

  let gas = snap.gas;
  if (removed.timing === "B" || removed.timing === "F") {
    const refund = specialGasCost(removed.kind);
    const cap = snap.gasIncome[removed.color];
    gas = {
      ...snap.gas,
      [removed.color]: Math.min(cap, snap.gas[removed.color] + refund),
    };
  }

  let specialsUsed = snap.specialsUsed ? [...snap.specialsUsed] : undefined;
  if (removed.timing !== "C" && specialsUsed) {
    specialsUsed = specialsUsed.filter((s) => s !== removed.from);
    if (specialsUsed.length === 0) specialsUsed = undefined;
  }

  const next: ScFenSnapshot = {
    ...snap,
    gas,
    queue: { actions },
  };
  if (specialsUsed) next.specialsUsed = specialsUsed;
  else delete (next as { specialsUsed?: unknown }).specialsUsed;

  return { snapshot: next, removed };
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
