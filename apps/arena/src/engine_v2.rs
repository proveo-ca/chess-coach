// SPEC: _spec/apps/arena/burn-compat.puml
#[cfg(test)]
use crate::record::CleanupStatus;
use crate::record::{
    BeginRecord, EngineContext, FixtureId, Outcome, Pair, PendingOperation, RejectionWitness,
    SettlementRecord, StateImage,
};
use crate::record::{object_enum, object_struct};
use crate::worker_transport::{DECISION, Endpoint, WorkerTransport};
#[cfg(test)]
use crate::worker_transport::{
    Envelope, REAP, REPLY_LIMIT, REQUEST_LIMIT, STDERR_LIMIT, SuccessEnvelope,
};
use serde::Deserialize;
use serde_json::{Value, json};
use std::collections::{BTreeMap, BTreeSet};
#[cfg(test)]
use std::path::Path;
#[cfg(test)]
use std::time::Duration;
use std::time::Instant;
use training_native::contracts::{Action, AuthorizedView, CursorPull, DomainStep, PlanningOracle};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Namespace {
    Session,
    Replay,
}

impl Namespace {
    fn method(self, suffix: &str) -> String {
        format!(
            "{}.{suffix}",
            match self {
                Self::Session => "session",
                Self::Replay => "replay",
            }
        )
    }
}

object_struct! {
#[serde(deny_unknown_fields)]
pub(crate) struct ErrorPacket {
    pub code: FailureCode,
    pub message: String,
    #[serde(deserialize_with = "nullable")]
    pub context: Option<EngineContext>,
    #[serde(deserialize_with = "nullable")]
    pub witness: Option<RejectionWitness>,
}
}

fn nullable<'de, D: serde::Deserializer<'de>, T: Deserialize<'de>>(
    d: D,
) -> Result<Option<T>, D::Error> {
    Option::deserialize(d)
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize, serde::Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE", try_from = "String")]
pub(crate) enum FailureCode {
    BadRequest,
    State,
    StaleContext,
    NativeRejection,
    EngineFailure,
    Limit,
}

impl TryFrom<String> for FailureCode {
    type Error = String;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        match value.as_str() {
            "BAD_REQUEST" => Ok(Self::BadRequest),
            "STATE" => Ok(Self::State),
            "STALE_CONTEXT" => Ok(Self::StaleContext),
            "NATIVE_REJECTION" => Ok(Self::NativeRejection),
            "ENGINE_FAILURE" => Ok(Self::EngineFailure),
            "LIMIT" => Ok(Self::Limit),
            _ => Err(format!("Invalid FailureCode: {value}")),
        }
    }
}

#[derive(Clone, Debug)]
pub(crate) struct EngineError {
    pub message: String,
    pub packet: Option<Box<ErrorPacket>>,
    pub pending: PendingOperation,
}

impl std::fmt::Display for EngineError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{} id={:?} context={:?}: {}",
            self.pending.method, self.pending.id, self.pending.context, self.message
        )
    }
}

impl std::error::Error for EngineError {}

object_enum! {
#[serde(tag = "kind", rename_all = "lowercase", deny_unknown_fields)]
pub(crate) enum StartReply {
    Started {
        session: u32,
        fixture: FixtureId,
        initial: StateImage,
        #[serde(deserialize_with = "nullable")]
        outcome: Option<Outcome>,
    },
}
}

object_enum! {
#[serde(tag = "kind", rename_all = "lowercase", deny_unknown_fields)]
pub(crate) enum OpenReply {
    Planning {
        context: EngineContext,
        views: Pair<AuthorizedView>,
    },
    Terminal {
        session: u32,
        outcome: Outcome,
        image: StateImage,
        #[serde(deserialize_with = "nullable")]
        begin: Option<BeginRecord>,
    },
}
}

object_enum! {
#[serde(tag = "kind", rename_all = "lowercase", deny_unknown_fields)]
pub(crate) enum CommitReply {
    Committed {
        context: EngineContext,
        begin: BeginRecord,
        settlement: SettlementRecord,
    },
}
}

object_enum! {
#[serde(tag = "kind", rename_all = "lowercase", deny_unknown_fields)]
pub(crate) enum CloseReply {
    Closed {
        session: u32,
        #[serde(rename = "pendingBegin", deserialize_with = "nullable")]
        pending_begin: Option<BeginRecord>,
        image: StateImage,
        #[serde(deserialize_with = "nullable")]
        outcome: Option<Outcome>,
    },
}
}

