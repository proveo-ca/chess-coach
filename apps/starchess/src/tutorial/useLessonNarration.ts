// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml, _spec/apps/starchess/architecture/reactivity/tutorial.md
/** The live lesson's narration: one derivation, handed to the tutorial screen. */
import { formatScFen } from "@chess-coach/starchess-core";
import { createMemo, type Accessor } from "solid-js";

import { readDisplayedSnapshot } from "~/app/selectors";
import { liveMatchPhase } from "~/presentation/hud/liveMatchPhase";
import { availableTrajectories, coveredEnemyShips, whiteBattleShipAtH8 } from "~/tutorial/lessonTactics";
import { sameStructure } from "~/tutorial/sameStructure";
import { nextBattleShipWatch } from "~/tutorial/tutorialScript";
import type { MatchStore } from "~/types/match";
import type { ReviewTurnPhase } from "~/types/review";
import type {
  AttackTrajectory,
  BattleShipWatch,
  NarrationSink,
  SquareCovers,
  TutorialNarrationState,
  TutorialQueueAction,
} from "~/types/tutorial";

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

const NO_WATCH: BattleShipWatch = { onH8: false, sniped: false };

export const useLessonNarration = (board: LessonBoard, sink: NarrationSink | undefined): void => {
  if (!sink) return;
  const battleShipWatch = createMemo<BattleShipWatch>((prev) => {
    const battleShip = whiteBattleShipAtH8(board.scfen());
    return battleShip ? nextBattleShipWatch(prev, { ...battleShip, reviewPhase: board.reviewPhase() }) : prev;
  }, NO_WATCH);
  const narration: Accessor<TutorialNarrationState> = createMemo(
    () => ({
      reviewPhase: board.reviewPhase(),
      timelineActive: board.timelineActive(),
      scfen: board.scfen(),
      covers: board.covers(),
      trajectories: board.trajectories(),
      turnStartChecksApplied: board.turnStartChecksApplied(),
      queue: board.queue(),
      targetingKind: board.targetingKind(),
      shipSniped: battleShipWatch().sniped,
    }),
    undefined,
    { equals: sameStructure },
  );
  sink(narration);
};
