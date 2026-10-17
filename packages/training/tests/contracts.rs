// SPEC: _spec/packages/training/burn-compat.puml
use std::collections::BTreeMap;

use serde::{Serialize, de::DeserializeOwned};
use serde_json::{Value, json};
use training_native::contracts::*;

fn square(value: &str) -> Square {
    Square::parse(value).unwrap()
}

fn action_values(side: Side) -> Vec<Value> {
    vec![
        json!({"kind":"classical","timing":"C","color":side,"from":"a7","to":"a8","promotion":"q"}),
        json!({"kind":"deploy","timing":"B","color":side,"from":"e1","to":"e2","unit":"p"}),
        json!({"kind":"stimStep","timing":"F","color":side,"from":"a7","to":"a8","promotion":"n"}),
        json!({"kind":"spiderMine","timing":"B","color":side,"from":"a1"}),
        json!({"kind":"charonMissiles","timing":"F","color":side,"from":"b1","to":"h8"}),
        json!({"kind":"siegeMode","timing":"B","color":side,"from":"c1"}),
        json!({"kind":"tacticalJump","timing":"F","color":side,"from":"d1","to":"h8"}),
    ]
}

fn actions(side: Side) -> Vec<Action> {
    action_values(side)
        .into_iter()
        .map(|value| serde_json::from_value(value).unwrap())
        .collect()
}

fn round_trip<T>(value: &T)
where
    T: Serialize + DeserializeOwned + Eq + std::fmt::Debug,
{
    assert_eq!(
        serde_json::from_slice::<T>(&serde_json::to_vec(value).unwrap()).unwrap(),
        *value
    );
}

fn reject<T: DeserializeOwned>(value: Value) {
    assert!(
        serde_json::from_value::<T>(value.clone()).is_err(),
        "accepted malformed {}: {value}",
        std::any::type_name::<T>()
    );
}

fn view(side: Side) -> AuthorizedView {
    let mut view = AuthorizedView {
        version: ViewVersion::V2,
        side,
        turn: 0,
        own: OwnInventory {
            minerals: 12,
            gas: 3,
            gas_income: 3,
            cc_lives: 3,
            pieces: vec![
                OwnPiece {
                    square: square("a1"),
                    kind: PieceKind::Pawn,
                },
                OwnPiece {
                    square: square("c1"),
                    kind: PieceKind::Rook,
                },
            ],
            mines: vec![],
            sieged_tanks: vec![square("c1")],
        },
        cells: all_squares()
            .into_iter()
            .map(|square| ObservedCell::Unknown { square })
            .collect(),
    };
    for piece in &view.own.pieces {
        view.cells[piece.square.index()] = ObservedCell::Lit {
            square: piece.square,
            piece: Some(ObservedPiece {
                color: side,
                kind: piece.kind,
            }),
        };
    }
    view.cells[square("b1").index()] = ObservedCell::Lit {
        square: square("b1"),
        piece: None,
    };
    view.cells[square("h8").index()] = ObservedCell::Revealed {
        square: square("h8"),
        piece: ObservedPiece {
            color: side.other(),
            kind: PieceKind::King,
        },
    };
    view
}

fn pass_batch(side: Side) -> CandidateBatch {
    let lanes: Vec<_> = ACTION_KINDS
        .into_iter()
        .map(CandidateLane::from_kind)
        .chain([CandidateLane::SharedComposition])
        .collect();
    CandidateBatch {
        version: CompositionVersion::V1,
        candidates: vec![Candidate::new(vec![], Spend::default(), side).unwrap()],
        diagnostics: CandidateDiagnostics {
            profile: QuotaProfile::B,
            attempted_extensions: 0,
            unique_including_pass: 1,
            retained_non_pass: 0,
            duplicates: 0,
            owner_skipped: 0,
            quota_skipped: 0,
            pruned: [
                PruningReason::Actor,
                PruningReason::Shape,
                PruningReason::Timing,
                PruningReason::Resources,
                PruningReason::MineCap,
                PruningReason::OwnOccupancy,
            ]
            .into_iter()
            .map(|reason| (reason, 0))
            .collect(),
            active_families: vec![],
            exhausted_lanes: lanes.clone(),
            pools: lanes
                .into_iter()
                .map(|id| CandidatePool {
                    id,
                    initial_capacity: if id == CandidateLane::SharedComposition {
                        511
                    } else {
                        0
                    },
                    final_capacity: if id == CandidateLane::SharedComposition {
                        511
                    } else {
                        0
                    },
                    retained: 0,
                    exhausted: true,
                })
                .collect(),
            retained_by_owner: ACTION_KINDS.into_iter().map(|kind| (kind, 0)).collect(),
            retained_by_length: (1..=4).map(|length| (length.to_string(), 0)).collect(),
            attempt_cap_reached: false,
            capacity_cap_reached: false,
            stop_reason: StopReason::Exhausted,
        },
    }
}

