// SPEC: _spec/host-entrypoint.puml
use crate::socket::PinnedSocket;
use rustix::event::{PollFd, PollFlags, poll};
use rustix::fd::OwnedFd;
use rustix::io::Errno;
use rustix::net::{
    self, AddressFamily, RecvFlags, SendFlags, SocketAddrUnix, SocketFlags, SocketType,
};
use rustix::time::{
    ClockId, Itimerspec, TimerfdClockId, TimerfdFlags, TimerfdTimerFlags, Timespec, clock_gettime,
    timerfd_create, timerfd_settime,
};
use serde::Serialize;
use std::time::Duration;

pub(crate) const RESPONSE_BYTES: usize = 65_536;
pub(crate) const REQUEST_SECONDS: u64 = 10;

#[derive(Clone, Copy)]
pub(crate) enum Request {
    Version,
    Info,
}

impl Request {
    pub(crate) fn path(self) -> &'static str {
        match self {
            Self::Version => "/version",
            Self::Info => "/info",
        }
    }

    fn bytes(self) -> &'static [u8] {
        match self {
            Self::Version => b"GET /version HTTP/1.0\r\nHost: localhost\r\nAccept: application/json\r\nAccept-Encoding: identity\r\nConnection: close\r\n\r\n",
            Self::Info => b"GET /info HTTP/1.0\r\nHost: localhost\r\nAccept: application/json\r\nAccept-Encoding: identity\r\nConnection: close\r\n\r\n",
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Receipt {
    method: &'static str,
    path: &'static str,
    status_code: Option<u16>,
    response_bytes: usize,
    elapsed_nanos: u64,
    pub(crate) error: Option<&'static str>,
}

pub(crate) struct Outcome<T> {
    pub(crate) receipt: Receipt,
    pub(crate) projection: Option<T>,
}

struct Deadline {
    origin: u128,
    end: u128,
    timer: OwnedFd,
}

fn now() -> u128 {
    let time = clock_gettime(ClockId::Boottime);
    time.tv_sec as u128 * 1_000_000_000 + time.tv_nsec as u128
}

impl Deadline {
    fn new(origin: u128, duration: Duration) -> Result<Self, &'static str> {
        let end = origin
            .checked_add(duration.as_nanos())
            .filter(|end| *end > now())
            .ok_or("DEADLINE")?;
        let value = timestamp(end)?;
        let timer = timerfd_create(
            TimerfdClockId::Boottime,
            TimerfdFlags::CLOEXEC | TimerfdFlags::NONBLOCK,
        )
        .map_err(|_| "DEADLINE_TIMER")?;
        timerfd_settime(
            &timer,
            TimerfdTimerFlags::ABSTIME,
            &Itimerspec {
                it_interval: Timespec {
                    tv_sec: 0,
                    tv_nsec: 0,
                },
                it_value: value,
            },
        )
        .map_err(|_| "DEADLINE_TIMER")?;
        Ok(Self { origin, end, timer })
    }

    fn remaining(&self) -> Result<Timespec, &'static str> {
        let remaining = self
            .end
            .checked_sub(now())
            .filter(|v| *v > 0)
            .ok_or("DEADLINE")?;
        timestamp(remaining)
    }

    fn elapsed(&self) -> u64 {
        now().saturating_sub(self.origin).min(u64::MAX as u128) as u64
    }
}

fn timestamp(nanos: u128) -> Result<Timespec, &'static str> {
    Ok(Timespec {
        tv_sec: i64::try_from(nanos / 1_000_000_000).map_err(|_| "CLOCK_RANGE")?,
        tv_nsec: (nanos % 1_000_000_000) as i64,
    })
}

fn wait(fd: &OwnedFd, events: PollFlags, deadline: &Deadline) -> Result<(), &'static str> {
    loop {
        let remaining = deadline.remaining()?;
        let mut fds = [
            PollFd::new(fd, events),
            PollFd::new(&deadline.timer, PollFlags::IN),
        ];
        match poll(&mut fds, Some(&remaining)) {
            Ok(0) => return Err("DEADLINE"),
            Ok(_) => {
                deadline.remaining()?;
                let timer_events = fds[1].revents();
                if timer_events.intersects(PollFlags::ERR | PollFlags::HUP | PollFlags::NVAL) {
                    return Err("DEADLINE_TIMER");
                }
                if timer_events.contains(PollFlags::IN) {
                    return Err("DEADLINE");
                }
                return if fds[0].revents().contains(PollFlags::NVAL) {
                    Err("SOCKET_IO")
                } else {
                    Ok(())
                };
            }
            Err(Errno::INTR) => continue,
            Err(_) => return Err("SOCKET_IO"),
        }
    }
}

