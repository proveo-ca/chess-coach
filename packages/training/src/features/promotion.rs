// SPEC: _spec/packages/training/shared418.puml
use std::collections::{BTreeMap, BTreeSet};
use crate::contracts::{ActionKind, PieceKind, Side, Square, all_squares};
use crate::ledger::LedgerWork;
use crate::ledger::contracts::ContractResult;
use super::geometry::{Relation, direction, double_eligible, kind_index, lit, relation, square, step};
use super::projection::{Projection, structural_rewrite};
use super::{NumericalFeatureContext, bit, charge};

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub(crate) struct MarineEntry { pub square: Square, pub diagonal: bool }
#[derive(Clone, Copy, Debug)]
pub(crate) struct MarineOpportunity {
    pub arrival: Square, pub promotion: Option<PieceKind>, pub entries: [Option<MarineEntry>; 3],
    pub before: bool, pub classical: u8, pub after: bool, pub arrival_binding: bool, pub fc: bool,
    pub authored_diagonal_target: Option<Square>, pub spatial_eligible: bool,
}
impl MarineOpportunity {
    fn authored_key_length(self) -> u64 {
        let before = if self.before { "B" } else { "-" };
        let classical = match self.classical {
            0 => "none", 1 => "forward1", 2 => "forward2", 3 => "diagonalLeft", _ => "diagonalRight",
        };
        let after = if self.after { "F" } else { "-" };
        let binding = if self.arrival_binding { "arrival" } else { "original" };
        let order = if self.fc { "FC" } else { "CF" };
        (before.len() + classical.len() + after.len() + binding.len() + order.len() + 1 + 5) as u64
    }
}

pub(crate) fn marine_opportunities(source: Square, side: Side, gas: u32,
    work: &mut LedgerWork) -> ContractResult<Vec<MarineOpportunity>> {
    charge(work, 16)?;
    work.charge(128 + 128 * 16 + 2 * 5 * 2 * 2 * 2 * 32)?;
    work.charge(128 + 128 * 4)?;
    let mut result = Vec::with_capacity(128);
    let last = if side == Side::White { 8 } else { 1 };
    for before in [false, true] {
        for classical in 0..5_u8 {
            for after in [false, true] {
                if before && after || (before || after) && gas < 1 { continue; }
                let Some(b_to) = (if before { step(source, side) } else { Some(source) }) else { continue; };
                for arrival_binding in [false, true] {
                    if arrival_binding && !(before && classical != 0) { continue; }
                    let c_from = if arrival_binding { b_to } else { source };
                    let Some(c_to) = destination(c_from, side, classical) else { continue; };
                    if classical == 2 && !double_eligible(c_from, side) { continue; }
                    let f_authored_to = if after { step(source, side) } else { None };
                    if after && f_authored_to.is_none() { continue; }
                    for fc in [false, true] {
                        if fc && !(after && classical != 0) { continue; }
                        let after_c_step = if after && classical != 0 { step(c_to, side) } else { None };
                        if after && classical != 0 && !fc && after_c_step.is_some_and(|square| square.rank() == last) { continue; }
                        let rewrite = if before && classical != 0 {
                            structural_rewrite(c_from, c_to, side, source, b_to, ActionKind::StimStep)
                        } else { None };
                        let (effective_from, effective_to) = rewrite.unwrap_or((c_from, c_to));
                        let c_acts = classical != 0 && effective_from == b_to;
                        let diagonal = classical == 3 || classical == 4;
                        let c_arrival = if c_acts { effective_to } else { b_to };
                        let f_arrival = if after { step(c_arrival, side) } else { None };
                        charge(work, 20)?;
                        let authored_diagonal_target = diagonal.then_some(c_to);
                        let spatial_eligible = !(before && !arrival_binding
                            && matches!(classical, 1 | 2) && rewrite.is_none())
                            && (!after || f_arrival.is_some());
                        let b_promotes = before && b_to.rank() == last && !c_acts;
                        let c_promotes = c_acts && c_arrival.rank() == last;
                        let f_promotes = !b_promotes && !c_promotes
                            && f_arrival.is_some_and(|square| square.rank() == last)
                            && f_authored_to.is_some_and(|square| square.rank() == last);
                        let mut entries = [None; 3];
                        let mut len = 0;
                        if before { entries[len] = Some(MarineEntry { square: b_to, diagonal: false }); len += 1; }
                        if !b_promotes && c_acts {
                            if classical == 2 {
                                entries[len] = Some(MarineEntry { square: step(effective_from, side).expect("Double-step intermediate"), diagonal: false }); len += 1;
                            }
                            entries[len] = Some(MarineEntry { square: c_arrival, diagonal }); len += 1;
                        }
                        if !b_promotes && !c_promotes {
                            if let Some(square) = f_arrival { entries[len] = Some(MarineEntry { square, diagonal: false }); }
                        }
                        let arrival = if b_promotes { b_to } else if c_promotes { c_arrival } else { f_arrival.unwrap_or(c_arrival) };
                        if b_promotes || c_promotes || f_promotes {
                            for promotion in [PieceKind::Knight, PieceKind::Bishop, PieceKind::Rook, PieceKind::Queen] {
                                work.charge(4)?;
                                result.push(MarineOpportunity { arrival, promotion: Some(promotion), entries,
                                    before, classical, after, arrival_binding, fc,
                                    authored_diagonal_target, spatial_eligible });
                            }
                        } else {
                            work.charge(4)?;
                            result.push(MarineOpportunity { arrival, promotion: None, entries,
                                before, classical, after, arrival_binding, fc,
                                authored_diagonal_target, spatial_eligible });
                        }
                    }
                }
            }
        }
    }
    charge(work, 8 + 4 * result.len() as u64)?;
    Ok(result)
}

