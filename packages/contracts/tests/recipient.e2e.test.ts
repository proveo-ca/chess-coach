// SPEC: _spec/observations.puml
import { expect, test } from "bun:test";
import { scMovesFrom } from "@chess-coach/game-core";
import { decodeObservation, encodeObservation } from "../src";
import { fixture } from "./fixture";

test("recipient JSON reaches core planning without hidden occupancy fields", () => {
  const observation = decodeObservation(JSON.stringify(fixture()));
  const roundTrip = decodeObservation(encodeObservation(observation));
  const recipientBoard = new Map(roundTrip.cells.flatMap(cell =>
    cell.visibility !== "unknown" && cell.piece ? [[cell.square, cell.piece] as const] : [],
  ));
  expect(recipientBoard.has("e8")).toBe(false);
  expect(recipientBoard.get("h8")).toEqual({ type: "q", color: "b" });
  expect(roundTrip.cells.find(cell => cell.square === "e8")).toEqual({ square: "e8", visibility: "unknown" });
  expect(scMovesFrom(recipientBoard, "d2", roundTrip.side).map(move => move.to)).toEqual(["d3", "d4"]);
});
