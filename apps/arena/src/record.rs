// SPEC: _spec/apps/arena/burn-compat.puml
use serde::de::{MapAccess, Visitor, value::MapAccessDeserializer};
use serde::{Deserialize, Deserializer, Serialize};
use serde_json::Value;
use std::marker::PhantomData;
use training_native::contracts::{Action, AuthorizedView, Candidate, CandidateDiagnostics, Side};
pub use training_native::policy::BaselinePolicy;

pub const MAX_WINDOWS: u32 = 45;
pub const MAX_RECORD_BYTES: usize = 16 * 1024 * 1024;
pub const SEED_VERSION: &str = "arena-policy-seeds-v1";

fn nullable<'de, D: serde::Deserializer<'de>, T: Deserialize<'de>>(
    deserializer: D,
) -> Result<Option<T>, D::Error> {
    Option::deserialize(deserializer)
}

macro_rules! wire_enum {
    ($name:ident { $($variant:ident => $wire:literal),+ $(,)? }) => {
        #[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
        #[serde(try_from = "String")]
        pub enum $name { $(#[serde(rename = $wire)] $variant),+ }

        impl TryFrom<String> for $name {
            type Error = String;

            fn try_from(value: String) -> Result<Self, Self::Error> {
                match value.as_str() {
                    $($wire => Ok(Self::$variant),)+
                    _ => Err(format!("Invalid {}: {value}", stringify!($name))),
                }
            }
        }
    };
}

pub(crate) fn deserialize_object<'de, D, T>(deserializer: D) -> Result<T, D::Error>
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

macro_rules! object_struct {
    ($(#[$meta:meta])* $vis:vis struct $name:ident {
        $($(#[$field_meta:meta])* $field_vis:vis $field:ident: $ty:ty),* $(,)?
    }) => {
        #[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
        $(#[$meta])*
        $vis struct $name {
            $($(#[$field_meta])* $field_vis $field: $ty),*
        }

        impl<'de> serde::Deserialize<'de> for $name {
            fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
                #[derive(serde::Deserialize)]
                $(#[$meta])*
                struct Wire { $($(#[$field_meta])* $field: $ty),* }

                let Wire { $($field),* } = $crate::record::deserialize_object(deserializer)?;
                Ok(Self { $($field),* })
            }
        }
    };
}
pub(crate) use object_struct;

macro_rules! object_enum {
    ($(#[$meta:meta])* $vis:vis enum $name:ident {
        $($variant:ident $( {
            $($(#[$field_meta:meta])* $field:ident: $ty:ty),* $(,)?
        } )?),* $(,)?
    }) => {
        #[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
        $(#[$meta])*
        $vis enum $name {
            $($variant $( { $($(#[$field_meta])* $field: $ty),* } )?),*
        }

        impl<'de> serde::Deserialize<'de> for $name {
            fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
                #[derive(serde::Deserialize)]
                $(#[$meta])*
                enum Wire {
                    $($variant $( { $($(#[$field_meta])* $field: $ty),* } )?),*
                }

                let wire = $crate::record::deserialize_object(deserializer)?;
                Ok(match wire {
                    $(Wire::$variant $( { $($field),* } )? => Self::$variant $( { $($field),* } )?),*
                })
            }
        }
    };
}
pub(crate) use object_enum;

wire_enum!(FixtureId { TinyV1 => "tiny-v1", StandardV1 => "standard-v1", AllActorsV1 => "all-actors-v1" });
wire_enum!(MatchVersion { V1 => "arena-match-v1" });
wire_enum!(RunVersion { V1 => "arena-run-v1" });
wire_enum!(Assurance { NonAdmitted => "NON_ADMITTED" });
wire_enum!(SeedVersion { V1 => "arena-policy-seeds-v1" });

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Pair<T> {
    pub w: T,
    pub b: T,
}

impl<'de, T: Deserialize<'de>> Deserialize<'de> for Pair<T> {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct PairVisitor<T>(PhantomData<T>);

        impl<'de, T: Deserialize<'de>> Visitor<'de> for PairVisitor<T> {
            type Value = Pair<T>;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("an object with required w and b fields")
            }

            fn visit_map<M: MapAccess<'de>>(self, mut map: M) -> Result<Self::Value, M::Error> {
                let mut w = None;
                let mut b = None;
                while let Some(field) = map.next_key::<String>()? {
                    match field.as_str() {
                        "w" => {
                            if w.is_some() {
                                return Err(serde::de::Error::duplicate_field("w"));
                            }
                            w = Some(map.next_value()?);
                        }
                        "b" => {
                            if b.is_some() {
                                return Err(serde::de::Error::duplicate_field("b"));
                            }
                            b = Some(map.next_value()?);
                        }
                        _ => return Err(serde::de::Error::unknown_field(&field, &["w", "b"])),
                    }
                }
                Ok(Pair {
                    w: w.ok_or_else(|| serde::de::Error::missing_field("w"))?,
                    b: b.ok_or_else(|| serde::de::Error::missing_field("b"))?,
                })
            }
        }

        deserializer.deserialize_map(PairVisitor(PhantomData))
    }
}

impl<T> Pair<T> {
    pub fn get(&self, side: Side) -> &T {
        match side {
            Side::White => &self.w,
            Side::Black => &self.b,
        }
    }
}

pub type Bank = Pair<u32>;

object_struct! {
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MatchSpec {
    pub version: MatchVersion,
    pub case_id: String,
    pub fixture: FixtureId,
    pub players: Pair<BaselinePolicy>,
    pub environment_seed: u32,
    pub policy_seeds: Pair<u32>,
    pub max_windows: u32,
}
}

impl MatchSpec {
    pub fn validate(&self) -> Result<(), String> {
        if self.case_id.is_empty() || self.case_id.len() > 128 {
            return Err("caseId requires 1..128 UTF-8 bytes".into());
        }
        if !(1..=MAX_WINDOWS).contains(&self.max_windows) {
            return Err("maxWindows must be in 1..45".into());
        }
        Ok(())
    }
}

pub fn decision_seed(base: u32, ordinal: u32, side: Side) -> u32 {
    base.wrapping_add(ordinal.wrapping_add(1).wrapping_mul(0x9e37_79b9))
        .wrapping_add(if side == Side::Black { 0x85eb_ca6b } else { 0 })
}

object_struct! {
#[serde(deny_unknown_fields)]
pub struct StateImage {
    pub scfen: String,
    pub bank: Bank,
}
}

object_struct! {
#[serde(deny_unknown_fields)]
pub struct Outcome {
    #[serde(deserialize_with = "nullable")]
    pub winner: Option<Side>,
    pub draw: bool,
}
}

impl Outcome {
    pub fn validate(&self) -> Result<(), String> {
        if self.draw != self.winner.is_none() {
            return Err("Native outcome must identify exactly a winner or a draw".into());
        }
        Ok(())
    }
}

object_struct! {
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct EngineContext {
    pub session: u32,
    pub planning_ordinal: u32,
    pub turn: u32,
}
}

object_struct! {
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BeginRecord {
    pub session: u32,
    pub planning_ordinal: u32,
    pub before: StateImage,
    pub after: StateImage,
    pub raw_begin: Value,
    #[serde(deserialize_with = "nullable")]
    pub outcome: Option<Outcome>,
}
}

object_struct! {
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SettlementRecord {
    pub context: EngineContext,
    pub requests: Pair<Vec<Action>>,
    pub before: StateImage,
    pub committed: StateImage,
    pub after: StateImage,
    pub grants: Bank,
    pub raw_resolve: Value,
    #[serde(deserialize_with = "nullable")]
    pub outcome: Option<Outcome>,
}
}

object_struct! {
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RejectionWitness {
    pub side: Side,
    #[serde(deserialize_with = "nullable")]
    pub action_index: Option<u32>,
    pub native_code: String,
    pub message: String,
    pub begin: BeginRecord,
    pub requests: Pair<Vec<Action>>,
    pub image: StateImage,
    #[serde(deserialize_with = "nullable")]
    pub outcome: Option<Outcome>,
}
}

object_struct! {
#[serde(deny_unknown_fields)]
pub struct Decision {
    pub policy: BaselinePolicy,
    pub seed: u32,
    #[serde(deserialize_with = "nullable")]
    pub generation: Option<CandidateDiagnostics>,
    pub selected: Candidate,
}
}

object_struct! {
#[serde(deny_unknown_fields)]
pub struct WindowRecord {
    pub context: EngineContext,
    pub views: Pair<AuthorizedView>,
    pub decisions: Pair<Decision>,
    pub begin: BeginRecord,
    pub settlement: SettlementRecord,
}
}

object_struct! {
#[serde(deny_unknown_fields)]
pub struct FailedAttempt {
    pub context: EngineContext,
    pub views: Pair<AuthorizedView>,
    pub decisions: Pair<Decision>,
    pub witness: RejectionWitness,
}
}

object_struct! {
#[serde(deny_unknown_fields)]
pub struct AbortedPlanning {
    pub context: EngineContext,
    pub views: Pair<AuthorizedView>,
    pub decisions: Pair<Option<Decision>>,
}
}

object_struct! {
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PendingOperation {
    pub method: String,
    #[serde(deserialize_with = "nullable")]
    pub id: Option<u32>,
    #[serde(deserialize_with = "nullable")]
    pub context: Option<EngineContext>,
    pub status: PendingStatus,
}
}

wire_enum!(PendingStatus { Unverified => "unverified", MutationUnknown => "mutation-unknown" });

object_enum! {
#[serde(tag = "kind", rename_all = "kebab-case", deny_unknown_fields)]
pub enum RunStop {
    Terminal,
    WindowLimit,
    NativeRejection {
        message: String,
    },
    PlanningFailure {
        message: String,
    },
    BridgeFailure {
        message: String,
        pending: PendingOperation,
    },
}
}

object_enum! {
#[serde(tag = "kind", rename_all = "kebab-case", deny_unknown_fields)]
pub enum CleanupStatus {
    NotStarted,
    Exited { success: bool },
    Reaped,
    ReapFailed { message: String },
}
}

object_struct! {
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RunRecord {
    pub version: RunVersion,
    pub assurance: Assurance,
    pub learned: bool,
    #[serde(deserialize_with = "nullable")]
    pub model_artifact: Option<Value>,
    pub full_runner: bool,
    pub spec: MatchSpec,
    pub seed_version: SeedVersion,
    pub environment_seed_used: bool,
    #[serde(deserialize_with = "nullable")]
    pub initial: Option<StateImage>,
    pub windows: Vec<WindowRecord>,
    #[serde(deserialize_with = "nullable")]
    pub trailing_begin: Option<BeginRecord>,
    #[serde(deserialize_with = "nullable")]
    pub failed_attempt: Option<FailedAttempt>,
    #[serde(deserialize_with = "nullable")]
    pub aborted_planning: Option<AbortedPlanning>,
    #[serde(deserialize_with = "nullable")]
    pub final_image: Option<StateImage>,
    pub completed_windows: u32,
    #[serde(deserialize_with = "nullable")]
    pub outcome: Option<Outcome>,
    pub stop: RunStop,
    pub cleanup: CleanupStatus,
}
}

impl RunRecord {
    pub(crate) fn new(spec: MatchSpec) -> Self {
        Self {
            version: RunVersion::V1,
            assurance: Assurance::NonAdmitted,
            learned: false,
            model_artifact: None,
            full_runner: true,
            spec,
            seed_version: SeedVersion::V1,
            environment_seed_used: false,
            initial: None,
            windows: Vec::new(),
            trailing_begin: None,
            failed_attempt: None,
            aborted_planning: None,
            final_image: None,
            completed_windows: 0,
            outcome: None,
            stop: RunStop::PlanningFailure {
                message: "Run has not completed".into(),
            },
            cleanup: CleanupStatus::NotStarted,
        }
    }

    pub fn validate_bounds(&self) -> Result<(), String> {
        self.spec.validate()?;
        if self.learned
            || self.model_artifact.is_some()
            || !self.full_runner
            || self.environment_seed_used
        {
            return Err("Invalid non-admitted baseline report metadata".into());
        }
        if self.windows.len() > self.spec.max_windows as usize
            || self.completed_windows as usize != self.windows.len()
            || self.native_frames() > 128
        {
            return Err("Run window/frame bounds disagree".into());
        }
        for window in &self.windows {
            validate_decisions(&window.decisions)?;
            validate_requests(&window.settlement.requests)?;
        }
        if let Some(attempt) = &self.failed_attempt {
            validate_decisions(&attempt.decisions)?;
            validate_requests(&attempt.witness.requests)?;
        }
        if let Some(outcome) = &self.outcome {
            outcome.validate()?;
        }
        Ok(())
    }

    pub fn native_frames(&self) -> usize {
        usize::from(self.initial.is_some())
            + 2 * self.windows.len()
            + usize::from(self.trailing_begin.is_some())
            + usize::from(self.failed_attempt.is_some())
    }
}

fn validate_decisions(decisions: &Pair<Decision>) -> Result<(), String> {
    decisions.w.selected.validate(Side::White)?;
    decisions.b.selected.validate(Side::Black)
}

fn validate_requests(requests: &Pair<Vec<Action>>) -> Result<(), String> {
    if requests.w.len() > 4 || requests.b.len() > 4 {
        return Err("Native request exceeds four actions per seat".into());
    }
    for action in &requests.w {
        action.validate_for(Side::White)?;
    }
    for action in &requests.b {
        action.validate_for(Side::Black)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::de::DeserializeOwned;
    use serde_json::json;

    fn assert_string_only<T: DeserializeOwned + Serialize + std::fmt::Debug>(values: &[&str]) {
        for value in values {
            let canonical = json!(value);
            let parsed: T = serde_json::from_value(canonical.clone()).unwrap();
            assert_eq!(serde_json::to_value(parsed).unwrap(), canonical);
            for alias in [
                json!({*value:null}),
                json!([value]),
                Value::Null,
                json!(0),
                json!(true),
            ] {
                assert!(
                    serde_json::from_value::<T>(alias.clone()).is_err(),
                    "Accepted {} alias: {alias}",
                    std::any::type_name::<T>()
                );
            }
        }
    }

    #[test]
    fn n2_record_wire_enums_accept_only_canonical_strings() {
        assert_string_only::<FixtureId>(&["tiny-v1", "standard-v1", "all-actors-v1"]);
        assert_string_only::<MatchVersion>(&["arena-match-v1"]);
        assert_string_only::<RunVersion>(&["arena-run-v1"]);
        assert_string_only::<Assurance>(&["NON_ADMITTED"]);
        assert_string_only::<SeedVersion>(&["arena-policy-seeds-v1"]);
        assert_string_only::<PendingStatus>(&["unverified", "mutation-unknown"]);
        assert_string_only::<crate::schedule::ScheduleVersion>(&["arena-schedule-v1"]);
    }

    #[test]
    fn n3_pairs_require_closed_objects_and_support_borrowed_values() {
        assert!(serde_json::from_value::<Pair<u32>>(json!([1, 2])).is_err());
        for input in [
            r#"{}"#,
            r#"{"w":1}"#,
            r#"{"b":2}"#,
            r#"{"w":1,"b":2,"extra":3}"#,
            r#"{"w":1,"w":2,"b":3}"#,
            r#"{"w":1,"b":2,"b":3}"#,
        ] {
            assert!(
                serde_json::from_str::<Pair<u32>>(input).is_err(),
                "Accepted malformed pair: {input}"
            );
        }
        assert!(serde_json::from_str::<Pair<Option<u32>>>(r#"{"w":null}"#).is_err());
        let pair: Pair<Option<u32>> = serde_json::from_str(r#"{"w":null,"b":null}"#).unwrap();
        assert_eq!(pair, Pair { w: None, b: None });
        let input = String::from(r#"{"w":"white","b":"black"}"#);
        let pair: Pair<&str> = serde_json::from_str(&input).unwrap();
        assert_eq!(pair.w, "white");
        assert_eq!(pair.b, "black");
        assert_eq!(
            serde_json::to_value(pair).unwrap(),
            json!({"w":"white","b":"black"})
        );
    }

    #[test]
    fn n3_host_schema_objects_reject_positional_encodings() {
        assert!(serde_json::from_value::<StateImage>(json!(["SCFEN", {"w":1,"b":2}])).is_err());
        assert!(serde_json::from_value::<Outcome>(json!([null, true])).is_err());
        assert!(serde_json::from_value::<EngineContext>(json!([1, 0, 0])).is_err());
        let input = json!(["arena-match-v1","case","tiny-v1",{"w":"pass-v1","b":"pass-v1"},0,{"w":1,"b":2},1]);
        assert!(serde_json::from_value::<MatchSpec>(input).is_err());
        for value in [
            json!({"kind":"not-started"}),
            json!({"kind":"reaped"}),
            json!({"kind":"exited","success":true}),
        ] {
            let parsed: CleanupStatus = serde_json::from_value(value.clone()).unwrap();
            assert_eq!(serde_json::to_value(parsed).unwrap(), value);
        }
    }

    #[test]
    fn n3_tagged_stops_and_cleanup_require_objects_without_changing_wire_tags() {
        for input in [
            json!(["terminal"]),
            json!(["native-rejection", "error"]),
            json!("terminal"),
        ] {
            assert!(
                serde_json::from_value::<RunStop>(input.clone()).is_err(),
                "Accepted positional stop: {input}"
            );
        }
        for input in [
            json!(["not-started"]),
            json!(["exited", true]),
            json!("reaped"),
        ] {
            assert!(
                serde_json::from_value::<CleanupStatus>(input.clone()).is_err(),
                "Accepted positional cleanup: {input}"
            );
        }
        for value in [
            json!({"kind":"terminal"}),
            json!({"kind":"window-limit"}),
            json!({"kind":"native-rejection","message":"error"}),
        ] {
            assert_eq!(
                serde_json::to_value(serde_json::from_value::<RunStop>(value.clone()).unwrap())
                    .unwrap(),
                value
            );
        }
    }
}
