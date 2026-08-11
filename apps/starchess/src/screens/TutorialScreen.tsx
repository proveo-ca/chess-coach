// SPEC: _spec/apps/starchess/deployment.puml, _spec/apps/starchess/menu-flow.puml, _spec/apps/starchess/architecture/screen-entities.puml
/**
 * StarChess tutorial — CoachScreen-shaped shell (Header avatar · board · footer).
 * Floating dismissible ChatBubble overlays ranks 7–8.
 * Deep links: `/tutorial/:section/:story` (ids from TUTORIAL_SCRIPT).
 */
import { useNavigate, useParams } from "@solidjs/router";
import {
  Match,
  Show,
  Switch,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  type Component,
  type JSX,
} from "solid-js";

import { buildReviewHistory } from "~/app/reviewHistory";
import { CoachAvatar } from "~/components/atoms/CoachAvatar";
import { TutorialGuideBubble } from "~/components/features/TutorialGuideBubble";
import { Breadcrumb } from "~/components/primitives/Breadcrumb";
import { Toggle } from "~/components/primitives/Toggle";
import {
  COMBAT_CHAIN_PLY_SC,
  COMBAT_CHAIN_STEPS,
  queueCombatChainStep,
} from "~/demos/combatChain";
import { FogLiveScenarioScreen } from "~/demos/FogLiveScenarioScreen";
import { GasDeployScenarioScreen } from "~/demos/GasDeployScenarioScreen";
import { FOG_EDGE_BISHOP_START_SCFEN } from "~/demos/fogEdgeBishop";
import { FOG_EDGE_ROOK_TANK_START_SCFEN } from "~/demos/fogEdgeRookTank";
import {
  FOG_MOVE_KING_START_SCFEN,
  FOG_MOVE_KNIGHT_START_SCFEN,
  FOG_MOVE_PAWN_START_SCFEN,
  FOG_MOVE_QUEEN_START_SCFEN,
} from "~/demos/fogMoveSamples";
import {
  KING_HUNT_PLY_SC,
  KING_HUNT_STEPS,
  queueKingHuntStep,
} from "~/demos/kingHunt";
import { KingHuntLiveScreen } from "~/demos/KingHuntLiveScreen";
import { KingDefenseScreen } from "~/demos/KingDefenseScreen";
import { TutorialReviewHost } from "~/demos/TutorialReviewHost";
import { FOG_SIEGE_ROOK_SCFEN } from "~/presentation/animations/components/FogVisionDemo";
import { LiveMatchShell } from "~/screens/LiveMatchShell";
import styles from "~/screens/TutorialScreen.module.css";
import { GAS_DEPLOY_FIXTURES } from "~/stories/fixtures/scenarios";
import { tutorialNarration } from "~/tutorial/tutorialNarrationStore";
import {
  TUTORIAL_SCRIPT,
  adjacentTutorialStoryId,
  holdTutorialLine,
  matchesTutorialCompleteWhen,
  parseTutorialSection,
  resolveTutorialLine,
  resolveTutorialStoryId,
  tutorialPath,
  tutorialStage,
  tutorialStory,
  type TutorialCompleteWhen,
  type TutorialLineHold,
} from "~/tutorial/tutorialScript";
import type { TutorialSectionId } from "~/types/tutorial";

export type { TutorialSectionId } from "~/types/tutorial";

const SECTIONS = TUTORIAL_SCRIPT.map((s) => ({ id: s.id, label: s.label }));

const FOG_MINE_LIVE_SCFEN =
  "SCFEN|7k/8/8/8/8/8/8/4K3|0|33|P|G:11:11|M:w:a4|Q:w:;b:";
const FOG_SIEGE_LIVE_SCFEN = `${FOG_SIEGE_ROOK_SCFEN}|S:d4`;

type FogLesson = {
  id: string;
  scfen: string;
  rookTank?: boolean;
  rookSiege?: boolean;
};

const FOG_LESSONS: FogLesson[] = [
  { id: "king", scfen: FOG_MOVE_KING_START_SCFEN },
  { id: "pawn", scfen: FOG_MOVE_PAWN_START_SCFEN },
  { id: "knight", scfen: FOG_MOVE_KNIGHT_START_SCFEN },
  { id: "bishop", scfen: FOG_EDGE_BISHOP_START_SCFEN },
  {
    id: "rook-tank",
    scfen: FOG_EDGE_ROOK_TANK_START_SCFEN,
    rookTank: true,
  },
  {
    id: "rook-siege",
    scfen: FOG_SIEGE_LIVE_SCFEN,
    rookSiege: true,
  },
  { id: "queen", scfen: FOG_MOVE_QUEEN_START_SCFEN },
  { id: "mine", scfen: FOG_MINE_LIVE_SCFEN },
];

