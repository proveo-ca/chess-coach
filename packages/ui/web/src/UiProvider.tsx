// SPEC: _spec/_plans/chess-ui-primitives.puml
import { createContext, useContext, type Component, type JSX, type ParentProps } from "solid-js";
import { Dynamic } from "solid-js/web";

export type UiProduct = "chess" | "starchess";
export type UiLinkProps = JSX.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };
export interface UiConfig {
  product: UiProduct;
  Link?: Component<UiLinkProps>;
}
const UiContext = createContext<UiConfig>({ product: "chess" });

export function UiProvider(props: ParentProps<UiConfig>) {
  return <UiContext.Provider value={props}>{props.children}</UiContext.Provider>;
}

export function useUi() {
  return useContext(UiContext);
}

export function useUiStyles(chess: Record<string, string>, starchess: Record<string, string>) {
  const ui = useUi();
  return new Proxy(chess, {
    get: (_, key: string) => (ui.product === "starchess" ? starchess : chess)[key],
  });
}

export function UiLink(props: UiLinkProps) {
  const ui = useUi();
  return <Dynamic component={ui.Link ?? "a"} {...props} />;
}
