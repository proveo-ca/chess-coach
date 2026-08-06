import type { Component } from "solid-js";
import { For, Show } from "solid-js";

import { useMatchStore } from "~/app/MatchStoreContext";
import { canSubmit, outcomeLabel } from "~/app/selectors";
import styles from "~/presentation/hud/MatchHud.module.css";

export const MatchHud: Component = () => {
  const store = useMatchStore();
  const snap = () => store.state().liveSnapshot;
  const eco = () => store.state().economies;

  return (
    <header class={styles.hud}>
      <div class={styles.brand}>StarChess</div>
      <div class={styles.meta}>
        <span>Turn {snap().turn}</span>
        <span>
          ♔ {snap().kingLives.w} · ♚ {snap().kingLives.b}
        </span>
        <span>
          Gas {snap().gas.w}/{snap().gasIncome.w} · {snap().gas.b}/{snap().gasIncome.b}
        </span>
        <span>
          Minerals {eco().w.stored}/{eco().b.stored}
        </span>
      </div>
      <p class={styles.status}>{store.state().statusText}</p>
      <Show when={outcomeLabel(store.state())}>
        {(label) => <p class={styles.outcome}>{label()}</p>}
      </Show>
      <div class={styles.queue}>
        <For each={snap().queue?.actions ?? []}>
          {(a) => (
            <button
              type="button"
              class={styles.chip}
              disabled={!canSubmit(store.state())}
              onClick={() => store.dispatch({ type: "REMOVE_ACTION", seq: a.seq })}
            >
              {a.color}:{a.timing}
              {a.timing === "C" ? ` ${a.from}${a.to}` : ` ${a.kind}`}
            </button>
          )}
        </For>
      </div>
      <div class={styles.actions}>
        <button
          type="button"
          class={styles.end}
          disabled={!canSubmit(store.state())}
          onClick={() => store.submitTurn("end")}
        >
          End turn
        </button>
        <button
          type="button"
          class={styles.secondary}
          disabled={store.state().phase === "resolving"}
          onClick={() =>
            store.dispatch({
              type: "SET_VIEWER",
              viewer: store.state().viewer === "w" ? "b" : "w",
            })
          }
        >
          Flip ({store.state().viewer})
        </button>
      </div>
    </header>
  );
};