fn connect(pin: &PinnedSocket, deadline: &Deadline) -> Result<OwnedFd, &'static str> {
    deadline.remaining()?;
    let fd = net::socket_with(
        AddressFamily::UNIX,
        SocketType::STREAM,
        SocketFlags::NONBLOCK | SocketFlags::CLOEXEC,
        None,
    )
    .map_err(|_| "SOCKET_CREATE")?;
    let address = SocketAddrUnix::new(pin.descriptor_path()).map_err(|_| "SOCKET_ADDRESS")?;
    match net::connect(&fd, &address) {
        Ok(()) => {}
        Err(Errno::INPROGRESS) => {
            wait(&fd, PollFlags::OUT, deadline)?;
            net::sockopt::socket_error(&fd)
                .map_err(|_| "SOCKET_CONNECT")?
                .map_err(|_| "SOCKET_CONNECT")?;
            if net::getpeername(&fd)
                .map_err(|_| "SOCKET_CONNECT")?
                .is_none()
            {
                return Err("SOCKET_CONNECT");
            }
        }
        Err(_) => return Err("SOCKET_CONNECT"),
    }
    deadline.remaining()?;
    Ok(fd)
}

fn exchange(
    pin: &PinnedSocket,
    request: Request,
    deadline: &Deadline,
    bytes: &mut Vec<u8>,
) -> Result<(), &'static str> {
    let fd = connect(pin, deadline)?;
    let mut pending = request.bytes();
    while !pending.is_empty() {
        deadline.remaining()?;
        match net::send(&fd, pending, SendFlags::NOSIGNAL) {
            Ok(0) => return Err("SOCKET_WRITE"),
            Ok(count) => pending = &pending[count..],
            Err(Errno::INTR) => continue,
            Err(Errno::AGAIN) => wait(&fd, PollFlags::OUT, deadline)?,
            Err(_) => return Err("SOCKET_WRITE"),
        }
    }
    let mut buffer = [0; 4096];
    loop {
        deadline.remaining()?;
        let room = (RESPONSE_BYTES + 1 - bytes.len()).min(buffer.len());
        match net::recv(&fd, &mut buffer[..room], RecvFlags::empty()) {
            Ok((_, 0)) => return Ok(()),
            Ok((_, count)) => {
                bytes.extend_from_slice(&buffer[..count]);
                if bytes.len() > RESPONSE_BYTES {
                    return Err("RESPONSE_BYTE_BOUND");
                }
            }
            Err(Errno::INTR) => continue,
            Err(Errno::AGAIN) => wait(&fd, PollFlags::IN, deadline)?,
            Err(_) => return Err("SOCKET_READ"),
        }
    }
}

fn response_body<'a>(bytes: &'a [u8], code: &mut Option<u16>) -> Result<&'a [u8], &'static str> {
    let mut headers = [httparse::EMPTY_HEADER; 64];
    let mut response = httparse::Response::new(&mut headers);
    let offset = match response.parse(bytes).map_err(|_| "HTTP_HEADERS")? {
        httparse::Status::Complete(offset) => offset,
        httparse::Status::Partial => return Err("HTTP_TRUNCATED"),
    };
    *code = response.code;
    if response.code != Some(200) || !matches!(response.version, Some(0 | 1)) {
        return Err("HTTP_STATUS");
    }
    let mut length = None;
    let mut content_type = false;
    let mut encoding = false;
    for header in response.headers {
        if header.name.eq_ignore_ascii_case("transfer-encoding") {
            return Err("HTTP_FRAMING");
        }
        if header.name.eq_ignore_ascii_case("content-length") {
            if length.is_some() {
                return Err("HTTP_FRAMING");
            }
            let value = std::str::from_utf8(header.value)
                .map_err(|_| "HTTP_FRAMING")?
                .trim_matches([' ', '\t']);
            if value.is_empty() || !value.bytes().all(|v| v.is_ascii_digit()) {
                return Err("HTTP_FRAMING");
            }
            length = Some(value.parse::<usize>().map_err(|_| "HTTP_FRAMING")?);
        }
        if header.name.eq_ignore_ascii_case("content-type") {
            if content_type {
                return Err("HTTP_CONTENT_TYPE");
            }
            let value = std::str::from_utf8(header.value).map_err(|_| "HTTP_CONTENT_TYPE")?;
            if !value
                .split(';')
                .next()
                .is_some_and(|v| v.trim().eq_ignore_ascii_case("application/json"))
            {
                return Err("HTTP_CONTENT_TYPE");
            }
            content_type = true;
        }
        if header.name.eq_ignore_ascii_case("content-encoding") {
            if encoding || !header.value.eq_ignore_ascii_case(b"identity") {
                return Err("HTTP_ENCODING");
            }
            encoding = true;
        }
    }
    if !content_type {
        return Err("HTTP_CONTENT_TYPE");
    }
    let body = &bytes[offset..];
    if length.is_some_and(|value| value != body.len()) {
        return Err("HTTP_FRAMING");
    }
    Ok(body)
}

