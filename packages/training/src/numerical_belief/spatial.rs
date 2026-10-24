// SPEC: _spec/packages/training/belief-integration.puml
use crate::contracts::{ObservedCell, ObservedPiece, PieceKind, Side, all_squares};
use crate::feature_input::FeatureInput;
use crate::joint_math::NumericSupport;
use crate::ledger::LedgerWork;
use crate::ledger::contracts::BoundaryPhase;

use super::{BeliefError, BeliefResult, MarineOpportunityProvider, MarineOptions};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SpatialState {
    pub enemy_cc: u64,
    pub witnessed: u64,
    pub unlocated: u64,
}

pub fn support_can_birth(support: &NumericSupport, work: &mut LedgerWork) -> BeliefResult<bool> {
    work.charge(32 + 8 * 7501)?;
    if support.cells().len() != 7501 { return Err(BeliefError::SpatialConsistency); }
    let mut result = false;
    for (index, supported) in support.cells().iter().enumerate() {
        result |= index >= 577 && *supported;
    }
    Ok(result)
}

pub fn reduce_spatial<M: MarineOpportunityProvider + ?Sized>(
    prior: SpatialState,
    frame: &FeatureInput,
    gas: u8,
    can_birth: bool,
    marines: &M,
    work: &mut LedgerWork,
) -> BeliefResult<SpatialState> {
    work.charge(128)?;
    if gas > 3 || frame.view.cells.len() != 64 || prior.enemy_cc == 0 {
        return Err(BeliefError::SpatialConsistency);
    }
    work.charge(32 * 64)?;
    let mut anchors = 0_u64;
    let mut diagonal = 0_u64;
    for index in 0..64 {
        if frame.view.cells[index].square().index() != index {
            return Err(BeliefError::FrameMismatch);
        }
        if frame.innovation.marine_anchors[index] { anchors |= 1_u64 << index; }
        if frame.innovation.own_geometry[index] { diagonal |= 1_u64 << index; }
    }
    work.charge(32)?;
    let settled = frame.stamp.phase == BoundaryPhase::Settled;
    let raw_cc = if settled { adjacent(prior.enemy_cc, false, work)? } else { prior.enemy_cc };
    let enemy_cc = prune(raw_cc, frame, PieceKind::King, work)?;
    if enemy_cc == 0 { return Err(BeliefError::SpatialConsistency); }
    work.charge(64)?;
    let existing = prior.witnessed | prior.unlocated;
    let enemy = frame.view.side.other();
    let options = MarineOptions { gas, classical: true, specials: true, before: true };
    let (mut witnessed, mut unlocated) = if settled {
        let witnessed = propagate(prior.witnessed, 0, false, enemy, diagonal, options, marines, work)?;
        let unlocated = propagate(prior.unlocated, 0, false, enemy, diagonal, options, marines, work)?;
        let witnessed = propagate(anchors, witnessed, true, enemy, diagonal, options, marines, work)?;
        (witnessed, unlocated)
    } else {
        work.charge(32)?;
        (prior.witnessed | anchors, prior.unlocated)
    };
    if settled && can_birth && gas >= 1 {
        let before_births = adjacent(prior.enemy_cc, true, work)?;
        let after_births = adjacent(raw_cc, true, work)?;
        for square in all_squares() {
            work.charge(16)?;
            let bit = 1_u64 << square.index();
            if square.rank() == if enemy == Side::White { 8 } else { 1 } { continue; }
            if before_births & bit != 0 {
                let birth_options = MarineOptions { gas: gas - 1, specials: existing & bit != 0, ..options };
                unlocated = propagate(bit, unlocated, true, enemy, diagonal, birth_options, marines, work)?;
            }
            if after_births & bit != 0 {
                work.charge(16)?;
                unlocated |= bit;
                if existing & bit != 0 {
                    let birth_options = MarineOptions { gas: gas - 1, classical: false, before: false, ..options };
                    unlocated = propagate(bit, unlocated, true, enemy, diagonal, birth_options, marines, work)?;
                }
            }
        }
    }
    for cell in &frame.view.cells {
        work.charge(32)?;
        if observed_piece(cell).is_some_and(|piece| piece.color == enemy && piece.kind == PieceKind::Pawn) {
            let bit = 1_u64 << cell.square().index();
            witnessed |= bit;
            unlocated &= !bit;
        }
    }
    let witnessed = prune(witnessed, frame, PieceKind::Pawn, work)?;
    let unlocated = prune(unlocated, frame, PieceKind::Pawn, work)?;
    work.charge(24)?;
    Ok(SpatialState { enemy_cc, witnessed, unlocated })
}

fn propagate<M: MarineOpportunityProvider + ?Sized>(
    sources: u64,
    mut target: u64,
    retain: bool,
    enemy: Side,
    diagonal: u64,
    options: MarineOptions,
    marines: &M,
    work: &mut LedgerWork,
) -> BeliefResult<u64> {
    work.charge(32)?;
    for source in all_squares() {
        work.charge(16)?;
        let bit = 1_u64 << source.index();
        if sources & bit == 0 { continue; }
        work.charge(32)?;
        if retain { target |= bit; }
        marines.visit(source, enemy, diagonal, options, work, &mut |outcome, work| {
            work.charge(32)?;
            if outcome.promotion.is_none() { target |= 1_u64 << outcome.destination.index(); }
            Ok(())
        })?;
    }
    work.charge(8)?;
    Ok(target)
}

fn adjacent(sources: u64, ring: bool, work: &mut LedgerWork) -> BeliefResult<u64> {
    work.charge(32)?;
    let mut target = 0_u64;
    for square in all_squares() {
        work.charge(16)?;
        if sources & (1_u64 << square.index()) == 0 { continue; }
        for dx in -1_i16..=1 {
            for dy in -1_i16..=1 {
                work.charge(32)?;
                if ring && dx == 0 && dy == 0 { continue; }
                let file = i16::from(square.file()) + dx;
                let rank = i16::from(square.rank()) + dy;
                if (1..=8).contains(&file) && (1..=8).contains(&rank) {
                    target |= 1_u64 << ((file - 1) * 8 + rank - 1) as u32;
                }
            }
        }
    }
    Ok(target)
}

fn prune(sources: u64, frame: &FeatureInput, kind: PieceKind, work: &mut LedgerWork) -> BeliefResult<u64> {
    let mut target = 0_u64;
    for cell in &frame.view.cells {
        work.charge(32)?;
        let bit = 1_u64 << cell.square().index();
        if sources & bit != 0 && (matches!(cell, ObservedCell::Unknown { .. })
            || observed_piece(cell).is_some_and(|piece| piece.color != frame.view.side && piece.kind == kind))
        {
            target |= bit;
        }
    }
    Ok(target)
}

pub(super) fn observed_piece(cell: &ObservedCell) -> Option<&ObservedPiece> {
    match cell {
        ObservedCell::Lit { piece, .. } => piece.as_ref(),
        ObservedCell::Revealed { piece, .. } => Some(piece),
        ObservedCell::Unknown { .. } => None,
    }
}
