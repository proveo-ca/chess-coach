// SPEC: _spec/packages/training/burn-compat.puml, _spec/packages/training/belief-integration.puml
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

// SPEC: _spec/packages/training/belief-integration.puml
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SupportRun {
    pub bank: u8,
    pub lower: u16,
    pub upper: u16,
}

#[derive(Debug)]
pub struct SupportRuns {
    runs: Vec<SupportRun>,
    certainty: NumericCertainty,
    count: usize,
}

impl SupportRuns {
    pub fn from_slice(runs: &[SupportRun], work: &mut LedgerWork) -> JointMathResult<Self> {
        charge(work, 128)?;
        if runs.is_empty() || runs.len() > JOINT_SIZE { return Err(JointMathError::EmptySupport); }
        charge(work, 192 + 12 * runs.len() as u64)?;
        Self::from_owned(runs.to_vec(), work)
    }

    pub fn from_owned(runs: Vec<SupportRun>, work: &mut LedgerWork) -> JointMathResult<Self> {
        charge(work, 128)?;
        if runs.is_empty() || runs.len() > JOINT_SIZE { return Err(JointMathError::EmptySupport); }
        let mut previous: Option<SupportRun> = None;
        let mut count = 0_usize;
        let mut material = TargetCertainty::Unseen;
        let mut potential = TargetCertainty::Unseen;
        for run in &runs {
            charge(work, 64)?;
            if run.bank > BANK_CEILING || run.lower > run.upper || run.upper > MATERIAL_CEILING
                || previous.is_some_and(|old| run.bank < old.bank
                    || run.bank == old.bank && run.lower <= old.upper + 1)
            { return Err(JointMathError::Domain); }
            count = count.checked_add(usize::from(run.upper - run.lower) + 1)
                .filter(|count| *count <= JOINT_SIZE).ok_or(JointMathError::Domain)?;
            material.observe(run.lower);
            material.observe(run.upper);
            potential.observe(run.lower + u16::from(run.bank));
            potential.observe(run.upper + u16::from(run.bank));
            previous = Some(*run);
        }
        charge(work, 32)?;
        Ok(Self { runs, count, certainty: NumericCertainty { material: material.value(), potential: potential.value() } })
    }

    pub fn runs(&self) -> &[SupportRun] { &self.runs }
    pub fn cell_count(&self) -> usize { self.count }
    pub fn certainty(&self) -> NumericCertainty { self.certainty }
}

