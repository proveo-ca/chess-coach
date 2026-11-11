import type { JSX } from "solid-js";

export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  primary?: boolean;

  variant?: "default" | "neon";

  href?: string;

  target?: string;

  rel?: string;
}

export type ChipTone =
  | "default"
  | "before"
  | "classical"
  | "after"
  | "muted"
  | "turn"
  | "check"
  | "intent"
  | "resolve";

export type ChipSize = "md" | "sm";

export type ModalPosition = "fixed" | "absolute";
