// SPEC: _spec/packages/training/burn-compat.puml
use training_native::candidates::generate;
use training_native::contracts::*;
use training_native::policy::{BaselinePolicy, select, xorshift32};

struct OneAction {
    side: Side,
    next_cursor: u32,
}

impl PlanningOracle for OneAction {
    fn open(&mut self, _: &AuthorizedView) -> ContractResult<PlanningId> {
        Ok(1)
    }
    fn next(&mut self, _: PlanningId, pulls: &[CursorPull]) -> ContractResult<Vec<DomainStep>> {
        Ok(pulls
            .iter()
            .map(|pull| {
                self.next_cursor += 1;
                match pull {
                    CursorPull::Start { prefix, family }
                        if prefix.is_empty()
                            && (family.is_none() || *family == Some(ActionKind::Classical)) =>
                    {
                        DomainStep {
                            cursor: self.next_cursor,
                            proposal: Some(PrimitiveProposal {
                                action: Action::Classical {
                                    timing: ClassicalTiming::C,
                                    color: self.side,
                                    from: Square::parse("a1").unwrap(),
                                    to: Square::parse("a2").unwrap(),
                                    promotion: None,
                                },
                                native_failure: None,
                                anchor: Some(Square::parse("a1").unwrap()),
                                cost: Spend::default(),
                            }),
                        }
                    }
                    CursorPull::Start { .. } => DomainStep {
                        cursor: self.next_cursor,
                        proposal: None,
                    },
                    CursorPull::Resume { cursor } => DomainStep {
                        cursor: *cursor,
                        proposal: None,
                    },
                }
            })
            .collect())
    }
    fn close(&mut self, _: PlanningId) -> ContractResult<()> {
        Ok(())
    }
}

fn batch(side: Side) -> CandidateBatch {
    let view = AuthorizedView {
        version: ViewVersion::V2,
        side,
        turn: 0,
        own: OwnInventory {
            minerals: 0,
            gas: 0,
            gas_income: 0,
            cc_lives: 0,
            pieces: vec![],
            mines: vec![],
            sieged_tanks: vec![],
        },
        cells: all_squares()
            .into_iter()
            .map(|square| ObservedCell::Unknown { square })
            .collect(),
    };
    generate(
        &view,
        &mut OneAction {
            side,
            next_cursor: 0,
        },
    )
    .unwrap()
}

#[test]
fn xorshift_matches_all_golden_draws_and_stays_u32() {
    assert_eq!(xorshift32(0), 0);
    let mut seed = 1;
    for expected in [270369, 67634689, 2647435461] {
        seed = xorshift32(seed);
        assert_eq!(seed, expected);
    }
    assert_eq!(xorshift32(u32::MAX), 253983);
    assert_eq!(xorshift32(0x8000_0000), 0x8008_4000);
}

#[test]
fn policy_names_are_versioned_and_round_trip() {
    for policy in [
        BaselinePolicy::PassV1,
        BaselinePolicy::FirstV1,
        BaselinePolicy::SeededV1,
    ] {
        let wire = serde_json::to_string(&policy).unwrap();
        assert_eq!(wire, format!("\"{}\"", policy.as_str()));
        assert_eq!(
            serde_json::from_str::<BaselinePolicy>(&wire).unwrap(),
            policy
        );
    }
    for wire in [
        "\"pass\"",
        "\"naive\"",
        "\"strategic\"",
        "null",
        "[]",
        "{\"pass-v1\":null}",
    ] {
        assert!(serde_json::from_str::<BaselinePolicy>(wire).is_err());
    }
}

#[test]
fn baseline_policy_wire_accepts_strings_and_rejects_each_object_alias() {
    for policy in [
        BaselinePolicy::PassV1,
        BaselinePolicy::FirstV1,
        BaselinePolicy::SeededV1,
    ] {
        let string = format!("\"{}\"", policy.as_str());
        assert_eq!(
            serde_json::from_str::<BaselinePolicy>(&string).unwrap(),
            policy
        );
        assert_eq!(serde_json::to_string(&policy).unwrap(), string);
        let alias = format!("{{\"{}\":null}}", policy.as_str());
        assert!(
            serde_json::from_str::<BaselinePolicy>(&alias).is_err(),
            "accepted object alias {alias}"
        );
        let alias: serde_json::Value = serde_json::from_str(&alias).unwrap();
        assert!(serde_json::from_value::<BaselinePolicy>(alias).is_err());
    }
}

