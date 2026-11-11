// SPEC: _spec/ml-runtime-architecture.puml
pub const FEATURES: usize = 2271;
pub const STATE_FEATURES: usize = 1679;
pub const HIDDEN_UNITS: usize = 32;
pub const MAX_CANDIDATES: usize = 512;
pub const MAX_ABS_VALUE: f64 = 1_000_000.0;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BatchError {
    Shape,
    NonFinite,
    OutOfRange,
}

#[derive(Clone, Debug, PartialEq)]
pub struct FeatureBatch {
    values: Vec<f64>,
    rows: usize,
}

impl FeatureBatch {
    pub fn new(mut values: Vec<f64>, rows: usize) -> Result<Self, BatchError> {
        if !(1..=MAX_CANDIDATES).contains(&rows) || values.len() != rows * FEATURES {
            return Err(BatchError::Shape);
        }
        for value in &mut values {
            if !value.is_finite() {
                return Err(BatchError::NonFinite);
            }
            if value.abs() > MAX_ABS_VALUE {
                return Err(BatchError::OutOfRange);
            }
            if *value == 0.0 {
                *value = 0.0;
            }
        }
        Ok(Self { values, rows })
    }

    pub fn rows(&self) -> usize {
        self.rows
    }

    pub fn values(&self) -> &[f64] {
        &self.values
    }
}
