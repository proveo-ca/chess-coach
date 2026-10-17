// SPEC: _spec/apps/arena/burn-compat.puml
use crate::engine_v2::{
    CloseReply, CommitReply, EngineClient, FailureCode, Namespace, OpenReply, StartReply,
};
use crate::record::*;
use training_native::contracts::{AuthorizedView, Candidate, Side, Spend};

pub fn run_match(spec: &MatchSpec) -> Result<RunRecord, String> {
    spec.validate()?;
    let mut record = RunRecord::new(spec.clone());
    let mut client = match EngineClient::new() {
        Ok(client) => client,
        Err(message) => {
            record.stop = RunStop::BridgeFailure {
                message,
                pending: PendingOperation {
                    method: "session.start".into(),
                    id: None,
                    context: None,
                    status: PendingStatus::Unverified,
                },
            };
            return Ok(record);
        }
    };
    if let Err(message) = drive(&mut client, &mut record) {
        bridge_failure(&mut record, &client, message);
    }
    record.cleanup = client.cleanup();
    Ok(record)
}

fn drive(client: &mut EngineClient, record: &mut RunRecord) -> Result<(), String> {
    let ns = Namespace::Session;
    let StartReply::Started {
        session,
        fixture,
        initial,
        outcome,
    } = client
        .start(ns, record.spec.fixture)
        .map_err(|e| e.to_string())?;
    if session == 0 || fixture != record.spec.fixture {
        return Err("Session start identity/fixture mismatch".into());
    }
    record.initial = Some(initial.clone());
    if let Some(outcome) = outcome {
        outcome.validate()?;
        record.final_image = Some(initial);
        record.outcome = Some(outcome);
        record.stop = RunStop::Terminal;
        close_completed(client, record, session, false)?;
        return client.finish();
    }
    loop {
        let ordinal = record.completed_windows;
        match client
            .open(ns, session, ordinal)
            .map_err(|e| e.to_string())?
        {
            OpenReply::Terminal {
                session: actual,
                outcome,
                image,
                begin,
            } => {
                if actual != session {
                    return Err("Terminal session identity mismatch".into());
                }
                outcome.validate()?;
                if let Some(begin) = &begin {
                    check_begin(begin, session, ordinal, previous_image(record)?)?;
                    if begin.after != image || begin.outcome.as_ref() != Some(&outcome) {
                        return Err("Terminal begin/image/outcome mismatch".into());
                    }
                } else if previous_image(record)? != &image {
                    return Err("Terminal state changed without a native begin".into());
                }
                record.trailing_begin = begin;
                record.final_image = Some(image);
                record.outcome = Some(outcome);
                record.stop = RunStop::Terminal;
                break;
            }
            OpenReply::Planning { context, views } => {
                validate_open(&context, &views, session, ordinal)?;
                if ordinal >= record.spec.max_windows {
                    record.stop = RunStop::WindowLimit;
                    close_completed(client, record, session, true)?;
                    return client.finish();
                }
                let mut aborted = AbortedPlanning {
                    context: context.clone(),
                    views: views.clone(),
                    decisions: Pair { w: None, b: None },
                };
                let white = match decide(
                    client,
                    &views.w,
                    record.spec.players.w,
                    decision_seed(record.spec.policy_seeds.w, ordinal, Side::White),
                ) {
                    Ok(decision) => decision,
                    Err(message) => {
                        record.aborted_planning = Some(aborted);
                        return planning_failed(client, record, session, message);
                    }
                };
                aborted.decisions.w = Some(white.clone());
                let black = match decide(
                    client,
                    &views.b,
                    record.spec.players.b,
                    decision_seed(record.spec.policy_seeds.b, ordinal, Side::Black),
                ) {
                    Ok(decision) => decision,
                    Err(message) => {
                        record.aborted_planning = Some(aborted);
                        return planning_failed(client, record, session, message);
                    }
                };
                let decisions = Pair { w: white, b: black };
                record.aborted_planning = Some(AbortedPlanning {
                    context: context.clone(),
                    views: views.clone(),
                    decisions: Pair {
                        w: Some(decisions.w.clone()),
                        b: Some(decisions.b.clone()),
                    },
                });
                let requests = requests(&decisions);
                match client.commit(ns, &context, &requests) {
                    Ok(CommitReply::Committed {
                        context: actual,
                        begin,
                        settlement,
                    }) => {
                        if actual != context
                            || settlement.context != context
                            || settlement.requests != requests
                        {
                            return Err(
                                "Committed context or requests differ from both selected queues"
                                    .into(),
                            );
                        }
                        check_begin(&begin, session, ordinal, previous_image(record)?)?;
                        if begin.outcome.is_some() || begin.after != settlement.before {
                            return Err("Settlement does not follow the nonterminal begin".into());
                        }
                        if let Some(outcome) = &settlement.outcome {
                            outcome.validate()?;
                        }
                        let outcome = settlement.outcome.clone();
                        let image = settlement.after.clone();
                        record.windows.push(WindowRecord {
                            context,
                            views,
                            decisions,
                            begin,
                            settlement,
                        });
                        record.aborted_planning = None;
                        record.completed_windows += 1;
                        if let Some(outcome) = outcome {
                            record.final_image = Some(image);
                            record.outcome = Some(outcome);
                            record.stop = RunStop::Terminal;
                            break;
                        }
                    }
                    Err(error) => {
                        if let Some(packet) = &error.packet
                            && packet.code == FailureCode::NativeRejection
                            && packet.context.as_ref() == Some(&context)
                            && let Some(witness) = &packet.witness
                        {
                            check_begin(&witness.begin, session, ordinal, previous_image(record)?)?;
                            if witness.requests != requests
                                || witness.image != witness.begin.after
                                || witness.outcome.is_some()
                            {
                                return Err("Native rejection witness does not match the selected queues/opening".into());
                            }
                            record.final_image = Some(witness.image.clone());
                            record.failed_attempt = Some(FailedAttempt {
                                context,
                                views,
                                decisions,
                                witness: witness.clone(),
                            });
                            record.aborted_planning = None;
                            record.stop = RunStop::NativeRejection {
                                message: packet.message.clone(),
                            };
                            break;
                        }
                        return Err(error.to_string());
                    }
                }
            }
        }
    }
    close_completed(client, record, session, false)?;
    client.finish()
}

