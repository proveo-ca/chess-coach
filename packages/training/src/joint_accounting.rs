// SPEC: _spec/packages/training/burn-compat.puml
use crate::accounting_kernel::{
    AccountingPoint, BANK_CEILING, JOINT_SIZE, MATERIAL_CEILING, NumericGrant,
};
use crate::joint_math::NumericJoint;
use crate::ledger::LedgerWork;
use crate::ledger::contracts::{LedgerError, LedgerErrorCode};
use crate::transition_tables::{
    NumericAccountingSource, NumericSourceContext, NumericTransitions, PreparedNumericSource,
    TableError,
};

const MATERIAL_WIDTH: usize = MATERIAL_CEILING as usize + 1;
const STOCK_CEILING: u16 = 617;
const STOCK_WIDTH: usize = STOCK_CEILING as usize + 1;
const STOCK_SIZE: usize = (BANK_CEILING as usize + 1) * STOCK_WIDTH;
const SPENDS: [u8; 5] = [0, 1, 3, 5, 9];
const ENTRY: u64 = 128;
const PARAMETER: u64 = 32;
const ALLOCATION: u64 = 192;
const INITIALIZATION: u64 = 4;
const SOURCE_SCAN: u64 = 8;
const GAMMA_INITIALIZATION: u64 = 4 * 170;
const GAMMA_MATERIALIZATION: u64 = 8 * 165;
const ACTIVE_SOURCE: u64 = 32;
const BACKGROUND: u64 = 32;
const GROWTH: u64 = 64;
const INSPECT_ROW: u64 = 64;
const SUFFIX: u64 = 16;
const DESTINATION: u64 = 24;

#[derive(Clone, Copy, Debug)]
pub struct NumericAccountingStep {
    pub context: NumericSourceContext,
    pub grant: NumericGrant,
    pub witnessed_loss: u16,
    pub destination_lower: u16,
    pub destination_upper: u16,
}

pub struct RawJointAccounting {
    masses: Vec<f64>,
    accounting_cells: Vec<bool>,
    retained_mass: f64,
}

pub(crate) struct RawAccountingParts {
    pub(crate) masses: Vec<f64>,
    pub(crate) accounting_cells: Vec<bool>,
    pub(crate) retained_mass: f64,
}

impl std::fmt::Debug for RawJointAccounting {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("RawJointAccounting")
            .field("retained_mass", &self.retained_mass)
            .finish_non_exhaustive()
    }
}

impl RawJointAccounting {
    pub fn masses(&self) -> &[f64] {
        &self.masses
    }
    pub fn accounting_cells(&self) -> &[bool] {
        &self.accounting_cells
    }
    pub fn retained_mass(&self) -> f64 {
        self.retained_mass
    }