#[test]
fn squares_cover_the_file_major_board_with_one_based_coordinates() {
    for (index, square) in all_squares().into_iter().enumerate() {
        assert_eq!(square.index(), index);
        assert_eq!(usize::from(square.file()), index / 8 + 1);
        assert_eq!(usize::from(square.rank()), index % 8 + 1);
        assert_eq!(Square::parse(&String::from(square)).unwrap(), square);
        assert_eq!(Square::try_from(String::from(square)).unwrap(), square);
        round_trip(&square);
    }
    assert_eq!(String::from(all_squares()[7]), "a8");
    assert_eq!(String::from(all_squares()[8]), "b1");
    assert_eq!(String::from(all_squares()[63]), "h8");
    assert!(all_squares().windows(2).all(|pair| pair[0] < pair[1]));
}

#[test]
fn squares_reject_non_ascii_noncanonical_and_nonstring_inputs() {
    for text in [
        "", "a0", "a9", "i1", "A1", "a10", " a1", "a1 ", "á1", "a１", "a1\n",
    ] {
        assert!(Square::parse(text).is_err());
        reject::<Square>(json!(text));
    }
    for value in [json!(0), json!(["a1"]), json!({"a1":null}), Value::Null] {
        reject::<Square>(value);
    }
}

#[test]
fn closed_string_enums_reject_tagged_objects_and_other_spellings() {
    assert_eq!(Side::White.as_str(), "w");
    assert_eq!(Side::Black.as_str(), "b");
    assert_eq!(Side::White.other(), Side::Black);
    assert_eq!(Side::Black.other(), Side::White);
    reject::<Side>(json!({"w":null}));
    reject::<Side>(json!("white"));
    reject::<PieceKind>(json!({"p":null}));
    reject::<PieceKind>(json!("P"));
    reject::<SpawnPiece>(json!("k"));
    reject::<Promotion>(json!("p"));
    reject::<Promotion>(json!("k"));
    reject::<ClassicalTiming>(json!("B"));
    reject::<SpecialTiming>(json!("C"));
    reject::<ActionKind>(json!("stimstep"));
    reject::<ViewVersion>(json!("arena-smoke-observation-v1"));
    reject::<CandidateVersion>(json!("challenge-candidate-v1"));
    reject::<CompositionVersion>(json!("challenge-composition-v3"));
    reject::<QuotaProfile>(json!("A"));
    reject::<KnownAppendFailure>(json!("resources"));
    reject::<PruningReason>(json!("unknown"));
    reject::<StopReason>(json!("capacityCap"));
    reject::<CandidateLane>(json!("shared"));
}

#[test]
fn all_seven_actions_round_trip_for_both_sides_and_special_timings() {
    for side in [Side::White, Side::Black] {
        for (index, original) in action_values(side).into_iter().enumerate() {
            let timings = if index == 0 {
                vec!["C"]
            } else {
                vec!["B", "F"]
            };
            for timing in timings {
                let mut value = original.clone();
                value["timing"] = json!(timing);
                let action: Action = serde_json::from_value(value.clone()).unwrap();
                assert_eq!(action.kind(), ACTION_KINDS[index]);
                assert_eq!(action.side(), side);
                assert_eq!(action.is_classical(), index == 0);
                assert_eq!(String::from(action.from()), value["from"].as_str().unwrap());
                assert_eq!(serde_json::to_value(&action).unwrap(), value);
                assert!(action.validate_for(side).is_ok());
                assert!(action.validate_for(side.other()).is_err());
                round_trip(&action);
            }
        }
    }
}

#[test]
fn action_fields_are_required_and_unknown_or_cross_family_fields_fail() {
    for value in action_values(Side::White) {
        for field in value
            .as_object()
            .unwrap()
            .keys()
            .filter(|field| *field != "promotion")
        {
            let mut malformed = value.clone();
            malformed.as_object_mut().unwrap().remove(field);
            reject::<Action>(malformed);
        }
        for field in ["snapshot", "fixtureId", "session", "kindExtra"] {
            let mut malformed = value.clone();
            malformed[field] = Value::Null;
            reject::<Action>(malformed);
        }
        for field in ["unit", "promotion", "to"] {
            if !value.as_object().unwrap().contains_key(field) {
                let mut malformed = value.clone();
                malformed[field] = if field == "to" {
                    json!("b2")
                } else {
                    json!("q")
                };
                reject::<Action>(malformed);
            }
        }
        reject::<Action>(Value::Array(
            value.as_object().unwrap().values().cloned().collect(),
        ));
        let mut malformed = value.clone();
        malformed["timing"] = if value["kind"] == "classical" {
            json!("B")
        } else {
            json!("C")
        };
        reject::<Action>(malformed);
        let mut malformed = value;
        malformed["color"] = json!("W");
        reject::<Action>(malformed);
    }
    assert!(
        serde_json::from_str::<Action>(
            r#"{"kind":"spiderMine","kind":"spiderMine","timing":"B","color":"w","from":"a1"}"#
        )
        .is_err()
    );
    assert!(
        serde_json::from_str::<Action>(
            r#"{"kind":"spiderMine","timing":"B","color":"w","from":"a1","from":"b1"}"#
        )
        .is_err()
    );
}

