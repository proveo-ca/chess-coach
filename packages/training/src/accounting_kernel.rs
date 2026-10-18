// SPEC: _spec/packages/training/burn-compat.puml
use crate::ledger::LedgerWork;
use crate::ledger::contracts::{LedgerError, LedgerErrorCode, LedgerRules};

pub const MATERIAL_CEILING: u16 = 576;
pub const BANK_CEILING: u8 = 12;
pub const JOINT_SIZE: usize = 7501;

const BANKS: usize = 13;
const MATERIAL_WIDTH: usize = 577;
const STOCK_CEILING: u16 = 617;
const STOCK_WIDTH: usize = 618;
const STOCK_SIZE: usize = 8034;
const MAX_ROWS: usize = 8192;
const SPENDS: [u8; 5] = [0, 1, 3, 5, 9];
const INCREMENTS: [usize; 4] = [0, 2, 4, 8];
const HEADER: u64 = 128;
const PARAMETER: u64 = 32;
const INITIALIZE: u64 = 4;
const ALLOCATE: u64 = 192;
const GROWTH_ATTEMPT: u64 = 32;
const BRANCH: u64 = 64;
const ROW: u64 = 64;
const SCATTER: u64 = 32;
const SUFFIX: u64 = 16;
const DESTINATION: u64 = 24;

#[derive(Clone, Copy, Debug)]
pub struct AccountingPoint {
    pub material: u16,
    pub bank: u8,
}

#[derive(Clone, Copy, Debug)]
pub enum NumericGrant {
    None,
    AtNativeTurn(u32),
}

#[derive(Clone, Copy, Debug)]
pub struct PointAccountingInput {
    pub source: AccountingPoint,
    pub input_turn: u32,
    pub visible_before: u16,
    pub marines_before: u8,
    pub witnessed_loss: u16,
    pub destination_lower: u16,
    pub destination_upper: u16,
    pub grant: NumericGrant,
}

#[derive(Clone, Copy, Debug)]
pub struct NumericTransitionRow {
    pub spend: u8,
    pub created: u8,
    pub wasted: u8,
    pub growth: u8,
    pub destroyed: u16,
    pub count: f64,
}

#[derive(Debug, PartialEq, Eq)]
pub enum AccountingError {
    Domain,
    UnsupportedProfile,
    NonFinite,
    Underflow,
    Work(LedgerError),
}

pub type AccountingResult<T> = Result<T, AccountingError>;

#[derive(Debug)]
pub struct PointSupport {
    cells: Vec<bool>,
    any: bool,
}

impl PointSupport {
    pub fn cells(&self) -> &[bool] {
        &self.cells
    }

    pub fn is_empty(&self) -> bool {
        !self.any
    }
}

#[derive(Debug)]
pub struct PointAccountingFlow {
    masses: Vec<f64>,
    support: PointSupport,
    retained_mass: f64,
    feasible_tuple_count: u32,
}

impl PointAccountingFlow {
    pub fn masses(&self) -> &[f64] {
        &self.masses
    }

    pub fn support(&self) -> &PointSupport {
        &self.support
    }

    pub fn retained_mass(&self) -> f64 {
        self.retained_mass
    }

    pub fn feasible_tuple_count(&self) -> u32 {
        self.feasible_tuple_count
    }
}

pub fn joint_index(point: AccountingPoint, work: &mut LedgerWork) -> AccountingResult<usize> {
    charge(work, HEADER)?;
    charge(work, PARAMETER)?;
    validate_point(point)?;
    flat_index(
        usize::from(point.bank),
        usize::from(point.material),
        MATERIAL_WIDTH,
        JOINT_SIZE,
    )
}

pub fn growth_support(opportunities: u8, work: &mut LedgerWork) -> AccountingResult<[bool; 33]> {
    charge(work, HEADER)?;
    charge(work, PARAMETER)?;
    if opportunities > 4 {
        return Err(AccountingError::Domain);
    }
    let masks = growth_masks(opportunities, work)?;
    charge_count(work, 33, INITIALIZE)?;
    Ok(masks[usize::from(opportunities)])
}

