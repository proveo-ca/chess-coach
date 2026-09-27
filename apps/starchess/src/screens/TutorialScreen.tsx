// SPEC: _spec/apps/starchess/deployment.puml, _spec/apps/starchess/menu-flow.puml, _spec/apps/starchess/architecture/screen-entities.puml, _spec/apps/starchess/tutorial/hints-and-coach.md, _spec/apps/starchess/architecture/reactivity/app-screens.md
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
  batch,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  untrack,
  type Component,
  type JSX,
} from "solid-js";

import { buildReviewHistory } from "~/app/reviewHistory";
import { CoachAvatar } from "~/components/atoms/CoachAvatar";
import { TutorialGuideBubble } from "~/components/features/TutorialGuideBubble";
import { Breadcrumb } from "@chess-coach/ui-web/primitives/Breadcrumb";
import { ScreenBackNav } from "~/components/primitives/ScreenBackNav";
import { Toggle } from "@chess-coach/ui-web/primitives/Toggle";
import {
  COMBAT_CHAIN_PLY_SC,
  COMBAT_CHAIN_STEPS,
  queueCombatChainStep,
} from "~/demos/combatChain";
import { LiveLessonHost } from "~/demos/LiveLessonHost";
import {
  KING_HUNT_PLY_SC,
  KING_HUNT_STEPS,
  queueKingHuntStep,
} from "~/demos/kingHunt";
import { TutorialReviewHost } from "~/demos/TutorialReviewHost";
import { LiveMatchShell } from "~/screens/LiveMatchShell";
import styles from "~/screens/TutorialScreen.module.css";
import { tutorialNarration } from "~/tutorial/tutorialNarrationStore";
import {
  LESSON_ADVANCE_MS,
  TUTORIAL_SCRIPT,
  adjacentTutorialStoryId,
  completedLessonBeats,
  lessonBoard,
  lessonEndMessageMs,
  holdTutorialLine,
  matchesTutorialCompleteWhen,
  parseTutorialSection,
  resolveTutorialLine,
  resolveTutorialStoryId,
  tutorialPath,
  tutorialStory,
} from "~/tutorial/tutorialScript";
import type {
  LiveLessonBoard,
  TutorialBeat,
  TutorialCompleteWhen,
  TutorialLineHold,
  TutorialReactionAction,
  TutorialSectionId,
} from "~/types/tutorial";

export type { TutorialSectionId } from "~/types/tutorial";

const SECTIONS = TUTORIAL_SCRIPT.map((s) => ({ id: s.id, label: s.label }));

/**
 * Fog lessons open by *showing* the claim they make — the pieces move the same
 * as Chess. Two seconds in, the skin flips to Chess; it holds there the same
 * two seconds, then flips back, so the equivalence reads without the player
 * hunting for the toggle.
 */
const SKIN_DEMO_START_MS = 2000;
const SKIN_DEMO_HOLD_MS = 2000;

/**
 * Hints wait out that demo rather than compete with it — a board lighting up
 * mid-skin-swap reads as part of the swap. Non-fog lessons run no demo, so
 * theirs land immediately.
 */
const HINT_DELAY_MS = SKIN_DEMO_START_MS + SKIN_DEMO_HOLD_MS;

const COACH_FAREWELL = "Ok, I'll let you play!";

