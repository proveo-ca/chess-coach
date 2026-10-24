// SPEC: _spec/packages/training/artifact-lifecycle.puml
use crate::artifact_bytes::{ArtifactError, ArtifactResult, Float64Hex};
use crate::learner_math::Vector418;

pub struct PolicyWeights {
    values: Vector418,
}

impl PolicyWeights {
    pub fn zeros() -> Self { Self { values: [0.0; 418] } }

    pub fn from_vector(values: &Vector418) -> ArtifactResult<Self> {
        if values.iter().any(|value| !value.is_finite()) { return Err(ArtifactError::Float); }
        Ok(Self { values: *values })
    }

    pub fn detached_copy(&self) -> Vector418 { self.values }

    pub(crate) fn from_wire(values: &[Float64Hex]) -> ArtifactResult<Self> {
        if values.len() != 418 { return Err(ArtifactError::Manifest); }
        let mut weights = [0.0; 418];
        for (target, value) in weights.iter_mut().zip(values) { *target = value.to_f64(); }
        Self::from_vector(&weights)
    }
}
