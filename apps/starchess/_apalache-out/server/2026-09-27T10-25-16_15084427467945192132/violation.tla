---------------------------- MODULE counterexample ----------------------------

EXTENDS unownedStoreTimers

(* Constant initialization state *)
ConstInit == TRUE

(* Initial state [_transition(0)] *)
State0 ==
  unownedStoreTimers_tutorialLesson_armed = TRUE
    /\ unownedStoreTimers_tutorialLesson_baseTimers = {}
    /\ unownedStoreTimers_tutorialLesson_epoch = 0
    /\ unownedStoreTimers_tutorialLesson_lesson = 2
    /\ unownedStoreTimers_tutorialLesson_mounted = TRUE
    /\ unownedStoreTimers_tutorialLesson_screenTimers = {}
    /\ unownedStoreTimers_tutorialLesson_storeTimers = {}
    /\ unownedStoreTimers_tutorialLesson_violation = <<"", "">>

(* State1 [_transition(2)] *)
State1 ==
  unownedStoreTimers_tutorialLesson_armed = TRUE
    /\ unownedStoreTimers_tutorialLesson_baseTimers = {}
    /\ unownedStoreTimers_tutorialLesson_epoch = 0
    /\ unownedStoreTimers_tutorialLesson_lesson = 2
    /\ unownedStoreTimers_tutorialLesson_mounted = TRUE
    /\ unownedStoreTimers_tutorialLesson_screenTimers = {}
    /\ unownedStoreTimers_tutorialLesson_storeTimers
      = {[key |-> [epoch |-> 0, lesson |-> 2], kind |-> "timeout"]}
    /\ unownedStoreTimers_tutorialLesson_violation = <<"", "">>

(* State2 [_transition(3)] *)
State2 ==
  unownedStoreTimers_tutorialLesson_armed = TRUE
    /\ unownedStoreTimers_tutorialLesson_baseTimers = {}
    /\ unownedStoreTimers_tutorialLesson_epoch = 0
    /\ unownedStoreTimers_tutorialLesson_lesson = 2
    /\ unownedStoreTimers_tutorialLesson_mounted = FALSE
    /\ unownedStoreTimers_tutorialLesson_screenTimers = {}
    /\ unownedStoreTimers_tutorialLesson_storeTimers
      = {[key |-> [epoch |-> 0, lesson |-> 2], kind |-> "timeout"]}
    /\ unownedStoreTimers_tutorialLesson_violation = <<"", "">>

(* State3 [_transition(8)] *)
State3 ==
  unownedStoreTimers_tutorialLesson_armed = TRUE
    /\ unownedStoreTimers_tutorialLesson_baseTimers = {}
    /\ unownedStoreTimers_tutorialLesson_epoch = 0
    /\ unownedStoreTimers_tutorialLesson_lesson = 2
    /\ unownedStoreTimers_tutorialLesson_mounted = FALSE
    /\ unownedStoreTimers_tutorialLesson_screenTimers = {}
    /\ unownedStoreTimers_tutorialLesson_storeTimers = {}
    /\ unownedStoreTimers_tutorialLesson_violation
      = <<"timeout", "fired after unmount">>

(* The following formula holds true in the last state and violates the invariant *)
InvariantViolation == ~(unownedStoreTimers_tutorialLesson_violation[2] = "")

================================================================================
(* Created by Apalache on Sun Sep 27 10:25:19 GMT-07:00 2026 *)
(* https://github.com/apalache-mc/apalache *)
