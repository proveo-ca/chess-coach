// SPEC: _spec/apps/arena/burn-compat.puml
use training_native::feature_input::{FeatureInput, FeatureInputPair};
use training_native::ledger::LedgerWork;
use training_native::ledger::contracts::{
    ContractResult, EconomicBoundary, LedgerRules, Pair, Side,
};

#[allow(dead_code)]
fn fold_supplied_boundaries(
    rules: LedgerRules,
    initial: &Pair<EconomicBoundary>,
    opened: &Pair<EconomicBoundary>,
    settled: &Pair<EconomicBoundary>,
    work: &mut LedgerWork,
) -> ContractResult<Pair<FeatureInput>> {
    let mut pair = FeatureInputPair::initialize(rules, initial, work)?;
    pair.advance(opened, work)?;
    pair.advance(settled, work)?;
    let w = pair.input(Side::White, work)?;
    let b = pair.input(Side::Black, work)?;
    Ok(Pair { w, b })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;
    use training_native::ledger::contracts::BoundaryPhase;

    #[derive(Deserialize)]
    struct Boundaries {
        initial: Pair<EconomicBoundary>,
        settled: Pair<EconomicBoundary>,
        expected: Pair<Expected>,
    }

    #[derive(Deserialize)]
    struct Expected {
        values: [u32; 3],
        bins: [u8; 3],
    }

    #[derive(Deserialize)]
    struct NativeRules {
        rules: LedgerRules,
    }

    #[test]
    fn supplied_pairs_fold_on_one_caller_meter() {
        let boundaries: Boundaries = serde_json::from_str(include_str!(
            "../../../packages/training/tests/fixtures/feature-input-boundaries.json"
        ))
        .unwrap();
        let rules: NativeRules = serde_json::from_str(include_str!(
            "../../../packages/training/tests/fixtures/ledger-boundaries.json"
        ))
        .unwrap();
        let opened = {
            let make = |before: &EconomicBoundary| {
                let mut next = before.clone();
                next.ordinal += 1;
                next.phase = BoundaryPhase::TurnOpen;
                next.seq_before = before.seq_through;
                next.groups.clear();
                next.snapshot.own.gas = next.snapshot.own.gas_income;
                next
            };
            Pair {
                w: make(&boundaries.initial.w),
                b: make(&boundaries.initial.b),
            }
        };
        let mut work = LedgerWork::new();
        let mut direct_work = LedgerWork::new();
        let mut direct = FeatureInputPair::initialize(
            rules.rules.clone(),
            &boundaries.initial,
            &mut direct_work,
        )
        .unwrap();
        direct.advance(&opened, &mut direct_work).unwrap();
        direct
            .advance(&boundaries.settled, &mut direct_work)
            .unwrap();
        let direct_result = Pair {
            w: direct.input(Side::White, &mut direct_work).unwrap(),
            b: direct.input(Side::Black, &mut direct_work).unwrap(),
        };
        let result = fold_supplied_boundaries(
            rules.rules,
            &boundaries.initial,
            &opened,
            &boundaries.settled,
            &mut work,
        )
        .unwrap();

        assert_eq!(result, direct_result);
        assert_eq!(work.used(), direct_work.used());
        for (side, input, expected) in [
            (Side::White, result.w, boundaries.expected.w),
            (Side::Black, result.b, boundaries.expected.b),
        ] {
            let boundary = boundaries.settled.get(side);
            assert_eq!(input.view.side, side);
            assert_eq!(input.stamp.phase, BoundaryPhase::Settled);
            assert_eq!(input.stamp.ordinal, boundary.ordinal);
            assert_eq!(input.stamp.turn, boundary.turn);
            assert_eq!(input.stamp.grant_ordinal, boundary.grant_ordinal);
            assert_eq!(input.innovation.values, expected.values);
            assert_eq!(input.innovation.bins, expected.bins);
        }
        assert!(work.used() > 0);
        assert!(work.used() <= work.limit());
        assert_eq!(work.used() + work.remaining(), work.limit());
    }
}
