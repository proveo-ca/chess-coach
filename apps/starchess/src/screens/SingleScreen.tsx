// SPEC: _spec/apps/starchess/menu-flow.puml, _spec/apps/starchess/screens.puml, _spec/apps/starchess/deployment.puml, _spec/apps/starchess/architecture/screen-entities.puml
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
  strategicAdjutant,
  updateCcIntelForSnap,
  updateKvsForSnap,
} from "@chess-coach/starchess-core";
import type { CcIntelState, KvsState, ScFenSnapshot } from "@chess-coach/starchess-core";
import type { StarChessColor } from "@chess-coach/starchess-core";
import { Show, createEffect, createSignal, onCleanup, type Component } from "solid-js";

import { browserLocation, readScfenQuery } from "~/adapters/browser";
import { createMatchStore, MatchStoreProvider, useMatchStore } from "~/app/MatchStoreContext";
import { createMatchStateFromScfen } from "~/app/matchReducer";
import { BaseScreen } from "~/app/BaseScreen.tsx";
import { MatchResultModal } from "~/components/features/MatchResultModal";
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
import type { StarChessMatchResult } from "~/types/review";
import { isAdjutantKind, type AdjutantKind } from "~/types/newGame";
import { LIVE_ADJUTANT_MATCH_TITLE } from "~/utils/matchTitle";

const MAPS: readonly BoardVariant[] = ["eclipse", "butter", "vermeer"];

const asOne = (raw: string | string[] | undefined): string | undefined =>
  Array.isArray(raw) ? raw[0] : raw;

const parseMap = (raw: string | string[] | undefined): BoardVariant => {
  const v = asOne(raw);
  return MAPS.includes(v as BoardVariant) ? (v as BoardVariant) : "eclipse";
};

const parseTeam = (raw: string | string[] | undefined): StarChessColor =>
  asOne(raw) === "b" ? "b" : "w";

const parseOpponent = (raw: string | string[] | undefined): AdjutantKind => {
  const v = asOne(raw);
  return isAdjutantKind(v) ? v : "naive";
};

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
  const resume =
    !queryScfen &&
    session &&
    session.map === map &&
    session.playerColor === team
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
  onMatchFinished: (id: string, result: StarChessMatchResult) => void;
}> = (props) => {
  const store = useMatchStore();
  const opponentColor = (): StarChessColor => (props.team === "w" ? "b" : "w");
  let historySaved = false;

  // Cross-ply strategic state, folded once per turn (core owns the folds — the
  // arena threads the same two).
  let ccIntel: CcIntelState = seedCcIntelForOpening();
  let kvs: KvsState | null = null;
  let foldedTurn = -1;

  const foldTracking = (snap: ScFenSnapshot) => {
    if (!kvs) kvs = seedKvsForOpening(snap);
    if (snap.turn === foldedTurn) return;
    foldedTurn = snap.turn;
    ccIntel = updateCcIntelForSnap(ccIntel, snap);
    kvs = updateKvsForSnap(kvs, snap);
  };

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
      }),
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
    });
    if (!record || !result) return;
    historySaved = true;
    addMatchRecord(record);
    clearMatchSession();
    props.onMatchFinished(props.matchId, result);
  });

  onCleanup(() => {
    // Leaving via Home / route change — drop the resume blob.
    clearMatchSession();
  });

  return (
    <BaseScreen
      boardVariant={props.boardVariant}
      starChessMode
      armTimer
      turnChrome="sidebar"
      matchTitle={LIVE_ADJUTANT_MATCH_TITLE}
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
  onMatchFinished: (id: string, result: StarChessMatchResult) => void;
}> = (props) => {
  const boot = bootstrapMatch(props.map, props.team, {
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
  const [result, setResult] = createSignal<StarChessMatchResult | null>(null);
  const [finishedId, setFinishedId] = createSignal<string | null>(null);

  const map = () => parseMap(params.map);
  const team = () => parseTeam(params.team);
  const opponent = () => parseOpponent(params.opponent);

  const exitToMenu = () => {
    clearMatchSession();
    navigate("/");
  };

  const onMatchFinished = (id: string, matchResult: StarChessMatchResult) => {
    setFinishedId(id);
    setResult(matchResult);
    setResultOpen(true);
  };

  const onAnotherGame = () => {
    setResultOpen(false);
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
      <MatchResultModal
        open={resultOpen()}
        result={result()}
        onAnotherGame={onAnotherGame}
        onReplay={onReplay}
      />
    </LiveMatchShell>
  );
};
