// SPEC: _spec/packages/training/burn-compat.puml
use std::cmp::Ordering;

use crate::accounting_kernel::{
    AccountingError, AccountingPoint, BANK_CEILING, MATERIAL_CEILING, NumericTransitionRow,
    growth_support,
};
use crate::ledger::LedgerWork;
use crate::ledger::contracts::{LedgerError, LedgerErrorCode, LedgerRules, UnitCosts};

const TABLE_COUNT: usize = 794;
const GLOBAL_INDEX: usize = 793;
const MAX_GROUPS: usize = 14400;
const MAX_ROWS: usize = 8192;
const MAX_PAID_SLOTS: usize = 16384;
const MAX_TEMPORARY_OLD: usize = 4096;
const MAX_LIVE_SLOTS: usize = 20480;
const BANDS: [u16; 19] = [
    0, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512,
];
const SPENDS: [u8; 5] = [0, 1, 3, 5, 9];
const ENTRY: u64 = 128;
const PARAMETER: u64 = 32;
const FIXED_TABLES: u64 = 60548;
const GROWTH_INITIALIZATION: u64 = 1492;
const GROWTH_SUMMARY: u64 = 8 * 33;
const FINAL_FIXED: u64 = 1572;
const ROW_VALIDATION: u64 = 64;
const INTERVAL: u64 = 128;
const INDEX: u64 = 32;
const SEARCH: u64 = 14 * 16;
const GROUP_HEADER: u64 = 32;
const GROUP_WEIGHT: u64 = 32;
const COUNT_UPDATE: u64 = 32;
const QUALIFICATION: u64 = 32;
const QUERY_ROW: u64 = 32;

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct NumericOutcome {
    pub spend: u8,
    pub created: u8,
    pub wasted: u8,
    pub growth: u8,
    pub destroyed: u16,
}

#[derive(Clone, Copy, Debug)]
pub struct NumericFitRow {
    pub node_index: u8,
    pub source: AccountingPoint,
    pub input_turn: u32,
    pub visible_before: u16,
    pub marines_before: u8,
    pub outcome: NumericOutcome,
}

#[derive(Clone, Copy, Debug)]
pub struct NumericFitGroup<'a> {
    pub slot: u16,
    pub selected_rows: &'a [NumericFitRow],
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TransitionCohort {
    BankBandTier { bank: u8, band: u8, tier: u8 },
    BankTier { bank: u8, tier: u8 },
    Bank { bank: u8 },
    Global,
}

pub struct NumericTransitionTable {
    cohort: TransitionCohort,
    groups: u16,
    rows: Vec<NumericTransitionRow>,
    reserved_slots: usize,
}

impl std::fmt::Debug for NumericTransitionTable {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("NumericTransitionTable")
            .field("cohort", &self.cohort)
            .field("groups", &self.groups)
            .field("rows", &self.rows.len())
            .finish_non_exhaustive()
    }
}

impl NumericTransitionTable {
    pub fn cohort(&self) -> TransitionCohort {
        self.cohort
    }
    pub fn groups(&self) -> u16 {
        self.groups
    }
    pub fn rows(&self) -> &[NumericTransitionRow] {
        &self.rows
    }
}

pub struct NumericTransitions {
    tables: Vec<NumericTransitionTable>,
    profile: LedgerRules,
    growth: GrowthMetadata,
}

impl std::fmt::Debug for NumericTransitions {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("NumericTransitions")
            .field("tables", &self.tables.len())
            .finish_non_exhaustive()
    }
}

#[derive(Clone, Copy, Debug)]
pub struct NumericSourceContext {
    pub input_turn: u32,
    pub visible_before: u16,
    pub marines_before: u8,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct SourceTerms {
    pub cohort: TransitionCohort,
    pub feasible_tuple_count: u32,
    pub fitted_count_sum: f64,
    pub denominator: f64,
}

pub(crate) struct NumericAccountingSource {
    checked: CheckedSource,
    context: NumericSourceContext,
}

pub(crate) struct PreparedNumericSource<'a> {
    terms: SourceTerms,
    source: NumericAccountingSource,
    table: &'a NumericTransitionTable,
    growth: &'a GrowthMetadata,
}

#[derive(Debug, PartialEq, Eq)]
pub enum TableError {
    Domain,
    Order,
    InfeasibleSource,
    Capacity,
    NonFinite,
    Work(LedgerError),
}

pub type TableResult<T> = Result<T, TableError>;

