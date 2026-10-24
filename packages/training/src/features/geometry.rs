// SPEC: _spec/packages/training/shared418.puml
use crate::contracts::{PieceKind, Promotion, Side, SpawnPiece, Square, all_squares};
use crate::ledger::LedgerWork;
use crate::ledger::contracts::{ContractResult, TankMode};
use super::projection::{Layers, OwnView, Unit};
use super::{bit, charge};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum Relation { None, Known, Possible }
#[derive(Default)]
pub(super) struct Ray {
    pub applicable: bool, pub empty: u32, pub occupied: u32, pub unknown: u32, pub distance: u32,
}
#[derive(Clone, Copy, Default)]
pub(super) struct Exposure { pub known: u32, pub possible: u32 }

pub(super) fn kind_index(kind: PieceKind) -> usize {
    match kind { PieceKind::Pawn => 0, PieceKind::Knight => 1, PieceKind::Bishop => 2,
        PieceKind::Rook => 3, PieceKind::Queen => 4, PieceKind::King => 5 }
}
pub(super) fn spawn_kind(kind: SpawnPiece) -> PieceKind {
    match kind { SpawnPiece::Pawn => PieceKind::Pawn, SpawnPiece::Knight => PieceKind::Knight,
        SpawnPiece::Bishop => PieceKind::Bishop, SpawnPiece::Rook => PieceKind::Rook,
        SpawnPiece::Queen => PieceKind::Queen }
}
pub(super) fn promoted_kind(kind: Promotion) -> PieceKind {
    match kind { Promotion::Knight => PieceKind::Knight, Promotion::Bishop => PieceKind::Bishop,
        Promotion::Rook => PieceKind::Rook, Promotion::Queen => PieceKind::Queen }
}
pub(super) fn native_cost(kind: PieceKind) -> u32 {
    match kind { PieceKind::Pawn | PieceKind::King => 1, PieceKind::Knight | PieceKind::Bishop => 3,
        PieceKind::Rook => 5, PieceKind::Queen => 9 }
}
pub(super) fn replacement(kind: PieceKind, work: &mut LedgerWork) -> ContractResult<f64> {
    charge(work, 3)?;
    Ok(if kind == PieceKind::King { 0.0 } else { native_cost(kind) as f64 })
}
pub(super) fn square(file: i16, rank: i16) -> Option<Square> {
    if !(1..=8).contains(&file) || !(1..=8).contains(&rank) { return None; }
    let bytes = [b'a' + (file - 1) as u8, b'1' + (rank - 1) as u8];
    Square::parse(std::str::from_utf8(&bytes).expect("ASCII square coordinates")).ok()
}
pub(super) fn direction(side: Side) -> i16 { if side == Side::White { 1 } else { -1 } }
pub(super) fn step(from: Square, side: Side) -> Option<Square> {
    square(from.file() as i16, from.rank() as i16 + direction(side))
}
pub(super) fn double_eligible(from: Square, side: Side) -> bool {
    if side == Side::White { from.rank() <= 2 } else { from.rank() >= 7 }
}
pub(super) fn distance(from: Square, to: Square, work: &mut LedgerWork) -> ContractResult<u32> {
    charge(work, 16)?;
    Ok(from.file().abs_diff(to.file()).max(from.rank().abs_diff(to.rank())) as u32)
}
fn sliding(kind: PieceKind, from: Square, to: Square) -> bool {
    if from == to { return false; }
    let df = from.file().abs_diff(to.file());
    let dr = from.rank().abs_diff(to.rank());
    match kind { PieceKind::Bishop => df == dr, PieceKind::Rook => df == 0 || dr == 0,
        PieceKind::Queen => df == dr || df == 0 || dr == 0, _ => false }
}
pub(super) fn ray(layers: &Layers, view: &OwnView, kind: PieceKind, from: Square, to: Square,
    work: &mut LedgerWork) -> ContractResult<Ray> {
    charge(work, 28)?;
    let applicable = sliding(kind, from, to);
    charge(work, 8)?;
    if !applicable { return Ok(Ray::default()); }
    charge(work, 16)?;
    charge(work, 3)?;
    let mut result = Ray { applicable, ..Ray::default() };
    let df = (to.file() as i16 - from.file() as i16).signum();
    let dr = (to.rank() as i16 - from.rank() as i16).signum();
    let mut file = from.file() as i16 + df;
    let mut rank = from.rank() as i16 + dr;
    while file != to.file() as i16 || rank != to.rank() as i16 {
        charge(work, 12)?;
        let mid = square(file, rank).expect("Bounded ray intermediate");
        if layers.enemies[mid.index()].is_some() || view.at[mid.index()].is_some() { result.occupied += 1; }
        else if layers.unknown & bit(mid) != 0 { result.unknown += 1; }
        else { result.empty += 1; }
        file += df; rank += dr;
    }
    charge(work, 7)?;
    result.distance = distance(from, to, work)?;
    Ok(result)
}
pub(super) fn relation(layers: &Layers, view: &OwnView, from: Square, kind: PieceKind,
    side: Side, to: Square, work: &mut LedgerWork) -> ContractResult<Relation> {
    charge(work, 8)?;
    if from == to { return Ok(Relation::None); }
    charge(work, 24)?;
    let df = to.file() as i16 - from.file() as i16;
    let dr = to.rank() as i16 - from.rank() as i16;
    let shape = match kind {
        PieceKind::Pawn => df.abs() == 1 && dr == direction(side),
        PieceKind::Knight => df.abs() == 1 && dr.abs() == 2 || df.abs() == 2 && dr.abs() == 1,
        PieceKind::King => df.abs() <= 1 && dr.abs() <= 1,
        _ => sliding(kind, from, to),
    };
    if !shape { return Ok(Relation::None); }
    if matches!(kind, PieceKind::Bishop | PieceKind::Rook | PieceKind::Queen) {
        let ray = ray(layers, view, kind, from, to, work)?;
        charge(work, 7)?;
        Ok(if !ray.applicable || ray.occupied > 0 { Relation::None }
            else if ray.unknown > 0 { Relation::Possible } else { Relation::Known })
    } else { charge(work, 1)?; Ok(Relation::Known) }
}
pub(super) fn exposure(layers: &Layers, view: &OwnView, target: Square,
    work: &mut LedgerWork) -> ContractResult<Exposure> {
    charge(work, 12)?;
    let mut result = Exposure::default();
    work.charge(64)?;
    for (index, enemy) in layers.enemies.iter().enumerate() {
        if let Some((kind, side)) = enemy {
            charge(work, 10)?;
            let source = square((index / 8 + 1) as i16, (index % 8 + 1) as i16).expect("Bounded enemy square");
            let relation = relation(layers, view, source, *kind, *side, target, work)?;
            charge(work, 5)?;
            match relation { Relation::Known => result.known += 1, Relation::Possible => result.possible += 1, _ => {} }
        }
    }
    charge(work, 3)?;
    Ok(result)
}
pub(super) fn pressure(layers: &Layers, view: &OwnView, actor: Unit,
    work: &mut LedgerWork) -> ContractResult<(u32, bool)> {
    charge(work, 4)?;
    let (mut units, mut cc) = (0, false);
    work.charge(64)?;
    for (index, enemy) in layers.enemies.iter().enumerate() {
        if let Some((kind, _)) = enemy {
            charge(work, 7)?;
            let target = square((index / 8 + 1) as i16, (index % 8 + 1) as i16).expect("Bounded enemy square");
            let relation = relation(layers, view, actor.square, actor.kind, actor.side, target, work)?;
            charge(work, 5)?;
            if relation == Relation::Known { if *kind == PieceKind::King { cc = true; } else { units += 1; } }
        }
    }
    charge(work, 3)?;
    Ok((units, cc))
}
pub(super) fn threatened(layers: &Layers, view: &OwnView, work: &mut LedgerWork) -> ContractResult<(u32, bool)> {
    charge(work, 4)?;
    let (mut units, mut cc) = (0, false);
    for unit in view.units() {
        charge(work, 5)?;
        let e = exposure(layers, view, unit.square, work)?;
        charge(work, 8)?;
        if unit.kind == PieceKind::King { cc |= e.known > 0; }
        else if e.known + e.possible > 0 { units += 1; }
    }
    charge(work, 3)?;
    Ok((units, cc))
}
pub(super) fn lit(view: &OwnView, work: &mut LedgerWork) -> ContractResult<u64> {
    charge(work, 8)?;
    charge(work, 2 + 3 * view.mines.count_ones() as u64)?;
    let mut result = view.mines;
    for unit in view.units() {
        charge(work, 24)?;
        work.charge(64 * 8)?;
        for target in all_squares() {
            let df = target.file() as i16 - unit.square.file() as i16;
            let dr = target.rank() as i16 - unit.square.rank() as i16;
            let visible = match unit.kind {
                PieceKind::King => df.abs() <= 1 && dr.abs() <= 1,
                PieceKind::Pawn => df == 0 && dr == 0
                    || df.abs() <= 1 && dr == direction(unit.side)
                    || df == 0 && dr == 2 * direction(unit.side),
                PieceKind::Knight => df.abs() <= 2 && dr.abs() <= 2
                    && !(df.abs() == 2 && dr.abs() == 2)
                    && !(df == 0 && dr.abs() == 2 || dr == 0 && df.abs() == 2),
                PieceKind::Bishop => df.abs() <= 2 && dr.abs() <= 2,
                PieceKind::Rook => { let radius = if unit.mode == Some(TankMode::Siege) { 4 } else { 2 };
                    df.abs() <= radius && dr.abs() <= radius },
                PieceKind::Queen => df.abs() <= 3 && dr.abs() <= 3,
            };
            if visible { charge(work, 4)?; result |= bit(target); }
        }
    }
    charge(work, 1)?;
    Ok(result)
}
