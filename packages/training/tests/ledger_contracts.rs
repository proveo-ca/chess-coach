// SPEC: _spec/packages/training/burn-compat.puml
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use serde_json::{Value, json};
use training_native::ledger::contracts::*;
use training_native::ledger::{LEDGER_WORK_LIMIT, LedgerWork};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Golden {
    rules: LedgerRules,
    boundaries: Vec<EconomicBoundary>,
}

fn golden() -> Golden {
    serde_json::from_str(include_str!("fixtures/ledger-boundaries.json")).unwrap()
}

fn square(value: &str) -> Square {
    Square::parse(value).unwrap()
}

fn round_trip<T: Serialize + DeserializeOwned + Eq + std::fmt::Debug>(value: &T) {
    assert_eq!(
        serde_json::from_slice::<T>(&serde_json::to_vec(value).unwrap()).unwrap(),
        *value
    );
}

fn reject<T: DeserializeOwned>(value: Value) {
    assert!(
        serde_json::from_value::<T>(value.clone()).is_err(),
        "accepted {}: {value}",
        std::any::type_name::<T>()
    );
}

fn closed<T: DeserializeOwned>(value: Value) {
    assert!(serde_json::from_value::<T>(value.clone()).is_ok());
    for invalid in [
        Value::Null,
        json!([]),
        json!({}),
        Value::Array(value.as_object().unwrap().values().cloned().collect()),
    ] {
        reject::<T>(invalid);
    }
    let mut unknown = value.clone();
    unknown
        .as_object_mut()
        .unwrap()
        .insert("privateId".into(), json!("engine:unit:1"));
    reject::<T>(unknown);
    let text = serde_json::to_string(&value).unwrap();
    for (key, field) in value.as_object().unwrap() {
        let duplicate = format!(
            "{{{}:{},{}",
            serde_json::to_string(key).unwrap(),
            field,
            &text[1..]
        );
        assert!(
            serde_json::from_str::<T>(&duplicate).is_err(),
            "accepted duplicate {key}: {duplicate}"
        );
        let mut missing = value.clone();
        missing.as_object_mut().unwrap().remove(key);
        reject::<T>(missing);
    }
}

fn action_ref() -> ActionRef {
    ActionRef {
        planning_ordinal: 0,
        accepted_action_ordinal: 0,
    }
}

fn fact_values() -> Vec<Value> {
    let reference = json!({"planningOrdinal":0,"acceptedActionOrdinal":0});
    let subject = json!({"kind":"before-unit","square":"c2"});
    vec![
        json!({"kind":"unit-born","actionRef":reference,"square":"c3","type":"p"}),
        json!({"kind":"unit-moved","subject":subject,"from":"c2","to":"c3"}),
        json!({"kind":"unit-transformed","subject":subject,"fromType":"p","toType":"q"}),
        json!({"kind":"unit-mode-changed","subject":subject,"before":"tank","after":"siege"}),
        json!({"kind":"unit-destroyed","subject":subject,"square":"c2","type":"p"}),
        json!({"kind":"deployment-unmaterialized","actionRef":reference}),
        json!({"kind":"mine-born","actionRef":reference,"square":"e3"}),
        json!({"kind":"mine-removed","subject":{"kind":"before-mine","square":"e3","slot":1}}),
        json!({"kind":"cc-lives-changed","before":3,"after":2}),
        json!({"kind":"enemy-destruction-witnessed","square":"c3","type":"p","ownActionRef":null}),
    ]
}

fn with_facts(facts: Vec<EffectFact>) -> EconomicBoundary {
    let mut boundary = golden().boundaries.remove(2);
    if let AtomicGroup::Effects {
        facts: existing, ..
    } = &mut boundary.groups[1]
    {
        *existing = facts;
    }
    boundary
}

fn invalid_boundary(boundary: &EconomicBoundary, code: LedgerErrorCode) {
    assert_eq!(
        boundary
            .validate(&golden().rules, &mut LedgerWork::new())
            .unwrap_err()
            .code,
        code
    );
}

#[test]
fn shared_goldens_round_trip_and_validate_with_explicit_native_rule_tables() {
    let fixture = golden();
    assert_eq!(fixture.boundaries.len(), 4);
    assert_eq!(fixture.rules.opening_bank_default, 3);
    assert_eq!(
        fixture.rules.unit_costs,
        UnitCosts {
            p: 1,
            n: 3,
            b: 3,
            r: 5,
            q: 9,
            k: 1
        }
    );
    assert_eq!(
        (
            fixture.rules.mineral_bank_cap,
            fixture.rules.mine_entity_cap,
            fixture.rules.max_turn
        ),
        (12, 3, 45)
    );
    let expected = [
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3,
        3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
    ];
    assert_eq!(fixture.rules.income_by_turn, expected);
    assert_eq!(fixture.rules.gas_capacity_by_turn, expected);
    round_trip(&fixture.rules);
    let mut work = LedgerWork::new();
    for boundary in &fixture.boundaries {
        boundary.validate(&fixture.rules, &mut work).unwrap();
        round_trip(boundary);
        assert_eq!(boundary.snapshot.cells.len(), 64);
    }
    let opening = &fixture.boundaries[0].snapshot.own;
    assert_eq!(
        (opening.minerals, opening.gas, opening.gas_income),
        (3, 1, 1)
    );
    assert_eq!(
        opening
            .pieces
            .iter()
            .filter(|piece| piece.kind == UnitType::Pawn)
            .count(),
        4
    );
    assert_eq!(
        opening
            .pieces
            .iter()
            .filter(|piece| piece.kind == UnitType::King)
            .count(),
        1
    );
}

