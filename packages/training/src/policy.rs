// SPEC: _spec/packages/training/burn-compat.puml
use serde::{Deserialize, Serialize};

use crate::contracts::{Candidate, CandidateBatch, ContractResult, Side};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(try_from = "String", into = "String")]
pub enum BaselinePolicy {
    #[serde(rename = "pass-v1")]
    PassV1,
    #[serde(rename = "first-v1")]
    FirstV1,
    #[serde(rename = "seeded-v1")]
    SeededV1,
}

impl TryFrom<String> for BaselinePolicy {
    type Error = String;

    fn try_from(value: String) -> ContractResult<Self> {
        match value.as_str() {
            "pass-v1" => Ok(Self::PassV1),
            "first-v1" => Ok(Self::FirstV1),
            "seeded-v1" => Ok(Self::SeededV1),
            _ => Err("Unknown baseline policy".into()),
        }
    }
}

impl From<BaselinePolicy> for String {
    fn from(value: BaselinePolicy) -> Self {
        value.as_str().to_owned()
    }
}

impl BaselinePolicy {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::PassV1 => "pass-v1",
            Self::FirstV1 => "first-v1",
            Self::SeededV1 => "seeded-v1",
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Selection {
    pub candidate: Candidate,
    pub index: usize,
}

pub const fn xorshift32(mut seed: u32) -> u32 {
    seed ^= seed << 13;
    seed ^= seed >> 17;
    seed ^= seed << 5;
    seed
}

pub fn select(
    batch: &CandidateBatch,
    policy: BaselinePolicy,
    seed: u32,
) -> ContractResult<Selection> {
    let side = batch
        .candidates
        .iter()
        .find_map(|candidate| candidate.actions.first())
        .map_or(Side::White, |action| action.side());
    batch.validate(side)?;
    let index = match policy {
        BaselinePolicy::PassV1 | BaselinePolicy::FirstV1 => 0,
        BaselinePolicy::SeededV1 => (xorshift32(seed) % batch.candidates.len() as u32) as usize,
    };
    Ok(Selection {
        candidate: batch.candidates[index].clone(),
        index,
    })
}
