// SPEC: _spec/packages/training/burn-compat.puml
use std::collections::BTreeSet;
use std::marker::PhantomData;

use serde::de::{MapAccess, Visitor, value::MapAccessDeserializer};
use serde::{Deserialize, Deserializer, Serialize};

pub use crate::contracts::{
    Action, AuthorizedView, ObservedCell, PieceKind as UnitType, Side, Square,
};

use super::work::LedgerWork;

pub type ContractResult<T> = Result<T, LedgerError>;

pub const MAX_BOUNDARY_BYTES: usize = 1_048_576;
pub const MAX_ATOMIC_GROUPS: usize = 2048;
pub const MAX_BOUNDARY_ENTRIES: usize = 2048;
pub const MAX_OWN_UNITS: usize = 64;
pub const MAX_OWN_MINES: usize = 3;
pub const MAX_ACCEPTED_ACTIONS: u32 = 4;

fn deserialize_object<'de, D, T>(deserializer: D) -> Result<T, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    struct ObjectVisitor<T>(PhantomData<T>);

    impl<'de, T: Deserialize<'de>> Visitor<'de> for ObjectVisitor<T> {
        type Value = T;

        fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            formatter.write_str("a JSON object")
        }

        fn visit_map<M: MapAccess<'de>>(self, map: M) -> Result<T, M::Error> {
            T::deserialize(MapAccessDeserializer::new(map))
        }
    }

    deserializer.deserialize_map(ObjectVisitor(PhantomData))
}

fn required_nullable<'de, D, T>(deserializer: D) -> Result<Option<T>, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    Option::deserialize(deserializer)
}

fn required_value<'de, D, T>(deserializer: D) -> Result<T, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    T::deserialize(deserializer)
}

macro_rules! string_enum {
    (pub enum $name:ident { $($variant:ident => $wire:literal),+ $(,)? }) => {
        #[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
        #[serde(try_from = "String", into = "String")]
        pub enum $name { $($variant),+ }

        impl $name {
            pub const fn as_str(self) -> &'static str {
                match self { $(Self::$variant => $wire),+ }
            }
        }

        impl TryFrom<String> for $name {
            type Error = String;

            fn try_from(value: String) -> Result<Self, Self::Error> {
                match value.as_str() {
                    $($wire => Ok(Self::$variant),)+
                    _ => Err(format!("Invalid {}: {value}", stringify!($name))),
                }
            }
        }

        impl From<$name> for String {
            fn from(value: $name) -> Self {
                value.as_str().to_owned()
            }
        }
    };
}

