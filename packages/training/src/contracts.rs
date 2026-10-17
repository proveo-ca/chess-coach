// SPEC: _spec/packages/training/burn-compat.puml
use std::collections::BTreeMap;
use std::marker::PhantomData;

use serde::de::{MapAccess, Visitor, value::MapAccessDeserializer};
use serde::{Deserialize, Deserializer, Serialize};

pub type ContractResult<T> = Result<T, String>;

pub const MAX_GENERATED_ACTIONS: usize = 4;
pub const MAX_ATTEMPTED_EXTENSIONS: usize = 2048;
pub const MAX_RETAINED_CANDIDATES: usize = 512;
pub const MAX_MINES_PER_SIDE: usize = 3;

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

fn optional_non_null<'de, D, T>(deserializer: D) -> Result<Option<T>, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    T::deserialize(deserializer).map(Some)
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

            fn try_from(value: String) -> ContractResult<Self> {
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
                #[derive(Clone, Deserialize)]
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
                #[derive(Deserialize)]
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

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(try_from = "String", into = "String")]
pub struct Square(u8);

impl Square {
    pub fn parse(value: &str) -> ContractResult<Self> {
        let bytes = value.as_bytes();
        if bytes.len() != 2
            || !(b'a'..=b'h').contains(&bytes[0])
            || !(b'1'..=b'8').contains(&bytes[1])
        {
            return Err("Square must match [a-h][1-8]".into());
        }
        Ok(Self((bytes[0] - b'a') * 8 + bytes[1] - b'1'))
    }

    pub const fn index(self) -> usize {
        self.0 as usize
    }

    pub const fn file(self) -> u8 {
        self.0 / 8 + 1
    }

    pub const fn rank(self) -> u8 {
        self.0 % 8 + 1
    }
}

impl TryFrom<String> for Square {
    type Error = String;

    fn try_from(value: String) -> ContractResult<Self> {
        Self::parse(&value)
    }
}

impl From<Square> for String {
    fn from(value: Square) -> Self {
        format!("{}{}", char::from(b'a' + value.0 / 8), value.rank())
    }
}

pub fn all_squares() -> [Square; 64] {
    std::array::from_fn(|index| Square(index as u8))
}

string_enum! {
    pub enum Side { White => "w", Black => "b" }
}

impl Side {
    pub const fn other(self) -> Self {
        match self {
            Self::White => Self::Black,
            Self::Black => Self::White,
        }
    }
}

string_enum! {
    pub enum PieceKind {
        Pawn => "p", Knight => "n", Bishop => "b", Rook => "r", Queen => "q", King => "k",
    }
}

string_enum! {
    pub enum SpawnPiece { Pawn => "p", Knight => "n", Bishop => "b", Rook => "r", Queen => "q" }
}

string_enum! {
    pub enum Promotion { Knight => "n", Bishop => "b", Rook => "r", Queen => "q" }
}

string_enum! {
    pub enum ClassicalTiming { C => "C" }
}

string_enum! {
    pub enum SpecialTiming { B => "B", F => "F" }
}

string_enum! {
    pub enum ActionKind {
        Classical => "classical",
        Deploy => "deploy",
        StimStep => "stimStep",
        SpiderMine => "spiderMine",
        CharonMissiles => "charonMissiles",
        SiegeMode => "siegeMode",
        TacticalJump => "tacticalJump",
    }
}

pub const ACTION_KINDS: [ActionKind; 7] = [
    ActionKind::Classical,
    ActionKind::Deploy,
    ActionKind::StimStep,
    ActionKind::SpiderMine,
    ActionKind::CharonMissiles,
    ActionKind::SiegeMode,
    ActionKind::TacticalJump,
];

