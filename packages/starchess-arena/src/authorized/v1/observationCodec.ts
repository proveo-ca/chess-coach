// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import { CC_MAX_LIVES, MAX_GAME_TURNS, MAX_STORED_MATERIAL, MAX_MINES_PER_SIDE } from "@chess-coach/starchess-core/planning-v1";
import { canonical, deepFreeze } from "./canonical";
import { SQUARES } from "./squares";
import type { AuthorizedObservation, ObservedCell, Sighting } from "./types";
import { array, fail, integer, object, orderedSquares, parseJson, piece, side, square } from "../../challengeContract/validation";

export const OBSERVATION_CODEC_VERSION = "challenge-observation-codec-v1";
const validateObservationRecord = (value: unknown, requireCC: boolean): AuthorizedObservation => {
  const root = object(value, "$", ["version", "side", "turn", "own", "cells", "memory"]);
  if (root.version !== "challenge-observation-v1") fail("$.version", "VERSION");
  const color = side(root.side, "$.side");
  const turn = integer(root.turn, "$.turn", 0, MAX_GAME_TURNS);
  const own = object(root.own, "$.own", ["minerals", "gas", "gasIncome", "ccLives", "pieces", "mines", "siegedTanks"]);
  const minerals = integer(own.minerals, "$.own.minerals", 0, MAX_STORED_MATERIAL);
  const gasIncome = integer(own.gasIncome, "$.own.gasIncome", 1, 3);
  const gas = integer(own.gas, "$.own.gas", 0, gasIncome);
  const ccLives = integer(own.ccLives, "$.own.ccLives", 0, CC_MAX_LIVES);
  const cells: ObservedCell[] = array(root.cells, "$.cells").map((entry, index) => {
    const path = `$.cells[${index}]`;
    const cell = object(entry, path, ["square", "visibility"], ["piece"]);
    const at = square(cell.square, `${path}.square`);
    if (at !== SQUARES[index]) fail(`${path}.square`, "ORDER");
    if (cell.visibility === "unknown") {
      if (Object.hasOwn(cell, "piece")) fail(`${path}.piece`);
      return { square: at, visibility: "unknown" };
    }
    if (cell.visibility !== "lit" && cell.visibility !== "revealed") return fail(`${path}.visibility`);
    if (!Object.hasOwn(cell, "piece") || (cell.visibility === "revealed" && cell.piece === null)) fail(`${path}.piece`);
    const current = cell.piece === null ? null : piece(cell.piece, `${path}.piece`);
    if (cell.visibility === "revealed") {
      if (!current || current.type !== "q" || current.color === color) return fail(`${path}.piece`);
      return { square: at, visibility: "revealed", piece: current };
    }
    return { square: at, visibility: "lit", piece: current };
  });
  if (cells.length !== 64) fail("$.cells", "CARDINALITY");
  const pieces = array(own.pieces, "$.own.pieces").map((entry, index) => {
    const path = `$.own.pieces[${index}]`;
    const item = object(entry, path, ["square", "piece"]);
    const current = piece(item.piece, `${path}.piece`);
    if (current.color !== color) fail(`${path}.piece.color`);
    return { square: square(item.square, `${path}.square`), piece: current };
  });
  orderedSquares(pieces, (entry) => entry.square, "$.own.pieces");
  const expected = cells.flatMap((cell) => cell.visibility !== "unknown" && cell.piece?.color === color ? [{ square: cell.square, piece: cell.piece }] : []);
  const ccCount = pieces.filter((entry) => entry.piece.type === "k").length;
  if (canonical(expected) !== canonical(pieces) || (requireCC ? ccCount !== 1 : ccCount > 1)) fail("$.own.pieces", "CONSISTENCY");
  const mines = array(own.mines, "$.own.mines", MAX_MINES_PER_SIDE).map((entry, index) => square(entry, `$.own.mines[${index}]`));
  const siegedTanks = array(own.siegedTanks, "$.own.siegedTanks").map((entry, index) => square(entry, `$.own.siegedTanks[${index}]`));
  orderedSquares(mines, (entry) => entry, "$.own.mines");
  orderedSquares(siegedTanks, (entry) => entry, "$.own.siegedTanks");
  if (mines.some((at) => cells.find((cell) => cell.square === at)!.visibility !== "lit") ||
    siegedTanks.some((at) => !pieces.some((entry) => entry.square === at && entry.piece.type === "r"))) fail("$.own", "CONSISTENCY");
  const memory: Sighting[] = array(root.memory, "$.memory").map((entry, index) => {
    const path = `$.memory[${index}]`;
    const item = object(entry, path, ["square", "piece", "observedTurn"]);
    const remembered = piece(item.piece, `${path}.piece`);
    if (remembered.color === color) fail(`${path}.piece.color`);
    return { square: square(item.square, `${path}.square`), piece: remembered, observedTurn: integer(item.observedTurn, `${path}.observedTurn`, 0, turn) };
  });
  orderedSquares(memory, (entry) => entry.square, "$.memory");
  for (const cell of cells) {
    if (cell.visibility === "unknown") continue;
    const sighting = memory.find((entry) => entry.square === cell.square);
    if (cell.piece && cell.piece.color !== color) {
      if (!sighting || sighting.observedTurn !== turn || canonical(sighting.piece) !== canonical(cell.piece)) fail("$.memory", "CONSISTENCY");
    } else if (sighting) fail("$.memory", "CONSISTENCY");
  }
  return deepFreeze({ version: "challenge-observation-v1", side: color, turn,
    own: { minerals, gas, gasIncome, ccLives, pieces, mines, siegedTanks }, cells, memory });
};
export const validateObservation = (value: unknown): AuthorizedObservation => validateObservationRecord(value, true);
export const validateCompatibleObservation = (value: unknown): AuthorizedObservation => validateObservationRecord(value, false);
export const encodeObservation = (observation: AuthorizedObservation): string => canonical({ codecVersion: OBSERVATION_CODEC_VERSION, observation: validateObservation(observation) });
export const decodeObservation = (json: string): AuthorizedObservation => {
  const envelope = object(parseJson(json), "$", ["codecVersion", "observation"]);
  if (envelope.codecVersion !== OBSERVATION_CODEC_VERSION) fail("$.codecVersion", "VERSION");
  return validateObservation(envelope.observation);
};
