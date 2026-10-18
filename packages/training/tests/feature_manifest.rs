// SPEC: _spec/packages/training/burn-compat.puml
use std::alloc::{GlobalAlloc, Layout, System};
use std::cell::Cell;
use std::collections::BTreeSet;

use serde_json::{Value, json};
use training_native::feature_manifest::{
    FEATURE_DIMENSION, FEATURE_MANIFEST_VERSION, FeatureManifestV3, FeatureScales,
    HISTORICAL_DIMENSION, feature_manifest_v3, feature_registry_v3, validate_manifest_v3,
};
use training_native::ledger::contracts::LedgerErrorCode;
use training_native::ledger::{LEDGER_WORK_LIMIT, LedgerWork};

struct TestAllocator;

thread_local! {
    static ALLOCATIONS: Cell<Option<usize>> = const { Cell::new(None) };
}

fn record_allocation() {
    let _ = ALLOCATIONS.try_with(|count| {
        if let Some(value) = count.get() {
            count.set(Some(value + 1));
        }
    });
}

unsafe impl GlobalAlloc for TestAllocator {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        record_allocation();
        unsafe { System.alloc(layout) }
    }

    unsafe fn dealloc(&self, pointer: *mut u8, layout: Layout) {
        unsafe { System.dealloc(pointer, layout) }
    }

    unsafe fn realloc(&self, pointer: *mut u8, layout: Layout, size: usize) -> *mut u8 {
        record_allocation();
        unsafe { System.realloc(pointer, layout, size) }
    }
}

#[global_allocator]
static ALLOCATOR: TestAllocator = TestAllocator;

fn allocations<T>(operation: impl FnOnce() -> T) -> (T, usize) {
    struct Reset;
    impl Drop for Reset {
        fn drop(&mut self) {
            ALLOCATIONS.set(None);
        }
    }
    assert!(ALLOCATIONS.get().is_none());
    ALLOCATIONS.set(Some(0));
    let reset = Reset;
    let result = operation();
    let count = ALLOCATIONS.get().unwrap();
    drop(reset);
    (result, count)
}

#[derive(Debug)]
struct Expected {
    name: String,
    meaning: String,
    scale: &'static str,
}

fn queue_scale(index: usize) -> &'static str {
    match index {
        0 | 14 => "unit",
        1 | 4..=6 => "actions",
        2 | 7 => "minerals",
        3 | 8 => "gas",
        9 => "paid",
        10 => "replacement",
        11..=13 => "squares",
        15..=20 => "pairs",
        21 => "visionOverlap",
        22 | 32 => "meanCosts*paid",
        23 => "relationPairs*paid",
        24 => "relationPairs*replacement",
        25 => "squares*squares",
        26 => "squares*ccComplement",
        27 => "pairs*squares",
        28 => "meanCosts*turn",
        29 => "ccComplement",
        30 => "actions*gas",
        31 => "relationPairs",
        33 => "actions*paid",
        _ => panic!("queue index"),
    }
}

fn position_scale(index: usize) -> &'static str {
    match index {
        0..=10 | 13 | 16..=51 | 57..=60 | 69 | 71 => "unit",
        11 | 12 | 14 | 15 | 65 | 81 => "coords",
        52 => "turn",
        53 | 55 | 56 | 74 => "minerals",
        54 => "gas",
        61..=64 | 66..=68 | 70 | 80 => "squares",
        72 => "minerals*minerals",
        73 => "gas*gas",
        75..=77 => "squares*minerals",
        78 => "squares*replacement",
        79 => "ccComplement",
        82 => "coords*turn",
        83 => "squares*paid",
        _ => panic!("position index"),
    }
}

