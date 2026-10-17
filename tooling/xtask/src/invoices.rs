// SPEC: _spec/packages/training/burn-compat.puml, _spec/apps/arena/burn-compat.puml
use std::collections::BTreeMap;

use serde_json::{Value, json};

pub(crate) struct RustCounts {
    pub total: u64,
    pub binaries: Vec<Value>,
}

pub(crate) fn required_rust_binaries(counts: &RustCounts) -> Result<(), String> {
    for package in ["training_native-", "arena-", "xtask-"] {
        if !counts.binaries.iter().any(|binary| {
            binary["binary"]
                .as_str()
                .is_some_and(|name| name.contains(package))
                && binary["tests"].as_u64().is_some_and(|tests| tests > 0)
        }) {
            return Err(format!(
                "Missing nonempty Rust package test binary: {package}"
            ));
        }
    }
    Ok(())
}

pub(crate) fn rust(text: &str) -> Result<RustCounts, String> {
    let mut total = 0_u64;
    let mut binaries = Vec::new();
    let mut running = None;
    for line in text.lines().map(str::trim) {
        if let Some(count) = line.strip_prefix("running ") {
            let count = count
                .strip_suffix(" tests")
                .or_else(|| count.strip_suffix(" test"))
                .ok_or("Malformed Rust running count")?;
            if running.replace(number(count)?).is_some() {
                return Err("Rust test binary omitted its summary".into());
            }
        }
        if let Some(summary) = line.strip_prefix("test result: ") {
            let summary = summary
                .strip_prefix("ok. ")
                .ok_or("Rust test binary did not pass")?;
            let fields: Vec<_> = summary.split(';').collect();
            if fields.len() < 6 {
                return Err("Incomplete Rust test summary".into());
            }
            let passed = labeled_count(fields[0], "passed")?;
            for (field, label) in
                fields[1..5]
                    .iter()
                    .zip(["failed", "ignored", "measured", "filtered out"])
            {
                if labeled_count(field, label)? != 0 {
                    return Err(format!("Rust test summary contains {label} tests"));
                }
            }
            if running.take() != Some(passed) {
                return Err("Rust running count and passed count disagree".into());
            }
            total = total
                .checked_add(passed)
                .ok_or("Rust test count overflow")?;
            binaries.push(json!({ "ordinal": binaries.len() + 1, "tests": passed }));
        }
    }
    if running.is_some() || total == 0 || binaries.is_empty() {
        return Err("Missing, incomplete or empty Rust test selection".into());
    }
    let names: Vec<_> = text
        .lines()
        .filter_map(|line| line.trim().strip_prefix("Running "))
        .collect();
    if names.len() == binaries.len() {
        for (binary, name) in binaries.iter_mut().zip(names) {
            binary["binary"] = json!(name);
        }
    }
    Ok(RustCounts { total, binaries })
}

pub(crate) fn node_tap(text: &str) -> Result<u64, String> {
    let mut counts = BTreeMap::new();
    let mut plan = None;
    let mut completed = 0_u64;
    let mut all_completed = 0_u64;
    let mut header = false;
    for line in text.lines() {
        if line == "TAP version 13" {
            if header {
                return Err("Duplicate Node TAP header".into());
            }
            header = true;
        }
        if line.trim_start().starts_with("Bail out!") || line.trim_start().starts_with("not ok ") {
            return Err("Node TAP failure or bailout".into());
        }
        if line.trim_start().starts_with("ok ") {
            all_completed += 1;
        }
        if let Some(test) = line.strip_prefix("ok ") {
            let sequence = test
                .split_whitespace()
                .next()
                .ok_or("Missing TAP test number")?;
            if number(sequence)? != completed + 1 {
                return Err("Node TAP test sequence is incomplete".into());
            }
            completed += 1;
        }
        if let Some(value) = line.strip_prefix("1..")
            && plan.replace(number(value)?).is_some()
        {
            return Err("Duplicate Node TAP plan".into());
        }
        if let Some(comment) = line.strip_prefix("# ") {
            for label in [
                "tests",
                "suites",
                "pass",
                "fail",
                "cancelled",
                "skipped",
                "todo",
            ] {
                if let Some(value) = comment
                    .strip_prefix(label)
                    .and_then(|value| value.strip_prefix(' '))
                    && counts.insert(label, number(value.trim())?).is_some()
                {
                    return Err(format!("Duplicate Node TAP {label} summary"));
                }
            }
        }
    }
    let tests = *counts.get("tests").ok_or("Missing Node TAP test count")?;
    let suites = *counts.get("suites").ok_or("Missing Node TAP suite count")?;
    if !header
        || tests == 0
        || plan != Some(completed)
        || completed == 0
        || counts.get("pass") != Some(&tests)
        || tests.checked_add(suites) != Some(all_completed)
    {
        return Err("Empty or incomplete Node TAP selection".into());
    }
    for label in ["fail", "cancelled", "skipped", "todo"] {
        if counts.get(label) != Some(&0) {
            return Err(format!("Missing or nonzero Node TAP {label} count"));
        }
    }
    Ok(tests)
}