pub fn accounting_point_support(
    rules: &LedgerRules,
    input: &PointAccountingInput,
    work: &mut LedgerWork,
) -> AccountingResult<PointSupport> {
    let parameters = parameters(rules, input, 0, work)?;
    let growth = growth_masks(4, work)?;
    let mut stock = buffer(STOCK_SIZE, false, work)?;
    let mut cells = buffer(JOINT_SIZE, false, work)?;
    visit_branches(input, parameters, &growth, work, |branch| {
        stock[branch.stock_index()?] = true;
        Ok(())
    })?;
    charge_count(work, STOCK_SIZE, SUFFIX)?;
    for bank in 0..BANKS {
        let mut reachable = false;
        for material in (0..STOCK_WIDTH).rev() {
            let index = flat_index(bank, material, STOCK_WIDTH, STOCK_SIZE)?;
            reachable |= stock[index];
            stock[index] = reachable;
        }
    }
    charge_count(work, JOINT_SIZE, DESTINATION)?;
    let mut any = false;
    for bank in 0..BANKS {
        for material in 0..MATERIAL_WIDTH {
            let index = flat_index(bank, material, MATERIAL_WIDTH, JOINT_SIZE)?;
            let head = destination_head(input, bank, material)?;
            cells[index] = head.is_some_and(|head| stock[head]);
            any |= cells[index];
        }
    }
    Ok(PointSupport { cells, any })
}

pub fn accounting_point_flow(
    rules: &LedgerRules,
    input: &PointAccountingInput,
    rows: &[NumericTransitionRow],
    work: &mut LedgerWork,
) -> AccountingResult<Option<PointAccountingFlow>> {
    let parameters = parameters(rules, input, rows.len(), work)?;
    let growth = growth_masks(4, work)?;
    let (placements, observed_count) = validate_rows(input, parameters, &growth, rows, work)?;
    let mut feasible_tuple_count = 0_u32;
    let mut retained_support = false;
    visit_branches(input, parameters, &growth, work, |branch| {
        let destructions = branch
            .stock
            .min(MATERIAL_CEILING)
            .checked_add(1)
            .ok_or(AccountingError::Domain)?;
        feasible_tuple_count = feasible_tuple_count
            .checked_add(u32::from(destructions))
            .ok_or(AccountingError::Domain)?;
        retained_support |= branch
            .stock
            .checked_sub(input.witnessed_loss)
            .is_some_and(|maximum| maximum >= input.destination_lower);
        Ok(())
    })?;
    if !retained_support {
        return Ok(None);
    }
    let pseudocount = positive_product(0.5, f64::from(feasible_tuple_count))?;
    let denominator = nonnegative_sum(observed_count, pseudocount)?;
    let alpha = positive_ratio(0.5, denominator)?;
    let mut stock = buffer(STOCK_SIZE, 0.0_f64, work)?;
    let mut stock_support = buffer(STOCK_SIZE, false, work)?;
    let mut masses = buffer(JOINT_SIZE, 0.0_f64, work)?;
    let mut cells = buffer(JOINT_SIZE, false, work)?;
    visit_branches(input, parameters, &growth, work, |branch| {
        let index = branch.stock_index()?;
        stock[index] = nonnegative_sum(stock[index], alpha)?;
        stock_support[index] = true;
        Ok(())
    })?;
    charge_count(work, rows.len(), SCATTER)?;
    for (row, placement) in rows.iter().zip(&placements) {
        if let Some(index) = placement {
            let mass = positive_ratio(row.count, denominator)?;
            let material = index % MATERIAL_WIDTH;
            if row.destroyed >= input.witnessed_loss
                && material >= usize::from(input.destination_lower)
                && material <= usize::from(input.destination_upper)
            {
                masses[*index] = nonnegative_sum(masses[*index], mass)?;
            }
        }
    }
    charge_count(work, STOCK_SIZE, SUFFIX)?;
    for bank in 0..BANKS {
        let mut total = 0.0;
        let mut reachable = false;
        for material in (0..STOCK_WIDTH).rev() {
            let index = flat_index(bank, material, STOCK_WIDTH, STOCK_SIZE)?;
            total = nonnegative_sum(total, stock[index])?;
            reachable |= stock_support[index];
            stock[index] = total;
            stock_support[index] = reachable;
        }
    }
    charge_count(work, JOINT_SIZE, DESTINATION)?;
    let mut retained_mass = 0.0;
    let mut any = false;
    for bank in 0..BANKS {
        for material in 0..MATERIAL_WIDTH {
            let index = flat_index(bank, material, MATERIAL_WIDTH, JOINT_SIZE)?;
            if let Some(head) = destination_head(input, bank, material)? {
                cells[index] = stock_support[head];
                masses[index] = nonnegative_sum(masses[index], stock[head])?;
            }
            if cells[index] && masses[index] == 0.0 {
                return Err(AccountingError::Underflow);
            }
            if !cells[index] && masses[index] > 0.0 {
                return Err(AccountingError::NonFinite);
            }
            any |= cells[index];
            retained_mass = nonnegative_sum(retained_mass, masses[index])?;
        }
    }
    if !any || retained_mass == 0.0 {
        return Err(AccountingError::Underflow);
    }
    if input.witnessed_loss == 0
        && input.destination_lower == 0
        && input.destination_upper == MATERIAL_CEILING
        && finite(retained_mass - 1.0)?.abs() > 1e-12
    {
        return Err(AccountingError::NonFinite);
    }
    Ok(Some(PointAccountingFlow {
        masses,
        support: PointSupport { cells, any },
        retained_mass,
        feasible_tuple_count,
    }))
}