pub fn build_numeric_transitions(
    rules: &LedgerRules,
    final_node_count: u8,
    groups: &[NumericFitGroup<'_>],
    work: &mut LedgerWork,
) -> TableResult<NumericTransitions> {
    charge(work, ENTRY)?;
    charge(work, PARAMETER)?;
    if !(3..=12).contains(&final_node_count) || groups.len() > MAX_GROUPS {
        return Err(TableError::Domain);
    }
    rules.validate(work).map_err(TableError::Work)?;
    let profile = copy_profile(rules, work)?;
    let mut builder = TableBuilder::new(work)?;
    let growth = GrowthMetadata::new(work)?;
    let mut previous_slot = None;
    for group in groups {
        charge(work, GROUP_HEADER)?;
        if usize::from(group.slot) >= MAX_GROUPS
            || group.selected_rows.len() > usize::from(final_node_count)
        {
            return Err(TableError::Domain);
        }
        if previous_slot.is_some_and(|previous| group.slot <= previous) {
            return Err(TableError::Order);
        }
        previous_slot = Some(group.slot);
        if group.selected_rows.is_empty() {
            continue;
        }
        charge(work, GROUP_WEIGHT)?;
        let weight = positive(1.0 / group.selected_rows.len() as f64)?;
        let mut previous_node = None;
        for row in group.selected_rows {
            charge(work, ROW_VALIDATION)?;
            if row.node_index >= final_node_count {
                return Err(TableError::Domain);
            }
            if previous_node.is_some_and(|previous| row.node_index <= previous) {
                return Err(TableError::Order);
            }
            previous_node = Some(row.node_index);
            validate_outcome(row.outcome)?;
            let context = NumericSourceContext {
                input_turn: row.input_turn,
                visible_before: row.visible_before,
                marines_before: row.marines_before,
            };
            let source = checked_source(&profile, row.source, &context, work)?;
            let interval = source_interval(
                row.outcome,
                source,
                &context,
                Some(source.bounds),
                &growth,
                work,
            )?;
            if !interval.is_some_and(|(lower, upper)| {
                row.source.material >= lower && row.source.material <= upper
            }) {
                return Err(TableError::InfeasibleSource);
            }
            for level in 0..4 {
                builder.contribute(source.cohort(level)?, row.outcome, weight, group.slot, work)?;
            }
        }
    }
    builder.validate_final(work)?;
    Ok(NumericTransitions {
        tables: builder.tables,
        profile,
        growth,
    })
}

impl NumericTransitions {
    pub fn tables(&self) -> &[NumericTransitionTable] {
        &self.tables
    }

    pub fn select(
        &self,
        source: AccountingPoint,
        input_turn: u32,
        work: &mut LedgerWork,
    ) -> TableResult<&NumericTransitionTable> {
        charge(work, ENTRY)?;
        let context = NumericSourceContext {
            input_turn,
            visible_before: 0,
            marines_before: 0,
        };
        let source = checked_source(&self.profile, source, &context, work)?;
        self.select_checked(source, work)
    }

    pub fn source_terms(
        &self,
        point: AccountingPoint,
        context: &NumericSourceContext,
        work: &mut LedgerWork,
    ) -> TableResult<SourceTerms> {
        charge(work, ENTRY)?;
        let source = checked_source(&self.profile, point, context, work)?;
        let table = self.select_checked(source, work)?;
        let feasible_tuple_count = self.growth.tuple_count(source, context, work)?;
        let band = match table.cohort {
            TransitionCohort::BankBandTier { .. } => Some(source.bounds),
            _ => None,
        };
        charge_count(work, table.rows.len(), QUERY_ROW)?;
        let mut fitted_count_sum = 0.0;
        for row in &table.rows {
            positive(row.count)?;
            if source_interval(outcome_of(row), source, context, band, &self.growth, work)?
                .is_some_and(|(lower, upper)| point.material >= lower && point.material <= upper)
            {
                fitted_count_sum = finite(fitted_count_sum + row.count)?;
            }
        }
        let pseudocount = positive(0.5 * f64::from(feasible_tuple_count))?;
        let denominator = positive(fitted_count_sum + pseudocount)?;
        Ok(SourceTerms {
            cohort: table.cohort,
            feasible_tuple_count,
            fitted_count_sum,
            denominator,
        })
    }

    pub(crate) fn borrow_numeric_profile(
        &self,
        work: &mut LedgerWork,
    ) -> TableResult<&LedgerRules> {
        charge(work, PARAMETER)?;
        Ok(&self.profile)
    }

    pub(crate) fn borrow_growth_minimums(&self, work: &mut LedgerWork) -> TableResult<&[u8; 33]> {
        charge(work, PARAMETER)?;
        Ok(&self.growth.minimum_opportunities)
    }

    pub(crate) fn accounting_source(
        &self,
        point: AccountingPoint,
        context: &NumericSourceContext,
        work: &mut LedgerWork,
    ) -> TableResult<NumericAccountingSource> {
        let checked = checked_source(&self.profile, point, context, work)?;
        charge(work, PARAMETER)?;
        Ok(NumericAccountingSource {
            checked,
            context: *context,
        })
    }

    pub(crate) fn prepare_aggregation_source<'a>(
        &'a self,
        point: AccountingPoint,
        context: &NumericSourceContext,
        work: &mut LedgerWork,
    ) -> TableResult<PreparedNumericSource<'a>> {
        let terms = self.source_terms(point, context, work)?;
        let source = self.accounting_source(point, context, work)?;
        charge(work, INDEX)?;
        let table = self
            .tables
            .get(cohort_index(terms.cohort)?)
            .ok_or(TableError::Domain)?;
        charge(work, PARAMETER)?;
        Ok(PreparedNumericSource {
            terms,
            source,
            table,
            growth: &self.growth,
        })
    }

    fn select_checked(
        &self,
        source: CheckedSource,
        work: &mut LedgerWork,
    ) -> TableResult<&NumericTransitionTable> {
        for level in 0..4 {
            charge(work, INDEX)?;
            let index = cohort_index(source.cohort(level)?)?;
            let table = self.tables.get(index).ok_or(TableError::Domain)?;
            if level == 3 || table.groups >= 32 {
                return Ok(table);
            }
        }
        Err(TableError::Domain)
    }
}

impl NumericAccountingSource {
    pub(crate) fn point(&self) -> AccountingPoint {
        self.checked.point
    }

    pub(crate) fn opportunities(
        &self,
        spend: u8,
        created: u8,
        work: &mut LedgerWork,
    ) -> TableResult<usize> {
        charge(work, PARAMETER)?;
        if !SPENDS.contains(&spend)
            || spend > self.checked.point.bank
            || (created != 0 && created != spend)
        {
            return Err(TableError::Domain);
        }
        opportunities_prepaid(self.checked, &self.context, spend, created)
    }
}

impl PreparedNumericSource<'_> {
    pub(crate) fn terms(&self) -> SourceTerms {
        self.terms
    }
    pub(crate) fn accounting(&self) -> &NumericAccountingSource {
        &self.source
    }
    pub(crate) fn rows(&self) -> &[NumericTransitionRow] {
        &self.table.rows
    }

    pub(crate) fn row_feasible(
        &self,
        row_index: usize,
        work: &mut LedgerWork,
    ) -> TableResult<bool> {
        charge(work, INDEX)?;
        let row = self.table.rows.get(row_index).ok_or(TableError::Domain)?;
        let band = match self.table.cohort {
            TransitionCohort::BankBandTier { .. } => Some(self.source.checked.bounds),
            _ => None,
        };
        Ok(source_interval(
            outcome_of(row),
            self.source.checked,
            &self.source.context,
            band,
            self.growth,
            work,
        )?
        .is_some_and(|(lower, upper)| {
            self.source.checked.point.material >= lower
                && self.source.checked.point.material <= upper
        }))
    }
}

struct GrowthMetadata {
    minimum_opportunities: [u8; 33],
    cardinality_prefix: [[u8; 34]; 5],
    growth_sum_prefix: [[u16; 34]; 5],
}

