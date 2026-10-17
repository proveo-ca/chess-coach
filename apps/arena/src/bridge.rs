// SPEC: _spec/apps/arena/burn-compat.puml
use crate::ArenaResult;
use crate::observation::Observation;
use crate::protocol::{Action, EngineResult, Reply, Request, decode_reply};
use std::ffi::OsString;
use std::io::{self, Read, Write};
use std::net::Shutdown;
use std::os::fd::OwnedFd;
use std::os::unix::fs::PermissionsExt;
use std::os::unix::net::UnixStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, ExitStatus, Stdio};
use std::time::{Duration, Instant};

const WORKER: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/engine/worker.ts");
const CWD: &str = env!("CARGO_MANIFEST_DIR");

#[derive(Clone, Copy)]
struct Limits {
    stdin: usize,
    stdout: usize,
    stderr: usize,
    total: Duration,
    reap_reserve: Duration,
}

impl Default for Limits {
    fn default() -> Self {
        Self {
            stdin: 64 * 1024,
            stdout: 1024 * 1024,
            stderr: 64 * 1024,
            total: Duration::from_secs(30),
            reap_reserve: Duration::from_secs(3),
        }
    }
}

struct Output {
    status: ExitStatus,
    stdout: Vec<u8>,
    stderr: Vec<u8>,
}

pub(crate) fn open() -> ArenaResult<Observation> {
    match invoke(&Request::open())? {
        Reply::Open(reply) => Ok(reply.observation),
        _ => Err("Engine returned an unexpected open reply".into()),
    }
}

pub(crate) fn settle(action: &Action) -> ArenaResult<(Observation, EngineResult)> {
    match invoke(&Request::settle(action)?)? {
        Reply::Settle(reply) => Ok((reply.observation, reply.result)),
        _ => Err("Engine returned an unexpected settle reply".into()),
    }
}

fn invoke(request: &Request) -> ArenaResult<Reply> {
    let bytes = serde_json::to_vec(request)
        .map_err(|error| format!("Cannot encode engine request: {error}"))?;
    let output = launch(Path::new(WORKER), &bytes, Limits::default())?;
    decode_reply(&output.stdout, request, output.status.code()).map_err(|error| {
        if output.stderr.is_empty() {
            error
        } else {
            format!(
                "{error}; engine stderr: {}",
                String::from_utf8_lossy(&output.stderr)
            )
        }
    })
}

pub(crate) fn node_from_path(path: &OsString) -> ArenaResult<PathBuf> {
    for directory in std::env::split_paths(path) {
        if !directory.is_absolute() {
            continue;
        }
        let candidate = directory.join("node");
        if let Ok(metadata) = candidate.metadata()
            && metadata.is_file()
            && metadata.permissions().mode() & 0o111 != 0
        {
            return candidate
                .canonicalize()
                .map_err(|error| format!("Cannot resolve Node executable: {error}"));
        }
    }
    Err("Node executable is missing from the trusted host PATH".into())
}

pub(crate) fn channel() -> io::Result<(UnixStream, Stdio)> {
    let (parent, child) = UnixStream::pair()?;
    parent.set_nonblocking(true)?;
    Ok((parent, Stdio::from(OwnedFd::from(child))))
}

