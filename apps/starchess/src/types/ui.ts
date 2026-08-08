import type { JSX } from "solid-js";

/** Shared props for the Button primitive and its variants (e.g. IconButton). */
export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Filled primary-color background. */
  primary?: boolean;
  /** Visual skin — neon = Brood War menu chrome (Start / Stay / Leave). */
  variant?: "default" | "neon";
  /** When set, renders a link instead of a `<button>` (router `<A>` for internal paths, native `<a>` for external/`target` links). */
  href?: string;
  /** Anchor target (e.g. `_blank`); its presence also forces a native `<a>`. */
  target?: string;
  /** Anchor rel (e.g. `noreferrer`). */
  rel?: string;
}

/** Chip tone variants — queue timing, turn/phase chrome, muted empty slot. */
export type ChipTone =
  | "default"
  | "before"
  | "classical"
  | "after"
  | "muted"
  /** Turn number — solid black / white. */
  | "turn"
  /** Review / live phase: check. */
  | "check"
  /** Review / live phase: intent. */
  | "intent"
  /** Review / live phase: resolve. */
  | "resolve";

/** Chip size variants. */
export type ChipSize = "md" | "sm";

/** Modal positioning — page-fixed vs parent-absolute. */
export type ModalPosition = "fixed" | "absolute";
