// SPEC: _spec/apps/arena/burn-compat.puml
use crate::engine_v2::{
    CloseReply, CommitReply, EngineClient, FailureCode, Namespace, OpenReply, StartReply,
};
use crate::record::*;
use crate::run::{decide, requests, validate_open};
use serde::Serialize;
use training_native::contracts::Side;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum VerificationKind {
    Terminal,
    WindowLimited,
    NativeRejection,
}

#[derive(Clone, Debug)]
pub struct VerifiedRun {
    spec: MatchSpec,
    kind: VerificationKind,
    outcome: Option<Outcome>,
    completed_windows: u32,
}

impl VerifiedRun {
    pub fn spec(&self) -> &MatchSpec {
        &self.spec
    }
    pub fn kind(&self) -> VerificationKind {
        self.kind
    }
    pub fn outcome(&self) -> Option<&Outcome> {
        self.outcome.as_ref()
    }
    pub fn completed_windows(&self) -> u32 {
        self.completed_windows
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplayError {
    pub message: String,
    pub verified_prefix_windows: u32,
}

impl std::fmt::Display for ReplayError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            formatter,
            "{} (verified prefix: {} windows)",
            self.message, self.verified_prefix_windows
        )
    }
}
impl std::error::Error for ReplayError {}

pub fn replay_record(record: &RunRecord) -> Result<VerifiedRun, ReplayError> {
    let mut verified_prefix_windows = 0;
    let result = (|| {
        record.validate_bounds()?;
        if matches!(
            record.stop,
            RunStop::Terminal | RunStop::WindowLimit | RunStop::NativeRejection { .. }
        ) && record.cleanup != (CleanupStatus::Exited { success: true })
        {
            return Err("Completed native records require confirmed clean worker exit".into());
        }
        if serde_json::to_vec(record).map_err(|e| e.to_string())?.len() > MAX_RECORD_BYTES {
            return Err("Run record exceeds 16 MiB".into());
        }
        let mut client = EngineClient::new()?;
        let kind = reconstruct(&mut client, record, &mut verified_prefix_windows)?;
        client.finish()?;
        Ok(VerifiedRun {
            spec: record.spec.clone(),
            kind,
            outcome: record.outcome.clone(),
            completed_windows: record.completed_windows,
        })
    })();
    result.map_err(|message| ReplayError {
        message,
        verified_prefix_windows,
    })
}

fn reconstruct(
    client: &mut EngineClient,
    record: &RunRecord,
    verified_prefix: &mut u32,
) -> Result<VerificationKind, String> {
    let ns = Namespace::Replay;
    let StartReply::Started {
        session,
        fixture,
        initial,
        outcome: mut native_outcome,
    } = client
        .start(ns, record.spec.fixture)
        .map_err(|e| e.to_string())?;
    if session == 0 || fixture != record.spec.fixture || record.initial.as_ref() != Some(&initial) {
        return Err("Replay initial fixture/image mismatch".into());
    }
    let mut image = initial;
    for (ordinal, window) in record.windows.iter().enumerate() {
        if native_outcome.is_some() {
            return Err("Recorded windows continue after a native terminal".into());
        }
        let OpenReply::Planning { context, views } = client
            .open(ns, session, ordinal as u32)
            .map_err(|e| e.to_string())?
        else {
            return Err("Replay reached a terminal before a recorded decision".into());
        };
        validate_open(&context, &views, session, ordinal as u32)?;
        if context != window.context || views != window.views {
            return Err("Replay planning context/view mismatch".into());
        }
        verify_decisions(client, record, &context, &views, &window.decisions)?;
        let CommitReply::Committed {
            context: actual,
            begin,
            settlement,
        } = client
            .commit(ns, &context, &requests(&window.decisions))
            .map_err(|e| e.to_string())?;
        if actual != context
            || begin != window.begin
            || settlement != window.settlement
            || begin.before != image
        {
            return Err("Replay native begin/commit/resolve frame mismatch".into());
        }
        image = settlement.after;
        native_outcome = settlement.outcome;
        if let Some(outcome) = &native_outcome {
            outcome.validate()?;
        }
        *verified_prefix += 1;
    }
    let ordinal = record.completed_windows;
    let kind = match &record.stop {
        RunStop::Terminal => {
            if record.failed_attempt.is_some() || record.aborted_planning.is_some() {
                return Err("Terminal record contains a failed decision".into());
            }
            if native_outcome.is_none() {
                let OpenReply::Terminal {
                    session: actual,
                    outcome,
                    image: terminal_image,
                    begin,
                } = client
                    .open(ns, session, ordinal)
                    .map_err(|e| e.to_string())?
                else {
                    return Err("Recorded terminal is a nonterminal native planning window".into());
                };
                if actual != session || begin != record.trailing_begin {
                    return Err("Replay terminal begin/order mismatch".into());
                }
                image = terminal_image;
                native_outcome = Some(outcome);
            } else if record.trailing_begin.is_some() {
                return Err("Unexpected begin after a native terminal".into());
            }
            if native_outcome.is_none() {
                return Err("Missing native terminal outcome".into());
            }
            VerificationKind::Terminal
        }
        RunStop::WindowLimit => {
            if ordinal != record.spec.max_windows
                || native_outcome.is_some()
                || record.failed_attempt.is_some()
                || record.aborted_planning.is_some()
            {
                return Err("Invalid window-limit stop classification".into());
            }
            let OpenReply::Planning { context, views } = client
                .open(ns, session, ordinal)
                .map_err(|e| e.to_string())?
            else {
                return Err("Host window limit masked an actual native terminal".into());
            };
            validate_open(&context, &views, session, ordinal)?;
            let CloseReply::Closed {
                session: actual,
                pending_begin,
                image: closed_image,
                outcome,
            } = client.close(ns, session).map_err(|e| e.to_string())?;
            if actual != session
                || pending_begin.is_none()
                || pending_begin != record.trailing_begin
                || outcome.is_some()
            {
                return Err("Replay deferred window-limit begin mismatch".into());
            }
            check_final(record, &closed_image, &outcome)?;
            return Ok(VerificationKind::WindowLimited);
        }
        RunStop::NativeRejection { message } => {
            if native_outcome.is_some()
                || record.trailing_begin.is_some()
                || record.aborted_planning.is_some()
                || ordinal >= record.spec.max_windows
            {
                return Err("Invalid native-rejection stop classification".into());
            }
            let attempt = record
                .failed_attempt
                .as_ref()
                .ok_or("Missing native rejection witness")?;
            let OpenReply::Planning { context, views } = client
                .open(ns, session, ordinal)
                .map_err(|e| e.to_string())?
            else {
                return Err("Replay reached terminal instead of native rejection".into());
            };
            validate_open(&context, &views, session, ordinal)?;
            if context != attempt.context || views != attempt.views {
                return Err("Rejection planning context/view mismatch".into());
            }
            verify_decisions(client, record, &context, &views, &attempt.decisions)?;
            match client.commit(ns, &context, &requests(&attempt.decisions)) {
                Ok(_) => return Err("Replay admitted a recorded rejected queue".into()),
                Err(error) => {
                    let packet = error.packet.ok_or_else(|| error.message.clone())?;
                    if packet.code != FailureCode::NativeRejection
                        || packet.message != *message
                        || packet.context.as_ref() != Some(&context)
                        || packet.witness.as_ref() != Some(&attempt.witness)
                    {
                        return Err("Replay native rejection/error/witness mismatch".into());
                    }
                }
            }
            image = attempt.witness.image.clone();
            native_outcome = attempt.witness.outcome.clone();
            VerificationKind::NativeRejection
        }
        RunStop::PlanningFailure { .. } | RunStop::BridgeFailure { .. } => {
            verify_aborted_prefix(client, record, session)?;
            client.finish()?;
            return Err(
                "Known prefix replayed; the recorded planning/bridge failure remains unverified"
                    .into(),
            );
        }
    };
    check_final(record, &image, &native_outcome)?;
    let CloseReply::Closed {
        session: actual,
        pending_begin,
        image: closed_image,
        outcome,
    } = client.close(ns, session).map_err(|e| e.to_string())?;
    if actual != session
        || pending_begin.is_some()
        || image != closed_image
        || native_outcome != outcome
    {
        return Err("Replay final close/image/outcome mismatch".into());
    }
    Ok(kind)
}