fn launch(script: &Path, input: &[u8], limits: Limits) -> ArenaResult<Output> {
    if input.len() > limits.stdin {
        return Err("Engine stdin limit exceeded".into());
    }
    if limits.reap_reserve >= limits.total {
        return Err("Engine timeout must include a positive work budget".into());
    }
    let started = Instant::now();
    let deadline = started + limits.total;
    let work_deadline = deadline - limits.reap_reserve;
    let path = std::env::var_os("PATH").ok_or("Trusted host PATH is missing")?;
    let node = node_from_path(&path)?;
    let (stdin, child_stdin) =
        channel().map_err(|error| format!("Cannot create stdin channel: {error}"))?;
    let (mut stdout, child_stdout) =
        channel().map_err(|error| format!("Cannot create stdout channel: {error}"))?;
    let (mut stderr, child_stderr) =
        channel().map_err(|error| format!("Cannot create stderr channel: {error}"))?;
    let mut child = Command::new(node)
        .args(["--import", "tsx"])
        .arg(script)
        .current_dir(CWD)
        .env_clear()
        .env("PATH", path)
        .stdin(child_stdin)
        .stdout(child_stdout)
        .stderr(child_stderr)
        .spawn()
        .map_err(|error| format!("Cannot launch Node engine: {error}"))?;
    let mut stdin = Some(stdin);
    let mut sent = 0;
    let mut stdout_bytes = Vec::new();
    let mut stderr_bytes = Vec::new();
    let mut stdout_eof = false;
    let mut stderr_eof = false;
    let result = (|| {
        loop {
            if Instant::now() >= work_deadline {
                return Err("Engine timeout exceeded".into());
            }
            if let Some(stream) = &mut stdin {
                match stream.write(&input[sent..input.len().min(sent + 8192)]) {
                    Ok(0) if sent != input.len() => {
                        return Err("Engine stdin closed before request EOF".into());
                    }
                    Ok(count) => sent += count,
                    Err(error)
                        if matches!(
                            error.kind(),
                            io::ErrorKind::WouldBlock | io::ErrorKind::Interrupted
                        ) => {}
                    Err(error) => return Err(format!("Cannot write engine stdin: {error}")),
                }
                if sent == input.len() {
                    stream
                        .shutdown(Shutdown::Write)
                        .map_err(|error| format!("Cannot close engine stdin: {error}"))?;
                    stdin = None;
                }
            }
            drain(
                &mut stdout,
                &mut stdout_bytes,
                &mut stdout_eof,
                limits.stdout,
                "stdout",
            )?;
            drain(
                &mut stderr,
                &mut stderr_bytes,
                &mut stderr_eof,
                limits.stderr,
                "stderr",
            )?;
            if let Some(status) = child
                .try_wait()
                .map_err(|error| format!("Cannot poll Node engine: {error}"))?
                && stdout_eof
                && stderr_eof
            {
                return Ok(Output {
                    status,
                    stdout: stdout_bytes,
                    stderr: stderr_bytes,
                });
            }
            std::thread::sleep(
                Duration::from_millis(2)
                    .min(work_deadline.saturating_duration_since(Instant::now())),
            );
        }
    })();
    if result.is_err()
        && let Err(cleanup) = kill_and_reap(&mut child, deadline)
    {
        return Err(format!("{}; {cleanup}", result.err().unwrap_or_default()));
    }
    result
}

fn drain(
    stream: &mut UnixStream,
    bytes: &mut Vec<u8>,
    eof: &mut bool,
    limit: usize,
    name: &str,
) -> ArenaResult<()> {
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
                    return Err(format!("Engine {name} limit exceeded"));
                }
                bytes.extend_from_slice(&buffer[..count]);
            }
            Err(error) if error.kind() == io::ErrorKind::WouldBlock => return Ok(()),
            Err(error) if error.kind() == io::ErrorKind::Interrupted => {}
            Err(error) => return Err(format!("Cannot drain engine {name}: {error}")),
        }
    }
    Ok(())
}

