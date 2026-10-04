// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import type { AuthorizedObservationV1 } from "@chess-coach/starchess-arena/observations";
import type { ScActionInput, ScPiece, SpawnPiece, Square } from "@chess-coach/starchess-core";
import type { CandidateDiagnostics, CandidateKind, CandidateLane } from "../contracts";
import { squares } from "./fixtures";

const kinds: CandidateKind[] = ["classical", "deploy", "stimStep", "spiderMine", "charonMissiles", "siegeMode", "tacticalJump"];
const units: SpawnPiece[] = ["p", "n", "b", "r", "q"];
const costs = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
};

export const tinyOracle = (o: AuthorizedObservationV1): { keys: string[]; diagnostics: CandidateDiagnostics; exhaustive: string[] } => {
  if (o.own.pieces.length !== 1 || o.own.pieces[0]!.piece.type !== "k" || o.own.mines.length) throw Error("tiny fixture required");
  const map = new Map(o.cells.flatMap((cell) => cell.visibility !== "unknown" && cell.piece
    ? [[cell.square, cell.piece] as const] : []));
  const origin = o.own.pieces[0]!.square;
  const adjacent = (from: Square, to: Square) => from !== to &&
    Math.abs(from.charCodeAt(0) - to.charCodeAt(0)) <= 1 && Math.abs(Number(from[1]) - Number(to[1])) <= 1;
  const domain = (prefix: ScActionInput[]): ScActionInput[] => {
    const actions: ScActionInput[] = [];
    for (const from of squares) {
      const birth = prefix.find((a) => a.kind === "deploy" && a.timing === "B" && a.to === from);
      const actor: ScPiece | undefined = map.get(from)?.color === o.side ? map.get(from)
        : birth?.kind === "deploy" && birth.unit ? { type: birth.unit, color: o.side } : undefined;
      if (!actor) continue;
      for (const to of squares) {
        const df = Math.abs(from.charCodeAt(0) - to.charCodeAt(0));
        const dr = (Number(to[1]) - Number(from[1])) * (o.side === "w" ? 1 : -1);
        const shape = actor.type === "k" ? adjacent(from, to) : actor.type === "p"
          ? (df <= 1 && dr === 1) || (df === 0 && dr === 2 && (o.side === "w" ? Number(from[1]) <= 2 : Number(from[1]) >= 7))
          : actor.type === "n" ? (df === 1 && Math.abs(dr) === 2) || (df === 2 && Math.abs(dr) === 1)
          : actor.type === "b" ? df === Math.abs(dr) && df > 0
          : actor.type === "r" ? (df === 0 && dr !== 0) || (df !== 0 && dr === 0)
          : from !== to && (df === Math.abs(dr) || df === 0 || dr === 0);
        if (!shape) continue;
        const base = { kind: "classical", timing: "C", color: o.side, from, to } as const;
        if (actor.type === "p" && to[1] === (o.side === "w" ? "8" : "1")) {
          for (const promotion of units) actions.push({ ...base, promotion });
        } else actions.push(base);
      }
    }
    for (const timing of ["B", "F"] as const) {
      const anchor = timing === "F" ? prefix.find((a) => a.kind === "classical" && a.from === origin)?.to ?? origin : origin;
      for (const to of squares) {
        if (!adjacent(anchor, to) || to === anchor) continue;
        const ccSquares = new Set([...map].filter(([, p]) => p.type === "k").map(([sq]) => sq));
        if (timing === "F" && anchor !== origin) { ccSquares.delete(origin); ccSquares.add(anchor); }
        if (ccSquares.has(to)) continue;
        for (const unit of units) actions.push({ kind: "deploy", timing, color: o.side, from: origin, to, unit });
      }
    }
    return actions;
  };
  const failure = (prefix: ScActionInput[], a: ScActionInput) => {
    if (a.timing === "C" ? prefix.some((p) => p.timing === "C") : prefix.some((p) => p.timing !== "C" && p.from === a.from)) return "timing";
    const queue = [...prefix, a];
    const minerals = queue.reduce((n, p) => n + (p.kind === "deploy" ? costs[p.unit!] : 0), 0);
    const gas = queue.filter((p) => p.kind === "deploy").length;
    if (minerals > o.own.minerals || gas > o.own.gas) return "resources";
    if (a.timing === "C" && map.get(a.to)?.color === o.side) return "ownOccupancy";
    return null;
  };
  const singleton = domain([]);
  const activeFamilies = kinds.filter((kind) => singleton.some((a) => a.kind === kind && failure([], a) === null));
  const lanes: CandidateLane[] = [...kinds, "shared-composition"];
  const capacities: number[] = kinds.map((kind) => activeFamilies.includes(kind) ? 48 : 0);
  for (let i = 0; i < (7 - activeFamilies.length) * 48; i++) capacities[kinds.indexOf(activeFamilies[i % activeFamilies.length]!)]!++;
  capacities.push(175);
  const pools = lanes.map((id, i) => ({ id, initialCapacity: capacities[i]!, finalCapacity: capacities[i]!, retained: 0, exhausted: false }));
  const d: CandidateDiagnostics & { -readonly [P in keyof CandidateDiagnostics]: CandidateDiagnostics[P] } = {
    profile: "B", attemptedExtensions: 0, uniqueIncludingPass: 1, retainedNonPass: 0,
    duplicates: 0, ownerSkipped: 0, quotaSkipped: 0,
    pruned: { actor: 0, shape: 0, timing: 0, resources: 0, mineCap: 0, ownOccupancy: 0 },
    activeFamilies, exhaustedLanes: [], pools, retainedByOwner: Object.fromEntries(kinds.map((k) => [k, 0])) as Record<CandidateKind, number>,
    retainedByLength: { "1": 0, "2": 0, "3": 0, "4": 0 }, attemptCapReached: false, capacityCapReached: false, stopReason: "exhausted",
  };
  type Node = { prefix: ScActionInput[]; remaining: ScActionInput[] };
  const frontiers: Node[][][] = lanes.map(() => [[{ prefix: [], remaining: singleton.slice() }], [], [], []]);
  const cursors = lanes.map(() => 0);
  const keys = new Set(["[]"]);
  let ended = 0;
  while (d.attemptedExtensions < 2048 && keys.size < 512 && ended !== 8) {
    for (let lane = 0; lane < 8 && d.attemptedExtensions < 2048 && keys.size < 512; lane++) {
      if (pools[lane]!.exhausted) continue;
      let selected: Node | undefined;
      let depth = cursors[lane]!;
      for (let offset = 0; offset < 4; offset++) {
        depth = (cursors[lane]! + offset) % 4;
        const queue = frontiers[lane]![depth]!;
        while (queue.length && !queue[0]!.remaining.length) queue.shift();
        if (queue.length) { selected = queue[0]; break; }
      }
      if (!selected) {
        pools[lane]!.exhausted = true;
        ended++;
        if (lane < 7) {
          const spare = pools[lane]!.finalCapacity - pools[lane]!.retained;
          pools[lane]!.finalCapacity -= spare;
          pools[7]!.finalCapacity += spare;
        }
        if (pools[7]!.exhausted) {
          const remaining = pools.slice(0, 7).filter((p) => !p.exhausted);
          if (remaining.length) {
            const spare = pools[7]!.finalCapacity - pools[7]!.retained;
            pools[7]!.finalCapacity -= spare;
            for (let n = 0; n < spare; n++) remaining[n % remaining.length]!.finalCapacity++;
          }
        }
        continue;
      }
      const a = selected.remaining.shift()!;
      d.attemptedExtensions++;
      cursors[lane] = (depth + 1) % 4;
      const reason = failure(selected.prefix, a);
      if (reason) { (d.pruned as Record<string, number>)[reason]!++; continue; }
      const child = [...selected.prefix, a];
      if (child.length < 4) frontiers[lane]![child.length]!.push({ prefix: child, remaining: domain(child) });
      if (lane === 7 ? child.length < 2 : child[0]!.kind !== kinds[lane]) { d.ownerSkipped++; continue; }
      const key = canonical(child);
      if (keys.has(key)) { d.duplicates++; continue; }
      if (pools[lane]!.retained === pools[lane]!.finalCapacity) { d.quotaSkipped++; continue; }
      keys.add(key);
      pools[lane]!.retained++;
      d.retainedNonPass++;
      d.uniqueIncludingPass++;
      (d.retainedByOwner as Record<string, number>)[child[0]!.kind]!++;
      (d.retainedByLength as Record<string, number>)[String(child.length)]!++;
    }
  }
  d.exhaustedLanes = pools.filter((p) => p.exhausted).map((p) => p.id);
  d.attemptCapReached = d.attemptedExtensions === 2048;
  d.capacityCapReached = keys.size === 512;
  d.stopReason = d.capacityCapReached ? "capacity-cap" : d.attemptCapReached ? "attempt-cap" : "exhausted";
  const exhaustive = new Set(["[]"]);
  const walk = (prefix: ScActionInput[]) => {
    if (prefix.length === 4) return;
    for (const a of domain(prefix)) {
      if (failure(prefix, a)) continue;
      const child = [...prefix, a];
      exhaustive.add(canonical(child));
      walk(child);
    }
  };
  walk([]);
  return { keys: [...keys].sort(), diagnostics: d, exhaustive: [...exhaustive].sort() };
};
