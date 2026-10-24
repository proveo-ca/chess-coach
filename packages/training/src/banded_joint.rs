// SPEC: _spec/packages/training/burn-compat.puml, _spec/packages/training/belief-integration.puml
use crate::accounting_kernel::{BANK_CEILING, JOINT_SIZE, MATERIAL_CEILING};
use crate::evidence_tables::{EvidenceWeightedAccounting, WeightedAccountingParts};
use crate::joint_math::{
    JointMathError, NumericJoint, NumericSupport, from_normalized_owned, normalize_aggregate_owned,
};
use crate::ledger::LedgerWork;
use crate::ledger::contracts::{LedgerError, LedgerErrorCode};

const MATERIAL_WIDTH: usize = MATERIAL_CEILING as usize + 1;
const BAND_COUNT: usize = 19;
const COMPONENT_LIMIT: usize = (BANK_CEILING as usize + 1) * BAND_COUNT;
const BAND_STARTS: [u16; BAND_COUNT] = [
    0, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512,
];
const ENTRY: u64 = 128;
const BLOCK: u64 = 32;
const NORMALIZATION_TOLERANCE: f64 = 1e-12;

pub struct NumericBandComponent {
    bank: u8,
    band: u8,
    mass: f64,
    conditional: Vec<f64>,
}

impl std::fmt::Debug for NumericBandComponent {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("NumericBandComponent")
            .field("bank", &self.bank)
            .field("band", &self.band)
            .field("mass", &self.mass)
            .field("width", &self.conditional.len())
            .finish_non_exhaustive()
    }
}

impl NumericBandComponent {
    pub fn bank(&self) -> u8 {
        self.bank
    }
    pub fn band(&self) -> u8 {
        self.band
    }
    pub fn mass(&self) -> f64 {
        self.mass
    }
    pub fn conditional(&self) -> &[f64] {
        &self.conditional
    }
}

pub struct NumericBandedJoint {
    components: Vec<NumericBandComponent>,
    support: NumericSupport,
}

impl std::fmt::Debug for NumericBandedJoint {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("NumericBandedJoint")
            .field("components", &self.components.len())
            .field("support", &self.support)
            .finish_non_exhaustive()
    }
}

