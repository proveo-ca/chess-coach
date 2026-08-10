// SPEC: _spec/apps/starchess/architecture/p3-bridge-match-board-host.puml, _spec/apps/starchess/architecture/screen-entities.puml
/**
 * Sole mount point for LiveStarChessBoard (P3 implementor).
 */
import type { Component } from "solid-js";
import type { Square } from "chess.js";

import { LiveStarChessBoard } from "~/presentation/board/LiveStarChessBoard";
import type { BoardSkin, PieceSet, VisionMode } from "~/types/board";

export type LiveBoardBindingProps = {
  fog?: boolean;
  visionMode?: VisionMode;
  variant?: BoardSkin;
  pieceSet?: PieceSet;
  hintSquares?: readonly Square[];
};

export const LiveBoardBinding: Component<LiveBoardBindingProps> = (props) => (
  <LiveStarChessBoard
    fog={props.fog}
    visionMode={props.visionMode}
    variant={props.variant}
    pieceSet={props.pieceSet}
    hintSquares={props.hintSquares}
  />
);