object_enum! {
    #[serde(tag = "kind", rename_all = "camelCase", deny_unknown_fields)]
    pub enum Action {
        Classical {
            timing: ClassicalTiming,
            color: Side,
            from: Square,
            to: Square,
            #[serde(
                default,
                skip_serializing_if = "Option::is_none",
                deserialize_with = "optional_non_null"
            )]
            promotion: Option<Promotion>,
        },
        Deploy {
            timing: SpecialTiming,
            color: Side,
            from: Square,
            to: Square,
            unit: SpawnPiece,
        },
        StimStep {
            timing: SpecialTiming,
            color: Side,
            from: Square,
            to: Square,
            #[serde(
                default,
                skip_serializing_if = "Option::is_none",
                deserialize_with = "optional_non_null"
            )]
            promotion: Option<Promotion>,
        },
        SpiderMine {
            timing: SpecialTiming,
            color: Side,
            from: Square,
        },
        CharonMissiles {
            timing: SpecialTiming,
            color: Side,
            from: Square,
            to: Square,
        },
        SiegeMode {
            timing: SpecialTiming,
            color: Side,
            from: Square,
        },
        TacticalJump {
            timing: SpecialTiming,
            color: Side,
            from: Square,
            to: Square,
        },
    }
}

impl Action {
    pub const fn kind(&self) -> ActionKind {
        match self {
            Self::Classical { .. } => ActionKind::Classical,
            Self::Deploy { .. } => ActionKind::Deploy,
            Self::StimStep { .. } => ActionKind::StimStep,
            Self::SpiderMine { .. } => ActionKind::SpiderMine,
            Self::CharonMissiles { .. } => ActionKind::CharonMissiles,
            Self::SiegeMode { .. } => ActionKind::SiegeMode,
            Self::TacticalJump { .. } => ActionKind::TacticalJump,
        }
    }

    pub const fn side(&self) -> Side {
        match self {
            Self::Classical { color, .. }
            | Self::Deploy { color, .. }
            | Self::StimStep { color, .. }
            | Self::SpiderMine { color, .. }
            | Self::CharonMissiles { color, .. }
            | Self::SiegeMode { color, .. }
            | Self::TacticalJump { color, .. } => *color,
        }
    }

    pub const fn from(&self) -> Square {
        match self {
            Self::Classical { from, .. }
            | Self::Deploy { from, .. }
            | Self::StimStep { from, .. }
            | Self::SpiderMine { from, .. }
            | Self::CharonMissiles { from, .. }
            | Self::SiegeMode { from, .. }
            | Self::TacticalJump { from, .. } => *from,
        }
    }

    pub const fn is_classical(&self) -> bool {
        matches!(self, Self::Classical { .. })
    }

    pub fn validate_for(&self, side: Side) -> ContractResult<()> {
        if self.side() != side {
            return Err("Action color does not match the authorized side".into());
        }
        Ok(())
    }

    fn canonical_fields(&self) -> BTreeMap<&'static str, String> {
        let timing = match self {
            Self::Classical { timing, .. } => timing.as_str(),
            Self::Deploy { timing, .. }
            | Self::StimStep { timing, .. }
            | Self::SpiderMine { timing, .. }
            | Self::CharonMissiles { timing, .. }
            | Self::SiegeMode { timing, .. }
            | Self::TacticalJump { timing, .. } => timing.as_str(),
        };
        let mut fields = BTreeMap::from([
            ("kind", self.kind().as_str().to_owned()),
            ("timing", timing.to_owned()),
            ("color", self.side().as_str().to_owned()),
            ("from", String::from(self.from())),
        ]);
        match self {
            Self::Classical { to, promotion, .. } | Self::StimStep { to, promotion, .. } => {
                fields.insert("to", String::from(*to));
                if let Some(promotion) = promotion {
                    fields.insert("promotion", promotion.as_str().to_owned());
                }
            }
            Self::Deploy { to, unit, .. } => {
                fields.insert("to", String::from(*to));
                fields.insert("unit", unit.as_str().to_owned());
            }
            Self::CharonMissiles { to, .. } | Self::TacticalJump { to, .. } => {
                fields.insert("to", String::from(*to));
            }
            Self::SpiderMine { .. } | Self::SiegeMode { .. } => {}
        }
        fields
    }

    pub fn canonical_key(&self) -> String {
        serde_json::to_string(&self.canonical_fields()).expect("String map serialization succeeds")
    }
}