fn normative() -> Vec<Expected> {
    let queue = [
        "pass",
        "actionCount",
        "requestedMinerals",
        "requestedGas",
        "timing.BCount",
        "timing.CCount",
        "timing.FCount",
        "mineralMargin",
        "gasMargin",
        "nominal.deployCrushOwnPaid",
        "nominal.deployCrushOwnReplacement",
        "nominal.newlyLit",
        "nominal.ccExposureKnown",
        "nominal.ccExposurePossible",
        "nominal.ccProtection",
        "pair.sameActor",
        "pair.BC",
        "pair.CF",
        "pair.mineRelocate",
        "pair.deployMove",
        "pair.timingInversions",
        "nominal.visionOverlap",
        "ix.spendOwnPaidLoss",
        "ix.tradeEnemyPaidBound",
        "ix.tradeEnemyReplacementBound",
        "ix.noveltyUnknown",
        "ix.ccExposureVulnerability",
        "ix.mineRelocateUnknown",
        "ix.spendTurn",
        "ix.passVulnerability",
        "ix.deployGasIncome",
        "ix.pressureLossUncertainty",
        "ix.spendOwnPaidWaste",
        "ix.deployOwnPaidWaste",
    ];
    assert_eq!(queue.len(), 34);
    let mut position = vec!["present".to_owned()];
    for family in [
        "classical",
        "deploy",
        "stimStep",
        "spiderMine",
        "charonMissiles",
        "siegeMode",
        "tacticalJump",
    ] {
        position.push(format!("kind.{family}"));
    }
    for timing in ["B", "C", "F"] {
        position.push(format!("timing.{timing}"));
    }
    position
        .extend(["from.file", "from.rank", "to.present", "to.file", "to.rank"].map(str::to_owned));
    for group in ["deployUnit", "promotion"] {
        for spawn in ["none", "p", "n", "b", "r", "q"] {
            position.push(format!("{group}.{spawn}"));
        }
    }
    position.extend(
        [
            "actor.known",
            "actor.absent",
            "actor.nominal",
            "actor.paidKnown",
        ]
        .map(str::to_owned),
    );
    for piece in ["p", "n", "b", "r", "q", "k"] {
        position.push(format!("actor.type.{piece}"));
    }
    position.extend(
        [
            "actor.tankMode.known",
            "actor.tankMode.sieged",
            "target.absent",
            "target.unknown",
            "target.knownEmpty",
            "target.own",
            "target.enemy",
        ]
        .map(str::to_owned),
    );
    for piece in ["p", "n", "b", "r", "q", "k"] {
        position.push(format!("target.type.{piece}"));
    }
    position.extend(
        [
            "target.memory.present",
            "target.memory.age",
            "cost.minerals",
            "cost.gas",
            "actor.paid",
            "actor.replacement",
            "ray.applicable",
            "ray.open",
            "ray.blocked",
            "ray.uncertain",
            "path.knownEmpty",
            "path.knownOccupied",
            "path.unknown",
            "nominal.newlyLit",
            "nominal.staleApproach",
            "exposure.known",
            "exposure.possible",
            "pressure.units",
            "pressure.cc",
            "protection.units",
            "protection.cc",
            "ix.spendLiquidity",
            "ix.gasAvailability",
            "ix.deployMargin",
            "ix.exposurePaidKnown",
            "ix.exposurePaidPossible",
            "ix.exposureReplacement",
            "ix.tradeEnemyLoss",
            "ix.ccPressureRisk",
            "ix.noveltyReveal",
            "ix.uncertainRayDistance",
            "ix.staleApproachAge",
            "ix.protectionPaidLoss",
        ]
        .map(str::to_owned),
    );
    assert_eq!(position.len(), 84);
    let mut expected = Vec::new();
    for (j, name) in queue.iter().enumerate() {
        expected.push(Expected {
            name: format!("queue.{name}"),
            meaning: format!("q:{j}"),
            scale: queue_scale(j),
        });
    }
    for slot in 0..4 {
        for (k, name) in position.iter().enumerate() {
            expected.push(Expected {
                name: format!("position.{slot}.{name}"),
                meaning: format!("p:{k}"),
                scale: position_scale(k),
            });
        }
    }
    assert_eq!(expected.len(), 370);
    for (j, name) in [
        "ix.spendBalance",
        "ix.spendUncertainty",
        "ix.deployBalance",
        "ix.deployUncertainty",
        "ix.tradeBalance",
        "ix.tradeUncertainty",
        "ix.protectionBalance",
        "ix.protectionUncertainty",
        "spend",
        "deploy",
        "trade",
        "protection",
    ]
    .iter()
    .enumerate()
    {
        let scale = match j {
            0 | 1 => "meanCosts*unit",
            2..=7 => "minerals*unit",
            8 => "meanCosts",
            _ => "minerals",
        };
        expected.push(Expected {
            name: format!("economic.{name}"),
            meaning: format!("e:{j}"),
            scale,
        });
    }
    for (k, kernel) in [
        "exposure",
        "blockerAdded",
        "blockerRemoved",
        "attackCoverAdded",
        "attackCoverRemoved",
        "visionAdded",
    ]
    .iter()
    .enumerate()
    {
        for (c, channel) in ["witnessed", "unlocated"].iter().enumerate() {
            for horizon in 1..=3 {
                assert_eq!(expected.len(), 382 + 6 * k + 3 * c + horizon - 1);
                expected.push(Expected {
                    name: format!("promotion.{kernel}.{channel}.h{horizon}"),
                    meaning: format!("promo:{k}:{c}:{horizon}"),
                    scale: "files",
                });
            }
        }
    }
    assert_eq!(expected.len(), 418);
    expected
}