impl GrowthMetadata {
    fn new(work: &mut LedgerWork) -> TableResult<Self> {
        charge(work, GROWTH_INITIALIZATION)?;
        let mut metadata = Self {
            minimum_opportunities: [5; 33],
            cardinality_prefix: [[0; 34]; 5],
            growth_sum_prefix: [[0; 34]; 5],
        };
        for opportunities in 0_u8..=4 {
            let mask = growth_support(opportunities, work).map_err(accounting_error)?;
            charge(work, GROWTH_SUMMARY)?;
            let layer = usize::from(opportunities);
            for (growth, possible) in mask.into_iter().enumerate() {
                let next = growth.checked_add(1).ok_or(TableError::Domain)?;
                if possible && metadata.minimum_opportunities[growth] > opportunities {
                    metadata.minimum_opportunities[growth] = opportunities;
                }
                metadata.cardinality_prefix[layer][next] = metadata.cardinality_prefix[layer]
                    [growth]
                    .checked_add(u8::from(possible))
                    .ok_or(TableError::Domain)?;
                let increment = if possible {
                    u16::try_from(growth).map_err(|_| TableError::Domain)?
                } else {
                    0
                };
                metadata.growth_sum_prefix[layer][next] = metadata.growth_sum_prefix[layer][growth]
                    .checked_add(increment)
                    .ok_or(TableError::Domain)?;
            }
        }
        Ok(metadata)
    }

    fn minimum(&self, growth: u8, work: &mut LedgerWork) -> TableResult<u8> {
        charge(work, PARAMETER)?;
        self.minimum_opportunities
            .get(usize::from(growth))
            .copied()
            .ok_or(TableError::Domain)
    }

    fn prefix(
        &self,
        opportunities: usize,
        split: usize,
        work: &mut LedgerWork,
    ) -> TableResult<(u32, u32, u32)> {
        charge(work, PARAMETER)?;
        let cardinality = self
            .cardinality_prefix
            .get(opportunities)
            .ok_or(TableError::Domain)?;
        let sums = self
            .growth_sum_prefix
            .get(opportunities)
            .ok_or(TableError::Domain)?;
        Ok((
            u32::from(*cardinality.get(split).ok_or(TableError::Domain)?),
            u32::from(*sums.get(split).ok_or(TableError::Domain)?),
            u32::from(cardinality[33]),
        ))
    }

    fn tuple_count(
        &self,
        source: CheckedSource,
        context: &NumericSourceContext,
        work: &mut LedgerWork,
    ) -> TableResult<u32> {
        let mut total = 0_u32;
        for &spend in &SPENDS {
            if spend > source.point.bank {
                continue;
            }
            for choice in 0..if spend == 0 { 1 } else { 2 } {
                charge(work, PARAMETER)?;
                let created = if choice == 0 { 0 } else { spend };
                let opportunities = opportunities_prepaid(source, context, spend, created)?;
                let initial = source
                    .point
                    .material
                    .checked_add(u16::from(created))
                    .ok_or(TableError::Domain)?;
                let split = match MATERIAL_CEILING.checked_sub(initial) {
                    Some(limit) => usize::from(limit.min(32))
                        .checked_add(1)
                        .ok_or(TableError::Domain)?,
                    None => 0,
                };
                let (low_count, low_sum, all_count) = self.prefix(opportunities, split, work)?;
                let low = low_count
                    .checked_mul(
                        u32::from(initial)
                            .checked_add(1)
                            .ok_or(TableError::Domain)?,
                    )
                    .and_then(|value| value.checked_add(low_sum))
                    .ok_or(TableError::Domain)?;
                let high = all_count
                    .checked_sub(low_count)
                    .and_then(|count| {
                        count.checked_mul(u32::from(MATERIAL_CEILING).checked_add(1)?)
                    })
                    .ok_or(TableError::Domain)?;
                total = total
                    .checked_add(low)
                    .and_then(|value| value.checked_add(high))
                    .ok_or(TableError::Domain)?;
            }
        }
        Ok(total)
    }
}

#[derive(Clone, Copy)]
struct CheckedSource {
    point: AccountingPoint,
    band: u8,
    tier: u8,
    gas: u8,
    bounds: (u16, u16),
}

fn opportunities_prepaid(
    source: CheckedSource,
    context: &NumericSourceContext,
    spend: u8,
    created: u8,
) -> TableResult<usize> {
    let gas = 1_u16
        .checked_add(u16::from(source.gas))
        .and_then(|value| value.checked_sub(u16::from(spend > 0)))
        .ok_or(TableError::Domain)?;
    let candidates = u16::from(context.marines_before)
        .checked_add(source.point.material)
        .and_then(|value| value.checked_sub(context.visible_before))
        .and_then(|value| value.checked_add(u16::from(created == 1)))
        .ok_or(TableError::Domain)?;
    Ok(usize::from(4_u16.min(gas).min(candidates)))
}

impl CheckedSource {
    fn cohort(self, level: usize) -> TableResult<TransitionCohort> {
        match level {
            0 => Ok(TransitionCohort::BankBandTier {
                bank: self.point.bank,
                band: self.band,
                tier: self.tier,
            }),
            1 => Ok(TransitionCohort::BankTier {
                bank: self.point.bank,
                tier: self.tier,
            }),
            2 => Ok(TransitionCohort::Bank {
                bank: self.point.bank,
            }),
            3 => Ok(TransitionCohort::Global),
            _ => Err(TableError::Domain),
        }
    }
}

fn checked_source(
    profile: &LedgerRules,
    point: AccountingPoint,
    context: &NumericSourceContext,
    work: &mut LedgerWork,
) -> TableResult<CheckedSource> {
    charge(work, PARAMETER)?;
    if point.material > MATERIAL_CEILING
        || point.bank > BANK_CEILING
        || context.visible_before > point.material
        || context.marines_before > 64
        || u16::from(context.marines_before) > context.visible_before
    {
        return Err(TableError::Domain);
    }
    let tier = match context.input_turn {
        0..=10 => 0,
        11..=20 => 1,
        21..=45 => 2,
        _ => return Err(TableError::Domain),
    };
    let gas = profile
        .gas_capacity_at(context.input_turn)
        .map_err(|_| TableError::Domain)?;
    let index = BANDS
        .partition_point(|lower| *lower <= point.material)
        .checked_sub(1)
        .ok_or(TableError::Domain)?;
    let lower = BANDS[index];
    let upper = match BANDS.get(index.checked_add(1).ok_or(TableError::Domain)?) {
        Some(next) => next.checked_sub(1).ok_or(TableError::Domain)?,
        None => MATERIAL_CEILING,
    };
    Ok(CheckedSource {
        point,
        band: u8::try_from(index).map_err(|_| TableError::Domain)?,
        tier,
        gas: u8::try_from(gas).map_err(|_| TableError::Domain)?,
        bounds: (lower, upper),
    })
}

