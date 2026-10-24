// SPEC: _spec/packages/training/shared418.puml
use crate::contracts::{Action, ActionKind, Candidate, PieceKind, Side, Square};
use crate::feature_input::FeatureInput;
use crate::ledger::LedgerWork;
use crate::ledger::contracts::{ContractResult, TankMode};
use super::geometry::{double_eligible, promoted_kind, spawn_kind, square, step};
use super::{bit, charge, observed_piece, target, timing};

pub(super) const TOKENS: usize = 68;

#[derive(Clone, Copy, Debug)]
pub(super) struct Unit {
    pub token: usize, pub square: Square, pub kind: PieceKind, pub side: Side,
    pub paid: u32, pub baseline: bool, pub mode: Option<TankMode>,
}

#[derive(Clone, Copy)]
pub(super) struct OwnView {
    slots: [Option<Unit>; TOKENS], order: [usize; TOKENS], len: usize,
    pub at: [Option<usize>; 64], pub mines: u64,
}
impl OwnView {
    fn empty(work: &mut LedgerWork) -> ContractResult<Self> {
        work.charge(128 + 68 * 3 + 64)?;
        Ok(Self { slots: [None; TOKENS], order: [0; TOKENS], len: 0, at: [None; 64], mines: 0 })
    }
    pub fn units(&self) -> impl Iterator<Item = Unit> + '_ {
        self.order[..self.len].iter().filter_map(|token| self.slots[*token])
    }
    pub fn unit(&self, token: usize) -> Option<Unit> { self.slots[token] }
    pub fn at(&self, square: Square) -> Option<Unit> { self.at[square.index()].and_then(|token| self.unit(token)) }
    fn copy(&self, work: &mut LedgerWork) -> ContractResult<Self> {
        charge(work, 6 + 8 * self.len as u64 + 3 * self.mines.count_ones() as u64)?;
        work.charge(68 * 11 + 64)?;
        Ok(*self)
    }
    fn put(&mut self, unit: Unit, work: &mut LedgerWork) -> ContractResult<()> {
        charge(work, 5)?;
        if self.slots[unit.token].is_none() {
            work.charge(4)?;
            self.order[self.len] = unit.token; self.len += 1;
        }
        self.at[unit.square.index()] = Some(unit.token);
        self.slots[unit.token] = Some(unit);
        Ok(())
    }
    fn remove(&mut self, unit: Unit, work: &mut LedgerWork) -> ContractResult<()> {
        charge(work, 5)?;
        work.charge(68 * 3)?;
        self.slots[unit.token] = None; self.at[unit.square.index()] = None;
        if let Some(index) = self.order[..self.len].iter().position(|token| *token == unit.token) {
            self.order.copy_within(index + 1..self.len, index); self.len -= 1;
        }
        Ok(())
    }
}

pub(super) struct Layers {
    pub enemies: [Option<(PieceKind, Side)>; 64], pub unknown: u64,
}
pub(super) struct Checkpoint {
    pub before: OwnView, pub after: OwnView,
    pub actor: Option<Unit>, pub actor_after: Option<Unit>,
    pub effective_from: Square, pub effective_to: Option<Square>,
    pub unknown_rewrite: bool, pub child: Option<usize>,
}
pub(super) struct Projection {
    pub baseline: OwnView, pub final_view: OwnView, pub layers: Layers,
    pub positions: [Option<Checkpoint>; 4], pub schedule: [usize; 4], pub len: usize,
    pub crushed: u64,
}

pub(super) fn structural_rewrite(
    from: Square, to: Square, side: Side, b_from: Square, b_to: Square, b_kind: ActionKind,
) -> Option<(Square, Square)> {
    if from != b_from { return None; }
    let rewritten = square(to.file() as i16 + b_to.file() as i16 - b_from.file() as i16,
        to.rank() as i16 + b_to.rank() as i16 - b_from.rank() as i16)?;
    if b_kind == ActionKind::StimStep {
        let ranks = to.rank().abs_diff(from.rank());
        let forward = (to.rank() as i16 - from.rank() as i16) * super::geometry::direction(side) > 0;
        if from.file() != to.file() || !forward || ranks != 1 && (ranks != 2 || !double_eligible(from, side)) { return None; }
    } else if b_to != to { return None; }
    Some((b_to, rewritten))
}