pub fn canonical_actions_key(actions: &[Action]) -> String {
    let fields: Vec<_> = actions.iter().map(Action::canonical_fields).collect();
    serde_json::to_string(&fields).expect("String map array serialization succeeds")
}

object_struct! {
    #[serde(deny_unknown_fields)]
    pub struct ObservedPiece {
        pub color: Side,
        #[serde(rename = "type")]
        pub kind: PieceKind,
    }
}

object_enum! {
    #[serde(tag = "visibility", rename_all = "lowercase", deny_unknown_fields)]
    pub enum ObservedCell {
        Unknown {
            square: Square,
        },
        Lit {
            square: Square,
            #[serde(deserialize_with = "required_nullable")]
            piece: Option<ObservedPiece>,
        },
        Revealed {
            square: Square,
            piece: ObservedPiece,
        },
    }
}

impl ObservedCell {
    pub const fn square(&self) -> Square {
        match self {
            Self::Unknown { square } | Self::Lit { square, .. } | Self::Revealed { square, .. } => {
                *square
            }
        }
    }
}

object_struct! {
    #[serde(deny_unknown_fields)]
    pub struct OwnPiece {
        pub square: Square,
        #[serde(rename = "type")]
        pub kind: PieceKind,
    }
}

object_struct! {
    #[serde(rename_all = "camelCase", deny_unknown_fields)]
    pub struct OwnInventory {
        pub minerals: u32,
        pub gas: u32,
        pub gas_income: u32,
        pub cc_lives: u32,
        pub pieces: Vec<OwnPiece>,
        pub mines: Vec<Square>,
        pub sieged_tanks: Vec<Square>,
    }
}

string_enum! {
    pub enum ViewVersion { V2 => "arena-observation-v2" }
}

object_struct! {
    #[serde(deny_unknown_fields)]
    pub struct AuthorizedView {
        pub version: ViewVersion,
        pub side: Side,
        pub turn: u32,
        pub own: OwnInventory,
        pub cells: Vec<ObservedCell>,
    }
}

impl AuthorizedView {
    pub fn validate(&self) -> ContractResult<()> {
        if self.turn > 45
            || self.own.minerals > 12
            || self.own.cc_lives > 3
            || self.own.gas > self.own.gas_income
            || self.own.gas_income > 3
        {
            return Err("Authorized view resource or turn bound exceeded".into());
        }
        if self.cells.len() != 64
            || self
                .cells
                .iter()
                .enumerate()
                .any(|(index, cell)| cell.square().index() != index)
        {
            return Err("Authorized view requires 64 canonical file-major cells".into());
        }
        if self
            .own
            .pieces
            .windows(2)
            .any(|pair| pair[0].square >= pair[1].square)
        {
            return Err("Own pieces must be uniquely sorted".into());
        }
        let mut visible_own = Vec::new();
        for cell in &self.cells {
            match cell {
                ObservedCell::Lit {
                    square,
                    piece: Some(piece),
                } if piece.color == self.side => visible_own.push(OwnPiece {
                    square: *square,
                    kind: piece.kind,
                }),
                ObservedCell::Revealed { piece, .. } if piece.color == self.side => {
                    return Err("Own pieces must occupy lit cells".into());
                }
                _ => {}
            }
        }
        if visible_own != self.own.pieces {
            return Err("Own inventory disagrees with visible own pieces".into());
        }
        if self.own.mines.len() > MAX_MINES_PER_SIDE
            || self.own.mines.windows(2).any(|pair| pair[0] > pair[1])
        {
            return Err("Own mine multiset must be sorted with at most three entries".into());
        }
        if self
            .own
            .sieged_tanks
            .windows(2)
            .any(|pair| pair[0] >= pair[1])
            || self.own.sieged_tanks.iter().any(|square| {
                !self
                    .own
                    .pieces
                    .iter()
                    .any(|piece| piece.square == *square && piece.kind == PieceKind::Rook)
            })
        {
            return Err("Sieged tanks must identify uniquely sorted own rooks".into());
        }
        Ok(())
    }
}

