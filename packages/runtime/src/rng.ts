// SPEC: _spec/policy-runtime.puml
import type {} from "bun";
import { createHash } from "node:crypto";
import { streamStateShape } from "../../contracts/src/episode";
import type { StreamState } from "../../contracts/src/episode";

export const RNG_VERSION = "starchess-training-rng-v1";
export const MASTERS = [101, 102, 103, 104, 105] as const;
export const STREAM_LABELS = ["selection", "environment-settlement", "policy-sampling", "opponent"] as const;
export type StreamLabel = typeof STREAM_LABELS[number];
export function deriveStream(master: number, label: StreamLabel): StreamState {
  if (!(MASTERS as readonly number[]).includes(master) || !STREAM_LABELS.includes(label)) throw new Error("RNG: DOMAIN");
  const bytes = createHash("sha256").update(JSON.stringify([RNG_VERSION, master, label])).digest();
  const root = bytes.readUInt32BE(0);
  return { status: label === "environment-settlement" ? "unused" : "active", root, state: root, drawCount: 0 };
}
export function drawStream(value: StreamState): { uniform: number; after: StreamState } {
  const before = streamStateShape.parse(value);
  if (before.status !== "active" || before.drawCount === Number.MAX_SAFE_INTEGER) throw new Error("RNG: CLOSED_OR_EXHAUSTED");
  const state = (before.state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const uniform = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { uniform, after: { ...before, state, drawCount: before.drawCount + 1 } };
}
export function deriveRoster(): { master: number; label: StreamLabel; stream: StreamState }[] {
  const roster = MASTERS.flatMap(master => STREAM_LABELS.map(label => ({ master, label, stream: deriveStream(master, label) })));
  if (new Set(roster.map(entry => entry.stream.root)).size !== roster.length) throw new Error("RNG: CROSS_ROSTER_COLLISION");
  return roster;
}
