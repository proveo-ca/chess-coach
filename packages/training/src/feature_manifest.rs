// SPEC: _spec/packages/training/burn-compat.puml
use serde::Serialize;

use crate::ledger::LedgerWork;
use crate::ledger::contracts::{ContractResult, LedgerError, LedgerErrorCode};

pub const FEATURE_MANIFEST_VERSION: &str = "challenge-feature-manifest-v3";
pub const HISTORICAL_DIMENSION: usize = 370;
pub const FEATURE_DIMENSION: usize = 418;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct FeatureDescriptor {
    pub index: usize,
    pub name: &'static str,
    pub meaning_id: &'static str,
    pub scale_id: &'static str,
}

macro_rules! descriptor {
    ($index:expr, $name:expr, $meaning:expr, $scale:expr) => {
        FeatureDescriptor {
            index: $index,
            name: $name,
            meaning_id: $meaning,
            scale_id: $scale,
        }
    };
}

macro_rules! registry {
    (queue { $($q:literal: $qn:literal => $qs:literal),* $(,)? }
     position { $($p:literal: $pn:literal => $ps:literal),* $(,)? }
     economic { $($e:literal: $en:literal => $es:literal),* $(,)? }
     promotion { $($k:literal: $kn:literal),* $(,)? }) => {
        static REGISTRY: [FeatureDescriptor; FEATURE_DIMENSION] = [
            $(descriptor!($q, concat!("queue.", $qn), concat!("q:", stringify!($q)), $qs),)*
            $(descriptor!(34 + $p, concat!("position.0.", $pn), concat!("p:", stringify!($p)), $ps),)*
            $(descriptor!(118 + $p, concat!("position.1.", $pn), concat!("p:", stringify!($p)), $ps),)*
            $(descriptor!(202 + $p, concat!("position.2.", $pn), concat!("p:", stringify!($p)), $ps),)*
            $(descriptor!(286 + $p, concat!("position.3.", $pn), concat!("p:", stringify!($p)), $ps),)*
            $(descriptor!(370 + $e, concat!("economic.", $en), concat!("e:", stringify!($e)), $es),)*
            $(
                descriptor!(382 + 6 * $k, concat!("promotion.", $kn, ".witnessed.h1"), concat!("promo:", stringify!($k), ":0:1"), "files"),
                descriptor!(383 + 6 * $k, concat!("promotion.", $kn, ".witnessed.h2"), concat!("promo:", stringify!($k), ":0:2"), "files"),
                descriptor!(384 + 6 * $k, concat!("promotion.", $kn, ".witnessed.h3"), concat!("promo:", stringify!($k), ":0:3"), "files"),
                descriptor!(385 + 6 * $k, concat!("promotion.", $kn, ".unlocated.h1"), concat!("promo:", stringify!($k), ":1:1"), "files"),
                descriptor!(386 + 6 * $k, concat!("promotion.", $kn, ".unlocated.h2"), concat!("promo:", stringify!($k), ":1:2"), "files"),
                descriptor!(387 + 6 * $k, concat!("promotion.", $kn, ".unlocated.h3"), concat!("promo:", stringify!($k), ":1:3"), "files"),
            )*
        ];
    };
}