fn expected_scales() -> Value {
    json!({"minerals":12,"gas":3,"turn":45,"ccLives":3,"maxSpawn":9,"paid":3072,"replacement":2304,"coords":7,"squares":64,"actions":4,"pairs":6,"relationPairs":4096,"visionOverlap":256,"files":8})
}

fn expected_manifest(expected: &[Expected]) -> Value {
    json!({
        "version":"challenge-feature-manifest-v3", "dimension":418,
        "names":expected.iter().map(|entry| &entry.name).collect::<Vec<_>>(),
        "entries":expected.iter().map(|entry| json!({"name":entry.name,"meaningId":entry.meaning,"scaleId":entry.scale})).collect::<Vec<_>>(),
        "scales":expected_scales(),
    })
}

fn bytes(entry: &Expected) -> u64 {
    (2 * entry.name.len() + entry.meaning.len() + entry.scale.len()) as u64
}

fn invoices(expected: &[Expected]) -> (u64, u64, u64) {
    let s = "challenge-feature-manifest-v3".len() as u64 + expected.iter().map(bytes).sum::<u64>();
    (
        s,
        128 + 192 * (1673 + 2) + 32 * (5 + 14 + 418 + 418) + 4 * s,
        288 + 2 * 29 + 14 * 32 + 418 * 160 + 2 * (s - 29),
    )
}

fn through_lane(expected: &[Expected], index: usize, compare: bool) -> u64 {
    288 + 2 * "challenge-feature-manifest-v3".len() as u64
        + 14 * 32
        + expected[..index]
            .iter()
            .map(|entry| 160 + 2 * bytes(entry))
            .sum::<u64>()
        + 160
        + if compare {
            2 * bytes(&expected[index])
        } else {
            0
        }
}

fn field(manifest: &mut FeatureManifestV3, index: usize, which: usize) -> &mut String {
    match which {
        0 => &mut manifest.names[index],
        1 => &mut manifest.entries[index].name,
        2 => &mut manifest.entries[index].meaning_id,
        3 => &mut manifest.entries[index].scale_id,
        _ => unreachable!(),
    }
}

fn scale(scales: &mut FeatureScales, index: usize) -> &mut u32 {
    match index {
        0 => &mut scales.minerals,
        1 => &mut scales.gas,
        2 => &mut scales.turn,
        3 => &mut scales.cc_lives,
        4 => &mut scales.max_spawn,
        5 => &mut scales.paid,
        6 => &mut scales.replacement,
        7 => &mut scales.coords,
        8 => &mut scales.squares,
        9 => &mut scales.actions,
        10 => &mut scales.pairs,
        11 => &mut scales.relation_pairs,
        12 => &mut scales.vision_overlap,
        13 => &mut scales.files,
        _ => unreachable!(),
    }
}

#[test]
fn independent_normative_expansion_matches_complete_fixture_and_serialized_manifest() {
    let expected = expected_manifest(&normative());
    let fixture: Value =
        serde_json::from_str(include_str!("fixtures/feature-manifest-v3.json")).unwrap();
    assert_eq!(fixture, expected);
    let manifest = feature_manifest_v3(&mut LedgerWork::new()).unwrap();
    assert_eq!(serde_json::to_value(manifest).unwrap(), expected);
    assert_eq!(expected.as_object().unwrap().len(), 5);
    assert_eq!(expected["scales"].as_object().unwrap().len(), 14);
    for entry in expected["entries"].as_array().unwrap() {
        assert_eq!(entry.as_object().unwrap().len(), 3);
    }
}

