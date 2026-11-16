// SPEC: _spec/_plans/chess-ui-primitives.puml
import { UiLink } from "../UiProvider";
import clsx from "clsx";
import { splitProps } from "solid-js";

import chessStyles from "./Button.chess.module.css";
import starchessStyles from "./Button.starchess.module.css";
import { useUiStyles } from "../UiProvider";
import type { ButtonProps } from "../types/ui";

export function Button(props: ButtonProps) {
  const styles = useUiStyles(chessStyles, starchessStyles);
  const [local, others] = splitProps(props, [
    "class",
    "primary",
    "variant",
    "href",
    "target",
    "rel",
    "children",
  ]);
  const cls = () =>
    clsx(
      styles["common-btn"],
      local.primary && styles["common-btn--primary"],
      local.variant === "neon" && styles["common-btn--neon"],
      local.variant === "neon" && local.primary && styles["common-btn--neon-primary"],
      local.class,
    );

  if (local.href != null) {
    const external = local.target != null || /^[a-z][a-z0-9+.-]*:/i.test(local.href);
    if (external) {
      return (
        <a class={cls()} href={local.href} target={local.target} rel={local.rel}>
          {local.children}
        </a>
      );
    }
    return (
      <UiLink class={cls()} href={local.href}>
        {local.children}
      </UiLink>
    );
  }

  return (
    <button class={cls()} {...others}>
      {local.children}
    </button>
  );
}
