import { createEffect, createRoot } from "solid-js";
import { describe, expect, it } from "vitest";

import { createShellFields } from "~/app/shellFields";

type Shell = { phase: string; selected?: string; economies: { w: number } };

const harness = (read: (s: Shell) => unknown) =>
  createRoot((dispose) => {
    const shell = createShellFields<Shell>({ phase: "planning", economies: { w: 1 } });
    let runs = 0;
    createEffect(() => {
      read(shell.view);
      runs++;
    });
    return { shell, runs: () => runs, dispose };
  });

describe("createShellFields", () => {
  it("wakes a reader only when a field it read changes", () => {
    const h = harness((s) => s.phase);
    const base = h.shell.read();
    h.shell.write({ ...base, selected: "e2" });
    h.shell.write({ ...h.shell.read(), economies: { w: 2 } });
    expect(h.runs()).toBe(1);
    h.shell.write({ ...h.shell.read(), phase: "resolving" });
    expect(h.runs()).toBe(2);
    h.dispose();
  });

  it("tracks an optional field that did not exist at first read", () => {
    const h = harness((s) => s.selected);
    h.shell.write({ ...h.shell.read(), selected: "e2" });
    expect(h.runs()).toBe(2);
    expect(h.shell.view.selected).toBe("e2");
    h.dispose();
  });

  it("keeps the reducer's immutable values — no in-place mutation", () => {
    const h = harness((s) => s.economies);
    const before = h.shell.read().economies;
    h.shell.write({ ...h.shell.read(), economies: { w: 5 } });
    expect(before).toEqual({ w: 1 });
    expect(h.shell.view.economies).toEqual({ w: 5 });
    h.dispose();
  });

  it("spreads to a plain snapshot and refuses writes", () => {
    const h = harness(() => undefined);
    expect({ ...h.shell.view }).toEqual({ phase: "planning", economies: { w: 1 } });
    expect(() => {
      (h.shell.view as { phase: string }).phase = "x";
    }).toThrow(/read-only/);
    h.dispose();
  });
});