pub(super) fn project(history: &FeatureInput, candidate: &Candidate, work: &mut LedgerWork) -> ContractResult<Projection> {
    charge(work, 7)?;
    charge(work, 16)?;
    charge(work, 12)?;
    work.charge(64 * 3)?;
    let mut layers = Layers { enemies: [None; 64], unknown: 0 };
    let mut baseline = OwnView::empty(work)?;
    for cell in &history.view.cells {
        charge(work, 12)?;
        if matches!(cell, crate::contracts::ObservedCell::Unknown { .. }) { layers.unknown |= bit(cell.square()); }
        else if let Some(piece) = observed_piece(cell) {
            if piece.color != history.view.side { layers.enemies[cell.square().index()] = Some((piece.kind, piece.color)); }
        }
    }
    for (token, unit) in history.own_units.iter().enumerate() {
        charge(work, 9 * 4 + 20 + 3 * history.view.own.sieged_tanks.len() as u64)?;
        baseline.put(Unit { token, square: unit.square, kind: unit.kind, side: history.view.side,
            paid: unit.paid_basis, baseline: true, mode: unit.mode }, work)?;
    }
    charge(work, 8 + 3 * history.view.own.mines.len() as u64)?;
    for mine in &history.view.own.mines { baseline.mines |= bit(*mine); }
    let n = candidate.actions.len();
    charge(work, 8 + n as u64 * (8 * 3 + 8))?;
    let b_len = candidate.actions.iter().filter(|action| timing(action) == 0).count();
    charge(work, 16 + b_len as u64 * b_len as u64 * (24 + 8 * b_len as u64) + 16 * n as u64)?;
    work.charge(4 * 4 + 4 * 4 * 4 * 8)?;
    let mut schedule = [0; 4];
    let mut scheduled = [false; 4];
    let mut len = 0;
    while len < b_len {
        let mut first = None;
        let mut head = None;
        for (index, action) in candidate.actions.iter().enumerate() {
            if scheduled[index] || timing(action) != 0 { continue; }
            first.get_or_insert(index);
            let relocating = matches!(action, Action::StimStep { .. } | Action::TacticalJump { .. });
            let blocked = relocating && candidate.actions.iter().enumerate().any(|(j, other)| {
                !scheduled[j] && timing(other) == 0 && other.from() != action.from()
                    && matches!(other, Action::StimStep { .. } | Action::TacticalJump { .. })
                    && Some(other.from()) == target(action)
            });
            if !blocked { head = Some(index); break; }
        }
        let index = head.or(first).expect("Pending B action");
        schedule[len] = index; len += 1; scheduled[index] = true;
    }
    for phase in [1, 2] {
        for (index, action) in candidate.actions.iter().enumerate() {
            if timing(action) == phase { schedule[len] = index; len += 1; }
        }
    }
    charge(work, 7 + 3 * n as u64)?;
    work.charge(4 * (2 * (68 * 11 + 64) + 64))?;
    let mut positions: [Option<Checkpoint>; 4] = std::array::from_fn(|_| None);
    let mut view = baseline.copy(work)?;
    let mut crushed = 0;
    let mut classical: Option<usize> = None;
    for index in &schedule[..len] {
        let action = &candidate.actions[*index];
        charge(work, 14)?;
        let before = view.copy(work)?;
        let mut after = before.copy(work)?;
        let mut effective_from = action.from();
        let mut effective_to = target(action);
        let mut unknown_rewrite = false;
        if timing(action) == 1 {
            charge(work, 100 + 8 * n as u64)?;
            charge(work, 24 + 12 * n as u64)?;
            let relocation = candidate.actions.iter().find(|other| timing(other) == 0
                && other.side() == action.side() && other.from() == action.from()
                && matches!(other, Action::StimStep { .. } | Action::TacticalJump { .. }));
            if let (Some(relocation), Some(to)) = (relocation, target(action)) {
                if let Some((from, rewritten_to)) = structural_rewrite(action.from(), to, action.side(), relocation.from(),
                    target(relocation).expect("Relocation target"), relocation.kind()) {
                    if !(relocation.kind() == ActionKind::StimStep && (before.at[rewritten_to.index()].is_some()
                        || layers.enemies[rewritten_to.index()].is_some())) {
                        effective_from = from; effective_to = Some(rewritten_to);
                        unknown_rewrite = relocation.kind() == ActionKind::StimStep && layers.unknown & bit(rewritten_to) != 0;
                    }
                }
            }
        } else if timing(action) == 2 {
            if let Some(c) = classical.and_then(|c| positions[c].as_ref()) {
                charge(work, 12)?;
                if candidate.actions[classical.expect("Classical index")].from() == action.from() || c.effective_from == action.from() {
                    charge(work, 4)?;
                    if let Some(actor) = c.actor.and_then(|unit| before.unit(unit.token)) { effective_from = actor.square; }
                }
                if action.kind() == ActionKind::StimStep {
                    charge(work, 20)?; effective_to = step(effective_from, action.side());
                }
            }
        }
        charge(work, 5)?;
        let actor = before.at(effective_from);
        charge(work, 8)?;
        let mut child = None;
        if let Some(actor) = actor {
            charge(work, 32)?;
            let movable = match action {
                Action::Classical { .. } => actor.mode != Some(TankMode::Siege)
                    && !effective_to.is_some_and(|to| layers.enemies[to.index()].is_some_and(|(kind, _)| kind == PieceKind::King)),
                Action::StimStep { .. } => actor.kind == PieceKind::Pawn
                    && !effective_to.is_some_and(|to| layers.enemies[to.index()].is_some()),
                Action::TacticalJump { .. } => actor.kind == PieceKind::Queen
                    && !effective_to.is_some_and(|to| layers.enemies[to.index()].is_some()),
                _ => false,
            };
            if movable {
                if let Some(to) = effective_to {
                    charge(work, 8)?;
                    if before.at[to.index()].is_none_or(|token| token == actor.token) {
                        after.remove(actor, work)?;
                        charge(work, 9 * 4 + 32)?;
                        let promotion = match action { Action::Classical { promotion, .. } | Action::StimStep { promotion, .. } => *promotion, _ => None };
                        let promotion_rank = if actor.side == Side::White { 8 } else { 1 };
                        let kind = if actor.kind == PieceKind::Pawn && to.rank() == promotion_rank {
                            promotion.map(promoted_kind).unwrap_or(actor.kind)
                        } else { actor.kind };
                        let mode = if kind == PieceKind::Rook {
                            if actor.kind == PieceKind::Rook { actor.mode } else { Some(TankMode::Tank) }
                        } else { None };
                        after.put(Unit { square: to, kind, mode, ..actor }, work)?;
                    }
                }
            }
            match action {
                Action::Deploy { unit, .. } if actor.kind == PieceKind::King => {
                    if let Some(to) = effective_to {
                        charge(work, 5)?;
                        let victim = before.at(to);
                        charge(work, 6)?;
                        if !victim.is_some_and(|unit| unit.kind == PieceKind::King)
                            && !layers.enemies[to.index()].is_some_and(|(kind, _)| kind == PieceKind::King) {
                            if let Some(victim) = victim {
                                after.remove(victim, work)?;
                                charge(work, 4)?;
                                if victim.baseline { crushed |= 1_u64 << victim.token; }
                            }
                            charge(work, 9 * 3 + 12)?;
                            let token = 64 + *index;
                            child = Some(token);
                            let kind = spawn_kind(*unit);
                            after.put(Unit { token, square: to, kind, side: action.side(), paid: 0,
                                baseline: false, mode: (kind == PieceKind::Rook).then_some(TankMode::Tank) }, work)?;
                        }
                    }
                }
                Action::SiegeMode { .. } if actor.kind == PieceKind::Rook => {
                    charge(work, 9 * 3 + 8)?;
                    let mode = if actor.mode == Some(TankMode::Siege) { TankMode::Tank } else { TankMode::Siege };
                    after.put(Unit { mode: Some(mode), ..actor }, work)?;
                }
                Action::SpiderMine { .. } => { charge(work, 4)?; after.mines |= bit(effective_from); }
                _ => {}
            }
        }
        charge(work, 12 * 3 + 16)?;
        let actor_after = actor.and_then(|actor| after.unit(actor.token));
        view = after.copy(work)?;
        positions[*index] = Some(Checkpoint { before, after, actor, actor_after,
            effective_from, effective_to, unknown_rewrite, child });
        if action.is_classical() { classical = Some(*index); }
    }
    charge(work, 12 + 3 * len as u64)?;
    Ok(Projection { baseline, final_view: view, layers, positions, schedule, len, crushed })
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::geometry::lit;

    fn sq(value: &str) -> Square { Square::parse(value).unwrap() }
    fn unit(token: usize, square: &str, kind: PieceKind) -> Unit {
        Unit { token, square: sq(square), kind, side: Side::White, paid: 0,
            baseline: true, mode: (kind == PieceKind::Rook).then_some(TankMode::Tank) }
    }

    #[test]
    fn view_updates_preserve_map_insertion_and_remove_reinsert_order() {
        let mut work = LedgerWork::new();
        let mut view = OwnView::empty(&mut work).unwrap();
        let rook = unit(0, "a2", PieceKind::Rook);
        view.put(rook, &mut work).unwrap();
        view.put(unit(1, "h1", PieceKind::King), &mut work).unwrap();
        view.put(Unit { mode: Some(TankMode::Siege), ..rook }, &mut work).unwrap();
        assert_eq!(view.units().map(|unit| unit.token).collect::<Vec<_>>(), vec![0, 1]);
        view.remove(rook, &mut work).unwrap();
        view.put(Unit { square: sq("a3"), ..rook }, &mut work).unwrap();
        assert_eq!(view.units().map(|unit| unit.token).collect::<Vec<_>>(), vec![1, 0]);
        assert!(view.at(sq("a2")).is_none()); assert_eq!(view.at(sq("a3")).unwrap().token, 0);
    }

    #[test]
    fn mine_lights_only_its_square_and_mecha_ping_does_not_light_enemy() {
        let mut work = LedgerWork::new();
        let mut view = OwnView::empty(&mut work).unwrap();
        view.put(unit(0, "d4", PieceKind::Bishop), &mut work).unwrap();
        view.mines = bit(sq("h8"));
        let visible = lit(&view, &mut work).unwrap();
        assert_eq!(visible.count_ones(), 26);
        assert_ne!(visible & bit(sq("h8")), 0); assert_eq!(visible & bit(sq("h7")), 0);
        assert_ne!(visible & bit(sq("b2")), 0); assert_ne!(visible & bit(sq("f6")), 0);
        assert_eq!(visible & bit(sq("g7")), 0);
    }
}
