// SPEC: _spec/packages/starchess-arena/ml-adjutant-phase1.puml
import {
  beginScTurn, endScTurn, formatScFen, normalizeSnapGas, parseScFen, scOutcome,
  type ScActionInput,
} from "@chess-coach/starchess-core";
import { grantStoredIncome, type Bank } from "../run/bank";
import { commitPair, stageQueue } from "./admission";
import { canonical, CHALLENGE_CONFIG } from "./config";
import type { ChallengeEvidence } from "./types";

export const executionIntegrity = (evidence: ChallengeEvidence): boolean => {
  try {
    if (evidence.stop.kind === "script-contract" || evidence.scfens.length !== evidence.resolves.length + 1 ||
      evidence.bankTrail.length !== evidence.resolves.length || evidence.resolves.length > CHALLENGE_CONFIG.maxRecordedPlies ||
      evidence.fallbackCount !== 0 || evidence.modelArtifact !== null || evidence.learnedGateEligible !== false) return false;
    let snap = parseScFen(evidence.match.opening);
    if (!snap.stored || snap.stored.w !== 3 || snap.stored.b !== 3 || (snap.queue?.actions.length ?? 0) !== 0 ||
      evidence.scfens[0] !== formatScFen(normalizeSnapGas(snap))) return false;
    let bank: Bank = { ...snap.stored };
    let ready = false;
    let windows = 0;
    for (const [index, resolve] of evidence.resolves.entries()) {
      if (scOutcome(snap)) return false;
      if (!ready) {
        const opened = beginScTurn(snap);
        snap = opened.next;
        if (opened.asResolve) {
          if (canonical(resolve) !== canonical(opened.asResolve) ||
            evidence.scfens[index + 1] !== formatScFen(normalizeSnapGas(snap)) ||
            canonical(evidence.bankTrail[index]) !== canonical(bank)) return false;
          ready = true;
          continue;
        }
      }
      if (windows >= CHALLENGE_CONFIG.maxWindows || !Array.isArray(resolve.queue)) return false;
      const queue = resolve.queue;
      if (queue.some((action) => action.color !== "w" && action.color !== "b")) return false;
      const intents = (side: "w" | "b"): ScActionInput[] => queue.filter((action) => action.color === side)
        .map(({ seq: _seq, ...action }) => action);
      const white = stageQueue(snap, bank, "w", intents("w"), windows);
      const black = stageQueue(snap, bank, "b", intents("b"), windows);
      if (!white.ok || !black.ok) return false;
      const committed = commitPair(snap, bank, white.staged, black.staged);
      const expected = endScTurn(committed.snapshot, { skipTurnStartChecks: true });
      bank = grantStoredIncome(committed.bank, expected.next.turn);
      snap = expected.next;
      if (canonical(resolve) !== canonical(expected) ||
        evidence.scfens[index + 1] !== formatScFen(normalizeSnapGas(snap)) ||
        canonical(evidence.bankTrail[index]) !== canonical(bank)) return false;
      windows++;
      ready = false;
    }
    if (canonical(evidence.finalBank) !== canonical(bank)) return false;
    const actual = scOutcome(snap);
    return evidence.stop.kind === "terminal" ? actual !== null && canonical(actual) === canonical(evidence.outcome) : evidence.outcome === null;
  } catch { return false; }
};