#[test]
fn atomic_golden_geometry_and_vision_match_complete_snapshots() {
    let fixture = golden();
    assert_eq!(
        fixture.boundaries[0].snapshot,
        fixture.boundaries[1].snapshot
    );
    let boundary = &fixture.boundaries[2];
    assert_eq!(boundary.snapshot.own.gas, 0);
    let mut work = LedgerWork::new();
    let AtomicGroup::Effects {
        before_own,
        after_own,
        facts,
        ..
    } = &boundary.groups[1]
    else {
        panic!()
    };
    assert_eq!(
        *before_own,
        OwnGeometry::from_snapshot(&fixture.boundaries[0].snapshot, &mut work).unwrap()
    );
    assert_eq!(
        *after_own,
        OwnGeometry::from_snapshot(&boundary.snapshot, &mut work).unwrap()
    );
    assert_eq!(
        facts,
        &[EffectFact::UnitMoved {
            subject: UnitSubject::BeforeUnit {
                square: square("c2")
            },
            from: square("c2"),
            to: square("c3")
        }]
    );
    let mut cells = fixture.boundaries[1].snapshot.cells.clone();
    let AtomicGroup::Vision { changes, .. } = &boundary.groups[2] else {
        panic!()
    };
    for cell in changes {
        cells[cell.square().index()] = cell.clone();
    }
    assert_eq!(cells, boundary.snapshot.cells);
    assert_eq!((boundary.planning_ordinal, boundary.grant_ordinal), (1, 1));
    let AtomicGroup::Admission { actions, .. } = &boundary.groups[0] else {
        panic!()
    };
    assert_eq!(actions[0].action_ref.planning_ordinal, 0);
}

#[test]
fn every_effect_variant_is_a_closed_object_with_no_positional_or_duplicate_forms() {
    for value in fact_values() {
        closed::<EffectFact>(value.clone());
        let fact: EffectFact = serde_json::from_value(value).unwrap();
        round_trip(&fact);
        with_facts(vec![fact])
            .validate(&golden().rules, &mut LedgerWork::new())
            .unwrap();
    }
}

#[test]
fn every_group_variant_is_a_closed_object() {
    for group in golden().boundaries.remove(2).groups {
        closed::<AtomicGroup>(serde_json::to_value(&group).unwrap());
        round_trip(&group);
        assert_eq!(
            group.entries(),
            match group {
                AtomicGroup::Admission { .. } | AtomicGroup::Effects { .. } => 1,
                _ => 0,
            }
        );
    }
}

#[test]
fn every_subject_variant_rejects_arrays_aliases_unknown_and_duplicate_fields() {
    for value in [
        json!({"kind":"before-unit","square":"a1"}),
        json!({"kind":"born-unit","actionRef":action_ref()}),
    ] {
        closed::<UnitSubject>(value.clone());
        round_trip(&serde_json::from_value::<UnitSubject>(value).unwrap());
    }
    for value in [
        json!({"kind":"before-mine","square":"a1","slot":0}),
        json!({"kind":"born-mine","actionRef":action_ref()}),
    ] {
        closed::<MineSubject>(value.clone());
        round_trip(&serde_json::from_value::<MineSubject>(value).unwrap());
    }
    reject::<UnitSubject>(json!({"BeforeUnit":{"square":"a1"}}));
    reject::<MineSubject>(json!({"before-mine":{"square":"a1","slot":0}}));
    reject::<EffectFact>(json!({"UnitBorn":{"actionRef":action_ref(),"square":"a1","type":"p"}}));
    reject::<AtomicGroup>(json!({"Admission":{"seq":1,"actions":[]}}));
}

#[test]
fn every_ledger_struct_and_nested_pair_uses_closed_required_object_fields() {
    let fixture = golden();
    closed::<LedgerRules>(serde_json::to_value(&fixture.rules).unwrap());
    closed::<UnitCosts>(serde_json::to_value(&fixture.rules.unit_costs).unwrap());
    closed::<EconomicBoundary>(serde_json::to_value(&fixture.boundaries[0]).unwrap());
    closed::<OwnGeometry>(json!({"units":[],"mines":[],"ccLives":3}));
    closed::<OwnUnitGeometry>(json!({"square":"e1","type":"k","mode":null}));
    closed::<MineOccurrence>(json!({"square":"e3","slot":0}));
    closed::<ActionRef>(serde_json::to_value(action_ref()).unwrap());
    let AtomicGroup::Admission { actions, .. } = &fixture.boundaries[2].groups[0] else {
        panic!()
    };
    closed::<AcceptedOwnAction>(serde_json::to_value(&actions[0]).unwrap());
    closed::<LedgerError>(json!({"code":"BAD_INPUT","message":"shape"}));
    closed::<Pair<ActionRef>>(json!({"w":action_ref(),"b":action_ref()}));
}

#[test]
fn string_enums_accept_only_exact_string_units() {
    fn check<T: DeserializeOwned>(strings: &[&str]) {
        for text in strings {
            assert!(serde_json::from_value::<T>(json!(text)).is_ok());
            reject::<T>(json!({*text:null}));
            reject::<T>(json!([text]));
        }
        for value in [
            json!(null),
            json!(1),
            json!(true),
            json!(""),
            json!("V1"),
            json!("INITIAL"),
        ] {
            reject::<T>(value);
        }
    }
    check::<RulesVersion>(&["arena-economic-rules-v1"]);
    check::<BoundaryVersion>(&["arena-economic-boundary-v1"]);
    check::<BoundaryPhase>(&["initial", "turn-open", "settled"]);
    check::<TankMode>(&["tank", "siege"]);
    check::<LedgerErrorCode>(&[
        "BAD_INPUT",
        "SEQUENCE",
        "IDENTITY",
        "CONSERVATION",
        "BUDGET",
        "UNSUPPORTED",
        "PROVENANCE",
    ]);
}

