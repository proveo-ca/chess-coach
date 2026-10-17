// SPEC: _spec/apps/arena/burn-compat.puml
use crate::bridge::{channel, kill_and_reap, node_from_path};
use crate::engine_v2::{EngineError, ErrorPacket};
use crate::record::{CleanupStatus, EngineContext, PendingOperation, PendingStatus, object_struct};
use serde::Deserialize;
use serde::de::{DeserializeSeed, MapAccess, SeqAccess, Visitor};
use serde_json::{Value, json};
use std::collections::BTreeSet;
use std::io::{self, Read, Write};
use std::net::Shutdown;
use std::os::unix::net::UnixStream;
use std::path::Path;
use std::process::{Child, Command};
use std::time::{Duration, Instant};
use training_native::ledger::LedgerWork;

pub(crate) const REQUEST_LIMIT: usize = 64 * 1024;
pub(crate) const REPLY_LIMIT: usize = 1024 * 1024;
pub(crate) const STDERR_LIMIT: usize = 64 * 1024;
pub(crate) const TOTAL: Duration = Duration::from_secs(300);
pub(crate) const REAP: Duration = Duration::from_secs(3);
pub(crate) const DECISION: Duration = Duration::from_secs(10);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Endpoint {
    EngineV2,
    EconomicV1,
}

impl Endpoint {
    fn protocol(self) -> &'static str {
        match self {
            Self::EngineV2 => "arena-engine-v2",
            Self::EconomicV1 => "arena-economic-v1",
        }
    }
    fn worker(self) -> &'static Path {
        Path::new(match self {
            Self::EngineV2 => concat!(env!("CARGO_MANIFEST_DIR"), "/engine/worker-v2.ts"),
            Self::EconomicV1 => concat!(env!("CARGO_MANIFEST_DIR"), "/engine/worker-economic.ts"),
        })
    }
}

fn nullable<'de, D: serde::Deserializer<'de>, T: Deserialize<'de>>(
    d: D,
) -> Result<Option<T>, D::Error> {
    Option::deserialize(d)
}

#[derive(Deserialize)]
#[serde(untagged)]
pub(crate) enum Envelope {
    Success(SuccessEnvelope),
    Failure(FailureEnvelope),
}
object_struct! {
#[serde(deny_unknown_fields)]
pub(crate) struct SuccessEnvelope { protocol: String, id: u32, ok: bool, result: Value }
}
object_struct! {
#[serde(deny_unknown_fields)]
pub(crate) struct FailureEnvelope {
    protocol: String,
    #[serde(deserialize_with = "nullable")]
    id: Option<u32>,
    ok: bool,
    error: Box<ErrorPacket>,
}
}

pub(crate) struct WorkerTransport {
    pub(crate) child: Child,
    stdin: UnixStream,
    stdout: UnixStream,
    stderr: UnixStream,
    stdout_bytes: Vec<u8>,
    pub(crate) stderr_bytes: Vec<u8>,
    stdout_eof: bool,
    stderr_eof: bool,
    pub(crate) next_id: u32,
    deadline: Instant,
    pub(crate) work_deadline: Instant,
    pub(crate) poisoned: bool,
    pub(crate) finished: bool,
    pub(crate) last_error: Option<EngineError>,
    pub(crate) last_operation: Option<PendingOperation>,
    cleanup_status: Option<CleanupStatus>,
    endpoint: Endpoint,
}

