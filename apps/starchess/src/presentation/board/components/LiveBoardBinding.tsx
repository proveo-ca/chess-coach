// SPEC: _spec/apps/starchess/architecture/bridge-match-board-host.puml, _spec/apps/starchess/architecture/screen-entities.puml, _spec/apps/starchess/architecture/board-entities.puml
/**
 * Sole mount point for LiveStarChessBoard.
 */
import type { Component } from "solid-js";
import type { Square } from "chess.js";

import { LiveStarChessBoard } from "~/presentation/board/components/LiveStarChessBoard";
import type { BoardSkin, PieceSet, VisionMode } from "~/types/board";
import type { TutorialBoardArrow } from "~/types/tutorial";

export type LiveBoardBindingProps = {
  fog?: boolean;
  visionMode?: VisionMode;
  variant?: BoardSkin;
  pieceSet?: PieceSet;
  hintSquares?: readonly Square[];
  hintAlertSquares?: readonly Square[];
  hintGasSquares?: readonly Square[];
  hintArrows?: readonly TutorialBoardArrow[];
};

export const LiveBoardBinding: Component<LiveBoardBindingProps> = (props) => (
  <LiveStarChessBoard
    fog={props.fog}
    visionMode={props.visionMode}
    variant={props.variant}
    pieceSet={props.pieceSet}
    hintSquares={props.hintSquares}
    hintAlertSquares={props.hintAlertSquares}
    hintGasSquares={props.hintGasSquares}
    hintArrows={props.hintArrows}
  />
);
