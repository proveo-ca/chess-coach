// SPEC: _spec/gpu-owner.md
use chess_coach_gpu_owner::{
    OwnerError,
    evidence::{Evidence, Phase},
    input::FileExpectation,
    json,
    linux::{self, Boottime, Clock, Executable, LinuxWaiter, Waiter, Watch},
    process::{Limits, Process},
    telemetry,
};
use rustix::event::PollFlags;
use std::{
    fs,
    io::{Read, Write},
    os::{
        fd::AsFd,
        unix::{
            fs::{PermissionsExt, symlink},
            net::UnixStream,
        },
    },
    path::Path,
    sync::Arc,
};

fn scratch() -> tempfile::TempDir {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../_work/gpu-owner-recovery/scratch");
    fs::create_dir_all(&root).unwrap();
    tempfile::tempdir_in(root.canonicalize().unwrap()).unwrap()
}
fn registered(path: &Path, bytes: &[u8]) -> FileExpectation {
    fs::write(path, bytes).unwrap();
    FileExpectation {
        path: path.to_str().unwrap().into(),
        byte_length: bytes.len() as u64,
        sha256: json::sha256(bytes),
    }
}
fn helper(root: &Path, body: &str) -> Arc<Executable> {
    let path = root.join("helper.ts");
    let bytes = format!("#!/usr/local/bin/bun --no-env-file\n{body}\n");
    let expected = registered(&path, bytes.as_bytes());
    fs::set_permissions(path, fs::Permissions::from_mode(0o700)).unwrap();
    Arc::new(Executable::open(&expected, || Ok(())).unwrap())
}
fn finish(process: &mut Process) {
    let mut waiter = LinuxWaiter;
    let deadline = Boottime.now_ns().unwrap() + 5_000_000_000;
    while !process.complete() {
        process.pump().unwrap();
        if process.complete() {
            break;
        }
        waiter.wait_until(deadline, &process.watches()).unwrap();
    }
    assert!(process.natural_clean());
}

fn drain_cleanup(process: &mut Process) -> Vec<OwnerError> {
    let mut errors = Vec::new();
    let mut waiter = LinuxWaiter;
    let deadline = Boottime.now_ns().unwrap() + 5_000_000_000;
    while !process.complete() {
        if let Err(error) = process.cleanup_pump() {
            errors.push(error);
        }
        if !process.complete() {
            waiter
                .wait_until(deadline, &process.cleanup_watches())
                .unwrap();
        }
    }
    errors
}

#[test]
fn file_hashing_checks_deadlines_exact_length_identity_and_rewinds() {
    let root = scratch();
    let path = root.path().join("bytes");
    let bytes = vec![b'x'; 131073];
    let expected = registered(&path, &bytes);
    let mut calls = 0;
    let mut file = linux::verified_file(&expected, || {
        calls += 1;
        Ok(())
    })
    .unwrap();
    let mut read = Vec::new();
    file.read_to_end(&mut read).unwrap();
    assert_eq!(read, bytes);
    assert!(calls >= 5);
    let mut wrong = expected.clone();
    wrong.sha256 = "0".repeat(64);
    assert_eq!(
        linux::verified_file(&wrong, || Ok(())).unwrap_err(),
        OwnerError("FILE_SHA256")
    );
    let mut wrong = expected.clone();
    wrong.byte_length += 1;
    assert_eq!(
        linux::verified_file(&wrong, || Ok(())).unwrap_err(),
        OwnerError("FILE_LENGTH")
    );
    assert_eq!(
        linux::verified_file(&expected, || Err(OwnerError("TEST_DEADLINE"))).unwrap_err(),
        OwnerError("TEST_DEADLINE")
    );
}

#[test]
fn file_custody_rejects_symlink_leaves_and_ancestors() {
    let root = scratch();
    let real = root.path().join("real");
    fs::create_dir(&real).unwrap();
    let expected = registered(&real.join("file"), b"identity");
    let leaf = root.path().join("leaf");
    symlink(&expected.path, &leaf).unwrap();
    assert!(linux::open_regular(leaf.to_str().unwrap()).is_err());
    let ancestor = root.path().join("ancestor");
    symlink(&real, &ancestor).unwrap();
    assert!(linux::open_regular(ancestor.join("file").to_str().unwrap()).is_err());
}

#[test]
fn pinned_executable_survives_path_replacement_without_fallback() {
    let root = scratch();
    let executable = helper(root.path(), "await Bun.write(Bun.stdout, 'pinned\\n');");
    fs::rename(
        root.path().join("helper.ts"),
        root.path().join("retained.ts"),
    )
    .unwrap();
    fs::write(root.path().join("helper.ts"), b"not executable").unwrap();
    let mut process = Process::spawn(executable, &[], false, Limits::default()).unwrap();
    finish(&mut process);
    assert_eq!(process.stdout.prefix, b"pinned\n");
}

