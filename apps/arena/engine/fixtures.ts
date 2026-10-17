// SPEC: _spec/apps/arena/burn-compat.puml
import { formatScFen, parseScFen, validateScFen, type ScFenSnapshot } from "@chess-coach/starchess-core";
import { EngineErrorV2, type FixtureId } from "./wire-v2";

export const FIXTURES_V2: Readonly<Record<FixtureId, string>> = Object.freeze({
  "tiny-v1": "SCFEN|4k3/8/8/8/8/8/8/4K3|0|33|P|G:11:11|B:3:3|Q:w:;b:",
  "standard-v1": "SCFEN|4k3/2pppp2/8/8/8/8/2PPPP2/4K3|0|33|P|G:11:11|B:3:3|Q:w:;b:",
  "all-actors-v1": "SCFEN|1nbrkq2/4p3/8/8/8/8/4P3/1NBRKQ2|21|33|P|G:33:33|B:12:12|Q:w:;b:",
});

export function fixtureV2(fixture: FixtureId): ScFenSnapshot {
  if (!Object.hasOwn(FIXTURES_V2, fixture)) throw new EngineErrorV2("BAD_REQUEST", "Invalid fixture");
  const raw = FIXTURES_V2[fixture];
  const checked = validateScFen(raw);
  if (!checked.ok) throw new EngineErrorV2("ENGINE_FAILURE", "Invalid native fixture");
  const snapshot = parseScFen(raw);
  const roundtrip = validateScFen(formatScFen(snapshot));
  if (!roundtrip.ok || snapshot.phase !== "P" || snapshot.queue?.actions.length !== 0 || !snapshot.stored) {
    throw new EngineErrorV2("ENGINE_FAILURE", "Invalid native fixture state");
  }
  return snapshot;
}