#[test]
fn static_registry_is_allocation_free_and_preserves_every_ordered_coordinate() {
    let expected = normative();
    let ((first, second), count) = allocations(|| (feature_registry_v3(), feature_registry_v3()));
    assert_eq!(count, 0);
    assert!(std::ptr::eq(first, second));
    assert_eq!(FEATURE_MANIFEST_VERSION, "challenge-feature-manifest-v3");
    assert_eq!(FEATURE_DIMENSION, 418);
    assert_eq!(HISTORICAL_DIMENSION, 370);
    let mut names = BTreeSet::new();
    for (index, (actual, expected)) in first.iter().zip(&expected).enumerate() {
        assert_eq!(actual.index, index);
        assert_eq!(actual.name, expected.name);
        assert_eq!(actual.meaning_id, expected.meaning);
        assert_eq!(actual.scale_id, expected.scale);
        assert!(names.insert(actual.name));
    }
    for slot in 0..4 {
        assert_eq!(
            first[34 + 84 * slot + 23].name,
            format!("position.{slot}.promotion.p")
        );
        assert_eq!(first[34 + 84 * slot + 23].meaning_id, "p:23");
        assert_eq!(first[34 + 84 * slot + 23].scale_id, "unit");
    }
    assert!(
        first[..370]
            .iter()
            .all(|entry| entry.name.starts_with("queue.") || entry.name.starts_with("position."))
    );
    assert!(
        first[370..382]
            .iter()
            .all(|entry| entry.name.starts_with("economic."))
    );
    assert!(
        first[382..]
            .iter()
            .all(|entry| entry.name.starts_with("promotion."))
    );
}

#[test]
fn manifest_outputs_own_all_strings_and_vectors_without_registry_aliasing() {
    let mut first = feature_manifest_v3(&mut LedgerWork::new()).unwrap();
    let second = feature_manifest_v3(&mut LedgerWork::new()).unwrap();
    assert_eq!(first, second);
    assert_ne!(first.names.as_ptr(), second.names.as_ptr());
    assert_ne!(first.entries.as_ptr(), second.entries.as_ptr());
    for index in 0..418 {
        assert_ne!(
            first.names[index].as_ptr(),
            first.entries[index].name.as_ptr()
        );
        assert_ne!(first.names[index].as_ptr(), second.names[index].as_ptr());
        assert_ne!(
            first.entries[index].name.as_ptr(),
            second.entries[index].name.as_ptr()
        );
        assert_ne!(
            first.entries[index].meaning_id.as_ptr(),
            second.entries[index].meaning_id.as_ptr()
        );
        assert_ne!(
            first.entries[index].scale_id.as_ptr(),
            second.entries[index].scale_id.as_ptr()
        );
        first.names[index].clear();
        first.entries[index].name.clear();
        first.entries[index].meaning_id.clear();
        first.entries[index].scale_id.clear();
    }
    first.version.clear();
    first.scales.files = 0;
    assert_eq!(
        serde_json::to_value(second).unwrap(),
        expected_manifest(&normative())
    );
    assert_eq!(feature_registry_v3()[0].name, "queue.pass");
    assert_eq!(feature_registry_v3()[417].meaning_id, "promo:5:1:3");
}

#[test]
fn build_reserves_exact_trusted_invoice_before_all_output_allocations() {
    let (s, build, validate) = invoices(&normative());
    assert_eq!((s, build, validate), (25864, 452544, 119344));
    assert_eq!(build, 349088 + 4 * s);
    assert_eq!(validate, 67616 + 2 * s);
    let mut exact = LedgerWork::with_limit(build).unwrap();
    let (result, count) = allocations(|| feature_manifest_v3(&mut exact));
    assert!(result.is_ok());
    assert_eq!(count, 1675);
    assert_eq!(exact.used(), build);
    let mut short = LedgerWork::with_limit(build - 1).unwrap();
    let (result, count) = allocations(|| feature_manifest_v3(&mut short));
    assert_eq!(result.unwrap_err().code, LedgerErrorCode::Budget);
    assert_eq!(count, 1);
    assert_eq!(short.used(), 0);
    let mut prior = LedgerWork::with_limit(build + 6).unwrap();
    prior.charge(7).unwrap();
    let (result, count) = allocations(|| feature_manifest_v3(&mut prior));
    assert_eq!(result.unwrap_err().code, LedgerErrorCode::Budget);
    assert_eq!(count, 1);
    assert_eq!(prior.used(), 7);
}

