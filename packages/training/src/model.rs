// SPEC: _spec/packages/training/burn-compat.puml
use burn::module::{Module, Param, ParamId};
use burn::tensor::{Device, Tensor, TensorData};

use crate::COLUMNS;

#[derive(Module, Debug)]
pub(crate) struct SyntheticLinear {
    pub(crate) weight: Param<Tensor<2>>,
    pub(crate) bias: Param<Tensor<1>>,
}

impl SyntheticLinear {
    pub(crate) fn new(device: &Device) -> Self {
        let mut weights = vec![0.0_f64; COLUMNS];
        weights[0] = 0.5;
        weights[1] = -0.25;
        Self::from_values(weights, 0.125, device)
    }

    fn from_values(weights: Vec<f64>, bias: f64, device: &Device) -> Self {
        Self {
            weight: Param::initialized(
                ParamId::from(1_u64),
                Tensor::from_data(TensorData::new(weights, [COLUMNS, 1]), device)
                    .set_require_grad(device.is_autodiff()),
            ),
            bias: Param::initialized(
                ParamId::from(2_u64),
                Tensor::from_data([bias], device).set_require_grad(device.is_autodiff()),
            ),
        }
    }

    pub(crate) fn forward(&self, input: Tensor<2>) -> Tensor<2> {
        input.matmul(self.weight.val()) + self.bias.val().unsqueeze::<2>()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{ErrorCode, F64Runtime, MAX_ABS_VALUE, MAX_ROWS, ScoreError, score_synthetic_f64};
    use burn::tensor::DType;
    use burn::store::{ApplyResult, BurnpackStore, ModuleSnapshot, ModuleStore};
    use burn::tensor::Bytes;
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicU64, Ordering};

    fn f64_device() -> Result<Device, ScoreError> {
        Ok(F64Runtime::initialize()?.device().clone())
    }

    fn fixture() -> Vec<f64> {
        let mut values = vec![0.0; 2 * COLUMNS];
        values[0] = 1.0;
        values[1] = 2.0;
        values[COLUMNS] = 3.0;
        values[COLUMNS + 1] = 4.0;
        values
    }

    fn data<const D: usize>(tensor: Tensor<D>) -> Vec<f64> {
        assert_eq!(tensor.dtype(), DType::F64);
        tensor.into_data().try_to_vec::<f64>().unwrap()
    }

    fn close(actual: &[f64], expected: &[f64]) {
        assert_eq!(actual.len(), expected.len());
        for (index, (actual, expected)) in actual.iter().zip(expected).enumerate() {
            assert!(
                (actual - expected).abs() <= 1e-12,
                "index {index}: {actual} != {expected}"
            );
        }
    }

    fn updated_model() -> SyntheticLinear {
        crate::offline_trainer::updated_model()
    }

    fn sentinel() -> SyntheticLinear {
        let mut model =
            SyntheticLinear::from_values(vec![19.0; COLUMNS], -23.0, &f64_device().unwrap());
        model.weight.id = ParamId::from(3_u64);
        model.bias.id = ParamId::from(4_u64);
        model
    }

    fn bits(values: Vec<f64>) -> Vec<u64> {
        values.into_iter().map(f64::to_bits).collect()
    }

    fn assert_loaded(expected: &SyntheticLinear, loaded: &SyntheticLinear, status: ApplyResult) {
        let mut names = status.applied;
        names.sort();
        assert_eq!(names, ["bias", "weight"]);
        assert!(status.skipped.is_empty());
        assert!(status.missing.is_empty());
        assert!(status.unused.is_empty());
        assert!(status.errors.is_empty());
        assert_eq!(loaded.weight.val().dims(), [COLUMNS, 1]);
        assert_eq!(loaded.bias.val().dims(), [1]);
        assert_eq!(expected.weight.id, loaded.weight.id);
        assert_eq!(expected.bias.id, loaded.bias.id);
        assert_eq!(
            bits(data(expected.weight.val())),
            bits(data(loaded.weight.val()))
        );
        assert_eq!(
            bits(data(expected.bias.val())),
            bits(data(loaded.bias.val()))
        );
        let input = Tensor::<2>::from_data(
            TensorData::new(fixture(), [2, COLUMNS]),
            &f64_device().unwrap(),
        );
        let expected_scores = data(expected.valid().forward(input.clone()));
        let loaded_scores = data(loaded.forward(input));
        close(&loaded_scores, &[-0.765625, -1.359375]);
        assert_eq!(bits(expected_scores), bits(loaded_scores));
        close(&data(loaded.weight.val()), &{
            let mut weights = vec![0.0; COLUMNS];
            weights[0] = 0.25;
            weights[1] = -0.546875;
            weights
        });
    }

    fn checkpoint(model: &SyntheticLinear) -> Bytes {
        let mut store = BurnpackStore::from_bytes(None);
        model.save_into(&mut store).unwrap();
        assert_eq!(store.keys().unwrap(), ["bias", "weight"]);
        store.get_bytes().unwrap()
    }

    struct PrivateCheckpoint {
        directory: PathBuf,
        path: PathBuf,
    }

