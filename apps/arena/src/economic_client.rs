// SPEC: _spec/apps/arena/burn-compat.puml
use crate::engine_v2::{CloseReply, EngineError};
use crate::record::{
    BeginRecord, EngineContext, FixtureId, Outcome, Pair, SettlementRecord, StateImage, object_enum,
};
use crate::worker_transport::{DECISION, Endpoint, WorkerTransport};
use serde::Deserialize;
use serde_json::json;
use std::time::Instant;
use training_native::contracts::{Action, AuthorizedView};
use training_native::ledger::LedgerWork;
use training_native::ledger::contracts::{EconomicBoundary, LedgerRules, Pair as LedgerPair};

pub(crate) type Boundaries = LedgerPair<EconomicBoundary>;

fn nullable<'de, D: serde::Deserializer<'de>, T: Deserialize<'de>>(
    d: D,
) -> Result<Option<T>, D::Error> {
    Option::deserialize(d)
}

object_enum! {
#[serde(tag = "kind", rename_all = "lowercase", deny_unknown_fields)]
pub(crate) enum StartReply {
    Started {
        session: u32,
        fixture: FixtureId,
        initial: StateImage,
        #[serde(deserialize_with = "nullable")]
        outcome: Option<Outcome>,
        rules: LedgerRules,
        boundaries: Boundaries,
    },
}
}

object_enum! {
#[serde(tag = "kind", rename_all = "lowercase", deny_unknown_fields)]
pub(crate) enum OpenReply {
    Planning {
        context: EngineContext,
        views: Box<Pair<AuthorizedView>>,
        begin: Box<BeginRecord>,
        boundaries: Box<Boundaries>,
    },
    Terminal {
        session: u32,
        outcome: Outcome,
        image: StateImage,
        #[serde(deserialize_with = "nullable")]
        begin: Option<Box<BeginRecord>>,
        #[serde(deserialize_with = "nullable")]
        boundaries: Option<Box<Boundaries>>,
    },
}
}

object_enum! {
#[serde(tag = "kind", rename_all = "lowercase", deny_unknown_fields)]
pub(crate) enum SettleReply {
    Committed {
        context: EngineContext,
        begin: BeginRecord,
        settlement: SettlementRecord,
        boundaries: Boundaries,
    },
}
}

pub(crate) struct Transaction {
    pub(crate) ordinal: u32,
    pub(crate) work: LedgerWork,
    pub(crate) deadline: Instant,
}

impl Transaction {
    pub(crate) fn new(ordinal: u32) -> Self {
        Self {
            ordinal,
            work: LedgerWork::new(),
            deadline: Instant::now() + DECISION,
        }
    }
    pub(crate) fn check(&self) -> Result<(), String> {
        if Instant::now() >= self.deadline {
            Err("Economic absolute transaction deadline exceeded".into())
        } else {
            Ok(())
        }
    }
}

pub(crate) struct EconomicClient {
    pub(crate) transport: WorkerTransport,
}