object_struct! {
#[serde(deny_unknown_fields)]
struct PlanningOpen {
    kind: String,
    planning: u32,
}
}
object_struct! {
#[serde(deny_unknown_fields)]
struct PlanningNext {
    kind: String,
    planning: u32,
    steps: Vec<DomainStep>,
}
}
object_struct! {
#[serde(deny_unknown_fields)]
struct PlanningClose {
    kind: String,
    planning: u32,
}
}

#[derive(Default)]
struct PlanningState {
    created: usize,
    live: BTreeSet<u32>,
    seen: BTreeSet<u32>,
    deadline: Option<Instant>,
}

pub(crate) struct EngineClient {
    transport: WorkerTransport,
    planning: BTreeMap<u32, PlanningState>,
}

impl std::ops::Deref for EngineClient {
    type Target = WorkerTransport;
    fn deref(&self) -> &Self::Target {
        &self.transport
    }
}
impl std::ops::DerefMut for EngineClient {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.transport
    }
}

impl EngineClient {
    pub(crate) fn new() -> Result<Self, String> {
        Ok(Self {
            transport: WorkerTransport::new(Endpoint::EngineV2)?,
            planning: BTreeMap::new(),
        })
    }

    #[cfg(test)]
    fn spawn(script: &Path, total: Duration) -> Result<Self, String> {
        Ok(Self {
            transport: WorkerTransport::spawn_test(Endpoint::EngineV2, script, total)?,
            planning: BTreeMap::new(),
        })
    }

    pub(crate) fn start(
        &mut self,
        ns: Namespace,
        fixture: FixtureId,
    ) -> Result<StartReply, EngineError> {
        self.call(
            &ns.method("start"),
            json!({"fixture":fixture}),
            None,
            self.work_deadline,
        )
    }

    pub(crate) fn open(
        &mut self,
        ns: Namespace,
        session: u32,
        ordinal: u32,
    ) -> Result<OpenReply, EngineError> {
        self.call(
            &ns.method("open"),
            json!({"session":session,"planningOrdinal":ordinal}),
            None,
            self.work_deadline,
        )
    }

    pub(crate) fn commit(
        &mut self,
        ns: Namespace,
        context: &EngineContext,
        requests: &Pair<Vec<Action>>,
    ) -> Result<CommitReply, EngineError> {
        self.call(
            &ns.method("commit"),
            json!({"context":context,"requests":requests}),
            Some(context.clone()),
            self.work_deadline,
        )
    }

    pub(crate) fn close(&mut self, ns: Namespace, session: u32) -> Result<CloseReply, EngineError> {
        self.call(
            &ns.method("close"),
            json!({"session":session}),
            None,
            self.work_deadline,
        )
    }

    pub(crate) fn oracle(&mut self) -> EngineOracle<'_> {
        let deadline = (Instant::now() + DECISION).min(self.work_deadline);
        EngineOracle {
            client: self,
            deadline,
        }
    }

    fn call<T: for<'de> Deserialize<'de>>(
        &mut self,
        method: &str,
        fields: Value,
        context: Option<EngineContext>,
        deadline: Instant,
    ) -> Result<T, EngineError> {
        self.transport.call(method, fields, context, deadline)
    }

    pub(crate) fn close_planning(&mut self) -> Result<(), String> {
        let ids: Vec<_> = self.planning.keys().copied().collect();
        for id in ids {
            self.oracle().close(id)?;
        }
        Ok(())
    }

    pub(crate) fn finish(&mut self) -> Result<(), String> {
        if !self.planning.is_empty() {
            return Err("Cannot finish with live planning contexts".into());
        }
        self.transport.finish()
    }
}

pub(crate) struct EngineOracle<'a> {
    client: &'a mut EngineClient,
    deadline: Instant,
}

impl EngineOracle<'_> {
    pub(crate) fn deadline(&self) -> Instant {
        self.deadline
    }
}

