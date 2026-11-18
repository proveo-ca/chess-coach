// SPEC: _spec/gpu-owner.md
use crate::{
    OwnerError, Result,
    json::{self, Decimal},
    policy::{Configuration, valid_config},
};
use serde::{Deserialize, Serialize};
use std::path::{Component, Path};

pub const FILE_BOUND: u64 = 512 * 1024 * 1024;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ByteRef {
    #[serde(deserialize_with = "json::safe_u64")]
    pub byte_length: u64,
    pub sha256: String,
}

impl ByteRef {
    pub fn validate(&self) -> Result<()> {
        if self.byte_length > json::SAFE_INTEGER || !json::digest(&self.sha256) {
            return Err(OwnerError("BYTE_REF"));
        }
        Ok(())
    }
    pub fn matches(&self, bytes: &[u8]) -> bool {
        self.byte_length == bytes.len() as u64 && self.sha256 == json::sha256(bytes)
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct FileExpectation {
    pub path: String,
    #[serde(deserialize_with = "json::safe_u64")]
    pub byte_length: u64,
    pub sha256: String,
}

impl FileExpectation {
    pub fn identity(&self) -> ByteRef {
        ByteRef {
            byte_length: self.byte_length,
            sha256: self.sha256.clone(),
        }
    }
    pub fn validate(&self) -> Result<()> {
        absolute(&self.path)?;
        if self.byte_length > FILE_BOUND {
            return Err(OwnerError("FILE_BOUND"));
        }
        self.identity().validate()
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Envelope {
    #[serde(deserialize_with = "json::u32_list")]
    pub cpus: Vec<u32>,
    #[serde(deserialize_with = "json::safe_u64")]
    pub cpu_quota: u64,
    pub memory_max_bytes: Decimal,
    pub aggregate_parent: String,
    #[serde(deserialize_with = "json::u32_list")]
    pub aggregate_cpus: Vec<u32>,
    #[serde(deserialize_with = "json::safe_u64")]
    pub aggregate_cpu_quota: u64,
    pub aggregate_memory_max_bytes: Decimal,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Ownership {
    pub session_id: String,
    pub attempt_id: String,
    pub container_name: String,
    pub ownership_token: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct OutsideControl {
    pub admission_receipt: FileExpectation,
    pub expected_self_envelope: Envelope,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DockerInput {
    pub executable: FileExpectation,
    pub anonymous_config_directory: String,
    pub endpoint_unix_socket: String,
    pub cgroup_parent_argument: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ObservationInput {
    pub proc_root: String,
    pub cgroup_root: String,
    pub approved_job_parent_absolute_path: String,
    pub expected_outside_control_cgroup_absolute_path: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GpuProfile {
    pub mode: String,
    #[serde(deserialize_with = "json::u32_list")]
    pub cpus: Vec<u32>,
    pub injection_inventory: FileExpectation,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct JobInput {
    pub image_id: String,
    pub runtime_closure: FileExpectation,
    pub gpu_profile: GpuProfile,
    pub state_host_source: String,
    pub job_input_json: String,
    pub job_input_ref: ByteRef,
    pub expected_descriptor_sha256: String,
    pub initial_model_id: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TelemetryInput {
    pub kind: String,
    pub executable: FileExpectation,
    pub runtime_closure: FileExpectation,
    pub expected_driver: String,
    pub query_budget_ns: Decimal,
    pub refresh_interval_ns: Decimal,
    pub scheduling_reserve_ns: Decimal,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct EvidenceInput {
    pub exclusive_packet_root: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ClosedOwnerInput {
    pub version: String,
    pub ownership: Ownership,
    pub outside_control: OutsideControl,
    pub docker: DockerInput,
    pub observation: ObservationInput,
    pub job: JobInput,
    pub cooperative: Configuration,
    pub telemetry: TelemetryInput,
    pub evidence: EvidenceInput,
}

pub type OwnerInput = ClosedOwnerInput;

pub fn absolute(value: &str) -> Result<()> {
    if value.len() > 4096
        || value.contains('\0')
        || value == "/"
        || !value.starts_with('/')
        || value.ends_with('/')
        || value.contains("//")
        || value
            .split('/')
            .skip(1)
            .any(|p| p == "." || p == ".." || p.is_empty())
        || Path::new(value)
            .components()
            .any(|c| !matches!(c, Component::RootDir | Component::Normal(_)))
    {
        return Err(OwnerError("ABSOLUTE_PATH"));
    }
    Ok(())
}

pub fn below(path: &str, parent: &str) -> bool {
    path.strip_prefix(parent)
        .is_some_and(|tail| tail.starts_with('/') && tail.len() > 1)
}

pub fn cpus(values: &[u32]) -> bool {
    !values.is_empty() && values.len() <= 12 && values.windows(2).all(|w| w[0] < w[1])
}

impl ClosedOwnerInput {
    pub fn parse(bytes: &[u8], expected_sha256: &str) -> Result<Self> {
        if bytes.len() > 262_144 {
            return Err(OwnerError("MANIFEST_BOUND"));
        }
        if !json::digest(expected_sha256) || json::sha256(bytes) != expected_sha256 {
            return Err(OwnerError("MANIFEST_SHA256"));
        }
        let input: Self = json::decode(bytes, 262_144)?;
        input.validate()?;
        Ok(input)
    }
    pub fn validate(&self) -> Result<()> {
        let o = &self.ownership;
        if self.version != "chess-coach.gpu-owner.v1"
            || !json::identifier(&o.session_id, 64)
            || !json::identifier(&o.attempt_id, 32)
            || !json::identifier(&o.container_name, 128)
            || !o.container_name.as_bytes()[0].is_ascii_alphanumeric()
            || o.ownership_token.len() != 32
            || !o
                .ownership_token
                .bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
        {
            return Err(OwnerError("OWNERSHIP"));
        }
        for file in [
            &self.outside_control.admission_receipt,
            &self.docker.executable,
            &self.job.runtime_closure,
            &self.job.gpu_profile.injection_inventory,
            &self.telemetry.executable,
            &self.telemetry.runtime_closure,
        ] {
            file.validate()?;
        }
        for path in [
            &self.docker.anonymous_config_directory,
            &self.docker.endpoint_unix_socket,
            &self.observation.proc_root,
            &self.observation.cgroup_root,
            &self.observation.approved_job_parent_absolute_path,
            &self
                .observation
                .expected_outside_control_cgroup_absolute_path,
            &self.job.state_host_source,
            &self.evidence.exclusive_packet_root,
            &self.outside_control.expected_self_envelope.aggregate_parent,
        ] {
            absolute(path)?;
        }
        if self.evidence.exclusive_packet_root == self.job.state_host_source
            || below(
                &self.evidence.exclusive_packet_root,
                &self.job.state_host_source,
            )
        {
            return Err(OwnerError("EVIDENCE_STATE_OVERLAP"));
        }
        let slice = &self.docker.cgroup_parent_argument;
        if !slice.ends_with(".slice")
            || slice.len() > 128
            || !slice
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b"_.-".contains(&b))
        {
            return Err(OwnerError("CGROUP_ARGUMENT"));
        }
        let obs = &self.observation;
        if obs.approved_job_parent_absolute_path
            == obs.expected_outside_control_cgroup_absolute_path
            || below(
                &obs.approved_job_parent_absolute_path,
                &obs.expected_outside_control_cgroup_absolute_path,
            )
            || below(
                &obs.expected_outside_control_cgroup_absolute_path,
                &obs.approved_job_parent_absolute_path,
            )
        {
            return Err(OwnerError("CONTROL_OVERLAP"));
        }
        let e = &self.outside_control.expected_self_envelope;
        let job_cpus = &self.job.gpu_profile.cpus;
        if !cpus(&e.cpus)
            || !cpus(&e.aggregate_cpus)
            || !cpus(job_cpus)
            || job_cpus.len() != 4
            || !e
                .cpus
                .iter()
                .chain(job_cpus)
                .all(|c| e.aggregate_cpus.contains(c))
            || e.cpus.iter().any(|c| job_cpus.contains(c))
            || e.cpu_quota == 0
            || e.aggregate_cpu_quota > 1_200_000
            || e.cpu_quota.saturating_add(400_000) > e.aggregate_cpu_quota
            || e.memory_max_bytes.0 <= 0
            || e.aggregate_memory_max_bytes.0 > 24_000_000_000
            || i128::from(e.memory_max_bytes.0) + 8_589_934_592
                > i128::from(e.aggregate_memory_max_bytes.0)
            || !below(
                &obs.expected_outside_control_cgroup_absolute_path,
                &e.aggregate_parent,
            )
            || !(below(&obs.approved_job_parent_absolute_path, &e.aggregate_parent)
                || obs.approved_job_parent_absolute_path == e.aggregate_parent)
        {
            return Err(OwnerError("ENVELOPE"));
        }
        let job = &self.job;
        if job.state_host_source.contains(',')
            || !job.image_id.starts_with("sha256:")
            || !json::digest(&job.image_id[7..])
            || job.gpu_profile.mode != "legacy-nvidia-device-request.v1"
            || job.job_input_json.len() > 65_536
            || !job.job_input_ref.matches(job.job_input_json.as_bytes())
            || !json::digest(&job.expected_descriptor_sha256)
            || !json::digest(&job.initial_model_id)
        {
            return Err(OwnerError("JOB_INPUT"));
        }
        job.job_input_ref.validate()?;
        let t = &self.telemetry;
        if !valid_config(&self.cooperative)
            || t.kind != "registered-nvidia-smi-query.v1"
            || t.expected_driver.is_empty()
            || t.expected_driver.len() > 128
            || !t
                .expected_driver
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b"._-".contains(&b))
            || t.query_budget_ns.0 <= 0
            || t.refresh_interval_ns.0 <= 0
            || t.scheduling_reserve_ns.0 <= 0
            || i128::from(t.query_budget_ns.0)
                + i128::from(t.refresh_interval_ns.0)
                + i128::from(t.scheduling_reserve_ns.0)
                >= i128::from(self.cooperative.sample_period_ns.0)
        {
            return Err(OwnerError("TELEMETRY_CONFIGURATION"));
        }
        Ok(())
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Admission {
    pub version: String,
    pub expected_self_envelope: Envelope,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RuntimeClosure {
    pub version: String,
    pub image_id: String,
    pub selected_uuid: String,
    pub profile_mode: String,
    pub input_sha256: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TelemetryClosure {
    pub version: String,
    pub executable: ByteRef,
    pub expected_driver: String,
    pub selected_uuid: String,
}
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Library {
    pub container_path: String,
    pub bytes: ByteRef,
}
#[derive(Clone, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct InspectMount {
    pub kind: String,
    pub source: String,
    pub destination: String,
    pub writable: bool,
    pub propagation: String,
}
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Injection {
    pub version: String,
    pub mode: String,
    pub selected_uuid: String,
    pub devices: Vec<String>,
    pub libraries: Vec<Library>,
    pub inspect_mounts: Vec<InspectMount>,
}

impl Injection {
    pub fn validate(&self, uuid: &str) -> Result<()> {
        if self.version != "chess-coach.gpu-injection.v1"
            || self.mode != "legacy"
            || self.selected_uuid != uuid
            || self.devices.is_empty()
            || self.devices.len() > 16
            || self.libraries.is_empty()
            || self.libraries.len() > 256
            || self.inspect_mounts.len() > 256
        {
            return Err(OwnerError("INJECTION"));
        }
        let mut devices = std::collections::HashSet::new();
        for path in &self.devices {
            absolute(path)?;
            if !path.starts_with("/dev/nvidia") || path[11..].contains('/') || !devices.insert(path)
            {
                return Err(OwnerError("INJECTION_DEVICE"));
            }
        }
        let mut paths = std::collections::HashSet::new();
        for lib in &self.libraries {
            absolute(&lib.container_path)?;
            lib.bytes.validate()?;
            if lib.bytes.byte_length == 0 || !paths.insert(&lib.container_path) {
                return Err(OwnerError("INJECTION_LIBRARY"));
            }
        }
        if !self
            .libraries
            .iter()
            .any(|l| l.container_path.ends_with("/libcuda.so.1"))
        {
            return Err(OwnerError("INJECTION_LIBCUDA"));
        }
        let mut destinations = std::collections::HashSet::new();
        for m in &self.inspect_mounts {
            absolute(&m.source)?;
            absolute(&m.destination)?;
            if m.kind != "bind"
                || m.writable
                || m.propagation != "rprivate"
                || !paths.contains(&m.destination)
                || !destinations.insert(&m.destination)
                || ["/state", "/tmp", "/home", "/root", "/run", "/var"]
                    .iter()
                    .any(|p| m.destination == *p || below(&m.destination, p))
            {
                return Err(OwnerError("INJECTION_MOUNT"));
            }
        }
        Ok(())
    }
}
