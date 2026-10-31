#!/usr/bin/env python3
import argparse
import os
import re
import selectors
import signal
import stat
import subprocess
import sys
import time


MAX_LOG = 1024 * 1024
NAME = re.compile(r"f9smoke-[0-9a-f]{24}\Z")
WAIT_CHANNEL = re.compile(r"[a-zA-Z0-9_]{1,64}\Z")


def private_directory(path):
    if not os.path.isabs(path) or path != os.path.normpath(path):
        raise ValueError("use a canonical absolute evidence directory")
    current = os.open("/", os.O_RDONLY | os.O_DIRECTORY)
    try:
        for component in path.split("/")[1:]:
            next_fd = os.open(
                component, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=current
            )
            os.close(current)
            current = next_fd
            details = os.fstat(current)
            if details.st_uid not in (0, os.getuid()):
                raise ValueError("untrusted evidence directory owner")
            if details.st_mode & 0o022 and not (
                details.st_uid == 0 and details.st_mode & stat.S_ISVTX
            ):
                raise ValueError("writable evidence parent directory")
        details = os.fstat(current)
        if details.st_uid != os.getuid() or details.st_mode & 0o077:
            raise ValueError("evidence directory must be private and user-owned")
        return current
    except (OSError, ValueError):
        os.close(current)
        raise


def snapshot(pid, started):
    try:
        with open(f"/proc/{pid}/stat", encoding="ascii") as stream:
            fields = stream.read().rsplit(") ", 1)[1].split()
        if fields[19] != started:
            return "REUSED", "UNKNOWN"
        with open(f"/proc/{pid}/wchan", encoding="ascii") as stream:
            channel = stream.read().strip()
        return fields[0] if len(
            fields[0]
        ) == 1 else "UNKNOWN", channel if WAIT_CHANNEL.fullmatch(channel) else "UNKNOWN"
    except (OSError, IndexError, ValueError):
        return "UNAVAILABLE", "UNKNOWN"


def start_time(pid):
    try:
        with open(f"/proc/{pid}/stat", encoding="ascii") as stream:
            return stream.read().rsplit(") ", 1)[1].split()[19]
    except (OSError, IndexError, ValueError):
        return "UNKNOWN"


def run(sbx, name, seconds, log_fd):
    interrupted = 0

    def on_signal(number, _frame):
        nonlocal interrupted
        interrupted = number

    old_int = signal.signal(signal.SIGINT, on_signal)
    old_term = signal.signal(signal.SIGTERM, on_signal)
    process = None
    try:
        process = subprocess.Popen(
            [
                sbx,
                "-D",
                "create",
                "--name",
                name,
                "--pull",
                "never",
                "--skills",
                "off",
                "--deny-network",
                "**",
                "--cpus",
                "1",
                "--memory",
                "512m",
                "shell",
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )
        os.set_blocking(process.stdout.fileno(), False)
        watcher = selectors.DefaultSelector()
        watcher.register(process.stdout, selectors.EVENT_READ)
        started = start_time(process.pid)
        print(
            f"CREATE_CLI_PID={process.pid} CREATE_CLI_START_TICKS={started}", flush=True
        )
        beginning = time.monotonic()
        deadline = beginning + seconds
        sample_at = beginning + min(0.25, seconds / 4)
        sent_term = None
        sent_kill = False
        exited_at = None
        stored = 0
        dropped = 0
        log_failed = False
        try:
            while True:
                now = time.monotonic()
                code = process.poll()
                if code is not None and exited_at is None:
                    exited_at = now
                if (
                    code is None
                    and sent_term is None
                    and (now >= deadline or interrupted or log_failed)
                ):
                    process.terminate()
                    sent_term = now
                if (
                    code is None
                    and sent_term is not None
                    and now - sent_term >= 2
                    and not sent_kill
                ):
                    process.kill()
                    sent_kill = True
                if code is None and now >= sample_at:
                    state, channel = snapshot(process.pid, started)
                    print(
                        f"CREATE_SAMPLE_SEC={int(now - beginning)} STATE={state} WCHAN={channel}",
                        flush=True,
                    )
                    sample_at = now + 5
                for key, _ in watcher.select(timeout=0.1):
                    try:
                        block = os.read(key.fileobj.fileno(), 65536)
                    except BlockingIOError:
                        continue
                    if not block:
                        watcher.unregister(key.fileobj)
                        continue
                    size = min(len(block), MAX_LOG - stored)
                    if size and not log_failed:
                        try:
                            written = 0
                            while written < size:
                                amount = os.write(log_fd, block[written:size])
                                if amount == 0:
                                    raise OSError("debug log write made no progress")
                                written += amount
                            stored += size
                        except OSError:
                            log_failed = True
                    dropped += len(block) - size
                if code is not None and (not watcher.get_map() or now - exited_at >= 1):
                    break
                if now >= deadline + 4:
                    break
        finally:
            watcher.close()
            process.stdout.close()
        code = process.poll()
        print(f"CREATE_LOG_BYTES={stored} CREATE_LOG_DROPPED={dropped}")
        if code is None:
            print("CREATE_CLI_STATUS=SURVIVED_DEADLINE")
            return 2
        process.wait(timeout=1)
        if log_failed:
            print("CREATE_CLI_STATUS=LOG_WRITE_FAILED")
            return 2
        if interrupted:
            print("CREATE_CLI_STATUS=INTERRUPTED")
            return 2
        if sent_term is not None:
            print("CREATE_CLI_STATUS=DEADLINE")
            return 2
        print(f"CREATE_CLI_STATUS=EXIT_{code}")
        return 0 if code == 0 else 2
    finally:
        if process is not None and process.poll() is None:
            process.kill()
            try:
                process.wait(timeout=1)
            except subprocess.TimeoutExpired:
                pass
        signal.signal(signal.SIGINT, old_int)
        signal.signal(signal.SIGTERM, old_term)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--sbx", required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--seconds", type=int, required=True)
    parser.add_argument("--evidence-dir", required=True)
    args = parser.parse_args()
    if not NAME.fullmatch(args.name) or not 1 <= args.seconds <= 60:
        print("STOP: invalid instrumented create scope", file=sys.stderr)
        return 2
    if (
        not os.path.isabs(args.sbx)
        or not os.path.isfile(args.sbx)
        or not os.access(args.sbx, os.X_OK)
    ):
        print("STOP: invalid sbx executable", file=sys.stderr)
        return 2
    try:
        parent = private_directory(args.evidence_dir)
        try:
            log_name = f"{args.name}.debug.log"
            log_fd = os.open(
                log_name,
                os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                0o600,
                dir_fd=parent,
            )
        finally:
            os.close(parent)
        try:
            print(f"CREATE_DEBUG_PRIVATE_FILE={log_name}", flush=True)
            return run(args.sbx, args.name, args.seconds, log_fd)
        finally:
            os.close(log_fd)
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        print(
            f"STOP: instrumented create failed ({type(error).__name__})",
            file=sys.stderr,
        )
        return 2


if __name__ == "__main__":
    sys.exit(main())