impl PlanningOracle for EngineOracle<'_> {
    fn open(&mut self, view: &AuthorizedView) -> Result<u32, String> {
        view.validate()?;
        if self.client.planning.len() >= 2 {
            return Err("At most two planning contexts may be live".into());
        }
        let reply: PlanningOpen = self
            .client
            .call("plan.open", json!({"view":view}), None, self.deadline)
            .map_err(|e| e.to_string())?;
        if reply.kind != "planning-opened"
            || reply.planning == 0
            || self.client.planning.contains_key(&reply.planning)
        {
            self.client.poisoned = true;
            return Err("Invalid or repeated planning identity".into());
        }
        self.client.planning.insert(
            reply.planning,
            PlanningState {
                deadline: Some(self.deadline),
                ..PlanningState::default()
            },
        );
        Ok(reply.planning)
    }

    fn next(&mut self, planning: u32, pulls: &[CursorPull]) -> Result<Vec<DomainStep>, String> {
        if pulls.is_empty() || pulls.len() > 8 {
            return Err("plan.next requires 1..8 pulls".into());
        }
        let state = self
            .client
            .planning
            .get(&planning)
            .ok_or("Unknown planning context")?;
        let deadline = state.deadline.unwrap_or(self.deadline).min(self.deadline);
        let mut resumed = BTreeSet::new();
        let starts = pulls
            .iter()
            .filter(|pull| matches!(pull, CursorPull::Start { .. }))
            .count();
        if state.created + starts > 2063 {
            return Err("Planning cursor creation limit exceeded".into());
        }
        for pull in pulls {
            if let CursorPull::Resume { cursor } = pull
                && (!state.live.contains(cursor) || !resumed.insert(*cursor))
            {
                return Err("Unknown or repeated resumed cursor".into());
            }
        }
        let reply: PlanningNext = self
            .client
            .call(
                "plan.next",
                json!({"planning":planning,"pulls":pulls}),
                None,
                deadline,
            )
            .map_err(|e| e.to_string())?;
        if reply.kind != "planned" || reply.planning != planning || reply.steps.len() != pulls.len()
        {
            self.client.poisoned = true;
            return Err("Planning response order/count/identity mismatch".into());
        }
        let state = self
            .client
            .planning
            .get_mut(&planning)
            .ok_or("Planning context disappeared")?;
        let mut ids = BTreeSet::new();
        for (pull, step) in pulls.iter().zip(&reply.steps) {
            let valid = step.cursor > 0
                && ids.insert(step.cursor)
                && match pull {
                    CursorPull::Start { .. } => !state.seen.contains(&step.cursor),
                    CursorPull::Resume { cursor } => *cursor == step.cursor,
                };
            if !valid {
                self.client.poisoned = true;
                return Err("Planning cursor response correlation mismatch".into());
            }
            if matches!(pull, CursorPull::Start { .. }) {
                state.created += 1;
                state.seen.insert(step.cursor);
            }
            if step.proposal.is_some() {
                state.live.insert(step.cursor);
            } else {
                state.live.remove(&step.cursor);
            }
        }
        Ok(reply.steps)
    }

    fn close(&mut self, planning: u32) -> Result<(), String> {
        if !self.client.planning.contains_key(&planning) {
            return Err("Unknown planning context".into());
        }
        let deadline = self.client.planning[&planning]
            .deadline
            .unwrap_or(self.deadline)
            .min(self.deadline);
        let reply: PlanningClose = self
            .client
            .call("plan.close", json!({"planning":planning}), None, deadline)
            .map_err(|e| e.to_string())?;
        if reply.kind != "planning-closed" || reply.planning != planning {
            self.client.poisoned = true;
            return Err("Planning close identity mismatch".into());
        }
        self.client.planning.remove(&planning);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn n2_rpc_failure_codes_reject_unit_map_aliases() {
        for code in [
            "BAD_REQUEST",
            "STATE",
            "STALE_CONTEXT",
            "NATIVE_REJECTION",
            "ENGINE_FAILURE",
            "LIMIT",
        ] {
            assert!(serde_json::from_value::<FailureCode>(json!(code)).is_ok());
            assert!(
                serde_json::from_value::<FailureCode>(json!({code:null})).is_err(),
                "Accepted RPC code map alias: {code}"
            );
        }
        assert!(
            serde_json::from_value::<SuccessEnvelope>(
                json!({"protocol":{"arena-engine-v2":null},"id":1,"ok":true,"result":{}})
            )
            .is_err()
        );
    }

    #[test]
    fn n3_rpc_objects_reject_positional_encodings() {
        assert!(serde_json::from_value::<PlanningOpen>(json!(["planning-opened", 1])).is_err());
        assert!(serde_json::from_value::<PlanningNext>(json!(["planned", 1, []])).is_err());
        assert!(serde_json::from_value::<PlanningClose>(json!(["planning-closed", 1])).is_err());
        assert!(
            serde_json::from_value::<ErrorPacket>(json!(["STATE", "error", null, null])).is_err()
        );
        assert!(
            serde_json::from_value::<Envelope>(json!(["arena-engine-v2", 1, true, {}])).is_err()
        );
    }

    #[test]
    fn n3_tagged_session_replies_require_objects() {
        let image = json!({"scfen":"SCFEN","bank":{"w":1,"b":2}});
        assert!(
            serde_json::from_value::<StartReply>(json!(["started", 1, "tiny-v1", image, null]))
                .is_err()
        );
        assert!(
            serde_json::from_value::<OpenReply>(
                json!(["planning",{"session":1,"planningOrdinal":0,"turn":0},{"w":{},"b":{}}])
            )
            .is_err()
        );
        assert!(
            serde_json::from_value::<CloseReply>(json!(["closed", 1, null, image, null])).is_err()
        );
    }

    fn fixture(source: &str) -> tempfile::NamedTempFile {
        let mut file = tempfile::Builder::new()
            .prefix("arena-v2-transport-")
            .suffix(".mjs")
            .tempfile()
            .unwrap();
        file.write_all(source.as_bytes()).unwrap();
        file.flush().unwrap();
        file
    }

    fn call(client: &mut EngineClient, fields: Value) -> Result<Value, EngineError> {
        client.call("test.echo", fields, None, client.work_deadline)
    }

    fn echo_source(body: &str) -> String {
        format!(
            "import {{createInterface}} from 'node:readline';\nconst lines=createInterface({{input:process.stdin}});\nfor await(const line of lines){{ const r=JSON.parse(line); {body} }}"
        )
    }

    #[test]
    fn persistent_transport_returns_on_each_line_without_eof_and_uses_increasing_ids() {
        let file = fixture(&echo_source(
            "process.stdout.write(JSON.stringify({protocol:r.protocol,id:r.id,ok:true,result:{id:r.id,op:r.op,value:r.value,env:Object.keys(process.env)}})+'\\n');",
        ));
        let mut client = EngineClient::spawn(file.path(), Duration::from_secs(10)).unwrap();
        for id in 1..=4 {
            let reply = call(&mut client, json!({"value":id})).unwrap();
            assert_eq!(reply["id"], id);
            assert_eq!(reply["op"], "test.echo");
            assert_eq!(reply["value"], id);
            assert_eq!(reply["env"], json!(["PATH"]));
        }
        client.finish().unwrap();
        assert_eq!(client.cleanup(), CleanupStatus::Exited { success: true });
    }

    #[test]
    fn fatal_frames_reject_wrong_ids_extra_lines_utf8_eof_and_oversized_partial_frames() {
        let variants = [
            "process.stdout.write(JSON.stringify({protocol:r.protocol,id:r.id+1,ok:true,result:{}})+'\\n');",
            "process.stdout.write(JSON.stringify({protocol:r.protocol,id:r.id,ok:true,result:{}})+'\\n{}\\n');",
            "process.stdout.write(JSON.stringify({protocol:r.protocol,id:r.id,ok:true,result:{}})+'\\npartial');",
            "process.stdout.write(Buffer.from([0xff,10]));",
            "process.stdout.write('{');process.exit(0);",
            "process.stdout.write(Buffer.alloc(1048577,120));",
            "process.exit(0);",
            "process.stdout.write(JSON.stringify({protocol:r.protocol,id:r.id,ok:false,result:{}})+'\\n');",
            "process.stdout.write(JSON.stringify({protocol:'wrong-protocol',id:r.id,ok:true,result:{}})+'\\n');",
        ];
        for body in variants {
            let file = fixture(&echo_source(body));
            let mut client = EngineClient::spawn(file.path(), Duration::from_secs(10)).unwrap();
            let error = call(&mut client, json!({})).unwrap_err();
            assert_eq!(error.pending.method, "test.echo");
            assert_eq!(error.pending.id, Some(1));
            assert!(client.is_poisoned(), "{body}");
            assert_eq!(client.cleanup(), CleanupStatus::Reaped);
        }
    }

    #[test]
    fn transport_drains_stderr_during_large_request_and_streamed_reply() {
        let source = format!(
            "import {{writeSync}} from 'node:fs'; writeSync(2,Buffer.alloc(60000,120));\n{}",
            echo_source(
                "const reply=JSON.stringify({protocol:r.protocol,id:r.id,ok:true,result:{size:r.value.length,padding:'x'.repeat(700000)}})+'\\n';for(let i=0;i<reply.length;i+=4000)process.stdout.write(reply.slice(i,i+4000));"
            )
        );
        let file = fixture(&source);
        let mut client = EngineClient::spawn(file.path(), Duration::from_secs(10)).unwrap();
        let reply = call(&mut client, json!({"value":"q".repeat(60000)})).unwrap();
        assert_eq!(reply["size"], 60000);
        assert_eq!(reply["padding"].as_str().unwrap().len(), 700000);
        assert_eq!(client.stderr_bytes.len(), 60000);
        client.finish().unwrap();
    }

    #[test]
    fn request_limit_and_cumulative_stderr_limit_fail_closed() {
        let file = fixture(&echo_source(
            "process.stdout.write(JSON.stringify({protocol:r.protocol,id:r.id,ok:true,result:{}})+'\\n');",
        ));
        let mut client = EngineClient::spawn(file.path(), Duration::from_secs(10)).unwrap();
        assert!(
            call(&mut client, json!({"value":"x".repeat(65536)}))
                .unwrap_err()
                .message
                .contains("64 KiB")
        );
        client.cleanup();
        let source = format!(
            "import {{writeSync}} from 'node:fs';\n{}",
            echo_source(
                "writeSync(2,Buffer.alloc(40000,120));process.stdout.write(JSON.stringify({protocol:r.protocol,id:r.id,ok:true,result:{}})+'\\n');"
            )
        );
        let file = fixture(&source);
        let mut client = EngineClient::spawn(file.path(), Duration::from_secs(10)).unwrap();
        call(&mut client, json!({})).unwrap();
        assert!(
            call(&mut client, json!({}))
                .unwrap_err()
                .message
                .contains("stderr")
        );
        client.cleanup();
    }

    #[test]
    fn an_absolute_shared_deadline_is_not_renewed_on_the_next_rpc() {
        let file = fixture(&echo_source(
            "await new Promise(resolve=>setTimeout(resolve,60));process.stdout.write(JSON.stringify({protocol:r.protocol,id:r.id,ok:true,result:{}})+'\\n');",
        ));
        let mut client = EngineClient::spawn(file.path(), Duration::from_secs(10)).unwrap();
        call(&mut client, json!({})).unwrap();
        let deadline = Instant::now() + Duration::from_millis(100);
        client
            .call::<Value>("test.echo", json!({}), None, deadline)
            .unwrap();
        let error = client
            .call::<Value>("test.echo", json!({}), None, deadline)
            .unwrap_err();
        assert!(error.message.contains("deadline"));
        client.cleanup();
    }

    #[test]
    fn eof_shutdown_and_abandoned_child_cleanup_are_bounded_and_reaped() {
        let file = fixture(&echo_source(
            "process.stdout.write(JSON.stringify({protocol:r.protocol,id:r.id,ok:true,result:{}})+'\\n');",
        ));
        let mut client = EngineClient::spawn(file.path(), Duration::from_secs(10)).unwrap();
        let pid = client.child.id();
        call(&mut client, json!({})).unwrap();
        let started = Instant::now();
        drop(client);
        assert!(started.elapsed() < Duration::from_secs(3));
        assert!(!Path::new("/proc").join(pid.to_string()).exists());
    }

    #[test]
    fn planning_response_correlation_rejects_zero_start_and_mismatched_resume_ids() {
        for (pull, step, live) in [
            (
                CursorPull::Start {
                    prefix: Vec::new(),
                    family: None,
                },
                json!({"cursor":0,"proposal":null}),
                None,
            ),
            (
                CursorPull::Resume { cursor: 1 },
                json!({"cursor":2,"proposal":null}),
                Some(1),
            ),
        ] {
            let body = format!(
                "process.stdout.write(JSON.stringify({{protocol:r.protocol,id:r.id,ok:true,result:{{kind:'planned',planning:1,steps:[{step}]}}}})+'\\n');"
            );
            let file = fixture(&echo_source(&body));
            let mut client = EngineClient::spawn(file.path(), Duration::from_secs(10)).unwrap();
            let mut state = PlanningState::default();
            if let Some(cursor) = live {
                state.live.insert(cursor);
                state.seen.insert(cursor);
            }
            client.planning.insert(1, state);
            assert!(client.oracle().next(1, &[pull]).is_err());
            assert!(client.is_poisoned());
            client.cleanup();
        }
    }
}

