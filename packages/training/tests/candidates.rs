// SPEC: _spec/packages/training/burn-compat.puml
use std::collections::{BTreeMap, VecDeque};

use training_native::candidates::{Generation, generate, generate_with_runtime};
use training_native::contracts::*;

#[path = "support/native.rs"]
mod native;

fn sq(value: &str) -> Square {
    Square::parse(value).unwrap()
}

fn view(side: Side) -> AuthorizedView {
    AuthorizedView {
        version: ViewVersion::V2,
        side,
        turn: 0,
        own: OwnInventory {
            minerals: 12,
            gas: 3,
            gas_income: 3,
            cc_lives: 3,
            pieces: vec![],
            mines: vec![],
            sieged_tanks: vec![],
        },
        cells: all_squares()
            .into_iter()
            .map(|square| ObservedCell::Unknown { square })
            .collect(),
    }
}

fn c(side: Side, index: usize) -> Action {
    Action::Classical {
        timing: ClassicalTiming::C,
        color: side,
        from: all_squares()[index / 64],
        to: all_squares()[index % 64],
        promotion: None,
    }
}

fn special(side: Side, kind: ActionKind, index: usize) -> Action {
    let timing = SpecialTiming::F;
    let from = all_squares()[index / 64];
    let to = all_squares()[index % 64];
    match kind {
        ActionKind::Classical => c(side, index),
        ActionKind::Deploy => Action::Deploy {
            timing,
            color: side,
            from,
            to,
            unit: SpawnPiece::Pawn,
        },
        ActionKind::StimStep => Action::StimStep {
            timing,
            color: side,
            from,
            to,
            promotion: None,
        },
        ActionKind::SpiderMine => Action::SpiderMine {
            timing,
            color: side,
            from,
        },
        ActionKind::CharonMissiles => Action::CharonMissiles {
            timing,
            color: side,
            from,
            to,
        },
        ActionKind::SiegeMode => Action::SiegeMode {
            timing,
            color: side,
            from,
        },
        ActionKind::TacticalJump => Action::TacticalJump {
            timing,
            color: side,
            from,
            to,
        },
    }
}

fn row(action: Action) -> PrimitiveProposal {
    PrimitiveProposal {
        anchor: Some(action.from()),
        action,
        native_failure: None,
        cost: Spend::default(),
    }
}

type Domain = Box<dyn FnMut(&[Action], Option<ActionKind>, usize) -> Vec<PrimitiveProposal>>;
type FakeCursor = (Vec<Action>, Option<ActionKind>, VecDeque<PrimitiveProposal>);

struct Fake {
    domain: Domain,
    next_cursor: u32,
    cursors: BTreeMap<CursorId, FakeCursor>,
    roots: usize,
    opens: usize,
    closes: Vec<PlanningId>,
    visits: Vec<(Vec<Action>, Option<ActionKind>, Option<PrimitiveProposal>)>,
    starts: Vec<(Vec<Action>, Option<ActionKind>)>,
    fault: Option<&'static str>,
    close_error: bool,
}

impl Fake {
    fn new(
        domain: impl FnMut(&[Action], Option<ActionKind>, usize) -> Vec<PrimitiveProposal> + 'static,
    ) -> Self {
        Self {
            domain: Box::new(domain),
            next_cursor: 0,
            cursors: BTreeMap::new(),
            roots: 0,
            opens: 0,
            closes: vec![],
            visits: vec![],
            starts: vec![],
            fault: None,
            close_error: false,
        }
    }
}

