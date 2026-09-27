// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml, _spec/apps/starchess/architecture/reactivity/tutorial.md
/**
 * Sole publisher into {@link tutorialNarrationStore} from a live lesson.
 * Previously copy-pasted across five hosts, each omitting a different field —
 * one publisher means every lesson reports the same shape.
 */
import { formatScFen } from "@chess-coach/starchess-core";
import { createEffect, createMemo, onCleanup, type Accessor } from "solid-js";

import { readDisplayedSnapshot } from "~/app/selectors";
import { liveMatchPhase } from "~/presentation/hud/liveMatchPhase";
import { availableTrajectories, coveredEnemyShips, whiteBattleShipAtH8 } from "~/tutorial/lessonTactics";
import { sameStructure } from "~/tutorial/sameStructure";
import {
  resetTutorialNarration,
  setTutorialNarration,
  type TutorialQueueAction,
} from "~/tutorial/tutorialNarrationStore";
import { nextBattleShipWatch } from "~/tutorial/tutorialScript";
import type { MatchStore } from "~/types/match";
import type { ReviewTurnPhase } from "~/types/review";
import type { AttackTrajectory, BattleShipWatch, SquareCovers } from "~/types/tutorial";

export type LessonBoard = {
  scfen: Accessor<string>;
  covers: Accessor<SquareCovers>;
  trajectories: Accessor<AttackTrajectory[]>;
  targetingKind: Accessor<string | null>;
  reviewPhase: Accessor<ReviewTurnPhase>;
  timelineActive: Accessor<boolean>;
  turnStartChecksApplied: Accessor<boolean>;
  queue: Accessor<readonly TutorialQueueAction[]>;
};

export const createLessonBoard = (store: MatchStore): LessonBoard => {
  const snap = createMemo(() => readDisplayedSnapshot(store));
  const scfen = createMemo(() => formatScFen(snap()));
  const viewer = () => store.shell().viewer;
  const timelineActive = createMemo(() => store.timeline().active);
  return {
    scfen,
    covers: createMemo(() => coveredEnemyShips(scfen(), viewer()), undefined, { equals: sameStructure }),
    trajectories: createMemo(() => availableTrajectories(scfen(), viewer()), undefined, {
      equals: sameStructure,
    }),
    targetingKind: createMemo(() => store.shell().targeting?.kind ?? null),
    reviewPhase: createMemo(() => {
      const sh = store.shell();
      return liveMatchPhase({
        phase: sh.phase,
        lastResolve: sh.lastResolve,
        timelineActive: timelineActive(),
        pendingPromotion: !!sh.pendingPromotion,
      });
    }),
    timelineActive,
    turnStartChecksApplied: createMemo(() => store.shell().turnStartChecksApplied),
    queue: createMemo(
      () =>
        (snap().queue?.actions ?? []).map((a) => ({
          timing: a.timing,
          kind: a.kind,
          color: a.color,
        })),
      undefined,
      { equals: sameStructure },
    ),
  };
};

export const useLessonNarration = (
  board: LessonBoard,
  enabled: () => boolean,
): void => {
  let battleShipWatch: BattleShipWatch = { onH8: false, sniped: false };
  createEffect(() => {
    if (!enabled()) return;
    const scfen = board.scfen();
    const reviewPhase = board.reviewPhase();
    const battleShip = whiteBattleShipAtH8(scfen);
    if (battleShip) battleShipWatch = nextBattleShipWatch(battleShipWatch, { ...battleShip, reviewPhase });
    setTutorialNarration({
      reviewPhase,
      timelineActive: board.timelineActive(),
      scfen,
      covers: board.covers(),
      trajectories: board.trajectories(),
      turnStartChecksApplied: board.turnStartChecksApplied(),
      queue: board.queue(),
      targetingKind: board.targetingKind(),
      shipSniped: battleShipWatch.sniped,
    });
  });

  onCleanup(() => {
    if (enabled()) resetTutorialNarration();
  });
};