#[test]
fn baseline_policy_wire_rejects_non_strings_and_unknown_variants() {
    for wire in [
        "null",
        "true",
        "false",
        "0",
        "1",
        "[]",
        "[\"pass-v1\"]",
        "{}",
        "{\"PassV1\":null}",
        "{\"first-v1\":[]}",
        "{\"seeded-v1\":{}}",
        "\"\"",
        "\"pass\"",
        "\"pass-v2\"",
        "\"PASS-V1\"",
        "\" first-v1\"",
        "\"seeded-v1 \"",
    ] {
        assert!(
            serde_json::from_str::<BaselinePolicy>(wire).is_err(),
            "accepted invalid wire {wire}"
        );
    }
    let error = serde_json::from_str::<BaselinePolicy>("\"unknown-v1\"").unwrap_err();
    assert!(error.to_string().contains("Unknown baseline policy"));
}

#[test]
fn first_and_pass_select_the_canonical_pass_including_black_batches() {
    for side in [Side::White, Side::Black] {
        let batch = batch(side);
        assert_eq!(batch.candidates.len(), 2);
        for policy in [BaselinePolicy::PassV1, BaselinePolicy::FirstV1] {
            for seed in [0, 1, u32::MAX] {
                let selection = select(&batch, policy, seed).unwrap();
                assert_eq!(selection.index, 0);
                assert_eq!(selection.candidate, batch.candidates[0]);
                assert_eq!(selection.candidate.key, "[]");
            }
        }
    }
}

#[test]
fn seeded_selection_indexes_the_complete_canonical_array_repeatably() {
    for side in [Side::White, Side::Black] {
        let batch = batch(side);
        for seed in [0, 1, 2, 270369, 67634689, u32::MAX, 0x8000_0000] {
            let expected = xorshift32(seed) as usize % batch.candidates.len();
            let first = select(&batch, BaselinePolicy::SeededV1, seed).unwrap();
            assert_eq!(first.index, expected);
            assert_eq!(first.candidate, batch.candidates[expected]);
            assert_eq!(
                select(&batch, BaselinePolicy::SeededV1, seed).unwrap(),
                first
            );
            if !first.candidate.actions.is_empty() {
                assert_eq!(first.candidate.actions[0].side(), side);
            }
        }
        assert!(
            select(&batch, BaselinePolicy::SeededV1, 0)
                .unwrap()
                .candidate
                .actions
                .is_empty()
        );
        assert!(
            !select(&batch, BaselinePolicy::SeededV1, 1)
                .unwrap()
                .candidate
                .actions
                .is_empty()
        );
    }
}

#[test]
fn all_policies_reject_corrupted_keys_diagnostics_order_and_mixed_sides() {
    let original = batch(Side::Black);
    let mut malformed = vec![];
    let mut next = original.clone();
    next.candidates[1].key.push(' ');
    malformed.push(next);
    let mut next = original.clone();
    next.diagnostics.duplicates += 1;
    malformed.push(next);
    let mut next = original.clone();
    next.candidates.swap(0, 1);
    malformed.push(next);
    let mut next = original.clone();
    next.candidates.clear();
    malformed.push(next);
    let mut next = original.clone();
    next.diagnostics.pools[0].retained += 1;
    malformed.push(next);
    let mut next = original.clone();
    next.diagnostics
        .retained_by_owner
        .remove(&ActionKind::Classical);
    malformed.push(next);
    let mut next = original;
    next.candidates[1].actions.push(Action::SiegeMode {
        timing: SpecialTiming::B,
        color: Side::White,
        from: Square::parse("a1").unwrap(),
    });
    next.candidates[1].key = canonical_actions_key(&next.candidates[1].actions);
    malformed.push(next);
    for batch in malformed {
        for policy in [
            BaselinePolicy::PassV1,
            BaselinePolicy::FirstV1,
            BaselinePolicy::SeededV1,
        ] {
            assert!(select(&batch, policy, 1).is_err());
        }
    }
}

#[test]
fn seeded_policy_accepts_pass_only_batches_without_a_side_guess_for_actions() {
    let mut batch = batch(Side::Black);
    batch.candidates.truncate(1);
    let d = &mut batch.diagnostics;
    d.retained_non_pass = 0;
    d.unique_including_pass = 1;
    d.attempted_extensions -= 1;
    d.pools[0].retained = 0;
    d.retained_by_owner.insert(ActionKind::Classical, 0);
    d.retained_by_length.insert("1".into(), 0);
    for policy in [
        BaselinePolicy::PassV1,
        BaselinePolicy::FirstV1,
        BaselinePolicy::SeededV1,
    ] {
        for seed in [0, 1, u32::MAX] {
            let selection = select(&batch, policy, seed).unwrap();
            assert_eq!(selection.index, 0);
            assert_eq!(selection.candidate, batch.candidates[0]);
        }
    }
}
