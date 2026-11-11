import type { EvalResult } from "~/types/analysis";

type StorybookEvalRequest = {
  signal?: AbortSignal;
  onInfo?: (info: {
    depth?: number;
    score?: { kind: "cp" | "mate"; value: number };
    pv?: string[];
  }) => void;
};

export const enginePool = {
  async evaluate(request: StorybookEvalRequest): Promise<EvalResult> {
    if (request.signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const result: EvalResult = {
      bestMove: "e2e4",
      score: { kind: "cp", value: 24 },
      depth: 20,
    };
    request.onInfo?.({
      depth: result.depth,
      score: result.score ?? undefined,
      pv: result.bestMove ? [result.bestMove] : [],
    });
    return result;
  },
};
