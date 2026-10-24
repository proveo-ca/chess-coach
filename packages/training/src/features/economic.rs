// SPEC: _spec/packages/training/shared418.puml
use crate::contracts::{Action, Candidate, PieceKind};
use crate::ledger::LedgerWork;
use crate::ledger::contracts::ContractResult;
use super::geometry::{Relation, exposure, relation, replacement, spawn_kind};
use super::projection::{Projection, TOKENS};
use super::{NumericalFeatureContext, bad, bit, charge, target};

pub(super) fn encode(projection: &Projection, candidate: &Candidate, context: &NumericalFeatureContext,
    work: &mut LedgerWork) -> ContractResult<[f64; 12]> {
    charge(work, 12)?;
    charge(work, 12)?;
    work.charge(TOKENS as u64 + 64)?;
    let mut targets = 0;
    let mut risks = [0.0_f64; TOKENS];
    let (mut target_value, mut deploy_value, mut crushed_value, mut protected_value) = (0.0, 0.0, 0.0, 0.0);
    let mut classical = false;
    for index in &projection.schedule[..projection.len] {
        charge(work, 12)?;
        let checkpoint = projection.positions[*index].as_ref().expect("Scheduled checkpoint");
        let action = &candidate.actions[*index];
        if let Action::Deploy { unit, .. } = action { deploy_value += replacement(spawn_kind(*unit), work)?; }
        if action.is_classical() {
            classical = true;
            let to = target(action).expect("Classical target");
            charge(work, 12)?;
            if let (Some((kind, _)), Some(actor)) = (projection.layers.enemies[to.index()], checkpoint.actor) {
                if kind != PieceKind::King && targets & bit(to) == 0
                    && relation(&projection.layers, &checkpoint.before, actor.square, actor.kind, actor.side, to, work)? == Relation::Known {
                    charge(work, 4)?;
                    targets |= bit(to); target_value += replacement(kind, work)?;
                }
            }
        }
        charge(work, 5)?;
        if let Some(actor) = checkpoint.actor_after {
            if actor.kind != PieceKind::King {
                let e = exposure(&projection.layers, &checkpoint.after, actor.square, work)?;
                charge(work, 8)?;
                if e.known + e.possible > 0 {
                    let value = replacement(actor.kind, work)?;
                    charge(work, 7)?;
                    risks[actor.token] = risks[actor.token].max(value);
                }
            }
        }
    }
    work.charge(64)?;
    for unit in projection.baseline.units() {
        if projection.crushed & (1_u64 << unit.token) != 0 {
            charge(work, 6)?;
            crushed_value += replacement(unit.kind, work)?;
        }
    }
    for unit in projection.baseline.units() {
        charge(work, 8)?;
        if unit.kind == PieceKind::King { continue; }
        if let Some(survivor) = projection.final_view.unit(unit.token) {
            let before = exposure(&projection.layers, &projection.baseline, unit.square, work)?;
            let after = exposure(&projection.layers, &projection.final_view, survivor.square, work)?;
            charge(work, 8)?;
            if before.known + before.possible > 0 && after.known + after.possible == 0 {
                protected_value += replacement(unit.kind, work)?;
            }
        }
    }
    work.charge(TOKENS as u64 * 2)?;
    charge(work, 2 + 4 * risks.iter().filter(|value| **value > 0.0).count() as u64)?;
    let risk: f64 = risks.iter().sum();
    charge(work, 58)?;
    let s = 0.5 * (candidate.own_spend.minerals as f64 / 12.0 + candidate.own_spend.gas as f64 / 3.0);
    let a = (deploy_value - crushed_value) / 12.0;
    let t = if classical { (target_value - risk) / 12.0 } else { 0.0 };
    let p = protected_value / 12.0;
    if !(0.0..=1.0).contains(&s) || !(-48.0..=1.0).contains(&a)
        || !(-3.0..=0.75).contains(&t) || !(0.0..=48.0).contains(&p) {
        return Err(bad("Numerical economic factors exceed legacy domain"));
    }
    work.charge(128 + 1024 + 12 * (48 + 4))?;
    let mut values = [s * context.balance, s * context.uncertainty, a * context.balance, a * context.uncertainty,
        t * context.balance, t * context.uncertainty, p * context.balance, p * context.uncertainty, s, a, t, p];
    for value in &mut values { if *value == 0.0 { *value = 0.0; } }
    Ok(values)
}
