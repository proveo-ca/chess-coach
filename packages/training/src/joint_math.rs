// SPEC: _spec/packages/training/burn-compat.puml
use crate::accounting_kernel::{BANK_CEILING, JOINT_SIZE, MATERIAL_CEILING};
use crate::ledger::LedgerWork;
use crate::ledger::contracts::LedgerError;

const MATERIAL_WIDTH: usize = MATERIAL_CEILING as usize + 1;
const BANKS: usize = BANK_CEILING as usize + 1;
const POTENTIAL_WIDTH: usize = MATERIAL_CEILING as usize + BANK_CEILING as usize + 1;
const MARGINAL_SIZE: usize = MATERIAL_WIDTH + POTENTIAL_WIDTH;
const HEADER: u64 = 128;
const SUPPORT_REMAINDER: u64 = 192 + 28 * JOINT_SIZE as u64;
const NORMALIZE_REMAINDER: u64 = 2 * 192 + 40 * JOINT_SIZE as u64;
const READOUT_HEADER: u64 = 256;
const READOUT_REMAINDER: u64 = 3 * 192
    + 4 * (JOINT_SIZE + MARGINAL_SIZE) as u64
    + 56 * JOINT_SIZE as u64
    + 32 * MARGINAL_SIZE as u64;
const NORMALIZATION_TOLERANCE: f64 = 1e-12;
const QUANTILES: [f64; 4] = [0.05, 0.95, 0.025, 0.975];

#[derive(Debug, PartialEq, Eq)]
pub enum JointMathError {
    Shape,
    Domain,
    NonFinite,
    Underflow,
    EmptyMass,
    EmptySupport,
    Work(LedgerError),
}

pub type JointMathResult<T> = Result<T, JointMathError>;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct NumericCertainty {
    pub material: Option<u16>,
    pub potential: Option<u16>,
}

pub struct NumericSupport {
    cells: Vec<bool>,
    certainty: NumericCertainty,
}

impl std::fmt::Debug for NumericSupport {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("NumericSupport")
            .field("certainty", &self.certainty)
            .finish_non_exhaustive()
    }
}

impl NumericSupport {
    pub fn from_cells(cells: &[bool], work: &mut LedgerWork) -> JointMathResult<Self> {
        charge(work, HEADER)?;
        if cells.len() != JOINT_SIZE {
            return Err(JointMathError::Shape);
        }
        charge(work, SUPPORT_REMAINDER)?;
        let mut owned = vec![false; JOINT_SIZE];
        let mut material_certainty = TargetCertainty::Unseen;
        let mut potential_certainty = TargetCertainty::Unseen;
        for bank in 0..BANKS {
            for material in 0..MATERIAL_WIDTH {
                let index = joint_offset(bank, material)?;
                owned[index] = cells[index];
                if cells[index] {
                    material_certainty.observe(coordinate(material)?);
                    potential_certainty.observe(coordinate(
                        material.checked_add(bank).ok_or(JointMathError::Domain)?,
                    )?);
                }
            }
        }
        if matches!(material_certainty, TargetCertainty::Unseen) {
            return Err(JointMathError::EmptySupport);
        }
        Ok(Self {
            cells: owned,
            certainty: NumericCertainty {
                material: material_certainty.value(),
                potential: potential_certainty.value(),
            },
        })
    }

    pub fn cells(&self) -> &[bool] {
        &self.cells
    }

    pub fn certainty(&self) -> NumericCertainty {
        self.certainty
    }

    pub(crate) fn copy_checked(&self, work: &mut LedgerWork) -> JointMathResult<Self> {
        charge(work, HEADER)?;
        if self.cells.len() != JOINT_SIZE {
            return Err(JointMathError::Shape);
        }
        charge(work, 192 + 8 * JOINT_SIZE as u64)?;
        let mut cells = vec![false; JOINT_SIZE];
        cells.copy_from_slice(&self.cells);
        Ok(Self {
            cells,
            certainty: self.certainty,
        })
    }
}

pub struct NumericJoint {
    probabilities: Vec<f64>,
    support: NumericSupport,
}

