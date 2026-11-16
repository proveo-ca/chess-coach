// SPEC: _spec/packages/starchess-core/adjutant-definitions.puml
import { describe, expect, it } from "vitest";
import { ADJUTANT_DEFINITIONS, isAdjutantKind, isPlayableAdjutantKind } from "../index";

describe("adjutant availability", () => {
  it("keeps learning definitions empty and unavailable", () => {
    const placeholders = ADJUTANT_DEFINITIONS.filter((definition) => definition.status === "placeholder");
    expect(placeholders.map((definition) => definition.id)).toEqual(["machine-learning", "rlhf", "rlcd"]);
    for (const definition of placeholders) {
      expect(Object.keys(definition).sort()).toEqual(["id", "label", "status"]);
      expect(isAdjutantKind(definition.id)).toBe(true);
      expect(isPlayableAdjutantKind(definition.id)).toBe(false);
    }
  });

  it("rejects non-string and unknown values at execution boundaries", () => {
    for (const value of [null, undefined, 0, {}, ["naive"], "ml", "STRATEGIC"]) {
      expect(isAdjutantKind(value)).toBe(false);
      expect(isPlayableAdjutantKind(value)).toBe(false);
    }
    expect(isPlayableAdjutantKind("naive")).toBe(true);
    expect(isPlayableAdjutantKind("strategic")).toBe(true);
  });
});