#[test]
fn helper_multiplexes_large_concurrent_output_and_complete_stdin_close() {
    let root = scratch();
    let executable = helper(
        root.path(),
        "await Promise.all([Bun.write(Bun.stdout, 'o'.repeat(262144)), Bun.write(Bun.stderr, 'e'.repeat(262144))]); const data = await new Response(Bun.stdin.stream()).arrayBuffer(); await Bun.write(Bun.stdout, String(data.byteLength) + '\\n');",
    );
    let mut process = Process::spawn(
        executable,
        &[],
        true,
        Limits {
            stdout: 400000,
            stderr: 400000,
            pending: 1048576,
        },
    )
    .unwrap();
    process.queue_and_close(vec![b'x'; 1048576]).unwrap();
    assert!(!process.write_complete);
    finish(&mut process);
    assert!(process.write_complete);
    assert_eq!(process.stderr.received, 262144);
    assert_eq!(process.stdout.received, 262152);
    assert!(process.stdout.prefix.ends_with(b"1048576\n"));
}

#[test]
fn received_bytes_and_retained_prefix_have_distinct_limits() {
    let root = scratch();
    let executable = helper(
        root.path(),
        "await Bun.write(Bun.stdout, 'x'.repeat(65536));",
    );
    let mut process = Process::spawn(
        executable,
        &[],
        false,
        Limits {
            stdout: 16,
            stderr: 16,
            pending: 0,
        },
    )
    .unwrap();
    let deadline = Boottime.now_ns().unwrap() + 5_000_000_000;
    let mut waiter = LinuxWaiter;
    let mut failure = None;
    while failure.is_none() {
        if let Err(error) = process.pump() {
            failure = Some(error);
            break;
        }
        waiter.wait_until(deadline, &process.watches()).unwrap();
    }
    assert_eq!(failure, Some(OwnerError("OUTPUT_BOUND")));
    assert_eq!(process.stdout.prefix.len(), 16);
    assert!(process.stdout.received > 16);
    process.kill_owned().unwrap();
    assert!(
        drain_cleanup(&mut process)
            .iter()
            .all(|error| *error == OwnerError("OUTPUT_BOUND"))
    );
    assert!(!process.natural_clean());
}

#[test]
fn cleanup_does_not_transmit_or_close_queued_start_input() {
    let root = scratch();
    let executable = helper(
        root.path(),
        "let bytes = 0, eof = false; void (async () => { for await (const chunk of Bun.stdin.stream()) bytes += chunk.byteLength; eof = true; })(); setInterval(() => { void Bun.write(Bun.stdout, JSON.stringify({ bytes, eof }) + '\\n'); }, 10);",
    );
    let mut process = Process::spawn(executable, &[], true, Limits::default()).unwrap();
    process
        .queue_and_close(b"{\"start\":true}\n".to_vec())
        .unwrap();
    assert!(
        !process
            .cleanup_watches()
            .iter()
            .any(|watch| watch.events.contains(PollFlags::OUT))
    );
    let deadline = Boottime.now_ns().unwrap() + 5_000_000_000;
    let mut waiter = LinuxWaiter;
    while !process.stdout.prefix.contains(&b'\n') {
        process.cleanup_pump().unwrap();
        if !process.stdout.prefix.contains(&b'\n') {
            waiter
                .wait_until(deadline, &process.cleanup_watches())
                .unwrap();
        }
    }
    let write_complete = process.write_complete;
    let received = process.stdout.prefix.clone();
    process.kill_owned().unwrap();
    assert!(drain_cleanup(&mut process).is_empty());
    assert!(!write_complete);
    assert!(!process.write_complete);
    assert_eq!(
        serde_json::from_slice::<serde_json::Value>(
            received.split(|byte| *byte == b'\n').next().unwrap()
        )
        .unwrap(),
        serde_json::json!({"bytes":0,"eof":false})
    );
    assert!(!process.natural_clean());
}

#[test]
fn cleanup_reports_new_output_faults_and_still_drains_and_reaps() {
    let root = scratch();
    let executable = helper(
        root.path(),
        "await Bun.write(Bun.stdout, 'x'.repeat(65536));",
    );
    let mut process = Process::spawn(
        executable,
        &[],
        false,
        Limits {
            stdout: 16,
            stderr: 16,
            pending: 0,
        },
    )
    .unwrap();
    let errors = drain_cleanup(&mut process);
    assert!(errors.contains(&OwnerError("OUTPUT_BOUND")));
    assert_eq!(process.failure, Some(OwnerError("OUTPUT_BOUND")));
    assert!(process.complete());
    assert!(!process.natural_clean());
    assert!(process.cleanup_pump().is_ok());
}

