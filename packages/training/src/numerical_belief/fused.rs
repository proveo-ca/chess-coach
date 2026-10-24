// SPEC: _spec/packages/training/belief-integration.puml
use crate::accounting_kernel::{AccountingPoint, BANK_CEILING, MATERIAL_CEILING, NumericGrant};
use crate::banded_joint::sparse_probabilities;
use crate::evidence_tables::InnovationCode;
use crate::joint_accounting::{JointAccountingError, NumericAccountingStep};
use crate::joint_math::{SparseCell, SupportRun};
use crate::ledger::LedgerWork;
use crate::transition_tables::NumericAccountingSource;

use super::{BeliefResult, CompactPosterior, MarineOpportunityProvider, NumericalBeliefModel};

const SPENDS: [u8; 5] = [0, 1, 3, 5, 9];

struct BankWorkspace {
    bank: u8,
    lower: u16,
    head: Vec<f64>,
    reachable: Vec<bool>,
    sparse: Vec<f64>,
}

pub fn fused_settlement<M: MarineOpportunityProvider + ?Sized>(
    prior: &CompactPosterior,
    model: &NumericalBeliefModel<'_, M>,
    step: &NumericAccountingStep,
    boundary_turn: u32,
    innovation: InnovationCode,
    work: &mut LedgerWork,
) -> BeliefResult<CompactPosterior> {
    work.charge(128 + 32)?;
    if step.context.input_turn > model.rules().max_turn || boundary_turn > model.rules().max_turn
        || step.context.visible_before > MATERIAL_CEILING || step.context.marines_before > 64
        || u16::from(step.context.marines_before) > step.context.visible_before
        || step.witnessed_loss > 617 || step.destination_lower > step.destination_upper
        || step.destination_upper > MATERIAL_CEILING
    { return Err(JointAccountingError::Domain.into()); }
    work.charge(32)?;
    let income = match step.grant {
        NumericGrant::None => 0,
        NumericGrant::AtNativeTurn(turn) => {
            work.charge(32)?;
            u16::try_from(model.rules().income_at(turn)?).map_err(|_| JointAccountingError::Domain)?
        }
    };
    model.rules().gas_capacity_at(step.context.input_turn)?;
    work.charge(8 * 13)?;
    let mut maximums: [Option<u16>; 13] = [None; 13];
    for run in prior.support_runs().runs() {
        work.charge(32)?;
        if run.lower < step.context.visible_before { return Err(JointAccountingError::Domain.into()); }
        for spend in SPENDS {
            work.charge(32)?;
            if spend > run.bank { continue; }
            let bank = destination_bank(run.bank, spend, income)?;
            let maximum = run.upper.checked_add(u16::from(spend)).and_then(|x| x.checked_add(32))
                .filter(|x| *x <= 617).ok_or(JointAccountingError::Domain)?;
            let slot = &mut maximums[usize::from(bank)];
            *slot = Some((*slot).map_or(maximum, |old| old.max(maximum)));
        }
    }
    work.charge(16 * 13)?;
    let active = maximums.iter().filter(|maximum| maximum.is_some()).count();
    work.charge(192 + 48 * active as u64 + 8 * 13)?;
    let mut banks = Vec::with_capacity(active);
    let mut indexes = [None; 13];
    let mut destination_count = 0_usize;
    for (bank, maximum) in maximums.into_iter().enumerate() {
        work.charge(32)?;
        let Some(maximum) = maximum else { continue; };
        let width = usize::from(maximum) + 1;
        work.charge(192 + 4 * width as u64)?;
        let head = vec![0.0; width];
        work.charge(192 + 4 * width as u64)?;
        let reachable = vec![false; width];
        let upper = step.destination_upper.min(maximum.saturating_sub(step.witnessed_loss));
        let size = if maximum < step.witnessed_loss || upper < step.destination_lower { 0 }
            else { usize::from(upper - step.destination_lower) + 1 };
        work.charge(192 + 4 * size as u64)?;
        let sparse = vec![0.0; size];
        destination_count = destination_count.checked_add(size).filter(|count| *count <= 7501)
            .ok_or(JointAccountingError::Domain)?;
        indexes[bank] = Some(banks.len());
        banks.push(BankWorkspace { bank: bank as u8, lower: step.destination_lower, head, reachable, sparse });
    }
    let transitions = model.tables().transitions();
    let minimums = transitions.borrow_growth_minimums(work)?;
    let probabilities = sparse_probabilities(prior.banded(), work)?;
    let mut cursor = 0_usize;
    for run in prior.support_runs().runs() {
        work.charge(32)?;
        for material in run.lower..=run.upper {
            work.charge(32)?;
            let point = AccountingPoint { material, bank: run.bank };
            let probability = if probabilities.get(cursor).is_some_and(|cell|
                cell.bank == run.bank && cell.material == material)
            {
                let probability = probabilities[cursor].probability;
                cursor += 1;
                probability
            } else { 0.0 };
            if probability > 0.0 {
                let prepared = transitions.prepare_aggregation_source(point, &step.context, work)?;
                work.charge(32)?;
                let half = positive(0.5 * probability)?;
                let background = positive(half / prepared.terms().denominator)?;
                branches(prepared.accounting(), Some(background), minimums, income, &indexes, &mut banks, work)?;
                for (index, row) in prepared.rows().iter().enumerate() {
                    work.charge(64)?;
                    if prepared.row_feasible(index, work)? && row.destroyed >= step.witnessed_loss {
                        let numerator = positive(probability * row.count)?;
                        let contribution = positive(numerator / prepared.terms().denominator)?;
                        let bank = destination_bank(point.bank, row.spend, income)?;
                        let material = point.material.checked_add(u16::from(row.created))
                            .and_then(|x| x.checked_add(u16::from(row.growth)))
                            .and_then(|x| x.checked_sub(row.destroyed)).ok_or(JointAccountingError::Domain)?;
                        let slot = indexes[usize::from(bank)].ok_or(JointAccountingError::Domain)?;
                        let workspace = &mut banks[slot];
                        if let Some(offset) = material.checked_sub(workspace.lower).map(usize::from)
                            .filter(|offset| *offset < workspace.sparse.len())
                        {
                            workspace.sparse[offset] = nonnegative(workspace.sparse[offset] + contribution)?;
                        }
                    }
                }
            } else {
                let source = transitions.accounting_source(point, &step.context, work)?;
                branches(&source, None, minimums, income, &indexes, &mut banks, work)?;
            }
        }
    }
    work.charge(32)?;
    if cursor != probabilities.len() { return Err(JointAccountingError::Domain.into()); }
    for bank in &mut banks {
        work.charge(32)?;
        for stock in (0..bank.head.len() - 1).rev() {
            work.charge(16)?;
            bank.head[stock] = nonnegative(bank.head[stock] + bank.head[stock + 1])?;
            bank.reachable[stock] = bank.reachable[stock] || bank.reachable[stock + 1];
        }
    }
    work.charge(192)?;
    let mut cells = Vec::with_capacity(destination_count);
    work.charge(192)?;
    let mut runs = Vec::with_capacity(destination_count);
    let mut evidence = EvidenceCache::new(boundary_turn, innovation, work)?;
    let mut total = 0.0;
    for bank in &banks {
        work.charge(32)?;
        for (offset, sparse) in bank.sparse.iter().enumerate() {
            work.charge(32)?;
            let material = bank.lower + offset as u16;
            let threshold = usize::from(material) + usize::from(step.witnessed_loss);
            let background = bank.head.get(threshold).copied().unwrap_or(0.0);
            let reachable = bank.reachable.get(threshold).copied().unwrap_or(false);
            let mut mass = nonnegative(*sparse + background)?;
            if reachable { append_run(&mut runs, bank.bank, material, work)?; }
            if mass > 0.0 {
                if !reachable { return Err(JointAccountingError::Domain.into()); }
                mass = evidence.weight(AccountingPoint { material, bank: bank.bank }, mass, model, work)?;
                work.charge(12)?;
                cells.push(SparseCell { bank: bank.bank, material, probability: mass });
            }
            total = nonnegative(total + mass)?;
        }
    }
    finish(cells, runs, total, work)
}

