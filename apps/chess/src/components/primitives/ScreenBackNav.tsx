import {
  ScreenBackNav as BackNav,
  type ScreenBackNavProps,
} from "@chess-coach/ui-web/primitives/ScreenBackNav";
// SPEC: _spec/_plans/chess-ui-primitives.puml
import { useNavigate } from "@solidjs/router";

import { screenBackTarget } from "~/utils/navHistory";
export type { ScreenBackNavProps } from "@chess-coach/ui-web/primitives/ScreenBackNav";

export function ScreenBackNav(props: ScreenBackNavProps) {
  const navigate = useNavigate();
  const goBack = () => {
    if (props.onBack) return props.onBack();
    const target = screenBackTarget();
    if (typeof target === "number") navigate(target);
    else navigate(target);
  };
  return <BackNav {...props} onBack={goBack} />;
}