pub(crate) struct JointOwnedParts {
    pub(crate) probabilities: Vec<f64>,
    pub(crate) support: NumericSupport,
}

impl std::fmt::Debug for NumericJoint {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("NumericJoint")
            .field("support", &self.support)
            .finish_non_exhaustive()
    }
}

impl NumericJoint {
    pub fn probabilities(&self) -> &[f64] {
        &self.probabilities
    }

    pub fn support(&self) -> &NumericSupport {
        &self.support
    }

    pub(crate) fn into_owned_parts(
        self,
        work: &mut LedgerWork,
    ) -> Result<JointOwnedParts, LedgerError> {
        work.charge(32)?;
        let Self {
            probabilities,
            support,
        } = self;
        Ok(JointOwnedParts {
            probabilities,
            support,
        })
    }
}

pub(crate) fn normalize_aggregate_owned(
    mut masses: Vec<f64>,
    cells: Vec<bool>,
    work: &mut LedgerWork,
) -> JointMathResult<NumericJoint> {
    charge(work, HEADER)?;
    if masses.len() != JOINT_SIZE || cells.len() != JOINT_SIZE {
        return Err(JointMathError::Shape);
    }
    charge(work, 52 * JOINT_SIZE as u64)?;
    let mut material_certainty = TargetCertainty::Unseen;
    let mut potential_certainty = TargetCertainty::Unseen;
    for bank in 0..BANKS {
        for material in 0..MATERIAL_WIDTH {
            let index = joint_offset(bank, material)?;
            if cells[index] {
                material_certainty.observe(coordinate(material)?);
                potential_certainty.observe(coordinate(
                    material.checked_add(bank).ok_or(JointMathError::Domain)?,
                )?);
            }
        }
    }
    if matches!(material_certainty, TargetCertainty::Unseen) {
        return Err(JointMathError::EmptySupport);
    }
    let certainty = NumericCertainty {
        material: material_certainty.value(),
        potential: potential_certainty.value(),
    };
    let mut total = 0.0;
    for (index, mass) in masses.iter().enumerate() {
        let mass = nonnegative(*mass)?;
        if mass > 0.0 && !cells[index] {
            return Err(JointMathError::Domain);
        }
        total = finite(total + mass)?;
    }
    if total == 0.0 {
        return Err(JointMathError::EmptyMass);
    }
    let mut normalized_sum = 0.0;
    for mass in &mut masses {
        let previous = *mass;
        *mass = finite(previous / total)?;
        if previous > 0.0 && *mass == 0.0 {
            return Err(JointMathError::Underflow);
        }
        normalized_sum = finite(normalized_sum + *mass)?;
    }
    normalized(normalized_sum)?;
    Ok(NumericJoint {
        probabilities: masses,
        support: NumericSupport { cells, certainty },
    })
}

pub(crate) fn from_normalized_owned(
    probabilities: Vec<f64>,
    support: NumericSupport,
    work: &mut LedgerWork,
) -> JointMathResult<NumericJoint> {
    charge(work, HEADER)?;
    if probabilities.len() != JOINT_SIZE || support.cells.len() != JOINT_SIZE {
        return Err(JointMathError::Shape);
    }
    charge(work, 16 * JOINT_SIZE as u64)?;
    let mut total = 0.0;
    for (index, probability) in probabilities.iter().enumerate() {
        let probability = nonnegative(*probability)?;
        if probability > 0.0 && !support.cells[index] {
            return Err(JointMathError::Domain);
        }
        total = finite(total + probability)?;
    }
    if total == 0.0 {
        return Err(JointMathError::EmptyMass);
    }
    normalized(total)?;
    Ok(NumericJoint {
        probabilities,
        support,
    })
}

#[derive(Debug)]
pub struct ReadoutTemperature {
    index: u16,
    value: f64,
}

impl ReadoutTemperature {
    pub fn from_index(index: u16, work: &mut LedgerWork) -> JointMathResult<Self> {
        charge(work, HEADER)?;
        if index > 1000 {
            return Err(JointMathError::Domain);
        }
        charge(work, 32)?;
        let value = match index {
            0 => 0.25,
            250 => 0.5,
            500 => 1.0,
            750 => 2.0,
            1000 => 4.0,
            _ => {
                let exponent = finite(f64::from(index) / 1000.0)?;
                let power = finite(16.0_f64.powf(exponent))?;
                finite(0.25 * power)?
            }
        };
        Ok(Self { index, value })
    }

