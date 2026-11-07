// SPEC: _spec/causal-journal.puml
import { expect, test } from "bun:test";
import { addScAction } from "../src";
import { beginWithJournal, endWithJournal, seedCausalState } from "../src/causal-producer";
import type { CausalState } from "../src/causal-producer";
import { decodeCausalJournal, encodeCausalJournal } from "../../contracts/src/causal-journal";
import { turnCaseOutcome, TURN_QUEUES } from "./turn-corpus";

for (let variant = 0; variant < 5; variant++) {
  test(`journal sink preserves every canonical full-turn outcome for variant ${variant}`, () => {
    let state: CausalState;
    const api = {
      addScAction,
      beginScTurn: (snapshot: Parameters<typeof beginWithJournal>[0]) => {
        const produced = beginWithJournal(snapshot, seedCausalState(snapshot));
        state = produced.state;
        return produced.result;
      },
      endScTurn: (snapshot: Parameters<typeof endWithJournal>[0], options?: Parameters<typeof endWithJournal>[2]) => {
        const produced = endWithJournal(snapshot, state, options);
        decodeCausalJournal(encodeCausalJournal(produced.journal));
        state = produced.state;
        return produced.result;
      },
    };
    for (let white = 0; white < TURN_QUEUES.length; white++) for (let black = 0; black < TURN_QUEUES.length; black++) {
      const request = { variant, white, black };
      expect(turnCaseOutcome(request, api), JSON.stringify(request)).toEqual(turnCaseOutcome(request));
    }
  }, 60_000);
}