#[cfg(test)]
mod lifecycle_tests {
    use super::*;
    use std::io::Write;

    fn script(source: &str) -> tempfile::NamedTempFile {
        let mut file = tempfile::Builder::new()
            .prefix("arena-v2-transport-")
            .suffix(".mjs")
            .tempfile()
            .unwrap();
        file.write_all(source.as_bytes()).unwrap();
        file.flush().unwrap();
        file
    }

    fn fixture(source: &str) -> (tempfile::NamedTempFile, EngineClient) {
        let file = script(source);
        let client = EngineClient::spawn(file.path(), Duration::from_secs(8)).unwrap();
        (file, client)
    }

    fn call(client: &mut EngineClient) -> Result<Value, EngineError> {
        client.call("test.echo", json!({}), None, client.work_deadline)
    }

    #[test]
    fn persistent_transport_returns_one_reply_without_request_eof_and_keeps_ids_increasing() {
        let (_file, mut client) = fixture(
            r#"
            import {createInterface} from 'node:readline';
            for await (const line of createInterface({input:process.stdin})) {
                const r=JSON.parse(line);
                process.stdout.write(JSON.stringify({protocol:r.protocol,id:r.id,ok:true,result:{id:r.id,method:r.op,keys:Object.keys(process.env).sort(),cwd:process.cwd()}})+'\n');
            }
        "#,
        );
        for id in 1..=3 {
            let reply = call(&mut client).unwrap();
            assert_eq!(reply["id"], id);
            assert_eq!(reply["method"], "test.echo");
            assert_eq!(reply["keys"], json!(["PATH"]));
            assert_eq!(reply["cwd"], env!("CARGO_MANIFEST_DIR"));
        }
        client.finish().unwrap();
        assert!(client.finished);
    }

