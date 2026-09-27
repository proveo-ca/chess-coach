// SPEC: _spec/apps/starchess/models/tutorial-lesson.puml
// Tutorial live-lesson host: lesson/epoch keys, the three timer owners, unmount,
// and which opponent BaseScreen was handed. Source map in tutorial-lesson.puml.
module tutorialLesson {
  const LESSONS: Set[int]
  const OPPONENT_LESSONS: Set[int]
  const MAX_EPOCH: int
  // Regression switches: true re-creates a shipped bug; the checker must find it.
  const STALE_OPPONENT: bool
  const UNOWNED_STORE_TIMERS: bool
  const UNGUARDED_AUTO_END: bool

  type Key = { lesson: int, epoch: int }
  type Timer = { kind: str, key: Key }

  var mounted: bool
  var lesson: int
  var epoch: int
  var armed: bool
  var screenTimers: Set[Timer]
  var baseTimers: Set[Timer]
  var storeTimers: Set[Timer]
  var violation: (str, str)

  val cur: Key = { lesson: lesson, epoch: epoch }
  pure val SCREEN_KINDS = Set("advance", "retry", "elapsed", "ending", "leave")

  action init = {
    nondet l = LESSONS.oneOf()
    all {
      mounted' = true,
      lesson' = l,
      epoch' = 0,
      armed' = OPPONENT_LESSONS.contains(l),
      screenTimers' = Set(),
      baseTimers' = Set(),
      storeTimers' = Set(),
      violation' = ("", ""),
    }
  }

  // TutorialScreen key change → clearTimers + cancelLeave; LiveLessonHost
  // createComputed(on(lessonKey)) → cancelEffects + LOAD_SCFEN. BaseScreen is not
  // remounted, so its timers survive; the opponent prop follows the memo.
  action enterLesson(l: int, e: int): bool = all {
    mounted,
    lesson' = l,
    epoch' = e,
    armed' = if (STALE_OPPONENT) armed else OPPONENT_LESSONS.contains(l),
    screenTimers' = Set(),
    baseTimers' = baseTimers,
    storeTimers' = Set({ kind: "armIdle", key: { lesson: l, epoch: e } }),
    violation' = violation,
    mounted' = mounted,
  }

  action navigate = {
    nondet l = LESSONS.oneOf()
    all { l != lesson, enterLesson(l, 0) }
  }

  action retry = all { epoch < MAX_EPOCH, enterLesson(lesson, epoch + 1) }

  action armScreenTimer = {
    nondet k = SCREEN_KINDS.oneOf()
    all {
      mounted,
      screenTimers' = screenTimers.union(Set({ kind: k, key: cur })),
      mounted' = mounted, lesson' = lesson, epoch' = epoch, armed' = armed,
      baseTimers' = baseTimers, storeTimers' = storeTimers, violation' = violation,
    }
  }

  // BaseScreen Auto-End: the queue-ready edge schedules one submit a task later.
  action queueReady = all {
    mounted,
    baseTimers' = Set({ kind: "autoEnd", key: cur }),
    mounted' = mounted, lesson' = lesson, epoch' = epoch, armed' = armed,
    screenTimers' = screenTimers, storeTimers' = storeTimers, violation' = violation,
  }

  // MatchStore armTimer: cancels the pending idle arm and any timeout, arms one.
  action armTurnTimer = all {
    mounted,
    storeTimers' = Set({ kind: "timeout", key: cur }),
    mounted' = mounted, lesson' = lesson, epoch' = epoch, armed' = armed,
    screenTimers' = screenTimers, baseTimers' = baseTimers, violation' = violation,
  }

  def firedInto(t: Timer): str =
    if (not(mounted)) "fired after unmount"
    else if (t.key != cur) "fired into another lesson"
    else ""

  def note(v: str, t: Timer): (str, str) =
    if (violation._2 != "" or v == "") violation else (t.kind, v)