#[test]
fn promotion_is_optional_but_never_null_and_accepts_exactly_four_pieces() {
    for index in [0, 2] {
        let mut value = action_values(Side::Black)[index].clone();
        value.as_object_mut().unwrap().remove("promotion");
        let without: Action = serde_json::from_value(value.clone()).unwrap();
        assert!(
            !serde_json::to_value(&without)
                .unwrap()
                .as_object()
                .unwrap()
                .contains_key("promotion")
        );
        for promotion in ["n", "b", "r", "q"] {
            value["promotion"] = json!(promotion);
            round_trip(&serde_json::from_value::<Action>(value.clone()).unwrap());
        }
        for invalid in [
            Value::Null,
            json!("p"),
            json!("k"),
            json!("Q"),
            json!({"q":null}),
            json!(["q"]),
        ] {
            value["promotion"] = invalid;
            reject::<Action>(value.clone());
        }
    }
    for unit in ["p", "n", "b", "r", "q"] {
        let mut value = action_values(Side::White)[1].clone();
        value["unit"] = json!(unit);
        round_trip(&serde_json::from_value::<Action>(value).unwrap());
    }
    let mut value = action_values(Side::White)[1].clone();
    value["unit"] = json!("k");
    reject::<Action>(value);
}

#[test]
fn canonical_keys_sort_every_object_field_and_preserve_array_order() {
    let actions = actions(Side::Black);
    let expected = [
        r#"{"color":"b","from":"a7","kind":"classical","promotion":"q","timing":"C","to":"a8"}"#,
        r#"{"color":"b","from":"e1","kind":"deploy","timing":"B","to":"e2","unit":"p"}"#,
        r#"{"color":"b","from":"a7","kind":"stimStep","promotion":"n","timing":"F","to":"a8"}"#,
        r#"{"color":"b","from":"a1","kind":"spiderMine","timing":"B"}"#,
        r#"{"color":"b","from":"b1","kind":"charonMissiles","timing":"F","to":"h8"}"#,
        r#"{"color":"b","from":"c1","kind":"siegeMode","timing":"B"}"#,
        r#"{"color":"b","from":"d1","kind":"tacticalJump","timing":"F","to":"h8"}"#,
    ];
    for (action, expected) in actions.iter().zip(&expected) {
        assert_eq!(action.canonical_key(), *expected);
    }
    assert_eq!(
        canonical_actions_key(&actions),
        format!("[{}]", expected.join(","))
    );
    assert_eq!(canonical_actions_key(&[]), "[]");
    assert_ne!(
        canonical_actions_key(&actions[..2]),
        canonical_actions_key(&[actions[1].clone(), actions[0].clone()])
    );
    assert_ne!(
        canonical_actions_key(&actions[..1]),
        canonical_actions_key(&[actions[0].clone(), actions[0].clone()])
    );
}

#[test]
fn canonical_keys_omit_missing_promotion_without_rewriting_native_black() {
    let action: Action = serde_json::from_str(
        r#"{"to":"a8","from":"a7","color":"b","timing":"C","kind":"classical"}"#,
    )
    .unwrap();
    assert_eq!(
        action.canonical_key(),
        r#"{"color":"b","from":"a7","kind":"classical","timing":"C","to":"a8"}"#
    );
    assert_eq!(action.side(), Side::Black);
}

#[test]
fn typed_actions_validate_schema_and_color_without_geometry_or_legality() {
    let action = Action::Classical {
        timing: ClassicalTiming::C,
        color: Side::White,
        from: square("a1"),
        to: square("a1"),
        promotion: Some(Promotion::Queen),
    };
    assert!(action.validate_for(Side::White).is_ok());
    assert!(
        Candidate::new(
            vec![action; 4],
            Spend {
                minerals: 999,
                gas: 999
            },
            Side::White
        )
        .is_ok()
    );
}

