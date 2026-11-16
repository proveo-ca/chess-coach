// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import jsSHA from "jssha/sha256";
import type {
  ActiveStreamState, EpisodeStartStreams, EpisodeStreamLabel, Master, StreamState, UnusedEnvironmentState,
} from "./episodeContracts";

const freeze = Object.freeze;
const integer = Number.isSafeInteger;
const same = Object.is;
const floor = Math.floor;
const imul = Math.imul;
const MAX = Number.MAX_SAFE_INTEGER;
const UINT32 = 4294967295;
const STEP = 0x6d2b79f5;
const SHA = jsSHA;
const roles = new WeakMap<object, "active" | "unused" | "streams" | "selection">();
const lookup = WeakMap.prototype.get.bind(roles);
const register = WeakMap.prototype.set.bind(roles);

export class EpisodeRngError extends Error {
  override readonly name = "EpisodeRngError";
  constructor(readonly code: "PROVENANCE" | "INTEGER" | "MASTER" | "LABEL" | "RNG" | "COUNTER" | "COLLISION") { super(code); }
}
const reject = (code: EpisodeRngError["code"]): never => { throw new EpisodeRngError(code); };
const publish = <T extends object>(record: T, role: "active" | "unused" | "streams" | "selection"): Readonly<T> => {
  freeze(record);
  register(record, role);
  return record;
};
const requireRole = <T>(value: unknown, role: "active" | "unused" | "streams" | "selection"): T => {
  if (value === null || typeof value !== "object" || lookup(value) !== role) return reject("PROVENANCE");
  return value as T;
};
export const requireEpisodeInteger = (value: unknown, low: number, high: number): number => {
  if (typeof low !== "number" || typeof high !== "number" || !integer(low) || !integer(high) || low > high ||
      typeof value !== "number" || !integer(value) || same(value, -0) || value < low || value > high) return reject("INTEGER");
  return value;
};
export const requireEpisodeMaster = (value: unknown): Master => {
  if (value !== 101 && value !== 102 && value !== 103 && value !== 104 && value !== 105) return reject("MASTER");
  return value;
};
const requireLabel = (label: unknown): EpisodeStreamLabel => {
  if (label !== "selection" && label !== "environment-settlement" && label !== "policy-sampling" && label !== "opponent") return reject("LABEL");
  return label;
};
export const constructActiveStreamState = (root: number, state: number, drawCount: number): ActiveStreamState => {
  const r = requireEpisodeInteger(root, 0, UINT32), s = requireEpisodeInteger(state, 0, UINT32);
  const count = requireEpisodeInteger(drawCount, 0, MAX);
  return publish({ status: "active", root: r, state: s, drawCount: count } as const, "active");
};
export const constructUnusedEnvironmentState = (root: number): UnusedEnvironmentState => {
  const r = requireEpisodeInteger(root, 0, UINT32);
  return publish({ status: "unused", root: r, state: r, drawCount: 0 } as const, "unused");
};
export const requireActiveStreamState = (value: unknown): ActiveStreamState => requireRole(value, "active");
export const requireUnusedEnvironmentState = (value: unknown): UnusedEnvironmentState => requireRole(value, "unused");
export const requireEpisodeStartStreams = (value: unknown): EpisodeStartStreams => requireRole(value, "streams");
export const requireEpisodeStreamState = (value: unknown): StreamState => {
  if (value === null || typeof value !== "object") return reject("PROVENANCE");
  const role = lookup(value);
  if (role !== "active" && role !== "unused") return reject("PROVENANCE");
  return value as StreamState;
};
export const constructEpisodeStartStreams = (
  selection: ActiveStreamState, environment: UnusedEnvironmentState, sampling: ActiveStreamState, opponent: ActiveStreamState,
): EpisodeStartStreams => {
  const s = requireActiveStreamState(selection), e = requireUnusedEnvironmentState(environment);
  const p = requireActiveStreamState(sampling), o = requireActiveStreamState(opponent);
  return publish({ selection: s, "environment-settlement": e, "policy-sampling": p, opponent: o }, "streams");
};