impl PlanningOracle for Fake {
    fn open(&mut self, _: &AuthorizedView) -> ContractResult<PlanningId> {
        self.opens += 1;
        match self.fault {
            Some("open") => Err("open error".into()),
            Some("planning") => Ok(0),
            _ => Ok(11),
        }
    }
    fn next(
        &mut self,
        planning: PlanningId,
        pulls: &[CursorPull],
    ) -> ContractResult<Vec<DomainStep>> {
        assert_eq!(planning, 11);
        assert_eq!(pulls.len(), 1);
        if self.fault == Some("next") {
            return Err("MemoryLimit".into());
        }
        let cursor = match &pulls[0] {
            CursorPull::Start { prefix, family } => {
                self.next_cursor += 1;
                let lane = if family.is_none() && prefix.is_empty() {
                    let lane = self.roots;
                    self.roots += 1;
                    lane
                } else {
                    usize::MAX
                };
                let rows = (self.domain)(prefix, *family, lane);
                self.starts.push((prefix.clone(), *family));
                self.cursors
                    .insert(self.next_cursor, (prefix.clone(), *family, rows.into()));
                self.next_cursor
            }
            CursorPull::Resume { cursor } => *cursor,
        };
        let (prefix, family, rows) = self.cursors.get_mut(&cursor).unwrap();
        let proposal = rows.pop_front();
        self.visits
            .push((prefix.clone(), *family, proposal.clone()));
        let mut step = DomainStep { cursor, proposal };
        match self.fault {
            Some("zero") => step.cursor = 0,
            Some("reuse") => step.cursor = 1,
            Some("resume") if matches!(pulls[0], CursorPull::Resume { .. }) => step.cursor += 100,
            Some("short") => return Ok(vec![]),
            Some("long") => return Ok(vec![step.clone(), step]),
            _ => {}
        }
        Ok(vec![step])
    }
    fn close(&mut self, planning: PlanningId) -> ContractResult<()> {
        self.closes.push(planning);
        self.cursors.clear();
        if self.close_error {
            Err("cleanup error".into())
        } else {
            Ok(())
        }
    }
}

fn check(generation: &Generation, oracle: &Fake, side: Side) {
    generation.batch.validate(side).unwrap();
    let d = &generation.batch.diagnostics;
    let r = &generation.runtime;
    assert_eq!(r.roots, 8);
    assert_eq!(r.domain_cursors, r.roots + r.continuation_nodes);
    assert_eq!(r.append_attempts, d.attempted_extensions);
    assert!(r.maximum_queue_length <= 4);
    assert!(generation.batch.candidates.len() <= 512);
    assert!(r.domain_cursors <= 2056);
    assert!(oracle.starts.len() <= 2063);
    assert_eq!(oracle.closes, [11]);
    assert!(oracle.cursors.is_empty());
    assert_eq!(
        r.cursor_pulls as usize,
        oracle
            .visits
            .iter()
            .filter(|(_, family, _)| family.is_none())
            .count()
    );
    assert_eq!(
        r.availability_pulls as usize,
        oracle
            .visits
            .iter()
            .filter(|(_, family, _)| family.is_some())
            .count()
    );
    assert_eq!(
        r.append_attempts as usize,
        oracle
            .visits
            .iter()
            .filter(|(_, family, row)| family.is_none() && row.is_some())
            .count()
    );
}

#[test]
fn pass_only_observes_all_exhaustion_and_releases_every_family_to_shared() {
    for side in [Side::White, Side::Black] {
        let mut oracle = Fake::new(|_, _, _| vec![]);
        let generation = generate_with_runtime(&view(side), &mut oracle).unwrap();
        check(&generation, &oracle, side);
        let d = &generation.batch.diagnostics;
        assert_eq!(generation.batch.candidates.len(), 1);
        assert_eq!(generation.batch.candidates[0].key, "[]");
        assert_eq!(d.attempted_extensions, 0);
        assert_eq!(generation.runtime.availability_pulls, 7);
        assert_eq!(generation.runtime.cursor_pulls, 8);
        assert_eq!(generation.runtime.peak_live_nodes, 8);
        assert_eq!(d.exhausted_lanes.len(), 8);
        assert_eq!(d.pools[7].initial_capacity, 511);
        assert_eq!(d.pools[7].final_capacity, 511);
    }
}

