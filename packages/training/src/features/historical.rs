// SPEC: _spec/packages/training/shared418.puml
use crate::contracts::{Action, ActionKind, Candidate, ObservedCell, PieceKind};
use crate::feature_input::FeatureInput;
use crate::ledger::LedgerWork;
use crate::ledger::contracts::{ContractResult, TankMode};
use super::geometry::{distance, exposure, kind_index, lit, native_cost, pressure, promoted_kind, ray,
    replacement, spawn_kind, threatened};
use super::projection::Projection;
use super::{charge, gas_cost, observed_piece, target, timing};

fn flag(value: bool) -> f64 { if value { 1.0 } else { 0.0 } }

pub(super) fn encode(history: &FeatureInput, candidate: &Candidate, projection: &Projection,
    work: &mut LedgerWork) -> ContractResult<([f64; 34], [[f64; 84]; 4])> {
    charge(work, 34)?;
    let own = &history.view.own;
    let b = own.minerals as f64 / 12.0;
    let a = own.gas as f64 / 3.0;
    let cv = 1.0 - own.cc_lives as f64 / 3.0;
    let m = candidate.own_spend.minerals as f64 / 12.0;
    let g = candidate.own_spend.gas as f64 / 3.0;
    let mm = b - m;
    let gm = a - g;
    let s = (m + g) / 2.0;
    let d = history.own_paid_destroyed as f64 / 3072.0;
    let w = history.own_paid_wasted as f64 / 3072.0;
    let er = history.enemy_replacement_loss_lower_bound as f64 / 2304.0;
    work.charge(64 * 4)?;
    charge(work, 12 + 4 * history.memory.iter().flatten().count() as u64
        + 3 * history.ever_lit.iter().filter(|lit| **lit).count() as u64)?;
    let mut ever_lit = 0;
    for (index, lit) in history.ever_lit.iter().enumerate() { if *lit { ever_lit |= 1_u64 << index; } }
    let mut selected = None;
    for memory in history.memory.iter().flatten() {
        charge(work, 10)?;
        if selected.is_none_or(|old: &crate::ledger::history::LastSeenAssertion| {
            memory.last_observed_turn > old.last_observed_turn
                || memory.last_observed_turn == old.last_observed_turn
                    && (memory.square.file(), memory.square.rank()) < (old.square.file(), old.square.rank())
        }) { selected = Some(memory); }
    }
    charge(work, 12)?;
    let selected_age = selected.map_or(0.0, |memory| (history.view.turn - memory.last_observed_turn) as f64 / 45.0);
    let u = projection.layers.unknown.count_ones() as f64 / 64.0;
    for _ in 0..4 { charge(work, 2 + 84 * 4)?; }
    work.charge(4 * 84)?;
    let mut positions = [[0.0; 84]; 4];
    let mut novelty_sum = 0;
    let mut novel_union = 0_u64;
    for (index, checkpoint) in projection.positions.iter().enumerate() {
        let Some(checkpoint) = checkpoint else { continue; };
        charge(work, 20)?;
        let p = &mut positions[index];
        let action = &candidate.actions[index];
        let actor = checkpoint.actor;
        p[0] = 1.0;
        p[1 + match action.kind() {
            ActionKind::Classical => 0, ActionKind::Deploy => 1, ActionKind::StimStep => 2,
            ActionKind::SpiderMine => 3, ActionKind::CharonMissiles => 4,
            ActionKind::SiegeMode => 5, ActionKind::TacticalJump => 6,
        }] = 1.0;
        p[8 + timing(action)] = 1.0;
        charge(work, 19)?;
        p[11] = (action.from().file() - 1) as f64 / 7.0;
        p[12] = (action.from().rank() - 1) as f64 / 7.0;
        if let Some(to) = target(action) {
            p[13] = 1.0; p[14] = (to.file() - 1) as f64 / 7.0; p[15] = (to.rank() - 1) as f64 / 7.0;
        }
        charge(work, 12)?;
        if let Action::Deploy { unit, .. } = action { p[17 + kind_index(spawn_kind(*unit))] = 1.0; }
        else { p[16] = 1.0; }
        let promotion = match action { Action::Classical { promotion, .. } | Action::StimStep { promotion, .. } => *promotion, _ => None };
        if let Some(promotion) = promotion { p[23 + kind_index(promoted_kind(promotion))] = 1.0; }
        else { p[22] = 1.0; }
        charge(work, 32)?;
        p[28] = flag(actor.is_some_and(|actor| actor.baseline));
        p[29] = flag(actor.is_none());
        charge(work, 12)?;
        p[30] = flag(actor.is_some_and(|actor| {
            projection.baseline.unit(actor.token).is_none_or(|actual| actual.square != actor.square
                || actual.kind != actor.kind || checkpoint.unknown_rewrite)
        }));
        p[31] = p[28];
        if let Some(actor) = actor {
            p[32 + kind_index(actor.kind)] = 1.0;
            p[38] = flag(actor.kind == PieceKind::Rook);
            p[39] = flag(actor.kind == PieceKind::Rook && actor.mode == Some(TankMode::Siege));
            p[55] = if actor.baseline { actor.paid as f64 / 12.0 } else { 0.0 };
            p[56] = replacement(actor.kind, work)? / 12.0;
        }
        charge(work, 10 + 4 * history.view.cells.len() as u64)?;
        match target(action) {
            None => p[40] = 1.0,
            Some(to) => {
                let cell = &history.view.cells[to.index()];
                if matches!(cell, ObservedCell::Unknown { .. }) { p[41] = 1.0; }
                else if let Some(piece) = observed_piece(cell) {
                    p[if piece.color == history.view.side { 43 } else { 44 }] = 1.0;
                    p[45 + kind_index(piece.kind)] = 1.0;
                } else { p[42] = 1.0; }
            }
        }
        charge(work, 14)?;
        if let Some(memory) = target(action).and_then(|to| history.memory[to.index()]) {
            p[51] = 1.0; p[52] = (history.view.turn - memory.last_observed_turn) as f64 / 45.0;
        }
        charge(work, 20)?;
        p[53] = match action { Action::Deploy { unit, .. } => native_cost(spawn_kind(*unit)) as f64 / 12.0, _ => 0.0 };
        p[54] = gas_cost(action) as f64 / 3.0;
        let mut effective_distance = 0.0;
        charge(work, 7)?;
        if action.is_classical() {
            if let (Some(actor), Some(to)) = (actor, checkpoint.effective_to) {
                let ray = ray(&projection.layers, &checkpoint.before, actor.kind, checkpoint.effective_from, to, work)?;
                charge(work, 24)?;
                p[57] = flag(ray.applicable);
                p[58] = flag(ray.applicable && ray.occupied == 0 && ray.unknown == 0);
                p[59] = flag(ray.applicable && ray.occupied > 0);
                p[60] = flag(ray.applicable && ray.occupied == 0 && ray.unknown > 0);
                p[61] = ray.empty as f64 / 64.0;
                p[62] = ray.occupied as f64 / 64.0;
                p[63] = ray.unknown as f64 / 64.0;
                effective_distance = ray.distance as f64;
            }
        }
        let lit = lit(&checkpoint.after, work)?;
        charge(work, 1)?;
        let mut squares = lit;
        while squares != 0 { charge(work, 7)?; squares &= squares - 1; }
        let novel = lit & !ever_lit;
        novel_union |= novel;
        charge(work, 5)?;
        novelty_sum += novel.count_ones();
        p[64] = novel.count_ones() as f64 / 64.0;
        if let (Some(actor), Some(after)) = (actor, checkpoint.actor_after) {
            charge(work, 5)?;
            if let Some(selected) = selected {
                let before = distance(actor.square, selected.square, work)?;
                let after = distance(after.square, selected.square, work)?;
                charge(work, 6)?;
                p[65] = before.saturating_sub(after) as f64 / 7.0;
            }
            let e = exposure(&projection.layers, &checkpoint.after, after.square, work)?;
            let pr = pressure(&projection.layers, &checkpoint.after, after, work)?;
            let before = threatened(&projection.layers, &checkpoint.before, work)?;
            let after = threatened(&projection.layers, &checkpoint.after, work)?;
            charge(work, 22)?;
            p[66] = e.known as f64 / 64.0; p[67] = e.possible as f64 / 64.0;
            p[68] = pr.0 as f64 / 64.0; p[69] = flag(pr.1);
            p[70] = before.0.saturating_sub(after.0) as f64 / 64.0;
            p[71] = flag(before.1 && !after.1);
        }
        charge(work, 62)?;
        p[72] = p[53] * b; p[73] = p[54] * a;
        p[74] = flag(action.kind() == ActionKind::Deploy) * mm;
        p[75] = p[66] * p[55] * p[31]; p[76] = p[67] * p[55] * p[31];
        p[77] = p[66] * p[56]; p[78] = p[68] * er; p[79] = p[69] * cv;
        p[80] = p[64] * flag(actor.is_some_and(|actor| actor.kind == PieceKind::Bishop));
        p[81] = p[60] * effective_distance / 7.0;
        p[82] = p[65] * selected_age; p[83] = p[70] * d;
    }
    charge(work, 2 + 34 * 4)?;
    work.charge(34)?;
    let mut q = [0.0; 34];
    charge(work, 43)?;
    q[0] = flag(candidate.actions.is_empty()); q[1] = candidate.actions.len() as f64 / 4.0;
    q[2] = m; q[3] = g; q[7] = mm; q[8] = gm;
    let mut deploy_count = 0;
    for action in &candidate.actions {
        charge(work, 10)?;
        q[4 + timing(action)] += 0.25;
        if action.kind() == ActionKind::Deploy { deploy_count += 1; }
    }
    charge(work, 2)?;
    let (mut crushed_paid, mut crushed_replacement) = (0.0, 0.0);
    work.charge(64)?;
    for unit in projection.baseline.units() {
        if projection.crushed & (1_u64 << unit.token) != 0 {
            charge(work, 8)?;
            crushed_paid += unit.paid as f64; crushed_replacement += replacement(unit.kind, work)?;
        }
    }
    charge(work, 6)?;
    q[9] = crushed_paid / 3072.0; q[10] = crushed_replacement / 2304.0;
    let before = threatened(&projection.layers, &projection.baseline, work)?;
    let after = threatened(&projection.layers, &projection.final_view, work)?;
    for unit in projection.final_view.units() {
        charge(work, 4)?;
        if unit.kind == PieceKind::King {
            let e = exposure(&projection.layers, &projection.final_view, unit.square, work)?;
            charge(work, 6)?;
            q[12] = e.known as f64 / 64.0; q[13] = e.possible as f64 / 64.0;
        }
    }
    charge(work, 5)?;
    q[14] = flag(before.1 && !after.1);
    for i in 0..candidate.actions.len() {
        for j in i + 1..candidate.actions.len() {
            charge(work, 40 + 6 * 16)?;
            let a = projection.positions[i].as_ref().expect("Authored checkpoint");
            let b = projection.positions[j].as_ref().expect("Authored checkpoint");
            let aa = &candidate.actions[i]; let ba = &candidate.actions[j];
            let same = a.actor.is_some() && a.actor.map(|unit| unit.token) == b.actor.map(|unit| unit.token);
            let ta = timing(aa); let tb = timing(ba);
            if same {
                q[15] += 1.0;
                if ta == 0 && tb == 1 || ta == 1 && tb == 0 { q[16] += 1.0; }
                if ta == 1 && tb == 2 || ta == 2 && tb == 1 { q[17] += 1.0; }
                let moved_a = a.actor.map(|unit| unit.square) != a.actor_after.map(|unit| unit.square);
                let moved_b = b.actor.map(|unit| unit.square) != b.actor_after.map(|unit| unit.square);
                if aa.kind() == ActionKind::SpiderMine && ba.is_classical() && moved_b
                    || ba.kind() == ActionKind::SpiderMine && aa.is_classical() && moved_a { q[18] += 1.0; }
            }
            if aa.kind() == ActionKind::Deploy && ta == 0 && a.child.is_some()
                && a.child == b.actor.map(|unit| unit.token) && ba.is_classical()
                || ba.kind() == ActionKind::Deploy && tb == 0 && b.child.is_some()
                && b.child == a.actor.map(|unit| unit.token) && aa.is_classical() { q[19] += 1.0; }
            if ta > tb { q[20] += 1.0; }
        }
    }
    for value in &mut q[15..21] { charge(work, 6)?; *value /= 6.0; }
    charge(work, 1)?;
    let mut pairs = 0;
    for unit in projection.final_view.units() {
        charge(work, 4)?;
        pairs += pressure(&projection.layers, &projection.final_view, unit, work)?.0;
    }
    charge(work, 81)?;
    let pk = pairs as f64 / 4096.0;
    let nl = novel_union.count_ones() as f64 / 64.0;
    q[11] = nl; q[21] = (novelty_sum - novel_union.count_ones()) as f64 / 256.0;
    q[22] = s * d; q[23] = 0.0; q[24] = pk * er; q[25] = nl * u;
    q[26] = (q[12] + q[13]) * cv; q[27] = q[18] * u;
    q[28] = s * history.view.turn as f64 / 45.0; q[29] = q[0] * cv;
    q[30] = deploy_count as f64 / 4.0 * own.gas_income as f64 / 3.0;
    q[31] = pk; q[32] = s * w; q[33] = deploy_count as f64 / 4.0 * w;
    charge(work, 8 + 34 + 4 * (84 + 1))?;
    work.charge(5 * (128 + 1024) + 370 * (48 + 3))?;
    Ok((q, positions))
}