fn check_final(
    record: &RunRecord,
    image: &StateImage,
    outcome: &Option<Outcome>,
) -> Result<(), String> {
    if record.final_image.as_ref() != Some(image) || &record.outcome != outcome {
        return Err("Replay final image/outcome mismatch".into());
    }
    Ok(())
}

fn verify_decisions(
    client: &mut EngineClient,
    record: &RunRecord,
    context: &EngineContext,
    views: &Pair<training_native::contracts::AuthorizedView>,
    expected: &Pair<Decision>,
) -> Result<(), String> {
    let regenerated = Pair {
        w: decide(
            client,
            &views.w,
            record.spec.players.w,
            decision_seed(
                record.spec.policy_seeds.w,
                context.planning_ordinal,
                Side::White,
            ),
        )?,
        b: decide(
            client,
            &views.b,
            record.spec.players.b,
            decision_seed(
                record.spec.policy_seeds.b,
                context.planning_ordinal,
                Side::Black,
            ),
        )?,
    };
    if &regenerated != expected {
        return Err("Replay policy/seed/key/actions/spend/generation diagnostics mismatch".into());
    }
    Ok(())
}

fn verify_aborted_prefix(
    client: &mut EngineClient,
    record: &RunRecord,
    session: u32,
) -> Result<(), String> {
    if let Some(aborted) = &record.aborted_planning {
        let OpenReply::Planning { context, views } = client
            .open(Namespace::Replay, session, record.completed_windows)
            .map_err(|e| e.to_string())?
        else {
            return Err("Aborted decision follows a native terminal".into());
        };
        validate_open(&context, &views, session, record.completed_windows)?;
        if context != aborted.context || views != aborted.views {
            return Err("Aborted planning context/view mismatch".into());
        }
        for side in [Side::White, Side::Black] {
            if let Some(expected) = aborted.decisions.get(side) {
                let regenerated = decide(
                    client,
                    views.get(side),
                    *record.spec.players.get(side),
                    decision_seed(
                        *record.spec.policy_seeds.get(side),
                        context.planning_ordinal,
                        side,
                    ),
                )?;
                if &regenerated != expected {
                    return Err("Aborted decision policy prefix mismatch".into());
                }
            }
        }
        let CloseReply::Closed {
            pending_begin,
            image,
            outcome,
            ..
        } = client
            .close(Namespace::Replay, session)
            .map_err(|e| e.to_string())?;
        if matches!(record.stop, RunStop::PlanningFailure { .. })
            && (pending_begin != record.trailing_begin
                || record.final_image.as_ref() != Some(&image)
                || record.outcome != outcome)
        {
            return Err("Aborted planning native begin/final image mismatch".into());
        }
    } else {
        let _ = client
            .close(Namespace::Replay, session)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