object_struct! {
    #[derive(Copy, Default)]
    #[serde(deny_unknown_fields)]
    pub struct Spend {
        pub minerals: u32,
        pub gas: u32,
    }
}

string_enum! {
    pub enum CandidateVersion { V1 => "arena-candidate-v1" }
}

object_struct! {
    #[serde(deny_unknown_fields)]
    pub struct Candidate {
        pub version: CandidateVersion,
        pub key: String,
        pub actions: Vec<Action>,
        #[serde(rename = "ownSpend")]
        pub own_spend: Spend,
    }
}

impl Candidate {
    pub fn new(actions: Vec<Action>, own_spend: Spend, side: Side) -> ContractResult<Self> {
        let candidate = Self {
            version: CandidateVersion::V1,
            key: canonical_actions_key(&actions),
            actions,
            own_spend,
        };
        candidate.validate(side)?;
        Ok(candidate)
    }

    pub fn validate(&self, side: Side) -> ContractResult<()> {
        if self.actions.len() > MAX_GENERATED_ACTIONS {
            return Err("Generated candidate exceeds four actions".into());
        }
        for action in &self.actions {
            action.validate_for(side)?;
        }
        if self.key != canonical_actions_key(&self.actions) {
            return Err("Candidate key does not match its complete ordered action array".into());
        }
        if self.actions.is_empty() && self.own_spend != Spend::default() {
            return Err("Pass must have zero own spend".into());
        }
        Ok(())
    }
}

string_enum! {
    pub enum KnownAppendFailure {
        Actor => "actor", Shape => "shape", Timing => "timing",
        MineCap => "mineCap", OwnOccupancy => "ownOccupancy",
    }
}

object_struct! {
    #[serde(deny_unknown_fields)]
    pub struct PrimitiveProposal {
        pub action: Action,
        #[serde(rename = "nativeFailure", deserialize_with = "required_nullable")]
        pub native_failure: Option<KnownAppendFailure>,
        #[serde(deserialize_with = "required_nullable")]
        pub anchor: Option<Square>,
        pub cost: Spend,
    }
}

pub type PlanningId = u32;
pub type CursorId = u32;

object_enum! {
    #[serde(tag = "kind", rename_all = "lowercase", deny_unknown_fields)]
    pub enum CursorPull {
        Start {
            prefix: Vec<Action>,
            #[serde(deserialize_with = "required_nullable")]
            family: Option<ActionKind>,
        },
        Resume {
            cursor: CursorId,
        },
    }
}

object_struct! {
    #[serde(deny_unknown_fields)]
    pub struct DomainStep {
        pub cursor: CursorId,
        #[serde(deserialize_with = "required_nullable")]
        pub proposal: Option<PrimitiveProposal>,
    }
}

pub trait PlanningOracle {
    fn open(&mut self, view: &AuthorizedView) -> ContractResult<PlanningId>;
    fn next(
        &mut self,
        planning: PlanningId,
        pulls: &[CursorPull],
    ) -> ContractResult<Vec<DomainStep>>;
    fn close(&mut self, planning: PlanningId) -> ContractResult<()>;
}

string_enum! {
    pub enum CompositionVersion { V1 => "arena-composition-v1" }
}

string_enum! {
    pub enum QuotaProfile { B => "B" }
}

string_enum! {
    pub enum CandidateLane {
        Classical => "classical",
        Deploy => "deploy",
        StimStep => "stimStep",
        SpiderMine => "spiderMine",
        CharonMissiles => "charonMissiles",
        SiegeMode => "siegeMode",
        TacticalJump => "tacticalJump",
        SharedComposition => "shared-composition",
    }
}

impl CandidateLane {
    pub const fn kind(self) -> Option<ActionKind> {
        match self {
            Self::Classical => Some(ActionKind::Classical),
            Self::Deploy => Some(ActionKind::Deploy),
            Self::StimStep => Some(ActionKind::StimStep),
            Self::SpiderMine => Some(ActionKind::SpiderMine),
            Self::CharonMissiles => Some(ActionKind::CharonMissiles),
            Self::SiegeMode => Some(ActionKind::SiegeMode),
            Self::TacticalJump => Some(ActionKind::TacticalJump),
            Self::SharedComposition => None,
        }
    }