impl WorkerTransport {
    pub(crate) fn new(endpoint: Endpoint) -> Result<Self, String> {
        Self::launch(endpoint, endpoint.worker(), TOTAL)
    }
    #[cfg(test)]
    pub(crate) fn spawn_test(
        endpoint: Endpoint,
        script: &Path,
        total: Duration,
    ) -> Result<Self, String> {
        Self::launch(endpoint, script, total)
    }
    fn launch(endpoint: Endpoint, script: &Path, total: Duration) -> Result<Self, String> {
        let started = Instant::now();
        let path = std::env::var_os("PATH").ok_or("Trusted host PATH is missing")?;
        let node = node_from_path(&path)?;
        let (stdin, child_stdin) = channel().map_err(|e| format!("Cannot create v2 stdin: {e}"))?;
        let (stdout, child_stdout) =
            channel().map_err(|e| format!("Cannot create v2 stdout: {e}"))?;
        let (stderr, child_stderr) =
            channel().map_err(|e| format!("Cannot create v2 stderr: {e}"))?;
        let child = Command::new(node)
            .args(["--import", "tsx"])
            .arg(script)
            .current_dir(env!("CARGO_MANIFEST_DIR"))
            .env_clear()
            .env("PATH", path)
            .stdin(child_stdin)
            .stdout(child_stdout)
            .stderr(child_stderr)
            .spawn()
            .map_err(|e| format!("Cannot launch Node engine v2: {e}"))?;
        Ok(Self {
            child,
            stdin,
            stdout,
            stderr,
            stdout_bytes: Vec::new(),
            stderr_bytes: Vec::new(),
            stdout_eof: false,
            stderr_eof: false,
            next_id: 1,
            deadline: started + total,
            work_deadline: started + total.saturating_sub(REAP),
            poisoned: false,
            finished: false,
            last_error: None,
            last_operation: None,
            cleanup_status: None,
            endpoint,
        })
    }
    pub(crate) fn is_poisoned(&self) -> bool {
        self.poisoned
    }
    fn pending(&self, method: &str, context: Option<EngineContext>) -> PendingOperation {
        PendingOperation {
            method: method.into(),
            id: Some(self.next_id),
            context,
            status: if method.ends_with(".commit")
                || method.ends_with(".settle")
                || method.ends_with(".open")
                || method.ends_with(".start")
            {
                PendingStatus::MutationUnknown
            } else {
                PendingStatus::Unverified
            },
        }
    }
    pub(crate) fn call<T: for<'de> Deserialize<'de>>(
        &mut self,
        method: &str,
        fields: Value,
        context: Option<EngineContext>,
        deadline: Instant,
    ) -> Result<T, EngineError> {
        self.call_inner(method, fields, context, deadline, None)
    }
    pub(crate) fn call_metered<T: for<'de> Deserialize<'de>>(
        &mut self,
        method: &str,
        fields: Value,
        context: Option<EngineContext>,
        deadline: Instant,
        work: &mut LedgerWork,
    ) -> Result<T, EngineError> {
        self.call_inner(method, fields, context, deadline, Some(work))
    }
    fn call_inner<T: for<'de> Deserialize<'de>>(
        &mut self,
        method: &str,
        fields: Value,
        context: Option<EngineContext>,
        deadline: Instant,
        work: Option<&mut LedgerWork>,
    ) -> Result<T, EngineError> {
        let pending = self.pending(method, context);
        self.last_operation = Some(pending.clone());
        self.last_error = None;
        let deadline = deadline.min(Instant::now() + DECISION);
        let id = self.next_id;
        let protocol = self.endpoint.protocol();
        let result = self.exchange(method, fields, deadline).and_then(|frame| {
            if let Some(work) = work {
                work.preflight_bytes(frame.len())
                    .map_err(|e| (e.to_string(), None))?;
                validate_unique_json(&frame).map_err(|e| (e, None))?;
            }
            let envelope: Envelope = serde_json::from_slice(&frame)
                .map_err(|e| (format!("Invalid engine reply: {e}"), None))?;
            self.drain().map_err(|e| (e, None))?;
            if !self.stdout_bytes.is_empty() {
                return Err(("Extra engine reply or partial frame".into(), None));
            }
            match envelope {
                Envelope::Success(reply)
                    if reply.protocol == protocol && reply.id == id && reply.ok =>
                {
                    serde_json::from_value(reply.result)
                        .map_err(|e| (format!("Malformed {method} result: {e}"), None))
                }
                Envelope::Failure(reply)
                    if reply.protocol == protocol && reply.id == Some(id) && !reply.ok =>
                {
                    Err((
                        format!("{:?}: {}", reply.error.code, reply.error.message),
                        Some(reply.error),
                    ))
                }
                _ => Err(("Engine protocol, request ID, or ok mismatch".into(), None)),
            }
        });
        result.map_err(|(message, packet)| {
            if packet.is_none() {
                self.poisoned = true;
            }
            let error = EngineError {
                message,
                packet,
                pending,
            };
            self.last_error = Some(error.clone());
            error
        })
    }
    fn exchange(
        &mut self,
        method: &str,
        fields: Value,
        deadline: Instant,
    ) -> Result<Vec<u8>, (String, Option<Box<ErrorPacket>>)> {
        let fail = |message: String| (message, None);
        if self.poisoned || self.finished {
            return Err(fail("Engine v2 transport is closed or poisoned".into()));
        }
        let deadline = deadline.min(self.work_deadline);
        if Instant::now() >= deadline {
            return Err(fail("Engine v2 absolute deadline exceeded".into()));
        }
        self.drain().map_err(fail)?;
        if !self.stdout_bytes.is_empty() || self.stdout_eof {
            return Err(fail("Unsolicited engine output or unexpected EOF".into()));
        }
        let id = self.next_id;
        self.next_id = id
            .checked_add(1)
            .ok_or_else(|| fail("Engine request ID exhausted".into()))?;
        let mut request = fields
            .as_object()
            .cloned()
            .ok_or_else(|| fail("Request fields must be an object".into()))?;
        request.insert("protocol".into(), json!(self.endpoint.protocol()));
        request.insert("id".into(), json!(id));
        request.insert("op".into(), json!(method));
        let mut bytes = serde_json::to_vec(&request)
            .map_err(|e| fail(format!("Cannot encode request: {e}")))?;
        bytes.push(b'\n');
        if bytes.len() > REQUEST_LIMIT {
            return Err(fail("Engine request exceeds 64 KiB".into()));
        }
        let mut sent = 0;
        let mut flushed = false;
        loop {
            if Instant::now() >= deadline {
                return Err(fail("Engine v2 absolute deadline exceeded".into()));
            }
            if sent < bytes.len() {
                match self.stdin.write(&bytes[sent..bytes.len().min(sent + 8192)]) {
                    Ok(0) => return Err(fail("Engine stdin closed during request".into())),
                    Ok(count) => sent += count,
                    Err(e)
                        if matches!(
                            e.kind(),
                            io::ErrorKind::WouldBlock | io::ErrorKind::Interrupted
                        ) => {}
                    Err(e) => return Err(fail(format!("Cannot write engine request: {e}"))),
                }
            }
            if sent == bytes.len() && !flushed {
                self.stdin
                    .flush()
                    .map_err(|e| fail(format!("Cannot flush engine request: {e}")))?;
                flushed = true;
            }
            self.drain().map_err(fail)?;
            if let Some(newline) = self.stdout_bytes.iter().position(|byte| *byte == b'\n') {
                if sent != bytes.len() {
                    return Err(fail("Engine replied before the complete request".into()));
                }
                if newline + 1 != self.stdout_bytes.len() {
                    return Err(fail("Extra engine reply or partial frame".into()));
                }
                let mut frame = std::mem::take(&mut self.stdout_bytes);
                std::str::from_utf8(&frame[..newline])
                    .map_err(|e| fail(format!("Invalid engine UTF-8: {e}")))?;
                frame.truncate(newline);
                return Ok(frame);
            }
            if self.stdout_eof {
                return Err(fail("Unexpected EOF with a pending engine reply".into()));
            }
            if let Some(status) = self
                .child
                .try_wait()
                .map_err(|e| fail(format!("Cannot poll engine: {e}")))?
            {
                return Err(fail(format!(
                    "Engine exited during request: {status}; stderr: {}",
                    String::from_utf8_lossy(&self.stderr_bytes)
                )));
            }
            pause(deadline);
        }
    }
    fn drain(&mut self) -> Result<(), String> {
        drain_stream(
            &mut self.stdout,
            &mut self.stdout_bytes,
            &mut self.stdout_eof,
            REPLY_LIMIT,
            "stdout frame",
        )?;
        drain_stream(
            &mut self.stderr,
            &mut self.stderr_bytes,
            &mut self.stderr_eof,
            STDERR_LIMIT,
            "cumulative stderr",
        )
    }
    pub(crate) fn finish(&mut self) -> Result<(), String> {
        self.finish_by(self.work_deadline)
    }
    pub(crate) fn finish_by(&mut self, deadline: Instant) -> Result<(), String> {
        if self.poisoned {
            return Err("Cannot gracefully finish poisoned engine".into());
        }
        self.stdin
            .shutdown(Shutdown::Write)
            .map_err(|e| format!("Cannot send engine EOF: {e}"))?;
        let shutdown_deadline = (Instant::now() + Duration::from_secs(5))
            .min(self.work_deadline)
            .min(deadline);
        loop {
            if Instant::now() >= shutdown_deadline {
                return Err("Engine shutdown deadline exceeded".into());
            }
            self.drain()?;
            if !self.stdout_bytes.is_empty() {
                return Err("Unsolicited engine reply during shutdown".into());
            }
            if let Some(status) = self
                .child
                .try_wait()
                .map_err(|e| format!("Cannot reap engine: {e}"))?
                && self.stdout_eof
                && self.stderr_eof
            {
                self.finished = true;
                self.cleanup_status = Some(CleanupStatus::Exited {
                    success: status.success(),
                });
                return if status.success() {
                    Ok(())
                } else {
                    Err(format!(
                        "Engine exited with {status}; stderr: {}",
                        String::from_utf8_lossy(&self.stderr_bytes)
                    ))
                };
            }
            pause(shutdown_deadline);
        }
    }
    pub(crate) fn cleanup(&mut self) -> CleanupStatus {
        if let Some(status) = &self.cleanup_status {
            return status.clone();
        }
        let status =
            match kill_and_reap(&mut self.child, (Instant::now() + REAP).min(self.deadline)) {
                Ok(()) => CleanupStatus::Reaped,
                Err(message) => CleanupStatus::ReapFailed { message },
            };
        self.finished = true;
        self.cleanup_status = Some(status.clone());
        status
    }
}
impl Drop for WorkerTransport {
    fn drop(&mut self) {
        if !self.finished {
            let _ = kill_and_reap(&mut self.child, (Instant::now() + REAP).min(self.deadline));
        }
    }
}
fn pause(deadline: Instant) {
    std::thread::sleep(
        Duration::from_micros(100).min(deadline.saturating_duration_since(Instant::now())),
    );
}
fn drain_stream(
    stream: &mut UnixStream,
    bytes: &mut Vec<u8>,
    eof: &mut bool,
    limit: usize,
    label: &str,
) -> Result<(), String> {
    if *eof {
        return Ok(());
    }
    let mut buffer = [0u8; 8192];
    for _ in 0..4 {
        match stream.read(&mut buffer) {
            Ok(0) => {
                *eof = true;
                return Ok(());
            }
            Ok(count) => {
                if count > limit.saturating_sub(bytes.len()) {
                    return Err(format!("Engine {label} limit exceeded"));
                }
                bytes.extend_from_slice(&buffer[..count]);
            }
            Err(e) if e.kind() == io::ErrorKind::WouldBlock => return Ok(()),
            Err(e) if e.kind() == io::ErrorKind::Interrupted => {}
            Err(e) => return Err(format!("Cannot drain engine {label}: {e}")),
        }
    }
    Ok(())
}

