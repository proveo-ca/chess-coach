// SPEC: _spec/gpu-owner.md
use crate::{
    OwnerError, Result, docker,
    evidence::{Evidence, Phase},
    input::{self, Admission, Injection, OwnerInput, RuntimeClosure, TelemetryClosure},
    json::{self, Decimal},
    linux::{self, Boottime, Budget, Clock, Executable, LinuxWaiter, Waiter},
    observe::Observer,
    policy::Policy,
    process::{Detached, Limits, Process},
    telemetry,
    wire::{self, AttemptInput, Receiver},
};
use serde::Serialize;
use std::{cell::Cell, fs::File, io::Read, sync::Arc};

#[derive(Clone, Debug)]
pub struct RawLaunchRequest {
    pub input_manifest: String,
    pub expected_manifest_sha256: String,
}

#[derive(Debug, Serialize)]
pub struct Report {
    pub success: bool,
    pub first_failure: Option<String>,
    pub cleanup_errors: Vec<String>,
    pub proposal_json: Option<String>,
    pub cgroup_gone: bool,
    pub all_helpers_reaped: bool,
    #[serde(serialize_with = "serialize_origin")]
    pub origin_ns: i64,
    pub training_ready: bool,
}
fn serialize_origin<S: serde::Serializer>(
    value: &i64,
    serializer: S,
) -> std::result::Result<S::Ok, S::Error> {
    Decimal(*value).serialize(serializer)
}
impl Report {
    fn new(origin_ns: i64) -> Self {
        Self {
            success: false,
            first_failure: None,
            cleanup_errors: Vec::new(),
            proposal_json: None,
            cgroup_gone: false,
            all_helpers_reaped: true,
            origin_ns,
            training_ready: false,
        }
    }
    fn fail(&mut self, error: OwnerError) {
        if self.first_failure.is_none() {
            self.first_failure = Some(error.0.into());
        }
    }
    fn cleanup_fault(&mut self, error: OwnerError) {
        self.fail(error);
        if !self.cleanup_errors.iter().any(|reason| reason == error.0) {
            self.cleanup_errors.push(error.0.into());
        }
    }
}

pub fn run_once(request: RawLaunchRequest) -> Result<Report> {
    run_once_with(request, &Boottime, &mut LinuxWaiter)
}

pub fn run_once_with(
    request: RawLaunchRequest,
    clock: &impl Clock,
    waiter: &mut impl Waiter,
) -> Result<Report> {
    let budget = Budget::capture(clock)?;
    let clock = TrackedClock {
        inner: clock,
        last: Cell::new(budget.origin_ns),
    };
    let mut report = Report::new(budget.origin_ns);
    let prepared = prepare(request, &clock, budget);
    let prepared = match prepared {
        Ok(p) => p,
        Err(error) => {
            report.fail(error);
            return Ok(report);
        }
    };
    let mut runtime = Runtime {
        input: prepared.input,
        embedded: prepared.embedded,
        docker: prepared.docker,
        telemetry: prepared.telemetry,
        injection: prepared.injection,
        observer: prepared.observer,
        evidence: prepared.evidence,
        config_directory: prepared.config_directory,
        state_directory: prepared.state_directory,
        clock: &clock,
        waiter,
        budget,
        report,
        helpers: Vec::new(),
        recorded: Vec::new(),
        query: None,
        attach: None,
        policy: prepared.policy,
        next_check: None,
        next_query: None,
        receiver: Receiver::default(),
        container_id: None,
        creation_attempted: false,
        last_now: budget.origin_ns,
    };
    if let Err(error) = runtime.work() {
        runtime.report.fail(error);
    }
    runtime.cleanup();
    runtime.report.success = runtime.report.first_failure.is_none()
        && runtime.report.proposal_json.is_some()
        && runtime.report.cgroup_gone
        && runtime.report.all_helpers_reaped
        && !runtime.evidence.failed;
    Ok(runtime.report)
}

