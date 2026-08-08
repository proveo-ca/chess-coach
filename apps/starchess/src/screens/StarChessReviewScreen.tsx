/**
 * Match history list + DualNav replay — `/review` and `/review/:id`.
 * List chrome mirrors Coach Review: Playing as + date (no First move, no title).
 * // SPEC: _spec/apps/starchess/deployment.puml
 * // SPEC: _spec/apps/starchess/menu-flow.puml
 */
import { A, useNavigate, useParams } from "@solidjs/router";
import { For, Show, createMemo, type Component } from "solid-js";

import { MatchHistoryFilters } from "~/components/atoms/MatchHistoryFilters";
import { Screen } from "~/components/primitives/Screen";
import { ScreenBackNav } from "~/components/primitives/ScreenBackNav";
import { ReviewDemoScreen } from "~/demos/ReviewDemoScreen";
import { useMatchHistoryFilters } from "~/hooks/useMatchHistoryFilters";
import { LiveMatchShell } from "~/screens/LiveMatchShell";
import styles from "~/screens/StarChessReviewScreen.module.css";
import {
  getMatchById,
  historyFromRecord,
} from "~/store/matchHistoryStore";
import type { StarChessGameRecord } from "~/types/review";
import {
  formatMatchLabel,
  formatMatchResultTitle,
} from "~/utils/matchTitle";

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

const MatchList: Component<{
  games: StarChessGameRecord[];
  activeId?: string;
}> = (props) => (
  <div
    class={styles.list}
    role="list"
    aria-label="Saved matches"
    data-testid="starchess-review-list"
  >
    <Show
      when={props.games.length > 0}
      fallback={
        <p class={styles.empty}>No games match the filters.</p>
      }
    >
      <For each={props.games}>
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

const ReviewListShell: Component<{ activeId?: string }> = (props) => {
  const filters = useMatchHistoryFilters();
  const historyFilters = () => (
    <MatchHistoryFilters
      colorFilter={filters.colorFilter()}
      setColorFilter={filters.setColorFilter}
      totalPages={filters.totalPages()}
      activePage={filters.activePage()}
      currentDateLabel={filters.currentDateLabel()}
      goToPrev={filters.goToPrev}
      goToNext={filters.goToNext}
    />
  );

  return (
    <LiveMatchShell world="eclipse" testId="starchess-review">
      <Screen>
        <Screen.SidebarInset>
          <div class="desktop-only">
            <ScreenBackNav href="/" data-testid="review-back-menu">
              {historyFilters()}
            </ScreenBackNav>
          </div>
          <div class="mobile-only">
            <ScreenBackNav href="/" data-testid="review-back-menu-mobile" />
            {historyFilters()}
          </div>
        </Screen.SidebarInset>
        <Screen.BoardArea>
          <div class={styles.listPane}>
            <MatchList
              games={filters.visibleGames()}
              activeId={props.activeId}
            />
          </div>
        </Screen.BoardArea>
      </Screen>
    </LiveMatchShell>
  );
};

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
        matchTitle={{
          resultLine: formatMatchResultTitle(props.record),
          result: props.record.result,
          matchup: formatMatchLabel(props.record),
        }}
        reviewLabel={`${resultLabel(props.record.result)} · You ${
          props.record.playerColor === "w" ? "Blue" : "Red"
        }`}
        variant={props.record.map}
        playerColor={props.record.playerColor}
        onHome={() => navigate("/review")}
      />
    </LiveMatchShell>
  );
};

export const StarChessReviewScreen: Component = () => {
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
