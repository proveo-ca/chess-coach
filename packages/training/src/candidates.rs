// SPEC: _spec/packages/training/burn-compat.puml
use std::collections::{BTreeMap, BTreeSet, VecDeque};

use serde::{Deserialize, Serialize};

use crate::contracts::*;

const LANES: usize = 8;
const SHARED: usize = 7;
const MAX_CURSORS: usize = 7 + LANES + MAX_ATTEMPTED_EXTENSIONS;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RuntimeCounters {
    pub roots: u32,
    pub continuation_nodes: u32,
    pub peak_live_nodes: u32,
    pub domain_cursors: u32,
    pub cursor_pulls: u32,
    pub availability_pulls: u32,
    pub append_attempts: u32,
    pub maximum_queue_length: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Generation {
    pub batch: CandidateBatch,
    pub runtime: RuntimeCounters,
}

#[derive(Clone, Default)]
struct Prefix {
    actions: Vec<Action>,
    spend: Spend,
    anchors: Vec<Square>,
    mine_anchors: Vec<Square>,
}

struct Node {
    state: Prefix,
    cursor: Option<CursorId>,
}

impl Node {
    fn new(state: Prefix) -> Self {
        Self {
            state,
            cursor: None,
        }
    }
}

struct Lane {
    frontiers: [VecDeque<Node>; MAX_GENERATED_ACTIONS],
    depth_cursor: usize,
}

impl Lane {
    fn new() -> Self {
        let mut frontiers = std::array::from_fn(|_| VecDeque::new());
        frontiers[0].push_back(Node::new(Prefix::default()));
        Self {
            frontiers,
            depth_cursor: 0,
        }
    }
}

struct Domains<'a, O> {
    oracle: &'a mut O,
    planning: PlanningId,
    cursors: BTreeSet<CursorId>,
}

impl<O: PlanningOracle> Domains<'_, O> {
    fn pull(
        &mut self,
        node: &mut Node,
        family: Option<ActionKind>,
    ) -> ContractResult<Option<PrimitiveProposal>> {
        let pull = match node.cursor {
            Some(cursor) => CursorPull::Resume { cursor },
            None => {
                if self.cursors.len() >= MAX_CURSORS {
                    return Err("Planning cursor creation exceeds 2063".into());
                }
                CursorPull::Start {
                    prefix: node.state.actions.clone(),
                    family,
                }
            }
        };
        let mut steps = self.oracle.next(self.planning, &[pull])?;
        if steps.len() != 1 {
            return Err("Planning oracle must return exactly one ordered step per pull".into());
        }
        let step = steps.pop().expect("One planning step");
        if step.cursor == 0 {
            return Err("Planning oracle returned a zero cursor".into());
        }
        match node.cursor {
            Some(cursor) if cursor != step.cursor => {
                return Err("Planning oracle returned a mismatched resume cursor".into());
            }
            None => {
                if !self.cursors.insert(step.cursor) {
                    return Err("Planning oracle reused a cursor identity".into());
                }
                node.cursor = Some(step.cursor);
            }
            _ => {}
        }
        if let (Some(family), Some(proposal)) = (family, &step.proposal)
            && proposal.action.kind() != family
        {
            return Err(
                "Planning oracle returned an action outside its availability family".into(),
            );
        }
        Ok(step.proposal)
    }
}

fn append(
    view: &AuthorizedView,
    prefix: &Prefix,
    row: PrimitiveProposal,
) -> ContractResult<Result<Prefix, PruningReason>> {
    row.action.validate_for(view.side)?;
    if row.native_failure.is_none() && row.anchor.is_none() {
        return Err("Successful planning proposal requires an append-time anchor".into());
    }
    let native = match row.native_failure {
        Some(KnownAppendFailure::Actor) => Some(PruningReason::Actor),
        Some(KnownAppendFailure::Shape) => Some(PruningReason::Shape),
        Some(KnownAppendFailure::Timing) => Some(PruningReason::Timing),
        Some(KnownAppendFailure::MineCap) => Some(PruningReason::MineCap),
        Some(KnownAppendFailure::OwnOccupancy) => Some(PruningReason::OwnOccupancy),
        None => None,
    };
    if matches!(
        native,
        Some(PruningReason::Actor | PruningReason::Shape | PruningReason::Timing)
    ) {
        return Ok(Err(native.expect("Native early failure")));
    }
    let spend = match (
        prefix.spend.minerals.checked_add(row.cost.minerals),
        prefix.spend.gas.checked_add(row.cost.gas),
    ) {
        (Some(minerals), Some(gas)) if minerals <= view.own.minerals && gas <= view.own.gas => {
            Spend { minerals, gas }
        }
        _ => return Ok(Err(PruningReason::Resources)),
    };
    if row.action.kind() == ActionKind::SpiderMine {
        if view.own.mines.len() + prefix.mine_anchors.len() >= MAX_MINES_PER_SIDE {
            return Ok(Err(PruningReason::MineCap));
        }
        let anchor = row
            .anchor
            .ok_or("Planning proposal requires an append-time anchor")?;
        if view.own.mines.contains(&anchor) || prefix.mine_anchors.contains(&anchor) {
            return Ok(Err(PruningReason::OwnOccupancy));
        }
    }
    if let Some(reason) = native {
        return Ok(Err(reason));
    }
    let anchor = row
        .anchor
        .ok_or("Successful planning proposal requires an append-time anchor")?;
    let mut child = prefix.clone();
    child.spend = spend;
    child.anchors.push(anchor);
    if row.action.kind() == ActionKind::SpiderMine {
        child.mine_anchors.push(anchor);
    }
    child.actions.push(row.action);
    Ok(Ok(child))
}