    pub(crate) fn into_numeric_parts(
        self,
        work: &mut LedgerWork,
    ) -> Result<RawAccountingParts, LedgerError> {
        work.charge(32)?;
        let Self {
            masses,
            accounting_cells,
            retained_mass,
        } = self;
        Ok(RawAccountingParts {
            masses,
            accounting_cells,
            retained_mass,
        })
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum JointAccountingError {
    Domain,
    NonFinite,
    Underflow,
    EmptySupport,
    EmptyMass,
    Table(TableError),
    Work(LedgerError),
}

pub type JointAccountingResult<T> = Result<T, JointAccountingError>;

pub fn aggregate_accounting(
    prior: &NumericJoint,
    transitions: &NumericTransitions,
    step: &NumericAccountingStep,
    work: &mut LedgerWork,
) -> JointAccountingResult<RawJointAccounting> {
    charge(work, ENTRY)?;
    charge(work, PARAMETER)?;
    if step.context.input_turn > 45
        || step.context.visible_before > MATERIAL_CEILING
        || step.context.marines_before > 64
        || u16::from(step.context.marines_before) > step.context.visible_before
        || step.witnessed_loss > STOCK_CEILING
        || step.destination_lower > step.destination_upper
        || step.destination_upper > MATERIAL_CEILING
    {
        return Err(JointAccountingError::Domain);
    }
    let profile = transitions
        .borrow_numeric_profile(work)
        .map_err(JointAccountingError::Table)?;
    charge(work, PARAMETER)?;
    profile
        .gas_capacity_at(step.context.input_turn)
        .map_err(|_| JointAccountingError::Domain)?;
    charge(work, PARAMETER)?;
    let income = match step.grant {
        NumericGrant::None => 0,
        NumericGrant::AtNativeTurn(turn) => {
            charge(work, PARAMETER)?;
            u16::try_from(
                profile
                    .income_at(turn)
                    .map_err(|_| JointAccountingError::Domain)?,
            )
            .map_err(|_| JointAccountingError::Domain)?
        }
    };
    let gamma = Gamma::new(transitions, work)?;
    let mut buffers = Buffers::new(work)?;
    charge_count(work, JOINT_SIZE, SOURCE_SCAN)?;
    for bank in 0..=BANK_CEILING {
        for material in 0..=MATERIAL_CEILING {
            let index = joint_index(bank, material)?;
            let probability = nonnegative(prior.probabilities()[index])?;
            let supported = prior.support().cells()[index];
            if probability > 0.0 && !supported {
                return Err(JointAccountingError::Domain);
            }
            if !supported {
                continue;
            }
            charge(work, ACTIVE_SOURCE)?;
            let point = AccountingPoint { material, bank };
            if material < step.context.visible_before {
                return Err(JointAccountingError::Domain);
            }
            if probability > 0.0 {
                let prepared = transitions
                    .prepare_aggregation_source(point, &step.context, work)
                    .map_err(JointAccountingError::Table)?;
                charge(work, BACKGROUND)?;
                let half_probability = positive_product(0.5, probability)?;
                let background = positive_ratio(half_probability, prepared.terms().denominator)?;
                buffers.branches(
                    prepared.accounting(),
                    Some(background),
                    &gamma,
                    income,
                    work,
                )?;
                buffers.scatter(&prepared, probability, income, step.witnessed_loss, work)?;
            } else {
                let source = transitions
                    .accounting_source(point, &step.context, work)
                    .map_err(JointAccountingError::Table)?;
                buffers.branches(&source, None, &gamma, income, work)?;
            }
        }
    }
    buffers.suffix(work)?;
    buffers.finish(step, work)
}

struct Gamma {
    values: [[u8; 33]; 5],
    lengths: [usize; 5],
}

impl Gamma {
    fn new(transitions: &NumericTransitions, work: &mut LedgerWork) -> JointAccountingResult<Self> {
        let minimums = transitions
            .borrow_growth_minimums(work)
            .map_err(JointAccountingError::Table)?;
        charge(work, GAMMA_INITIALIZATION)?;
        charge(work, GAMMA_MATERIALIZATION)?;
        let mut gamma = Self {
            values: [[0; 33]; 5],
            lengths: [0; 5],
        };
        for opportunities in 0..=4 {
            for (growth, minimum) in minimums.iter().enumerate() {
                if usize::from(*minimum) <= opportunities {
                    gamma.values[opportunities][gamma.lengths[opportunities]] =
                        u8::try_from(growth).map_err(|_| JointAccountingError::Domain)?;
                    gamma.lengths[opportunities] = gamma.lengths[opportunities]
                        .checked_add(1)
                        .ok_or(JointAccountingError::Domain)?;
                }
            }
        }
        Ok(gamma)
    }

    fn values(&self, opportunities: usize) -> JointAccountingResult<&[u8]> {
        let values = self
            .values
            .get(opportunities)
            .ok_or(JointAccountingError::Domain)?;
        let length = *self
            .lengths
            .get(opportunities)
            .ok_or(JointAccountingError::Domain)?;
        values.get(..length).ok_or(JointAccountingError::Domain)
    }
}

struct Buffers {
    head: Vec<f64>,
    boolean_head: Vec<bool>,
    masses: Vec<f64>,
    cells: Vec<bool>,
}

impl Buffers {
    fn new(work: &mut LedgerWork) -> JointAccountingResult<Self> {
        Ok(Self {
            head: buffer(STOCK_SIZE, 0.0, work)?,
            boolean_head: buffer(STOCK_SIZE, false, work)?,
            masses: buffer(JOINT_SIZE, 0.0, work)?,
            cells: buffer(JOINT_SIZE, false, work)?,
        })
    }

    fn branches(
        &mut self,
        source: &NumericAccountingSource,
        background: Option<f64>,
        gamma: &Gamma,
        income: u16,
        work: &mut LedgerWork,
    ) -> JointAccountingResult<()> {
        let point = source.point();
        for &spend in &SPENDS {
            if spend > point.bank {
                continue;
            }
            for choice in 0..if spend == 0 { 1 } else { 2 } {
                let created = if choice == 0 { 0 } else { spend };
                let opportunities = source
                    .opportunities(spend, created, work)
                    .map_err(JointAccountingError::Table)?;
                for &growth in gamma.values(opportunities)? {
                    charge(work, GROWTH)?;
                    let bank = destination_bank(point.bank, spend, income)?;
                    let stock = point
                        .material
                        .checked_add(u16::from(created))
                        .and_then(|value| value.checked_add(u16::from(growth)))
                        .ok_or(JointAccountingError::Domain)?;
                    let index = head_index(bank, stock)?;
                    self.boolean_head[index] = true;
                    if let Some(background) = background {
                        self.head[index] = nonnegative_sum(self.head[index], background)?;
                    }
                }
            }
        }
        Ok(())
    }

    fn scatter(
        &mut self,
        prepared: &PreparedNumericSource<'_>,
        probability: f64,
        income: u16,
        witnessed_loss: u16,
        work: &mut LedgerWork,
    ) -> JointAccountingResult<()> {
        let point = prepared.accounting().point();
        let denominator = prepared.terms().denominator;
        for (index, row) in prepared.rows().iter().enumerate() {
            charge(work, INSPECT_ROW)?;
            let feasible = prepared
                .row_feasible(index, work)
                .map_err(JointAccountingError::Table)?;
            if feasible && row.destroyed >= witnessed_loss {
                let numerator = positive_product(probability, row.count)?;
                let contribution = positive_ratio(numerator, denominator)?;
                let bank = destination_bank(point.bank, row.spend, income)?;
                let material = point
                    .material
                    .checked_add(u16::from(row.created))
                    .and_then(|value| value.checked_add(u16::from(row.growth)))
                    .and_then(|value| value.checked_sub(row.destroyed))
                    .ok_or(JointAccountingError::Domain)?;
                let destination = joint_index(bank, material)?;
                self.masses[destination] = nonnegative_sum(self.masses[destination], contribution)?;
            }
        }
        Ok(())
    }

    fn suffix(&mut self, work: &mut LedgerWork) -> JointAccountingResult<()> {
        charge_count(work, STOCK_SIZE, SUFFIX)?;
        for bank in 0..=BANK_CEILING {
            nonnegative(self.head[head_index(bank, STOCK_CEILING)?])?;
            for stock in (0..STOCK_CEILING).rev() {
                let index = head_index(bank, stock)?;
                let next = head_index(
                    bank,
                    stock.checked_add(1).ok_or(JointAccountingError::Domain)?,
                )?;
                self.head[index] = nonnegative_sum(self.head[index], self.head[next])?;
                self.boolean_head[index] = self.boolean_head[index] || self.boolean_head[next];
            }
        }
        Ok(())
    }

    fn finish(
        mut self,
        step: &NumericAccountingStep,
        work: &mut LedgerWork,
    ) -> JointAccountingResult<RawJointAccounting> {
        charge_count(work, JOINT_SIZE, DESTINATION)?;
        let mut any = false;
        let mut retained_mass = 0.0;
        for bank in 0..=BANK_CEILING {
            for material in 0..=MATERIAL_CEILING {
                let index = joint_index(bank, material)?;
                let threshold = u32::from(material)
                    .checked_add(u32::from(step.witnessed_loss))
                    .ok_or(JointAccountingError::Domain)?;
                let (background, reachable) = if threshold <= u32::from(STOCK_CEILING) {
                    let head = head_index(
                        bank,
                        u16::try_from(threshold).map_err(|_| JointAccountingError::Domain)?,
                    )?;
                    (self.head[head], self.boolean_head[head])
                } else {
                    (0.0, false)
                };
                let mass = nonnegative_sum(self.masses[index], background)?;
                let allowed =
                    material >= step.destination_lower && material <= step.destination_upper;
                self.masses[index] = if allowed { mass } else { 0.0 };
                self.cells[index] = allowed && reachable;
                if self.masses[index] > 0.0 && !self.cells[index] {
                    return Err(JointAccountingError::Domain);
                }
                any |= self.cells[index];
                retained_mass = nonnegative_sum(retained_mass, self.masses[index])?;
            }
        }
        if !any {
            return Err(JointAccountingError::EmptySupport);
        }
        if retained_mass == 0.0 {
            return Err(JointAccountingError::EmptyMass);
        }
        Ok(RawJointAccounting {
            masses: self.masses,
            accounting_cells: self.cells,
            retained_mass,
        })
    }
}

fn destination_bank(bank: u8, spend: u8, income: u16) -> JointAccountingResult<u8> {
    let bank = u16::from(bank)
        .checked_sub(u16::from(spend))
        .and_then(|value| value.checked_add(income))
        .ok_or(JointAccountingError::Domain)?;
    u8::try_from(bank.min(u16::from(BANK_CEILING))).map_err(|_| JointAccountingError::Domain)
}

fn head_index(bank: u8, stock: u16) -> JointAccountingResult<usize> {
    if bank > BANK_CEILING || stock > STOCK_CEILING {
        return Err(JointAccountingError::Domain);
    }
    usize::from(bank)
        .checked_mul(STOCK_WIDTH)
        .and_then(|offset| offset.checked_add(usize::from(stock)))
        .filter(|index| *index < STOCK_SIZE)
        .ok_or(JointAccountingError::Domain)
}

fn joint_index(bank: u8, material: u16) -> JointAccountingResult<usize> {
    if bank > BANK_CEILING || material > MATERIAL_CEILING {
        return Err(JointAccountingError::Domain);
    }
    usize::from(bank)
        .checked_mul(MATERIAL_WIDTH)
        .and_then(|offset| offset.checked_add(usize::from(material)))
        .filter(|index| *index < JOINT_SIZE)
        .ok_or(JointAccountingError::Domain)
}

fn buffer<T: Clone>(size: usize, value: T, work: &mut LedgerWork) -> JointAccountingResult<Vec<T>> {
    charge(work, ALLOCATION)?;
    charge_count(work, size, INITIALIZATION)?;
    Ok(vec![value; size])
}

fn finite(value: f64) -> JointAccountingResult<f64> {
    if value.is_finite() {
        Ok(value)
    } else {
        Err(JointAccountingError::NonFinite)
    }
}

fn nonnegative(value: f64) -> JointAccountingResult<f64> {
    let value = finite(value)?;
    if value < 0.0 {
        Err(JointAccountingError::Domain)
    } else {
        Ok(value)
    }
}

fn nonnegative_sum(left: f64, right: f64) -> JointAccountingResult<f64> {
    nonnegative(finite(left + right)?)
}

fn positive_product(left: f64, right: f64) -> JointAccountingResult<f64> {
    let product = nonnegative(finite(left * right)?)?;
    if product == 0.0 {
        Err(JointAccountingError::Underflow)
    } else {
        Ok(product)
    }
}

fn positive_ratio(numerator: f64, denominator: f64) -> JointAccountingResult<f64> {
    let ratio = nonnegative(finite(numerator / denominator)?)?;
    if ratio == 0.0 {
        Err(JointAccountingError::Underflow)
    } else {
        Ok(ratio)
    }
}

fn charge(work: &mut LedgerWork, amount: u64) -> JointAccountingResult<()> {
    work.charge(amount).map_err(JointAccountingError::Work)
}

fn charge_count(work: &mut LedgerWork, count: usize, fee: u64) -> JointAccountingResult<()> {
    let amount = u64::try_from(count)
        .ok()
        .and_then(|count| count.checked_mul(fee))
        .ok_or_else(|| {
            JointAccountingError::Work(LedgerError::new(
                LedgerErrorCode::Budget,
                "Joint accounting invoice overflow",
            ))
        })?;
    charge(work, amount)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::evidence_tables::{
        EvidenceError, InnovationCode, NumericEconomicTables, build_numeric_economic_tables,
        weight_evidence,
    };
    use crate::ledger::contracts::LedgerRules;

    fn raw_for_move() -> RawJointAccounting {
        let mut masses = vec![-0.0; JOINT_SIZE];
        masses[4] = 1.0;
        let mut cells = vec![false; JOINT_SIZE];
        cells[4] = true;
        cells[8] = true;
        RawJointAccounting {
            masses,
            accounting_cells: cells,
            retained_mass: 1.0,
        }
    }

    fn empty_evidence_model() -> NumericEconomicTables {
        #[derive(serde::Deserialize)]
        struct RulesOnly {
            rules: LedgerRules,
        }
        let rules = serde_json::from_str::<RulesOnly>(include_str!(
            "../tests/fixtures/ledger-boundaries.json"
        ))
        .unwrap()
        .rules;
        build_numeric_economic_tables(&rules, 3, &[], &mut LedgerWork::new()).unwrap()
    }

    #[test]
    fn evidence_weighting_rejects_private_nan_mass_only_after_covered_scan_prefix_for_both_code_paths()
     {
        let model = empty_evidence_model();
        for (bins, invoice, unpaid_prefix) in
            [([0, 0, 0], 240320, 288), ([0, 0, 1], 242360, 242328)]
        {
            let code = InnovationCode::from_bins(bins, &mut LedgerWork::new()).unwrap();
            let prior_spent = 19;
            let mut raw = raw_for_move();
            raw.masses[0] = f64::NAN;
            raw.accounting_cells[0] = true;
            assert_eq!(raw.retained_mass, 1.0);
            let mut exact = LedgerWork::with_limit(prior_spent + invoice).unwrap();
            exact.charge(prior_spent).unwrap();
            assert_eq!(
                weight_evidence(raw, &model, 0, code, &mut exact).unwrap_err(),
                EvidenceError::NonFinite
            );
            assert_eq!(exact.used(), prior_spent + invoice);
            let mut raw = raw_for_move();
            raw.masses[0] = f64::NAN;
            raw.accounting_cells[0] = true;
            let mut short = LedgerWork::with_limit(prior_spent + invoice - 1).unwrap();
            short.charge(prior_spent).unwrap();
            assert!(
                matches!(weight_evidence(raw, &model, 0, code, &mut short), Err(EvidenceError::Work(ref error)) if error.code == LedgerErrorCode::Budget)
            );
            assert_eq!(short.used(), prior_spent + unpaid_prefix);
        }
    }

    #[test]
    fn evidence_weighting_recomputes_private_zero_total_instead_of_trusting_positive_cache_for_both_code_paths()
     {
        let model = empty_evidence_model();
        for (bins, invoice, before_retained_check) in
            [([0, 0, 0], 240352, 240320), ([0, 0, 1], 250264, 250232)]
        {
            let code = InnovationCode::from_bins(bins, &mut LedgerWork::new()).unwrap();
            let prior_spent = 23;
            let mut raw = raw_for_move();
            raw.masses[4] = 0.0;
            assert_eq!(raw.retained_mass, 1.0);
            assert!(raw.accounting_cells[4]);
            assert!(raw.masses.iter().all(|mass| *mass == 0.0));
            let mut exact = LedgerWork::with_limit(prior_spent + invoice).unwrap();
            exact.charge(prior_spent).unwrap();
            assert_eq!(
                weight_evidence(raw, &model, 0, code, &mut exact).unwrap_err(),
                EvidenceError::EmptyMass
            );
            assert_eq!(exact.used(), prior_spent + invoice);
            let mut raw = raw_for_move();
            raw.masses[4] = 0.0;
            let mut short = LedgerWork::with_limit(prior_spent + invoice - 1).unwrap();
            short.charge(prior_spent).unwrap();
            assert!(
                matches!(weight_evidence(raw, &model, 0, code, &mut short), Err(EvidenceError::Work(ref error)) if error.code == LedgerErrorCode::Budget)
            );
            assert_eq!(short.used(), prior_spent + before_retained_check);
        }
    }

    #[test]
    fn numeric_parts_transfer_moves_exactly_both_output_buffers_and_scalar_after_32() {
        let raw = raw_for_move();
        let mass_pointer = raw.masses.as_ptr();
        let cell_pointer = raw.accounting_cells.as_ptr();
        let mut work = LedgerWork::with_limit(32).unwrap();
        let parts = raw.into_numeric_parts(&mut work).unwrap();
        assert_eq!(work.used(), 32);
        assert_eq!(parts.masses.as_ptr(), mass_pointer);
        assert_eq!(parts.accounting_cells.as_ptr(), cell_pointer);
        assert_eq!(parts.retained_mass.to_bits(), 1.0_f64.to_bits());
        assert_eq!(parts.masses[1].to_bits(), (-0.0_f64).to_bits());
        assert!(parts.accounting_cells[8]);
    }

    #[test]
    fn numeric_parts_failed_precharge_preserves_budget_payload_and_spent_prefix() {
        let raw = raw_for_move();
        let mut work = LedgerWork::with_limit(36).unwrap();
        work.charge(5).unwrap();
        let error = match raw.into_numeric_parts(&mut work) {
            Err(error) => error,
            Ok(_) => panic!("unpaid raw move"),
        };
        assert_eq!(error.code, LedgerErrorCode::Budget);
        assert_eq!(work.used(), 5);
    }

    #[test]
    fn zero_evidence_weighting_moves_same_pointers_preserves_all_zero_bits_and_true_zero_cells() {
        #[derive(serde::Deserialize)]
        struct RulesOnly {
            rules: LedgerRules,
        }
        let rules = serde_json::from_str::<RulesOnly>(include_str!(
            "../tests/fixtures/ledger-boundaries.json"
        ))
        .unwrap()
        .rules;
        let model = build_numeric_economic_tables(&rules, 3, &[], &mut LedgerWork::new()).unwrap();
        let code = InnovationCode::from_bins([0; 3], &mut LedgerWork::new()).unwrap();
        let raw = raw_for_move();
        let mass_pointer = raw.masses.as_ptr();
        let cell_pointer = raw.accounting_cells.as_ptr();
        let mut work = LedgerWork::with_limit(240380).unwrap();
        let weighted = weight_evidence(raw, &model, 0, code, &mut work).unwrap();
        assert_eq!(work.used(), 240380);
        assert_eq!(weighted.masses().as_ptr(), mass_pointer);
        assert_eq!(weighted.accounting_cells().as_ptr(), cell_pointer);
        assert_eq!(weighted.retained_mass(), 1.0);
        assert_eq!(weighted.masses()[1].to_bits(), (-0.0_f64).to_bits());
        assert!(weighted.accounting_cells()[8]);
    }
}
