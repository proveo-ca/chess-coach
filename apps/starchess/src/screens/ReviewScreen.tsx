// SPEC: _spec/apps/starchess/deployment.puml, _spec/apps/starchess/menu-flow.puml, _spec/apps/starchess/screens.puml, _spec/apps/starchess/architecture/screen-entities.puml
/**
 * Match history list + DualNav replay — `/review` and `/review/:id`.
 * List chrome mirrors Coach Review: Playing as + date (no First move, no title).
 * Dynamic band: a MobileBanner owns Back + compact filters instead.
 */
import { A, useNavigate, useParams } from "@solidjs/router";
import { For, Show, createMemo, type Component } from "solid-js";

import { MatchHistoryFilters } from "~/components/atoms/MatchHistoryFilters";
import { MobileBanner } from "~/components/atoms/MobileBanner";
import { Screen } from "~/components/primitives/Screen";
import { ScreenBackNav } from "~/components/primitives/ScreenBackNav";
import { ReviewDemoScreen } from "~/demos/ReviewDemoScreen";
import { useMatchHistoryFilters } from "~/hooks/useMatchHistoryFilters";
import { LiveMatchShell } from "~/screens/LiveMatchShell";
import styles from "~/screens/ReviewScreen.module.css";
import {
  getMatchById,
  historyFromRecord,
} from "~/store/matchHistoryStore";
import type { StarChessGameRecord } from "~/types/review";
import { clampPlayerName } from "~/utils/playerName";
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
              <div class={styles.name}>{clampPlayerName(g.playerName)}</div>
            </Show>
          </A>
        )}
      </For>
    </Show>
  </div>
);

const ReviewListShell: Component<{ activeId?: string }> = (props) => {
  const filters = useMatchHistoryFilters();
  const historyFilters = (compact?: boolean) => (
    <MatchHistoryFilters
      colorFilter={filters.colorFilter()}
      setColorFilter={filters.setColorFilter}
      totalPages={filters.totalPages()}
      activePage={filters.activePage()}
      currentDateLabel={filters.currentDateLabel()}
      goToPrev={filters.goToPrev}
      goToNext={filters.goToNext}
      compact={compact}
    />
  );

  return (
    <LiveMatchShell world="eclipse" testId="starchess-review">
      <Screen>
        {/* Dynamic-only chrome (CSS-gated): Back + filters in one full-bleed
            strip, same as /single and the review detail. The in-flow chrome
            below stands down there — it overflows the top track at 420px. */}
        <MobileBanner
          href="/"
          resources={
            <div class={styles.bannerFilters}>{historyFilters(true)}</div>
          }
          data-testid="review-list-banner"
        />
        <Screen.SidebarInset class={styles.listChrome}>
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
  let pack: ReturnType<typeof historyFromRecord> | null = null;
  let loadError: string | null = null;
  try {
    pack = historyFromRecord(props.record);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not open match";
  }

  if (!pack) {
    return (
      <LiveMatchShell world={props.record.map} testId="starchess-review-detail">
        <ReviewListShell activeId={props.record.id} />
        <p style={{ color: "#c44", padding: "1rem" }} data-testid="review-load-error">
          {loadError ?? "Could not open match"}
        </p>
      </LiveMatchShell>
    );
  }

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
        playerName={props.record.playerName}
        onHome={() => navigate("/review")}
      />
    </LiveMatchShell>
  );
};

export const ReviewScreen: Component = () => {
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
