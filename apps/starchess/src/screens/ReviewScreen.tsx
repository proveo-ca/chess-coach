// SPEC: _spec/apps/starchess/deployment.puml, _spec/apps/starchess/menu-flow.puml, _spec/apps/starchess/screens.puml, _spec/apps/starchess/architecture/screen-entities.puml, _spec/apps/starchess/replay-import.puml, _spec/_plans/game-export-localstorage.puml, _spec/_plans/starchess-achievements.puml
/**
 * Match history list + DualNav replay — `/review` and `/review/:id`.
 * List chrome mirrors Coach Review: Playing as + date (no First move, no title).
 * Dynamic band: a MobileBanner owns Back + compact filters instead.
 * Arena library: file import + server list (GET /starchess/arena/games) with
 * async loading/error/unreachable states; ?game= / ?scfens= deep-links.
 */
import { A, useNavigate, useParams } from "@solidjs/router";
import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  type Component,
} from "solid-js";

import { AchievementsModal } from "~/components/features/AchievementsModal";
import { MatchHistoryFilters } from "~/components/atoms/MatchHistoryFilters";
import { MobileBanner } from "~/components/atoms/MobileBanner";
import { Screen } from "~/components/primitives/Screen";
import { ScreenBackNav } from "~/components/primitives/ScreenBackNav";
import { ReviewDemoScreen } from "~/demos/ReviewDemoScreen";
import { useMatchHistoryFilters } from "~/hooks/useMatchHistoryFilters";
import { LiveMatchShell } from "~/screens/LiveMatchShell";
import styles from "~/screens/ReviewScreen.module.css";
import {
  addArenaRecord,
  addMatchRecord,
  getMatchById,
  historyFromRecord,
  matchHistory,
} from "~/store/matchHistoryStore";
import type { StarChessGameRecord } from "~/types/review";
import { clampPlayerName } from "~/utils/playerName";
import {
  formatMatchLabel,
  formatMatchResultTitle,
  formatScriptLabel,
} from "~/utils/matchTitle";
import { readReviewImport } from "~/adapters/browser";
import {
  arenaBaseUrl,
  decodeScfensParam,
  fetchArenaList,
  fetchArenaRecord,
  parseArenaFileText,
} from "~/app/arenaImport";
import {
  buildHistoryExport,
  downloadHistoryExport,
  extractExportedGames,
} from "~/app/historyExport";
import type { ArenaListItem } from "~/types/arena";

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
            <div
              class={`${styles.meta} ${styles.metaClamp}`}
              title={
                g.arenaPlayers
                  ? `${formatScriptLabel(g.arenaPlayers.w)} (Blue) vs ${formatScriptLabel(g.arenaPlayers.b)} (Red) · ${g.map.charAt(0).toUpperCase() + g.map.slice(1)}`
                  : undefined
              }
            >
              <Show
                when={g.arenaPlayers}
                fallback={`You (${g.playerColor === "w" ? "Blue" : "Red"}) · Adjutant · ${g.map.charAt(0).toUpperCase() + g.map.slice(1)}`}
              >
                {(players) =>
                  `${formatScriptLabel(players().w)} (Blue) vs ${formatScriptLabel(players().b)} (Red) · ${g.map.charAt(0).toUpperCase() + g.map.slice(1)}`
                }
              </Show>
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

type ArenaLibraryState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "ready"; games: ArenaListItem[] }
  | { phase: "error"; message: string }
  | { phase: "unreachable" };

