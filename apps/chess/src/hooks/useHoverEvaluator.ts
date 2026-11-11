// SPEC: _spec/apps/chess/components.puml
import { Chess, type Square } from "chess.js";
import { createEffect } from "solid-js";

import { capabilities } from "~/store/capabilitiesStore";
import {
  setHoverAdvice,
  setHoverBlunder,
  setHoverEmotion,
  setPendingTravel,
} from "~/store/coachStore";
import { currentFen } from "~/store/gameStore";
import {
  exitsMatingNet,
  MATING_NET_EXIT_CP,
  pickMatingNetExitAdvice,
} from "~/engine/matingNetExitAdvice";
import { blunderLabel, blunderThresholdCp } from "~/store/settingsStore";
import type { StockfishAnalysis } from "~/types/Stockfish";
import { logger } from "~/utils/logger";

export type HoverEval = { id: number; from: Square; to: Square; fen: string };

function scoreToHumanCp(
  s: { kind: "cp" | "mate"; value: number },
  scoreSideIsHuman: boolean,
): number {
  if (s.kind === "cp") return scoreSideIsHuman ? s.value : -s.value;
  const dist = Math.abs(s.value);
  const mag = 100000 - dist * 100; // preserve mate distance (M1 >> M10)
  const signed = (s.value > 0 ? 1 : -1) * mag;
  return scoreSideIsHuman ? signed : -signed;
}

/** True when the side to move has a legal mate-in-1. */
function hasMateInOne(fen: string): boolean {
  try {
    const legal = new Chess(fen);
    for (const m of legal.moves({ verbose: true })) {
      const probe = new Chess(fen);
      const played = probe.move({
        from: m.from,
        to: m.to,
        ...(m.promotion ? { promotion: m.promotion } : {}),
      });
      if (played && probe.isCheckmate()) return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

interface UseHoverEvaluatorProps {
  canApplyHoverOverride: () => boolean;
  hoveredSquare: () => Square | null;
  selectedSquare: () => Square | null;
  currentHoverEval: () => HoverEval | null;
  analysis: () => StockfishAnalysis;
  baseEvalScore: () => { kind: "cp" | "mate"; value: number } | null;
  humanBestMove: () => string | null;
  game: () => Chess;
}

export function useHoverEvaluator(props: UseHoverEvaluatorProps) {
  let lastProcessedEvalId = -1;

  createEffect(() => {
    // Screens without blunder detection (Solo Analysis) skip the coach
    // reaction and travel trigger entirely.
    if (!capabilities().blunderDetection) return;
    if (!props.canApplyHoverOverride()) return;

    const hovered = props.hoveredSquare();
    const selected = props.selectedSquare();
    if (!hovered || !selected) return;

    const evalTarget = props.currentHoverEval();
    if (!evalTarget) return;
    if (evalTarget.to !== hovered || evalTarget.from !== selected) return;

    const msg = props.analysis().lastInfo;
    if (!msg || !msg.score) return;

    // Skip if we already processed this eval's result
    if (evalTarget.id <= lastProcessedEvalId) return;

    // When a PV is present, prefer discarding clearly-stale PVs. Lite WASM
    // often attaches an outdated pv[0] while the score is already for the
    // hover fen — treat those as score-only rather than dropping the eval.
    if (msg.pv && msg.pv.length > 0) {
      try {
        const testGame = new Chess(evalTarget.fen);
        const uci = msg.pv[0];
        const from = uci.slice(0, 2);
        const to = uci.slice(2, 4);
        const promotion = uci.length > 4 ? uci[4] : undefined;
        const move = testGame.move({ from, to, promotion });
        if (!move) {
          // Stale PV — continue with score-only classification below.
        }
      } catch {
        // Invalid PV format — continue score-only.
      }
    }

    const baseScore = props.baseEvalScore();

    // Prefer engine mate scores; fall back to a local mate-in-1 scan when
    // Stockfish is still publishing shallow cp for a forced mate position.
    let exitsNet = baseScore ? exitsMatingNet(baseScore, msg.score) : false;
    if (!exitsNet && hasMateInOne(currentFen())) exitsNet = true;

    // Without a base score we can only classify mating-net exits.
    if (!baseScore && !exitsNet) return;

    const humanBaseCp = baseScore ? scoreToHumanCp(baseScore, true) : 0;
    const humanHoverCp = scoreToHumanCp(msg.score, false);
    const delta = humanHoverCp - humanBaseCp;
    const isBlunder = exitsNet || (baseScore != null && delta <= blunderThresholdCp());

    logger.action(`Hover Eval Result [${evalTarget.from}-${evalTarget.to}]`, {
      baseScore,
      hoverScore: msg.score,
      delta: exitsNet ? MATING_NET_EXIT_CP : delta,
      exitsMatingNet: exitsNet,
      isBlunder,
    });

    if (!isBlunder) return;

    // Don't flag the move when it IS the engine's best move: if even the best
    // available move crosses the loss threshold, the position is already
    // lost/forced and there's nothing better to point the player toward.
    const bestUci = props.humanBestMove();
    if (bestUci && bestUci.slice(0, 4) === `${evalTarget.from}${evalTarget.to}`) return;

    logger.action("Stockfish Hover Blunder Detected", { msg, evalTarget, exitsMatingNet: exitsNet });

    const piece = props.game().get(evalTarget.from);
    const pieceName = piece ? `${piece.color}${piece.type}` : "piece";

    // Generate SAN for the blunder
    const gCopy = new Chess(currentFen());
    const m = gCopy.move({ from: evalTarget.from, to: evalTarget.to, promotion: "q" });
    const san = m ? m.san : `${evalTarget.from}-${evalTarget.to}`;

    lastProcessedEvalId = evalTarget.id;
    const blunderAdvice = exitsNet
      ? pickMatingNetExitAdvice()
      : `Moving the ${pieceName} to ${evalTarget.to} is ${blunderLabel()}`;
    setHoverAdvice(blunderAdvice);
    setHoverEmotion("shocked");
    setHoverBlunder(true, evalTarget.fen, san);
    setPendingTravel({
      blunderFen: evalTarget.fen,
      blunderSan: san,
      fenBefore: currentFen(),
      advice: blunderAdvice,
    });
  });
}