    pub fn index(&self) -> u16 {
        self.index
    }

    pub fn value(&self) -> f64 {
        self.value
    }
}

#[derive(Debug, PartialEq)]
pub struct NumericReadout {
    pub mean_d: f64,
    pub mean_potential: f64,
    pub quantiles_d: [u16; 4],
    pub quantiles_potential: [u16; 4],
    pub balance: f64,
    pub uncertainty: f64,
}

pub fn normalize_aggregate(
    masses: &[f64],
    support: &NumericSupport,
    work: &mut LedgerWork,
) -> JointMathResult<NumericJoint> {
    charge(work, HEADER)?;
    if masses.len() != JOINT_SIZE {
        return Err(JointMathError::Shape);
    }
    charge(work, NORMALIZE_REMAINDER)?;
    let mut probabilities = vec![0.0; JOINT_SIZE];
    let mut cells = vec![false; JOINT_SIZE];
    let mut total = 0.0;
    for (index, mass) in masses.iter().enumerate() {
        let mass = nonnegative(*mass)?;
        if mass > 0.0 && !support.cells[index] {
            return Err(JointMathError::Domain);
        }
        total = finite(total + mass)?;
    }
    if total == 0.0 {
        return Err(JointMathError::EmptyMass);
    }
    let mut normalized_sum = 0.0;
    for (index, mass) in masses.iter().enumerate() {
        let probability = finite(*mass / total)?;
        if *mass > 0.0 && probability == 0.0 {
            return Err(JointMathError::Underflow);
        }
        probabilities[index] = probability;
        normalized_sum = finite(normalized_sum + probability)?;
    }
    normalized(normalized_sum)?;
    cells.copy_from_slice(&support.cells);
    Ok(NumericJoint {
        probabilities,
        support: NumericSupport {
            cells,
            certainty: support.certainty,
        },
    })
}