#[test]
fn one_classical_tiny_domain_has_exact_keys_diagnostics_runtime_and_lane_order() {
    for side in [Side::White, Side::Black] {
        let action = c(side, 1);
        let expected = action.clone();
        let mut oracle = Fake::new(move |prefix, family, _| {
            if prefix.is_empty() && (family.is_none() || family == Some(ActionKind::Classical)) {
                vec![row(action.clone())]
            } else {
                vec![]
            }
        });
        let g = generate_with_runtime(&view(side), &mut oracle).unwrap();
        check(&g, &oracle, side);
        assert_eq!(
            g.batch
                .candidates
                .iter()
                .map(|candidate| candidate.key.clone())
                .collect::<Vec<_>>(),
            ["[]".to_owned(), canonical_actions_key(&[expected])]
        );
        let d = &g.batch.diagnostics;
        assert_eq!(
            (
                d.attempted_extensions,
                d.retained_non_pass,
                d.duplicates,
                d.owner_skipped,
                d.quota_skipped
            ),
            (8, 1, 0, 7, 0)
        );
        assert_eq!(d.active_families, [ActionKind::Classical]);
        assert_eq!(
            d.pools
                .iter()
                .map(|pool| pool.initial_capacity)
                .collect::<Vec<_>>(),
            [336, 0, 0, 0, 0, 0, 0, 175]
        );
        assert_eq!(
            d.pools
                .iter()
                .map(|pool| pool.final_capacity)
                .collect::<Vec<_>>(),
            [1, 0, 0, 0, 0, 0, 0, 510]
        );
        assert_eq!(d.retained_by_length["1"], 1);
        assert_eq!(g.runtime.continuation_nodes, 8);
        assert_eq!(g.runtime.domain_cursors, 16);
        assert_eq!(g.runtime.cursor_pulls, 24);
        assert_eq!(g.runtime.availability_pulls, 7);
        assert_eq!(g.runtime.peak_live_nodes, 16);
        assert_eq!(g.runtime.maximum_queue_length, 1);
        assert!(
            oracle
                .starts
                .iter()
                .skip(7)
                .all(|(_, family)| family.is_none())
        );
    }
}

#[test]
fn exhaustive_binary_tree_retains_all_queues_without_changing_array_identity() {
    let side = Side::White;
    let mut oracle = Fake::new(move |prefix, family, _| {
        if family.is_some_and(|kind| kind != ActionKind::Classical) || prefix.len() >= 4 {
            vec![]
        } else {
            vec![row(c(side, 1)), row(c(side, 2))]
        }
    });
    let g = generate_with_runtime(&view(side), &mut oracle).unwrap();
    check(&g, &oracle, side);
    let mut expected = vec!["[]".to_owned()];
    for length in 1..=4 {
        for bits in 0..1 << length {
            let queue: Vec<_> = (0..length)
                .map(|bit| c(side, 1 + ((bits >> bit) & 1)))
                .collect();
            expected.push(canonical_actions_key(&queue));
        }
    }
    expected.sort();
    assert_eq!(
        g.batch
            .candidates
            .iter()
            .map(|candidate| candidate.key.clone())
            .collect::<Vec<_>>(),
        expected
    );
    assert_eq!(g.batch.diagnostics.retained_non_pass, 30);
    assert_eq!(g.batch.diagnostics.attempted_extensions, 240);
    assert_eq!(g.batch.diagnostics.duplicates, 28);
    assert_eq!(g.batch.diagnostics.owner_skipped, 182);
    assert_eq!(g.batch.diagnostics.quota_skipped, 0);
    assert_eq!(g.runtime.continuation_nodes, 112);
    assert_eq!(g.runtime.cursor_pulls, 360);
    assert_eq!(g.runtime.maximum_queue_length, 4);
    let yielded: Vec<_> = oracle
        .visits
        .iter()
        .filter_map(|(prefix, family, row)| {
            (family.is_none() && row.is_some()).then_some(prefix.clone())
        })
        .collect();
    let a = c(side, 1);
    let b = c(side, 2);
    let expected_prefixes = [
        vec![],
        vec![a.clone()],
        vec![a.clone(), a.clone()],
        vec![a.clone(), a.clone(), a.clone()],
        vec![],
        vec![a.clone()],
        vec![a.clone(), a.clone()],
        vec![a.clone(), a.clone(), a],
        vec![b],
    ];
    for (round, expected) in expected_prefixes.iter().enumerate() {
        assert_eq!(
            &yielded[round * 8..(round + 1) * 8],
            vec![expected.clone(); 8]
        );
    }
}

