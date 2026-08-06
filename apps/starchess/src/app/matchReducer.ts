import {
  MAX_STORED_MATERIAL,
  UNIT_COST,
  addScAction,
  AddScActionError,
  endScTurn,
  incomeForTurn,
  parseScFen,
  refillTurnGas,
  removeScAction,
  scOutcome,
  type PlayerEconomy,
  type ScFenSnapshot,
  type StarChessColor,
} from "@chess-coach/starchess-core";

import type { MatchAction, MatchState, TimelineState } from "~/app/matchTypes";

const emptyTimeline = (placement: string | null = null): TimelineState => ({
  active: false,
  cues: [],
  playingIds: [],
  hiddenSquares: new Set(),
  moveProgress: {},
  moveLeg: {},
  jumpTrails: [],
  displayPlacement: placement,
  displayKingLives: null,
  displayMines: null,
  displaySiegedRooks: null,
});

const reviewStatus = (index: number, max: number): string => {
  if (index <= 0) return "Start";
  if (index >= max) return "Final";
  return `Turn ${index} of ${max}`;
};

const defaultEconomies = (stored: number): Record<StarChessColor, PlayerEconomy> => ({
  w: { stored, deployed: 0 },
  b: { stored, deployed: 0 },
});

const grantIncome = (
  economies: Record<StarChessColor, PlayerEconomy>,
  turn: number,
): Record<StarChessColor, PlayerEconomy> => {
  const amount = incomeForTurn(Math.max(1, turn));
  if (amount <= 0) return economies;
  const next = { ...economies };
  for (const color of ["w", "b"] as const) {
    const eco = next[color];
    next[color] = {
      stored: Math.min(MAX_STORED_MATERIAL, eco.stored + amount),
      deployed: eco.deployed,
    };
  }
  return next;
};

const seedFromSnap = (snap: ScFenSnapshot, stored: number): MatchState => {
  const outcome = snap.phase === "O" ? scOutcome(snap) : null;
  return {
    phase: outcome ? "gameOver" : "planning",
    liveSnapshot: snap,
    economies: defaultEconomies(stored),
    viewer: "w",
    deadlineAt: null,
    targeting: null,
    // Armed specials this planning window only — not snap `U:` (enemy fog pierce).
    specialsUsed: new Set(),
    siegedRooks: new Set(snap.siegedRooks ?? []),
    timeline: emptyTimeline(),
    outcome,
    settledSnapshots: [snap],
    settledResolves: [],
    reviewIndex: 0,
    statusText: outcome
      ? outcome.draw
        ? "Draw"
        : `${outcome.winner === "w" ? "White" : "Black"} wins`
      : "Plan your turn",
    lastResolve: null,
    selected: null,
    legalDests: [],
    pendingPromotion: null,
    turnStartChecksApplied: false,
  };
};

export const createInitialMatchState = (): MatchState => {
  const snap = parseScFen(
    "SCFEN|4k3/8/8/8/8/8/8/4K3|0|33|P|G:11:11|Q:w:;b:",
  );
  return seedFromSnap(snap, 12);
};

/** Seed a match from SCFEN (Storybook / deep-link) before the screen mounts. */
export const createMatchStateFromScfen = (
  scfen: string,
  stored = 12,
): MatchState => {
  try {
    return seedFromSnap(parseScFen(scfen), stored);
  } catch {
    return {
      ...createInitialMatchState(),
      phase: "loading",
      statusText: "Invalid SCFEN",
    };
  }
};