pub fn readout_copy(
    joint: &NumericJoint,
    own_replacement: u16,
    temperature: &ReadoutTemperature,
    work: &mut LedgerWork,
) -> JointMathResult<NumericReadout> {
    charge(work, READOUT_HEADER)?;
    if own_replacement > MATERIAL_CEILING {
        return Err(JointMathError::Domain);
    }
    charge(work, READOUT_REMAINDER)?;
    let mut scratch = vec![0.0; JOINT_SIZE];
    let mut marginal_d = vec![0.0; MATERIAL_WIDTH];
    let mut marginal_potential = vec![0.0; POTENTIAL_WIDTH];
    let mut input_sum = 0.0;
    let mut maximum: Option<f64> = None;
    for (index, probability) in joint.probabilities.iter().enumerate() {
        let probability = nonnegative(*probability)?;
        if probability > 0.0 && !joint.support.cells[index] {
            return Err(JointMathError::Domain);
        }
        input_sum = finite(input_sum + probability)?;
        if probability > 0.0 {
            let logarithm = finite(probability.ln())?;
            let scaled = finite(logarithm / temperature.value)?;
            scratch[index] = scaled;
            maximum = Some(match maximum {
                Some(previous) if previous > scaled => previous,
                _ => scaled,
            });
        } else {
            scratch[index] = probability;
        }
    }
    normalized(input_sum)?;
    let maximum = maximum.ok_or(JointMathError::EmptyMass)?;
    let mut exponential_sum = 0.0;
    for (index, value) in scratch.iter_mut().enumerate() {
        if joint.probabilities[index] > 0.0 {
            let shifted = finite(*value - maximum)?;
            let exponential = finite(shifted.exp())?;
            if exponential == 0.0 {
                return Err(JointMathError::Underflow);
            }
            *value = exponential;
            exponential_sum = finite(exponential_sum + exponential)?;
        }
    }
    let mut tempered_sum = 0.0;
    for (index, value) in scratch.iter_mut().enumerate() {
        if joint.probabilities[index] > 0.0 {
            let probability = finite(*value / exponential_sum)?;
            if probability == 0.0 {
                return Err(JointMathError::Underflow);
            }
            *value = probability;
            tempered_sum = finite(tempered_sum + probability)?;
        }
    }
    normalized(tempered_sum)?;
    let mut mean_d = 0.0;
    let mut mean_potential = 0.0;
    let mut compensation_d = 0.0;
    let mut compensation_potential = 0.0;
    for bank in 0..BANKS {
        for (material, marginal) in marginal_d.iter_mut().enumerate() {
            let index = joint_offset(bank, material)?;
            let potential = material.checked_add(bank).ok_or(JointMathError::Domain)?;
            let probability = scratch[index];
            *marginal = finite(*marginal + probability)?;
            marginal_potential[potential] = finite(marginal_potential[potential] + probability)?;
            let d_term = finite(f64::from(coordinate(material)?) * probability)?;
            let potential_term = finite(f64::from(coordinate(potential)?) * probability)?;
            accumulate_mean(&mut mean_d, &mut compensation_d, d_term)?;
            accumulate_mean(
                &mut mean_potential,
                &mut compensation_potential,
                potential_term,
            )?;
        }
    }
    let mut quantiles_d = [0; 4];
    let mut quantiles_potential = [0; 4];
    for (index, threshold) in QUANTILES.iter().enumerate() {
        quantiles_d[index] = quantile(&marginal_d, *threshold)?;
        quantiles_potential[index] = quantile(&marginal_potential, *threshold)?;
    }
    if let Some(material) = joint.support.certainty.material {
        mean_d = certain_mean(&quantiles_d, material)?;
    }
    if let Some(potential) = joint.support.certainty.potential {
        mean_potential = certain_mean(&quantiles_potential, potential)?;
    }
    let balance = finite(f64::from(own_replacement) - mean_d)?;
    let width = quantiles_d[3]
        .checked_sub(quantiles_d[2])
        .ok_or(JointMathError::Domain)?;
    let uncertainty = finite(f64::from(width) / 2.0)?;
    Ok(NumericReadout {
        mean_d,
        mean_potential,
        quantiles_d,
        quantiles_potential,
        balance,
        uncertainty,
    })
}

enum TargetCertainty {
    Unseen,
    Fixed(u16),
    Varied,
}

impl TargetCertainty {
    fn observe(&mut self, value: u16) {
        match self {
            Self::Unseen => *self = Self::Fixed(value),
            Self::Fixed(previous) if *previous != value => *self = Self::Varied,
            _ => {}
        }
    }

    fn value(self) -> Option<u16> {
        match self {
            Self::Fixed(value) => Some(value),
            Self::Unseen | Self::Varied => None,
        }
    }
}

fn quantile(marginal: &[f64], threshold: f64) -> JointMathResult<u16> {
    let mut cumulative = 0.0;
    let mut first = None;
    for (index, mass) in marginal.iter().enumerate() {
        cumulative = finite(cumulative + nonnegative(*mass)?)?;
        if first.is_none() && cumulative >= threshold {
            first = Some(coordinate(index)?);
        }
    }
    normalized(cumulative)?;
    first.ok_or(JointMathError::NonFinite)
}

fn certain_mean(quantiles: &[u16; 4], target: u16) -> JointMathResult<f64> {
    if quantiles.iter().any(|quantile| *quantile != target) {
        return Err(JointMathError::NonFinite);
    }
    Ok(f64::from(target))
}

fn accumulate_mean(total: &mut f64, compensation: &mut f64, term: f64) -> JointMathResult<()> {
    let adjusted = finite(term - *compensation)?;
    let next = finite(*total + adjusted)?;
    let recovered = finite(next - *total)?;
    *compensation = finite(recovered - adjusted)?;
    *total = next;
    Ok(())
}

fn joint_offset(bank: usize, material: usize) -> JointMathResult<usize> {
    bank.checked_mul(MATERIAL_WIDTH)
        .and_then(|offset| offset.checked_add(material))
        .filter(|index| *index < JOINT_SIZE)
        .ok_or(JointMathError::Domain)
}

