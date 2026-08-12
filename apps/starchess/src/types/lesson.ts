// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
/** Props for the sole live-lesson host (`demos/LiveLessonHost.tsx`). */
import type { JSX } from "solid-js";

import type { BoardSkin, BoardVariant, PieceSet } from "~/types/board";
import type { KerriganEmotion } from "~/types/coach";
import type { LiveLessonBoard, TutorialBoardHint } from "~/types/tutorial";

export type LiveLessonHostProps = {
  /** Seed + board chrome from the lesson catalog. */
  board: LiveLessonBoard;
  /** Publish into `tutorialNarrationStore` (tutorial lessons only). */
  narrate?: boolean;
  /** Tutorial chrome — HOME-only rail, no ExitGameConfirm. */
  tutorial?: boolean;
  /** Full `/single`-style top pane instead of the coach lesson header. */
  fullMatchHud?: boolean;
  matchTitle?: string;
  /** Player fog veil (fog lessons). */
  fog?: boolean;
  boardVariant?: BoardSkin;
  pieceSet?: PieceSet;
  hideResources?: boolean;
  hideGas?: boolean;
  turnChrome?: "bar" | "sidebar" | "none";
  /** Storybook override; otherwise the catalog decides. */
  armTimer?: boolean;
  onExitToMenu?: () => void;
  header?: JSX.Element;
  coachEmotion?: KerriganEmotion;
  guideBubble?: JSX.Element;
  footerExtra?: JSX.Element;
  /** Script-driven destination rings, resolved against the live SCFEN. */
  boardHints?: readonly TutorialBoardHint[];
  /** Wrap in a sky shell; omit when nested in one already. */
  shell?: BoardVariant;
  /** Storybook control — override the viewer's remaining vespene. */
  gas?: number;
};