fn source_interval(
    outcome: NumericOutcome,
    source: CheckedSource,
    context: &NumericSourceContext,
    band: Option<(u16, u16)>,
    growth: &GrowthMetadata,
    work: &mut LedgerWork,
) -> TableResult<Option<(u16, u16)>> {
    charge(work, INTERVAL)?;
    let minimum = growth.minimum(outcome.growth, work)?;
    let gas = 1_u8
        .checked_add(source.gas)
        .and_then(|value| value.checked_sub(u8::from(outcome.spend > 0)))
        .ok_or(TableError::Domain)?;
    if outcome.spend > source.point.bank || minimum > 4 || minimum > gas {
        return Ok(None);
    }
    let visible = i32::from(context.visible_before);
    let marine_lower = visible
        .checked_sub(i32::from(context.marines_before))
        .and_then(|value| value.checked_sub(i32::from(outcome.created == 1)))
        .and_then(|value| value.checked_add(i32::from(minimum)))
        .ok_or(TableError::Domain)?;
    let destruction_lower = i32::from(outcome.destroyed)
        .checked_sub(i32::from(outcome.created))
        .and_then(|value| value.checked_sub(i32::from(outcome.growth)))
        .ok_or(TableError::Domain)?;
    let destruction_upper = i32::from(MATERIAL_CEILING)
        .checked_add(i32::from(outcome.destroyed))
        .and_then(|value| value.checked_sub(i32::from(outcome.created)))
        .and_then(|value| value.checked_sub(i32::from(outcome.growth)))
        .ok_or(TableError::Domain)?;
    let mut lower = 0.max(visible).max(marine_lower).max(destruction_lower);
    let mut upper = i32::from(MATERIAL_CEILING).min(destruction_upper);
    if let Some((band_lower, band_upper)) = band {
        lower = lower.max(i32::from(band_lower));
        upper = upper.min(i32::from(band_upper));
    }
    if lower > upper {
        return Ok(None);
    }
    Ok(Some((
        u16::try_from(lower).map_err(|_| TableError::Domain)?,
        u16::try_from(upper).map_err(|_| TableError::Domain)?,
    )))
}

struct TableBuilder {
    tables: Vec<NumericTransitionTable>,
    last_group: [Option<u16>; TABLE_COUNT],
    occupied_rows: usize,
    paid_slots: usize,
    #[cfg(test)]
    peak_live_slots: usize,
    #[cfg(test)]
    maximum_old_slots: usize,
}

impl TableBuilder {
    fn new(work: &mut LedgerWork) -> TableResult<Self> {
        charge(work, FIXED_TABLES)?;
        let mut tables = Vec::with_capacity(TABLE_COUNT);
        for index in 0..TABLE_COUNT {
            tables.push(NumericTransitionTable {
                cohort: cohort_at(index)?,
                groups: 0,
                rows: Vec::new(),
                reserved_slots: 0,
            });
        }
        Ok(Self {
            tables,
            last_group: [None; TABLE_COUNT],
            occupied_rows: 0,
            paid_slots: 0,
            #[cfg(test)]
            peak_live_slots: 0,
            #[cfg(test)]
            maximum_old_slots: 0,
        })
    }

    fn contribute(
        &mut self,
        cohort: TransitionCohort,
        outcome: NumericOutcome,
        weight: f64,
        slot: u16,
        work: &mut LedgerWork,
    ) -> TableResult<()> {
        charge(work, INDEX)?;
        let index = cohort_index(cohort)?;
        let table = self.tables.get(index).ok_or(TableError::Domain)?;
        charge(work, SEARCH)?;
        match search(&table.rows, outcome) {
            SearchResult::Found(position) => {
                charge(work, COUNT_UPDATE)?;
                let previous = positive(self.tables[index].rows[position].count)?;
                self.tables[index].rows[position].count = positive(previous + weight)?;
            }
            SearchResult::Insert(position) => {
                let occupied = self
                    .occupied_rows
                    .checked_add(1)
                    .filter(|count| *count <= MAX_ROWS)
                    .ok_or(TableError::Capacity)?;
                self.grow(index, work)?;
                let length = self.tables[index].rows.len();
                let shifted = length.checked_sub(position).ok_or(TableError::Domain)?;
                charge(work, 64)?;
                charge_count(work, shifted, 64)?;
                charge(work, 32)?;
                self.tables[index].rows.insert(
                    position,
                    NumericTransitionRow {
                        spend: outcome.spend,
                        created: outcome.created,
                        wasted: outcome.wasted,
                        growth: outcome.growth,
                        destroyed: outcome.destroyed,
                        count: weight,
                    },
                );
                self.occupied_rows = occupied;
            }
        }
        charge(work, QUALIFICATION)?;
        if self.last_group[index] != Some(slot) {
            self.tables[index].groups = self.tables[index]
                .groups
                .checked_add(1)
                .ok_or(TableError::Capacity)?;
            self.last_group[index] = Some(slot);
        }
        Ok(())
    }

    fn grow(&mut self, index: usize, work: &mut LedgerWork) -> TableResult<()> {
        let table = self.tables.get(index).ok_or(TableError::Domain)?;
        let length = table.rows.len();
        let old_capacity = table.reserved_slots;
        if length > old_capacity || old_capacity > MAX_ROWS {
            return Err(TableError::Capacity);
        }
        if length < old_capacity {
            return Ok(());
        }
        if self.occupied_rows >= MAX_ROWS || old_capacity > MAX_TEMPORARY_OLD {
            return Err(TableError::Capacity);
        }
        let new_capacity = if old_capacity == 0 {
            1
        } else {
            old_capacity
                .checked_mul(2)
                .ok_or(TableError::Capacity)?
                .min(MAX_ROWS)
        };
        let paid = self
            .paid_slots
            .checked_sub(old_capacity)
            .and_then(|value| value.checked_add(new_capacity))
            .filter(|value| *value <= MAX_PAID_SLOTS)
            .ok_or(TableError::Capacity)?;
        let live = paid
            .checked_add(old_capacity)
            .filter(|value| *value <= MAX_LIVE_SLOTS)
            .ok_or(TableError::Capacity)?;
        charge(work, 192)?;
        charge_count(
            work,
            new_capacity.checked_mul(6).ok_or(TableError::Capacity)?,
            4,
        )?;
        charge_count(work, length, 64)?;
        charge(work, 32)?;
        let mut replacement = Vec::with_capacity(new_capacity);
        #[cfg(test)]
        {
            self.peak_live_slots = self.peak_live_slots.max(live);
            self.maximum_old_slots = self.maximum_old_slots.max(old_capacity);
        }
        for &row in &table.rows {
            replacement.push(row);
        }
        let old = std::mem::replace(&mut self.tables[index].rows, replacement);
        drop(old);
        self.tables[index].reserved_slots = new_capacity;
        self.paid_slots = paid;
        #[cfg(not(test))]
        let _ = live;
        Ok(())
    }