fn diagnostics(active_families: Vec<ActionKind>) -> CandidateDiagnostics {
    let mut pools: Vec<_> = ACTION_KINDS
        .into_iter()
        .map(CandidateLane::from_kind)
        .chain([CandidateLane::SharedComposition])
        .map(|id| CandidatePool {
            id,
            initial_capacity: if id == CandidateLane::SharedComposition {
                (MAX_RETAINED_CANDIDATES - 1 - 7 * 48) as u32
            } else if active_families.contains(&id.kind().expect("Family lane")) {
                48
            } else {
                0
            },
            final_capacity: 0,
            retained: 0,
            exhausted: false,
        })
        .collect();
    let released = (ACTION_KINDS.len() - active_families.len()) * 48;
    if active_families.is_empty() {
        pools[SHARED].initial_capacity += released as u32;
    } else {
        for i in 0..released {
            let id = CandidateLane::from_kind(active_families[i % active_families.len()]);
            pools
                .iter_mut()
                .find(|pool| pool.id == id)
                .expect("Family pool")
                .initial_capacity += 1;
        }
    }
    for pool in &mut pools {
        pool.final_capacity = pool.initial_capacity;
    }
    CandidateDiagnostics {
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
        active_families,
        exhausted_lanes: vec![],
        pools,
        retained_by_owner: ACTION_KINDS.into_iter().map(|kind| (kind, 0)).collect(),
        retained_by_length: (1..=MAX_GENERATED_ACTIONS)
            .map(|length| (length.to_string(), 0))
            .collect(),
        attempt_cap_reached: false,
        capacity_cap_reached: false,
        stop_reason: StopReason::Exhausted,
    }
}

fn prove_exhausted(d: &mut CandidateDiagnostics, index: usize) {
    d.pools[index].exhausted = true;
    let unused = d.pools[index].final_capacity - d.pools[index].retained;
    if index < SHARED {
        d.pools[index].final_capacity -= unused;
        d.pools[SHARED].final_capacity += unused;
    }
    if d.pools[SHARED].exhausted {
        let recipients: Vec<_> = (0..SHARED).filter(|i| !d.pools[*i].exhausted).collect();
        if !recipients.is_empty() {
            let spare = d.pools[SHARED].final_capacity - d.pools[SHARED].retained;
            d.pools[SHARED].final_capacity -= spare;
            for i in 0..spare as usize {
                d.pools[recipients[i % recipients.len()]].final_capacity += 1;
            }
        }
    }
}

