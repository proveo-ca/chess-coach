// SPEC: _spec/packages/training/belief-integration.puml
use crate::evidence_tables::NumericEconomicTables;
use crate::joint_math::ReadoutTemperature;
use crate::ledger::LedgerWork;
use crate::ledger::contracts::LedgerRules;

use super::{BeliefError, BeliefResult, MarineOpportunityProvider, ModelError};

pub struct CalibrationBin<'a> {
    pub turn_low: u32,
    pub turn_high: u32,
    pub lit_low: u8,
    pub lit_high: u8,
    pub temperature: &'a ReadoutTemperature,
}

pub struct NumericalBeliefModel<'a, M: MarineOpportunityProvider + ?Sized> {
    rules: &'a LedgerRules,
    tables: &'a NumericEconomicTables,
    calibration: &'a [CalibrationBin<'a>],
    marines: &'a M,
}

impl<'a, M: MarineOpportunityProvider + ?Sized> NumericalBeliefModel<'a, M> {
    pub fn new(
        rules: &'a LedgerRules,
        tables: &'a NumericEconomicTables,
        calibration: &'a [CalibrationBin<'a>],
        marines: &'a M,
        work: &mut LedgerWork,
    ) -> BeliefResult<Self> {
        work.charge(128)?;
        rules.validate(work)?;
        work.charge(256 + 32 * 46)?;
        if rules.opening_bank_default != 3
            || rules.mineral_bank_cap != 12
            || rules.mine_entity_cap != 3
            || rules.max_turn != 45
            || [rules.unit_costs.p, rules.unit_costs.n, rules.unit_costs.b,
                rules.unit_costs.r, rules.unit_costs.q, rules.unit_costs.k] != [1, 3, 3, 5, 9, 1]
        {
            return Err(BeliefError::Model(ModelError::Rules));
        }
        for turn in 0..=45 {
            let expected = if turn <= 10 { 1 } else if turn <= 20 { 2 } else { 3 };
            if rules.income_at(turn)? != expected || rules.gas_capacity_at(turn)? != expected {
                return Err(BeliefError::Model(ModelError::Rules));
            }
        }
        let profile = tables.transitions().borrow_numeric_profile(work)?;
        work.charge(256 + 8 * 46 * 2)?;
        if profile != rules {
            return Err(BeliefError::Model(ModelError::TableProfile));
        }
        validate_calibration(calibration, work)?;
        work.charge(32)?;
        Ok(Self { rules, tables, calibration, marines })
    }

    pub fn rules(&self) -> &LedgerRules { self.rules }
    pub fn tables(&self) -> &NumericEconomicTables { self.tables }
    pub fn calibration(&self) -> &[CalibrationBin<'a>] { self.calibration }
    pub fn marines(&self) -> &M { self.marines }

    pub(super) fn temperature(
        &self,
        turn: u32,
        lit: u8,
        work: &mut LedgerWork,
    ) -> BeliefResult<&ReadoutTemperature> {
        work.charge(32)?;
        let mut selected = None;
        for bin in self.calibration {
            work.charge(32)?;
            if (bin.turn_low..=bin.turn_high).contains(&turn)
                && (bin.lit_low..=bin.lit_high).contains(&lit)
            {
                if selected.is_some() {
                    return Err(BeliefError::Model(ModelError::Calibration));
                }
                selected = Some(bin.temperature);
            }
        }
        selected.ok_or(BeliefError::Model(ModelError::Calibration))
    }
}

fn validate_calibration(bins: &[CalibrationBin<'_>], work: &mut LedgerWork) -> BeliefResult<()> {
    work.charge(128)?;
    if bins.is_empty() || bins.len() > 46 * 65 {
        return Err(BeliefError::Model(ModelError::Calibration));
    }
    work.charge(4 * 46 * 65)?;
    let mut covered = [[false; 65]; 46];
    let mut previous = None;
    for bin in bins {
        work.charge(64)?;
        let key = (bin.turn_low, bin.turn_high, bin.lit_low, bin.lit_high);
        if previous.is_some_and(|previous| key <= previous)
            || bin.turn_low > bin.turn_high || bin.turn_high > 45
            || bin.lit_low > bin.lit_high || bin.lit_high > 64
            || bin.temperature.index() > 1000
            || !bin.temperature.value().is_finite()
            || !(0.25..=4.0).contains(&bin.temperature.value())
        {
            return Err(BeliefError::Model(ModelError::Calibration));
        }
        previous = Some(key);
        for turn in bin.turn_low..=bin.turn_high {
            for lit in bin.lit_low..=bin.lit_high {
                work.charge(16)?;
                let cell = &mut covered[turn as usize][usize::from(lit)];
                if *cell { return Err(BeliefError::Model(ModelError::Calibration)); }
                *cell = true;
            }
        }
    }
    work.charge(8 * 46 * 65)?;
    if covered.iter().any(|row| row.iter().any(|cell| !cell)) {
        return Err(BeliefError::Model(ModelError::Calibration));
    }
    Ok(())
}
