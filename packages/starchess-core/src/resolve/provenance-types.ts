// SPEC: _spec/packages/starchess-core/resolve.puml, _spec/packages/starchess-core/resolve-turn-activity.puml, _spec/packages/starchess-core/submit-turn-activity.puml
import type { Square } from "chess.js";
import type { StarChessColor, StarChessPiece, TankMode } from "../model/types";

export type UnitId = `engine:unit:${number}`;
export type MineId = `engine:mine:${number}`;
export type UnitEngineEntity = Readonly<{
  id: UnitId; kind: "unit"; side: StarChessColor; type: StarChessPiece;
  square: Square; tankMode: TankMode | null;
}>;
export type MineEngineEntity = Readonly<{
  id: MineId; kind: "mine"; side: StarChessColor; square: Square;
}>;
export type EngineEntity = UnitEngineEntity | MineEngineEntity;
export type FramePhase = "turn-open" | "B" | "C-attack" | "C-move" | "C-path-reveal" | "C-promotion" | "F";
export type FrameImage = Readonly<{
  entities: readonly EngineEntity[];
  ccLives: Readonly<Record<StarChessColor, number>>;
  nativeMineOrder: readonly MineId[];
}>;
type Source = { readonly sourceActionSeq: number | null };
export type Effect = Source & (
  | { readonly kind: "unit-create"; readonly entity: UnitEngineEntity }
  | { readonly kind: "unit-move"; readonly entityId: UnitId; readonly from: Square; readonly to: Square }
  | { readonly kind: "unit-transform"; readonly entityId: UnitId; readonly fromType: StarChessPiece; readonly toType: StarChessPiece }
  | { readonly kind: "unit-destroy"; readonly entity: UnitEngineEntity; readonly causalBeforeVisibilityKey: string }
  | { readonly kind: "tank-mode-change"; readonly entityId: UnitId; readonly before: TankMode; readonly after: TankMode }
  | { readonly kind: "mine-create"; readonly entity: MineEngineEntity }
  | { readonly kind: "mine-remove"; readonly entityId: MineId }
  | { readonly kind: "cc-lives-change"; readonly side: StarChessColor; readonly before: number; readonly after: number }
  | { readonly kind: "deployment-disposition"; readonly materializedEntityId: UnitId | null }
);
export type TrustedEffectFrame = Readonly<{
  sourceEffectKey: string; phase: FramePhase; before: FrameImage; after: FrameImage;
  effects: readonly Effect[]; beforeVisibilityKey: string; afterVisibilityKey: string;
}>;
export type VisibilityImage = Readonly<{
  key: string; ordinal: number; turn: number; phase: FramePhase; state: FrameImage;
}>;
export type VisibilityCheckpoint = Readonly<{
  ordinal: number; imageKey: string; frameKey: string | null;
  point: "before-frame" | "after-frame" | "path-visibility";
}>;
export type ActionBinding = Readonly<{
  sourceActionSeq: number; side: StarChessColor;
  actionRef: Readonly<{ planningOrdinal: number; acceptedActionOrdinal: number }>;
}>;
export type ActionBindings = readonly ActionBinding[];
export type ResolvedActionBinding = ActionBinding & { readonly effectiveActorId: UnitId | null };
export type CapturedVisionInputs = Readonly<{
  modeSource: "default-tank" | "native-sieged-set"; siegeMaskHex: string;
  mineSource: "absent" | "provided";
  mines: readonly Readonly<{ color: StarChessColor; at: Square }>[];
}>;
export type PathQueryRecord = Readonly<{
  sourceActionSeq: number; site: "scan-ray" | "reveal-to"; base: FrameImage;
  from: Square; to: Square; side: StarChessColor; target: Square;
  visionInputs: CapturedVisionInputs;
  evaluatedSteps: readonly Readonly<{ mid: Square; visible: boolean }>[];
  returnedStep: number | null;
  consumption: "not-deferred" | "deferred-skipped" | "applied-consumed";
}>;
export type ConsumedTargetProof = Readonly<{
  queryOrdinal: number; sourceActionSeq: number; side: StarChessColor;
  operation: "capture" | "cc-shot"; frameKey: string; causalBeforeVisibilityKey: string;
  evaluationActorId: UnitId; evaluationTargetId: UnitId;
  appliedActorId: UnitId; appliedTargetId: UnitId; turn: number;
  targetCell: Readonly<{ square: Square; visibility: "lit"; piece: Readonly<{ type: StarChessPiece; color: StarChessColor }> }>;
}>;
export type EngineProvenance = Readonly<{
  version: "engine-provenance-v1"; initialTurn: number; turn: number;
  stage: "before-begin" | "after-begin" | "terminal"; callOrdinal: number;
  unitCounter: number; mineCounter: number; entities: readonly EngineEntity[];
  ccLives: Readonly<Record<StarChessColor, number>>; nativeMineOrder: readonly MineId[];
  resolvedActions: readonly ResolvedActionBinding[];
  lastCall: Readonly<{ queries: readonly PathQueryRecord[]; consumedFacts: readonly ConsumedTargetProof[] }>;
}>;
export type ProvenanceCompanion<R> = Readonly<{
  nativeResult: R; provenance: EngineProvenance; frames: readonly TrustedEffectFrame[];
  visibilityImages: readonly VisibilityImage[];
  visibilityCheckpoints: readonly VisibilityCheckpoint[];
}>;