#[derive(Clone, Copy)]
struct Parameters {
    gas: u16,
    income: u16,
}

fn parameters(
    rules: &LedgerRules,
    input: &PointAccountingInput,
    rows: usize,
    work: &mut LedgerWork,
) -> AccountingResult<Parameters> {
    charge(work, HEADER)?;
    charge(work, PARAMETER)?;
    validate_point(input.source)?;
    if input.visible_before > input.source.material
        || input.marines_before > 64
        || u16::from(input.marines_before) > input.visible_before
        || input.destination_lower > input.destination_upper
        || input.destination_upper > MATERIAL_CEILING
        || input.witnessed_loss > STOCK_CEILING
        || rows > MAX_ROWS
    {
        return Err(AccountingError::Domain);
    }
    rules.validate(work).map_err(AccountingError::Work)?;
    if rules.mineral_bank_cap != u32::from(BANK_CEILING) {
        return Err(AccountingError::UnsupportedProfile);
    }
    charge_count(work, rules.income_by_turn.len(), PARAMETER)?;
    if rules
        .income_by_turn
        .iter()
        .any(|income| !(1..=3).contains(income))
    {
        return Err(AccountingError::UnsupportedProfile);
    }
    let gas = rules
        .gas_capacity_at(input.input_turn)
        .map_err(|_| AccountingError::Domain)?;
    let income = match input.grant {
        NumericGrant::None => 0,
        NumericGrant::AtNativeTurn(turn) => {
            rules.income_at(turn).map_err(|_| AccountingError::Domain)?
        }
    };
    Ok(Parameters {
        gas: u16::try_from(gas).map_err(|_| AccountingError::UnsupportedProfile)?,
        income: u16::try_from(income).map_err(|_| AccountingError::UnsupportedProfile)?,
    })
}

fn growth_masks(opportunities: u8, work: &mut LedgerWork) -> AccountingResult<[[bool; 33]; 5]> {
    charge_count(work, 5 * 33, INITIALIZE)?;
    let mut masks = [[false; 33]; 5];
    masks[0][0] = true;
    for layer in 1..=usize::from(opportunities) {
        let previous = layer.checked_sub(1).ok_or(AccountingError::Domain)?;
        for sum in 0_usize..33 {
            for &increment in &INCREMENTS {
                charge(work, GROWTH_ATTEMPT)?;
                if let Some(next) = sum.checked_add(increment).filter(|next| *next <= 32)
                    && masks[previous][sum]
                {
                    masks[layer][next] = true;
                }
            }
        }
    }
    Ok(masks)
}

#[derive(Clone, Copy)]
struct Branch {
    bank: u8,
    stock: u16,
}