#[test]
fn candidates_enforce_complete_keys_color_generated_bound_and_zero_pass_spend() {
    for side in [Side::White, Side::Black] {
        let pass = Candidate::new(vec![], Spend::default(), side).unwrap();
        assert_eq!(pass.key, "[]");
        round_trip(&pass);
        let candidate = Candidate::new(
            actions(side)[..4].to_vec(),
            Spend {
                minerals: 5,
                gas: 2,
            },
            side,
        )
        .unwrap();
        assert_eq!(
            serde_json::to_value(&candidate).unwrap()["ownSpend"],
            json!({"minerals":5,"gas":2})
        );
        round_trip(&candidate);
        assert!(Candidate::new(actions(side)[..5].to_vec(), Spend::default(), side).is_err());
        assert!(
            Candidate::new(actions(side)[..1].to_vec(), Spend::default(), side.other()).is_err()
        );
        assert!(
            Candidate::new(
                vec![],
                Spend {
                    minerals: 1,
                    gas: 0
                },
                side
            )
            .is_err()
        );
        assert!(
            Candidate::new(
                vec![],
                Spend {
                    minerals: 0,
                    gas: 1
                },
                side
            )
            .is_err()
        );
        let mut malformed = candidate.clone();
        malformed.key = canonical_actions_key(&malformed.actions[..1]);
        assert!(malformed.validate(side).is_err());
        let mut malformed = candidate;
        malformed.actions.swap(0, 1);
        assert!(malformed.validate(side).is_err());
    }
    assert_eq!(
        serde_json::from_value::<Vec<Action>>(json!(action_values(Side::White)))
            .unwrap()
            .len(),
        7
    );
}

#[test]
fn views_round_trip_both_sides_and_accept_terminal_schema_without_own_kings() {
    for side in [Side::White, Side::Black] {
        let mut view = view(side);
        assert!(view.validate().is_ok());
        round_trip(&view);
        view.turn = 45;
        view.own.cc_lives = 0;
        view.own.gas = 0;
        view.own.gas_income = 0;
        assert!(view.validate().is_ok());
        assert_eq!(
            serde_json::to_value(&view).unwrap()["version"],
            "arena-observation-v2"
        );
    }
}

#[test]
fn view_mines_are_a_sorted_entity_multiset_with_native_cap_three() {
    assert_eq!(MAX_MINES_PER_SIDE, 3);
    for count in 0..=3 {
        let mut view = view(Side::White);
        view.own.mines = vec![square("a1"); count];
        assert!(view.validate().is_ok());
        round_trip(&view);
        let decoded: AuthorizedView =
            serde_json::from_value(serde_json::to_value(&view).unwrap()).unwrap();
        assert_eq!(decoded.own.mines.len(), count);
    }
    let mut view = view(Side::White);
    view.own.mines = vec![square("a1"), square("a1"), square("b1")];
    assert!(view.validate().is_ok());
    view.own.mines.push(square("b1"));
    assert!(view.validate().is_err());
    view.own.mines = vec![square("b1"), square("a1")];
    assert!(view.validate().is_err());
}

#[test]
fn view_cells_require_exact_canonical_file_major_order_and_count() {
    let original = view(Side::White);
    for count in [0, 63, 65] {
        let mut view = original.clone();
        view.cells.resize(count, view.cells[0].clone());
        assert!(view.validate().is_err());
    }
    let mut view = original.clone();
    view.cells.swap(7, 8);
    assert!(view.validate().is_err());
    let mut view = original;
    view.cells[1] = view.cells[0].clone();
    assert!(view.validate().is_err());
}

#[test]
fn view_own_pieces_must_equal_lit_own_cells_with_unique_sorted_squares() {
    for side in [Side::White, Side::Black] {
        let original = view(side);
        let mut malformed = original.clone();
        malformed.own.pieces.swap(0, 1);
        assert!(malformed.validate().is_err());
        let mut malformed = original.clone();
        malformed
            .own
            .pieces
            .insert(0, malformed.own.pieces[0].clone());
        assert!(malformed.validate().is_err());
        let mut malformed = original.clone();
        malformed.own.pieces.remove(0);
        assert!(malformed.validate().is_err());
        let mut malformed = original.clone();
        malformed.own.pieces[0].kind = PieceKind::Bishop;
        assert!(malformed.validate().is_err());
        for cell in [
            ObservedCell::Unknown {
                square: square("a1"),
            },
            ObservedCell::Lit {
                square: square("a1"),
                piece: None,
            },
            ObservedCell::Lit {
                square: square("a1"),
                piece: Some(ObservedPiece {
                    color: side.other(),
                    kind: PieceKind::Pawn,
                }),
            },
            ObservedCell::Revealed {
                square: square("a1"),
                piece: ObservedPiece {
                    color: side,
                    kind: PieceKind::Pawn,
                },
            },
        ] {
            let mut malformed = original.clone();
            malformed.cells[0] = cell;
            assert!(malformed.validate().is_err());
        }
        let mut malformed = original;
        malformed.cells[1] = ObservedCell::Lit {
            square: square("a2"),
            piece: Some(ObservedPiece {
                color: side,
                kind: PieceKind::Knight,
            }),
        };
        assert!(malformed.validate().is_err());
    }
}