type SpecialLesson = {
  id: string;
  scfen: string;
  stored: number;
};

const SPECIAL_LESSONS: SpecialLesson[] = [
  { id: "marine", ...GAS_DEPLOY_FIXTURES.marine },
  { id: "cc", ...GAS_DEPLOY_FIXTURES.commandCenter },
  { id: "hoverbike", ...GAS_DEPLOY_FIXTURES.hoverbike },
  { id: "mecha", ...GAS_DEPLOY_FIXTURES.mecha },
  { id: "ship", ...GAS_DEPLOY_FIXTURES.battleship },
  { id: "tank", ...GAS_DEPLOY_FIXTURES.siegeTank },
];

const COMBAT_HISTORY = buildReviewHistory({
  start: COMBAT_CHAIN_PLY_SC[0]!,
  steps: COMBAT_CHAIN_STEPS,
  startCaption: "Start · tank on c3 · step phases with the footer button",
  queueStep: (snap, i) => queueCombatChainStep(snap, COMBAT_CHAIN_STEPS[i]!),
});

const KING_HISTORY = buildReviewHistory({
  start: KING_HUNT_PLY_SC[0]!,
  steps: KING_HUNT_STEPS,
  startCaption: "Start · ka8 · step phases with the footer button",
  queueStep: (snap, i) => queueKingHuntStep(snap, KING_HUNT_STEPS[i]!),
});

const TutorialFooterNav: Component<{
  section: TutorialSectionId;
  onSelect: (id: TutorialSectionId) => void;
  children?: JSX.Element;
}> = (props) => (
  <div class={styles.footerNav} data-testid="tutorial-footer-nav">
    <Breadcrumb
      items={SECTIONS}
      current={props.section}
      onSelect={props.onSelect}
      aria-label="Tutorial sections"
      data-testid="tutorial-breadcrumb"
    />
    {props.children}
  </div>
);

const SkinToggle: Component<{
  chess: boolean;
  onChange: (chess: boolean) => void;
}> = (props) => (
  <div class={styles.skinToggle} role="group" aria-label="Board skin">
    <span
      class={styles.skinLabel}
      classList={{ [styles.skinActive]: props.chess }}
      data-testid="tutorial-skin-chess"
    >
      Chess
    </span>
    <Toggle
      checked={!props.chess}
      onChange={(starchess) => props.onChange(!starchess)}
      testId="tutorial-skin-toggle"
    />
    <span
      class={styles.skinLabel}
      classList={{ [styles.skinActive]: !props.chess }}
      data-testid="tutorial-skin-starchess"
    >
      StarChess
    </span>
  </div>
);

const FogSection: Component<{
  lessonId: string;
  chessMode: boolean;
  coachEmotion: ReturnType<typeof resolveTutorialLine>["emotion"];
  guideBubble: JSX.Element;
  header: JSX.Element;
  footer: JSX.Element;
  onHome: () => void;
}> = (props) => (
  <Show when={props.lessonId} keyed>
    {(id) => {
      const lesson = FOG_LESSONS.find((l) => l.id === id)!;
      return (
        <FogLiveScenarioScreen
          scfen={lesson.scfen}
          rookTank={lesson.rookTank}
          rookSiege={lesson.rookSiege}
          boardVariant={props.chessMode ? "classic" : "eclipse"}
          // Sole product entry for cburnett — fog tutorial Chess skin only.
          pieceSet={props.chessMode ? "cburnett" : "nerd"}
          homeOnly
          hideResources
          hideGas
          narrate
          turnChrome="none"
          endTurnAfterQueue="first"
          onExitToMenu={props.onHome}
          coachEmotion={props.coachEmotion}
          header={props.header}
          guideBubble={props.guideBubble}
          footerExtra={props.footer}
          boardHints={tutorialStory("fog", id)?.hints}
        />
      );
    }}
  </Show>
);