    fn validate_final(&self, work: &mut LedgerWork) -> TableResult<()> {
        charge(work, FINAL_FIXED)?;
        charge_count(work, TABLE_COUNT, 32)?;
        charge_count(work, self.occupied_rows, 64)?;
        let mut occupied = 0_usize;
        let mut paid = 0_usize;
        for (index, table) in self.tables.iter().enumerate() {
            if table.cohort != cohort_at(index)?
                || table.rows.len() > table.reserved_slots
                || table.reserved_slots > MAX_ROWS
                || table.rows.capacity() < table.reserved_slots
                || (table.rows.is_empty() != (table.groups == 0))
            {
                return Err(TableError::Capacity);
            }
            occupied = occupied
                .checked_add(table.rows.len())
                .ok_or(TableError::Capacity)?;
            paid = paid
                .checked_add(table.reserved_slots)
                .ok_or(TableError::Capacity)?;
            let mut previous = None;
            for row in &table.rows {
                let outcome = outcome_of(row);
                validate_outcome(outcome)?;
                positive(row.count)?;
                if previous.is_some_and(|previous| outcome <= previous) {
                    return Err(TableError::Order);
                }
                previous = Some(outcome);
            }
        }
        if occupied != self.occupied_rows
            || occupied > MAX_ROWS
            || paid != self.paid_slots
            || paid > MAX_PAID_SLOTS
        {
            return Err(TableError::Capacity);
        }
        Ok(())
    }
}

enum SearchResult {
    Found(usize),
    Insert(usize),
}

fn search(rows: &[NumericTransitionRow], outcome: NumericOutcome) -> SearchResult {
    let mut lower = 0_usize;
    let mut upper = rows.len();
    while lower < upper {
        let middle = lower + (upper - lower) / 2;
        match outcome_of(&rows[middle]).cmp(&outcome) {
            Ordering::Less => lower = middle + 1,
            Ordering::Greater => upper = middle,
            Ordering::Equal => return SearchResult::Found(middle),
        }
    }
    SearchResult::Insert(lower)
}

fn outcome_of(row: &NumericTransitionRow) -> NumericOutcome {
    NumericOutcome {
        spend: row.spend,
        created: row.created,
        wasted: row.wasted,
        growth: row.growth,
        destroyed: row.destroyed,
    }
}

fn validate_outcome(outcome: NumericOutcome) -> TableResult<()> {
    if outcome.spend > 9
        || outcome.created > 9
        || outcome.wasted > 9
        || outcome.growth > 32
        || !outcome.growth.is_multiple_of(2)
        || outcome.destroyed > 617
        || !SPENDS.contains(&outcome.spend)
        || (outcome.created != 0 && outcome.created != outcome.spend)
        || outcome.spend.checked_sub(outcome.created) != Some(outcome.wasted)
    {
        return Err(TableError::Domain);
    }
    Ok(())
}

fn cohort_index(cohort: TransitionCohort) -> TableResult<usize> {
    let index = match cohort {
        TransitionCohort::BankBandTier { bank, band, tier }
            if bank <= BANK_CEILING && band < 19 && tier < 3 =>
        {
            usize::from(bank)
                .checked_mul(57)
                .and_then(|value| value.checked_add(usize::from(band).checked_mul(3)?))
                .and_then(|value| value.checked_add(usize::from(tier)))
        }
        TransitionCohort::BankTier { bank, tier } if bank <= BANK_CEILING && tier < 3 => {
            usize::from(bank)
                .checked_mul(3)
                .and_then(|value| value.checked_add(usize::from(tier)))
                .and_then(|value| value.checked_add(741))
        }
        TransitionCohort::Bank { bank } if bank <= BANK_CEILING => {
            780_usize.checked_add(usize::from(bank))
        }
        TransitionCohort::Global => Some(GLOBAL_INDEX),
        _ => None,
    };
    index
        .filter(|index| *index < TABLE_COUNT)
        .ok_or(TableError::Domain)
}

fn cohort_at(index: usize) -> TableResult<TransitionCohort> {
    let byte = |value| u8::try_from(value).map_err(|_| TableError::Domain);
    match index {
        0..=740 => Ok(TransitionCohort::BankBandTier {
            bank: byte(index / 57)?,
            band: byte((index % 57) / 3)?,
            tier: byte(index % 3)?,
        }),
        741..=779 => {
            let offset = index.checked_sub(741).ok_or(TableError::Domain)?;
            Ok(TransitionCohort::BankTier {
                bank: byte(offset / 3)?,
                tier: byte(offset % 3)?,
            })
        }
        780..=792 => Ok(TransitionCohort::Bank {
            bank: byte(index.checked_sub(780).ok_or(TableError::Domain)?)?,
        }),
        GLOBAL_INDEX => Ok(TransitionCohort::Global),
        _ => Err(TableError::Domain),
    }
}

fn copy_profile(rules: &LedgerRules, work: &mut LedgerWork) -> TableResult<LedgerRules> {
    let entries = rules
        .income_by_turn
        .len()
        .checked_add(rules.gas_capacity_by_turn.len())
        .ok_or(TableError::Domain)?;
    charge(work, 2 * 192)?;
    charge_count(
        work,
        17_usize.checked_add(entries).ok_or(TableError::Domain)?,
        4,
    )?;
    charge_count(work, entries, 32)?;
    if rules.mineral_bank_cap != u32::from(BANK_CEILING)
        || rules
            .income_by_turn
            .iter()
            .any(|value| !(1..=3).contains(value))
        || rules
            .gas_capacity_by_turn
            .iter()
            .any(|value| !(1..=3).contains(value))
    {
        return Err(TableError::Domain);
    }
    Ok(LedgerRules {
        version: rules.version,
        opening_bank_default: rules.opening_bank_default,
        unit_costs: UnitCosts {
            p: rules.unit_costs.p,
            n: rules.unit_costs.n,
            b: rules.unit_costs.b,
            r: rules.unit_costs.r,
            q: rules.unit_costs.q,
            k: rules.unit_costs.k,
        },
        mineral_bank_cap: rules.mineral_bank_cap,
        mine_entity_cap: rules.mine_entity_cap,
        max_turn: rules.max_turn,
        income_by_turn: rules.income_by_turn.to_vec(),
        gas_capacity_by_turn: rules.gas_capacity_by_turn.to_vec(),
    })
}

