// SPEC: _spec/packages/training/burn-compat.puml
use crate::accounting_kernel::{AccountingPoint, BANK_CEILING, JOINT_SIZE, MATERIAL_CEILING};
use crate::joint_accounting::{RawAccountingParts, RawJointAccounting};
use crate::ledger::LedgerWork;
use crate::ledger::contracts::{LedgerError, LedgerErrorCode, LedgerRules};
use crate::transition_tables::{
    NumericFitGroup, NumericFitRow, NumericTransitions, TableError, TransitionCohort,
    build_numeric_transitions,
};

const TABLE_COUNT: usize = 794;
const CODE_COUNT: usize = 48;
const MAX_GROUPS: usize = 14400;
const MAX_ROWS: usize = 8192;
const MAX_PROJECTED_ROWS: usize = 14400 * 12;
const MATERIAL_WIDTH: usize = MATERIAL_CEILING as usize + 1;
const ENTRY: u64 = 128;
const BLOCK: u64 = 32;
const ROW: u64 = 64;
const EVIDENCE_FIXED: u64 = 203468;
const FINAL_MOVE: u64 = 1588;
const FULL_COUNTS: u64 = 32 * 48;
const WEIGHT_SCAN: u64 = 32 * JOINT_SIZE as u64;
const CACHE_INITIALIZATION: u64 = 1976;

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct InnovationCode {
    bins: [u8; 3],
}

impl InnovationCode {
    pub fn from_bins(bins: [u8; 3], work: &mut LedgerWork) -> EvidenceResult<Self> {
        charge(work, ENTRY)?;
        charge(work, BLOCK)?;
        let code = Self { bins };
        code_index(code)?;
        Ok(code)
    }
    pub fn bins(&self) -> [u8; 3] {
        self.bins
    }
    pub fn is_zero(&self) -> bool {
        self.bins == [0; 3]
    }
}

#[derive(Clone, Copy, Debug)]
pub struct NumericEconomicFitRow {
    pub transition: NumericFitRow,
    pub destination: AccountingPoint,
    pub boundary_turn: u32,
    pub innovation: InnovationCode,
}

#[derive(Clone, Copy, Debug)]
pub struct NumericEconomicFitGroup<'a> {
    pub slot: u16,
    pub selected_rows: &'a [NumericEconomicFitRow],
}

pub struct NumericEvidenceTable {
    cohort: TransitionCohort,
    groups: u16,
    counts: [f64; CODE_COUNT],
    occupied: u8,
}

impl std::fmt::Debug for NumericEvidenceTable {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("NumericEvidenceTable")
            .field("cohort", &self.cohort)
            .field("groups", &self.groups)
            .field("occupied", &self.occupied)
            .finish_non_exhaustive()
    }
}

impl NumericEvidenceTable {
    pub fn cohort(&self) -> TransitionCohort {
        self.cohort
    }
    pub fn groups(&self) -> u16 {
        self.groups
    }
    pub fn counts(&self) -> &[f64; 48] {
        &self.counts
    }
    pub fn occupied_rows(&self) -> u8 {
        self.occupied
    }
}

pub struct NumericEconomicTables {
    transitions: NumericTransitions,
    evidence: Vec<NumericEvidenceTable>,
    occupied: usize,
}

impl std::fmt::Debug for NumericEconomicTables {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("NumericEconomicTables")
            .field("occupied", &self.occupied)
            .finish_non_exhaustive()
    }
}

impl NumericEconomicTables {
    pub fn transitions(&self) -> &NumericTransitions {
        &self.transitions
    }
    pub fn evidence_tables(&self) -> &[NumericEvidenceTable] {
        &self.evidence
    }
    pub fn occupied_sparse_rows(&self) -> usize {
        self.occupied
    }