const ArenaLibrary: Component = () => {
  const navigate = useNavigate();
  const [libraryState, setLibraryState] = createSignal<ArenaLibraryState>({
    phase: "idle",
  });
  const [importMessage, setImportMessage] = createSignal<string | null>(null);
  const [importError, setImportError] = createSignal<string | null>(null);
  const [dragOver, setDragOver] = createSignal(false);
  const [galleryOpen, setGalleryOpen] = createSignal(false);
  const historyCount = createMemo(() => matchHistory().length);

  const handleExport = () => {
    const games = matchHistory();
    if (games.length === 0) return;
    try {
      downloadHistoryExport(buildHistoryExport(games));
      setImportError(null);
      setImportMessage(
        `Exported ${games.length} game${games.length === 1 ? "" : "s"}`,
      );
    } catch (e) {
      setImportMessage(null);
      setImportError(e instanceof Error ? e.message : "Export failed");
    }
  };

  const loadArenaList = async () => {
    setLibraryState({ phase: "loading" });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const base = arenaBaseUrl();
      const result = await fetchArenaList(base, controller.signal);
      clearTimeout(timeout);
      if (result.ok) {
        if (result.games.length === 0) {
          setLibraryState({ phase: "ready", games: [] });
        } else {
          setLibraryState({ phase: "ready", games: result.games });
        }
      } else {
        // Hide server list but keep file import alive — unreachable is not an error chrome.
        setLibraryState({ phase: "unreachable" });
      }
    } catch {
      clearTimeout(timeout);
      setLibraryState({ phase: "unreachable" });
    }
  };

  createEffect(() => {
    void loadArenaList();
  });

  const handleFileTexts = (texts: string[], fileName?: string) => {
    // Support single JSON and JSONL (one record per line) — arena CLI writes .jsonl
    const allTexts: string[] = [];
    for (const t of texts) {
      const trimmed = t.trim();
      if (!trimmed) continue;
      // If file contains newlines and each line is JSON, split
      if (trimmed.includes("\n") && trimmed.split("\n").every((l) => l.trim().startsWith("{"))) {
        for (const line of trimmed.split("\n")) {
          const ll = line.trim();
          if (ll) allTexts.push(ll);
        }
      } else {
        allTexts.push(trimmed);
      }
    }
    const imported: string[] = [];
    let lastError: string | null = null;
    const addExported = (item: unknown): boolean => {
      const games = extractExportedGames(item);
      if (!games) return false;
      for (const g of games) {
        addMatchRecord(g);
        imported.push(g.id);
      }
      return true;
    };
    for (const txt of allTexts) {
      // Also support a JSON array of records
      let parsed: unknown;
      try {
        parsed = JSON.parse(txt);
      } catch (e) {
        lastError = e instanceof Error ? e.message : "Invalid JSON";
        continue;
      }
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const v = parseArenaFileText(JSON.stringify(item));
          if (v.ok) {
            const adapted = addArenaRecord(v.record);
            imported.push(adapted.id);
          } else if (!addExported(item)) {
            lastError = v.error;
          }
        }
      } else if (addExported(parsed)) {
        continue;
      } else {
        const v = parseArenaFileText(txt);
        if (v.ok) {
          const adapted = addArenaRecord(v.record);
          imported.push(adapted.id);
        } else {
          lastError = v.error;
        }
      }
    }
    if (imported.length === 0) {
      setImportError(lastError ?? "No valid records found");
      setImportMessage(null);
      return;
    }
    setImportError(null);
    if (imported.length === 1) {
      setImportMessage(`Imported ${fileName ?? imported[0]!}`);
      navigate(`/review/${imported[0]!}`);
    } else {
      setImportMessage(`Imported ${imported.length} games from ${fileName ?? "file"}`);
      navigate(`/review/${imported[0]!}`);
    }
  };

  const handleFileInput = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;
    const texts: string[] = [];
    for (const file of Array.from(files)) {
      texts.push(await file.text());
    }
    // If multiple files selected, handle each; if single .jsonl with many lines, handleFileTexts splits
    if (texts.length === 1) {
      handleFileTexts(texts, files[0]!.name);
    } else {
      handleFileTexts(texts, `${files.length} files`);
    }
    input.value = "";
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    const texts: string[] = [];
    const names: string[] = [];
    for (const file of Array.from(files)) {
      texts.push(await file.text());
      names.push(file.name);
    }
    handleFileTexts(texts, names.join(", "));
  };

  const handleArenaClick = async (item: ArenaListItem) => {
    const base = arenaBaseUrl();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const result = await fetchArenaRecord(base, item.id, controller.signal);
    clearTimeout(timeout);
    if (!result.ok) {
      setImportError(result.error);
      return;
    }
    const adapted = addArenaRecord(result.record);
    navigate(`/review/${adapted.id}`);
  };

  return (
    <>
    <div
      class={styles.arenaLibrary}
      data-testid="arena-library"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      classList={{ [styles["arenaLibrary--dragOver"]]: dragOver() }}
    >
      <h3 class={styles.arenaTitle}>Arena Library</h3>
      <p class={styles.arenaHint}>
        Import a recorded arena game via file or server. Drag &amp; drop a JSON
        file here, or use the file picker. Export downloads the local history
        as one JSON file.
      </p>
      <div class={styles.arenaFileRow}>
        <label class={styles.arenaFileLabel} data-testid="arena-file-label">
          <input
            type="file"
            accept=".json,.jsonl,application/json"
            multiple
            onChange={handleFileInput}
            data-testid="arena-file-input"
            class={styles.hiddenInput}
          />
          <span class={styles.arenaFileButton} data-testid="arena-file-button">
            Choose arena JSON
          </span>
        </label>
        <button
          type="button"
          class={styles.arenaFileButton}
          data-testid="history-export-button"
          disabled={historyCount() === 0}
          onClick={handleExport}
        >
          Export history JSON
        </button>
        <button
          type="button"
          class={styles.arenaFileButton}
          data-testid="achievements-open"
          onClick={() => setGalleryOpen(true)}
        >
          Achievements
        </button>
        <Show when={importMessage()}>
          <span class={styles.arenaSuccess} data-testid="arena-import-success">
            {importMessage()}
          </span>
        </Show>
        <Show when={importError()}>
          <span class={styles.arenaError} data-testid="arena-import-error">
            {importError()}
          </span>
        </Show>
      </div>

      <Show when={libraryState().phase === "loading"}>
        <p class={styles.arenaLoading} data-testid="arena-loading">
          Loading arena games…
        </p>
      </Show>
      <Show when={libraryState().phase === "error"}>
        <div class={styles.arenaErrorBox} data-testid="arena-list-error">
          <span>{(libraryState() as Extract<ArenaLibraryState, { phase: "error" }>).message}</span>
          <button type="button" onClick={loadArenaList} data-testid="arena-retry">
            Retry
          </button>
        </div>
      </Show>
      <Show when={libraryState().phase === "unreachable"}>
        <p class={styles.arenaUnreachable} data-testid="arena-unreachable">
          Arena server unreachable — file import still available.
        </p>
      </Show>
      <Show when={libraryState().phase === "ready"}>
        <Show
          when={(libraryState() as Extract<ArenaLibraryState, { phase: "ready" }>).games.length > 0}
          fallback={
            <p class={styles.arenaEmpty} data-testid="arena-empty">
              No arena games on server.
            </p>
          }
        >
          <div
            class={styles.arenaList}
            role="list"
            aria-label="Arena games"
            data-testid="arena-game-list"
          >
            <For each={(libraryState() as Extract<ArenaLibraryState, { phase: "ready" }>).games}>
              {(g) => (
                <button
                  type="button"
                  class={styles.arenaTile}
                  data-arena-id={g.id}
                  data-testid="arena-game-tile"
                  role="listitem"
                  onClick={() => void handleArenaClick(g)}
                >
                  <span class={styles.arenaTileId}>{g.id}</span>
                  <span class={styles.arenaTileMeta}>
                    {g.players.w} vs {g.players.b} · {g.turns} turns ·{" "}
                    {g.outcome.draw
                      ? "Draw"
                      : g.outcome.winner
                        ? `${g.outcome.winner === "w" ? "Blue" : "Red"} wins`
                        : "—"}
                  </span>
                </button>
              )}
            </For>
          </div>
        </Show>
      </Show>
    </div>
    <AchievementsModal
      open={galleryOpen()}
      onClose={() => setGalleryOpen(false)}
      onOpenGame={(id) => {
        setGalleryOpen(false);
        navigate(`/review/${id}`);
      }}
    />
    </>
  );
};

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
            <ArenaLibrary />
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

