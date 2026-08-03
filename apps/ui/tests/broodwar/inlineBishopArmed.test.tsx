import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, describe, expect, it } from "vitest";

import { InlineBishop } from "~/broodwar/animations/pieces/InlineBishop";

afterEach(cleanup);

const launchers = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[data-part="charon-launcher"]'));

const caps = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[data-part="charon-launcher-caps"]'));

describe("InlineBishop Charon armed launchers", () => {
  it("front: aims both popped shoulder launchers at the special diagonal under the cockpit", () => {
    const { container } = render(() => (
      <InlineBishop color="w" face="front" armed armAnim launcherDeg={-45} />
    ));
    const svg = container.querySelector("svg")!;
    const head = container.querySelector('[data-part="head"]')!;
    const found = launchers(container);

    expect(svg.getAttribute("data-bishop-face")).toBe("front");
    expect(svg.getAttribute("data-charon-armed")).toBe("true");
    expect(svg.getAttribute("data-charon-arm-anim")).toBe("true");
    expect(container.querySelector('[data-part="charon-launchers"]')?.getAttribute("data-launcher-aim")).toBe("-45");
    expect(found).toHaveLength(2);
    expect(found.map((el) => el.getAttribute("transform") ?? "")).toEqual([
      expect.stringContaining("translate(14 20) rotate(-45"),
      expect.stringContaining("translate(31 20) rotate(-45"),
    ]);
    expect(head.firstElementChild?.getAttribute("data-part")).toBe("charon-launchers");
  });

  it("back: aims both launchers and keeps them over the whole Goliath", () => {
    const { container } = render(() => (
      <InlineBishop color="w" face="back" armed launcherDeg={135} />
    ));
    const svg = container.querySelector("svg")!;
    const head = container.querySelector('[data-part="head"]')!;
    const found = launchers(container);

    expect(svg.getAttribute("data-bishop-face")).toBe("back");
    expect(found).toHaveLength(2);
    expect(found.map((el) => el.getAttribute("transform") ?? "")).toEqual([
      expect.stringContaining("rotate(135"),
      expect.stringContaining("rotate(135"),
    ]);
    expect(head.lastElementChild?.getAttribute("data-part")).toBe("charon-launchers");
  });

  it("keeps the default split pose when no aim is provided", () => {
    const { container } = render(() => <InlineBishop color="w" face="front" armed />);
    expect(launchers(container).map((el) => el.getAttribute("transform") ?? "")).toEqual([
      expect.stringContaining("rotate(-135"),
      expect.stringContaining("rotate(-45"),
    ]);
  });

  it("shows loaded green caps while armed and hides them when the missile animation begins", () => {
    const loaded = render(() => <InlineBishop color="w" face="front" armed />);
    expect(caps(loaded.container)).toHaveLength(2);
    cleanup();

    const firing = render(() => (
      <InlineBishop color="w" face="front" armed launcherCapsVisible={false} />
    ));
    expect(caps(firing.container)).toHaveLength(0);
  });

  it("idle: no launchers", () => {
    const { container } = render(() => <InlineBishop color="w" face="front" />);
    expect(launchers(container)).toHaveLength(0);
    expect(container.querySelector("svg")?.getAttribute("data-charon-armed")).toBeNull();
  });
});