pub(crate) fn core(value: &Value) -> Result<u64, String> {
    let passed = json_count(value, "numPassedTests")?;
    if value.get("success") != Some(&Value::Bool(true))
        || passed < 668
        || json_count(value, "numTotalTests")? != passed
    {
        return Err("Core regression invoice is incomplete".into());
    }
    for field in [
        "numFailedTests",
        "numPendingTests",
        "numTodoTests",
        "numFailedTestSuites",
        "numPendingTestSuites",
    ] {
        if json_count(value, field)? != 0 {
            return Err(format!("Core invoice contains {field}"));
        }
    }
    let suites = json_count(value, "numTotalTestSuites")?;
    if suites == 0 || json_count(value, "numPassedTestSuites")? != suites {
        return Err("Core suite selection is incomplete".into());
    }
    let results = value
        .get("testResults")
        .and_then(Value::as_array)
        .ok_or("Missing core file results")?;
    let mut assertions = 0_u64;
    for result in results {
        if result.get("status").and_then(Value::as_str) != Some("passed") {
            return Err("Core file did not pass".into());
        }
        for assertion in result
            .get("assertionResults")
            .and_then(Value::as_array)
            .ok_or("Missing core assertions")?
        {
            if assertion.get("status").and_then(Value::as_str) != Some("passed") {
                return Err("Core assertion did not pass".into());
            }
            assertions = assertions
                .checked_add(1)
                .ok_or("Core assertion count overflow")?;
        }
    }
    if assertions != passed {
        return Err("Core assertion count disagrees with summary".into());
    }
    Ok(passed)
}

pub(crate) fn selected_dependencies(text: &str) -> Result<(), String> {
    let names: Vec<_> = text
        .lines()
        .filter_map(|line| line.split_whitespace().next())
        .collect();
    if !names.contains(&"training-native") || !names.contains(&"burn-flex") {
        return Err("Missing training-native or Burn Flex in selected dependency graph".into());
    }
    for forbidden in [
        "zip",
        "tch",
        "torch-sys",
        "burn-tch",
        "burn-wgpu",
        "burn-cuda",
        "burn-rocm",
        "burn-candle",
        "burn-ndarray",
        "burn-cpu",
        "cubecl-cuda",
        "cubecl-hip",
        "cubecl-wgpu",
        "cubecl-cpu",
        "llvm-sys",
        "inkwell",
    ] {
        if names.contains(&forbidden) {
            return Err(format!(
                "Forbidden selected backend dependency: {forbidden}"
            ));
        }
    }
    Ok(())
}

fn number(text: &str) -> Result<u64, String> {
    if text.is_empty() || !text.bytes().all(|byte| byte.is_ascii_digit()) {
        return Err(format!("Invalid test count: {text}"));
    }
    text.parse().map_err(|_| "Test count overflow".into())
}

fn labeled_count(text: &str, label: &str) -> Result<u64, String> {
    let value = text
        .trim()
        .strip_suffix(label)
        .and_then(|value| value.strip_suffix(' '))
        .ok_or_else(|| format!("Missing {label} test count"))?;
    number(value)
}

