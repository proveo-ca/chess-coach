// SPEC: _spec/apps/arena/burn-compat.puml, _spec/packages/training/burn-compat.puml
import {
  appendTimeSpecialAnchor, charonDiagonalSquaresFromSquare, classicalActorAt,
  classicalRewriteCoordinatesAfterB, countedPlanningKnowledge, isScMoveShape,
  knownAppendFailure, marineSingleTarget, spawnCCAnchorFromMap, specialGasCost, UNIT_COST,
  type CountedPlanningKnowledge, type SpawnPiece,
} from "@chess-coach/starchess-core/planning-v1";
import {
  ACTION_KINDS, EngineErrorV2, freezeV2, integerV2, parsePullsV2, parseViewV2, SQUARES_V2,
  type Action, type ActionKind, type AuthorizedView, type CursorPull, type PlanningClose,
  type PlanningNext, type PlanningOpen, type PrimitiveProposal,
} from "./wire-v2";

const UNITS: readonly SpawnPiece[] = ["p", "n", "b", "r", "q"];
const PROMOTIONS: readonly SpawnPiece[] = ["n", "b", "r", "q"];
const ACTORS = { deploy: "k", stimStep: "p", spiderMine: "n", charonMissiles: "b", siegeMode: "r", tacticalJump: "q" } as const;
export const MAX_PLANNING_CONTEXTS_V2 = 2;
export const MAX_PLANNING_CURSORS_V2 = 2063;

export function planningKnowledgeV2(view: AuthorizedView): CountedPlanningKnowledge {
  return countedPlanningKnowledge({
    side: view.side,
    knownPieces: new Map(view.cells.flatMap(c => c.visibility !== "unknown" && c.piece ? [[c.square, c.piece] as const] : [])),
    unknownSquares: new Set(view.cells.filter(c => c.visibility === "unknown").map(c => c.square)),
    ownMines: new Set(view.own.mines), ownSiegedTanks: new Set(view.own.siegedTanks),
  }, view.own.mines);
}

function* actionsV2(knowledge: CountedPlanningKnowledge, prefix: readonly Action[], family: ActionKind | null): Generator<Action> {
  const { side, knownPieces } = knowledge;
  const lastRank = side === "w" ? "8" : "1";
  for (const kind of ACTION_KINDS) {
    if (family !== null && family !== kind) continue;
    for (const from of SQUARES_V2) {
      if (kind === "classical") {
        const actor = classicalActorAt(knownPieces, prefix, side, from);
        if (!actor) continue;
        for (const to of SQUARES_V2) {
          if (!isScMoveShape(actor.type, from, to, side)) continue;
          const action = { kind, timing: "C", color: side, from, to } as const;
          const rewrite = actor.type === "p" ? classicalRewriteCoordinatesAfterB(prefix, action) : null;
          if (actor.type === "p" && (to[1] === lastRank || rewrite?.to[1] === lastRank)) {
            for (const promotion of PROMOTIONS) yield { ...action, promotion };
          } else yield action;
        }
        continue;
      }
      const actor = knownPieces.get(from);
      if (actor?.color !== side || actor.type !== ACTORS[kind]) continue;
      for (const timing of ["B", "F"] as const) {
        const base = { timing, color: side, from };
        switch (kind) {
          case "deploy": {
            const { commandCenter, allyOccupied } = spawnCCAnchorFromMap(knownPieces, side, timing, prefix);
            if (!commandCenter) break;
            for (const to of SQUARES_V2) {
              if (to === commandCenter || allyOccupied.has(to) ||
                  Math.abs(to.charCodeAt(0) - commandCenter.charCodeAt(0)) > 1 ||
                  Math.abs(Number(to[1]) - Number(commandCenter[1])) > 1) continue;
              for (const unit of UNITS) yield { ...base, kind, to, unit };
            }
            break;
          }
          case "stimStep": {
            const to = marineSingleTarget(from, side);
            if (!to) break;
            if (to[1] === lastRank) {
              for (const promotion of PROMOTIONS) yield { ...base, kind, to, promotion };
            } else yield { ...base, kind, to };
            break;
          }
          case "spiderMine": case "siegeMode": yield { ...base, kind }; break;
          case "charonMissiles": {
            const targets = new Set(charonDiagonalSquaresFromSquare(appendTimeSpecialAnchor(prefix, side, from, timing)));
            for (const to of SQUARES_V2) if (targets.has(to)) yield { ...base, kind, to };
            break;
          }
          case "tacticalJump":
            for (const to of SQUARES_V2) if (to !== from && !knownPieces.has(to)) yield { ...base, kind, to };
            break;
        }
      }
    }
  }
}