impl Branch {
    fn stock_index(self) -> AccountingResult<usize> {
        flat_index(
            usize::from(self.bank),
            usize::from(self.stock),
            STOCK_WIDTH,
            STOCK_SIZE,
        )
    }
}

fn visit_branches(
    input: &PointAccountingInput,
    parameters: Parameters,
    growth: &[[bool; 33]; 5],
    work: &mut LedgerWork,
    mut visit: impl FnMut(Branch) -> AccountingResult<()>,
) -> AccountingResult<()> {
    for &spend in &SPENDS {
        if spend > input.source.bank {
            continue;
        }
        let creations = if spend == 0 { 1 } else { 2 };
        for creation in 0..creations {
            charge(work, PARAMETER)?;
            let created = if creation == 0 { 0 } else { spend };
            let opportunities = opportunities(input, parameters, spend, created)?;
            let bank = destination_bank(input, parameters, spend)?;
            for (sum, possible) in growth[opportunities].iter().enumerate() {
                if *possible {
                    charge(work, BRANCH)?;
                    let stock = input
                        .source
                        .material
                        .checked_add(u16::from(created))
                        .and_then(|stock| stock.checked_add(u16::try_from(sum).ok()?))
                        .filter(|stock| *stock <= STOCK_CEILING)
                        .ok_or(AccountingError::Domain)?;
                    visit(Branch { bank, stock })?;
                }
            }
        }
    }
    Ok(())
}

fn opportunities(
    input: &PointAccountingInput,
    parameters: Parameters,
    spend: u8,
    created: u8,
) -> AccountingResult<usize> {
    let gas = 1_u16
        .checked_add(parameters.gas)
        .and_then(|value| value.checked_sub(u16::from(spend > 0)))
        .ok_or(AccountingError::Domain)?;
    let material = u16::from(input.marines_before)
        .checked_add(input.source.material)
        .and_then(|value| value.checked_sub(input.visible_before))
        .and_then(|value| value.checked_add(u16::from(created == 1)))
        .ok_or(AccountingError::Domain)?;
    Ok(usize::from(4_u16.min(gas).min(material)))
}

fn destination_bank(
    input: &PointAccountingInput,
    parameters: Parameters,
    spend: u8,
) -> AccountingResult<u8> {
    let bank = u16::from(input.source.bank)
        .checked_sub(u16::from(spend))
        .and_then(|bank| bank.checked_add(parameters.income))
        .ok_or(AccountingError::Domain)?;
    u8::try_from(bank.min(u16::from(BANK_CEILING))).map_err(|_| AccountingError::Domain)
}

fn validate_rows(
    input: &PointAccountingInput,
    parameters: Parameters,
    growth: &[[bool; 33]; 5],
    rows: &[NumericTransitionRow],
    work: &mut LedgerWork,
) -> AccountingResult<(Vec<Option<usize>>, f64)> {
    if !rows.is_empty() {
        charge(work, ALLOCATE)?;
        charge_count(work, rows.len(), INITIALIZE)?;
    }
    charge_count(work, rows.len(), ROW)?;
    let mut placements = vec![None; rows.len()];
    let mut previous = None;
    let mut observed_count = 0.0;
    for (index, row) in rows.iter().enumerate() {
        validate_row(row)?;
        let key = (
            row.spend,
            row.created,
            row.wasted,
            row.growth,
            row.destroyed,
        );
        if previous.is_some_and(|previous| key <= previous) {
            return Err(AccountingError::Domain);
        }
        previous = Some(key);
        if row.spend > input.source.bank {
            continue;
        }
        let opportunities = opportunities(input, parameters, row.spend, row.created)?;
        if !growth[opportunities][usize::from(row.growth)] {
            continue;
        }
        let stock = input
            .source
            .material
            .checked_add(u16::from(row.created))
            .and_then(|stock| stock.checked_add(u16::from(row.growth)))
            .ok_or(AccountingError::Domain)?;
        let Some(material) = stock
            .checked_sub(row.destroyed)
            .filter(|material| *material <= MATERIAL_CEILING)
        else {
            continue;
        };
        let bank = destination_bank(input, parameters, row.spend)?;
        placements[index] = Some(flat_index(
            usize::from(bank),
            usize::from(material),
            MATERIAL_WIDTH,
            JOINT_SIZE,
        )?);
        observed_count = nonnegative_sum(observed_count, row.count)?;
    }
    Ok((placements, observed_count))
}