impl NumericSupport {
    pub fn from_runs(runs: &SupportRuns, work: &mut LedgerWork) -> JointMathResult<Self> {
        charge(work, 128 + 192 + 4 * JOINT_SIZE as u64)?;
        let mut cells = vec![false; JOINT_SIZE];
        for run in runs.runs() {
            charge(work, 32)?;
            for material in run.lower..=run.upper {
                charge(work, 16)?;
                cells[usize::from(run.bank) * MATERIAL_WIDTH + usize::from(material)] = true;
            }
        }
        charge(work, 32)?;
        Ok(Self { cells, certainty: runs.certainty })
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct SparseCell {
    pub bank: u8,
    pub material: u16,
    pub probability: f64,
}

pub fn readout_sparse_copy(
    cells: &[SparseCell],
    support: &NumericSupport,
    own_replacement: u16,
    temperature: &ReadoutTemperature,
    work: &mut LedgerWork,
) -> JointMathResult<NumericReadout> {
    charge(work, 256)?;
    if cells.is_empty() || cells.len() > JOINT_SIZE || support.cells.len() != JOINT_SIZE
        || own_replacement > MATERIAL_CEILING || !temperature.value.is_finite()
        || !(0.25..=4.0).contains(&temperature.value)
    { return Err(JointMathError::Domain); }
    let mut previous = None;
    let mut input_sum = 0.0;
    for cell in cells {
        charge(work, 32)?;
        if cell.bank > BANK_CEILING || cell.material > MATERIAL_CEILING { return Err(JointMathError::Domain); }
        let index = joint_offset(usize::from(cell.bank), usize::from(cell.material))?;
        let probability = nonnegative(cell.probability)?;
        if probability == 0.0 || !support.cells[index] || previous.is_some_and(|old| index <= old) {
            return Err(JointMathError::Domain);
        }
        previous = Some(index);
        input_sum = finite(input_sum + probability)?;
    }
    charge(work, 32)?;
    normalized(input_sum)?;
    charge(work, 192 + 4 * cells.len() as u64)?;
    let mut scratch = vec![0.0; cells.len()];
    let mut maximum: Option<f64> = None;
    for (offset, cell) in cells.iter().enumerate() {
        charge(work, 32)?;
        let logarithm = finite(cell.probability.ln())?;
        let scaled = finite(logarithm / temperature.value)?;
        scratch[offset] = scaled;
        maximum = Some(match maximum { Some(old) if old > scaled => old, _ => scaled });
    }
    let maximum = maximum.ok_or(JointMathError::EmptyMass)?;
    let mut exponential_sum = 0.0;
    for value in &mut scratch {
        charge(work, 32)?;
        let shifted = finite(*value - maximum)?;
        let exponential = finite(shifted.exp())?;
        if exponential == 0.0 { return Err(JointMathError::Underflow); }
        *value = exponential;
        exponential_sum = finite(exponential_sum + exponential)?;
    }
    let mut tempered_sum = 0.0;
    for value in &mut scratch {
        charge(work, 32)?;
        let probability = finite(*value / exponential_sum)?;
        if probability == 0.0 { return Err(JointMathError::Underflow); }
        *value = probability;
        tempered_sum = finite(tempered_sum + probability)?;
    }
    charge(work, 32)?;
    normalized(tempered_sum)?;
    charge(work, 192 + 4 * MATERIAL_WIDTH as u64)?;
    let mut marginal_d = vec![0.0; MATERIAL_WIDTH];
    charge(work, 192 + 4 * POTENTIAL_WIDTH as u64)?;
    let mut marginal_potential = vec![0.0; POTENTIAL_WIDTH];
    let mut mean_d = 0.0;
    let mut mean_potential = 0.0;
    let mut compensation_d = 0.0;
    let mut compensation_potential = 0.0;
    let mut cursor = 0_usize;
    for bank in 0..BANKS {
        for (material, marginal) in marginal_d.iter_mut().enumerate() {
            charge(work, 8)?;
            let index = joint_offset(bank, material)?;
            if !cells.get(cursor).is_some_and(|cell|
                usize::from(cell.bank) * MATERIAL_WIDTH + usize::from(cell.material) == index)
            {
                charge(work, 16)?;
                accumulate_mean(&mut mean_d, &mut compensation_d, 0.0)?;
                accumulate_mean(&mut mean_potential, &mut compensation_potential, 0.0)?;
                continue;
            }
            charge(work, 24)?;
            let probability = scratch[cursor];
            cursor += 1;
            let potential = material.checked_add(bank).ok_or(JointMathError::Domain)?;
            *marginal = finite(*marginal + probability)?;
            marginal_potential[potential] = finite(marginal_potential[potential] + probability)?;
            let d_term = finite(f64::from(coordinate(material)?) * probability)?;
            let p_term = finite(f64::from(coordinate(potential)?) * probability)?;
            accumulate_mean(&mut mean_d, &mut compensation_d, d_term)?;
            accumulate_mean(&mut mean_potential, &mut compensation_potential, p_term)?;
        }
    }
    charge(work, 32 + 32 * MARGINAL_SIZE as u64)?;
    let mut quantiles_d = [0; 4];
    let mut quantiles_potential = [0; 4];
    for (index, threshold) in QUANTILES.iter().enumerate() {
        quantiles_d[index] = quantile(&marginal_d, *threshold)?;
        quantiles_potential[index] = quantile(&marginal_potential, *threshold)?;
    }
    if let Some(material) = support.certainty.material { mean_d = certain_mean(&quantiles_d, material)?; }
    if let Some(potential) = support.certainty.potential { mean_potential = certain_mean(&quantiles_potential, potential)?; }
    charge(work, 64)?;
    let balance = finite(f64::from(own_replacement) - mean_d)?;
    let width = quantiles_d[3].checked_sub(quantiles_d[2]).ok_or(JointMathError::Domain)?;
    let uncertainty = finite(f64::from(width) / 2.0)?;
    Ok(NumericReadout { mean_d, mean_potential, quantiles_d, quantiles_potential, balance, uncertainty })
}

// SPEC: _spec/packages/training/belief-integration.puml
pub fn readout_sparse_runs_copy(
    cells: &[SparseCell],
    support: &NumericSupport,
    own_replacement: u16,
    temperature: &ReadoutTemperature,
    work: &mut LedgerWork,
) -> JointMathResult<NumericReadout> {
    charge(work, 256)?;
    if cells.is_empty() || cells.len() > JOINT_SIZE || support.cells.len() != JOINT_SIZE
        || own_replacement > MATERIAL_CEILING || !temperature.value.is_finite()
        || !(0.25..=4.0).contains(&temperature.value)
    { return Err(JointMathError::Domain); }
    let mut previous = None;
    let mut input_sum = 0.0;
    for cell in cells {
        charge(work, 32)?;
        if cell.bank > BANK_CEILING || cell.material > MATERIAL_CEILING { return Err(JointMathError::Domain); }
        let index = joint_offset(usize::from(cell.bank), usize::from(cell.material))?;
        let probability = nonnegative(cell.probability)?;
        if probability == 0.0 || !support.cells[index] || previous.is_some_and(|old| index <= old) {
            return Err(JointMathError::Domain);
        }
        previous = Some(index);
        input_sum = finite(input_sum + probability)?;
    }
    charge(work, 32)?;
    normalized(input_sum)?;
    charge(work, 192 + 4 * cells.len() as u64)?;
    let mut scratch = vec![0.0; cells.len()];
    let mut maximum: Option<f64> = None;
    for (offset, cell) in cells.iter().enumerate() {
        charge(work, 32)?;
        let logarithm = finite(cell.probability.ln())?;
        let scaled = finite(logarithm / temperature.value)?;
        scratch[offset] = scaled;
        maximum = Some(match maximum { Some(old) if old > scaled => old, _ => scaled });
    }
    let maximum = maximum.ok_or(JointMathError::EmptyMass)?;
    let mut exponential_sum = 0.0;
    for value in &mut scratch {
        charge(work, 32)?;
        let shifted = finite(*value - maximum)?;
        let exponential = finite(shifted.exp())?;
        if exponential == 0.0 { return Err(JointMathError::Underflow); }
        *value = exponential;
        exponential_sum = finite(exponential_sum + exponential)?;
    }
    let mut tempered_sum = 0.0;
    for value in &mut scratch {
        charge(work, 32)?;
        let probability = finite(*value / exponential_sum)?;
        if probability == 0.0 { return Err(JointMathError::Underflow); }
        *value = probability;
        tempered_sum = finite(tempered_sum + probability)?;
    }
    charge(work, 32)?;
    normalized(tempered_sum)?;
    charge(work, 192 + 4 * MATERIAL_WIDTH as u64)?;
    let mut marginal_d = vec![0.0; MATERIAL_WIDTH];
    charge(work, 192 + 4 * POTENTIAL_WIDTH as u64)?;
    let mut marginal_potential = vec![0.0; POTENTIAL_WIDTH];
    let mut mean_d = 0.0;
    let mut mean_potential = 0.0;
    let mut compensation_d = 0.0;
    let mut compensation_potential = 0.0;
    let mut cursor = 0_usize;
    for (offset, cell) in cells.iter().enumerate() {
        charge(work, 16)?;
        let index = joint_offset(usize::from(cell.bank), usize::from(cell.material))?;
        if cursor < index {
            accumulate_zero_mean_run(index - cursor, &mut mean_d, &mut compensation_d,
                &mut mean_potential, &mut compensation_potential, work)?;
        }
        charge(work, 32)?;
        let material = usize::from(cell.material);
        let potential = material.checked_add(usize::from(cell.bank)).ok_or(JointMathError::Domain)?;
        let probability = scratch[offset];
        marginal_d[material] = finite(marginal_d[material] + probability)?;
        marginal_potential[potential] = finite(marginal_potential[potential] + probability)?;
        let d_term = finite(f64::from(coordinate(material)?) * probability)?;
        let p_term = finite(f64::from(coordinate(potential)?) * probability)?;
        accumulate_mean(&mut mean_d, &mut compensation_d, d_term)?;
        accumulate_mean(&mut mean_potential, &mut compensation_potential, p_term)?;
        cursor = index + 1;
    }
    charge(work, 16)?;
    if cursor < JOINT_SIZE {
        accumulate_zero_mean_run(JOINT_SIZE - cursor, &mut mean_d, &mut compensation_d,
            &mut mean_potential, &mut compensation_potential, work)?;
    }
    charge(work, 32 + 32 * MARGINAL_SIZE as u64)?;
    let mut quantiles_d = [0; 4];
    let mut quantiles_potential = [0; 4];
    for (index, threshold) in QUANTILES.iter().enumerate() {
        quantiles_d[index] = quantile(&marginal_d, *threshold)?;
        quantiles_potential[index] = quantile(&marginal_potential, *threshold)?;
    }
    if let Some(material) = support.certainty.material { mean_d = certain_mean(&quantiles_d, material)?; }
    if let Some(potential) = support.certainty.potential { mean_potential = certain_mean(&quantiles_potential, potential)?; }
    charge(work, 64)?;
    let balance = finite(f64::from(own_replacement) - mean_d)?;
    let width = quantiles_d[3].checked_sub(quantiles_d[2]).ok_or(JointMathError::Domain)?;
    let uncertainty = finite(f64::from(width) / 2.0)?;
    Ok(NumericReadout { mean_d, mean_potential, quantiles_d, quantiles_potential, balance, uncertainty })
}

// SPEC: _spec/packages/training/belief-integration.puml
fn accumulate_zero_mean_run(
    length: usize,
    mean_d: &mut f64,
    compensation_d: &mut f64,
    mean_potential: &mut f64,
    compensation_potential: &mut f64,
    work: &mut LedgerWork,
) -> JointMathResult<()> {
    charge(work, 32)?;
    if length == 0 || length > JOINT_SIZE { return Err(JointMathError::Domain); }
    for _ in 0..length {
        charge(work, 40)?;
        let before = [mean_d.to_bits(), compensation_d.to_bits(),
            mean_potential.to_bits(), compensation_potential.to_bits()];
        accumulate_mean(mean_d, compensation_d, 0.0)?;
        accumulate_mean(mean_potential, compensation_potential, 0.0)?;
        let after = [mean_d.to_bits(), compensation_d.to_bits(),
            mean_potential.to_bits(), compensation_potential.to_bits()];
        if before == after { break; }
    }
    Ok(())
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

    // WHAT: Paired zero-run fixed-point coverage.
    #[test]
    fn zero_mean_runs_match_full_transitions_for_private_signed_zero_and_compensated_states() {
        fn step(sum: &mut f64, compensation: &mut f64) {
            let adjusted = 0.0 - *compensation;
            let next = *sum + adjusted;
            let recovered = next - *sum;
            *compensation = recovered - adjusted;
            *sum = next;
        }
        fn bits(state: &[f64; 4]) -> [u64; 4] {
            state.map(f64::to_bits)
        }
        let states = [
            [-0.0, -0.0, -0.0, -0.0],
            [-0.0, 0.0, 0.0, -0.0],
            [0.0, f64::from_bits(1), -0.0, -f64::from_bits(1)],
            [1.0, f64::EPSILON, 2.0, -f64::EPSILON],
            [1.0, f64::EPSILON / 4.0, 2.0, f64::EPSILON / 2.0],
            [1e100, -1e80, -1e100, 1e80],
        ];
        let mut changed_first_step = false;
        for initial in states {
            for length in [1, 2, 3, JOINT_SIZE] {
                let mut expected = initial;
                let mut visits = 0_u64;
                let mut fixed = false;
                for _ in 0..length {
                    let before = bits(&expected);
                    let [mut d, mut cd, mut p, mut cp] = expected;
                    step(&mut d, &mut cd);
                    step(&mut p, &mut cp);
                    expected = [d, cd, p, cp];
                    if !fixed {
                        visits += 1;
                        fixed = before == bits(&expected);
                    }
                }
                changed_first_step |= visits > 1;
                let invoice = 32 + 40 * visits;
                let [mut d, mut cd, mut p, mut cp] = initial;
                let mut exact = LedgerWork::with_limit(7 + invoice).unwrap();
                exact.charge(7).unwrap();
                accumulate_zero_mean_run(length, &mut d, &mut cd, &mut p, &mut cp, &mut exact).unwrap();
                assert_eq!(bits(&[d, cd, p, cp]), bits(&expected));
                assert_eq!(exact.used(), 7 + invoice);
                let [mut d, mut cd, mut p, mut cp] = initial;
                let mut short = LedgerWork::with_limit(7 + invoice - 1).unwrap();
                short.charge(7).unwrap();
                assert!(matches!(
                    accumulate_zero_mean_run(length, &mut d, &mut cd, &mut p, &mut cp, &mut short),
                    Err(JointMathError::Work(ref error)) if error.code == crate::ledger::contracts::LedgerErrorCode::Budget
                ));
                assert_eq!(short.used(), 7 + invoice - 40);
            }
        }
        assert!(changed_first_step);
    }

    // Zero-run validation and prepaid transition failures.
    #[test]
    fn zero_mean_runs_validate_bounds_and_never_execute_an_unpaid_transition() {
        for length in [0, JOINT_SIZE + 1, usize::MAX] {
            let mut d = -0.0_f64;
            let mut cd = -0.0_f64;
            let mut p = 1.0_f64;
            let mut cp = f64::EPSILON;
            let before = [d, cd, p, cp].map(f64::to_bits);
            let mut work = LedgerWork::with_limit(32).unwrap();
            assert_eq!(accumulate_zero_mean_run(length, &mut d, &mut cd, &mut p, &mut cp, &mut work).unwrap_err(), JointMathError::Domain);
            assert_eq!(work.used(), 32);
            assert_eq!([d, cd, p, cp].map(f64::to_bits), before);
        }
        for limit in [31, 71] {
            let mut d = -0.0_f64;
            let mut cd = -0.0_f64;
            let mut p = 1.0_f64;
            let mut cp = f64::EPSILON;
            let before = [d, cd, p, cp].map(f64::to_bits);
            let mut work = LedgerWork::with_limit(limit).unwrap();
            assert!(matches!(accumulate_zero_mean_run(3, &mut d, &mut cd, &mut p, &mut cp, &mut work),
                Err(JointMathError::Work(ref error)) if error.code == crate::ledger::contracts::LedgerErrorCode::Budget));
            assert_eq!(work.used(), if limit == 31 { 0 } else { 32 });
            assert_eq!([d, cd, p, cp].map(f64::to_bits), before);
        }
    }

    // Sparse-run private header and certainty rejection coverage.
    #[test]
    fn sparse_runs_keep_private_header_checks_and_reject_inconsistent_certainty() {
        let valid = ReadoutTemperature { index: 500, value: 1.0 };
        let cells = [SparseCell { bank: 0, material: 7, probability: 1.0 }];
        let malformed = NumericSupport {
            cells: vec![], certainty: NumericCertainty { material: None, potential: None },
        };
        let mut work = LedgerWork::with_limit(256).unwrap();
        assert_eq!(readout_sparse_runs_copy(&cells, &malformed, 7, &valid, &mut work).unwrap_err(), JointMathError::Domain);
        assert_eq!(work.used(), 256);
        let support = NumericSupport::from_cells(&vec![true; JOINT_SIZE], &mut LedgerWork::new()).unwrap();
        for value in [f64::NAN, f64::INFINITY, f64::NEG_INFINITY, -0.0, 0.249, 4.001] {
            let invalid = ReadoutTemperature { index: 500, value };
            let mut work = LedgerWork::with_limit(256).unwrap();
            assert_eq!(readout_sparse_runs_copy(&cells, &support, 7, &invalid, &mut work).unwrap_err(), JointMathError::Domain);
            assert_eq!(work.used(), 256);
        }
        for certainty in [
            NumericCertainty { material: Some(8), potential: None },
            NumericCertainty { material: None, potential: Some(8) },
        ] {
            let support = NumericSupport { cells: vec![true; JOINT_SIZE], certainty };
            let mut work = LedgerWork::new();
            assert_eq!(readout_sparse_runs_copy(&cells, &support, 7, &valid, &mut work).unwrap_err(), JointMathError::NonFinite);
            assert_eq!(work.used(), 42984 + 180 + 32 * 2 + 40 * 2 - 64);
            assert!(support.cells.iter().all(|present| *present));
            assert_eq!(support.certainty, certainty);
        }
    }
}
