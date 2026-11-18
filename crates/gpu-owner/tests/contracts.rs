// SPEC: _spec/gpu-owner.md
use chess_coach_gpu_owner::{
    OwnerError, RawLaunchRequest, Result,
    input::{ByteRef, OwnerInput},
    json::{self, Decimal},
    linux::{Clock, Waiter, Watch},
    run_once_with,
};
use rustix::event::PollFlags;
use serde_json::{Value, json};
use std::cell::Cell;

fn manifest() -> Value {
    let digest = "0".repeat(64);
    let file = json!({"path":"/fixture/tool","byteLength":0,"sha256":digest});
    json!({"version":"chess-coach.gpu-owner.v1",
        "ownership":{"sessionId":"session","attemptId":"attempt","containerName":"owned","ownershipToken":"0".repeat(32)},
        "outsideControl":{"admissionReceipt":file,"expectedSelfEnvelope":{"cpus":[0,1],"cpuQuota":200000,"memoryMaxBytes":"2000000000",
            "aggregateParent":"/fixture/cgroup/aggregate","aggregateCpus":[0,1,2,3,4,5],"aggregateCpuQuota":600000,"aggregateMemoryMaxBytes":"24000000000"}},
        "docker":{"executable":file,"anonymousConfigDirectory":"/fixture/config","endpointUnixSocket":"/fixture/socket","cgroupParentArgument":"job.slice"},
        "observation":{"procRoot":"/fixture/proc","cgroupRoot":"/fixture/cgroup","approvedJobParentAbsolutePath":"/fixture/cgroup/aggregate/jobs",
            "expectedOutsideControlCgroupAbsolutePath":"/fixture/cgroup/aggregate/control"},
        "job":{"imageId":format!("sha256:{digest}"),"runtimeClosure":file,"gpuProfile":{"mode":"legacy-nvidia-device-request.v1","cpus":[2,3,4,5],"injectionInventory":file},
            "stateHostSource":"/fixture/state","jobInputJson":"{}","jobInputRef":{"byteLength":2,"sha256":json::sha256(b"{}")},"expectedDescriptorSha256":digest,"initialModelId":digest},
        "cooperative":{"selectedUuid":"GPU-12345678-1234-1234-1234-123456789abc","startupMinFreeBytes":"1000","runningStopBelowFreeBytes":"500","samplePeriodNs":"1000","maxSampleAgeNs":"2000"},
        "telemetry":{"kind":"registered-nvidia-smi-query.v1","executable":file,"runtimeClosure":file,"expectedDriver":"fixture","queryBudgetNs":"100","refreshIntervalNs":"100","schedulingReserveNs":"100"},
        "evidence":{"exclusivePacketRoot":"/fixture/evidence"}})
}
fn parse(value: &Value) -> Result<OwnerInput> {
    let bytes = serde_json::to_vec(value).unwrap();
    OwnerInput::parse(&bytes, &json::sha256(&bytes))
}

#[test]
fn exact_manifest_names_and_resource_envelope() {
    assert!(parse(&manifest()).is_ok());
    for (pointer, replacement) in [
        ("/outsideControl/expectedSelfEnvelope/cpus", json!([0, 0])),
        ("/job/gpuProfile/cpus", json!([0, 2, 3, 4])),
        (
            "/outsideControl/expectedSelfEnvelope/aggregateCpuQuota",
            json!(599999),
        ),
        (
            "/outsideControl/expectedSelfEnvelope/memoryMaxBytes",
            json!("16000000000"),
        ),
        (
            "/outsideControl/expectedSelfEnvelope/aggregateMemoryMaxBytes",
            json!("24000000001"),
        ),
        ("/telemetry/queryBudgetNs", json!("800")),
        ("/docker/cgroupParentArgument", json!("/job.slice")),
        ("/job/jobInputJson", json!(" {}")),
        ("/ownership/ownershipToken", json!("A".repeat(32))),
    ] {
        let mut candidate = manifest();
        *candidate.pointer_mut(pointer).unwrap() = replacement;
        assert!(parse(&candidate).is_err(), "{pointer}");
    }
}

#[test]
fn rejects_missing_unknown_and_memory_aliases() {
    for pointer in [
        "/ownership",
        "/outsideControl/expectedSelfEnvelope",
        "/docker",
        "/observation",
        "/job/gpuProfile",
        "/cooperative",
        "/telemetry",
        "/evidence",
    ] {
        let mut value = manifest();
        value
            .pointer_mut(pointer)
            .unwrap()
            .as_object_mut()
            .unwrap()
            .insert("extra".into(), json!(null));
        assert!(parse(&value).is_err(), "{pointer}");
    }
    for (pointer, key) in [
        ("/outsideControl/expectedSelfEnvelope", "memoryMaxBytes"),
        (
            "/outsideControl/expectedSelfEnvelope",
            "aggregateMemoryMaxBytes",
        ),
        ("/telemetry", "queryBudgetNs"),
        ("/telemetry", "refreshIntervalNs"),
        ("/telemetry", "schedulingReserveNs"),
    ] {
        let mut value = manifest();
        let map = value.pointer_mut(pointer).unwrap().as_object_mut().unwrap();
        let old = map.remove(key).unwrap();
        map.insert(format!("{key}Decimal"), old);
        assert!(parse(&value).is_err());
        let mut value = manifest();
        value
            .pointer_mut(pointer)
            .unwrap()
            .as_object_mut()
            .unwrap()
            .remove(key);
        assert!(parse(&value).is_err());
    }
}

