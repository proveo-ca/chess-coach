// SPEC: _spec/packages/training/burn-compat.puml
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

const root = process.env.CHESS_COACH_TEST_ROOT;
const { composeCandidatesFromObservationV1 } = await import(pathToFileURL(`${root}/packages/starchess-training/src/candidates.ts`).href);
const { composeWithRuntime } = await import(pathToFileURL(`${root}/packages/starchess-training/src/composition.ts`).href);

for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
  try {
    const { view } = JSON.parse(line);
    const observation = {
      version: "challenge-observation-v1", side: view.side, turn: view.turn,
      own: { ...view.own, pieces: view.own.pieces.map(({ square, type }) => ({ square, piece: { color: view.side, type } })) },
      cells: view.cells,
      memory: view.cells.flatMap(cell => cell.visibility !== "unknown" && cell.piece && cell.piece.color !== view.side
        ? [{ square: cell.square, piece: cell.piece, observedTurn: view.turn }] : []),
    };
    const batch = composeCandidatesFromObservationV1(observation);
    const measured = composeWithRuntime(observation);
    if (JSON.stringify(measured.batch) !== JSON.stringify(batch)) throw new Error("Public/runtime legacy batch mismatch");
    process.stdout.write(`${JSON.stringify({ ok: true, batch, runtime: measured.runtime })}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ ok: false, error: String(error) })}\n`);
  }
}
