// SPEC: _spec/_plans/chess-ui-primitives.puml
import clsx from "clsx";
import { type JSX, splitProps } from "solid-js";

import chessStyles from "./Input.chess.module.css";
import starchessStyles from "./Input.starchess.module.css";
import { useUiStyles } from "../UiProvider";

export interface InputProps extends JSX.InputHTMLAttributes<HTMLInputElement> {}

export function Input(props: InputProps) {
  const styles = useUiStyles(chessStyles, starchessStyles);
  const [local, others] = splitProps(props, ["class"]);
  return <input class={clsx(styles["common-input"], local.class)} {...others} />;
}