pub(crate) fn kill_and_reap(child: &mut Child, deadline: Instant) -> ArenaResult<()> {
    if child
        .try_wait()
        .map_err(|error| format!("Cannot poll engine during cleanup: {error}"))?
        .is_some()
    {
        return Ok(());
    }
    let kill_error = child.kill().err();
    loop {
        match child.try_wait() {
            Ok(Some(_)) => return Ok(()),
            Ok(None) => {}
            Err(error) => return Err(format!("Cannot reap engine: {error}")),
        }
        if Instant::now() >= deadline {
            return Err(format!(
                "Engine reap deadline exceeded; kill error: {kill_error:?}"
            ));
        }
        std::thread::sleep(
            Duration::from_millis(2).min(deadline.saturating_duration_since(Instant::now())),
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};

    static NEXT_FIXTURE: AtomicU64 = AtomicU64::new(0);

    struct Fixture {
        directory: PathBuf,
        files: Vec<PathBuf>,
    }

    impl Fixture {
        fn new(source: &str) -> Self {
            let directory = std::env::temp_dir().join(format!(
                "arena-bridge-{}-{}",
                std::process::id(),
                NEXT_FIXTURE.fetch_add(1, Ordering::Relaxed)
            ));
            std::fs::create_dir(&directory).unwrap();
            let script = directory.join("worker.mjs");
            std::fs::write(&script, source).unwrap();
            Self {
                directory,
                files: vec![script],
            }
        }

        fn script(&self) -> &Path {
            &self.files[0]
        }

        fn add(&mut self, name: &str, source: &str) {
            let file = self.directory.join(name);
            std::fs::write(&file, source).unwrap();
            self.files.push(file);
        }
    }

    impl Drop for Fixture {
        fn drop(&mut self) {
            for file in &self.files {
                let _ = std::fs::remove_file(file);
            }
            let _ = std::fs::remove_dir(&self.directory);
        }
    }

    fn quick_limits() -> Limits {
        Limits {
            total: Duration::from_secs(3),
            reap_reserve: Duration::from_millis(500),
            ..Limits::default()
        }
    }

    fn error(result: ArenaResult<Output>) -> String {
        match result {
            Ok(_) => panic!("Expected bridge failure"),
            Err(error) => error,
        }
    }

    #[test]
    fn channels_drain_both_outputs_while_sending_request_and_close_stdin() {
        let fixture = Fixture::new(
            r#"
            import { writeSync } from 'node:fs';
            const chunk = Buffer.alloc(8192, 120);
            for (let i=0;i<16;i++) { writeSync(1,chunk); writeSync(2,chunk); }
            let size=0; for await (const chunk of process.stdin) size+=chunk.length;
            writeSync(1,String(size));
        "#,
        );
        let input = vec![b'q'; 65536];
        let limits = Limits {
            stdout: 200_000,
            stderr: 200_000,
            ..quick_limits()
        };
        let output = launch(fixture.script(), &input, limits).unwrap();
        assert!(output.status.success());
        assert!(output.stdout.ends_with(b"65536"));
        assert_eq!(output.stderr.len(), 16 * 8192);
    }

    #[test]
    fn stdin_limit_fails_before_spawn() {
        let oversized = vec![0; 65537];
        assert!(
            error(launch(
                Path::new("/not/a/worker"),
                &oversized,
                quick_limits()
            ))
            .contains("stdin limit")
        );
    }

    #[test]
    fn stdout_and_stderr_overflow_fail_without_unbounded_drain() {
        for descriptor in [1, 2] {
            let fixture = Fixture::new(&format!(
                "import {{writeSync}} from 'node:fs'; for (;;) writeSync({descriptor},Buffer.alloc(8192));"
            ));
            let started = Instant::now();
            let limits = Limits {
                stdout: 1024,
                stderr: 1024,
                ..quick_limits()
            };
            let failure = error(launch(fixture.script(), b"{}", limits));
            assert!(
                failure.contains(if descriptor == 1 {
                    "stdout limit"
                } else {
                    "stderr limit"
                }),
                "{failure}"
            );
            assert!(started.elapsed() < limits.total);
        }
    }

    #[test]
    fn timeout_kills_and_reaps_direct_child() {
        let mut fixture = Fixture::new("");
        let pid_file = fixture.directory.join("pid");
        fixture.files.push(pid_file.clone());
        std::fs::write(fixture.script(), format!("import {{writeFileSync}} from 'node:fs'; writeFileSync({},String(process.pid)); setInterval(()=>{{}},1000);", serde_json::to_string(&pid_file).unwrap())).unwrap();
        let started = Instant::now();
        let limits = Limits {
            total: Duration::from_millis(1500),
            reap_reserve: Duration::from_millis(500),
            ..Limits::default()
        };
        assert!(error(launch(fixture.script(), b"{}", limits)).contains("timeout"));
        assert!(started.elapsed() < limits.total);
        let pid = std::fs::read_to_string(pid_file).unwrap();
        assert!(!Path::new("/proc").join(pid).exists());
    }

    #[test]
    fn inherited_descendant_descriptors_do_not_block_reader_join() {
        let mut fixture = Fixture::new(
            r#"
            import {spawn} from 'node:child_process';
            const child=spawn(process.execPath,[new URL('./descendant.mjs',import.meta.url).pathname],{stdio:['ignore',1,2]});
            child.unref();
        "#,
        );
        fixture.add("descendant.mjs", "setTimeout(()=>{},2000);");
        let limits = Limits {
            total: Duration::from_millis(1500),
            reap_reserve: Duration::from_millis(500),
            ..Limits::default()
        };
        let started = Instant::now();
        assert!(error(launch(fixture.script(), b"", limits)).contains("timeout"));
        assert!(started.elapsed() < limits.total);
    }

    #[test]
    fn nonzero_and_malformed_success_replies_fail_closed() {
        let fixture = Fixture::new("process.stdout.write('{}\\n'); process.exitCode=2;");
        let output = launch(fixture.script(), b"{}", quick_limits()).unwrap();
        assert_eq!(output.status.code(), Some(2));
        assert!(decode_reply(&output.stdout, &Request::open(), output.status.code()).is_err());
    }

    #[test]
    fn child_environment_contains_only_path() {
        let fixture = Fixture::new(
            "process.stdout.write(JSON.stringify(Object.keys(process.env).sort())+'\\n');",
        );
        let output = launch(fixture.script(), b"", quick_limits()).unwrap();
        assert!(output.status.success());
        let keys: Vec<String> = serde_json::from_slice(&output.stdout).unwrap();
        assert_eq!(keys, ["PATH"]);
    }
}