export function* primitiveDomainV2(knowledge: CountedPlanningKnowledge, prefix: readonly Action[], family: ActionKind | null): Generator<PrimitiveProposal> {
  for (const action of actionsV2(knowledge, prefix, family)) {
    const minerals = action.kind === "deploy" && action.unit ? UNIT_COST[action.unit] : 0;
    const gas = action.kind === "classical" ? 0 : specialGasCost(action.kind);
    if (![minerals, gas].every(n => Number.isSafeInteger(n) && n >= 0)) throw new EngineErrorV2("ENGINE_FAILURE", "Invalid native action cost");
    const anchor = action.kind === "deploy"
      ? spawnCCAnchorFromMap(knowledge.knownPieces, knowledge.side, action.timing, prefix).commandCenter ?? null
      : action.timing === "C" ? action.from : appendTimeSpecialAnchor(prefix, knowledge.side, action.from, action.timing);
    yield freezeV2({ action, nativeFailure: knownAppendFailure(knowledge, prefix, action), anchor, cost: { minerals, gas } });
  }
}

type Stream = { rows: PrimitiveProposal[]; generator: Generator<PrimitiveProposal> | null };
type Cursor = { stream: Stream; offset: number };
type PlanningState = { view: AuthorizedView; knowledge: CountedPlanningKnowledge; created: number; cursors: Map<number, Cursor>; exhausted: Set<number>; streams: Map<string, Stream> };

export class PlanningManager {
  #nextPlanning = 1;
  #nextCursor = 1;
  #contexts = new Map<number, PlanningState>();

  get liveContexts(): number { return this.#contexts.size; }
  get liveCursors(): number { return [...this.#contexts.values()].reduce((n, c) => n + c.cursors.size, 0); }

  open(value: AuthorizedView): PlanningOpen {
    const view = parseViewV2(value);
    if (this.#contexts.size >= MAX_PLANNING_CONTEXTS_V2) throw new EngineErrorV2("LIMIT", "Too many planning contexts");
    integerV2(this.#nextPlanning);
    const planning = this.#nextPlanning++;
    this.#contexts.set(planning, { view, knowledge: planningKnowledgeV2(view), created: 0, cursors: new Map(), exhausted: new Set(), streams: new Map() });
    return { kind: "planning-opened", planning };
  }

  #get(planning: number): PlanningState {
    integerV2(planning);
    const context = this.#contexts.get(planning);
    if (!context) throw new EngineErrorV2("STATE", "Unknown planning context");
    return context;
  }

  next(planning: number, value: CursorPull[]): PlanningNext {
    const context = this.#get(planning);
    const pulls = parsePullsV2(value);
    const starts = pulls.filter(p => p.kind === "start");
    if (context.created + starts.length > MAX_PLANNING_CURSORS_V2 || this.#nextCursor + starts.length - 1 > 0xffffffff) throw new EngineErrorV2("LIMIT", "Planning cursor limit reached");
    for (const pull of pulls) {
      if (pull.kind === "start") {
        if (pull.prefix.some(a => a.color !== context.view.side)) throw new EngineErrorV2("BAD_REQUEST", "Prefix belongs to the opposing side");
      } else if (!context.cursors.has(pull.cursor) && !context.exhausted.has(pull.cursor)) {
        throw new EngineErrorV2("STATE", "Unknown planning cursor");
      }
    }
    const steps = pulls.map(pull => {
      let cursor: number;
      if (pull.kind === "start") {
        cursor = this.#nextCursor++;
        context.created++;
        const key = JSON.stringify([pull.prefix, pull.family]);
        let stream = context.streams.get(key);
        if (!stream) {
          stream = { rows: [], generator: primitiveDomainV2(context.knowledge, pull.prefix, pull.family) };
          context.streams.set(key, stream);
        }
        context.cursors.set(cursor, { stream, offset: 0 });
      } else cursor = pull.cursor;
      const current = context.cursors.get(cursor);
      if (!current) return { cursor, proposal: null };
      const { stream } = current;
      if (current.offset === stream.rows.length && stream.generator) {
        const step = stream.generator.next();
        if (step.done) stream.generator = null;
        else stream.rows.push(step.value);
      }
      const proposal = stream.rows[current.offset++] ?? null;
      if (proposal === null) {
        context.cursors.delete(cursor);
        context.exhausted.add(cursor);
      }
      return { cursor, proposal };
    });
    return { kind: "planned", planning, steps };
  }

  close(planning: number): PlanningClose {
    const context = this.#get(planning);
    for (const stream of context.streams.values()) stream.generator?.return(undefined);
    this.#contexts.delete(planning);
    return { kind: "planning-closed", planning };
  }
}