/** Who won, and which Adjutant tier the human beat — the replay's end-of-game input. */
const reviewAchievements = (record: StarChessGameRecord) => {
  const player = record.playerColor;
  const other = player === "w" ? "b" : "w";
  const winner =
    record.result === "win" ? player : record.result === "loss" ? other : null;
  // Only a live game has a human side; an arena import is script vs script.
  return {
    winner,
    opponent: !record.arenaPlayers && record.opponent ? { [player]: record.opponent } : undefined,
  };
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
        <p class={styles.errorPadded} data-testid="review-load-error">
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

  const isArena = !!props.record.arenaPlayers;
  return (
    <LiveMatchShell world={props.record.map} testId="starchess-review-detail">
      <ReviewDemoScreen
        history={history}
        matchTitle={{
          resultLine: formatMatchResultTitle(props.record),
          result: props.record.result,
          matchup: formatMatchLabel(props.record),
        }}
        reviewLabel={
          isArena
            ? `${resultLabel(props.record.result)} · ${formatScriptLabel(props.record.arenaPlayers!.w)} (Blue) vs ${formatScriptLabel(props.record.arenaPlayers!.b)} (Red)`
            : `${resultLabel(props.record.result)} · You ${props.record.playerColor === "w" ? "(Blue)" : "(Red)"}`
        }
        variant={props.record.map}
        playerColor={props.record.playerColor}
        playerName={props.record.playerName}
        arenaPlayers={props.record.arenaPlayers}
        achievements={reviewAchievements(props.record)}
        onHome={() => navigate("/review")}
      />
    </LiveMatchShell>
  );
};

