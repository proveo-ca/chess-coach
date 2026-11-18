// SPEC: _spec/runtime-protocol.puml
import { initializeGame, openGame, settleGame } from "../../contracts/src/game-session";
import type { GameSession } from "../../contracts/src/game-session";
import { nativeBoundaryShape } from "../../contracts/src/native-protocol";
import type { NativeBoundary } from "../../contracts/src/native-protocol";
import type { GameDriver } from "./worker";

function data(state: GameSession, kind: NativeBoundary["kind"], kernel: unknown): NativeBoundary {
  return nativeBoundaryShape.parse({ kind, snapshot: state.snapshot, bank: state.bank, batches: state.batches, kernel });
}
export const currentGameDriver: GameDriver<GameSession> = {
  initialize: () => { const state = initializeGame(); return { state, boundary: data(state, "initial", { kind: "initial" }) }; },
  open: prior => { const next = openGame(prior); return { state: next.session, boundary: data(next.session, "opened", { kind: "opened", result: next.native.value.result }) }; },
  settle: (prior, plans) => { const next = settleGame(prior, plans); return { state: next.session, boundary: data(next.session, "settled", { kind: "settled", result: next.native.value.result }) }; },
};