#[test]
fn sieged_tanks_require_uniquely_sorted_own_rooks() {
    let original = view(Side::White);
    for squares in [
        vec![square("a1")],
        vec![square("h8")],
        vec![square("c1"), square("c1")],
        vec![square("c1"), square("a1")],
    ] {
        let mut view = original.clone();
        view.own.sieged_tanks = squares;
        assert!(view.validate().is_err());
    }
    let mut view = original;
    view.own.sieged_tanks.clear();
    assert!(view.validate().is_ok());
}

#[test]
fn view_resource_bounds_reject_invalid_unsigned_and_economic_ranges() {
    for (field, value) in [
        ("turn", 46),
        ("minerals", 13),
        ("ccLives", 4),
        ("gasIncome", 4),
        ("gas", 4),
    ] {
        let mut wire = serde_json::to_value(view(Side::White)).unwrap();
        if field == "turn" {
            wire[field] = json!(value);
        } else {
            wire["own"][field] = json!(value);
        }
        assert!(
            serde_json::from_value::<AuthorizedView>(wire)
                .unwrap()
                .validate()
                .is_err()
        );
    }
    let mut view = view(Side::White);
    view.own.gas_income = 2;
    assert!(view.validate().is_err());
    for field in ["minerals", "gas", "gasIncome", "ccLives"] {
        for invalid in [json!(-1), json!(1.5), json!(4294967296_u64), Value::Null] {
            let mut wire = serde_json::to_value(&view).unwrap();
            wire["own"][field] = invalid;
            reject::<AuthorizedView>(wire);
        }
    }
    for invalid in [json!(-1), json!(1.5), json!(4294967296_u64), Value::Null] {
        let mut wire = serde_json::to_value(&view).unwrap();
        wire["turn"] = invalid;
        reject::<AuthorizedView>(wire);
    }
}

#[test]
fn cell_visibility_requires_exact_piece_presence_and_nullability() {
    for value in [
        json!({"square":"a1","visibility":"unknown"}),
        json!({"square":"a1","visibility":"lit","piece":null}),
        json!({"square":"a1","visibility":"lit","piece":{"color":"w","type":"p"}}),
        json!({"square":"a1","visibility":"revealed","piece":{"color":"b","type":"r"}}),
    ] {
        round_trip(&serde_json::from_value::<ObservedCell>(value).unwrap());
    }
    for value in [
        json!({"square":"a1","visibility":"unknown","piece":null}),
        json!({"square":"a1","visibility":"unknown","piece":{"color":"b","type":"r"}}),
        json!({"square":"a1","visibility":"lit"}),
        json!({"square":"a1","visibility":"revealed"}),
        json!({"square":"a1","visibility":"revealed","piece":null}),
        json!({"square":"a1","visibility":"lit","piece":["w","p"]}),
        json!({"square":"a1","visibility":"lit","piece":{"color":"w","type":"p","snapshot":null}}),
        json!({"square":"a1","visibility":"lit","piece":{"color":"w"}}),
        json!({"square":"a1","visibility":"unknown","session":1}),
        json!(["unknown", "a1"]),
    ] {
        reject::<ObservedCell>(value);
    }
}

#[test]
fn view_rejects_unknown_and_missing_fields_at_every_object_level() {
    let original = serde_json::to_value(view(Side::White)).unwrap();
    for pointer in ["", "/own", "/own/pieces/0", "/cells/0", "/cells/0/piece"] {
        for field in [
            "session",
            "context",
            "fixtureId",
            "case",
            "outcome",
            "snapshot",
            "bank",
            "sourceHash",
            "model",
        ] {
            let mut value = original.clone();
            value
                .pointer_mut(pointer)
                .unwrap()
                .as_object_mut()
                .unwrap()
                .insert(field.into(), Value::Null);
            reject::<AuthorizedView>(value);
        }
        for field in original
            .pointer(pointer)
            .unwrap()
            .as_object()
            .unwrap()
            .keys()
        {
            let mut value = original.clone();
            value
                .pointer_mut(pointer)
                .unwrap()
                .as_object_mut()
                .unwrap()
                .remove(field);
            reject::<AuthorizedView>(value);
        }
    }
}