#[test]
fn continuations_survive_owner_duplicate_and_quota_skips_and_accumulate_native_costs() {
    let side = Side::Black;
    let mut oracle = Fake::new(move |prefix, family, _| {
        if let Some(family) = family {
            return if family == ActionKind::Classical || family == ActionKind::Deploy {
                vec![row(special(side, family, 1))]
            } else {
                vec![]
            };
        }
        if prefix.is_empty() {
            let mut row = row(Action::Deploy {
                timing: SpecialTiming::B,
                color: side,
                from: sq("a1"),
                to: sq("a2"),
                unit: SpawnPiece::Pawn,
            });
            row.cost = Spend {
                minerals: 2,
                gas: 1,
            };
            vec![row]
        } else if prefix.len() == 1 {
            let mut row = row(Action::Classical {
                timing: ClassicalTiming::C,
                color: side,
                from: sq("a2"),
                to: sq("a3"),
                promotion: None,
            });
            row.cost = Spend {
                minerals: 1,
                gas: 1,
            };
            vec![row]
        } else {
            vec![]
        }
    });
    let g = generate_with_runtime(&view(side), &mut oracle).unwrap();
    check(&g, &oracle, side);
    let candidate = g
        .batch
        .candidates
        .iter()
        .find(|candidate| candidate.actions.len() == 2)
        .unwrap();
    assert_eq!(candidate.actions[0].kind(), ActionKind::Deploy);
    assert_eq!(
        candidate.own_spend,
        Spend {
            minerals: 3,
            gas: 2
        }
    );
    assert_eq!(g.runtime.continuation_nodes, 16);
    assert!(g.batch.diagnostics.owner_skipped > 0);
    assert!(g.batch.diagnostics.duplicates > 0);
    assert_eq!(
        g.batch.diagnostics.retained_by_owner[&ActionKind::Deploy],
        2
    );
}

#[test]
fn attempt_cap_does_not_pull_2049_or_mark_unobserved_exhaustion() {
    let side = Side::White;
    let mut oracle = Fake::new(move |prefix, family, _| {
        if family.is_some() {
            return if family == Some(ActionKind::Classical) {
                vec![row(c(side, 1))]
            } else {
                vec![]
            };
        }
        if prefix.is_empty() {
            vec![row(c(side, 1)); 2049]
        } else {
            vec![]
        }
    });
    let g = generate_with_runtime(&view(side), &mut oracle).unwrap();
    check(&g, &oracle, side);
    assert_eq!(g.batch.diagnostics.attempted_extensions, 2048);
    assert_eq!(g.batch.diagnostics.stop_reason, StopReason::AttemptCap);
    assert!(!g.batch.diagnostics.pools[0].exhausted);
    assert_eq!(g.batch.candidates.len(), 2);
    assert!(g.batch.diagnostics.duplicates > 0);
    assert!(g.runtime.domain_cursors <= 2056);
}

#[test]
fn complete_domains_cover_all_lanes_and_continue_after_quota_skips() {
    let side = Side::White;
    let mut oracle = Fake::new(move |prefix, family, _| {
        if let Some(kind) = family {
            return vec![row(special(side, kind, 1))];
        }
        if prefix.is_empty() {
            (1..600).map(|i| row(c(side, i))).collect()
        } else if prefix.len() == 1 {
            (1..100)
                .map(|i| row(special(side, ActionKind::TacticalJump, i)))
                .collect()
        } else {
            vec![]
        }
    });
    let g = generate_with_runtime(&view(side), &mut oracle).unwrap();
    check(&g, &oracle, side);
    assert!(g.batch.diagnostics.quota_skipped > 0);
    assert!(g.batch.diagnostics.owner_skipped > 0);
    assert!(g.batch.diagnostics.duplicates > 0);
    assert!(g.batch.candidates.len() <= 512);
    assert!(g.runtime.continuation_nodes > g.batch.diagnostics.retained_non_pass);
}

#[test]
fn quota_skipped_prefixes_open_their_continuations_before_exhaustion() {
    let side = Side::White;
    let mut oracle = Fake::new(move |prefix, family, lane| {
        if let Some(kind) = family {
            return if kind == ActionKind::Classical {
                vec![row(c(side, 1))]
            } else {
                vec![]
            };
        }
        if !prefix.is_empty() {
            return vec![];
        }
        if lane == 0 {
            return (1..=600).map(|index| row(c(side, index))).collect();
        }
        if lane == 7 {
            let mut rejected = row(c(side, 1));
            rejected.native_failure = Some(KnownAppendFailure::Actor);
            return vec![rejected; 2049];
        }
        vec![]
    });
    let g = generate_with_runtime(&view(side), &mut oracle).unwrap();
    check(&g, &oracle, side);
    assert_eq!(g.batch.diagnostics.quota_skipped, 264);
    assert_eq!(g.batch.diagnostics.retained_non_pass, 336);
    assert_eq!(g.runtime.continuation_nodes, 600);
    let skipped = vec![c(side, 337)];
    assert!(
        !g.batch
            .candidates
            .iter()
            .any(|candidate| candidate.key == canonical_actions_key(&skipped))
    );
    assert!(oracle.starts.contains(&(skipped, None)));
}

