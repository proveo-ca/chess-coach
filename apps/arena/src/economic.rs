// SPEC: _spec/apps/arena/burn-compat.puml
use crate::economic_client::{
    Boundaries, EconomicClient, OpenReply, SettleReply, StartReply, Transaction,
};
use crate::engine_v2::{CloseReply, FailureCode};
use crate::record::{
    BeginRecord, CleanupStatus, EngineContext, MAX_RECORD_BYTES, Outcome, Pair, RunRecord, RunStop,
    SettlementRecord, StateImage,
};
use crate::run::{check_begin, validate_open};
use crate::worker_transport::validate_unique_json;
use serde::Serialize;
use std::io::{self, Write};
use training_native::contracts::{AuthorizedView, OwnInventory, OwnPiece, PieceKind, Side, Square};
use training_native::ledger::LedgerWork;
use training_native::ledger::contracts::{AtomicGroup, BoundaryPhase, Pair as LedgerPair};
use training_native::ledger::history::{LedgerPair as HistoryPair, SideLedgerReport};

const SCOPE: &str = "record-initial-forward";
const CHRONOLOGY_EVENT_WORK: u64 = 64;
const CLOSEOUT_PROOF_WORK: u64 = 64;
const SEAT_ACCOUNTING_WORK: u64 = 16;
const CLOSEOUT_PROJECTION_WORK: u64 = 64;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum EconomicClassification {
    Terminal,
    WindowLimited,
}

