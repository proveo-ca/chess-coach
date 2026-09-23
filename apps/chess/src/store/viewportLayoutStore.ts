// SPEC: _spec/apps/chess/responsiveness/rules.md
import { createSignal } from "solid-js";

/**
 * Whether the Screen footer has been forced into floating mode because the
 * viewport cannot fit top + middle + footer without page scroll (§4).
 * Set by {@link CoachPanel} (advice) or {@link MoveList} (Review /:id).
 */
export const [footerFloat, setFooterFloat] = createSignal(false);
