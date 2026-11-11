import {
  ScreenBackNav as BackNav,
  type ScreenBackNavProps,
} from "@chess-coach/ui-web/primitives/ScreenBackNav";
// SPEC: _spec/_plans/chess-ui-primitives.puml
import { useNavigate } from "@solidjs/router";
export type { ScreenBackNavProps } from "@chess-coach/ui-web/primitives/ScreenBackNav";

export function ScreenBackNav(props: ScreenBackNavProps) {
  const navigate = useNavigate();
  const goBack = () => {
    if (props.onBack) return props.onBack();
    navigate(props.href ?? "/");
  };
  return <BackNav {...props} onBack={props.href != null && !props.onBack ? undefined : goBack} />;
}