struct TrackedClock<'a, C: Clock> {
    inner: &'a C,
    last: Cell<i64>,
}
impl<C: Clock> Clock for TrackedClock<'_, C> {
    fn now_ns(&self) -> Result<i64> {
        let now = self.inner.now_ns()?;
        if now < self.last.get() {
            return Err(OwnerError("CLOCK"));
        }
        self.last.set(now);
        Ok(now)
    }
}

struct Prepared {
    input: OwnerInput,
    embedded: AttemptInput,
    docker: Arc<Executable>,
    telemetry: Arc<Executable>,
    injection: Injection,
    observer: Observer,
    evidence: Evidence,
    config_directory: DirectoryCustody,
    state_directory: DirectoryCustody,
    policy: Policy,
}

struct DirectoryCustody {
    path: String,
    file: File,
    identity: linux::Identity,
}
impl DirectoryCustody {
    fn new(path: &str, file: File) -> Result<Self> {
        let identity = linux::Identity::of(&file)?;
        let custody = Self {
            path: path.into(),
            file,
            identity,
        };
        custody.check()?;
        Ok(custody)
    }
    fn check(&self) -> Result<()> {
        if linux::Identity::of(&self.file)? != self.identity
            || linux::Identity::of(&linux::open_directory(&self.path)?)? != self.identity
        {
            return Err(OwnerError("DIRECTORY_REPLACED"));
        }
        Ok(())
    }
}

fn registered_json<T: serde::de::DeserializeOwned>(
    file: &input::FileExpectation,
    clock: &impl Clock,
    budget: Budget,
) -> Result<T> {
    let mut file = linux::verified_file(file, || budget.before(clock, budget.cold_ns).map(|_| ()))?;
    let mut bytes = Vec::new();
    file.by_ref()
        .take(262145)
        .read_to_end(&mut bytes)
        .map_err(|_| OwnerError("PROVENANCE_READ"))?;
    let value = json::decode(&bytes, 262144)?;
    budget.before(clock, budget.cold_ns)?;
    Ok(value)
}

fn prepare(request: RawLaunchRequest, clock: &impl Clock, budget: Budget) -> Result<Prepared> {
    budget.before(clock, budget.cold_ns)?;
    let input = OwnerInput::parse(
        request.input_manifest.as_bytes(),
        &request.expected_manifest_sha256,
    )?;
    budget.before(clock, budget.cold_ns)?;
    let embedded = AttemptInput::parse(&input)?;
    let admission: Admission =
        registered_json(&input.outside_control.admission_receipt, clock, budget)?;
    if admission.version != "chess-coach.outside-admission.v1"
        || admission.expected_self_envelope != input.outside_control.expected_self_envelope
    {
        return Err(OwnerError("ADMISSION_PROVENANCE"));
    }
    let runtime: RuntimeClosure = registered_json(&input.job.runtime_closure, clock, budget)?;
    if runtime.version != "chess-coach.gpu-runtime-closure.v1"
        || runtime.image_id != input.job.image_id
        || runtime.selected_uuid != input.cooperative.selected_uuid
        || runtime.profile_mode != input.job.gpu_profile.mode
        || runtime.input_sha256 != input.job.job_input_ref.sha256
    {
        return Err(OwnerError("RUNTIME_PROVENANCE"));
    }
    let closure: TelemetryClosure =
        registered_json(&input.telemetry.runtime_closure, clock, budget)?;
    if closure.version != "chess-coach.telemetry-closure.v1"
        || closure.executable != input.telemetry.executable.identity()
        || closure.expected_driver != input.telemetry.expected_driver
        || closure.selected_uuid != input.cooperative.selected_uuid
    {
        return Err(OwnerError("TELEMETRY_PROVENANCE"));
    }
    let injection: Injection =
        registered_json(&input.job.gpu_profile.injection_inventory, clock, budget)?;
    injection.validate(&input.cooperative.selected_uuid)?;
    let docker = Arc::new(Executable::open(&input.docker.executable, || {
        budget.before(clock, budget.cold_ns).map(|_| ())
    })?);
    let telemetry = Arc::new(Executable::open(&input.telemetry.executable, || {
        budget.before(clock, budget.cold_ns).map(|_| ())
    })?);
    let config = linux::empty_private_directory(&input.docker.anonymous_config_directory)?;
    let state = linux::empty_private_directory(&input.job.state_host_source)?;
    if linux::Identity::of(&config)? == linux::Identity::of(&state)? {
        return Err(OwnerError("DIRECTORY_ALIAS"));
    }
    let config_directory = DirectoryCustody::new(&input.docker.anonymous_config_directory, config)?;
    let state_directory = DirectoryCustody::new(&input.job.state_host_source, state)?;
    linux::socket_path(&input.docker.endpoint_unix_socket)?;
    let observer = Observer::new(&input)?;
    budget.before(clock, budget.cold_ns)?;
    let mut evidence = Evidence::create(&input.evidence.exclusive_packet_root)?;
    evidence.write(
        "owner-input.json",
        request.input_manifest.as_bytes(),
        Phase::Working,
    )?;
    budget.before(clock, budget.cold_ns)?;
    let policy = Policy::new(Some(input.cooperative.clone()), Some(budget.origin_ns));
    Ok(Prepared {
        input,
        embedded,
        docker,
        telemetry,
        injection,
        observer,
        evidence,
        config_directory,
        state_directory,
        policy,
    })
}

