// SPEC: _spec/recipient-production.puml
import { applyStoredIncome, UNIT_COST } from "@chess-coach/game-core";
import type { ScActionInput, ScFenSnapshot } from "@chess-coach/game-core";
import { produceRecipient, seedRecipient } from "../src/recipient";
import { causalRun } from "./causal-fixture";

export function recipientRun(snapshot: ScFenSnapshot, white: readonly ScActionInput[] = [], black: readonly ScActionInput[] = []) {
  const native = causalRun(snapshot, [...white, ...black]);
  const bank = snapshot.stored!;
  const initial = { w: seedRecipient(snapshot, native.initial, "w", bank.w), b: seedRecipient(snapshot, native.initial, "b", bank.b) };
  const opened = {
    w: produceRecipient(initial.w.state, native.began.result.next, native.began.state, native.began.journal, "opened", bank.w),
    b: produceRecipient(initial.b.state, native.began.result.next, native.began.state, native.began.journal, "opened", bank.b),
  };
  const debit = (intents: readonly ScActionInput[]): number => intents.reduce((sum, action) => sum + (action.kind === "deploy" && action.unit ? UNIT_COST[action.unit] : 0), 0);
  const finalBank = applyStoredIncome({ w: bank.w - debit(white), b: bank.b - debit(black) }, native.ended.result.next.turn);
  const settled = {
    w: produceRecipient(opened.w.state, native.ended.result.next, native.ended.state, native.ended.journal, "settled", finalBank.w, native.queued.queue!.actions),
    b: produceRecipient(opened.b.state, native.ended.result.next, native.ended.state, native.ended.journal, "settled", finalBank.b, native.queued.queue!.actions),
  };
  return { native, initial, opened, settled, finalBank };
}
