// SPEC: _spec/apps/arena/burn-compat.puml
import { applyStoredIncome, endScTurn, formatScFen, type ScActionInput, type Square } from "@chess-coach/starchess-core";
import { commitWindow } from "./admission";
import { openedFixture } from "./fixture";
import { projectObservation } from "./observation";

export const PROTOCOL = "arena-engine-v1";
export const INPUT_LIMIT = 64 * 1024;
export const OUTPUT_LIMIT = 1024 * 1024;
type Action = Extract<ScActionInput, { kind: "classical" }>;
type Request = { protocol: typeof PROTOCOL; id: number; fixture: "tiny-v1" } &
  ({ op: "open" } | { op: "settle"; action: Action });

function fields(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected an object");
  if (Reflect.ownKeys(value).length !== keys.length || Reflect.ownKeys(value).some(key => typeof key !== "string" || !keys.includes(key))) throw new Error("Unexpected fields");
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) throw new Error("Expected a data field");
    result[key] = descriptor.value;
  }
  return result;
}

function square(value: unknown): Square {
  if (typeof value !== "string" || !/^[a-h][1-8]$/.test(value)) throw new Error("Invalid square");
  return value as Square;
}

export function parseRequest(value: unknown): Request {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid request");
  const op: unknown = Object.getOwnPropertyDescriptor(value, "op")?.value;
  const request = fields(value, op === "settle" ? ["protocol", "id", "op", "fixture", "action"] : ["protocol", "id", "op", "fixture"]);
  if (request.protocol !== PROTOCOL || request.fixture !== "tiny-v1" || typeof request.id !== "number" || !Number.isInteger(request.id) || request.id < 0 || request.id > 0xffffffff) throw new Error("Invalid request identity");
  const base = { protocol: PROTOCOL, id: request.id, fixture: "tiny-v1" } as const;
  if (request.op === "open") return { ...base, op: "open" };
  if (request.op !== "settle") throw new Error("Unsupported operation");
  const action = fields(request.action, ["kind", "timing", "color", "from", "to"]);
  if (action.kind !== "classical" || action.timing !== "C" || action.color !== "w") throw new Error("Unsupported action");
  const from = square(action.from);
  const to = square(action.to);
  if (from !== "e1" || (to !== "d1" && to !== "f1")) throw new Error("Action is outside the tiny fixture domain");
  return { ...base, op: "settle", action: { kind: "classical", timing: "C", color: "w", from, to } };
}

export function failure(id: number | null, code: "BAD_REQUEST" | "NATIVE_REJECTION" | "ENGINE_FAILURE", message: string) {
  return { protocol: PROTOCOL, id, ok: false as const, error: { code, message } };
}

export function handleRequest(value: unknown) {
  let request: Request;
  try { request = parseRequest(value); }
  catch { return { exit: 2, reply: failure(null, "BAD_REQUEST", "Invalid engine request") }; }
  const base = { protocol: PROTOCOL, id: request.id, ok: true as const, op: request.op };
  try {
    const fixture = openedFixture();
    const observation = projectObservation(fixture.opening, "w");
    if (request.op === "open") return { exit: 0, reply: { ...base, observation } };
    const requestedActions = { w: [request.action], b: [] } as const;
    let committed: ReturnType<typeof commitWindow>;
    try { committed = commitWindow(fixture.opening, requestedActions); }
    catch { return { exit: 2, reply: failure(request.id, "NATIVE_REJECTION", "Native engine rejected the proposed action") }; }
    const rawResolve = endScTurn(structuredClone(committed.snapshot), { skipTurnStartChecks: true });
    const bankAfter = applyStoredIncome({ ...committed.bank }, rawResolve.next.turn);
    const final = { ...structuredClone(rawResolve.next), stored: { ...bankAfter } };
    return { exit: 0, reply: { ...base, observation, result: {
      initialScfen: formatScFen(fixture.initial), openScfen: formatScFen(fixture.opening),
      committedScfen: formatScFen(committed.snapshot), finalScfen: formatScFen(final),
      bankBefore: fixture.bankBefore, bankCommitted: committed.bank, bankAfter,
      requestedActions, rawBegin: fixture.rawBegin, rawResolve,
    } } };
  } catch {
    return { exit: 1, reply: failure(request.id, "ENGINE_FAILURE", "Native engine boundary failed") };
  }
}
