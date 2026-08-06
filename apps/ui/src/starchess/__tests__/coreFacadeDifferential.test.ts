/**
 * Differential: UI facades must re-export the same core symbols (PLAN Phase 1).
 * Old module paths remain stable while implementations live in starchess-core.
 */
import { describe, expect, it } from "vitest";

import * as Core from "@chess-coach/starchess-core";
import * as Board from "~/starchess/board";
import * as End from "~/starchess/endScTurn";
import * as Actions from "~/starchess/scActions";
import * as Moves from "~/starchess/scMoves";
import * as Scfen from "~/starchess/scfen";
import * as Outcome from "~/starchess/scOutcome";
import * as Resolve from "~/starchess/resolveTurn";

describe("facade ↔ core differential", () => {
  it("re-exports the same function identities for rules entry points", () => {
    expect(Board.placementToMap).toBe(Core.placementToMap);
    expect(End.endScTurn).toBe(Core.endScTurn);
    expect(Actions.addScAction).toBe(Core.addScAction);
    expect(Actions.addScMove).toBe(Core.addScMove);
    expect(Moves.scMovesFrom).toBe(Core.scMovesFrom);
    expect(Scfen.parseScFen).toBe(Core.parseScFen);
    expect(Scfen.formatScFen).toBe(Core.formatScFen);
    expect(Scfen.validateScFenHistory).toBe(Core.validateScFenHistory);
    expect(Outcome.scOutcome).toBe(Core.scOutcome);
    expect(Resolve.resolveTurn).toBe(Core.resolveTurn);
  });

  it("matches golden Combat Chain placement via facade and core", () => {
    const start =
      "SCFEN|4bk2/8/5n2/4p3/8/2R5/3P4/4K3|0|33|P|G:11:11|Q:w:;b:";
    const viaFacade = (() => {
      let snap = Scfen.parseScFen(start);
      snap = Actions.addScMove(snap, { color: "w", from: "d2", to: "d4" });
      snap = Actions.addScMove(snap, { color: "b", from: "e8", to: "c6" });
      return End.endScTurn(snap).next.placement;
    })();
    const viaCore = (() => {
      let snap = Core.parseScFen(start);
      snap = Core.addScMove(snap, { color: "w", from: "d2", to: "d4" });
      snap = Core.addScMove(snap, { color: "b", from: "e8", to: "c6" });
      return Core.endScTurn(snap).next.placement;
    })();
    expect(viaFacade).toBe(viaCore);
    expect(viaFacade).toBe("5k2/8/2b2n2/4p3/3P4/2R5/8/4K3");
  });
});
