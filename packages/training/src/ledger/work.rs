// SPEC: _spec/packages/training/burn-compat.puml
use super::contracts::{
    AtomicGroup, AuthorizedView, ContractResult, EconomicBoundary, LedgerError, LedgerErrorCode,
    LedgerRules, MAX_ATOMIC_GROUPS, MAX_BOUNDARY_BYTES, MAX_BOUNDARY_ENTRIES, MAX_OWN_MINES,
    MAX_OWN_UNITS, OwnGeometry,
};

pub const LEDGER_WORK_LIMIT: u64 = 1_048_576;

const BYTE: u64 = 1;
const CELL: u64 = 8;
const UNIT: u64 = 8;
const MINE: u64 = 8;
const ACTION: u64 = 16;
const FACT: u64 = 16;
const GROUP: u64 = 8;
const BOUNDARY: u64 = 64;
const RULES: u64 = 32;
const TABLE_ENTRY: u64 = 1;
const CANONICAL_BYTE: u64 = 3;

#[derive(Debug, PartialEq, Eq)]
pub struct LedgerWork {
    used: u64,
    limit: u64,
}

impl Default for LedgerWork {
    fn default() -> Self {
        Self::new()
    }
}

impl LedgerWork {
    pub const fn new() -> Self {
        Self {
            used: 0,
            limit: LEDGER_WORK_LIMIT,
        }
    }

    pub fn with_limit(limit: u64) -> ContractResult<Self> {
        if limit == 0 || limit > LEDGER_WORK_LIMIT {
            return Err(budget("Ledger work limit must be in 1..=1048576"));
        }
        Ok(Self { used: 0, limit })
    }

    pub const fn used(&self) -> u64 {
        self.used
    }
    pub const fn remaining(&self) -> u64 {
        self.limit
            .checked_sub(self.used)
            .expect("Used ledger work never exceeds its limit")
    }
    pub const fn limit(&self) -> u64 {
        self.limit
    }

    pub fn charge(&mut self, amount: u64) -> ContractResult<()> {
        let next = self
            .used
            .checked_add(amount)
            .filter(|used| *used <= self.limit)
            .ok_or_else(|| {
                budget("Ledger work budget exceeded; failed charges leave used unchanged")
            })?;
        self.used = next;
        Ok(())
    }

    pub fn preflight_bytes(&mut self, len: usize) -> ContractResult<()> {
        if len > MAX_BOUNDARY_BYTES {
            return Err(budget("Ledger payload exceeds the 1048576-byte cap"));
        }
        self.charge_items(len, BYTE)
    }

    pub fn charge_rules(&mut self, rules: &LedgerRules) -> ContractResult<()> {
        if rules.income_by_turn.len() > 46 || rules.gas_capacity_by_turn.len() > 46 {
            return Err(bad("Rules tables exceed 46 entries"));
        }
        self.charge(RULES)?;
        self.charge_items(rules.income_by_turn.len(), TABLE_ENTRY)?;
        self.charge_items(rules.gas_capacity_by_turn.len(), TABLE_ENTRY)
    }

    pub fn charge_geometry(&mut self, geometry: &OwnGeometry) -> ContractResult<()> {
        if geometry.units.len() > MAX_OWN_UNITS || geometry.mines.len() > MAX_OWN_MINES {
            return Err(bad("Own geometry exceeds physical allocation bounds"));
        }
        self.charge_items(geometry.units.len(), UNIT)?;
        self.charge_items(geometry.mines.len(), MINE)
    }

    pub fn charge_snapshot(&mut self, snapshot: &AuthorizedView) -> ContractResult<()> {
        if snapshot.cells.len() > 64
            || snapshot.own.pieces.len() > MAX_OWN_UNITS
            || snapshot.own.mines.len() > MAX_OWN_MINES
            || snapshot.own.sieged_tanks.len() > MAX_OWN_UNITS
        {
            return Err(bad("Snapshot exceeds physical allocation bounds"));
        }
        self.charge_items(snapshot.cells.len(), CELL)?;
        self.charge_items(snapshot.own.pieces.len(), UNIT)?;
        self.charge_items(snapshot.own.mines.len(), MINE)?;
        self.charge_items(snapshot.own.sieged_tanks.len(), UNIT)
    }

    pub fn charge_boundary(&mut self, boundary: &EconomicBoundary) -> ContractResult<()> {
        if boundary.groups.len() > MAX_ATOMIC_GROUPS {
            return Err(bad("Boundary exceeds 2048 atomic groups"));
        }
        self.charge(BOUNDARY)?;
        self.charge_snapshot(&boundary.snapshot)?;
        let mut entries = 0_usize;
        for group in &boundary.groups {
            self.charge(GROUP)?;
            entries = entries
                .checked_add(group.entries())
                .filter(|entries| *entries <= MAX_BOUNDARY_ENTRIES)
                .ok_or_else(|| bad("Boundary exceeds 2048 admission actions plus effect facts"))?;
            match group {
                AtomicGroup::Admission { actions, .. } => {
                    self.charge_items(actions.len(), ACTION)?
                }
                AtomicGroup::Effects {
                    before_own,
                    after_own,
                    facts,
                    ..
                } => {
                    self.charge_geometry(before_own)?;
                    self.charge_geometry(after_own)?;
                    self.charge_items(facts.len(), FACT)?;
                }
                AtomicGroup::Vision { changes, .. } => {
                    if changes.len() > 64 {
                        return Err(bad("Vision group exceeds 64 cells"));
                    }
                    self.charge_items(changes.len(), CELL)?;
                }
                AtomicGroup::Settlement { .. } => {}
            }
        }
        Ok(())
    }

    pub(crate) fn charge_canonical_bytes(&mut self, len: usize) -> ContractResult<()> {
        if len > MAX_BOUNDARY_BYTES {
            return Err(budget("Canonical boundary exceeds the byte cap"));
        }
        self.charge_items(len, CANONICAL_BYTE)
    }

    fn charge_items(&mut self, count: usize, fee: u64) -> ContractResult<()> {
        let amount = u64::try_from(count)
            .ok()
            .and_then(|count| count.checked_mul(fee))
            .ok_or_else(|| budget("Ledger work charge overflow"))?;
        self.charge(amount)
    }
}

fn budget(message: &'static str) -> LedgerError {
    LedgerError::new(LedgerErrorCode::Budget, message)
}
fn bad(message: &'static str) -> LedgerError {
    LedgerError::new(LedgerErrorCode::BadInput, message)
}