/**
 * Handles ?game= / ?scfens= import on /review (no :id). Validates before
 * historyFromRecord (which throws on malformed SCFEN) and surfaces UI error.
 */
const ReviewImportHandler: Component = () => {
  const navigate = useNavigate();
  const [importState, setImportState] = createSignal<
    { phase: "idle" } | { phase: "loading"; source: string } | { phase: "error"; message: string }
  >({ phase: "idle" });

  createEffect(() => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    const parsed = readReviewImport(search);
    if (!parsed) return;

    if (parsed.gameId) {
      setImportState({ phase: "loading", source: `game ${parsed.gameId}` });
      const base = arenaBaseUrl();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      void fetchArenaRecord(base, parsed.gameId, controller.signal).then((res) => {
        clearTimeout(timeout);
        if (!res.ok) {
          setImportState({ phase: "error", message: res.error });
          return;
        }
        const adapted = addArenaRecord(res.record);
        // Clear query to avoid re-import loop, then navigate to detail.
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.searchParams.delete("game");
          window.history.replaceState({}, "", url.toString());
        }
        navigate(`/review/${adapted.id}`);
      });
      onCleanup(() => {
        clearTimeout(timeout);
        controller.abort();
      });
    } else if (parsed.scfens) {
      const validation = decodeScfensParam(parsed.scfens);
      if (!validation.ok) {
        setImportState({ phase: "error", message: validation.error });
        return;
      }
      // For scfens short fixture, we can directly add and navigate — synthesize
      // as above. Use historyFromRecord structural check already passed.
      const adapted = addArenaRecord(validation.record);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("scfens");
        window.history.replaceState({}, "", url.toString());
      }
      navigate(`/review/${adapted.id}`);
    }
  });

  return (
    <Show when={importState().phase !== "idle"}>
      <div data-testid="review-import-state">
        <Show when={importState().phase === "loading"}>
          <p data-testid="review-import-loading">
            Loading {(importState() as { source: string }).source}…
          </p>
        </Show>
        <Show when={importState().phase === "error"}>
          <p class={styles.errorText} data-testid="review-import-error">
            {(importState() as { message: string }).message}
          </p>
        </Show>
      </div>
    </Show>
  );
};

export const ReviewScreen: Component = () => {
  const params = useParams<{ id?: string }>();
  const id = () => params.id;

  return (
    <Show when={id()} fallback={
      <>
        <ReviewImportHandler />
        <ReviewListShell />
      </>
    }>
      {(matchId) => {
        const record = createMemo(() => getMatchById(matchId()));
        return (
          <Show
            when={record()}
            fallback={
              <>
                <ReviewImportHandler />
                <ReviewListShell activeId={matchId()} />
              </>
            }
          >
            {(g) => <ReviewDetail record={g()} />}
          </Show>
        );
      }}
    </Show>
  );
};
