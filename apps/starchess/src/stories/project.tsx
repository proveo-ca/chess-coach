// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
/**
 * Storybook projection helpers. A story file names *which* catalog entries to
 * show; the seed, title, and description all come from source. Nothing here
 * declares board content — if a story needs a new position, it goes in the
 * catalog first.
 */
import type { StoryObj } from "storybook-solidjs-vite";
import type { JSX } from "solid-js";
import { formatScFen } from "@chess-coach/starchess-core";

import { createMatchStore } from "~/app/MatchStoreContext";
import { MatchStoreProvider } from "~/ports/matchStore";
import { buildReviewHistory } from "~/app/reviewHistory";
import { createMatchStateFromScfen } from "~/app/matchReducer";
import { LiveLessonHost } from "~/demos/LiveLessonHost";
import {
  lessonBoard,
  tutorialStory,
} from "~/tutorial/tutorialScript";
import type { TutorialSectionId } from "~/types/tutorial";
import type { LiveLessonHostProps } from "~/types/lesson";
import { addMatchRecord } from "~/store/matchHistoryStore";
import type { FogEdgeScenario } from "~/types/demos";
import type { StarChessGameRecord } from "~/types/review";
import type { LiveLessonBoard } from "~/types/tutorial";

/** Presentation overrides a story may set — never board content. */
export type ProjectionChrome = Omit<LiveLessonHostProps, "board">;

const storyParams = (docs: string | undefined) => ({
  layout: "fullscreen" as const,
  ...(docs ? { docs: { description: { story: docs } } } : {}),
});

/** Project one tutorial lesson: `lessonStory("specials", "marine")`. */
export const lessonStory = (
  section: TutorialSectionId,
  id: string,
  chrome?: ProjectionChrome,
): StoryObj => {
  const board = lessonBoard(section, id);
  return {
    name: tutorialStory(section, id)?.title ?? id,
    parameters: storyParams(board.docs),
    render: () => <LiveLessonHost board={board} {...chrome} />,
  };
};

/** Project a demo-only sample board from `demos/samples.ts`. */
export const sampleStory = (
  board: LiveLessonBoard,
  opts: { name: string; docs?: string } & ProjectionChrome,
): StoryObj => {
  const { name, docs, ...chrome } = opts;
  return {
    name,
    parameters: storyParams(docs ?? board.docs),
    render: () => <LiveLessonHost board={board} {...chrome} />,
  };
};

/**
 * Store harness for component-level stories (GasRack, DeployModal, TurnBar) —
 * they need a MatchStore in context but not a whole board host. Seeds from a
 * catalog board so no story hand-writes an SCFEN.
 */
export const WithMatchStore = (props: {
  board: LiveLessonBoard;
  children: JSX.Element;
}): JSX.Element => {
  const store = createMatchStore({
    initial: createMatchStateFromScfen(props.board.scfen, props.board.stored ?? 4),
    autoArmTimer: false,
  });
  return <MatchStoreProvider store={store}>{props.children}</MatchStoreProvider>;
};

/**
 * Replay record from a `demos/` scenario package — for `/review/:id` stories.
 * Seed it from a `beforeEach`, never from `render`: writing to the real match
 * history store during render leaks between stories.
 */
export const recordFromScenario = (
  id: string,
  scenario: FogEdgeScenario,
  label: string,
): StarChessGameRecord => {
  const history = buildReviewHistory({
    start: scenario.plies[0]!,
    steps: scenario.steps,
    startCaption: scenario.startCaption,
    queueStep: scenario.queueStep,
  });
  return {
    id,
    startedAt: "2026-08-10T12:00:00.000Z",
    endedAt: "2026-08-10T12:05:00.000Z",
    result: "win",
    map: "eclipse",
    playerColor: "w",
    playerName: label,
    scfens: history.settledSnapshots.map(formatScFen),
    resolves: [...history.settledResolves],
  };
};

/** Seed the match-history store before a review story renders. */
export const seedMatchHistory = (...records: StarChessGameRecord[]) => () => {
  for (const record of records) addMatchRecord(record);
};