fn json_count(value: &Value, name: &str) -> Result<u64, String> {
    value
        .get(name)
        .and_then(Value::as_u64)
        .ok_or_else(|| format!("Missing or invalid {name}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    const RUST: &str = "running 2 tests\ntest a ... ok\ntest b ... ok\ntest result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s\n";
    const TAP: &str = "TAP version 13\nok 1 - first\nok 2 - second\n1..2\n# tests 2\n# suites 0\n# pass 2\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n";

    #[test]
    fn rust_counts_multiple_actual_binaries_including_empty_main() {
        let text = format!(
            "{RUST}running 0 tests\ntest result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s\nRunning unittests src/lib.rs (target/lib)\nRunning unittests src/main.rs (target/main)\n"
        );
        let counts = rust(&text).unwrap();
        assert_eq!(counts.total, 2);
        assert_eq!(counts.binaries.len(), 2);
        assert_eq!(
            counts.binaries[0]["binary"],
            "unittests src/lib.rs (target/lib)"
        );
        assert_eq!(counts.binaries[1]["tests"], 0);
    }

    #[test]
    fn workspace_invoice_requires_nonempty_native_arena_and_gate_tests() {
        let text = format!(
            "{RUST}{RUST}{RUST}Running unittests src/lib.rs (target/training_native-abc)\nRunning unittests src/lib.rs (target/arena-abc)\nRunning unittests src/lib.rs (target/xtask-abc)\n"
        );
        let counts = rust(&text).unwrap();
        assert!(required_rust_binaries(&counts).is_ok());
        assert!(required_rust_binaries(&rust(RUST).unwrap()).is_err());
        let mut counts = counts;
        counts.binaries[0]["tests"] = json!(0);
        assert!(required_rust_binaries(&counts).is_err());
    }

    #[test]
    fn rust_rejects_empty_incomplete_failed_ignored_measured_and_filtered() {
        for invalid in [
            String::new(),
            "running 2 tests".into(),
            RUST.replace("ok. 2", "FAILED. 2"),
            RUST.replace("0 failed", "1 failed"),
            RUST.replace("0 ignored", "1 ignored"),
            RUST.replace("0 measured", "1 measured"),
            RUST.replace("0 filtered out", "1 filtered out"),
            RUST.replace("running 2", "running 3"),
            RUST.replace("2 tests", "0 tests")
                .replace("2 passed", "0 passed"),
            format!("{RUST}running 1 test"),
            RUST.replace("0 filtered out;", ""),
        ] {
            assert!(rust(&invalid).is_err(), "accepted: {invalid}");
        }
    }

    #[test]
    fn node_counts_actual_tap_summary() {
        assert_eq!(node_tap(TAP).unwrap(), 2);
        let suites = TAP
            .replace("ok 1 - first", "    ok 1 - child\nok 1 - first")
            .replace("# tests 2", "# tests 3")
            .replace("# pass 2", "# pass 3");
        assert_eq!(node_tap(&suites).unwrap(), 3);
    }

    #[test]
    fn node_rejects_empty_incomplete_failed_cancelled_skipped_todo_and_duplicate() {
        for invalid in [
            String::new(),
            TAP.replace("TAP version 13\n", ""),
            TAP.replace("# todo 0\n", ""),
            TAP.replace("# fail 0", "# fail 1"),
            TAP.replace("# cancelled 0", "# cancelled 1"),
            TAP.replace("# skipped 0", "# skipped 1"),
            TAP.replace("# todo 0", "# todo 1"),
            TAP.replace("# pass 2", "# pass 1"),
            TAP.replace("1..2", "1..0"),
            TAP.replace("ok 2", "ok 3"),
            TAP.replace("ok 2", "not ok 2"),
            format!("{TAP}# pass 2\n"),
            format!("{TAP}Bail out!\n"),
            TAP.replace("# tests 2", "# tests 0"),
        ] {
            assert!(node_tap(&invalid).is_err(), "accepted: {invalid}");
        }
    }

    fn core_fixture() -> Value {
        json!({
            "success": true, "numPassedTests": 668, "numTotalTests": 668,
            "numFailedTests": 0, "numPendingTests": 0, "numTodoTests": 0,
            "numFailedTestSuites": 0, "numPendingTestSuites": 0,
            "numTotalTestSuites": 1, "numPassedTestSuites": 1,
            "testResults": [{ "status": "passed", "assertionResults": vec![json!({"status": "passed"}); 668] }],
        })
    }

    #[test]
    fn core_counts_complete_actual_assertions() {
        assert_eq!(core(&core_fixture()).unwrap(), 668);
    }

    #[test]
    fn core_rejects_missing_or_nonpassing_aggregate_and_assertions() {
        assert!(core(&json!({})).is_err());
        for field in [
            "numFailedTests",
            "numPendingTests",
            "numTodoTests",
            "numFailedTestSuites",
            "numPendingTestSuites",
        ] {
            let mut fixture = core_fixture();
            fixture[field] = json!(1);
            assert!(core(&fixture).is_err());
        }
        for (field, value) in [
            ("success", json!(false)),
            ("numPassedTests", json!(667)),
            ("numTotalTests", json!(669)),
            ("testResults", json!([])),
        ] {
            let mut fixture = core_fixture();
            fixture[field] = value;
            assert!(core(&fixture).is_err());
        }
        let mut fixture = core_fixture();
        fixture["testResults"][0]["assertionResults"][0]["status"] = json!("skipped");
        assert!(core(&fixture).is_err());
    }

    #[test]
    fn selected_graph_requires_flex_and_rejects_inactive_backends() {
        let tree =
            "training-native v0.1.0 (/repo/packages/training)\nburn v0.22.0\nburn-flex v0.22.0\n";
        assert!(selected_dependencies(tree).is_ok());
        for backend in [
            "zip",
            "tch",
            "torch-sys",
            "burn-tch",
            "burn-wgpu",
            "llvm-sys",
        ] {
            assert!(selected_dependencies(&format!("{tree}{backend} v1.0.0\n")).is_err());
        }
        assert!(selected_dependencies("").is_err());
    }
}
