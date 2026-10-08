// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import { encodeCandidate, type EncodedCandidate } from "@chess-coach/starchess-arena/intent-codec-v1";
import type { AuthorizedObservationV1 } from "@chess-coach/starchess-arena/observations";
import type { ScActionInput } from "@chess-coach/starchess-core";
import { compareBytes, createIdentity, keyBytes } from "./canonicalIdentity";
import { candidateInput, type CandidateInput } from "./input";
import { appendFailure, appendPrefix, emptyPrefix, type OwnPrefix } from "./ownPrefix";
import { primitiveIntents } from "./primitives";
import {
  COMPOSITION_VERSION, FAMILY_ORDER, LANE_ORDER, MAX_ATTEMPTED_EXTENSIONS,
  MAX_GENERATED_ACTIONS, MAX_RETAINED_CANDIDATES,
  type CandidateBatchV3, type Kind, type Lane, type PoolRecord,
} from "./types";

type Node = { prefix: OwnPrefix; nextIntentIndex: number; intents: Iterator<ScActionInput> };
type Frontier = { nodes: Node[]; head: number };
type LaneState = {
  id: Lane;
  frontiers: Frontier[];
  cursor: number;
  initialCapacity: number;
  capacity: number;
  retained: number;
  exhausted: boolean;
};
const node = (input: CandidateInput, prefix: OwnPrefix): Node => ({ prefix, nextIntentIndex: 0, intents: primitiveIntents(input, prefix.actions) });
const visit = (lane: LaneState): { parent: OwnPrefix; action: ScActionInput; depth: number } | null => {
  for (let offset = 0; offset < MAX_GENERATED_ACTIONS; offset++) {
    const depth = (lane.cursor + offset) % MAX_GENERATED_ACTIONS;
    const frontier = lane.frontiers[depth]!;
    while (frontier.head < frontier.nodes.length) {
      const current = frontier.nodes[frontier.head]!;
      const next = current.intents.next();
      if (next.done) {
        frontier.head++;
        continue;
      }
      current.nextIntentIndex++;
      lane.cursor = (depth + 1) % MAX_GENERATED_ACTIONS;
      return { parent: current.prefix, action: next.value, depth };
    }
  }
  return null;
};
const distribute = (amount: number, recipients: LaneState[]): void => {
  if (!recipients.length) return;
  for (let index = 0; index < amount; index++) recipients[index % recipients.length]!.capacity++;
};
const kindCounts = (): Record<Kind, number> => ({ classical: 0, deploy: 0, stimStep: 0, spiderMine: 0, charonMissiles: 0, siegeMode: 0, tacticalJump: 0 });