#[test]
fn all_struct_dtos_reject_serde_sequence_representation() {
    reject::<Action>(json!(["classical", "C", "w", "a1", "a2"]));
    reject::<Action>(json!(["deploy", "B", "w", "e1", "e2", "p"]));
    reject::<Action>(json!(["stimStep", "B", "w", "a1", "a2"]));
    reject::<Action>(json!(["spiderMine", "B", "w", "a1"]));
    reject::<Action>(json!(["charonMissiles", "B", "w", "b1", "c2"]));
    reject::<Action>(json!(["siegeMode", "B", "w", "a1"]));
    reject::<Action>(json!(["tacticalJump", "F", "w", "d1", "h8"]));
    reject::<AuthorizedView>(json!(["arena-observation-v2", "w", 0, {}, []]));
    reject::<OwnInventory>(json!([0, 0, 0, 3, [], [], []]));
    reject::<OwnPiece>(json!(["a1", "p"]));
    reject::<ObservedPiece>(json!(["w", "p"]));
    reject::<Spend>(json!([0, 0]));
    reject::<Candidate>(json!(["arena-candidate-v1","[]",[],{"minerals":0,"gas":0}]));
    reject::<PrimitiveProposal>(
        json!([action_values(Side::White)[0],null,null,{"minerals":0,"gas":0}]),
    );
    reject::<DomainStep>(json!([1, null]));
    reject::<CandidatePool>(json!(["classical", 48, 48, 0, false]));
    reject::<CandidateDiagnostics>(json!([]));
    reject::<CandidateBatch>(json!(["arena-composition-v1", [], {}]));
    for (pointer, replacement) in [
        ("/own", json!([12, 3, 3, 3, [], [], []])),
        ("/own/pieces/0", json!(["a1", "p"])),
        ("/cells/0", json!(["a1","lit",{"color":"w","type":"p"}])),
        ("/cells/0/piece", json!(["w", "p"])),
    ] {
        let mut value = serde_json::to_value(view(Side::White)).unwrap();
        *value.pointer_mut(pointer).unwrap() = replacement;
        reject::<AuthorizedView>(value);
    }
}

#[test]
fn planning_proposals_require_explicit_nullable_fields_and_closed_costs() {
    let original = json!({"action":action_values(Side::Black)[3],"nativeFailure":null,"anchor":"a1","cost":{"minerals":0,"gas":1}});
    let proposal: PrimitiveProposal = serde_json::from_value(original.clone()).unwrap();
    assert_eq!(proposal.action.side(), Side::Black);
    assert_eq!(proposal.anchor, Some(square("a1")));
    round_trip(&proposal);
    for failure in ["actor", "shape", "timing", "mineCap", "ownOccupancy"] {
        let mut value = original.clone();
        value["nativeFailure"] = json!(failure);
        value["anchor"] = Value::Null;
        round_trip(&serde_json::from_value::<PrimitiveProposal>(value).unwrap());
    }
    for field in ["action", "nativeFailure", "anchor", "cost"] {
        let mut value = original.clone();
        value.as_object_mut().unwrap().remove(field);
        reject::<PrimitiveProposal>(value);
    }
    for (pointer, invalid) in [
        ("/nativeFailure", json!("resources")),
        ("/anchor", json!("i1")),
        ("/cost", json!([0, 1])),
        ("/cost", json!({"minerals":0,"gas":1,"hidden":0})),
    ] {
        let mut value = original.clone();
        *value.pointer_mut(pointer).unwrap() = invalid;
        reject::<PrimitiveProposal>(value);
    }
    let mut value = original;
    value["snapshot"] = Value::Null;
    reject::<PrimitiveProposal>(value);
}

#[test]
fn cursor_pulls_and_domain_steps_use_closed_required_nullable_protocols() {
    for family in [None, Some(ActionKind::Deploy)] {
        let pull = CursorPull::Start {
            prefix: actions(Side::White)[..1].to_vec(),
            family,
        };
        round_trip(&pull);
        assert!(
            serde_json::to_value(pull)
                .unwrap()
                .as_object()
                .unwrap()
                .contains_key("family")
        );
    }
    round_trip(&CursorPull::Resume { cursor: u32::MAX });
    for value in [
        json!({"kind":"start","prefix":[]}),
        json!({"kind":"start","prefix":[],"family":null,"cursor":1}),
        json!({"kind":"resume","cursor":1,"family":null}),
        json!({"kind":"resume","cursor":-1}),
        json!({"kind":"resume","cursor":4294967296_u64}),
        json!({"kind":"resume"}),
        json!(["resume", 1]),
    ] {
        reject::<CursorPull>(value);
    }
    let exhausted = DomainStep {
        cursor: 0,
        proposal: None,
    };
    round_trip(&exhausted);
    assert_eq!(
        serde_json::to_value(exhausted).unwrap(),
        json!({"cursor":0,"proposal":null})
    );
    reject::<DomainStep>(json!({"cursor":1}));
    reject::<DomainStep>(json!({"cursor":1,"proposal":null,"session":1}));
}

#[test]
fn planning_oracle_is_usable_through_the_frozen_public_trait() {
    struct Oracle;
    impl PlanningOracle for Oracle {
        fn open(&mut self, view: &AuthorizedView) -> ContractResult<PlanningId> {
            view.validate()?;
            Ok(1)
        }
        fn next(
            &mut self,
            planning: PlanningId,
            pulls: &[CursorPull],
        ) -> ContractResult<Vec<DomainStep>> {
            assert_eq!(planning, 1);
            Ok(pulls
                .iter()
                .map(|_| DomainStep {
                    cursor: 1,
                    proposal: None,
                })
                .collect())
        }
        fn close(&mut self, planning: PlanningId) -> ContractResult<()> {
            assert_eq!(planning, 1);
            Ok(())
        }
    }
    let mut oracle: Box<dyn PlanningOracle> = Box::new(Oracle);
    let planning = oracle.open(&view(Side::White)).unwrap();
    let steps = oracle
        .next(
            planning,
            &[CursorPull::Start {
                prefix: vec![],
                family: None,
            }],
        )
        .unwrap();
    assert_eq!(
        steps,
        vec![DomainStep {
            cursor: 1,
            proposal: None
        }]
    );
    oracle.close(planning).unwrap();
}

