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
}

pub struct NumericJoint {
    probabilities: Vec<f64>,
    support: NumericSupport,
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