impl NumericBandedJoint {
    pub fn components(&self) -> &[NumericBandComponent] {
        &self.components
    }
    pub fn support(&self) -> &NumericSupport {
        &self.support
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum BandError {
    Domain,
    NonFinite,
    Underflow,
    Joint(JointMathError),
    Work(LedgerError),
}

pub type BandResult<T> = Result<T, BandError>;

pub fn normalize_weighted(
    weighted: EvidenceWeightedAccounting,
    work: &mut LedgerWork,
) -> BandResult<NumericJoint> {
    charge(work, ENTRY)?;
    let WeightedAccountingParts {
        masses,
        accounting_cells,
        retained_mass: _retained_mass,
    } = weighted.into_numeric_parts(work).map_err(BandError::Work)?;
    normalize_aggregate_owned(masses, accounting_cells, work).map_err(joint_error)
}

pub fn reband_joint(joint: NumericJoint, work: &mut LedgerWork) -> BandResult<NumericBandedJoint> {
    charge(work, ENTRY)?;
    if joint.probabilities().len() != JOINT_SIZE || joint.support().cells().len() != JOINT_SIZE {
        return Err(BandError::Domain);
    }
    let parts = joint.into_owned_parts(work).map_err(BandError::Work)?;
    let bands = &BAND_STARTS;
    charge(work, 4 * COMPONENT_LIMIT as u64)?;
    let mut masses = [0.0; COMPONENT_LIMIT];
    charge(work, BLOCK * COMPONENT_LIMIT as u64)?;
    charge(work, 16 * JOINT_SIZE as u64)?;
    let mut component_count = 0_usize;
    let mut conditional_length = 0_usize;
    let mut component_total = 0.0;
    for bank in 0..=BANK_CEILING {
        for band in 0..BAND_COUNT {
            let (start, width) = band_bounds(bands, band)?;
            let mut mass = 0.0;
            for offset in 0..width {
                let material = start.checked_add(offset).ok_or(BandError::Domain)?;
                let index = joint_index(bank, material)?;
                let probability = nonnegative(parts.probabilities[index])?;
                if probability > 0.0 && !parts.support.cells()[index] {
                    return Err(BandError::Domain);
                }
                mass = finite(mass + probability)?;
            }
            let key = component_index(bank, band)?;
            masses[key] = mass;
            if mass > 0.0 {
                component_mass(mass)?;
                component_count = component_count
                    .checked_add(1)
                    .filter(|count| *count <= COMPONENT_LIMIT)
                    .ok_or(BandError::Domain)?;
                conditional_length = conditional_length
                    .checked_add(width)
                    .filter(|length| *length <= JOINT_SIZE)
                    .ok_or(BandError::Domain)?;
                component_total = finite(component_total + mass)?;
            }
        }
    }
    if component_count == 0 {
        return Err(BandError::Domain);
    }
    charge(work, invoice(192, component_count, 24)?)?;
    let mut components = Vec::with_capacity(component_count);
    for (key, &mass) in masses.iter().enumerate() {
        if mass == 0.0 {
            continue;
        }
        let bank = u8::try_from(key / BAND_COUNT).map_err(|_| BandError::Domain)?;
        let band = key % BAND_COUNT;
        let (start, width) = band_bounds(bands, band)?;
        charge(work, invoice(192 + 32, width, 4 + 24)?)?;
        let mut conditional = vec![0.0; width];
        let mut total = 0.0;
        for (offset, value) in conditional.iter_mut().enumerate() {
            let index = joint_index(bank, start.checked_add(offset).ok_or(BandError::Domain)?)?;
            let probability = parts.probabilities[index];
            *value = finite(probability / mass)?;
            if probability > 0.0 && *value == 0.0 {
                return Err(BandError::Underflow);
            }
            probability_value(*value)?;
            total = finite(total + *value)?;
        }
        normalized(total)?;
        components.push(NumericBandComponent {
            bank,
            band: u8::try_from(band).map_err(|_| BandError::Domain)?,
            mass,
            conditional,
        });
    }
    charge(work, BLOCK)?;
    normalized(component_total)?;
    charge(work, 40)?;
    let banded = NumericBandedJoint {
        components,
        support: parts.support,
    };
    drop(parts.probabilities);
    Ok(banded)
}

pub fn expand_joint(
    banded: &NumericBandedJoint,
    work: &mut LedgerWork,
) -> BandResult<NumericJoint> {
    charge(work, ENTRY)?;
    if banded.components.is_empty()
        || banded.components.len() > COMPONENT_LIMIT
        || banded.support.cells().len() != JOINT_SIZE
    {
        return Err(BandError::Domain);
    }
    let bands = &BAND_STARTS;
    charge(work, 192 + 4 * JOINT_SIZE as u64)?;
    let mut probabilities = vec![0.0; JOINT_SIZE];
    let mut previous = None;
    for component in &banded.components {
        charge(work, BLOCK)?;
        if component.bank > BANK_CEILING || usize::from(component.band) >= BAND_COUNT {
            return Err(BandError::Domain);
        }
        let key = (component.bank, component.band);
        if previous.is_some_and(|previous| key <= previous) {
            return Err(BandError::Domain);
        }
        previous = Some(key);
        component_mass(component.mass)?;
        let (start, width) = band_bounds(bands, usize::from(component.band))?;
        if component.conditional.len() != width {
            return Err(BandError::Domain);
        }
        charge(work, invoice(0, width, 16)?)?;
        for (offset, conditional) in component.conditional.iter().enumerate() {
            probability_value(*conditional)?;
            let probability = finite(component.mass * *conditional)?;
            if *conditional > 0.0 && probability == 0.0 {
                return Err(BandError::Underflow);
            }
            let index = joint_index(
                component.bank,
                start.checked_add(offset).ok_or(BandError::Domain)?,
            )?;
            if probability > 0.0 && !banded.support.cells()[index] {
                return Err(BandError::Domain);
            }
            probabilities[index] = probability;
        }
    }
    let support = banded.support.copy_checked(work).map_err(joint_error)?;
    from_normalized_owned(probabilities, support, work).map_err(joint_error)
}

fn band_bounds(bands: &[u16; BAND_COUNT], band: usize) -> BandResult<(usize, usize)> {
    let start = usize::from(*bands.get(band).ok_or(BandError::Domain)?);
    let end = match bands.get(band.checked_add(1).ok_or(BandError::Domain)?) {
        Some(end) => usize::from(*end),
        None => MATERIAL_WIDTH,
    };
    Ok((
        start,
        end.checked_sub(start)
            .filter(|width| *width > 0)
            .ok_or(BandError::Domain)?,
    ))
}

fn component_index(bank: u8, band: usize) -> BandResult<usize> {
    usize::from(bank)
        .checked_mul(BAND_COUNT)
        .and_then(|value| value.checked_add(band))
        .filter(|index| *index < COMPONENT_LIMIT)
        .ok_or(BandError::Domain)
}

fn joint_index(bank: u8, material: usize) -> BandResult<usize> {
    if bank > BANK_CEILING || material >= MATERIAL_WIDTH {
        return Err(BandError::Domain);
    }
    usize::from(bank)
        .checked_mul(MATERIAL_WIDTH)
        .and_then(|value| value.checked_add(material))
        .filter(|index| *index < JOINT_SIZE)
        .ok_or(BandError::Domain)
}

fn finite(value: f64) -> BandResult<f64> {
    if value.is_finite() {
        Ok(value)
    } else {
        Err(BandError::NonFinite)
    }
}
fn nonnegative(value: f64) -> BandResult<f64> {
    let value = finite(value)?;
    if value < 0.0 {
        Err(BandError::Domain)
    } else {
        Ok(value)
    }
}
fn probability_value(value: f64) -> BandResult<()> {
    let value = finite(value)?;
    if (0.0..=1.0).contains(&value) {
        Ok(())
    } else {
        Err(BandError::Domain)
    }
}
fn component_mass(value: f64) -> BandResult<()> {
    let value = finite(value)?;
    if value > 0.0 && value <= 1.0 {
        Ok(())
    } else {
        Err(BandError::Domain)
    }
}
fn normalized(value: f64) -> BandResult<()> {
    if finite(value - 1.0)?.abs() <= NORMALIZATION_TOLERANCE {
        Ok(())
    } else {
        Err(BandError::Domain)
    }
}
fn joint_error(error: JointMathError) -> BandError {
    match error {
        JointMathError::Work(error) => BandError::Work(error),
        JointMathError::Underflow => BandError::Underflow,
        JointMathError::NonFinite => BandError::NonFinite,
        other => BandError::Joint(other),
    }
}
fn charge(work: &mut LedgerWork, amount: u64) -> BandResult<()> {
    work.charge(amount).map_err(BandError::Work)
}
fn invoice(base: u64, count: usize, rate: u64) -> BandResult<u64> {
    u64::try_from(count)
        .ok()
        .and_then(|count| count.checked_mul(rate))
        .and_then(|value| value.checked_add(base))
        .ok_or_else(|| {
            BandError::Work(LedgerError::new(
                LedgerErrorCode::Budget,
                "Banded joint invoice overflow",
            ))
        })
}

// SPEC: _spec/packages/training/belief-integration.puml
pub fn from_sparse_probabilities(
    cells: &[crate::joint_math::SparseCell],
    support: NumericSupport,
    work: &mut LedgerWork,
) -> BandResult<NumericBandedJoint> {
    charge(work, 128)?;
    if cells.is_empty() || cells.len() > JOINT_SIZE || support.cells().len() != JOINT_SIZE {
        return Err(BandError::Domain);
    }
    let mut previous = None;
    let mut previous_key = None;
    let mut count = 0_usize;
    let mut total = 0.0;
    for cell in cells {
        charge(work, 32 + 5 * 16)?;
        let index = joint_index(cell.bank, usize::from(cell.material))?;
        let probability = nonnegative(cell.probability)?;
        if probability == 0.0 || probability > 1.0 || !support.cells()[index]
            || previous.is_some_and(|old| index <= old)
        { return Err(BandError::Domain); }
        let band = BAND_STARTS.partition_point(|start| *start <= cell.material) - 1;
        let key = (cell.bank, band);
        if previous_key != Some(key) { count += 1; }
        previous_key = Some(key);
        previous = Some(index);
        total = finite(total + probability)?;
    }
    charge(work, 32)?;
    normalized(total)?;
    charge(work, invoice(192, count, 24)?)?;
    let mut components = Vec::with_capacity(count);
    let mut cursor = 0_usize;
    let mut component_total = 0.0;
    while cursor < cells.len() {
        charge(work, 32 + 5 * 16)?;
        let bank = cells[cursor].bank;
        let band = BAND_STARTS.partition_point(|start| *start <= cells[cursor].material) - 1;
        let (start, width) = band_bounds(&BAND_STARTS, band)?;
        let first = cursor;
        let mut mass = 0.0;
        while cursor < cells.len() && cells[cursor].bank == bank
            && usize::from(cells[cursor].material) < start + width
        {
            charge(work, 16)?;
            mass = finite(mass + cells[cursor].probability)?;
            cursor += 1;
        }
        component_mass(mass)?;
        charge(work, invoice(192 + 32, width, 4 + 24)?)?;
        let mut conditional = vec![0.0; width];
        let mut item = first;
        let mut sum = 0.0;
        for (offset, value) in conditional.iter_mut().enumerate() {
            let probability = if item < cursor && usize::from(cells[item].material) == start + offset {
                let probability = cells[item].probability;
                item += 1;
                probability
            } else { 0.0 };
            *value = finite(probability / mass)?;
            if probability > 0.0 && *value == 0.0 { return Err(BandError::Underflow); }
            probability_value(*value)?;
            sum = finite(sum + *value)?;
        }
        normalized(sum)?;
        component_total = finite(component_total + mass)?;
        components.push(NumericBandComponent { bank, band: band as u8, mass, conditional });
    }
    charge(work, 32 + 40)?;
    normalized(component_total)?;
    Ok(NumericBandedJoint { components, support })
}

pub fn sparse_probabilities(
    banded: &NumericBandedJoint,
    work: &mut LedgerWork,
) -> BandResult<Vec<crate::joint_math::SparseCell>> {
    charge(work, 128)?;
    if banded.components.is_empty() || banded.components.len() > COMPONENT_LIMIT
        || banded.support.cells().len() != JOINT_SIZE
    {
        return Err(BandError::Domain);
    }
    let mut count = 0_usize;
    let mut previous = None;
    for component in &banded.components {
        charge(work, 32)?;
        let key = (component.bank, component.band);
        let (_, width) = band_bounds(&BAND_STARTS, usize::from(component.band))?;
        if component.bank > BANK_CEILING || component.conditional.len() != width
            || previous.is_some_and(|old| key <= old)
        { return Err(BandError::Domain); }
        previous = Some(key);
        component_mass(component.mass)?;
        for conditional in &component.conditional {
            charge(work, 16)?;
            probability_value(*conditional)?;
            let probability = finite(component.mass * *conditional)?;
            if *conditional > 0.0 && probability == 0.0 { return Err(BandError::Underflow); }
            if probability > 0.0 { count += 1; }
        }
    }
    charge(work, 192)?;
    let mut cells = Vec::with_capacity(count);
    for component in &banded.components {
        charge(work, 32)?;
        let (start, _) = band_bounds(&BAND_STARTS, usize::from(component.band))?;
        for (offset, conditional) in component.conditional.iter().enumerate() {
            charge(work, 16)?;
            let probability = finite(component.mass * *conditional)?;
            if *conditional > 0.0 && probability == 0.0 { return Err(BandError::Underflow); }
            if probability > 0.0 {
                let material = start + offset;
                if !banded.support.cells()[joint_index(component.bank, material)?] { return Err(BandError::Domain); }
                charge(work, 12)?;
                cells.push(crate::joint_math::SparseCell { bank: component.bank, material: material as u16, probability });
            }
        }
    }
    Ok(cells)
}

pub fn readout_banded_copy(
    banded: &NumericBandedJoint,
    own_replacement: u16,
    temperature: &crate::joint_math::ReadoutTemperature,
    work: &mut LedgerWork,
) -> BandResult<crate::joint_math::NumericReadout> {
    let cells = sparse_probabilities(banded, work)?;
    crate::joint_math::readout_sparse_copy(&cells, banded.support(), own_replacement, temperature, work)
        .map_err(joint_error)
}

// SPEC: _spec/packages/training/belief-integration.puml
pub fn readout_banded_runs_copy(
    banded: &NumericBandedJoint,
    own_replacement: u16,
    temperature: &crate::joint_math::ReadoutTemperature,
    work: &mut LedgerWork,
) -> BandResult<crate::joint_math::NumericReadout> {
    let cells = sparse_probabilities(banded, work)?;
    crate::joint_math::readout_sparse_runs_copy(&cells, banded.support(), own_replacement, temperature, work)
        .map_err(joint_error)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn support_all() -> NumericSupport {
        NumericSupport::from_cells(&vec![true; JOINT_SIZE], &mut LedgerWork::new()).unwrap()
    }

    #[test]
    fn private_expansion_domain_and_conditional_errors_are_prepaid_without_repair() {
        for case in 0..10 {
            let mut component = NumericBandComponent {
                bank: 0,
                band: 4,
                mass: 1.0,
                conditional: vec![0.0, 1.0],
            };
            let expected = match case {
                0 => {
                    component.bank = 13;
                    BandError::Domain
                }
                1 => {
                    component.band = 19;
                    BandError::Domain
                }
                2 => {
                    component.mass = 0.0;
                    BandError::Domain
                }
                3 => {
                    component.mass = 1.0000000000001;
                    BandError::Domain
                }
                4 => {
                    component.mass = f64::NAN;
                    BandError::NonFinite
                }
                5 => {
                    component.conditional.pop();
                    BandError::Domain
                }
                6 => {
                    component.conditional[0] = -0.1;
                    BandError::Domain
                }
                7 => {
                    component.conditional[0] = 1.1;
                    BandError::Domain
                }
                8 => {
                    component.conditional[0] = f64::NAN;
                    BandError::NonFinite
                }
                _ => {
                    component.conditional[0] = f64::INFINITY;
                    BandError::NonFinite
                }
            };
            let banded = NumericBandedJoint {
                components: vec![component],
                support: support_all(),
            };
            let mut work = LedgerWork::new();
            assert_eq!(expand_joint(&banded, &mut work).unwrap_err(), expected);
            assert_eq!(
                work.used(),
                128 + 192 + 4 * JOINT_SIZE as u64 + 32 + if case >= 6 { 32 } else { 0 }
            );
        }
        let banded = NumericBandedJoint {
            components: vec![NumericBandComponent {
                bank: 0,
                band: 4,
                mass: 1.0,
                conditional: vec![f64::NAN, 1.0],
            }],
            support: support_all(),
        };
        let before_product = 128 + 192 + 4 * JOINT_SIZE as u64 + 32;
        let mut short = LedgerWork::with_limit(before_product + 31).unwrap();
        assert!(
            matches!(expand_joint(&banded, &mut short), Err(BandError::Work(ref error)) if error.code == LedgerErrorCode::Budget)
        );
        assert_eq!(short.used(), before_product);
    }

    #[test]
    fn private_conditional_totals_and_positive_product_underflow_fail_without_extra_division() {
        for (conditional, expected) in [
            (vec![0.75, 0.75], BandError::NonFinite),
            (vec![0.0, 0.0], BandError::Joint(JointMathError::EmptyMass)),
        ] {
            let banded = NumericBandedJoint {
                components: vec![NumericBandComponent {
                    bank: 0,
                    band: 4,
                    mass: 1.0,
                    conditional,
                }],
                support: support_all(),
            };
            let mut exact = LedgerWork::with_limit(210796 + 32 + 16 * 2).unwrap();
            assert_eq!(expand_joint(&banded, &mut exact).unwrap_err(), expected);
            assert_eq!(exact.used(), 210860);
        }
        let banded = NumericBandedJoint {
            components: vec![
                NumericBandComponent {
                    bank: 0,
                    band: 0,
                    mass: 1.0,
                    conditional: vec![1.0],
                },
                NumericBandComponent {
                    bank: 0,
                    band: 4,
                    mass: f64::from_bits(1),
                    conditional: vec![0.5, 0.5],
                },
            ],
            support: support_all(),
        };
        let mut work = LedgerWork::new();
        assert_eq!(
            expand_joint(&banded, &mut work).unwrap_err(),
            BandError::Underflow
        );
        assert_eq!(
            work.used(),
            128 + 192 + 4 * JOINT_SIZE as u64 + 2 * 32 + 16 * 3
        );
        assert_eq!(banded.components[1].conditional, vec![0.5, 0.5]);
    }

    #[test]
    fn strict_reband_mass_over_one_refuses_f4_tolerance_valid_input_and_success_moves_support_only()
    {
        let mut probabilities = vec![0.0; JOINT_SIZE];
        probabilities[0] = 1.0000000000005;
        let joint =
            from_normalized_owned(probabilities, support_all(), &mut LedgerWork::new()).unwrap();
        let mut work = LedgerWork::new();
        assert_eq!(
            reband_joint(joint, &mut work).unwrap_err(),
            BandError::Domain
        );
        assert_eq!(
            work.used(),
            128 + 32 + 4 * 247 + 32 * 247 + 16 * JOINT_SIZE as u64
        );
        let mut probabilities = vec![0.0; JOINT_SIZE];
        probabilities[5] = 1.0;
        let mut cells = vec![false; JOINT_SIZE];
        cells[5] = true;
        cells[576] = true;
        let support = NumericSupport::from_cells(&cells, &mut LedgerWork::new()).unwrap();
        let pointer = support.cells().as_ptr();
        let certainty = support.certainty();
        let joint = from_normalized_owned(probabilities, support, &mut LedgerWork::new()).unwrap();
        let mut exact = LedgerWork::with_limit(129332 + 248 + 28 * 2).unwrap();
        let banded = reband_joint(joint, &mut exact).unwrap();
        assert_eq!(exact.used(), 129636);
        assert_eq!(banded.support.cells().as_ptr(), pointer);
        assert_eq!(banded.support.certainty(), certainty);
        assert_eq!(banded.components[0].conditional, vec![0.0, 1.0]);
        assert!(banded.support.cells()[576]);
        let mut exact = LedgerWork::with_limit(210796 + 32 + 16 * 2).unwrap();
        let expanded = expand_joint(&banded, &mut exact).unwrap();
        assert_eq!(exact.used(), 210860);
        assert_ne!(
            expanded.probabilities().as_ptr(),
            banded.components[0].conditional.as_ptr()
        );
        assert_ne!(
            expanded.support().cells().as_ptr(),
            banded.support.cells().as_ptr()
        );
        assert_eq!(expanded.support().cells(), banded.support.cells());
        assert_eq!(expanded.probabilities()[5], 1.0);
    }
}