fn destination(from: Square, side: Side, classical: u8) -> Option<Square> {
    if classical == 0 { return Some(from); }
    let file = from.file() as i16 + if classical == 3 { -1 } else if classical == 4 { 1 } else { 0 };
    let rank = from.rank() as i16 + direction(side) * if classical == 2 { 2 } else { 1 };
    square(file, rank)
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
struct ContactState { compatible: bool, blockers: u64, cover: u64, vision: u64 }
impl ContactState {
    const EMPTY: Self = Self { compatible: true, blockers: 0, cover: 0, vision: 0 };
    fn count(self) -> u64 { (self.blockers.count_ones() + self.cover.count_ones() + self.vision.count_ones()) as u64 }
}
#[derive(Clone, Copy)]
struct Contact { compatible: bool, blocker: bool, cover: bool, vision: bool }
type Prefix = (Square, u8, ContactState, ContactState);
type Arrival = (Square, usize, u8, ContactState, ContactState);
type Annotation = (ContactState, [Option<MarineEntry>; 3]);

struct Walker<'a, 'w> {
    projection: &'a Projection, enemy: Side, turn: u32,
    baseline_lit: u64, candidate_lit: u64,
    contacts: [[Option<Contact>; 128]; 2],
    annotations: [BTreeMap<Annotation, ContactState>; 2],
    prefixes: BTreeSet<Prefix>, arrivals: BTreeSet<Arrival>,
    macros: BTreeMap<(Square, u32), Vec<MarineOpportunity>>,
    exposure: &'a mut [Option<bool>; 256],
    files: [[u8; 3]; 6], work: &'w mut LedgerWork,
}

fn tree_fee(work: &mut LedgerWork, length: usize, slots: u64) -> ContractResult<()> {
    let levels = (length + 1).ilog2() as u64 + 1;
    work.charge(128 + 192 + slots * (8 + 4 * levels))
}

impl Walker<'_, '_> {
    fn key_fee(&mut self, state: ContactState) -> ContractResult<()> {
        let count = state.count();
        let levels = if count == 0 { 0 } else { (count + 1).next_power_of_two().ilog2() as u64 };
        charge(self.work, 16 + count * (8 + 4 * levels))
    }
    fn annotate(&mut self, entries: [Option<MarineEntry>; 3], prior: ContactState, channel: usize) -> ContractResult<ContactState> {
        let count = entries.iter().flatten().count();
        if count == 0 { return Ok(prior); }
        tree_fee(self.work, self.annotations[channel].len(), 9)?;
        if let Some(cached) = self.annotations[channel].get(&(prior, entries)) { return Ok(*cached); }
        charge(self.work, 8 + 3 * prior.count() + 29 * count as u64 + 5)?;
        let mut result = prior;
        for entry in entries.into_iter().flatten() {
            let index = entry.square.index() * 2 + usize::from(entry.diagonal);
            self.work.charge(8)?;
            let contact = if let Some(contact) = self.contacts[channel][index] { contact } else {
                charge(self.work, 30)?;
                let own = if channel == 0 { &self.projection.baseline } else { &self.projection.final_view };
                let unit = own.at(entry.square);
                let mine = own.mines & bit(entry.square) != 0;
                let compatible = !entry.diagonal || unit.is_some() || mine;
                let blocker = if entry.diagonal { unit.is_some_and(|unit| unit.kind == PieceKind::King) }
                    else { unit.is_some() || mine };
                let visible = if channel == 0 { self.baseline_lit } else { self.candidate_lit };
                let mut cover = false;
                for source in own.units() {
                    charge(self.work, 3)?;
                    if relation(&self.projection.layers, own, source.square, source.kind, source.side, entry.square, self.work)? != Relation::None {
                        charge(self.work, 2)?; cover = true; break;
                    }
                }
                charge(self.work, 12)?;
                let contact = Contact { compatible, blocker, cover, vision: visible & bit(entry.square) != 0 };
                self.contacts[channel][index] = Some(contact);
                contact
            };
            result.compatible &= contact.compatible;
            if contact.blocker { result.blockers |= bit(entry.square); }
            if contact.cover { result.cover |= bit(entry.square); }
            if contact.vision { result.vision |= bit(entry.square); }
        }
        tree_fee(self.work, self.annotations[channel].len(), 12)?;
        self.annotations[channel].insert((prior, entries), result);
        Ok(result)
    }
    fn walk(&mut self, square: Square, depth: u8, baseline: ContactState, candidate: ContactState) -> ContractResult<()> {
        charge(self.work, 30)?;
        if depth == 3 { return Ok(()); }
        let distance = if self.enemy == Side::White { 8 - square.rank() } else { square.rank() - 1 };
        if distance == 0 || distance > 3 * (3 - depth) { return Ok(()); }
        self.key_fee(baseline)?; self.key_fee(candidate)?;
        charge(self.work, 20 + 2 * (16 + 3 * baseline.count() + 16 + 3 * candidate.count()))?;
        tree_fee(self.work, self.prefixes.len(), 10)?;
        if !self.prefixes.insert((square, depth, baseline, candidate)) { return Ok(()); }
        charge(self.work, 16)?;
        let turn = self.turn + depth as u32;
        let gas = if turn <= 10 { 1 } else if turn <= 20 { 2 } else { 3 };
        charge(self.work, 12)?;
        tree_fee(self.work, self.macros.len(), 2)?;
        if !self.macros.contains_key(&(square, gas)) {
            let macros = marine_opportunities(square, self.enemy, gas, self.work)?;
            tree_fee(self.work, self.macros.len(), 3)?;
            self.macros.insert((square, gas), macros);
        }
        let count = self.macros[&(square, gas)].len();
        self.work.charge(4 * count as u64)?;
        charge(self.work, 16 + count as u64 * (6 + 2 * (64 + 32) + 24 + 5 + 14 + 2 * (2 + 64 + 40) + 25))?;
        for index in 0..count {
            let opportunity = self.macros[&(square, gas)][index];
            self.work.charge(16 + opportunity.authored_key_length())?;
            let b = self.annotate(opportunity.entries, baseline, 0)?;
            let q = self.annotate(opportunity.entries, candidate, 1)?;
            if !b.compatible && !q.compatible { continue; }
            if let Some(promotion) = opportunity.promotion {
                self.key_fee(b)?; self.key_fee(q)?;
                charge(self.work, 24 + 2 * (16 + 3 * b.count() + 16 + 3 * q.count()))?;
                tree_fee(self.work, self.arrivals.len(), 11)?;
                if !self.arrivals.insert((opportunity.arrival, kind_index(promotion), depth + 1, b, q)) { continue; }
                self.pool(opportunity.arrival, promotion, depth + 1, b, q)?;
            } else { self.walk(opportunity.arrival, depth + 1, b, q)?; }
        }
        Ok(())
    }
    fn pool(&mut self, arrival: Square, promotion: PieceKind, opportunities: u8,
        baseline: ContactState, candidate: ContactState) -> ContractResult<()> {
        charge(self.work, 8 + 12 + 7 + 6 * 3 * 9 + 5 + 5 * (candidate.blockers.count_ones()
            + baseline.blockers.count_ones() + candidate.cover.count_ones()
            + baseline.cover.count_ones() + candidate.vision.count_ones()) as u64)?;
        let mut exposed = false;
        if candidate.compatible && candidate.blockers == 0 {
            charge(self.work, 15)?;
            let index = arrival.index() * 4 + kind_index(promotion) - 1;
            if let Some(cached) = self.exposure[index] { exposed = cached; }
            else {
                for target in self.projection.final_view.units() {
                    charge(self.work, 12)?;
                    if relation(&self.projection.layers, &self.projection.final_view, arrival, promotion, self.enemy, target.square, self.work)? != Relation::None {
                        exposed = true; break;
                    }
                }
                charge(self.work, 4)?;
                self.exposure[index] = Some(exposed);
            }
        }
        let predicates = [exposed, candidate.blockers & !baseline.blockers != 0,
            baseline.blockers & !candidate.blockers != 0, candidate.cover & !baseline.cover != 0,
            baseline.cover & !candidate.cover != 0, candidate.vision & !baseline.vision != 0];
        for (kernel, predicate) in predicates.into_iter().enumerate() {
            for horizon in opportunities..=3 {
                if predicate { self.files[kernel][horizon as usize - 1] |= 1 << (arrival.file() - 1); }
            }
        }
        Ok(())
    }
}

pub(super) fn encode(projection: &Projection, context: &NumericalFeatureContext, turn: u32,
    work: &mut LedgerWork) -> ContractResult<[f64; 36]> {
    charge(work, 4)?;
    work.charge(36 + 256)?;
    let mut result = [0.0; 36];
    let mut exposure = [None; 256];
    let baseline_lit = lit(&projection.baseline, work)?;
    let candidate_lit = lit(&projection.final_view, work)?;
    for (channel, sources) in [context.witnessed, context.unlocated].into_iter().enumerate() {
        charge(work, 4 + 6 * (4 + 3 * 4))?;
        charge(work, 8)?; charge(work, 8)?;
        charge(work, 6 * 4 + 12)?;
        work.charge(2 * 128 * 5 + 6 * 3 + 64)?;
        let mut walker = Walker { projection, enemy: context.side.other(), turn, baseline_lit, candidate_lit,
            contacts: [[None; 128]; 2], annotations: std::array::from_fn(|_| BTreeMap::new()),
            prefixes: BTreeSet::new(), arrivals: BTreeSet::new(), macros: BTreeMap::new(),
            exposure: &mut exposure, files: [[0; 3]; 6], work };
        for source in all_squares() {
            walker.work.charge(2)?;
            if sources & bit(source) == 0 { continue; }
            charge(walker.work, 4)?;
            walker.walk(source, 0, ContactState::EMPTY, ContactState::EMPTY)?;
        }
        for kernel in 0..6 {
            for horizon in 0..3 {
                charge(walker.work, 12)?;
                result[kernel * 6 + channel * 3 + horizon] = walker.files[kernel][horizon].count_ones() as f64 / 8.0;
            }
        }
    }
    charge(work, 37)?;
    work.charge(128 + 1024 + 36 * (48 + 4))?;
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sq(value: &str) -> Square { Square::parse(value).unwrap() }

    #[test]
    fn marine_original_double_and_arrival_diagonal_bindings() {
        let macros = marine_opportunities(sq("e6"), Side::White, 1, &mut LedgerWork::new()).unwrap();
        assert!(macros.iter().any(|m| m.before && m.classical == 3 && !m.after && m.arrival_binding
            && m.arrival == sq("d8") && m.promotion == Some(PieceKind::Queen)));
        assert!(macros.iter().any(|m| m.before && m.classical == 3 && !m.arrival_binding
            && m.arrival == sq("e7") && m.promotion.is_none()));
        let macros = marine_opportunities(sq("e2"), Side::White, 1, &mut LedgerWork::new()).unwrap();
        assert!(macros.iter().any(|m| m.before && m.classical == 2 && !m.arrival_binding && m.arrival == sq("e5")));
        assert!(!macros.iter().any(|m| m.before && m.classical == 2 && m.arrival_binding));
    }

    #[test]
    fn marine_cf_fc_and_unpromoted_last_rank_arrival() {
        let macros = marine_opportunities(sq("e6"), Side::White, 1, &mut LedgerWork::new()).unwrap();
        assert!(macros.iter().any(|m| !m.before && m.classical == 1 && m.after && m.fc
            && m.arrival == sq("e8") && m.promotion.is_none()));
        assert!(!macros.iter().any(|m| !m.before && m.classical == 1 && m.after && !m.fc));
        let macros = marine_opportunities(sq("e4"), Side::White, 1, &mut LedgerWork::new()).unwrap();
        for fc in [false, true] {
            assert!(macros.iter().any(|m| !m.before && m.classical == 1 && m.after && m.fc == fc && m.promotion.is_none()));
        }
        let macros = marine_opportunities(sq("e8"), Side::White, 3, &mut LedgerWork::new()).unwrap();
        assert_eq!(macros.len(), 1); assert_eq!(macros[0].arrival, sq("e8"));
        assert!(macros[0].promotion.is_none()); assert!(macros[0].entries.iter().all(Option::is_none));
    }

    #[test]
    fn marine_promotion_alternatives_terminate_before_f() {
        let macros = marine_opportunities(sq("e7"), Side::White, 1, &mut LedgerWork::new()).unwrap();
        let alternatives: Vec<_> = macros.iter().filter(|m| !m.before && m.classical == 1 && !m.after)
            .map(|m| m.promotion.unwrap()).collect();
        assert_eq!(alternatives, vec![PieceKind::Knight, PieceKind::Bishop, PieceKind::Rook, PieceKind::Queen]);
        for opportunity in macros.iter().filter(|m| m.promotion.is_some()) {
            assert_eq!(opportunity.arrival.rank(), 8);
            assert!(opportunity.entries.iter().flatten().all(|entry| entry.square.rank() <= 8));
        }
        let gas_zero = marine_opportunities(sq("e2"), Side::White, 0, &mut LedgerWork::new()).unwrap();
        assert!(gas_zero.iter().all(|m| !m.before && !m.after));
    }

    #[test]
    fn marine_double_eligibility_is_positional_and_color_symmetric() {
        for (source, side, allowed) in [("e1", Side::White, true), ("e2", Side::White, true),
            ("e3", Side::White, false), ("e8", Side::Black, true), ("e7", Side::Black, true), ("e6", Side::Black, false)] {
            let macros = marine_opportunities(sq(source), side, 0, &mut LedgerWork::new()).unwrap();
            assert_eq!(macros.iter().any(|m| m.classical == 2), allowed);
        }
    }

    #[test]
    fn spatial_metadata_uses_authored_diagonals_even_when_c_does_not_act() {
        for (source, side, original, arrival, destination) in [
            ("e6", Side::White, "d7", "d8", "e7"),
            ("e3", Side::Black, "d2", "d1", "e2"),
        ] {
            let macros = marine_opportunities(sq(source), side, 1, &mut LedgerWork::new()).unwrap();
            let original_routes: Vec<_> = macros.iter().filter(|m| m.before && m.classical == 3 && !m.arrival_binding).collect();
            assert_eq!(original_routes.len(), 1);
            let route = original_routes[0];
            assert_eq!(route.authored_diagonal_target, Some(sq(original)));
            assert_eq!(route.arrival, sq(destination));
            assert!(route.spatial_eligible);
            assert!(route.entries.iter().flatten().all(|entry| !entry.diagonal));
            let arrivals: Vec<_> = macros.iter().filter(|m| m.before && m.classical == 3 && m.arrival_binding).collect();
            assert_eq!(arrivals.len(), 4);
            assert!(arrivals.iter().all(|m| m.spatial_eligible && m.authored_diagonal_target == Some(sq(arrival))));
        }
    }

    #[test]
    fn spatial_filter_metadata_does_not_remove_feature_promotion_routes() {
        for (source, side, last) in [("e7", Side::White, "e8"), ("e2", Side::Black, "e1")] {
            let macros = marine_opportunities(sq(source), side, 1, &mut LedgerWork::new()).unwrap();
            let rewrite_fallback: Vec<_> = macros.iter().filter(|m| m.before && m.classical == 1 && !m.arrival_binding).collect();
            assert_eq!(rewrite_fallback.len(), 4);
            assert!(rewrite_fallback.iter().all(|m| !m.spatial_eligible && m.arrival == sq(last) && m.promotion.is_some()));
            let post_c: Vec<_> = macros.iter().filter(|m| !m.before && m.classical == 1 && m.after).collect();
            assert_eq!(post_c.len(), 8);
            assert!(post_c.iter().all(|m| !m.spatial_eligible));
            let classical: Vec<_> = macros.iter().filter(|m| !m.before && m.classical == 1 && !m.after).collect();
            assert_eq!(classical.len(), 4);
            assert!(classical.iter().all(|m| m.spatial_eligible));
        }
    }
}
