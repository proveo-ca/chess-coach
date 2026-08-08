/**
 * Single-player match — `/starchess/single?map=&team=` (+ optional `scfen=`).
 * Adjutant script always plays the opposite of `team` (White or Black).
 * Persists SCFEN + playerColor to localStorage for refresh resume.
 * On gameOver: save match history and replace-navigate to `/review/:id`.
 * // SPEC: _spec/apps/starchess/menu-flow.puml
 * // SPEC: _spec/apps/starchess/screens.puml
 * // SPEC: _spec/apps/starchess/deployment.puml
 */
import { useNavigate, useSearchParams, type RouteSectionProps } from "@solidjs/router";
import { adjutant } from "@chess-coach/starchess-core";
import type { StarChessColor } from "@chess-coach/starchess-core";
import { createEffect, onCleanup, type Component } from "solid-js";

import { browserLocation, readScfenQuery } from "~/adapters/browser";
import { createMatchStore, MatchStoreProvider, useMatchStore } from "~/app/MatchStoreContext";
import { createMatchStateFromScfen } from "~/app/matchReducer";
import { StarChessScreen } from "~/app/StarChessScreen";
import { LiveMatchShell } from "~/screens/LiveMatchShell";
import { NERD_STARTING_SCFEN } from "~/stories/fixtures/seeds";
import {
  addMatchRecord,
  makeMatchId,
  recordFromMatchState,
} from "~/store/matchHistoryStore";
import {
  clearMatchSession,
  loadMatchSession,
  matchSessionFromState,
  saveMatchSession,
} from "~/store/matchSessionStore";
import { playerName } from "~/store/settingsStore";
import type { BoardVariant } from "~/types/board";

const MAPS: readonly BoardVariant[] = ["eclipse", "butter", "vermeer"];

const asOne = (raw: string | string[] | undefined): string | undefined =>
  Array.isArray(raw) ? raw[0] : raw;

const parseMap = (raw: string | string[] | undefined): BoardVariant => {
  const v = asOne(raw);
  return MAPS.includes(v as BoardVariant) ? (v as BoardVariant) : "eclipse";
};

const parseTeam = (raw: string | string[] | undefined): StarChessColor =>
  asOne(raw) === "b" ? "b" : "w";

const MatchInner: Component<{
  boardVariant: BoardVariant;
  team: StarChessColor;
  matchId: string;
  startedAt: string;
  onExitToMenu: () => void;
  onMatchFinished: (id: string) => void;
}> = (props) => {
  const store = useMatchStore();
  const opponentColor = (): StarChessColor => (props.team === "w" ? "b" : "w");
  let historySaved = false;

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

  // Terminal → persist DualNav package and hand off to `/review/:id`.
  createEffect(() => {
    const s = store.state();
    if (s.phase !== "gameOver" || historySaved) return;
    const record = recordFromMatchState(s, {
      id: props.matchId,
      startedAt: props.startedAt,
      map: props.boardVariant,
      playerName: playerName(),
    });
    if (!record) return;
    historySaved = true;
    addMatchRecord(record);
    clearMatchSession();
    props.onMatchFinished(props.matchId);
  });

  onCleanup(() => {
    // Leaving via Home / route change — drop the resume blob.
    clearMatchSession();
  });

  return (
    <StarChessScreen
      boardVariant={props.boardVariant}
      starChessMode
      armTimer
      turnChrome="sidebar"
      onExitToMenu={props.onExitToMenu}
      autoQueueOpponent={(snap) =>
        adjutant(snap, {
          color: opponentColor(),
          storedFor: (color) => store.state().economies[color].stored,
        })
      }
    />
  );
};

export const StarChessSingleScreen: Component<RouteSectionProps> = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const map = () => parseMap(params.map);
  const team = () => parseTeam(params.team);
  const queryScfen = readScfenQuery(browserLocation.search());

  // Resume: same map+team as a saved session (refresh mid-match). Explicit
  // `scfen=` query always wins; brand-new starts use the opening seed.
  const session = loadMatchSession();
  const resume =
    !queryScfen &&
    session &&
    session.map === map() &&
    session.playerColor === team()
      ? session
      : null;

  const matchId = resume?.id ?? makeMatchId();
  const startedAt = resume?.startedAt ?? new Date().toISOString();

  const scfen = queryScfen ?? resume?.scfen ?? NERD_STARTING_SCFEN;
  const storedW = resume?.economies.w.stored ?? 3;
  const storedB = resume?.economies.b.stored ?? 3;

  const seeded = createMatchStateFromScfen(scfen, storedW);
  const store = createMatchStore({
    initial: {
      ...seeded,
      viewer: team(),
      playerColor: team(),
      economies: {
        w: { stored: storedW, deployed: seeded.economies.w.deployed },
        b: { stored: storedB, deployed: seeded.economies.b.deployed },
      },
    },
  });

  const exitToMenu = () => {
    clearMatchSession();
    navigate("/");
  };

  const onMatchFinished = (id: string) => {
    navigate(`/review/${id}`, { replace: true });
  };

  return (
    <LiveMatchShell world={map()} testId="starchess-app">
      <MatchStoreProvider store={store}>
        <MatchInner
          boardVariant={map()}
          team={team()}
          matchId={matchId}
          startedAt={startedAt}
          onExitToMenu={exitToMenu}
          onMatchFinished={onMatchFinished}
        />
      </MatchStoreProvider>
    </LiveMatchShell>
  );
};
