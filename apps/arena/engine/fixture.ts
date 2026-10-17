// SPEC: _spec/apps/arena/burn-compat.puml
import { beginScTurn, parseScFen } from "@chess-coach/starchess-core";
import { assertOpenSnapshot, explicitBank } from "./admission";

export const OPENING = "SCFEN|4k3/8/8/8/8/8/8/4K3|0|33|P|G:11:11|B:3:3|Q:w:;b:";

export function openedFixture() {
  const initial = parseScFen(OPENING);
  assertOpenSnapshot(initial);
  const bankBefore = explicitBank(initial);
  const rawBegin = beginScTurn(structuredClone(initial));
  const opening = { ...structuredClone(rawBegin.next), stored: { ...bankBefore } };
  assertOpenSnapshot(opening);
  return { initial, opening, bankBefore, rawBegin };
}