#[test]
fn candidate_lanes_preserve_kind_order_and_shared_lane_is_not_a_family() {
    for kind in ACTION_KINDS {
        let lane = CandidateLane::from_kind(kind);
        assert_eq!(lane.kind(), Some(kind));
        assert_eq!(lane.as_str(), kind.as_str());
        round_trip(&lane);
    }
    assert_eq!(CandidateLane::SharedComposition.kind(), None);
    assert_eq!(
        serde_json::to_value(CandidateLane::SharedComposition).unwrap(),
        "shared-composition"
    );
}

#[test]
fn composition_diagnostics_use_exact_legacy_field_names_with_native_versions() {
    let batch = pass_batch(Side::White);
    assert!(batch.validate(Side::White).is_ok());
    round_trip(&batch);
    let value = serde_json::to_value(&batch).unwrap();
    assert_eq!(value["version"], "arena-composition-v1");
    let diagnostics = value["diagnostics"].as_object().unwrap();
    let expected = [
        "profile",
        "attemptedExtensions",
        "uniqueIncludingPass",
        "retainedNonPass",
        "duplicates",
        "ownerSkipped",
        "quotaSkipped",
        "pruned",
        "activeFamilies",
        "exhaustedLanes",
        "pools",
        "retainedByOwner",
        "retainedByLength",
        "attemptCapReached",
        "capacityCapReached",
        "stopReason",
    ];
    assert_eq!(diagnostics.len(), expected.len());
    for field in expected {
        assert!(diagnostics.contains_key(field));
    }
    assert_eq!(value["diagnostics"]["profile"], "B");
    assert_eq!(value["diagnostics"]["pools"][7]["initialCapacity"], 511);
    assert_eq!(value["diagnostics"]["pools"][7]["finalCapacity"], 511);
    assert_eq!(value["diagnostics"]["stopReason"], "exhausted");
}

#[test]
fn composition_rejects_missing_unknown_and_sequence_fields() {
    let original = serde_json::to_value(pass_batch(Side::White)).unwrap();
    for pointer in [
        "",
        "/candidates/0",
        "/candidates/0/ownSpend",
        "/diagnostics",
        "/diagnostics/pools/0",
    ] {
        let mut value = original.clone();
        value
            .pointer_mut(pointer)
            .unwrap()
            .as_object_mut()
            .unwrap()
            .insert("session".into(), json!(1));
        reject::<CandidateBatch>(value);
        for field in original
            .pointer(pointer)
            .unwrap()
            .as_object()
            .unwrap()
            .keys()
        {
            let mut value = original.clone();
            value
                .pointer_mut(pointer)
                .unwrap()
                .as_object_mut()
                .unwrap()
                .remove(field);
            reject::<CandidateBatch>(value);
        }
        let mut value = original.clone();
        *value.pointer_mut(pointer).unwrap() = json!([]);
        reject::<CandidateBatch>(value);
    }
    for pointer in ["/diagnostics/pruned", "/diagnostics/retainedByOwner"] {
        let mut value = original.clone();
        value
            .pointer_mut(pointer)
            .unwrap()
            .as_object_mut()
            .unwrap()
            .insert("private".into(), json!(0));
        reject::<CandidateBatch>(value);
    }
}

