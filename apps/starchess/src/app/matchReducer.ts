/**
 * Match state transitions — queue, End, timeline, review seek.
 * // SPEC: _spec/apps/starchess/match-store.puml, _spec/apps/starchess/core/turn/match-state-machine.puml, _spec/apps/starchess/core/index.puml
 * // SPEC: _spec/packages/starchess-core/turn-queue-sequence.puml, _spec/apps/starchess/architecture/timeline-perf.puml
 */
import {
  MAX_STORED_MATERIAL,
  UNIT_COST,
  addScAction,
  AddScActionError,
  beginScTurn,
  endScTurn,
  parseScFen,
  refillTurnGas,
  removeScAction,
  scOutcome,
  type PlayerEconomy,
  type ScFenSnapshot,
  type StarChessColor,
} from "@chess-coach/starchess-core";

import { OPENING_STORED_MATERIAL, applyTurnIncome } from "~/app/matchEconomy";
import type { MatchAction, MatchState, TimelineState } from "~/app/matchTypes";
import {
  withHiddenSquares,
  withIdList,
  withShallowRecord,
  withSquareList,
  withSquareSet,
  withTrails,
} from "~/app/timelineStructuralShare";

const emptyTimeline = (placement: string | null = null): TimelineState => ({
  active: false,
  cues: [],
  playingIds: [],
  attackDying: {},
  hiddenSquares: new Set(),
  moveProgress: {},
  moveLeg: {},
  jumpTrails: [],
  mineMissileTrails: [],
  spentMines: [],
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

/** Stamp SCFEN `B:` bank from host economies (source of truth on the wire). */
export const stampSnapStored = (
  snap: ScFenSnapshot,
  economies: Record<StarChessColor, PlayerEconomy>,
): ScFenSnapshot => ({
  ...snap,
  stored: { w: economies.w.stored, b: economies.b.stored },
});

const economiesFromSnap = (
  snap: ScFenSnapshot,
  fallback: number,
): Record<StarChessColor, PlayerEconomy> => ({
  w: { stored: snap.stored?.w ?? fallback, deployed: 0 },
  b: { stored: snap.stored?.b ?? fallback, deployed: 0 },
});

/** Sync host economies to a settled snap's SCFEN `B:` (review cursor). */
const syncEconomiesToSnap = (
  snap: ScFenSnapshot,
  prev: Record<StarChessColor, PlayerEconomy>,
): Record<StarChessColor, PlayerEconomy> => {
  if (!snap.stored) return prev;
  return {
    w: { stored: snap.stored.w, deployed: prev.w.deployed },
    b: { stored: snap.stored.b, deployed: prev.b.deployed },
  };
};

const grantIncome = (
  economies: Record<StarChessColor, PlayerEconomy>,
  turn: number,
): Record<StarChessColor, PlayerEconomy> => {
  const bank = applyTurnIncome(
    { w: economies.w.stored, b: economies.b.stored },
    turn,
  );
  if (bank.w === economies.w.stored && bank.b === economies.b.stored) {
    return economies;
  }
  return {
    w: { stored: bank.w, deployed: economies.w.deployed },
    b: { stored: bank.b, deployed: economies.b.deployed },
  };
};

const seedFromSnap = (snap: ScFenSnapshot, stored: number): MatchState => {
  const outcome = snap.phase === "O" ? scOutcome(snap) : null;
  const economies = economiesFromSnap(snap, stored);
  const stamped = stampSnapStored(snap, economies);
  return {
    phase: outcome ? "gameOver" : "planning",
    liveSnapshot: stamped,
    economies,
    planningMineralSpend: { w: 0, b: 0 },
    viewer: "w",
    playerColor: "w",
    deadlineAt: null,
    targeting: null,
    // Armed specials this planning window only — not snap `U:` (enemy fog pierce).
    specialsUsed: new Set(),
    siegedRooks: new Set(snap.siegedRooks ?? []),
    timeline: emptyTimeline(),
    outcome,
    settledSnapshots: [stamped],
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
    turnBonus: null,
    lastAnnouncedBonusTurn: 0,
  };
};

export const createInitialMatchState = (): MatchState => {
  const snap = parseScFen(
    `SCFEN|4k3/8/8/8/8/8/8/4K3|0|33|P|G:11:11|B:${OPENING_STORED_MATERIAL}:${OPENING_STORED_MATERIAL}|Q:w:;b:`,
  );
  return seedFromSnap(snap, OPENING_STORED_MATERIAL);
};

/** Seed a match from SCFEN (Storybook / deep-link) before the screen mounts. */
export const createMatchStateFromScfen = (
  scfen: string,
  stored = OPENING_STORED_MATERIAL,
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
        return seedFromSnap(snap, action.stored ?? OPENING_STORED_MATERIAL);
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
      return {
        ...state,
        selected: action.square,
        legalDests: action.square ? state.legalDests : [],
      };
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
          liveSnapshot: stampSnapStored(snapshot, state.economies),
          targeting: null,
          selected: null,
          legalDests: [],
          pendingPromotion: null,
          statusText: "Action queued",
        };
      } catch (err) {
        const message = err instanceof AddScActionError ? err.message : "Could not queue action";
        return { ...state, statusText: message };
      }
    }
    case "QUEUE_REJECT":
      return { ...state, statusText: action.message };
    case "SET_PENDING_PROMOTION":
      if (state.phase !== "planning" && state.phase !== "targeting") return state;
      return {
        ...state,
        // Same intent chrome as Deploy / Charon / Jump — TurnBar + board frame.
        phase: "targeting",
        targeting: null,
        pendingPromotion: action.pending,
        statusText: `Promote ${action.pending.from}→${action.pending.to} — pick a unit`,
      };
    case "CLEAR_PENDING_PROMOTION":
      return {
        ...state,
        pendingPromotion: null,
        phase: state.phase === "targeting" && !state.targeting ? "planning" : state.phase,
        statusText:
          state.phase === "targeting" && !state.targeting ? "Plan your turn" : state.statusText,
      };
    case "REMOVE_ACTION": {
      if (state.phase !== "planning") return state;
      try {
        const { snapshot, removed } = removeScAction({
          snapshot: state.liveSnapshot,
          seq: action.seq,
        });
        const specialsUsed = new Set(state.specialsUsed);
        if (removed.timing !== "C") specialsUsed.delete(removed.from);
        // Cancelling a Command-Center deploy returns the minerals invested in
        // it this planning window only — seeded/deep-link spawns never spent a
        // bank, so issuing them a refund would inflate the bank. Gas refunds
        // live in core removeScAction.
        let economies = state.economies;
        let planningMineralSpend = state.planningMineralSpend;
        if (removed.kind === "spawn" && removed.unit != null) {
          const refund = Math.min(
            UNIT_COST[removed.unit],
            planningMineralSpend[removed.color],
          );
          if (refund > 0) {
            const eco = economies[removed.color];
            economies = {
              ...economies,
              [removed.color]: {
                stored: Math.min(MAX_STORED_MATERIAL, eco.stored + refund),
                deployed: Math.max(0, eco.deployed - refund),
              },
            };
            planningMineralSpend = {
              ...planningMineralSpend,
              [removed.color]:
                planningMineralSpend[removed.color] - refund,
            };
          }
        }
        return {
          ...state,
          liveSnapshot: stampSnapStored(snapshot, economies),
          economies,
          planningMineralSpend,
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
          targets: action.targets,
          color: action.color,
        },
        statusText: `Charon Booster Missiles armed — click a diagonal square`,
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
        liveSnapshot: stampSnapStored(action.snapshot, state.economies),
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
      const economies = {
        ...state.economies,
        [action.color]: {
          stored: eco.stored - action.amount,
          deployed: eco.deployed + action.amount,
        },
      };
      return {
        ...state,
        economies,
        planningMineralSpend: {
          ...state.planningMineralSpend,
          [action.color]: state.planningMineralSpend[action.color] + action.amount,
        },
        liveSnapshot: stampSnapStored(state.liveSnapshot, economies),
      };
    }
    case "REFUND_STORED": {
      const eco = state.economies[action.color];
      const economies = {
        ...state.economies,
        [action.color]: {
          stored: Math.min(MAX_STORED_MATERIAL, eco.stored + action.amount),
          deployed: Math.max(0, eco.deployed - action.amount),
        },
      };
      return {
        ...state,
        economies,
        planningMineralSpend: {
          ...state.planningMineralSpend,
          [action.color]: Math.max(
            0,
            state.planningMineralSpend[action.color] - action.amount,
          ),
        },
        liveSnapshot: stampSnapStored(state.liveSnapshot, economies),
      };
    }
    case "SUBMIT_TURN": {
      if (state.phase !== "planning" && state.phase !== "targeting") return state;
      let snap = state.liveSnapshot;
      // Timeout / End with the picker open → default BattleShip (queen).
      const pending = state.pendingPromotion;
      if (pending) {
        try {
          snap = addScAction({
            snapshot: snap,
            action:
              pending.via === "gas"
                ? {
                    timing: "B",
                    kind: "pawnDouble",
                    color: pending.color,
                    from: pending.from,
                    to: pending.to,
                    promotion: "q",
                  }
                : {
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
          liveSnapshot: stampSnapStored(snap, state.economies),
          targeting: null,
          selected: null,
          legalDests: [],
          pendingPromotion: null,
          deadlineAt: null,
          turnBonus: null,
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
    case "TURN_OPEN": {
      // SPEC: sole beginScTurn owner — MatchStore dispatches only.
      if (state.phase !== "planning" && state.phase !== "targeting") return state;
      if (state.turnStartChecksApplied) return state;
      const stripUsed = (s: ScFenSnapshot): ScFenSnapshot => {
        if (!s.specialsUsed?.length) return s;
        const { specialsUsed: _drop, ...rest } = s;
        return rest;
      };
      const refillLive = (s: MatchState): MatchState => {
        const live = stampSnapStored(
          stripUsed(refillTurnGas(s.liveSnapshot)),
          s.economies,
        );
        // New planning window — the mineral-spend ledger restarts.
        return { ...s, liveSnapshot: live, planningMineralSpend: { w: 0, b: 0 } };
      };
      try {
        const begun = beginScTurn(state.liveSnapshot);
        const refilled = refillLive(state);
        if (!begun.changed || !begun.asResolve) {
          return {
            ...refilled,
            turnStartChecksApplied: true,
            statusText: "Plan your turn",
          };
        }
        return {
          ...refilled,
          lastResolve: begun.asResolve,
          phase: "resolving",
          statusText: "Resolving…",
        };
      } catch {
        return {
          ...refillLive(state),
          turnStartChecksApplied: true,
          statusText: "Plan your turn",
        };
      }
    }
    case "REFILL_GAS": {
      // Turn-open: vespene arrives with the check chip (or no-check arm).
      // U: green aura ends here — same moment as beginScTurn clearing stamps.
      const stripUsed = (s: ScFenSnapshot): ScFenSnapshot => {
        if (!s.specialsUsed?.length) return s;
        const { specialsUsed: _drop, ...rest } = s;
        return rest;
      };
      if (state.phase === "gameOver") {
        // DualNav: refill gas on the cursor snap only — keep that snap's `B:` bank.
        // Never stamp terminal economies (was overwriting Start/mid with 12).
        const snaps = [...state.settledSnapshots];
        const cur = snaps[state.reviewIndex];
        if (!cur) return state;
        const bank = cur.stored;
        const refilled = stripUsed(refillTurnGas(cur));
        const nextSnap: ScFenSnapshot = bank
          ? { ...refilled, stored: { ...bank } }
          : stampSnapStored(refilled, state.economies);
        snaps[state.reviewIndex] = nextSnap;
        return {
          ...state,
          liveSnapshot: nextSnap,
          settledSnapshots: snaps,
          economies: syncEconomiesToSnap(nextSnap, state.economies),
        };
      }
      const live = stampSnapStored(
        stripUsed(refillTurnGas(state.liveSnapshot)),
        state.economies,
      );
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
      const next = stampSnapStored(result.next, state.economies);
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
          attackDying: {},
          hiddenSquares: new Set(),
          moveProgress: {},
          moveLeg: {},
          // Keep fading Tactical Jump / mine chase trails across resolve handoff.
          jumpTrails: [...state.timeline.jumpTrails],
          mineMissileTrails: [...state.timeline.mineMissileTrails],
          spentMines: [],
          displayPlacement: action.placement,
          displayKingLives: null,
          displayMines: null,
          displaySiegedRooks: null,
        },
      };
    case "TIMELINE_COMMIT": {
      const tl = state.timeline;
      const hidden = withHiddenSquares(tl.hiddenSquares, action.hidden);
      const playingIds = withIdList(tl.playingIds, action.playingIds);
      const attackDying = withShallowRecord(tl.attackDying, action.attackDying);
      const moveProgress = withShallowRecord(tl.moveProgress, action.moveProgress);
      const moveLeg = withShallowRecord(tl.moveLeg, action.moveLeg);
      const jumpTrails = withTrails(tl.jumpTrails, action.jumpTrails);
      const mineMissileTrails = withTrails(tl.mineMissileTrails, action.mineMissileTrails);
      const spentMines = withSquareList(tl.spentMines, action.spentMines);
      const siegedRooks = withSquareSet(state.siegedRooks, action.siegedRooks);

      if (state.phase === "gameOver") {
        // Review replay: board reads timeline overlays; never mutate live/outcome.
        const displayPlacement = action.placement ?? tl.displayPlacement;
        const displayKingLives = action.kingLives ?? tl.displayKingLives;
        const displayMines = action.mines !== undefined ? action.mines : tl.displayMines;
        const displaySiegedRooks =
          action.siegedRooks !== undefined
            ? withSquareList(tl.displaySiegedRooks ?? [], action.siegedRooks)
            : tl.displaySiegedRooks;
        return {
          ...state,
          siegedRooks,
          timeline: {
            ...tl,
            playingIds,
            attackDying,
            hiddenSquares: hidden,
            moveProgress,
            moveLeg,
            jumpTrails,
            mineMissileTrails,
            spentMines,
            displayPlacement,
            displayKingLives,
            displayMines,
            displaySiegedRooks,
          },
        };
      }
      const snap = state.liveSnapshot;
      const nextPlacement = action.placement ?? snap.placement;
      const nextLives = action.kingLives ?? snap.kingLives;
      const nextMines = action.mines ?? snap.mines;
      const nextSiegedList = action.siegedRooks
        ? withSquareList(snap.siegedRooks ?? [], action.siegedRooks)
        : (snap.siegedRooks ?? []);
      const snapTouched =
        action.placement !== undefined ||
        action.kingLives !== undefined ||
        action.mines !== undefined ||
        action.siegedRooks !== undefined ||
        action.specialsUsed !== undefined;
      let liveSnapshot: ScFenSnapshot = snap;
      if (snapTouched) {
        liveSnapshot = {
          ...snap,
          placement: nextPlacement,
          kingLives: nextLives,
          mines: nextMines,
          siegedRooks: nextSiegedList,
        };
        if (action.specialsUsed !== undefined) {
          if (action.specialsUsed.length > 0) {
            liveSnapshot.specialsUsed = [...action.specialsUsed];
          } else {
            delete liveSnapshot.specialsUsed;
          }
        }
        liveSnapshot = stampSnapStored(liveSnapshot, state.economies);
      }
      return {
        ...state,
        liveSnapshot,
        siegedRooks,
        timeline: {
          ...tl,
          playingIds,
          attackDying,
          hiddenSquares: hidden,
          moveProgress,
          moveLeg,
          jumpTrails,
          mineMissileTrails,
          spentMines,
          displayPlacement: action.placement ?? tl.displayPlacement,
          displayKingLives: null,
          displayMines: null,
          displaySiegedRooks: null,
        },
      };
    }
    case "TIMELINE_SOFT_DONE": {
      // Mid-wave tutorial pause — keep board overlays, allow next REVIEW_PLAY.
      return {
        ...state,
        timeline: {
          ...state.timeline,
          active: false,
          cues: [],
          playingIds: [],
          attackDying: {},
          hiddenSquares: new Set(),
          moveProgress: {},
          moveLeg: {},
        },
      };
    }
    case "TIMELINE_DONE": {
      // Jump / mine-chase trails keep fading after hull cues end — preserve across reset.
      const lingeringJumpTrails = [...state.timeline.jumpTrails];
      const lingeringMineTrails = [...state.timeline.mineMissileTrails];
      // Terminal DualNav finished replaying a stored resolve.
      if (state.phase === "gameOver") {
        const max = state.settledSnapshots.length - 1;
        const nextIndex = Math.min(state.reviewIndex + 1, Math.max(0, max));
        const settled = state.settledSnapshots[nextIndex];
        if (!settled) {
          return {
            ...state,
            lastResolve: null,
            timeline: {
              ...emptyTimeline(),
              jumpTrails: lingeringJumpTrails,
              mineMissileTrails: lingeringMineTrails,
            },
          };
        }
        const economies = syncEconomiesToSnap(settled, state.economies);
        return {
          ...state,
          reviewIndex: nextIndex,
          lastResolve: null,
          // Keep terminal liveSnapshot; DualNav display uses settled[reviewIndex].
          economies,
          timeline: {
            ...emptyTimeline(),
            jumpTrails: lingeringJumpTrails,
            mineMissileTrails: lingeringMineTrails,
          },
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
          timeline: {
            ...emptyTimeline(),
            jumpTrails: lingeringJumpTrails,
            mineMissileTrails: lingeringMineTrails,
          },
          statusText: "Plan your turn",
        };
      }
      const next = result.next;
      const outcome = next.phase === "O" ? scOutcome(next) : null;
      const economies =
        next.turn > state.liveSnapshot.turn
          ? grantIncome(state.economies, next.turn)
          : state.economies;
      const stampedNext = stampSnapStored(next, economies);
      return {
        ...state,
        phase: outcome ? "gameOver" : "planning",
        liveSnapshot: stampedNext,
        turnStartChecksApplied: false,
        economies,
        // Fresh arm marks — snap `U:` carries green until turn-open checks.
        specialsUsed: new Set(),
        siegedRooks: new Set(next.siegedRooks ?? []),
        timeline: {
          ...emptyTimeline(),
          jumpTrails: lingeringJumpTrails,
          mineMissileTrails: lingeringMineTrails,
        },
        outcome,
        settledSnapshots: [...state.settledSnapshots, stampedNext],
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
      const economies = syncEconomiesToSnap(settled, state.economies);
      return {
        ...state,
        reviewIndex: index,
        lastResolve: null,
        // Keep terminal liveSnapshot; DualNav display uses settled[reviewIndex].
        economies,
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
    case "SET_PLAYER_COLOR":
      return { ...state, playerColor: action.playerColor };
    case "SET_DEADLINE":
      return { ...state, deadlineAt: action.at };
    case "SHOW_TURN_BONUS": {
      if (state.phase !== "planning" && state.phase !== "targeting") return state;
      if (action.bonus.turn <= state.lastAnnouncedBonusTurn) return state;
      return {
        ...state,
        turnBonus: action.bonus,
        lastAnnouncedBonusTurn: action.bonus.turn,
      };
    }
    case "HIDE_TURN_BONUS": {
      if (!state.turnBonus) return state;
      return { ...state, turnBonus: null };
    }
    case "CANCEL_EFFECTS":
      return {
        ...state,
        deadlineAt: null,
        turnBonus: null,
        timeline: emptyTimeline(),
        targeting: null,
        selected: null,
        legalDests: [],
        phase:
          state.phase === "resolving" ? (state.outcome ? "gameOver" : "planning") : state.phase,
      };
    default:
      return state;
  }
};

export const spawnCost = (unit: keyof typeof UNIT_COST) => UNIT_COST[unit];
