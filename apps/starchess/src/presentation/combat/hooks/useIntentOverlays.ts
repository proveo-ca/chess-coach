// SPEC: _spec/apps/starchess/architecture/board-entities.puml
/**
 * Intent overlays from match store + review vision filter (app policy).
 * Presentation boards consume the result — they do not choose whose queue shows.
 */
import { createMemo } from "solid-js";

import {
  boardVisionFor,
  intentOverlayActions,
  intentOverlayViewer,
} from "~/app/intentOverlayPolicy";
import { readDisplayedSnapshot } from "~/app/selectors";
import { intentOverlaysFromQueue } from "~/presentation/combat/intentOverlays";
import { reviewVisionFilter } from "~/store/reviewVisionStore";
import type { VisionMode } from "~/types/board";
import type { MatchStore } from "~/types/match";

export const useIntentOverlays = (store: MatchStore) => {
  const overlays = createMemo(() => {
    const s = store.shell();
    const snap = readDisplayedSnapshot(store);
    const filter = reviewVisionFilter();
    const actions = intentOverlayActions(
      s.phase,
      s.viewer,
      filter,
      snap.queue?.actions,
      store.reviewIntentActions(),
    );
    const viewer = intentOverlayViewer(s.phase, s.viewer, filter);
    return intentOverlaysFromQueue(actions, {
      placement: snap.placement,
      siegedRooks: snap.siegedRooks,
      mines: snap.mines,
      viewer,
    });
  });

  return overlays;
};

/** Fog / visionMode for LiveStarChessBoard from review filter + optional overrides. */
export const useBoardVision = (
  store: MatchStore,
  overrides?: () => { fog?: boolean; visionMode?: VisionMode },
) =>
  createMemo(() => {
    const o = overrides?.() ?? {};
    return boardVisionFor(store.shell().phase, reviewVisionFilter(), o);
  });
