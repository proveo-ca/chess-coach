import {
  ChessMobileBanner,
  type ChessMobileBannerProps,
} from "@chess-coach/ui-web/atoms/ChessMobileBanner";
// SPEC: _spec/_plans/chess-ui-primitives.puml
import { useNavigate } from "@solidjs/router";

import { screenBackTarget } from "~/utils/navHistory";
export type { ChessMobileBannerProps as MobileBannerProps } from "@chess-coach/ui-web/atoms/ChessMobileBanner";

export function MobileBanner(props: ChessMobileBannerProps) {
  const navigate = useNavigate();
  const goBack = () => {
    if (props.onBack) return props.onBack();
    const target = screenBackTarget();
    if (typeof target === "number") navigate(target);
    else navigate(target);
  };
  return <ChessMobileBanner {...props} onBack={goBack} />;
}