    #[test]
    fn malformed_extra_wrong_id_utf8_partial_and_eof_frames_fail_closed() {
        for source in [
            r#"process.stdin.once('data',()=>process.stdout.write('{"protocol":"arena-engine-v2","id":2,"ok":true,"result":{}}\n'));"#,
            r#"process.stdin.once('data',()=>process.stdout.write('{"protocol":"arena-engine-v2","id":1,"ok":true,"result":{}}\n{}\n'));"#,
            r#"process.stdin.once('data',()=>process.stdout.write('{"protocol":"arena-engine-v2","id":1,"ok":true,"result":{}}\npartial'));"#,
            r#"process.stdin.once('data',()=>process.stdout.write(Buffer.from([255,10])));"#,
            r#"process.stdin.once('data',()=>{process.stdout.write('partial');process.stdin.destroy();});"#,
            r#"process.stdin.once('data',()=>process.stdin.destroy());"#,
            r#"process.stdin.once('data',()=>process.stdout.write('{"protocol":"wrong","id":1,"ok":true,"result":{}}\n'));"#,
            r#"process.stdin.once('data',()=>process.stdout.write('{"protocol":"arena-engine-v2","id":1,"ok":false,"result":{}}\n'));"#,
        ] {
            let (_file, mut client) = fixture(source);
            let error = call(&mut client).unwrap_err();
            assert!(client.is_poisoned(), "{source}");
            assert_eq!(error.pending.method, "test.echo");
            assert_eq!(error.pending.id, Some(1));
            assert!(call(&mut client).is_err());
        }
    }