pub(crate) fn validate_unique_json(bytes: &[u8]) -> Result<(), String> {
    struct Unique;
    impl<'de> DeserializeSeed<'de> for Unique {
        type Value = ();
        fn deserialize<D: serde::Deserializer<'de>>(self, d: D) -> Result<(), D::Error> {
            d.deserialize_any(self)
        }
    }
    impl<'de> Visitor<'de> for Unique {
        type Value = ();
        fn expecting(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            f.write_str("duplicate-free JSON")
        }
        fn visit_map<M: MapAccess<'de>>(self, mut map: M) -> Result<(), M::Error> {
            let mut keys = BTreeSet::new();
            while let Some(key) = map.next_key::<String>()? {
                if !keys.insert(key) {
                    return Err(serde::de::Error::custom("Duplicate JSON object key"));
                }
                map.next_value_seed(Unique)?;
            }
            Ok(())
        }
        fn visit_seq<S: SeqAccess<'de>>(self, mut seq: S) -> Result<(), S::Error> {
            while seq.next_element_seed(Unique)?.is_some() {}
            Ok(())
        }
        fn visit_bool<E: serde::de::Error>(self, _: bool) -> Result<(), E> {
            Ok(())
        }
        fn visit_i64<E: serde::de::Error>(self, _: i64) -> Result<(), E> {
            Ok(())
        }
        fn visit_u64<E: serde::de::Error>(self, _: u64) -> Result<(), E> {
            Ok(())
        }
        fn visit_f64<E: serde::de::Error>(self, _: f64) -> Result<(), E> {
            Ok(())
        }
        fn visit_str<E: serde::de::Error>(self, _: &str) -> Result<(), E> {
            Ok(())
        }
        fn visit_unit<E: serde::de::Error>(self) -> Result<(), E> {
            Ok(())
        }
    }
    let mut decoder = serde_json::Deserializer::from_slice(bytes);
    Unique
        .deserialize(&mut decoder)
        .map_err(|e| e.to_string())?;
    decoder.end().map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture(body: &str) -> tempfile::NamedTempFile {
        let mut file = tempfile::Builder::new()
            .prefix("arena-economic-transport-")
            .suffix(".mjs")
            .tempfile()
            .unwrap();
        write!(file, "import {{createInterface}} from 'node:readline';for await(const line of createInterface({{input:process.stdin}})){{const r=JSON.parse(line);{body}}}").unwrap();
        file.flush().unwrap();
        file
    }

    #[test]
    fn production_endpoint_factory_has_only_fixed_protocol_worker_pairs() {
        for (endpoint, protocol, worker) in [
            (Endpoint::EngineV2, "arena-engine-v2", "worker-v2.ts"),
            (
                Endpoint::EconomicV1,
                "arena-economic-v1",
                "worker-economic.ts",
            ),
        ] {
            assert_eq!(endpoint.protocol(), protocol);
            assert_eq!(
                endpoint.worker(),
                Path::new(env!("CARGO_MANIFEST_DIR"))
                    .join("engine")
                    .join(worker)
            );
        }
    }

    #[test]
    fn economic_transport_rejects_duplicate_keys_before_value_decode() {
        for body in [
            "process.stdout.write('{\"protocol\":\"arena-economic-v1\",\"id\":1,\"id\":1,\"ok\":true,\"result\":{}}\\n');",
            "process.stdout.write('{\"protocol\":\"arena-economic-v1\",\"id\":1,\"ok\":true,\"result\":{\"a\":{\"b\":1,\"b\":2}}}\\n');",
        ] {
            let file = fixture(body);
            let mut transport = WorkerTransport::spawn_test(
                Endpoint::EconomicV1,
                file.path(),
                Duration::from_secs(10),
            )
            .unwrap();
            let mut work = LedgerWork::new();
            let error = transport
                .call_metered::<Value>(
                    "economic.start",
                    json!({}),
                    None,
                    transport.work_deadline,
                    &mut work,
                )
                .unwrap_err();
            assert!(error.message.contains("Duplicate"), "{error}");
            assert!(work.used() > 0);
            assert!(transport.is_poisoned());
            assert_eq!(transport.cleanup(), CleanupStatus::Reaped);
        }
    }

    #[test]
    fn economic_transactions_share_one_meter_across_rpc_predecode_charges() {
        let file = fixture(
            "process.stdout.write(JSON.stringify({protocol:r.protocol,id:r.id,ok:true,result:{padding:'x'.repeat(500)}})+'\\n');",
        );
        let mut transport =
            WorkerTransport::spawn_test(Endpoint::EconomicV1, file.path(), Duration::from_secs(10))
                .unwrap();
        let mut work = LedgerWork::with_limit(1000).unwrap();
        transport
            .call_metered::<Value>(
                "economic.start",
                json!({}),
                None,
                transport.work_deadline,
                &mut work,
            )
            .unwrap();
        let used = work.used();
        let error = transport
            .call_metered::<Value>(
                "economic.open",
                json!({}),
                None,
                transport.work_deadline,
                &mut work,
            )
            .unwrap_err();
        assert!(error.message.contains("BUDGET"));
        assert_eq!(work.used(), used);
        assert!(transport.is_poisoned());
        transport.cleanup();
    }

    #[test]
    fn malformed_economic_replies_fail_before_any_history_can_publish() {
        for body in [
            "process.stdout.write(JSON.stringify({protocol:r.protocol,id:r.id,ok:true,result:{kind:'closed',session:1,image:{scfen:'native',bank:{w:3,b:3}},outcome:null}})+'\\n');",
            "process.stdout.write(JSON.stringify({protocol:r.protocol,id:r.id,ok:true,result:['closed',1,null,{},null]})+'\\n');",
            "process.stdout.write(JSON.stringify({protocol:r.protocol,id:r.id,ok:false,error:{code:'STATE',message:'x',context:null}})+'\\n');",
            "process.stdout.write(JSON.stringify({protocol:r.protocol,id:r.id,ok:true,result:{},extra:1})+'\\n');",
        ] {
            let file = fixture(body);
            let mut transport = WorkerTransport::spawn_test(
                Endpoint::EconomicV1,
                file.path(),
                Duration::from_secs(10),
            )
            .unwrap();
            assert!(
                transport
                    .call_metered::<crate::engine_v2::CloseReply>(
                        "economic.close",
                        json!({}),
                        None,
                        transport.work_deadline,
                        &mut LedgerWork::new()
                    )
                    .is_err()
            );
            assert!(transport.is_poisoned());
            transport.cleanup();
        }
    }
}