#[test]
fn validation_is_zero_copy_with_exact_cap_and_one_below_incremental_invoice() {
    let expected = normative();
    let (_, _, validate) = invoices(&expected);
    let manifest = feature_manifest_v3(&mut LedgerWork::new()).unwrap();
    let mut exact = LedgerWork::with_limit(validate).unwrap();
    let (result, count) = allocations(|| validate_manifest_v3(&manifest, &mut exact));
    result.unwrap();
    assert_eq!(count, 0);
    assert_eq!(exact.used(), validate);
    let mut short = LedgerWork::with_limit(validate - 1).unwrap();
    let (result, count) = allocations(|| validate_manifest_v3(&manifest, &mut short));
    assert_eq!(result.unwrap_err().code, LedgerErrorCode::Budget);
    assert_eq!(count, 1);
    assert_eq!(short.used(), through_lane(&expected, 417, false));
    assert!(short.remaining() > 0);
}

#[test]
fn build_and_validation_use_the_same_inclusive_caller_meter_without_refunds() {
    let (_, build, validate) = invoices(&normative());
    let mut work = LedgerWork::with_limit(build + validate + 17).unwrap();
    work.charge(17).unwrap();
    let manifest = feature_manifest_v3(&mut work).unwrap();
    assert_eq!(work.used(), 17 + build);
    validate_manifest_v3(&manifest, &mut work).unwrap();
    assert_eq!(work.used(), 17 + build + validate);
    assert_eq!(work.remaining(), 0);
    assert_eq!(
        validate_manifest_v3(&manifest, &mut work).unwrap_err().code,
        LedgerErrorCode::Budget
    );
    assert_eq!(work.used(), 17 + build + validate);
    let mut cap = LedgerWork::new();
    cap.charge(LEDGER_WORK_LIMIT - build).unwrap();
    feature_manifest_v3(&mut cap).unwrap();
    assert_eq!(cap.remaining(), 0);
    let mut short = LedgerWork::new();
    short.charge(LEDGER_WORK_LIMIT - build + 1).unwrap();
    assert_eq!(
        feature_manifest_v3(&mut short).unwrap_err().code,
        LedgerErrorCode::Budget
    );
    assert_eq!(short.used(), LEDGER_WORK_LIMIT - build + 1);
    let mut validate_cap = LedgerWork::new();
    validate_cap.charge(LEDGER_WORK_LIMIT - validate).unwrap();
    validate_manifest_v3(&manifest, &mut validate_cap).unwrap();
    assert_eq!(validate_cap.remaining(), 0);
    let mut validate_short = LedgerWork::new();
    validate_short
        .charge(LEDGER_WORK_LIMIT - validate + 1)
        .unwrap();
    assert_eq!(
        validate_manifest_v3(&manifest, &mut validate_short)
            .unwrap_err()
            .code,
        LedgerErrorCode::Budget
    );
    assert_eq!(
        validate_short.used(),
        LEDGER_WORK_LIMIT - validate + 1 + through_lane(&normative(), 417, false)
    );
}

#[test]
fn root_version_dimension_and_count_errors_stop_at_their_prepaid_gates() {
    let base = feature_manifest_v3(&mut LedgerWork::new()).unwrap();
    for dimension in [0, 370, 417, 419, usize::MAX] {
        let mut manifest = base.clone();
        manifest.dimension = dimension;
        let mut work = LedgerWork::new();
        assert_eq!(
            validate_manifest_v3(&manifest, &mut work).unwrap_err().code,
            LedgerErrorCode::Unsupported
        );
        assert_eq!(work.used(), 288);
    }
    for version in [
        "".to_owned(),
        "challenge-feature-manifest-v2".to_owned(),
        "🧪".repeat(262144),
    ] {
        let mut manifest = base.clone();
        manifest.version = version;
        let mut work = LedgerWork::new();
        let error = validate_manifest_v3(&manifest, &mut work).unwrap_err();
        assert_eq!(error.code, LedgerErrorCode::Unsupported);
        assert!(error.message.len() < 80);
        assert_eq!(
            work.used(),
            288 + if manifest.version.len() == 29 { 58 } else { 0 }
        );
    }
    for (names, entries) in [
        (0, 418),
        (417, 418),
        (419, 418),
        (418, 0),
        (418, 417),
        (418, 419),
    ] {
        let mut manifest = base.clone();
        manifest.names.resize(names, String::new());
        manifest.entries.resize(entries, base.entries[0].clone());
        let mut work = LedgerWork::new();
        assert_eq!(
            validate_manifest_v3(&manifest, &mut work).unwrap_err().code,
            LedgerErrorCode::Identity
        );
        assert_eq!(work.used(), 288);
    }
    let mut work = LedgerWork::with_limit(287).unwrap();
    assert_eq!(
        validate_manifest_v3(&base, &mut work).unwrap_err().code,
        LedgerErrorCode::Budget
    );
    assert_eq!(work.used(), 0);
}

