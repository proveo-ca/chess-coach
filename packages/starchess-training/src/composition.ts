// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import { validateObservationV1, type AuthorizedObservationV1 } from "@chess-coach/starchess-arena/observations";
import { ACTION_KINDS, encodeCandidate, type EncodedCandidate } from "@chess-coach/starchess-arena/intent-codec-v1";
import type { PlanningKnowledge, ScActionInput } from "@chess-coach/starchess-core/planning-v1";
import type { CandidateBatchV3, CandidateDiagnostics, CandidateKind, CandidateLane } from "./contracts";
import { appendFailure, appendState, emptyPrefix, planningKnowledge, primitiveDomain, type PrefixState } from "./domain";
import { compareBytes, KeyIndex, type Digest } from "./identity";

type Node = { state: PrefixState; cursor: Generator<ScActionInput> };
type Frontier = { nodes: (Node | undefined)[]; head: number };
type Lane = { id: CandidateLane; frontiers: Frontier[]; depthCursor: number; exhausted: boolean };
export type RuntimeCounters = Readonly<{
  roots: number;
  continuationNodes: number;
  peakLiveNodes: number;
  domainCursors: number;
  cursorPulls: number;
  availabilityPulls: number;
  appendAttempts: number;
  maximumQueueLength: number;
}>;

const freeze = <T>(value: T): T => {
  if (value !== null && typeof value === "object") {
    for (const entry of Object.values(value)) freeze(entry);
    Object.freeze(value);
  }
  return value;
};
const counts = (): Record<CandidateKind, number> => ({
  classical: 0, deploy: 0, stimStep: 0, spiderMine: 0, charonMissiles: 0, siegeMode: 0, tacticalJump: 0,
});

export type DomainFactory = (
  knowledge: PlanningKnowledge, state: PrefixState, onlyFamily?: CandidateKind, lane?: CandidateLane,
) => Generator<ScActionInput>;