#[test]
fn nullable_fields_require_explicit_keys_and_reject_nonnullable_nulls() {
    reject::<OwnUnitGeometry>(json!({"square":"a1","type":"p"}));
    reject::<OwnUnitGeometry>(json!({"square":"a1","type":"p","mode":[]}));
    reject::<EffectFact>(json!({"kind":"enemy-destruction-witnessed","square":"a1","type":"p"}));
    let witness: EffectFact = serde_json::from_value(json!({"kind":"enemy-destruction-witnessed","square":"a1","type":"p","ownActionRef":action_ref()})).unwrap();
    round_trip(&witness);
    for key in ["actionRef", "action", "minerals", "gas"] {
        let mut value =
            serde_json::to_value(&golden().boundaries[2].groups[0]).unwrap()["actions"][0].clone();
        value[key] = Value::Null;
        reject::<AcceptedOwnAction>(value);
    }
}

#[test]
fn generic_pairs_support_borrowing_and_select_both_seats_without_arena_types() {
    let input = r#"{"w":"white","b":"black"}"#;
    let mut pair: Pair<&str> = serde_json::from_str(input).unwrap();
    assert_eq!(*pair.get(Side::White), "white");
    assert_eq!(*pair.get(Side::Black), "black");
    *pair.get_mut(Side::Black) = "changed";
    assert_eq!(pair.b, "changed");
    reject::<Pair<u32>>(json!({"white":1,"black":2}));
    reject::<Pair<u32>>(json!([1, 2]));
}