macro_rules! object_struct {
    ($(#[$meta:meta])* pub struct $name:ident {
        $($(#[$field_meta:meta])* pub $field:ident: $ty:ty),* $(,)?
    }) => {
        #[derive(Clone, Debug, PartialEq, Eq, Serialize)]
        $(#[$meta])*
        pub struct $name {
            $($(#[$field_meta])* pub $field: $ty),*
        }

        impl<'de> Deserialize<'de> for $name {
            fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
                #[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
                $(#[$meta])*
                struct Wire {
                    $($(#[$field_meta])* $field: $ty),*
                }

                let Wire { $($field),* } = deserialize_object(deserializer)?;
                Ok(Self { $($field),* })
            }
        }
    };
}

macro_rules! object_enum {
    ($(#[$meta:meta])* pub enum $name:ident {
        $($variant:ident {
            $($(#[$field_meta:meta])* $field:ident: $ty:ty),* $(,)?
        }),* $(,)?
    }) => {
        #[derive(Clone, Debug, PartialEq, Eq, Serialize)]
        $(#[$meta])*
        pub enum $name {
            $($variant { $($(#[$field_meta])* $field: $ty),* }),*
        }

        impl<'de> Deserialize<'de> for $name {
            fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
                #[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
                $(#[$meta])*
                enum Wire {
                    $($variant { $($(#[$field_meta])* $field: $ty),* }),*
                }

                let wire = deserialize_object(deserializer)?;
                Ok(match wire {
                    $(Wire::$variant { $($field),* } => Self::$variant { $($field),* }),*
                })
            }
        }
    };
}

string_enum! {
    pub enum LedgerErrorCode {
        BadInput => "BAD_INPUT", Sequence => "SEQUENCE", Identity => "IDENTITY",
        Conservation => "CONSERVATION", Budget => "BUDGET", Unsupported => "UNSUPPORTED",
        Provenance => "PROVENANCE",
    }
}

object_struct! {
    #[serde(deny_unknown_fields)]
    pub struct LedgerError {
        pub code: LedgerErrorCode,
        pub message: String,
    }
}

impl LedgerError {
    pub fn new(code: LedgerErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

impl std::fmt::Display for LedgerError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(formatter, "{}: {}", self.code.as_str(), self.message)
    }
}

impl std::error::Error for LedgerError {}

fn bad(message: impl Into<String>) -> LedgerError {
    LedgerError::new(LedgerErrorCode::BadInput, message)
}

fn sequence(message: impl Into<String>) -> LedgerError {
    LedgerError::new(LedgerErrorCode::Sequence, message)
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Pair<T> {
    pub w: T,
    pub b: T,
}

impl<'de, T: Deserialize<'de>> Deserialize<'de> for Pair<T> {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        #[derive(Deserialize)]
        #[serde(deny_unknown_fields, bound(deserialize = "T: Deserialize<'de>"))]
        struct Wire<T> {
            #[serde(deserialize_with = "required_value")]
            w: T,
            #[serde(deserialize_with = "required_value")]
            b: T,
        }
        let Wire { w, b } = deserialize_object(deserializer)?;
        Ok(Self { w, b })
    }
}

impl<T> Pair<T> {
    pub const fn get(&self, side: Side) -> &T {
        match side {
            Side::White => &self.w,
            Side::Black => &self.b,
        }
    }

    pub const fn get_mut(&mut self, side: Side) -> &mut T {
        match side {
            Side::White => &mut self.w,
            Side::Black => &mut self.b,
        }
    }
}

string_enum! { pub enum RulesVersion { V1 => "arena-economic-rules-v1" } }
string_enum! { pub enum BoundaryVersion { V1 => "arena-economic-boundary-v1" } }
string_enum! {
    pub enum BoundaryPhase { Initial => "initial", TurnOpen => "turn-open", Settled => "settled" }
}
string_enum! { pub enum TankMode { Tank => "tank", Siege => "siege" } }

object_struct! {
    #[serde(deny_unknown_fields)]
    pub struct UnitCosts {
        pub p: u32,
        pub n: u32,
        pub b: u32,
        pub r: u32,
        pub q: u32,
        pub k: u32,
    }
}

impl UnitCosts {
    pub const fn get(&self, unit_type: UnitType) -> u32 {
        match unit_type {
            UnitType::Pawn => self.p,
            UnitType::Knight => self.n,
            UnitType::Bishop => self.b,
            UnitType::Rook => self.r,
            UnitType::Queen => self.q,
            UnitType::King => self.k,
        }
    }
}

object_struct! {
    #[serde(rename_all = "camelCase", deny_unknown_fields)]
    pub struct LedgerRules {
        pub version: RulesVersion,
        pub opening_bank_default: u32,
        pub unit_costs: UnitCosts,
        pub mineral_bank_cap: u32,
        pub mine_entity_cap: u32,
        pub max_turn: u32,
        pub income_by_turn: Vec<u32>,
        pub gas_capacity_by_turn: Vec<u32>,
    }
}

impl LedgerRules {
    pub fn validate(&self, work: &mut LedgerWork) -> ContractResult<()> {
        work.charge_rules(self)?;
        if !(1..=12).contains(&self.mineral_bank_cap)
            || !(1..=3).contains(&self.mine_entity_cap)
            || self.max_turn > 45
            || self.opening_bank_default > self.mineral_bank_cap
        {
            return Err(bad("Rules exceed native physical resource bounds"));
        }
        let length = usize::try_from(self.max_turn)
            .ok()
            .and_then(|turn| turn.checked_add(1))
            .ok_or_else(|| bad("Rules table length overflow"))?;
        if self.income_by_turn.len() != length || self.gas_capacity_by_turn.len() != length {
            return Err(bad("Rules require maxTurn + 1 entries in both tables"));
        }
        if [
            self.unit_costs.p,
            self.unit_costs.n,
            self.unit_costs.b,
            self.unit_costs.r,
            self.unit_costs.q,
            self.unit_costs.k,
        ]
        .iter()
        .any(|cost| *cost == 0 || *cost > self.mineral_bank_cap)
            || self
                .income_by_turn
                .iter()
                .any(|income| *income > self.mineral_bank_cap)
            || self
                .gas_capacity_by_turn
                .iter()
                .any(|capacity| !(1..=3).contains(capacity))
        {
            return Err(bad("Rules costs or table values exceed physical bounds"));
        }
        Ok(())
    }

    pub const fn non_cc_replacement(&self, unit_type: UnitType) -> u32 {
        match unit_type {
            UnitType::King => 0,
            _ => self.unit_costs.get(unit_type),
        }
    }

    pub fn income_at(&self, turn: u32) -> ContractResult<u32> {
        self.table_at(&self.income_by_turn, turn)
    }

    pub fn gas_capacity_at(&self, turn: u32) -> ContractResult<u32> {
        self.table_at(&self.gas_capacity_by_turn, turn)
    }

    fn table_at(&self, table: &[u32], turn: u32) -> ContractResult<u32> {
        if turn > self.max_turn {
            return Err(bad("Turn exceeds the rules profile"));
        }
        usize::try_from(turn)
            .ok()
            .and_then(|index| table.get(index))
            .copied()
            .ok_or_else(|| bad("Rules table does not contain the requested turn"))
    }
}

object_struct! {
    #[serde(deny_unknown_fields)]
    pub struct OwnUnitGeometry {
        pub square: Square,
        #[serde(rename = "type")]
        pub kind: UnitType,
        #[serde(deserialize_with = "required_nullable")]
        pub mode: Option<TankMode>,
    }
}

object_struct! {
    #[derive(Copy, PartialOrd, Ord)]
    #[serde(deny_unknown_fields)]
    pub struct MineOccurrence {
        pub square: Square,
        pub slot: u32,
    }
}

object_struct! {
    #[serde(rename_all = "camelCase", deny_unknown_fields)]
    pub struct OwnGeometry {
        pub units: Vec<OwnUnitGeometry>,
        pub mines: Vec<MineOccurrence>,
        pub cc_lives: u32,
    }
}

impl OwnGeometry {
    pub fn validate(&self, rules: &LedgerRules, work: &mut LedgerWork) -> ContractResult<()> {
        work.charge_geometry(self)?;
        self.validate_shape(rules)
    }

    fn validate_shape(&self, rules: &LedgerRules) -> ContractResult<()> {
        if self.units.len() > MAX_OWN_UNITS
            || self.mines.len() > rules.mine_entity_cap as usize
            || self.mines.len() > MAX_OWN_MINES
            || self.cc_lives > 3
        {
            return Err(bad("Own geometry exceeds physical bounds"));
        }
        if self
            .units
            .windows(2)
            .any(|pair| pair[0].square >= pair[1].square)
            || self
                .units
                .iter()
                .any(|unit| (unit.kind == UnitType::Rook) != unit.mode.is_some())
        {
            return Err(bad(
                "Own units require unique file-major squares and rook-only modes",
            ));
        }
        let mut previous: Option<MineOccurrence> = None;
        for mine in &self.mines {
            let expected = match previous {
                Some(last) if last.square == mine.square => last
                    .slot
                    .checked_add(1)
                    .ok_or_else(|| bad("Mine slot overflow"))?,
                Some(last) if last.square > mine.square => {
                    return Err(bad("Mines are not file-major"));
                }
                _ => 0,
            };
            if mine.slot != expected {
                return Err(bad("Mine slots must restart at zero for each square"));
            }
            previous = Some(*mine);
        }
        Ok(())
    }

    pub fn from_snapshot(snapshot: &AuthorizedView, work: &mut LedgerWork) -> ContractResult<Self> {
        work.charge_snapshot(snapshot)?;
        snapshot.validate().map_err(bad)?;
        let units = snapshot
            .own
            .pieces
            .iter()
            .map(|piece| OwnUnitGeometry {
                square: piece.square,
                kind: piece.kind,
                mode: (piece.kind == UnitType::Rook).then(|| {
                    if snapshot
                        .own
                        .sieged_tanks
                        .binary_search(&piece.square)
                        .is_ok()
                    {
                        TankMode::Siege
                    } else {
                        TankMode::Tank
                    }
                }),
            })
            .collect();
        let mut mines = Vec::with_capacity(snapshot.own.mines.len());
        for square in &snapshot.own.mines {
            let slot = match mines.last() {
                Some(MineOccurrence { square: last, slot }) if last == square => slot
                    .checked_add(1)
                    .ok_or_else(|| bad("Mine slot overflow"))?,
                _ => 0,
            };
            mines.push(MineOccurrence {
                square: *square,
                slot,
            });
        }
        Ok(Self {
            units,
            mines,
            cc_lives: snapshot.own.cc_lives,
        })
    }
}

object_struct! {
    #[derive(Copy, PartialOrd, Ord, Hash)]
    #[serde(rename_all = "camelCase", deny_unknown_fields)]
    pub struct ActionRef {
        pub planning_ordinal: u32,
        pub accepted_action_ordinal: u32,
    }
}

impl ActionRef {
    pub fn validate(&self) -> ContractResult<()> {
        if self.accepted_action_ordinal >= MAX_ACCEPTED_ACTIONS {
            return Err(bad("Accepted action ordinal must be in 0..4"));
        }
        Ok(())
    }
}

object_struct! {
    #[serde(rename_all = "camelCase", deny_unknown_fields)]
    pub struct AcceptedOwnAction {
        pub action_ref: ActionRef,
        pub action: Action,
        pub minerals: u32,
        pub gas: u32,
    }
}

impl AcceptedOwnAction {
    pub fn validate_for(&self, side: Side, rules: &LedgerRules) -> ContractResult<()> {
        self.action_ref.validate()?;
        self.action.validate_for(side).map_err(bad)?;
        let expected = match &self.action {
            Action::Deploy { unit, .. } => match unit {
                crate::contracts::SpawnPiece::Pawn => rules.unit_costs.p,
                crate::contracts::SpawnPiece::Knight => rules.unit_costs.n,
                crate::contracts::SpawnPiece::Bishop => rules.unit_costs.b,
                crate::contracts::SpawnPiece::Rook => rules.unit_costs.r,
                crate::contracts::SpawnPiece::Queen => rules.unit_costs.q,
            },
            _ => 0,
        };
        if self.minerals != expected
            || self.minerals > rules.mineral_bank_cap
            || self.gas > 3
            || (self.action.is_classical() && self.gas != 0)
            || (!self.action.is_classical() && self.gas == 0)
        {
            return Err(bad(
                "Accepted action prices disagree with rules or physical bounds",
            ));
        }
        Ok(())
    }
}

object_enum! {
    #[derive(PartialOrd, Ord)]
    #[serde(tag = "kind", rename_all = "kebab-case", rename_all_fields = "camelCase", deny_unknown_fields)]
    pub enum UnitSubject {
        BeforeUnit { square: Square },
        BornUnit { action_ref: ActionRef },
    }
}

object_enum! {
    #[derive(PartialOrd, Ord)]
    #[serde(tag = "kind", rename_all = "kebab-case", rename_all_fields = "camelCase", deny_unknown_fields)]
    pub enum MineSubject {
        BeforeMine { square: Square, slot: u32 },
        BornMine { action_ref: ActionRef },
    }
}

object_enum! {
    #[serde(tag = "kind", rename_all = "kebab-case", rename_all_fields = "camelCase", deny_unknown_fields)]
    pub enum EffectFact {
        UnitBorn { action_ref: ActionRef, square: Square, #[serde(rename = "type")] kind: UnitType },
        UnitMoved { subject: UnitSubject, from: Square, to: Square },
        UnitTransformed { subject: UnitSubject, from_type: UnitType, to_type: UnitType },
        UnitModeChanged { subject: UnitSubject, before: TankMode, after: TankMode },
        UnitDestroyed { subject: UnitSubject, square: Square, #[serde(rename = "type")] kind: UnitType },
        DeploymentUnmaterialized { action_ref: ActionRef },
        MineBorn { action_ref: ActionRef, square: Square },
        MineRemoved { subject: MineSubject },
        CcLivesChanged { before: u32, after: u32 },
        EnemyDestructionWitnessed {
            square: Square,
            #[serde(rename = "type")]
            kind: UnitType,
            #[serde(deserialize_with = "required_nullable")]
            own_action_ref: Option<ActionRef>,
        },
    }
}

impl EffectFact {
    fn validate_shape(&self) -> ContractResult<()> {
        match self {
            Self::UnitBorn {
                action_ref, kind, ..
            } => {
                action_ref.validate()?;
                if *kind == UnitType::King {
                    return Err(bad("Command centers cannot be deployed"));
                }
            }
            Self::UnitMoved { subject, from, to } => {
                validate_unit_subject(subject)?;
                if from == to {
                    return Err(bad("Unit movement must change square"));
                }
            }
            Self::UnitTransformed {
                subject,
                from_type,
                to_type,
            } => {
                validate_unit_subject(subject)?;
                if from_type == to_type
                    || *from_type == UnitType::King
                    || *to_type == UnitType::King
                {
                    return Err(bad("Unit transformations require distinct non-CC types"));
                }
            }
            Self::UnitModeChanged {
                subject,
                before,
                after,
            } => {
                validate_unit_subject(subject)?;
                if before == after {
                    return Err(bad("Mode changes require distinct modes"));
                }
            }
            Self::UnitDestroyed { subject, kind, .. } => {
                validate_unit_subject(subject)?;
                if *kind == UnitType::King {
                    return Err(bad("CC damage requires cc-lives-changed"));
                }
            }
            Self::DeploymentUnmaterialized { action_ref } | Self::MineBorn { action_ref, .. } => {
                action_ref.validate()?;
            }
            Self::MineRemoved { subject } => match subject {
                MineSubject::BeforeMine { slot, .. } if *slot >= MAX_OWN_MINES as u32 => {
                    return Err(bad("Before-mine slot exceeds the physical mine cap"));
                }
                MineSubject::BornMine { action_ref } => action_ref.validate()?,
                _ => {}
            },
            Self::CcLivesChanged { before, after } => {
                if *before > 3 || *after > 3 || before == after {
                    return Err(bad(
                        "CC life changes exceed physical bounds or change nothing",
                    ));
                }
            }
            Self::EnemyDestructionWitnessed {
                kind,
                own_action_ref,
                ..
            } => {
                if *kind == UnitType::King {
                    return Err(bad("Enemy CC damage is not ordinary destruction"));
                }
                if let Some(action_ref) = own_action_ref {
                    action_ref.validate()?;
                }
            }
        }
        Ok(())
    }
}

fn validate_unit_subject(subject: &UnitSubject) -> ContractResult<()> {
    if let UnitSubject::BornUnit { action_ref } = subject {
        action_ref.validate()?;
    }
    Ok(())
}

object_enum! {
    #[serde(tag = "kind", rename_all = "kebab-case", rename_all_fields = "camelCase", deny_unknown_fields)]
    pub enum AtomicGroup {
        Admission { seq: u32, actions: Vec<AcceptedOwnAction> },
        Effects { seq: u32, before_own: OwnGeometry, after_own: OwnGeometry, facts: Vec<EffectFact> },
        Vision { seq: u32, turn: u32, changes: Vec<ObservedCell> },
        Settlement { seq: u32, entitlement: u32, credited: u32, gas_before_reset: u32, next_gas_capacity: u32 },
    }
}

impl AtomicGroup {
    pub const fn seq(&self) -> u32 {
        match self {
            Self::Admission { seq, .. }
            | Self::Effects { seq, .. }
            | Self::Vision { seq, .. }
            | Self::Settlement { seq, .. } => *seq,
        }
    }

    pub fn entries(&self) -> usize {
        match self {
            Self::Admission { actions, .. } => actions.len(),
            Self::Effects { facts, .. } => facts.len(),
            _ => 0,
        }
    }
}

object_struct! {
    #[serde(rename_all = "camelCase", deny_unknown_fields)]
    pub struct EconomicBoundary {
        pub version: BoundaryVersion,
        pub side: Side,
        pub ordinal: u32,
        pub phase: BoundaryPhase,
        pub turn: u32,
        pub planning_ordinal: u32,
        pub grant_ordinal: u32,
        pub seq_before: u32,
        pub seq_through: u32,
        pub groups: Vec<AtomicGroup>,
        pub snapshot: AuthorizedView,
    }
}

impl EconomicBoundary {
    pub fn validate(&self, rules: &LedgerRules, work: &mut LedgerWork) -> ContractResult<()> {
        rules.validate(work)?;
        work.charge_boundary(self)?;
        self.snapshot.validate().map_err(bad)?;
        if self.side != self.snapshot.side
            || self.turn != self.snapshot.turn
            || self.snapshot.own.minerals > rules.mineral_bank_cap
            || self.snapshot.own.mines.len() > rules.mine_entity_cap as usize
            || !(1..=3).contains(&self.snapshot.own.gas_income)
            || (self.phase != BoundaryPhase::TurnOpen
                && self.snapshot.own.gas_income != rules.gas_capacity_at(self.turn)?)
        {
            return Err(bad(
                "Boundary snapshot disagrees with its side, turn, or rules",
            ));
        }
        rules.income_at(self.turn)?;
        if self.planning_ordinal != self.grant_ordinal {
            return Err(sequence("Planning and grant ordinals must agree"));
        }
        if self.phase == BoundaryPhase::Initial {
            if self.ordinal != 0
                || self.planning_ordinal != 0
                || self.grant_ordinal != 0
                || self.seq_before != 0
                || self.seq_through != 0
                || !self.groups.is_empty()
            {
                return Err(sequence(
                    "Initial boundaries require zero ordinals and no groups",
                ));
            }
            return Ok(());
        }
        if self.ordinal == 0 {
            return Err(sequence("Noninitial boundaries require a positive ordinal"));
        }
        let count =
            u32::try_from(self.groups.len()).map_err(|_| sequence("Group count overflow"))?;
        if self.seq_before.checked_add(count) != Some(self.seq_through) {
            return Err(sequence(
                "Boundary sequence range does not match the group count",
            ));
        }
        let planning = if self.phase == BoundaryPhase::Settled {
            self.planning_ordinal
                .checked_sub(1)
                .ok_or_else(|| sequence("Settled ordinals must advance"))?
        } else {
            self.planning_ordinal
        };
        let mut actions = BTreeSet::new();
        let mut settlements = 0_u32;
        for (index, group) in self.groups.iter().enumerate() {
            let offset = u32::try_from(index)
                .ok()
                .and_then(|value| value.checked_add(1))
                .ok_or_else(|| sequence("Group sequence overflow"))?;
            if self.seq_before.checked_add(offset) != Some(group.seq()) {
                return Err(sequence(
                    "Groups require consecutive filtered sequence numbers",
                ));
            }
            match group {
                AtomicGroup::Admission {
                    actions: admitted, ..
                } => {
                    if admitted.is_empty() {
                        return Err(bad("Admission groups cannot be empty"));
                    }
                    for action in admitted {
                        action.validate_for(self.side, rules)?;
                        if action.action_ref.planning_ordinal != planning
                            || !actions.insert(action.action_ref.accepted_action_ordinal)
                        {
                            return Err(sequence(
                                "Admission references require this planning window and unique ordinals",
                            ));
                        }
                    }
                }
                AtomicGroup::Effects {
                    before_own,
                    after_own,
                    facts,
                    ..
                } => {
                    if facts.is_empty() {
                        return Err(bad("Effect groups cannot be empty"));
                    }
                    before_own.validate_shape(rules)?;
                    after_own.validate_shape(rules)?;
                    for fact in facts {
                        fact.validate_shape()?;
                    }
                }
                AtomicGroup::Vision { turn, changes, .. } => {
                    if *turn > self.turn
                        || *turn > rules.max_turn
                        || changes.is_empty()
                        || changes
                            .windows(2)
                            .any(|pair| pair[0].square() >= pair[1].square())
                    {
                        return Err(bad(
                            "Vision changes require canonical unique squares and an authorized turn",
                        ));
                    }
                }
                AtomicGroup::Settlement {
                    entitlement,
                    credited,
                    gas_before_reset,
                    next_gas_capacity,
                    ..
                } => {
                    settlements = settlements
                        .checked_add(1)
                        .ok_or_else(|| sequence("Settlement count overflow"))?;
                    if self.phase != BoundaryPhase::Settled
                        || index + 1 != self.groups.len()
                        || *entitlement != rules.income_at(self.turn)?
                        || credited > entitlement
                        || *credited > rules.mineral_bank_cap
                        || *gas_before_reset > 3
                        || *next_gas_capacity != rules.gas_capacity_at(self.turn)?
                    {
                        return Err(bad(
                            "Settlement group disagrees with its phase, order, or rules",
                        ));
                    }
                }
            }
        }
        if self.phase == BoundaryPhase::Settled && settlements != 1 {
            return Err(sequence(
                "Settled boundaries require exactly one final settlement",
            ));
        }
        Ok(())
    }
}

pub fn decode_boundary(
    bytes: &[u8],
    rules: &LedgerRules,
    work: &mut LedgerWork,
) -> ContractResult<EconomicBoundary> {
    work.preflight_bytes(bytes.len())?;
    let boundary: EconomicBoundary =
        serde_json::from_slice(bytes).map_err(|error| bad(error.to_string()))?;
    boundary.validate(rules, work)?;
    Ok(boundary)
}

pub fn canonical_boundary_bytes(
    boundary: &EconomicBoundary,
    work: &mut LedgerWork,
) -> ContractResult<Vec<u8>> {
    work.charge_boundary(boundary)?;
    struct Counter(usize);
    impl std::io::Write for Counter {
        fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
            self.0 = self
                .0
                .checked_add(bytes.len())
                .filter(|length| *length <= MAX_BOUNDARY_BYTES)
                .ok_or_else(|| std::io::Error::other("Canonical boundary exceeds the byte cap"))?;
            Ok(bytes.len())
        }
        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }
    }
    let mut counter = Counter(0);
    serde_json::to_writer(&mut counter, boundary)
        .map_err(|error| LedgerError::new(LedgerErrorCode::Budget, error.to_string()))?;
    work.charge_canonical_bytes(counter.0)?;
    let value = serde_json::to_value(boundary).map_err(|error| bad(error.to_string()))?;
    fn sort(value: serde_json::Value) -> serde_json::Value {
        match value {
            serde_json::Value::Object(fields) => {
                let sorted: std::collections::BTreeMap<_, _> = fields
                    .into_iter()
                    .map(|(key, value)| (key, sort(value)))
                    .collect();
                serde_json::Value::Object(sorted.into_iter().collect())
            }
            serde_json::Value::Array(values) => {
                serde_json::Value::Array(values.into_iter().map(sort).collect())
            }
            other => other,
        }
    }
    serde_json::to_vec(&sort(value)).map_err(|error| bad(error.to_string()))
}
