import clsx from "clsx";
import { Show, createSignal } from "solid-js";
import type { Component, JSX } from "solid-js";

import styles from "~/components/atoms/FenLoader.module.css";
import { Button } from "~/components/primitives/Button";
import { Input } from "~/components/primitives/Input";
import { loadFen } from "~/store/gameStore";

const FEN_REGEX =
  /^([rnbqkpRNBQKP1-8]+\/){7}[rnbqkpRNBQKP1-8]+ [wb] (-|[KQkq]+) (-|[a-h][36]) \d+ \d+$/;

export const FenLoader: Component<{
  /** Prefixed control (e.g. Analysis short/dynamic menu left of the input). */
  leading?: JSX.Element;
  trailing?: JSX.Element;
}> = (props) => {
  const [value, setValue] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);

  const submit = () => {
    const fen = value().trim();
    if (!fen) {
      setError("Please enter a FEN string.");
      return;
    }
    if (!FEN_REGEX.test(fen)) {
      setError("Invalid FEN format.");
      return;
    }
    try {
      loadFen(fen);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid FEN.");
    }
  };

  return (
    <>
      <form
        class={`${styles.wrapper} mobile-nav-clear`}
        data-testid="fen-loader"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Show when={props.leading}>
          <div class={styles.leading} data-testid="fen-loader-leading">
            {props.leading}
          </div>
        </Show>
        <Input
          type="text"
          name="fen"
          class={clsx(styles.input, error() && styles["input--invalid"])}
          placeholder="paste FEN here"
          aria-label="Load from FEN"
          value={value()}
          onInput={(e) => setValue(e.currentTarget.value)}
        />
        <Button type="submit" class={styles.button}>
          Load
        </Button>
        <Show when={props.trailing}>
          <div class={styles.trailing} data-testid="fen-loader-trailing">
            {props.trailing}
          </div>
        </Show>
      </form>
      <Show when={error()}>
        {(msg) => (
          <div class={styles.error} role="alert">
            {msg()}
          </div>
        )}
      </Show>
    </>
  );
};