    pub const fn from_kind(kind: ActionKind) -> Self {
        match kind {
            ActionKind::Classical => Self::Classical,
            ActionKind::Deploy => Self::Deploy,
            ActionKind::StimStep => Self::StimStep,
            ActionKind::SpiderMine => Self::SpiderMine,
            ActionKind::CharonMissiles => Self::CharonMissiles,
            ActionKind::SiegeMode => Self::SiegeMode,
            ActionKind::TacticalJump => Self::TacticalJump,
        }
    }
}

object_struct! {
    #[serde(rename_all = "camelCase", deny_unknown_fields)]
    pub struct CandidatePool {
        pub id: CandidateLane,
        pub initial_capacity: u32,
        pub final_capacity: u32,
        pub retained: u32,
        pub exhausted: bool,
    }
}

string_enum! {
    pub enum PruningReason {
        Actor => "actor", Shape => "shape", Timing => "timing", Resources => "resources",
        MineCap => "mineCap", OwnOccupancy => "ownOccupancy",
    }
}

string_enum! {
    pub enum StopReason {
        Exhausted => "exhausted", AttemptCap => "attempt-cap", CapacityCap => "capacity-cap",
    }
}

object_struct! {
    #[serde(rename_all = "camelCase", deny_unknown_fields)]
    pub struct CandidateDiagnostics {
        pub profile: QuotaProfile,
        pub attempted_extensions: u32,
        pub unique_including_pass: u32,
        pub retained_non_pass: u32,
        pub duplicates: u32,
        pub owner_skipped: u32,
        pub quota_skipped: u32,
        pub pruned: BTreeMap<PruningReason, u32>,
        pub active_families: Vec<ActionKind>,
        pub exhausted_lanes: Vec<CandidateLane>,
        pub pools: Vec<CandidatePool>,
        pub retained_by_owner: BTreeMap<ActionKind, u32>,
        pub retained_by_length: BTreeMap<String, u32>,
        pub attempt_cap_reached: bool,
        pub capacity_cap_reached: bool,
        pub stop_reason: StopReason,
    }
}

object_struct! {
    #[serde(deny_unknown_fields)]
    pub struct CandidateBatch {
        pub version: CompositionVersion,
        pub candidates: Vec<Candidate>,
        pub diagnostics: CandidateDiagnostics,
    }
}

