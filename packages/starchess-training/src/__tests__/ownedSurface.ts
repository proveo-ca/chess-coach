// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
export const ownedGuardNames = [
  "requireFloat64Hex", "requireRef", "requireOpening", "requireSnapshot", "requirePlanningMeter",
  "requireHistory", "requireBoundary", "requireCandidate", "requireArtifact", "requireState", "requireReadout",
  "requireFeatureBlocks", "requireManifest", "requireBatch", "requireSnapshotV2",
  "requireEconomicPin", "requireEconomicBinding", "requireEstimatorProvenance", "requireEconomicAuthority",
  "requireTrainingRecipe", "requireStartupArtifactContext",
  "requireCells", "requireMemory", "requireSquareSet", "requireOwnPieces", "requireOwnUnits", "requireOwnMines",
  "requireReceipts", "requireEconomicLedger", "requireMineAudit", "requireOwnState", "requireEvents", "requireActions",
  "requireConditional", "requireComponents", "requirePublicSupport", "requireTables", "requirePartition", "requireTemperatures",
  "requirePiece", "requireCell", "requireSighting", "requireOwnPiece", "requireOwnUnit", "requireOwnMine", "requireActionRef",
  "requireDisposition", "requirePaidReceipt", "requireEnemyLoss", "requireEvent", "requireAction", "requireComponent",
  "requireEconomicRecipe", "requireTransitionRow", "requireEvidenceRow", "requireTable", "requirePartitionBin",
  "requireQueue34", "requirePosition84", "requireEconomic12", "requirePromotion36",
].sort();

const cursors = [
  "Cells64", "Changes64", "Memory64", "SquareSet64", "OwnPieces64", "OwnUnits64", "OwnMines3", "Receipts64",
  "RetiredOwnIds128", "RetiredMineIds195", "Events2048", "Actions65", "Conditional", "Components247", "PublicSupport7501",
  "TransitionRows8192", "EvidenceRows8192", "Tables1588", "Partition", "Temperatures",
];
const lanes = ["Queue34", "Position84", "Economic12", "Promotion36"];
export const ownedKernelNames = [
  ...ownedGuardNames,
  ...cursors.flatMap(name => ["begin", "append", "finish"].map(operation => `${operation}${name}`)),
  ...lanes.flatMap(name => ["begin", "put", "finish"].map(operation => `${operation}${name}`)),
  "BYTE_PRODUCTION_LIMITS", "OPENING_CANONICAL_BYTES_TEXT",
  "constructCanonicalOpening", "constructFloat64Hex", "constructRef", "constructOwnedNumber",
  "snapshotFixedBytes", "snapshotLength", "snapshotProduction", "readSnapshotByte",
  "createPlanningLedger", "enterA2", "finishA2", "abortA2", "failCurrentEntry",
  "reserveBlock", "beginBlock", "requireBlockMeter", "finishBlock", "abortBlock", "consumeWorkBlock",
  "abortPlanningWork", "rejectPlanningWork", "createStartupArtifactContext",
  "makePiece", "makeUnknownCell", "makeLitCell", "makeRevealedCell", "makeSighting", "makeOwnPiece",
  "makeOwnUnit", "makeOwnMine", "makeActionRef", "makeMaterializedDisposition", "makeUnmaterializedDisposition",
  "makePaidReceipt", "makeEnemyLoss", "makeEconomicLedger", "makeOwnState", "makeSnapshotV2", "makeHistory", "makeMineAudit",
  "makeOwnPaidReceiptEvent", "makeOwnGasDebitedEvent", "makeOwnUnitEndowedEvent", "makeOwnUnitCreatedEvent",
  "makeOwnDeploymentUnmaterializedEvent", "makeOwnUnitMovedEvent", "makeOwnUnitTransformedEvent", "makeOwnUnitModeChangedEvent",
  "makeOwnUnitDestroyedEvent", "makeOwnMineEndowedEvent", "makeOwnMineCreatedEvent", "makeOwnMineRemovedEvent",
  "makeOwnIncomeEvent", "makeOwnCCLivesChangedEvent", "makeEnemyUnitDestructionWitnessedEvent", "makeVisionWitnessEvent",
  "makeClassicalAction", "makeDeployAction", "makeStimStepAction", "makeSpiderMineAction", "makeCharonMissilesAction",
  "makeSiegeModeAction", "makeTacticalJumpAction", "makeCandidate", "makeBoundaryBatch", "makeBoundary",
  "makeComponent", "makeEconomicRecipe", "makeTransitionRow", "makeEvidenceRow", "makeTransitionTable", "makeEvidenceTable",
  "makePartitionBin", "makeEconomicArtifact", "makeEconomicState", "makeQuantilesD", "makeQuantilesPotential", "makeEconomicReadout",
  "makeFeatureBlocks", "makeCanonicalManifestV3", "makeEconomicPin", "makeEconomicBinding", "makeEstimatorProvenance",
  "makeEconomicAuthority", "makeHostLimits", "makeValidation", "makeConfiguration418", "makeVersions418", "makeTrainingRecipe",
  "encodeOwnedBoundaryBatch", "encodeOwnedHistory", "encodeOwnedCandidate", "encodeOwnedEconomicArtifact", "encodeOwnedFeatureManifest",
  "encodeOwnedPin", "encodeOwnedBinding", "encodeOwnedEstimatorProvenance", "encodeOwnedAuthority", "encodeOwnedTrainingRecipe",
  "beginBoundaryBatchDecode", "finishBoundaryBatchDecode", "abortBoundaryBatchDecode", "completeBoundaryBatchBytes",
  "boundaryBatch", "boundaryRef", "batchForBoundaryRef", "makeInitialReductionInput", "makeAdvanceReductionInput", "publicSupportCanBirth",
  "beginEvaluationSupport7501", "putEvaluationSupport", "readEvaluationSupport", "finishEvaluationSupport7501",
].sort();

export const ownedKernelTypeNames = [
  "OwnedFloat64Hex", "OwnedByteRef", "OwnedPublicOpening", "ByteProduction", "OwnedByteSnapshot",
  "A2Operation", "A2Ticket", "IngressTicket", "BlockTicket", "LedgerOwner", "LedgerPair", "StartupArtifactContext",
  "ConstructionContext", "OwnedCursor", "VerifiedBatchBytes", "Piece", "Unit", "Mine", "Receipt", "ActionRef", "Ledger",
  "Own", "MineAudit", "Event", "Batch", "BoundaryDecodeTicket", "OwnedReductionInput", "EvaluationSupportDraft",
].sort();