    pub fn evidence_likelihood(
        &self,
        destination: AccountingPoint,
        boundary_turn: u32,
        innovation: InnovationCode,
        work: &mut LedgerWork,
    ) -> EvidenceResult<f64> {
        charge(work, ENTRY)?;
        charge(work, BLOCK)?;
        validate_point(destination)?;
        let code = validate_turn_code(boundary_turn, innovation)?;
        let profile = self
            .transitions
            .borrow_numeric_profile(work)
            .map_err(EvidenceError::Table)?;
        charge(work, BLOCK)?;
        validate_profile_turn(profile, boundary_turn)?;
        if innovation.is_zero() {
            return Ok(1.0);
        }
        let path = self
            .transitions
            .numeric_cohort_path(destination, boundary_turn, work)
            .map_err(EvidenceError::Table)?;
        let mut selected = None;
        for (level, index) in path.into_iter().enumerate() {
            charge(work, BLOCK)?;
            let table = self.evidence.get(index).ok_or(EvidenceError::Domain)?;
            if table.groups >= 32 || level == 3 {
                selected = Some(table);
                break;
            }
        }
        let table = selected.ok_or(EvidenceError::Domain)?;
        charge(work, FULL_COUNTS)?;
        let mut total = 0.0;
        for count in &table.counts {
            total = finite(total + nonnegative(*count)?)?;
        }
        charge(work, BLOCK)?;
        let numerator = positive(table.counts[code] + 0.5)?;
        let denominator = positive(total + 24.0)?;
        let likelihood = positive(numerator / denominator)?;
        Ok(likelihood)
    }
}

pub struct EvidenceWeightedAccounting {
    masses: Vec<f64>,
    accounting_cells: Vec<bool>,
    retained_mass: f64,
}

impl std::fmt::Debug for EvidenceWeightedAccounting {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("EvidenceWeightedAccounting")
            .field("retained_mass", &self.retained_mass)
            .finish_non_exhaustive()
    }
}