    impl PrivateCheckpoint {
        fn new() -> Self {
            static COUNTER: AtomicU64 = AtomicU64::new(0);
            for _ in 0..100 {
                let nonce = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_nanos();
                let directory = std::env::temp_dir().join(format!(
                    "training-native-{}-{nonce}-{}",
                    std::process::id(),
                    COUNTER.fetch_add(1, Ordering::Relaxed),
                ));
                let mut builder = std::fs::DirBuilder::new();
                #[cfg(unix)]
                {
                    use std::os::unix::fs::DirBuilderExt;
                    builder.mode(0o700);
                }
                match builder.create(&directory) {
                    Ok(()) => {
                        let path = directory.join("model.bpk");
                        return Self { directory, path };
                    }
                    Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
                    Err(error) => panic!("cannot create private checkpoint directory: {error}"),
                }
            }
            panic!("cannot allocate unique checkpoint directory");
        }
    }

    impl Drop for PrivateCheckpoint {
        fn drop(&mut self) {
            let _ = std::fs::remove_file(&self.path);
            let _ = std::fs::remove_dir(&self.directory);
        }
    }

    #[test]
    fn f64_forward_autograd_and_burn_sgd_match_full_vectors() {
        let _ = updated_model();
    }

    #[test]
    fn scoring_preserves_sub_f32_difference() {
        let mut values = vec![0.0; 2 * COLUMNS];
        values[0] = 1.0;
        values[COLUMNS] = 1.0 + 2.0_f64.powi(-30);
        let scores = score_synthetic_f64(&values, 2).unwrap();
        assert_eq!(scores[1] - scores[0], 2.0_f64.powi(-31));
    }

    #[test]
    fn scoring_matches_independent_full_width_oracle() {
        let values = (0..3 * COLUMNS)
            .map(|index| (index as f64 - 500.0) / 8.0)
            .collect::<Vec<_>>();
        let weights = {
            let mut values = vec![0.0; COLUMNS];
            values[0] = 0.5;
            values[1] = -0.25;
            values
        };
        let expected = values
            .chunks_exact(COLUMNS)
            .map(|row| row.iter().zip(&weights).map(|(x, w)| x * w).sum::<f64>() + 0.125)
            .collect::<Vec<_>>();
        close(&score_synthetic_f64(&values, 3).unwrap(), &expected);
    }

    #[test]
    fn scoring_validates_library_boundary_and_normalizes_zero() {
        for rows in [0, MAX_ROWS + 1, usize::MAX] {
            assert_eq!(
                score_synthetic_f64(&[], rows).unwrap_err().code,
                ErrorCode::Shape
            );
        }
        assert_eq!(
            score_synthetic_f64(&[0.0], 1).unwrap_err().code,
            ErrorCode::Shape
        );
        for invalid in [f64::NAN, f64::INFINITY, f64::NEG_INFINITY] {
            let mut values = vec![0.0; COLUMNS];
            values[COLUMNS - 1] = invalid;
            assert_eq!(
                score_synthetic_f64(&values, 1).unwrap_err().code,
                ErrorCode::NonFinite
            );
        }
        let mut values = vec![-0.0; COLUMNS];
        values[0] = -0.25;
        assert_eq!(
            score_synthetic_f64(&values, 1).unwrap()[0].to_bits(),
            0.0_f64.to_bits()
        );
        values[COLUMNS - 1] = MAX_ABS_VALUE + 1.0;
        assert_eq!(
            score_synthetic_f64(&values, 1).unwrap_err().code,
            ErrorCode::BadRequest
        );
    }

    #[test]
    fn burnpack_memory_roundtrip_restores_updated_model_bits() {
        let updated = updated_model();
        let bytes = checkpoint(&updated);
        let mut loaded = sentinel();
        assert_ne!(
            bits(data(updated.weight.val())),
            bits(data(loaded.weight.val()))
        );
        let status = loaded
            .load_from(&mut BurnpackStore::from_bytes(Some(bytes)))
            .unwrap();
        assert_loaded(&updated, &loaded, status);
    }

    #[test]
    fn burnpack_file_roundtrip_restores_updated_model_bits() {
        let updated = updated_model();
        let file = PrivateCheckpoint::new();
        updated
            .save_into(&mut BurnpackStore::from_file(&file.path))
            .unwrap();
        assert!(file.path.is_file());
        let mut loaded = sentinel();
        let status = loaded
            .load_from(&mut BurnpackStore::from_file(&file.path))
            .unwrap();
        assert_loaded(&updated, &loaded, status);
    }

    #[test]
    fn burnpack_rejects_corrupt_and_truncated_memory_and_files() {
        let bytes = checkpoint(&updated_model());
        let original: &[u8] = bytes.as_ref();
        let mut corrupt = original.to_vec();
        corrupt[..8].fill(0);
        let cases = [
            corrupt,
            Vec::new(),
            original[..8].to_vec(),
            original[..original.len() / 2].to_vec(),
        ];
        let file = PrivateCheckpoint::new();
        for invalid in cases {
            let mut loaded = sentinel();
            let mut store = BurnpackStore::from_bytes(Some(Bytes::from_bytes_vec(invalid.clone())));
            assert!(loaded.load_from(&mut store).is_err());
            std::fs::write(&file.path, invalid).unwrap();
            assert!(
                sentinel()
                    .load_from(&mut BurnpackStore::from_file(&file.path))
                    .is_err()
            );
        }
    }
}