fn branches(
    source: &NumericAccountingSource,
    background: Option<f64>,
    minimums: &[u8; 33],
    income: u16,
    indexes: &[Option<usize>; 13],
    banks: &mut [BankWorkspace],
    work: &mut LedgerWork,
) -> BeliefResult<()> {
    let point = source.point();
    for spend in SPENDS {
        work.charge(16)?;
        if spend > point.bank { continue; }
        for choice in 0..if spend == 0 { 1 } else { 2 } {
            work.charge(16)?;
            let created = if choice == 0 { 0 } else { spend };
            let opportunities = source.opportunities(spend, created, work)?;
            for (growth, minimum) in minimums.iter().enumerate() {
                work.charge(8)?;
                if usize::from(*minimum) > opportunities { continue; }
                work.charge(64)?;
                let bank = destination_bank(point.bank, spend, income)?;
                let stock = usize::from(point.material) + usize::from(created) + growth;
                let slot = indexes[usize::from(bank)].ok_or(JointAccountingError::Domain)?;
                let workspace = &mut banks[slot];
                let reachable = workspace.reachable.get_mut(stock).ok_or(JointAccountingError::Domain)?;
                *reachable = true;
                if let Some(value) = background {
                    let head = workspace.head.get_mut(stock).ok_or(JointAccountingError::Domain)?;
                    *head = nonnegative(*head + value)?;
                }
            }
        }
    }
    Ok(())
}