struct VerifiedEconomicRun {
    classification: EconomicClassification,
    session: u32,
    completed_windows: u32,
    boundaries: LedgerPair<u32>,
    terminal: Option<CheckedTerminalAccounting>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
enum TerminalPhase {
    Initial,
    Begin,
    End,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
enum ExclusionReason {
    TerminalAtEnd,
    TerminalAtFollowingCheck,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ExcludedReceipt {
    grant_ordinal: u32,
    source_planning_ordinal: u32,
    settled_turn: u32,
    reason: ExclusionReason,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct MineralAdjustment {
    excluded_mineral_credit: u32,
    eligible_mineral_credits: u32,
    training_closing_bank: u32,
}

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct TerminalTrainingCloseout {
    version: &'static str,
    terminal_phase: TerminalPhase,
    excluded_receipt: Option<ExcludedReceipt>,
    seats: LedgerPair<MineralAdjustment>,
    terminal_gas_refill_eligible: bool,
    usable_gas: LedgerPair<u32>,
}

#[derive(Debug)]
struct CheckedTerminalAccounting {
    phase: TerminalPhase,
    excluded_receipt: Option<ExcludedReceipt>,
    adjustments: LedgerPair<MineralAdjustment>,
}

fn terminal_training_closeout(run: &VerifiedEconomicRun) -> Option<TerminalTrainingCloseout> {
    if run.classification != EconomicClassification::Terminal {
        return None;
    }
    let terminal = run.terminal.as_ref()?;
    Some(TerminalTrainingCloseout {
        version: "arena-terminal-training-closeout-v1",
        terminal_phase: terminal.phase,
        excluded_receipt: terminal.excluded_receipt,
        seats: LedgerPair {
            w: terminal.adjustments.w,
            b: terminal.adjustments.b,
        },
        terminal_gas_refill_eligible: false,
        usable_gas: LedgerPair { w: 0, b: 0 },
    })
}

struct UnreleasedGrant {
    source_context: EngineContext,
    grant_ordinal: u32,
    settled_turn: u32,
    boundary_ordinals: LedgerPair<u32>,
    actual_credits: LedgerPair<u32>,
    banks_after: LedgerPair<u32>,
}

enum NativeStage {
    AwaitingBegin {
        planning_ordinal: u32,
        credit: Option<UnreleasedGrant>,
    },
    Intent {
        context: EngineContext,
    },
    Terminal {
        phase: TerminalPhase,
        credit: Option<UnreleasedGrant>,
    },
}

struct NativeChronology {
    session: u32,
    stage: NativeStage,
    boundaries: LedgerPair<u32>,
    native_turn: u32,
    planning_ordinal: u32,
    grant_ordinal: u32,
    banks: LedgerPair<u32>,
}

impl NativeChronology {
    fn matched_initial(
        session: u32,
        outcome: &Option<Outcome>,
        boundaries: &Boundaries,
        work: &mut LedgerWork,
    ) -> Result<Self, String> {
        work.charge(CHRONOLOGY_EVENT_WORK)
            .map_err(|e| e.to_string())?;
        if session == 0
            || boundaries.w.phase != BoundaryPhase::Initial
            || boundaries.b.phase != BoundaryPhase::Initial
        {
            return Err("Terminal chronology requires a matched native origin".into());
        }
        let mut chronology = Self {
            session,
            stage: if outcome.is_some() {
                NativeStage::Terminal {
                    phase: TerminalPhase::Initial,
                    credit: None,
                }
            } else {
                NativeStage::AwaitingBegin {
                    planning_ordinal: 0,
                    credit: None,
                }
            },
            boundaries: LedgerPair { w: 0, b: 0 },
            native_turn: boundaries.w.turn,
            planning_ordinal: 0,
            grant_ordinal: 0,
            banks: LedgerPair {
                w: boundaries.w.snapshot.own.minerals,
                b: boundaries.b.snapshot.own.minerals,
            },
        };
        chronology.match_boundary_clocks(boundaries)?;
        Ok(chronology)
    }

    fn match_boundary_clocks(&mut self, boundaries: &Boundaries) -> Result<(), String> {
        if boundaries.w.side != Side::White
            || boundaries.b.side != Side::Black
            || boundaries.w.turn != boundaries.b.turn
            || boundaries.w.phase != boundaries.b.phase
            || boundaries.w.planning_ordinal != boundaries.b.planning_ordinal
            || boundaries.w.grant_ordinal != boundaries.b.grant_ordinal
        {
            return Err("Native closeout chronology disagrees between recipients".into());
        }
        self.boundaries = LedgerPair {
            w: boundaries.w.ordinal,
            b: boundaries.b.ordinal,
        };
        self.native_turn = boundaries.w.turn;
        self.planning_ordinal = boundaries.w.planning_ordinal;
        self.grant_ordinal = boundaries.w.grant_ordinal;
        self.banks = LedgerPair {
            w: boundaries.w.snapshot.own.minerals,
            b: boundaries.b.snapshot.own.minerals,
        };
        Ok(())
    }

    fn match_begin(&self, begin: &BeginRecord, boundaries: &Boundaries) -> Result<(), String> {
        let NativeStage::AwaitingBegin {
            planning_ordinal, ..
        } = &self.stage
        else {
            return Err("Begin does not follow a matched native settlement/origin".into());
        };
        if begin.session != self.session
            || begin.planning_ordinal != *planning_ordinal
            || begin.before.bank != begin.after.bank
            || begin.before.bank.w != self.banks.w
            || begin.before.bank.b != self.banks.b
            || boundaries.w.phase != BoundaryPhase::TurnOpen
            || boundaries.b.phase != BoundaryPhase::TurnOpen
            || boundaries.w.planning_ordinal != *planning_ordinal
            || boundaries.b.planning_ordinal != *planning_ordinal
        {
            return Err("Native Begin cannot bind the unused settlement credit".into());
        }
        Ok(())
    }

    fn matched_planning(
        &mut self,
        context: &EngineContext,
        begin: &BeginRecord,
        boundaries: &Boundaries,
        work: &mut LedgerWork,
    ) -> Result<(), String> {
        work.charge(CHRONOLOGY_EVENT_WORK)
            .map_err(|e| e.to_string())?;
        self.match_begin(begin, boundaries)?;
        if begin.outcome.is_some()
            || context.session != self.session
            || context.planning_ordinal != begin.planning_ordinal
            || context.turn != boundaries.w.turn
        {
            return Err("Playable opening does not identify the matched native Begin".into());
        }
        self.match_boundary_clocks(boundaries)?;
        self.stage = NativeStage::Intent {
            context: context.clone(),
        };
        Ok(())
    }

    fn matched_settlement(
        &mut self,
        settlement: &SettlementRecord,
        boundaries: &Boundaries,
        work: &mut LedgerWork,
    ) -> Result<(), String> {
        work.charge(CHRONOLOGY_EVENT_WORK)
            .map_err(|e| e.to_string())?;
        let NativeStage::Intent { context } = &self.stage else {
            return Err("Settlement lacks a matched playable opening".into());
        };
        let grant = context
            .planning_ordinal
            .checked_add(1)
            .ok_or("Native grant ordinal overflow")?;
        if &settlement.context != context
            || boundaries.w.phase != BoundaryPhase::Settled
            || boundaries.b.phase != BoundaryPhase::Settled
            || boundaries.w.grant_ordinal != grant
            || boundaries.b.grant_ordinal != grant
            || boundaries.w.planning_ordinal != grant
            || boundaries.b.planning_ordinal != grant
            || boundaries.w.snapshot.own.minerals != settlement.after.bank.w
            || boundaries.b.snapshot.own.minerals != settlement.after.bank.b
        {
            return Err("Terminal chronology settlement/context/bank mismatch".into());
        }
        for side in [Side::White, Side::Black] {
            work.charge(SEAT_ACCOUNTING_WORK)
                .map_err(|e| e.to_string())?;
            let Some(AtomicGroup::Settlement { credited, .. }) = boundaries.get(side).groups.last()
            else {
                return Err("Native settlement lacks its final grant fact".into());
            };
            if credited != settlement.grants.get(side) {
                return Err("Unused credit differs from the matched native grant".into());
            }
        }
        let credit = UnreleasedGrant {
            source_context: context.clone(),
            grant_ordinal: grant,
            settled_turn: boundaries.w.turn,
            boundary_ordinals: LedgerPair {
                w: boundaries.w.ordinal,
                b: boundaries.b.ordinal,
            },
            actual_credits: LedgerPair {
                w: settlement.grants.w,
                b: settlement.grants.b,
            },
            banks_after: LedgerPair {
                w: settlement.after.bank.w,
                b: settlement.after.bank.b,
            },
        };
        self.match_boundary_clocks(boundaries)?;
        self.stage = if settlement.outcome.is_some() {
            NativeStage::Terminal {
                phase: TerminalPhase::End,
                credit: Some(credit),
            }
        } else {
            NativeStage::AwaitingBegin {
                planning_ordinal: grant,
                credit: Some(credit),
            }
        };
        Ok(())
    }

    fn matched_terminal_begin(
        &mut self,
        begin: &BeginRecord,
        boundaries: &Boundaries,
        work: &mut LedgerWork,
    ) -> Result<(), String> {
        work.charge(CHRONOLOGY_EVENT_WORK)
            .map_err(|e| e.to_string())?;
        self.match_begin(begin, boundaries)?;
        if begin.outcome.is_none() {
            return Err("Terminal closeout requires the matched native Begin outcome".into());
        }
        self.match_boundary_clocks(boundaries)?;
        let old = std::mem::replace(
            &mut self.stage,
            NativeStage::Terminal {
                phase: TerminalPhase::Begin,
                credit: None,
            },
        );
        let NativeStage::AwaitingBegin { credit, .. } = old else {
            unreachable!("match_begin checked the stage");
        };
        self.stage = NativeStage::Terminal {
            phase: TerminalPhase::Begin,
            credit,
        };
        Ok(())
    }

    fn checked_terminal_accounting(
        &self,
        reports: &LedgerPair<SideLedgerReport>,
        work: &mut LedgerWork,
    ) -> Result<CheckedTerminalAccounting, String> {
        work.charge(CLOSEOUT_PROOF_WORK)
            .map_err(|e| e.to_string())?;
        let NativeStage::Terminal { phase, credit } = &self.stage else {
            return Err("Terminal capability lacks matched terminal chronology".into());
        };
        let excluded_receipt = credit.as_ref().map(|credit| ExcludedReceipt {
            grant_ordinal: credit.grant_ordinal,
            source_planning_ordinal: credit.source_context.planning_ordinal,
            settled_turn: credit.settled_turn,
            reason: if *phase == TerminalPhase::End {
                ExclusionReason::TerminalAtEnd
            } else {
                ExclusionReason::TerminalAtFollowingCheck
            },
        });
        let adjustment = |side: Side, work: &mut LedgerWork| -> Result<MineralAdjustment, String> {
            work.charge(SEAT_ACCOUNTING_WORK)
                .map_err(|e| e.to_string())?;
            let report = reports.get(side);
            if report.side != side
                || report.boundary_ordinal != *self.boundaries.get(side)
                || report.native_turn != self.native_turn
                || report.planning_ordinal != self.planning_ordinal
                || report.grant_ordinal != self.grant_ordinal
                || report.calculated.minerals.current_bank != *self.banks.get(side)
            {
                return Err("Terminal accounting is not the final native-bound raw ledger".into());
            }
            let excluded = match credit {
                Some(credit) => {
                    let receipt = report
                        .calculated
                        .settlements
                        .last()
                        .ok_or("Missing unused native settlement receipt")?;
                    if credit.source_context.session != self.session
                        || credit.source_context.planning_ordinal.checked_add(1)
                            != Some(credit.grant_ordinal)
                        || receipt.grant_ordinal != credit.grant_ordinal
                        || receipt.planning_ordinal != credit.grant_ordinal
                        || receipt.at.native_turn != credit.settled_turn
                        || receipt.at.boundary_ordinal != *credit.boundary_ordinals.get(side)
                        || receipt.credited != *credit.actual_credits.get(side)
                        || report.grant_ordinal != credit.grant_ordinal
                        || report.calculated.minerals.current_bank != *credit.banks_after.get(side)
                    {
                        return Err(
                            "Terminal exclusion does not match the immediate unused actual grant"
                                .into(),
                        );
                    }
                    receipt.credited
                }
                None => {
                    if *phase == TerminalPhase::End
                        || !report.calculated.settlements.is_empty()
                        || report.grant_ordinal != 0
                        || report.calculated.minerals.actual_credits != 0
                    {
                        return Err(
                            "Terminal origin cannot exclude or fabricate earlier credits".into(),
                        );
                    }
                    0
                }
            };
            let eligible = report
                .calculated
                .minerals
                .actual_credits
                .checked_sub(u64::from(excluded))
                .ok_or("Terminal actual credit underflow")?;
            let bank = report
                .calculated
                .minerals
                .current_bank
                .checked_sub(excluded)
                .ok_or("Terminal closing bank underflow")?;
            Ok(MineralAdjustment {
                excluded_mineral_credit: excluded,
                eligible_mineral_credits: u32::try_from(eligible)
                    .map_err(|_| "Terminal eligible credits exceed u32")?,
                training_closing_bank: bank,
            })
        };
        let w = adjustment(Side::White, work)?;
        let b = adjustment(Side::Black, work)?;
        work.charge(CLOSEOUT_PROJECTION_WORK)
            .map_err(|e| e.to_string())?;
        Ok(CheckedTerminalAccounting {
            phase: *phase,
            excluded_receipt,
            adjustments: LedgerPair { w, b },
        })
    }
}

pub struct EconomicAnalysis {
    report: EconomicReport,
    verified: Option<VerifiedEconomicRun>,
}

impl EconomicAnalysis {
    pub fn report(&self) -> &EconomicReport {
        &self.report
    }
    pub fn is_verified(&self) -> bool {
        self.verified.is_some()
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct EconomicReport {
    version: &'static str,
    assurance: &'static str,
    learned: bool,
    model_artifact: Option<()>,
    training_ready: bool,
    scope: &'static str,
    policy_verification: &'static str,
    full_economic_verification: bool,
    classification: Option<EconomicClassification>,
    terminal_training_closeout: Option<TerminalTrainingCloseout>,
    record_case: String,
    original_stop: RunStop,
    verified_prefix_windows: u32,
    ledgers: Option<LedgerPair<SideLedgerReport>>,
    checks: Vec<ReadinessCheck>,
    work: Vec<WorkReceipt>,
    cleanup: CleanupStatus,
    error: Option<String>,
}

#[derive(Clone, Copy, Serialize)]
#[serde(rename_all = "kebab-case")]
enum CheckStatus {
    Pass,
    Fail,
    NotExecuted,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ReceiptRef {
    session: u32,
    white_boundary_ordinal: u32,
    black_boundary_ordinal: u32,
    completed_windows: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ReadinessCheck {
    id: &'static str,
    scope: &'static str,
    status: CheckStatus,
    reason: String,
    receipt_ref: Option<ReceiptRef>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct WorkReceipt {
    ordinal: u32,
    scope: &'static str,
    used: u64,
    limit: u64,
}

#[derive(Default)]
struct Evidence {
    session: Option<u32>,
    history: Option<HistoryPair>,
    reports: Option<LedgerPair<SideLedgerReport>>,
    completed: u32,
    native_tail_checked: bool,
    rejection_checked: bool,
    clean_exit: bool,
    chronology: Option<NativeChronology>,
}

impl Evidence {
    fn chronology(&mut self) -> Result<&mut NativeChronology, String> {
        self.chronology
            .as_mut()
            .ok_or("Missing matched native chronology".into())
    }
    fn receipt(&self) -> Option<ReceiptRef> {
        let history = self.history.as_ref()?;
        Some(ReceiptRef {
            session: self.session?,
            white_boundary_ordinal: history.last_boundaries().w.ordinal,
            black_boundary_ordinal: history.last_boundaries().b.ordinal,
            completed_windows: self.completed,
        })
    }
    fn publish(&mut self, boundaries: &Boundaries, tx: &mut Transaction) -> Result<(), String> {
        tx.check()?;
        let next = self
            .history
            .as_ref()
            .ok_or("Missing native-bound ledger origin")?
            .advance(boundaries, &mut tx.work)
            .map_err(|e| e.to_string())?;
        let reports = next.reports(&mut tx.work).map_err(|e| e.to_string())?;
        tx.check()?;
        self.history = Some(next);
        self.reports = Some(reports);
        Ok(())
    }
}

pub fn decode_record(bytes: &[u8]) -> Result<RunRecord, String> {
    if bytes.len() > MAX_RECORD_BYTES {
        return Err("Run record exceeds 16 MiB".into());
    }
    validate_unique_json(bytes)?;
    let record: RunRecord =
        serde_json::from_slice(bytes).map_err(|e| format!("Invalid run record: {e}"))?;
    validate_record(&record)?;
    Ok(record)
}

struct RecordSize(usize);
impl Write for RecordSize {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        self.0 = self
            .0
            .checked_add(bytes.len())
            .filter(|size| *size <= MAX_RECORD_BYTES)
            .ok_or_else(|| io::Error::other("Run record exceeds 16 MiB"))?;
        Ok(bytes.len())
    }
    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

fn validate_record(record: &RunRecord) -> Result<(), String> {
    record.validate_bounds()?;
    serde_json::to_writer(&mut RecordSize(0), record).map_err(|e| e.to_string())?;
    if let Some(aborted) = &record.aborted_planning {
        for side in [Side::White, Side::Black] {
            if let Some(decision) = aborted.decisions.get(side) {
                decision.selected.validate(side)?;
            }
        }
    }
    Ok(())
}

pub fn analyze_record(record: &RunRecord) -> Result<EconomicAnalysis, String> {
    validate_record(record)?;
    let mut tx = Transaction::new(0);
    let mut work = Vec::new();
    let mut evidence = Evidence::default();
    let mut cleanup = CleanupStatus::NotStarted;
    let mut verified = None;
    let mut terminal_closeout = None;
    let result = (|| {
        let mut client = EconomicClient::new()?;
        let result = reconstruct(&mut client, record, &mut evidence, &mut tx, &mut work).and_then(
            |classification| {
                tx.deadline = tx.deadline.min(client.transport.work_deadline);
                client.finish(&tx)?;
                tx.check()?;
                evidence.clean_exit = true;
                Ok(classification)
            },
        );
        cleanup = client.transport.cleanup();
        let classification = result?;
        if cleanup != (CleanupStatus::Exited { success: true }) {
            return Err("Economic worker cleanup did not confirm normal exit".into());
        }
        if let Some(classification) = classification {
            let receipt = evidence
                .receipt()
                .ok_or("Missing checked ledger boundaries")?;
            let terminal = if classification == EconomicClassification::Terminal {
                Some(
                    evidence
                        .chronology
                        .as_ref()
                        .ok_or("Missing terminal native chronology")?
                        .checked_terminal_accounting(
                            evidence
                                .reports
                                .as_ref()
                                .ok_or("Missing terminal raw ledgers")?,
                            &mut tx.work,
                        )?,
                )
            } else {
                None
            };
            let run = VerifiedEconomicRun {
                classification,
                session: receipt.session,
                completed_windows: receipt.completed_windows,
                boundaries: LedgerPair {
                    w: receipt.white_boundary_ordinal,
                    b: receipt.black_boundary_ordinal,
                },
                terminal,
            };
            let closeout = terminal_training_closeout(&run);
            tx.check()?;
            terminal_closeout = closeout;
            verified = Some(run);
        }
        Ok(())
    })();
    work.push(work_receipt(&tx));
    let error = result.err().or_else(|| {
        if verified.is_none() {
            Some(if evidence.rejection_checked { "Native rejection confirmed; only the opening/settled prefix is verified" }
                else { "Original failure remains unverified; only confirmed boundaries were reconstructed" }.into())
        } else { None }
    });
    let checks = checks(&evidence, verified.as_ref(), error.as_deref(), &cleanup);
    let report = EconomicReport {
        version: "arena-economic-report-v1",
        assurance: "NON_ADMITTED",
        learned: false,
        model_artifact: None,
        training_ready: false,
        scope: SCOPE,
        policy_verification: "not-executed",
        full_economic_verification: verified.is_some(),
        classification: verified.as_ref().map(|v| v.classification),
        terminal_training_closeout: terminal_closeout,
        record_case: record.spec.case_id.clone(),
        original_stop: record.stop.clone(),
        verified_prefix_windows: evidence.completed,
        ledgers: evidence.reports,
        checks,
        work,
        cleanup,
        error,
    };
    Ok(EconomicAnalysis { report, verified })
}

fn work_receipt(tx: &Transaction) -> WorkReceipt {
    WorkReceipt {
        ordinal: tx.ordinal,
        scope: "both-recipients-window-transaction",
        used: tx.work.used(),
        limit: tx.work.limit(),
    }
}

fn next_transaction(
    tx: &mut Transaction,
    work: &mut Vec<WorkReceipt>,
    ordinal: u32,
) -> Result<(), String> {
    tx.check()?;
    work.push(work_receipt(tx));
    *tx = Transaction::new(ordinal);
    Ok(())
}

fn reconstruct(
    client: &mut EconomicClient,
    record: &RunRecord,
    evidence: &mut Evidence,
    tx: &mut Transaction,
    work: &mut Vec<WorkReceipt>,
) -> Result<Option<EconomicClassification>, String> {
    let StartReply::Started {
        session,
        fixture,
        initial,
        outcome: mut native_outcome,
        rules,
        boundaries,
    } = client
        .start(record.spec.fixture, tx)
        .map_err(|e| e.to_string())?;
    if session == 0 || fixture != record.spec.fixture || record.initial.as_ref() != Some(&initial) {
        return Err("Economic initial fixture/session/image mismatch".into());
    }
    if let Some(outcome) = &native_outcome {
        outcome.validate()?;
    }
    compare_boundaries(&boundaries, &initial, BoundaryPhase::Initial, 0, None)?;
    let history =
        HistoryPair::initialize(rules, &boundaries, &mut tx.work).map_err(|e| e.to_string())?;
    let reports = history.reports(&mut tx.work).map_err(|e| e.to_string())?;
    let chronology =
        NativeChronology::matched_initial(session, &native_outcome, &boundaries, &mut tx.work)?;
    tx.check()?;
    evidence.session = Some(session);
    evidence.history = Some(history);
    evidence.reports = Some(reports);
    evidence.chronology = Some(chronology);
    let mut image = initial;
    for (index, window) in record.windows.iter().enumerate() {
        let ordinal = u32::try_from(index).map_err(|_| "Window ordinal overflow")?;
        if ordinal != 0 {
            next_transaction(tx, work, ordinal)?;
        }
        if native_outcome.is_some() {
            return Err("Recorded window follows a native terminal".into());
        }
        let OpenReply::Planning {
            context,
            views,
            begin,
            boundaries,
        } = client.open(tx).map_err(|e| e.to_string())?
        else {
            return Err("Native terminal precedes recorded window".into());
        };
        compare_open(&context, &views, &begin, &image, session, ordinal)?;
        if context != window.context || *views != window.views || *begin != window.begin {
            return Err("Economic native planning context/views/begin mismatch".into());
        }
        compare_boundaries(
            &boundaries,
            &begin.after,
            BoundaryPhase::TurnOpen,
            ordinal,
            Some(&views),
        )?;
        evidence.publish(&boundaries, tx)?;
        evidence
            .chronology()?
            .matched_planning(&context, &begin, &boundaries, &mut tx.work)?;
        let SettleReply::Committed {
            context: actual,
            begin: actual_begin,
            settlement,
            boundaries,
        } = client
            .settle(&context, &window.settlement.requests, tx)
            .map_err(|e| e.to_string())?;
        if actual != context
            || actual_begin != *begin
            || actual_begin != window.begin
            || settlement != window.settlement
            || settlement.context != context
            || settlement.before != begin.after
        {
            return Err("Economic native admission/merge/settlement/raw resolve mismatch".into());
        }
        if let Some(outcome) = &settlement.outcome {
            outcome.validate()?;
        }
        compare_boundaries(
            &boundaries,
            &settlement.after,
            BoundaryPhase::Settled,
            ordinal + 1,
            None,
        )?;
        compare_grants(&boundaries, &settlement.grants)?;
        evidence.publish(&boundaries, tx)?;
        evidence
            .chronology()?
            .matched_settlement(&settlement, &boundaries, &mut tx.work)?;
        evidence.completed = ordinal + 1;
        image = settlement.after;
        native_outcome = settlement.outcome;
    }
    let ordinal = record.completed_windows;
    let classification = match &record.stop {
        RunStop::Terminal => {
            if record.failed_attempt.is_some() || record.aborted_planning.is_some() {
                return Err("Terminal record contains failed planning/admission".into());
            }
            if native_outcome.is_none() {
                if ordinal != 0 {
                    next_transaction(tx, work, ordinal)?;
                }
                let OpenReply::Terminal {
                    session: actual,
                    outcome,
                    image: terminal_image,
                    begin,
                    boundaries,
                } = client.open(tx).map_err(|e| e.to_string())?
                else {
                    return Err("Recorded terminal is a native planning window".into());
                };
                if actual != session || begin.as_deref() != record.trailing_begin.as_ref() {
                    return Err("Economic terminal begin/session mismatch".into());
                }
                match (begin, boundaries) {
                    (Some(begin), Some(boundaries)) => {
                        check_begin(&begin, session, ordinal, &image)?;
                        if begin.after != terminal_image || begin.outcome.as_ref() != Some(&outcome)
                        {
                            return Err("Economic terminal begin/image/outcome mismatch".into());
                        }
                        compare_boundaries(
                            &boundaries,
                            &terminal_image,
                            BoundaryPhase::TurnOpen,
                            ordinal,
                            None,
                        )?;
                        evidence.publish(&boundaries, tx)?;
                        evidence.chronology()?.matched_terminal_begin(
                            &begin,
                            &boundaries,
                            &mut tx.work,
                        )?;
                    }
                    (None, None) if terminal_image == image => {
                        return Err("New terminal outcome lacks a matched native Begin".into());
                    }
                    _ => {
                        return Err(
                            "Terminal boundary pair must correspond to one actual Begin".into()
                        );
                    }
                }
                image = terminal_image;
                native_outcome = Some(outcome);
            } else if record.trailing_begin.is_some() {
                return Err("Unexpected trailing Begin after native terminal".into());
            }
            Some(EconomicClassification::Terminal)
        }
        RunStop::WindowLimit => {
            if ordinal != record.spec.max_windows
                || native_outcome.is_some()
                || record.failed_attempt.is_some()
                || record.aborted_planning.is_some()
            {
                return Err("Invalid economic window-limit coverage".into());
            }
            if ordinal != 0 {
                next_transaction(tx, work, ordinal)?;
            }
            let OpenReply::Planning {
                context,
                views,
                begin,
                boundaries,
            } = client.open(tx).map_err(|e| e.to_string())?
            else {
                return Err("Window limit masks a native terminal".into());
            };
            compare_open(&context, &views, &begin, &image, session, ordinal)?;
            if record.trailing_begin.as_ref() != Some(&begin) {
                return Err("Economic trailing window-limit Begin mismatch".into());
            }
            compare_boundaries(
                &boundaries,
                &begin.after,
                BoundaryPhase::TurnOpen,
                ordinal,
                Some(&views),
            )?;
            evidence.publish(&boundaries, tx)?;
            evidence
                .chronology()?
                .matched_planning(&context, &begin, &boundaries, &mut tx.work)?;
            image = begin.after.clone();
            close_match(client, tx, session, Some(&begin), &image, &native_outcome)?;
            compare_final(record, &image, &native_outcome)?;
            require_original_clean_exit(record)?;
            evidence.native_tail_checked = true;
            return Ok(Some(EconomicClassification::WindowLimited));
        }
        RunStop::NativeRejection { message } => {
            if native_outcome.is_some()
                || record.trailing_begin.is_some()
                || record.aborted_planning.is_some()
                || ordinal >= record.spec.max_windows
            {
                return Err("Invalid native-rejection stop classification".into());
            }
            let attempt = record
                .failed_attempt
                .as_ref()
                .ok_or("Missing recorded native rejection")?;
            if ordinal != 0 {
                next_transaction(tx, work, ordinal)?;
            }
            let OpenReply::Planning {
                context,
                views,
                begin,
                boundaries,
            } = client.open(tx).map_err(|e| e.to_string())?
            else {
                return Err("Native terminal precedes rejection".into());
            };
            compare_open(&context, &views, &begin, &image, session, ordinal)?;
            if context != attempt.context
                || *views != attempt.views
                || *begin != attempt.witness.begin
            {
                return Err("Economic rejection opening/context/views mismatch".into());
            }
            compare_boundaries(
                &boundaries,
                &begin.after,
                BoundaryPhase::TurnOpen,
                ordinal,
                Some(&views),
            )?;
            evidence.publish(&boundaries, tx)?;
            evidence
                .chronology()?
                .matched_planning(&context, &begin, &boundaries, &mut tx.work)?;
            let error = client
                .settle(&context, &attempt.witness.requests, tx)
                .err()
                .ok_or("Native admitted a recorded rejected queue")?;
            let packet = error.packet.ok_or(error.message)?;
            if packet.code != FailureCode::NativeRejection
                || packet.message != *message
                || packet.context.as_ref() != Some(&context)
                || packet.witness.as_ref() != Some(&attempt.witness)
            {
                return Err("Economic native rejection packet/witness mismatch".into());
            }
            image = attempt.witness.image.clone();
            native_outcome = attempt.witness.outcome.clone();
            evidence.rejection_checked = true;
            None
        }
        RunStop::PlanningFailure { .. } | RunStop::BridgeFailure { .. } => {
            verify_failure_prefix(
                client,
                record,
                evidence,
                tx,
                work,
                session,
                &image,
                &native_outcome,
            )?;
            return Ok(None);
        }
    };
    if let Some(outcome) = &native_outcome {
        outcome.validate()?;
    }
    compare_final(record, &image, &native_outcome)?;
    close_match(client, tx, session, None, &image, &native_outcome)?;
    require_original_clean_exit(record)?;
    evidence.native_tail_checked = true;
    Ok(classification)
}

fn require_original_clean_exit(record: &RunRecord) -> Result<(), String> {
    if record.cleanup != (CleanupStatus::Exited { success: true }) {
        return Err("Original native record lacks confirmed clean worker exit".into());
    }
    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn verify_failure_prefix(
    client: &mut EconomicClient,
    record: &RunRecord,
    evidence: &mut Evidence,
    tx: &mut Transaction,
    work: &mut Vec<WorkReceipt>,
    session: u32,
    image: &StateImage,
    outcome: &Option<Outcome>,
) -> Result<(), String> {
    if record.failed_attempt.is_some() {
        return Err("Original failure carries an unconfirmed rejection tail".into());
    }
    if matches!(record.stop, RunStop::PlanningFailure { .. }) {
        let aborted = record
            .aborted_planning
            .as_ref()
            .ok_or("Missing aborted planning context")?;
        let expected_begin = record
            .trailing_begin
            .as_ref()
            .ok_or("Missing confirmed failure Begin")?;
        if record.completed_windows != 0 {
            next_transaction(tx, work, record.completed_windows)?;
        }
        let OpenReply::Planning {
            context,
            views,
            begin,
            boundaries,
        } = client.open(tx).map_err(|e| e.to_string())?
        else {
            return Err("Aborted planning follows native terminal".into());
        };
        compare_open(
            &context,
            &views,
            &begin,
            image,
            session,
            record.completed_windows,
        )?;
        if context != aborted.context || *views != aborted.views || &*begin != expected_begin {
            return Err("Economic aborted planning/Begin mismatch".into());
        }
        compare_boundaries(
            &boundaries,
            &begin.after,
            BoundaryPhase::TurnOpen,
            record.completed_windows,
            Some(&views),
        )?;
        evidence.publish(&boundaries, tx)?;
        evidence
            .chronology()?
            .matched_planning(&context, &begin, &boundaries, &mut tx.work)?;
        close_match(client, tx, session, Some(&begin), &begin.after, outcome)?;
        compare_final(record, &begin.after, outcome)?;
        require_original_clean_exit(record)?;
    } else {
        if record.final_image.is_some() || record.outcome.is_some() {
            return Err("Unknown original mutation cannot certify final state/outcome".into());
        }
        if record.trailing_begin.is_some() || record.aborted_planning.is_some() {
            return Err("Original bridge-failure tail remains unverified; confirmed settled prefix retained".into());
        }
        close_match(client, tx, session, None, image, outcome)?;
    }
    Ok(())
}

fn compare_open(
    context: &EngineContext,
    views: &Pair<AuthorizedView>,
    begin: &BeginRecord,
    image: &StateImage,
    session: u32,
    ordinal: u32,
) -> Result<(), String> {
    validate_open(context, views, session, ordinal)?;
    check_begin(begin, session, ordinal, image)?;
    if begin.outcome.is_some() || begin.before.bank != begin.after.bank {
        return Err("Planning Begin is terminal or changed mineral banks".into());
    }
    Ok(())
}

fn close_match(
    client: &mut EconomicClient,
    tx: &mut Transaction,
    session: u32,
    expected_begin: Option<&BeginRecord>,
    image: &StateImage,
    outcome: &Option<Outcome>,
) -> Result<(), String> {
    let CloseReply::Closed {
        session: actual,
        pending_begin,
        image: actual_image,
        outcome: actual_outcome,
    } = client.close(tx).map_err(|e| e.to_string())?;
    if actual != session
        || pending_begin.as_ref() != expected_begin
        || &actual_image != image
        || &actual_outcome != outcome
    {
        return Err("Economic close/session/pending Begin/final image/outcome mismatch".into());
    }
    tx.check()
}

fn compare_final(
    record: &RunRecord,
    image: &StateImage,
    outcome: &Option<Outcome>,
) -> Result<(), String> {
    if record.final_image.as_ref() != Some(image) || &record.outcome != outcome {
        return Err("Economic final native image/outcome mismatch".into());
    }
    Ok(())
}

fn compare_grants(boundaries: &Boundaries, grants: &Pair<u32>) -> Result<(), String> {
    for side in [Side::White, Side::Black] {
        let Some(AtomicGroup::Settlement { credited, .. }) = boundaries.get(side).groups.last()
        else {
            return Err("Missing native-bound grant receipt".into());
        };
        if credited != grants.get(side) {
            return Err("Public grant differs from native actual credited amount".into());
        }
    }
    Ok(())
}

fn compare_boundaries(
    boundaries: &Boundaries,
    image: &StateImage,
    phase: BoundaryPhase,
    planning: u32,
    views: Option<&Pair<AuthorizedView>>,
) -> Result<(), String> {
    for side in [Side::White, Side::Black] {
        let boundary = boundaries.get(side);
        if boundary.side != side
            || boundary.phase != phase
            || boundary.planning_ordinal != planning
            || boundary.grant_ordinal != planning
        {
            return Err("Economic boundary phase/seat/clock mismatch".into());
        }
        if let Some(views) = views
            && &boundary.snapshot != views.get(side)
        {
            return Err("Boundary snapshot differs from the original shared Begin view".into());
        }
        compare_own_image(&boundary.snapshot, image)?;
    }
    Ok(())
}

fn compare_own_image(view: &AuthorizedView, image: &StateImage) -> Result<(), String> {
    let parts: Vec<_> = image.scfen.split('|').collect();
    if parts.len() < 7 || parts[0] != "SCFEN" {
        return Err("Invalid reconstructed native image".into());
    }
    let turn: u32 = parts[2].parse().map_err(|_| "Invalid native image turn")?;
    let side_index = usize::from(view.side == Side::Black);
    let lives = parts[3]
        .as_bytes()
        .get(side_index)
        .and_then(|v| v.checked_sub(b'0'))
        .ok_or("Invalid native CC lives")?;
    let gas = parts[5]
        .strip_prefix("G:")
        .ok_or("Missing native gas")?
        .split(':')
        .collect::<Vec<_>>();
    if gas.len() != 2 {
        return Err("Invalid native gas field".into());
    }
    let digit = |field: &str| -> Result<u32, String> {
        field
            .as_bytes()
            .get(side_index)
            .and_then(|v| v.checked_sub(b'0'))
            .map(u32::from)
            .ok_or("Invalid native gas digit".into())
    };
    let mut own = OwnInventory {
        minerals: *image.bank.get(view.side),
        gas: digit(gas[0])?,
        gas_income: digit(gas[1])?,
        cc_lives: u32::from(lives),
        pieces: Vec::new(),
        mines: Vec::new(),
        sieged_tanks: Vec::new(),
    };
    let ranks: Vec<_> = parts[1].split('/').collect();
    if ranks.len() != 8 {
        return Err("Invalid native placement".into());
    }
    for (rank_index, rank) in ranks.iter().enumerate() {
        let mut file = 0_u8;
        for symbol in rank.bytes() {
            if (b'1'..=b'8').contains(&symbol) {
                file = file
                    .checked_add(symbol - b'0')
                    .ok_or("Native file overflow")?;
                continue;
            }
            if file >= 8 {
                return Err("Invalid native placement width".into());
            }
            let side = if symbol.is_ascii_uppercase() {
                Side::White
            } else {
                Side::Black
            };
            if side == view.side {
                let kind =
                    PieceKind::try_from(char::from(symbol.to_ascii_lowercase()).to_string())?;
                own.pieces.push(OwnPiece {
                    square: Square::parse(&format!(
                        "{}{}",
                        char::from(b'a' + file),
                        8 - rank_index
                    ))?,
                    kind,
                });
            }
            file += 1;
        }
        if file != 8 {
            return Err("Invalid native placement width".into());
        }
    }
    own.pieces.sort_by_key(|piece| piece.square);
    for field in &parts[6..] {
        if let Some(mines) = field.strip_prefix("M:") {
            let prefix = format!("{}:", view.side.as_str());
            for seat in mines.split(';') {
                if let Some(squares) = seat.strip_prefix(&prefix) {
                    own.mines = parse_squares(squares)?;
                }
            }
        }
        if let Some(siege) = field.strip_prefix("S:") {
            own.sieged_tanks = parse_squares(siege)?
                .into_iter()
                .filter(|square| {
                    own.pieces
                        .iter()
                        .any(|p| p.square == *square && p.kind == PieceKind::Rook)
                })
                .collect();
        }
    }
    own.mines.sort();
    own.sieged_tanks.sort();
    if view.turn != turn || view.own != own {
        return Err("Authorized own inventory/turn differs from reconstructed native image".into());
    }
    Ok(())
}

fn parse_squares(text: &str) -> Result<Vec<Square>, String> {
    if !text.is_ascii() || !text.len().is_multiple_of(2) {
        return Err("Invalid native square list".into());
    }
    text.as_bytes()
        .chunks_exact(2)
        .map(|bytes| Square::parse(std::str::from_utf8(bytes).map_err(|e| e.to_string())?))
        .collect()
}

fn checks(
    evidence: &Evidence,
    verified: Option<&VerifiedEconomicRun>,
    error: Option<&str>,
    cleanup: &CleanupStatus,
) -> Vec<ReadinessCheck> {
    let mut checks = Vec::new();
    let prefix = evidence.history.is_some();
    for (id, reason) in [
        (
            "native-defaults-profile",
            "Native worker supplied the validated profile at the matched fixed-fixture origin",
        ),
        (
            "ordered-causal-history",
            "Both recipient histories accepted the ordered causal groups atomically",
        ),
        (
            "mineral-conservation",
            "Both recipient folds checked native-bound mineral receipts and own banks",
        ),
        (
            "paid-basis-conservation",
            "Both recipient folds checked surviving, destroyed and wasted paid lineage",
        ),
        (
            "sequence-identity",
            "Both recipient folds checked boundary clocks and complete canonical identities",
        ),
    ] {
        checks.push(ReadinessCheck {
            id,
            scope: "confirmed-boundary-prefix",
            status: if prefix {
                CheckStatus::Pass
            } else {
                CheckStatus::NotExecuted
            },
            reason: if prefix {
                reason.into()
            } else {
                "No native-bound ledger pair was published".into()
            },
            receipt_ref: evidence.receipt(),
        });
    }
    checks.push(ReadinessCheck { id: "native-correspondence", scope: "record-native-consequences",
        status: if evidence.native_tail_checked { CheckStatus::Pass } else if error.is_some() { CheckStatus::Fail } else { CheckStatus::NotExecuted },
        reason: if evidence.native_tail_checked { "All claimed native initial/open/settlement/rejection/close/final facts matched; policy selection was not executed".into() }
            else { error.unwrap_or("Native record tail was not executed").into() }, receipt_ref: evidence.receipt() });
    checks.push(ReadinessCheck { id: "protocol-bounds", scope: "executed-fixed-worker-transport",
        status: if evidence.clean_exit { CheckStatus::Pass } else if evidence.session.is_some() { CheckStatus::Fail } else { CheckStatus::NotExecuted },
        reason: if evidence.clean_exit { "Executed exchanges obeyed framing, correlation, byte caps and absolute transaction/lifecycle bounds".into() } else { "Transport did not complete cleanly".into() }, receipt_ref: evidence.receipt() });
    checks.push(ReadinessCheck {
        id: "clean-exit",
        scope: "economic-worker-lifecycle",
        status: if evidence.clean_exit && *cleanup == (CleanupStatus::Exited { success: true }) {
            CheckStatus::Pass
        } else {
            CheckStatus::Fail
        },
        reason: format!("Observed worker cleanup: {cleanup:?}"),
        receipt_ref: evidence.receipt(),
    });
    let full_receipt = verified.map(|v| ReceiptRef {
        session: v.session,
        white_boundary_ordinal: v.boundaries.w,
        black_boundary_ordinal: v.boundaries.b,
        completed_windows: v.completed_windows,
    });
    checks.push(ReadinessCheck { id: "full-record-coverage", scope: SCOPE, status: if verified.is_some() { CheckStatus::Pass } else { CheckStatus::Fail }, reason: if verified.is_some() { "Private native-consequence capability covers the terminal/window-limit record and clean exit".into() } else { "Prefix evidence cannot certify the whole record".into() }, receipt_ref: full_receipt });
    let terminal = verified.filter(|run| {
        run.classification == EconomicClassification::Terminal && run.terminal.is_some()
    });
    checks.push(ReadinessCheck {
        id: "terminal-training-closeout", scope: "verified-terminal-check-before-intent-accounting",
        status: if terminal.is_some() { CheckStatus::Pass } else { CheckStatus::NotExecuted },
        reason: if terminal.is_some() {
            "Checked terminal safeguard excludes only the matching unused actual mineral credit and sets usable terminal gas to zero; raw history remains unchanged".into()
        } else { "Requires a complete native-terminal capability and clean worker exit; no terminal adjustment applies to a window limit or failed prefix".into() },
        receipt_ref: terminal.map(|run| ReceiptRef { session: run.session, white_boundary_ordinal: run.boundaries.w, black_boundary_ordinal: run.boundaries.b, completed_windows: run.completed_windows }),
    });
    for id in [
        "policy-verification",
        "full-418-features",
        "pmf-posterior",
        "promotion-kernels",
        "learner-core",
        "calibration",
        "resource-profiling",
        "whole-decision-cap-adequacy",
        "runtime-authority",
        "training-authorization",
        "learned-admission",
    ] {
        checks.push(ReadinessCheck {
            id,
            scope: "deferred",
            status: CheckStatus::NotExecuted,
            reason: "Not executed by the non-admitted ledger-first slice".into(),
            receipt_ref: None,
        });
    }
    checks
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine_v2::{
        CommitReply, EngineClient, Namespace, OpenReply as NativeOpenReply,
        StartReply as NativeStartReply,
    };
    use crate::record::{BaselinePolicy, Decision, FailedAttempt, MatchSpec, WindowRecord};
    use serde_json::{Value, json};
    use training_native::contracts::{Action, Candidate, Spend};

    #[test]
    fn native_all_actors_same_cell_rook_replacement_keeps_siege_and_conserves_paid_lineage() {
        let spec: MatchSpec = serde_json::from_value(json!({
            "version":"arena-match-v1","caseId":"native-sieged-rook-replacement-control","fixture":"all-actors-v1",
            "players":{"w":"pass-v1","b":"pass-v1"},"environmentSeed":0,"policySeeds":{"w":1,"b":2},"maxWindows":2
        })).unwrap();
        let mut record = RunRecord::new(spec);
        let mut native = EngineClient::new().unwrap();
        let ns = Namespace::Session;
        let NativeStartReply::Started {
            session,
            fixture,
            initial,
            outcome,
        } = native.start(ns, record.spec.fixture).unwrap();
        assert_eq!(fixture, record.spec.fixture);
        assert!(outcome.is_none());
        record.initial = Some(initial);
        let d1 = Square::parse("d1").unwrap();
        for (ordinal, action) in [
            json!({"kind":"siegeMode","timing":"B","color":"w","from":"d1"}),
            json!({"kind":"deploy","timing":"B","color":"w","from":"e1","to":"d1","unit":"r"}),
        ]
        .into_iter()
        .enumerate()
        {
            let NativeOpenReply::Planning { context, views } =
                native.open(ns, session, ordinal as u32).unwrap()
            else {
                panic!("Unexpected native terminal");
            };
            assert_eq!(views.w.own.sieged_tanks.contains(&d1), ordinal == 1);
            let requests = Pair {
                w: vec![serde_json::from_value::<Action>(action).unwrap()],
                b: Vec::new(),
            };
            let CommitReply::Committed {
                context: committed_context,
                begin,
                settlement,
            } = native.commit(ns, &context, &requests).unwrap();
            assert_eq!(committed_context, context);
            assert_eq!(settlement.requests, requests);
            assert!(settlement.outcome.is_none());
            assert!(
                settlement
                    .after
                    .scfen
                    .split('|')
                    .any(|field| field == "S:d1")
            );
            assert!(
                settlement.raw_resolve["next"]["siegedTanks"]
                    .as_array()
                    .unwrap()
                    .contains(&json!("d1"))
            );
            assert_eq!(settlement.before.bank, Pair { w: 12, b: 12 });
            assert_eq!(
                settlement.committed.bank,
                Pair {
                    w: if ordinal == 0 { 12 } else { 7 },
                    b: 12
                }
            );
            assert_eq!(
                settlement.grants,
                Pair {
                    w: if ordinal == 0 { 0 } else { 3 },
                    b: 0
                }
            );
            assert_eq!(
                settlement.after.bank,
                Pair {
                    w: if ordinal == 0 { 12 } else { 10 },
                    b: 12
                }
            );
            let gas_field = settlement
                .committed
                .scfen
                .split('|')
                .find_map(|field| field.strip_prefix("G:"))
                .unwrap();
            let spend = Spend {
                minerals: settlement
                    .before
                    .bank
                    .w
                    .checked_sub(settlement.committed.bank.w)
                    .unwrap(),
                gas: views
                    .w
                    .own
                    .gas
                    .checked_sub(u32::from(gas_field.as_bytes()[0] - b'0'))
                    .unwrap(),
            };
            assert_eq!(spend.minerals, if ordinal == 0 { 0 } else { 5 });
            let decisions = Pair {
                w: Decision {
                    policy: BaselinePolicy::PassV1,
                    seed: 1,
                    generation: None,
                    selected: Candidate::new(requests.w.clone(), spend, Side::White).unwrap(),
                },
                b: Decision {
                    policy: BaselinePolicy::PassV1,
                    seed: 2,
                    generation: None,
                    selected: Candidate::new(Vec::new(), Spend::default(), Side::Black).unwrap(),
                },
            };
            record.windows.push(WindowRecord {
                context,
                views,
                decisions,
                begin,
                settlement,
            });
            record.completed_windows += 1;
        }
        let NativeOpenReply::Planning { context, views } = native.open(ns, session, 2).unwrap()
        else {
            panic!("Unexpected native terminal at window limit");
        };
        assert_eq!(context.planning_ordinal, 2);
        assert_eq!(views.w.own.minerals, 10);
        assert_eq!(views.b.own.minerals, 12);
        assert!(views.w.own.sieged_tanks.contains(&d1));
        let CloseReply::Closed {
            session: closed_session,
            pending_begin,
            image,
            outcome,
        } = native.close(ns, session).unwrap();
        assert_eq!(closed_session, session);
        assert!(outcome.is_none());
        let pending_begin = pending_begin.unwrap();
        assert_eq!(pending_begin.planning_ordinal, 2);
        assert_eq!(pending_begin.after, image);
        record.trailing_begin = Some(pending_begin);
        record.final_image = Some(image);
        record.outcome = outcome;
        record.stop = RunStop::WindowLimit;
        native.finish().unwrap();
        record.cleanup = native.cleanup();
        assert_eq!(record.cleanup, CleanupStatus::Exited { success: true });
        record.validate_bounds().unwrap();
        let original_bytes = serde_json::to_vec(&record).unwrap();
        let decoded = decode_record(&original_bytes).unwrap();
        let analysis = analyze_record(&decoded).unwrap();
        assert_eq!(serde_json::to_vec(&decoded).unwrap(), original_bytes);
        assert_eq!(serde_json::to_vec(&record).unwrap(), original_bytes);
        assert!(
            analysis.is_verified(),
            "Native replacement ledger refused: {:?}",
            analysis.report.error
        );
        let report = serde_json::to_value(analysis.report()).unwrap();
        assert_eq!(report["fullEconomicVerification"], true);
        assert_eq!(report["classification"], "window-limited");
        assert_eq!(report["policyVerification"], "not-executed");
        assert_eq!(report["terminalTrainingCloseout"], Value::Null);
        assert_eq!(report["trainingReady"], false);
        let white = &report["ledgers"]["w"];
        let rook = white["ownUnits"]
            .as_array()
            .unwrap()
            .iter()
            .find(|unit| unit["square"] == "d1" && unit["type"] == "r")
            .unwrap();
        let old = white["ownLost"]["units"]
            .as_array()
            .unwrap()
            .iter()
            .find(|loss| loss["unit"]["square"] == "d1" && loss["unit"]["type"] == "r")
            .unwrap();
        assert_ne!(rook["id"], old["unit"]["id"]);
        assert_eq!(rook["mode"], "siege");
        assert_eq!(rook["paidMineralBasis"], 5);
        assert_eq!(
            rook["origin"],
            json!({"kind":"action","actionRef":{"planningOrdinal":1,"acceptedActionOrdinal":0}})
        );
        assert_eq!(old["unit"]["mode"], "siege");
        assert_eq!(old["unit"]["origin"], json!({"kind":"endowed"}));
        assert_eq!(old["unit"]["paidMineralBasis"], 0);
        assert_eq!(white["ownLost"]["count"], 1);
        assert_eq!(white["ownLost"]["paidMineralBasis"], 0);
        assert_eq!(white["ownLost"]["replacementValueAtLoss"], 5);
        let minerals = &white["calculated"]["minerals"];
        assert_eq!(minerals["originBank"], 12);
        assert_eq!(minerals["actualCredits"], 3);
        assert_eq!(minerals["paidDebits"], 5);
        assert_eq!(minerals["currentBank"], 10);
        assert_eq!(minerals["survivingPaidBasis"], 5);
        assert_eq!(minerals["destroyedPaidBasis"], 0);
        assert_eq!(minerals["wastedPaidBasis"], 0);
        assert_eq!(
            report["ledgers"]["b"]["calculated"]["minerals"]["paidDebits"],
            0
        );
        assert_eq!(report["ledgers"]["w"]["grantOrdinal"], 2);
        assert_eq!(report["ledgers"]["b"]["grantOrdinal"], 2);
        let deployment = &white["calculated"]["deploymentReceipts"][0];
        assert_eq!(deployment["minerals"], 5);
        assert_eq!(deployment["disposition"]["kind"], "materialized");
        assert_eq!(deployment["disposition"]["unitId"], rook["id"]);
    }

    #[test]
    fn seeded_all_actors_native_rejection_retains_opening_without_receipts_or_admission() {
        let spec: MatchSpec = serde_json::from_str(include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/tests/fixtures/seeded-all-actors.json"
        )))
        .unwrap();
        let mut record = crate::run::run_match(&spec).unwrap();
        assert_eq!(record.stop, RunStop::WindowLimit);
        record.spec.max_windows += 1;
        let mut native = EngineClient::new().unwrap();
        let ns = Namespace::Replay;
        let NativeStartReply::Started { session, .. } =
            native.start(ns, record.spec.fixture).unwrap();
        for window in &record.windows {
            let NativeOpenReply::Planning { context, views } = native
                .open(ns, session, window.context.planning_ordinal)
                .unwrap()
            else {
                panic!("Unexpected terminal");
            };
            assert_eq!(context, window.context);
            assert_eq!(views, window.views);
            let CommitReply::Committed { settlement, .. } = native
                .commit(ns, &context, &window.settlement.requests)
                .unwrap();
            assert_eq!(settlement, window.settlement);
        }
        let NativeOpenReply::Planning { context, views } =
            native.open(ns, session, record.completed_windows).unwrap()
        else {
            panic!("Unexpected terminal");
        };
        let invalid: Action = serde_json::from_value(
            json!({"kind":"classical","timing":"C","color":"w","from":"e1","to":"e8"}),
        )
        .unwrap();
        let requests = Pair {
            w: vec![invalid.clone()],
            b: Vec::new(),
        };
        let error = native.commit(ns, &context, &requests).unwrap_err();
        let packet = error.packet.unwrap();
        assert_eq!(packet.code, FailureCode::NativeRejection);
        let witness = packet.witness.unwrap();
        let mut decisions = record.windows.last().unwrap().decisions.clone();
        decisions.w.selected =
            Candidate::new(vec![invalid], Spend::default(), Side::White).unwrap();
        decisions.b.selected = Candidate::new(Vec::new(), Spend::default(), Side::Black).unwrap();
        record.failed_attempt = Some(FailedAttempt {
            context,
            views,
            decisions,
            witness: witness.clone(),
        });
        record.trailing_begin = None;
        record.final_image = Some(witness.image.clone());
        record.outcome = witness.outcome;
        record.stop = RunStop::NativeRejection {
            message: packet.message,
        };
        let CloseReply::Closed { pending_begin, .. } = native.close(ns, session).unwrap();
        assert!(pending_begin.is_none());
        native.finish().unwrap();
        record.cleanup = native.cleanup();
        let analysis = analyze_record(&record).unwrap();
        assert!(!analysis.is_verified());
        let report = serde_json::to_value(analysis.report()).unwrap();
        assert_eq!(report["verifiedPrefixWindows"], 3);
        assert_eq!(report["fullEconomicVerification"], false);
        assert_eq!(report["terminalTrainingCloseout"], Value::Null);
        assert_eq!(
            report["checks"]
                .as_array()
                .unwrap()
                .iter()
                .find(|check| check["id"] == "terminal-training-closeout")
                .unwrap()["status"],
            "not-executed"
        );
        assert_eq!(report["cleanup"], json!({"kind":"exited","success":true}));
        for side in ["w", "b"] {
            assert_eq!(report["ledgers"][side]["grantOrdinal"], 3);
            assert_eq!(
                report["ledgers"][side]["calculated"]["settlements"]
                    .as_array()
                    .unwrap()
                    .len(),
                3
            );
            assert!(
                report["ledgers"][side]["calculated"]["acceptedActions"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .all(|action| action["actionRef"]["planningOrdinal"].as_u64().unwrap() < 3)
            );
        }
        for (pointer, replacement) in [
            ("/failedAttempt/witness/message", json!("forged")),
            ("/failedAttempt/witness/nativeCode", json!("forged")),
            ("/failedAttempt/witness/image/bank/w", json!(0)),
            (
                "/failedAttempt/witness/begin/rawBegin",
                json!({"forged":true}),
            ),
            ("/failedAttempt/witness/requests/w", json!([])),
            ("/stop/message", json!("forged")),
        ] {
            let mut value = serde_json::to_value(&record).unwrap();
            *value.pointer_mut(pointer).unwrap() = replacement;
            let bad: RunRecord = serde_json::from_value(value).unwrap();
            let analysis = analyze_record(&bad).unwrap();
            assert!(!analysis.is_verified());
            let bad_report: Value = serde_json::to_value(analysis.report()).unwrap();
            assert!(
                !bad_report["error"]
                    .as_str()
                    .unwrap()
                    .contains("Native rejection confirmed")
            );
        }
    }
}

#[cfg(test)]
mod synthetic_closeout_tests {
    use super::*;
    use crate::record::MatchSpec;
    use serde_json::json;
    use std::sync::OnceLock;
    use training_native::ledger::contracts::{BoundaryVersion, EconomicBoundary};
    use training_native::ledger::history::{LedgerPosition, SettlementReceiptReport};

    struct SyntheticChronologyNotNativeAdmission {
        chronology: NativeChronology,
        boundaries: Boundaries,
        reports: LedgerPair<SideLedgerReport>,
        work: LedgerWork,
    }

    impl SyntheticChronologyNotNativeAdmission {
        fn origin(turn: u32, banks: LedgerPair<u32>, gas: u32, terminal: bool) -> Self {
            static BASE: OnceLock<(Pair<AuthorizedView>, LedgerPair<SideLedgerReport>)> =
                OnceLock::new();
            let (views, reports) = BASE.get_or_init(|| {
                let spec: MatchSpec = serde_json::from_value(json!({"version":"arena-match-v1","caseId":"synthetic-closeout-donor-not-terminal-admission","fixture":"standard-v1","players":{"w":"pass-v1","b":"pass-v1"},"environmentSeed":0,"policySeeds":{"w":1,"b":2},"maxWindows":1})).unwrap();
                let record = crate::run::run_match(&spec).unwrap();
                let mut analysis = analyze_record(&record).unwrap();
                assert!(analysis.is_verified());
                assert!(analysis.report.terminal_training_closeout.is_none());
                (record.windows[0].views.clone(), analysis.report.ledgers.take().unwrap())
            });
            let mut work = LedgerWork::new();
            work.preflight_bytes(65_536).unwrap();
            assert!(serde_json::to_vec(&(views, reports)).unwrap().len() < 65_536);
            let boundary = |side| {
                let mut snapshot = views.get(side).clone();
                snapshot.turn = turn;
                snapshot.own.minerals = *banks.get(side);
                snapshot.own.gas = gas;
                snapshot.own.gas_income = gas;
                EconomicBoundary {
                    version: BoundaryVersion::V1,
                    side,
                    ordinal: 0,
                    phase: BoundaryPhase::Initial,
                    turn,
                    planning_ordinal: 0,
                    grant_ordinal: 0,
                    seq_before: 0,
                    seq_through: 0,
                    groups: Vec::new(),
                    snapshot,
                }
            };
            let boundaries = LedgerPair {
                w: boundary(Side::White),
                b: boundary(Side::Black),
            };
            let mut reports = reports.clone();
            for side in [Side::White, Side::Black] {
                let report = reports.get_mut(side);
                report.calculated.origin.native_turn = turn;
                report.calculated.origin.minerals = *banks.get(side);
                report.calculated.minerals.origin_bank = *banks.get(side);
                report.calculated.minerals.actual_credits = 0;
                report.calculated.minerals.nominal_entitlement = 0;
                report.calculated.minerals.cap_discard = 0;
                report.calculated.settlements.clear();
            }
            let outcome = terminal.then_some(Outcome {
                winner: None,
                draw: true,
            });
            let chronology =
                NativeChronology::matched_initial(7, &outcome, &boundaries, &mut work).unwrap();
            let mut fixture = Self {
                chronology,
                boundaries,
                reports,
                work,
            };
            fixture.sync_reports();
            fixture
        }

        fn image(&self) -> StateImage {
            StateImage {
                scfen: format!(
                    "synthetic-proof-control-not-native-admission:turn:{}",
                    self.boundaries.w.turn
                ),
                bank: Pair {
                    w: self.boundaries.w.snapshot.own.minerals,
                    b: self.boundaries.b.snapshot.own.minerals,
                },
            }
        }

        fn sync_reports(&mut self) {
            self.work.charge(64).unwrap();
            for side in [Side::White, Side::Black] {
                let boundary = self.boundaries.get(side);
                let report = self.reports.get_mut(side);
                report.boundary_ordinal = boundary.ordinal;
                report.native_turn = boundary.turn;
                report.planning_ordinal = boundary.planning_ordinal;
                report.grant_ordinal = boundary.grant_ordinal;
                report.sequence_through = boundary.seq_through;
                report.calculated.minerals.current_bank = boundary.snapshot.own.minerals;
                report.calculated.gas.available = boundary.snapshot.own.gas;
                report.calculated.gas.capacity = boundary.snapshot.own.gas_income;
            }
        }

        fn begin(&mut self, turn: u32, terminal: bool) {
            self.work.charge(64).unwrap();
            let before = self.image();
            for side in [Side::White, Side::Black] {
                let boundary = self.boundaries.get_mut(side);
                boundary.ordinal += 1;
                boundary.phase = BoundaryPhase::TurnOpen;
                boundary.turn = turn;
                boundary.seq_before = boundary.seq_through;
                boundary.groups.clear();
                boundary.snapshot.turn = turn;
                boundary.snapshot.own.gas = boundary.snapshot.own.gas_income;
            }
            let begin = BeginRecord {
                session: 7,
                planning_ordinal: self.boundaries.w.planning_ordinal,
                before,
                after: self.image(),
                raw_begin: json!({"scope":"synthetic-closeout-proof-not-native-admission"}),
                outcome: terminal.then_some(Outcome {
                    winner: None,
                    draw: true,
                }),
            };
            if terminal {
                self.chronology
                    .matched_terminal_begin(&begin, &self.boundaries, &mut self.work)
                    .unwrap();
            } else {
                let context = EngineContext {
                    session: 7,
                    planning_ordinal: begin.planning_ordinal,
                    turn,
                };
                self.chronology
                    .matched_planning(&context, &begin, &self.boundaries, &mut self.work)
                    .unwrap();
            }
            self.sync_reports();
        }

        fn settle(
            &mut self,
            turn: u32,
            actual: LedgerPair<u32>,
            entitlement: u32,
            capacity: u32,
            terminal: bool,
        ) {
            self.work.charge(128).unwrap();
            let NativeStage::Intent { context } = &self.chronology.stage else {
                panic!("Synthetic settlement requires a matched intent");
            };
            let context = context.clone();
            let before = self.image();
            for side in [Side::White, Side::Black] {
                let boundary = self.boundaries.get_mut(side);
                boundary.ordinal += 1;
                boundary.phase = BoundaryPhase::Settled;
                boundary.turn = turn;
                boundary.planning_ordinal += 1;
                boundary.grant_ordinal += 1;
                boundary.seq_before = boundary.seq_through;
                boundary.seq_through += 1;
                boundary.snapshot.turn = turn;
                boundary.snapshot.own.minerals += *actual.get(side);
                let gas_before_reset = boundary.snapshot.own.gas;
                boundary.snapshot.own.gas = 0;
                boundary.snapshot.own.gas_income = capacity;
                boundary.groups = vec![AtomicGroup::Settlement {
                    seq: boundary.seq_through,
                    entitlement,
                    credited: *actual.get(side),
                    gas_before_reset,
                    next_gas_capacity: capacity,
                }];
                let report = self.reports.get_mut(side);
                report.calculated.minerals.actual_credits += u64::from(*actual.get(side));
                report.calculated.minerals.nominal_entitlement += u64::from(entitlement);
                report.calculated.minerals.cap_discard +=
                    u64::from(entitlement - *actual.get(side));
                report.calculated.settlements.push(SettlementReceiptReport {
                    at: LedgerPosition {
                        boundary_ordinal: boundary.ordinal,
                        native_turn: turn,
                        sequence: boundary.seq_through,
                    },
                    planning_ordinal: boundary.planning_ordinal,
                    grant_ordinal: boundary.grant_ordinal,
                    entitlement,
                    credited: *actual.get(side),
                    cap_discard: entitlement - *actual.get(side),
                    gas_before_reset,
                    next_gas_capacity: capacity,
                });
            }
            let settlement = SettlementRecord {
                context,
                requests: Pair {
                    w: Vec::new(),
                    b: Vec::new(),
                },
                before: before.clone(),
                committed: before,
                after: self.image(),
                grants: Pair {
                    w: actual.w,
                    b: actual.b,
                },
                raw_resolve: json!({"scope":"synthetic-closeout-proof-not-native-admission"}),
                outcome: terminal.then_some(Outcome {
                    winner: None,
                    draw: true,
                }),
            };
            self.chronology
                .matched_settlement(&settlement, &self.boundaries, &mut self.work)
                .unwrap();
            self.sync_reports();
        }

        fn module_synthetic_proof_not_native_admission(&mut self) -> VerifiedEconomicRun {
            let terminal = self
                .chronology
                .checked_terminal_accounting(&self.reports, &mut self.work)
                .unwrap();
            VerifiedEconomicRun {
                classification: EconomicClassification::Terminal,
                session: 7,
                completed_windows: self.chronology.grant_ordinal,
                boundaries: LedgerPair {
                    w: self.chronology.boundaries.w,
                    b: self.chronology.boundaries.b,
                },
                terminal: Some(terminal),
            }
        }
    }

    fn pair(w: u32, b: u32) -> LedgerPair<u32> {
        LedgerPair { w, b }
    }

    fn synthetic_following_check() -> SyntheticChronologyNotNativeAdmission {
        let mut fixture = SyntheticChronologyNotNativeAdmission::origin(9, pair(3, 3), 1, false);
        fixture.begin(9, false);
        fixture.settle(10, pair(1, 1), 1, 1, false);
        fixture.begin(11, true);
        fixture
    }

    #[test]
    fn synthetic_following_check_excludes_turn_10_actual_one_not_turn_11_nominal_two() {
        let mut fixture = synthetic_following_check();
        let raw = serde_json::to_value(&fixture.reports).unwrap();
        let run = fixture.module_synthetic_proof_not_native_admission();
        let closeout = terminal_training_closeout(&run).unwrap();
        assert_eq!(
            serde_json::to_value(closeout).unwrap(),
            json!({
                "version":"arena-terminal-training-closeout-v1","terminalPhase":"begin",
                "excludedReceipt":{"grantOrdinal":1,"sourcePlanningOrdinal":0,"settledTurn":10,"reason":"terminal-at-following-check"},
                "seats":{"w":{"excludedMineralCredit":1,"eligibleMineralCredits":0,"trainingClosingBank":3},"b":{"excludedMineralCredit":1,"eligibleMineralCredits":0,"trainingClosingBank":3}},
                "terminalGasRefillEligible":false,"usableGas":{"w":0,"b":0}
            })
        );
        assert_eq!(raw["w"]["nativeTurn"], 11);
        assert_eq!(raw["w"]["calculated"]["minerals"]["currentBank"], 4);
        assert_eq!(raw["w"]["calculated"]["gas"]["available"], 1);
        assert_eq!(serde_json::to_value(&fixture.reports).unwrap(), raw);
    }

    #[test]
    fn synthetic_end_and_following_check_exclude_actual_capped_asymmetry_and_keep_zero_receipt_identity()
     {
        for (w, b, credited_w, credited_b) in [(11, 12, 1, 0), (12, 12, 0, 0), (3, 3, 3, 3)] {
            for terminal_at_end in [true, false] {
                let banks = pair(w, b);
                let actual = pair(credited_w, credited_b);
                let mut fixture =
                    SyntheticChronologyNotNativeAdmission::origin(20, banks, 2, false);
                fixture.begin(20, false);
                fixture.settle(21, actual, 3, 3, terminal_at_end);
                if !terminal_at_end {
                    fixture.begin(22, true);
                }
                let raw = serde_json::to_value(&fixture.reports).unwrap();
                let run = fixture.module_synthetic_proof_not_native_admission();
                let closeout = terminal_training_closeout(&run).unwrap();
                assert_eq!(
                    closeout.terminal_phase,
                    if terminal_at_end {
                        TerminalPhase::End
                    } else {
                        TerminalPhase::Begin
                    }
                );
                assert_eq!(
                    closeout.excluded_receipt,
                    Some(ExcludedReceipt {
                        grant_ordinal: 1,
                        source_planning_ordinal: 0,
                        settled_turn: 21,
                        reason: if terminal_at_end {
                            ExclusionReason::TerminalAtEnd
                        } else {
                            ExclusionReason::TerminalAtFollowingCheck
                        }
                    })
                );
                for side in [Side::White, Side::Black] {
                    let adjustment = closeout.seats.get(side);
                    assert_eq!(
                        adjustment.excluded_mineral_credit,
                        fixture.reports.get(side).calculated.settlements[0].credited
                    );
                    assert_eq!(adjustment.eligible_mineral_credits, 0);
                    assert_eq!(
                        adjustment.training_closing_bank,
                        fixture.reports.get(side).calculated.minerals.origin_bank
                    );
                    assert_eq!(
                        fixture.reports.get(side).calculated.gas.available,
                        if terminal_at_end { 0 } else { 3 }
                    );
                    assert_eq!(*closeout.usable_gas.get(side), 0);
                }
                assert_eq!(serde_json::to_value(&fixture.reports).unwrap(), raw);
            }
        }
    }

    #[test]
    fn synthetic_playable_begin_releases_earlier_credit_without_a_sample_draw() {
        let mut fixture = SyntheticChronologyNotNativeAdmission::origin(0, pair(3, 3), 1, false);
        fixture.begin(0, false);
        fixture.settle(1, pair(1, 1), 1, 1, false);
        fixture.begin(1, false);
        assert!(
            fixture
                .chronology
                .checked_terminal_accounting(&fixture.reports, &mut fixture.work)
                .is_err()
        );
        fixture.settle(2, pair(1, 1), 1, 1, false);
        fixture.begin(3, true);
        let run = fixture.module_synthetic_proof_not_native_admission();
        let closeout = terminal_training_closeout(&run).unwrap();
        assert_eq!(closeout.excluded_receipt.unwrap().grant_ordinal, 2);
        assert_eq!(
            closeout.excluded_receipt.unwrap().source_planning_ordinal,
            1
        );
        assert_eq!(closeout.excluded_receipt.unwrap().settled_turn, 2);
        for side in [Side::White, Side::Black] {
            assert_eq!(
                fixture.reports.get(side).calculated.minerals.actual_credits,
                2
            );
            assert_eq!(closeout.seats.get(side).excluded_mineral_credit, 1);
            assert_eq!(closeout.seats.get(side).eligible_mineral_credits, 1);
            assert_eq!(closeout.seats.get(side).training_closing_bank, 4);
        }
    }

    #[test]
    fn synthetic_initial_and_first_fatal_begin_keep_endowments_without_excluding_a_receipt() {
        for initial_terminal in [true, false] {
            let mut fixture =
                SyntheticChronologyNotNativeAdmission::origin(9, pair(3, 12), 1, initial_terminal);
            if !initial_terminal {
                fixture.begin(10, true);
            }
            let run = fixture.module_synthetic_proof_not_native_admission();
            let closeout = terminal_training_closeout(&run).unwrap();
            assert_eq!(
                closeout.terminal_phase,
                if initial_terminal {
                    TerminalPhase::Initial
                } else {
                    TerminalPhase::Begin
                }
            );
            assert!(closeout.excluded_receipt.is_none());
            assert_eq!(
                closeout.seats.w,
                MineralAdjustment {
                    excluded_mineral_credit: 0,
                    eligible_mineral_credits: 0,
                    training_closing_bank: 3
                }
            );
            assert_eq!(closeout.seats.b.training_closing_bank, 12);
        }
    }

    #[test]
    fn synthetic_fatal_begin_raw_gas_one_two_three_remains_raw_with_zero_terminal_budget() {
        for (opening, settled, terminal, capacity) in
            [(9, 10, 11, 1), (19, 20, 21, 2), (20, 21, 22, 3)]
        {
            let mut fixture =
                SyntheticChronologyNotNativeAdmission::origin(opening, pair(3, 3), capacity, false);
            fixture.begin(opening, false);
            fixture.settle(settled, pair(capacity, capacity), capacity, capacity, false);
            fixture.begin(terminal, true);
            let run = fixture.module_synthetic_proof_not_native_admission();
            let closeout = terminal_training_closeout(&run).unwrap();
            assert!(!closeout.terminal_gas_refill_eligible);
            for side in [Side::White, Side::Black] {
                assert_eq!(fixture.reports.get(side).calculated.gas.available, capacity);
                assert_eq!(fixture.reports.get(side).calculated.gas.capacity, capacity);
                assert_eq!(*closeout.usable_gas.get(side), 0);
            }
        }
    }

    #[test]
    fn synthetic_closeout_refuses_foreign_receipts_wrong_source_clock_and_incomplete_chronology() {
        for mutation in 0..7 {
            let mut fixture = synthetic_following_check();
            match mutation {
                0 => fixture.reports.w.calculated.settlements[0].planning_ordinal = 0,
                1 => fixture.reports.w.calculated.settlements[0].at.native_turn = 11,
                2 => fixture.reports.w.calculated.settlements[0].credited = 2,
                3 => fixture.reports.w.calculated.settlements[0].grant_ordinal = 2,
                4 => fixture.reports.w.boundary_ordinal += 1,
                5 | 6 => {
                    let NativeStage::Terminal {
                        credit: Some(credit),
                        ..
                    } = &mut fixture.chronology.stage
                    else {
                        unreachable!();
                    };
                    if mutation == 5 {
                        credit.source_context.session += 1;
                    } else {
                        credit.source_context.planning_ordinal = credit.grant_ordinal;
                    }
                }
                _ => unreachable!(),
            }
            assert!(
                fixture
                    .chronology
                    .checked_terminal_accounting(&fixture.reports, &mut fixture.work)
                    .is_err(),
                "Accepted synthetic mutation {mutation}"
            );
        }
        let mut incomplete = SyntheticChronologyNotNativeAdmission::origin(0, pair(3, 3), 1, false);
        incomplete.begin(0, false);
        assert!(
            incomplete
                .chronology
                .checked_terminal_accounting(&incomplete.reports, &mut incomplete.work)
                .is_err()
        );
        let window = VerifiedEconomicRun {
            classification: EconomicClassification::WindowLimited,
            session: 7,
            completed_windows: 0,
            boundaries: pair(1, 1),
            terminal: None,
        };
        assert!(terminal_training_closeout(&window).is_none());
    }

    #[test]
    fn synthetic_closeout_checks_credit_bank_and_integer_underflow_without_mutating_raw_reports() {
        let mut fixture = synthetic_following_check();
        fixture.reports.w.calculated.minerals.actual_credits = 0;
        assert!(
            fixture
                .chronology
                .checked_terminal_accounting(&fixture.reports, &mut fixture.work)
                .unwrap_err()
                .contains("credit underflow")
        );
        let mut fixture = synthetic_following_check();
        fixture.reports.w.calculated.minerals.current_bank = 0;
        fixture.chronology.banks.w = 0;
        let NativeStage::Terminal {
            credit: Some(credit),
            ..
        } = &mut fixture.chronology.stage
        else {
            unreachable!();
        };
        credit.banks_after.w = 0;
        assert!(
            fixture
                .chronology
                .checked_terminal_accounting(&fixture.reports, &mut fixture.work)
                .unwrap_err()
                .contains("bank underflow")
        );
        let mut fixture = synthetic_following_check();
        fixture.reports.w.calculated.minerals.actual_credits = u64::from(u32::MAX) + 2;
        assert!(
            fixture
                .chronology
                .checked_terminal_accounting(&fixture.reports, &mut fixture.work)
                .unwrap_err()
                .contains("exceed u32")
        );
    }

    #[test]
    fn synthetic_closeout_precharges_the_same_meter_before_each_proof_and_projection() {
        let fixture = synthetic_following_check();
        let raw = serde_json::to_value(&fixture.reports).unwrap();
        for (limit, used) in [(63, 0), (79, 64), (159, 96)] {
            let mut work = LedgerWork::with_limit(limit).unwrap();
            assert!(
                fixture
                    .chronology
                    .checked_terminal_accounting(&fixture.reports, &mut work)
                    .is_err()
            );
            assert_eq!(work.used(), used);
        }
        let mut work = LedgerWork::with_limit(160).unwrap();
        assert!(
            fixture
                .chronology
                .checked_terminal_accounting(&fixture.reports, &mut work)
                .is_ok()
        );
        assert_eq!(work.used(), 160);
        assert_eq!(serde_json::to_value(&fixture.reports).unwrap(), raw);
    }
}