export const composeKernel = (input: AuthorizedObservationV1, domain: DomainFactory, digest?: Digest): {
  batch: CandidateBatchV3; runtime: RuntimeCounters;
} => {
  const observation = validateObservationV1(input);
  const knowledge = planningKnowledge(observation);
  const runtime = {
    roots: 8, continuationNodes: 0, peakLiveNodes: 8, domainCursors: 8,
    cursorPulls: 0, availabilityPulls: 0, appendAttempts: 0, maximumQueueLength: 0,
  };
  const activeFamilies = ACTION_KINDS.filter((kind) => {
    const root = emptyPrefix();
    const cursor = domain(knowledge, root, kind);
    for (;;) {
      runtime.availabilityPulls++;
      const next = cursor.next();
      if (next.done) return false;
      if (appendFailure(observation, knowledge, root, next.value) === null) {
        cursor.return(undefined);
        return true;
      }
    }
  });
  const ids: CandidateLane[] = [...ACTION_KINDS, "shared-composition"];
  const pools = ids.map((id) => ({
    id, initialCapacity: id === "shared-composition" ? 175 : activeFamilies.includes(id) ? 48 : 0,
    finalCapacity: 0, retained: 0, exhausted: false,
  }));
  let released = (7 - activeFamilies.length) * 48;
  if (activeFamilies.length === 0) pools[7]!.initialCapacity += released;
  else {
    for (let i = 0; released > 0; i++, released--) {
      pools.find((pool) => pool.id === activeFamilies[i % activeFamilies.length])!.initialCapacity++;
    }
  }
  for (const pool of pools) pool.finalCapacity = pool.initialCapacity;
  const lanes: Lane[] = ids.map((id) => {
    const root = emptyPrefix();
    return { id, depthCursor: 0, exhausted: false,
      frontiers: Array.from({ length: 4 }, (_, depth) => ({
        nodes: depth === 0 ? [{ state: root, cursor: domain(knowledge, root, undefined, id) }] : [], head: 0,
      })),
    };
  });
  const pass = encodeCandidate(observation, []);
  const index = new KeyIndex(digest);
  const retained: { candidate: EncodedCandidate; bytes: Uint8Array }[] = [{ candidate: pass, bytes: index.bytes(pass.key) }];
  index.add(retained[0]!.bytes);
  const d = {
    profile: "B" as const, attemptedExtensions: 0, uniqueIncludingPass: 1, retainedNonPass: 0,
    duplicates: 0, ownerSkipped: 0, quotaSkipped: 0,
    pruned: { actor: 0, shape: 0, timing: 0, resources: 0, mineCap: 0, ownOccupancy: 0 },
    activeFamilies, exhaustedLanes: [] as CandidateLane[], pools, retainedByOwner: counts(),
    retainedByLength: { "1": 0, "2": 0, "3": 0, "4": 0 },
    attemptCapReached: false, capacityCapReached: false,
    stopReason: "exhausted" as CandidateDiagnostics["stopReason"],
  };
  let liveNodes = 8;
  const proveExhausted = (laneIndex: number) => {
    const lane = lanes[laneIndex]!;
    lane.exhausted = true;
    const pool = pools[laneIndex]!;
    pool.exhausted = true;
    const unused = pool.finalCapacity - pool.retained;
    if (laneIndex < 7) {
      pool.finalCapacity -= unused;
      pools[7]!.finalCapacity += unused;
    }
    const shared = pools[7]!;
    if (shared.exhausted) {
      const recipients = pools.slice(0, 7).filter((p) => !p.exhausted);
      if (recipients.length) {
        const spare = shared.finalCapacity - shared.retained;
        shared.finalCapacity -= spare;
        for (let i = 0; i < spare; i++) recipients[i % recipients.length]!.finalCapacity++;
      }
    }
  };
  const nextAttempt = (lane: Lane): { node: Node; action: ScActionInput; depth: number } | null => {
    for (let offset = 0; offset < 4; offset++) {
      const depth = (lane.depthCursor + offset) % 4;
      const frontier = lane.frontiers[depth]!;
      while (frontier.head < frontier.nodes.length) {
        const node = frontier.nodes.at(frontier.head)!;
        runtime.cursorPulls++;
        const next = node.cursor.next();
        if (!next.done) return { node, action: next.value, depth };
        frontier.nodes[frontier.head++] = undefined;
        liveNodes--;
      }
      frontier.nodes = [];
      frontier.head = 0;
    }
    return null;
  };
  while (d.attemptedExtensions < 2048 && d.uniqueIncludingPass < 512 && lanes.some((lane) => !lane.exhausted)) {
    for (let i = 0; i < lanes.length; i++) {
      if (d.attemptedExtensions === 2048 || d.uniqueIncludingPass === 512) break;
      const lane = lanes[i]!;
      if (lane.exhausted) continue;
      const attempt = nextAttempt(lane);
      if (!attempt) { proveExhausted(i); continue; }
      d.attemptedExtensions++;
      runtime.appendAttempts++;
      lane.depthCursor = (attempt.depth + 1) % 4;
      const { node, action } = attempt;
      const failure = appendFailure(observation, knowledge, node.state, action);
      if (failure) {
        switch (failure) {
          case "actor": d.pruned.actor++; break;
          case "shape": d.pruned.shape++; break;
          case "timing": d.pruned.timing++; break;
          case "resources": d.pruned.resources++; break;
          case "mineCap": d.pruned.mineCap++; break;
          case "ownOccupancy": d.pruned.ownOccupancy++; break;
        }
        continue;
      }
      const child = appendState(knowledge, node.state, action);
      const length = child.actions.length;
      runtime.maximumQueueLength = Math.max(runtime.maximumQueueLength, length);
      if (length < 4) {
        lane.frontiers[length]!.nodes.push({ state: child, cursor: domain(knowledge, child, undefined, lane.id) });
        runtime.continuationNodes++;
        runtime.domainCursors++;
        liveNodes++;
        runtime.peakLiveNodes = Math.max(runtime.peakLiveNodes, liveNodes);
      }
      const owner = child.actions[0]!.kind;
      if (lane.id === "shared-composition" ? length < 2 : owner !== lane.id) {
        d.ownerSkipped++;
        continue;
      }
      const candidate = encodeCandidate(observation, child.actions);
      const bytes = index.bytes(candidate.key);
      if (index.has(bytes)) { d.duplicates++; continue; }
      const pool = pools[i]!;
      if (pool.retained === pool.finalCapacity) { d.quotaSkipped++; continue; }
      index.add(bytes);
      retained.push({ candidate, bytes });
      pool.retained++;
      d.retainedNonPass++;
      d.uniqueIncludingPass++;
      d.retainedByOwner[owner]++;
      d.retainedByLength[String(length) as "1" | "2" | "3" | "4"]++;
    }
  }
  for (const lane of lanes) {
    for (const frontier of lane.frontiers) {
      for (const node of frontier.nodes.slice(frontier.head)) node!.cursor.return(undefined);
      frontier.nodes = [];
      frontier.head = 0;
    }
  }
  d.exhaustedLanes = lanes.filter((lane) => lane.exhausted).map((lane) => lane.id);
  d.attemptCapReached = d.attemptedExtensions === 2048;
  d.capacityCapReached = d.uniqueIncludingPass === 512;
  d.stopReason = d.capacityCapReached ? "capacity-cap" : d.attemptCapReached ? "attempt-cap" : "exhausted";
  retained.sort((a, b) => compareBytes(a.bytes, b.bytes));
  return {
    batch: freeze({ version: "challenge-composition-v3", candidates: retained.map((entry) => entry.candidate), diagnostics: d }),
    runtime: freeze(runtime),
  };
};

export const composeWithRuntime = (input: AuthorizedObservationV1, digest?: Digest): {
  batch: CandidateBatchV3; runtime: RuntimeCounters;
} => composeKernel(input, primitiveDomain, digest);
