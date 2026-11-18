// SPEC: _spec/host-entrypoint.puml
#![forbid(unsafe_code)]

#[cfg(not(target_os = "linux"))]
compile_error!("host facts require Linux");

mod cgroup;
mod http;
mod projection;
mod socket;

use cgroup::CgroupFacts;
use http::{Receipt, Request};
use projection::{InfoFacts, VersionFacts};
use serde::Serialize;
use socket::{PinnedSocket, ProbeError};
use std::path::Path;

const ENDPOINTS: [(&str, &[&str]); 2] = [
    ("/run/docker.sock", &["run", "docker.sock"]),
    (
        "/run/user/1000/docker.sock",
        &["run", "user", "1000", "docker.sock"],
    ),
];
const REPORT_BYTES: usize = 131_072;

#[derive(Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
struct Caller {
    uid: u32,
    effective_uid: u32,
    gid: u32,
    effective_gid: u32,
}

#[derive(Serialize)]
struct EndpointObservation {
    path: &'static str,
    status: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Report {
    version: &'static str,
    execution_realm: &'static str,
    scope: &'static str,
    status: &'static str,
    caller: Caller,
    endpoint_candidates: Vec<EndpointObservation>,
    query_endpoint: Option<&'static str>,
    queries: Vec<Receipt>,
    daemon_version: Option<VersionFacts>,
    info: Option<InfoFacts>,
    cgroup_observation: CgroupFacts,
    error: Option<&'static str>,
    runtime_admission_qualified: bool,
    gpu_learning_required: bool,
    gpu_qualification: &'static str,
    provisioning_authorized: bool,
    training_authorized: bool,
    training_ready: bool,
}

impl Report {
    fn new(caller: Caller) -> Self {
        Self {
            version: "chess-coach.host-docker-runtime-facts.v2",
            execution_realm: "OPERATOR_ASSERTED_HOST_UNQUALIFIED",
            scope: "FIXED_LOCAL_DOCKER_API_AND_SELF_CGROUP_METADATA_ONLY",
            status: "PASS_METADATA_ONLY",
            caller,
            endpoint_candidates: Vec::new(),
            query_endpoint: None,
            queries: Vec::new(),
            daemon_version: None,
            info: None,
            cgroup_observation: CgroupFacts::default(),
            error: None,
            runtime_admission_qualified: false,
            gpu_learning_required: true,
            gpu_qualification: "NOT_QUALIFIED",
            provisioning_authorized: false,
            training_authorized: false,
            training_ready: false,
        }
    }

    pub fn passed(&self) -> bool {
        self.status == "PASS_METADATA_ONLY"
    }
}

fn selected_socket(root: &Path, report: &mut Report) -> Result<PinnedSocket, &'static str> {
    let mut selected = None;
    let mut count = 0;
    let mut unsafe_endpoint = false;
    for (path, components) in ENDPOINTS {
        let status = match PinnedSocket::open(root, components) {
            Ok(pin) => {
                count += 1;
                selected = Some((path, pin));
                "SOCKET"
            }
            Err(ProbeError::Absent) => "ABSENT",
            Err(ProbeError::Unsafe) => {
                unsafe_endpoint = true;
                "UNSAFE"
            }
            Err(ProbeError::Access) => {
                unsafe_endpoint = true;
                "INACCESSIBLE_OR_UNSAFE"
            }
        };
        report
            .endpoint_candidates
            .push(EndpointObservation { path, status });
    }
    if unsafe_endpoint {
        return Err("UNSAFE_ENDPOINT");
    }
    if count > 1 {
        return Err("AMBIGUOUS_ENDPOINT");
    }
    let (path, pin) = selected.ok_or("NO_ENDPOINT")?;
    report.query_endpoint = Some(path);
    Ok(pin)
}

fn collect_into(root: &Path, report: &mut Report) -> Result<(), &'static str> {
    let caller = report.caller;
    if [
        caller.uid,
        caller.effective_uid,
        caller.gid,
        caller.effective_gid,
    ]
    .iter()
    .any(|id| *id != 1000)
    {
        return Err("CALLER_IDENTITY");
    }
    let socket = selected_socket(root, report)?;
    let _cgroup_guard = cgroup::collect(root, &mut report.cgroup_observation)?;
    let version = http::get(&socket, Request::Version, projection::parse_version);
    let error = version.receipt.error;
    report.daemon_version = version.projection;
    report.queries.push(version.receipt);
    if let Some(error) = error {
        return Err(error);
    }
    let info = http::get(&socket, Request::Info, projection::parse_info);
    let error = info.receipt.error;
    report.info = info.projection;
    report.queries.push(info.receipt);
    if let Some(error) = error {
        return Err(error);
    }
    Ok(())
}

fn collect_at(root: &Path, caller: Caller) -> Report {
    let mut result = Report::new(caller);
    if let Err(error) = collect_into(root, &mut result) {
        result.status = "BLOCKED";
        result.error = Some(error);
    }
    result
}