pub(crate) fn requests(
    decisions: &Pair<Decision>,
) -> Pair<Vec<training_native::contracts::Action>> {
    Pair {
        w: decisions.w.selected.actions.clone(),
        b: decisions.b.selected.actions.clone(),
    }
}

pub(crate) fn decide(
    client: &mut EngineClient,
    view: &AuthorizedView,
    policy: BaselinePolicy,
    seed: u32,
) -> Result<Decision, String> {
    view.validate()?;
    if policy == BaselinePolicy::PassV1 {
        return Ok(Decision {
            policy,
            seed,
            generation: None,
            selected: Candidate::new(Vec::new(), Spend::default(), view.side)?,
        });
    }
    let mut oracle = client.oracle();
    let deadline = oracle.deadline();
    let batch = training_native::candidates::generate(view, &mut oracle)?;
    batch.validate(view.side)?;
    let selection = training_native::policy::select(&batch, policy, seed)?;
    if std::time::Instant::now() >= deadline {
        return Err("Absolute ten-second policy decision deadline exceeded".into());
    }
    selection.candidate.validate(view.side)?;
    if batch.candidates.get(selection.index) != Some(&selection.candidate) {
        return Err("Selector returned an index/candidate outside the generated batch".into());
    }
    Ok(Decision {
        policy,
        seed,
        generation: Some(batch.diagnostics),
        selected: selection.candidate,
    })
}

pub(crate) fn validate_open(
    context: &EngineContext,
    views: &Pair<AuthorizedView>,
    session: u32,
    ordinal: u32,
) -> Result<(), String> {
    if context.session != session
        || context.planning_ordinal != ordinal
        || views.w.side != Side::White
        || views.b.side != Side::Black
        || views.w.turn != context.turn
        || views.b.turn != context.turn
    {
        return Err("Planning context/views do not identify the same native opening".into());
    }
    views.w.validate()?;
    views.b.validate()
}

fn previous_image(record: &RunRecord) -> Result<&StateImage, String> {
    record
        .windows
        .last()
        .map(|window| &window.settlement.after)
        .or(record.initial.as_ref())
        .ok_or("Missing native initial image".into())
}

pub(crate) fn check_begin(
    begin: &BeginRecord,
    session: u32,
    ordinal: u32,
    before: &StateImage,
) -> Result<(), String> {
    if begin.session != session || begin.planning_ordinal != ordinal || &begin.before != before {
        return Err("Native begin identity/order/before-image mismatch".into());
    }
    Ok(())
}

fn planning_failed(
    client: &mut EngineClient,
    record: &mut RunRecord,
    session: u32,
    message: String,
) -> Result<(), String> {
    if client.is_poisoned() {
        return Err(message);
    }
    record.stop = RunStop::PlanningFailure { message };
    client.close_planning()?;
    close_completed(client, record, session, true)?;
    client.finish()
}

fn close_completed(
    client: &mut EngineClient,
    record: &mut RunRecord,
    session: u32,
    pending_expected: bool,
) -> Result<(), String> {
    client.close_planning()?;
    let CloseReply::Closed {
        session: actual,
        pending_begin,
        image,
        outcome,
    } = client
        .close(Namespace::Session, session)
        .map_err(|e| e.to_string())?;
    if actual != session || pending_begin.is_some() != pending_expected {
        return Err("Session close identity/pending begin mismatch".into());
    }
    if let Some(begin) = pending_begin {
        check_begin(
            &begin,
            session,
            record.completed_windows,
            previous_image(record)?,
        )?;
        if begin.after != image || begin.outcome != outcome || outcome.is_some() {
            return Err("Deferred begin differs from nonterminal close".into());
        }
        record.trailing_begin = Some(begin);
        record.final_image = Some(image);
        record.outcome = outcome;
    } else if record.final_image.as_ref() != Some(&image) || record.outcome != outcome {
        return Err("Session close differs from the last confirmed native state/outcome".into());
    }
    Ok(())
}

fn bridge_failure(record: &mut RunRecord, client: &EngineClient, message: String) {
    let pending = client
        .last_error
        .as_ref()
        .map(|error| error.pending.clone())
        .or_else(|| client.last_operation.clone())
        .unwrap_or(PendingOperation {
            method: "session.start".into(),
            id: None,
            context: None,
            status: PendingStatus::Unverified,
        });
    record.final_image = None;
    record.outcome = None;
    record.stop = RunStop::BridgeFailure { message, pending };
}