fn compose<O: PlanningOracle>(
    view: &AuthorizedView,
    domains: &mut Domains<'_, O>,
) -> ContractResult<Generation> {
    let mut runtime = RuntimeCounters {
        roots: LANES as u32,
        continuation_nodes: 0,
        peak_live_nodes: LANES as u32,
        domain_cursors: LANES as u32,
        cursor_pulls: 0,
        availability_pulls: 0,
        append_attempts: 0,
        maximum_queue_length: 0,
    };
    let mut active = Vec::new();
    for kind in ACTION_KINDS {
        let mut node = Node::new(Prefix::default());
        loop {
            runtime.availability_pulls = runtime
                .availability_pulls
                .checked_add(1)
                .ok_or("Availability pull counter overflow")?;
            let Some(row) = domains.pull(&mut node, Some(kind))? else {
                break;
            };
            if append(view, &node.state, row)?.is_ok() {
                active.push(kind);
                break;
            }
        }
    }
    let mut d = diagnostics(active);
    let mut lanes: [Lane; LANES] = std::array::from_fn(|_| Lane::new());
    let pass = Candidate::new(vec![], Spend::default(), view.side)?;
    let mut retained = BTreeMap::from([(pass.key.clone(), pass)]);
    let mut live = LANES as u32;
    while d.attempted_extensions < MAX_ATTEMPTED_EXTENSIONS as u32
        && d.unique_including_pass < MAX_RETAINED_CANDIDATES as u32
        && d.pools.iter().any(|pool| !pool.exhausted)
    {
        for (index, lane) in lanes.iter_mut().enumerate() {
            if d.attempted_extensions == MAX_ATTEMPTED_EXTENSIONS as u32
                || d.unique_including_pass == MAX_RETAINED_CANDIDATES as u32
            {
                break;
            }
            if d.pools[index].exhausted {
                continue;
            }
            let mut attempt = None;
            for offset in 0..MAX_GENERATED_ACTIONS {
                let depth = (lane.depth_cursor + offset) % MAX_GENERATED_ACTIONS;
                let frontier = &mut lane.frontiers[depth];
                while let Some(node) = frontier.front_mut() {
                    runtime.cursor_pulls += 1;
                    if let Some(row) = domains.pull(node, None)? {
                        attempt = Some((depth, node.state.clone(), row));
                        break;
                    }
                    frontier.pop_front();
                    live -= 1;
                }
                if attempt.is_some() {
                    break;
                }
            }
            let Some((depth, state, row)) = attempt else {
                prove_exhausted(&mut d, index);
                continue;
            };
            d.attempted_extensions += 1;
            runtime.append_attempts += 1;
            lane.depth_cursor = (depth + 1) % MAX_GENERATED_ACTIONS;
            let child = match append(view, &state, row)? {
                Ok(child) => child,
                Err(reason) => {
                    *d.pruned.get_mut(&reason).expect("Closed pruning reason") += 1;
                    continue;
                }
            };
            let length = child.actions.len();
            runtime.maximum_queue_length = runtime.maximum_queue_length.max(length as u32);
            if length < MAX_GENERATED_ACTIONS {
                lane.frontiers[length].push_back(Node::new(child.clone()));
                runtime.continuation_nodes += 1;
                runtime.domain_cursors += 1;
                live += 1;
                runtime.peak_live_nodes = runtime.peak_live_nodes.max(live);
            }
            let owner = child.actions[0].kind();
            if if index == SHARED {
                length < 2
            } else {
                Some(owner) != d.pools[index].id.kind()
            } {
                d.owner_skipped += 1;
                continue;
            }
            let candidate = Candidate::new(child.actions, child.spend, view.side)?;
            if retained.contains_key(&candidate.key) {
                d.duplicates += 1;
                continue;
            }
            if d.pools[index].retained == d.pools[index].final_capacity {
                d.quota_skipped += 1;
                continue;
            }
            retained.insert(candidate.key.clone(), candidate);
            d.pools[index].retained += 1;
            d.retained_non_pass += 1;
            d.unique_including_pass += 1;
            *d.retained_by_owner.get_mut(&owner).expect("Known owner") += 1;
            *d.retained_by_length
                .get_mut(&length.to_string())
                .expect("Bounded candidate length") += 1;
        }
    }
    d.exhausted_lanes = d
        .pools
        .iter()
        .filter(|pool| pool.exhausted)
        .map(|pool| pool.id)
        .collect();
    d.attempt_cap_reached = d.attempted_extensions == MAX_ATTEMPTED_EXTENSIONS as u32;
    d.capacity_cap_reached = d.unique_including_pass == MAX_RETAINED_CANDIDATES as u32;
    d.stop_reason = if d.capacity_cap_reached {
        StopReason::CapacityCap
    } else if d.attempt_cap_reached {
        StopReason::AttemptCap
    } else {
        StopReason::Exhausted
    };
    let batch = CandidateBatch {
        version: CompositionVersion::V1,
        candidates: retained.into_values().collect(),
        diagnostics: d,
    };
    batch.validate(view.side)?;
    Ok(Generation { batch, runtime })
}

pub fn generate_with_runtime(
    view: &AuthorizedView,
    oracle: &mut impl PlanningOracle,
) -> ContractResult<Generation> {
    view.validate()?;
    let planning = oracle.open(view)?;
    let result = if planning == 0 {
        Err("Planning oracle returned a zero planning identity".into())
    } else {
        compose(
            view,
            &mut Domains {
                oracle,
                planning,
                cursors: BTreeSet::new(),
            },
        )
    };
    match (result, oracle.close(planning)) {
        (Ok(generation), Ok(())) => Ok(generation),
        (Err(error), Ok(())) => Err(error),
        (Ok(_), Err(close)) => Err(format!("Planning close failed: {close}")),
        (Err(error), Err(close)) => Err(format!("{error}; planning close failed: {close}")),
    }
}

pub fn generate(
    view: &AuthorizedView,
    oracle: &mut impl PlanningOracle,
) -> ContractResult<CandidateBatch> {
    generate_with_runtime(view, oracle).map(|generation| generation.batch)
}