impl EvidenceWeightedAccounting {
    pub fn masses(&self) -> &[f64] {
        &self.masses
    }
    pub fn accounting_cells(&self) -> &[bool] {
        &self.accounting_cells
    }
    pub fn retained_mass(&self) -> f64 {
        self.retained_mass
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum EvidenceError {
    Domain,
    Order,
    Capacity,
    NonFinite,
    Underflow,
    EmptyMass,
    Table(TableError),
    Work(LedgerError),
}

pub type EvidenceResult<T> = Result<T, EvidenceError>;

pub fn build_numeric_economic_tables(
    rules: &LedgerRules,
    final_node_count: u8,
    groups: &[NumericEconomicFitGroup<'_>],
    work: &mut LedgerWork,
) -> EvidenceResult<NumericEconomicTables> {
    charge(work, ENTRY)?;
    charge(work, BLOCK)?;
    if !(3..=12).contains(&final_node_count) || groups.len() > MAX_GROUPS {
        return Err(EvidenceError::Domain);
    }
    let row_count = preflight(final_node_count, groups, work)?;
    charge(work, BLOCK)?;
    let transitions = project_transitions(rules, final_node_count, groups, row_count, work)?;
    let transition_occupied = transitions
        .occupied_sparse_rows(work)
        .map_err(EvidenceError::Table)?;
    let profile = transitions
        .borrow_numeric_profile(work)
        .map_err(EvidenceError::Table)?;
    let mut builder = EvidenceBuilder::new(transition_occupied, work)?;
    for group in groups {
        charge(work, BLOCK)?;
        if group.selected_rows.is_empty() {
            continue;
        }
        charge(work, BLOCK)?;
        let weight = positive(1.0 / group.selected_rows.len() as f64)?;
        let mut previous_node = None;
        for row in group.selected_rows {
            charge(work, ROW)?;
            validate_compound(row, final_node_count)?;
            if previous_node.is_some_and(|previous| row.transition.node_index <= previous) {
                return Err(EvidenceError::Order);
            }
            previous_node = Some(row.transition.node_index);
            charge(work, BLOCK)?;
            let income = profile
                .income_at(row.boundary_turn)
                .map_err(|_| EvidenceError::Domain)?;
            charge(work, BLOCK)?;
            validate_destination_equation(row, income)?;
            charge(work, BLOCK)?;
            let code = code_index(row.innovation)?;
            let path = transitions
                .numeric_cohort_path(row.destination, row.boundary_turn, work)
                .map_err(EvidenceError::Table)?;
            for index in path {
                builder.contribute(index, code, weight, group.slot, work)?;
            }
        }
    }
    builder.validate_final(work)?;
    charge(work, FINAL_MOVE)?;
    Ok(NumericEconomicTables {
        transitions,
        evidence: builder.tables,
        occupied: builder.combined_occupied,
    })
}

fn preflight(
    final_node_count: u8,
    groups: &[NumericEconomicFitGroup<'_>],
    work: &mut LedgerWork,
) -> EvidenceResult<usize> {
    let mut total = 0_usize;
    let mut previous_slot = None;
    for group in groups {
        charge(work, BLOCK)?;
        if usize::from(group.slot) >= MAX_GROUPS
            || group.selected_rows.len() > usize::from(final_node_count)
        {
            return Err(EvidenceError::Domain);
        }
        if previous_slot.is_some_and(|previous| group.slot <= previous) {
            return Err(EvidenceError::Order);
        }
        previous_slot = Some(group.slot);
        total = total
            .checked_add(group.selected_rows.len())
            .filter(|total| *total <= MAX_PROJECTED_ROWS)
            .ok_or(EvidenceError::Capacity)?;
        charge_count(work, group.selected_rows.len(), ROW)?;
        let mut previous_node = None;
        for row in group.selected_rows {
            validate_compound(row, final_node_count)?;
            if previous_node.is_some_and(|previous| row.transition.node_index <= previous) {
                return Err(EvidenceError::Order);
            }
            previous_node = Some(row.transition.node_index);
        }
    }
    Ok(total)
}

fn project_transitions(
    rules: &LedgerRules,
    final_node_count: u8,
    groups: &[NumericEconomicFitGroup<'_>],
    row_count: usize,
    work: &mut LedgerWork,
) -> EvidenceResult<NumericTransitions> {
    charge(work, linear_invoice(192 + 12, row_count, 4 * 11 + 64)?)?;
    let mut flat = Vec::with_capacity(row_count);
    for group in groups {
        charge(work, BLOCK)?;
        for row in group.selected_rows {
            flat.push(row.transition);
        }
    }
    if flat.len() != row_count {
        return Err(EvidenceError::Domain);
    }
    charge(work, linear_invoice(192 + 12, groups.len(), 4 * 3)?)?;
    let mut projected = Vec::with_capacity(groups.len());
    let mut offset = 0_usize;
    for group in groups {
        charge(work, BLOCK)?;
        let next = offset
            .checked_add(group.selected_rows.len())
            .ok_or(EvidenceError::Domain)?;
        let selected_rows = flat.get(offset..next).ok_or(EvidenceError::Domain)?;
        projected.push(NumericFitGroup {
            slot: group.slot,
            selected_rows,
        });
        offset = next;
    }
    if offset != row_count {
        return Err(EvidenceError::Domain);
    }
    let result = build_numeric_transitions(rules, final_node_count, &projected, work);
    drop(projected);
    drop(flat);
    result.map_err(EvidenceError::Table)
}

struct EvidenceBuilder {
    tables: Vec<NumericEvidenceTable>,
    last_group: [Option<u16>; TABLE_COUNT],
    transition_occupied: usize,
    combined_occupied: usize,
}

impl EvidenceBuilder {
    fn new(transition_occupied: usize, work: &mut LedgerWork) -> EvidenceResult<Self> {
        if transition_occupied > MAX_ROWS {
            return Err(EvidenceError::Capacity);
        }
        charge(work, EVIDENCE_FIXED)?;
        let mut tables = Vec::with_capacity(TABLE_COUNT);
        for index in 0..TABLE_COUNT {
            tables.push(NumericEvidenceTable {
                cohort: cohort_at(index)?,
                groups: 0,
                counts: [0.0; CODE_COUNT],
                occupied: 0,
            });
        }
        Ok(Self {
            tables,
            last_group: [None; TABLE_COUNT],
            transition_occupied,
            combined_occupied: transition_occupied,
        })
    }

    fn contribute(
        &mut self,
        index: usize,
        code: usize,
        weight: f64,
        slot: u16,
        work: &mut LedgerWork,
    ) -> EvidenceResult<()> {
        charge(work, BLOCK)?;
        let table = self.tables.get(index).ok_or(EvidenceError::Domain)?;
        charge(work, BLOCK)?;
        let previous = *table.counts.get(code).ok_or(EvidenceError::Domain)?;
        let new = previous == 0.0;
        if new {
            if self.combined_occupied >= MAX_ROWS {
                return Err(EvidenceError::Capacity);
            }
            charge(work, 64)?;
            charge(work, BLOCK)?;
        }
        charge(work, BLOCK)?;
        charge(work, BLOCK)?;
        let count = positive(previous + weight)?;
        let new_group = self.last_group[index] != Some(slot);
        let groups = if new_group {
            table.groups.checked_add(1).ok_or(EvidenceError::Capacity)?
        } else {
            table.groups
        };
        let occupied = table
            .occupied
            .checked_add(u8::from(new))
            .filter(|value| usize::from(*value) <= CODE_COUNT)
            .ok_or(EvidenceError::Capacity)?;
        let combined = self
            .combined_occupied
            .checked_add(usize::from(new))
            .filter(|value| *value <= MAX_ROWS)
            .ok_or(EvidenceError::Capacity)?;
        self.tables[index].counts[code] = count;
        self.tables[index].groups = groups;
        self.tables[index].occupied = occupied;
        if new_group {
            self.last_group[index] = Some(slot);
        }
        self.combined_occupied = combined;
        Ok(())
    }

    fn validate_final(&self, work: &mut LedgerWork) -> EvidenceResult<()> {
        charge_count(work, TABLE_COUNT, BLOCK)?;
        let mut evidence_occupied = 0_usize;
        for (index, table) in self.tables.iter().enumerate() {
            if table.cohort != cohort_at(index)? || usize::from(table.occupied) > CODE_COUNT {
                return Err(EvidenceError::Domain);
            }
            if table.occupied == 0 {
                if table.groups != 0 || self.last_group[index].is_some() {
                    return Err(EvidenceError::Domain);
                }
            } else {
                if table.groups == 0 || self.last_group[index].is_none() {
                    return Err(EvidenceError::Domain);
                }
                charge(work, FULL_COUNTS)?;
                let mut actual = 0_u8;
                for count in &table.counts {
                    if nonnegative(*count)? > 0.0 {
                        actual = actual.checked_add(1).ok_or(EvidenceError::Capacity)?;
                    }
                }
                if actual != table.occupied {
                    return Err(EvidenceError::Capacity);
                }
            }
            evidence_occupied = evidence_occupied
                .checked_add(usize::from(table.occupied))
                .ok_or(EvidenceError::Capacity)?;
        }
        if self.transition_occupied.checked_add(evidence_occupied) != Some(self.combined_occupied)
            || self.combined_occupied > MAX_ROWS
        {
            return Err(EvidenceError::Capacity);
        }
        Ok(())
    }
}

pub fn weight_evidence(
    raw: RawJointAccounting,
    tables: &NumericEconomicTables,
    boundary_turn: u32,
    innovation: InnovationCode,
    work: &mut LedgerWork,
) -> EvidenceResult<EvidenceWeightedAccounting> {
    charge(work, ENTRY)?;
    charge(work, BLOCK)?;
    validate_turn_code(boundary_turn, innovation)?;
    let profile = tables
        .transitions
        .borrow_numeric_profile(work)
        .map_err(EvidenceError::Table)?;
    charge(work, BLOCK)?;
    validate_profile_turn(profile, boundary_turn)?;
    let mut parts = raw.into_numeric_parts(work).map_err(EvidenceError::Work)?;
    charge(work, BLOCK)?;
    if parts.masses.len() != JOINT_SIZE || parts.accounting_cells.len() != JOINT_SIZE {
        return Err(EvidenceError::Domain);
    }
    positive(parts.retained_mass)?;
    let retained_mass = if innovation.is_zero() {
        charge(work, WEIGHT_SCAN)?;
        let mut retained = 0.0;
        for (mass, supported) in parts.masses.iter().zip(&parts.accounting_cells) {
            let mass = nonnegative(*mass)?;
            if mass > 0.0 && !supported {
                return Err(EvidenceError::Domain);
            }
            retained = finite(retained + mass)?;
        }
        retained
    } else {
        weight_nonzero(&mut parts, tables, boundary_turn, innovation, work)?
    };
    charge(work, BLOCK)?;
    if retained_mass == 0.0 {
        return Err(EvidenceError::EmptyMass);
    }
    positive(retained_mass)?;
    charge(work, 28)?;
    Ok(EvidenceWeightedAccounting {
        masses: parts.masses,
        accounting_cells: parts.accounting_cells,
        retained_mass,
    })
}

fn weight_nonzero(
    parts: &mut RawAccountingParts,
    tables: &NumericEconomicTables,
    boundary_turn: u32,
    innovation: InnovationCode,
    work: &mut LedgerWork,
) -> EvidenceResult<f64> {
    let bands = tables
        .transitions
        .borrow_material_bands(work)
        .map_err(EvidenceError::Table)?;
    charge(work, CACHE_INITIALIZATION)?;
    let mut cache: [Option<f64>; 247] = [None; 247];
    charge(work, WEIGHT_SCAN)?;
    let mut retained = 0.0;
    for bank in 0..=BANK_CEILING {
        charge(work, BLOCK)?;
        let mut band = 0_usize;
        for material in 0..=MATERIAL_CEILING {
            if let Some(next) = bands.get(band.checked_add(1).ok_or(EvidenceError::Domain)?)
                && material >= *next
            {
                charge(work, BLOCK)?;
                band = band.checked_add(1).ok_or(EvidenceError::Domain)?;
            }
            let index = usize::from(bank)
                .checked_mul(MATERIAL_WIDTH)
                .and_then(|value| value.checked_add(usize::from(material)))
                .filter(|index| *index < JOINT_SIZE)
                .ok_or(EvidenceError::Domain)?;
            let mass = nonnegative(parts.masses[index])?;
            if mass > 0.0 {
                if !parts.accounting_cells[index] {
                    return Err(EvidenceError::Domain);
                }
                charge(work, BLOCK)?;
                let key = usize::from(bank)
                    .checked_mul(19)
                    .and_then(|value| value.checked_add(band))
                    .filter(|index| *index < 247)
                    .ok_or(EvidenceError::Domain)?;
                let likelihood = match cache[key] {
                    Some(value) => value,
                    None => {
                        let value = tables.evidence_likelihood(
                            AccountingPoint { material, bank },
                            boundary_turn,
                            innovation,
                            work,
                        )?;
                        charge(work, BLOCK)?;
                        cache[key] = Some(value);
                        value
                    }
                };
                charge(work, BLOCK)?;
                let weighted = finite(mass * likelihood)?;
                if weighted == 0.0 {
                    return Err(EvidenceError::Underflow);
                }
                if weighted < 0.0 {
                    return Err(EvidenceError::Domain);
                }
                parts.masses[index] = weighted;
            }
            retained = finite(retained + parts.masses[index])?;
        }
    }
    Ok(retained)
}

fn validate_compound(row: &NumericEconomicFitRow, final_node_count: u8) -> EvidenceResult<()> {
    if row.transition.node_index >= final_node_count {
        return Err(EvidenceError::Domain);
    }
    validate_point(row.destination)?;
    validate_turn_code(row.boundary_turn, row.innovation)?;
    Ok(())
}

fn validate_destination_equation(row: &NumericEconomicFitRow, income: u32) -> EvidenceResult<()> {
    let outcome = row.transition.outcome;
    let material = row
        .transition
        .source
        .material
        .checked_add(u16::from(outcome.created))
        .and_then(|value| value.checked_add(u16::from(outcome.growth)))
        .and_then(|value| value.checked_sub(outcome.destroyed))
        .ok_or(EvidenceError::Domain)?;
    let bank = u32::from(row.transition.source.bank)
        .checked_sub(u32::from(outcome.spend))
        .and_then(|value| value.checked_add(income))
        .ok_or(EvidenceError::Domain)?
        .min(u32::from(BANK_CEILING));
    if material != row.destination.material || bank != u32::from(row.destination.bank) {
        return Err(EvidenceError::Domain);
    }
    Ok(())
}

fn validate_point(point: AccountingPoint) -> EvidenceResult<()> {
    if point.material > MATERIAL_CEILING || point.bank > BANK_CEILING {
        Err(EvidenceError::Domain)
    } else {
        Ok(())
    }
}

fn validate_turn_code(turn: u32, code: InnovationCode) -> EvidenceResult<usize> {
    if turn > 45 {
        return Err(EvidenceError::Domain);
    }
    code_index(code)
}

fn validate_profile_turn(profile: &LedgerRules, turn: u32) -> EvidenceResult<()> {
    if turn > profile.max_turn {
        Err(EvidenceError::Domain)
    } else {
        Ok(())
    }
}

fn code_index(code: InnovationCode) -> EvidenceResult<usize> {
    if code.bins[0] > 3 || code.bins[1] > 3 || code.bins[2] > 2 {
        return Err(EvidenceError::Domain);
    }
    usize::from(code.bins[0])
        .checked_mul(4)
        .and_then(|value| value.checked_add(usize::from(code.bins[1])))
        .and_then(|value| value.checked_mul(3))
        .and_then(|value| value.checked_add(usize::from(code.bins[2])))
        .filter(|value| *value < CODE_COUNT)
        .ok_or(EvidenceError::Domain)
}

fn cohort_at(index: usize) -> EvidenceResult<TransitionCohort> {
    let byte = |value| u8::try_from(value).map_err(|_| EvidenceError::Domain);
    match index {
        0..=740 => Ok(TransitionCohort::BankBandTier {
            bank: byte(index / 57)?,
            band: byte((index % 57) / 3)?,
            tier: byte(index % 3)?,
        }),
        741..=779 => {
            let offset = index.checked_sub(741).ok_or(EvidenceError::Domain)?;
            Ok(TransitionCohort::BankTier {
                bank: byte(offset / 3)?,
                tier: byte(offset % 3)?,
            })
        }
        780..=792 => Ok(TransitionCohort::Bank {
            bank: byte(index.checked_sub(780).ok_or(EvidenceError::Domain)?)?,
        }),
        793 => Ok(TransitionCohort::Global),
        _ => Err(EvidenceError::Domain),
    }
}

fn finite(value: f64) -> EvidenceResult<f64> {
    if value.is_finite() {
        Ok(value)
    } else {
        Err(EvidenceError::NonFinite)
    }
}
fn nonnegative(value: f64) -> EvidenceResult<f64> {
    let value = finite(value)?;
    if value < 0.0 {
        Err(EvidenceError::Domain)
    } else {
        Ok(value)
    }
}
fn positive(value: f64) -> EvidenceResult<f64> {
    let value = finite(value)?;
    if value > 0.0 {
        Ok(value)
    } else {
        Err(EvidenceError::NonFinite)
    }
}
fn charge(work: &mut LedgerWork, amount: u64) -> EvidenceResult<()> {
    work.charge(amount).map_err(EvidenceError::Work)
}
fn linear_invoice(base: u64, count: usize, rate: u64) -> EvidenceResult<u64> {
    u64::try_from(count)
        .ok()
        .and_then(|count| count.checked_mul(rate))
        .and_then(|value| value.checked_add(base))
        .ok_or_else(|| {
            EvidenceError::Work(LedgerError::new(
                LedgerErrorCode::Budget,
                "Evidence invoice overflow",
            ))
        })
}
fn charge_count(work: &mut LedgerWork, count: usize, rate: u64) -> EvidenceResult<()> {
    charge(work, linear_invoice(0, count, rate)?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shared_ceiling_allows_found_updates_and_refuses_new_cell_before_any_creation_mutation() {
        let mut builder = EvidenceBuilder::new(8191, &mut LedgerWork::new()).unwrap();
        let mut exact = LedgerWork::with_limit(224).unwrap();
        builder.contribute(793, 1, 1.0, 0, &mut exact).unwrap();
        assert_eq!(exact.used(), 224);
        assert_eq!(builder.combined_occupied, 8192);
        assert_eq!(
            (builder.tables[793].occupied, builder.tables[793].groups),
            (1, 1)
        );
        let mut found = LedgerWork::with_limit(128).unwrap();
        builder.contribute(793, 1, 0.25, 0, &mut found).unwrap();
        assert_eq!(found.used(), 128);
        assert_eq!(builder.tables[793].counts[1], 1.25);
        assert_eq!(
            (builder.tables[793].groups, builder.combined_occupied),
            (1, 8192)
        );
        let mut refused = LedgerWork::with_limit(64).unwrap();
        assert_eq!(
            builder
                .contribute(793, 2, 1.0, 1, &mut refused)
                .unwrap_err(),
            EvidenceError::Capacity
        );
        assert_eq!(refused.used(), 64);
        assert_eq!(builder.tables[793].counts[2], 0.0);
        assert_eq!(builder.tables[793].groups, 1);
        assert_eq!(builder.combined_occupied, 8192);
        let mut found_new_slot = LedgerWork::with_limit(128).unwrap();
        builder
            .contribute(793, 1, 0.25, 1, &mut found_new_slot)
            .unwrap();
        assert_eq!(builder.tables[793].groups, 2);
        assert_eq!(builder.combined_occupied, 8192);
        builder.validate_final(&mut LedgerWork::new()).unwrap();
    }

    #[test]
    fn creation_and_found_updates_reserve_qualification_before_counts_groups_or_occupancy_change() {
        let mut builder = EvidenceBuilder::new(8191, &mut LedgerWork::new()).unwrap();
        let mut short = LedgerWork::with_limit(223).unwrap();
        assert!(
            matches!(builder.contribute(793, 1, 1.0 / 3.0, 0, &mut short), Err(EvidenceError::Work(ref error)) if error.code == LedgerErrorCode::Budget)
        );
        assert_eq!(short.used(), 192);
        assert_eq!(
            (
                builder.tables[793].counts[1],
                builder.tables[793].groups,
                builder.tables[793].occupied
            ),
            (0.0, 0, 0)
        );
        assert_eq!(builder.combined_occupied, 8191);
        assert!(builder.last_group[793].is_none());
        builder
            .contribute(793, 1, 1.0 / 3.0, 0, &mut LedgerWork::new())
            .unwrap();
        let bits = builder.tables[793].counts[1].to_bits();
        let mut short = LedgerWork::with_limit(127).unwrap();
        assert!(
            matches!(builder.contribute(793, 1, 1.0 / 3.0, 1, &mut short), Err(EvidenceError::Work(ref error)) if error.code == LedgerErrorCode::Budget)
        );
        assert_eq!(short.used(), 96);
        assert_eq!(builder.tables[793].counts[1].to_bits(), bits);
        assert_eq!(
            (builder.tables[793].groups, builder.tables[793].occupied),
            (1, 1)
        );
        assert_eq!(builder.last_group[793], Some(0));
        assert_eq!(builder.combined_occupied, 8192);
    }

    #[test]
    fn untouched_zero_tables_use_metadata_only_but_populated_tables_prepay_all_48_counts() {
        let mut builder = EvidenceBuilder::new(0, &mut LedgerWork::new()).unwrap();
        assert!(
            builder
                .tables
                .iter()
                .all(|table| table.counts.iter().all(|count| count.to_bits() == 0))
        );
        let mut empty_work = LedgerWork::with_limit(32 * 794).unwrap();
        builder.validate_final(&mut empty_work).unwrap();
        assert_eq!(empty_work.used(), 32 * 794);
        builder
            .contribute(793, 0, 1.0, 0, &mut LedgerWork::new())
            .unwrap();
        let mut exact = LedgerWork::with_limit(32 * 794 + 1536).unwrap();
        builder.validate_final(&mut exact).unwrap();
        assert_eq!(exact.used(), 32 * 794 + 1536);
        builder.tables[793].counts[0] = f64::NAN;
        let mut short = LedgerWork::with_limit(32 * 794 + 1535).unwrap();
        assert!(
            matches!(builder.validate_final(&mut short), Err(EvidenceError::Work(ref error)) if error.code == LedgerErrorCode::Budget)
        );
        assert_eq!(short.used(), 32 * 794);
        let mut exact = LedgerWork::with_limit(32 * 794 + 1536).unwrap();
        assert_eq!(
            builder.validate_final(&mut exact).unwrap_err(),
            EvidenceError::NonFinite
        );
        assert_eq!(exact.used(), 32 * 794 + 1536);
    }
}