impl CandidateBatch {
    pub fn validate(&self, side: Side) -> ContractResult<()> {
        if self.candidates.is_empty() || self.candidates.len() > MAX_RETAINED_CANDIDATES {
            return Err("Candidate batch requires 1..512 candidates including pass".into());
        }
        for candidate in &self.candidates {
            candidate.validate(side)?;
        }
        if !self.candidates[0].actions.is_empty()
            || self
                .candidates
                .windows(2)
                .any(|pair| pair[0].key.as_bytes() >= pair[1].key.as_bytes())
        {
            return Err("Candidate batch requires pass and uniquely byte-sorted keys".into());
        }
        let diagnostics = &self.diagnostics;
        if diagnostics.attempted_extensions > MAX_ATTEMPTED_EXTENSIONS as u32
            || diagnostics.unique_including_pass != self.candidates.len() as u32
            || diagnostics.retained_non_pass != (self.candidates.len() - 1) as u32
        {
            return Err("Candidate diagnostic bounds disagree with the batch".into());
        }
        let accounted = u64::from(diagnostics.retained_non_pass)
            + u64::from(diagnostics.duplicates)
            + u64::from(diagnostics.owner_skipped)
            + u64::from(diagnostics.quota_skipped)
            + diagnostics
                .pruned
                .values()
                .map(|value| u64::from(*value))
                .sum::<u64>();
        if accounted != u64::from(diagnostics.attempted_extensions) {
            return Err("Candidate attempt accounting does not balance".into());
        }
        let pruning_reasons = [
            PruningReason::Actor,
            PruningReason::Shape,
            PruningReason::Timing,
            PruningReason::Resources,
            PruningReason::MineCap,
            PruningReason::OwnOccupancy,
        ];
        if diagnostics.pruned.len() != pruning_reasons.len()
            || pruning_reasons
                .iter()
                .any(|reason| !diagnostics.pruned.contains_key(reason))
            || diagnostics.retained_by_owner.len() != ACTION_KINDS.len()
            || ACTION_KINDS
                .iter()
                .any(|kind| !diagnostics.retained_by_owner.contains_key(kind))
            || diagnostics.retained_by_length.len() != MAX_GENERATED_ACTIONS
            || (1..=MAX_GENERATED_ACTIONS).any(|length| {
                !diagnostics
                    .retained_by_length
                    .contains_key(&length.to_string())
            })
        {
            return Err("Candidate diagnostics require complete closed count maps".into());
        }
        let mut by_owner = BTreeMap::from(ACTION_KINDS.map(|kind| (kind, 0)));
        let mut by_length: BTreeMap<_, u32> = (1..=MAX_GENERATED_ACTIONS)
            .map(|length| (length.to_string(), 0))
            .collect();
        for candidate in &self.candidates[1..] {
            *by_owner
                .get_mut(&candidate.actions[0].kind())
                .expect("Known action kind") += 1;
            *by_length
                .get_mut(&candidate.actions.len().to_string())
                .expect("Bounded action length") += 1;
        }
        if by_owner != diagnostics.retained_by_owner || by_length != diagnostics.retained_by_length
        {
            return Err("Candidate retained count maps disagree with the batch".into());
        }
        let lanes: Vec<_> = ACTION_KINDS
            .into_iter()
            .map(CandidateLane::from_kind)
            .chain([CandidateLane::SharedComposition])
            .collect();
        if diagnostics.pools.len() != lanes.len()
            || diagnostics.pools.iter().zip(&lanes).any(|(pool, lane)| {
                pool.id != *lane
                    || pool.initial_capacity >= MAX_RETAINED_CANDIDATES as u32
                    || pool.final_capacity >= MAX_RETAINED_CANDIDATES as u32
                    || pool.retained > pool.final_capacity
            })
            || diagnostics
                .pools
                .iter()
                .map(|pool| u64::from(pool.initial_capacity))
                .sum::<u64>()
                != (MAX_RETAINED_CANDIDATES - 1) as u64
            || diagnostics
                .pools
                .iter()
                .map(|pool| u64::from(pool.final_capacity))
                .sum::<u64>()
                != (MAX_RETAINED_CANDIDATES - 1) as u64
            || diagnostics
                .pools
                .iter()
                .map(|pool| u64::from(pool.retained))
                .sum::<u64>()
                != u64::from(diagnostics.retained_non_pass)
        {
            return Err("Candidate pool bounds or funding do not balance".into());
        }
        if diagnostics
            .active_families
            .windows(2)
            .any(|pair| pair[0] >= pair[1])
            || diagnostics.exhausted_lanes
                != diagnostics
                    .pools
                    .iter()
                    .filter(|pool| pool.exhausted)
                    .map(|pool| pool.id)
                    .collect::<Vec<_>>()
        {
            return Err("Candidate family or exhaustion ordering is invalid".into());
        }
        let attempt_cap = diagnostics.attempted_extensions == MAX_ATTEMPTED_EXTENSIONS as u32;
        let capacity_cap = self.candidates.len() == MAX_RETAINED_CANDIDATES;
        let stop_reason = if capacity_cap {
            StopReason::CapacityCap
        } else if attempt_cap {
            StopReason::AttemptCap
        } else {
            StopReason::Exhausted
        };
        if diagnostics.attempt_cap_reached != attempt_cap
            || diagnostics.capacity_cap_reached != capacity_cap
            || diagnostics.stop_reason != stop_reason
            || (stop_reason == StopReason::Exhausted && diagnostics.exhausted_lanes != lanes)
        {
            return Err("Candidate stop reason or cap flags are inconsistent".into());
        }
        Ok(())
    }
}
