import { describe, expect, it } from "vitest";

import {
  addScAction,
  removeScAction,
  RemoveScActionError,
} from "~/starchess/scActions";
import { parseScFen } from "~/starchess/scfen";

const start = () =>
  parseScFen("SCFEN|4k3/8/8/8/8/8/4P3/4K3|11|33|P|G:22:22|Q:w:;b:");

describe("removeScAction", () => {
  it("removes classical and leaves shape valid", () => {
    let snap = start();
    const { snapshot: queued, action } = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "e2",
        to: "e3",
      },
    });
    const { snapshot: next, removed } = removeScAction({
      snapshot: queued,
      seq: action.seq,
    });
    expect(removed.seq).toBe(action.seq);
    expect(next.queue?.actions).toEqual([]);
    expect(next.gas.w).toBe(2);
  });

  it("refunds gas for specials", () => {
    let snap = start();
    const { snapshot: queued, action } = addScAction({
      snapshot: snap,
      action: { timing: "B", kind: "pawnDouble", color: "w", from: "e2", to: "e3" },
    });
    expect(queued.gas.w).toBe(1);
    const { snapshot: next } = removeScAction({ snapshot: queued, seq: action.seq });
    expect(next.gas.w).toBe(2);
    expect(next.queue?.actions).toEqual([]);
  });

  it("throws when seq missing", () => {
    expect(() => removeScAction({ snapshot: start(), seq: 99 })).toThrow(
      RemoveScActionError,
    );
  });
});
