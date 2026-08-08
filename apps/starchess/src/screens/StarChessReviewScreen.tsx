/**
 * Match history list + DualNav replay — `/review` and `/review/:id`.
 * Mirrors Coach ReviewScreen routing; StarChess DualNav instead of PGN board.
 * // SPEC: _spec/apps/starchess/deployment.puml
 */
import { A, useNavigate, useParams, type RouteSectionProps } from "@solidjs/router";
import { For, Show, createMemo, type Component } from "solid-js";

import { Button } from "~/components/primitives/Button";
import { Screen } from "~/components/primitives/Screen";
import { ReviewDemoScreen } from "~/demos/ReviewDemoScreen";
import { LiveMatchShell } from "~/screens/LiveMatchShell";
import styles from "~/screens/StarChessReviewScreen.module.css";
import {
  getMatchById,
  historyFromRecord,
  matchHistory,
} from "~/store/matchHistoryStore";
import type { StarChessGameRecord } from "~/types/review";

const formatDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
};

const resultLabel = (r: StarChessGameRecord["result"]): string =>
  r.charAt(0).toUpperCase() + r.slice(1);

const MatchList: Component<{ activeId?: string }> = (props) => {
  const games = createMemo(() => matchHistory());
  return (
    <div
      class={styles.list}
      role="list"
      aria-label="Saved matches"
      data-testid="starchess-review-list"
    >
      <Show
        when={games().length > 0}
        fallback={
          <p class={styles.empty}>
            No saved matches yet. Finish a Single Player game to review it here.
          </p>
        }
      >
        <For each={games()}>
          {(g) => (
            <A
              href={`/review/${g.id}`}
              class={styles.tile}
              classList={{ [styles["tile--active"]]: props.activeId === g.id }}
              data-match-id={g.id}
              role="listitem"
            >
              <div class={styles.tileHeader}>
                <span class={styles.result} data-result={g.result}>
                  {resultLabel(g.result)}
                </span>
                <span class={styles.date}>{formatDate(g.endedAt)}</span>
              </div>
              <div class={styles.meta}>
                You ({g.playerColor === "w" ? "Blue" : "Red"}) · Adjutant ·{" "}
                {g.map.charAt(0).toUpperCase() + g.map.slice(1)}
              </div>
              <Show when={g.playerName}>
                <div class={styles.name}>{g.playerName}</div>
              </Show>
            </A>
          )}
        </For>
      </Show>
    </div>
  );
};

const ReviewListShell: Component<{ activeId?: string }> = (props) => (
  <LiveMatchShell world="eclipse" testId="starchess-review">
    <Screen>
      <Screen.SidebarInset>
        <h1 class={styles.title}>Review</h1>
      </Screen.SidebarInset>
      <Screen.BoardArea>
        <div class={styles.listPane}>
          <MatchList activeId={props.activeId} />
        </div>
      </Screen.BoardArea>
      <Screen.Footer>
        <Button href="/" primary data-testid="review-back-menu">
          Back to Main Menu
        </Button>
      </Screen.Footer>
    </Screen>
  </LiveMatchShell>
);

const ReviewDetail: Component<{ record: StarChessGameRecord }> = (props) => {
  const navigate = useNavigate();
  const pack = historyFromRecord(props.record);
  const history = {
    settledSnapshots: pack.settledSnapshots,
    settledResolves: pack.settledResolves,
    startCaption: "Start",
    steps: pack.settledResolves.map((_, i) => ({
      caption: `Turn ${i + 1}`,
    })),
  };

  return (
    <LiveMatchShell world={props.record.map} testId="starchess-review-detail">
      <ReviewDemoScreen
        history={history}
        reviewLabel={`${resultLabel(props.record.result)} · You ${
          props.record.playerColor === "w" ? "Blue" : "Red"
        }`}
        variant={props.record.map}
        playerColor={props.record.playerColor}
        onHome={() => navigate("/")}
      />
    </LiveMatchShell>
  );
};

export const StarChessReviewScreen: Component<RouteSectionProps> = () => {
  const params = useParams<{ id?: string }>();
  const id = () => params.id;

  return (
    <Show when={id()} fallback={<ReviewListShell />}>
      {(matchId) => {
        const record = createMemo(() => getMatchById(matchId()));
        return (
          <Show
            when={record()}
            fallback={<ReviewListShell activeId={matchId()} />}
          >
            {(g) => <ReviewDetail record={g()} />}
          </Show>
        );
      }}
    </Show>
  );
};
