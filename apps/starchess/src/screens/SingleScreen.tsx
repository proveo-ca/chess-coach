// SPEC: _spec/apps/starchess/menu-flow.puml, _spec/apps/starchess/screens.puml, _spec/apps/starchess/deployment.puml, _spec/apps/starchess/architecture/screen-entities.puml, _spec/_plans/forfeit-as-loss.puml, _spec/_plans/starchess-achievements.puml
/**
 * Single-player match — `/starchess/single?map=&team=` (+ optional `scfen=`).
 * Adjutant script always plays the opposite of `team` (White or Black).
 * Persists SCFEN + playerColor to localStorage for refresh resume.
 * On gameOver: save match history, show VICTORY/DEFEAT modal
 * (Another Game = rematch same map/team · Replay = `/review/:id`).
 */
import { useNavigate, useSearchParams } from "@solidjs/router";
import {
  adjutant,
  seedCcIntelForOpening,
  seedKvsForOpening,
  seedAttackerMemory,
  seedRunnerMemory,
  strategicAdjutant,
  updateAttackersForSnap,
  updateCcIntelForSnap,
  updateKvsForSnap,
  updateRunnersForSnap,
  witnessFromEndTurn,
} from "@chess-coach/starchess-core";
import type {
  AttackerMemoryState,
  CcIntelState,
  KvsState,
  RunnerMemoryState,
  ScFenSnapshot,
} from "@chess-coach/starchess-core";
import type { StarChessColor } from "@chess-coach/starchess-core";
import { Show, createEffect, createSignal, onCleanup, type Component } from "solid-js";

import { browserLocation, readScfenQuery } from "~/adapters/browser";
import {
  ensureAchievementLive,
  finalizeAchievementLive,
  noteSettledPlies,
  achievementCursor,
  resetAchievementLive,
} from "~/achievements/achievementLive";
import { createMatchStore, MatchStoreProvider, useMatchStore } from "~/app/MatchStoreContext";
import { createMatchStateFromScfen } from "~/app/matchReducer";
import { BaseScreen } from "~/app/BaseScreen.tsx";
import { MatchResultModal } from "~/components/features/MatchResultModal";
import { NewAchievementsModal } from "~/components/features/NewAchievementsModal";
import { noteAchievementUnlocks } from "~/store/achievementStore";
import { LiveMatchShell } from "~/screens/LiveMatchShell";
import { STAR_STARTING_SCFEN } from "~/app/seeds";
import {
  addMatchRecord,
  makeMatchId,
  recordFromMatchState,
  resultForPlayer,
} from "~/store/matchHistoryStore";
import {
  clearMatchSession,
  loadMatchSession,
  matchSessionFromState,
  saveMatchSession,
} from "~/store/matchSessionStore";
import { playerName } from "~/store/settingsStore";
import type { BoardVariant } from "~/types/board";
import type { AchievementBubble } from "~/types/achievements";
import type { StarChessMatchResult } from "~/types/review";
import { isAdjutantKind, type AdjutantKind } from "~/types/newGame";
import { liveAdjutantMatchTitle } from "~/utils/matchTitle";

const MAPS: readonly BoardVariant[] = ["eclipse", "butter", "vermeer"];

const asOne = (raw: string | string[] | undefined): string | undefined =>
  Array.isArray(raw) ? raw[0] : raw;

const parseMap = (raw: string | string[] | undefined): BoardVariant => {
  const v = asOne(raw);
  return MAPS.includes(v as BoardVariant) ? (v as BoardVariant) : "eclipse";
};

const parseTeam = (raw: string | string[] | undefined): StarChessColor =>
  asOne(raw) === "b" ? "b" : "w";


type MatchBootstrap = {
  matchId: string;
  startedAt: string;
  scfen: string;
  storedW: number;
  storedB: number;
};