#[test]
fn composition_validation_rejects_tampered_bounds_accounting_and_maps() {
    let original = pass_batch(Side::White);
    let mut invalid = original.clone();
    invalid.candidates.clear();
    assert!(invalid.validate(Side::White).is_err());
    let mut invalid = original.clone();
    invalid.candidates.push(invalid.candidates[0].clone());
    assert!(invalid.validate(Side::White).is_err());
    for field in [
        "attemptedExtensions",
        "uniqueIncludingPass",
        "retainedNonPass",
        "duplicates",
        "ownerSkipped",
        "quotaSkipped",
    ] {
        let mut value = serde_json::to_value(&original).unwrap();
        value["diagnostics"][field] = json!(u32::MAX);
        assert!(
            serde_json::from_value::<CandidateBatch>(value)
                .unwrap()
                .validate(Side::White)
                .is_err()
        );
    }
    for pointer in [
        "/diagnostics/pruned/actor",
        "/diagnostics/retainedByOwner/classical",
        "/diagnostics/retainedByLength/1",
    ] {
        let mut value = serde_json::to_value(&original).unwrap();
        *value.pointer_mut(pointer).unwrap() = json!(u32::MAX);
        assert!(
            serde_json::from_value::<CandidateBatch>(value)
                .unwrap()
                .validate(Side::White)
                .is_err()
        );
    }
    let mut invalid = original.clone();
    invalid.diagnostics.pruned.remove(&PruningReason::Actor);
    assert!(invalid.validate(Side::White).is_err());
    let mut invalid = original.clone();
    invalid
        .diagnostics
        .retained_by_owner
        .remove(&ActionKind::Classical);
    assert!(invalid.validate(Side::White).is_err());
    let mut invalid = original.clone();
    invalid.diagnostics.retained_by_length = BTreeMap::from([
        ("0".into(), 0),
        ("1".into(), 0),
        ("2".into(), 0),
        ("3".into(), 0),
    ]);
    assert!(invalid.validate(Side::White).is_err());
    let mut invalid = original;
    invalid.diagnostics.retained_by_length.insert("5".into(), 0);
    assert!(invalid.validate(Side::White).is_err());
}

#[test]
fn composition_validation_rejects_pool_order_funding_and_stop_tampering() {
    let original = pass_batch(Side::White);
    let mut invalid = original.clone();
    invalid.diagnostics.pools.swap(0, 1);
    assert!(invalid.validate(Side::White).is_err());
    let mut invalid = original.clone();
    invalid.diagnostics.pools[0].retained = 1;
    assert!(invalid.validate(Side::White).is_err());
    let mut invalid = original.clone();
    invalid.diagnostics.pools[7].initial_capacity = 512;
    assert!(invalid.validate(Side::White).is_err());
    let mut invalid = original.clone();
    invalid.diagnostics.pools[7].final_capacity = 510;
    assert!(invalid.validate(Side::White).is_err());
    let mut invalid = original.clone();
    invalid.diagnostics.exhausted_lanes.pop();
    assert!(invalid.validate(Side::White).is_err());
    let mut invalid = original.clone();
    invalid.diagnostics.active_families = vec![ActionKind::Deploy, ActionKind::Classical];
    assert!(invalid.validate(Side::White).is_err());
    let mut invalid = original.clone();
    invalid.diagnostics.active_families = vec![ActionKind::Deploy, ActionKind::Deploy];
    assert!(invalid.validate(Side::White).is_err());
    for reason in [StopReason::AttemptCap, StopReason::CapacityCap] {
        let mut invalid = original.clone();
        invalid.diagnostics.stop_reason = reason;
        assert!(invalid.validate(Side::White).is_err());
    }
    let mut invalid = original.clone();
    invalid.diagnostics.attempt_cap_reached = true;
    assert!(invalid.validate(Side::White).is_err());
    let mut invalid = original;
    invalid.diagnostics.capacity_cap_reached = true;
    assert!(invalid.validate(Side::White).is_err());
}

#[test]
fn composition_accepts_complete_capacity_and_gives_capacity_stop_precedence() {
    let side = Side::Black;
    let mut batch = pass_batch(side);
    for index in 0..511 {
        let action = Action::Classical {
            timing: ClassicalTiming::C,
            color: side,
            from: all_squares()[index / 64],
            to: all_squares()[index % 64],
            promotion: None,
        };
        batch
            .candidates
            .push(Candidate::new(vec![action], Spend::default(), side).unwrap());
    }
    batch
        .candidates
        .sort_by(|left, right| left.key.as_bytes().cmp(right.key.as_bytes()));
    let d = &mut batch.diagnostics;
    d.active_families = vec![ActionKind::Classical];
    d.attempted_extensions = 511;
    d.unique_including_pass = 512;
    d.retained_non_pass = 511;
    d.retained_by_owner.insert(ActionKind::Classical, 511);
    d.retained_by_length.insert("1".into(), 511);
    d.pools[0].initial_capacity = 336;
    d.pools[0].final_capacity = 511;
    d.pools[0].retained = 511;
    d.pools[0].exhausted = false;
    d.pools[7].initial_capacity = 175;
    d.pools[7].final_capacity = 0;
    d.exhausted_lanes.remove(0);
    d.capacity_cap_reached = true;
    d.stop_reason = StopReason::CapacityCap;
    assert!(batch.validate(side).is_ok());
    round_trip(&batch);
    batch.diagnostics.attempted_extensions = 2048;
    batch.diagnostics.duplicates = 1537;
    batch.diagnostics.attempt_cap_reached = true;
    assert!(batch.validate(side).is_ok());
    batch.diagnostics.stop_reason = StopReason::AttemptCap;
    assert!(batch.validate(side).is_err());
    batch.candidates.push(batch.candidates[1].clone());
    assert!(batch.validate(side).is_err());
}
