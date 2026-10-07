// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import * as native from "../index";
import * as planning from "../planning-v1";

it("resolves the narrow entry and shares legacy native implementations", () => {
  const require = createRequire(import.meta.url);
  expect(require.resolve("@chess-coach/starchess-core/planning-v1")).toBe(fileURLToPath(new URL("../planning-v1.ts", import.meta.url)));
  expect(Object.keys(planning).sort()).toEqual([
    "appendTimeSpecialAnchor", "charonDiagonalSquaresFromSquare", "classicalActorAt", "classicalRewriteCoordinatesAfterB",
    "isScMoveShape", "knownAppendFailure", "marineSingleTarget", "spawnCCAnchorFromMap", "UNIT_COST", "specialGasCost",
    "CC_MAX_LIVES", "MAX_GAME_TURNS", "MAX_STORED_MATERIAL", "MAX_MINES_PER_SIDE",
    "countedPlanningKnowledge",
  ].sort());
  for (const name of Object.keys(planning) as (keyof typeof planning)[]) {
    if (name !== "countedPlanningKnowledge") expect(planning[name]).toBe(native[name]);
  }
  expect(typeof planning.countedPlanningKnowledge).toBe("function");
  expect("countedPlanningKnowledge" in native).toBe(false);
  expect(Object.isFrozen(planning.UNIT_COST)).toBe(true);
  expect("parseScFen" in planning || "addScAction" in planning || "resolveTurn" in planning || "historyFromRecord" in planning).toBe(false);
});
