// SPEC: _spec/apps/arena/burn-compat.puml
use crate::ArenaResult;
use crate::observation::{Color, Observation, Square, required_nullable};
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use serde_json::Value;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) enum Protocol {
    #[serde(rename = "arena-engine-v1")]
    V1,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) enum Fixture {
    #[serde(rename = "tiny-v1")]
    TinyV1,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) enum Kind {
    #[serde(rename = "classical")]
    Classical,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) enum Timing {
    #[serde(rename = "C")]
    Classical,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct Action {
    color: Color,
    pub(crate) from: Square,
    kind: Kind,
    timing: Timing,
    pub(crate) to: Square,
}

impl Action {
    pub(crate) fn classical(from: Square, to: Square) -> Self {
        Self {
            color: Color::White,
            from,
            kind: Kind::Classical,
            timing: Timing::Classical,
            to,
        }
    }

    pub(crate) fn canonical_key(&self) -> String {
        format!(
            r#"{{"color":"{}","from":"{}","kind":"classical","timing":"C","to":"{}"}}"#,
            if self.color == Color::White { "w" } else { "b" },
            String::from(self.from),
            String::from(self.to)
        )
    }

    fn validate_tiny(&self) -> ArenaResult<()> {
        if self.color != Color::White
            || String::from(self.from) != "e1"
            || !matches!(String::from(self.to).as_str(), "d1" | "f1")
        {
            return Err("Tiny fixture accepts only white e1-to-d1/f1 classical actions".into());
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "op", rename_all = "lowercase", deny_unknown_fields)]
pub(crate) enum Request {
    Open {
        protocol: Protocol,
        id: u32,
        fixture: Fixture,
    },
    Settle {
        protocol: Protocol,
        id: u32,
        fixture: Fixture,
        action: Action,
    },
}

impl Request {
    pub(crate) fn open() -> Self {
        Self::Open {
            protocol: Protocol::V1,
            id: 0,
            fixture: Fixture::TinyV1,
        }
    }

    pub(crate) fn settle(action: &Action) -> ArenaResult<Self> {
        action.validate_tiny()?;
        Ok(Self::Settle {
            protocol: Protocol::V1,
            id: 0,
            fixture: Fixture::TinyV1,
            action: action.clone(),
        })
    }

    fn id(&self) -> u32 {
        match self {
            Self::Open { id, .. } | Self::Settle { id, .. } => *id,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct Flag<const EXPECTED: bool>;

impl<const EXPECTED: bool> Serialize for Flag<EXPECTED> {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_bool(EXPECTED)
    }
}

impl<'de, const EXPECTED: bool> Deserialize<'de> for Flag<EXPECTED> {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        if bool::deserialize(deserializer)? != EXPECTED {
            return Err(serde::de::Error::custom("Unexpected ok flag"));
        }
        Ok(Self)
    }
}

#[derive(Clone, Copy, Debug, Deserialize)]
enum OpenOp {
    #[serde(rename = "open")]
    Open,
}

#[derive(Clone, Copy, Debug, Deserialize)]
enum SettleOp {
    #[serde(rename = "settle")]
    Settle,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct OpenReply {
    protocol: Protocol,
    id: u32,
    ok: Flag<true>,
    op: OpenOp,
    pub(crate) observation: Observation,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct SettleReply {
    protocol: Protocol,
    id: u32,
    ok: Flag<true>,
    op: SettleOp,
    pub(crate) observation: Observation,
    pub(crate) result: EngineResult,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
enum FailureCode {
    BadRequest,
    NativeRejection,
    EngineFailure,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct FailureError {
    code: FailureCode,
    message: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct FailureReply {
    protocol: Protocol,
    #[serde(deserialize_with = "required_nullable")]
    id: Option<u32>,
    ok: Flag<false>,
    error: FailureError,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
pub(crate) enum Reply {
    Open(OpenReply),
    Settle(Box<SettleReply>),
    Failure(FailureReply),
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct Bank {
    pub(crate) w: u32,
    pub(crate) b: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct RequestedActions {
    pub(crate) w: Vec<Action>,
    pub(crate) b: Vec<Action>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct EngineResult {
    initial_scfen: String,
    open_scfen: String,
    committed_scfen: String,
    final_scfen: String,
    pub(crate) bank_before: Bank,
    pub(crate) bank_committed: Bank,
    pub(crate) bank_after: Bank,
    pub(crate) requested_actions: RequestedActions,
    raw_begin: Value,
    raw_resolve: Value,
}

pub(crate) fn decode_reply(
    bytes: &[u8],
    request: &Request,
    exit_code: Option<i32>,
) -> ArenaResult<Reply> {
    let Some((&b'\n', body)) = bytes.split_last() else {
        return Err("Engine reply must end with one newline".into());
    };
    if body.is_empty() || body.contains(&b'\n') {
        return Err("Engine must emit exactly one JSON reply line".into());
    }
    let reply: Reply =
        serde_json::from_slice(body).map_err(|error| format!("Invalid engine reply: {error}"))?;
    let id = match &reply {
        Reply::Open(value) => {
            let _ = (value.protocol, value.ok, value.op);
            value.observation.validate()?;
            if !matches!(request, Request::Open { .. }) {
                return Err("Engine reply op does not match settle request".into());
            }
            value.id
        }
        Reply::Settle(value) => {
            let _ = (value.protocol, value.ok, value.op);
            value.observation.validate()?;
            if !matches!(request, Request::Settle { .. }) {
                return Err("Engine reply op does not match open request".into());
            }
            for bank in [
                value.result.bank_before,
                value.result.bank_committed,
                value.result.bank_after,
            ] {
                if bank.w > 12 || bank.b > 12 {
                    return Err("Engine bank exceeds native mineral bound".into());
                }
            }
            value.id
        }
        Reply::Failure(value) => {
            let _ = (value.protocol, value.ok);
            if value.id != Some(request.id()) {
                return Err("Engine failure reply id does not match request".into());
            }
            let expected_status = match value.error.code {
                FailureCode::BadRequest | FailureCode::NativeRejection => 2,
                FailureCode::EngineFailure => 1,
            };
            if exit_code != Some(expected_status) {
                return Err("Engine failure reply and exit status disagree".into());
            }
            return Err(format!(
                "Engine {:?}: {}",
                value.error.code, value.error.message
            ));
        }
    };
    if id != request.id() {
        return Err("Engine reply id does not match request".into());
    }
    if exit_code != Some(0) {
        return Err("Engine success reply has nonzero exit status".into());
    }
    Ok(reply)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::observation::fixture;
    use serde_json::json;

    fn valid_open() -> Value {
        json!({"protocol":"arena-engine-v1","id":0,"ok":true,"op":"open","observation":fixture()})
    }

    fn line(value: &Value) -> Vec<u8> {
        let mut bytes = serde_json::to_vec(value).unwrap();
        bytes.push(b'\n');
        bytes
    }

    #[test]
    fn requests_and_actions_are_closed_and_typed() {
        let request = serde_json::to_value(Request::open()).unwrap();
        assert_eq!(
            request,
            json!({"protocol":"arena-engine-v1","id":0,"op":"open","fixture":"tiny-v1"})
        );
        for (key, value) in [
            ("snapshot", json!({})),
            ("bank", json!({"w":3,"b":3})),
            ("id", json!(-1)),
            ("protocol", json!("other")),
            ("fixture", json!("other")),
        ] {
            let mut invalid = request.clone();
            invalid[key] = value;
            assert!(serde_json::from_value::<Request>(invalid).is_err());
        }
        let action = Action::classical(
            Square::try_from("e1".to_owned()).unwrap(),
            Square::try_from("f1".to_owned()).unwrap(),
        );
        let valid = serde_json::to_value(&action).unwrap();
        assert_eq!(
            serde_json::to_string(&action).unwrap(),
            action.canonical_key()
        );
        for (key, value) in [
            ("seq", json!(0)),
            ("from", json!("e9")),
            ("kind", json!("deploy")),
            ("timing", json!("S")),
            ("color", json!("x")),
        ] {
            let mut invalid = valid.clone();
            invalid[key] = value;
            assert!(serde_json::from_value::<Action>(invalid).is_err());
        }
    }

    #[test]
    fn reply_requires_exact_protocol_phase_id_and_success_status() {
        let valid = valid_open();
        assert!(decode_reply(&line(&valid), &Request::open(), Some(0)).is_ok());
        assert!(decode_reply(&line(&valid), &Request::open(), Some(1)).is_err());
        for (key, value) in [
            ("id", json!(1)),
            ("id", json!(null)),
            ("id", json!(4294967296u64)),
            ("ok", json!(1)),
            ("extra", json!(true)),
            ("protocol", json!("v0")),
            ("op", json!("settle")),
        ] {
            let mut invalid = valid.clone();
            invalid[key] = value;
            assert!(decode_reply(&line(&invalid), &Request::open(), Some(0)).is_err());
        }
        let action = Action::classical(
            Square::try_from("e1".to_owned()).unwrap(),
            Square::try_from("d1".to_owned()).unwrap(),
        );
        assert!(decode_reply(&line(&valid), &Request::settle(&action).unwrap(), Some(0)).is_err());
        let duplicate =
            String::from_utf8(line(&valid))
                .unwrap()
                .replacen("\"id\":0", "\"id\":0,\"id\":0", 1);
        assert!(decode_reply(duplicate.as_bytes(), &Request::open(), Some(0)).is_err());
    }

    #[test]
    fn reply_rejects_missing_newline_trailing_messages_and_private_fields() {
        let valid = valid_open();
        assert!(
            decode_reply(
                &serde_json::to_vec(&valid).unwrap(),
                &Request::open(),
                Some(0)
            )
            .is_err()
        );
        let mut doubled = line(&valid);
        doubled.extend(line(&valid));
        assert!(decode_reply(&doubled, &Request::open(), Some(0)).is_err());
        let mut invalid = valid;
        invalid["observation"]["enemy"] = json!({"gas":1});
        assert!(decode_reply(&line(&invalid), &Request::open(), Some(0)).is_err());
    }

    #[test]
    fn failures_require_closed_errors_matching_id_and_expected_exit() {
        let value = json!({"protocol":"arena-engine-v1","id":0,"ok":false,
            "error":{"code":"NATIVE_REJECTION","message":"refused"}});
        let error = decode_reply(&line(&value), &Request::open(), Some(2)).unwrap_err();
        assert!(error.contains("refused"));
        assert!(
            decode_reply(&line(&value), &Request::open(), Some(0))
                .unwrap_err()
                .contains("status")
        );
        for (key, replacement) in [
            ("code", json!("UNKNOWN")),
            ("extra", json!(true)),
            ("message", json!(null)),
        ] {
            let mut invalid = value.clone();
            invalid["error"][key] = replacement;
            assert!(serde_json::from_value::<Reply>(invalid).is_err());
        }
        let mut nullable = value;
        nullable["id"] = Value::Null;
        assert!(serde_json::from_value::<Reply>(nullable.clone()).is_ok());
        assert!(
            decode_reply(&line(&nullable), &Request::open(), Some(2))
                .unwrap_err()
                .contains("id")
        );
        nullable.as_object_mut().unwrap().remove("id");
        assert!(serde_json::from_value::<Reply>(nullable).is_err());
    }

    #[test]
    fn engine_result_allows_opaque_native_results_but_no_extra_report_fields() {
        let action = Action::classical(
            Square::try_from("e1".to_owned()).unwrap(),
            Square::try_from("f1".to_owned()).unwrap(),
        );
        let result = json!({"initialScfen":"initial","openScfen":"open","committedScfen":"committed","finalScfen":"final",
            "bankBefore":{"w":3,"b":3},"bankCommitted":{"w":3,"b":3},"bankAfter":{"w":4,"b":4},
            "requestedActions":{"w":[action],"b":[]},"rawBegin":{"opaque":[1,true]},"rawResolve":{"native":null}});
        let reply = json!({"protocol":"arena-engine-v1","id":0,"ok":true,"op":"settle","observation":fixture(),"result":result});
        let request = Request::settle(&action).unwrap();
        assert!(decode_reply(&line(&reply), &request, Some(0)).is_ok());
        let mut invalid = reply.clone();
        invalid["result"]["features"] = json!([]);
        assert!(decode_reply(&line(&invalid), &request, Some(0)).is_err());
        let mut invalid = reply;
        invalid["result"]["bankBefore"]["w"] = json!(13);
        assert!(decode_reply(&line(&invalid), &request, Some(0)).is_err());
    }
}
