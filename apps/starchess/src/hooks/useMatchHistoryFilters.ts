/**
 * Review list filters — color (Blue/Red) + date pages.
 * No first-move filter (StarChess has no SAN opening book).
 * // SPEC: _spec/apps/starchess/menu-flow.puml
 */
import { useSearchParams } from "@solidjs/router";
import { createMemo, createSignal } from "solid-js";
import type { StarChessColor } from "@chess-coach/starchess-core";

import { matchHistory } from "~/store/matchHistoryStore";
import type { StarChessGameRecord } from "~/types/review";

export function useMatchHistoryFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const getParam = (key: string): string | null => {
    const val = searchParams[key];
    if (!val) return null;
    return Array.isArray(val) ? val[0] : val;
  };

  const initialColor = (getParam("color") === "b" ? "b" : "w") as StarChessColor;
  const initialPage = getParam("page") ? parseInt(getParam("page")!, 10) - 1 : 0;

  const [colorFilter, setColorFilter] = createSignal<StarChessColor>(initialColor);
  const [manualPage, setManualPage] = createSignal(initialPage);

  const filteredGames = createMemo(() => {
    const color = colorFilter();
    return matchHistory().filter((g) => g.playerColor === color);
  });

  const dateGroups = createMemo(() => {
    const groups = new Map<string, StarChessGameRecord[]>();
    for (const g of filteredGames()) {
      const d = g.startedAt.slice(0, 10);
      if (!groups.has(d)) groups.set(d, []);
      groups.get(d)!.push(g);
    }
    return Array.from(groups.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([dateKey, games]) => ({ dateKey, games }));
  });

  const totalPages = createMemo(() => Math.max(1, dateGroups().length));
  const activePage = createMemo(() =>
    Math.min(manualPage(), totalPages() - 1),
  );

  const visibleGames = createMemo(() => {
    const group = dateGroups()[activePage()];
    return group ? group.games : [];
  });

  const currentDateLabel = createMemo(() => {
    const group = dateGroups()[activePage()];
    if (!group) return "";
    try {
      const d = new Date(group.dateKey);
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return group.dateKey;
    }
  });

  const clamp = (p: number) => Math.max(0, Math.min(p, totalPages() - 1));

  const updateSearchParams = (
    updates: Record<string, string | null | undefined>,
  ) => {
    setSearchParams(updates, { replace: true });
  };

  const setColorFilterWithUrl = (v: StarChessColor) => {
    setColorFilter(v);
    setManualPage(0);
    updateSearchParams({ color: v, page: "1" });
  };

  const setManualPageWithUrl = (page: number) => {
    const clamped = clamp(page);
    setManualPage(clamped);
    updateSearchParams({ page: String(clamped + 1) });
  };

  return {
    colorFilter,
    setColorFilter: setColorFilterWithUrl,
    filteredGames,
    totalPages,
    activePage,
    visibleGames,
    currentDateLabel,
    goToPrev: () => setManualPageWithUrl(activePage() - 1),
    goToNext: () => setManualPageWithUrl(activePage() + 1),
  };
}
