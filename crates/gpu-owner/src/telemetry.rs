// SPEC: _spec/gpu-owner.md
use crate::{
    OwnerError, Result, input::TelemetryInput, json::Decimal, policy::Sample, process::Process,
};

pub fn argv(uuid: &str) -> Vec<String> {
    vec![
        format!("--id={uuid}"),
        "--query-gpu=uuid,driver_version,memory.total,memory.used,memory.free".into(),
        "--format=csv,noheader,nounits".into(),
    ]
}

pub fn decode(bytes: &[u8], uuid: &str, driver: &str, q0: i64) -> Result<Sample> {
    if bytes.is_empty()
        || bytes.len() > 4096
        || !bytes.is_ascii()
        || !bytes.ends_with(b"\n")
        || bytes[..bytes.len() - 1].contains(&b'\n')
        || bytes.contains(&b'\r')
    {
        return Err(OwnerError("TELEMETRY_LINE"));
    }
    let text = std::str::from_utf8(&bytes[..bytes.len() - 1])
        .map_err(|_| OwnerError("TELEMETRY_ASCII"))?;
    let fields: Vec<_> = text.split(',').map(|s| s.trim_matches(' ')).collect();
    if fields.len() != 5 || fields[0] != uuid || fields[1] != driver {
        return Err(OwnerError("TELEMETRY_IDENTITY"));
    }
    fn mib(value: &str) -> Result<i64> {
        if value.is_empty()
            || (value.len() > 1 && value.starts_with('0'))
            || !value.bytes().all(|b| b.is_ascii_digit())
        {
            return Err(OwnerError("TELEMETRY_INTEGER"));
        }
        value
            .parse::<i64>()
            .ok()
            .and_then(|n| n.checked_mul(1_048_576))
            .ok_or(OwnerError("TELEMETRY_RANGE"))
    }
    let total = mib(fields[2])?;
    let used = mib(fields[3])?;
    let free = mib(fields[4])?;
    if q0 < 0 || total <= 0 || used > total || free > total {
        return Err(OwnerError("TELEMETRY_CAPACITY"));
    }
    Ok(Sample {
        uuid: uuid.into(),
        free_bytes: Decimal(free),
        total_bytes: Decimal(total),
        observed_boottime_ns: Decimal(q0),
    })
}

pub fn finish(
    process: &Process,
    input: &TelemetryInput,
    uuid: &str,
    q0: i64,
    q1: i64,
) -> Result<Sample> {
    if !process.natural_clean()
        || q1 < q0
        || i128::from(q1) >= i128::from(q0) + i128::from(input.query_budget_ns.0)
    {
        return Err(OwnerError("TELEMETRY_QUERY"));
    }
    decode(&process.stdout.prefix, uuid, &input.expected_driver, q0)
}

pub fn next_query(q0: i64, next_check: i64, input: &TelemetryInput) -> Result<i64> {
    let scheduled = i128::from(q0) + i128::from(input.refresh_interval_ns.0);
    let latest = i128::from(next_check)
        - i128::from(input.query_budget_ns.0)
        - i128::from(input.scheduling_reserve_ns.0);
    if scheduled > latest || scheduled > i128::from(i64::MAX) {
        return Err(OwnerError("TELEMETRY_SCHEDULE"));
    }
    Ok(scheduled as i64)
}
