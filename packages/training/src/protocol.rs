// SPEC: _spec/packages/training/burn-compat.puml
use std::io::Read;
use std::marker::PhantomData;

use serde::de::{MapAccess, Visitor, value::MapAccessDeserializer};
use serde::{Deserialize, Deserializer, Serialize};

use crate::{COLUMNS, ErrorCode, MAX_ROWS, ScoreError, score_synthetic_f64};

pub const PROTOCOL: &str = "training-burn-compat-v1";
pub const MODEL: &str = "synthetic-linear-418-v1";
pub const INPUT_LIMIT: usize = 8 * 1024 * 1024;

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct Request {
    protocol: String,
    id: u32,
    op: String,
    model: String,
    dtype: String,
    #[serde(deserialize_with = "deserialize_object")]
    matrix: Matrix,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct Matrix {
    rows: i64,
    columns: i64,
    values: Vec<f64>,
}

fn deserialize_object<'de, D, T>(deserializer: D) -> Result<T, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    struct ObjectVisitor<T>(PhantomData<T>);

    impl<'de, T: Deserialize<'de>> Visitor<'de> for ObjectVisitor<T> {
        type Value = T;

        fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            formatter.write_str("a JSON object")
        }

        fn visit_map<M: MapAccess<'de>>(self, map: M) -> Result<T, M::Error> {
            T::deserialize(MapAccessDeserializer::new(map))
        }
    }

    deserializer.deserialize_map(ObjectVisitor(PhantomData))
}

fn parse_request(bytes: &[u8]) -> Result<Request, serde_json::Error> {
    let mut deserializer = serde_json::Deserializer::from_slice(bytes);
    let request = deserialize_object(&mut deserializer)?;
    deserializer.end()?;
    Ok(request)
}

#[derive(Debug, Serialize)]
#[serde(deny_unknown_fields)]
pub struct SuccessReply {
    protocol: &'static str,
    id: u32,
    ok: bool,
    backend: &'static str,
    model: &'static str,
    dtype: &'static str,
    scores: Vec<f64>,
}

#[derive(Debug, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ErrorDetail {
    code: ErrorCode,
    message: &'static str,
}

#[derive(Debug, Serialize)]
#[serde(deny_unknown_fields)]
pub struct FailureReply {
    protocol: &'static str,
    id: Option<u32>,
    ok: bool,
    error: ErrorDetail,
}

#[derive(Debug, Serialize)]
#[serde(untagged)]
pub enum Reply {
    Success(SuccessReply),
    Failure(FailureReply),
}

impl Reply {
    pub fn failure(id: Option<u32>, code: ErrorCode, message: &'static str) -> Self {
        Self::Failure(FailureReply {
            protocol: PROTOCOL,
            id,
            ok: false,
            error: ErrorDetail { code, message },
        })
    }

    pub fn exit_code(&self) -> u8 {
        match self {
            Self::Success(_) => 0,
            Self::Failure(reply) if reply.error.code == ErrorCode::BackendFailure => 1,
            Self::Failure(_) => 2,
        }
    }
}

pub fn read_bounded(reader: impl Read) -> Result<Vec<u8>, ScoreError> {
    let mut bytes = Vec::new();
    reader
        .take((INPUT_LIMIT + 1) as u64)
        .read_to_end(&mut bytes)
        .map_err(|_| ScoreError::new(ErrorCode::BackendFailure, "cannot read stdin"))?;
    if bytes.len() > INPUT_LIMIT {
        return Err(ScoreError::new(
            ErrorCode::BadRequest,
            "stdin exceeds 8 MiB",
        ));
    }
    Ok(bytes)
}

pub fn process(bytes: &[u8]) -> Reply {
    if bytes.len() > INPUT_LIMIT {
        return Reply::failure(None, ErrorCode::BadRequest, "stdin exceeds 8 MiB");
    }
    let request = match parse_request(bytes) {
        Ok(request) => request,
        Err(error) => {
            return if error.to_string().starts_with("number out of range") {
                Reply::failure(None, ErrorCode::NonFinite, "JSON number exceeds finite f64")
            } else {
                Reply::failure(None, ErrorCode::BadRequest, "invalid score request")
            };
        }
    };
    if request.protocol != PROTOCOL
        || request.op != "score"
        || request.model != MODEL
        || request.dtype != "f64"
    {
        return Reply::failure(
            Some(request.id),
            ErrorCode::BadRequest,
            "invalid score request",
        );
    }
    if !(1..=MAX_ROWS as i64).contains(&request.matrix.rows)
        || request.matrix.columns != COLUMNS as i64
    {
        return Reply::failure(
            Some(request.id),
            ErrorCode::Shape,
            "matrix must have 1..512 rows and 418 columns",
        );
    }
    match score_synthetic_f64(&request.matrix.values, request.matrix.rows as usize) {
        Ok(scores) => Reply::Success(SuccessReply {
            protocol: PROTOCOL,
            id: request.id,
            ok: true,
            backend: "burn-flex-cpu",
            model: MODEL,
            dtype: "f64",
            scores,
        }),
        Err(error) => Reply::failure(Some(request.id), error.code, error.message),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::Cell;
    use std::io;

    #[test]
    fn bounded_reader_stops_at_limit_plus_one_before_json_parsing() {
        struct CountingReader<'a>(&'a Cell<usize>);
        impl Read for CountingReader<'_> {
            fn read(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
                buffer.fill(b' ');
                self.0.set(self.0.get() + buffer.len());
                Ok(buffer.len())
            }
        }
        let count = Cell::new(0);
        assert_eq!(
            read_bounded(CountingReader(&count)).unwrap_err().code,
            ErrorCode::BadRequest
        );
        assert_eq!(count.get(), INPUT_LIMIT + 1);
        assert_eq!(read_bounded(&b"{}"[..]).unwrap(), b"{}");
    }

    #[test]
    fn read_failure_returns_internal_exit_code() {
        struct BrokenReader;
        impl Read for BrokenReader {
            fn read(&mut self, _: &mut [u8]) -> io::Result<usize> {
                Err(io::Error::other("unreadable"))
            }
        }
        let error = read_bounded(BrokenReader).unwrap_err();
        assert_eq!(
            Reply::failure(None, error.code, error.message).exit_code(),
            1
        );
    }
}