#[test]
fn simultaneous_caps_give_capacity_precedence_without_consuming_attempt_2049() {
    let side = Side::White;
    let mut oracle = Fake::new(move |prefix, family, lane| {
        if let Some(kind) = family {
            return if kind == ActionKind::Classical {
                vec![row(c(side, 1))]
            } else {
                vec![]
            };
        }
        if prefix.is_empty() && lane == 0 {
            let mut rows = vec![row(c(side, 1)); 1538];
            rows.extend((2..=511).map(|index| row(c(side, index))));
            rows.push(row(c(side, 512)));
            rows
        } else {
            vec![]
        }
    });
    let g = generate_with_runtime(&view(side), &mut oracle).unwrap();
    check(&g, &oracle, side);
    let d = &g.batch.diagnostics;
    assert_eq!(d.attempted_extensions, 2048);
    assert_eq!(d.unique_including_pass, 512);
    assert_eq!(d.retained_non_pass, 511);
    assert_eq!(d.duplicates, 1537);
    assert_eq!(d.owner_skipped, 0);
    assert_eq!(d.quota_skipped, 0);
    assert!(d.attempt_cap_reached && d.capacity_cap_reached);
    assert_eq!(d.stop_reason, StopReason::CapacityCap);
    assert_eq!(d.pools[0].final_capacity, 511);
    assert_eq!(g.runtime.domain_cursors, 2056);
    assert!(!d.pools[0].exhausted);
    assert!(
        !g.batch
            .candidates
            .iter()
            .any(|candidate| candidate.key == canonical_actions_key(&[c(side, 512)]))
    );
}

#[test]
fn availability_probes_do_not_consume_the_append_budget_or_pull_after_first_success() {
    let side = Side::White;
    let mut oracle = Fake::new(move |prefix, family, _| {
        if family == Some(ActionKind::Classical) {
            let mut rejected = row(c(side, 1));
            rejected.native_failure = Some(KnownAppendFailure::Actor);
            let mut rows = vec![rejected; 2100];
            rows.push(row(c(side, 2)));
            rows.push(row(c(side, 3)));
            rows
        } else if family.is_some() {
            vec![]
        } else if prefix.is_empty() {
            vec![row(c(side, 2))]
        } else {
            vec![]
        }
    });
    let g = generate_with_runtime(&view(side), &mut oracle).unwrap();
    check(&g, &oracle, side);
    assert_eq!(g.runtime.availability_pulls, 2107);
    assert_eq!(g.runtime.append_attempts, 8);
    assert_eq!(g.batch.diagnostics.active_families, [ActionKind::Classical]);
    assert_eq!(g.batch.diagnostics.pruned[&PruningReason::Actor], 0);
    assert_eq!(g.batch.diagnostics.stop_reason, StopReason::Exhausted);
}

#[test]
fn own_mine_occupancy_and_prefix_entity_cap_are_distinct_pruning_reasons() {
    let side = Side::White;
    let mut occupied_view = view(side);
    occupied_view.own.mines = vec![sq("a1")];
    let mut oracle = Fake::new(move |prefix, family, _| {
        if prefix.is_empty() && (family.is_none() || family == Some(ActionKind::SpiderMine)) {
            vec![row(special(side, ActionKind::SpiderMine, 0))]
        } else {
            vec![]
        }
    });
    let g = generate_with_runtime(&occupied_view, &mut oracle).unwrap();
    assert_eq!(g.batch.diagnostics.pruned[&PruningReason::OwnOccupancy], 8);
    assert_eq!(g.batch.diagnostics.pruned[&PruningReason::MineCap], 0);
    let mut oracle = Fake::new(move |prefix, family, _| {
        if family.is_some_and(|kind| kind != ActionKind::SpiderMine) {
            return vec![];
        }
        let mut mine = row(special(side, ActionKind::SpiderMine, prefix.len() * 64));
        mine.anchor = Some(all_squares()[prefix.len() + 1]);
        vec![mine]
    });
    let g = generate_with_runtime(&occupied_view, &mut oracle).unwrap();
    check(&g, &oracle, side);
    assert_eq!(g.batch.diagnostics.pruned[&PruningReason::MineCap], 8);
    assert_eq!(g.batch.diagnostics.pruned[&PruningReason::OwnOccupancy], 0);
    assert_eq!(g.runtime.maximum_queue_length, 2);
}