struct Runtime<'a, C: Clock, W: Waiter> {
    input: OwnerInput,
    embedded: AttemptInput,
    docker: Arc<Executable>,
    telemetry: Arc<Executable>,
    injection: Injection,
    observer: Observer,
    evidence: Evidence,
    config_directory: DirectoryCustody,
    state_directory: DirectoryCustody,
    clock: &'a C,
    waiter: &'a mut W,
    budget: Budget,
    report: Report,
    helpers: Vec<Detached>,
    recorded: Vec<bool>,
    query: Option<(usize, i64)>,
    attach: Option<usize>,
    policy: Policy,
    next_check: Option<i64>,
    next_query: Option<i64>,
    receiver: Receiver,
    container_id: Option<String>,
    creation_attempted: bool,
    last_now: i64,
}

impl<C: Clock, W: Waiter> Runtime<'_, C, W> {
    fn check_working_custody(&self) -> Result<()> {
        self.config_directory
            .check()
            .map_err(|_| OwnerError("ANONYMOUS_CONFIG_REPLACED"))?;
        self.state_directory
            .check()
            .map_err(|_| OwnerError("STATE_PATH_REPLACED"))
    }
    fn now(&mut self, deadline: i64) -> Result<i64> {
        let now = self.budget.before(self.clock, deadline)?;
        if now < self.last_now {
            return Err(OwnerError("CLOCK"));
        }
        self.last_now = now;
        Ok(now)
    }
    fn work_deadline(&self) -> i64 {
        if self.receiver.startup {
            self.budget.work_ns
        } else {
            self.budget.cold_ns
        }
    }
    fn spawn(
        &mut self,
        role: &str,
        args: Vec<String>,
        query: bool,
        interactive: bool,
        phase: Phase,
    ) -> Result<usize> {
        self.config_directory
            .check()
            .map_err(|_| OwnerError("ANONYMOUS_CONFIG_REPLACED"))?;
        if phase == Phase::Working {
            self.check_working_custody()?;
        }
        let now = self.now(if phase == Phase::Working {
            self.work_deadline()
        } else {
            self.budget.cleanup_ns
        })?;
        if phase == Phase::Working && self.next_check.is_some() {
            let decision = self.policy.check(Some(now));
            self.policy_result(decision)?;
        }
        let index = self.helpers.len();
        if let Err(error) =
            self.evidence
                .json(&format!("helper-{index:04}-argv.json"), &args, phase)
        {
            if phase == Phase::Working {
                return Err(error);
            }
            self.report.cleanup_fault(error);
        }
        let now = self.now(if phase == Phase::Working {
            self.work_deadline()
        } else {
            self.budget.cleanup_ns
        })?;
        if phase == Phase::Working && self.next_check.is_some() {
            let decision = self.policy.check(Some(now));
            self.policy_result(decision)?;
        }
        let limits = if query {
            Limits {
                stdout: 4096,
                stderr: 4096,
                pending: 0,
            }
        } else if interactive {
            Limits {
                stdout: wire::OUTPUT_BYTES,
                stderr: 65536,
                pending: 1024 * 1024,
            }
        } else {
            Limits {
                stdout: 1024 * 1024,
                stderr: 65536,
                pending: 0,
            }
        };
        self.config_directory
            .check()
            .map_err(|_| OwnerError("ANONYMOUS_CONFIG_REPLACED"))?;
        if phase == Phase::Working {
            self.check_working_custody()?;
        }
        if role == "create" {
            self.creation_attempted = true;
        }
        let process = Process::spawn(
            if query {
                self.telemetry.clone()
            } else {
                self.docker.clone()
            },
            &args,
            interactive,
            limits,
        )?;
        self.helpers.push(Detached {
            role: role.into(),
            process,
        });
        self.recorded.push(false);
        self.report.all_helpers_reaped = false;
        Ok(index)
    }
    fn record(&mut self, index: usize, phase: Phase) -> Result<()> {
        if self.recorded[index] || (self.evidence.failed && phase == Phase::Cleanup) {
            return Ok(());
        }
        let process = &self.helpers[index].process;
        self.evidence.write(
            &format!("helper-{index:04}-stdout"),
            &process.stdout.prefix,
            phase,
        )?;
        self.evidence.write(
            &format!("helper-{index:04}-stderr"),
            &process.stderr.prefix,
            phase,
        )?;
        let metadata = serde_json::json!({"role":self.helpers[index].role,"stdoutReceived":process.stdout.received,"stderrReceived":process.stderr.received,
            "stdoutEof":process.stdout.eof,"stderrEof":process.stderr.eof,"exitCode":process.status.and_then(|s|s.code()),"reaped":process.status.is_some(),"naturalClean":process.natural_clean()});
        self.evidence
            .json(&format!("helper-{index:04}-exit.json"), &metadata, phase)?;
        self.recorded[index] = true;
        Ok(())
    }
    fn policy_result(&mut self, decision: crate::policy::Decision) -> Result<()> {
        if let Some(next) = decision.next_check_ns() {
            self.next_check = Some(next);
            Ok(())
        } else {
            Err(OwnerError(match decision.reason().unwrap_or("TELEMETRY") {
                "CONFIGURATION" => "CONFIGURATION",
                "ORIGIN" => "ORIGIN",
                "CLOCK" => "CLOCK",
                "NOT_ADMITTED" => "NOT_ADMITTED",
                "ALREADY_ADMITTED" => "ALREADY_ADMITTED",
                "COLD_DEADLINE" => "COLD_DEADLINE",
                "WORK_DEADLINE" => "WORK_DEADLINE",
                "DEVICE" => "DEVICE",
                "CAPACITY" => "CAPACITY",
                "SAMPLE_TIME" => "SAMPLE_TIME",
                "SAMPLE_ORDER" => "SAMPLE_ORDER",
                "STALE_SAMPLE" => "STALE_SAMPLE",
                "MISSED_SAMPLE" => "MISSED_SAMPLE",
                "HEADROOM" => "HEADROOM",
                _ => "TELEMETRY",
            }))
        }
    }
    fn launch_query(&mut self) -> Result<()> {
        if self.query.is_some() {
            return Err(OwnerError("TELEMETRY_OVERLAP"));
        }
        let q0 = self.now(self.work_deadline())?;
        if let Some(next_check) = self.next_check {
            let latest = i128::from(next_check)
                - i128::from(self.input.telemetry.query_budget_ns.0)
                - i128::from(self.input.telemetry.scheduling_reserve_ns.0);
            if i128::from(q0) > latest {
                return Err(OwnerError("TELEMETRY_LATE_QUERY"));
            }
        }
        let index = self.spawn(
            "query",
            telemetry::argv(&self.input.cooperative.selected_uuid),
            true,
            false,
            Phase::Working,
        )?;
        self.query = Some((index, q0));
        self.next_query = None;
        Ok(())
    }
    fn tick(&mut self) -> Result<()> {
        let now = self.now(self.work_deadline())?;
        if self.next_check.is_some() {
            let decision = self.policy.check(Some(now));
            self.policy_result(decision)?;
        }
        if let Some((_, q0)) = self.query
            && i128::from(now)
                >= i128::from(q0) + i128::from(self.input.telemetry.query_budget_ns.0)
        {
            return Err(OwnerError("TELEMETRY_QUERY_DEADLINE"));
        }
        if self.query.is_none() && self.next_query.is_some_and(|next| now >= next) {
            self.launch_query()?;
        }
        for index in 0..self.helpers.len() {
            let progress = if !self.helpers[index].process.complete() {
                self.helpers[index].process.pump()
            } else {
                Ok(())
            };
            let now = self.now(self.work_deadline())?;
            if self.next_check.is_some() {
                let decision = self.policy.check(Some(now));
                self.policy_result(decision)?;
            }
            if let Some((_, q0)) = self.query
                && i128::from(now)
                    >= i128::from(q0) + i128::from(self.input.telemetry.query_budget_ns.0)
            {
                return Err(OwnerError("TELEMETRY_QUERY_DEADLINE"));
            }
            progress?;
        }
        if let Some((index, q0)) = self.query
            && self.helpers[index].process.complete()
        {
            let sample = telemetry::finish(
                &self.helpers[index].process,
                &self.input.telemetry,
                &self.input.cooperative.selected_uuid,
                q0,
                self.clock.now_ns()?,
            )?;
            let q1 = self.now(self.work_deadline())?;
            if i128::from(q1) >= i128::from(q0) + i128::from(self.input.telemetry.query_budget_ns.0)
            {
                return Err(OwnerError("TELEMETRY_QUERY_DEADLINE"));
            }
            let decision = if self.next_check.is_none() {
                self.policy.admit(Some(q1), Some(sample))
            } else {
                self.policy.observe(Some(q1), Some(sample))
            };
            self.policy_result(decision)?;
            self.next_query = Some(telemetry::next_query(
                q0,
                self.next_check.ok_or(OwnerError("TELEMETRY_LEASE"))?,
                &self.input.telemetry,
            )?);
            self.query = None;
            self.record(index, Phase::Working)?;
        }
        if let Some(index) = self.attach {
            let admission_deadline = self.work_deadline();
            self.now(admission_deadline)?;
            let process = &mut self.helpers[index].process;
            self.receiver.receive(
                &process.stdout.prefix,
                process.write_complete,
                &self.input,
                &self.embedded,
            )?;
            if process.complete() {
                if !process.natural_clean() {
                    return Err(OwnerError("ATTACH_EXIT"));
                }
                self.receiver.finish(&process.stdout.prefix)?;
            }
            self.now(admission_deadline)?;
        }
        let now = self.now(self.work_deadline())?;
        if self.next_check.is_some() {
            let decision = self.policy.check(Some(now));
            self.policy_result(decision)?;
        }
        Ok(())
    }
    fn wait_work(&mut self) -> Result<()> {
        let mut deadline = self.work_deadline();
        if let Some(next) = self.next_check {
            deadline = deadline.min(next);
        }
        if let Some(next) = self.next_query {
            deadline = deadline.min(next);
        }
        if let Some((_, q0)) = self.query {
            deadline = deadline.min(
                q0.checked_add(self.input.telemetry.query_budget_ns.0)
                    .ok_or(OwnerError("TELEMETRY_RANGE"))?,
            );
        }
        let now = self.now(self.work_deadline())?;
        if now >= deadline {
            return Ok(());
        }
        let watches = self
            .helpers
            .iter()
            .flat_map(|h| h.process.watches())
            .collect::<Vec<_>>();
        match self.waiter.wait_until(deadline, &watches) {
            Ok(_) => Ok(()),
            Err(OwnerError("DEADLINE")) => Ok(()),
            Err(e) => Err(e),
        }
    }
    fn command(&mut self, role: &str, args: Vec<String>) -> Result<usize> {
        let index = self.spawn(role, args, false, false, Phase::Working)?;
        loop {
            self.tick()?;
            if self.helpers[index].process.complete() {
                self.check_working_custody()?;
                self.record(index, Phase::Working)?;
                if !self.helpers[index].process.natural_clean() {
                    return Err(OwnerError("MANAGER_EXIT"));
                }
                return Ok(index);
            }
            self.wait_work()?;
        }
    }
    fn work(&mut self) -> Result<()> {
        self.launch_query()?;
        while self.next_check.is_none() {
            self.tick()?;
            if self.next_check.is_none() {
                self.wait_work()?;
            }
        }
        self.observer.check_outside(&self.input)?;
        self.evidence.json("STARTED.json",&serde_json::json!({"status":"STARTED","originNs":Decimal(self.budget.origin_ns),
            "sessionId":self.input.ownership.session_id,"attemptId":self.input.ownership.attempt_id}),Phase::Working)?;
        self.now(self.work_deadline())?;
        let create = self.command("create", docker::create(&self.input))?;
        let id = docker::id(&self.helpers[create].process.stdout.prefix)?;
        self.container_id = Some(id.clone());
        let inspect = self.command("inspect-created", docker::inspect(&self.input, &id))?;
        let (_, value) = docker::ownership(
            &self.helpers[inspect].process.stdout.prefix,
            &self.input,
            Some(&id),
        )?;
        docker::validate_c2(&value, &self.input, &self.injection)?;
        let attach = self.spawn(
            "attach",
            docker::start(&self.input, &id),
            false,
            true,
            Phase::Working,
        )?;
        self.attach = Some(attach);
        while !self.receiver.boot {
            self.tick()?;
            if !self.receiver.boot {
                self.wait_work()?;
            }
        }
        let inspect = self.command("inspect-running", docker::inspect(&self.input, &id))?;
        let (owned, value) = docker::ownership(
            &self.helpers[inspect].process.stdout.prefix,
            &self.input,
            Some(&id),
        )?;
        docker::validate_c2(&value, &self.input, &self.injection)?;
        if !owned.running {
            return Err(OwnerError("CONTAINER_NOT_RUNNING"));
        }
        self.observer.bind(owned.pid, &self.input)?;
        let now = self.now(self.work_deadline())?;
        let start = wire::start(&self.input, now - self.budget.origin_ns)?;
        self.evidence
            .write("job-start.json", &start, Phase::Working)?;
        self.now(self.work_deadline())?;
        self.check_working_custody()?;
        self.helpers[attach].process.queue_and_close(start)?;
        loop {
            self.tick()?;
            if self.helpers[attach].process.complete() {
                self.receiver
                    .finish(&self.helpers[attach].process.stdout.prefix)?;
                self.report.proposal_json = self.receiver.proposal_json.clone();
                self.record(attach, Phase::Working)?;
                return Ok(());
            }
            self.wait_work()?;
        }
    }
    fn stop(&mut self, index: usize) {
        if let Err(error) = self.helpers[index].process.kill_owned() {
            self.report.cleanup_fault(error);
        }
    }
    fn cleanup_tick(&mut self) -> Result<()> {
        self.now(self.budget.cleanup_ns)?;
        for index in 0..self.helpers.len() {
            if !self.helpers[index].process.complete()
                && let Err(error) = self.helpers[index].process.cleanup_pump()
            {
                self.report.cleanup_fault(error);
            }
            self.now(self.budget.cleanup_ns)?;
            if self.helpers[index].process.complete()
                && let Err(error) = self.record(index, Phase::Cleanup)
            {
                self.report.cleanup_fault(error);
            }
        }
        Ok(())
    }
    fn cleanup_wait(&mut self) -> Result<()> {
        let now = self.now(self.budget.cleanup_ns)?;
        let deadline = now.saturating_add(10_000_000).min(self.budget.cleanup_ns);
        let watches = self
            .helpers
            .iter()
            .flat_map(|h| h.process.cleanup_watches())
            .collect::<Vec<_>>();
        match self.waiter.wait_until(deadline, &watches) {
            Ok(_) | Err(OwnerError("DEADLINE")) => Ok(()),
            Err(e) => Err(e),
        }
    }
    fn cleanup_command(&mut self, role: &str, args: Vec<String>) -> Result<usize> {
        let index = self.spawn(role, args, false, false, Phase::Cleanup)?;
        loop {
            self.cleanup_tick()?;
            if self.helpers[index].process.complete() {
                if !self.helpers[index].process.natural_clean() {
                    return Err(OwnerError("CLEANUP_MANAGER_EXIT"));
                }
                return Ok(index);
            }
            self.cleanup_wait()?;
        }
    }
    fn cleanup_owned(&mut self) -> Result<()> {
        if !self.creation_attempted {
            return Ok(());
        }
        let reference = self
            .container_id
            .clone()
            .unwrap_or_else(|| self.input.ownership.container_name.clone());
        let inspect =
            self.cleanup_command("cleanup-inspect", docker::inspect(&self.input, &reference))?;
        let (owned, _) = docker::ownership(
            &self.helpers[inspect].process.stdout.prefix,
            &self.input,
            self.container_id.as_deref(),
        )?;
        self.container_id = Some(owned.id.clone());
        if self.observer.bound_path().is_none() {
            if owned.running && owned.pid != 0 {
                if let Err(error) = self.observer.bind(owned.pid, &self.input) {
                    self.report.cleanup_fault(error);
                }
            } else if self.attach.is_some() {
                self.report.cleanup_fault(OwnerError("C8_UNBOUND"));
            }
        } else {
            if let Err(error) = self.observer.stable() {
                self.report.cleanup_fault(error);
            }
        }
        if let Some(attach) = self.attach {
            self.stop(attach);
        }
        self.cleanup_command("remove", docker::remove(&self.input, &owned.id, true))?;
        Ok(())
    }
    fn cleanup(&mut self) {
        for index in 0..self.helpers.len() {
            if Some(index) != self.attach {
                self.stop(index);
            }
        }
        if let Err(error) = self.cleanup_owned() {
            self.report.cleanup_fault(error);
        }
        for index in 0..self.helpers.len() {
            self.stop(index);
        }
        loop {
            if let Err(error) = self.cleanup_tick() {
                self.report.cleanup_fault(error);
                break;
            }
            self.report.all_helpers_reaped = self.helpers.iter().all(|h| h.process.complete());
            if self.observer.bound_path().is_some() {
                match self.observer.gone() {
                    Ok(gone) => self.report.cgroup_gone = gone,
                    Err(error) => {
                        self.report.cleanup_fault(error);
                        break;
                    }
                }
            }
            if self.report.all_helpers_reaped
                && (self.report.cgroup_gone || self.observer.bound_path().is_none())
            {
                break;
            }
            if let Err(error) = self.cleanup_wait() {
                self.report.cleanup_fault(error);
                break;
            }
        }
        self.report.all_helpers_reaped = self.helpers.iter().all(|h| h.process.complete());
        if self.creation_attempted && !self.report.cgroup_gone {
            self.report.cleanup_fault(OwnerError("CGROUP_NOT_GONE"));
        }
        if !self.report.all_helpers_reaped {
            self.report.cleanup_fault(OwnerError("HELPERS_NOT_REAPED"));
        }
        if self.evidence.failed {
            self.report.fail(OwnerError("EVIDENCE_FAILED"));
        }
        if let Err(error) = self.now(self.budget.cleanup_ns) {
            self.report.cleanup_fault(error);
        }
    }
}
