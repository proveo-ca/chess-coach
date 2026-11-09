// SPEC: _spec/policy-io.puml
#![forbid(unsafe_code)]

pub mod channel;
mod device;

pub use device::selected_f64_device;

use std::io;

use burn::module::Module;
use burn::store::ModuleRecord;
use burn::tensor::{Bytes, Device, FloatDType};
use chess_coach_learning::{FEATURES, FeatureBatch, HIDDEN_UNITS, PolicyModel};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

pub const MAX_MESSAGE_BYTES: usize = 8 * 1024 * 1024;
pub const MAX_RECORD_BYTES: usize = 1024 * 1024;
pub const MAX_CONFIG_BYTES: usize = 4096;

#[derive(Clone, Debug, Deserialize, Serialize)]
pub enum FeatureVersion {
    #[serde(rename = "chess-coach.features.v1")]
    V1,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub enum Architecture {
    #[serde(rename = "mlp-relu-32")]
    MlpRelu32,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub enum ConfigVersion {
    #[serde(rename = "chess-coach.model-config.v1")]
    V1,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct ModelConfig {
    pub version: ConfigVersion,
    pub architecture: Architecture,
    pub feature_version: FeatureVersion,
    pub input_features: usize,
    pub hidden_units: usize,
    pub record_sha256: String,
}

impl ModelConfig {
    pub fn for_record(bytes: &[u8]) -> Self {
        Self {
            version: ConfigVersion::V1,
            architecture: Architecture::MlpRelu32,
            feature_version: FeatureVersion::V1,
            input_features: FEATURES,
            hidden_units: HIDDEN_UNITS,
            record_sha256: format!("{:x}", Sha256::digest(bytes)),
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub enum RequestVersion {
    #[serde(rename = "chess-coach.inference.v1")]
    V1,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct ScoreRequest {
    pub version: RequestVersion,
    pub feature_version: FeatureVersion,
    pub request_id: String,
    pub model_id: String,
    pub rows: usize,
    pub values: Vec<f64>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct ScoreResponse {
    pub version: RequestVersion,
    pub feature_version: FeatureVersion,
    pub request_id: String,
    pub model_id: String,
    pub logits: Vec<f64>,
}

pub struct FrozenPolicy {
    model: PolicyModel,
    device: Device,
    model_id: String,
}

fn invalid(message: impl Into<String>) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message.into())
}

impl FrozenPolicy {
    pub fn from_record(bytes: &[u8], config: ModelConfig, device: Device) -> io::Result<Self> {
        if bytes.is_empty() || bytes.len() > MAX_RECORD_BYTES {
            return Err(invalid("Invalid native record size"));
        }
        if device.is_autodiff() || device.settings().float_dtype != FloatDType::F64 {
            return Err(invalid("Policy inference requires an F64 inference device"));
        }
        let model_id = format!("{:x}", Sha256::digest(bytes));
        if config.input_features != FEATURES
            || config.hidden_units != HIDDEN_UNITS
            || config.record_sha256 != model_id
        {
            return Err(invalid("Model configuration or record hash mismatch"));
        }
        let record = ModuleRecord::from_bytes(Bytes::from_bytes_vec(bytes.to_vec()))
            .map_err(|error| invalid(error.to_string()))?;
        let model = PolicyModel::new(&device)
            .try_load_record(record)
            .map_err(|error| invalid(error.to_string()))?;
        if !model.has_finite_f64_parameters() {
            return Err(invalid("Invalid native policy parameters"));
        }
        Ok(Self {
            model,
            device,
            model_id,
        })
    }

    pub fn model_id(&self) -> &str {
        &self.model_id
    }

    pub fn score(&self, request: ScoreRequest) -> io::Result<ScoreResponse> {
        if request.request_id.is_empty()
            || request.request_id.len() > 64
            || !request
                .request_id
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || b"._:-".contains(&byte))
        {
            return Err(invalid("Invalid request identifier"));
        }
        if request.model_id != self.model_id {
            return Err(invalid("Request does not match the frozen native record"));
        }
        let features = FeatureBatch::new(request.values, request.rows)
            .map_err(|error| invalid(format!("Invalid feature batch: {error:?}")))?;
        let logits = self
            .model
            .logits(&features, &self.device)
            .into_data()
            .try_to_vec::<f64>()
            .map_err(|error| invalid(error.to_string()))?;
        if logits.iter().any(|value| !value.is_finite()) {
            return Err(invalid("Policy produced a nonfinite logit"));
        }
        Ok(ScoreResponse {
            version: RequestVersion::V1,
            feature_version: FeatureVersion::V1,
            request_id: request.request_id,
            model_id: self.model_id.clone(),
            logits,
        })
    }

    pub fn score_json(&self, json: &[u8]) -> io::Result<Vec<u8>> {
        if json.len() > MAX_MESSAGE_BYTES {
            return Err(invalid("Inference message exceeds byte limit"));
        }
        let request = serde_json::from_slice(json).map_err(|error| invalid(error.to_string()))?;
        let response = self.score(request)?;
        serde_json::to_vec(&response).map_err(|error| invalid(error.to_string()))
    }
}