const NEXT_LESSON_ACTION: TutorialReactionAction = { kind: "nextLesson" };
const RETRY_LESSON_ACTION: TutorialReactionAction = { kind: "retryLesson" };
const COACH_FAREWELL_MS = 1000;

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
  board: LiveLessonBoard;
  lessonKey: string;
  beats: readonly TutorialBeat[] | undefined;
  chessMode: boolean;
  /** Held back until the skin demo has finished — see HINT_DELAY_MS. */
  showHints: boolean;
  liveHints: (beats: readonly TutorialBeat[] | undefined) => readonly TutorialBeat[] | undefined;
  coachEmotion: ReturnType<typeof resolveTutorialLine>["emotion"];
  guideBubble: JSX.Element;
  header: JSX.Element;
  footer: JSX.Element;
  onHome: () => void;
}> = (props) => {
  const boardHints = createMemo(() =>
    props.showHints ? props.liveHints(props.beats) : undefined,
  );
  return (
    <LiveLessonHost
      board={props.board}
      lessonKey={props.lessonKey}
      fog
      boardVariant={props.chessMode ? "classic" : "eclipse"}
      // Sole product entry for cburnett — fog tutorial Chess skin only.
      pieceSet={props.chessMode ? "cburnett" : "nerd"}
      tutorial
      hideResources
      hideGas
      narrate
      turnChrome="none"
      onExitToMenu={props.onHome}
      coachEmotion={props.coachEmotion}
      header={props.header}
      guideBubble={props.guideBubble}
      footerExtra={props.footer}
      boardHints={boardHints()}
    />
  );
};

