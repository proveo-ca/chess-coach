// SPEC: _spec/apps/starchess/navigation-chrome.md, _spec/apps/starchess/architecture/reactivity/presentation.md
import {
  deployedMaterialFromPlacement,
  energyForTurn,
  incomeForTurn,
  MAX_DEPLOYED_MATERIAL,
  type ScFenSnapshot,
  type StarChessColor,
} from "@chess-coach/starchess-core";
/**
 * Resource chrome — minerals / vespene / supply.
 * Transparent shell + TEAM_PRIMARY border (piece team colors).
 * All values are createMemo'd from `snapshot` / MatchStore so DualNav turn +
 * gas spends update the strips as phases play.
 */
import { Show, createMemo, useContext, type Component } from "solid-js";

import {
  displayedStoredMaterial,
  estimateStoredFromSnap,
  gasRemainingFor,
  viewerColor,
} from "~/app/matchEconomy";
import { MatchStoreContext } from "~/app/MatchStoreContext";
import { clampPlayerName } from "~/utils/playerName";
import { readDisplayedSnapshot } from "~/app/selectors";
import { MineralsIcon, SupplyIcon, VespeneIcon } from "@chess-coach/ui-web/primitives/icons";
import { TeamFrame } from "@chess-coach/ui-web/primitives/TeamFrame";
import { TEAM_PRIMARY } from "~/presentation/pieces/teamColors";
import styles from "~/presentation/hud/components/ResourceBar.module.css";

export type ResourceBarProps = {
  /** Team whose economy is shown (also drives border). Defaults to viewer. */
  color?: StarChessColor;
  /**
   * Live board snap — gas / deployed / income / bank track this object.
   * Pass the DualNav / review display snap (not a stale copy).
   */
  snapshot?: ScFenSnapshot;
  /** Mineral bank override (live MatchStore). When omitted, estimated from snap. */
  stored?: number;
  /** MobileBanner density — tighter padding / type. */
  compact?: boolean;
  /**
   * Side's name, shown at the left of the bar. The frame already carries the
   * team colour, so the name replaces a separate "X (Blue) vs Y (Red)" title.
   */
  name?: string;
  class?: string;
};

export { estimateStoredFromSnap } from "~/app/matchEconomy";

export const ResourceBar: Component<ResourceBarProps> = (props) => {
  const ctx = useContext(MatchStoreContext);

  const color = createMemo((): StarChessColor => {
    if (props.color) return props.color;
    if (ctx) return viewerColor(ctx);
    return "w";
  });

  /** Prefer explicit snap; else MatchStore display (live / review). */
  const snap = createMemo((): ScFenSnapshot | null => {
    // Touch nested fields so DualNav setSnap({...gas, turn, placement}) retriggers.
    const s = props.snapshot;
    if (s) {
      void s.turn;
      void s.gas.w;
      void s.gas.b;
      void s.stored?.w;
      void s.stored?.b;
      void s.placement;
      void s.queue?.actions?.length;
      return s;
    }
    if (ctx) {
      const d = readDisplayedSnapshot(ctx);
      void d.turn;
      void d.gas.w;
      void d.gas.b;
      void d.stored?.w;
      void d.stored?.b;
      void d.placement;
      void d.queue?.actions?.length;
      return d;
    }
    return null;
  });

  /** DualNav intent specials reconstructed off-snap — same ghosts GasDeploy / board use. */
  const overlayActions = createMemo(() => {
    if (!ctx) return null;
    const actions = ctx.reviewIntentActions();
    void actions?.length;
    return actions;
  });

  const turn = createMemo(() => Math.max(1, snap()?.turn ?? 1));

  const stored = createMemo(() => {
    if (props.stored != null) return props.stored;
    const s = snap();
    if (ctx) return displayedStoredMaterial(ctx, color(), s);
    if (s?.stored?.[color()] != null) return s.stored![color()];
    if (s) return estimateStoredFromSnap(s, color());
    return 0;
  });

  const income = createMemo(() => incomeForTurn(turn()));
  const gasCap = createMemo(() => energyForTurn(turn()));

  /** Remaining after queued / intent ghost canisters — matches GasDeploy. */
  const gas = createMemo(() => {
    const s = snap();
    if (!s) return 0;
    return gasRemainingFor(s, color(), overlayActions());
  });

  const maxDeployed = createMemo(() => MAX_DEPLOYED_MATERIAL);

  const deployed = createMemo(() => {
    const s = snap();
    if (!s) return 0;
    try {
      return deployedMaterialFromPlacement(s.placement, color());
    } catch {
      return 0;
    }
  });

  const team = createMemo(() => TEAM_PRIMARY[color()]);

  return (
    <TeamFrame
      class={`${styles.bar}${props.compact ? ` ${styles.compact}` : ""}${props.class ? ` ${props.class}` : ""}`}
      teamColor={team()}
      data-testid="resource-bar"
      data-team={color()}
      data-turn={turn()}
      data-gas={gas()}
      role="group"
      aria-label={
        props.name
          ? `${props.name} resources`
          : `${color() === "w" ? "White" : "Black"} resources`
      }
    >
      <Show when={props.name}>
        {(name) => (
          <span class={styles.name} data-testid="resource-bar-name">
            {clampPlayerName(name())}
          </span>
        )}
      </Show>
      <div class={styles.strip} title="Stored minerals + income per turn">
        <span class={styles.icon} aria-hidden="true">
          <MineralsIcon />
        </span>
        <span class={styles.value}>
          {stored()}
          <span class={styles.income}>+{income()}</span>
        </span>
      </div>
      <div
        class={`${styles.strip} ${styles.gas}`}
        title="Vespene gas this turn (specials burn 1; does not accumulate)"
        aria-label={`Vespene ${gas()} of ${gasCap()}`}
      >
        <span class={styles.icon} aria-hidden="true">
          <VespeneIcon />
        </span>
        <span class={styles.value}>
          {gas()}
          <span class={styles.muted}>/{gasCap()}</span>
        </span>
      </div>
      <div class={styles.strip} title="Deployed army material / max">
        <span class={styles.icon} aria-hidden="true">
          <SupplyIcon />
        </span>
        <span class={styles.value}>
          {deployed()}
          <span class={styles.muted}>/{maxDeployed()}</span>
        </span>
      </div>
    </TeamFrame>
  );
};