/** Resolve opening SCFEN + ids once per LiveMatchSession mount. */
const bootstrapMatch = (
  map: BoardVariant,
  team: StarChessColor,
  opponent: AdjutantKind,
  opts: { rematch: boolean },
): MatchBootstrap => {
  if (opts.rematch) {
    return {
      matchId: makeMatchId(),
      startedAt: new Date().toISOString(),
      scfen: STAR_STARTING_SCFEN,
      storedW: 3,
      storedB: 3,
    };
  }

  // Route separation: /single owns ?scfen= (singular) — /review owns ?game=/?scfens=.
  const queryScfen = readScfenQuery(browserLocation.search());
  const session = loadMatchSession();
  // A session for a different script is a different game — never resume it
  // onto the wrong opponent. Blobs predating the field resume as naive.
  const resume =
    !queryScfen &&
    session &&
    session.map === map &&
    session.playerColor === team &&
    (session.opponent ?? "naive") === opponent
      ? session
      : null;

  return {
    matchId: resume?.id ?? makeMatchId(),
    startedAt: resume?.startedAt ?? new Date().toISOString(),
    scfen: queryScfen ?? resume?.scfen ?? STAR_STARTING_SCFEN,
    storedW: resume?.economies.w.stored ?? 3,
    storedB: resume?.economies.b.stored ?? 3,
  };
};