#[test]
fn all_fourteen_typed_scales_are_compared_after_their_fixed_precharge() {
    let mut manifest = feature_manifest_v3(&mut LedgerWork::new()).unwrap();
    assert_eq!(
        serde_json::to_value(manifest.scales).unwrap(),
        expected_scales()
    );
    for index in 0..14 {
        let old = *scale(&mut manifest.scales, index);
        for invalid in [0, old + 1, u32::MAX] {
            *scale(&mut manifest.scales, index) = invalid;
            let mut work = LedgerWork::new();
            assert_eq!(
                validate_manifest_v3(&manifest, &mut work).unwrap_err().code,
                LedgerErrorCode::Identity
            );
            assert_eq!(work.used(), 288 + 58 + 14 * 32);
        }
        *scale(&mut manifest.scales, index) = old;
    }
}

#[test]
fn every_coordinate_and_each_owned_string_rejects_equal_length_mutations() {
    let expected = normative();
    let mut manifest = feature_manifest_v3(&mut LedgerWork::new()).unwrap();
    for index in 0..418 {
        for which in 0..4 {
            let mut bad = field(&mut manifest, index, which).clone();
            bad.replace_range(..1, "X");
            let old = std::mem::replace(field(&mut manifest, index, which), bad);
            let mut work = LedgerWork::new();
            assert_eq!(
                validate_manifest_v3(&manifest, &mut work).unwrap_err().code,
                LedgerErrorCode::Identity
            );
            assert_eq!(work.used(), through_lane(&expected, index, true));
            *field(&mut manifest, index, which) = old;
        }
    }
}

#[test]
fn mismatching_string_lengths_stop_before_byte_scans_and_use_bounded_errors() {
    let expected = normative();
    let mut manifest = feature_manifest_v3(&mut LedgerWork::new()).unwrap();
    for index in [0, 200, 417] {
        for which in 0..4 {
            for bad in [String::new(), "🧪".repeat(262144)] {
                let old = std::mem::replace(field(&mut manifest, index, which), bad);
                let mut work =
                    LedgerWork::with_limit(through_lane(&expected, index, false)).unwrap();
                let (result, count) = allocations(|| validate_manifest_v3(&manifest, &mut work));
                let error = result.unwrap_err();
                assert_eq!(error.code, LedgerErrorCode::Identity);
                assert_eq!(count, 1);
                assert!(error.message.len() < 80);
                assert!(!error.message.contains('🧪'));
                assert_eq!(work.used(), through_lane(&expected, index, false));
                *field(&mut manifest, index, which) = old;
            }
        }
    }
}

#[test]
fn every_incremental_lane_reserves_work_before_visiting_or_comparing_caller_bytes() {
    let expected = normative();
    let mut manifest = feature_manifest_v3(&mut LedgerWork::new()).unwrap();
    for cap in [288 + 58 - 1, 288 + 58 + 448 - 1] {
        let mut work = LedgerWork::with_limit(cap).unwrap();
        assert_eq!(
            validate_manifest_v3(&manifest, &mut work).unwrap_err().code,
            LedgerErrorCode::Budget
        );
        assert_eq!(work.used(), if cap < 346 { 288 } else { 346 });
    }
    for index in 0..418 {
        let before = through_lane(&expected, index, false) - 160;
        let mut lane_short = LedgerWork::with_limit(before + 159).unwrap();
        assert_eq!(
            validate_manifest_v3(&manifest, &mut lane_short)
                .unwrap_err()
                .code,
            LedgerErrorCode::Budget
        );
        assert_eq!(lane_short.used(), before);
        let mut bad = manifest.names[index].clone();
        bad.replace_range(..1, "X");
        let old = std::mem::replace(&mut manifest.names[index], bad);
        let mut compare_short =
            LedgerWork::with_limit(through_lane(&expected, index, true) - 1).unwrap();
        assert_eq!(
            validate_manifest_v3(&manifest, &mut compare_short)
                .unwrap_err()
                .code,
            LedgerErrorCode::Budget
        );
        assert_eq!(compare_short.used(), before + 160);
        manifest.names[index] = old;
    }
}
