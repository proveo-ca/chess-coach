// SPEC: _spec/_plans/chess-ui-primitives.puml, _spec/apps/starchess/navigation-chrome.md
import clsx from "clsx";
import { For, type JSX } from "solid-js";

import styles from "./Breadcrumb.module.css";

export type BreadcrumbItem<T extends string = string> = {
  id: T;
  label: string;
};

export type BreadcrumbProps<T extends string = string> = {
  items: readonly BreadcrumbItem<T>[];
  current: T;
  onSelect?: (id: T) => void;
  class?: string;
  "aria-label"?: string;
  "data-testid"?: string;
};

export function Breadcrumb<T extends string = string>(props: BreadcrumbProps<T>): JSX.Element {
  const currentIndex = () =>
    Math.max(
      0,
      props.items.findIndex((item) => item.id === props.current),
    );

  return (
    <nav
      class={clsx(styles.root, props.class)}
      aria-label={props["aria-label"] ?? "Breadcrumb"}
      data-testid={props["data-testid"] ?? "breadcrumb"}
    >
      <ol class={styles.list}>
        <For each={props.items}>
          {(item, index) => {
            const active = () => item.id === props.current;
            const done = () => index() < currentIndex();
            return (
              <li
                class={styles.item}
                classList={{
                  [styles.active]: active(),
                  [styles.done]: done(),
                }}
              >
                <ShowSep when={index() > 0} />
                <button
                  type="button"
                  class={styles.crumb}
                  aria-current={active() ? "step" : undefined}
                  data-id={item.id}
                  onClick={() => props.onSelect?.(item.id)}
                >
                  <span class={styles.index} aria-hidden="true">
                    {index() + 1}
                  </span>
                  <span class={styles.label}>{item.label}</span>
                </button>
              </li>
            );
          }}
        </For>
      </ol>
    </nav>
  );
}

const ShowSep = (props: { when: boolean }) =>
  props.when ? (
    <span class={styles.sep} aria-hidden="true">
      {">"}
    </span>
  ) : null;