registry! {
    queue {
        0: "pass" => "unit",
        1: "actionCount" => "actions",
        2: "requestedMinerals" => "minerals",
        3: "requestedGas" => "gas",
        4: "timing.BCount" => "actions",
        5: "timing.CCount" => "actions",
        6: "timing.FCount" => "actions",
        7: "mineralMargin" => "minerals",
        8: "gasMargin" => "gas",
        9: "nominal.deployCrushOwnPaid" => "paid",
        10: "nominal.deployCrushOwnReplacement" => "replacement",
        11: "nominal.newlyLit" => "squares",
        12: "nominal.ccExposureKnown" => "squares",
        13: "nominal.ccExposurePossible" => "squares",
        14: "nominal.ccProtection" => "unit",
        15: "pair.sameActor" => "pairs",
        16: "pair.BC" => "pairs",
        17: "pair.CF" => "pairs",
        18: "pair.mineRelocate" => "pairs",
        19: "pair.deployMove" => "pairs",
        20: "pair.timingInversions" => "pairs",
        21: "nominal.visionOverlap" => "visionOverlap",
        22: "ix.spendOwnPaidLoss" => "meanCosts*paid",
        23: "ix.tradeEnemyPaidBound" => "relationPairs*paid",
        24: "ix.tradeEnemyReplacementBound" => "relationPairs*replacement",
        25: "ix.noveltyUnknown" => "squares*squares",
        26: "ix.ccExposureVulnerability" => "squares*ccComplement",
        27: "ix.mineRelocateUnknown" => "pairs*squares",
        28: "ix.spendTurn" => "meanCosts*turn",
        29: "ix.passVulnerability" => "ccComplement",
        30: "ix.deployGasIncome" => "actions*gas",
        31: "ix.pressureLossUncertainty" => "relationPairs",
        32: "ix.spendOwnPaidWaste" => "meanCosts*paid",
        33: "ix.deployOwnPaidWaste" => "actions*paid",
    }
    position {
        0: "present" => "unit",
        1: "kind.classical" => "unit",
        2: "kind.deploy" => "unit",
        3: "kind.stimStep" => "unit",
        4: "kind.spiderMine" => "unit",
        5: "kind.charonMissiles" => "unit",
        6: "kind.siegeMode" => "unit",
        7: "kind.tacticalJump" => "unit",
        8: "timing.B" => "unit",
        9: "timing.C" => "unit",
        10: "timing.F" => "unit",
        11: "from.file" => "coords",
        12: "from.rank" => "coords",
        13: "to.present" => "unit",
        14: "to.file" => "coords",
        15: "to.rank" => "coords",
        16: "deployUnit.none" => "unit",
        17: "deployUnit.p" => "unit",
        18: "deployUnit.n" => "unit",
        19: "deployUnit.b" => "unit",
        20: "deployUnit.r" => "unit",
        21: "deployUnit.q" => "unit",
        22: "promotion.none" => "unit",
        23: "promotion.p" => "unit",
        24: "promotion.n" => "unit",
        25: "promotion.b" => "unit",
        26: "promotion.r" => "unit",
        27: "promotion.q" => "unit",
        28: "actor.known" => "unit",
        29: "actor.absent" => "unit",
        30: "actor.nominal" => "unit",
        31: "actor.paidKnown" => "unit",
        32: "actor.type.p" => "unit",
        33: "actor.type.n" => "unit",
        34: "actor.type.b" => "unit",
        35: "actor.type.r" => "unit",
        36: "actor.type.q" => "unit",
        37: "actor.type.k" => "unit",
        38: "actor.tankMode.known" => "unit",
        39: "actor.tankMode.sieged" => "unit",
        40: "target.absent" => "unit",
        41: "target.unknown" => "unit",
        42: "target.knownEmpty" => "unit",
        43: "target.own" => "unit",
        44: "target.enemy" => "unit",
        45: "target.type.p" => "unit",
        46: "target.type.n" => "unit",
        47: "target.type.b" => "unit",
        48: "target.type.r" => "unit",
        49: "target.type.q" => "unit",
        50: "target.type.k" => "unit",
        51: "target.memory.present" => "unit",
        52: "target.memory.age" => "turn",
        53: "cost.minerals" => "minerals",
        54: "cost.gas" => "gas",
        55: "actor.paid" => "minerals",
        56: "actor.replacement" => "minerals",
        57: "ray.applicable" => "unit",
        58: "ray.open" => "unit",
        59: "ray.blocked" => "unit",
        60: "ray.uncertain" => "unit",
        61: "path.knownEmpty" => "squares",
        62: "path.knownOccupied" => "squares",
        63: "path.unknown" => "squares",
        64: "nominal.newlyLit" => "squares",
        65: "nominal.staleApproach" => "coords",
        66: "exposure.known" => "squares",
        67: "exposure.possible" => "squares",
        68: "pressure.units" => "squares",
        69: "pressure.cc" => "unit",
        70: "protection.units" => "squares",
        71: "protection.cc" => "unit",
        72: "ix.spendLiquidity" => "minerals*minerals",
        73: "ix.gasAvailability" => "gas*gas",
        74: "ix.deployMargin" => "minerals",
        75: "ix.exposurePaidKnown" => "squares*minerals",
        76: "ix.exposurePaidPossible" => "squares*minerals",
        77: "ix.exposureReplacement" => "squares*minerals",
        78: "ix.tradeEnemyLoss" => "squares*replacement",
        79: "ix.ccPressureRisk" => "ccComplement",
        80: "ix.noveltyReveal" => "squares",
        81: "ix.uncertainRayDistance" => "coords",
        82: "ix.staleApproachAge" => "coords*turn",
        83: "ix.protectionPaidLoss" => "squares*paid",
    }
    economic {
        0: "ix.spendBalance" => "meanCosts*unit",
        1: "ix.spendUncertainty" => "meanCosts*unit",
        2: "ix.deployBalance" => "minerals*unit",
        3: "ix.deployUncertainty" => "minerals*unit",
        4: "ix.tradeBalance" => "minerals*unit",
        5: "ix.tradeUncertainty" => "minerals*unit",
        6: "ix.protectionBalance" => "minerals*unit",
        7: "ix.protectionUncertainty" => "minerals*unit",
        8: "spend" => "meanCosts",
        9: "deploy" => "minerals",
        10: "trade" => "minerals",
        11: "protection" => "minerals",
    }
    promotion {
        0: "exposure",
        1: "blockerAdded",
        2: "blockerRemoved",
        3: "attackCoverAdded",
        4: "attackCoverRemoved",
        5: "visionAdded",
    }
}