#[test]
fn group_kill_cannot_manufacture_natural_helper_eof() {
    let root = scratch();
    let executable = helper(
        root.path(),
        "Bun.spawn([process.execPath, '--no-env-file', '--no-install', '-e', 'setInterval(() => {}, 1000)'], { stdin: 'ignore', stdout: 'inherit', stderr: 'inherit' }); console.log('valid'); process.exit(0);",
    );
    let mut process = Process::spawn(executable, &[], false, Limits::default()).unwrap();
    let deadline = Boottime.now_ns().unwrap() + 5_000_000_000;
    let mut waiter = LinuxWaiter;
    while !process.complete() {
        process.pump().unwrap();
        if !process.complete() {
            waiter.wait_until(deadline, &process.watches()).unwrap();
        }
    }
    assert_eq!(process.stdout.prefix, b"valid\n");
    assert!(process.status.unwrap().success());
    assert!(!process.natural_clean());
}

#[test]
fn expired_timer_wins_over_readable_io() {
    let (mut write, read) = UnixStream::pair().unwrap();
    write.write_all(b"ready").unwrap();
    let deadline = Boottime.now_ns().unwrap();
    let result = LinuxWaiter.wait_until(
        deadline,
        &[Watch {
            fd: read.as_fd(),
            events: PollFlags::IN,
        }],
    );
    assert_eq!(result.unwrap_err(), OwnerError("DEADLINE"));
}

#[test]
fn evidence_is_exclusive_counts_root_and_latches_failures_without_cleanup_io() {
    let root = scratch();
    let packet = root.path().join("packet");
    let mut evidence = Evidence::create(packet.to_str().unwrap()).unwrap();
    assert_eq!(evidence.entries, 1);
    evidence.write("first", b"prefix", Phase::Working).unwrap();
    assert_eq!(evidence.entries, 2);
    assert!(
        evidence
            .write("first", b"replacement", Phase::Working)
            .is_err()
    );
    assert!(evidence.failed);
    assert!(evidence.write("cleanup", b"skip", Phase::Cleanup).is_ok());
    assert!(!packet.join("cleanup").exists());
    assert_eq!(fs::read(packet.join("first")).unwrap(), b"prefix");
    assert!(evidence.write("working", b"stop", Phase::Working).is_err());
    assert!(Evidence::create(packet.to_str().unwrap()).is_err());
}

#[test]
fn replacing_the_evidence_path_latches_failure_even_with_a_pinned_directory() {
    let root = scratch();
    let packet = root.path().join("packet");
    let preserved = root.path().join("preserved");
    let mut evidence = Evidence::create(packet.to_str().unwrap()).unwrap();
    evidence.write("first", b"kept", Phase::Working).unwrap();
    fs::rename(&packet, &preserved).unwrap();
    fs::write(&packet, b"replacement").unwrap();
    assert!(
        evidence
            .write("next", b"not accepted", Phase::Working)
            .is_err()
    );
    assert!(evidence.failed);
    assert!(evidence.write("cleanup", b"skip", Phase::Cleanup).is_ok());
    assert_eq!(fs::read(preserved.join("first")).unwrap(), b"kept");
    assert!(!preserved.join("cleanup").exists());
}

#[test]
fn telemetry_is_one_uuid_filtered_five_field_csv_not_sum_accounting() {
    let uuid = "GPU-12345678-1234-1234-1234-123456789abc";
    let good = format!("{uuid}, fixture, 10, 9, 9\n");
    let sample = telemetry::decode(good.as_bytes(), uuid, "fixture", 123).unwrap();
    assert_eq!(sample.free_bytes.0, 9 * 1048576);
    assert_eq!(sample.observed_boottime_ns.0, 123);
    for line in [
        good.trim_end().to_string(),
        format!("{good}{good}"),
        good.replace(", 10,", ", 010,"),
        good.replace(", 10,", ", 1e1,"),
        good.replace(", 10,", ", 0,"),
        good.replace(", 9,", ", 11,"),
        good.replace("fixture", "wrong"),
        good.replace("\n", "\r\n"),
    ] {
        assert!(
            telemetry::decode(line.as_bytes(), uuid, "fixture", 123).is_err(),
            "{line}"
        );
    }
    let args = telemetry::argv(uuid);
    assert_eq!(args.len(), 3);
    assert!(args[0].contains(uuid));
    assert!(!args.iter().any(|s| s == "--query-compute-apps"));
}

#[test]
fn cpu_ranges_are_bounded_sorted_and_unique() {
    assert_eq!(
        chess_coach_gpu_owner::observe::parse_cpuset("2-4,7\n").unwrap(),
        vec![2, 3, 4, 7]
    );
    for value in ["", "1,1", "0-9999999", "2-1", "01", "-1", "1--2"] {
        assert!(
            chess_coach_gpu_owner::observe::parse_cpuset(value).is_err(),
            "{value}"
        );
    }
}
