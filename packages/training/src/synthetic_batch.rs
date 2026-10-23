// SPEC: _spec/packages/training/burn-compat.puml
use crate::{COLUMNS, ErrorCode, MAX_ABS_VALUE, MAX_ROWS, ScoreError};

pub(crate) struct SyntheticBatch<'a> {
    values: &'a [f64],
    rows: usize,
}

impl<'a> SyntheticBatch<'a> {
    pub(crate) fn new(values: &'a [f64], rows: usize) -> Result<Self, ScoreError> {
        if !(1..=MAX_ROWS).contains(&rows) || rows.checked_mul(COLUMNS) != Some(values.len()) {
            return Err(ScoreError::new(
                ErrorCode::Shape,
                "matrix must contain 1..512 rows of 418 values",
            ));
        }
        if values.iter().any(|value| !value.is_finite()) {
            return Err(ScoreError::new(
                ErrorCode::NonFinite,
                "matrix values must be finite",
            ));
        }
        if values.iter().any(|value| value.abs() > MAX_ABS_VALUE) {
            return Err(ScoreError::new(
                ErrorCode::BadRequest,
                "matrix values must have absolute value <= 1000000",
            ));
        }
        Ok(Self { values, rows })
    }

    pub(crate) fn rows(&self) -> usize {
        self.rows
    }

    pub(crate) fn normalized_values(&self) -> Vec<f64> {
        self.values
            .iter()
            .map(|&value| if value == 0.0 { 0.0 } else { value })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rejection(values: &[f64], rows: usize) -> ErrorCode {
        match SyntheticBatch::new(values, rows) {
            Err(error) => error.code,
            Ok(_) => panic!("invalid batch accepted"),
        }
    }

    #[test]
    fn rejects_shape_overflow_and_nonfinite_before_magnitude() {
        for rows in [0, MAX_ROWS + 1, usize::MAX] {
            assert_eq!(rejection(&[f64::NAN], rows), ErrorCode::Shape);
        }
        assert_eq!(rejection(&[0.0], 1), ErrorCode::Shape);
        let mut values = vec![MAX_ABS_VALUE + 1.0; COLUMNS];
        values[COLUMNS - 1] = f64::INFINITY;
        assert_eq!(rejection(&values, 1), ErrorCode::NonFinite);
        values[COLUMNS - 1] = 0.0;
        assert_eq!(rejection(&values, 1), ErrorCode::BadRequest);
    }

    #[test]
    fn accepts_bounded_borrowed_data_and_normalizes_only_signed_zero() {
        let mut values = vec![-0.0; MAX_ROWS * COLUMNS];
        values[0] = MAX_ABS_VALUE;
        values[1] = -MAX_ABS_VALUE;
        values[2] = 2.0_f64.powi(-40);
        let batch = SyntheticBatch::new(&values, MAX_ROWS).unwrap();
        assert_eq!(batch.values.as_ptr(), values.as_ptr());
        assert_eq!(batch.rows(), MAX_ROWS);
        let normalized = batch.normalized_values();
        assert_eq!(normalized[..3], values[..3]);
        assert_eq!(normalized[3].to_bits(), 0.0_f64.to_bits());
        assert_eq!(values[3].to_bits(), (-0.0_f64).to_bits());
    }
}