#[test]
fn nullable_generic_pair_requires_both_explicit_seat_keys() {
    for (input, missing) in [(r#"{"w":null}"#, "b"), (r#"{"b":null}"#, "w"), ("{}", "w")] {
        let error = match serde_json::from_str::<Pair<Option<u32>>>(input) {
            Err(error) => error,
            Ok(_) => panic!("nullable Pair accepted missing required seat {missing}: {input}"),
        };
        assert!(
            error
                .to_string()
                .contains(&format!("missing field `{missing}`")),
            "{error}"
        );
    }
    assert_eq!(
        serde_json::from_str::<Pair<Option<u32>>>(r#"{"w":null,"b":null}"#).unwrap(),
        Pair { w: None, b: None }
    );
    assert_eq!(
        serde_json::from_str::<Pair<Option<u32>>>(r#"{"w":null,"b":7}"#).unwrap(),
        Pair {
            w: None,
            b: Some(7)
        }
    );
    for input in [r#"{"w":null,"b":1}"#, r#"{"w":1,"b":null}"#] {
        assert!(serde_json::from_str::<Pair<u32>>(input).is_err());
    }
    for input in [
        "[]",
        "[null,null]",
        "null",
        r#"{"w":null,"b":null,"extra":0}"#,
        r#"{"w":null,"w":1,"b":null}"#,
        r#"{"w":null,"b":null,"b":2}"#,
        r#"{"white":null,"black":null}"#,
    ] {
        assert!(
            serde_json::from_str::<Pair<Option<u32>>>(input).is_err(),
            "accepted malformed pair: {input}"
        );
    }
}

#[test]
fn nullable_generic_pairs_keep_nested_keys_closed_and_support_borrowing() {
    type Nested = Pair<Pair<Option<u32>>>;
    let valid: Nested =
        serde_json::from_str(r#"{"w":{"w":null,"b":1},"b":{"w":2,"b":null}}"#).unwrap();
    assert_eq!(
        valid.w,
        Pair {
            w: None,
            b: Some(1)
        }
    );
    assert_eq!(
        valid.b,
        Pair {
            w: Some(2),
            b: None
        }
    );
    round_trip(&valid);
    for input in [
        r#"{"w":{"w":null},"b":{"w":null,"b":null}}"#,
        r#"{"w":{"b":null},"b":{"w":null,"b":null}}"#,
        r#"{"w":{"w":null,"b":null},"b":{}}"#,
        r#"{"w":{},"b":{}}"#,
        r#"{"w":{"w":null,"b":null}}"#,
        r#"{"b":{"w":null,"b":null}}"#,
        r#"{"w":{"w":null,"w":1,"b":null},"b":{"w":null,"b":null}}"#,
        r#"{"w":{"w":null,"b":null},"b":{"w":null,"b":1,"b":null}}"#,
        r#"{"w":{"w":null,"b":null,"extra":1},"b":{"w":null,"b":null}}"#,
        r#"{"w":[null,null],"b":{"w":null,"b":null}}"#,
        r#"[{"w":null,"b":null},{"w":null,"b":null}]"#,
        r#"{"w":null,"b":{"w":null,"b":null}}"#,
    ] {
        assert!(
            serde_json::from_str::<Nested>(input).is_err(),
            "accepted malformed nested pair: {input}"
        );
    }
    let borrowed: Pair<Option<&str>> = serde_json::from_str(r#"{"w":"white","b":null}"#).unwrap();
    assert_eq!(
        borrowed,
        Pair {
            w: Some("white"),
            b: None
        }
    );
    let optional_nested: Pair<Option<Pair<Option<u32>>>> =
        serde_json::from_str(r#"{"w":null,"b":{"w":null,"b":3}}"#).unwrap();
    assert_eq!(
        optional_nested.b,
        Some(Pair {
            w: None,
            b: Some(3)
        })
    );
    assert!(
        serde_json::from_str::<Pair<Option<Pair<Option<u32>>>>>(r#"{"w":null,"b":{"w":null}}"#)
            .unwrap_err()
            .to_string()
            .contains("missing field `b`")
    );
}

#[test]
fn integer_fields_reject_fractional_negative_overflow_and_string_values() {
    for value in [
        json!(-1),
        json!(1.5),
        json!(4_294_967_296_u64),
        json!("1"),
        json!(null),
    ] {
        let mut reference = serde_json::to_value(action_ref()).unwrap();
        reference["planningOrdinal"] = value.clone();
        reject::<ActionRef>(reference);
        let mut rules = serde_json::to_value(golden().rules).unwrap();
        rules["unitCosts"]["p"] = value;
        reject::<LedgerRules>(rules);
    }
}

#[test]
fn rules_reject_invalid_table_lengths_caps_and_costs() {
    let base = golden().rules;
    let mut malformed = Vec::new();
    for max_turn in [46, u32::MAX] {
        let mut rules = base.clone();
        rules.max_turn = max_turn;
        malformed.push(rules);
    }
    for cap in [0, 13, u32::MAX] {
        let mut rules = base.clone();
        rules.mineral_bank_cap = cap;
        malformed.push(rules);
    }
    for cap in [0, 4, u32::MAX] {
        let mut rules = base.clone();
        rules.mine_entity_cap = cap;
        malformed.push(rules);
    }
    for cost in [0, 13, u32::MAX] {
        let mut rules = base.clone();
        rules.unit_costs.k = cost;
        malformed.push(rules);
    }
    let mut rules = base.clone();
    rules.opening_bank_default = 13;
    malformed.push(rules);
    let mut rules = base.clone();
    rules.income_by_turn.pop();
    malformed.push(rules);
    let mut rules = base.clone();
    rules.gas_capacity_by_turn.push(3);
    malformed.push(rules);
    let mut rules = base.clone();
    rules.income_by_turn[11] = 13;
    malformed.push(rules);
    for cap in [0, 4] {
        let mut rules = base.clone();
        rules.gas_capacity_by_turn[11] = cap;
        malformed.push(rules);
    }
    for rules in malformed {
        assert_eq!(
            rules.validate(&mut LedgerWork::new()).unwrap_err().code,
            LedgerErrorCode::BadInput
        );
    }
}

#[test]
fn profile_tables_and_costs_are_authoritative_without_native_formula_fallbacks() {
    let mut rules = golden().rules;
    rules.income_by_turn[11] = 7;
    rules.gas_capacity_by_turn[11] = 3;
    rules.unit_costs.q = 8;
    rules.validate(&mut LedgerWork::new()).unwrap();
    assert_eq!(rules.income_at(11).unwrap(), 7);
    assert_eq!(rules.gas_capacity_at(11).unwrap(), 3);
    assert_eq!(rules.non_cc_replacement(UnitType::Queen), 8);
    assert!(rules.income_at(46).is_err());
    assert!(rules.gas_capacity_at(u32::MAX).is_err());
    rules.income_by_turn.clear();
    assert!(rules.income_at(0).is_err());
}

#[test]
fn command_center_replacement_is_zero_but_native_cost_remains_profile_owned() {
    let rules = golden().rules;
    assert_eq!(rules.unit_costs.get(UnitType::King), 1);
    assert_eq!(rules.non_cc_replacement(UnitType::King), 0);
    for (kind, expected) in [
        (UnitType::Pawn, 1),
        (UnitType::Knight, 3),
        (UnitType::Bishop, 3),
        (UnitType::Rook, 5),
        (UnitType::Queen, 9),
    ] {
        assert_eq!(rules.unit_costs.get(kind), expected);
        assert_eq!(rules.non_cc_replacement(kind), expected);
    }
}

#[test]
fn mine_occurrences_preserve_multisets_and_restart_slots_within_each_square() {
    let fixture = golden();
    let geometry =
        OwnGeometry::from_snapshot(&fixture.boundaries[3].snapshot, &mut LedgerWork::new())
            .unwrap();
    assert_eq!(
        geometry.mines,
        vec![
            MineOccurrence {
                square: square("e3"),
                slot: 0
            },
            MineOccurrence {
                square: square("e3"),
                slot: 1
            },
            MineOccurrence {
                square: square("f3"),
                slot: 0
            }
        ]
    );
    geometry
        .validate(&fixture.rules, &mut LedgerWork::new())
        .unwrap();
    let mut global_slots = geometry.clone();
    global_slots.mines[2].slot = 2;
    assert!(
        global_slots
            .validate(&fixture.rules, &mut LedgerWork::new())
            .is_err()
    );
    let mut skipped = geometry.clone();
    skipped.mines[1].slot = 2;
    assert!(
        skipped
            .validate(&fixture.rules, &mut LedgerWork::new())
            .is_err()
    );
    let mut unsorted = geometry.clone();
    unsorted.mines.swap(0, 2);
    assert!(
        unsorted
            .validate(&fixture.rules, &mut LedgerWork::new())
            .is_err()
    );
    let mut overflow = geometry.clone();
    overflow.mines.push(MineOccurrence {
        square: square("g3"),
        slot: 0,
    });
    assert!(
        overflow
            .validate(&fixture.rules, &mut LedgerWork::new())
            .is_err()
    );
    let mut smaller_cap = fixture.rules;
    smaller_cap.mine_entity_cap = 2;
    assert!(
        geometry
            .validate(&smaller_cap, &mut LedgerWork::new())
            .is_err()
    );
}

#[test]
fn geometry_requires_canonical_unique_units_rook_modes_and_bounded_lives() {
    let fixture = golden();
    let base = OwnGeometry::from_snapshot(&fixture.boundaries[0].snapshot, &mut LedgerWork::new())
        .unwrap();
    let mut invalid = Vec::new();
    let mut geometry = base.clone();
    geometry.units.swap(0, 1);
    invalid.push(geometry);
    let mut geometry = base.clone();
    geometry.units.push(geometry.units[0].clone());
    invalid.push(geometry);
    let mut geometry = base.clone();
    geometry.units[0].mode = Some(TankMode::Tank);
    invalid.push(geometry);
    let mut geometry = base.clone();
    geometry.units[0].kind = UnitType::Rook;
    invalid.push(geometry);
    let mut geometry = base.clone();
    geometry.cc_lives = 4;
    invalid.push(geometry);
    let mut geometry = base.clone();
    geometry.units = vec![geometry.units[0].clone(); 65];
    invalid.push(geometry);
    for geometry in invalid {
        assert!(
            geometry
                .validate(&fixture.rules, &mut LedgerWork::new())
                .is_err()
        );
    }
    for mode in [TankMode::Tank, TankMode::Siege] {
        let mut geometry = base.clone();
        geometry.units[0].kind = UnitType::Rook;
        geometry.units[0].mode = Some(mode);
        geometry
            .validate(&fixture.rules, &mut LedgerWork::new())
            .unwrap();
    }
}

#[test]
fn snapshot_projection_reuses_existing_authorization_checks_and_rook_modes() {
    let mut snapshot = golden().boundaries.remove(0).snapshot;
    snapshot.own.pieces[0].kind = UnitType::Rook;
    snapshot.own.sieged_tanks = vec![square("c2")];
    snapshot.cells[square("c2").index()] = ObservedCell::Lit {
        square: square("c2"),
        piece: Some(training_native::contracts::ObservedPiece {
            color: Side::White,
            kind: UnitType::Rook,
        }),
    };
    let geometry = OwnGeometry::from_snapshot(&snapshot, &mut LedgerWork::new()).unwrap();
    assert_eq!(geometry.units[0].mode, Some(TankMode::Siege));
    snapshot.own.sieged_tanks.clear();
    assert_eq!(
        OwnGeometry::from_snapshot(&snapshot, &mut LedgerWork::new())
            .unwrap()
            .units[0]
            .mode,
        Some(TankMode::Tank)
    );
    snapshot.cells[square("c2").index()] = ObservedCell::Unknown {
        square: square("c2"),
    };
    assert!(OwnGeometry::from_snapshot(&snapshot, &mut LedgerWork::new()).is_err());
}

#[test]
fn accepted_actions_validate_profile_prices_colors_gas_bounds_and_reference_limits() {
    let mut rules = golden().rules;
    rules.unit_costs.n = 2;
    let base: AcceptedOwnAction = serde_json::from_value(json!({"actionRef":action_ref(),"action":{"kind":"deploy","timing":"B","color":"w","from":"e1","to":"d1","unit":"n"},"minerals":2,"gas":1})).unwrap();
    base.validate_for(Side::White, &rules).unwrap();
    assert!(base.validate_for(Side::Black, &rules).is_err());
    for price in [0, 3, u32::MAX] {
        let mut action = base.clone();
        action.minerals = price;
        assert!(action.validate_for(Side::White, &rules).is_err());
    }
    for gas in [0, 4, u32::MAX] {
        let mut action = base.clone();
        action.gas = gas;
        assert!(action.validate_for(Side::White, &rules).is_err());
    }
    let mut action = base;
    action.action_ref.accepted_action_ordinal = 4;
    assert!(action.validate_for(Side::White, &rules).is_err());
    let AtomicGroup::Admission { actions, .. } = &golden().boundaries[2].groups[0] else {
        panic!()
    };
    let mut classical = actions[0].clone();
    classical.gas = 1;
    assert!(classical.validate_for(Side::White, &rules).is_err());
    classical.gas = 0;
    classical.minerals = 1;
    assert!(classical.validate_for(Side::White, &rules).is_err());
}

#[test]
fn initial_boundaries_reject_nonzero_counters_and_groups_without_imposing_opening_defaults() {
    let fixture = golden();
    let base = &fixture.boundaries[0];
    for field in [
        "ordinal",
        "planningOrdinal",
        "grantOrdinal",
        "seqBefore",
        "seqThrough",
    ] {
        let mut value = serde_json::to_value(base).unwrap();
        value[field] = json!(1);
        let boundary: EconomicBoundary = serde_json::from_value(value).unwrap();
        invalid_boundary(&boundary, LedgerErrorCode::Sequence);
    }
    let mut boundary = base.clone();
    boundary
        .groups
        .push(fixture.boundaries[2].groups[0].clone());
    invalid_boundary(&boundary, LedgerErrorCode::Sequence);
    let mut custom = base.clone();
    custom.snapshot.own.minerals = 8;
    custom
        .validate(&fixture.rules, &mut LedgerWork::new())
        .unwrap();
}

#[test]
fn boundary_sequences_count_filtered_groups_and_reject_overflow_and_gaps() {
    let base = golden().boundaries.remove(2);
    for (before, through) in [(u32::MAX, 3), (1, 4), (0, 5)] {
        let mut boundary = base.clone();
        boundary.seq_before = before;
        boundary.seq_through = through;
        invalid_boundary(&boundary, LedgerErrorCode::Sequence);
    }
    let mut boundary = base.clone();
    if let AtomicGroup::Effects { seq, .. } = &mut boundary.groups[1] {
        *seq = 3;
    }
    invalid_boundary(&boundary, LedgerErrorCode::Sequence);
    let mut boundary = base;
    boundary.ordinal = 0;
    invalid_boundary(&boundary, LedgerErrorCode::Sequence);
}

#[test]
fn settled_admissions_retain_original_planning_refs_and_unique_action_ordinals() {
    let base = golden().boundaries.remove(2);
    let mut boundary = base.clone();
    if let AtomicGroup::Admission { actions, .. } = &mut boundary.groups[0] {
        actions[0].action_ref.planning_ordinal = 1;
    }
    invalid_boundary(&boundary, LedgerErrorCode::Sequence);
    let mut boundary = base.clone();
    if let AtomicGroup::Admission { actions, .. } = &mut boundary.groups[0] {
        actions.push(actions[0].clone());
    }
    invalid_boundary(&boundary, LedgerErrorCode::Sequence);
    let mut boundary = base.clone();
    boundary.planning_ordinal = 0;
    boundary.grant_ordinal = 0;
    invalid_boundary(&boundary, LedgerErrorCode::Sequence);
    let mut boundary = base;
    boundary.grant_ordinal = 2;
    invalid_boundary(&boundary, LedgerErrorCode::Sequence);
}

#[test]
fn settlement_requires_exactly_one_final_group_with_profile_entitlement_and_capacity() {
    let fixture = golden();
    let base = &fixture.boundaries[2];
    for field in [
        "entitlement",
        "credited",
        "gasBeforeReset",
        "nextGasCapacity",
    ] {
        let mut value = serde_json::to_value(base).unwrap();
        value["groups"][3][field] = json!(4);
        invalid_boundary(
            &serde_json::from_value(value).unwrap(),
            LedgerErrorCode::BadInput,
        );
    }
    let mut boundary = base.clone();
    boundary.groups.pop();
    boundary.seq_through = 3;
    invalid_boundary(&boundary, LedgerErrorCode::Sequence);
    let mut boundary = base.clone();
    boundary.phase = BoundaryPhase::TurnOpen;
    if let AtomicGroup::Admission { actions, .. } = &mut boundary.groups[0] {
        actions[0].action_ref.planning_ordinal = 1;
    }
    invalid_boundary(&boundary, LedgerErrorCode::BadInput);
    let mut boundary = base.clone();
    boundary.groups.swap(2, 3);
    if let AtomicGroup::Settlement { seq, .. } = &mut boundary.groups[2] {
        *seq = 3;
    }
    if let AtomicGroup::Vision { seq, .. } = &mut boundary.groups[3] {
        *seq = 4;
    }
    invalid_boundary(&boundary, LedgerErrorCode::BadInput);
}

#[test]
fn empty_groups_are_rejected_before_they_can_consume_filtered_sequence_slots() {
    let base = golden().boundaries.remove(2);
    for index in 0..3 {
        let mut boundary = base.clone();
        match &mut boundary.groups[index] {
            AtomicGroup::Admission { actions, .. } => actions.clear(),
            AtomicGroup::Effects { facts, .. } => facts.clear(),
            AtomicGroup::Vision { changes, .. } => changes.clear(),
            _ => unreachable!(),
        }
        invalid_boundary(&boundary, LedgerErrorCode::BadInput);
    }
}

#[test]
fn vision_changes_require_at_most_64_sorted_unique_squares_and_bounded_turns() {
    let base = golden().boundaries.remove(2);
    for case in 0..4 {
        let mut boundary = base.clone();
        if let AtomicGroup::Vision { changes, turn, .. } = &mut boundary.groups[2] {
            match case {
                0 => changes.swap(0, 1),
                1 => changes.push(changes[0].clone()),
                2 => *changes = vec![changes[0].clone(); 65],
                _ => *turn = 2,
            }
        }
        invalid_boundary(&boundary, LedgerErrorCode::BadInput);
    }
}

#[test]
fn effect_shapes_exclude_command_center_retirements_noops_and_invalid_subject_ordinals() {
    let reference = json!({"planningOrdinal":0,"acceptedActionOrdinal":4});
    let subject = json!({"kind":"before-unit","square":"c2"});
    let malformed = [
        json!({"kind":"unit-born","actionRef":action_ref(),"square":"c3","type":"k"}),
        json!({"kind":"unit-destroyed","subject":subject,"square":"c2","type":"k"}),
        json!({"kind":"unit-moved","subject":subject,"from":"c2","to":"c2"}),
        json!({"kind":"unit-transformed","subject":subject,"fromType":"p","toType":"p"}),
        json!({"kind":"unit-transformed","subject":subject,"fromType":"p","toType":"k"}),
        json!({"kind":"unit-mode-changed","subject":subject,"before":"tank","after":"tank"}),
        json!({"kind":"cc-lives-changed","before":3,"after":4}),
        json!({"kind":"cc-lives-changed","before":3,"after":3}),
        json!({"kind":"enemy-destruction-witnessed","square":"c3","type":"k","ownActionRef":null}),
        json!({"kind":"enemy-destruction-witnessed","square":"c3","type":"p","ownActionRef":reference}),
        json!({"kind":"deployment-unmaterialized","actionRef":reference}),
        json!({"kind":"mine-born","actionRef":reference,"square":"e3"}),
        json!({"kind":"mine-removed","subject":{"kind":"before-mine","square":"e3","slot":3}}),
        json!({"kind":"mine-removed","subject":{"kind":"born-mine","actionRef":reference}}),
        json!({"kind":"unit-moved","subject":{"kind":"born-unit","actionRef":reference},"from":"c2","to":"c3"}),
    ];
    for value in malformed {
        invalid_boundary(
            &with_facts(vec![serde_json::from_value(value).unwrap()]),
            LedgerErrorCode::BadInput,
        );
    }
}

#[test]
fn boundary_physical_group_entry_and_snapshot_caps_are_enforced() {
    let fixture = golden();
    let mut boundary = fixture.boundaries[2].clone();
    boundary.groups = vec![boundary.groups[0].clone(); 2049];
    invalid_boundary(&boundary, LedgerErrorCode::BadInput);
    let fact: EffectFact = serde_json::from_value(fact_values()[0].clone()).unwrap();
    invalid_boundary(&with_facts(vec![fact; 2048]), LedgerErrorCode::BadInput);
    for case in 0..5 {
        let mut boundary = fixture.boundaries[0].clone();
        match case {
            0 => boundary.side = Side::Black,
            1 => boundary.turn = 1,
            2 => boundary.snapshot.own.minerals = 13,
            3 => boundary
                .snapshot
                .cells
                .push(boundary.snapshot.cells[0].clone()),
            _ => boundary.snapshot.own.mines = vec![square("e3"); 4],
        }
        invalid_boundary(&boundary, LedgerErrorCode::BadInput);
    }
}

#[test]
fn canonical_bytes_sort_all_object_keys_preserve_arrays_and_compare_full_payloads() {
    let fixture = golden();
    let first = &fixture.boundaries[0];
    let canonical = canonical_boundary_bytes(first, &mut LedgerWork::new()).unwrap();
    assert!(
        canonical.starts_with(br#"{"grantOrdinal":0,"groups":[],"ordinal":0,"phase":"initial""#)
    );
    let reversed = format!(
        "{{{}}}",
        serde_json::to_value(first)
            .unwrap()
            .as_object()
            .unwrap()
            .iter()
            .rev()
            .map(|(key, value)| format!("{}:{value}", serde_json::to_string(key).unwrap()))
            .collect::<Vec<_>>()
            .join(",")
    );
    let reordered: EconomicBoundary = serde_json::from_str(&reversed).unwrap();
    assert_eq!(
        canonical,
        canonical_boundary_bytes(&reordered, &mut LedgerWork::new()).unwrap()
    );
    let mut changed = first.clone();
    changed.snapshot.own.minerals = 4;
    let different = canonical_boundary_bytes(&changed, &mut LedgerWork::new()).unwrap();
    assert_eq!(&canonical[..128], &different[..128]);
    assert_ne!(canonical, different);
    let mut boundary = fixture.boundaries[2].clone();
    let second = EffectFact::CcLivesChanged {
        before: 3,
        after: 2,
    };
    if let AtomicGroup::Effects { facts, .. } = &mut boundary.groups[1] {
        facts.push(second.clone());
    }
    let bytes = canonical_boundary_bytes(&boundary, &mut LedgerWork::new()).unwrap();
    let value: Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(
        value["groups"][1]["facts"][1],
        serde_json::to_value(second).unwrap()
    );
    assert_eq!(
        serde_json::from_slice::<EconomicBoundary>(&bytes).unwrap(),
        boundary
    );
}

#[test]
fn decoding_precharges_raw_bytes_and_preserves_strict_duplicate_detection() {
    let fixture = golden();
    let bytes = serde_json::to_vec(&fixture.boundaries[0]).unwrap();
    let mut work = LedgerWork::new();
    assert_eq!(
        decode_boundary(&bytes, &fixture.rules, &mut work).unwrap(),
        fixture.boundaries[0]
    );
    assert_eq!(work.used(), bytes.len() as u64 + 740);
    let mut work = LedgerWork::new();
    assert_eq!(
        decode_boundary(b"[]", &fixture.rules, &mut work)
            .unwrap_err()
            .code,
        LedgerErrorCode::BadInput
    );
    assert_eq!(work.used(), 2);
    let mut duplicate = b"{\"ordinal\":0,".to_vec();
    duplicate.extend_from_slice(&bytes[1..]);
    assert_eq!(
        decode_boundary(&duplicate, &fixture.rules, &mut LedgerWork::new())
            .unwrap_err()
            .code,
        LedgerErrorCode::BadInput
    );
    let mut small = LedgerWork::with_limit(1).unwrap();
    assert_eq!(
        decode_boundary(&bytes, &fixture.rules, &mut small)
            .unwrap_err()
            .code,
        LedgerErrorCode::Budget
    );
    assert_eq!(small.used(), 0);
}

#[test]
fn canonical_serialization_rejects_oversized_output_before_value_or_output_allocation() {
    let fixture = golden();
    let mut boundary = fixture.boundaries[1].clone();
    let geometry = OwnGeometry {
        units: training_native::contracts::all_squares()
            .into_iter()
            .map(|square| OwnUnitGeometry {
                square,
                kind: UnitType::Pawn,
                mode: None,
            })
            .collect(),
        mines: vec![],
        cc_lives: 3,
    };
    boundary.groups = (1..=256)
        .map(|seq| AtomicGroup::Effects {
            seq,
            before_own: geometry.clone(),
            after_own: geometry.clone(),
            facts: vec![EffectFact::CcLivesChanged {
                before: 3,
                after: 2,
            }],
        })
        .collect();
    boundary.seq_through = 256;
    let mut expected_work = LedgerWork::new();
    expected_work.charge_boundary(&boundary).unwrap();
    let mut work = LedgerWork::new();
    assert_eq!(
        canonical_boundary_bytes(&boundary, &mut work)
            .unwrap_err()
            .code,
        LedgerErrorCode::Budget
    );
    assert_eq!(work.used(), expected_work.used());
    assert!(work.remaining() > 0);
}

#[test]
fn work_limit_arithmetic_is_checked_and_failed_charge_does_not_increase_used() {
    assert!(LedgerWork::with_limit(0).is_err());
    assert!(LedgerWork::with_limit(LEDGER_WORK_LIMIT + 1).is_err());
    let mut work = LedgerWork::with_limit(10).unwrap();
    assert_eq!((work.used(), work.remaining(), work.limit()), (0, 10, 10));
    work.charge(9).unwrap();
    for amount in [2, u64::MAX] {
        assert_eq!(
            work.charge(amount).unwrap_err().code,
            LedgerErrorCode::Budget
        );
        assert_eq!(work.used(), 9);
    }
    work.charge(1).unwrap();
    work.charge(0).unwrap();
    assert_eq!((work.used(), work.remaining()), (10, 0));
    assert_eq!(LedgerWork::default().limit(), LEDGER_WORK_LIMIT);
    let mut work = LedgerWork::new();
    assert_eq!(
        work.preflight_bytes(MAX_BOUNDARY_BYTES + 1)
            .unwrap_err()
            .code,
        LedgerErrorCode::Budget
    );
    assert_eq!(work.used(), 0);
    work.preflight_bytes(MAX_BOUNDARY_BYTES).unwrap();
    assert_eq!(work.remaining(), 0);
}

#[test]
fn work_fees_cover_profile_snapshots_groups_geometry_actions_facts_and_canonical_allocation() {
    let fixture = golden();
    let mut work = LedgerWork::new();
    fixture.rules.validate(&mut work).unwrap();
    assert_eq!(work.used(), 124);
    work.charge_boundary(&fixture.boundaries[0]).unwrap();
    assert_eq!(work.used(), 124 + 616);
    work.charge_boundary(&fixture.boundaries[2]).unwrap();
    assert_eq!(work.used(), 124 + 616 + 800);
    let mut canonical_work = LedgerWork::new();
    let bytes = canonical_boundary_bytes(&fixture.boundaries[0], &mut canonical_work).unwrap();
    assert_eq!(canonical_work.used(), 616 + bytes.len() as u64 * 3);
    let mut insufficient = LedgerWork::with_limit(616).unwrap();
    assert_eq!(
        canonical_boundary_bytes(&fixture.boundaries[0], &mut insufficient)
            .unwrap_err()
            .code,
        LedgerErrorCode::Budget
    );
    assert_eq!(insufficient.used(), 616);
}

#[test]
fn one_work_meter_accumulates_both_seats_and_windows_without_helper_resets() {
    let fixture = golden();
    let mut work = LedgerWork::with_limit(740 * 2).unwrap();
    fixture.boundaries[0]
        .validate(&fixture.rules, &mut work)
        .unwrap();
    assert_eq!(work.used(), 740);
    fixture.boundaries[0]
        .validate(&fixture.rules, &mut work)
        .unwrap();
    assert_eq!(work.used(), 1480);
    assert_eq!(
        fixture.boundaries[1]
            .validate(&fixture.rules, &mut work)
            .unwrap_err()
            .code,
        LedgerErrorCode::Budget
    );
    assert_eq!(work.used(), 1480);
}

#[test]
fn ledger_errors_expose_only_the_closed_code_and_message_contract() {
    for code in [
        LedgerErrorCode::BadInput,
        LedgerErrorCode::Sequence,
        LedgerErrorCode::Identity,
        LedgerErrorCode::Conservation,
        LedgerErrorCode::Budget,
        LedgerErrorCode::Unsupported,
        LedgerErrorCode::Provenance,
    ] {
        let error = LedgerError::new(code, "contract rejected");
        assert_eq!(
            error.to_string(),
            format!("{}: contract rejected", code.as_str())
        );
        round_trip(&error);
    }
    let mut value = serde_json::to_value(&golden().boundaries[0]).unwrap();
    for key in [
        "sessionId",
        "caseId",
        "fixtureId",
        "ready",
        "policy",
        "model",
    ] {
        value[key] = json!(true);
        reject::<EconomicBoundary>(value.clone());
        value.as_object_mut().unwrap().remove(key);
    }
}

#[test]
fn terminal_open_crossings_preserve_carried_gas_capacity_without_a_grant() {
    let fixture = golden();
    for (before_turn, carried_capacity) in [(0, 1), (10, 1), (20, 2)] {
        let mut boundary = fixture.boundaries[1].clone();
        boundary.turn = before_turn + 1;
        boundary.snapshot.turn = boundary.turn;
        boundary.snapshot.own.gas = carried_capacity;
        boundary.snapshot.own.gas_income = carried_capacity;
        boundary.snapshot.own.cc_lives = 0;
        boundary
            .validate(&fixture.rules, &mut LedgerWork::new())
            .unwrap_or_else(|error| {
                assert_eq!(error.code, LedgerErrorCode::BadInput);
                panic!(
                    "native terminal Begin {before_turn}->{} rejected: {error}",
                    boundary.turn
                );
            });
        assert_eq!((boundary.planning_ordinal, boundary.grant_ordinal), (0, 0));
        assert!(boundary.groups.is_empty());
        assert_eq!(boundary.snapshot.own.minerals, 3);
        boundary.snapshot.own.gas_income = 0;
        boundary.snapshot.own.gas = 0;
        assert_eq!(
            boundary
                .validate(&fixture.rules, &mut LedgerWork::new())
                .unwrap_err()
                .code,
            LedgerErrorCode::BadInput
        );
    }
}

#[test]
fn first_and_tier_settlements_use_current_profile_while_initial_has_no_grant() {
    let fixture = golden();
    for (before_turn, entitlement, capacity) in [(0, 1, 1), (10, 2, 2), (20, 3, 3)] {
        let mut initial = fixture.boundaries[0].clone();
        initial.turn = before_turn;
        initial.snapshot.turn = before_turn;
        initial.snapshot.own.gas_income = fixture.rules.gas_capacity_at(before_turn).unwrap();
        initial.snapshot.own.gas = initial.snapshot.own.gas_income;
        initial
            .validate(&fixture.rules, &mut LedgerWork::new())
            .unwrap();
        assert_eq!(
            (initial.grant_ordinal, initial.snapshot.own.minerals),
            (0, 3)
        );
        assert!(initial.groups.is_empty());
        let mut settled = initial.clone();
        settled.ordinal = 2;
        settled.phase = BoundaryPhase::Settled;
        settled.turn = before_turn + 1;
        settled.snapshot.turn = settled.turn;
        settled.planning_ordinal = 1;
        settled.grant_ordinal = 1;
        settled.seq_through = 1;
        settled.groups = vec![AtomicGroup::Settlement {
            seq: 1,
            entitlement,
            credited: entitlement,
            gas_before_reset: initial.snapshot.own.gas,
            next_gas_capacity: capacity,
        }];
        settled.snapshot.own.minerals = 3 + entitlement;
        settled.snapshot.own.gas = 0;
        settled.snapshot.own.gas_income = capacity;
        settled
            .validate(&fixture.rules, &mut LedgerWork::new())
            .unwrap();
        for phase in [BoundaryPhase::Initial, BoundaryPhase::Settled] {
            let mut wrong = settled.clone();
            if phase == BoundaryPhase::Initial {
                wrong.ordinal = 0;
                wrong.planning_ordinal = 0;
                wrong.grant_ordinal = 0;
                wrong.seq_through = 0;
                wrong.groups.clear();
                wrong.phase = phase;
            }
            wrong.snapshot.own.gas_income = if capacity == 1 { 2 } else { capacity - 1 };
            assert_eq!(
                wrong
                    .validate(&fixture.rules, &mut LedgerWork::new())
                    .unwrap_err()
                    .code,
                LedgerErrorCode::BadInput
            );
        }
    }
}
