// SPEC: _spec/gpu-owner.md
use crate::{
    OwnerError, Result,
    input::{Injection, OwnerInput},
    json,
};
use serde_json::Value;

pub const OWNERSHIP_LABEL: &str = "chess-coach.gpu-owner.ownership";

pub fn prefix(input: &OwnerInput) -> Vec<String> {
    vec![
        "--config".into(),
        input.docker.anonymous_config_directory.clone(),
        "--host".into(),
        format!("unix://{}", input.docker.endpoint_unix_socket),
    ]
}
pub fn cpuset(cpus: &[u32]) -> String {
    cpus.iter()
        .map(u32::to_string)
        .collect::<Vec<_>>()
        .join(",")
}

pub fn create(input: &OwnerInput) -> Vec<String> {
    let mut args = prefix(input);
    args.extend(
        [
            "create",
            "--pull=never",
            "--interactive",
            "--network=none",
            "--read-only",
            "--user=1000:1000",
            "--cpu-period=100000",
            "--cpu-quota=400000",
        ]
        .map(String::from),
    );
    args.push(format!(
        "--cpuset-cpus={}",
        cpuset(&input.job.gpu_profile.cpus)
    ));
    args.extend(
        [
            "--memory=8589934592",
            "--memory-swap=8589934592",
            "--pids-limit=512",
            "--cap-drop=ALL",
            "--security-opt=no-new-privileges",
            "--restart=no",
            "--ipc=private",
            "--cgroupns=private",
            "--log-driver=none",
            "--ulimit=nofile=256:256",
            "--ulimit=fsize=67108864:67108864",
            "--tmpfs=/tmp:rw,nosuid,nodev,noexec,size=2147483648,nr_inodes=16384",
            "--runtime=nvidia",
        ]
        .map(String::from),
    );
    args.push(format!("--name={}", input.ownership.container_name));
    args.push(format!(
        "--label={OWNERSHIP_LABEL}={}",
        input.ownership.ownership_token
    ));
    args.push(format!(
        "--cgroup-parent={}",
        input.docker.cgroup_parent_argument
    ));
    args.push(format!(
        "--gpus=driver=nvidia,device={}",
        input.cooperative.selected_uuid
    ));
    args.push(format!(
        "--env=NVIDIA_VISIBLE_DEVICES={}",
        input.cooperative.selected_uuid
    ));
    args.push("--env=NVIDIA_DRIVER_CAPABILITIES=compute".into());
    args.push(format!(
        "--mount=type=bind,source={},target=/state,bind-propagation=rprivate",
        input.job.state_host_source
    ));
    args.extend([
        "--entrypoint=/sbin/chess-init".into(),
        input.job.image_id.clone(),
        "-g".into(),
        "--".into(),
        "/usr/local/bin/bun".into(),
        "--no-env-file".into(),
        "--no-install".into(),
        "/app/packages/runtime/src/gpu-job.ts".into(),
        input.ownership.session_id.clone(),
    ]);
    args
}
pub fn inspect(input: &OwnerInput, id: &str) -> Vec<String> {
    let mut args = prefix(input);
    args.extend([
        "inspect".into(),
        "--type=container".into(),
        "--format={{json .}}".into(),
        id.into(),
    ]);
    args
}
pub fn start(input: &OwnerInput, id: &str) -> Vec<String> {
    let mut args = prefix(input);
    args.extend([
        "start".into(),
        "--attach".into(),
        "--interactive".into(),
        id.into(),
    ]);
    args
}
pub fn remove(input: &OwnerInput, id: &str, force: bool) -> Vec<String> {
    let mut args = prefix(input);
    args.push("rm".into());
    if force {
        args.push("--force".into());
    }
    args.push(id.into());
    args
}
pub fn id(bytes: &[u8]) -> Result<String> {
    if bytes.len() != 65 || bytes[64] != b'\n' {
        return Err(OwnerError("CONTAINER_ID"));
    }
    let id = std::str::from_utf8(&bytes[..64]).map_err(|_| OwnerError("CONTAINER_ID"))?;
    if !json::digest(id) {
        return Err(OwnerError("CONTAINER_ID"));
    }
    Ok(id.into())
}

#[derive(Clone, Debug)]
pub struct OwnedContainer {
    pub id: String,
    pub pid: u32,
    pub running: bool,
}

fn field<'a>(v: &'a Value, key: &str) -> Result<&'a Value> {
    v.get(key).ok_or(OwnerError("INSPECT_FIELD"))
}
fn equal(v: &Value, key: &str, expected: Value) -> Result<()> {
    if field(v, key)? != &expected {
        return Err(OwnerError("INSPECT_C2"));
    }
    Ok(())
}
fn empty(v: &Value, key: &str) -> Result<()> {
    if let Some(value) = v.get(key)
        && !value.is_null()
        && value.as_array().is_none_or(|a| !a.is_empty())
    {
        return Err(OwnerError("INSPECT_EXTRA"));
    }
    Ok(())
}

