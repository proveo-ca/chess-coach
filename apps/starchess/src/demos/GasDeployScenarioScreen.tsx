/**
 * MatchStore + StarChessScreen seed for GasDeploy special stories.
 * Stories pass SCFEN fixtures only — no queue / arm logic here.
 * // SPEC: _spec/apps/starchess/demos.puml
 */
import { formatScFen } from "@chess-coach/starchess-core";
import {
  createEffect,
  onCleanup,
  onMount,
  untrack,
  type Component,
} from "solid-js";

import {
  createMatchStore,
  MatchStoreProvider,
  useMatchStore,
} from "~/app/MatchStoreContext";
import { createMatchStateFromScfen } from "~/app/matchReducer";
import { displayedSnapshot } from "~/app/selectors";
import type { MatchState } from "~/types/match";
import { StarChessScreen } from "~/app/StarChessScreen";
import { liveMatchPhase } from "~/presentation/hud/liveMatchPhase";
import {
  resetTutorialNarration,
  setTutorialNarration,
} from "~/tutorial/tutorialNarrationStore";
import type { KerriganEmotion } from "~/types/coach";

export type GasDeployScenarioScreenProps = {
  scfen: string;
  stored?: number;
  /** Override viewer gas remaining (Storybook Turn Chrome control). */
  gas?: number;
  /** Skip planning timer so Storybook controls stay quiet. */
  armTimer?: boolean;
  onExitToMenu?: () => void;
  tutorial?: boolean;
  hideResources?: boolean;
  header?: import("solid-js").JSX.Element;
  coachEmotion?: KerriganEmotion;
  guideBubble?: import("solid-js").JSX.Element;
  footerExtra?: import("solid-js").JSX.Element;
  turnChrome?: "bar" | "sidebar" | "none";
  /** Tutorial-only auto-End threshold (omit in Storybook / live demos). */
  endTurnAfterQueue?: "first" | "moveAndSpecial";
};

const withViewerGas = (state: MatchState, gas: number | undefined): MatchState => {
  if (gas == null) return state;
  const g = Math.min(3, Math.max(0, Math.floor(gas)));
  const color = state.viewer;
  return {
    ...state,
    liveSnapshot: {
      ...state.liveSnapshot,
      gas: { ...state.liveSnapshot.gas, [color]: g },
    },
  };
};

const GasDeployInner: Component<GasDeployScenarioScreenProps> = (props) => {
  const store = useMatchStore();

  createEffect(() => {
    if (!props.tutorial) return;
    const s = store.state();
    const snap = displayedSnapshot(s);
    setTutorialNarration({
      reviewPhase: liveMatchPhase({
        phase: s.phase,
        lastResolve: s.lastResolve,
        timelineActive: s.timeline.active,
        pendingPromotion: !!s.pendingPromotion,
      }),
      timelineActive: s.timeline.active,
      scfen: formatScFen(snap),
    });
  });

  onMount(() => {
    onCleanup(() => {
      if (props.tutorial) resetTutorialNarration();
    });
  });

  return (
    <StarChessScreen
      boardVariant="eclipse"
      starChessMode
      armTimer={props.armTimer === true}
      turnChrome={props.turnChrome}
      onExitToMenu={props.onExitToMenu}
      tutorial={props.tutorial}
      hideResources={props.hideResources}
      header={props.header}
      coachEmotion={props.coachEmotion}
      guideBubble={props.guideBubble}
      footerExtra={props.footerExtra}
      endTurnAfterQueue={props.endTurnAfterQueue}
    />
  );
};

export const GasDeployScenarioScreen: Component<GasDeployScenarioScreenProps> = (
  props,
) => {
  const store = createMatchStore({
    initial: withViewerGas(
      createMatchStateFromScfen(props.scfen, props.stored ?? 12),
      props.gas,
    ),
    autoArmTimer: props.armTimer === true,
  });

  // Sync only when the Storybook control changes — do not wipe queue spends
  // (ghost canisters) by re-applying the control on every store update.
  createEffect(() => {
    const g = props.gas;
    if (g == null) return;
    const next = Math.min(3, Math.max(0, Math.floor(g)));
    untrack(() => {
      const s = store.state();
      const color = s.viewer;
      if ((s.liveSnapshot.gas[color] ?? 0) === next) return;
      store.dispatch({
        type: "APPLY_SNAPSHOT",
        snapshot: {
          ...s.liveSnapshot,
          gas: { ...s.liveSnapshot.gas, [color]: next },
        },
      });
    });
  });

  return (
    <MatchStoreProvider store={store}>
      <GasDeployInner {...props} />
    </MatchStoreProvider>
  );
};