pub fn fused_stationary<M: MarineOpportunityProvider + ?Sized>(
    prior: &CompactPosterior,
    model: &NumericalBeliefModel<'_, M>,
    lower: u16,
    upper: u16,
    boundary_turn: u32,
    innovation: InnovationCode,
    work: &mut LedgerWork,
) -> BeliefResult<CompactPosterior> {
    work.charge(128 + 32)?;
    if lower > upper || upper > MATERIAL_CEILING || boundary_turn > model.rules().max_turn {
        return Err(JointAccountingError::Domain.into());
    }
    work.charge(192)?;
    let mut runs = Vec::with_capacity(prior.support_runs().runs().len());
    for run in prior.support_runs().runs() {
        work.charge(32)?;
        let start = run.lower.max(lower);
        let end = run.upper.min(upper);
        if start <= end {
            work.charge(12)?;
            runs.push(SupportRun { bank: run.bank, lower: start, upper: end });
        }
    }
    let source = sparse_probabilities(prior.banded(), work)?;
    work.charge(192)?;
    let mut cells = Vec::with_capacity(source.len());
    let mut total = 0.0;
    let mut evidence = EvidenceCache::new(boundary_turn, innovation, work)?;
    for cell in source {
        work.charge(32)?;
        if cell.material >= lower && cell.material <= upper {
            let probability = evidence.weight(AccountingPoint { material: cell.material, bank: cell.bank },
                cell.probability, model, work)?;
            total = nonnegative(total + probability)?;
            work.charge(12)?;
            cells.push(SparseCell { probability, ..cell });
        }
    }
    finish(cells, runs, total, work)
}

struct EvidenceCache {
    boundary_turn: u32,
    innovation: InnovationCode,
    values: [Option<f64>; 247],
}

impl EvidenceCache {
    fn new(boundary_turn: u32, innovation: InnovationCode, work: &mut LedgerWork) -> BeliefResult<Self> {
        work.charge(1976 + 32)?;
        Ok(Self { boundary_turn, innovation, values: [None; 247] })
    }

    fn weight<M: MarineOpportunityProvider + ?Sized>(
        &mut self,
        point: AccountingPoint,
        mass: f64,
        model: &NumericalBeliefModel<'_, M>,
        work: &mut LedgerWork,
    ) -> BeliefResult<f64> {
        work.charge(32)?;
        if self.innovation.is_zero() { return Ok(mass); }
        let bands = model.tables().transitions().borrow_material_bands(work)?;
        work.charge(5 * 16 + 32)?;
        let band = bands.partition_point(|start| *start <= point.material) - 1;
        let key = usize::from(point.bank) * 19 + band;
        let likelihood = match self.values[key] {
            Some(value) => value,
            None => {
                let value = model.tables().evidence_likelihood(point, self.boundary_turn, self.innovation, work)?;
                work.charge(32)?;
                self.values[key] = Some(value);
                value
            }
        };
        work.charge(32)?;
        positive(mass * likelihood)
    }
}

fn append_run(runs: &mut Vec<SupportRun>, bank: u8, material: u16, work: &mut LedgerWork) -> BeliefResult<()> {
    work.charge(32)?;
    if let Some(last) = runs.last_mut() {
        if last.bank == bank && last.upper.checked_add(1) == Some(material) {
            last.upper = material;
            return Ok(());
        }
    }
    work.charge(12)?;
    runs.push(SupportRun { bank, lower: material, upper: material });
    Ok(())
}

fn finish(
    mut cells: Vec<SparseCell>,
    runs: Vec<SupportRun>,
    total: f64,
    work: &mut LedgerWork,
) -> BeliefResult<CompactPosterior> {
    work.charge(32)?;
    if runs.is_empty() { return Err(JointAccountingError::EmptySupport.into()); }
    if total == 0.0 { return Err(JointAccountingError::EmptyMass.into()); }
    let mut normalized = 0.0;
    for cell in &mut cells {
        work.charge(32)?;
        cell.probability = positive(cell.probability / total)?;
        normalized = nonnegative(normalized + cell.probability)?;
    }
    work.charge(32)?;
    if (normalized - 1.0).abs() > 1e-12 { return Err(JointAccountingError::NonFinite.into()); }
    CompactPosterior::from_owned(cells, runs, work)
}

fn destination_bank(bank: u8, spend: u8, income: u16) -> BeliefResult<u8> {
    let value = u16::from(bank).checked_sub(u16::from(spend)).and_then(|x| x.checked_add(income))
        .ok_or(JointAccountingError::Domain)?;
    Ok(value.min(u16::from(BANK_CEILING)) as u8)
}

fn nonnegative(value: f64) -> BeliefResult<f64> {
    if !value.is_finite() { return Err(JointAccountingError::NonFinite.into()); }
    if value < 0.0 { return Err(JointAccountingError::Domain.into()); }
    Ok(value)
}

fn positive(value: f64) -> BeliefResult<f64> {
    let value = nonnegative(value)?;
    if value == 0.0 { return Err(JointAccountingError::Underflow.into()); }
    Ok(value)
}