fn finite(value: f64) -> TableResult<f64> {
    if value.is_finite() {
        Ok(value)
    } else {
        Err(TableError::NonFinite)
    }
}
fn positive(value: f64) -> TableResult<f64> {
    let value = finite(value)?;
    if value > 0.0 {
        Ok(value)
    } else {
        Err(TableError::NonFinite)
    }
}
fn charge(work: &mut LedgerWork, amount: u64) -> TableResult<()> {
    work.charge(amount).map_err(TableError::Work)
}
fn charge_count(work: &mut LedgerWork, count: usize, fee: u64) -> TableResult<()> {
    let amount = u64::try_from(count)
        .ok()
        .and_then(|count| count.checked_mul(fee))
        .ok_or_else(|| {
            TableError::Work(LedgerError::new(
                LedgerErrorCode::Budget,
                "Transition table invoice overflow",
            ))
        })?;
    charge(work, amount)
}

fn accounting_error(error: AccountingError) -> TableError {
    match error {
        AccountingError::Work(error) => TableError::Work(error),
        AccountingError::Domain | AccountingError::UnsupportedProfile => TableError::Domain,
        AccountingError::NonFinite | AccountingError::Underflow => TableError::NonFinite,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn bridge_rules() -> LedgerRules {
        #[derive(serde::Deserialize)]
        struct RulesOnly {
            rules: LedgerRules,
        }
        serde_json::from_str::<RulesOnly>(include_str!("../tests/fixtures/ledger-boundaries.json"))
            .unwrap()
            .rules
    }

    fn qualified_bridge_model() -> NumericTransitions {
        let rows = [NumericFitRow {
            node_index: 0,
            source: AccountingPoint {
                material: 1,
                bank: 0,
            },
            input_turn: 0,
            visible_before: 0,
            marines_before: 0,
            outcome: NumericOutcome {
                spend: 0,
                created: 0,
                wasted: 0,
                growth: 0,
                destroyed: 1,
            },
        }];
        let groups: Vec<_> = (0..32)
            .map(|slot| NumericFitGroup {
                slot,
                selected_rows: &rows,
            })
            .collect();
        build_numeric_transitions(&bridge_rules(), 3, &groups, &mut LedgerWork::new()).unwrap()
    }

    #[test]
    fn prepaid_opportunities_extraction_preserves_old_public_results_invoices_and_refusal_edges() {
        let rules = bridge_rules();
        let mut build_work = LedgerWork::with_limit(141388).unwrap();
        let model = build_numeric_transitions(&rules, 3, &[], &mut build_work).unwrap();
        assert_eq!(build_work.used(), 141388);
        let mut short = LedgerWork::with_limit(141387).unwrap();
        assert!(
            matches!(build_numeric_transitions(&rules, 3, &[], &mut short), Err(TableError::Work(ref error)) if error.code == LedgerErrorCode::Budget)
        );
        let point = AccountingPoint {
            material: 575,
            bank: 0,
        };
        let context = NumericSourceContext {
            input_turn: 0,
            visible_before: 575,
            marines_before: 1,
        };
        let mut exact = LedgerWork::with_limit(352).unwrap();
        let terms = model.source_terms(point, &context, &mut exact).unwrap();
        assert_eq!(exact.used(), 352);
        assert_eq!(
            terms,
            SourceTerms {
                cohort: TransitionCohort::Global,
                feasible_tuple_count: 2307,
                fitted_count_sum: 0.0,
                denominator: 1153.5
            }
        );
        let mut short = LedgerWork::with_limit(351).unwrap();
        assert!(
            matches!(model.source_terms(point, &context, &mut short), Err(TableError::Work(ref error)) if error.code == LedgerErrorCode::Budget)
        );
        assert_eq!(short.used(), 320);
        let mut exact = LedgerWork::with_limit(288).unwrap();
        assert_eq!(
            model.select(point, 0, &mut exact).unwrap().cohort(),
            TransitionCohort::Global
        );
        assert_eq!(exact.used(), 288);
        let mut short = LedgerWork::with_limit(287).unwrap();
        assert!(
            matches!(model.select(point, 0, &mut short), Err(TableError::Work(ref error)) if error.code == LedgerErrorCode::Budget)
        );
        assert_eq!(short.used(), 256);
    }

    #[test]
    fn prepared_bridge_uses_old_terms_once_plus_128_and_keeps_qualified_zero_count_selection() {
        let model = qualified_bridge_model();
        let context = NumericSourceContext {
            input_turn: 0,
            visible_before: 0,
            marines_before: 0,
        };
        for (material, expected_feasible, old_invoice) in [(0, false, 480), (1, true, 448)] {
            let point = AccountingPoint { material, bank: 0 };
            let mut old = LedgerWork::with_limit(old_invoice).unwrap();
            let terms = model.source_terms(point, &context, &mut old).unwrap();
            assert_eq!(old.used(), old_invoice);
            let mut work = LedgerWork::with_limit(old_invoice + 128).unwrap();
            let prepared = model
                .prepare_aggregation_source(point, &context, &mut work)
                .unwrap();
            assert_eq!(work.used(), old_invoice + 128);
            assert_eq!(prepared.terms(), terms);
            assert_eq!(prepared.accounting().point().material, material);
            assert_eq!(prepared.rows().len(), 1);
            if material == 0 {
                assert_eq!(
                    terms.cohort,
                    TransitionCohort::BankTier { bank: 0, tier: 0 }
                );
                assert_eq!(
                    (
                        terms.fitted_count_sum.to_bits(),
                        terms.denominator.to_bits()
                    ),
                    (0.0_f64.to_bits(), 0.5_f64.to_bits())
                );
            }
            let mut row_work = LedgerWork::with_limit(192).unwrap();
            assert_eq!(
                prepared.row_feasible(0, &mut row_work).unwrap(),
                expected_feasible
            );
            assert_eq!(row_work.used(), 192);
            let mut short = LedgerWork::with_limit(191).unwrap();
            assert!(
                matches!(prepared.row_feasible(0, &mut short), Err(TableError::Work(ref error)) if error.code == LedgerErrorCode::Budget)
            );
            assert_eq!(short.used(), 160);
            let mut invalid = LedgerWork::with_limit(32).unwrap();
            assert_eq!(
                prepared.row_feasible(1, &mut invalid).unwrap_err(),
                TableError::Domain
            );
            assert_eq!(invalid.used(), 32);
            let mut short = LedgerWork::with_limit(old_invoice + 127).unwrap();
            assert!(
                matches!(model.prepare_aggregation_source(point, &context, &mut short), Err(TableError::Work(ref error)) if error.code == LedgerErrorCode::Budget)
            );
            assert_eq!(short.used(), old_invoice + 96);
        }
    }

    #[test]
    fn accounting_only_source_does_not_pay_qualification_rows_or_counts_and_wrapper_prepays_each_pair()
     {
        let empty =
            build_numeric_transitions(&bridge_rules(), 3, &[], &mut LedgerWork::new()).unwrap();
        let populated = qualified_bridge_model();
        let point = AccountingPoint {
            material: 0,
            bank: 0,
        };
        let context = NumericSourceContext {
            input_turn: 0,
            visible_before: 0,
            marines_before: 0,
        };
        for model in [&empty, &populated] {
            let mut work = LedgerWork::with_limit(64).unwrap();
            let source = model.accounting_source(point, &context, &mut work).unwrap();
            assert_eq!(work.used(), 64);
            let mut pair_work = LedgerWork::with_limit(32).unwrap();
            assert_eq!(source.opportunities(0, 0, &mut pair_work).unwrap(), 0);
            assert_eq!(pair_work.used(), 32);
            for (spend, created) in [(2, 0), (1, 0), (0, 1)] {
                let mut invalid = LedgerWork::with_limit(32).unwrap();
                assert_eq!(
                    source
                        .opportunities(spend, created, &mut invalid)
                        .unwrap_err(),
                    TableError::Domain
                );
                assert_eq!(invalid.used(), 32);
            }
            let mut short = LedgerWork::with_limit(63).unwrap();
            assert!(
                matches!(model.accounting_source(point, &context, &mut short), Err(TableError::Work(ref error)) if error.code == LedgerErrorCode::Budget)
            );
            assert_eq!(short.used(), 32);
        }
    }

    #[test]
    fn bridge_loans_fail_before_access_and_bulk_minimum_loan_does_not_discount_interval_lookups() {
        let model = qualified_bridge_model();
        let mut profile_work = LedgerWork::with_limit(32).unwrap();
        assert_eq!(
            model
                .borrow_numeric_profile(&mut profile_work)
                .unwrap()
                .gas_capacity_by_turn[0],
            1
        );
        assert_eq!(profile_work.used(), 32);
        let mut minimum_work = LedgerWork::with_limit(32).unwrap();
        assert_eq!(
            model.borrow_growth_minimums(&mut minimum_work).unwrap()[14],
            3
        );
        assert_eq!(minimum_work.used(), 32);
        let mut short = LedgerWork::with_limit(31).unwrap();
        assert!(
            matches!(model.borrow_numeric_profile(&mut short), Err(TableError::Work(ref error)) if error.code == LedgerErrorCode::Budget)
        );
        assert_eq!(short.used(), 0);
        let mut short = LedgerWork::with_limit(31).unwrap();
        assert!(
            matches!(model.borrow_growth_minimums(&mut short), Err(TableError::Work(ref error)) if error.code == LedgerErrorCode::Budget)
        );
        assert_eq!(short.used(), 0);
        let point = AccountingPoint {
            material: 0,
            bank: 0,
        };
        let context = NumericSourceContext {
            input_turn: 0,
            visible_before: 0,
            marines_before: 0,
        };
        let prepared = model
            .prepare_aggregation_source(point, &context, &mut LedgerWork::new())
            .unwrap();
        let mut shared = LedgerWork::new();
        model.borrow_growth_minimums(&mut shared).unwrap();
        assert!(!prepared.row_feasible(0, &mut shared).unwrap());
        assert_eq!(shared.used(), 32 + 192);
    }

    fn storage_row(index: usize) -> NumericTransitionRow {
        NumericTransitionRow {
            spend: 0,
            created: 0,
            wasted: 0,
            growth: u8::try_from(2 * (index / 618)).unwrap(),
            destroyed: u16::try_from(index % 618).unwrap(),
            count: (index as f64 + 1.0) / 3.0,
        }
    }

    fn seed_table(builder: &mut TableBuilder, index: usize, length: usize, capacity: usize) {
        let mut rows = Vec::with_capacity(capacity);
        for row in 0..length {
            rows.push(storage_row(row));
        }
        builder.tables[index].rows = rows;
        builder.tables[index].reserved_slots = capacity;
        builder.tables[index].groups = 1;
        builder.last_group[index] = Some(0);
        builder.occupied_rows += length;
        builder.paid_slots += capacity;
    }

    fn unused_outcome() -> NumericOutcome {
        NumericOutcome {
            spend: 0,
            created: 0,
            wasted: 0,
            growth: 32,
            destroyed: 617,
        }
    }

    #[test]
    fn private_growth_metadata_uses_exact_prepaid_invoice_and_minimum_opportunities() {
        let mut work = LedgerWork::new();
        let growth = GrowthMetadata::new(&mut work).unwrap();
        assert_eq!(work.used(), 47000 + 1492 + 1320);
        assert_eq!(
            (
                growth.minimum_opportunities[6],
                growth.minimum_opportunities[14],
                growth.minimum_opportunities[22],
                growth.minimum_opportunities[30]
            ),
            (2, 3, 4, 5)
        );
        assert_eq!(growth.cardinality_prefix[1][33], 4);
        assert_eq!(growth.growth_sum_prefix[1][33], 14);
        let mut short = LedgerWork::with_limit(49812 - 1).unwrap();
        assert!(
            matches!(GrowthMetadata::new(&mut short), Err(TableError::Work(ref error)) if error.code == LedgerErrorCode::Budget)
        );
    }

    #[test]
    fn occupied_ceiling_allows_found_updates_but_refuses_distinct_rows_before_growth() {
        let mut work = LedgerWork::new();
        let mut builder = TableBuilder::new(&mut work).unwrap();
        for index in 0..4 {
            seed_table(&mut builder, index, 2048, 2048);
        }
        assert_eq!((builder.occupied_rows, builder.paid_slots), (8192, 8192));
        let cohort = builder.tables[0].cohort;
        let existing = outcome_of(&builder.tables[0].rows[1000]);
        let initial_count = builder.tables[0].rows[1000].count;
        let before = work.used();
        builder
            .contribute(cohort, existing, 0.25, 1, &mut work)
            .unwrap();
        assert_eq!(work.used() - before, 32 + 224 + 32 + 32);
        assert_eq!(
            builder.tables[0].rows[1000].count.to_bits(),
            (initial_count + 0.25).to_bits()
        );
        assert_eq!(
            (
                builder.occupied_rows,
                builder.paid_slots,
                builder.tables[0].reserved_slots
            ),
            (8192, 8192, 2048)
        );
        assert_eq!(builder.tables[0].groups, 2);
        let before = work.used();
        builder
            .contribute(cohort, existing, 0.25, 1, &mut work)
            .unwrap();
        assert_eq!(work.used() - before, 32 + 224 + 32 + 32);
        assert_eq!(builder.tables[0].groups, 2);
        let pointer = builder.tables[0].rows.as_ptr();
        let before = work.used();
        assert_eq!(
            builder
                .contribute(cohort, unused_outcome(), 0.5, 2, &mut work)
                .unwrap_err(),
            TableError::Capacity
        );
        assert_eq!(work.used() - before, 32 + 224);
        assert_eq!(builder.tables[0].rows.as_ptr(), pointer);
        assert_eq!(
            (
                builder.occupied_rows,
                builder.paid_slots,
                builder.tables[0].reserved_slots
            ),
            (8192, 8192, 2048)
        );
        assert_eq!((builder.peak_live_slots, builder.maximum_old_slots), (0, 0));
    }

    #[test]
    fn growth_precharge_precedes_allocation_and_old_rows_keep_count_bits_and_order() {
        let setup = || {
            let mut builder = TableBuilder::new(&mut LedgerWork::new()).unwrap();
            seed_table(&mut builder, GLOBAL_INDEX, 1, 1);
            builder.tables[GLOBAL_INDEX].rows[0].destroyed = 3;
            builder
        };
        let outcome = NumericOutcome {
            spend: 0,
            created: 0,
            wasted: 0,
            growth: 0,
            destroyed: 1,
        };
        let mut builder = setup();
        let old_pointer = builder.tables[GLOBAL_INDEX].rows.as_ptr();
        let old_bits = builder.tables[GLOBAL_INDEX].rows[0].count.to_bits();
        let mut short = LedgerWork::with_limit(32 + 224 + 192 + 48 + 64 + 32 - 1).unwrap();
        assert!(
            matches!(builder.contribute(TransitionCohort::Global, outcome, 0.25, 1, &mut short), Err(TableError::Work(ref error)) if error.code == LedgerErrorCode::Budget)
        );
        assert_eq!(short.used(), 32 + 224 + 192 + 48 + 64);
        assert_eq!(builder.tables[GLOBAL_INDEX].rows.as_ptr(), old_pointer);
        assert_eq!(
            (
                builder.tables[GLOBAL_INDEX].rows.len(),
                builder.tables[GLOBAL_INDEX].reserved_slots,
                builder.occupied_rows,
                builder.paid_slots
            ),
            (1, 1, 1, 1)
        );
        assert_eq!(
            builder.tables[GLOBAL_INDEX].rows[0].count.to_bits(),
            old_bits
        );
        let invoice = 32 + 224 + (192 + 4 * 6 * 2 + 64 + 32) + (64 + 64 + 32) + 32;
        let mut exact = LedgerWork::with_limit(invoice).unwrap();
        builder
            .contribute(TransitionCohort::Global, outcome, 0.25, 1, &mut exact)
            .unwrap();
        assert_eq!(exact.used(), invoice);
        assert_eq!(
            (
                builder.tables[GLOBAL_INDEX].rows.len(),
                builder.tables[GLOBAL_INDEX].reserved_slots,
                builder.occupied_rows,
                builder.paid_slots
            ),
            (2, 2, 2, 2)
        );
        assert_eq!(builder.tables[GLOBAL_INDEX].rows[0].destroyed, 1);
        assert_eq!(builder.tables[GLOBAL_INDEX].rows[1].destroyed, 3);
        assert_eq!(
            builder.tables[GLOBAL_INDEX].rows[1].count.to_bits(),
            old_bits
        );
        assert_eq!((builder.peak_live_slots, builder.maximum_old_slots), (3, 1));
    }

    #[test]
    fn largest_replacement_and_following_cohort_growth_preserve_logical_storage_bounds() {
        let mut work = LedgerWork::new();
        let mut builder = TableBuilder::new(&mut work).unwrap();
        seed_table(&mut builder, GLOBAL_INDEX, 4096, 4096);
        seed_table(&mut builder, 780, 2, 2);
        let before = work.used();
        builder
            .contribute(
                TransitionCohort::Global,
                unused_outcome(),
                0.5,
                1,
                &mut work,
            )
            .unwrap();
        assert_eq!(
            work.used() - before,
            32 + 224 + (192 + 4 * 6 * 8192 + 64 * 4096 + 32) + 64 + 32 + 32
        );
        assert_eq!((builder.occupied_rows, builder.paid_slots), (4099, 8194));
        assert_eq!(
            (builder.peak_live_slots, builder.maximum_old_slots),
            (12290, 4096)
        );
        for index in 0..4096 {
            assert_eq!(
                outcome_of(&builder.tables[GLOBAL_INDEX].rows[index]),
                outcome_of(&storage_row(index))
            );
            assert_eq!(
                builder.tables[GLOBAL_INDEX].rows[index].count.to_bits(),
                storage_row(index).count.to_bits()
            );
        }
        let before = work.used();
        builder
            .contribute(
                TransitionCohort::Bank { bank: 0 },
                NumericOutcome {
                    spend: 0,
                    created: 0,
                    wasted: 0,
                    growth: 0,
                    destroyed: 2,
                },
                0.25,
                1,
                &mut work,
            )
            .unwrap();
        assert_eq!(
            work.used() - before,
            32 + 224 + (192 + 4 * 6 * 4 + 64 * 2 + 32) + 64 + 32 + 32
        );
        assert_eq!((builder.occupied_rows, builder.paid_slots), (4100, 8196));
        assert_eq!(
            (builder.peak_live_slots, builder.maximum_old_slots),
            (12290, 4096)
        );
        assert!(builder.paid_slots <= 16384 && builder.peak_live_slots <= 20480);
        assert_eq!(
            builder.tables[780].rows[0].count.to_bits(),
            storage_row(0).count.to_bits()
        );
        assert_eq!(
            builder.tables[780].rows[1].count.to_bits(),
            storage_row(1).count.to_bits()
        );
    }
}
