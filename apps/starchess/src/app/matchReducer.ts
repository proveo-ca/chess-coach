import {
  MAX_STORED_MATERIAL,
  UNIT_COST,
  addScAction,
  AddScActionError,
  endScTurn,
  incomeForTurn,
  parseScFen,
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
  hiddenSquares: new Set(),
  displayPlacement: placement,
});

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
    specialsUsed: new Set(snap.specialsUsed ?? []),
    siegedRooks: new Set(snap.siegedRooks ?? []),
    timeline: emptyTimeline(),
    outcome,
    settledSnapshots: [snap],
    reviewIndex: 0,
    statusText: outcome
      ? outcome.draw
        ? "Draw"
        : `${outcome.winner === "w" ? "White" : "Black"} wins`
      : "Plan your turn",
    lastResolve: null,
    selected: null,
    legalDests: [],
  };
};

export const createInitialMatchState = (): MatchState => {
  const snap = parseScFen(
    "SCFEN|4k3/8/8/8/8/8/8/4K3|0|33|P|G:11:11|Q:w:;b:",
  );
  return seedFromSnap(snap, 12);
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
    case "REMOVE_ACTION": {
      if (state.phase !== "planning") return state;
      try {
        const { snapshot } = removeScAction({
          snapshot: state.liveSnapshot,
          seq: action.seq,
        });
        return { ...state, liveSnapshot: snapshot, statusText: "Action removed" };
      } catch {
        return state;
      }
    }
    case "OPEN_SPAWN":
      if (state.phase !== "planning") return state;
      return {
        ...state,
        phase: "targeting",
        targeting: { kind: "spawn", unit: action.unit, color: action.color },
        statusText: `Deploy ${action.unit}`,
      };
    case "CANCEL_TARGET":
      return {
        ...state,
        phase: state.phase === "targeting" ? "planning" : state.phase,
        targeting: null,
        statusText: "Plan your turn",
      };
    case "MARK_SPECIAL_USED": {
      const next = new Set(state.specialsUsed);
      next.add(action.square);
      return { ...state, specialsUsed: next };
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
    case "SUBMIT_TURN": {
      if (state.phase !== "planning" && state.phase !== "targeting") return state;
      try {
        const result = endScTurn(state.liveSnapshot);
        return {
          ...state,
          phase: "resolving",
          targeting: null,
          selected: null,
          legalDests: [],
          deadlineAt: null,
          lastResolve: result,
          statusText: action.reason === "timeout" ? "Time — resolving…" : "Resolving…",
        };
      } catch (err) {
        return {
          ...state,
          statusText: err instanceof Error ? err.message : "Resolve failed",
        };
      }
    }
    case "RESOLVE_READY":
      return { ...state, lastResolve: action.result, phase: "resolving" };
    case "TIMELINE_START":
      return {
        ...state,
        phase: "resolving",
        timeline: {
          active: true,
          cues: action.cues,
          hiddenSquares: new Set(),
          displayPlacement: action.placement,
        },
      };
    case "TIMELINE_COMMIT": {
      const hidden = new Set(action.hidden ?? [...state.timeline.hiddenSquares]);
      const snap = state.liveSnapshot;
      return {
        ...state,
        liveSnapshot: {
          ...snap,
          placement: action.placement ?? snap.placement,
          kingLives: action.kingLives ?? snap.kingLives,
          mines: action.mines ?? snap.mines,
        },
        timeline: {
          ...state.timeline,
          hiddenSquares: hidden,
          displayPlacement: action.placement ?? state.timeline.displayPlacement,
        },
      };
    }
    case "TIMELINE_DONE": {
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
        economies,
        specialsUsed: new Set(next.specialsUsed ?? []),
        siegedRooks: new Set(next.siegedRooks ?? []),
        timeline: emptyTimeline(),
        outcome,
        settledSnapshots: [...state.settledSnapshots, next],
        reviewIndex: state.settledSnapshots.length,
        lastResolve: null,
        statusText: outcome
          ? outcome.draw
            ? "Draw"
            : `${outcome.winner === "w" ? "White" : "Black"} wins`
          : "Plan your turn",
        selected: null,
        legalDests: [],
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