    #[test]
    fn rolling_reply_request_and_cumulative_stderr_caps_are_enforced() {
        for descriptor in [1, 2] {
            let size = if descriptor == 1 {
                REPLY_LIMIT + 1
            } else {
                STDERR_LIMIT + 1
            };
            let stream = if descriptor == 1 { "stdout" } else { "stderr" };
            let source = format!(
                "process.stdin.once('data',()=>process.{stream}.write(Buffer.alloc({size},120)));"
            );
            let (_file, mut client) = fixture(&source);
            let error = call(&mut client).unwrap_err();
            assert!(error.message.contains("limit exceeded"), "{error}");
        }
        let (_file, mut client) = fixture("process.stdin.resume();");
        let error = client
            .call::<Value>(
                "test.large",
                json!({"payload":"x".repeat(REQUEST_LIMIT)}),
                None,
                client.work_deadline,
            )
            .unwrap_err();
        assert!(error.message.contains("64 KiB"));
        let (_file, mut client) = fixture(
            r#"
            import {createInterface} from 'node:readline';import {writeSync} from 'node:fs';
            for await(const line of createInterface({input:process.stdin})){
                const r=JSON.parse(line);writeSync(2,Buffer.alloc(40000,120));
                process.stdout.write(JSON.stringify({protocol:r.protocol,id:r.id,ok:true,result:{}})+'\n');
            }
        "#,
        );
        call(&mut client).unwrap();
        assert!(
            call(&mut client)
                .unwrap_err()
                .message
                .contains("cumulative stderr")
        );
    }

