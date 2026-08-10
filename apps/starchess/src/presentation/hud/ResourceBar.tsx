import {
  deployedMaterialFromPlacement,
  energyForTurn,
  incomeForTurn,
  MAX_DEPLOYED_MATERIAL,
  MAX_STORED_MATERIAL,
  placementToMap,
  type ScFenSnapshot,
  type StarChessColor,
} from "@chess-coach/starchess-core";
/**
 * Resource chrome — minerals / vespene / supply.
 * Transparent shell + TEAM_PRIMARY border (piece team colors).
 * All values are createMemo'd from `snapshot` / MatchStore so DualNav turn +
 * gas spends update the strips as phases play.
 */
import { createMemo, useContext, type Component } from "solid-js";

import { viewerColor, gasRemainingFor } from "~/app/matchEconomy";
import { MatchStoreContext } from "~/app/MatchStoreContext";
import { displayedSnapshot } from "~/app/selectors";
import { MineralsIcon, SupplyIcon, VespeneIcon } from "~/components/primitives/icons";
import { TeamFrame } from "~/components/primitives/TeamFrame";
import { TEAM_PRIMARY } from "~/presentation/animations/teamColors";
import styles from "~/presentation/hud/ResourceBar.module.css";

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
  class?: string;
};

/**
 * Opening bank 1 + income granted on each turn advance (matches grantIncome).
 * Turn 0 seed → 1; after first End (turn 1) → 1+income(1); etc.
 */
export const estimateStoredFromSnap = (snap: ScFenSnapshot, color: StarChessColor): number => {
  let stored = 1;
  const turn = Math.max(0, snap.turn);
  for (let t = 1; t <= turn; t += 1) {
    stored += incomeForTurn(t);
  }
  let units = 0;
  try {
    for (const piece of placementToMap(snap.placement).values()) {
      if (piece.color === color) units += 1;
    }
  } catch {
    units = 0;
  }
  return Math.min(MAX_STORED_MATERIAL, Math.max(0, stored - Math.max(0, units - 1)));
};

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
      const d = displayedSnapshot(ctx.state());
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
    // SCFEN `B:` bank — authoritative when present (live stamp + review history).
    const bank = s?.stored?.[color()];
    if (bank != null) return bank;
    if (ctx && !props.snapshot) {
      void ctx.state().economies[color()].stored;
      return ctx.state().economies[color()].stored;
    }
    // Legacy snaps without `B:` — rough estimate only.
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
      aria-label={`${color() === "w" ? "White" : "Black"} resources`}
    >
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
        class={styles.strip}
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