export const deriveEpisodeRoot = (master: Master, label: EpisodeStreamLabel): number => {
  const m = requireEpisodeMaster(master), l = requireLabel(label);
  const hash = new SHA("SHA-256", "TEXT", { encoding: "UTF8" });
  hash.update(`["starchess-training-rng-v1",${m},"${l}"]`);
  const bytes = hash.getHash("UINT8ARRAY");
  return ((bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!) >>> 0;
};
export type EpisodeRootRow = Readonly<{ master: Master; label: EpisodeStreamLabel; root: number }>;
export const computeEpisodeRootTable = (): readonly EpisodeRootRow[] => {
  const rows: EpisodeRootRow[] = [];
  const labels = ["selection", "environment-settlement", "policy-sampling", "opponent"] as const;
  for (let master = 101; master <= 105; master++) {
    for (let index = 0; index < 4; index++) {
      const label = labels[index]!, root = deriveEpisodeRoot(master as Master, label);
      for (let prior = 0; prior < rows.length; prior++) if (rows[prior]!.root === root) return reject("COLLISION");
      rows.push(freeze({ master: master as Master, label, root }));
    }
  }
  return freeze(rows);
};

declare const rngBrand: unique symbol;
export type EpisodeRng = Readonly<{ [rngBrand]: "host-episode-rng" }>;
type Cursor = { root: number; state: number; drawCount: number };
const cursors = new WeakMap<object, Cursor>();
const lookupCursor = WeakMap.prototype.get.bind(cursors);
const registerCursor = WeakMap.prototype.set.bind(cursors);
const requireCursor = (value: unknown): Cursor => {
  if (value === null || typeof value !== "object") return reject("PROVENANCE");
  const cursor = lookupCursor(value);
  if (!cursor) return reject("PROVENANCE");
  return cursor;
};
export const restoreEpisodeRng = (start: ActiveStreamState): EpisodeRng => {
  const state = requireActiveStreamState(start);
  const token = freeze({}) as EpisodeRng;
  registerCursor(token, { root: state.root, state: state.state, drawCount: state.drawCount });
  return token;
};
export const drawEpisodeRng = (value: EpisodeRng): number => {
  const cursor = requireCursor(value);
  if (cursor.drawCount === MAX) return reject("COUNTER");
  const state = (cursor.state + STEP) >>> 0;
  let t = state;
  t = imul(t ^ (t >>> 15), t | 1);
  t ^= t + imul(t ^ (t >>> 7), t | 61);
  const uniform = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  cursor.state = state;
  cursor.drawCount++;
  return uniform;
};
export const snapshotEpisodeRng = (value: EpisodeRng): ActiveStreamState => {
  const cursor = requireCursor(value);
  return constructActiveStreamState(cursor.root, cursor.state, cursor.drawCount);
};
export const equalEpisodeStreamStates = (left: StreamState, right: StreamState): boolean => {
  const a = requireEpisodeStreamState(left), b = requireEpisodeStreamState(right);
  return a.status === b.status && a.root === b.root && a.state === b.state && a.drawCount === b.drawCount;
};
export const checkPersistentEpisodeStream = (value: ActiveStreamState, root: number): void => {
  const stream = requireActiveStreamState(value), r = requireEpisodeInteger(root, 0, UINT32);
  const state = (r + imul(STEP, stream.drawCount % 4294967296)) >>> 0;
  if (stream.root !== r || stream.state !== state) return reject("RNG");
};

export type StartedSelection = Readonly<{ selection: ActiveStreamState; permutation: readonly number[] }>;
export const reconstructStartedSelection = (master: Master, startedOrdinal: number): StartedSelection => {
  const m = requireEpisodeMaster(master), a = requireEpisodeInteger(startedOrdinal, 0, 999);
  const root = deriveEpisodeRoot(m, "selection"), rng = restoreEpisodeRng(constructActiveStreamState(root, root, 0));
  const corpusCount = floor((a + 2) / 2), epoch = floor((corpusCount - 1) / 18);
  let permutation: number[] = [];
  for (let current = 0; current <= epoch; current++) {
    permutation = [];
    for (let index = 0; index < 18; index++) permutation.push(index);
    for (let index = 17; index >= 1; index--) {
      const selected = floor(drawEpisodeRng(rng) * (index + 1)), item = permutation[index]!;
      permutation[index] = permutation[selected]!;
      permutation[selected] = item;
    }
  }
  return publish({ selection: snapshotEpisodeRng(rng), permutation: freeze(permutation) }, "selection");
};
export const requireStartedSelection = (value: unknown): StartedSelection => requireRole(value, "selection");