fn validate_row(row: &NumericTransitionRow) -> AccountingResult<()> {
    finite(row.count)?;
    if row.count <= 0.0
        || row.count > 14400.0
        || row.spend > 9
        || row.created > 9
        || row.wasted > 9
        || row.growth > 32
        || !row.growth.is_multiple_of(2)
        || row.destroyed > STOCK_CEILING
        || !SPENDS.contains(&row.spend)
        || (row.created != 0 && row.created != row.spend)
        || row.spend.checked_sub(row.created) != Some(row.wasted)
    {
        return Err(AccountingError::Domain);
    }
    Ok(())
}

fn destination_head(
    input: &PointAccountingInput,
    bank: usize,
    material: usize,
) -> AccountingResult<Option<usize>> {
    if material < usize::from(input.destination_lower)
        || material > usize::from(input.destination_upper)
    {
        return Ok(None);
    }
    let threshold = u32::try_from(material)
        .ok()
        .and_then(|material| material.checked_add(u32::from(input.witnessed_loss)))
        .ok_or(AccountingError::Domain)?;
    if threshold > u32::from(STOCK_CEILING) {
        return Ok(None);
    }
    Ok(Some(flat_index(
        bank,
        usize::try_from(threshold).map_err(|_| AccountingError::Domain)?,
        STOCK_WIDTH,
        STOCK_SIZE,
    )?))
}

fn validate_point(point: AccountingPoint) -> AccountingResult<()> {
    if point.material > MATERIAL_CEILING || point.bank > BANK_CEILING {
        Err(AccountingError::Domain)
    } else {
        Ok(())
    }
}

fn flat_index(bank: usize, material: usize, width: usize, size: usize) -> AccountingResult<usize> {
    if bank >= BANKS || material >= width {
        return Err(AccountingError::Domain);
    }
    bank.checked_mul(width)
        .and_then(|offset| offset.checked_add(material))
        .filter(|index| *index < size)
        .ok_or(AccountingError::Domain)
}

fn buffer<T: Clone>(size: usize, value: T, work: &mut LedgerWork) -> AccountingResult<Vec<T>> {
    charge(work, ALLOCATE)?;
    charge_count(work, size, INITIALIZE)?;
    Ok(vec![value; size])
}

fn finite(value: f64) -> AccountingResult<f64> {
    if value.is_finite() {
        Ok(value)
    } else {
        Err(AccountingError::NonFinite)
    }
}

fn nonnegative_sum(left: f64, right: f64) -> AccountingResult<f64> {
    let result = finite(left + right)?;
    if result < 0.0 {
        Err(AccountingError::NonFinite)
    } else {
        Ok(result)
    }
}

fn positive_product(left: f64, right: f64) -> AccountingResult<f64> {
    let result = finite(left * right)?;
    if result == 0.0 {
        Err(AccountingError::Underflow)
    } else if result < 0.0 {
        Err(AccountingError::NonFinite)
    } else {
        Ok(result)
    }
}

fn positive_ratio(numerator: f64, denominator: f64) -> AccountingResult<f64> {
    let result = finite(numerator / denominator)?;
    if result == 0.0 {
        Err(AccountingError::Underflow)
    } else if result < 0.0 {
        Err(AccountingError::NonFinite)
    } else {
        Ok(result)
    }
}

fn charge(work: &mut LedgerWork, amount: u64) -> AccountingResult<()> {
    work.charge(amount).map_err(AccountingError::Work)
}

fn charge_count(work: &mut LedgerWork, count: usize, fee: u64) -> AccountingResult<()> {
    let amount = u64::try_from(count)
        .ok()
        .and_then(|count| count.checked_mul(fee))
        .ok_or_else(|| {
            AccountingError::Work(LedgerError::new(
                LedgerErrorCode::Budget,
                "Accounting invoice overflow",
            ))
        })?;
    charge(work, amount)
}