export const composeCandidatesFromObservationV1 = (observation: AuthorizedObservationV1): CandidateBatchV3 => {
  const input = candidateInput(observation);
  const active = new Set<Kind>();
  for (const action of primitiveIntents(input, [])) {
    if (!active.has(action.kind) && appendFailure(input, emptyPrefix(), action) === null) active.add(action.kind);
  }
  const lanes: LaneState[] = LANE_ORDER.map((id) => ({
    id, cursor: 0, initialCapacity: 0, capacity: id === "shared-composition" ? 175 : active.has(id) ? 48 : 0,
    retained: 0, exhausted: false,
    frontiers: Array.from({ length: MAX_GENERATED_ACTIONS }, (_, depth) => ({ nodes: depth === 0 ? [node(input, emptyPrefix())] : [], head: 0 })),
  }));
  const shared = lanes[7]!;
  const activeLanes = lanes.filter((lane) => lane.id !== "shared-composition" && active.has(lane.id));
  const released = (FAMILY_ORDER.length - active.size) * 48;
  if (activeLanes.length) distribute(released, activeLanes);
  else shared.capacity += released;
  for (const lane of lanes) lane.initialCapacity = lane.capacity;

  const pass = encodeCandidate(input.observation, []);
  const retained: { candidate: EncodedCandidate; bytes: Uint8Array }[] = [{ candidate: pass, bytes: keyBytes(pass.key) }];
  const identity = createIdentity();
  identity.add(retained[0]!.bytes);
  const pruned = { actor: 0, shape: 0, timing: 0, resources: 0, mineCap: 0, ownOccupancy: 0 };
  const retainedByOwner = kindCounts();
  const retainedByLength = { "1": 0, "2": 0, "3": 0, "4": 0 };
  let attemptedExtensions = 0;
  let ownerSkipped = 0;
  let duplicates = 0;
  let quotaSkipped = 0;
  let laneCursor = 0;
  while (attemptedExtensions < MAX_ATTEMPTED_EXTENSIONS && retained.length < MAX_RETAINED_CANDIDATES && lanes.some((lane) => !lane.exhausted)) {
    const lane = lanes[laneCursor]!;
    laneCursor = (laneCursor + 1) % lanes.length;
    if (lane.exhausted) continue;
    const extension = visit(lane);
    if (!extension) {
      lane.exhausted = true;
      const unused = lane.capacity - lane.retained;
      if (unused > 0) {
        const recipients = lane === shared ? lanes.filter((other) => other !== shared && !other.exhausted) : shared.exhausted ? [] : [shared];
        if (recipients.length) {
          lane.capacity -= unused;
          distribute(unused, recipients);
        }
      }
      continue;
    }
    attemptedExtensions++;
    const failure = appendFailure(input, extension.parent, extension.action);
    if (failure) {
      pruned[failure]++;
      continue;
    }
    const child = appendPrefix(extension.parent, extension.action);
    if (child.actions.length < MAX_GENERATED_ACTIONS) lane.frontiers[child.actions.length]!.nodes.push(node(input, child));
    const owner = child.actions[0]!.kind;
    if (lane === shared ? child.actions.length < 2 : owner !== lane.id) {
      ownerSkipped++;
      continue;
    }
    const candidate = encodeCandidate(input.observation, child.actions);
    const bytes = keyBytes(candidate.key);
    if (identity.has(bytes)) {
      duplicates++;
      continue;
    }
    if (lane.retained >= lane.capacity) {
      quotaSkipped++;
      continue;
    }
    identity.add(bytes);
    retained.push({ candidate, bytes });
    lane.retained++;
    retainedByOwner[owner]++;
    retainedByLength[String(child.actions.length) as keyof typeof retainedByLength]++;
  }
  const attemptCapReached = attemptedExtensions === MAX_ATTEMPTED_EXTENSIONS;
  const capacityCapReached = retained.length === MAX_RETAINED_CANDIDATES;
  const pools: readonly PoolRecord[] = Object.freeze(lanes.map((lane) => Object.freeze({
    id: lane.id, initialCapacity: lane.initialCapacity, finalCapacity: lane.capacity, retained: lane.retained, exhausted: lane.exhausted,
  })));
  return Object.freeze({
    version: COMPOSITION_VERSION,
    candidates: Object.freeze(retained.sort((a, b) => compareBytes(a.bytes, b.bytes)).map((entry) => entry.candidate)),
    diagnostics: Object.freeze({
      profile: "B", attemptedExtensions, uniqueIncludingPass: retained.length, retainedNonPass: retained.length - 1,
      duplicates, ownerSkipped, quotaSkipped, pruned: Object.freeze(pruned),
      activeFamilies: Object.freeze(FAMILY_ORDER.filter((kind) => active.has(kind))),
      exhaustedLanes: Object.freeze(LANE_ORDER.filter((id) => lanes.find((lane) => lane.id === id)!.exhausted)),
      pools, retainedByOwner: Object.freeze(retainedByOwner), retainedByLength: Object.freeze(retainedByLength),
      attemptCapReached, capacityCapReached,
      stopReason: capacityCapReached ? "capacity-cap" : attemptCapReached ? "attempt-cap" : "exhausted",
    }),
  });
};