pub fn feature_registry_v3() -> &'static [FeatureDescriptor; FEATURE_DIMENSION] {
    &REGISTRY
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestEntry {
    pub name: String,
    pub meaning_id: String,
    pub scale_id: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FeatureScales {
    pub minerals: u32,
    pub gas: u32,
    pub turn: u32,
    pub cc_lives: u32,
    pub max_spawn: u32,
    pub paid: u32,
    pub replacement: u32,
    pub coords: u32,
    pub squares: u32,
    pub actions: u32,
    pub pairs: u32,
    pub relation_pairs: u32,
    pub vision_overlap: u32,
    pub files: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FeatureManifestV3 {
    pub version: String,
    pub dimension: usize,
    pub names: Vec<String>,
    pub entries: Vec<ManifestEntry>,
    pub scales: FeatureScales,
}

const SCALES: FeatureScales = FeatureScales {
    minerals: 12,
    gas: 3,
    turn: 45,
    cc_lives: 3,
    max_spawn: 9,
    paid: 3072,
    replacement: 2304,
    coords: 7,
    squares: 64,
    actions: 4,
    pairs: 6,
    relation_pairs: 4096,
    vision_overlap: 256,
    files: 8,
};

const fn invoice_add(left: u64, right: u64) -> u64 {
    left.checked_add(right).expect("Manifest invoice overflow")
}

const fn invoice_mul(left: u64, right: u64) -> u64 {
    left.checked_mul(right).expect("Manifest invoice overflow")
}

const fn descriptor_bytes(value: &FeatureDescriptor) -> u64 {
    invoice_add(
        invoice_mul(2, value.name.len() as u64),
        invoice_add(value.meaning_id.len() as u64, value.scale_id.len() as u64),
    )
}

const fn registry_bytes() -> u64 {
    let mut bytes = FEATURE_MANIFEST_VERSION.len() as u64;
    let mut index = 0;
    while index < FEATURE_DIMENSION {
        bytes = invoice_add(bytes, descriptor_bytes(&REGISTRY[index]));
        index += 1;
    }
    bytes
}

const fn lane_comparison_work() -> [u64; FEATURE_DIMENSION] {
    let mut work = [0; FEATURE_DIMENSION];
    let mut index = 0;
    while index < FEATURE_DIMENSION {
        work[index] = invoice_mul(2, descriptor_bytes(&REGISTRY[index]));
        index += 1;
    }
    work
}

const REGISTRY_BYTES: u64 = registry_bytes();
const BUILD_WORK: u64 = invoice_add(
    invoice_add(128, invoice_mul(192, 1675)),
    invoice_add(
        invoice_mul(32, 5 + 14 + 418 + 418),
        invoice_mul(4, REGISTRY_BYTES),
    ),
);
const VERSION_COMPARISON_WORK: u64 = invoice_mul(2, FEATURE_MANIFEST_VERSION.len() as u64);
static LANE_COMPARISON_WORK: [u64; FEATURE_DIMENSION] = lane_comparison_work();

pub fn feature_manifest_v3(work: &mut LedgerWork) -> ContractResult<FeatureManifestV3> {
    work.charge(BUILD_WORK)?;
    let version = FEATURE_MANIFEST_VERSION.to_owned();
    let mut names = Vec::with_capacity(FEATURE_DIMENSION);
    let mut entries = Vec::with_capacity(FEATURE_DIMENSION);
    for descriptor in &REGISTRY {
        names.push(descriptor.name.to_owned());
        entries.push(ManifestEntry {
            name: descriptor.name.to_owned(),
            meaning_id: descriptor.meaning_id.to_owned(),
            scale_id: descriptor.scale_id.to_owned(),
        });
    }
    Ok(FeatureManifestV3 {
        version,
        dimension: FEATURE_DIMENSION,
        names,
        entries,
        scales: SCALES,
    })
}

pub fn validate_manifest_v3(
    value: &FeatureManifestV3,
    work: &mut LedgerWork,
) -> ContractResult<()> {
    work.charge(288)?;
    if value.dimension != FEATURE_DIMENSION {
        return Err(LedgerError::new(
            LedgerErrorCode::Unsupported,
            "Unsupported manifest dimension",
        ));
    }
    if value.names.len() != FEATURE_DIMENSION || value.entries.len() != FEATURE_DIMENSION {
        return Err(LedgerError::new(
            LedgerErrorCode::Identity,
            "Manifest coordinate counts differ",
        ));
    }
    if value.version.len() != FEATURE_MANIFEST_VERSION.len() {
        return Err(LedgerError::new(
            LedgerErrorCode::Unsupported,
            "Unsupported manifest version",
        ));
    }
    work.charge(VERSION_COMPARISON_WORK)?;
    if value.version != FEATURE_MANIFEST_VERSION {
        return Err(LedgerError::new(
            LedgerErrorCode::Unsupported,
            "Unsupported manifest version",
        ));
    }
    work.charge(14 * 32)?;
    if value.scales != SCALES {
        return Err(LedgerError::new(
            LedgerErrorCode::Identity,
            "Manifest scales differ",
        ));
    }
    for (index, expected) in REGISTRY.iter().enumerate() {
        work.charge(160)?;
        let name = &value.names[index];
        let entry = &value.entries[index];
        if name.len() != expected.name.len()
            || entry.name.len() != expected.name.len()
            || entry.meaning_id.len() != expected.meaning_id.len()
            || entry.scale_id.len() != expected.scale_id.len()
        {
            return Err(LedgerError::new(
                LedgerErrorCode::Identity,
                "Manifest coordinate lengths differ",
            ));
        }
        work.charge(LANE_COMPARISON_WORK[index])?;
        if name != expected.name
            || entry.name != expected.name
            || entry.meaning_id != expected.meaning_id
            || entry.scale_id != expected.scale_id
        {
            return Err(LedgerError::new(
                LedgerErrorCode::Identity,
                "Manifest coordinates differ",
            ));
        }
    }
    Ok(())
}