impl EconomicClient {
    pub(crate) fn new() -> Result<Self, String> {
        Ok(Self {
            transport: WorkerTransport::new(Endpoint::EconomicV1)?,
        })
    }
    pub(crate) fn start(
        &mut self,
        fixture: FixtureId,
        tx: &mut Transaction,
    ) -> Result<StartReply, EngineError> {
        self.transport.call_metered(
            "economic.start",
            json!({"fixture":fixture}),
            None,
            tx.deadline,
            &mut tx.work,
        )
    }
    pub(crate) fn open(&mut self, tx: &mut Transaction) -> Result<OpenReply, EngineError> {
        self.transport.call_metered(
            "economic.open",
            json!({"planningOrdinal":tx.ordinal}),
            None,
            tx.deadline,
            &mut tx.work,
        )
    }
    pub(crate) fn settle(
        &mut self,
        context: &EngineContext,
        requests: &Pair<Vec<Action>>,
        tx: &mut Transaction,
    ) -> Result<SettleReply, EngineError> {
        self.transport.call_metered(
            "economic.settle",
            json!({"context":context,"requests":requests}),
            Some(context.clone()),
            tx.deadline,
            &mut tx.work,
        )
    }
    pub(crate) fn close(&mut self, tx: &mut Transaction) -> Result<CloseReply, EngineError> {
        self.transport
            .call_metered("economic.close", json!({}), None, tx.deadline, &mut tx.work)
    }
    pub(crate) fn finish(&mut self, tx: &Transaction) -> Result<(), String> {
        self.transport.finish_by(tx.deadline)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::de::DeserializeOwned;
    use serde_json::Value;

    fn started() -> Value {
        let fixture: Value = serde_json::from_str(include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../packages/training/tests/fixtures/ledger-boundaries.json"
        )))
        .unwrap();
        json!({"kind":"started","session":1,"fixture":"standard-v1","initial":{"scfen":"native","bank":{"w":3,"b":3}},"outcome":null,
            "rules":fixture["rules"],"boundaries":{"w":fixture["boundaries"][0],"b":fixture["boundaries"][0]}})
    }

    fn assert_closed<T: DeserializeOwned>(canonical: Value) {
        assert!(serde_json::from_value::<T>(canonical.clone()).is_ok());
        let mut extra = canonical.clone();
        extra["unexpected"] = json!(true);
        assert!(serde_json::from_value::<T>(extra).is_err());
        let values = canonical
            .as_object()
            .unwrap()
            .values()
            .cloned()
            .collect::<Vec<_>>();
        assert!(serde_json::from_value::<T>(json!(values)).is_err());
        for key in canonical.as_object().unwrap().keys() {
            let mut missing = canonical.clone();
            missing.as_object_mut().unwrap().remove(key);
            assert!(
                serde_json::from_value::<T>(missing).is_err(),
                "Accepted missing {key}"
            );
        }
        let mut map_tag = canonical;
        let tag = map_tag["kind"].as_str().unwrap().to_owned();
        map_tag["kind"] = json!({tag:null});
        assert!(serde_json::from_value::<T>(map_tag).is_err());
    }

    #[test]
    fn economic_operation_replies_are_closed_objects_with_required_nullables() {
        assert_closed::<StartReply>(started());
        let begin = json!({"session":1,"planningOrdinal":0,"before":{"scfen":"native","bank":{"w":3,"b":3}},"after":{"scfen":"native","bank":{"w":3,"b":3}},"rawBegin":{},"outcome":null});
        let views = json!({"w":started()["boundaries"]["w"]["snapshot"],"b":started()["boundaries"]["b"]["snapshot"]});
        assert_closed::<OpenReply>(
            json!({"kind":"planning","context":{"session":1,"planningOrdinal":0,"turn":0},"views":views,"begin":begin,"boundaries":started()["boundaries"]}),
        );
        assert_closed::<OpenReply>(
            json!({"kind":"terminal","session":1,"outcome":{"winner":null,"draw":true},"image":{"scfen":"native","bank":{"w":3,"b":3}},"begin":null,"boundaries":null}),
        );
        let context = json!({"session":1,"planningOrdinal":0,"turn":0});
        let image = json!({"scfen":"native","bank":{"w":3,"b":3}});
        let settlement = json!({"context":context,"requests":{"w":[],"b":[]},"before":image,"committed":image,"after":image,"grants":{"w":1,"b":1},"rawResolve":{},"outcome":null});
        assert_closed::<SettleReply>(
            json!({"kind":"committed","context":context,"begin":begin,"settlement":settlement,"boundaries":started()["boundaries"]}),
        );
        assert_closed::<CloseReply>(
            json!({"kind":"closed","session":1,"pendingBegin":null,"image":image,"outcome":null}),
        );
    }

    #[test]
    fn economic_nested_shapes_reject_unknown_arrays_and_unit_map_aliases() {
        for (pointer, replacement) in [
            ("/fixture", json!({"standard-v1":null})),
            ("/rules/version", json!({"arena-economic-rules-v1":null})),
            ("/rules/unitCosts", json!([1, 3, 3, 5, 9, 1])),
            ("/boundaries", json!([])),
            ("/boundaries/w/snapshot/own", json!([])),
            ("/boundaries/w/phase", json!({"initial":null})),
        ] {
            let mut value = started();
            *value.pointer_mut(pointer).unwrap() = replacement;
            assert!(
                serde_json::from_value::<StartReply>(value).is_err(),
                "Accepted {pointer}"
            );
        }
    }
}
