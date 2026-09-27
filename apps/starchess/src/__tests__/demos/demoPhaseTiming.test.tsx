import { cleanup, render } from "@solidjs/testing-library";
import type { JSX } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CrushBoardDemo } from "~/presentation/animations/components/CrushBoardDemo";
import { DeathBoardDemo } from "~/presentation/animations/components/DeathBoardDemo";
import { DeployBoardDemo } from "~/presentation/animations/components/DeployBoardDemo";
import { DEATH_MS, HOLD_MS, IDLE_MS } from "~/presentation/animations/deathAnim";
import { CRUSH_DEATH_MS, DEPLOY_MS } from "~/presentation/constants";
import { MenuPlanet } from "~/screens/menuSky/MenuPlanet";

const FRAME_MS = 16;

type Case = {
  name: string;
  view: () => JSX.Element;
  read: (root: HTMLElement) => string | undefined;
  steps: readonly (readonly [number, string])[];
  cycleMs: number;
};

const caption = (root: HTMLElement) => root.textContent?.match(/ · (idle|dying|gone|falling|landed|crushing) · /)?.[1];

const CRUSH_WINDOW_MS = Math.max(DEPLOY_MS, CRUSH_DEATH_MS + DEATH_MS);

const CASES: Case[] = [
  {
    name: "DeathBoardDemo",
    view: () => <DeathBoardDemo subject="p" />,
    read: caption,
    steps: [[0, "idle"], [IDLE_MS, "dying"], [IDLE_MS + DEATH_MS, "gone"]],
    cycleMs: IDLE_MS + DEATH_MS + HOLD_MS + 400,
  },
  {
    name: "DeployBoardDemo",
    view: () => <DeployBoardDemo piece="p" />,
    read: caption,
    steps: [[0, "idle"], [400, "falling"], [400 + DEPLOY_MS, "landed"]],
    cycleMs: DEPLOY_MS + 900,
  },
  {
    name: "CrushBoardDemo",
    view: () => <CrushBoardDemo />,
    read: caption,
    steps: [[0, "idle"], [IDLE_MS, "crushing"], [IDLE_MS + CRUSH_WINDOW_MS, "landed"]],
    cycleMs: IDLE_MS + CRUSH_WINDOW_MS + HOLD_MS + 400,
  },
  {
    name: "MenuPlanet",
    view: () => <MenuPlanet />,
    read: (root) => root.querySelector<HTMLElement>("[data-phase]")?.dataset.phase,
    steps: [[0, "enter"], [900, "hold"], [900 + 2200, "exit"]],
    cycleMs: 900 + 2200 + 900,
  },
];

describe("demo phase ladders keep their timing on the frame clock", () => {
  beforeEach(() =>
    vi.useFakeTimers({
      toFake: [
        "setTimeout",
        "clearTimeout",
        "setInterval",
        "clearInterval",
        "requestAnimationFrame",
        "cancelAnimationFrame",
        "performance",
      ],
    }),
  );
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  for (const c of CASES) {
    it(`${c.name}: each phase starts at its offset, and the cycle repeats`, async () => {
      const { container } = render(c.view);
      vi.advanceTimersByTime(FRAME_MS);
      await Promise.resolve();
      const at = async (t: number) => {
        vi.advanceTimersByTime(t);
        await Promise.resolve();
        return c.read(container);
      };
      let now = 0;
      const seek = (t: number) => {
        const step = t - now;
        now = t;
        return at(step);
      };
      for (let cycle = 0; cycle < 2; cycle++) {
        const base = cycle * c.cycleMs;
        for (let i = 0; i < c.steps.length; i++) {
          const [offset, phase] = c.steps[i]!;
          if (offset > 0) expect(await seek(base + offset - 2 * FRAME_MS), `${phase} early`).toBe(c.steps[i - 1]![1]);
          expect(await seek(base + offset + 2 * FRAME_MS), `${phase} at ${base + offset}`).toBe(phase);
        }
      }
    });
  }
});
