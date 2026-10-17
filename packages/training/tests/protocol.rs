// SPEC: _spec/packages/training/burn-compat.puml
use std::io::Write;
use std::process::{Command, Output, Stdio};

use serde_json::{Value, json};
use training_native::COLUMNS;
use training_native::protocol::{INPUT_LIMIT, MODEL, PROTOCOL};

fn request(rows: usize) -> Value {
    json!({
        "protocol": PROTOCOL,
        "id": 42,
        "op": "score",
        "model": MODEL,
        "dtype": "f64",
        "matrix": {"rows": rows, "columns": COLUMNS, "values": vec![0.0; rows * COLUMNS]}
    })
}

fn run(bytes: &[u8], args: &[&str]) -> Output {
    let mut child = Command::new(env!("CARGO_BIN_EXE_training-native"))
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();
    let result = child.stdin.take().unwrap().write_all(bytes);
    if let Err(error) = result {
        assert_eq!(error.kind(), std::io::ErrorKind::BrokenPipe);
    }
    child.wait_with_output().unwrap()
}

fn reply(output: &Output, exit: i32) -> Value {
    assert_eq!(
        output.status.code(),
        Some(exit),
        "stderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert_eq!(output.stdout.last(), Some(&b'\n'));
    assert_eq!(
        output.stdout.iter().filter(|&&byte| byte == b'\n').count(),
        1
    );
    serde_json::from_slice(&output.stdout).unwrap()
}

fn refuses(bytes: &[u8], code: &str) -> Value {
    let output = run(bytes, &[]);
    let value = reply(&output, 2);
    assert_eq!(value["protocol"], PROTOCOL);
    assert_eq!(value["ok"], false);
    assert_eq!(value["error"]["code"], code);
    assert!(
        value["error"]["message"]
            .as_str()
            .is_some_and(|text| !text.is_empty())
    );
    assert_eq!(value.as_object().unwrap().len(), 4);
    assert_eq!(value["error"].as_object().unwrap().len(), 2);
    assert!(
        value["id"].is_null()
            || value["id"]
                .as_u64()
                .is_some_and(|id| u32::try_from(id).is_ok())
    );
    value
}

#[test]
fn process_returns_exact_f64_scores_and_one_json_line() {
    let mut value = request(2);
    value["id"] = json!(u32::MAX);
    value["matrix"]["values"][0] = json!(1.0);
    value["matrix"]["values"][1] = json!(2.0);
    value["matrix"]["values"][COLUMNS] = json!(3.0);
    value["matrix"]["values"][COLUMNS + 1] = json!(4.0);
    let output = run(&serde_json::to_vec(&value).unwrap(), &[]);
    assert!(
        output.stderr.is_empty(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert_eq!(
        reply(&output, 0),
        json!({
            "protocol": PROTOCOL, "id": u32::MAX, "ok": true, "backend": "burn-flex-cpu",
            "model": MODEL, "dtype": "f64", "scores": [0.125, 0.625]
        })
    );
}

#[test]
fn process_preserves_sub_f32_input_and_output_difference() {
    let mut value = request(2);
    value["matrix"]["values"][0] = json!(1.0);
    value["matrix"]["values"][COLUMNS] = json!(1.0 + 2.0_f64.powi(-30));
    let output = run(&serde_json::to_vec(&value).unwrap(), &[]);
    let result = reply(&output, 0);
    let scores = result["scores"].as_array().unwrap();
    assert_eq!(
        scores[1].as_f64().unwrap() - scores[0].as_f64().unwrap(),
        2.0_f64.powi(-31)
    );
}

#[test]
fn process_accepts_maximum_rows_bounds_and_whitespace() {
    let mut value = request(512);
    value["id"] = json!(0);
    value["matrix"]["values"][0] = json!(1_000_000.0);
    value["matrix"]["values"][1] = json!(-1_000_000.0);
    let mut bytes = b" \n\t".to_vec();
    bytes.extend(serde_json::to_vec(&value).unwrap());
    bytes.extend(b" \n\t");
    let output = run(&bytes, &[]);
    let result = reply(&output, 0);
    assert_eq!(result["scores"].as_array().unwrap().len(), 512);
    assert_eq!(result["scores"][0], json!(750000.125));
}

#[test]
fn process_normalizes_negative_zero() {
    let mut value = request(1);
    value["matrix"]["values"] = json!(vec![-0.0; COLUMNS]);
    value["matrix"]["values"][0] = json!(-0.25);
    let output = run(&serde_json::to_vec(&value).unwrap(), &[]);
    assert_eq!(
        reply(&output, 0)["scores"][0].as_f64().unwrap().to_bits(),
        0.0_f64.to_bits()
    );
    assert!(!String::from_utf8(output.stdout).unwrap().contains("-0.0"));
}

#[test]
fn process_rejects_shape_and_size_mismatches() {
    for (field, invalid) in [
        ("rows", json!(0)),
        ("rows", json!(-1)),
        ("rows", json!(513)),
        ("columns", json!(417)),
        ("columns", json!(419)),
        ("columns", json!(-418)),
    ] {
        let mut value = request(1);
        value["matrix"][field] = invalid;
        assert_eq!(
            refuses(&serde_json::to_vec(&value).unwrap(), "SHAPE")["id"],
            42
        );
    }
    for length in [0, COLUMNS - 1, COLUMNS + 1] {
        let mut value = request(1);
        value["matrix"]["values"] = json!(vec![0.0; length]);
        refuses(&serde_json::to_vec(&value).unwrap(), "SHAPE");
    }
}

#[test]
fn process_rejects_unknown_fields_at_every_request_level() {
    for nested in [false, true] {
        let mut value = request(1);
        let object = if nested {
            &mut value["matrix"]
        } else {
            &mut value
        };
        object["checkpointPath"] = json!("/tmp/not-allowed.bpk");
        refuses(&serde_json::to_vec(&value).unwrap(), "BAD_REQUEST");
    }
}

#[test]
fn process_requires_json_objects_instead_of_struct_sequences() {
    let mut value = request(1);
    value["matrix"] = json!([1, COLUMNS, vec![0.0; COLUMNS]]);
    refuses(&serde_json::to_vec(&value).unwrap(), "BAD_REQUEST");
    let value = json!([
        PROTOCOL,
        42,
        "score",
        MODEL,
        "f64",
        {"rows": 1, "columns": COLUMNS, "values": vec![0.0; COLUMNS]}
    ]);
    refuses(&serde_json::to_vec(&value).unwrap(), "BAD_REQUEST");
}

#[test]
fn process_rejects_wrong_enums_ids_and_field_types() {
    for (field, invalid) in [
        ("protocol", json!("other")),
        ("op", json!("train")),
        ("op", json!("checkpoint")),
        ("model", json!("feature-encoder-418")),
        ("dtype", json!("f32")),
        ("id", json!(-1)),
        ("id", json!(4294967296_u64)),
        ("id", json!(1.5)),
        ("id", Value::Null),
        ("id", json!("42")),
        ("op", json!({"score": null})),
    ] {
        let mut value = request(1);
        value[field] = invalid;
        refuses(&serde_json::to_vec(&value).unwrap(), "BAD_REQUEST");
    }
    for (field, invalid) in [
        ("rows", json!(1.0)),
        ("rows", json!("1")),
        ("columns", Value::Null),
        ("values", json!("0")),
        ("values", json!([null])),
        ("values", json!(["1"])),
    ] {
        let mut value = request(1);
        value["matrix"][field] = invalid;
        refuses(&serde_json::to_vec(&value).unwrap(), "BAD_REQUEST");
    }
}

#[test]
fn process_rejects_missing_fields_duplicates_and_trailing_data() {
    for field in ["protocol", "id", "op", "model", "dtype", "matrix"] {
        let mut value = request(1);
        value.as_object_mut().unwrap().remove(field);
        refuses(&serde_json::to_vec(&value).unwrap(), "BAD_REQUEST");
    }
    for field in ["rows", "columns", "values"] {
        let mut value = request(1);
        value["matrix"].as_object_mut().unwrap().remove(field);
        refuses(&serde_json::to_vec(&value).unwrap(), "BAD_REQUEST");
    }
    let bytes = serde_json::to_string(&request(1)).unwrap();
    for suffix in ["{}", " null", "\n{}", " trailing"] {
        refuses(format!("{bytes}{suffix}").as_bytes(), "BAD_REQUEST");
    }
    refuses(
        bytes
            .replacen("\"id\":42", "\"id\":42,\"id\":43", 1)
            .as_bytes(),
        "BAD_REQUEST",
    );
    refuses(
        bytes
            .replacen("\"rows\":1", "\"rows\":1,\"rows\":2", 1)
            .as_bytes(),
        "BAD_REQUEST",
    );
}

#[test]
fn process_rejects_malformed_nonfinite_and_out_of_bounds_numbers() {
    for invalid in [b"".as_slice(), b"{", b"[]", b"null", b"\xff"] {
        refuses(invalid, "BAD_REQUEST");
    }
    let bytes = serde_json::to_string(&request(1)).unwrap();
    for token in ["1e400", "-1e400"] {
        refuses(
            bytes
                .replacen("\"values\":[0.0", &format!("\"values\":[{token}"), 1)
                .as_bytes(),
            "NON_FINITE",
        );
    }
    for token in ["NaN", "Infinity", "-Infinity"] {
        refuses(
            bytes
                .replacen("\"values\":[0.0", &format!("\"values\":[{token}"), 1)
                .as_bytes(),
            "BAD_REQUEST",
        );
    }
    for invalid in [1_000_000.000_001, -1_000_000.000_001] {
        let mut value = request(1);
        value["matrix"]["values"][COLUMNS - 1] = json!(invalid);
        refuses(&serde_json::to_vec(&value).unwrap(), "BAD_REQUEST");
    }
}

#[test]
fn process_enforces_stdin_limit_before_parsing() {
    let mut bytes = serde_json::to_vec(&request(1)).unwrap();
    bytes.resize(INPUT_LIMIT, b' ');
    assert_eq!(reply(&run(&bytes, &[]), 0)["scores"], json!([0.125]));
    bytes.push(b' ');
    let result = refuses(&bytes, "BAD_REQUEST");
    assert_eq!(result["error"]["message"], "stdin exceeds 8 MiB");
    assert!(result["id"].is_null());
}

#[test]
fn process_exposes_no_cli_commands_or_checkpoint_paths() {
    for args in [
        ["score"],
        ["train"],
        ["--checkpoint=/tmp/model.bpk"],
        ["--help"],
    ] {
        let output = run(b"", &args);
        let result = reply(&output, 2);
        assert_eq!(result["error"]["code"], "BAD_REQUEST");
    }
}
