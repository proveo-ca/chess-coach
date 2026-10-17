// SPEC: _spec/packages/training/burn-compat.puml
pub mod contracts;
pub mod history;
pub mod work;

pub use contracts::{ContractResult, LedgerError, LedgerErrorCode};
pub use work::{LEDGER_WORK_LIMIT, LedgerWork};
