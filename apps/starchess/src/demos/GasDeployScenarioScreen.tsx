/**
 * MatchStore + StarChessScreen seed for GasDeploy special stories.
 * Stories pass SCFEN fixtures only — no queue / arm logic here.
 * // SPEC: _spec/apps/ui/starchess/demos.puml
 */
import { createEffect, type Component } from "solid-js";

import {
  createMatchStore,
  MatchStoreProvider,
} from "~/app/MatchStoreContext";
import { createMatchStateFromScfen } from "~/app/matchReducer";
import type { MatchState } from "~/types/match";
import { StarChessScreen } from "~/app/StarChessScreen";

export type GasDeployScenarioScreenProps = {
  scfen: string;
  stored?: number;
  /** Override viewer gas remaining (Storybook Turn Chrome control). */
  gas?: number;
  /** Skip planning timer so Storybook controls stay quiet. */
  armTimer?: boolean;
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

  createEffect(() => {
    const g = props.gas;
    if (g == null) return;
    const next = Math.min(3, Math.max(0, Math.floor(g)));
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

  return (
    <MatchStoreProvider store={store}>
      <StarChessScreen
        boardVariant="eclipse"
        starChessMode
        armTimer={props.armTimer === true}
      />
    </MatchStoreProvider>
  );
};