pub(crate) fn get<T>(
    pin: &PinnedSocket,
    request: Request,
    decode: fn(&[u8]) -> Result<T, &'static str>,
) -> Outcome<T> {
    get_with_timeout(pin, request, decode, Duration::from_secs(REQUEST_SECONDS))
}

fn get_with_timeout<T>(
    pin: &PinnedSocket,
    request: Request,
    decode: fn(&[u8]) -> Result<T, &'static str>,
    timeout: Duration,
) -> Outcome<T> {
    let origin = now();
    let deadline = match Deadline::new(origin, timeout) {
        Ok(deadline) => deadline,
        Err(error) => {
            return Outcome {
                receipt: Receipt {
                    method: "GET",
                    path: request.path(),
                    status_code: None,
                    response_bytes: 0,
                    elapsed_nanos: now().saturating_sub(origin).min(u64::MAX as u128) as u64,
                    error: Some(error),
                },
                projection: None,
            };
        }
    };
    let mut bytes = Vec::new();
    let mut status_code = None;
    let projection = (|| {
        exchange(pin, request, &deadline, &mut bytes)?;
        deadline.remaining()?;
        let body = response_body(&bytes, &mut status_code)?;
        let projection = decode(body)?;
        deadline.remaining()?;
        Ok(projection)
    })();
    let error = projection.as_ref().err().copied();
    Outcome {
        receipt: Receipt {
            method: "GET",
            path: request.path(),
            status_code,
            response_bytes: bytes.len(),
            elapsed_nanos: deadline.elapsed(),
            error,
        },
        projection: projection.ok(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rustix::fd::AsRawFd;
    use std::io::{Read, Write};
    use std::os::unix::net::{UnixListener, UnixStream};

    fn reply(body: &[u8]) -> Vec<u8> {
        let mut response = format!(
            "HTTP/1.0 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n",
            body.len()
        )
        .into_bytes();
        response.extend_from_slice(body);
        response
    }

    fn parse_length(body: &[u8]) -> Result<usize, &'static str> {
        Ok(body.len())
    }

    #[test]
    fn http_fixed_requests_and_bounds_match_independent_literals() {
        assert_eq!(RESPONSE_BYTES, 65_536);
        assert_eq!(REQUEST_SECONDS, 10);
        assert_eq!(Request::Version.bytes(), b"GET /version HTTP/1.0\r\nHost: localhost\r\nAccept: application/json\r\nAccept-Encoding: identity\r\nConnection: close\r\n\r\n");
        assert_eq!(Request::Info.bytes(), b"GET /info HTTP/1.0\r\nHost: localhost\r\nAccept: application/json\r\nAccept-Encoding: identity\r\nConnection: close\r\n\r\n");
    }

    #[test]
    fn http_deadline_descriptor_uses_boottime_absolute_nonblocking_cloexec() {
        let deadline = Deadline::new(now(), Duration::from_secs(1)).unwrap();
        let info =
            std::fs::read_to_string(format!("/proc/self/fdinfo/{}", deadline.timer.as_raw_fd()))
                .unwrap();
        let clock = info
            .lines()
            .find_map(|line| line.strip_prefix("clockid:"))
            .unwrap()
            .trim();
        let flags = info
            .lines()
            .find_map(|line| line.strip_prefix("settime flags:"))
            .unwrap()
            .trim();
        assert_eq!(clock, "7");
        assert_eq!(u32::from_str_radix(flags, 16).unwrap(), 1);
        assert!(
            rustix::io::fcntl_getfd(&deadline.timer)
                .unwrap()
                .contains(rustix::io::FdFlags::CLOEXEC)
        );
        assert!(
            rustix::fs::fcntl_getfl(&deadline.timer)
                .unwrap()
                .contains(rustix::fs::OFlags::NONBLOCK)
        );
        let remaining = rustix::time::timerfd_gettime(&deadline.timer)
            .unwrap()
            .it_value;
        assert!(remaining.tv_sec >= 0 && remaining.tv_sec <= 1);
        assert!(remaining.tv_sec > 0 || remaining.tv_nsec > 0);
    }

    #[test]
    fn http_boottime_timer_expiry_is_observable_without_socket_progress() {
        let deadline = Deadline::new(now(), Duration::from_millis(20)).unwrap();
        let mut fds = [PollFd::new(&deadline.timer, PollFlags::IN)];
        assert_eq!(
            poll(
                &mut fds,
                Some(&Timespec {
                    tv_sec: 1,
                    tv_nsec: 0
                })
            )
            .unwrap(),
            1
        );
        assert!(fds[0].revents().contains(PollFlags::IN));
        assert!(matches!(deadline.remaining(), Err("DEADLINE")));
    }

    #[test]
    fn http_expired_timer_wins_even_when_socket_is_already_readable() {
        let deadline = Deadline::new(now(), Duration::from_secs(1)).unwrap();
        let (socket, mut peer) = std::os::unix::net::UnixStream::pair().unwrap();
        let socket: OwnedFd = socket.into();
        peer.write_all(b"ready").unwrap();
        timerfd_settime(
            &deadline.timer,
            TimerfdTimerFlags::ABSTIME,
            &Itimerspec {
                it_interval: Timespec {
                    tv_sec: 0,
                    tv_nsec: 0,
                },
                it_value: Timespec {
                    tv_sec: 0,
                    tv_nsec: 1,
                },
            },
        )
        .unwrap();
        let mut timer = [PollFd::new(&deadline.timer, PollFlags::IN)];
        assert_eq!(
            poll(
                &mut timer,
                Some(&Timespec {
                    tv_sec: 1,
                    tv_nsec: 0
                })
            )
            .unwrap(),
            1
        );
        assert!(deadline.remaining().is_ok());
        assert_eq!(wait(&socket, PollFlags::IN, &deadline), Err("DEADLINE"));
    }

    #[test]
    fn http_invalid_deadline_setup_fails_before_connection_and_retains_origin() {
        let directory = tempfile::tempdir_in("/tmp/opencode").unwrap();
        let listener = UnixListener::bind(directory.path().join("socket")).unwrap();
        listener.set_nonblocking(true).unwrap();
        let pin = PinnedSocket::open(directory.path(), &["socket"]).unwrap();
        for (duration, expected) in [(Duration::ZERO, "DEADLINE"), (Duration::MAX, "CLOCK_RANGE")] {
            let result = get_with_timeout(&pin, Request::Version, parse_length, duration);
            assert_eq!(result.receipt.error, Some(expected));
            assert_eq!(result.receipt.response_bytes, 0);
            assert!(result.receipt.elapsed_nanos > 0);
            assert!(result.projection.is_none());
            assert!(
                matches!(listener.accept(), Err(error) if error.kind() == std::io::ErrorKind::WouldBlock)
            );
        }
    }

    #[test]
    fn http_expiry_during_projection_discards_the_late_result() {
        let (_directory, pin, server) = server(reply(b"{}"), false);
        let result = get_with_timeout(
            &pin,
            Request::Version,
            |body| {
                std::thread::sleep(Duration::from_millis(50));
                Ok(body.len())
            },
            Duration::from_millis(20),
        );
        assert_eq!(result.receipt.error, Some("DEADLINE"));
        assert!(result.projection.is_none());
        server.join().unwrap();
    }

    #[test]
    fn http_accepts_length_and_close_framing_only() {
        assert_eq!(response_body(&reply(b"{}"), &mut None).unwrap(), b"{}");
        assert_eq!(
            response_body(
                b"HTTP/1.0 200 OK\r\nContent-Type: application/json\r\n\r\n{}",
                &mut None
            )
            .unwrap(),
            b"{}"
        );
    }

    #[test]
    fn http_rejects_status_framing_encoding_and_truncation_without_error_text() {
        for raw in [
            "HTTP/1.0 302 Redirect\r\nContent-Type: application/json\r\n\r\nCANARY_SECRET",
            "HTTP/1.0 200 OK\r\nContent-Type: application/json\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n\r\n",
            "HTTP/1.0 200 OK\r\nContent-Type: application/json\r\nContent-Length: 2\r\nContent-Length: 2\r\n\r\n{}",
            "HTTP/1.0 200 OK\r\nContent-Type: application/json\r\nContent-Length: 3\r\n\r\n{}",
            "HTTP/1.0 200 OK\r\nContent-Type: application/json\r\nContent-Length: 1\r\n\r\n{}",
            "HTTP/1.0 200 OK\r\nContent-Type: application/json\r\nContent-Length: -1\r\n\r\n{}",
            "HTTP/1.0 200 OK\r\nContent-Type: application/json\r\nContent-Length: 999999999999999999999999999\r\n\r\n{}",
            "HTTP/1.0 200 OK\r\nContent-Type: application/json\r\nContent-Length: \u{a0}2\r\n\r\n{}",
            "HTTP/1.0 200 OK\r\nContent-Type: application/json\r\nContent-Encoding: gzip\r\n\r\n{}",
            "HTTP/1.0 200 OK\r\nContent-Type: application/json\r\nContent-Encoding: identity\r\nContent-Encoding: identity\r\n\r\n{}",
            "HTTP/1.0 200 OK\r\nContent-Type: application/json\r\nContent-Type: application/json\r\n\r\n{}",
            "HTTP/1.0 200 OK\r\nContent-Type: text/html\r\n\r\nCANARY_SECRET",
            "HTTP/1.0 200 OK\r\nContent-Length: 2\r\n\r\n{}",
            "HTTP/1.0 200 OK\r\nContent-Type: application/json\r\n",
            "not an HTTP response CANARY_SECRET",
        ] {
            let error = response_body(raw.as_bytes(), &mut None).unwrap_err();
            assert!(!error.contains("CANARY_SECRET"));
        }
    }

    #[test]
    fn http_header_count_is_bounded_independently_of_response_bytes() {
        let mut response = String::from("HTTP/1.0 200 OK\r\nContent-Type: application/json\r\n");
        for _ in 0..64 {
            response.push_str("X-Synthetic: value\r\n");
        }
        response.push_str("\r\n{}");
        assert_eq!(
            response_body(response.as_bytes(), &mut None),
            Err("HTTP_HEADERS")
        );
    }

    fn accept_for(listener: &UnixListener, timeout: Duration) -> Option<UnixStream> {
        listener.set_nonblocking(true).unwrap();
        let end = now() + timeout.as_nanos();
        while now() < end {
            match listener.accept() {
                Ok((stream, _)) => return Some(stream),
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                    std::thread::sleep(Duration::from_millis(1));
                }
                Err(error) if error.kind() == std::io::ErrorKind::Interrupted => {}
                Err(error) => panic!("synthetic listener failure: {error}"),
            }
        }
        None
    }

    fn server(
        response: Vec<u8>,
        drip: bool,
    ) -> (tempfile::TempDir, PinnedSocket, std::thread::JoinHandle<()>) {
        let directory = tempfile::tempdir_in("/tmp/opencode").unwrap();
        let listener = UnixListener::bind(directory.path().join("socket")).unwrap();
        let pin = PinnedSocket::open(directory.path(), &["socket"]).unwrap();
        let child = std::thread::spawn(move || {
            let Some(mut stream) = accept_for(&listener, Duration::from_secs(1)) else {
                return;
            };
            stream
                .set_read_timeout(Some(Duration::from_secs(1)))
                .unwrap();
            let mut bytes = Vec::new();
            while !bytes.ends_with(b"\r\n\r\n") {
                let mut byte = [0];
                if stream.read_exact(&mut byte).is_err() {
                    return;
                }
                bytes.push(byte[0]);
                assert!(bytes.len() <= 512);
            }
            assert_eq!(bytes, b"GET /version HTTP/1.0\r\nHost: localhost\r\nAccept: application/json\r\nAccept-Encoding: identity\r\nConnection: close\r\n\r\n");
            if drip {
                for byte in response {
                    if stream.write_all(&[byte]).is_err() {
                        break;
                    }
                    std::thread::sleep(Duration::from_millis(5));
                }
            } else {
                let _ = stream.write_all(&response);
            }
        });
        (directory, pin, child)
    }

    #[test]
    fn http_real_synthetic_unix_exchange_uses_fixed_request() {
        let (_directory, pin, server) = server(reply(b"{}"), false);
        let result = get(&pin, Request::Version, parse_length);
        assert_eq!(result.projection, Some(2));
        assert!(result.receipt.error.is_none());
        server.join().unwrap();
    }

    #[test]
    fn http_synthetic_server_exits_when_client_expires_before_connection() {
        let (_directory, pin, server) = server(reply(b"{}"), false);
        let origin = now();
        let result = get_with_timeout(&pin, Request::Version, parse_length, Duration::ZERO);
        assert_eq!(result.receipt.error, Some("DEADLINE"));
        server.join().unwrap();
        assert!(now() - origin < 2_000_000_000);
    }

    #[test]
    fn http_total_response_bound_counts_headers_and_detects_one_overflow_byte() {
        let (_directory, pin, server) = server(vec![b'x'; RESPONSE_BYTES + 10], false);
        let result = get(&pin, Request::Version, parse_length);
        assert_eq!(result.receipt.error, Some("RESPONSE_BYTE_BOUND"));
        assert_eq!(result.receipt.response_bytes, RESPONSE_BYTES + 1);
        server.join().unwrap();
    }

    #[test]
    fn http_exact_total_response_limit_can_complete_at_eof() {
        let header = b"HTTP/1.0 200 OK\r\nContent-Type: application/json\r\n\r\n";
        let mut response = header.to_vec();
        response.resize(RESPONSE_BYTES, b'x');
        let (_directory, pin, server) = server(response, false);
        let result = get(&pin, Request::Version, parse_length);
        assert_eq!(result.projection, Some(RESPONSE_BYTES - header.len()));
        assert_eq!(result.receipt.response_bytes, RESPONSE_BYTES);
        server.join().unwrap();
    }

    #[test]
    fn http_trickled_bytes_cannot_renew_absolute_deadline() {
        let (_directory, pin, server) = server(reply(b"{}"), true);
        let result = get_with_timeout(
            &pin,
            Request::Version,
            parse_length,
            Duration::from_millis(150),
        );
        assert_eq!(result.receipt.error, Some("DEADLINE"));
        assert!(result.receipt.elapsed_nanos < 1_000_000_000);
        server.join().unwrap();
    }

    #[test]
    fn http_complete_length_without_eof_still_obeys_the_original_deadline() {
        let directory = tempfile::tempdir_in("/tmp/opencode").unwrap();
        let listener = UnixListener::bind(directory.path().join("socket")).unwrap();
        let pin = PinnedSocket::open(directory.path(), &["socket"]).unwrap();
        let response = reply(b"{}");
        let response_length = response.len();
        let server = std::thread::spawn(move || {
            let Some(mut stream) = accept_for(&listener, Duration::from_secs(1)) else {
                return;
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
            stream.write_all(&response).unwrap();
            std::thread::sleep(Duration::from_millis(300));
        });
        let result = get_with_timeout(
            &pin,
            Request::Version,
            parse_length,
            Duration::from_millis(150),
        );
        assert_eq!(result.receipt.error, Some("DEADLINE"));
        assert_eq!(result.receipt.response_bytes, response_length);
        assert!(result.projection.is_none());
        server.join().unwrap();
    }

    #[test]
    fn http_connect_failure_stops_without_fallback() {
        let directory = tempfile::tempdir_in("/tmp/opencode").unwrap();
        let listener = UnixListener::bind(directory.path().join("socket")).unwrap();
        let pin = PinnedSocket::open(directory.path(), &["socket"]).unwrap();
        drop(listener);
        let result = get(&pin, Request::Version, parse_length);
        assert_eq!(result.receipt.error, Some("SOCKET_CONNECT"));
        assert!(result.projection.is_none());
    }
}
