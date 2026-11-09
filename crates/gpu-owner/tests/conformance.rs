// SPEC: _spec/gpu-cooperative-policy.md
use chess_coach_gpu_owner::{
    json::Decimal,
    policy::{Configuration, Decision, Policy, Sample},
};
use serde_json::Value;

fn signed(value: &Value) -> Option<i64> {
    let text = value.as_str()?;
    let digits = text.strip_prefix('-').unwrap_or(text);
    if digits.is_empty()
        || (digits.len() > 1 && digits.starts_with('0'))
        || !digits.bytes().all(|b| b.is_ascii_digit())
        || text == "-0"
    {
        return None;
    }
    text.parse().ok()
}
fn sample(value: &Value) -> Option<Sample> {
    let fields = value.as_object()?;
    if fields.len() != 4
        || !["uuid", "freeBytes", "totalBytes", "observedBoottimeNs"]
            .iter()
            .all(|key| fields.contains_key(*key))
    {
        return None;
    }
    fn range(value: &Value) -> Option<Decimal> {
        let text = value.as_str()?;
        let n = text.parse::<i128>().ok()?;
        if n.to_string() != text {
            return None;
        }
        Some(Decimal(i64::try_from(n).unwrap_or(-1)))
    }
    Some(Sample {
        uuid: value["uuid"].as_str()?.into(),
        free_bytes: range(&value["freeBytes"])?,
        total_bytes: range(&value["totalBytes"])?,
        observed_boottime_ns: range(&value["observedBoottimeNs"])?,
    })
}

#[test]
fn shared_reconstructed_policy_range_and_clock_traces() {
    let document: Value = serde_json::from_str(include_str!(
        "../../../tooling/runtime/fixtures/gpu-policy-traces.json"
    ))
    .unwrap();
    assert_eq!(document["version"], "chess-coach.gpu-policy-conformance.v1");
    let cases = document["cases"].as_array().unwrap();
    assert_eq!(cases.len(), 33);
    let mut groups = std::collections::BTreeSet::new();
    let mut names = std::collections::BTreeSet::new();
    for case in cases {
        let name = case["name"].as_str().unwrap();
        assert!(names.insert(name));
        groups.insert(case["group"].as_str().unwrap());
        let configuration =
            serde_json::from_value::<Configuration>(case["configuration"].clone()).ok();
        let mut policy = Policy::new(configuration, signed(&case["originalS0Ns"]));
        for (index, call) in case["calls"].as_array().unwrap().iter().enumerate() {
            let now = signed(&call["nowNs"]);
            let actual = match call["method"].as_str().unwrap() {
                "admit" => policy.admit(now, sample(&call["sample"])),
                "observe" => policy.observe(now, sample(&call["sample"])),
                "check" => policy.check(now),
                method => panic!("unknown method {method}"),
            };
            let expected: Decision = serde_json::from_value(call["expected"].clone()).unwrap();
            assert_eq!(actual, expected, "{name} call {index}");
        }
    }
    assert_eq!(
        groups.into_iter().collect::<Vec<_>>(),
        vec!["clock", "policy", "range"]
    );
}
