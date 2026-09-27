---------------------------- MODULE counterexample ----------------------------

EXTENDS unguardedAutoEnd

(* Constant initialization state *)
ConstInit == TRUE

(* Initial state [_transition(0)] *)
State0 ==
  unguardedAutoEnd_tutorialLesson_armed = FALSE
    /\ unguardedAutoEnd_tutorialLesson_baseTimers = {}
    /\ unguardedAutoEnd_tutorialLesson_epoch = 0
    /\ unguardedAutoEnd_tutorialLesson_lesson = 0
    /\ unguardedAutoEnd_tutorialLesson_mounted = TRUE
    /\ unguardedAutoEnd_tutorialLesson_screenTimers = {}
    /\ unguardedAutoEnd_tutorialLesson_storeTimers = {}
    /\ unguardedAutoEnd_tutorialLesson_violation = <<"", "">>

(* State1 [_transition(1)] *)
State1 ==
  unguardedAutoEnd_tutorialLesson_armed = FALSE
    /\ unguardedAutoEnd_tutorialLesson_baseTimers
      = {[key |-> [epoch |-> 0, lesson |-> 0], kind |-> "autoEnd"]}
    /\ unguardedAutoEnd_tutorialLesson_epoch = 0
    /\ unguardedAutoEnd_tutorialLesson_lesson = 0
    /\ unguardedAutoEnd_tutorialLesson_mounted = TRUE
    /\ unguardedAutoEnd_tutorialLesson_screenTimers = {}
    /\ unguardedAutoEnd_tutorialLesson_storeTimers = {}
    /\ unguardedAutoEnd_tutorialLesson_violation = <<"", "">>

(* State2 [_transition(4)] *)
State2 ==
  unguardedAutoEnd_tutorialLesson_armed = TRUE
    /\ unguardedAutoEnd_tutorialLesson_baseTimers
      = {[key |-> [epoch |-> 0, lesson |-> 0], kind |-> "autoEnd"]}
    /\ unguardedAutoEnd_tutorialLesson_epoch = 0
    /\ unguardedAutoEnd_tutorialLesson_lesson = 1
    /\ unguardedAutoEnd_tutorialLesson_mounted = TRUE
    /\ unguardedAutoEnd_tutorialLesson_screenTimers = {}
    /\ unguardedAutoEnd_tutorialLesson_storeTimers
      = {[key |-> [epoch |-> 0, lesson |-> 1], kind |-> "armIdle"]}
    /\ unguardedAutoEnd_tutorialLesson_violation = <<"", "">>

(* State3 [_transition(7)] *)
State3 ==
  unguardedAutoEnd_tutorialLesson_armed = TRUE
    /\ unguardedAutoEnd_tutorialLesson_baseTimers = {}
    /\ unguardedAutoEnd_tutorialLesson_epoch = 0
    /\ unguardedAutoEnd_tutorialLesson_lesson = 1
    /\ unguardedAutoEnd_tutorialLesson_mounted = TRUE
    /\ unguardedAutoEnd_tutorialLesson_screenTimers = {}
    /\ unguardedAutoEnd_tutorialLesson_storeTimers
      = {[key |-> [epoch |-> 0, lesson |-> 1], kind |-> "armIdle"]}
    /\ unguardedAutoEnd_tutorialLesson_violation
      = <<"autoEnd", "fired into another lesson">>

(* The following formula holds true in the last state and violates the invariant *)
InvariantViolation == ~(unguardedAutoEnd_tutorialLesson_violation[2] = "")

================================================================================
(* Created by Apalache on Sun Sep 27 10:26:21 GMT-07:00 2026 *)
(* https://github.com/apalache-mc/apalache *)
