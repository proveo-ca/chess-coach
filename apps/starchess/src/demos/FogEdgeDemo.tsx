/**
 * Fog-edge DualNav — MatchStore review. Stories feed a scenario package only.
 * // SPEC: _spec/packages/starchess-core/resolve.puml, _spec/apps/starchess/demos.puml
 */
import type { Component } from "solid-js";

import { buildReviewHistory } from "~/app/reviewHistory";
import type { FogEdgeScenario } from "~/demos/fogEdgeScenario";
import { ReviewDemoScreen } from "~/demos/ReviewDemoScreen";

export type FogEdgeDemoProps = {
  /** Pre-built SCFEN DualNav package from `demos/*` — stories feed this only. */
  scenario: FogEdgeScenario;
};

export const FogEdgeDemo: Component<FogEdgeDemoProps> = (props) => {
  const s = props.scenario;
  const history = buildReviewHistory({
    start: s.plies[0]!,
    steps: s.steps,
    startCaption: s.startCaption,
    queueStep: s.queueStep,
  });

  return (
    <ReviewDemoScreen
      history={history}
      reviewLabel={s.reviewLabel ?? "Fog edge"}
      visionMode={s.visionMode ?? "observer"}
      fog={s.fog ?? (s.visionMode === "observer" ? false : true)}
      variant="eclipse"
      rookTank={s.rookTank}
    />
  );
};