fn closed(v: &Value, keys: &[&str]) -> Result<()> {
    let fields = v.as_object().ok_or(OwnerError("INSPECT_OBJECT"))?;
    if fields.keys().any(|key| !keys.contains(&key.as_str())) {
        return Err(OwnerError("INSPECT_EXTRA_OPTION"));
    }
    Ok(())
}

pub fn ownership(
    bytes: &[u8],
    input: &OwnerInput,
    expected_id: Option<&str>,
) -> Result<(OwnedContainer, Value)> {
    let v: Value = json::decode(bytes, 1024 * 1024)?;
    let id = field(&v, "Id")?.as_str().ok_or(OwnerError("INSPECT_ID"))?;
    if !json::digest(id)
        || expected_id.is_some_and(|expected| expected != id)
        || field(&v, "Image")?.as_str() != Some(&input.job.image_id)
        || v.pointer(&format!("/Config/Labels/{OWNERSHIP_LABEL}"))
            .and_then(Value::as_str)
            != Some(&input.ownership.ownership_token)
    {
        return Err(OwnerError("NOT_OWNED"));
    }
    if let Some(name) = v.get("Name")
        && name.as_str() != Some(&format!("/{}", input.ownership.container_name))
    {
        return Err(OwnerError("INSPECT_NAME"));
    }
    let state = field(&v, "State")?;
    let pid = field(state, "Pid")?
        .as_u64()
        .and_then(|p| u32::try_from(p).ok())
        .ok_or(OwnerError("INSPECT_PID"))?;
    let running = field(state, "Running")?
        .as_bool()
        .ok_or(OwnerError("INSPECT_RUNNING"))?;
    if running && pid == 0 {
        return Err(OwnerError("INSPECT_PID"));
    }
    Ok((
        OwnedContainer {
            id: id.into(),
            pid,
            running,
        },
        v,
    ))
}