export const TutorialScreen: Component = () => {
  const params = useParams<{ section?: string; story?: string }>();
  const navigate = useNavigate();
  const section = createMemo(() => parseTutorialSection(params.section));
  const storyId = createMemo(() =>
    resolveTutorialStoryId(section(), params.story),
  );
  const [chessMode, setChessMode] = createSignal(false);
  const [lessonEpoch, setLessonEpoch] = createSignal(0);

  // Canonicalize `/tutorial` · `/tutorial/fog` · aliases → `/tutorial/:section/:story`.
  createEffect(() => {
    const sec = section();
    const story = storyId();
    if (params.section !== sec || params.story !== story) {
      navigate(tutorialPath(sec, story), { replace: true });
    }
  });

  const goHome = () => navigate("/");
  const selectSection = (id: TutorialSectionId) => {
    navigate(tutorialPath(id), { replace: true });
  };
  const goStory = (id: string) => {
    navigate(tutorialPath(section(), id));
  };
  const goAdjacent = (delta: -1 | 1, wrap = false) => {
    const next = adjacentTutorialStoryId(section(), storyId(), delta, {
      wrap,
    });
    if (next) goStory(next);
  };

  /** Same targets as coach-nav "Next Lesson" / end-of-section handoff. */
  const goNextLesson = () => {
    const sec = section();
    const story = storyId();
    const next = adjacentTutorialStoryId(sec, story, 1);
    if (next) {
      goStory(next);
      return;
    }
    if (sec === "fog") selectSection("specials");
    else if (sec === "specials") selectSection("resolve");
    else if (sec === "resolve") selectSection("king");
  };

  // Script completeWhen / restartWhen → next lesson or remount.
  // Arm on seed (non-match). Latch match through auto-End queue wipe; wait for
  // timeline idle + delayMs. Never clear the timer once fired.
  type LessonGate = {
    armedKey: string;
    pendingKey: string;
    firedKey: string;
    timer?: ReturnType<typeof setTimeout>;
  };
  const completeGate: LessonGate = {
    armedKey: "",
    pendingKey: "",
    firedKey: "",
  };
  const restartGate: LessonGate = {
    armedKey: "",
    pendingKey: "",
    firedKey: "",
  };
  onCleanup(() => {
    if (completeGate.timer != null) clearTimeout(completeGate.timer);
    if (restartGate.timer != null) clearTimeout(restartGate.timer);
  });
  const runLessonGate = (
    gate: LessonGate,
    rule: TutorialCompleteWhen | undefined,
    key: string,
    n: ReturnType<typeof tutorialNarration>,
    onFire: () => void,
  ) => {
    if (!rule) return;

    // Timer-only advance — no board condition.
    if (rule.kind === "elapsed") {
      if (gate.firedKey === key) return;
      if (gate.armedKey === key) return;
      gate.armedKey = key;
      gate.firedKey = key;
      gate.timer = setTimeout(() => {
        gate.timer = undefined;
        gate.pendingKey = "";
        onFire();
      }, Math.max(0, rule.ms));
      return;
    }

    if (rule.kind === "scfen" && !n.scfen) return;
    if (rule.kind === "queue" && n.queue == null && !n.scfen) return;
    if (
      rule.kind === "typewriter" &&
      (n.typewriterTurn == null || n.typewriterBeat == null)
    )
      return;

    const matched = matchesTutorialCompleteWhen(rule, {
      scfen: n.scfen,
      queue: n.queue,
      typewriterTurn: n.typewriterTurn,
      typewriterBeat: n.typewriterBeat,
    });

    if (matched && (gate.armedKey === key || gate.pendingKey === key)) {
      gate.pendingKey = key;
    } else if (
      !matched &&
      gate.pendingKey !== key &&
      gate.firedKey !== key
    ) {
      gate.armedKey = key;
    }

    if (gate.firedKey === key) return;
    if (gate.pendingKey !== key) return;
    if (n.timelineActive) return;

    gate.firedKey = key;
    gate.armedKey = "";
    const delayMs = Math.max(0, rule.delayMs ?? 0);
    const fire = () => {
      gate.timer = undefined;
      gate.pendingKey = "";
      onFire();
    };
    if (delayMs === 0) {
      queueMicrotask(fire);
      return;
    }
    gate.timer = setTimeout(fire, delayMs);
  };
  let lastLessonGateKey = "";
  const resetGate = (gate: LessonGate) => {
    if (gate.timer != null) clearTimeout(gate.timer);
    gate.armedKey = "";
    gate.pendingKey = "";
    gate.firedKey = "";
    gate.timer = undefined;
  };
  createEffect(() => {
    const sec = section();
    const story = storyId();
    const key = `${sec}/${story}`;
    const script = tutorialStory(sec, story);
    const n = tutorialNarration();
    // New lesson → drop prior timers so `elapsed` can arm fresh.
    if (lastLessonGateKey !== key) {
      lastLessonGateKey = key;
      resetGate(completeGate);
      resetGate(restartGate);
    }
    runLessonGate(completeGate, script?.completeWhen, key, n, () => {
      if (section() !== sec || storyId() !== story) return;
      goNextLesson();
    });
    runLessonGate(restartGate, script?.restartWhen, key, n, () => {
      if (section() !== sec || storyId() !== story) return;
      // Remount seed + clear gate so the lesson can fail/complete again.
      resetGate(restartGate);
      resetGate(completeGate);
      lastLessonGateKey = "";
      retryLesson();
    });
  });

  // Intro comment once per lesson; reactions stick (no bounce back to opener).
  let lineHold: TutorialLineHold = { lessonKey: "", introDone: false };
  const [line, setLine] = createSignal(resolveTutorialLine({
    stageId: "fog",
    storyId: "king",
  }));
  createEffect(() => {
    const sec = section();
    const story = storyId();
    const n = tutorialNarration();
    const ctx = {
      stageId: sec,
      storyId: story,
      chessSkin: sec === "fog" ? chessMode() : undefined,
      reviewPhase: n.reviewPhase,
      timelineActive: n.timelineActive,
      scfen: n.scfen,
      turn: n.turn,
      targetingKind: n.targetingKind,
    };
    const raw = resolveTutorialLine(ctx);
    const next = holdTutorialLine(
      lineHold,
      `${sec}|${story}|${lessonEpoch()}`,
      raw,
      ctx,
    );
    lineHold = next.hold;
    setLine(next.line);
  });

  const lineKey = () =>
    `${section()}|${storyId()}|${line().comment}|${line().emotion}|${line().action?.kind ?? ""}`;

  const retryLesson = () => {
    lineHold = { lessonKey: "", introDone: false };
    setLessonEpoch((n) => n + 1);
  };

  const guideBubble = () => (
    <TutorialGuideBubble
      message={line().comment}
      lineKey={lineKey()}
      action={line().action}
      onAction={(action) => {
        if (action.kind === "retryLesson") retryLesson();
        if (action.kind === "goSection") selectSection(action.section);
      }}
    />
  );

  const withFooter = (extra?: JSX.Element) => (
    <TutorialFooterNav section={section()} onSelect={selectSection}>
      {extra}
    </TutorialFooterNav>
  );

  const fogStories = () => tutorialStage("fog").stories;
  const fogIdx = () => fogStories().findIndex((s) => s.id === storyId());
  const specialStories = () => tutorialStage("specials").stories;
  const specialIdx = () =>
    specialStories().findIndex((s) => s.id === storyId());
  const kingStories = () => tutorialStage("king").stories;
  const kingIdx = () => kingStories().findIndex((s) => s.id === storyId());

  const lessonCoachHeader = (opts: {
    testId: string;
    atStart: boolean;
    atEnd: boolean;
    /** First-lesson prev label (e.g. prior tutorial section). */
    startPrevLabel?: string;
    onStartPrev?: () => void;
    /** Last-lesson next label (e.g. next tutorial section). */
    endNextLabel?: string;
    onEndNext?: () => void;
  }) => (
    <div class={styles.coachNav} data-testid={opts.testId}>
      <button
        type="button"
        class={styles.lessonNav}
        disabled={opts.atStart && !opts.onStartPrev}
        onClick={() =>
          opts.atStart && opts.onStartPrev
            ? opts.onStartPrev()
            : goAdjacent(-1)
        }
        data-testid="tutorial-lesson-prev"
      >
        <span class={styles.lessonNavArrow} aria-hidden="true">
          &lt;
        </span>
        <span class={styles.lessonNavText}>
          {opts.atStart && opts.startPrevLabel
            ? opts.startPrevLabel
            : "Previous Lesson"}
        </span>
      </button>
      <CoachAvatar identity="kerrigan" emotion={line().emotion} />
      <button
        type="button"
        class={styles.lessonNav}
        disabled={opts.atEnd && !opts.onEndNext}
        onClick={() =>
          opts.atEnd && opts.onEndNext ? opts.onEndNext() : goAdjacent(1)
        }
        data-testid="tutorial-lesson-next"
      >
        <span class={styles.lessonNavText}>
          {opts.atEnd && opts.endNextLabel
            ? opts.endNextLabel
            : "Next Lesson"}
        </span>
        <span class={styles.lessonNavArrow} aria-hidden="true">
          &gt;
        </span>
      </button>
    </div>
  );

  const fogCoachHeader = () =>
    lessonCoachHeader({
      testId: "tutorial-fog-coach-nav",
      atStart: fogIdx() <= 0,
      atEnd: fogIdx() >= fogStories().length - 1,
      endNextLabel: "Special Moves",
      onEndNext: () => selectSection("specials"),
    });

  const specialCoachHeader = () =>
    lessonCoachHeader({
      testId: "tutorial-specials-coach-nav",
      atStart: specialIdx() <= 0,
      atEnd: specialIdx() >= specialStories().length - 1,
      endNextLabel: "Turn Resolution",
      onEndNext: () => selectSection("resolve"),
    });

  const resolveCoachHeader = () =>
    lessonCoachHeader({
      testId: "tutorial-resolve-coach-nav",
      atStart: true,
      atEnd: true,
      startPrevLabel: "Special Moves",
      onStartPrev: () => selectSection("specials"),
      endNextLabel: "King Damage",
      onEndNext: () => selectSection("king"),
    });

  const kingCoachHeader = () =>
    lessonCoachHeader({
      testId: "tutorial-king-coach-nav",
      atStart: kingIdx() <= 0,
      atEnd: kingIdx() >= kingStories().length - 1,
      startPrevLabel: "Turn Resolution",
      onStartPrev: () => selectSection("resolve"),
    });

  const fogFooter = () =>
    withFooter(
      <SkinToggle chess={chessMode()} onChange={setChessMode} />,
    );

  const specialFooter = () => withFooter();

  const kingFooter = () => withFooter();

  const resolveFooter = () => withFooter();

  return (
    <LiveMatchShell world="eclipse" testId="starchess-tutorial">
      <Switch>
        <Match when={section() === "fog"}>
          <FogSection
            lessonId={storyId()}
            chessMode={chessMode()}
            coachEmotion={line().emotion}
            guideBubble={guideBubble()}
            header={fogCoachHeader()}
            footer={fogFooter()}
            onHome={goHome}
          />
        </Match>
        <Match when={section() === "specials"}>
          <Show when={`${storyId()}#${lessonEpoch()}`} keyed>
            {(key) => {
              const id = key.split("#")[0]!;
              const lesson = SPECIAL_LESSONS.find((l) => l.id === id)!;
              return (
                <GasDeployScenarioScreen
                  scfen={lesson.scfen}
                  stored={lesson.stored}
                  tutorial
                  hideResources
                  turnChrome="none"
                  endTurnAfterQueue={
                    id === "cc" || id === "ship" ? "first" : "moveAndSpecial"
                  }
                  onExitToMenu={goHome}
                  coachEmotion={line().emotion}
                  header={specialCoachHeader()}
                  guideBubble={guideBubble()}
                  footerExtra={specialFooter()}
                />
              );
            }}
          </Show>
        </Match>
        <Match when={section() === "resolve"}>
          <TutorialReviewHost
            history={COMBAT_HISTORY}
            reviewLabel="Combat chain"
            visionMode="observer"
            fog={false}
            variant="eclipse"
            turnChrome="sidebar"
            onHome={goHome}
            coachEmotion={line().emotion}
            header={resolveCoachHeader()}
            guideBubble={guideBubble()}
            footerExtra={resolveFooter()}
          />
        </Match>
        <Match when={section() === "king"}>
          <Show when={`${storyId()}#${lessonEpoch()}`} keyed>
            {(key) => {
              const id = key.split("#")[0]!;
              if (id === "king-hunt-live") {
                return (
                  <KingHuntLiveScreen
                    embedded
                    tutorial
                    turnChrome="sidebar"
                    onExitToMenu={goHome}
                    coachEmotion={line().emotion}
                    header={kingCoachHeader()}
                    guideBubble={guideBubble()}
                    footerExtra={kingFooter()}
                    boardHints={tutorialStory("king", "king-hunt-live")?.hints}
                  />
                );
              }
              if (id === "king-defense") {
                return (
                  <KingDefenseScreen
                    turnChrome="sidebar"
                    onExitToMenu={goHome}
                    coachEmotion={line().emotion}
                    header={kingCoachHeader()}
                    guideBubble={guideBubble()}
                    footerExtra={kingFooter()}
                    boardHints={tutorialStory("king", "king-defense")?.hints}
                  />
                );
              }
              return (
                <TutorialReviewHost
                  history={KING_HISTORY}
                  reviewLabel="King hunt"
                  visionMode="observer"
                  fog={false}
                  variant="eclipse"
                  turnChrome="sidebar"
                  onHome={goHome}
                  coachEmotion={line().emotion}
                  header={kingCoachHeader()}
                  guideBubble={guideBubble()}
                  footerExtra={kingFooter()}
                />
              );
            }}
          </Show>
        </Match>
      </Switch>
    </LiveMatchShell>
  );
};