pub fn collect() -> Report {
    let caller = Caller {
        uid: rustix::process::getuid().as_raw(),
        effective_uid: rustix::process::geteuid().as_raw(),
        gid: rustix::process::getgid().as_raw(),
        effective_gid: rustix::process::getegid().as_raw(),
    };
    collect_at(Path::new("/"), caller)
}

pub fn encode_report(report: &Report) -> Result<Vec<u8>, &'static str> {
    let mut bytes = serde_json::to_vec(report).map_err(|_| "REPORT_SERIALIZATION")?;
    if bytes.len() >= REPORT_BYTES {
        return Err("REPORT_BYTE_BOUND");
    }
    bytes.push(b'\n');
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::os::unix::net::UnixListener;
    use std::time::Duration;

    fn caller() -> Caller {
        Caller {
            uid: 1000,
            effective_uid: 1000,
            gid: 1000,
            effective_gid: 1000,
        }
    }

    fn root() -> tempfile::TempDir {
        let root = tempfile::tempdir_in("/tmp/opencode").unwrap();
        std::fs::create_dir_all(root.path().join("run/user/1000")).unwrap();
        cgroup::fixture(root.path());
        root
    }

    #[test]
    fn collector_fixed_paths_and_report_limit_match_independent_literals() {
        assert_eq!(
            ENDPOINTS,
            [
                ("/run/docker.sock", &["run", "docker.sock"][..]),
                (
                    "/run/user/1000/docker.sock",
                    &["run", "user", "1000", "docker.sock"][..]
                )
            ]
        );
        assert_eq!(REPORT_BYTES, 131_072);
    }

    #[test]
    fn collector_wrong_caller_stops_before_any_filesystem_or_socket_work() {
        for index in 0..4 {
            let mut ids = [1000; 4];
            ids[index] = 0;
            let result = collect_at(
                Path::new("/ABSENT_SYNTHETIC_ROOT"),
                Caller {
                    uid: ids[0],
                    effective_uid: ids[1],
                    gid: ids[2],
                    effective_gid: ids[3],
                },
            );
            assert_eq!(result.error, Some("CALLER_IDENTITY"));
            assert!(result.endpoint_candidates.is_empty());
            assert!(result.queries.is_empty());
        }
    }

    #[test]
    fn collector_neither_both_and_unsafe_endpoints_never_connect() {
        let root = root();
        assert_eq!(collect_at(root.path(), caller()).error, Some("NO_ENDPOINT"));
        let first = UnixListener::bind(root.path().join("run/docker.sock")).unwrap();
        let second = UnixListener::bind(root.path().join("run/user/1000/docker.sock")).unwrap();
        first.set_nonblocking(true).unwrap();
        second.set_nonblocking(true).unwrap();
        let result = collect_at(root.path(), caller());
        assert_eq!(result.error, Some("AMBIGUOUS_ENDPOINT"));
        assert!(result.query_endpoint.is_none());
        assert!(first.accept().is_err());
        assert!(second.accept().is_err());
        drop(second);
        std::fs::remove_file(root.path().join("run/user/1000/docker.sock")).unwrap();
        std::os::unix::fs::symlink(
            "/UNSAFE_SYNTHETIC",
            root.path().join("run/user/1000/docker.sock"),
        )
        .unwrap();
        assert_eq!(
            collect_at(root.path(), caller()).error,
            Some("UNSAFE_ENDPOINT")
        );
        assert!(first.accept().is_err());
    }

    fn fake_server(
        listener: UnixListener,
        fail_at: Option<usize>,
    ) -> std::thread::JoinHandle<usize> {
        std::thread::spawn(move || {
            listener.set_nonblocking(true).unwrap();
            let deadline = std::time::Instant::now() + Duration::from_secs(2);
            let mut handled = 0;
            for (index, path) in ["/version", "/info"].into_iter().enumerate() {
                let mut stream = loop {
                    match listener.accept() {
                        Ok((stream, _)) => break stream,
                        Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                            if std::time::Instant::now() >= deadline {
                                return handled;
                            }
                            std::thread::sleep(Duration::from_millis(1));
                        }
                        Err(error) => panic!("synthetic listener failure: {error}"),
                    }
                };
                stream
                    .set_read_timeout(Some(Duration::from_secs(1)))
                    .unwrap();
                let mut request = Vec::new();
                while !request.ends_with(b"\r\n\r\n") {
                    let mut byte = [0];
                    stream.read_exact(&mut byte).unwrap();
                    request.push(byte[0]);
                    assert!(request.len() <= 512);
                }
                assert!(request.starts_with(format!("GET {path} HTTP/1.0\r\n").as_bytes()));
                let body = if fail_at == Some(index) {
                    b"CANARY_ERROR_BODY".as_slice()
                } else if index == 0 {
                    br#"{"Version":"29.9.2","ApiVersion":"1.54","MinAPIVersion":"1.44","Os":"linux","Arch":"amd64","KernelVersion":"synthetic","OtherSecret":"CANARY_SECRET"}"#.as_slice()
                } else {
                    br#"{"OSType":"linux","Architecture":"x86_64","KernelVersion":"synthetic","NCPU":16,"MemTotal":40000000000,"CgroupDriver":"systemd","CgroupVersion":"2","DefaultRuntime":"runc","SecurityOptions":["name=seccomp"],"Runtimes":{"runc":{"path":"CANARY_RUNTIME_SECRET"}},"DockerRootDir":"CANARY_SECRET"}"#.as_slice()
                };
                let header = format!(
                    "HTTP/1.0 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n",
                    body.len()
                );
                stream.write_all(header.as_bytes()).unwrap();
                stream.write_all(body).unwrap();
                handled += 1;
                if fail_at == Some(index) {
                    std::thread::sleep(Duration::from_millis(20));
                    assert!(
                        matches!(listener.accept(), Err(error) if error.kind() == std::io::ErrorKind::WouldBlock)
                    );
                    return handled;
                }
            }
            handled
        })
    }

    #[test]
    fn collector_synthetic_unix_e2e_serializes_only_safe_metadata_and_false_gates() {
        for path in ["run/docker.sock", "run/user/1000/docker.sock"] {
            let root = root();
            let listener = UnixListener::bind(root.path().join(path)).unwrap();
            let server = fake_server(listener, None);
            let result = collect_at(root.path(), caller());
            let bytes = encode_report(&result).unwrap();
            let encoded = String::from_utf8(bytes).unwrap();
            assert!(result.passed(), "{}", result.error.unwrap_or("UNKNOWN"));
            assert_eq!(server.join().unwrap(), 2);
            assert!(!encoded.contains("CANARY"));
            assert!(encoded.contains("\"trainingReady\":false"));
            assert!(encoded.contains("\"runtimeAdmissionQualified\":false"));
            assert!(encoded.contains("\"provisioningAuthorized\":false"));
            assert!(encoded.contains("\"trainingAuthorized\":false"));
            assert!(encoded.contains("NOT_QUALIFIED"));
            assert_eq!(result.queries.len(), 2);
        }
    }

    #[test]
    fn collector_first_failure_prevents_info_and_later_failure_retains_version() {
        for fail_at in [0, 1] {
            let root = root();
            let listener = UnixListener::bind(root.path().join("run/docker.sock")).unwrap();
            let server = fake_server(listener, Some(fail_at));
            let result = collect_at(root.path(), caller());
            assert!(!result.passed());
            assert_eq!(server.join().unwrap(), fail_at + 1);
            assert_eq!(result.queries.len(), fail_at + 1);
            assert_eq!(result.daemon_version.is_some(), fail_at == 1);
            let encoded = String::from_utf8(encode_report(&result).unwrap()).unwrap();
            assert!(!encoded.contains("CANARY"));
        }
    }

    #[test]
    fn collector_cgroup_failure_preserves_partial_facts_without_connecting() {
        let root = root();
        let listener = UnixListener::bind(root.path().join("run/docker.sock")).unwrap();
        listener.set_nonblocking(true).unwrap();
        std::fs::write(root.path().join("proc/self/mountinfo"), vec![b'x'; 262_145]).unwrap();
        let result = collect_at(root.path(), caller());
        assert_eq!(result.error, Some("CGROUP_BYTE_BOUND"));
        assert!(result.queries.is_empty());
        assert!(listener.accept().is_err());
        assert!(
            String::from_utf8(encode_report(&result).unwrap())
                .unwrap()
                .contains("synthetic-self")
        );
    }

    #[test]
    fn collector_mount_binding_failure_prevents_docker_requests() {
        let root = root();
        let listener = UnixListener::bind(root.path().join("run/docker.sock")).unwrap();
        listener.set_nonblocking(true).unwrap();
        std::fs::write(root.path().join("proc/self/mountinfo"), "").unwrap();
        let result = collect_at(root.path(), caller());
        assert_eq!(result.error, Some("CGROUP_MOUNT_NOT_FOUND"));
        assert!(result.queries.is_empty());
        assert!(listener.accept().is_err());
        let encoded = String::from_utf8(encode_report(&result).unwrap()).unwrap();
        assert!(encoded.contains("\"exposesCgroupV2\":null"));
        assert!(encoded.contains("synthetic-self"));
    }

    #[test]
    fn collector_stdout_bound_includes_json_escaping_and_final_newline() {
        let root = root();
        std::fs::write(root.path().join("proc/self/cgroup"), vec![0; 65_536]).unwrap();
        let listener = UnixListener::bind(root.path().join("run/docker.sock")).unwrap();
        let server = fake_server(listener, None);
        let result = collect_at(root.path(), caller());
        assert_eq!(server.join().unwrap(), 2);
        assert_eq!(encode_report(&result), Err("REPORT_BYTE_BOUND"));
    }
}