export const TutorialScreen: Component = () => {
  const params = useParams<{ section?: string; story?: string }>();
  const navigate = useNavigate();
  const section = createMemo(() => parseTutorialSection(params.section));
  const storyId = createMemo(() =>
    resolveTutorialStoryId(section(), params.story),
  );
  const [chessMode, setChessMode] = createSignal(false);
  const [lessonEpoch, setLessonEpoch] = createSignal(0);

  /** Gated by the skin demo — see HINT_DELAY_MS. */
  const [hintsReady, setHintsReady] = createSignal(false);

  /**
   * Chess → StarChess round trip, once per fog lesson. Re-armed per story /
   * retry so every fog lesson gets it, and cancelled the moment the player
   * works the toggle themselves — it plays *for* the hand on the toggle, never
   * against it. Cancelling releases the hints early rather than stranding them.
   */
  let skinDemo: ReturnType<typeof setTimeout>[] = [];
  const clearSkinDemo = () => {
    skinDemo.forEach(clearTimeout);
    skinDemo = [];
  };
  onCleanup(clearSkinDemo);

  createEffect(() => {
    const sec = section();
    // Read so a new story — or a retry of this one — re-arms the demo.
    void storyId();
    void lessonEpoch();
    clearSkinDemo();
    if (sec !== "fog") {
      setHintsReady(true);
      return;
    }
    setHintsReady(false);
    skinDemo.push(
      setTimeout(() => setChessMode(true), SKIN_DEMO_START_MS),
      setTimeout(() => batch(() => {
        setChessMode(false);
        setHintsReady(true);
      }), HINT_DELAY_MS),
    );
  });

  /** Player-driven skin change — retires the demo for this lesson. */
  const selectSkin = (chess: boolean) => {
    clearSkinDemo();
    batch(() => {
      setHintsReady(true);
      setChessMode(chess);
    });
  };

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
    else if (sec === "resolve") selectSection("live-play");
  };

  /**
   * Lesson outcome — objective → ending → success → next.
   *
   * Evaluated only on a *settled* board (timeline idle), which is what lets
   * this be a plain state machine: mid-resolve the board churns through
   * intermediate placements, and matching against those is what previously
   * needed a three-key armed/pending/fired latch plus timers.
   *
   * On success the coach bubble switches to its success variant with a
   * `Next lesson →` CTA whose border draws over LESSON_ADVANCE_MS and then
   * fires — the auto-press is visible before it happens, and the CTA skips it.
   *
   * `ending` sits between objective-met and that success bubble: lessons whose
   * closing coach line lands on the same beat need it read before the modal
   * hides it. Lessons with nothing left to say pass straight through.
   */
  type LessonOutcome = "active" | "ending" | "success" | "failed";
  const [outcome, setOutcome] = createSignal<LessonOutcome>("active");

  const liveHints = (beats: readonly TutorialBeat[] | undefined) =>
    outcome() === "active" ? beats : completedLessonBeats(beats);
  let outcomeKey = "";
  let advanceTimer: ReturnType<typeof setTimeout> | undefined;
  let elapsedTimer: ReturnType<typeof setTimeout> | undefined;
  let endingTimer: ReturnType<typeof setTimeout> | undefined;
  /** Auto-advance hold the pending success was requested with. */
  let successAdvanceMs = LESSON_ADVANCE_MS;

  const clearTimers = () => {
    if (advanceTimer != null) clearTimeout(advanceTimer);
    if (elapsedTimer != null) clearTimeout(elapsedTimer);
    if (endingTimer != null) clearTimeout(endingTimer);
    advanceTimer = undefined;
    elapsedTimer = undefined;
    endingTimer = undefined;
  };
  onCleanup(clearTimers);

  /**
   * Is there anywhere to go after this lesson? The last story of the last
   * stage ends the tutorial — graduation is handled by the lesson itself
   * (`useKingHuntGraduation`), so success must not offer a dead CTA.
   */
  const hasNextLesson = () =>
    adjacentTutorialStoryId(section(), storyId(), 1) != null ||
    section() !== "live-play";

  /**
   * Objective met → `ending`, which keeps the coach's closing line up for its
   * reading time (see the effect below). `delayMs` is the auto-advance hold the
   * success bubble that follows will use.
   */
  const succeed = (delayMs: number = LESSON_ADVANCE_MS) => {
    successAdvanceMs = delayMs;
    setOutcome("ending");
  };

  /** `ending` → success bubble; hold one beat, then advance (the CTA skips it). */
  const completeObjective = () => {
    setOutcome("success");
    if (!hasNextLesson()) return;
    advanceTimer = setTimeout(() => {
      advanceTimer = undefined;
      goNextLesson();
    }, successAdvanceMs);
  };

  /**
   * Failure (`restartWhen`) → same shape as success: the bubble offers Retry
   * with the countdown border, and remounts the seed when it completes. The
   * player sees *why* the lesson is restarting instead of it just happening.
   */
  const fail = (delayMs: number = LESSON_ADVANCE_MS) => {
    setOutcome("failed");
    advanceTimer = setTimeout(() => {
      advanceTimer = undefined;
      retryLesson();
    }, delayMs);
  };

  const matches = (
    rule: TutorialCompleteWhen | undefined,
    n: ReturnType<typeof tutorialNarration>,
  ): boolean => {
    if (!rule || rule.kind === "elapsed") return false;
    if (rule.kind === "scfen" && !n.scfen) return false;
    if (rule.kind === "queue" && n.queue == null && !n.scfen) return false;
    if (
      rule.kind === "typewriter" &&
      (n.typewriterTurn == null || n.typewriterBeat == null)
    )
      return false;
    return matchesTutorialCompleteWhen(rule, {
      scfen: n.scfen,
      queue: n.queue,
      typewriterTurn: n.typewriterTurn,
      typewriterBeat: n.typewriterBeat,
    });
  };

  createEffect(() => {
    const sec = section();
    const story = storyId();
    const key = `${sec}/${story}/${lessonEpoch()}`;
    const script = tutorialStory(sec, story);
    const n = tutorialNarration();

    // New lesson (or retry) → fresh objective.
    if (outcomeKey !== key) {
      outcomeKey = key;
      clearTimers();
      setOutcome("active");
      // `elapsed` needs no board condition — arm it on entry.
      const complete = script?.completeWhen;
      if (complete?.kind === "elapsed") {
        elapsedTimer = setTimeout(() => {
          elapsedTimer = undefined;
          if (section() === sec && storyId() === story) succeed(0);
        }, Math.max(0, complete.ms));
      }
    }

    if (outcome() !== "active") return;
    // Only judge a board that has finished animating.
    if (n.timelineActive) return;

    if (matches(script?.restartWhen, n)) {
      fail();
      return;
    }
    if (matches(script?.completeWhen, n)) {
      succeed(LESSON_ADVANCE_MS);
    }
  });


  // Intro comment once per lesson; reactions stick (no bounce back to opener).
  let lineHold: TutorialLineHold = { lessonKey: "", introDone: false };
  /** When the currently displayed comment landed — the ending hold subtracts it. */
  let shownComment = "";
  let shownAt = 0;
  let shownKey = "";
  let shownHoldMs = 0;
  const [holdTick, setHoldTick] = createSignal(0);
  let holdTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => {
    if (holdTimer != null) clearTimeout(holdTimer);
  });
  const [line, setLine] = createSignal(resolveTutorialLine({
    stageId: "fog",
    storyId: "king",
  }));
  createEffect(() => {
    const sec = section();
    const story = storyId();
    const n = tutorialNarration();
    holdTick();
    const ctx = {
      stageId: sec,
      storyId: story,
      chessSkin: sec === "fog" ? chessMode() : undefined,
      reviewPhase: n.reviewPhase,
      timelineActive: n.timelineActive,
      scfen: n.scfen,
      covers: n.covers,
      trajectories: n.trajectories,
      targetingKind: n.targetingKind,
      turnStartChecksApplied: n.turnStartChecksApplied,
      shipSniped: n.shipSniped,
    };
    const raw = resolveTutorialLine(ctx);
    const next = holdTutorialLine(
      lineHold,
      `${sec}|${story}|${lessonEpoch()}`,
      raw,
      ctx,
    );
    lineHold = next.hold;
    const key = `${sec}|${story}|${lessonEpoch()}`;
    // Plain fields, not a signal read: this effect writes `line`, so reading it
    // here would loop (`next.line` is a fresh object every run).
    if (next.line.comment !== shownComment) {
      const wait = key === shownKey ? shownHoldMs - (performance.now() - shownAt) : 0;
      if (wait > 0) {
        if (holdTimer == null) {
          holdTimer = setTimeout(() => {
            holdTimer = undefined;
            setHoldTick((t) => t + 1);
          }, wait);
        }
        return;
      }
      shownComment = next.line.comment;
      shownAt = performance.now();
      shownKey = key;
      shownHoldMs = next.line.holdMs ?? 0;
    }
    setLine(next.line);
  });

  /**
   * `ending` → success handoff. Created *after* the line effect on purpose: by
   * the time this runs, `line()` is the line the completing board produced, not
   * the one before it. Time the line has already been on screen counts toward
   * its reading budget, so only a line that lands with the objective waits the
   * full hold — a mid-lesson line the player has been reading doesn't re-charge
   * for it.
   */
  createEffect(() => {
    if (outcome() !== "ending") return;
    if (endingTimer != null) return;
    const hold =
      lessonEndMessageMs(line().comment) - (performance.now() - shownAt);
    if (hold <= 0) {
      completeObjective();
      return;
    }
    endingTimer = setTimeout(() => {
      endingTimer = undefined;
      completeObjective();
    }, hold);
  });

  const lineKey = () =>
    `${section()}|${storyId()}|${line().comment}|${line().emotion}|${line().action?.kind ?? ""}`;

  const retryLesson = () => {
    lineHold = { lessonKey: "", introDone: false };
    clearTimers();
    setLessonEpoch((n) => n + 1);
  };

  type CoachState = "shown" | "leaving" | "hidden" | "revealed";
  const [coachState, setCoachState] = createSignal<CoachState>("shown");
  let leaveTimer: ReturnType<typeof setTimeout> | undefined;
  const cancelLeave = () => {
    if (leaveTimer != null) clearTimeout(leaveTimer);
    leaveTimer = undefined;
  };
  onCleanup(cancelLeave);
  createEffect(() => {
    section();
    storyId();
    lessonEpoch();
    cancelLeave();
    setCoachState("shown");
  });
  createEffect(() => {
    const rule = tutorialStory(section(), storyId())?.hideCoachWhen;
    const n = tutorialNarration();
    const reveal = outcome() !== "active" || line().action?.kind === "retryLesson";
    const hide = !!rule && !reveal && matches(rule, n);
    const prev = untrack(coachState);
    if (prev === "leaving" && !reveal) return;
    if (hide) {
      if (prev === "shown" || prev === "revealed") {
        setCoachState("leaving");
        leaveTimer = setTimeout(() => {
          leaveTimer = undefined;
          setCoachState("hidden");
        }, tutorialStory(section(), storyId())?.coachFarewellMs ?? COACH_FAREWELL_MS);
      }
      return;
    }
    if (prev === "leaving") {
      cancelLeave();
      setCoachState("shown");
    } else if (prev === "hidden") {
      setCoachState("revealed");
    }
  });
  const coachHidden = () => coachState() === "hidden";
  const coachLeaving = () => coachState() === "leaving";
  const headerEmotion = createMemo(() => (coachLeaving() ? "happy" : line().emotion));

  /** Success / failure keep the coach's line and add the matching CTA. */
  const bubbleMessage = () =>
    coachLeaving()
      ? (tutorialStory(section(), storyId())?.coachFarewell ?? COACH_FAREWELL)
      : outcome() === "success"
      ? (line().comment || tutorialStory(section(), storyId())?.title || "Nice.")
      : line().comment;

  const bubbleAction = createMemo((): TutorialReactionAction | undefined => {
    if (outcome() === "success") {
      return hasNextLesson() ? NEXT_LESSON_ACTION : undefined;
    }
    if (outcome() === "failed") return RETRY_LESSON_ACTION;
    return line().action;
  });

  const bubbleVariant = createMemo(() => (outcome() === "success" ? "success" : "coach"));
  // Only when a timer is actually armed — `ending` waits on the line, not
  // on a countdown, so its bubble draws no border.
  const bubbleAutoAdvanceMs = createMemo(() =>
    outcome() === "failed" || (outcome() === "success" && hasNextLesson())
      ? LESSON_ADVANCE_MS
      : undefined,
  );
  const bubbleLineKey = createMemo(() =>
    coachLeaving() ? "coach-farewell" : `${lineKey()}|${outcome()}`,
  );

  const guideBubble = () => (
    <Show when={!coachHidden()}>
    <TutorialGuideBubble
      variant={bubbleVariant()}
      autoAdvanceMs={bubbleAutoAdvanceMs()}
      message={bubbleMessage()}
      lineKey={bubbleLineKey()}
      action={bubbleAction()}
      onAction={(action) => {
        if (action.kind === "retryLesson") retryLesson();
        if (action.kind === "nextLesson") {
          clearTimers();
          goNextLesson();
        }
        if (action.kind === "goSection") selectSection(action.section);
      }}
    />
    </Show>
  );

  const withFooter = (extra?: JSX.Element) => (
    <TutorialFooterNav
      section={section()}
      onSelect={selectSection}
    >
      {extra}
    </TutorialFooterNav>
  );


  /**
   * Lesson chrome: the shared `ScreenBackNav` band — `‹ Back` left, coach
   * centred. The old `‹ Previous Lesson` / `Next Lesson ›` pair is retired;
   * forward is the success CTA and sections are the breadcrumb.
   */
  const lessonCoachHeader = (opts: { testId: string }) => (
    <ScreenBackNav
      onBack={goHome}
      data-testid={opts.testId}
    >
      <div class={styles.coachHide} data-coach={coachState()} data-testid="tutorial-coach">
        <CoachAvatar identity="kerrigan" emotion={headerEmotion()} />
      </div>
    </ScreenBackNav>
  );

  const fogCoachHeader = () =>
    lessonCoachHeader({ testId: "tutorial-fog-coach-nav" });

  const specialCoachHeader = () =>
    lessonCoachHeader({ testId: "tutorial-specials-coach-nav" });

  const kingCoachHeader = () =>
    lessonCoachHeader({ testId: "tutorial-king-coach-nav" });

  const fogFooter = () =>
    withFooter(
      <SkinToggle chess={chessMode()} onChange={selectSkin} />,
    );

  const specialFooter = () => withFooter();

  const kingFooter = () => withFooter();

  const resolveFooter = () => withFooter();

  const lessonKey = () => `${storyId()}#${lessonEpoch()}`;
  const sectionBoard = (stage: TutorialSectionId) =>
    createMemo<LiveLessonBoard>((prev) =>
      section() === stage ? lessonBoard(stage, storyId()) : prev!,
    );
  const sectionBeats = (stage: TutorialSectionId) =>
    createMemo<readonly TutorialBeat[] | undefined>((prev) =>
      section() === stage ? tutorialStory(stage, storyId())?.beats : prev,
    );

  const FogLesson: Component = () => {
    const board = sectionBoard("fog");
    const beats = sectionBeats("fog");
    return (
      <FogSection
        board={board()}
        lessonKey={lessonKey()}
        beats={beats()}
        chessMode={chessMode()}
        showHints={hintsReady()}
        liveHints={liveHints}
        coachEmotion={line().emotion}
        guideBubble={guideBubble()}
        header={fogCoachHeader()}
        footer={fogFooter()}
        onHome={goHome}
      />
    );
  };

  const SpecialsLesson: Component = () => {
    const board = sectionBoard("specials");
    const beats = sectionBeats("specials");
    const hints = createMemo(() => liveHints(beats()));
    return (
      <LiveLessonHost
        board={board()}
        lessonKey={lessonKey()}
        tutorial
        narrate
        hideResources
        turnChrome="none"
        onExitToMenu={goHome}
        coachEmotion={line().emotion}
        header={specialCoachHeader()}
        guideBubble={guideBubble()}
        footerExtra={specialFooter()}
        boardHints={hints()}
      />
    );
  };

  const LivePlayLesson: Component = () => {
    const board = sectionBoard("live-play");
    const beats = sectionBeats("live-play");
    const hints = createMemo(() => liveHints(beats()));
    return (
      <LiveLessonHost
        board={board()}
        lessonKey={lessonKey()}
        tutorial
        narrate
        turnChrome="sidebar"
        onExitToMenu={goHome}
        coachEmotion={line().emotion}
        header={kingCoachHeader()}
        guideBubble={guideBubble()}
        footerExtra={kingFooter()}
        boardHints={hints()}
        hudResources={coachHidden()}
      />
    );
  };

  return (
    <LiveMatchShell world="eclipse" testId="starchess-tutorial">
      <Switch>
        <Match when={section() === "fog"}>
          <FogLesson />
        </Match>
        <Match when={section() === "specials"}>
          <SpecialsLesson />
        </Match>
        <Match when={section() === "resolve"}>
          {/* Two replays, one host — keyed so switching story remounts the
              review timeline instead of seeking the old one. */}
          <Show when={storyId()} keyed>
            {(id) => {
              const hunt = id === "king-hunt";
              return (
                <TutorialReviewHost
                  history={hunt ? KING_HISTORY : COMBAT_HISTORY}
                  reviewLabel={hunt ? "King hunt" : "Combat chain"}
                  visionMode="observer"
                  fog={false}
                  variant="eclipse"
                  turnChrome="sidebar"
                  onHome={goHome}
                  coachEmotion={line().emotion}
                  guideBubble={guideBubble()}
                  footerExtra={resolveFooter()}
                  intentArrows={tutorialStory("resolve", id)?.intentArrows}
                />
              );
            }}
          </Show>
        </Match>
        <Match when={section() === "live-play"}>
          <LivePlayLesson />
        </Match>
      </Switch>
    </LiveMatchShell>
  );
};