const MatchInner: Component<{
  boardVariant: BoardVariant;
  team: StarChessColor;
  opponent: AdjutantKind;
  matchId: string;
  startedAt: string;
  onExitToMenu: () => void;
  onMatchFinished: (id: string, result: StarChessMatchResult, earned: readonly AchievementBubble[]) => void;
}> = (props) => {
  const store = useMatchStore();
  const opponentColor = (): StarChessColor => (props.team === "w" ? "b" : "w");
  let historySaved = false;

  // Cross-ply strategic state, folded once per turn (core owns the folds — the
  // arena threads the same four).
  let ccIntel: CcIntelState = seedCcIntelForOpening();
  let kvs: KvsState | null = null;
  let runnerMemory: RunnerMemoryState = seedRunnerMemory();
  let attackerMemory: AttackerMemoryState = seedAttackerMemory();
  let foldedTurn = -1;
  let foldedResolves = 0;

  const foldTracking = (snap: ScFenSnapshot) => {
    if (!kvs) kvs = seedKvsForOpening(snap);
    if (snap.turn === foldedTurn) return;
    foldedTurn = snap.turn;
    ccIntel = updateCcIntelForSnap(ccIntel, snap);
    kvs = updateKvsForSnap(kvs, snap);
  };

  /**
   * The two folds that read the resolve's own account of a ply — a marine that
   * only flew through our vision, and a shot fired from the dark — run off
   * `settledResolves`, which the reducer appends to exactly once per settled
   * ply (turn-open chip plies included). A cursor drains it so a re-render can
   * never fold the same ply twice, and the arena folds at the same two points.
   *
   * Declared *before* `<BaseScreen>` so it is created first and therefore runs
   * before the effect that asks the Adjutant to plan: a fold that landed after
   * would leave the opponent planning one ply behind its own memory. Keep it
   * here if this component is ever reorganised.
   */
  createEffect(() => {
    const settled = store.shell().settledResolves;
    if (settled.length <= foldedResolves) return;
    if (props.opponent !== "strategic") {
      // Nothing reads these memories under the naive script; skip the work
      // rather than folding two vision passes per side per ply for no one.
      foldedResolves = settled.length;
      return;
    }
    for (const esr of settled.slice(foldedResolves)) {
      const witness = witnessFromEndTurn(esr);
      runnerMemory = updateRunnersForSnap(runnerMemory, esr.next, witness);
      attackerMemory = updateAttackersForSnap(attackerMemory, esr.next, witness);
    }
    foldedResolves = settled.length;
  });

  // Keep SCFEN + playerColor warm in localStorage while this match is live.
  createEffect(() => {
    const s = store.state();
    void s.liveSnapshot;
    void s.economies.w.stored;
    void s.economies.b.stored;
    void s.phase;
    void s.playerColor;
    if (s.phase === "gameOver") return;
    saveMatchSession(
      matchSessionFromState(s, props.boardVariant, {
        id: props.matchId,
        startedAt: props.startedAt,
        opponent: props.opponent,
      }),
    );
  });

  // Terminal → persist DualNav package, then offer rematch / replay.
  // Achievement folds run first (declared above) so game end only finalizes.
  createEffect(() => {
    const shell = store.shell();
    const opening = shell.settledSnapshots[0];
    if (!opening) return;
    ensureAchievementLive(props.matchId, props.team, opening);
    const settled = shell.settledResolves;
    const cursor = achievementCursor();
    if (settled.length <= cursor) return;
    noteSettledPlies(
      settled.slice(cursor).map((esr, offset) => ({
        turn: esr.next.turn,
        placement: esr.next.placement,
        beforePlacement: shell.settledSnapshots[cursor + offset]?.placement,
        siegedRooks: esr.next.siegedRooks,
        kingLives: esr.next.kingLives,
        mines: esr.next.mines,
        events: esr.events,
        attacks: esr.resolved?.attacks,
        moves: esr.resolved?.moves,
        mineTriggers: esr.resolved?.mineTriggers,
        promotions: esr.resolved?.promotions,
      })),
    );
  });

  // Terminal → persist DualNav package, then offer rematch / replay.
  createEffect(() => {
    const s = store.state();
    if (s.phase !== "gameOver" || historySaved) return;
    const result = resultForPlayer(s);
    const record = recordFromMatchState(s, {
      id: props.matchId,
      startedAt: props.startedAt,
      map: props.boardVariant,
      playerName: playerName(),
      opponent: props.opponent,
    });
    if (!record || !result) return;
    historySaved = true;
    const earned = finalizeAchievementLive(result, props.opponent);
    addMatchRecord(record);
    clearMatchSession();
    props.onMatchFinished(props.matchId, result, earned);
  });

  onCleanup(() => {
    clearMatchSession();
    resetAchievementLive();
  });

  return (
    <BaseScreen
      boardVariant={props.boardVariant}
      starChessMode
      armTimer
      turnChrome="sidebar"
      matchTitle={liveAdjutantMatchTitle(props.opponent)}
      onExitToMenu={props.onExitToMenu}
      autoQueueOpponent={(snap) => {
        const color = opponentColor();
        const storedFor = (c: StarChessColor) => store.state().economies[c].stored;
        if (props.opponent !== "strategic") return adjutant(snap, { color, storedFor });
        foldTracking(snap);
        return strategicAdjutant(snap, {
          color,
          storedFor,
          kvs: kvs?.perSide[color],
          ccIntel: ccIntel.perSide[color],
          runnerMemory: runnerMemory.perSide[color],
          attackerMemory: attackerMemory.perSide[color],
        });
      }}
    />
  );
};

