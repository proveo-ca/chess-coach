// SPEC: _spec/causal-journal.puml
import type { ScMine, ScPiece, Square, StarChessColor, TankMode } from "./types";
import type { MineContact } from "./mine-contact";
import type { PathQueryTap } from "./vision";

export type EngineUnitId = `engine:unit:${number}`;
export type EngineMineId = `engine:mine:${number}`;
export type CausalUnit = { kind: "unit"; id: EngineUnitId; side: StarChessColor; type: ScPiece["type"]; square: Square; tankMode: TankMode | null };
export type CausalMine = { kind: "mine"; id: EngineMineId; side: StarChessColor; square: Square };
export type CausalImage = { entities: readonly (CausalUnit | CausalMine)[]; ccLives: Record<StarChessColor, number>; mineOrder: readonly EngineMineId[] };
export type CausalState = CausalImage & { version: "chess-coach.causal-state.v1"; turn: number; callOrdinal: number;
  unitCounter: number; mineCounter: number; nativeSiegedSquares: readonly Square[] };
export type CausalPhase = "turn-open" | "B" | "C-attack" | "C-move" | "C-path" | "C-promotion" | "F";
export type CausalCell = { square: Square; visibility: "unknown" }
  | { square: Square; visibility: "lit"; piece: ScPiece | null }
  | { square: Square; visibility: "revealed"; piece: ScPiece };
export type TargetObservation = { discoveryOrdinal: number; recipient: StarChessColor; square: Square; piece: ScPiece;
  evaluationActorId: EngineUnitId; evaluationTargetId: EngineUnitId; appliedActorId: EngineUnitId; appliedTargetId: EngineUnitId };
export type CausalEffectPayload =
  | { kind: "unit-created"; entity: CausalUnit; actionSeq: number }
  | { kind: "unit-destroyed"; entity: CausalUnit; actionSeq: number | null; visibleTo: StarChessColor[]; targets: TargetObservation[] }
  | { kind: "unit-moved"; entityId: EngineUnitId; from: Square; to: Square; actionSeq: number | null }
  | { kind: "unit-transformed"; entityId: EngineUnitId; fromType: ScPiece["type"]; toType: ScPiece["type"]; actionSeq: number | null }
  | { kind: "tank-mode-changed"; entityId: EngineUnitId; before: TankMode; after: TankMode; actionSeq: number | null }
  | { kind: "mine-created"; entity: CausalMine; actionSeq: number }
  | { kind: "mine-removed"; entity: CausalMine; actionSeq: number | null }
  | { kind: "cc-damaged"; side: StarChessColor; before: number; after: number; actionSeq: number | null; targets: TargetObservation[] }
  | { kind: "deployment-resolved"; side: StarChessColor; unitId: EngineUnitId | null; actionSeq: number };
export type CausalEvent = (CausalEffectPayload | { kind: "visibility"; recipient: StarChessColor; turn: number; changes: CausalCell[] })
  & { ordinal: number; group: number; phase: CausalPhase };
export type CausalDiscovery = { ordinal: number; actionSeq: number; side: StarChessColor; site: "scan-ray" | "reveal-to";
  from: Square; to: Square; target: Square; evaluationActorId: EngineUnitId; evaluationTargetId: EngineUnitId;
  modeSource: "default-tank" | "native-sieged-set"; siegedSquares: Square[]; mineInputProvided: boolean; mines: ScMine[];
  steps: { square: Square; visible: boolean }[]; returnedStep: number | null; deferred: boolean;
  applied: { group: number; operation: "capture" | "cc-shot"; actorId: EngineUnitId; targetId: EngineUnitId } | null };
export type CausalJournalData = { version: "chess-coach.causal-journal.v1"; turn: number; callOrdinal: number;
  initialCells: Record<StarChessColor, CausalCell[]>; finalCells: Record<StarChessColor, CausalCell[]>;
  events: CausalEvent[]; discoveries: CausalDiscovery[] };
export type MutationSpan = { group: number; effectOrdinals: readonly number[] };
export type DiscoveryInput = { actionSeq: number; side: StarChessColor; site: CausalDiscovery["site"];
  base: CausalImage; from: Square; to: Square; target: Square; modeSource: CausalDiscovery["modeSource"];
  siegedSquares: readonly Square[]; mineInputProvided: boolean; mines: readonly ScMine[] };

export interface ResolutionEffects {
  modeAt: (square: Square) => TankMode;
  readonly mineOrder: readonly EngineMineId[];
  capture(): CausalImage;
  bindBoard(board: ReadonlyMap<Square, ScPiece>): void;
  bindAction(seq: number | null, piece: ScPiece | undefined): void;
  group(phase: CausalPhase, mutate: () => void): MutationSpan | null;
  destroy(piece: ScPiece, seq: number | null): void;
  move(piece: ScPiece, from: Square, to: Square, seq: number | null): void;
  create(piece: ScPiece, square: Square, seq: number): EngineUnitId;
  transform(piece: ScPiece, type: ScPiece["type"], seq: number | null): void;
  mode(piece: ScPiece, mode: TankMode, seq: number): void;
  mineCreate(mine: ScMine, seq: number): void;
  mineRemovalIds(mines: readonly ScMine[], hit: MineContact, order?: readonly EngineMineId[]): EngineMineId[];
  mineRemove(ids: readonly EngineMineId[], seq: number | null): void;
  mineContact(hit: MineContact, seq: number | null, mines: readonly ScMine[]): void;
  damage(side: StarChessColor, after: number, seq: number | null): void;
  disposition(seq: number, id: EngineUnitId | null): void;
  discovery(input: DiscoveryInput): PathQueryTap & { ordinal: number };
  discoveryAt(ordinal: number): CausalDiscovery;
  deferred(ordinal: number): void;
  consume(ordinal: number, span: MutationSpan | null, actor: ScPiece, target: ScPiece, operation: "capture" | "cc-shot"): void;
}
