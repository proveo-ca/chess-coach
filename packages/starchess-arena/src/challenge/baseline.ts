// SPEC: _spec/packages/starchess-arena/ml-adjutant-phase1.puml
import { adjacentSquares, scMovesFor, UNIT_COST, type ScActionInput, type ScPiece, type Square } from "@chess-coach/starchess-core";
import { canonical, CHALLENGE_CONFIG } from "./config";
import type { AuthorizedObservation, CandidatePolicy, QueueProposal } from "./types";

export const baselineProposals = (observation: AuthorizedObservation): QueueProposal[] => {
  const map = new Map<Square, ScPiece>();
  for (const cell of observation.cells) {
    if (cell.visibility !== "unknown" && cell.piece) map.set(cell.square, cell.piece);
  }
  const proposals: QueueProposal[] = [];
  const push = (actions: ScActionInput[], score: number) => proposals.push({ actions, score, key: canonical(actions) });
  for (const move of scMovesFor(map, observation.side, {
    siegedTanks: observation.own.siegedTanks,
    mines: observation.own.mines.map((at) => ({ at, color: observation.side })),
  })) {
    if (move.dropsAtResolve) continue;
    const advance = (Number(move.to[1]) - Number(move.from[1])) * (observation.side === "w" ? 1 : -1);
    const score = move.promotes ? 1000 : move.capture ? 500 + UNIT_COST[move.capture.type === "k" ? "p" : move.capture.type]
      : move.piece === "p" && advance > 0 ? 100 + advance : 10;
    push([{
      kind: "classical", timing: "C", color: observation.side, from: move.from, to: move.to,
      ...(move.promotion ? { promotion: move.promotion } : {}),
    }], score);
  }
  const cc = observation.own.pieces.find(({ piece }) => piece.type === "k");
  if (cc && observation.own.gas >= 1 && observation.own.minerals >= UNIT_COST.p) {
    for (const to of adjacentSquares(cc.square)) {
      if (!map.has(to)) push([{ kind: "deploy", timing: "B", color: observation.side, from: cc.square, to, unit: "p" }], 50);
    }
  }
  push([], 0);
  if (proposals.length > CHALLENGE_CONFIG.maxProposals) throw new Error("proposal limit exceeded");
  const keys = new Set<string>();
  for (const proposal of proposals) {
    if (!Number.isFinite(proposal.score) || keys.has(proposal.key)) throw new Error("invalid baseline proposals");
    keys.add(proposal.key);
  }
  return proposals.sort((a, b) => b.score - a.score || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
};

export const baselinePolicy: CandidatePolicy = {
  name: CHALLENGE_CONFIG.baselineVersion,
  choose: (observation) => structuredClone(baselineProposals(observation)[0]!.actions),
};