#[test]
fn early_shared_exhaustion_and_later_family_release_fund_the_last_family() {
    let side = Side::White;
    let mut oracle = Fake::new(move |prefix, family, lane| {
        if let Some(kind) = family {
            return if kind == ActionKind::Classical || kind == ActionKind::TacticalJump {
                vec![row(special(side, kind, 1))]
            } else {
                vec![]
            };
        }
        if prefix.is_empty() {
            if lane == 0 {
                vec![row(c(side, 1)), row(c(side, 2)), row(c(side, 3))]
            } else if lane == 6 {
                (1..600)
                    .map(|i| row(special(side, ActionKind::TacticalJump, i)))
                    .collect()
            } else {
                vec![]
            }
        } else if prefix[0].kind() == ActionKind::TacticalJump && prefix.len() == 1 {
            (1..10).map(|i| row(c(side, i))).collect()
        } else {
            vec![]
        }
    });
    let g = generate_with_runtime(&view(side), &mut oracle).unwrap();
    check(&g, &oracle, side);
    assert_eq!(g.batch.diagnostics.stop_reason, StopReason::CapacityCap);
    assert_eq!(
        g.batch
            .diagnostics
            .pools
            .iter()
            .map(|pool| pool.initial_capacity)
            .collect::<Vec<_>>(),
        [168, 0, 0, 0, 0, 0, 168, 175]
    );
    assert_eq!(
        g.batch
            .diagnostics
            .pools
            .iter()
            .map(|pool| pool.final_capacity)
            .collect::<Vec<_>>(),
        [3, 0, 0, 0, 0, 0, 508, 0]
    );
    assert_eq!(
        g.batch.diagnostics.retained_by_owner[&ActionKind::Classical],
        3
    );
    assert_eq!(
        g.batch.diagnostics.retained_by_owner[&ActionKind::TacticalJump],
        508
    );
}

#[test]
fn mine_entities_count_duplicates_and_resources_precede_cap_and_occupancy() {
    for mines in [vec![sq("a1"); 3], vec![sq("a1"), sq("a1"), sq("b1")]] {
        for gas in [0, 3] {
            let mut view = view(Side::White);
            view.own.mines = mines.clone();
            view.own.gas = gas;
            let mut oracle = Fake::new(|prefix, family, _| {
                if prefix.is_empty() && (family.is_none() || family == Some(ActionKind::SpiderMine))
                {
                    let mut row = row(special(Side::White, ActionKind::SpiderMine, 0));
                    row.cost.gas = 1;
                    vec![row]
                } else {
                    vec![]
                }
            });
            let g = generate_with_runtime(&view, &mut oracle).unwrap();
            check(&g, &oracle, view.side);
            let reason = if gas == 0 {
                PruningReason::Resources
            } else {
                PruningReason::MineCap
            };
            assert_eq!(g.batch.diagnostics.pruned[&reason], 8);
            assert_eq!(g.batch.candidates.len(), 1);
        }
    }
}

#[test]
fn f_mines_keep_their_original_append_anchor_after_later_native_rewrites() {
    let side = Side::White;
    let mut oracle = Fake::new(move |prefix, family, _| {
        if let Some(kind) = family {
            return if kind == ActionKind::SpiderMine {
                vec![row(special(side, kind, 0))]
            } else {
                vec![]
            };
        }
        match prefix.len() {
            0 => {
                let mut mine = row(special(side, ActionKind::SpiderMine, 0));
                mine.anchor = Some(sq("b2"));
                vec![mine]
            }
            1 => vec![row(c(side, 2))],
            2 => {
                let mut mine = row(special(side, ActionKind::SpiderMine, 64));
                mine.anchor = Some(sq("b2"));
                vec![mine]
            }
            _ => vec![],
        }
    });
    let g = generate_with_runtime(&view(side), &mut oracle).unwrap();
    check(&g, &oracle, side);
    assert_eq!(g.batch.diagnostics.pruned[&PruningReason::OwnOccupancy], 8);
    assert!(
        g.batch
            .candidates
            .iter()
            .all(|candidate| candidate.actions.len() <= 2)
    );
}