pub fn validate_c2(v: &Value, input: &OwnerInput, injection: &Injection) -> Result<()> {
    let h = field(v, "HostConfig")?;
    let c = field(v, "Config")?;
    for key in [
        "CpuShares",
        "NanoCpus",
        "CpuRealtimePeriod",
        "CpuRealtimeRuntime",
        "MemoryReservation",
        "OomScoreAdj",
    ] {
        if h.get(key).is_some_and(|v| v.as_i64() != Some(0)) {
            return Err(OwnerError("INSPECT_EXTRA_OPTION"));
        }
    }
    for key in ["OomKillDisable", "Init"] {
        if h.get(key)
            .is_some_and(|v| !v.is_null() && v != &Value::Bool(false))
        {
            return Err(OwnerError("INSPECT_EXTRA_OPTION"));
        }
    }
    for key in ["Sysctls", "StorageOpt"] {
        if h.get(key)
            .is_some_and(|v| !v.is_null() && v != &serde_json::json!({}))
        {
            return Err(OwnerError("INSPECT_EXTRA_OPTION"));
        }
    }
    for (key, value) in [
        ("CpuPeriod", 100000i64),
        ("CpuQuota", 400000),
        ("Memory", 8589934592),
        ("MemorySwap", 8589934592),
        ("PidsLimit", 512),
    ] {
        equal(h, key, value.into())?;
    }
    for (key, value) in [
        ("NetworkMode", "none"),
        ("IpcMode", "private"),
        ("CgroupnsMode", "private"),
        ("Runtime", "nvidia"),
    ] {
        equal(h, key, value.into())?;
    }
    equal(
        h,
        "CgroupParent",
        input.docker.cgroup_parent_argument.clone().into(),
    )?;
    let inspected_cpus = field(h, "CpusetCpus")?
        .as_str()
        .ok_or(OwnerError("INSPECT_CPUSET"))?;
    if crate::observe::parse_cpuset(inspected_cpus)? != input.job.gpu_profile.cpus {
        return Err(OwnerError("INSPECT_CPUSET"));
    }
    for key in ["Privileged", "PublishAllPorts", "AutoRemove"] {
        equal(h, key, false.into())?;
    }
    equal(h, "ReadonlyRootfs", true.into())?;
    equal(h, "CapDrop", serde_json::json!(["ALL"]))?;
    equal(h, "SecurityOpt", serde_json::json!(["no-new-privileges"]))?;
    equal(field(h, "RestartPolicy")?, "Name", "no".into())?;
    equal(field(h, "RestartPolicy")?, "MaximumRetryCount", 0.into())?;
    equal(field(h, "LogConfig")?, "Type", "none".into())?;
    equal(field(h, "LogConfig")?, "Config", serde_json::json!({}))?;
    for key in [
        "Devices",
        "DeviceCgroupRules",
        "CapAdd",
        "GroupAdd",
        "VolumesFrom",
        "Links",
        "ExtraHosts",
        "Dns",
        "DnsOptions",
        "DnsSearch",
    ] {
        empty(h, key)?;
    }
    for key in [
        "PidMode",
        "UTSMode",
        "UsernsMode",
        "ContainerIDFile",
        "VolumeDriver",
    ] {
        if let Some(value) = h.get(key)
            && value.as_str() != Some("")
        {
            return Err(OwnerError("INSPECT_NAMESPACE"));
        }
    }
    if h.get("PortBindings")
        .is_some_and(|p| !p.is_null() && p != &serde_json::json!({}))
    {
        return Err(OwnerError("INSPECT_PORTS"));
    }
    equal(
        h,
        "DeviceRequests",
        serde_json::json!([{ "Driver":"nvidia","Count":0,"DeviceIDs":[input.cooperative.selected_uuid],"Capabilities":[["gpu"]],"Options":{} }]),
    )?;
    equal(
        h,
        "Tmpfs",
        serde_json::json!({"/tmp":"rw,nosuid,nodev,noexec,size=2147483648,nr_inodes=16384"}),
    )?;
    let ulimits = field(h, "Ulimits")?
        .as_array()
        .ok_or(OwnerError("INSPECT_ULIMITS"))?;
    if ulimits.len() != 2
        || !ulimits.contains(&serde_json::json!({"Name":"nofile","Soft":256,"Hard":256}))
        || !ulimits.contains(&serde_json::json!({"Name":"fsize","Soft":67108864,"Hard":67108864}))
    {
        return Err(OwnerError("INSPECT_ULIMITS"));
    }
    equal(c, "User", "1000:1000".into())?;
    equal(c, "OpenStdin", true.into())?;
    equal(c, "Tty", false.into())?;
    equal(c, "Entrypoint", serde_json::json!(["/sbin/chess-init"]))?;
    equal(
        c,
        "Cmd",
        serde_json::json!([
            "-g",
            "--",
            "/usr/local/bin/bun",
            "--no-env-file",
            "--no-install",
            "/app/packages/runtime/src/gpu-job.ts",
            input.ownership.session_id
        ]),
    )?;
    let env = field(c, "Env")?
        .as_array()
        .ok_or(OwnerError("INSPECT_ENV"))?;
    let visible = format!("NVIDIA_VISIBLE_DEVICES={}", input.cooperative.selected_uuid);
    if env.len() != 2
        || !env.contains(&Value::String(visible))
        || !env.contains(&Value::String("NVIDIA_DRIVER_CAPABILITIES=compute".into()))
    {
        return Err(OwnerError("INSPECT_ENV"));
    }
    if c.get("Volumes")
        .is_some_and(|v| !v.is_null() && v != &serde_json::json!({}))
    {
        return Err(OwnerError("INSPECT_VOLUMES"));
    }
    empty(h, "Binds")?;
    let requested = field(h, "Mounts")?
        .as_array()
        .ok_or(OwnerError("INSPECT_MOUNTS"))?;
    if requested.len() != 1 {
        return Err(OwnerError("INSPECT_MOUNTS"));
    }
    let m = &requested[0];
    closed(m, &["Type", "Source", "Target", "ReadOnly", "BindOptions"])?;
    equal(m, "Type", "bind".into())?;
    equal(m, "Source", input.job.state_host_source.clone().into())?;
    equal(m, "Target", "/state".into())?;
    if m.get("ReadOnly").is_some_and(|v| v != &Value::Bool(false)) {
        return Err(OwnerError("INSPECT_STATE"));
    }
    let bind = field(m, "BindOptions")?;
    closed(bind, &["Propagation"])?;
    equal(bind, "Propagation", "rprivate".into())?;
    let mounts = field(v, "Mounts")?
        .as_array()
        .ok_or(OwnerError("INSPECT_MOUNTS"))?;
    let mut state = false;
    let mut seen = std::collections::HashSet::new();
    for m in mounts {
        let destination = field(m, "Destination")?
            .as_str()
            .ok_or(OwnerError("INSPECT_MOUNT"))?;
        if !seen.insert(destination) {
            return Err(OwnerError("INSPECT_MOUNT"));
        }
        if destination == "/state" {
            equal(m, "Type", "bind".into())?;
            equal(m, "Source", input.job.state_host_source.clone().into())?;
            equal(m, "RW", true.into())?;
            equal(m, "Propagation", "rprivate".into())?;
            state = true;
        } else {
            let approved = injection
                .inspect_mounts
                .iter()
                .find(|m| m.destination == destination)
                .ok_or(OwnerError("INSPECT_EXTRA_MOUNT"))?;
            equal(m, "Type", approved.kind.clone().into())?;
            equal(m, "Source", approved.source.clone().into())?;
            equal(m, "RW", approved.writable.into())?;
            equal(m, "Propagation", approved.propagation.clone().into())?;
        }
    }
    if !state || mounts.len() != injection.inspect_mounts.len() + 1 {
        return Err(OwnerError("INSPECT_MOUNTS"));
    }
    Ok(())
}
