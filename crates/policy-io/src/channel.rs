// SPEC: _spec/learning-runtime.puml, _spec/policy-runtime.puml
use std::io::{self, BufRead, Write};

use burn::module::{Module, ModuleVisitor, Param};
use burn::store::ModuleRecord;
use burn::tensor::{Bytes, DType, Device, Tensor};
use chess_coach_learning::{AccumulatedEpisode, FEATURES, FeatureBatch, HIDDEN_UNITS, PolicyModel};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::{
    FrozenPolicy, MAX_MESSAGE_BYTES, MAX_RECORD_BYTES, ModelConfig, ScoreRequest, ScoreResponse,
};

#[derive(Debug, Deserialize, Serialize)]
pub enum ChannelVersion {
    #[serde(rename = "chess-coach.learning-channel.v1")]
    V1,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "kebab-case",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum ChannelCommand {
    Begin {
        baseline: f64,
    },
    Score {
        request: ScoreRequest,
    },
    Acknowledge {
        request: ScoreRequest,
        selected: usize,
        journal_digest: String,
    },
    Finish {
        return_value: i8,
    },
    Close,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct ChannelRequest {
    pub version: ChannelVersion,
    pub session_id: String,
    pub ordinal: usize,
    pub model_id: String,
    pub command: ChannelCommand,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "kebab-case",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum ChannelResult {
    Begun,
    Scored {
        response: ScoreResponse,
    },
    Acknowledged {
        journal_digest: String,
        sampled_decisions: usize,
    },
    Diagnostic,
    Proposed {
        record: Vec<u8>,
        config: ModelConfig,
        sampled_decisions: usize,
        objective: f64,
        nonzero_policy_gradient: bool,
        parameter_sha256: String,
    },
    Closed,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct ChannelReply {
    pub version: ChannelVersion,
    pub session_id: String,
    pub ordinal: usize,
    pub model_id: String,
    pub result: ChannelResult,
}

pub struct LearningChannel {
    policy: FrozenPolicy,
    model: Option<PolicyModel>,
    episode: Option<AccumulatedEpisode>,
    device: Device,
    session_id: String,
    ordinal: usize,
    scores: usize,
    journals: Vec<String>,
    decisions: Vec<String>,
    finished: bool,
    closed: bool,
    failed: bool,
}

fn invalid(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
}

fn identifier(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || b"._:-".contains(&byte))
}

pub fn parameter_sha256(model: &PolicyModel) -> io::Result<String> {
    struct HashParameters {
        hash: Sha256,
        count: usize,
        valid: bool,
    }
    impl ModuleVisitor for HashParameters {
        fn visit_float<const D: usize>(&mut self, param: &Param<Tensor<D>>) {
            let tensor = param.val();
            let shape = tensor.dims().to_vec();
            let expected: &[usize] = match self.count {
                0 => &[FEATURES, HIDDEN_UNITS],
                1 => &[HIDDEN_UNITS],
                2 => &[HIDDEN_UNITS, 1],
                _ => {
                    self.valid = false;
                    return;
                }
            };
            if shape.as_slice() != expected || tensor.dtype() != DType::F64 {
                self.valid = false;
                return;
            }
            self.hash.update([self.count as u8]);
            match serde_json::to_vec(&shape) {
                Ok(bytes) => self.hash.update(bytes),
                Err(_) => self.valid = false,
            }
            match tensor.into_data().try_to_vec::<f64>() {
                Ok(values) => {
                    for value in values {
                        self.valid &= value.is_finite();
                        self.hash.update(value.to_le_bytes());
                    }
                }
                Err(_) => self.valid = false,
            }
            self.count += 1;
        }
    }
    let mut visitor = HashParameters {
        hash: Sha256::new(),
        count: 0,
        valid: true,
    };
    visitor
        .hash
        .update(b"chess-coach.parameters.v1\0mlp-relu-32\0chess-coach.features.v1\0");
    model.visit(&mut visitor);
    if !visitor.valid || visitor.count != 3 {
        return Err(invalid("Learning channel: PARAMETER_DIGEST"));
    }
    Ok(format!("{:x}", visitor.hash.finalize()))
}

impl LearningChannel {
    pub fn from_record(
        bytes: &[u8],
        config: ModelConfig,
        device: Device,
        session_id: String,
    ) -> io::Result<Self> {
        if !identifier(&session_id) {
            return Err(invalid("Learning channel: SESSION"));
        }
        let policy = FrozenPolicy::from_record(bytes, config, device.clone())?;
        let device = device.autodiff();
        let record = ModuleRecord::from_bytes(Bytes::from_bytes_vec(bytes.to_vec()))
            .map_err(|_| invalid("Learning channel: RECORD"))?;
        let model = PolicyModel::new(&device)
            .try_load_record(record)
            .map_err(|_| invalid("Learning channel: RECORD"))?;
        Ok(Self {
            policy,
            model: Some(model),
            episode: None,
            device,
            session_id,
            ordinal: 0,
            scores: 0,
            journals: vec![],
            decisions: vec![],
            finished: false,
            closed: false,
            failed: false,
        })
    }

    pub fn closed(&self) -> bool {
        self.closed
    }

    pub fn handle_json(&mut self, json: &[u8]) -> io::Result<Vec<u8>> {
        if self.failed || self.closed {
            return Err(invalid("Learning channel: CLOSED"));
        }
        let result = self.handle(json);
        if result.is_err() {
            self.failed = true;
            self.episode = None;
            self.model = None;
        }
        result
    }

    fn handle(&mut self, json: &[u8]) -> io::Result<Vec<u8>> {
        if json.len() > MAX_MESSAGE_BYTES {
            return Err(invalid("Learning channel: FRAME_BOUND"));
        }
        let request: ChannelRequest =
            serde_json::from_slice(json).map_err(|_| invalid("Learning channel: SCHEMA"))?;
        if request.session_id != self.session_id
            || request.model_id != self.policy.model_id()
            || request.ordinal != self.ordinal
            || self.ordinal >= 256
        {
            return Err(invalid("Learning channel: BINDING"));
        }
        let result = match request.command {
            ChannelCommand::Begin { baseline } => {
                let model = self
                    .model
                    .take()
                    .ok_or_else(|| invalid("Learning channel: PHASE"))?;
                if self.episode.is_some() || self.finished {
                    return Err(invalid("Learning channel: PHASE"));
                }
                self.episode = Some(
                    AccumulatedEpisode::new(model, self.device.clone(), baseline)
                        .map_err(|_| invalid("Learning channel: BASELINE"))?,
                );
                ChannelResult::Begun
            }
            ChannelCommand::Score { request } => {
                if self.episode.is_none() || self.finished || self.scores >= 128 {
                    return Err(invalid("Learning channel: PHASE_OR_SCORE_BOUND"));
                }
                let response = self.policy.score(request)?;
                self.scores += 1;
                ChannelResult::Scored { response }
            }
            ChannelCommand::Acknowledge {
                request,
                selected,
                journal_digest,
            } => {
                if self.finished
                    || self.episode.is_none()
                    || self.journals.len() >= 64
                    || journal_digest.len() != 64
                    || !journal_digest
                        .bytes()
                        .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
                    || self.journals.contains(&journal_digest)
                    || self.decisions.contains(&request.request_id)
                {
                    return Err(invalid("Learning channel: ACK"));
                }
                if request.model_id != self.policy.model_id() || !identifier(&request.request_id) {
                    return Err(invalid("Learning channel: ACK_BINDING"));
                }
                let decision_id = request.request_id;
                let batch = FeatureBatch::new(request.values, request.rows)
                    .map_err(|_| invalid("Learning channel: FEATURES"))?;
                self.episode
                    .as_mut()
                    .ok_or_else(|| invalid("Learning channel: PHASE"))?
                    .acknowledge(&batch, selected)
                    .map_err(|_| invalid("Learning channel: GRADIENT"))?;
                self.decisions.push(decision_id);
                self.journals.push(journal_digest.clone());
                ChannelResult::Acknowledged {
                    journal_digest,
                    sampled_decisions: self.journals.len(),
                }
            }
            ChannelCommand::Finish { return_value } => {
                let episode = self
                    .episode
                    .take()
                    .ok_or_else(|| invalid("Learning channel: PHASE"))?;
                let proposal = episode
                    .finish(return_value)
                    .map_err(|_| invalid("Learning channel: UPDATE"))?;
                self.finished = true;
                match proposal {
                    None => ChannelResult::Diagnostic,
                    Some(proposal) => {
                        let model = proposal.model.valid();
                        let parameter_digest = parameter_sha256(&model)?;
                        let bytes = model
                            .into_record()
                            .into_bytes()
                            .map_err(|_| invalid("Learning channel: RECORD"))?;
                        if bytes.len() > MAX_RECORD_BYTES {
                            return Err(invalid("Learning channel: RECORD_BOUND"));
                        }
                        let record = bytes.to_vec();
                        let config = ModelConfig::for_record(&record);
                        let loaded =
                            ModuleRecord::from_bytes(Bytes::from_bytes_vec(record.clone()))
                                .map_err(|_| invalid("Learning channel: RECORD"))?;
                        let reloaded = PolicyModel::new(&self.device.clone().without_autodiff())
                            .try_load_record(loaded)
                            .map_err(|_| invalid("Learning channel: RECORD"))?;
                        if parameter_sha256(&reloaded)? != parameter_digest {
                            return Err(invalid("Learning channel: RECORD_DRIFT"));
                        }
                        ChannelResult::Proposed {
                            record,
                            config,
                            sampled_decisions: proposal.sampled_decisions,
                            objective: proposal.objective,
                            nonzero_policy_gradient: proposal.nonzero_policy_gradient,
                            parameter_sha256: parameter_digest,
                        }
                    }
                }
            }
            ChannelCommand::Close => {
                if !self.finished || self.episode.is_some() {
                    return Err(invalid("Learning channel: PHASE"));
                }
                self.closed = true;
                ChannelResult::Closed
            }
        };
        let reply = ChannelReply {
            version: ChannelVersion::V1,
            session_id: self.session_id.clone(),
            ordinal: self.ordinal,
            model_id: self.policy.model_id().to_owned(),
            result,
        };
        let bytes =
            serde_json::to_vec(&reply).map_err(|_| invalid("Learning channel: SERIALIZE"))?;
        if bytes.len() > MAX_MESSAGE_BYTES {
            return Err(invalid("Learning channel: REPLY_BOUND"));
        }
        self.ordinal += 1;
        Ok(bytes)
    }
}

pub fn run_channel(
    reader: &mut impl BufRead,
    writer: &mut impl Write,
    channel: &mut LearningChannel,
) -> io::Result<()> {
    let mut messages = 0;
    loop {
        let mut frame = Vec::new();
        loop {
            let buffer = reader.fill_buf()?;
            if buffer.is_empty() {
                return Err(invalid("Learning channel: MISSING_CLOSE"));
            }
            let used = buffer
                .iter()
                .position(|byte| *byte == b'\n')
                .map_or(buffer.len(), |index| index + 1);
            if frame.len() + used > MAX_MESSAGE_BYTES + 1 {
                return Err(invalid("Learning channel: FRAME_BOUND"));
            }
            let complete = buffer[used - 1] == b'\n';
            frame.extend_from_slice(&buffer[..used]);
            reader.consume(used);
            if complete {
                break;
            }
        }
        messages += 1;
        if messages > 256 {
            return Err(invalid("Learning channel: MESSAGE_BOUND"));
        }
        let reply = channel.handle_json(&frame[..frame.len() - 1])?;
        writer.write_all(&reply)?;
        writer.write_all(b"\n")?;
        writer.flush()?;
        if channel.closed() {
            if !reader.fill_buf()?.is_empty() {
                return Err(invalid("Learning channel: TRAILING_INPUT"));
            }
            return Ok(());
        }
    }
}