  action fireScreenTimer = all {
    screenTimers.size() > 0,
    nondet t = screenTimers.oneOf()
    all {
      screenTimers' = screenTimers.exclude(Set(t)),
      violation' = note(firedInto(t), t),
      mounted' = mounted, lesson' = lesson, epoch' = epoch, armed' = armed,
      baseTimers' = baseTimers, storeTimers' = storeTimers,
    },
  }

  // Fixed: the callback submits only the board the effect judged ready, so a
  // submit armed before LOAD_SCFEN is a no-op after it.
  action fireAutoEnd = all {
    baseTimers.size() > 0,
    nondet t = baseTimers.oneOf()
    all {
      baseTimers' = baseTimers.exclude(Set(t)),
      violation' =
        if (UNGUARDED_AUTO_END or not(mounted)) note(firedInto(t), t) else violation,
      mounted' = mounted, lesson' = lesson, epoch' = epoch, armed' = armed,
      screenTimers' = screenTimers, storeTimers' = storeTimers,
    },
  }

  action fireStoreTimer = all {
    storeTimers.size() > 0,
    nondet t = storeTimers.oneOf()
    all {
      storeTimers' =
        if (t.kind == "armIdle" and firedInto(t) == "") Set({ kind: "timeout", key: cur })
        else storeTimers.exclude(Set(t)),
      violation' = note(firedInto(t), t),
      mounted' = mounted, lesson' = lesson, epoch' = epoch, armed' = armed,
      screenTimers' = screenTimers, baseTimers' = baseTimers,
    },
  }

  // Leaving the route disposes TutorialScreen, BaseScreen and the match store.
  action unmount = all {
    mounted,
    mounted' = false,
    screenTimers' = Set(),
    baseTimers' = Set(),
    storeTimers' = if (UNOWNED_STORE_TIMERS) storeTimers else Set(),
    lesson' = lesson, epoch' = epoch, armed' = armed, violation' = violation,
  }

  action step = any {
    navigate,
    retry,
    armScreenTimer,
    queueReady,
    armTurnTimer,
    fireScreenTimer,
    fireAutoEnd,
    fireStoreTimer,
    unmount,
  }

  val noTimerMisfires = violation._2 == ""
  val opponentMatchesLesson = mounted implies (armed == OPPONENT_LESSONS.contains(lesson))
  val oneTurnTimer = storeTimers.size() <= 1
  val safe = noTimerMisfires and opponentMatchesLesson and oneTurnTimer
}

module fixed {
  import tutorialLesson(
    LESSONS = Set(0, 1, 2),
    OPPONENT_LESSONS = Set(1, 2),
    MAX_EPOCH = 1,
    STALE_OPPONENT = false,
    UNOWNED_STORE_TIMERS = false,
    UNGUARDED_AUTO_END = false,
  ).*
}

module staleOpponent {
  import tutorialLesson(
    LESSONS = Set(0, 1, 2),
    OPPONENT_LESSONS = Set(1, 2),
    MAX_EPOCH = 1,
    STALE_OPPONENT = true,
    UNOWNED_STORE_TIMERS = false,
    UNGUARDED_AUTO_END = false,
  ).*
}

module unownedStoreTimers {
  import tutorialLesson(
    LESSONS = Set(0, 1, 2),
    OPPONENT_LESSONS = Set(1, 2),
    MAX_EPOCH = 1,
    STALE_OPPONENT = false,
    UNOWNED_STORE_TIMERS = true,
    UNGUARDED_AUTO_END = false,
  ).*
}

module unguardedAutoEnd {
  import tutorialLesson(
    LESSONS = Set(0, 1, 2),
    OPPONENT_LESSONS = Set(1, 2),
    MAX_EPOCH = 1,
    STALE_OPPONENT = false,
    UNOWNED_STORE_TIMERS = false,
    UNGUARDED_AUTO_END = true,
  ).*
}