/** One live match instance — remount via `epoch` for Another Game. */
const LiveMatchSession: Component<{
  epoch: number;
  map: BoardVariant;
  team: StarChessColor;
  opponent: AdjutantKind;
  onExitToMenu: () => void;
  onMatchFinished: (id: string, result: StarChessMatchResult, earned: readonly AchievementBubble[]) => void;
}> = (props) => {
  const boot = bootstrapMatch(props.map, props.team, props.opponent, {
    rematch: props.epoch > 0,
  });
  const seeded = createMatchStateFromScfen(boot.scfen, boot.storedW);
  // Prefer SCFEN `B:` when present; else session / opening seed.
  const economies = {
    w: {
      stored: seeded.liveSnapshot.stored?.w ?? boot.storedW,
      deployed: seeded.economies.w.deployed,
    },
    b: {
      stored: seeded.liveSnapshot.stored?.b ?? boot.storedB,
      deployed: seeded.economies.b.deployed,
    },
  };
  const liveSnapshot = {
    ...seeded.liveSnapshot,
    stored: { w: economies.w.stored, b: economies.b.stored },
  };
  const store = createMatchStore({
    turnBonuses: true,
    initial: {
      ...seeded,
      viewer: props.team,
      playerColor: props.team,
      liveSnapshot,
      settledSnapshots: [liveSnapshot, ...seeded.settledSnapshots.slice(1)],
      economies,
    },
  });

  return (
    <MatchStoreProvider store={store}>
      <MatchInner
        boardVariant={props.map}
        team={props.team}
        opponent={props.opponent}
        matchId={boot.matchId}
        startedAt={boot.startedAt}
        onExitToMenu={props.onExitToMenu}
        onMatchFinished={props.onMatchFinished}
      />
    </MatchStoreProvider>
  );
};

export const SingleScreen: Component = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [matchEpoch, setMatchEpoch] = createSignal(0);
  const [resultOpen, setResultOpen] = createSignal(false);
  const [earnedOpen, setEarnedOpen] = createSignal(false);
  const [earned, setEarned] = createSignal<AchievementBubble[]>([]);
  const [result, setResult] = createSignal<StarChessMatchResult | null>(null);
  const [finishedId, setFinishedId] = createSignal<string | null>(null);

  const map = () => parseMap(params.map);
  const team = () => parseTeam(params.team);
  // URL wins; a bare /single with a live session resumes on its script.
  const opponent = (): AdjutantKind => {
    const fromUrl = asOne(params.opponent);
    if (isAdjutantKind(fromUrl)) return fromUrl;
    return loadMatchSession()?.opponent ?? "naive";
  };

  const exitToMenu = () => {
    clearMatchSession();
    navigate("/");
  };

  const onMatchFinished = (
    id: string,
    matchResult: StarChessMatchResult,
    fresh: readonly AchievementBubble[],
  ) => {
    setFinishedId(id);
    setResult(matchResult);
    noteAchievementUnlocks(id, fresh);
    if (fresh.length > 0) {
      setEarned([...fresh]);
      setEarnedOpen(true);
      return;
    }
    setResultOpen(true);
  };

  const onAnotherGame = () => {
    setResultOpen(false);
    setEarnedOpen(false);
    setEarned([]);
    setResult(null);
    setFinishedId(null);
    clearMatchSession();
    // Drop one-shot scfen= so rematch uses the opening seed.
    const q = new URLSearchParams();
    q.set("map", map());
    q.set("team", team());
    q.set("opponent", opponent());
    navigate(`/single?${q.toString()}`, { replace: true });
    setMatchEpoch((n) => n + 1);
  };

  const onReplay = () => {
    const id = finishedId();
    if (!id) return;
    setResultOpen(false);
    setEarnedOpen(false);
    navigate(`/review/${id}`, { replace: true });
  };

  return (
    <LiveMatchShell world={map()} testId="starchess-app">
      <Show when={`${map()}-${team()}-${opponent()}-${matchEpoch()}`} keyed>
        {(key) => {
          const epoch = Number(key.slice(key.lastIndexOf("-") + 1));
          return (
            <LiveMatchSession
              epoch={epoch}
              map={map()}
              team={team()}
              opponent={opponent()}
              onExitToMenu={exitToMenu}
              onMatchFinished={onMatchFinished}
            />
          );
        }}
      </Show>
      <NewAchievementsModal
        open={earnedOpen()}
        earned={earned()}
        onContinue={() => {
          setEarnedOpen(false);
          setResultOpen(true);
        }}
      />
      <MatchResultModal
        open={resultOpen()}
        result={result()}
        onAnotherGame={onAnotherGame}
        onReplay={onReplay}
      />
    </LiveMatchShell>
  );
};