#[test]
fn independent_hash_commits_original_bytes() {
    let bytes = serde_json::to_vec(&manifest()).unwrap();
    let expected = json::sha256(&bytes);
    assert!(OwnerInput::parse(&bytes, &expected).is_ok());
    let changed = [b" ".as_slice(), bytes.as_slice()].concat();
    assert_eq!(
        OwnerInput::parse(&changed, &expected).unwrap_err(),
        OwnerError("MANIFEST_SHA256")
    );
    assert_eq!(
        OwnerInput::parse(&vec![b' '; 262_145], "bad").unwrap_err(),
        OwnerError("MANIFEST_BOUND")
    );
}

#[test]
fn evidence_packet_must_remain_outside_job_writable_state() {
    for path in [
        "/fixture/state",
        "/fixture/state/owner-packet",
        "/fixture/state/nested/owner-packet",
    ] {
        let mut value = manifest();
        value["evidence"]["exclusivePacketRoot"] = json!(path);
        assert_eq!(
            parse(&value).unwrap_err(),
            OwnerError("EVIDENCE_STATE_OVERLAP")
        );
    }
    for path in ["/fixture/state-other/owner-packet", "/fixture/evidence"] {
        let mut value = manifest();
        value["evidence"]["exclusivePacketRoot"] = json!(path);
        assert!(parse(&value).is_ok());
    }
}

#[test]
fn literal_negative_zero_counts_preserve_bounds_and_manifest_byte_commitment() {
    let original = serde_json::to_string(&manifest()).unwrap();
    let text = original
        .replace("\"byteLength\":0", "\"byteLength\":-0")
        .replace("\"cpus\":[0,1]", "\"cpus\":[-0,1]")
        .replace(
            "\"aggregateCpus\":[0,1,2,3,4,5]",
            "\"aggregateCpus\":[-0,1,2,3,4,5]",
        );
    assert_ne!(text, original);
    assert!(OwnerInput::parse(text.as_bytes(), &json::sha256(original.as_bytes())).is_err());
    let input = OwnerInput::parse(text.as_bytes(), &json::sha256(text.as_bytes())).unwrap();
    assert_eq!(input.outside_control.expected_self_envelope.cpus[0], 0);
    assert_eq!(input.docker.executable.byte_length, 0);
    for token in ["-0.0", "-0e0", "0.0", "0e0", "\"0\"", "true"] {
        let invalid = text.replace("\"byteLength\":-0", &format!("\"byteLength\":{token}"));
        assert!(
            OwnerInput::parse(invalid.as_bytes(), &json::sha256(invalid.as_bytes())).is_err(),
            "{token}"
        );
    }
}

#[test]
fn decimal_strings_and_json_integer_counts_are_not_coerced() {
    for value in ["0", "1", "9223372036854775807"] {
        let parsed: Decimal = serde_json::from_str(&format!("\"{value}\"")).unwrap();
        assert_eq!(
            serde_json::to_string(&parsed).unwrap(),
            format!("\"{value}\"")
        );
    }
    for value in [
        "00",
        "01",
        "+1",
        "-1",
        "1.0",
        "1e3",
        "9223372036854775808",
        "",
    ] {
        assert!(serde_json::from_str::<Decimal>(&format!("\"{value}\"")).is_err());
    }
    assert!(serde_json::from_str::<Decimal>("1").is_err());
    for token in ["1.0", "1e0", "-1", "9007199254740992", "\"1\""] {
        let bytes = format!(
            "{{\"byteLength\":{token},\"sha256\":\"{}\"}}",
            "0".repeat(64)
        );
        assert!(
            json::decode::<ByteRef>(bytes.as_bytes(), 4096).is_err(),
            "{token}"
        );
    }
}

#[test]
fn recursive_json_uniqueness_and_bounds() {
    for bytes in [
        r#"{"a":1,"\u0061":2}"#,
        r#"{"a":{"x":1,"\u0078":2}}"#,
        r#"[{"a":1,"a":2}]"#,
        r#"{"a":9007199254740992}"#,
        r#"{"a":1e999}"#,
        r#"{"a":1,}"#,
        "{} trailing",
        r#""\ud800""#,
    ] {
        assert!(
            json::validate(bytes.as_bytes(), 1_048_576).is_err(),
            "{bytes}"
        );
    }
    let deep = format!("{}0{}", "[".repeat(34), "]".repeat(34));
    assert!(json::validate(deep.as_bytes(), 1_048_576).is_err());
    let many = serde_json::to_vec(&vec![0; 16385]).unwrap();
    assert!(json::validate(&many, 1_048_576).is_err());
    assert!(
        json::validate(
            br#"{"x":"brace } \" ","a":[true,false,null,-1.5e-2]}"#,
            4096
        )
        .is_ok()
    );
}

struct RecordingClock(Cell<u32>);
impl Clock for RecordingClock {
    fn now_ns(&self) -> Result<i64> {
        let n = self.0.get();
        self.0.set(n + 1);
        Ok(42 + i64::from(n))
    }
}
struct NeverWait;
impl Waiter for NeverWait {
    fn wait_until(&mut self, _: i64, _: &[Watch<'_>]) -> Result<Vec<PollFlags>> {
        panic!("invalid raw input must not construct helpers")
    }
}
#[test]
fn origin_precedes_raw_validation_and_remains_a_decimal_string() {
    let clock = RecordingClock(Cell::new(0));
    let report = run_once_with(
        RawLaunchRequest {
            input_manifest: "not JSON".into(),
            expected_manifest_sha256: "bad".into(),
        },
        &clock,
        &mut NeverWait,
    )
    .unwrap();
    assert_eq!(report.origin_ns, 42);
    assert!(!report.success);
    assert!(!report.training_ready);
    assert_eq!(report.first_failure.as_deref(), Some("MANIFEST_SHA256"));
    assert!(clock.0.get() >= 2);
    assert_eq!(serde_json::to_value(report).unwrap()["origin_ns"], "42");
}
