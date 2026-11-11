// SPEC: _spec/gpu-cooperative-policy.md
use crate::json::Decimal;
use serde::{Deserialize, Serialize};

pub const COLD_NS: i64 = 10_000_000_000;
pub const WORK_NS: i64 = 297_000_000_000;
pub const CLEANUP_NS: i64 = 300_000_000_000;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Configuration {
    pub selected_uuid: String,
    pub startup_min_free_bytes: Decimal,
    pub running_stop_below_free_bytes: Decimal,
    pub sample_period_ns: Decimal,
    pub max_sample_age_ns: Decimal,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Sample {
    pub uuid: String,
    pub free_bytes: Decimal,
    pub total_bytes: Decimal,
    pub observed_boottime_ns: Decimal,
}

pub fn valid_uuid(value: &str) -> bool {
    value.len() == 40
        && value.starts_with("GPU-")
        && value.bytes().enumerate().skip(4).all(|(i, b)| {
            if [12, 17, 22, 27].contains(&i) {
                b == b'-'
            } else {
                b.is_ascii_hexdigit()
            }
        })
}

pub fn valid_config(c: &Configuration) -> bool {
    valid_uuid(&c.selected_uuid)
        && c.running_stop_below_free_bytes.0 > 0
        && c.running_stop_below_free_bytes <= c.startup_min_free_bytes
        && c.sample_period_ns.0 > 0
        && c.sample_period_ns <= c.max_sample_age_ns
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case", deny_unknown_fields)]
pub enum Decision {
    Admit {
        #[serde(rename = "nextCheckNs")]
        next_check_ns: Decimal,
    },
    Continue {
        #[serde(rename = "nextCheckNs")]
        next_check_ns: Decimal,
    },
    Reject {
        reason: String,
    },
    AbortOwned {
        reason: String,
        #[serde(rename = "cleanupDeadlineNs")]
        cleanup_deadline_ns: Decimal,
    },
    Terminal {
        reason: String,
    },
}

impl Decision {
    pub fn next_check_ns(&self) -> Option<i64> {
        match self {
            Self::Admit { next_check_ns } | Self::Continue { next_check_ns } => {
                Some(next_check_ns.0)
            }
            _ => None,
        }
    }
    pub fn reason(&self) -> Option<&str> {
        match self {
            Self::Reject { reason }
            | Self::AbortOwned { reason, .. }
            | Self::Terminal { reason } => Some(reason),
            _ => None,
        }
    }
}

pub struct Policy {
    configuration: Option<Configuration>,
    origin: Option<i64>,
    initial_failure: Option<&'static str>,
    first_failure: Option<&'static str>,
    running: bool,
    last_now: Option<i64>,
    sample: Option<Sample>,
}

impl Policy {
    pub fn new(configuration: Option<Configuration>, origin: Option<i64>) -> Self {
        let initial_failure = if !configuration.as_ref().is_some_and(valid_config) {
            Some("CONFIGURATION")
        } else if !origin.is_some_and(|s| (0..=i64::MAX - CLEANUP_NS).contains(&s)) {
            Some("ORIGIN")
        } else {
            None
        };
        Self {
            configuration,
            origin,
            initial_failure,
            first_failure: None,
            running: false,
            last_now: None,
            sample: None,
        }
    }
    pub fn admit(&mut self, now: Option<i64>, sample: Option<Sample>) -> Decision {
        self.accept(now, sample, true)
    }
    pub fn observe(&mut self, now: Option<i64>, sample: Option<Sample>) -> Decision {
        self.accept(now, sample, false)
    }
    pub fn check(&mut self, now: Option<i64>) -> Decision {
        match self.gate(now, false) {
            Some(d) => d,
            None => self.progress(false),
        }
    }
    fn fail(&mut self, reason: &'static str) -> Decision {
        self.first_failure = Some(reason);
        if self.running {
            Decision::AbortOwned {
                reason: reason.into(),
                cleanup_deadline_ns: Decimal(self.origin.unwrap_or(0) + CLEANUP_NS),
            }
        } else {
            Decision::Reject {
                reason: reason.into(),
            }
        }
    }
    fn expiry(&self, now: i64, sample: &Sample) -> Option<&'static str> {
        let c = self.configuration.as_ref()?;
        if i128::from(now)
            >= i128::from(sample.observed_boottime_ns.0) + i128::from(c.max_sample_age_ns.0)
        {
            Some("STALE_SAMPLE")
        } else if i128::from(now)
            >= i128::from(sample.observed_boottime_ns.0) + i128::from(c.sample_period_ns.0)
        {
            Some("MISSED_SAMPLE")
        } else {
            None
        }
    }
    fn gate(&mut self, now: Option<i64>, admit: bool) -> Option<Decision> {
        if let Some(reason) = self.first_failure {
            return Some(Decision::Terminal {
                reason: reason.into(),
            });
        }
        if let Some(reason) = self.initial_failure {
            return Some(self.fail(reason));
        }
        let s0 = self.origin.unwrap_or(0);
        let Some(now) = now.filter(|n| *n >= s0 && self.last_now.is_none_or(|last| *n >= last))
        else {
            return Some(self.fail("CLOCK"));
        };
        self.last_now = Some(now);
        let failure = if !self.running {
            if !admit {
                Some("NOT_ADMITTED")
            } else if now >= s0 + COLD_NS {
                Some("COLD_DEADLINE")
            } else {
                None
            }
        } else if admit {
            Some("ALREADY_ADMITTED")
        } else if now >= s0 + WORK_NS {
            Some("WORK_DEADLINE")
        } else {
            self.sample
                .as_ref()
                .and_then(|sample| self.expiry(now, sample))
        };
        failure.map(|reason| self.fail(reason))
    }
    fn accept(&mut self, now: Option<i64>, sample: Option<Sample>, admit: bool) -> Decision {
        if let Some(d) = self.gate(now, admit) {
            return d;
        }
        let now = now.unwrap_or(0);
        let Some(sample) = sample else {
            return self.fail("TELEMETRY");
        };
        if !valid_uuid(&sample.uuid)
            || sample.free_bytes.0 < 0
            || sample.total_bytes.0 <= 0
            || sample.free_bytes > sample.total_bytes
            || sample.observed_boottime_ns.0 < 0
        {
            return self.fail("TELEMETRY");
        }
        let c = self
            .configuration
            .as_ref()
            .expect("validated configuration");
        let failure = if sample.uuid != c.selected_uuid {
            Some("DEVICE")
        } else if sample.observed_boottime_ns.0 < self.origin.unwrap_or(0)
            || sample.observed_boottime_ns.0 > now
        {
            Some("SAMPLE_TIME")
        } else if self
            .sample
            .as_ref()
            .is_some_and(|old| sample.observed_boottime_ns <= old.observed_boottime_ns)
        {
            Some("SAMPLE_ORDER")
        } else if c.startup_min_free_bytes > sample.total_bytes
            || self
                .sample
                .as_ref()
                .is_some_and(|old| old.total_bytes != sample.total_bytes)
        {
            Some("CAPACITY")
        } else if let Some(reason) = self.expiry(now, &sample) {
            Some(reason)
        } else if sample.free_bytes
            < if self.running {
                c.running_stop_below_free_bytes
            } else {
                c.startup_min_free_bytes
            }
        {
            Some("HEADROOM")
        } else {
            None
        };
        if let Some(reason) = failure {
            return self.fail(reason);
        }
        self.sample = Some(sample);
        self.running = true;
        self.progress(admit)
    }
    fn progress(&self, admit: bool) -> Decision {
        let c = self
            .configuration
            .as_ref()
            .expect("validated configuration");
        let sample = self.sample.as_ref().expect("accepted sample");
        let next = (i128::from(sample.observed_boottime_ns.0) + i128::from(c.sample_period_ns.0))
            .min(i128::from(sample.observed_boottime_ns.0) + i128::from(c.max_sample_age_ns.0))
            .min(i128::from(self.origin.unwrap_or(0)) + i128::from(WORK_NS))
            as i64;
        if admit {
            Decision::Admit {
                next_check_ns: Decimal(next),
            }
        } else {
            Decision::Continue {
                next_check_ns: Decimal(next),
            }
        }
    }
}