fn coordinate(value: usize) -> JointMathResult<u16> {
    u16::try_from(value).map_err(|_| JointMathError::Domain)
}

fn finite(value: f64) -> JointMathResult<f64> {
    if value.is_finite() {
        Ok(value)
    } else {
        Err(JointMathError::NonFinite)
    }
}

fn nonnegative(value: f64) -> JointMathResult<f64> {
    let value = finite(value)?;
    if value < 0.0 {
        Err(JointMathError::Domain)
    } else {
        Ok(value)
    }
}

fn normalized(total: f64) -> JointMathResult<()> {
    if finite(total - 1.0)?.abs() <= NORMALIZATION_TOLERANCE {
        Ok(())
    } else {
        Err(JointMathError::NonFinite)
    }
}

fn charge(work: &mut LedgerWork, amount: u64) -> JointMathResult<()> {
    work.charge(amount).map_err(JointMathError::Work)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn owned_buffers() -> (Vec<f64>, Vec<bool>) {
        let mut masses = vec![-0.0; JOINT_SIZE];
        masses[4] = 0.125;
        masses[MATERIAL_WIDTH + 4] = 0.5;
        let mut cells = vec![false; JOINT_SIZE];
        cells[4] = true;
        cells[MATERIAL_WIDTH + 4] = true;
        cells[12 * MATERIAL_WIDTH + 4] = true;
        (masses, cells)
    }

    #[test]
    fn owned_normalization_moves_both_heaps_matches_old_public_bits_and_saves_real_replacements() {
        let (masses, cells) = owned_buffers();
        let mut old_work = LedgerWork::new();
        let support = NumericSupport::from_cells(&cells, &mut old_work).unwrap();
        let expected = normalize_aggregate(&masses, &support, &mut old_work).unwrap();
        assert_eq!(old_work.used(), 510900);
        let mass_pointer = masses.as_ptr();
        let cell_pointer = cells.as_ptr();
        let mut work = LedgerWork::with_limit(390180).unwrap();
        let joint = normalize_aggregate_owned(masses, cells, &mut work).unwrap();
        assert_eq!(work.used(), 390180);
        assert_eq!(old_work.used() - work.used(), 120720);
        assert_eq!(joint.probabilities.as_ptr(), mass_pointer);
        assert_eq!(joint.support.cells.as_ptr(), cell_pointer);
        assert_eq!(
            joint.support.certainty,
            NumericCertainty {
                material: Some(4),
                potential: None
            }
        );
        for (actual, expected) in joint.probabilities.iter().zip(&expected.probabilities) {
            assert_eq!(actual.to_bits(), expected.to_bits());
        }
        assert_eq!(joint.support.cells, expected.support.cells);
    }

    #[test]
    fn owned_normalization_prepays_shapes_masks_domains_overflow_and_positive_underflow() {
        for (masses, cells) in [
            (vec![], vec![false; JOINT_SIZE]),
            (vec![0.0; JOINT_SIZE], vec![]),
        ] {
            let mut work = LedgerWork::with_limit(128).unwrap();
            assert_eq!(
                normalize_aggregate_owned(masses, cells, &mut work).unwrap_err(),
                JointMathError::Shape
            );
            assert_eq!(work.used(), 128);
        }
        for case in 0..8 {
            let mut masses = vec![0.0; JOINT_SIZE];
            let mut cells = vec![false; JOINT_SIZE];
            cells[0] = true;
            let expected = match case {
                0 => {
                    cells[0] = false;
                    JointMathError::EmptySupport
                }
                1 => JointMathError::EmptyMass,
                2 => {
                    masses[0] = f64::NAN;
                    JointMathError::NonFinite
                }
                3 => {
                    masses[0] = f64::INFINITY;
                    JointMathError::NonFinite
                }
                4 => {
                    masses[0] = -1.0;
                    JointMathError::Domain
                }
                5 => {
                    masses[1] = 1.0;
                    JointMathError::Domain
                }
                6 => {
                    masses[0] = f64::MAX;
                    masses[1] = f64::MAX;
                    cells[1] = true;
                    JointMathError::NonFinite
                }
                _ => {
                    masses[0] = 2.0;
                    masses[1] = f64::from_bits(1);
                    cells[1] = true;
                    JointMathError::Underflow
                }
            };
            let mut work = LedgerWork::with_limit(390180).unwrap();
            assert_eq!(
                normalize_aggregate_owned(masses, cells, &mut work).unwrap_err(),
                expected
            );
            assert_eq!(work.used(), 390180);
        }
        let (masses, cells) = owned_buffers();
        let mut short = LedgerWork::with_limit(390179).unwrap();
        assert!(
            matches!(normalize_aggregate_owned(masses, cells, &mut short), Err(JointMathError::Work(ref error)) if error.code == crate::ledger::contracts::LedgerErrorCode::Budget)
        );
        assert_eq!(short.used(), 128);
    }

    #[test]
    fn checked_support_copy_and_normalized_owned_constructor_pay_exact_fees_without_dividing_again()
    {
        let (_, cells) = owned_buffers();
        let support = NumericSupport::from_cells(&cells, &mut LedgerWork::new()).unwrap();
        let mut copy_work = LedgerWork::with_limit(60328).unwrap();
        let copied = support.copy_checked(&mut copy_work).unwrap();
        assert_eq!(copy_work.used(), 60328);
        assert_ne!(copied.cells.as_ptr(), support.cells.as_ptr());
        assert_eq!(copied.certainty, support.certainty);
        let mut probabilities = vec![-0.0_f64; JOINT_SIZE];
        probabilities[4] = 0.50000000000005;
        probabilities[MATERIAL_WIDTH + 4] = 0.5;
        let expected_bits: Vec<_> = probabilities.iter().map(|value| value.to_bits()).collect();
        let probability_pointer = probabilities.as_ptr();
        let support_pointer = copied.cells.as_ptr();
        let mut work = LedgerWork::with_limit(120144).unwrap();
        let joint = from_normalized_owned(probabilities, copied, &mut work).unwrap();
        assert_eq!(work.used(), 120144);
        assert_eq!(joint.probabilities.as_ptr(), probability_pointer);
        assert_eq!(joint.support.cells.as_ptr(), support_pointer);
        for (value, bits) in joint.probabilities.iter().zip(expected_bits) {
            assert_eq!(value.to_bits(), bits);
        }
        let mut short = LedgerWork::with_limit(60327).unwrap();
        assert!(
            matches!(support.copy_checked(&mut short), Err(JointMathError::Work(ref error)) if error.code == crate::ledger::contracts::LedgerErrorCode::Budget)
        );
        assert_eq!(short.used(), 128);
        let malformed = NumericSupport {
            cells: vec![],
            certainty: NumericCertainty {
                material: None,
                potential: None,
            },
        };
        let mut work = LedgerWork::with_limit(128).unwrap();
        assert_eq!(
            malformed.copy_checked(&mut work).unwrap_err(),
            JointMathError::Shape
        );
        assert_eq!(work.used(), 128);
        let support = support.copy_checked(&mut LedgerWork::new()).unwrap();
        let mut short = LedgerWork::with_limit(120143).unwrap();
        assert!(
            matches!(from_normalized_owned(vec![f64::NAN; JOINT_SIZE], support, &mut short), Err(JointMathError::Work(ref error)) if error.code == crate::ledger::contracts::LedgerErrorCode::Budget)
        );
        assert_eq!(short.used(), 128);
    }

    #[test]
    fn normalized_owned_constructor_checks_shapes_and_numeric_invariants_before_any_result() {
        for case in 0..7 {
            let mut probabilities = vec![0.0; JOINT_SIZE];
            let mut cells = vec![false; JOINT_SIZE];
            cells[0] = true;
            let expected = match case {
                0 => JointMathError::EmptyMass,
                1 => {
                    probabilities[0] = f64::NAN;
                    JointMathError::NonFinite
                }
                2 => {
                    probabilities[0] = f64::INFINITY;
                    JointMathError::NonFinite
                }
                3 => {
                    probabilities[0] = -0.5;
                    JointMathError::Domain
                }
                4 => {
                    probabilities[1] = 1.0;
                    JointMathError::Domain
                }
                5 => {
                    probabilities[0] = 0.5;
                    JointMathError::NonFinite
                }
                _ => {
                    probabilities.clear();
                    JointMathError::Shape
                }
            };
            let support = NumericSupport::from_cells(&cells, &mut LedgerWork::new()).unwrap();
            let mut work = LedgerWork::new();
            assert_eq!(
                from_normalized_owned(probabilities, support, &mut work).unwrap_err(),
                expected
            );
            assert_eq!(work.used(), if case == 6 { 128 } else { 120144 });
        }
        let support = NumericSupport {
            cells: vec![],
            certainty: NumericCertainty {
                material: None,
                potential: None,
            },
        };
        let mut work = LedgerWork::with_limit(128).unwrap();
        assert_eq!(
            from_normalized_owned(vec![0.0; JOINT_SIZE], support, &mut work).unwrap_err(),
            JointMathError::Shape
        );
        assert_eq!(work.used(), 128);
    }

    #[test]
    fn joint_owned_parts_move_probability_mask_and_checked_certainty_after_32() {
        let (masses, cells) = owned_buffers();
        let joint = normalize_aggregate_owned(masses, cells, &mut LedgerWork::new()).unwrap();
        let probability_pointer = joint.probabilities.as_ptr();
        let support_pointer = joint.support.cells.as_ptr();
        let certainty = joint.support.certainty;
        let mut exact = LedgerWork::with_limit(32).unwrap();
        let parts = joint.into_owned_parts(&mut exact).unwrap();
        assert_eq!(exact.used(), 32);
        assert_eq!(parts.probabilities.as_ptr(), probability_pointer);
        assert_eq!(parts.support.cells.as_ptr(), support_pointer);
        assert_eq!(parts.support.certainty, certainty);
        let (masses, cells) = owned_buffers();
        let joint = normalize_aggregate_owned(masses, cells, &mut LedgerWork::new()).unwrap();
        let mut short = LedgerWork::with_limit(38).unwrap();
        short.charge(7).unwrap();
        let error = match joint.into_owned_parts(&mut short) {
            Err(error) => error,
            Ok(_) => panic!("unpaid joint move"),
        };
        assert_eq!(
            error.code,
            crate::ledger::contracts::LedgerErrorCode::Budget
        );
        assert_eq!(short.used(), 7);
    }

    #[test]
    fn certain_mean_checks_each_quantile_without_repairing_it() {
        assert_eq!(certain_mean(&[7; 4], 7).unwrap(), 7.0);
        for index in 0..4 {
            let mut quantiles = [7; 4];
            quantiles[index] = 8;
            let before = quantiles;
            assert_eq!(
                certain_mean(&quantiles, 7).unwrap_err(),
                JointMathError::NonFinite
            );
            assert_eq!(quantiles, before);
        }
    }

    #[test]
    fn readout_refuses_inconsistent_private_certainty_after_full_numerical_reservation() {
        for certainty in [
            NumericCertainty {
                material: Some(8),
                potential: None,
            },
            NumericCertainty {
                material: None,
                potential: Some(8),
            },
        ] {
            let mut probabilities = vec![0.0; JOINT_SIZE];
            probabilities[7] = 1.0;
            let mut cells = vec![false; JOINT_SIZE];
            cells[7] = true;
            let joint = NumericJoint {
                probabilities,
                support: NumericSupport { cells, certainty },
            };
            let mut work = LedgerWork::new();
            let temperature = ReadoutTemperature::from_index(500, &mut work).unwrap();
            let error = match readout_copy(&joint, 7, &temperature, &mut work) {
                Err(error) => error,
                Ok(_) => panic!("inconsistent cached certainty overwrote computed quantiles"),
            };
            assert_eq!(error, JointMathError::NonFinite);
            assert_eq!(work.used(), 160 + 492868);
            assert_eq!(joint.probabilities[7], 1.0);
            assert!(joint.support.cells[7]);
        }
    }
}