    #[test]
    fn nonblocking_transport_drains_stderr_during_large_request_and_partial_reply() {
        let (_file, mut client) = fixture(
            r#"
            import {createInterface} from 'node:readline';import {writeSync} from 'node:fs';
            writeSync(2,Buffer.alloc(60000,120));
            for await(const line of createInterface({input:process.stdin})){
                const r=JSON.parse(line);const reply=JSON.stringify({protocol:r.protocol,id:r.id,ok:true,result:{size:r.payload.length,text:'z'.repeat(700000)}})+'\n';
                for(let i=0;i<reply.length;i+=4096)process.stdout.write(reply.slice(i,i+4096));
            }
        "#,
        );
        let reply: Value = client
            .call(
                "test.large",
                json!({"payload":"x".repeat(60000)}),
                None,
                client.work_deadline,
            )
            .unwrap();
        assert_eq!(reply["size"], 60000);
        assert_eq!(reply["text"].as_str().unwrap().len(), 700000);
        assert_eq!(client.stderr_bytes.len(), 60000);
        client.finish().unwrap();
    }

    #[test]
    fn absolute_deadlines_do_not_renew_between_calls_and_drop_reaps_direct_child() {
        let (_file, mut client) = fixture(
            r#"
            import {createInterface} from 'node:readline';
            for await(const line of createInterface({input:process.stdin})){
                const r=JSON.parse(line);if(r.op==='test.slow')await new Promise(resolve=>setTimeout(resolve,150));
                process.stdout.write(JSON.stringify({protocol:r.protocol,id:r.id,ok:true,result:{}})+'\n');
            }
        "#,
        );
        call(&mut client).unwrap();
        let deadline = Instant::now() + Duration::from_millis(240);
        client
            .call::<Value>("test.slow", json!({}), None, deadline)
            .unwrap();
        let error = client
            .call::<Value>("test.slow", json!({}), None, deadline)
            .unwrap_err();
        assert!(error.message.contains("absolute deadline"));
        let pid = client.child.id();
        let started = Instant::now();
        drop(client);
        assert!(started.elapsed() < REAP);
        assert!(!Path::new("/proc").join(pid.to_string()).exists());
    }

    #[test]
    fn request_id_overflow_and_unclean_nonzero_eof_fail_closed() {
        let (_file, mut client) = fixture("process.stdin.resume();");
        client.next_id = u32::MAX;
        assert!(
            call(&mut client)
                .unwrap_err()
                .message
                .contains("ID exhausted")
        );
        let (_file, mut client) = fixture(
            r#"
            import {createInterface} from 'node:readline';
            for await(const line of createInterface({input:process.stdin})){
                const r=JSON.parse(line);process.stdout.write(JSON.stringify({protocol:r.protocol,id:r.id,ok:true,result:{}})+'\n');
            }process.exitCode=1;
        "#,
        );
        call(&mut client).unwrap();
        assert!(client.finish().unwrap_err().contains("exited with"));
    }
}