export const matchReducer = (state: MatchState, action: MatchAction): MatchState => {
  switch (action.type) {
    case "LOAD_SCFEN": {
      try {
        const snap = parseScFen(action.scfen);
        return seedFromSnap(snap, action.stored ?? 12);
      } catch (err) {
        return {
          ...state,
          phase: "loading",
          statusText: err instanceof Error ? err.message : "Invalid SCFEN",
        };
      }
    }
    case "LOAD_ERROR":
      return { ...state, phase: "loading", statusText: action.message };
    case "SELECT_SQUARE":
      if (state.phase !== "planning" && state.phase !== "targeting") return state;
      return { ...state, selected: action.square, legalDests: action.square ? state.legalDests : [] };
    case "SET_LEGAL_DESTS":
      return { ...state, legalDests: action.dests };
    case "QUEUE_ACTION": {
      if (state.phase !== "planning" && state.phase !== "targeting") return state;
      try {
        const { snapshot } = addScAction({
          snapshot: state.liveSnapshot,
          action: action.action,
        });
        return {
          ...state,
          phase: "planning",
          liveSnapshot: snapshot,
          targeting: null,
          selected: null,
          legalDests: [],
          pendingPromotion: null,
          statusText: "Action queued",
        };
      } catch (err) {
        const message =
          err instanceof AddScActionError ? err.message : "Could not queue action";
        return { ...state, statusText: message };
      }
    }
    case "QUEUE_REJECT":
      return { ...state, statusText: action.message };
    case "SET_PENDING_PROMOTION":
      if (state.phase !== "planning" && state.phase !== "targeting") return state;
      return { ...state, pendingPromotion: action.pending };
    case "CLEAR_PENDING_PROMOTION":
      return { ...state, pendingPromotion: null };
    case "REMOVE_ACTION": {
      if (state.phase !== "planning") return state;
      try {
        const { snapshot, removed } = removeScAction({
          snapshot: state.liveSnapshot,
          seq: action.seq,
        });
        const specialsUsed = new Set(state.specialsUsed);
        if (removed.timing !== "C") specialsUsed.delete(removed.from);
        return {
          ...state,
          liveSnapshot: snapshot,
          specialsUsed,
          statusText: "Action removed",
        };
      } catch {
        return state;
      }
    }
    case "OPEN_SPAWN":
      if (state.phase !== "planning" && state.phase !== "targeting") return state;
      return {
        ...state,
        phase: "targeting",
        targeting: { kind: "spawn", unit: action.unit, color: action.color },
        statusText: `Deploy ${action.unit}`,
      };
    case "OPEN_BISHOP_SNIPE":
      if (state.phase !== "planning" && state.phase !== "targeting") return state;
      return {
        ...state,
        phase: "targeting",
        targeting: {
          kind: "bishopSnipe",
          from: action.from,
          to: action.to,
          color: action.color,
        },
        statusText: `Charon Booster Missiles armed — click the queen on ${action.to}`,
      };
    case "OPEN_QUEEN_WARP":
      if (state.phase !== "planning" && state.phase !== "targeting") return state;
      return {
        ...state,
        phase: "targeting",
        targeting: {
          kind: "queenWarp",
          from: action.from,
          targets: action.targets,
          color: action.color,
        },
        statusText: `Tactical Jump armed — click a highlighted empty square`,
      };
    case "CANCEL_TARGET":
      return {
        ...state,
        phase: state.phase === "targeting" ? "planning" : state.phase,
        targeting: null,
        pendingPromotion: null,
        statusText: "Plan your turn",
      };
    case "MARK_SPECIAL_USED": {
      const next = new Set(state.specialsUsed);
      next.add(action.square);
      return { ...state, specialsUsed: next };
    }
    case "APPLY_SNAPSHOT": {
      if (state.phase !== "planning" && state.phase !== "targeting") return state;
      return {
        ...state,
        phase: "planning",
        liveSnapshot: action.snapshot,
        siegedRooks: new Set(action.snapshot.siegedRooks ?? []),
        // Keep planning-window arm marks — never import snap `U:` (enemy aura).
        targeting: null,
        selected: null,
        legalDests: [],
      };
    }
    case "SPEND_STORED": {
      const eco = state.economies[action.color];
      if (eco.stored < action.amount) return state;
      return {
        ...state,
        economies: {
          ...state.economies,
          [action.color]: {
            stored: eco.stored - action.amount,
            deployed: eco.deployed + action.amount,
          },
        },
      };
    }
    case "REFUND_STORED": {
      const eco = state.economies[action.color];
      return {
        ...state,
        economies: {
          ...state.economies,
          [action.color]: {
            stored: Math.min(MAX_STORED_MATERIAL, eco.stored + action.amount),
            deployed: Math.max(0, eco.deployed - action.amount),
          },
        },
      };
    }
    case "SUBMIT_TURN": {
      if (state.phase !== "planning" && state.phase !== "targeting") return state;
      let snap = state.liveSnapshot;
      // Timeout / End with the picker open → default Battlecruiser (queen).
      const pending = state.pendingPromotion;
      if (pending) {
        try {
          snap = addScAction({
            snapshot: snap,
            action: {
              timing: "C",
              kind: "classical",
              color: pending.color,
              from: pending.from,
              to: pending.to,
              promotion: "q",
            },
          }).snapshot;
        } catch {
          // Already queued / illegal — resolve whatever is on the board.
        }
      }
      try {
        const result = endScTurn(snap, {
          skipTurnStartChecks: state.turnStartChecksApplied,
        });
        return {
          ...state,
          phase: "resolving",
          liveSnapshot: snap,
          targeting: null,
          selected: null,
          legalDests: [],
          pendingPromotion: null,
          deadlineAt: null,
          lastResolve: result,
          statusText: action.reason === "timeout" ? "Time — resolving…" : "Resolving…",
        };
      } catch (err) {
        return {
          ...state,
          pendingPromotion: null,
          statusText: err instanceof Error ? err.message : "Resolve failed",
        };
      }
    }
    case "RESOLVE_READY":
      return {
        ...state,
        lastResolve: action.result,
        phase: "resolving",
        statusText: "Resolving…",
      };
    case "REFILL_GAS": {
      // Turn-open: vespene arrives with the check chip (or no-check arm).
      const live = refillTurnGas(state.liveSnapshot);
      if (state.phase === "gameOver") {
        const snaps = [...state.settledSnapshots];
        const cur = snaps[state.reviewIndex];
        if (cur) snaps[state.reviewIndex] = refillTurnGas(cur);
        return { ...state, liveSnapshot: live, settledSnapshots: snaps };
      }
      return { ...state, liveSnapshot: live };
    }
    case "MARK_CHECKS_APPLIED":
      return {
        ...state,
        turnStartChecksApplied: true,
        statusText:
          state.statusText === "Plan your turn" || state.phase === "planning"
            ? "Plan your turn"
            : state.statusText,
      };
    case "BEGIN_CHECKS_DONE": {
      const result = state.lastResolve;
      if (!result) {
        return {
          ...state,
          phase: "planning",
          turnStartChecksApplied: true,
          timeline: emptyTimeline(),
          statusText: "Plan your turn",
        };
      }
      const next = result.next;
      const outcome = next.phase === "O" ? scOutcome(next) : null;
      // Turn-open checks are their own history ply so DualNav review replays
      // chip → (later) End, instead of folding HP into the following End.
      return {
        ...state,
        phase: outcome ? "gameOver" : "planning",
        liveSnapshot: next,
        turnStartChecksApplied: !outcome,
        siegedRooks: new Set(next.siegedRooks ?? []),
        timeline: emptyTimeline(),
        outcome,
        settledSnapshots: [...state.settledSnapshots, next],
        settledResolves: [...state.settledResolves, result],
        reviewIndex: state.settledSnapshots.length,
        lastResolve: null,
        statusText: outcome
          ? outcome.draw
            ? "Draw"
            : `${outcome.winner === "w" ? "White" : "Black"} wins`
          : "Plan your turn",
        selected: null,
        legalDests: [],
        targeting: null,
        deadlineAt: outcome ? null : state.deadlineAt,
      };
    }
    case "TIMELINE_START":
      return {
        ...state,
        // Terminal review replay stays in `gameOver` so DualNav chrome remains.
        phase: state.phase === "gameOver" ? "gameOver" : "resolving",
        timeline: {
          active: true,
          cues: action.cues,
          playingIds: [],
          hiddenSquares: new Set(),
          moveProgress: {},
          moveLeg: {},
          jumpTrails: [],
          displayPlacement: action.placement,
          displayKingLives: null,
          displayMines: null,
          displaySiegedRooks: null,
        },
      };
    case "TIMELINE_COMMIT": {
      const hidden = new Set(action.hidden ?? [...state.timeline.hiddenSquares]);
      if (state.phase === "gameOver") {
        // Review replay: board reads timeline overlays; never mutate live/outcome.
        return {
          ...state,
          siegedRooks: action.siegedRooks
            ? new Set(action.siegedRooks)
            : state.siegedRooks,
          timeline: {
            ...state.timeline,
            playingIds:
              action.playingIds !== undefined
                ? [...action.playingIds]
                : state.timeline.playingIds,
            hiddenSquares: hidden,
            moveProgress:
              action.moveProgress !== undefined
                ? action.moveProgress
                : state.timeline.moveProgress,
            moveLeg:
              action.moveLeg !== undefined
                ? action.moveLeg
                : state.timeline.moveLeg,
            jumpTrails:
              action.jumpTrails !== undefined
                ? [...action.jumpTrails]
                : state.timeline.jumpTrails,
            displayPlacement: action.placement ?? state.timeline.displayPlacement,
            displayKingLives:
              action.kingLives ?? state.timeline.displayKingLives,
            displayMines:
              action.mines !== undefined
                ? action.mines
                : state.timeline.displayMines,
            displaySiegedRooks:
              action.siegedRooks !== undefined
                ? [...action.siegedRooks]
                : state.timeline.displaySiegedRooks,
          },
        };
      }
      const snap = state.liveSnapshot;
      const sieged = action.siegedRooks
        ? new Set(action.siegedRooks)
        : state.siegedRooks;
      return {
        ...state,
        liveSnapshot: {
          ...snap,
          placement: action.placement ?? snap.placement,
          kingLives: action.kingLives ?? snap.kingLives,
          mines: action.mines ?? snap.mines,
          siegedRooks: action.siegedRooks
            ? [...action.siegedRooks]
            : snap.siegedRooks,
        },
        siegedRooks: sieged,
        timeline: {
          ...state.timeline,
          playingIds:
            action.playingIds !== undefined
              ? [...action.playingIds]
              : state.timeline.playingIds,
          hiddenSquares: hidden,
          moveProgress:
            action.moveProgress !== undefined
              ? action.moveProgress
              : state.timeline.moveProgress,
          moveLeg:
            action.moveLeg !== undefined
              ? action.moveLeg
              : state.timeline.moveLeg,
          jumpTrails:
            action.jumpTrails !== undefined
              ? [...action.jumpTrails]
              : state.timeline.jumpTrails,
          displayPlacement: action.placement ?? state.timeline.displayPlacement,
          displayKingLives: null,
          displayMines: null,
          displaySiegedRooks: null,
        },
      };
    }
    case "TIMELINE_DONE": {
      // Terminal DualNav finished replaying a stored resolve.
      if (state.phase === "gameOver") {
        const max = state.settledSnapshots.length - 1;
        const nextIndex = Math.min(state.reviewIndex + 1, Math.max(0, max));
        const settled = state.settledSnapshots[nextIndex];
        if (!settled) {
          return {
            ...state,
            lastResolve: null,
            timeline: emptyTimeline(),
          };
        }
        return {
          ...state,
          reviewIndex: nextIndex,
          lastResolve: null,
          timeline: emptyTimeline(),
          // Arm marks are live-planning only — do not import snap `U:`.
          specialsUsed: new Set(),
          siegedRooks: new Set(settled.siegedRooks ?? []),
          statusText: reviewStatus(nextIndex, max),
        };
      }
      const result = state.lastResolve;
      if (!result) {
        return {
          ...state,
          phase: "planning",
          timeline: emptyTimeline(),
          statusText: "Plan your turn",
        };
      }
      const next = result.next;
      const outcome = next.phase === "O" ? scOutcome(next) : null;
      const economies =
        next.turn > state.liveSnapshot.turn
          ? grantIncome(state.economies, next.turn)
          : state.economies;
      return {
        ...state,
        phase: outcome ? "gameOver" : "planning",
        liveSnapshot: next,
        turnStartChecksApplied: false,
        economies,
        // Fresh arm marks — prior-turn `U:` stays on liveSnapshot for enemy aura/fog only.
        specialsUsed: new Set(),
        siegedRooks: new Set(next.siegedRooks ?? []),
        timeline: emptyTimeline(),
        outcome,
        settledSnapshots: [...state.settledSnapshots, next],
        settledResolves: [...state.settledResolves, result],
        reviewIndex: state.settledSnapshots.length,
        lastResolve: null,
        statusText: outcome
          ? outcome.draw
            ? "Draw"
            : `${outcome.winner === "w" ? "White" : "Black"} wins`
          : "Plan your turn",
        selected: null,
        legalDests: [],
        targeting: null,
        deadlineAt: outcome ? null : state.deadlineAt,
      };
    }
    case "REVIEW_PLAY": {
      if (state.phase !== "gameOver" || state.timeline.active) return state;
      return {
        ...state,
        lastResolve: action.result,
        statusText: "Reviewing…",
      };
    }
    case "REVIEW_SEEK": {
      if (state.phase !== "gameOver") return state;
      const max = state.settledSnapshots.length - 1;
      if (max < 0) return state;
      const index = Math.max(0, Math.min(max, action.index));
      const settled = state.settledSnapshots[index];
      if (!settled) return state;
      return {
        ...state,
        reviewIndex: index,
        lastResolve: null,
        // Arm marks are live-planning only — do not import snap `U:`.
        specialsUsed: new Set(),
        siegedRooks: new Set(settled.siegedRooks ?? []),
        timeline: emptyTimeline(),
        targeting: null,
        selected: null,
        legalDests: [],
        deadlineAt: null,
        statusText: reviewStatus(index, max),
      };
    }
    case "SET_VIEWER":
      return { ...state, viewer: action.viewer };
    case "SET_DEADLINE":
      return { ...state, deadlineAt: action.at };
    case "CANCEL_EFFECTS":
      return {
        ...state,
        deadlineAt: null,
        timeline: emptyTimeline(),
        targeting: null,
        selected: null,
        legalDests: [],
        phase:
          state.phase === "resolving"
            ? state.outcome
              ? "gameOver"
              : "planning"
            : state.phase,
      };
    default:
      return state;
  }
};

export const spawnCost = (unit: keyof typeof UNIT_COST) => UNIT_COST[unit];
