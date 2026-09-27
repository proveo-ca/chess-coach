// SPEC: _spec/apps/starchess/architecture/reactivity.md, _spec/apps/starchess/architecture/reactivity/components.md
import { DEV } from "solid-js";

type Owner = { fn?: (v: unknown) => unknown; name?: string };

const SITE_RX = /\/src\/([^?:)]+)(?:\?[^:)]*)?:(\d+):\d+/;

const siteOf = (): string => {
  const stack = new Error().stack?.split("\n") ?? [];
  for (const line of stack.slice(3)) {
    if (line.includes("/debug/reactivityProbe")) continue;
    const m = SITE_RX.exec(line);
    if (m) return `${m[1]}:${m[2]}`;
  }
  return "(framework)";
};

export const initReactivityProbe = (): void => {
  if (!DEV || typeof window === "undefined") return;
  if (!new URLSearchParams(window.location.search).has("debug", "reactivity")) return;

  const runs = new Map<string, number>();
  const created = new Map<string, number>();

  DEV.hooks.afterCreateOwner = (owner: Owner) => {
    const fn = owner.fn;
    if (typeof fn !== "function") return;
    const site = siteOf();
    created.set(site, (created.get(site) ?? 0) + 1);
    owner.fn = function (this: unknown, v: unknown) {
      runs.set(site, (runs.get(site) ?? 0) + 1);
      return fn.call(this, v);
    };
  };

  const table = (m: Map<string, number>, n: number) =>
    [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([site, count]) => ({ site, count }));

  (window as unknown as { __reactivity: unknown }).__reactivity = {
    reset: () => {
      runs.clear();
      created.clear();
    },
    top: (n = 25) => table(runs, n),
    created: (n = 25) => table(created, n),
    totals: () => ({
      runs: [...runs.values()].reduce((a, b) => a + b, 0),
      created: [...created.values()].reduce((a, b) => a + b, 0),
    }),
  };
  console.info("[reactivity] probe on — __reactivity.reset() / .top() / .created()");
};