#[test]
fn checked_costs_preserve_native_actor_shape_timing_priority() {
    for failure in [
        KnownAppendFailure::Actor,
        KnownAppendFailure::Shape,
        KnownAppendFailure::Timing,
        KnownAppendFailure::MineCap,
        KnownAppendFailure::OwnOccupancy,
    ] {
        let mut oracle = Fake::new(move |prefix, family, _| {
            if prefix.is_empty() && (family.is_none() || family == Some(ActionKind::Classical)) {
                let mut row = row(c(Side::White, 1));
                row.cost = Spend {
                    minerals: u32::MAX,
                    gas: u32::MAX,
                };
                row.native_failure = Some(failure);
                vec![row]
            } else {
                vec![]
            }
        });
        let g = generate_with_runtime(&view(Side::White), &mut oracle).unwrap();
        let expected = match failure {
            KnownAppendFailure::Actor => PruningReason::Actor,
            KnownAppendFailure::Shape => PruningReason::Shape,
            KnownAppendFailure::Timing => PruningReason::Timing,
            _ => PruningReason::Resources,
        };
        assert_eq!(g.batch.diagnostics.pruned[&expected], 8);
    }
    let mut oracle = Fake::new(|prefix, family, _| {
        if family.is_some_and(|kind| kind != ActionKind::Classical) {
            return vec![];
        }
        let mut row = row(c(Side::White, 1));
        row.cost.minerals = if prefix.is_empty() { 1 } else { u32::MAX };
        vec![row]
    });
    let g = generate_with_runtime(&view(Side::White), &mut oracle).unwrap();
    assert_eq!(g.batch.diagnostics.pruned[&PruningReason::Resources], 8);
    assert_eq!(g.batch.candidates.len(), 2);
}

#[test]
fn invalid_views_never_open_and_all_oracle_errors_close_without_fallback() {
    let mut invalid = view(Side::White);
    invalid.turn = 46;
    let mut oracle = Fake::new(|_, _, _| vec![]);
    assert!(generate(&invalid, &mut oracle).is_err());
    assert_eq!(oracle.opens, 0);
    assert!(oracle.closes.is_empty());
    for fault in ["open", "planning", "next", "zero", "reuse", "short", "long"] {
        let mut oracle = Fake::new(|_, _, _| vec![]);
        oracle.fault = Some(fault);
        let error = generate(&view(Side::White), &mut oracle).unwrap_err();
        if fault == "open" {
            assert!(oracle.closes.is_empty());
        } else if fault == "planning" {
            assert_eq!(oracle.closes, [0]);
        } else {
            assert_eq!(oracle.closes, [11]);
        }
        if fault == "next" {
            assert_eq!(error, "MemoryLimit");
        }
    }
    let mut oracle = Fake::new(|_, _, _| vec![]);
    oracle.close_error = true;
    assert!(
        generate(&view(Side::White), &mut oracle)
            .unwrap_err()
            .contains("cleanup error")
    );
    let mut oracle = Fake::new(|_, _, _| vec![]);
    oracle.fault = Some("next");
    oracle.close_error = true;
    let error = generate(&view(Side::White), &mut oracle).unwrap_err();
    assert!(error.contains("MemoryLimit"));
    assert!(error.contains("cleanup error"));
}

#[test]
fn wrong_color_family_missing_anchor_and_resume_mismatch_abort_the_context() {
    let mut oracle = Fake::new(|_, _, _| vec![row(c(Side::Black, 1))]);
    assert!(
        generate(&view(Side::White), &mut oracle)
            .unwrap_err()
            .contains("color")
    );
    assert_eq!(oracle.closes, [11]);
    let mut oracle = Fake::new(|_, _, _| vec![row(c(Side::White, 1))]);
    assert!(
        generate(&view(Side::White), &mut oracle)
            .unwrap_err()
            .contains("family")
    );
    let mut oracle = Fake::new(|_, _, _| {
        let mut row = row(c(Side::White, 1));
        row.anchor = None;
        vec![row]
    });
    assert!(
        generate(&view(Side::White), &mut oracle)
            .unwrap_err()
            .contains("anchor")
    );
    let mut oracle = Fake::new(|prefix, family, _| {
        if prefix.is_empty() && (family.is_none() || family == Some(ActionKind::Classical)) {
            vec![row(c(Side::White, 1))]
        } else {
            vec![]
        }
    });
    oracle.fault = Some("resume");
    assert!(
        generate(&view(Side::White), &mut oracle)
            .unwrap_err()
            .contains("resume cursor")
    );
    assert_eq!(oracle.closes, [11]);
}

#[test]
fn native_fixtures_match_the_legacy_public_v3_export_and_runtime() {
    native::assert_parity();
}
