---------------------------- MODULE counterexample ----------------------------

EXTENDS staleOpponent

(* Constant initialization state *)
ConstInit == TRUE

(* Initial state [_transition(0)] *)
State0 ==
  staleOpponent_tutorialLesson_armed = TRUE
    /\ staleOpponent_tutorialLesson_baseTimers = {}
    /\ staleOpponent_tutorialLesson_epoch = 0
    /\ staleOpponent_tutorialLesson_lesson = 1
    /\ staleOpponent_tutorialLesson_mounted = TRUE
    /\ staleOpponent_tutorialLesson_screenTimers = {}
    /\ staleOpponent_tutorialLesson_storeTimers = {}
    /\ staleOpponent_tutorialLesson_violation = <<"", "">>

(* State1 [_transition(4)] *)
State1 ==
  staleOpponent_tutorialLesson_armed = TRUE
    /\ staleOpponent_tutorialLesson_baseTimers = {}
    /\ staleOpponent_tutorialLesson_epoch = 0
    /\ staleOpponent_tutorialLesson_lesson = 0
    /\ staleOpponent_tutorialLesson_mounted = TRUE
    /\ staleOpponent_tutorialLesson_screenTimers = {}
    /\ staleOpponent_tutorialLesson_storeTimers = {}
    /\ staleOpponent_tutorialLesson_violation = <<"", "">>

(* The following formula holds true in the last state and violates the invariant *)
InvariantViolation ==
  staleOpponent_tutorialLesson_mounted
    /\ ~(staleOpponent_tutorialLesson_armed
      = (staleOpponent_tutorialLesson_lesson \in { 1, 2 }))

================================================================================
(* Created by Apalache on Sun Sep 27 09:53:30 GMT-07:00 2026 *)
(* https://github.com/apalache-mc/apalache *)
