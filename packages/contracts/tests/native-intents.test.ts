// SPEC: _spec/runtime-protocol.puml, _spec/recipient-production.puml
import { expect, test } from "bun:test";
import { decodeCandidate } from "../src/candidate";
import { decodeNativeIntents } from "../src/native-intents";
import { GameAdmissionError, initializeGame, openGame, settleGame } from "../src/game-session";

test("native recorded/opponent codec keeps 65 intents without enlarging learned candidates", () => {
  const action = { kind: "classical", timing: "C", color: "w", from: "e2", to: "e3" };
  const actions = Array(65).fill(action);
  expect(decodeNativeIntents(JSON.stringify(actions), "w")).toHaveLength(65);
  expect(() => decodeNativeIntents(JSON.stringify([...actions, action]), "w")).toThrow();
  expect(() => decodeCandidate(JSON.stringify({ version: "chess-coach.candidate.v1", actions }), "w")).toThrow();
  expect(() => decodeNativeIntents(JSON.stringify([action]), "b")).toThrow("SIDE");
});

test("actual native queue denial has a typed side/index while malformed structures do not", () => {
  const parent = openGame(initializeGame()).session, before = structuredClone(parent);
  const actions = Array.from({ length: 5 }, () => ({ kind: "classical", timing: "C", color: "w", from: "e2", to: "e3" } as const));
  try { settleGame(parent, { w: actions, b: [] }); throw new Error("must deny"); }
  catch (error) {
    expect(error).toBeInstanceOf(GameAdmissionError);
    expect(error).toMatchObject({ side: "w", actionOrdinal: 1, code: "SC_QUEUE_SHAPE" });
  }
  expect(parent).toEqual(before);
  try { settleGame(parent, { w: [{ ...actions[0]!, color: "b" }], b: [] }); throw new Error("must reject malformed side"); }
  catch (error) { expect(error).not.toBeInstanceOf(GameAdmissionError); }
});
